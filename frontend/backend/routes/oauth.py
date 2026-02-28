from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from dependencies import db, get_current_active_user
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import os
import uuid
import httpx
import logging
from urllib.parse import urlencode
from services.encryption_service import encryption

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/oauth", tags=["oauth"])

# OAuth Configuration - loaded from environment
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
SIGNNOW_CLIENT_ID = os.environ.get("SIGNNOW_CLIENT_ID", "")
SIGNNOW_CLIENT_SECRET = os.environ.get("SIGNNOW_CLIENT_SECRET", "")
GAMMA_CLIENT_ID = os.environ.get("GAMMA_CLIENT_ID", "")
GAMMA_CLIENT_SECRET = os.environ.get("GAMMA_CLIENT_SECRET", "")

# Get base URL from environment
BASE_URL = os.environ.get("BASE_URL", "http://localhost:8001").strip().rstrip("/")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").strip().rstrip("/")


_OAUTH_STATE_TTL_MINUTES = 10  # State parameters expire after 10 minutes


def _resolve_base_url(request: Optional[Request] = None) -> str:
    """Resolve API public base URL, preferring env but falling back to request headers."""
    configured = os.environ.get("BASE_URL", "").strip().rstrip("/")
    if configured:
        return configured

    is_production = os.environ.get("ENVIRONMENT", "development").lower() == "production"

    if request:
        proto = (
            request.headers.get("x-forwarded-proto")
            or request.url.scheme
            or "https"
        )
        # Force HTTPS in production regardless of header
        if is_production:
            proto = "https"
        host = request.headers.get("x-forwarded-host") or request.headers.get("host")
        if host:
            return f"{proto}://{host}".rstrip("/")

    return BASE_URL


async def _validate_oauth_state(state: str, provider: str) -> dict:
    """Validate and consume an OAuth state parameter. Checks TTL and returns state doc."""
    state_doc = await db.oauth_states.find_one({"state": state, "provider": provider})
    if not state_doc:
        return None

    # Check TTL
    created_at_str = state_doc.get("created_at", "")
    try:
        created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) - created_at > timedelta(minutes=_OAUTH_STATE_TTL_MINUTES):
            logger.warning("OAuth state expired for provider=%s (created %s)", provider, created_at_str)
            await db.oauth_states.delete_one({"state": state})
            return None
    except (ValueError, TypeError):
        logger.warning("OAuth state has invalid created_at: %s", created_at_str)

    # Consume the state (single-use)
    await db.oauth_states.delete_one({"state": state})
    return state_doc

class OAuthStatus(BaseModel):
    provider: str
    connected: bool
    user_email: Optional[str] = None
    connected_at: Optional[str] = None
    scopes: list = []
    token_stale: bool = False
    needs_reconnect: bool = False

class OAuthToken(BaseModel):
    provider: str
    access_token: str
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None
    scopes: list = []
    user_info: dict = {}

# ============ STATUS ENDPOINTS ============

@router.get("/status")
async def get_all_oauth_status(current_user: dict = Depends(get_current_active_user)):
    """Get connection status for all OAuth providers"""
    user_id = current_user.get("id")
    
    providers = ["google", "signnow", "gamma"]
    statuses = {}
    
    for provider in providers:
        token = await db.oauth_tokens.find_one(
            {"user_id": user_id, "provider": provider},
            {"_id": 0}
        )
        
        if token:
            is_stale = token.get("token_stale", False)
            expires_at = token.get("expires_at", 0)
            is_expired = datetime.now(timezone.utc).timestamp() > expires_at - 300
            statuses[provider] = {
                "connected": True,
                "user_email": token.get("user_info", {}).get("email"),
                "connected_at": token.get("connected_at"),
                "scopes": token.get("scopes", []),
                "token_stale": is_stale,
                "needs_reconnect": is_stale or (is_expired and not token.get("refresh_token")),
            }
        else:
            statuses[provider] = {
                "connected": False,
                "user_email": None,
                "connected_at": None,
                "scopes": [],
                "token_stale": False,
                "needs_reconnect": False,
            }
    
    # Check if OAuth is configured
    config_status = {
        "google": bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET),
        "signnow": bool(SIGNNOW_CLIENT_ID and SIGNNOW_CLIENT_SECRET),
        "gamma": bool(GAMMA_CLIENT_ID and GAMMA_CLIENT_SECRET)
    }
    
    return {"statuses": statuses, "configured": config_status}

@router.get("/status/{provider}")
async def get_oauth_status(provider: str, current_user: dict = Depends(get_current_active_user)):
    """Get connection status for a specific provider"""
    user_id = current_user.get("id")
    
    token = await db.oauth_tokens.find_one(
        {"user_id": user_id, "provider": provider},
        {"_id": 0}
    )
    
    if token:
        is_stale = token.get("token_stale", False)
        # Check if token is expired AND we can't refresh
        expires_at = token.get("expires_at", 0)
        is_expired = datetime.now(timezone.utc).timestamp() > expires_at - 300
        needs_reconnect = is_stale or (is_expired and not token.get("refresh_token"))
        return OAuthStatus(
            provider=provider,
            connected=True,
            user_email=token.get("user_info", {}).get("email"),
            connected_at=token.get("connected_at"),
            scopes=token.get("scopes", []),
            token_stale=is_stale,
            needs_reconnect=needs_reconnect,
        )

    return OAuthStatus(provider=provider, connected=False)


@router.get("/google/config-debug")
async def google_oauth_config_debug(
    request: Request,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Debug endpoint to verify runtime Google OAuth wiring.
    Returns only non-sensitive metadata.
    """
    base_url = _resolve_base_url(request)
    redirect_uri = f"{base_url}/api/oauth/google/callback"
    client_id = (GOOGLE_CLIENT_ID or "").strip()
    client_id_prefix = f"{client_id[:12]}..." if client_id else ""
    return {
        "google_client_id_prefix": client_id_prefix,
        "base_url": base_url,
        "expected_redirect_uri": redirect_uri,
        "frontend_url": FRONTEND_URL,
        "configured": bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET),
    }

# ============ GOOGLE OAUTH ============

@router.get("/google/connect")
async def google_oauth_connect(
    request: Request,
    current_user: dict = Depends(get_current_active_user)
):
    """Initiate Google OAuth flow"""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Google OAuth not configured. Please contact administrator.")
    
    # Store state for CSRF protection
    state = str(uuid.uuid4())
    base_url = _resolve_base_url(request)
    redirect_uri = f"{base_url}/api/oauth/google/callback"

    await db.oauth_states.insert_one({
        "state": state,
        "user_id": current_user.get("id"),
        "provider": "google",
        "redirect_uri": redirect_uri,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Google OAuth scopes for Gmail, Drive, Calendar
    scopes = [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/calendar"
    ]
    
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(
        {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(scopes),
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
    )
    logger.info("Google OAuth connect redirect_uri=%s", redirect_uri)
    
    return {"auth_url": auth_url, "state": state, "redirect_uri": redirect_uri}

@router.get("/google/callback")
async def google_oauth_callback(
    request: Request,
    code: str,
    state: str
):
    """Handle Google OAuth callback"""
    # Verify state (with TTL and single-use)
    state_doc = await _validate_oauth_state(state, "google")
    if not state_doc:
        logger.error("Google callback: invalid/expired state=%s", state[:20])
        return RedirectResponse(url=f"{FRONTEND_URL}/settings?oauth=google&status=error&reason=invalid_state")

    user_id = state_doc.get("user_id")

    # Exchange code for tokens using exact redirect URI used at connect-time.
    redirect_uri = state_doc.get("redirect_uri") or f"{_resolve_base_url(request)}/api/oauth/google/callback"

    logger.info("Google callback: exchanging code, redirect_uri=%s client_id_prefix=%s", redirect_uri, (GOOGLE_CLIENT_ID or "")[:12])

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri
                }
            )

            if token_response.status_code != 200:
                error_body = token_response.text
                logger.error(
                    "Google token exchange failed: status=%d redirect_uri=%s body=%s",
                    token_response.status_code, redirect_uri, error_body[:500]
                )
                # Parse Google's error for a user-friendly message
                try:
                    err_json = token_response.json()
                    err_desc = err_json.get("error_description", err_json.get("error", "Unknown"))
                except Exception:
                    err_desc = error_body[:200]
                from urllib.parse import quote
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?oauth=google&status=error&reason={quote(err_desc)}"
                )

            tokens = token_response.json()

            # Get user info
            user_info_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"}
            )

            user_info = user_info_response.json() if user_info_response.status_code == 200 else {}
    except Exception as exc:
        logger.exception("Google callback token exchange exception: %s", exc)
        return RedirectResponse(url=f"{FRONTEND_URL}/settings?oauth=google&status=error&reason=token_exchange_failed")

    # Store tokens (encrypted at rest)
    raw_access = tokens.get("access_token", "")
    raw_refresh = tokens.get("refresh_token", "")
    token_set = {
        "user_id": user_id,
        "provider": "google",
        "access_token": encryption.encrypt_token(raw_access) if raw_access else "",
        "refresh_token": encryption.encrypt_token(raw_refresh) if raw_refresh else "",
        "encrypted": True,
        "expires_at": datetime.now(timezone.utc).timestamp() + tokens.get("expires_in", 3600),
        "scopes": tokens.get("scope", "").split(" "),
        "user_info": user_info,
        "connected_at": datetime.now(timezone.utc).isoformat(),
        "token_stale": False,
        "last_refresh_error": None,
    }
    await db.oauth_tokens.update_one(
        {"user_id": user_id, "provider": "google"},
        {"$set": token_set},
        upsert=True
    )

    logger.info("Google OAuth connected for user=%s email=%s", user_id, user_info.get("email"))
    # Redirect back to frontend settings page
    return RedirectResponse(url=f"{FRONTEND_URL}/settings?oauth=google&status=success")

# ============ SIGNNOW OAUTH ============

@router.get("/signnow/connect")
async def signnow_oauth_connect(current_user: dict = Depends(get_current_active_user)):
    """Initiate SignNow OAuth flow"""
    if not SIGNNOW_CLIENT_ID:
        raise HTTPException(status_code=400, detail="SignNow OAuth not configured. Please contact administrator.")
    
    state = str(uuid.uuid4())
    await db.oauth_states.insert_one({
        "state": state,
        "user_id": current_user.get("id"),
        "provider": "signnow",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    redirect_uri = f"{BASE_URL}/api/oauth/signnow/callback"
    
    auth_url = (
        f"https://app.signnow.com/authorize?"
        f"client_id={SIGNNOW_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"state={state}"
    )
    
    return {"auth_url": auth_url, "state": state}

@router.get("/signnow/callback")
async def signnow_oauth_callback(code: str, state: str):
    """Handle SignNow OAuth callback"""
    state_doc = await _validate_oauth_state(state, "signnow")
    if not state_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired state parameter")

    user_id = state_doc.get("user_id")
    
    redirect_uri = f"{BASE_URL}/api/oauth/signnow/callback"
    
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://api.signnow.com/oauth2/token",
            data={
                "client_id": SIGNNOW_CLIENT_ID,
                "client_secret": SIGNNOW_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange authorization code")
        
        tokens = token_response.json()
    
    sn_access = tokens.get("access_token", "")
    sn_refresh = tokens.get("refresh_token", "")
    await db.oauth_tokens.update_one(
        {"user_id": user_id, "provider": "signnow"},
        {"$set": {
            "user_id": user_id,
            "provider": "signnow",
            "access_token": encryption.encrypt_token(sn_access) if sn_access else "",
            "refresh_token": encryption.encrypt_token(sn_refresh) if sn_refresh else "",
            "encrypted": True,
            "expires_at": datetime.now(timezone.utc).timestamp() + tokens.get("expires_in", 3600),
            "user_info": {},
            "connected_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return RedirectResponse(url=f"{FRONTEND_URL}/settings?oauth=signnow&status=success")

# ============ GAMMA OAUTH ============

@router.get("/notion/connect")
async def notion_oauth_connect(current_user: dict = Depends(get_current_active_user)):
    """Initiate Notion OAuth flow"""
    if not GAMMA_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Notion OAuth not configured. Please contact administrator.")
    
    state = str(uuid.uuid4())
    await db.oauth_states.insert_one({
        "state": state,
        "user_id": current_user.get("id"),
        "provider": "gamma",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    redirect_uri = f"{BASE_URL}/api/oauth/notion/callback"
    
    auth_url = (
        f"https://api.notion.com/v1/oauth/authorize?"
        f"client_id={GAMMA_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"owner=user&"
        f"state={state}"
    )
    
    return {"auth_url": auth_url, "state": state}

@router.get("/notion/callback")
async def notion_oauth_callback(code: str, state: str):
    """Handle Notion OAuth callback"""
    state_doc = await _validate_oauth_state(state, "gamma")
    if not state_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired state parameter")

    user_id = state_doc.get("user_id")
    
    redirect_uri = f"{BASE_URL}/api/oauth/notion/callback"
    
    import base64
    credentials = base64.b64encode(f"{GAMMA_CLIENT_ID}:{GAMMA_CLIENT_SECRET}".encode()).decode()
    
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://api.notion.com/v1/oauth/token",
            json={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri
            },
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/json"
            }
        )
        
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange authorization code")
        
        tokens = token_response.json()
    
    await db.oauth_tokens.update_one(
        {"user_id": user_id, "provider": "gamma"},
        {"$set": {
            "user_id": user_id,
            "provider": "gamma",
            "access_token": tokens.get("access_token"),
            "workspace_id": tokens.get("workspace_id"),
            "workspace_name": tokens.get("workspace_name"),
            "user_info": tokens.get("owner", {}),
            "connected_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return RedirectResponse(url=f"{FRONTEND_URL}/settings?oauth=notion&status=success")

# ============ DISCONNECT ============

@router.delete("/{provider}/disconnect")
async def disconnect_oauth(provider: str, current_user: dict = Depends(get_current_active_user)):
    """Disconnect an OAuth provider"""
    user_id = current_user.get("id")
    
    result = await db.oauth_tokens.delete_one({"user_id": user_id, "provider": provider})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No connection found")
    
    return {"message": f"Disconnected from {provider}"}

# ============ TOKEN REFRESH ============

def _decrypt_token_field(token_doc: dict, field: str) -> str:
    """Decrypt a token field, handling both encrypted and legacy plaintext tokens."""
    raw = token_doc.get(field, "")
    if not raw:
        return ""
    if token_doc.get("encrypted"):
        try:
            return encryption.decrypt_token(raw)
        except Exception:
            logger.warning("Failed to decrypt %s for user=%s — may be legacy plaintext", field, token_doc.get("user_id"))
            return raw  # Fall back to raw value (legacy unencrypted)
    return raw


async def refresh_google_token(user_id: str):
    """Refresh Google OAuth token"""
    token_doc = await db.oauth_tokens.find_one({"user_id": user_id, "provider": "google"})
    if not token_doc or not token_doc.get("refresh_token"):
        logger.warning("Google refresh failed: no refresh_token in DB for user=%s", user_id)
        return None

    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        logger.error("Google refresh failed: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured")
        return None

    refresh_token_plain = _decrypt_token_field(token_doc, "refresh_token")
    if not refresh_token_plain:
        logger.warning("Google refresh failed: empty refresh_token after decryption for user=%s", user_id)
        return None

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "refresh_token": refresh_token_plain,
                    "grant_type": "refresh_token"
                }
            )

            if response.status_code != 200:
                logger.error(
                    "Google token refresh HTTP %d for user=%s: %s",
                    response.status_code, user_id, response.text[:300]
                )
                await db.oauth_tokens.update_one(
                    {"user_id": user_id, "provider": "google"},
                    {"$set": {"token_stale": True, "last_refresh_error": response.text[:200]}}
                )
                return None

            tokens = response.json()
            new_access = tokens.get("access_token", "")

            await db.oauth_tokens.update_one(
                {"user_id": user_id, "provider": "google"},
                {"$set": {
                    "access_token": encryption.encrypt_token(new_access) if new_access else "",
                    "encrypted": True,
                    "expires_at": datetime.now(timezone.utc).timestamp() + tokens.get("expires_in", 3600),
                    "token_stale": False,
                    "last_refresh_error": None,
                }}
            )

            logger.info("Google token refreshed for user=%s", user_id)
            return new_access
    except Exception as exc:
        logger.exception("Google token refresh exception for user=%s: %s", user_id, exc)
        return None


async def get_valid_token(user_id: str, provider: str):
    """Get a valid access token, refreshing if necessary"""
    token_doc = await db.oauth_tokens.find_one({"user_id": user_id, "provider": provider})
    if not token_doc:
        logger.debug("No oauth token found for user=%s provider=%s", user_id, provider)
        return None

    # Check if token is expired
    expires_at = token_doc.get("expires_at", 0)
    now = datetime.now(timezone.utc).timestamp()
    if now > expires_at - 300:  # 5 min buffer
        logger.info("Token expired for user=%s provider=%s (expired %.0fs ago), refreshing...", user_id, provider, now - expires_at)
        if provider == "google":
            return await refresh_google_token(user_id)
        return None

    return _decrypt_token_field(token_doc, "access_token")

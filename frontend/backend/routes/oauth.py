from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from dependencies import db, get_current_active_user
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os
import uuid
import httpx
import logging
from urllib.parse import urlencode

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


def _resolve_base_url(request: Optional[Request] = None) -> str:
    """Resolve API public base URL, preferring env but falling back to request headers."""
    configured = os.environ.get("BASE_URL", "").strip().rstrip("/")
    if configured:
        return configured

    if request:
        proto = (
            request.headers.get("x-forwarded-proto")
            or request.url.scheme
            or "https"
        )
        host = request.headers.get("x-forwarded-host") or request.headers.get("host")
        if host:
            return f"{proto}://{host}".rstrip("/")

    return BASE_URL

class OAuthStatus(BaseModel):
    provider: str
    connected: bool
    user_email: Optional[str] = None
    connected_at: Optional[str] = None
    scopes: list = []

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
            statuses[provider] = {
                "connected": True,
                "user_email": token.get("user_info", {}).get("email"),
                "connected_at": token.get("connected_at"),
                "scopes": token.get("scopes", [])
            }
        else:
            statuses[provider] = {
                "connected": False,
                "user_email": None,
                "connected_at": None,
                "scopes": []
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
        return OAuthStatus(
            provider=provider,
            connected=True,
            user_email=token.get("user_info", {}).get("email"),
            connected_at=token.get("connected_at"),
            scopes=token.get("scopes", [])
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
    # Verify state
    state_doc = await db.oauth_states.find_one({"state": state, "provider": "google"})
    if not state_doc:
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    
    user_id = state_doc.get("user_id")
    await db.oauth_states.delete_one({"state": state})
    
    # Exchange code for tokens using exact redirect URI used at connect-time.
    redirect_uri = state_doc.get("redirect_uri") or f"{_resolve_base_url(request)}/api/oauth/google/callback"
    
    async with httpx.AsyncClient() as client:
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
            logger.error(f"Google token exchange failed: {token_response.text}")
            raise HTTPException(status_code=400, detail="Failed to exchange authorization code")
        
        tokens = token_response.json()
        
        # Get user info
        user_info_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        
        user_info = user_info_response.json() if user_info_response.status_code == 200 else {}
    
    # Store tokens
    await db.oauth_tokens.update_one(
        {"user_id": user_id, "provider": "google"},
        {"$set": {
            "user_id": user_id,
            "provider": "google",
            "access_token": tokens.get("access_token"),
            "refresh_token": tokens.get("refresh_token"),
            "expires_at": datetime.now(timezone.utc).timestamp() + tokens.get("expires_in", 3600),
            "scopes": tokens.get("scope", "").split(" "),
            "user_info": user_info,
            "connected_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
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
    state_doc = await db.oauth_states.find_one({"state": state, "provider": "signnow"})
    if not state_doc:
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    
    user_id = state_doc.get("user_id")
    await db.oauth_states.delete_one({"state": state})
    
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
    
    await db.oauth_tokens.update_one(
        {"user_id": user_id, "provider": "signnow"},
        {"$set": {
            "user_id": user_id,
            "provider": "signnow",
            "access_token": tokens.get("access_token"),
            "refresh_token": tokens.get("refresh_token"),
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
    state_doc = await db.oauth_states.find_one({"state": state, "provider": "gamma"})
    if not state_doc:
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    
    user_id = state_doc.get("user_id")
    await db.oauth_states.delete_one({"state": state})
    
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

async def refresh_google_token(user_id: str):
    """Refresh Google OAuth token"""
    token_doc = await db.oauth_tokens.find_one({"user_id": user_id, "provider": "google"})
    if not token_doc or not token_doc.get("refresh_token"):
        return None
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "refresh_token": token_doc["refresh_token"],
                "grant_type": "refresh_token"
            }
        )
        
        if response.status_code != 200:
            return None
        
        tokens = response.json()
        
        await db.oauth_tokens.update_one(
            {"user_id": user_id, "provider": "google"},
            {"$set": {
                "access_token": tokens.get("access_token"),
                "expires_at": datetime.now(timezone.utc).timestamp() + tokens.get("expires_in", 3600)
            }}
        )
        
        return tokens.get("access_token")

async def get_valid_token(user_id: str, provider: str):
    """Get a valid access token, refreshing if necessary"""
    token_doc = await db.oauth_tokens.find_one({"user_id": user_id, "provider": provider})
    if not token_doc:
        return None
    
    # Check if token is expired
    expires_at = token_doc.get("expires_at", 0)
    if datetime.now(timezone.utc).timestamp() > expires_at - 300:  # 5 min buffer
        if provider == "google":
            return await refresh_google_token(user_id)
    
    return token_doc.get("access_token")

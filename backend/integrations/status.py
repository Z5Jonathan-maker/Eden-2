"""
Integrations Status API - Single source of truth for integration status

GET /api/integrations/status - Returns what's connected for the current user

Uses oauth_tokens collection (from routes/oauth.py) for Google and SignNow.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, timezone
import os

from routes.auth import get_current_active_user
from dependencies import db

router = APIRouter(prefix="/api/integrations", tags=["Integrations"])


@router.get("/status")
async def get_integrations_status(current_user: dict = Depends(get_current_active_user)):
    """
    Get the status of all integrations for the current user.
    This is the single source of truth for what's connected.
    """
    user_id = current_user.get("id") or str(current_user.get("_id", ""))

    # Check Google OAuth connection (oauth_tokens, user_id based)
    google_connected = False
    google_scopes = []

    google_token = await db.oauth_tokens.find_one(
        {"user_id": user_id, "provider": "google"},
        {"_id": 0}
    )
    if google_token and google_token.get("access_token"):
        expires_at = google_token.get("expires_at")
        if expires_at:
            # oauth.py stores expires_at as a numeric timestamp
            if isinstance(expires_at, (int, float)):
                google_connected = expires_at > datetime.now(timezone.utc).timestamp()
            elif isinstance(expires_at, str):
                try:
                    exp_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                    if exp_dt.tzinfo is None:
                        exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                    google_connected = exp_dt > datetime.now(timezone.utc)
                except ValueError:
                    google_connected = True
            else:
                google_connected = True
        else:
            google_connected = True
        google_scopes = google_token.get("scopes", [])

    # Check Gamma (API key based)
    gamma_connected = bool(os.environ.get("GAMMA_API_KEY"))

    # Check SignNow OAuth connection (oauth_tokens, user_id based)
    signnow_connected = False
    signnow_token = await db.oauth_tokens.find_one(
        {"user_id": user_id, "provider": "signnow"},
        {"_id": 0}
    )
    if signnow_token and signnow_token.get("access_token"):
        signnow_connected = True

    # Check Stripe (API key based)
    stripe_connected = bool(os.environ.get("STRIPE_SECRET_KEY"))

    return {
        "google": {
            "connected": google_connected,
            "scopes": google_scopes,
            "available_scopes": ["calendar", "drive", "gmail"],
            "oauth_required": True
        },
        "gamma": {
            "connected": gamma_connected,
            "requires_key": True,
            "oauth_required": False
        },
        "signnow": {
            "connected": signnow_connected,
            "oauth_required": True
        },
        "stripe": {
            "connected": stripe_connected,
            "requires_key": True,
            "oauth_required": False
        }
    }


@router.delete("/disconnect/{provider}")
async def disconnect_integration(
    provider: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Disconnect an integration by removing stored tokens"""
    user_id = current_user.get("id") or str(current_user.get("_id", ""))

    valid_providers = ["google", "signnow"]
    if provider not in valid_providers:
        raise HTTPException(status_code=400, detail=f"Invalid provider. Must be one of: {valid_providers}")

    # Delete from oauth_tokens (the consolidated collection)
    result = await db.oauth_tokens.delete_one({
        "user_id": user_id,
        "provider": provider
    })

    if result.deleted_count > 0:
        return {"message": f"{provider.title()} disconnected successfully"}
    else:
        return {"message": f"No {provider.title()} connection found"}

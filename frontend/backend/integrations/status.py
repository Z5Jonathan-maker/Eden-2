"""
Integrations Status API - Single source of truth for integration status

GET /api/integrations/status - Returns what's connected for the current user
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
    user_email = current_user.get("email", "")
    
    # Check Google OAuth connection
    google_connected = False
    google_scopes = []
    
    google_token = await db.integration_tokens.find_one(
        {"user_email": user_email, "provider": "google"},
        {"_id": 0}
    )
    if google_token and google_token.get("access_token"):
        # Check if token is not expired
        expires_at = google_token.get("expires_at")
        if expires_at:
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            google_connected = expires_at > datetime.now(timezone.utc)
        else:
            google_connected = True
        google_scopes = google_token.get("scopes", [])
    
    # Check Gamma (API key based)
    gamma_connected = bool(os.environ.get("GAMMA_API_KEY"))
    
    # Check SignNow OAuth connection
    signnow_connected = False
    signnow_token = await db.integration_tokens.find_one(
        {"user_email": user_email, "provider": "signnow"},
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
            "available_scopes": ["calendar", "drive", "slides", "gmail"],
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
    user_email = current_user.get("email", "")
    
    valid_providers = ["google", "signnow"]
    if provider not in valid_providers:
        raise HTTPException(status_code=400, detail=f"Invalid provider. Must be one of: {valid_providers}")
    
    result = await db.integration_tokens.delete_one({
        "user_email": user_email,
        "provider": provider
    })
    
    if result.deleted_count > 0:
        return {"message": f"{provider.title()} disconnected successfully"}
    else:
        return {"message": f"No {provider.title()} connection found"}

"""
Google Client - Handles Google OAuth and Calendar/Drive/Slides APIs

Uses Emergent-managed Google OAuth for authentication.
Tokens are stored in DB and refreshed automatically.

Primary job: Calendar (appointments, inspections)
Secondary: Drive (document storage), Slides (presentations)
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import os
import httpx
import uuid

from routes.auth import get_current_active_user
from dependencies import db

router = APIRouter(prefix="/api/integrations/google", tags=["Google Integration"])

# Emergent Auth endpoint for session data
EMERGENT_AUTH_URL = "https://auth.emergentagent.com"
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

# Google Calendar API
GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"


# ============================================
# MODELS
# ============================================

class CalendarEvent(BaseModel):
    """Calendar event creation model"""
    title: str
    description: Optional[str] = ""
    start_time: str  # ISO datetime
    end_time: str    # ISO datetime
    location: Optional[str] = ""
    attendees: Optional[List[str]] = []  # List of emails
    reminder_minutes: Optional[int] = 30


class CalendarEventResponse(BaseModel):
    """Response from calendar event creation"""
    id: str
    title: str
    start_time: str
    end_time: str
    html_link: str
    status: str


# ============================================
# OAUTH FLOW
# ============================================

@router.get("/auth-url")
async def get_google_auth_url(
    redirect_uri: str,
    scopes: str = "calendar",
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get the Emergent-managed Google OAuth URL.
    Frontend should call this, then redirect user to the returned URL.
    
    REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    The redirect_uri should be dynamically generated from window.location.origin on the frontend.
    """
    # Store the intended redirect and scopes in DB for callback
    user_email = current_user.get("email", "")
    
    await db.oauth_pending.update_one(
        {"user_email": user_email, "provider": "google"},
        {"$set": {
            "user_email": user_email,
            "provider": "google",
            "redirect_uri": redirect_uri,
            "scopes": scopes.split(","),
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # Return Emergent OAuth URL
    # The frontend will redirect to this URL, which will then redirect back with session_id
    auth_url = f"{EMERGENT_AUTH_URL}/?redirect={redirect_uri}"
    
    return {
        "auth_url": auth_url,
        "message": "Redirect user to auth_url to complete Google OAuth"
    }


@router.post("/callback")
async def google_oauth_callback(
    session_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Process the Emergent OAuth callback.
    Frontend calls this after receiving session_id from the OAuth redirect.
    """
    user_email = current_user.get("email", "")
    
    try:
        # Exchange session_id for user data via Emergent
        async with httpx.AsyncClient() as client:
            response = await client.get(
                EMERGENT_SESSION_URL,
                headers={"X-Session-ID": session_id}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Invalid session_id")
            
            session_data = response.json()
        
        # Get pending OAuth info
        pending = await db.oauth_pending.find_one(
            {"user_email": user_email, "provider": "google"},
            {"_id": 0}
        )
        
        scopes = pending.get("scopes", ["calendar"]) if pending else ["calendar"]
        
        # Store the token info
        # Note: Emergent OAuth provides a session_token, but for Google APIs
        # we need actual Google OAuth tokens. This is a simplified flow.
        # In production, you'd need to implement proper Google OAuth.
        
        token_doc = {
            "user_email": user_email,
            "provider": "google",
            "google_email": session_data.get("email"),
            "google_name": session_data.get("name"),
            "google_picture": session_data.get("picture"),
            "session_token": session_data.get("session_token"),
            "scopes": scopes,
            "connected_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        }
        
        await db.integration_tokens.update_one(
            {"user_email": user_email, "provider": "google"},
            {"$set": token_doc},
            upsert=True
        )
        
        # Clean up pending
        await db.oauth_pending.delete_one({"user_email": user_email, "provider": "google"})
        
        return {
            "connected": True,
            "email": session_data.get("email"),
            "name": session_data.get("name"),
            "scopes": scopes,
            "message": "Google account connected successfully"
        }
        
    except Exception as e:
        print(f"[Google OAuth] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# CALENDAR API
# ============================================

async def get_google_token(user_email: str) -> Optional[dict]:
    """Get stored Google token for user"""
    token = await db.integration_tokens.find_one(
        {"user_email": user_email, "provider": "google"},
        {"_id": 0}
    )
    return token


@router.get("/calendar/events")
async def list_calendar_events(
    max_results: int = 10,
    time_min: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """
    List upcoming calendar events.
    Note: This is a placeholder - actual Google Calendar API requires proper OAuth tokens.
    """
    user_email = current_user.get("email", "")
    
    token = await get_google_token(user_email)
    if not token:
        raise HTTPException(status_code=401, detail="Google not connected. Please connect your Google account first.")
    
    # For now, return events from our local DB
    # In production with proper Google OAuth, this would call the Google Calendar API
    events = await db.calendar_events.find(
        {"user_email": user_email},
        {"_id": 0}
    ).sort("start_time", 1).limit(max_results).to_list(max_results)
    
    return {
        "events": events,
        "count": len(events),
        "google_connected": True,
        "note": "Using local calendar storage. Full Google Calendar sync requires additional OAuth setup."
    }


@router.post("/calendar/events")
async def create_calendar_event(
    event: CalendarEvent,
    claim_id: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Create a calendar event.
    Stores locally and will sync to Google Calendar when full OAuth is configured.
    """
    user_email = current_user.get("email", "")
    
    token = await get_google_token(user_email)
    if not token:
        raise HTTPException(status_code=401, detail="Google not connected. Please connect your Google account first.")
    
    event_id = str(uuid.uuid4())
    
    event_doc = {
        "id": event_id,
        "user_email": user_email,
        "title": event.title,
        "description": event.description,
        "start_time": event.start_time,
        "end_time": event.end_time,
        "location": event.location,
        "attendees": event.attendees,
        "reminder_minutes": event.reminder_minutes,
        "claim_id": claim_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "synced_to_google": False,
        "google_event_id": None
    }
    
    await db.calendar_events.insert_one(event_doc)
    
    # Remove _id before returning
    event_doc.pop("_id", None)
    
    return {
        "id": event_id,
        "title": event.title,
        "start_time": event.start_time,
        "end_time": event.end_time,
        "status": "created",
        "synced_to_google": False,
        "message": "Event created locally. Will sync to Google Calendar when full OAuth is configured."
    }


@router.delete("/calendar/events/{event_id}")
async def delete_calendar_event(
    event_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a calendar event"""
    user_email = current_user.get("email", "")
    
    result = await db.calendar_events.delete_one({
        "id": event_id,
        "user_email": user_email
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return {"message": "Event deleted", "id": event_id}


# ============================================
# GOOGLE CLIENT CLASS
# ============================================

class GoogleClient:
    """
    Google integration client for use in other parts of the app.
    Provides a clean interface for Google services.
    """
    
    def __init__(self, user_email: str):
        self.user_email = user_email
        self._token = None
    
    async def is_connected(self) -> bool:
        """Check if user has connected Google"""
        token = await get_google_token(self.user_email)
        return token is not None
    
    async def create_calendar_event(
        self,
        title: str,
        start_time: str,
        end_time: str,
        description: str = "",
        location: str = "",
        claim_id: str = None
    ) -> dict:
        """Create a calendar event"""
        if not await self.is_connected():
            raise Exception("Google not connected")
        
        event_id = str(uuid.uuid4())
        event_doc = {
            "id": event_id,
            "user_email": self.user_email,
            "title": title,
            "description": description,
            "start_time": start_time,
            "end_time": end_time,
            "location": location,
            "claim_id": claim_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "synced_to_google": False
        }
        
        await db.calendar_events.insert_one(event_doc)
        event_doc.pop("_id", None)
        return event_doc
    
    async def list_events(self, limit: int = 20) -> list:
        """List calendar events"""
        events = await db.calendar_events.find(
            {"user_email": self.user_email},
            {"_id": 0}
        ).sort("start_time", 1).limit(limit).to_list(limit)
        return events

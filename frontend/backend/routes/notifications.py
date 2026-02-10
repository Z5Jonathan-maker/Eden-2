"""
Notifications API Routes
Shared in-app notification system for all bots (Harvest Coach, Claims Ops, Comms)
Enhanced with pagination, filtering, and bulk operations for bot workers.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime, timezone
import uuid
import logging

from dependencies import db, get_current_active_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

# ============================================
# TYPES & MODELS
# ============================================

NOTIFICATION_TYPES = ["harvest_coach", "claims_ops", "comms_bot", "system", "claim_created", "claim_assigned", "claim_updated"]


class MarkReadRequest(BaseModel):
    """Request body for marking notifications as read"""
    notification_ids: List[str]


# ============================================
# PUBLIC API ENDPOINTS
# ============================================

@router.get("")
async def get_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    type: Optional[str] = None,
    unread_only: bool = False,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get current user's notifications with pagination.
    Returns most recent first.
    """
    user_id = current_user.get("id")
    
    # Build query
    query = {"user_id": user_id}
    
    if type and type in NOTIFICATION_TYPES:
        query["type"] = type
    
    if unread_only:
        query["is_read"] = False
    
    # Exclude expired notifications
    now = datetime.now(timezone.utc).isoformat()
    query["$or"] = [
        {"expires_at": None},
        {"expires_at": {"$exists": False}},
        {"expires_at": {"$gt": now}}
    ]
    
    # Get total count
    total = await db.notifications.count_documents(query)
    
    # Get paginated results
    skip = (page - 1) * limit
    cursor = db.notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit)
    
    notifications = await cursor.to_list(limit)
    
    return {
        "notifications": notifications,
        "total": total,
        "page": page,
        "limit": limit,
        "has_more": skip + len(notifications) < total
    }


@router.get("/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_active_user)):
    """Get count of unread notifications for current user"""
    user_id = current_user.get("id")
    now = datetime.now(timezone.utc).isoformat()
    
    count = await db.notifications.count_documents({
        "user_id": user_id,
        "is_read": False,
        "$or": [
            {"expires_at": None},
            {"expires_at": {"$exists": False}},
            {"expires_at": {"$gt": now}}
        ]
    })
    
    return {"unread_count": count, "count": count}  # Include both for backwards compat


@router.post("/mark-read")
async def mark_notifications_read(
    request: MarkReadRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Mark one or many notifications as read"""
    user_id = current_user.get("id")
    
    if not request.notification_ids:
        raise HTTPException(status_code=400, detail="No notification IDs provided")
    
    result = await db.notifications.update_many(
        {
            "id": {"$in": request.notification_ids},
            "user_id": user_id  # Security: only mark own notifications
        },
        {
            "$set": {
                "is_read": True,
                "read_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "marked_count": result.modified_count,
        "message": f"Marked {result.modified_count} notifications as read"
    }


@router.put("/{notification_id}/read")
async def mark_single_as_read(
    notification_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Mark a single notification as read (legacy endpoint)"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}


@router.put("/read-all")
async def mark_all_as_read(current_user: dict = Depends(get_current_active_user)):
    """Mark all notifications as read for current user"""
    user_id = current_user.get("id")
    
    result = await db.notifications.update_many(
        {"user_id": user_id, "is_read": False},
        {
            "$set": {
                "is_read": True,
                "read_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "marked_count": result.modified_count,
        "message": f"Marked {result.modified_count} notifications as read"
    }


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a specific notification"""
    user_id = current_user.get("id")
    
    result = await db.notifications.delete_one({
        "id": notification_id,
        "user_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification deleted"}


# ============================================
# INTERNAL FUNCTIONS (used by bots)
# ============================================

async def create_notification(
    user_id: str,
    type: str,
    title: str,
    body: str,
    cta_label: Optional[str] = None,
    cta_route: Optional[str] = None,
    data: Optional[dict] = None,
    expires_at: Optional[str] = None,
    **kwargs  # Accept extra fields for backwards compat
) -> dict:
    """
    Create a new notification for a user.
    Used by bot workers to insert notifications.
    """
    notification_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    notification = {
        "id": notification_id,
        "user_id": user_id,
        "type": type,
        "title": title,
        "body": body,
        "message": body,  # Legacy field
        "cta_label": cta_label,
        "cta_route": cta_route,
        "data": data or {},
        "is_read": False,
        "created_at": now,
        "expires_at": expires_at
    }
    
    # Add any extra fields from kwargs (for backwards compat with old notification types)
    for key, value in kwargs.items():
        if key not in notification:
            notification[key] = value
    
    await db.notifications.insert_one(notification)
    logger.info(f"Created notification {notification_id} for user {user_id}: {title}")
    
    # Try to broadcast via WebSocket if available
    try:
        from websocket_manager import manager
        await manager.send_to_user(user_id, {
            "type": "notification",
            "data": {k: v for k, v in notification.items() if k != "_id"}
        })
    except Exception as e:
        logger.debug(f"WebSocket broadcast skipped: {e}")
    
    return {k: v for k, v in notification.items() if k != "_id"}


async def create_bulk_notifications(notifications: List[dict]) -> int:
    """
    Create multiple notifications at once.
    Each dict should have: user_id, type, title, body
    Optionally: cta_label, cta_route, data, expires_at
    """
    if not notifications:
        return 0
    
    now = datetime.now(timezone.utc).isoformat()
    docs = []
    
    for n in notifications:
        docs.append({
            "id": str(uuid.uuid4()),
            "user_id": n["user_id"],
            "type": n["type"],
            "title": n["title"],
            "body": n["body"],
            "message": n["body"],  # Legacy
            "cta_label": n.get("cta_label"),
            "cta_route": n.get("cta_route"),
            "data": n.get("data", {}),
            "is_read": False,
            "created_at": now,
            "expires_at": n.get("expires_at")
        })
    
    result = await db.notifications.insert_many(docs)
    logger.info(f"Created {len(result.inserted_ids)} bulk notifications")
    
    return len(result.inserted_ids)


# ============================================
# LEGACY HELPER FUNCTIONS (backwards compat)
# ============================================

async def notify_claim_created(claim, creator_name: str):
    """Notify all adjusters about a new claim"""
    try:
        users = await db.users.find(
            {"role": {"$in": ["adjuster", "admin"]}}, 
            {"_id": 0, "id": 1}
        ).to_list(100)
        
        for user in users:
            await create_notification(
                user_id=user["id"],
                type="claim_created",
                title="New Claim Created",
                body=f"{creator_name} created claim {claim.claim_number} - {claim.client_name}",
                cta_label="View Claim",
                cta_route=f"/claims/{claim.id}",
                data={"claim_id": claim.id, "claim_number": claim.claim_number}
            )
    except Exception as e:
        logger.error(f"Notify claim created error: {e}")


async def notify_claim_assigned(claim_id: str, claim_number: str, assigned_to_id: str, assigner_name: str):
    """Notify the assigned user about a claim assignment"""
    try:
        await create_notification(
            user_id=assigned_to_id,
            type="claim_assigned",
            title="Claim Assigned to You",
            body=f"{assigner_name} assigned claim #{claim_number} to you",
            cta_label="View Claim",
            cta_route=f"/claims/{claim_id}",
            data={"claim_id": claim_id, "claim_number": claim_number}
        )
    except Exception as e:
        logger.error(f"Notify claim assigned error: {e}")


async def notify_status_change(claim_id: str, claim_number: str, old_status: str, new_status: str, changer_name: str):
    """Notify relevant users about a claim status change"""
    try:
        users = await db.users.find(
            {"role": {"$in": ["adjuster", "admin"]}},
            {"_id": 0, "id": 1}
        ).to_list(100)
        
        for user in users:
            await create_notification(
                user_id=user["id"],
                type="status_change",
                title="Claim Status Updated",
                body=f"{changer_name} changed #{claim_number} from {old_status} to {new_status}",
                cta_label="View Claim",
                cta_route=f"/claims/{claim_id}",
                data={"claim_id": claim_id, "claim_number": claim_number, "old_status": old_status, "new_status": new_status}
            )
    except Exception as e:
        logger.error(f"Notify status change error: {e}")

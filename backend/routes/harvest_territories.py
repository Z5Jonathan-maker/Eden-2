"""
Harvest Territories API - Phase 2
Territory management for field canvassing operations.

Features:
- Create/Read/Update/Delete territories with polygons
- Assign territories to reps
- Territory stats and performance tracking
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

from dependencies import db, get_current_active_user as get_current_user

router = APIRouter(prefix="/api/harvest/territories", tags=["Harvest Territories"])
logger = logging.getLogger(__name__)


# ============================================
# MODELS
# ============================================

class Coordinate(BaseModel):
    """A single coordinate point"""
    lat: float
    lng: float


class TerritoryCreate(BaseModel):
    """Create a new territory"""
    name: str
    description: Optional[str] = ""
    polygon: List[Coordinate] = Field(..., description="Array of lat/lng points forming the polygon")
    color: Optional[str] = "#3B82F6"
    priority: Optional[int] = 1  # 1=low, 2=medium, 3=high
    meta: Optional[Dict[str, Any]] = {}


class TerritoryUpdate(BaseModel):
    """Update territory fields"""
    name: Optional[str] = None
    description: Optional[str] = None
    polygon: Optional[List[Coordinate]] = None
    color: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    meta: Optional[Dict[str, Any]] = None


class TerritoryAssign(BaseModel):
    """Assign a territory to a user"""
    user_id: str
    expires_at: Optional[str] = None  # ISO date, null = indefinite
    notes: Optional[str] = ""


# ============================================
# TERRITORY CRUD
# ============================================

@router.post("/")
async def create_territory(
    body: TerritoryCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new territory (admin/manager only).
    Polygon is array of {lat, lng} points that form the boundary.
    """
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    territory_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Convert polygon to GeoJSON format for potential geo queries
    polygon_coords = [[p.lng, p.lat] for p in body.polygon]
    if polygon_coords and polygon_coords[0] != polygon_coords[-1]:
        polygon_coords.append(polygon_coords[0])  # Close the polygon
    
    territory_doc = {
        "id": territory_id,
        "name": body.name,
        "description": body.description,
        "polygon": [{"lat": p.lat, "lng": p.lng} for p in body.polygon],
        "geojson": {
            "type": "Polygon",
            "coordinates": [polygon_coords]
        },
        "color": body.color,
        "priority": body.priority,
        "meta": body.meta or {},
        "is_active": True,
        "assignments": [],
        "stats": {
            "total_pins": 0,
            "visited_pins": 0,
            "appointments": 0,
            "contracts": 0
        },
        "created_by": current_user.get("id"),
        "created_at": now,
        "updated_at": now
    }
    
    await db.harvest_territories.insert_one(territory_doc)
    
    logger.info(f"Territory created: {body.name} by {current_user.get('email')}")
    
    return {
        "id": territory_id,
        "message": "Territory created successfully",
        "territory": {
            "id": territory_id,
            "name": body.name,
            "color": body.color,
            "polygon_points": len(body.polygon)
        }
    }


@router.get("/")
async def list_territories(
    include_inactive: bool = Query(False),
    current_user: dict = Depends(get_current_user)
):
    """
    List all territories (admin/manager see all, reps see assigned).
    """
    query = {}
    
    if not include_inactive:
        query["is_active"] = True
    
    # Reps only see their assigned territories
    if current_user.get("role") not in ["admin", "manager"]:
        query["assignments.user_id"] = current_user.get("id")
    
    territories = await db.harvest_territories.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    # Calculate fresh stats for each territory
    for t in territories:
        t["stats"] = await _calculate_territory_stats(t["id"])
        t["assigned_users"] = [
            a for a in t.get("assignments", [])
            if not a.get("expires_at") or a["expires_at"] > datetime.now(timezone.utc).isoformat()
        ]
    
    return {
        "territories": territories,
        "total": len(territories)
    }


@router.get("/my")
async def my_territories(
    current_user: dict = Depends(get_current_user)
):
    """
    Get territories assigned to the current user.
    Returns territories with assignment details and stats.
    """
    user_id = current_user.get("id")
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Find territories where user is assigned and not expired
    territories = await db.harvest_territories.find(
        {
            "is_active": True,
            "assignments": {
                "$elemMatch": {
                    "user_id": user_id,
                    "$or": [
                        {"expires_at": None},
                        {"expires_at": {"$gt": now_iso}}
                    ]
                }
            }
        },
        {"_id": 0}
    ).to_list(50)
    
    result = []
    for t in territories:
        # Get user's assignment details
        assignment = next(
            (a for a in t.get("assignments", []) if a.get("user_id") == user_id),
            None
        )
        
        # Calculate stats
        stats = await _calculate_territory_stats(t["id"], user_id)
        
        result.append({
            "id": t["id"],
            "name": t["name"],
            "description": t.get("description"),
            "polygon": t.get("polygon", []),
            "color": t.get("color", "#3B82F6"),
            "priority": t.get("priority", 1),
            "assigned_at": assignment.get("assigned_at") if assignment else None,
            "expires_at": assignment.get("expires_at") if assignment else None,
            "stats": stats
        })
    
    return {
        "territories": result,
        "total": len(result)
    }


@router.get("/{territory_id}")
async def get_territory(
    territory_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific territory with full details."""
    territory = await db.harvest_territories.find_one(
        {"id": territory_id},
        {"_id": 0}
    )
    
    if not territory:
        raise HTTPException(status_code=404, detail="Territory not found")
    
    # Check access for non-admin/manager
    if current_user.get("role") not in ["admin", "manager"]:
        is_assigned = any(
            a.get("user_id") == current_user.get("id")
            for a in territory.get("assignments", [])
        )
        if not is_assigned:
            raise HTTPException(status_code=403, detail="Not assigned to this territory")
    
    # Add fresh stats
    territory["stats"] = await _calculate_territory_stats(territory_id)
    
    # Get assigned users info
    user_ids = [a.get("user_id") for a in territory.get("assignments", [])]
    if user_ids:
        users = await db.users.find(
            {"id": {"$in": user_ids}},
            {"_id": 0, "id": 1, "full_name": 1, "email": 1}
        ).to_list(50)
        user_map = {u["id"]: u for u in users}
        
        for assignment in territory.get("assignments", []):
            user = user_map.get(assignment.get("user_id"))
            if user:
                assignment["user_name"] = user.get("full_name")
                assignment["user_email"] = user.get("email")
    
    return territory


@router.put("/{territory_id}")
async def update_territory(
    territory_id: str,
    body: TerritoryUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a territory (admin/manager only)."""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    update_dict = {k: v for k, v in body.dict().items() if v is not None}
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Handle polygon update - convert to GeoJSON
    if "polygon" in update_dict:
        polygon_coords = [[p["lng"], p["lat"]] for p in update_dict["polygon"]]
        if polygon_coords and polygon_coords[0] != polygon_coords[-1]:
            polygon_coords.append(polygon_coords[0])
        update_dict["geojson"] = {
            "type": "Polygon",
            "coordinates": [polygon_coords]
        }
    
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.harvest_territories.update_one(
        {"id": territory_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Territory not found")
    
    return {"message": "Territory updated successfully"}


@router.delete("/{territory_id}")
async def delete_territory(
    territory_id: str,
    hard_delete: bool = Query(False),
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a territory (admin only).
    Soft delete by default (sets is_active=False).
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if hard_delete:
        result = await db.harvest_territories.delete_one({"id": territory_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Territory not found")
        return {"message": "Territory permanently deleted"}
    else:
        result = await db.harvest_territories.update_one(
            {"id": territory_id},
            {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Territory not found")
        return {"message": "Territory deactivated"}


# ============================================
# TERRITORY ASSIGNMENTS
# ============================================

@router.post("/{territory_id}/assign")
async def assign_territory(
    territory_id: str,
    body: TerritoryAssign,
    current_user: dict = Depends(get_current_user)
):
    """
    Assign a territory to a user (admin/manager only).
    A territory can have multiple assigned users.
    """
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    # Verify territory exists
    territory = await db.harvest_territories.find_one({"id": territory_id})
    if not territory:
        raise HTTPException(status_code=404, detail="Territory not found")
    
    # Verify user exists
    user = await db.users.find_one({"id": body.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    assignment = {
        "user_id": body.user_id,
        "assigned_by": current_user.get("id"),
        "assigned_at": now,
        "expires_at": body.expires_at,
        "notes": body.notes
    }
    
    # Remove existing assignment for this user if any
    await db.harvest_territories.update_one(
        {"id": territory_id},
        {"$pull": {"assignments": {"user_id": body.user_id}}}
    )
    
    # Add new assignment
    await db.harvest_territories.update_one(
        {"id": territory_id},
        {
            "$push": {"assignments": assignment},
            "$set": {"updated_at": now}
        }
    )
    
    logger.info(f"Territory {territory['name']} assigned to {user.get('email')} by {current_user.get('email')}")
    
    return {
        "message": f"Territory assigned to {user.get('full_name')}",
        "assignment": assignment
    }


@router.delete("/{territory_id}/assign/{user_id}")
async def unassign_territory(
    territory_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a user's assignment from a territory."""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    result = await db.harvest_territories.update_one(
        {"id": territory_id},
        {
            "$pull": {"assignments": {"user_id": user_id}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Territory not found")
    
    return {"message": "User unassigned from territory"}


@router.get("/{territory_id}/assignments")
async def get_territory_assignments(
    territory_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all assignments for a territory."""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Admin or Manager access required")
    
    territory = await db.harvest_territories.find_one(
        {"id": territory_id},
        {"_id": 0, "assignments": 1, "name": 1}
    )
    
    if not territory:
        raise HTTPException(status_code=404, detail="Territory not found")
    
    # Enrich with user info
    assignments = territory.get("assignments", [])
    user_ids = [a.get("user_id") for a in assignments]
    
    if user_ids:
        users = await db.users.find(
            {"id": {"$in": user_ids}},
            {"_id": 0, "id": 1, "full_name": 1, "email": 1}
        ).to_list(50)
        user_map = {u["id"]: u for u in users}
        
        for assignment in assignments:
            user = user_map.get(assignment.get("user_id"))
            if user:
                assignment["user_name"] = user.get("full_name")
                assignment["user_email"] = user.get("email")
    
    return {
        "territory_name": territory.get("name"),
        "assignments": assignments,
        "total": len(assignments)
    }


# ============================================
# HELPERS
# ============================================

async def _calculate_territory_stats(territory_id: str, user_id: str = None) -> Dict[str, Any]:
    """Calculate stats for a territory, optionally filtered by user."""
    query = {"territory_id": territory_id}
    if user_id:
        query["created_by"] = user_id
    
    # Get pin stats
    total_pins = await db.canvassing_pins.count_documents({"territory_id": territory_id})
    visited_pins = await db.canvassing_pins.count_documents({
        "territory_id": territory_id,
        "disposition": {"$ne": "unmarked"}
    })
    
    # Get visit stats
    visit_query = {"territory_id": territory_id} if not user_id else {
        "territory_id": territory_id,
        "user_id": user_id
    }
    
    # Actually we need to look up pins in this territory, then find visits
    territory_pin_ids = await db.canvassing_pins.distinct("id", {"territory_id": territory_id})
    
    if territory_pin_ids:
        visit_match = {"pin_id": {"$in": territory_pin_ids}}
        if user_id:
            visit_match["user_id"] = user_id
        
        # Aggregate visit stats
        pipeline = [
            {"$match": visit_match},
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }}
        ]
        
        status_counts_raw = await db.harvest_visits.aggregate(pipeline).to_list(20)
        status_counts = {s["_id"]: s["count"] for s in status_counts_raw}
        
        total_visits = sum(status_counts.values())
        appointments = status_counts.get("AP", 0)
        contracts = status_counts.get("SG", 0)
    else:
        total_visits = 0
        appointments = 0
        contracts = 0
    
    return {
        "total_pins": total_pins,
        "visited_pins": visited_pins,
        "coverage_percent": round((visited_pins / total_pins * 100) if total_pins > 0 else 0),
        "total_visits": total_visits,
        "appointments": appointments,
        "contracts": contracts
    }

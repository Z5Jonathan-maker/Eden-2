"""
Canvassing Map API Routes - Enzy-style canvassing with interactive maps
"""
import os
import math
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import uuid

from dependencies import db, get_current_active_user as get_current_user, require_role

router = APIRouter(prefix="/api/canvassing-map", tags=["Canvassing Map"])

# ============================================
# Models
# ============================================

class DoorPinCreate(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None
    disposition: str = "unmarked"  # unmarked, not_home, not_interested, callback, appointment, signed, do_not_knock
    notes: Optional[str] = None
    homeowner_name: Optional[str] = None
    phone: Optional[str] = None
    territory_id: Optional[str] = None
    idempotency_key: Optional[str] = None

class DoorPinUpdate(BaseModel):
    disposition: Optional[str] = None
    notes: Optional[str] = None
    homeowner_name: Optional[str] = None
    phone: Optional[str] = None
    appointment_date: Optional[str] = None

class TerritoryCreate(BaseModel):
    name: str
    coordinates: List[List[float]]  # Array of [lat, lng] points forming polygon
    color: Optional[str] = "#3B82F6"
    assigned_to: Optional[str] = None  # user_id

class TerritoryUpdate(BaseModel):
    name: Optional[str] = None
    coordinates: Optional[List[List[float]]] = None
    color: Optional[str] = None
    assigned_to: Optional[str] = None
    is_active: Optional[bool] = None

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None

# Disposition colors and labels
DISPOSITIONS = {
    "unmarked": {"color": "#9CA3AF", "label": "Unmarked", "icon": "circle"},
    "not_home": {"color": "#F59E0B", "label": "Not Home", "icon": "home"},
    "not_interested": {"color": "#EF4444", "label": "Not Interested", "icon": "x"},
    "callback": {"color": "#8B5CF6", "label": "Callback", "icon": "phone"},
    "appointment": {"color": "#3B82F6", "label": "Appointment Set", "icon": "calendar"},
    "signed": {"color": "#10B981", "label": "Signed!", "icon": "check"},
    "do_not_knock": {"color": "#1F2937", "label": "Do Not Knock", "icon": "ban"},
}


def _coerce_float(value):
    try:
        numeric = float(value)
        return numeric
    except (TypeError, ValueError):
        return None


def _distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in meters."""
    earth_radius_m = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return earth_radius_m * c


PIN_DEDUPE_TIME_SECONDS = 45
PIN_DEDUPE_DISTANCE_METERS = 25


def _point_in_polygon(lat: float, lng: float, polygon: list) -> bool:
    """Ray-casting point-in-polygon check. Polygon is list of [lat, lng] or {lat, lng} dicts."""
    points = []
    for p in polygon:
        if isinstance(p, dict):
            plat = _coerce_float(p.get("lat") or p.get("latitude"))
            plng = _coerce_float(p.get("lng") or p.get("longitude"))
        elif isinstance(p, (list, tuple)) and len(p) >= 2:
            plat = _coerce_float(p[0])
            plng = _coerce_float(p[1])
            # Handle [lng, lat] ordering (common in GeoJSON)
            if plat is not None and plng is not None and abs(plat) > 90 and abs(plng) <= 90:
                plat, plng = plng, plat
        else:
            continue
        if plat is not None and plng is not None:
            points.append((plat, plng))
    if len(points) < 3:
        return False
    inside = False
    n = len(points)
    j = n - 1
    for i in range(n):
        yi, xi = points[i]
        yj, xj = points[j]
        if (yi > lat) != (yj > lat):
            slope = (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
            if lng < slope:
                inside = not inside
        j = i
    return inside


async def _auto_assign_territory(lat: float, lng: float) -> Optional[str]:
    """Find the territory containing the given point. Returns territory_id or None."""
    territories = await db.canvassing_territories.find(
        {"is_active": True},
        {"id": 1, "coordinates": 1, "polygon": 1, "_id": 0}
    ).to_list(200)
    for t in territories:
        coords = t.get("coordinates") or t.get("polygon") or []
        if _point_in_polygon(lat, lng, coords):
            return t.get("id")
    return None


def _find_duplicate_pin(
    latitude: float,
    longitude: float,
    candidates: List[dict],
    max_distance_meters: float = PIN_DEDUPE_DISTANCE_METERS,
) -> Optional[dict]:
    """Return the closest duplicate candidate within max_distance_meters."""
    closest = None
    for existing in candidates:
        existing_lat = _coerce_float(existing.get("latitude"))
        existing_lng = _coerce_float(existing.get("longitude"))
        if existing_lat is None or existing_lng is None:
            continue
        meters = _distance_meters(latitude, longitude, existing_lat, existing_lng)
        if meters <= max_distance_meters and (
            closest is None or meters < closest["distance_m"]
        ):
            closest = {
                "pin": existing,
                "latitude": existing_lat,
                "longitude": existing_lng,
                "distance_m": meters,
            }
    return closest


def _duplicate_pin_response(duplicate: dict) -> dict:
    pin = duplicate["pin"]
    return {
        "id": pin.get("id"),
        "latitude": duplicate["latitude"],
        "longitude": duplicate["longitude"],
        "address": pin.get("address"),
        "disposition": pin.get("disposition", "unmarked"),
        "territory_id": pin.get("territory_id"),
        "created_at": pin.get("created_at"),
        "updated_at": pin.get("updated_at"),
        "duplicate": True,
        "duplicate_distance_m": round(duplicate["distance_m"], 1),
        "message": "Duplicate pin prevented",
        "disposition_info": DISPOSITIONS.get(
            pin.get("disposition", "unmarked"), DISPOSITIONS["unmarked"]
        ),
    }


def _pin_create_response_from_doc(pin_doc: dict) -> dict:
    normalized = _normalize_pin_coordinates(pin_doc or {})
    disposition = normalized.get("disposition", "unmarked")
    return {
        "id": normalized.get("id"),
        "latitude": normalized.get("latitude"),
        "longitude": normalized.get("longitude"),
        "address": normalized.get("address"),
        "disposition": disposition,
        "territory_id": normalized.get("territory_id"),
        "created_at": normalized.get("created_at"),
        "updated_at": normalized.get("updated_at"),
        "message": "Pin created successfully",
        "disposition_info": DISPOSITIONS.get(disposition, DISPOSITIONS["unmarked"]),
        "coords_valid": normalized.get("coords_valid", False),
        "coords_source": normalized.get("coords_source", "invalid"),
    }


def _normalize_pin_coordinates(pin: dict) -> dict:
    """
    Normalize pin coordinates across legacy field variants.
    Priorities:
    1) latitude/longitude
    2) lat/lng
    3) last history point lat/lng
    """
    latitude = _coerce_float(pin.get("latitude"))
    longitude = _coerce_float(pin.get("longitude"))
    source = "latitude_longitude"

    if latitude is None or longitude is None:
        latitude = _coerce_float(pin.get("lat"))
        longitude = _coerce_float(pin.get("lng"))
        source = "lat_lng"

    if latitude is None or longitude is None:
        history = pin.get("history") or []
        if isinstance(history, list):
            for entry in reversed(history):
                hist_lat = _coerce_float((entry or {}).get("lat"))
                hist_lng = _coerce_float((entry or {}).get("lng"))
                if hist_lat is not None and hist_lng is not None:
                    latitude = hist_lat
                    longitude = hist_lng
                    source = "history"
                    break

    valid = (
        latitude is not None
        and longitude is not None
        and -90 <= latitude <= 90
        and -180 <= longitude <= 180
    )

    normalized = dict(pin)
    normalized["latitude"] = latitude
    normalized["longitude"] = longitude
    normalized["coords_valid"] = valid
    normalized["coords_source"] = source if valid else "invalid"
    return normalized

# ============================================
# Door Pin Endpoints
# ============================================

@router.post("/pins")
async def create_door_pin(
    pin: DoorPinCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Create a new door pin on the map with optional Regrid parcel enrichment"""
    now_iso = datetime.now(timezone.utc).isoformat()
    user_id = current_user.get("id")
    idempotency_key = (pin.idempotency_key or "").strip() or None

    # Strong duplicate protection for retries: if idempotency key already exists, return prior pin.
    if idempotency_key:
        existing_by_key = await db.canvassing_pins.find_one(
            {"user_id": user_id, "idempotency_key": idempotency_key},
            {"_id": 0},
        )
        if existing_by_key:
            existing_duplicate = {
                "pin": existing_by_key,
                "latitude": _coerce_float(existing_by_key.get("latitude")) or pin.latitude,
                "longitude": _coerce_float(existing_by_key.get("longitude")) or pin.longitude,
                "distance_m": 0.0,
            }
            response = _duplicate_pin_response(existing_duplicate)
            response["duplicate_reason"] = "idempotency_key"
            return response

    # Prevent accidental duplicate drops (rapid retries / double taps).
    lat_pad = 0.001  # ~111m latitude window (pre-filter)
    lng_pad = 0.001  # coarse pre-filter; exact distance checked below
    recent_cutoff = (datetime.now(timezone.utc) - timedelta(seconds=PIN_DEDUPE_TIME_SECONDS)).isoformat()
    recent_candidates = await db.canvassing_pins.find(
        {
            "user_id": user_id,
            "created_at": {"$gte": recent_cutoff},
            "latitude": {"$gte": pin.latitude - lat_pad, "$lte": pin.latitude + lat_pad},
            "longitude": {"$gte": pin.longitude - lng_pad, "$lte": pin.longitude + lng_pad},
        },
        {"_id": 0},
    ).sort("created_at", -1).to_list(10)

    duplicate = _find_duplicate_pin(
        pin.latitude,
        pin.longitude,
        recent_candidates,
        PIN_DEDUPE_DISTANCE_METERS,
    )
    if duplicate:
        return _duplicate_pin_response(duplicate)

    pin_id = str(uuid.uuid4())

    # Server-side territory auto-assign if frontend didn't provide one
    territory_id = pin.territory_id
    if not territory_id:
        territory_id = await _auto_assign_territory(pin.latitude, pin.longitude)

    doc = {
        "id": pin_id,
        "user_id": user_id,
        "created_by_name": current_user.get("full_name", "Unknown"),
        "latitude": pin.latitude,
        "longitude": pin.longitude,
        "address": pin.address,
        "disposition": pin.disposition,
        "notes": pin.notes,
        "homeowner_name": pin.homeowner_name,
        "phone": pin.phone,
        "territory_id": territory_id,
        "idempotency_key": idempotency_key,
        "created_at": now_iso,
        "updated_at": now_iso,
        # Regrid parcel fields (to be enriched)
        "ll_uuid": None,
        "parcel_path": None,
        "parcel_address": None,
        "parcel_owner": None,
        "parcel_geometry": None,
        "parcel_enriched_at": None,
        "history": [{
            "disposition": pin.disposition,
            "user_id": user_id,
            "user_name": current_user.get("full_name"),
            "timestamp": now_iso
        }]
    }
    
    await db.canvassing_pins.insert_one(doc)

    # Read-after-write verification: only return success if persisted pin is queryable.
    persisted_pin = await db.canvassing_pins.find_one({"id": pin_id}, {"_id": 0})
    if not persisted_pin:
        raise HTTPException(
            status_code=500,
            detail="Pin persistence verification failed. Please retry.",
        )
    
    # Background task to enrich with Regrid parcel data
    background_tasks.add_task(
        enrich_pin_with_regrid,
        pin_id,
        pin.latitude,
        pin.longitude
    )

    return _pin_create_response_from_doc(persisted_pin)


async def enrich_pin_with_regrid(pin_id: str, lat: float, lon: float):
    """Background task to enrich pin with property data using Emergent LLM (FREE - no Regrid cost)"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
        if not EMERGENT_LLM_KEY:
            return  # No key, skip enrichment
        
        # Use Emergent LLM to look up Florida property records
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"parcel-{pin_id}",
            system_message="You are a Florida property records assistant. Extract property information from public records. Return JSON format only."
        ).with_model("openai", "gpt-4o")
        
        prompt = f"""Look up Florida property records for coordinates lat:{lat} lng:{lon}
        
Return ONLY a JSON object with these fields (use null for unknown):
{{
    "owner": "owner name",
    "address": "full address",
    "year_built": 1990,
    "assessed_value": 250000,
    "parcel_id": "parcel number",
    "sqft": 2000,
    "acres": 0.25
}}"""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Try to parse JSON from response
        import json
        try:
            # Extract JSON from response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                parcel = json.loads(response[json_start:json_end])
            else:
                parcel = {}
        except json.JSONDecodeError:
            parcel = {}
        
        # Update pin with parcel data
        update_data = {
            "parcel_address": parcel.get("address"),
            "parcel_owner": parcel.get("owner"),
            "parcel_number": parcel.get("parcel_id"),
            "parcel_acres": parcel.get("acres"),
            "parcel_sqft": parcel.get("sqft"),
            "parcel_year_built": parcel.get("year_built"),
            "parcel_value": parcel.get("assessed_value"),
            "parcel_enriched_at": datetime.now(timezone.utc).isoformat(),
            "parcel_source": "emergent_llm"
        }
        
        # Update address if we got one
        if parcel.get("address"):
            update_data["address"] = parcel.get("address")
        
        await db.canvassing_pins.update_one(
            {"id": pin_id},
            {"$set": update_data}
        )
        
    except Exception as e:
        print(f"Error enriching pin {pin_id} with Emergent LLM: {e}")


@router.get("/pins")
async def get_door_pins(
    territory_id: Optional[str] = None,
    disposition: Optional[str] = None,
    bounds: Optional[str] = None,  # "lat1,lng1,lat2,lng2" - SW and NE corners
    current_user: dict = Depends(get_current_user)
):
    """Get door pins, optionally filtered by territory or bounds"""
    query = {}
    
    if territory_id:
        query["territory_id"] = territory_id
    
    if disposition:
        query["disposition"] = disposition
    
    # Filter by map bounds if provided
    if bounds:
        try:
            coords = [float(x) for x in bounds.split(",")]
            if len(coords) == 4:
                sw_lat, sw_lng, ne_lat, ne_lng = coords
                query["$or"] = [
                    {
                        "latitude": {"$gte": sw_lat, "$lte": ne_lat},
                        "longitude": {"$gte": sw_lng, "$lte": ne_lng},
                    },
                    {
                        "lat": {"$gte": sw_lat, "$lte": ne_lat},
                        "lng": {"$gte": sw_lng, "$lte": ne_lng},
                    },
                ]
        except:
            pass
    
    pins = await db.canvassing_pins.find(
        query,
        {"_id": 0}
    ).sort("updated_at", -1).to_list(1000)
    
    # Add disposition info to each pin
    normalized_pins = []
    for pin in pins:
        normalized = _normalize_pin_coordinates(pin)
        normalized["disposition_info"] = DISPOSITIONS.get(
            normalized.get("disposition", "unmarked"),
            DISPOSITIONS["unmarked"],
        )
        # Keep payload lean for pin list while retaining normalized coords.
        normalized.pop("history", None)
        normalized_pins.append(normalized)
    
    return normalized_pins


@router.get("/pins/{pin_id}")
async def get_door_pin(
    pin_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific door pin with full history"""
    pin = await db.canvassing_pins.find_one({"id": pin_id}, {"_id": 0})
    
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    
    pin["disposition_info"] = DISPOSITIONS.get(pin.get("disposition", "unmarked"), DISPOSITIONS["unmarked"])
    
    return pin


def _can_modify_pin(pin: dict, current_user: dict) -> bool:
    """Check if user can modify this pin (owner or admin/manager)"""
    user_id = current_user.get("id")
    role = (current_user.get("role") or "").lower()
    if role in ("admin", "manager", "owner"):
        return True
    return pin.get("user_id") == user_id


@router.patch("/pins/{pin_id}")
async def update_door_pin(
    pin_id: str,
    update: DoorPinUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a door pin (disposition, notes, etc.) - Awards points automatically"""
    pin = await db.canvassing_pins.find_one({"id": pin_id})

    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")

    if not _can_modify_pin(pin, current_user):
        raise HTTPException(status_code=403, detail="You can only update your own pins")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Track disposition change for scoring
    old_disposition = pin.get("disposition", "unmarked")
    new_disposition = update.disposition
    points_earned = 0
    
    # Add to history if disposition changed
    if update.disposition and update.disposition != pin.get("disposition"):
        history_entry = {
            "disposition": update.disposition,
            "user_id": current_user.get("id"),
            "user_name": current_user.get("full_name"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "notes": update.notes
        }
        await db.canvassing_pins.update_one(
            {"id": pin_id},
            {
                "$set": update_data,
                "$push": {"history": history_entry}
            }
        )
        
        # Award points based on disposition change
        points_earned = await award_disposition_points(
            current_user.get("id"),
            current_user.get("full_name", "Unknown"),
            old_disposition,
            new_disposition,
            pin_id
        )
    else:
        await db.canvassing_pins.update_one(
            {"id": pin_id},
            {"$set": update_data}
        )
    
    return {
        "message": "Pin updated successfully",
        "disposition_info": DISPOSITIONS.get(update.disposition or pin.get("disposition"), DISPOSITIONS["unmarked"]),
        "points_earned": points_earned
    }


async def award_disposition_points(user_id: str, user_name: str, old_disp: str, new_disp: str, pin_id: str) -> int:
    """Award points for disposition changes - Enzy style automatic scoring"""
    # Point values from spec
    DISPOSITION_POINTS = {
        "not_home": 1,           # door_knocked
        "not_interested": 3,     # contact_made
        "callback": 5,           # callback_scheduled
        "appointment": 10,       # appointment_set
        "signed": 50,            # contract_signed
        "do_not_knock": 3,       # contact_made
        "renter": 3,             # contact_made
    }
    
    # Event type mapping
    DISPOSITION_EVENTS = {
        "not_home": "door_knocked",
        "not_interested": "contact_made",
        "callback": "callback_scheduled",
        "appointment": "appointment_set",
        "signed": "contract_signed",
        "do_not_knock": "contact_made",
        "renter": "contact_made",
    }
    
    base_points = DISPOSITION_POINTS.get(new_disp, 0)
    if base_points == 0:
        return 0
    
    event_type = DISPOSITION_EVENTS.get(new_disp, "door_knocked")
    now = datetime.now(timezone.utc)
    
    # Calculate multiplier (simplified - streak based, single aggregation)
    multiplier = 1.0

    # Streak: single aggregation instead of 30 individual queries
    cutoff_date = (now - timedelta(days=30)).date().isoformat()
    streak_pipeline = [
        {"$match": {"user_id": user_id, "date": {"$gte": cutoff_date}}},
        {"$group": {"_id": "$date", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gte": 10}}},
        {"$sort": {"_id": -1}},
    ]
    active_days = await db.harvest_score_events.aggregate(streak_pipeline).to_list(30)
    active_dates = {d["_id"] for d in active_days}

    today = now.date()
    streak = 0
    for i in range(30):
        check_date = (today - timedelta(days=i)).isoformat()
        if check_date in active_dates:
            streak += 1
        elif i > 0:
            break
    
    if streak >= 30:
        multiplier = 2.0
    elif streak >= 10:
        multiplier = 1.5
    elif streak >= 5:
        multiplier = 1.25
    elif streak >= 3:
        multiplier = 1.1
    
    final_points = int(base_points * multiplier)
    
    # Record score event
    score_event = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user_name,
        "event_type": event_type,
        "base_points": base_points,
        "multiplier": multiplier,
        "final_points": final_points,
        "pin_id": pin_id,
        "old_disposition": old_disp,
        "new_disposition": new_disp,
        "timestamp": now.isoformat(),
        "date": now.date().isoformat()
    }
    
    await db.harvest_score_events.insert_one(score_event)
    
    # Update user totals
    await db.harvest_user_stats.update_one(
        {"user_id": user_id},
        {
            "$inc": {"total_points": final_points},
            "$set": {"last_activity": now.isoformat()}
        },
        upsert=True
    )
    
    return final_points


@router.delete("/pins/{pin_id}")
async def delete_door_pin(
    pin_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a door pin (owner or admin only)"""
    pin = await db.canvassing_pins.find_one({"id": pin_id})
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    if not _can_modify_pin(pin, current_user):
        raise HTTPException(status_code=403, detail="You can only delete your own pins")
    result = await db.canvassing_pins.delete_one({"id": pin_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pin not found")
    
    return {"message": "Pin deleted successfully"}


# ============================================
# Visits Endpoints (Harvest v2 Core - GPS Logging)
# ============================================

class VisitCreate(BaseModel):
    """Log a door visit with GPS (Spotio-style)"""
    pin_id: str
    status: str  # NH, NI, CB, AP, SG, DNK
    lat: float
    lng: float
    notes: Optional[str] = None


# Visit status mapping (Spotio-style codes to internal dispositions)
VISIT_STATUSES = {
    "NH": {"disposition": "not_home", "label": "Not Home", "color": "#F59E0B", "points": 1},
    "NI": {"disposition": "not_interested", "label": "Not Interested", "color": "#EF4444", "points": 3},
    "CB": {"disposition": "callback", "label": "Callback", "color": "#8B5CF6", "points": 5},
    "AP": {"disposition": "appointment", "label": "Appointment", "color": "#3B82F6", "points": 10},
    "SG": {"disposition": "signed", "label": "Signed", "color": "#10B981", "points": 50},
    "DNK": {"disposition": "do_not_knock", "label": "Do Not Knock", "color": "#1F2937", "points": 0},
}


@router.post("/visits")
async def create_visit(
    visit: VisitCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Log a door visit with GPS (Spotio-style).
    Every knock = one visit record with lat/lng, timestamp, status.
    Also updates the pin's status, visit_count, and last_visit_at.
    """
    # Validate pin exists
    pin = await db.canvassing_pins.find_one({"id": visit.pin_id})
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    
    # Get status info
    status_info = VISIT_STATUSES.get(visit.status, VISIT_STATUSES["NH"])
    disposition = status_info.get("disposition", "not_home")
    
    visit_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Create visit record
    visit_doc = {
        "id": visit_id,
        "pin_id": visit.pin_id,
        "user_id": current_user.get("id"),
        "user_name": current_user.get("full_name", "Unknown"),
        "status": visit.status,
        "disposition": disposition,
        "lat": visit.lat,
        "lng": visit.lng,
        "notes": visit.notes,
        "created_at": now
    }
    
    await db.harvest_visits.insert_one(visit_doc)
    
    # Update the pin with derived fields
    old_disposition = pin.get("disposition", "unmarked")
    
    await db.canvassing_pins.update_one(
        {"id": visit.pin_id},
        {
            "$set": {
                "disposition": disposition,
                "last_visit_at": now,
                "updated_at": now
            },
            "$inc": {"visit_count": 1},
            "$push": {
                "history": {
                    "status": visit.status,
                    "disposition": disposition,
                    "user_id": current_user.get("id"),
                    "user_name": current_user.get("full_name"),
                    "timestamp": now,
                    "lat": visit.lat,
                    "lng": visit.lng,
                    "notes": visit.notes
                }
            }
        }
    )
    
    # Award points based on status
    points_earned = 0
    base_points = status_info.get("points", 1)
    
    if base_points > 0:
        points_earned = await award_disposition_points(
            current_user.get("id"),
            current_user.get("full_name", "Unknown"),
            old_disposition,
            disposition,
            visit.pin_id
        )
    
    return {
        "id": visit_id,
        "status": visit.status,
        "status_info": status_info,
        "points_earned": points_earned,
        "visit_count": (pin.get("visit_count", 0) or 0) + 1,
        "message": "Visit logged successfully"
    }


@router.get("/pins/{pin_id}/visits")
async def get_pin_visits(
    pin_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get all visits for a specific pin (Spotio-style history)"""
    # Check pin exists
    pin = await db.canvassing_pins.find_one({"id": pin_id})
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    
    visits = await db.harvest_visits.find(
        {"pin_id": pin_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Add status info to each visit
    for v in visits:
        v["status_info"] = VISIT_STATUSES.get(v.get("status", "NH"), VISIT_STATUSES["NH"])
    
    return {
        "pin_id": pin_id,
        "address": pin.get("address"),
        "current_status": pin.get("disposition"),
        "visit_count": len(visits),
        "visits": visits
    }


@router.get("/visits/recent")
async def get_recent_visits(
    user_id: Optional[str] = None,
    territory_id: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get recent visits, optionally filtered by user or territory"""
    query = {}
    
    if user_id:
        query["user_id"] = user_id
    
    # If territory filter, get pins in that territory first
    if territory_id:
        territory_pins = await db.canvassing_pins.distinct("id", {"territory_id": territory_id})
        query["pin_id"] = {"$in": territory_pins}
    
    visits = await db.harvest_visits.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    # Add status info to each visit
    for v in visits:
        v["status_info"] = VISIT_STATUSES.get(v.get("status", "NH"), VISIT_STATUSES["NH"])
    
    return visits


# ============================================
# Territory Endpoints
# ============================================

@router.post("/territories")
async def create_territory(
    territory: TerritoryCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new territory by drawing on the map"""
    territory_id = str(uuid.uuid4())
    
    doc = {
        "id": territory_id,
        "name": territory.name,
        "coordinates": territory.coordinates,
        "color": territory.color,
        "assigned_to": territory.assigned_to,
        "created_by": current_user.get("id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
        "stats": {
            "total_pins": 0,
            "signed": 0,
            "appointments": 0,
            "not_home": 0
        }
    }
    
    await db.canvassing_territories.insert_one(doc)
    
    return {"id": territory_id, "message": "Territory created successfully"}


@router.get("/territories")
async def get_territories(
    active_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Get all territories"""
    query = {}
    if active_only:
        query["is_active"] = True
    
    territories = await db.canvassing_territories.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get stats for each territory
    for territory in territories:
        stats = await get_territory_stats(territory["id"])
        territory["stats"] = stats
    
    return territories


@router.get("/territories/{territory_id}")
async def get_territory(
    territory_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific territory with stats"""
    territory = await db.canvassing_territories.find_one(
        {"id": territory_id},
        {"_id": 0}
    )
    
    if not territory:
        raise HTTPException(status_code=404, detail="Territory not found")
    
    territory["stats"] = await get_territory_stats(territory_id)
    
    return territory


@router.patch("/territories/{territory_id}")
async def update_territory(
    territory_id: str,
    update: TerritoryUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a territory"""
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.canvassing_territories.update_one(
        {"id": territory_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Territory not found")
    
    return {"message": "Territory updated successfully"}


@router.delete("/territories/{territory_id}")
async def delete_territory(
    territory_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a territory (soft delete)"""
    result = await db.canvassing_territories.update_one(
        {"id": territory_id},
        {"$set": {"is_active": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Territory not found")
    
    return {"message": "Territory deleted successfully"}


async def get_territory_stats(territory_id: str) -> dict:
    """Get aggregated stats for a territory"""
    pipeline = [
        {"$match": {"territory_id": territory_id}},
        {"$group": {
            "_id": "$disposition",
            "count": {"$sum": 1}
        }}
    ]
    
    results = await db.canvassing_pins.aggregate(pipeline).to_list(20)
    
    stats = {
        "total_pins": 0,
        "signed": 0,
        "appointments": 0,
        "not_home": 0,
        "not_interested": 0,
        "callback": 0,
        "unmarked": 0
    }
    
    for r in results:
        disposition = r["_id"]
        count = r["count"]
        stats["total_pins"] += count
        if disposition in stats:
            stats[disposition] = count
    
    return stats


# ============================================
# Live Location Tracking
# ============================================

@router.post("/location")
async def update_rep_location(
    location: LocationUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update rep's current location for live tracking"""
    doc = {
        "user_id": current_user.get("id"),
        "user_name": current_user.get("full_name"),
        "latitude": location.latitude,
        "longitude": location.longitude,
        "accuracy": location.accuracy,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert - update if exists, insert if not
    await db.canvassing_locations.update_one(
        {"user_id": current_user.get("id")},
        {"$set": doc},
        upsert=True
    )
    
    return {"message": "Location updated"}


@router.get("/locations/live")
async def get_live_locations(
    current_user: dict = Depends(get_current_user)
):
    """Get live locations of all active reps (for manager view)"""
    # Only get locations from last 5 minutes
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    
    locations = await db.canvassing_locations.find(
        {"timestamp": {"$gte": cutoff}},
        {"_id": 0}
    ).to_list(100)
    
    return locations


# ============================================
# Stats & Analytics
# ============================================

@router.get("/stats/overview")
async def get_canvassing_overview(
    current_user: dict = Depends(get_current_user)
):
    """Get overall canvassing statistics"""
    # Total pins by disposition
    pipeline = [
        {"$group": {
            "_id": "$disposition",
            "count": {"$sum": 1}
        }}
    ]
    
    disposition_counts = await db.canvassing_pins.aggregate(pipeline).to_list(20)
    
    stats = {disposition: 0 for disposition in DISPOSITIONS.keys()}
    total = 0
    for r in disposition_counts:
        if r["_id"] in stats:
            stats[r["_id"]] = r["count"]
            total += r["count"]
    
    # Active territories count
    territory_count = await db.canvassing_territories.count_documents({"is_active": True})
    
    # Active reps (locations in last 5 min)
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    active_reps = await db.canvassing_locations.count_documents({"timestamp": {"$gte": cutoff}})
    
    return {
        "total_pins": total,
        "by_disposition": stats,
        "disposition_info": DISPOSITIONS,
        "active_territories": territory_count,
        "active_reps": active_reps,
        "conversion_rate": round((stats.get("signed", 0) / total * 100), 1) if total > 0 else 0
    }


@router.get("/dispositions")
async def get_disposition_options():
    """Get all available disposition options with colors"""
    return DISPOSITIONS


@router.post("/pins/repair-invalid")
async def repair_invalid_pins(
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    """
    Repair canvassing pins missing valid latitude/longitude.
    Safe repair order:
    1) existing lat/lng fields
    2) latest history lat/lng
    Leaves unresolved pins untouched and reports IDs.
    """
    pins = await db.canvassing_pins.find({}, {"_id": 0}).to_list(5000)
    scanned = len(pins)
    repaired = 0
    unresolved = []
    unresolved_samples = []

    for pin in pins:
        pin_id = pin.get("id")
        lat = _coerce_float(pin.get("latitude"))
        lng = _coerce_float(pin.get("longitude"))
        valid_primary = (
            lat is not None and lng is not None and -90 <= lat <= 90 and -180 <= lng <= 180
        )
        if valid_primary:
            continue

        candidate_lat = _coerce_float(pin.get("lat"))
        candidate_lng = _coerce_float(pin.get("lng"))

        if not (
            candidate_lat is not None
            and candidate_lng is not None
            and -90 <= candidate_lat <= 90
            and -180 <= candidate_lng <= 180
        ):
            history = pin.get("history") or []
            if isinstance(history, list) and history:
                latest = history[-1]
                candidate_lat = _coerce_float(latest.get("lat"))
                candidate_lng = _coerce_float(latest.get("lng"))

        if (
            candidate_lat is not None
            and candidate_lng is not None
            and -90 <= candidate_lat <= 90
            and -180 <= candidate_lng <= 180
        ):
            await db.canvassing_pins.update_one(
                {"id": pin_id},
                {
                    "$set": {
                        "latitude": candidate_lat,
                        "longitude": candidate_lng,
                        "lat": candidate_lat,
                        "lng": candidate_lng,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )
            repaired += 1
        else:
            unresolved.append(pin_id)
            unresolved_samples.append({
                "id": pin_id,
                "address": pin.get("address"),
                "latitude": pin.get("latitude"),
                "longitude": pin.get("longitude"),
                "lat": pin.get("lat"),
                "lng": pin.get("lng"),
            })

    return {
        "success": True,
        "scanned": scanned,
        "repaired": repaired,
        "unresolved_count": len(unresolved),
        "unresolved_pin_ids": unresolved[:50],
        "unresolved_samples": unresolved_samples[:50],
    }


# ============================================
# Leaderboard & User Stats (for HarvestPage)
# ============================================

@router.get("/leaderboard")
async def get_leaderboard(
    period: str = "week",
    current_user: dict = Depends(get_current_user)
):
    """
    Get leaderboard for the Harvest feature.
    Periods: day, week, month, all
    """
    from routes.harvest_scoring_engine import get_leaderboard as engine_leaderboard, init_scoring_engine
    
    init_scoring_engine(db)
    
    result = await engine_leaderboard(
        metric="points",
        period=period,
        limit=20
    )
    
    # Format for frontend compatibility
    leaderboard = []
    for entry in result.get("entries", []):
        leaderboard.append({
            "user_id": entry.get("user_id"),
            "user_name": entry.get("user_name"),
            "name": entry.get("user_name"),
            "visits": entry.get("doors", 0),
            "total_visits": entry.get("doors", 0),
            "signed": entry.get("signed", 0),
            "appointments": entry.get("appointments", 0),
            "points": entry.get("points", 0),
            "rank": entry.get("rank"),
            "streak": entry.get("streak", 0)
        })
    
    return {"leaderboard": leaderboard, "period": period}


@router.get("/stats")
async def get_my_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Get current user's stats for the footer display.
    Returns: today doors, week doors, signed, appointments.
    """
    from routes.harvest_scoring_engine import get_user_stats, init_scoring_engine
    
    init_scoring_engine(db)
    
    user_id = current_user.get("id")
    stats = await get_user_stats(user_id)
    
    return {
        "today": stats.get("today", {}).get("doors", 0),
        "week": stats.get("this_week", {}).get("doors", 0),
        "signed": stats.get("all_time", {}).get("total_signed", 0),
        "appointments": stats.get("all_time", {}).get("total_appointments", 0),
        "streak": stats.get("streak", 0),
        "multiplier": stats.get("multiplier", 1.0),
        "total_points": stats.get("all_time", {}).get("total_points", 0)
    }


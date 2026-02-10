"""
Regrid Parcel Intelligence Integration for Harvest
===================================================
Provides parcel boundary data, property context, and deduplication for canvassing pins.

Rate Limits: 10 concurrent requests, ~200 RPM
Caching: MongoDB with TTL for parcel data
Fallback: Graceful degradation if Regrid unavailable

API Endpoints:
- GET /api/v2/parcels/point - Lat/lon lookup
- POST /api/v2/batch/points - Bulk parcel lookup
- Tiles: https://tiles.regrid.com/v3/tiles/{z}/{x}/{y}.png
"""
import os
import asyncio
import aiohttp
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import hashlib
import json

from dependencies import db, get_current_active_user as get_current_user

router = APIRouter(prefix="/api/regrid", tags=["Regrid Parcel Intelligence"])

# ============================================
# Configuration
# ============================================
REGRID_API_URL = "https://app.regrid.com/api/v2"
REGRID_TILES_URL = "https://tiles.regrid.com/v3/tiles"
REGRID_TOKEN = os.environ.get("REGRID_API_TOKEN", "")

# Rate limiting
MAX_CONCURRENT_REQUESTS = 10
REQUESTS_PER_MINUTE = 200
REQUEST_SEMAPHORE = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

# Cache TTL (7 days for parcel data - it doesn't change often)
CACHE_TTL_DAYS = 7

# Key fields to cache from Regrid response
PARCEL_CACHE_FIELDS = [
    "ll_uuid",
    "path", 
    "headline",  # Display address
    "address",
    "owner",
    "saddno",    # Street number
    "saddstr",   # Street name
    "saddsttyp", # Street type
    "scity",     # City
    "state2",    # State
    "szip",      # ZIP code
    "parcelnumb",
    "parcelnumb_no_formatting",
    "lat",
    "lon",
    "geom_as_wkt",
    "ll_gisacre",
    "ll_gissqft",
    "usecode",
    "zoning",
    "yearbuilt",
    "improvval",
    "landval",
    "parval",
]

# ============================================
# Models
# ============================================

class PointLookupRequest(BaseModel):
    latitude: float
    longitude: float
    radius: int = 50  # meters

class BatchPointsRequest(BaseModel):
    points: List[Dict[str, float]]  # [{"lat": x, "lon": y, "custom_id": "pin_123"}]

class ParcelResponse(BaseModel):
    ll_uuid: Optional[str]
    path: Optional[str]
    address: Optional[str]
    owner: Optional[str]
    city: Optional[str]
    state: Optional[str]
    zip_code: Optional[str]
    parcel_number: Optional[str]
    acres: Optional[float]
    sqft: Optional[float]
    year_built: Optional[int]
    land_value: Optional[float]
    improvement_value: Optional[float]
    total_value: Optional[float]
    geometry: Optional[Dict]
    cached: bool = False
    cache_timestamp: Optional[str]

# ============================================
# Caching Functions
# ============================================

def get_cache_key(lat: float, lon: float, precision: int = 6) -> str:
    """Generate cache key from coordinates (rounded for proximity matching)"""
    rounded_lat = round(lat, precision)
    rounded_lon = round(lon, precision)
    key_string = f"{rounded_lat},{rounded_lon}"
    return hashlib.md5(key_string.encode()).hexdigest()

async def get_cached_parcel(lat: float, lon: float) -> Optional[Dict]:
    """Check cache for parcel data"""
    cache_key = get_cache_key(lat, lon)
    
    cached = await db.regrid_parcel_cache.find_one({
        "cache_key": cache_key,
        "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
    })
    
    if cached:
        cached.pop("_id", None)
        cached["cached"] = True
        return cached
    
    return None

async def cache_parcel(lat: float, lon: float, parcel_data: Dict):
    """Store parcel data in cache"""
    cache_key = get_cache_key(lat, lon)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=CACHE_TTL_DAYS)).isoformat()
    
    cache_doc = {
        "cache_key": cache_key,
        "lat": lat,
        "lon": lon,
        "ll_uuid": parcel_data.get("ll_uuid"),
        "parcel_data": parcel_data,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at
    }
    
    await db.regrid_parcel_cache.update_one(
        {"cache_key": cache_key},
        {"$set": cache_doc},
        upsert=True
    )

async def get_parcel_by_uuid(ll_uuid: str) -> Optional[Dict]:
    """Get cached parcel by ll_uuid"""
    cached = await db.regrid_parcel_cache.find_one({
        "ll_uuid": ll_uuid,
        "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
    })
    
    if cached:
        cached.pop("_id", None)
        return cached.get("parcel_data")
    
    return None

# ============================================
# Regrid API Client
# ============================================

async def regrid_request(endpoint: str, params: Dict = None, method: str = "GET", data: Dict = None) -> Optional[Dict]:
    """Make rate-limited request to Regrid API"""
    if not REGRID_TOKEN:
        # Return mock data if no token configured
        return None
    
    async with REQUEST_SEMAPHORE:
        url = f"{REGRID_API_URL}{endpoint}"
        params = params or {}
        params["token"] = REGRID_TOKEN
        
        try:
            async with aiohttp.ClientSession() as session:
                if method == "GET":
                    async with session.get(url, params=params, timeout=10) as response:
                        if response.status == 200:
                            return await response.json()
                        elif response.status == 429:
                            # Rate limited - wait and retry
                            await asyncio.sleep(1)
                            return None
                        else:
                            return None
                elif method == "POST":
                    async with session.post(url, params=params, json=data, timeout=30) as response:
                        if response.status == 200:
                            return await response.json()
                        return None
        except asyncio.TimeoutError:
            return None
        except Exception as e:
            print(f"Regrid API error: {e}")
            return None

def parse_regrid_feature(feature: Dict) -> Dict:
    """Parse Regrid GeoJSON feature into clean parcel data"""
    props = feature.get("properties", {})
    geometry = feature.get("geometry", {})
    
    # Extract address components
    address_parts = []
    if props.get("saddno"):
        address_parts.append(str(props.get("saddno")))
    if props.get("saddstr"):
        address_parts.append(props.get("saddstr"))
    if props.get("saddsttyp"):
        address_parts.append(props.get("saddsttyp"))
    
    address = " ".join(address_parts) if address_parts else props.get("headline", props.get("address", ""))
    
    return {
        "ll_uuid": props.get("ll_uuid"),
        "path": props.get("path"),
        "address": address,
        "headline": props.get("headline"),
        "owner": props.get("owner"),
        "city": props.get("scity"),
        "state": props.get("state2"),
        "zip_code": props.get("szip"),
        "parcel_number": props.get("parcelnumb"),
        "parcel_number_clean": props.get("parcelnumb_no_formatting"),
        "acres": props.get("ll_gisacre"),
        "sqft": props.get("ll_gissqft"),
        "year_built": props.get("yearbuilt"),
        "land_value": props.get("landval"),
        "improvement_value": props.get("improvval"),
        "total_value": props.get("parval"),
        "use_code": props.get("usecode"),
        "zoning": props.get("zoning"),
        "geometry": geometry,
        "lat": props.get("lat"),
        "lon": props.get("lon"),
    }

# ============================================
# API Endpoints
# ============================================

@router.get("/parcel/point")
async def lookup_parcel_by_point(
    lat: float,
    lon: float,
    radius: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Look up parcel by latitude/longitude.
    Returns parcel data with boundary geometry.
    Uses cache when available.
    """
    # Check cache first
    cached = await get_cached_parcel(lat, lon)
    if cached:
        return {
            "success": True,
            "cached": True,
            "parcel": cached.get("parcel_data"),
            "cache_timestamp": cached.get("created_at")
        }
    
    # If no token, return graceful fallback
    if not REGRID_TOKEN:
        return {
            "success": False,
            "cached": False,
            "parcel": None,
            "message": "Regrid API not configured. Pin created without parcel data.",
            "fallback": True
        }
    
    # Query Regrid API
    result = await regrid_request("/parcels/point", {
        "lat": lat,
        "lon": lon,
        "radius": radius,
        "limit": 1
    })
    
    if not result or not result.get("features"):
        return {
            "success": False,
            "cached": False,
            "parcel": None,
            "message": "No parcel found at this location"
        }
    
    # Parse first matching parcel
    feature = result["features"][0]
    parcel_data = parse_regrid_feature(feature)
    
    # Cache the result
    await cache_parcel(lat, lon, parcel_data)
    
    return {
        "success": True,
        "cached": False,
        "parcel": parcel_data
    }


@router.get("/parcel/{ll_uuid}")
async def get_parcel_by_id(
    ll_uuid: str,
    current_user: dict = Depends(get_current_user)
):
    """Get parcel data by ll_uuid"""
    # Check cache first
    cached = await get_parcel_by_uuid(ll_uuid)
    if cached:
        return {
            "success": True,
            "cached": True,
            "parcel": cached
        }
    
    if not REGRID_TOKEN:
        return {
            "success": False,
            "parcel": None,
            "message": "Regrid API not configured"
        }
    
    # Query by path (ll_uuid lookup requires path format)
    result = await regrid_request("/parcels/query", {
        "ll_uuid": ll_uuid,
        "limit": 1
    })
    
    if not result or not result.get("features"):
        return {
            "success": False,
            "parcel": None,
            "message": "Parcel not found"
        }
    
    feature = result["features"][0]
    parcel_data = parse_regrid_feature(feature)
    
    return {
        "success": True,
        "cached": False,
        "parcel": parcel_data
    }


@router.post("/batch/points")
async def batch_lookup_parcels(
    request: BatchPointsRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Batch lookup parcels for multiple points.
    Used for turf enrichment.
    Returns immediately with task ID, results available via polling.
    """
    if len(request.points) > 1000:
        raise HTTPException(status_code=400, detail="Maximum 1000 points per batch")
    
    task_id = hashlib.md5(
        f"{current_user.get('id')}-{datetime.now().isoformat()}".encode()
    ).hexdigest()[:12]
    
    # Create task record
    task_doc = {
        "task_id": task_id,
        "user_id": current_user.get("id"),
        "status": "pending",
        "total_points": len(request.points),
        "processed": 0,
        "results": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.regrid_batch_tasks.insert_one(task_doc)
    
    # Process in background
    background_tasks.add_task(
        process_batch_points,
        task_id,
        request.points
    )
    
    return {
        "task_id": task_id,
        "status": "pending",
        "total_points": len(request.points),
        "message": "Batch processing started"
    }


async def process_batch_points(task_id: str, points: List[Dict]):
    """Background task to process batch parcel lookups"""
    results = []
    processed = 0
    
    for point in points:
        lat = point.get("lat")
        lon = point.get("lon")
        custom_id = point.get("custom_id")
        
        # Check cache first
        cached = await get_cached_parcel(lat, lon)
        if cached:
            results.append({
                "custom_id": custom_id,
                "lat": lat,
                "lon": lon,
                "parcel": cached.get("parcel_data"),
                "cached": True
            })
            processed += 1
            continue
        
        # Query Regrid (with rate limiting via semaphore)
        result = await regrid_request("/parcels/point", {
            "lat": lat,
            "lon": lon,
            "radius": 50,
            "limit": 1
        })
        
        if result and result.get("features"):
            parcel_data = parse_regrid_feature(result["features"][0])
            await cache_parcel(lat, lon, parcel_data)
            results.append({
                "custom_id": custom_id,
                "lat": lat,
                "lon": lon,
                "parcel": parcel_data,
                "cached": False
            })
        else:
            results.append({
                "custom_id": custom_id,
                "lat": lat,
                "lon": lon,
                "parcel": None,
                "error": "No parcel found"
            })
        
        processed += 1
        
        # Update progress every 10 points
        if processed % 10 == 0:
            await db.regrid_batch_tasks.update_one(
                {"task_id": task_id},
                {"$set": {"processed": processed, "status": "processing"}}
            )
        
        # Small delay to respect rate limits
        await asyncio.sleep(0.3)
    
    # Mark complete
    await db.regrid_batch_tasks.update_one(
        {"task_id": task_id},
        {
            "$set": {
                "status": "completed",
                "processed": processed,
                "results": results,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )


@router.get("/batch/status/{task_id}")
async def get_batch_status(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get status of batch parcel lookup task"""
    task = await db.regrid_batch_tasks.find_one(
        {"task_id": task_id},
        {"_id": 0}
    )
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task


@router.get("/tiles/config")
async def get_tiles_config(
    current_user: dict = Depends(get_current_user)
):
    """
    Get tile configuration for parcel boundary layer.
    Returns tile URL template for Leaflet/MapLibre.
    """
    if not REGRID_TOKEN:
        return {
            "enabled": False,
            "message": "Regrid API not configured"
        }
    
    return {
        "enabled": True,
        "tiles": {
            "raster": f"{REGRID_TILES_URL}/{{z}}/{{x}}/{{y}}.png?token={REGRID_TOKEN}&styles=line-color:#F97316,line-width:2,fill-opacity:0.1,fill-color:#F97316",
            "attribution": "© Regrid"
        },
        "minZoom": 14,
        "maxZoom": 20
    }


@router.post("/pin/enrich")
async def enrich_pin_with_parcel(
    pin_id: str,
    lat: float,
    lon: float,
    current_user: dict = Depends(get_current_user)
):
    """
    Enrich an existing pin with parcel data.
    Called after pin creation for background enrichment.
    """
    # Look up parcel
    parcel_response = await lookup_parcel_by_point(lat, lon, 50, current_user)
    
    if not parcel_response.get("success") or not parcel_response.get("parcel"):
        return {
            "success": False,
            "pin_id": pin_id,
            "message": "Could not enrich pin with parcel data"
        }
    
    parcel = parcel_response["parcel"]
    
    # Update pin with parcel data
    update_data = {
        "ll_uuid": parcel.get("ll_uuid"),
        "parcel_path": parcel.get("path"),
        "parcel_address": parcel.get("address") or parcel.get("headline"),
        "parcel_owner": parcel.get("owner"),
        "parcel_city": parcel.get("city"),
        "parcel_state": parcel.get("state"),
        "parcel_zip": parcel.get("zip_code"),
        "parcel_number": parcel.get("parcel_number"),
        "parcel_acres": parcel.get("acres"),
        "parcel_sqft": parcel.get("sqft"),
        "parcel_year_built": parcel.get("year_built"),
        "parcel_value": parcel.get("total_value"),
        "parcel_geometry": parcel.get("geometry"),
        "parcel_enriched_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.canvassing_pins.update_one(
        {"id": pin_id},
        {"$set": update_data}
    )
    
    return {
        "success": True,
        "pin_id": pin_id,
        "ll_uuid": parcel.get("ll_uuid"),
        "parcel_address": update_data["parcel_address"],
        "enriched": True
    }


@router.get("/dedupe/check")
async def check_duplicate_parcel(
    ll_uuid: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Check if a pin already exists for this parcel (ll_uuid).
    Used for deduplication during pin creation.
    """
    existing = await db.canvassing_pins.find_one(
        {"ll_uuid": ll_uuid},
        {"_id": 0, "id": 1, "address": 1, "homeowner_name": 1, "disposition": 1}
    )
    
    if existing:
        return {
            "duplicate": True,
            "existing_pin": existing
        }
    
    return {
        "duplicate": False,
        "existing_pin": None
    }


@router.get("/stats")
async def get_regrid_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get usage statistics for Regrid integration"""
    # Count cached parcels
    cached_count = await db.regrid_parcel_cache.count_documents({
        "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
    })
    
    # Count enriched pins
    enriched_pins = await db.canvassing_pins.count_documents({
        "ll_uuid": {"$exists": True, "$ne": None}
    })
    
    # Count batch tasks
    batch_tasks = await db.regrid_batch_tasks.count_documents({})
    
    return {
        "api_configured": bool(REGRID_TOKEN),
        "cached_parcels": cached_count,
        "enriched_pins": enriched_pins,
        "batch_tasks_total": batch_tasks,
        "cache_ttl_days": CACHE_TTL_DAYS,
        "rate_limit": {
            "concurrent": MAX_CONCURRENT_REQUESTS,
            "per_minute": REQUESTS_PER_MINUTE
        }
    }

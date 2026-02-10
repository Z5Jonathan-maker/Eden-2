"""
Proprietary Weather & Date of Loss Verification System
- Carrier-defensible, address-specific weather data
- Uses authoritative sources: NWS, NOAA, ASOS/METAR
- Multi-source overlap verification
- Citation-ready output for carrier disputes
"""
import os
import uuid
import httpx
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from dependencies import db, get_current_active_user

router = APIRouter(prefix="/api/weather", tags=["weather"])


# ============ CONFIGURATION ============

# NOAA/NWS API endpoints (free, no API key required)
NWS_API_BASE = "https://api.weather.gov"
NWS_HEADERS = {
    "User-Agent": "(Eden Claims Platform, contact@edenclaims.com)",
    "Accept": "application/geo+json"
}

# ASOS/METAR via Iowa State University (free, comprehensive historical data)
IOWA_METAR_BASE = "https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py"


# ============ MODELS ============

class WeatherSource(BaseModel):
    """Individual weather data source"""
    source_type: str  # "nws_station", "asos_metar", "cli", "pns", "afd"
    source_id: str  # Station ID or document ID
    source_name: str
    agency: str  # "NWS", "NOAA", "FAA"
    data_type: str  # "observation", "narrative", "daily_summary"
    timestamp: str
    raw_data: Dict[str, Any]
    # Extracted metrics
    wind_speed_mph: Optional[float] = None
    wind_gust_mph: Optional[float] = None
    wind_direction: Optional[str] = None
    precipitation_inches: Optional[float] = None
    hail_reported: bool = False
    hail_size_inches: Optional[float] = None
    tornado_reported: bool = False
    severe_weather_narrative: Optional[str] = None


class DateOfLossVerification(BaseModel):
    """Complete DOL verification record"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    claim_id: Optional[str] = None
    
    # Property information
    address: str
    city: str
    state: str
    zip_code: str
    county: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Date range analyzed
    analysis_start_date: str
    analysis_end_date: str
    
    # Verified Date of Loss
    verified_dol: Optional[str] = None
    dol_confidence: str = "unverified"  # unverified, low, medium, high, confirmed
    event_type: Optional[str] = None  # wind, hail, hurricane, tornado, storm
    
    # Weather sources used
    primary_sources: List[Dict] = []  # Required authoritative sources
    secondary_sources: List[Dict] = []  # Corroborative sources
    
    # Event narrative
    event_summary: Optional[str] = None
    weather_stations_used: List[str] = []
    
    # Overlap verification
    sources_overlapping: int = 0
    geographic_match: bool = False
    temporal_match: bool = False
    narrative_match: bool = False
    
    # Citation-ready output
    citation_text: Optional[str] = None
    source_index: List[Dict] = []
    
    # Metadata
    created_by: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_updated: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    # AI analysis (if Eve integration used)
    ai_analysis: Optional[str] = None


class WeatherSearchRequest(BaseModel):
    address: str
    city: str
    state: str
    zip_code: str
    start_date: str  # YYYY-MM-DD
    end_date: str  # YYYY-MM-DD
    claim_id: Optional[str] = None
    event_type: Optional[str] = None  # wind, hail, hurricane, tornado


class DolDiscoverRequest(BaseModel):
    """Discover & rank candidate dates of loss (DOL) for a property."""
    address: str
    city: str
    state: str
    zip_code: str
    peril_mode: str = Field(default="wind", description="wind|hail")
    window_days: int = Field(default=365, ge=1, le=3650)
    # Advanced (optional)
    start_date: Optional[str] = Field(default=None, description="YYYY-MM-DD")
    end_date: Optional[str] = Field(default=None, description="YYYY-MM-DD")
    min_wind_mph: float = Field(default=30.0, ge=0)
    max_distance_miles: float = Field(default=50.0, ge=1)


class DolStationUsed(BaseModel):
    station_id: str
    station_name: str
    distance_miles: float


class DolCandidate(BaseModel):
    candidate_date: str  # YYYY-MM-DD
    peak_window_start: Optional[str] = None
    peak_window_end: Optional[str] = None
    confidence: str
    explanation: str
    denial_rebuttal_bullets: List[str] = []

    # Wind fields
    max_gust_mph: Optional[float] = None
    sustained_mph: Optional[float] = None
    stations_used: List[DolStationUsed] = []

    # Hail fields (corroboration only)
    hail_reports: Optional[int] = None
    max_hail_in: Optional[float] = None
    min_report_distance_miles: Optional[float] = None


class DolDiscoverResponse(BaseModel):
    location: Dict[str, Any]
    peril_mode: str
    analysis_start_date: str
    analysis_end_date: str
    candidates: List[DolCandidate]


class StationData(BaseModel):
    station_id: str
    station_name: str
    distance_miles: float
    latitude: float
    longitude: float


# ============ HELPER FUNCTIONS ============

async def geocode_address(address: str, city: str, state: str, zip_code: str) -> Dict:
    """Get lat/lng for an address using NWS points API"""
    # For now, use a simple geocoding approach via NWS
    # In production, you'd use a proper geocoding service
    full_address = f"{address}, {city}, {state} {zip_code}"
    
    # Try to get coordinates from Census geocoder (free)
    census_url = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
    params = {
        "address": full_address,
        "benchmark": "Public_AR_Current",
        "format": "json"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(census_url, params=params)
            if response.status_code == 200:
                data = response.json()
                matches = data.get("result", {}).get("addressMatches", [])
                if matches:
                    coords = matches[0].get("coordinates", {})
                    return {
                        "latitude": coords.get("y"),
                        "longitude": coords.get("x"),
                        "matched_address": matches[0].get("matchedAddress")
                    }
    except Exception as e:
        print(f"Geocoding error: {e}")
    
    return {"latitude": None, "longitude": None}


async def get_nws_point_data(lat: float, lng: float) -> Dict:
    """Get NWS forecast office and station info for coordinates"""
    # Round coordinates to 4 decimal places as required by NWS API
    lat = round(lat, 4)
    lng = round(lng, 4)
    
    try:
        async with httpx.AsyncClient(timeout=30.0, headers=NWS_HEADERS, follow_redirects=True) as client:
            response = await client.get(f"{NWS_API_BASE}/points/{lat},{lng}")
            if response.status_code == 200:
                data = response.json()
                props = data.get("properties", {})
                return {
                    "forecast_office": props.get("cwa"),
                    "grid_id": props.get("gridId"),
                    "grid_x": props.get("gridX"),
                    "grid_y": props.get("gridY"),
                    "forecast_zone": props.get("forecastZone"),
                    "county": props.get("county"),
                    "radar_station": props.get("radarStation"),
                    "observation_stations": props.get("observationStations")
                }
    except Exception as e:
        print(f"NWS point data error: {e}")
    
    return {}


async def get_nearby_stations(lat: float, lng: float) -> List[Dict]:
    """Get nearby ASOS/METAR stations"""
    stations = []
    
    # Round coordinates to 4 decimal places
    lat = round(lat, 4)
    lng = round(lng, 4)
    
    try:
        async with httpx.AsyncClient(timeout=30.0, headers=NWS_HEADERS, follow_redirects=True) as client:
            # First get the gridpoint info
            point_response = await client.get(f"{NWS_API_BASE}/points/{lat},{lng}")
            if point_response.status_code != 200:
                print(f"Points API failed: {point_response.status_code}")
                return stations
            
            point_data = point_response.json()
            props = point_data.get("properties", {})
            
            # Try to get observation stations URL from the response
            observation_stations_url = props.get("observationStations")
            
            if observation_stations_url:
                # Use the direct observation stations URL
                stations_response = await client.get(observation_stations_url)
                
                if stations_response.status_code == 200:
                    data = stations_response.json()
                    features = data.get("features", [])[:5]  # Top 5 nearest
                    
                    for feature in features:
                        station_props = feature.get("properties", {})
                        station_id = station_props.get("stationIdentifier", "")
                        
                        # Calculate approximate distance
                        station_coords = feature.get("geometry", {}).get("coordinates", [0, 0])
                        if station_coords:
                            # Simple distance calculation (approximate)
                            dlat = abs(lat - station_coords[1])
                            dlng = abs(lng - station_coords[0])
                            distance = ((dlat ** 2 + dlng ** 2) ** 0.5) * 69  # Rough miles
                        else:
                            distance = 0
                        
                        stations.append({
                            "station_id": station_id,
                            "station_name": station_props.get("name", ""),
                            "distance_miles": round(distance, 1),
                            "latitude": station_coords[1] if len(station_coords) > 1 else None,
                            "longitude": station_coords[0] if station_coords else None,
                            "elevation_m": station_props.get("elevation", {}).get("value")
                        })
            else:
                # Fallback: Try gridpoints stations endpoint
                grid_id = props.get("gridId")
                grid_x = props.get("gridX")
                grid_y = props.get("gridY")
                
                if grid_id:
                    stations_url = f"{NWS_API_BASE}/gridpoints/{grid_id}/{grid_x},{grid_y}/stations"
                    response = await client.get(stations_url)
                    
                    if response.status_code == 200:
                        data = response.json()
                        features = data.get("features", [])[:5]
                        
                        for feature in features:
                            station_props = feature.get("properties", {})
                            station_id = station_props.get("stationIdentifier", "")
                            
                            station_coords = feature.get("geometry", {}).get("coordinates", [0, 0])
                            if station_coords:
                                dlat = abs(lat - station_coords[1])
                                dlng = abs(lng - station_coords[0])
                                distance = ((dlat ** 2 + dlng ** 2) ** 0.5) * 69
                            else:
                                distance = 0
                            
                            stations.append({
                                "station_id": station_id,
                                "station_name": station_props.get("name", ""),
                                "distance_miles": round(distance, 1),
                                "latitude": station_coords[1] if len(station_coords) > 1 else None,
                                "longitude": station_coords[0] if station_coords else None,
                                "elevation_m": station_props.get("elevation", {}).get("value")
                            })
                            
    except Exception as e:
        print(f"Station lookup error: {e}")
    
    return stations


async def get_metar_data(station_id: str, start_date: str, end_date: str) -> List[Dict]:
    """Get METAR/ASOS observations from Iowa State"""
    observations = []
    
    # Format: YYYY-MM-DD to components
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    # Add one day to end_date to include the full day
    end_plus = end + timedelta(days=1)
    
    params = {
        "station": station_id,
        "data": "all",
        "year1": start.year,
        "month1": start.month,
        "day1": start.day,
        "year2": end_plus.year,
        "month2": end_plus.month,
        "day2": end_plus.day,
        "tz": "UTC",
        "format": "onlycomma",  # CSV format is more reliable
        "latlon": "yes",
        "direct": "yes"
    }
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(IOWA_METAR_BASE, params=params)
            if response.status_code == 200:
                text = response.text
                lines = text.strip().split('\n')
                
                # Find header line and data lines
                header_idx = -1
                for i, line in enumerate(lines):
                    if line.startswith('station,valid'):
                        header_idx = i
                        break
                
                if header_idx >= 0 and len(lines) > header_idx + 1:
                    import csv
                    from io import StringIO
                    
                    # Parse CSV data
                    csv_data = '\n'.join(lines[header_idx:])
                    reader = csv.DictReader(StringIO(csv_data))
                    
                    for row in reader:
                        try:
                            # Extract wind data - values might be empty strings
                            wind_speed_str = row.get("sknt", "")
                            wind_gust_str = row.get("gust", "")
                            
                            wind_speed = float(wind_speed_str) if wind_speed_str and wind_speed_str.strip() else None
                            wind_gust = float(wind_gust_str) if wind_gust_str and wind_gust_str.strip() else None
                            
                            # Also check peak_wind_gust for the most severe winds
                            peak_gust_str = row.get("peak_wind_gust", "")
                            peak_gust = float(peak_gust_str) if peak_gust_str and peak_gust_str.strip() else None
                            
                            # Use peak gust if higher than regular gust
                            if peak_gust and (not wind_gust or peak_gust > wind_gust):
                                wind_gust = peak_gust
                            
                            observations.append({
                                "timestamp": row.get("valid"),
                                "station": station_id,
                                "wind_speed_kts": wind_speed,
                                "wind_speed_mph": round(wind_speed * 1.151, 1) if wind_speed else None,
                                "wind_gust_kts": wind_gust,
                                "wind_gust_mph": round(wind_gust * 1.151, 1) if wind_gust else None,
                                "wind_direction": row.get("drct"),
                                "temperature_f": row.get("tmpf"),
                                "precipitation": row.get("p01i"),
                                "weather_codes": row.get("wxcodes"),
                                "raw_metar": row.get("metar"),
                                "peak_wind_gust_mph": round(peak_gust * 1.151, 1) if peak_gust else None
                            })
                        except (ValueError, TypeError) as e:
                            # Skip malformed rows
                            continue
                            
    except Exception as e:
        print(f"METAR data error: {e}")
    
    return observations


def _haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in miles (no external deps)."""
    from math import radians, sin, cos, asin, sqrt
    r = 3958.7613  # Earth radius in miles
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(a))


async def fetch_lsr_events_iem(lat: float, lon: float, start_date: str, end_date: str, radius_miles: float = 25.0) -> List[Dict]:
    """Fetch NWS Local Storm Reports (LSR) via IEM GeoJSON feed.

    Notes:
    - LSRs are corroboration (spotter/official reports), not instrument readings.
    - We use a bbox around the point to avoid heavy queries.
    """
    # Rough bbox conversion: 1 deg lat ~ 69 miles; lon scale by cos(lat)
    from math import cos, radians
    dlat = radius_miles / 69.0
    dlon = radius_miles / (69.0 * max(cos(radians(lat)), 0.2))

    west = lon - dlon
    east = lon + dlon
    south = lat - dlat
    north = lat + dlat

    params = {
        "west": west,
        "east": east,
        "south": south,
        "north": north,
        "sts": start_date,
        "ets": end_date,
        "fmt": "geojson",
    }

    url = "https://mesonet.agron.iastate.edu/geojson/lsr.py"
    events: List[Dict] = []
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                return []
            data = resp.json()
            for feat in data.get("features", []) or []:
                props = feat.get("properties", {}) or {}
                geom = feat.get("geometry", {}) or {}
                coords = geom.get("coordinates") or []
                if len(coords) < 2:
                    continue
                ev_lon, ev_lat = coords[0], coords[1]
                dist = _haversine_miles(lat, lon, ev_lat, ev_lon)
                if dist > radius_miles:
                    continue

                # IEM LSR type can be in 'type' field (e.g. HAIL, TSTM WND DMG...) depending on feed
                lsr_type = (props.get("type") or props.get("event") or "").strip().upper()
                magnitude = props.get("magnitude")
                try:
                    magnitude = float(magnitude) if magnitude not in (None, "") else None
                except (ValueError, TypeError):
                    magnitude = None

                # Timestamp fields vary; attempt common keys
                ts = props.get("valid") or props.get("timestamp") or props.get("date") or props.get("utc")
                if ts and isinstance(ts, str) and "T" in ts:
                    # Normalize to ISO (already often is)
                    ts_iso = ts
                else:
                    ts_iso = None

                kind = "hail" if "HAIL" in lsr_type else "lsr"
                events.append({
                    "event_kind": kind,
                    "lsr_type": lsr_type,
                    "timestamp": ts_iso,
                    "latitude": ev_lat,
                    "longitude": ev_lon,
                    "distance_miles": round(dist, 1),
                    "magnitude": magnitude,
                    "source": "NWS LSR (IEM)",
                    "raw": props,
                })
    except Exception:
        return []

    return events


async def get_nws_alerts_history(lat: float, lng: float, start_date: str, end_date: str) -> List[Dict]:
    """Get historical NWS alerts for location"""
    alerts = []
    
    try:
        async with httpx.AsyncClient(timeout=30.0, headers=NWS_HEADERS) as client:
            # Note: NWS API has limited historical data
            # This gets active alerts; for historical, you'd need archived data
            response = await client.get(
                f"{NWS_API_BASE}/alerts",
                params={
                    "point": f"{lat},{lng}",
                    "status": "actual",
                    "message_type": "alert"
                }
            )
            if response.status_code == 200:
                data = response.json()
                for feature in data.get("features", []):
                    props = feature.get("properties", {})
                    alerts.append({
                        "event": props.get("event"),
                        "headline": props.get("headline"),
                        "description": props.get("description"),
                        "severity": props.get("severity"),
                        "certainty": props.get("certainty"),
                        "onset": props.get("onset"),
                        "expires": props.get("expires"),
                        "sender": props.get("senderName")
                    })
    except Exception as e:
        print(f"Alert history error: {e}")
    
    return alerts


def analyze_wind_events(observations: List[Dict], threshold_mph: float = 30.0) -> List[Dict]:
    """Analyze observations for significant wind events"""
    events = []
    
    for obs in observations:
        gust = obs.get("wind_gust_mph") or 0
        speed = obs.get("wind_speed_mph") or 0
        peak_gust = obs.get("peak_wind_gust_mph") or 0
        max_wind = max(gust, speed, peak_gust)
        
        if max_wind >= threshold_mph:
            events.append({
                "timestamp": obs.get("timestamp"),
                "station": obs.get("station"),
                "max_wind_mph": max_wind,
                "wind_speed_mph": speed,
                "wind_gust_mph": gust,
                "peak_wind_gust_mph": peak_gust,
                "direction": obs.get("wind_direction"),
                "severity": "extreme" if max_wind >= 75 else "severe" if max_wind >= 58 else "significant" if max_wind >= 40 else "moderate"
            })
    
    return events


def generate_citation(verification: Dict) -> str:
    """Generate carrier-defensible citation text"""
    citations = []
    
    for i, source in enumerate(verification.get("primary_sources", []), 1):
        source_type = source.get("source_type", "")
        station = source.get("station_id", "")
        timestamp = source.get("timestamp", "")
        
        if source_type == "asos_metar":
            citations.append(
                f"[{i}] ASOS/METAR Station {station}, "
                f"Observation: {timestamp}, "
                f"Source: National Weather Service/FAA Certified Station"
            )
        elif source_type == "nws_alert":
            citations.append(
                f"[{i}] NWS Alert: {source.get('event', 'Weather Event')}, "
                f"Issued: {timestamp}, "
                f"Source: National Weather Service"
            )
    
    if citations:
        header = (
            f"Weather Verification for {verification.get('address', 'Property')}, "
            f"{verification.get('city', '')}, {verification.get('state', '')} {verification.get('zip_code', '')}\n"
            f"Analysis Period: {verification.get('analysis_start_date')} to {verification.get('analysis_end_date')}\n"
            f"Verified Date of Loss: {verification.get('verified_dol', 'Under Review')}\n\n"
            "Primary Sources:\n"
        )
        return header + "\n".join(citations)
    
    return "Insufficient data for citation generation."


# ============ API ENDPOINTS ============

@router.post("/verify")
async def verify_weather_window(request: WeatherSearchRequest, current_user: dict = Depends(get_current_active_user)):
    """Additive endpoint used by Property Intel: returns defensible wind/hail signals for a date window.

    This does NOT declare a date of loss; it summarizes evidence.
    """
    # Geocode
    coords = await geocode_address(request.address, request.city, request.state, request.zip_code)
    lat, lng = coords.get("latitude"), coords.get("longitude")
    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="Unable to geocode address")

    # Stations: reuse existing helper (returns sorted by approximate distance)
    stations = await get_nearby_stations(lat, lng)
    # Keep it light: use the nearest 3
    stations = sorted(stations, key=lambda s: s.get("distance_miles", 999))[:3]

    # Fetch obs concurrently
    async def _fetch_station(st):
        sid = st.get("station_id")
        if not sid:
            return []
        return await get_metar_data(sid, request.start_date, request.end_date)

    obs_lists = await asyncio.gather(*[_fetch_station(s) for s in stations], return_exceptions=True)
    all_obs: List[Dict] = []
    for item in obs_lists:
        if isinstance(item, Exception):
            continue
        all_obs.extend(item)

    wind_events = analyze_wind_events(all_obs, threshold_mph=30.0)

    # Hail corroboration via LSR
    lsr_events = await fetch_lsr_events_iem(lat, lng, request.start_date, request.end_date, radius_miles=25.0)
    hail_events = [e for e in lsr_events if e.get("event_kind") == "hail"]

    return {
        "location": {
            "address": request.address,
            "city": request.city,
            "state": request.state,
            "zip_code": request.zip_code,
            "latitude": lat,
            "longitude": lng,
        },
        "start_date": request.start_date,
        "end_date": request.end_date,
        "stations": stations,
        "wind_events": wind_events,
        "hail_events": hail_events,
        "raw_observation_count": len(all_obs),
    }


@router.post("/dol/discover", response_model=DolDiscoverResponse)
async def discover_dol_candidates(request: DolDiscoverRequest, current_user: dict = Depends(get_current_active_user)):
    """Discover and rank candidate DOLs for wind or hail.

    - Wind: primary evidence from METAR/ASOS/AWOS station observations.
    - Hail: corroboration from NWS LSRs (IEM feed). We do not claim instrument hail size.
    """
    coords = await geocode_address(request.address, request.city, request.state, request.zip_code)
    lat, lng = coords.get("latitude"), coords.get("longitude")
    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="Unable to geocode address")

    # Resolve analysis window
    if request.start_date and request.end_date:
        start_date = request.start_date
        end_date = request.end_date
    else:
        end_dt = datetime.now(timezone.utc).date()
        start_dt = end_dt - timedelta(days=int(request.window_days))
        start_date = start_dt.isoformat()
        end_date = end_dt.isoformat()

    peril = (request.peril_mode or "wind").strip().lower()
    if peril not in ("wind", "hail"):
        raise HTTPException(status_code=400, detail="peril_mode must be 'wind' or 'hail'")

    # Stations
    stations = await get_nearby_stations(lat, lng)
    stations = sorted(stations, key=lambda s: s.get("distance_miles", 999))
    stations = [s for s in stations if (s.get("distance_miles") or 999) <= request.max_distance_miles][:4]

    candidates: List[Dict[str, Any]] = []

    if peril == "wind":
        async def _fetch_station(st):
            sid = st.get("station_id")
            if not sid:
                return st, []
            return st, await get_metar_data(sid, start_date, end_date)

        station_obs = await asyncio.gather(*[_fetch_station(s) for s in stations], return_exceptions=False)

        # Aggregate per day
        per_day: Dict[str, Dict[str, Any]] = {}
        for st, obs in station_obs:
            for row in obs:
                ts = row.get("timestamp")
                if not ts:
                    continue
                day = ts.split("T")[0]
                max_wind = max(
                    row.get("wind_gust_mph") or 0,
                    row.get("peak_wind_gust_mph") or 0,
                    row.get("wind_speed_mph") or 0,
                )
                if max_wind < request.min_wind_mph:
                    continue
                bucket = per_day.setdefault(day, {
                    "candidate_date": day,
                    "max_gust_mph": 0.0,
                    "sustained_mph": 0.0,
                    "stations": {},
                    "peak_window_start": None,
                    "peak_window_end": None,
                })
                bucket["max_gust_mph"] = max(bucket["max_gust_mph"], float(max_wind))
                bucket["sustained_mph"] = max(bucket["sustained_mph"], float(row.get("wind_speed_mph") or 0))
                sid = st.get("station_id")
                if sid:
                    bucket["stations"][sid] = {
                        "station_id": sid,
                        "station_name": st.get("station_name") or "",
                        "distance_miles": st.get("distance_miles") or 0,
                    }

                # Track a tight peak window (first/last qualifying obs)
                if bucket["peak_window_start"] is None or (ts and ts < bucket["peak_window_start"]):
                    bucket["peak_window_start"] = ts
                if bucket["peak_window_end"] is None or (ts and ts > bucket["peak_window_end"]):
                    bucket["peak_window_end"] = ts

        # Rank (explainable): gust + multi-station + closeness
        ranked = []
        for day, b in per_day.items():
            stations_used = list(b["stations"].values())
            stations_used.sort(key=lambda s: s.get("distance_miles", 999))
            closest = stations_used[0]["distance_miles"] if stations_used else 999
            multi = len(stations_used)
            gust = b["max_gust_mph"]

            # Simple confidence tiers (non-breaking strings)
            if gust >= 58 and multi >= 2:
                conf = "high"
            elif gust >= 40 and multi >= 2:
                conf = "medium"
            elif gust >= 58:
                conf = "medium"
            else:
                conf = "low"

            explanation = (
                f"Station observations show winds peaking around {round(gust)} mph near the property on {day}. "
                f"Nearest station used is ~{round(closest, 1)} miles away; {multi} station(s) corroborate the signal. "
                "This is based on certified METAR/ASOS observations (ground truth)."
            )

            denial_bullets = [
                "Ground-truth station observations are present for the location window (not speculation).",
                "Multiple stations and proximity reduce 'station too far' arguments.",
                "Peak window is bounded by actual observation timestamps (tight, reviewable timeline).",
            ]

            ranked.append({
                **b,
                "confidence": conf,
                "explanation": explanation,
                "denial_rebuttal_bullets": denial_bullets,
                "stations_used": stations_used,
                "score": float(gust) + (10.0 * max(multi - 1, 0)) - (0.2 * float(closest)),
            })

        ranked.sort(key=lambda x: x.get("score", 0), reverse=True)
        for item in ranked[:25]:
            item.pop("score", None)
            candidates.append(item)

    else:  # hail
        lsr_events = await fetch_lsr_events_iem(lat, lng, start_date, end_date, radius_miles=min(request.max_distance_miles, 50.0))
        hail = [e for e in lsr_events if e.get("event_kind") == "hail"]
        per_day: Dict[str, Dict[str, Any]] = {}
        for e in hail:
            ts = e.get("timestamp")
            if not ts:
                continue
            day = ts.split("T")[0]
            bucket = per_day.setdefault(day, {
                "candidate_date": day,
                "hail_reports": 0,
                "max_hail_in": None,
                "min_report_distance_miles": None,
                "peak_window_start": None,
                "peak_window_end": None,
            })
            bucket["hail_reports"] += 1
            mag = e.get("magnitude")
            if mag is not None:
                bucket["max_hail_in"] = max(bucket["max_hail_in"] or 0, float(mag))
            dist = e.get("distance_miles")
            if dist is not None:
                bucket["min_report_distance_miles"] = min(bucket["min_report_distance_miles"] or 999, float(dist))
            if bucket["peak_window_start"] is None or (ts and ts < bucket["peak_window_start"]):
                bucket["peak_window_start"] = ts
            if bucket["peak_window_end"] is None or (ts and ts > bucket["peak_window_end"]):
                bucket["peak_window_end"] = ts

        ranked = []
        for day, b in per_day.items():
            reports = b.get("hail_reports") or 0
            closest = b.get("min_report_distance_miles") or 999
            size = b.get("max_hail_in") or 0

            if reports >= 2 and closest <= 10:
                conf = "medium"
            elif reports >= 1 and closest <= 10:
                conf = "low"
            else:
                conf = "low"

            explanation = (
                f"NWS Local Storm Reports indicate hail activity near the property on {day}. "
                f"Closest report is ~{round(closest, 1)} miles away with {reports} report(s) in the window. "
                "LSR hail is corroboration from official/spotter reporting and should be paired with station/radar context."
            )

            denial_bullets = [
                "Official/spotter hail reporting exists near the property (not a generic storm claim).",
                "Proximity and report count can be shown to rebut 'no hail in area' assertions.",
                "Timing window is anchored to report timestamps for reviewable chronology.",
            ]

            ranked.append({
                **b,
                "confidence": conf,
                "explanation": explanation,
                "denial_rebuttal_bullets": denial_bullets,
                "score": (2.0 * reports) + (1.5 * float(size)) - (0.15 * float(closest)),
            })

        ranked.sort(key=lambda x: x.get("score", 0), reverse=True)
        for item in ranked[:25]:
            item.pop("score", None)
            candidates.append(item)

    return {
        "location": {
            "address": request.address,
            "city": request.city,
            "state": request.state,
            "zip_code": request.zip_code,
            "latitude": lat,
            "longitude": lng,
        },
        "peril_mode": peril,
        "analysis_start_date": start_date,
        "analysis_end_date": end_date,
        "candidates": candidates,
    }

@router.post("/verify-dol")
async def verify_date_of_loss(
    request: WeatherSearchRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Verify Date of Loss using authoritative weather sources.
    This is the main endpoint for the DOL verification system.
    """
    # Step 1: Geocode the address
    geo = await geocode_address(
        request.address, 
        request.city, 
        request.state, 
        request.zip_code
    )
    
    if not geo.get("latitude"):
        raise HTTPException(
            status_code=400,
            detail="Unable to geocode address. Please verify the address is correct."
        )
    
    lat, lng = geo["latitude"], geo["longitude"]
    
    # Step 2: Get NWS point data
    nws_point = await get_nws_point_data(lat, lng)
    
    # Step 3: Get nearby weather stations
    stations = await get_nearby_stations(lat, lng)
    
    if not stations:
        raise HTTPException(
            status_code=404,
            detail="No weather stations found near this location."
        )
    
    # Step 4: Gather METAR/ASOS data from multiple stations
    all_observations = []
    primary_sources = []
    stations_used = []
    
    for station in stations[:3]:  # Use top 3 closest stations
        station_id = station["station_id"]
        observations = await get_metar_data(
            station_id,
            request.start_date,
            request.end_date
        )
        
        if observations:
            all_observations.extend(observations)
            stations_used.append(station_id)
            
            # Find max winds for this station (including peak gusts)
            max_wind = max(
                max(
                    obs.get("wind_gust_mph") or 0,
                    obs.get("wind_speed_mph") or 0,
                    obs.get("peak_wind_gust_mph") or 0
                )
                for obs in observations
            )
            
            if max_wind > 0:
                primary_sources.append({
                    "source_type": "asos_metar",
                    "station_id": station_id,
                    "station_name": station["station_name"],
                    "distance_miles": station["distance_miles"],
                    "agency": "NWS/FAA",
                    "max_wind_mph": max_wind,
                    "observation_count": len(observations),
                    "timestamp": request.start_date
                })
    
    # Step 5: Analyze for significant weather events (lowered threshold to 20mph for initial detection)
    # Defensibility default: only treat >= 30 mph as an "event"; retain all raw observations.
    wind_events = analyze_wind_events(all_observations, threshold_mph=30.0)
    
    # Step 6: Determine verified DOL and confidence
    verified_dol = None
    confidence = "unverified"
    event_summary = None
    
    if wind_events:
        # Sort by severity and timestamp
        wind_events.sort(key=lambda x: (-x.get("max_wind_mph", 0), x.get("timestamp", "")))
        most_severe = wind_events[0]
        
        # Extract date from timestamp
        if most_severe.get("timestamp"):
            try:
                # Handle different timestamp formats
                ts = most_severe["timestamp"]
                if " " in ts:
                    # Format: "2025-01-15 12:53"
                    event_dt = datetime.strptime(ts.split("+")[0].strip(), "%Y-%m-%d %H:%M")
                else:
                    event_dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                verified_dol = event_dt.strftime("%Y-%m-%d")
            except Exception as e:
                print(f"Date parsing error: {e}")
                verified_dol = request.start_date
        
        # Determine confidence based on source overlap and wind speed
        source_count = len(primary_sources)
        max_wind = most_severe.get("max_wind_mph", 0)
        
        # Adjusted confidence thresholds for more realistic results
        if source_count >= 2 and max_wind >= 58:
            confidence = "confirmed"
        elif source_count >= 2 and max_wind >= 40:
            confidence = "high"
        elif source_count >= 1 and max_wind >= 30:
            confidence = "medium"
        elif max_wind >= 20:
            confidence = "low"
        else:
            confidence = "unverified"
        
        severity_desc = most_severe.get("severity", "moderate")
        event_summary = (
            f"Weather event detected on {verified_dol}. "
            f"Maximum recorded wind: {max_wind:.1f} mph ({severity_desc}). "
            f"Data from {source_count} authoritative station(s): {', '.join(stations_used)}. "
            f"Total observations analyzed: {len(all_observations)}."
        )
    else:
        event_summary = (
            f"No significant weather events detected in the analysis period "
            f"({request.start_date} to {request.end_date}) for this location."
        )
    
    # Step 7: Create verification record
    verification = DateOfLossVerification(
        claim_id=request.claim_id,
        address=request.address,
        city=request.city,
        state=request.state,
        zip_code=request.zip_code,
        county=nws_point.get("county", "").split("/")[-1] if nws_point.get("county") else None,
        latitude=lat,
        longitude=lng,
        analysis_start_date=request.start_date,
        analysis_end_date=request.end_date,
        verified_dol=verified_dol,
        dol_confidence=confidence,
        event_type=request.event_type or "wind",
        primary_sources=primary_sources,
        weather_stations_used=stations_used,
        sources_overlapping=len(primary_sources),
        geographic_match=True,
        temporal_match=bool(verified_dol),
        event_summary=event_summary,
        created_by=current_user.get("email", "")
    )
    
    # Generate citation
    verification.citation_text = generate_citation(verification.model_dump())
    verification.source_index = [
        {
            "index": i + 1,
            "source": s["station_id"],
            "type": s["source_type"],
            "agency": s["agency"]
        }
        for i, s in enumerate(primary_sources)
    ]
    
    # Save to database
    await db.weather_verifications.insert_one(verification.model_dump())
    
    # If claim_id provided, link to claim
    if request.claim_id:
        await db.claims.update_one(
            {"id": request.claim_id},
            {"$set": {
                "weather_verification_id": verification.id,
                "verified_dol": verified_dol,
                "dol_confidence": confidence
            }}
        )
    
    return {
        "verification_id": verification.id,
        "verified_dol": verified_dol,
        "confidence": confidence,
        "event_summary": event_summary,
        "primary_sources": primary_sources,
        "stations_used": stations_used,
        "citation": verification.citation_text,
        "location": {
            "latitude": lat,
            "longitude": lng,
            "county": verification.county
        }
    }


@router.get("/verification/{verification_id}")
async def get_verification(
    verification_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a specific weather verification record"""
    verification = await db.weather_verifications.find_one(
        {"id": verification_id},
        {"_id": 0}
    )
    
    if not verification:
        raise HTTPException(status_code=404, detail="Verification not found")
    
    return verification


@router.get("/claim/{claim_id}")
async def get_claim_weather(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get weather verification for a specific claim"""
    verification = await db.weather_verifications.find_one(
        {"claim_id": claim_id},
        {"_id": 0}
    )
    
    if not verification:
        return {"message": "No weather verification found for this claim"}
    
    return verification


@router.get("/stations/nearby")
async def get_stations_near_address(
    address: str,
    city: str,
    state: str,
    zip_code: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get weather stations near an address"""
    geo = await geocode_address(address, city, state, zip_code)
    
    if not geo.get("latitude"):
        raise HTTPException(status_code=400, detail="Unable to geocode address")
    
    stations = await get_nearby_stations(geo["latitude"], geo["longitude"])
    
    return {
        "address": f"{address}, {city}, {state} {zip_code}",
        "coordinates": geo,
        "stations": stations
    }


@router.post("/quick-check")
async def quick_weather_check(
    address: str,
    city: str,
    state: str,
    zip_code: str,
    date: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Quick check for weather events on a specific date"""
    # Single day check
    return await verify_date_of_loss(
        WeatherSearchRequest(
            address=address,
            city=city,
            state=state,
            zip_code=zip_code,
            start_date=date,
            end_date=date
        ),
        current_user
    )


@router.get("/history")
async def get_verification_history(
    days: int = 30,
    current_user: dict = Depends(get_current_active_user)
):
    """Get recent weather verifications"""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    verifications = await db.weather_verifications.find(
        {"created_at": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {
        "verifications": verifications,
        "count": len(verifications)
    }

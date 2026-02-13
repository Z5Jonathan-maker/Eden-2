"""
Proprietary Weather & Date of Loss Verification System
- Carrier-defensible, address-specific weather data
- Uses authoritative sources: NWS, NOAA, ASOS/METAR
- Multi-source overlap verification
- Citation-ready output for carrier disputes
"""
import os
import uuid
import asyncio
import httpx
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
WAYBACK_SELECTION_URL = "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer"


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


class DolCandidateRequest(WeatherSearchRequest):
    top_n: int = Field(default=10, ge=1, le=50)
    max_distance_miles: float = Field(default=25.0, ge=1.0, le=250.0)
    min_wind_mph: float = Field(default=30.0, ge=0.0, le=200.0)


class StationData(BaseModel):
    station_id: str
    station_name: str
    distance_miles: float
    latitude: float
    longitude: float


# ============ HELPER FUNCTIONS ============

def _address_variants(raw_address: str) -> List[str]:
    clean = " ".join((raw_address or "").split()).strip()
    if not clean:
        return []

    variants: List[str] = [clean]
    directional_map = {
        "NORTHWEST": "NW",
        "NORTHEAST": "NE",
        "SOUTHWEST": "SW",
        "SOUTHEAST": "SE",
        "NORTH": "N",
        "SOUTH": "S",
        "EAST": "E",
        "WEST": "W",
    }

    upper = clean.upper()
    for long_form, short_form in directional_map.items():
        if long_form in upper:
            upper = upper.replace(long_form, short_form)
    abbreviated = " ".join(upper.split()).title()
    if abbreviated and abbreviated not in variants:
        variants.append(abbreviated)

    without_commas = clean.replace(",", " ").strip()
    if without_commas and without_commas not in variants:
        variants.append(without_commas)

    return variants


async def geocode_address(address: str, city: str, state: str, zip_code: str) -> Dict:
    """Resolve lat/lng for an address with resilient geocoding fallbacks."""
    state_code = (state or "").strip().upper()
    clean_address = (address or "").strip()
    clean_city = (city or "").strip()
    clean_zip = (zip_code or "").strip()
    address_variants = _address_variants(clean_address)

    query_candidates: List[str] = []
    structured_candidates: List[Dict[str, str]] = []

    def add_query(query: str):
        formatted = " ".join(query.split()).strip(", ")
        if formatted and formatted not in query_candidates:
            query_candidates.append(formatted)

    def add_structured(street_value: str, city_value: str, zip_value: str):
        street = " ".join((street_value or "").split()).strip()
        if not street:
            return
        payload = {
            "street": street,
            "city": " ".join((city_value or "").split()).strip(),
            "state": state_code,
            "zip": " ".join((zip_value or "").split()).strip(),
        }
        if payload not in structured_candidates:
            structured_candidates.append(payload)

    for street_variant in address_variants:
        add_query(f"{street_variant}, {clean_city}, {state_code} {clean_zip}")
        add_query(f"{street_variant}, {state_code} {clean_zip}")
        add_query(f"{street_variant}, {clean_city}, {state_code}")
        add_query(f"{street_variant}, {clean_zip}")
        add_query(f"{street_variant}, {state_code}")
        add_structured(street_variant, clean_city, clean_zip)
        add_structured(street_variant, "", clean_zip)
        add_structured(street_variant, clean_city, "")

    if clean_zip:
        add_query(f"{clean_zip}, {state_code}")
        add_query(clean_zip)

    census_line_url = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
    census_structured_url = "https://geocoding.geo.census.gov/geocoder/locations/address"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for structured in structured_candidates:
                params = {
                    "street": structured.get("street", ""),
                    "city": structured.get("city", ""),
                    "state": structured.get("state", ""),
                    "zip": structured.get("zip", ""),
                    "benchmark": "Public_AR_Current",
                    "format": "json",
                }
                response = await client.get(census_structured_url, params=params)
                if response.status_code != 200:
                    continue
                data = response.json()
                matches = data.get("result", {}).get("addressMatches", [])
                if not matches:
                    continue
                coords = matches[0].get("coordinates", {})
                lat = coords.get("y")
                lng = coords.get("x")
                if lat is None or lng is None:
                    continue
                return {
                    "latitude": lat,
                    "longitude": lng,
                    "matched_address": matches[0].get("matchedAddress"),
                    "geocoder": "census_structured",
                    "precision": "address",
                }

            for query in query_candidates:
                params = {
                    "address": query,
                    "benchmark": "Public_AR_Current",
                    "format": "json",
                }
                response = await client.get(census_line_url, params=params)
                if response.status_code != 200:
                    continue
                data = response.json()
                matches = data.get("result", {}).get("addressMatches", [])
                if not matches:
                    continue
                coords = matches[0].get("coordinates", {})
                lat = coords.get("y")
                lng = coords.get("x")
                if lat is None or lng is None:
                    continue
                return {
                    "latitude": lat,
                    "longitude": lng,
                    "matched_address": matches[0].get("matchedAddress"),
                    "geocoder": "census",
                    "precision": "address",
                }
    except Exception as e:
        print(f"Census geocoding error: {e}")

    try:
        async with httpx.AsyncClient(
            timeout=20.0,
            headers={"User-Agent": "EdenClaims/1.0 (ops@edenclaims.com)"},
        ) as client:
            for query in query_candidates:
                response = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={
                        "q": query,
                        "format": "jsonv2",
                        "limit": 1,
                        "countrycodes": "us",
                    },
                )
                if response.status_code != 200:
                    continue
                payload = response.json()
                if not payload:
                    continue
                lat = payload[0].get("lat")
                lng = payload[0].get("lon")
                if lat is None or lng is None:
                    continue
                geocode_precision = "address"
                if clean_zip and query.strip() in {clean_zip, f"{clean_zip}, {state_code}".strip(", ")}:
                    geocode_precision = "postal_code"
                return {
                    "latitude": float(lat),
                    "longitude": float(lng),
                    "matched_address": payload[0].get("display_name"),
                    "geocoder": "nominatim",
                    "precision": geocode_precision,
                }
    except Exception as e:
        print(f"Nominatim geocoding error: {e}")

    return {"latitude": None, "longitude": None, "precision": "none"}


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


async def fetch_station_observation_bundle(
    stations: List[Dict[str, Any]],
    start_date: str,
    end_date: str,
    max_stations: int = 3,
    per_station_timeout_s: float = 35.0,
) -> List[Dict[str, Any]]:
    """
    Fetch station observations in parallel with per-station timeout.
    This avoids long sequential waits that can trigger upstream 502s.
    """
    selected_stations = [station for station in stations if station.get("station_id")][:max_stations]
    if not selected_stations:
        return []

    async def _fetch(station: Dict[str, Any]) -> Dict[str, Any]:
        station_id = station.get("station_id")
        if not station_id:
            return {"station": station, "station_id": None, "observations": []}
        try:
            observations = await asyncio.wait_for(
                get_metar_data(station_id, start_date, end_date),
                timeout=per_station_timeout_s,
            )
            return {"station": station, "station_id": station_id, "observations": observations}
        except Exception as exc:
            print(f"Station fetch timeout/error for {station_id}: {exc}")
            return {"station": station, "station_id": station_id, "observations": []}

    return await asyncio.gather(*[_fetch(station) for station in selected_stations])


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


def analyze_wind_events(observations: List[Dict], threshold_mph: float = 25.0) -> List[Dict]:
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


def parse_observation_timestamp(timestamp: Optional[str]) -> Optional[datetime]:
    """Parse multiple ASOS/METAR timestamp formats into a UTC datetime."""
    if not timestamp:
        return None

    raw = str(timestamp).strip()
    if not raw:
        return None

    # Common IEM format: "YYYY-MM-DD HH:MM" and variants with timezone suffixes
    if " " in raw:
        try:
            normalized = raw.split("+")[0].replace("Z", "").strip()
            return datetime.strptime(normalized, "%Y-%m-%d %H:%M")
        except Exception:
            pass

    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        return None


def score_candidate_confidence(peak_wind_mph: float, station_count: int) -> str:
    """Simple, transparent confidence ladder for DOL candidate ranking."""
    if station_count >= 3 and peak_wind_mph >= 58:
        return "confirmed"
    if station_count >= 2 and peak_wind_mph >= 45:
        return "high"
    if station_count >= 1 and peak_wind_mph >= 30:
        return "medium"
    return "low"


def build_wind_candidates(
    observations: List[Dict],
    station_distance_by_id: Dict[str, float],
    min_wind_mph: float,
    top_n: int,
) -> List[Dict]:
    """
    Build ranked date candidates by collapsing station observations into daily peak clusters.
    """
    by_day: Dict[str, Dict[str, Any]] = {}

    for obs in observations:
        ts = parse_observation_timestamp(obs.get("timestamp"))
        if not ts:
            continue

        station_id = obs.get("station")
        if not station_id:
            continue

        gust = obs.get("wind_gust_mph") or 0.0
        speed = obs.get("wind_speed_mph") or 0.0
        peak_gust = obs.get("peak_wind_gust_mph") or 0.0
        max_wind = max(gust, speed, peak_gust)
        if max_wind < min_wind_mph:
            continue

        date_key = ts.date().isoformat()
        bucket = by_day.setdefault(
            date_key,
            {
                "station_peaks": {},
                "station_observation_counts": {},
            },
        )

        prior_peak = bucket["station_peaks"].get(station_id, 0.0)
        if max_wind > prior_peak:
            bucket["station_peaks"][station_id] = float(max_wind)
        bucket["station_observation_counts"][station_id] = bucket["station_observation_counts"].get(station_id, 0) + 1

    candidates: List[Dict[str, Any]] = []
    for date_key, bucket in by_day.items():
        station_peaks: Dict[str, float] = bucket["station_peaks"]
        if not station_peaks:
            continue

        station_count = len(station_peaks)
        peak_wind = max(station_peaks.values())
        average_peak = sum(station_peaks.values()) / station_count
        weighted_score = round((peak_wind * 0.6) + (average_peak * 0.3) + (station_count * 2.5), 2)

        distances = [
            float(station_distance_by_id[sid])
            for sid in station_peaks.keys()
            if sid in station_distance_by_id
        ]
        min_distance = round(min(distances), 1) if distances else None

        confidence = score_candidate_confidence(peak_wind, station_count)
        candidates.append(
            {
                "candidate_date": date_key,
                "confidence": confidence,
                "peak_wind_mph": round(peak_wind, 1),
                "station_count": station_count,
                "weighted_support_score": weighted_score,
                "min_distance_miles": min_distance,
                "event_summary": (
                    f"{station_count} station(s) recorded up to {round(peak_wind, 1)} mph "
                    f"(avg peak {round(average_peak, 1)} mph)."
                ),
                "report_count": 0,
                "max_hail_inches": None,
            }
        )

    candidates.sort(
        key=lambda row: (
            row.get("peak_wind_mph") or 0.0,
            row.get("station_count") or 0,
            row.get("weighted_support_score") or 0.0,
            row.get("candidate_date") or "",
        ),
        reverse=True,
    )
    return candidates[:top_n]


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

@router.post("/dol/candidates")
async def discover_dol_candidates(
    request: DolCandidateRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Return ranked DOL candidate dates based on station overlap and daily peak signals.
    This endpoint is intentionally lightweight and feeds the frontend candidate timeline.
    """
    geo = await geocode_address(request.address, request.city, request.state, request.zip_code)
    if not geo.get("latitude"):
        raise HTTPException(
            status_code=400,
            detail="Unable to geocode address. Please verify street/city/state/zip."
        )

    lat = float(geo["latitude"])
    lng = float(geo["longitude"])

    stations = await get_nearby_stations(lat, lng)
    if not stations:
        raise HTTPException(status_code=404, detail="No weather stations found near this location.")

    filtered_stations = [
        station for station in stations
        if (station.get("distance_miles") is None or station.get("distance_miles", 0) <= request.max_distance_miles)
    ]
    if not filtered_stations:
        filtered_stations = stations[:5]

    all_observations: List[Dict[str, Any]] = []
    stations_used: List[str] = []
    station_distance_by_id: Dict[str, float] = {}
    station_batches = await fetch_station_observation_bundle(
        filtered_stations,
        request.start_date,
        request.end_date,
        max_stations=3,
        per_station_timeout_s=35.0,
    )

    for batch in station_batches:
        station = batch.get("station") or {}
        station_id = batch.get("station_id")
        observations = batch.get("observations") or []
        if not station_id or not observations:
            continue
        all_observations.extend(observations)
        stations_used.append(station_id)
        if station.get("distance_miles") is not None:
            station_distance_by_id[station_id] = float(station["distance_miles"])

    if request.event_type == "hail":
        # Hail fallback: detect coded hail indicators from METAR weather codes.
        hail_dates: Dict[str, Dict[str, Any]] = {}
        for obs in all_observations:
            weather_codes = str(obs.get("weather_codes") or "").upper()
            if "GR" not in weather_codes and "GS" not in weather_codes:
                continue

            ts = parse_observation_timestamp(obs.get("timestamp"))
            if not ts:
                continue
            date_key = ts.date().isoformat()
            station_id = obs.get("station")

            bucket = hail_dates.setdefault(
                date_key,
                {
                    "stations": set(),
                    "report_count": 0,
                    "min_distance_miles": None,
                },
            )
            if station_id:
                bucket["stations"].add(station_id)
                distance = station_distance_by_id.get(station_id)
                if distance is not None:
                    current_min = bucket["min_distance_miles"]
                    bucket["min_distance_miles"] = distance if current_min is None else min(current_min, distance)
            bucket["report_count"] += 1

        hail_candidates: List[Dict[str, Any]] = []
        for date_key, bucket in hail_dates.items():
            station_count = len(bucket["stations"])
            report_count = bucket["report_count"]
            confidence = "high" if station_count >= 2 else "medium" if report_count >= 2 else "low"
            hail_candidates.append(
                {
                    "candidate_date": date_key,
                    "confidence": confidence,
                    "max_hail_inches": 0.25,
                    "report_count": report_count,
                    "min_distance_miles": round(bucket["min_distance_miles"], 1)
                    if bucket["min_distance_miles"] is not None
                    else None,
                    "event_summary": f"Hail-coded METAR weather at {station_count} station(s), {report_count} coded observation(s).",
                    "peak_wind_mph": 0.0,
                    "station_count": station_count,
                    "weighted_support_score": report_count,
                }
            )

        hail_candidates.sort(
            key=lambda row: (row.get("report_count") or 0, row.get("station_count") or 0, row.get("candidate_date") or ""),
            reverse=True,
        )
        candidates = hail_candidates[:request.top_n]
    else:
        candidates = build_wind_candidates(
            all_observations,
            station_distance_by_id,
            request.min_wind_mph,
            request.top_n,
        )

    return {
        "location": {
            "latitude": lat,
            "longitude": lng,
            "matched_address": geo.get("matched_address"),
            "geocoder": geo.get("geocoder"),
            "precision": geo.get("precision", "address"),
        },
        "candidates": candidates,
        "stations_used": stations_used,
        "station_count": len(stations_used),
        "observation_count": len(all_observations),
        "analysis_window": {
            "start_date": request.start_date,
            "end_date": request.end_date,
            "event_type": request.event_type or "wind",
            "min_wind_mph": request.min_wind_mph,
            "max_distance_miles": request.max_distance_miles,
        },
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
    station_batches = await fetch_station_observation_bundle(
        stations,
        request.start_date,
        request.end_date,
        max_stations=3,
        per_station_timeout_s=35.0,
    )

    for batch in station_batches:
        station = batch.get("station") or {}
        station_id = batch.get("station_id")
        observations = batch.get("observations") or []
        if not station_id or not observations:
            continue

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
                "station_name": station.get("station_name"),
                "distance_miles": station.get("distance_miles"),
                "agency": "NWS/FAA",
                "max_wind_mph": max_wind,
                "observation_count": len(observations),
                "timestamp": request.start_date
            })
    
    # Step 5: Analyze events by peril mode
    peril_mode = (request.event_type or "wind").lower()
    wind_events = analyze_wind_events(all_observations, threshold_mph=20.0)

    hail_observation_by_day: Dict[str, Dict[str, Any]] = {}
    if peril_mode == "hail":
        for obs in all_observations:
            weather_codes = str(obs.get("weather_codes") or "").upper()
            if "GR" not in weather_codes and "GS" not in weather_codes:
                continue

            ts = parse_observation_timestamp(obs.get("timestamp"))
            if not ts:
                continue
            date_key = ts.date().isoformat()
            bucket = hail_observation_by_day.setdefault(
                date_key,
                {
                    "stations": set(),
                    "report_count": 0,
                },
            )
            if obs.get("station"):
                bucket["stations"].add(obs["station"])
            bucket["report_count"] += 1
    
    # Step 6: Determine verified DOL and confidence
    verified_dol = None
    confidence = "unverified"
    event_summary = None
    
    if peril_mode == "hail":
        if hail_observation_by_day:
            ranked_hail_days = sorted(
                hail_observation_by_day.items(),
                key=lambda item: (item[1]["report_count"], len(item[1]["stations"]), item[0]),
                reverse=True,
            )
            top_day, top_stats = ranked_hail_days[0]
            verified_dol = top_day

            station_count = len(top_stats["stations"])
            report_count = top_stats["report_count"]
            if station_count >= 2 and report_count >= 3:
                confidence = "high"
            elif station_count >= 1 and report_count >= 2:
                confidence = "medium"
            else:
                confidence = "low"

            event_summary = (
                f"Hail-coded weather observations detected on {verified_dol}. "
                f"Reports: {report_count}, station overlap: {station_count}. "
                f"Data from authoritative station network: {', '.join(stations_used)}. "
                f"Total observations analyzed: {len(all_observations)}."
            )
        else:
            event_summary = (
                f"No hail-coded station observations detected in the analysis period "
                f"({request.start_date} to {request.end_date}) for this location."
            )
    else:
        if wind_events:
            # Sort by severity and timestamp
            wind_events.sort(key=lambda x: (-x.get("max_wind_mph", 0), x.get("timestamp", "")))
            most_severe = wind_events[0]

            parsed_ts = parse_observation_timestamp(most_severe.get("timestamp"))
            if parsed_ts:
                verified_dol = parsed_ts.strftime("%Y-%m-%d")
            else:
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
        event_type=peril_mode,
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
            "county": verification.county,
            "precision": geo.get("precision", "address"),
            "geocoder": geo.get("geocoder"),
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


@router.get("/imagery/releases")
async def get_historical_imagery_releases(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Proxy Wayback release metadata through backend to avoid browser-side CORS/rate issues.
    """
    params = {"f": "pjson"}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(WAYBACK_SELECTION_URL, params=params)
            if response.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Wayback metadata unavailable ({response.status_code})",
                )
            payload = response.json()
            selection = payload.get("Selection", [])
            return {
                "source": "esri_wayback",
                "count": len(selection),
                "selection": selection,
            }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Historical imagery metadata unavailable: {exc}")

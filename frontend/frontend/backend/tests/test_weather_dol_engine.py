import pytest
from fastapi import HTTPException
import sys
from pathlib import Path
import os

os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "eden_claims_test")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from routes import weather


def test_parse_observation_timestamp_handles_supported_formats():
    parsed_space = weather.parse_observation_timestamp("2026-02-10 14:35")
    parsed_iso = weather.parse_observation_timestamp("2026-02-10T14:35:00Z")
    parsed_invalid = weather.parse_observation_timestamp("not-a-time")

    assert parsed_space is not None
    assert parsed_space.strftime("%Y-%m-%d %H:%M") == "2026-02-10 14:35"
    assert parsed_iso is not None
    assert parsed_iso.year == 2026 and parsed_iso.month == 2 and parsed_iso.day == 10
    assert parsed_invalid is None


def test_build_wind_candidates_ranks_by_peak_and_station_overlap():
    observations = [
        {
            "timestamp": "2026-01-12 10:00",
            "station": "KAAA",
            "wind_speed_mph": 22.0,
            "wind_gust_mph": 41.0,
            "peak_wind_gust_mph": 45.0,
        },
        {
            "timestamp": "2026-01-12 11:00",
            "station": "KBBB",
            "wind_speed_mph": 20.0,
            "wind_gust_mph": 39.0,
            "peak_wind_gust_mph": 42.0,
        },
        {
            "timestamp": "2026-01-18 09:00",
            "station": "KAAA",
            "wind_speed_mph": 21.0,
            "wind_gust_mph": 33.0,
            "peak_wind_gust_mph": 34.0,
        },
    ]
    station_distance_by_id = {"KAAA": 1.1, "KBBB": 2.2}

    ranked = weather.build_wind_candidates(
        observations=observations,
        station_distance_by_id=station_distance_by_id,
        min_wind_mph=30.0,
        top_n=10,
    )

    assert len(ranked) == 2
    assert ranked[0]["candidate_date"] == "2026-01-12"
    assert ranked[0]["peak_wind_mph"] == 45.0
    assert ranked[0]["station_count"] == 2
    assert ranked[0]["confidence"] in {"high", "medium", "confirmed"}


@pytest.mark.asyncio
async def test_discover_dol_candidates_wind(monkeypatch):
    async def fake_geocode_address(address, city, state, zip_code):
        return {"latitude": 25.95, "longitude": -80.30, "matched_address": "Matched"}

    async def fake_get_nearby_stations(lat, lng):
        return [
            {"station_id": "KAAA", "station_name": "Station A", "distance_miles": 1.0},
            {"station_id": "KBBB", "station_name": "Station B", "distance_miles": 3.0},
        ]

    async def fake_get_metar_data(station_id, start_date, end_date):
        if station_id == "KAAA":
            return [
                {
                    "timestamp": "2026-01-10 12:00",
                    "station": "KAAA",
                    "wind_speed_mph": 24.0,
                    "wind_gust_mph": 42.0,
                    "peak_wind_gust_mph": 44.0,
                }
            ]
        return [
            {
                "timestamp": "2026-01-10 12:15",
                "station": "KBBB",
                "wind_speed_mph": 20.0,
                "wind_gust_mph": 35.0,
                "peak_wind_gust_mph": 38.0,
            }
        ]

    monkeypatch.setattr(weather, "geocode_address", fake_geocode_address)
    monkeypatch.setattr(weather, "get_nearby_stations", fake_get_nearby_stations)
    monkeypatch.setattr(weather, "get_metar_data", fake_get_metar_data)

    request = weather.DolCandidateRequest(
        address="6433 NW 199th Ter",
        city="Hialeah",
        state="FL",
        zip_code="33015",
        start_date="2026-01-01",
        end_date="2026-02-12",
        event_type="wind",
        top_n=5,
        max_distance_miles=25,
        min_wind_mph=30,
    )
    result = await weather.discover_dol_candidates(request, current_user={"id": "u1"})

    assert result["location"]["latitude"] == 25.95
    assert len(result["candidates"]) >= 1
    assert result["candidates"][0]["candidate_date"] == "2026-01-10"
    assert result["candidates"][0]["peak_wind_mph"] >= 38.0


@pytest.mark.asyncio
async def test_discover_dol_candidates_hail(monkeypatch):
    async def fake_geocode_address(address, city, state, zip_code):
        return {"latitude": 27.77, "longitude": -82.63, "matched_address": "Matched"}

    async def fake_get_nearby_stations(lat, lng):
        return [{"station_id": "KTPA", "station_name": "Station TPA", "distance_miles": 4.0}]

    async def fake_get_metar_data(station_id, start_date, end_date):
        return [
            {"timestamp": "2026-02-01 14:00", "station": "KTPA", "weather_codes": "TSGR"},
            {"timestamp": "2026-02-01 15:00", "station": "KTPA", "weather_codes": "GR"},
        ]

    monkeypatch.setattr(weather, "geocode_address", fake_geocode_address)
    monkeypatch.setattr(weather, "get_nearby_stations", fake_get_nearby_stations)
    monkeypatch.setattr(weather, "get_metar_data", fake_get_metar_data)

    request = weather.DolCandidateRequest(
        address="100 Test Ave",
        city="Tampa",
        state="FL",
        zip_code="33602",
        start_date="2026-01-01",
        end_date="2026-02-12",
        event_type="hail",
        top_n=5,
        max_distance_miles=25,
        min_wind_mph=20,
    )
    result = await weather.discover_dol_candidates(request, current_user={"id": "u1"})

    assert len(result["candidates"]) == 1
    assert result["candidates"][0]["candidate_date"] == "2026-02-01"
    assert result["candidates"][0]["report_count"] == 2


@pytest.mark.asyncio
async def test_verify_dol_uses_hail_mode_and_returns_location(monkeypatch):
    class _FakeCollection:
        def __init__(self):
            self.calls = []

        async def insert_one(self, doc):
            self.calls.append(("insert_one", doc))
            return None

        async def update_one(self, *args, **kwargs):
            self.calls.append(("update_one", args, kwargs))
            return None

    class _FakeDb:
        def __init__(self):
            self.weather_verifications = _FakeCollection()
            self.claims = _FakeCollection()

    async def fake_geocode_address(address, city, state, zip_code):
        return {"latitude": 26.11, "longitude": -80.14}

    async def fake_get_nws_point_data(lat, lng):
        return {"county": "https://api.weather.gov/zones/county/FLC011"}

    async def fake_get_nearby_stations(lat, lng):
        return [{"station_id": "KFLL", "station_name": "Fort Lauderdale", "distance_miles": 1.4}]

    async def fake_get_metar_data(station_id, start_date, end_date):
        return [
            {"timestamp": "2026-02-05 16:00", "station": "KFLL", "weather_codes": "GR"},
            {"timestamp": "2026-02-05 17:00", "station": "KFLL", "weather_codes": "TSGR"},
        ]

    monkeypatch.setattr(weather, "db", _FakeDb())
    monkeypatch.setattr(weather, "geocode_address", fake_geocode_address)
    monkeypatch.setattr(weather, "get_nws_point_data", fake_get_nws_point_data)
    monkeypatch.setattr(weather, "get_nearby_stations", fake_get_nearby_stations)
    monkeypatch.setattr(weather, "get_metar_data", fake_get_metar_data)

    request = weather.WeatherSearchRequest(
        address="100 Test Ave",
        city="Fort Lauderdale",
        state="FL",
        zip_code="33301",
        start_date="2026-01-01",
        end_date="2026-02-12",
        event_type="hail",
    )
    result = await weather.verify_date_of_loss(request, current_user={"email": "ops@eden.test"})

    assert result["verified_dol"] == "2026-02-05"
    assert result["confidence"] in {"medium", "high", "low"}
    assert result["location"]["latitude"] == 26.11
    assert result["location"]["longitude"] == -80.14


@pytest.mark.asyncio
async def test_verify_dol_raises_when_geocode_fails(monkeypatch):
    async def fake_geocode_address(address, city, state, zip_code):
        return {"latitude": None, "longitude": None}

    monkeypatch.setattr(weather, "geocode_address", fake_geocode_address)

    request = weather.WeatherSearchRequest(
        address="Unknown",
        city="Unknown",
        state="FL",
        zip_code="00000",
        start_date="2026-01-01",
        end_date="2026-02-12",
        event_type="wind",
    )

    with pytest.raises(HTTPException) as exc:
        await weather.verify_date_of_loss(request, current_user={"email": "ops@eden.test"})
    assert exc.value.status_code == 400

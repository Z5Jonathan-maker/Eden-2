import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")

from routes.canvassing_map import (
    _find_duplicate_pin,
    _duplicate_pin_response,
    _normalize_pin_coordinates,
    _pin_create_response_from_doc,
)


def test_find_duplicate_pin_returns_closest_candidate():
    candidates = [
        {"id": "far", "latitude": 27.9500, "longitude": -82.4600},
        {"id": "close", "latitude": 27.9501, "longitude": -82.4599},
        {"id": "invalid", "latitude": None, "longitude": -82.4601},
    ]
    duplicate = _find_duplicate_pin(
        latitude=27.95012,
        longitude=-82.45988,
        candidates=candidates,
        max_distance_meters=25,
    )
    assert duplicate is not None
    assert duplicate["pin"]["id"] == "close"
    assert duplicate["distance_m"] < 25


def test_find_duplicate_pin_returns_none_when_outside_threshold():
    candidates = [{"id": "far", "latitude": 27.9500, "longitude": -82.4600}]
    duplicate = _find_duplicate_pin(
        latitude=28.0500,
        longitude=-82.5600,
        candidates=candidates,
        max_distance_meters=25,
    )
    assert duplicate is None


def test_duplicate_pin_response_marks_duplicate_and_rounds_distance():
    duplicate = {
        "pin": {
            "id": "pin-123",
            "address": "123 Main St",
            "disposition": "callback",
            "territory_id": "t-1",
            "created_at": "2026-02-12T00:00:00+00:00",
            "updated_at": "2026-02-12T00:00:10+00:00",
        },
        "latitude": 27.95,
        "longitude": -82.46,
        "distance_m": 12.345,
    }
    response = _duplicate_pin_response(duplicate)
    assert response["duplicate"] is True
    assert response["id"] == "pin-123"
    assert response["duplicate_distance_m"] == 12.3
    assert response["disposition"] == "callback"
    assert response["disposition_info"]["label"] == "Callback"


def test_normalize_pin_coordinates_falls_back_to_legacy_fields():
    pin = {
        "id": "legacy-1",
        "latitude": None,
        "longitude": None,
        "lat": "27.9501",
        "lng": "-82.4599",
    }
    normalized = _normalize_pin_coordinates(pin)
    assert normalized["coords_valid"] is True
    assert normalized["coords_source"] == "lat_lng"
    assert normalized["latitude"] == 27.9501
    assert normalized["longitude"] == -82.4599


def test_pin_create_response_uses_normalized_coordinates():
    pin_doc = {
        "id": "pin-xyz",
        "lat": "27.95",
        "lng": "-82.46",
        "address": "123 Main St",
        "disposition": "appointment",
        "territory_id": "territory-1",
        "created_at": "2026-02-12T00:00:00+00:00",
        "updated_at": "2026-02-12T00:00:00+00:00",
    }
    response = _pin_create_response_from_doc(pin_doc)
    assert response["id"] == "pin-xyz"
    assert response["coords_valid"] is True
    assert response["coords_source"] == "lat_lng"
    assert response["latitude"] == 27.95
    assert response["longitude"] == -82.46
    assert response["disposition_info"]["label"] == "Appointment Set"

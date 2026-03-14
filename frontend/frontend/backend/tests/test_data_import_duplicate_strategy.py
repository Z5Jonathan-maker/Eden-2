import os
import sys

os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from routes.data import _build_duplicate_update_patch


def test_build_duplicate_patch_updates_only_blank_fields():
    existing = {
        "client_name": "Jane Doe",
        "client_email": "",
        "property_address": "123 Main St",
        "policy_number": None,
        "description": "existing notes",
        "estimated_value": 0,
    }
    incoming = {
        "client_name": "New Name Should Not Override",
        "client_email": "jane@example.com",
        "property_address": "456 New Address Should Not Override",
        "policy_number": "POL-123",
        "description": "new notes should not override",
        "estimated_value": 12500.0,
    }

    patch = _build_duplicate_update_patch(existing, incoming)

    assert patch == {
        "client_email": "jane@example.com",
        "policy_number": "POL-123",
        "estimated_value": 12500.0,
    }


def test_build_duplicate_patch_skips_estimated_value_when_existing_positive():
    existing = {
        "estimated_value": 9800.0,
        "client_email": "already@example.com",
    }
    incoming = {
        "estimated_value": 12000.0,
        "client_email": "should-not-override@example.com",
    }

    patch = _build_duplicate_update_patch(existing, incoming)

    assert patch == {}


def test_build_duplicate_patch_ignores_blank_incoming_values():
    existing = {
        "client_email": "",
        "description": "",
        "estimated_value": 0,
    }
    incoming = {
        "client_email": "   ",
        "description": None,
        "estimated_value": 0,
    }

    patch = _build_duplicate_update_patch(existing, incoming)

    assert patch == {}

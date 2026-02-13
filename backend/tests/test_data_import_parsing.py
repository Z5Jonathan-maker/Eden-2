import os
import sys

os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from routes.data import _resolve_field, _parse_numeric, _clean_text, _build_header_mapping


def test_resolve_field_supports_alias_headers():
    row = {
        "Claim #": "ABC-123",
        "Insured Name": "Jane Doe",
        "Loss Address": "123 Main St",
        "DOL": "2025-08-11",
        "Policy #": "POL-9",
    }
    assert _resolve_field(row, "claim_number") == "ABC-123"
    assert _resolve_field(row, "client_name") == "Jane Doe"
    assert _resolve_field(row, "property_address") == "123 Main St"
    assert _resolve_field(row, "date_of_loss") == "2025-08-11"
    assert _resolve_field(row, "policy_number") == "POL-9"


def test_parse_numeric_tolerates_currency_and_commas():
    assert _parse_numeric("$12,345.67") == 12345.67
    assert _parse_numeric(" 1,000 ") == 1000.0
    assert _parse_numeric("N/A") == 0.0
    assert _parse_numeric("") == 0.0


def test_clean_text_converts_nullish_to_blank():
    assert _clean_text(None) == ""
    assert _clean_text("nan") == ""
    assert _clean_text(" NULL ") == ""
    assert _clean_text("value") == "value"


def test_build_header_mapping_marks_unknown_and_known_headers():
    mapping = _build_header_mapping(["Claim #", "Insured Name", "Totally Custom Column"])
    by_source = {item["source_header"]: item for item in mapping}
    assert by_source["Claim #"]["mapped_field"] == "claim_number"
    assert by_source["Insured Name"]["mapped_field"] == "client_name"
    assert by_source["Totally Custom Column"]["mapped_field"] is None

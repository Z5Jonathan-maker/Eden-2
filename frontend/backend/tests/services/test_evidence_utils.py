from datetime import datetime, timezone

from services.evidence.utils import make_dedupe_key, timeline_sort_key


def test_dedupe_key_is_deterministic():
    first = make_dedupe_key("message-id", "checksum", "thread-1")
    second = make_dedupe_key("message-id", "checksum", "thread-1")
    third = make_dedupe_key("message-id", "checksum-x", "thread-1")

    assert first == second
    assert first != third


def test_timeline_sort_key_is_stable():
    occurred = datetime(2026, 2, 1, 12, 0, tzinfo=timezone.utc)
    items = [
        {"event_type": "EMAIL_RECEIVED", "source_id": "b", "occurred_at": occurred.isoformat()},
        {"event_type": "EMAIL_RECEIVED", "source_id": "a", "occurred_at": occurred.isoformat()},
        {"event_type": "NOTE", "source_id": "z", "occurred_at": occurred.isoformat()},
    ]

    sorted_once = sorted(items, key=timeline_sort_key)
    sorted_twice = sorted(items, key=timeline_sort_key)

    assert [item["source_id"] for item in sorted_once] == [item["source_id"] for item in sorted_twice]
    assert sorted_once[0]["source_id"] == "a"
    assert sorted_once[1]["source_id"] == "b"


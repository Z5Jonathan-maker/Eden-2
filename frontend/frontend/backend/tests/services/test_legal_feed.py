"""Tests for LegalFeedService — FL statute scraping and caching."""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.claimpilot.legal_feed import (
    COLLECTION_NAME,
    STALENESS_WARNING_DAYS,
    LegalFeedService,
    _compute_hash,
    _strip_html,
)

# ── Helpers ───────────────────────────────────────────────────────────────────


class _UpsertMockCollection:
    """Minimal async mock collection supporting upsert and meta docs."""

    def __init__(self) -> None:
        self._docs: list[dict] = []

    async def find_one(self, filter_dict: dict) -> Optional[dict]:
        for doc in self._docs:
            if all(doc.get(k) == v for k, v in filter_dict.items()):
                return dict(doc)
        return None

    def find(self, filter_dict: dict = None) -> "_MockCursor":
        filter_dict = filter_dict or {}
        matched = []
        for doc in self._docs:
            if self._matches(doc, filter_dict):
                matched.append(dict(doc))
        return _MockCursor(matched)

    async def update_one(
        self,
        filter_dict: dict,
        update: dict,
        upsert: bool = False,
    ) -> None:
        for doc in self._docs:
            if all(doc.get(k) == v for k, v in filter_dict.items()):
                if "$set" in update:
                    doc.update(update["$set"])
                return
        if upsert and "$set" in update:
            self._docs.append(dict(update["$set"]))

    @staticmethod
    def _matches(doc: dict, filter_dict: dict) -> bool:
        for key, value in filter_dict.items():
            doc_val = doc.get(key)
            if isinstance(value, dict):
                if "$ne" in value:
                    if doc_val == value["$ne"]:
                        return False
                else:
                    if doc_val != value:
                        return False
            else:
                if doc_val != value:
                    return False
        return True


class _MockCursor:
    """Async cursor for _UpsertMockCollection."""

    def __init__(self, docs: list[dict]) -> None:
        self._docs = docs

    async def to_list(self, length: int = 100) -> list[dict]:
        return self._docs[:length]


class _MockDB:
    """Mock database that exposes collections by name or attribute."""

    def __init__(self) -> None:
        self._collections: dict[str, _UpsertMockCollection] = {}

    def __getitem__(self, name: str) -> _UpsertMockCollection:
        if name not in self._collections:
            self._collections[name] = _UpsertMockCollection()
        return self._collections[name]

    def __getattr__(self, name: str) -> _UpsertMockCollection:
        if name.startswith("_"):
            raise AttributeError(name)
        return self[name]


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def mock_db() -> _MockDB:
    return _MockDB()


@pytest.fixture
def service(mock_db: _MockDB) -> LegalFeedService:
    return LegalFeedService(mock_db)


FAKE_STATUTE_HTML = """
<html><body>
<div class="Content">
<h2>627.70131 Claims administration</h2>
<p>The insurer shall acknowledge receipt of a claim within 14 calendar days.</p>
<p>Investigation must begin within 10 business days.</p>
</div>
</body></html>
"""


# ── Tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_sync_stores_statutes(service: LegalFeedService, mock_db: _MockDB) -> None:
    """Mocked HTTP response -> statutes stored in collection."""
    fake_text = "The insurer shall acknowledge receipt of a claim within 14 calendar days."

    with patch.object(
        service,
        "_fetch_statute_text",
        new_callable=AsyncMock,
        return_value=fake_text,
    ):
        result = await service.sync_statutes(force=True)

    assert result["updated"] >= 1
    assert result["errors"] == []

    # Verify at least the first statute is stored
    doc = await mock_db[COLLECTION_NAME].find_one(
        {"statute_number": "627.70131"}
    )
    assert doc is not None
    assert doc["full_text"] == fake_text
    assert doc["content_hash"] == _compute_hash(fake_text)


@pytest.mark.asyncio
async def test_get_statute_by_number(
    service: LegalFeedService, mock_db: _MockDB
) -> None:
    """Store a statute, then retrieve by number."""
    now = datetime.now(timezone.utc)
    await mock_db[COLLECTION_NAME].update_one(
        {"statute_number": "627.428"},
        {
            "$set": {
                "statute_number": "627.428",
                "title": "Attorney fees (prevailing insured)",
                "full_text": "Prevailing insured entitled to fees.",
                "summary": "Attorney fees for prevailing insured.",
                "fetched_at": now,
                "content_hash": _compute_hash("Prevailing insured entitled to fees."),
                "deadlines": [],
            }
        },
        upsert=True,
    )

    doc = await service.get_statute("627.428")
    assert doc is not None
    assert doc["statute_number"] == "627.428"
    assert doc["title"] == "Attorney fees (prevailing insured)"


@pytest.mark.asyncio
async def test_staleness_detection(
    service: LegalFeedService, mock_db: _MockDB
) -> None:
    """Feed with old last_sync should report stale."""
    old_sync = datetime.now(timezone.utc) - timedelta(days=10)
    await mock_db[COLLECTION_NAME].update_one(
        {"_meta": "sync_status"},
        {"$set": {"_meta": "sync_status", "last_sync": old_sync}},
        upsert=True,
    )

    status = await service.check_staleness()
    assert status["is_stale"] is True
    assert status["days_since_sync"] >= STALENESS_WARNING_DAYS


@pytest.mark.asyncio
async def test_staleness_fresh(
    service: LegalFeedService, mock_db: _MockDB
) -> None:
    """Feed synced recently should report not stale."""
    recent = datetime.now(timezone.utc) - timedelta(hours=6)
    await mock_db[COLLECTION_NAME].update_one(
        {"_meta": "sync_status"},
        {"$set": {"_meta": "sync_status", "last_sync": recent}},
        upsert=True,
    )

    status = await service.check_staleness()
    assert status["is_stale"] is False
    assert status["days_since_sync"] == 0


@pytest.mark.asyncio
async def test_sync_with_content_hash(
    service: LegalFeedService, mock_db: _MockDB
) -> None:
    """Unchanged content (same hash) should not be re-stored."""
    fake_text = "Existing statute text unchanged."
    content_hash = _compute_hash(fake_text)

    # Pre-populate the collection with a statute that has the same hash
    await mock_db[COLLECTION_NAME].update_one(
        {"statute_number": "627.70131"},
        {
            "$set": {
                "statute_number": "627.70131",
                "title": "Claims administration",
                "full_text": fake_text,
                "content_hash": content_hash,
                "fetched_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )

    with patch.object(
        service,
        "_fetch_statute_text",
        new_callable=AsyncMock,
        return_value=fake_text,
    ):
        result = await service.sync_statutes(force=False)

    # The statute with matching hash should be counted as unchanged
    assert result["unchanged"] >= 1


@pytest.mark.asyncio
async def test_sync_fallback_on_scrape_failure(
    service: LegalFeedService, mock_db: _MockDB
) -> None:
    """When scraping fails, fallback summaries are stored and errors reported."""
    with patch.object(
        service,
        "_fetch_statute_text",
        new_callable=AsyncMock,
        side_effect=Exception("Connection refused"),
    ):
        result = await service.sync_statutes(force=True)

    assert result["updated"] >= 1
    assert len(result["errors"]) >= 1
    assert "scrape failed" in result["errors"][0]

    # Verify fallback text was stored
    doc = await mock_db[COLLECTION_NAME].find_one(
        {"statute_number": "627.70131"}
    )
    assert doc is not None
    assert doc.get("used_fallback") is True


@pytest.mark.asyncio
async def test_get_all_statutes(
    service: LegalFeedService, mock_db: _MockDB
) -> None:
    """get_all_statutes returns stored statutes, excludes meta docs."""
    fake_text = "Test statute text."

    with patch.object(
        service,
        "_fetch_statute_text",
        new_callable=AsyncMock,
        return_value=fake_text,
    ):
        await service.sync_statutes(force=True)

    statutes = await service.get_all_statutes()
    # Should have at least 8 statutes from the registry
    assert len(statutes) >= 8
    # No meta docs
    assert all(s.get("_meta") != "sync_status" for s in statutes)


def test_strip_html() -> None:
    """HTML tags and entities are properly stripped."""
    html = "<p>Hello &amp; <b>world</b></p>"
    assert _strip_html(html) == "Hello & world"


def test_compute_hash_deterministic() -> None:
    """Same input always produces the same hash."""
    text = "FL Statute 627.70131 full text"
    assert _compute_hash(text) == _compute_hash(text)
    assert _compute_hash(text) != _compute_hash(text + " modified")

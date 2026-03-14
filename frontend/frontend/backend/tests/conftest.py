"""
Shared test fixtures for inspection module tests.

Provides MockCollection/MockDB for unit testing without a live MongoDB,
plus common fixtures for temp directories, mock users, and claims.
"""
import os
import pytest
import uuid
from datetime import datetime, timezone
from typing import Any, Optional


class MockCursor:
    """Chainable async cursor that mimics Motor's AsyncIOMotorCursor."""

    def __init__(self, docs: list[dict]):
        self._docs = docs

    def sort(self, key: str, direction: int = 1):
        reverse = direction == -1
        self._docs = sorted(
            self._docs,
            key=lambda d: d.get(key, ""),
            reverse=reverse,
        )
        return self

    def limit(self, n: int):
        self._docs = self._docs[:n]
        return self

    def skip(self, n: int):
        self._docs = self._docs[n:]
        return self

    async def to_list(self, length: Optional[int] = None):
        if length is not None:
            return self._docs[:length]
        return self._docs

    def __aiter__(self):
        self._iter_index = 0
        return self

    async def __anext__(self):
        if self._iter_index >= len(self._docs):
            raise StopAsyncIteration
        doc = self._docs[self._iter_index]
        self._iter_index += 1
        return doc


class MockCollection:
    """In-memory async mock of a Motor collection."""

    def __init__(self):
        self._docs: list[dict] = []

    async def insert_one(self, doc: dict):
        self._docs.append(dict(doc))

        class Result:
            inserted_id = doc.get("_id", str(uuid.uuid4()))

        return Result()

    async def insert_many(self, docs: list[dict]):
        for doc in docs:
            self._docs.append(dict(doc))

        class Result:
            inserted_ids = [d.get("_id", str(uuid.uuid4())) for d in docs]

        return Result()

    async def find_one(self, filter_dict: dict = None, projection: dict = None) -> Optional[dict]:
        filter_dict = filter_dict or {}
        for doc in self._docs:
            if self._matches(doc, filter_dict):
                return self._project(doc, projection)
        return None

    def find(self, filter_dict: dict = None, projection: dict = None) -> MockCursor:
        filter_dict = filter_dict or {}
        matching = [
            self._project(doc, projection)
            for doc in self._docs
            if self._matches(doc, filter_dict)
        ]
        return MockCursor(matching)

    async def update_one(self, filter_dict: dict, update: dict):
        for doc in self._docs:
            if self._matches(doc, filter_dict):
                if "$set" in update:
                    doc.update(update["$set"])
                if "$inc" in update:
                    for k, v in update["$inc"].items():
                        doc[k] = doc.get(k, 0) + v

                class Result:
                    matched_count = 1
                    modified_count = 1

                return Result()

        class NoResult:
            matched_count = 0
            modified_count = 0

        return NoResult()

    async def delete_one(self, filter_dict: dict):
        for i, doc in enumerate(self._docs):
            if self._matches(doc, filter_dict):
                self._docs.pop(i)

                class Result:
                    deleted_count = 1

                return Result()

        class NoResult:
            deleted_count = 0

        return NoResult()

    async def delete_many(self, filter_dict: dict):
        before = len(self._docs)
        self._docs = [d for d in self._docs if not self._matches(d, filter_dict)]
        removed = before - len(self._docs)

        class Result:
            deleted_count = removed

        return Result()

    async def count_documents(self, filter_dict: dict = None) -> int:
        filter_dict = filter_dict or {}
        return sum(1 for d in self._docs if self._matches(d, filter_dict))

    async def create_index(self, keys, **kwargs):
        pass  # no-op for tests

    def _matches(self, doc: dict, filter_dict: dict) -> bool:
        for key, value in filter_dict.items():
            doc_val = doc.get(key)
            if isinstance(value, dict):
                if "$in" in value:
                    if doc_val not in value["$in"]:
                        return False
                elif "$ne" in value:
                    if doc_val == value["$ne"]:
                        return False
                elif "$gt" in value:
                    if doc_val is None or doc_val <= value["$gt"]:
                        return False
                else:
                    if doc_val != value:
                        return False
            else:
                if doc_val != value:
                    return False
        return True

    def _project(self, doc: dict, projection: dict = None) -> dict:
        if not projection:
            return dict(doc)
        result = {}
        exclude_id = projection.get("_id", 1) == 0
        for key, val in doc.items():
            if key == "_id" and exclude_id:
                continue
            if projection.get(key, 0) == 1 or (not any(v == 1 for v in projection.values() if isinstance(v, int) and v == 1)):
                result[key] = val
        # Simple projection: if _id: 0 is the only projection, return everything else
        if list(projection.keys()) == ["_id"] and exclude_id:
            return {k: v for k, v in doc.items() if k != "_id"}
        return result


class MockDB:
    """Auto-creating mock database — access any collection via attribute."""

    def __init__(self):
        self._collections: dict[str, MockCollection] = {}

    def __getattr__(self, name: str) -> MockCollection:
        if name.startswith("_"):
            raise AttributeError(name)
        if name not in self._collections:
            self._collections[name] = MockCollection()
        return self._collections[name]


@pytest.fixture
def mock_db():
    return MockDB()


@pytest.fixture
def temp_photo_dir(tmp_path):
    """Temp directory for photo files."""
    photo_dir = tmp_path / "photos"
    photo_dir.mkdir()
    return str(photo_dir)


@pytest.fixture
def mock_user():
    return {
        "id": "user-001",
        "email": "inspector@eden.com",
        "name": "Jane Inspector",
        "role": "adjuster",
    }


@pytest.fixture
def mock_claim():
    return {
        "id": "claim-abc-123",
        "claim_number": "CLM-2025-0042",
        "client_name": "John Doe",
        "insured_name": "John Doe",
        "property_address": "123 Main St, Springfield, IL 62701",
        "loss_location": "123 Main St, Springfield, IL 62701",
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

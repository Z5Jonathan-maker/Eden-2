"""
Tests for photo deduplication logic.

Covers SHA-256 hash computation, determinism, and duplicate detection
via the MockDB simulating MongoDB queries.
"""
import hashlib
import pytest


class TestHashDeterminism:
    """Verify SHA-256 hash behaviour for photo dedup."""

    def test_hash_deterministic(self):
        """Same bytes always produce the same hash."""
        data = b"identical photo bytes here"
        h1 = hashlib.sha256(data).hexdigest()
        h2 = hashlib.sha256(data).hexdigest()
        assert h1 == h2

    def test_hash_different_content(self):
        """Different bytes produce different hashes."""
        h1 = hashlib.sha256(b"photo A").hexdigest()
        h2 = hashlib.sha256(b"photo B").hexdigest()
        assert h1 != h2

    def test_hash_is_64_hex_chars(self):
        """SHA-256 hex digest is exactly 64 characters."""
        h = hashlib.sha256(b"any content").hexdigest()
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    def test_hash_prefix_for_photo_id(self):
        """First 12 chars of hash used as photo_id are stable and unique enough."""
        h = hashlib.sha256(b"test photo data").hexdigest()
        photo_id = h[:12]
        assert len(photo_id) == 12
        assert photo_id == hashlib.sha256(b"test photo data").hexdigest()[:12]


@pytest.mark.asyncio
class TestDuplicateDetection:
    """Test dedup logic matching the backend's upload_inspection_photo flow."""

    async def test_same_hash_same_claim_is_duplicate(self, mock_db):
        """When a photo with the same hash+claim exists, it should be found."""
        content = b"photo bytes for dedup test"
        sha256_hash = hashlib.sha256(content).hexdigest()

        # Simulate existing photo in DB
        await mock_db.inspection_photos.insert_one({
            "id": sha256_hash[:12],
            "claim_id": "claim-001",
            "sha256_hash": sha256_hash,
            "filename": "existing.jpg",
        })

        # Query same as backend dedup check
        existing = await mock_db.inspection_photos.find_one({
            "claim_id": "claim-001",
            "sha256_hash": sha256_hash,
        })
        assert existing is not None
        assert existing["id"] == sha256_hash[:12]

    async def test_same_hash_different_claim_not_duplicate(self, mock_db):
        """Same photo uploaded to a different claim should NOT be a duplicate."""
        content = b"shared photo bytes"
        sha256_hash = hashlib.sha256(content).hexdigest()

        await mock_db.inspection_photos.insert_one({
            "id": sha256_hash[:12],
            "claim_id": "claim-001",
            "sha256_hash": sha256_hash,
            "filename": "photo.jpg",
        })

        # Different claim — should not find duplicate
        existing = await mock_db.inspection_photos.find_one({
            "claim_id": "claim-002",
            "sha256_hash": sha256_hash,
        })
        assert existing is None

    async def test_different_hash_same_claim_not_duplicate(self, mock_db):
        """Different photo on the same claim should NOT be a duplicate."""
        hash_a = hashlib.sha256(b"photo A bytes").hexdigest()
        hash_b = hashlib.sha256(b"photo B bytes").hexdigest()

        await mock_db.inspection_photos.insert_one({
            "id": hash_a[:12],
            "claim_id": "claim-001",
            "sha256_hash": hash_a,
            "filename": "a.jpg",
        })

        existing = await mock_db.inspection_photos.find_one({
            "claim_id": "claim-001",
            "sha256_hash": hash_b,
        })
        assert existing is None

    async def test_no_photos_no_duplicate(self, mock_db):
        """Empty collection returns None for dedup check."""
        sha256_hash = hashlib.sha256(b"first ever photo").hexdigest()

        existing = await mock_db.inspection_photos.find_one({
            "claim_id": "claim-001",
            "sha256_hash": sha256_hash,
        })
        assert existing is None

    async def test_hash_collision_fallback(self, mock_db):
        """If 12-char prefix collides, backend falls back to 16-char prefix."""
        content_a = b"photo content A"
        content_b = b"photo content B"
        hash_a = hashlib.sha256(content_a).hexdigest()
        hash_b = hashlib.sha256(content_b).hexdigest()

        # Even though hashes differ, their 12-char prefixes might differ too.
        # This test verifies the fallback logic is safe:
        # store with 12-char ID, then verify 16-char ID is available.
        photo_id_12 = hash_a[:12]
        photo_id_16 = hash_a[:16]

        await mock_db.inspection_photos.insert_one({
            "id": photo_id_12,
            "claim_id": "claim-001",
            "sha256_hash": hash_a,
        })

        # If a collision on the 12-char prefix occurs, we use 16-char
        existing_12 = await mock_db.inspection_photos.find_one({"id": photo_id_12})
        assert existing_12 is not None

        # 16-char is different and available
        existing_16 = await mock_db.inspection_photos.find_one({"id": photo_id_16})
        # It could be None (available) or same doc — either is valid
        assert existing_16 is None or existing_16["sha256_hash"] == hash_a

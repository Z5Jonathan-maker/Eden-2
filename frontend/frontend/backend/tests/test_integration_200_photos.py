"""
Integration test: 200 synthetic photos across 10 rooms.

Verifies the full PDF generation pipeline handles large photo sets
within email-safe constraints and produces correct output.
"""
import hashlib
import os
import sys
import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.inspection_pdf_service import (
    build_pdf_story,
    build_single_pdf,
    deduplicate_photos,
    preflight_check,
    generate_email_safe_output,
    EMAIL_SAFE_TARGET_SIZE,
)

try:
    from PIL import Image as PILImage
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

ROOMS = [
    "Kitchen", "Living Room", "Master Bedroom", "Guest Bedroom",
    "Bathroom 1", "Bathroom 2", "Garage", "Roof", "Exterior Front", "Basement",
]

CLAIM_ID = "claim-integration-200"
CLAIM = {
    "id": CLAIM_ID,
    "claim_number": "CLM-INT-200",
    "client_name": "Integration Test Client",
    "property_address": "789 Test Blvd, Testville, TX 75001",
}
USER = {"name": "Integration Tester", "email": "integration@eden.com"}


@pytest.fixture(scope="module")
def photo_setup(tmp_path_factory):
    """Generate 200 synthetic 320x240 images across 10 rooms. Module-scoped for speed."""
    if not HAS_PIL:
        pytest.skip("PIL required for integration tests")

    tmp_path = tmp_path_factory.mktemp("integration")
    photo_dir = str(tmp_path / "photos")
    claim_dir = os.path.join(photo_dir, CLAIM_ID)
    os.makedirs(claim_dir, exist_ok=True)

    photos = []
    for i in range(200):
        room = ROOMS[i % len(ROOMS)]
        filename = f"int_photo_{i:03d}.jpg"

        # Deterministic color from index
        r = (i * 37 + 50) % 256
        g = (i * 73 + 100) % 256
        b = (i * 113 + 150) % 256

        img = PILImage.new("RGB", (320, 240), (r, g, b))
        img.save(os.path.join(claim_dir, filename), "JPEG", quality=85)

        # Compute hash for dedup testing
        with open(os.path.join(claim_dir, filename), "rb") as f:
            sha256_hash = hashlib.sha256(f.read()).hexdigest()

        photos.append({
            "id": sha256_hash[:12],
            "claim_id": CLAIM_ID,
            "filename": filename,
            "room": room,
            "category": "documentation",
            "captured_at": f"2025-07-{(i % 28) + 1:02d}T{(i % 24):02d}:{(i % 60):02d}:00Z",
            "sha256_hash": sha256_hash,
        })

    return photos, photo_dir


class TestIntegration200Photos:
    """Full pipeline tests with 200 photos."""

    def test_photo_count_matches(self, photo_setup):
        """All 200 photos were generated."""
        photos, _ = photo_setup
        assert len(photos) == 200

    def test_all_rooms_represented(self, photo_setup):
        """All 10 rooms have photos."""
        photos, _ = photo_setup
        rooms_found = {p["room"] for p in photos}
        assert rooms_found == set(ROOMS)

    def test_all_hashes_unique(self, photo_setup):
        """All 200 photos have unique hashes (no collisions)."""
        photos, _ = photo_setup
        hashes = [p["sha256_hash"] for p in photos]
        assert len(set(hashes)) == 200

    def test_all_ids_unique(self, photo_setup):
        """All 200 photo IDs (hash[:12]) are unique."""
        photos, _ = photo_setup
        ids = [p["id"] for p in photos]
        assert len(set(ids)) == 200

    def test_dedup_preserves_all_200(self, photo_setup):
        """Deduplication with all unique photos keeps all 200."""
        photos, _ = photo_setup
        deduped = deduplicate_photos(photos)
        assert len(deduped) == 200

    def test_dedup_removes_actual_dupes(self, photo_setup):
        """Adding duplicates and deduplicating removes them."""
        photos, _ = photo_setup
        # Add 10 duplicates
        dupes = photos[:10]
        combined = photos + dupes
        assert len(combined) == 210
        deduped = deduplicate_photos(combined)
        assert len(deduped) == 200

    def test_preflight_all_files_present(self, photo_setup):
        """Preflight check passes for all 200 photos."""
        photos, photo_dir = photo_setup
        result = preflight_check(photos, photo_dir, CLAIM_ID, "email_safe")
        assert result["ok"] is True
        assert result["missing_files"] == 0
        assert result["photo_count"] == 200

    def test_email_safe_pdf_generates(self, photo_setup):
        """Email-safe PDF generates without error for 200 photos."""
        photos, photo_dir = photo_setup
        by_room = {}
        for p in photos:
            by_room.setdefault(p["room"], []).append(p)

        story = build_pdf_story(
            by_room, photos, CLAIM, USER,
            mode="email_safe", photo_dir=photo_dir, claim_id=CLAIM_ID,
        )
        pdf_buf = build_single_pdf(story)
        assert pdf_buf.getbuffer().nbytes > 0
        assert pdf_buf.getvalue()[:5] == b"%PDF-"

    def test_email_safe_pdf_under_15mb(self, photo_setup):
        """Email-safe PDF for 200 320x240 photos must be under 15 MB."""
        photos, photo_dir = photo_setup
        by_room = {}
        for p in photos:
            by_room.setdefault(p["room"], []).append(p)

        buf, content_type = generate_email_safe_output(
            by_room, photos, CLAIM, USER,
            photo_dir=photo_dir, claim_id=CLAIM_ID,
        )
        size = buf.getbuffer().nbytes
        # Whether single PDF or ZIP, should be under target
        assert size <= EMAIL_SAFE_TARGET_SIZE, (
            f"Output is {size / (1024*1024):.1f} MB, target is "
            f"{EMAIL_SAFE_TARGET_SIZE / (1024*1024):.0f} MB"
        )

    def test_full_fidelity_pdf_generates(self, photo_setup):
        """Full-fidelity PDF generates without error for 200 photos."""
        photos, photo_dir = photo_setup
        by_room = {}
        for p in photos:
            by_room.setdefault(p["room"], []).append(p)

        story = build_pdf_story(
            by_room, photos, CLAIM, USER,
            mode="full_fidelity", photo_dir=photo_dir, claim_id=CLAIM_ID,
        )
        pdf_buf = build_single_pdf(story)
        assert pdf_buf.getbuffer().nbytes > 0

    def test_email_safe_smaller_than_full_fidelity(self, photo_setup):
        """Email-safe output should be smaller than full-fidelity."""
        photos, photo_dir = photo_setup
        by_room = {}
        for p in photos:
            by_room.setdefault(p["room"], []).append(p)

        es_story = build_pdf_story(
            by_room, photos, CLAIM, USER,
            mode="email_safe", photo_dir=photo_dir, claim_id=CLAIM_ID,
        )
        es_buf = build_single_pdf(es_story)

        ff_story = build_pdf_story(
            by_room, photos, CLAIM, USER,
            mode="full_fidelity", photo_dir=photo_dir, claim_id=CLAIM_ID,
        )
        ff_buf = build_single_pdf(ff_story)

        assert es_buf.getbuffer().nbytes < ff_buf.getbuffer().nbytes


# ── Smoke test checklist (manual verification) ──────────────────────────
#
# 1. Create session → status "in_progress"
# 2. Capture 3+ photos → appear in gallery
# 3. Upload duplicate → dedup returns existing, no new entry
# 4. Bulk delete → removed from gallery
# 5. Export Email Safe PDF → downloads, ≤ 15 MB
# 6. Export Full Fidelity PDF → downloads, higher quality
# 7. Complete inspection → status "completed"
# 8. Generate AI report → graceful degradation if no API key

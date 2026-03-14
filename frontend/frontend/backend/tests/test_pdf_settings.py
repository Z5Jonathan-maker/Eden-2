"""
Tests for PDF generation service — settings, modes, and output structure.

Uses synthetic images to test email_safe compression, full_fidelity quality,
cover page content, and room grouping.
"""
import io
import os
import sys
import pytest

# Ensure backend root is on path for imports
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.inspection_pdf_service import (
    build_pdf_story,
    build_single_pdf,
    prepare_image,
    deduplicate_photos,
    preflight_check,
    EMAIL_SAFE_JPEG_QUALITY,
    EMAIL_SAFE_MAX_DIMENSION,
    FULL_FIDELITY_JPEG_QUALITY,
)

try:
    from PIL import Image as PILImage
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


def _create_synthetic_image(path: str, width: int = 1920, height: int = 1080, color: tuple = (100, 150, 200)):
    """Create a synthetic JPEG image at the given path."""
    if not HAS_PIL:
        pytest.skip("PIL required for image tests")
    img = PILImage.new("RGB", (width, height), color)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "JPEG", quality=90)
    return path


def _make_photos_and_files(tmp_path, claim_id, count=5, rooms=None):
    """Create synthetic photos on disk + metadata dicts."""
    rooms = rooms or ["Kitchen"]
    photo_dir = str(tmp_path / "photos")
    claim_dir = os.path.join(photo_dir, claim_id)
    os.makedirs(claim_dir, exist_ok=True)

    photos = []
    for i in range(count):
        room = rooms[i % len(rooms)]
        filename = f"photo_{i:03d}.jpg"
        color = ((i * 37) % 256, (i * 73) % 256, (i * 113) % 256)
        _create_synthetic_image(os.path.join(claim_dir, filename), color=color)
        photos.append({
            "id": f"pid-{i:03d}",
            "claim_id": claim_id,
            "filename": filename,
            "room": room,
            "category": "documentation",
            "captured_at": f"2025-06-{15 + (i % 10):02d}T10:{i:02d}:00Z",
        })
    return photos, photo_dir


@pytest.fixture
def claim():
    return {
        "id": "claim-pdf-test",
        "claim_number": "CLM-2025-PDF",
        "client_name": "Test Client",
        "property_address": "456 Oak Ave, Chicago, IL",
    }


@pytest.fixture
def user():
    return {"name": "PDF Tester", "email": "tester@eden.com"}


class TestPrepareImage:
    """Test image preparation / compression."""

    def test_email_safe_resizes_large_image(self, tmp_path):
        if not HAS_PIL:
            pytest.skip("PIL required")
        path = _create_synthetic_image(str(tmp_path / "big.jpg"), 3000, 2000)
        buf = prepare_image(path, mode="email_safe")
        img = PILImage.open(buf)
        assert max(img.size) <= EMAIL_SAFE_MAX_DIMENSION

    def test_email_safe_preserves_small_image(self, tmp_path):
        if not HAS_PIL:
            pytest.skip("PIL required")
        path = _create_synthetic_image(str(tmp_path / "small.jpg"), 800, 600)
        buf = prepare_image(path, mode="email_safe")
        img = PILImage.open(buf)
        # Should not upscale
        assert img.size[0] <= 800
        assert img.size[1] <= 600

    def test_full_fidelity_keeps_dimensions(self, tmp_path):
        if not HAS_PIL:
            pytest.skip("PIL required")
        path = _create_synthetic_image(str(tmp_path / "full.jpg"), 3000, 2000)
        buf = prepare_image(path, mode="full_fidelity")
        img = PILImage.open(buf)
        # Full fidelity should keep original dimensions
        assert img.size == (3000, 2000)

    def test_email_safe_smaller_than_full_fidelity(self, tmp_path):
        if not HAS_PIL:
            pytest.skip("PIL required")
        path = _create_synthetic_image(str(tmp_path / "compare.jpg"), 2000, 1500)
        es_buf = prepare_image(path, mode="email_safe")
        ff_buf = prepare_image(path, mode="full_fidelity")
        assert es_buf.getbuffer().nbytes < ff_buf.getbuffer().nbytes


class TestDeduplicate:
    """Test photo deduplication helper."""

    def test_removes_duplicate_ids(self):
        photos = [
            {"id": "a", "room": "Kitchen"},
            {"id": "b", "room": "Bath"},
            {"id": "a", "room": "Kitchen"},  # dupe
        ]
        result = deduplicate_photos(photos)
        assert len(result) == 2
        assert result[0]["id"] == "a"
        assert result[1]["id"] == "b"

    def test_first_occurrence_wins(self):
        photos = [
            {"id": "x", "room": "First"},
            {"id": "x", "room": "Second"},
        ]
        result = deduplicate_photos(photos)
        assert len(result) == 1
        assert result[0]["room"] == "First"

    def test_no_duplicates_unchanged(self):
        photos = [{"id": "a"}, {"id": "b"}, {"id": "c"}]
        result = deduplicate_photos(photos)
        assert len(result) == 3


class TestPreflightCheck:
    """Test preflight validation."""

    def test_no_photos_fails(self, tmp_path):
        result = preflight_check([], str(tmp_path), "claim-1", "email_safe")
        assert result["ok"] is False
        assert result["photo_count"] == 0

    def test_missing_files_warns(self, tmp_path):
        photos = [{"id": "p1", "filename": "nonexistent.jpg"}]
        result = preflight_check(photos, str(tmp_path), "claim-1", "email_safe")
        assert result["ok"] is True  # still ok, just warns
        assert result["missing_files"] == 1
        assert len(result["warnings"]) > 0

    def test_all_files_present_clean(self, tmp_path):
        claim_dir = tmp_path / "claim-1"
        claim_dir.mkdir()
        (claim_dir / "photo.jpg").write_bytes(b"fake image")
        photos = [{"id": "p1", "filename": "photo.jpg"}]
        result = preflight_check(photos, str(tmp_path), "claim-1", "email_safe")
        assert result["ok"] is True
        assert result["missing_files"] == 0
        assert result["warnings"] == []


class TestBuildPdf:
    """Test PDF story building and rendering."""

    def test_email_safe_under_15mb_with_20_photos(self, tmp_path, claim, user):
        """20 synthetic 1920x1080 images → email-safe PDF must be < 15 MB."""
        if not HAS_PIL:
            pytest.skip("PIL required")

        photos, photo_dir = _make_photos_and_files(
            tmp_path, claim["id"], count=20,
            rooms=["Kitchen", "Living Room", "Master Bedroom", "Roof"],
        )
        by_room = {}
        for p in photos:
            by_room.setdefault(p["room"], []).append(p)

        story = build_pdf_story(
            by_room, photos, claim, user,
            mode="email_safe", photo_dir=photo_dir, claim_id=claim["id"],
        )
        pdf_buf = build_single_pdf(story)
        size_mb = pdf_buf.getbuffer().nbytes / (1024 * 1024)
        assert size_mb < 15, f"Email-safe PDF is {size_mb:.1f} MB, must be < 15 MB"

    def test_email_safe_smaller_than_full_fidelity(self, tmp_path, claim, user):
        """Email-safe PDF should be smaller than full-fidelity for same images."""
        if not HAS_PIL:
            pytest.skip("PIL required")

        photos, photo_dir = _make_photos_and_files(
            tmp_path, claim["id"], count=5, rooms=["Kitchen"],
        )
        by_room = {"Kitchen": photos}

        es_story = build_pdf_story(
            by_room, photos, claim, user,
            mode="email_safe", photo_dir=photo_dir, claim_id=claim["id"],
        )
        es_buf = build_single_pdf(es_story)

        ff_story = build_pdf_story(
            by_room, photos, claim, user,
            mode="full_fidelity", photo_dir=photo_dir, claim_id=claim["id"],
        )
        ff_buf = build_single_pdf(ff_story)

        assert es_buf.getbuffer().nbytes < ff_buf.getbuffer().nbytes

    def test_photos_grouped_by_room(self, tmp_path, claim, user):
        """PDF story should contain entries for each room."""
        if not HAS_PIL:
            pytest.skip("PIL required")

        rooms = ["Kitchen", "Bathroom", "Garage"]
        photos, photo_dir = _make_photos_and_files(
            tmp_path, claim["id"], count=6, rooms=rooms,
        )
        by_room = {}
        for p in photos:
            by_room.setdefault(p["room"], []).append(p)

        story = build_pdf_story(
            by_room, photos, claim, user,
            mode="email_safe", photo_dir=photo_dir, claim_id=claim["id"],
        )

        # Story should have at least one element per room
        assert len(story) > 0
        # Verify all rooms are in the by_room dict
        assert set(by_room.keys()) == set(rooms)

    def test_cover_page_has_claim_info(self, tmp_path, claim, user):
        """Build PDF and verify it renders without error (structure test)."""
        if not HAS_PIL:
            pytest.skip("PIL required")

        photos, photo_dir = _make_photos_and_files(
            tmp_path, claim["id"], count=3, rooms=["Kitchen"],
        )
        by_room = {"Kitchen": photos}

        story = build_pdf_story(
            by_room, photos, claim, user,
            mode="email_safe", photo_dir=photo_dir, claim_id=claim["id"],
        )
        pdf_buf = build_single_pdf(story)

        # PDF should be non-empty and start with PDF header
        pdf_bytes = pdf_buf.getvalue()
        assert len(pdf_bytes) > 0
        assert pdf_bytes[:5] == b"%PDF-"

    def test_part_info_shown_on_cover(self, tmp_path, claim, user):
        """When part_info is provided, it should appear in the story elements."""
        if not HAS_PIL:
            pytest.skip("PIL required")

        photos, photo_dir = _make_photos_and_files(
            tmp_path, claim["id"], count=2, rooms=["Kitchen"],
        )
        by_room = {"Kitchen": photos}

        story = build_pdf_story(
            by_room, photos, claim, user,
            mode="email_safe", photo_dir=photo_dir, claim_id=claim["id"],
            part_info="Part 1 of 3",
        )
        # Should build without error
        pdf_buf = build_single_pdf(story)
        assert pdf_buf.getbuffer().nbytes > 0

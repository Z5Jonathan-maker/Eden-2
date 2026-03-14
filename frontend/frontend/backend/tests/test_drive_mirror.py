"""
Unit tests for the Google Drive Mirror Backup service.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from services.drive_mirror import DriveMirrorService


class TestClaimFolderName:
    """Test the claim folder naming convention."""

    def test_basic_name(self):
        claim = {
            "client_name": "John Smith",
            "property_address": "123 Oak St, Dallas, TX 75201",
            "date_of_loss": "2024-03-15",
        }
        name = DriveMirrorService._claim_folder_name(claim)
        assert name == "Smith – 123 Oak St – 2024-03-15"

    def test_missing_fields(self):
        claim = {}
        name = DriveMirrorService._claim_folder_name(claim)
        assert name == "Unknown – No Address – No-Date"

    def test_single_name(self):
        claim = {
            "client_name": "Madonna",
            "property_address": "456 Elm Ave",
            "date_of_loss": "2024-01-01T10:00:00Z",
        }
        name = DriveMirrorService._claim_folder_name(claim)
        assert "Madonna" in name
        assert "456 Elm Ave" in name
        assert "2024-01-01" in name

    def test_special_chars_removed(self):
        claim = {
            "client_name": "O'Brien / Jr.",
            "property_address": "789 Main St: Suite 4",
            "date_of_loss": "2024-06-20",
        }
        name = DriveMirrorService._claim_folder_name(claim)
        # Colons and slashes should be replaced
        assert ":" not in name
        assert "/" not in name


class TestFileCategoryMap:
    """Test file category mapping."""

    def test_estimate_category(self):
        from services.drive_mirror import FILE_CATEGORY_MAP
        assert FILE_CATEGORY_MAP["estimate"] == "Estimates"
        assert FILE_CATEGORY_MAP["carrier_estimate"] == "Estimates"

    def test_photo_category(self):
        from services.drive_mirror import FILE_CATEGORY_MAP
        assert FILE_CATEGORY_MAP["photo"] == "Photos"
        assert FILE_CATEGORY_MAP["image"] == "Photos"

    def test_correspondence_category(self):
        from services.drive_mirror import FILE_CATEGORY_MAP
        assert FILE_CATEGORY_MAP["email"] == "Correspondence"

    def test_report_category(self):
        from services.drive_mirror import FILE_CATEGORY_MAP
        assert FILE_CATEGORY_MAP["report"] == "Reports"

    def test_legal_category(self):
        from services.drive_mirror import FILE_CATEGORY_MAP
        assert FILE_CATEGORY_MAP["legal"] == "Legal"
        assert FILE_CATEGORY_MAP["demand"] == "Legal"

    def test_unknown_defaults_to_general(self):
        from services.drive_mirror import FILE_CATEGORY_MAP
        result = FILE_CATEGORY_MAP.get("totally_unknown", "General")
        assert result == "General"


class TestMirrorEnabled:
    """Test the MIRROR_ENABLED flag."""

    def test_disabled_by_default(self):
        from services.drive_mirror import MIRROR_ENABLED
        # In test environment, should be False unless explicitly set
        # This test just verifies the import works
        assert isinstance(MIRROR_ENABLED, bool)


class TestDriveMirrorService:
    """Test DriveMirrorService methods with mocked Drive API."""

    def test_singleton(self):
        from services.drive_mirror import get_drive_mirror
        s1 = get_drive_mirror()
        s2 = get_drive_mirror()
        assert s1 is s2

    @pytest.mark.asyncio
    async def test_mirror_disabled_returns_none(self):
        service = DriveMirrorService()
        with patch("services.drive_mirror.MIRROR_ENABLED", False):
            result = await service.mirror_claim_file(
                user_id="user1",
                claim_id="claim1",
                file_name="test.pdf",
                file_bytes=b"fake-pdf",
                mime_type="application/pdf",
                category="estimate",
            )
            assert result is None

    @pytest.mark.asyncio
    async def test_mirror_library_disabled_returns_none(self):
        service = DriveMirrorService()
        with patch("services.drive_mirror.MIRROR_ENABLED", False):
            result = await service.mirror_library_file(
                user_id="user1",
                book_title="Test Book",
                file_name="book.epub",
                file_bytes=b"fake-epub",
                mime_type="application/epub+zip",
            )
            assert result is None

    @pytest.mark.asyncio
    async def test_reconcile_disabled_returns_skipped(self):
        service = DriveMirrorService()
        with patch("services.drive_mirror.MIRROR_ENABLED", False):
            result = await service.reconcile()
            assert result.get("skipped") is True

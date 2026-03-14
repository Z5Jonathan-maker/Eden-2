"""
Unit tests for DocumentSegmenter — page classification + vendor detection.
Uses synthetic PDFs built with reportlab.
"""
import pytest
import io

# ---------------------------------------------------------------------------
# Helpers to generate minimal test PDFs
# ---------------------------------------------------------------------------

def _make_pdf(pages_text: list[str]) -> bytes:
    """Create a minimal PDF with *pages_text* (one string per page)."""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
    except ImportError:
        pytest.skip("reportlab not installed")

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    for text in pages_text:
        y = 750
        for line in text.split("\n"):
            c.drawString(72, y, line)
            y -= 14
            if y < 72:
                break
        c.showPage()
    c.save()
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestPageClassification:
    """Verify individual page classification."""

    def test_estimate_page_detected(self):
        from services.document_segmenter import DocumentSegmenter
        seg = DocumentSegmenter()

        text = (
            "1. Tear off comp. shingles 17.92 SQ 87.23 1,563.16\n"
            "2. Install underlayment 17.92 SQ 12.50 224.00\n"
            "Qty  Unit Price  RCV  ACV  Deprec\n"
            "Roof Covering\n"
        )
        cls = seg._classify_page(text, 0, 0)
        assert cls.page_type == "estimate", f"Expected estimate, got {cls.page_type}"
        assert cls.confidence > 0

    def test_cover_letter_detected(self):
        from services.document_segmenter import DocumentSegmenter
        seg = DocumentSegmenter()

        text = (
            "February 20, 2026\n"
            "Dear Mr. Smith,\n"
            "RE: Claim #12345-ABC\n"
            "Please find enclosed the estimate for your property damage.\n"
            "Sincerely,\n"
            "Jane Doe, Claims Adjuster\n"
        )
        cls = seg._classify_page(text, 0, 0)
        assert cls.page_type == "cover_letter", f"Expected cover_letter, got {cls.page_type}"

    def test_settlement_page_detected(self):
        from services.document_segmenter import DocumentSegmenter
        seg = DocumentSegmenter()

        text = (
            "Settlement Statement\n"
            "Total Claim Payment: $15,432.00\n"
            "Deductible: $2,500.00\n"
            "Net Claim: $12,932.00\n"
            "Check enclosed for the amount payable.\n"
        )
        cls = seg._classify_page(text, 0, 0)
        assert cls.page_type == "settlement", f"Expected settlement, got {cls.page_type}"

    def test_photo_page_detected(self):
        from services.document_segmenter import DocumentSegmenter
        seg = DocumentSegmenter()

        # Very little text, many images
        cls = seg._classify_page("Photo 1", 5, 0)
        assert cls.page_type == "photo_page", f"Expected photo_page, got {cls.page_type}"


class TestVendorDetection:
    """Verify vendor format detection."""

    def test_xactimate_detected(self):
        from services.document_segmenter import DocumentSegmenter
        seg = DocumentSegmenter()

        pages = [
            "Xactimate Estimate\nQty Unit Price RCV ACV\nRFG Roofing\n1. Tear off shingles 17.92 SQ 87.23"
        ]
        vendor, conf = seg._detect_vendor(pages)
        assert vendor == "xactimate"
        assert conf > 0

    def test_symbility_detected(self):
        from services.document_segmenter import DocumentSegmenter
        seg = DocumentSegmenter()

        pages = [
            "CoreLogic Symbility\nClaimXperience Report\nClaims Connect\nSymbility Solutions"
        ]
        vendor, conf = seg._detect_vendor(pages)
        assert vendor == "symbility"

    def test_simsol_detected(self):
        from services.document_segmenter import DocumentSegmenter
        seg = DocumentSegmenter()

        pages = ["Simsol Software\nSimsol Estimating Report\nSimsol"]
        vendor, conf = seg._detect_vendor(pages)
        assert vendor == "simsol"

    def test_unknown_vendor(self):
        from services.document_segmenter import DocumentSegmenter
        seg = DocumentSegmenter()

        pages = ["This is just a random document with no estimating signals."]
        vendor, _ = seg._detect_vendor(pages)
        assert vendor == "unknown"


class TestEstimateRange:
    """Verify contiguous estimate range detection."""

    def test_range_from_classifications(self):
        from services.document_segmenter import DocumentSegmenter, PageClassification
        seg = DocumentSegmenter()

        classifications = [
            PageClassification(0, "cover_letter", 0.6, []),
            PageClassification(1, "cover_letter", 0.5, []),
            PageClassification(2, "estimate", 0.8, []),
            PageClassification(3, "estimate", 0.9, []),
            PageClassification(4, "estimate", 0.7, []),
            PageClassification(5, "photo_page", 0.6, []),
        ]
        start, end = seg._find_estimate_range(classifications)
        assert start == 2
        assert end == 4

    def test_fallback_when_no_estimate_pages(self):
        from services.document_segmenter import DocumentSegmenter, PageClassification
        seg = DocumentSegmenter()

        classifications = [
            PageClassification(0, "cover_letter", 0.3, []),
            PageClassification(1, "unknown", 0.1, []),
        ]
        start, end = seg._find_estimate_range(classifications)
        assert start == 0
        assert end == 1


class TestSegmentIntegration:
    """End-to-end segmentation with synthetic PDFs."""

    def test_segment_cover_plus_estimate(self):
        from services.document_segmenter import segment_document

        cover = (
            "February 20, 2026\n"
            "Dear Mr. Smith,\n"
            "RE: Claim #ABC-123\n"
            "Please find enclosed your estimate.\n"
            "Sincerely, Jane Doe\n"
        )
        estimate = (
            "Xactimate Estimate\n"
            "Qty  Unit Price  RCV  ACV\n"
            "1. Tear off comp. shingles  17.92 SQ  87.23  1,563.16\n"
            "2. Install underlayment  17.92 SQ  12.50  224.00\n"
            "3. Install shingles  17.92 SQ  145.00  2,598.40\n"
            "Roof Covering subtotal\n"
            "RFG category total\n"
        )
        pdf = _make_pdf([cover, estimate])
        result = segment_document(pdf)

        assert result.total_pages == 2
        assert result.estimate_start_page == 1
        assert result.estimate_end_page == 1
        assert result.vendor_format == "xactimate"

"""
Unit tests for the parser factory — vendor routing and fallback logic.
"""
import pytest
import io


def _make_pdf(pages_text: list[str]) -> bytes:
    """Create a minimal PDF with *pages_text*."""
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


class TestParserFactory:
    """Test vendor routing in parse_estimate()."""

    def test_routes_to_xactimate_by_default(self):
        from services.parser_factory import _get_parser
        from services.pdf_parser import XactimateParser

        p = _get_parser("xactimate")
        assert isinstance(p, XactimateParser)

    def test_routes_to_symbility(self):
        from services.parser_factory import _get_parser
        from services.symbility_parser import SymbilityParser

        p = _get_parser("symbility")
        assert isinstance(p, SymbilityParser)

    def test_routes_to_simsol(self):
        from services.parser_factory import _get_parser
        from services.simsol_parser import SimsolParser

        p = _get_parser("simsol")
        assert isinstance(p, SimsolParser)

    def test_unknown_vendor_falls_back(self):
        from services.parser_factory import _get_parser
        from services.pdf_parser import XactimateParser

        p = _get_parser("totally_unknown")
        assert isinstance(p, XactimateParser)


class TestParseEstimate:
    """Integration: parse_estimate with explicit vendor."""

    def test_xactimate_explicit(self):
        from services.parser_factory import parse_estimate

        text = (
            "Xactimate Estimate\n"
            "1. Tear off comp. shingles  17.92 SQ  87.23  0.00  1,563.16\n"
            "Qty  Unit Price  RCV\n"
        )
        pdf = _make_pdf([text])
        est = parse_estimate(pdf, "test.pdf", "carrier", vendor="xactimate")
        assert est.vendor_format == "xactimate"

    def test_page_override(self):
        from services.parser_factory import parse_estimate

        cover = "Dear Mr. Smith, this is a cover letter.\nSincerely, Jane."
        estimate = (
            "Xactimate Estimate\n"
            "1. Tear off comp. shingles  17.92 SQ  87.23  0.00  1,563.16\n"
        )
        pdf = _make_pdf([cover, estimate])
        # Override to only parse page 1 (the estimate page)
        est = parse_estimate(pdf, "test.pdf", "carrier", start_page=1, end_page=1, vendor="xactimate")
        assert est.page_range == (1, 1)


class TestEstimateDataSchema:
    """Verify new fields on EstimateData and LineItem."""

    def test_estimate_data_has_vendor_fields(self):
        from services.pdf_parser import EstimateData

        est = EstimateData(
            file_name="test.pdf",
            estimate_type="carrier",
            vendor_format="symbility",
            page_range=(2, 5),
            detection_confidence=0.85,
        )
        d = est.to_dict()
        assert d["vendor_format"] == "symbility"
        assert d["page_range"] == [2, 5]
        assert d["detection_confidence"] == 0.85

    def test_line_item_has_new_fields(self):
        from services.pdf_parser import LineItem

        item = LineItem(
            line_number=0,
            category="RFG",
            code="RFSHGL",
            description="Tear off shingles",
            quantity=17.92,
            unit="SQ",
            unit_price=87.23,
            total=1563.16,
            original_code="RFSHGL",
            normalized_category="RFG",
        )
        d = item.to_dict()
        assert d["original_code"] == "RFSHGL"
        assert d["normalized_category"] == "RFG"

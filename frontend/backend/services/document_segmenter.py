"""
Document Segmenter Service
Detects estimate page ranges and vendor formats within carrier PDF packages.
Carrier PDFs often include cover letters, settlement letters, photos, and
appendices before/after the actual estimate pages.
"""
import fitz  # PyMuPDF
import re
import logging
from typing import List, Optional, Tuple
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


@dataclass
class PageClassification:
    """Classification result for a single PDF page."""
    page_number: int
    page_type: str  # estimate, cover_letter, settlement, photo_page, appendix, unknown
    confidence: float
    signals: List[str]

    def to_dict(self):
        return asdict(self)


@dataclass
class SegmentResult:
    """Result of document segmentation."""
    estimate_start_page: int  # 0-indexed
    estimate_end_page: int    # 0-indexed, inclusive
    total_pages: int
    vendor_format: str  # xactimate, symbility, simsol, unknown
    confidence: float
    page_classifications: List[PageClassification]

    def to_dict(self):
        return {
            "estimate_start_page": self.estimate_start_page,
            "estimate_end_page": self.estimate_end_page,
            "total_pages": self.total_pages,
            "vendor_format": self.vendor_format,
            "confidence": self.confidence,
            "page_classifications": [p.to_dict() for p in self.page_classifications],
        }


# ---------------------------------------------------------------------------
# Vendor-specific keyword sets
# ---------------------------------------------------------------------------

XACTIMATE_SIGNALS = [
    "xactimate", "xact", "replacement cost value", "actual cash value",
    "rcv", "acv", "deprec", "category total",
    "line item", "subtotal",
]

XACTIMATE_CATEGORY_CODES = [
    "rfg", "dry", "pnt", "flr", "plb", "ele", "win", "dor",
    "cab", "ins", "sid", "gut", "frm", "dem", "cln", "wtr", "hvc",
]

SYMBILITY_SIGNALS = [
    "symbility", "corelogic", "claimxperience", "claims connect",
    "symbility mobile", "symbility solutions",
]

SIMSOL_SIGNALS = [
    "simsol", "simsol software", "simsol estimating",
]

UNIT_TYPES_PATTERN = re.compile(
    r"\b(SQ|SF|LF|SY|EA|HR|CY|GAL|TON|BF|CF|PR|SET|JOB|DAY|MO|WK)\b",
    re.IGNORECASE,
)

ESTIMATE_KEYWORDS = [
    "qty", "unit price", "quantity", "unit cost",
    "tear off", "r&r", "remove and replace", "install",
    "shingle", "underlayment", "flashing", "drip edge",
    "roof covering", "interior", "exterior", "general conditions",
]

COVER_LETTER_KEYWORDS = [
    "dear ", "sincerely", "re:", "regarding:", "enclosed",
    "please find", "attached", "this letter",
]

SETTLEMENT_KEYWORDS = [
    "settlement", "payment", "check enclosed", "remittance",
    "amount payable", "deductible", "coverage a", "coverage b",
    "net claim", "total claim payment",
]


class DocumentSegmenter:
    """Detects estimate page ranges and vendor format within a PDF."""

    def segment(self, pdf_bytes: bytes) -> SegmentResult:
        """Analyse *pdf_bytes* and return segmentation metadata."""
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)

        page_texts: List[str] = []
        page_image_counts: List[int] = []

        for page in doc:
            page_texts.append(page.get_text())
            page_image_counts.append(len(page.get_images()))

        doc.close()

        # Classify every page
        classifications: List[PageClassification] = []
        for idx, text in enumerate(page_texts):
            cls = self._classify_page(text, page_image_counts[idx], idx)
            classifications.append(cls)

        # Detect vendor across all pages
        vendor, vendor_confidence = self._detect_vendor(page_texts)

        # Determine contiguous estimate range
        start, end = self._find_estimate_range(classifications)

        # Overall confidence is the average confidence of estimate pages
        estimate_pages = [c for c in classifications if c.page_type == "estimate"]
        if estimate_pages:
            avg_conf = sum(c.confidence for c in estimate_pages) / len(estimate_pages)
            overall_confidence = round(min(avg_conf, vendor_confidence), 2)
        else:
            overall_confidence = 0.0

        result = SegmentResult(
            estimate_start_page=start,
            estimate_end_page=end,
            total_pages=total_pages,
            vendor_format=vendor,
            confidence=overall_confidence,
            page_classifications=classifications,
        )

        logger.info(
            "Segmented %d-page PDF: estimate pages %d-%d, vendor=%s, confidence=%.2f",
            total_pages, start, end, vendor, overall_confidence,
        )
        return result

    # ------------------------------------------------------------------
    # Page classification
    # ------------------------------------------------------------------

    def _classify_page(self, text: str, image_count: int, page_number: int) -> PageClassification:
        """Classify a single page based on its text content and image count."""
        text_lower = text.lower()
        text_len = len(text.strip())
        signals: List[str] = []
        scores = {
            "estimate": 0.0,
            "cover_letter": 0.0,
            "settlement": 0.0,
            "photo_page": 0.0,
        }

        # --- Estimate signals ---
        unit_hits = len(UNIT_TYPES_PATTERN.findall(text))
        if unit_hits >= 2:
            scores["estimate"] += 0.3
            signals.append(f"unit_types:{unit_hits}")

        kw_hits = sum(1 for kw in ESTIMATE_KEYWORDS if kw in text_lower)
        if kw_hits >= 3:
            scores["estimate"] += 0.3
            signals.append(f"estimate_kw:{kw_hits}")
        elif kw_hits >= 1:
            scores["estimate"] += 0.1

        # Numbered line items  "1. Description"
        numbered = len(re.findall(r"^\s*\d+\.\s+[A-Za-z]", text, re.MULTILINE))
        if numbered >= 2:
            scores["estimate"] += 0.2
            signals.append(f"numbered_items:{numbered}")

        # Dollar amounts pattern
        dollar_hits = len(re.findall(r"\$?\d{1,3}(?:,\d{3})*\.\d{2}", text))
        if dollar_hits >= 4:
            scores["estimate"] += 0.15
            signals.append(f"dollar_amounts:{dollar_hits}")

        # Category codes (Xactimate specific but helpful)
        cat_hits = sum(1 for c in XACTIMATE_CATEGORY_CODES if re.search(rf"\b{c}\b", text_lower))
        if cat_hits >= 2:
            scores["estimate"] += 0.15
            signals.append(f"cat_codes:{cat_hits}")

        # --- Cover letter signals ---
        cl_hits = sum(1 for kw in COVER_LETTER_KEYWORDS if kw in text_lower)
        if cl_hits >= 2:
            scores["cover_letter"] += 0.5
            signals.append(f"cover_letter_kw:{cl_hits}")
        elif cl_hits == 1:
            scores["cover_letter"] += 0.2

        # --- Settlement signals ---
        st_hits = sum(1 for kw in SETTLEMENT_KEYWORDS if kw in text_lower)
        if st_hits >= 2:
            scores["settlement"] += 0.5
            signals.append(f"settlement_kw:{st_hits}")
        elif st_hits == 1:
            scores["settlement"] += 0.2

        # --- Photo page signals ---
        if text_len < 100 and image_count >= 1:
            scores["photo_page"] += 0.6
            signals.append("low_text_high_images")
        elif text_len < 200 and image_count >= 3:
            scores["photo_page"] += 0.5
            signals.append("some_text_many_images")

        # Pick the highest-scoring type
        best_type = max(scores, key=scores.get)
        best_score = scores[best_type]

        if best_score < 0.15:
            best_type = "unknown"
            best_score = 0.0

        return PageClassification(
            page_number=page_number,
            page_type=best_type,
            confidence=round(min(best_score, 1.0), 2),
            signals=signals,
        )

    # ------------------------------------------------------------------
    # Vendor detection
    # ------------------------------------------------------------------

    def _detect_vendor(self, page_texts: List[str]) -> Tuple[str, float]:
        """Detect the estimating software vendor from page texts."""
        combined = "\n".join(page_texts).lower()

        xact_score = sum(1 for s in XACTIMATE_SIGNALS if s in combined)
        sym_score = sum(1 for s in SYMBILITY_SIGNALS if s in combined)
        sim_score = sum(1 for s in SIMSOL_SIGNALS if s in combined)

        # Boost Xactimate if category codes are present
        cat_hits = sum(1 for c in XACTIMATE_CATEGORY_CODES if re.search(rf"\b{c}\b", combined))
        if cat_hits >= 3:
            xact_score += 2

        scores = {
            "xactimate": xact_score,
            "symbility": sym_score,
            "simsol": sim_score,
        }

        best = max(scores, key=scores.get)
        best_val = scores[best]

        if best_val == 0:
            # Fallback heuristic: if we see unit types + dollar amounts, likely Xactimate
            unit_hits = len(UNIT_TYPES_PATTERN.findall(combined))
            if unit_hits >= 5:
                return "xactimate", 0.4
            return "unknown", 0.0

        # Confidence scales with how many signals matched
        confidence = min(best_val / 5.0, 1.0)
        return best, round(confidence, 2)

    # ------------------------------------------------------------------
    # Estimate range detection
    # ------------------------------------------------------------------

    def _find_estimate_range(self, classifications: List[PageClassification]) -> Tuple[int, int]:
        """Find the contiguous range of estimate pages."""
        estimate_indices = [c.page_number for c in classifications if c.page_type == "estimate"]

        if not estimate_indices:
            # Fallback: use all pages
            return 0, max(len(classifications) - 1, 0)

        start = estimate_indices[0]
        end = estimate_indices[-1]

        # Fill small gaps (1-2 pages) between estimate pages — these are likely
        # continuation pages that scored low individually.
        if len(estimate_indices) >= 2:
            for i in range(start, end + 1):
                cls = classifications[i]
                if cls.page_type == "unknown" and cls.confidence < 0.3:
                    cls.page_type = "estimate"
                    cls.confidence = 0.3
                    cls.signals.append("gap_fill")

        return start, end


# Singleton
segmenter = DocumentSegmenter()


def segment_document(pdf_bytes: bytes) -> SegmentResult:
    """Convenience function to segment a PDF document."""
    return segmenter.segment(pdf_bytes)

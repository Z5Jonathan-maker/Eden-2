"""
Symbility PDF Parser Service
Extracts line items from Symbility / CoreLogic ClaimXperience estimate PDFs.
"""
import fitz
import re
import logging
from typing import List, Optional

from services.pdf_parser import BaseParser, EstimateData, LineItem

logger = logging.getLogger(__name__)

# Symbility category names mapped to canonical Xactimate-style codes
SYMBILITY_CATEGORY_MAP = {
    "roofing": "RFG",
    "roof": "RFG",
    "siding": "SID",
    "gutters": "GUT",
    "gutter": "GUT",
    "interior": "GEN",
    "exterior": "EXT",
    "plumbing": "PLB",
    "electrical": "ELE",
    "flooring": "FLR",
    "painting": "PNT",
    "drywall": "DRY",
    "insulation": "INS",
    "framing": "FRM",
    "demolition": "DEM",
    "cleaning": "CLN",
    "windows": "WIN",
    "doors": "DOR",
    "cabinets": "CAB",
    "cabinetry": "CAB",
    "hvac": "HVC",
    "water extraction": "WTR",
    "contents": "CNT",
    "general": "GEN",
}

UNIT_PATTERN = re.compile(
    r"\b(SQ|SF|LF|SY|EA|HR|CY|GAL|TON|BF|CF|PR|SET|JOB|DAY|MO|WK|sq\.?\s*ft|lin\.?\s*ft|each)\b",
    re.IGNORECASE,
)


class SymbilityParser(BaseParser):
    """Parser for Symbility / CoreLogic estimate PDFs."""

    def parse_pdf(
        self,
        pdf_bytes: bytes,
        file_name: str,
        estimate_type: str = "carrier",
        start_page: Optional[int] = None,
        end_page: Optional[int] = None,
    ) -> EstimateData:
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            all_page_texts = [page.get_text() for page in doc]
            doc.close()

            total = len(all_page_texts)
            s = max(0, start_page) if start_page is not None else 0
            e = min(total - 1, end_page) if end_page is not None else total - 1
            page_range = (s, e)

            full_text = "\n".join(all_page_texts[s : e + 1])

            estimate = EstimateData(
                file_name=file_name,
                estimate_type=estimate_type,
                raw_text=full_text,
                vendor_format="symbility",
                page_range=page_range,
            )

            self._extract_header_info("\n".join(all_page_texts), estimate)
            estimate.line_items = self._extract_line_items(full_text)
            self._calculate_totals(estimate)

            logger.info(
                "Symbility parser: %d items, RCV=%.2f from %s",
                len(estimate.line_items), estimate.total_rcv, file_name,
            )
            return estimate

        except Exception as exc:
            logger.error("Error parsing Symbility PDF %s: %s", file_name, exc)
            raise ValueError(f"Failed to parse Symbility PDF: {exc}")

    # ------------------------------------------------------------------
    # Header extraction (Symbility-specific patterns)
    # ------------------------------------------------------------------

    def _extract_header_info(self, text: str, estimate: EstimateData):
        for line in text.split("\n")[:250]:
            line_clean = line.strip()
            line_lower = line_clean.lower()
            if len(line_clean) < 3:
                continue

            if not estimate.claim_number:
                m = re.search(r"claim\s*(?:#|number|no\.?)\s*:?\s*([A-Z0-9][\w\-]+)", line_clean, re.I)
                if m and len(m.group(1)) >= 4:
                    estimate.claim_number = m.group(1)

            if not estimate.insured_name:
                if "insured" in line_lower or "policyholder" in line_lower:
                    m = re.search(r"(?:insured|policyholder)\s*:?\s*(.+)", line_clean, re.I)
                    if m:
                        name = re.sub(r"\s+", " ", m.group(1).strip())
                        if 3 <= len(name) <= 100:
                            estimate.insured_name = name

            if not estimate.date_of_loss and ("date of loss" in line_lower or "loss date" in line_lower):
                m = re.search(r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", line_clean)
                if m:
                    estimate.date_of_loss = m.group(1)

    # ------------------------------------------------------------------
    # Line-item extraction
    # ------------------------------------------------------------------

    def _extract_line_items(self, text: str) -> List[LineItem]:
        items: List[LineItem] = []
        current_section = "General"
        count = 0

        for line in text.split("\n"):
            line = line.strip()
            if not line:
                continue

            # Skip obvious non-data
            if any(s in line.lower() for s in [
                "page ", "total:", "subtotal", "grand total", "coverage",
                "policy", "claim number", "phone", "fax", "email",
            ]):
                continue

            # Section headers
            section_match = re.match(r"^([A-Z][A-Za-z /&]+)$", line)
            if section_match and len(line) < 40 and not UNIT_PATTERN.search(line):
                current_section = section_match.group(1).strip()
                continue

            # Try to parse a line item
            item = self._try_parse_line(line, count, current_section)
            if item:
                items.append(item)
                count += 1

        return items

    def _try_parse_line(self, line: str, idx: int, section: str) -> Optional[LineItem]:
        # Pattern: description  qty  unit  unit_price  total
        m = re.match(
            r"^(.{5,70}?)\s+(\d+(?:\.\d+)?)\s+"
            r"(SQ|SF|LF|SY|EA|HR|CY|GAL|TON|BF|CF|PR|SET|JOB|DAY|MO|WK|sq\.?\s*ft|lin\.?\s*ft|each)"
            r"\s+\$?(\d+(?:,\d{3})*(?:\.\d+)?)\s+\$?(\d+(?:,\d{3})*(?:\.\d+)?)",
            line,
            re.I,
        )
        if m:
            desc = m.group(1).strip()
            if any(h in desc.lower() for h in ["description", "qty", "quantity", "total"]):
                return None

            unit_raw = m.group(3).strip().upper()
            unit = self._normalize_unit(unit_raw)
            total = float(m.group(5).replace(",", ""))
            cat = self._map_category(section)

            return LineItem(
                line_number=idx,
                category=cat,
                code="",
                description=desc,
                quantity=float(m.group(2)),
                unit=unit,
                unit_price=float(m.group(4).replace(",", "")),
                total=total,
                rcv=total,
                room=section,
                raw_text=line,
                original_code="",
                normalized_category=cat,
            )
        return None

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _normalize_unit(unit: str) -> str:
        mapping = {"SQ. FT": "SF", "SQFT": "SF", "SQ FT": "SF", "LIN. FT": "LF", "LIN FT": "LF", "EACH": "EA"}
        return mapping.get(unit, unit)

    @staticmethod
    def _map_category(section: str) -> str:
        key = section.lower().strip()
        return SYMBILITY_CATEGORY_MAP.get(key, "GEN")

    @staticmethod
    def _calculate_totals(estimate: EstimateData):
        categories: dict = {}
        total_rcv = 0.0
        for item in estimate.line_items:
            categories.setdefault(item.category, 0.0)
            categories[item.category] += item.total
            total_rcv += item.rcv if item.rcv else item.total
        estimate.categories = categories
        estimate.total_rcv = total_rcv
        estimate.total_acv = total_rcv

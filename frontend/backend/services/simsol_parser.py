"""
Simsol PDF Parser Service
Extracts line items from Simsol estimating software PDFs.
"""
import fitz
import re
import logging
from typing import List, Optional

from services.pdf_parser import BaseParser, EstimateData, LineItem

logger = logging.getLogger(__name__)

# Simsol section names mapped to canonical category codes
SIMSOL_CATEGORY_MAP = {
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
    "floor": "FLR",
    "painting": "PNT",
    "paint": "PNT",
    "drywall": "DRY",
    "insulation": "INS",
    "framing": "FRM",
    "demolition": "DEM",
    "cleanup": "CLN",
    "cleaning": "CLN",
    "windows": "WIN",
    "doors": "DOR",
    "cabinets": "CAB",
    "hvac": "HVC",
    "water mitigation": "WTR",
    "contents": "CNT",
    "general": "GEN",
    "miscellaneous": "GEN",
}


class SimsolParser(BaseParser):
    """Parser for Simsol estimate PDFs."""

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
                vendor_format="simsol",
                page_range=page_range,
            )

            self._extract_header_info("\n".join(all_page_texts), estimate)
            estimate.line_items = self._extract_line_items(full_text)
            self._calculate_totals(estimate)

            logger.info(
                "Simsol parser: %d items, RCV=%.2f from %s",
                len(estimate.line_items), estimate.total_rcv, file_name,
            )
            return estimate

        except Exception as exc:
            logger.error("Error parsing Simsol PDF %s: %s", file_name, exc)
            raise ValueError(f"Failed to parse Simsol PDF: {exc}")

    # ------------------------------------------------------------------
    # Header extraction
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
                if "insured" in line_lower or "policyholder" in line_lower or "owner" in line_lower:
                    m = re.search(r"(?:insured|policyholder|owner)\s*:?\s*(.+)", line_clean, re.I)
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

            if any(s in line.lower() for s in [
                "page ", "total:", "subtotal", "grand total", "coverage",
                "policy", "claim number", "phone", "fax", "email",
            ]):
                continue

            # Section headers
            section_match = re.match(r"^([A-Z][A-Za-z /&]+)$", line)
            if section_match and len(line) < 40:
                unit_check = re.search(
                    r"\b(SQ|SF|LF|SY|EA|HR|CY|GAL|TON)\b", line, re.I
                )
                if not unit_check:
                    current_section = section_match.group(1).strip()
                    continue

            item = self._try_parse_line(line, count, current_section)
            if item:
                items.append(item)
                count += 1

        return items

    def _try_parse_line(self, line: str, idx: int, section: str) -> Optional[LineItem]:
        # Simsol commonly uses: Description  Qty  Unit  Rate  Amount
        m = re.match(
            r"^(.{5,70}?)\s+(\d+(?:\.\d+)?)\s+"
            r"(SQ|SF|LF|SY|EA|HR|CY|GAL|TON|BF|CF|PR|SET|JOB|DAY|MO|WK)"
            r"\s+\$?(\d+(?:,\d{3})*(?:\.\d+)?)\s+\$?(\d+(?:,\d{3})*(?:\.\d+)?)",
            line,
            re.I,
        )
        if m:
            desc = m.group(1).strip()
            if any(h in desc.lower() for h in ["description", "qty", "quantity", "total", "amount"]):
                return None

            unit = m.group(3).upper()
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

        # Numbered variant: "1. Description  Qty  Unit  Rate  Amount"
        m2 = re.match(
            r"^\d+[.)]\s*(.{5,70}?)\s+(\d+(?:\.\d+)?)\s+"
            r"(SQ|SF|LF|SY|EA|HR|CY|GAL|TON|BF|CF|PR|SET|JOB|DAY|MO|WK)"
            r"\s+\$?(\d+(?:,\d{3})*(?:\.\d+)?)\s+\$?(\d+(?:,\d{3})*(?:\.\d+)?)",
            line,
            re.I,
        )
        if m2:
            desc = m2.group(1).strip()
            if len(desc) < 5:
                return None
            unit = m2.group(3).upper()
            total = float(m2.group(5).replace(",", ""))
            cat = self._map_category(section)

            return LineItem(
                line_number=idx,
                category=cat,
                code="",
                description=desc,
                quantity=float(m2.group(2)),
                unit=unit,
                unit_price=float(m2.group(4).replace(",", "")),
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
    def _map_category(section: str) -> str:
        key = section.lower().strip()
        return SIMSOL_CATEGORY_MAP.get(key, "GEN")

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

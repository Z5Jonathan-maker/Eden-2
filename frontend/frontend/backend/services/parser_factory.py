"""
Parser Factory
Routes PDF parsing to the correct vendor-specific parser based on document
segmentation results.
"""
import logging
from typing import Optional

from services.pdf_parser import BaseParser, EstimateData, XactimateParser
from services.document_segmenter import segment_document

logger = logging.getLogger(__name__)


def _get_parser(vendor: str) -> BaseParser:
    """Return the appropriate parser instance for *vendor*."""
    if vendor == "symbility":
        from services.symbility_parser import SymbilityParser
        return SymbilityParser()
    if vendor == "simsol":
        from services.simsol_parser import SimsolParser
        return SimsolParser()
    # Default / fallback
    return XactimateParser()


def parse_estimate(
    pdf_bytes: bytes,
    file_name: str,
    estimate_type: str = "carrier",
    start_page: Optional[int] = None,
    end_page: Optional[int] = None,
    vendor: Optional[str] = None,
) -> EstimateData:
    """High-level convenience function: segment ➜ detect vendor ➜ parse.

    Parameters
    ----------
    pdf_bytes : raw PDF bytes
    file_name : original filename
    estimate_type : carrier | contractor | pa
    start_page, end_page : optional manual page overrides (0-indexed, inclusive)
    vendor : optional explicit vendor override (xactimate | symbility | simsol)
    """
    # If neither vendor nor page range is overridden, auto-detect first
    if vendor is None and start_page is None:
        try:
            seg = segment_document(pdf_bytes)
            vendor = seg.vendor_format
            start_page = seg.estimate_start_page
            end_page = seg.estimate_end_page
            logger.info(
                "Auto-detected vendor=%s pages=%d-%d confidence=%.2f for %s",
                vendor, start_page, end_page, seg.confidence, file_name,
            )
        except Exception as e:
            logger.warning("Segmentation failed for %s: %s — falling back to Xactimate", file_name, e)
            vendor = "xactimate"

    if vendor is None:
        vendor = "xactimate"

    parser = _get_parser(vendor)
    estimate = parser.parse_pdf(pdf_bytes, file_name, estimate_type, start_page, end_page)
    estimate.vendor_format = vendor
    return estimate

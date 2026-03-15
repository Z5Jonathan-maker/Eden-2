"""
PDF Financial Data Extraction — Uses Gemini Vision to extract structured
financial data from insurance PDFs (estimates, settlement letters, coverage
determinations) stored in GridFS.

Endpoints:
    POST /api/pdf-extract/analyze/{document_id}  — single document
    POST /api/pdf-extract/batch-analyze           — multiple documents
    POST /api/pdf-extract/auto-extract-all        — push-button full extraction
    GET  /api/pdf-extract/status                  — extraction run history
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from pydantic import BaseModel, Field

from dependencies import db, get_current_active_user
from services.claimpilot.llm_router import LLMRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pdf-extract", tags=["PDF Extraction"])

# GridFS bucket — same instance pattern as gmail_sync / uploads
fs = AsyncIOMotorGridFSBucket(db)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_PAGES_PER_PDF = 3  # First 3 pages — financial summaries are always on page 1-2
PAGE_DPI = 200  # Full quality — Standard plan has 2GB RAM
GEMINI_RPM_DELAY = 4.2  # 14 RPM, safe margin
EXTRACTABLE_DOC_TYPES = frozenset({
    "estimate",
    "settlement_letter",
    "coverage_determination",
})

# ---------------------------------------------------------------------------
# Gemini Vision Prompts (per document type)
# ---------------------------------------------------------------------------

PROMPTS: Dict[str, str] = {
    "estimate": (
        "Extract all financial data from this insurance estimate document. "
        "Return ONLY valid JSON with no markdown fences:\n"
        "{\n"
        '  "replacement_cost_value": number or null,\n'
        '  "actual_cash_value": number or null,\n'
        '  "depreciation": number or null,\n'
        '  "deductible": number or null,\n'
        '  "net_claim_value": number or null,\n'
        '  "line_items": [{"description": "...", "amount": number}],\n'
        '  "total_rcv": number or null,\n'
        '  "overhead_and_profit": number or null\n'
        "}"
    ),
    "settlement_letter": (
        "Extract all financial data from this insurance settlement letter. "
        "Return ONLY valid JSON with no markdown fences:\n"
        "{\n"
        '  "settlement_amount": number or null,\n'
        '  "payment_amount": number or null,\n'
        '  "check_number": string or null,\n'
        '  "payees": [string],\n'
        '  "coverage_status": "approved" | "denied" | "partial",\n'
        '  "denial_reason": string or null,\n'
        '  "mortgage_company": string or null\n'
        "}"
    ),
    "coverage_determination": (
        "Extract all financial data and coverage decisions from this insurance "
        "coverage determination document. "
        "Return ONLY valid JSON with no markdown fences:\n"
        "{\n"
        '  "coverage_status": "approved" | "denied" | "partial",\n'
        '  "covered_amount": number or null,\n'
        '  "denied_amount": number or null,\n'
        '  "denial_reason": string or null,\n'
        '  "conditions": [string],\n'
        '  "effective_date": string or null,\n'
        '  "policy_provisions_cited": [string]\n'
        "}"
    ),
}

# Fallback prompt for unknown types
DEFAULT_PROMPT = (
    "Extract all financial data from this insurance document. "
    "Return ONLY valid JSON with no markdown fences. Include any "
    "dollar amounts, dates, claim numbers, and coverage decisions you find."
)


# ---------------------------------------------------------------------------
# Pydantic Request/Response Models
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    update_claim: bool = Field(
        default=False,
        description="If true, update the linked claim with extracted financial data.",
    )


class BatchAnalyzeRequest(BaseModel):
    document_ids: Optional[List[str]] = Field(
        default=None,
        description="Specific document IDs to analyze.",
    )
    claim_id: Optional[str] = Field(
        default=None,
        description="Analyze all extractable documents for this claim.",
    )
    update_claims: bool = Field(
        default=False,
        description="If true, update linked claims with extracted data.",
    )


class AutoExtractRequest(BaseModel):
    update_claims: bool = Field(
        default=True,
        description="Update linked claims automatically.",
    )
    dry_run: bool = Field(
        default=False,
        description="If true, extract but do not persist anything.",
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_user_id(current_user: dict) -> str:
    return current_user.get("id") or str(current_user.get("_id", ""))


async def _fetch_pdf_bytes_from_gridfs(doc_record: dict) -> bytes:
    """Download a PDF from GridFS using the document record metadata."""
    from bson import ObjectId

    grid_id = doc_record.get("grid_id")
    storage_filename = doc_record.get("storage_filename")
    doc_id = doc_record.get("id", "unknown")

    # Try grid_id first (with robust ObjectId handling)
    if grid_id:
        try:
            stream = io.BytesIO()
            oid = ObjectId(grid_id) if not isinstance(grid_id, ObjectId) else grid_id
            await fs.download_to_stream(oid, stream)
            stream.seek(0)
            data = stream.read()
            if data:
                return data
        except Exception as e:
            logger.warning("GridFS download by grid_id failed for doc %s (grid_id=%s): %s", doc_id, grid_id, e)

    # Fallback to storage_filename
    if storage_filename:
        try:
            stream = io.BytesIO()
            await fs.download_to_stream_by_name(storage_filename, stream)
            stream.seek(0)
            data = stream.read()
            if data:
                return data
        except Exception as e:
            logger.warning("GridFS download by filename failed for doc %s (filename=%s): %s", doc_id, storage_filename, e)

    raise ValueError(
        f"Document {doc_id} could not be downloaded (grid_id={grid_id}, filename={storage_filename})"
    )


def _pdf_pages_to_images(pdf_bytes: bytes, max_pages: int = MAX_PAGES_PER_PDF) -> List[tuple[bytes, str]]:
    """Convert first N pages of a PDF to PNG images using PyMuPDF.

    Returns list of (image_bytes, mime_type) tuples.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images: List[tuple[bytes, str]] = []
    page_count = min(len(doc), max_pages)

    for page_idx in range(page_count):
        page = doc[page_idx]
        # Render at higher DPI for better OCR accuracy
        zoom = PAGE_DPI / 72  # 72 is default DPI
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("png")
        images.append((img_bytes, "image/png"))

    doc.close()
    return images


def _parse_json_from_llm(raw_text: str) -> dict:
    """Extract JSON from LLM response, handling markdown fences and noise."""
    # Strip markdown code fences
    cleaned = re.sub(r"```(?:json)?\s*", "", raw_text)
    cleaned = re.sub(r"```\s*$", "", cleaned)
    cleaned = cleaned.strip()

    # Find the first { ... } block
    brace_start = cleaned.find("{")
    brace_end = cleaned.rfind("}")
    if brace_start == -1 or brace_end == -1:
        raise ValueError(f"No JSON object found in response: {raw_text[:200]}")

    json_str = cleaned[brace_start : brace_end + 1]
    return json.loads(json_str)


async def _extract_from_document(
    doc_record: dict,
    llm: LLMRouter,
) -> Dict[str, Any]:
    """Core extraction logic for a single document.

    Returns a dict with keys: document_id, claim_id, doc_type, status,
    extracted_data, error, pages_analyzed.
    """
    doc_id = doc_record.get("id", "unknown")
    doc_type = doc_record.get("type", "unknown")
    claim_id = doc_record.get("claim_id")
    mime_type = doc_record.get("mime_type", "")

    result: Dict[str, Any] = {
        "document_id": doc_id,
        "document_name": doc_record.get("name", ""),
        "claim_id": claim_id,
        "doc_type": doc_type,
        "status": "pending",
        "extracted_data": None,
        "error": None,
        "pages_analyzed": 0,
    }

    # Only process actual PDFs — require .pdf extension or application/pdf mime
    filename = doc_record.get("name", "") or doc_record.get("filename", "") or ""
    is_pdf = (
        "pdf" in mime_type.lower()
        or filename.lower().endswith(".pdf")
    )
    if not is_pdf:
        result["status"] = "skipped"
        result["error"] = f"Not a PDF (mime: {mime_type}, file: {filename})"
        return result

    try:
        pdf_bytes = await _fetch_pdf_bytes_from_gridfs(doc_record)
    except Exception as exc:
        result["status"] = "error"
        result["error"] = f"GridFS download failed: {exc}"
        return result

    if not pdf_bytes or len(pdf_bytes) < 100:
        result["status"] = "error"
        result["error"] = f"PDF too small or empty ({len(pdf_bytes) if pdf_bytes else 0} bytes)"
        return result

    import google.generativeai as genai
    import asyncio

    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_API_KEY")
    if not gemini_key:
        result["status"] = "error"
        result["error"] = "GEMINI_API_KEY not configured"
        return result

    genai.configure(api_key=gemini_key)
    model = genai.GenerativeModel("gemini-2.5-flash")
    prompt = PROMPTS.get(doc_type, DEFAULT_PROMPT)

    # Strategy 1: Try text extraction with PyMuPDF (works for digital PDFs)
    pdf_text = ""
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text_parts = [doc[i].get_text() for i in range(min(len(doc), 5))]
        doc.close()
        pdf_text = "\n\n".join(text_parts).strip()
        result["pages_analyzed"] = len(text_parts)
    except Exception:
        pass

    try:
        if pdf_text and len(pdf_text) > 50:
            # Digital PDF — send text to Gemini text API
            full_prompt = f"{prompt}\n\nDOCUMENT TEXT:\n{pdf_text[:15000]}"
            raw_response = await asyncio.to_thread(
                lambda: model.generate_content(full_prompt).text
            )
        else:
            # Scanned PDF — send raw bytes to Gemini (it uses vision internally)
            result["pages_analyzed"] = 1
            raw_response = await asyncio.to_thread(
                lambda: model.generate_content([
                    prompt,
                    {"mime_type": "application/pdf", "data": pdf_bytes},
                ]).text
            )

        parsed = _parse_json_from_llm(raw_response)
        if parsed:
            result["extracted_data"] = parsed
            result["status"] = "success"
        else:
            result["status"] = "error"
            result["error"] = f"Could not parse JSON from Gemini response: {raw_response[:200]}"

    except Exception as exc:
        result["status"] = "error"
        result["error"] = f"Gemini PDF extraction failed: {str(exc)[:200]}"
        logger.warning("PDF extraction failed for doc %s: %s", doc_id, exc)

    return result


def _merge_page_results(page_results: List[dict]) -> dict:
    """Merge extraction results from multiple pages.

    Strategy: for scalar fields, take the last non-null value.
    For list fields (line_items, payees, etc.), concatenate and deduplicate.
    """
    merged: Dict[str, Any] = {}
    list_keys = {"line_items", "payees", "conditions", "policy_provisions_cited"}

    for page_data in page_results:
        for key, value in page_data.items():
            if key in list_keys:
                existing = merged.get(key, [])
                if isinstance(value, list):
                    existing.extend(value)
                merged[key] = existing
            elif value is not None:
                merged[key] = value

    # Deduplicate list fields
    for key in list_keys:
        if key in merged and isinstance(merged[key], list):
            if merged[key] and isinstance(merged[key][0], dict):
                # Deduplicate dicts by converting to frozenset of items
                seen = set()
                unique = []
                for item in merged[key]:
                    item_key = json.dumps(item, sort_keys=True)
                    if item_key not in seen:
                        seen.add(item_key)
                        unique.append(item)
                merged[key] = unique
            else:
                # Deduplicate simple values, preserve order
                seen = set()
                unique = []
                for item in merged[key]:
                    if item not in seen:
                        seen.add(item)
                        unique.append(item)
                merged[key] = unique

    return merged


async def _update_claim_financials(
    claim_id: str,
    doc_type: str,
    extracted_data: dict,
    run_id: str,
) -> bool:
    """Update the linked claim record with extracted financial data.

    Returns True if claim was updated.
    """
    if not claim_id or not extracted_data:
        return False

    claim = await db.claims.find_one({"id": claim_id})
    if not claim:
        logger.warning("Cannot update claim %s — not found", claim_id)
        return False

    update_fields: Dict[str, Any] = {}

    if doc_type == "estimate":
        field_map = {
            "replacement_cost_value": "replacement_cost_value",
            "actual_cash_value": "actual_cash_value",
            "depreciation": "depreciation",
            "deductible": "deductible",
            "net_claim_value": "net_claim_value",
            "total_rcv": "replacement_cost_value",  # alias
        }
        for src_key, claim_field in field_map.items():
            val = extracted_data.get(src_key)
            if val is not None and isinstance(val, (int, float)):
                update_fields[claim_field] = val

    elif doc_type == "settlement_letter":
        if extracted_data.get("settlement_amount") is not None:
            update_fields["settlement_amount"] = extracted_data["settlement_amount"]
        if extracted_data.get("mortgage_company"):
            update_fields["mortgage_company"] = extracted_data["mortgage_company"]

    elif doc_type == "coverage_determination":
        if extracted_data.get("covered_amount") is not None:
            update_fields["net_claim_value"] = extracted_data["covered_amount"]

    if not update_fields:
        return False

    update_fields["updated_at"] = _now_iso()
    update_fields["last_pdf_extraction_at"] = _now_iso()
    update_fields["last_pdf_extraction_run"] = run_id

    result = await db.claims.update_one(
        {"id": claim_id},
        {"$set": update_fields},
    )

    if result.modified_count > 0:
        logger.info(
            "Updated claim %s with %d fields from %s extraction",
            claim_id, len(update_fields) - 2, doc_type,  # -2 for metadata fields
        )
        return True

    return False


# ---------------------------------------------------------------------------
# 1. Analyze Single Document
# ---------------------------------------------------------------------------

@router.post("/analyze/{document_id}")
async def analyze_document(
    document_id: str,
    data: AnalyzeRequest = AnalyzeRequest(),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Extract financial data from a single PDF document using Gemini Vision.

    Retrieves the PDF from GridFS, converts pages to images, sends to Gemini,
    and returns structured financial data. Optionally updates the linked claim.

    Admin only.
    """
    if current_user.get("role") not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager access required")

    doc_record = await db.documents.find_one({"id": document_id}, {"_id": 0})
    if not doc_record:
        raise HTTPException(status_code=404, detail=f"Document {document_id} not found")

    run_id = str(uuid.uuid4())
    llm = LLMRouter()

    result = await _extract_from_document(doc_record, llm)

    # Persist extraction result
    extraction_record = {
        "id": run_id,
        "type": "single",
        "document_id": document_id,
        "claim_id": result.get("claim_id"),
        "doc_type": result.get("doc_type"),
        "status": result["status"],
        "extracted_data": result.get("extracted_data"),
        "error": result.get("error"),
        "pages_analyzed": result.get("pages_analyzed", 0),
        "extracted_by": current_user.get("full_name", "system"),
        "extracted_at": _now_iso(),
    }
    await db.pdf_extractions.insert_one(extraction_record)

    # Update the document record with extraction metadata
    await db.documents.update_one(
        {"id": document_id},
        {"$set": {
            "pdf_extraction_status": result["status"],
            "pdf_extraction_id": run_id,
            "pdf_extracted_at": _now_iso(),
        }},
    )

    # Optionally update claim
    claim_updated = False
    if data.update_claim and result["status"] == "success":
        claim_updated = await _update_claim_financials(
            result.get("claim_id"),
            result.get("doc_type", ""),
            result.get("extracted_data", {}),
            run_id,
        )

    return {
        "run_id": run_id,
        "document_id": document_id,
        "status": result["status"],
        "pages_analyzed": result.get("pages_analyzed", 0),
        "extracted_data": result.get("extracted_data"),
        "error": result.get("error"),
        "claim_updated": claim_updated,
    }


# ---------------------------------------------------------------------------
# 2. Batch Analyze
# ---------------------------------------------------------------------------

@router.post("/batch-analyze")
async def batch_analyze(
    data: BatchAnalyzeRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Analyze multiple PDF documents. Provide either specific document_ids
    or a claim_id to analyze all extractable docs for that claim.

    Admin only. Rate-limited to stay under Gemini free tier (15 RPM).
    """
    if current_user.get("role") not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager access required")

    if not data.document_ids and not data.claim_id:
        raise HTTPException(
            status_code=400,
            detail="Provide either document_ids or claim_id",
        )

    # Resolve document list
    if data.document_ids:
        docs = await db.documents.find(
            {"id": {"$in": data.document_ids}},
            {"_id": 0},
        ).to_list(200)
    else:
        docs = await db.documents.find(
            {
                "claim_id": data.claim_id,
                "type": {"$in": list(EXTRACTABLE_DOC_TYPES)},
            },
            {"_id": 0},
        ).to_list(200)

    if not docs:
        return {
            "message": "No matching documents found",
            "total": 0,
            "results": [],
        }

    run_id = str(uuid.uuid4())
    llm = LLMRouter()
    results: List[Dict[str, Any]] = []
    claims_updated = 0
    success_count = 0
    error_count = 0

    for idx, doc in enumerate(docs):
        # Rate limiting — skip delay on the first call
        if idx > 0:
            await asyncio.sleep(GEMINI_RPM_DELAY)

        result = await _extract_from_document(doc, llm)
        results.append(result)

        if result["status"] == "success":
            success_count += 1
        elif result["status"] == "error":
            error_count += 1

        # Persist each extraction
        await db.pdf_extractions.insert_one({
            "id": str(uuid.uuid4()),
            "run_id": run_id,
            "type": "batch",
            "document_id": result["document_id"],
            "claim_id": result.get("claim_id"),
            "doc_type": result.get("doc_type"),
            "status": result["status"],
            "extracted_data": result.get("extracted_data"),
            "error": result.get("error"),
            "pages_analyzed": result.get("pages_analyzed", 0),
            "extracted_by": current_user.get("full_name", "system"),
            "extracted_at": _now_iso(),
        })

        # Update document metadata
        await db.documents.update_one(
            {"id": result["document_id"]},
            {"$set": {
                "pdf_extraction_status": result["status"],
                "pdf_extraction_id": run_id,
                "pdf_extracted_at": _now_iso(),
            }},
        )

        # Free memory between documents
        import gc
        gc.collect()

        # Update claim if requested
        if data.update_claims and result["status"] == "success":
            updated = await _update_claim_financials(
                result.get("claim_id"),
                result.get("doc_type", ""),
                result.get("extracted_data", {}),
                run_id,
            )
            if updated:
                claims_updated += 1

    # Log the batch run
    await db.pdf_extraction_runs.insert_one({
        "id": run_id,
        "type": "batch",
        "documents_processed": len(docs),
        "success_count": success_count,
        "error_count": error_count,
        "claims_updated": claims_updated,
        "run_by": current_user.get("full_name", "system"),
        "run_at": _now_iso(),
    })

    return {
        "run_id": run_id,
        "documents_processed": len(docs),
        "success_count": success_count,
        "error_count": error_count,
        "claims_updated": claims_updated,
        "results": results,
    }


# ---------------------------------------------------------------------------
# 3. Auto-Extract All
# ---------------------------------------------------------------------------

@router.post("/auto-extract-all")
async def auto_extract_all(
    data: AutoExtractRequest = AutoExtractRequest(),
    current_user: dict = Depends(get_current_active_user),
    batch_size: int = 5,
):
    """
    Push-button endpoint: extract financial data from PDFs.
    Processes batch_size docs per call (default 5) to avoid HTTP timeout.
    Call repeatedly until remaining=0.

    Admin only.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Find all extractable PDFs not yet successfully processed
    query = {
        "type": {"$in": list(EXTRACTABLE_DOC_TYPES)},
        "pdf_extraction_status": {"$ne": "success"},
    }
    docs = await db.documents.find(query, {"_id": 0}).to_list(100)
    logger.info("auto-extract-all: query=%s found %d docs", query, len(docs))

    if not docs:
        return {
            "message": "No unprocessed extractable documents found",
            "total": 0,
            "results": [],
        }

    run_id = str(uuid.uuid4())
    llm = LLMRouter()
    results: List[Dict[str, Any]] = []
    claims_updated = 0
    success_count = 0
    error_count = 0
    skipped_count = 0

    # Group by doc_type for the summary
    type_counts: Dict[str, int] = {}

    for idx, doc in enumerate(docs):
        doc_type = doc.get("type", "unknown")
        type_counts[doc_type] = type_counts.get(doc_type, 0) + 1

        # Rate limiting
        if idx > 0:
            await asyncio.sleep(GEMINI_RPM_DELAY)

        result = await _extract_from_document(doc, llm)
        results.append(result)

        if result["status"] == "success":
            success_count += 1
        elif result["status"] == "skipped":
            skipped_count += 1
        else:
            error_count += 1

        if not data.dry_run:
            # Persist extraction
            await db.pdf_extractions.insert_one({
                "id": str(uuid.uuid4()),
                "run_id": run_id,
                "type": "auto",
                "document_id": result["document_id"],
                "claim_id": result.get("claim_id"),
                "doc_type": result.get("doc_type"),
                "status": result["status"],
                "extracted_data": result.get("extracted_data"),
                "error": result.get("error"),
                "pages_analyzed": result.get("pages_analyzed", 0),
                "extracted_by": current_user.get("full_name", "system"),
                "extracted_at": _now_iso(),
            })

            # Update document metadata
            await db.documents.update_one(
                {"id": result["document_id"]},
                {"$set": {
                    "pdf_extraction_status": result["status"],
                    "pdf_extraction_id": run_id,
                    "pdf_extracted_at": _now_iso(),
                }},
            )

            # Update claim
            if data.update_claims and result["status"] == "success":
                updated = await _update_claim_financials(
                    result.get("claim_id"),
                    result.get("doc_type", ""),
                    result.get("extracted_data", {}),
                    run_id,
                )
                if updated:
                    claims_updated += 1

    if not data.dry_run:
        # Log the auto-extract run
        await db.pdf_extraction_runs.insert_one({
            "id": run_id,
            "type": "auto",
            "documents_processed": len(docs),
            "success_count": success_count,
            "error_count": error_count,
            "skipped_count": skipped_count,
            "claims_updated": claims_updated,
            "document_types": type_counts,
            "run_by": current_user.get("full_name", "system"),
            "run_at": _now_iso(),
        })

    return {
        "run_id": run_id,
        "dry_run": data.dry_run,
        "documents_found": len(docs),
        "documents_processed": len(docs),
        "success_count": success_count,
        "error_count": error_count,
        "skipped_count": skipped_count,
        "claims_updated": claims_updated,
        "document_types": type_counts,
        "results": results,
    }


# ---------------------------------------------------------------------------
# 4. Extraction Status & History
# ---------------------------------------------------------------------------

@router.post("/reset-errors")
async def reset_extraction_errors(
    current_user: dict = Depends(get_current_active_user),
):
    """Reset all error statuses so documents can be retried with fixed code."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    result = await db.documents.update_many(
        {"pdf_extraction_status": "error"},
        {"$unset": {"pdf_extraction_status": "", "pdf_extraction_id": "", "pdf_extracted_at": ""}},
    )
    # Also clear extraction log entries for failed runs
    cleared = await db.pdf_extractions.delete_many({"status": "error"})

    return {
        "documents_reset": result.modified_count,
        "extraction_logs_cleared": cleared.deleted_count,
        "message": f"Reset {result.modified_count} documents for retry",
    }


@router.get("/status")
async def extraction_status(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Show PDF extraction run history and stats.
    Admin/manager only.
    """
    if current_user.get("role") not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager access required")

    # Recent extraction runs
    recent_runs = await db.pdf_extraction_runs.find(
        {}, {"_id": 0},
    ).sort("run_at", -1).limit(10).to_list(10)

    # Total extraction counts
    total_extractions = await db.pdf_extractions.count_documents({})
    successful = await db.pdf_extractions.count_documents({"status": "success"})
    failed = await db.pdf_extractions.count_documents({"status": "error"})

    # Remaining unprocessed documents
    unprocessed = await db.documents.count_documents({
        "type": {"$in": list(EXTRACTABLE_DOC_TYPES)},
        "$or": [
            {"pdf_extraction_status": {"$exists": False}},
            {"pdf_extraction_status": {"$nin": ["success"]}},
        ],
    })

    # By type breakdown
    pipeline = [
        {"$match": {"type": {"$in": list(EXTRACTABLE_DOC_TYPES)}}},
        {"$group": {
            "_id": {
                "type": "$type",
                "status": {"$ifNull": ["$pdf_extraction_status", "pending"]},
            },
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id.type": 1, "_id.status": 1}},
    ]
    by_type_raw = await db.documents.aggregate(pipeline).to_list(50)
    by_type = [
        {
            "doc_type": item["_id"]["type"],
            "extraction_status": item["_id"]["status"],
            "count": item["count"],
        }
        for item in by_type_raw
    ]

    return {
        "total_extractions": total_extractions,
        "successful": successful,
        "failed": failed,
        "unprocessed_remaining": unprocessed,
        "by_type": by_type,
        "recent_runs": recent_runs,
    }


@router.get("/debug-docs")
async def debug_documents(
    current_user: dict = Depends(get_current_active_user),
):
    """Debug: show what's actually in the documents collection."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    from collections import Counter

    # Count by type
    pipeline_type = [{"$group": {"_id": "$type", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    type_counts = await db.documents.aggregate(pipeline_type).to_list(50)

    # Count by extraction status
    pipeline_status = [{"$group": {"_id": "$pdf_extraction_status", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    status_counts = await db.documents.aggregate(pipeline_status).to_list(10)

    # Count by source
    pipeline_source = [{"$group": {"_id": "$source", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    source_counts = await db.documents.aggregate(pipeline_source).to_list(10)

    # Get 3 sample estimate docs
    samples = await db.documents.find(
        {"type": "estimate"},
        {"_id": 0, "id": 1, "name": 1, "type": 1, "mime_type": 1, "claim_id": 1,
         "grid_id": 1, "storage_filename": 1, "pdf_extraction_status": 1, "source": 1}
    ).limit(3).to_list(3)

    # Total
    total = await db.documents.count_documents({})

    return {
        "total_documents": total,
        "by_type": type_counts,
        "by_extraction_status": status_counts,
        "by_source": source_counts,
        "sample_estimates": samples,
    }

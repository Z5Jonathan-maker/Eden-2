"""
Gmail Auto-Sync Worker — Scheduled background job that syncs Gmail
attachments, categorizes documents, and extracts PDF data.

Runs every 6 hours via APScheduler. Pipeline:
  1. Find admin user with valid Google OAuth token
  2. Auto-sync Gmail attachments to claims
  3. Categorize new uncategorized documents
  4. Extract financial data from new PDFs via Gemini
  5. Log results to gmail_sync_runs collection

Token handling: If no valid token exists, logs a warning and exits
gracefully — never crashes the scheduler.
"""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_db = None

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SYNC_MAX_MESSAGES = 100
GEMINI_RPM_DELAY = 4.2  # seconds between Gemini calls (14 RPM safe margin)
BATCH_SIZE_CLAIMS = 20  # Gmail search batch size (query length limit)
MAX_PDF_EXTRACTIONS_PER_RUN = 25  # Cap Gemini calls per cron run


def init_gmail_sync_worker(db) -> None:
    """Store database reference for the worker."""
    global _db
    _db = db


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Step 0: Resolve an admin user with a valid Google OAuth token
# ---------------------------------------------------------------------------

async def _get_sync_user() -> Optional[Dict[str, Any]]:
    """Find an admin user whose Google OAuth token is still valid (or refreshable).

    Returns a dict with 'id', 'full_name', 'email', and 'token' keys,
    or None if no usable token exists.
    """
    from routes.oauth import get_valid_token

    admin_users = await _db.users.find(
        {"role": "admin", "is_active": {"$ne": False}},
        {"_id": 0, "id": 1, "full_name": 1, "email": 1},
    ).to_list(10)

    if not admin_users:
        logger.warning("gmail_sync_worker: no active admin users found")
        return None

    for user in admin_users:
        user_id = user.get("id", "")
        if not user_id:
            continue
        try:
            token = await get_valid_token(user_id, "google")
            if token:
                return {
                    "id": user_id,
                    "full_name": user.get("full_name", "System Scheduler"),
                    "email": user.get("email", ""),
                    "token": token,
                }
        except Exception as exc:
            logger.debug(
                "gmail_sync_worker: token check failed for user %s: %s",
                user_id, exc,
            )
            continue

    logger.warning(
        "gmail_sync_worker: no admin user has a valid Google OAuth token — "
        "skipping this run. Reconnect Google in Settings > Integrations."
    )
    return None


# ---------------------------------------------------------------------------
# Step 1: Gmail Auto-Sync (mirrors routes/gmail_sync.py auto_sync logic)
# ---------------------------------------------------------------------------

async def _run_gmail_auto_sync(
    sync_user: Dict[str, Any],
) -> Dict[str, Any]:
    """Execute Gmail auto-sync for all claims with claim numbers.

    Returns a summary dict with counts.
    """
    import httpx
    import base64
    import io
    import re
    from pathlib import Path
    from motor.motor_asyncio import AsyncIOMotorGridFSBucket

    from routes.oauth import get_valid_token, refresh_google_token
    from routes.gmail_sync import (
        GMAIL_API,
        SYNCABLE_MIME_TYPES,
        MIME_TO_EXT,
        MAX_ATTACHMENT_SIZE,
        _extract_attachments_from_payload,
        _parse_gmail_headers,
        _sanitize_filename,
    )

    user_id = sync_user["id"]
    uploaded_by = sync_user["full_name"]
    fs = AsyncIOMotorGridFSBucket(_db)

    result_summary = {
        "claims_searched": 0,
        "messages_processed": 0,
        "claims_matched": 0,
        "total_synced": 0,
        "total_skipped": 0,
        "total_errors": 0,
    }

    # Load all active claims with claim numbers
    claims = await _db.claims.find(
        {"claim_number": {"$exists": True, "$ne": ""}},
        {"_id": 0, "id": 1, "claim_number": 1, "client_name": 1},
    ).to_list(5000)

    if not claims:
        logger.info("gmail_sync_worker: no claims with claim numbers found")
        return result_summary

    claim_map: Dict[str, dict] = {}
    for c in claims:
        cn = c.get("claim_number", "").strip()
        if cn:
            claim_map[cn.lower()] = c

    claim_numbers = list(claim_map.keys())
    result_summary["claims_searched"] = len(claim_numbers)

    processed_message_ids: set = set()
    claims_matched_set: set = set()

    async def _gmail_request(method: str, url: str, **kwargs):
        """Authenticated Gmail API request with auto-refresh."""
        nonlocal user_id
        token = await get_valid_token(user_id, "google")
        if not token:
            raise RuntimeError("Google token expired mid-sync")

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(
                method, url,
                headers={"Authorization": f"Bearer {token}"},
                **kwargs,
            )
            if resp.status_code == 401:
                token = await refresh_google_token(user_id)
                if not token:
                    raise RuntimeError("Google token refresh failed")
                resp = await client.request(
                    method, url,
                    headers={"Authorization": f"Bearer {token}"},
                    **kwargs,
                )
            return resp

    # Search Gmail in batches of claim numbers
    for batch_start in range(0, len(claim_numbers), BATCH_SIZE_CLAIMS):
        batch = claim_numbers[batch_start:batch_start + BATCH_SIZE_CLAIMS]
        query_parts = " OR ".join(f'"{cn}"' for cn in batch)
        gmail_query = f"has:attachment ({query_parts})"

        try:
            search_resp = await _gmail_request(
                "GET",
                f"{GMAIL_API}/messages",
                params={"q": gmail_query, "maxResults": SYNC_MAX_MESSAGES},
            )
        except RuntimeError as exc:
            logger.error("gmail_sync_worker: auth failure during search: %s", exc)
            result_summary["total_errors"] += 1
            return result_summary

        if search_resp.status_code != 200:
            logger.warning(
                "gmail_sync_worker: search failed batch %d: HTTP %d",
                batch_start, search_resp.status_code,
            )
            continue

        message_ids = [m["id"] for m in search_resp.json().get("messages", [])]

        for msg_id in message_ids:
            if msg_id in processed_message_ids:
                continue
            processed_message_ids.add(msg_id)

            try:
                msg_resp = await _gmail_request(
                    "GET",
                    f"{GMAIL_API}/messages/{msg_id}",
                    params={"format": "full"},
                )
            except RuntimeError:
                result_summary["total_errors"] += 1
                continue

            if msg_resp.status_code != 200:
                result_summary["total_errors"] += 1
                continue

            msg_data = msg_resp.json()
            payload = msg_data.get("payload", {})
            headers = _parse_gmail_headers(payload.get("headers", []))
            snippet = msg_data.get("snippet", "")

            subject = headers.get("subject", "")
            combined_text = f"{subject} {snippet}".lower()
            matched_claim = None

            for cn_lower, claim in claim_map.items():
                if cn_lower in combined_text:
                    matched_claim = claim
                    break

            if not matched_claim:
                continue

            claim_id = matched_claim["id"]
            claims_matched_set.add(claim_id)

            attachment_metas = _extract_attachments_from_payload(payload)
            if not attachment_metas:
                continue

            for att_meta in attachment_metas:
                attachment_id = att_meta["attachment_id"]
                filename = att_meta["filename"]
                mime_type = att_meta["mime_type"]

                # Dedup check
                existing = await _db.documents.find_one({
                    "gmail_message_id": msg_id,
                    "gmail_attachment_id": attachment_id,
                })
                if existing:
                    result_summary["total_skipped"] += 1
                    continue

                try:
                    att_resp = await _gmail_request(
                        "GET",
                        f"{GMAIL_API}/messages/{msg_id}/attachments/{attachment_id}",
                    )
                except RuntimeError:
                    result_summary["total_errors"] += 1
                    continue

                if att_resp.status_code != 200:
                    result_summary["total_errors"] += 1
                    continue

                raw_data = att_resp.json().get("data", "")
                if not raw_data:
                    result_summary["total_errors"] += 1
                    continue

                import base64 as b64
                file_bytes = b64.urlsafe_b64decode(raw_data)
                size_bytes = len(file_bytes)

                if size_bytes > MAX_ATTACHMENT_SIZE:
                    result_summary["total_skipped"] += 1
                    continue

                file_id = str(uuid.uuid4())
                ext = MIME_TO_EXT.get(mime_type, Path(filename).suffix or ".bin")
                safe_name = _sanitize_filename(filename)
                storage_filename = f"{file_id}{ext}"
                now = _now_iso()

                grid_id = await fs.upload_from_stream(
                    storage_filename,
                    io.BytesIO(file_bytes),
                    metadata={
                        "file_id": file_id,
                        "original_name": safe_name,
                        "mime_type": mime_type,
                        "file_type": "document" if mime_type == "application/pdf" else "image",
                        "source": "gmail_sync",
                    },
                )

                doc_record = {
                    "id": file_id,
                    "claim_id": claim_id,
                    "name": safe_name,
                    "type": "gmail_attachment",
                    "mime_type": mime_type,
                    "size": f"{size_bytes / 1024:.2f} KB",
                    "size_bytes": size_bytes,
                    "uploaded_by": uploaded_by,
                    "uploaded_at": now,
                    "source": "gmail_sync",
                    "gmail_message_id": msg_id,
                    "gmail_attachment_id": attachment_id,
                    "grid_id": str(grid_id),
                    "storage": "gridfs",
                    "storage_filename": storage_filename,
                }
                await _db.documents.insert_one(doc_record)

                uploaded_file_record = {
                    "id": file_id,
                    "filename": storage_filename,
                    "original_name": safe_name,
                    "file_type": "document" if mime_type == "application/pdf" else "image",
                    "mime_type": mime_type,
                    "size": size_bytes,
                    "uploaded_by": uploaded_by,
                    "uploaded_at": now,
                    "content_id": claim_id,
                    "content_type": "claim",
                    "grid_id": str(grid_id),
                    "storage": "gridfs",
                    "source": "gmail_sync",
                }
                await _db.uploaded_files.insert_one(uploaded_file_record)
                result_summary["total_synced"] += 1

    result_summary["messages_processed"] = len(processed_message_ids)
    result_summary["claims_matched"] = len(claims_matched_set)
    return result_summary


# ---------------------------------------------------------------------------
# Step 2: Auto-categorize uncategorized documents
# ---------------------------------------------------------------------------

async def _run_categorize() -> Dict[str, Any]:
    """Categorize all gmail_attachment documents by filename pattern.

    Mirrors routes/gmail_sync.py categorize_synced_documents logic.
    """
    from routes.gmail_sync import _categorize_filename

    summary = {"total_docs": 0, "updated": 0, "claims_affected": 0}

    docs = await _db.documents.find(
        {"type": "gmail_attachment"},
        {"_id": 0, "id": 1, "claim_id": 1, "name": 1},
    ).to_list(5000)

    if not docs:
        return summary

    summary["total_docs"] = len(docs)
    claim_summaries: Dict[str, Dict[str, int]] = {}

    for doc in docs:
        new_type = _categorize_filename(doc["name"])
        cid = doc["claim_id"]
        if cid not in claim_summaries:
            claim_summaries[cid] = {}
        claim_summaries[cid][new_type] = claim_summaries[cid].get(new_type, 0) + 1

        result = await _db.documents.update_one(
            {"id": doc["id"]},
            {"$set": {"type": new_type, "source": "gmail_sync"}},
        )
        if result.modified_count > 0:
            summary["updated"] += 1

    # Add inventory notes per claim
    for cid, cats in claim_summaries.items():
        total_docs = sum(cats.values())
        lines = [f"[Document Inventory] Auto-categorized from Gmail ({total_docs} docs):"]
        for cat_name, count in sorted(cats.items(), key=lambda x: -x[1]):
            lines.append(f"  - {cat_name}: {count}")

        note_record = {
            "id": str(uuid.uuid4()),
            "claim_id": cid,
            "content": "\n".join(lines),
            "tags": ["document_inventory", "auto_categorized", "scheduled_sync"],
            "author_id": "system",
            "author_name": "Gmail Sync Worker",
            "created_at": _now_iso(),
        }
        await _db.notes.insert_one(note_record)

    summary["claims_affected"] = len(claim_summaries)
    return summary


# ---------------------------------------------------------------------------
# Step 3: Auto-extract PDFs via Gemini
# ---------------------------------------------------------------------------

async def _run_pdf_extraction() -> Dict[str, Any]:
    """Extract financial data from unprocessed PDFs.

    Mirrors routes/pdf_extract.py auto_extract_all logic but with a cap
    on Gemini calls to stay within rate limits and cost budget.
    """
    from routes.pdf_extract import (
        EXTRACTABLE_DOC_TYPES,
        _extract_from_document,
        _update_claim_financials,
        GEMINI_RPM_DELAY as PDF_RPM_DELAY,
    )
    from services.claimpilot.llm_router import LLMRouter

    summary = {
        "documents_found": 0,
        "success_count": 0,
        "error_count": 0,
        "skipped_count": 0,
        "claims_updated": 0,
    }

    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_API_KEY")
    if not gemini_key:
        logger.warning("gmail_sync_worker: GEMINI_API_KEY not set — skipping PDF extraction")
        return summary

    docs = await _db.documents.find(
        {
            "type": {"$in": list(EXTRACTABLE_DOC_TYPES)},
            "pdf_extraction_status": {"$ne": "success"},
        },
        {"_id": 0},
    ).to_list(MAX_PDF_EXTRACTIONS_PER_RUN)

    if not docs:
        return summary

    summary["documents_found"] = len(docs)
    run_id = str(uuid.uuid4())

    try:
        llm = LLMRouter()
    except Exception as exc:
        logger.error("gmail_sync_worker: LLMRouter init failed: %s", exc)
        return summary

    for idx, doc in enumerate(docs):
        if idx > 0:
            await asyncio.sleep(PDF_RPM_DELAY)

        try:
            result = await _extract_from_document(doc, llm)
        except Exception as exc:
            logger.exception(
                "gmail_sync_worker: extraction crash doc=%s: %s",
                doc.get("id"), exc,
            )
            result = {
                "document_id": doc.get("id"),
                "status": "error",
                "error": f"Crash: {exc}",
                "extracted_data": None,
                "pages_analyzed": 0,
            }

        if result["status"] == "success":
            summary["success_count"] += 1
        elif result["status"] == "skipped":
            summary["skipped_count"] += 1
        else:
            summary["error_count"] += 1

        # Persist extraction record
        await _db.pdf_extractions.insert_one({
            "id": str(uuid.uuid4()),
            "run_id": run_id,
            "type": "scheduled",
            "document_id": result["document_id"],
            "claim_id": result.get("claim_id"),
            "doc_type": result.get("doc_type"),
            "status": result["status"],
            "extracted_data": result.get("extracted_data"),
            "error": result.get("error"),
            "pages_analyzed": result.get("pages_analyzed", 0),
            "extracted_by": "Gmail Sync Worker",
            "extracted_at": _now_iso(),
        })

        # Update document metadata
        await _db.documents.update_one(
            {"id": result["document_id"]},
            {"$set": {
                "pdf_extraction_status": result["status"],
                "pdf_extraction_id": run_id,
                "pdf_extracted_at": _now_iso(),
            }},
        )

        # Update claim financials
        if result["status"] == "success":
            updated = await _update_claim_financials(
                result.get("claim_id"),
                result.get("doc_type", ""),
                result.get("extracted_data", {}),
                run_id,
            )
            if updated:
                summary["claims_updated"] += 1

        # Free memory between docs
        import gc
        gc.collect()

    # Log extraction run
    await _db.pdf_extraction_runs.insert_one({
        "id": run_id,
        "type": "scheduled",
        "documents_processed": len(docs),
        "success_count": summary["success_count"],
        "error_count": summary["error_count"],
        "skipped_count": summary["skipped_count"],
        "claims_updated": summary["claims_updated"],
        "run_by": "Gmail Sync Worker",
        "run_at": _now_iso(),
    })

    return summary


# ---------------------------------------------------------------------------
# Main orchestrator — called by scheduler
# ---------------------------------------------------------------------------

async def run_gmail_sync_pipeline() -> None:
    """Full Gmail sync pipeline: sync -> categorize -> extract.

    This is the entry point called by APScheduler every 6 hours.
    """
    if _db is None:
        logger.warning("gmail_sync_worker: db not initialized — skipping")
        return

    run_id = str(uuid.uuid4())
    started_at = _now_iso()
    logger.info("gmail_sync_worker: starting pipeline run_id=%s", run_id)

    sync_result: Dict[str, Any] = {}
    categorize_result: Dict[str, Any] = {}
    extract_result: Dict[str, Any] = {}
    status = "success"
    error_detail: Optional[str] = None

    # Step 1: Get a valid admin token
    sync_user = await _get_sync_user()
    if not sync_user:
        status = "skipped_no_token"
        error_detail = "No admin user with valid Google OAuth token"
        logger.warning("gmail_sync_worker: %s", error_detail)
    else:
        # Step 2: Gmail auto-sync
        try:
            sync_result = await _run_gmail_auto_sync(sync_user)
            logger.info(
                "gmail_sync_worker: sync complete — synced=%d skipped=%d errors=%d matched=%d",
                sync_result.get("total_synced", 0),
                sync_result.get("total_skipped", 0),
                sync_result.get("total_errors", 0),
                sync_result.get("claims_matched", 0),
            )
        except Exception as exc:
            logger.exception("gmail_sync_worker: sync phase failed: %s", exc)
            sync_result = {"error": str(exc)}
            status = "partial_failure"

    # Step 3: Categorize (runs even if sync was skipped — catches manual uploads)
    try:
        categorize_result = await _run_categorize()
        logger.info(
            "gmail_sync_worker: categorize complete — updated=%d claims=%d",
            categorize_result.get("updated", 0),
            categorize_result.get("claims_affected", 0),
        )
    except Exception as exc:
        logger.exception("gmail_sync_worker: categorize phase failed: %s", exc)
        categorize_result = {"error": str(exc)}
        if status == "success":
            status = "partial_failure"

    # Step 4: PDF extraction (runs even if earlier steps failed)
    try:
        extract_result = await _run_pdf_extraction()
        logger.info(
            "gmail_sync_worker: extraction complete — success=%d errors=%d claims_updated=%d",
            extract_result.get("success_count", 0),
            extract_result.get("error_count", 0),
            extract_result.get("claims_updated", 0),
        )
    except Exception as exc:
        logger.exception("gmail_sync_worker: extraction phase failed: %s", exc)
        extract_result = {"error": str(exc)}
        if status == "success":
            status = "partial_failure"

    # Step 5: Log the full pipeline run
    finished_at = _now_iso()
    run_record = {
        "id": run_id,
        "type": "scheduled_pipeline",
        "status": status,
        "error_detail": error_detail,
        "started_at": started_at,
        "finished_at": finished_at,
        "sync_user_id": sync_user["id"] if sync_user else None,
        "sync_user_name": sync_user["full_name"] if sync_user else None,
        "gmail_sync": sync_result,
        "categorize": categorize_result,
        "pdf_extraction": extract_result,
        "run_by": "Gmail Sync Worker (Scheduled)",
        "run_at": started_at,
    }
    await _db.gmail_sync_runs.insert_one(run_record)

    logger.info(
        "gmail_sync_worker: pipeline complete run_id=%s status=%s "
        "synced=%d categorized=%d extracted=%d",
        run_id,
        status,
        sync_result.get("total_synced", 0),
        categorize_result.get("updated", 0),
        extract_result.get("success_count", 0),
    )

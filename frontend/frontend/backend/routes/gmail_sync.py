"""
Gmail Attachment Sync — Automated PDF/image download from Gmail to Eden documents.

Downloads attachments from Gmail messages via the Gmail API, stores them in
GridFS, and creates document records linked to claims. Fully hands-free.

Uses the existing OAuth token infrastructure (routes/oauth.py) and the
_google_request helper pattern from integrations/google_client.py.
"""

import base64
import io
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from pydantic import BaseModel, Field

from dependencies import db, get_current_active_user
from routes.oauth import get_valid_token, refresh_google_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gmail-sync", tags=["Gmail Sync"])

GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"

# GridFS bucket — same as uploads.py
fs = AsyncIOMotorGridFSBucket(db)

# Sync-eligible MIME types
SYNCABLE_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/tiff",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

MIME_TO_EXT = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/tiff": ".tiff",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
}

MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024  # 25 MB


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class SyncAttachmentsRequest(BaseModel):
    claim_id: str
    gmail_message_ids: List[str] = Field(..., min_length=1, max_length=50)


class AutoSyncRequest(BaseModel):
    max_messages: int = Field(default=50, ge=1, le=200)
    only_unread: bool = False
    date_after: Optional[str] = None  # YYYY/MM/DD format for Gmail query


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_user_id(current_user: dict) -> str:
    return current_user.get("id") or str(current_user.get("_id", ""))


def _sanitize_filename(name: str) -> str:
    """Strip unsafe characters, preserve extension."""
    name = os.path.basename(name)
    name = re.sub(r"[^\w.\-()]", "_", name)
    return name[:255] if name else "unnamed"


async def _gmail_request(user_id: str, method: str, url: str, **kwargs):
    """Authenticated Gmail API request with auto-refresh. Mirrors google_client.py pattern."""
    import httpx

    token = await get_valid_token(user_id, "google")
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Google not connected. Connect via Settings > Integrations.",
        )

    extra_headers = kwargs.pop("headers", {})

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(
                method, url,
                headers={"Authorization": f"Bearer {token}", **extra_headers},
                **kwargs,
            )

            if resp.status_code == 401:
                logger.info("Gmail API 401 for user=%s, refreshing token...", user_id)
                token = await refresh_google_token(user_id)
                if not token:
                    raise HTTPException(
                        status_code=401,
                        detail="Google token expired. Please reconnect in Settings.",
                    )
                resp = await client.request(
                    method, url,
                    headers={"Authorization": f"Bearer {token}", **extra_headers},
                    **kwargs,
                )

            return resp
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Gmail API error: %s %s user=%s err=%s", method, url, user_id, exc)
        raise HTTPException(status_code=502, detail="Failed to reach Gmail API.")


def _extract_attachments_from_payload(payload: dict) -> List[dict]:
    """Walk message payload tree and extract attachment metadata."""
    attachments: List[dict] = []

    def _walk(part: dict):
        filename = part.get("filename", "")
        mime_type = part.get("mimeType", "")
        attachment_id = part.get("body", {}).get("attachmentId", "")
        size = part.get("body", {}).get("size", 0)

        if filename and attachment_id and mime_type in SYNCABLE_MIME_TYPES:
            attachments.append({
                "filename": filename,
                "mime_type": mime_type,
                "attachment_id": attachment_id,
                "size": size,
            })

        for sub_part in part.get("parts", []):
            _walk(sub_part)

    _walk(payload)
    return attachments


def _parse_gmail_headers(headers: list) -> dict:
    """Extract common headers from Gmail message payload."""
    result = {}
    for h in headers:
        name = h.get("name", "").lower()
        if name in ("from", "to", "subject", "date"):
            result[name] = h.get("value", "")
    return result


async def _download_and_store_attachment(
    user_id: str,
    message_id: str,
    att_meta: dict,
    claim_id: str,
    uploaded_by: str,
    email_subject: str = "",
    email_sender: str = "",
) -> dict:
    """Download a single attachment from Gmail, store in GridFS, create document record."""
    attachment_id = att_meta["attachment_id"]
    filename = att_meta["filename"]
    mime_type = att_meta["mime_type"]

    # Download attachment binary data via Gmail API
    resp = await _gmail_request(
        user_id, "GET",
        f"{GMAIL_API}/messages/{message_id}/attachments/{attachment_id}",
    )
    if resp.status_code != 200:
        return {
            "filename": filename,
            "status": "error",
            "detail": f"Gmail API returned {resp.status_code}",
        }

    data = resp.json()
    raw_data = data.get("data", "")
    if not raw_data:
        return {"filename": filename, "status": "error", "detail": "Empty attachment data"}

    file_bytes = base64.urlsafe_b64decode(raw_data)
    size_bytes = len(file_bytes)

    if size_bytes > MAX_ATTACHMENT_SIZE:
        return {
            "filename": filename,
            "status": "skipped",
            "detail": f"Exceeds {MAX_ATTACHMENT_SIZE // (1024 * 1024)}MB limit ({size_bytes} bytes)",
        }

    # Dedup check: same gmail message + attachment already synced?
    existing = await db.documents.find_one({
        "gmail_message_id": message_id,
        "gmail_attachment_id": attachment_id,
    })
    if existing:
        return {
            "filename": filename,
            "status": "skipped",
            "detail": "Already synced",
            "document_id": existing.get("id"),
        }

    # Generate safe filename and store in GridFS
    file_id = str(uuid.uuid4())
    ext = MIME_TO_EXT.get(mime_type, Path(filename).suffix or ".bin")
    safe_name = _sanitize_filename(filename)
    storage_filename = f"{file_id}{ext}"

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

    now = _now_iso()

    # Insert into documents collection (matches email_log.py pattern)
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
        "gmail_message_id": message_id,
        "gmail_attachment_id": attachment_id,
        "grid_id": str(grid_id),
        "storage": "gridfs",
        "storage_filename": storage_filename,
        "gmail_subject": email_subject,
        "gmail_sender": email_sender,
    }
    await db.documents.insert_one(doc_record)

    # Also create uploaded_files record for the uploads system
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
    await db.uploaded_files.insert_one(uploaded_file_record)

    return {
        "filename": safe_name,
        "status": "synced",
        "document_id": file_id,
        "size_bytes": size_bytes,
        "mime_type": mime_type,
    }


# ---------------------------------------------------------------------------
# 1. Sync Attachments (manual — provide message IDs)
# ---------------------------------------------------------------------------

@router.post("/sync-attachments")
async def sync_attachments(
    data: SyncAttachmentsRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Download all PDF/image attachments from specified Gmail messages
    and store them in Eden linked to the given claim.

    Admin/manager only.
    """
    if current_user.get("role") not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager access required")

    user_id = _get_user_id(current_user)
    uploaded_by = current_user.get("full_name", current_user.get("email", "system"))

    # Verify claim exists
    claim = await db.claims.find_one({"id": data.claim_id}, {"_id": 0, "id": 1, "claim_number": 1})
    if not claim:
        raise HTTPException(status_code=404, detail=f"Claim {data.claim_id} not found")

    results: List[dict] = []
    total_synced = 0
    total_skipped = 0
    total_errors = 0

    for msg_id in data.gmail_message_ids:
        # Fetch full message to get attachment metadata
        msg_resp = await _gmail_request(
            user_id, "GET",
            f"{GMAIL_API}/messages/{msg_id}",
            params={"format": "full"},
        )
        if msg_resp.status_code != 200:
            results.append({
                "message_id": msg_id,
                "status": "error",
                "detail": f"Failed to fetch message (HTTP {msg_resp.status_code})",
                "attachments": [],
            })
            total_errors += 1
            continue

        msg_data = msg_resp.json()
        payload = msg_data.get("payload", {})
        headers = _parse_gmail_headers(payload.get("headers", []))
        attachment_metas = _extract_attachments_from_payload(payload)

        if not attachment_metas:
            results.append({
                "message_id": msg_id,
                "subject": headers.get("subject", ""),
                "status": "no_attachments",
                "attachments": [],
            })
            continue

        msg_subject = headers.get("subject", "")
        msg_sender = headers.get("from", "")

        msg_results: List[dict] = []
        for att_meta in attachment_metas:
            result = await _download_and_store_attachment(
                user_id, msg_id, att_meta, data.claim_id, uploaded_by,
                email_subject=msg_subject,
                email_sender=msg_sender,
            )
            msg_results.append(result)
            if result["status"] == "synced":
                total_synced += 1
            elif result["status"] == "skipped":
                total_skipped += 1
            else:
                total_errors += 1

        results.append({
            "message_id": msg_id,
            "subject": msg_subject,
            "from": msg_sender,
            "date": headers.get("date", ""),
            "attachments": msg_results,
        })

    # Log the sync run
    await db.gmail_sync_runs.insert_one({
        "id": str(uuid.uuid4()),
        "type": "manual",
        "claim_id": data.claim_id,
        "claim_number": claim.get("claim_number"),
        "user_id": user_id,
        "run_by": uploaded_by,
        "run_at": _now_iso(),
        "messages_processed": len(data.gmail_message_ids),
        "total_synced": total_synced,
        "total_skipped": total_skipped,
        "total_errors": total_errors,
    })

    return {
        "claim_id": data.claim_id,
        "claim_number": claim.get("claim_number"),
        "messages_processed": len(data.gmail_message_ids),
        "total_synced": total_synced,
        "total_skipped": total_skipped,
        "total_errors": total_errors,
        "results": results,
    }


# ---------------------------------------------------------------------------
# 2. Auto-Sync (push button, walk away)
# ---------------------------------------------------------------------------

@router.post("/auto-sync")
async def auto_sync(
    data: AutoSyncRequest = AutoSyncRequest(),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Automatically search Gmail for emails mentioning Eden claim numbers,
    download ALL attachments, and link them to the correct claims.

    Admin only. This is the hands-free endpoint.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    user_id = _get_user_id(current_user)
    uploaded_by = current_user.get("full_name", current_user.get("email", "system"))

    # Load all active claims with claim numbers
    claims = await db.claims.find(
        {"claim_number": {"$exists": True, "$ne": ""}},
        {"_id": 0, "id": 1, "claim_number": 1, "client_name": 1},
    ).to_list(5000)

    if not claims:
        return {
            "message": "No claims with claim numbers found",
            "total_synced": 0,
            "total_skipped": 0,
            "total_errors": 0,
            "claims_matched": 0,
        }

    # Build claim number lookup
    claim_map: Dict[str, dict] = {}
    for c in claims:
        cn = c.get("claim_number", "").strip()
        if cn:
            claim_map[cn.lower()] = c

    # Build Gmail search query: has attachment + mentions any claim number
    # Gmail search: "has:attachment (claim_number_1 OR claim_number_2 OR ...)"
    # To avoid query length limits, batch in groups of 20
    claim_numbers = list(claim_map.keys())
    all_results: List[dict] = []
    total_synced = 0
    total_skipped = 0
    total_errors = 0
    claims_matched_set: set = set()
    processed_message_ids: set = set()

    batch_size = 20
    for batch_start in range(0, len(claim_numbers), batch_size):
        batch = claim_numbers[batch_start:batch_start + batch_size]
        query_parts = " OR ".join(f'"{cn}"' for cn in batch)
        gmail_query = f"has:attachment ({query_parts})"

        if data.only_unread:
            gmail_query += " is:unread"
        if data.date_after:
            gmail_query += f" after:{data.date_after}"

        # Search Gmail
        search_resp = await _gmail_request(
            user_id, "GET",
            f"{GMAIL_API}/messages",
            params={"q": gmail_query, "maxResults": min(data.max_messages, 100)},
        )
        if search_resp.status_code != 200:
            logger.warning("Gmail search failed for batch starting at %d: %s", batch_start, search_resp.text)
            continue

        search_data = search_resp.json()
        message_ids = [m["id"] for m in search_data.get("messages", [])]

        for msg_id in message_ids:
            if msg_id in processed_message_ids:
                continue
            processed_message_ids.add(msg_id)

            # Fetch full message
            msg_resp = await _gmail_request(
                user_id, "GET",
                f"{GMAIL_API}/messages/{msg_id}",
                params={"format": "full"},
            )
            if msg_resp.status_code != 200:
                total_errors += 1
                continue

            msg_data = msg_resp.json()
            payload = msg_data.get("payload", {})
            headers = _parse_gmail_headers(payload.get("headers", []))
            snippet = msg_data.get("snippet", "")

            # Determine which claim this email matches
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

            # Extract and download attachments
            attachment_metas = _extract_attachments_from_payload(payload)
            if not attachment_metas:
                continue

            msg_sender = headers.get("from", "")

            msg_results: List[dict] = []
            for att_meta in attachment_metas:
                result = await _download_and_store_attachment(
                    user_id, msg_id, att_meta, claim_id, uploaded_by,
                    email_subject=subject,
                    email_sender=msg_sender,
                )
                msg_results.append(result)
                if result["status"] == "synced":
                    total_synced += 1
                elif result["status"] == "skipped":
                    total_skipped += 1
                else:
                    total_errors += 1

            all_results.append({
                "message_id": msg_id,
                "subject": subject,
                "from": msg_sender,
                "date": headers.get("date", ""),
                "claim_id": claim_id,
                "claim_number": matched_claim.get("claim_number"),
                "attachments": msg_results,
            })

    # Log the sync run
    await db.gmail_sync_runs.insert_one({
        "id": str(uuid.uuid4()),
        "type": "auto",
        "user_id": user_id,
        "run_by": uploaded_by,
        "run_at": _now_iso(),
        "claims_searched": len(claim_numbers),
        "messages_processed": len(processed_message_ids),
        "claims_matched": len(claims_matched_set),
        "total_synced": total_synced,
        "total_skipped": total_skipped,
        "total_errors": total_errors,
    })

    return {
        "message": "Auto-sync complete",
        "claims_searched": len(claim_numbers),
        "messages_processed": len(processed_message_ids),
        "claims_matched": len(claims_matched_set),
        "total_synced": total_synced,
        "total_skipped": total_skipped,
        "total_errors": total_errors,
        "results": all_results,
    }


# ---------------------------------------------------------------------------
# 3. Status
# ---------------------------------------------------------------------------

@router.get("/status")
async def sync_status(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Check Gmail sync status: recent runs, total synced documents, connectivity.
    """
    if current_user.get("role") not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager access required")

    user_id = _get_user_id(current_user)

    # Check Google OAuth connectivity
    token = await get_valid_token(user_id, "google")
    google_connected = token is not None

    # Recent sync runs
    recent_runs = await db.gmail_sync_runs.find(
        {}, {"_id": 0},
    ).sort("run_at", -1).limit(10).to_list(10)

    # Total synced documents
    total_synced_docs = await db.documents.count_documents({"source": "gmail_sync"})

    # Documents by claim
    pipeline = [
        {"$match": {"source": "gmail_sync"}},
        {"$group": {"_id": "$claim_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20},
    ]
    docs_by_claim = await db.documents.aggregate(pipeline).to_list(20)

    return {
        "google_connected": google_connected,
        "gmail_scope_available": google_connected,  # gmail.readonly is in OAuth scopes
        "total_synced_documents": total_synced_docs,
        "recent_runs": recent_runs,
        "documents_by_claim": [
            {"claim_id": d["_id"], "document_count": d["count"]}
            for d in docs_by_claim
        ],
    }


# ---------------------------------------------------------------------------
# 4. Categorize All Synced Documents by Filename + Email Context
# ---------------------------------------------------------------------------

# --- Filename-based rules (original, checked first) ---
FILENAME_TYPE_RULES = [
    (["estimate", "est_", "scope", "xactimate", "statement_of_loss", "statement of loss"], "estimate"),
    (["settlement", "payment letter", "payment_letter", "stlmnt"], "settlement_letter"),
    (["policy", "certified", "non-certified", "dec_page", "declarations", "cop_",
      "dec page", "declaration page", "policy_copy", "copy of policy"], "policy"),
    (["coverage determination", "coverage_determination", "coverage decision",
      "coverage_letter", "pd_coverage", "reservation of rights", "reservation_of_rights",
      "ror"], "coverage_determination"),
    (["lor", "letter of representation", "letter_of_representation",
      "acknowledgement", "acknowledgment", "pa_acknowledgement"], "lor"),
    (["supplement"], "supplement"),
    (["invoice"], "invoice"),
    (["release", "global_release"], "release"),
    (["denial", "denied"], "denial_letter"),
    (["inspection", "report bundle", "report_bundle", "audit"], "inspection_report"),
    (["mediation", "brochure"], "mediation"),
    (["bid", "proposal"], "contractor_bid"),
    (["photo", "img_", "img-", "image", ".jpg", ".jpeg", ".png", ".heic"], "photo"),
    (["contract", "agreement", "care_claims_contract"], "contract"),
    (["w9", "w-9", "attestation"], "tax_form"),
    (["variation"], "variation_report"),
]

# --- Subject-line patterns that indicate a policy document ---
SUBJECT_POLICY_PATTERNS = [
    "policy",
    "certified copy",
    "non-certified copy",
    "declaration",
    "dec page",
    "declarations page",
    "insurance policy",
    "copy of policy",
    "requested documents",
    "policy documents",
    "policy enclosed",
    "your policy",
    "homeowner policy",
    "homeowners policy",
    "dwelling policy",
    "ho3 policy",
    "ho-3 policy",
    "dp3 policy",
    "dp-3 policy",
]

# --- Carrier-specific sender + subject combos that indicate policies ---
# Each entry: (sender_contains, subject_contains, doc_type)
CARRIER_SPECIFIC_RULES = [
    # Universal Property: "Requested Documents" emails contain policies
    ("universal", "requested documents", "policy"),
    ("universal property", "requested documents", "policy"),
    ("universalproperty", "requested documents", "policy"),
    # State Farm: multi-part policy copies
    ("state farm", "copy of policy", "policy"),
    ("statefarm", "copy of policy", "policy"),
    ("state farm", "policy documents", "policy"),
    # Griston: LOR responses often bundle policy docs
    ("griston", "lor", "policy"),
    ("griston", "letter of representation", "policy"),
    ("griston", "response", "policy"),
    # People's Trust: DoNotReply with policy attachments
    ("peoples trust", "donotreply", "policy"),
    ("peoplestrust", "", "policy"),
    ("donotreply@peoplestrust", "", "policy"),
    ("noreply@peoplestrust", "", "policy"),
    # Citizens Property Insurance
    ("citizens", "policy", "policy"),
    ("citizenspropertyinsurance", "", "policy"),
    # Heritage Property & Casualty
    ("heritage", "policy", "policy"),
    # FedNat / Monarch National
    ("fednat", "policy", "policy"),
    ("monarch", "policy", "policy"),
    # American Integrity
    ("american integrity", "policy", "policy"),
    # Security First
    ("security first", "policy", "policy"),
    ("securityfirstflorida", "policy", "policy"),
]

# --- Filename patterns that indicate policies when found in carrier emails ---
POLICY_ATTACHMENT_FILENAME_HINTS = [
    "dec",
    "declaration",
    "certified",
    "non-certified",
    "cop_",
    "cop-",
    "copy_of_policy",
    "policy_copy",
    "ho3",
    "ho-3",
    "dp3",
    "dp-3",
    "dwelling",
    "homeowner",
    "endorsement",
    "renewal",
    "binder",
]


def _categorize_filename(filename: str) -> str:
    """Categorize by filename only (legacy, used when no email context available)."""
    fn = filename.lower()
    for patterns, doc_type in FILENAME_TYPE_RULES:
        if any(p in fn for p in patterns):
            return doc_type
    if "report" in fn and "photo" not in fn:
        return "inspection_report"
    return "carrier_correspondence"


def _categorize_document(
    filename: str,
    subject: str = "",
    sender: str = "",
) -> str:
    """Categorize a document using filename, email subject, and sender.

    Priority:
      1. Filename match (most specific)
      2. Carrier-specific sender+subject combo
      3. Subject-line policy patterns
      4. Fallback to carrier_correspondence
    """
    fn_lower = filename.lower()
    subject_lower = subject.lower()
    sender_lower = sender.lower()

    # 1. Filename match (existing logic — catches explicit names)
    for patterns, doc_type in FILENAME_TYPE_RULES:
        if any(p in fn_lower for p in patterns):
            return doc_type
    if "report" in fn_lower and "photo" not in fn_lower:
        return "inspection_report"

    # 2. Carrier-specific rules (sender + subject combos)
    for sender_pattern, subject_pattern, doc_type in CARRIER_SPECIFIC_RULES:
        sender_match = sender_pattern in sender_lower if sender_pattern else True
        subject_match = subject_pattern in subject_lower if subject_pattern else True
        if sender_match and subject_match:
            # Extra check: does the filename look like a policy attachment?
            has_policy_hint = any(hint in fn_lower for hint in POLICY_ATTACHMENT_FILENAME_HINTS)
            # If sender+subject match AND filename has a hint, definitely policy
            if has_policy_hint:
                return doc_type
            # If sender+subject match strongly (both non-empty), trust it
            if sender_pattern and subject_pattern:
                return doc_type

    # 3. Subject-line policy patterns (broad catch)
    if any(pattern in subject_lower for pattern in SUBJECT_POLICY_PATTERNS):
        # Confirm with filename hint to avoid false positives on non-policy attachments
        has_policy_hint = any(hint in fn_lower for hint in POLICY_ATTACHMENT_FILENAME_HINTS)
        if has_policy_hint:
            return "policy"
        # Strong subject signals — trust without filename confirmation
        strong_subject_signals = [
            "copy of policy",
            "certified copy",
            "non-certified copy",
            "dec page",
            "declarations page",
            "insurance policy",
            "requested documents",
        ]
        if any(signal in subject_lower for signal in strong_subject_signals):
            return "policy"

    # 4. Fallback
    return "carrier_correspondence"


@router.post("/categorize-documents")
async def categorize_synced_documents(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Batch-categorize all gmail_attachment documents by filename pattern.

    Updates document type from 'gmail_attachment' to a proper category
    (estimate, policy, lor, photo, contract, etc.) and adds a document
    inventory note to each affected claim.
    """
    if current_user.get("role") not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager access required")

    cursor = db.documents.find(
        {"type": "gmail_attachment"},
        {"_id": 0, "id": 1, "claim_id": 1, "name": 1, "type": 1,
         "gmail_subject": 1, "gmail_sender": 1},
    )
    docs = await cursor.to_list(5000)
    if not docs:
        return {"message": "No uncategorized gmail_attachment documents found", "updated": 0}

    category_counts: dict = {}
    updated = 0
    claim_summaries: dict = {}

    for doc in docs:
        new_type = _categorize_document(
            doc["name"],
            subject=doc.get("gmail_subject", ""),
            sender=doc.get("gmail_sender", ""),
        )
        category_counts[new_type] = category_counts.get(new_type, 0) + 1

        cid = doc["claim_id"]
        if cid not in claim_summaries:
            claim_summaries[cid] = {}
        claim_summaries[cid][new_type] = claim_summaries[cid].get(new_type, 0) + 1

        result = await db.documents.update_one(
            {"id": doc["id"]},
            {"$set": {"type": new_type, "source": "gmail_sync"}},
        )
        if result.modified_count > 0:
            updated += 1

    # Add document inventory note to each affected claim
    notes_added = 0
    for cid, cats in claim_summaries.items():
        total_docs = sum(cats.values())
        lines = [f"[Document Inventory] Auto-categorized from Gmail ({total_docs} docs):"]
        for cat_name, count in sorted(cats.items(), key=lambda x: -x[1]):
            lines.append(f"  - {cat_name}: {count}")

        note_record = {
            "id": str(uuid.uuid4()),
            "claim_id": cid,
            "content": "\n".join(lines),
            "tags": ["document_inventory", "deep_scrub", "auto_categorized"],
            "author_id": current_user.get("id", "system"),
            "author_name": current_user.get("full_name", "System"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.notes.insert_one(note_record)
        notes_added += 1

    return {
        "message": f"Categorized {updated} documents across {len(claim_summaries)} claims",
        "total_docs": len(docs),
        "updated": updated,
        "claims_affected": len(claim_summaries),
        "notes_added": notes_added,
        "category_breakdown": dict(sorted(category_counts.items(), key=lambda x: -x[1])),
    }


# ---------------------------------------------------------------------------
# 5. Re-categorize carrier_correspondence documents (catch missed policies)
# ---------------------------------------------------------------------------

class RecategorizeRequest(BaseModel):
    dry_run: bool = Field(default=True, description="Preview changes without applying")
    source_types: List[str] = Field(
        default=["carrier_correspondence"],
        description="Document types to re-evaluate",
    )


@router.post("/recategorize-documents")
async def recategorize_documents(
    data: RecategorizeRequest = RecategorizeRequest(),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Re-evaluate existing documents (default: carrier_correspondence) using
    the enhanced categorization that checks email subject + sender + filename.

    Catches policy documents that were originally miscategorized because
    the filename-only logic missed them.

    Set dry_run=false to apply changes.
    """
    if current_user.get("role") not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager access required")

    cursor = db.documents.find(
        {
            "type": {"$in": data.source_types},
            "source": "gmail_sync",
        },
        {
            "_id": 0, "id": 1, "claim_id": 1, "name": 1, "type": 1,
            "gmail_subject": 1, "gmail_sender": 1, "gmail_message_id": 1,
        },
    )
    docs = await cursor.to_list(5000)
    if not docs:
        return {
            "message": "No documents found matching source types",
            "total_evaluated": 0,
            "would_change": 0,
            "dry_run": data.dry_run,
        }

    changes: List[dict] = []
    unchanged = 0
    category_counts: dict = {}
    claim_summaries: dict = {}

    for doc in docs:
        old_type = doc["type"]
        new_type = _categorize_document(
            doc["name"],
            subject=doc.get("gmail_subject", ""),
            sender=doc.get("gmail_sender", ""),
        )

        if new_type == old_type:
            unchanged += 1
            continue

        changes.append({
            "document_id": doc["id"],
            "claim_id": doc["claim_id"],
            "filename": doc["name"],
            "old_type": old_type,
            "new_type": new_type,
            "gmail_subject": doc.get("gmail_subject", ""),
            "gmail_sender": doc.get("gmail_sender", ""),
        })

        category_counts[new_type] = category_counts.get(new_type, 0) + 1
        cid = doc["claim_id"]
        if cid not in claim_summaries:
            claim_summaries[cid] = {"reclassified": []}
        claim_summaries[cid]["reclassified"].append({
            "filename": doc["name"],
            "old": old_type,
            "new": new_type,
        })

    applied = 0
    notes_added = 0

    if not data.dry_run and changes:
        for change in changes:
            result = await db.documents.update_one(
                {"id": change["document_id"]},
                {"$set": {
                    "type": change["new_type"],
                    "recategorized_at": _now_iso(),
                    "recategorized_from": change["old_type"],
                }},
            )
            if result.modified_count > 0:
                applied += 1

        # Add notes to affected claims
        for cid, summary in claim_summaries.items():
            reclassified = summary["reclassified"]
            lines = [
                f"[Re-categorization] {len(reclassified)} document(s) reclassified:"
            ]
            for item in reclassified:
                lines.append(
                    f"  - \"{item['filename']}\": {item['old']} -> {item['new']}"
                )

            note_record = {
                "id": str(uuid.uuid4()),
                "claim_id": cid,
                "content": "\n".join(lines),
                "tags": ["document_inventory", "recategorized", "policy_recovery"],
                "author_id": current_user.get("id", "system"),
                "author_name": current_user.get("full_name", "System"),
                "created_at": _now_iso(),
            }
            await db.notes.insert_one(note_record)
            notes_added += 1

    return {
        "message": (
            f"{'[DRY RUN] ' if data.dry_run else ''}Re-categorization: "
            f"{len(changes)} changes across {len(claim_summaries)} claims"
        ),
        "dry_run": data.dry_run,
        "total_evaluated": len(docs),
        "would_change": len(changes),
        "unchanged": unchanged,
        "applied": applied,
        "notes_added": notes_added,
        "category_breakdown": dict(sorted(category_counts.items(), key=lambda x: -x[1])),
        "changes": changes[:100],  # Cap preview to first 100 for response size
    }


# ---------------------------------------------------------------------------
# 6. Backfill email metadata on existing documents (one-time migration)
# ---------------------------------------------------------------------------

@router.post("/backfill-email-metadata")
async def backfill_email_metadata(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Backfill gmail_subject and gmail_sender on existing synced documents
    that are missing this metadata. Fetches from Gmail API using stored
    gmail_message_id.

    Required before re-categorization can work on old documents.
    Admin only.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    user_id = _get_user_id(current_user)

    # Find documents with gmail_message_id but no gmail_subject
    cursor = db.documents.find(
        {
            "source": "gmail_sync",
            "gmail_message_id": {"$exists": True, "$ne": ""},
            "$or": [
                {"gmail_subject": {"$exists": False}},
                {"gmail_subject": ""},
                {"gmail_subject": None},
            ],
        },
        {"_id": 0, "id": 1, "gmail_message_id": 1},
    )
    docs = await cursor.to_list(5000)
    if not docs:
        return {"message": "All synced documents already have email metadata", "updated": 0}

    # Deduplicate message IDs to minimize API calls
    msg_id_to_doc_ids: dict = {}
    for doc in docs:
        mid = doc["gmail_message_id"]
        if mid not in msg_id_to_doc_ids:
            msg_id_to_doc_ids[mid] = []
        msg_id_to_doc_ids[mid].append(doc["id"])

    updated = 0
    errors = 0

    for msg_id, doc_ids in msg_id_to_doc_ids.items():
        try:
            msg_resp = await _gmail_request(
                user_id, "GET",
                f"{GMAIL_API}/messages/{msg_id}",
                params={"format": "metadata", "metadataHeaders": "From,Subject"},
            )
        except Exception as exc:
            logger.warning("backfill: failed to fetch message %s: %s", msg_id, exc)
            errors += 1
            continue

        if msg_resp.status_code != 200:
            errors += 1
            continue

        msg_data = msg_resp.json()
        headers = _parse_gmail_headers(msg_data.get("payload", {}).get("headers", []))
        subject = headers.get("subject", "")
        sender = headers.get("from", "")

        for doc_id in doc_ids:
            result = await db.documents.update_one(
                {"id": doc_id},
                {"$set": {
                    "gmail_subject": subject,
                    "gmail_sender": sender,
                }},
            )
            if result.modified_count > 0:
                updated += 1

    return {
        "message": f"Backfilled email metadata on {updated} documents",
        "total_documents": len(docs),
        "unique_messages": len(msg_id_to_doc_ids),
        "updated": updated,
        "errors": errors,
    }

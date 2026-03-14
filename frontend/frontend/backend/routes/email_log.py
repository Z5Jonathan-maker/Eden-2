"""
Email Log Routes — External Email Logging & Attachment System

Adjusters log emails (Gmail, Outlook, manual) into claims as a permanent
paper trail.  Attachments are decoded, saved to the uploads directory, and
linked into the documents collection so they appear in the claim's Documents
tab automatically.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel, Field
from dependencies import db, get_current_active_user
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pathlib import Path
import uuid
import os
import re
import base64
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/email-log", tags=["Email Log"])

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", str(Path(__file__).parent.parent / "uploads"))
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

EMAIL_ATTACHMENTS_DIR = os.path.join(UPLOAD_DIR, "email_attachments")
Path(EMAIL_ATTACHMENTS_DIR).mkdir(parents=True, exist_ok=True)

VALID_DIRECTIONS = {"inbound", "outbound"}
VALID_SOURCES = {"gmail", "outlook", "manual"}
VALID_LABELS = {
    "settlement", "estimate", "denial", "carrier",
    "client", "attorney", "supplement", "inspection",
    "legal", "general",
}

MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024  # 25 MB per attachment
MAX_BATCH_SIZE = 50


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class AttachmentInput(BaseModel):
    filename: str
    content_type: str = "application/octet-stream"
    data_base64: str  # base64-encoded file content


class EmailLogCreate(BaseModel):
    claim_id: Optional[str] = None
    claim_number: Optional[str] = None
    direction: str  # inbound | outbound
    from_address: str
    from_name: Optional[str] = None
    to_addresses: List[str] = []
    cc_addresses: List[str] = []
    bcc_addresses: List[str] = []
    subject: str = ""
    body_text: str = ""
    body_html: Optional[str] = None
    date_sent: Optional[str] = None  # ISO string — original email timestamp
    source: str = "manual"  # gmail | outlook | manual
    gmail_message_id: Optional[str] = None
    thread_id: Optional[str] = None
    labels: List[str] = []
    is_important: bool = False
    is_read: bool = True
    ai_summary: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    attachments: List[AttachmentInput] = []


class EmailLogUpdate(BaseModel):
    labels: Optional[List[str]] = None
    is_important: Optional[bool] = None
    is_read: Optional[bool] = None
    ai_summary: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    claim_id: Optional[str] = None
    claim_number: Optional[str] = None
    notes: Optional[str] = None


class EmailLogBatch(BaseModel):
    emails: List[EmailLogCreate]


class AutoMatchRequest(BaseModel):
    limit: int = Field(default=100, le=500)


class SearchParams(BaseModel):
    """Query-string parameters for email search."""
    pass  # FastAPI pulls from Query()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sanitize_filename(name: str) -> str:
    """Strip unsafe characters, preserve extension."""
    name = os.path.basename(name)
    name = re.sub(r"[^\w.\-()]", "_", name)
    return name[:255] if name else "unnamed"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _save_base64_attachment(
    att: AttachmentInput,
    claim_id: Optional[str],
    logged_by: str,
) -> dict:
    """Decode base64 data, write to disk, insert into documents collection."""
    try:
        raw = base64.b64decode(att.data_base64, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid base64 data for {att.filename}")

    size_bytes = len(raw)
    if size_bytes > MAX_ATTACHMENT_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Attachment {att.filename} exceeds {MAX_ATTACHMENT_SIZE // (1024*1024)}MB limit",
        )

    safe_name = _sanitize_filename(att.filename)
    unique_name = f"{uuid.uuid4().hex[:12]}_{safe_name}"
    file_path = os.path.join(EMAIL_ATTACHMENTS_DIR, unique_name)

    with open(file_path, "wb") as f:
        f.write(raw)

    doc_id = str(uuid.uuid4())
    now = _now_iso()

    # Insert into documents collection so it appears in claim Documents tab
    doc_record = {
        "id": doc_id,
        "claim_id": claim_id or "",
        "name": safe_name,
        "type": "email_attachment",
        "size": f"{size_bytes / 1024:.2f} KB",
        "uploaded_by": logged_by,
        "uploaded_at": now,
        "file_path": file_path,
    }
    await db.documents.insert_one(doc_record)

    return {
        "filename": safe_name,
        "content_type": att.content_type,
        "size_bytes": size_bytes,
        "document_id": doc_id,
    }


async def _build_email_doc(
    data: EmailLogCreate,
    user: dict,
) -> dict:
    """Validate inputs, process attachments, return a ready-to-insert dict."""
    if data.direction not in VALID_DIRECTIONS:
        raise HTTPException(status_code=400, detail=f"direction must be one of {VALID_DIRECTIONS}")
    if data.source not in VALID_SOURCES:
        raise HTTPException(status_code=400, detail=f"source must be one of {VALID_SOURCES}")

    invalid_labels = set(data.labels) - VALID_LABELS
    if invalid_labels:
        raise HTTPException(status_code=400, detail=f"Invalid labels: {invalid_labels}")

    # Gmail dedup check
    if data.gmail_message_id:
        existing = await db.email_logs.find_one(
            {"gmail_message_id": data.gmail_message_id, "is_deleted": {"$ne": True}},
            {"_id": 0, "id": 1},
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Email already logged (id={existing['id']}). Duplicate gmail_message_id.",
            )

    logged_by = user.get("full_name", user.get("email", "unknown"))

    # Process attachments
    attachment_records: List[dict] = []
    for att in data.attachments:
        record = await _save_base64_attachment(att, data.claim_id, logged_by)
        attachment_records.append(record)

    now = _now_iso()
    email_id = str(uuid.uuid4())

    return {
        "id": email_id,
        "claim_id": data.claim_id,
        "claim_number": data.claim_number,
        "direction": data.direction,
        "from_address": data.from_address,
        "from_name": data.from_name,
        "to_addresses": data.to_addresses,
        "cc_addresses": data.cc_addresses,
        "bcc_addresses": data.bcc_addresses,
        "subject": data.subject,
        "body_text": data.body_text,
        "body_html": data.body_html,
        "date_sent": data.date_sent or now,
        "source": data.source,
        "gmail_message_id": data.gmail_message_id,
        "thread_id": data.thread_id,
        "labels": data.labels,
        "attachments": attachment_records,
        "is_important": data.is_important,
        "is_read": data.is_read,
        "ai_summary": data.ai_summary,
        "extracted_data": data.extracted_data,
        "logged_by": logged_by,
        "logged_by_id": user.get("id"),
        "logged_at": now,
        "is_deleted": False,
        "notes": None,
    }


# ---------------------------------------------------------------------------
# 1. CRUD Endpoints
# ---------------------------------------------------------------------------

@router.post("/")
async def log_email(
    data: EmailLogCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """Log a single email with optional base64 attachments."""
    doc = await _build_email_doc(data, current_user)
    await db.email_logs.insert_one(doc)
    doc.pop("_id", None)
    return {"message": "Email logged", "email_log": doc}


@router.get("/claim/{claim_id}")
async def get_emails_for_claim(
    claim_id: str,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user),
):
    """All emails linked to a claim, sorted newest-first."""
    emails = (
        await db.email_logs.find(
            {"claim_id": claim_id, "is_deleted": {"$ne": True}},
            {"_id": 0},
        )
        .sort("date_sent", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    total = await db.email_logs.count_documents(
        {"claim_id": claim_id, "is_deleted": {"$ne": True}},
    )
    return {"emails": emails, "total": total, "skip": skip, "limit": limit}


@router.get("/detail/{email_id}")
async def get_email_detail(
    email_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Single email detail."""
    email = await db.email_logs.find_one(
        {"id": email_id, "is_deleted": {"$ne": True}},
        {"_id": 0},
    )
    if not email:
        raise HTTPException(status_code=404, detail="Email log not found")
    return email


@router.patch("/{email_id}")
async def update_email_log(
    email_id: str,
    data: EmailLogUpdate,
    current_user: dict = Depends(get_current_active_user),
):
    """Update tags, importance, notes, or link to a claim."""
    update_dict: Dict[str, Any] = {}
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            if field == "labels":
                invalid = set(value) - VALID_LABELS
                if invalid:
                    raise HTTPException(status_code=400, detail=f"Invalid labels: {invalid}")
            update_dict[field] = value

    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_dict["updated_at"] = _now_iso()
    update_dict["updated_by"] = current_user.get("full_name", "unknown")

    result = await db.email_logs.update_one(
        {"id": email_id, "is_deleted": {"$ne": True}},
        {"$set": update_dict},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Email log not found")

    return {"message": "Email log updated"}


@router.delete("/{email_id}")
async def delete_email_log(
    email_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Soft-delete an email log entry."""
    result = await db.email_logs.update_one(
        {"id": email_id, "is_deleted": {"$ne": True}},
        {
            "$set": {
                "is_deleted": True,
                "deleted_at": _now_iso(),
                "deleted_by": current_user.get("full_name", "unknown"),
            }
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Email log not found")

    return {"message": "Email log deleted"}


# ---------------------------------------------------------------------------
# 2. Batch
# ---------------------------------------------------------------------------

@router.post("/batch")
async def log_emails_batch(
    data: EmailLogBatch,
    current_user: dict = Depends(get_current_active_user),
):
    """Log multiple emails at once (e.g. Gmail sync). Max 50 per request."""
    if len(data.emails) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Batch size exceeds maximum of {MAX_BATCH_SIZE}",
        )

    results: List[dict] = []
    errors: List[dict] = []

    for idx, email_data in enumerate(data.emails):
        try:
            doc = await _build_email_doc(email_data, current_user)
            await db.email_logs.insert_one(doc)
            doc.pop("_id", None)
            results.append({"index": idx, "id": doc["id"], "status": "created"})
        except HTTPException as exc:
            # 409 = duplicate — skip gracefully
            results.append({
                "index": idx,
                "status": "skipped" if exc.status_code == 409 else "error",
                "detail": exc.detail,
            })
            errors.append({"index": idx, "detail": exc.detail})
        except Exception as exc:
            logger.error("Batch email insert error at index %d: %s", idx, exc)
            results.append({"index": idx, "status": "error", "detail": str(exc)[:200]})
            errors.append({"index": idx, "detail": str(exc)[:200]})

    return {
        "total": len(data.emails),
        "created": sum(1 for r in results if r["status"] == "created"),
        "skipped": sum(1 for r in results if r["status"] == "skipped"),
        "errors": len(errors),
        "results": results,
    }


# ---------------------------------------------------------------------------
# 3. Search
# ---------------------------------------------------------------------------

@router.get("/search")
async def search_email_logs(
    q: Optional[str] = None,
    from_address: Optional[str] = None,
    to_address: Optional[str] = None,
    label: Optional[str] = None,
    direction: Optional[str] = None,
    source: Optional[str] = None,
    claim_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    is_important: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user),
):
    """Search email logs with flexible filters."""
    query: Dict[str, Any] = {"is_deleted": {"$ne": True}}

    if q:
        query["$or"] = [
            {"subject": {"$regex": q, "$options": "i"}},
            {"body_text": {"$regex": q, "$options": "i"}},
            {"from_address": {"$regex": q, "$options": "i"}},
            {"from_name": {"$regex": q, "$options": "i"}},
        ]
    if from_address:
        query["from_address"] = {"$regex": from_address, "$options": "i"}
    if to_address:
        query["to_addresses"] = {"$regex": to_address, "$options": "i"}
    if label:
        query["labels"] = label
    if direction and direction in VALID_DIRECTIONS:
        query["direction"] = direction
    if source and source in VALID_SOURCES:
        query["source"] = source
    if claim_id:
        query["claim_id"] = claim_id
    if is_important is not None:
        query["is_important"] = is_important

    if date_from or date_to:
        date_filter: Dict[str, str] = {}
        if date_from:
            date_filter["$gte"] = date_from
        if date_to:
            date_filter["$lte"] = date_to
        query["date_sent"] = date_filter

    emails = (
        await db.email_logs.find(query, {"_id": 0})
        .sort("date_sent", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    total = await db.email_logs.count_documents(query)

    return {"emails": emails, "total": total, "skip": skip, "limit": limit}


@router.get("/unmatched")
async def get_unmatched_emails(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_active_user),
):
    """Emails not yet linked to a claim."""
    query = {
        "is_deleted": {"$ne": True},
        "$or": [
            {"claim_id": None},
            {"claim_id": ""},
            {"claim_id": {"$exists": False}},
        ],
    }
    emails = (
        await db.email_logs.find(query, {"_id": 0})
        .sort("date_sent", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    total = await db.email_logs.count_documents(query)

    return {"emails": emails, "total": total, "skip": skip, "limit": limit}


# ---------------------------------------------------------------------------
# 4. Attachment Upload (multipart form)
# ---------------------------------------------------------------------------

@router.post("/{email_id}/attachments")
async def upload_attachment(
    email_id: str,
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_active_user),
):
    """Upload attachment files to an existing email log entry."""
    email = await db.email_logs.find_one(
        {"id": email_id, "is_deleted": {"$ne": True}},
        {"_id": 0, "id": 1, "claim_id": 1, "attachments": 1},
    )
    if not email:
        raise HTTPException(status_code=404, detail="Email log not found")

    logged_by = current_user.get("full_name", "unknown")
    claim_id = email.get("claim_id")
    new_attachments: List[dict] = []

    for upload_file in files:
        content = await upload_file.read()
        if len(content) > MAX_ATTACHMENT_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"{upload_file.filename} exceeds {MAX_ATTACHMENT_SIZE // (1024*1024)}MB limit",
            )

        safe_name = _sanitize_filename(upload_file.filename or "unnamed")
        unique_name = f"{uuid.uuid4().hex[:12]}_{safe_name}"
        file_path = os.path.join(EMAIL_ATTACHMENTS_DIR, unique_name)

        with open(file_path, "wb") as f:
            f.write(content)

        doc_id = str(uuid.uuid4())
        now = _now_iso()

        doc_record = {
            "id": doc_id,
            "claim_id": claim_id or "",
            "name": safe_name,
            "type": "email_attachment",
            "size": f"{len(content) / 1024:.2f} KB",
            "uploaded_by": logged_by,
            "uploaded_at": now,
            "file_path": file_path,
        }
        await db.documents.insert_one(doc_record)

        new_attachments.append({
            "filename": safe_name,
            "content_type": upload_file.content_type or "application/octet-stream",
            "size_bytes": len(content),
            "document_id": doc_id,
        })

    # Append to existing attachments array
    await db.email_logs.update_one(
        {"id": email_id},
        {
            "$push": {"attachments": {"$each": new_attachments}},
            "$set": {"updated_at": _now_iso()},
        },
    )

    return {
        "message": f"{len(new_attachments)} attachment(s) uploaded",
        "attachments": new_attachments,
    }


# ---------------------------------------------------------------------------
# 5. Auto-Matching
# ---------------------------------------------------------------------------

@router.post("/auto-match")
async def auto_match_emails(
    data: AutoMatchRequest = AutoMatchRequest(),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Attempt to match unlinked emails to claims by:
      1. Claim number mentioned in subject or body
      2. Client email address match
      3. Carrier adjuster email match
      4. Property address mention
    """
    unlinked_query = {
        "is_deleted": {"$ne": True},
        "$or": [
            {"claim_id": None},
            {"claim_id": ""},
            {"claim_id": {"$exists": False}},
        ],
    }
    unlinked = await db.email_logs.find(unlinked_query, {"_id": 0}).limit(data.limit).to_list(data.limit)

    if not unlinked:
        return {"matched": 0, "unmatched": 0, "results": []}

    # Pre-load claims for matching
    claims = await db.claims.find(
        {},
        {
            "_id": 0, "id": 1, "claim_number": 1,
            "client_email": 1, "client_name": 1,
            "carrier_adjuster_email": 1, "carrier_adjuster_name": 1,
            "property_address": 1, "loss_address": 1,
        },
    ).to_list(5000)

    # Build lookup indexes
    claim_number_map: Dict[str, dict] = {}
    email_map: Dict[str, dict] = {}
    address_claims: List[tuple] = []  # (address_lower, claim)

    for claim in claims:
        cn = claim.get("claim_number", "").strip()
        if cn:
            claim_number_map[cn.lower()] = claim

        for email_field in ("client_email", "carrier_adjuster_email"):
            addr = (claim.get(email_field) or "").strip().lower()
            if addr:
                email_map[addr] = claim

        for addr_field in ("property_address", "loss_address"):
            addr = (claim.get(addr_field) or "").strip().lower()
            if addr and len(addr) > 10:
                address_claims.append((addr, claim))

    results: List[dict] = []
    matched_count = 0

    for email_log in unlinked:
        match_claim = None
        match_method = None
        subject = (email_log.get("subject") or "").lower()
        body = (email_log.get("body_text") or "").lower()
        combined_text = f"{subject} {body}"

        # Strategy 1: claim number in subject or body
        for cn_lower, claim in claim_number_map.items():
            if cn_lower in combined_text:
                match_claim = claim
                match_method = "claim_number"
                break

        # Strategy 2: email address match
        if not match_claim:
            all_addresses = set()
            all_addresses.add((email_log.get("from_address") or "").lower())
            for addr in email_log.get("to_addresses", []):
                all_addresses.add(addr.lower())
            for addr in email_log.get("cc_addresses", []):
                all_addresses.add(addr.lower())
            all_addresses.discard("")

            for addr in all_addresses:
                if addr in email_map:
                    match_claim = email_map[addr]
                    match_method = "email_address"
                    break

        # Strategy 3: property address mention
        if not match_claim:
            for addr_lower, claim in address_claims:
                # Use significant portion of address (first ~30 chars typically covers street)
                addr_snippet = addr_lower[:40]
                if addr_snippet in combined_text:
                    match_claim = claim
                    match_method = "property_address"
                    break

        if match_claim:
            await db.email_logs.update_one(
                {"id": email_log["id"]},
                {
                    "$set": {
                        "claim_id": match_claim["id"],
                        "claim_number": match_claim.get("claim_number"),
                        "auto_matched": True,
                        "match_method": match_method,
                        "updated_at": _now_iso(),
                    }
                },
            )
            # Also update any attachment documents to link to this claim
            if email_log.get("attachments"):
                doc_ids = [a["document_id"] for a in email_log["attachments"] if a.get("document_id")]
                if doc_ids:
                    await db.documents.update_many(
                        {"id": {"$in": doc_ids}},
                        {"$set": {"claim_id": match_claim["id"]}},
                    )

            matched_count += 1
            results.append({
                "email_id": email_log["id"],
                "subject": email_log.get("subject"),
                "matched_claim_id": match_claim["id"],
                "matched_claim_number": match_claim.get("claim_number"),
                "match_method": match_method,
            })
        else:
            results.append({
                "email_id": email_log["id"],
                "subject": email_log.get("subject"),
                "matched_claim_id": None,
                "match_method": None,
            })

    return {
        "matched": matched_count,
        "unmatched": len(unlinked) - matched_count,
        "total_processed": len(unlinked),
        "results": results,
    }

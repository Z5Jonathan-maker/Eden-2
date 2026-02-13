from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File
from typing import List, Optional
from models import ClaimCreate, ClaimUpdate, Claim, NoteCreate, Note, DocumentCreate, Document
from dependencies import db, get_current_active_user, require_role, require_permission
from services.claims_service import ClaimsService
from utils.claim_aggregations import get_claim_with_related_counts, get_claims_list_optimized
import logging
import os
from datetime import datetime, timezone, timedelta

# Structured logging setup
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/claims", tags=["claims"])

# Dependency
def get_claims_service():
    return ClaimsService(db)


def _parse_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = str(value).strip()
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        parsed = datetime.fromisoformat(text)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except Exception:
        pass
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            parsed = datetime.strptime(text[:10], fmt)
            return parsed.replace(tzinfo=timezone.utc)
        except Exception:
            continue
    return None


def _can_access_claim(current_user: dict, claim: dict) -> bool:
    role = current_user.get("role", "client")
    if role in {"admin", "manager"}:
        return True
    user_id = current_user.get("id")
    return claim.get("created_by") == user_id or claim.get("assigned_to") == user_id


def _deadline_status(due_at: datetime) -> tuple[str, int]:
    now = datetime.now(timezone.utc)
    days_remaining = (due_at.date() - now.date()).days
    if days_remaining < 0:
        return "overdue", days_remaining
    if days_remaining <= 7:
        return "due_soon", days_remaining
    return "on_track", days_remaining


def _classify_document_bucket(doc_type: str, doc_name: str) -> str:
    token = f"{(doc_type or '').lower()} {(doc_name or '').lower()}"
    if "policy" in token or "declaration" in token:
        return "policy"
    if "estimate" in token or "xactimate" in token:
        return "estimate"
    if "carrier" in token or "correspondence" in token or "letter" in token:
        return "carrier_correspondence"
    if "weather" in token or "noaa" in token:
        return "weather"
    if "supplement" in token:
        return "supplement_support"
    if "contract" in token or "signnow" in token:
        return "contract"
    return "other"


@router.get("/{claim_id}/florida-readiness")
async def get_florida_claim_readiness(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Florida PA operational readiness snapshot for a claim.
    This is an execution tracker and not legal advice.

    OPTIMIZED: Uses aggregation pipeline to fetch all data in one query.
    """
    # Use optimized aggregation to get claim with all related counts
    result = await get_claim_with_related_counts(db, claim_id)

    if not result:
        raise HTTPException(status_code=404, detail="Claim not found")

    claim = result["claim"]
    if not _can_access_claim(current_user, claim):
        raise HTTPException(status_code=403, detail="Access denied")

    # Extract counts from aggregation result
    docs = result["documents"]
    docs_count = result["documents_count"]
    notes_count = result["notes_count"]
    photos_count = result["photos_count"]
    supplements_submitted = result["supplements_submitted_count"]

    required_fields = [
        ("claim_number", "Claim number"),
        ("client_name", "Client name"),
        ("property_address", "Property address"),
        ("date_of_loss", "Date of loss"),
        ("policy_number", "Policy number"),
    ]
    missing_fields = [label for key, label in required_fields if not claim.get(key)]

    deadlines = []
    reference_date = (
        _parse_date(claim.get("reported_at"))
        or _parse_date(claim.get("created_at"))
        or datetime.now(timezone.utc)
    )
    ninety_day_due = reference_date + timedelta(days=90)
    status_90, days_90 = _deadline_status(ninety_day_due)
    deadlines.append(
        {
            "id": "carrier_90_day_watch",
            "label": "Carrier 90-day decision watch",
            "due_at": ninety_day_due.isoformat(),
            "status": status_90,
            "days_remaining": days_90,
            "source": "Operational timer from reported/created date",
        }
    )

    # Use latest submitted supplement from aggregation result
    latest_submitted = result.get("latest_submitted_supplement")
    if latest_submitted:
        submitted_at = _parse_date(latest_submitted.get("submitted_at"))
        if submitted_at:
            follow_up_due = submitted_at + timedelta(days=14)
            status_14, days_14 = _deadline_status(follow_up_due)
            deadlines.append(
                {
                    "id": "supplement_follow_up",
                    "label": "Supplement follow-up target (14 days)",
                    "due_at": follow_up_due.isoformat(),
                    "status": status_14,
                    "days_remaining": days_14,
                    "source": "Latest supplement submitted_at",
                }
            )

    doc_tokens = [
        f"{(d.get('type') or '').lower()} {(d.get('name') or '').lower()}".strip()
        for d in docs
    ]
    has_policy = any("policy" in t or "declarations" in t for t in doc_tokens)
    has_estimate = any("estimate" in t or "xactimate" in t for t in doc_tokens)
    has_carrier_correspondence = any("carrier" in t or "letter" in t or "correspondence" in t for t in doc_tokens)

    evidence_checklist = [
        {"id": "policy_docs", "label": "Policy/Declarations uploaded", "complete": has_policy},
        {"id": "estimate_docs", "label": "Estimate documentation uploaded", "complete": has_estimate},
        {"id": "photo_set", "label": "Photo evidence set (10+)", "complete": photos_count >= 10},
        {"id": "chronology_notes", "label": "Chronology notes (2+)", "complete": notes_count >= 2},
        {"id": "carrier_correspondence", "label": "Carrier correspondence on file", "complete": has_carrier_correspondence},
    ]

    recommended_next_actions: list[str] = []
    if missing_fields:
        recommended_next_actions.append("Complete all critical claim identifiers before outbound demands.")
    incomplete_evidence = [item["label"] for item in evidence_checklist if not item["complete"]]
    if incomplete_evidence:
        recommended_next_actions.append(f"Close evidence gaps: {', '.join(incomplete_evidence[:3])}.")
    if photos_count < 10:
        recommended_next_actions.append("Capture additional photo evidence for scope defensibility.")
    if supplements_submitted == 0:
        recommended_next_actions.append("Review for supplement opportunity and prepare line-item support.")
    if not recommended_next_actions:
        recommended_next_actions.append("File is operationally ready. Proceed with strategic carrier communication.")

    score = 100
    score -= len(missing_fields) * 12
    if docs_count < 3:
        score -= 12
    if notes_count < 2:
        score -= 8
    if photos_count < 10:
        score -= 10
    if supplements_submitted == 0:
        score -= 6
    score = max(0, min(100, score))

    return {
        "claim_id": claim_id,
        "readiness_score": score,
        "missing_fields": missing_fields,
        "evidence": {
            "documents": docs_count,
            "notes": notes_count,
            "photos": photos_count,
            "supplements_submitted": supplements_submitted,
        },
        "evidence_checklist": evidence_checklist,
        "deadlines": deadlines,
        "recommended_next_actions": recommended_next_actions,
        "disclaimer": "Operational guidance only. Confirm legal deadlines with counsel and current Florida law.",
    }


@router.get("/{claim_id}/demand-package-manifest")
async def get_claim_demand_package_manifest(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Build a carrier-demand package manifest showing included and missing artifacts.
    This is a packaging assistant and does not alter claim records.
    """
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if not _can_access_claim(current_user, claim):
        raise HTTPException(status_code=403, detail="Access denied")

    documents = await db.documents.find({"claim_id": claim_id}, {"_id": 0, "id": 1, "type": 1, "name": 1, "uploaded_at": 1}).to_list(500)
    notes_count = await db.notes.count_documents({"claim_id": claim_id})
    photos_count = await db.inspection_photos.count_documents({"claim_id": claim_id})
    supplements_count = await db.supplements.count_documents({"claim_id": claim_id})

    grouped_docs: dict[str, list] = {
        "policy": [],
        "estimate": [],
        "carrier_correspondence": [],
        "weather": [],
        "supplement_support": [],
        "contract": [],
        "other": [],
    }
    for doc in documents:
        bucket = _classify_document_bucket(doc.get("type", ""), doc.get("name", ""))
        grouped_docs[bucket].append(
            {
                "id": doc.get("id"),
                "name": doc.get("name"),
                "type": doc.get("type"),
                "uploaded_at": doc.get("uploaded_at"),
            }
        )

    required_sections = [
        {"id": "policy", "label": "Policy / Declarations", "minimum_count": 1},
        {"id": "estimate", "label": "Estimate / Scope", "minimum_count": 1},
        {"id": "carrier_correspondence", "label": "Carrier Correspondence", "minimum_count": 1},
        {"id": "photos", "label": "Photo Evidence", "minimum_count": 10},
        {"id": "chronology_notes", "label": "Chronology Notes", "minimum_count": 2},
    ]

    section_status = []
    missing_sections = []
    for section in required_sections:
        sid = section["id"]
        required_count = section["minimum_count"]
        if sid == "photos":
            current_count = photos_count
        elif sid == "chronology_notes":
            current_count = notes_count
        else:
            current_count = len(grouped_docs.get(sid, []))
        complete = current_count >= required_count
        section_status.append(
            {
                "id": sid,
                "label": section["label"],
                "required_count": required_count,
                "current_count": current_count,
                "complete": complete,
            }
        )
        if not complete:
            missing_sections.append(section["label"])

    package_score = round((sum(1 for s in section_status if s["complete"]) / max(1, len(section_status))) * 100)
    recommended_order = [
        "Cover summary and claim identifiers",
        "Policy/declarations excerpt",
        "Primary estimate and scope",
        "Photo evidence index",
        "Carrier correspondence timeline",
        "Supplement support and variance explanation",
    ]

    ready_for_submission = len(missing_sections) == 0
    gate_reasons = [] if ready_for_submission else [f"Missing required section: {label}" for label in missing_sections]

    export_payload = {
        "claim_id": claim_id,
        "claim_number": claim.get("claim_number"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "ready_for_submission": ready_for_submission,
        "section_status": section_status,
        "missing_sections": missing_sections,
        "recommended_order": recommended_order,
        "artifact_counts": {
            "documents": len(documents),
            "photos": photos_count,
            "notes": notes_count,
            "supplements": supplements_count,
        },
    }

    return {
        "claim_id": claim_id,
        "manifest_id": f"manifest-{claim_id}",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "package_score": package_score,
        "ready_for_submission": ready_for_submission,
        "submission_gate": {
            "passed": ready_for_submission,
            "reasons": gate_reasons,
        },
        "claim_summary": {
            "claim_number": claim.get("claim_number"),
            "client_name": claim.get("client_name"),
            "property_address": claim.get("property_address"),
            "policy_number": claim.get("policy_number"),
            "date_of_loss": claim.get("date_of_loss"),
            "estimated_value": claim.get("estimated_value"),
        },
        "section_status": section_status,
        "missing_sections": missing_sections,
        "counts": {
            "documents": len(documents),
            "photos": photos_count,
            "notes": notes_count,
            "supplements": supplements_count,
        },
        "documents_by_bucket": grouped_docs,
        "recommended_order": recommended_order,
        "export_payload": export_payload,
        "disclaimer": "Operational packaging guidance. Validate legal/compliance requirements before submission.",
    }

@router.post("/", response_model=Claim)
async def create_claim(
    claim_data: ClaimCreate,
    current_user: dict = Depends(get_current_active_user),
    service: ClaimsService = Depends(get_claims_service)
):
    """Create a new claim"""
    return await service.create_claim(claim_data, current_user)

@router.get("/", response_model=List[Claim])
async def get_claims(
    filter_status: Optional[str] = None,
    include_archived: bool = False,
    limit: int = 500,
    current_user: dict = Depends(get_current_active_user),
    service: ClaimsService = Depends(get_claims_service)
):
    """Get all claims (filtered by role). Archived claims hidden by default."""
    return await service.get_claims(filter_status, include_archived, limit, current_user)

@router.get("/{claim_id}", response_model=Claim)
async def get_claim(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user),
    service: ClaimsService = Depends(get_claims_service)
):
    """Get specific claim by ID"""
    return await service.get_claim(claim_id, current_user)

@router.put("/{claim_id}", response_model=Claim)
async def update_claim(
    claim_id: str,
    updates: ClaimUpdate,
    current_user: dict = Depends(get_current_active_user),
    service: ClaimsService = Depends(get_claims_service)
):
    """Update a claim"""
    return await service.update_claim(claim_id, updates, current_user)

@router.delete("/{claim_id}")
async def delete_claim(
    claim_id: str,
    permanent: bool = False,
    current_user: dict = Depends(require_role(["admin"])),
    service: ClaimsService = Depends(get_claims_service)
):
    """Soft-delete a claim (admin only). Use permanent=true for hard delete."""
    return await service.delete_claim(claim_id, permanent, current_user)

@router.post("/{claim_id}/restore", response_model=Claim)
async def restore_claim(
    claim_id: str,
    current_user: dict = Depends(require_role(["admin"])),
    service: ClaimsService = Depends(get_claims_service)
):
    """Restore an archived claim"""
    return await service.restore_claim(claim_id, current_user)

# Notes endpoints (To be refactored to NoteService in next phase)
@router.post("/{claim_id}/notes", response_model=Note)
async def add_note(
    claim_id: str,
    note_data: NoteCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Add a note to a claim"""
    try:
        note_dict = note_data.dict()
        note_dict["author_id"] = current_user["id"]
        note_dict["author_name"] = current_user["full_name"]
        
        note_obj = Note(**note_dict)
        await db.notes.insert_one(note_obj.dict())
        
        logger.info(f"Note added to claim: {claim_id}")
        return note_obj
        
    except Exception as e:
        logger.error(f"Add note error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{claim_id}/notes", response_model=List[Note])
async def get_notes(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all notes for a claim"""
    try:
        notes = await db.notes.find({"claim_id": claim_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
        return [Note(**note) for note in notes]
        
    except Exception as e:
        logger.error(f"Get notes error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Documents endpoints (To be refactored to DocumentService in next phase)
@router.post("/{claim_id}/documents", response_model=Document, dependencies=[Depends(require_permission("documents.create"))])
async def upload_document(
    claim_id: str,
    file: UploadFile = File(...),
    doc_type: str = "General",
    current_user: dict = Depends(get_current_active_user)
):
    """Upload a document to a claim"""
    try:
        # Create upload directory if it doesn't exist
        base_upload_dir = os.getenv("UPLOAD_DIR", "/tmp/eden_uploads")
        upload_dir = f"{base_upload_dir}/claims/{claim_id}"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save file
        file_path = f"{upload_dir}/{file.filename}"
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Create document record
        doc_dict = {
            "claim_id": claim_id,
            "name": file.filename,
            "type": doc_type,
            "size": f"{len(content) / 1024:.2f} KB",
            "uploaded_by": current_user["full_name"],
            "file_path": file_path
        }
        
        doc_obj = Document(**doc_dict)
        await db.documents.insert_one(doc_obj.dict())
        
        logger.info(f"Document uploaded to claim: {claim_id}")
        return doc_obj
        
    except Exception as e:
        logger.error(f"Upload document error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{claim_id}/documents", response_model=List[Document])
async def get_documents(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all documents for a claim"""
    try:
        documents = await db.documents.find({"claim_id": claim_id}, {"_id": 0}).sort("uploaded_at", -1).to_list(100)
        return [Document(**doc) for doc in documents]
        
    except Exception as e:
        logger.error(f"Get documents error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

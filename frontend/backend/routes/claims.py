from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File
from typing import List, Optional
from models import ClaimCreate, ClaimUpdate, Claim, NoteCreate, Note, DocumentCreate, Document
from dependencies import db, get_current_active_user, require_role, require_permission
from services.claims_service import ClaimsService
import logging
import os

# Structured logging setup
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/claims", tags=["claims"])

# Dependency
def get_claims_service():
    return ClaimsService(db)

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

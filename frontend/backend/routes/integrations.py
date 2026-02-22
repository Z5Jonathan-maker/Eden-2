from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import RedirectResponse
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
import logging
import os
import uuid

from services.gmail_service import GmailService
from services.drive_service import DriveService
from services.gamma_service import GammaService
from services.signnow_service import SignNowService
from services.encryption_service import encryption
from dependencies import get_current_active_user, db

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/integrations",
    tags=["integrations"],
    dependencies=[Depends(get_current_active_user)]
)

# Models
class EmailRequest(BaseModel):
    recipient: str
    subject: str
    body: str
    user_id: str

class DriveUploadRequest(BaseModel):
    folder_name: str
    user_id: str

class GammaClaimRequest(BaseModel):
    claim_number: str
    client_name: str
    claim_date: str
    description: str
    status: str = "New"

class GammaUpdateRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

class GammaPresentationRequest(BaseModel):
    title: str
    content: str
    theme_id: Optional[str] = None

class SignNowUploadRequest(BaseModel):
    file_name: str
    claim_id: Optional[str] = None

class SignNowSignRequest(BaseModel):
    document_id: str
    signer_email: str
    signer_name: str
    subject: str
    message: str


class AIEmailConfirmResponse(BaseModel):
    confirmation_token: str
    expires_at: str
    ttl_minutes: int = 10
    context_type: str = "email"
    context_id: Optional[str] = None
    recipient: Optional[str] = None


AI_EMAIL_CONFIRM_TTL_MINUTES = 10


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso_datetime(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


async def _issue_ai_email_confirmation_token(
    *,
    current_user: dict,
    recipient: str,
    context_type: str = "email",
    context_id: Optional[str] = None,
) -> dict:
    token = uuid.uuid4().hex
    now_dt = _utc_now()
    expires_at = now_dt + timedelta(minutes=AI_EMAIL_CONFIRM_TTL_MINUTES)
    doc = {
        "id": str(uuid.uuid4()),
        "purpose": "ai_outbound_email",
        "token": token,
        "user_id": current_user.get("id"),
        "recipient": (recipient or "").strip().lower(),
        "context_type": context_type,
        "context_id": context_id,
        "used": False,
        "created_at": now_dt.isoformat(),
        "expires_at": expires_at.isoformat(),
    }
    await db.ai_outbound_confirmations.insert_one(doc)
    return doc


async def _consume_ai_email_confirmation_token(
    *,
    current_user: dict,
    confirmation_token: str,
    recipient: str,
    context_type: str = "email",
    context_id: Optional[str] = None,
) -> dict:
    if not confirmation_token:
        raise HTTPException(
            status_code=428,
            detail="AI-generated outbound email requires confirmation token.",
        )

    query = {
        "purpose": "ai_outbound_email",
        "token": confirmation_token,
        "user_id": current_user.get("id"),
        "recipient": (recipient or "").strip().lower(),
        "context_type": context_type,
        "used": False,
    }
    if context_id:
        query["context_id"] = context_id

    doc = await db.ai_outbound_confirmations.find_one(query, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=412, detail="Invalid or already-used confirmation token")

    expires_at = _parse_iso_datetime(doc.get("expires_at"))
    if not expires_at or expires_at < _utc_now():
        raise HTTPException(status_code=412, detail="Confirmation token expired")

    await db.ai_outbound_confirmations.update_one(
        {"id": doc["id"]},
        {"$set": {"used": True, "used_at": _utc_now().isoformat()}},
    )
    return doc


# Gmail Routes
@router.post("/gmail/confirm-token", response_model=AIEmailConfirmResponse)
async def issue_ai_email_confirm_token(
    recipient: str = Form(...),
    context_type: str = Form("email"),
    context_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Issue one-time token required for AI-generated outbound email sends.
    """
    token_doc = await _issue_ai_email_confirmation_token(
        current_user=current_user,
        recipient=recipient,
        context_type=context_type,
        context_id=context_id,
    )
    return AIEmailConfirmResponse(
        confirmation_token=token_doc["token"],
        expires_at=token_doc["expires_at"],
        context_type=token_doc["context_type"],
        context_id=token_doc.get("context_id"),
        recipient=token_doc.get("recipient"),
    )


@router.post("/gmail/send-email")
async def send_email(
    recipient: str = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    user_id: str = Form(...),
    files: Optional[List[UploadFile]] = File(None),
    ai_generated: bool = Form(False),
    confirmation_token: Optional[str] = Form(None),
    context_type: str = Form("email"),
    context_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_active_user),
):
    """Send an email via Gmail with optional attachments"""
    try:
        consumed_confirm_doc = None
        if ai_generated:
            consumed_confirm_doc = await _consume_ai_email_confirmation_token(
                current_user=current_user,
                confirmation_token=confirmation_token or "",
                recipient=recipient,
                context_type=context_type,
                context_id=context_id,
            )

        # In production, retrieve credentials from database based on user_id
        # For now, we'll use environment variables
        credentials_dict = {
            'access_token': os.getenv('GOOGLE_ACCESS_TOKEN', ''),
            'refresh_token': os.getenv('GOOGLE_REFRESH_TOKEN', ''),
            'scopes': ['https://www.googleapis.com/auth/gmail.send']
        }
        
        gmail_service = GmailService(credentials_dict)
        
        # Process attachments if provided
        attachments = []
        if files:
            for file in files:
                content = await file.read()
                attachments.append((file.filename, content))
        
        result = await gmail_service.send_email(
            recipient=recipient,
            subject=subject,
            body=body,
            attachments=attachments if attachments else None
        )
        try:
            await db.ai_outbound_email_logs.insert_one(
                {
                    "id": str(uuid.uuid4()),
                    "recipient": recipient,
                    "subject": subject,
                    "context_type": context_type,
                    "context_id": context_id,
                    "ai_generated": bool(ai_generated),
                    "confirmation_id": consumed_confirm_doc.get("id") if consumed_confirm_doc else None,
                    "sent_by_user_id": current_user.get("id"),
                    "sent_at": _utc_now().isoformat(),
                }
            )
        except Exception:
            # Email send already succeeded; avoid failing request on log issues.
            pass

        return result
        
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Google Drive Routes
@router.post("/drive/create-folder")
async def create_drive_folder(
    folder_name: str = Form(...),
    user_id: str = Form(...)
):
    """Create a folder in Google Drive"""
    try:
        credentials_dict = {
            'access_token': os.getenv('GOOGLE_ACCESS_TOKEN', ''),
            'refresh_token': os.getenv('GOOGLE_REFRESH_TOKEN', ''),
            'scopes': ['https://www.googleapis.com/auth/drive.file']
        }
        
        drive_service = DriveService(credentials_dict)
        folder_id = await drive_service.create_folder(folder_name)
        
        return {"folder_id": folder_id, "status": "created"}
        
    except Exception as e:
        logger.error(f"Error creating folder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/drive/upload-file")
async def upload_to_drive(
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    user_id: str = Form(...)
):
    """Upload a file to Google Drive"""
    try:
        credentials_dict = {
            'access_token': os.getenv('GOOGLE_ACCESS_TOKEN', ''),
            'refresh_token': os.getenv('GOOGLE_REFRESH_TOKEN', ''),
            'scopes': ['https://www.googleapis.com/auth/drive.file']
        }
        
        drive_service = DriveService(credentials_dict)
        
        content = await file.read()
        result = await drive_service.upload_file(
            file_name=file.filename,
            file_content=content,
            mime_type=file.content_type or 'application/octet-stream',
            folder_id=folder_id
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Gamma Routes
@router.post("/gamma/create-claim")
async def create_notion_claim(request: GammaClaimRequest):
    """Create a new claim page in Gamma"""
    try:
        database_id = os.getenv('GAMMA_DATABASE_ID')
        if not database_id:
            raise HTTPException(status_code=500, detail="Gamma database ID not configured")
        
        gamma_service = GammaService()
        page_id = await gamma_service.create_claim_page(
            database_id=database_id,
            claim_data=request.dict()
        )
        
        return {"page_id": page_id, "status": "created"}
        
    except Exception as e:
        logger.error(f"Error creating Gamma claim: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/gamma/update-claim/{page_id}")
async def update_notion_claim(page_id: str, request: GammaUpdateRequest):
    """Update an existing claim page in Gamma"""
    try:
        gamma_service = GammaService()
        
        updates = {}
        if request.status:
            updates['status'] = request.status
        if request.notes:
            updates['notes'] = request.notes
        updates['updated_date'] = datetime.now().isoformat()
        
        await gamma_service.update_claim_page(page_id, updates)
        
        return {"status": "updated"}
        
    except Exception as e:
        logger.error(f"Error updating Gamma claim: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/gamma/append-content/{page_id}")
async def append_notion_content(page_id: str, content: str = Form(...)):
    """Append content to a Gamma page"""
    try:
        gamma_service = GammaService()
        await gamma_service.append_content(page_id, content)
        
        return {"status": "appended"}
        
    except Exception as e:
        logger.error(f"Error appending content: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Gamma Routes
@router.post("/gamma/generate-presentation")
async def generate_presentation(request: GammaPresentationRequest):
    """Generate a presentation using Gamma AI"""
    try:
        gamma_service = GammaService()
        result = await gamma_service.generate_presentation(
            title=request.title,
            content=request.content,
            theme_id=request.theme_id
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error generating presentation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/gamma/themes")
async def list_gamma_themes():
    """Get list of available Gamma themes"""
    try:
        gamma_service = GammaService()
        themes = await gamma_service.list_themes()
        
        return {"themes": themes}
        
    except Exception as e:
        logger.error(f"Error listing themes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Test endpoint
@router.get("/test")
async def test_integrations():
    """Test endpoint to verify integrations are loaded"""
    return {
        "status": "ok",
        "integrations": [
            "gmail",
            "google_drive",
            "notion",
            "gamma",
            "signnow"
        ]
    }

# SignNow Routes
@router.post("/signnow/upload-document")
async def upload_document_to_signnow(
    file: UploadFile = File(...),
    claim_id: Optional[str] = Form(None)
):
    """Upload a document to SignNow"""
    try:
        signnow_service = SignNowService()
        
        content = await file.read()
        document_id = await signnow_service.upload_document(
            file_content=content,
            file_name=file.filename
        )
        
        return {
            "document_id": document_id,
            "file_name": file.filename,
            "status": "uploaded",
            "claim_id": claim_id
        }
        
    except Exception as e:
        logger.error(f"Error uploading to SignNow: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/signnow/send-for-signature")
async def send_document_for_signature(request: SignNowSignRequest):
    """Send a document for signature via SignNow"""
    try:
        signnow_service = SignNowService()
        
        result = await signnow_service.send_for_signature(
            document_id=request.document_id,
            signer_email=request.signer_email,
            signer_name=request.signer_name,
            subject=request.subject,
            message=request.message
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error sending for signature: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/signnow/document-status/{document_id}")
async def get_document_status(document_id: str):
    """Get document signing status"""
    try:
        signnow_service = SignNowService()
        status = await signnow_service.get_document_status(document_id)
        
        return status
        
    except Exception as e:
        logger.error(f"Error getting document status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/signnow/download-signed/{document_id}")
async def download_signed_document(document_id: str):
    """Download signed document"""
    try:
        signnow_service = SignNowService()
        content = await signnow_service.download_signed_document(document_id)
        
        from fastapi.responses import Response
        return Response(
            content=content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=signed_document_{document_id}.pdf"
            }
        )
        
    except Exception as e:
        logger.error(f"Error downloading signed document: {e}")
        raise HTTPException(status_code=500, detail=str(e))

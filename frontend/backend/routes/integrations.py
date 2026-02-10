from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import RedirectResponse
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import logging
import os

from services.gmail_service import GmailService
from services.drive_service import DriveService
from services.notion_service import NotionService
from services.gamma_service import GammaService
from services.signnow_service import SignNowService
from services.encryption_service import encryption

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

# Models
class EmailRequest(BaseModel):
    recipient: str
    subject: str
    body: str
    user_id: str

class DriveUploadRequest(BaseModel):
    folder_name: str
    user_id: str

class NotionClaimRequest(BaseModel):
    claim_number: str
    client_name: str
    claim_date: str
    description: str
    status: str = "New"

class NotionUpdateRequest(BaseModel):
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

# Gmail Routes
@router.post("/gmail/send-email")
async def send_email(
    recipient: str = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    user_id: str = Form(...),
    files: Optional[List[UploadFile]] = File(None)
):
    """Send an email via Gmail with optional attachments"""
    try:
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

# Notion Routes
@router.post("/notion/create-claim")
async def create_notion_claim(request: NotionClaimRequest):
    """Create a new claim page in Notion"""
    try:
        database_id = os.getenv('NOTION_DATABASE_ID')
        if not database_id:
            raise HTTPException(status_code=500, detail="Notion database ID not configured")
        
        notion_service = NotionService()
        page_id = await notion_service.create_claim_page(
            database_id=database_id,
            claim_data=request.dict()
        )
        
        return {"page_id": page_id, "status": "created"}
        
    except Exception as e:
        logger.error(f"Error creating Notion claim: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/notion/update-claim/{page_id}")
async def update_notion_claim(page_id: str, request: NotionUpdateRequest):
    """Update an existing claim page in Notion"""
    try:
        notion_service = NotionService()
        
        updates = {}
        if request.status:
            updates['status'] = request.status
        if request.notes:
            updates['notes'] = request.notes
        updates['updated_date'] = datetime.now().isoformat()
        
        await notion_service.update_claim_page(page_id, updates)
        
        return {"status": "updated"}
        
    except Exception as e:
        logger.error(f"Error updating Notion claim: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/notion/append-content/{page_id}")
async def append_notion_content(page_id: str, content: str = Form(...)):
    """Append content to a Notion page"""
    try:
        notion_service = NotionService()
        await notion_service.append_content(page_id, content)
        
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

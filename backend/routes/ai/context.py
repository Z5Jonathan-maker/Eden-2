"""
AI Module - Context Routes

Claim context retrieval and document upload for AI analysis.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from dependencies import db, get_current_active_user
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os
import logging
import uuid
import re
import json

logger = logging.getLogger(__name__)

# Import the Emergent LLM integration
from emergentintegrations.llm.chat import LlmChat, UserMessage
from services.ai_routing_policy import (
    resolve_provider_order_for_task as resolve_policy_provider_order_for_task,
    sanitize_provider_order as sanitize_policy_provider_order,
    load_runtime_routing_config as load_policy_runtime_routing_config,
)

# Get the Emergent LLM key
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")


router = APIRouter()

@router.get("/claims-for-context")
async def get_claims_for_context(
    current_user: dict = Depends(get_current_active_user),
    search: Optional[str] = None,
    limit: int = 20
):
    """
    Get a list of claims that can be linked to Eve conversations.
    Used by frontend to show claim selector.
    """
    try:
        query = {}
        
        # If search provided, filter by claim number or client name
        if search:
            query = {
                "$or": [
                    {"claim_number": {"$regex": search, "$options": "i"}},
                    {"client_name": {"$regex": search, "$options": "i"}},
                    {"property_address": {"$regex": search, "$options": "i"}}
                ]
            }
        
        claims = await db.claims.find(
            query,
            {"_id": 0, "id": 1, "claim_number": 1, "client_name": 1, "status": 1, "carrier": 1, "property_address": 1}
        ).sort("updated_at", -1).limit(limit).to_list(limit)
        
        return {"claims": claims}
        
    except Exception as e:
        logger.error(f"Error fetching claims for context: {e}")
        return {"claims": []}


@router.get("/claim-context/{claim_id}")
async def get_claim_context_for_eve(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Get full claim context for Eve.
    Returns claim details, notes, documents summary.
    """
    user_id = current_user.get("id")
    
    context = await fetch_claim_context(claim_id, user_id)
    
    if not context:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    return context


# Document upload for Eve AI analysis
from fastapi import UploadFile, File as FastAPIFile
import io

@router.post("/upload-document")
async def upload_document_for_eve(
    file: UploadFile = FastAPIFile(...),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Upload a document for Eve to analyze.
    Supports: PDF, images (JPG, PNG, WEBP), Word docs, and text files.
    Returns document ID and extracted text if possible.
    """
    user_id = current_user.get("id")
    
    # Validate file type
    allowed_types = [
        'application/pdf',
        'image/jpeg', 'image/png', 'image/webp',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    
    content_type = file.content_type
    if content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")
    
    # Read file content
    file_content = await file.read()
    
    # Check file size (max 10MB)
    if len(file_content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")
    
    # Generate document ID
    document_id = str(uuid.uuid4())
    
    # Extract text based on file type (basic implementation)
    extracted_text = None
    try:
        if content_type == 'text/plain':
            extracted_text = file_content.decode('utf-8')
        elif content_type == 'application/pdf':
            # For PDFs, we'll store a note that it was uploaded
            # Full PDF parsing would require additional libraries
            extracted_text = f"[PDF document uploaded: {file.filename}]"
        elif content_type.startswith('image/'):
            extracted_text = f"[Image uploaded: {file.filename}]"
        else:
            extracted_text = f"[Document uploaded: {file.filename}]"
    except Exception as e:
        logger.error(f"Error extracting text: {e}")
        extracted_text = f"[Document uploaded: {file.filename}]"
    
    # Store document metadata in database
    doc_record = {
        "id": document_id,
        "user_id": user_id,
        "filename": file.filename,
        "content_type": content_type,
        "size": len(file_content),
        "extracted_text": extracted_text,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.eve_documents.insert_one(doc_record)
    
    return {
        "document_id": document_id,
        "filename": file.filename,
        "extracted_text": extracted_text,
        "message": f"Document '{file.filename}' uploaded successfully. Agent Eve is ready to analyze it."
    }


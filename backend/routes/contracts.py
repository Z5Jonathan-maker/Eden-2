"""
Contracts Management API - Templates, E-Signatures, Document Management
Integrates with SignNow for electronic signatures
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import io
import os
import logging
import re

from dependencies import db, get_current_active_user as get_current_user
from services.signnow_service import SignNowService

router = APIRouter(prefix="/api/contracts", tags=["Contracts"])
logger = logging.getLogger(__name__)
MUTATING_ROLES = {"admin", "manager", "adjuster"}


def _combine_query_filters(*filters: Dict[str, Any]) -> Dict[str, Any]:
    valid = [flt for flt in filters if flt]
    if not valid:
        return {}
    if len(valid) == 1:
        return valid[0]
    return {"$and": valid}


def _can_access_claim(current_user: dict, claim: dict) -> bool:
    role = current_user.get("role", "client")
    user_id = current_user.get("id")
    if role in {"admin", "manager"}:
        return True
    if role == "client":
        user_email = (current_user.get("email") or "").strip().lower()
        claim_email = (claim.get("client_email") or "").strip().lower()
        return bool(user_email) and user_email == claim_email
    assigned_to = claim.get("assigned_to")
    assigned_to_id = claim.get("assigned_to_id")
    full_name = current_user.get("full_name")
    return (
        claim.get("created_by") == user_id
        or assigned_to_id == user_id
        or (full_name and assigned_to == full_name)
    )


async def _get_claim_for_user_or_403(claim_id: str, current_user: dict) -> dict:
    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if not _can_access_claim(current_user, claim):
        raise HTTPException(status_code=403, detail="Access denied")
    return claim


async def _build_contract_visibility_filter(current_user: dict) -> Dict[str, Any]:
    role = current_user.get("role", "client")
    user_id = current_user.get("id")
    if role in {"admin", "manager"}:
        return {}
    if role == "client":
        user_email = (current_user.get("email") or "").strip()
        if not user_email:
            return {"client_email": "__no_match__"}
        return {"client_email": {"$regex": f"^{re.escape(user_email)}$", "$options": "i"}}

    full_name = current_user.get("full_name")
    claim_query_or = [{"created_by": user_id}, {"assigned_to_id": user_id}]
    if full_name:
        claim_query_or.append({"assigned_to": full_name})

    visible_claims = await db.claims.find(
        {"$or": claim_query_or},
        {"_id": 0, "id": 1},
    ).limit(5000).to_list(5000)
    claim_ids = [item.get("id") for item in visible_claims if item.get("id")]

    visibility_or = [{"created_by": user_id}]
    if claim_ids:
        visibility_or.append({"claim_id": {"$in": claim_ids}})
    return {"$or": visibility_or}


def _require_mutating_role(current_user: dict):
    if current_user.get("role", "client") not in MUTATING_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient role for contract modification")


async def _get_contract_for_user_or_403(contract_id: str, current_user: dict) -> dict:
    contract = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    role = current_user.get("role", "client")
    user_id = current_user.get("id")
    if role in {"admin", "manager"}:
        return contract

    claim_id = contract.get("claim_id")
    if claim_id:
        claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
        if claim and _can_access_claim(current_user, claim):
            return contract

    if role == "client":
        user_email = (current_user.get("email") or "").strip().lower()
        contract_email = (contract.get("client_email") or "").strip().lower()
        if user_email and contract_email and user_email == contract_email:
            return contract
    elif contract.get("created_by") == user_id:
        return contract

    raise HTTPException(status_code=403, detail="Access denied")


async def _get_signnow_token():
    """Get SignNow token via client credentials if configured"""
    try:
        from integrations.signnow_client import get_signnow_access_token
        return await get_signnow_access_token()
    except Exception:
        return None


# Import game event bus helper
async def _emit_contract_event(user_id: str, event_type: str, contract_id: str):
    """Emit game event for contract activities"""
    try:
        from incentives_engine.events import emit_contract_event
        await emit_contract_event(
            db=db,
            user_id=user_id,
            event_type=event_type,
            contract_id=contract_id
        )
    except Exception as e:
        logger.warning(f"Failed to emit contract game event: {e}")


# ============================================
# Models
# ============================================

class ContractTemplateCreate(BaseModel):
    name: str
    description: str
    template_type: str = "public_adjuster_agreement"  # public_adjuster_agreement, dfs_disclosure, custom
    content: Dict[str, Any]  # Template content with fields


class ContractCreate(BaseModel):
    template_id: str
    claim_id: str  # REQUIRED - contracts must be linked to claims
    client_name: str
    client_email: str
    field_values: Dict[str, Any]  # Filled-in field values


class ContractSendRequest(BaseModel):
    signer_email: str
    signer_name: str
    subject: Optional[str] = None
    message: Optional[str] = None


# ============================================
# Care Claims Contract Template Definition
# ============================================

CARE_CLAIMS_TEMPLATE = {
    "id": "care-claims-pa-agreement",
    "name": "Public Adjuster Agreement",
    "description": "Care Claims standard public adjuster service agreement for property claims",
    "template_type": "public_adjuster_agreement",
    "version": "1.0",
    "adjuster_info": {
        "name": "Jonathan Cimadevilla",
        "license_number": "W786531",
        "firm_name": "Care Claims",
        "firm_license": "G114979",
        "address": "9920 Spanish Lime Ct, Riverview, Florida 33578",
        "phone": "352-782-2617",
        "email": "Jonathan@careclaimsadjusting.com",
        "website": "www.careclaimsadjusting.com"
    },
    "fields": [
        # Policyholder Section
        {"id": "policyholder_name", "label": "Named Insured's Name(s)", "type": "text", "required": True, "section": "policyholder"},
        {"id": "policyholder_email", "label": "Email", "type": "email", "required": True, "section": "policyholder"},
        {"id": "policyholder_address", "label": "Address", "type": "text", "required": True, "section": "policyholder"},
        {"id": "policyholder_city", "label": "City", "type": "text", "required": True, "section": "policyholder"},
        {"id": "policyholder_state", "label": "State", "type": "text", "required": True, "section": "policyholder"},
        {"id": "policyholder_zip", "label": "Zip", "type": "text", "required": True, "section": "policyholder"},
        {"id": "policyholder_phone", "label": "Phone", "type": "tel", "required": True, "section": "policyholder"},
        {"id": "policyholder_mobile", "label": "Mobile", "type": "tel", "required": False, "section": "policyholder"},
        
        # Insurance Company Section
        {"id": "insurance_company", "label": "Insurance Company Name", "type": "text", "required": True, "section": "insurance"},
        {"id": "policy_number", "label": "Policy #", "type": "text", "required": True, "section": "insurance"},
        {"id": "claim_number", "label": "Claim #", "type": "text", "required": False, "section": "insurance"},
        {"id": "insurance_address", "label": "Insurance Address", "type": "text", "required": False, "section": "insurance"},
        {"id": "field_adjuster", "label": "Field Adjuster", "type": "text", "required": False, "section": "insurance"},
        {"id": "field_adjuster_phone", "label": "Field Adjuster Phone", "type": "tel", "required": False, "section": "insurance"},
        {"id": "desk_adjuster", "label": "Desk Adjuster", "type": "text", "required": False, "section": "insurance"},
        {"id": "desk_adjuster_phone", "label": "Desk Adjuster Phone", "type": "tel", "required": False, "section": "insurance"},
        
        # Loss Section
        {"id": "loss_address", "label": "Loss Address", "type": "text", "required": True, "section": "loss"},
        {"id": "loss_city", "label": "City", "type": "text", "required": True, "section": "loss"},
        {"id": "loss_state_zip", "label": "State/Zip", "type": "text", "required": True, "section": "loss"},
        {"id": "date_of_loss", "label": "Date of Loss", "type": "date", "required": True, "section": "loss"},
        {"id": "description_of_loss", "label": "Description of Loss", "type": "textarea", "required": True, "section": "loss"},
        {"id": "claim_type", "label": "Claim Type", "type": "select", "options": ["Emergency", "Non Emergency", "Supplemental"], "required": True, "section": "loss"},
        
        # Fee Section
        {"id": "fee_percentage", "label": "Fee Percentage (%)", "type": "number", "required": True, "section": "fees", "min": 0, "max": 20}
    ],
    "sections": [
        {"id": "policyholder", "title": "Policyholder Information"},
        {"id": "insurance", "title": "Insurance Company"},
        {"id": "loss", "title": "Loss Location/Description"},
        {"id": "fees", "title": "Fee Agreement"}
    ],
    "terms": [
        "SERVICES: CARE CLAIMS will act as a public insurance adjuster on behalf of POLICYHOLDER for the preparation and/or presentment of the claim for loss, damage, and recovery under any insurance policies.",
        "NOTICE OF ASSIGNMENT: POLICYHOLDER assigns a portion of the recovery to CARE CLAIMS and authorizes co-payee arrangement on all payments.",
        "CANCELLATION: Either party may cancel with written notice. Work performed entitles CARE CLAIMS to reimbursement for expenses.",
        "EXPENSES/COSTS: POLICYHOLDER is responsible for all costs and expenses incurred for claim preparation.",
        "NO LEGAL SERVICES: This Agreement is not for legal services. An attorney must provide any legal services.",
        "FLORIDA LAW: Pursuant to s 817.234, Florida Statutes, any person who prepares false or misleading claim information commits a felony.",
        "RESCISSION PERIOD: Contract may be cancelled within 10 days (or 30 days for state of emergency declarations)."
    ],
    "signature_blocks": [
        {"id": "insured_1", "role": "Primary Insured", "required": True},
        {"id": "insured_2", "role": "Secondary Insured", "required": False},
        {"id": "adjuster", "role": "Public Adjuster", "required": True, "prefilled": True}
    ],
    "initial_blocks": [
        {"id": "page_1_initials", "page": 1, "description": "Acknowledge receipt of page 1"},
        {"id": "page_2_initials", "page": 2, "description": "Acknowledge receipt of page 2"},
        {"id": "page_3_initials", "page": 3, "description": "Acknowledge receipt of page 3"},
        {"id": "page_4_initials", "page": 4, "description": "Acknowledge receipt of page 4"},
        {"id": "page_5_initials", "page": 5, "description": "Acknowledge receipt of page 5"},
        {"id": "page_6_initials", "page": 6, "description": "Acknowledge receipt of page 6"}
    ],
    "pdf_url": "https://customer-assets.emergentagent.com/job_eden-insurance/artifacts/2wnjf18n_Care%20Claims%20Contract%20New.pdf",
    "created_at": "2026-02-03T00:00:00Z"
}


# ============================================
# Template Endpoints
# ============================================

@router.get("/templates")
async def get_contract_templates(
    current_user: dict = Depends(get_current_user)
):
    """Get all available contract templates"""
    # Get custom templates from DB
    custom_templates = await db.contract_templates.find({}, {"_id": 0}).to_list(100)
    
    # Add the built-in Care Claims template
    templates = [
        {
            "id": CARE_CLAIMS_TEMPLATE["id"],
            "name": CARE_CLAIMS_TEMPLATE["name"],
            "description": CARE_CLAIMS_TEMPLATE["description"],
            "template_type": CARE_CLAIMS_TEMPLATE["template_type"],
            "fields_count": len(CARE_CLAIMS_TEMPLATE["fields"]),
            "is_builtin": True
        }
    ]
    
    for t in custom_templates:
        templates.append({
            "id": t["id"],
            "name": t["name"],
            "description": t["description"],
            "template_type": t["template_type"],
            "fields_count": len(t.get("fields", [])),
            "is_builtin": False
        })
    
    return {"templates": templates}


@router.get("/templates/{template_id}")
async def get_contract_template(
    template_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get full template details with fields"""
    if template_id == CARE_CLAIMS_TEMPLATE["id"]:
        return CARE_CLAIMS_TEMPLATE
    
    template = await db.contract_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return template


@router.post("/templates")
async def create_contract_template(
    template: ContractTemplateCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a custom contract template (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    template_id = str(uuid.uuid4())
    doc = {
        "id": template_id,
        "name": template.name,
        "description": template.description,
        "template_type": template.template_type,
        "content": template.content,
        "created_by": current_user.get("id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_builtin": False
    }
    
    await db.contract_templates.insert_one(doc)
    return {"id": template_id, "message": "Template created"}


# ============================================
# Contract Endpoints
# ============================================

@router.post("/")
async def create_contract(
    contract: ContractCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new contract from a template with filled values
    
    ENFORCED CONSTRAINTS:
    - claim_id is REQUIRED (contracts must be linked to claims)
    - created_by automatically set from current user
    """
    _require_mutating_role(current_user)
    # Validate claim exists and user can access it
    await _get_claim_for_user_or_403(contract.claim_id, current_user)
    
    # Get template
    if contract.template_id == CARE_CLAIMS_TEMPLATE["id"]:
        template = CARE_CLAIMS_TEMPLATE
    else:
        template = await db.contract_templates.find_one({"id": contract.template_id}, {"_id": 0})
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
    
    contract_id = str(uuid.uuid4())
    doc = {
        "id": contract_id,
        "template_id": contract.template_id,
        "template_name": template["name"],
        "claim_id": contract.claim_id,
        "client_name": contract.client_name,
        "client_email": contract.client_email,
        "field_values": contract.field_values,
        "status": "draft",
        "created_by": current_user.get("id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "signnow_document_id": None,
        "signed_at": None,
        "signatures": []
    }
    
    await db.contracts.insert_one(doc)
    return {"id": contract_id, "message": "Contract created", "status": "draft"}


@router.get("/")
async def get_contracts(
    status: Optional[str] = None,
    claim_id: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get all contracts"""
    query = {}
    if status:
        query["status"] = status
    if claim_id:
        await _get_claim_for_user_or_403(claim_id, current_user)
        query["claim_id"] = claim_id

    visibility_filter = await _build_contract_visibility_filter(current_user)
    effective_query = _combine_query_filters(query, visibility_filter)

    contracts = await db.contracts.find(effective_query, {"_id": 0}).sort("created_at", -1).to_list(limit)

    stats_scope = _combine_query_filters({"claim_id": claim_id} if claim_id else {}, visibility_filter)
    total = await db.contracts.count_documents(stats_scope)
    signed = await db.contracts.count_documents(_combine_query_filters(stats_scope, {"status": "signed"}))
    pending = await db.contracts.count_documents(_combine_query_filters(stats_scope, {"status": "pending"}))
    draft = await db.contracts.count_documents(_combine_query_filters(stats_scope, {"status": "draft"}))
    
    return {
        "contracts": contracts,
        "stats": {
            "total": total,
            "signed": signed,
            "pending": pending,
            "draft": draft
        }
    }


@router.get("/{contract_id}")
async def get_contract(
    contract_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific contract"""
    return await _get_contract_for_user_or_403(contract_id, current_user)


@router.patch("/{contract_id}")
async def update_contract(
    contract_id: str,
    field_values: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Update contract field values"""
    _require_mutating_role(current_user)
    contract = await _get_contract_for_user_or_403(contract_id, current_user)
    if contract.get("status") == "signed":
        raise HTTPException(status_code=400, detail="Cannot edit signed contracts")

    result = await db.contracts.update_one(
        {"id": contract_id},
        {"$set": {
            "field_values": field_values,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    return {"message": "Contract updated"}


@router.delete("/{contract_id}")
async def delete_contract(
    contract_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a draft contract"""
    _require_mutating_role(current_user)
    contract = await _get_contract_for_user_or_403(contract_id, current_user)

    if contract.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Only draft contracts can be deleted")
    
    await db.contracts.delete_one({"id": contract_id})
    return {"message": "Contract deleted"}


# ============================================
# E-Signature Endpoints (SignNow Integration)
# ============================================

@router.post("/{contract_id}/send")
async def send_contract_for_signature(
    contract_id: str,
    request: ContractSendRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send a contract for e-signature via SignNow"""
    _require_mutating_role(current_user)
    contract = await _get_contract_for_user_or_403(contract_id, current_user)
    
    # Check if SignNow is configured
    signnow_token = os.getenv('SIGNNOW_ACCESS_TOKEN') or await _get_signnow_token()
    if not signnow_token:
        # Return info about manual process if SignNow not configured
        return {
            "status": "signnow_not_configured",
            "message": "SignNow not configured. Configure your SignNow access token in Settings to enable e-signatures.",
            "manual_steps": [
                "1. Download the contract PDF",
                "2. Have the client sign manually",
                "3. Upload the signed document"
            ],
            "template_pdf_url": CARE_CLAIMS_TEMPLATE.get("pdf_url")
        }
    
    try:
        signnow = SignNowService(signnow_token)
        
        # If we have a document ID, send for signature
        doc_id = contract.get("signnow_document_id")
        
        if not doc_id:
            # Need to upload document first
            # For now, return instructions
            return {
                "status": "needs_upload",
                "message": "Contract needs to be uploaded to SignNow first",
                "contract_id": contract_id
            }
        
        # Send for signature
        subject = request.subject or f"Please sign: {contract['template_name']}"
        message = request.message or f"Please review and sign this {contract['template_name']} for your insurance claim."
        
        result = await signnow.send_for_signature(
            document_id=doc_id,
            signer_email=request.signer_email,
            signer_name=request.signer_name,
            subject=subject,
            message=message
        )
        
        # Update contract status
        await db.contracts.update_one(
            {"id": contract_id},
            {"$set": {
                "status": "pending",
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "signer_email": request.signer_email,
                "signer_name": request.signer_name
            }}
        )
        
        return {
            "status": "sent",
            "message": f"Contract sent to {request.signer_email}",
            "invite_id": result.get("invite_id")
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send contract: {str(e)}")


@router.get("/{contract_id}/status")
async def get_contract_signature_status(
    contract_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Check signing status from SignNow"""
    contract = await _get_contract_for_user_or_403(contract_id, current_user)
    
    doc_id = contract.get("signnow_document_id")
    if not doc_id:
        return {"status": contract.get("status", "draft")}
    
    signnow_token = os.getenv('SIGNNOW_ACCESS_TOKEN') or await _get_signnow_token()
    if not signnow_token:
        return {"status": contract.get("status", "draft")}
    
    try:
        signnow = SignNowService(signnow_token)
        result = await signnow.get_document_status(doc_id)
        
        # Update local status if signed
        if result.get("status") == "completed":
            await db.contracts.update_one(
                {"id": contract_id},
                {"$set": {
                    "status": "signed",
                    "signed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        return result
        
    except Exception as e:
        return {"status": contract.get("status", "draft"), "error": str(e)}


@router.get("/{contract_id}/download")
async def download_contract(
    contract_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download contract PDF (signed if available)"""
    contract = await _get_contract_for_user_or_403(contract_id, current_user)
    
    doc_id = contract.get("signnow_document_id")
    signnow_token = os.getenv('SIGNNOW_ACCESS_TOKEN') or await _get_signnow_token()
    
    if doc_id and signnow_token:
        try:
            signnow = SignNowService(signnow_token)
            content = await signnow.download_signed_document(doc_id)
            
            return StreamingResponse(
                io.BytesIO(content),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=contract_{contract_id}.pdf"
                }
            )
        except Exception as e:
            logger.warning(f"SignNow download failed: {e}")
            pass
    
    # Return template PDF URL if no signed version
    return {
        "pdf_url": CARE_CLAIMS_TEMPLATE.get("pdf_url"),
        "message": "Returning blank template - no signed version available"
    }


@router.get("/{contract_id}/pdf")
async def generate_filled_pdf(
    contract_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate a filled PDF with the contract data overlaid on the template.
    This creates a proper PDF with all field values populated.
    If signed, includes the captured signature.
    """
    import httpx
    import fitz  # PyMuPDF
    import base64
    
    contract = await _get_contract_for_user_or_403(contract_id, current_user)
    
    field_values = contract.get("field_values", {})
    signature_data = contract.get("signature_data")
    
    try:
        # Download the blank template PDF
        pdf_url = CARE_CLAIMS_TEMPLATE.get("pdf_url")
        async with httpx.AsyncClient() as client:
            pdf_response = await client.get(pdf_url, timeout=30.0)
            if pdf_response.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to download template PDF")
            pdf_bytes = pdf_response.content
        
        # Open the PDF with PyMuPDF
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        # Define field positions on the PDF (coordinates in points, 72 points = 1 inch)
        # These are approximate - you may need to adjust based on actual template
        field_positions = {
            # Page 1 - Policyholder section (estimated positions)
            "policyholder_name": {"page": 0, "x": 160, "y": 148, "fontsize": 10},
            "policyholder_email": {"page": 0, "x": 160, "y": 163, "fontsize": 10},
            "policyholder_address": {"page": 0, "x": 160, "y": 178, "fontsize": 10},
            "policyholder_city": {"page": 0, "x": 160, "y": 193, "fontsize": 10},
            "policyholder_state": {"page": 0, "x": 320, "y": 193, "fontsize": 10},
            "policyholder_zip": {"page": 0, "x": 380, "y": 193, "fontsize": 10},
            "policyholder_phone": {"page": 0, "x": 160, "y": 208, "fontsize": 10},
            "policyholder_mobile": {"page": 0, "x": 320, "y": 208, "fontsize": 10},
            
            # Insurance Company section
            "insurance_company": {"page": 0, "x": 160, "y": 258, "fontsize": 10},
            "policy_number": {"page": 0, "x": 400, "y": 258, "fontsize": 10},
            "claim_number": {"page": 0, "x": 160, "y": 273, "fontsize": 10},
            "insurance_address": {"page": 0, "x": 160, "y": 288, "fontsize": 10},
            "field_adjuster": {"page": 0, "x": 160, "y": 303, "fontsize": 10},
            "field_adjuster_phone": {"page": 0, "x": 400, "y": 303, "fontsize": 10},
            "desk_adjuster": {"page": 0, "x": 160, "y": 318, "fontsize": 10},
            "desk_adjuster_phone": {"page": 0, "x": 400, "y": 318, "fontsize": 10},
            
            # Loss Location section
            "loss_address": {"page": 0, "x": 160, "y": 368, "fontsize": 10},
            "loss_city": {"page": 0, "x": 160, "y": 383, "fontsize": 10},
            "loss_state_zip": {"page": 0, "x": 320, "y": 383, "fontsize": 10},
            "date_of_loss": {"page": 0, "x": 160, "y": 398, "fontsize": 10},
            "description_of_loss": {"page": 0, "x": 160, "y": 413, "fontsize": 9, "width": 400},
            "claim_type": {"page": 0, "x": 160, "y": 443, "fontsize": 10},
            
            # Fee section
            "fee_percentage": {"page": 0, "x": 400, "y": 478, "fontsize": 10},
        }
        
        # Add text to each field position
        for field_id, pos in field_positions.items():
            value = field_values.get(field_id, "")
            if value:
                page = doc[pos["page"]]
                fontsize = pos.get("fontsize", 10)
                
                # Handle multiline text for description
                if field_id == "description_of_loss" and len(str(value)) > 50:
                    # Truncate long descriptions
                    value = str(value)[:200] + "..." if len(str(value)) > 200 else value
                
                # Insert text
                text_point = fitz.Point(pos["x"], pos["y"])
                page.insert_text(
                    text_point,
                    str(value),
                    fontsize=fontsize,
                    fontname="helv",
                    color=(0, 0, 0)
                )
        
        # Add signature if available (for signed contracts)
        if signature_data and signature_data.startswith('data:image'):
            try:
                # Extract base64 data from data URL
                header, encoded = signature_data.split(',', 1)
                signature_bytes = base64.b64decode(encoded)
                
                # Get the last page for signature (or use page 0 for now)
                # Adjust the page index based on your template
                sig_page_idx = min(1, len(doc) - 1)  # Second page if exists, else first
                sig_page = doc[sig_page_idx]
                
                # Insert signature image at the signature line position
                # Adjust these coordinates based on your template's signature line
                sig_rect = fitz.Rect(100, 650, 300, 720)  # x0, y0, x1, y1
                
                # Insert the signature image
                sig_page.insert_image(sig_rect, stream=signature_bytes)
                
                # Add signed date below signature
                signed_at = contract.get("signed_at", "")
                if signed_at:
                    try:
                        signed_date = datetime.fromisoformat(signed_at.replace('Z', '+00:00'))
                        date_str = signed_date.strftime("%m/%d/%Y")
                    except Exception:
                        date_str = signed_at[:10]
                    
                    sig_page.insert_text(
                        fitz.Point(320, 700),
                        f"Date: {date_str}",
                        fontsize=10,
                        fontname="helv",
                        color=(0, 0, 0)
                    )
                
                # Add signer name
                signer_name = contract.get("signer_name") or contract.get("client_name", "")
                if signer_name:
                    sig_page.insert_text(
                        fitz.Point(100, 735),
                        f"Signed by: {signer_name}",
                        fontsize=9,
                        fontname="helv",
                        color=(0.3, 0.3, 0.3)
                    )
                    
            except Exception as e:
                logger.warning(f"Failed to add signature to PDF: {e}")
        
        # Adjuster information is pre-filled in the template PDF
        
        # Save to bytes
        pdf_output = io.BytesIO()
        doc.save(pdf_output)
        doc.close()
        pdf_output.seek(0)
        
        # Add "SIGNED" watermark if contract is signed
        if contract.get("status") == "signed":
            # Re-open to add watermark
            doc = fitz.open(stream=pdf_output.getvalue(), filetype="pdf")
            for page in doc:
                # Add a subtle "SIGNED" text in the corner
                page.insert_text(
                    fitz.Point(450, 30),
                    "✓ SIGNED",
                    fontsize=12,
                    fontname="helv",
                    color=(0, 0.5, 0)  # Green color
                )
            
            pdf_output = io.BytesIO()
            doc.save(pdf_output)
            doc.close()
            pdf_output.seek(0)
        
        filename = f"contract_{contract.get('client_name', 'unknown').replace(' ', '_')}_{contract_id[:8]}.pdf"
        
        return StreamingResponse(
            pdf_output,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except Exception as e:
        logger.error(f"PDF generation error: {e}")
        # Fallback to template URL
        return {
            "pdf_url": CARE_CLAIMS_TEMPLATE.get("pdf_url"),
            "message": f"PDF generation failed: {str(e)}. Download blank template instead.",
            "field_values": field_values
        }
# Pre-fill from Claim
# ============================================

@router.get("/prefill/{claim_id}")
async def prefill_contract_from_claim(
    claim_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get pre-filled contract values from a claim"""
    claim = await _get_claim_for_user_or_403(claim_id, current_user)
    
    # Parse address if needed
    address_parts = claim.get("property_address", "").split(",")
    city = ""
    state_zip = ""
    if len(address_parts) >= 2:
        city = address_parts[-2].strip() if len(address_parts) >= 2 else ""
        state_zip = address_parts[-1].strip() if len(address_parts) >= 1 else ""
    
    # Build prefilled values
    prefilled = {
        "policyholder_name": claim.get("client_name", ""),
        "policyholder_email": claim.get("client_email", ""),
        "policyholder_address": address_parts[0].strip() if address_parts else "",
        "policyholder_city": city,
        "policyholder_state": state_zip.split()[0] if state_zip else "",
        "policyholder_zip": state_zip.split()[1] if len(state_zip.split()) > 1 else "",
        "policyholder_phone": claim.get("import_metadata", {}).get("policyholder_phone", ""),
        "policy_number": claim.get("policy_number", ""),
        "claim_number": claim.get("claim_number", ""),
        "insurance_company": claim.get("import_metadata", {}).get("insurance_company", ""),
        "loss_address": claim.get("property_address", ""),
        "loss_city": city,
        "loss_state_zip": state_zip,
        "date_of_loss": claim.get("date_of_loss", ""),
        "description_of_loss": claim.get("description", ""),
        "claim_type": "Non Emergency"
    }
    
    return {
        "claim_id": claim_id,
        "prefilled_values": prefilled,
        "template_id": CARE_CLAIMS_TEMPLATE["id"]
    }


# ============================================
# Sign On The Spot - In-Person E-Signature
# ============================================

class InPersonSignRequest(BaseModel):
    host_email: Optional[str] = None  # Adjuster email override


@router.post("/{contract_id}/sign-in-person")
async def sign_contract_in_person(
    contract_id: str,
    body: InPersonSignRequest = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Create an in-person signing link for a contract.
    
    Flow:
    1. Adjuster opens the contract on their phone/tablet
    2. Taps "Sign On The Spot"
    3. Eden calls this endpoint → gets SignNow URL
    4. Browser navigates to SignNow signing UI
    5. Client signs with finger/stylus
    6. SignNow redirects back or webhook marks contract signed
    
    Returns a signing_url that opens the SignNow embedded signing UI.
    """
    from integrations.signnow_client import (
        get_signnow_access_token, 
        create_mock_signing_response,
        SIGNNOW_API_BASE
    )
    import httpx
    
    _require_mutating_role(current_user)
    contract = await _get_contract_for_user_or_403(contract_id, current_user)
    
    # Get signer info from contract
    signer_email = contract.get("client_email", "")
    signer_name = contract.get("client_name", "Unknown")
    host_email = (body.host_email if body else None) or current_user.get("email", "")
    user_email = current_user.get("email", "")
    
    # Get SignNow access token
    access_token = await get_signnow_access_token(user_email)
    
    if not access_token:
        # SignNow not configured - return mock response for demo
        mock_result = create_mock_signing_response(contract_id, signer_name)
        
        # Update contract to show in-person signing was started
        await db.contracts.update_one(
            {"id": contract_id},
            {"$set": {
                "status": "in_person_pending",
                "in_person_started_at": datetime.now(timezone.utc).isoformat(),
                "in_person_host": host_email
            }}
        )
        
        return mock_result
    
    # SignNow is configured - create real in-person invite
    signnow_doc_id = contract.get("signnow_document_id")
    
    if not signnow_doc_id:
        # Document not yet in SignNow - return mock for now
        # In production, you'd upload the contract PDF first
        mock_result = create_mock_signing_response(contract_id, signer_name)
        mock_result["message"] = "Contract needs to be synced to SignNow first. Using demo mode."
        
        await db.contracts.update_one(
            {"id": contract_id},
            {"$set": {
                "status": "in_person_pending",
                "in_person_started_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return mock_result
    
    try:
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # Create embedded in-person invite
        invite_payload = {
            "invites": [
                {
                    "email": signer_email,
                    "role": "Signer",
                    "role_id": "",
                    "order": 1,
                    "auth_method": "none",
                    "in_person": True,
                    "signer_name": signer_name,
                    "host": {
                        "email": host_email
                    }
                }
            ]
        }
        
        async with httpx.AsyncClient() as client:
            # Create the in-person invite
            invite_resp = await client.post(
                f"{SIGNNOW_API_BASE}/v2/documents/{signnow_doc_id}/embedded-invite",
                headers=headers,
                json=invite_payload,
                timeout=30.0
            )
            
            if invite_resp.status_code in [200, 201]:
                invite_data = invite_resp.json()
                signing_url = invite_data.get("url") or invite_data.get("link")
                
                if signing_url:
                    # Update contract status
                    await db.contracts.update_one(
                        {"id": contract_id},
                        {"$set": {
                            "signnow_in_person_url": signing_url,
                            "status": "in_person_pending",
                            "in_person_started_at": datetime.now(timezone.utc).isoformat(),
                            "in_person_host": host_email
                        }}
                    )
                    
                    return {
                        "signing_url": signing_url,
                        "contract_id": contract_id,
                        "signer_name": signer_name,
                        "mock": False
                    }
            
            # Fallback to mock if SignNow API fails
            print(f"[SignNow] In-person invite failed: {invite_resp.status_code} - {invite_resp.text}")
            
    except Exception as e:
        print(f"[SignNow] In-person sign error: {e}")
    
    # Return mock response as fallback
    mock_result = create_mock_signing_response(contract_id, signer_name)
    
    await db.contracts.update_one(
        {"id": contract_id},
        {"$set": {
            "status": "in_person_pending",
            "in_person_started_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return mock_result


class CompleteSigningRequest(BaseModel):
    signature_data: Optional[str] = None  # Base64 encoded signature image
    signer_name: Optional[str] = None
    signed_in_person: bool = True


@router.post("/{contract_id}/complete-signing")
async def complete_contract_signing(
    contract_id: str,
    request: CompleteSigningRequest = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark a contract as signed after in-person signing completes.
    Accepts signature data (base64 PNG) and saves it with the contract.
    """
    _require_mutating_role(current_user)
    contract = await _get_contract_for_user_or_403(contract_id, current_user)
    
    # Prepare update data
    update_data = {
        "status": "signed",
        "signed_at": datetime.now(timezone.utc).isoformat(),
        "signed_in_person": True,
        "signed_by": current_user.get("id")
    }
    
    # Add signature data if provided
    if request and request.signature_data:
        update_data["signature_data"] = request.signature_data
        update_data["signer_name"] = request.signer_name or contract.get("client_name")
    
    # Update contract status to signed
    await db.contracts.update_one(
        {"id": contract_id},
        {"$set": update_data}
    )
    
    # If contract is linked to a claim, add event to claim
    if contract.get("claim_id"):
        await db.claims.update_one(
            {"id": contract["claim_id"]},
            {"$push": {
                "events": {
                    "type": "contract_signed",
                    "contract_id": contract_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "details": "Contract signed in person with digital signature",
                    "user_id": current_user.get("id")
                }
            }}
        )
    
    # Emit game event for incentives engine
    await _emit_contract_event(
        user_id=current_user.get("id"),
        event_type="contract.signed",
        contract_id=contract_id
    )
    
    return {
        "contract_id": contract_id,
        "status": "signed",
        "signed_at": datetime.now(timezone.utc).isoformat(),
        "message": "Contract signed successfully",
        "has_signature": bool(request and request.signature_data)
    }

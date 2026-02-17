"""
SignNow Client - Handles SignNow OAuth and e-signature APIs

Primary job: Contract signing (email and in-person)

Uses:
- SIGNNOW_CLIENT_ID
- SIGNNOW_CLIENT_SECRET
- SIGNNOW_API_URL (defaults to production)

In-Person Signing Flow:
1. Create contract from template
2. Call create_in_person_invite() to get embedded signing link
3. Adjuster hands device to client
4. Client signs in browser/webview
5. SignNow webhook updates contract status
"""

from fastapi import APIRouter, Depends, HTTPException, Form
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import os
import httpx
import uuid
import base64

from routes.auth import get_current_active_user
from dependencies import db

router = APIRouter(prefix="/api/integrations/signnow", tags=["SignNow Integration"])

# SignNow API Configuration
SIGNNOW_API_BASE = os.environ.get("SIGNNOW_API_URL", "https://api.signnow.com")
SIGNNOW_CLIENT_ID = os.environ.get("SIGNNOW_CLIENT_ID")
SIGNNOW_CLIENT_SECRET = os.environ.get("SIGNNOW_CLIENT_SECRET")
SIGNNOW_ACCESS_TOKEN = os.environ.get("SIGNNOW_ACCESS_TOKEN")


# ============================================
# MODELS
# ============================================

class InPersonSignRequest(BaseModel):
    """Request to create in-person signing session"""
    contract_id: str
    signer_email: str
    signer_name: str
    host_email: Optional[str] = None  # Adjuster's email


class SigningLinkResponse(BaseModel):
    """Response with embedded signing URL"""
    signing_link: str
    expires_at: str
    contract_id: str
    signer_name: str


# ============================================
# TOKEN MANAGEMENT
# ============================================

async def get_signnow_access_token(user_email: str = None) -> Optional[str]:
    """
    Get a valid SignNow access token.
    Priority: 1) Direct API token from env, 2) User OAuth token, 3) App-level credentials.
    """
    # Priority 1: Direct API token from environment
    if SIGNNOW_ACCESS_TOKEN:
        return SIGNNOW_ACCESS_TOKEN

    # Priority 2: User-specific OAuth token
    if user_email:
        token_doc = await db.integration_tokens.find_one({
            "user_email": user_email,
            "provider": "signnow"
        })

        if token_doc and token_doc.get("access_token"):
            expires_at = token_doc.get("expires_at")
            if expires_at:
                if isinstance(expires_at, str):
                    expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)

                if expires_at > datetime.now(timezone.utc):
                    return token_doc["access_token"]
                else:
                    refreshed = await refresh_signnow_token(user_email, token_doc.get("refresh_token"))
                    if refreshed:
                        return refreshed

    # Priority 3: App-level OAuth (client credentials)
    if SIGNNOW_CLIENT_ID and SIGNNOW_CLIENT_SECRET:
        return await get_app_level_token()

    return None


async def get_app_level_token() -> Optional[str]:
    """Get app-level access token using client credentials"""
    if not SIGNNOW_CLIENT_ID or not SIGNNOW_CLIENT_SECRET:
        return None
    
    # Check if we have a cached app token
    app_token = await db.integration_tokens.find_one({
        "provider": "signnow",
        "token_type": "app_level"
    })
    
    if app_token:
        expires_at = app_token.get("expires_at")
        if expires_at:
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            if expires_at > datetime.now(timezone.utc):
                return app_token["access_token"]
    
    # Get new token via client credentials
    try:
        auth_string = base64.b64encode(f"{SIGNNOW_CLIENT_ID}:{SIGNNOW_CLIENT_SECRET}".encode()).decode()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{SIGNNOW_API_BASE}/oauth2/token",
                headers={
                    "Authorization": f"Basic {auth_string}",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data={
                    "grant_type": "client_credentials",
                    "scope": "user"
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                expires_in = data.get("expires_in", 3600)
                expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
                
                # Cache the token
                await db.integration_tokens.update_one(
                    {"provider": "signnow", "token_type": "app_level"},
                    {"$set": {
                        "provider": "signnow",
                        "token_type": "app_level",
                        "access_token": data["access_token"],
                        "expires_at": expires_at.isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }},
                    upsert=True
                )
                
                return data["access_token"]
    except Exception as e:
        print(f"[SignNow] Failed to get app token: {e}")
    
    return None


async def refresh_signnow_token(user_email: str, refresh_token: str) -> Optional[str]:
    """Refresh an expired SignNow OAuth token"""
    if not refresh_token or not SIGNNOW_CLIENT_ID or not SIGNNOW_CLIENT_SECRET:
        return None
    
    try:
        auth_string = base64.b64encode(f"{SIGNNOW_CLIENT_ID}:{SIGNNOW_CLIENT_SECRET}".encode()).decode()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{SIGNNOW_API_BASE}/oauth2/token",
                headers={
                    "Authorization": f"Basic {auth_string}",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                expires_in = data.get("expires_in", 3600)
                expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
                
                await db.integration_tokens.update_one(
                    {"user_email": user_email, "provider": "signnow"},
                    {"$set": {
                        "access_token": data["access_token"],
                        "refresh_token": data.get("refresh_token", refresh_token),
                        "expires_at": expires_at.isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                return data["access_token"]
    except Exception as e:
        print(f"[SignNow] Token refresh failed: {e}")
    
    return None


# ============================================
# IN-PERSON SIGNING
# ============================================

@router.post("/in-person-invite")
async def create_in_person_invite(
    request: InPersonSignRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Create an in-person signing invite for a contract.
    Returns an embedded signing link the adjuster can hand to the client.
    """
    user_email = current_user.get("email", "")
    host_email = request.host_email or user_email
    
    # Get the contract
    contract = await db.contracts.find_one({"id": request.contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    # Check if contract has a SignNow document ID
    signnow_doc_id = contract.get("signnow_document_id")
    
    # Get access token
    access_token = await get_signnow_access_token(user_email)
    if not access_token:
        # Return mock response if SignNow not configured
        return create_mock_signing_response(request.contract_id, request.signer_name)
    
    try:
        # If no SignNow document exists, create one first
        if not signnow_doc_id:
            signnow_doc_id = await upload_contract_to_signnow(
                access_token, 
                contract,
                request.signer_email
            )
            
            if not signnow_doc_id:
                return create_mock_signing_response(request.contract_id, request.signer_name)
            
            # Update contract with SignNow document ID
            await db.contracts.update_one(
                {"id": request.contract_id},
                {"$set": {"signnow_document_id": signnow_doc_id}}
            )
        
        # Create embedded invite
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # Create invite payload
        invite_payload = {
            "invites": [
                {
                    "email": request.signer_email,
                    "role": "Signer",
                    "role_id": "",
                    "order": 1,
                    "reassign": "0",
                    "decline_by_signature": "0",
                    "reminder": 0,
                    "expiration_days": 30,
                    "subject": f"Please sign: {contract.get('title', 'Contract')}",
                    "message": "Please review and sign this document."
                }
            ]
        }
        
        async with httpx.AsyncClient() as client:
            # Create the invite
            invite_resp = await client.post(
                f"{SIGNNOW_API_BASE}/document/{signnow_doc_id}/invite",
                headers=headers,
                json=invite_payload,
                timeout=30.0
            )
            
            if invite_resp.status_code not in [200, 201]:
                print(f"[SignNow] Invite creation failed: {invite_resp.text}")
                return create_mock_signing_response(request.contract_id, request.signer_name)
            
            # Get embedded signing link
            link_payload = {
                "document_id": signnow_doc_id,
                "access_token": access_token,
                "link_expiration": 45  # minutes
            }
            
            link_resp = await client.post(
                f"{SIGNNOW_API_BASE}/link",
                headers=headers,
                json=link_payload,
                timeout=30.0
            )
            
            if link_resp.status_code == 200:
                link_data = link_resp.json()
                signing_link = link_data.get("url")
                
                # Update contract status
                await db.contracts.update_one(
                    {"id": request.contract_id},
                    {"$set": {
                        "status": "pending_signature",
                        "in_person_signing_started": datetime.now(timezone.utc).isoformat(),
                        "signer_email": request.signer_email,
                        "signer_name": request.signer_name
                    }}
                )
                
                return {
                    "signing_link": signing_link,
                    "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=45)).isoformat(),
                    "contract_id": request.contract_id,
                    "signer_name": request.signer_name,
                    "mock": False
                }
            else:
                print(f"[SignNow] Link creation failed: {link_resp.text}")
                return create_mock_signing_response(request.contract_id, request.signer_name)
                
    except Exception as e:
        print(f"[SignNow] In-person invite error: {e}")
        return create_mock_signing_response(request.contract_id, request.signer_name)


async def upload_contract_to_signnow(access_token: str, contract: dict, signer_email: str) -> Optional[str]:
    """Upload a contract document to SignNow"""
    headers = {"Authorization": f"Bearer {access_token}"}

    try:
        file_path = contract.get("file_path") or contract.get("pdf_path")
        if file_path and os.path.exists(file_path):
            async with httpx.AsyncClient() as client:
                with open(file_path, "rb") as f:
                    files = {"file": (os.path.basename(file_path), f, "application/pdf")}
                    resp = await client.post(
                        f"{SIGNNOW_API_BASE}/document",
                        files=files,
                        headers=headers,
                        timeout=30.0
                    )
                    if resp.status_code in [200, 201]:
                        return resp.json().get("id")
                    print(f"[SignNow] Upload failed: {resp.status_code} {resp.text}")
        else:
            print(f"[SignNow] No local file for contract {contract.get('id')}")
    except Exception as e:
        print(f"[SignNow] Document upload error: {e}")

    return None


def create_mock_signing_response(contract_id: str, signer_name: str) -> dict:
    """Create a mock signing response when SignNow is not configured"""
    return {
        "signing_link": f"/contracts/{contract_id}/sign-demo?signer={signer_name}",
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=45)).isoformat(),
        "contract_id": contract_id,
        "signer_name": signer_name,
        "mock": True,
        "message": "SignNow not configured. Using demo signing page."
    }


@router.post("/complete-signing/{contract_id}")
async def complete_in_person_signing(
    contract_id: str,
    signature_data: str = Form(None),
    current_user: dict = Depends(get_current_active_user)
):
    """
    Mark a contract as signed after in-person signing completes.
    Called after the client finishes signing on the device.
    """
    contract = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    # Update contract status
    await db.contracts.update_one(
        {"id": contract_id},
        {"$set": {
            "status": "signed",
            "signed_at": datetime.now(timezone.utc).isoformat(),
            "signed_in_person": True,
            "signature_data": signature_data  # Base64 signature image if captured locally
        }}
    )
    
    # If contract is linked to a claim, update claim
    if contract.get("claim_id"):
        await db.claims.update_one(
            {"id": contract["claim_id"]},
            {"$push": {
                "events": {
                    "type": "contract_signed",
                    "contract_id": contract_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "details": "Contract signed in person"
                }
            }}
        )
    
    return {
        "contract_id": contract_id,
        "status": "signed",
        "signed_at": datetime.now(timezone.utc).isoformat(),
        "message": "Contract signed successfully"
    }


@router.get("/signing-status/{contract_id}")
async def get_signing_status(
    contract_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Check the signing status of a contract"""
    contract = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    return {
        "contract_id": contract_id,
        "status": contract.get("status", "draft"),
        "signer_name": contract.get("signer_name"),
        "signer_email": contract.get("signer_email"),
        "signed_at": contract.get("signed_at"),
        "signed_in_person": contract.get("signed_in_person", False)
    }


# ============================================
# SIGNNOW CLIENT CLASS
# ============================================

class SignNowClient:
    """
    SignNow integration client for use in other parts of the app.
    Provides a clean interface for e-signature operations.
    """
    
    def __init__(self, user_email: str = None):
        self.user_email = user_email
        self._token = None
    
    async def is_connected(self) -> bool:
        """Check if SignNow is configured and connected"""
        if SIGNNOW_ACCESS_TOKEN:
            return True

        if self.user_email:
            token = await db.integration_tokens.find_one({
                "user_email": self.user_email,
                "provider": "signnow"
            })
            if token and token.get("access_token"):
                return True

        return bool(SIGNNOW_CLIENT_ID and SIGNNOW_CLIENT_SECRET)
    
    async def create_in_person_signing_link(
        self,
        contract_id: str,
        signer_email: str,
        signer_name: str
    ) -> dict:
        """Create an in-person signing link for a contract"""
        access_token = await get_signnow_access_token(self.user_email)
        
        if not access_token:
            return create_mock_signing_response(contract_id, signer_name)
        
        # Implementation would call SignNow API
        # For now, return mock
        return create_mock_signing_response(contract_id, signer_name)
    
    async def check_document_status(self, document_id: str) -> dict:
        """Check the status of a SignNow document"""
        access_token = await get_signnow_access_token(self.user_email)
        
        if not access_token:
            return {"status": "unknown", "error": "SignNow not configured"}
        
        try:
            headers = {"Authorization": f"Bearer {access_token}"}
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{SIGNNOW_API_BASE}/document/{document_id}",
                    headers=headers,
                    timeout=20.0
                )
                
                if response.status_code == 200:
                    return response.json()
        except Exception as e:
            print(f"[SignNow] Status check error: {e}")
        
        return {"status": "unknown", "error": "Failed to check status"}

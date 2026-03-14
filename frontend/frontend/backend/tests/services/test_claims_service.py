import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
from fastapi import HTTPException

from services.claims_service import ClaimsService
from models import ClaimCreate, ClaimUpdate

# Mock data
MOCK_USER = {
    "id": "user123",
    "email": "test@eden.com",
    "full_name": "Test User",
    "role": "client"
}

MOCK_ADJUSTER = {
    "id": "adj456",
    "email": "adjuster@eden.com",
    "full_name": "Adjuster Joe",
    "role": "adjuster"
}

@pytest.fixture
def mock_db():
    db = MagicMock()
    db.claims = MagicMock()
    # Mock insert_one
    db.claims.insert_one = AsyncMock(return_value=None)
    
    # Mock find (async cursor pattern for Motor)
    # The cursor itself is a sync object, but to_list is async
    mock_cursor = MagicMock()
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.to_list = AsyncMock(return_value=[])
    
    # find returns the cursor synchronously
    db.claims.find.return_value = mock_cursor
    return db

@pytest.fixture
def claims_service(mock_db):
    service = ClaimsService(mock_db)
    # Mock internal side-effect methods to prevent actual calls
    service._notify_claim_created = AsyncMock()
    service._email_claim_created = AsyncMock()
    service._sms_claim_created = AsyncMock()
    service._emit_claim_event = AsyncMock()
    service._log_claim_event = MagicMock()
    
    # New event dispatch mock
    service._dispatch_domain_event = AsyncMock()
    
    return service

@pytest.mark.asyncio
async def test_create_claim_success(claims_service):
    claim_data = ClaimCreate(
        claim_number="CLM-1001",
        client_name="Test Client",
        client_email="test@eden.com",
        property_address="123 Eden Lane",
        claim_type="Water"
    )
    
    result = await claims_service.create_claim(claim_data, MOCK_USER)
    
    # Assert DB insert called
    claims_service.db.claims.insert_one.assert_called_once()
    
    # Assert created fields
    assert result.client_name == "Test Client"
    assert result.created_by == "user123"
    assert result.assigned_to == "Test User"
    assert result.status == "New" # Default status enforced
    
    # Assert event dispatched
    claims_service._dispatch_domain_event.assert_called_once()
    args = claims_service._dispatch_domain_event.call_args[0]
    assert args[0] == "ClaimCreated"

@pytest.mark.asyncio
async def test_get_claims_client_isolation(claims_service):
    # Setup mock return
    mock_claim = {
        "id": "c1",
        "claim_number": "CLM-001",
        "client_name": "Test Client",
        "client_email": "test@eden.com",
        "property_address": "123 Test St",
        "created_by": "user123",
        "status": "New",
        "created_at": datetime.now(timezone.utc)
    }
    claims_service.db.claims.find.return_value.to_list.return_value = [mock_claim]
    
    await claims_service.get_claims(None, False, 10, MOCK_USER)
    
    # Assert query filtered by email for client
    call_args = claims_service.db.claims.find.call_args[0][0]
    assert call_args["client_email"] == "test@eden.com"
    assert call_args["is_archived"] == {"$ne": True}

@pytest.mark.asyncio
async def test_update_claim_permission_denied(claims_service):
    # Client trying to update claim
    with pytest.raises(HTTPException) as exc:
        await claims_service.update_claim("c1", ClaimUpdate(status="Approved"), MOCK_USER)
    
    assert exc.value.status_code == 403
    assert "Not authorized" in exc.value.detail

@pytest.mark.asyncio
async def test_get_claim_access_denied(claims_service):
    # Setup mock claim belonging to SOMEONE ELSE
    mock_claim = {
        "id": "c1",
        "client_email": "other@eden.com", # Not the mock user
        "status": "New"
    }
    claims_service.db.claims.find_one = AsyncMock(return_value=mock_claim)
    
    # Client tries to access other's claim
    with pytest.raises(HTTPException) as exc:
        await claims_service.get_claim("c1", MOCK_USER)
    
    assert exc.value.status_code == 403
    assert "Access denied" in exc.value.detail

@pytest.mark.asyncio
async def test_update_claim_invalid_transition(claims_service):
    # Setup existing claim in "New" status
    mock_claim = {
        "id": "c1",
        "status": "New",
        "claim_number": "CLM-001",
        "client_name": "Test Client",
        "client_email": "test@eden.com",
        "property_address": "123 Test St",
        "created_by": "user123",
        "claim_type": "Water"
    }
    claims_service.db.claims.find_one = AsyncMock(return_value=mock_claim)
    
    # Try to jump from "New" to "Closed" (Not allowed directly)
    with pytest.raises(HTTPException) as exc:
        await claims_service.update_claim("c1", ClaimUpdate(status="Closed"), MOCK_ADJUSTER)
    
    assert exc.value.status_code == 400
    assert "Invalid state transition" in exc.value.detail

@pytest.mark.asyncio
async def test_update_claim_valid_transition(claims_service):
    # Setup existing claim in "New" status
    mock_claim = {
        "id": "c1",
        "status": "New",
        "claim_number": "CLM-001",
        "client_name": "Test Client",
        "client_email": "test@eden.com",
        "property_address": "123 Test St",
        "created_by": "user123",
        "claim_type": "Water"
    }
    claims_service.db.claims.find_one = AsyncMock(return_value=mock_claim)
    claims_service.db.claims.update_one = AsyncMock()
    
    # Valid transition: New -> Under Review
    await claims_service.update_claim("c1", ClaimUpdate(status="Under Review"), MOCK_ADJUSTER)
    
    # Assert DB update called
    claims_service.db.claims.update_one.assert_called_once()
    
    # Assert event dispatched
    claims_service._dispatch_domain_event.assert_called_once()
    args = claims_service._dispatch_domain_event.call_args[0]
    assert args[0] == "ClaimUpdated"

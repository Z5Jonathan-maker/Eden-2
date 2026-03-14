import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from services.payments_service import PaymentsService, SUBSCRIPTION_PACKAGES

# Mock data
MOCK_USER = {
    "id": "user123",
    "email": "test@eden.com",
    "full_name": "Test User",
    "subscription": {}
}

@pytest.fixture
def mock_db():
    db = MagicMock()
    db.payment_transactions = MagicMock()
    db.users = MagicMock()
    
    # Mock insert_one
    db.payment_transactions.insert_one = AsyncMock(return_value=None)
    db.users.update_one = AsyncMock(return_value=None)
    
    return db

@pytest.fixture
def payments_service(mock_db):
    with patch.dict("os.environ", {"STRIPE_API_KEY": "sk_test_mock"}):
        service = PaymentsService(mock_db)
        # Mock internal helpers/loggers to isolate logic
        service._log_payment_event = MagicMock()
        return service

@pytest.mark.asyncio
async def test_get_packages_structure(payments_service):
    packages = payments_service.get_packages()
    assert len(packages) == 3
    assert packages[0]["id"] == "starter"
    assert packages[0]["amount"] == 79.00

@pytest.mark.asyncio
async def test_create_checkout_invalid_package(payments_service):
    with pytest.raises(HTTPException) as exc:
        await payments_service.create_checkout_session(
            "invalid_package", 
            "http://localhost", 
            MOCK_USER, 
            "http://api.eden"
        )
    assert exc.value.status_code == 400
    assert "Invalid package" in exc.value.detail

@pytest.mark.asyncio
async def test_create_checkout_success(payments_service):
    # Mock Stripe Checkout wrapper
    with patch("services.payments_service.StripeCheckout") as MockStripe:
        mock_instance = MockStripe.return_value
        mock_instance.create_checkout_session = AsyncMock(return_value=MagicMock(
            url="https://stripe.com/checkout",
            session_id="sess_123"
        ))
        
        result = await payments_service.create_checkout_session(
            "starter", 
            "http://localhost", 
            MOCK_USER, 
            "http://api.eden"
        )
        
        # Assert Stripe called correctly
        mock_instance.create_checkout_session.assert_called_once()
        
        # Assert DB transaction created
        payments_service.db.payment_transactions.insert_one.assert_called_once()
        
        # Assert Event logged
        payments_service._log_payment_event.assert_called_once()
        
        assert result["url"] == "https://stripe.com/checkout"
        assert result["session_id"] == "sess_123"

@pytest.mark.asyncio
async def test_handle_webhook_success(payments_service):
    # Mock Stripe Checkout wrapper
    with patch("services.payments_service.StripeCheckout") as MockStripe:
        mock_instance = MockStripe.return_value
        mock_instance.handle_webhook = AsyncMock(return_value=MagicMock(
            session_id="sess_123",
            payment_status="paid",
            event_type="checkout.session.completed",
            event_id="evt_123"
        ))
        
        # Mock finding transaction
        mock_transaction = {
            "session_id": "sess_123",
            "user_email": "test@eden.com",
            "package_id": "starter"
        }
        payments_service.db.payment_transactions.find_one = AsyncMock(return_value=mock_transaction)
        payments_service.db.payment_transactions.update_one = AsyncMock()
        payments_service.db.users.update_one = AsyncMock()
        
        await payments_service.handle_webhook(b"raw_body", "sig_123", "http://api.eden")
        
        # Assert transaction updated
        payments_service.db.payment_transactions.update_one.assert_called()
        
        # Assert user subscription activated
        payments_service.db.users.update_one.assert_called_once()
        call_args = payments_service.db.users.update_one.call_args
        assert call_args[0][0]["email"] == "test@eden.com"
        assert call_args[0][1]["$set"]["subscription"]["status"] == "active"

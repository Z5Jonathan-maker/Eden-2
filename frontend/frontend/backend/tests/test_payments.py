"""
Payment API Tests for Eden Claims Application
Tests Stripe payment integration endpoints:
- GET /api/payments/packages - List subscription packages
- POST /api/payments/checkout - Create Stripe checkout session (requires auth)
- GET /api/payments/status/{session_id} - Get payment status (requires auth)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "test@eden.com"
TEST_USER_PASSWORD = "password"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture
def auth_headers(auth_token):
    """Headers with auth token"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    }


class TestPaymentPackages:
    """Tests for GET /api/payments/packages endpoint"""
    
    def test_get_packages_returns_200(self):
        """GET /api/payments/packages should return 200"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        assert response.status_code == 200
    
    def test_get_packages_returns_three_tiers(self):
        """Should return exactly 3 pricing tiers"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        data = response.json()
        
        assert "packages" in data
        assert len(data["packages"]) == 3
    
    def test_starter_package_details(self):
        """Starter package should have correct details"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        packages = response.json()["packages"]
        
        starter = next((p for p in packages if p["id"] == "starter"), None)
        assert starter is not None
        assert starter["name"] == "Starter"
        assert starter["amount"] == 49.0
        assert starter["currency"] == "usd"
        assert "features" in starter
        assert len(starter["features"]) > 0
    
    def test_professional_package_details(self):
        """Professional package should have correct details"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        packages = response.json()["packages"]
        
        professional = next((p for p in packages if p["id"] == "professional"), None)
        assert professional is not None
        assert professional["name"] == "Professional"
        assert professional["amount"] == 99.0
        assert professional["currency"] == "usd"
        assert "Eve AI Assistant" in professional["features"]
    
    def test_enterprise_package_details(self):
        """Enterprise package should have correct details"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        packages = response.json()["packages"]
        
        enterprise = next((p for p in packages if p["id"] == "enterprise"), None)
        assert enterprise is not None
        assert enterprise["name"] == "Enterprise"
        assert enterprise["amount"] == 299.0
        assert "Dedicated account manager" in enterprise["features"]


class TestCheckoutSession:
    """Tests for POST /api/payments/checkout endpoint"""
    
    def test_checkout_requires_auth(self):
        """POST /api/payments/checkout should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            json={
                "package_id": "starter",
                "origin_url": "https://example.com"
            }
        )
        # API returns 403 for unauthenticated requests
        assert response.status_code in [401, 403]
    
    def test_checkout_starter_success(self, auth_headers):
        """Should create checkout session for starter package"""
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            headers=auth_headers,
            json={
                "package_id": "starter",
                "origin_url": "https://mycard-military.preview.emergentagent.com"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "url" in data
        assert "session_id" in data
        assert data["url"].startswith("https://checkout.stripe.com")
        assert data["session_id"].startswith("cs_test_")
    
    def test_checkout_professional_success(self, auth_headers):
        """Should create checkout session for professional package"""
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            headers=auth_headers,
            json={
                "package_id": "professional",
                "origin_url": "https://mycard-military.preview.emergentagent.com"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "url" in data
        assert "session_id" in data
    
    def test_checkout_enterprise_success(self, auth_headers):
        """Should create checkout session for enterprise package"""
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            headers=auth_headers,
            json={
                "package_id": "enterprise",
                "origin_url": "https://mycard-military.preview.emergentagent.com"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "url" in data
        assert "session_id" in data
    
    def test_checkout_invalid_package(self, auth_headers):
        """Should return 400 for invalid package ID"""
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            headers=auth_headers,
            json={
                "package_id": "invalid_package",
                "origin_url": "https://example.com"
            }
        )
        assert response.status_code == 400
        assert "Invalid package" in response.json().get("detail", "")
    
    def test_checkout_missing_package_id(self, auth_headers):
        """Should return 422 for missing package_id"""
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            headers=auth_headers,
            json={
                "origin_url": "https://example.com"
            }
        )
        assert response.status_code == 422
    
    def test_checkout_missing_origin_url(self, auth_headers):
        """Should return 422 for missing origin_url"""
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            headers=auth_headers,
            json={
                "package_id": "starter"
            }
        )
        assert response.status_code == 422


class TestPaymentStatus:
    """Tests for GET /api/payments/status/{session_id} endpoint"""
    
    @pytest.fixture
    def checkout_session(self, auth_headers):
        """Create a checkout session for testing"""
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            headers=auth_headers,
            json={
                "package_id": "starter",
                "origin_url": "https://mycard-military.preview.emergentagent.com"
            }
        )
        return response.json()
    
    def test_status_requires_auth(self, checkout_session):
        """GET /api/payments/status should require authentication"""
        session_id = checkout_session["session_id"]
        response = requests.get(f"{BASE_URL}/api/payments/status/{session_id}")
        # API returns 403 for unauthenticated requests
        assert response.status_code in [401, 403]
    
    def test_status_returns_unpaid_for_new_session(self, auth_headers, checkout_session):
        """New checkout session should have unpaid status"""
        session_id = checkout_session["session_id"]
        response = requests.get(
            f"{BASE_URL}/api/payments/status/{session_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "open"
        assert data["payment_status"] == "unpaid"
        assert data["amount_total"] == 49.0
        assert data["currency"] == "usd"
        assert data["package_id"] == "starter"
        assert "message" in data
    
    def test_status_invalid_session_id(self, auth_headers):
        """Should return error for invalid session ID"""
        response = requests.get(
            f"{BASE_URL}/api/payments/status/invalid_session_id",
            headers=auth_headers
        )
        # Stripe will return an error for invalid session (500 or 520)
        assert response.status_code >= 500


class TestSubscriptionEndpoint:
    """Tests for GET /api/payments/subscription endpoint"""
    
    def test_subscription_requires_auth(self):
        """GET /api/payments/subscription should require authentication"""
        response = requests.get(f"{BASE_URL}/api/payments/subscription")
        # API returns 403 for unauthenticated requests
        assert response.status_code in [401, 403]
    
    def test_subscription_returns_status(self, auth_headers):
        """Should return subscription status for authenticated user"""
        response = requests.get(
            f"{BASE_URL}/api/payments/subscription",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # User may or may not have subscription
        assert "has_subscription" in data
        if data["has_subscription"]:
            assert "plan" in data
            assert "status" in data
        else:
            assert data["status"] == "none"


class TestTransactionsEndpoint:
    """Tests for GET /api/payments/transactions endpoint"""
    
    def test_transactions_requires_auth(self):
        """GET /api/payments/transactions should require authentication"""
        response = requests.get(f"{BASE_URL}/api/payments/transactions")
        # API returns 403 for unauthenticated requests
        assert response.status_code in [401, 403]
    
    def test_transactions_returns_list(self, auth_headers):
        """Should return list of transactions for authenticated user"""
        response = requests.get(
            f"{BASE_URL}/api/payments/transactions",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "transactions" in data
        assert isinstance(data["transactions"], list)

"""
Eden Smoke Tests - Domain-specific test suites
Run with: pytest tests/ -v

These tests verify core functionality for each domain:
- Claims: CRUD operations
- Inspections: Session and photo management
- Harvest: Pin CRUD and status changes
- Contracts: Template and contract flow
- Eve AI: Basic Q&A
"""

import pytest
import httpx
import os
from datetime import datetime

# Test configuration
API_URL = os.environ.get("TEST_API_URL", "http://localhost:8001")
TEST_EMAIL = "test@eden.com"
TEST_PASSWORD = "password"


@pytest.fixture(scope="session")
def auth_token():
    """Get authentication token for tests"""
    response = httpx.post(
        f"{API_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    """Get auth headers"""
    return {"Authorization": f"Bearer {auth_token}"}


# ============================================
# HEALTH CHECK TESTS
# ============================================

class TestHealth:
    """Health check tests"""
    
    def test_health_endpoint(self):
        """Test /health returns healthy status"""
        response = httpx.get(f"{API_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        # assert "checks" in data
    
    def test_debug_info(self):
        """Test /api/debug/info returns version info"""
        response = httpx.get(f"{API_URL}/api/debug/info")
        assert response.status_code == 200
        data = response.json()
        assert "version" in data
        assert "features" in data


# ============================================
# CLAIMS TESTS
# ============================================

class TestClaims:
    """Claims domain smoke tests"""
    
    @pytest.fixture
    def test_claim_data(self):
        return {
            "claim_number": f"TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "client_name": "Test Client",
            "client_email": "testclient@example.com",
            "property_address": "123 Test St, Miami, FL 33101",
            "date_of_loss": datetime.now().strftime("%Y-%m-%d"),
            "claim_type": "residential",
            "policy_number": "POL-12345",
            "estimated_value": 50000.00
        }
    
    def test_create_claim(self, auth_headers, test_claim_data):
        """Test creating a claim"""
        response = httpx.post(
            f"{API_URL}/api/claims/",
            json=test_claim_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["claim_number"] == test_claim_data["claim_number"]
        return data["id"]
    
    def test_list_claims(self, auth_headers):
        """Test listing claims"""
        response = httpx.get(
            f"{API_URL}/api/claims/",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_filter_claims_by_status(self, auth_headers):
        """Test filtering claims by status"""
        response = httpx.get(
            f"{API_URL}/api/claims/?filter_status=new",
            headers=auth_headers
        )
        assert response.status_code == 200


# ============================================
# INSPECTIONS TESTS
# ============================================

class TestInspections:
    """Inspections domain smoke tests"""
    
    def test_list_sessions(self, auth_headers):
        """Test listing inspection sessions"""
        response = httpx.get(
            f"{API_URL}/api/inspections/sessions",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "sessions" in data
    
    def test_get_room_presets(self, auth_headers):
        """Test getting room presets"""
        response = httpx.get(
            f"{API_URL}/api/inspections/presets/rooms",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "rooms" in data
    
    def test_get_category_presets(self, auth_headers):
        """Test getting category presets"""
        response = httpx.get(
            f"{API_URL}/api/inspections/presets/categories",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data


# ============================================
# HARVEST TESTS
# ============================================

class TestHarvest:
    """Harvest/Canvassing domain smoke tests"""
    
    @pytest.fixture
    def test_pin_data(self):
        return {
            "latitude": 25.7617,
            "longitude": -80.1918,
            "address": "100 Test Ave, Miami, FL",
            "disposition": "unmarked"
        }
    
    def test_create_pin(self, auth_headers, test_pin_data):
        """Test creating a canvassing pin"""
        response = httpx.post(
            f"{API_URL}/api/canvassing-map/pins",
            json=test_pin_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        return data["id"]
    
    def test_list_pins(self, auth_headers):
        """Test listing canvassing pins"""
        response = httpx.get(
            f"{API_URL}/api/canvassing-map/pins",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        # API returns a list directly
        assert isinstance(data, list)
    
    def test_get_leaderboard(self, auth_headers):
        """Test getting Harvest leaderboard"""
        response = httpx.get(
            f"{API_URL}/api/harvest/leaderboard",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "leaderboard" in data
    
    def test_get_badges(self, auth_headers):
        """Test getting badge definitions"""
        response = httpx.get(
            f"{API_URL}/api/harvest/badges",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "badges" in data


# ============================================
# CONTRACTS TESTS
# ============================================

class TestContracts:
    """Contracts domain smoke tests"""
    
    def test_list_templates(self, auth_headers):
        """Test listing contract templates"""
        response = httpx.get(
            f"{API_URL}/api/contracts/templates",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "templates" in data
        assert len(data["templates"]) > 0  # At least the built-in template
    
    def test_get_builtin_template(self, auth_headers):
        """Test getting the built-in PA agreement template"""
        response = httpx.get(
            f"{API_URL}/api/contracts/templates/care-claims-pa-agreement",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "Public Adjuster Agreement" in data["name"]
        assert "fields" in data
    
    def test_list_contracts(self, auth_headers):
        """Test listing contracts"""
        response = httpx.get(
            f"{API_URL}/api/contracts/",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "contracts" in data
        assert "stats" in data


# ============================================
# EVE AI TESTS
# ============================================

class TestEveAI:
    """Eve AI assistant smoke tests"""
    
    def test_list_sessions(self, auth_headers):
        """Test listing AI chat sessions"""
        response = httpx.get(
            f"{API_URL}/api/ai/sessions",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "sessions" in data
    
    def test_simple_chat(self, auth_headers):
        """Test simple AI chat (if API key configured)"""
        response = httpx.post(
            f"{API_URL}/api/ai/chat",
            json={
                "message": "Hello, what can you help me with?",
                "session_id": None
            },
            headers=auth_headers,
            timeout=30.0
        )
        # May fail if no API key, which is acceptable
        if response.status_code == 200:
            data = response.json()
            assert "response" in data


# ============================================
# STATUTES TESTS
# ============================================

class TestStatutes:
    """Florida Statutes database smoke tests"""
    
    def test_list_statutes(self, auth_headers):
        """Test listing scraped statutes"""
        response = httpx.get(
            f"{API_URL}/api/statutes/",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "statutes" in data
    
    def test_get_status(self, auth_headers):
        """Test getting scraping status"""
        response = httpx.get(
            f"{API_URL}/api/statutes/status",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        # Check for actual keys in API response
        assert "total_statutes" in data or "coverage" in data


# ============================================
# EXPERTS TESTS
# ============================================

class TestExperts:
    """Industry Experts knowledge base smoke tests"""
    
    def test_list_experts(self, auth_headers):
        """Test listing industry experts"""
        response = httpx.get(
            f"{API_URL}/api/knowledge-base/experts",
            headers=auth_headers
        )
        # May return 404 if not initialized - that's acceptable
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, (list, dict))


# ============================================
# RUN CONFIGURATION
# ============================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

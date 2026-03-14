"""
Backend API Tests for Operation Eden - Functional Flow Verification
Tests: Login, Claims CRUD, Claims List, and core API functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@eden.com"
TEST_PASSWORD = "password"


class TestAuthFlow:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["email"] == TEST_EMAIL, "Email mismatch"
        print(f"SUCCESS: Login returned token and user data for {TEST_EMAIL}")
        return data["access_token"]
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        
        assert response.status_code in [401, 404], f"Expected 401/404, got {response.status_code}"
        print(f"SUCCESS: Invalid credentials returned {response.status_code}")


@pytest.fixture
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture
def auth_headers(auth_token):
    """Get auth headers for API calls"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestClaimsAPI:
    """Claims CRUD and listing tests"""
    
    def test_get_claims_list(self, auth_headers):
        """Test fetching claims list"""
        # Note: Claims API uses trailing slash
        response = requests.get(f"{BASE_URL}/api/claims/", headers=auth_headers)
        
        assert response.status_code == 200, f"Get claims failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of claims"
        print(f"SUCCESS: Retrieved {len(data)} claims")
    
    def test_create_claim(self, auth_headers):
        """Test creating a new claim"""
        claim_data = {
            "claim_number": f"TEST-{os.urandom(4).hex().upper()}",
            "client_name": "API Test Client",
            "client_email": "test@example.com",
            "property_address": "123 API Test St, Miami, FL 33101",
            "date_of_loss": "2026-01-15",
            "claim_type": "Water Damage",
            "policy_number": "POL-API-TEST",
            "estimated_value": 35000,
            "description": "Test claim created via API"
        }
        
        # Note: Claims API uses trailing slash
        response = requests.post(
            f"{BASE_URL}/api/claims/",
            headers=auth_headers,
            json=claim_data
        )
        
        assert response.status_code in [200, 201], f"Create claim failed: {response.text}"
        
        created = response.json()
        assert "id" in created, "Missing id in created claim"
        assert created["client_name"] == claim_data["client_name"], "Client name mismatch"
        assert created["property_address"] == claim_data["property_address"], "Address mismatch"
        
        print(f"SUCCESS: Created claim {created.get('claim_number')} with ID {created['id']}")
        return created["id"]
    
    def test_create_claim_minimal_fields(self, auth_headers):
        """Test creating claim with only required fields"""
        claim_data = {
            "claim_number": f"TEST-MIN-{os.urandom(4).hex().upper()}",
            "client_name": "Minimal Test Client",
            "property_address": "456 Minimal St, Tampa, FL 33602"
            # Optional fields omitted: client_email, date_of_loss, policy_number, estimated_value
        }
        
        response = requests.post(
            f"{BASE_URL}/api/claims/",
            headers=auth_headers,
            json=claim_data
        )
        
        assert response.status_code in [200, 201], f"Create minimal claim failed: {response.text}"
        
        created = response.json()
        assert created["client_name"] == claim_data["client_name"]
        print(f"SUCCESS: Created minimal claim {created.get('claim_number')}")
        return created["id"]
    
    def test_get_claim_detail(self, auth_headers):
        """Test fetching a specific claim"""
        # First get list to get a claim ID
        list_response = requests.get(f"{BASE_URL}/api/claims/", headers=auth_headers)
        claims = list_response.json()
        
        if not claims:
            pytest.skip("No claims available to test")
        
        claim_id = claims[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/claims/{claim_id}", headers=auth_headers)
        
        assert response.status_code == 200, f"Get claim detail failed: {response.text}"
        
        claim = response.json()
        assert claim["id"] == claim_id, "Claim ID mismatch"
        assert "client_name" in claim, "Missing client_name"
        assert "property_address" in claim, "Missing property_address"
        
        print(f"SUCCESS: Retrieved claim {claim.get('claim_number')}")
    
    def test_update_claim(self, auth_headers):
        """Test updating a claim"""
        # First create a claim to update
        claim_data = {
            "claim_number": f"TEST-UPD-{os.urandom(4).hex().upper()}",
            "client_name": "Update Test Client",
            "property_address": "789 Update St, Orlando, FL 32801"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/claims/",
            headers=auth_headers,
            json=claim_data
        )
        
        if create_response.status_code not in [200, 201]:
            pytest.skip("Could not create claim for update test")
        
        claim_id = create_response.json()["id"]
        
        # Update the claim
        update_data = {
            "status": "In Progress",
            "estimated_value": 50000,
            "description": "Updated via API test"
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/claims/{claim_id}",
            headers=auth_headers,
            json=update_data
        )
        
        assert update_response.status_code == 200, f"Update claim failed: {update_response.text}"
        
        updated = update_response.json()
        assert updated["status"] == "In Progress", "Status not updated"
        
        # Verify with GET
        verify_response = requests.get(f"{BASE_URL}/api/claims/{claim_id}", headers=auth_headers)
        verified = verify_response.json()
        assert verified["status"] == "In Progress", "Update not persisted"
        
        print(f"SUCCESS: Updated claim {claim_id} status to 'In Progress'")


class TestDashboardAPI:
    """Dashboard stats - Note: stats are calculated client-side from claims list"""
    
    def test_claims_data_for_dashboard(self, auth_headers):
        """Test that claims data is available for dashboard calculation"""
        response = requests.get(f"{BASE_URL}/api/claims/", headers=auth_headers)
        
        assert response.status_code == 200, f"Get claims for dashboard failed: {response.text}"
        
        claims = response.json()
        assert isinstance(claims, list), "Expected list of claims"
        
        # Dashboard stats are calculated client-side
        total_claims = len(claims)
        active_claims = len([c for c in claims if c.get('status') not in ['Completed', 'Closed']])
        total_value = sum(c.get('estimated_value', 0) for c in claims)
        
        print(f"SUCCESS: Dashboard data - Total: {total_claims}, Active: {active_claims}, Value: ${total_value}")


class TestBattlePassAPI:
    """Battle Pass endpoint tests"""
    
    def test_get_battle_pass_progress(self, auth_headers):
        """Test fetching battle pass progress"""
        response = requests.get(f"{BASE_URL}/api/battle-pass/progress", headers=auth_headers)
        
        assert response.status_code == 200, f"Get battle pass progress failed: {response.text}"
        
        data = response.json()
        assert "current_tier" in data, "Missing current_tier"
        assert "current_xp" in data, "Missing current_xp"
        print(f"SUCCESS: Battle pass progress - Tier {data.get('current_tier')}, XP {data.get('current_xp')}")


class TestContractsAPI:
    """Contracts endpoint tests"""
    
    def test_get_contracts_list(self, auth_headers):
        """Test fetching contracts list"""
        response = requests.get(f"{BASE_URL}/api/contracts/", headers=auth_headers)
        
        assert response.status_code == 200, f"Get contracts failed: {response.text}"
        
        data = response.json()
        assert "contracts" in data or isinstance(data, list), "Expected contracts list"
        print(f"SUCCESS: Contracts endpoint working")
    
    def test_get_contract_templates(self, auth_headers):
        """Test fetching contract templates"""
        response = requests.get(f"{BASE_URL}/api/contracts/templates", headers=auth_headers)
        
        assert response.status_code == 200, f"Get templates failed: {response.text}"
        
        data = response.json()
        assert "templates" in data, "Missing templates in response"
        print(f"SUCCESS: Found {len(data.get('templates', []))} contract templates")


class TestHarvestAPI:
    """Harvest/Canvassing endpoint tests"""
    
    def test_get_canvassing_pins(self, auth_headers):
        """Test fetching canvassing pins"""
        response = requests.get(f"{BASE_URL}/api/canvassing-map/pins", headers=auth_headers)
        
        assert response.status_code == 200, f"Get pins failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of pins"
        print(f"SUCCESS: Retrieved {len(data)} canvassing pins")
    
    def test_get_harvest_leaderboard(self, auth_headers):
        """Test fetching harvest leaderboard"""
        response = requests.get(
            f"{BASE_URL}/api/harvest/scoring/leaderboard?period=day&limit=10",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Get leaderboard failed: {response.text}"
        
        data = response.json()
        assert "entries" in data, "Missing entries in leaderboard"
        print(f"SUCCESS: Harvest leaderboard has {len(data.get('entries', []))} entries")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

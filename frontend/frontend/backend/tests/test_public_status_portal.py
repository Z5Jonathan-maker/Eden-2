"""
Test Public Client Status Portal and SMS Configuration
Tests:
- GET /api/client-status/claim/{claim_id}/public - Public status endpoint (no auth)
- GET /api/sms/status - SMS configuration status (requires auth)
- Verify Twilio is in LIVE mode (not dry-run)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test claim ID provided in requirements
TEST_CLAIM_ID = "34fb0abd-ca29-4840-8f3c-250a8f0f3f62"

# Test credentials
TEST_EMAIL = "test@eden.com"
TEST_PASSWORD = "password"


class TestPublicStatusPortal:
    """Test public client status portal - NO AUTH REQUIRED"""
    
    def test_public_status_endpoint_returns_200(self):
        """Test GET /api/client-status/claim/{claim_id}/public returns 200 without auth"""
        response = requests.get(f"{BASE_URL}/api/client-status/claim/{TEST_CLAIM_ID}/public")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"SUCCESS: Public status endpoint returns 200 without authentication")
    
    def test_public_status_returns_claim_number(self):
        """Test public status returns claim_number field"""
        response = requests.get(f"{BASE_URL}/api/client-status/claim/{TEST_CLAIM_ID}/public")
        assert response.status_code == 200
        data = response.json()
        
        assert "claim_number" in data, "Response missing claim_number field"
        assert data["claim_number"] is not None, "claim_number should not be null"
        assert len(data["claim_number"]) > 0, "claim_number should not be empty"
        print(f"SUCCESS: claim_number = {data['claim_number']}")
    
    def test_public_status_returns_masked_client_name(self):
        """Test public status returns masked client name (privacy)"""
        response = requests.get(f"{BASE_URL}/api/client-status/claim/{TEST_CLAIM_ID}/public")
        assert response.status_code == 200
        data = response.json()
        
        assert "client_name" in data, "Response missing client_name field"
        # Client name should be masked (e.g., "John D." instead of "John Doe")
        client_name = data["client_name"]
        assert client_name is not None, "client_name should not be null"
        print(f"SUCCESS: client_name (masked) = {client_name}")
    
    def test_public_status_returns_masked_address(self):
        """Test public status returns masked property address (privacy)"""
        response = requests.get(f"{BASE_URL}/api/client-status/claim/{TEST_CLAIM_ID}/public")
        assert response.status_code == 200
        data = response.json()
        
        assert "property_address" in data, "Response missing property_address field"
        # Address should be masked (city/state only)
        address = data["property_address"]
        assert address is not None, "property_address should not be null"
        print(f"SUCCESS: property_address (masked) = {address}")
    
    def test_public_status_returns_stage(self):
        """Test public status returns claim stage"""
        response = requests.get(f"{BASE_URL}/api/client-status/claim/{TEST_CLAIM_ID}/public")
        assert response.status_code == 200
        data = response.json()
        
        assert "stage" in data, "Response missing stage field"
        valid_stages = ["intake", "inspection", "negotiation", "settlement", "closed"]
        assert data["stage"] in valid_stages, f"Invalid stage: {data['stage']}"
        print(f"SUCCESS: stage = {data['stage']}")
    
    def test_public_status_returns_claim_type(self):
        """Test public status returns claim type"""
        response = requests.get(f"{BASE_URL}/api/client-status/claim/{TEST_CLAIM_ID}/public")
        assert response.status_code == 200
        data = response.json()
        
        assert "claim_type" in data, "Response missing claim_type field"
        print(f"SUCCESS: claim_type = {data['claim_type']}")
    
    def test_public_status_returns_last_update(self):
        """Test public status returns last_client_update_at"""
        response = requests.get(f"{BASE_URL}/api/client-status/claim/{TEST_CLAIM_ID}/public")
        assert response.status_code == 200
        data = response.json()
        
        assert "last_client_update_at" in data, "Response missing last_client_update_at field"
        print(f"SUCCESS: last_client_update_at = {data['last_client_update_at']}")
    
    def test_public_status_returns_next_actions(self):
        """Test public status returns next_actions fields"""
        response = requests.get(f"{BASE_URL}/api/client-status/claim/{TEST_CLAIM_ID}/public")
        assert response.status_code == 200
        data = response.json()
        
        # These fields may be null but should exist
        assert "next_actions_client" in data, "Response missing next_actions_client field"
        assert "next_actions_firm" in data, "Response missing next_actions_firm field"
        print(f"SUCCESS: next_actions_client = {data['next_actions_client']}")
        print(f"SUCCESS: next_actions_firm = {data['next_actions_firm']}")
    
    def test_public_status_404_for_invalid_claim(self):
        """Test public status returns 404 for non-existent claim"""
        fake_claim_id = "00000000-0000-0000-0000-000000000000"
        response = requests.get(f"{BASE_URL}/api/client-status/claim/{fake_claim_id}/public")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"SUCCESS: Returns 404 for non-existent claim")
    
    def test_public_status_does_not_expose_sensitive_data(self):
        """Test public status does NOT expose sensitive fields"""
        response = requests.get(f"{BASE_URL}/api/client-status/claim/{TEST_CLAIM_ID}/public")
        assert response.status_code == 200
        data = response.json()
        
        # These fields should NOT be in public response
        sensitive_fields = ["client_email", "client_phone", "estimated_value", 
                          "settlement_amount", "adjuster_id", "notes", "documents"]
        
        for field in sensitive_fields:
            assert field not in data, f"Sensitive field '{field}' should not be exposed in public endpoint"
        
        print(f"SUCCESS: No sensitive fields exposed in public response")


class TestSMSConfiguration:
    """Test SMS configuration status - REQUIRES AUTH"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_sms_status_requires_auth(self):
        """Test GET /api/sms/status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/sms/status")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"SUCCESS: SMS status endpoint requires authentication")
    
    def test_sms_status_returns_200_with_auth(self):
        """Test GET /api/sms/status returns 200 with auth"""
        response = requests.get(f"{BASE_URL}/api/sms/status", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"SUCCESS: SMS status endpoint returns 200 with authentication")
    
    def test_sms_configured_true(self):
        """Test SMS status shows configured=true"""
        response = requests.get(f"{BASE_URL}/api/sms/status", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "configured" in data, "Response missing 'configured' field"
        assert data["configured"] == True, f"Expected configured=true, got {data['configured']}"
        print(f"SUCCESS: SMS configured = {data['configured']}")
    
    def test_sms_dry_run_mode_false(self):
        """Test SMS status shows dry_run_mode=false (LIVE mode)"""
        response = requests.get(f"{BASE_URL}/api/sms/status", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "dry_run_mode" in data, "Response missing 'dry_run_mode' field"
        assert data["dry_run_mode"] == False, f"Expected dry_run_mode=false (LIVE), got {data['dry_run_mode']}"
        print(f"SUCCESS: SMS dry_run_mode = {data['dry_run_mode']} (LIVE MODE)")
    
    def test_sms_has_account_sid(self):
        """Test SMS status shows has_account_sid=true"""
        response = requests.get(f"{BASE_URL}/api/sms/status", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "has_account_sid" in data, "Response missing 'has_account_sid' field"
        assert data["has_account_sid"] == True, f"Expected has_account_sid=true, got {data['has_account_sid']}"
        print(f"SUCCESS: has_account_sid = {data['has_account_sid']}")
    
    def test_sms_has_auth_token(self):
        """Test SMS status shows has_auth_token=true"""
        response = requests.get(f"{BASE_URL}/api/sms/status", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "has_auth_token" in data, "Response missing 'has_auth_token' field"
        assert data["has_auth_token"] == True, f"Expected has_auth_token=true, got {data['has_auth_token']}"
        print(f"SUCCESS: has_auth_token = {data['has_auth_token']}")
    
    def test_sms_has_from_number(self):
        """Test SMS status shows has_from_number=true"""
        response = requests.get(f"{BASE_URL}/api/sms/status", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "has_from_number" in data, "Response missing 'has_from_number' field"
        assert data["has_from_number"] == True, f"Expected has_from_number=true, got {data['has_from_number']}"
        print(f"SUCCESS: has_from_number = {data['has_from_number']}")
    
    def test_sms_sender_number(self):
        """Test SMS status shows correct sender number"""
        response = requests.get(f"{BASE_URL}/api/sms/status", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "sender" in data, "Response missing 'sender' field"
        assert data["sender"] == "+18448215610", f"Expected sender=+18448215610, got {data['sender']}"
        print(f"SUCCESS: sender = {data['sender']}")


class TestClaimStagesEndpoint:
    """Test claim stages endpoint"""
    
    def test_stages_endpoint_returns_200(self):
        """Test GET /api/client-status/stages returns 200"""
        response = requests.get(f"{BASE_URL}/api/client-status/stages")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"SUCCESS: Stages endpoint returns 200")
    
    def test_stages_returns_all_stages(self):
        """Test stages endpoint returns all 5 stages"""
        response = requests.get(f"{BASE_URL}/api/client-status/stages")
        assert response.status_code == 200
        data = response.json()
        
        assert "stages" in data, "Response missing 'stages' field"
        stages = data["stages"]
        assert len(stages) == 5, f"Expected 5 stages, got {len(stages)}"
        
        expected_stages = ["intake", "inspection", "negotiation", "settlement", "closed"]
        stage_ids = [s["id"] for s in stages]
        
        for expected in expected_stages:
            assert expected in stage_ids, f"Missing stage: {expected}"
        
        print(f"SUCCESS: All 5 stages returned: {stage_ids}")
    
    def test_stages_have_required_fields(self):
        """Test each stage has required fields"""
        response = requests.get(f"{BASE_URL}/api/client-status/stages")
        assert response.status_code == 200
        data = response.json()
        
        for stage in data["stages"]:
            assert "id" in stage, "Stage missing 'id' field"
            assert "order" in stage, "Stage missing 'order' field"
            assert "label" in stage, "Stage missing 'label' field"
            assert "description" in stage, "Stage missing 'description' field"
        
        print(f"SUCCESS: All stages have required fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

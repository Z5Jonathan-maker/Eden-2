"""
Test Suite for SignNow 'Sign On The Spot' Feature
Tests the in-person signing flow for Eden Claims contracts

Features tested:
- POST /api/contracts/ - Create a new contract
- POST /api/contracts/{id}/sign-in-person - Create in-person signing link
- POST /api/contracts/{id}/complete-signing - Mark contract as signed
- GET /api/contracts/ - List all contracts with updated stats
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@eden.com"
TEST_PASSWORD = "password"


class TestSignOnTheSpot:
    """Test suite for Sign On The Spot in-person signing feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.created_contract_id = None
        self.claim_id = None
        
    def get_auth_token(self):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token") or data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            return self.token
        return None
    
    def get_existing_claim(self):
        """Get an existing claim to link contract to"""
        response = self.session.get(f"{BASE_URL}/api/claims/")
        if response.status_code == 200:
            claims = response.json()
            if isinstance(claims, list) and len(claims) > 0:
                return claims[0].get("id")
            elif isinstance(claims, dict) and claims.get("claims"):
                return claims["claims"][0].get("id") if claims["claims"] else None
        return None
    
    # ============================================
    # Authentication Tests
    # ============================================
    
    def test_01_login_success(self):
        """Test login with valid credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data, "No token in response"
        print(f"✓ Login successful, token received")
    
    # ============================================
    # Contract Templates Tests
    # ============================================
    
    def test_02_get_contract_templates(self):
        """Test fetching contract templates"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/contracts/templates")
        
        assert response.status_code == 200, f"Failed to get templates: {response.text}"
        data = response.json()
        assert "templates" in data, "No templates in response"
        assert len(data["templates"]) > 0, "No templates available"
        
        # Verify Care Claims template exists
        template_ids = [t["id"] for t in data["templates"]]
        assert "care-claims-pa-agreement" in template_ids, "Care Claims template not found"
        print(f"✓ Found {len(data['templates'])} templates including Care Claims PA Agreement")
    
    def test_03_get_specific_template(self):
        """Test fetching specific template details"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/contracts/templates/care-claims-pa-agreement")
        
        assert response.status_code == 200, f"Failed to get template: {response.text}"
        data = response.json()
        assert data["id"] == "care-claims-pa-agreement"
        assert "fields" in data, "No fields in template"
        assert "sections" in data, "No sections in template"
        print(f"✓ Template has {len(data['fields'])} fields and {len(data['sections'])} sections")
    
    # ============================================
    # Contract Creation Tests
    # ============================================
    
    def test_04_create_contract(self):
        """Test creating a new contract from template"""
        self.get_auth_token()
        self.claim_id = self.get_existing_claim()
        
        assert self.claim_id is not None, "No existing claim found to link contract"
        
        # Create contract with test data
        contract_data = {
            "template_id": "care-claims-pa-agreement",
            "claim_id": self.claim_id,
            "client_name": f"TEST_SignSpot_{uuid.uuid4().hex[:8]}",
            "client_email": "test.client@example.com",
            "field_values": {
                "policyholder_name": "Test Client",
                "policyholder_email": "test.client@example.com",
                "policyholder_address": "123 Test Street",
                "policyholder_city": "Tampa",
                "policyholder_state": "FL",
                "policyholder_zip": "33601",
                "policyholder_phone": "555-123-4567",
                "insurance_company": "Test Insurance Co",
                "policy_number": "POL-12345",
                "loss_address": "123 Test Street",
                "loss_city": "Tampa",
                "loss_state_zip": "FL 33601",
                "date_of_loss": "2026-01-01",
                "description_of_loss": "Water damage from pipe burst",
                "claim_type": "Non Emergency",
                "fee_percentage": 10
            }
        }
        
        response = self.session.post(f"{BASE_URL}/api/contracts/", json=contract_data)
        
        assert response.status_code == 200, f"Failed to create contract: {response.text}"
        data = response.json()
        assert "id" in data, "No contract ID in response"
        assert data.get("status") == "draft", f"Expected draft status, got {data.get('status')}"
        
        self.created_contract_id = data["id"]
        print(f"✓ Contract created with ID: {self.created_contract_id}")
        return self.created_contract_id
    
    def test_05_create_contract_without_claim_fails(self):
        """Test that creating contract without claim_id fails"""
        self.get_auth_token()
        
        contract_data = {
            "template_id": "care-claims-pa-agreement",
            "claim_id": "non-existent-claim-id",
            "client_name": "Test Client",
            "client_email": "test@example.com",
            "field_values": {}
        }
        
        response = self.session.post(f"{BASE_URL}/api/contracts/", json=contract_data)
        
        # Should fail with 400 for invalid claim
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Contract creation correctly rejected for invalid claim_id")
    
    # ============================================
    # Sign On The Spot Tests
    # ============================================
    
    def test_06_sign_in_person_creates_link(self):
        """Test that sign-in-person endpoint creates signing link"""
        self.get_auth_token()
        
        # First create a contract
        self.claim_id = self.get_existing_claim()
        contract_data = {
            "template_id": "care-claims-pa-agreement",
            "claim_id": self.claim_id,
            "client_name": f"TEST_InPerson_{uuid.uuid4().hex[:8]}",
            "client_email": "inperson.test@example.com",
            "field_values": {
                "policyholder_name": "In Person Test",
                "policyholder_email": "inperson.test@example.com",
                "policyholder_address": "456 Sign Street",
                "policyholder_city": "Miami",
                "policyholder_state": "FL",
                "policyholder_zip": "33101",
                "policyholder_phone": "555-987-6543",
                "insurance_company": "Sign Insurance",
                "policy_number": "SIGN-001",
                "loss_address": "456 Sign Street",
                "loss_city": "Miami",
                "loss_state_zip": "FL 33101",
                "date_of_loss": "2026-01-10",
                "description_of_loss": "Storm damage",
                "claim_type": "Emergency",
                "fee_percentage": 15
            }
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/contracts/", json=contract_data)
        assert create_response.status_code == 200, f"Failed to create contract: {create_response.text}"
        contract_id = create_response.json()["id"]
        
        # Now test sign-in-person
        response = self.session.post(f"{BASE_URL}/api/contracts/{contract_id}/sign-in-person", json={})
        
        assert response.status_code == 200, f"Sign in person failed: {response.text}"
        data = response.json()
        
        # Should return signing_url (mock or real)
        assert "signing_url" in data or "signing_link" in data, "No signing URL in response"
        assert "contract_id" in data, "No contract_id in response"
        assert "signer_name" in data, "No signer_name in response"
        
        # Check if mock mode (expected since SignNow not fully configured)
        if data.get("mock"):
            print(f"✓ Sign in person returned MOCK signing link: {data.get('signing_url') or data.get('signing_link')}")
        else:
            print(f"✓ Sign in person returned REAL signing link")
        
        # Verify contract status updated
        get_response = self.session.get(f"{BASE_URL}/api/contracts/{contract_id}")
        assert get_response.status_code == 200
        contract = get_response.json()
        assert contract.get("status") == "in_person_pending", f"Expected in_person_pending, got {contract.get('status')}"
        print(f"✓ Contract status updated to 'in_person_pending'")
        
        return contract_id
    
    def test_07_complete_signing_marks_signed(self):
        """Test that complete-signing endpoint marks contract as signed"""
        self.get_auth_token()
        
        # Create and start in-person signing
        self.claim_id = self.get_existing_claim()
        contract_data = {
            "template_id": "care-claims-pa-agreement",
            "claim_id": self.claim_id,
            "client_name": f"TEST_Complete_{uuid.uuid4().hex[:8]}",
            "client_email": "complete.test@example.com",
            "field_values": {
                "policyholder_name": "Complete Test",
                "policyholder_email": "complete.test@example.com",
                "policyholder_address": "789 Done Ave",
                "policyholder_city": "Orlando",
                "policyholder_state": "FL",
                "policyholder_zip": "32801",
                "policyholder_phone": "555-111-2222",
                "insurance_company": "Done Insurance",
                "policy_number": "DONE-001",
                "loss_address": "789 Done Ave",
                "loss_city": "Orlando",
                "loss_state_zip": "FL 32801",
                "date_of_loss": "2026-01-15",
                "description_of_loss": "Fire damage",
                "claim_type": "Emergency",
                "fee_percentage": 12
            }
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/contracts/", json=contract_data)
        assert create_response.status_code == 200
        contract_id = create_response.json()["id"]
        
        # Start in-person signing
        sign_response = self.session.post(f"{BASE_URL}/api/contracts/{contract_id}/sign-in-person", json={})
        assert sign_response.status_code == 200
        
        # Complete signing
        complete_response = self.session.post(f"{BASE_URL}/api/contracts/{contract_id}/complete-signing")
        
        assert complete_response.status_code == 200, f"Complete signing failed: {complete_response.text}"
        data = complete_response.json()
        assert data.get("status") == "signed", f"Expected signed status, got {data.get('status')}"
        assert "signed_at" in data, "No signed_at timestamp"
        
        # Verify contract status in database
        get_response = self.session.get(f"{BASE_URL}/api/contracts/{contract_id}")
        assert get_response.status_code == 200
        contract = get_response.json()
        assert contract.get("status") == "signed", f"Contract not marked as signed"
        assert contract.get("signed_in_person") == True, "signed_in_person flag not set"
        
        print(f"✓ Contract {contract_id} marked as signed at {data.get('signed_at')}")
    
    def test_08_sign_in_person_nonexistent_contract(self):
        """Test sign-in-person with non-existent contract returns 404"""
        self.get_auth_token()
        
        fake_id = str(uuid.uuid4())
        response = self.session.post(f"{BASE_URL}/api/contracts/{fake_id}/sign-in-person", json={})
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Sign in person correctly returns 404 for non-existent contract")
    
    def test_09_complete_signing_nonexistent_contract(self):
        """Test complete-signing with non-existent contract returns 404"""
        self.get_auth_token()
        
        fake_id = str(uuid.uuid4())
        response = self.session.post(f"{BASE_URL}/api/contracts/{fake_id}/complete-signing")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Complete signing correctly returns 404 for non-existent contract")
    
    # ============================================
    # Contract List and Stats Tests
    # ============================================
    
    def test_10_get_contracts_with_stats(self):
        """Test getting contracts list with stats"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/contracts/")
        
        assert response.status_code == 200, f"Failed to get contracts: {response.text}"
        data = response.json()
        
        assert "contracts" in data, "No contracts in response"
        assert "stats" in data, "No stats in response"
        
        stats = data["stats"]
        assert "total" in stats, "No total in stats"
        assert "signed" in stats, "No signed count in stats"
        assert "pending" in stats, "No pending count in stats"
        assert "draft" in stats, "No draft count in stats"
        
        print(f"✓ Contracts list returned {len(data['contracts'])} contracts")
        print(f"  Stats: total={stats['total']}, signed={stats['signed']}, pending={stats['pending']}, draft={stats['draft']}")
    
    def test_11_filter_contracts_by_status(self):
        """Test filtering contracts by status"""
        self.get_auth_token()
        
        # Test filtering by draft status
        response = self.session.get(f"{BASE_URL}/api/contracts/?status=draft")
        
        assert response.status_code == 200, f"Failed to filter contracts: {response.text}"
        data = response.json()
        
        # All returned contracts should be draft
        for contract in data.get("contracts", []):
            assert contract.get("status") == "draft", f"Non-draft contract in filtered results"
        
        print(f"✓ Status filter working - returned {len(data.get('contracts', []))} draft contracts")
    
    def test_12_get_single_contract(self):
        """Test getting a single contract by ID"""
        self.get_auth_token()
        
        # First get list to find a contract
        list_response = self.session.get(f"{BASE_URL}/api/contracts/")
        assert list_response.status_code == 200
        contracts = list_response.json().get("contracts", [])
        
        if len(contracts) == 0:
            pytest.skip("No contracts available to test")
        
        contract_id = contracts[0]["id"]
        
        response = self.session.get(f"{BASE_URL}/api/contracts/{contract_id}")
        
        assert response.status_code == 200, f"Failed to get contract: {response.text}"
        data = response.json()
        
        assert data["id"] == contract_id
        assert "template_name" in data
        assert "client_name" in data
        assert "status" in data
        
        print(f"✓ Retrieved contract: {data['template_name']} for {data['client_name']}")
    
    # ============================================
    # Contract Status Flow Tests
    # ============================================
    
    def test_13_full_signing_flow(self):
        """Test complete flow: create -> sign-in-person -> complete"""
        self.get_auth_token()
        self.claim_id = self.get_existing_claim()
        
        # Step 1: Create contract
        contract_data = {
            "template_id": "care-claims-pa-agreement",
            "claim_id": self.claim_id,
            "client_name": f"TEST_FullFlow_{uuid.uuid4().hex[:8]}",
            "client_email": "fullflow@example.com",
            "field_values": {
                "policyholder_name": "Full Flow Test",
                "policyholder_email": "fullflow@example.com",
                "policyholder_address": "100 Flow Lane",
                "policyholder_city": "Jacksonville",
                "policyholder_state": "FL",
                "policyholder_zip": "32099",
                "policyholder_phone": "555-333-4444",
                "insurance_company": "Flow Insurance",
                "policy_number": "FLOW-001",
                "loss_address": "100 Flow Lane",
                "loss_city": "Jacksonville",
                "loss_state_zip": "FL 32099",
                "date_of_loss": "2026-01-20",
                "description_of_loss": "Flood damage",
                "claim_type": "Emergency",
                "fee_percentage": 10
            }
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/contracts/", json=contract_data)
        assert create_response.status_code == 200
        contract_id = create_response.json()["id"]
        print(f"  Step 1: Contract created with status 'draft'")
        
        # Verify draft status
        get_response = self.session.get(f"{BASE_URL}/api/contracts/{contract_id}")
        assert get_response.json()["status"] == "draft"
        
        # Step 2: Start in-person signing
        sign_response = self.session.post(f"{BASE_URL}/api/contracts/{contract_id}/sign-in-person", json={})
        assert sign_response.status_code == 200
        print(f"  Step 2: In-person signing started, status -> 'in_person_pending'")
        
        # Verify in_person_pending status
        get_response = self.session.get(f"{BASE_URL}/api/contracts/{contract_id}")
        assert get_response.json()["status"] == "in_person_pending"
        
        # Step 3: Complete signing
        complete_response = self.session.post(f"{BASE_URL}/api/contracts/{contract_id}/complete-signing")
        assert complete_response.status_code == 200
        print(f"  Step 3: Signing completed, status -> 'signed'")
        
        # Verify signed status
        get_response = self.session.get(f"{BASE_URL}/api/contracts/{contract_id}")
        contract = get_response.json()
        assert contract["status"] == "signed"
        assert contract.get("signed_in_person") == True
        assert contract.get("signed_at") is not None
        
        print(f"✓ Full signing flow completed successfully for contract {contract_id}")
    
    # ============================================
    # Cleanup
    # ============================================
    
    def test_99_cleanup_test_contracts(self):
        """Cleanup test contracts created during testing"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/contracts/")
        if response.status_code != 200:
            return
        
        contracts = response.json().get("contracts", [])
        deleted_count = 0
        
        for contract in contracts:
            # Only delete TEST_ prefixed contracts that are not signed
            if contract.get("client_name", "").startswith("TEST_") and contract.get("status") != "signed":
                delete_response = self.session.delete(f"{BASE_URL}/api/contracts/{contract['id']}")
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"✓ Cleaned up {deleted_count} test contracts")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

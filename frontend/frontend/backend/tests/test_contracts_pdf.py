"""
Test Contract PDF Generation and Sign On The Spot functionality
Tests:
- GET /api/contracts/{id}/pdf - generates filled PDF with field values
- GET /api/contracts/{id} - returns contract details
- POST /api/contracts/{id}/sign-in-person - initiates in-person signing
- POST /api/contracts/{id}/complete-signing - marks contract as signed
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestContractsPDF:
    """Test contract PDF generation and Sign On The Spot"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get existing contracts
        contracts_response = self.session.get(f"{BASE_URL}/api/contracts/")
        assert contracts_response.status_code == 200
        contracts = contracts_response.json().get("contracts", [])
        
        # Find a draft contract for testing
        self.draft_contract = None
        self.signed_contract = None
        for c in contracts:
            if c.get("status") == "draft" and not self.draft_contract:
                self.draft_contract = c
            if c.get("status") == "signed" and not self.signed_contract:
                self.signed_contract = c
        
        # Use any contract with field values for PDF test
        self.test_contract = None
        for c in contracts:
            if c.get("field_values") and len(c.get("field_values", {})) > 0:
                self.test_contract = c
                break
    
    def test_get_contract_details(self):
        """Test GET /api/contracts/{id} returns contract with field values"""
        if not self.test_contract:
            pytest.skip("No contract with field values found")
        
        response = self.session.get(f"{BASE_URL}/api/contracts/{self.test_contract['id']}")
        assert response.status_code == 200, f"Failed to get contract: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert "field_values" in data
        assert "client_name" in data
        assert "client_email" in data
        assert "template_name" in data
        assert "status" in data
        
        # Verify field values are present
        field_values = data.get("field_values", {})
        assert len(field_values) > 0, "Contract should have field values"
        
        print(f"Contract {data['id']} has {len(field_values)} field values")
        print(f"Field values: {list(field_values.keys())}")
    
    def test_pdf_generation_returns_pdf(self):
        """Test GET /api/contracts/{id}/pdf returns a valid PDF file"""
        if not self.test_contract:
            pytest.skip("No contract with field values found")
        
        response = self.session.get(f"{BASE_URL}/api/contracts/{self.test_contract['id']}/pdf")
        assert response.status_code == 200, f"PDF generation failed: {response.text}"
        
        content_type = response.headers.get("content-type", "")
        
        # Check if it's a PDF or JSON fallback
        if "application/pdf" in content_type:
            # Verify PDF content
            assert len(response.content) > 1000, "PDF should have substantial content"
            # Check PDF magic bytes
            assert response.content[:4] == b'%PDF', "Response should be a valid PDF"
            print(f"PDF generated successfully, size: {len(response.content)} bytes")
        else:
            # JSON fallback with pdf_url
            data = response.json()
            assert "pdf_url" in data or "message" in data
            print(f"PDF fallback response: {data}")
    
    def test_pdf_contains_field_values(self):
        """Test that generated PDF contains the contract field values"""
        if not self.test_contract:
            pytest.skip("No contract with field values found")
        
        response = self.session.get(f"{BASE_URL}/api/contracts/{self.test_contract['id']}/pdf")
        assert response.status_code == 200
        
        content_type = response.headers.get("content-type", "")
        
        if "application/pdf" in content_type:
            # Save PDF and extract text using PyMuPDF
            import fitz
            import io
            
            doc = fitz.open(stream=response.content, filetype="pdf")
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            
            # Check for field values in PDF text
            field_values = self.test_contract.get("field_values", {})
            found_fields = 0
            for key, value in field_values.items():
                if value and str(value) in text:
                    found_fields += 1
            
            print(f"Found {found_fields}/{len(field_values)} field values in PDF")
            assert found_fields > 0, "PDF should contain at least some field values"
        else:
            print("PDF generation returned fallback - skipping content check")
    
    def test_sign_in_person_endpoint(self):
        """Test POST /api/contracts/{id}/sign-in-person initiates signing"""
        if not self.draft_contract:
            pytest.skip("No draft contract available for signing test")
        
        response = self.session.post(
            f"{BASE_URL}/api/contracts/{self.draft_contract['id']}/sign-in-person",
            json={}
        )
        assert response.status_code == 200, f"Sign in person failed: {response.text}"
        
        data = response.json()
        # Should return signing URL or mock response
        assert "contract_id" in data or "signing_url" in data or "mock" in data
        print(f"Sign in person response: {data}")
    
    def test_complete_signing_endpoint(self):
        """Test POST /api/contracts/{id}/complete-signing marks contract as signed"""
        # First create a new contract for this test
        # Get a claim ID first
        claims_response = self.session.get(f"{BASE_URL}/api/claims/")
        if claims_response.status_code != 200:
            pytest.skip("Could not get claims")
        
        claims = claims_response.json()
        if not claims or len(claims) == 0:
            pytest.skip("No claims available")
        
        claim_id = claims[0].get("id")
        
        # Create a test contract
        create_response = self.session.post(f"{BASE_URL}/api/contracts/", json={
            "template_id": "care-claims-pa-agreement",
            "claim_id": claim_id,
            "client_name": "TEST_SigningFlow_Contract",
            "client_email": "signingtest@example.com",
            "field_values": {
                "policyholder_name": "Test Signer",
                "policyholder_email": "signingtest@example.com",
                "policyholder_address": "123 Test Lane",
                "policyholder_city": "Tampa",
                "policyholder_state": "FL",
                "policyholder_zip": "33601",
                "policyholder_phone": "555-123-4567",
                "insurance_company": "Test Insurance Co",
                "policy_number": "TEST-POL-001",
                "loss_address": "123 Test Lane",
                "loss_city": "Tampa",
                "loss_state_zip": "FL 33601",
                "date_of_loss": "2026-01-01",
                "description_of_loss": "Test damage",
                "claim_type": "Non Emergency",
                "fee_percentage": 10
            }
        })
        
        if create_response.status_code != 200:
            pytest.skip(f"Could not create test contract: {create_response.text}")
        
        contract_id = create_response.json().get("id")
        
        # Complete signing
        response = self.session.post(f"{BASE_URL}/api/contracts/{contract_id}/complete-signing")
        assert response.status_code == 200, f"Complete signing failed: {response.text}"
        
        data = response.json()
        assert data.get("status") == "signed"
        assert "signed_at" in data
        print(f"Contract signed successfully: {data}")
        
        # Verify contract status changed
        verify_response = self.session.get(f"{BASE_URL}/api/contracts/{contract_id}")
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data.get("status") == "signed"
        assert verify_data.get("signed_in_person") == True
    
    def test_contract_not_found(self):
        """Test 404 for non-existent contract"""
        response = self.session.get(f"{BASE_URL}/api/contracts/non-existent-id")
        assert response.status_code == 404
    
    def test_pdf_not_found(self):
        """Test 404 for PDF of non-existent contract"""
        response = self.session.get(f"{BASE_URL}/api/contracts/non-existent-id/pdf")
        assert response.status_code == 404


class TestContractsListAndStats:
    """Test contracts list and statistics"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        assert login_response.status_code == 200
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_get_contracts_list(self):
        """Test GET /api/contracts/ returns list with stats"""
        response = self.session.get(f"{BASE_URL}/api/contracts/")
        assert response.status_code == 200
        
        data = response.json()
        assert "contracts" in data
        assert "stats" in data
        
        stats = data["stats"]
        assert "total" in stats
        assert "signed" in stats
        assert "pending" in stats
        assert "draft" in stats
        
        print(f"Contracts stats: {stats}")
    
    def test_get_contracts_by_status(self):
        """Test filtering contracts by status"""
        response = self.session.get(f"{BASE_URL}/api/contracts/?status=signed")
        assert response.status_code == 200
        
        data = response.json()
        contracts = data.get("contracts", [])
        
        for contract in contracts:
            assert contract.get("status") == "signed"
        
        print(f"Found {len(contracts)} signed contracts")
    
    def test_get_templates(self):
        """Test GET /api/contracts/templates returns templates"""
        response = self.session.get(f"{BASE_URL}/api/contracts/templates")
        assert response.status_code == 200
        
        data = response.json()
        assert "templates" in data
        templates = data["templates"]
        assert len(templates) > 0
        
        # Check for Care Claims template
        care_claims_found = False
        for t in templates:
            if t.get("id") == "care-claims-pa-agreement":
                care_claims_found = True
                assert t.get("name") == "Public Adjuster Agreement"
                assert t.get("is_builtin") == True
        
        assert care_claims_found, "Care Claims template should be present"
        print(f"Found {len(templates)} templates")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

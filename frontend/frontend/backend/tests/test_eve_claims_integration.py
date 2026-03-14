"""
Test Eve AI Claims Integration
Tests for:
- GET /api/ai/claims-for-context - returns list of claims for selector
- GET /api/ai/claim-context/{claim_id} - returns full claim context
- POST /api/ai/chat - auto-detects claim references like #TEST-12345
- POST /api/ai/chat with claim_id - provides claim-specific responses
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEveClaimsIntegration:
    """Test Eve AI Claims Integration endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("access_token")
        assert token, "No access token returned"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.token = token
    
    def test_get_claims_for_context_returns_list(self):
        """GET /api/ai/claims-for-context returns list of claims"""
        response = self.session.get(f"{BASE_URL}/api/ai/claims-for-context")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "claims" in data, "Response should contain 'claims' key"
        assert isinstance(data["claims"], list), "Claims should be a list"
        
        # Verify claim structure if claims exist
        if len(data["claims"]) > 0:
            claim = data["claims"][0]
            assert "id" in claim, "Claim should have 'id'"
            assert "claim_number" in claim, "Claim should have 'claim_number'"
            assert "client_name" in claim, "Claim should have 'client_name'"
            assert "status" in claim, "Claim should have 'status'"
    
    def test_get_claims_for_context_with_search(self):
        """GET /api/ai/claims-for-context with search parameter filters results"""
        response = self.session.get(f"{BASE_URL}/api/ai/claims-for-context?search=TEST")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "claims" in data, "Response should contain 'claims' key"
        
        # All returned claims should match search term
        for claim in data["claims"]:
            matches_search = (
                "TEST" in claim.get("claim_number", "").upper() or
                "TEST" in claim.get("client_name", "").upper() or
                "TEST" in claim.get("property_address", "").upper()
            )
            assert matches_search, f"Claim {claim.get('claim_number')} doesn't match search 'TEST'"
    
    def test_get_claim_context_by_id(self):
        """GET /api/ai/claim-context/{claim_id} returns full claim context"""
        # First get a claim ID
        claims_response = self.session.get(f"{BASE_URL}/api/ai/claims-for-context?limit=1")
        assert claims_response.status_code == 200
        
        claims = claims_response.json().get("claims", [])
        if not claims:
            pytest.skip("No claims available for testing")
        
        claim_id = claims[0]["id"]
        
        # Get claim context
        response = self.session.get(f"{BASE_URL}/api/ai/claim-context/{claim_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify full context structure
        assert "claim_id" in data, "Context should have 'claim_id'"
        assert "claim_number" in data, "Context should have 'claim_number'"
        assert "status" in data, "Context should have 'status'"
        assert "client_name" in data, "Context should have 'client_name'"
        assert "property_address" in data, "Context should have 'property_address'"
        assert "notes_count" in data, "Context should have 'notes_count'"
        assert "documents_count" in data, "Context should have 'documents_count'"
        assert "recent_notes" in data, "Context should have 'recent_notes'"
        assert "documents_summary" in data, "Context should have 'documents_summary'"
        assert "recent_communications" in data, "Context should have 'recent_communications'"
    
    def test_get_claim_context_by_claim_number(self):
        """GET /api/ai/claim-context/{claim_number} also works"""
        # First get a claim number
        claims_response = self.session.get(f"{BASE_URL}/api/ai/claims-for-context?limit=1")
        assert claims_response.status_code == 200
        
        claims = claims_response.json().get("claims", [])
        if not claims:
            pytest.skip("No claims available for testing")
        
        claim_number = claims[0]["claim_number"]
        
        # Get claim context by claim_number
        response = self.session.get(f"{BASE_URL}/api/ai/claim-context/{claim_number}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["claim_number"] == claim_number, "Returned claim should match requested claim_number"
    
    def test_get_claim_context_not_found(self):
        """GET /api/ai/claim-context/{invalid_id} returns 404"""
        response = self.session.get(f"{BASE_URL}/api/ai/claim-context/nonexistent-claim-id-12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
    
    def test_chat_auto_detects_claim_reference_hashtag(self):
        """POST /api/ai/chat auto-detects claim references like #claim-number"""
        # First get a claim number
        claims_response = self.session.get(f"{BASE_URL}/api/ai/claims-for-context?limit=1")
        assert claims_response.status_code == 200
        
        claims = claims_response.json().get("claims", [])
        if not claims:
            pytest.skip("No claims available for testing")
        
        claim_number = claims[0]["claim_number"]
        
        # Send chat message with claim reference
        response = self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "message": f"What is the status of claim #{claim_number}?"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "response" in data, "Response should have 'response'"
        assert "session_id" in data, "Response should have 'session_id'"
        assert "claim_context" in data, "Response should have 'claim_context' when claim is detected"
        
        # Verify claim context was detected
        assert data["claim_context"] is not None, "claim_context should not be None"
        assert data["claim_context"]["claim_number"] == claim_number, "Detected claim should match referenced claim"
        
        # Verify Eve's response references claim details
        response_text = data["response"].lower()
        assert claim_number.lower() in response_text or "claim" in response_text, "Eve should reference the claim in response"
    
    def test_chat_with_direct_claim_id(self):
        """POST /api/ai/chat with claim_id provides claim-specific responses"""
        # First get a claim
        claims_response = self.session.get(f"{BASE_URL}/api/ai/claims-for-context?limit=1")
        assert claims_response.status_code == 200
        
        claims = claims_response.json().get("claims", [])
        if not claims:
            pytest.skip("No claims available for testing")
        
        claim_id = claims[0]["id"]
        claim_number = claims[0]["claim_number"]
        
        # Send chat message with claim_id
        response = self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "What should I do next for this claim?",
            "claim_id": claim_id
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify claim context is returned
        assert data["claim_context"] is not None, "claim_context should be returned"
        assert data["claim_context"]["claim_id"] == claim_id, "claim_id should match"
        
        # Verify Eve's response is claim-specific
        response_text = data["response"]
        assert len(response_text) > 50, "Eve should provide a substantive response"
    
    def test_chat_without_claim_reference(self):
        """POST /api/ai/chat without claim reference works normally"""
        response = self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "What are the Florida public adjuster fee limits?"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        assert "response" in data, "Response should have 'response'"
        assert "session_id" in data, "Response should have 'session_id'"
        
        # Response should mention fee limits
        response_text = data["response"].lower()
        assert "10%" in response_text or "fee" in response_text or "percent" in response_text, \
            "Eve should answer about fee limits"
    
    def test_chat_claim_context_includes_all_fields(self):
        """Verify claim_context in chat response includes all expected fields"""
        # First get a claim
        claims_response = self.session.get(f"{BASE_URL}/api/ai/claims-for-context?limit=1")
        assert claims_response.status_code == 200
        
        claims = claims_response.json().get("claims", [])
        if not claims:
            pytest.skip("No claims available for testing")
        
        claim_id = claims[0]["id"]
        
        # Send chat with claim_id
        response = self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "Tell me about this claim",
            "claim_id": claim_id
        })
        
        assert response.status_code == 200
        
        context = response.json().get("claim_context")
        assert context is not None
        
        # Verify all expected fields
        expected_fields = [
            "claim_id", "claim_number", "status", "type", "client_name",
            "property_address", "carrier", "policy_number",
            "notes_count", "documents_count", "recent_notes",
            "documents_summary", "recent_communications"
        ]
        
        for field in expected_fields:
            assert field in context, f"claim_context should have '{field}'"
    
    def test_claims_for_context_requires_auth(self):
        """GET /api/ai/claims-for-context requires authentication"""
        # Create new session without auth
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/ai/claims-for-context")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_claim_context_requires_auth(self):
        """GET /api/ai/claim-context/{id} requires authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/ai/claim-context/some-id")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_chat_requires_auth(self):
        """POST /api/ai/chat requires authentication"""
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        response = no_auth_session.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "Hello"
        })
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

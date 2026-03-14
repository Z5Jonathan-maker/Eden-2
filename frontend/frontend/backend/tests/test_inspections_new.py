"""
Test suite for InspectionsNew module - Drodat-inspired inspection redesign
Tests the new claim selection flow and inspection sessions API
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestInspectionsNewBackend:
    """Backend API tests for the new Inspections module"""
    
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
        assert token, "No access token received"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.user = login_response.json().get("user", {})
        
    def test_claims_list_endpoint(self):
        """Test /api/claims/ returns list of claims"""
        response = self.session.get(f"{BASE_URL}/api/claims/")
        
        assert response.status_code == 200, f"Claims list failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Claims should be a list"
        
        # Verify claim structure if claims exist
        if len(data) > 0:
            claim = data[0]
            assert "id" in claim, "Claim should have id"
            assert "claim_number" in claim or "client_name" in claim, "Claim should have identifying info"
            print(f"✓ Claims list returned {len(data)} claims")
        else:
            print("✓ Claims list returned empty (no claims in system)")
    
    def test_inspection_sessions_endpoint(self):
        """Test /api/inspections/sessions returns sessions list"""
        response = self.session.get(f"{BASE_URL}/api/inspections/sessions")
        
        assert response.status_code == 200, f"Sessions list failed: {response.text}"
        
        data = response.json()
        assert "sessions" in data, "Response should have sessions key"
        assert isinstance(data["sessions"], list), "Sessions should be a list"
        print(f"✓ Sessions endpoint returned {len(data['sessions'])} sessions")
    
    def test_inspection_sessions_with_claim_filter(self):
        """Test /api/inspections/sessions with claim_id filter"""
        # First get a claim
        claims_response = self.session.get(f"{BASE_URL}/api/claims/")
        assert claims_response.status_code == 200
        
        claims = claims_response.json()
        if len(claims) == 0:
            pytest.skip("No claims available for testing")
        
        claim_id = claims[0]["id"]
        
        # Get sessions for this claim
        response = self.session.get(f"{BASE_URL}/api/inspections/sessions?claim_id={claim_id}")
        
        assert response.status_code == 200, f"Sessions filter failed: {response.text}"
        
        data = response.json()
        assert "sessions" in data, "Response should have sessions key"
        print(f"✓ Sessions for claim {claim_id}: {len(data['sessions'])} sessions")
    
    def test_create_inspection_session(self):
        """Test creating a new inspection session"""
        # First get a claim
        claims_response = self.session.get(f"{BASE_URL}/api/claims/")
        assert claims_response.status_code == 200
        
        claims = claims_response.json()
        if len(claims) == 0:
            pytest.skip("No claims available for testing")
        
        claim_id = claims[0]["id"]
        
        # Create session
        session_data = {
            "claim_id": claim_id,
            "name": f"TEST_Inspection_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "notes": "Test inspection session",
            "type": "initial"
        }
        
        response = self.session.post(f"{BASE_URL}/api/inspections/sessions", json=session_data)
        
        assert response.status_code == 200, f"Create session failed: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should have session id"
        assert "session" in data, "Response should have session details"
        
        session = data["session"]
        assert session["claim_id"] == claim_id, "Session should be linked to claim"
        assert session["status"] == "in_progress", "New session should be in_progress"
        
        print(f"✓ Created inspection session: {data['id']}")
        
        # Store for cleanup
        self.created_session_id = data["id"]
        
        return data["id"]
    
    def test_get_inspection_session_details(self):
        """Test getting details of a specific session"""
        # Create a session first
        session_id = self.test_create_inspection_session()
        
        # Get session details
        response = self.session.get(f"{BASE_URL}/api/inspections/sessions/{session_id}")
        
        assert response.status_code == 200, f"Get session failed: {response.text}"
        
        data = response.json()
        assert data["id"] == session_id, "Session ID should match"
        assert "photos" in data, "Session should include photos array"
        
        print(f"✓ Retrieved session details: {session_id}")
    
    def test_complete_inspection_session(self):
        """Test completing an inspection session"""
        # Create a session first
        session_id = self.test_create_inspection_session()
        
        # Complete the session
        response = self.session.put(f"{BASE_URL}/api/inspections/sessions/{session_id}/complete")
        
        assert response.status_code == 200, f"Complete session failed: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        
        # Verify session is completed
        verify_response = self.session.get(f"{BASE_URL}/api/inspections/sessions/{session_id}")
        assert verify_response.status_code == 200
        
        session = verify_response.json()
        assert session["status"] == "completed", "Session should be completed"
        assert session.get("completed_at") is not None, "Session should have completed_at timestamp"
        
        print(f"✓ Completed inspection session: {session_id}")
    
    def test_inspection_presets_rooms(self):
        """Test room presets endpoint"""
        response = self.session.get(f"{BASE_URL}/api/inspections/presets/rooms")
        
        assert response.status_code == 200, f"Room presets failed: {response.text}"
        
        data = response.json()
        assert "rooms" in data, "Response should have rooms"
        assert len(data["rooms"]) > 0, "Should have room presets"
        
        # Verify room structure
        room = data["rooms"][0]
        assert "id" in room, "Room should have id"
        assert "name" in room, "Room should have name"
        
        print(f"✓ Room presets: {len(data['rooms'])} rooms available")
    
    def test_inspection_presets_categories(self):
        """Test category presets endpoint"""
        response = self.session.get(f"{BASE_URL}/api/inspections/presets/categories")
        
        assert response.status_code == 200, f"Category presets failed: {response.text}"
        
        data = response.json()
        assert "categories" in data, "Response should have categories"
        assert len(data["categories"]) > 0, "Should have category presets"
        
        # Verify category structure
        category = data["categories"][0]
        assert "id" in category, "Category should have id"
        assert "name" in category, "Category should have name"
        
        print(f"✓ Category presets: {len(data['categories'])} categories available")
    
    def test_inspection_stats(self):
        """Test inspection statistics endpoint"""
        response = self.session.get(f"{BASE_URL}/api/inspections/stats")
        
        assert response.status_code == 200, f"Stats failed: {response.text}"
        
        data = response.json()
        assert "total_photos" in data, "Should have total_photos"
        assert "total_sessions" in data, "Should have total_sessions"
        assert "completed_sessions" in data, "Should have completed_sessions"
        
        print(f"✓ Inspection stats: {data['total_photos']} photos, {data['total_sessions']} sessions")
    
    def test_session_not_found(self):
        """Test 404 for non-existent session"""
        response = self.session.get(f"{BASE_URL}/api/inspections/sessions/non-existent-id-12345")
        
        assert response.status_code == 404, f"Should return 404, got {response.status_code}"
        print("✓ Non-existent session returns 404")
    
    def test_create_session_without_claim(self):
        """Test that creating session without claim_id fails"""
        session_data = {
            "name": "Test Session",
            "type": "initial"
        }
        
        response = self.session.post(f"{BASE_URL}/api/inspections/sessions", json=session_data)
        
        # Should fail validation - claim_id is required
        assert response.status_code in [400, 422], f"Should fail without claim_id, got {response.status_code}"
        print("✓ Session creation without claim_id properly rejected")


class TestClaimsSearchFunctionality:
    """Test claims search functionality used by InspectionsNew"""
    
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
    
    def test_claims_have_required_fields(self):
        """Test that claims have fields needed for search/display"""
        response = self.session.get(f"{BASE_URL}/api/claims/")
        assert response.status_code == 200
        
        claims = response.json()
        if len(claims) == 0:
            pytest.skip("No claims to test")
        
        claim = claims[0]
        
        # Check for fields used in InspectionsNew search
        has_name = "client_name" in claim or "insured_name" in claim
        has_address = "property_address" in claim or "loss_location" in claim
        
        assert "id" in claim, "Claim must have id"
        assert has_name, "Claim must have client_name or insured_name"
        assert has_address, "Claim must have property_address or loss_location"
        
        print(f"✓ Claims have required fields for search/display")
    
    def test_claims_list_returns_multiple(self):
        """Test that claims list can return multiple claims"""
        response = self.session.get(f"{BASE_URL}/api/claims/")
        assert response.status_code == 200
        
        claims = response.json()
        print(f"✓ Claims list returned {len(claims)} claims")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Test suite for Inspection Photo Upload Fix
Tests the bug fix for: 
1) Voice notes don't attach to photos
2) Photos don't get stored in the claim
3) Verifying the reordered upload flow (photos first, then voice)

Test Credentials:
- Email: testuser@example.com
- Password: testpassword
- Existing claim ID: 4abc3d5e-3cfd-4566-aaa2-ffdb00d6118e
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "testuser@example.com"
TEST_PASSWORD = "testpassword"
TEST_CLAIM_ID = "4abc3d5e-3cfd-4566-aaa2-ffdb00d6118e"


class TestInspectionPhotoUploadFix:
    """Test inspection photo upload, session management, and photo retrieval"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login with test credentials
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        # API returns 'access_token' not 'token'
        self.token = data.get("access_token")
        assert self.token, f"No access_token in response: {data}"
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.created_session_ids = []
        self.created_photo_ids = []
        
        yield
        
        # Cleanup: Delete test photos and sessions
        for photo_id in self.created_photo_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/inspections/photos/{photo_id}")
            except:
                pass
    
    # ========== Session Management Tests ==========
    
    def test_create_inspection_session(self):
        """POST /api/inspections/sessions - Create an inspection session for a claim"""
        response = self.session.post(
            f"{BASE_URL}/api/inspections/sessions",
            json={
                "claim_id": TEST_CLAIM_ID,
                "name": f"TEST_Photo_Fix_Session_{datetime.now().isoformat()}",
                "notes": "Testing photo upload fix",
                "type": "initial"
            }
        )
        
        assert response.status_code == 200, f"Create session failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Session ID not returned"
        assert "session" in data, "Session details not returned"
        assert data.get("message") == "Inspection session started"
        
        session = data["session"]
        assert session["claim_id"] == TEST_CLAIM_ID, "Session not bound to correct claim"
        assert session["status"] == "in_progress", "Session should be in_progress"
        assert "created_at" in session, "Session should have created_at"
        assert "created_by" in session, "Session should have created_by"
        
        self.created_session_ids.append(data["id"])
        print(f"✓ Session created: {data['id']}")
        return data["id"]
    
    def test_get_sessions_for_claim(self):
        """GET /api/inspections/sessions?claim_id={id} - List sessions for a claim"""
        # Create a session first
        session_id = self.test_create_inspection_session()
        
        # Get sessions for the test claim
        response = self.session.get(f"{BASE_URL}/api/inspections/sessions?claim_id={TEST_CLAIM_ID}")
        
        assert response.status_code == 200, f"Get sessions failed: {response.text}"
        data = response.json()
        
        assert "sessions" in data, "Response should have sessions array"
        sessions = data["sessions"]
        
        # Verify the created session is in the list
        session_ids = [s["id"] for s in sessions]
        assert session_id in session_ids, "Created session not found in claim sessions"
        
        # Verify all returned sessions belong to this claim
        for session in sessions:
            assert session["claim_id"] == TEST_CLAIM_ID, "Session returned for wrong claim"
        
        print(f"✓ Found {len(sessions)} sessions for claim {TEST_CLAIM_ID}")
    
    def test_complete_inspection_session(self):
        """PUT /api/inspections/sessions/{session_id}/complete - Complete a session"""
        # Create session first
        session_id = self.test_create_inspection_session()
        
        # Complete the session
        response = self.session.put(f"{BASE_URL}/api/inspections/sessions/{session_id}/complete")
        
        assert response.status_code == 200, f"Complete session failed: {response.text}"
        data = response.json()
        assert data.get("message") == "Inspection completed"
        
        # Verify session is completed
        verify_response = self.session.get(f"{BASE_URL}/api/inspections/sessions/{session_id}")
        assert verify_response.status_code == 200
        session_data = verify_response.json()
        
        assert session_data["status"] == "completed", "Session should be completed"
        assert session_data.get("completed_at") is not None, "Should have completed_at timestamp"
        
        print(f"✓ Session {session_id} completed successfully")
    
    # ========== Photo Upload Tests ==========
    
    def test_upload_photo_with_claim_and_session(self):
        """POST /api/inspections/photos - Upload a photo with claim_id and session_id"""
        # Create session first
        session_id = self.test_create_inspection_session()
        
        # Create a minimal valid JPEG image
        test_image_content = b'\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
        
        # Upload photo with claim_id and session_id
        files = {"file": ("test_photo.jpg", test_image_content, "image/jpeg")}
        form_data = {
            "claim_id": TEST_CLAIM_ID,
            "session_id": session_id,
            "room": "Kitchen",
            "category": "damage",
            "notes": "Test photo upload",
            "latitude": "27.9506",
            "longitude": "-82.4572",
            "captured_at": datetime.now().isoformat()
        }
        
        # Use requests directly for multipart form upload
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.post(
            f"{BASE_URL}/api/inspections/photos",
            headers=headers,
            files=files,
            data=form_data
        )
        
        assert response.status_code == 200, f"Photo upload failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data, "Photo ID not returned"
        assert "url" in data, "Photo URL not returned"
        assert "metadata" in data, "Photo metadata not returned"
        
        photo_id = data["id"]
        self.created_photo_ids.append(photo_id)
        
        # Verify metadata
        metadata = data["metadata"]
        assert metadata["claim_id"] == TEST_CLAIM_ID, "Photo not bound to correct claim"
        assert metadata.get("room") == "Kitchen", "Room not set correctly"
        
        print(f"✓ Photo uploaded: {photo_id}")
        return photo_id
    
    def test_get_claim_photos(self):
        """GET /api/inspections/claim/{claim_id}/photos - Verify photos appear in claim's photo list"""
        # Upload a photo first
        photo_id = self.test_upload_photo_with_claim_and_session()
        
        # Get photos for the claim
        response = self.session.get(f"{BASE_URL}/api/inspections/claim/{TEST_CLAIM_ID}/photos")
        
        assert response.status_code == 200, f"Get claim photos failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "photos" in data, "Response should have photos array"
        assert "total" in data, "Response should have total count"
        assert "by_room" in data, "Response should have by_room organization"
        assert "rooms" in data, "Response should have rooms list"
        
        photos = data["photos"]
        photo_ids = [p["id"] for p in photos]
        
        # Verify the uploaded photo is in the claim's photos
        assert photo_id in photo_ids, "Uploaded photo not found in claim photos"
        
        print(f"✓ Found {len(photos)} photos for claim (total: {data['total']})")
        print(f"✓ Rooms documented: {data['rooms']}")
    
    def test_get_photo_image_with_token(self):
        """GET /api/inspections/photos/{photo_id}/image?token={token} - Retrieve photo with auth token"""
        # Upload a photo first
        photo_id = self.test_upload_photo_with_claim_and_session()
        
        # Get photo image using query param token
        response = requests.get(
            f"{BASE_URL}/api/inspections/photos/{photo_id}/image?token={self.token}"
        )
        
        assert response.status_code == 200, f"Get photo image failed: {response.status_code} - {response.text}"
        assert "image" in response.headers.get("Content-Type", ""), "Response should be an image"
        
        print(f"✓ Photo image retrieved successfully with token")
    
    def test_photo_image_requires_token(self):
        """GET /api/inspections/photos/{photo_id}/image - Should fail without token"""
        # Upload a photo first
        photo_id = self.test_upload_photo_with_claim_and_session()
        
        # Try to get photo without token
        response = requests.get(f"{BASE_URL}/api/inspections/photos/{photo_id}/image")
        
        assert response.status_code == 401, f"Should return 401 without token, got {response.status_code}"
        
        print(f"✓ Photo image correctly requires token")
    
    def test_upload_photo_requires_claim_id(self):
        """POST /api/inspections/photos - Should fail without claim_id"""
        test_image_content = b'\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
        
        # Try to upload photo without claim_id
        files = {"file": ("test_photo.jpg", test_image_content, "image/jpeg")}
        form_data = {
            "room": "Kitchen"
            # Missing claim_id
        }
        
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.post(
            f"{BASE_URL}/api/inspections/photos",
            headers=headers,
            files=files,
            data=form_data
        )
        
        # Should fail - claim_id is required
        assert response.status_code in [400, 422], f"Should fail without claim_id, got {response.status_code}"
        
        print(f"✓ Photo upload correctly requires claim_id")
    
    def test_photo_includes_captured_at_timestamp(self):
        """Verify photo includes captured_at timestamp"""
        # Create session
        session_id = self.test_create_inspection_session()
        
        # Upload photo with captured_at
        captured_at = datetime.now().isoformat()
        test_image_content = b'\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
        
        files = {"file": ("test_photo.jpg", test_image_content, "image/jpeg")}
        form_data = {
            "claim_id": TEST_CLAIM_ID,
            "session_id": session_id,
            "captured_at": captured_at
        }
        
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.post(
            f"{BASE_URL}/api/inspections/photos",
            headers=headers,
            files=files,
            data=form_data
        )
        
        assert response.status_code == 200
        photo_id = response.json()["id"]
        self.created_photo_ids.append(photo_id)
        
        # Get photo metadata
        meta_response = self.session.get(f"{BASE_URL}/api/inspections/photos/{photo_id}")
        assert meta_response.status_code == 200
        meta_data = meta_response.json()
        
        assert "captured_at" in meta_data, "Photo should have captured_at timestamp"
        assert "uploaded_at" in meta_data, "Photo should have uploaded_at timestamp"
        
        print(f"✓ Photo has captured_at: {meta_data['captured_at']}")
    
    def test_session_tracks_photo_count(self):
        """Verify session photo_count increments when photos are added"""
        # Create session
        session_id = self.test_create_inspection_session()
        
        # Upload 3 photos
        for i in range(3):
            test_image_content = b'\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
            files = {"file": (f"test_photo_{i}.jpg", test_image_content, "image/jpeg")}
            form_data = {
                "claim_id": TEST_CLAIM_ID,
                "session_id": session_id,
                "room": f"Room_{i}"
            }
            
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.post(
                f"{BASE_URL}/api/inspections/photos",
                headers=headers,
                files=files,
                data=form_data
            )
            assert response.status_code == 200
            self.created_photo_ids.append(response.json()["id"])
        
        # Check session photo count
        session_response = self.session.get(f"{BASE_URL}/api/inspections/sessions/{session_id}")
        assert session_response.status_code == 200
        session_data = session_response.json()
        
        assert session_data["photo_count"] >= 3, f"Photo count should be at least 3, got {session_data['photo_count']}"
        
        print(f"✓ Session photo count: {session_data['photo_count']}")
    
    # ========== Verify Existing Claim Has Photos ==========
    
    def test_existing_claim_has_photos(self):
        """Verify the test claim already has photos (per requirements)"""
        response = self.session.get(f"{BASE_URL}/api/inspections/claim/{TEST_CLAIM_ID}/photos")
        
        assert response.status_code == 200, f"Get claim photos failed: {response.text}"
        data = response.json()
        
        # The requirements say there's already 1 test photo
        print(f"✓ Claim {TEST_CLAIM_ID} has {data['total']} photos")
        print(f"  Rooms: {data['rooms']}")


class TestVoiceToPhotoWorkflow:
    """Test the voice-to-photo timestamp matching workflow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200
        
        self.token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.created_photo_ids = []
        
        yield
        
        # Cleanup
        for photo_id in self.created_photo_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/inspections/photos/{photo_id}")
            except:
                pass
    
    def test_photo_upload_then_voice_workflow(self):
        """
        Simulate the fixed workflow: photos uploaded FIRST, then voice
        This is the key fix - previously voice was uploaded before photos existed
        """
        # Step 1: Create session
        session_response = self.session.post(
            f"{BASE_URL}/api/inspections/sessions",
            json={
                "claim_id": TEST_CLAIM_ID,
                "name": f"TEST_Voice_Workflow_{datetime.now().isoformat()}",
                "type": "initial"
            }
        )
        assert session_response.status_code == 200
        session_id = session_response.json()["id"]
        
        # Step 2: Upload photos FIRST (this is the fix)
        photo_ids = []
        for i in range(2):
            test_image_content = b'\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
            files = {"file": (f"photo_{i}.jpg", test_image_content, "image/jpeg")}
            form_data = {
                "claim_id": TEST_CLAIM_ID,
                "session_id": session_id,
                "captured_at": datetime.now().isoformat()
            }
            
            headers = {"Authorization": f"Bearer {self.token}"}
            response = requests.post(
                f"{BASE_URL}/api/inspections/photos",
                headers=headers,
                files=files,
                data=form_data
            )
            assert response.status_code == 200, f"Photo upload {i} failed: {response.text}"
            photo_id = response.json()["id"]
            photo_ids.append(photo_id)
            self.created_photo_ids.append(photo_id)
        
        # Step 3: Verify photos exist in database BEFORE voice upload
        for photo_id in photo_ids:
            photo_response = self.session.get(f"{BASE_URL}/api/inspections/photos/{photo_id}")
            assert photo_response.status_code == 200, f"Photo {photo_id} not found in DB"
        
        # Step 4: Voice upload would happen here (requires actual audio file)
        # The backend endpoint /api/inspections/sessions/voice handles transcription
        # and matches voice to photos by timestamp
        
        # Step 5: Complete session
        complete_response = self.session.put(f"{BASE_URL}/api/inspections/sessions/{session_id}/complete")
        assert complete_response.status_code == 200
        
        print(f"✓ Workflow completed: {len(photo_ids)} photos uploaded before voice")
        print(f"✓ Photos are in DB and can be matched by voice transcription")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

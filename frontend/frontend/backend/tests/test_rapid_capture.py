"""
Test suite for EDEN Rapid Capture Field-Critical Fixes
Tests inspection sessions and photo upload APIs

FIX 1: Claim required before capture
FIX 2: Inspection sessions with claim_id, inspector_id, started_at
FIX 3: Camera only on user tap (frontend - not testable via API)
FIX 4: Photos go to Claim Gallery via inspection session
FIX 5: Claim context during capture (frontend - not testable via API)
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRapidCaptureAPIs:
    """Test inspection sessions and photo upload APIs for Rapid Capture"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@eden.com", "password": "password"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get a test claim
        claims_response = self.session.get(f"{BASE_URL}/api/claims/")
        assert claims_response.status_code == 200
        claims = claims_response.json()
        assert len(claims) > 0, "No claims found for testing"
        self.test_claim = claims[0]
        self.claim_id = self.test_claim["id"]
        
        yield
        
        # Cleanup: Delete test sessions created during tests
        # (Sessions are cleaned up by test methods)
    
    # ========== FIX 2: Inspection Session Tests ==========
    
    def test_create_inspection_session_with_claim(self):
        """FIX 2: Create inspection session requires claim_id"""
        response = self.session.post(
            f"{BASE_URL}/api/inspections/sessions",
            json={
                "claim_id": self.claim_id,
                "name": f"TEST_Rapid Capture Session {datetime.now().isoformat()}",
                "notes": "Test session for rapid capture"
            }
        )
        
        assert response.status_code == 200, f"Failed to create session: {response.text}"
        data = response.json()
        
        # Verify session has required fields
        assert "id" in data, "Session ID not returned"
        assert data.get("message") == "Inspection session started"
        
        # Store session ID for cleanup
        self.test_session_id = data["id"]
        
        # Verify session details
        session_response = self.session.get(f"{BASE_URL}/api/inspections/sessions/{self.test_session_id}")
        assert session_response.status_code == 200
        session_data = session_response.json()
        
        # FIX 2: Verify session has claim_id, inspector_id (created_by), started_at (created_at)
        assert session_data["claim_id"] == self.claim_id, "Session not bound to claim"
        assert "created_by" in session_data, "Inspector ID (created_by) missing"
        assert "created_at" in session_data, "Started at (created_at) missing"
        assert session_data["status"] == "in_progress", "Session should be in_progress"
        
        print(f"✓ Session created with claim_id={self.claim_id}, created_by={session_data['created_by']}")
    
    def test_create_inspection_session_without_claim_fails(self):
        """FIX 1: Session creation should fail without claim_id"""
        response = self.session.post(
            f"{BASE_URL}/api/inspections/sessions",
            json={
                "name": "TEST_Session without claim",
                "notes": "This should fail"
            }
        )
        
        # Should fail validation - claim_id is required
        assert response.status_code in [400, 422], f"Should fail without claim_id: {response.text}"
        print("✓ Session creation correctly requires claim_id")
    
    def test_get_sessions_by_claim(self):
        """Get inspection sessions filtered by claim_id"""
        # First create a session
        create_response = self.session.post(
            f"{BASE_URL}/api/inspections/sessions",
            json={
                "claim_id": self.claim_id,
                "name": "TEST_Filter Test Session"
            }
        )
        assert create_response.status_code == 200
        session_id = create_response.json()["id"]
        
        # Get sessions for this claim
        response = self.session.get(f"{BASE_URL}/api/inspections/sessions?claim_id={self.claim_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert "sessions" in data
        sessions = data["sessions"]
        
        # Verify all returned sessions belong to this claim
        for session in sessions:
            assert session["claim_id"] == self.claim_id, "Session returned for wrong claim"
        
        print(f"✓ Found {len(sessions)} sessions for claim {self.claim_id}")
    
    def test_complete_inspection_session(self):
        """Complete an inspection session"""
        # Create session
        create_response = self.session.post(
            f"{BASE_URL}/api/inspections/sessions",
            json={
                "claim_id": self.claim_id,
                "name": "TEST_Session to Complete"
            }
        )
        assert create_response.status_code == 200
        session_id = create_response.json()["id"]
        
        # Complete session
        complete_response = self.session.put(f"{BASE_URL}/api/inspections/sessions/{session_id}/complete")
        assert complete_response.status_code == 200
        assert complete_response.json()["message"] == "Inspection completed"
        
        # Verify session is completed
        session_response = self.session.get(f"{BASE_URL}/api/inspections/sessions/{session_id}")
        assert session_response.status_code == 200
        session_data = session_response.json()
        
        assert session_data["status"] == "completed", "Session should be completed"
        assert session_data["completed_at"] is not None, "Completed_at should be set"
        
        print(f"✓ Session {session_id} completed successfully")
    
    # ========== FIX 4: Photo Upload Tests ==========
    
    def test_upload_photo_with_session_and_claim(self):
        """FIX 4: Photos must include claim_id and session_id"""
        # Create session first
        create_response = self.session.post(
            f"{BASE_URL}/api/inspections/sessions",
            json={
                "claim_id": self.claim_id,
                "name": "TEST_Photo Upload Session"
            }
        )
        assert create_response.status_code == 200
        session_id = create_response.json()["id"]
        
        # Create a test image file
        test_image_content = b'\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
        
        # Upload photo with claim_id and session_id
        files = {"file": ("test_photo.jpg", test_image_content, "image/jpeg")}
        data = {
            "claim_id": self.claim_id,
            "session_id": session_id,
            "room": "Kitchen",
            "notes": "Test photo from rapid capture",
            "latitude": "27.9506",
            "longitude": "-82.4572"
        }
        
        # Remove Content-Type header for multipart upload
        headers = {"Authorization": self.session.headers["Authorization"]}
        response = requests.post(
            f"{BASE_URL}/api/inspections/photos",
            headers=headers,
            files=files,
            data=data
        )
        
        assert response.status_code == 200, f"Photo upload failed: {response.text}"
        photo_data = response.json()
        
        # Verify photo has required fields
        assert "id" in photo_data, "Photo ID not returned"
        assert "url" in photo_data, "Photo URL not returned"
        assert photo_data["metadata"]["claim_id"] == self.claim_id, "Photo not bound to claim"
        
        photo_id = photo_data["id"]
        
        # Verify photo is in session
        session_response = self.session.get(f"{BASE_URL}/api/inspections/sessions/{session_id}")
        assert session_response.status_code == 200
        session_data = session_response.json()
        
        assert session_data["photo_count"] >= 1, "Photo count should be incremented"
        
        # Verify photo is in claim gallery
        gallery_response = self.session.get(f"{BASE_URL}/api/inspections/claim/{self.claim_id}/photos")
        assert gallery_response.status_code == 200
        gallery_data = gallery_response.json()
        
        photo_ids = [p["id"] for p in gallery_data["photos"]]
        assert photo_id in photo_ids, "Photo should be in claim gallery"
        
        print(f"✓ Photo {photo_id} uploaded to claim {self.claim_id} via session {session_id}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/inspections/photos/{photo_id}")
    
    def test_photo_includes_timestamp(self):
        """FIX 2: Photos must include timestamp"""
        # Create session
        create_response = self.session.post(
            f"{BASE_URL}/api/inspections/sessions",
            json={
                "claim_id": self.claim_id,
                "name": "TEST_Timestamp Test Session"
            }
        )
        assert create_response.status_code == 200
        session_id = create_response.json()["id"]
        
        # Upload photo
        test_image_content = b'\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
        files = {"file": ("test_photo.jpg", test_image_content, "image/jpeg")}
        data = {
            "claim_id": self.claim_id,
            "session_id": session_id,
            "captured_at": datetime.now().isoformat()
        }
        
        headers = {"Authorization": self.session.headers["Authorization"]}
        response = requests.post(
            f"{BASE_URL}/api/inspections/photos",
            headers=headers,
            files=files,
            data=data
        )
        
        assert response.status_code == 200
        photo_data = response.json()
        photo_id = photo_data["id"]
        
        # Get photo metadata
        meta_response = self.session.get(f"{BASE_URL}/api/inspections/photos/{photo_id}")
        assert meta_response.status_code == 200
        meta_data = meta_response.json()
        
        assert "captured_at" in meta_data, "Photo should have captured_at timestamp"
        assert "uploaded_at" in meta_data, "Photo should have uploaded_at timestamp"
        
        print(f"✓ Photo has timestamps: captured_at={meta_data['captured_at']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/inspections/photos/{photo_id}")
    
    def test_session_tracks_rooms_documented(self):
        """Session should track which rooms have been documented"""
        # Create session
        create_response = self.session.post(
            f"{BASE_URL}/api/inspections/sessions",
            json={
                "claim_id": self.claim_id,
                "name": "TEST_Rooms Tracking Session"
            }
        )
        assert create_response.status_code == 200
        session_id = create_response.json()["id"]
        
        # Upload photos for different rooms
        rooms = ["Kitchen", "Living Room", "Bathroom"]
        photo_ids = []
        
        for room in rooms:
            test_image_content = b'\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
            files = {"file": (f"test_{room}.jpg", test_image_content, "image/jpeg")}
            data = {
                "claim_id": self.claim_id,
                "session_id": session_id,
                "room": room
            }
            
            headers = {"Authorization": self.session.headers["Authorization"]}
            response = requests.post(
                f"{BASE_URL}/api/inspections/photos",
                headers=headers,
                files=files,
                data=data
            )
            assert response.status_code == 200
            photo_ids.append(response.json()["id"])
        
        # Verify session tracks rooms
        session_response = self.session.get(f"{BASE_URL}/api/inspections/sessions/{session_id}")
        assert session_response.status_code == 200
        session_data = session_response.json()
        
        assert session_data["photo_count"] == len(rooms), f"Photo count should be {len(rooms)}"
        for room in rooms:
            assert room in session_data["rooms_documented"], f"Room {room} should be documented"
        
        print(f"✓ Session tracks rooms: {session_data['rooms_documented']}")
        
        # Cleanup
        for photo_id in photo_ids:
            self.session.delete(f"{BASE_URL}/api/inspections/photos/{photo_id}")
    
    # ========== Claim Gallery Tests ==========
    
    def test_claim_gallery_organizes_by_room(self):
        """FIX 4: Photos should be organized by room in claim gallery"""
        response = self.session.get(f"{BASE_URL}/api/inspections/claim/{self.claim_id}/photos")
        assert response.status_code == 200
        data = response.json()
        
        assert "photos" in data, "Gallery should have photos array"
        assert "by_room" in data, "Gallery should organize photos by room"
        assert "rooms" in data, "Gallery should list available rooms"
        assert "total" in data, "Gallery should have total count"
        
        print(f"✓ Claim gallery has {data['total']} photos organized by {len(data['rooms'])} rooms")
    
    def test_claim_timeline(self):
        """Photos should be available in timeline view"""
        response = self.session.get(f"{BASE_URL}/api/inspections/claim/{self.claim_id}/timeline")
        assert response.status_code == 200
        data = response.json()
        
        assert "timeline" in data, "Should have timeline array"
        assert "total" in data, "Should have total count"
        
        print(f"✓ Claim timeline has {data['total']} photos")
    
    # ========== Presets Tests ==========
    
    def test_room_presets_available(self):
        """Room presets should be available for organizing photos"""
        response = self.session.get(f"{BASE_URL}/api/inspections/presets/rooms")
        assert response.status_code == 200
        data = response.json()
        
        assert "rooms" in data, "Should have rooms array"
        rooms = data["rooms"]
        assert len(rooms) > 0, "Should have room presets"
        
        # Verify room structure
        for room in rooms:
            assert "id" in room, "Room should have id"
            assert "name" in room, "Room should have name"
            assert "icon" in room, "Room should have icon"
        
        print(f"✓ {len(rooms)} room presets available")
    
    def test_category_presets_available(self):
        """Category presets should be available for tagging photos"""
        response = self.session.get(f"{BASE_URL}/api/inspections/presets/categories")
        assert response.status_code == 200
        data = response.json()
        
        assert "categories" in data, "Should have categories array"
        categories = data["categories"]
        assert len(categories) > 0, "Should have category presets"
        
        # Verify category structure
        for cat in categories:
            assert "id" in cat, "Category should have id"
            assert "name" in cat, "Category should have name"
            assert "color" in cat, "Category should have color"
        
        print(f"✓ {len(categories)} category presets available")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

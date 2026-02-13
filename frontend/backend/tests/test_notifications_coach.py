"""
Test suite for Notifications API and Harvest Coach Bot
Tests: pagination, mark-read, bulk operations, coach scheduler status, manual trigger
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNotificationsAPI:
    """Notifications API endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.user_id = response.json().get("user", {}).get("id")
    
    def test_get_notifications_with_pagination(self):
        """Test GET /api/notifications with pagination params"""
        # Test page 1 with limit 5
        response = self.session.get(f"{BASE_URL}/api/notifications?page=1&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "notifications" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert "has_more" in data
        assert data["page"] == 1
        assert data["limit"] == 5
        assert isinstance(data["notifications"], list)
        
        # Verify notification structure
        if data["notifications"]:
            notif = data["notifications"][0]
            assert "id" in notif
            assert "type" in notif
            assert "title" in notif
            assert "is_read" in notif
            assert "created_at" in notif
    
    def test_get_notifications_filter_by_type(self):
        """Test GET /api/notifications with type filter"""
        response = self.session.get(f"{BASE_URL}/api/notifications?type=harvest_coach")
        assert response.status_code == 200
        
        data = response.json()
        # All returned notifications should be of type harvest_coach
        for notif in data.get("notifications", []):
            assert notif.get("type") == "harvest_coach"
    
    def test_get_notifications_unread_only(self):
        """Test GET /api/notifications with unread_only filter"""
        response = self.session.get(f"{BASE_URL}/api/notifications?unread_only=true")
        assert response.status_code == 200
        
        data = response.json()
        # All returned notifications should be unread
        for notif in data.get("notifications", []):
            assert notif.get("is_read") == False
    
    def test_get_unread_count(self):
        """Test GET /api/notifications/unread-count"""
        response = self.session.get(f"{BASE_URL}/api/notifications/unread-count")
        assert response.status_code == 200
        
        data = response.json()
        assert "unread_count" in data
        assert "count" in data  # Backwards compat field
        assert isinstance(data["unread_count"], int)
        assert data["unread_count"] >= 0
    
    def test_mark_single_notification_read(self):
        """Test PUT /api/notifications/{id}/read"""
        # First get a notification
        response = self.session.get(f"{BASE_URL}/api/notifications?limit=1")
        assert response.status_code == 200
        
        notifications = response.json().get("notifications", [])
        if not notifications:
            pytest.skip("No notifications to test with")
        
        notif_id = notifications[0]["id"]
        
        # Mark as read
        response = self.session.put(f"{BASE_URL}/api/notifications/{notif_id}/read")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "read" in data["message"].lower()
    
    def test_mark_all_notifications_read(self):
        """Test PUT /api/notifications/read-all"""
        response = self.session.put(f"{BASE_URL}/api/notifications/read-all")
        assert response.status_code == 200
        
        data = response.json()
        assert "marked_count" in data
        assert "message" in data
        assert isinstance(data["marked_count"], int)
    
    def test_mark_nonexistent_notification_read(self):
        """Test PUT /api/notifications/{id}/read with invalid ID"""
        fake_id = str(uuid.uuid4())
        response = self.session.put(f"{BASE_URL}/api/notifications/{fake_id}/read")
        assert response.status_code == 404


class TestHarvestCoachBot:
    """Harvest Coach Bot scheduler and trigger tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin (test@eden.com is admin)
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_get_coach_status(self):
        """Test GET /api/harvest/v2/coach/status"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/coach/status")
        assert response.status_code == 200
        
        data = response.json()
        assert "running" in data
        assert "jobs" in data
        assert isinstance(data["jobs"], list)
        
        # Verify scheduler is running
        assert data["running"] == True
        
        # Verify expected jobs exist
        job_ids = [job["id"] for job in data["jobs"]]
        assert "harvest_coach_hourly" in job_ids
        assert "harvest_coach_nightly" in job_ids
        
        # Verify job structure
        for job in data["jobs"]:
            assert "id" in job
            assert "name" in job
            assert "next_run" in job
            assert "trigger" in job
    
    def test_trigger_coach_hourly(self):
        """Test POST /api/harvest/v2/coach/trigger with hourly run"""
        response = self.session.post(f"{BASE_URL}/api/harvest/v2/coach/trigger?run_type=hourly")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "hourly" in data["message"].lower()
    
    def test_trigger_coach_nightly(self):
        """Test POST /api/harvest/v2/coach/trigger with nightly run"""
        response = self.session.post(f"{BASE_URL}/api/harvest/v2/coach/trigger?run_type=nightly")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "nightly" in data["message"].lower()
    
    def test_harvest_coach_notification_structure(self):
        """Test that harvest_coach notifications have correct structure"""
        response = self.session.get(f"{BASE_URL}/api/notifications?type=harvest_coach&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        notifications = data.get("notifications", [])
        
        if not notifications:
            pytest.skip("No harvest_coach notifications to verify")
        
        notif = notifications[0]
        
        # Verify harvest_coach notification structure
        assert notif.get("type") == "harvest_coach"
        assert "title" in notif
        assert "body" in notif or "message" in notif
        assert "cta_label" in notif
        assert "cta_route" in notif
        assert "data" in notif
        
        # Verify data contains nudge_type
        assert "nudge_type" in notif.get("data", {})


class TestNotificationTypes:
    """Test different notification types and their structure"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        assert response.status_code == 200
        self.token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_claim_created_notification_type(self):
        """Test claim_created notification type filter"""
        response = self.session.get(f"{BASE_URL}/api/notifications?type=claim_created&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        for notif in data.get("notifications", []):
            assert notif.get("type") == "claim_created"
    
    def test_claim_assigned_notification_type(self):
        """Test claim_assigned notification type filter"""
        response = self.session.get(f"{BASE_URL}/api/notifications?type=claim_assigned&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        for notif in data.get("notifications", []):
            assert notif.get("type") == "claim_assigned"
    
    def test_system_notification_type(self):
        """Test system notification type filter"""
        response = self.session.get(f"{BASE_URL}/api/notifications?type=system&limit=5")
        assert response.status_code == 200
        # Just verify the endpoint works, may not have system notifications


class TestNotificationPagination:
    """Test notification pagination edge cases"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        assert response.status_code == 200
        self.token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_pagination_page_2(self):
        """Test pagination with page 2"""
        response = self.session.get(f"{BASE_URL}/api/notifications?page=2&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert data["page"] == 2
    
    def test_pagination_large_limit(self):
        """Test pagination with max limit (50)"""
        response = self.session.get(f"{BASE_URL}/api/notifications?limit=50")
        assert response.status_code == 200
        
        data = response.json()
        assert data["limit"] == 50
    
    def test_pagination_has_more_flag(self):
        """Test has_more flag accuracy"""
        response = self.session.get(f"{BASE_URL}/api/notifications?page=1&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        total = data["total"]
        returned = len(data["notifications"])
        
        # has_more should be True if there are more notifications
        if total > 5:
            assert data["has_more"] == True
        else:
            assert data["has_more"] == False


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

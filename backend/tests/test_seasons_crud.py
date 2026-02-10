"""
Test Suite for Seasons Tab CRUD Operations - Phase 3
Tests all Season endpoints with new fields: icon, banner_image_url, grand_prize_description, grand_prize_value_cents

Endpoints tested:
- GET /api/incentives/seasons - List all seasons
- GET /api/incentives/seasons/{id} - Get single season
- POST /api/incentives/seasons - Create new season with grand prize
- PUT /api/incentives/seasons/{id} - Full update season
- PATCH /api/incentives/seasons/{id} - Partial update season
- DELETE /api/incentives/seasons/{id} - Delete season
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSeasonsAuth:
    """Test authentication for seasons endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.token = token
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    def test_seasons_requires_auth(self):
        """Test that seasons endpoint requires authentication"""
        # Create new session without auth
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/incentives/seasons")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Seasons endpoint requires authentication")


class TestSeasonsListAndGet:
    """Test GET operations for seasons"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed")
    
    def test_get_all_seasons(self):
        """Test GET /api/incentives/seasons returns list of seasons"""
        response = self.session.get(f"{BASE_URL}/api/incentives/seasons")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "seasons" in data, "Response should contain 'seasons' key"
        assert isinstance(data["seasons"], list), "Seasons should be a list"
        print(f"PASS: GET /api/incentives/seasons returned {len(data['seasons'])} seasons")
    
    def test_get_seasons_with_status_filter(self):
        """Test GET /api/incentives/seasons with status filter"""
        response = self.session.get(f"{BASE_URL}/api/incentives/seasons?status=active")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "seasons" in data
        # All returned seasons should have active status
        for season in data["seasons"]:
            assert season.get("status") == "active", f"Expected active status, got {season.get('status')}"
        print(f"PASS: Status filter works - returned {len(data['seasons'])} active seasons")
    
    def test_seasons_have_required_fields(self):
        """Test that seasons have all required fields including new Phase 3 fields"""
        response = self.session.get(f"{BASE_URL}/api/incentives/seasons")
        assert response.status_code == 200
        
        data = response.json()
        if len(data["seasons"]) > 0:
            season = data["seasons"][0]
            
            # Check required fields
            required_fields = ["id", "name", "start_date", "end_date", "status"]
            for field in required_fields:
                assert field in season, f"Season missing required field: {field}"
            
            # Check enriched fields
            assert "competition_count" in season, "Season should have competition_count"
            
            print(f"PASS: Season has all required fields: {list(season.keys())}")
        else:
            print("SKIP: No seasons to verify fields")
    
    def test_seasons_have_status_badges(self):
        """Test that seasons have correct status values (upcoming, active, completed)"""
        response = self.session.get(f"{BASE_URL}/api/incentives/seasons")
        assert response.status_code == 200
        
        data = response.json()
        valid_statuses = ["upcoming", "active", "completed"]
        
        for season in data["seasons"]:
            status = season.get("status")
            assert status in valid_statuses, f"Invalid status: {status}"
        
        print(f"PASS: All seasons have valid status badges")


class TestSeasonCreate:
    """Test POST /api/incentives/seasons - Create new season"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed")
        
        self.created_season_ids = []
    
    def teardown_method(self, method):
        """Cleanup created test seasons"""
        for season_id in self.created_season_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/incentives/seasons/{season_id}")
            except:
                pass
    
    def test_create_season_basic(self):
        """Test creating a basic season"""
        start_date = (datetime.now() + timedelta(days=30)).isoformat()
        end_date = (datetime.now() + timedelta(days=120)).isoformat()
        
        payload = {
            "name": "TEST_Basic_Season",
            "description": "Test season for basic creation",
            "start_date": start_date,
            "end_date": end_date,
            "theme_name": "Test Theme",
            "theme_color": "#FF5733"
        }
        
        response = self.session.post(f"{BASE_URL}/api/incentives/seasons", json=payload)
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain season id"
        self.created_season_ids.append(data["id"])
        
        # Verify season was created by fetching it
        get_response = self.session.get(f"{BASE_URL}/api/incentives/seasons/{data['id']}")
        assert get_response.status_code == 200
        
        created_season = get_response.json()
        assert created_season["name"] == payload["name"]
        assert created_season["description"] == payload["description"]
        
        print(f"PASS: Created basic season with id: {data['id']}")
    
    def test_create_season_with_grand_prize(self):
        """Test creating a season with grand prize (Phase 3 feature)"""
        start_date = (datetime.now() + timedelta(days=30)).isoformat()
        end_date = (datetime.now() + timedelta(days=120)).isoformat()
        
        payload = {
            "name": "TEST_Grand_Prize_Season",
            "description": "Season with grand prize",
            "start_date": start_date,
            "end_date": end_date,
            "theme_name": "Champions League",
            "theme_color": "#6366F1",
            "icon": "🏆",
            "banner_image_url": "https://example.com/banner.jpg",
            "grand_prize_description": "$5,000 bonus + Hawaii trip",
            "grand_prize_value_cents": 500000
        }
        
        response = self.session.post(f"{BASE_URL}/api/incentives/seasons", json=payload)
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        self.created_season_ids.append(data["id"])
        
        # Verify grand prize fields were saved
        get_response = self.session.get(f"{BASE_URL}/api/incentives/seasons/{data['id']}")
        assert get_response.status_code == 200
        
        created_season = get_response.json()
        assert created_season.get("grand_prize_description") == payload["grand_prize_description"]
        assert created_season.get("grand_prize_value_cents") == payload["grand_prize_value_cents"]
        assert created_season.get("icon") == payload["icon"]
        assert created_season.get("banner_image_url") == payload["banner_image_url"]
        
        print(f"PASS: Created season with grand prize: {payload['grand_prize_description']}")
    
    def test_create_season_with_all_fields(self):
        """Test creating a season with all available fields"""
        start_date = (datetime.now() + timedelta(days=30)).isoformat()
        end_date = (datetime.now() + timedelta(days=120)).isoformat()
        
        payload = {
            "name": "TEST_Full_Season",
            "description": "Season with all fields populated",
            "start_date": start_date,
            "end_date": end_date,
            "theme_name": "Winter Warriors",
            "theme_color": "#10B981",
            "banner_image_url": "https://example.com/winter-banner.jpg",
            "icon": "❄️",
            "grand_prize_description": "$10,000 cash prize",
            "grand_prize_value_cents": 1000000,
            "points_multiplier": 1.5,
            "is_active": True
        }
        
        response = self.session.post(f"{BASE_URL}/api/incentives/seasons", json=payload)
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        self.created_season_ids.append(data["id"])
        
        # Verify all fields
        get_response = self.session.get(f"{BASE_URL}/api/incentives/seasons/{data['id']}")
        created_season = get_response.json()
        
        assert created_season["name"] == payload["name"]
        assert created_season["theme_name"] == payload["theme_name"]
        assert created_season["theme_color"] == payload["theme_color"]
        assert created_season.get("icon") == payload["icon"]
        
        print(f"PASS: Created season with all fields")
    
    def test_create_season_status_calculation(self):
        """Test that season status is correctly calculated based on dates"""
        # Create upcoming season (starts in future)
        future_start = (datetime.now() + timedelta(days=30)).isoformat()
        future_end = (datetime.now() + timedelta(days=120)).isoformat()
        
        payload = {
            "name": "TEST_Upcoming_Season",
            "description": "Should be upcoming",
            "start_date": future_start,
            "end_date": future_end
        }
        
        response = self.session.post(f"{BASE_URL}/api/incentives/seasons", json=payload)
        assert response.status_code in [200, 201]
        
        data = response.json()
        self.created_season_ids.append(data["id"])
        
        # Status should be "upcoming" since start date is in future
        assert data.get("status") == "upcoming", f"Expected 'upcoming', got {data.get('status')}"
        
        print(f"PASS: Season status correctly calculated as 'upcoming'")
    
    def test_create_season_missing_required_fields(self):
        """Test that creating season without required fields fails"""
        # Missing name
        payload = {
            "description": "Missing name",
            "start_date": datetime.now().isoformat(),
            "end_date": (datetime.now() + timedelta(days=90)).isoformat()
        }
        
        response = self.session.post(f"{BASE_URL}/api/incentives/seasons", json=payload)
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        
        print("PASS: Creating season without required fields fails correctly")


class TestSeasonUpdate:
    """Test PUT and PATCH /api/incentives/seasons/{id} - Update season"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session and create a test season"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed")
        
        # Create a test season for update tests
        start_date = (datetime.now() + timedelta(days=30)).isoformat()
        end_date = (datetime.now() + timedelta(days=120)).isoformat()
        
        create_response = self.session.post(f"{BASE_URL}/api/incentives/seasons", json={
            "name": "TEST_Update_Season",
            "description": "Season for update tests",
            "start_date": start_date,
            "end_date": end_date,
            "theme_name": "Original Theme",
            "theme_color": "#FF0000"
        })
        
        if create_response.status_code in [200, 201]:
            self.test_season_id = create_response.json()["id"]
        else:
            pytest.skip("Failed to create test season")
    
    def teardown_method(self, method):
        """Cleanup test season"""
        if hasattr(self, 'test_season_id'):
            try:
                self.session.delete(f"{BASE_URL}/api/incentives/seasons/{self.test_season_id}")
            except:
                pass
    
    def test_update_season_full_put(self):
        """Test full update of season using PUT"""
        start_date = (datetime.now() + timedelta(days=60)).isoformat()
        end_date = (datetime.now() + timedelta(days=150)).isoformat()
        
        payload = {
            "name": "TEST_Updated_Season_Name",
            "description": "Updated description",
            "start_date": start_date,
            "end_date": end_date,
            "theme_name": "Updated Theme",
            "theme_color": "#00FF00",
            "icon": "🎯",
            "banner_image_url": "https://example.com/updated-banner.jpg",
            "grand_prize_description": "Updated grand prize",
            "grand_prize_value_cents": 250000
        }
        
        response = self.session.put(f"{BASE_URL}/api/incentives/seasons/{self.test_season_id}", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/incentives/seasons/{self.test_season_id}")
        updated_season = get_response.json()
        
        assert updated_season["name"] == payload["name"]
        assert updated_season["description"] == payload["description"]
        assert updated_season["theme_name"] == payload["theme_name"]
        assert updated_season["theme_color"] == payload["theme_color"]
        assert updated_season.get("icon") == payload["icon"]
        assert updated_season.get("grand_prize_description") == payload["grand_prize_description"]
        assert updated_season.get("grand_prize_value_cents") == payload["grand_prize_value_cents"]
        
        print(f"PASS: Full PUT update successful")
    
    def test_update_season_partial_patch(self):
        """Test partial update of season using PATCH"""
        payload = {
            "name": "TEST_Patched_Season_Name",
            "grand_prize_value_cents": 300000
        }
        
        response = self.session.patch(f"{BASE_URL}/api/incentives/seasons/{self.test_season_id}", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify partial update
        get_response = self.session.get(f"{BASE_URL}/api/incentives/seasons/{self.test_season_id}")
        updated_season = get_response.json()
        
        assert updated_season["name"] == payload["name"]
        assert updated_season.get("grand_prize_value_cents") == payload["grand_prize_value_cents"]
        # Original theme should still be there
        assert updated_season["theme_name"] == "Original Theme"
        
        print(f"PASS: Partial PATCH update successful")
    
    def test_update_nonexistent_season(self):
        """Test updating a non-existent season returns 404"""
        payload = {
            "name": "TEST_Nonexistent",
            "description": "Should fail",
            "start_date": datetime.now().isoformat(),
            "end_date": (datetime.now() + timedelta(days=90)).isoformat()
        }
        
        response = self.session.put(f"{BASE_URL}/api/incentives/seasons/nonexistent-id-12345", json=payload)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("PASS: Updating non-existent season returns 404")
    
    def test_update_season_grand_prize(self):
        """Test updating only grand prize fields"""
        payload = {
            "grand_prize_description": "New Grand Prize: $1,000 + Vacation",
            "grand_prize_value_cents": 150000
        }
        
        response = self.session.patch(f"{BASE_URL}/api/incentives/seasons/{self.test_season_id}", json=payload)
        assert response.status_code == 200
        
        # Verify
        get_response = self.session.get(f"{BASE_URL}/api/incentives/seasons/{self.test_season_id}")
        updated_season = get_response.json()
        
        assert updated_season.get("grand_prize_description") == payload["grand_prize_description"]
        assert updated_season.get("grand_prize_value_cents") == payload["grand_prize_value_cents"]
        
        print("PASS: Grand prize fields updated successfully")


class TestSeasonDelete:
    """Test DELETE /api/incentives/seasons/{id}"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed")
    
    def test_delete_season(self):
        """Test deleting a season"""
        # First create a season to delete
        start_date = (datetime.now() + timedelta(days=30)).isoformat()
        end_date = (datetime.now() + timedelta(days=120)).isoformat()
        
        create_response = self.session.post(f"{BASE_URL}/api/incentives/seasons", json={
            "name": "TEST_Delete_Season",
            "description": "Season to be deleted",
            "start_date": start_date,
            "end_date": end_date
        })
        
        assert create_response.status_code in [200, 201]
        season_id = create_response.json()["id"]
        
        # Delete the season
        delete_response = self.session.delete(f"{BASE_URL}/api/incentives/seasons/{season_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify deletion - should return 404
        get_response = self.session.get(f"{BASE_URL}/api/incentives/seasons/{season_id}")
        assert get_response.status_code == 404, f"Expected 404 after deletion, got {get_response.status_code}"
        
        print(f"PASS: Season deleted successfully")
    
    def test_delete_nonexistent_season(self):
        """Test deleting a non-existent season returns 404"""
        response = self.session.delete(f"{BASE_URL}/api/incentives/seasons/nonexistent-id-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("PASS: Deleting non-existent season returns 404")


class TestSeasonProgressTracking:
    """Test season progress bar and status calculations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed")
        
        self.created_season_ids = []
    
    def teardown_method(self, method):
        """Cleanup created test seasons"""
        for season_id in self.created_season_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/incentives/seasons/{season_id}")
            except:
                pass
    
    def test_active_season_has_progress_data(self):
        """Test that active seasons have data for progress bar calculation"""
        # Create an active season (started in past, ends in future)
        start_date = (datetime.now() - timedelta(days=30)).isoformat()
        end_date = (datetime.now() + timedelta(days=60)).isoformat()
        
        create_response = self.session.post(f"{BASE_URL}/api/incentives/seasons", json={
            "name": "TEST_Active_Progress_Season",
            "description": "Active season for progress test",
            "start_date": start_date,
            "end_date": end_date
        })
        
        assert create_response.status_code in [200, 201]
        data = create_response.json()
        self.created_season_ids.append(data["id"])
        
        # Status should be active
        assert data.get("status") == "active", f"Expected 'active', got {data.get('status')}"
        
        # Get season details
        get_response = self.session.get(f"{BASE_URL}/api/incentives/seasons/{data['id']}")
        season = get_response.json()
        
        # Should have start_date and end_date for progress calculation
        assert "start_date" in season
        assert "end_date" in season
        
        print("PASS: Active season has data for progress bar calculation")
    
    def test_season_status_transitions(self):
        """Test that season status is correctly determined by dates"""
        # Test upcoming (future start)
        future_start = (datetime.now() + timedelta(days=30)).isoformat()
        future_end = (datetime.now() + timedelta(days=120)).isoformat()
        
        upcoming_response = self.session.post(f"{BASE_URL}/api/incentives/seasons", json={
            "name": "TEST_Upcoming_Status",
            "description": "Should be upcoming",
            "start_date": future_start,
            "end_date": future_end
        })
        
        assert upcoming_response.status_code in [200, 201]
        upcoming_data = upcoming_response.json()
        self.created_season_ids.append(upcoming_data["id"])
        assert upcoming_data.get("status") == "upcoming"
        
        # Test active (past start, future end)
        past_start = (datetime.now() - timedelta(days=30)).isoformat()
        future_end2 = (datetime.now() + timedelta(days=60)).isoformat()
        
        active_response = self.session.post(f"{BASE_URL}/api/incentives/seasons", json={
            "name": "TEST_Active_Status",
            "description": "Should be active",
            "start_date": past_start,
            "end_date": future_end2
        })
        
        assert active_response.status_code in [200, 201]
        active_data = active_response.json()
        self.created_season_ids.append(active_data["id"])
        assert active_data.get("status") == "active"
        
        print("PASS: Season status transitions work correctly")


class TestSeasonEnrichment:
    """Test season enrichment with competition count and standings"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed")
    
    def test_seasons_include_competition_count(self):
        """Test that seasons list includes competition_count"""
        response = self.session.get(f"{BASE_URL}/api/incentives/seasons")
        assert response.status_code == 200
        
        data = response.json()
        for season in data["seasons"]:
            assert "competition_count" in season, "Season should have competition_count"
            assert isinstance(season["competition_count"], int)
        
        print("PASS: Seasons include competition_count")
    
    def test_season_detail_includes_competitions(self):
        """Test that season detail endpoint includes competitions list"""
        # Get list of seasons first
        list_response = self.session.get(f"{BASE_URL}/api/incentives/seasons")
        assert list_response.status_code == 200
        
        seasons = list_response.json()["seasons"]
        if len(seasons) > 0:
            season_id = seasons[0]["id"]
            
            # Get season detail
            detail_response = self.session.get(f"{BASE_URL}/api/incentives/seasons/{season_id}")
            assert detail_response.status_code == 200
            
            season_detail = detail_response.json()
            assert "competitions" in season_detail, "Season detail should include competitions"
            assert "standings" in season_detail, "Season detail should include standings"
            
            print(f"PASS: Season detail includes competitions and standings")
        else:
            print("SKIP: No seasons to test detail endpoint")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

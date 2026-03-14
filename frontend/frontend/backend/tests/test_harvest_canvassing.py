"""
Harvest Canvassing Module Tests
================================
Tests for:
- Canvassing Map API (pins, territories, stats)
- Regrid API (parcel intelligence with graceful fallback)
- Harvest Scoring (leaderboard, badges)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@eden.com"
TEST_PASSWORD = "password"


class TestAuth:
    """Authentication for test session"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }


class TestCanvassingMapPins(TestAuth):
    """Test canvassing map pin endpoints"""
    
    def test_get_pins(self, auth_headers):
        """GET /api/canvassing-map/pins - Get all pins"""
        response = requests.get(f"{BASE_URL}/api/canvassing-map/pins", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get pins: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET pins returned {len(data)} pins")
    
    def test_create_pin(self, auth_headers):
        """POST /api/canvassing-map/pins - Create a new pin"""
        pin_data = {
            "latitude": 27.9506,
            "longitude": -82.4572,
            "disposition": "unmarked"
        }
        response = requests.post(f"{BASE_URL}/api/canvassing-map/pins", json=pin_data, headers=auth_headers)
        assert response.status_code in [200, 201], f"Failed to create pin: {response.text}"
        data = response.json()
        assert "id" in data, "Response should contain pin id"
        print(f"✓ Created pin with id: {data['id']}")
        return data["id"]
    
    def test_create_and_update_pin_status(self, auth_headers):
        """Test pin creation and status update flow"""
        # Create pin
        pin_data = {
            "latitude": 27.9510,
            "longitude": -82.4580,
            "disposition": "unmarked"
        }
        create_response = requests.post(f"{BASE_URL}/api/canvassing-map/pins", json=pin_data, headers=auth_headers)
        assert create_response.status_code in [200, 201], f"Failed to create pin: {create_response.text}"
        pin_id = create_response.json()["id"]
        
        # Update status to "not_home"
        update_data = {"disposition": "not_home"}
        update_response = requests.patch(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200, f"Failed to update pin: {update_response.text}"
        data = update_response.json()
        assert data.get("disposition") == "not_home" or "points_earned" in data, "Status should be updated"
        print(f"✓ Updated pin {pin_id} to 'not_home'")
        
        # Update status to "callback"
        update_data = {"disposition": "callback"}
        update_response = requests.patch(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200, f"Failed to update pin: {update_response.text}"
        print(f"✓ Updated pin {pin_id} to 'callback'")
        
        # Update status to "appointment"
        update_data = {"disposition": "appointment"}
        update_response = requests.patch(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200, f"Failed to update pin: {update_response.text}"
        print(f"✓ Updated pin {pin_id} to 'appointment'")
        
        # Update status to "signed"
        update_data = {"disposition": "signed"}
        update_response = requests.patch(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200, f"Failed to update pin: {update_response.text}"
        print(f"✓ Updated pin {pin_id} to 'signed'")
        
        # Update status to "do_not_knock"
        update_data = {"disposition": "do_not_knock"}
        update_response = requests.patch(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200, f"Failed to update pin: {update_response.text}"
        print(f"✓ Updated pin {pin_id} to 'do_not_knock' (DNK)")
    
    def test_update_pin_contact_info(self, auth_headers):
        """Test updating pin with contact information"""
        # Create pin
        pin_data = {
            "latitude": 27.9515,
            "longitude": -82.4585,
            "disposition": "unmarked"
        }
        create_response = requests.post(f"{BASE_URL}/api/canvassing-map/pins", json=pin_data, headers=auth_headers)
        assert create_response.status_code in [200, 201]
        pin_id = create_response.json()["id"]
        
        # Update with contact info
        update_data = {
            "homeowner_name": "John Doe",
            "phone": "555-123-4567",
            "email": "john@example.com",
            "notes": "Interested in roof inspection"
        }
        update_response = requests.patch(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200, f"Failed to update contact info: {update_response.text}"
        print(f"✓ Updated pin {pin_id} with contact info")


class TestCanvassingMapTerritories(TestAuth):
    """Test territory management endpoints"""
    
    def test_get_territories(self, auth_headers):
        """GET /api/canvassing-map/territories - Get all territories"""
        response = requests.get(f"{BASE_URL}/api/canvassing-map/territories", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get territories: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET territories returned {len(data)} territories")


class TestCanvassingMapStats(TestAuth):
    """Test stats/overview endpoint"""
    
    def test_get_stats_overview(self, auth_headers):
        """GET /api/canvassing-map/stats/overview - Get canvassing statistics"""
        response = requests.get(f"{BASE_URL}/api/canvassing-map/stats/overview", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "total_pins" in data, "Response should contain total_pins"
        assert "by_disposition" in data, "Response should contain by_disposition"
        assert "disposition_info" in data, "Response should contain disposition_info"
        
        print(f"✓ Stats overview: {data['total_pins']} total pins")
        print(f"  - Signed: {data['by_disposition'].get('signed', 0)}")
        print(f"  - Appointments: {data['by_disposition'].get('appointment', 0)}")


class TestRegridAPI(TestAuth):
    """Test Regrid parcel intelligence API (graceful fallback mode)"""
    
    def test_parcel_point_lookup_fallback(self, auth_headers):
        """GET /api/regrid/parcel/point - Should return graceful fallback when API key not configured"""
        response = requests.get(
            f"{BASE_URL}/api/regrid/parcel/point",
            params={"lat": 27.9506, "lon": -82.4572},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to lookup parcel: {response.text}"
        data = response.json()
        
        # Should return fallback response when no API key
        if data.get("fallback"):
            assert data.get("success") == False, "Fallback should indicate no success"
            assert "message" in data, "Fallback should have message"
            print(f"✓ Regrid parcel lookup returned graceful fallback: {data.get('message')}")
        else:
            # If API key is configured, should return parcel data
            print(f"✓ Regrid parcel lookup returned data (API configured)")
    
    def test_regrid_stats(self, auth_headers):
        """GET /api/regrid/stats - Get Regrid usage statistics"""
        response = requests.get(f"{BASE_URL}/api/regrid/stats", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get Regrid stats: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "api_configured" in data, "Response should contain api_configured"
        assert "cached_parcels" in data, "Response should contain cached_parcels"
        
        print(f"✓ Regrid stats: API configured={data['api_configured']}, cached={data['cached_parcels']}")
    
    def test_tiles_config(self, auth_headers):
        """GET /api/regrid/tiles/config - Get tile configuration"""
        response = requests.get(f"{BASE_URL}/api/regrid/tiles/config", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get tiles config: {response.text}"
        data = response.json()
        
        # Should indicate if tiles are enabled
        assert "enabled" in data, "Response should contain enabled flag"
        print(f"✓ Regrid tiles config: enabled={data['enabled']}")


class TestHarvestScoring(TestAuth):
    """Test Harvest scoring/gamification endpoints"""
    
    def test_get_leaderboard_day(self, auth_headers):
        """GET /api/harvest/scoring/leaderboard - Day period"""
        response = requests.get(
            f"{BASE_URL}/api/harvest/scoring/leaderboard",
            params={"period": "day", "limit": 20},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get leaderboard: {response.text}"
        data = response.json()
        
        assert "period" in data, "Response should contain period"
        assert "entries" in data, "Response should contain entries"
        assert data["period"] == "day", "Period should be 'day'"
        
        print(f"✓ Day leaderboard: {len(data['entries'])} entries")
    
    def test_get_leaderboard_week(self, auth_headers):
        """GET /api/harvest/scoring/leaderboard - Week period"""
        response = requests.get(
            f"{BASE_URL}/api/harvest/scoring/leaderboard",
            params={"period": "week", "limit": 20},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get leaderboard: {response.text}"
        data = response.json()
        assert data["period"] == "week", "Period should be 'week'"
        print(f"✓ Week leaderboard: {len(data['entries'])} entries")
    
    def test_get_leaderboard_month(self, auth_headers):
        """GET /api/harvest/scoring/leaderboard - Month period"""
        response = requests.get(
            f"{BASE_URL}/api/harvest/scoring/leaderboard",
            params={"period": "month", "limit": 20},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get leaderboard: {response.text}"
        data = response.json()
        assert data["period"] == "month", "Period should be 'month'"
        print(f"✓ Month leaderboard: {len(data['entries'])} entries")
    
    def test_get_leaderboard_all_time(self, auth_headers):
        """GET /api/harvest/scoring/leaderboard - All time period"""
        response = requests.get(
            f"{BASE_URL}/api/harvest/scoring/leaderboard",
            params={"period": "all_time", "limit": 20},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get leaderboard: {response.text}"
        data = response.json()
        assert data["period"] == "all_time", "Period should be 'all_time'"
        print(f"✓ All-time leaderboard: {len(data['entries'])} entries")
    
    def test_get_badges(self, auth_headers):
        """GET /api/harvest/scoring/badges - Get all badges"""
        response = requests.get(f"{BASE_URL}/api/harvest/scoring/badges", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get badges: {response.text}"
        data = response.json()
        
        assert "badges" in data, "Response should contain badges"
        assert "earned_count" in data, "Response should contain earned_count"
        assert "total_count" in data, "Response should contain total_count"
        
        badges = data["badges"]
        assert len(badges) > 0, "Should have at least one badge"
        
        # Verify badge structure
        for badge in badges:
            assert "id" in badge, "Badge should have id"
            assert "name" in badge, "Badge should have name"
            assert "icon" in badge, "Badge should have icon"
            assert "rarity" in badge, "Badge should have rarity"
        
        print(f"✓ Badges: {data['earned_count']}/{data['total_count']} earned")
        print(f"  Available badges: {[b['name'] for b in badges[:5]]}...")
    
    def test_get_my_stats(self, auth_headers):
        """GET /api/harvest/scoring/stats/me - Get current user stats"""
        response = requests.get(f"{BASE_URL}/api/harvest/scoring/stats/me", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get my stats: {response.text}"
        data = response.json()
        
        assert "total_points" in data, "Response should contain total_points"
        assert "today_points" in data, "Response should contain today_points"
        assert "streak" in data, "Response should contain streak"
        assert "multiplier" in data, "Response should contain multiplier"
        
        print(f"✓ My stats: {data['total_points']} total points, {data['today_points']} today, {data['streak']} day streak")


class TestHarvestCompetitions(TestAuth):
    """Test Harvest competitions endpoint"""
    
    def test_get_competitions(self, auth_headers):
        """GET /api/harvest/competitions - Get active competitions"""
        response = requests.get(f"{BASE_URL}/api/harvest/competitions", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get competitions: {response.text}"
        data = response.json()
        
        # Response should have competitions array
        assert "competitions" in data or isinstance(data, list), "Response should contain competitions"
        
        competitions = data.get("competitions", data) if isinstance(data, dict) else data
        print(f"✓ Competitions: {len(competitions)} active")


class TestDispositions(TestAuth):
    """Test disposition options endpoint"""
    
    def test_get_dispositions(self, auth_headers):
        """GET /api/canvassing-map/dispositions - Get all disposition options"""
        response = requests.get(f"{BASE_URL}/api/canvassing-map/dispositions", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get dispositions: {response.text}"
        data = response.json()
        
        # Should have standard dispositions
        expected_dispositions = ["unmarked", "not_home", "not_interested", "callback", "appointment", "signed", "do_not_knock"]
        for disp in expected_dispositions:
            assert disp in data, f"Missing disposition: {disp}"
        
        print(f"✓ Dispositions: {list(data.keys())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Harvest Scoring Engine API Tests
Tests for leaderboard, badges, stats, and disposition-based point awarding
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@eden.com"
TEST_PASSWORD = "password"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping tests")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestLeaderboardAPI:
    """Leaderboard endpoint tests with period filters"""
    
    def test_leaderboard_day_period(self, api_client):
        """Test leaderboard with day period filter"""
        response = api_client.get(f"{BASE_URL}/api/harvest/scoring/leaderboard?period=day&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "period" in data
        assert data["period"] == "day"
        assert "entries" in data
        assert "kpi" in data
        assert "updated_at" in data
        assert isinstance(data["entries"], list)
    
    def test_leaderboard_week_period(self, api_client):
        """Test leaderboard with week period filter"""
        response = api_client.get(f"{BASE_URL}/api/harvest/scoring/leaderboard?period=week&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "week"
        assert isinstance(data["entries"], list)
    
    def test_leaderboard_month_period(self, api_client):
        """Test leaderboard with month period filter"""
        response = api_client.get(f"{BASE_URL}/api/harvest/scoring/leaderboard?period=month&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "month"
        assert isinstance(data["entries"], list)
    
    def test_leaderboard_all_time_period(self, api_client):
        """Test leaderboard with all_time period filter"""
        response = api_client.get(f"{BASE_URL}/api/harvest/scoring/leaderboard?period=all_time&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert data["period"] == "all_time"
        assert isinstance(data["entries"], list)
    
    def test_leaderboard_entry_structure(self, api_client):
        """Test leaderboard entry has correct structure"""
        response = api_client.get(f"{BASE_URL}/api/harvest/scoring/leaderboard?period=all_time&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        if len(data["entries"]) > 0:
            entry = data["entries"][0]
            assert "rank" in entry
            assert "user_id" in entry
            assert "user_name" in entry
            assert "score" in entry
            assert "events" in entry
            assert "streak" in entry
            assert "badges" in entry
            assert "is_current_user" in entry


class TestMyStatsAPI:
    """My Stats endpoint tests"""
    
    def test_get_my_stats(self, api_client):
        """Test getting current user's stats"""
        response = api_client.get(f"{BASE_URL}/api/harvest/scoring/stats/me")
        assert response.status_code == 200
        
        data = response.json()
        assert "user_id" in data
        assert "total_points" in data
        assert "today_points" in data
        assert "today_activity" in data
        assert "streak" in data
        assert "multiplier" in data
        assert "badges_earned" in data
    
    def test_stats_data_types(self, api_client):
        """Test stats have correct data types"""
        response = api_client.get(f"{BASE_URL}/api/harvest/scoring/stats/me")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data["total_points"], (int, float))
        assert isinstance(data["today_points"], (int, float))
        assert isinstance(data["streak"], int)
        assert isinstance(data["multiplier"], (int, float))
        assert isinstance(data["badges_earned"], int)


class TestBadgesAPI:
    """Badges endpoint tests"""
    
    def test_get_all_badges(self, api_client):
        """Test getting all badges with earned status"""
        response = api_client.get(f"{BASE_URL}/api/harvest/scoring/badges")
        assert response.status_code == 200
        
        data = response.json()
        assert "badges" in data
        assert "earned_count" in data
        assert "total_count" in data
        assert isinstance(data["badges"], list)
    
    def test_badges_count_is_10(self, api_client):
        """Test that there are exactly 10 badges"""
        response = api_client.get(f"{BASE_URL}/api/harvest/scoring/badges")
        assert response.status_code == 200
        
        data = response.json()
        assert data["total_count"] == 10
        assert len(data["badges"]) == 10
    
    def test_badge_structure(self, api_client):
        """Test badge has correct structure"""
        response = api_client.get(f"{BASE_URL}/api/harvest/scoring/badges")
        assert response.status_code == 200
        
        data = response.json()
        badge = data["badges"][0]
        assert "id" in badge
        assert "name" in badge
        assert "icon" in badge
        assert "description" in badge
        assert "criteria" in badge
        assert "rarity" in badge
        assert "points_bonus" in badge
        assert "earned" in badge
        assert "earned_at" in badge
    
    def test_badge_rarities(self, api_client):
        """Test badges have valid rarity values"""
        response = api_client.get(f"{BASE_URL}/api/harvest/scoring/badges")
        assert response.status_code == 200
        
        data = response.json()
        valid_rarities = ["common", "uncommon", "rare", "epic", "legendary"]
        for badge in data["badges"]:
            assert badge["rarity"] in valid_rarities


class TestDispositionPointsAwarding:
    """Test disposition changes award correct points"""
    
    def test_create_pin_and_update_not_home(self, api_client):
        """Test Not Home disposition awards 1 point"""
        # Create a new pin
        pin_response = api_client.post(
            f"{BASE_URL}/api/canvassing-map/pins",
            json={
                "latitude": 37.7749 + (uuid.uuid4().int % 1000) / 100000,
                "longitude": -122.4194 + (uuid.uuid4().int % 1000) / 100000,
                "address": f"TEST_NotHome_{uuid.uuid4().hex[:8]}",
                "disposition": "unmarked"
            }
        )
        assert pin_response.status_code == 200
        pin_id = pin_response.json()["id"]
        
        # Update to not_home
        update_response = api_client.patch(
            f"{BASE_URL}/api/canvassing-map/pins/{pin_id}",
            json={"disposition": "not_home"}
        )
        assert update_response.status_code == 200
        
        data = update_response.json()
        assert "points_earned" in data
        assert data["points_earned"] == 1  # Not Home = 1 point
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
    
    def test_callback_disposition_awards_5_points(self, api_client):
        """Test Callback disposition awards 5 points"""
        # Create a new pin
        pin_response = api_client.post(
            f"{BASE_URL}/api/canvassing-map/pins",
            json={
                "latitude": 37.7749 + (uuid.uuid4().int % 1000) / 100000,
                "longitude": -122.4194 + (uuid.uuid4().int % 1000) / 100000,
                "address": f"TEST_Callback_{uuid.uuid4().hex[:8]}",
                "disposition": "unmarked"
            }
        )
        assert pin_response.status_code == 200
        pin_id = pin_response.json()["id"]
        
        # Update to callback
        update_response = api_client.patch(
            f"{BASE_URL}/api/canvassing-map/pins/{pin_id}",
            json={"disposition": "callback"}
        )
        assert update_response.status_code == 200
        
        data = update_response.json()
        assert data["points_earned"] == 5  # Callback = 5 points
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
    
    def test_appointment_disposition_awards_10_points(self, api_client):
        """Test Appointment disposition awards 10 points"""
        # Create a new pin
        pin_response = api_client.post(
            f"{BASE_URL}/api/canvassing-map/pins",
            json={
                "latitude": 37.7749 + (uuid.uuid4().int % 1000) / 100000,
                "longitude": -122.4194 + (uuid.uuid4().int % 1000) / 100000,
                "address": f"TEST_Appointment_{uuid.uuid4().hex[:8]}",
                "disposition": "unmarked"
            }
        )
        assert pin_response.status_code == 200
        pin_id = pin_response.json()["id"]
        
        # Update to appointment
        update_response = api_client.patch(
            f"{BASE_URL}/api/canvassing-map/pins/{pin_id}",
            json={"disposition": "appointment"}
        )
        assert update_response.status_code == 200
        
        data = update_response.json()
        assert data["points_earned"] == 10  # Appointment = 10 points
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
    
    def test_signed_disposition_awards_50_points(self, api_client):
        """Test Signed disposition awards 50 points"""
        # Create a new pin
        pin_response = api_client.post(
            f"{BASE_URL}/api/canvassing-map/pins",
            json={
                "latitude": 37.7749 + (uuid.uuid4().int % 1000) / 100000,
                "longitude": -122.4194 + (uuid.uuid4().int % 1000) / 100000,
                "address": f"TEST_Signed_{uuid.uuid4().hex[:8]}",
                "disposition": "unmarked"
            }
        )
        assert pin_response.status_code == 200
        pin_id = pin_response.json()["id"]
        
        # Update to signed
        update_response = api_client.patch(
            f"{BASE_URL}/api/canvassing-map/pins/{pin_id}",
            json={"disposition": "signed"}
        )
        assert update_response.status_code == 200
        
        data = update_response.json()
        assert data["points_earned"] == 50  # Signed = 50 points
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
    
    def test_not_interested_disposition_awards_3_points(self, api_client):
        """Test Not Interested disposition awards 3 points (contact_made)"""
        # Create a new pin
        pin_response = api_client.post(
            f"{BASE_URL}/api/canvassing-map/pins",
            json={
                "latitude": 37.7749 + (uuid.uuid4().int % 1000) / 100000,
                "longitude": -122.4194 + (uuid.uuid4().int % 1000) / 100000,
                "address": f"TEST_NotInterested_{uuid.uuid4().hex[:8]}",
                "disposition": "unmarked"
            }
        )
        assert pin_response.status_code == 200
        pin_id = pin_response.json()["id"]
        
        # Update to not_interested
        update_response = api_client.patch(
            f"{BASE_URL}/api/canvassing-map/pins/{pin_id}",
            json={"disposition": "not_interested"}
        )
        assert update_response.status_code == 200
        
        data = update_response.json()
        assert data["points_earned"] == 3  # Not Interested = 3 points (contact_made)
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")


class TestLeaderboardMyRank:
    """Test leaderboard/me endpoint"""
    
    def test_get_my_rank(self, api_client):
        """Test getting current user's rank"""
        response = api_client.get(f"{BASE_URL}/api/harvest/scoring/leaderboard/me?period=day")
        assert response.status_code == 200
        
        data = response.json()
        assert "my_rank" in data
        assert "my_score" in data
        assert "nearby" in data
        assert "total_participants" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

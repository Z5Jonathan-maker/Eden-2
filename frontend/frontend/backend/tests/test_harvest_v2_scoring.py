"""
Test Harvest v2 Scoring Engine - Gamification Features
Tests: visit logging with points, streaks, badges, Daily Blitz, leaderboard, user stats
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://mycard-military.preview.emergentagent.com').rstrip('/')

class TestHarvestV2ScoringEngine:
    """Test the Harvest v2 Scoring Engine gamification features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        self.token = data.get("access_token")
        self.user_id = data.get("user", {}).get("id")
        self.user_name = data.get("user", {}).get("full_name", "Test User")
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        print(f"✓ Logged in as {self.user_name} (ID: {self.user_id})")
    
    # ============================================
    # 1. BADGES ENDPOINT
    # ============================================
    
    def test_get_badges(self):
        """Test GET /api/harvest/v2/badges - Get all badges with user's earned status"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/badges")
        
        assert response.status_code == 200, f"Failed to get badges: {response.text}"
        
        data = response.json()
        assert "badges" in data, "Response should contain 'badges' array"
        assert "earned_count" in data, "Response should contain 'earned_count'"
        assert "total_count" in data, "Response should contain 'total_count'"
        
        badges = data["badges"]
        assert len(badges) > 0, "Should have at least one badge defined"
        
        # Check badge structure
        badge = badges[0]
        assert "id" in badge, "Badge should have 'id'"
        assert "name" in badge, "Badge should have 'name'"
        assert "icon" in badge, "Badge should have 'icon'"
        assert "description" in badge, "Badge should have 'description'"
        assert "earned" in badge, "Badge should have 'earned' flag"
        
        print(f"✓ Badges endpoint working - {data['total_count']} badges defined, {data['earned_count']} earned")
        print(f"  Sample badges: {[b['name'] for b in badges[:3]]}")
    
    def test_get_badge_definitions(self):
        """Test GET /api/harvest/v2/badges/definitions - Public badge definitions"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/badges/definitions")
        
        assert response.status_code == 200, f"Failed to get badge definitions: {response.text}"
        
        data = response.json()
        assert "badges" in data, "Response should contain 'badges' array"
        
        badges = data["badges"]
        assert len(badges) >= 8, "Should have at least 8 badge definitions"
        
        # Check for expected badges
        badge_ids = [b["id"] for b in badges]
        expected_badges = ["first_fruits", "ten_doors_down", "on_fire", "closer"]
        for expected in expected_badges:
            assert expected in badge_ids, f"Missing expected badge: {expected}"
        
        print(f"✓ Badge definitions endpoint working - {len(badges)} badges defined")
    
    # ============================================
    # 2. DAILY BLITZ ENDPOINT
    # ============================================
    
    def test_get_daily_blitz(self):
        """Test GET /api/harvest/v2/daily-blitz - Get today's Daily Blitz challenge"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/daily-blitz")
        
        assert response.status_code == 200, f"Failed to get Daily Blitz: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert "title" in data, "Response should contain 'title'"
        assert "description" in data, "Response should contain 'description'"
        assert "metric" in data, "Response should contain 'metric'"
        assert "standings" in data, "Response should contain 'standings'"
        
        assert data["metric"] == "doors", "Daily Blitz metric should be 'doors'"
        assert "Daily Blitz" in data["title"], "Title should contain 'Daily Blitz'"
        
        print(f"✓ Daily Blitz endpoint working - {data['title']}")
        print(f"  Standings: {len(data['standings'])} participants")
    
    # ============================================
    # 3. USER STATS ENDPOINT
    # ============================================
    
    def test_get_my_stats(self):
        """Test GET /api/harvest/v2/stats/me - Get current user's comprehensive stats"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/stats/me")
        
        assert response.status_code == 200, f"Failed to get user stats: {response.text}"
        
        data = response.json()
        assert "user_id" in data, "Response should contain 'user_id'"
        assert "all_time" in data, "Response should contain 'all_time' stats"
        assert "today" in data, "Response should contain 'today' stats"
        assert "this_week" in data, "Response should contain 'this_week' stats"
        assert "streak" in data, "Response should contain 'streak'"
        assert "multiplier" in data, "Response should contain 'multiplier'"
        
        # Check all_time structure
        all_time = data["all_time"]
        assert "total_points" in all_time or all_time == {}, "all_time should have 'total_points' or be empty"
        
        print(f"✓ User stats endpoint working")
        print(f"  Streak: {data['streak']} days, Multiplier: {data['multiplier']}x")
        print(f"  All-time: {all_time}")
    
    # ============================================
    # 4. LEADERBOARD ENDPOINTS
    # ============================================
    
    def test_get_leaderboard_v2(self):
        """Test GET /api/harvest/v2/leaderboard-v2 - Enhanced leaderboard with streaks"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/leaderboard-v2?period=week&metric=points")
        
        assert response.status_code == 200, f"Failed to get leaderboard v2: {response.text}"
        
        data = response.json()
        assert "entries" in data, "Response should contain 'entries'"
        assert "metric" in data, "Response should contain 'metric'"
        assert "period" in data, "Response should contain 'period'"
        
        print(f"✓ Leaderboard v2 endpoint working - {len(data['entries'])} entries")
        if data['entries']:
            print(f"  Top entry: {data['entries'][0]}")
    
    def test_get_leaderboard_original(self):
        """Test GET /api/harvest/v2/leaderboard - Original leaderboard endpoint"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/leaderboard?period=week")
        
        assert response.status_code == 200, f"Failed to get leaderboard: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ Original leaderboard endpoint working - {len(data)} entries")
    
    # ============================================
    # 5. CANVASSING MAP STATS & LEADERBOARD
    # ============================================
    
    def test_canvassing_map_stats(self):
        """Test GET /api/canvassing-map/stats - User stats for footer display"""
        response = self.session.get(f"{BASE_URL}/api/canvassing-map/stats")
        
        assert response.status_code == 200, f"Failed to get canvassing stats: {response.text}"
        
        data = response.json()
        assert "today" in data, "Response should contain 'today'"
        assert "week" in data, "Response should contain 'week'"
        assert "signed" in data, "Response should contain 'signed'"
        assert "appointments" in data, "Response should contain 'appointments'"
        
        print(f"✓ Canvassing map stats endpoint working")
        print(f"  Today: {data['today']}, Week: {data['week']}, Signed: {data['signed']}")
    
    def test_canvassing_map_leaderboard(self):
        """Test GET /api/canvassing-map/leaderboard - Leaderboard for HarvestPage"""
        response = self.session.get(f"{BASE_URL}/api/canvassing-map/leaderboard?period=week")
        
        assert response.status_code == 200, f"Failed to get canvassing leaderboard: {response.text}"
        
        data = response.json()
        assert "leaderboard" in data, "Response should contain 'leaderboard'"
        assert "period" in data, "Response should contain 'period'"
        
        print(f"✓ Canvassing map leaderboard endpoint working - {len(data['leaderboard'])} entries")
    
    # ============================================
    # 6. VISIT LOGGING WITH SCORING
    # ============================================
    
    def test_create_pin_and_log_visit(self):
        """Test full flow: create pin -> log visit -> verify points awarded"""
        # First create a pin
        pin_response = self.session.post(f"{BASE_URL}/api/canvassing-map/pins", json={
            "latitude": 25.7617,
            "longitude": -80.1918,
            "address": "TEST_123 Test Street, Miami, FL",
            "disposition": "unmarked"
        })
        
        assert pin_response.status_code == 200, f"Failed to create pin: {pin_response.text}"
        pin_data = pin_response.json()
        pin_id = pin_data["id"]
        print(f"✓ Created test pin: {pin_id}")
        
        # Now log a visit using harvest v2 endpoint
        visit_response = self.session.post(f"{BASE_URL}/api/harvest/v2/visits", json={
            "pin_id": pin_id,
            "status": "NH",  # Not Home
            "lat": 25.7617,
            "lng": -80.1918,
            "notes": "TEST visit for scoring engine"
        })
        
        assert visit_response.status_code == 200, f"Failed to log visit: {visit_response.text}"
        visit_data = visit_response.json()
        
        # Verify scoring result
        assert "points_earned" in visit_data, "Visit response should contain 'points_earned'"
        assert "base_points" in visit_data, "Visit response should contain 'base_points'"
        assert "multiplier" in visit_data, "Visit response should contain 'multiplier'"
        assert "streak" in visit_data, "Visit response should contain 'streak'"
        
        print(f"✓ Visit logged with scoring:")
        print(f"  Points earned: {visit_data['points_earned']}")
        print(f"  Base points: {visit_data['base_points']}")
        print(f"  Multiplier: {visit_data['multiplier']}x")
        print(f"  Streak: {visit_data['streak']} days")
        
        # Cleanup - delete the test pin
        delete_response = self.session.delete(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
        assert delete_response.status_code == 200, f"Failed to delete test pin: {delete_response.text}"
        print(f"✓ Cleaned up test pin")
    
    def test_visit_with_appointment_status(self):
        """Test visit logging with AP (Appointment) status - higher points"""
        # Create a pin
        pin_response = self.session.post(f"{BASE_URL}/api/canvassing-map/pins", json={
            "latitude": 25.7618,
            "longitude": -80.1919,
            "address": "TEST_456 Appointment Street, Miami, FL",
            "disposition": "unmarked"
        })
        
        assert pin_response.status_code == 200, f"Failed to create pin: {pin_response.text}"
        pin_id = pin_response.json()["id"]
        
        # Log visit with AP status
        visit_response = self.session.post(f"{BASE_URL}/api/harvest/v2/visits", json={
            "pin_id": pin_id,
            "status": "AP",  # Appointment
            "lat": 25.7618,
            "lng": -80.1919,
            "notes": "TEST appointment set"
        })
        
        assert visit_response.status_code == 200, f"Failed to log visit: {visit_response.text}"
        visit_data = visit_response.json()
        
        # AP should give 10 base points
        assert visit_data["base_points"] == 10, f"AP should give 10 base points, got {visit_data['base_points']}"
        
        print(f"✓ Appointment visit logged - {visit_data['points_earned']} points earned")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
    
    def test_visit_with_signed_status(self):
        """Test visit logging with SG (Signed) status - highest points"""
        # Create a pin
        pin_response = self.session.post(f"{BASE_URL}/api/canvassing-map/pins", json={
            "latitude": 25.7619,
            "longitude": -80.1920,
            "address": "TEST_789 Signed Street, Miami, FL",
            "disposition": "unmarked"
        })
        
        assert pin_response.status_code == 200, f"Failed to create pin: {pin_response.text}"
        pin_id = pin_response.json()["id"]
        
        # Log visit with SG status
        visit_response = self.session.post(f"{BASE_URL}/api/harvest/v2/visits", json={
            "pin_id": pin_id,
            "status": "SG",  # Signed
            "lat": 25.7619,
            "lng": -80.1920,
            "notes": "TEST contract signed"
        })
        
        assert visit_response.status_code == 200, f"Failed to log visit: {visit_response.text}"
        visit_data = visit_response.json()
        
        # SG should give 50 base points
        assert visit_data["base_points"] == 50, f"SG should give 50 base points, got {visit_data['base_points']}"
        
        print(f"✓ Signed visit logged - {visit_data['points_earned']} points earned")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
    
    # ============================================
    # 7. COMPETITIONS
    # ============================================
    
    def test_get_active_competitions(self):
        """Test GET /api/harvest/v2/competitions/active - Get active competitions"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/competitions/active")
        
        assert response.status_code == 200, f"Failed to get active competitions: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ Active competitions endpoint working - {len(data)} active competitions")
        if data:
            print(f"  First competition: {data[0].get('name', data[0].get('title', 'Unknown'))}")
    
    def test_get_competitions(self):
        """Test GET /api/harvest/v2/competitions - Get all competitions"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/competitions")
        
        assert response.status_code == 200, f"Failed to get competitions: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        print(f"✓ Competitions endpoint working - {len(data)} competitions")
    
    # ============================================
    # 8. PROFILE
    # ============================================
    
    def test_get_harvest_profile(self):
        """Test GET /api/harvest/v2/profile/{user_id} - Get user's Harvest profile"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/profile/{self.user_id}")
        
        assert response.status_code == 200, f"Failed to get profile: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response should contain 'user'"
        assert "stats" in data, "Response should contain 'stats'"
        assert "badges" in data, "Response should contain 'badges'"
        
        stats = data["stats"]
        assert "total_doors" in stats, "Stats should contain 'total_doors'"
        assert "total_points" in stats, "Stats should contain 'total_points'"
        
        print(f"✓ Profile endpoint working")
        print(f"  Total doors: {stats['total_doors']}, Total points: {stats['total_points']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

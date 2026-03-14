"""
Test Harvest Challenges Tab API Endpoints
Tests for: GET /api/harvest/challenges, POST /api/harvest/challenges/seed, GET /api/harvest/campaigns
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHarvestChallengesTab:
    """Test Harvest Challenges Tab API endpoints"""
    
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
        self.user_id = login_response.json().get("user", {}).get("id")
    
    # ============================================
    # CHALLENGES SEED ENDPOINT
    # ============================================
    
    def test_seed_challenges_creates_4_challenges(self):
        """POST /api/harvest/challenges/seed creates 4 test challenges"""
        response = self.session.post(f"{BASE_URL}/api/harvest/challenges/seed")
        
        assert response.status_code == 200, f"Seed failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "Seeded 4 test challenges" in data["message"]
        assert "challenges" in data
        assert len(data["challenges"]) == 4
        
        # Verify challenge names
        challenge_names = [c["name"] for c in data["challenges"]]
        assert "Daily Door Sprint" in challenge_names
        assert "Early Bird Special" in challenge_names
        assert "Appointment Ace" in challenge_names
        assert "Weekend Warrior" in challenge_names
    
    def test_seed_challenges_returns_challenge_ids(self):
        """POST /api/harvest/challenges/seed returns challenge IDs"""
        response = self.session.post(f"{BASE_URL}/api/harvest/challenges/seed")
        
        assert response.status_code == 200
        data = response.json()
        
        for challenge in data["challenges"]:
            assert "id" in challenge
            assert "name" in challenge
            assert "state" in challenge
            assert len(challenge["id"]) > 0
    
    # ============================================
    # GET CHALLENGES ENDPOINT
    # ============================================
    
    def test_get_challenges_returns_4_challenges(self):
        """GET /api/harvest/challenges returns 4 seeded challenges"""
        # First seed challenges
        self.session.post(f"{BASE_URL}/api/harvest/challenges/seed")
        
        # Then get challenges
        response = self.session.get(f"{BASE_URL}/api/harvest/challenges?include_completed=true")
        
        assert response.status_code == 200, f"Get challenges failed: {response.text}"
        data = response.json()
        
        assert "challenges" in data
        assert len(data["challenges"]) == 4
    
    def test_get_challenges_has_required_fields(self):
        """GET /api/harvest/challenges returns challenges with all required fields"""
        response = self.session.get(f"{BASE_URL}/api/harvest/challenges?include_completed=true")
        
        assert response.status_code == 200
        data = response.json()
        
        for challenge in data["challenges"]:
            # Required fields
            assert "id" in challenge
            assert "name" in challenge
            assert "description" in challenge
            assert "icon" in challenge
            assert "state" in challenge
            assert "current_progress" in challenge
            assert "requirement_value" in challenge
            assert "points_reward" in challenge
            assert "time_remaining_display" in challenge
    
    def test_get_challenges_daily_door_sprint(self):
        """GET /api/harvest/challenges returns Daily Door Sprint with correct data"""
        response = self.session.get(f"{BASE_URL}/api/harvest/challenges?include_completed=true")
        
        assert response.status_code == 200
        data = response.json()
        
        daily_sprint = next((c for c in data["challenges"] if c["name"] == "Daily Door Sprint"), None)
        assert daily_sprint is not None, "Daily Door Sprint challenge not found"
        
        assert daily_sprint["description"] == "Knock 25 doors today to earn bonus points"
        assert daily_sprint["requirement_value"] == 25
        assert daily_sprint["points_reward"] == 50
        assert daily_sprint["state"] in ["in_progress", "completed"]
    
    def test_get_challenges_early_bird_special(self):
        """GET /api/harvest/challenges returns Early Bird Special with correct data"""
        response = self.session.get(f"{BASE_URL}/api/harvest/challenges?include_completed=true")
        
        assert response.status_code == 200
        data = response.json()
        
        early_bird = next((c for c in data["challenges"] if c["name"] == "Early Bird Special"), None)
        assert early_bird is not None, "Early Bird Special challenge not found"
        
        assert early_bird["description"] == "Log 10 doors before noon"
        assert early_bird["requirement_value"] == 10
        assert early_bird["points_reward"] == 30
        assert early_bird["current_progress"] >= 0
    
    def test_get_challenges_appointment_ace(self):
        """GET /api/harvest/challenges returns Appointment Ace with correct data"""
        response = self.session.get(f"{BASE_URL}/api/harvest/challenges?include_completed=true")
        
        assert response.status_code == 200
        data = response.json()
        
        appt_ace = next((c for c in data["challenges"] if c["name"] == "Appointment Ace"), None)
        assert appt_ace is not None, "Appointment Ace challenge not found"
        
        assert appt_ace["description"] == "Set 3 appointments today"
        assert appt_ace["requirement_value"] == 3
        assert appt_ace["points_reward"] == 75
    
    def test_get_challenges_weekend_warrior(self):
        """GET /api/harvest/challenges returns Weekend Warrior with correct data"""
        response = self.session.get(f"{BASE_URL}/api/harvest/challenges?include_completed=true")
        
        assert response.status_code == 200
        data = response.json()
        
        weekend = next((c for c in data["challenges"] if c["name"] == "Weekend Warrior"), None)
        assert weekend is not None, "Weekend Warrior challenge not found"
        
        assert weekend["description"] == "Complete 100 doors this weekend"
        assert weekend["requirement_value"] == 100
        assert weekend["points_reward"] == 150
    
    def test_get_challenges_progress_bars(self):
        """GET /api/harvest/challenges returns progress data for progress bars"""
        response = self.session.get(f"{BASE_URL}/api/harvest/challenges?include_completed=true")
        
        assert response.status_code == 200
        data = response.json()
        
        for challenge in data["challenges"]:
            # Progress bar data
            assert "current_progress" in challenge
            assert "requirement_value" in challenge
            assert isinstance(challenge["current_progress"], (int, float))
            assert isinstance(challenge["requirement_value"], (int, float))
            assert challenge["requirement_value"] > 0
            
            # Calculate percentage
            progress_percent = (challenge["current_progress"] / challenge["requirement_value"]) * 100
            assert 0 <= progress_percent <= 100 or progress_percent > 100  # Can exceed 100%
    
    def test_get_challenges_time_remaining(self):
        """GET /api/harvest/challenges returns time_remaining_display"""
        response = self.session.get(f"{BASE_URL}/api/harvest/challenges?include_completed=true")
        
        assert response.status_code == 200
        data = response.json()
        
        for challenge in data["challenges"]:
            assert "time_remaining_display" in challenge
            # Should be like "5h 10m", "1d 23h", or "Ended"
            time_display = challenge["time_remaining_display"]
            assert isinstance(time_display, str)
            assert len(time_display) > 0
    
    def test_get_challenges_points_reward(self):
        """GET /api/harvest/challenges returns points_reward for each challenge"""
        response = self.session.get(f"{BASE_URL}/api/harvest/challenges?include_completed=true")
        
        assert response.status_code == 200
        data = response.json()
        
        expected_points = {
            "Daily Door Sprint": 50,
            "Early Bird Special": 30,
            "Appointment Ace": 75,
            "Weekend Warrior": 150
        }
        
        for challenge in data["challenges"]:
            assert "points_reward" in challenge
            assert challenge["points_reward"] > 0
            
            if challenge["name"] in expected_points:
                assert challenge["points_reward"] == expected_points[challenge["name"]]
    
    def test_get_challenges_state_values(self):
        """GET /api/harvest/challenges returns valid state values"""
        response = self.session.get(f"{BASE_URL}/api/harvest/challenges?include_completed=true")
        
        assert response.status_code == 200
        data = response.json()
        
        valid_states = ["locked", "in_progress", "completed", "claimed", "expired"]
        
        for challenge in data["challenges"]:
            assert "state" in challenge
            assert challenge["state"] in valid_states
    
    # ============================================
    # CAMPAIGNS ENDPOINT
    # ============================================
    
    def test_get_campaigns_returns_active_campaign(self):
        """GET /api/harvest/campaigns returns active campaign"""
        response = self.session.get(f"{BASE_URL}/api/harvest/campaigns")
        
        assert response.status_code == 200, f"Get campaigns failed: {response.text}"
        data = response.json()
        
        assert "campaigns" in data
        assert len(data["campaigns"]) >= 1
    
    def test_get_campaigns_weekend_door_blitz(self):
        """GET /api/harvest/campaigns returns Weekend Door Blitz campaign"""
        response = self.session.get(f"{BASE_URL}/api/harvest/campaigns")
        
        assert response.status_code == 200
        data = response.json()
        
        # Find Weekend Door Blitz campaign
        blitz = next((c for c in data["campaigns"] if c["name"] == "Weekend Door Blitz"), None)
        assert blitz is not None, "Weekend Door Blitz campaign not found"
        
        assert blitz["description"] == "Hit 50 doors by Sunday for bonus points!"
        assert blitz["goal_type"] == "doors"
        assert blitz["target_value"] == 50
        assert blitz["status"] == "active"
    
    def test_get_campaigns_time_remaining(self):
        """GET /api/harvest/campaigns returns time_remaining"""
        response = self.session.get(f"{BASE_URL}/api/harvest/campaigns")
        
        assert response.status_code == 200
        data = response.json()
        
        for campaign in data["campaigns"]:
            assert "time_remaining" in campaign
            # Should be like "4d 5h"
            assert isinstance(campaign["time_remaining"], str)
            assert len(campaign["time_remaining"]) > 0
    
    def test_get_campaigns_has_required_fields(self):
        """GET /api/harvest/campaigns returns campaigns with required fields"""
        response = self.session.get(f"{BASE_URL}/api/harvest/campaigns")
        
        assert response.status_code == 200
        data = response.json()
        
        for campaign in data["campaigns"]:
            assert "id" in campaign
            assert "name" in campaign
            assert "description" in campaign
            assert "goal_type" in campaign
            assert "target_value" in campaign
            assert "status" in campaign
            assert "time_remaining" in campaign
            assert "icon" in campaign
    
    def test_get_campaigns_progress_fields(self):
        """GET /api/harvest/campaigns returns progress fields"""
        response = self.session.get(f"{BASE_URL}/api/harvest/campaigns")
        
        assert response.status_code == 200
        data = response.json()
        
        for campaign in data["campaigns"]:
            assert "my_progress" in campaign
            assert "my_percent" in campaign
            assert "participant_count" in campaign
            assert isinstance(campaign["my_progress"], (int, float))
            assert isinstance(campaign["my_percent"], (int, float))
    
    # ============================================
    # AUTHENTICATION TESTS
    # ============================================
    
    def test_get_challenges_requires_auth(self):
        """GET /api/harvest/challenges requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/harvest/challenges")
        
        assert response.status_code in [401, 403]
    
    def test_seed_challenges_requires_auth(self):
        """POST /api/harvest/challenges/seed requires authentication"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/harvest/challenges/seed")
        
        assert response.status_code in [401, 403]
    
    def test_get_campaigns_requires_auth(self):
        """GET /api/harvest/campaigns requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/harvest/campaigns")
        
        assert response.status_code in [401, 403]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

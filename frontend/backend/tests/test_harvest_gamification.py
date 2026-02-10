"""
Test Harvest Gamification Features
- Progress ring with doors/goal
- Streak flame indicator with multipliers
- Stats grid (Doors, Appts, Signed, Points)
- Today's Challenges from /api/harvest/challenges
- Profile tab with total points and streak badge
- Badge collection with tier filters (All, Legendary, Epic, Rare, Common)
- Badge count (earned/total)
- This Week stats grid
- Backend APIs: /api/harvest/streak, /api/harvest/challenges, /api/harvest/badges/tiers, /api/harvest/progress/rewards
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestHarvestGamificationAPIs:
    """Test Harvest Gamification Backend APIs"""
    
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
        assert token, "No access token received"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.token = token
    
    # ============================================
    # STREAK API TESTS
    # ============================================
    
    def test_get_streak_returns_200(self):
        """Test GET /api/harvest/streak returns 200"""
        response = self.session.get(f"{BASE_URL}/api/harvest/streak")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_get_streak_has_required_fields(self):
        """Test streak response has all required fields"""
        response = self.session.get(f"{BASE_URL}/api/harvest/streak")
        assert response.status_code == 200
        
        data = response.json()
        required_fields = [
            "current_streak",
            "best_streak", 
            "multiplier",
            "has_activity_today",
            "is_at_risk",
            "is_critical",
            "doors_today",
            "minimum_doors_required"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
    
    def test_streak_multiplier_is_valid(self):
        """Test streak multiplier is a valid value"""
        response = self.session.get(f"{BASE_URL}/api/harvest/streak")
        assert response.status_code == 200
        
        data = response.json()
        multiplier = data.get("multiplier")
        
        # Valid multipliers: 1.0, 1.1, 1.25, 1.5, 2.0
        valid_multipliers = [1.0, 1.1, 1.25, 1.5, 2.0]
        assert multiplier in valid_multipliers, f"Invalid multiplier: {multiplier}"
    
    def test_streak_current_value(self):
        """Test current streak value is correct"""
        response = self.session.get(f"{BASE_URL}/api/harvest/streak")
        assert response.status_code == 200
        
        data = response.json()
        assert data["current_streak"] >= 0, "Current streak should be >= 0"
        assert data["best_streak"] >= data["current_streak"], "Best streak should be >= current streak"
    
    def test_streak_doors_today(self):
        """Test doors_today is returned correctly"""
        response = self.session.get(f"{BASE_URL}/api/harvest/streak")
        assert response.status_code == 200
        
        data = response.json()
        assert "doors_today" in data
        assert isinstance(data["doors_today"], int)
        assert data["doors_today"] >= 0
    
    # ============================================
    # CHALLENGES API TESTS
    # ============================================
    
    def test_get_challenges_returns_200(self):
        """Test GET /api/harvest/challenges returns 200"""
        response = self.session.get(f"{BASE_URL}/api/harvest/challenges")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_get_challenges_has_challenges_array(self):
        """Test challenges response has challenges array"""
        response = self.session.get(f"{BASE_URL}/api/harvest/challenges")
        assert response.status_code == 200
        
        data = response.json()
        assert "challenges" in data, "Response should have 'challenges' field"
        assert isinstance(data["challenges"], list), "challenges should be a list"
    
    def test_challenges_include_completed_param(self):
        """Test challenges endpoint accepts include_completed parameter"""
        response = self.session.get(f"{BASE_URL}/api/harvest/challenges?include_completed=true")
        assert response.status_code == 200
        
        data = response.json()
        assert "challenges" in data
    
    # ============================================
    # BADGES TIERS API TESTS
    # ============================================
    
    def test_get_badges_tiers_returns_200(self):
        """Test GET /api/harvest/badges/tiers returns 200"""
        response = self.session.get(f"{BASE_URL}/api/harvest/badges/tiers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_badges_tiers_has_required_structure(self):
        """Test badges tiers response has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/harvest/badges/tiers")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields
        assert "badges_by_tier" in data, "Missing badges_by_tier"
        assert "earned_count" in data, "Missing earned_count"
        assert "total_count" in data, "Missing total_count"
        assert "tier_counts" in data, "Missing tier_counts"
    
    def test_badges_tiers_has_all_tiers(self):
        """Test badges_by_tier has all 4 tiers"""
        response = self.session.get(f"{BASE_URL}/api/harvest/badges/tiers")
        assert response.status_code == 200
        
        data = response.json()
        badges_by_tier = data.get("badges_by_tier", {})
        
        required_tiers = ["common", "rare", "epic", "legendary"]
        for tier in required_tiers:
            assert tier in badges_by_tier, f"Missing tier: {tier}"
            assert isinstance(badges_by_tier[tier], list), f"{tier} should be a list"
    
    def test_badges_earned_count_matches(self):
        """Test earned_count matches actual earned badges"""
        response = self.session.get(f"{BASE_URL}/api/harvest/badges/tiers")
        assert response.status_code == 200
        
        data = response.json()
        badges_by_tier = data.get("badges_by_tier", {})
        
        # Count earned badges across all tiers
        earned_count = 0
        for tier, badges in badges_by_tier.items():
            for badge in badges:
                if badge.get("earned"):
                    earned_count += 1
        
        assert data["earned_count"] == earned_count, f"earned_count mismatch: {data['earned_count']} vs {earned_count}"
    
    def test_badges_total_count_matches(self):
        """Test total_count matches actual total badges"""
        response = self.session.get(f"{BASE_URL}/api/harvest/badges/tiers")
        assert response.status_code == 200
        
        data = response.json()
        badges_by_tier = data.get("badges_by_tier", {})
        
        # Count total badges across all tiers
        total_count = sum(len(badges) for badges in badges_by_tier.values())
        
        assert data["total_count"] == total_count, f"total_count mismatch: {data['total_count']} vs {total_count}"
    
    def test_badge_has_required_fields(self):
        """Test each badge has required fields"""
        response = self.session.get(f"{BASE_URL}/api/harvest/badges/tiers")
        assert response.status_code == 200
        
        data = response.json()
        badges_by_tier = data.get("badges_by_tier", {})
        
        required_fields = ["id", "name", "description", "earned"]
        
        for tier, badges in badges_by_tier.items():
            for badge in badges:
                for field in required_fields:
                    assert field in badge, f"Badge missing field '{field}': {badge}"
    
    # ============================================
    # REWARDS PROGRESS API TESTS
    # ============================================
    
    def test_get_rewards_progress_returns_200(self):
        """Test GET /api/harvest/progress/rewards returns 200"""
        response = self.session.get(f"{BASE_URL}/api/harvest/progress/rewards")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_rewards_progress_has_required_fields(self):
        """Test rewards progress response has required fields"""
        response = self.session.get(f"{BASE_URL}/api/harvest/progress/rewards")
        assert response.status_code == 200
        
        data = response.json()
        
        assert "current_points" in data, "Missing current_points"
        assert "rewards_progress" in data, "Missing rewards_progress"
        assert isinstance(data["rewards_progress"], list), "rewards_progress should be a list"
    
    def test_rewards_progress_item_structure(self):
        """Test each reward progress item has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/harvest/progress/rewards")
        assert response.status_code == 200
        
        data = response.json()
        rewards_progress = data.get("rewards_progress", [])
        
        if rewards_progress:
            required_fields = [
                "reward_id",
                "name",
                "points_required",
                "points_remaining",
                "percent_complete",
                "can_redeem"
            ]
            
            for reward in rewards_progress:
                for field in required_fields:
                    assert field in reward, f"Reward missing field '{field}': {reward}"
    
    def test_rewards_progress_next_reward(self):
        """Test next_reward is returned when applicable"""
        response = self.session.get(f"{BASE_URL}/api/harvest/progress/rewards")
        assert response.status_code == 200
        
        data = response.json()
        
        # next_reward should be present if there are rewards user can't afford yet
        if data.get("rewards_progress"):
            unaffordable = [r for r in data["rewards_progress"] if not r.get("can_redeem")]
            if unaffordable:
                assert "next_reward" in data, "next_reward should be present when there are unaffordable rewards"
    
    def test_rewards_progress_percent_calculation(self):
        """Test percent_complete is calculated correctly"""
        response = self.session.get(f"{BASE_URL}/api/harvest/progress/rewards")
        assert response.status_code == 200
        
        data = response.json()
        current_points = data.get("current_points", 0)
        rewards_progress = data.get("rewards_progress", [])
        
        for reward in rewards_progress:
            expected_percent = min(100, round(current_points / reward["points_required"] * 100, 1))
            actual_percent = reward["percent_complete"]
            
            # Allow small floating point differences
            assert abs(expected_percent - actual_percent) < 0.5, \
                f"Percent mismatch for {reward['name']}: expected {expected_percent}, got {actual_percent}"
    
    # ============================================
    # CANVASSING STATS API TESTS
    # ============================================
    
    def test_get_canvassing_stats_returns_200(self):
        """Test GET /api/canvassing-map/stats returns 200"""
        response = self.session.get(f"{BASE_URL}/api/canvassing-map/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_canvassing_stats_has_required_fields(self):
        """Test canvassing stats has required fields for Today tab"""
        response = self.session.get(f"{BASE_URL}/api/canvassing-map/stats")
        assert response.status_code == 200
        
        data = response.json()
        
        # Fields needed for Today tab stats grid
        required_fields = ["today", "week", "signed", "appointments", "total_points"]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
    
    def test_canvassing_stats_values_are_valid(self):
        """Test canvassing stats values are valid numbers"""
        response = self.session.get(f"{BASE_URL}/api/canvassing-map/stats")
        assert response.status_code == 200
        
        data = response.json()
        
        assert isinstance(data.get("today"), int), "today should be int"
        assert isinstance(data.get("week"), int), "week should be int"
        assert isinstance(data.get("signed"), int), "signed should be int"
        assert isinstance(data.get("appointments"), int), "appointments should be int"
        assert isinstance(data.get("total_points"), int), "total_points should be int"
        
        assert data["today"] >= 0, "today should be >= 0"
        assert data["week"] >= data["today"], "week should be >= today"
    
    # ============================================
    # CAMPAIGNS API TESTS
    # ============================================
    
    def test_get_campaigns_returns_200(self):
        """Test GET /api/harvest/campaigns returns 200"""
        response = self.session.get(f"{BASE_URL}/api/harvest/campaigns")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_campaigns_has_campaigns_array(self):
        """Test campaigns response has campaigns array"""
        response = self.session.get(f"{BASE_URL}/api/harvest/campaigns")
        assert response.status_code == 200
        
        data = response.json()
        assert "campaigns" in data, "Response should have 'campaigns' field"
        assert isinstance(data["campaigns"], list), "campaigns should be a list"
    
    # ============================================
    # AUTHENTICATION TESTS
    # ============================================
    
    def test_streak_requires_auth(self):
        """Test streak endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/harvest/streak")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_challenges_requires_auth(self):
        """Test challenges endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/harvest/challenges")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_badges_tiers_requires_auth(self):
        """Test badges/tiers endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/harvest/badges/tiers")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_rewards_progress_requires_auth(self):
        """Test progress/rewards endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/harvest/progress/rewards")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestHarvestGamificationDataIntegrity:
    """Test data integrity across Harvest Gamification APIs"""
    
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
        assert login_response.status_code == 200
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_points_consistent_across_endpoints(self):
        """Test user points are consistent across different endpoints"""
        # Get points from rewards progress
        rewards_response = self.session.get(f"{BASE_URL}/api/harvest/progress/rewards")
        assert rewards_response.status_code == 200
        rewards_points = rewards_response.json().get("current_points", 0)
        
        # Get points from canvassing stats
        stats_response = self.session.get(f"{BASE_URL}/api/canvassing-map/stats")
        assert stats_response.status_code == 200
        stats_points = stats_response.json().get("total_points", 0)
        
        assert rewards_points == stats_points, \
            f"Points mismatch: rewards={rewards_points}, stats={stats_points}"
    
    def test_streak_consistent_across_endpoints(self):
        """Test streak data is consistent across endpoints"""
        # Get streak from streak endpoint
        streak_response = self.session.get(f"{BASE_URL}/api/harvest/streak")
        assert streak_response.status_code == 200
        streak_data = streak_response.json()
        
        # Get streak from canvassing stats
        stats_response = self.session.get(f"{BASE_URL}/api/canvassing-map/stats")
        assert stats_response.status_code == 200
        stats_data = stats_response.json()
        
        assert streak_data["current_streak"] == stats_data.get("streak", 0), \
            f"Streak mismatch: streak_endpoint={streak_data['current_streak']}, stats={stats_data.get('streak')}"
    
    def test_doors_today_consistent(self):
        """Test doors_today is consistent across endpoints"""
        # Get doors from streak endpoint
        streak_response = self.session.get(f"{BASE_URL}/api/harvest/streak")
        assert streak_response.status_code == 200
        streak_doors = streak_response.json().get("doors_today", 0)
        
        # Get doors from canvassing stats
        stats_response = self.session.get(f"{BASE_URL}/api/canvassing-map/stats")
        assert stats_response.status_code == 200
        stats_doors = stats_response.json().get("today", 0)
        
        assert streak_doors == stats_doors, \
            f"Doors today mismatch: streak={streak_doors}, stats={stats_doors}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

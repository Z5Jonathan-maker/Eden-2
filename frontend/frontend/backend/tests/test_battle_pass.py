"""
Battle Pass API Tests
Tests for the Battle Pass progression system endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@eden.com"
TEST_PASSWORD = "password"


class TestBattlePassPublic:
    """Tests for public Battle Pass endpoints"""
    
    def test_get_season_info(self):
        """Test GET /api/battle-pass/season - returns season info and tiers"""
        response = requests.get(f"{BASE_URL}/api/battle-pass/season")
        assert response.status_code == 200
        
        data = response.json()
        # Verify season structure
        assert "season" in data
        assert "tiers" in data
        assert "total_tiers" in data
        
        # Verify season details
        season = data["season"]
        assert season["id"] == "season_1"
        assert season["name"] == "Season 1: Field Commander"
        assert season["max_tier"] == 50
        
        # Verify tiers exist
        assert len(data["tiers"]) > 0
        
        # Verify first tier structure
        first_tier = data["tiers"][0]
        assert first_tier["tier"] == 1
        assert first_tier["xp_required"] == 0
        assert first_tier["reward_name"] == "Recruit"
        assert first_tier["rarity"] == "common"


class TestBattlePassAuthenticated:
    """Tests for authenticated Battle Pass endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token") or data.get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_get_user_progress(self):
        """Test GET /api/battle-pass/progress - returns user's battle pass progress"""
        response = requests.get(
            f"{BASE_URL}/api/battle-pass/progress",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify progress structure
        assert "user_id" in data
        assert "season_id" in data
        assert "current_xp" in data
        assert "current_tier" in data
        assert "tier_progress_percent" in data
        assert "season" in data
        
        # Verify data types
        assert isinstance(data["current_xp"], int)
        assert isinstance(data["current_tier"], int)
        assert data["current_tier"] >= 1
        assert 0 <= data["tier_progress_percent"] <= 100
    
    def test_get_missions(self):
        """Test GET /api/battle-pass/missions - returns daily and weekly missions"""
        response = requests.get(
            f"{BASE_URL}/api/battle-pass/missions",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify missions structure
        assert "daily_missions" in data
        assert "weekly_missions" in data
        assert "daily_reset" in data
        assert "weekly_reset" in data
        
        # Verify daily missions
        assert isinstance(data["daily_missions"], list)
        if len(data["daily_missions"]) > 0:
            mission = data["daily_missions"][0]
            assert "id" in mission
            assert "name" in mission
            assert "description" in mission
            assert "xp_reward" in mission
            assert "target_value" in mission
            assert "current_progress" in mission
            assert "progress_percent" in mission
            assert "is_completed" in mission
        
        # Verify weekly missions
        assert isinstance(data["weekly_missions"], list)
        if len(data["weekly_missions"]) > 0:
            mission = data["weekly_missions"][0]
            assert "id" in mission
            assert "name" in mission
            assert "xp_reward" in mission
    
    def test_get_leaderboard(self):
        """Test GET /api/battle-pass/leaderboard - returns XP rankings"""
        response = requests.get(
            f"{BASE_URL}/api/battle-pass/leaderboard?limit=10",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify leaderboard structure
        assert "leaderboard" in data
        assert "season" in data
        
        # Verify leaderboard is a list
        assert isinstance(data["leaderboard"], list)
        
        # If there are entries, verify structure
        if len(data["leaderboard"]) > 0:
            entry = data["leaderboard"][0]
            assert "user_id" in entry
            assert "current_xp" in entry
            assert "current_tier" in entry
            assert "rank" in entry
            assert entry["rank"] == 1  # First entry should be rank 1
    
    def test_get_user_rewards_inventory(self):
        """Test GET /api/battle-pass/rewards/inventory - returns claimed rewards"""
        response = requests.get(
            f"{BASE_URL}/api/battle-pass/rewards/inventory",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify inventory structure
        assert "rewards" in data
        assert "by_type" in data
        assert "total_count" in data
        
        # Verify data types
        assert isinstance(data["rewards"], list)
        assert isinstance(data["by_type"], dict)
        assert isinstance(data["total_count"], int)
    
    def test_claim_tier_1_reward(self):
        """Test POST /api/battle-pass/rewards/1/claim - claim tier 1 reward"""
        # First get current progress to check if tier 1 is unlocked
        progress_response = requests.get(
            f"{BASE_URL}/api/battle-pass/progress",
            headers=self.headers
        )
        assert progress_response.status_code == 200
        progress = progress_response.json()
        
        # Tier 1 should always be unlocked (0 XP required)
        assert progress["current_tier"] >= 1
        
        # Try to claim tier 1 reward
        response = requests.post(
            f"{BASE_URL}/api/battle-pass/rewards/1/claim",
            headers=self.headers
        )
        
        # Either success (200) or already claimed (400)
        assert response.status_code in [200, 400]
        
        data = response.json()
        if response.status_code == 200:
            assert "message" in data
            assert "reward" in data
            assert data["reward"]["tier"] == 1
            assert data["reward"]["reward_name"] == "Recruit"
        else:
            # Already claimed
            assert "detail" in data
            assert "already claimed" in data["detail"].lower()
    
    def test_claim_unreached_tier_fails(self):
        """Test claiming a tier that hasn't been reached fails"""
        # Try to claim tier 50 (requires 60000 XP)
        response = requests.post(
            f"{BASE_URL}/api/battle-pass/rewards/50/claim",
            headers=self.headers
        )
        
        # Should fail unless user has 60000+ XP
        progress_response = requests.get(
            f"{BASE_URL}/api/battle-pass/progress",
            headers=self.headers
        )
        progress = progress_response.json()
        
        if progress["current_tier"] < 50:
            assert response.status_code == 400
            data = response.json()
            assert "detail" in data
            assert "not yet reached" in data["detail"].lower()
    
    def test_award_xp(self):
        """Test POST /api/battle-pass/xp/award - award XP for actions"""
        # Get initial XP
        initial_response = requests.get(
            f"{BASE_URL}/api/battle-pass/progress",
            headers=self.headers
        )
        initial_xp = initial_response.json()["current_xp"]
        
        # Award XP for door knocked
        response = requests.post(
            f"{BASE_URL}/api/battle-pass/xp/award?action_type=door_knocked&count=1",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "xp_awarded" in data
        assert "total_xp" in data
        assert "current_tier" in data
        assert data["xp_awarded"] == 5  # door_knocked gives 5 XP
        
        # Verify XP increased
        assert data["total_xp"] >= initial_xp + 5


class TestBattlePassUnauthenticated:
    """Tests for unauthenticated access to protected endpoints"""
    
    def test_progress_requires_auth(self):
        """Test that progress endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/battle-pass/progress")
        assert response.status_code in [401, 403]
    
    def test_missions_requires_auth(self):
        """Test that missions endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/battle-pass/missions")
        assert response.status_code in [401, 403]
    
    def test_leaderboard_requires_auth(self):
        """Test that leaderboard endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/battle-pass/leaderboard")
        assert response.status_code in [401, 403]
    
    def test_claim_reward_requires_auth(self):
        """Test that claim reward endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/battle-pass/rewards/1/claim")
        assert response.status_code in [401, 403]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

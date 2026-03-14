"""
Harvest Rewards & Campaigns API Tests
Tests for the extended gamification system including:
- Rewards catalog with point redemption
- Campaign management with templates
- Streak tracking with multipliers
- Challenge system
- Badge tiers (Common/Rare/Epic/Legendary)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHarvestRewardsCampaigns:
    """Test suite for Harvest Rewards & Campaigns API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.user_id = login_response.json().get("user", {}).get("id")
        else:
            pytest.skip(f"Authentication failed: {login_response.status_code}")
    
    # ============================================
    # REWARDS CATALOG TESTS
    # ============================================
    
    def test_get_rewards_returns_list_with_user_points(self):
        """GET /api/harvest/rewards - Returns rewards with user points and can_redeem status"""
        response = self.session.get(f"{BASE_URL}/api/harvest/rewards")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "rewards" in data, "Response should contain 'rewards' key"
        assert "user_points" in data, "Response should contain 'user_points' key"
        assert "categories" in data, "Response should contain 'categories' key"
        
        # Verify user_points is a number
        assert isinstance(data["user_points"], (int, float)), "user_points should be numeric"
        
        # Verify categories list
        assert isinstance(data["categories"], list), "categories should be a list"
        
        # If rewards exist, verify structure
        if data["rewards"]:
            reward = data["rewards"][0]
            assert "id" in reward, "Reward should have 'id'"
            assert "name" in reward, "Reward should have 'name'"
            assert "points_required" in reward, "Reward should have 'points_required'"
            assert "can_redeem" in reward, "Reward should have 'can_redeem' status"
            assert "points_needed" in reward, "Reward should have 'points_needed'"
            
            # Verify can_redeem logic
            if data["user_points"] >= reward["points_required"]:
                assert reward["can_redeem"] == True, "can_redeem should be True when user has enough points"
            else:
                assert reward["can_redeem"] == False, "can_redeem should be False when user lacks points"
    
    def test_get_rewards_with_category_filter(self):
        """GET /api/harvest/rewards?category=gift_card - Filter by category"""
        response = self.session.get(f"{BASE_URL}/api/harvest/rewards?category=gift_card")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # All returned rewards should be gift_card category (if any)
        for reward in data.get("rewards", []):
            if "category" in reward:
                assert reward["category"] == "gift_card", f"Expected gift_card category, got {reward['category']}"
    
    def test_get_rewards_featured_only(self):
        """GET /api/harvest/rewards?featured_only=true - Filter featured rewards"""
        response = self.session.get(f"{BASE_URL}/api/harvest/rewards?featured_only=true")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # All returned rewards should be featured (if any)
        for reward in data.get("rewards", []):
            if "is_featured" in reward:
                assert reward["is_featured"] == True, "Expected only featured rewards"
    
    def test_create_reward_requires_admin(self):
        """POST /api/harvest/rewards - Create new reward (admin only)"""
        reward_data = {
            "name": f"TEST_Reward_{uuid.uuid4().hex[:8]}",
            "description": "Test reward for automated testing",
            "category": "gift_card",
            "points_required": 500,
            "is_featured": False
        }
        
        response = self.session.post(f"{BASE_URL}/api/harvest/rewards", json=reward_data)
        
        # Should succeed if user is admin/manager, or fail with 403 if not
        assert response.status_code in [200, 201, 403], f"Expected 200/201/403, got {response.status_code}: {response.text}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            assert "id" in data, "Response should contain reward id"
            assert "message" in data, "Response should contain success message"
            
            # Cleanup - store for later deletion
            self.created_reward_id = data["id"]
    
    # ============================================
    # CAMPAIGNS TESTS
    # ============================================
    
    def test_get_campaigns_returns_list_with_progress(self):
        """GET /api/harvest/campaigns - Returns campaigns list with progress"""
        response = self.session.get(f"{BASE_URL}/api/harvest/campaigns")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "campaigns" in data, "Response should contain 'campaigns' key"
        assert isinstance(data["campaigns"], list), "campaigns should be a list"
        
        # If campaigns exist, verify structure
        if data["campaigns"]:
            campaign = data["campaigns"][0]
            assert "id" in campaign, "Campaign should have 'id'"
            assert "name" in campaign, "Campaign should have 'name'"
            assert "status" in campaign, "Campaign should have 'status'"
            assert "time_remaining" in campaign, "Campaign should have 'time_remaining'"
            assert "participant_count" in campaign, "Campaign should have 'participant_count'"
            assert "my_progress" in campaign, "Campaign should have 'my_progress'"
            assert "my_percent" in campaign, "Campaign should have 'my_percent'"
            assert "leader" in campaign, "Campaign should have 'leader'"
    
    def test_get_campaigns_with_status_filter(self):
        """GET /api/harvest/campaigns?status=active - Filter by status"""
        response = self.session.get(f"{BASE_URL}/api/harvest/campaigns?status=active")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # All returned campaigns should be active (if any)
        for campaign in data.get("campaigns", []):
            assert campaign["status"] == "active", f"Expected active status, got {campaign['status']}"
    
    def test_get_campaigns_include_past(self):
        """GET /api/harvest/campaigns?include_past=true - Include past campaigns"""
        response = self.session.get(f"{BASE_URL}/api/harvest/campaigns?include_past=true")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "campaigns" in data, "Response should contain 'campaigns' key"
    
    # ============================================
    # CAMPAIGN TEMPLATES TESTS
    # ============================================
    
    def test_get_campaign_templates_returns_5_defaults(self):
        """GET /api/harvest/campaigns/templates/list - Returns 5 default templates"""
        response = self.session.get(f"{BASE_URL}/api/harvest/campaigns/templates/list")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "templates" in data, "Response should contain 'templates' key"
        assert isinstance(data["templates"], list), "templates should be a list"
        
        # Should have 5 default templates
        assert len(data["templates"]) >= 5, f"Expected at least 5 templates, got {len(data['templates'])}"
        
        # Verify template structure
        template = data["templates"][0]
        assert "id" in template, "Template should have 'id'"
        assert "name" in template, "Template should have 'name'"
        assert "description" in template, "Template should have 'description'"
        assert "duration_days" in template, "Template should have 'duration_days'"
        assert "goal_type" in template, "Template should have 'goal_type'"
        assert "default_target" in template, "Template should have 'default_target'"
        assert "reward_type" in template, "Template should have 'reward_type'"
        assert "icon" in template, "Template should have 'icon'"
        
        # Verify expected templates exist
        template_names = [t["name"] for t in data["templates"]]
        expected_templates = ["Weekly Blitz", "Season Long Ladder", "New Rep Sprint", "Storm Response", "Team Battle"]
        for expected in expected_templates:
            assert expected in template_names, f"Expected template '{expected}' not found"
    
    # ============================================
    # STREAK TESTS
    # ============================================
    
    def test_get_user_streak_returns_status_with_multiplier(self):
        """GET /api/harvest/streak - Returns user's streak status with multiplier"""
        response = self.session.get(f"{BASE_URL}/api/harvest/streak")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "current_streak" in data, "Response should contain 'current_streak'"
        assert "best_streak" in data, "Response should contain 'best_streak'"
        assert "multiplier" in data, "Response should contain 'multiplier'"
        assert "has_activity_today" in data, "Response should contain 'has_activity_today'"
        assert "is_at_risk" in data, "Response should contain 'is_at_risk'"
        assert "is_critical" in data, "Response should contain 'is_critical'"
        assert "doors_today" in data, "Response should contain 'doors_today'"
        assert "minimum_doors_required" in data, "Response should contain 'minimum_doors_required'"
        
        # Verify data types
        assert isinstance(data["current_streak"], int), "current_streak should be int"
        assert isinstance(data["best_streak"], int), "best_streak should be int"
        assert isinstance(data["multiplier"], (int, float)), "multiplier should be numeric"
        assert isinstance(data["has_activity_today"], bool), "has_activity_today should be bool"
        assert isinstance(data["is_at_risk"], bool), "is_at_risk should be bool"
        assert isinstance(data["is_critical"], bool), "is_critical should be bool"
        
        # Verify multiplier logic (based on streak)
        streak = data["current_streak"]
        multiplier = data["multiplier"]
        
        if streak >= 30:
            assert multiplier == 2.0, f"Expected 2.0x multiplier for 30+ streak, got {multiplier}"
        elif streak >= 10:
            assert multiplier == 1.5, f"Expected 1.5x multiplier for 10+ streak, got {multiplier}"
        elif streak >= 5:
            assert multiplier == 1.25, f"Expected 1.25x multiplier for 5+ streak, got {multiplier}"
        elif streak >= 3:
            assert multiplier == 1.1, f"Expected 1.1x multiplier for 3+ streak, got {multiplier}"
        else:
            assert multiplier == 1.0, f"Expected 1.0x multiplier for <3 streak, got {multiplier}"
    
    # ============================================
    # CHALLENGES TESTS
    # ============================================
    
    def test_get_user_challenges_returns_active_challenges(self):
        """GET /api/harvest/challenges - Returns user's active challenges"""
        response = self.session.get(f"{BASE_URL}/api/harvest/challenges")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "challenges" in data, "Response should contain 'challenges' key"
        assert isinstance(data["challenges"], list), "challenges should be a list"
        
        # If challenges exist, verify structure
        if data["challenges"]:
            challenge = data["challenges"][0]
            assert "id" in challenge, "Challenge should have 'id'"
            assert "name" in challenge, "Challenge should have 'name'"
            assert "state" in challenge, "Challenge should have 'state'"
            assert "time_remaining_display" in challenge, "Challenge should have 'time_remaining_display'"
    
    def test_get_challenges_include_completed(self):
        """GET /api/harvest/challenges?include_completed=true - Include completed challenges"""
        response = self.session.get(f"{BASE_URL}/api/harvest/challenges?include_completed=true")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "challenges" in data, "Response should contain 'challenges' key"
    
    # ============================================
    # BADGE TIERS TESTS
    # ============================================
    
    def test_get_badges_by_tier_returns_organized_badges(self):
        """GET /api/harvest/badges/tiers - Returns badges organized by tier (common/rare/epic/legendary)"""
        response = self.session.get(f"{BASE_URL}/api/harvest/badges/tiers")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "badges_by_tier" in data, "Response should contain 'badges_by_tier'"
        assert "earned_count" in data, "Response should contain 'earned_count'"
        assert "total_count" in data, "Response should contain 'total_count'"
        assert "tier_counts" in data, "Response should contain 'tier_counts'"
        
        # Verify tier structure
        badges_by_tier = data["badges_by_tier"]
        expected_tiers = ["common", "rare", "epic", "legendary"]
        for tier in expected_tiers:
            assert tier in badges_by_tier, f"badges_by_tier should contain '{tier}' tier"
            assert isinstance(badges_by_tier[tier], list), f"{tier} tier should be a list"
        
        # Verify tier_counts matches
        tier_counts = data["tier_counts"]
        for tier in expected_tiers:
            assert tier in tier_counts, f"tier_counts should contain '{tier}'"
            assert tier_counts[tier] == len(badges_by_tier[tier]), f"tier_counts[{tier}] should match badges count"
        
        # Verify earned_count and total_count are valid
        assert isinstance(data["earned_count"], int), "earned_count should be int"
        assert isinstance(data["total_count"], int), "total_count should be int"
        assert data["earned_count"] <= data["total_count"], "earned_count should not exceed total_count"
    
    # ============================================
    # PROGRESS TRACKING TESTS
    # ============================================
    
    def test_get_reward_progress_returns_progress_toward_next_reward(self):
        """GET /api/harvest/progress/rewards - Returns progress toward next reward"""
        response = self.session.get(f"{BASE_URL}/api/harvest/progress/rewards")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "current_points" in data, "Response should contain 'current_points'"
        assert "rewards_progress" in data, "Response should contain 'rewards_progress'"
        assert "next_reward" in data, "Response should contain 'next_reward'"
        
        # Verify current_points is numeric
        assert isinstance(data["current_points"], (int, float)), "current_points should be numeric"
        
        # Verify rewards_progress structure
        assert isinstance(data["rewards_progress"], list), "rewards_progress should be a list"
        
        if data["rewards_progress"]:
            progress = data["rewards_progress"][0]
            assert "reward_id" in progress, "Progress should have 'reward_id'"
            assert "name" in progress, "Progress should have 'name'"
            assert "points_required" in progress, "Progress should have 'points_required'"
            assert "points_remaining" in progress, "Progress should have 'points_remaining'"
            assert "percent_complete" in progress, "Progress should have 'percent_complete'"
            assert "can_redeem" in progress, "Progress should have 'can_redeem'"
        
        # Verify next_reward structure (if exists)
        if data["next_reward"]:
            next_reward = data["next_reward"]
            assert "reward_id" in next_reward, "next_reward should have 'reward_id'"
            assert "name" in next_reward, "next_reward should have 'name'"
            assert "points_remaining" in next_reward, "next_reward should have 'points_remaining'"
            assert next_reward["points_remaining"] > 0, "next_reward should have positive points_remaining"
    
    # ============================================
    # REDEMPTION TESTS
    # ============================================
    
    def test_redeem_reward_fails_with_insufficient_points(self):
        """POST /api/harvest/rewards/redeem - Attempt redemption (should fail with insufficient points)"""
        # First get rewards to find one that requires more points than user has
        rewards_response = self.session.get(f"{BASE_URL}/api/harvest/rewards")
        assert rewards_response.status_code == 200
        
        rewards_data = rewards_response.json()
        user_points = rewards_data.get("user_points", 0)
        
        # Find a reward that costs more than user has
        expensive_reward = None
        for reward in rewards_data.get("rewards", []):
            if reward["points_required"] > user_points:
                expensive_reward = reward
                break
        
        if expensive_reward:
            # Attempt to redeem
            response = self.session.post(f"{BASE_URL}/api/harvest/rewards/redeem", json={
                "reward_id": expensive_reward["id"]
            })
            
            # Should fail with 400 (insufficient points)
            assert response.status_code == 400, f"Expected 400 for insufficient points, got {response.status_code}: {response.text}"
            
            data = response.json()
            assert "detail" in data, "Error response should contain 'detail'"
            assert "insufficient" in data["detail"].lower() or "need" in data["detail"].lower(), \
                f"Error should mention insufficient points: {data['detail']}"
        else:
            # If user can afford all rewards, skip this test
            pytest.skip("User has enough points for all rewards - cannot test insufficient points scenario")
    
    def test_redeem_nonexistent_reward_returns_404(self):
        """POST /api/harvest/rewards/redeem - Attempt to redeem non-existent reward"""
        response = self.session.post(f"{BASE_URL}/api/harvest/rewards/redeem", json={
            "reward_id": "nonexistent-reward-id-12345"
        })
        
        assert response.status_code == 404, f"Expected 404 for non-existent reward, got {response.status_code}: {response.text}"
    
    def test_get_redemptions_returns_history(self):
        """GET /api/harvest/redemptions - Returns redemption history"""
        response = self.session.get(f"{BASE_URL}/api/harvest/redemptions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "redemptions" in data, "Response should contain 'redemptions'"
        assert "counts" in data, "Response should contain 'counts'"
        
        # Verify redemptions is a list
        assert isinstance(data["redemptions"], list), "redemptions should be a list"
        
        # Verify counts structure
        counts = data["counts"]
        assert "pending" in counts, "counts should have 'pending'"
        assert "approved" in counts, "counts should have 'approved'"
        assert "fulfilled" in counts, "counts should have 'fulfilled'"
        
        # If redemptions exist, verify structure
        if data["redemptions"]:
            redemption = data["redemptions"][0]
            assert "id" in redemption, "Redemption should have 'id'"
            assert "user_id" in redemption, "Redemption should have 'user_id'"
            assert "reward_id" in redemption, "Redemption should have 'reward_id'"
            assert "status" in redemption, "Redemption should have 'status'"
            assert "points_spent" in redemption, "Redemption should have 'points_spent'"
    
    def test_get_redemptions_with_status_filter(self):
        """GET /api/harvest/redemptions?status=pending - Filter by status"""
        response = self.session.get(f"{BASE_URL}/api/harvest/redemptions?status=pending")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # All returned redemptions should be pending (if any)
        for redemption in data.get("redemptions", []):
            assert redemption["status"] == "pending", f"Expected pending status, got {redemption['status']}"
    
    # ============================================
    # AUTHENTICATION TESTS
    # ============================================
    
    def test_rewards_endpoint_requires_auth(self):
        """Verify /api/harvest/rewards requires authentication"""
        # Create new session without auth
        unauth_session = requests.Session()
        unauth_session.headers.update({"Content-Type": "application/json"})
        
        response = unauth_session.get(f"{BASE_URL}/api/harvest/rewards")
        
        # Should return 401 or 403
        assert response.status_code in [401, 403], f"Expected 401/403 for unauthenticated request, got {response.status_code}"
    
    def test_streak_endpoint_requires_auth(self):
        """Verify /api/harvest/streak requires authentication"""
        unauth_session = requests.Session()
        unauth_session.headers.update({"Content-Type": "application/json"})
        
        response = unauth_session.get(f"{BASE_URL}/api/harvest/streak")
        
        assert response.status_code in [401, 403], f"Expected 401/403 for unauthenticated request, got {response.status_code}"
    
    def test_badges_tiers_endpoint_requires_auth(self):
        """Verify /api/harvest/badges/tiers requires authentication"""
        unauth_session = requests.Session()
        unauth_session.headers.update({"Content-Type": "application/json"})
        
        response = unauth_session.get(f"{BASE_URL}/api/harvest/badges/tiers")
        
        assert response.status_code in [401, 403], f"Expected 401/403 for unauthenticated request, got {response.status_code}"


class TestHarvestRewardsCampaignsDataValidation:
    """Additional data validation tests"""
    
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
    
    def test_rewards_sorted_by_points_required(self):
        """Verify rewards are sorted by points_required ascending"""
        response = self.session.get(f"{BASE_URL}/api/harvest/rewards")
        assert response.status_code == 200
        
        data = response.json()
        rewards = data.get("rewards", [])
        
        if len(rewards) > 1:
            for i in range(len(rewards) - 1):
                assert rewards[i]["points_required"] <= rewards[i+1]["points_required"], \
                    f"Rewards should be sorted by points_required: {rewards[i]['points_required']} > {rewards[i+1]['points_required']}"
    
    def test_user_points_consistency(self):
        """Verify user points are consistent across endpoints"""
        # Get points from rewards endpoint
        rewards_response = self.session.get(f"{BASE_URL}/api/harvest/rewards")
        assert rewards_response.status_code == 200
        rewards_points = rewards_response.json().get("user_points", 0)
        
        # Get points from progress endpoint
        progress_response = self.session.get(f"{BASE_URL}/api/harvest/progress/rewards")
        assert progress_response.status_code == 200
        progress_points = progress_response.json().get("current_points", 0)
        
        # Points should match
        assert rewards_points == progress_points, \
            f"User points mismatch: rewards={rewards_points}, progress={progress_points}"
    
    def test_campaign_templates_have_valid_goal_types(self):
        """Verify campaign templates have valid goal types"""
        response = self.session.get(f"{BASE_URL}/api/harvest/campaigns/templates/list")
        assert response.status_code == 200
        
        data = response.json()
        valid_goal_types = ["doors", "appointments", "contracts", "points", "custom"]
        
        for template in data.get("templates", []):
            assert template["goal_type"] in valid_goal_types, \
                f"Invalid goal_type '{template['goal_type']}' in template '{template['name']}'"
    
    def test_campaign_templates_have_valid_reward_types(self):
        """Verify campaign templates have valid reward types"""
        response = self.session.get(f"{BASE_URL}/api/harvest/campaigns/templates/list")
        assert response.status_code == 200
        
        data = response.json()
        valid_reward_types = ["top_performers", "threshold", "lottery"]
        
        for template in data.get("templates", []):
            assert template["reward_type"] in valid_reward_types, \
                f"Invalid reward_type '{template['reward_type']}' in template '{template['name']}'"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

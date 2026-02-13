"""
Test suite for Badges and Rewards CRUD endpoints in Incentives Admin Console
Tests: GET, POST, PUT, DELETE for both badges and rewards
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
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Shared requests session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


# ============================================
# BADGES CRUD TESTS
# ============================================

class TestBadgesDefinitions:
    """Test GET /api/incentives/badges/definitions"""
    
    def test_get_badges_definitions_success(self, api_client):
        """Test fetching all badge definitions"""
        response = api_client.get(f"{BASE_URL}/api/incentives/badges/definitions")
        
        assert response.status_code == 200
        data = response.json()
        assert "badges" in data
        assert isinstance(data["badges"], list)
        
        # Verify badge structure if badges exist
        if len(data["badges"]) > 0:
            badge = data["badges"][0]
            assert "id" in badge
            assert "name" in badge
            assert "tier" in badge
            print(f"✓ Found {len(data['badges'])} badge definitions")
    
    def test_get_badges_definitions_unauthorized(self):
        """Test that unauthorized access returns 401 or 403"""
        response = requests.get(f"{BASE_URL}/api/incentives/badges/definitions")
        assert response.status_code in [401, 403]


class TestBadgeCreate:
    """Test POST /api/incentives/badges"""
    
    def test_create_badge_success(self, api_client):
        """Test creating a new badge"""
        unique_name = f"TEST_Badge_{uuid.uuid4().hex[:8]}"
        badge_data = {
            "name": unique_name,
            "description": "Test badge description",
            "criteria": "Complete test criteria",
            "tier": "rare",
            "icon": "🧪",
            "points_value": 200,
            "is_active": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/incentives/badges", json=badge_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data.get("message") == "Badge created successfully"
        
        # Verify badge was created by fetching it
        get_response = api_client.get(f"{BASE_URL}/api/incentives/badges/definitions")
        assert get_response.status_code == 200
        badges = get_response.json().get("badges", [])
        created_badge = next((b for b in badges if b["name"] == unique_name), None)
        assert created_badge is not None
        assert created_badge["tier"] == "rare"
        assert created_badge["points_value"] == 200
        
        print(f"✓ Created badge: {unique_name} with id: {data['id']}")
        return data["id"]
    
    def test_create_badge_missing_required_fields(self, api_client):
        """Test creating badge without required fields fails"""
        badge_data = {
            "description": "Missing name and criteria"
        }
        
        response = api_client.post(f"{BASE_URL}/api/incentives/badges", json=badge_data)
        # Should fail validation
        assert response.status_code in [400, 422]
    
    def test_create_badge_all_tiers(self, api_client):
        """Test creating badges with all tier types"""
        tiers = ["common", "rare", "epic", "legendary"]
        created_ids = []
        
        for tier in tiers:
            badge_data = {
                "name": f"TEST_Tier_{tier}_{uuid.uuid4().hex[:6]}",
                "criteria": f"Test {tier} tier badge",
                "tier": tier,
                "icon": "🏆",
                "points_value": 100
            }
            
            response = api_client.post(f"{BASE_URL}/api/incentives/badges", json=badge_data)
            assert response.status_code == 200
            created_ids.append(response.json()["id"])
        
        print(f"✓ Created badges for all tiers: {tiers}")
        return created_ids


class TestBadgeUpdate:
    """Test PUT /api/incentives/badges/{badge_id}"""
    
    def test_update_badge_success(self, api_client):
        """Test updating an existing badge"""
        # First create a badge
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:8]}"
        create_data = {
            "name": unique_name,
            "criteria": "Original criteria",
            "tier": "common",
            "icon": "🔵",
            "points_value": 100
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/incentives/badges", json=create_data)
        assert create_response.status_code == 200
        badge_id = create_response.json()["id"]
        
        # Update the badge
        update_data = {
            "name": unique_name,
            "criteria": "Updated criteria",
            "tier": "epic",
            "icon": "🟣",
            "points_value": 500,
            "description": "Updated description"
        }
        
        update_response = api_client.put(f"{BASE_URL}/api/incentives/badges/{badge_id}", json=update_data)
        assert update_response.status_code == 200
        assert update_response.json().get("message") == "Badge updated successfully"
        
        # Verify update by fetching
        get_response = api_client.get(f"{BASE_URL}/api/incentives/badges/definitions")
        badges = get_response.json().get("badges", [])
        updated_badge = next((b for b in badges if b["id"] == badge_id), None)
        
        assert updated_badge is not None
        assert updated_badge["tier"] == "epic"
        assert updated_badge["points_value"] == 500
        assert updated_badge["criteria"] == "Updated criteria"
        
        print(f"✓ Updated badge {badge_id} successfully")
    
    def test_update_nonexistent_badge(self, api_client):
        """Test updating a badge that doesn't exist"""
        fake_id = str(uuid.uuid4())
        update_data = {
            "name": "Nonexistent",
            "criteria": "Test",
            "tier": "common"
        }
        
        response = api_client.put(f"{BASE_URL}/api/incentives/badges/{fake_id}", json=update_data)
        assert response.status_code == 404


class TestBadgeDelete:
    """Test DELETE /api/incentives/badges/{badge_id}"""
    
    def test_delete_badge_success(self, api_client):
        """Test deleting a badge"""
        # First create a badge to delete
        unique_name = f"TEST_Delete_{uuid.uuid4().hex[:8]}"
        create_data = {
            "name": unique_name,
            "criteria": "To be deleted",
            "tier": "common"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/incentives/badges", json=create_data)
        assert create_response.status_code == 200
        badge_id = create_response.json()["id"]
        
        # Delete the badge
        delete_response = api_client.delete(f"{BASE_URL}/api/incentives/badges/{badge_id}")
        assert delete_response.status_code == 200
        assert delete_response.json().get("message") == "Badge deleted successfully"
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/incentives/badges/definitions")
        badges = get_response.json().get("badges", [])
        deleted_badge = next((b for b in badges if b["id"] == badge_id), None)
        assert deleted_badge is None
        
        print(f"✓ Deleted badge {badge_id} successfully")
    
    def test_delete_nonexistent_badge(self, api_client):
        """Test deleting a badge that doesn't exist"""
        fake_id = str(uuid.uuid4())
        response = api_client.delete(f"{BASE_URL}/api/incentives/badges/{fake_id}")
        assert response.status_code == 404


# ============================================
# REWARDS CRUD TESTS
# ============================================

class TestRewardsGet:
    """Test GET /api/incentives/rewards"""
    
    def test_get_rewards_success(self, api_client):
        """Test fetching all rewards"""
        response = api_client.get(f"{BASE_URL}/api/incentives/rewards")
        
        assert response.status_code == 200
        data = response.json()
        assert "rewards" in data
        assert isinstance(data["rewards"], list)
        
        # Verify reward structure if rewards exist
        if len(data["rewards"]) > 0:
            reward = data["rewards"][0]
            assert "id" in reward
            assert "name" in reward
            assert "type" in reward
            print(f"✓ Found {len(data['rewards'])} rewards")
    
    def test_get_rewards_active_only(self, api_client):
        """Test fetching only active rewards"""
        response = api_client.get(f"{BASE_URL}/api/incentives/rewards?active_only=true")
        
        assert response.status_code == 200
        data = response.json()
        # All returned rewards should be active
        for reward in data.get("rewards", []):
            assert reward.get("is_active", True) == True
    
    def test_get_rewards_unauthorized(self):
        """Test that unauthorized access returns 401 or 403"""
        response = requests.get(f"{BASE_URL}/api/incentives/rewards")
        assert response.status_code in [401, 403]


class TestRewardCreate:
    """Test POST /api/incentives/rewards"""
    
    def test_create_reward_success(self, api_client):
        """Test creating a new reward"""
        unique_name = f"TEST_Reward_{uuid.uuid4().hex[:8]}"
        reward_data = {
            "name": unique_name,
            "description": "Test reward description",
            "type": "gift_card",
            "value_cents": 5000,
            "points_required": 1000,
            "icon": "🎁",
            "is_featured": True,
            "is_active": True,
            "categories": ["test", "gift"]
        }
        
        response = api_client.post(f"{BASE_URL}/api/incentives/rewards", json=reward_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data.get("message") == "Reward created successfully"
        
        # Verify reward was created
        get_response = api_client.get(f"{BASE_URL}/api/incentives/rewards")
        rewards = get_response.json().get("rewards", [])
        created_reward = next((r for r in rewards if r["name"] == unique_name), None)
        
        assert created_reward is not None
        assert created_reward["type"] == "gift_card"
        assert created_reward["value_cents"] == 5000
        assert created_reward["points_required"] == 1000
        
        print(f"✓ Created reward: {unique_name} with id: {data['id']}")
        return data["id"]
    
    def test_create_reward_all_types(self, api_client):
        """Test creating rewards with different types"""
        reward_types = ["gift_card", "merchandise", "experience", "cash", "pto", "points", "custom"]
        created_ids = []
        
        for rtype in reward_types:
            reward_data = {
                "name": f"TEST_Type_{rtype}_{uuid.uuid4().hex[:6]}",
                "description": f"Test {rtype} reward",
                "type": rtype,
                "points_required": 500,
                "icon": "🎁"
            }
            
            response = api_client.post(f"{BASE_URL}/api/incentives/rewards", json=reward_data)
            assert response.status_code == 200
            created_ids.append(response.json()["id"])
        
        print(f"✓ Created rewards for all types: {reward_types}")
        return created_ids
    
    def test_create_reward_with_stock(self, api_client):
        """Test creating a reward with limited stock"""
        unique_name = f"TEST_Stock_{uuid.uuid4().hex[:8]}"
        reward_data = {
            "name": unique_name,
            "description": "Limited stock reward",
            "type": "merchandise",
            "points_required": 2000,
            "stock_quantity": 10,
            "is_active": True
        }
        
        response = api_client.post(f"{BASE_URL}/api/incentives/rewards", json=reward_data)
        assert response.status_code == 200
        
        # Verify stock was set
        get_response = api_client.get(f"{BASE_URL}/api/incentives/rewards")
        rewards = get_response.json().get("rewards", [])
        created_reward = next((r for r in rewards if r["name"] == unique_name), None)
        
        assert created_reward is not None
        assert created_reward["stock_quantity"] == 10
        
        print(f"✓ Created reward with stock_quantity=10")


class TestRewardUpdate:
    """Test PUT /api/incentives/rewards/{reward_id}"""
    
    def test_update_reward_success(self, api_client):
        """Test updating an existing reward"""
        # First create a reward
        unique_name = f"TEST_UpdateReward_{uuid.uuid4().hex[:8]}"
        create_data = {
            "name": unique_name,
            "description": "Original description",
            "type": "gift_card",
            "value_cents": 2500,
            "points_required": 500
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/incentives/rewards", json=create_data)
        assert create_response.status_code == 200
        reward_id = create_response.json()["id"]
        
        # Update the reward
        update_data = {
            "name": unique_name,
            "description": "Updated description",
            "type": "gift_card",
            "value_cents": 5000,
            "points_required": 1000,
            "is_featured": True
        }
        
        update_response = api_client.put(f"{BASE_URL}/api/incentives/rewards/{reward_id}", json=update_data)
        assert update_response.status_code == 200
        assert update_response.json().get("message") == "Reward updated successfully"
        
        # Verify update
        get_response = api_client.get(f"{BASE_URL}/api/incentives/rewards")
        rewards = get_response.json().get("rewards", [])
        updated_reward = next((r for r in rewards if r["id"] == reward_id), None)
        
        assert updated_reward is not None
        assert updated_reward["value_cents"] == 5000
        assert updated_reward["points_required"] == 1000
        assert updated_reward["description"] == "Updated description"
        
        print(f"✓ Updated reward {reward_id} successfully")
    
    def test_update_nonexistent_reward(self, api_client):
        """Test updating a reward that doesn't exist"""
        fake_id = str(uuid.uuid4())
        update_data = {
            "name": "Nonexistent",
            "type": "gift_card",
            "points_required": 100
        }
        
        response = api_client.put(f"{BASE_URL}/api/incentives/rewards/{fake_id}", json=update_data)
        assert response.status_code == 404


class TestRewardDelete:
    """Test DELETE /api/incentives/rewards/{reward_id}"""
    
    def test_delete_reward_success(self, api_client):
        """Test deleting a reward"""
        # First create a reward to delete
        unique_name = f"TEST_DeleteReward_{uuid.uuid4().hex[:8]}"
        create_data = {
            "name": unique_name,
            "description": "To be deleted",
            "type": "gift_card",
            "points_required": 100
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/incentives/rewards", json=create_data)
        assert create_response.status_code == 200
        reward_id = create_response.json()["id"]
        
        # Delete the reward
        delete_response = api_client.delete(f"{BASE_URL}/api/incentives/rewards/{reward_id}")
        assert delete_response.status_code == 200
        assert delete_response.json().get("message") == "Reward deleted successfully"
        
        # Verify deletion
        get_response = api_client.get(f"{BASE_URL}/api/incentives/rewards")
        rewards = get_response.json().get("rewards", [])
        deleted_reward = next((r for r in rewards if r["id"] == reward_id), None)
        assert deleted_reward is None
        
        print(f"✓ Deleted reward {reward_id} successfully")
    
    def test_delete_nonexistent_reward(self, api_client):
        """Test deleting a reward that doesn't exist"""
        fake_id = str(uuid.uuid4())
        response = api_client.delete(f"{BASE_URL}/api/incentives/rewards/{fake_id}")
        assert response.status_code == 404


# ============================================
# TAB NAVIGATION TESTS (API endpoints for each tab)
# ============================================

class TestTabEndpoints:
    """Test that all tab-related endpoints are accessible"""
    
    def test_competitions_tab_endpoint(self, api_client):
        """Test Competitions tab endpoint"""
        response = api_client.get(f"{BASE_URL}/api/incentives/competitions?include_past=true")
        assert response.status_code == 200
        assert "competitions" in response.json()
        print("✓ Competitions tab endpoint working")
    
    def test_templates_tab_endpoint(self, api_client):
        """Test Templates tab endpoint"""
        response = api_client.get(f"{BASE_URL}/api/incentives/templates")
        assert response.status_code == 200
        assert "templates" in response.json()
        print("✓ Templates tab endpoint working")
    
    def test_seasons_tab_endpoint(self, api_client):
        """Test Seasons tab endpoint"""
        response = api_client.get(f"{BASE_URL}/api/incentives/seasons")
        assert response.status_code == 200
        assert "seasons" in response.json()
        print("✓ Seasons tab endpoint working")
    
    def test_badges_tab_endpoint(self, api_client):
        """Test Badges tab endpoint"""
        response = api_client.get(f"{BASE_URL}/api/incentives/badges/definitions")
        assert response.status_code == 200
        assert "badges" in response.json()
        print("✓ Badges tab endpoint working")
    
    def test_rewards_tab_endpoint(self, api_client):
        """Test Rewards tab endpoint"""
        response = api_client.get(f"{BASE_URL}/api/incentives/rewards")
        assert response.status_code == 200
        assert "rewards" in response.json()
        print("✓ Rewards tab endpoint working")
    
    def test_metrics_tab_endpoint(self, api_client):
        """Test Metrics tab endpoint"""
        response = api_client.get(f"{BASE_URL}/api/incentives/metrics")
        assert response.status_code == 200
        assert "metrics" in response.json()
        print("✓ Metrics tab endpoint working")


# ============================================
# CLEANUP TEST DATA
# ============================================

class TestCleanup:
    """Cleanup test data created during tests"""
    
    def test_cleanup_test_badges(self, api_client):
        """Clean up TEST_ prefixed badges"""
        response = api_client.get(f"{BASE_URL}/api/incentives/badges/definitions")
        badges = response.json().get("badges", [])
        
        deleted_count = 0
        for badge in badges:
            if badge.get("name", "").startswith("TEST_"):
                delete_response = api_client.delete(f"{BASE_URL}/api/incentives/badges/{badge['id']}")
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"✓ Cleaned up {deleted_count} test badges")
    
    def test_cleanup_test_rewards(self, api_client):
        """Clean up TEST_ prefixed rewards"""
        response = api_client.get(f"{BASE_URL}/api/incentives/rewards")
        rewards = response.json().get("rewards", [])
        
        deleted_count = 0
        for reward in rewards:
            if reward.get("name", "").startswith("TEST_"):
                delete_response = api_client.delete(f"{BASE_URL}/api/incentives/rewards/{reward['id']}")
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"✓ Cleaned up {deleted_count} test rewards")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

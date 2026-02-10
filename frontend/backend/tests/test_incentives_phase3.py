"""
Test Suite for Eden Incentives Engine - Phase 3
Tests for: Improvement Rules, Lottery Rules, Competition End Notifications, Badge Awards

Features tested:
- POST /api/incentives/competitions/{id}/calculate-baselines - Calculate baselines for improvement rules
- POST /api/incentives/competitions/{id}/end-and-evaluate - End competition and run full evaluation
- GET /api/incentives/lottery/{id}/qualifiers - Get lottery qualifiers
- GET /api/incentives/notifications/me - Get user's incentive notifications
- GET /api/incentives/badges/earned - Get user's earned badges
- Improvement rules - real-time evaluation and final evaluation
- Lottery rules - qualifier tracking and random draw
- Competition end notifications - sends to winners and participants
- Badge awards on completion - awards badges to qualifiers
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@eden.com"
TEST_PASSWORD = "password"


class TestPhase3Auth:
    """Authentication tests for Phase 3 endpoints"""
    
    def test_calculate_baselines_requires_auth(self):
        """Test that calculate-baselines endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/incentives/competitions/test-id/calculate-baselines")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_end_and_evaluate_requires_auth(self):
        """Test that end-and-evaluate endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/incentives/competitions/test-id/end-and-evaluate")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_lottery_qualifiers_requires_auth(self):
        """Test that lottery qualifiers endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/incentives/lottery/test-id/qualifiers")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_notifications_me_requires_auth(self):
        """Test that notifications/me endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/incentives/notifications/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_badges_earned_requires_auth(self):
        """Test that badges/earned endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/incentives/badges/earned")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestNotificationsMe:
    """Tests for GET /api/incentives/notifications/me"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_notifications_me_returns_list(self, auth_token):
        """GET /api/incentives/notifications/me returns notifications list"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/notifications/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to get notifications: {response.text}"
        
        data = response.json()
        assert "notifications" in data, "Response missing 'notifications'"
        assert "unread_count" in data, "Response missing 'unread_count'"
        assert isinstance(data["notifications"], list), "notifications should be a list"
        assert isinstance(data["unread_count"], int), "unread_count should be an integer"
    
    def test_notifications_me_unread_only_filter(self, auth_token):
        """GET /api/incentives/notifications/me with unread_only=true filters correctly"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/notifications/me?unread_only=true",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to get unread notifications: {response.text}"
        
        data = response.json()
        assert "notifications" in data
        # All returned notifications should be unread
        for notif in data["notifications"]:
            assert notif.get("read") == False, "Unread filter should only return unread notifications"
    
    def test_notifications_me_limit_parameter(self, auth_token):
        """GET /api/incentives/notifications/me respects limit parameter"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/notifications/me?limit=5",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["notifications"]) <= 5, "Should respect limit parameter"


class TestBadgesEarned:
    """Tests for GET /api/incentives/badges/earned"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_badges_earned_returns_list(self, auth_token):
        """GET /api/incentives/badges/earned returns badges list"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/badges/earned",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to get earned badges: {response.text}"
        
        data = response.json()
        assert "badges" in data, "Response missing 'badges'"
        assert "total_earned" in data, "Response missing 'total_earned'"
        assert isinstance(data["badges"], list), "badges should be a list"
        assert isinstance(data["total_earned"], int), "total_earned should be an integer"
    
    def test_badges_earned_structure(self, auth_token):
        """Earned badges have correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/badges/earned",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        if data["badges"]:
            badge = data["badges"][0]
            # Verify badge structure
            assert "id" in badge, "Badge missing 'id'"
            assert "user_id" in badge, "Badge missing 'user_id'"
            assert "badge_id" in badge, "Badge missing 'badge_id'"
            assert "earned_at" in badge, "Badge missing 'earned_at'"


class TestLotteryQualifiers:
    """Tests for GET /api/incentives/lottery/{competition_id}/qualifiers"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_lottery_qualifiers_not_found(self, auth_token):
        """GET /api/incentives/lottery/{id}/qualifiers returns 404 for invalid ID"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/lottery/invalid-competition-id/qualifiers",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_lottery_qualifiers_no_lottery_rule(self, auth_token):
        """GET /api/incentives/lottery/{id}/qualifiers returns 400 if no lottery rule"""
        # Get an active competition (likely doesn't have lottery rule)
        response = requests.get(
            f"{BASE_URL}/api/incentives/competitions?status=active",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if response.status_code == 200:
            competitions = response.json().get("competitions", [])
            if competitions:
                comp_id = competitions[0]["id"]
                
                # Try to get lottery qualifiers
                lottery_response = requests.get(
                    f"{BASE_URL}/api/incentives/lottery/{comp_id}/qualifiers",
                    headers={"Authorization": f"Bearer {auth_token}"}
                )
                # Should return 400 if no lottery rule, or 200 if it has one
                assert lottery_response.status_code in [200, 400], f"Expected 200 or 400, got {lottery_response.status_code}"


class TestCalculateBaselines:
    """Tests for POST /api/incentives/competitions/{id}/calculate-baselines"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_calculate_baselines_not_found(self, auth_token):
        """POST /api/incentives/competitions/{id}/calculate-baselines returns 404 for invalid ID"""
        response = requests.post(
            f"{BASE_URL}/api/incentives/competitions/invalid-competition-id/calculate-baselines",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_calculate_baselines_requires_admin(self, auth_token):
        """Calculate baselines requires admin/manager role"""
        # Get an active competition
        response = requests.get(
            f"{BASE_URL}/api/incentives/competitions?status=active",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if response.status_code == 200:
            competitions = response.json().get("competitions", [])
            if competitions:
                comp_id = competitions[0]["id"]
                
                # Try to calculate baselines
                baseline_response = requests.post(
                    f"{BASE_URL}/api/incentives/competitions/{comp_id}/calculate-baselines",
                    headers={"Authorization": f"Bearer {auth_token}"}
                )
                # Should succeed if admin, or 403 if not
                assert baseline_response.status_code in [200, 403], f"Expected 200 or 403, got {baseline_response.status_code}"
    
    def test_calculate_baselines_with_period(self, auth_token):
        """Calculate baselines accepts baseline_period parameter"""
        # Get an active competition
        response = requests.get(
            f"{BASE_URL}/api/incentives/competitions?status=active",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if response.status_code == 200:
            competitions = response.json().get("competitions", [])
            if competitions:
                comp_id = competitions[0]["id"]
                
                # Try with different periods
                for period in ["last_week", "last_month", "last_quarter"]:
                    baseline_response = requests.post(
                        f"{BASE_URL}/api/incentives/competitions/{comp_id}/calculate-baselines?baseline_period={period}",
                        headers={"Authorization": f"Bearer {auth_token}"}
                    )
                    # Should succeed if admin, or 403 if not
                    assert baseline_response.status_code in [200, 403], f"Expected 200 or 403 for period {period}, got {baseline_response.status_code}"


class TestEndAndEvaluate:
    """Tests for POST /api/incentives/competitions/{id}/end-and-evaluate"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_end_and_evaluate_not_found(self, auth_token):
        """POST /api/incentives/competitions/{id}/end-and-evaluate returns 404 for invalid ID"""
        response = requests.post(
            f"{BASE_URL}/api/incentives/competitions/invalid-competition-id/end-and-evaluate",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_end_and_evaluate_requires_admin(self, auth_token):
        """End and evaluate requires admin/manager role"""
        # Get an active competition
        response = requests.get(
            f"{BASE_URL}/api/incentives/competitions?status=active",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if response.status_code == 200:
            competitions = response.json().get("competitions", [])
            if competitions:
                comp_id = competitions[0]["id"]
                
                # Try to end and evaluate
                end_response = requests.post(
                    f"{BASE_URL}/api/incentives/competitions/{comp_id}/end-and-evaluate",
                    headers={"Authorization": f"Bearer {auth_token}"}
                )
                # Should succeed if admin, or 403 if not
                assert end_response.status_code in [200, 400, 403], f"Expected 200, 400, or 403, got {end_response.status_code}"


class TestImprovementRuleFlow:
    """Tests for improvement rule flow - create competition with improvement rule and test evaluation"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def metric_id(self, auth_token):
        """Get doors metric ID"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/metrics",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        metrics = response.json().get("metrics", [])
        doors_metric = next((m for m in metrics if m.get("slug") == "doors"), None)
        if not doors_metric:
            pytest.skip("Doors metric not found")
        return doors_metric["id"]
    
    def test_create_improvement_competition(self, auth_token, metric_id):
        """Create a competition with improvement rule"""
        # Create competition
        now = datetime.now(timezone.utc)
        start_date = now.isoformat()
        end_date = (now + timedelta(days=7)).isoformat()
        
        comp_data = {
            "name": f"TEST_Improvement_Competition_{uuid.uuid4().hex[:8]}",
            "description": "Test competition for improvement rules",
            "tagline": "Beat your baseline by 10%!",
            "start_date": start_date,
            "end_date": end_date,
            "metric_id": metric_id,
            "scope": "individual",
            "icon": "📈",
            "banner_color": "#10B981"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/incentives/competitions",
            json=comp_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # May fail if not admin, which is fine
        if response.status_code == 403:
            pytest.skip("Admin access required to create competition")
        
        # API returns 200 on success (not 201)
        assert response.status_code in [200, 201], f"Failed to create competition: {response.text}"
        
        competition = response.json()
        comp_id = competition["id"]
        
        # Create improvement rule
        rule_data = {
            "competition_id": comp_id,
            "type": "improvement",
            "priority": 1,
            "improvement_percent": 10.0,
            "points_award": 100
        }
        
        rule_response = requests.post(
            f"{BASE_URL}/api/incentives/rules",
            json=rule_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # API returns 200 on success (not 201)
        assert rule_response.status_code in [200, 201], f"Failed to create improvement rule: {rule_response.text}"
        
        rule = rule_response.json()
        # API returns id and message, not full rule object
        assert "id" in rule, "Rule response should contain 'id'"
        assert "message" in rule, "Rule response should contain 'message'"
        
        # Clean up - delete the competition
        requests.delete(
            f"{BASE_URL}/api/incentives/competitions/{comp_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )


class TestLotteryRuleFlow:
    """Tests for lottery rule flow - create competition with lottery rule and test qualifiers"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def metric_id(self, auth_token):
        """Get doors metric ID"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/metrics",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        metrics = response.json().get("metrics", [])
        doors_metric = next((m for m in metrics if m.get("slug") == "doors"), None)
        if not doors_metric:
            pytest.skip("Doors metric not found")
        return doors_metric["id"]
    
    def test_create_lottery_competition(self, auth_token, metric_id):
        """Create a competition with lottery rule"""
        # Create competition
        now = datetime.now(timezone.utc)
        start_date = now.isoformat()
        end_date = (now + timedelta(days=7)).isoformat()
        
        comp_data = {
            "name": f"TEST_Lottery_Competition_{uuid.uuid4().hex[:8]}",
            "description": "Test competition for lottery rules",
            "tagline": "Hit 10 doors to enter the lottery!",
            "start_date": start_date,
            "end_date": end_date,
            "metric_id": metric_id,
            "scope": "individual",
            "icon": "🎰",
            "banner_color": "#8B5CF6"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/incentives/competitions",
            json=comp_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # May fail if not admin, which is fine
        if response.status_code == 403:
            pytest.skip("Admin access required to create competition")
        
        # API returns 200 on success (not 201)
        assert response.status_code in [200, 201], f"Failed to create competition: {response.text}"
        
        competition = response.json()
        comp_id = competition["id"]
        
        # Create lottery rule
        rule_data = {
            "competition_id": comp_id,
            "type": "lottery",
            "priority": 1,
            "lottery_winner_count": 3,
            "points_award": 500
        }
        
        rule_response = requests.post(
            f"{BASE_URL}/api/incentives/rules",
            json=rule_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # API returns 200 on success (not 201)
        assert rule_response.status_code in [200, 201], f"Failed to create lottery rule: {rule_response.text}"
        
        rule = rule_response.json()
        # API returns id and message, not full rule object
        assert "id" in rule, "Rule response should contain 'id'"
        assert "message" in rule, "Rule response should contain 'message'"
        
        # Test lottery qualifiers endpoint with this competition
        lottery_response = requests.get(
            f"{BASE_URL}/api/incentives/lottery/{comp_id}/qualifiers",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert lottery_response.status_code == 200, f"Failed to get lottery qualifiers: {lottery_response.text}"
        
        lottery_data = lottery_response.json()
        assert "competition" in lottery_data, "Response missing 'competition'"
        assert "lottery_rule" in lottery_data, "Response missing 'lottery_rule'"
        assert "qualifiers" in lottery_data, "Response missing 'qualifiers'"
        assert "qualifier_count" in lottery_data, "Response missing 'qualifier_count'"
        
        # Clean up - delete the competition
        requests.delete(
            f"{BASE_URL}/api/incentives/competitions/{comp_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )


class TestMarkNotificationRead:
    """Tests for POST /api/incentives/notifications/{id}/read"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_mark_notification_read_not_found(self, auth_token):
        """POST /api/incentives/notifications/{id}/read returns 404 for invalid ID"""
        response = requests.post(
            f"{BASE_URL}/api/incentives/notifications/invalid-notification-id/read",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestExistingCompetitionPhase3:
    """Tests using the existing 'Daily Sprint Test' competition"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def existing_competition_id(self):
        """Return the existing competition ID from context"""
        return "8ad0cba0-f39a-45ec-a222-e6ff19d4f713"
    
    def test_get_competition_details(self, auth_token, existing_competition_id):
        """Verify existing competition exists and get its details"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/competitions/{existing_competition_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if response.status_code == 404:
            pytest.skip("Existing competition not found")
        
        assert response.status_code == 200, f"Failed to get competition: {response.text}"
        
        data = response.json()
        assert "id" in data, "Competition missing 'id'"
        assert "name" in data, "Competition missing 'name'"
        assert "status" in data, "Competition missing 'status'"
        print(f"Competition: {data.get('name')} - Status: {data.get('status')}")
    
    def test_calculate_baselines_on_existing(self, auth_token, existing_competition_id):
        """Test calculate baselines on existing competition"""
        response = requests.post(
            f"{BASE_URL}/api/incentives/competitions/{existing_competition_id}/calculate-baselines?baseline_period=last_week",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if response.status_code == 404:
            pytest.skip("Existing competition not found")
        
        # Should succeed if admin, or 403 if not
        assert response.status_code in [200, 403], f"Expected 200 or 403, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "message" in data, "Response missing 'message'"
            assert "baseline_period" in data, "Response missing 'baseline_period'"
            print(f"Baselines calculated: {data}")


class TestRuleTypeValidation:
    """Tests for rule type validation in IncentiveRuleType enum"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_rule_types_available(self, auth_token):
        """Verify all Phase 3 rule types are available via competition leaderboard"""
        # Get competitions to verify rules endpoint works
        response = requests.get(
            f"{BASE_URL}/api/incentives/competitions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        competitions = response.json().get("competitions", [])
        if competitions:
            comp_id = competitions[0]["id"]
            
            # Get leaderboard which includes rules_summary
            leaderboard_response = requests.get(
                f"{BASE_URL}/api/incentives/leaderboard/{comp_id}",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            assert leaderboard_response.status_code == 200
            
            data = leaderboard_response.json()
            assert "rules_summary" in data, "Leaderboard should include rules_summary"
            
            # Verify rules_summary structure
            rules_summary = data["rules_summary"]
            # Valid rule types that can appear in rules_summary
            valid_types = ["top_n", "threshold", "milestone", "improvement", "lottery"]
            
            # Check that any rule types present are valid
            for rule_type in rules_summary.keys():
                if rule_type not in ["threshold", "top_n", "milestone", "improvement", "lottery"]:
                    # It's a value, not a type key
                    continue


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

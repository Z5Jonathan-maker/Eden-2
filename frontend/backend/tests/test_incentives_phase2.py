"""
Test Suite for Eden Incentives Engine - Phase 2
Tests for: Leaderboards, Event Tracking, Dashboard, and Results APIs

Features tested:
- GET /api/incentives/leaderboard/{id} - Returns ranked participants
- POST /api/incentives/events/harvest - Records metric events and updates competitions
- GET /api/incentives/me/dashboard - Returns active competitions with progress
- GET /api/incentives/results/{id} - Returns final competition results
- Metric events update leaderboard rankings
- Rule evaluator triggers notifications for threshold approaching/reached
"""

import pytest
import requests
import os
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@eden.com"
TEST_PASSWORD = "password"


class TestIncentivesPhase2Auth:
    """Authentication tests for Phase 2 endpoints"""
    
    def test_leaderboard_requires_auth(self):
        """Test that leaderboard endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/incentives/leaderboard/test-id")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_harvest_events_requires_auth(self):
        """Test that harvest events endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/incentives/events/harvest?event_type=visit_logged&status=NH")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_dashboard_requires_auth(self):
        """Test that dashboard endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/incentives/me/dashboard")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_results_requires_auth(self):
        """Test that results endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/incentives/results/test-id")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestIncentivesDashboard:
    """Tests for GET /api/incentives/me/dashboard"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_dashboard_returns_active_competitions(self, auth_token):
        """GET /api/incentives/me/dashboard returns active competitions"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/me/dashboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to get dashboard: {response.text}"
        
        data = response.json()
        assert "active_competitions" in data, "Response missing 'active_competitions'"
        assert "total_points" in data, "Response missing 'total_points'"
        assert "recent_achievements" in data, "Response missing 'recent_achievements'"
        assert "active_season" in data, "Response missing 'active_season'"
    
    def test_dashboard_competitions_have_progress(self, auth_token):
        """Dashboard competitions include user progress data"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/me/dashboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        competitions = data["active_competitions"]
        
        if competitions:
            comp = competitions[0]
            # Verify competition structure
            assert "id" in comp, "Competition missing 'id'"
            assert "name" in comp, "Competition missing 'name'"
            assert "time_remaining" in comp, "Competition missing 'time_remaining'"
            assert "metric" in comp, "Competition missing 'metric'"
            assert "my_progress" in comp, "Competition missing 'my_progress'"
            assert "leader" in comp, "Competition missing 'leader'"
            
            # Verify progress structure
            progress = comp["my_progress"]
            assert "current_value" in progress, "Progress missing 'current_value'"
            assert "target_value" in progress, "Progress missing 'target_value'"
            assert "rank" in progress, "Progress missing 'rank'"
            assert "progress_percent" in progress, "Progress missing 'progress_percent'"
            
            # Verify leader structure
            leader = comp["leader"]
            assert "name" in leader, "Leader missing 'name'"
            assert "value" in leader, "Leader missing 'value'"
    
    def test_dashboard_has_total_points(self, auth_token):
        """Dashboard includes total points"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/me/dashboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data["total_points"], (int, float)), "total_points should be numeric"


class TestIncentivesLeaderboard:
    """Tests for GET /api/incentives/leaderboard/{competition_id}"""
    
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
    def active_competition_id(self, auth_token):
        """Get an active competition ID"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/competitions?status=active",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        competitions = response.json().get("competitions", [])
        if not competitions:
            pytest.skip("No active competitions found")
        
        return competitions[0]["id"]
    
    def test_leaderboard_returns_ranked_participants(self, auth_token, active_competition_id):
        """GET /api/incentives/leaderboard/{id} returns ranked participants"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/leaderboard/{active_competition_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to get leaderboard: {response.text}"
        
        data = response.json()
        assert "competition" in data, "Response missing 'competition'"
        assert "leaderboard" in data, "Response missing 'leaderboard'"
        assert "my_position" in data, "Response missing 'my_position'"
        assert "my_rank" in data, "Response missing 'my_rank'"
        assert "total_participants" in data, "Response missing 'total_participants'"
        assert "rules_summary" in data, "Response missing 'rules_summary'"
        assert "pagination" in data, "Response missing 'pagination'"
    
    def test_leaderboard_participants_have_ranks(self, auth_token, active_competition_id):
        """Leaderboard participants have rank information"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/leaderboard/{active_competition_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        leaderboard = data["leaderboard"]
        
        if leaderboard:
            # Verify participants are ranked
            for i, participant in enumerate(leaderboard):
                assert "rank" in participant, f"Participant {i} missing 'rank'"
                assert "current_value" in participant, f"Participant {i} missing 'current_value'"
                assert "user_name" in participant, f"Participant {i} missing 'user_name'"
                assert participant["rank"] == i + 1, f"Participant {i} has wrong rank"
    
    def test_leaderboard_shows_gap_to_qualify(self, auth_token, active_competition_id):
        """Leaderboard shows gap to qualify for threshold rules"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/leaderboard/{active_competition_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        rules_summary = data["rules_summary"]
        
        # If there's a threshold rule, participants should have gap_to_qualify
        if rules_summary.get("threshold"):
            threshold = rules_summary["threshold"]
            for participant in data["leaderboard"]:
                if participant["current_value"] < threshold:
                    assert "gap_to_qualify" in participant, "Participant below threshold missing 'gap_to_qualify'"
    
    def test_leaderboard_competition_info(self, auth_token, active_competition_id):
        """Leaderboard includes competition info"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/leaderboard/{active_competition_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        competition = data["competition"]
        
        assert "id" in competition, "Competition missing 'id'"
        assert "name" in competition, "Competition missing 'name'"
        assert "status" in competition, "Competition missing 'status'"
        assert "time_remaining" in competition, "Competition missing 'time_remaining'"
        assert "metric" in competition, "Competition missing 'metric'"
    
    def test_leaderboard_not_found(self, auth_token):
        """GET /api/incentives/leaderboard/{id} returns 404 for invalid ID"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/leaderboard/invalid-competition-id",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestIncentivesHarvestEvents:
    """Tests for POST /api/incentives/events/harvest"""
    
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
    def active_competition_id(self, auth_token):
        """Get an active competition ID"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/competitions?status=active",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        competitions = response.json().get("competitions", [])
        if not competitions:
            pytest.skip("No active competitions found")
        
        return competitions[0]["id"]
    
    def test_harvest_event_records_door_knock(self, auth_token, active_competition_id):
        """POST /api/incentives/events/harvest records door knock (NH status)"""
        # Get initial value
        initial_response = requests.get(
            f"{BASE_URL}/api/incentives/leaderboard/{active_competition_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert initial_response.status_code == 200
        initial_value = initial_response.json()["my_position"]["current_value"]
        
        # Record harvest event
        response = requests.post(
            f"{BASE_URL}/api/incentives/events/harvest?event_type=visit_logged&status=NH&value=1",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to record harvest event: {response.text}"
        
        data = response.json()
        assert data["success"] == True, "Event recording should succeed"
        assert "affected_competitions" in data, "Response missing 'affected_competitions'"
        assert "notifications" in data, "Response missing 'notifications'"
        assert "rank_changes" in data, "Response missing 'rank_changes'"
        assert "qualifications" in data, "Response missing 'qualifications'"
        
        # Verify value was updated
        updated_response = requests.get(
            f"{BASE_URL}/api/incentives/leaderboard/{active_competition_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert updated_response.status_code == 200
        updated_value = updated_response.json()["my_position"]["current_value"]
        
        assert updated_value == initial_value + 1, f"Value should increase by 1: {initial_value} -> {updated_value}"
    
    def test_harvest_event_affects_competitions(self, auth_token):
        """Harvest event returns affected competitions"""
        response = requests.post(
            f"{BASE_URL}/api/incentives/events/harvest?event_type=visit_logged&status=NH&value=1",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Should affect at least one competition (the active ones using doors metric)
        assert len(data["affected_competitions"]) > 0, "Should affect at least one competition"
    
    def test_harvest_event_contact_status(self, auth_token):
        """Harvest event with contact status (NI) updates multiple metrics"""
        response = requests.post(
            f"{BASE_URL}/api/incentives/events/harvest?event_type=visit_logged&status=NI&value=1",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to record NI event: {response.text}"
        
        data = response.json()
        assert data["success"] == True
    
    def test_harvest_event_appointment_status(self, auth_token):
        """Harvest event with appointment status (AP) updates doors, contacts, appointments"""
        response = requests.post(
            f"{BASE_URL}/api/incentives/events/harvest?event_type=visit_logged&status=AP&value=1",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to record AP event: {response.text}"
        
        data = response.json()
        assert data["success"] == True


class TestIncentivesResults:
    """Tests for GET /api/incentives/results/{competition_id}"""
    
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
    def active_competition_id(self, auth_token):
        """Get an active competition ID"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/competitions?status=active",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        competitions = response.json().get("competitions", [])
        if not competitions:
            pytest.skip("No active competitions found")
        
        return competitions[0]["id"]
    
    def test_results_not_available_for_active_competition(self, auth_token, active_competition_id):
        """GET /api/incentives/results/{id} returns 400 for active competition"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/results/{active_competition_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        assert "not yet completed" in data["detail"].lower()
    
    def test_results_not_found(self, auth_token):
        """GET /api/incentives/results/{id} returns 404 for invalid ID"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/results/invalid-competition-id",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestIncentivesMetricEventTracking:
    """Tests for metric event tracking and leaderboard updates"""
    
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
    def active_competition_id(self, auth_token):
        """Get an active competition ID"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/competitions?status=active",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        competitions = response.json().get("competitions", [])
        if not competitions:
            pytest.skip("No active competitions found")
        
        return competitions[0]["id"]
    
    def test_activity_count_increments(self, auth_token, active_competition_id):
        """Activity count increments with each event"""
        # Get initial activity count
        initial_response = requests.get(
            f"{BASE_URL}/api/incentives/leaderboard/{active_competition_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert initial_response.status_code == 200
        initial_count = initial_response.json()["my_position"]["activity_count"]
        
        # Record event
        requests.post(
            f"{BASE_URL}/api/incentives/events/harvest?event_type=visit_logged&status=NH&value=1",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Verify activity count increased
        updated_response = requests.get(
            f"{BASE_URL}/api/incentives/leaderboard/{active_competition_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert updated_response.status_code == 200
        updated_count = updated_response.json()["my_position"]["activity_count"]
        
        assert updated_count == initial_count + 1, f"Activity count should increase: {initial_count} -> {updated_count}"
    
    def test_peak_value_tracks_highest(self, auth_token, active_competition_id):
        """Peak value tracks highest value achieved"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/leaderboard/{active_competition_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        my_position = response.json()["my_position"]
        assert "peak_value" in my_position, "Missing 'peak_value'"
        assert my_position["peak_value"] >= my_position["current_value"], "Peak should be >= current"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

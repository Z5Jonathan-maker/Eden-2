"""
Test Suite for Eden Incentives Engine - Phase 1
Tests for: Metrics, Templates, Seasons, Competitions, and Lifecycle Management

Features tested:
- GET /api/incentives/metrics - Returns 10 seeded metrics
- GET /api/incentives/templates - Returns 7 seeded templates
- POST /api/incentives/seasons - Creates a new season
- GET /api/incentives/seasons - Returns created seasons
- POST /api/incentives/competitions/from-template - Creates competition from template
- GET /api/incentives/competitions - Returns competitions list
- POST /api/incentives/competitions/{id}/start - Starts a scheduled competition
"""

import pytest
import requests
import os
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@eden.com"
TEST_PASSWORD = "password"


class TestIncentivesEngineAuth:
    """Authentication tests for Incentives Engine"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in login response"
        return data["access_token"]
    
    def test_metrics_requires_auth(self):
        """Test that metrics endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/incentives/metrics")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_templates_requires_auth(self):
        """Test that templates endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/incentives/templates")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_seasons_requires_auth(self):
        """Test that seasons endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/incentives/seasons")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_competitions_requires_auth(self):
        """Test that competitions endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/incentives/competitions")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestIncentivesMetrics:
    """Tests for Metrics API - 10 seeded KPIs"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_get_metrics_returns_10_seeded(self, auth_token):
        """GET /api/incentives/metrics returns 10 seeded metrics"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/metrics",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to get metrics: {response.text}"
        
        data = response.json()
        assert "metrics" in data, "Response missing 'metrics' key"
        assert "count" in data, "Response missing 'count' key"
        
        metrics = data["metrics"]
        assert len(metrics) == 10, f"Expected 10 metrics, got {len(metrics)}"
        assert data["count"] == 10, f"Expected count=10, got {data['count']}"
    
    def test_metrics_have_required_fields(self, auth_token):
        """Verify each metric has required fields"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/metrics",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        metrics = response.json()["metrics"]
        required_fields = ["id", "slug", "name", "description", "aggregation", "icon", "unit", "is_system"]
        
        for metric in metrics:
            for field in required_fields:
                assert field in metric, f"Metric {metric.get('id', 'unknown')} missing field: {field}"
    
    def test_metrics_include_expected_kpis(self, auth_token):
        """Verify expected KPIs are present"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/metrics",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        metrics = response.json()["metrics"]
        slugs = [m["slug"] for m in metrics]
        
        expected_slugs = ["doors", "contacts", "appointments", "contracts", "points", 
                         "revenue", "installs", "reviews", "referrals", "close_rate"]
        
        for expected in expected_slugs:
            assert expected in slugs, f"Missing expected metric: {expected}"
    
    def test_get_single_metric(self, auth_token):
        """GET /api/incentives/metrics/{metric_id} returns specific metric"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/metrics/metric-doors",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to get metric: {response.text}"
        
        metric = response.json()
        assert metric["id"] == "metric-doors"
        assert metric["slug"] == "doors"
        assert metric["name"] == "Doors Knocked"


class TestIncentivesTemplates:
    """Tests for Competition Templates API - 7 built-in templates"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_get_templates_returns_7_seeded(self, auth_token):
        """GET /api/incentives/templates returns 7 seeded templates"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/templates",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to get templates: {response.text}"
        
        data = response.json()
        assert "templates" in data, "Response missing 'templates' key"
        assert "count" in data, "Response missing 'count' key"
        
        templates = data["templates"]
        assert len(templates) == 7, f"Expected 7 templates, got {len(templates)}"
        assert data["count"] == 7, f"Expected count=7, got {data['count']}"
    
    def test_templates_have_required_fields(self, auth_token):
        """Verify each template has required fields"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/templates",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        templates = response.json()["templates"]
        required_fields = ["id", "name", "description", "tagline", "default_metric_id", 
                          "default_duration_type", "default_duration_days", "default_scope",
                          "icon", "banner_color", "category", "is_system"]
        
        for template in templates:
            for field in required_fields:
                assert field in template, f"Template {template.get('id', 'unknown')} missing field: {field}"
    
    def test_templates_include_expected_types(self, auth_token):
        """Verify expected template types are present"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/templates",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        templates = response.json()["templates"]
        names = [t["name"] for t in templates]
        
        expected_names = ["Daily Sprint", "Weekend Blitz", "Weekly Ladder", 
                         "Monthly Championship", "Office Battle", "New Rep Challenge", "Storm Response"]
        
        for expected in expected_names:
            assert expected in names, f"Missing expected template: {expected}"
    
    def test_get_single_template(self, auth_token):
        """GET /api/incentives/templates/{template_id} returns specific template"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/templates/template-daily-sprint",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to get template: {response.text}"
        
        template = response.json()
        assert template["id"] == "template-daily-sprint"
        assert template["name"] == "Daily Sprint"
        assert template["category"] == "sprint"


class TestIncentivesSeasons:
    """Tests for Seasons API - CRUD operations"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_create_season(self, auth_token):
        """POST /api/incentives/seasons creates a new season"""
        start_date = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat().replace('+00:00', 'Z')
        end_date = (datetime.now(timezone.utc) + timedelta(days=97)).isoformat().replace('+00:00', 'Z')
        
        payload = {
            "name": "TEST_Q1_2026_Season",
            "description": "Test season for Q1 2026",
            "start_date": start_date,
            "end_date": end_date,
            "theme_name": "Winter Warriors",
            "theme_color": "#3B82F6"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/incentives/seasons",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json=payload
        )
        assert response.status_code == 200, f"Failed to create season: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response missing 'id'"
        assert "status" in data, "Response missing 'status'"
        assert data["status"] == "upcoming", f"Expected status 'upcoming', got {data['status']}"
        assert "message" in data, "Response missing 'message'"
        
        # Store season_id for later tests
        TestIncentivesSeasons.created_season_id = data["id"]
    
    def test_get_seasons_returns_created(self, auth_token):
        """GET /api/incentives/seasons returns created seasons"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/seasons",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to get seasons: {response.text}"
        
        data = response.json()
        assert "seasons" in data, "Response missing 'seasons' key"
        
        seasons = data["seasons"]
        # Find our test season
        test_seasons = [s for s in seasons if s["name"].startswith("TEST_")]
        assert len(test_seasons) > 0, "Created test season not found in list"
    
    def test_get_single_season(self, auth_token):
        """GET /api/incentives/seasons/{season_id} returns specific season"""
        season_id = getattr(TestIncentivesSeasons, 'created_season_id', None)
        if not season_id:
            pytest.skip("No season created in previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/incentives/seasons/{season_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to get season: {response.text}"
        
        season = response.json()
        assert season["id"] == season_id
        assert season["name"] == "TEST_Q1_2026_Season"
        assert "competitions" in season
        assert "standings" in season


class TestIncentivesCompetitions:
    """Tests for Competitions API - CRUD and lifecycle management"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_create_competition_from_template(self, auth_token):
        """POST /api/incentives/competitions/from-template creates competition from template"""
        start_date = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat().replace('+00:00', 'Z')
        
        payload = {
            "template_id": "template-daily-sprint",
            "name": "TEST_Daily_Sprint_Competition",
            "start_date": start_date
        }
        
        response = requests.post(
            f"{BASE_URL}/api/incentives/competitions/from-template",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json=payload
        )
        assert response.status_code == 200, f"Failed to create competition: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response missing 'id'"
        assert "status" in data, "Response missing 'status'"
        assert data["status"] == "scheduled", f"Expected status 'scheduled', got {data['status']}"
        assert "message" in data, "Response missing 'message'"
        
        # Store competition_id for later tests
        TestIncentivesCompetitions.created_competition_id = data["id"]
    
    def test_get_competitions_returns_list(self, auth_token):
        """GET /api/incentives/competitions returns competitions list"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/competitions?include_past=true",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to get competitions: {response.text}"
        
        data = response.json()
        assert "competitions" in data, "Response missing 'competitions' key"
        
        competitions = data["competitions"]
        # Find our test competition
        test_comps = [c for c in competitions if c["name"].startswith("TEST_")]
        assert len(test_comps) > 0, "Created test competition not found in list"
    
    def test_get_single_competition(self, auth_token):
        """GET /api/incentives/competitions/{competition_id} returns specific competition"""
        comp_id = getattr(TestIncentivesCompetitions, 'created_competition_id', None)
        if not comp_id:
            pytest.skip("No competition created in previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/incentives/competitions/{comp_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to get competition: {response.text}"
        
        competition = response.json()
        assert competition["id"] == comp_id
        assert competition["name"] == "TEST_Daily_Sprint_Competition"
        assert "metric" in competition
        assert "rules" in competition
        assert "leaderboard" in competition
        assert "time_remaining" in competition
    
    def test_start_scheduled_competition(self, auth_token):
        """POST /api/incentives/competitions/{id}/start starts a scheduled competition"""
        comp_id = getattr(TestIncentivesCompetitions, 'created_competition_id', None)
        if not comp_id:
            pytest.skip("No competition created in previous test")
        
        response = requests.post(
            f"{BASE_URL}/api/incentives/competitions/{comp_id}/start",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to start competition: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert data["message"] == "Competition started"
        
        # Verify competition is now active
        verify_response = requests.get(
            f"{BASE_URL}/api/incentives/competitions/{comp_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert verify_response.status_code == 200
        assert verify_response.json()["status"] == "active"
    
    def test_competition_has_enriched_data(self, auth_token):
        """Verify competition list returns enriched data (time_remaining, leader, etc.)"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/competitions?include_past=true",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        competitions = response.json()["competitions"]
        if competitions:
            comp = competitions[0]
            assert "time_remaining" in comp, "Missing time_remaining"
            assert "leader" in comp, "Missing leader info"


class TestIncentivesCompetitionRules:
    """Tests for Competition Rules API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_get_competition_rules(self, auth_token):
        """GET /api/incentives/competitions/{id}/rules returns rules"""
        comp_id = getattr(TestIncentivesCompetitions, 'created_competition_id', None)
        if not comp_id:
            pytest.skip("No competition created in previous test")
        
        response = requests.get(
            f"{BASE_URL}/api/incentives/competitions/{comp_id}/rules",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to get rules: {response.text}"
        
        data = response.json()
        assert "rules" in data, "Response missing 'rules' key"


class TestIncentivesMyCompetitions:
    """Tests for user's competition participations"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_get_my_competitions(self, auth_token):
        """GET /api/incentives/me/competitions returns user's competitions"""
        response = requests.get(
            f"{BASE_URL}/api/incentives/me/competitions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed to get my competitions: {response.text}"
        
        data = response.json()
        assert "competitions" in data, "Response missing 'competitions' key"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

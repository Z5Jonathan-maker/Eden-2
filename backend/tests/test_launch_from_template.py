"""
Test: Launch Competition from Template Feature
Tests the POST /api/incentives/competitions/from-template endpoint
and related functionality for creating competitions from templates.
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLaunchFromTemplate:
    """Tests for the Launch Competition from Template feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.token = token
        else:
            pytest.skip("Authentication failed - skipping tests")
        
        yield
        
        # Cleanup: Delete test competitions created during tests
        self._cleanup_test_data()
    
    def _cleanup_test_data(self):
        """Clean up test data created during tests"""
        try:
            # Get all competitions and delete TEST_ prefixed ones
            response = self.session.get(f"{BASE_URL}/api/incentives/competitions?include_past=true")
            if response.status_code == 200:
                competitions = response.json().get("competitions", [])
                for comp in competitions:
                    if comp.get("name", "").startswith("TEST_"):
                        self.session.delete(f"{BASE_URL}/api/incentives/competitions/{comp['id']}")
        except Exception:
            pass
    
    # ============================================
    # TEMPLATE LISTING TESTS
    # ============================================
    
    def test_get_templates_returns_list(self):
        """Test GET /api/incentives/templates returns template list"""
        response = self.session.get(f"{BASE_URL}/api/incentives/templates")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "templates" in data, "Response should contain 'templates' key"
        assert "count" in data, "Response should contain 'count' key"
        assert len(data["templates"]) > 0, "Should have at least one template"
        
        # Verify template structure
        template = data["templates"][0]
        assert "id" in template, "Template should have 'id'"
        assert "name" in template, "Template should have 'name'"
        assert "default_duration_days" in template, "Template should have 'default_duration_days'"
        assert "default_rules" in template, "Template should have 'default_rules'"
        print(f"SUCCESS: Found {len(data['templates'])} templates")
    
    def test_templates_have_launch_button_data(self):
        """Test that templates have all data needed for Launch button"""
        response = self.session.get(f"{BASE_URL}/api/incentives/templates")
        
        assert response.status_code == 200
        
        templates = response.json().get("templates", [])
        
        for template in templates:
            # Check required fields for Launch dialog
            assert "id" in template, f"Template {template.get('name')} missing 'id'"
            assert "name" in template, f"Template {template.get('id')} missing 'name'"
            assert "default_duration_days" in template, f"Template {template.get('name')} missing 'default_duration_days'"
            assert "default_metric_id" in template, f"Template {template.get('name')} missing 'default_metric_id'"
            assert "icon" in template, f"Template {template.get('name')} missing 'icon'"
            assert "banner_color" in template, f"Template {template.get('name')} missing 'banner_color'"
            
            # Check times_used for usage tracking
            assert "times_used" in template, f"Template {template.get('name')} missing 'times_used'"
            
            print(f"Template '{template['name']}': duration={template['default_duration_days']} days, used={template['times_used']} times")
    
    # ============================================
    # CREATE FROM TEMPLATE TESTS
    # ============================================
    
    def test_create_competition_from_template_success(self):
        """Test POST /api/incentives/competitions/from-template creates competition"""
        # First get a template
        templates_response = self.session.get(f"{BASE_URL}/api/incentives/templates")
        assert templates_response.status_code == 200
        
        templates = templates_response.json().get("templates", [])
        assert len(templates) > 0, "Need at least one template"
        
        template = templates[0]
        template_id = template["id"]
        initial_times_used = template.get("times_used", 0)
        
        # Calculate dates
        start_date = datetime.utcnow() + timedelta(hours=1)
        end_date = start_date + timedelta(days=template.get("default_duration_days", 7))
        
        # Create competition from template
        payload = {
            "template_id": template_id,
            "name": f"TEST_February_{template['name']}",
            "start_date": start_date.isoformat() + "Z",
            "end_date": end_date.isoformat() + "Z",
            "season_id": None,
            "auto_start": True
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/incentives/competitions/from-template",
            json=payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain competition 'id'"
        assert "status" in data, "Response should contain 'status'"
        
        competition_id = data["id"]
        print(f"SUCCESS: Created competition {competition_id} from template {template_id}")
        
        # Verify competition was created
        comp_response = self.session.get(f"{BASE_URL}/api/incentives/competitions/{competition_id}")
        assert comp_response.status_code == 200, "Should be able to fetch created competition"
        
        comp_data = comp_response.json()
        assert comp_data["name"] == payload["name"], "Competition name should match"
        assert comp_data["template_id"] == template_id, "Template ID should be set"
        
        return competition_id
    
    def test_create_from_template_increments_usage_count(self):
        """Test that creating from template increments times_used"""
        # Get initial template state
        templates_response = self.session.get(f"{BASE_URL}/api/incentives/templates")
        assert templates_response.status_code == 200
        
        templates = templates_response.json().get("templates", [])
        template = templates[0]
        template_id = template["id"]
        initial_times_used = template.get("times_used", 0)
        
        # Create competition
        start_date = datetime.utcnow() + timedelta(hours=1)
        end_date = start_date + timedelta(days=7)
        
        payload = {
            "template_id": template_id,
            "name": f"TEST_Usage_Count_{datetime.utcnow().timestamp()}",
            "start_date": start_date.isoformat() + "Z",
            "end_date": end_date.isoformat() + "Z"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/incentives/competitions/from-template",
            json=payload
        )
        assert response.status_code == 200
        
        # Check template usage count increased
        templates_response = self.session.get(f"{BASE_URL}/api/incentives/templates")
        templates = templates_response.json().get("templates", [])
        updated_template = next((t for t in templates if t["id"] == template_id), None)
        
        assert updated_template is not None, "Template should still exist"
        new_times_used = updated_template.get("times_used", 0)
        
        assert new_times_used == initial_times_used + 1, \
            f"times_used should increment from {initial_times_used} to {initial_times_used + 1}, got {new_times_used}"
        
        print(f"SUCCESS: Template usage count incremented from {initial_times_used} to {new_times_used}")
    
    def test_create_from_template_copies_rules(self):
        """Test that rules are copied from template to competition"""
        # Get template with rules
        templates_response = self.session.get(f"{BASE_URL}/api/incentives/templates")
        templates = templates_response.json().get("templates", [])
        
        # Find a template with rules
        template_with_rules = next(
            (t for t in templates if t.get("default_rules") and len(t["default_rules"]) > 0),
            None
        )
        
        if not template_with_rules:
            pytest.skip("No template with rules found")
        
        template_id = template_with_rules["id"]
        expected_rules = template_with_rules["default_rules"]
        
        # Create competition
        start_date = datetime.utcnow() + timedelta(hours=1)
        end_date = start_date + timedelta(days=7)
        
        payload = {
            "template_id": template_id,
            "name": f"TEST_Rules_Copy_{datetime.utcnow().timestamp()}",
            "start_date": start_date.isoformat() + "Z",
            "end_date": end_date.isoformat() + "Z"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/incentives/competitions/from-template",
            json=payload
        )
        assert response.status_code == 200
        
        competition_id = response.json()["id"]
        
        # Get competition rules
        rules_response = self.session.get(f"{BASE_URL}/api/incentives/competitions/{competition_id}/rules")
        assert rules_response.status_code == 200
        
        rules = rules_response.json().get("rules", [])
        
        # Verify rules were copied
        assert len(rules) == len(expected_rules), \
            f"Expected {len(expected_rules)} rules, got {len(rules)}"
        
        # Check rule types match
        expected_types = [r.get("type") for r in expected_rules]
        actual_types = [r.get("type") for r in rules]
        
        for expected_type in expected_types:
            assert expected_type in actual_types, f"Rule type '{expected_type}' should be copied"
        
        print(f"SUCCESS: {len(rules)} rules copied from template")
    
    def test_create_from_template_with_season(self):
        """Test creating competition from template with season assignment"""
        # Get templates
        templates_response = self.session.get(f"{BASE_URL}/api/incentives/templates")
        templates = templates_response.json().get("templates", [])
        template = templates[0]
        
        # Get or create a season
        seasons_response = self.session.get(f"{BASE_URL}/api/incentives/seasons")
        seasons = seasons_response.json().get("seasons", [])
        
        season_id = None
        if seasons:
            season_id = seasons[0]["id"]
        else:
            # Create a test season
            season_payload = {
                "name": "TEST_Season_For_Template",
                "description": "Test season",
                "start_date": datetime.utcnow().isoformat() + "Z",
                "end_date": (datetime.utcnow() + timedelta(days=90)).isoformat() + "Z"
            }
            season_response = self.session.post(f"{BASE_URL}/api/incentives/seasons", json=season_payload)
            if season_response.status_code == 200:
                season_id = season_response.json().get("id")
        
        if not season_id:
            pytest.skip("Could not get or create season")
        
        # Create competition with season
        start_date = datetime.utcnow() + timedelta(hours=1)
        end_date = start_date + timedelta(days=7)
        
        payload = {
            "template_id": template["id"],
            "name": f"TEST_With_Season_{datetime.utcnow().timestamp()}",
            "start_date": start_date.isoformat() + "Z",
            "end_date": end_date.isoformat() + "Z",
            "season_id": season_id
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/incentives/competitions/from-template",
            json=payload
        )
        assert response.status_code == 200
        
        competition_id = response.json()["id"]
        
        # Verify season assignment
        comp_response = self.session.get(f"{BASE_URL}/api/incentives/competitions/{competition_id}")
        assert comp_response.status_code == 200
        
        comp_data = comp_response.json()
        assert comp_data.get("season_id") == season_id, "Season ID should be set"
        
        print(f"SUCCESS: Competition created with season {season_id}")
    
    def test_create_from_template_invalid_template_id(self):
        """Test that invalid template_id returns 404"""
        start_date = datetime.utcnow() + timedelta(hours=1)
        
        payload = {
            "template_id": "invalid-template-id-12345",
            "name": "TEST_Invalid_Template",
            "start_date": start_date.isoformat() + "Z"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/incentives/competitions/from-template",
            json=payload
        )
        
        assert response.status_code == 404, f"Expected 404 for invalid template, got {response.status_code}"
        print("SUCCESS: Invalid template ID returns 404")
    
    def test_create_from_template_missing_required_fields(self):
        """Test that missing required fields return 422"""
        # Missing name
        payload = {
            "template_id": "template-weekend-blitz",
            "start_date": datetime.utcnow().isoformat() + "Z"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/incentives/competitions/from-template",
            json=payload
        )
        
        assert response.status_code == 422, f"Expected 422 for missing name, got {response.status_code}"
        print("SUCCESS: Missing required fields returns 422")
    
    # ============================================
    # COMPETITION APPEARS IN LIST TESTS
    # ============================================
    
    def test_created_competition_appears_in_list(self):
        """Test that competition created from template appears in competitions list"""
        # Get templates
        templates_response = self.session.get(f"{BASE_URL}/api/incentives/templates")
        templates = templates_response.json().get("templates", [])
        template = templates[0]
        
        # Create competition
        start_date = datetime.utcnow() + timedelta(hours=1)
        end_date = start_date + timedelta(days=7)
        comp_name = f"TEST_Appears_In_List_{datetime.utcnow().timestamp()}"
        
        payload = {
            "template_id": template["id"],
            "name": comp_name,
            "start_date": start_date.isoformat() + "Z",
            "end_date": end_date.isoformat() + "Z"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/incentives/competitions/from-template",
            json=payload
        )
        assert response.status_code == 200
        
        competition_id = response.json()["id"]
        
        # Check competition appears in list
        list_response = self.session.get(f"{BASE_URL}/api/incentives/competitions?include_past=true")
        assert list_response.status_code == 200
        
        competitions = list_response.json().get("competitions", [])
        comp_ids = [c["id"] for c in competitions]
        
        assert competition_id in comp_ids, "Created competition should appear in list"
        
        # Find the competition and verify details
        created_comp = next((c for c in competitions if c["id"] == competition_id), None)
        assert created_comp is not None, "Should find created competition"
        assert created_comp["name"] == comp_name, "Competition name should match"
        assert created_comp["template_id"] == template["id"], "Template ID should be set"
        
        print(f"SUCCESS: Competition {competition_id} appears in competitions list")
    
    # ============================================
    # SEASONS DROPDOWN TESTS
    # ============================================
    
    def test_seasons_endpoint_for_dropdown(self):
        """Test GET /api/incentives/seasons returns data for dropdown"""
        response = self.session.get(f"{BASE_URL}/api/incentives/seasons")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "seasons" in data, "Response should contain 'seasons' key"
        
        # Seasons can be empty, but endpoint should work
        seasons = data["seasons"]
        
        for season in seasons:
            assert "id" in season, "Season should have 'id'"
            assert "name" in season, "Season should have 'name'"
            assert "status" in season, "Season should have 'status'"
            
            # Check status is valid
            assert season["status"] in ["upcoming", "active", "completed"], \
                f"Invalid season status: {season['status']}"
        
        # Count active/upcoming seasons (for dropdown filtering)
        active_upcoming = [s for s in seasons if s["status"] in ["active", "upcoming"]]
        print(f"SUCCESS: Found {len(seasons)} seasons, {len(active_upcoming)} active/upcoming")


class TestTemplateUsageTracking:
    """Tests for template usage tracking"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed")
        
        yield
    
    def test_template_has_times_used_field(self):
        """Test that templates have times_used field"""
        response = self.session.get(f"{BASE_URL}/api/incentives/templates")
        assert response.status_code == 200
        
        templates = response.json().get("templates", [])
        
        for template in templates:
            assert "times_used" in template, f"Template {template['name']} missing times_used"
            assert isinstance(template["times_used"], int), "times_used should be integer"
            assert template["times_used"] >= 0, "times_used should be non-negative"
        
        print("SUCCESS: All templates have times_used field")
    
    def test_template_has_last_used_at_field(self):
        """Test that templates have last_used_at field"""
        response = self.session.get(f"{BASE_URL}/api/incentives/templates")
        assert response.status_code == 200
        
        templates = response.json().get("templates", [])
        
        for template in templates:
            assert "last_used_at" in template, f"Template {template['name']} missing last_used_at"
            # last_used_at can be None if never used
        
        print("SUCCESS: All templates have last_used_at field")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

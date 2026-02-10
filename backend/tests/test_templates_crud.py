"""
Test Templates Tab CRUD Operations and Rules Builder
Tests for Phase 2: Templates Tab with Rules Builder

Endpoints tested:
- GET /api/incentives/templates - List all templates
- POST /api/incentives/templates - Create new template with rules
- PUT /api/incentives/templates/{id} - Update template
- DELETE /api/incentives/templates/{id} - Delete non-system template
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTemplatesCRUD:
    """Test Templates CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
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
    
    def test_get_templates_list(self):
        """Test GET /api/incentives/templates - should return list of templates"""
        response = self.session.get(f"{BASE_URL}/api/incentives/templates")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "templates" in data, "Response should contain 'templates' key"
        assert "count" in data, "Response should contain 'count' key"
        assert isinstance(data["templates"], list), "Templates should be a list"
        
        # Check that system templates are seeded
        if len(data["templates"]) > 0:
            template = data["templates"][0]
            assert "id" in template, "Template should have 'id'"
            assert "name" in template, "Template should have 'name'"
            assert "default_rules" in template or "default_metric_id" in template, "Template should have rules or metric"
        
        print(f"Found {data['count']} templates")
    
    def test_get_templates_with_category_filter(self):
        """Test GET /api/incentives/templates with category filter"""
        response = self.session.get(f"{BASE_URL}/api/incentives/templates?category=sprint")
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned templates should be sprint category
        for template in data["templates"]:
            if "category" in template:
                assert template["category"] == "sprint", f"Expected sprint category, got {template['category']}"
        
        print(f"Found {len(data['templates'])} sprint templates")
    
    def test_get_single_template(self):
        """Test GET /api/incentives/templates/{id}"""
        # First get list to find a template ID
        list_response = self.session.get(f"{BASE_URL}/api/incentives/templates")
        assert list_response.status_code == 200
        
        templates = list_response.json()["templates"]
        if not templates:
            pytest.skip("No templates available to test")
        
        template_id = templates[0]["id"]
        
        # Get single template
        response = self.session.get(f"{BASE_URL}/api/incentives/templates/{template_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == template_id
        assert "name" in data
        print(f"Retrieved template: {data['name']}")
    
    def test_create_template_with_threshold_rule(self):
        """Test POST /api/incentives/templates - Create template with threshold rule"""
        unique_id = str(uuid.uuid4())[:8]
        
        template_data = {
            "name": f"TEST_Threshold_Template_{unique_id}",
            "description": "Test template with threshold rule",
            "tagline": "Hit 50 to win!",
            "icon": "🎯",
            "banner_color": "#F97316",
            "category": "threshold",
            "default_metric_id": "metric-doors",
            "default_duration_type": "week",
            "default_duration_days": 7,
            "default_scope": "individual",
            "default_rules": [
                {
                    "type": "threshold",
                    "config": {"threshold_value": 50},
                    "reward_config": {"points_award": 100}
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/incentives/templates", json=template_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain template ID"
        assert "message" in data, "Response should contain success message"
        
        # Store for cleanup
        self.created_template_id = data["id"]
        print(f"Created template with threshold rule: {data['id']}")
        
        # Verify by fetching
        verify_response = self.session.get(f"{BASE_URL}/api/incentives/templates/{data['id']}")
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["name"] == template_data["name"]
        assert len(verify_data.get("default_rules", [])) == 1
        assert verify_data["default_rules"][0]["type"] == "threshold"
    
    def test_create_template_with_top_n_rule(self):
        """Test POST /api/incentives/templates - Create template with top_n rule"""
        unique_id = str(uuid.uuid4())[:8]
        
        template_data = {
            "name": f"TEST_TopN_Template_{unique_id}",
            "description": "Test template with top N rule",
            "tagline": "Top 5 win prizes!",
            "icon": "👑",
            "banner_color": "#6366F1",
            "category": "ladder",
            "default_metric_id": "metric-points",
            "default_duration_type": "week",
            "default_duration_days": 7,
            "default_scope": "individual",
            "default_rules": [
                {
                    "type": "top_n",
                    "config": {"top_n": 5},
                    "reward_config": {"points_award": 200}
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/incentives/templates", json=template_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        
        print(f"Created template with top_n rule: {data['id']}")
        
        # Verify
        verify_response = self.session.get(f"{BASE_URL}/api/incentives/templates/{data['id']}")
        verify_data = verify_response.json()
        assert verify_data["default_rules"][0]["type"] == "top_n"
        assert verify_data["default_rules"][0]["config"]["top_n"] == 5
    
    def test_create_template_with_milestone_rule(self):
        """Test POST /api/incentives/templates - Create template with milestone rule"""
        unique_id = str(uuid.uuid4())[:8]
        
        template_data = {
            "name": f"TEST_Milestone_Template_{unique_id}",
            "description": "Test template with milestone tiers",
            "tagline": "Reach bronze, silver, gold!",
            "icon": "🏅",
            "banner_color": "#8B5CF6",
            "category": "milestone",
            "default_metric_id": "metric-appointments",
            "default_duration_type": "custom",
            "default_duration_days": 14,
            "default_scope": "individual",
            "default_rules": [
                {
                    "type": "milestone",
                    "config": {
                        "milestones": [
                            {"tier": "bronze", "value": 25},
                            {"tier": "silver", "value": 50},
                            {"tier": "gold", "value": 100}
                        ]
                    },
                    "reward_config": {"points_award": 150}
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/incentives/templates", json=template_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        
        print(f"Created template with milestone rule: {data['id']}")
        
        # Verify milestones
        verify_response = self.session.get(f"{BASE_URL}/api/incentives/templates/{data['id']}")
        verify_data = verify_response.json()
        assert verify_data["default_rules"][0]["type"] == "milestone"
        milestones = verify_data["default_rules"][0]["config"]["milestones"]
        assert len(milestones) == 3
        assert milestones[0]["tier"] == "bronze"
    
    def test_create_template_with_improvement_rule(self):
        """Test POST /api/incentives/templates - Create template with improvement rule"""
        unique_id = str(uuid.uuid4())[:8]
        
        template_data = {
            "name": f"TEST_Improvement_Template_{unique_id}",
            "description": "Test template with improvement rule",
            "tagline": "Beat your baseline by 10%!",
            "icon": "📈",
            "banner_color": "#10B981",
            "category": "threshold",
            "default_metric_id": "metric-doors",
            "default_duration_type": "week",
            "default_duration_days": 7,
            "default_scope": "individual",
            "default_rules": [
                {
                    "type": "improvement",
                    "config": {
                        "improvement_percent": 10,
                        "baseline_period": "last_week"
                    },
                    "reward_config": {"points_award": 100}
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/incentives/templates", json=template_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        
        print(f"Created template with improvement rule: {data['id']}")
        
        # Verify
        verify_response = self.session.get(f"{BASE_URL}/api/incentives/templates/{data['id']}")
        verify_data = verify_response.json()
        assert verify_data["default_rules"][0]["type"] == "improvement"
        assert verify_data["default_rules"][0]["config"]["improvement_percent"] == 10
    
    def test_create_template_with_lottery_rule(self):
        """Test POST /api/incentives/templates - Create template with lottery rule"""
        unique_id = str(uuid.uuid4())[:8]
        
        template_data = {
            "name": f"TEST_Lottery_Template_{unique_id}",
            "description": "Test template with lottery rule",
            "tagline": "Hit 50 to enter the draw!",
            "icon": "🎰",
            "banner_color": "#EC4899",
            "category": "lottery",
            "default_metric_id": "metric-doors",
            "default_duration_type": "week",
            "default_duration_days": 7,
            "default_scope": "individual",
            "default_rules": [
                {
                    "type": "lottery",
                    "config": {
                        "lottery_qualifier_threshold": 50,
                        "lottery_winner_count": 3
                    },
                    "reward_config": {"points_award": 500}
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/incentives/templates", json=template_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        
        print(f"Created template with lottery rule: {data['id']}")
        
        # Verify
        verify_response = self.session.get(f"{BASE_URL}/api/incentives/templates/{data['id']}")
        verify_data = verify_response.json()
        assert verify_data["default_rules"][0]["type"] == "lottery"
        assert verify_data["default_rules"][0]["config"]["lottery_winner_count"] == 3
    
    def test_create_template_with_multiple_rules(self):
        """Test POST /api/incentives/templates - Create template with multiple rules"""
        unique_id = str(uuid.uuid4())[:8]
        
        template_data = {
            "name": f"TEST_MultiRule_Template_{unique_id}",
            "description": "Test template with multiple rules",
            "tagline": "Threshold + Top N combo!",
            "icon": "⚡",
            "banner_color": "#F97316",
            "category": "threshold",
            "default_metric_id": "metric-doors",
            "default_duration_type": "weekend",
            "default_duration_days": 3,
            "default_scope": "individual",
            "default_rules": [
                {
                    "type": "threshold",
                    "config": {"threshold_value": 75},
                    "reward_config": {"points_award": 150}
                },
                {
                    "type": "top_n",
                    "config": {"top_n": 3},
                    "reward_config": {"points_award": 100}
                }
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/incentives/templates", json=template_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        
        print(f"Created template with multiple rules: {data['id']}")
        
        # Verify both rules
        verify_response = self.session.get(f"{BASE_URL}/api/incentives/templates/{data['id']}")
        verify_data = verify_response.json()
        assert len(verify_data["default_rules"]) == 2
        rule_types = [r["type"] for r in verify_data["default_rules"]]
        assert "threshold" in rule_types
        assert "top_n" in rule_types
    
    def test_update_template(self):
        """Test PUT /api/incentives/templates/{id} - Update template"""
        unique_id = str(uuid.uuid4())[:8]
        
        # First create a template
        create_data = {
            "name": f"TEST_Update_Template_{unique_id}",
            "description": "Original description",
            "tagline": "Original tagline",
            "icon": "🎯",
            "banner_color": "#F97316",
            "category": "threshold",
            "default_metric_id": "metric-doors",
            "default_duration_days": 7,
            "default_scope": "individual",
            "default_rules": [
                {
                    "type": "threshold",
                    "config": {"threshold_value": 50},
                    "reward_config": {"points_award": 100}
                }
            ]
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/incentives/templates", json=create_data)
        assert create_response.status_code == 200
        template_id = create_response.json()["id"]
        
        # Update the template
        update_data = {
            "name": f"TEST_Updated_Template_{unique_id}",
            "description": "Updated description",
            "tagline": "Updated tagline - now 75!",
            "icon": "🚀",
            "banner_color": "#6366F1",
            "category": "threshold",
            "default_metric_id": "metric-doors",
            "default_duration_days": 14,
            "default_scope": "individual",
            "default_rules": [
                {
                    "type": "threshold",
                    "config": {"threshold_value": 75},
                    "reward_config": {"points_award": 200}
                }
            ]
        }
        
        update_response = self.session.put(f"{BASE_URL}/api/incentives/templates/{template_id}", json=update_data)
        
        assert update_response.status_code == 200
        
        # Verify update
        verify_response = self.session.get(f"{BASE_URL}/api/incentives/templates/{template_id}")
        verify_data = verify_response.json()
        
        assert verify_data["name"] == update_data["name"]
        assert verify_data["description"] == update_data["description"]
        assert verify_data["tagline"] == update_data["tagline"]
        assert verify_data["icon"] == update_data["icon"]
        assert verify_data["default_duration_days"] == 14
        assert verify_data["default_rules"][0]["config"]["threshold_value"] == 75
        
        print(f"Successfully updated template: {template_id}")
    
    def test_delete_non_system_template(self):
        """Test DELETE /api/incentives/templates/{id} - Delete non-system template"""
        unique_id = str(uuid.uuid4())[:8]
        
        # First create a template
        create_data = {
            "name": f"TEST_Delete_Template_{unique_id}",
            "description": "Template to be deleted",
            "tagline": "Will be deleted",
            "icon": "🗑️",
            "banner_color": "#EF4444",
            "category": "threshold",
            "default_metric_id": "metric-doors",
            "default_duration_days": 7,
            "default_scope": "individual",
            "default_rules": []
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/incentives/templates", json=create_data)
        assert create_response.status_code == 200
        template_id = create_response.json()["id"]
        
        # Delete the template
        delete_response = self.session.delete(f"{BASE_URL}/api/incentives/templates/{template_id}")
        
        assert delete_response.status_code == 200
        
        # Verify deletion
        verify_response = self.session.get(f"{BASE_URL}/api/incentives/templates/{template_id}")
        assert verify_response.status_code == 404
        
        print(f"Successfully deleted template: {template_id}")
    
    def test_cannot_delete_system_template(self):
        """Test DELETE /api/incentives/templates/{id} - Cannot delete system template"""
        # Get list of templates to find a system template
        list_response = self.session.get(f"{BASE_URL}/api/incentives/templates")
        assert list_response.status_code == 200
        
        templates = list_response.json()["templates"]
        system_template = next((t for t in templates if t.get("is_system")), None)
        
        if not system_template:
            pytest.skip("No system templates found to test")
        
        # Try to delete system template
        delete_response = self.session.delete(f"{BASE_URL}/api/incentives/templates/{system_template['id']}")
        
        assert delete_response.status_code == 400, f"Expected 400 for system template deletion, got {delete_response.status_code}"
        
        # Verify template still exists
        verify_response = self.session.get(f"{BASE_URL}/api/incentives/templates/{system_template['id']}")
        assert verify_response.status_code == 200
        
        print(f"Correctly prevented deletion of system template: {system_template['name']}")
    
    def test_update_nonexistent_template(self):
        """Test PUT /api/incentives/templates/{id} - 404 for non-existent template"""
        fake_id = "template-nonexistent-12345"
        
        update_data = {
            "name": "Should Not Work",
            "description": "This should fail",
            "tagline": "N/A",
            "icon": "❌",
            "banner_color": "#000000",
            "category": "threshold",
            "default_metric_id": "metric-doors",
            "default_duration_days": 7,
            "default_scope": "individual",
            "default_rules": []
        }
        
        response = self.session.put(f"{BASE_URL}/api/incentives/templates/{fake_id}", json=update_data)
        
        assert response.status_code == 404
        print("Correctly returned 404 for non-existent template update")
    
    def test_delete_nonexistent_template(self):
        """Test DELETE /api/incentives/templates/{id} - 404 for non-existent template"""
        fake_id = "template-nonexistent-12345"
        
        response = self.session.delete(f"{BASE_URL}/api/incentives/templates/{fake_id}")
        
        assert response.status_code == 404
        print("Correctly returned 404 for non-existent template deletion")
    
    def test_template_has_rule_badges(self):
        """Test that templates have rule type information for badges"""
        response = self.session.get(f"{BASE_URL}/api/incentives/templates")
        assert response.status_code == 200
        
        templates = response.json()["templates"]
        
        # Find a template with rules
        template_with_rules = next((t for t in templates if t.get("default_rules")), None)
        
        if template_with_rules:
            rules = template_with_rules["default_rules"]
            for rule in rules:
                assert "type" in rule, "Rule should have 'type' for badge display"
                assert rule["type"] in ["threshold", "top_n", "milestone", "improvement", "lottery"], \
                    f"Unknown rule type: {rule['type']}"
            print(f"Template '{template_with_rules['name']}' has {len(rules)} rules with types: {[r['type'] for r in rules]}")
        else:
            print("No templates with rules found")


class TestTemplatesCleanup:
    """Cleanup test templates"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_cleanup_test_templates(self):
        """Cleanup - Delete all TEST_ prefixed templates"""
        response = self.session.get(f"{BASE_URL}/api/incentives/templates")
        
        if response.status_code != 200:
            pytest.skip("Could not fetch templates for cleanup")
        
        templates = response.json()["templates"]
        test_templates = [t for t in templates if t["name"].startswith("TEST_")]
        
        deleted_count = 0
        for template in test_templates:
            if not template.get("is_system"):
                delete_response = self.session.delete(f"{BASE_URL}/api/incentives/templates/{template['id']}")
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"Cleaned up {deleted_count} test templates")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

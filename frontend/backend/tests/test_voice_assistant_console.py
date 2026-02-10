"""
Voice Assistant Console API Tests
Tests for the Voice Assistant Console feature - admin interface for AI-powered Twilio Voice receptionist
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@eden.com"
TEST_PASSWORD = "password"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestVoiceAssistantConfig:
    """Tests for /api/voice-assistant/config endpoint"""
    
    def test_get_config_returns_200(self, auth_headers):
        """GET /api/voice-assistant/config returns 200 with config data"""
        response = requests.get(
            f"{BASE_URL}/api/voice-assistant/config",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields exist
        assert "id" in data
        assert "version" in data
        assert "mode" in data
        assert "enabled" in data
        assert "business_hours" in data
        assert "behavior_flags" in data
        assert "llm_aggressiveness" in data
        assert "max_recording_seconds" in data
        assert "max_conversation_turns" in data
    
    def test_config_mode_is_valid(self, auth_headers):
        """Config mode should be one of the valid modes"""
        response = requests.get(
            f"{BASE_URL}/api/voice-assistant/config",
            headers=auth_headers
        )
        data = response.json()
        valid_modes = ["message_only", "message_plus_confirm", "full_intake_future"]
        assert data["mode"] in valid_modes
    
    def test_config_business_hours_structure(self, auth_headers):
        """Business hours should have proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/voice-assistant/config",
            headers=auth_headers
        )
        data = response.json()
        business_hours = data["business_hours"]
        
        assert "timezone" in business_hours
        assert "schedule" in business_hours
        
        # Check schedule has days
        schedule = business_hours["schedule"]
        expected_days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        for day in expected_days:
            assert day in schedule
            assert "open" in schedule[day]
            assert "close" in schedule[day]
            assert "enabled" in schedule[day]
    
    def test_config_behavior_flags_structure(self, auth_headers):
        """Behavior flags should have proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/voice-assistant/config",
            headers=auth_headers
        )
        data = response.json()
        flags = data["behavior_flags"]
        
        expected_flags = [
            "allow_small_talk", "allow_reschedule", "allow_faq",
            "allow_status_updates", "require_verification", "play_hold_music"
        ]
        for flag in expected_flags:
            assert flag in flags
            assert isinstance(flags[flag], bool)
    
    def test_config_requires_auth(self):
        """Config endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/voice-assistant/config")
        assert response.status_code in [401, 403]  # 403 is also valid for unauthorized


class TestVoiceAssistantToggle:
    """Tests for /api/voice-assistant/config/toggle endpoint"""
    
    def test_toggle_on_returns_success(self, auth_headers):
        """POST toggle with enabled=true should enable assistant"""
        response = requests.post(
            f"{BASE_URL}/api/voice-assistant/config/toggle?enabled=true",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] == True
        assert "message" in data
    
    def test_toggle_off_returns_success(self, auth_headers):
        """POST toggle with enabled=false should disable assistant"""
        response = requests.post(
            f"{BASE_URL}/api/voice-assistant/config/toggle?enabled=false",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] == False
        assert "message" in data
    
    def test_toggle_persists_state(self, auth_headers):
        """Toggle state should persist in config"""
        # Enable
        requests.post(
            f"{BASE_URL}/api/voice-assistant/config/toggle?enabled=true",
            headers=auth_headers
        )
        
        # Verify
        config_response = requests.get(
            f"{BASE_URL}/api/voice-assistant/config",
            headers=auth_headers
        )
        assert config_response.json()["enabled"] == True
        
        # Disable
        requests.post(
            f"{BASE_URL}/api/voice-assistant/config/toggle?enabled=false",
            headers=auth_headers
        )
        
        # Verify
        config_response = requests.get(
            f"{BASE_URL}/api/voice-assistant/config",
            headers=auth_headers
        )
        assert config_response.json()["enabled"] == False
    
    def test_toggle_requires_auth(self):
        """Toggle endpoint should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/voice-assistant/config/toggle?enabled=true"
        )
        assert response.status_code in [401, 403]  # 403 is also valid for unauthorized


class TestVoiceAssistantScripts:
    """Tests for /api/voice-assistant/scripts endpoint"""
    
    def test_get_scripts_returns_200(self, auth_headers):
        """GET /api/voice-assistant/scripts returns 200 with script data"""
        response = requests.get(
            f"{BASE_URL}/api/voice-assistant/scripts",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify required script fields
        assert "id" in data
        assert "version" in data
        assert "greeting_script" in data
        assert "voicemail_script" in data
        assert "after_hours_script" in data
        assert "appointment_confirm_script" in data
        assert "goodbye_script" in data
    
    def test_scripts_contain_variables(self, auth_headers):
        """Scripts should contain variable placeholders"""
        response = requests.get(
            f"{BASE_URL}/api/voice-assistant/scripts",
            headers=auth_headers
        )
        data = response.json()
        
        # Greeting should have company_name variable
        assert "{company_name}" in data["greeting_script"]
        
        # Voicemail should have callback_window variable
        assert "{callback_window}" in data["voicemail_script"]
    
    def test_scripts_have_variables_config(self, auth_headers):
        """Scripts should have variables configuration"""
        response = requests.get(
            f"{BASE_URL}/api/voice-assistant/scripts",
            headers=auth_headers
        )
        data = response.json()
        
        assert "variables" in data
        variables = data["variables"]
        assert "company_name" in variables
        assert "callback_window" in variables
        assert "business_hours" in variables
    
    def test_scripts_requires_auth(self):
        """Scripts endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/voice-assistant/scripts")
        assert response.status_code in [401, 403]  # 403 is also valid for unauthorized


class TestVoiceAssistantGuardrails:
    """Tests for /api/voice-assistant/guardrails endpoint"""
    
    def test_get_guardrails_returns_200(self, auth_headers):
        """GET /api/voice-assistant/guardrails returns 200 with guardrail data"""
        response = requests.get(
            f"{BASE_URL}/api/voice-assistant/guardrails",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert "id" in data
        assert "version" in data
        assert "forbidden_topics" in data
        assert "escalation_triggers" in data
    
    def test_guardrails_forbidden_topics_is_list(self, auth_headers):
        """Forbidden topics should be a list of strings"""
        response = requests.get(
            f"{BASE_URL}/api/voice-assistant/guardrails",
            headers=auth_headers
        )
        data = response.json()
        
        assert isinstance(data["forbidden_topics"], list)
        assert len(data["forbidden_topics"]) > 0
        
        # Check expected forbidden topics
        expected_topics = ["legal advice", "settlement amounts", "lawsuit"]
        for topic in expected_topics:
            assert topic in data["forbidden_topics"]
    
    def test_guardrails_escalation_triggers_structure(self, auth_headers):
        """Escalation triggers should have proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/voice-assistant/guardrails",
            headers=auth_headers
        )
        data = response.json()
        triggers = data["escalation_triggers"]
        
        assert "keywords" in triggers
        assert "intents" in triggers
        assert isinstance(triggers["keywords"], list)
        assert isinstance(triggers["intents"], list)
        
        # Check expected keywords
        expected_keywords = ["lawyer", "sue", "complaint", "supervisor"]
        for kw in expected_keywords:
            assert kw in triggers["keywords"]
    
    def test_guardrails_requires_auth(self):
        """Guardrails endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/voice-assistant/guardrails")
        assert response.status_code in [401, 403]  # 403 is also valid for unauthorized


class TestVoiceAssistantStats:
    """Tests for /api/voice-assistant/stats/today endpoint"""
    
    def test_get_today_stats_returns_200(self, auth_headers):
        """GET /api/voice-assistant/stats/today returns 200 with stats"""
        response = requests.get(
            f"{BASE_URL}/api/voice-assistant/stats/today",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert "today_calls" in data
        assert "today_matched" in data
        assert "today_flagged" in data
        assert "recent_calls" in data
    
    def test_stats_values_are_integers(self, auth_headers):
        """Stats values should be integers"""
        response = requests.get(
            f"{BASE_URL}/api/voice-assistant/stats/today",
            headers=auth_headers
        )
        data = response.json()
        
        assert isinstance(data["today_calls"], int)
        assert isinstance(data["today_matched"], int)
        assert isinstance(data["today_flagged"], int)
        assert data["today_calls"] >= 0
        assert data["today_matched"] >= 0
        assert data["today_flagged"] >= 0
    
    def test_stats_recent_calls_is_list(self, auth_headers):
        """Recent calls should be a list"""
        response = requests.get(
            f"{BASE_URL}/api/voice-assistant/stats/today",
            headers=auth_headers
        )
        data = response.json()
        
        assert isinstance(data["recent_calls"], list)
    
    def test_stats_requires_auth(self):
        """Stats endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/voice-assistant/stats/today")
        assert response.status_code in [401, 403]  # 403 is also valid for unauthorized


class TestVoiceAssistantCalls:
    """Tests for /api/voice-assistant/calls endpoint"""
    
    def test_get_calls_returns_200(self, auth_headers):
        """GET /api/voice-assistant/calls returns 200 with call list"""
        response = requests.get(
            f"{BASE_URL}/api/voice-assistant/calls?limit=10",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "calls" in data
        assert "total" in data
        assert "limit" in data
        assert "offset" in data
    
    def test_calls_pagination_works(self, auth_headers):
        """Calls endpoint should support pagination"""
        response = requests.get(
            f"{BASE_URL}/api/voice-assistant/calls?limit=5&offset=0",
            headers=auth_headers
        )
        data = response.json()
        
        assert data["limit"] == 5
        assert data["offset"] == 0
        assert isinstance(data["calls"], list)
    
    def test_calls_empty_state_valid(self, auth_headers):
        """Empty calls list should be valid (no calls made yet)"""
        response = requests.get(
            f"{BASE_URL}/api/voice-assistant/calls?limit=10",
            headers=auth_headers
        )
        data = response.json()
        
        # Empty state is acceptable
        assert isinstance(data["calls"], list)
        assert isinstance(data["total"], int)
        assert data["total"] >= 0
    
    def test_calls_requires_auth(self):
        """Calls endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/voice-assistant/calls")
        assert response.status_code in [401, 403]  # 403 is also valid for unauthorized


class TestVoiceAssistantScriptsUpdate:
    """Tests for PUT /api/voice-assistant/scripts endpoint"""
    
    def test_update_scripts_returns_200(self, auth_headers):
        """PUT /api/voice-assistant/scripts should update scripts"""
        # Get current scripts
        current = requests.get(
            f"{BASE_URL}/api/voice-assistant/scripts",
            headers=auth_headers
        ).json()
        
        # Update with same data (to avoid breaking anything)
        response = requests.put(
            f"{BASE_URL}/api/voice-assistant/scripts",
            headers={**auth_headers, "Content-Type": "application/json"},
            json={
                "greeting_script": current["greeting_script"],
                "voicemail_script": current["voicemail_script"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
    
    def test_update_scripts_requires_auth(self):
        """Scripts update endpoint should require authentication"""
        response = requests.put(
            f"{BASE_URL}/api/voice-assistant/scripts",
            json={"greeting_script": "test"}
        )
        assert response.status_code in [401, 403]  # 403 is also valid for unauthorized

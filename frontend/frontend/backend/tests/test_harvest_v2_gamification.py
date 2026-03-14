"""
Test Harvest V2 Gamification APIs
Tests for:
- /api/harvest/v2/dispositions - Dynamic dispositions
- /api/harvest/v2/today - Daily stats with progress percentages
- /api/harvest/territories/ - Territory management
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHarvestV2APIs:
    """Test Harvest V2 gamification endpoints"""
    
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
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.user_id = login_response.json().get("user", {}).get("id")
    
    # ============================================
    # /api/harvest/v2/dispositions Tests
    # ============================================
    
    def test_dispositions_returns_200(self):
        """Test that dispositions endpoint returns 200"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/dispositions")
        assert response.status_code == 200
    
    def test_dispositions_returns_array(self):
        """Test that dispositions returns an array of dispositions"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/dispositions")
        data = response.json()
        assert "dispositions" in data
        assert isinstance(data["dispositions"], list)
        assert len(data["dispositions"]) >= 6  # NH, NI, CB, AP, SG, DNK
    
    def test_dispositions_have_required_fields(self):
        """Test that each disposition has required fields"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/dispositions")
        data = response.json()
        
        required_fields = ["code", "label", "color", "points"]
        for disp in data["dispositions"]:
            for field in required_fields:
                assert field in disp, f"Missing field {field} in disposition {disp}"
    
    def test_dispositions_include_standard_codes(self):
        """Test that standard disposition codes are present"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/dispositions")
        data = response.json()
        
        codes = [d["code"] for d in data["dispositions"]]
        expected_codes = ["NH", "NI", "CB", "AP", "SG", "DNK"]
        for code in expected_codes:
            assert code in codes, f"Missing standard code {code}"
    
    def test_dispositions_colors_are_valid_hex(self):
        """Test that disposition colors are valid hex codes"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/dispositions")
        data = response.json()
        
        for disp in data["dispositions"]:
            color = disp.get("color", "")
            assert color.startswith("#"), f"Color {color} should start with #"
            assert len(color) == 7, f"Color {color} should be 7 chars (#RRGGBB)"
    
    def test_dispositions_unauthorized_without_token(self):
        """Test that dispositions requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/harvest/v2/dispositions")
        assert response.status_code in [401, 403]  # Either unauthorized or forbidden
    
    # ============================================
    # /api/harvest/v2/today Tests
    # ============================================
    
    def test_today_returns_200(self):
        """Test that today endpoint returns 200"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/today")
        assert response.status_code == 200
    
    def test_today_returns_daily_stats(self):
        """Test that today returns daily stats fields"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/today")
        data = response.json()
        
        required_fields = ["date", "doors_knocked", "appointments_set", "signed_contracts"]
        for field in required_fields:
            assert field in data, f"Missing field {field}"
    
    def test_today_returns_goals(self):
        """Test that today returns goals object"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/today")
        data = response.json()
        
        assert "goals" in data
        assert isinstance(data["goals"], dict)
        assert "doors_knocked" in data["goals"]
        assert "appointments_set" in data["goals"]
        assert "signed_contracts" in data["goals"]
    
    def test_today_returns_progress_percentages(self):
        """Test that today returns progress percentages"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/today")
        data = response.json()
        
        assert "progress" in data
        assert isinstance(data["progress"], dict)
        
        # Progress should have percentage values
        for key in ["doors_knocked", "appointments_set", "signed_contracts"]:
            if key in data["progress"]:
                progress_val = data["progress"][key]
                assert isinstance(progress_val, (int, float)), f"Progress {key} should be numeric"
                assert 0 <= progress_val <= 100 or progress_val > 100, f"Progress {key} should be percentage"
    
    def test_today_returns_streak_days(self):
        """Test that today returns streak_days"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/today")
        data = response.json()
        
        assert "streak_days" in data
        assert isinstance(data["streak_days"], int)
        assert data["streak_days"] >= 0
    
    def test_today_returns_total_points(self):
        """Test that today returns total_points"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/today")
        data = response.json()
        
        assert "total_points" in data
        assert isinstance(data["total_points"], (int, float))
    
    def test_today_returns_dispositions(self):
        """Test that today includes dispositions for convenience"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/today")
        data = response.json()
        
        # Dispositions may be included for convenience
        if "dispositions" in data:
            assert isinstance(data["dispositions"], list)
    
    def test_today_unauthorized_without_token(self):
        """Test that today requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/harvest/v2/today")
        assert response.status_code in [401, 403]  # Either unauthorized or forbidden
    
    # ============================================
    # /api/harvest/territories/ Tests
    # ============================================
    
    def test_territories_list_returns_200(self):
        """Test that territories list returns 200"""
        response = self.session.get(f"{BASE_URL}/api/harvest/territories/")
        assert response.status_code == 200
    
    def test_territories_list_returns_array(self):
        """Test that territories returns an array"""
        response = self.session.get(f"{BASE_URL}/api/harvest/territories/")
        data = response.json()
        
        assert "territories" in data
        assert isinstance(data["territories"], list)
    
    def test_territories_have_required_fields(self):
        """Test that territories have required fields"""
        response = self.session.get(f"{BASE_URL}/api/harvest/territories/")
        data = response.json()
        
        if data["territories"]:
            territory = data["territories"][0]
            required_fields = ["id", "name", "polygon", "is_active"]
            for field in required_fields:
                assert field in territory, f"Missing field {field}"
    
    def test_territories_have_stats(self):
        """Test that territories include stats"""
        response = self.session.get(f"{BASE_URL}/api/harvest/territories/")
        data = response.json()
        
        if data["territories"]:
            territory = data["territories"][0]
            assert "stats" in territory
            stats = territory["stats"]
            assert "total_pins" in stats
            assert "coverage_percent" in stats
    
    def test_territories_my_returns_200(self):
        """Test that my territories endpoint returns 200"""
        response = self.session.get(f"{BASE_URL}/api/harvest/territories/my")
        assert response.status_code == 200
    
    def test_territories_my_returns_array(self):
        """Test that my territories returns an array"""
        response = self.session.get(f"{BASE_URL}/api/harvest/territories/my")
        data = response.json()
        
        assert "territories" in data
        assert isinstance(data["territories"], list)
    
    def test_territories_unauthorized_without_token(self):
        """Test that territories requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/harvest/territories/")
        assert response.status_code in [401, 403]  # Either unauthorized or forbidden


class TestTerritoryManagement:
    """Test Territory CRUD operations"""
    
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
        self.user_id = login_response.json().get("user", {}).get("id")
    
    def test_create_territory(self):
        """Test creating a new territory"""
        payload = {
            "name": "TEST_Territory_Gamification",
            "description": "Test territory for gamification testing",
            "polygon": [
                {"lat": 27.95, "lng": -82.45},
                {"lat": 27.96, "lng": -82.45},
                {"lat": 27.96, "lng": -82.44},
                {"lat": 27.95, "lng": -82.44}
            ],
            "color": "#FF5733",
            "priority": 2
        }
        
        response = self.session.post(f"{BASE_URL}/api/harvest/territories/", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "message" in data
        
        # Store for cleanup
        self.created_territory_id = data["id"]
    
    def test_get_territory_by_id(self):
        """Test getting a specific territory"""
        # First create a territory
        payload = {
            "name": "TEST_Territory_GetById",
            "polygon": [
                {"lat": 27.95, "lng": -82.45},
                {"lat": 27.96, "lng": -82.45},
                {"lat": 27.96, "lng": -82.44},
                {"lat": 27.95, "lng": -82.44}
            ]
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/harvest/territories/", json=payload)
        assert create_response.status_code == 200
        territory_id = create_response.json()["id"]
        
        # Get the territory
        response = self.session.get(f"{BASE_URL}/api/harvest/territories/{territory_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == territory_id
        assert data["name"] == "TEST_Territory_GetById"
    
    def test_assign_territory_to_user(self):
        """Test assigning a territory to a user"""
        # First create a territory
        payload = {
            "name": "TEST_Territory_Assignment",
            "polygon": [
                {"lat": 27.95, "lng": -82.45},
                {"lat": 27.96, "lng": -82.45},
                {"lat": 27.96, "lng": -82.44},
                {"lat": 27.95, "lng": -82.44}
            ]
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/harvest/territories/", json=payload)
        assert create_response.status_code == 200
        territory_id = create_response.json()["id"]
        
        # Assign to current user
        assign_payload = {
            "user_id": self.user_id,
            "notes": "Test assignment"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/harvest/territories/{territory_id}/assign",
            json=assign_payload
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "assignment" in data


class TestHarvestMapIntegration:
    """Test HarvestMap integration with dynamic dispositions"""
    
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
    
    def test_dispositions_match_pin_statuses(self):
        """Test that dispositions match expected pin status codes"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/dispositions")
        data = response.json()
        
        # These are the codes used in HarvestMap
        expected_codes = ["NH", "NI", "CB", "AP", "SG", "DNK"]
        actual_codes = [d["code"] for d in data["dispositions"]]
        
        for code in expected_codes:
            assert code in actual_codes, f"HarvestMap expects code {code}"
    
    def test_dispositions_have_colors_for_legend(self):
        """Test that all dispositions have colors for the legend"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/dispositions")
        data = response.json()
        
        for disp in data["dispositions"]:
            assert "color" in disp, f"Disposition {disp['code']} missing color"
            assert disp["color"], f"Disposition {disp['code']} has empty color"
    
    def test_dispositions_have_labels_for_legend(self):
        """Test that all dispositions have labels for the legend"""
        response = self.session.get(f"{BASE_URL}/api/harvest/v2/dispositions")
        data = response.json()
        
        for disp in data["dispositions"]:
            assert "label" in disp, f"Disposition {disp['code']} missing label"
            assert disp["label"], f"Disposition {disp['code']} has empty label"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

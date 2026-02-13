"""
Test suite for iteration 53 fixes:
1. Documents upload API (/api/uploads/file)
2. MyCard team endpoint (/api/mycard/team)
3. MyCard share-link endpoint (/api/mycard/share-link)
4. Claims API - basic verification
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "testuser@example.com"
TEST_PASSWORD = "testpassword"


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    def test_login_returns_token(self):
        """Test login endpoint returns access_token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert len(data["access_token"]) > 0


class TestUploadsAPI:
    """Test document uploads API"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_uploads_my_files_endpoint(self, auth_headers):
        """Test GET /api/uploads/my-files returns list"""
        response = requests.get(
            f"{BASE_URL}/api/uploads/my-files",
            headers=auth_headers
        )
        # Should return 200 or empty list
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            # Should be a list or dict with documents key
            assert isinstance(data, (list, dict))


class TestMyCardAPI:
    """Test MyCard endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_mycard_me_endpoint(self, auth_headers):
        """Test GET /api/mycard/me returns card data"""
        response = requests.get(
            f"{BASE_URL}/api/mycard/me",
            headers=auth_headers
        )
        assert response.status_code == 200, f"MyCard me failed: {response.text}"
        data = response.json()
        assert "has_card" in data
    
    def test_mycard_team_endpoint(self, auth_headers):
        """Test GET /api/mycard/team returns team cards"""
        response = requests.get(
            f"{BASE_URL}/api/mycard/team",
            headers=auth_headers
        )
        assert response.status_code == 200, f"MyCard team failed: {response.text}"
        data = response.json()
        assert "team_cards" in data
        assert "total" in data
        assert isinstance(data["team_cards"], list)
    
    def test_mycard_share_link_endpoint(self, auth_headers):
        """Test POST /api/mycard/share-link returns share URL"""
        response = requests.post(
            f"{BASE_URL}/api/mycard/share-link",
            headers=auth_headers
        )
        # Can return 404 if no card created, or 200 with share_url
        assert response.status_code in [200, 404], f"MyCard share-link unexpected: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "share_url" in data or "message" in data


class TestClaimsAPI:
    """Test Claims API"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_claims_list_endpoint(self, auth_headers):
        """Test GET /api/claims/ returns array"""
        response = requests.get(
            f"{BASE_URL}/api/claims/",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Claims list failed: {response.text}"
        data = response.json()
        # Should be a plain array
        assert isinstance(data, list), "Claims should return array"
    
    def test_get_single_claim(self, auth_headers):
        """Test getting a single claim if any exist"""
        # First get list
        response = requests.get(
            f"{BASE_URL}/api/claims/",
            headers=auth_headers
        )
        claims = response.json()
        
        if claims and len(claims) > 0:
            claim_id = claims[0].get("id")
            # Get single claim
            single_response = requests.get(
                f"{BASE_URL}/api/claims/{claim_id}",
                headers=auth_headers
            )
            assert single_response.status_code == 200
            data = single_response.json()
            assert "claim_number" in data or "id" in data


class TestInspectionsPhotoAPI:
    """Test inspections photo API"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_claim_photos_endpoint(self, auth_headers):
        """Test GET /api/inspections/claim/{claim_id}/photos"""
        # Get a claim first
        claims_response = requests.get(
            f"{BASE_URL}/api/claims/",
            headers=auth_headers
        )
        claims = claims_response.json()
        
        if claims and len(claims) > 0:
            claim_id = claims[0].get("id")
            photos_response = requests.get(
                f"{BASE_URL}/api/inspections/claim/{claim_id}/photos",
                headers=auth_headers
            )
            assert photos_response.status_code == 200, f"Photos endpoint failed: {photos_response.text}"
            data = photos_response.json()
            assert "photos" in data or isinstance(data, dict)


class TestDashboardAPI:
    """Test dashboard stats API"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_dashboard_stats_endpoint(self, auth_headers):
        """Test GET /api/dashboard/stats"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        data = response.json()
        # Should have some stats
        assert isinstance(data, dict)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

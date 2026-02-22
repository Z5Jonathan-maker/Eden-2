"""
Eden Claims Management - Adam QA Runner Backend Tests
Tests for API Health, Status, Integrations, and Data Management endpoints
"""
import pytest
import requests
import os
import uuid

# Get API URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@eden.com"
TEST_PASSWORD = "password"


class TestAdamQABackendSuites:
    """Tests for the endpoints that Adam QA Runner tests"""
    
    def test_api_health_check(self):
        """Test API root endpoint - Adam's 'API Health Check' test"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "running" in data["message"].lower()
        print(f"✓ API Health Check PASSED: {data['message']}")
    
    def test_status_endpoint(self):
        """Test status endpoint - Adam's 'Status Endpoint' test"""
        response = requests.get(f"{BASE_URL}/api/status")
        assert response.status_code == 200
        print("✓ Status Endpoint PASSED")
    
    def test_integrations_endpoint(self):
        """Test integrations endpoint - Adam's 'Integrations Endpoint' test"""
        response = requests.get(f"{BASE_URL}/api/integrations/test")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "ok"
        assert "integrations" in data
        assert isinstance(data["integrations"], list)
        # Verify expected integrations are listed
        expected_integrations = ["gmail", "google_drive", "gamma", "signnow"]
        for integration in expected_integrations:
            assert integration in data["integrations"], f"Missing integration: {integration}"
        print(f"✓ Integrations Endpoint PASSED: {data['integrations']}")


class TestAuthentication:
    """Authentication tests for test@eden.com user"""
    
    def test_login_with_test_credentials(self):
        """Test login with test@eden.com / password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        assert data["user"]["role"] == "adjuster"
        
        # Store token for other tests
        TestAuthentication.token = data["access_token"]
        print(f"✓ Login PASSED for {TEST_EMAIL}")
    
    def test_get_current_user(self):
        """Test /me endpoint with valid token"""
        token = getattr(TestAuthentication, 'token', None)
        if not token:
            pytest.skip("No token available")
        
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == TEST_EMAIL
        print(f"✓ Get Current User PASSED")


class TestDataManagement:
    """Data Management endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            token = response.json()["access_token"]
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication required for data management tests")
    
    def test_data_stats_endpoint(self, auth_headers):
        """Test /api/data/stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/data/stats",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Stats failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "total_claims" in data
        assert "total_users" in data
        assert "total_notes" in data
        assert "total_notifications" in data
        assert "claims_by_status" in data
        assert "claims_by_type" in data
        
        # Validate data types
        assert isinstance(data["total_claims"], int)
        assert isinstance(data["total_users"], int)
        assert isinstance(data["claims_by_status"], dict)
        assert isinstance(data["claims_by_type"], dict)
        
        print(f"✓ Data Stats PASSED: {data['total_claims']} claims, {data['total_users']} users")
    
    def test_export_claims_csv(self, auth_headers):
        """Test CSV export endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/data/export/claims",
            headers=auth_headers
        )
        assert response.status_code == 200, f"CSV export failed: {response.text}"
        
        # Validate content type
        content_type = response.headers.get("content-type", "")
        assert "text/csv" in content_type, f"Expected CSV content type, got: {content_type}"
        
        # Validate CSV content has headers
        content = response.text
        assert "claim_number" in content
        assert "client_name" in content
        assert "client_email" in content
        
        print(f"✓ Export CSV PASSED: {len(content)} bytes")
    
    def test_export_claims_json(self, auth_headers):
        """Test JSON export endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/data/export/claims/json",
            headers=auth_headers
        )
        assert response.status_code == 200, f"JSON export failed: {response.text}"
        
        # Validate content type
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type, f"Expected JSON content type, got: {content_type}"
        
        # Validate JSON content
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            claim = data[0]
            assert "claim_number" in claim
            assert "client_name" in claim
            assert "status" in claim
        
        print(f"✓ Export JSON PASSED: {len(data)} claims")
    
    def test_download_import_template(self, auth_headers):
        """Test template download endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/data/template/claims",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Template download failed: {response.text}"
        
        # Validate content type
        content_type = response.headers.get("content-type", "")
        assert "text/csv" in content_type, f"Expected CSV content type, got: {content_type}"
        
        # Validate template has headers and example row
        content = response.text
        lines = content.strip().split('\n')
        assert len(lines) >= 2, "Template should have header and example row"
        
        # Check headers
        headers = lines[0]
        assert "claim_number" in headers
        assert "client_name" in headers
        assert "client_email" in headers
        
        # Check example row
        example = lines[1]
        assert "CLM-EXAMPLE-001" in example
        
        print(f"✓ Download Template PASSED")
    
    def test_data_stats_without_auth(self):
        """Test stats endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/data/stats")
        assert response.status_code in [401, 403]
        print("✓ Stats endpoint correctly requires authentication")
    
    def test_export_csv_without_auth(self):
        """Test CSV export requires authentication"""
        response = requests.get(f"{BASE_URL}/api/data/export/claims")
        assert response.status_code in [401, 403]
        print("✓ CSV export correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

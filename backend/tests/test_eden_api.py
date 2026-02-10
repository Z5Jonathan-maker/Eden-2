"""
Eden Claims Management API Tests
Tests for authentication and claims CRUD operations
"""
import pytest
import requests
import os
import uuid

# Get API URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_EMAIL = f"test_{uuid.uuid4().hex[:8]}@eden.com"
TEST_PASSWORD = "test123"
TEST_FULL_NAME = "Test User"

class TestHealthCheck:
    """Basic API health check tests"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API root endpoint working: {data['message']}")

    def test_status_endpoint(self):
        """Test status endpoint"""
        response = requests.get(f"{BASE_URL}/api/status")
        assert response.status_code == 200
        print("✓ Status endpoint working")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    @pytest.fixture(scope="class")
    def test_user_data(self):
        """Generate unique test user data"""
        return {
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "full_name": TEST_FULL_NAME,
            "role": "adjuster"
        }
    
    def test_register_new_user(self, test_user_data):
        """Test user registration"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json=test_user_data
        )
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "id" in data
        assert data["email"] == test_user_data["email"]
        assert data["full_name"] == test_user_data["full_name"]
        assert data["role"] == test_user_data["role"]
        assert "is_active" in data
        print(f"✓ User registered successfully: {data['email']}")
        
        # Store user ID for later tests
        TestAuthentication.user_id = data["id"]
    
    def test_register_duplicate_email(self, test_user_data):
        """Test registration with duplicate email fails"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json=test_user_data
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "already registered" in data.get("detail", "").lower()
        print("✓ Duplicate email registration correctly rejected")
    
    def test_login_success(self, test_user_data):
        """Test successful login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": test_user_data["email"],
                "password": test_user_data["password"]
            }
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["email"] == test_user_data["email"]
        
        # Store token for later tests
        TestAuthentication.token = data["access_token"]
        print(f"✓ Login successful, token received")
    
    def test_login_invalid_password(self, test_user_data):
        """Test login with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": test_user_data["email"],
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code == 401
        print("✓ Invalid password correctly rejected")
    
    def test_login_nonexistent_user(self):
        """Test login with non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "nonexistent@eden.com",
                "password": "anypassword"
            }
        )
        
        assert response.status_code == 401
        print("✓ Non-existent user login correctly rejected")
    
    def test_get_current_user(self):
        """Test /me endpoint with valid token"""
        token = getattr(TestAuthentication, 'token', None)
        if not token:
            pytest.skip("No token available - login test may have failed")
        
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Get user failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert "email" in data
        assert "full_name" in data
        print(f"✓ Current user info retrieved: {data['email']}")
    
    def test_get_current_user_no_token(self):
        """Test /me endpoint without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code in [401, 403]
        print("✓ Unauthenticated request correctly rejected")
    
    def test_get_current_user_invalid_token(self):
        """Test /me endpoint with invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_here"}
        )
        
        assert response.status_code == 401
        print("✓ Invalid token correctly rejected")


class TestClaims:
    """Claims CRUD endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers from previous test"""
        token = getattr(TestAuthentication, 'token', None)
        if not token:
            # Try to login with test credentials
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
            )
            if response.status_code == 200:
                token = response.json()["access_token"]
            else:
                pytest.skip("Authentication required for claims tests")
        
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_claim_data(self):
        """Generate test claim data"""
        return {
            "claim_number": f"TEST-CLM-{uuid.uuid4().hex[:6].upper()}",
            "client_name": "Test Client",
            "client_email": "testclient@example.com",
            "property_address": "123 Test Street, Test City, TS 12345",
            "date_of_loss": "2025-01-15",
            "claim_type": "Water Damage",
            "policy_number": f"POL-{uuid.uuid4().hex[:6].upper()}",
            "estimated_value": 25000.00,
            "description": "Test claim for automated testing"
        }
    
    def test_create_claim(self, auth_headers, test_claim_data):
        """Test creating a new claim"""
        response = requests.post(
            f"{BASE_URL}/api/claims/",
            json=test_claim_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Create claim failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "id" in data
        assert data["claim_number"] == test_claim_data["claim_number"]
        assert data["client_name"] == test_claim_data["client_name"]
        assert data["client_email"] == test_claim_data["client_email"]
        assert data["property_address"] == test_claim_data["property_address"]
        assert data["status"] == "New"
        assert data["priority"] == "Medium"
        assert "created_at" in data
        assert "created_by" in data
        
        # Store claim ID for later tests
        TestClaims.claim_id = data["id"]
        print(f"✓ Claim created successfully: {data['claim_number']}")
    
    def test_create_claim_without_auth(self, test_claim_data):
        """Test creating claim without authentication fails"""
        response = requests.post(
            f"{BASE_URL}/api/claims/",
            json=test_claim_data
        )
        
        assert response.status_code in [401, 403]
        print("✓ Unauthenticated claim creation correctly rejected")
    
    def test_get_all_claims(self, auth_headers):
        """Test getting all claims"""
        response = requests.get(
            f"{BASE_URL}/api/claims/",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Get claims failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} claims")
    
    def test_get_claims_filtered_by_status(self, auth_headers):
        """Test getting claims filtered by status"""
        response = requests.get(
            f"{BASE_URL}/api/claims/?status=New",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned claims should have status "New"
        for claim in data:
            assert claim["status"] == "New"
        print(f"✓ Status filter working, found {len(data)} 'New' claims")
    
    def test_get_single_claim(self, auth_headers):
        """Test getting a single claim by ID"""
        claim_id = getattr(TestClaims, 'claim_id', None)
        if not claim_id:
            pytest.skip("No claim ID available - create test may have failed")
        
        response = requests.get(
            f"{BASE_URL}/api/claims/{claim_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Get claim failed: {response.text}"
        data = response.json()
        
        assert data["id"] == claim_id
        print(f"✓ Single claim retrieved: {data['claim_number']}")
    
    def test_get_nonexistent_claim(self, auth_headers):
        """Test getting a non-existent claim returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.get(
            f"{BASE_URL}/api/claims/{fake_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 404
        print("✓ Non-existent claim correctly returns 404")
    
    def test_update_claim(self, auth_headers):
        """Test updating a claim"""
        claim_id = getattr(TestClaims, 'claim_id', None)
        if not claim_id:
            pytest.skip("No claim ID available - create test may have failed")
        
        update_data = {
            "status": "In Progress",
            "priority": "High",
            "description": "Updated description for testing"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/claims/{claim_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Update claim failed: {response.text}"
        data = response.json()
        
        assert data["status"] == "In Progress"
        assert data["priority"] == "High"
        assert data["description"] == "Updated description for testing"
        print(f"✓ Claim updated successfully")
        
        # Verify persistence with GET
        get_response = requests.get(
            f"{BASE_URL}/api/claims/{claim_id}",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["status"] == "In Progress"
        print("✓ Update persisted correctly")
    
    def test_update_nonexistent_claim(self, auth_headers):
        """Test updating a non-existent claim returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.put(
            f"{BASE_URL}/api/claims/{fake_id}",
            json={"status": "Completed"},
            headers=auth_headers
        )
        
        assert response.status_code == 404
        print("✓ Update non-existent claim correctly returns 404")


class TestClaimNotes:
    """Claim notes endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        token = getattr(TestAuthentication, 'token', None)
        if not token:
            pytest.skip("Authentication required for notes tests")
        return {"Authorization": f"Bearer {token}"}
    
    def test_add_note_to_claim(self, auth_headers):
        """Test adding a note to a claim"""
        claim_id = getattr(TestClaims, 'claim_id', None)
        if not claim_id:
            pytest.skip("No claim ID available")
        
        note_data = {
            "claim_id": claim_id,
            "content": "Test note for automated testing",
            "tags": ["test", "automated"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/claims/{claim_id}/notes",
            json=note_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Add note failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["content"] == note_data["content"]
        assert data["claim_id"] == claim_id
        assert "author_name" in data
        
        TestClaimNotes.note_id = data["id"]
        print(f"✓ Note added successfully")
    
    def test_get_claim_notes(self, auth_headers):
        """Test getting notes for a claim"""
        claim_id = getattr(TestClaims, 'claim_id', None)
        if not claim_id:
            pytest.skip("No claim ID available")
        
        response = requests.get(
            f"{BASE_URL}/api/claims/{claim_id}/notes",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        assert len(data) >= 1  # At least the note we created
        print(f"✓ Retrieved {len(data)} notes for claim")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_info(self):
        """Print cleanup info"""
        claim_id = getattr(TestClaims, 'claim_id', None)
        user_id = getattr(TestAuthentication, 'user_id', None)
        
        print(f"\n--- Test Data Created ---")
        print(f"Test User Email: {TEST_EMAIL}")
        print(f"Test User ID: {user_id}")
        print(f"Test Claim ID: {claim_id}")
        print("Note: Test data prefixed with TEST- for easy identification")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

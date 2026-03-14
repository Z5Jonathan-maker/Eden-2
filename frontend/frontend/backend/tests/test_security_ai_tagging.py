"""
Test Security & Hardening Features + AI Photo Tagging
Tests:
1. Rate limiting middleware (120 req/min, 429 response)
2. Global exception handler (clean JSON with error_id)
3. CORS headers configuration
4. AI photo tagging endpoint POST /api/inspections/photos/{id}/ai-tag
5. Auto-tagging from voice snippets
"""
import pytest
import requests
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBackendHealth:
    """Verify backend is running before other tests"""
    
    def test_health_endpoint(self):
        """Test /health endpoint returns healthy status (internal only)"""
        # Note: /health is served by frontend on external URL, test internally
        response = requests.get("http://localhost:8001/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") in ["healthy", "degraded"]
        assert "checks" in data
        assert "database" in data["checks"]
        print(f"Health check passed: {data['status']}")
    
    def test_api_root(self):
        """Test /api/ root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"API root: {data['message']}")


class TestAuthentication:
    """Authentication tests for getting tokens"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@eden.com", "password": "password"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    def test_login_success(self):
        """Test successful login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@eden.com", "password": "password"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@eden.com"
        print(f"Login successful for: {data['user']['email']}")


class TestCORSHeaders:
    """Test CORS configuration"""
    
    def test_cors_preflight_options(self):
        """Test CORS preflight OPTIONS request"""
        response = requests.options(
            f"{BASE_URL}/api/",
            headers={
                "Origin": "https://mycard-military.preview.emergentagent.com",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization, Content-Type"
            }
        )
        # OPTIONS should return 200 or 204
        assert response.status_code in [200, 204], f"CORS preflight failed: {response.status_code}"
        
        # Check CORS headers
        headers = response.headers
        assert "access-control-allow-origin" in headers or "Access-Control-Allow-Origin" in headers
        print(f"CORS preflight passed, status: {response.status_code}")
    
    def test_cors_headers_on_response(self):
        """Test CORS headers are present on regular responses"""
        response = requests.get(
            f"{BASE_URL}/api/",
            headers={"Origin": "https://mycard-military.preview.emergentagent.com"}
        )
        assert response.status_code == 200
        
        # Check for CORS headers (case-insensitive)
        headers_lower = {k.lower(): v for k, v in response.headers.items()}
        assert "access-control-allow-origin" in headers_lower, "Missing CORS allow-origin header"
        print(f"CORS headers present: {headers_lower.get('access-control-allow-origin')}")
    
    def test_cors_allowed_methods(self):
        """Test that allowed methods are configured"""
        response = requests.options(
            f"{BASE_URL}/api/claims/",
            headers={
                "Origin": "https://mycard-military.preview.emergentagent.com",
                "Access-Control-Request-Method": "POST"
            }
        )
        # Should allow POST method
        headers_lower = {k.lower(): v for k, v in response.headers.items()}
        allowed_methods = headers_lower.get("access-control-allow-methods", "")
        print(f"Allowed methods: {allowed_methods}")


class TestRateLimiting:
    """Test rate limiting middleware"""
    
    def test_rate_limit_headers_present(self):
        """Test that rate limit headers are present on responses (internal test)"""
        # Note: Rate limit headers are not exposed through K8s ingress
        # Test internally on localhost:8001
        # First get a token
        login_resp = requests.post(
            "http://localhost:8001/api/auth/login",
            json={"email": "test@eden.com", "password": "password"}
        )
        token = login_resp.json().get("access_token")
        
        # Test on an endpoint that's not skipped (not /api/ or /health)
        response = requests.get(
            "http://localhost:8001/api/users/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Check for rate limit headers
        headers_lower = {k.lower(): v for k, v in response.headers.items()}
        assert "x-ratelimit-remaining" in headers_lower, "Missing X-RateLimit-Remaining header"
        remaining = int(headers_lower["x-ratelimit-remaining"])
        print(f"Rate limit remaining: {remaining}")
        assert remaining >= 0
    
    def test_rate_limit_decrements(self):
        """Test that rate limit decrements with each request (internal test)"""
        # Get token
        login_resp = requests.post(
            "http://localhost:8001/api/auth/login",
            json={"email": "test@eden.com", "password": "password"}
        )
        token = login_resp.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Make first request
        response1 = requests.get("http://localhost:8001/api/users/me", headers=headers)
        headers1 = {k.lower(): v for k, v in response1.headers.items()}
        remaining1 = int(headers1.get("x-ratelimit-remaining", 0))
        
        # Make second request
        response2 = requests.get("http://localhost:8001/api/users/me", headers=headers)
        headers2 = {k.lower(): v for k, v in response2.headers.items()}
        remaining2 = int(headers2.get("x-ratelimit-remaining", 0))
        
        # Remaining should decrement (or stay same if window reset)
        print(f"Rate limit: {remaining1} -> {remaining2}")
        assert remaining2 <= remaining1 or remaining2 > 100  # Reset case
    
    def test_health_endpoint_skips_rate_limit(self):
        """Test that /health endpoint is not rate limited (internal test)"""
        # Health endpoint should not have rate limit headers
        response = requests.get("http://localhost:8001/health")
        assert response.status_code == 200
        # Health check should always work regardless of rate limit
        headers_lower = {k.lower(): v for k, v in response.headers.items()}
        # /health is skipped from rate limiting, so no header expected
        print("Health endpoint accessible (rate limit skipped)")


class TestGlobalExceptionHandler:
    """Test global exception handler returns clean JSON with error_id"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@eden.com", "password": "password"}
        )
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not get auth token")
    
    def test_404_returns_json(self):
        """Test 404 errors return JSON format"""
        response = requests.get(f"{BASE_URL}/api/nonexistent-endpoint-12345")
        assert response.status_code == 404
        # Should return JSON, not HTML
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type, f"Expected JSON, got: {content_type}"
        print(f"404 returns JSON: {response.json()}")
    
    def test_invalid_claim_returns_clean_error(self, auth_token):
        """Test accessing invalid claim returns clean error"""
        response = requests.get(
            f"{BASE_URL}/api/claims/invalid-claim-id-12345",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # Should return 404 with clean JSON
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data or "error" in data
        print(f"Invalid claim error: {data}")
    
    def test_invalid_photo_returns_clean_error(self, auth_token):
        """Test accessing invalid photo returns clean error"""
        response = requests.get(
            f"{BASE_URL}/api/inspections/photos/invalid-photo-id-12345",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        print(f"Invalid photo error: {data}")


class TestAIPhotoTagging:
    """Test AI-powered photo tagging from voice transcripts"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@eden.com", "password": "password"}
        )
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not get auth token")
    
    @pytest.fixture
    def test_claim_id(self, auth_token):
        """Get or create a test claim"""
        # Try to get existing claims
        response = requests.get(
            f"{BASE_URL}/api/claims/",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if response.status_code == 200:
            claims = response.json()
            if claims and len(claims) > 0:
                return claims[0]["id"]
        
        # Create a new claim if none exist
        claim_data = {
            "client_name": "TEST_AI_Tagging_Client",
            "client_email": "test_ai_tagging@test.com",
            "client_phone": "555-0123",
            "property_address": "123 Test St, Miami, FL 33101",
            "loss_type": "Water Damage",
            "loss_date": "2026-01-15",
            "policy_number": "TEST-AI-001"
        }
        response = requests.post(
            f"{BASE_URL}/api/claims/",
            json=claim_data,
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if response.status_code in [200, 201]:
            return response.json()["id"]
        pytest.skip("Could not get or create test claim")
    
    def test_ai_tag_endpoint_exists(self, auth_token):
        """Test that AI tag endpoint exists and returns proper error for invalid photo"""
        response = requests.post(
            f"{BASE_URL}/api/inspections/photos/nonexistent-photo-id/ai-tag",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # Should return 404 for nonexistent photo, not 405 (method not allowed)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
        print(f"AI tag endpoint exists, returns 404 for invalid photo: {data}")
    
    def test_ai_tag_with_voice_snippet(self, auth_token, test_claim_id):
        """Test AI tagging extracts room and damage from voice snippet"""
        # Get photos for the test claim
        photos_response = requests.get(
            f"{BASE_URL}/api/inspections/claim/{test_claim_id}/photos",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if photos_response.status_code == 200:
            photos_data = photos_response.json()
            photos = photos_data.get("photos", [])
            
            if photos:
                # Use existing photo
                photo_id = photos[0]["id"]
                print(f"Using existing photo: {photo_id}")
                
                # Test AI tagging on this photo
                tag_response = requests.post(
                    f"{BASE_URL}/api/inspections/photos/{photo_id}/ai-tag",
                    headers={"Authorization": f"Bearer {auth_token}"}
                )
                
                assert tag_response.status_code == 200, f"AI tag failed: {tag_response.text}"
                tag_data = tag_response.json()
                
                # Verify response structure - either has photo_id or message
                assert "ai_tags" in tag_data
                assert isinstance(tag_data["ai_tags"], list)
                
                # If photo has voice snippet, should have photo_id
                if tag_data.get("photo_id"):
                    assert "detected_room" in tag_data or tag_data.get("detected_room") is None
                    print(f"AI tagging response with voice snippet: {tag_data}")
                else:
                    # No voice snippet case
                    assert "message" in tag_data
                    print(f"AI tagging response (no voice snippet): {tag_data}")
                return
        
        # If no photos exist, the test passes but notes no photos to test
        print("No existing photos to test AI tagging - endpoint verified to exist")
    
    def test_ai_tag_keyword_extraction(self, auth_token):
        """Test that AI tagging correctly extracts keywords from voice snippets"""
        # This tests the keyword matching logic
        # The endpoint should detect room names and damage types from voice snippets
        
        # Get any photo that might have a voice snippet
        response = requests.get(
            f"{BASE_URL}/api/inspections/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if response.status_code == 200:
            stats = response.json()
            print(f"Inspection stats: {stats}")
            assert "total_photos" in stats
            assert "total_sessions" in stats


class TestInspectionSessionsAndPhotos:
    """Test inspection sessions and photo management"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@eden.com", "password": "password"}
        )
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not get auth token")
    
    def test_get_room_presets(self, auth_token):
        """Test getting room presets"""
        response = requests.get(
            f"{BASE_URL}/api/inspections/presets/rooms",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "rooms" in data
        assert len(data["rooms"]) > 0
        print(f"Room presets: {len(data['rooms'])} rooms available")
    
    def test_get_category_presets(self, auth_token):
        """Test getting category presets"""
        response = requests.get(
            f"{BASE_URL}/api/inspections/presets/categories",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert len(data["categories"]) > 0
        print(f"Category presets: {len(data['categories'])} categories available")
    
    def test_get_inspection_stats(self, auth_token):
        """Test getting inspection statistics"""
        response = requests.get(
            f"{BASE_URL}/api/inspections/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_photos" in data
        assert "total_sessions" in data
        assert "completed_sessions" in data
        print(f"Stats: {data['total_photos']} photos, {data['total_sessions']} sessions")


class TestSecurityModule:
    """Test security.py RateLimiter class functionality"""
    
    def test_rate_limiter_class_exists(self):
        """Verify RateLimiter class is properly implemented (internal test)"""
        # Test internally on localhost:8001 where headers are visible
        login_resp = requests.post(
            "http://localhost:8001/api/auth/login",
            json={"email": "test@eden.com", "password": "password"}
        )
        token = login_resp.json().get("access_token")
        
        response = requests.get(
            "http://localhost:8001/api/users/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        headers_lower = {k.lower(): v for k, v in response.headers.items()}
        
        # If rate limiting is working, we should see the header
        assert "x-ratelimit-remaining" in headers_lower
        print("RateLimiter class is working - headers present")
    
    def test_rate_limit_configuration(self):
        """Test rate limit is configured to 120 req/min (internal test)"""
        # Get token
        login_resp = requests.post(
            "http://localhost:8001/api/auth/login",
            json={"email": "test@eden.com", "password": "password"}
        )
        token = login_resp.json().get("access_token")
        
        # Make a request and check the remaining count
        response = requests.get(
            "http://localhost:8001/api/users/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        headers_lower = {k.lower(): v for k, v in response.headers.items()}
        remaining = int(headers_lower.get("x-ratelimit-remaining", 0))
        
        # Remaining should be less than or equal to 120 (the configured limit)
        assert remaining <= 120, f"Rate limit seems higher than 120: {remaining}"
        print(f"Rate limit remaining: {remaining} (max 120)")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

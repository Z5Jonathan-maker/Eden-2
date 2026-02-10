"""
Test suite for Scales - Xactimate Estimate Comparison Engine
Tests: Upload, Compare, Stats, AI Analysis, Dispute Letter APIs
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@eden.com"
TEST_PASSWORD = "password"

# Test PDF files
CARRIER_PDF_PATH = "/tmp/test_estimates/carrier_v2.pdf"
CONTRACTOR_PDF_PATH = "/tmp/test_estimates/contractor_v2.pdf"


class TestScalesAuth:
    """Authentication tests for Scales endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_scales_stats_requires_auth(self):
        """Test that stats endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/scales/stats")
        assert response.status_code in [401, 403], "Stats should require auth"
    
    def test_scales_estimates_requires_auth(self):
        """Test that estimates endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/scales/estimates")
        assert response.status_code in [401, 403], "Estimates should require auth"
    
    def test_scales_comparisons_requires_auth(self):
        """Test that comparisons endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/scales/comparisons")
        assert response.status_code in [401, 403], "Comparisons should require auth"


class TestScalesStats:
    """Test Scales stats endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_stats(self, auth_headers):
        """Test GET /api/scales/stats returns user statistics"""
        response = requests.get(
            f"{BASE_URL}/api/scales/stats",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Stats failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "estimates_uploaded" in data, "Missing estimates_uploaded"
        assert "comparisons_completed" in data, "Missing comparisons_completed"
        assert "total_variance_identified" in data, "Missing total_variance_identified"
        assert "avg_variance_per_comparison" in data, "Missing avg_variance_per_comparison"
        
        # Verify data types
        assert isinstance(data["estimates_uploaded"], int), "estimates_uploaded should be int"
        assert isinstance(data["comparisons_completed"], int), "comparisons_completed should be int"


class TestScalesUpload:
    """Test Scales PDF upload functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_upload_carrier_estimate(self, auth_headers):
        """Test POST /api/scales/upload with carrier PDF"""
        with open(CARRIER_PDF_PATH, 'rb') as f:
            files = {'file': ('carrier_v2.pdf', f, 'application/pdf')}
            data = {'estimate_type': 'carrier'}
            
            response = requests.post(
                f"{BASE_URL}/api/scales/upload",
                headers=auth_headers,
                files=files,
                data=data
            )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        
        result = response.json()
        # Verify response structure
        assert "id" in result, "Missing id in response"
        assert "file_name" in result, "Missing file_name"
        assert "estimate_type" in result, "Missing estimate_type"
        assert "line_item_count" in result, "Missing line_item_count"
        assert "total_rcv" in result, "Missing total_rcv"
        assert "categories" in result, "Missing categories"
        
        # Verify data values
        assert result["estimate_type"] == "carrier", "Wrong estimate type"
        assert result["line_item_count"] > 0, "Should have parsed line items"
        assert result["total_rcv"] > 0, "Should have total RCV"
        
        # Store for later tests
        TestScalesUpload.carrier_id = result["id"]
        print(f"Uploaded carrier estimate: {result['id']}, {result['line_item_count']} items, ${result['total_rcv']}")
    
    def test_upload_contractor_estimate(self, auth_headers):
        """Test POST /api/scales/upload with contractor PDF"""
        with open(CONTRACTOR_PDF_PATH, 'rb') as f:
            files = {'file': ('contractor_v2.pdf', f, 'application/pdf')}
            data = {'estimate_type': 'contractor'}
            
            response = requests.post(
                f"{BASE_URL}/api/scales/upload",
                headers=auth_headers,
                files=files,
                data=data
            )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        
        result = response.json()
        assert result["estimate_type"] == "contractor", "Wrong estimate type"
        assert result["line_item_count"] > 0, "Should have parsed line items"
        
        # Store for later tests
        TestScalesUpload.contractor_id = result["id"]
        print(f"Uploaded contractor estimate: {result['id']}, {result['line_item_count']} items, ${result['total_rcv']}")
    
    def test_upload_invalid_file_type(self, auth_headers):
        """Test upload rejects non-PDF files"""
        files = {'file': ('test.txt', b'not a pdf', 'text/plain')}
        data = {'estimate_type': 'carrier'}
        
        response = requests.post(
            f"{BASE_URL}/api/scales/upload",
            headers=auth_headers,
            files=files,
            data=data
        )
        
        assert response.status_code == 400, "Should reject non-PDF files"
    
    def test_upload_invalid_estimate_type(self, auth_headers):
        """Test upload rejects invalid estimate type"""
        with open(CARRIER_PDF_PATH, 'rb') as f:
            files = {'file': ('test.pdf', f, 'application/pdf')}
            data = {'estimate_type': 'invalid_type'}
            
            response = requests.post(
                f"{BASE_URL}/api/scales/upload",
                headers=auth_headers,
                files=files,
                data=data
            )
        
        assert response.status_code == 400, "Should reject invalid estimate type"


class TestScalesEstimates:
    """Test Scales estimates listing and retrieval"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_list_estimates(self, auth_headers):
        """Test GET /api/scales/estimates returns list"""
        response = requests.get(
            f"{BASE_URL}/api/scales/estimates",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"List failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        
        if len(data) > 0:
            estimate = data[0]
            assert "id" in estimate, "Missing id"
            assert "file_name" in estimate, "Missing file_name"
            assert "estimate_type" in estimate, "Missing estimate_type"
            assert "total_rcv" in estimate, "Missing total_rcv"
        
        print(f"Found {len(data)} estimates")
    
    def test_list_estimates_filter_by_type(self, auth_headers):
        """Test filtering estimates by type"""
        response = requests.get(
            f"{BASE_URL}/api/scales/estimates?estimate_type=carrier",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Filter failed: {response.text}"
        
        data = response.json()
        for estimate in data:
            assert estimate["estimate_type"] == "carrier", "Filter not working"


class TestScalesCompare:
    """Test Scales comparison functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def uploaded_estimates(self, auth_headers):
        """Upload test estimates for comparison"""
        # Upload carrier
        with open(CARRIER_PDF_PATH, 'rb') as f:
            files = {'file': ('carrier_test.pdf', f, 'application/pdf')}
            data = {'estimate_type': 'carrier'}
            response = requests.post(
                f"{BASE_URL}/api/scales/upload",
                headers=auth_headers,
                files=files,
                data=data
            )
        assert response.status_code == 200, f"Carrier upload failed: {response.text}"
        carrier_id = response.json()["id"]
        
        # Upload contractor
        with open(CONTRACTOR_PDF_PATH, 'rb') as f:
            files = {'file': ('contractor_test.pdf', f, 'application/pdf')}
            data = {'estimate_type': 'contractor'}
            response = requests.post(
                f"{BASE_URL}/api/scales/upload",
                headers=auth_headers,
                files=files,
                data=data
            )
        assert response.status_code == 200, f"Contractor upload failed: {response.text}"
        contractor_id = response.json()["id"]
        
        return {"carrier_id": carrier_id, "contractor_id": contractor_id}
    
    def test_compare_estimates(self, auth_headers, uploaded_estimates):
        """Test POST /api/scales/compare compares two estimates"""
        response = requests.post(
            f"{BASE_URL}/api/scales/compare",
            headers=auth_headers,
            json={
                "carrier_estimate_id": uploaded_estimates["carrier_id"],
                "contractor_estimate_id": uploaded_estimates["contractor_id"]
            }
        )
        
        assert response.status_code == 200, f"Compare failed: {response.text}"
        
        result = response.json()
        
        # Verify response structure
        assert "id" in result, "Missing comparison id"
        assert "carrier_estimate" in result, "Missing carrier_estimate"
        assert "contractor_estimate" in result, "Missing contractor_estimate"
        assert "total_variance" in result, "Missing total_variance"
        assert "summary" in result, "Missing summary"
        assert "category_variances" in result, "Missing category_variances"
        assert "matched_items" in result, "Missing matched_items"
        assert "missing_items" in result, "Missing missing_items"
        assert "modified_items" in result, "Missing modified_items"
        
        # Verify summary structure
        summary = result["summary"]
        assert "carrier_total" in summary, "Missing carrier_total in summary"
        assert "contractor_total" in summary, "Missing contractor_total in summary"
        assert "total_variance" in summary, "Missing total_variance in summary"
        assert "matched_count" in summary, "Missing matched_count"
        assert "missing_count" in summary, "Missing missing_count"
        assert "modified_count" in summary, "Missing modified_count"
        
        # Store comparison ID for later tests
        TestScalesCompare.comparison_id = result["id"]
        
        print(f"Comparison complete: Carrier ${summary['carrier_total']}, Contractor ${summary['contractor_total']}, Variance ${result['total_variance']}")
        print(f"Items: {summary['matched_count']} matched, {summary['missing_count']} missing, {summary['modified_count']} modified")
    
    def test_compare_invalid_carrier(self, auth_headers, uploaded_estimates):
        """Test compare with invalid carrier ID"""
        response = requests.post(
            f"{BASE_URL}/api/scales/compare",
            headers=auth_headers,
            json={
                "carrier_estimate_id": "invalid-id-12345",
                "contractor_estimate_id": uploaded_estimates["contractor_id"]
            }
        )
        
        assert response.status_code == 404, "Should return 404 for invalid carrier"
    
    def test_compare_invalid_contractor(self, auth_headers, uploaded_estimates):
        """Test compare with invalid contractor ID"""
        response = requests.post(
            f"{BASE_URL}/api/scales/compare",
            headers=auth_headers,
            json={
                "carrier_estimate_id": uploaded_estimates["carrier_id"],
                "contractor_estimate_id": "invalid-id-12345"
            }
        )
        
        assert response.status_code == 404, "Should return 404 for invalid contractor"


class TestScalesComparisons:
    """Test Scales comparisons listing and retrieval"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_list_comparisons(self, auth_headers):
        """Test GET /api/scales/comparisons returns list"""
        response = requests.get(
            f"{BASE_URL}/api/scales/comparisons",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"List failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        
        if len(data) > 0:
            comparison = data[0]
            assert "id" in comparison, "Missing id"
            assert "total_variance" in comparison, "Missing total_variance"
        
        print(f"Found {len(data)} comparisons")
    
    def test_get_comparison_by_id(self, auth_headers):
        """Test GET /api/scales/comparisons/{id} returns full comparison"""
        # First get list to find a comparison ID
        list_response = requests.get(
            f"{BASE_URL}/api/scales/comparisons",
            headers=auth_headers
        )
        
        if list_response.status_code == 200 and len(list_response.json()) > 0:
            comparison_id = list_response.json()[0]["id"]
            
            response = requests.get(
                f"{BASE_URL}/api/scales/comparisons/{comparison_id}",
                headers=auth_headers
            )
            
            assert response.status_code == 200, f"Get comparison failed: {response.text}"
            
            data = response.json()
            assert data["id"] == comparison_id, "Wrong comparison returned"
            assert "matched_items" in data, "Missing matched_items in full response"
            assert "missing_items" in data, "Missing missing_items in full response"
    
    def test_get_nonexistent_comparison(self, auth_headers):
        """Test GET /api/scales/comparisons/{id} with invalid ID"""
        response = requests.get(
            f"{BASE_URL}/api/scales/comparisons/nonexistent-id-12345",
            headers=auth_headers
        )
        
        assert response.status_code == 404, "Should return 404 for invalid ID"


class TestScalesAIAnalysis:
    """Test Scales AI analysis functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def comparison_id(self, auth_headers):
        """Get a comparison ID for testing"""
        # First get list of comparisons
        response = requests.get(
            f"{BASE_URL}/api/scales/comparisons",
            headers=auth_headers
        )
        
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["id"]
        
        # If no comparisons exist, create one
        with open(CARRIER_PDF_PATH, 'rb') as f:
            files = {'file': ('carrier_ai_test.pdf', f, 'application/pdf')}
            data = {'estimate_type': 'carrier'}
            response = requests.post(
                f"{BASE_URL}/api/scales/upload",
                headers=auth_headers,
                files=files,
                data=data
            )
        carrier_id = response.json()["id"]
        
        with open(CONTRACTOR_PDF_PATH, 'rb') as f:
            files = {'file': ('contractor_ai_test.pdf', f, 'application/pdf')}
            data = {'estimate_type': 'contractor'}
            response = requests.post(
                f"{BASE_URL}/api/scales/upload",
                headers=auth_headers,
                files=files,
                data=data
            )
        contractor_id = response.json()["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/scales/compare",
            headers=auth_headers,
            json={
                "carrier_estimate_id": carrier_id,
                "contractor_estimate_id": contractor_id
            }
        )
        return response.json()["id"]
    
    def test_ai_analysis_comprehensive(self, auth_headers, comparison_id):
        """Test POST /api/scales/analyze with comprehensive focus"""
        response = requests.post(
            f"{BASE_URL}/api/scales/analyze",
            headers=auth_headers,
            json={
                "comparison_id": comparison_id,
                "analysis_focus": "comprehensive"
            },
            timeout=60  # AI analysis may take time
        )
        
        assert response.status_code == 200, f"AI analysis failed: {response.text}"
        
        result = response.json()
        assert "id" in result, "Missing analysis id"
        assert "analysis" in result, "Missing analysis text"
        assert "key_metrics" in result, "Missing key_metrics"
        assert "status" in result, "Missing status"
        
        print(f"AI Analysis status: {result['status']}")
        print(f"Analysis preview: {result['analysis'][:200]}...")
    
    def test_ai_analysis_invalid_comparison(self, auth_headers):
        """Test AI analysis with invalid comparison ID"""
        response = requests.post(
            f"{BASE_URL}/api/scales/analyze",
            headers=auth_headers,
            json={
                "comparison_id": "invalid-comparison-id",
                "analysis_focus": "comprehensive"
            }
        )
        
        assert response.status_code == 404, "Should return 404 for invalid comparison"


class TestScalesDisputeLetter:
    """Test Scales dispute letter generation"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def comparison_id(self, auth_headers):
        """Get a comparison ID for testing"""
        response = requests.get(
            f"{BASE_URL}/api/scales/comparisons",
            headers=auth_headers
        )
        
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["id"]
        
        pytest.skip("No comparisons available for dispute letter test")
    
    def test_generate_dispute_letter(self, auth_headers, comparison_id):
        """Test POST /api/scales/dispute-letter generates letter"""
        response = requests.post(
            f"{BASE_URL}/api/scales/dispute-letter",
            headers=auth_headers,
            json={
                "comparison_id": comparison_id,
                "item_ids": []  # Use all high-impact items
            },
            timeout=60  # Letter generation may take time
        )
        
        assert response.status_code == 200, f"Dispute letter failed: {response.text}"
        
        result = response.json()
        assert "dispute_letter" in result, "Missing dispute_letter"
        assert "items_count" in result, "Missing items_count"
        assert "total_amount" in result, "Missing total_amount"
        
        assert len(result["dispute_letter"]) > 0, "Letter should not be empty"
        
        print(f"Generated dispute letter for {result['items_count']} items, total ${result['total_amount']}")
        print(f"Letter preview: {result['dispute_letter'][:200]}...")
    
    def test_dispute_letter_invalid_comparison(self, auth_headers):
        """Test dispute letter with invalid comparison ID"""
        response = requests.post(
            f"{BASE_URL}/api/scales/dispute-letter",
            headers=auth_headers,
            json={
                "comparison_id": "invalid-comparison-id",
                "item_ids": []
            }
        )
        
        assert response.status_code == 404, "Should return 404 for invalid comparison"


class TestScalesDeleteEstimate:
    """Test Scales estimate deletion"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_delete_estimate(self, auth_headers):
        """Test DELETE /api/scales/estimates/{id}"""
        # First upload an estimate to delete
        with open(CARRIER_PDF_PATH, 'rb') as f:
            files = {'file': ('delete_test.pdf', f, 'application/pdf')}
            data = {'estimate_type': 'carrier'}
            response = requests.post(
                f"{BASE_URL}/api/scales/upload",
                headers=auth_headers,
                files=files,
                data=data
            )
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        estimate_id = response.json()["id"]
        
        # Delete the estimate
        delete_response = requests.delete(
            f"{BASE_URL}/api/scales/estimates/{estimate_id}",
            headers=auth_headers
        )
        
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        # Verify it's deleted
        get_response = requests.get(
            f"{BASE_URL}/api/scales/estimates/{estimate_id}",
            headers=auth_headers
        )
        
        assert get_response.status_code == 404, "Estimate should be deleted"
    
    def test_delete_nonexistent_estimate(self, auth_headers):
        """Test DELETE with invalid estimate ID"""
        response = requests.delete(
            f"{BASE_URL}/api/scales/estimates/nonexistent-id-12345",
            headers=auth_headers
        )
        
        assert response.status_code == 404, "Should return 404 for invalid ID"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

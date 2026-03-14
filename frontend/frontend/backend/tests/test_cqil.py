"""
Test CQIL (Continuous Quality & Integrity Layer) API endpoints
Tests: health check, metrics, issues, break reports
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCQILEndpoints:
    """Test CQIL health and metrics endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - authenticate as admin user"""
        # Login as admin user
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_cqil_health_endpoint(self):
        """Test GET /api/cqil/health returns system health status"""
        response = requests.get(f"{BASE_URL}/api/cqil/health", headers=self.headers)
        
        assert response.status_code == 200, f"Health check failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "overall_status" in data, "Missing overall_status field"
        assert "components" in data, "Missing components field"
        assert "summary" in data, "Missing summary field"
        assert "timestamp" in data, "Missing timestamp field"
        
        # Verify overall_status is valid
        assert data["overall_status"] in ["green", "yellow", "red"], f"Invalid status: {data['overall_status']}"
        
        # Verify components array
        assert isinstance(data["components"], list), "Components should be a list"
        
        # Check expected components exist
        component_names = [c["component"] for c in data["components"]]
        expected_components = ["database", "api_routes", "integrations", "data_integrity", "permissions"]
        for expected in expected_components:
            assert expected in component_names, f"Missing component: {expected}"
        
        # Verify each component has required fields
        for component in data["components"]:
            assert "component" in component, "Component missing 'component' field"
            assert "status" in component, "Component missing 'status' field"
            assert component["status"] in ["operational", "degraded", "critical"], f"Invalid component status: {component['status']}"
        
        print(f"✅ CQIL Health: {data['overall_status'].upper()} - {data['summary']}")
        for comp in data["components"]:
            print(f"   - {comp['component']}: {comp['status']} ({comp.get('message', 'N/A')})")
    
    def test_cqil_metrics_endpoint(self):
        """Test GET /api/cqil/metrics returns issue counts"""
        response = requests.get(f"{BASE_URL}/api/cqil/metrics", headers=self.headers)
        
        assert response.status_code == 200, f"Metrics endpoint failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "open_issues" in data, "Missing open_issues field"
        assert "release_gate" in data, "Missing release_gate field"
        assert "last_updated" in data, "Missing last_updated field"
        
        # Verify open_issues structure
        open_issues = data["open_issues"]
        assert "P0" in open_issues, "Missing P0 count"
        assert "P1" in open_issues, "Missing P1 count"
        assert "P2" in open_issues, "Missing P2 count"
        assert "total" in open_issues, "Missing total count"
        
        # Verify release_gate is valid
        assert data["release_gate"] in ["clear", "warning", "blocked"], f"Invalid release_gate: {data['release_gate']}"
        
        print(f"✅ CQIL Metrics:")
        print(f"   - P0 Issues: {open_issues['P0']}")
        print(f"   - P1 Issues: {open_issues['P1']}")
        print(f"   - P2 Issues: {open_issues['P2']}")
        print(f"   - Release Gate: {data['release_gate'].upper()}")
    
    def test_cqil_issues_endpoint(self):
        """Test GET /api/cqil/issues returns integrity issues list"""
        response = requests.get(f"{BASE_URL}/api/cqil/issues", headers=self.headers)
        
        assert response.status_code == 200, f"Issues endpoint failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Issues should return a list"
        
        print(f"✅ CQIL Issues: {len(data)} issues found")
    
    def test_cqil_break_reports_endpoint(self):
        """Test GET /api/cqil/break-reports returns break reports"""
        response = requests.get(f"{BASE_URL}/api/cqil/break-reports", headers=self.headers)
        
        assert response.status_code == 200, f"Break reports endpoint failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Break reports should return a list"
        
        print(f"✅ CQIL Break Reports: {len(data)} reports found")
    
    def test_cqil_routes_audit_endpoint(self):
        """Test GET /api/cqil/routes/audit returns route audit (admin only)"""
        response = requests.get(f"{BASE_URL}/api/cqil/routes/audit", headers=self.headers)
        
        assert response.status_code == 200, f"Routes audit endpoint failed: {response.text}"
        
        data = response.json()
        assert "total_routes" in data, "Missing total_routes field"
        assert "routes" in data, "Missing routes field"
        assert isinstance(data["routes"], list), "Routes should be a list"
        
        print(f"✅ CQIL Routes Audit: {data['total_routes']} routes registered")


class TestCQILHealthComponents:
    """Test individual health check components"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        assert login_response.status_code == 200
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_database_component_operational(self):
        """Verify database component shows operational status"""
        response = requests.get(f"{BASE_URL}/api/cqil/health", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        db_component = next((c for c in data["components"] if c["component"] == "database"), None)
        
        assert db_component is not None, "Database component not found"
        assert db_component["status"] == "operational", f"Database not operational: {db_component.get('message')}"
        
        print(f"✅ Database component: {db_component['status']} - {db_component.get('latency_ms', 'N/A')}ms")
    
    def test_api_routes_component_operational(self):
        """Verify API routes component shows operational status"""
        response = requests.get(f"{BASE_URL}/api/cqil/health", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        api_component = next((c for c in data["components"] if c["component"] == "api_routes"), None)
        
        assert api_component is not None, "API routes component not found"
        assert api_component["status"] == "operational", f"API routes not operational: {api_component.get('message')}"
        
        print(f"✅ API Routes component: {api_component['status']}")
    
    def test_permissions_component_operational(self):
        """Verify permissions component shows operational status (admin exists)"""
        response = requests.get(f"{BASE_URL}/api/cqil/health", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        perm_component = next((c for c in data["components"] if c["component"] == "permissions"), None)
        
        assert perm_component is not None, "Permissions component not found"
        assert perm_component["status"] == "operational", f"Permissions not operational: {perm_component.get('message')}"
        
        print(f"✅ Permissions component: {perm_component['status']} - {perm_component.get('message')}")


class TestCQILReleaseGate:
    """Test release gate logic"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com",
            "password": "password"
        })
        assert login_response.status_code == 200
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_release_gate_status(self):
        """Verify release gate status is correctly calculated"""
        response = requests.get(f"{BASE_URL}/api/cqil/metrics", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        p0 = data["open_issues"]["P0"]
        p1 = data["open_issues"]["P1"]
        release_gate = data["release_gate"]
        
        # Verify release gate logic
        if p0 > 0:
            assert release_gate == "blocked", f"Expected 'blocked' with P0={p0}, got '{release_gate}'"
        elif p1 > 0:
            assert release_gate == "warning", f"Expected 'warning' with P1={p1}, got '{release_gate}'"
        else:
            assert release_gate == "clear", f"Expected 'clear' with no P0/P1, got '{release_gate}'"
        
        print(f"✅ Release Gate: {release_gate.upper()} (P0={p0}, P1={p1})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Test suite for Phase 7 Bug Fixes:
1. Dashboard Activity Trend chart - /api/dashboard/trends returns non-empty data
2. Field Sets tab CRUD - /api/admin/field-sets endpoints
3. Role-based button visibility - verified via frontend tests
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://127.0.0.1:8001').rstrip('/')

class TestDashboardTrends:
    """Test Dashboard Activity Trend chart API"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_trends_endpoint_returns_data(self, admin_token):
        """Test that /api/dashboard/trends returns non-empty array with service_count and visit_count"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/trends?range=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Trends data should not be empty"
        
        # Verify data structure
        for item in data:
            assert "date" in item, "Each item should have 'date' field"
            assert "service_count" in item, "Each item should have 'service_count' field"
            assert "visit_count" in item, "Each item should have 'visit_count' field"
            assert isinstance(item["service_count"], int), "service_count should be integer"
            assert isinstance(item["visit_count"], int), "visit_count should be integer"
        
        print(f"SUCCESS: Trends endpoint returned {len(data)} data points")
    
    def test_trends_has_activity_data(self, admin_token):
        """Test that trends data has actual activity (not all zeros)"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/trends?range=month",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        total_services = sum(item["service_count"] for item in data)
        total_visits = sum(item["visit_count"] for item in data)
        
        assert total_services > 0 or total_visits > 0, "Should have some activity data"
        print(f"SUCCESS: Total services: {total_services}, Total visits: {total_visits}")
    
    def test_dashboard_stats_endpoint(self, admin_token):
        """Test dashboard stats endpoint returns expected fields"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "client_count" in data
        assert "service_count" in data
        assert "visit_count" in data
        assert "outcome_count" in data
        
        print(f"SUCCESS: Stats - Clients: {data['client_count']}, Services: {data['service_count']}, Visits: {data['visit_count']}")


class TestFieldSetsAPI:
    """Test Field Sets CRUD API endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin authentication failed")
    
    def test_get_field_sets(self, admin_token):
        """Test GET /api/admin/field-sets returns list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/field-sets",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: Field sets endpoint returned {len(data)} field sets")
    
    def test_create_field_set(self, admin_token):
        """Test PUT /api/admin/field-sets creates/updates field set"""
        test_field_set = {
            "name": "TEST_Client Intake",
            "fields": [
                {"label": "Emergency Contact", "type": "TEXT", "required": True},
                {"label": "Date of Birth", "type": "DATE", "required": False}
            ]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/admin/field-sets",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=test_field_set
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # API returns {"message": "Field set updated"} or field set data
        assert "message" in data or "name" in data or "id" in data, "Response should contain success message or field set data"
        print(f"SUCCESS: Field set created/updated successfully")
    
    def test_field_set_persists(self, admin_token):
        """Test that created field set persists in GET"""
        # First create a field set
        test_field_set = {
            "name": "TEST_Verification",
            "fields": [
                {"label": "ID Number", "type": "TEXT", "required": True}
            ]
        }
        
        requests.put(
            f"{BASE_URL}/api/admin/field-sets",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=test_field_set
        )
        
        # Then verify it exists
        response = requests.get(
            f"{BASE_URL}/api/admin/field-sets",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        field_set_names = [fs.get("name") for fs in data]
        assert "TEST_Verification" in field_set_names, "Created field set should persist"
        print(f"SUCCESS: Field set persisted correctly")


class TestRoleBasedAccess:
    """Test role-based API access"""
    
    def get_token(self, email, password):
        """Get authentication token for user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    def test_admin_can_access_admin_endpoints(self):
        """Test Admin can access admin settings"""
        token = self.get_token("admin@caseflow.io", "admin123")
        assert token is not None, "Admin login should succeed"
        
        response = requests.get(
            f"{BASE_URL}/api/admin/field-sets",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, "Admin should access admin endpoints"
        print("SUCCESS: Admin can access admin endpoints")
    
    def test_caseworker_login(self):
        """Test Case Worker can login"""
        token = self.get_token("caseworker@demo.caseflow.io", "demo1234")
        assert token is not None, "Case Worker login should succeed"
        
        # Case Worker should access clients
        response = requests.get(
            f"{BASE_URL}/api/clients",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, "Case Worker should access clients"
        print("SUCCESS: Case Worker can login and access clients")
    
    def test_volunteer_login(self):
        """Test Volunteer can login"""
        token = self.get_token("volunteer@demo.caseflow.io", "demo1234")
        assert token is not None, "Volunteer login should succeed"
        
        # Volunteer should access clients (read-only)
        response = requests.get(
            f"{BASE_URL}/api/clients",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, "Volunteer should access clients"
        print("SUCCESS: Volunteer can login and access clients")
    
    def test_volunteer_cannot_access_admin(self):
        """Test Volunteer cannot access admin endpoints"""
        token = self.get_token("volunteer@demo.caseflow.io", "demo1234")
        assert token is not None, "Volunteer login should succeed"
        
        response = requests.get(
            f"{BASE_URL}/api/admin/field-sets",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Should be 403 Forbidden or 401 Unauthorized
        assert response.status_code in [401, 403], f"Volunteer should NOT access admin endpoints, got {response.status_code}"
        print("SUCCESS: Volunteer correctly denied access to admin endpoints")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

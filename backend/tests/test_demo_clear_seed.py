"""
Test Demo Mode endpoints: /api/demo/seed and /api/demo/clear
Tests for iteration 10 - Clear Data AlertDialog fix and HackForge branding
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://127.0.0.1:8001').rstrip('/')

class TestDemoEndpoints:
    """Demo Mode endpoint tests - seed and clear functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_demo_seed_returns_200(self):
        """POST /api/demo/seed returns 200 for Admin"""
        response = requests.post(f"{BASE_URL}/api/demo/seed", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ POST /api/demo/seed returns 200")
    
    def test_demo_seed_response_structure(self):
        """POST /api/demo/seed returns correct response structure"""
        response = requests.post(f"{BASE_URL}/api/demo/seed", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "message" in data, "Response missing 'message' field"
        assert "client_count" in data, "Response missing 'client_count' field"
        assert "demo_users" in data, "Response missing 'demo_users' field"
        
        # Verify demo users structure
        assert len(data["demo_users"]) >= 2, "Expected at least 2 demo users"
        for user in data["demo_users"]:
            assert "email" in user
            assert "password" in user
            assert "role" in user
        
        print(f"✓ Demo seed response has correct structure: {data['client_count']} clients created")
    
    def test_demo_seed_creates_demo_users(self):
        """POST /api/demo/seed creates case worker and volunteer demo accounts"""
        response = requests.post(f"{BASE_URL}/api/demo/seed", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        emails = [u["email"] for u in data["demo_users"]]
        assert "caseworker@demo.caseflow.io" in emails, "Case worker demo account not created"
        assert "volunteer@demo.caseflow.io" in emails, "Volunteer demo account not created"
        print("✓ Demo seed creates case worker and volunteer accounts")
    
    def test_demo_clear_returns_200(self):
        """POST /api/demo/clear returns 200 for Admin"""
        response = requests.post(f"{BASE_URL}/api/demo/clear", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ POST /api/demo/clear returns 200")
    
    def test_demo_clear_response_structure(self):
        """POST /api/demo/clear returns correct response structure"""
        # First seed some data
        requests.post(f"{BASE_URL}/api/demo/seed", headers=self.headers)
        
        # Then clear
        response = requests.post(f"{BASE_URL}/api/demo/clear", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "message" in data, "Response missing 'message' field"
        assert "details" in data, "Response missing 'details' field"
        
        # Verify details structure
        details = data["details"]
        expected_keys = ["clients", "services", "visits", "outcomes", "payment_requests"]
        for key in expected_keys:
            assert key in details, f"Details missing '{key}' field"
        
        print(f"✓ Demo clear response has correct structure: {data['message']}")
    
    def test_demo_clear_actually_clears_data(self):
        """POST /api/demo/clear actually removes data from database"""
        # First seed data
        seed_response = requests.post(f"{BASE_URL}/api/demo/seed", headers=self.headers)
        assert seed_response.status_code == 200
        seed_data = seed_response.json()
        
        # Verify seed created clients
        assert seed_data.get("client_count", 0) > 0, "Seed should create clients"
        
        # Clear data
        clear_response = requests.post(f"{BASE_URL}/api/demo/clear", headers=self.headers)
        assert clear_response.status_code == 200
        clear_data = clear_response.json()
        
        # Verify clear response shows deleted records
        details = clear_data.get("details", {})
        total_cleared = sum(details.values())
        assert total_cleared > 0, f"Clear should delete records, got: {details}"
        
        print(f"✓ Demo clear actually removes data: {total_cleared} records cleared")
    
    def test_demo_seed_denied_for_non_admin(self):
        """POST /api/demo/seed returns 403 for non-admin users"""
        # Login as case worker
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "caseworker@demo.caseflow.io",
            "password": "demo1234"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Case worker account not available")
        
        worker_token = login_response.json()["access_token"]
        worker_headers = {"Authorization": f"Bearer {worker_token}"}
        
        response = requests.post(f"{BASE_URL}/api/demo/seed", headers=worker_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Demo seed denied for non-admin (403)")
    
    def test_demo_clear_denied_for_non_admin(self):
        """POST /api/demo/clear returns 403 for non-admin users"""
        # Login as case worker
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "caseworker@demo.caseflow.io",
            "password": "demo1234"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Case worker account not available")
        
        worker_token = login_response.json()["access_token"]
        worker_headers = {"Authorization": f"Bearer {worker_token}"}
        
        response = requests.post(f"{BASE_URL}/api/demo/clear", headers=worker_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Demo clear denied for non-admin (403)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

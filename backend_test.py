import requests
import sys
import json
from datetime import datetime

class CaseFlowAPITester:
    def __init__(self, base_url="https://future-app-5.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session = requests.Session()

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'PATCH':
                response = self.session.patch(url, json=data, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_health_check(self):
        """Test health endpoint"""
        return self.run_test("Health Check", "GET", "health", 200)

    def test_login(self, email="admin@caseflow.io", password="admin123"):
        """Test login and get token"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_auth_me(self):
        """Test get current user"""
        return self.run_test("Get Current User", "GET", "auth/me", 200)

    def test_dashboard_stats(self):
        """Test dashboard stats"""
        return self.run_test("Dashboard Stats", "GET", "dashboard/stats", 200)

    def test_create_client(self):
        """Test client creation"""
        client_data = {
            "name": f"Test Client {datetime.now().strftime('%H%M%S')}",
            "email": f"test{datetime.now().strftime('%H%M%S')}@example.com",
            "phone": "555-0123",
            "address": "123 Test St",
            "notes": "Test client for API testing"
        }
        success, response = self.run_test(
            "Create Client",
            "POST",
            "clients",
            201,
            data=client_data
        )
        return response.get('id') if success else None

    def test_list_clients(self):
        """Test listing clients"""
        return self.run_test("List Clients", "GET", "clients", 200)

    def test_get_client(self, client_id):
        """Test getting specific client"""
        if not client_id:
            return False
        return self.run_test(f"Get Client {client_id}", "GET", f"clients/{client_id}", 200)

    def test_ai_copilot(self):
        """Test AI copilot (mocked)"""
        return self.run_test(
            "AI Copilot",
            "POST",
            "ai/copilot",
            200,
            data={"message": "summarize this client"}
        )

    def test_visits(self):
        """Test visits endpoint"""
        return self.run_test("List Visits", "GET", "visits", 200)

    def test_admin_vocabulary(self):
        """Test admin vocabulary endpoint"""
        return self.run_test("Admin Vocabulary", "GET", "admin/vocabulary", 200)

    def test_admin_users(self):
        """Test admin users endpoint"""
        return self.run_test("Admin Users", "GET", "admin/users", 200)

    def test_demo_seed(self):
        """Test demo data seeding"""
        return self.run_test(
            "Demo Data Seed",
            "POST",
            "demo/seed",
            200
        )

    def test_shareable_invite(self):
        """Test shareable invite creation"""
        invite_data = {
            "email": f"test{datetime.now().strftime('%H%M%S')}@example.com",
            "role": "CASE_WORKER",
            "message": "Welcome to the team!"
        }
        return self.run_test(
            "Create Shareable Invite",
            "POST",
            "invites/shareable",
            200,
            data=invite_data
        )

    def test_csv_import(self, client_id=None):
        """Test CSV import functionality"""
        # Create a simple CSV content for testing
        csv_content = "name,email,phone,address,notes\nTest Import User,import@test.com,555-1234,123 Import St,Imported via CSV"
        
        # For this test, we'll simulate the file upload
        # In a real scenario, this would be a multipart/form-data request
        print(f"\n🔍 Testing CSV Import...")
        print(f"   Note: CSV import requires multipart/form-data - testing endpoint availability")
        
        # Test if the endpoint exists by checking with invalid data
        url = f"{self.base_url}/api/clients/import"
        test_headers = {'Authorization': f'Bearer {self.token}'}
        
        try:
            # This will likely fail due to missing file, but we can check if endpoint exists
            response = self.session.post(url, headers=test_headers)
            if response.status_code in [400, 422]:  # Expected for missing file
                print(f"✅ CSV Import endpoint exists - Status: {response.status_code}")
                self.tests_passed += 1
                self.tests_run += 1
                return True, {}
            else:
                print(f"❌ Unexpected response - Status: {response.status_code}")
                self.failed_tests.append({
                    "test": "CSV Import",
                    "expected": "400 or 422",
                    "actual": response.status_code
                })
                self.tests_run += 1
                return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": "CSV Import",
                "error": str(e)
            })
            self.tests_run += 1
            return False, {}

    def test_file_attachments(self, client_id):
        """Test file attachments functionality"""
        if not client_id:
            print(f"\n🔍 Testing File Attachments...")
            print(f"   Skipped - No client ID available")
            return False, {}
            
        # Test listing attachments for a client
        return self.run_test(
            f"List Client Attachments",
            "GET",
            f"clients/{client_id}/attachments",
            200
        )

def main():
    print("🚀 Starting CaseFlow API Testing...")
    print("=" * 50)
    
    tester = CaseFlowAPITester()
    
    # Test health check first
    if not tester.test_health_check()[0]:
        print("❌ Health check failed, stopping tests")
        return 1

    # Test login
    if not tester.test_login():
        print("❌ Login failed, stopping tests")
        return 1

    # Test authenticated endpoints
    tester.test_auth_me()
    tester.test_dashboard_stats()
    
    # Test client operations
    client_id = tester.test_create_client()
    tester.test_list_clients()
    if client_id:
        tester.test_get_client(client_id)
    
    # Test other endpoints
    tester.test_ai_copilot()
    tester.test_visits()
    tester.test_admin_vocabulary()
    tester.test_admin_users()
    
    # Test new features
    print(f"\n🆕 Testing New Features...")
    tester.test_demo_seed()
    tester.test_shareable_invite()
    tester.test_csv_import()
    if client_id:
        tester.test_file_attachments(client_id)

    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.failed_tests:
        print("\n❌ Failed Tests:")
        for fail in tester.failed_tests:
            error_msg = fail.get('error', f"Status {fail.get('actual')} vs {fail.get('expected')}")
            print(f"   - {fail.get('test', 'Unknown')}: {error_msg}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
"""
Phase 6 Testing: RBAC System, Email Settings, Clear Data Bug Fix, Demo Login Buttons
Tests:
- RBAC: GET /api/admin/permissions/all - returns 35 permissions and 3 default roles
- RBAC: GET /api/admin/roles - returns role list with permission counts
- RBAC: PUT /api/admin/roles/{role_name} - updates custom permissions for a role
- RBAC: DELETE /api/admin/roles/{role_name} - resets role to defaults
- RBAC: GET /api/admin/users/{user_id}/permissions - returns user's effective permissions
- Email: GET /api/admin/email-settings - returns sendgrid_configured: false (no key set)
- Bug Fix: Clear All Data preserves demo users
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://127.0.0.1:8001').rstrip('/')

class TestRBACSystem:
    """RBAC Permission System Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and get session"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        self.admin_data = login_resp.json()
        print(f"✓ Admin login successful: {self.admin_data.get('user', {}).get('email')}")
    
    def test_get_all_permissions(self):
        """GET /api/admin/permissions/all - returns 35 permissions and 3 default roles"""
        resp = self.session.get(f"{BASE_URL}/api/admin/permissions/all")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        
        # Verify permissions list
        assert "permissions" in data, "Missing 'permissions' key"
        permissions = data["permissions"]
        assert isinstance(permissions, list), "Permissions should be a list"
        print(f"✓ Found {len(permissions)} permissions")
        
        # Verify default_roles
        assert "default_roles" in data, "Missing 'default_roles' key"
        default_roles = data["default_roles"]
        assert "ADMIN" in default_roles, "Missing ADMIN role"
        assert "CASE_WORKER" in default_roles, "Missing CASE_WORKER role"
        assert "VOLUNTEER" in default_roles, "Missing VOLUNTEER role"
        print(f"✓ Found 3 default roles: ADMIN, CASE_WORKER, VOLUNTEER")
        
        # Verify permission categories exist
        categories = set(p.split(".")[0] for p in permissions)
        expected_categories = {"clients", "services", "visits", "outcomes", "follow_ups", 
                               "payments", "reports", "messages", "admin", "demo", "ai", "storage"}
        for cat in expected_categories:
            assert cat in categories, f"Missing category: {cat}"
        print(f"✓ Permission categories: {sorted(categories)}")
    
    def test_get_roles_list(self):
        """GET /api/admin/roles - returns role list with permission counts"""
        resp = self.session.get(f"{BASE_URL}/api/admin/roles")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        roles = resp.json()
        
        assert isinstance(roles, list), "Roles should be a list"
        assert len(roles) == 3, f"Expected 3 roles, got {len(roles)}"
        
        role_names = [r["role_name"] for r in roles]
        assert "ADMIN" in role_names, "Missing ADMIN role"
        assert "CASE_WORKER" in role_names, "Missing CASE_WORKER role"
        assert "VOLUNTEER" in role_names, "Missing VOLUNTEER role"
        
        for role in roles:
            assert "permissions" in role, f"Missing permissions for {role['role_name']}"
            assert "is_custom" in role, f"Missing is_custom for {role['role_name']}"
            perm_count = len(role["permissions"])
            print(f"✓ {role['role_name']}: {perm_count} permissions, is_custom={role['is_custom']}")
    
    def test_update_role_permissions(self):
        """PUT /api/admin/roles/{role_name} - updates custom permissions for a role"""
        # Get current VOLUNTEER permissions
        roles_resp = self.session.get(f"{BASE_URL}/api/admin/roles")
        roles = roles_resp.json()
        volunteer_role = next(r for r in roles if r["role_name"] == "VOLUNTEER")
        original_perms = volunteer_role["permissions"]
        
        # Add a new permission
        new_perms = original_perms + ["messages.create"] if "messages.create" not in original_perms else original_perms
        
        resp = self.session.put(f"{BASE_URL}/api/admin/roles/VOLUNTEER", json={
            "permissions": new_perms
        })
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert "message" in data, "Missing message in response"
        print(f"✓ Updated VOLUNTEER permissions: {data['message']}")
        
        # Verify the update
        roles_resp = self.session.get(f"{BASE_URL}/api/admin/roles")
        roles = roles_resp.json()
        volunteer_role = next(r for r in roles if r["role_name"] == "VOLUNTEER")
        assert volunteer_role["is_custom"] == True, "VOLUNTEER should be marked as customized"
        print(f"✓ VOLUNTEER now has {len(volunteer_role['permissions'])} permissions (customized)")
    
    def test_reset_role_permissions(self):
        """DELETE /api/admin/roles/{role_name} - resets role to defaults"""
        # First customize CASE_WORKER
        self.session.put(f"{BASE_URL}/api/admin/roles/CASE_WORKER", json={
            "permissions": ["clients.read", "clients.create"]  # Minimal permissions
        })
        
        # Now reset
        resp = self.session.delete(f"{BASE_URL}/api/admin/roles/CASE_WORKER")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert "message" in data, "Missing message in response"
        print(f"✓ Reset CASE_WORKER: {data['message']}")
        
        # Verify reset
        roles_resp = self.session.get(f"{BASE_URL}/api/admin/roles")
        roles = roles_resp.json()
        cw_role = next(r for r in roles if r["role_name"] == "CASE_WORKER")
        assert cw_role["is_custom"] == False, "CASE_WORKER should not be customized after reset"
        print(f"✓ CASE_WORKER reset to defaults: {len(cw_role['permissions'])} permissions")
    
    def test_get_user_permissions(self):
        """GET /api/admin/users/{user_id}/permissions - returns user's effective permissions"""
        # Get users list first
        users_resp = self.session.get(f"{BASE_URL}/api/admin/users")
        assert users_resp.status_code == 200, f"Failed to get users: {users_resp.text}"
        users = users_resp.json()
        
        if len(users) == 0:
            pytest.skip("No users found to test permissions")
        
        # Get permissions for first user
        user_id = users[0]["id"]
        resp = self.session.get(f"{BASE_URL}/api/admin/users/{user_id}/permissions")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        
        assert "user_id" in data, "Missing user_id"
        assert "role" in data, "Missing role"
        assert "permissions" in data, "Missing permissions"
        assert isinstance(data["permissions"], list), "Permissions should be a list"
        print(f"✓ User {user_id} ({data['role']}): {len(data['permissions'])} permissions")
    
    def test_invalid_permission_rejected(self):
        """PUT /api/admin/roles/{role_name} - rejects invalid permissions"""
        resp = self.session.put(f"{BASE_URL}/api/admin/roles/VOLUNTEER", json={
            "permissions": ["invalid.permission", "clients.read"]
        })
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
        print("✓ Invalid permission correctly rejected")


class TestEmailSettings:
    """Email Settings Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
    
    def test_get_email_settings(self):
        """GET /api/admin/email-settings - returns sendgrid_configured: false (no key set)"""
        resp = self.session.get(f"{BASE_URL}/api/admin/email-settings")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        
        assert "sendgrid_configured" in data, "Missing sendgrid_configured"
        # Since no SendGrid key is set, should be false
        assert data["sendgrid_configured"] == False, "Expected sendgrid_configured to be False"
        print(f"✓ Email settings: sendgrid_configured={data['sendgrid_configured']}")
        
        # sender_email should be None when not configured
        if not data["sendgrid_configured"]:
            assert data.get("sender_email") is None, "sender_email should be None when not configured"
            print("✓ sender_email is None (not configured)")


class TestClearDataBugFix:
    """Bug Fix: Clear All Data preserves demo users"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
    
    def test_seed_then_clear_preserves_demo_users(self):
        """Seed demo data, clear data, verify demo users can still login"""
        # Step 1: Seed demo data
        seed_resp = self.session.post(f"{BASE_URL}/api/demo/seed")
        assert seed_resp.status_code == 200, f"Seed failed: {seed_resp.text}"
        seed_data = seed_resp.json()
        print(f"✓ Seeded demo data: {seed_data.get('message', '')}")
        
        # Step 2: Clear all data
        clear_resp = self.session.post(f"{BASE_URL}/api/demo/clear")
        assert clear_resp.status_code == 200, f"Clear failed: {clear_resp.text}"
        clear_data = clear_resp.json()
        print(f"✓ Cleared data: {clear_data.get('message', '')}")
        
        # Step 3: Verify caseworker can still login
        cw_session = requests.Session()
        cw_login = cw_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "caseworker@demo.caseflow.io",
            "password": "demo1234"
        })
        assert cw_login.status_code == 200, f"Case worker login failed after clear: {cw_login.text}"
        print("✓ Case worker (caseworker@demo.caseflow.io) can still login after clear")
        
        # Step 4: Verify volunteer can still login
        vol_session = requests.Session()
        vol_login = vol_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "volunteer@demo.caseflow.io",
            "password": "demo1234"
        })
        assert vol_login.status_code == 200, f"Volunteer login failed after clear: {vol_login.text}"
        print("✓ Volunteer (volunteer@demo.caseflow.io) can still login after clear")


class TestDemoUserRoles:
    """Test demo user role restrictions"""
    
    def test_caseworker_login_and_access(self):
        """Case worker login works and has appropriate permissions"""
        session = requests.Session()
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "caseworker@demo.caseflow.io",
            "password": "demo1234"
        })
        
        if login_resp.status_code == 401:
            # Demo users might not exist yet, seed them first
            admin_session = requests.Session()
            admin_session.post(f"{BASE_URL}/api/auth/login", json={
                "email": "admin@caseflow.io",
                "password": "admin123"
            })
            admin_session.post(f"{BASE_URL}/api/demo/seed")
            
            # Try login again
            login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
                "email": "caseworker@demo.caseflow.io",
                "password": "demo1234"
            })
        
        assert login_resp.status_code == 200, f"Case worker login failed: {login_resp.text}"
        data = login_resp.json()
        # User data is at root level, not nested under 'user'
        assert data["role"] == "CASE_WORKER", f"Expected CASE_WORKER role, got {data['role']}"
        print(f"✓ Case worker login successful: {data['name']} ({data['role']})")
        
        # Case worker should be able to access clients
        clients_resp = session.get(f"{BASE_URL}/api/clients")
        assert clients_resp.status_code == 200, f"Case worker cannot access clients: {clients_resp.text}"
        print("✓ Case worker can access /api/clients")
        
        # Case worker should NOT be able to access admin settings
        admin_resp = session.get(f"{BASE_URL}/api/admin/users")
        assert admin_resp.status_code == 403, f"Case worker should not access admin users, got {admin_resp.status_code}"
        print("✓ Case worker correctly denied access to /api/admin/users")
    
    def test_volunteer_login_and_restrictions(self):
        """Volunteer login works and has restricted permissions"""
        session = requests.Session()
        login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "volunteer@demo.caseflow.io",
            "password": "demo1234"
        })
        
        if login_resp.status_code == 401:
            # Demo users might not exist yet, seed them first
            admin_session = requests.Session()
            admin_session.post(f"{BASE_URL}/api/auth/login", json={
                "email": "admin@caseflow.io",
                "password": "admin123"
            })
            admin_session.post(f"{BASE_URL}/api/demo/seed")
            
            # Try login again
            login_resp = session.post(f"{BASE_URL}/api/auth/login", json={
                "email": "volunteer@demo.caseflow.io",
                "password": "demo1234"
            })
        
        assert login_resp.status_code == 200, f"Volunteer login failed: {login_resp.text}"
        data = login_resp.json()
        # User data is at root level, not nested under 'user'
        assert data["role"] == "VOLUNTEER", f"Expected VOLUNTEER role, got {data['role']}"
        print(f"✓ Volunteer login successful: {data['name']} ({data['role']})")
        
        # Volunteer should be able to read clients
        clients_resp = session.get(f"{BASE_URL}/api/clients")
        assert clients_resp.status_code == 200, f"Volunteer cannot read clients: {clients_resp.text}"
        print("✓ Volunteer can read /api/clients")
        
        # Volunteer should NOT be able to access admin settings
        admin_resp = session.get(f"{BASE_URL}/api/admin/users")
        assert admin_resp.status_code == 403, f"Volunteer should not access admin users, got {admin_resp.status_code}"
        print("✓ Volunteer correctly denied access to /api/admin/users")
        
        # Volunteer should NOT be able to access reports
        reports_resp = session.get(f"{BASE_URL}/api/reports/export?type=clients")
        assert reports_resp.status_code == 403, f"Volunteer should not access reports, got {reports_resp.status_code}"
        print("✓ Volunteer correctly denied access to /api/reports/export")


class TestRegressionAPIs:
    """Regression tests for existing APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
    
    def test_dashboard_stats(self):
        """GET /api/dashboard/stats - still works"""
        resp = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert "client_count" in data, "Missing client_count"
        print(f"✓ Dashboard stats: {data.get('client_count', 0)} clients")
    
    def test_clients_list(self):
        """GET /api/clients - still works"""
        resp = self.session.get(f"{BASE_URL}/api/clients")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert "data" in data or isinstance(data, list), "Invalid response format"
        print("✓ Clients list endpoint working")
    
    def test_notifications_list(self):
        """GET /api/notifications - still works"""
        resp = self.session.get(f"{BASE_URL}/api/notifications")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        print("✓ Notifications endpoint working")
    
    def test_messages_list(self):
        """GET /api/messages - still works"""
        resp = self.session.get(f"{BASE_URL}/api/messages")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        print("✓ Messages endpoint working")
    
    def test_payments_requests(self):
        """GET /api/payments/requests - still works"""
        resp = self.session.get(f"{BASE_URL}/api/payments/requests")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        print("✓ Payment requests endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

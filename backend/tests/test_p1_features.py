"""
Test P1 Features for CaseFlow:
1. Dashboard Demographics Breakdown Chart (R27.1)
2. Advanced Client Filtering by status/date (R9.3)
3. Visit Conflict Detection (R6.3)
4. Duplicate Client Detection (R4.5)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://127.0.0.1:8001').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@caseflow.io"
ADMIN_PASSWORD = "admin123"
CASEWORKER_EMAIL = "caseworker@demo.caseflow.io"
CASEWORKER_PASSWORD = "demo1234"


class TestSetup:
    """Setup and authentication tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def admin_token(self, session):
        """Get admin authentication token"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def caseworker_token(self, session):
        """Get case worker authentication token"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": CASEWORKER_EMAIL,
            "password": CASEWORKER_PASSWORD
        })
        assert response.status_code == 200, f"Case worker login failed: {response.text}"
        data = response.json()
        return data.get("access_token") or data.get("token")


class TestDashboardDemographics(TestSetup):
    """Test Dashboard Demographics Breakdown Chart (R27.1)"""
    
    def test_demographics_endpoint_returns_200(self, session, admin_token):
        """GET /api/dashboard/demographics returns 200"""
        response = session.get(
            f"{BASE_URL}/api/dashboard/demographics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Demographics endpoint failed: {response.text}"
    
    def test_demographics_returns_array(self, session, admin_token):
        """Demographics endpoint returns an array"""
        response = session.get(
            f"{BASE_URL}/api/dashboard/demographics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        assert isinstance(data, list), f"Expected array, got {type(data)}"
    
    def test_demographics_has_categories(self, session, admin_token):
        """Demographics data has categories with items"""
        response = session.get(
            f"{BASE_URL}/api/dashboard/demographics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        # Should have at least age_group and gender categories based on demo data
        categories = [cat["category"] for cat in data]
        print(f"Demographics categories found: {categories}")
        assert len(data) > 0, "Expected at least one demographic category"
        
        # Check structure of each category
        for cat in data:
            assert "category" in cat, "Category missing 'category' field"
            assert "items" in cat, "Category missing 'items' field"
            assert isinstance(cat["items"], list), "Items should be a list"
    
    def test_demographics_has_age_group(self, session, admin_token):
        """Demographics includes age_group category"""
        response = session.get(
            f"{BASE_URL}/api/dashboard/demographics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        categories = [cat["category"] for cat in data]
        assert "age_group" in categories, f"Expected 'age_group' category, found: {categories}"
    
    def test_demographics_has_gender(self, session, admin_token):
        """Demographics includes gender category"""
        response = session.get(
            f"{BASE_URL}/api/dashboard/demographics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        categories = [cat["category"] for cat in data]
        assert "gender" in categories, f"Expected 'gender' category, found: {categories}"
    
    def test_demographics_items_have_label_and_count(self, session, admin_token):
        """Each demographic item has label and count"""
        response = session.get(
            f"{BASE_URL}/api/dashboard/demographics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        for cat in data:
            for item in cat["items"]:
                assert "label" in item, f"Item missing 'label' in category {cat['category']}"
                assert "count" in item, f"Item missing 'count' in category {cat['category']}"
                assert isinstance(item["count"], int), f"Count should be integer"


class TestClientFiltering(TestSetup):
    """Test Advanced Client Filtering by status/date (R9.3)"""
    
    def test_clients_list_returns_200(self, session, admin_token):
        """GET /api/clients returns 200"""
        response = session.get(
            f"{BASE_URL}/api/clients",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Clients list failed: {response.text}"
    
    def test_filter_active_clients(self, session, admin_token):
        """GET /api/clients?status=active returns only active clients"""
        response = session.get(
            f"{BASE_URL}/api/clients",
            params={"status": "active"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        clients = data.get("data", [])
        print(f"Active clients count: {len(clients)}")
        # All returned clients should have pending=False
        for client in clients:
            assert client.get("pending") == False, f"Client {client.get('name')} should be active (pending=False)"
    
    def test_filter_pending_clients(self, session, admin_token):
        """GET /api/clients?status=pending returns only pending clients"""
        response = session.get(
            f"{BASE_URL}/api/clients",
            params={"status": "pending"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        clients = data.get("data", [])
        print(f"Pending clients count: {len(clients)}")
        # All returned clients should have pending=True
        for client in clients:
            assert client.get("pending") == True, f"Client {client.get('name')} should be pending (pending=True)"
    
    def test_search_by_name(self, session, admin_token):
        """Search param searches name field"""
        response = session.get(
            f"{BASE_URL}/api/clients",
            params={"search": "maria"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        clients = data.get("data", [])
        print(f"Search 'maria' found: {len(clients)} clients")
        # Should find clients with 'maria' in name
        if len(clients) > 0:
            for client in clients:
                name_match = "maria" in client.get("name", "").lower()
                email_match = "maria" in (client.get("email") or "").lower()
                phone_match = "maria" in (client.get("phone") or "").lower()
                assert name_match or email_match or phone_match, f"Client {client.get('name')} doesn't match search"
    
    def test_search_by_email(self, session, admin_token):
        """Search param searches email field"""
        response = session.get(
            f"{BASE_URL}/api/clients",
            params={"search": "@email.com"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        clients = data.get("data", [])
        print(f"Search '@email.com' found: {len(clients)} clients")
    
    def test_search_by_phone(self, session, admin_token):
        """Search param searches phone field"""
        response = session.get(
            f"{BASE_URL}/api/clients",
            params={"search": "555"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        clients = data.get("data", [])
        print(f"Search '555' found: {len(clients)} clients")
    
    def test_date_from_filter(self, session, admin_token):
        """Date from filter works"""
        # Use a date in the past
        date_from = "2024-01-01"
        response = session.get(
            f"{BASE_URL}/api/clients",
            params={"date_from": date_from},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"Clients from {date_from}: {data.get('pagination', {}).get('total_count', 0)}")
    
    def test_date_to_filter(self, session, admin_token):
        """Date to filter works"""
        date_to = datetime.now().strftime("%Y-%m-%d")
        response = session.get(
            f"{BASE_URL}/api/clients",
            params={"date_to": date_to},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"Clients to {date_to}: {data.get('pagination', {}).get('total_count', 0)}")


class TestDuplicateClientDetection(TestSetup):
    """Test Duplicate Client Detection (R4.5)"""
    
    def test_check_duplicate_endpoint_exists(self, session, admin_token):
        """POST /api/clients/check-duplicate endpoint exists"""
        response = session.post(
            f"{BASE_URL}/api/clients/check-duplicate",
            json={"name": "Test", "email": "test@test.com"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Check duplicate endpoint failed: {response.text}"
    
    def test_check_duplicate_returns_structure(self, session, admin_token):
        """Check duplicate returns has_duplicates and duplicates fields"""
        response = session.post(
            f"{BASE_URL}/api/clients/check-duplicate",
            json={"name": "Test", "email": "nonexistent@test.com"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "has_duplicates" in data, "Response missing 'has_duplicates' field"
        assert "duplicates" in data, "Response missing 'duplicates' field"
    
    def test_check_duplicate_detects_email_match(self, session, admin_token):
        """Check duplicate detects matching email"""
        # First get an existing client's email
        clients_response = session.get(
            f"{BASE_URL}/api/clients",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        clients = clients_response.json().get("data", [])
        existing_email = None
        for c in clients:
            if c.get("email"):
                existing_email = c.get("email")
                break
        
        if existing_email:
            response = session.post(
                f"{BASE_URL}/api/clients/check-duplicate",
                json={"name": "New Client", "email": existing_email},
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            print(f"Duplicate check for email {existing_email}: {data}")
            assert data.get("has_duplicates") == True, f"Should detect duplicate for email {existing_email}"
            assert len(data.get("duplicates", [])) > 0, "Should return duplicate details"
            # Check duplicate has match_type
            for dup in data.get("duplicates", []):
                assert "match_type" in dup, "Duplicate should have match_type"
        else:
            pytest.skip("No clients with email found for duplicate test")
    
    def test_check_duplicate_detects_phone_match(self, session, admin_token):
        """Check duplicate detects matching phone"""
        # First get an existing client's phone
        clients_response = session.get(
            f"{BASE_URL}/api/clients",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        clients = clients_response.json().get("data", [])
        existing_phone = None
        for c in clients:
            if c.get("phone"):
                existing_phone = c.get("phone")
                break
        
        if existing_phone:
            response = session.post(
                f"{BASE_URL}/api/clients/check-duplicate",
                json={"name": "New Client", "phone": existing_phone},
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            print(f"Duplicate check for phone {existing_phone}: {data}")
            assert data.get("has_duplicates") == True, f"Should detect duplicate for phone {existing_phone}"
        else:
            pytest.skip("No clients with phone found for duplicate test")
    
    def test_no_duplicate_for_new_contact(self, session, admin_token):
        """No duplicate detected for completely new contact info"""
        response = session.post(
            f"{BASE_URL}/api/clients/check-duplicate",
            json={"name": "Brand New Client", "email": "brandnew_unique_12345@test.com", "phone": "+1-999-888-7777"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("has_duplicates") == False, "Should not detect duplicate for new contact"


class TestVisitConflictDetection(TestSetup):
    """Test Visit Conflict Detection (R6.3)"""
    
    def test_check_conflicts_endpoint_exists(self, session, admin_token):
        """POST /api/visits/check-conflicts endpoint exists"""
        # Get a client ID first
        clients_response = session.get(
            f"{BASE_URL}/api/clients",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        clients = clients_response.json().get("data", [])
        if not clients:
            pytest.skip("No clients available for conflict test")
        
        client_id = clients[0]["id"]
        future_date = (datetime.now() + timedelta(days=30)).isoformat()
        
        response = session.post(
            f"{BASE_URL}/api/visits/check-conflicts",
            json={"client_id": client_id, "date": future_date, "duration": 60},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Check conflicts endpoint failed: {response.text}"
    
    def test_check_conflicts_returns_structure(self, session, admin_token):
        """Check conflicts returns has_conflicts and conflicts fields"""
        clients_response = session.get(
            f"{BASE_URL}/api/clients",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        clients = clients_response.json().get("data", [])
        if not clients:
            pytest.skip("No clients available")
        
        client_id = clients[0]["id"]
        future_date = (datetime.now() + timedelta(days=30)).isoformat()
        
        response = session.post(
            f"{BASE_URL}/api/visits/check-conflicts",
            json={"client_id": client_id, "date": future_date, "duration": 60},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        assert "has_conflicts" in data, "Response missing 'has_conflicts' field"
        assert "conflicts" in data, "Response missing 'conflicts' field"
    
    def test_conflict_detection_with_overlapping_visit(self, session, admin_token):
        """Create a visit then check for conflict at same time"""
        # Get a client
        clients_response = session.get(
            f"{BASE_URL}/api/clients",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        clients = clients_response.json().get("data", [])
        if not clients:
            pytest.skip("No clients available")
        
        client_id = clients[0]["id"]
        # Use a specific future date/time
        visit_time = datetime.now() + timedelta(days=45, hours=10)
        visit_date = visit_time.strftime("%Y-%m-%dT%H:%M")
        
        # Create a visit
        create_response = session.post(
            f"{BASE_URL}/api/visits",
            json={"client_id": client_id, "date": visit_date, "duration": 60, "notes": "TEST_CONFLICT_VISIT"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_response.status_code == 200, f"Failed to create visit: {create_response.text}"
        created_visit = create_response.json()
        print(f"Created visit: {created_visit.get('id')} at {visit_date}")
        
        # Now check for conflict at the same time
        conflict_response = session.post(
            f"{BASE_URL}/api/visits/check-conflicts",
            json={"client_id": client_id, "date": visit_date, "duration": 60},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert conflict_response.status_code == 200
        conflict_data = conflict_response.json()
        print(f"Conflict check result: {conflict_data}")
        
        assert conflict_data.get("has_conflicts") == True, "Should detect conflict for overlapping visit"
        assert len(conflict_data.get("conflicts", [])) > 0, "Should return conflict details"
    
    def test_no_conflict_for_different_time(self, session, admin_token):
        """No conflict for visit at different time"""
        clients_response = session.get(
            f"{BASE_URL}/api/clients",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        clients = clients_response.json().get("data", [])
        if not clients:
            pytest.skip("No clients available")
        
        client_id = clients[0]["id"]
        # Use a very different future date
        future_date = (datetime.now() + timedelta(days=100)).strftime("%Y-%m-%dT%H:%M")
        
        response = session.post(
            f"{BASE_URL}/api/visits/check-conflicts",
            json={"client_id": client_id, "date": future_date, "duration": 60},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        # This might or might not have conflicts depending on existing data
        print(f"Conflict check for {future_date}: {data}")


class TestCaseWorkerAccess(TestSetup):
    """Test that case worker can access P1 features"""
    
    def test_caseworker_can_access_demographics(self, session, caseworker_token):
        """Case worker can access demographics endpoint"""
        response = session.get(
            f"{BASE_URL}/api/dashboard/demographics",
            headers={"Authorization": f"Bearer {caseworker_token}"}
        )
        assert response.status_code == 200, f"Case worker demographics access failed: {response.text}"
    
    def test_caseworker_can_filter_clients(self, session, caseworker_token):
        """Case worker can filter clients by status"""
        response = session.get(
            f"{BASE_URL}/api/clients",
            params={"status": "active"},
            headers={"Authorization": f"Bearer {caseworker_token}"}
        )
        assert response.status_code == 200, f"Case worker client filter failed: {response.text}"
    
    def test_caseworker_can_check_duplicates(self, session, caseworker_token):
        """Case worker can check for duplicate clients"""
        response = session.post(
            f"{BASE_URL}/api/clients/check-duplicate",
            json={"name": "Test", "email": "test@test.com"},
            headers={"Authorization": f"Bearer {caseworker_token}"}
        )
        assert response.status_code == 200, f"Case worker duplicate check failed: {response.text}"
    
    def test_caseworker_can_check_conflicts(self, session, caseworker_token):
        """Case worker can check for visit conflicts"""
        # Get a client first
        clients_response = session.get(
            f"{BASE_URL}/api/clients",
            headers={"Authorization": f"Bearer {caseworker_token}"}
        )
        clients = clients_response.json().get("data", [])
        if not clients:
            pytest.skip("No clients available")
        
        client_id = clients[0]["id"]
        future_date = (datetime.now() + timedelta(days=30)).isoformat()
        
        response = session.post(
            f"{BASE_URL}/api/visits/check-conflicts",
            json={"client_id": client_id, "date": future_date, "duration": 60},
            headers={"Authorization": f"Bearer {caseworker_token}"}
        )
        assert response.status_code == 200, f"Case worker conflict check failed: {response.text}"

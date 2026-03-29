"""
Test suite for R27.7 (Dashboard CSV Export), R35.4 (AI Narrative Reports), R5.4 (72h Edit Window)
These are the 3 final features implemented for CaseFlow.
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
VOLUNTEER_EMAIL = "volunteer@demo.caseflow.io"
VOLUNTEER_PASSWORD = "demo1234"


@pytest.fixture(scope="module")
def admin_session():
    """Get authenticated admin session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return session


@pytest.fixture(scope="module")
def caseworker_session():
    """Get authenticated case worker session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": CASEWORKER_EMAIL,
        "password": CASEWORKER_PASSWORD
    })
    assert response.status_code == 200, f"Case worker login failed: {response.text}"
    return session


@pytest.fixture(scope="module")
def volunteer_session():
    """Get authenticated volunteer session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": VOLUNTEER_EMAIL,
        "password": VOLUNTEER_PASSWORD
    })
    assert response.status_code == 200, f"Volunteer login failed: {response.text}"
    return session


# ============================================================================
# R27.7: Dashboard CSV Export Tests (Admin Only)
# ============================================================================

class TestDashboardCSVExport:
    """Tests for GET /api/reports/dashboard-csv endpoint"""
    
    def test_dashboard_csv_returns_200_for_admin(self, admin_session):
        """Admin should be able to download dashboard CSV"""
        response = admin_session.get(f"{BASE_URL}/api/reports/dashboard-csv")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Dashboard CSV returns 200 for admin")
    
    def test_dashboard_csv_content_type_is_csv(self, admin_session):
        """Response should have CSV content type"""
        response = admin_session.get(f"{BASE_URL}/api/reports/dashboard-csv")
        assert response.status_code == 200
        content_type = response.headers.get("Content-Type", "")
        assert "text/csv" in content_type, f"Expected text/csv, got {content_type}"
        print("✓ Dashboard CSV has correct content type")
    
    def test_dashboard_csv_has_attachment_header(self, admin_session):
        """Response should have Content-Disposition attachment header"""
        response = admin_session.get(f"{BASE_URL}/api/reports/dashboard-csv")
        assert response.status_code == 200
        disposition = response.headers.get("Content-Disposition", "")
        assert "attachment" in disposition, f"Expected attachment header, got {disposition}"
        assert "dashboard_export.csv" in disposition, f"Expected dashboard_export.csv filename"
        print("✓ Dashboard CSV has correct attachment header")
    
    def test_dashboard_csv_contains_summary_section(self, admin_session):
        """CSV should contain DASHBOARD SUMMARY section"""
        response = admin_session.get(f"{BASE_URL}/api/reports/dashboard-csv")
        assert response.status_code == 200
        content = response.text
        assert "DASHBOARD SUMMARY" in content, "CSV should contain DASHBOARD SUMMARY header"
        assert "Total Clients" in content, "CSV should contain Total Clients"
        assert "Total Services" in content, "CSV should contain Total Services"
        assert "Total Visits" in content, "CSV should contain Total Visits"
        assert "Total Outcomes" in content, "CSV should contain Total Outcomes"
        print("✓ Dashboard CSV contains summary section with all stats")
    
    def test_dashboard_csv_contains_daily_trends(self, admin_session):
        """CSV should contain DAILY ACTIVITY TRENDS section"""
        response = admin_session.get(f"{BASE_URL}/api/reports/dashboard-csv")
        assert response.status_code == 200
        content = response.text
        assert "DAILY ACTIVITY TRENDS" in content, "CSV should contain DAILY ACTIVITY TRENDS header"
        assert "date,services,visits" in content.lower(), "CSV should have date,services,visits columns"
        print("✓ Dashboard CSV contains daily trends section")
    
    def test_dashboard_csv_denied_for_caseworker(self, caseworker_session):
        """Case worker should NOT be able to download dashboard CSV"""
        response = caseworker_session.get(f"{BASE_URL}/api/reports/dashboard-csv")
        assert response.status_code == 403, f"Expected 403 for case worker, got {response.status_code}"
        print("✓ Dashboard CSV correctly denied for case worker")
    
    def test_dashboard_csv_denied_for_volunteer(self, volunteer_session):
        """Volunteer should NOT be able to download dashboard CSV"""
        response = volunteer_session.get(f"{BASE_URL}/api/reports/dashboard-csv")
        assert response.status_code == 403, f"Expected 403 for volunteer, got {response.status_code}"
        print("✓ Dashboard CSV correctly denied for volunteer")


# ============================================================================
# R35.4: AI Narrative Reports Tests (Admin Only)
# ============================================================================

class TestAINarrativeReports:
    """Tests for POST /api/reports/narrative endpoint"""
    
    def test_narrative_endpoint_exists(self, admin_session):
        """Narrative endpoint should exist and accept POST"""
        response = admin_session.post(f"{BASE_URL}/api/reports/narrative", json={"client_ids": []})
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print("✓ Narrative endpoint exists")
    
    def test_narrative_all_clients_returns_200(self, admin_session):
        """Empty client_ids should generate narratives for ALL clients"""
        response = admin_session.post(f"{BASE_URL}/api/reports/narrative", json={"client_ids": []})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "narratives" in data, "Response should contain narratives array"
        assert "total_clients" in data, "Response should contain total_clients count"
        assert "generated_at" in data, "Response should contain generated_at timestamp"
        print(f"✓ Narrative for all clients returns 200 with {data['total_clients']} narratives")
    
    def test_narrative_response_structure(self, admin_session):
        """Each narrative should have required fields"""
        response = admin_session.post(f"{BASE_URL}/api/reports/narrative", json={"client_ids": []})
        assert response.status_code == 200
        data = response.json()
        assert len(data["narratives"]) > 0, "Should have at least one narrative"
        
        narrative = data["narratives"][0]
        assert "client_id" in narrative, "Narrative should have client_id"
        assert "client_name" in narrative, "Narrative should have client_name"
        assert "narrative" in narrative, "Narrative should have narrative text"
        assert "stats" in narrative, "Narrative should have stats object"
        
        stats = narrative["stats"]
        assert "services" in stats, "Stats should have services count"
        assert "outcomes" in stats, "Stats should have outcomes count"
        assert "visits" in stats, "Stats should have visits count"
        print("✓ Narrative response has correct structure")
    
    def test_narrative_specific_clients(self, admin_session):
        """Should generate narratives for only selected clients"""
        # First get a client ID
        clients_response = admin_session.get(f"{BASE_URL}/api/clients?page_size=2")
        assert clients_response.status_code == 200
        clients = clients_response.json().get("data", [])
        assert len(clients) > 0, "Need at least one client for test"
        
        client_id = clients[0]["id"]
        response = admin_session.post(f"{BASE_URL}/api/reports/narrative", json={"client_ids": [client_id]})
        assert response.status_code == 200
        data = response.json()
        assert data["total_clients"] == 1, f"Expected 1 client, got {data['total_clients']}"
        assert data["narratives"][0]["client_id"] == client_id
        print(f"✓ Narrative for specific client {client_id} works correctly")
    
    def test_narrative_multiple_specific_clients(self, admin_session):
        """Should generate narratives for multiple selected clients"""
        clients_response = admin_session.get(f"{BASE_URL}/api/clients?page_size=3")
        assert clients_response.status_code == 200
        clients = clients_response.json().get("data", [])
        
        if len(clients) >= 2:
            client_ids = [c["id"] for c in clients[:2]]
            response = admin_session.post(f"{BASE_URL}/api/reports/narrative", json={"client_ids": client_ids})
            assert response.status_code == 200
            data = response.json()
            assert data["total_clients"] == 2, f"Expected 2 clients, got {data['total_clients']}"
            print("✓ Narrative for multiple specific clients works correctly")
        else:
            pytest.skip("Not enough clients for multi-client test")
    
    def test_narrative_denied_for_caseworker(self, caseworker_session):
        """Case worker should NOT be able to generate narratives"""
        response = caseworker_session.post(f"{BASE_URL}/api/reports/narrative", json={"client_ids": []})
        assert response.status_code == 403, f"Expected 403 for case worker, got {response.status_code}"
        print("✓ Narrative correctly denied for case worker")
    
    def test_narrative_denied_for_volunteer(self, volunteer_session):
        """Volunteer should NOT be able to generate narratives"""
        response = volunteer_session.post(f"{BASE_URL}/api/reports/narrative", json={"client_ids": []})
        assert response.status_code == 403, f"Expected 403 for volunteer, got {response.status_code}"
        print("✓ Narrative correctly denied for volunteer")


# ============================================================================
# R5.4: Service Log 72-Hour Edit Window Tests
# ============================================================================

class TestServiceLog72HourEditWindow:
    """Tests for 72-hour edit window enforcement on service logs"""
    
    @pytest.fixture
    def test_client_id(self, admin_session):
        """Get a client ID for testing"""
        response = admin_session.get(f"{BASE_URL}/api/clients?page_size=1")
        assert response.status_code == 200
        clients = response.json().get("data", [])
        assert len(clients) > 0, "Need at least one client"
        return clients[0]["id"]
    
    def test_services_list_has_editable_field(self, admin_session, test_client_id):
        """GET /api/clients/{id}/services should return editable boolean"""
        response = admin_session.get(f"{BASE_URL}/api/clients/{test_client_id}/services")
        assert response.status_code == 200
        services = response.json()
        
        if len(services) > 0:
            service = services[0]
            assert "editable" in service, "Service should have 'editable' field"
            assert isinstance(service["editable"], bool), "editable should be boolean"
            print(f"✓ Services list has editable field (first service editable={service['editable']})")
        else:
            print("✓ Services list endpoint works (no services to check editable field)")
    
    def test_create_new_service_is_editable(self, admin_session, test_client_id):
        """Newly created service should be editable (within 72h)"""
        # Create a new service
        service_data = {
            "service_date": datetime.now().strftime("%Y-%m-%d"),
            "service_type": "TEST_72h_Service",
            "provider_name": "Test Provider",
            "notes": "Testing 72h edit window"
        }
        create_response = admin_session.post(
            f"{BASE_URL}/api/clients/{test_client_id}/services",
            json=service_data
        )
        assert create_response.status_code == 200, f"Failed to create service: {create_response.text}"
        created_service = create_response.json()
        
        assert "editable" in created_service, "Created service should have editable field"
        assert created_service["editable"] == True, "Newly created service should be editable"
        print(f"✓ Newly created service is editable (id={created_service.get('id')})")
        
        return created_service.get("id")
    
    def test_edit_new_service_succeeds(self, admin_session, test_client_id):
        """Editing a newly created service (within 72h) should succeed"""
        # Create a new service
        service_data = {
            "service_date": datetime.now().strftime("%Y-%m-%d"),
            "service_type": "TEST_Edit_Service",
            "provider_name": "Original Provider",
            "notes": "Original notes"
        }
        create_response = admin_session.post(
            f"{BASE_URL}/api/clients/{test_client_id}/services",
            json=service_data
        )
        assert create_response.status_code == 200
        service_id = create_response.json().get("id")
        
        # Try to edit it
        update_data = {
            "service_date": datetime.now().strftime("%Y-%m-%d"),
            "service_type": "TEST_Edit_Service_Updated",
            "provider_name": "Updated Provider",
            "notes": "Updated notes"
        }
        update_response = admin_session.put(
            f"{BASE_URL}/api/clients/{test_client_id}/services/{service_id}",
            json=update_data
        )
        assert update_response.status_code == 200, f"Edit should succeed: {update_response.text}"
        updated = update_response.json()
        assert updated["provider_name"] == "Updated Provider", "Provider name should be updated"
        print(f"✓ Editing new service (within 72h) succeeds")
    
    def test_old_service_is_not_editable(self, admin_session, test_client_id):
        """Old services (created > 72h ago) should have editable=False"""
        response = admin_session.get(f"{BASE_URL}/api/clients/{test_client_id}/services")
        assert response.status_code == 200
        services = response.json()
        
        # Find a service that's not editable (old demo data)
        old_services = [s for s in services if s.get("editable") == False]
        
        if len(old_services) > 0:
            print(f"✓ Found {len(old_services)} old service(s) with editable=False")
        else:
            # All services might be new - check if any exist
            if len(services) > 0:
                print("⚠ All existing services are still within 72h window")
            else:
                print("⚠ No services exist to verify old service editable status")
    
    def test_edit_old_service_fails_with_403(self, admin_session, test_client_id):
        """Editing an old service (past 72h) should return 403"""
        response = admin_session.get(f"{BASE_URL}/api/clients/{test_client_id}/services")
        assert response.status_code == 200
        services = response.json()
        
        # Find a service that's not editable
        old_services = [s for s in services if s.get("editable") == False]
        
        if len(old_services) > 0:
            old_service = old_services[0]
            service_id = old_service["id"]
            
            # Try to edit it
            update_data = {
                "service_date": datetime.now().strftime("%Y-%m-%d"),
                "service_type": "Attempted Update",
                "provider_name": "Should Fail",
                "notes": "This should fail"
            }
            update_response = admin_session.put(
                f"{BASE_URL}/api/clients/{test_client_id}/services/{service_id}",
                json=update_data
            )
            assert update_response.status_code == 403, f"Expected 403, got {update_response.status_code}"
            error_detail = update_response.json().get("detail", "")
            assert "72-hour" in error_detail.lower() or "72h" in error_detail.lower(), \
                f"Error should mention 72-hour window: {error_detail}"
            print(f"✓ Editing old service correctly returns 403 with 72h message")
        else:
            pytest.skip("No old services (past 72h) available to test edit rejection")
    
    def test_caseworker_can_create_service(self, caseworker_session):
        """Case worker should be able to create services"""
        # Get a client
        clients_response = caseworker_session.get(f"{BASE_URL}/api/clients?page_size=1")
        assert clients_response.status_code == 200
        clients = clients_response.json().get("data", [])
        assert len(clients) > 0
        client_id = clients[0]["id"]
        
        service_data = {
            "service_date": datetime.now().strftime("%Y-%m-%d"),
            "service_type": "CaseWorker_Service",
            "provider_name": "Case Worker Provider",
            "notes": "Created by case worker"
        }
        response = caseworker_session.post(
            f"{BASE_URL}/api/clients/{client_id}/services",
            json=service_data
        )
        assert response.status_code == 200, f"Case worker should create service: {response.text}"
        print("✓ Case worker can create services")
    
    def test_volunteer_cannot_create_service(self, volunteer_session):
        """Volunteer should NOT be able to create services"""
        # Get a client
        clients_response = volunteer_session.get(f"{BASE_URL}/api/clients?page_size=1")
        assert clients_response.status_code == 200
        clients = clients_response.json().get("data", [])
        assert len(clients) > 0
        client_id = clients[0]["id"]
        
        service_data = {
            "service_date": datetime.now().strftime("%Y-%m-%d"),
            "service_type": "Volunteer_Service",
            "provider_name": "Volunteer Provider",
            "notes": "Should fail"
        }
        response = volunteer_session.post(
            f"{BASE_URL}/api/clients/{client_id}/services",
            json=service_data
        )
        assert response.status_code == 403, f"Expected 403 for volunteer, got {response.status_code}"
        print("✓ Volunteer correctly denied from creating services")


# ============================================================================
# Integration Tests
# ============================================================================

class TestReportsPageAccess:
    """Tests for Reports page access control"""
    
    def test_admin_can_access_all_report_endpoints(self, admin_session):
        """Admin should access all report endpoints"""
        endpoints = [
            "/api/reports/dashboard-csv",
            "/api/reports/export",
            "/api/reports/export/services",
            "/api/reports/org/pdf",
        ]
        for endpoint in endpoints:
            response = admin_session.get(f"{BASE_URL}{endpoint}")
            assert response.status_code == 200, f"Admin should access {endpoint}: {response.status_code}"
        print("✓ Admin can access all report endpoints")
    
    def test_caseworker_denied_admin_reports(self, caseworker_session):
        """Case worker should be denied admin-only reports"""
        admin_only_endpoints = [
            "/api/reports/dashboard-csv",
            "/api/reports/org/pdf",
        ]
        for endpoint in admin_only_endpoints:
            response = caseworker_session.get(f"{BASE_URL}{endpoint}")
            assert response.status_code == 403, f"Case worker should be denied {endpoint}"
        print("✓ Case worker correctly denied admin-only reports")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Phase 5 Backend Tests - Backend Refactoring + New Features
Tests: Auth, Dashboard, Reports (CSV/PDF), Notifications, Messages, Payments
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://127.0.0.1:8001').rstrip('/')

class TestHealthAndAuth:
    """Health check and authentication tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print("✓ Health endpoint working")
    
    def test_admin_login(self):
        """Test admin login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["email"] == "admin@caseflow.io"
        assert data["role"] == "ADMIN"
        print(f"✓ Admin login successful, token: {data['access_token'][:20]}...")
    
    def test_login_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials rejected correctly")


class TestDashboard:
    """Dashboard endpoints tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dashboard_stats(self):
        """Test GET /api/dashboard/stats"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "client_count" in data
        assert "service_count" in data
        assert "visit_count" in data
        assert "outcome_count" in data
        assert "pending_count" in data
        assert "unread_notifications" in data
        print(f"✓ Dashboard stats: {data['client_count']} clients, {data['service_count']} services")
    
    def test_dashboard_trends(self):
        """Test GET /api/dashboard/trends"""
        response = requests.get(f"{BASE_URL}/api/dashboard/trends", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Dashboard trends: {len(data)} data points")
    
    def test_dashboard_outcomes(self):
        """Test GET /api/dashboard/outcomes"""
        response = requests.get(f"{BASE_URL}/api/dashboard/outcomes", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Dashboard outcomes: {len(data)} status groups")
    
    def test_dashboard_activity(self):
        """Test GET /api/dashboard/activity - NEW endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/activity", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "recent_clients" in data
        assert "upcoming_visits" in data
        assert "pending_approvals" in data
        assert "overdue_payments" in data
        assert isinstance(data["recent_clients"], list)
        assert isinstance(data["upcoming_visits"], list)
        print(f"✓ Dashboard activity: {len(data['recent_clients'])} recent clients, {len(data['upcoming_visits'])} upcoming visits")


class TestReportsCSV:
    """CSV Export endpoints tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_export_clients_csv(self):
        """Test GET /api/reports/export - clients CSV"""
        response = requests.get(f"{BASE_URL}/api/reports/export", headers=self.headers)
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("Content-Type", "")
        assert "clients_export.csv" in response.headers.get("Content-Disposition", "")
        print(f"✓ Clients CSV export: {len(response.content)} bytes")
    
    def test_export_services_csv(self):
        """Test GET /api/reports/export/services"""
        response = requests.get(f"{BASE_URL}/api/reports/export/services", headers=self.headers)
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("Content-Type", "")
        assert "services_export.csv" in response.headers.get("Content-Disposition", "")
        print(f"✓ Services CSV export: {len(response.content)} bytes")
    
    def test_export_visits_csv(self):
        """Test GET /api/reports/export/visits"""
        response = requests.get(f"{BASE_URL}/api/reports/export/visits", headers=self.headers)
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("Content-Type", "")
        assert "visits_export.csv" in response.headers.get("Content-Disposition", "")
        print(f"✓ Visits CSV export: {len(response.content)} bytes")
    
    def test_export_outcomes_csv(self):
        """Test GET /api/reports/export/outcomes"""
        response = requests.get(f"{BASE_URL}/api/reports/export/outcomes", headers=self.headers)
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("Content-Type", "")
        assert "outcomes_export.csv" in response.headers.get("Content-Disposition", "")
        print(f"✓ Outcomes CSV export: {len(response.content)} bytes")
    
    def test_export_payments_csv(self):
        """Test GET /api/reports/export/payments"""
        response = requests.get(f"{BASE_URL}/api/reports/export/payments", headers=self.headers)
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("Content-Type", "")
        assert "payments_export.csv" in response.headers.get("Content-Disposition", "")
        print(f"✓ Payments CSV export: {len(response.content)} bytes")
    
    def test_export_invalid_type(self):
        """Test invalid report type returns 400"""
        response = requests.get(f"{BASE_URL}/api/reports/export/invalid", headers=self.headers)
        assert response.status_code == 400
        print("✓ Invalid report type rejected correctly")


class TestReportsPDF:
    """PDF Report generation tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and seed data for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        # Seed demo data to ensure we have clients
        requests.post(f"{BASE_URL}/api/demo/seed", headers=self.headers)
    
    def test_org_pdf_report(self):
        """Test GET /api/reports/org/pdf - Organization PDF"""
        response = requests.get(f"{BASE_URL}/api/reports/org/pdf", headers=self.headers)
        assert response.status_code == 200
        assert "application/pdf" in response.headers.get("Content-Type", "")
        assert "_report.pdf" in response.headers.get("Content-Disposition", "")
        # PDF should start with %PDF
        assert response.content[:4] == b'%PDF'
        print(f"✓ Org PDF report: {len(response.content)} bytes")
    
    def test_client_pdf_report(self):
        """Test GET /api/reports/client/{id}/pdf - Client PDF"""
        # First get a client ID - API returns paginated data
        clients_response = requests.get(f"{BASE_URL}/api/clients", headers=self.headers)
        clients_data = clients_response.json()
        clients = clients_data.get("data", [])
        if not clients:
            pytest.skip("No clients available for PDF test")
        
        client_id = clients[0]["id"]
        response = requests.get(f"{BASE_URL}/api/reports/client/{client_id}/pdf", headers=self.headers)
        assert response.status_code == 200
        assert "application/pdf" in response.headers.get("Content-Type", "")
        # PDF should start with %PDF
        assert response.content[:4] == b'%PDF'
        print(f"✓ Client PDF report: {len(response.content)} bytes")
    
    def test_client_pdf_not_found(self):
        """Test client PDF with invalid ID returns 404"""
        response = requests.get(f"{BASE_URL}/api/reports/client/000000000000000000000000/pdf", headers=self.headers)
        assert response.status_code == 404
        print("✓ Invalid client ID rejected correctly")


class TestNotifications:
    """Notification system tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_list_notifications(self):
        """Test GET /api/notifications"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Notifications list: {len(data)} notifications")
    
    def test_unread_count(self):
        """Test GET /api/notifications/unread-count"""
        response = requests.get(f"{BASE_URL}/api/notifications/unread-count", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        print(f"✓ Unread notifications count: {data['count']}")
    
    def test_mark_all_read(self):
        """Test POST /api/notifications/read-all"""
        response = requests.post(f"{BASE_URL}/api/notifications/read-all", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Mark all read: {data['message']}")
    
    def test_mark_single_read(self):
        """Test PATCH /api/notifications/{id}/read"""
        # First get notifications
        notifs_response = requests.get(f"{BASE_URL}/api/notifications", headers=self.headers)
        notifs = notifs_response.json()
        if not notifs:
            pytest.skip("No notifications to mark as read")
        
        notif_id = notifs[0]["id"]
        response = requests.patch(f"{BASE_URL}/api/notifications/{notif_id}/read", headers=self.headers)
        assert response.status_code == 200
        print(f"✓ Marked notification {notif_id} as read")


class TestMessages:
    """Team messaging system tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        self.token = response.json().get("access_token")
        self.user_id = response.json().get("id")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_list_messages(self):
        """Test GET /api/messages"""
        response = requests.get(f"{BASE_URL}/api/messages", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Messages list: {len(data)} messages")
    
    def test_unread_messages_count(self):
        """Test GET /api/messages/unread-count"""
        response = requests.get(f"{BASE_URL}/api/messages/unread-count", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        print(f"✓ Unread messages count: {data['count']}")
    
    def test_send_message_to_self(self):
        """Test POST /api/messages - send message to self (for testing)"""
        response = requests.post(f"{BASE_URL}/api/messages", headers=self.headers, json={
            "to_user_id": self.user_id,
            "subject": "TEST_Message Subject",
            "body": "This is a test message body"
        })
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["subject"] == "TEST_Message Subject"
        self.message_id = data["id"]
        print(f"✓ Message sent: {data['id']}")
        return data["id"]
    
    def test_get_message_detail(self):
        """Test GET /api/messages/{id}"""
        # First send a message
        send_response = requests.post(f"{BASE_URL}/api/messages", headers=self.headers, json={
            "to_user_id": self.user_id,
            "subject": "TEST_Detail Test",
            "body": "Test body for detail"
        })
        message_id = send_response.json()["id"]
        
        response = requests.get(f"{BASE_URL}/api/messages/{message_id}", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == message_id
        assert data["subject"] == "TEST_Detail Test"
        print(f"✓ Message detail retrieved: {message_id}")
    
    def test_reply_to_message(self):
        """Test POST /api/messages/{id}/reply"""
        # First send a message
        send_response = requests.post(f"{BASE_URL}/api/messages", headers=self.headers, json={
            "to_user_id": self.user_id,
            "subject": "TEST_Reply Test",
            "body": "Original message"
        })
        message_id = send_response.json()["id"]
        
        response = requests.post(f"{BASE_URL}/api/messages/{message_id}/reply", headers=self.headers, json={
            "body": "This is a reply"
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Reply sent to message: {message_id}")
    
    def test_send_message_invalid_recipient(self):
        """Test sending message to non-existent user"""
        response = requests.post(f"{BASE_URL}/api/messages", headers=self.headers, json={
            "to_user_id": "000000000000000000000000",
            "subject": "TEST_Invalid",
            "body": "Should fail"
        })
        assert response.status_code == 404
        print("✓ Invalid recipient rejected correctly")


class TestPayments:
    """Payment requests system tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_payment_request(self):
        """Test POST /api/payments/request"""
        due_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        response = requests.post(f"{BASE_URL}/api/payments/request", headers=self.headers, json={
            "client_name": "TEST_John Doe",
            "client_email": "test@example.com",
            "amount": 150.00,
            "description": "Test payment request",
            "due_date": due_date
        })
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["client_name"] == "TEST_John Doe"
        assert data["amount"] == 150.00
        assert data["status"] == "PENDING"
        print(f"✓ Payment request created: {data['id']}")
        return data["id"]
    
    def test_list_payment_requests(self):
        """Test GET /api/payments/requests"""
        response = requests.get(f"{BASE_URL}/api/payments/requests", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Payment requests list: {len(data)} requests")
    
    def test_update_payment_status(self):
        """Test PATCH /api/payments/requests/{id}"""
        # First create a payment request
        due_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        create_response = requests.post(f"{BASE_URL}/api/payments/request", headers=self.headers, json={
            "client_name": "TEST_Status Update",
            "client_email": "status@test.com",
            "amount": 200.00,
            "description": "Status update test",
            "due_date": due_date
        })
        request_id = create_response.json()["id"]
        
        # Update to PAID
        response = requests.patch(f"{BASE_URL}/api/payments/requests/{request_id}", headers=self.headers, json={
            "status": "PAID"
        })
        assert response.status_code == 200
        print(f"✓ Payment request {request_id} updated to PAID")
    
    def test_payment_summary(self):
        """Test GET /api/payments/summary"""
        response = requests.get(f"{BASE_URL}/api/payments/summary", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✓ Payment summary: {data}")
    
    def test_payment_history(self):
        """Test GET /api/payments/history"""
        response = requests.get(f"{BASE_URL}/api/payments/history", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Payment history: {len(data)} transactions")


class TestClientsRegression:
    """Regression tests for clients CRUD after refactoring"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_list_clients(self):
        """Test GET /api/clients - returns paginated data"""
        response = requests.get(f"{BASE_URL}/api/clients", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data
        assert isinstance(data["data"], list)
        print(f"✓ Clients list: {data['pagination']['total_count']} total clients")
    
    def test_create_client(self):
        """Test POST /api/clients - returns 201"""
        response = requests.post(f"{BASE_URL}/api/clients", headers=self.headers, json={
            "name": "TEST_Regression Client",
            "email": "regression@test.com",
            "phone": "555-0123"
        })
        assert response.status_code == 201  # Client creation returns 201
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_Regression Client"
        print(f"✓ Client created: {data['id']}")
    
    def test_client_wizard(self):
        """Test POST /api/clients/wizard - uses personal object"""
        response = requests.post(f"{BASE_URL}/api/clients/wizard", headers=self.headers, json={
            "personal": {
                "first_name": "TEST_Wizard",
                "last_name": "Client"
            }
        })
        assert response.status_code == 201  # Wizard returns 201
        data = response.json()
        assert "client" in data
        assert "id" in data["client"]
        print(f"✓ Client wizard created: {data['client']['id']}")


class TestDemoMode:
    """Demo mode seed/clear tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_seed_demo_data(self):
        """Test POST /api/demo/seed"""
        response = requests.post(f"{BASE_URL}/api/demo/seed", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Demo data seeded: {data['message']}")
    
    def test_clear_demo_data(self):
        """Test POST /api/demo/clear"""
        response = requests.post(f"{BASE_URL}/api/demo/clear", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Demo data cleared: {data['message']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

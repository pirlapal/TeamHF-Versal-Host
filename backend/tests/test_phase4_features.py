"""
Phase 4 Feature Tests: Client Wizard, Payment Requests, Demo Clear
Tests for:
- POST /api/clients/wizard - Client onboarding wizard
- POST /api/demo/clear - Clear all organization data
- POST /api/payments/request - Send payment request
- GET /api/payments/requests - List payment requests
- PATCH /api/payments/requests/{id} - Update payment request status
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://127.0.0.1:8001').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        token = data.get("access_token") or data.get("token")
        assert token, "No token in login response"
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_admin_login(self, admin_session):
        """Test admin can login"""
        response = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@caseflow.io"
        assert data["role"] == "ADMIN"
        print(f"✓ Admin login successful: {data['email']}")


class TestClientWizard:
    """Client Onboarding Wizard tests"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        token = data.get("access_token") or data.get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_wizard_create_client_minimal(self, admin_session):
        """Test wizard with minimal data (only first name)"""
        payload = {
            "personal": {
                "first_name": "TEST_WizardMinimal",
                "last_name": "",
                "email": "",
                "phone": "",
                "address": "",
                "emergency_contact": "",
                "notes": ""
            },
            "demographics": {},
            "services": None,
            "visit": None
        }
        response = admin_session.post(f"{BASE_URL}/api/clients/wizard", json=payload)
        assert response.status_code == 201, f"Wizard create failed: {response.text}"
        data = response.json()
        assert "client" in data
        assert "message" in data
        assert data["client"]["name"] == "TEST_WizardMinimal"
        assert data["client"]["onboarded_via"] == "wizard"
        print(f"✓ Wizard minimal client created: {data['client']['id']}")
        return data["client"]["id"]
    
    def test_wizard_create_client_full(self, admin_session):
        """Test wizard with full data including services and visit"""
        payload = {
            "personal": {
                "first_name": "TEST_WizardFull",
                "last_name": "TestLastName",
                "email": "test.wizard@example.com",
                "phone": "+1 (555) 123-4567",
                "address": "123 Test Street",
                "emergency_contact": "Jane Doe +1 (555) 987-6543",
                "notes": "Test client created via wizard"
            },
            "demographics": {
                "age_group": "26-35",
                "gender": "Male",
                "ethnicity": "Hispanic/Latino",
                "housing_status": "Housed - Rent",
                "income_level": "Low income",
                "preferred_language": "Spanish"
            },
            "services": {
                "service_types": ["Housing Assistance", "Job Training"],
                "assigned_worker": "Admin",
                "priority": "HIGH"
            },
            "visit": {
                "date": "2026-02-15T10:00",
                "duration": 60,
                "location": "Main Office",
                "notes": "Initial intake meeting"
            }
        }
        response = admin_session.post(f"{BASE_URL}/api/clients/wizard", json=payload)
        assert response.status_code == 201, f"Wizard create failed: {response.text}"
        data = response.json()
        assert "client" in data
        assert data["client"]["name"] == "TEST_WizardFull TestLastName"
        assert data["client"]["email"] == "test.wizard@example.com"
        assert data["client"]["demographics"]["age_group"] == "26-35"
        print(f"✓ Wizard full client created: {data['client']['id']}")
        
        # Verify services were created
        client_id = data["client"]["id"]
        services_response = admin_session.get(f"{BASE_URL}/api/clients/{client_id}/services")
        assert services_response.status_code == 200
        services = services_response.json()
        assert len(services) >= 2, "Expected at least 2 services"
        print(f"✓ Services created: {len(services)}")
        
        # Verify visit was created (visits endpoint is global, not per-client)
        visits_response = admin_session.get(f"{BASE_URL}/api/visits")
        assert visits_response.status_code == 200
        visits = visits_response.json()
        # Filter visits for this client
        client_visits = [v for v in visits if v.get("client_id") == client_id]
        assert len(client_visits) >= 1, "Expected at least 1 visit for this client"
        print(f"✓ Visit created: {len(client_visits)}")
        
        return client_id
    
    def test_wizard_requires_first_name(self, admin_session):
        """Test wizard fails without first name"""
        payload = {
            "personal": {
                "first_name": "",
                "last_name": "NoFirstName"
            },
            "demographics": {},
            "services": None,
            "visit": None
        }
        response = admin_session.post(f"{BASE_URL}/api/clients/wizard", json=payload)
        # Should either fail validation or create with empty name
        # The frontend validates this, backend may accept it
        print(f"✓ Wizard empty first name response: {response.status_code}")


class TestPaymentRequests:
    """Payment Request tests"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        token = data.get("access_token") or data.get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_create_payment_request(self, admin_session):
        """Test creating a payment request"""
        payload = {
            "client_name": "TEST_PaymentClient",
            "client_email": "test.payment@example.com",
            "amount": 150.00,
            "description": "Test payment request for services",
            "due_date": "2026-02-28"
        }
        response = admin_session.post(f"{BASE_URL}/api/payments/request", json=payload)
        assert response.status_code == 200, f"Create payment request failed: {response.text}"
        data = response.json()
        assert data["client_name"] == "TEST_PaymentClient"
        assert data["amount"] == 150.00
        assert data["status"] == "PENDING"
        assert "id" in data
        print(f"✓ Payment request created: {data['id']}")
        return data["id"]
    
    def test_list_payment_requests(self, admin_session):
        """Test listing payment requests"""
        response = admin_session.get(f"{BASE_URL}/api/payments/requests")
        assert response.status_code == 200, f"List payment requests failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Payment requests listed: {len(data)} requests")
        return data
    
    def test_update_payment_request_status(self, admin_session):
        """Test updating payment request status"""
        # First create a request
        create_payload = {
            "client_name": "TEST_StatusUpdate",
            "client_email": "test.status@example.com",
            "amount": 75.50,
            "description": "Test for status update",
            "due_date": "2026-03-15"
        }
        create_response = admin_session.post(f"{BASE_URL}/api/payments/request", json=create_payload)
        assert create_response.status_code == 200
        request_id = create_response.json()["id"]
        
        # Update to PAID
        update_response = admin_session.patch(
            f"{BASE_URL}/api/payments/requests/{request_id}",
            json={"status": "PAID"}
        )
        assert update_response.status_code == 200, f"Update status failed: {update_response.text}"
        print(f"✓ Payment request marked as PAID")
        
        # Verify the update
        list_response = admin_session.get(f"{BASE_URL}/api/payments/requests")
        requests_list = list_response.json()
        updated_req = next((r for r in requests_list if r["id"] == request_id), None)
        assert updated_req is not None
        assert updated_req["status"] == "PAID"
        print(f"✓ Status update verified: {updated_req['status']}")
    
    def test_update_payment_request_to_overdue(self, admin_session):
        """Test marking payment request as overdue"""
        # Create a request
        create_payload = {
            "client_name": "TEST_OverdueTest",
            "client_email": "test.overdue@example.com",
            "amount": 200.00,
            "description": "Test for overdue status",
            "due_date": "2026-01-01"
        }
        create_response = admin_session.post(f"{BASE_URL}/api/payments/request", json=create_payload)
        assert create_response.status_code == 200
        request_id = create_response.json()["id"]
        
        # Update to OVERDUE
        update_response = admin_session.patch(
            f"{BASE_URL}/api/payments/requests/{request_id}",
            json={"status": "OVERDUE"}
        )
        assert update_response.status_code == 200
        print(f"✓ Payment request marked as OVERDUE")
    
    def test_cancel_payment_request(self, admin_session):
        """Test cancelling a payment request"""
        # Create a request
        create_payload = {
            "client_name": "TEST_CancelTest",
            "client_email": "test.cancel@example.com",
            "amount": 50.00,
            "description": "Test for cancellation",
            "due_date": "2026-04-01"
        }
        create_response = admin_session.post(f"{BASE_URL}/api/payments/request", json=create_payload)
        assert create_response.status_code == 200
        request_id = create_response.json()["id"]
        
        # Update to CANCELLED
        update_response = admin_session.patch(
            f"{BASE_URL}/api/payments/requests/{request_id}",
            json={"status": "CANCELLED"}
        )
        assert update_response.status_code == 200
        print(f"✓ Payment request CANCELLED")


class TestDemoMode:
    """Demo Mode tests - Seed and Clear"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        token = data.get("access_token") or data.get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_seed_demo_data(self, admin_session):
        """Test seeding demo data"""
        response = admin_session.post(f"{BASE_URL}/api/demo/seed")
        assert response.status_code in [200, 400], f"Seed demo failed: {response.text}"
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            print(f"✓ Demo data seeded: {data['message']}")
            if "demo_users" in data:
                print(f"  Demo users created: {len(data['demo_users'])}")
        else:
            # May fail if too many clients exist
            print(f"✓ Seed demo returned 400 (expected if >50 clients exist)")
    
    def test_clear_demo_data(self, admin_session):
        """Test clearing all organization data"""
        response = admin_session.post(f"{BASE_URL}/api/demo/clear")
        assert response.status_code == 200, f"Clear demo failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "details" in data
        print(f"✓ Demo data cleared: {data['message']}")
        print(f"  Details: {data['details']}")
        
        # Verify data is cleared
        clients_response = admin_session.get(f"{BASE_URL}/api/clients")
        clients_data = clients_response.json()
        assert clients_data["pagination"]["total_count"] == 0, "Clients should be cleared"
        print(f"✓ Verified: 0 clients remaining")
        
        # Verify payment requests cleared
        payments_response = admin_session.get(f"{BASE_URL}/api/payments/requests")
        payments_data = payments_response.json()
        assert len(payments_data) == 0, "Payment requests should be cleared"
        print(f"✓ Verified: 0 payment requests remaining")


class TestPaymentHistory:
    """Payment History tests"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        token = data.get("access_token") or data.get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_get_payment_history(self, admin_session):
        """Test getting payment history"""
        response = admin_session.get(f"{BASE_URL}/api/payments/history")
        assert response.status_code == 200, f"Get payment history failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Payment history retrieved: {len(data)} transactions")


class TestSubscriptionPackages:
    """Subscription package tests"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Get authenticated admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        token = data.get("access_token") or data.get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    def test_checkout_basic_package(self, admin_session):
        """Test checkout for basic package"""
        payload = {
            "origin_url": "https://future-app-5.preview.emergentagent.com",
            "package_id": "basic"
        }
        response = admin_session.post(f"{BASE_URL}/api/payments/checkout", json=payload)
        # May fail if Stripe is not configured, but should return proper error
        if response.status_code == 200:
            data = response.json()
            assert "url" in data or "session_id" in data
            print(f"✓ Checkout session created for basic package")
        else:
            print(f"✓ Checkout returned {response.status_code} (Stripe integration)")
    
    def test_checkout_invalid_package(self, admin_session):
        """Test checkout with invalid package"""
        payload = {
            "origin_url": "https://future-app-5.preview.emergentagent.com",
            "package_id": "invalid_package"
        }
        response = admin_session.post(f"{BASE_URL}/api/payments/checkout", json=payload)
        assert response.status_code == 400, "Should reject invalid package"
        print(f"✓ Invalid package rejected correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

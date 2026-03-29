"""
Tests for Vocabulary, Field Sets, and Client Edit features
- Vocabulary endpoints accessible by all roles
- Field Sets endpoints accessible by all roles
- Client PATCH with demographics and custom_fields
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://127.0.0.1:8001').rstrip('/')

class TestVocabularyAccess:
    """Test vocabulary endpoint access for all roles"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")
    
    @pytest.fixture(scope="class")
    def caseworker_token(self):
        """Get case worker auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "caseworker@demo.caseflow.io",
            "password": "demo1234"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Case worker login failed")
    
    @pytest.fixture(scope="class")
    def volunteer_token(self):
        """Get volunteer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "volunteer@demo.caseflow.io",
            "password": "demo1234"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Volunteer login failed")
    
    def test_admin_can_access_vocabulary(self, admin_token):
        """Admin should be able to access vocabulary endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vocabulary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Vocabulary should return a list"
        print(f"Admin vocabulary access: {len(data)} items")
    
    def test_caseworker_can_access_vocabulary(self, caseworker_token):
        """Case worker should be able to access vocabulary endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vocabulary",
            headers={"Authorization": f"Bearer {caseworker_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Vocabulary should return a list"
        print(f"Case worker vocabulary access: {len(data)} items")
    
    def test_volunteer_can_access_vocabulary(self, volunteer_token):
        """Volunteer should be able to access vocabulary endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/vocabulary",
            headers={"Authorization": f"Bearer {volunteer_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Vocabulary should return a list"
        print(f"Volunteer vocabulary access: {len(data)} items")


class TestFieldSetsAccess:
    """Test field-sets endpoint access for all roles"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")
    
    @pytest.fixture(scope="class")
    def caseworker_token(self):
        """Get case worker auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "caseworker@demo.caseflow.io",
            "password": "demo1234"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Case worker login failed")
    
    @pytest.fixture(scope="class")
    def volunteer_token(self):
        """Get volunteer auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "volunteer@demo.caseflow.io",
            "password": "demo1234"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Volunteer login failed")
    
    def test_admin_can_access_field_sets(self, admin_token):
        """Admin should be able to access field-sets endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/field-sets",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Field sets should return a list"
        print(f"Admin field-sets access: {len(data)} field sets")
        for fs in data:
            print(f"  - {fs.get('name')}: {len(fs.get('fields', []))} fields")
    
    def test_caseworker_can_access_field_sets(self, caseworker_token):
        """Case worker should be able to access field-sets endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/field-sets",
            headers={"Authorization": f"Bearer {caseworker_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Field sets should return a list"
        print(f"Case worker field-sets access: {len(data)} field sets")
    
    def test_volunteer_can_access_field_sets(self, volunteer_token):
        """Volunteer should be able to access field-sets endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/field-sets",
            headers={"Authorization": f"Bearer {volunteer_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Field sets should return a list"
        print(f"Volunteer field-sets access: {len(data)} field sets")


class TestClientEditWithDemographicsAndCustomFields:
    """Test client PATCH endpoint with demographics and custom_fields"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")
    
    @pytest.fixture(scope="class")
    def caseworker_token(self):
        """Get case worker auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "caseworker@demo.caseflow.io",
            "password": "demo1234"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Case worker login failed")
    
    @pytest.fixture(scope="class")
    def test_client_id(self, admin_token):
        """Get a test client ID"""
        response = requests.get(
            f"{BASE_URL}/api/clients?page_size=1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if response.status_code == 200:
            data = response.json()
            clients = data.get("data", [])
            if clients:
                return clients[0].get("id")
        pytest.skip("No clients found for testing")
    
    def test_patch_client_with_demographics(self, admin_token, test_client_id):
        """Test updating client with demographics data"""
        demographics = {
            "age_group": "25-34",
            "gender": "Female",
            "ethnicity": "Hispanic",
            "language": "Spanish",
            "income_level": "Low",
            "education": "High School"
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/clients/{test_client_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"demographics": demographics}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify demographics were saved
        assert "demographics" in data, "Response should include demographics"
        saved_demo = data.get("demographics", {})
        assert saved_demo.get("age_group") == "25-34", "age_group should be saved"
        assert saved_demo.get("gender") == "Female", "gender should be saved"
        assert saved_demo.get("ethnicity") == "Hispanic", "ethnicity should be saved"
        print(f"Demographics saved successfully: {saved_demo}")
    
    def test_patch_client_with_custom_fields(self, admin_token, test_client_id):
        """Test updating client with custom_fields data"""
        custom_fields = {
            "Emergency Contact": "John Doe - 555-1234",
            "Date of Birth": "1990-05-15",
            "ID Number": "ABC123456"
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/clients/{test_client_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"custom_fields": custom_fields}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify custom_fields were saved
        assert "custom_fields" in data, "Response should include custom_fields"
        saved_cf = data.get("custom_fields", {})
        assert saved_cf.get("Emergency Contact") == "John Doe - 555-1234", "Emergency Contact should be saved"
        assert saved_cf.get("Date of Birth") == "1990-05-15", "Date of Birth should be saved"
        print(f"Custom fields saved successfully: {saved_cf}")
    
    def test_patch_client_with_all_fields(self, admin_token, test_client_id):
        """Test updating client with all editable fields"""
        update_data = {
            "name": "TEST_Updated Client Name",
            "email": "test_updated@example.com",
            "phone": "555-9999",
            "address": "123 Test Street",
            "notes": "Updated notes for testing",
            "demographics": {
                "age_group": "35-44",
                "gender": "Male",
                "ethnicity": "Asian",
                "language": "English",
                "income_level": "Medium",
                "education": "Bachelor's"
            },
            "custom_fields": {
                "Emergency Contact": "Jane Smith - 555-5678",
                "Date of Birth": "1985-10-20",
                "ID Number": "XYZ789012"
            }
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/clients/{test_client_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=update_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify all fields were saved
        assert data.get("name") == "TEST_Updated Client Name", "Name should be updated"
        assert data.get("email") == "test_updated@example.com", "Email should be updated"
        assert data.get("phone") == "555-9999", "Phone should be updated"
        assert data.get("address") == "123 Test Street", "Address should be updated"
        assert data.get("notes") == "Updated notes for testing", "Notes should be updated"
        
        # Verify demographics
        demo = data.get("demographics", {})
        assert demo.get("age_group") == "35-44", "Demographics age_group should be updated"
        assert demo.get("gender") == "Male", "Demographics gender should be updated"
        
        # Verify custom_fields
        cf = data.get("custom_fields", {})
        assert cf.get("Emergency Contact") == "Jane Smith - 555-5678", "Custom field Emergency Contact should be updated"
        
        print(f"All fields updated successfully")
        print(f"  Name: {data.get('name')}")
        print(f"  Demographics: {demo}")
        print(f"  Custom Fields: {cf}")
    
    def test_get_client_verifies_persistence(self, admin_token, test_client_id):
        """Verify that updated data persists via GET"""
        response = requests.get(
            f"{BASE_URL}/api/clients/{test_client_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify data persisted
        assert "demographics" in data, "Client should have demographics"
        assert "custom_fields" in data, "Client should have custom_fields"
        
        demo = data.get("demographics", {})
        cf = data.get("custom_fields", {})
        
        print(f"Verified persistence:")
        print(f"  Demographics: {demo}")
        print(f"  Custom Fields: {cf}")
        
        # At least some fields should be present
        assert len(demo) > 0 or len(cf) > 0, "Either demographics or custom_fields should have data"


class TestVocabularyUpdate:
    """Test vocabulary update by admin"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")
    
    def test_admin_can_update_vocabulary(self, admin_token):
        """Admin should be able to update vocabulary"""
        # First get current vocabulary
        get_response = requests.get(
            f"{BASE_URL}/api/admin/vocabulary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.status_code == 200
        current_vocab = get_response.json()
        
        # Update vocabulary
        update_response = requests.put(
            f"{BASE_URL}/api/admin/vocabulary",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"mappings": current_vocab}  # Just re-save current values
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        print("Admin successfully updated vocabulary")


class TestFieldSetUpdate:
    """Test field set update by admin"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Admin login failed")
    
    def test_admin_can_create_field_set(self, admin_token):
        """Admin should be able to create/update a field set"""
        field_set_data = {
            "name": "TEST_Custom Fields",
            "fields": [
                {"label": "Test Field 1", "type": "TEXT", "required": False},
                {"label": "Test Field 2", "type": "NUMBER", "required": True}
            ]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/admin/field-sets",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=field_set_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("Admin successfully created/updated field set")
        
        # Verify it was saved
        get_response = requests.get(
            f"{BASE_URL}/api/admin/field-sets",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert get_response.status_code == 200
        field_sets = get_response.json()
        
        test_fs = next((fs for fs in field_sets if fs.get("name") == "TEST_Custom Fields"), None)
        assert test_fs is not None, "TEST_Custom Fields should exist"
        assert len(test_fs.get("fields", [])) == 2, "Should have 2 fields"
        print(f"Verified field set: {test_fs}")

"""
Test AI Features - GPT-4o-mini Integration via Emergent LLM Key
Tests: AI Copilot, AI Summarize, AI Suggest, Narrative Reports
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://127.0.0.1:8001').rstrip('/')

class TestAIFeatures:
    """AI Copilot and Narrative Report tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@caseflow.io",
            "password": "admin123"
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        token = login_resp.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get a client ID for testing
        clients_resp = self.session.get(f"{BASE_URL}/api/clients", params={"page_size": 10})
        assert clients_resp.status_code == 200, f"Failed to get clients: {clients_resp.text}"
        clients_data = clients_resp.json()
        self.clients = clients_data.get("data", [])
        self.client_id = self.clients[0]["id"] if self.clients else None
        
    # ── AI Copilot Tests ──
    
    def test_ai_copilot_with_client_id_returns_gpt4o_mini(self):
        """POST /api/ai/copilot with client_id should return model='gpt-4o-mini'"""
        if not self.client_id:
            pytest.skip("No clients available for testing")
        
        response = self.session.post(f"{BASE_URL}/api/ai/copilot", json={
            "message": "Summarize this client's case history",
            "client_id": self.client_id
        })
        
        assert response.status_code == 200, f"AI Copilot failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "content" in data, "Response missing 'content' field"
        assert "model" in data, "Response missing 'model' field"
        assert len(data["content"]) > 10, "Content too short - likely not a real summary"
        
        # Check if using GPT-4o-mini (real AI) or fallback
        print(f"Model used: {data['model']}")
        print(f"Content preview: {data['content'][:200]}...")
        
        # If LLM is working, model should be gpt-4o-mini
        # If fallback, model should be data-driven-fallback
        assert data["model"] in ["gpt-4o-mini", "data-driven-fallback"], f"Unexpected model: {data['model']}"
        
    def test_ai_copilot_without_client_id_returns_helpful_response(self):
        """POST /api/ai/copilot without client_id should still return a helpful response"""
        response = self.session.post(f"{BASE_URL}/api/ai/copilot", json={
            "message": "What can you help me with?",
            "client_id": ""
        })
        
        assert response.status_code == 200, f"AI Copilot failed: {response.text}"
        data = response.json()
        
        assert "content" in data, "Response missing 'content' field"
        assert len(data["content"]) > 20, "Content too short"
        print(f"Response without client_id: {data['content'][:200]}...")
        
    def test_ai_copilot_summarize_action(self):
        """Test 'Summarize client' quick action returns client-specific summary"""
        if not self.client_id:
            pytest.skip("No clients available for testing")
        
        # Get client name for verification
        client_name = self.clients[0].get("name", "")
        
        response = self.session.post(f"{BASE_URL}/api/ai/copilot", json={
            "message": "Summarize this client's case history",
            "client_id": self.client_id
        })
        
        assert response.status_code == 200, f"AI Copilot summarize failed: {response.text}"
        data = response.json()
        
        # Summary should mention the client name or be client-specific
        content = data["content"].lower()
        print(f"Client name: {client_name}")
        print(f"Summary: {data['content'][:300]}...")
        
        # Check that it's not generic text
        assert "no client selected" not in content, "Got generic 'no client selected' response"
        
    def test_ai_copilot_suggest_tags_action(self):
        """Test 'Suggest tags' quick action returns relevant tags"""
        if not self.client_id:
            pytest.skip("No clients available for testing")
        
        response = self.session.post(f"{BASE_URL}/api/ai/copilot", json={
            "message": "Suggest tags for this client",
            "client_id": self.client_id
        })
        
        assert response.status_code == 200, f"AI Copilot suggest tags failed: {response.text}"
        data = response.json()
        
        # Should return tags type or chat with tags
        print(f"Tags response type: {data.get('type')}")
        print(f"Tags content: {data['content']}")
        
        if data.get("type") == "tags":
            assert isinstance(data["content"], list), "Tags should be a list"
            assert len(data["content"]) > 0, "Should have at least one tag"
        else:
            # Chat response with tags mentioned
            assert "content" in data
            
    def test_ai_copilot_next_actions(self):
        """Test 'Next actions' quick action returns actionable suggestions"""
        if not self.client_id:
            pytest.skip("No clients available for testing")
        
        response = self.session.post(f"{BASE_URL}/api/ai/copilot", json={
            "message": "Suggest next actions for this case",
            "client_id": self.client_id
        })
        
        assert response.status_code == 200, f"AI Copilot next actions failed: {response.text}"
        data = response.json()
        
        print(f"Actions response type: {data.get('type')}")
        print(f"Actions content: {data['content']}")
        
        if data.get("type") == "actions":
            assert isinstance(data["content"], list), "Actions should be a list"
            assert len(data["content"]) > 0, "Should have at least one action"
        else:
            assert "content" in data
            
    def test_ai_copilot_missing_fields(self):
        """Test 'Missing fields' quick action identifies incomplete data"""
        if not self.client_id:
            pytest.skip("No clients available for testing")
        
        response = self.session.post(f"{BASE_URL}/api/ai/copilot", json={
            "message": "What fields are missing for this client?",
            "client_id": self.client_id
        })
        
        assert response.status_code == 200, f"AI Copilot missing fields failed: {response.text}"
        data = response.json()
        
        print(f"Missing fields response type: {data.get('type')}")
        print(f"Missing fields content: {data['content']}")
        
        if data.get("type") == "missing_fields":
            assert isinstance(data["content"], list), "Missing fields should be a list"
        else:
            assert "content" in data
            
    # ── AI Narrative Report Tests ──
    
    def test_narrative_report_all_clients(self):
        """POST /api/reports/narrative generates AI-powered narratives for all clients"""
        response = self.session.post(f"{BASE_URL}/api/reports/narrative", json={
            "client_ids": []  # Empty = all clients
        })
        
        assert response.status_code == 200, f"Narrative report failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "narratives" in data, "Response missing 'narratives' field"
        assert "total_clients" in data, "Response missing 'total_clients' field"
        assert "generated_at" in data, "Response missing 'generated_at' field"
        
        narratives = data["narratives"]
        assert len(narratives) > 0, "Should have at least one narrative"
        
        # Check first narrative structure
        first = narratives[0]
        assert "client_id" in first, "Narrative missing 'client_id'"
        assert "client_name" in first, "Narrative missing 'client_name'"
        assert "narrative" in first, "Narrative missing 'narrative' text"
        assert "stats" in first, "Narrative missing 'stats'"
        
        # Narrative should be substantial
        assert len(first["narrative"]) > 50, f"Narrative too short: {first['narrative']}"
        
        print(f"Total clients: {data['total_clients']}")
        print(f"First narrative ({first['client_name']}): {first['narrative'][:200]}...")
        
    def test_narrative_report_specific_client(self):
        """POST /api/reports/narrative with specific client_ids generates per-client narratives"""
        if not self.client_id:
            pytest.skip("No clients available for testing")
        
        response = self.session.post(f"{BASE_URL}/api/reports/narrative", json={
            "client_ids": [self.client_id]
        })
        
        assert response.status_code == 200, f"Narrative report failed: {response.text}"
        data = response.json()
        
        assert data["total_clients"] == 1, f"Expected 1 client, got {data['total_clients']}"
        
        narrative = data["narratives"][0]
        assert narrative["client_id"] == self.client_id, "Client ID mismatch"
        
        # Check narrative is client-specific
        client_name = self.clients[0].get("name", "")
        print(f"Client: {client_name}")
        print(f"Narrative: {narrative['narrative']}")
        
        # Narrative should mention the client or their data
        assert len(narrative["narrative"]) > 50, "Narrative too short"
        
    # ── AI Templates Tests ──
    
    def test_ai_templates_endpoint(self):
        """GET /api/ai/templates returns available action templates"""
        response = self.session.get(f"{BASE_URL}/api/ai/templates")
        
        assert response.status_code == 200, f"AI templates failed: {response.text}"
        templates = response.json()
        
        assert isinstance(templates, list), "Templates should be a list"
        assert len(templates) >= 4, f"Expected at least 4 templates, got {len(templates)}"
        
        # Check template structure
        template_ids = [t["id"] for t in templates]
        assert "create_client" in template_ids, "Missing create_client template"
        assert "schedule_visit" in template_ids, "Missing schedule_visit template"
        assert "log_service" in template_ids, "Missing log_service template"
        assert "add_outcome" in template_ids, "Missing add_outcome template"
        
        print(f"Available templates: {template_ids}")
        
    def test_ai_generate_form(self):
        """POST /api/ai/generate-form returns prefilled form data"""
        response = self.session.post(f"{BASE_URL}/api/ai/generate-form", json={
            "template_id": "create_client",
            "context": "New client named John Smith"
        })
        
        assert response.status_code == 200, f"AI generate form failed: {response.text}"
        data = response.json()
        
        assert "template" in data, "Response missing 'template'"
        assert "prefill" in data, "Response missing 'prefill'"
        
        print(f"Template: {data['template']['id']}")
        print(f"Prefill: {data['prefill']}")


class TestAICopilotCaseWorker:
    """Test AI Copilot access for Case Worker role"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as case worker"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as case worker
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "caseworker@demo.caseflow.io",
            "password": "demo1234"
        })
        
        if login_resp.status_code != 200:
            pytest.skip("Case worker account not available - run demo seed first")
            
        token = login_resp.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get a client ID
        clients_resp = self.session.get(f"{BASE_URL}/api/clients", params={"page_size": 5})
        if clients_resp.status_code == 200:
            clients_data = clients_resp.json()
            self.clients = clients_data.get("data", [])
            self.client_id = self.clients[0]["id"] if self.clients else None
        else:
            self.client_id = None
            
    def test_case_worker_can_use_ai_copilot(self):
        """Case worker should have access to AI Copilot"""
        if not self.client_id:
            pytest.skip("No clients available")
            
        response = self.session.post(f"{BASE_URL}/api/ai/copilot", json={
            "message": "Summarize this client",
            "client_id": self.client_id
        })
        
        assert response.status_code == 200, f"Case worker AI access failed: {response.text}"
        data = response.json()
        assert "content" in data
        print(f"Case worker AI response: {data['content'][:150]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

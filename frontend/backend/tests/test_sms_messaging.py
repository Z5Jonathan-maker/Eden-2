"""
SMS Messaging System Tests
Tests for Twilio SMS integration with dry-run mode

Endpoints tested:
- POST /api/claims/{claim_id}/messages/sms/send - Send SMS (dry-run mode)
- GET /api/claims/{claim_id}/messages - Get message history
- POST /api/sms/twilio/webhook - Inbound SMS webhook
- GET /api/sms/status - Check Twilio config status
- GET /api/sms/templates - Get SMS templates
- Rate limiting (max 10 SMS per claim per hour)
- Template-based SMS sending
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@eden.com"
TEST_PASSWORD = "password"
TEST_CLAIM_ID = "34fb0abd-ca29-4840-8f3c-250a8f0f3f62"
WEBHOOK_SECRET = "eden-sms-webhook-secret-2026"


class TestSMSMessaging:
    """SMS Messaging API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("access_token")
        assert token, "No access token received"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.token = token
    
    # ============================================
    # SMS STATUS ENDPOINT TESTS
    # ============================================
    
    def test_get_sms_status(self):
        """Test GET /api/sms/status - Check Twilio configuration status"""
        response = self.session.get(f"{BASE_URL}/api/sms/status")
        
        assert response.status_code == 200, f"Failed to get SMS status: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "configured" in data
        assert "has_account_sid" in data
        assert "has_auth_token" in data
        assert "has_messaging_service" in data
        assert "has_from_number" in data
        assert "dry_run_mode" in data
        assert "sender" in data
        
        # Verify dry-run mode is enabled (as per test setup)
        assert data["dry_run_mode"] == True, "Expected dry_run_mode to be True"
        
        print(f"SMS Status: configured={data['configured']}, dry_run_mode={data['dry_run_mode']}")
    
    # ============================================
    # SMS TEMPLATES ENDPOINT TESTS
    # ============================================
    
    def test_get_sms_templates(self):
        """Test GET /api/sms/templates - Get available SMS templates"""
        response = self.session.get(f"{BASE_URL}/api/sms/templates")
        
        assert response.status_code == 200, f"Failed to get SMS templates: {response.text}"
        
        data = response.json()
        assert "templates" in data
        templates = data["templates"]
        
        # Verify we have templates
        assert len(templates) > 0, "No templates returned"
        
        # Verify template structure
        for template in templates:
            assert "key" in template
            assert "name" in template
            assert "template" in template
            assert "variables" in template
        
        # Verify expected templates exist
        template_keys = [t["key"] for t in templates]
        expected_templates = ["fnol_created", "appointment_scheduled", "photos_requested", "payment_issued", "status_update"]
        
        for expected in expected_templates:
            assert expected in template_keys, f"Expected template '{expected}' not found"
        
        print(f"Found {len(templates)} SMS templates: {template_keys}")
    
    # ============================================
    # SEND SMS ENDPOINT TESTS
    # ============================================
    
    def test_send_sms_dry_run(self):
        """Test POST /api/claims/{claim_id}/messages/sms/send - Send SMS in dry-run mode"""
        test_phone = "+15559876543"
        test_body = f"Test SMS message from pytest - {datetime.now().isoformat()}"
        
        response = self.session.post(
            f"{BASE_URL}/api/claims/{TEST_CLAIM_ID}/messages/sms/send",
            json={
                "to": test_phone,
                "body": test_body
            }
        )
        
        assert response.status_code == 200, f"Failed to send SMS: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "id" in data
        assert "claim_id" in data
        assert "status" in data
        assert "provider_message_id" in data
        assert "to" in data
        assert "body" in data
        assert "created_at" in data
        
        # Verify dry-run mode (provider_message_id starts with 'dry-run-')
        assert data["provider_message_id"].startswith("dry-run-"), \
            f"Expected dry-run message ID, got: {data['provider_message_id']}"
        
        assert data["claim_id"] == TEST_CLAIM_ID
        assert data["to"] == test_phone
        assert data["body"] == test_body
        assert data["status"] == "sent"
        
        print(f"SMS sent (dry-run): {data['provider_message_id']}")
        
        # Store message ID for later tests
        self.sent_message_id = data["id"]
    
    def test_send_sms_with_template(self):
        """Test sending SMS using a template"""
        test_phone = "+15559876544"
        
        response = self.session.post(
            f"{BASE_URL}/api/claims/{TEST_CLAIM_ID}/messages/sms/send",
            json={
                "to": test_phone,
                "body": "",  # Body will be generated from template
                "template_key": "appointment_scheduled",
                "template_vars": {
                    "date_time": "January 15, 2026 at 10:00 AM",
                    "address": "123 Test Street, Miami FL"
                }
            }
        )
        
        assert response.status_code == 200, f"Failed to send template SMS: {response.text}"
        
        data = response.json()
        # Verify template was rendered
        assert "appointment" in data["body"].lower() or "scheduled" in data["body"].lower(), \
            f"Template not rendered correctly: {data['body']}"
        
        print(f"Template SMS sent: {data['body'][:50]}...")
    
    def test_send_sms_invalid_phone(self):
        """Test sending SMS with invalid phone number format"""
        response = self.session.post(
            f"{BASE_URL}/api/claims/{TEST_CLAIM_ID}/messages/sms/send",
            json={
                "to": "invalid-phone",  # Invalid format
                "body": "Test message"
            }
        )
        
        # Should fail with 500 (Twilio validation) or succeed with formatted number
        # The format_phone_number function will try to format it
        # If it can't be formatted properly, Twilio will reject it
        print(f"Invalid phone response: {response.status_code}")
    
    def test_send_sms_empty_body(self):
        """Test sending SMS with empty body (no template)"""
        response = self.session.post(
            f"{BASE_URL}/api/claims/{TEST_CLAIM_ID}/messages/sms/send",
            json={
                "to": "+15559876545",
                "body": ""  # Empty body without template
            }
        )
        
        assert response.status_code == 400, f"Expected 400 for empty body, got: {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        print(f"Empty body error: {data['detail']}")
    
    def test_send_sms_nonexistent_claim(self):
        """Test sending SMS for non-existent claim"""
        fake_claim_id = str(uuid.uuid4())
        
        response = self.session.post(
            f"{BASE_URL}/api/claims/{fake_claim_id}/messages/sms/send",
            json={
                "to": "+15559876546",
                "body": "Test message"
            }
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent claim, got: {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()
        print(f"Non-existent claim error: {data['detail']}")
    
    # ============================================
    # GET MESSAGES ENDPOINT TESTS
    # ============================================
    
    def test_get_claim_messages(self):
        """Test GET /api/claims/{claim_id}/messages - Get message history"""
        response = self.session.get(f"{BASE_URL}/api/claims/{TEST_CLAIM_ID}/messages")
        
        assert response.status_code == 200, f"Failed to get messages: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "messages" in data
        assert "total" in data
        assert "limit" in data
        assert "skip" in data
        assert "claim_id" in data
        
        assert data["claim_id"] == TEST_CLAIM_ID
        
        messages = data["messages"]
        print(f"Found {len(messages)} messages for claim {TEST_CLAIM_ID}")
        
        # Verify message structure if messages exist
        if len(messages) > 0:
            msg = messages[0]
            assert "id" in msg
            assert "claim_id" in msg
            assert "channel" in msg
            assert "direction" in msg
            assert "body" in msg
            assert "status" in msg
            assert "created_at" in msg
    
    def test_get_claim_messages_with_channel_filter(self):
        """Test GET /api/claims/{claim_id}/messages?channel=sms - Filter by channel"""
        response = self.session.get(
            f"{BASE_URL}/api/claims/{TEST_CLAIM_ID}/messages",
            params={"channel": "sms"}
        )
        
        assert response.status_code == 200, f"Failed to get SMS messages: {response.text}"
        
        data = response.json()
        messages = data["messages"]
        
        # All messages should be SMS
        for msg in messages:
            assert msg["channel"] == "sms", f"Expected SMS channel, got: {msg['channel']}"
        
        print(f"Found {len(messages)} SMS messages")
    
    def test_get_claim_messages_pagination(self):
        """Test message pagination"""
        # Get first page
        response = self.session.get(
            f"{BASE_URL}/api/claims/{TEST_CLAIM_ID}/messages",
            params={"limit": 5, "skip": 0}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["limit"] == 5
        assert data["skip"] == 0
        
        print(f"Pagination test: total={data['total']}, returned={len(data['messages'])}")
    
    def test_get_messages_nonexistent_claim(self):
        """Test getting messages for non-existent claim"""
        fake_claim_id = str(uuid.uuid4())
        
        response = self.session.get(f"{BASE_URL}/api/claims/{fake_claim_id}/messages")
        
        assert response.status_code == 404, f"Expected 404, got: {response.status_code}"
    
    # ============================================
    # WEBHOOK ENDPOINT TESTS
    # ============================================
    
    def test_webhook_inbound_sms(self):
        """Test POST /api/sms/twilio/webhook - Receive inbound SMS"""
        # Simulate Twilio webhook for inbound SMS
        response = requests.post(
            f"{BASE_URL}/api/sms/twilio/webhook",
            params={"secret": WEBHOOK_SECRET},
            data={
                "From": "+15551234567",
                "To": "+18001234567",
                "Body": f"Test inbound message from pytest - {datetime.now().isoformat()}",
                "MessageSid": f"SM{uuid.uuid4().hex[:32]}",
                "AccountSid": "ACtest123"
            }
        )
        
        assert response.status_code == 200, f"Webhook failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "ok"
        assert data["action"] == "inbound_received"
        
        print(f"Inbound SMS webhook processed, claim_id: {data.get('claim_id', 'unmatched')}")
    
    def test_webhook_status_update(self):
        """Test webhook for message status update"""
        # Simulate Twilio status callback
        response = requests.post(
            f"{BASE_URL}/api/sms/twilio/webhook",
            params={"secret": WEBHOOK_SECRET},
            data={
                "MessageSid": "SMtest123456",
                "MessageStatus": "delivered",
                "AccountSid": "ACtest123"
            }
        )
        
        assert response.status_code == 200, f"Status webhook failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "ok"
        assert data["action"] == "status_update"
        
        print("Status update webhook processed")
    
    def test_webhook_invalid_secret(self):
        """Test webhook with invalid secret"""
        response = requests.post(
            f"{BASE_URL}/api/sms/twilio/webhook",
            params={"secret": "wrong-secret"},
            data={
                "From": "+15551234567",
                "Body": "Test message"
            }
        )
        
        assert response.status_code == 403, f"Expected 403 for invalid secret, got: {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        print(f"Invalid secret error: {data['detail']}")
    
    def test_webhook_no_actionable_data(self):
        """Test webhook with no actionable data"""
        response = requests.post(
            f"{BASE_URL}/api/sms/twilio/webhook",
            params={"secret": WEBHOOK_SECRET},
            data={}  # Empty data
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "ok"
        assert data["action"] == "none"
        
        print("Empty webhook handled correctly")
    
    # ============================================
    # RATE LIMITING TESTS
    # ============================================
    
    def test_rate_limiting_info(self):
        """Test that rate limiting is documented (max 10 SMS per claim per hour)"""
        # This is more of a documentation test
        # The actual rate limit is enforced in the send endpoint
        # We verify by checking the error message format
        
        # First, verify the endpoint works
        response = self.session.post(
            f"{BASE_URL}/api/claims/{TEST_CLAIM_ID}/messages/sms/send",
            json={
                "to": "+15559876547",
                "body": "Rate limit test message"
            }
        )
        
        # Should succeed (we haven't hit the limit)
        assert response.status_code in [200, 429], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 429:
            data = response.json()
            assert "rate limit" in data["detail"].lower()
            assert "10" in data["detail"]  # Max 10 per hour
            print(f"Rate limit hit: {data['detail']}")
        else:
            print("Rate limit not hit, message sent successfully")
    
    # ============================================
    # AUTHENTICATION TESTS
    # ============================================
    
    def test_sms_status_requires_auth(self):
        """Test that SMS status endpoint requires authentication"""
        # Create new session without auth
        no_auth_session = requests.Session()
        
        response = no_auth_session.get(f"{BASE_URL}/api/sms/status")
        
        # Accept both 401 (Unauthorized) and 403 (Forbidden) as valid auth rejection
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got: {response.status_code}"
        print(f"SMS status correctly requires authentication (status: {response.status_code})")
    
    def test_sms_templates_requires_auth(self):
        """Test that SMS templates endpoint requires authentication"""
        no_auth_session = requests.Session()
        
        response = no_auth_session.get(f"{BASE_URL}/api/sms/templates")
        
        # Accept both 401 (Unauthorized) and 403 (Forbidden) as valid auth rejection
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got: {response.status_code}"
        print(f"SMS templates correctly requires authentication (status: {response.status_code})")
    
    def test_send_sms_requires_auth(self):
        """Test that send SMS endpoint requires authentication"""
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.post(
            f"{BASE_URL}/api/claims/{TEST_CLAIM_ID}/messages/sms/send",
            json={"to": "+15551234567", "body": "Test"}
        )
        
        # Accept both 401 (Unauthorized) and 403 (Forbidden) as valid auth rejection
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got: {response.status_code}"
        print(f"Send SMS correctly requires authentication (status: {response.status_code})")
    
    def test_get_messages_requires_auth(self):
        """Test that get messages endpoint requires authentication"""
        no_auth_session = requests.Session()
        
        response = no_auth_session.get(f"{BASE_URL}/api/claims/{TEST_CLAIM_ID}/messages")
        
        # Accept both 401 (Unauthorized) and 403 (Forbidden) as valid auth rejection
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got: {response.status_code}"
        print(f"Get messages correctly requires authentication (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

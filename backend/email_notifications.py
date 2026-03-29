import os
import requests
from config import logger

# EmailJS Configuration
EMAILJS_SERVICE_ID = os.getenv("EMAILJS_SERVICE_ID", "service_g0yq4qg")
EMAILJS_TEMPLATE_CLIENT_ONBOARDING = os.getenv("EMAILJS_TEMPLATE_CLIENT_ONBOARDING", "template_wp63bpe")
EMAILJS_TEMPLATE_USER_INVITATION = os.getenv("EMAILJS_TEMPLATE_USER_INVITATION", "template_tmgrado")
EMAILJS_PUBLIC_KEY = os.getenv("EMAILJS_PUBLIC_KEY", "kkB5lP8Fm-9ihoZnF")
EMAILJS_PRIVATE_KEY = os.getenv("EMAILJS_PRIVATE_KEY", "")
EMAILJS_API_URL = "https://api.emailjs.com/api/v1.0/email/send"

# Frontend URL for review links
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost")

async def send_client_onboarding_email(admin_email: str, admin_name: str, client_name: str, created_by: str, client_id: str, is_pending: bool):
    """
    Send email notification via EmailJS when a new client is onboarded.

    Args:
        admin_email: Email address of the admin to notify
        admin_name: Name of the admin receiving the notification
        client_name: Name of the newly created client
        created_by: Name of the user who created the client
        client_id: ID of the newly created client
        is_pending: Whether the client requires admin approval
    """
    try:
        from datetime import datetime, timezone

        # Format the current time
        submitted_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        # Build the review link
        review_link = f"{FRONTEND_URL}/clients/{client_id}"

        payload = {
            "service_id": EMAILJS_SERVICE_ID,
            "template_id": EMAILJS_TEMPLATE_CLIENT_ONBOARDING,
            "user_id": EMAILJS_PUBLIC_KEY,
            "template_params": {
                "admin_name": admin_name,
                "client_name": client_name,
                "case_worker_name": created_by,
                "submitted_time": submitted_time,
                "organization_name": "HackForge",
                "review_link": review_link,
            }
        }

        # Add private key if available (required for strict mode)
        if EMAILJS_PRIVATE_KEY:
            payload["accessToken"] = EMAILJS_PRIVATE_KEY

        logger.info(f"📧 Sending email to {admin_email} for client: {client_name}")

        response = requests.post(
            EMAILJS_API_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )

        if response.status_code == 200:
            logger.info(f"✅ Email sent successfully to {admin_email}")
            return True
        else:
            logger.error(f"❌ Failed to send email to {admin_email}: {response.status_code} - {response.text}")
            return False

    except Exception as e:
        logger.error(f"❌ Error sending email to {admin_email}: {str(e)}")
        return False


async def send_user_invitation_email(invite_email: str, user_name: str, role: str, invite_token: str, expiry_hours: int = 48):
    """
    Send email invitation via EmailJS when an admin invites a new user.

    Args:
        invite_email: Email address of the invited user
        user_name: Name of the invited user
        role: Role assigned to the user (ADMIN, CASE_WORKER, etc.)
        invite_token: Unique invitation token
        expiry_hours: Hours until invitation expires (default: 48)
    """
    try:
        # Build the invitation link
        invite_link = f"{FRONTEND_URL}/accept-invitation?token={invite_token}"

        payload = {
            "service_id": EMAILJS_SERVICE_ID,
            "template_id": EMAILJS_TEMPLATE_USER_INVITATION,
            "user_id": EMAILJS_PUBLIC_KEY,
            "template_params": {
                "name": user_name,
                "role": role,
                "organization_name": "HackForge",
                "invite_link": invite_link,
                "expiry_hours": str(expiry_hours),
            }
        }

        # Add private key if available (required for strict mode)
        if EMAILJS_PRIVATE_KEY:
            payload["accessToken"] = EMAILJS_PRIVATE_KEY

        logger.info(f"📧 Sending invitation email to {invite_email} (role: {role})")

        response = requests.post(
            EMAILJS_API_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )

        if response.status_code == 200:
            logger.info(f"✅ Invitation sent successfully to {invite_email}")
            return True
        else:
            logger.error(f"❌ Failed to send invitation to {invite_email}: {response.status_code} - {response.text}")
            return False

    except Exception as e:
        logger.error(f"❌ Error sending invitation to {invite_email}: {str(e)}")
        return False

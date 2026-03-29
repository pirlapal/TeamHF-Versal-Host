import bcrypt
import jwt
import requests as http_requests
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from fastapi import Request, Response, HTTPException
from config import db, JWT_SECRET, JWT_ALGORITHM, EMERGENT_LLM_KEY, STORAGE_URL, APP_NAME, HF_MODEL, SENDGRID_API_KEY, SENDER_EMAIL, logger

# ── Password Helpers ──
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

# ── JWT Helpers ──
def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=60), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

# ── Document Serialization ──
def serialize_doc(doc):
    if doc is None:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            doc[k] = str(v)
        elif isinstance(v, datetime):
            doc[k] = v.isoformat()
    return doc

# ── Auth Middleware ──
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        result = serialize_doc(user)
        result.pop("password_hash", None)
        return result
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_role(request: Request, roles: list):
    user = await get_current_user(request)
    if user.get("role") not in roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return user

# ── Object Storage ──
storage_key = None

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_LLM_KEY:
        logger.warning("No EMERGENT_LLM_KEY set, file storage disabled")
        return None
    try:
        resp = http_requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise Exception("Storage not initialized")
    resp = http_requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    if not key:
        raise Exception("Storage not initialized")
    resp = http_requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ── Hugging Face AI ──
hf_client = None

def init_hf():
    global hf_client
    try:
        from huggingface_hub import InferenceClient
        hf_client = InferenceClient()
        logger.info("Hugging Face client initialized (serverless)")
        return True
    except Exception as e:
        logger.warning(f"HF init failed: {e}")
        return False

async def hf_generate(prompt: str, max_tokens: int = 512) -> str:
    if not hf_client:
        return None
    try:
        response = hf_client.text_generation(
            prompt, model=HF_MODEL, max_new_tokens=max_tokens,
            temperature=0.7, do_sample=True
        )
        return response
    except Exception as e:
        logger.warning(f"HF generation failed: {e}")
        return None

async def build_client_context(client_id: str, tenant_id: str) -> str:
    if not client_id:
        return ""
    try:
        client = await db.clients.find_one({"_id": ObjectId(client_id), "tenant_id": tenant_id})
        if not client:
            return ""
        services = await db.service_logs.find({"client_id": client_id, "tenant_id": tenant_id}).to_list(10)
        outcomes = await db.outcomes.find({"client_id": client_id, "tenant_id": tenant_id}).to_list(10)
        ctx = f"Client: {client.get('name', 'Unknown')}"
        if client.get('email'):
            ctx += f", Email: {client['email']}"
        if client.get('notes'):
            ctx += f", Notes: {client['notes']}"
        if services:
            ctx += f"\nServices ({len(services)} total): " + ", ".join([f"{s.get('service_type','?')} on {s.get('service_date','?')}" for s in services[:5]])
        if outcomes:
            ctx += f"\nOutcomes ({len(outcomes)} total): " + ", ".join([f"{o.get('goal_description','?')} [{o.get('status','?')}]" for o in outcomes[:5]])
        return ctx
    except Exception:
        return ""

# ── Notifications Helper ──
async def create_notification(tenant_id: str, user_id: str, notif_type: str, title: str, message: str, link: str = ""):
    doc = {
        "tenant_id": tenant_id,
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "link": link,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(doc)

# ── Email Notifications (SendGrid) ──
def send_email(to_email: str, subject: str, html_content: str) -> bool:
    if not SENDGRID_API_KEY:
        logger.info(f"Email skipped (no SendGrid key): to={to_email}, subject={subject}")
        return False
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        message = Mail(from_email=SENDER_EMAIL, to_emails=to_email, subject=subject, html_content=html_content)
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        logger.info(f"Email sent to {to_email}: {response.status_code}")
        return response.status_code == 202
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return False

def build_email_html(title: str, body: str, cta_text: str = "", cta_url: str = "") -> str:
    cta_block = ""
    if cta_text and cta_url:
        cta_block = f'<p style="margin-top:20px"><a href="{cta_url}" style="background:#F97316;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold">{cta_text}</a></p>'
    return f"""<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#FAFAF8;border-radius:16px">
<div style="text-align:center;margin-bottom:24px"><span style="font-size:22px;font-weight:800;color:#1F2937">Case<span style="color:#F97316">Flow</span></span></div>
<div style="background:#fff;border:1px solid #E8E8E8;border-radius:12px;padding:24px">
<h2 style="color:#1F2937;margin:0 0 12px;font-size:18px">{title}</h2>
<p style="color:#4B5563;font-size:14px;line-height:1.6;margin:0">{body}</p>
{cta_block}
</div>
<p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:20px">Sent by HackForge Case Management</p>
</div>"""

async def send_notification_email(tenant_id: str, user_id: str, notif_type: str, title: str, message: str, link: str = ""):
    """Create in-app notification + send email if SendGrid is configured."""
    await create_notification(tenant_id, user_id, notif_type, title, message, link)
    # Send email
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"email": 1, "name": 1})
    if user and user.get("email"):
        html = build_email_html(title, message, "View Details", link if link.startswith("http") else "")
        send_email(user["email"], f"HackForge: {title}", html)

# ── Advanced RBAC Permission System ──
DEFAULT_PERMISSIONS = {
    "ADMIN": [
        "clients.create", "clients.read", "clients.update", "clients.delete", "clients.import", "clients.approve",
        "services.create", "services.read",
        "visits.create", "visits.read", "visits.update",
        "outcomes.create", "outcomes.read", "outcomes.update",
        "follow_ups.create", "follow_ups.read", "follow_ups.update",
        "payments.create", "payments.read", "payments.update",
        "reports.read", "reports.export",
        "messages.create", "messages.read",
        "admin.users", "admin.settings", "admin.vocabulary", "admin.roles",
        "demo.seed", "demo.clear",
        "ai.copilot", "ai.templates",
        "storage.upload", "storage.read", "storage.delete",
    ],
    "CASE_WORKER": [
        "clients.create", "clients.read", "clients.update", "clients.import",
        "services.create", "services.read",
        "visits.create", "visits.read", "visits.update",
        "outcomes.create", "outcomes.read", "outcomes.update",
        "follow_ups.create", "follow_ups.read", "follow_ups.update",
        "payments.create", "payments.read",
        "messages.create", "messages.read",
        "ai.copilot", "ai.templates",
        "storage.upload", "storage.read",
    ],
    "VOLUNTEER": [
        "clients.read",
        "services.read",
        "visits.read",
        "outcomes.read",
        "follow_ups.read",
        "storage.read",
    ],
}

ALL_PERMISSIONS = sorted(set(p for perms in DEFAULT_PERMISSIONS.values() for p in perms))

async def get_user_permissions(user: dict) -> list:
    """Get permissions for user: custom role permissions > default role permissions."""
    role = user.get("role", "VOLUNTEER")
    tid = user.get("tenant_id")
    # Check for custom role definition
    custom_role = await db.custom_roles.find_one({"tenant_id": tid, "role_name": role})
    if custom_role:
        return custom_role.get("permissions", [])
    return DEFAULT_PERMISSIONS.get(role, DEFAULT_PERMISSIONS["VOLUNTEER"])

async def require_permission(request: Request, permission: str):
    """Check if the current user has a specific permission."""
    user = await get_current_user(request)
    perms = await get_user_permissions(user)
    if permission not in perms:
        raise HTTPException(status_code=403, detail=f"Missing permission: {permission}")
    return user

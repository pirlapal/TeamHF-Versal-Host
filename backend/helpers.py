import bcrypt
import jwt
import requests as http_requests
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from fastapi import Request, Response, HTTPException
from config import db, JWT_SECRET, JWT_ALGORITHM, EMERGENT_LLM_KEY, STORAGE_URL, APP_NAME, HF_MODEL, logger

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

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Query, Header
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import bcrypt
import jwt
import secrets
import csv
import io
import uuid
import random
import requests as http_requests
from bson import ObjectId
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Object Storage
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "caseflow"
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

# Hugging Face AI
HF_MODEL = "mistralai/Mistral-7B-Instruct-v0.3"
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

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── Helpers ──
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=60), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

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

# ── Pydantic Models ──
class AuthLogin(BaseModel):
    email: str
    password: str

class AuthRegister(BaseModel):
    email: str
    password: str
    name: str

class OnboardRequest(BaseModel):
    organization_name: str
    admin_name: str
    email: str
    password: str

class InviteCreate(BaseModel):
    email: str
    role: str = "CASE_WORKER"

class InviteAccept(BaseModel):
    name: str
    password: str

class ClientCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    demographics: Optional[Dict[str, Any]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    demographics: Optional[Dict[str, Any]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    pending: Optional[bool] = None
    is_archived: Optional[bool] = None

class ServiceLogCreate(BaseModel):
    service_date: str
    service_type: str
    provider_name: str
    notes: Optional[str] = None

class VisitCreate(BaseModel):
    client_id: str
    date: str
    duration: int = 60
    notes: Optional[str] = None

class VisitUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

class OutcomeCreate(BaseModel):
    goal_description: str
    target_date: str
    status: str = "NOT_STARTED"

class OutcomeUpdate(BaseModel):
    status: Optional[str] = None
    goal_description: Optional[str] = None
    target_date: Optional[str] = None

class VocabularyUpdate(BaseModel):
    mappings: List[Dict[str, str]]

class FieldSetUpdate(BaseModel):
    name: str
    fields: List[Dict[str, Any]]

class PaymentCheckout(BaseModel):
    origin_url: str
    package_id: str = "standard"

class AICopilotMessage(BaseModel):
    message: str
    client_id: Optional[str] = None

class FollowUpCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None
    urgency: str = "NORMAL"

class FollowUpUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    due_date: Optional[str] = None

class ShareableLinkCreate(BaseModel):
    email: str
    role: str = "CASE_WORKER"
    message: Optional[str] = None

# ── Auth Endpoints ──
@api_router.post("/auth/login")
async def login(data: AuthLogin, response: Response):
    email = data.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)
    result = serialize_doc(user)
    result.pop("password_hash", None)
    result["access_token"] = access_token
    return result

@api_router.post("/auth/register")
async def register(data: AuthRegister, response: Response):
    email = data.email.strip().lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": "CASE_WORKER",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)
    return {"id": user_id, "email": email, "name": data.name, "role": "CASE_WORKER", "access_token": access_token}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    return await get_current_user(request)

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user_id = str(user["_id"])
        new_access = create_access_token(user_id, user["email"])
        response.set_cookie(key="access_token", value=new_access, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
        return {"message": "Token refreshed"}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ── Onboarding ──
@api_router.post("/onboard")
async def onboard(data: OnboardRequest, response: Response):
    email = data.email.strip().lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    tenant_doc = {
        "name": data.organization_name,
        "slug": data.organization_name.lower().replace(" ", "-"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "ai_budget_cap": None,
        "ai_budget_used": 0,
    }
    tenant_result = await db.tenants.insert_one(tenant_doc)
    tenant_id = str(tenant_result.inserted_id)
    user_doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.admin_name,
        "role": "ADMIN",
        "tenant_id": tenant_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    user_result = await db.users.insert_one(user_doc)
    user_id = str(user_result.inserted_id)
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)
    return {
        "id": user_id, "email": email, "name": data.admin_name, "role": "ADMIN",
        "tenant_id": tenant_id, "organization_name": data.organization_name,
        "access_token": access_token
    }

# ── Invites ──
@api_router.post("/invites")
async def create_invite(data: InviteCreate, request: Request):
    user = await require_role(request, ["ADMIN"])
    token = secrets.token_urlsafe(32)
    invite_doc = {
        "email": data.email.strip().lower(),
        "role": data.role,
        "token": token,
        "tenant_id": user.get("tenant_id"),
        "invited_by": user["id"],
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=72)).isoformat(),
        "accepted_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.invites.insert_one(invite_doc)
    return {"token": token, "email": data.email, "role": data.role, "expires_at": invite_doc["expires_at"]}

@api_router.get("/invites/{token}")
async def get_invite(token: str):
    invite = await db.invites.find_one({"token": token}, {"_id": 0})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.get("accepted_at"):
        raise HTTPException(status_code=400, detail="Invite already used")
    if datetime.fromisoformat(invite["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite expired")
    tenant = await db.tenants.find_one({"_id": ObjectId(invite["tenant_id"])})
    return {"email": invite["email"], "role": invite["role"], "organization": tenant["name"] if tenant else "Unknown"}

@api_router.post("/invites/{token}/accept")
async def accept_invite(token: str, data: InviteAccept, response: Response):
    invite = await db.invites.find_one({"token": token})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.get("accepted_at"):
        raise HTTPException(status_code=400, detail="Invite already used")
    if datetime.fromisoformat(invite["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite expired")
    email = invite["email"]
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    user_doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": invite["role"],
        "tenant_id": invite["tenant_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    await db.invites.update_one({"token": token}, {"$set": {"accepted_at": datetime.now(timezone.utc).isoformat()}})
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)
    return {"id": user_id, "email": email, "name": data.name, "role": invite["role"], "access_token": access_token}

@api_router.get("/invites")
async def list_invites(request: Request):
    user = await require_role(request, ["ADMIN"])
    invites = await db.invites.find({"tenant_id": user.get("tenant_id")}, {"_id": 0}).to_list(100)
    return invites

# ── Clients ──
@api_router.get("/clients")
async def list_clients(request: Request, search: str = "", pending: Optional[bool] = None, page: int = 1, page_size: int = 25):
    user = await get_current_user(request)
    tenant_id = user.get("tenant_id")
    query = {"tenant_id": tenant_id, "is_archived": {"$ne": True}}
    if pending is not None:
        query["pending"] = pending
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    total = await db.clients.count_documents(query)
    skip = (page - 1) * page_size
    clients = await db.clients.find(query).sort("created_at", -1).skip(skip).limit(page_size).to_list(page_size)
    return {
        "data": [serialize_doc(c) for c in clients],
        "pagination": {"page": page, "page_size": page_size, "total_count": total, "total_pages": max(1, (total + page_size - 1) // page_size)}
    }

@api_router.post("/clients", status_code=201)
async def create_client(data: ClientCreate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    client_doc = {
        "name": data.name,
        "email": data.email,
        "phone": data.phone,
        "address": data.address,
        "demographics": data.demographics or {},
        "custom_fields": data.custom_fields or {},
        "notes": data.notes or "",
        "pending": user.get("role") != "ADMIN",
        "is_archived": False,
        "tenant_id": user.get("tenant_id"),
        "created_by": user["id"],
        "updated_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.clients.insert_one(client_doc)
    client_doc["id"] = str(result.inserted_id)
    del client_doc["_id"]
    return client_doc

@api_router.get("/clients/{client_id}")
async def get_client(client_id: str, request: Request):
    user = await get_current_user(request)
    try:
        client = await db.clients.find_one({"_id": ObjectId(client_id), "tenant_id": user.get("tenant_id")})
    except Exception:
        raise HTTPException(status_code=404, detail="Client not found")
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return serialize_doc(client)

@api_router.patch("/clients/{client_id}")
async def update_client(client_id: str, data: ClientUpdate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_by"] = user["id"]
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.clients.update_one({"_id": ObjectId(client_id), "tenant_id": user.get("tenant_id")}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    client = await db.clients.find_one({"_id": ObjectId(client_id)})
    return serialize_doc(client)

@api_router.delete("/clients/{client_id}")
async def archive_client(client_id: str, request: Request):
    user = await require_role(request, ["ADMIN"])
    result = await db.clients.update_one(
        {"_id": ObjectId(client_id), "tenant_id": user.get("tenant_id")},
        {"$set": {"is_archived": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"message": "Client archived"}

# ── Service Logs ──
@api_router.get("/clients/{client_id}/services")
async def list_services(client_id: str, request: Request):
    user = await get_current_user(request)
    services = await db.service_logs.find(
        {"client_id": client_id, "tenant_id": user.get("tenant_id")}
    ).sort("service_date", -1).to_list(100)
    return [serialize_doc(s) for s in services]

@api_router.post("/clients/{client_id}/services")
async def create_service(client_id: str, data: ServiceLogCreate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    doc = {
        "client_id": client_id,
        "tenant_id": user.get("tenant_id"),
        "service_date": data.service_date,
        "service_type": data.service_type,
        "provider_name": data.provider_name,
        "notes": data.notes or "",
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.service_logs.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    del doc["_id"]
    return doc

# ── Visits ──
@api_router.get("/visits")
async def list_visits(request: Request, from_date: str = "", to_date: str = ""):
    user = await get_current_user(request)
    query = {"tenant_id": user.get("tenant_id")}
    if from_date:
        query["date"] = {"$gte": from_date}
    if to_date:
        query.setdefault("date", {})
        if isinstance(query["date"], dict):
            query["date"]["$lte"] = to_date
    visits = await db.visits.find(query).sort("date", 1).to_list(500)
    result = []
    for v in visits:
        v_data = serialize_doc(v)
        client = await db.clients.find_one({"_id": ObjectId(v_data["client_id"])}, {"name": 1})
        v_data["client_name"] = client["name"] if client else "Unknown"
        result.append(v_data)
    return result

@api_router.post("/visits")
async def create_visit(data: VisitCreate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    doc = {
        "client_id": data.client_id,
        "tenant_id": user.get("tenant_id"),
        "date": data.date,
        "duration": data.duration,
        "notes": data.notes or "",
        "status": "SCHEDULED",
        "case_worker_id": user["id"],
        "case_worker_name": user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.visits.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    del doc["_id"]
    client = await db.clients.find_one({"_id": ObjectId(data.client_id)}, {"name": 1})
    doc["client_name"] = client["name"] if client else "Unknown"
    return doc

@api_router.patch("/visits/{visit_id}")
async def update_visit(visit_id: str, data: VisitUpdate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["status_changed_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.visits.update_one({"_id": ObjectId(visit_id), "tenant_id": user.get("tenant_id")}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Visit not found")
    visit = await db.visits.find_one({"_id": ObjectId(visit_id)})
    return serialize_doc(visit)

# ── Outcomes ──
@api_router.get("/clients/{client_id}/outcomes")
async def list_outcomes(client_id: str, request: Request):
    user = await get_current_user(request)
    outcomes = await db.outcomes.find({"client_id": client_id, "tenant_id": user.get("tenant_id")}).sort("created_at", -1).to_list(100)
    return [serialize_doc(o) for o in outcomes]

@api_router.post("/clients/{client_id}/outcomes")
async def create_outcome(client_id: str, data: OutcomeCreate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    doc = {
        "client_id": client_id,
        "tenant_id": user.get("tenant_id"),
        "goal_description": data.goal_description,
        "target_date": data.target_date,
        "status": data.status,
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.outcomes.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    del doc["_id"]
    return doc

@api_router.patch("/outcomes/{outcome_id}")
async def update_outcome(outcome_id: str, data: OutcomeUpdate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["status_changed_at"] = datetime.now(timezone.utc).isoformat()
    update_data["status_changed_by"] = user["id"]
    result = await db.outcomes.update_one({"_id": ObjectId(outcome_id), "tenant_id": user.get("tenant_id")}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Outcome not found")
    outcome = await db.outcomes.find_one({"_id": ObjectId(outcome_id)})
    return serialize_doc(outcome)

# ── Follow-Ups ──
@api_router.get("/clients/{client_id}/follow-ups")
async def list_follow_ups(client_id: str, request: Request):
    user = await get_current_user(request)
    follow_ups = await db.follow_ups.find({"client_id": client_id, "tenant_id": user.get("tenant_id")}).sort("due_date", 1).to_list(100)
    return [serialize_doc(f) for f in follow_ups]

@api_router.post("/clients/{client_id}/follow-ups")
async def create_follow_up(client_id: str, data: FollowUpCreate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    doc = {
        "client_id": client_id,
        "tenant_id": user.get("tenant_id"),
        "title": data.title,
        "description": data.description or "",
        "due_date": data.due_date,
        "urgency": data.urgency,
        "status": "OPEN",
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.follow_ups.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    del doc["_id"]
    return doc

@api_router.patch("/follow-ups/{follow_up_id}")
async def update_follow_up(follow_up_id: str, data: FollowUpUpdate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await db.follow_ups.update_one({"_id": ObjectId(follow_up_id), "tenant_id": user.get("tenant_id")}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    fu = await db.follow_ups.find_one({"_id": ObjectId(follow_up_id)})
    return serialize_doc(fu)

# ── Dashboard ──
@api_router.get("/dashboard/stats")
async def dashboard_stats(request: Request):
    user = await get_current_user(request)
    tid = user.get("tenant_id")
    clients = await db.clients.count_documents({"tenant_id": tid, "is_archived": {"$ne": True}})
    services = await db.service_logs.count_documents({"tenant_id": tid})
    visits = await db.visits.count_documents({"tenant_id": tid})
    outcomes = await db.outcomes.count_documents({"tenant_id": tid})
    pending = await db.clients.count_documents({"tenant_id": tid, "pending": True})
    return {"client_count": clients, "service_count": services, "visit_count": visits, "outcome_count": outcomes, "pending_count": pending}

@api_router.get("/dashboard/trends")
async def dashboard_trends(request: Request, range: str = "month"):
    user = await get_current_user(request)
    tid = user.get("tenant_id")
    now = datetime.now(timezone.utc)
    if range == "week":
        start = now - timedelta(days=7)
    elif range == "quarter":
        start = now - timedelta(days=90)
    elif range == "year":
        start = now - timedelta(days=365)
    else:
        start = now - timedelta(days=30)
    start_str = start.isoformat()
    services = await db.service_logs.find({"tenant_id": tid, "created_at": {"$gte": start_str}}).to_list(1000)
    visits = await db.visits.find({"tenant_id": tid, "created_at": {"$gte": start_str}}).to_list(1000)
    from collections import defaultdict
    service_by_date = defaultdict(int)
    visit_by_date = defaultdict(int)
    for s in services:
        d = s.get("service_date", s.get("created_at", ""))[:10]
        service_by_date[d] += 1
    for v in visits:
        d = v.get("date", v.get("created_at", ""))[:10]
        visit_by_date[d] += 1
    all_dates = sorted(set(list(service_by_date.keys()) + list(visit_by_date.keys())))
    return [{"date": d, "service_count": service_by_date.get(d, 0), "visit_count": visit_by_date.get(d, 0)} for d in all_dates]

@api_router.get("/dashboard/outcomes")
async def dashboard_outcomes(request: Request):
    user = await get_current_user(request)
    tid = user.get("tenant_id")
    pipeline = [
        {"$match": {"tenant_id": tid}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    results = await db.outcomes.aggregate(pipeline).to_list(10)
    return [{"status": r["_id"], "count": r["count"]} for r in results]

# ── Reports/Export ──
@api_router.get("/reports/export")
async def export_csv(request: Request):
    user = await require_role(request, ["ADMIN"])
    tid = user.get("tenant_id")
    clients = await db.clients.find({"tenant_id": tid, "is_archived": {"$ne": True}}, {"_id": 0}).to_list(10000)
    output = io.StringIO()
    if clients:
        writer = csv.DictWriter(output, fieldnames=["name", "email", "phone", "address", "pending", "created_at"])
        writer.writeheader()
        for c in clients:
            writer.writerow({k: c.get(k, "") for k in ["name", "email", "phone", "address", "pending", "created_at"]})
    return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=clients_export.csv"})

# ── AI Copilot (Hugging Face + Fallback) ──
AI_FALLBACK = {
    "summarize": "Based on the client's service history, they have been receiving consistent support. Key areas of focus include housing assistance and mental health counseling. The client shows positive engagement with scheduled visits.",
    "suggest_tags": ["housing", "mental-health", "active-engagement", "follow-up-needed"],
    "suggest_actions": ["Schedule a follow-up visit within 2 weeks", "Review housing application status", "Connect with mental health provider for updated assessment"],
    "missing_fields": ["emergency_contact", "insurance_info", "preferred_language"],
}

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

@api_router.post("/ai/copilot")
async def ai_copilot(data: AICopilotMessage, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    message = data.message.lower()
    client_context = await build_client_context(data.client_id or "", user.get("tenant_id", ""))
    model_used = "mock-fallback"

    # Try Hugging Face first
    if hf_client:
        try:
            prompt = "<s>[INST] You are a helpful case management assistant for a nonprofit organization. "
            if client_context:
                prompt += f"Here is context about a client:\n{client_context}\n\n"
            prompt += f"User request: {data.message}\n\nProvide a concise, helpful response. [/INST]"
            result = await hf_generate(prompt)
            if result and len(result.strip()) > 10:
                return {"type": "chat", "content": result.strip(), "model": f"hf:{HF_MODEL}"}
        except Exception as e:
            logger.warning(f"HF copilot error: {e}")

    # Fallback to mock
    if "summar" in message:
        content = AI_FALLBACK["summarize"]
        if client_context:
            content = f"Summary for {client_context.split(',')[0].replace('Client: ', '')}:\n{content}"
        return {"type": "summary", "content": content, "model": model_used}
    elif "tag" in message:
        return {"type": "tags", "content": AI_FALLBACK["suggest_tags"], "model": model_used}
    elif "action" in message or "suggest" in message:
        return {"type": "actions", "content": AI_FALLBACK["suggest_actions"], "model": model_used}
    elif "missing" in message or "field" in message:
        return {"type": "missing_fields", "content": AI_FALLBACK["missing_fields"], "model": model_used}
    else:
        return {
            "type": "chat",
            "content": f"I understand your question about '{data.message}'. As your AI assistant, I can help with summarizing case notes, suggesting tags, recommending next actions, and identifying missing fields. Try asking me to 'summarize this client' or 'suggest next actions'.",
            "model": model_used
        }

@api_router.post("/ai/summarize")
async def ai_summarize(request: Request, client_id: str = ""):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    services = await db.service_logs.find({"client_id": client_id, "tenant_id": user.get("tenant_id")}).to_list(50)
    service_count = len(services)
    content = f"Client has {service_count} service records. {AI_FALLBACK['summarize']}"
    if hf_client:
        ctx = await build_client_context(client_id, user.get("tenant_id", ""))
        prompt = f"<s>[INST] Summarize this client's case in 3-4 sentences:\n{ctx}\n[/INST]"
        result = await hf_generate(prompt, 256)
        if result and len(result.strip()) > 10:
            content = result.strip()
    return {"type": "SUMMARY", "content": content, "status": "COMPLETED", "model": f"hf:{HF_MODEL}" if hf_client else "mock-fallback"}

@api_router.post("/ai/suggest")
async def ai_suggest(request: Request, client_id: str = ""):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    return {
        "suggestions": [
            {"type": "TAGS", "content": AI_FALLBACK["suggest_tags"], "status": "COMPLETED"},
            {"type": "NEXT_ACTIONS", "content": AI_FALLBACK["suggest_actions"], "status": "COMPLETED"},
            {"type": "MISSING_FIELDS", "content": AI_FALLBACK["missing_fields"], "status": "COMPLETED"},
        ],
        "model": f"hf:{HF_MODEL}" if hf_client else "mock-fallback"
    }

# ── Payments (Stripe) ──
PACKAGES = {"basic": 10.00, "standard": 25.00, "premium": 50.00, "enterprise": 100.00}

@api_router.post("/payments/checkout")
async def create_checkout(data: PaymentCheckout, request: Request):
    user = await get_current_user(request)
    if data.package_id not in PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    amount = PACKAGES[data.package_id]
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
        success_url = f"{data.origin_url}/payments/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{data.origin_url}/payments"
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        checkout_req = CheckoutSessionRequest(
            amount=amount, currency="usd",
            success_url=success_url, cancel_url=cancel_url,
            metadata={"user_id": user["id"], "package_id": data.package_id, "tenant_id": user.get("tenant_id", "")}
        )
        session = await stripe_checkout.create_checkout_session(checkout_req)
        await db.payment_transactions.insert_one({
            "session_id": session.session_id,
            "user_id": user["id"],
            "tenant_id": user.get("tenant_id"),
            "amount": amount,
            "currency": "usd",
            "package_id": data.package_id,
            "payment_status": "INITIATED",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"url": session.url, "session_id": session.session_id}
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Payment error: {str(e)}")

@api_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request):
    user = await get_current_user(request)
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        status = await stripe_checkout.get_checkout_status(session_id)
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": status.payment_status, "status": status.status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"status": status.status, "payment_status": status.payment_status, "amount_total": status.amount_total, "currency": status.currency}
    except Exception as e:
        logger.error(f"Payment status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        body = await request.body()
        sig = request.headers.get("Stripe-Signature", "")
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        event = await stripe_checkout.handle_webhook(body, sig)
        if event.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": event.session_id},
                {"$set": {"payment_status": "paid", "event_type": event.event_type, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        return {"received": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"received": True}

@api_router.get("/payments/history")
async def payment_history(request: Request):
    user = await get_current_user(request)
    payments = await db.payment_transactions.find({"tenant_id": user.get("tenant_id")}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return payments

# ── Admin Settings ──
@api_router.get("/admin/vocabulary")
async def get_vocabulary(request: Request):
    user = await require_role(request, ["ADMIN"])
    vocab = await db.vocabulary_configs.find({"tenant_id": user.get("tenant_id")}).to_list(100)
    if not vocab:
        defaults = [
            {"default_label": "Client", "custom_label": "Client"},
            {"default_label": "Service", "custom_label": "Service"},
            {"default_label": "Visit", "custom_label": "Visit"},
            {"default_label": "Outcome", "custom_label": "Outcome"},
            {"default_label": "Case Worker", "custom_label": "Case Worker"},
            {"default_label": "Volunteer", "custom_label": "Volunteer"},
        ]
        for d in defaults:
            d["tenant_id"] = user.get("tenant_id")
            d["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.vocabulary_configs.insert_many(defaults)
        return [serialize_doc(d) for d in defaults]
    return [serialize_doc(v) for v in vocab]

@api_router.put("/admin/vocabulary")
async def update_vocabulary(data: VocabularyUpdate, request: Request):
    user = await require_role(request, ["ADMIN"])
    tid = user.get("tenant_id")
    for m in data.mappings:
        await db.vocabulary_configs.update_one(
            {"tenant_id": tid, "default_label": m.get("default_label")},
            {"$set": {"custom_label": m.get("custom_label"), "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
    return {"message": "Vocabulary updated"}

@api_router.get("/admin/field-sets")
async def get_field_sets(request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    field_sets = await db.field_sets.find({"tenant_id": user.get("tenant_id")}).to_list(100)
    return [serialize_doc(fs) for fs in field_sets]

@api_router.put("/admin/field-sets")
async def update_field_set(data: FieldSetUpdate, request: Request):
    user = await require_role(request, ["ADMIN"])
    tid = user.get("tenant_id")
    existing = await db.field_sets.find_one({"tenant_id": tid, "name": data.name})
    if existing:
        await db.field_sets.update_one(
            {"_id": existing["_id"]},
            {"$set": {"fields": data.fields, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.field_sets.insert_one({
            "tenant_id": tid, "name": data.name, "fields": data.fields,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return {"message": "Field set updated"}

@api_router.get("/admin/users")
async def list_users(request: Request):
    user = await require_role(request, ["ADMIN"])
    users = await db.users.find({"tenant_id": user.get("tenant_id")}, {"password_hash": 0}).to_list(100)
    return [serialize_doc(u) for u in users]

@api_router.patch("/admin/users/{user_id}")
async def update_user(user_id: str, request: Request):
    admin = await require_role(request, ["ADMIN"])
    body = await request.json()
    update_data = {}
    if "role" in body:
        update_data["role"] = body["role"]
    if "status" in body:
        update_data["status"] = body["status"]
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data")
    result = await db.users.update_one({"_id": ObjectId(user_id), "tenant_id": admin.get("tenant_id")}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User updated"}

# ── File Attachments ──
@api_router.post("/clients/{client_id}/attachments")
async def upload_attachment(client_id: str, request: Request, file: UploadFile = File(...)):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    client = await db.clients.find_one({"_id": ObjectId(client_id), "tenant_id": user.get("tenant_id")})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    file_uuid = str(uuid.uuid4())
    path = f"{APP_NAME}/attachments/{user.get('tenant_id')}/{client_id}/{file_uuid}.{ext}"
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    try:
        result = put_object(path, data, file.content_type or "application/octet-stream")
        file_doc = {
            "id": file_uuid,
            "client_id": client_id,
            "tenant_id": user.get("tenant_id"),
            "storage_path": result["path"],
            "original_filename": file.filename,
            "content_type": file.content_type,
            "size": result.get("size", len(data)),
            "uploaded_by": user["id"],
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.attachments.insert_one(file_doc)
        file_doc.pop("_id", None)
        return file_doc
    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@api_router.get("/clients/{client_id}/attachments")
async def list_attachments(client_id: str, request: Request):
    user = await get_current_user(request)
    attachments = await db.attachments.find(
        {"client_id": client_id, "tenant_id": user.get("tenant_id"), "is_deleted": False},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return attachments

@api_router.get("/files/{path:path}")
async def download_file(path: str, request: Request, auth: str = Query(None)):
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    elif auth:
        token = auth
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    record = await db.attachments.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        data, ct = get_object(path)
        return Response(content=data, media_type=record.get("content_type", ct))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

@api_router.delete("/attachments/{attachment_id}")
async def delete_attachment(attachment_id: str, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    result = await db.attachments.update_one(
        {"id": attachment_id, "tenant_id": user.get("tenant_id")},
        {"$set": {"is_deleted": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return {"message": "Attachment deleted"}

# ── CSV Import ──
@api_router.post("/clients/import")
async def import_clients_csv(request: Request, file: UploadFile = File(...)):
    user = await require_role(request, ["ADMIN"])
    tid = user.get("tenant_id")
    data = await file.read()
    text = data.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    imported = 0
    skipped = 0
    errors = []
    for row_num, row in enumerate(reader, start=2):
        name = row.get("name", "").strip()
        if not name:
            skipped += 1
            errors.append(f"Row {row_num}: Missing name")
            continue
        client_doc = {
            "name": name,
            "email": row.get("email", "").strip() or None,
            "phone": row.get("phone", "").strip() or None,
            "address": row.get("address", "").strip() or None,
            "demographics": {},
            "custom_fields": {},
            "notes": row.get("notes", "").strip() or "",
            "pending": False,
            "is_archived": False,
            "tenant_id": tid,
            "created_by": user["id"],
            "updated_by": user["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            await db.clients.insert_one(client_doc)
            imported += 1
        except Exception as e:
            skipped += 1
            errors.append(f"Row {row_num}: {str(e)[:50]}")
    return {"imported": imported, "skipped": skipped, "errors": errors[:20]}

# ── Demo Mode ──
DEMO_NAMES = ["Maria Garcia", "James Wilson", "Aisha Johnson", "Robert Chen", "Elena Petrova", "David Kim", "Fatima Al-Rashid", "Michael Brown", "Priya Patel", "Samuel Okafor", "Lisa Thompson", "Carlos Mendez"]
DEMO_SERVICES = ["Housing Assistance", "Mental Health Counseling", "Job Training", "Legal Aid", "Food Assistance", "Health Screening", "Financial Literacy", "ESL Classes"]
DEMO_GOALS = ["Secure stable housing", "Complete job training program", "Obtain GED certification", "Achieve mental health stability", "Secure employment", "Complete legal proceedings", "Establish emergency savings"]

@api_router.post("/demo/seed")
async def seed_demo_data(request: Request):
    user = await require_role(request, ["ADMIN"])
    tid = user.get("tenant_id")
    existing = await db.clients.count_documents({"tenant_id": tid})
    if existing > 50:
        raise HTTPException(status_code=400, detail="Too many existing clients. Archive or delete some first.")
    created_clients = []
    now = datetime.now(timezone.utc)
    # Create demo case worker user
    demo_worker_email = "caseworker@demo.caseflow.io"
    demo_worker_password = "demo1234"
    existing_worker = await db.users.find_one({"email": demo_worker_email})
    if not existing_worker:
        await db.users.insert_one({
            "email": demo_worker_email,
            "password_hash": hash_password(demo_worker_password),
            "name": "Sarah Thompson",
            "role": "CASE_WORKER",
            "tenant_id": tid,
            "created_at": now.isoformat(),
        })
    # Create demo volunteer user
    demo_vol_email = "volunteer@demo.caseflow.io"
    demo_vol_password = "demo1234"
    existing_vol = await db.users.find_one({"email": demo_vol_email})
    if not existing_vol:
        await db.users.insert_one({
            "email": demo_vol_email,
            "password_hash": hash_password(demo_vol_password),
            "name": "Alex Rivera",
            "role": "VOLUNTEER",
            "tenant_id": tid,
            "created_at": now.isoformat(),
        })
    for name in DEMO_NAMES:
        client_doc = {
            "name": name,
            "email": f"{name.lower().replace(' ', '.')}@example.com",
            "phone": f"+1 ({random.randint(200,999)}) {random.randint(200,999)}-{random.randint(1000,9999)}",
            "address": f"{random.randint(100,9999)} {random.choice(['Oak','Elm','Pine','Maple','Cedar'])} {random.choice(['St','Ave','Blvd','Dr'])}",
            "demographics": {"age_group": random.choice(["18-25", "26-35", "36-45", "46-55", "56+"]), "gender": random.choice(["Male", "Female", "Non-binary"])},
            "notes": f"Demo client created for testing. Referred by {random.choice(['Community Center', 'Hospital', 'School District', 'Self-referral'])}.",
            "pending": random.random() < 0.2,
            "is_archived": False,
            "tenant_id": tid,
            "created_by": user["id"],
            "updated_by": user["id"],
            "created_at": (now - timedelta(days=random.randint(1, 90))).isoformat(),
            "updated_at": now.isoformat(),
        }
        result = await db.clients.insert_one(client_doc)
        cid = str(result.inserted_id)
        created_clients.append(cid)
        # Services
        for _ in range(random.randint(1, 5)):
            svc_date = (now - timedelta(days=random.randint(1, 60))).strftime("%Y-%m-%d")
            await db.service_logs.insert_one({
                "client_id": cid, "tenant_id": tid,
                "service_date": svc_date,
                "service_type": random.choice(DEMO_SERVICES),
                "provider_name": f"Dr. {random.choice(['Smith','Jones','Lee','Williams','Martinez'])}",
                "notes": "Demo service log entry.",
                "created_by": user["id"],
                "created_at": (now - timedelta(days=random.randint(1, 60))).isoformat(),
            })
        # Outcomes
        for _ in range(random.randint(0, 3)):
            target = (now + timedelta(days=random.randint(30, 180))).strftime("%Y-%m-%d")
            await db.outcomes.insert_one({
                "client_id": cid, "tenant_id": tid,
                "goal_description": random.choice(DEMO_GOALS),
                "target_date": target,
                "status": random.choice(["NOT_STARTED", "IN_PROGRESS", "ACHIEVED", "NOT_ACHIEVED"]),
                "created_by": user["id"],
                "created_at": now.isoformat(),
            })
        # Visits
        for _ in range(random.randint(0, 3)):
            visit_date = (now + timedelta(days=random.randint(-30, 30))).isoformat()
            await db.visits.insert_one({
                "client_id": cid, "tenant_id": tid,
                "date": visit_date,
                "duration": random.choice([30, 45, 60, 90]),
                "notes": "Demo visit.",
                "status": random.choice(["SCHEDULED", "COMPLETED", "NO_SHOW"]),
                "case_worker_id": user["id"],
                "case_worker_name": user.get("name", "Admin"),
                "created_at": now.isoformat(),
            })
    return {
        "message": f"Demo data created: {len(created_clients)} clients with services, outcomes, and visits. Demo users also created.",
        "client_count": len(created_clients),
        "demo_users": [
            {"email": demo_worker_email, "password": demo_worker_password, "role": "CASE_WORKER", "name": "Sarah Thompson"},
            {"email": demo_vol_email, "password": demo_vol_password, "role": "VOLUNTEER", "name": "Alex Rivera"},
        ]
    }

# ── Shareable Invite Links ──
@api_router.post("/invites/shareable")
async def create_shareable_invite(data: ShareableLinkCreate, request: Request):
    user = await require_role(request, ["ADMIN"])
    token = secrets.token_urlsafe(32)
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    invite_doc = {
        "email": data.email.strip().lower(),
        "role": data.role,
        "token": token,
        "tenant_id": user.get("tenant_id"),
        "invited_by": user["id"],
        "message": data.message or "",
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=72)).isoformat(),
        "accepted_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.invites.insert_one(invite_doc)
    tenant = await db.tenants.find_one({"_id": ObjectId(user.get("tenant_id"))})
    org_name = tenant.get("name", "CaseFlow") if tenant else "CaseFlow"
    shareable_url = f"{frontend_url}/invite/{token}"
    return {
        "token": token,
        "email": data.email,
        "role": data.role,
        "shareable_url": shareable_url,
        "organization": org_name,
        "expires_at": invite_doc["expires_at"],
        "message": data.message or "",
    }

# ── AI Action Templates ──
AI_TEMPLATES = [
    {
        "id": "create_client",
        "label": "Create New Client",
        "description": "Add a new client to the system with basic information",
        "icon": "user-plus",
        "fields": [
            {"key": "name", "label": "Full Name", "type": "text", "required": True, "placeholder": "e.g. Maria Garcia"},
            {"key": "email", "label": "Email", "type": "email", "required": False, "placeholder": "client@example.com"},
            {"key": "phone", "label": "Phone", "type": "text", "required": False, "placeholder": "+1 (555) 000-0000"},
            {"key": "address", "label": "Address", "type": "text", "required": False, "placeholder": "123 Main St"},
            {"key": "notes", "label": "Notes", "type": "textarea", "required": False, "placeholder": "Initial notes about the client..."},
        ],
        "action": "POST /api/clients",
    },
    {
        "id": "schedule_visit",
        "label": "Schedule Visit",
        "description": "Book a visit with an existing client",
        "icon": "calendar-plus",
        "fields": [
            {"key": "client_id", "label": "Client", "type": "client_select", "required": True},
            {"key": "date", "label": "Date & Time", "type": "datetime-local", "required": True},
            {"key": "duration", "label": "Duration (min)", "type": "number", "required": True, "default": 60},
            {"key": "notes", "label": "Visit Notes", "type": "textarea", "required": False, "placeholder": "Purpose of visit..."},
        ],
        "action": "POST /api/visits",
    },
    {
        "id": "log_service",
        "label": "Log Service",
        "description": "Record a service provided to a client",
        "icon": "clipboard-plus",
        "fields": [
            {"key": "client_id", "label": "Client", "type": "client_select", "required": True},
            {"key": "service_date", "label": "Service Date", "type": "date", "required": True},
            {"key": "service_type", "label": "Service Type", "type": "text", "required": True, "placeholder": "e.g. Housing Assistance"},
            {"key": "provider_name", "label": "Provider Name", "type": "text", "required": True, "placeholder": "e.g. Dr. Smith"},
            {"key": "notes", "label": "Notes", "type": "textarea", "required": False, "placeholder": "Session details..."},
        ],
        "action": "POST /api/clients/{client_id}/services",
    },
    {
        "id": "add_outcome",
        "label": "Add Outcome Goal",
        "description": "Set a new outcome goal for a client",
        "icon": "target",
        "fields": [
            {"key": "client_id", "label": "Client", "type": "client_select", "required": True},
            {"key": "goal_description", "label": "Goal Description", "type": "text", "required": True, "placeholder": "e.g. Secure stable housing"},
            {"key": "target_date", "label": "Target Date", "type": "date", "required": True},
            {"key": "status", "label": "Status", "type": "select", "required": True, "options": ["NOT_STARTED", "IN_PROGRESS", "ACHIEVED", "NOT_ACHIEVED"], "default": "NOT_STARTED"},
        ],
        "action": "POST /api/clients/{client_id}/outcomes",
    },
]

@api_router.get("/ai/templates")
async def get_ai_templates(request: Request):
    await require_role(request, ["ADMIN", "CASE_WORKER"])
    return AI_TEMPLATES

class AIGenerateForm(BaseModel):
    template_id: str
    context: Optional[str] = None

@api_router.post("/ai/generate-form")
async def ai_generate_form(data: AIGenerateForm, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    template = next((t for t in AI_TEMPLATES if t["id"] == data.template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    prefill = {}
    now = datetime.now(timezone.utc)
    if data.template_id == "create_client":
        prefill = {"name": "", "email": "", "phone": "", "address": "", "notes": ""}
    elif data.template_id == "schedule_visit":
        prefill = {"client_id": "", "date": (now + timedelta(days=1)).strftime("%Y-%m-%dT10:00"), "duration": 60, "notes": ""}
    elif data.template_id == "log_service":
        prefill = {"client_id": "", "service_date": now.strftime("%Y-%m-%d"), "service_type": "", "provider_name": user.get("name", ""), "notes": ""}
    elif data.template_id == "add_outcome":
        prefill = {"client_id": "", "goal_description": "", "target_date": (now + timedelta(days=90)).strftime("%Y-%m-%d"), "status": "NOT_STARTED"}
    if data.context and hf_client:
        try:
            prompt = f"<s>[INST] Given context: '{data.context}', suggest values for: {', '.join(prefill.keys())}. Return as key:value pairs. [/INST]"
            result = await hf_generate(prompt, 200)
            if result:
                for line in result.strip().split("\n"):
                    if ":" in line:
                        k, v = line.split(":", 1)
                        k = k.strip().lower().replace(" ", "_")
                        if k in prefill:
                            prefill[k] = v.strip()
        except Exception:
            pass
    return {"template": template, "prefill": prefill}

# ── Health Check ──
@api_router.get("/health")
async def health():
    try:
        await db.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception:
        return {"status": "degraded", "database": "disconnected"}

# ── Include Router & CORS ──
app.include_router(api_router)

frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000", "https://future-app-5.preview.emergentagent.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup ──
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.invites.create_index("token", unique=True)
    await db.clients.create_index([("tenant_id", 1), ("name", 1)])
    await db.service_logs.create_index([("tenant_id", 1), ("client_id", 1)])
    await db.visits.create_index([("tenant_id", 1), ("date", 1)])
    await db.outcomes.create_index([("tenant_id", 1), ("client_id", 1)])
    await db.payment_transactions.create_index("session_id")
    await db.attachments.create_index([("tenant_id", 1), ("client_id", 1)])
    # Init storage
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.warning(f"Storage init skipped: {e}")
    # Init HF
    init_hf()
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@caseflow.io")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    default_tenant = await db.tenants.find_one({"slug": "default-org"})
    if not default_tenant:
        result = await db.tenants.insert_one({"name": "Default Organization", "slug": "default-org", "created_at": datetime.now(timezone.utc).isoformat(), "ai_budget_cap": None, "ai_budget_used": 0})
        tenant_id = str(result.inserted_id)
    else:
        tenant_id = str(default_tenant["_id"])
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "ADMIN",
            "tenant_id": tenant_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
    # Ensure admin has tenant_id
    admin_user = await db.users.find_one({"email": admin_email})
    if admin_user and not admin_user.get("tenant_id"):
        await db.users.update_one({"email": admin_email}, {"$set": {"tenant_id": tenant_id}})
    logger.info(f"Admin seeded: {admin_email}")
    # Write test credentials
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"# Test Credentials\n\n## Admin\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: ADMIN\n\n## Demo Case Worker\n- Email: caseworker@demo.caseflow.io\n- Password: demo1234\n- Role: CASE_WORKER\n- Name: Sarah Thompson\n\n## Demo Volunteer\n- Email: volunteer@demo.caseflow.io\n- Password: demo1234\n- Role: VOLUNTEER\n- Name: Alex Rivera\n\n## Auth Endpoints\n- POST /api/auth/login\n- POST /api/auth/register\n- GET /api/auth/me\n- POST /api/auth/logout\n")

@app.on_event("shutdown")
async def shutdown():
    client.close()

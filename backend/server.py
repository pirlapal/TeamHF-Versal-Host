from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import bcrypt
import jwt
import secrets
import csv
import io
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

# ── AI Copilot (Mock) ──
AI_RESPONSES = {
    "summarize": "Based on the client's service history, they have been receiving consistent support. Key areas of focus include housing assistance and mental health counseling. The client shows positive engagement with scheduled visits.",
    "suggest_tags": ["housing", "mental-health", "active-engagement", "follow-up-needed"],
    "suggest_actions": ["Schedule a follow-up visit within 2 weeks", "Review housing application status", "Connect with mental health provider for updated assessment"],
    "missing_fields": ["emergency_contact", "insurance_info", "preferred_language"],
}

@api_router.post("/ai/copilot")
async def ai_copilot(data: AICopilotMessage, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    message = data.message.lower()
    if "summar" in message:
        return {"type": "summary", "content": AI_RESPONSES["summarize"], "model": "mock-ai-v1"}
    elif "tag" in message:
        return {"type": "tags", "content": AI_RESPONSES["suggest_tags"], "model": "mock-ai-v1"}
    elif "action" in message or "suggest" in message:
        return {"type": "actions", "content": AI_RESPONSES["suggest_actions"], "model": "mock-ai-v1"}
    elif "missing" in message or "field" in message:
        return {"type": "missing_fields", "content": AI_RESPONSES["missing_fields"], "model": "mock-ai-v1"}
    else:
        client_context = ""
        if data.client_id:
            try:
                client = await db.clients.find_one({"_id": ObjectId(data.client_id)})
                if client:
                    client_context = f" Regarding client {client.get('name', 'Unknown')}: they have active services and outcomes being tracked."
            except Exception:
                pass
        return {
            "type": "chat",
            "content": f"I understand your question about '{data.message}'.{client_context} As your AI assistant, I can help with summarizing case notes, suggesting tags, recommending next actions, and identifying missing fields. Try asking me to 'summarize this client' or 'suggest next actions'.",
            "model": "mock-ai-v1"
        }

@api_router.post("/ai/summarize")
async def ai_summarize(request: Request, client_id: str = ""):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    services = await db.service_logs.find({"client_id": client_id, "tenant_id": user.get("tenant_id")}).to_list(50)
    service_count = len(services)
    return {
        "type": "SUMMARY",
        "content": f"Client has {service_count} service records. {AI_RESPONSES['summarize']}",
        "status": "PENDING",
        "model": "mock-ai-v1"
    }

@api_router.post("/ai/suggest")
async def ai_suggest(request: Request, client_id: str = ""):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    return {
        "suggestions": [
            {"type": "TAGS", "content": AI_RESPONSES["suggest_tags"], "status": "PENDING"},
            {"type": "NEXT_ACTIONS", "content": AI_RESPONSES["suggest_actions"], "status": "PENDING"},
            {"type": "MISSING_FIELDS", "content": AI_RESPONSES["missing_fields"], "status": "PENDING"},
        ],
        "model": "mock-ai-v1"
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
        f.write(f"# Test Credentials\n\n## Admin\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: ADMIN\n\n## Auth Endpoints\n- POST /api/auth/login\n- POST /api/auth/register\n- GET /api/auth/me\n- POST /api/auth/logout\n")

@app.on_event("shutdown")
async def shutdown():
    client.close()

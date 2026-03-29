from fastapi import APIRouter, Request, Response, HTTPException
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import secrets
import os

from config import db, logger
from helpers import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    set_auth_cookies, serialize_doc, get_current_user, require_role
)
from models.auth import AuthLogin, AuthRegister, OnboardRequest, InviteCreate, InviteAccept, ShareableLinkCreate

router = APIRouter()

@router.post("/auth/login")
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

@router.post("/auth/register")
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

@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@router.get("/auth/me")
async def get_me(request: Request):
    return await get_current_user(request)

@router.post("/auth/refresh")
async def refresh_token_endpoint(request: Request, response: Response):
    import jwt as pyjwt
    from config import JWT_SECRET, JWT_ALGORITHM
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user_id = str(user["_id"])
        new_access = create_access_token(user_id, user["email"])
        response.set_cookie(key="access_token", value=new_access, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
        return {"message": "Token refreshed"}
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ── Onboarding ──
@router.post("/onboard")
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
@router.post("/invites")
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

@router.get("/invites/{token}")
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

@router.post("/invites/{token}/accept")
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

@router.get("/invites")
async def list_invites(request: Request):
    user = await require_role(request, ["ADMIN"])
    invites = await db.invites.find({"tenant_id": user.get("tenant_id")}, {"_id": 0}).to_list(100)
    return invites

@router.post("/invites/shareable")
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
    org_name = tenant.get("name", "HackForge") if tenant else "HackForge"
    shareable_url = f"{frontend_url}/invite/{token}"
    return {
        "token": token, "email": data.email, "role": data.role,
        "shareable_url": shareable_url, "organization": org_name,
        "expires_at": invite_doc["expires_at"], "message": data.message or "",
    }

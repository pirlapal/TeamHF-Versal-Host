from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import secrets
import asyncio

from config import db, logger
from helpers import get_current_user, require_role, serialize_doc
from models.admin import VocabularyUpdate, FieldSetUpdate
from helpers import DEFAULT_PERMISSIONS, ALL_PERMISSIONS, get_user_permissions
from email_notifications import send_user_invitation_email

router = APIRouter()

@router.get("/admin/vocabulary")
async def get_vocabulary(request: Request):
    user = await get_current_user(request)
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

@router.put("/admin/vocabulary")
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

@router.get("/admin/field-sets")
async def get_field_sets(request: Request):
    user = await get_current_user(request)
    field_sets = await db.field_sets.find({"tenant_id": user.get("tenant_id")}).to_list(100)
    return [serialize_doc(fs) for fs in field_sets]

@router.put("/admin/field-sets")
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

@router.get("/admin/users")
async def list_users(request: Request):
    user = await require_role(request, ["ADMIN"])
    users = await db.users.find({"tenant_id": user.get("tenant_id")}, {"password_hash": 0}).to_list(100)
    return [serialize_doc(u) for u in users]

@router.patch("/admin/users/{user_id}")
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


# ── RBAC: Custom Roles & Permissions ──
@router.get("/admin/permissions/all")
async def list_all_permissions(request: Request):
    await require_role(request, ["ADMIN"])
    return {"permissions": ALL_PERMISSIONS, "default_roles": DEFAULT_PERMISSIONS}

@router.get("/admin/roles")
async def list_custom_roles(request: Request):
    user = await require_role(request, ["ADMIN"])
    tid = user.get("tenant_id")
    custom_roles = await db.custom_roles.find({"tenant_id": tid}).to_list(20)
    result = []
    for role_name, perms in DEFAULT_PERMISSIONS.items():
        custom = next((r for r in custom_roles if r.get("role_name") == role_name), None)
        result.append({
            "role_name": role_name,
            "permissions": serialize_doc(custom).get("permissions", perms) if custom else perms,
            "is_custom": bool(custom),
            "id": serialize_doc(custom).get("id") if custom else None,
        })
    return result

@router.put("/admin/roles/{role_name}")
async def update_role_permissions(role_name: str, request: Request):
    admin = await require_role(request, ["ADMIN"])
    tid = admin.get("tenant_id")
    body = await request.json()
    permissions = body.get("permissions", [])
    # Validate permissions
    invalid = [p for p in permissions if p not in ALL_PERMISSIONS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid permissions: {', '.join(invalid)}")
    existing = await db.custom_roles.find_one({"tenant_id": tid, "role_name": role_name})
    if existing:
        await db.custom_roles.update_one(
            {"_id": existing["_id"]},
            {"$set": {"permissions": permissions, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.custom_roles.insert_one({
            "tenant_id": tid, "role_name": role_name,
            "permissions": permissions,
            "created_by": admin["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return {"message": f"Permissions updated for {role_name}", "permissions": permissions}

@router.delete("/admin/roles/{role_name}")
async def reset_role_permissions(role_name: str, request: Request):
    admin = await require_role(request, ["ADMIN"])
    tid = admin.get("tenant_id")
    result = await db.custom_roles.delete_one({"tenant_id": tid, "role_name": role_name})
    if result.deleted_count == 0:
        return {"message": f"No custom permissions for {role_name} (using defaults)"}
    return {"message": f"Permissions reset to defaults for {role_name}"}

@router.get("/admin/users/{user_id}/permissions")
async def get_user_perms(user_id: str, request: Request):
    admin = await require_role(request, ["ADMIN"])
    target = await db.users.find_one({"_id": ObjectId(user_id), "tenant_id": admin.get("tenant_id")})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    perms = await get_user_permissions(serialize_doc(target))
    return {"user_id": user_id, "role": target.get("role"), "permissions": perms}

# ── Email settings ──
@router.get("/admin/email-settings")
async def get_email_settings(request: Request):
    user = await require_role(request, ["ADMIN"])
    from config import SENDGRID_API_KEY, SENDER_EMAIL
    return {
        "sendgrid_configured": bool(SENDGRID_API_KEY),
        "sender_email": SENDER_EMAIL if SENDGRID_API_KEY else None,
    }

# ── User Invitations ──
@router.post("/admin/invitations")
async def send_invitation(request: Request):
    """Send email invitation to a new user"""
    admin = await require_role(request, ["ADMIN"])
    body = await request.json()

    email = body.get("email", "").strip()
    name = body.get("name", "").strip()
    role = body.get("role", "CASE_WORKER")
    expiry_hours = body.get("expiry_hours", 48)

    if not email or not name:
        raise HTTPException(status_code=400, detail="Email and name are required")

    # Check if user already exists
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # Check for existing pending invitation
    existing_invite = await db.invitations.find_one({"email": email, "status": "PENDING"})
    if existing_invite:
        raise HTTPException(status_code=400, detail="Pending invitation already exists for this email")

    # Generate unique invitation token
    invite_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=expiry_hours)

    # Store invitation in database
    invitation_doc = {
        "email": email,
        "name": name,
        "role": role,
        "token": invite_token,
        "tenant_id": admin.get("tenant_id"),
        "invited_by": admin["id"],
        "invited_by_name": admin.get("name", "Admin"),
        "status": "PENDING",
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    result = await db.invitations.insert_one(invitation_doc)
    invitation_doc["id"] = str(result.inserted_id)
    invitation_doc.pop("_id", None)

    # Send invitation email asynchronously
    asyncio.create_task(send_user_invitation_email(
        invite_email=email,
        user_name=name,
        role=role,
        invite_token=invite_token,
        expiry_hours=expiry_hours
    ))

    return {"message": f"Invitation sent to {email}", "invitation": serialize_doc(invitation_doc)}

@router.get("/admin/invitations")
async def list_invitations(request: Request):
    """List all invitations for the admin's tenant"""
    admin = await require_role(request, ["ADMIN"])
    invitations = await db.invitations.find(
        {"tenant_id": admin.get("tenant_id")}
    ).sort("created_at", -1).to_list(100)
    return [serialize_doc(inv) for inv in invitations]

@router.delete("/admin/invitations/{invitation_id}")
async def cancel_invitation(invitation_id: str, request: Request):
    """Cancel a pending invitation"""
    admin = await require_role(request, ["ADMIN"])
    result = await db.invitations.update_one(
        {"_id": ObjectId(invitation_id), "tenant_id": admin.get("tenant_id")},
        {"$set": {"status": "CANCELLED", "cancelled_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invitation not found")
    return {"message": "Invitation cancelled"}

# ── Public Invitation Endpoints (no auth required) ──
@router.get("/invitations/validate/{token}")
async def validate_invitation(token: str):
    """Validate an invitation token (public endpoint)"""
    invitation = await db.invitations.find_one({"token": token, "status": "PENDING"})

    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid or expired invitation")

    # Check if expired
    expires_at = datetime.fromisoformat(invitation["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        await db.invitations.update_one(
            {"_id": invitation["_id"]},
            {"$set": {"status": "EXPIRED"}}
        )
        raise HTTPException(status_code=400, detail="Invitation has expired")

    return {
        "email": invitation["email"],
        "name": invitation["name"],
        "role": invitation["role"],
        "invited_by": invitation.get("invited_by_name", "Admin"),
        "expires_at": invitation["expires_at"],
    }

@router.post("/invitations/accept")
async def accept_invitation(request: Request):
    """Accept invitation and create user account (public endpoint)"""
    body = await request.json()
    token = body.get("token")
    password = body.get("password")

    if not token or not password:
        raise HTTPException(status_code=400, detail="Token and password are required")

    # Validate invitation
    invitation = await db.invitations.find_one({"token": token, "status": "PENDING"})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid or expired invitation")

    # Check if expired
    expires_at = datetime.fromisoformat(invitation["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        await db.invitations.update_one(
            {"_id": invitation["_id"]},
            {"$set": {"status": "EXPIRED"}}
        )
        raise HTTPException(status_code=400, detail="Invitation has expired")

    # Check if user already exists
    existing = await db.users.find_one({"email": invitation["email"]})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    # Create user account
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_password = pwd_context.hash(password)

    user_doc = {
        "email": invitation["email"],
        "name": invitation["name"],
        "role": invitation["role"],
        "tenant_id": invitation["tenant_id"],
        "password_hash": hashed_password,
        "status": "ACTIVE",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    result = await db.users.insert_one(user_doc)
    user_doc["id"] = str(result.inserted_id)
    user_doc.pop("_id", None)
    user_doc.pop("password_hash", None)

    # Mark invitation as accepted
    await db.invitations.update_one(
        {"_id": invitation["_id"]},
        {"$set": {"status": "ACCEPTED", "accepted_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {"message": "Account created successfully", "user": user_doc}

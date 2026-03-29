from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from datetime import datetime, timezone

from config import db, logger
from helpers import get_current_user, require_role, serialize_doc
from models.admin import VocabularyUpdate, FieldSetUpdate
from helpers import DEFAULT_PERMISSIONS, ALL_PERMISSIONS, get_user_permissions

router = APIRouter()

@router.get("/admin/vocabulary")
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
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
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

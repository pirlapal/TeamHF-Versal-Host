from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from datetime import datetime, timezone

from config import db, logger
from helpers import get_current_user, require_role, serialize_doc
from models.admin import VocabularyUpdate, FieldSetUpdate

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

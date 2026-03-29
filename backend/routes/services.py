from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from datetime import datetime, timezone, timedelta

from config import db
from helpers import get_current_user, require_role, serialize_doc
from models.services import ServiceLogCreate

router = APIRouter()

@router.get("/clients/{client_id}/services")
async def list_services(client_id: str, request: Request):
    user = await get_current_user(request)
    services = await db.service_logs.find(
        {"client_id": client_id, "tenant_id": user.get("tenant_id")}
    ).sort("service_date", -1).to_list(100)
    now = datetime.now(timezone.utc)
    result = []
    for s in services:
        doc = serialize_doc(s)
        # Check 72-hour edit window (R5.4)
        created_str = doc.get("created_at", "")
        try:
            created = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
            doc["editable"] = (now - created) < timedelta(hours=72)
        except Exception:
            doc["editable"] = False
        result.append(doc)
    return result

@router.post("/clients/{client_id}/services")
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
    doc["editable"] = True
    return doc

@router.put("/clients/{client_id}/services/{service_id}")
async def update_service(client_id: str, service_id: str, data: ServiceLogCreate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    existing = await db.service_logs.find_one({"_id": ObjectId(service_id), "client_id": client_id, "tenant_id": user.get("tenant_id")})
    if not existing:
        raise HTTPException(status_code=404, detail="Service log not found")
    # Enforce 72-hour edit window (R5.4)
    created_str = existing.get("created_at", "")
    try:
        created = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
        if (datetime.now(timezone.utc) - created) >= timedelta(hours=72):
            raise HTTPException(status_code=403, detail="Service log is past the 72-hour edit window and can no longer be modified")
    except (ValueError, TypeError):
        pass
    update = {}
    if data.service_date:
        update["service_date"] = data.service_date
    if data.service_type:
        update["service_type"] = data.service_type
    if data.provider_name:
        update["provider_name"] = data.provider_name
    if data.notes is not None:
        update["notes"] = data.notes
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    update["updated_by"] = user["id"]
    await db.service_logs.update_one({"_id": ObjectId(service_id)}, {"$set": update})
    updated = await db.service_logs.find_one({"_id": ObjectId(service_id)})
    doc = serialize_doc(updated)
    doc["editable"] = True
    return doc

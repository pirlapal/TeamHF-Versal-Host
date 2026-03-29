from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from datetime import datetime, timezone

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
    return [serialize_doc(s) for s in services]

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
    return doc

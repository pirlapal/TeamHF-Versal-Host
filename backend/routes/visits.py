from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from datetime import datetime, timezone

from config import db
from helpers import get_current_user, require_role, serialize_doc, create_notification
from models.services import VisitCreate, VisitUpdate

router = APIRouter()

@router.get("/visits")
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

@router.post("/visits")
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
    # Notify
    admins = await db.users.find({"tenant_id": user.get("tenant_id"), "role": {"$in": ["ADMIN", "CASE_WORKER"]}}).to_list(20)
    for a in admins:
        if str(a["_id"]) != user["id"]:
            await create_notification(user.get("tenant_id"), str(a["_id"]), "visit_scheduled",
                f"Visit scheduled: {doc['client_name']}", f"{user.get('name')} scheduled a visit for {data.date[:10]}", f"/calendar")
    return doc

@router.patch("/visits/{visit_id}")
async def update_visit(visit_id: str, data: VisitUpdate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["status_changed_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.visits.update_one({"_id": ObjectId(visit_id), "tenant_id": user.get("tenant_id")}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Visit not found")
    visit = await db.visits.find_one({"_id": ObjectId(visit_id)})
    return serialize_doc(visit)

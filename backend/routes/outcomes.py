from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from datetime import datetime, timezone

from config import db
from helpers import get_current_user, require_role, serialize_doc
from models.services import OutcomeCreate, OutcomeUpdate, FollowUpCreate, FollowUpUpdate

router = APIRouter()

# ── Outcomes ──
@router.get("/clients/{client_id}/outcomes")
async def list_outcomes(client_id: str, request: Request):
    user = await get_current_user(request)
    outcomes = await db.outcomes.find({"client_id": client_id, "tenant_id": user.get("tenant_id")}).sort("created_at", -1).to_list(100)
    return [serialize_doc(o) for o in outcomes]

@router.post("/clients/{client_id}/outcomes")
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

@router.patch("/outcomes/{outcome_id}")
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
@router.get("/clients/{client_id}/follow-ups")
async def list_follow_ups(client_id: str, request: Request):
    user = await get_current_user(request)
    follow_ups = await db.follow_ups.find({"client_id": client_id, "tenant_id": user.get("tenant_id")}).sort("due_date", 1).to_list(100)
    return [serialize_doc(f) for f in follow_ups]

@router.post("/clients/{client_id}/follow-ups")
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

@router.patch("/follow-ups/{follow_up_id}")
async def update_follow_up(follow_up_id: str, data: FollowUpUpdate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await db.follow_ups.update_one({"_id": ObjectId(follow_up_id), "tenant_id": user.get("tenant_id")}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    fu = await db.follow_ups.find_one({"_id": ObjectId(follow_up_id)})
    return serialize_doc(fu)

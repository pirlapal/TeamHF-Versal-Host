from fastapi import APIRouter, Request, HTTPException, Query
from bson import ObjectId
from datetime import datetime, timezone, timedelta

from config import db
from helpers import get_current_user, require_role, serialize_doc, send_notification_email
from models.services import VisitCreate, VisitUpdate

router = APIRouter()

@router.get("/visits")
async def list_visits(request: Request, from_date: str = "", to_date: str = "", time_range: str = Query(default="all", alias="range")):
    user = await get_current_user(request)
    query = {"tenant_id": user.get("tenant_id")}

    # If time_range is specified, calculate from_date automatically
    if time_range and time_range != "all":
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        if time_range == "week":
            from_date = (now - timedelta(days=7)).isoformat()
        elif time_range == "quarter":
            from_date = (now - timedelta(days=90)).isoformat()
        elif time_range == "year":
            from_date = (now - timedelta(days=365)).isoformat()
        else:  # month
            from_date = (now - timedelta(days=30)).isoformat()

    if from_date:
        query["date"] = {"$gte": from_date}
    if to_date:
        query.setdefault("date", {})
        if isinstance(query["date"], dict):
            query["date"]["$lte"] = to_date
    visits = await db.visits.find(query).sort("date", 1).to_list(500)
    # Batch fetch client names
    client_ids = list(set(v.get("client_id", "") for v in visits if v.get("client_id")))
    if client_ids:
        clients_docs = await db.clients.find({"_id": {"$in": [ObjectId(cid) for cid in client_ids]}}, {"name": 1}).to_list(len(client_ids))
        client_map = {str(c["_id"]): c.get("name", "Unknown") for c in clients_docs}
    else:
        client_map = {}
    result = []
    for v in visits:
        v_data = serialize_doc(v)
        v_data["client_name"] = client_map.get(v_data.get("client_id", ""), "Unknown")
        result.append(v_data)
    return result

@router.post("/visits")
async def create_visit(data: VisitCreate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    # Conflict detection (R6.3)
    if data.date:
        from datetime import datetime as dt, timedelta
        try:
            visit_start = dt.fromisoformat(data.date.replace("Z", "+00:00"))
            visit_end = visit_start + timedelta(minutes=data.duration or 60)
            existing = await db.visits.find({
                "tenant_id": user.get("tenant_id"),
                "client_id": data.client_id,
                "status": "SCHEDULED",
            }).to_list(500)
            conflicts = []
            for ev in existing:
                try:
                    ev_start = dt.fromisoformat(ev["date"].replace("Z", "+00:00"))
                    ev_end = ev_start + timedelta(minutes=ev.get("duration", 60))
                    if visit_start < ev_end and visit_end > ev_start:
                        conflicts.append({
                            "id": str(ev["_id"]),
                            "date": ev["date"],
                            "duration": ev.get("duration", 60),
                        })
                except Exception:
                    pass
            if conflicts:
                pass  # We still allow creation but return conflict info
        except Exception:
            conflicts = []
    else:
        conflicts = []
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
    if conflicts:
        doc["conflicts"] = conflicts
    # Notify
    admins = await db.users.find({"tenant_id": user.get("tenant_id"), "role": {"$in": ["ADMIN", "CASE_WORKER"]}}).to_list(20)
    for a in admins:
        if str(a["_id"]) != user["id"]:
            await send_notification_email(user.get("tenant_id"), str(a["_id"]), "visit_scheduled",
                f"Visit scheduled: {doc['client_name']}", f"{user.get('name')} scheduled a visit for {data.date[:10]}", "/calendar")
    return doc

@router.post("/visits/check-conflicts")
async def check_visit_conflicts(data: VisitCreate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    conflicts = []
    if data.date:
        from datetime import datetime as dt, timedelta
        try:
            visit_start = dt.fromisoformat(data.date.replace("Z", "+00:00"))
            visit_end = visit_start + timedelta(minutes=data.duration or 60)
            existing = await db.visits.find({
                "tenant_id": user.get("tenant_id"),
                "client_id": data.client_id,
                "status": "SCHEDULED",
            }).to_list(500)
            for ev in existing:
                try:
                    ev_start = dt.fromisoformat(ev["date"].replace("Z", "+00:00"))
                    ev_end = ev_start + timedelta(minutes=ev.get("duration", 60))
                    if visit_start < ev_end and visit_end > ev_start:
                        conflicts.append({
                            "id": str(ev["_id"]),
                            "date": ev["date"],
                            "duration": ev.get("duration", 60),
                            "client_id": ev.get("client_id", ""),
                        })
                except Exception:
                    pass
            # Batch fetch client names for conflicts
            if conflicts:
                conflict_cids = list(set(c["client_id"] for c in conflicts if c.get("client_id")))
                if conflict_cids:
                    conflict_clients = await db.clients.find({"_id": {"$in": [ObjectId(cid) for cid in conflict_cids]}}, {"name": 1}).to_list(len(conflict_cids))
                    cmap = {str(c["_id"]): c.get("name", "Unknown") for c in conflict_clients}
                else:
                    cmap = {}
                for c in conflicts:
                    c["client_name"] = cmap.get(c.get("client_id", ""), "Unknown")
                    del c["client_id"]
        except Exception:
            pass
    return {"has_conflicts": len(conflicts) > 0, "conflicts": conflicts}

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

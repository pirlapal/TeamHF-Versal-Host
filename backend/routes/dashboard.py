from fastapi import APIRouter, Request, HTTPException, Query
from bson import ObjectId
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from config import db
from helpers import get_current_user, serialize_doc

router = APIRouter()

@router.get("/dashboard/stats")
async def dashboard_stats(request: Request):
    user = await get_current_user(request)
    tid = user.get("tenant_id")
    clients = await db.clients.count_documents({"tenant_id": tid, "is_archived": {"$ne": True}})
    services = await db.service_logs.count_documents({"tenant_id": tid})
    visits = await db.visits.count_documents({"tenant_id": tid})
    outcomes = await db.outcomes.count_documents({"tenant_id": tid})
    pending = await db.clients.count_documents({"tenant_id": tid, "pending": True})
    unread_notifs = await db.notifications.count_documents({"tenant_id": tid, "user_id": user["id"], "is_read": False})
    return {"client_count": clients, "service_count": services, "visit_count": visits,
            "outcome_count": outcomes, "pending_count": pending, "unread_notifications": unread_notifs}

@router.get("/dashboard/trends")
async def dashboard_trends(request: Request, time_range: str = Query(default="month", alias="range")):
    user = await get_current_user(request)
    tid = user.get("tenant_id")
    now = datetime.now(timezone.utc)
    if time_range == "week":
        start = now - timedelta(days=7)
        days = 7
    elif time_range == "quarter":
        start = now - timedelta(days=90)
        days = 90
    elif time_range == "year":
        start = now - timedelta(days=365)
        days = 365
    else:
        start = now - timedelta(days=30)
        days = 30
    start_str = start.isoformat()

    # Generate full date range
    all_dates = [(start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days + 1)]

    services = await db.service_logs.find({"tenant_id": tid, "service_date": {"$gte": start.strftime("%Y-%m-%d")}}).to_list(1000)
    visits = await db.visits.find({"tenant_id": tid, "date": {"$gte": start_str}}).to_list(1000)
    service_by_date = defaultdict(int)
    visit_by_date = defaultdict(int)
    for s in services:
        d = s.get("service_date", s.get("created_at", ""))[:10]
        service_by_date[d] += 1
    for v in visits:
        d = v.get("date", v.get("created_at", ""))[:10]
        visit_by_date[d] += 1

    # Return all dates with zero-filled data
    return [{"date": d, "service_count": service_by_date.get(d, 0), "visit_count": visit_by_date.get(d, 0)} for d in all_dates]

@router.get("/dashboard/demographics")
async def dashboard_demographics(request: Request):
    user = await get_current_user(request)
    tid = user.get("tenant_id")
    clients = await db.clients.find(
        {"tenant_id": tid, "is_archived": {"$ne": True}},
        {"demographics": 1}
    ).to_list(5000)
    demo_counts = defaultdict(lambda: defaultdict(int))
    for c in clients:
        demos = c.get("demographics") or {}
        for key, val in demos.items():
            if val:
                demo_counts[key][str(val)] += 1
    result = []
    for category, values in demo_counts.items():
        items = [{"label": k, "count": v} for k, v in sorted(values.items(), key=lambda x: -x[1])]
        result.append({"category": category, "items": items[:10]})
    return result

@router.get("/dashboard/outcomes")
async def dashboard_outcomes(request: Request):
    user = await get_current_user(request)
    tid = user.get("tenant_id")
    pipeline = [
        {"$match": {"tenant_id": tid}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    results = await db.outcomes.aggregate(pipeline).to_list(10)
    return [{"status": r["_id"], "count": r["count"]} for r in results]

@router.get("/dashboard/activity")
async def dashboard_activity(request: Request):
    user = await get_current_user(request)
    tid = user.get("tenant_id")
    # Recent clients
    recent_clients = await db.clients.find({"tenant_id": tid, "is_archived": {"$ne": True}}).sort("created_at", -1).limit(5).to_list(5)
    # Upcoming visits
    now = datetime.now(timezone.utc).isoformat()
    upcoming_visits = await db.visits.find({"tenant_id": tid, "date": {"$gte": now}, "status": "SCHEDULED"}).sort("date", 1).limit(5).to_list(5)
    # Batch fetch client names
    visit_client_ids = list(set(v.get("client_id", "") for v in upcoming_visits if v.get("client_id")))
    if visit_client_ids:
        visit_clients = await db.clients.find({"_id": {"$in": [ObjectId(cid) for cid in visit_client_ids]}}, {"name": 1}).to_list(len(visit_client_ids))
        client_map = {str(c["_id"]): c.get("name", "Unknown") for c in visit_clients}
    else:
        client_map = {}
    for v in upcoming_visits:
        v["client_name"] = client_map.get(v.get("client_id", ""), "Unknown")
    # Pending approvals
    pending_clients = await db.clients.find({"tenant_id": tid, "pending": True}).sort("created_at", -1).limit(5).to_list(5)
    # Overdue payment requests
    overdue_payments = await db.payment_requests.find({"tenant_id": tid, "status": "OVERDUE"}).sort("created_at", -1).limit(5).to_list(5)
    return {
        "recent_clients": [serialize_doc(c) for c in recent_clients],
        "upcoming_visits": [serialize_doc(v) for v in upcoming_visits],
        "pending_approvals": [serialize_doc(p) for p in pending_clients],
        "overdue_payments": [serialize_doc(o) for o in overdue_payments],
    }

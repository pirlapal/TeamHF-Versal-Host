from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from datetime import datetime, timezone

from config import db
from helpers import get_current_user, serialize_doc

router = APIRouter()

@router.get("/notifications")
async def list_notifications(request: Request, limit: int = 20):
    user = await get_current_user(request)
    notifs = await db.notifications.find(
        {"tenant_id": user.get("tenant_id"), "user_id": user["id"]}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return [serialize_doc(n) for n in notifs]

@router.get("/notifications/unread-count")
async def unread_count(request: Request):
    user = await get_current_user(request)
    count = await db.notifications.count_documents(
        {"tenant_id": user.get("tenant_id"), "user_id": user["id"], "is_read": False}
    )
    return {"count": count}

@router.patch("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.notifications.update_one(
        {"_id": ObjectId(notif_id), "user_id": user["id"]},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Marked as read"}

@router.post("/notifications/read-all")
async def mark_all_read(request: Request):
    user = await get_current_user(request)
    result = await db.notifications.update_many(
        {"tenant_id": user.get("tenant_id"), "user_id": user["id"], "is_read": False},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": f"Marked {result.modified_count} notifications as read"}

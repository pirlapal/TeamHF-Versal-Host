from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from datetime import datetime, timezone

from config import db
from helpers import get_current_user, require_role, serialize_doc, send_notification_email
from models.notifications import MessageCreate, MessageReply

router = APIRouter()

@router.get("/messages/users")
async def list_users_for_messaging(request: Request):
    """Get list of users in the same tenant for sending messages"""
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    tid = user.get("tenant_id")
    # Get all users in the same tenant except the current user
    users = await db.users.find(
        {"tenant_id": tid, "_id": {"$ne": ObjectId(user["id"])}},
        {"password_hash": 0}
    ).to_list(100)
    return [serialize_doc(u) for u in users]

@router.get("/messages")
async def list_messages(request: Request):
    user = await get_current_user(request)
    tid = user.get("tenant_id")
    uid = user["id"]
    messages = await db.messages.find({
        "tenant_id": tid,
        "$or": [{"from_user_id": uid}, {"to_user_id": uid}]
    }).sort("created_at", -1).to_list(100)
    return [serialize_doc(m) for m in messages]

@router.post("/messages")
async def send_message(data: MessageCreate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    tid = user.get("tenant_id")
    now = datetime.now(timezone.utc)
    # Validate recipient
    recipient = await db.users.find_one({"_id": ObjectId(data.to_user_id), "tenant_id": tid})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    msg_doc = {
        "tenant_id": tid,
        "from_user_id": user["id"],
        "from_user_name": user.get("name", ""),
        "to_user_id": data.to_user_id,
        "to_user_name": recipient.get("name", ""),
        "subject": data.subject,
        "body": data.body,
        "is_read": False,
        "replies": [],
        "created_at": now.isoformat(),
    }
    result = await db.messages.insert_one(msg_doc)
    msg_doc["id"] = str(result.inserted_id)
    msg_doc.pop("_id", None)
    # Notify recipient
    await send_notification_email(tid, data.to_user_id, "new_message",
        f"Message from {user.get('name', 'Someone')}", data.subject[:50], "/messages")
    return msg_doc

@router.get("/messages/unread-count")
async def unread_messages_count(request: Request):
    user = await get_current_user(request)
    count = await db.messages.count_documents({
        "tenant_id": user.get("tenant_id"), "to_user_id": user["id"], "is_read": False
    })
    return {"count": count}

@router.get("/messages/{message_id}")
async def get_message(message_id: str, request: Request):
    user = await get_current_user(request)
    msg = await db.messages.find_one({"_id": ObjectId(message_id), "tenant_id": user.get("tenant_id")})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    # Mark as read if recipient
    if msg.get("to_user_id") == user["id"] and not msg.get("is_read"):
        await db.messages.update_one({"_id": ObjectId(message_id)}, {"$set": {"is_read": True}})
    return serialize_doc(msg)

@router.post("/messages/{message_id}/reply")
async def reply_message(message_id: str, data: MessageReply, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    msg = await db.messages.find_one({"_id": ObjectId(message_id), "tenant_id": user.get("tenant_id")})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    now = datetime.now(timezone.utc)
    reply = {
        "from_user_id": user["id"],
        "from_user_name": user.get("name", ""),
        "body": data.body,
        "created_at": now.isoformat(),
    }
    await db.messages.update_one({"_id": ObjectId(message_id)}, {"$push": {"replies": reply}, "$set": {"is_read": False}})
    # Notify the other party
    other_id = msg.get("from_user_id") if msg.get("to_user_id") == user["id"] else msg.get("to_user_id")
    if other_id:
        await send_notification_email(user.get("tenant_id"), other_id, "message_reply",
            f"Reply from {user.get('name', 'Someone')}", data.body[:50], "/messages")
    return {"message": "Reply sent"}


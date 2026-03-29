from fastapi import APIRouter, Request, Response, UploadFile, File, Query, HTTPException
from bson import ObjectId
from datetime import datetime, timezone
import jwt as pyjwt
import uuid

from config import db, JWT_SECRET, JWT_ALGORITHM, APP_NAME, logger
from helpers import get_current_user, require_role, put_object, get_object

router = APIRouter()

@router.post("/clients/{client_id}/attachments")
async def upload_attachment(client_id: str, request: Request, file: UploadFile = File(...)):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    client = await db.clients.find_one({"_id": ObjectId(client_id), "tenant_id": user.get("tenant_id")})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    file_uuid = str(uuid.uuid4())
    path = f"{APP_NAME}/attachments/{user.get('tenant_id')}/{client_id}/{file_uuid}.{ext}"
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    try:
        result = put_object(path, data, file.content_type or "application/octet-stream")
        file_doc = {
            "id": file_uuid,
            "client_id": client_id,
            "tenant_id": user.get("tenant_id"),
            "storage_path": result["path"],
            "original_filename": file.filename,
            "content_type": file.content_type,
            "size": result.get("size", len(data)),
            "uploaded_by": user["id"],
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.attachments.insert_one(file_doc)
        file_doc.pop("_id", None)
        return file_doc
    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/clients/{client_id}/attachments")
async def list_attachments(client_id: str, request: Request):
    user = await get_current_user(request)
    attachments = await db.attachments.find(
        {"client_id": client_id, "tenant_id": user.get("tenant_id"), "is_deleted": False},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return attachments

@router.get("/files/{path:path}")
async def download_file(path: str, request: Request, auth: str = Query(None)):
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    elif auth:
        token = auth
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    record = await db.attachments.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        data, ct = get_object(path)
        return Response(content=data, media_type=record.get("content_type", ct))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

@router.delete("/attachments/{attachment_id}")
async def delete_attachment(attachment_id: str, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    result = await db.attachments.update_one(
        {"id": attachment_id, "tenant_id": user.get("tenant_id")},
        {"$set": {"is_deleted": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return {"message": "Attachment deleted"}

from fastapi import APIRouter, Request, UploadFile, File, HTTPException
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional
import csv
import io
import asyncio

from config import db
from helpers import get_current_user, require_role, serialize_doc, send_notification_email
from models.clients import ClientCreate, ClientUpdate, ClientWizardCreate
from email_notifications import send_client_onboarding_email

router = APIRouter()

@router.get("/clients")
async def list_clients(request: Request, search: str = "", pending: Optional[bool] = None, status: str = "", date_from: str = "", date_to: str = "", page: int = 1, page_size: int = 25):
    user = await get_current_user(request)
    tenant_id = user.get("tenant_id")
    query = {"tenant_id": tenant_id, "is_archived": {"$ne": True}}
    if pending is not None:
        query["pending"] = pending
    if status == "active":
        query["pending"] = False
    elif status == "pending":
        query["pending"] = True
    if date_from:
        query.setdefault("created_at", {})
        query["created_at"]["$gte"] = date_from
    if date_to:
        query.setdefault("created_at", {})
        query["created_at"]["$lte"] = date_to
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    total = await db.clients.count_documents(query)
    skip = (page - 1) * page_size
    clients = await db.clients.find(query).sort("created_at", -1).skip(skip).limit(page_size).to_list(page_size)
    return {
        "data": [serialize_doc(c) for c in clients],
        "pagination": {"page": page, "page_size": page_size, "total_count": total, "total_pages": max(1, (total + page_size - 1) // page_size)}
    }

@router.post("/clients/check-duplicate")
async def check_duplicate_client(data: ClientCreate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    tid = user.get("tenant_id")
    duplicates = []
    if data.email:
        email_match = await db.clients.find(
            {"tenant_id": tid, "email": data.email, "is_archived": {"$ne": True}},
            {"_id": 0, "name": 1, "email": 1, "phone": 1}
        ).to_list(5)
        for m in email_match:
            duplicates.append({"match_type": "email", "name": m.get("name"), "email": m.get("email"), "phone": m.get("phone")})
    if data.phone:
        phone_match = await db.clients.find(
            {"tenant_id": tid, "phone": data.phone, "is_archived": {"$ne": True}},
            {"_id": 0, "name": 1, "email": 1, "phone": 1}
        ).to_list(5)
        for m in phone_match:
            if not any(d.get("name") == m.get("name") and d.get("match_type") == "email" for d in duplicates):
                duplicates.append({"match_type": "phone", "name": m.get("name"), "email": m.get("email"), "phone": m.get("phone")})
    return {"has_duplicates": len(duplicates) > 0, "duplicates": duplicates}

@router.post("/clients", status_code=201)
async def create_client(data: ClientCreate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    client_doc = {
        "name": data.name,
        "email": data.email,
        "phone": data.phone,
        "address": data.address,
        "demographics": data.demographics or {},
        "custom_fields": data.custom_fields or {},
        "notes": data.notes or "",
        "pending": user.get("role") != "ADMIN",
        "is_archived": False,
        "tenant_id": user.get("tenant_id"),
        "created_by": user["id"],
        "updated_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.clients.insert_one(client_doc)
    client_doc["id"] = str(result.inserted_id)
    del client_doc["_id"]
    # Notify admins
    admins = await db.users.find({"tenant_id": user.get("tenant_id"), "role": "ADMIN"}).to_list(20)
    for admin in admins:
        if str(admin["_id"]) != user["id"]:
            await send_notification_email(user.get("tenant_id"), str(admin["_id"]), "client_created",
                f"New client: {data.name}", f"{user.get('name')} added a new client", f"/clients/{client_doc['id']}")
            # Send EmailJS notification if client is pending approval
            if client_doc.get("pending") and admin.get("email"):
                asyncio.create_task(send_client_onboarding_email(
                    admin_email=admin.get("email"),
                    admin_name=admin.get("name", "Admin"),
                    client_name=data.name,
                    created_by=user.get("name", "Unknown"),
                    client_id=client_doc["id"],
                    is_pending=True
                ))
    return client_doc

@router.get("/clients/{client_id}")
async def get_client(client_id: str, request: Request):
    user = await get_current_user(request)
    try:
        client = await db.clients.find_one({"_id": ObjectId(client_id), "tenant_id": user.get("tenant_id")})
    except Exception:
        raise HTTPException(status_code=404, detail="Client not found")
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return serialize_doc(client)

@router.patch("/clients/{client_id}")
async def update_client(client_id: str, data: ClientUpdate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    update_data = {}
    for k, val in data.model_dump().items():
        if val is not None:
            update_data[k] = val
        elif k in ("demographics", "custom_fields"):
            # Allow saving empty dicts to clear these fields
            if val is not None:
                update_data[k] = val
    update_data["updated_by"] = user["id"]
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.clients.update_one({"_id": ObjectId(client_id), "tenant_id": user.get("tenant_id")}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    client = await db.clients.find_one({"_id": ObjectId(client_id)})
    return serialize_doc(client)

@router.delete("/clients/{client_id}")
async def archive_client(client_id: str, request: Request):
    user = await require_role(request, ["ADMIN"])
    result = await db.clients.update_one(
        {"_id": ObjectId(client_id), "tenant_id": user.get("tenant_id")},
        {"$set": {"is_archived": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"message": "Client archived"}

# ── Client Onboarding Wizard ──
@router.post("/clients/wizard", status_code=201)
async def create_client_wizard(data: ClientWizardCreate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    tid = user.get("tenant_id")
    now = datetime.now(timezone.utc)
    p = data.personal
    name = p.get("first_name", "")
    if p.get("last_name"):
        name = f"{name} {p['last_name']}"
    client_doc = {
        "name": name.strip(),
        "email": p.get("email"),
        "phone": p.get("phone"),
        "address": p.get("address"),
        "emergency_contact": p.get("emergency_contact"),
        "demographics": data.demographics or {},
        "custom_fields": {},
        "notes": p.get("notes", ""),
        "pending": user.get("role") != "ADMIN",
        "is_archived": False,
        "tenant_id": tid,
        "created_by": user["id"],
        "updated_by": user["id"],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "onboarded_via": "wizard",
    }
    result = await db.clients.insert_one(client_doc)
    cid = str(result.inserted_id)
    if data.services:
        svc_types = data.services.get("service_types", [])
        for svc in svc_types:
            await db.service_logs.insert_one({
                "client_id": cid, "tenant_id": tid,
                "service_date": now.strftime("%Y-%m-%d"),
                "service_type": svc,
                "provider_name": data.services.get("assigned_worker", user.get("name", "")),
                "notes": f"Initial service assigned during onboarding. Priority: {data.services.get('priority', 'NORMAL')}",
                "created_by": user["id"],
                "created_at": now.isoformat(),
            })
    if data.visit and data.visit.get("date"):
        await db.visits.insert_one({
            "client_id": cid, "tenant_id": tid,
            "date": data.visit["date"],
            "duration": data.visit.get("duration", 60),
            "notes": data.visit.get("notes", "Initial onboarding visit"),
            "status": "SCHEDULED",
            "location": data.visit.get("location", ""),
            "case_worker_id": user["id"],
            "case_worker_name": user.get("name", ""),
            "created_at": now.isoformat(),
        })
    client_doc["id"] = cid
    client_doc.pop("_id", None)
    # Notify
    admins = await db.users.find({"tenant_id": tid, "role": "ADMIN"}).to_list(20)
    for admin in admins:
        if str(admin["_id"]) != user["id"]:
            await send_notification_email(tid, str(admin["_id"]), "client_onboarded",
                f"Client onboarded: {name.strip()}", f"{user.get('name')} onboarded a new client via wizard", f"/clients/{cid}")
            # Send EmailJS notification if client is pending approval
            if client_doc.get("pending") and admin.get("email"):
                asyncio.create_task(send_client_onboarding_email(
                    admin_email=admin.get("email"),
                    admin_name=admin.get("name", "Admin"),
                    client_name=name.strip(),
                    created_by=user.get("name", "Unknown"),
                    client_id=cid,
                    is_pending=True
                ))
    return {"client": client_doc, "message": f"Client {name.strip()} onboarded successfully"}

# ── CSV Import ──
@router.post("/clients/import")
async def import_clients_csv(request: Request, file: UploadFile = File(...)):
    from config import logger
    user = await require_role(request, ["ADMIN"])
    tid = user.get("tenant_id")

    try:
        # Read and decode file
        data = await file.read()
        if not data:
            raise HTTPException(status_code=400, detail="Empty file uploaded")

        text = data.decode("utf-8")
        reader = csv.DictReader(io.StringIO(text))

        # Validate CSV has required columns
        if not reader.fieldnames or "name" not in reader.fieldnames:
            raise HTTPException(status_code=400, detail="CSV must have a 'name' column")

        imported = 0
        skipped = 0
        errors = []

        logger.info(f"📥 Starting CSV import for tenant {tid}, user {user['id']}")

        for row_num, row in enumerate(reader, start=2):
            name = row.get("name", "").strip()
            if not name:
                skipped += 1
                errors.append(f"Row {row_num}: Missing name")
                continue

            client_doc = {
                "name": name,
                "email": row.get("email", "").strip() or None,
                "phone": row.get("phone", "").strip() or None,
                "address": row.get("address", "").strip() or None,
                "demographics": {},
                "custom_fields": {},
                "notes": row.get("notes", "").strip() or "",
                "pending": False,
                "is_archived": False,
                "tenant_id": tid,
                "created_by": user["id"],
                "updated_by": user["id"],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            try:
                await db.clients.insert_one(client_doc)
                imported += 1
            except Exception as e:
                skipped += 1
                error_msg = str(e)[:100]
                errors.append(f"Row {row_num}: {error_msg}")
                logger.error(f"CSV import error row {row_num}: {error_msg}")

        logger.info(f"✅ CSV import complete: {imported} imported, {skipped} skipped")
        return {"imported": imported, "skipped": skipped, "errors": errors[:20]}

    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid file encoding. Please use UTF-8 CSV")
    except csv.Error as e:
        raise HTTPException(status_code=400, detail=f"CSV parsing error: {str(e)}")
    except Exception as e:
        logger.error(f"CSV import failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

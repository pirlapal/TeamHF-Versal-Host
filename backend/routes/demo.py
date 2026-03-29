from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import random
import uuid

from config import db, logger
from helpers import hash_password, require_role, send_notification_email

router = APIRouter()

DEMO_NAMES = ["Maria Garcia", "James Wilson", "Aisha Johnson", "Robert Chen", "Elena Petrova", "David Kim", "Fatima Al-Rashid", "Michael Brown", "Priya Patel", "Samuel Okafor", "Lisa Thompson", "Carlos Mendez"]
DEMO_SERVICES = ["Housing Assistance", "Mental Health Counseling", "Job Training", "Legal Aid", "Food Assistance", "Health Screening", "Financial Literacy", "ESL Classes"]
DEMO_GOALS = ["Secure stable housing", "Complete job training program", "Obtain GED certification", "Achieve mental health stability", "Secure employment", "Complete legal proceedings", "Establish emergency savings"]
MOCK_PAYMENT_CLIENTS = [("Maria Garcia", "maria.garcia@example.com"), ("James Wilson", "james.wilson@example.com"), ("Aisha Johnson", "aisha.johnson@example.com"), ("Robert Chen", "robert.chen@example.com")]
MOCK_PAYMENT_DESCRIPTIONS = ["Program enrollment fee", "Workshop materials", "Transportation assistance", "Childcare co-pay", "Skills training fee", "Event registration"]

@router.post("/demo/seed")
async def seed_demo_data(request: Request):
    user = await require_role(request, ["ADMIN"])
    tid = user.get("tenant_id")
    existing = await db.clients.count_documents({"tenant_id": tid})
    if existing > 50:
        raise HTTPException(status_code=400, detail="Too many existing clients. Archive or delete some first.")
    created_clients = []
    now = datetime.now(timezone.utc)
    # Create demo users
    demo_worker_email = "caseworker@demo.caseflow.io"
    demo_worker_password = "demo1234"
    existing_worker = await db.users.find_one({"email": demo_worker_email})
    if not existing_worker:
        await db.users.insert_one({
            "email": demo_worker_email, "password_hash": hash_password(demo_worker_password),
            "name": "Sarah Thompson", "role": "CASE_WORKER", "tenant_id": tid, "created_at": now.isoformat(),
        })
    demo_vol_email = "volunteer@demo.caseflow.io"
    demo_vol_password = "demo1234"
    existing_vol = await db.users.find_one({"email": demo_vol_email})
    if not existing_vol:
        await db.users.insert_one({
            "email": demo_vol_email, "password_hash": hash_password(demo_vol_password),
            "name": "Alex Rivera", "role": "VOLUNTEER", "tenant_id": tid, "created_at": now.isoformat(),
        })
    for name in DEMO_NAMES:
        client_doc = {
            "name": name,
            "email": f"{name.lower().replace(' ', '.')}@example.com",
            "phone": f"+1 ({random.randint(200,999)}) {random.randint(200,999)}-{random.randint(1000,9999)}",
            "address": f"{random.randint(100,9999)} {random.choice(['Oak','Elm','Pine','Maple','Cedar'])} {random.choice(['St','Ave','Blvd','Dr'])}",
            "demographics": {"age_group": random.choice(["18-25", "26-35", "36-45", "46-55", "56+"]), "gender": random.choice(["Male", "Female", "Non-binary"])},
            "notes": f"Demo client created for testing. Referred by {random.choice(['Community Center', 'Hospital', 'School District', 'Self-referral'])}.",
            "pending": random.random() < 0.2,
            "is_archived": False, "tenant_id": tid,
            "created_by": user["id"], "updated_by": user["id"],
            "created_at": (now - timedelta(days=random.randint(1, 90))).isoformat(), "updated_at": now.isoformat(),
        }
        result = await db.clients.insert_one(client_doc)
        cid = str(result.inserted_id)
        created_clients.append(cid)
        for _ in range(random.randint(1, 5)):
            svc_date = (now - timedelta(days=random.randint(1, 60))).strftime("%Y-%m-%d")
            await db.service_logs.insert_one({
                "client_id": cid, "tenant_id": tid, "service_date": svc_date,
                "service_type": random.choice(DEMO_SERVICES),
                "provider_name": f"Dr. {random.choice(['Smith','Jones','Lee','Williams','Martinez'])}",
                "notes": "Demo service log entry.", "created_by": user["id"],
                "created_at": (now - timedelta(days=random.randint(1, 60))).isoformat(),
            })
        for _ in range(random.randint(0, 3)):
            target = (now + timedelta(days=random.randint(30, 180))).strftime("%Y-%m-%d")
            await db.outcomes.insert_one({
                "client_id": cid, "tenant_id": tid,
                "goal_description": random.choice(DEMO_GOALS), "target_date": target,
                "status": random.choice(["NOT_STARTED", "IN_PROGRESS", "ACHIEVED", "NOT_ACHIEVED"]),
                "created_by": user["id"], "created_at": now.isoformat(),
            })
        for _ in range(random.randint(0, 3)):
            visit_date = (now + timedelta(days=random.randint(-30, 30))).isoformat()
            await db.visits.insert_one({
                "client_id": cid, "tenant_id": tid, "date": visit_date,
                "duration": random.choice([30, 45, 60, 90]), "notes": "Demo visit.",
                "status": random.choice(["SCHEDULED", "COMPLETED", "NO_SHOW"]),
                "case_worker_id": user["id"], "case_worker_name": user.get("name", "Admin"),
                "created_at": now.isoformat(),
            })
    # Seed mock payment data
    payment_count = 0
    for _ in range(random.randint(4, 8)):
        payer = random.choice(MOCK_PAYMENT_CLIENTS)
        status = random.choice(["PENDING", "PAID", "OVERDUE", "CANCELLED"])
        amount = round(random.uniform(15, 200), 2)
        await db.payment_requests.insert_one({
            "tenant_id": tid, "client_name": payer[0], "client_email": payer[1],
            "amount": amount, "currency": "usd", "description": random.choice(MOCK_PAYMENT_DESCRIPTIONS),
            "due_date": (now + timedelta(days=random.randint(7, 45))).strftime("%Y-%m-%d"),
            "status": status, "created_by": user["id"], "created_by_name": user.get("name", "Admin"),
            "created_at": (now - timedelta(days=random.randint(1, 60))).isoformat(),
        })
        payment_count += 1
    for _ in range(random.randint(2, 5)):
        pkg = random.choice(["basic", "standard", "premium"])
        amounts = {"basic": 10.00, "standard": 25.00, "premium": 50.00}
        await db.payment_transactions.insert_one({
            "session_id": f"mock_cs_{uuid.uuid4().hex[:16]}", "user_id": user["id"], "tenant_id": tid,
            "amount": amounts[pkg], "currency": "usd", "package_id": pkg,
            "payment_status": random.choice(["paid", "paid", "paid", "INITIATED"]),
            "created_at": (now - timedelta(days=random.randint(1, 90))).isoformat(),
        })
    # Seed demo notifications
    notif_types = [
        ("visit_reminder", "Upcoming visit tomorrow", "Don't forget your visit with Maria Garcia"),
        ("payment_overdue", "Overdue payment", "Payment request for James Wilson is overdue"),
        ("client_onboarded", "New client onboarded", "A new client was added via the wizard"),
    ]
    for ntype, title, msg in notif_types:
        await send_notification_email(tid, user["id"], ntype, title, msg, "/dashboard")

    return {
        "message": f"Demo data created: {len(created_clients)} clients with services, outcomes, visits, and {payment_count} payment requests.",
        "client_count": len(created_clients), "payment_request_count": payment_count,
        "demo_users": [
            {"email": demo_worker_email, "password": demo_worker_password, "role": "CASE_WORKER", "name": "Sarah Thompson"},
            {"email": demo_vol_email, "password": demo_vol_password, "role": "VOLUNTEER", "name": "Alex Rivera"},
        ]
    }

@router.post("/demo/clear")
async def clear_demo_data(request: Request):
    user = await require_role(request, ["ADMIN"])
    tid = user.get("tenant_id")
    deleted = {}
    deleted["clients"] = (await db.clients.delete_many({"tenant_id": tid})).deleted_count
    deleted["services"] = (await db.service_logs.delete_many({"tenant_id": tid})).deleted_count
    deleted["visits"] = (await db.visits.delete_many({"tenant_id": tid})).deleted_count
    deleted["outcomes"] = (await db.outcomes.delete_many({"tenant_id": tid})).deleted_count
    deleted["follow_ups"] = (await db.follow_ups.delete_many({"tenant_id": tid})).deleted_count
    deleted["attachments"] = (await db.attachments.delete_many({"tenant_id": tid})).deleted_count
    deleted["payment_requests"] = (await db.payment_requests.delete_many({"tenant_id": tid})).deleted_count
    deleted["payment_transactions"] = (await db.payment_transactions.delete_many({"tenant_id": tid})).deleted_count
    deleted["notifications"] = (await db.notifications.delete_many({"tenant_id": tid})).deleted_count
    deleted["messages"] = (await db.messages.delete_many({"tenant_id": tid})).deleted_count
    total = sum(deleted.values())
    return {"message": f"Cleared {total} records from your organization", "details": deleted}

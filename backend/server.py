from config import db, logger, mongo_client
from helpers import hash_password, verify_password, init_storage, init_hf

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
import os
from datetime import datetime, timezone

from routes.auth import router as auth_router
from routes.clients import router as clients_router
from routes.services import router as services_router
from routes.visits import router as visits_router
from routes.outcomes import router as outcomes_router
from routes.dashboard import router as dashboard_router
from routes.payments import router as payments_router
from routes.admin import router as admin_router
from routes.ai import router as ai_router
from routes.storage import router as storage_router
from routes.demo import router as demo_router
from routes.reports import router as reports_router
from routes.notifications import router as notifications_router
from routes.messages import router as messages_router

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Include all route modules
api_router.include_router(auth_router)
api_router.include_router(clients_router)
api_router.include_router(services_router)
api_router.include_router(visits_router)
api_router.include_router(outcomes_router)
api_router.include_router(dashboard_router)
api_router.include_router(payments_router)
api_router.include_router(admin_router)
api_router.include_router(ai_router)
api_router.include_router(storage_router)
api_router.include_router(demo_router)
api_router.include_router(reports_router)
api_router.include_router(notifications_router)
api_router.include_router(messages_router)

# Health check
@api_router.get("/health")
async def health():
    try:
        await db.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception:
        return {"status": "degraded", "database": "disconnected"}

app.include_router(api_router)

# CORS
frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup
@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.invites.create_index("token", unique=True)
    await db.clients.create_index([("tenant_id", 1), ("name", 1)])
    await db.service_logs.create_index([("tenant_id", 1), ("client_id", 1)])
    await db.visits.create_index([("tenant_id", 1), ("date", 1)])
    await db.outcomes.create_index([("tenant_id", 1), ("client_id", 1)])
    await db.payment_transactions.create_index("session_id")
    await db.payment_requests.create_index([("tenant_id", 1), ("status", 1)])
    await db.attachments.create_index([("tenant_id", 1), ("client_id", 1)])
    await db.notifications.create_index([("tenant_id", 1), ("user_id", 1), ("is_read", 1)])
    await db.messages.create_index([("tenant_id", 1), ("from_user_id", 1)])
    await db.messages.create_index([("tenant_id", 1), ("to_user_id", 1)])
    await db.custom_roles.create_index([("tenant_id", 1), ("role_name", 1)], unique=True)

    # Init services
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.warning(f"Storage init skipped: {e}")
    init_hf()

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@caseflow.io")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    default_tenant = await db.tenants.find_one({"slug": "default-org"})
    if not default_tenant:
        result = await db.tenants.insert_one({"name": "Default Organization", "slug": "default-org", "created_at": datetime.now(timezone.utc).isoformat(), "ai_budget_cap": None, "ai_budget_used": 0})
        tenant_id = str(result.inserted_id)
    else:
        tenant_id = str(default_tenant["_id"])
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "ADMIN",
            "tenant_id": tenant_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
    admin_user = await db.users.find_one({"email": admin_email})
    if admin_user and not admin_user.get("tenant_id"):
        await db.users.update_one({"email": admin_email}, {"$set": {"tenant_id": tenant_id}})
    logger.info(f"Admin seeded: {admin_email}")

    # Write test credentials
    # Use /tmp directory on cloud platforms like Render (read-only filesystem)
    memory_dir = os.environ.get("MEMORY_DIR", "/tmp/memory")
    os.makedirs(memory_dir, exist_ok=True)
    with open(f"{memory_dir}/test_credentials.md", "w") as f:
        f.write(f"# Test Credentials\n\n## Admin\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: ADMIN\n\n## Demo Case Worker\n- Email: caseworker@demo.caseflow.io\n- Password: demo1234\n- Role: CASE_WORKER\n- Name: Sarah Thompson\n\n## Demo Volunteer\n- Email: volunteer@demo.caseflow.io\n- Password: demo1234\n- Role: VOLUNTEER\n- Name: Alex Rivera\n")

@app.on_event("shutdown")
async def shutdown():
    mongo_client.close()

from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from datetime import datetime, timezone

from config import db, STRIPE_API_KEY, logger
from helpers import get_current_user, require_role, serialize_doc, send_notification_email
from models.payments import PaymentRequestCreate

router = APIRouter()

# ── Payment Requests ──
@router.post("/payments/request")
async def create_payment_request(data: PaymentRequestCreate, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    tid = user.get("tenant_id")
    now = datetime.now(timezone.utc)
    req_doc = {
        "tenant_id": tid,
        "client_name": data.client_name,
        "client_email": data.client_email,
        "amount": data.amount,
        "currency": "usd",
        "description": data.description,
        "due_date": data.due_date,
        "status": "PENDING",
        "created_by": user["id"],
        "created_by_name": user.get("name", ""),
        "created_at": now.isoformat(),
    }
    result = await db.payment_requests.insert_one(req_doc)
    req_doc["id"] = str(result.inserted_id)
    req_doc.pop("_id", None)
    # Send email to client if SendGrid is configured
    from helpers import send_email, build_email_html
    html = build_email_html(
        "Payment Request",
        f"You have a payment request from {user.get('name', 'HackForge')}.<br><br>"
        f"<strong>Amount:</strong> ${data.amount:.2f}<br>"
        f"<strong>Description:</strong> {data.description}<br>"
        f"<strong>Due Date:</strong> {data.due_date or 'N/A'}",
    )
    send_email(data.client_email, f"Payment Request: ${data.amount:.2f}", html)
    return req_doc

@router.get("/payments/requests")
async def list_payment_requests(request: Request):
    user = await get_current_user(request)
    tid = user.get("tenant_id")
    reqs = await db.payment_requests.find({"tenant_id": tid}).sort("created_at", -1).to_list(100)
    return [serialize_doc(r) for r in reqs]

@router.patch("/payments/requests/{request_id}")
async def update_payment_request(request_id: str, request: Request):
    user = await require_role(request, ["ADMIN"])
    body = await request.json()
    update_data = {}
    if "status" in body:
        update_data["status"] = body["status"]
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.payment_requests.update_one(
        {"_id": ObjectId(request_id), "tenant_id": user.get("tenant_id")},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payment request not found")
    # Notify on status change
    if update_data.get("status") == "PAID":
        req = await db.payment_requests.find_one({"_id": ObjectId(request_id)})
        if req and req.get("created_by"):
            await send_notification_email(user.get("tenant_id"), req["created_by"], "payment_received",
                f"Payment received: ${req.get('amount', 0):.2f}", f"Payment from {req.get('client_name', 'Unknown')} marked as paid", "/payments")
    return {"message": "Payment request updated"}

@router.post("/payments/requests/{request_id}/reminder")
async def send_payment_reminder(request_id: str, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    tid = user.get("tenant_id")
    # Get payment request
    req = await db.payment_requests.find_one({"_id": ObjectId(request_id), "tenant_id": tid})
    if not req:
        raise HTTPException(status_code=404, detail="Payment request not found")
    # Send reminder email
    from helpers import send_email, build_email_html
    html = build_email_html(
        "Payment Reminder",
        f"This is a reminder about your payment request from {user.get('name', 'HackForge')}.<br><br>"
        f"<strong>Amount:</strong> ${req.get('amount', 0):.2f}<br>"
        f"<strong>Description:</strong> {req.get('description', 'N/A')}<br>"
        f"<strong>Due Date:</strong> {req.get('due_date', 'N/A')}<br>"
        f"<strong>Status:</strong> {req.get('status', 'PENDING')}<br><br>"
        f"Please complete this payment at your earliest convenience.",
    )
    send_email(req.get('client_email'), f"Payment Reminder: ${req.get('amount', 0):.2f}", html)
    # Update last reminder sent timestamp
    await db.payment_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"last_reminder_sent": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Reminder sent successfully"}

@router.get("/payments/history")
async def payment_history(request: Request):
    user = await get_current_user(request)
    payments = await db.payment_transactions.find({"tenant_id": user.get("tenant_id")}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return payments

@router.get("/payments/summary")
async def payment_summary(request: Request):
    user = await get_current_user(request)
    tid = user.get("tenant_id")
    pipeline = [
        {"$match": {"tenant_id": tid}},
        {"$group": {"_id": "$status", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    results = await db.payment_requests.aggregate(pipeline).to_list(10)
    summary = {}
    for r in results:
        summary[r["_id"]] = {"total": r["total"], "count": r["count"]}
    return summary

# ── Stripe Checkout (kept for potential future use) ──
@router.post("/payments/checkout")
async def create_checkout(request: Request):
    from models.payments import PaymentCheckout
    data = PaymentCheckout(**(await request.json()))
    user = await get_current_user(request)
    PACKAGES = {"basic": 10.00, "standard": 25.00, "premium": 50.00, "enterprise": 100.00}
    if data.package_id not in PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    amount = PACKAGES[data.package_id]
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
        success_url = f"{data.origin_url}/payments/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{data.origin_url}/payments"
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        checkout_req = CheckoutSessionRequest(
            amount=amount, currency="usd",
            success_url=success_url, cancel_url=cancel_url,
            metadata={"user_id": user["id"], "package_id": data.package_id, "tenant_id": user.get("tenant_id", "")}
        )
        session = await stripe_checkout.create_checkout_session(checkout_req)
        await db.payment_transactions.insert_one({
            "session_id": session.session_id,
            "user_id": user["id"],
            "tenant_id": user.get("tenant_id"),
            "amount": amount,
            "currency": "usd",
            "package_id": data.package_id,
            "payment_status": "INITIATED",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"url": session.url, "session_id": session.session_id}
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Payment error: {str(e)}")

@router.get("/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request):
    user = await get_current_user(request)
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        status = await stripe_checkout.get_checkout_status(session_id)
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": status.payment_status, "status": status.status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"status": status.status, "payment_status": status.payment_status, "amount_total": status.amount_total, "currency": status.currency}
    except Exception as e:
        logger.error(f"Payment status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        body = await request.body()
        sig = request.headers.get("Stripe-Signature", "")
        host_url = str(request.base_url)
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        event = await stripe_checkout.handle_webhook(body, sig)
        if event.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": event.session_id},
                {"$set": {"payment_status": "paid", "event_type": event.event_type, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        return {"received": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"received": True}

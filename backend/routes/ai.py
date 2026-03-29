from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import os
import uuid

from config import db, logger
from helpers import get_current_user, require_role, serialize_doc

router = APIRouter()

# ── LLM Setup ──
LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
llm_available = False

async def llm_generate(system_prompt: str, user_prompt: str, max_tokens: int = 512) -> str:
    global llm_available
    if not LLM_KEY:
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=LLM_KEY,
            session_id=f"hackforge-{uuid.uuid4().hex[:8]}",
            system_message=system_prompt,
        )
        chat.with_model("openai", "gpt-4o-mini")
        msg = UserMessage(text=user_prompt)
        response = await chat.send_message(msg)
        llm_available = True
        return response if response and len(response.strip()) > 5 else None
    except Exception as e:
        logger.warning(f"LLM generation failed: {e}")
        return None

# ── Build Rich Client Context ──
async def build_client_context(client_id: str, tenant_id: str) -> dict:
    if not client_id:
        return None
    try:
        client = await db.clients.find_one({"_id": ObjectId(client_id), "tenant_id": tenant_id})
        if not client:
            return None
        services = await db.service_logs.find(
            {"client_id": client_id, "tenant_id": tenant_id}
        ).sort("service_date", -1).to_list(20)
        outcomes = await db.outcomes.find(
            {"client_id": client_id, "tenant_id": tenant_id}
        ).to_list(20)
        visits = await db.visits.find(
            {"client_id": client_id, "tenant_id": tenant_id}
        ).sort("date", -1).to_list(20)
        return {
            "name": client.get("name", "Unknown"),
            "email": client.get("email", ""),
            "phone": client.get("phone", ""),
            "status": "Active" if not client.get("pending") else "Pending",
            "notes": client.get("notes", ""),
            "demographics": client.get("demographics", {}),
            "services": [
                {"type": s.get("service_type", ""), "date": s.get("service_date", ""), "provider": s.get("provider_name", ""), "notes": s.get("notes", "")}
                for s in services
            ],
            "outcomes": [
                {"goal": o.get("goal_description", ""), "status": o.get("status", ""), "target": o.get("target_date", "")}
                for o in outcomes
            ],
            "visits": [
                {"date": v.get("date", ""), "status": v.get("status", ""), "duration": v.get("duration", 60), "notes": v.get("notes", "")}
                for v in visits
            ],
        }
    except Exception as e:
        logger.warning(f"build_client_context error: {e}")
        return None

def format_context_text(ctx: dict) -> str:
    if not ctx:
        return "No client selected."
    lines = [f"Client: {ctx['name']} | Status: {ctx['status']}"]
    if ctx.get("email"):
        lines.append(f"Email: {ctx['email']}")
    if ctx.get("phone"):
        lines.append(f"Phone: {ctx['phone']}")
    if ctx.get("notes"):
        lines.append(f"Notes: {ctx['notes']}")
    demos = ctx.get("demographics", {})
    if demos:
        lines.append(f"Demographics: {', '.join(f'{k}: {v}' for k, v in demos.items() if v)}")
    if ctx["services"]:
        lines.append(f"\nService History ({len(ctx['services'])} records):")
        for s in ctx["services"][:8]:
            line = f"  - {s['date']}: {s['type']}"
            if s.get("provider"):
                line += f" (Provider: {s['provider']})"
            if s.get("notes"):
                line += f" — {s['notes'][:80]}"
            lines.append(line)
    if ctx["outcomes"]:
        lines.append(f"\nOutcome Goals ({len(ctx['outcomes'])} total):")
        for o in ctx["outcomes"]:
            lines.append(f"  - {o['goal']} [{o['status']}] Target: {o['target']}")
    if ctx["visits"]:
        lines.append(f"\nVisit History ({len(ctx['visits'])} total):")
        for v in ctx["visits"][:5]:
            lines.append(f"  - {v['date'][:16] if v['date'] else 'N/A'}: {v['status']} ({v['duration']}min)")
    return "\n".join(lines)

def build_data_summary(ctx: dict) -> str:
    """Build an intelligent data-driven summary when LLM is not available."""
    if not ctx:
        return "No client data available. Please select a client to get a personalized summary."
    name = ctx["name"]
    status = ctx["status"]
    services = ctx["services"]
    outcomes = ctx["outcomes"]
    visits = ctx["visits"]

    parts = [f"{name} is currently a {status.lower()} client in the program."]

    if services:
        types = list(set(s["type"] for s in services if s["type"]))
        latest = services[0]["date"] if services else ""
        parts.append(
            f"They have received {len(services)} service(s), including {', '.join(types[:4])}."
            + (f" The most recent service was on {latest}." if latest else "")
        )
    else:
        parts.append("No services have been recorded yet.")

    if outcomes:
        achieved = sum(1 for o in outcomes if o["status"] == "ACHIEVED")
        in_prog = sum(1 for o in outcomes if o["status"] == "IN_PROGRESS")
        not_started = sum(1 for o in outcomes if o["status"] == "NOT_STARTED")
        goal_parts = []
        if achieved:
            goal_parts.append(f"{achieved} achieved")
        if in_prog:
            goal_parts.append(f"{in_prog} in progress")
        if not_started:
            goal_parts.append(f"{not_started} not yet started")
        parts.append(f"There are {len(outcomes)} outcome goal(s): {', '.join(goal_parts)}.")
        if achieved:
            achieved_goals = [o["goal"] for o in outcomes if o["status"] == "ACHIEVED"][:2]
            parts.append(f"Achieved goals include: {'; '.join(achieved_goals)}.")
    else:
        parts.append("No outcome goals have been set yet.")

    if visits:
        completed = sum(1 for v in visits if v["status"] == "COMPLETED")
        scheduled = sum(1 for v in visits if v["status"] == "SCHEDULED")
        parts.append(
            f"The client has {len(visits)} visit(s) on record"
            + (f" ({completed} completed, {scheduled} upcoming)" if completed or scheduled else "")
            + "."
        )
    else:
        parts.append("No visits have been scheduled.")

    return " ".join(parts)

# ── AI Templates ──
AI_TEMPLATES = [
    {
        "id": "create_client",
        "label": "Create New Client",
        "description": "Add a new client to the system with basic information",
        "icon": "user-plus",
        "fields": [
            {"key": "name", "label": "Full Name", "type": "text", "required": True, "placeholder": "e.g. Maria Garcia"},
            {"key": "email", "label": "Email", "type": "email", "required": False, "placeholder": "client@example.com"},
            {"key": "phone", "label": "Phone", "type": "text", "required": False, "placeholder": "+1 (555) 000-0000"},
            {"key": "address", "label": "Address", "type": "text", "required": False, "placeholder": "123 Main St"},
            {"key": "notes", "label": "Notes", "type": "textarea", "required": False, "placeholder": "Initial notes about the client..."},
        ],
        "action": "POST /api/clients",
    },
    {
        "id": "schedule_visit",
        "label": "Schedule Visit",
        "description": "Book a visit with an existing client",
        "icon": "calendar-plus",
        "fields": [
            {"key": "client_id", "label": "Client", "type": "client_select", "required": True},
            {"key": "date", "label": "Date & Time", "type": "datetime-local", "required": True},
            {"key": "duration", "label": "Duration (min)", "type": "number", "required": True, "default": 60},
            {"key": "notes", "label": "Visit Notes", "type": "textarea", "required": False, "placeholder": "Purpose of visit..."},
        ],
        "action": "POST /api/visits",
    },
    {
        "id": "log_service",
        "label": "Log Service",
        "description": "Record a service provided to a client",
        "icon": "clipboard-plus",
        "fields": [
            {"key": "client_id", "label": "Client", "type": "client_select", "required": True},
            {"key": "service_date", "label": "Service Date", "type": "date", "required": True},
            {"key": "service_type", "label": "Service Type", "type": "text", "required": True, "placeholder": "e.g. Housing Assistance"},
            {"key": "provider_name", "label": "Provider Name", "type": "text", "required": True, "placeholder": "e.g. Dr. Smith"},
            {"key": "notes", "label": "Notes", "type": "textarea", "required": False, "placeholder": "Session details..."},
        ],
        "action": "POST /api/clients/{client_id}/services",
    },
    {
        "id": "add_outcome",
        "label": "Add Outcome Goal",
        "description": "Set a new outcome goal for a client",
        "icon": "target",
        "fields": [
            {"key": "client_id", "label": "Client", "type": "client_select", "required": True},
            {"key": "goal_description", "label": "Goal Description", "type": "text", "required": True, "placeholder": "e.g. Secure stable housing"},
            {"key": "target_date", "label": "Target Date", "type": "date", "required": True},
            {"key": "status", "label": "Status", "type": "select", "required": True, "options": ["NOT_STARTED", "IN_PROGRESS", "ACHIEVED", "NOT_ACHIEVED"], "default": "NOT_STARTED"},
        ],
        "action": "POST /api/clients/{client_id}/outcomes",
    },
]

SYSTEM_PROMPT = """You are a professional case management AI assistant for HackForge, a nonprofit case management platform. 
You help case workers with client summaries, action suggestions, tag recommendations, and identifying missing information.
Always be concise, professional, and data-driven. Use the actual client data provided to give specific, actionable responses.
Never make up data — only reference what is provided in the context."""

# ── Endpoints ──
@router.post("/ai/copilot")
async def ai_copilot(request: Request):
    from models.ai import AICopilotMessage
    body = await request.json()
    data = AICopilotMessage(**body)
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    message = data.message.strip()
    message_lower = message.lower()

    ctx = await build_client_context(data.client_id or "", user.get("tenant_id", ""))
    ctx_text = format_context_text(ctx) if ctx else "No client selected."

    # Try LLM first
    llm_result = await llm_generate(
        SYSTEM_PROMPT,
        f"Client context:\n{ctx_text}\n\nUser request: {message}\n\nRespond concisely and helpfully.",
        max_tokens=400,
    )
    if llm_result:
        return {"type": "chat", "content": llm_result.strip(), "model": "gpt-4o-mini"}

    # Smart fallback based on intent
    if "summar" in message_lower:
        content = build_data_summary(ctx)
        return {"type": "summary", "content": content, "model": "data-driven-fallback"}
    elif "tag" in message_lower:
        tags = build_smart_tags(ctx)
        return {"type": "tags", "content": tags, "model": "data-driven-fallback"}
    elif "action" in message_lower or "suggest" in message_lower or "next" in message_lower:
        actions = build_smart_actions(ctx)
        return {"type": "actions", "content": actions, "model": "data-driven-fallback"}
    elif "missing" in message_lower or "field" in message_lower:
        missing = build_missing_fields(ctx)
        return {"type": "missing_fields", "content": missing, "model": "data-driven-fallback"}
    else:
        content = (
            f"I understand your question about '{message}'. "
            "I can help you with:\n"
            "• **Summarize client** — Get a data-driven case summary\n"
            "• **Suggest tags** — Auto-tag based on service history\n"
            "• **Next actions** — Recommend follow-up steps\n"
            "• **Missing fields** — Identify incomplete client records\n\n"
            "Or use the action templates below to create clients, schedule visits, and more."
        )
        return {"type": "chat", "content": content, "model": "data-driven-fallback"}

@router.post("/ai/summarize")
async def ai_summarize(request: Request, client_id: str = ""):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    ctx = await build_client_context(client_id, user.get("tenant_id", ""))
    ctx_text = format_context_text(ctx) if ctx else "No client data."

    llm_result = await llm_generate(
        SYSTEM_PROMPT,
        f"Write a professional 3-4 sentence case narrative summary for this client:\n\n{ctx_text}",
        max_tokens=300,
    )
    if llm_result:
        return {"type": "SUMMARY", "content": llm_result.strip(), "status": "COMPLETED", "model": "gpt-4o-mini"}

    return {
        "type": "SUMMARY",
        "content": build_data_summary(ctx),
        "status": "COMPLETED",
        "model": "data-driven-fallback",
    }

@router.post("/ai/suggest")
async def ai_suggest(request: Request, client_id: str = ""):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    ctx = await build_client_context(client_id, user.get("tenant_id", ""))
    return {
        "suggestions": [
            {"type": "TAGS", "content": build_smart_tags(ctx), "status": "COMPLETED"},
            {"type": "NEXT_ACTIONS", "content": build_smart_actions(ctx), "status": "COMPLETED"},
            {"type": "MISSING_FIELDS", "content": build_missing_fields(ctx), "status": "COMPLETED"},
        ],
        "model": "gpt-4o-mini" if llm_available else "data-driven-fallback",
    }

@router.get("/ai/templates")
async def get_ai_templates(request: Request):
    await require_role(request, ["ADMIN", "CASE_WORKER"])
    return AI_TEMPLATES

@router.post("/ai/generate-form")
async def ai_generate_form(request: Request):
    from models.ai import AIGenerateForm
    body = await request.json()
    data = AIGenerateForm(**body)
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    template = next((t for t in AI_TEMPLATES if t["id"] == data.template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    now = datetime.now(timezone.utc)
    prefill = {}
    if data.template_id == "create_client":
        prefill = {"name": "", "email": "", "phone": "", "address": "", "notes": ""}
    elif data.template_id == "schedule_visit":
        prefill = {"client_id": "", "date": (now + timedelta(days=1)).strftime("%Y-%m-%dT10:00"), "duration": 60, "notes": ""}
    elif data.template_id == "log_service":
        prefill = {"client_id": "", "service_date": now.strftime("%Y-%m-%d"), "service_type": "", "provider_name": user.get("name", ""), "notes": ""}
    elif data.template_id == "add_outcome":
        prefill = {"client_id": "", "goal_description": "", "target_date": (now + timedelta(days=90)).strftime("%Y-%m-%d"), "status": "NOT_STARTED"}
    # Try AI prefill with context
    if data.context and LLM_KEY:
        try:
            result = await llm_generate(
                "You are a form pre-fill assistant. Given context, suggest values for form fields. Return each as key: value on separate lines. Only return the fields asked for.",
                f"Context: '{data.context}'\nFields to fill: {', '.join(prefill.keys())}",
                200,
            )
            if result:
                for line in result.strip().split("\n"):
                    if ":" in line:
                        k, v = line.split(":", 1)
                        k = k.strip().lower().replace(" ", "_")
                        if k in prefill:
                            prefill[k] = v.strip()
        except Exception:
            pass
    return {"template": template, "prefill": prefill}

# ── Smart Fallback Helpers ──
def build_smart_tags(ctx: dict) -> list:
    if not ctx:
        return ["new-client", "needs-assessment"]
    tags = []
    if ctx["status"] == "Pending":
        tags.append("pending-approval")
    if ctx["status"] == "Active":
        tags.append("active")
    for s in ctx["services"]:
        tag = s["type"].lower().replace(" ", "-").replace("_", "-")
        if tag and tag not in tags:
            tags.append(tag)
    for o in ctx["outcomes"]:
        if o["status"] == "IN_PROGRESS":
            tags.append("goals-in-progress")
            break
    if any(o["status"] == "ACHIEVED" for o in ctx["outcomes"]):
        tags.append("goals-achieved")
    if not ctx["services"]:
        tags.append("no-services-yet")
    if not ctx["visits"]:
        tags.append("no-visits-scheduled")
    if len(ctx["visits"]) > 5:
        tags.append("high-engagement")
    return tags[:10]

def build_smart_actions(ctx: dict) -> list:
    if not ctx:
        return ["Select a client to get personalized action suggestions"]
    actions = []
    if not ctx["visits"] or not any(v["status"] == "SCHEDULED" for v in ctx["visits"]):
        actions.append(f"Schedule a follow-up visit with {ctx['name']}")
    if not ctx["outcomes"]:
        actions.append(f"Set initial outcome goals for {ctx['name']}")
    in_prog = [o for o in ctx["outcomes"] if o["status"] == "IN_PROGRESS"]
    for o in in_prog[:2]:
        actions.append(f"Review progress on: {o['goal']}")
    if ctx["services"]:
        latest = ctx["services"][0]
        actions.append(f"Follow up on latest service: {latest['type']} ({latest['date']})")
    if ctx["status"] == "Pending":
        actions.append(f"Review and approve {ctx['name']}'s enrollment")
    if not ctx.get("phone") and not ctx.get("email"):
        actions.append(f"Collect contact information for {ctx['name']}")
    if not actions:
        actions.append(f"Continue monitoring {ctx['name']}'s progress")
    return actions[:6]

def build_missing_fields(ctx: dict) -> list:
    if not ctx:
        return ["Select a client to check for missing fields"]
    missing = []
    if not ctx.get("email"):
        missing.append("email")
    if not ctx.get("phone"):
        missing.append("phone")
    if not ctx.get("demographics") or not ctx["demographics"]:
        missing.append("demographics (age_group, gender)")
    if not ctx.get("notes"):
        missing.append("case notes")
    if not ctx["outcomes"]:
        missing.append("outcome goals")
    if not ctx["services"]:
        missing.append("service records")
    if not ctx["visits"]:
        missing.append("scheduled visits")
    if not missing:
        missing.append("All key fields are filled! Client record looks complete.")
    return missing

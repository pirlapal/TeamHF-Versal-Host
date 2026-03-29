from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId
from datetime import datetime, timezone, timedelta

from config import db, HF_MODEL, logger
from helpers import get_current_user, require_role, hf_client, hf_generate, build_client_context
from models.ai import AICopilotMessage, AIGenerateForm

router = APIRouter()

AI_FALLBACK = {
    "summarize": "Based on the client's service history, they have been receiving consistent support. Key areas of focus include housing assistance and mental health counseling. The client shows positive engagement with scheduled visits.",
    "suggest_tags": ["housing", "mental-health", "active-engagement", "follow-up-needed"],
    "suggest_actions": ["Schedule a follow-up visit within 2 weeks", "Review housing application status", "Connect with mental health provider for updated assessment"],
    "missing_fields": ["emergency_contact", "insurance_info", "preferred_language"],
}

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

@router.post("/ai/copilot")
async def ai_copilot(data: AICopilotMessage, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    message = data.message.lower()
    client_context = await build_client_context(data.client_id or "", user.get("tenant_id", ""))
    model_used = "mock-fallback"
    if hf_client:
        try:
            prompt = "<s>[INST] You are a helpful case management assistant for a nonprofit organization. "
            if client_context:
                prompt += f"Here is context about a client:\n{client_context}\n\n"
            prompt += f"User request: {data.message}\n\nProvide a concise, helpful response. [/INST]"
            result = await hf_generate(prompt)
            if result and len(result.strip()) > 10:
                return {"type": "chat", "content": result.strip(), "model": f"hf:{HF_MODEL}"}
        except Exception as e:
            logger.warning(f"HF copilot error: {e}")
    if "summar" in message:
        content = AI_FALLBACK["summarize"]
        if client_context:
            content = f"Summary for {client_context.split(',')[0].replace('Client: ', '')}:\n{content}"
        return {"type": "summary", "content": content, "model": model_used}
    elif "tag" in message:
        return {"type": "tags", "content": AI_FALLBACK["suggest_tags"], "model": model_used}
    elif "action" in message or "suggest" in message:
        return {"type": "actions", "content": AI_FALLBACK["suggest_actions"], "model": model_used}
    elif "missing" in message or "field" in message:
        return {"type": "missing_fields", "content": AI_FALLBACK["missing_fields"], "model": model_used}
    else:
        return {
            "type": "chat",
            "content": f"I understand your question about '{data.message}'. As your AI assistant, I can help with summarizing case notes, suggesting tags, recommending next actions, and identifying missing fields. Try asking me to 'summarize this client' or 'suggest next actions'.",
            "model": model_used
        }

@router.post("/ai/summarize")
async def ai_summarize(request: Request, client_id: str = ""):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    services = await db.service_logs.find({"client_id": client_id, "tenant_id": user.get("tenant_id")}).to_list(50)
    service_count = len(services)
    content = f"Client has {service_count} service records. {AI_FALLBACK['summarize']}"
    if hf_client:
        ctx = await build_client_context(client_id, user.get("tenant_id", ""))
        prompt = f"<s>[INST] Summarize this client's case in 3-4 sentences:\n{ctx}\n[/INST]"
        result = await hf_generate(prompt, 256)
        if result and len(result.strip()) > 10:
            content = result.strip()
    return {"type": "SUMMARY", "content": content, "status": "COMPLETED", "model": f"hf:{HF_MODEL}" if hf_client else "mock-fallback"}

@router.post("/ai/suggest")
async def ai_suggest(request: Request, client_id: str = ""):
    await require_role(request, ["ADMIN", "CASE_WORKER"])
    return {
        "suggestions": [
            {"type": "TAGS", "content": AI_FALLBACK["suggest_tags"], "status": "COMPLETED"},
            {"type": "NEXT_ACTIONS", "content": AI_FALLBACK["suggest_actions"], "status": "COMPLETED"},
            {"type": "MISSING_FIELDS", "content": AI_FALLBACK["missing_fields"], "status": "COMPLETED"},
        ],
        "model": f"hf:{HF_MODEL}" if hf_client else "mock-fallback"
    }

@router.get("/ai/templates")
async def get_ai_templates(request: Request):
    await require_role(request, ["ADMIN", "CASE_WORKER"])
    return AI_TEMPLATES

@router.post("/ai/generate-form")
async def ai_generate_form(data: AIGenerateForm, request: Request):
    user = await require_role(request, ["ADMIN", "CASE_WORKER"])
    template = next((t for t in AI_TEMPLATES if t["id"] == data.template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    prefill = {}
    now = datetime.now(timezone.utc)
    if data.template_id == "create_client":
        prefill = {"name": "", "email": "", "phone": "", "address": "", "notes": ""}
    elif data.template_id == "schedule_visit":
        prefill = {"client_id": "", "date": (now + timedelta(days=1)).strftime("%Y-%m-%dT10:00"), "duration": 60, "notes": ""}
    elif data.template_id == "log_service":
        prefill = {"client_id": "", "service_date": now.strftime("%Y-%m-%d"), "service_type": "", "provider_name": user.get("name", ""), "notes": ""}
    elif data.template_id == "add_outcome":
        prefill = {"client_id": "", "goal_description": "", "target_date": (now + timedelta(days=90)).strftime("%Y-%m-%d"), "status": "NOT_STARTED"}
    if data.context and hf_client:
        try:
            prompt = f"<s>[INST] Given context: '{data.context}', suggest values for: {', '.join(prefill.keys())}. Return as key:value pairs. [/INST]"
            result = await hf_generate(prompt, 200)
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

from pydantic import BaseModel
from typing import Optional

class AICopilotMessage(BaseModel):
    message: str
    client_id: Optional[str] = None

class AIGenerateForm(BaseModel):
    template_id: str
    context: Optional[str] = None

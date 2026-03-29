from pydantic import BaseModel
from typing import Optional

class ServiceLogCreate(BaseModel):
    service_date: str
    service_type: str
    provider_name: str
    notes: Optional[str] = None

class VisitCreate(BaseModel):
    client_id: str
    date: str
    duration: int = 60
    notes: Optional[str] = None

class VisitUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

class OutcomeCreate(BaseModel):
    goal_description: str
    target_date: str
    status: str = "NOT_STARTED"

class OutcomeUpdate(BaseModel):
    status: Optional[str] = None
    goal_description: Optional[str] = None
    target_date: Optional[str] = None

class FollowUpCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None
    urgency: str = "NORMAL"

class FollowUpUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    due_date: Optional[str] = None

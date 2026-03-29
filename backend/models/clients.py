from pydantic import BaseModel
from typing import Optional, Dict, Any

class ClientCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    demographics: Optional[Dict[str, Any]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    demographics: Optional[Dict[str, Any]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    pending: Optional[bool] = None
    is_archived: Optional[bool] = None

class ClientWizardCreate(BaseModel):
    personal: Dict[str, Any]
    demographics: Optional[Dict[str, Any]] = None
    services: Optional[Dict[str, Any]] = None
    visit: Optional[Dict[str, Any]] = None

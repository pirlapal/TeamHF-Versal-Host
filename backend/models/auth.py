from pydantic import BaseModel
from typing import Optional

class AuthLogin(BaseModel):
    email: str
    password: str

class AuthRegister(BaseModel):
    email: str
    password: str
    name: str

class OnboardRequest(BaseModel):
    organization_name: str
    admin_name: str
    email: str
    password: str

class InviteCreate(BaseModel):
    email: str
    role: str = "CASE_WORKER"

class InviteAccept(BaseModel):
    name: str
    password: str

class ShareableLinkCreate(BaseModel):
    email: str
    role: str = "CASE_WORKER"
    message: Optional[str] = None

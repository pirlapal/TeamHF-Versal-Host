from pydantic import BaseModel
from typing import Optional

class MessageCreate(BaseModel):
    to_user_id: str
    subject: str
    body: str

class MessageReply(BaseModel):
    body: str

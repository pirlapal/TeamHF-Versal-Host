from pydantic import BaseModel
from typing import Optional

class PaymentCheckout(BaseModel):
    origin_url: str
    package_id: str = "standard"

class PaymentRequestCreate(BaseModel):
    client_name: str
    client_email: str
    amount: float
    description: str
    due_date: Optional[str] = None

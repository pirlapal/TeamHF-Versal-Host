from pydantic import BaseModel
from typing import List, Dict, Any

class VocabularyUpdate(BaseModel):
    mappings: List[Dict[str, str]]

class FieldSetUpdate(BaseModel):
    name: str
    fields: List[Dict[str, Any]]

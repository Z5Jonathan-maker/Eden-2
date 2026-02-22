"""
Harvest Module - Pydantic Models

Request/response models for canvassing visits, territories, and competitions.
"""

from pydantic import BaseModel
from typing import List, Optional, Literal


class VisitCreate(BaseModel):
    """Create a visit record (Spotio GPS logging)"""
    pin_id: str
    status: Literal["NH", "NI", "CB", "AP", "SG", "DNK"]
    lat: float
    lng: float
    notes: Optional[str] = None


class TerritoryCreate(BaseModel):
    """Create a territory (Spotio-style)"""
    name: str
    polygon: List[List[float]]  # [[lat, lng], ...]
    assigned_to: Optional[List[str]] = []  # List of user_ids
    color: str = "#22c55e"


class TerritoryUpdate(BaseModel):
    name: Optional[str] = None
    polygon: Optional[List[List[float]]] = None
    assigned_to: Optional[List[str]] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class CompetitionCreate(BaseModel):
    """Create a competition (Enzy-style)"""
    name: str
    metric: Literal["doors", "contacts", "appointments", "contracts", "revenue", "points"]
    type: Literal["individual", "team"]
    start_date: str
    end_date: str
    target: Optional[int] = None
    participants: Optional[List[str]] = []  # user_ids, empty = all


class AssistantRequest(BaseModel):
    """Request insights from Harvest Assistant (Enzy-style)"""
    scope: Literal["team", "user"] = "team"
    period: Literal["today", "this_week", "this_month"] = "this_week"
    user_id: Optional[str] = None

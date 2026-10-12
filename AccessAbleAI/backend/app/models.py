from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class ReportCreate(BaseModel):
    category: str = Field(..., description="Category of accessibility feature or barrier")
    title: str = Field(..., min_length=2, max_length=150)
    description: str = Field(..., min_length=3, max_length=1000)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    location_name: str = Field(..., min_length=2, max_length=200)
    severity: str = Field(default="moderate", description="low, moderate, high")
    affected_groups: str = Field(default="all", description="wheelchair, low_vision, elderly, all")
    alternative_route_note: Optional[str] = None
    photo_url: Optional[str] = None

class ReportResponse(BaseModel):
    id: str
    category: str
    title: str
    description: str
    latitude: float
    longitude: float
    location_name: str
    status: str
    source: str
    created_at: str
    severity: str
    affected_groups: str
    confirmations_count: int
    flags_count: int
    resolved: int
    alternative_route_note: Optional[str] = None
    photo_url: Optional[str] = None
    distance_km: Optional[float] = None

class SOSCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    location_text: Optional[str] = None
    contact_name: str = Field(..., min_length=1, max_length=100)
    contact_phone: str = Field(..., min_length=1, max_length=50)
    status: str = Field(default="SAVED")
    share_method: Optional[str] = None

class SOSResponse(BaseModel):
    id: str
    message: str
    latitude: Optional[float]
    longitude: Optional[float]
    location_text: Optional[str]
    contact_name: str
    contact_phone: str
    status: str
    share_method: Optional[str]
    created_at: str

class HealthResponse(BaseModel):
    status: str
    service: str
    database: str
    reports_count: int
    active_barriers_count: int
    sos_records_count: int
    isl_service_reachable: bool
    isl_service_details: dict
    ai_provider: str
    ai_configured: bool

class AIChatMessage(BaseModel):
    role: str
    content: str

class AIChatRequest(BaseModel):
    messages: List[AIChatMessage]
    context: Optional[Dict[str, Any]] = None

class AIChatResponse(BaseModel):
    reply: str
    provider: str
    tool_action: Optional[Dict[str, Any]] = None

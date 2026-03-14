"""
Voice Assistant Models
MongoDB schemas for Eden Voice Assistant + Console
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum


class AssistantMode(str, Enum):
    MESSAGE_ONLY = "message_only"
    MESSAGE_PLUS_CONFIRM = "message_plus_confirm"
    FULL_INTAKE_FUTURE = "full_intake_future"


class DaySchedule(BaseModel):
    open: str = "09:00"
    close: str = "17:00"
    enabled: bool = True


class BusinessHours(BaseModel):
    timezone: str = "America/New_York"
    schedule: Dict[str, DaySchedule] = Field(default_factory=lambda: {
        "monday": DaySchedule(),
        "tuesday": DaySchedule(),
        "wednesday": DaySchedule(),
        "thursday": DaySchedule(),
        "friday": DaySchedule(),
        "saturday": DaySchedule(enabled=False),
        "sunday": DaySchedule(enabled=False)
    })
    holidays: List[str] = []  # ISO dates: ["2026-12-25"]


class BehaviorFlags(BaseModel):
    allow_small_talk: bool = False
    allow_reschedule: bool = True
    allow_faq: bool = False
    allow_status_updates: bool = False
    require_verification: bool = True
    play_hold_music: bool = False


class AssistantConfig(BaseModel):
    """Voice Assistant configuration"""
    id: str
    version: int = 1
    
    # Operating Mode
    mode: AssistantMode = AssistantMode.MESSAGE_PLUS_CONFIRM
    enabled: bool = True
    
    # Business Hours
    business_hours: BusinessHours = Field(default_factory=BusinessHours)
    
    # Behavior Flags
    behavior_flags: BehaviorFlags = Field(default_factory=BehaviorFlags)
    
    # LLM Aggressiveness (0-1 slider)
    # 0 = Strictly follow scripts, 1 = Full conversational freedom
    llm_aggressiveness: float = 0.2
    
    # Limits
    max_recording_seconds: int = 60
    max_conversation_turns: int = 3
    
    # Twilio Configuration
    twilio_numbers: List[str] = []
    callback_number: str = ""
    
    # Metadata
    created_at: str = ""
    updated_at: str = ""
    created_by: str = ""


class ScriptVariables(BaseModel):
    company_name: str = "Care Claims"
    callback_window: str = "24 hours"
    business_hours: str = "Monday through Friday, 9 AM to 5 PM Eastern"


class ScriptSet(BaseModel):
    """Voice scripts with variable placeholders"""
    id: str
    version: int = 1
    name: str = "Default Scripts"
    
    # Core Scripts
    greeting_script: str = "Hello! Thank you for calling {company_name}. This is Eve, your virtual assistant. How can I help you today?"
    
    voicemail_script: str = "I'd like to take a message for you. Please leave your message after the tone, including your name and the best number to reach you. Someone will call you back within {callback_window}."
    
    after_hours_script: str = "Thank you for calling {company_name}. Our office is currently closed. Our hours are {business_hours}. Please leave a message and we'll return your call on the next business day."
    
    appointment_confirm_script: str = "Hi {caller_name}, this is Eve calling from {company_name}. I'm reaching out to confirm your appointment scheduled for {appointment_time} at {address}. Will you be available at that time? Press 1 to confirm, or press 2 if you need to reschedule."
    
    appointment_confirmed_script: str = "Great! Your appointment is confirmed. We'll see you on {appointment_time} at {address}. {instructions} Have a blessed day!"
    
    reschedule_script: str = "No problem! Please leave a message with your preferred days and times, and {adjuster_name} will call you back to reschedule."
    
    fallback_script: str = "I want to make sure we help you properly. Let me take a message and have one of our team members call you back. Please leave your message after the tone."
    
    goodbye_script: str = "Thank you for calling {company_name}. Have a blessed day!"
    
    # Variables
    variables: ScriptVariables = Field(default_factory=ScriptVariables)
    
    # Metadata
    is_active: bool = True
    created_at: str = ""
    updated_at: str = ""


class EscalationTriggers(BaseModel):
    keywords: List[str] = ["lawyer", "sue", "complaint", "supervisor", "emergency", "urgent"]
    intents: List[str] = ["angry", "urgent", "complex_question"]
    confidence_threshold: float = 0.6


class GuardrailConfig(BaseModel):
    """Safety guardrails for voice assistant"""
    id: str
    version: int = 1
    
    # Forbidden Topics
    forbidden_topics: List[str] = [
        "legal advice",
        "settlement amounts", 
        "coverage determination",
        "lawsuit",
        "attorney recommendation",
        "guaranteed outcomes",
        "specific timelines"
    ]
    
    # Required Disclaimer
    must_include_disclaimer: str = "Please note that I'm an automated assistant. For specific questions about your claim, one of our licensed adjusters will follow up with you."
    
    # Escalation Triggers
    escalation_triggers: EscalationTriggers = Field(default_factory=EscalationTriggers)
    
    # Conversation Limits
    max_conversation_turns: int = 3
    max_call_duration_seconds: int = 180
    
    # Response Constraints
    max_response_words: int = 50
    tone: str = "warm"  # "professional", "warm", "empathetic"
    
    # Safety Defaults
    always_offer_callback: bool = True
    always_log_full_transcript: bool = True
    require_human_review_flags: List[str] = ["low_confidence", "escalation", "complaint"]
    
    created_at: str = ""
    updated_at: str = ""


class CallIntent(str, Enum):
    MESSAGE = "message"
    CONFIRM_YES = "confirm_yes"
    CONFIRM_NO = "confirm_no"
    RESCHEDULE_REQUEST = "reschedule_request"
    STATUS_INQUIRY = "status_inquiry"
    COMPLAINT = "complaint"
    URGENT = "urgent"
    OTHER = "other"


class AppointmentAction(str, Enum):
    CONFIRMED = "confirmed"
    RESCHEDULE_REQUESTED = "reschedule_requested"
    NO_ACTION = "no_action"


class CallLog(BaseModel):
    """Log of voice calls handled by assistant"""
    id: str
    call_sid: str  # Twilio Call SID
    
    # Call Metadata
    from_number: str
    to_number: str
    direction: str = "inbound"
    start_time: str
    end_time: Optional[str] = None
    duration_seconds: int = 0
    
    # Matching
    matched_claim_id: Optional[str] = None
    matched_client_id: Optional[str] = None
    matched_client_name: Optional[str] = None
    
    # Content
    raw_transcript: Optional[str] = None
    ai_summary: Optional[str] = None
    
    # Intent Classification
    intent: CallIntent = CallIntent.MESSAGE
    intent_confidence: float = 0.0
    
    # For Appointment Calls
    appointment_id: Optional[str] = None
    appointment_action_taken: Optional[AppointmentAction] = None
    
    # Configuration Used (for auditing)
    assistant_config_version: int = 1
    script_set_version: int = 1
    guardrail_config_version: int = 1
    
    # Internal Actions
    follow_up_required: bool = True
    follow_up_assigned_to: Optional[str] = None
    follow_up_completed: bool = False
    follow_up_notes: Optional[str] = None
    
    # Flags
    flagged_for_review: bool = False
    flag_reasons: List[str] = []
    
    # Recording
    recording_url: Optional[str] = None
    recording_duration_seconds: int = 0
    
    # Communication Event Link
    communication_event_id: Optional[str] = None
    
    created_at: str = ""
    updated_at: str = ""


# Request/Response models for API
class AssistantConfigUpdate(BaseModel):
    mode: Optional[AssistantMode] = None
    enabled: Optional[bool] = None
    business_hours: Optional[BusinessHours] = None
    behavior_flags: Optional[BehaviorFlags] = None
    llm_aggressiveness: Optional[float] = None
    max_recording_seconds: Optional[int] = None
    max_conversation_turns: Optional[int] = None
    twilio_numbers: Optional[List[str]] = None
    callback_number: Optional[str] = None


class ScriptSetUpdate(BaseModel):
    name: Optional[str] = None
    greeting_script: Optional[str] = None
    voicemail_script: Optional[str] = None
    after_hours_script: Optional[str] = None
    appointment_confirm_script: Optional[str] = None
    appointment_confirmed_script: Optional[str] = None
    reschedule_script: Optional[str] = None
    fallback_script: Optional[str] = None
    goodbye_script: Optional[str] = None
    variables: Optional[ScriptVariables] = None


class GuardrailConfigUpdate(BaseModel):
    forbidden_topics: Optional[List[str]] = None
    must_include_disclaimer: Optional[str] = None
    escalation_triggers: Optional[EscalationTriggers] = None
    max_conversation_turns: Optional[int] = None
    max_call_duration_seconds: Optional[int] = None
    max_response_words: Optional[int] = None
    tone: Optional[str] = None


class CallLogFilter(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    intent: Optional[CallIntent] = None
    flagged_only: bool = False
    claim_id: Optional[str] = None
    limit: int = 50
    offset: int = 0

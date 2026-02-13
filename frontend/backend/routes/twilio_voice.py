"""
Twilio Voice Routes
Handles inbound voice calls for Eden Voice Assistant
"""

import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Response
from fastapi.responses import PlainTextResponse
from twilio.twiml.voice_response import VoiceResponse, Gather
from dependencies import db
from voice_models import (
    AssistantConfig, ScriptSet, GuardrailConfig, CallLog, 
    CallIntent, AppointmentAction, AssistantMode
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/twilio/voice", tags=["voice"])

# TTS Voice settings
TTS_VOICE = "Polly.Joanna"
TTS_LANGUAGE = "en-US"


async def get_active_assistant_config() -> Optional[AssistantConfig]:
    """Get the current active assistant configuration"""
    config = await db.voice_assistant_config.find_one(
        {"is_active": True},
        {"_id": 0}
    )
    if config:
        return AssistantConfig(**config)
    return None


async def get_active_script_set() -> Optional[ScriptSet]:
    """Get the current active script set"""
    scripts = await db.voice_script_sets.find_one(
        {"is_active": True},
        {"_id": 0}
    )
    if scripts:
        return ScriptSet(**scripts)
    return None


async def get_active_guardrails() -> Optional[GuardrailConfig]:
    """Get the current active guardrail configuration"""
    guardrails = await db.voice_guardrails.find_one(
        {"is_active": True},
        {"_id": 0}
    )
    if guardrails:
        return GuardrailConfig(**guardrails)
    return None


async def match_caller_by_phone(phone_number: str) -> tuple:
    """
    Look up a claim and client by phone number.
    Returns (claim, client) tuple - either can be None.
    """
    # Normalize phone number (remove +1, spaces, dashes)
    normalized = phone_number.replace("+1", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "")
    if len(normalized) == 10:
        normalized = f"+1{normalized}"
    elif not normalized.startswith("+"):
        normalized = f"+{normalized}"
    
    # Try to find client by phone
    client = await db.clients.find_one(
        {"$or": [
            {"phone": phone_number},
            {"phone": normalized},
            {"phone": {"$regex": normalized[-10:]}},
            {"mobile": phone_number},
            {"mobile": normalized}
        ]},
        {"_id": 0}
    )
    
    claim = None
    if client:
        # Find most recent active claim for this client
        claim = await db.claims.find_one(
            {"client_id": client.get("id"), "status": {"$ne": "Closed"}},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        
        # If no active claim, try any claim
        if not claim:
            claim = await db.claims.find_one(
                {"client_id": client.get("id")},
                {"_id": 0},
                sort=[("created_at", -1)]
            )
    
    # Also try to match by claim's client_phone field
    if not claim:
        claim = await db.claims.find_one(
            {"$or": [
                {"client_phone": phone_number},
                {"client_phone": normalized},
                {"client_phone": {"$regex": normalized[-10:]}}
            ]},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
    
    return (claim, client)


async def get_upcoming_appointment(claim_id: str) -> Optional[dict]:
    """
    Check if there's an upcoming appointment for this claim in the next 7 days.
    """
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    week_from_now = now + timedelta(days=7)
    
    appointment = await db.appointments.find_one(
        {
            "claim_id": claim_id,
            "start_time": {"$gte": now.isoformat(), "$lte": week_from_now.isoformat()},
            "status": {"$in": ["scheduled", "pending", "confirmed"]}
        },
        {"_id": 0},
        sort=[("start_time", 1)]
    )
    
    return appointment


def is_within_business_hours(business_hours: dict) -> bool:
    """Check if current time is within business hours"""
    from datetime import datetime
    import pytz
    
    try:
        tz = pytz.timezone(business_hours.get("timezone", "America/New_York"))
        now = datetime.now(tz)
        
        # Check if today is a holiday
        today_str = now.strftime("%Y-%m-%d")
        if today_str in business_hours.get("holidays", []):
            return False
        
        # Get day name
        day_name = now.strftime("%A").lower()
        schedule = business_hours.get("schedule", {}).get(day_name, {})
        
        if not schedule.get("enabled", False):
            return False
        
        # Parse open/close times
        open_time = datetime.strptime(schedule.get("open", "09:00"), "%H:%M").time()
        close_time = datetime.strptime(schedule.get("close", "17:00"), "%H:%M").time()
        current_time = now.time()
        
        return open_time <= current_time <= close_time
        
    except Exception as e:
        logger.error(f"Error checking business hours: {e}")
        return True  # Default to open if error


def fill_script_variables(script: str, variables: dict, **extra) -> str:
    """Fill in script template variables"""
    all_vars = {**variables, **extra}
    result = script
    for key, value in all_vars.items():
        result = result.replace(f"{{{key}}}", str(value) if value else "")
    # Remove any unfilled optional variables
    import re
    result = re.sub(r'\{[^}]+\?\}', '', result)
    return result


def format_appointment_time(appointment: dict) -> str:
    """Format appointment time for TTS"""
    try:
        start_time = datetime.fromisoformat(appointment.get("start_time", "").replace("Z", "+00:00"))
        return start_time.strftime("%A, %B %d at %I:%M %p")
    except:
        return appointment.get("start_time", "your scheduled time")


@router.post("/inbound")
async def handle_inbound_call(request: Request):
    """
    Twilio webhook for inbound voice calls.
    Returns TwiML instructions for how to handle the call.
    """
    try:
        form_data = await request.form()
        call_sid = form_data.get("CallSid", "")
        from_number = form_data.get("From", "")
        to_number = form_data.get("To", "")
        
        logger.info(f"Inbound call: {call_sid} from {from_number} to {to_number}")
        
        # Load configurations
        config = await get_active_assistant_config()
        scripts = await get_active_script_set()
        guardrails = await get_active_guardrails()
        
        # Use defaults if not configured
        if not scripts:
            scripts = ScriptSet(id="default", version=1)
        
        # Check if assistant is enabled
        if not config or not config.enabled:
            return generate_voicemail_response(scripts)
        
        # Check business hours
        if not is_within_business_hours(config.business_hours.dict()):
            return generate_after_hours_response(scripts)
        
        # Look up caller
        claim, client = await match_caller_by_phone(from_number)
        client_name = client.get("name") if client else None
        
        # Log the incoming call
        call_log_id = str(uuid.uuid4())
        await db.voice_call_logs.insert_one({
            "id": call_log_id,
            "call_sid": call_sid,
            "from_number": from_number,
            "to_number": to_number,
            "direction": "inbound",
            "start_time": datetime.now(timezone.utc).isoformat(),
            "matched_claim_id": claim.get("id") if claim else None,
            "matched_client_id": client.get("id") if client else None,
            "matched_client_name": client_name,
            "assistant_config_version": config.version if config else 1,
            "script_set_version": scripts.version,
            "guardrail_config_version": guardrails.version if guardrails else 1,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Check for upcoming appointment (Level 2)
        appointment = None
        if claim and config.mode in [AssistantMode.MESSAGE_PLUS_CONFIRM, AssistantMode.FULL_INTAKE_FUTURE]:
            appointment = await get_upcoming_appointment(claim.get("id"))
        
        # Generate appropriate response
        if appointment:
            return generate_appointment_confirm_response(
                scripts=scripts,
                client_name=client_name or "there",
                appointment=appointment,
                call_log_id=call_log_id
            )
        else:
            return generate_message_taking_response(
                scripts=scripts,
                client_name=client_name,
                call_log_id=call_log_id
            )
            
    except Exception as e:
        logger.error(f"Error handling inbound call: {e}")
        # Return a safe fallback response
        response = VoiceResponse()
        response.say(
            "Thank you for calling Care Claims. We're experiencing technical difficulties. Please try again later or leave a message after the tone.",
            voice=TTS_VOICE, language=TTS_LANGUAGE
        )
        response.record(max_length=60, action="/api/twilio/voice/recording", method="POST")
        return Response(content=str(response), media_type="application/xml")


def generate_voicemail_response(scripts: ScriptSet) -> Response:
    """Generate TwiML for basic voicemail when assistant is disabled"""
    response = VoiceResponse()
    
    voicemail_text = fill_script_variables(
        scripts.voicemail_script,
        scripts.variables.dict()
    )
    
    response.say(voicemail_text, voice=TTS_VOICE, language=TTS_LANGUAGE)
    response.record(
        max_length=60,
        action="/api/twilio/voice/recording",
        method="POST",
        play_beep=True
    )
    response.say(
        fill_script_variables(scripts.goodbye_script, scripts.variables.dict()),
        voice=TTS_VOICE, language=TTS_LANGUAGE
    )
    
    return Response(content=str(response), media_type="application/xml")


def generate_after_hours_response(scripts: ScriptSet) -> Response:
    """Generate TwiML for after-hours calls"""
    response = VoiceResponse()
    
    after_hours_text = fill_script_variables(
        scripts.after_hours_script,
        scripts.variables.dict()
    )
    
    response.say(after_hours_text, voice=TTS_VOICE, language=TTS_LANGUAGE)
    response.pause(length=1)
    response.say(
        fill_script_variables(scripts.voicemail_script, scripts.variables.dict()),
        voice=TTS_VOICE, language=TTS_LANGUAGE
    )
    response.record(
        max_length=60,
        action="/api/twilio/voice/recording",
        method="POST",
        play_beep=True
    )
    response.say(
        fill_script_variables(scripts.goodbye_script, scripts.variables.dict()),
        voice=TTS_VOICE, language=TTS_LANGUAGE
    )
    
    return Response(content=str(response), media_type="application/xml")


def generate_message_taking_response(scripts: ScriptSet, client_name: str = None, call_log_id: str = None) -> Response:
    """Generate TwiML for message-taking flow"""
    response = VoiceResponse()
    
    # Greeting
    greeting = fill_script_variables(
        scripts.greeting_script,
        scripts.variables.dict(),
        caller_name=client_name or "there"
    )
    response.say(greeting, voice=TTS_VOICE, language=TTS_LANGUAGE)
    response.pause(length=1)
    
    # Voicemail prompt
    voicemail = fill_script_variables(
        scripts.voicemail_script,
        scripts.variables.dict()
    )
    response.say(voicemail, voice=TTS_VOICE, language=TTS_LANGUAGE)
    
    # Record message
    action_url = f"/api/twilio/voice/recording?call_log_id={call_log_id}" if call_log_id else "/api/twilio/voice/recording"
    response.record(
        max_length=60,
        action=action_url,
        method="POST",
        play_beep=True,
        timeout=5
    )
    
    # Goodbye
    response.say(
        fill_script_variables(scripts.goodbye_script, scripts.variables.dict()),
        voice=TTS_VOICE, language=TTS_LANGUAGE
    )
    
    return Response(content=str(response), media_type="application/xml")


def generate_appointment_confirm_response(scripts: ScriptSet, client_name: str, appointment: dict, call_log_id: str = None) -> Response:
    """Generate TwiML for appointment confirmation (Level 2)"""
    response = VoiceResponse()
    
    # Build confirmation script
    confirm_text = fill_script_variables(
        scripts.appointment_confirm_script,
        scripts.variables.dict(),
        caller_name=client_name,
        appointment_time=format_appointment_time(appointment),
        address=appointment.get("location", "the property"),
        adjuster_name=appointment.get("adjuster_name", "your adjuster")
    )
    
    # Gather DTMF input
    action_url = f"/api/twilio/voice/appointment-response?call_log_id={call_log_id}&appointment_id={appointment.get('id', '')}"
    gather = Gather(
        num_digits=1,
        action=action_url,
        method="POST",
        timeout=10
    )
    gather.say(confirm_text, voice=TTS_VOICE, language=TTS_LANGUAGE)
    response.append(gather)
    
    # If no response, fallback to message taking
    response.say(
        "I didn't catch that. Let me take a message instead.",
        voice=TTS_VOICE, language=TTS_LANGUAGE
    )
    response.redirect(f"/api/twilio/voice/take-message?call_log_id={call_log_id}", method="POST")
    
    return Response(content=str(response), media_type="application/xml")


@router.post("/appointment-response")
async def handle_appointment_response(request: Request):
    """Handle DTMF response for appointment confirmation"""
    try:
        form_data = await request.form()
        digits = form_data.get("Digits", "")
        call_sid = form_data.get("CallSid", "")
        call_log_id = request.query_params.get("call_log_id")
        appointment_id = request.query_params.get("appointment_id")
        
        logger.info(f"Appointment response: {digits} for call {call_sid}")
        
        scripts = await get_active_script_set()
        if not scripts:
            scripts = ScriptSet(id="default", version=1)
        
        response = VoiceResponse()
        
        if digits == "1":
            # Confirmed
            confirmed_text = fill_script_variables(
                scripts.appointment_confirmed_script,
                scripts.variables.dict(),
                appointment_time="your scheduled time",
                address="the property",
                instructions=""
            )
            response.say(confirmed_text, voice=TTS_VOICE, language=TTS_LANGUAGE)
            
            # Update call log
            if call_log_id:
                await db.voice_call_logs.update_one(
                    {"id": call_log_id},
                    {"$set": {
                        "intent": CallIntent.CONFIRM_YES.value,
                        "intent_confidence": 1.0,
                        "appointment_id": appointment_id,
                        "appointment_action_taken": AppointmentAction.CONFIRMED.value,
                        "follow_up_required": False,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
            
            # Update appointment status
            if appointment_id:
                await db.appointments.update_one(
                    {"id": appointment_id},
                    {"$set": {"status": "confirmed", "confirmed_at": datetime.now(timezone.utc).isoformat()}}
                )
                
        elif digits == "2":
            # Reschedule requested
            reschedule_text = fill_script_variables(
                scripts.reschedule_script,
                scripts.variables.dict(),
                adjuster_name="your adjuster"
            )
            response.say(reschedule_text, voice=TTS_VOICE, language=TTS_LANGUAGE)
            
            # Record their preferred times
            response.record(
                max_length=60,
                action=f"/api/twilio/voice/recording?call_log_id={call_log_id}&intent=reschedule",
                method="POST",
                play_beep=True
            )
            
            # Update call log
            if call_log_id:
                await db.voice_call_logs.update_one(
                    {"id": call_log_id},
                    {"$set": {
                        "intent": CallIntent.RESCHEDULE_REQUEST.value,
                        "intent_confidence": 1.0,
                        "appointment_id": appointment_id,
                        "appointment_action_taken": AppointmentAction.RESCHEDULE_REQUESTED.value,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
        else:
            # Unclear - take message
            response.say(
                "I didn't understand that response. Let me take a message for you.",
                voice=TTS_VOICE, language=TTS_LANGUAGE
            )
            response.redirect(f"/api/twilio/voice/take-message?call_log_id={call_log_id}", method="POST")
        
        # Goodbye
        response.say(
            fill_script_variables(scripts.goodbye_script, scripts.variables.dict()),
            voice=TTS_VOICE, language=TTS_LANGUAGE
        )
        
        return Response(content=str(response), media_type="application/xml")
        
    except Exception as e:
        logger.error(f"Error handling appointment response: {e}")
        response = VoiceResponse()
        response.say("Thank you. Goodbye.", voice=TTS_VOICE, language=TTS_LANGUAGE)
        return Response(content=str(response), media_type="application/xml")


@router.post("/take-message")
async def take_message(request: Request):
    """Fallback endpoint for taking a message"""
    call_log_id = request.query_params.get("call_log_id")
    
    scripts = await get_active_script_set()
    if not scripts:
        scripts = ScriptSet(id="default", version=1)
    
    response = VoiceResponse()
    
    voicemail = fill_script_variables(
        scripts.voicemail_script,
        scripts.variables.dict()
    )
    response.say(voicemail, voice=TTS_VOICE, language=TTS_LANGUAGE)
    
    action_url = f"/api/twilio/voice/recording?call_log_id={call_log_id}" if call_log_id else "/api/twilio/voice/recording"
    response.record(
        max_length=60,
        action=action_url,
        method="POST",
        play_beep=True,
        timeout=5
    )
    
    response.say(
        fill_script_variables(scripts.goodbye_script, scripts.variables.dict()),
        voice=TTS_VOICE, language=TTS_LANGUAGE
    )
    
    return Response(content=str(response), media_type="application/xml")


@router.post("/recording")
async def handle_recording(request: Request):
    """
    Webhook called when recording completes.
    Triggers transcription and summarization.
    """
    try:
        form_data = await request.form()
        call_sid = form_data.get("CallSid", "")
        recording_url = form_data.get("RecordingUrl", "")
        recording_duration = int(form_data.get("RecordingDuration", 0))
        from_number = form_data.get("From", "")
        
        call_log_id = request.query_params.get("call_log_id")
        intent_override = request.query_params.get("intent")
        
        logger.info(f"Recording complete: {call_sid}, duration: {recording_duration}s")
        
        # Update call log with recording info
        update_data = {
            "recording_url": recording_url,
            "recording_duration_seconds": recording_duration,
            "end_time": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": recording_duration,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if intent_override == "reschedule":
            update_data["intent"] = CallIntent.RESCHEDULE_REQUEST.value
        
        if call_log_id:
            await db.voice_call_logs.update_one(
                {"id": call_log_id},
                {"$set": update_data}
            )
        
        # Queue transcription (async - will be processed by worker)
        await db.voice_transcription_queue.insert_one({
            "id": str(uuid.uuid4()),
            "call_log_id": call_log_id,
            "call_sid": call_sid,
            "recording_url": recording_url,
            "from_number": from_number,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Return goodbye TwiML
        scripts = await get_active_script_set()
        if not scripts:
            scripts = ScriptSet(id="default", version=1)
        
        response = VoiceResponse()
        response.say(
            fill_script_variables(scripts.goodbye_script, scripts.variables.dict()),
            voice=TTS_VOICE, language=TTS_LANGUAGE
        )
        
        return Response(content=str(response), media_type="application/xml")
        
    except Exception as e:
        logger.error(f"Error handling recording: {e}")
        response = VoiceResponse()
        response.say("Thank you for your message. Goodbye.", voice=TTS_VOICE, language=TTS_LANGUAGE)
        return Response(content=str(response), media_type="application/xml")


@router.post("/status")
async def handle_call_status(request: Request):
    """Webhook for call status updates from Twilio"""
    try:
        form_data = await request.form()
        call_sid = form_data.get("CallSid", "")
        call_status = form_data.get("CallStatus", "")
        call_duration = form_data.get("CallDuration", "0")
        
        logger.info(f"Call status update: {call_sid} -> {call_status}")
        
        # Update call log if call completed
        if call_status in ["completed", "busy", "no-answer", "failed"]:
            await db.voice_call_logs.update_one(
                {"call_sid": call_sid},
                {"$set": {
                    "end_time": datetime.now(timezone.utc).isoformat(),
                    "duration_seconds": int(call_duration),
                    "call_status": call_status,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        return PlainTextResponse("OK")
        
    except Exception as e:
        logger.error(f"Error handling call status: {e}")
        return PlainTextResponse("OK")

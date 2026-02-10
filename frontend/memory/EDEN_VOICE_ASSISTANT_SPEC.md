# Eden Voice Assistant + Console — Design Specification
## Care Claims Platform — Twilio Voice + Emergent LLM Integration
**Version:** 1.0 | **Date:** February 2026

---

## 1. High-Level Vision

### What the Eden Voice Assistant Should Do in Phase 1 (Next 3-6 Months)

The Eden Voice Assistant is an AI-powered receptionist that answers inbound calls to Care Claims, providing immediate, professional responses even outside business hours. In Phase 1, it will serve as a **smart message-taker** that greets callers warmly, captures their message via recording, transcribes it using Whisper, summarizes it using Emergent LLM, and logs everything to the appropriate claim file—or to an "unmatched calls" queue if no claim is found. It will also be able to handle basic **appointment confirmations** for callers who already have an upcoming inspection scheduled in Google Calendar or Eden, reading a scripted confirmation and capturing a yes/no/reschedule response.

### How It Fits Into Eden's Existing SMS/Bots/Claim Timeline

Voice calls become another channel in Eden's unified communication model. Just like SMS messages appear in the claim's "Messages" tab with direction, timestamp, and content, voice calls will appear as `CallLog` entries with transcripts and AI summaries. Notifications from the Voice Assistant (e.g., "New voicemail from Maria S. about her roof damage claim") will use the existing notification system with type `system` or `comms_bot`. The Communication Assistant Bot can analyze call summaries the same way it analyzes inbound SMS, suggesting follow-up actions to adjusters.

### Philosophy: AI as Receptionist, Not Decision-Maker

The Voice Assistant is a **helper, not an adjuster**. It can:
- ✅ Answer calls professionally and take messages
- ✅ Confirm or reschedule existing appointments
- ✅ Provide basic status updates (scripted, not improvised)
- ✅ Direct callers to leave detailed messages

It **cannot**:
- ❌ Make promises about claim outcomes or timelines
- ❌ Provide legal advice or insurance coverage interpretation
- ❌ Negotiate settlements or authorize payments
- ❌ Make commitments on behalf of adjusters

When uncertain, the assistant must apologize, take a message, and ensure a human follows up.

---

## 2. Capabilities by Phase

### Level 1 — Message Taker (v1 Target)

**What It Does:**
- Answers calls with a Care Claims greeting
- Attempts to match caller phone number to existing claim/client
- Records the caller's message (30-60 seconds max)
- Transcribes using Whisper, summarizes using Emergent LLM
- Logs everything to claim timeline or "unmatched calls" queue
- Sends notification to assigned adjuster (or office queue)

**User Value:**
- Clients get immediate acknowledgment instead of voicemail
- Adjusters get summarized messages, not raw audio to review
- No missed calls during field work or after hours

**Scope:** Medium (2-3 weeks of development)

**Risks & Guardrails:**
- **Risk:** Caller expects live conversation, gets frustrated with recording
- **Guardrail:** Clear upfront messaging: "I'll take a message and have someone call you back within [timeframe]"
- **Risk:** Transcription errors lead to incorrect summaries
- **Guardrail:** Always store raw audio as backup; flag low-confidence transcriptions

---

### Level 2 — Appointment Confirmer (v1 Subset)

**What It Does:**
- In addition to Level 1, checks if caller has an upcoming appointment (within 7 days)
- If yes, reads a scripted confirmation: "Hi [Name], I'm calling from Care Claims to confirm your appointment for [date] at [time] at [address]. Can you confirm you'll be there?"
- Captures response via DTMF ("Press 1 to confirm, 2 to reschedule") or simple speech recognition ("yes/no")
- If confirmed: Updates appointment status, logs confirmation
- If reschedule: Takes message about preferred times, notifies adjuster

**User Value:**
- Proactive confirmation reduces no-shows
- Frees adjusters from confirmation call duty
- Clients appreciate the professional follow-up

**Scope:** Medium (additional 1-2 weeks on top of Level 1)

**Risks & Guardrails:**
- **Risk:** Caller wants to change location or add people to appointment
- **Guardrail:** Anything beyond yes/no/reschedule → take message, escalate to human
- **Risk:** Wrong person answers (family member, etc.)
- **Guardrail:** "Is this [Client Name]?" verification before proceeding

---

### Level 3 — Guided Q&A (Future)

**What It Does:**
- Answers basic FAQs about the claims process
- Asks structured intake questions for new callers (name, address, type of damage)
- Provides limited status updates based on claim stage

**User Value:**
- Self-service for common questions
- Intake capture without adjuster involvement

**Scope:** Large (significant prompt engineering, safety work)

**Risks & Guardrails:**
- **Risk:** AI improvises answers that are incorrect or create liability
- **Guardrail:** Strictly templated responses only; any deviation → "Let me have someone call you back"
- **Risk:** Complex edge cases the AI can't handle
- **Guardrail:** Intent detection + mandatory escalation triggers

**Status:** FUTURE — Not in v1

---

## 3. Voice Assistant Console — Data Model

### 3.1 AssistantConfig

```typescript
interface AssistantConfig {
  id: string;                           // UUID
  version: number;                      // Auto-incrementing version
  
  // Operating Mode
  mode: "message_only" | "message_plus_confirm" | "full_intake_future";
  enabled: boolean;                     // Master on/off switch
  
  // Business Hours
  business_hours: {
    timezone: string;                   // "America/New_York"
    schedule: {
      monday: { open: string; close: string; enabled: boolean };    // "09:00", "17:00"
      tuesday: { open: string; close: string; enabled: boolean };
      wednesday: { open: string; close: string; enabled: boolean };
      thursday: { open: string; close: string; enabled: boolean };
      friday: { open: string; close: string; enabled: boolean };
      saturday: { open: string; close: string; enabled: boolean };
      sunday: { open: string; close: string; enabled: boolean };
    };
    holidays: string[];                 // ISO dates: ["2026-12-25", "2026-01-01"]
  };
  
  // Behavior Flags
  behavior_flags: {
    allow_small_talk: boolean;          // Default: false
    allow_reschedule: boolean;          // Default: true (for Level 2)
    allow_faq: boolean;                 // Default: false (Level 3)
    allow_status_updates: boolean;      // Default: false (Level 3)
    require_verification: boolean;      // Default: true — "Is this [Name]?"
    play_hold_music: boolean;           // Default: false
  };
  
  // LLM Aggressiveness (0-1 slider)
  // 0 = Strictly follow scripts, never deviate
  // 0.5 = Allow minor variations in wording
  // 1 = Full conversational freedom (NOT RECOMMENDED)
  llm_aggressiveness: number;           // Default: 0.2
  
  // Limits
  max_recording_seconds: number;        // Default: 60
  max_conversation_turns: number;       // Default: 3 (for Level 2+)
  
  // Twilio Configuration
  twilio_numbers: string[];             // ["+18448215610"]
  callback_number: string;              // Number to display for callbacks
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
}
```

### 3.2 ScriptSet

```typescript
interface ScriptSet {
  id: string;
  version: number;
  name: string;                         // "Default Scripts", "Holiday Scripts"
  
  // Core Scripts (with variable placeholders)
  greeting_script: string;
  // Example: "Hello! Thank you for calling {company_name}. This is Eve, your virtual assistant. How can I help you today?"
  
  voicemail_script: string;
  // Example: "I'd like to take a message for you. Please leave your message after the tone, including your name and the best number to reach you. Someone will call you back within {callback_window}."
  
  after_hours_script: string;
  // Example: "Thank you for calling {company_name}. Our office is currently closed. Our hours are {business_hours}. Please leave a message and we'll return your call on the next business day."
  
  appointment_confirm_script: string;
  // Example: "Hi {caller_name}, this is Eve calling from {company_name}. I'm reaching out to confirm your appointment scheduled for {appointment_time} at {address}. Will you be available at that time? Press 1 to confirm, or press 2 if you need to reschedule."
  
  appointment_confirmed_script: string;
  // Example: "Great! Your appointment is confirmed. We'll see you on {appointment_time} at {address}. {instructions} Have a blessed day!"
  
  reschedule_script: string;
  // Example: "No problem! Please leave a message with your preferred days and times, and {adjuster_name} will call you back to reschedule."
  
  fallback_script: string;
  // Example: "I want to make sure we help you properly. Let me take a message and have one of our team members call you back. Please leave your message after the tone."
  
  goodbye_script: string;
  // Example: "Thank you for calling {company_name}. Have a blessed day!"
  
  // Variable Definitions
  variables: {
    company_name: string;               // "Care Claims"
    callback_window: string;            // "24 hours"
    business_hours: string;             // "Monday-Friday, 9 AM to 5 PM Eastern"
  };
  
  // Metadata
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### 3.3 GuardrailConfig

```typescript
interface GuardrailConfig {
  id: string;
  version: number;
  
  // Forbidden Topics — AI must not discuss these
  forbidden_topics: string[];
  // ["legal advice", "settlement amounts", "coverage determination", "lawsuit", "attorney recommendation", "guaranteed outcomes", "specific timelines"]
  
  // Required Disclaimer
  must_include_disclaimer: string;
  // "Please note that I'm an automated assistant. For specific questions about your claim, one of our licensed adjusters will follow up with you."
  
  // Escalation Triggers — When to immediately take message and end
  escalation_triggers: {
    keywords: string[];                 // ["lawyer", "sue", "complaint", "supervisor", "emergency"]
    intents: string[];                  // ["angry", "urgent", "complex_question"]
    confidence_threshold: number;       // Below this → escalate (default: 0.6)
  };
  
  // Conversation Limits
  max_conversation_turns: number;       // Default: 3
  max_call_duration_seconds: number;    // Default: 180 (3 minutes)
  
  // Response Constraints
  max_response_words: number;           // Default: 50 (keep TTS responses short)
  tone: "professional" | "warm" | "empathetic";  // Default: "warm"
  
  // Safety Defaults
  always_offer_callback: boolean;       // Default: true
  always_log_full_transcript: boolean;  // Default: true
  require_human_review_flags: string[]; // ["low_confidence", "escalation", "complaint"]
  
  created_at: string;
  updated_at: string;
}
```

### 3.4 CallLog

```typescript
interface CallLog {
  id: string;                           // UUID
  call_sid: string;                     // Twilio Call SID
  
  // Call Metadata
  from_number: string;                  // Caller's phone
  to_number: string;                    // Care Claims number
  direction: "inbound" | "outbound";
  start_time: string;                   // ISO datetime
  end_time: string;
  duration_seconds: number;
  
  // Matching
  matched_claim_id: string | null;
  matched_client_id: string | null;
  matched_client_name: string | null;
  
  // Content
  raw_transcript: string;               // Full Whisper transcription
  ai_summary: string;                   // 1-3 sentence summary from Emergent
  
  // Intent Classification
  intent: "message" | "confirm_yes" | "confirm_no" | "reschedule_request" | 
          "status_inquiry" | "complaint" | "other";
  intent_confidence: number;            // 0-1
  
  // For Appointment Calls
  appointment_id: string | null;
  appointment_action_taken: "confirmed" | "reschedule_requested" | "no_action" | null;
  
  // Configuration Used (for auditing)
  assistant_config_version: number;
  script_set_version: number;
  guardrail_config_version: number;
  
  // Internal Actions
  follow_up_required: boolean;
  follow_up_assigned_to: string | null;
  follow_up_completed: boolean;
  follow_up_notes: string | null;
  
  // Flags
  flagged_for_review: boolean;
  flag_reasons: string[];               // ["low_confidence", "escalation_keyword"]
  
  // Recording
  recording_url: string | null;         // Twilio recording URL
  recording_duration_seconds: number;
  
  // Communication Event Link
  communication_event_id: string;       // Links to unified communications model
  
  created_at: string;
  updated_at: string;
}
```

### How These Models Tie Into Eden's Unified Communication Model

When a call is completed:
1. A `CallLog` record is created with full details
2. A `communication_event` record is created with:
   - `channel: "call"`
   - `direction: "inbound"`
   - `body: ai_summary`
   - `metadata: { call_log_id, transcript, recording_url }`
3. The `communication_event` appears in the claim's timeline alongside SMS and future email
4. If follow-up is needed, a `notification` is created for the adjuster with type `system` or `comms_bot`

---

## 4. Twilio Voice + Backend Architecture

### Call Flow Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         INBOUND CALL FLOW                               │
└─────────────────────────────────────────────────────────────────────────┘

[Caller] ──dial──> [Twilio Number +18448215610]
                            │
                            ▼
              ┌─────────────────────────────┐
              │ Twilio sends webhook to:    │
              │ POST /api/twilio/voice/     │
              │       inbound               │
              └─────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │ Backend: Look up caller     │
              │ by phone number             │
              │ → Match to claim/client?    │
              └─────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
         [MATCHED]                   [NOT MATCHED]
              │                           │
              ▼                           ▼
    ┌─────────────────┐         ┌─────────────────┐
    │ Load claim info │         │ Generic greeting│
    │ Check for       │         │ Take message    │
    │ appointment     │         │ Queue for       │
    └─────────────────┘         │ manual review   │
              │                 └─────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
[HAS APPT]         [NO APPT]
    │                   │
    ▼                   ▼
┌─────────────┐   ┌─────────────┐
│ Appointment │   │ Message-    │
│ Confirm     │   │ taking flow │
│ Script      │   └─────────────┘
│ (Level 2)   │         │
└─────────────┘         │
    │                   │
    ▼                   ▼
┌─────────────────────────────────────┐
│ Capture response:                   │
│ - DTMF (Press 1/2)                  │
│ - OR Record voicemail               │
└─────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ POST /api/twilio/     │
        │      voice/recording  │
        │ Webhook with audio    │
        └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ Whisper Transcription │
        │ → Emergent Summary    │
        │ → Intent Detection    │
        └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ Create CallLog        │
        │ Create CommEvent      │
        │ Send Notification     │
        │ Update Appointment    │
        │ (if applicable)       │
        └───────────────────────┘
                    │
                    ▼
              [CALL ENDS]
```

### 4.1 Inbound Call Handling

**Endpoint:** `POST /api/twilio/voice/inbound`

```python
@router.post("/twilio/voice/inbound")
async def handle_inbound_call(request: Request):
    """
    Twilio webhook for inbound calls.
    Returns TwiML instructions for how to handle the call.
    """
    form_data = await request.form()
    call_sid = form_data.get("CallSid")
    from_number = form_data.get("From")
    to_number = form_data.get("To")
    
    # Load current configuration
    config = await get_active_assistant_config()
    scripts = await get_active_script_set()
    guardrails = await get_active_guardrail_config()
    
    # Check if assistant is enabled
    if not config.enabled:
        return generate_voicemail_twiml(scripts.voicemail_script)
    
    # Check business hours
    if not is_within_business_hours(config.business_hours):
        return generate_after_hours_twiml(scripts.after_hours_script)
    
    # Look up caller
    claim, client = await match_caller_by_phone(from_number)
    
    # Check for upcoming appointment (Level 2)
    appointment = None
    if claim and config.mode in ["message_plus_confirm", "full_intake_future"]:
        appointment = await get_upcoming_appointment(claim.id)
    
    # Generate appropriate TwiML response
    if appointment and is_confirmation_due(appointment):
        return generate_appointment_confirm_twiml(
            scripts=scripts,
            client_name=client.name,
            appointment=appointment
        )
    else:
        return generate_message_taking_twiml(
            scripts=scripts,
            client_name=client.name if client else None,
            claim=claim
        )
```

### 4.2 Greeting & Scripting (TwiML Generation)

```python
def generate_message_taking_twiml(scripts: ScriptSet, client_name: str = None, claim = None):
    """
    Generate TwiML for message-taking flow.
    """
    # Fill in script variables
    greeting = scripts.greeting_script.format(
        company_name=scripts.variables["company_name"],
        caller_name=client_name or "there"
    )
    
    voicemail_prompt = scripts.voicemail_script.format(
        callback_window=scripts.variables["callback_window"]
    )
    
    # Build TwiML
    response = VoiceResponse()
    
    # Greeting
    response.say(greeting, voice="Polly.Joanna", language="en-US")
    response.pause(length=1)
    
    # Voicemail prompt
    response.say(voicemail_prompt, voice="Polly.Joanna", language="en-US")
    
    # Record message
    response.record(
        action="/api/twilio/voice/recording",
        method="POST",
        max_length=60,
        timeout=5,
        transcribe=False,  # We'll use Whisper instead
        play_beep=True
    )
    
    # Goodbye
    response.say(scripts.goodbye_script.format(
        company_name=scripts.variables["company_name"]
    ), voice="Polly.Joanna")
    
    return Response(content=str(response), media_type="application/xml")


def generate_appointment_confirm_twiml(scripts: ScriptSet, client_name: str, appointment):
    """
    Generate TwiML for appointment confirmation (Level 2).
    """
    confirm_script = scripts.appointment_confirm_script.format(
        caller_name=client_name,
        company_name=scripts.variables["company_name"],
        appointment_time=format_appointment_time(appointment),
        address=appointment.location,
        adjuster_name=appointment.adjuster_name
    )
    
    response = VoiceResponse()
    
    # Ask for confirmation
    gather = response.gather(
        num_digits=1,
        action="/api/twilio/voice/appointment-response",
        method="POST",
        timeout=10
    )
    gather.say(confirm_script, voice="Polly.Joanna", language="en-US")
    
    # If no response, repeat once then take message
    response.say("I didn't catch that. Let me take a message instead.", voice="Polly.Joanna")
    response.redirect("/api/twilio/voice/take-message")
    
    return Response(content=str(response), media_type="application/xml")
```

### 4.3 Recording and Transcription

**Endpoint:** `POST /api/twilio/voice/recording`

```python
@router.post("/twilio/voice/recording")
async def handle_recording(request: Request):
    """
    Webhook called when recording completes.
    Triggers transcription and summarization.
    """
    form_data = await request.form()
    call_sid = form_data.get("CallSid")
    recording_url = form_data.get("RecordingUrl")
    recording_duration = int(form_data.get("RecordingDuration", 0))
    from_number = form_data.get("From")
    
    # Download recording from Twilio
    audio_content = await download_twilio_recording(recording_url)
    
    # Transcribe with Whisper
    transcript = await transcribe_with_whisper(audio_content)
    
    # Get claim/client context
    claim, client = await match_caller_by_phone(from_number)
    
    # Summarize and classify with Emergent
    ai_result = await process_voice_message(
        transcript=transcript,
        claim_context=claim.dict() if claim else None,
        client_name=client.name if client else None
    )
    
    # Create CallLog
    call_log = await create_call_log(
        call_sid=call_sid,
        from_number=from_number,
        recording_url=recording_url,
        recording_duration=recording_duration,
        transcript=transcript,
        ai_summary=ai_result["summary"],
        intent=ai_result["intent"],
        intent_confidence=ai_result["confidence"],
        matched_claim_id=claim.id if claim else None,
        matched_client_id=client.id if client else None
    )
    
    # Create communication event for claim timeline
    if claim:
        await create_communication_event(
            claim_id=claim.id,
            channel="call",
            direction="inbound",
            body=ai_result["summary"],
            metadata={
                "call_log_id": call_log.id,
                "transcript": transcript,
                "recording_url": recording_url,
                "intent": ai_result["intent"]
            }
        )
    
    # Send notification to adjuster
    await notify_about_voicemail(
        call_log=call_log,
        claim=claim,
        client=client
    )
    
    # Return goodbye TwiML
    scripts = await get_active_script_set()
    response = VoiceResponse()
    response.say(scripts.goodbye_script.format(
        company_name=scripts.variables["company_name"]
    ), voice="Polly.Joanna")
    
    return Response(content=str(response), media_type="application/xml")
```

### 4.4 LLM Processing

```python
async def process_voice_message(
    transcript: str,
    claim_context: dict = None,
    client_name: str = None
) -> dict:
    """
    Use Emergent LLM to summarize and classify the voice message.
    Returns: { summary, intent, confidence, follow_up_actions }
    """
    from services.ai_service import generate, AIRequest
    
    # Build context
    context = ""
    if claim_context:
        context += f"\nClaim: {claim_context.get('claim_number')} - {claim_context.get('claim_type')}"
        context += f"\nStatus: {claim_context.get('status')}"
    if client_name:
        context += f"\nCaller: {client_name}"
    
    # Call shared AI service
    result = await generate(AIRequest(
        prompt_type="voice_message_summary",
        user_message=f"TRANSCRIPT:\n{transcript}\n\nCONTEXT:{context}",
        channel="voice",
        user_id="system-voice-assistant",
        claim_context=claim_context
    ))
    
    # Parse response (AI returns structured JSON)
    return {
        "summary": result.draft_text,
        "intent": extract_intent(result),
        "confidence": result.confidence,
        "follow_up_actions": result.suggested_actions
    }
```

### 4.5 Logging & Notifications

```python
async def notify_about_voicemail(call_log: CallLog, claim, client):
    """
    Create notification for adjuster about new voicemail.
    """
    from routes.notifications import create_notification
    
    # Determine recipient
    if claim and claim.assigned_to_id:
        user_id = claim.assigned_to_id
    else:
        user_id = await get_office_manager_id()  # Fallback to office queue
    
    # Build notification
    title = f"📞 Voicemail from {client.name if client else 'Unknown Caller'}"
    
    body = f"{call_log.ai_summary}"
    if call_log.flagged_for_review:
        body += f"\n⚠️ Flagged: {', '.join(call_log.flag_reasons)}"
    
    cta_route = f"/claims/{claim.id}?tab=messages" if claim else "/voice-assistant/calls"
    
    await create_notification(
        user_id=user_id,
        type="system",
        title=title,
        body=body,
        cta_label="Listen & Respond",
        cta_route=cta_route,
        data={
            "call_log_id": call_log.id,
            "recording_url": call_log.recording_url,
            "intent": call_log.intent
        }
    )
```

---

## 5. LLM Prompts & Guardrails

### 5.1 Voice Message Summarization + Intent Detection

```python
VOICE_MESSAGE_SUMMARY_PROMPT = """You are analyzing a transcribed voicemail for Care Claims, a public adjusting firm.

TRANSCRIPT:
{transcript}

CALLER CONTEXT:
{claim_context}

YOUR TASK:
1. Write a 1-3 sentence summary of what the caller wants
2. Classify the caller's intent
3. Suggest any follow-up actions for the adjuster

INTENT OPTIONS:
- "message" — General message, no specific request
- "status_inquiry" — Asking about claim status
- "confirm_yes" — Confirming an appointment
- "confirm_no" — Declining/can't make appointment
- "reschedule_request" — Wants to change appointment time
- "complaint" — Expressing dissatisfaction
- "urgent" — Time-sensitive matter
- "other" — Doesn't fit other categories

GUARDRAILS:
{guardrail_config}

RESPONSE FORMAT (JSON):
{{
  "summary": "Brief summary of the message",
  "intent": "one of the intent options",
  "confidence": 0.0-1.0,
  "follow_up_actions": ["action 1", "action 2"],
  "flags": ["any concerns or keywords detected"]
}}

Important:
- Be concise — summaries should be 1-3 sentences max
- Preserve key details: names, dates, phone numbers, specific requests
- Flag any mentions of: {forbidden_topics}
- If transcript is unclear or garbled, set confidence low and note in flags"""
```

### 5.2 Appointment Confirmation Interpretation

```python
APPOINTMENT_CONFIRM_PROMPT = """You are interpreting a caller's response to an appointment confirmation call.

APPOINTMENT DETAILS:
- Date/Time: {appointment_time}
- Location: {address}
- Adjuster: {adjuster_name}

CALLER'S RESPONSE:
{transcript}

Determine if the caller:
1. CONFIRMED the appointment (yes, okay, I'll be there, sounds good, etc.)
2. DECLINED or CAN'T MAKE IT (no, can't make it, busy, etc.)
3. WANTS TO RESCHEDULE (different day, can we change, etc.)
4. UNCLEAR — couldn't determine intent

RESPONSE FORMAT (JSON):
{{
  "interpretation": "confirm_yes" | "confirm_no" | "reschedule_request" | "unclear",
  "confidence": 0.0-1.0,
  "caller_notes": "Any additional details mentioned (e.g., 'will arrive 10 min late')",
  "preferred_times": ["If reschedule, any times mentioned"]
}}

Be generous in interpretation — if it sounds like a yes, treat as confirmed.
If truly unclear, default to "unclear" and take a message."""
```

### 5.3 Enforcing Guardrails in Prompts

```python
def build_guardrail_section(guardrails: GuardrailConfig) -> str:
    """
    Build the guardrail section to inject into prompts.
    """
    sections = []
    
    # Forbidden topics
    if guardrails.forbidden_topics:
        sections.append(f"DO NOT discuss or make statements about: {', '.join(guardrails.forbidden_topics)}")
    
    # Escalation keywords
    if guardrails.escalation_triggers.keywords:
        sections.append(f"FLAG if caller mentions: {', '.join(guardrails.escalation_triggers.keywords)}")
    
    # Tone
    tone_instructions = {
        "professional": "Use clear, factual language",
        "warm": "Be friendly and reassuring, use 'we' language",
        "empathetic": "Acknowledge caller's situation, show understanding"
    }
    sections.append(tone_instructions.get(guardrails.tone, tone_instructions["warm"]))
    
    # Response length
    sections.append(f"Keep responses under {guardrails.max_response_words} words")
    
    # Mandatory disclaimer
    if guardrails.must_include_disclaimer:
        sections.append(f"If asked about specific claim details, include: '{guardrails.must_include_disclaimer}'")
    
    return "\n".join(f"- {s}" for s in sections)
```

---

## 6. Voice Assistant Console — UI Specification

### 6.1 Main "Voice Assistant" Page (`/voice-assistant`)

**Overview Panel:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ 📞 VOICE ASSISTANT                                          [ON] 🟢    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Mode: Message + Confirm          Business Hours: 9 AM - 5 PM ET       │
│  Active Number: +1 (844) 821-5610    Today: Within Hours               │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  📥 12 Calls    │  │  ✅ 8 Matched   │  │  ⚠️ 2 Flagged  │         │
│  │  Today          │  │  to Claims      │  │  for Review     │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                         │
│  Last 10 Calls:                                                        │
│  ┌───────────────────────────────────────────────────────────────┐     │
│  │ 📞 Maria S. • 2:34 PM • Claim #CLM-2026-0045 • Message        │     │
│  │    "Asking about timeline for roof inspection..."              │     │
│  ├───────────────────────────────────────────────────────────────┤     │
│  │ 📞 John D. • 1:15 PM • Claim #CLM-2026-0032 • Confirmed ✅    │     │
│  │    "Confirmed appointment for tomorrow at 10 AM"               │     │
│  ├───────────────────────────────────────────────────────────────┤     │
│  │ 📞 Unknown • 11:45 AM • No Match • Message                    │     │
│  │    "New caller asking about storm damage claim process..."     │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  [View All Calls]                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Components:**
- `VoiceAssistantHeader` — Title, master toggle, status indicator
- `QuickStatsCards` — Today's call count, matched %, flagged count
- `RecentCallsList` — Last 10 calls with summary preview
- State: `{ assistantEnabled, config, recentCalls, stats }`

### 6.2 Configuration Tabs

**Tab: Scripts**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Scripts                                                    [Save] [Reset]│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Greeting Script:                                                       │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Hello! Thank you for calling {company_name}. This is Eve, your   │ │
│  │ virtual assistant. How can I help you today?                      │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│  Variables: {company_name}, {caller_name?}                              │
│                                                                         │
│  Voicemail Script:                                                      │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ I'd like to take a message for you. Please leave your message    │ │
│  │ after the tone, including your name and the best number to reach │ │
│  │ you. Someone will call you back within {callback_window}.        │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  [+ More Scripts...]                                                    │
│                                                                         │
│  Preview: [▶️ Play TTS Preview]                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Tab: Behavior & Guardrails**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Behavior & Guardrails                                      [Save]       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Operating Mode:                                                        │
│  ○ Message Only (Level 1)                                              │
│  ● Message + Appointment Confirm (Level 2)                             │
│  ○ Full Q&A (Coming Soon)                                              │
│                                                                         │
│  LLM Aggressiveness: [====○=====] 0.2                                  │
│  (Lower = strictly follow scripts, Higher = more conversational)        │
│                                                                         │
│  Behavior Toggles:                                                      │
│  [ ] Allow small talk                                                   │
│  [✓] Require caller verification ("Is this [Name]?")                   │
│  [✓] Allow reschedule requests                                         │
│  [ ] Allow FAQ answers (Level 3)                                       │
│                                                                         │
│  Forbidden Topics:                                                      │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ legal advice, settlement amounts, coverage determination,         │ │
│  │ lawsuit, attorney recommendation, guaranteed outcomes             │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│  [+ Add Topic]                                                          │
│                                                                         │
│  Escalation Keywords (immediately take message):                        │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ lawyer, sue, complaint, supervisor, emergency, urgent             │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Max Recording: [60] seconds    Max Conversation Turns: [3]            │
└─────────────────────────────────────────────────────────────────────────┘
```

**Tab: Numbers & Routing**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Numbers & Routing                                          [Save]       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Active Twilio Numbers:                                                 │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ +1 (844) 821-5610  [Primary] [✓ Voice Assistant Enabled]         │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Business Hours:                                                        │
│  Timezone: [America/New_York ▼]                                        │
│                                                                         │
│  │ Day       │ Enabled │ Open  │ Close │                               │
│  │ Monday    │   [✓]   │ 09:00 │ 17:00 │                               │
│  │ Tuesday   │   [✓]   │ 09:00 │ 17:00 │                               │
│  │ Wednesday │   [✓]   │ 09:00 │ 17:00 │                               │
│  │ Thursday  │   [✓]   │ 09:00 │ 17:00 │                               │
│  │ Friday    │   [✓]   │ 09:00 │ 17:00 │                               │
│  │ Saturday  │   [ ]   │ --:-- │ --:-- │                               │
│  │ Sunday    │   [ ]   │ --:-- │ --:-- │                               │
│                                                                         │
│  Holidays (office closed):                                              │
│  [2026-12-25] [2027-01-01] [+ Add Holiday]                             │
│                                                                         │
│  After-Hours Routing:                                                   │
│  ● Play after-hours script + take voicemail                            │
│  ○ Forward to cell: [+1 ___-___-____]                                  │
│  ○ Forward to answering service                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

**Tab: Review Calls**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Review Calls                                     [Export] [Filter ▼]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Filters: [All ▼] [Last 7 Days ▼] [Any Intent ▼] [Flagged Only □]     │
│                                                                         │
│  │ Time     │ Caller       │ Claim        │ Intent    │ Duration │ ⚠️ │ │
│  │ 2:34 PM  │ Maria S.     │ CLM-2026-45  │ Message   │ 0:45     │    │ │
│  │ 1:15 PM  │ John D.      │ CLM-2026-32  │ Confirmed │ 0:23     │    │ │
│  │ 11:45 AM │ Unknown      │ —            │ Message   │ 1:02     │ ⚠️ │ │
│  │ 10:30 AM │ Sarah W.     │ CLM-2026-28  │ Reschedule│ 0:38     │    │ │
│  │ 9:15 AM  │ Mike T.      │ CLM-2026-51  │ Complaint │ 1:45     │ ⚠️ │ │
│                                                                         │
│  [< Prev]  Page 1 of 12  [Next >]                                      │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Call Details                                                    [✕]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📞 Maria S. • February 5, 2026 at 2:34 PM                             │
│  Claim: CLM-2026-0045 (Roof Damage - Hurricane)                        │
│  Duration: 45 seconds                                                   │
│                                                                         │
│  ▶️ [Play Recording]  ━━━━━━━━━○━━━━━━━━━━  0:00 / 0:45               │
│                                                                         │
│  AI Summary:                                                            │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Caller asking about timeline for roof inspection. Mentioned she   │ │
│  │ needs to coordinate with her contractor. Wants callback today.    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Full Transcript:                                                       │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ "Hi, this is Maria. I'm calling about my claim, the roof damage  │ │
│  │ from the hurricane. I was wondering when you might be able to    │ │
│  │ come out and do the inspection? My contractor is asking and I    │ │
│  │ need to coordinate schedules. If someone could call me back      │ │
│  │ today that would be great. My number is 305-555-1234. Thanks."   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Intent: Message (Confidence: 92%)                                      │
│  Follow-up: Required [✓]  Assigned to: [John Smith ▼]                  │
│  Notes: [_________________________________________________]            │
│                                                                         │
│  [Mark Complete]  [Create Task]  [Call Back]                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Versioning

**How Config Versioning Works:**

1. **Auto-increment on save:** When any config (AssistantConfig, ScriptSet, GuardrailConfig) is saved, a new version is created with an incremented version number.

2. **CallLog references versions:** Each `CallLog` stores `assistant_config_version`, `script_set_version`, and `guardrail_config_version` so we know exactly what settings were active during that call.

3. **Rollback capability:** Admin can view version history and restore a previous version if needed.

4. **Version history UI:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Script Version History                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│ │ Version │ Changed By    │ Date       │ Changes                    │  │
│ │ v3      │ John Smith    │ Feb 5      │ Updated greeting           │  │
│ │ v2      │ Sarah Jones   │ Feb 3      │ Added holiday script       │  │
│ │ v1      │ System        │ Feb 1      │ Initial version            │  │
│                                                                         │
│ [View v3] [Restore v2] [Compare v2 ↔ v3]                               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Safety and Limitations

### Risks If the Assistant Over-Promises or Misinterprets

1. **Legal Liability:** If the AI makes promises about claim outcomes ("You'll definitely get paid"), this could create legal exposure for Care Claims.

2. **Client Expectations:** Misinterpreted messages could lead to missed appointments, delayed follow-ups, or angry clients.

3. **Regulatory Concerns:** Public adjusters are licensed professionals. An AI cannot and should not perform licensed activities.

4. **Reputation Damage:** A poorly handled call could damage Care Claims' brand as a "stewardship and excellence" firm.

### Mitigation Strategies

**1. Strict Guardrails:**
- Forbidden topic list is enforced in every LLM prompt
- Escalation keywords trigger immediate message-taking mode
- Low confidence threshold triggers human review flag

**2. Limiting to Level 1/2 Initially:**
- No improvised answers in v1
- Only scripted responses and message-taking
- Appointment confirmation is binary (yes/no/reschedule) — no negotiation

**3. Clear Escalation Rules:**
```
IF confidence < 0.6:
    → "I want to make sure we help you properly. Let me take a message..."
    → Flag for human review

IF escalation_keyword_detected:
    → "I understand. Let me have a team member call you right back..."
    → Flag as urgent, notify immediately

IF max_turns_reached:
    → "To give you the best help, let me take your message..."
    → End gracefully
```

**4. Human Oversight:**
- All flagged calls require human review before closing
- Daily digest of all calls to office manager
- Quarterly review of AI summaries vs. actual recordings

### "Do Not Cross" Lines for AI in Public Adjusting

| ❌ NEVER | ✅ ALWAYS |
|----------|-----------|
| Make promises about claim outcomes | Defer to licensed adjusters for details |
| Provide legal advice | Suggest caller consult an attorney |
| Interpret insurance policy language | Take message and escalate |
| Quote settlement amounts | Say "a team member will discuss that with you" |
| Guarantee timelines | Use "typically" or "we aim to" language |
| Make commitments on adjuster's behalf | Offer to take a message |
| Handle complaints autonomously | Flag and escalate immediately |

---

## 8. Implementation Roadmap (4-8 Weeks)

### Phase 1: Foundation (Week 1-2)

| # | Task | Area | Description | Dependencies |
|---|------|------|-------------|--------------|
| 1 | Create MongoDB schemas | `backend` | Implement `AssistantConfig`, `ScriptSet`, `GuardrailConfig`, `CallLog` models in `/app/backend/models/voice_assistant.py` | None |
| 2 | Create seed data | `backend` | Default scripts, guardrails, and config; migration script | Task 1 |
| 3 | Implement `/api/twilio/voice/inbound` webhook | `backend` | Basic endpoint that returns TwiML greeting + recording | Task 1 |
| 4 | Implement phone number matching | `backend` | Look up claims/clients by `from_number`, return match or null | None |
| 5 | Add Twilio Voice dependency | `infra` | Add `twilio` to requirements.txt, configure Voice webhook URL in Twilio console | None |

### Phase 2: Core Voice Flow (Week 2-3)

| # | Task | Area | Description | Dependencies |
|---|------|------|-------------|--------------|
| 6 | Build TwiML generation helpers | `backend` | Functions for greeting, recording, goodbye TwiML; use `twilio.twiml.voice_response` | Task 3 |
| 7 | Implement `/api/twilio/voice/recording` webhook | `backend` | Handle recording complete, download audio, store metadata | Task 6 |
| 8 | Integrate Whisper transcription | `backend` | Use Emergent Whisper to transcribe recordings; handle errors gracefully | Task 7 |
| 9 | Add voice summarization prompt to AI service | `backend` | Add `voice_message_summary` prompt type to `/app/backend/services/ai_service.py` | Task 8 |
| 10 | Create CallLog on call completion | `backend` | Store all call data, link to claim if matched | Tasks 7, 9 |
| 11 | Create communication event | `backend` | Add `channel: "call"` event to unified communications; link to CallLog | Task 10 |
| 12 | Send notification to adjuster | `backend` | Use existing notification system with call summary | Task 10 |

### Phase 3: Level 2 - Appointment Confirmation (Week 3-4)

| # | Task | Area | Description | Dependencies |
|---|------|------|-------------|--------------|
| 13 | Check for upcoming appointments | `backend` | Query Google Calendar / Eden for appointments in next 7 days for caller | Task 4 |
| 14 | Build appointment confirm TwiML | `backend` | DTMF gather (Press 1/2) with confirm script | Task 6 |
| 15 | Implement `/api/twilio/voice/appointment-response` | `backend` | Handle DTMF response, classify as confirmed/reschedule/unclear | Task 14 |
| 16 | Update appointment status | `backend` | Mark appointment confirmed in Google Calendar; add to claim timeline | Task 15 |
| 17 | Handle reschedule flow | `backend` | If Press 2, play reschedule script and record message | Task 15 |

### Phase 4: Console UI (Week 4-6)

| # | Task | Area | Description | Dependencies |
|---|------|------|-------------|--------------|
| 18 | Create Voice Assistant page structure | `frontend` | New page at `/voice-assistant` with tabs layout | None |
| 19 | Build Overview panel component | `frontend` | Stats cards, recent calls list, master toggle | Task 10 |
| 20 | Build Scripts tab | `frontend` | Editable text areas for each script type; variable helper; TTS preview button | Task 2 |
| 21 | Build Behavior & Guardrails tab | `frontend` | Mode selector, sliders, toggles, forbidden topics input | Task 2 |
| 22 | Build Numbers & Routing tab | `frontend` | Business hours grid, holiday picker, routing options | Task 2 |
| 23 | Build Review Calls tab | `frontend` | Filterable table of CallLogs with detail drawer | Task 10 |
| 24 | Implement call detail drawer | `frontend` | Audio player, transcript view, AI summary, follow-up actions | Task 23 |
| 25 | Add config versioning API | `backend` | Endpoints to list versions, restore previous, compare | Task 1 |

### Phase 5: Integration & Polish (Week 6-7)

| # | Task | Area | Description | Dependencies |
|---|------|------|-------------|--------------|
| 26 | Wire calls into claim timeline | `frontend` | Show call events in `ClaimCommsPanel.jsx` alongside SMS | Task 11 |
| 27 | Add call playback in claim view | `frontend` | Audio player component for recordings | Task 26 |
| 28 | Business hours enforcement | `backend` | Check schedule in inbound webhook; return after-hours TwiML if closed | Task 2 |
| 29 | Implement flagging logic | `backend` | Auto-flag low confidence, escalation keywords, complaints | Task 9 |
| 30 | Daily digest notification | `backend` | Scheduled job to send daily call summary to office manager | Task 12 |

### Phase 6: Testing & Launch (Week 7-8)

| # | Task | Area | Description | Dependencies |
|---|------|------|-------------|--------------|
| 31 | Unit tests for voice webhooks | `backend` | Test TwiML generation, phone matching, call log creation | All backend |
| 32 | Integration test with Twilio | `infra` | End-to-end test: call → record → transcribe → notify | All backend |
| 33 | E2E test for Console UI | `frontend` | Playwright tests for config editing, call review | All frontend |
| 34 | Internal pilot (1 week) | `product` | Enable on one number, handle internal test calls only | All |
| 35 | Documentation | `product` | User guide for Console, troubleshooting guide | All |

---

## Appendix: Voice Prompt for Emergent

Add this to `/app/backend/services/ai_service.py`:

```python
SYSTEM_PROMPTS["voice_message_summary"] = """You are summarizing a transcribed voicemail for Care Claims, a public adjusting firm in Florida.

Guidelines:
- Write a concise 1-3 sentence summary
- Preserve key details: names, phone numbers, specific requests, dates
- Classify the caller's intent
- Suggest follow-up actions for the adjuster
- Flag any concerning content (legal threats, complaints, urgency)

Never include:
- Speculation about claim outcomes
- Legal interpretations
- Dollar amounts unless explicitly stated by caller

Return a JSON object with: summary, intent, confidence, follow_up_actions, flags"""
```

---

## Summary

This specification provides a complete blueprint for building the Eden Voice Assistant + Console:

- **Level 1 (Message Taker):** Fully deliverable in 4-5 weeks
- **Level 2 (Appointment Confirmer):** Additional 1-2 weeks
- **Console UI:** Full admin control over scripts, behavior, and call review
- **Safety:** Strict guardrails, escalation rules, and human oversight
- **Integration:** Seamless with existing SMS, notifications, and claim timeline

The Voice Assistant transforms Care Claims' phone handling from "hope they leave a voicemail" to "every call is captured, summarized, and actionable."

---

*Care Claims, Inc. — Stewardship and Excellence in Claims Handling*

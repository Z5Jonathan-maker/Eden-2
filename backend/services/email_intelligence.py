"""
Email Intelligence Service — Writing DNA Engine

Scans user's Gmail sent folder, analyzes writing patterns with Ollama,
builds a "Writing DNA" profile that gets injected into every AI response.
"""

import os
import logging
import uuid
import json
from datetime import datetime, timezone
from typing import Optional, List

from dependencies import db
from services.ollama_config import get_ollama_api_key, get_ollama_model

logger = logging.getLogger(__name__)

GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"

# In-memory cache for DNA prompts (avoids DB hit on every AI call)
_dna_cache: dict = {}  # {user_id: {prompt: str, expires: float}}
DNA_CACHE_TTL = 300  # 5 minutes


async def scan_sent_emails(user_id: str, max_emails: int = 50) -> list:
    """
    Fetch the user's last N sent emails via Gmail API.
    Returns list of {subject, body_text, to, date} dicts.
    """
    from routes.oauth import get_valid_token, refresh_google_token
    import httpx

    token = await get_valid_token(user_id, "google")
    if not token:
        raise ValueError("Google not connected. Connect via Settings.")

    async def _gmail_get(url, params=None):
        nonlocal token
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {token}"},
                params=params,
            )
            if resp.status_code == 401:
                token = await refresh_google_token(user_id)
                if not token:
                    raise ValueError("Google token expired. Please reconnect.")
                resp = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {token}"},
                    params=params,
                )
            return resp

    # Step 1: List sent message IDs
    params = [
        ("maxResults", min(max_emails, 50)),
        ("labelIds", "SENT"),
    ]
    resp = await _gmail_get(f"{GMAIL_API}/messages", params=params)
    if resp.status_code != 200:
        raise ValueError(f"Failed to list sent emails: {resp.status_code}")

    message_ids = [m["id"] for m in resp.json().get("messages", [])]
    if not message_ids:
        return []

    # Step 2: Fetch full content for each message
    import base64

    emails = []
    for mid in message_ids[:max_emails]:
        detail = await _gmail_get(
            f"{GMAIL_API}/messages/{mid}",
            params={"format": "full"},
        )
        if detail.status_code != 200:
            continue

        msg = detail.json()
        payload = msg.get("payload", {})
        headers = {}
        for h in payload.get("headers", []):
            name = h.get("name", "").lower()
            if name in ("from", "to", "subject", "date"):
                headers[name] = h.get("value", "")

        # Extract body text
        body_text = _extract_body_text(payload)
        if not body_text or len(body_text.strip()) < 20:
            continue

        emails.append({
            "subject": headers.get("subject", ""),
            "body_text": body_text[:2000],  # Cap per email
            "to": headers.get("to", ""),
            "date": headers.get("date", ""),
        })

    return emails


def _extract_body_text(payload: dict) -> str:
    """Recursively extract text/plain body from Gmail message payload."""
    import base64

    body_text = ""

    def _walk(part):
        nonlocal body_text
        mime = part.get("mimeType", "")
        data = part.get("body", {}).get("data")

        if data and mime == "text/plain" and not body_text:
            body_text = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")

        for sub in part.get("parts", []):
            _walk(sub)

    _walk(payload)
    return body_text


async def analyze_writing_dna(user_id: str, emails: list) -> dict:
    """
    Feed email samples to Ollama to extract writing DNA profile.
    Returns structured profile dict and stores in MongoDB.
    """
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    if not emails:
        return {}

    # Build sample corpus — pick up to 20 diverse emails
    samples = emails[:20]
    corpus = "\n\n---EMAIL---\n".join([
        f"Subject: {e['subject']}\nTo: {e['to']}\n\n{e['body_text']}"
        for e in samples
    ])

    prompt = f"""Analyze these {len(samples)} sent emails and extract the writer's communication DNA.

Return ONLY valid JSON with these exact keys:
{{
  "tone": "formal|casual|mixed",
  "greetings": ["list of their common greetings/openings"],
  "sign_offs": ["list of their common sign-offs/closings"],
  "phrases": ["list of 5-10 recurring phrases or expressions they use"],
  "formality": 7,
  "directness": 8,
  "warmth": 6,
  "sentence_style": "short and punchy|long and detailed|mixed",
  "vocabulary_notes": "brief note on vocabulary complexity and word choices",
  "personality_traits": ["confident", "empathetic", "action-oriented"],
  "punctuation_habits": "uses exclamation marks often|minimal punctuation|heavy comma usage",
  "summary": "2-3 sentence summary of this person's unique writing voice"
}}

Scores are 1-10 (1=very informal/indirect/cold, 10=very formal/direct/warm).

EMAILS:
{corpus[:8000]}"""

    api_key = get_ollama_api_key() or os.environ.get("EMERGENT_LLM_KEY")
    model = get_ollama_model()

    try:
        chat = LlmChat(api_key=api_key, model=model)
        response = await chat.send_message(UserMessage(text=prompt))
        response_text = str(response)

        # Parse JSON from response
        profile = _parse_json_response(response_text)
        if not profile:
            logger.error("Failed to parse DNA analysis response")
            return {}

    except Exception as e:
        logger.error(f"DNA analysis failed: {e}")
        return {}

    # Store in MongoDB
    now = datetime.now(timezone.utc).isoformat()
    profile_doc = {
        "user_id": user_id,
        "tone": profile.get("tone", "mixed"),
        "greetings": profile.get("greetings", []),
        "sign_offs": profile.get("sign_offs", []),
        "phrases": profile.get("phrases", []),
        "formality": profile.get("formality", 5),
        "directness": profile.get("directness", 5),
        "warmth": profile.get("warmth", 5),
        "sentence_style": profile.get("sentence_style", "mixed"),
        "vocabulary_notes": profile.get("vocabulary_notes", ""),
        "personality_traits": profile.get("personality_traits", []),
        "punctuation_habits": profile.get("punctuation_habits", ""),
        "summary": profile.get("summary", ""),
        "raw_analysis": response_text[:5000],
        "scanned_count": len(emails),
        "last_scanned": now,
        "created_at": now,
        "updated_at": now,
    }

    # Upsert — one profile per user
    await db.writing_dna_profiles.update_one(
        {"user_id": user_id},
        {"$set": profile_doc},
        upsert=True,
    )

    # Invalidate cache
    _dna_cache.pop(user_id, None)

    return profile_doc


async def extract_templates(user_id: str, emails: list) -> list:
    """
    Feed emails to Ollama to identify recurring/reusable email templates.
    """
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    if not emails:
        return []

    samples = emails[:25]
    corpus = "\n\n---EMAIL---\n".join([
        f"Subject: {e['subject']}\nTo: {e['to']}\n\n{e['body_text']}"
        for e in samples
    ])

    prompt = f"""Analyze these {len(samples)} sent emails and identify reusable email templates.

Look for:
- Recurring email patterns (similar structure/purpose sent multiple times)
- Common email types (follow-ups, status updates, introductions, requests)
- Emails that could be templatized with variable placeholders

Return ONLY valid JSON array:
[
  {{
    "name": "Template name (e.g. 'Follow-Up After Meeting')",
    "category": "follow_up|status_update|introduction|request|thank_you|scheduling|general",
    "subject_template": "Subject line with [PLACEHOLDER] vars",
    "body_template": "Full body with [PLACEHOLDER] vars for customizable parts",
    "description": "When to use this template"
  }}
]

Return 3-8 templates. Use [NAME], [DATE], [TOPIC], [COMPANY], [ACTION] as placeholder names.

EMAILS:
{corpus[:8000]}"""

    api_key = get_ollama_api_key() or os.environ.get("EMERGENT_LLM_KEY")
    model = get_ollama_model()

    try:
        chat = LlmChat(api_key=api_key, model=model)
        response = await chat.send_message(UserMessage(text=prompt))
        templates_raw = _parse_json_response(str(response))

        if not isinstance(templates_raw, list):
            logger.error("Template extraction did not return array")
            return []

    except Exception as e:
        logger.error(f"Template extraction failed: {e}")
        return []

    # Store templates in MongoDB
    now = datetime.now(timezone.utc).isoformat()
    stored = []

    # Clear old templates for this user
    await db.email_templates.delete_many({"user_id": user_id})

    for t in templates_raw[:8]:
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "name": t.get("name", "Untitled Template"),
            "category": t.get("category", "general"),
            "subject_template": t.get("subject_template", ""),
            "body_template": t.get("body_template", ""),
            "description": t.get("description", ""),
            "created_at": now,
            "updated_at": now,
        }
        await db.email_templates.insert_one(doc)
        stored.append(doc)

    return stored


async def get_writing_dna_prompt(user_id: str) -> str:
    """
    Build the DNA injection string for AI system prompts.
    Cached in memory for 5 minutes to avoid DB hit on every AI call.
    Returns empty string if no profile exists.
    """
    import time

    # Check cache
    cached = _dna_cache.get(user_id)
    if cached and cached["expires"] > time.time():
        return cached["prompt"]

    # Fetch from DB
    profile = await db.writing_dna_profiles.find_one(
        {"user_id": user_id},
        {"_id": 0},
    )

    if not profile:
        _dna_cache[user_id] = {"prompt": "", "expires": time.time() + DNA_CACHE_TTL}
        return ""

    # Build injection prompt
    greetings = ", ".join(profile.get("greetings", [])[:5]) or "varies"
    sign_offs = ", ".join(profile.get("sign_offs", [])[:5]) or "varies"
    phrases = ", ".join(profile.get("phrases", [])[:8]) or "none detected"
    traits = ", ".join(profile.get("personality_traits", [])[:5]) or "professional"
    formality = profile.get("formality", 5)
    directness = profile.get("directness", 5)
    warmth = profile.get("warmth", 5)
    style = profile.get("sentence_style", "mixed")
    summary = profile.get("summary", "")
    punctuation = profile.get("punctuation_habits", "")

    dna_prompt = f"""
--- USER WRITING DNA ---
CRITICAL: Match this user's exact communication style in ALL responses.
Write as if YOU are this person. Mirror their vocabulary, cadence, and personality.

Style Profile: {summary}
Tone: {profile.get('tone', 'mixed')}
Personality: {traits}
Typical Greetings: {greetings}
Typical Sign-offs: {sign_offs}
Signature Phrases: {phrases}
Sentence Style: {style}
Punctuation: {punctuation}
Formality: {formality}/10 | Directness: {directness}/10 | Warmth: {warmth}/10

RULES:
- Use their greetings and sign-offs when writing emails/messages
- Incorporate their signature phrases naturally
- Match their sentence length and structure
- Match their formality level — if they're casual, be casual; if formal, be formal
- Do NOT sound generic or corporate unless that IS their style
--- END WRITING DNA ---""".strip()

    _dna_cache[user_id] = {"prompt": dna_prompt, "expires": time.time() + DNA_CACHE_TTL}
    return dna_prompt


def _parse_json_response(text: str):
    """Extract JSON from LLM response, handling markdown code blocks."""
    import re

    # Try direct parse
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try extracting from markdown code block
    match = re.search(r'```(?:json)?\s*\n?([\s\S]*?)\n?```', text)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Try finding first { or [ to end
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        start = text.find(start_char)
        if start == -1:
            continue
        # Find matching end bracket
        depth = 0
        for i in range(start, len(text)):
            if text[i] == start_char:
                depth += 1
            elif text[i] == end_char:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start:i + 1])
                    except json.JSONDecodeError:
                        break

    return None

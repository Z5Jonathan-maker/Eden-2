"""Relevance scoring for claim-scoped Gmail ingestion."""
from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

from .schemas import ClaimIdentityProfile


def _contains_any(haystack: str, needles: List[str]) -> bool:
    lower = haystack.lower()
    for needle in needles:
        token = (needle or "").strip().lower()
        if token and token in lower:
            return True
    return False


def _extract_carrier_domains(profile: ClaimIdentityProfile) -> List[str]:
    domains: List[str] = []
    for carrier in profile.carrier_names:
        if not carrier:
            continue
        if "@" in carrier:
            domains.append(carrier.split("@", 1)[1].lower())
        else:
            token = re.sub(r"[^a-z0-9]+", "", carrier.lower())
            if token:
                domains.append(f"{token}.com")
    return domains


def score_email_relevance(
    *,
    profile: ClaimIdentityProfile,
    message: Dict[str, Any],
) -> Tuple[int, List[str], Dict[str, int]]:
    """
    Returns (score, reasons, breakdown).
    Implements hard + soft matching thresholds.
    """
    headers = message.get("headers", {})
    subject = str(headers.get("subject") or message.get("subject") or "")
    from_addr = str(headers.get("from") or message.get("from") or "")
    to_addr = str(headers.get("to") or message.get("to") or "")
    cc_addr = str(headers.get("cc") or message.get("cc") or "")
    body_text = str(message.get("body_text") or "")
    body_html = str(message.get("body_html") or "")
    snippet = str(message.get("snippet") or "")
    attachments = message.get("attachments", []) or []

    combined = "\n".join([subject, from_addr, to_addr, cc_addr, snippet, body_text, body_html])
    parties = "\n".join([from_addr, to_addr, cc_addr])

    score = 0
    reasons: List[str] = []
    hard_score = 0
    soft_score = 0

    def add(points: int, reason: str, hard: bool):
        nonlocal score, hard_score, soft_score
        score += points
        if hard:
            hard_score += points
        else:
            soft_score += points
        reasons.append(reason)

    # Hard matches.
    if _contains_any(combined, profile.claim_numbers):
        add(40, "hard: claim number match", True)

    if _contains_any(combined, profile.policy_numbers):
        add(35, "hard: policy number match", True)

    address_fragments = []
    for addr in profile.addresses:
        parts = [p.strip() for p in re.split(r"[,#]", addr) if p.strip()]
        address_fragments.extend(parts[:2])
    if _contains_any(combined, address_fragments):
        add(30, "hard: address fragment match", True)

    insured_last_names: List[str] = []
    for name in profile.policyholder_names:
        pieces = [p for p in re.split(r"\s+", name.strip()) if p]
        if pieces:
            insured_last_names.append(pieces[-1])
    if _contains_any(combined, insured_last_names) and _contains_any(combined, address_fragments):
        add(30, "hard: insured last name + address match", True)

    if _contains_any(parties, profile.adjuster_emails):
        add(25, "hard: adjuster email match", True)

    # Soft matches.
    carrier_domains = _extract_carrier_domains(profile)
    if _contains_any(parties, carrier_domains) and _contains_any(combined, insured_last_names):
        add(10, "soft: carrier domain + insured last name", False)

    participants_blob = " ".join([
        str(headers.get("from") or ""),
        str(headers.get("to") or ""),
        str(headers.get("cc") or ""),
    ])
    if _contains_any(participants_blob, profile.adjuster_emails):
        add(10, "soft: thread participant overlap", False)

    attachment_names = " ".join(str(att.get("filename") or "") for att in attachments)
    key_tokens = profile.claim_numbers + profile.policy_numbers + insured_last_names
    if _contains_any(attachment_names, key_tokens):
        add(10, "soft: attachment filename identifiers", False)

    score = max(0, min(100, score))
    return score, reasons, {"hard": hard_score, "soft": soft_score}

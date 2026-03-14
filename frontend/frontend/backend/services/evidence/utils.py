"""Utility helpers for evidence ingestion/timeline/reporting."""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, Optional

from .constants import EVENT_TYPE_PRIORITY


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        # Support Gmail internalDate milliseconds.
        if value > 1_000_000_000_000:
            return datetime.fromtimestamp(value / 1000.0, tz=timezone.utc)
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return utc_now()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(text)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except Exception:
            pass
        # RFC2822 fallback from Gmail headers
        from email.utils import parsedate_to_datetime

        try:
            parsed = parsedate_to_datetime(value)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except Exception:
            return utc_now()
    return utc_now()


def stable_json_bytes(payload: Dict[str, Any]) -> bytes:
    return json.dumps(payload, sort_keys=True, ensure_ascii=True, separators=(",", ":")).encode("utf-8")


def sha256_hex(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def make_dedupe_key(*parts: Optional[str]) -> str:
    normalized = "|".join((str(p or "").strip().lower() for p in parts))
    return sha256_hex(normalized.encode("utf-8"))


def truncate(text: str, max_len: int = 220) -> str:
    clean = re.sub(r"\s+", " ", (text or "").strip())
    if len(clean) <= max_len:
        return clean
    return clean[: max_len - 3] + "..."


def clean_tokens(values: Iterable[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        token = (value or "").strip()
        if not token:
            continue
        lowered = token.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        out.append(token)
    return out


def timeline_sort_key(item: Dict[str, Any]) -> tuple:
    occurred_at = ensure_datetime(item.get("occurred_at") or item.get("ingested_at"))
    event_type = str(item.get("event_type") or "NOTE")
    priority = EVENT_TYPE_PRIORITY.get(event_type, 999)
    source_id = str(item.get("source_id") or item.get("id") or "")
    return (occurred_at, priority, source_id)


def parse_headers(headers: list[Dict[str, str]]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for header in headers or []:
        key = str(header.get("name") or "").strip().lower()
        if key:
            out[key] = str(header.get("value") or "")
    return out

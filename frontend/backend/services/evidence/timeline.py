"""Timeline projection helpers for claim events."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from .constants import EVENT_TYPE_PRIORITY
from .utils import ensure_datetime, make_dedupe_key, timeline_sort_key, truncate

logger = logging.getLogger(__name__)


class TimelineProjector:
    def __init__(self, db):
        self.db = db

    async def _upsert_event(self, event: Dict[str, Any]) -> str:
        existing = await self.db.claim_events.find_one(
            {
                "claim_id": event["claim_id"],
                "dedupe_key": event["dedupe_key"],
            },
            {"_id": 0, "id": 1},
        )
        if existing:
            return existing["id"]

        await self.db.claim_events.insert_one(event)
        return event["id"]

    async def sync_claim_baseline_events(self, claim: Dict[str, Any], actor_user_id: str) -> None:
        claim_id = claim["id"]

        notes = await self.db.notes.find({"claim_id": claim_id}, {"_id": 0}).to_list(500)
        for note in notes:
            occurred = ensure_datetime(note.get("created_at"))
            summary = truncate(note.get("content") or "Internal note")
            event = {
                "id": make_dedupe_key("event", "note", claim_id, note.get("id")),
                "claim_id": claim_id,
                "event_type": "NOTE",
                "occurred_at": occurred,
                "ingested_at": datetime.now(timezone.utc),
                "source_system": "claims",
                "source_id": note.get("id"),
                "thread_id": None,
                "parties": {
                    "author": note.get("author_name") or note.get("author_id"),
                },
                "tags": note.get("tags") or [],
                "confidence_score": 100,
                "dedupe_key": make_dedupe_key("note", claim_id, note.get("id")),
                "summary": summary,
                "event_type_priority": EVENT_TYPE_PRIORITY["NOTE"],
                "created_by": actor_user_id,
                "updated_at": datetime.now(timezone.utc),
            }
            await self._upsert_event(event)

        documents = await self.db.documents.find({"claim_id": claim_id}, {"_id": 0}).to_list(500)
        for doc in documents:
            doc_name = str(doc.get("name") or "Document")
            doc_type = str(doc.get("type") or "")
            token = f"{doc_name} {doc_type}".lower()

            if "estimate" in token and ("rev" in token or "supp" in token):
                event_type = "ESTIMATE_REVISED"
            elif "estimate" in token:
                event_type = "ESTIMATE_UPLOADED"
            elif "carrier" in token and "submitted" in token:
                event_type = "DOC_SUBMITTED_TO_CARRIER"
            else:
                event_type = "ATTACHMENT_ADDED"

            occurred = ensure_datetime(doc.get("uploaded_at"))
            event = {
                "id": make_dedupe_key("event", "document", claim_id, doc.get("id")),
                "claim_id": claim_id,
                "event_type": event_type,
                "occurred_at": occurred,
                "ingested_at": datetime.now(timezone.utc),
                "source_system": "claims",
                "source_id": doc.get("id"),
                "thread_id": None,
                "parties": {
                    "uploaded_by": doc.get("uploaded_by"),
                },
                "tags": [doc_type] if doc_type else [],
                "confidence_score": 100,
                "dedupe_key": make_dedupe_key("document", claim_id, doc.get("id")),
                "summary": f"{doc_name} uploaded",
                "event_type_priority": EVENT_TYPE_PRIORITY.get(event_type, 999),
                "created_by": actor_user_id,
                "updated_at": datetime.now(timezone.utc),
            }
            await self._upsert_event(event)

        # Inspection milestones
        sessions = await self.db.inspection_sessions.find({"claim_id": claim_id}, {"_id": 0}).to_list(200)
        for session in sessions:
            started_at = ensure_datetime(session.get("created_at") or session.get("started_at"))
            scheduled_event = {
                "id": make_dedupe_key("event", "inspection_scheduled", claim_id, session.get("id")),
                "claim_id": claim_id,
                "event_type": "INSPECTION_SCHEDULED",
                "occurred_at": started_at,
                "ingested_at": datetime.now(timezone.utc),
                "source_system": "inspection",
                "source_id": session.get("id"),
                "thread_id": None,
                "parties": {},
                "tags": [],
                "confidence_score": 100,
                "dedupe_key": make_dedupe_key("inspection_scheduled", claim_id, session.get("id")),
                "summary": "Inspection scheduled",
                "event_type_priority": EVENT_TYPE_PRIORITY["INSPECTION_SCHEDULED"],
                "created_by": actor_user_id,
                "updated_at": datetime.now(timezone.utc),
            }
            await self._upsert_event(scheduled_event)

            if session.get("status") == "completed" or session.get("completed_at"):
                completed_at = ensure_datetime(session.get("completed_at") or session.get("updated_at"))
                completed_event = {
                    "id": make_dedupe_key("event", "inspection_completed", claim_id, session.get("id")),
                    "claim_id": claim_id,
                    "event_type": "INSPECTION_COMPLETED",
                    "occurred_at": completed_at,
                    "ingested_at": datetime.now(timezone.utc),
                    "source_system": "inspection",
                    "source_id": session.get("id"),
                    "thread_id": None,
                    "parties": {},
                    "tags": [],
                    "confidence_score": 100,
                    "dedupe_key": make_dedupe_key("inspection_completed", claim_id, session.get("id")),
                    "summary": "Inspection completed",
                    "event_type_priority": EVENT_TYPE_PRIORITY["INSPECTION_COMPLETED"],
                    "created_by": actor_user_id,
                    "updated_at": datetime.now(timezone.utc),
                }
                await self._upsert_event(completed_event)

        # Claim lifecycle events.
        status = str(claim.get("status") or "").lower()
        if status in {"approved", "denied"}:
            coverage_event = {
                "id": make_dedupe_key("event", "coverage", claim_id, status),
                "claim_id": claim_id,
                "event_type": "COVERAGE_DETERMINATION",
                "occurred_at": ensure_datetime(claim.get("updated_at") or claim.get("created_at")),
                "ingested_at": datetime.now(timezone.utc),
                "source_system": "claims",
                "source_id": claim.get("id"),
                "thread_id": None,
                "parties": {},
                "tags": [status],
                "confidence_score": 100,
                "dedupe_key": make_dedupe_key("coverage", claim_id, status),
                "summary": f"Coverage determination: {status}",
                "event_type_priority": EVENT_TYPE_PRIORITY["COVERAGE_DETERMINATION"],
                "created_by": actor_user_id,
                "updated_at": datetime.now(timezone.utc),
            }
            await self._upsert_event(coverage_event)

        if status in {"paid", "payment_issued"}:
            payment_event = {
                "id": make_dedupe_key("event", "payment", claim_id),
                "claim_id": claim_id,
                "event_type": "PAYMENT_ISSUED",
                "occurred_at": ensure_datetime(claim.get("updated_at") or claim.get("created_at")),
                "ingested_at": datetime.now(timezone.utc),
                "source_system": "claims",
                "source_id": claim.get("id"),
                "thread_id": None,
                "parties": {},
                "tags": [],
                "confidence_score": 100,
                "dedupe_key": make_dedupe_key("payment", claim_id),
                "summary": "Carrier payment issued",
                "event_type_priority": EVENT_TYPE_PRIORITY["PAYMENT_ISSUED"],
                "created_by": actor_user_id,
                "updated_at": datetime.now(timezone.utc),
            }
            await self._upsert_event(payment_event)

        if status in {"closed", "completed"}:
            closed_event = {
                "id": make_dedupe_key("event", "closed", claim_id),
                "claim_id": claim_id,
                "event_type": "CLAIM_CLOSED",
                "occurred_at": ensure_datetime(claim.get("updated_at") or claim.get("created_at")),
                "ingested_at": datetime.now(timezone.utc),
                "source_system": "claims",
                "source_id": claim.get("id"),
                "thread_id": None,
                "parties": {},
                "tags": [],
                "confidence_score": 100,
                "dedupe_key": make_dedupe_key("closed", claim_id),
                "summary": "Claim closed",
                "event_type_priority": EVENT_TYPE_PRIORITY["CLAIM_CLOSED"],
                "created_by": actor_user_id,
                "updated_at": datetime.now(timezone.utc),
            }
            await self._upsert_event(closed_event)

    async def list_timeline(self, claim_id: str, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {"claim_id": claim_id}

        if filters.get("event_type"):
            query["event_type"] = filters["event_type"]

        if filters.get("from") or filters.get("to"):
            date_query: Dict[str, Any] = {}
            if filters.get("from"):
                date_query["$gte"] = ensure_datetime(filters["from"])
            if filters.get("to"):
                date_query["$lte"] = ensure_datetime(filters["to"])
            query["occurred_at"] = date_query

        events = await self.db.claim_events.find(query, {"_id": 0}).to_list(filters.get("limit", 200))
        events.sort(key=timeline_sort_key)

        q = (filters.get("q") or "").strip().lower()
        if q:
            events = [
                event
                for event in events
                if q in str(event.get("summary") or "").lower()
                or q in str(event.get("event_type") or "").lower()
            ]

        return events

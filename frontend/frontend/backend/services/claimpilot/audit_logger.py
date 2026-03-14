"""
Audit logger for ClaimPilot agent executions.

Every agent run is recorded to the `claimpilot_audit` collection
for compliance, debugging, and performance tracking.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AuditLogger:
    """Writes structured audit records for every agent execution."""

    COLLECTION_NAME = "claimpilot_audit"

    def __init__(self, db) -> None:
        self._db = db

    async def log_execution(
        self,
        *,
        agent_name: str,
        claim_id: str,
        input_summary: str,
        output_summary: str,
        confidence: float,
        duration_ms: int,
        status: str,
        error_message: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> str:
        """Persist an audit record and return its id."""
        audit_id = uuid.uuid4().hex
        record = {
            "audit_id": audit_id,
            "agent_name": agent_name,
            "claim_id": claim_id,
            "input_summary": input_summary,
            "output_summary": output_summary,
            "confidence": confidence,
            "duration_ms": duration_ms,
            "status": status,
            "error_message": error_message,
            "user_id": user_id,
            "created_at": _utc_now(),
        }

        collection = getattr(self._db, self.COLLECTION_NAME)
        await collection.insert_one(record)

        logger.info(
            "audit | agent=%s claim=%s status=%s confidence=%.2f duration=%dms",
            agent_name,
            claim_id,
            status,
            confidence,
            duration_ms,
        )
        return audit_id

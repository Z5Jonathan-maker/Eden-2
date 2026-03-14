"""
Human-in-the-loop approval gate for ClaimPilot agent actions.

Every proposed write/mutation by an agent must pass through this gate.
Actions expire after 24 hours if not reviewed.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from models import PendingAction

logger = logging.getLogger(__name__)

EXPIRY_HOURS = 24
COLLECTION_NAME = "claimpilot_pending"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ApprovalGate:
    """Submit, approve, or reject agent-proposed actions."""

    def __init__(self, db) -> None:
        self._db = db

    @property
    def _collection(self):
        return getattr(self._db, COLLECTION_NAME)

    async def submit(self, action: PendingAction) -> str:
        """Persist a pending action and return its id."""
        doc = action.model_dump()
        doc["expires_at"] = _utc_now() + timedelta(hours=EXPIRY_HOURS)
        doc["status"] = "pending"

        await self._collection.insert_one(doc)

        logger.info(
            "approval_gate | submitted action=%s agent=%s claim=%s type=%s",
            action.id,
            action.agent_name,
            action.claim_id,
            action.action_type,
        )
        return action.id

    async def approve(self, action_id: str, reviewed_by: str) -> bool:
        """Mark an action as approved. Returns False if not found or not pending."""
        result = await self._collection.update_one(
            {"id": action_id, "status": "pending"},
            {
                "$set": {
                    "status": "approved",
                    "reviewed_by": reviewed_by,
                    "reviewed_at": _utc_now(),
                }
            },
        )
        if result.matched_count == 0:
            logger.warning("approval_gate | approve failed — action=%s not found/not pending", action_id)
            return False

        logger.info("approval_gate | approved action=%s by=%s", action_id, reviewed_by)
        return True

    async def reject(self, action_id: str, reviewed_by: str, reason: str = "") -> bool:
        """Mark an action as rejected. Returns False if not found or not pending."""
        result = await self._collection.update_one(
            {"id": action_id, "status": "pending"},
            {
                "$set": {
                    "status": "rejected",
                    "reviewed_by": reviewed_by,
                    "reviewed_at": _utc_now(),
                    "reject_reason": reason,
                }
            },
        )
        if result.matched_count == 0:
            logger.warning("approval_gate | reject failed — action=%s not found/not pending", action_id)
            return False

        logger.info("approval_gate | rejected action=%s by=%s reason=%s", action_id, reviewed_by, reason)
        return True

    async def get_pending(self, claim_id: Optional[str] = None, limit: int = 50) -> list:
        """Return pending actions, newest first."""
        query: dict = {"status": "pending"}
        if claim_id:
            query["claim_id"] = claim_id

        cursor = self._collection.find(query).sort("created_at", -1).limit(limit)
        return await cursor.to_list(length=limit)

    async def get_action(self, action_id: str) -> Optional[dict]:
        """Retrieve a single action by id."""
        return await self._collection.find_one({"id": action_id})

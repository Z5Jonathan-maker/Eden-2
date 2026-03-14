"""
Agent context builder for ClaimPilot.

Packages all claim-related data into an immutable context object
that agents consume for reasoning and decision-making.
"""

import asyncio
from dataclasses import dataclass, field
from typing import Any


FROZEN_STATUSES = frozenset({"Archived", "Closed"})
CARRIER_CHANNELS = ["carrier", "email"]

# Collection fetch specs: (collection_name, filter_key, limit)
_FETCH_SPECS = (
    ("claim_activity", "claim_id", 20),
    ("evidence", "claim_id", 50),
    ("notes", "claim_id", 20),
    ("tasks", "claim_id", 20),
    ("inspection_photos", "claim_id", 50),
)

COMM_MESSAGES_LIMIT = 30


@dataclass(frozen=True)
class AgentContext:
    """Immutable snapshot of all claim data an agent needs."""

    claim: dict
    recent_activity: list = field(default_factory=list)
    evidence: list = field(default_factory=list)
    notes: list = field(default_factory=list)
    tasks: list = field(default_factory=list)
    photos: list = field(default_factory=list)
    carrier_comms: list = field(default_factory=list)
    is_frozen: bool = False


class AgentContextBuilder:
    """Fetches and assembles an AgentContext from MongoDB collections."""

    def __init__(self, db: Any) -> None:
        self._db = db

    async def build(self, claim_id: str) -> AgentContext:
        """Build a complete agent context for the given claim.

        Raises:
            ValueError: If no claim exists with the given ID.
        """
        claim = await self._db.claims.find_one(
            {"id": claim_id}, {"_id": 0}
        )
        if claim is None:
            raise ValueError(f"Claim not found: {claim_id}")

        is_frozen = (
            claim.get("status") in FROZEN_STATUSES
            or claim.get("is_in_litigation") is True
        )

        # Fetch all supporting collections concurrently
        activity, evidence, notes, tasks, photos = await asyncio.gather(
            *(
                self._fetch_sorted(coll, {fkey: claim_id}, limit)
                for coll, fkey, limit in _FETCH_SPECS
            )
        )

        carrier_comms = await self._fetch_sorted(
            "comm_messages",
            {"claim_id": claim_id, "channel": {"$in": CARRIER_CHANNELS}},
            COMM_MESSAGES_LIMIT,
        )

        return AgentContext(
            claim=claim,
            recent_activity=activity,
            evidence=evidence,
            notes=notes,
            tasks=tasks,
            photos=photos,
            carrier_comms=carrier_comms,
            is_frozen=is_frozen,
        )

    async def _fetch_sorted(
        self, collection_name: str, query: dict, limit: int
    ) -> list[dict]:
        """Fetch documents sorted by created_at desc with a limit."""
        collection = getattr(self._db, collection_name)
        cursor = collection.find(query, {"_id": 0})
        cursor = cursor.sort("created_at", -1).limit(limit)
        return await cursor.to_list(length=limit)

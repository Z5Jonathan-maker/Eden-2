"""ClaimPilot Monitor Worker — scans all active claims for stalls every 2 hours."""

import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_db = None


def init_claimpilot_monitor(db):
    """Store database reference for the monitor worker."""
    global _db  # noqa: PLW0603
    _db = db


async def run_monitor_check():
    """Detect stalled claims and create notifications for assignees."""
    if _db is None:
        logger.error("ClaimPilot monitor: database not initialized")
        return

    try:
        from services.claimpilot.agents.claim_monitor import ClaimMonitorAgent
        from services.claimpilot.agent_context import AgentContextBuilder

        agent = ClaimMonitorAgent(_db)
        context_builder = AgentContextBuilder(_db)

        stalled = await agent.detect_stalled_claims()
        logger.info("CLAIMPILOT_MONITOR: Found %d stalled claims", len(stalled))

        for claim in stalled:
            try:
                ctx = await context_builder.build(claim["id"])
                result = await agent.run(ctx)

                if result and result.details.get("is_stalled"):
                    notification = {
                        "id": uuid.uuid4().hex,
                        "user_id": claim.get("assigned_to_id") or claim.get("created_by"),
                        "type": "claimpilot_stall",
                        "title": f"Stalled: {claim.get('claim_number', 'Unknown')}",
                        "message": result.summary,
                        "claim_id": claim["id"],
                        "is_read": False,
                        "created_at": datetime.now(timezone.utc),
                    }
                    await _db.notifications.insert_one(notification)
            except Exception as e:
                logger.error("Monitor failed for claim %s: %s", claim.get("id"), e)
    except Exception as e:
        logger.error("ClaimPilot monitor check failed: %s", e)

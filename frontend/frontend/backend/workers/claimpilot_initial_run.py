"""
Initial ClaimPilot run — processes all existing active claims on first startup.
Runs once after deploy to populate AI insights for Day 1.
"""
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_db = None


def init_initial_run(db):
    """Store database reference for the initial run worker."""
    global _db  # noqa: PLW0603
    _db = db


async def run_initial_analysis():
    """Run ClaimMonitor + EvidenceScorer + PredictiveAnalytics on all active claims."""
    if _db is None:
        logger.error("Initial run: database not initialized")
        return

    # Check if initial run already completed
    marker = await _db.claimpilot_audit.find_one({"agent_name": "_initial_run_complete"})
    if marker:
        logger.info("CLAIMPILOT: Initial run already completed, skipping")
        return

    try:
        from services.claimpilot.agents.claim_monitor import ClaimMonitorAgent
        from services.claimpilot.agents.evidence_scorer import EvidenceScorerAgent
        from services.claimpilot.agents.predictive_analytics import PredictiveAnalyticsAgent
        from services.claimpilot.agent_context import AgentContextBuilder

        context_builder = AgentContextBuilder(_db)
        monitor = ClaimMonitorAgent(_db)
        scorer = EvidenceScorerAgent(_db)
        predictor = PredictiveAnalyticsAgent(_db)

        # Get all active claims
        active_statuses = ["New", "In Progress", "Under Review", "Approved"]
        claims = await _db.claims.find(
            {"status": {"$in": active_statuses}},
            {"_id": 0, "id": 1, "claim_number": 1, "status": 1}
        ).to_list(100)  # Cap at 100 for first run

        logger.info("CLAIMPILOT_INITIAL: Processing %d active claims", len(claims))
        processed = 0

        for claim in claims:
            try:
                ctx = await context_builder.build(claim["id"])

                # Run each agent (errors are non-fatal)
                try:
                    await monitor.run(ctx)
                except Exception as e:
                    logger.warning("Initial monitor failed for %s: %s", claim.get("claim_number"), e)

                try:
                    await scorer.run(ctx)
                except Exception as e:
                    logger.warning("Initial scorer failed for %s: %s", claim.get("claim_number"), e)

                try:
                    await predictor.run(ctx)
                except Exception as e:
                    logger.warning("Initial predictor failed for %s: %s", claim.get("claim_number"), e)

                processed += 1
            except Exception as e:
                logger.warning("Initial run skipped claim %s: %s", claim.get("id"), e)

        # Mark as complete so it doesn't run again
        await _db.claimpilot_audit.insert_one({
            "id": uuid.uuid4().hex,
            "agent_name": "_initial_run_complete",
            "claim_id": "system",
            "input_summary": {"claims_processed": processed, "total_claims": len(claims)},
            "output_summary": {},
            "confidence": 1.0,
            "duration_ms": 0,
            "status": "success",
            "created_at": datetime.now(timezone.utc),
        })

        logger.info("CLAIMPILOT_INITIAL: Complete — processed %d/%d claims", processed, len(claims))

    except Exception as e:
        logger.error("CLAIMPILOT_INITIAL: Failed — %s", e)

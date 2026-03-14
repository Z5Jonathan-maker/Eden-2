"""
Drive Mirror Worker — Background job for daily reconciliation.

Runs at 3:00 AM UTC daily:
  1. Reconcile all uploaded files against the Drive mirror map
  2. Retry dead letter queue entries
"""

import logging
from dependencies import db

logger = logging.getLogger(__name__)

# Store database reference
_db = None


def init_drive_mirror(database):
    """Initialize the drive mirror worker with database reference."""
    global _db
    _db = database
    logger.info("Drive mirror worker initialized")


async def run_nightly_reconciliation():
    """Daily reconciliation job — mirrors any un-mirrored files to Drive."""
    logger.info("Drive mirror: starting nightly reconciliation")

    try:
        from services.drive_mirror import get_drive_mirror

        mirror = get_drive_mirror()

        # Run reconciliation
        recon_stats = await mirror.reconcile()
        logger.info(f"Drive mirror reconciliation: {recon_stats}")

        # Retry dead letters
        retry_stats = await mirror.retry_dead_letters(limit=50)
        logger.info(f"Drive mirror dead letter retry: {retry_stats}")

        # Store run record
        from datetime import datetime, timezone
        await db.drive_mirror_runs.insert_one({
            "type": "nightly_reconciliation",
            "reconciliation": recon_stats,
            "dead_letter_retry": retry_stats,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })

    except Exception as e:
        logger.error(f"Drive mirror nightly reconciliation failed: {e}")

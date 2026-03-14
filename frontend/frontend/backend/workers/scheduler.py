"""
Background Scheduler Setup
Uses APScheduler to run bot workers on schedule.

Jobs:
- Harvest Coach hourly check: Every hour at :30
- Harvest Coach nightly summary: Daily at 10 PM UTC
- Claims Ops hourly check: Every hour at :45
- Claims Ops nightly summary: Daily at 9 PM UTC
- Comms Bot periodic check: Every 2 hours
"""
import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = AsyncIOScheduler()

# Store database reference for workers
_db = None


def init_scheduler(db):
    """Initialize scheduler with database connection"""
    global _db
    _db = db
    
    # Initialize workers
    from workers.harvest_coach import init_harvest_coach
    from workers.claims_ops_bot import init_claims_ops_bot
    from workers.comms_bot import init_comms_bot
    from workers.evidence_sync import init_evidence_sync
    from workers.drive_mirror_worker import init_drive_mirror

    init_harvest_coach(db)
    init_claims_ops_bot(db)
    init_comms_bot(db)
    init_evidence_sync(db)
    init_drive_mirror(db)

    from workers.claimpilot_monitor import init_claimpilot_monitor
    init_claimpilot_monitor(db)

    # Add jobs
    _add_harvest_coach_jobs()
    _add_claims_ops_jobs()
    _add_comms_bot_jobs()
    _add_evidence_sync_jobs()
    _add_drive_mirror_jobs()
    _add_claimpilot_monitor_jobs()
    _add_legal_feed_jobs()

    logger.info("Background scheduler initialized with all bots")


def _add_harvest_coach_jobs():
    """Add Harvest Coach Bot jobs to scheduler"""
    from workers.harvest_coach import run_hourly_check, run_nightly_summary
    
    # Hourly check - runs every hour at :30
    # This gives time for reps to be out in the field before nudging
    scheduler.add_job(
        _run_async_job,
        CronTrigger(minute=30),
        args=[run_hourly_check],
        id="harvest_coach_hourly",
        name="Harvest Coach - Hourly Check",
        replace_existing=True,
        misfire_grace_time=600  # Allow 10 min late execution
    )
    
    # Nightly summary - runs at 10 PM UTC daily
    scheduler.add_job(
        _run_async_job,
        CronTrigger(hour=22, minute=0),
        args=[run_nightly_summary],
        id="harvest_coach_nightly",
        name="Harvest Coach - Nightly Summary",
        replace_existing=True,
        misfire_grace_time=1800  # Allow 30 min late execution
    )
    
    logger.info("Harvest Coach jobs added: hourly at :30, nightly at 22:00 UTC")


def _add_claims_ops_jobs():
    """Add Claims Ops Bot jobs to scheduler"""
    from workers.claims_ops_bot import run_hourly_check, run_nightly_summary
    
    # Hourly check - runs every hour at :45
    scheduler.add_job(
        _run_async_job,
        CronTrigger(minute=45),
        args=[run_hourly_check],
        id="claims_ops_hourly",
        name="Claims Ops - Hourly Check",
        replace_existing=True,
        misfire_grace_time=600
    )
    
    # Nightly summary - runs at 9 PM UTC daily (before Harvest Coach)
    scheduler.add_job(
        _run_async_job,
        CronTrigger(hour=21, minute=0),
        args=[run_nightly_summary],
        id="claims_ops_nightly",
        name="Claims Ops - Daily Focus List",
        replace_existing=True,
        misfire_grace_time=1800
    )
    
    logger.info("Claims Ops jobs added: hourly at :45, nightly at 21:00 UTC")


def _add_comms_bot_jobs():
    """Add Communication Assistant Bot jobs to scheduler"""
    from workers.comms_bot import run_periodic_check
    
    # Periodic check for missed events - every 2 hours
    scheduler.add_job(
        _run_async_job,
        IntervalTrigger(hours=2),
        args=[run_periodic_check],
        id="comms_bot_periodic",
        name="Comms Bot - Periodic Check",
        replace_existing=True,
        misfire_grace_time=600
    )
    
    logger.info("Comms Bot jobs added: periodic check every 2 hours")


def _add_evidence_sync_jobs():
    """Add claim evidence nightly sync job."""
    from workers.evidence_sync import run_nightly_sync

    scheduler.add_job(
        _run_async_job,
        CronTrigger(hour=3, minute=15),
        args=[run_nightly_sync],
        id="evidence_nightly_sync",
        name="Evidence - Nightly Claim Sync",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    logger.info("Evidence sync job added: nightly at 03:15 UTC")


def _add_drive_mirror_jobs():
    """Add Google Drive mirror reconciliation job."""
    from workers.drive_mirror_worker import run_nightly_reconciliation

    scheduler.add_job(
        _run_async_job,
        CronTrigger(hour=3, minute=0),
        args=[run_nightly_reconciliation],
        id="drive_mirror_nightly",
        name="Drive Mirror - Nightly Reconciliation",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    logger.info("Drive mirror job added: nightly at 03:00 UTC")


def _add_claimpilot_monitor_jobs():
    """Add ClaimPilot monitor job to scheduler."""
    from workers.claimpilot_monitor import run_monitor_check

    scheduler.add_job(
        _run_async_job,
        IntervalTrigger(hours=2),
        args=[run_monitor_check],
        id="claimpilot_monitor",
        name="ClaimPilot - Claim Monitor",
        replace_existing=True,
        misfire_grace_time=600,
    )
    logger.info("ClaimPilot Monitor job added: every 2 hours")


def _add_legal_feed_jobs():
    """Add ClaimPilot legal feed sync and staleness check jobs."""

    async def _run_weekly_sync():
        """Weekly FL statute sync — Sunday 02:00 UTC."""
        from services.claimpilot.legal_feed import LegalFeedService

        if _db is None:
            logger.warning("legal_feed sync skipped: no DB connection")
            return
        service = LegalFeedService(_db)
        result = await service.sync_statutes(force=False)
        logger.info(
            "legal_feed weekly sync: updated=%d unchanged=%d errors=%d",
            result["updated"],
            result["unchanged"],
            len(result["errors"]),
        )

    async def _run_staleness_check():
        """Daily staleness check — 06:00 UTC."""
        from services.claimpilot.legal_feed import LegalFeedService

        if _db is None:
            logger.warning("legal_feed staleness check skipped: no DB connection")
            return
        service = LegalFeedService(_db)
        status = await service.check_staleness()
        if status["is_stale"]:
            logger.warning(
                "legal_feed STALE: %d days since last sync",
                status["days_since_sync"],
            )

    # Weekly sync: Sunday at 02:00 UTC
    scheduler.add_job(
        _run_async_job,
        CronTrigger(day_of_week="sun", hour=2, minute=0),
        args=[_run_weekly_sync],
        id="legal_feed_weekly_sync",
        name="ClaimPilot Legal Feed - Weekly Sync",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Daily staleness check at 06:00 UTC
    scheduler.add_job(
        _run_async_job,
        CronTrigger(hour=6, minute=0),
        args=[_run_staleness_check],
        id="legal_feed_staleness_check",
        name="ClaimPilot Legal Feed - Daily Staleness Check",
        replace_existing=True,
        misfire_grace_time=1800,
    )

    logger.info(
        "Legal feed jobs added: weekly sync Sun 02:00 UTC, staleness check daily 06:00 UTC"
    )


async def _run_async_job(coro_func):
    """Wrapper to run async coroutine in scheduler"""
    try:
        await coro_func()
    except Exception as e:
        logger.error(f"Scheduled job error: {e}")


def start_scheduler():
    """Start the background scheduler"""
    if not scheduler.running:
        scheduler.start()
        logger.info("Background scheduler started")
        
        # Log scheduled jobs
        jobs = scheduler.get_jobs()
        for job in jobs:
            logger.info(f"  - {job.name}: {job.next_run_time}")


def stop_scheduler():
    """Stop the background scheduler"""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Background scheduler stopped")


def get_scheduler_status():
    """Get status of all scheduled jobs"""
    jobs = scheduler.get_jobs()
    return {
        "running": scheduler.running,
        "jobs": [
            {
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger)
            }
            for job in jobs
        ]
    }

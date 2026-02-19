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
    
    init_harvest_coach(db)
    init_claims_ops_bot(db)
    init_comms_bot(db)
    init_evidence_sync(db)
    
    # Add jobs
    _add_harvest_coach_jobs()
    _add_claims_ops_jobs()
    _add_comms_bot_jobs()
    _add_evidence_sync_jobs()
    
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

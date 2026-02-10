"""
Claims Ops Bot Worker
Background worker that monitors claim activity and deadlines.

Runs on schedule:
- Hourly: Check for at-risk files, pending actions, stale claims
- Nightly: Generate daily focus list for each adjuster

Uses the shared notifications system to deliver messages.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict
from motor.motor_asyncio import AsyncIOMotorDatabase

# Import centralized datetime utilities
from utils.datetime_utils import parse_datetime, now_utc, datetime_diff_hours

logger = logging.getLogger(__name__)

# Store database reference
_db: Optional[AsyncIOMotorDatabase] = None


def init_claims_ops_bot(db: AsyncIOMotorDatabase):
    """Initialize the worker with database connection"""
    global _db
    _db = db
    logger.info("Claims Ops Bot initialized")


def _is_db_initialized() -> bool:
    """Check if database is initialized"""
    return _db is not None


# Keep local alias for backward compatibility
def _parse_datetime(value) -> Optional[datetime]:
    """Parse a datetime value - delegates to centralized utility"""
    return parse_datetime(value)


# ============================================
# CONFIGURATION
# ============================================

# Days without activity before a claim is considered "stale"
STALE_CLAIM_DAYS = 7

# Days until deadline when we start warning
DEADLINE_WARNING_DAYS = 3

# Priority thresholds
HIGH_VALUE_THRESHOLD = 50000  # Claims over $50k get extra attention

# Claim statuses that indicate active work needed
ACTIVE_STATUSES = ["New", "In Progress", "Under Review", "Pending Documents"]

# Statuses that are completed/closed
CLOSED_STATUSES = ["Completed", "Closed", "Denied", "Withdrawn"]


# ============================================
# NOTIFICATION HELPER
# ============================================

async def _create_claims_ops_notification(
    user_id: str,
    title: str,
    body: str,
    cta_label: str,
    cta_route: str,
    data: dict = None,
    priority: str = "normal"
):
    """Create a claims_ops notification using the shared system"""
    from routes.notifications import create_notification
    
    # Check for duplicate (don't spam same notification)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    existing = await _db.notifications.find_one({
        "user_id": user_id,
        "type": "claims_ops",
        "title": title,
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    if existing:
        logger.debug(f"Claims Ops: Skipping duplicate notification for {user_id}: {title}")
        return None
    
    notification_data = data or {}
    notification_data["priority"] = priority
    
    return await create_notification(
        user_id=user_id,
        type="claims_ops",
        title=title,
        body=body,
        cta_label=cta_label,
        cta_route=cta_route,
        data=notification_data
    )


# ============================================
# MAIN WORKER FUNCTIONS
# ============================================

async def run_hourly_check():
    """
    Hourly check for claims that need attention.
    - Stale claims (no activity in X days)
    - Approaching deadlines
    - High-value claims without recent updates
    """
    if not _is_db_initialized():
        logger.error("Claims Ops Bot: Database not initialized")
        return
    
    logger.info("Claims Ops Bot: Running hourly check")
    
    try:
        # Get all active claims grouped by assigned adjuster
        cursor = _db.claims.find(
            {"status": {"$in": ACTIVE_STATUSES}, "is_archived": {"$ne": True}},
            {"_id": 0}
        )
        active_claims = await cursor.to_list(length=1000)
        
        # Group claims by assigned user
        claims_by_adjuster: Dict[str, List[dict]] = {}
        for claim in active_claims:
            adjuster_id = claim.get("assigned_to_id") or claim.get("created_by")
            if adjuster_id:
                if adjuster_id not in claims_by_adjuster:
                    claims_by_adjuster[adjuster_id] = []
                claims_by_adjuster[adjuster_id].append(claim)
        
        now = datetime.now(timezone.utc)
        notifications_sent = 0
        
        for adjuster_id, claims in claims_by_adjuster.items():
            # Check each claim for issues
            for claim in claims:
                # 1. Check for stale claims
                updated_at = claim.get("updated_at") or claim.get("created_at")
                last_update = _parse_datetime(updated_at)
                
                if last_update:
                    days_stale = (now - last_update).days
                    
                    if days_stale >= STALE_CLAIM_DAYS:
                        notification = await _create_claims_ops_notification(
                            user_id=adjuster_id,
                            title=f"Claim needs attention",
                            body=f"Claim {claim.get('claim_number')} hasn't been updated in {days_stale} days. Client: {claim.get('client_name', 'Unknown')}",
                            cta_label="View Claim",
                            cta_route=f"/claims/{claim.get('id')}",
                            data={"claim_id": claim.get("id"), "days_stale": days_stale},
                            priority="high" if days_stale > STALE_CLAIM_DAYS + 3 else "normal"
                        )
                        if notification:
                            notifications_sent += 1
                
                # 2. Check high-value claims
                estimated_value = claim.get("estimated_value")
                try:
                    estimated_value = float(estimated_value) if estimated_value else 0
                except (ValueError, TypeError):
                    estimated_value = 0
                    
                if estimated_value >= HIGH_VALUE_THRESHOLD:
                    # High-value claims get extra scrutiny
                    if last_update:
                        days_since = (now - last_update).days
                        
                        if days_since >= 3:  # Stricter threshold for high-value
                            notification = await _create_claims_ops_notification(
                                user_id=adjuster_id,
                                title=f"High-value claim needs update",
                                body=f"${estimated_value:,.0f} claim {claim.get('claim_number')} hasn't been updated in {days_since} days.",
                                cta_label="Update Now",
                                cta_route=f"/claims/{claim.get('id')}",
                                data={
                                    "claim_id": claim.get("id"),
                                    "estimated_value": estimated_value,
                                    "days_since_update": days_since
                                },
                                priority="high"
                            )
                            if notification:
                                notifications_sent += 1
                
                # 3. Check for pending documents status
                if claim.get("status") == "Pending Documents":
                    created_at = claim.get("created_at")
                    if created_at:
                        created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                        days_pending = (now - created).days
                        
                        if days_pending >= 5:
                            notification = await _create_claims_ops_notification(
                                user_id=adjuster_id,
                                title="Documents pending too long",
                                body=f"Claim {claim.get('claim_number')} has been waiting for documents for {days_pending} days. Consider following up with client.",
                                cta_label="View Claim",
                                cta_route=f"/claims/{claim.get('id')}",
                                data={"claim_id": claim.get("id"), "days_pending": days_pending}
                            )
                            if notification:
                                notifications_sent += 1
        
        logger.info(f"Claims Ops Bot: Hourly check complete. Sent {notifications_sent} notifications.")
        
    except Exception as e:
        import traceback
        logger.error(f"Claims Ops Bot hourly check error: {e}")
        logger.error(traceback.format_exc())


async def run_nightly_summary():
    """
    Nightly summary for each adjuster.
    Creates a "daily focus list" notification with prioritized claims.
    """
    if not _is_db_initialized():
        logger.error("Claims Ops Bot: Database not initialized")
        return
    
    logger.info("Claims Ops Bot: Running nightly summary")
    
    try:
        # Get all adjusters with active claims
        cursor = _db.claims.find(
            {"status": {"$in": ACTIVE_STATUSES}, "is_archived": {"$ne": True}},
            {"_id": 0}
        )
        active_claims = await cursor.to_list(length=1000)
        
        # Group by adjuster
        claims_by_adjuster: Dict[str, List[dict]] = {}
        for claim in active_claims:
            adjuster_id = claim.get("assigned_to_id") or claim.get("created_by")
            if adjuster_id:
                if adjuster_id not in claims_by_adjuster:
                    claims_by_adjuster[adjuster_id] = []
                claims_by_adjuster[adjuster_id].append(claim)
        
        now = datetime.now(timezone.utc)
        notifications_sent = 0
        
        for adjuster_id, claims in claims_by_adjuster.items():
            # Calculate priority scores and sort
            scored_claims = []
            for claim in claims:
                score = 0
                reasons = []
                
                # Staleness
                updated_at = claim.get("updated_at") or claim.get("created_at")
                last_update = _parse_datetime(updated_at)
                if last_update:
                    days_stale = (now - last_update).days
                    if days_stale >= STALE_CLAIM_DAYS:
                        score += days_stale * 2
                        reasons.append(f"{days_stale}d stale")
                
                # High value
                estimated_value = claim.get("estimated_value")
                try:
                    estimated_value = float(estimated_value) if estimated_value else 0
                except (ValueError, TypeError):
                    estimated_value = 0
                    
                if estimated_value >= HIGH_VALUE_THRESHOLD:
                    score += 50
                    reasons.append(f"${estimated_value:,.0f}")
                
                # Priority field
                priority = claim.get("priority", "Normal")
                if priority == "High":
                    score += 30
                    reasons.append("High priority")
                elif priority == "Urgent":
                    score += 50
                    reasons.append("Urgent")
                
                # New claims need attention
                if claim.get("status") == "New":
                    score += 20
                    reasons.append("New")
                
                scored_claims.append({
                    "claim": claim,
                    "score": score,
                    "reasons": reasons
                })
            
            # Sort by score (highest first)
            scored_claims.sort(key=lambda x: x["score"], reverse=True)
            
            # Get top 5 priority claims
            top_claims = scored_claims[:5]
            
            if not top_claims:
                continue
            
            # Build summary
            focus_items = []
            for item in top_claims:
                c = item["claim"]
                reasons_str = ", ".join(item["reasons"]) if item["reasons"] else "Active"
                focus_items.append(f"• {c.get('claim_number')}: {c.get('client_name', 'Unknown')} ({reasons_str})")
            
            body = f"Tomorrow's priority claims ({len(claims)} total active):\n" + "\n".join(focus_items[:3])
            
            notification = await _create_claims_ops_notification(
                user_id=adjuster_id,
                title="Your Daily Focus List",
                body=body,
                cta_label="View All Claims",
                cta_route="/claims?sort=priority",
                data={
                    "total_active": len(claims),
                    "top_claim_ids": [item["claim"]["id"] for item in top_claims],
                    "date": now.strftime("%Y-%m-%d")
                }
            )
            
            if notification:
                notifications_sent += 1
        
        logger.info(f"Claims Ops Bot: Nightly summary complete. Sent {notifications_sent} focus lists.")
        
    except Exception as e:
        logger.error(f"Claims Ops Bot nightly summary error: {e}")


# ============================================
# MANUAL TRIGGERS (for testing)
# ============================================

async def trigger_hourly():
    """Manually trigger hourly check"""
    await run_hourly_check()


async def trigger_nightly():
    """Manually trigger nightly summary"""
    await run_nightly_summary()

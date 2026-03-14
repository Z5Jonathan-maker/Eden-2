"""
Eden Incentives Engine - Central Game Event Bus
Phase 1: Unified gamification spine for all modules

This module provides a centralized event bus that:
1. Normalizes events from all modules (Harvest, Claims, Contracts, University)
2. Persists raw events for analytics and debugging
3. Forwards events to the incentives evaluator for scoring

All gamified actions should flow through emit_game_event() instead of
module-specific scoring logic.
"""

from datetime import datetime, timezone
from typing import Literal, TypedDict, Optional, Dict, Any, List
import uuid
import logging

logger = logging.getLogger(__name__)


# ============================================
# EVENT TYPES
# ============================================

GameEventType = Literal[
    # Harvest events
    "harvest.visit",           # Door knocked
    "harvest.appointment",     # Appointment set
    "harvest.signed",          # Contract signed in field
    
    # Claims events
    "claims.created",          # New claim opened
    "claims.assigned",         # Claim assigned to adjuster
    "claims.status_changed",   # Claim status changed
    "claims.settled",          # Claim settled
    
    # Inspection events
    "inspection.started",      # Inspection session started
    "inspection.completed",    # Inspection session completed
    "inspection.photo_added",  # Photo added to inspection
    
    # Contract events
    "contract.created",        # Contract created
    "contract.sent",           # Contract sent for signature
    "contract.signed",         # Contract fully signed
    
    # University events
    "university.course_started",    # Course started
    "university.course_completed",  # Course completed
    "university.article_read",      # Article read
    
    # Voice events
    "voice.call_handled",      # Voice call handled by AI
    "voice.call_matched",      # Voice call matched to claim
]


class GameEventPayload(TypedDict, total=False):
    """Flexible payload for game events"""
    # Harvest fields
    status: str               # NH/NI/CB/AP/SG
    pin_id: str
    territory_id: str
    disposition_points: int
    
    # Claims fields
    claim_id: str
    claim_number: str
    claim_type: str
    estimated_value: float
    
    # Contract fields
    contract_id: str
    
    # Inspection fields
    session_id: str
    photo_count: int
    
    # University fields
    course_id: str
    article_id: str
    progress_percent: int
    
    # Voice fields
    call_id: str
    duration_seconds: int
    
    # Generic
    metadata: Dict[str, Any]


class GameEvent(TypedDict):
    """Normalized game event structure"""
    type: GameEventType
    user_id: str
    ts: str                   # ISO 8601 timestamp
    payload: GameEventPayload
    tenant_id: Optional[str]  # For future multi-tenant support


# ============================================
# EVENT MAPPING TO METRICS
# ============================================

# Maps event types to metric slugs for the incentives engine
EVENT_METRIC_MAP: Dict[str, List[str]] = {
    "harvest.visit": ["doors"],
    "harvest.appointment": ["doors", "appointments"],
    "harvest.signed": ["doors", "contracts"],
    "claims.created": ["claims_created"],
    "claims.settled": ["claims_settled"],
    "inspection.completed": ["inspections_completed"],
    "contract.signed": ["contracts_signed"],
    "university.course_completed": ["courses_completed"],
}

# Maps event types to points (can be overridden by dispositions config)
DEFAULT_POINTS_MAP: Dict[str, int] = {
    "harvest.visit": 1,
    "harvest.appointment": 5,
    "harvest.signed": 10,
    "claims.created": 3,
    "claims.settled": 20,
    "inspection.completed": 5,
    "contract.signed": 15,
    "university.course_completed": 10,
}


# ============================================
# EVENT EMITTER
# ============================================

async def emit_game_event(db, event: GameEvent) -> Dict[str, Any]:
    """
    Central entry point for all game events.
    
    1. Persists the raw event to `game_events` collection
    2. Maps event type to metrics
    3. Forwards to incentives evaluator for competition updates
    4. Returns results including notifications and rank changes
    
    Args:
        db: MongoDB database instance
        event: Normalized game event
        
    Returns:
        Dict with affected_competitions, notifications, rank_changes, etc.
    """
    from .evaluator import IncentiveEvaluator
    
    results = {
        "event_id": None,
        "affected_competitions": [],
        "notifications": [],
        "rank_changes": [],
        "qualifications": [],
        "points_awarded": 0,
        "errors": []
    }
    
    try:
        # 1. Create event record
        event_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        event_doc = {
            "id": event_id,
            "type": event["type"],
            "user_id": event["user_id"],
            "ts": event.get("ts", now),
            "payload": event.get("payload", {}),
            "tenant_id": event.get("tenant_id"),
            "processed": False,
            "created_at": now
        }
        
        # 2. Persist raw event
        await db.game_events.insert_one(event_doc)
        results["event_id"] = event_id
        
        logger.info(f"Game event persisted: {event['type']} for user {event['user_id']}")
        
        # 3. Get metric slugs for this event type
        metric_slugs = EVENT_METRIC_MAP.get(event["type"], [])
        
        if not metric_slugs:
            logger.debug(f"No metrics mapped for event type: {event['type']}")
            # Still mark as processed
            await db.game_events.update_one(
                {"id": event_id},
                {"$set": {"processed": True, "processed_at": now}}
            )
            return results
        
        # 4. Get points from payload or default
        points = event.get("payload", {}).get("disposition_points")
        if points is None:
            points = DEFAULT_POINTS_MAP.get(event["type"], 1)
        
        results["points_awarded"] = points
        
        # 5. Forward to incentives evaluator for each metric
        evaluator = IncentiveEvaluator(db)
        
        for metric_slug in metric_slugs:
            try:
                eval_result = await evaluator.process_metric_event(
                    user_id=event["user_id"],
                    metric_slug=metric_slug,
                    value=points if metric_slug == "doors" else 1,  # Points for doors, count for others
                    event_type="increment",
                    source_collection="game_events",
                    source_document_id=event_id
                )
                
                # Aggregate results
                results["affected_competitions"].extend(eval_result.get("affected_competitions", []))
                results["notifications"].extend(eval_result.get("notifications", []))
                results["rank_changes"].extend(eval_result.get("rank_changes", []))
                results["qualifications"].extend(eval_result.get("qualifications", []))
                
            except Exception as e:
                logger.error(f"Error processing metric {metric_slug}: {e}")
                results["errors"].append(f"Metric {metric_slug}: {str(e)}")
        
        # 6. Mark event as processed
        await db.game_events.update_one(
            {"id": event_id},
            {
                "$set": {
                    "processed": True,
                    "processed_at": now,
                    "results": {
                        "affected_competitions": len(results["affected_competitions"]),
                        "notifications": len(results["notifications"]),
                        "points_awarded": results["points_awarded"]
                    }
                }
            }
        )
        
        logger.info(
            f"Game event processed: {event['type']} -> "
            f"{len(results['affected_competitions'])} competitions affected"
        )
        
    except Exception as e:
        logger.error(f"Error emitting game event: {e}")
        results["errors"].append(str(e))
    
    return results


async def emit_harvest_visit(
    db,
    user_id: str,
    status: str,
    pin_id: str = None,
    territory_id: str = None,
    disposition_points: int = None
) -> Dict[str, Any]:
    """
    Convenience function for Harvest visit events.
    
    Args:
        db: MongoDB database instance
        user_id: User who performed the visit
        status: Visit status (NH/NI/CB/AP/SG)
        pin_id: Optional pin ID
        territory_id: Optional territory ID
        disposition_points: Override points (otherwise uses config)
    """
    # Look up disposition points from config if not provided
    if disposition_points is None:
        config = await db.company_settings.find_one({"key": "harvest_dispositions"})
        if config and config.get("value"):
            for disp in config["value"]:
                if disp.get("code") == status:
                    disposition_points = disp.get("points", 1)
                    break
        
        # Fallback to hardcoded values
        if disposition_points is None:
            status_points = {
                "NH": 1,   # Not Home
                "NI": 0,   # Not Interested
                "CB": 3,   # Call Back
                "AP": 5,   # Appointment
                "SG": 10   # Signed
            }
            disposition_points = status_points.get(status, 1)
    
    # Determine event type based on status
    event_type = "harvest.visit"
    if status == "AP":
        event_type = "harvest.appointment"
    elif status == "SG":
        event_type = "harvest.signed"
    
    return await emit_game_event(db, {
        "type": event_type,
        "user_id": user_id,
        "ts": datetime.now(timezone.utc).isoformat(),
        "payload": {
            "status": status,
            "pin_id": pin_id,
            "territory_id": territory_id,
            "disposition_points": disposition_points
        }
    })


async def emit_claim_event(
    db,
    user_id: str,
    event_type: Literal["claims.created", "claims.assigned", "claims.status_changed", "claims.settled"],
    claim_id: str,
    claim_number: str = None,
    claim_type: str = None,
    estimated_value: float = None
) -> Dict[str, Any]:
    """Convenience function for Claims events."""
    return await emit_game_event(db, {
        "type": event_type,
        "user_id": user_id,
        "ts": datetime.now(timezone.utc).isoformat(),
        "payload": {
            "claim_id": claim_id,
            "claim_number": claim_number,
            "claim_type": claim_type,
            "estimated_value": estimated_value
        }
    })


async def emit_contract_event(
    db,
    user_id: str,
    event_type: Literal["contract.created", "contract.sent", "contract.signed"],
    contract_id: str
) -> Dict[str, Any]:
    """Convenience function for Contract events."""
    return await emit_game_event(db, {
        "type": event_type,
        "user_id": user_id,
        "ts": datetime.now(timezone.utc).isoformat(),
        "payload": {
            "contract_id": contract_id
        }
    })


async def emit_university_event(
    db,
    user_id: str,
    event_type: Literal["university.course_started", "university.course_completed", "university.article_read"],
    course_id: str = None,
    article_id: str = None,
    progress_percent: int = None
) -> Dict[str, Any]:
    """Convenience function for University events."""
    return await emit_game_event(db, {
        "type": event_type,
        "user_id": user_id,
        "ts": datetime.now(timezone.utc).isoformat(),
        "payload": {
            "course_id": course_id,
            "article_id": article_id,
            "progress_percent": progress_percent
        }
    })


async def emit_inspection_event(
    db,
    user_id: str,
    event_type: Literal["inspection.started", "inspection.completed", "inspection.photo_added"],
    session_id: str,
    photo_count: int = None
) -> Dict[str, Any]:
    """Convenience function for Inspection events."""
    return await emit_game_event(db, {
        "type": event_type,
        "user_id": user_id,
        "ts": datetime.now(timezone.utc).isoformat(),
        "payload": {
            "session_id": session_id,
            "photo_count": photo_count
        }
    })


# ============================================
# EVENT QUERY HELPERS
# ============================================

async def get_user_events(
    db,
    user_id: str,
    event_types: List[str] = None,
    since: datetime = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    Get game events for a user.
    
    Args:
        db: MongoDB database instance
        user_id: User ID
        event_types: Optional filter by event types
        since: Optional filter by timestamp
        limit: Max events to return
    """
    query = {"user_id": user_id}
    
    if event_types:
        query["type"] = {"$in": event_types}
    
    if since:
        query["ts"] = {"$gte": since.isoformat()}
    
    events = await db.game_events.find(
        query,
        {"_id": 0}
    ).sort("ts", -1).limit(limit).to_list(limit)
    
    return events


async def get_event_stats(
    db,
    user_id: str,
    period_start: datetime,
    period_end: datetime = None
) -> Dict[str, Any]:
    """
    Get aggregated event stats for a user over a period.
    """
    if period_end is None:
        period_end = datetime.now(timezone.utc)
    
    pipeline = [
        {
            "$match": {
                "user_id": user_id,
                "ts": {
                    "$gte": period_start.isoformat(),
                    "$lte": period_end.isoformat()
                }
            }
        },
        {
            "$group": {
                "_id": "$type",
                "count": {"$sum": 1},
                "total_points": {"$sum": "$payload.disposition_points"}
            }
        }
    ]
    
    results = await db.game_events.aggregate(pipeline).to_list(100)
    
    stats = {
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "events_by_type": {r["_id"]: {"count": r["count"], "points": r.get("total_points", 0)} for r in results},
        "total_events": sum(r["count"] for r in results),
        "total_points": sum(r.get("total_points", 0) for r in results)
    }
    
    return stats

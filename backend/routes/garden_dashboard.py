from fastapi import APIRouter, Depends
from dependencies import db, get_current_active_user
from datetime import datetime, timezone, timedelta
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/garden", tags=["garden"])


@router.get("/dashboard")
async def get_garden_dashboard(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Aggregated Garden CRM dashboard: pipeline counts, financials, tasks, stale claims,
    aging report, adjuster workload, settlement rate.
    Inspired by Pipedrive + ServiceTitan + ClaimWizard + XactAnalysis.
    """
    try:
        now = datetime.now(timezone.utc)
        today_str = now.strftime("%Y-%m-%d")
        seven_days_ago = (now - timedelta(days=7)).isoformat()
        fourteen_days_ago = (now - timedelta(days=14)).isoformat()
        thirty_days_ago = (now - timedelta(days=30)).isoformat()

        # --- Pipeline by status ---
        pipeline_agg = await db.claims.aggregate([
            {"$match": {"is_archived": {"$ne": True}}},
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "total_value": {"$sum": {"$ifNull": ["$estimated_value", 0]}},
            }},
        ]).to_list(20)

        pipeline = {}
        total_claims = 0
        total_value = 0
        for row in pipeline_agg:
            status = row["_id"] or "Unknown"
            pipeline[status] = {"count": row["count"], "value": row["total_value"]}
            total_claims += row["count"]
            total_value += row["total_value"]

        # --- Stale claims (no update in 14+ days, not closed/archived) ---
        stale_claims = await db.claims.find(
            {
                "is_archived": {"$ne": True},
                "status": {"$nin": ["Closed", "Archived", "Completed"]},
                "updated_at": {"$lt": fourteen_days_ago},
            },
            {"_id": 0, "id": 1, "claim_number": 1, "client_name": 1, "status": 1, "updated_at": 1, "estimated_value": 1},
        ).sort("updated_at", 1).to_list(20)

        # --- Recent activity (claims updated in last 7 days) ---
        recent_activity = await db.claims.find(
            {
                "is_archived": {"$ne": True},
                "updated_at": {"$gte": seven_days_ago},
            },
            {"_id": 0, "id": 1, "claim_number": 1, "client_name": 1, "status": 1, "updated_at": 1},
        ).sort("updated_at", -1).to_list(10)

        # --- Task summary ---
        overdue_tasks = await db.tasks.count_documents({
            "status": {"$ne": "completed"},
            "due_date": {"$lt": today_str, "$ne": None},
        })
        pending_tasks = await db.tasks.count_documents({"status": "pending"})
        in_progress_tasks = await db.tasks.count_documents({"status": "in_progress"})

        # --- Financial summary ---
        financial_agg = await db.claims.aggregate([
            {"$match": {"is_archived": {"$ne": True}}},
            {"$group": {
                "_id": None,
                "total_estimated": {"$sum": {"$ifNull": ["$estimated_value", 0]}},
                "total_settlement": {"$sum": {"$ifNull": ["$settlement_amount", 0]}},
                "total_acv": {"$sum": {"$ifNull": ["$actual_cash_value", 0]}},
                "total_rcv": {"$sum": {"$ifNull": ["$replacement_cost_value", 0]}},
                "avg_claim_value": {"$avg": {"$ifNull": ["$estimated_value", 0]}},
            }},
        ]).to_list(1)

        financials = financial_agg[0] if financial_agg else {
            "total_estimated": 0, "total_settlement": 0, "total_acv": 0,
            "total_rcv": 0, "avg_claim_value": 0,
        }
        financials.pop("_id", None)

        # --- Claims by type ---
        type_agg = await db.claims.aggregate([
            {"$match": {"is_archived": {"$ne": True}}},
            {"$group": {"_id": "$claim_type", "count": {"$sum": 1}, "value": {"$sum": {"$ifNull": ["$estimated_value", 0]}}}},
            {"$sort": {"count": -1}},
        ]).to_list(20)
        claims_by_type = [{"type": row["_id"] or "Unknown", "count": row["count"], "value": row["value"]} for row in type_agg]

        # --- Claims by priority ---
        priority_agg = await db.claims.aggregate([
            {"$match": {"is_archived": {"$ne": True}}},
            {"$group": {"_id": "$priority", "count": {"$sum": 1}}},
        ]).to_list(10)
        claims_by_priority = {row["_id"] or "Medium": row["count"] for row in priority_agg}

        # ─── NEW: Aging Report (claims bucketed by days open) ───
        all_active = await db.claims.find(
            {"is_archived": {"$ne": True}, "status": {"$nin": ["Closed", "Archived"]}},
            {"_id": 0, "created_at": 1},
        ).to_list(2000)

        aging_buckets = {"0-7": 0, "8-14": 0, "15-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
        for c in all_active:
            created = c.get("created_at")
            if not created:
                continue
            if isinstance(created, str):
                try:
                    created = datetime.fromisoformat(created.replace("Z", "+00:00"))
                except Exception:
                    continue
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            days_open = (now - created).days
            if days_open <= 7:
                aging_buckets["0-7"] += 1
            elif days_open <= 14:
                aging_buckets["8-14"] += 1
            elif days_open <= 30:
                aging_buckets["15-30"] += 1
            elif days_open <= 60:
                aging_buckets["31-60"] += 1
            elif days_open <= 90:
                aging_buckets["61-90"] += 1
            else:
                aging_buckets["90+"] += 1

        # ─── NEW: Adjuster Workload ───
        adjuster_agg = await db.claims.aggregate([
            {"$match": {"is_archived": {"$ne": True}, "status": {"$nin": ["Closed", "Archived", "Completed"]}}},
            {"$group": {
                "_id": "$assigned_to",
                "count": {"$sum": 1},
                "value": {"$sum": {"$ifNull": ["$estimated_value", 0]}},
            }},
            {"$sort": {"count": -1}},
        ]).to_list(30)
        adjuster_workload = [
            {"name": row["_id"] or "Unassigned", "claims": row["count"], "value": row["value"]}
            for row in adjuster_agg
        ]

        # ─── NEW: Settlement Rate ───
        settled_count = pipeline.get("Completed", {}).get("count", 0) + pipeline.get("Closed", {}).get("count", 0)
        total_resolved = settled_count + pipeline.get("Denied", {}).get("count", 0)
        settlement_rate = round((settled_count / max(1, total_resolved)) * 100)

        # ─── NEW: Claims created in last 30 days (new business velocity) ───
        new_last_30 = await db.claims.count_documents({
            "is_archived": {"$ne": True},
            "created_at": {"$gte": thirty_days_ago},
        })

        return {
            "total_claims": total_claims,
            "total_value": total_value,
            "pipeline": pipeline,
            "financials": financials,
            "tasks": {
                "overdue": overdue_tasks,
                "pending": pending_tasks,
                "in_progress": in_progress_tasks,
            },
            "stale_claims": stale_claims,
            "recent_activity": recent_activity,
            "claims_by_type": claims_by_type,
            "claims_by_priority": claims_by_priority,
            # New metrics
            "aging": aging_buckets,
            "adjuster_workload": adjuster_workload,
            "settlement_rate": settlement_rate,
            "new_last_30": new_last_30,
        }
    except Exception as e:
        logger.error(f"Garden dashboard error: {e}")
        return {"error": str(e)}

"""
Incentives Engine - Metrics Management

Handles CRUD operations for tracking metrics.
Metrics define what gets measured in competitions.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid

from dependencies import db, get_current_active_user as get_current_user
from incentives_engine.models import (
    MetricAggregation, SeasonStatus, CompetitionStatus, CompetitionScope,
    IncentiveRuleType, DurationType, CompetitionCategory,
    Season, Metric, CompetitionTemplate, Competition, IncentiveRule,
    Participant, CompetitionResult, MilestoneConfig,
    SeasonCreate, SeasonUpdate, MetricCreate,
    CompetitionCreate, CompetitionFromTemplate, RuleCreate,
)
from incentives_engine.evaluator import IncentiveEvaluator, process_harvest_event


router = APIRouter()

# Seed metrics data
SEED_METRICS = [
    {
        "id": "metric-doors",
        "slug": "doors",
        "name": "Doors Knocked",
        "description": "Total doors knocked/visited",
        "source_collection": "harvest_visits",
        "aggregation": "count",
        "icon": "🚪",
        "unit": "doors",
        "format": "integer",
        "is_system": True,
    },
    {
        "id": "metric-contacts",
        "slug": "contacts",
        "name": "Contacts Made",
        "description": "Doors where contact was made (NI, CB, AP, SG)",
        "source_collection": "harvest_visits",
        "filter_query": {"status": {"$in": ["NI", "CB", "AP", "SG"]


@router.get("/metrics")
async def get_metrics(
    active_only: bool = True,
    user: dict = Depends(get_current_user)
):
    """Get all metrics"""
    query = {"is_active": True} if active_only else {}
    metrics = await db.incentive_metrics.find(query, {"_id": 0}).to_list(200)

    if not metrics:
        # Auto-seed if empty
        metrics = await seed_metrics()

    return {"metrics": metrics}


@router.get("/metrics/{metric_id}")
async def get_metric(
    metric_id: str,
    user: dict = Depends(get_current_user)
):
    """Get a specific metric"""
    metric = await db.incentive_metrics.find_one({"id": metric_id}, {"_id": 0})
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")
    return metric


@router.post("/metrics")
async def create_metric(
    metric: MetricCreate,
    user: dict = Depends(get_current_user)
):
    """Create a new metric"""
    # Check slug uniqueness
    existing = await db.incentive_metrics.find_one({"slug": metric.slug})
    if existing:
        raise HTTPException(status_code=400, detail=f"Metric with slug '{metric.slug}' already exists")

    # Create metric document
    metric_obj = Metric(
        id=f"metric-{metric.slug}",
        **metric.dict()
    )

    await db.incentive_metrics.insert_one(metric_obj.dict())
    return metric_obj


async def seed_metrics() -> list:
    """Seed initial metrics if collection is empty"""
    # Check if metrics exist
    count = await db.incentive_metrics.count_documents({})
    if count > 0:
        return []

    # Insert seed metrics
    seed_objs = [Metric(**m) for m in SEED_METRICS]
    if seed_objs:
        await db.incentive_metrics.insert_many([m.dict() for m in seed_objs])

    return seed_objs

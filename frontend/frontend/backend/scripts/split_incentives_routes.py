#!/usr/bin/env python3
"""
Split incentives_engine.py into logical modules

Breaks 2501-line monolith into manageable route files:
- routes/incentives/metrics.py (~300 lines)
- routes/incentives/seasons.py (~400 lines)
- routes/incentives/templates.py (~350 lines)
- routes/incentives/competitions.py (~800 lines)
- routes/incentives/evaluations.py (~400 lines)
- routes/incentives/__init__.py (router aggregator)

Cimadevilla Operating Stack - Layer 2 (Scale & Systems):
- Modular routes = faster development velocity
- Clear boundaries = easier onboarding
- Smaller files = better IDE performance
"""

import re
import os

# Read the original file
file_path = "../routes/incentives_engine.py"
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()
    lines = content.split('\n')

# Find the split points by looking for major section headers
# We'll use route prefixes as markers

# Section 1: METRICS (lines 42-269)
# Section 2: SEASONS (lines 270-633)
# Section 3: TEMPLATES (lines 634-803)
# Section 4: COMPETITIONS (lines 804-1199)
# Section 5: PARTICIPANTS/EVALUATIONS (lines 1200+)

# Common imports for all modules
COMMON_IMPORTS = """from fastapi import APIRouter, Depends, HTTPException, Query
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
"""

# Extract SEED_METRICS constant (lines 46-174)
SEED_METRICS_START = content.find("SEED_METRICS = [")
SEED_METRICS_END = content.find("]", SEED_METRICS_START) + 1
SEED_METRICS = content[SEED_METRICS_START:SEED_METRICS_END]

print("Splitting incentives_engine.py (2501 lines)...\n")

# Create incentives subdirectory
os.makedirs("../routes/incentives", exist_ok=True)

# ==================== METRICS MODULE ====================
print("Extracting metrics.py...")

metrics_content = f'''"""
Incentives Engine - Metrics Management

Handles CRUD operations for tracking metrics.
Metrics define what gets measured in competitions.
"""

{COMMON_IMPORTS}

router = APIRouter()

# Seed metrics data
{SEED_METRICS}


@router.get("/metrics")
async def get_metrics(
    active_only: bool = True,
    user: dict = Depends(get_current_user)
):
    """Get all metrics"""
    query = {{"is_active": True}} if active_only else {{}}
    metrics = await db.incentive_metrics.find(query, {{"_id": 0}}).to_list(200)

    if not metrics:
        # Auto-seed if empty
        metrics = await seed_metrics()

    return {{"metrics": metrics}}


@router.get("/metrics/{{metric_id}}")
async def get_metric(
    metric_id: str,
    user: dict = Depends(get_current_user)
):
    """Get a specific metric"""
    metric = await db.incentive_metrics.find_one({{"id": metric_id}}, {{"_id": 0}})
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
    existing = await db.incentive_metrics.find_one({{"slug": metric.slug}})
    if existing:
        raise HTTPException(status_code=400, detail=f"Metric with slug '{{metric.slug}}' already exists")

    # Create metric document
    metric_obj = Metric(
        id=f"metric-{{metric.slug}}",
        **metric.dict()
    )

    await db.incentive_metrics.insert_one(metric_obj.dict())
    return metric_obj


async def seed_metrics() -> list:
    """Seed initial metrics if collection is empty"""
    # Check if metrics exist
    count = await db.incentive_metrics.count_documents({{}})
    if count > 0:
        return []

    # Insert seed metrics
    seed_objs = [Metric(**m) for m in SEED_METRICS]
    if seed_objs:
        await db.incentive_metrics.insert_many([m.dict() for m in seed_objs])

    return seed_objs
'''

with open("../routes/incentives/metrics.py", 'w', encoding='utf-8') as f:
    f.write(metrics_content)
print(f"  Created routes/incentives/metrics.py")

# ==================== MAIN INIT FILE ====================
print("\nCreating __init__.py router aggregator...")

init_content = '''"""
Incentives Engine - Unified Router

Aggregates all incentives sub-routers into single endpoint.
"""

from fastapi import APIRouter
from .metrics import router as metrics_router
# from .seasons import router as seasons_router
# from .templates import router as templates_router
# from .competitions import router as competitions_router

router = APIRouter(prefix="/api/incentives", tags=["Incentives Engine"])

# Include all sub-routers
router.include_router(metrics_router, tags=["Metrics"])
# router.include_router(seasons_router, tags=["Seasons"])
# router.include_router(templates_router, tags=["Templates"])
# router.include_router(competitions_router, tags=["Competitions"])
'''

with open("../routes/incentives/__init__.py", 'w', encoding='utf-8') as f:
    f.write(init_content)
print(f"  Created routes/incentives/__init__.py")

print("\n" + "=" * 60)
print("Extraction complete!")
print("=" * 60)
print("\nResults:")
print("  routes/incentives/metrics.py - Metrics CRUD (~80 lines)")
print("  routes/incentives/__init__.py - Router aggregator (~15 lines)")
print("\nTODO: Extract remaining sections:")
print("  - seasons.py (~400 lines)")
print("  - templates.py (~350 lines)")
print("  - competitions.py (~800 lines)")
print("\nThis demonstrates the pattern. Complete extraction requires:")
print("  1. Parse remaining route sections")
print("  2. Create corresponding .py files")
print("  3. Update __init__.py to include all routers")
print("  4. Update server.py to use new router structure")

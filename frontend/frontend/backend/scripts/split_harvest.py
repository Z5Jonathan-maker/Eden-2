#!/usr/bin/env python3
"""
Split harvest_v2.py into logical modules

Original: 1414 lines (config + visits + territories + leaderboard + gamification)
After:
- models.py (~100 lines) - Pydantic models
- config.py (~150 lines) - Configuration endpoints (dispositions, daily goals)
- visits.py (~300 lines) - Visit/pin tracking, today endpoint
- territories.py (~200 lines) - Territory management
- leaderboard.py (~300 lines) - Leaderboard and competitions
- gamification.py (~300 lines) - Badges, daily blitz, coach, profile

Cimadevilla Operating Stack - Layer 2:
- Modular canvassing system
- Clear separation of game mechanics vs territory management
"""

import os

print("Splitting harvest_v2.py (1414 lines)...")
print("=" * 60)

# Read source
with open("../routes/harvest_v2.py", 'r', encoding='utf-8') as f:
    content = f.read()
    lines = content.split('\n')

# Create output directory
os.makedirs("../routes/harvest", exist_ok=True)

# Find key line numbers
models_start = None
config_routes_start = None
visits_routes_start = None
territories_routes_start = None
leaderboard_routes_start = None
gamification_routes_start = None

for i, line in enumerate(lines):
    if "class VisitCreate(BaseModel):" in line and not models_start:
        models_start = i
    if '@router.get("/dispositions")' in line and not config_routes_start:
        config_routes_start = i
    if '@router.get("/today")' in line and not visits_routes_start:
        visits_routes_start = i
    if '@router.post("/territories")' in line and not territories_routes_start:
        territories_routes_start = i
    if '@router.get("/leaderboard")' in line and not leaderboard_routes_start:
        leaderboard_routes_start = i
    if '@router.get("/profile/{user_id}")' in line and not gamification_routes_start:
        gamification_routes_start = i

# Find models end (before config routes)
models_end = config_routes_start - 1 if config_routes_start else models_start + 50

print(f"Models: lines {models_start+1 if models_start else 'N/A'} to {models_end+1}")
print(f"Config routes start: line {config_routes_start+1 if config_routes_start else 'N/A'}")
print(f"Visits routes start: line {visits_routes_start+1 if visits_routes_start else 'N/A'}")
print(f"Territories routes start: line {territories_routes_start+1 if territories_routes_start else 'N/A'}")
print(f"Leaderboard routes start: line {leaderboard_routes_start+1 if leaderboard_routes_start else 'N/A'}")
print(f"Gamification routes start: line {gamification_routes_start+1 if gamification_routes_start else 'N/A'}")

# Common imports
COMMON_IMPORTS = """from fastapi import APIRouter, HTTPException, Depends, Query
from dependencies import db, get_current_active_user
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import logging
import uuid

logger = logging.getLogger(__name__)
"""

# Get header content (imports, constants before models)
header_end = models_start - 1 if models_start else 45
header_content = '\n'.join(lines[0:header_end])

# 1. Extract models.py
if models_start:
    models_lines = lines[models_start:models_end+1]
    models_content = f'''"""
Harvest Module - Pydantic Models

Request/response models for canvassing visits, territories, and competitions.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

{chr(10).join(models_lines)}
'''

    with open("../routes/harvest/models.py", 'w', encoding='utf-8') as f:
        f.write(models_content)
    print("Created routes/harvest/models.py")

# 2. Extract config.py (dispositions and daily goals)
if config_routes_start and visits_routes_start:
    # Find constants (dispositions, daily goals) before config routes
    const_start = None
    for i, line in enumerate(lines):
        if "# CONFIGURABLE DISPOSITIONS" in line:
            const_start = i
            break

    const_lines = lines[const_start:config_routes_start] if const_start else []
    config_route_lines = lines[config_routes_start:visits_routes_start]

    config_content = f'''"""
Harvest Module - Configuration

Dispositions and daily goals configuration endpoints.
"""

{COMMON_IMPORTS}

{chr(10).join(const_lines)}

router = APIRouter()

{chr(10).join(config_route_lines)}
'''

    with open("../routes/harvest/config.py", 'w', encoding='utf-8') as f:
        f.write(config_content)
    print("Created routes/harvest/config.py")

# 3. Extract visits.py (today, visits, pins)
if visits_routes_start and territories_routes_start:
    visits_content = f'''"""
Harvest Module - Visits and Pins

Daily game loop, visit tracking, and pin management with history.
"""

{COMMON_IMPORTS}

from .models import VisitCreate
from harvest_models.scoring_engine import HarvestScoringEngine

# Initialize scoring engine
scoring_engine = None

async def get_scoring_engine():
    global scoring_engine
    if scoring_engine is None:
        scoring_engine = HarvestScoringEngine(db)
        await scoring_engine.initialize()
    return scoring_engine

router = APIRouter()

{chr(10).join(lines[visits_routes_start:territories_routes_start])}
'''

    with open("../routes/harvest/visits.py", 'w', encoding='utf-8') as f:
        f.write(visits_content)
    print("Created routes/harvest/visits.py")

# 4. Extract territories.py
if territories_routes_start and leaderboard_routes_start:
    territories_content = f'''"""
Harvest Module - Territory Management

Territory CRUD operations and assignment.
"""

{COMMON_IMPORTS}

from .models import TerritoryCreate, TerritoryUpdate

router = APIRouter()

{chr(10).join(lines[territories_routes_start:leaderboard_routes_start])}
'''

    with open("../routes/harvest/territories.py", 'w', encoding='utf-8') as f:
        f.write(territories_content)
    print("Created routes/harvest/territories.py")

# 5. Extract leaderboard.py (leaderboard + competitions)
if leaderboard_routes_start and gamification_routes_start:
    leaderboard_content = f'''"""
Harvest Module - Leaderboard and Competitions

Leaderboard rankings and competition management.
"""

{COMMON_IMPORTS}

from .models import CompetitionCreate
from harvest_models.scoring_engine import HarvestScoringEngine

# Initialize scoring engine
scoring_engine = None

async def get_scoring_engine():
    global scoring_engine
    if scoring_engine is None:
        scoring_engine = HarvestScoringEngine(db)
        await scoring_engine.initialize()
    return scoring_engine

router = APIRouter()

{chr(10).join(lines[leaderboard_routes_start:gamification_routes_start])}
'''

    with open("../routes/harvest/leaderboard.py", 'w', encoding='utf-8') as f:
        f.write(leaderboard_content)
    print("Created routes/harvest/leaderboard.py")

# 6. Extract gamification.py (profile, badges, daily blitz, coach)
if gamification_routes_start:
    gamification_content = f'''"""
Harvest Module - Gamification

User profiles, badges, daily blitz, and AI coach.
"""

{COMMON_IMPORTS}

from .models import AssistantRequest
from harvest_models.scoring_engine import HarvestScoringEngine
import os
from emergentintegrations.llm.chat import LlmChat, UserMessage

# Initialize scoring engine
scoring_engine = None

async def get_scoring_engine():
    global scoring_engine
    if scoring_engine is None:
        scoring_engine = HarvestScoringEngine(db)
        await scoring_engine.initialize()
    return scoring_engine

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

router = APIRouter()

{chr(10).join(lines[gamification_routes_start:])}
'''

    with open("../routes/harvest/gamification.py", 'w', encoding='utf-8') as f:
        f.write(gamification_content)
    print("Created routes/harvest/gamification.py")

# 7. Create __init__.py
init_content = '''"""
Harvest Module - Unified Router

Canvassing system with visits, territories, leaderboards, and gamification.
Modularized from 1414-line monolith for better maintainability.
"""

from fastapi import APIRouter
from .config import router as config_router
from .visits import router as visits_router
from .territories import router as territories_router
from .leaderboard import router as leaderboard_router
from .gamification import router as gamification_router

router = APIRouter(prefix="/api/harvest", tags=["Harvest"])

# Include all sub-routers
router.include_router(config_router, tags=["Configuration"])
router.include_router(visits_router, tags=["Visits"])
router.include_router(territories_router, tags=["Territories"])
router.include_router(leaderboard_router, tags=["Leaderboard"])
router.include_router(gamification_router, tags=["Gamification"])
'''

with open("../routes/harvest/__init__.py", 'w', encoding='utf-8') as f:
    f.write(init_content)
print("Created routes/harvest/__init__.py")

print("\n" + "=" * 60)
print("Extraction Complete!")
print("=" * 60)
print(f"\nOriginal: 1414 lines")
print(f"\nNew structure:")
print(f"  models.py: Pydantic schemas")
print(f"  config.py: Configuration endpoints")
print(f"  visits.py: Visit tracking and today endpoint")
print(f"  territories.py: Territory management")
print(f"  leaderboard.py: Leaderboard and competitions")
print(f"  gamification.py: Badges, profile, coach")
print(f"  __init__.py: Router aggregator")

print("\nNext Steps:")
print("1. Update server.py:")
print("   from routes.harvest import router as harvest_router")
print("2. Test all harvest endpoints")
print("3. Verify today endpoint, leaderboard, and badges")
print("4. Consider deprecating routes/harvest_v2.py")

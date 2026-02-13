"""
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

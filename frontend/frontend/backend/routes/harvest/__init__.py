"""
Harvest Module

Canvassing system with GPS visits, territories, leaderboards, and gamification.
Built from Spotio + Enzy patterns.

NOTE: The sub-router in routes.py is created with no prefix. We re-export it
through a wrapper router so that ``include_router`` in server.py picks up
the ``/api/harvest/v2`` prefix correctly.  Mutating ``router.prefix`` after
route registration does NOT work in FastAPI/Starlette.
"""

from fastapi import APIRouter
from .routes import router as _inner_router

router = APIRouter(prefix="/api/harvest/v2", tags=["Harvest v2"])
router.include_router(_inner_router)

__all__ = ["router"]

"""AI routes package — re-exports combined router for backward compatibility.

server.py imports: ``from routes.ai import router as ai_router``
This module assembles all sub-routers under the shared ``/api/ai`` prefix.
"""

from fastapi import APIRouter

from routes.ai.budget import router as budget_router
from routes.ai.comms_copilot import router as comms_router
from routes.ai.eve_chat import router as eve_router

router = APIRouter(prefix="/api/ai", tags=["ai"])
router.include_router(budget_router)
router.include_router(eve_router)
router.include_router(comms_router)

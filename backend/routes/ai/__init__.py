"""
AI Module - Unified Router

Eve AI assistant with chat, copilot, and context features.
Modularized from 1638-line monolith for better maintainability.
"""

from fastapi import APIRouter
from .chat import router as chat_router
from .copilot import router as copilot_router
from .context import router as context_router

router = APIRouter(prefix="/api/ai", tags=["AI"])

# Include all sub-routers
router.include_router(chat_router, tags=["Chat"])
router.include_router(copilot_router, tags=["Copilot"])
router.include_router(context_router, tags=["Context"])

"""
Inspection Module

Inspection photos with sessions, voice notes, AI tagging, and report generation.
Competitive with CompanyCam features.
"""

from .routes import router

# Apply prefix at module level
router.prefix = "/api/inspections"
router.tags = ["inspections"]

__all__ = ["router"]

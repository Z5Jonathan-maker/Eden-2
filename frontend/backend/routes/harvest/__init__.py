"""
Harvest Module

Canvassing system with GPS visits, territories, leaderboards, and gamification.
Built from Spotio + Enzy patterns.
"""

from .routes import router

# Apply prefix at module level
router.prefix = "/api/harvest/v2"
router.tags = ["Harvest v2"]

__all__ = ["router"]

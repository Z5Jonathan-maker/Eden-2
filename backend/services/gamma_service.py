"""
GammaService - Wrapper around integrations.gamma_client.GammaClient

Provides presentation generation and legacy claim-page methods
used by routes/integrations.py endpoints.
"""

from typing import Optional, List, Dict
import logging

from integrations.gamma_client import get_gamma_client

logger = logging.getLogger(__name__)


class GammaService:
    def __init__(self):
        self.client = get_gamma_client()

    # ── Presentation generation (primary use-case) ──────────────

    async def generate_presentation(
        self,
        title: str,
        content: str,
        theme_id: Optional[str] = None,
    ) -> dict:
        """Generate a Gamma presentation from title + content."""
        slides = [
            {"title": title, "content": content, "type": "content"}
        ]
        return await self.client.create_presentation(
            title=title,
            slides=slides,
            template=theme_id or "professional",
            audience="carrier",
        )

    async def list_themes(self) -> List[dict]:
        """Return available presentation themes."""
        return [
            {"id": "professional", "name": "Professional"},
            {"id": "modern", "name": "Modern"},
            {"id": "clean", "name": "Clean"},
        ]

    # ── Legacy claim-page methods (Notion-style) ────────────────
    # Kept for backwards compatibility with routes/integrations.py.
    # Primary claim sync is handled by routes/gamma.py.

    async def create_claim_page(
        self, database_id: str, claim_data: Dict
    ) -> str:
        logger.warning("create_claim_page: legacy stub - use /api/gamma routes instead")
        return "stub-page-id"

    async def update_claim_page(self, page_id: str, updates: Dict):
        logger.warning("update_claim_page: legacy stub - use /api/gamma routes instead")

    async def append_content(self, page_id: str, content: str):
        logger.warning("append_content: legacy stub - use /api/gamma routes instead")

    async def query_database(
        self, database_id: str, filters: Optional[Dict] = None
    ) -> List[Dict]:
        logger.warning("query_database: legacy stub - use /api/gamma routes instead")
        return []

"""
Gamma Client — Handles Gamma API v1.0 for presentation generation

Primary job: Generate presentations from claim/inspection data.

Uses API key from GAMMA_API_KEY environment variable.
API docs: https://developers.gamma.app
Base URL: https://public-api.gamma.app/v1.0
Auth: X-API-KEY header
"""

from typing import Optional
import os
import logging
import asyncio
import httpx

logger = logging.getLogger(__name__)

# Gamma API v1.0
GAMMA_API_URL = "https://public-api.gamma.app/v1.0"
GAMMA_POLL_INTERVAL = 10   # seconds
GAMMA_POLL_MAX_WAIT = 180  # seconds


class GammaClient:
    """
    Gamma integration client for presentation generation.
    All Gamma API calls go through this class.
    """

    def __init__(self):
        self.api_key = os.environ.get("GAMMA_API_KEY") or os.environ.get("GAMMA_API_TOKEN")
        self._headers = {
            "X-API-KEY": self.api_key or "",
            "Content-Type": "application/json",
        }

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def _poll_generation(self, generation_id: str) -> dict:
        """Poll until generation completes or times out."""
        elapsed = 0
        async with httpx.AsyncClient(timeout=30) as client:
            while elapsed < GAMMA_POLL_MAX_WAIT:
                await asyncio.sleep(GAMMA_POLL_INTERVAL)
                elapsed += GAMMA_POLL_INTERVAL
                try:
                    resp = await client.get(
                        f"{GAMMA_API_URL}/generations/{generation_id}",
                        headers=self._headers,
                    )
                    if resp.status_code != 200:
                        continue
                    data = resp.json()
                    if data.get("status") == "completed":
                        return data
                    elif data.get("status") in ("failed", "error"):
                        return {"error": True, "message": data.get("message", "Generation failed")}
                except httpx.RequestError:
                    continue

        return {"error": True, "message": f"Generation timed out after {GAMMA_POLL_MAX_WAIT}s"}

    async def create_presentation(
        self,
        title: str,
        content: str,
        template: str = "professional",
        audience: str = "carrier",
        num_cards: int = 8,
    ) -> dict:
        """
        Create a presentation via Gamma API v1.0.

        1. POST /generations with inputText
        2. Poll GET /generations/{id} until completed
        3. Return gammaUrl
        """
        if not self.is_configured:
            return {
                "error": True,
                "message": "Gamma API key not configured. Set GAMMA_API_KEY in environment.",
            }

        input_text = f"Title: {title}\n\n{content}"

        payload = {
            "inputText": input_text,
            "textMode": "generate",
            "format": "presentation",
            "numCards": num_cards,
            "textOptions": {
                "tone": "professional",
                "audience": audience,
            },
            "imageOptions": {
                "source": "stock",
            },
        }

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(
                    f"{GAMMA_API_URL}/generations",
                    headers=self._headers,
                    json=payload,
                )

                if response.status_code != 200:
                    return {
                        "error": True,
                        "status_code": response.status_code,
                        "message": response.text[:500],
                    }

                data = response.json()

            generation_id = data.get("generationId")
            if not generation_id:
                return {"error": True, "message": "No generationId in response"}

            # Poll for completion
            completed = await self._poll_generation(generation_id)
            if completed.get("error"):
                return completed

            gamma_url = completed.get("gammaUrl", "")
            return {
                "gamma_id": generation_id,
                "url": gamma_url,
                "edit_url": gamma_url,
                "share_url": gamma_url,
                "status": "completed",
                "credits": completed.get("credits"),
            }
        except Exception as e:
            logger.error(f"Gamma API error: {e}")
            return {"error": True, "message": str(e)}

    async def create_inspection_deck(
        self,
        report_json: dict,
        claim_info: dict,
        session_info: dict,
    ) -> dict:
        """Create an inspection presentation from report data."""
        header = report_json.get("header", {})
        overview = report_json.get("overview", {})

        content_parts = [
            f"Inspection Report for Claim {header.get('claim_number', 'N/A')}",
            f"Property: {header.get('property_address', 'N/A')}",
            f"Insured: {header.get('insured_name', 'N/A')}",
            f"Date: {header.get('report_date', 'N/A')}",
            "",
            "Overview:",
            overview.get("summary", "") if isinstance(overview, dict) else str(overview),
            "",
        ]

        # Exterior/Roof
        ext = report_json.get("exterior_roof", {})
        if isinstance(ext, dict):
            content_parts.append("Exterior & Roof:")
            content_parts.append(ext.get("summary", ""))
            for cond in ext.get("notable_conditions", []):
                content_parts.append(f"- {cond}")
        elif ext:
            content_parts.append(f"Exterior & Roof: {ext}")
        content_parts.append("")

        # Interior rooms
        for room in report_json.get("interior", []):
            if isinstance(room, dict):
                content_parts.append(f"Room: {room.get('room', 'Interior')}")
                content_parts.append(room.get("summary", ""))
                content_parts.append(f"Damage: {room.get('damage_description', 'N/A')}")
                content_parts.append(f"Cause: {room.get('possible_cause', 'N/A')}")
                content_parts.append("")

        # Key findings
        findings = report_json.get("key_findings", [])
        if findings:
            content_parts.append("Key Findings:")
            for f in findings:
                content_parts.append(f"- {f}")
            content_parts.append("")

        # Next steps
        steps = report_json.get("recommended_next_steps", [])
        if steps:
            content_parts.append("Recommended Next Steps:")
            for i, s in enumerate(steps, 1):
                content_parts.append(f"{i}. {s}")

        content = "\n".join(content_parts)
        title = f"Inspection Report - {header.get('claim_number', 'Claim')}"

        return await self.create_presentation(
            title=title,
            content=content,
            audience="carrier",
        )

    async def create_client_update_deck(
        self,
        claim_info: dict,
        updates: list,
        next_actions: list,
    ) -> dict:
        """Create a client update presentation."""
        content_parts = [
            f"Claim Update for {claim_info.get('claim_number', '')}",
            f"Property: {claim_info.get('property_address', '')}",
            f"Status: {claim_info.get('status', '')}",
            "",
            "Recent Progress:",
        ]
        for u in (updates or ["No recent updates"]):
            content_parts.append(f"- {u}")
        content_parts.append("")
        content_parts.append("Next Steps:")
        for a in (next_actions or ["Awaiting carrier response"]):
            content_parts.append(f"- {a}")

        content = "\n".join(content_parts)
        title = f"Client Update - {claim_info.get('claim_number', 'Claim')}"

        return await self.create_presentation(
            title=title,
            content=content,
            audience="client",
        )


# Singleton instance
_gamma_client = None


def get_gamma_client() -> GammaClient:
    """Get the Gamma client singleton"""
    global _gamma_client
    if _gamma_client is None:
        _gamma_client = GammaClient()
    return _gamma_client

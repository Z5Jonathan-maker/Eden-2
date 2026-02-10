"""
Gamma Client - Handles Gamma API for presentation generation

Primary job: Generate presentations from:
- Inspection reports → Carrier decks
- Claims → Client update decks  
- Rep stats → Performance decks

Uses API key from GAMMA_API_KEY environment variable.
"""

from typing import Optional, Dict, Any
import os
import httpx
from datetime import datetime, timezone

from dependencies import db

# Gamma API endpoint
GAMMA_API_URL = "https://api.gamma.app/v1"


class GammaClient:
    """
    Gamma integration client for presentation generation.
    All Gamma API calls go through this class.
    """
    
    def __init__(self):
        self.api_key = os.environ.get("GAMMA_API_KEY")
        self._headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        } if self.api_key else {}
    
    @property
    def is_configured(self) -> bool:
        """Check if Gamma API key is configured"""
        return bool(self.api_key)
    
    async def create_presentation(
        self,
        title: str,
        slides: list,
        template: str = "professional",
        audience: str = "carrier"
    ) -> dict:
        """
        Create a presentation via Gamma API.
        
        Args:
            title: Presentation title
            slides: List of slide objects with title, content, notes
            template: Template style (professional, modern, clean)
            audience: Target audience (carrier, client, internal)
        
        Returns:
            Gamma presentation response with URL and ID
        """
        if not self.is_configured:
            return {
                "error": True,
                "message": "Gamma API key not configured. Set GAMMA_API_KEY in environment.",
                "mock": True
            }
        
        payload = {
            "title": title,
            "slides": slides,
            "template": template,
            "settings": {
                "audience": audience,
                "style": "professional"
            }
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{GAMMA_API_URL}/presentations",
                    headers=self._headers,
                    json=payload,
                    timeout=60.0
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    return {
                        "error": True,
                        "status_code": response.status_code,
                        "message": response.text
                    }
        except Exception as e:
            return {
                "error": True,
                "message": str(e)
            }
    
    async def create_inspection_deck(
        self,
        report_json: dict,
        claim_info: dict,
        session_info: dict
    ) -> dict:
        """
        Create an inspection presentation from report data.
        
        Args:
            report_json: The structured inspection report JSON
            claim_info: Claim details
            session_info: Inspection session details
        
        Returns:
            Gamma presentation response
        """
        header = report_json.get("header", {})
        overview = report_json.get("overview", {})
        
        slides = [
            # Title slide
            {
                "title": f"Inspection Report: {header.get('claim_number', 'N/A')}",
                "content": f"""
Property: {header.get('property_address', 'N/A')}
Insured: {header.get('insured_name', 'N/A')}
Date: {header.get('report_date', 'N/A')}
                """,
                "type": "title"
            },
            # Overview slide
            {
                "title": "Overview",
                "content": overview.get("summary", "") if isinstance(overview, dict) else str(overview),
                "type": "content"
            },
            # Exterior/Roof slide
            {
                "title": "Exterior & Roof",
                "content": self._format_exterior_roof(report_json.get("exterior_roof", {})),
                "type": "content"
            }
        ]
        
        # Interior slides (one per room)
        for room in report_json.get("interior", []):
            if isinstance(room, dict):
                slides.append({
                    "title": room.get("room", "Interior"),
                    "content": f"""
{room.get('summary', '')}

**Damage:** {room.get('damage_description', 'N/A')}
**Cause:** {room.get('possible_cause', 'N/A')}
                    """,
                    "type": "content"
                })
        
        # Key findings slide
        findings = report_json.get("key_findings", [])
        if findings:
            slides.append({
                "title": "Key Findings",
                "content": "\n".join([f"• {f}" for f in findings]),
                "type": "bullets"
            })
        
        # Next steps slide
        steps = report_json.get("recommended_next_steps", [])
        if steps:
            slides.append({
                "title": "Recommended Next Steps",
                "content": "\n".join([f"{i+1}. {s}" for i, s in enumerate(steps)]),
                "type": "numbered"
            })
        
        return await self.create_presentation(
            title=f"Inspection Report - {header.get('claim_number', 'Claim')}",
            slides=slides,
            template="professional",
            audience="carrier"
        )
    
    async def create_client_update_deck(
        self,
        claim_info: dict,
        updates: list,
        next_actions: list
    ) -> dict:
        """Create a client update presentation"""
        slides = [
            {
                "title": f"Claim Update: {claim_info.get('claim_number', '')}",
                "content": f"""
Property: {claim_info.get('property_address', '')}
Status: {claim_info.get('status', '')}
                """,
                "type": "title"
            },
            {
                "title": "Recent Progress",
                "content": "\n".join([f"• {u}" for u in updates]) if updates else "No recent updates",
                "type": "bullets"
            },
            {
                "title": "Next Steps",
                "content": "\n".join([f"• {a}" for a in next_actions]) if next_actions else "Awaiting carrier response",
                "type": "bullets"
            }
        ]
        
        return await self.create_presentation(
            title=f"Client Update - {claim_info.get('claim_number', 'Claim')}",
            slides=slides,
            template="clean",
            audience="client"
        )
    
    def _format_exterior_roof(self, data: dict) -> str:
        """Format exterior/roof data for slide"""
        if isinstance(data, str):
            return data
        
        content = data.get("summary", "")
        if data.get("details"):
            content += f"\n\n{data.get('details')}"
        
        conditions = data.get("notable_conditions", [])
        if conditions:
            content += "\n\n**Notable Conditions:**\n"
            content += "\n".join([f"• {c}" for c in conditions])
        
        return content


# Singleton instance
_gamma_client = None

def get_gamma_client() -> GammaClient:
    """Get the Gamma client singleton"""
    global _gamma_client
    if _gamma_client is None:
        _gamma_client = GammaClient()
    return _gamma_client

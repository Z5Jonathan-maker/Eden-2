import httpx
import logging
import os
from typing import Optional, Dict

logger = logging.getLogger(__name__)

class GammaService:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('GAMMA_API_KEY')
        self.base_url = 'https://api.gamma.app/v1.0'
        self.headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
    
    async def generate_presentation(
        self,
        title: str,
        content: str,
        theme_id: Optional[str] = None
    ) -> Dict:
        """Generate a presentation using Gamma API
        
        Args:
            title: Presentation title
            content: Slide content text
            theme_id: Optional theme ID (get from GET /themes endpoint)
            
        Returns:
            Dict with presentation_url and other metadata
        """
        try:
            async with httpx.AsyncClient() as client:
                payload = {
                    'inputText': content,
                    'title': title
                }
                
                if theme_id:
                    payload['themeId'] = theme_id
                
                response = await client.post(
                    f'{self.base_url}/generate',
                    json=payload,
                    headers=self.headers,
                    timeout=60.0
                )
                
                response.raise_for_status()
                result = response.json()
                
                logger.info('Gamma presentation generated successfully')
                return result
                
        except httpx.HTTPStatusError as error:
            logger.error(f'Gamma API HTTP error: {error.response.status_code} - {error.response.text}')
            raise Exception(f'Gamma API error: {error.response.text}')
        except Exception as error:
            logger.error(f'Gamma API error: {error}')
            raise Exception(f'Failed to generate presentation: {error}')
    
    async def list_themes(self) -> list:
        """Get list of available themes
        
        Returns:
            List of theme objects with id and name
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f'{self.base_url}/themes',
                    headers=self.headers
                )
                
                response.raise_for_status()
                result = response.json()
                
                logger.info(f'Retrieved {len(result.get("themes", []))} Gamma themes')
                return result.get('themes', [])
                
        except Exception as error:
            logger.error(f'Gamma API error: {error}')
            raise Exception(f'Failed to list themes: {error}')

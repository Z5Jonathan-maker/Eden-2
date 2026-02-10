from notion_client import Client
from typing import Optional, List, Dict
import logging
import os

logger = logging.getLogger(__name__)

class NotionService:
    def __init__(self, api_key: Optional[str] = None):
        self.client = Client(auth=api_key or os.getenv('NOTION_API_KEY'))
    
    async def create_claim_page(
        self,
        database_id: str,
        claim_data: Dict
    ) -> str:
        """Create a new claim page in Notion database
        
        Args:
            database_id: Notion database ID
            claim_data: Dict with claim information
            
        Returns:
            Page ID
        """
        try:
            response = self.client.pages.create(
                parent={'database_id': database_id},
                properties={
                    'Name': {
                        'title': [{'text': {'content': claim_data['claim_number']}}]
                    },
                    'Status': {
                        'select': {'name': claim_data.get('status', 'New')}
                    },
                    'Client Name': {
                        'rich_text': [{'text': {'content': claim_data.get('client_name', '')}}]
                    },
                    'Claim Date': {
                        'date': {'start': claim_data.get('claim_date')}
                    },
                    'Description': {
                        'rich_text': [{'text': {'content': claim_data.get('description', '')}}]
                    }
                }
            )
            
            logger.info(f'Notion page created: {response["id"]}')
            return response['id']
            
        except Exception as error:
            logger.error(f'Notion API error: {error}')
            raise Exception(f'Notion API error: {error}')
    
    async def update_claim_page(
        self,
        page_id: str,
        updates: Dict
    ):
        """Update properties of an existing claim page
        
        Args:
            page_id: Notion page ID
            updates: Dict with fields to update
        """
        try:
            properties = {}
            
            if 'status' in updates:
                properties['Status'] = {'select': {'name': updates['status']}}
            if 'notes' in updates:
                properties['Notes'] = {'rich_text': [{'text': {'content': updates['notes']}}]}
            if 'updated_date' in updates:
                properties['Updated Date'] = {'date': {'start': updates['updated_date']}}
            
            self.client.pages.update(
                page_id=page_id,
                properties=properties
            )
            
            logger.info(f'Notion page updated: {page_id}')
            
        except Exception as error:
            logger.error(f'Notion API error: {error}')
            raise Exception(f'Failed to update page: {error}')
    
    async def append_content(
        self,
        page_id: str,
        content: str
    ):
        """Append text content to a page
        
        Args:
            page_id: Notion page ID
            content: Text content to append
        """
        try:
            blocks = [
                {
                    'type': 'paragraph',
                    'paragraph': {
                        'rich_text': [{'text': {'content': content}}]
                    }
                }
            ]
            
            self.client.blocks.children.append(
                block_id=page_id,
                children=blocks
            )
            
            logger.info(f'Content appended to page: {page_id}')
            
        except Exception as error:
            logger.error(f'Notion API error: {error}')
            raise Exception(f'Failed to append content: {error}')
    
    async def query_database(
        self,
        database_id: str,
        filters: Optional[Dict] = None
    ) -> List[Dict]:
        """Query a Notion database
        
        Args:
            database_id: Notion database ID
            filters: Optional filter conditions
            
        Returns:
            List of page results
        """
        try:
            query_params = {'database_id': database_id}
            if filters:
                query_params['filter'] = filters
            
            response = self.client.databases.query(**query_params)
            return response['results']
            
        except Exception as error:
            logger.error(f'Notion API error: {error}')
            raise Exception(f'Failed to query database: {error}')

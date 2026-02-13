import os
import logging
from typing import Optional, Dict, List
import base64

logger = logging.getLogger(__name__)

class SignNowService:
    def __init__(self, access_token: Optional[str] = None):
        """Initialize SignNow service with access token"""
        self.access_token = access_token or os.getenv('SIGNNOW_ACCESS_TOKEN')
        self.api_base = os.getenv('SIGNNOW_API_BASE', 'https://api.signnow.com')
    
    def get_auth_headers(self):
        """Get authorization headers"""
        return {
            'Authorization': f'Bearer {self.access_token}',
            'Content-Type': 'application/json'
        }
    
    async def upload_document(
        self,
        file_content: bytes,
        file_name: str
    ) -> str:
        """Upload a document to SignNow
        
        Args:
            file_content: Document content as bytes
            file_name: Name of the file
            
        Returns:
            Document ID
        """
        try:
            import httpx
            
            async with httpx.AsyncClient() as client:
                files = {'file': (file_name, file_content, 'application/pdf')}
                
                response = await client.post(
                    f'{self.api_base}/document',
                    files=files,
                    headers={'Authorization': f'Bearer {self.access_token}'},
                    timeout=30.0
                )
                
                response.raise_for_status()
                result = response.json()
                
                document_id = result.get('id')
                logger.info(f'Document uploaded to SignNow: {document_id}')
                return document_id
                
        except Exception as error:
            logger.error(f'SignNow upload error: {error}')
            raise Exception(f'Failed to upload document: {error}')
    
    async def send_for_signature(
        self,
        document_id: str,
        signer_email: str,
        signer_name: str,
        subject: str,
        message: str,
        sender_email: Optional[str] = None
    ) -> Dict:
        """Send a document for signature
        
        Args:
            document_id: SignNow document ID
            signer_email: Email of the signer
            signer_name: Name of the signer
            subject: Email subject
            message: Email message
            sender_email: Optional sender email
            
        Returns:
            Dict with invite details
        """
        try:
            import httpx
            
            payload = {
                'to': [{
                    'email': signer_email,
                    'role': 'Signer',
                    'order': 1,
                    'authentication_type': 'password',
                    'reminder': 2,  # Reminder in days
                    'expiration_days': 30
                }],
                'from': sender_email or os.getenv('SIGNNOW_SENDER_EMAIL', 'noreply@eden.com'),
                'subject': subject,
                'message': message
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f'{self.api_base}/document/{document_id}/invite',
                    json=payload,
                    headers=self.get_auth_headers(),
                    timeout=30.0
                )
                
                response.raise_for_status()
                result = response.json()
                
                logger.info(f'Document sent for signature: {document_id}')
                return {
                    'invite_id': result.get('id'),
                    'status': 'sent',
                    'document_id': document_id
                }
                
        except Exception as error:
            logger.error(f'SignNow invite error: {error}')
            raise Exception(f'Failed to send for signature: {error}')
    
    async def get_document_status(
        self,
        document_id: str
    ) -> Dict:
        """Get document signing status
        
        Args:
            document_id: SignNow document ID
            
        Returns:
            Dict with document status
        """
        try:
            import httpx
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f'{self.api_base}/document/{document_id}',
                    headers=self.get_auth_headers(),
                    timeout=30.0
                )
                
                response.raise_for_status()
                result = response.json()
                
                return {
                    'document_id': document_id,
                    'status': result.get('status', 'pending'),
                    'created': result.get('created'),
                    'updated': result.get('updated'),
                    'signatures': result.get('signatures', [])
                }
                
        except Exception as error:
            logger.error(f'SignNow status error: {error}')
            raise Exception(f'Failed to get document status: {error}')
    
    async def download_signed_document(
        self,
        document_id: str
    ) -> bytes:
        """Download signed document
        
        Args:
            document_id: SignNow document ID
            
        Returns:
            Document content as bytes
        """
        try:
            import httpx
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f'{self.api_base}/document/{document_id}/download',
                    headers=self.get_auth_headers(),
                    timeout=60.0
                )
                
                response.raise_for_status()
                
                logger.info(f'Document downloaded: {document_id}')
                return response.content
                
        except Exception as error:
            logger.error(f'SignNow download error: {error}')
            raise Exception(f'Failed to download document: {error}')
    
    async def create_template(
        self,
        document_id: str,
        template_name: str
    ) -> str:
        """Create a template from a document
        
        Args:
            document_id: SignNow document ID
            template_name: Name for the template
            
        Returns:
            Template ID
        """
        try:
            import httpx
            
            payload = {
                'document_id': document_id,
                'document_name': template_name
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f'{self.api_base}/template',
                    json=payload,
                    headers=self.get_auth_headers(),
                    timeout=30.0
                )
                
                response.raise_for_status()
                result = response.json()
                
                template_id = result.get('id')
                logger.info(f'Template created: {template_id}')
                return template_id
                
        except Exception as error:
            logger.error(f'SignNow template error: {error}')
            raise Exception(f'Failed to create template: {error}')

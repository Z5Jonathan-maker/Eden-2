from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import base64
import mimetypes
import logging
from typing import List, Optional
from datetime import datetime, timedelta
import os

logger = logging.getLogger(__name__)

class GmailService:
    def __init__(self, credentials_dict: dict):
        self.credentials = Credentials(
            token=credentials_dict['access_token'],
            refresh_token=credentials_dict.get('refresh_token'),
            token_uri='https://oauth2.googleapis.com/token',
            client_id=os.getenv('GOOGLE_CLIENT_ID'),
            client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
            scopes=credentials_dict.get('scopes', [
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/gmail.compose'
            ])
        )
    
    def get_service(self):
        """Build and return Gmail API service"""
        return build('gmail', 'v1', credentials=self.credentials)
    
    async def send_email(
        self,
        recipient: str,
        subject: str,
        body: str,
        attachments: Optional[List[tuple]] = None
    ) -> dict:
        """Send an email with optional attachments
        
        Args:
            recipient: Email address of recipient
            subject: Email subject
            body: Email body text
            attachments: List of tuples (filename, content_bytes)
        """
        try:
            service = self.get_service()
            
            # Create message
            message = MIMEMultipart()
            message['to'] = recipient
            message['subject'] = subject
            message.attach(MIMEText(body, 'plain'))
            
            # Add attachments if provided
            if attachments:
                for filename, content in attachments:
                    # Determine MIME type
                    ctype, encoding = mimetypes.guess_type(filename)
                    if ctype is None or encoding is not None:
                        ctype = 'application/octet-stream'
                    
                    maintype, subtype = ctype.split('/', 1)
                    
                    part = MIMEBase(maintype, subtype)
                    part.set_payload(content)
                    encoders.encode_base64(part)
                    part.add_header('Content-Disposition', 'attachment', filename=filename)
                    message.attach(part)
            
            # Encode message
            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
            send_message = {'raw': raw_message}
            
            # Send through Gmail API
            result = service.users().messages().send(
                userId='me',
                body=send_message
            ).execute()
            
            logger.info(f'Email sent successfully: {result["id"]}')
            return {'message_id': result['id'], 'status': 'sent'}
            
        except HttpError as error:
            logger.error(f'Gmail API error: {error}')
            raise Exception(f'Gmail API error: {error}')
        except Exception as e:
            logger.error(f'Error sending email: {e}')
            raise
    
    async def create_draft(
        self,
        recipient: str,
        subject: str,
        body: str
    ) -> dict:
        """Create a draft email"""
        try:
            service = self.get_service()
            
            message = MIMEText(body)
            message['to'] = recipient
            message['subject'] = subject
            
            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
            draft = service.users().drafts().create(
                userId='me',
                body={'message': {'raw': raw_message}}
            ).execute()
            
            logger.info(f'Draft created successfully: {draft["id"]}')
            return {'draft_id': draft['id'], 'status': 'created'}
            
        except Exception as e:
            logger.error(f'Error creating draft: {e}')
            raise

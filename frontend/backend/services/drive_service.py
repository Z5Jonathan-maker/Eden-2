from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from googleapiclient.errors import HttpError
import io
import os
import logging
from typing import Optional, List

logger = logging.getLogger(__name__)

class DriveService:
    def __init__(self, credentials_dict: dict):
        self.credentials = Credentials(
            token=credentials_dict['access_token'],
            refresh_token=credentials_dict.get('refresh_token'),
            token_uri='https://oauth2.googleapis.com/token',
            client_id=os.getenv('GOOGLE_CLIENT_ID'),
            client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
            scopes=credentials_dict.get('scopes', [
                'https://www.googleapis.com/auth/drive.file'
            ])
        )
    
    def get_service(self):
        """Build and return Drive API service"""
        return build('drive', 'v3', credentials=self.credentials)
    
    async def create_folder(self, folder_name: str, parent_id: Optional[str] = None) -> str:
        """Create a folder in Google Drive
        
        Args:
            folder_name: Name of folder to create
            parent_id: Optional parent folder ID
            
        Returns:
            Folder ID
        """
        try:
            service = self.get_service()
            
            file_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            
            if parent_id:
                file_metadata['parents'] = [parent_id]
            
            folder = service.files().create(
                body=file_metadata,
                fields='id'
            ).execute()
            
            logger.info(f'Folder created: {folder["id"]}')
            return folder['id']
            
        except HttpError as error:
            logger.error(f'Drive API error: {error}')
            raise Exception(f'Drive API error: {error}')
    
    async def upload_file(
        self,
        file_name: str,
        file_content: bytes,
        mime_type: str,
        folder_id: Optional[str] = None
    ) -> dict:
        """Upload a file to Google Drive
        
        Args:
            file_name: Name of file
            file_content: File content as bytes
            mime_type: MIME type of file
            folder_id: Optional folder ID to upload to
            
        Returns:
            Dict with file_id and web_view_link
        """
        try:
            service = self.get_service()
            
            file_metadata = {'name': file_name}
            if folder_id:
                file_metadata['parents'] = [folder_id]
            
            # Create file in memory
            fh = io.BytesIO(file_content)
            media = MediaIoBaseUpload(fh, mimetype=mime_type, resumable=True)
            
            file = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, webViewLink'
            ).execute()
            
            logger.info(f'File uploaded: {file["id"]}')
            return {
                'file_id': file['id'],
                'web_view_link': file.get('webViewLink')
            }
            
        except HttpError as error:
            logger.error(f'Drive API error: {error}')
            raise Exception(f'Drive API error: {error}')
    
    async def list_files(self, folder_id: Optional[str] = None) -> List[dict]:
        """List files in Google Drive
        
        Args:
            folder_id: Optional folder ID to list files from
            
        Returns:
            List of file metadata dicts
        """
        try:
            service = self.get_service()
            
            query = "trashed=false"
            if folder_id:
                query += f" and '{folder_id}' in parents"
            
            results = service.files().list(
                q=query,
                pageSize=100,
                fields="files(id, name, mimeType, createdTime, webViewLink)"
            ).execute()
            
            return results.get('files', [])
            
        except HttpError as error:
            logger.error(f'Drive API error: {error}')
            raise Exception(f'Drive API error: {error}')

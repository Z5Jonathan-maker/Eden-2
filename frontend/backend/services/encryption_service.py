from cryptography.fernet import Fernet
import os
import logging

logger = logging.getLogger(__name__)

class EncryptionService:
    def __init__(self):
        encryption_key = os.getenv('ENCRYPTION_KEY')
        if not encryption_key:
            logger.warning('ENCRYPTION_KEY not set, generating temporary key')
            encryption_key = Fernet.generate_key().decode()
        self.cipher_suite = Fernet(encryption_key.encode())
    
    def encrypt_token(self, token: str) -> str:
        """Encrypt a token for secure storage"""
        encrypted = self.cipher_suite.encrypt(token.encode())
        return encrypted.decode()
    
    def decrypt_token(self, encrypted_token: str) -> str:
        """Decrypt a stored token"""
        decrypted = self.cipher_suite.decrypt(encrypted_token.encode())
        return decrypted.decode()

encryption = EncryptionService()

from fastapi import WebSocket
from typing import Dict, Set
import json
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages WebSocket connections for real-time notifications"""
    
    def __init__(self):
        # Map user_id to set of WebSocket connections (user can have multiple tabs)
        self.active_connections: Dict[str, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        logger.info(f"WebSocket connected for user {user_id}. Total connections: {len(self.active_connections[user_id])}")
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove a WebSocket connection"""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"WebSocket disconnected for user {user_id}")
    
    async def send_to_user(self, user_id: str, message: dict):
        """Send a message to all connections of a specific user"""
        if user_id in self.active_connections:
            dead_connections = set()
            for websocket in self.active_connections[user_id]:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to send WebSocket message: {e}")
                    dead_connections.add(websocket)
            
            # Clean up dead connections
            for ws in dead_connections:
                self.active_connections[user_id].discard(ws)
    
    async def broadcast_to_users(self, user_ids: list, message: dict):
        """Send a message to multiple users"""
        for user_id in user_ids:
            await self.send_to_user(user_id, message)
    
    def get_connected_users(self) -> list:
        """Get list of connected user IDs"""
        return list(self.active_connections.keys())

# Global connection manager instance
manager = ConnectionManager()

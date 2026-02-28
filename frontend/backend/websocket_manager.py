import asyncio
from fastapi import WebSocket
from typing import Dict, Set
import logging

logger = logging.getLogger(__name__)

MAX_CONNECTIONS_PER_USER = 10


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

        # Enforce per-user connection cap — evict oldest if over limit
        if len(self.active_connections[user_id]) >= MAX_CONNECTIONS_PER_USER:
            oldest = next(iter(self.active_connections[user_id]))
            self.active_connections[user_id].discard(oldest)
            try:
                await oldest.close(code=1008, reason="Too many connections")
            except Exception:
                pass

        self.active_connections[user_id].add(websocket)
        logger.info("WebSocket connected for user %s. Total: %d", user_id, len(self.active_connections[user_id]))

    async def register_accepted(self, websocket: WebSocket, user_id: str):
        """Register an already-accepted WebSocket connection (message-based auth flow)."""
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()

        # Enforce per-user cap
        if len(self.active_connections[user_id]) >= MAX_CONNECTIONS_PER_USER:
            oldest = next(iter(self.active_connections[user_id]))
            self.active_connections[user_id].discard(oldest)
            try:
                await oldest.close(code=1008, reason="Too many connections")
            except Exception:
                pass

        self.active_connections[user_id].add(websocket)
        logger.info("WebSocket registered for user %s. Total: %d", user_id, len(self.active_connections[user_id]))

    def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove a WebSocket connection"""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info("WebSocket disconnected for user %s", user_id)

    async def send_to_user(self, user_id: str, message: dict):
        """Send a message to all connections of a specific user"""
        if user_id not in self.active_connections:
            return

        # Snapshot the set to avoid mutation during iteration
        connections = list(self.active_connections.get(user_id, set()))
        dead_connections = []

        for websocket in connections:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.warning("Failed to send WebSocket message to %s: %s", user_id, e)
                dead_connections.append(websocket)

        # Clean up dead connections
        if dead_connections and user_id in self.active_connections:
            for ws in dead_connections:
                self.active_connections[user_id].discard(ws)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def broadcast_to_users(self, user_ids: list, message: dict):
        """Send a message to multiple users concurrently"""
        if not user_ids:
            return
        await asyncio.gather(
            *(self.send_to_user(uid, message) for uid in user_ids),
            return_exceptions=True,
        )

    def get_connected_users(self) -> list:
        """Get list of connected user IDs"""
        return list(self.active_connections.keys())


# Global connection manager instance
manager = ConnectionManager()

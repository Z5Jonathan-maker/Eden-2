"""
Integrations Hub - Centralized integration management for Eden

This module provides a single source of truth for all external service integrations.
Each integration has its own client file, and this __init__.py exports the status API.

Integration Pattern:
1. Each service has a dedicated client file (gamma_client.py, google_client.py, etc.)
2. OAuth flows are handled server-side, tokens stored in DB
3. Frontend only sees connect/disconnect buttons and status
4. One integration = one clear job

Services:
- Gamma: Presentations (API key)
- Google: Calendar, Drive, Slides, Gmail (OAuth)
- SignNow: Contracts (OAuth)
- Stripe: Payments (API key) - handled separately in payments routes
"""

from .status import router as integrations_router
from .gamma_client import GammaClient
from .signnow_client import SignNowClient

__all__ = [
    'integrations_router',
    'GammaClient',
    'SignNowClient'
]

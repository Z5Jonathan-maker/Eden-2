"""CSRF protection middleware via custom header validation.

Requires state-changing requests (POST, PUT, PATCH, DELETE) to include
the ``X-Requested-With: XMLHttpRequest`` header. Browsers will not attach
custom headers on cross-origin requests without an approved CORS preflight,
so a forged form submission from a malicious site will be blocked.

Requests that carry a Bearer ``Authorization`` header (API/mobile clients)
or target webhook/callback endpoints are exempt.
"""

import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("eden.csrf")

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

# Paths that receive external server-to-server callbacks (no browser involved)
EXEMPT_PATH_PREFIXES = (
    "/health",
    "/api/status",
    "/api/auth/login",
    "/api/auth/signup",
    "/api/auth/register",
    "/api/auth/refresh",
    "/api/payments/webhook",
    "/api/sms/twilio/webhook",
    "/api/twilio/voice/inbound",
    "/api/oauth/",
)

REQUIRED_HEADER = "x-requested-with"
REQUIRED_VALUE = "XMLHttpRequest"


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """Reject state-changing requests that lack the X-Requested-With header.

    This is effective because:
    1. Simple cross-origin form POSTs cannot set custom headers.
    2. JS-based cross-origin requests trigger a CORS preflight; the server
       only allows origins listed in CORS_ORIGINS.
    3. Legitimate API clients use Bearer tokens (Authorization header),
       which are exempt from this check.
    """

    async def dispatch(self, request: Request, call_next):
        if request.method in SAFE_METHODS:
            return await call_next(request)

        path = request.url.path

        # Exempt webhook/callback paths
        if any(path.startswith(prefix) for prefix in EXEMPT_PATH_PREFIXES):
            return await call_next(request)

        # Exempt requests with Authorization header (API/mobile clients)
        if request.headers.get("authorization"):
            return await call_next(request)

        # Require X-Requested-With header for cookie-authenticated requests
        if request.headers.get(REQUIRED_HEADER) != REQUIRED_VALUE:
            logger.warning(
                "CSRF check failed: %s %s (missing %s header, ip=%s)",
                request.method,
                path,
                REQUIRED_HEADER,
                request.client.host if request.client else "unknown",
            )
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF validation failed"},
            )

        return await call_next(request)

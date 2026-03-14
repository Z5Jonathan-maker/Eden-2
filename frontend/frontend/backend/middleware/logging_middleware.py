import time
import json
import logging
import uuid
import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.logger = logging.getLogger("eden.access")
        # Ensure we don't duplicate handlers if re-initialized
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter('%(message)s'))
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
        
        self.enabled = os.environ.get("ENABLE_STRUCTURED_LOGGING", "false").lower() == "true"

    async def dispatch(self, request: Request, call_next):
        # Skip if disabled or if it's a health check (too noisy)
        if not self.enabled or request.url.path in ["/health", "/api/health"]:
            return await call_next(request)

        start_time = time.time()
        request_id = str(uuid.uuid4())
        
        # Attach request_id to request state
        request.state.request_id = request_id

        try:
            response = await call_next(request)
            
            process_time = (time.time() - start_time) * 1000
            
            log_data = {
                "timestamp": time.time(),
                "level": "INFO",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(process_time, 2),
                "client_ip": request.client.host if request.client else None,
            }
            
            self.logger.info(json.dumps(log_data))
            
            # Add header for client tracing
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            # Log the error with context before re-raising for the global exception handler
            process_time = (time.time() - start_time) * 1000
            log_data = {
                "timestamp": time.time(),
                "level": "ERROR",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "error": str(e),
                "duration_ms": round(process_time, 2)
            }
            self.logger.error(json.dumps(log_data))
            raise e

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from services.observability import get_logger, correlation_id_ctx, MetricsCollector
import uuid
import time

# Create structured logger for middleware
logger = get_logger("eden.middleware")

class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # 1. Generate or extract correlation ID
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        token = correlation_id_ctx.set(correlation_id)
        
        # 2. Extract context
        path = request.url.path
        method = request.method
        
        try:
            # 3. Process Request
            response = await call_next(request)
            
            # 4. Calculate metrics
            duration_ms = (time.time() - start_time) * 1000
            status_code = response.status_code
            
            # 5. Log Access (Structured)
            logger.info(
                f"{method} {path} {status_code}",
                method=method,
                path=path,
                status_code=status_code,
                duration_ms=round(duration_ms, 2),
                user_agent=request.headers.get("user-agent", "unknown")
            )
            
            # 6. Record Metrics
            MetricsCollector.increment("http_requests_total", {"method": method, "status": str(status_code)})
            MetricsCollector.record_timing("http_request_duration_ms", duration_ms, {"path": path})
            
            # 7. Add correlation ID to response headers
            response.headers["X-Correlation-ID"] = correlation_id
            
            return response
            
        except Exception as e:
            # Log failure with context
            duration_ms = (time.time() - start_time) * 1000
            logger.error(
                f"Request failed: {str(e)}",
                method=method,
                path=path,
                error=str(e),
                duration_ms=round(duration_ms, 2)
            )
            MetricsCollector.increment("http_requests_failed", {"method": method})
            raise
            
        finally:
            # Clean up context
            correlation_id_ctx.reset(token)

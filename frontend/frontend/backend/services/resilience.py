import asyncio
import logging
import functools
from typing import Callable, Any, TypeVar

T = TypeVar("T")
logger = logging.getLogger("eden.resilience")

class CircuitBreakerOpen(Exception):
    pass

class CircuitBreaker:
    """
    Simple circuit breaker pattern.
    Objective: Failure Containment
    """
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failures = 0
        self.last_failure_time = 0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    def allow_request(self) -> bool:
        if self.state == "OPEN":
            if asyncio.get_event_loop().time() - self.last_failure_time > self.recovery_timeout:
                self.state = "HALF_OPEN"
                return True
            return False
        return True

    def record_success(self):
        self.failures = 0
        self.state = "CLOSED"

    def record_failure(self):
        self.failures += 1
        self.last_failure_time = asyncio.get_event_loop().time()
        if self.failures >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning(f"Circuit breaker opened due to {self.failures} failures")

# Decorator for retry logic
def retry_with_backoff(retries: int = 3, backoff_in_seconds: int = 1):
    def decorator(func: Callable[..., Any]):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            x = 0
            while True:
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    if x == retries:
                        logger.error(f"Function {func.__name__} failed after {retries} retries: {e}")
                        raise
                    sleep = (backoff_in_seconds * 2 ** x)
                    logger.warning(f"Retrying {func.__name__} in {sleep}s... (Attempt {x+1}/{retries})")
                    await asyncio.sleep(sleep)
                    x += 1
        return wrapper
    return decorator

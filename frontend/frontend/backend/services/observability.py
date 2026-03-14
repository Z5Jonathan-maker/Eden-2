import logging
import json
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from contextvars import ContextVar
import uuid

# Context variable for correlation ID
correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="unknown")

class StructuredLogger:
    """
    Structured logger that enforces JSON format and correlation IDs.
    Objective: Observability & System Insight
    """
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        # Ensure handlers are set up (usually done in main config, but safety net here)
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

    def _format_log(self, level: str, message: str, **kwargs) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "correlation_id": correlation_id_ctx.get(),
            "message": message,
            **kwargs
        }
        return json.dumps(log_entry)

    def info(self, message: str, **kwargs):
        self.logger.info(self._format_log("INFO", message, **kwargs))

    def warning(self, message: str, **kwargs):
        self.logger.warning(self._format_log("WARNING", message, **kwargs))

    def error(self, message: str, **kwargs):
        self.logger.error(self._format_log("ERROR", message, **kwargs))

    def audit(self, action: str, user_email: str, resource_id: str, details: Dict[str, Any] = None):
        """Specialized log for domain events / audit trail"""
        self.info(
            f"AUDIT: {action}",
            type="audit",
            action=action,
            user=user_email,
            resource_id=resource_id,
            details=details or {}
        )

# Metrics Storage (In-Memory for now, can be exported to Prometheus/Datadog)
class MetricsCollector:
    """
    Minimal metrics collector for key operational signals.
    Objective: Metrics & Signals
    """
    _counters: Dict[str, int] = {}
    _timings: Dict[str, list] = {}

    @classmethod
    def increment(cls, metric_name: str, labels: Dict[str, str] = None):
        key = cls._build_key(metric_name, labels)
        cls._counters[key] = cls._counters.get(key, 0) + 1

    @classmethod
    def record_timing(cls, metric_name: str, duration_ms: float, labels: Dict[str, str] = None):
        key = cls._build_key(metric_name, labels)
        if key not in cls._timings:
            cls._timings[key] = []
        cls._timings[key].append(duration_ms)
        # Keep only last 100 samples to avoid memory leak in simple implementation
        if len(cls._timings[key]) > 100:
            cls._timings[key].pop(0)

    @staticmethod
    def _build_key(name: str, labels: Dict[str, str] = None) -> str:
        if not labels:
            return name
        label_str = ",".join(f"{k}={v}" for k, v in sorted(labels.items()))
        return f"{name}[{label_str}]"

    @classmethod
    def get_snapshot(cls) -> Dict[str, Any]:
        """Return snapshot of current metrics for introspection"""
        snapshot = {
            "counters": cls._counters.copy(),
            "timings": {}
        }
        for key, values in cls._timings.items():
            if values:
                avg = sum(values) / len(values)
                snapshot["timings"][key] = {
                    "avg_ms": round(avg, 2),
                    "p95_ms": round(sorted(values)[int(len(values) * 0.95)], 2),
                    "count": len(values)
                }
        return snapshot

# Global instance factory
def get_logger(name: str) -> StructuredLogger:
    return StructuredLogger(name)

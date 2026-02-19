"""Evidence services package."""

from .constants import (
    EVIDENCE_EVENT_TYPES,
    EVENT_TYPE_PRIORITY,
    REVIEW_QUEUE_THRESHOLD,
    AUTO_INGEST_THRESHOLD,
)


def __getattr__(name):
    if name == "EvidenceIngestionService":
        from .ingestion import EvidenceIngestionService

        return EvidenceIngestionService
    if name == "EvidenceReportService":
        from .reports import EvidenceReportService

        return EvidenceReportService
    if name == "TimelineProjector":
        from .timeline import TimelineProjector

        return TimelineProjector
    raise AttributeError(name)

__all__ = [
    "EVIDENCE_EVENT_TYPES",
    "EVENT_TYPE_PRIORITY",
    "REVIEW_QUEUE_THRESHOLD",
    "AUTO_INGEST_THRESHOLD",
    "EvidenceIngestionService",
    "EvidenceReportService",
    "TimelineProjector",
]

#!/usr/bin/env python3
"""Create MongoDB indexes for claim evidence collections."""
from __future__ import annotations

import asyncio
import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "").strip()
DB_NAME = os.getenv("DB_NAME", "eden_claims").strip() or "eden_claims"


async def create_evidence_indexes() -> None:
    if not MONGO_URL:
        raise RuntimeError("MONGO_URL is required")

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"Connected: {DB_NAME}")
    print("Creating evidence indexes...")

    await db.claim_events.create_index(
        [("claim_id", 1), ("dedupe_key", 1)],
        unique=True,
        name="idx_claim_events_claim_dedupe_unique",
    )
    await db.claim_events.create_index(
        [("claim_id", 1), ("occurred_at", 1), ("event_type_priority", 1), ("source_id", 1)],
        name="idx_claim_events_timeline_order",
    )
    await db.claim_events.create_index(
        [("claim_id", 1), ("event_type", 1)],
        name="idx_claim_events_type",
    )
    await db.claim_events.create_index(
        [("claim_id", 1), ("thread_id", 1)],
        name="idx_claim_events_thread",
    )

    await db.evidence_items.create_index(
        [("claim_id", 1), ("kind", 1), ("dedupe_key", 1)],
        unique=True,
        name="idx_evidence_items_claim_kind_dedupe_unique",
    )
    await db.evidence_items.create_index(
        [("claim_id", 1), ("kind", 1), ("occurred_at", -1)],
        name="idx_evidence_items_kind_occurred",
    )
    await db.evidence_items.create_index(
        [("claim_id", 1), ("source_system", 1), ("source_id", 1)],
        name="idx_evidence_items_source",
    )
    await db.evidence_items.create_index(
        [("checksum", 1)],
        name="idx_evidence_items_checksum",
    )
    await db.evidence_items.create_index(
        [("title", "text")],
        name="idx_evidence_items_title_text",
    )

    await db.evidence_links.create_index(
        [("event_id", 1), ("evidence_item_id", 1), ("link_type", 1)],
        unique=True,
        name="idx_evidence_links_unique",
    )
    await db.evidence_links.create_index(
        [("claim_id", 1), ("event_id", 1)],
        name="idx_evidence_links_event",
    )
    await db.evidence_links.create_index(
        [("claim_id", 1), ("evidence_item_id", 1)],
        name="idx_evidence_links_item",
    )

    await db.ingestion_runs.create_index(
        [("claim_id", 1), ("idempotency_key", 1)],
        unique=True,
        name="idx_ingestion_runs_claim_idempotency_unique",
    )
    await db.ingestion_runs.create_index(
        [("claim_id", 1), ("started_at", -1)],
        name="idx_ingestion_runs_claim_started",
    )
    await db.ingestion_runs.create_index(
        [("status", 1), ("started_at", -1)],
        name="idx_ingestion_runs_status_started",
    )

    await db.evidence_review_queue.create_index(
        [("claim_id", 1), ("status", 1), ("created_at", -1)],
        name="idx_review_queue_claim_status_created",
    )
    await db.evidence_review_queue.create_index(
        [("run_id", 1), ("status", 1)],
        name="idx_review_queue_run_status",
    )

    await db.report_templates.create_index(
        [("report_type", 1), ("version", 1)],
        unique=True,
        name="idx_report_templates_type_version_unique",
    )
    await db.report_templates.create_index(
        [("report_type", 1), ("is_active", 1)],
        name="idx_report_templates_active",
    )

    await db.report_jobs.create_index(
        [("claim_id", 1), ("created_at", -1)],
        name="idx_report_jobs_claim_created",
    )
    await db.report_jobs.create_index(
        [("status", 1), ("created_at", -1)],
        name="idx_report_jobs_status_created",
    )

    await db.generated_reports.create_index(
        [("claim_id", 1), ("created_at", -1)],
        name="idx_generated_reports_claim_created",
    )
    await db.generated_reports.create_index(
        [("claim_id", 1), ("report_type", 1)],
        name="idx_generated_reports_claim_type",
    )

    print("Evidence indexes created.")
    client.close()


if __name__ == "__main__":
    asyncio.run(create_evidence_indexes())


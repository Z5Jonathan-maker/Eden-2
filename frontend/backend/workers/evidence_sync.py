"""Nightly claim evidence ingestion worker."""
from __future__ import annotations

import logging
import os
from datetime import timedelta

from services.evidence.ingestion import EvidenceIngestionService
from services.evidence.schemas import IngestionRunCreate
from services.evidence.storage import ObjectStorageService
from services.evidence.utils import make_dedupe_key, utc_now

logger = logging.getLogger(__name__)

_db = None


def init_evidence_sync(db) -> None:
    global _db
    _db = db


async def run_nightly_sync() -> None:
    if _db is None:
        logger.warning("evidence_sync_skipped: db not initialized")
        return

    storage = ObjectStorageService()
    if not storage.configured:
        logger.warning("evidence_sync_skipped: EVIDENCE_STORAGE_BUCKET not configured")
        return

    max_claims = int(os.getenv("EVIDENCE_NIGHTLY_MAX_CLAIMS", "150"))
    now = utc_now()
    window_start = now - timedelta(days=1)

    claims = await _db.claims.find(
        {"archived": {"$ne": True}},
        {"_id": 0},
    ).limit(max_claims).to_list(max_claims)

    service = EvidenceIngestionService(_db, storage=storage)
    processed = 0
    skipped = 0
    failed = 0

    for claim in claims:
        claim_id = claim.get("id")
        owner_id = claim.get("assigned_to_id") or claim.get("created_by")
        if not claim_id or not owner_id:
            skipped += 1
            continue

        run_request = IngestionRunCreate(
            mode="scheduled",
            window_start=window_start,
            window_end=now,
            idempotency_key=make_dedupe_key("nightly", claim_id, now.strftime("%Y-%m-%d")),
        )

        try:
            await service.ingest_claim_emails(
                claim=claim,
                current_user={"id": owner_id},
                run_request=run_request,
            )
            processed += 1
        except Exception:
            failed += 1
            logger.exception("evidence_nightly_claim_failed claim_id=%s owner_id=%s", claim_id, owner_id)

    logger.info(
        "evidence_nightly_summary processed=%s skipped=%s failed=%s window_start=%s window_end=%s",
        processed,
        skipped,
        failed,
        window_start.isoformat(),
        now.isoformat(),
    )


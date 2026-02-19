"""Claim-scoped Gmail evidence ingestion service."""
from __future__ import annotations

import base64
import io
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import fitz
import httpx
from docx import Document

from routes.oauth import get_valid_token, refresh_google_token
from services.observability import MetricsCollector

from .constants import AUTO_INGEST_THRESHOLD, EVENT_TYPE_PRIORITY, REVIEW_QUEUE_THRESHOLD
from .scoring import score_email_relevance
from .schemas import ClaimIdentityProfile, IngestionRunCreate
from .storage import ObjectStorageService
from .utils import (
    clean_tokens,
    ensure_datetime,
    make_dedupe_key,
    parse_headers,
    sha256_hex,
    stable_json_bytes,
    truncate,
    utc_now,
)

logger = logging.getLogger(__name__)

GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"


class EvidenceIngestionService:
    def __init__(self, db, storage: Optional[ObjectStorageService] = None):
        self.db = db
        self.storage = storage or ObjectStorageService()

    async def get_identity_profile(self, claim: Dict[str, Any]) -> ClaimIdentityProfile:
        claim_id = claim["id"]
        existing = await self.db.claim_identity_profiles.find_one(
            {"claim_id": claim_id},
            {"_id": 0},
        )

        default_profile = ClaimIdentityProfile(
            claim_id=claim_id,
            policyholder_names=clean_tokens([claim.get("client_name", "")]),
            addresses=clean_tokens([claim.get("property_address", "")]),
            policy_numbers=clean_tokens([claim.get("policy_number", "")]),
            claim_numbers=clean_tokens([claim.get("claim_number", ""), claim_id]),
            carrier_names=clean_tokens(
                [
                    claim.get("insurance_company", ""),
                    claim.get("carrier", ""),
                    claim.get("carrier_name", ""),
                ]
            ),
            adjuster_emails=clean_tokens(
                [
                    claim.get("adjuster_email", ""),
                    claim.get("carrier_email", ""),
                    claim.get("insurance_company_email", ""),
                ]
            ),
            subject_patterns=clean_tokens(
                [
                    claim.get("claim_number", ""),
                    claim.get("policy_number", ""),
                    f"Claim {claim.get('claim_number', '')}",
                    claim.get("client_name", ""),
                ]
            ),
        )

        if not existing:
            return default_profile

        merged = default_profile.model_dump()
        for key in (
            "policyholder_names",
            "addresses",
            "policy_numbers",
            "claim_numbers",
            "carrier_names",
            "adjuster_emails",
            "subject_patterns",
        ):
            merged[key] = clean_tokens(
                (default_profile.model_dump().get(key) or []) + (existing.get(key) or [])
            )

        return ClaimIdentityProfile(**merged)

    async def update_identity_profile(
        self,
        claim_id: str,
        payload: Dict[str, Any],
        actor_user_id: str,
    ) -> Dict[str, Any]:
        update_doc = {
            "claim_id": claim_id,
            "policyholder_names": clean_tokens(payload.get("policyholder_names") or []),
            "addresses": clean_tokens(payload.get("addresses") or []),
            "policy_numbers": clean_tokens(payload.get("policy_numbers") or []),
            "claim_numbers": clean_tokens(payload.get("claim_numbers") or []),
            "carrier_names": clean_tokens(payload.get("carrier_names") or []),
            "adjuster_emails": clean_tokens(payload.get("adjuster_emails") or []),
            "subject_patterns": clean_tokens(payload.get("subject_patterns") or []),
            "updated_at": utc_now(),
            "updated_by": actor_user_id,
        }
        await self.db.claim_identity_profiles.update_one(
            {"claim_id": claim_id},
            {
                "$set": update_doc,
                "$setOnInsert": {"created_at": utc_now()},
            },
            upsert=True,
        )
        return update_doc

    async def ingest_claim_emails(
        self,
        *,
        claim: Dict[str, Any],
        current_user: Dict[str, Any],
        run_request: IngestionRunCreate,
    ) -> Dict[str, Any]:
        if not self.storage.configured:
            raise RuntimeError("Evidence ingestion requires EVIDENCE_STORAGE_BUCKET")

        claim_id = claim["id"]
        started_at = utc_now()
        window_end = run_request.window_end or started_at
        window_start = run_request.window_start or (window_end - timedelta(days=30))
        idempotency_key = run_request.idempotency_key or make_dedupe_key(
            "ingest",
            claim_id,
            run_request.mode,
            str(window_start),
            str(window_end),
        )

        existing_run = await self.db.ingestion_runs.find_one(
            {"claim_id": claim_id, "idempotency_key": idempotency_key},
            {"_id": 0},
        )
        if existing_run and existing_run.get("status") in {"running", "completed", "partial"}:
            return existing_run

        run_id = str(uuid.uuid4())
        run_doc = {
            "id": run_id,
            "claim_id": claim_id,
            "triggered_by": current_user.get("id"),
            "mode": run_request.mode,
            "status": "running",
            "source_system": "gmail",
            "query_window_start": window_start,
            "query_window_end": window_end,
            "counts": {
                "fetched_messages": 0,
                "ingested_emails": 0,
                "ingested_attachments": 0,
                "review_queued": 0,
                "dedupe_hits": 0,
                "rejected": 0,
                "extraction_errors": 0,
                "errors": 0,
            },
            "errors": [],
            "steps": [],
            "started_at": started_at,
            "finished_at": None,
            "duration_ms": None,
            "idempotency_key": idempotency_key,
        }
        await self.db.ingestion_runs.insert_one(run_doc)

        try:
            profile = await self.get_identity_profile(claim)
            query = self._build_gmail_query(profile, window_start, window_end)
            message_ids = await self._list_message_ids(current_user, query)
            run_doc["counts"]["fetched_messages"] = len(message_ids)

            logger.info(
                "evidence_ingest_start claim_id=%s run_id=%s fetched=%s query=%s",
                claim_id,
                run_id,
                len(message_ids),
                query,
            )

            for message_id in message_ids:
                try:
                    outcome = await self._ingest_single_message(
                        claim_id=claim_id,
                        run_id=run_id,
                        current_user=current_user,
                        profile=profile,
                        message_id=message_id,
                    )
                    self._merge_counts(run_doc["counts"], outcome["counts"])
                    if outcome.get("review_item_ids"):
                        run_doc["steps"].append(
                            {
                                "step": "review_queue_insert",
                                "message_id": message_id,
                                "review_item_ids": outcome["review_item_ids"],
                                "occurred_at": utc_now(),
                            }
                        )
                except Exception as message_error:
                    logger.exception(
                        "evidence_ingest_message_failed claim_id=%s run_id=%s message_id=%s",
                        claim_id,
                        run_id,
                        message_id,
                    )
                    run_doc["counts"]["errors"] += 1
                    run_doc["errors"].append(
                        {
                            "message_id": message_id,
                            "error": str(message_error),
                            "occurred_at": utc_now(),
                        }
                    )

            run_doc["status"] = "partial" if run_doc["counts"]["errors"] > 0 else "completed"
            MetricsCollector.increment(
                "evidence_ingest_runs_total",
                {"status": run_doc["status"], "source": "gmail"},
            )
        except Exception as exc:
            logger.exception("evidence_ingest_failed claim_id=%s run_id=%s", claim_id, run_id)
            run_doc["status"] = "failed"
            run_doc["counts"]["errors"] += 1
            run_doc["errors"].append(
                {
                    "error": str(exc),
                    "occurred_at": utc_now(),
                }
            )
            MetricsCollector.increment(
                "evidence_ingest_runs_total",
                {"status": "failed", "source": "gmail"},
            )
        finally:
            finished_at = utc_now()
            run_doc["finished_at"] = finished_at
            run_doc["duration_ms"] = int((finished_at - started_at).total_seconds() * 1000)
            await self.db.ingestion_runs.update_one(
                {"id": run_id, "claim_id": claim_id},
                {
                    "$set": {
                        "status": run_doc["status"],
                        "counts": run_doc["counts"],
                        "errors": run_doc["errors"],
                        "steps": run_doc["steps"][-200:],
                        "finished_at": run_doc["finished_at"],
                        "duration_ms": run_doc["duration_ms"],
                    }
                },
            )
            MetricsCollector.record_timing(
                "evidence_ingest_duration_ms",
                float(run_doc["duration_ms"] or 0),
                {"source": "gmail"},
            )

        updated_run = await self.db.ingestion_runs.find_one(
            {"id": run_id, "claim_id": claim_id},
            {"_id": 0},
        )
        return updated_run or run_doc

    async def _ingest_single_message(
        self,
        *,
        claim_id: str,
        run_id: str,
        current_user: Dict[str, Any],
        profile: ClaimIdentityProfile,
        message_id: str,
    ) -> Dict[str, Any]:
        counts = {
            "fetched_messages": 0,
            "ingested_emails": 0,
            "ingested_attachments": 0,
            "review_queued": 0,
            "dedupe_hits": 0,
            "rejected": 0,
            "extraction_errors": 0,
            "errors": 0,
        }
        review_item_ids: List[str] = []

        raw_message = await self._get_full_message(current_user, message_id)
        normalized = self._normalize_message(raw_message)
        score, reasons, breakdown = score_email_relevance(profile=profile, message=normalized)

        logger.info(
            "evidence_relevance claim_id=%s run_id=%s message_id=%s score=%s reasons=%s",
            claim_id,
            run_id,
            message_id,
            score,
            ",".join(reasons),
        )

        if score < REVIEW_QUEUE_THRESHOLD:
            counts["rejected"] += 1
            MetricsCollector.increment("evidence_relevance_rejected_total", {"source": "gmail"})
            return {"counts": counts, "review_item_ids": review_item_ids}

        raw_payload = stable_json_bytes(raw_message)
        raw_checksum = sha256_hex(raw_payload)
        raw_storage_uri = self.storage.put_bytes(
            key=f"claims/{claim_id}/emails/{message_id}/raw.json",
            payload=raw_payload,
            content_type="application/json",
            metadata={"claim_id": claim_id, "source": "gmail", "run_id": run_id},
        )

        dedupe_key = make_dedupe_key(
            normalized.get("message_id"),
            raw_checksum,
            message_id,
            normalized.get("thread_id"),
        )
        review_status = "approved" if score >= AUTO_INGEST_THRESHOLD else "pending"

        email_item, created = await self._upsert_evidence_item(
            {
                "id": str(uuid.uuid4()),
                "claim_id": claim_id,
                "kind": "email",
                "title": normalized.get("subject") or "(no subject)",
                "source_system": "gmail",
                "source_id": message_id,
                "thread_id": normalized.get("thread_id"),
                "message_id": normalized.get("message_id"),
                "mime_type": "message/rfc822",
                "size_bytes": len(raw_payload),
                "checksum": raw_checksum,
                "storage_uri": raw_storage_uri,
                "extracted_text_uri": None,
                "metadata": {
                    "headers": normalized.get("headers"),
                    "label_ids": normalized.get("label_ids"),
                    "body_text": normalized.get("body_text"),
                    "body_html": normalized.get("body_html"),
                    "snippet": normalized.get("snippet"),
                    "score_breakdown": breakdown,
                    "relevance_reasons": reasons,
                    "run_id": run_id,
                },
                "occurred_at": normalized.get("occurred_at"),
                "ingested_at": utc_now(),
                "confidence_score": float(score),
                "dedupe_key": dedupe_key,
                "is_reviewed": review_status == "approved",
                "review_status": review_status,
                "tags": [],
            }
        )

        if not created:
            counts["dedupe_hits"] += 1
            MetricsCollector.increment("evidence_dedupe_hits_total", {"kind": "email"})
            if score >= AUTO_INGEST_THRESHOLD and email_item.get("review_status") != "approved":
                await self._approve_evidence_item(
                    claim_id=claim_id,
                    evidence_item_id=email_item["id"],
                    actor_user_id=current_user.get("id"),
                    tags=[],
                )
            return {"counts": counts, "review_item_ids": review_item_ids}

        if review_status == "approved":
            counts["ingested_emails"] += 1
            email_event_id = await self._ensure_event_for_email(email_item, current_user.get("id"))
        else:
            queue_id = await self._enqueue_review_item(
                claim_id=claim_id,
                run_id=run_id,
                evidence_item_id=email_item["id"],
                score=score,
                reasons=reasons,
            )
            if queue_id:
                counts["review_queued"] += 1
                review_item_ids.append(queue_id)
            email_event_id = None

        for attachment_meta in normalized.get("attachments") or []:
            attachment_outcome, queued_ids = await self._ingest_attachment(
                claim_id=claim_id,
                run_id=run_id,
                current_user=current_user,
                email_item=email_item,
                email_event_id=email_event_id,
                attachment_meta=attachment_meta,
                review_status=review_status,
                score=score,
                reasons=reasons,
            )
            self._merge_counts(counts, attachment_outcome)
            review_item_ids.extend(queued_ids)

        if review_status == "approved":
            MetricsCollector.increment("evidence_auto_ingested_total", {"kind": "email"})
        else:
            MetricsCollector.increment("evidence_review_queued_total", {"kind": "email"})

        return {"counts": counts, "review_item_ids": review_item_ids}

    async def _ingest_attachment(
        self,
        *,
        claim_id: str,
        run_id: str,
        current_user: Dict[str, Any],
        email_item: Dict[str, Any],
        email_event_id: Optional[str],
        attachment_meta: Dict[str, Any],
        review_status: str,
        score: int,
        reasons: List[str],
    ) -> Tuple[Dict[str, int], List[str]]:
        counts = {
            "fetched_messages": 0,
            "ingested_emails": 0,
            "ingested_attachments": 0,
            "review_queued": 0,
            "dedupe_hits": 0,
            "rejected": 0,
            "extraction_errors": 0,
            "errors": 0,
        }
        review_item_ids: List[str] = []

        attachment_id = attachment_meta.get("attachment_id")
        if not attachment_id:
            return counts, review_item_ids

        payload_bytes = await self._download_attachment(
            current_user,
            email_item.get("source_id"),
            attachment_id,
        )
        checksum = sha256_hex(payload_bytes)
        filename = attachment_meta.get("filename") or f"{attachment_id}.bin"
        dedupe_key = make_dedupe_key(
            checksum,
            filename,
            str(len(payload_bytes)),
            email_item.get("source_id"),
        )

        existing = await self.db.evidence_items.find_one(
            {"claim_id": claim_id, "kind": "attachment", "dedupe_key": dedupe_key},
            {"_id": 0},
        )
        if existing:
            counts["dedupe_hits"] += 1
            MetricsCollector.increment("evidence_dedupe_hits_total", {"kind": "attachment"})
            return counts, review_item_ids

        mime_type = attachment_meta.get("mime_type") or "application/octet-stream"
        safe_filename = filename.replace("\\", "_").replace("/", "_")
        storage_uri = self.storage.put_bytes(
            key=f"claims/{claim_id}/attachments/{email_item.get('source_id')}/{safe_filename}",
            payload=payload_bytes,
            content_type=mime_type,
            metadata={"claim_id": claim_id, "source": "gmail", "run_id": run_id},
        )

        extracted_text_uri = None
        try:
            extracted_text = self._extract_text(payload_bytes, safe_filename, mime_type)
            if extracted_text:
                extracted_text_uri = self.storage.put_text(
                    key=f"claims/{claim_id}/attachments/{email_item.get('source_id')}/{safe_filename}.txt",
                    payload=extracted_text,
                    content_type="text/plain; charset=utf-8",
                    metadata={"claim_id": claim_id, "source": "extractor"},
                )
        except Exception:
            counts["extraction_errors"] += 1
            MetricsCollector.increment("evidence_extraction_errors_total", {"kind": "attachment"})
            logger.exception(
                "evidence_attachment_extract_failed claim_id=%s attachment=%s",
                claim_id,
                safe_filename,
            )

        attachment_item, _ = await self._upsert_evidence_item(
            {
                "id": str(uuid.uuid4()),
                "claim_id": claim_id,
                "kind": "attachment",
                "title": safe_filename,
                "source_system": "gmail",
                "source_id": f"{email_item.get('source_id')}:{attachment_id}",
                "thread_id": email_item.get("thread_id"),
                "message_id": email_item.get("message_id"),
                "mime_type": mime_type,
                "size_bytes": len(payload_bytes),
                "checksum": checksum,
                "storage_uri": storage_uri,
                "extracted_text_uri": extracted_text_uri,
                "metadata": {
                    "attachment_id": attachment_id,
                    "email_evidence_item_id": email_item["id"],
                    "run_id": run_id,
                },
                "occurred_at": email_item.get("occurred_at"),
                "ingested_at": utc_now(),
                "confidence_score": float(score),
                "dedupe_key": dedupe_key,
                "is_reviewed": review_status == "approved",
                "review_status": review_status,
                "tags": [],
            }
        )

        if review_status == "approved":
            counts["ingested_attachments"] += 1
            attachment_event_id = await self._ensure_event_for_attachment(
                attachment_item,
                current_user.get("id"),
            )
            await self._create_evidence_link(
                claim_id=claim_id,
                event_id=attachment_event_id,
                evidence_item_id=attachment_item["id"],
                link_type="primary_source",
                source_ref={
                    "message_id": attachment_item.get("message_id"),
                    "storage_uri": attachment_item.get("storage_uri"),
                    "checksum": attachment_item.get("checksum"),
                },
            )
            if email_event_id:
                await self._create_evidence_link(
                    claim_id=claim_id,
                    event_id=email_event_id,
                    evidence_item_id=attachment_item["id"],
                    link_type="attachment_of",
                    source_ref={
                        "email_evidence_item_id": email_item["id"],
                        "attachment_id": attachment_id,
                    },
                )
        else:
            queue_id = await self._enqueue_review_item(
                claim_id=claim_id,
                run_id=run_id,
                evidence_item_id=attachment_item["id"],
                score=score,
                reasons=reasons + ["attachment pending review"],
            )
            if queue_id:
                counts["review_queued"] += 1
                review_item_ids.append(queue_id)

        return counts, review_item_ids

    async def _upsert_evidence_item(self, item: Dict[str, Any]) -> Tuple[Dict[str, Any], bool]:
        existing = await self.db.evidence_items.find_one(
            {"claim_id": item["claim_id"], "kind": item["kind"], "dedupe_key": item["dedupe_key"]},
            {"_id": 0},
        )
        if existing:
            return existing, False
        await self.db.evidence_items.insert_one(item)
        return item, True

    async def _approve_evidence_item(
        self,
        *,
        claim_id: str,
        evidence_item_id: str,
        actor_user_id: str,
        tags: List[str],
    ) -> Optional[str]:
        item = await self.db.evidence_items.find_one(
            {"claim_id": claim_id, "id": evidence_item_id},
            {"_id": 0},
        )
        if not item:
            return None

        merged_tags = clean_tokens((item.get("tags") or []) + (tags or []))
        await self.db.evidence_items.update_one(
            {"claim_id": claim_id, "id": evidence_item_id},
            {
                "$set": {
                    "is_reviewed": True,
                    "review_status": "approved",
                    "tags": merged_tags,
                    "reviewed_at": utc_now(),
                    "reviewed_by": actor_user_id,
                }
            },
        )

        if item.get("kind") == "email":
            return await self._ensure_event_for_email({**item, "tags": merged_tags}, actor_user_id)
        if item.get("kind") == "attachment":
            event_id = await self._ensure_event_for_attachment({**item, "tags": merged_tags}, actor_user_id)
            await self._create_evidence_link(
                claim_id=claim_id,
                event_id=event_id,
                evidence_item_id=item["id"],
                link_type="primary_source",
                source_ref={
                    "message_id": item.get("message_id"),
                    "storage_uri": item.get("storage_uri"),
                    "checksum": item.get("checksum"),
                },
            )
            return event_id
        return None

    async def approve_review_item(
        self,
        *,
        claim_id: str,
        queue_id: str,
        actor_user_id: str,
        tags: List[str],
        note: str,
    ) -> Dict[str, Any]:
        queue_item = await self.db.evidence_review_queue.find_one(
            {"id": queue_id, "claim_id": claim_id},
            {"_id": 0},
        )
        if not queue_item:
            raise ValueError("Review queue item not found")
        if queue_item.get("status") != "pending":
            return {"ok": True, "event_ids": []}

        event_id = await self._approve_evidence_item(
            claim_id=claim_id,
            evidence_item_id=queue_item["evidence_item_id"],
            actor_user_id=actor_user_id,
            tags=tags,
        )

        await self.db.evidence_review_queue.update_one(
            {"id": queue_id, "claim_id": claim_id},
            {
                "$set": {
                    "status": "approved",
                    "decided_by": actor_user_id,
                    "decided_at": utc_now(),
                    "decision_note": note or "",
                }
            },
        )

        return {"ok": True, "event_ids": [event_id] if event_id else []}

    async def reject_review_item(
        self,
        *,
        claim_id: str,
        queue_id: str,
        actor_user_id: str,
        reason: str,
    ) -> Dict[str, Any]:
        queue_item = await self.db.evidence_review_queue.find_one(
            {"id": queue_id, "claim_id": claim_id},
            {"_id": 0},
        )
        if not queue_item:
            raise ValueError("Review queue item not found")
        if queue_item.get("status") != "pending":
            return {"ok": True}

        await self.db.evidence_review_queue.update_one(
            {"id": queue_id, "claim_id": claim_id},
            {
                "$set": {
                    "status": "rejected",
                    "decided_by": actor_user_id,
                    "decided_at": utc_now(),
                    "decision_note": reason,
                }
            },
        )
        await self.db.evidence_items.update_one(
            {"claim_id": claim_id, "id": queue_item["evidence_item_id"]},
            {
                "$set": {
                    "is_reviewed": True,
                    "review_status": "rejected",
                    "reviewed_at": utc_now(),
                    "reviewed_by": actor_user_id,
                }
            },
        )
        return {"ok": True}

    async def _enqueue_review_item(
        self,
        *,
        claim_id: str,
        run_id: str,
        evidence_item_id: str,
        score: int,
        reasons: List[str],
    ) -> Optional[str]:
        existing = await self.db.evidence_review_queue.find_one(
            {
                "claim_id": claim_id,
                "evidence_item_id": evidence_item_id,
                "status": "pending",
            },
            {"_id": 0, "id": 1},
        )
        if existing:
            return existing.get("id")

        queue_id = str(uuid.uuid4())
        await self.db.evidence_review_queue.insert_one(
            {
                "id": queue_id,
                "claim_id": claim_id,
                "evidence_item_id": evidence_item_id,
                "run_id": run_id,
                "score": score,
                "reasons": reasons,
                "status": "pending",
                "decided_by": None,
                "decided_at": None,
                "created_at": utc_now(),
            }
        )
        return queue_id

    async def _ensure_event_for_email(self, email_item: Dict[str, Any], actor_user_id: str) -> str:
        event_type = self._classify_email_event(email_item.get("metadata", {}).get("label_ids") or [])
        event_dedupe_key = make_dedupe_key("event", email_item.get("id"), event_type)
        event = {
            "id": event_dedupe_key,
            "claim_id": email_item["claim_id"],
            "event_type": event_type,
            "occurred_at": ensure_datetime(email_item.get("occurred_at")),
            "ingested_at": utc_now(),
            "source_system": "gmail",
            "source_id": email_item.get("source_id"),
            "thread_id": email_item.get("thread_id"),
            "parties": self._extract_parties(email_item),
            "tags": clean_tokens(email_item.get("tags") or []),
            "confidence_score": float(email_item.get("confidence_score") or 0),
            "dedupe_key": event_dedupe_key,
            "summary": truncate(email_item.get("title") or "Email activity"),
            "event_type_priority": EVENT_TYPE_PRIORITY.get(event_type, 999),
            "created_by": actor_user_id,
            "updated_at": utc_now(),
        }
        event_id = await self._upsert_event(event)
        await self._create_evidence_link(
            claim_id=email_item["claim_id"],
            event_id=event_id,
            evidence_item_id=email_item["id"],
            link_type="primary_source",
            source_ref={
                "message_id": email_item.get("message_id"),
                "storage_uri": email_item.get("storage_uri"),
                "checksum": email_item.get("checksum"),
            },
        )
        return event_id

    async def _ensure_event_for_attachment(
        self,
        attachment_item: Dict[str, Any],
        actor_user_id: str,
    ) -> str:
        event_type = self._classify_attachment_event(attachment_item.get("title") or "")
        event_dedupe_key = make_dedupe_key("event", attachment_item.get("id"), event_type)
        event = {
            "id": event_dedupe_key,
            "claim_id": attachment_item["claim_id"],
            "event_type": event_type,
            "occurred_at": ensure_datetime(attachment_item.get("occurred_at")),
            "ingested_at": utc_now(),
            "source_system": "gmail",
            "source_id": attachment_item.get("source_id"),
            "thread_id": attachment_item.get("thread_id"),
            "parties": {},
            "tags": clean_tokens(attachment_item.get("tags") or []),
            "confidence_score": float(attachment_item.get("confidence_score") or 0),
            "dedupe_key": event_dedupe_key,
            "summary": truncate(f"Attachment added: {attachment_item.get('title') or 'file'}"),
            "event_type_priority": EVENT_TYPE_PRIORITY.get(event_type, 999),
            "created_by": actor_user_id,
            "updated_at": utc_now(),
        }
        return await self._upsert_event(event)

    async def _upsert_event(self, event: Dict[str, Any]) -> str:
        existing = await self.db.claim_events.find_one(
            {"claim_id": event["claim_id"], "dedupe_key": event["dedupe_key"]},
            {"_id": 0, "id": 1},
        )
        if existing:
            return existing["id"]
        await self.db.claim_events.insert_one(event)
        return event["id"]

    async def _create_evidence_link(
        self,
        *,
        claim_id: str,
        event_id: str,
        evidence_item_id: str,
        link_type: str,
        source_ref: Dict[str, Any],
    ) -> None:
        existing = await self.db.evidence_links.find_one(
            {
                "claim_id": claim_id,
                "event_id": event_id,
                "evidence_item_id": evidence_item_id,
                "link_type": link_type,
            },
            {"_id": 0, "id": 1},
        )
        if existing:
            return
        await self.db.evidence_links.insert_one(
            {
                "id": str(uuid.uuid4()),
                "claim_id": claim_id,
                "event_id": event_id,
                "evidence_item_id": evidence_item_id,
                "link_type": link_type,
                "source_ref": source_ref,
                "created_at": utc_now(),
            }
        )

    def _build_gmail_query(
        self,
        profile: ClaimIdentityProfile,
        window_start: datetime,
        window_end: datetime,
    ) -> str:
        tokens = clean_tokens(
            profile.claim_numbers
            + profile.policy_numbers
            + profile.subject_patterns
            + profile.addresses
            + profile.policyholder_names
            + profile.adjuster_emails
            + profile.carrier_names
        )

        token_clause = " OR ".join(f'"{token}"' for token in tokens[:20]) or ""
        query_parts: List[str] = []
        if token_clause:
            query_parts.append(f"({token_clause})")
        query_parts.append(f"after:{window_start.strftime('%Y/%m/%d')}")
        query_parts.append(f"before:{window_end.strftime('%Y/%m/%d')}")
        return " ".join(query_parts)

    async def _list_message_ids(self, current_user: Dict[str, Any], query: str) -> List[str]:
        response = await self._google_request(
            current_user,
            "GET",
            f"{GMAIL_API}/messages",
            params={"q": query, "maxResults": 200},
        )
        return [item.get("id") for item in (response.get("messages") or []) if item.get("id")]

    async def _get_full_message(
        self,
        current_user: Dict[str, Any],
        message_id: str,
    ) -> Dict[str, Any]:
        return await self._google_request(
            current_user,
            "GET",
            f"{GMAIL_API}/messages/{message_id}",
            params={"format": "full"},
        )

    async def _download_attachment(
        self,
        current_user: Dict[str, Any],
        message_id: str,
        attachment_id: str,
    ) -> bytes:
        payload = await self._google_request(
            current_user,
            "GET",
            f"{GMAIL_API}/messages/{message_id}/attachments/{attachment_id}",
        )
        raw = payload.get("data")
        if not raw:
            return b""
        return base64.urlsafe_b64decode(raw.encode("utf-8"))

    async def _google_request(
        self,
        current_user: Dict[str, Any],
        method: str,
        url: str,
        **kwargs,
    ) -> Dict[str, Any]:
        user_id = current_user.get("id")
        if not user_id:
            raise RuntimeError("Current user id missing")

        token = await get_valid_token(user_id, "google")
        if not token:
            raise RuntimeError("Google account not connected")

        async with httpx.AsyncClient(timeout=40.0) as client:
            response = await client.request(
                method,
                url,
                headers={"Authorization": f"Bearer {token}"},
                **kwargs,
            )
            if response.status_code == 401:
                token = await refresh_google_token(user_id)
                if not token:
                    raise RuntimeError("Google token expired; reconnect required")
                response = await client.request(
                    method,
                    url,
                    headers={"Authorization": f"Bearer {token}"},
                    **kwargs,
                )
            if response.status_code >= 400:
                detail = response.text
                try:
                    error_payload = response.json()
                    if isinstance(error_payload, dict):
                        detail = str(error_payload.get("error", detail))
                except Exception:
                    pass
                raise RuntimeError(f"Gmail API error ({response.status_code}): {detail}")
            return response.json()

    def _normalize_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        payload = message.get("payload") or {}
        headers = parse_headers(payload.get("headers") or [])
        body = self._extract_body(payload)
        attachments = self._collect_attachments(payload)
        occurred_at = ensure_datetime(message.get("internalDate") or headers.get("date"))

        return {
            "source_id": message.get("id"),
            "thread_id": message.get("threadId"),
            "message_id": headers.get("message-id"),
            "subject": headers.get("subject", ""),
            "headers": headers,
            "body_text": body.get("body_text", ""),
            "body_html": body.get("body_html", ""),
            "snippet": message.get("snippet", ""),
            "label_ids": message.get("labelIds") or [],
            "attachments": attachments,
            "occurred_at": occurred_at,
        }

    def _extract_body(self, payload: Dict[str, Any]) -> Dict[str, str]:
        body_text = ""
        body_html = ""

        def walk(part: Dict[str, Any]) -> None:
            nonlocal body_text, body_html
            mime = str(part.get("mimeType") or "")
            raw_data = ((part.get("body") or {}).get("data") or "").strip()
            if raw_data:
                decoded = base64.urlsafe_b64decode(raw_data.encode("utf-8")).decode(
                    "utf-8",
                    errors="replace",
                )
                if mime == "text/plain" and not body_text:
                    body_text = decoded
                elif mime == "text/html" and not body_html:
                    body_html = decoded

            for child in part.get("parts") or []:
                walk(child)

        walk(payload)
        return {"body_text": body_text, "body_html": body_html}

    def _collect_attachments(self, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        attachments: List[Dict[str, Any]] = []

        def walk(part: Dict[str, Any]) -> None:
            filename = (part.get("filename") or "").strip()
            body = part.get("body") or {}
            attachment_id = body.get("attachmentId")
            if filename and attachment_id:
                attachments.append(
                    {
                        "filename": filename,
                        "mime_type": part.get("mimeType") or "application/octet-stream",
                        "size": int(body.get("size") or 0),
                        "attachment_id": attachment_id,
                    }
                )
            for child in part.get("parts") or []:
                walk(child)

        walk(payload)
        return attachments

    def _extract_text(self, payload: bytes, filename: str, mime_type: str) -> str:
        lowered_name = filename.lower()
        lowered_type = (mime_type or "").lower()

        if lowered_name.endswith(".pdf") or "pdf" in lowered_type:
            doc = fitz.open(stream=payload, filetype="pdf")
            try:
                pages: List[str] = []
                for page in doc:
                    pages.append(page.get_text("text"))
                return "\n".join(pages).strip()
            finally:
                doc.close()

        if lowered_name.endswith(".docx") or "officedocument.wordprocessingml.document" in lowered_type:
            docx_doc = Document(io.BytesIO(payload))
            return "\n".join((p.text or "") for p in docx_doc.paragraphs).strip()

        if lowered_name.endswith(".txt") or lowered_type.startswith("text/"):
            return payload.decode("utf-8", errors="replace").strip()

        if lowered_name.endswith(".csv"):
            return payload.decode("utf-8", errors="replace").strip()

        return ""

    def _classify_email_event(self, label_ids: List[str]) -> str:
        labels = {str(label).upper() for label in (label_ids or [])}
        return "EMAIL_SENT" if "SENT" in labels else "EMAIL_RECEIVED"

    def _classify_attachment_event(self, filename: str) -> str:
        token = filename.lower()
        if "estimate" in token and ("rev" in token or "supp" in token):
            return "ESTIMATE_REVISED"
        if "estimate" in token:
            return "ESTIMATE_UPLOADED"
        return "ATTACHMENT_ADDED"

    def _extract_parties(self, email_item: Dict[str, Any]) -> Dict[str, Any]:
        headers = (email_item.get("metadata") or {}).get("headers") or {}
        return {
            "from": headers.get("from"),
            "to": headers.get("to"),
            "cc": headers.get("cc"),
            "bcc": headers.get("bcc"),
        }

    def _merge_counts(self, target: Dict[str, int], source: Dict[str, int]) -> None:
        for key, value in source.items():
            target[key] = int(target.get(key, 0)) + int(value or 0)

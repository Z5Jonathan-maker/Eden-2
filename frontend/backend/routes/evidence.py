"""Claim evidence, timeline, and reporting routes."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from dependencies import db, get_current_active_user
from routes.claims import _get_claim_for_user_or_403
from services.evidence.ingestion import EvidenceIngestionService
from services.evidence.reports import EvidenceReportService
from services.evidence.schemas import (
    IngestionRunCreate,
    RejectDecision,
    ReportGenerateRequest,
    ReviewDecision,
    ShareLinkRequest,
)
from services.evidence.storage import ObjectStorageService
from services.evidence.timeline import TimelineProjector
from services.evidence.utils import ensure_datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/claims", tags=["claim-evidence"])


def _to_int(value: Optional[int], default: int, min_value: int, max_value: int) -> int:
    if value is None:
        return default
    return max(min_value, min(max_value, int(value)))


def _evidence_service() -> EvidenceIngestionService:
    return EvidenceIngestionService(db, storage=ObjectStorageService())


def _report_service() -> EvidenceReportService:
    return EvidenceReportService(db, storage=ObjectStorageService())


def _timeline_service() -> TimelineProjector:
    return TimelineProjector(db)


async def _claim_or_403(claim_id: str, current_user: dict) -> dict:
    return await _get_claim_for_user_or_403(claim_id, current_user)


@router.get("/{claim_id}/identity-profile")
async def get_claim_identity_profile(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    claim = await _claim_or_403(claim_id, current_user)
    service = _evidence_service()
    profile = await service.get_identity_profile(claim)
    return profile.model_dump()


@router.put("/{claim_id}/identity-profile")
async def update_claim_identity_profile(
    claim_id: str,
    payload: Dict[str, Any],
    current_user: dict = Depends(get_current_active_user),
):
    await _claim_or_403(claim_id, current_user)
    service = _evidence_service()
    updated = await service.update_identity_profile(
        claim_id=claim_id,
        payload=payload,
        actor_user_id=current_user.get("id"),
    )
    return updated


@router.post("/{claim_id}/evidence/ingest/run")
async def run_claim_evidence_ingestion(
    claim_id: str,
    run_request: IngestionRunCreate,
    current_user: dict = Depends(get_current_active_user),
):
    claim = await _claim_or_403(claim_id, current_user)
    service = _evidence_service()
    try:
        run_doc = await service.ingest_claim_emails(
            claim=claim,
            current_user=current_user,
            run_request=run_request,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "run_id": run_doc.get("id"),
        "status": run_doc.get("status"),
        "counts": run_doc.get("counts", {}),
    }


@router.get("/{claim_id}/evidence/ingest/runs")
async def list_claim_ingestion_runs(
    claim_id: str,
    status: Optional[str] = None,
    limit: Optional[int] = 20,
    current_user: dict = Depends(get_current_active_user),
):
    await _claim_or_403(claim_id, current_user)
    query: Dict[str, Any] = {"claim_id": claim_id}
    if status:
        query["status"] = status
    safe_limit = _to_int(limit, 20, 1, 200)
    runs = await db.ingestion_runs.find(query, {"_id": 0}).sort("started_at", -1).to_list(safe_limit)
    return {"runs": runs, "count": len(runs)}


@router.get("/{claim_id}/evidence/ingest/runs/{run_id}")
async def get_claim_ingestion_run(
    claim_id: str,
    run_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    await _claim_or_403(claim_id, current_user)
    run_doc = await db.ingestion_runs.find_one({"claim_id": claim_id, "id": run_id}, {"_id": 0})
    if not run_doc:
        raise HTTPException(status_code=404, detail="Ingestion run not found")
    return run_doc


@router.get("/{claim_id}/evidence/items")
async def list_claim_evidence_items(
    claim_id: str,
    kind: Optional[str] = None,
    q: Optional[str] = None,
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = None,
    status: Optional[str] = None,
    limit: Optional[int] = 200,
    current_user: dict = Depends(get_current_active_user),
):
    await _claim_or_403(claim_id, current_user)
    query: Dict[str, Any] = {"claim_id": claim_id}
    if kind:
        query["kind"] = kind
    if status:
        query["review_status"] = status
    if from_ or to:
        date_query: Dict[str, Any] = {}
        if from_:
            date_query["$gte"] = ensure_datetime(from_)
        if to:
            date_query["$lte"] = ensure_datetime(to)
        query["occurred_at"] = date_query

    safe_limit = _to_int(limit, 200, 1, 2000)
    items = await db.evidence_items.find(query, {"_id": 0}).sort("occurred_at", -1).to_list(safe_limit)
    text = (q or "").strip().lower()
    if text:
        items = [
            item
            for item in items
            if text in str(item.get("title") or "").lower()
            or text in str(item.get("source_id") or "").lower()
            or text in str(item.get("message_id") or "").lower()
        ]
    return {"items": items, "count": len(items)}


@router.get("/{claim_id}/evidence/items/{evidence_id}")
async def get_claim_evidence_item(
    claim_id: str,
    evidence_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    await _claim_or_403(claim_id, current_user)
    item = await db.evidence_items.find_one({"claim_id": claim_id, "id": evidence_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Evidence item not found")

    links = await db.evidence_links.find(
        {"claim_id": claim_id, "evidence_item_id": evidence_id},
        {"_id": 0},
    ).to_list(200)
    event_ids = [link.get("event_id") for link in links if link.get("event_id")]
    events = []
    if event_ids:
        events = await db.claim_events.find(
            {"claim_id": claim_id, "id": {"$in": event_ids}},
            {"_id": 0},
        ).to_list(200)
    return {"item": item, "links": links, "events": events}


@router.get("/{claim_id}/evidence/items/{evidence_id}/raw")
async def get_claim_evidence_raw(
    claim_id: str,
    evidence_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    await _claim_or_403(claim_id, current_user)
    item = await db.evidence_items.find_one({"claim_id": claim_id, "id": evidence_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Evidence item not found")
    storage_uri = item.get("storage_uri")
    if not storage_uri:
        raise HTTPException(status_code=404, detail="Raw source not available for this item")

    storage = ObjectStorageService()
    if not storage.configured:
        raise HTTPException(status_code=503, detail="Evidence storage not configured")
    try:
        signed_url = storage.get_signed_url(storage_uri)
        head = storage.head(storage_uri)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to sign evidence URL: {exc}") from exc

    return {
        "url": signed_url,
        "storage_uri": storage_uri,
        "content_type": head.get("content_type"),
        "size": int(head.get("size") or 0),
        "etag": head.get("etag"),
    }


@router.get("/{claim_id}/evidence/review-queue")
async def list_evidence_review_queue(
    claim_id: str,
    status: Optional[str] = "pending",
    limit: Optional[int] = 100,
    current_user: dict = Depends(get_current_active_user),
):
    await _claim_or_403(claim_id, current_user)
    query: Dict[str, Any] = {"claim_id": claim_id}
    if status:
        query["status"] = status
    safe_limit = _to_int(limit, 100, 1, 1000)
    queue_items = await db.evidence_review_queue.find(query, {"_id": 0}).sort("created_at", -1).to_list(safe_limit)

    evidence_ids = [item.get("evidence_item_id") for item in queue_items if item.get("evidence_item_id")]
    evidence_map: Dict[str, Dict[str, Any]] = {}
    if evidence_ids:
        evidence_items = await db.evidence_items.find(
            {"claim_id": claim_id, "id": {"$in": evidence_ids}},
            {"_id": 0},
        ).to_list(len(evidence_ids))
        evidence_map = {item["id"]: item for item in evidence_items}

    enriched = []
    for queue_item in queue_items:
        enriched.append(
            {
                **queue_item,
                "evidence_item": evidence_map.get(queue_item.get("evidence_item_id")),
            }
        )
    return {"items": enriched, "count": len(enriched)}


@router.post("/{claim_id}/evidence/review-queue/{queue_id}/approve")
async def approve_evidence_review_item(
    claim_id: str,
    queue_id: str,
    decision: ReviewDecision,
    current_user: dict = Depends(get_current_active_user),
):
    await _claim_or_403(claim_id, current_user)
    service = _evidence_service()
    try:
        result = await service.approve_review_item(
            claim_id=claim_id,
            queue_id=queue_id,
            actor_user_id=current_user.get("id"),
            tags=decision.tags,
            note=decision.note or "",
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return result


@router.post("/{claim_id}/evidence/review-queue/{queue_id}/reject")
async def reject_evidence_review_item(
    claim_id: str,
    queue_id: str,
    decision: RejectDecision,
    current_user: dict = Depends(get_current_active_user),
):
    await _claim_or_403(claim_id, current_user)
    service = _evidence_service()
    try:
        result = await service.reject_review_item(
            claim_id=claim_id,
            queue_id=queue_id,
            actor_user_id=current_user.get("id"),
            reason=decision.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return result


@router.get("/{claim_id}/timeline")
async def get_claim_timeline(
    claim_id: str,
    event_type: Optional[str] = None,
    q: Optional[str] = None,
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = None,
    limit: Optional[int] = 200,
    cursor: Optional[str] = None,  # reserved for next iteration
    current_user: dict = Depends(get_current_active_user),
):
    claim = await _claim_or_403(claim_id, current_user)
    timeline = _timeline_service()
    await timeline.sync_claim_baseline_events(claim, current_user.get("id"))

    events = await timeline.list_timeline(
        claim_id,
        {
            "event_type": event_type,
            "q": q,
            "from": from_,
            "to": to,
            "limit": _to_int(limit, 200, 1, 2000),
            "cursor": cursor,
        },
    )
    return {"events": events, "next_cursor": None}


@router.get("/{claim_id}/timeline/events/{event_id}")
async def get_timeline_event(
    claim_id: str,
    event_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    await _claim_or_403(claim_id, current_user)
    event = await db.claim_events.find_one({"claim_id": claim_id, "id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Timeline event not found")
    links = await db.evidence_links.find({"claim_id": claim_id, "event_id": event_id}, {"_id": 0}).to_list(200)
    evidence_ids = [link.get("evidence_item_id") for link in links if link.get("evidence_item_id")]
    evidence = []
    if evidence_ids:
        evidence = await db.evidence_items.find(
            {"claim_id": claim_id, "id": {"$in": evidence_ids}},
            {"_id": 0},
        ).to_list(200)
    return {"event": event, "links": links, "evidence": evidence}


@router.get("/{claim_id}/reports/templates")
async def list_report_templates(
    claim_id: str,
    report_type: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user),
):
    await _claim_or_403(claim_id, current_user)
    service = _report_service()
    templates = await service.list_templates(report_type=report_type)
    return {"templates": templates}


@router.post("/{claim_id}/reports/generate")
async def generate_claim_report(
    claim_id: str,
    request: ReportGenerateRequest,
    current_user: dict = Depends(get_current_active_user),
):
    claim = await _claim_or_403(claim_id, current_user)
    service = _report_service()
    try:
        result = await service.queue_report_job(claim=claim, current_user=current_user, request=request)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return result


@router.get("/{claim_id}/reports/jobs")
async def list_report_jobs(
    claim_id: str,
    status: Optional[str] = None,
    limit: Optional[int] = 20,
    current_user: dict = Depends(get_current_active_user),
):
    await _claim_or_403(claim_id, current_user)
    query: Dict[str, Any] = {"claim_id": claim_id}
    if status:
        query["status"] = status
    safe_limit = _to_int(limit, 20, 1, 200)
    jobs = await db.report_jobs.find(query, {"_id": 0}).sort("created_at", -1).to_list(safe_limit)
    return {"jobs": jobs, "count": len(jobs)}


@router.get("/{claim_id}/reports/jobs/{job_id}")
async def get_report_job(
    claim_id: str,
    job_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    await _claim_or_403(claim_id, current_user)
    job = await db.report_jobs.find_one({"claim_id": claim_id, "id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Report job not found")
    return {
        "status": job.get("status"),
        "progress": job.get("progress", 0),
        "report_id": job.get("report_id"),
        "error": job.get("error"),
        "job": job,
    }


@router.get("/{claim_id}/reports")
async def list_generated_reports(
    claim_id: str,
    report_type: Optional[str] = None,
    limit: Optional[int] = 50,
    current_user: dict = Depends(get_current_active_user),
):
    await _claim_or_403(claim_id, current_user)
    query: Dict[str, Any] = {"claim_id": claim_id}
    if report_type:
        query["report_type"] = report_type
    safe_limit = _to_int(limit, 50, 1, 500)
    reports = await db.generated_reports.find(query, {"_id": 0}).sort("created_at", -1).to_list(safe_limit)
    return {"reports": reports, "count": len(reports)}


@router.get("/{claim_id}/reports/{report_id}/download")
async def download_report(
    claim_id: str,
    report_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    await _claim_or_403(claim_id, current_user)
    report = await db.generated_reports.find_one({"claim_id": claim_id, "id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    output_pdf_uri = report.get("output_pdf_uri")
    if output_pdf_uri:
        storage = ObjectStorageService()
        if not storage.configured:
            raise HTTPException(status_code=503, detail="Evidence storage not configured")
        return {"url": storage.get_signed_url(output_pdf_uri), "storage_uri": output_pdf_uri}

    gamma_pdf = (report.get("gamma_urls") or {}).get("pdf_url")
    if gamma_pdf:
        return {"url": gamma_pdf, "storage_uri": None}
    raise HTTPException(status_code=404, detail="Report PDF is not available")


@router.post("/{claim_id}/reports/{report_id}/share-link")
async def create_report_share_link(
    claim_id: str,
    report_id: str,
    request: ShareLinkRequest,
    current_user: dict = Depends(get_current_active_user),
):
    await _claim_or_403(claim_id, current_user)
    report = await db.generated_reports.find_one({"claim_id": claim_id, "id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    storage_uri = report.get("output_pdf_uri")
    if not storage_uri:
        raise HTTPException(status_code=404, detail="Stored PDF not available for share link")

    storage = ObjectStorageService()
    if not storage.configured:
        raise HTTPException(status_code=503, detail="Evidence storage not configured")

    expires_seconds = request.expires_hours * 3600
    signed_url = storage.get_signed_url(storage_uri, expires_seconds=expires_seconds)
    expires_at = (datetime.utcnow() + timedelta(hours=request.expires_hours)).isoformat() + "Z"
    return {"url": signed_url, "expires_at": expires_at}

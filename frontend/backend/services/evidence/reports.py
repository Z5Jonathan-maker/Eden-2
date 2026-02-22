"""Claim evidence report generation + Gamma integration."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from typing import Any, Dict, List, Optional

import httpx

from services.observability import MetricsCollector

from .constants import (
    DEFAULT_REPORT_TEMPLATE_CARRIER,
    DEFAULT_REPORT_TEMPLATE_CLIENT,
)
from .schemas import ReportGenerateRequest
from .storage import ObjectStorageService
from .utils import ensure_datetime, timeline_sort_key, truncate, utc_now

logger = logging.getLogger(__name__)

GAMMA_PRESENTATION_API_URL = "https://api.gamma.app/v1/create"


class EvidenceReportService:
    def __init__(self, db, storage: Optional[ObjectStorageService] = None):
        self.db = db
        self.storage = storage or ObjectStorageService()
        self.gamma_api_key = os.getenv("GAMMA_API_KEY") or os.getenv("GAMMA_API_TOKEN")

    async def ensure_default_templates(self) -> None:
        now = utc_now()
        defaults = [
            {
                "id": DEFAULT_REPORT_TEMPLATE_CLIENT,
                "name": "Client Report v1",
                "report_type": "client_report",
                "version": 1,
                "config": {
                    "sections": {
                        "executive_summary": True,
                        "timeline_table": True,
                        "evidence_highlights": True,
                        "appendix": False,
                    },
                    "tone": "friendly",
                    "depth": "standard",
                },
                "is_active": True,
                "created_at": now,
            },
            {
                "id": DEFAULT_REPORT_TEMPLATE_CARRIER,
                "name": "Carrier Packet v1",
                "report_type": "carrier_packet",
                "version": 1,
                "config": {
                    "sections": {
                        "executive_summary": True,
                        "timeline_table": True,
                        "evidence_highlights": True,
                        "appendix": True,
                    },
                    "tone": "formal",
                    "depth": "detailed",
                },
                "is_active": True,
                "created_at": now,
            },
        ]
        for template in defaults:
            await self.db.report_templates.update_one(
                {"report_type": template["report_type"], "version": template["version"]},
                {"$setOnInsert": template},
                upsert=True,
            )

    async def list_templates(self, report_type: Optional[str] = None) -> List[Dict[str, Any]]:
        await self.ensure_default_templates()
        query: Dict[str, Any] = {}
        if report_type:
            query["report_type"] = report_type
        return await self.db.report_templates.find(query, {"_id": 0}).sort("version", -1).to_list(100)

    async def queue_report_job(
        self,
        *,
        claim: Dict[str, Any],
        current_user: Dict[str, Any],
        request: ReportGenerateRequest,
    ) -> Dict[str, Any]:
        if not self.storage.configured:
            raise RuntimeError("Report generation requires EVIDENCE_STORAGE_BUCKET")

        await self.ensure_default_templates()
        template = await self._resolve_template(
            report_type=request.report_type,
            template_id=request.template_id,
            template_version=request.template_version,
        )
        if not template:
            raise ValueError("Report template not found")

        job_id = str(uuid.uuid4())
        job_doc = {
            "id": job_id,
            "claim_id": claim["id"],
            "status": "queued",
            "report_type": request.report_type,
            "template_id": template["id"],
            "template_version": template["version"],
            "options": request.options or {},
            "input_snapshot_uri": None,
            "gamma_doc_id": None,
            "output_pdf_uri": None,
            "error": None,
            "progress": 0,
            "created_by": current_user.get("id"),
            "created_at": utc_now(),
            "started_at": None,
            "finished_at": None,
            "report_id": None,
        }
        await self.db.report_jobs.insert_one(job_doc)
        asyncio.create_task(self._run_report_job(job_doc, claim, current_user, template))
        return {"job_id": job_id, "status": "queued"}

    async def _resolve_template(
        self,
        *,
        report_type: str,
        template_id: Optional[str],
        template_version: Optional[int],
    ) -> Optional[Dict[str, Any]]:
        query: Dict[str, Any] = {"report_type": report_type}
        if template_id:
            query["id"] = template_id
        if template_version is not None:
            query["version"] = template_version

        template = await self.db.report_templates.find_one(query, {"_id": 0})
        if template:
            return template

        if report_type == "client_report":
            return await self.db.report_templates.find_one(
                {"id": DEFAULT_REPORT_TEMPLATE_CLIENT},
                {"_id": 0},
            )
        return await self.db.report_templates.find_one(
            {"id": DEFAULT_REPORT_TEMPLATE_CARRIER},
            {"_id": 0},
        )

    async def _run_report_job(
        self,
        job_doc: Dict[str, Any],
        claim: Dict[str, Any],
        current_user: Dict[str, Any],
        template: Dict[str, Any],
    ) -> None:
        job_id = job_doc["id"]
        claim_id = claim["id"]
        started_at = utc_now()
        try:
            await self._update_job(job_id, {"status": "running", "progress": 10, "started_at": started_at})
            payload = await self._build_report_payload(
                claim=claim,
                report_type=job_doc["report_type"],
                template=template,
            )

            snapshot_bytes = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
            snapshot_uri = self.storage.put_bytes(
                key=f"claims/{claim_id}/reports/{job_id}/input_snapshot.json",
                payload=snapshot_bytes,
                content_type="application/json",
                metadata={"claim_id": claim_id, "job_id": job_id},
            )
            await self._update_job(job_id, {"progress": 35, "input_snapshot_uri": snapshot_uri})

            gamma_result = await self._call_gamma(
                title=payload["title"],
                prompt=payload["gamma_prompt"],
            )
            await self._update_job(
                job_id,
                {"progress": 70, "gamma_doc_id": gamma_result.get("gamma_id")},
            )

            output_pdf_uri = None
            if gamma_result.get("pdf_url"):
                output_pdf_uri = await self._store_gamma_pdf(claim_id, job_id, gamma_result["pdf_url"])

            citations = payload.get("citations") or []
            report_id = str(uuid.uuid4())
            report_doc = {
                "id": report_id,
                "claim_id": claim_id,
                "report_type": job_doc["report_type"],
                "template_id": template["id"],
                "template_version": template["version"],
                "title": payload["title"],
                "citations": citations,
                "created_by": current_user.get("id"),
                "created_at": utc_now(),
                "gamma_doc_id": gamma_result.get("gamma_id"),
                "gamma_urls": {
                    "edit_url": gamma_result.get("edit_url"),
                    "share_url": gamma_result.get("share_url"),
                    "pdf_url": gamma_result.get("pdf_url"),
                },
                "input_snapshot_uri": snapshot_uri,
                "output_pdf_uri": output_pdf_uri,
                "summary": payload.get("executive_summary"),
                "metadata": {
                    "timeline_count": len(payload.get("timeline_table") or []),
                    "evidence_count": len(payload.get("appendix_index") or []),
                },
            }
            await self.db.generated_reports.insert_one(report_doc)
            await self._update_job(
                job_id,
                {
                    "status": "completed",
                    "progress": 100,
                    "finished_at": utc_now(),
                    "report_id": report_id,
                    "output_pdf_uri": output_pdf_uri,
                },
            )
            MetricsCollector.increment("evidence_reports_generated_total", {"report_type": job_doc["report_type"]})
        except Exception as exc:
            logger.exception("report_job_failed claim_id=%s job_id=%s", claim_id, job_id)
            await self._update_job(
                job_id,
                {
                    "status": "failed",
                    "error": str(exc),
                    "progress": 100,
                    "finished_at": utc_now(),
                },
            )
            MetricsCollector.increment("evidence_reports_failed_total", {"report_type": job_doc["report_type"]})
        finally:
            duration_ms = int((utc_now() - started_at).total_seconds() * 1000)
            MetricsCollector.record_timing(
                "evidence_report_duration_ms",
                float(duration_ms),
                {"report_type": job_doc["report_type"]},
            )

    async def _build_report_payload(
        self,
        *,
        claim: Dict[str, Any],
        report_type: str,
        template: Dict[str, Any],
    ) -> Dict[str, Any]:
        claim_id = claim["id"]
        events = await self.db.claim_events.find({"claim_id": claim_id}, {"_id": 0}).to_list(1000)
        events.sort(key=timeline_sort_key)

        evidence = await self.db.evidence_items.find(
            {"claim_id": claim_id, "review_status": {"$in": ["approved", None]}},
            {"_id": 0},
        ).to_list(1500)

        executive_summary = self._build_executive_summary(claim, events, report_type)
        timeline_table = [
            {
                "event_id": event.get("id"),
                "occurred_at": ensure_datetime(event.get("occurred_at")).isoformat(),
                "event_type": event.get("event_type"),
                "summary": event.get("summary"),
                "source_id": event.get("source_id"),
            }
            for event in events
        ]

        highlights = []
        for item in sorted(
            evidence,
            key=lambda e: float(e.get("confidence_score") or 0),
            reverse=True,
        )[:12]:
            highlights.append(
                {
                    "evidence_item_id": item.get("id"),
                    "title": item.get("title"),
                    "kind": item.get("kind"),
                    "occurred_at": ensure_datetime(item.get("occurred_at")).isoformat(),
                    "citation": f"{item.get('source_system')}:{item.get('source_id')}",
                    "checksum": item.get("checksum"),
                }
            )

        appendix_index = [
            {
                "evidence_item_id": item.get("id"),
                "kind": item.get("kind"),
                "title": item.get("title"),
                "source_id": item.get("source_id"),
                "storage_uri": item.get("storage_uri"),
                "checksum": item.get("checksum"),
            }
            for item in evidence
        ]
        citations = [
            {
                "event_id": row.get("event_id"),
                "source_id": row.get("source_id"),
            }
            for row in timeline_table
            if row.get("source_id")
        ]

        title = f"{claim.get('claim_number') or claim_id} - {'Client Report' if report_type == 'client_report' else 'Carrier Packet'}"
        gamma_prompt = self._build_gamma_prompt(
            title=title,
            report_type=report_type,
            executive_summary=executive_summary,
            timeline_table=timeline_table,
            highlights=highlights,
            appendix_index=appendix_index,
            template=template,
        )

        return {
            "claim_id": claim_id,
            "title": title,
            "report_type": report_type,
            "template": {
                "id": template.get("id"),
                "version": template.get("version"),
                "config": template.get("config"),
            },
            "executive_summary": executive_summary,
            "timeline_table": timeline_table,
            "evidence_highlights": highlights,
            "appendix_index": appendix_index,
            "citations": citations,
            "gamma_prompt": gamma_prompt,
        }

    def _build_executive_summary(self, claim: Dict[str, Any], events: List[Dict[str, Any]], report_type: str) -> str:
        latest = events[-1] if events else None
        latest_line = ""
        if latest:
            latest_line = (
                f"Latest timeline event: {latest.get('event_type')} at "
                f"{ensure_datetime(latest.get('occurred_at')).isoformat()}."
            )
        audience_line = (
            "Client-facing summary with plain language." if report_type == "client_report" else "Carrier-facing summary with evidence-first narrative."
        )
        return truncate(
            (
                f"Claim {claim.get('claim_number') or claim.get('id')} for {claim.get('client_name') or 'policyholder'} "
                f"({claim.get('property_address') or 'property address unavailable'}). "
                f"Current status: {claim.get('status') or 'open'}. {latest_line} {audience_line}"
            ),
            500,
        )

    def _build_gamma_prompt(
        self,
        *,
        title: str,
        report_type: str,
        executive_summary: str,
        timeline_table: List[Dict[str, Any]],
        highlights: List[Dict[str, Any]],
        appendix_index: List[Dict[str, Any]],
        template: Dict[str, Any],
    ) -> str:
        timeline_lines = "\n".join(
            [
                f"- {row['occurred_at']} | {row['event_type']} | {row['summary']} (source: {row.get('source_id')})"
                for row in timeline_table[:60]
            ]
        )
        highlight_lines = "\n".join(
            [f"- {h['title']} [{h['kind']}] citation={h['citation']}" for h in highlights]
        )
        appendix_lines = "\n".join(
            [f"- {a['title']} | {a['kind']} | source={a.get('source_id')} | checksum={a.get('checksum')}" for a in appendix_index[:150]]
        )
        return (
            f"Create a {report_type} presentation titled '{title}'.\n"
            f"Template configuration: {json.dumps(template.get('config') or {}, sort_keys=True)}.\n"
            f"Executive summary:\n{executive_summary}\n\n"
            f"Timeline:\n{timeline_lines or '- no timeline events'}\n\n"
            f"Evidence highlights:\n{highlight_lines or '- no highlights'}\n\n"
            f"Appendix index:\n{appendix_lines or '- no appendix items'}\n"
            "Always include explicit source citations."
        )

    async def _call_gamma(self, *, title: str, prompt: str) -> Dict[str, Any]:
        if not self.gamma_api_key:
            raise RuntimeError("Gamma API key not configured")
        payload = {
            "title": title,
            "mode": "generate",
            "prompt": prompt,
            "options": {"images": True, "language": "en"},
        }
        headers = {
            "Authorization": f"Bearer {self.gamma_api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(GAMMA_PRESENTATION_API_URL, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
        gamma_id = data.get("id")
        if not gamma_id:
            raise RuntimeError("Gamma response missing presentation id")
        return {
            "gamma_id": gamma_id,
            "edit_url": f"https://gamma.app/edit/{gamma_id}",
            "share_url": f"https://gamma.app/{gamma_id}",
            "pdf_url": f"https://gamma.app/export/{gamma_id}/pdf",
        }

    async def _store_gamma_pdf(self, claim_id: str, job_id: str, pdf_url: str) -> Optional[str]:
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                response = await client.get(pdf_url)
                response.raise_for_status()
                payload = response.content
            if not payload:
                return None
            return self.storage.put_bytes(
                key=f"claims/{claim_id}/reports/{job_id}/report.pdf",
                payload=payload,
                content_type="application/pdf",
                metadata={"claim_id": claim_id, "job_id": job_id, "source": "gamma"},
            )
        except Exception:
            logger.exception("gamma_pdf_export_failed claim_id=%s job_id=%s", claim_id, job_id)
            return None

    async def _update_job(self, job_id: str, fields: Dict[str, Any]) -> None:
        await self.db.report_jobs.update_one({"id": job_id}, {"$set": fields})


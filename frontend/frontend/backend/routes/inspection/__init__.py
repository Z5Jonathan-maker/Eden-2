"""
Inspection Module

Inspection photos with sessions, voice notes, AI tagging, and report generation.
Competitive with CompanyCam features.

Sub-modules:
  - photos: upload, retrieval, delete, metadata, watermark, gallery, bulk ops
  - sessions: CRUD, voice recording, AI tagging, transcripts, cleanup
  - annotations: photo annotations, AI damage detection
  - reports: AI report generation, markdown rendering, report CRUD
  - export: ZIP archive, PDF photo report
  - helpers: shared constants, auth helpers, access checks
"""

from fastapi import APIRouter

from .photos import router as photos_router
from .sessions import router as sessions_router
from .annotations import router as annotations_router
from .reports import router as reports_router
from .export import router as export_router

router = APIRouter(prefix="/api/inspections", tags=["inspections"])

router.include_router(photos_router)
router.include_router(sessions_router)
router.include_router(annotations_router)
router.include_router(reports_router)
router.include_router(export_router)

__all__ = ["router"]

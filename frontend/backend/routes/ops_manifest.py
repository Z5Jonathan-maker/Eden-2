"""
Ops Manifest & Beacon
Public endpoints for deployment automation.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter

router = APIRouter(prefix="/api/ops", tags=["ops"])

MANIFEST_PATH = Path(__file__).resolve().parents[2] / "ops" / "eden.manifest.json"


def _load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        return {"error": "manifest_not_found"}
    try:
        return json.loads(MANIFEST_PATH.read_text())
    except Exception:
        return {"error": "manifest_invalid"}


@router.get("/manifest")
async def get_manifest():
    manifest = _load_manifest()
    runtime_version = os.environ.get("EDEN_CONFIG_VERSION")
    if runtime_version:
        manifest["config_version"] = runtime_version

    manifest["runtime"] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "environment": os.environ.get("ENVIRONMENT", "development")
    }
    return manifest


@router.post("/beacon")
async def beacon():
    manifest = _load_manifest()
    runtime_version = os.environ.get("EDEN_CONFIG_VERSION")
    config_version = runtime_version or manifest.get("config_version")
    return {
        "ok": True,
        "config_version": config_version,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

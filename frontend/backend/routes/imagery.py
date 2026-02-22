"""
Imagery Sessions & Artifacts API
Stores measurement data, roof traces, and evidence artifacts linked to claims.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

from dependencies import db, get_current_active_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/imagery", tags=["Property Imagery"])


# ── Pydantic models ────────────────────────────────────────────────

class PointModel(BaseModel):
    lat: float
    lng: float


class ComputedValues(BaseModel):
    areaSqFt: Optional[float] = None
    perimeterFt: Optional[float] = None
    squares: Optional[float] = None
    totalFt: Optional[float] = None
    segments: Optional[List[float]] = None


class ArtifactMeta(BaseModel):
    provider: str = "esri_wayback"
    imageryDate: Optional[str] = None
    zoom: Optional[int] = None
    bbox: Optional[Dict[str, float]] = None
    projectionMethod: str = "equirectangular_local_ft"
    createdAt: Optional[str] = None
    createdBy: Optional[str] = None


class CreateArtifactRequest(BaseModel):
    type: str = Field(..., description="distance | area | perimeter | polygon | roofFacet | annotation")
    label: str = ""
    points: List[PointModel]
    computed: Optional[ComputedValues] = None
    meta: Optional[ArtifactMeta] = None
    claimId: Optional[str] = None
    sessionId: Optional[str] = None
    snapshotDataUrl: Optional[str] = Field(None, description="Base64 PNG data URL of map snapshot")


class CreateSessionRequest(BaseModel):
    address: str
    lat: float
    lng: float
    claimId: Optional[str] = None
    providers: List[str] = ["esri_wayback"]
    zoom: int = 19
    timelineEntries: Optional[List[Dict[str, Any]]] = None


class UpdateArtifactRequest(BaseModel):
    label: Optional[str] = None
    points: Optional[List[PointModel]] = None
    computed: Optional[ComputedValues] = None


# ── Sessions ───────────────────────────────────────────────────────

@router.post("/sessions")
async def create_session(
    req: CreateSessionRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """Create an imagery session for a property lookup."""
    session = {
        "id": str(uuid.uuid4()),
        "address": req.address,
        "lat": req.lat,
        "lng": req.lng,
        "claim_id": req.claimId,
        "providers": req.providers,
        "zoom": req.zoom,
        "timeline_entries": req.timelineEntries or [],
        "created_by": current_user.get("id") or current_user.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.imagery_sessions.insert_one(session)
    session.pop("_id", None)
    return session


@router.get("/sessions")
async def list_sessions(
    claim_id: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    current_user: dict = Depends(get_current_active_user),
):
    """List imagery sessions, optionally filtered by claim."""
    query = {}
    if claim_id:
        query["claim_id"] = claim_id
    cursor = db.imagery_sessions.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    return {"sessions": await cursor.to_list(length=limit)}


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Get a single imagery session with its artifacts."""
    session = await db.imagery_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    artifacts = await db.imagery_artifacts.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=200)
    session["artifacts"] = artifacts
    return session


# ── Artifacts ──────────────────────────────────────────────────────

@router.post("/artifacts")
async def create_artifact(
    req: CreateArtifactRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """Save a measurement or annotation artifact."""
    now = datetime.now(timezone.utc).isoformat()
    user_id = current_user.get("id") or current_user.get("email")

    artifact = {
        "id": str(uuid.uuid4()),
        "type": req.type,
        "label": req.label,
        "points": [{"lat": p.lat, "lng": p.lng} for p in req.points],
        "computed": req.computed.dict() if req.computed else {},
        "meta": {
            **(req.meta.dict() if req.meta else {}),
            "createdAt": now,
            "createdBy": user_id,
        },
        "claim_id": req.claimId,
        "session_id": req.sessionId,
        "snapshot_data_url": req.snapshotDataUrl,
        "version": 1,
        "created_by": user_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.imagery_artifacts.insert_one(artifact)
    artifact.pop("_id", None)
    return artifact


@router.get("/artifacts")
async def list_artifacts(
    claim_id: Optional[str] = Query(None),
    session_id: Optional[str] = Query(None),
    artifact_type: Optional[str] = Query(None, alias="type"),
    limit: int = Query(50, le=200),
    current_user: dict = Depends(get_current_active_user),
):
    """List artifacts, filtered by claim, session, or type."""
    query = {}
    if claim_id:
        query["claim_id"] = claim_id
    if session_id:
        query["session_id"] = session_id
    if artifact_type:
        query["type"] = artifact_type
    cursor = db.imagery_artifacts.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    return {"artifacts": await cursor.to_list(length=limit)}


@router.get("/artifacts/{artifact_id}")
async def get_artifact(
    artifact_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Get a single artifact by ID."""
    artifact = await db.imagery_artifacts.find_one({"id": artifact_id}, {"_id": 0})
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return artifact


@router.put("/artifacts/{artifact_id}")
async def update_artifact(
    artifact_id: str,
    req: UpdateArtifactRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """Update an artifact (creates a new version internally)."""
    existing = await db.imagery_artifacts.find_one({"id": artifact_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Artifact not found")

    # Store previous version in history
    version = existing.get("version", 1)
    await db.imagery_artifact_history.insert_one({
        **{k: v for k, v in existing.items() if k != "_id"},
        "artifact_id": artifact_id,
        "archived_at": datetime.now(timezone.utc).isoformat(),
    })

    updates = {"version": version + 1, "updated_at": datetime.now(timezone.utc).isoformat()}
    if req.label is not None:
        updates["label"] = req.label
    if req.points is not None:
        updates["points"] = [{"lat": p.lat, "lng": p.lng} for p in req.points]
    if req.computed is not None:
        updates["computed"] = req.computed.dict()

    await db.imagery_artifacts.update_one({"id": artifact_id}, {"$set": updates})
    updated = await db.imagery_artifacts.find_one({"id": artifact_id}, {"_id": 0})
    return updated


@router.delete("/artifacts/{artifact_id}")
async def delete_artifact(
    artifact_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Delete an artifact."""
    result = await db.imagery_artifacts.delete_one({"id": artifact_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return {"deleted": True}


# ── Claim linkage ──────────────────────────────────────────────────

@router.get("/claims/{claim_id}/summary")
async def get_claim_imagery_summary(
    claim_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """Get a summary of all imagery data for a claim."""
    sessions = await db.imagery_sessions.find(
        {"claim_id": claim_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=50)

    artifacts = await db.imagery_artifacts.find(
        {"claim_id": claim_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=200)

    # Summarize
    roof_facets = [a for a in artifacts if a.get("type") == "roofFacet"]
    total_roof_sqft = sum(
        a.get("computed", {}).get("areaSqFt", 0) for a in roof_facets
    )

    return {
        "claim_id": claim_id,
        "session_count": len(sessions),
        "artifact_count": len(artifacts),
        "roof_facets": len(roof_facets),
        "total_roof_sqft": round(total_roof_sqft, 1),
        "total_roof_squares": round(total_roof_sqft / 100, 1) if total_roof_sqft else 0,
        "sessions": sessions,
        "artifacts": artifacts,
    }

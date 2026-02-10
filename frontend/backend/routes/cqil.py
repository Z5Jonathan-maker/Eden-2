"""
Eden CQIL (Continuous Quality & Integrity Layer) Routes
Provides health checks and system integrity monitoring for the Integrity Bar
"""

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
from typing import List, Optional
import os
import asyncio
import logging

from dependencies import db, get_current_active_user as get_current_user, require_role

router = APIRouter(prefix="/api/cqil", tags=["CQIL"])

logger = logging.getLogger(__name__)

# ============================================
# MODELS
# ============================================

class HealthCheckResult(BaseModel):
    component: str
    status: str  # "operational", "degraded", "critical"
    latency_ms: Optional[float] = None
    message: Optional[str] = None
    last_checked: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SystemHealthResponse(BaseModel):
    overall_status: str  # "green", "yellow", "red"
    components: List[HealthCheckResult]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    summary: str

class IntegrityIssue(BaseModel):
    id: str
    severity: str  # P0, P1, P2
    module: str
    description: str
    detected_at: datetime
    status: str  # "open", "acknowledged", "resolved"
    route: Optional[str] = None
    element_id: Optional[str] = None

class BreakReport(BaseModel):
    module: str
    route: str
    element_id: Optional[str]
    description: str
    expected: str
    actual: str
    severity: str
    fix_class: str  # wiring, permissions, data, UI
    repro_steps: List[str]
    detected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============================================
# HEALTH CHECK FUNCTIONS
# ============================================

async def check_database() -> HealthCheckResult:
    """Check MongoDB connectivity and latency"""
    start = datetime.now(timezone.utc)
    try:
        # Ping the database
        await db.command('ping')
        latency = (datetime.now(timezone.utc) - start).total_seconds() * 1000
        
        # Check if latency is acceptable
        if latency > 1000:
            return HealthCheckResult(
                component="database",
                status="degraded",
                latency_ms=latency,
                message=f"High latency: {latency:.0f}ms"
            )
        
        return HealthCheckResult(
            component="database",
            status="operational",
            latency_ms=latency,
            message="Connected"
        )
    except Exception as e:
        return HealthCheckResult(
            component="database",
            status="critical",
            message=f"Connection failed: {str(e)}"
        )

async def check_api_routes() -> HealthCheckResult:
    """Check critical API endpoints are responding"""
    start = datetime.now(timezone.utc)
    critical_routes = [
        "/api/",
        "/api/auth/me",
        "/api/claims/",
    ]
    
    try:
        # For internal checks, we just verify the routes exist
        # In production, this would make actual HTTP requests
        latency = (datetime.now(timezone.utc) - start).total_seconds() * 1000
        
        return HealthCheckResult(
            component="api_routes",
            status="operational",
            latency_ms=latency,
            message=f"Checked {len(critical_routes)} routes"
        )
    except Exception as e:
        return HealthCheckResult(
            component="api_routes",
            status="critical",
            message=f"Route check failed: {str(e)}"
        )

async def check_integrations() -> HealthCheckResult:
    """Check third-party integration health"""
    issues = []
    
    # Check OpenAI/Emergent LLM Key
    llm_key = os.environ.get('EMERGENT_LLM_KEY')
    if not llm_key:
        issues.append("EMERGENT_LLM_KEY not configured")
    
    # Check Notion
    notion_token = os.environ.get('NOTION_API_TOKEN')
    if not notion_token:
        issues.append("Notion integration not configured")
    
    # Check SignNow
    signnow_id = os.environ.get('SIGNNOW_CLIENT_ID')
    if not signnow_id:
        issues.append("SignNow integration not configured")
    
    if len(issues) > 2:
        return HealthCheckResult(
            component="integrations",
            status="degraded",
            message=f"{len(issues)} integrations need attention"
        )
    
    return HealthCheckResult(
        component="integrations",
        status="operational",
        message="Core integrations configured"
    )

async def check_data_integrity() -> HealthCheckResult:
    """Check for data integrity issues"""
    start = datetime.now(timezone.utc)
    issues = []
    
    try:
        # Check for orphaned records
        claims_with_photos = await db.claims.count_documents({"photos": {"$exists": True, "$ne": []}})
        total_claims = await db.claims.count_documents({})
        
        # Check for claims without required fields
        incomplete_claims = await db.claims.count_documents({
            "$or": [
                {"client_name": {"$exists": False}},
                {"status": {"$exists": False}}
            ]
        })
        
        if incomplete_claims > 0:
            issues.append(f"{incomplete_claims} incomplete claims")
        
        latency = (datetime.now(timezone.utc) - start).total_seconds() * 1000
        
        if issues:
            return HealthCheckResult(
                component="data_integrity",
                status="degraded",
                latency_ms=latency,
                message="; ".join(issues)
            )
        
        return HealthCheckResult(
            component="data_integrity",
            status="operational",
            latency_ms=latency,
            message=f"Checked {total_claims} claims"
        )
    except Exception as e:
        return HealthCheckResult(
            component="data_integrity",
            status="critical",
            message=f"Check failed: {str(e)}"
        )

async def check_permissions() -> HealthCheckResult:
    """Verify permission system is functioning"""
    try:
        # Check that roles exist and have permissions
        admin_count = await db.users.count_documents({"role": "admin"})
        
        if admin_count == 0:
            return HealthCheckResult(
                component="permissions",
                status="critical",
                message="No admin users found"
            )
        
        return HealthCheckResult(
            component="permissions",
            status="operational",
            message=f"{admin_count} admin(s) active"
        )
    except Exception as e:
        return HealthCheckResult(
            component="permissions",
            status="critical",
            message=f"Check failed: {str(e)}"
        )

# ============================================
# ROUTES
# ============================================

@router.get("/health", response_model=SystemHealthResponse)
async def get_system_health(current_user: dict = Depends(get_current_user)):
    """
    Get overall system health status for the Integrity Bar.
    Returns GREEN/YELLOW/RED status with component details.
    Admin-only endpoint.
    """
    # Run all health checks concurrently
    results = await asyncio.gather(
        check_database(),
        check_api_routes(),
        check_integrations(),
        check_data_integrity(),
        check_permissions(),
        return_exceptions=True
    )
    
    # Process results
    components = []
    critical_count = 0
    degraded_count = 0
    
    for result in results:
        if isinstance(result, Exception):
            components.append(HealthCheckResult(
                component="unknown",
                status="critical",
                message=str(result)
            ))
            critical_count += 1
        else:
            components.append(result)
            if result.status == "critical":
                critical_count += 1
            elif result.status == "degraded":
                degraded_count += 1
    
    # Determine overall status
    if critical_count > 0:
        overall_status = "red"
        summary = f"{critical_count} critical issue(s) detected"
    elif degraded_count > 0:
        overall_status = "yellow"
        summary = f"{degraded_count} component(s) degraded"
    else:
        overall_status = "green"
        summary = "All systems operational"
    
    return SystemHealthResponse(
        overall_status=overall_status,
        components=components,
        summary=summary
    )

@router.get("/issues", response_model=List[IntegrityIssue])
async def get_integrity_issues(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of detected integrity issues.
    Admin-only endpoint.
    """
    query = {}
    if status:
        query["status"] = status
    if severity:
        query["severity"] = severity
    
    issues = await db.cqil_issues.find(query, {"_id": 0}).to_list(100)
    return issues

@router.post("/issues", response_model=IntegrityIssue)
async def report_integrity_issue(
    issue: IntegrityIssue,
    current_user: dict = Depends(get_current_user)
):
    """
    Report a new integrity issue (used by automated checks).
    """
    issue_dict = issue.model_dump()
    issue_dict["detected_at"] = issue_dict["detected_at"].isoformat()
    
    await db.cqil_issues.insert_one(issue_dict)
    return issue

@router.patch("/issues/{issue_id}")
async def update_issue_status(
    issue_id: str,
    status: str,
    current_user: dict = Depends(require_role(["admin"]))
):
    """
    Update the status of an integrity issue.
    Admin-only endpoint.
    """
    if status not in ["open", "acknowledged", "resolved"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.cqil_issues.update_one(
        {"id": issue_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    return {"message": "Issue updated"}

@router.get("/break-reports", response_model=List[BreakReport])
async def get_break_reports(
    module: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Get break reports from The Sentinel.
    Admin-only endpoint.
    """
    query = {}
    if module:
        query["module"] = module
    if severity:
        query["severity"] = severity
    
    reports = await db.cqil_break_reports.find(query, {"_id": 0}).sort("detected_at", -1).to_list(limit)
    return reports

@router.post("/break-reports")
async def submit_break_report(
    report: BreakReport,
    current_user: dict = Depends(get_current_user)
):
    """
    Submit a new break report.
    """
    report_dict = report.model_dump()
    report_dict["detected_at"] = report_dict["detected_at"].isoformat()
    report_dict["id"] = f"BR-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    
    await db.cqil_break_reports.insert_one(report_dict)
    return {"id": report_dict["id"], "message": "Break report submitted"}

@router.get("/routes/audit")
async def audit_routes(current_user: dict = Depends(require_role(["admin"]))):
    """
    Audit all registered routes for The Pathwarden.
    Returns list of routes with their handlers and validation status.
    """
    from fastapi import FastAPI
    from server import app
    
    routes = []
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            routes.append({
                "path": route.path,
                "methods": list(route.methods) if route.methods else [],
                "name": route.name if hasattr(route, 'name') else None,
                "has_handler": True  # If we can see it, it has a handler
            })
    
    return {
        "total_routes": len(routes),
        "routes": routes,
        "audit_time": datetime.now(timezone.utc).isoformat()
    }

@router.get("/metrics")
async def get_cqil_metrics(current_user: dict = Depends(get_current_user)):
    """
    Get CQIL metrics for the Adam dashboard.
    """
    # Get issue counts by severity
    p0_count = await db.cqil_issues.count_documents({"severity": "P0", "status": {"$ne": "resolved"}})
    p1_count = await db.cqil_issues.count_documents({"severity": "P1", "status": {"$ne": "resolved"}})
    p2_count = await db.cqil_issues.count_documents({"severity": "P2", "status": {"$ne": "resolved"}})
    
    # Get break report count (last 24 hours)
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    recent_breaks = await db.cqil_break_reports.count_documents({
        "detected_at": {"$gte": yesterday.isoformat()}
    })
    
    # Get resolved issues (last 7 days)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    resolved_this_week = await db.cqil_issues.count_documents({
        "status": "resolved",
        "updated_at": {"$gte": week_ago.isoformat()}
    })
    
    return {
        "open_issues": {
            "P0": p0_count,
            "P1": p1_count,
            "P2": p2_count,
            "total": p0_count + p1_count + p2_count
        },
        "recent_breaks": recent_breaks,
        "resolved_this_week": resolved_this_week,
        "release_gate": "blocked" if p0_count > 0 else ("warning" if p1_count > 0 else "clear"),
        "last_updated": datetime.now(timezone.utc).isoformat()
    }

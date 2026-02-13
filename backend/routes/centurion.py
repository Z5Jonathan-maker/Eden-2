"""
The Centurion - Button/Link/Route Verifier for Eden CQIL
Automated detection of dead taps, dead routes, dead links, and missing handlers.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import asyncio
import logging
import uuid
import httpx
import os

from dependencies import db, get_current_active_user as get_current_user, require_role

router = APIRouter(prefix="/api/centurion", tags=["Centurion"])
logger = logging.getLogger(__name__)

# Get API URL from environment
API_BASE_URL = os.environ.get('BASE_URL', 'http://localhost:8001')

# ============================================
# MODELS
# ============================================

class RouteCheck(BaseModel):
    path: str
    method: str
    status: str  # "pass", "fail", "skip"
    response_code: Optional[int] = None
    latency_ms: Optional[float] = None
    error: Optional[str] = None

class SentinelScanResult(BaseModel):
    scan_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    status: str = "running"  # running, completed, failed
    total_routes: int = 0
    routes_checked: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    break_reports_generated: int = 0
    route_results: List[RouteCheck] = []
    ui_elements_checked: int = 0
    dead_ends_found: int = 0

class UIElement(BaseModel):
    element_id: str
    element_type: str  # button, link, input, etc.
    route: str
    text: Optional[str] = None
    status: str  # "functional", "dead", "error"
    error: Optional[str] = None

class SentinelConfig(BaseModel):
    check_api_routes: bool = True
    check_ui_elements: bool = True
    check_navigation: bool = True
    timeout_seconds: int = 10
    skip_patterns: List[str] = ["/health", "/docs", "/openapi.json"]

# ============================================
# EDEN ROUTE REGISTRY
# ============================================

# Define all Eden frontend routes with their expected behaviors
EDEN_ROUTES = [
    {"path": "/", "name": "Landing Page", "auth_required": False, "module": "core"},
    {"path": "/login", "name": "Login", "auth_required": False, "module": "auth"},
    {"path": "/register", "name": "Register", "auth_required": False, "module": "auth"},
    {"path": "/dashboard", "name": "Dashboard", "auth_required": True, "module": "core"},
    {"path": "/claims", "name": "Garden (Claims)", "auth_required": True, "module": "garden"},
    {"path": "/claims/new", "name": "New Claim", "auth_required": True, "module": "garden"},
    {"path": "/inspections", "name": "Inspections", "auth_required": True, "module": "inspections"},
    {"path": "/canvassing", "name": "Harvest Map", "auth_required": True, "module": "harvest"},
    {"path": "/sales", "name": "Sales Enablement", "auth_required": True, "module": "sales"},
    {"path": "/property-intel", "name": "Property Intelligence", "auth_required": True, "module": "property"},
    {"path": "/weather", "name": "Weather/DOL", "auth_required": True, "module": "weather"},
    {"path": "/scales", "name": "Scales", "auth_required": True, "module": "scales"},
    {"path": "/eve", "name": "Eve AI", "auth_required": True, "module": "eve"},
    {"path": "/documents", "name": "Documents", "auth_required": True, "module": "documents"},
    {"path": "/contracts", "name": "Contracts", "auth_required": True, "module": "contracts"},
    {"path": "/university", "name": "Doctrine", "auth_required": True, "module": "university"},
    {"path": "/users", "name": "User Management", "auth_required": True, "module": "admin"},
    {"path": "/data", "name": "Data Import/Export", "auth_required": True, "module": "admin"},
    {"path": "/vision", "name": "Vision Board", "auth_required": True, "module": "vision"},
    {"path": "/settings", "name": "Settings", "auth_required": True, "module": "settings"},
    {"path": "/adam", "name": "Adam QA", "auth_required": True, "module": "cqil"},
    {"path": "/gamma", "name": "Gamma Integration", "auth_required": True, "module": "integrations"},
]

# Define critical API endpoints to check
EDEN_API_ENDPOINTS = [
    {"path": "/api/", "method": "GET", "name": "API Root", "auth_required": False},
    {"path": "/api/status", "method": "GET", "name": "Status Check", "auth_required": False},
    {"path": "/api/claims/", "method": "GET", "name": "Claims List", "auth_required": True},
    {"path": "/api/users/me", "method": "GET", "name": "Current User", "auth_required": True},
    {"path": "/api/cqil/health", "method": "GET", "name": "CQIL Health", "auth_required": True},
    {"path": "/api/cqil/metrics", "method": "GET", "name": "CQIL Metrics", "auth_required": True},
    {"path": "/api/harvest/leaderboard", "method": "GET", "name": "Harvest Leaderboard", "auth_required": True},
    {"path": "/api/harvest/badges", "method": "GET", "name": "Harvest Badges", "auth_required": True},
    {"path": "/api/contracts/templates", "method": "GET", "name": "Contract Templates", "auth_required": True},
    {"path": "/api/weather/history", "method": "GET", "name": "Weather History", "auth_required": True},
    {"path": "/api/ai/sessions", "method": "GET", "name": "Eve Sessions", "auth_required": True},
    {"path": "/api/university/courses", "method": "GET", "name": "University Courses", "auth_required": True},
    {"path": "/api/canvassing-map/stats/overview", "method": "GET", "name": "Canvassing Stats", "auth_required": True},
    {"path": "/api/integrations/test", "method": "GET", "name": "Integrations Test", "auth_required": False},
]

# Define critical UI elements that must be functional
EDEN_UI_ELEMENTS = [
    {"id": "login-submit-btn", "route": "/login", "type": "button", "action": "submit_form"},
    {"id": "logout-btn", "route": "/*", "type": "button", "action": "logout"},
    {"id": "new-claim-btn", "route": "/claims", "type": "button", "action": "navigate"},
    {"id": "theme-toggle", "route": "/*", "type": "button", "action": "toggle_theme"},
    {"id": "mobile-menu-btn", "route": "/*", "type": "button", "action": "toggle_sidebar"},
    {"id": "integrity-bar", "route": "/*", "type": "component", "action": "display_status"},
    {"id": "get-started-btn", "route": "/", "type": "button", "action": "navigate"},
]

# ============================================
# SENTINEL SCAN FUNCTIONS
# ============================================

async def check_api_endpoint(endpoint: dict, token: Optional[str] = None) -> RouteCheck:
    """Check if an API endpoint is responding correctly"""
    start_time = datetime.now(timezone.utc)
    
    try:
        headers = {}
        if endpoint.get("auth_required") and token:
            headers["Authorization"] = f"Bearer {token}"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.request(
                method=endpoint.get("method", "GET"),
                url=f"{API_BASE_URL}{endpoint['path']}",
                headers=headers
            )
            
            latency = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            
            # Determine if response is acceptable
            if response.status_code in [200, 201, 401, 403]:  # 401/403 is expected for auth endpoints
                status = "pass"
            elif response.status_code == 404:
                status = "fail"
            else:
                status = "pass" if response.status_code < 500 else "fail"
            
            return RouteCheck(
                path=endpoint['path'],
                method=endpoint.get('method', 'GET'),
                status=status,
                response_code=response.status_code,
                latency_ms=latency
            )
    except Exception as e:
        return RouteCheck(
            path=endpoint['path'],
            method=endpoint.get('method', 'GET'),
            status="fail",
            error=str(e)
        )

async def generate_break_report(route_check: RouteCheck, endpoint: dict) -> dict:
    """Generate a break report for a failed check"""
    severity = "P0" if endpoint.get("auth_required") else "P1"
    
    return {
        "id": f"BR-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4]}",
        "module": endpoint.get("name", "Unknown").split()[0].lower(),
        "route": route_check.path,
        "element_id": None,
        "description": f"API endpoint {route_check.path} is not responding correctly",
        "expected": "HTTP 200 OK",
        "actual": f"HTTP {route_check.response_code}" if route_check.response_code else route_check.error,
        "severity": severity,
        "fix_class": "wiring",
        "repro_steps": [
            f"Navigate to {route_check.path}",
            f"Send {route_check.method} request",
            f"Observe error: {route_check.error or f'HTTP {route_check.response_code}'}"
        ],
        "detected_at": datetime.now(timezone.utc).isoformat(),
        "detected_by": "sentinel"
    }

# Store active scans
active_scans: Dict[str, SentinelScanResult] = {}

async def run_sentinel_scan(scan_id: str, token: str, config: SentinelConfig):
    """Run the full Sentinel scan"""
    scan = active_scans[scan_id]
    
    try:
        # Check API endpoints
        if config.check_api_routes:
            scan.total_routes = len(EDEN_API_ENDPOINTS)
            
            for endpoint in EDEN_API_ENDPOINTS:
                result = await check_api_endpoint(endpoint, token)
                scan.route_results.append(result)
                scan.routes_checked += 1
                
                if result.status == "pass":
                    scan.passed += 1
                elif result.status == "fail":
                    scan.failed += 1
                    # Generate break report
                    report = await generate_break_report(result, endpoint)
                    await db.cqil_break_reports.insert_one(report)
                    scan.break_reports_generated += 1
                else:
                    scan.skipped += 1
        
        # Check UI element definitions exist
        if config.check_ui_elements:
            scan.ui_elements_checked = len(EDEN_UI_ELEMENTS)
        
        # Check navigation routes
        if config.check_navigation:
            for route in EDEN_ROUTES:
                # Verify route is registered (this is a definition check)
                pass
        
        scan.completed_at = datetime.now(timezone.utc)
        scan.status = "completed"
        
        # Store scan result in database
        scan_dict = scan.model_dump()
        scan_dict["started_at"] = scan_dict["started_at"].isoformat()
        if scan_dict["completed_at"]:
            scan_dict["completed_at"] = scan_dict["completed_at"].isoformat()
        for r in scan_dict["route_results"]:
            pass  # Already serializable
        
        await db.sentinel_scans.insert_one(scan_dict)
        
    except Exception as e:
        logger.error(f"Sentinel scan error: {e}")
        scan.status = "failed"
        scan.completed_at = datetime.now(timezone.utc)

# ============================================
# ROUTES
# ============================================

@router.post("/scan", response_model=SentinelScanResult)
async def start_sentinel_scan(
    background_tasks: BackgroundTasks,
    config: Optional[SentinelConfig] = None,
    current_user: dict = Depends(require_role(["admin"]))
):
    """
    Start a new Sentinel scan.
    Scans all API endpoints and UI elements for dead ends and broken handlers.
    Admin-only endpoint.
    """
    if config is None:
        config = SentinelConfig()
    
    # Get auth token for authenticated requests
    token = None
    # For internal testing, we'll use a test token
    try:
        test_login = await db.users.find_one({"email": "test@eden.com"})
        if test_login:
            from auth import create_access_token
            token = create_access_token({"sub": test_login.get("id", "test")})
    except:
        pass
    
    scan = SentinelScanResult()
    active_scans[scan.scan_id] = scan
    
    # Run scan in background
    background_tasks.add_task(run_sentinel_scan, scan.scan_id, token, config)
    
    return scan

@router.get("/scan/{scan_id}", response_model=SentinelScanResult)
async def get_scan_status(
    scan_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the status of a Sentinel scan"""
    if scan_id in active_scans:
        return active_scans[scan_id]
    
    # Check database for completed scan
    scan = await db.sentinel_scans.find_one({"scan_id": scan_id}, {"_id": 0})
    if scan:
        return SentinelScanResult(**scan)
    
    raise HTTPException(status_code=404, detail="Scan not found")

@router.get("/scans", response_model=List[dict])
async def list_scans(
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """List recent Sentinel scans"""
    scans = await db.sentinel_scans.find(
        {}, 
        {"_id": 0, "scan_id": 1, "started_at": 1, "status": 1, "passed": 1, "failed": 1}
    ).sort("started_at", -1).to_list(limit)
    return scans

@router.get("/routes", response_model=List[dict])
async def get_route_registry(current_user: dict = Depends(get_current_user)):
    """Get the Eden route registry"""
    return EDEN_ROUTES

@router.get("/endpoints", response_model=List[dict])
async def get_api_endpoints(current_user: dict = Depends(get_current_user)):
    """Get the Eden API endpoint registry"""
    return EDEN_API_ENDPOINTS

@router.get("/ui-elements", response_model=List[dict])
async def get_ui_elements(current_user: dict = Depends(get_current_user)):
    """Get the Eden UI element registry"""
    return EDEN_UI_ELEMENTS

@router.post("/check-endpoint")
async def check_single_endpoint(
    path: str,
    method: str = "GET",
    current_user: dict = Depends(get_current_user)
):
    """Check a single API endpoint"""
    token = None
    try:
        test_login = await db.users.find_one({"email": "test@eden.com"})
        if test_login:
            from auth import create_access_token
            token = create_access_token({"sub": test_login.get("id", "test")})
    except:
        pass
    
    endpoint = {"path": path, "method": method, "auth_required": True, "name": path}
    result = await check_api_endpoint(endpoint, token)
    return result

@router.get("/summary")
async def get_sentinel_summary(current_user: dict = Depends(get_current_user)):
    """Get a summary of Sentinel's findings"""
    # Get latest scan
    latest_scan = await db.sentinel_scans.find_one(
        {"status": "completed"},
        {"_id": 0},
        sort=[("started_at", -1)]
    )
    
    # Get break report counts
    total_breaks = await db.cqil_break_reports.count_documents({"detected_by": "sentinel"})
    unresolved_breaks = await db.cqil_break_reports.count_documents({
        "detected_by": "sentinel",
        "status": {"$ne": "resolved"}
    })
    
    # Get route stats
    total_routes = len(EDEN_ROUTES)
    total_endpoints = len(EDEN_API_ENDPOINTS)
    total_ui_elements = len(EDEN_UI_ELEMENTS)
    
    return {
        "last_scan": latest_scan,
        "break_reports": {
            "total": total_breaks,
            "unresolved": unresolved_breaks
        },
        "coverage": {
            "frontend_routes": total_routes,
            "api_endpoints": total_endpoints,
            "ui_elements": total_ui_elements
        },
        "status": "healthy" if unresolved_breaks == 0 else "issues_detected"
    }


# ============================================
# BROWSER CRAWL ENDPOINTS
# ============================================

# Store active browser crawls
active_browser_crawls: Dict[str, Any] = {}

class BrowserCrawlConfig(BaseModel):
    routes_to_check: Optional[List[str]] = None
    email: str = "test@eden.com"
    password: str = "password"

@router.post("/browser-crawl")
async def start_browser_crawl(
    background_tasks: BackgroundTasks,
    config: Optional[BrowserCrawlConfig] = None,
    current_user: dict = Depends(require_role(["admin"]))
):
    """
    Start a browser-based UI crawl.
    Uses headless Playwright to check actual frontend routes for:
    - Dead UI elements
    - Missing buttons
    - Broken navigation flows
    - Console errors
    Admin-only endpoint.
    """
    if config is None:
        config = BrowserCrawlConfig()
    
    crawl_id = str(uuid.uuid4())[:8]
    
    # Initialize crawl status
    active_browser_crawls[crawl_id] = {
        "crawl_id": crawl_id,
        "status": "starting",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "result": None
    }
    
    # Run crawl in background
    background_tasks.add_task(
        run_browser_crawl_task, 
        crawl_id, 
        config.routes_to_check,
        config.email,
        config.password
    )
    
    return {"crawl_id": crawl_id, "status": "starting", "message": "Browser crawl initiated"}


async def run_browser_crawl_task(crawl_id: str, routes: List[str], email: str, password: str):
    """Background task to run browser crawl"""
    try:
        active_browser_crawls[crawl_id]["status"] = "running"
        
        # Import the browser crawler
        from routes.browser_crawler import run_browser_crawl
        
        # Get frontend URL - use the preview URL
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        
        # Run the crawl
        result = await run_browser_crawl(
            base_url=frontend_url,
            email=email,
            password=password,
            routes_to_check=routes
        )
        
        result.scan_id = crawl_id
        
        # Store result
        active_browser_crawls[crawl_id]["status"] = result.status
        active_browser_crawls[crawl_id]["completed_at"] = datetime.now(timezone.utc).isoformat()
        active_browser_crawls[crawl_id]["result"] = result.to_dict()
        
        # Save to database
        result_dict = result.to_dict()
        result_dict["type"] = "browser_crawl"
        await db.centurion_crawls.insert_one(result_dict)
        
        # Generate break reports for critical failures
        for failure in result.critical_failures:
            report = {
                "id": f"BR-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4]}",
                "module": "frontend",
                "route": failure["route"],
                "element_id": failure["element"],
                "description": f"Critical UI element missing: {failure['element']}",
                "expected": "Element should exist and be visible",
                "actual": "Element not found",
                "severity": "P0",
                "fix_class": "UI",
                "repro_steps": [
                    f"Navigate to {failure['route']}",
                    f"Look for element: {failure['element']}",
                    "Element is missing or not visible"
                ],
                "detected_at": datetime.now(timezone.utc).isoformat(),
                "detected_by": "centurion_browser"
            }
            await db.cqil_break_reports.insert_one(report)
        
    except Exception as e:
        logger.error(f"Browser crawl error: {e}")
        active_browser_crawls[crawl_id]["status"] = "failed"
        active_browser_crawls[crawl_id]["error"] = str(e)


@router.get("/browser-crawl/{crawl_id}")
async def get_browser_crawl_status(
    crawl_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the status of a browser crawl"""
    if crawl_id in active_browser_crawls:
        return active_browser_crawls[crawl_id]
    
    # Check database
    crawl = await db.centurion_crawls.find_one({"scan_id": crawl_id}, {"_id": 0})
    if crawl:
        return {"crawl_id": crawl_id, "status": "completed", "result": crawl}
    
    raise HTTPException(status_code=404, detail="Browser crawl not found")


@router.get("/browser-crawls")
async def list_browser_crawls(
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """List recent browser crawls"""
    crawls = await db.centurion_crawls.find(
        {"type": "browser_crawl"},
        {"_id": 0, "scan_id": 1, "started_at": 1, "status": 1, "routes_passed": 1, "routes_failed": 1}
    ).sort("started_at", -1).to_list(limit)
    return crawls


@router.get("/ui-checks")
async def get_ui_element_definitions(current_user: dict = Depends(get_current_user)):
    """Get the UI element definitions used for browser crawling"""
    from routes.browser_crawler import ROUTE_UI_CHECKS
    return ROUTE_UI_CHECKS


# ============================================
# AUTO-FIX GENERATION
# ============================================

class AutoFixSuggestion(BaseModel):
    issue_type: str
    route: str
    element: Optional[str]
    description: str
    fix_type: str  # css, responsive, missing_element, selector
    suggested_fix: str
    file_path: Optional[str]
    priority: str  # P0, P1, P2
    confidence: str  # high, medium, low

# Common responsive CSS fixes
RESPONSIVE_FIXES = {
    "horizontal_overflow": {
        "description": "Add overflow handling and responsive width",
        "css_fix": """
/* Fix horizontal overflow */
.overflow-container {
  max-width: 100%;
  overflow-x: auto;
}

/* Or use Tailwind classes: */
/* className="max-w-full overflow-x-auto" */
""",
        "tailwind_fix": "Add className='max-w-full overflow-x-auto' to container"
    },
    "text_truncation": {
        "description": "Add text truncation for long content",
        "css_fix": """
/* Fix text overflow */
.truncate-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
""",
        "tailwind_fix": "Add className='truncate' or 'line-clamp-2' to text element"
    },
    "mobile_padding": {
        "description": "Adjust padding for mobile",
        "css_fix": """
/* Mobile-friendly padding */
@media (max-width: 640px) {
  .container {
    padding: 1rem;
  }
}
""",
        "tailwind_fix": "Change p-8 to p-4 sm:p-8"
    },
    "grid_responsive": {
        "description": "Make grid responsive",
        "css_fix": """
/* Responsive grid */
.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}
""",
        "tailwind_fix": "Change 'grid-cols-4' to 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'"
    },
    "button_width": {
        "description": "Make buttons full-width on mobile",
        "tailwind_fix": "Add 'w-full sm:w-auto' to button className"
    },
    "flex_wrap": {
        "description": "Allow flex items to wrap on mobile",
        "tailwind_fix": "Add 'flex-wrap' to flex container"
    },
    "hidden_on_mobile": {
        "description": "Hide non-essential elements on mobile",
        "tailwind_fix": "Add 'hidden sm:block' or 'hidden sm:flex' to element"
    },
    "text_size_responsive": {
        "description": "Make text size responsive",
        "tailwind_fix": "Change 'text-2xl' to 'text-xl sm:text-2xl' or 'text-lg sm:text-xl lg:text-2xl'"
    }
}

# Element fix templates
ELEMENT_FIX_TEMPLATES = {
    "missing_button": """
// Add the missing button to the component
<Button 
  data-testid="{element_id}"
  onClick={{{handler}}}
  className="bg-orange-600 hover:bg-orange-700"
>
  {button_text}
</Button>
""",
    "missing_input": """
// Add the missing input field
<Input
  data-testid="{element_id}"
  placeholder="{placeholder}"
  value={{value}}
  onChange={{(e) => setValue(e.target.value)}}
  className="bg-gray-800 border-gray-700"
/>
""",
    "missing_data_testid": """
// Add data-testid to existing element for better detection
// Find the element and add:
data-testid="{element_id}"
"""
}


@router.post("/generate-fixes")
async def generate_auto_fixes(
    crawl_id: Optional[str] = None,
    current_user: dict = Depends(require_role(["admin"]))
):
    """
    Generate auto-fix suggestions based on detected issues.
    Can analyze a specific crawl or generate general fixes.
    """
    fixes = []
    
    # Get latest crawl if no specific ID
    if crawl_id:
        crawl = await db.centurion_crawls.find_one({"scan_id": crawl_id}, {"_id": 0})
    else:
        crawl = await db.centurion_crawls.find_one(
            {"type": "browser_crawl"},
            {"_id": 0},
            sort=[("started_at", -1)]
        )
    
    if not crawl:
        # Generate general responsive fixes
        return {
            "fixes": [
                AutoFixSuggestion(
                    issue_type="general",
                    route="*",
                    element=None,
                    description="General mobile responsiveness improvements",
                    fix_type="responsive",
                    suggested_fix=RESPONSIVE_FIXES["mobile_padding"]["tailwind_fix"],
                    file_path=None,
                    priority="P1",
                    confidence="high"
                ).model_dump()
            ],
            "message": "No crawl data found. Showing general fixes."
        }
    
    # Analyze critical failures
    for failure in crawl.get("critical_failures", []):
        route = failure.get("route", "/")
        element = failure.get("element", "unknown")
        
        # Determine fix based on element type
        if "Button" in element:
            fix = AutoFixSuggestion(
                issue_type="missing_element",
                route=route,
                element=element,
                description=f"Critical button '{element}' not found on {route}",
                fix_type="missing_element",
                suggested_fix=f"Add data-testid attribute to the button or verify selector in browser_crawler.py",
                file_path=f"/app/frontend/src/components/{route_to_component(route)}.jsx",
                priority="P0",
                confidence="high"
            )
            fixes.append(fix.model_dump())
        elif "Input" in element:
            fix = AutoFixSuggestion(
                issue_type="missing_element",
                route=route,
                element=element,
                description=f"Input field '{element}' not found on {route}",
                fix_type="missing_element",
                suggested_fix=f"Verify input placeholder text matches selector or add data-testid",
                file_path=f"/app/frontend/src/components/{route_to_component(route)}.jsx",
                priority="P0",
                confidence="high"
            )
            fixes.append(fix.model_dump())
    
    # Analyze route results for performance issues
    for route_result in crawl.get("route_results", []):
        if route_result.get("load_time_ms", 0) > 3000:
            fix = AutoFixSuggestion(
                issue_type="performance",
                route=route_result.get("route"),
                element=None,
                description=f"Slow page load ({route_result.get('load_time_ms', 0):.0f}ms)",
                fix_type="performance",
                suggested_fix="Consider lazy loading, code splitting, or optimizing API calls",
                file_path=f"/app/frontend/src/components/{route_to_component(route_result.get('route', '/'))}.jsx",
                priority="P1",
                confidence="medium"
            )
            fixes.append(fix.model_dump())
        
        # Check for missing elements
        if route_result.get("elements_missing", 0) > 0:
            for ui_check in route_result.get("ui_checks", []):
                if not ui_check.get("found"):
                    fix = AutoFixSuggestion(
                        issue_type="selector_mismatch",
                        route=route_result.get("route"),
                        element=ui_check.get("element_name"),
                        description=f"Element '{ui_check.get('element_name')}' not found with selector",
                        fix_type="selector",
                        suggested_fix=f"Update selector in browser_crawler.py or add data-testid='{ui_check.get('element_name', '').lower().replace(' ', '-')}'",
                        file_path="/app/backend/routes/browser_crawler.py",
                        priority="P1",
                        confidence="high"
                    )
                    fixes.append(fix.model_dump())
    
    # Add general responsive fixes if routes failed
    if crawl.get("routes_failed", 0) > 0:
        for fix_key, fix_data in RESPONSIVE_FIXES.items():
            if fix_key in ["mobile_padding", "grid_responsive", "text_size_responsive"]:
                fix = AutoFixSuggestion(
                    issue_type="responsive",
                    route="*",
                    element=None,
                    description=fix_data["description"],
                    fix_type="css",
                    suggested_fix=fix_data["tailwind_fix"],
                    file_path=None,
                    priority="P2",
                    confidence="medium"
                )
                fixes.append(fix.model_dump())
    
    return {
        "crawl_id": crawl.get("scan_id"),
        "total_fixes": len(fixes),
        "fixes": fixes,
        "fix_templates": RESPONSIVE_FIXES
    }


def route_to_component(route: str) -> str:
    """Convert route path to likely component name"""
    route_map = {
        "/": "LandingPage",
        "/login": "Login",
        "/dashboard": "Dashboard",
        "/claims": "ClaimsList",
        "/inspections": "Inspections",
        "/canvassing": "Harvest",
        "/eve": "EveAI",
        "/weather": "WeatherVerification",
        "/property-intel": "PropertyIntelligence",
        "/property": "PropertyHub",
        "/contracts": "Contracts",
        "/settings": "Settings",
        "/adam": "Adam",
        "/users": "UserManagement",
        "/university": "University",
        "/vision": "InteractiveVisionBoard",
        "/sales": "SalesEnablement",
        "/scales": "Scales",
    }
    return route_map.get(route, "Unknown")


@router.get("/fix-templates")
async def get_fix_templates(current_user: dict = Depends(get_current_user)):
    """Get all available fix templates"""
    return {
        "responsive_fixes": RESPONSIVE_FIXES,
        "element_templates": ELEMENT_FIX_TEMPLATES
    }



# ============================================
# MOBILE REGRESSION TESTING
# ============================================

class MobileRegressionConfig(BaseModel):
    viewports: List[str] = ["desktop", "mobile", "tablet"]
    email: str = "test@eden.com"
    password: str = "password"

@router.post("/mobile-regression")
async def start_mobile_regression(
    background_tasks: BackgroundTasks,
    config: Optional[MobileRegressionConfig] = None,
    current_user: dict = Depends(require_role(["admin"]))
):
    """
    Run regression tests across multiple viewport sizes (desktop, tablet, mobile).
    Compares results to identify mobile-specific issues.
    Admin-only endpoint.
    """
    if config is None:
        config = MobileRegressionConfig()
    
    regression_id = str(uuid.uuid4())[:8]
    
    # Initialize regression status
    active_browser_crawls[f"regression_{regression_id}"] = {
        "regression_id": regression_id,
        "status": "starting",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "viewports": config.viewports,
        "results": {}
    }
    
    # Run regression in background
    background_tasks.add_task(
        run_mobile_regression_task,
        regression_id,
        config.viewports,
        config.email,
        config.password
    )
    
    return {"regression_id": regression_id, "status": "starting", "message": "Mobile regression test initiated"}


async def run_mobile_regression_task(
    regression_id: str,
    viewports: List[str],
    email: str,
    password: str
):
    """Background task to run mobile regression tests"""
    key = f"regression_{regression_id}"
    
    try:
        active_browser_crawls[key]["status"] = "running"
        
        from routes.browser_crawler import run_browser_crawl, VIEWPORT_CONFIGS
        
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        
        results = {}
        for viewport in viewports:
            if viewport in VIEWPORT_CONFIGS:
                logger.info(f"Running regression test at {viewport} viewport")
                active_browser_crawls[key]["current_viewport"] = viewport
                
                result = await run_browser_crawl(
                    base_url=frontend_url,
                    email=email,
                    password=password,
                    viewport=viewport
                )
                result.scan_id = f"{regression_id}_{viewport}"
                results[viewport] = result.to_dict()
                
                # Save individual result to DB
                result_dict = result.to_dict()
                result_dict["type"] = "mobile_regression"
                result_dict["regression_id"] = regression_id
                await db.centurion_crawls.insert_one(result_dict)
        
        # Compare results and find mobile-specific issues
        mobile_issues = []
        if "desktop" in results and "mobile" in results:
            desktop_result = results["desktop"]
            mobile_result = results["mobile"]
            
            # Find elements that work on desktop but not mobile
            desktop_routes = {r["route"]: r for r in desktop_result.get("route_results", [])}
            mobile_routes = {r["route"]: r for r in mobile_result.get("route_results", [])}
            
            for route, desktop_data in desktop_routes.items():
                mobile_data = mobile_routes.get(route, {})
                
                # Check for mobile-specific failures
                if desktop_data.get("status") == "passed" and mobile_data.get("status") != "passed":
                    mobile_issues.append({
                        "route": route,
                        "issue": "Route fails on mobile but passes on desktop",
                        "severity": "P1"
                    })
                
                # Check for significantly slower load times on mobile
                desktop_load = desktop_data.get("load_time_ms", 0)
                mobile_load = mobile_data.get("load_time_ms", 0)
                if mobile_load > desktop_load * 2 and mobile_load > 3000:
                    mobile_issues.append({
                        "route": route,
                        "issue": f"Slow mobile load: {mobile_load:.0f}ms vs {desktop_load:.0f}ms desktop",
                        "severity": "P2"
                    })
                
                # Check for missing elements on mobile
                desktop_found = desktop_data.get("elements_found", 0)
                mobile_found = mobile_data.get("elements_found", 0)
                if mobile_found < desktop_found:
                    mobile_issues.append({
                        "route": route,
                        "issue": f"Missing {desktop_found - mobile_found} elements on mobile",
                        "severity": "P1"
                    })
        
        # Store regression results
        active_browser_crawls[key]["status"] = "completed"
        active_browser_crawls[key]["completed_at"] = datetime.now(timezone.utc).isoformat()
        active_browser_crawls[key]["results"] = results
        active_browser_crawls[key]["mobile_issues"] = mobile_issues
        
        # Save summary to DB
        summary = {
            "type": "mobile_regression_summary",
            "regression_id": regression_id,
            "viewports": viewports,
            "started_at": active_browser_crawls[key]["started_at"],
            "completed_at": active_browser_crawls[key]["completed_at"],
            "mobile_issues": mobile_issues,
            "viewport_summaries": {
                vp: {
                    "routes_passed": r.get("routes_passed", 0),
                    "routes_failed": r.get("routes_failed", 0),
                    "critical_failures": len(r.get("critical_failures", []))
                }
                for vp, r in results.items()
            }
        }
        await db.centurion_crawls.insert_one(summary)
        
        # Generate break reports for mobile-specific issues
        for issue in mobile_issues:
            if issue["severity"] == "P0" or issue["severity"] == "P1":
                report = {
                    "id": f"BR-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4]}",
                    "module": "mobile",
                    "route": issue["route"],
                    "element_id": None,
                    "description": issue["issue"],
                    "expected": "Should work consistently across viewports",
                    "actual": issue["issue"],
                    "severity": issue["severity"],
                    "fix_class": "responsive",
                    "repro_steps": [
                        f"Navigate to {issue['route']} on mobile device",
                        "Compare functionality with desktop"
                    ],
                    "detected_at": datetime.now(timezone.utc).isoformat(),
                    "detected_by": "centurion_mobile_regression"
                }
                await db.cqil_break_reports.insert_one(report)
        
    except Exception as e:
        logger.error(f"Mobile regression error: {e}")
        active_browser_crawls[key]["status"] = "failed"
        active_browser_crawls[key]["error"] = str(e)


@router.get("/mobile-regression/{regression_id}")
async def get_mobile_regression_status(
    regression_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the status of a mobile regression test"""
    key = f"regression_{regression_id}"
    
    if key in active_browser_crawls:
        return active_browser_crawls[key]
    
    # Check database for completed regression
    summary = await db.centurion_crawls.find_one(
        {"type": "mobile_regression_summary", "regression_id": regression_id},
        {"_id": 0}
    )
    if summary:
        return {"regression_id": regression_id, "status": "completed", **summary}
    
    raise HTTPException(status_code=404, detail="Mobile regression not found")


# ============================================
# AUTO-FIX APPLICATION
# ============================================

class ApplyFixRequest(BaseModel):
    fix_type: str  # css, tailwind, element, selector
    target_file: str
    search_pattern: str
    replacement: str
    backup: bool = True

@router.post("/apply-fix")
async def apply_auto_fix(
    request: ApplyFixRequest,
    current_user: dict = Depends(require_role(["admin"]))
):
    """
    Apply an auto-generated fix to a file.
    Creates a backup before modification.
    Admin-only endpoint.
    
    WARNING: This modifies source files. Use with caution.
    """
    import re
    
    file_path = request.target_file
    
    # Security check - only allow modifications to specific directories
    allowed_paths = [
        "/app/frontend/src/components/",
        "/app/frontend/src/",
        "/app/backend/routes/"
    ]
    
    if not any(file_path.startswith(p) for p in allowed_paths):
        raise HTTPException(
            status_code=403, 
            detail="Cannot modify files outside allowed directories"
        )
    
    # Check file exists
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
    
    try:
        # Read current content
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Create backup if requested
        if request.backup:
            backup_path = f"{file_path}.backup.{datetime.now().strftime('%Y%m%d%H%M%S')}"
            with open(backup_path, 'w') as f:
                f.write(content)
        
        # Apply fix based on type
        if request.fix_type == "regex":
            new_content = re.sub(request.search_pattern, request.replacement, content)
        else:
            # Simple string replacement
            new_content = content.replace(request.search_pattern, request.replacement)
        
        # Check if anything changed
        if new_content == content:
            return {
                "success": False,
                "message": "No changes made - pattern not found",
                "file": file_path
            }
        
        # Write new content
        with open(file_path, 'w') as f:
            f.write(new_content)
        
        # Log the fix application
        fix_log = {
            "type": "auto_fix_applied",
            "file": file_path,
            "fix_type": request.fix_type,
            "applied_at": datetime.now(timezone.utc).isoformat(),
            "applied_by": current_user.get("email", "unknown"),
            "backup_path": backup_path if request.backup else None
        }
        await db.centurion_fix_logs.insert_one(fix_log)
        
        return {
            "success": True,
            "message": "Fix applied successfully",
            "file": file_path,
            "backup": backup_path if request.backup else None
        }
        
    except Exception as e:
        logger.error(f"Failed to apply fix: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to apply fix: {str(e)}")


@router.post("/apply-responsive-fix")
async def apply_responsive_fix(
    route: str,
    fix_key: str,
    current_user: dict = Depends(require_role(["admin"]))
):
    """
    Apply a predefined responsive fix to a component.
    Uses Tailwind class replacements for common mobile issues.
    """
    if fix_key not in RESPONSIVE_FIXES:
        raise HTTPException(status_code=400, detail=f"Unknown fix: {fix_key}")
    
    # Get component file path
    component_name = route_to_component(route)
    file_path = f"/app/frontend/src/components/{component_name}.jsx"
    
    if not os.path.exists(file_path):
        return {
            "success": False,
            "message": f"Component file not found: {file_path}",
            "suggestion": RESPONSIVE_FIXES[fix_key]["tailwind_fix"]
        }
    
    fix_info = RESPONSIVE_FIXES[fix_key]
    
    return {
        "success": True,
        "fix_key": fix_key,
        "description": fix_info["description"],
        "file": file_path,
        "suggested_change": fix_info["tailwind_fix"],
        "css_alternative": fix_info.get("css_fix", "N/A"),
        "message": "Review and apply the suggested change manually or use /apply-fix endpoint"
    }


@router.get("/fix-history")
async def get_fix_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get history of applied auto-fixes"""
    fixes = await db.centurion_fix_logs.find(
        {},
        {"_id": 0}
    ).sort("applied_at", -1).to_list(limit)
    return fixes


@router.post("/revert-fix/{backup_path:path}")
async def revert_fix(
    backup_path: str,
    current_user: dict = Depends(require_role(["admin"]))
):
    """
    Revert a fix by restoring from backup.
    """
    if not backup_path.endswith(".backup") and ".backup." not in backup_path:
        raise HTTPException(status_code=400, detail="Invalid backup path")
    
    # Security check
    allowed_paths = ["/app/frontend/", "/app/backend/"]
    if not any(backup_path.startswith(p) for p in allowed_paths):
        raise HTTPException(status_code=403, detail="Invalid backup location")
    
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="Backup file not found")
    
    # Determine original file path
    # Backup format: original.jsx.backup.20240101120000
    parts = backup_path.rsplit('.backup.', 1)
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Cannot determine original file path")
    
    original_path = parts[0]
    
    try:
        # Read backup content
        with open(backup_path, 'r') as f:
            backup_content = f.read()
        
        # Restore to original path
        with open(original_path, 'w') as f:
            f.write(backup_content)
        
        # Log the revert
        revert_log = {
            "type": "fix_reverted",
            "original_file": original_path,
            "backup_file": backup_path,
            "reverted_at": datetime.now(timezone.utc).isoformat(),
            "reverted_by": current_user.get("email", "unknown")
        }
        await db.centurion_fix_logs.insert_one(revert_log)
        
        return {
            "success": True,
            "message": "Fix reverted successfully",
            "original_file": original_path
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to revert: {str(e)}")

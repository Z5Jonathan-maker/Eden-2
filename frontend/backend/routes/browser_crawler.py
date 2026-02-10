"""
Browser Crawler for Eden Centurion
Uses Playwright to crawl frontend routes and detect UI issues.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
import logging
import os

logger = logging.getLogger(__name__)

# UI Element checks for each route
ROUTE_UI_CHECKS = {
    "/": [
        {"selector": "[data-testid='get-started-btn']", "name": "Get Started Button", "critical": True},
        {"selector": "h1", "name": "Main Heading", "critical": True},
    ],
    "/login": [
        {"selector": "input[type='email']", "name": "Email Input", "critical": True},
        {"selector": "input[type='password']", "name": "Password Input", "critical": True},
        {"selector": "button[type='submit']", "name": "Login Button", "critical": True},
    ],
    "/dashboard": [
        {"selector": "[data-testid='dashboard-stats']", "name": "Dashboard Stats", "critical": False},
        {"selector": "[data-testid='recent-claims']", "name": "Recent Claims", "critical": False},
    ],
    "/claims": [
        {"selector": "[data-testid='new-claim-btn']", "name": "New Claim Button", "critical": True},
        {"selector": "[data-testid='claims-list']", "name": "Claims List", "critical": True},
    ],
    "/inspections": [
        {"selector": "[data-testid='rapid-capture-btn']", "name": "Rapid Capture Button", "critical": True},
        {"selector": "[data-testid='claim-selector']", "name": "Claim Selector", "critical": False},
    ],
    "/canvassing": [
        {"selector": "[data-testid='harvest-map']", "name": "Harvest Map", "critical": True},
        {"selector": "[data-testid='leaderboard-btn']", "name": "Leaderboard Tab", "critical": False},
    ],
    "/eve": [
        {"selector": "[data-testid='chat-input']", "name": "Chat Input", "critical": True},
        {"selector": "[data-testid='send-message-btn']", "name": "Send Button", "critical": True},
    ],
    "/weather": [
        {"selector": "[data-testid='address-input']", "name": "Address Input", "critical": True},
        {"selector": "[data-testid='search-btn']", "name": "Search Button", "critical": True},
    ],
    "/contracts": [
        {"selector": "[data-testid='contracts-list']", "name": "Contracts List", "critical": True},
    ],
    "/university": [
        {"selector": "[data-testid='courses-tab']", "name": "Courses Tab", "critical": False},
    ],
    "/adam": [
        {"selector": "[data-testid='run-tests-btn']", "name": "Run Tests Button", "critical": True},
    ],
    "/settings": [
        {"selector": "[data-testid='settings-form']", "name": "Settings Form", "critical": True},
    ],
}

# Mobile viewport configurations
VIEWPORT_CONFIGS = {
    "desktop": {"width": 1920, "height": 1080},
    "tablet": {"width": 768, "height": 1024},
    "mobile": {"width": 375, "height": 812},  # iPhone X/11/12
    "mobile_android": {"width": 360, "height": 800},  # Android standard
}


@dataclass
class RouteResult:
    route: str
    status: str  # passed, failed, error
    load_time_ms: float = 0
    viewport: str = "desktop"
    elements_found: int = 0
    elements_missing: int = 0
    ui_checks: List[Dict] = field(default_factory=list)
    console_errors: List[str] = field(default_factory=list)
    screenshot_path: Optional[str] = None
    error: Optional[str] = None


@dataclass
class CrawlResult:
    scan_id: str = ""
    status: str = "completed"
    started_at: str = ""
    completed_at: str = ""
    viewport_config: str = "desktop"
    routes_checked: int = 0
    routes_passed: int = 0
    routes_failed: int = 0
    total_elements_found: int = 0
    total_elements_missing: int = 0
    route_results: List[RouteResult] = field(default_factory=list)
    critical_failures: List[Dict] = field(default_factory=list)
    dead_ends_found: List[str] = field(default_factory=list)
    console_errors: List[Dict] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "scan_id": self.scan_id,
            "status": self.status,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "viewport_config": self.viewport_config,
            "routes_checked": self.routes_checked,
            "routes_passed": self.routes_passed,
            "routes_failed": self.routes_failed,
            "total_elements_found": self.total_elements_found,
            "total_elements_missing": self.total_elements_missing,
            "route_results": [
                {
                    "route": r.route,
                    "status": r.status,
                    "load_time_ms": r.load_time_ms,
                    "viewport": r.viewport,
                    "elements_found": r.elements_found,
                    "elements_missing": r.elements_missing,
                    "ui_checks": r.ui_checks,
                    "console_errors": r.console_errors,
                    "error": r.error
                }
                for r in self.route_results
            ],
            "critical_failures": self.critical_failures,
            "dead_ends_found": self.dead_ends_found,
            "console_errors": self.console_errors
        }


async def run_browser_crawl(
    base_url: str,
    email: str = "test@eden.com",
    password: str = "password",
    routes_to_check: Optional[List[str]] = None,
    viewport: str = "desktop"
) -> CrawlResult:
    """
    Run a browser-based UI crawl using Playwright.
    
    Args:
        base_url: The frontend URL to crawl
        email: Login email
        password: Login password
        routes_to_check: Optional list of routes to check (defaults to all)
        viewport: Viewport configuration (desktop, tablet, mobile, mobile_android)
    """
    result = CrawlResult(
        started_at=datetime.now(timezone.utc).isoformat(),
        viewport_config=viewport
    )
    
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error("Playwright not installed. Install with: pip install playwright && playwright install")
        result.status = "failed"
        result.completed_at = datetime.now(timezone.utc).isoformat()
        return result
    
    # Determine which routes to check
    if routes_to_check is None:
        routes_to_check = list(ROUTE_UI_CHECKS.keys())
    
    # Get viewport config
    vp_config = VIEWPORT_CONFIGS.get(viewport, VIEWPORT_CONFIGS["desktop"])
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport=vp_config,
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15" if "mobile" in viewport else None
        )
        page = await context.new_page()
        
        # Collect console errors
        console_errors = []
        page.on("console", lambda msg: console_errors.append({
            "type": msg.type,
            "text": msg.text,
            "url": msg.location.get("url", "") if msg.location else ""
        }) if msg.type == "error" else None)
        
        try:
            # Login first
            await page.goto(f"{base_url}/login", wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(1000)
            
            # Fill login form
            email_input = page.locator('input[type="email"]')
            if await email_input.count() > 0:
                await email_input.fill(email)
                await page.locator('input[type="password"]').fill(password)
                await page.locator('button[type="submit"]').click()
                await page.wait_for_timeout(3000)
                logger.info("Logged in successfully")
            
            # Crawl each route
            for route in routes_to_check:
                route_result = RouteResult(
                    route=route,
                    viewport=viewport
                )
                
                try:
                    # Navigate to route
                    start_time = datetime.now(timezone.utc)
                    await page.goto(f"{base_url}{route}", wait_until="networkidle", timeout=30000)
                    await page.wait_for_timeout(1000)
                    route_result.load_time_ms = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
                    
                    # Check UI elements
                    ui_checks = ROUTE_UI_CHECKS.get(route, [])
                    for check in ui_checks:
                        element = page.locator(check["selector"])
                        found = await element.count() > 0
                        
                        check_result = {
                            "element_name": check["name"],
                            "selector": check["selector"],
                            "found": found,
                            "critical": check.get("critical", False)
                        }
                        route_result.ui_checks.append(check_result)
                        
                        if found:
                            route_result.elements_found += 1
                        else:
                            route_result.elements_missing += 1
                            if check.get("critical"):
                                result.critical_failures.append({
                                    "route": route,
                                    "element": check["name"],
                                    "selector": check["selector"]
                                })
                    
                    # Determine route status
                    critical_missing = any(
                        not c["found"] and c.get("critical") 
                        for c in route_result.ui_checks
                    )
                    route_result.status = "failed" if critical_missing else "passed"
                    
                    # Check for dead ends (no clickable elements)
                    clickable = await page.locator("button, a, [role='button']").count()
                    if clickable == 0:
                        result.dead_ends_found.append(route)
                    
                except Exception as e:
                    route_result.status = "error"
                    route_result.error = str(e)
                    logger.error(f"Error crawling {route}: {e}")
                
                # Collect console errors for this route
                route_result.console_errors = [e["text"] for e in console_errors if route in e.get("url", "")]
                
                # Add to results
                result.route_results.append(route_result)
                result.routes_checked += 1
                
                if route_result.status == "passed":
                    result.routes_passed += 1
                else:
                    result.routes_failed += 1
                
                result.total_elements_found += route_result.elements_found
                result.total_elements_missing += route_result.elements_missing
        
        except Exception as e:
            logger.error(f"Browser crawl failed: {e}")
            result.status = "failed"
        
        finally:
            await browser.close()
    
    result.completed_at = datetime.now(timezone.utc).isoformat()
    result.console_errors = console_errors
    
    return result


async def run_mobile_regression(
    base_url: str,
    email: str = "test@eden.com",
    password: str = "password"
) -> Dict[str, CrawlResult]:
    """
    Run regression tests at multiple viewport sizes.
    Returns results for desktop, tablet, and mobile viewports.
    """
    results = {}
    
    for viewport in ["desktop", "mobile", "tablet"]:
        logger.info(f"Running crawl at {viewport} viewport")
        result = await run_browser_crawl(
            base_url=base_url,
            email=email,
            password=password,
            viewport=viewport
        )
        results[viewport] = result
    
    return results

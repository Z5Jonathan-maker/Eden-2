# CONTINUOUS RELIABILITY SPEC
## Zero Dead Ends Guarantee System

---

## 1. CORE GUARANTEE

```
┌─────────────────────────────────────────────────────────────┐
│                CONTINUOUS RELIABILITY PROMISE                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✗ NO dead buttons                                          │
│  ✗ NO dead links                                            │
│  ✗ NO dead screens                                          │
│  ✗ NO silent failures                                       │
│  ✗ NO broken formatting                                     │
│                                                             │
│  Every element that LOOKS clickable MUST be clickable.     │
│  Every click MUST have a response.                          │
│  Every workflow MUST have a next action or clear exit.     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. AUTOMATED VERIFICATION SYSTEM

### 2.1 The Centurion (Existing)
```
COMPONENT: /app/backend/routes/centurion.py

CAPABILITIES:
- API endpoint scanning (14 routes)
- Headless browser UI crawling (Playwright)
- Element visibility checking
- Navigation verification
- Auto-fix suggestion generation

TRIGGERS:
- Manual via Adam dashboard
- Pre-deployment hook
- Scheduled (nightly)
```

### 2.2 Route Registry
```typescript
interface RouteRegistry {
  frontend: FrontendRoute[];
  backend: BackendRoute[];
}

interface FrontendRoute {
  path: string;
  name: string;
  auth_required: boolean;
  expected_elements: string[];    // CSS selectors that MUST exist
  expected_actions: string[];     // Buttons/links that MUST work
  mobile_breakpoints: number[];   // Viewports to test
}

interface BackendRoute {
  path: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  name: string;
  auth_required: boolean;
  expected_status: number;
  response_schema: object;        // JSON schema validation
}
```

### 2.3 Required Frontend Routes (Harvest Focus)
```typescript
const HARVEST_ROUTES: FrontendRoute[] = [
  {
    path: '/canvassing',
    name: 'Harvest Map',
    auth_required: true,
    expected_elements: [
      '.leaflet-container',           // Map container
      '.enzy-pin-inner',              // At least one pin (or empty state)
      '[data-testid="add-pin-btn"]',  // Add pin button
      '[data-testid="locate-btn"]',   // Locate me button
      '[data-testid="refresh-btn"]',  // Refresh button
      'button:has-text("Map")',       // Map tab
      'button:has-text("Ranks")',     // Ranks tab
    ],
    expected_actions: [
      { selector: 'button:has-text("Map")', action: 'click', result: 'tab_switch' },
      { selector: 'button:has-text("Ranks")', action: 'click', result: 'tab_switch' },
      { selector: '[data-testid="add-pin-btn"]', action: 'click', result: 'toggle_mode' },
    ],
    mobile_breakpoints: [375, 414, 768]
  }
];
```

---

## 3. TEST CATEGORIES

### 3.1 Element Existence Tests
```
FOR EACH ROUTE:
  FOR EACH expected_element:
    1. Navigate to route
    2. Wait for load (networkidle)
    3. Query selector
    4. Assert element exists
    5. Assert element visible
    6. Assert element in viewport (mobile)
```

### 3.2 Click Response Tests
```
FOR EACH clickable element:
  1. Click element
  2. Assert ONE of:
     - Navigation occurred
     - Modal/dialog opened
     - State changed
     - Toast appeared
     - Error message shown
  3. FAIL if nothing happens (silent failure)
```

### 3.3 Workflow Completion Tests
```
CRITICAL WORKFLOWS:
1. Pin Drop Workflow
   - Tap map → Pin appears
   - Tap disposition → Color changes
   - Sheet dismisses → Ready for next

2. Leaderboard View Workflow
   - Tap Ranks tab → Leaderboard loads
   - Data appears within 2s
   - Tap period filter → Data refreshes

3. Competition View Workflow
   - Tap Compete tab → Competitions load
   - Active competition visible (if any)
   - Progress bar functional

4. Badge View Workflow
   - Tap Badges tab → Badge grid loads
   - Earned badges distinguished from locked
   - Tap badge → Shows criteria
```

### 3.4 Mobile Formatting Tests
```
FOR EACH mobile_breakpoint:
  1. Set viewport size
  2. Navigate to route
  3. Check for:
     - Horizontal scroll (FAIL if exists)
     - Text overflow (FAIL if clipped)
     - Touch targets (FAIL if < 44px)
     - Bottom sheet usability
     - Tab bar visibility
```

---

## 4. FAILURE DETECTION

### 4.1 Dead Button Detection
```typescript
async function detectDeadButtons(page: Page): Promise<DeadButton[]> {
  const buttons = await page.locator('button, [role="button"], .btn').all();
  const deadButtons: DeadButton[] = [];
  
  for (const button of buttons) {
    const beforeState = await capturePageState(page);
    
    await button.click({ force: true });
    await page.waitForTimeout(500);
    
    const afterState = await capturePageState(page);
    
    if (statesAreIdentical(beforeState, afterState)) {
      deadButtons.push({
        selector: await button.getAttribute('data-testid') || await button.textContent(),
        location: await button.boundingBox(),
        severity: 'CRITICAL'
      });
    }
  }
  
  return deadButtons;
}
```

### 4.2 Dead Link Detection
```typescript
async function detectDeadLinks(page: Page): Promise<DeadLink[]> {
  const links = await page.locator('a[href]').all();
  const deadLinks: DeadLink[] = [];
  
  for (const link of links) {
    const href = await link.getAttribute('href');
    
    if (href?.startsWith('#') || href?.startsWith('javascript:')) continue;
    
    try {
      const response = await page.goto(href, { waitUntil: 'networkidle' });
      
      if (!response || response.status() >= 400) {
        deadLinks.push({
          href,
          status: response?.status() || 0,
          severity: 'HIGH'
        });
      }
    } catch (error) {
      deadLinks.push({
        href,
        error: error.message,
        severity: 'HIGH'
      });
    }
    
    await page.goBack();
  }
  
  return deadLinks;
}
```

### 4.3 Silent Failure Detection
```typescript
async function detectSilentFailures(page: Page): Promise<SilentFailure[]> {
  const failures: SilentFailure[] = [];
  
  // Monitor console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      failures.push({
        type: 'console_error',
        message: msg.text(),
        severity: 'MEDIUM'
      });
    }
  });
  
  // Monitor network failures
  page.on('requestfailed', request => {
    failures.push({
      type: 'network_failure',
      url: request.url(),
      error: request.failure()?.errorText,
      severity: 'HIGH'
    });
  });
  
  // Monitor unhandled promise rejections
  page.on('pageerror', error => {
    failures.push({
      type: 'page_error',
      message: error.message,
      severity: 'CRITICAL'
    });
  });
  
  return failures;
}
```

### 4.4 Formatting Breakage Detection
```typescript
async function detectFormattingIssues(page: Page): Promise<FormattingIssue[]> {
  const issues: FormattingIssue[] = [];
  
  // Check for horizontal overflow
  const hasHorizontalScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  
  if (hasHorizontalScroll) {
    issues.push({
      type: 'horizontal_overflow',
      severity: 'HIGH'
    });
  }
  
  // Check for text overflow
  const overflowedElements = await page.locator('*').evaluateAll(elements => {
    return elements
      .filter(el => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)
      .map(el => ({
        tag: el.tagName,
        className: el.className,
        text: el.textContent?.substring(0, 50)
      }));
  });
  
  for (const el of overflowedElements) {
    issues.push({
      type: 'text_overflow',
      element: el,
      severity: 'MEDIUM'
    });
  }
  
  // Check touch target sizes
  const smallTargets = await page.locator('button, a, [role="button"]').evaluateAll(elements => {
    return elements
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      })
      .map(el => ({
        tag: el.tagName,
        size: { width: el.clientWidth, height: el.clientHeight },
        text: el.textContent?.substring(0, 20)
      }));
  });
  
  for (const target of smallTargets) {
    issues.push({
      type: 'small_touch_target',
      element: target,
      severity: 'MEDIUM'
    });
  }
  
  return issues;
}
```

---

## 5. INTEGRITY BAR

### 5.1 Real-Time Health Display
```
┌─────────────────────────────────────────────────────────────┐
│  INTEGRITY: ● OPERATIONAL | All systems operational         │
└─────────────────────────────────────────────────────────────┘

STATUS COLORS:
- GREEN (●): All tests passing, no issues
- YELLOW (●): Minor issues detected, non-blocking
- RED (●): Critical issues, requires attention

VISIBILITY: Admin-only (top bar when logged in as admin)
```

### 5.2 Health Components
```typescript
interface IntegrityHealth {
  overall_status: 'green' | 'yellow' | 'red';
  components: {
    database: ComponentHealth;
    api_routes: ComponentHealth;
    ui_elements: ComponentHealth;
    integrations: ComponentHealth;
    performance: ComponentHealth;
  };
  last_scan: datetime;
  issues_found: number;
  issues_resolved: number;
}
```

---

## 6. AUTO-FIX SYSTEM

### 6.1 Fix Categories
```
CATEGORY 1: SELECTOR FIXES
- Missing data-testid attributes
- Incorrect CSS class names
- Outdated element references

CATEGORY 2: STYLING FIXES
- Responsive breakpoint issues
- Text overflow solutions
- Touch target sizing

CATEGORY 3: ACCESSIBILITY FIXES
- Missing ARIA labels
- Color contrast issues
- Focus management

CATEGORY 4: CODE FIXES
- Missing error handlers
- Unhandled promise rejections
- Missing null checks
```

### 6.2 Fix Generation
```typescript
interface AutoFix {
  issue_id: string;
  file_path: string;
  line_number?: number;
  
  original_code?: string;
  suggested_fix: string;
  
  confidence: 'high' | 'medium' | 'low';
  fix_type: 'selector' | 'style' | 'accessibility' | 'code';
  
  auto_applicable: boolean;     // Can be applied without review
  requires_review: boolean;     // Needs human approval
}
```

### 6.3 Fix Application
```
AUTO-APPLY (confidence: high, auto_applicable: true):
1. Generate fix
2. Create backup
3. Apply fix
4. Run verification
5. Rollback if verification fails

REVIEW-REQUIRED:
1. Generate fix
2. Show in Adam dashboard
3. Human reviews and approves
4. Apply fix
5. Run verification
```

---

## 7. RELEASE GATE

### 7.1 Pre-Release Checks
```
BLOCKING CHECKS (must pass):
□ All API endpoints return expected status
□ All critical UI elements exist
□ No dead buttons in core workflows
□ No horizontal scroll on mobile
□ All tabs switch correctly
□ Pin drop workflow completes
□ Disposition change workflow completes

NON-BLOCKING CHECKS (warning only):
□ Performance benchmarks
□ Minor styling issues
□ Non-critical element visibility
```

### 7.2 Release Decision
```
RELEASE ALLOWED IF:
- All blocking checks pass
- No CRITICAL issues
- No more than 3 HIGH issues
- All HIGH issues have workarounds

RELEASE BLOCKED IF:
- Any blocking check fails
- Any CRITICAL issue exists
- More than 5 HIGH issues
- Any core workflow broken
```

---

## 8. SCHEDULING

### 8.1 Scan Schedule
```
NIGHTLY (2:00 AM):
- Full route scan
- All mobile breakpoints
- Performance benchmarks
- Generate report

PRE-DEPLOY (automatic):
- Core workflow verification
- Critical element check
- Blocking issue detection

ON-DEMAND (via Adam dashboard):
- User-triggered scans
- Specific route testing
- Auto-fix generation
```

### 8.2 Alert Channels
```
CRITICAL ISSUES:
- Push notification to admins
- Email to tech lead
- Slack/Teams integration (if configured)
- Dashboard banner

HIGH ISSUES:
- Dashboard notification
- Email summary (daily digest)

MEDIUM/LOW ISSUES:
- Dashboard only
- Weekly summary report
```

---

## 9. METRICS & REPORTING

### 9.1 Key Metrics
```
RELIABILITY SCORE (0-100):
= (passing_tests / total_tests) * 100
- Target: 98%+
- Alert threshold: < 95%

MEAN TIME TO DETECTION (MTTD):
= Average time between issue introduction and detection
- Target: < 4 hours

MEAN TIME TO RESOLUTION (MTTR):
= Average time between detection and fix
- Target: < 24 hours for HIGH
- Target: < 4 hours for CRITICAL
```

### 9.2 Reports
```
DAILY INTEGRITY REPORT:
- Issues found today
- Issues resolved today
- Current reliability score
- Trending issues

WEEKLY SUMMARY:
- Total scans performed
- Issue breakdown by category
- Most common issues
- Auto-fixes applied

MONTHLY ANALYSIS:
- Reliability trend
- Issue root causes
- Improvement recommendations
- Capacity planning
```

---

## 10. HARVEST-SPECIFIC CHECKS

### 10.1 Pin System Verification
```
CHECK: Pin Drop Functionality
1. Navigate to /canvassing
2. Enable add-pin mode
3. Click on map
4. Verify pin appears
5. Verify bottom sheet opens
6. Verify address geocodes

CHECK: Disposition Change
1. Click on existing pin
2. Verify bottom sheet opens
3. Click each disposition button
4. Verify pin color changes
5. Verify toast appears
6. Verify stats update
```

### 10.2 Gamification Verification
```
CHECK: Leaderboard
1. Navigate to Ranks tab
2. Verify data loads
3. Verify period filter works
4. Verify user entry visible
5. Verify tap → profile navigation

CHECK: Badges
1. Navigate to Badges tab
2. Verify badge grid loads
3. Verify earned vs locked distinction
4. Verify tap → criteria display

CHECK: Competitions
1. Navigate to Compete tab
2. Verify competition list loads
3. If active competition exists:
   - Verify progress bar
   - Verify time remaining
   - Verify rankings
```

### 10.3 Mobile-Specific Checks
```
VIEWPORT: 375px (iPhone SE)
- Map fills screen
- Bottom stats bar visible
- Tabs accessible
- Pin tap targets adequate

VIEWPORT: 414px (iPhone Plus)
- Same as above
- Additional spacing verified

VIEWPORT: 768px (iPad Mini)
- Two-column layouts correct
- Modal sizing appropriate
```

---

## 11. IMPLEMENTATION STATUS

### Currently Implemented:
- ✅ API endpoint scanning
- ✅ UI crawling (Playwright)
- ✅ Auto-fix suggestions
- ✅ Integrity Bar (admin view)
- ✅ Adam QA dashboard

### To Be Implemented:
- ⬜ Mobile viewport regression
- ⬜ Automated fix application
- ⬜ Pre-release gate
- ⬜ Nightly scheduled scans
- ⬜ Alert integrations
- ⬜ Reliability score dashboard

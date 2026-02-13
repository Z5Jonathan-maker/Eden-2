# Performance & Refactoring Validation Checklist

**Date:** February 13, 2026
**Session:** Powerhouse Plow Mode - Infrastructure Sprint
**Status:** Validation Phase

---

## 🎯 Executive Summary

This document tracks the validation status of critical infrastructure changes made during the refactoring sprint. All items must be validated before deploying to production.

---

## ✅ FRONTEND VALIDATIONS

### **1. ClaimDetails.jsx Component Decomposition**

**Status:** ⚠️ Needs Testing
**Priority:** HIGH
**Reduction:** 2187 → 892 lines (59%)

| Component | Lines | Status | Test Coverage |
|-----------|-------|--------|---------------|
| ClaimHeader | 112 | ⚠️ Needs Smoke Test | Created |
| ClaimQuickActions | 678 | ⚠️ Needs Integration Test | Pending |
| ClaimTabs | 233 | ⚠️ Needs Smoke Test | Created |
| ScheduleAppointmentModal | 127 | ⚠️ Needs Smoke Test | Created |
| PhotoViewerModal | 88 | ⚠️ Needs Smoke Test | Created |
| ClaimEditModal | 124 | ⚠️ Needs Smoke Test | Created |

**Validation Steps:**
- [ ] Run `npm test -- ClaimComponents.test.jsx`
- [ ] Manual testing: Open claim details page
- [ ] Verify all modals open/close correctly
- [ ] Test schedule appointment flow
- [ ] Test photo viewer functionality
- [ ] Test claim editing flow
- [ ] Verify no console errors
- [ ] Check network tab - ensure no duplicate requests

**Regression Risks:**
- Props not passed correctly to extracted components
- State management issues between parent/child
- Event handlers not bound properly
- CSS/styling issues with component boundaries

---

### **2. API Client Migration (httpOnly Cookies)**

**Status:** ✅ Complete (100% migrated)
**Priority:** CRITICAL
**Impact:** Security (XSS prevention)

**Validation Steps:**
- [ ] Test login flow - verify token in httpOnly cookie
- [ ] Test logout flow - verify cookie cleared
- [ ] Verify all API calls use credentials: 'include'
- [ ] Test protected routes require authentication
- [ ] Verify WebSocket fallback to polling works
- [ ] Test token expiration handling

**Security Validation:**
- [ ] Inspect browser dev tools - no token in localStorage
- [ ] Verify token inaccessible to JavaScript
- [ ] Test XSS payload injection (should NOT access token)

---

## ⚡ BACKEND VALIDATIONS

### **3. MongoDB Indexes**

**Status:** ⚠️ Not Applied
**Priority:** CRITICAL
**Script:** `backend/scripts/create_indexes.py`

**Indexes to Create:** 9 collections, 50+ indexes

| Collection | Indexes | Priority |
|------------|---------|----------|
| users | 4 (email unique, role, active) | CRITICAL |
| claims | 9 (status, assigned_to, etc.) | CRITICAL |
| notes | 4 (claim_id CRITICAL) | CRITICAL |
| documents | 5 (claim_id CRITICAL) | HIGH |
| inspection_photos | 5 (claim_id, geospatial) | HIGH |
| notifications | 4 (user_id compound) | MEDIUM |
| supplements | 2 | MEDIUM |
| canvassing_pins | 4 (geospatial) | HIGH |
| inspections | 4 | MEDIUM |

**Validation Steps:**
1. **Dry Run (Dev Environment):**
   ```bash
   # Set dev MongoDB URL in .env
   MONGODB_URL=mongodb://localhost:27017
   DATABASE_NAME=eden_dev

   # Run index creation
   python -m backend.scripts.create_indexes
   ```

2. **Verify Indexes Created:**
   ```javascript
   // MongoDB shell
   db.claims.getIndexes()
   db.notes.getIndexes()
   // etc.
   ```

3. **Test Query Performance:**
   ```python
   # Before indexes
   db.claims.find({"status": "In Progress"}).explain("executionStats")

   # After indexes
   # Should show "IXSCAN" instead of "COLLSCAN"
   ```

4. **Production Deployment:**
   - [ ] Backup database before applying indexes
   - [ ] Run during low-traffic window
   - [ ] Monitor index creation progress
   - [ ] Verify no performance degradation during creation
   - [ ] Test query performance after completion

**Expected Performance Improvement:**
- Full collection scans → Index scans
- 100-1000ms queries → Sub-100ms queries
- Supports 10x current data volume

---

### **4. Aggregation Pipelines**

**Status:** ⚠️ Integration Tests Ready, Not Run
**Priority:** CRITICAL
**Files:**
- `services/aggregation_examples.py`
- `utils/claim_aggregations.py`
- `tests/test_aggregations_integration.py`

**Pipelines to Validate:**

| Pipeline | Performance Claim | Status |
|----------|-------------------|--------|
| get_claim_with_related_counts | 5x faster (5 queries → 1) | ⚠️ Needs Testing |
| get_claims_list_with_counts | 250x faster (list view) | ⚠️ Needs Testing |
| get_user_dashboard_stats | 10x faster (dashboard) | ⚠️ Needs Testing |
| get_leaderboard_with_stats | 40x faster (Harvest) | ⚠️ Needs Testing |

**Validation Steps:**
1. **Setup Test Environment:**
   ```bash
   # Ensure MongoDB running
   docker-compose up -d mongodb  # or start local MongoDB

   # Load test data
   python -m backend.scripts.seed_test_data
   ```

2. **Run Integration Tests:**
   ```bash
   cd backend
   python tests/test_aggregations_integration.py
   ```

3. **Expected Output:**
   ```
   ✅ get_claim_with_related_counts: PASSED
      - Notes count: 3
      - Docs count: 2
      - Photos count: 5

   ✅ get_claim_with_related_data: PASSED
      - Full notes array: 3 items

   ⚡ PERFORMANCE COMPARISON:
      N+1 queries: 45.23ms (4 queries)
      Aggregation: 8.91ms (1 query)
      Improvement: 5.1x faster

   ✅ Performance test: PASSED
   ```

4. **Integration with Routes:**
   - [ ] Update `routes/claims.py` to use aggregations
   - [ ] Test `/api/claims/{id}` endpoint response time
   - [ ] Test `/api/claims` list endpoint with pagination
   - [ ] Verify data integrity (no missing fields)

**Performance Benchmarks (with indexes):**
- Claim details page: < 100ms response time
- Claims list (50 items): < 200ms response time
- Dashboard stats: < 150ms response time

---

### **5. Pagination Infrastructure**

**Status:** ⚠️ Created, Not Integrated
**Priority:** HIGH
**File:** `backend/utils/pagination.py`

**Validation Steps:**
1. **Unit Tests:**
   ```bash
   pytest backend/tests/test_pagination.py -v
   ```

2. **Integration with Endpoints:**
   - [ ] Apply to `/api/claims` list endpoint
   - [ ] Apply to `/api/harvest/leaderboard`
   - [ ] Apply to `/api/notes`
   - [ ] Apply to `/api/documents`

3. **Test Pagination Scenarios:**
   - [ ] First page (page=1)
   - [ ] Middle pages (page=5)
   - [ ] Last page
   - [ ] Empty results
   - [ ] Invalid page numbers (0, -1, 999999)
   - [ ] Invalid page_size (0, -1, 999)
   - [ ] Max page_size enforcement (200 items max)

4. **Test Faceted Pagination ($facet):**
   - [ ] Verify data + count in single query
   - [ ] Compare performance vs. separate count query
   - [ ] Validate total_pages calculation

**Expected Behavior:**
- Max 200 items per page
- Consistent response structure
- Graceful handling of edge cases
- No memory overload on large datasets

---

### **6. Route Modularization (Incentives)**

**Status:** ⚠️ Partial (Metrics Only)
**Priority:** MEDIUM
**Files:**
- `routes/incentives/metrics.py` (✅ Created)
- `routes/incentives/__init__.py` (✅ Created)

**Remaining Splits:**
- [ ] seasons.py (~400 lines)
- [ ] templates.py (~350 lines)
- [ ] competitions.py (~800 lines)

**Validation Steps:**
1. **Test Metrics Router:**
   ```bash
   # Start server
   uvicorn server:app --reload

   # Test endpoints
   curl http://localhost:8000/api/incentives/metrics
   curl http://localhost:8000/api/incentives/metrics/metric-doors
   ```

2. **Update Server Integration:**
   - [ ] Import incentives router in `server.py`
   - [ ] Include router: `app.include_router(incentives_router)`
   - [ ] Test all metrics endpoints work
   - [ ] Verify backward compatibility

3. **Complete Remaining Splits:**
   - [ ] Extract seasons routes
   - [ ] Extract templates routes
   - [ ] Extract competitions routes
   - [ ] Update __init__.py to include all routers
   - [ ] Remove or deprecate old `routes/incentives_engine.py`

---

## 🔒 SECURITY VALIDATIONS

### **Critical Security Items**

- [ ] **httpOnly Cookies:** Verify token inaccessible to JavaScript
- [ ] **CSRF Protection:** Add if missing (separate task)
- [ ] **Error Messages:** Ensure no internal details exposed to client
- [ ] **Rate Limiting:** Verify works with Redis (or in-memory for dev)
- [ ] **RBAC:** Test permissions on new/modified routes
- [ ] **Input Validation:** Pydantic models validate all inputs
- [ ] **SQL Injection:** N/A (using MongoDB, but validate no injection in aggregations)

---

## 📊 PERFORMANCE BENCHMARKS

### **Target Metrics (After Indexes + Aggregations)**

| Endpoint | Target Response Time | Current | Status |
|----------|---------------------|---------|--------|
| GET /api/claims/{id} | < 100ms | ⚠️ Unknown | Needs Testing |
| GET /api/claims (list) | < 200ms | ⚠️ Unknown | Needs Testing |
| GET /api/dashboard/stats | < 150ms | ⚠️ Unknown | Needs Testing |
| GET /api/harvest/leaderboard | < 250ms | ⚠️ Unknown | Needs Testing |
| POST /api/claims | < 150ms | ⚠️ Unknown | Needs Testing |

### **Measurement Tools:**
- Backend: FastAPI built-in timing middleware
- Frontend: Chrome DevTools Network tab
- Database: MongoDB profiler (`db.setProfilingLevel(2)`)
- APM: Consider adding Sentry or DataDog

---

## 🧪 TEST COVERAGE SUMMARY

### **Created Tests:**
- ✅ `tests/test_aggregations_integration.py` (requires MongoDB)
- ✅ `frontend/src/tests/components/ClaimComponents.test.jsx`

### **Pending Tests:**
- [ ] `tests/test_pagination.py` (unit tests)
- [ ] `tests/test_indexes_performance.py` (before/after comparison)
- [ ] `tests/test_auth_httponly_cookies.py` (security)
- [ ] E2E tests for refactored ClaimDetails page

---

## 📋 DEPLOYMENT CHECKLIST

### **Pre-Deployment:**
1. [ ] All tests passing
2. [ ] Performance benchmarks meet targets
3. [ ] Security validations complete
4. [ ] Database backup created
5. [ ] Rollback plan documented

### **Deployment Steps:**
1. [ ] Deploy frontend (extracted components)
2. [ ] Apply MongoDB indexes (low-traffic window)
3. [ ] Deploy backend (aggregations + pagination)
4. [ ] Monitor error rates
5. [ ] Monitor response times
6. [ ] Validate no regressions

### **Post-Deployment:**
1. [ ] Run smoke tests on production
2. [ ] Monitor logs for errors
3. [ ] Check APM metrics
4. [ ] Verify performance improvements
5. [ ] Document any issues

---

## 🚀 NEXT STEPS

### **Immediate (This Week):**
1. Run frontend component smoke tests
2. Apply MongoDB indexes to dev database
3. Run aggregation integration tests
4. Apply pagination to claims endpoint
5. Test end-to-end claim details flow

### **Short-Term (Next Week):**
1. Complete incentives route modularization
2. Extract university.py (1769 lines)
3. Extract harvest_v2.py (1414 lines)
4. Add Redis caching layer
5. Performance monitoring setup

### **Medium-Term (Month 2):**
1. Comprehensive E2E test suite
2. Load testing (Locust or k6)
3. Security audit (OWASP ZAP)
4. Documentation updates
5. Team training on new patterns

---

## 📞 CONTACT & SUPPORT

**Issues/Questions:** Create GitHub issue with label `validation`
**Urgent Issues:** Slack #engineering-critical

---

**Document Version:** 1.0
**Last Updated:** 2026-02-13
**Next Review:** After all validations complete

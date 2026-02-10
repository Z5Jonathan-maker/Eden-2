# Quality Upgrade Report

This document outlines a senior-level roadmap for leveling up the quality of the Eden 2 codebase.
Recommendations are **additive** and **optional**, designed to increase stability, clarity, and polish without disrupting existing behavior.

---

## 1. Reliability Improvements (Additive)

### 1.1 Redis-Backed Rate Limiting
**Description**: Upgrade the current in-memory `RateLimiter` (in `backend/security.py`) to use Redis.
**Why**: The current in-memory solution resets when the server restarts and doesn't share state across multiple worker processes (e.g., when running with `gunicorn -w 4`). Redis ensures global rate limiting compliance.
**Where**: `backend/security.py`
**Risk**: Low (Fall back to memory if Redis is unavailable)
**Implementation Note**: Use `redis-py` and modify `RateLimiter` to check a Redis key with TTL.

### 1.2 Centralized Frontend Error Reporting
**Description**: Integrate a real error reporting service (e.g., Sentry) into the existing `ErrorBoundary.jsx`.
**Why**: Currently, frontend errors are caught by `ErrorBoundary` but likely only logged to the console. Production errors are invisible to developers.
**Where**: `frontend/src/components/ErrorBoundary.jsx`
**Risk**: Low
**Implementation Note**: Add `Sentry.captureException(error)` inside `componentDidCatch`.

### 1.3 Strict API Response Validation (Zod)
**Description**: Add runtime validation for API responses in the frontend using `zod`.
**Why**: The backend uses Pydantic, but the frontend blindly trusts the API response structure. If the API changes, the frontend might crash with "cannot read property of undefined".
**Where**: `frontend/src/lib/api.js` (Interceptor layer)
**Risk**: Medium (Might expose existing contract violations)
**Implementation Note**: Define Zod schemas for key entities (`Claim`, `User`) and parse responses in the API client.

---

## 2. Performance Improvements (Non-Breaking)

### 2.1 TanStack Query (React Query) Migration
**Description**: Introduce `TanStack Query` for server state management.
**Why**: The current app likely uses `useEffect` + local state for data fetching. This leads to:
- No caching (re-fetching same data on every mount)
- Race conditions
- No background refetching
**Where**: `frontend/src/lib/queryClient.js` (New file)
**Risk**: Low (Can be adopted incrementally, one component at a time)
**Implementation Note**: Wrap `App.jsx` in `QueryClientProvider`. Replace `useEffect` fetches with `useQuery`.

### 2.2 List Virtualization
**Description**: Implement `react-window` or `virtua` for long lists (e.g., `ClaimsList`, `HarvestMap` markers).
**Why**: Rendering hundreds of DOM nodes slows down the browser. Virtualization only renders what is visible.
**Where**: `frontend/src/components/ClaimsList.jsx`
**Risk**: Low
**Implementation Note**: Replace standard `.map()` rendering with `<FixedSizeList>`.

### 2.3 Image Optimization & CDNs
**Description**: Serve images via an optimizing CDN (e.g., Cloudinary, Imgix) or use Next.js-style image optimization.
**Why**: `InspectionPhotos` loads full-resolution images. This kills bandwidth and performance on mobile.
**Where**: `frontend/src/components/InspectionReportPanel.jsx`
**Risk**: Low
**Implementation Note**: Use a resizing proxy URL for thumbnails (e.g., `.../image?width=200`).

---

## 3. Security Improvements (Safe Defaults)

### 3.1 Security Headers (Helmet)
**Description**: Add `secure` headers to FastAPI responses.
**Why**: Missing headers like `X-Content-Type-Options`, `X-Frame-Options`, and `Strict-Transport-Security` leave the app vulnerable to basic attacks.
**Where**: `backend/server.py` (Middleware)
**Risk**: Low
**Implementation Note**: Use `fastapi.middleware.trustedhost.TrustedHostMiddleware` or manually add headers middleware.

### 3.2 Content Security Policy (CSP)
**Description**: Implement a strict CSP to prevent XSS.
**Why**: Prevents malicious scripts from running if an attacker manages to inject HTML.
**Where**: `backend/server.py` (Response Headers)
**Risk**: Medium (Can break external scripts/images if not configured correctly)
**Implementation Note**: Start with `Report-Only` mode to identify required sources (e.g., Google Maps, Stripe).

### 3.3 JWT Rotation & Revocation
**Description**: Implement Refresh Tokens with rotation and a revocation list (Redis).
**Why**: Current JWTs are likely long-lived or valid until expiry. If stolen, they cannot be invalidated.
**Where**: `backend/routes/auth.py`
**Risk**: Medium (Requires frontend auth logic update)
**Implementation Note**: Store `jti` (JWT ID) in Redis on logout/ban. Check `jti` in middleware.

---

## 4. Developer Experience Improvements

### 4.1 TypeScript Migration
**Description**: Incrementally migrate `.js/.jsx` files to TypeScript (`.ts/.tsx`).
**Why**: "Cannot read property 'x' of undefined" is the #1 cause of runtime crashes. TS eliminates this class of bugs.
**Where**: Entire Frontend
**Risk**: Low (Incremental)
**Implementation Note**: Rename `App.js` to `App.tsx`, fix errors, repeat.

### 4.2 Storybook for Component Library
**Description**: Set up Storybook for `frontend/src/components/ui`.
**Why**: The `ui` folder has many reusable components (Button, Input, etc.). Storybook documents them and ensures they work in isolation.
**Where**: `frontend/.storybook`
**Risk**: Low
**Implementation Note**: Auto-generate stories for shadcn/ui components.

### 4.3 Pre-commit Hooks (Husky)
**Description**: Enforce linting and formatting on commit.
**Why**: Prevents "nitpick" code review comments and ensures codebase consistency.
**Where**: Root `.husky/`
**Risk**: Low
**Implementation Note**: Run `lint-staged` to check only changed files.

---

## 5. Product Polish

### 5.1 Skeleton Loading States
**Description**: Replace generic spinning loaders with "Skeleton" placeholders that match the content layout.
**Why**: Reduces perceived loading time and prevents layout shift (CLS).
**Where**: `frontend/src/components/Dashboard.jsx`, `ClaimsList.jsx`
**Risk**: Low
**Implementation Note**: Use `frontend/src/components/ui/skeleton.jsx` to create layout mirrors.

### 5.2 Optimistic UI Updates
**Description**: Update the UI *immediately* when a user performs an action, before the server responds.
**Why**: Makes the app feel instant.
**Where**: `frontend/src/components/RapidCapture.jsx` (Like/Tag photos)
**Risk**: Low (Requires rollback logic on error - easy with React Query)
**Implementation Note**: Update local state immediately, revert if API promise rejects.

### 5.3 Centralized Toast Notifications
**Description**: Standardize all success/error feedback using a toast library (e.g., `sonner` which is already in `ui/`).
**Why**: Currently, some errors might be `console.log` or `alert()`. Toasts are non-intrusive and consistent.
**Where**: `frontend/src/lib/api.js` (Global error interceptor)
**Risk**: Low
**Implementation Note**: Dispatch `toast.error(message)` from the global API error handler.

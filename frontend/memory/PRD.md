# Operation Eden - Product Requirements Document

## Original Problem Statement
Build a full-stack claims handling application named "Operation Eden" for **Care Claims** as a superior, integrated alternative to juggling multiple disconnected tools. The mission is to build a system centered on "stewardship and excellence" for handling insurance claims with a **tactical military video game aesthetic**.

## Core User Personas
- **Field Operators (Adjusters):** Handle claims, inspections, D2D canvassing
- **Commanders (Admins):** Manage teams, configure systems, oversee operations
- **Observers (Clients):** View claim status via portal

## Core Requirements
1. **Consistent Tactical Military Style** across all pages - dark zinc backgrounds, orange accents, 3D icons, glow effects
2. **Full Claims Lifecycle** - intake, inspection, negotiation, settlement, closing
3. **Gamification System** - Battle Pass, competitions, rewards, leaderboards
4. **AI Integration** - Agent Eve chatbot with claims context
5. **D2D Canvassing** - Harvest module with GPS map, territories, daily game loop
6. **MyCard Digital Business Card** - customizable military-themed cards
7. **Mobile Responsiveness** - all features work on mobile

---

## What's Been Implemented (Complete)

### Phase 23 - Deep Audit & Cleanup (Feb 7, 2026) LATEST
- **Error Boundary** added — catches crashes gracefully with "SYSTEM ERROR" UI + reload button
- **Lazy loading** — 40+ heavy components now load on-demand via `React.lazy()` (only core pages eager)
- **Suspense fallback** — tactical spinner shown during chunk loads
- **Console cleanup** — 168 console.log/warn statements commented out across 7 components
- **Unused imports removed** — WeatherVerification, PropertyIntelligence (used via PropertyHub)
- **Audit findings**: 10 unused packages, 3 orphaned components (InspectionPhotos, IntegrityBar, OfflineBanner)
- **Harvest verified** — loads correctly on mobile after cleanup, no crash detected in emulator
- **Global CSS override** catches ALL 724 light-theme Tailwind classes across 38 files — single source of truth
- **4 new 3D icons generated**: Voice Assistant (headset), Incentives (trophy), New Mission (crosshair), Weather (lightning)
- **All backgrounds removed (rembg)** on new icons
- **3D icons added to**: HarvestAdminConsole, VoiceAssistantConsole, IncentivesAdminConsole, NewClaim, Harvest map, CourseDetail, SupplementTracker, NotionIntegration
- **Tactical headers** (`font-tactical`, `text-glow-orange`, `icon-3d-shadow`) applied to all updated pages
- **badges.js NAV_ICONS** expanded with 12 new entries for full page coverage
- **Total icon coverage**: 30+ unique 3D icons, all pages have tactical headers
- **Documents upload** now functional (was dead toast → real file picker + `/api/uploads/file` endpoint)
- **Share Location** button added to ClaimDetails (GPS → Google Maps link → native share/clipboard)
- **Page transitions** via framer-motion AnimatedOutlet (smooth fade+slide between all routes)
- **MyCard Team tab** added with admin view of all squad member cards + analytics
- **MyCard Share Link** API added (`POST /api/mycard/share-link`)
- **Mobile responsive CSS** added: overflow prevention, touch targets (44px min), safe area insets, iOS input zoom fix
- **DataManagement** alerts replaced with proper toasts
- **All buttons verified live** across Dashboard, ClaimDetails, Documents, MyCard
- **Regression tested**: 100% frontend, all features pass across 390px and desktop viewports
- **All 38 icons stored locally** in `/app/frontend/public/icons/` (no remote URLs)
- **Background removal (rembg)** applied to all 38 icons - no more square backgrounds
- **Sidebar navigation** fully updated with 3D icons via `NAV_ICONS` in `badges.js`
- **18 sidebar icons** all loading correctly with transparent backgrounds
- **12 tier/UI badges** also background-removed for clean rendering
- **Light-to-Dark theme conversion** on DataManagement, Documents, UserManagement, SalesEnablement, PropertyHub, WeatherVerification, Scales, FloridaLaws, IndustryExperts
- **Eve icon consistency** — same agent_eve.png used on landing page, Eve AI page, and sidebar
- **Inspection photo upload fixed** — photos upload first, then voice, so matching works
- **Page-enter animations** added to 11+ pages
- **Shadow system**: `shadow-tactical`, `hover-lift`, `hover-lift-sm`, `shadow-glow-*`
- **15+ new CSS animation classes** added to index.css
- **Regression tested**: 15+ pages verified dark theme, 100% backend, 95% frontend

### Phase 19 - MyCard Digital Business Card (Feb 7, 2026)
- Full-stack feature with FastAPI backend and React frontend
- QR code generation, analytics tracking, public shareable view
- Military-themed templates

### Phase 18 - Tactical Military Style Overhaul (Feb 7, 2026)
- All pages converted to dark tactical theme
- Custom CSS classes: card-tactical, btn-tactical, input-tactical, font-tactical

### Phase 17 - Animated Landing Page (Feb 7, 2026)
- Scroll-triggered animations, floating icons, glow effects

### Phase 16 - Premium Icons & Document Upload (Feb 7, 2026)
- AI-generated 3D icons, Agent Eve document upload

### Phase 15 - Operation Eden Rebranding (Feb 7, 2026)
- Complete app-wide tactical UI transformation

### Phase 14 - Battle Pass System (Feb 6, 2026)
- Gamified progression with 8 AI-generated badge artworks

### Phases 1-13 - Core Platform (Dec 2025 - Feb 2026)
- Claims CRUD, inspections, contracts, SMS messaging, gamification engine, harvest canvassing, voice assistant, notifications, AI integration

---

## Architecture
```
/app
├── backend/ (FastAPI + MongoDB)
│   ├── routes/ (claims, contracts, inspections, mycard, messaging, etc.)
│   ├── services/ (AI, SMS, etc.)
│   └── workers/ (bots, schedulers)
├── frontend/ (React + Vite + TailwindCSS)
│   ├── src/
│   │   ├── assets/badges.js (central icon manifest - ALL local paths)
│   │   ├── components/ (50+ components)
│   │   ├── context/ (Auth, Theme)
│   │   └── index.css (1700+ lines tactical CSS)
│   └── public/icons/ (38 locally stored 3D icons)
└── memory/ (PRD, specs, changelogs)
```

---

## Prioritized Backlog

### P1 - Upcoming
- Full functional regression test across all core features
- MyCard: Add more card template options (professional, minimal)
- Card analytics dashboard with charts

### P2 - Future
- Refactor to reusable `<TacticalCard>`, `<TacticalHeader>` components
- Reduce raw CSS class repetition

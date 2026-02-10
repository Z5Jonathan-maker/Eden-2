# Eden Claims Platform - Complete Technical Documentation

> **Version:** 1.0 | **Last Updated:** February 2026 | **Status:** Production-Ready MVP

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Core Features](#core-features)
4. [AI Assistant "Eve"](#eve---ai-assistant)
5. [Florida Statutes Database](#florida-statutes-database)
6. [Industry Experts Knowledge Base](#industry-experts-knowledge-base)
7. [Inspection Photos System](#inspection-photos-system)
8. [Harvest - D2D Sales](#harvest---d2d-sales--canvassing)
9. [Contract Management](#contract-management)
10. [Property Intelligence](#property-intelligence--weather-verification)
11. [Additional Features](#additional-features)
12. [Authentication & Permissions](#authentication--permissions)
13. [Third-Party Integrations](#third-party-integrations)
14. [API Reference](#api-reference)
15. [Data Models](#data-models)
16. [Environment Configuration](#environment-variables)
17. [Known Issues](#current-issues)
18. [File Reference](#key-file-references)

---

## Executive Summary

**Eden** is a comprehensive, full-stack insurance claims handling application designed specifically for public adjusters. It aims to replace multiple disconnected tools (spreadsheets, separate CRMs, photo apps, weather services) with a single integrated platform.

### Mission Statement
> "Stewardship and Excellence" - Building a superior, integrated alternative to juggling multiple disconnected tools for handling insurance claims.

### What Eden Replaces
| Tool Category | Current Tools | Eden Feature |
|--------------|---------------|--------------|
| CRM | ClaimTitan, Salesforce | Garden (Claims CRM) |
| Canvassing | Enzy, Spotio | Harvest |
| Photo Documentation | CompanyCam | Inspection Photos + Rapid Capture |
| Weather Verification | Manual lookup | Property Intelligence |
| AI Assistance | ChatGPT (separate) | Eve (integrated) |
| Contract Signing | DocuSign (separate) | SignNow Integration |
| Knowledge Base | Notion (separate) | Doctrine + University |

---

## Architecture Overview

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18, Tailwind CSS, Shadcn UI | Modern responsive UI |
| **Backend** | FastAPI (Python), Motor (async MongoDB) | REST API server |
| **Database** | MongoDB | Document storage for claims, photos, sessions |
| **AI** | GPT-4o via Emergent LLM Key | AI assistant "Eve" |
| **Voice** | OpenAI Whisper | Voice-to-text transcription |
| **Maps** | Leaflet + ESRI tiles | Free satellite mapping |
| **Authentication** | JWT tokens | Session-based auth with RBAC |

### Directory Structure

```
/app
├── backend/
│   ├── server.py              # FastAPI app entry point (245 lines)
│   ├── routes/                # 30+ API route modules
│   │   ├── ai.py              # Eve AI assistant (~400 lines)
│   │   ├── claims.py          # Claims CRUD
│   │   ├── inspection_photos.py # Photo management (604 lines)
│   │   ├── canvassing_map.py  # Harvest D2D sales
│   │   ├── florida_statutes.py # Legal database scraper (~300 lines)
│   │   ├── knowledge_base.py  # Industry experts
│   │   ├── contracts.py       # Contract management
│   │   ├── harvest_gamification.py # Leaderboard, badges
│   │   ├── oauth.py           # Google, SignNow, Notion OAuth
│   │   ├── weather.py         # Weather verification
│   │   ├── cqil.py            # System health monitoring
│   │   ├── centurion.py       # Automated testing
│   │   └── ... (20+ more)
│   ├── uploads/inspections/   # Photo file storage
│   ├── dependencies.py        # Shared dependencies
│   ├── auth.py                # JWT authentication
│   └── .env                   # Environment variables
│
├── frontend/
│   ├── src/
│   │   ├── App.js             # Route definitions (177 lines)
│   │   ├── components/        # 40+ React components
│   │   │   ├── RapidCapture.jsx      # Voice-annotated capture (1165 lines)
│   │   │   ├── InspectionsEnhanced.jsx # Photo gallery (885 lines)
│   │   │   ├── Harvest.jsx           # D2D map (967 lines)
│   │   │   ├── EveAI.jsx             # AI assistant UI (~500 lines)
│   │   │   ├── FloridaLaws.jsx       # Statute viewer
│   │   │   ├── IndustryExperts.jsx   # Expert profiles
│   │   │   ├── Contracts.jsx         # Contract management
│   │   │   ├── PropertyHub.jsx       # Weather + Property Intel
│   │   │   ├── University.jsx        # Training hub
│   │   │   ├── Adam.jsx              # QA dashboard
│   │   │   └── ... (30+ more)
│   │   ├── lib/api.js         # Centralized API client
│   │   └── context/           # Auth & Theme providers
│   └── .env                   # REACT_APP_BACKEND_URL
│
└── memory/
    └── PRD.md                 # Product requirements document
```

---

## Core Features

### 1. Claims CRM ("Garden")

**Purpose:** Full lifecycle claim tracking replacing tools like ClaimTitan.

**Capabilities:**
- Create, read, update, delete claims
- Client contact management
- Status pipeline tracking (New → In Review → Submitted → Settled)
- Excel bulk import (200+ claims successfully imported)
- Supplement tracking per claim
- Team assignment and collaboration
- Document attachment

**Key Endpoints:**
```
POST   /api/claims/          # Create claim
GET    /api/claims/          # List all claims
GET    /api/claims/{id}      # Get claim details
PATCH  /api/claims/{id}      # Update claim
DELETE /api/claims/{id}      # Delete claim
POST   /api/claims/import    # Bulk Excel import
```

**Claim Data Model:**
```json
{
  "id": "uuid",
  "claim_number": "string",
  "client_name": "string",
  "insured_name": "string",
  "property_address": "string",
  "loss_location": "string",
  "loss_date": "datetime",
  "loss_type": "wind|water|fire|hail",
  "status": "new|in_review|submitted|settled",
  "assigned_to": "user_id",
  "insurance_company": "string",
  "policy_number": "string",
  "adjuster_name": "string",
  "adjuster_email": "string",
  "adjuster_phone": "string",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

---

## Eve - AI Assistant

**Purpose:** GPT-4o powered claims expert integrated with firm knowledge.

### Knowledge Sources

Eve has access to three integrated knowledge bases:

1. **Florida Statutes Database**
   - Verbatim text scraped from leg.state.fl.us
   - 35 statutes currently scraped
   - Quote vs. Explain modes

2. **Industry Experts Database**
   - 9 expert profiles with methodologies
   - Key insights and approaches
   - Book/article references

3. **Notion Knowledge Base**
   - Firm-specific documentation
   - Custom procedures
   - Synced via OAuth

### Special Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Quote** | "verbatim", "exact text", "quote" | Returns exact statute language |
| **Explain** | Default | Summarizes and interprets |
| **Strategy** | "strategy for", "how to handle" | Creates claim-specific plan |

### Quick Actions

- Analyze Policy
- Compare Estimates
- Claim Strategy
- Write Supplement
- Prepare for Adjuster Meeting
- Coverage Questions

### Key Endpoints

```
POST   /api/ai/chat              # Send message, get AI response
GET    /api/ai/sessions          # List conversation sessions
GET    /api/ai/sessions/{id}     # Load conversation history
POST   /api/ai/sessions/new      # Create new session
DELETE /api/ai/sessions/{id}     # Delete session
```

### System Prompt Structure

Eve's system prompt includes:
- Public adjuster expertise and ethics
- Florida statute knowledge (verbatim when requested)
- IICRC restoration standards
- Expert insights from industry leaders
- Claim negotiation strategies
- Carrier communication best practices

---

## Florida Statutes Database

**Purpose:** Authoritative source of truth for Florida public adjusting laws.

### Implementation

- **Scraper:** BeautifulSoup fetches verbatim text from Online Sunshine (leg.state.fl.us)
- **Storage:** MongoDB with exact text preservation
- **Guardrails:** Never fabricates statute language; cites source URLs

### Current Coverage

| Chapter | Section Range | Count | Topic |
|---------|--------------|-------|-------|
| 626 | 626.854 - 626.8796 | 22 | Public Adjuster Licensing |
| 627 | 627.70131 - 627.7015 | 13 | Claims Handling Requirements |

**Total: 35 statutes scraped, 58 target sections**

### Key Statutes

| Section | Title |
|---------|-------|
| 626.854 | Public adjuster; contract; required disclosures |
| 626.865 | Public adjuster apprentice |
| 626.8651 | All-lines adjuster |
| 626.8796 | Public adjuster fees |
| 626.8797 | Fee limitations |
| 627.70131 | Notice of property insurance claim |
| 627.7015 | Alternative dispute resolution |
| 627.70152 | Assignment of benefits |

### Key Endpoints

```
GET  /api/statutes/                    # List all scraped statutes
GET  /api/statutes/section/{section}   # Get specific statute
GET  /api/statutes/quote/{section}     # Get verbatim text only
GET  /api/statutes/search?q=           # Full-text search
POST /api/statutes/scrape              # Trigger full scrape
GET  /api/statutes/status              # Database coverage status
```

### Data Model

```json
{
  "section_number": "626.854",
  "heading": "Public adjuster; contract; required disclosures",
  "body_text": "exact verbatim text from statute - NEVER modified",
  "source_url": "http://www.leg.state.fl.us/statutes/...",
  "chapter": "626",
  "year": 2025,
  "last_verified": "datetime",
  "created_at": "datetime"
}
```

---

## Industry Experts Knowledge Base

**Purpose:** Provide Eve AI with expert insights and methodologies.

### Expert Profiles

| Name | Specialty | Key Contribution |
|------|-----------|------------------|
| **John Senac** | Roofing Claims | C.A.R. approach (Condition, Age, Remaining Life) |
| **Matthew Mulholland** | Public Adjusting | The Prove It Method |
| **Vince Perri** | Florida PA | Claims Game Podcast |
| **Chip Merlin** | Insurance Law | "Master of Disaster", bad faith claims |
| **Bill Wilson** | Policy Language | "When Words Collide" interpretation |
| **Lynette Young** | AI/Technology | ClaimWizard platform |
| **John Voelpel III** | Appraisal | Appraisal process expertise |
| **Simon Sinek** | Leadership | Start With Why philosophy |
| **Jocko Willink** | Leadership | Extreme Ownership |

### Expert Data Structure

```json
{
  "id": "john-senac",
  "name": "John Senac",
  "title": "Roofing & Claims Expert",
  "specialty": "Roofing inspections and claims",
  "bio": "Full biography text...",
  "key_insights": [
    "Always use the C.A.R. approach...",
    "Document every square of the roof..."
  ],
  "books": [
    {"title": "Book Name", "year": 2020}
  ],
  "articles": [
    {"title": "Article Title", "url": "https://..."}
  ],
  "resources": [
    {"name": "Resource", "url": "https://..."}
  ]
}
```

### Key Endpoint

```
GET /api/experts              # List all experts with full profiles
GET /api/experts/search?q=    # Search experts by keyword
```

---

## Inspection Photos System

**Purpose:** Competitor to CompanyCam for inspection documentation.

### Two Capture Modes

#### A. Single Photo Capture
- Traditional camera or file upload
- Room and category tagging
- GPS location capture
- Manual annotation with drawing tools

#### B. Rapid Capture Mode (Drodat-style)

**IMPORTANT: This is the flagship feature for field work.**

**Flow:**
1. **Claim Selection** (REQUIRED - no orphan photos)
2. **Session Creation** - Creates inspection session bound to claim
3. **Camera Activation** - Live video feed with audio recording
4. **Voice Narration** - User speaks while capturing photos
5. **AI Transcription** - Whisper transcribes voice notes
6. **Photo Matching** - AI matches voice segments to photos by timestamp
7. **Review/Edit** - User can edit annotations before upload
8. **Upload** - All photos saved to claim gallery

**Key Rules:**
- ❌ No photo without a claim
- ❌ No orphan photos in global pool
- ✅ All photos bound to inspection session
- ✅ GPS capture attempted for each photo
- ✅ Voice notes optional but encouraged

### Room Presets

| ID | Name | Icon |
|----|------|------|
| exterior_front | Exterior - Front | home |
| exterior_back | Exterior - Back | home |
| roof | Roof | roof |
| living_room | Living Room | sofa |
| kitchen | Kitchen | utensils |
| master_bedroom | Master Bedroom | bed |
| bathroom_master | Master Bathroom | bath |
| garage | Garage | car |
| attic | Attic | archive |
| hvac | HVAC System | wind |
| electrical | Electrical Panel | zap |
| plumbing | Plumbing | droplet |

### Category Presets

| ID | Name | Color |
|----|------|-------|
| overview | Overview | #3B82F6 (blue) |
| damage | Damage | #EF4444 (red) |
| before | Before | #F59E0B (amber) |
| after | After | #10B981 (green) |
| measurement | Measurement | #8B5CF6 (purple) |
| detail | Detail/Close-up | #EC4899 (pink) |

### Key Endpoints

```
# Sessions
POST /api/inspections/sessions                    # Create session
GET  /api/inspections/sessions                    # List sessions
GET  /api/inspections/sessions/{id}               # Get session with photos
PUT  /api/inspections/sessions/{id}/complete      # Mark complete

# Photos
POST   /api/inspections/photos                    # Upload photo
GET    /api/inspections/photos/{id}               # Get metadata
GET    /api/inspections/photos/{id}/image         # Get image file
GET    /api/inspections/photos/{id}/thumbnail     # Get thumbnail
DELETE /api/inspections/photos/{id}               # Delete photo

# Annotations
PUT /api/inspections/photos/{id}/annotations      # Save annotations
GET /api/inspections/photos/{id}/annotations      # Get annotations

# Gallery
GET /api/inspections/claim/{claim_id}/photos      # Get all claim photos
GET /api/inspections/claim/{claim_id}/timeline    # Get timeline view

# Before/After
POST /api/inspections/photos/{id}/pair            # Pair before/after

# Presets
GET /api/inspections/presets/rooms                # Room presets
GET /api/inspections/presets/categories           # Category presets
```

### Photo Data Model

```json
{
  "id": "uuid",
  "claim_id": "claim_uuid",
  "session_id": "session_uuid",
  "filename": "photo_uuid.jpg",
  "original_name": "IMG_1234.jpg",
  
  "latitude": 25.7617,
  "longitude": -80.1918,
  "address": "123 Main St, Miami, FL",
  
  "captured_at": "2026-02-04T10:30:00Z",
  "uploaded_at": "2026-02-04T10:31:00Z",
  
  "room": "roof",
  "category": "damage",
  "tags": ["hail", "shingle"],
  
  "annotations": "[{\"type\":\"arrow\",\"x\":100,\"y\":200}]",
  "ai_caption": "Hail damage visible on asphalt shingles",
  
  "is_before": false,
  "is_after": false,
  "paired_photo_id": null,
  
  "uploaded_by": "adjuster@firm.com",
  "file_size": 2048576,
  "mime_type": "image/jpeg"
}
```

---

## Harvest - D2D Sales & Canvassing

**Purpose:** Free replacement for Enzy/Spotio canvassing tools.

### Map Features

- **Satellite-first view** using ESRI aerial imagery (free tier)
- **Layer toggle:** Satellite / Hybrid / Street
- **Real-time GPS tracking** with pulsing beacon
- **GPS Trail** - Breadcrumb path showing where you've walked
- **Territory polygons** - Define sales territories
- **Tap-to-pin** - Quick property marking

### Door Mode (D2D Optimized)

- Minimal header with live status
- Full-screen satellite map
- One-tap status logging
- Auto-dismiss panel after disposition change
- Points toast shows earned points
- Quick pitch button → Sales guide

### Pin Dispositions

| Status | Code | Color | Points |
|--------|------|-------|--------|
| Not Home | NH | Gray | 1 |
| Not Interested | NI | Red | 3 |
| Callback | CB | Yellow | 5 |
| Appointment | AP | Blue | 10 |
| Signed | SG | Green | 50 |
| Do Not Knock | DNK | Black | 0 |

### Gamification System

**Points Engine:**
| Action | Base Points |
|--------|-------------|
| Door Knocked (Not Home) | 1 pt |
| Contact Made | 3 pts |
| Callback Scheduled | 5 pts |
| Appointment Set | 10 pts |
| Contract Signed | 50 pts |

**Streak Multipliers:**
| Streak | Multiplier |
|--------|------------|
| 3-day | 1.1x |
| 5-day | 1.25x |
| 10-day | 1.5x |
| 30-day | 2.0x |

**Daily Milestones:**
- 50+ doors = 25 pts bonus
- 100+ doors = 50 pts bonus

### Badges (10 Total)

| Badge | Criteria | Rarity | Points |
|-------|----------|--------|--------|
| 🌱 First Fruits | First signed contract | Common | +10 |
| 🚪 100 Club | 100 doors in one day | Uncommon | +50 |
| 🔥 On Fire | 5-day knock streak | Uncommon | +25 |
| 🌾 Abundant | 10 appointments in a week | Rare | +75 |
| 🏆 Top Harvester | #1 weekly ranking | Rare | +100 |
| 💎 Diamond | 50 signed contracts | Epic | +200 |
| 🦅 Early Bird | First knock before 8am | Common | +5 |
| 🌙 Night Owl | Knock after 7pm | Common | +5 |
| 💯 Century | 100 total signed | Epic | +500 |
| ⚔️ Week Warrior | 500 doors in one week | Legendary | +250 |

### Leaderboard

- Period filters: Day, Week, Month, All Time
- Podium display (1st, 2nd, 3rd)
- User rank highlighting
- Streak indicators
- Badge icons on entries

### Key Endpoints

```
# Pins
POST   /api/canvassing-map/pins       # Create pin
GET    /api/canvassing-map/pins       # List pins
PATCH  /api/canvassing-map/pins/{id}  # Update pin/status
DELETE /api/canvassing-map/pins/{id}  # Delete pin

# Territories
POST /api/canvassing-map/territories  # Create territory
GET  /api/canvassing-map/territories  # List territories

# Location
POST /api/canvassing-map/location     # Log GPS position

# Stats
GET /api/canvassing-map/stats/overview # Get stats

# Gamification
GET  /api/harvest/leaderboard         # Rankings
GET  /api/harvest/badges              # Badge definitions
GET  /api/harvest/competitions        # Active competitions
POST /api/harvest/badges/check        # Check for new badges
GET  /api/harvest/stats/team          # Team statistics
```

---

## Contract Management

**Purpose:** Generate and send public adjuster agreements for signature.

### Template: Care Claims PA Agreement

**22 Fillable Fields:**

| Section | Fields |
|---------|--------|
| **Policyholder** | name, email, address, phone |
| **Insurance** | company, policy_number, claim_number, adjuster_name, adjuster_email, adjuster_phone |
| **Loss Location** | address, date, description, claim_type |
| **Fee Agreement** | percentage |

### Features

- Pre-fill from existing claim data
- Status tracking: Draft → Pending → Signed
- SignNow OAuth integration for e-signatures
- PDF download for manual signing fallback
- Contract history and audit trail

### Key Endpoints

```
GET  /api/contracts/templates            # List templates
GET  /api/contracts/templates/{id}       # Get template with fields
POST /api/contracts/                     # Create from template
GET  /api/contracts/                     # List contracts with stats
GET  /api/contracts/{id}                 # Get contract details
POST /api/contracts/{id}/send            # Send for e-signature
GET  /api/contracts/prefill/{claimId}    # Pre-fill from claim
```

---

## Property Intelligence & Weather Verification

### Property Data (via Regrid API)

| Data Point | Source |
|------------|--------|
| Owner Name | Parcel records |
| Owner Address | Mailing address |
| Year Built | Property records |
| Property Value | Assessment |
| Lot Size | Parcel data |
| Parcel Number | APN |

### Weather Verification

**Data Sources:**
- NWS (National Weather Service)
- NOAA
- ASOS/METAR stations

**Features:**
- Address-specific weather data
- Multi-source overlap verification
- Peak wind gust tracking
- Confidence levels
- Citation-ready output

**Confidence Levels:**
| Level | Criteria |
|-------|----------|
| Confirmed | 3+ sources agree |
| High | 2 sources agree |
| Medium | 1 reliable source |
| Low | Interpolated data |

### Key Endpoints

```
# Property
GET /api/regrid/parcel/point?lat=&lng=  # Get parcel by coordinates
GET /api/regrid/stats                    # API usage stats

# Weather
POST /api/weather/verify                 # Verify weather for DOL
GET  /api/weather/history/{claim_id}     # Get verification history
```

---

## Additional Features

### Scales - Estimate Comparison Engine

- Compare Xactimate estimates from PDFs
- Identify scope and pricing differences
- AI-powered variance detection
- Visual highlighting of discrepancies

### University / Doctrine (Knowledge Hub)

- Courses with quizzes
- Articles and documentation
- Video playlists
- Custom firm content
- Certifications tracking
- Industry Experts section
- Florida Laws section

### Vision Board

- Daily Journal (gratitude, beliefs, wins)
- Mood & Energy tracking
- Personal vision board (6 categories)
- Team Feed (share inspiration)
- Milestones tracking
- Vision Anchors (company principles)

### Client Education Hub

- 6 content categories
- 15+ insurance terms glossary
- Q&A system for client questions
- Markdown support
- Accessible at `/client/learn`

### Adam - QA Runner

- CQIL (Continuous Quality & Integrity Layer)
- System health monitoring
- P0/P1/P2 issue tracking
- Release gate system
- Automated test suites

### Centurion - Route Verifier

- API endpoint scanning
- Headless browser UI crawling
- Auto-fix suggestions
- Break report generation

---

## Authentication & Permissions

### JWT Authentication

- Token-based authentication
- Stored in localStorage as `eden_token`
- Refresh mechanism for long sessions

### Role-Based Access Control (4 Tiers)

| Role | Access Level | Features |
|------|--------------|----------|
| **Admin** | Full | User management, settings, all features |
| **Manager** | High | Team oversight, reports, competitions |
| **Adjuster** | Standard | Claims, inspections, canvassing |
| **Client** | Limited | Client portal only |

### Test Credentials

```
Email: test@eden.com
Password: password
Role: Admin
```

---

## Third-Party Integrations

| Service | Purpose | Status | Key Required |
|---------|---------|--------|--------------|
| **OpenAI GPT-4o** | Eve AI | ✅ Active | Emergent LLM Key |
| **OpenAI Whisper** | Voice transcription | ✅ Active | Emergent LLM Key |
| **Notion** | Knowledge base sync | ⚙️ OAuth Ready | User credentials |
| **SignNow** | E-signatures | ⚙️ OAuth Ready | User credentials |
| **Google Workspace** | Gmail, Calendar, Drive | ⚙️ OAuth Ready | User credentials |
| **Stripe** | Payments | ✅ Active | User API key |
| **Regrid** | Parcel data | ✅ Active | REGRID_API_TOKEN |
| **NWS/NOAA** | Weather data | ✅ Active | Public (no key) |
| **ESRI** | Map tiles | ✅ Active | Free tier |

### OAuth Configuration

```env
# Google OAuth (Cloud Console)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# SignNow OAuth (Developer Portal)
SIGNNOW_CLIENT_ID=your-client-id
SIGNNOW_CLIENT_SECRET=your-client-secret

# Notion OAuth (Integrations)
NOTION_CLIENT_ID=your-client-id
NOTION_CLIENT_SECRET=your-client-secret
```

---

## API Reference

### Complete Endpoint List

#### Authentication
```
POST /api/auth/login          # Login
POST /api/auth/register       # Register
GET  /api/auth/me             # Get current user
POST /api/auth/refresh        # Refresh token
```

#### Claims
```
POST   /api/claims/           # Create
GET    /api/claims/           # List
GET    /api/claims/{id}       # Get
PATCH  /api/claims/{id}       # Update
DELETE /api/claims/{id}       # Delete
POST   /api/claims/import     # Bulk import
```

#### Eve AI
```
POST   /api/ai/chat           # Chat
GET    /api/ai/sessions       # List sessions
GET    /api/ai/sessions/{id}  # Get session
POST   /api/ai/sessions/new   # New session
DELETE /api/ai/sessions/{id}  # Delete session
```

#### Inspections
```
POST /api/inspections/sessions
GET  /api/inspections/sessions
GET  /api/inspections/sessions/{id}
PUT  /api/inspections/sessions/{id}/complete

POST   /api/inspections/photos
GET    /api/inspections/photos/{id}
GET    /api/inspections/photos/{id}/image
DELETE /api/inspections/photos/{id}

GET /api/inspections/claim/{claim_id}/photos
GET /api/inspections/claim/{claim_id}/timeline
```

#### Harvest
```
POST   /api/canvassing-map/pins
GET    /api/canvassing-map/pins
PATCH  /api/canvassing-map/pins/{id}
DELETE /api/canvassing-map/pins/{id}

GET /api/harvest/leaderboard
GET /api/harvest/badges
GET /api/harvest/competitions
```

#### Contracts
```
GET  /api/contracts/templates
POST /api/contracts/
GET  /api/contracts/
POST /api/contracts/{id}/send
GET  /api/contracts/prefill/{claimId}
```

#### Statutes
```
GET  /api/statutes/
GET  /api/statutes/section/{section}
GET  /api/statutes/quote/{section}
GET  /api/statutes/search?q=
POST /api/statutes/scrape
GET  /api/statutes/status
```

#### Other
```
GET /api/experts              # Industry experts
GET /api/oauth/status         # OAuth connections
GET /api/cqil/health          # System health
GET /api/centurion/summary    # Route verification
```

---

## Data Models

### User
```json
{
  "id": "uuid",
  "email": "string",
  "full_name": "string",
  "role": "admin|manager|adjuster|client",
  "is_active": true,
  "created_at": "datetime"
}
```

### Claim
```json
{
  "id": "uuid",
  "claim_number": "string",
  "client_name": "string",
  "property_address": "string",
  "loss_date": "datetime",
  "loss_type": "wind|water|fire|hail",
  "status": "string",
  "insurance_company": "string",
  "policy_number": "string",
  "assigned_to": "user_id"
}
```

### Inspection Session
```json
{
  "id": "uuid",
  "claim_id": "claim_uuid",
  "name": "string",
  "status": "in_progress|completed",
  "photo_count": 0,
  "rooms_documented": ["roof", "kitchen"],
  "created_by": "email",
  "created_at": "datetime",
  "completed_at": "datetime"
}
```

### Canvassing Pin
```json
{
  "id": "uuid",
  "latitude": 25.7617,
  "longitude": -80.1918,
  "address": "string",
  "status": "NH|NI|CB|AP|SG|DNK",
  "homeowner_name": "string",
  "phone": "string",
  "notes": "string",
  "created_by": "user_id",
  "created_at": "datetime"
}
```

### Statute
```json
{
  "section_number": "626.854",
  "heading": "string",
  "body_text": "verbatim text",
  "source_url": "url",
  "chapter": "626",
  "year": 2025
}
```

---

## Environment Variables

### Backend (`/app/backend/.env`)

```env
# Required
MONGO_URL=mongodb://localhost:27017
DB_NAME=eden_claims
ENCRYPTION_KEY=your-32-char-encryption-key
BASE_URL=https://your-domain.com

# AI (uses Emergent LLM Key)
# Key is provided automatically

# Optional Integrations
REGRID_API_TOKEN=your-regrid-token

# OAuth (optional - for integrations)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SIGNNOW_CLIENT_ID=
SIGNNOW_CLIENT_SECRET=
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=
```

### Frontend (`/app/frontend/.env`)

```env
REACT_APP_BACKEND_URL=https://your-api-url.com
```

---

## Current Issues

### P0: Camera/Photo Capture Bug (CRITICAL)

**Status:** IN PROGRESS - Needs verification

**Symptoms:**
1. `RapidCapture.jsx`: Camera view shows blank/white on iOS after granting permissions
2. `InspectionsEnhanced.jsx`: Captured photos don't display thumbnails; not saving to storage

**Affected Files:**
- `/app/frontend/src/components/RapidCapture.jsx`
- `/app/frontend/src/components/InspectionsEnhanced.jsx`
- `/app/backend/routes/inspection_photos.py`

**Root Causes Identified:**
1. iOS Safari requires specific video element attributes (`playsInline`, `webkit-playsinline`)
2. Photo URL construction missing API_URL prefix
3. Potential timing issues with video stream initialization

**Attempted Fixes:**
- Added `playsInline` and `webkit-playsinline` attributes
- Added explicit CSS sizing for video element
- Fixed URL construction in `fetchClaimPhotos`

**Next Steps:**
1. Test on actual iOS device
2. Verify camera permissions flow
3. Trace upload → storage → retrieval path
4. Confirm thumbnails display correctly

### P2: Frontend Dev Server Instability

**Symptom:** `Maximum call stack size exceeded` error

**Workaround:** `DISABLE_VISUAL_EDITS=true` flag is active

---

## Key File References

| File | Lines | Purpose |
|------|-------|---------|
| `RapidCapture.jsx` | 1165 | Voice-annotated photo capture |
| `InspectionsEnhanced.jsx` | 885 | Photo gallery and management |
| `inspection_photos.py` | 604 | Backend photo API |
| `Harvest.jsx` | 967 | D2D canvassing map |
| `EveAI.jsx` | ~500 | AI assistant interface |
| `ai.py` | ~400 | Eve backend with knowledge integration |
| `florida_statutes.py` | ~300 | Statute scraper and API |
| `server.py` | 245 | FastAPI app configuration |
| `FloridaLaws.jsx` | ~400 | Statute viewer UI |
| `IndustryExperts.jsx` | ~350 | Expert profiles UI |
| `Contracts.jsx` | ~600 | Contract management UI |
| `PropertyHub.jsx` | ~500 | Weather + Property Intel |

---

## Competitive Parity Status

| Competitor | Feature | Eden Status |
|------------|---------|-------------|
| **Enzy** | Satellite Map | ✅ Achieved |
| **Enzy** | Pin Dispositions | ✅ Achieved |
| **Enzy** | Gamification | ✅ Achieved |
| **Enzy** | Badges | ✅ Achieved |
| **Enzy** | Parcel Intelligence | ✅ Achieved |
| **Enzy** | Weather Overlays | ⚠️ Partial |
| **Enzy** | Digital Business Card | ❌ Not implemented |
| **Drodat** | Historical Weather | ✅ Achieved |
| **Drodat** | AI Camera | ✅ Achieved |
| **Drodat** | Voice Notes | ✅ Achieved |
| **Drodat** | Contract Automation | ✅ Achieved |
| **Drodat** | AI Strategy | ✅ Achieved |
| **Drodat** | Property Permits | ❌ Not implemented |

---

## Future Roadmap

### P1 (High Priority)
- [ ] Fix camera/photo capture bugs
- [ ] Complete Google OAuth flow
- [ ] Migrate remaining components to centralized API client

### P2 (Medium Priority)
- [ ] Carrier Communication Log
- [ ] Deadline/Timeline Engine
- [ ] Supplement Tracker enhancements
- [ ] Weather overlay on Harvest map
- [ ] Full PWA support

### P3 (Lower Priority)
- [ ] Real-time team sync (WebSockets)
- [ ] AI-powered damage captions
- [ ] Offline mode for inspections
- [ ] Territory drawing tool
- [ ] Property permit data integration

---

## Support & Contact

For technical support or questions about this documentation, please contact the development team.

---

*This documentation was generated for Eden Claims Platform v1.0*
*Last updated: February 2026*

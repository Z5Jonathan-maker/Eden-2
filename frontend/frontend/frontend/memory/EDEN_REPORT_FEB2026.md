# Eden Technical & Product Report
## Care Claims Platform Overview
**Generated: February 5, 2026**

---

## 1. Executive Summary

Eden is the integrated claims management platform built for **Care Claims**, a public adjusting company serving residential and commercial property owners throughout Florida. The platform consolidates claims tracking, client communications, field operations (door-to-door canvassing), document management, AI-assisted workflows, and contract execution into a single web application—eliminating the need to juggle multiple disconnected tools.

### What's New Since Last Report
- **SMS Messaging System**: Full Twilio integration with 6 branded templates, chat-style UI in claim details, and webhook handling for inbound/status updates (dry-run mode active, ready for production)
- **Claims Ops Bot**: Automated monitoring for stale claims, high-value alerts, and nightly "Daily Focus List" notifications
- **Communication Assistant Bot**: Smart intent detection on inbound SMS with auto-draft response suggestions
- **Harvest v2 Frontend**: Complete 5-tab mobile UI (Map, Today, Ranks, Challenges, Profile) with gamification
- **E2E Test Suite**: Playwright-based regression testing across mobile and desktop viewports
- **Care Claims Branding**: All SMS templates updated with company identification

---

## 2. Current Architecture Snapshot

### Tech Stack
| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + Tailwind CSS + shadcn/ui |
| **Backend** | FastAPI (Python 3.11) |
| **Database** | MongoDB (Motor async driver) |
| **AI/LLM** | Emergent LLM (GPT-4o via Universal Key) |
| **Speech** | OpenAI Whisper (transcription) |
| **Maps** | ESRI ArcGIS (satellite tiles) + Leaflet |
| **SMS** | Twilio Programmable Messaging (pending production keys) |
| **E-Signatures** | SignNow |
| **Property Data** | Regrid (parcel boundaries, ownership) |
| **Weather** | Visual Crossing (storm verification) |
| **Calendar** | Google Calendar (OAuth) |
| **File Storage** | Local uploads + MongoDB GridFS |

### Data Flow (Text Diagram)
```
┌─────────────┐     HTTPS/JSON      ┌─────────────┐
│   React     │ ◄────────────────► │  FastAPI    │
│  Frontend   │                     │  Backend    │
│ (Port 3000) │                     │ (Port 8001) │
└─────────────┘                     └──────┬──────┘
                                           │
       ┌───────────────────────────────────┼───────────────────────────────────┐
       │                                   │                                   │
       ▼                                   ▼                                   ▼
┌─────────────┐                     ┌─────────────┐                     ┌─────────────┐
│  MongoDB    │                     │  Emergent   │                     │  External   │
│  (claims,   │                     │  LLM API    │                     │  Services   │
│  users,     │                     │  (Eve AI)   │                     │  (Twilio,   │
│  messages,  │                     │             │                     │  SignNow,   │
│  notifs)    │                     │             │                     │  Regrid)    │
└─────────────┘                     └─────────────┘                     └─────────────┘
```

---

## 3. Major Product Areas (Current State)

### Claims CRM ("Garden")
- Full CRUD for residential/commercial property claims
- Status workflow: New → In Progress → Under Review → Pending Documents → Approved → Completed
- Priority levels (Low/Medium/High/Urgent) with color-coded indicators
- Client information (name, email, phone, property address)
- Estimated values and claim numbers (auto-generated TEST-YYYYMMDDHHMMSS format)
- Dashboard with quick stats: Total Claims (229), Active (221), Total Value ($1.80M)

### Eve AI (Florida Statutes & Playbooks)
- Conversational AI assistant powered by Emergent LLM (GPT-4o)
- Florida insurance statutes knowledge (F.S. 627)
- Expert directory: structural engineers, mold specialists, roofers
- Contextual claim guidance and next-step recommendations
- Voice input via OpenAI Whisper transcription

### Inspection Photos + Rapid Capture
- Session-based photo capture for field inspections
- Voice annotation with real-time transcription
- GPS tagging for each photo
- Room/area categorization (Exterior, Roof, Kitchen, etc.)
- Upload to claim document repository
- iOS camera access fix implemented (removed iframe detection)

### Harvest (D2D Canvassing)
- **Map Tab**: Real-time GPS tracking, tap-to-drop pins, ESRI satellite tiles
- **Today Tab**: Daily stats, streak progress (doors needed to maintain), weekly summary
- **Ranks Tab**: Team leaderboard with period filters (Day/Week/Month/All)
- **Challenges Tab**: Daily Blitz competitions with current standings
- **Profile Tab**: Total points, all-time stats, badge gallery (16 badges, unlockable)
- **Scoring Engine**: Points for visits (5), appointments (20), contracts signed (50)
- **Harvest Coach Bot**: Hourly streak nudges, nightly recap notifications

### Contracts (Care Claims PA Agreement + SignNow)
- Digital Public Adjuster agreement generation
- SignNow integration for legally-binding e-signatures
- "Sign on the Spot" flow for field use
- Contract status tracking (Draft, Sent, Signed, Completed)
- PDF download and email delivery

### Property Intelligence
- **Regrid Integration**: Parcel boundaries, lot size, owner information, building footprint
- **Weather Verification**: Visual Crossing API for storm date verification
- **Property Hub**: Consolidated view of parcel data + weather history

### Notifications System
- **Bell UI**: Top-right icon with unread count badge (capped at 9+)
- **Desktop**: Dropdown popover with recent notifications
- **Mobile**: Full-screen modal with notification list
- **Mark as Read**: Single or batch marking
- **Types**: harvest_coach, claims_ops, comms_bot, claim_assigned, claim_created

### Messaging & Communications (SMS)
- **Twilio Integration**: Send/receive SMS per claim (dry-run mode active)
- **Chat UI**: ClaimCommsPanel in claim details with chronological timeline
- **Templates**: 6 branded templates (FNOL, Appointment, Reminder, Photos, Payment, Status)
- **Webhook**: Inbound SMS handling + delivery status updates
- **Auto-triggers**: SMS on claim creation (FNOL template)
- **Rate Limiting**: Max 10 SMS per claim per hour

### Client-Facing Portal
- Status check endpoint: `/status/{claim_id}`
- Client-friendly claim progress view (planned enhancement)

---

## 4. Automation & Bots Overview

### Harvest Coach Bot ✅ LIVE
| Attribute | Details |
|-----------|---------|
| **Triggers** | Hourly (8AM-8PM at :30), Nightly (10PM) |
| **Inputs** | User's daily door count, appointments, signed contracts, streak days |
| **Key Actions** | Streak-at-risk warnings, competition rank nudges, daily highlights |
| **User Sees** | Notification bell + "harvest_coach" type notifications |

### Claims Ops Bot ✅ LIVE
| Attribute | Details |
|-----------|---------|
| **Triggers** | Hourly (at :45), Nightly (9PM) |
| **Inputs** | Claim updated_at timestamps, estimated_value, status, priority |
| **Key Actions** | Stale claim alerts (7+ days), high-value monitoring ($50K+), pending documents warnings |
| **User Sees** | "Daily Focus List" notification with prioritized claims, individual stale/high-value alerts |

### Communication Assistant Bot ✅ LIVE
| Attribute | Details |
|-----------|---------|
| **Triggers** | On inbound SMS, periodic check every 2 hours |
| **Inputs** | Inbound message body, claim context |
| **Key Actions** | Intent detection (confirm/reschedule/status inquiry), auto-draft responses |
| **User Sees** | "Reply suggested" notification with draft message, CTA to messages tab |

### AI Receptionist (Planned)
| Attribute | Details |
|-----------|---------|
| **Triggers** | Inbound phone calls (Twilio Voice) |
| **Inputs** | Voice audio, caller ID |
| **Key Actions** | Transcribe, route to claim, log call summary |
| **User Sees** | Call log in claim timeline, transcription notes |

---

## 5. Third-Party Integrations

| Service | Purpose | Status | Notes |
|---------|---------|--------|-------|
| **Emergent LLM (GPT-4o)** | Eve AI conversations, playbooks | ✅ Live | Universal Key integrated |
| **OpenAI Whisper** | Voice transcription | ✅ Live | Used in Eve AI and Rapid Capture |
| **Twilio SMS** | Client messaging per claim | 🟡 Ready | Dry-run mode; needs production keys |
| **Twilio Voice** | AI Receptionist | 📋 Planned | Future voice call handling |
| **SignNow** | E-signatures for PA agreements | ✅ Live | OAuth integration |
| **Google Calendar** | Appointment sync | ✅ Live | Emergent-managed OAuth |
| **Regrid** | Property parcel data | ✅ Live | API key in env |
| **Visual Crossing** | Weather verification | ✅ Live | Storm date lookup |
| **ESRI ArcGIS** | Satellite map tiles | ✅ Live | Used in Harvest map |
| **Gamma** | Auto-generate presentations | 📋 Planned | API key configured, not wired |

---

## 6. Field Experience Focus

### Current Mobile Usage
Eden is accessed via mobile web browsers (Safari/Chrome) on smartphones and tablets. Field adjusters use the platform for:
- **Harvest canvassing**: GPS tracking, pin drops, visit logging on the Map tab
- **Rapid Capture**: Taking and annotating inspection photos with voice-to-text
- **Sign on the Spot**: Executing PA agreements with SignNow while at client's home
- **SMS communication**: Texting clients directly from the claim Messages tab

### Known Constraints
- **Preview Environment**: Current URL is a staging domain; camera/GPS permissions may behave differently than production
- **iOS WebView Limitations**: Safari has stricter camera access policies; workaround implemented by removing iframe detection
- **No Native App**: Currently web-only; no App Store/Play Store presence limits push notifications and offline capability

### Planned Improvements
- **Custom HTTPS Domain**: Deploy to `app.careclaims.com` for stable, professional URL
- **PWA Enhancement**: Add service worker for offline caching, app-like experience
- **App Store Wrapper**: Consider Capacitor/Cordova wrapper for native app distribution
- **Push Notifications**: WebPush or native notifications for real-time bot alerts

---

## 7. Risk & Gaps Summary

| Risk/Gap | Why It Matters | How We Address It |
|----------|----------------|-------------------|
| **SMS not live** | Clients don't receive automated updates; adjusters must manually call/text | Obtain Twilio production credentials, flip SMS_DRY_RUN=false |
| **No App Store presence** | Can't leverage native push notifications; less discoverable | Evaluate Capacitor wrapper for iOS/Android submission |
| **Client portal limited** | Clients can't self-serve status checks, reducing satisfaction | Build dedicated client portal with claim timeline |
| **Appointment scheduling manual** | No automated calendar integration for inspections | Wire Google Calendar events to auto-SMS appointment templates |
| **Voice calls not logged** | Phone conversations exist outside Eden, creating blind spots | Implement AI Receptionist with Twilio Voice |
| **Document OCR missing** | Uploaded documents aren't searchable or auto-categorized | Add document analysis with Emergent LLM |
| **Offline capability** | Field adjusters in poor coverage areas lose functionality | Implement service worker, local caching, sync queue |
| **Single-tenant demo data** | Test database has 229 claims from seeding; no multi-company support | Future: multi-tenant architecture for multiple PA firms |

---

## 8. Roadmap: Now / Next / Later

### Now (0–3 months)
1. **Activate Twilio SMS in production** — clients receive automated claim updates
2. **Wire appointment scheduling to auto-SMS** — reduce no-shows with confirmation texts
3. **Wire payment events to auto-SMS** — clients notified instantly when checks issued
4. **Complete AI-enhanced message drafting** — Comms Bot uses Emergent LLM for context-aware replies
5. **Deploy to custom domain** — stable URL improves trust and camera reliability
6. **Add scheduled appointment reminders** — 24-hour SMS before inspection
7. **SMS delivery analytics** — dashboard showing sent/delivered/failed rates
8. **Client status portal** — public-facing claim progress page

### Next (3–9 months)
1. **AI Receptionist (Twilio Voice)** — automated call handling, transcription, claim routing
2. **PWA with offline support** — service worker for basic functionality without internet
3. **Document OCR and categorization** — auto-extract data from uploaded photos/PDFs
4. **Supplement tracker** — manage additional claim supplements with timeline
5. **Carrier communication log** — track all insurance company interactions
6. **Deadline engine** — statutory deadlines (90-day rule, etc.) with automatic reminders
7. **Weather overlay on Harvest map** — show storm paths to optimize canvassing areas
8. **Team sync for inspections** — real-time location sharing between adjusters

### Later (9–18 months)
1. **Native iOS/Android apps** — full App Store distribution with push notifications
2. **Multi-tenant architecture** — support multiple PA firms on single platform
3. **iMessage Business Chat** — Apple's RCS alternative for richer client messaging
4. **Automated report generation** — AI-generated claim summaries and estimates
5. **Client self-scheduling** — let homeowners pick inspection times via web link
6. **Integration with carrier portals** — auto-submit claims to insurance company systems
7. **Advanced analytics dashboard** — conversion rates, average cycle time, adjuster performance
8. **Referral tracking** — attribute new claims to source (canvassing, web, referral)
9. **Video inspection capability** — remote video calls with screen recording
10. **White-label option** — rebrandable for other PA firms

---

## If I Were Prioritizing

Based on impact to daily operations and client experience, these are the top 5 initiatives I'd tackle next:

1. **Activate Twilio SMS (production keys)** — Immediate impact: clients stay informed without adjuster effort
2. **Wire appointment scheduling → SMS** — High value: reduces no-shows, saves time rescheduling
3. **Deploy to custom domain (app.careclaims.com)** — Foundation: fixes camera issues, builds brand trust
4. **Build client status portal** — Differentiator: clients can self-serve, reducing "where's my claim?" calls
5. **Add AI-powered message drafting** — Efficiency: adjusters reply faster with suggested responses

---

*Report generated from Eden codebase analysis and implementation documentation.*
*Care Claims, Inc. — Stewardship and Excellence in Claims Handling*

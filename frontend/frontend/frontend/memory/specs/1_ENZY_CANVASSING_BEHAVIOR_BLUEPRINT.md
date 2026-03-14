# ENZY CANVASSING BEHAVIOR BLUEPRINT
## Total Deconstruction of Enzy's Field Experience

---

## 1. APP ARCHITECTURE OVERVIEW

### Primary Modules
| Module | Purpose | Field Relevance |
|--------|---------|-----------------|
| **Canvassing & Lead Management** | Map-based door knocking | CORE |
| **Leaderboards** | Real-time rankings | MOTIVATION |
| **Competitions** | Time-bound challenges | MOTIVATION |
| **Badges** | Achievement recognition | MOTIVATION |
| **Profiles** | Social-style user pages | TEAM |
| **Messaging** | Team communication | COORDINATION |
| **Weather Maps** | Storm overlay (HailTrace) | TARGETING |
| **Digital Business Card** | Contact sharing | CLOSE |

---

## 2. CANVASSING WORKFLOW DECOMPOSITION

### 2.1 App Open → Field Ready
```
SEQUENCE:
1. App launch → Auth check (biometric/PIN)
2. Home dashboard → Active competition banner (if any)
3. Tap "Canvassing" → Full-screen map loads
4. GPS lock acquired → Blue beacon appears
5. Map centers on user location
6. Existing pins render within viewport
7. Weather overlay loads (if enabled)

TAPS TO FIELD-READY: 2
TIME TO FIELD-READY: <3 seconds
```

### 2.2 Turf Selection
```
BEHAVIOR:
- Manager pre-assigns turf polygons to reps
- Rep sees ONLY their assigned area highlighted
- Cannot drop pins outside turf (soft boundary)
- Turf colors indicate:
  - Green: Assigned to you
  - Gray: Unassigned
  - Red: Another rep's territory

TURF MECHANICS:
- Draw polygon tool (manager only)
- Import from spreadsheet/CRM
- Auto-assign by zip code
- Track coverage percentage per turf
```

### 2.3 Door Approach → Pin Drop
```
SEQUENCE:
1. Walk to door
2. Tap anywhere on house location
3. Pin drops immediately (unmarked state)
4. Bottom sheet slides up with:
   - Address (auto-geocoded)
   - Homeowner data (if available)
   - Disposition buttons
   - Notes field
5. Rep knocks door

TAPS TO DROP PIN: 1
NO FORMS. NO DIALOGS. PIN APPEARS INSTANTLY.
```

### 2.4 Disposition Flow (The Core Loop)
```
DISPOSITION TYPES (Confirmed from sources):
┌─────────────────────────────────────────────────┐
│ STATUS         │ COLOR    │ SYMBOL │ ACTION    │
├─────────────────────────────────────────────────┤
│ Not Home       │ Yellow   │ 🏠     │ Revisit   │
│ Not Interested │ Red      │ ✕      │ Skip      │
│ Callback       │ Purple   │ 📞     │ Schedule  │
│ Appointment    │ Blue     │ 📅     │ Calendar  │
│ Signed         │ Green    │ ✓      │ Won       │
│ Do Not Knock   │ Black    │ ⛔     │ Exclude   │
└─────────────────────────────────────────────────┘

ONE-TAP DISPOSITION:
1. Knock door
2. Interaction happens
3. Tap ONE button (e.g., "Not Home")
4. Pin color changes INSTANTLY
5. Bottom sheet auto-dismisses
6. Points awarded (background)
7. Leaderboard updates (real-time)

TAPS TO LOG OUTCOME: 1
NO CONFIRMATION DIALOG.
```

### 2.5 What Happens After Each Tap

| Action | System Response | User Feedback |
|--------|-----------------|---------------|
| Pin Drop | GPS coords captured, address geocoded | Pin appears, haptic buzz |
| Not Home | Status=NH, revisit flag set | Yellow pin, subtle toast |
| Callback | Status=CB, time picker appears | Purple pin, calendar prompt |
| Appointment | Status=AP, push to CRM | Blue pin, confirmation toast |
| Signed | Status=SG, points awarded | Green pin, celebration animation |
| DNK | Status=DNK, excluded from routing | Black pin, removed from queue |

### 2.6 Homeowner Data Access
```
AVAILABLE DATA (when integrated):
- Full name
- Phone number(s)
- Email
- Age range
- Income estimate
- Home value
- Owner vs. renter
- Years at address
- Credit capacity indicator

SOURCE: Property data providers, CRM sync
DISPLAY: Collapsed by default, tap to expand
```

---

## 3. MAP BEHAVIORS

### 3.1 Map Defaults
```
DEFAULT STATE:
- Satellite imagery (ESRI/Google Hybrid)
- User location centered
- 18-19 zoom level (roof-visible)
- Pins visible within viewport
- Weather overlay OFF (toggle)

LAYER OPTIONS:
- Satellite (default)
- Hybrid (satellite + labels)
- Street (OpenStreetMap style)
```

### 3.2 Pin Rendering Rules
```
VISIBILITY:
- Pins render on viewport entry
- Off-screen pins lazy-load
- Max visible: 500 pins (performance)
- Cluster at zoom <16

SELECTION:
- Tap pin → Selected state (pulsing)
- Bottom sheet slides up
- Map pans to center pin
- Previous selection auto-deselects
```

### 3.3 User Location Tracking
```
GPS BEHAVIOR:
- Continuous tracking (high accuracy)
- Blue pulsing beacon
- Heading indicator (optional)
- Breadcrumb trail (configurable)
- Battery-aware (throttle when static)

TRACKING DATA CAPTURED:
- Lat/lng every 5 seconds
- Transmitted to backend every 30 seconds
- Used for:
  - Distance from pins
  - Turf coverage heat map
  - Rep location for managers
```

### 3.4 Weather Map Overlay (HailTrace Integration)
```
OVERLAY OPTIONS:
- Hail paths (size filtered)
- Wind events
- Tornado tracks

FILTER CONTROLS:
- Date range picker
- Hail size minimum (1", 1.5", 2"+)
- Event recency (last 7/30/90 days)

VISUAL:
- Semi-transparent colored polygons
- Darker = more severe
- Tappable for event details
```

---

## 4. GAMIFICATION SYSTEM

### 4.1 Points System (Inferred from behavior)
```
POINT TRIGGERS:
┌─────────────────────────────────────────────────┐
│ ACTION              │ POINTS │ MULTIPLIER      │
├─────────────────────────────────────────────────┤
│ Door knocked        │ 1      │ -               │
│ Contact made        │ 3      │ -               │
│ Callback scheduled  │ 5      │ -               │
│ Appointment set     │ 10     │ Streak bonus    │
│ Contract signed     │ 50     │ Competition 2x  │
│ First knock of day  │ 5      │ Early bird      │
│ 50+ doors in day    │ 25     │ Bonus           │
│ Streak maintained   │ Varies │ Day multiplier  │
└─────────────────────────────────────────────────┘

POINTS ARE AUTOMATIC. REP NEVER ENTERS POINTS.
```

### 4.2 Leaderboard Mechanics
```
UPDATE FREQUENCY: Real-time (sub-second)

VIEWS AVAILABLE:
- Today
- This week
- This month
- All time
- Custom date range

FILTERS:
- By KPI (doors, appointments, signed)
- By hierarchy (individual, team, region)
- By competition

DISPLAY:
- Rank number
- User avatar
- User name
- Score
- Trend arrow (up/down/same)
- Badges earned

INTERACTION:
- Tap user → View profile
- Tap user → Direct message
- Pull to refresh (instant)
```

### 4.3 Badges
```
BADGE CATEGORIES:
- Activity (doors knocked thresholds)
- Performance (conversion milestones)
- Streak (consecutive day activity)
- Special (first of day/week, competition winner)

BADGE DISPLAY:
- Profile page (primary)
- Leaderboard row (compact)
- Celebration modal (on earn)

BADGE EXAMPLES (from research):
- "100 Club" - 100 doors in one day
- "On Fire" - 5-day knock streak
- "Top Harvester" - #1 weekly ranking
- "Diamond" - 50 signed contracts
```

### 4.4 Competitions
```
COMPETITION STRUCTURE:
- Admin-created
- Individual or team-based
- Time-bound (start/end dates)
- KPI-targeted (doors, appointments, revenue)
- Prize-linked (automated fulfillment)

VISIBILITY:
- Active competition banner on dashboard
- Progress bar showing current standing
- Live rankings within competition
- Time remaining countdown

COMPETITION TYPES:
- Blitz (1-3 days, high intensity)
- Marathon (week/month, sustained)
- Head-to-head (1v1 rep battles)
- Team challenge (office vs. office)
```

### 4.5 Streak System
```
STREAK DEFINITION:
- Consecutive days with qualifying activity
- Minimum threshold (e.g., 10 doors/day)
- Resets at midnight local time

STREAK REWARDS:
- Point multiplier (1.1x, 1.25x, 1.5x, 2x)
- Badge unlocks (5-day, 10-day, 30-day)
- Competition tiebreaker

STREAK DISPLAY:
- Profile page counter
- Dashboard widget
- Push notification on risk of break
```

---

## 5. FIELD EXPERIENCE PRINCIPLES

### 5.1 What The Rep NEVER Has To Think About
```
AUTOMATED:
- GPS tracking
- Point calculation
- Leaderboard position
- Badge eligibility
- Streak tracking
- Competition progress
- Data sync
- Address lookup
- Distance calculation
- Pin color assignment
```

### 5.2 Friction Points Eliminated
```
REMOVED:
- Login per session (biometric)
- Manual point entry
- Form filling for pins
- Confirmation dialogs
- Multi-tap workflows
- Typing in field
- Manual sync button
- Save button
```

### 5.3 Design Constants
```
UI RULES:
- One hand operable
- Thumb-zone primary actions
- High contrast for sunlight
- Large tap targets (44px+)
- Minimal text
- Icon-first interface
- Dark mode optional
- Haptic feedback on actions
```

---

## 6. TECHNICAL OBSERVATIONS

### 6.1 Offline Capability
```
OFFLINE SUPPORT:
- Pin drops queue locally
- Dispositions cached
- GPS continues tracking
- Sync on reconnection
- Conflict resolution (last-write-wins)
```

### 6.2 Performance Targets
```
BENCHMARKS:
- App launch to map: <2s
- Pin drop response: <100ms
- Disposition change: <100ms
- Leaderboard refresh: <500ms
- Map pan/zoom: 60fps
- Sync latency: <5s when online
```

### 6.3 Integration Architecture
```
INTEGRATIONS:
- CRM bidirectional sync (Salesforce, JobNimbus, AccuLynx)
- Weather data (HailTrace API)
- Property data providers
- Payment/incentive platforms (Shopify)
- Communication (Twilio SMS)
- Analytics (BigQuery, Snowflake)
```

---

## 7. CRITICAL SUCCESS FACTORS

### What Makes Enzy Work:
1. **One-tap everything** - No multi-step workflows in field
2. **Instant feedback** - Pin changes immediately, no spinners
3. **Automatic gamification** - Points just happen
4. **Real-time visibility** - Leaderboard is always live
5. **Mobile-first design** - Built for sunlight and gloves
6. **Zero typing in field** - All taps, no keyboard
7. **Manager oversight** - Real-time rep location tracking
8. **Weather integration** - Storm data informs targeting

---

## SUMMARY: THE ENZY LOOP

```
┌─────────────────────────────────────────────────────────────┐
│                    THE ENZY FIELD LOOP                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   WALK → TAP → KNOCK → TAP → NEXT                          │
│     │      │      │      │     │                            │
│     │      │      │      │     └─ Map shows next door       │
│     │      │      │      │                                  │
│     │      │      │      └─ One-tap disposition             │
│     │      │      │         (points auto-awarded)           │
│     │      │      │                                         │
│     │      │      └─ Real interaction                       │
│     │      │                                                │
│     │      └─ Pin drops instantly                           │
│     │         (address auto-filled)                         │
│     │                                                       │
│     └─ Physical movement to door                            │
│                                                             │
│   TOTAL TAPS PER DOOR: 2                                    │
│   TOTAL TYPING: 0                                           │
│   TOTAL THINKING: MINIMAL                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

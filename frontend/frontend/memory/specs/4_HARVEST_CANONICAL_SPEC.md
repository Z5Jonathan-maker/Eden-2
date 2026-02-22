# HARVEST CANONICAL SPEC
## Eden Canvassing System - Exact Behaviors & Acceptance Criteria

---

## 1. DESIGN COMMANDMENTS

```
┌─────────────────────────────────────────────────────────────┐
│                    NON-NEGOTIABLE RULES                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. TAP HOUSE → PIN (no forms)                             │
│  2. ONE-TAP DISPOSITION                                     │
│  3. NO CONFIRMATION DIALOGS IN FIELD MODE                  │
│  4. SATELLITE-FIRST MAP DEFAULT                            │
│  5. MINIMAL TEXT                                            │
│  6. MINIMAL TYPING                                          │
│  7. EVERYTHING VISIBLE AT A GLANCE                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. PIN STATES

### 2.1 Required Disposition Types
| Status | Key | Color | Icon | Action |
|--------|-----|-------|------|--------|
| Not Home | NH | `#FBBF24` (Yellow) | 🏠 | Revisit queue |
| Not Interested | NI | `#EF4444` (Red) | ✕ | Skip |
| Callback | CB | `#8B5CF6` (Purple) | 📞 | Schedule return |
| Appointment Set | AP | `#3B82F6` (Blue) | 📅 | Calendar sync |
| Signed | SG | `#10B981` (Green) | ✓ | Won - Celebrate |
| Do Not Knock | DNK | `#1F2937` (Gray-800) | ⛔ | Permanent exclude |

### 2.2 Pin Visual States
```
UNMARKED PIN:
- Color: Gray (#9CA3AF)
- Size: 40px diameter
- Border: 3px white
- Shadow: 0 4px 12px rgba(0,0,0,0.4)

MARKED PIN:
- Color: Disposition color
- Size: 40px diameter
- Border: 3px white
- Shadow: 0 4px 12px rgba(0,0,0,0.4)

SELECTED PIN:
- Color: Disposition color
- Size: 48px diameter
- Border: 4px orange (#F97316)
- Animation: Gentle pulse (1.5s ease-in-out infinite)
- Shadow: 0 4px 20px rgba(249,115,22,0.6)
```

---

## 3. FIELD MODE WORKFLOW

### 3.1 App Launch → Ready to Knock
```
ACCEPTANCE CRITERIA:
□ App opens to last used view (map or dashboard)
□ If returning user, biometric/PIN auth (no full login)
□ Map centers on GPS location within 2 seconds
□ Existing pins render within 3 seconds
□ "Live" indicator appears when GPS locked
□ User beacon (blue pulse) shows position
□ Total taps from launch to knocking: 2 MAX
```

### 3.2 Pin Drop
```
TRIGGER: Tap anywhere on map (not on existing pin)

BEHAVIOR:
1. Pin appears INSTANTLY at tap location (no delay)
2. Haptic feedback (short vibration)
3. Address auto-geocodes in background
4. Bottom sheet slides up with:
   - Address (or "Loading..." then address)
   - 6 disposition buttons (horizontal row)
   - Notes field (collapsed)
   - Contact info (collapsed)
5. Pin state = "unmarked" until disposition selected

ACCEPTANCE CRITERIA:
□ Pin visible within 100ms of tap
□ No form or dialog before pin appears
□ Address appears within 2 seconds
□ Bottom sheet opens automatically
□ Works offline (address queued for geocode)
```

### 3.3 Disposition Change
```
TRIGGER: Tap one of 6 disposition buttons

BEHAVIOR:
1. Pin color changes INSTANTLY
2. Haptic feedback (short vibration)
3. Toast appears briefly (e.g., "Not Home")
4. Points awarded in background
5. Leaderboard updates
6. Bottom sheet auto-dismisses (configurable)
7. Pin selection clears
8. Ready for next door

ACCEPTANCE CRITERIA:
□ Color change within 100ms
□ NO confirmation dialog
□ Toast duration: 1 second max
□ Points visible on next leaderboard check
□ Works offline (queued for sync)
```

### 3.4 Bottom Sheet Structure
```
┌─────────────────────────────────────────────────────────────┐
│ ═══════════════════════════════════════════════════════════ │  ← Drag handle
│                                                             │
│  123 Main Street, Austin, TX 78701                         │  ← Address (tap to copy)
│  [Not Home] badge                    0.2 mi away           │  ← Status + Distance
│                                                             │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                │  ← Disposition buttons
│  │ NH │ │ NI │ │ CB │ │ AP │ │ SG │ │DNK │                │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                │
│                                                             │
│  ▼ Contact Info                                            │  ← Collapsible section
│  ▼ Notes                                                   │  ← Collapsible section
│  ▼ Knock History                                           │  ← Collapsible section
│                                                             │
│  [Save Contact]              [Start Pitch]                 │  ← Action buttons
│                                                             │
└─────────────────────────────────────────────────────────────┘

ACCEPTANCE CRITERIA:
□ Address is tappable (copies to clipboard)
□ Distance updates as rep moves
□ Disposition buttons are 44px minimum tap target
□ Only one section expanded at a time
□ Sheet dismissible by swipe down or tap outside
```

---

## 4. MAP BEHAVIORS

### 4.1 Default State
```
ACCEPTANCE CRITERIA:
□ Satellite imagery as default layer
□ Zoom level 17-18 (roof-visible)
□ Map centered on user GPS location
□ User beacon visible and pulsing
□ Pins visible within viewport
□ Layer toggle accessible (Satellite/Hybrid/Street)
```

### 4.2 Layer Options
```
SATELLITE:
- Provider: ESRI World Imagery
- URL: https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}

HYBRID:
- Provider: Google Hybrid
- URL: https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}

STREET:
- Provider: OpenStreetMap
- URL: https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

### 4.3 User Location
```
ACCEPTANCE CRITERIA:
□ Blue pulsing beacon at user location
□ Beacon updates every 5 seconds (active mode)
□ GPS trail (breadcrumb) visible as polyline
□ "Locate me" button re-centers map
□ Distance to pins calculated from user position
```

### 4.4 Pin Clustering
```
ACCEPTANCE CRITERIA:
□ Cluster pins when zoom < 16
□ Cluster shows count number
□ Tap cluster zooms to expand
□ Cluster color = majority disposition color
```

---

## 5. GAMIFICATION

### 5.1 Points System
```
ACTION                  BASE POINTS    NOTES
────────────────────────────────────────────
Door knocked            1              Any disposition change from unmarked
Contact made            3              Not Home → other status
Callback scheduled      5              Status = Callback
Appointment set         10             Status = Appointment
Contract signed         50             Status = Signed
First knock of day      5              Bonus for first activity
50+ doors in day        25             Daily milestone bonus
100+ doors in day       50             Daily milestone bonus

ACCEPTANCE CRITERIA:
□ Points awarded AUTOMATICALLY on action
□ Rep NEVER manually enters points
□ Points visible in leaderboard within 5 seconds
□ Points work offline (sync on reconnection)
```

### 5.2 Streak System
```
DEFINITION:
- Consecutive calendar days with 10+ doors knocked
- Resets at midnight local time
- 1 grace miss allowed per 30 days (configurable)

MULTIPLIERS:
- 3-day streak: 1.1x
- 5-day streak: 1.25x
- 10-day streak: 1.5x
- 30-day streak: 2.0x

ACCEPTANCE CRITERIA:
□ Streak counter visible on profile
□ Streak risk notification at 8pm if under threshold
□ Streak badge earned at 5, 10, 30 days
□ Multiplier applied automatically
```

### 5.3 Leaderboard
```
VIEWS:
- Today (default)
- This Week
- This Month
- All Time
- Active Competition

DISPLAY PER ENTRY:
- Rank (#1, #2, #3 with medals, then numbers)
- Avatar
- Name
- Primary score (points or KPI)
- Trend indicator (▲ ▼ ─)
- Badge icons (most recent 3)

ACCEPTANCE CRITERIA:
□ Updates in real-time (sub-5-second)
□ Pull-to-refresh available
□ Tap entry → view profile
□ My position always visible (sticky if off-screen)
□ Top 3 get special styling (gold, silver, bronze)
```

### 5.4 Badges
```
REQUIRED BADGES:
┌─────────────────────────────────────────────────────────────┐
│ BADGE           │ CRITERIA                │ RARITY         │
├─────────────────────────────────────────────────────────────┤
│ 🌱 First Fruits │ First signed contract   │ Common         │
│ 🚪 100 Club     │ 100 doors in one day    │ Uncommon       │
│ 🔥 On Fire      │ 5-day knock streak      │ Uncommon       │
│ 🌾 Abundant     │ 10 appointments/week    │ Rare           │
│ 🏆 Top Harvester│ #1 weekly ranking       │ Rare           │
│ 💎 Diamond      │ 50 signed contracts     │ Epic           │
│ 🦅 Early Bird   │ First knock before 8am  │ Common         │
│ 🌙 Night Owl    │ Knock after 7pm         │ Common         │
│ 💯 Century      │ 100 total signed        │ Epic           │
│ ⚔️ Week Warrior │ 500 doors in one week   │ Legendary      │
└─────────────────────────────────────────────────────────────┘

ACCEPTANCE CRITERIA:
□ Badge earned → celebration animation
□ Badge earned → push notification
□ Badges display on profile
□ Badges display on leaderboard entry
□ Badge criteria evaluated automatically
```

### 5.5 Competitions
```
COMPETITION STRUCTURE:
- Name and description
- Start/end dates
- KPI target (doors, appointments, signed)
- Points multiplier (1.5x, 2x)
- Participant list (individuals or teams)
- Prize descriptions

DISPLAY:
- Banner on dashboard when active
- Progress bar showing current standing
- Time remaining countdown
- Live rankings

ACCEPTANCE CRITERIA:
□ Competition banner visible on app launch
□ Progress updates in real-time
□ Multiplier applies to all relevant actions
□ Final rankings calculated at end time
□ Winner notification sent
```

---

## 6. TABS & NAVIGATION

### 6.1 Tab Structure
```
┌────────────────────────────────────────────────────────────┐
│  [Map]   [Ranks]   [Compete]   [Badges]                   │
└────────────────────────────────────────────────────────────┘

MAP:
- Full-screen satellite map
- Pin overlay
- Bottom stats bar

RANKS:
- Leaderboard view
- Period selector
- KPI filter

COMPETE:
- Active competitions
- Progress tracking
- Prize display

BADGES:
- Badge grid (earned vs. locked)
- Earn criteria
- Progress toward locked badges
```

### 6.2 Tab Switching
```
ACCEPTANCE CRITERIA:
□ Tab change < 100ms
□ State preserved when returning to Map
□ Selected tab highlighted in orange
□ Swipe gesture between tabs (optional)
```

---

## 7. HEADER & CONTROLS

### 7.1 Header Bar
```
┌────────────────────────────────────────────────────────────┐
│  [🌾]  Harvest          4 doors | 0 signed        [Live]  │
└────────────────────────────────────────────────────────────┘

ELEMENTS:
- Icon: Orange gradient harvest icon
- Title: "Harvest"
- Stats: Today's doors + signed count
- Live indicator: Green dot when GPS active
```

### 7.2 Map Controls (Right Side)
```
┌─────┐
│  +  │  Add Pin mode toggle
├─────┤
│  ⌖  │  Center on user location
├─────┤
│  ◫  │  Toggle territories
├─────┤
│  ↻  │  Refresh data
└─────┘

ACCEPTANCE CRITERIA:
□ Controls always visible
□ 44px minimum tap targets
□ Active state = orange fill
□ Controls don't overlap pins
```

### 7.3 Layer Toggle (Top Left)
```
┌─────────────────────────────────┐
│  [Satellite] [Hybrid] [Street] │
└─────────────────────────────────┘

ACCEPTANCE CRITERIA:
□ Active layer highlighted
□ Layer change < 500ms
□ Zoom level preserved on change
```

---

## 8. BOTTOM STATS BAR

### 8.1 When No Pin Selected
```
┌────────────────────────────────────────────────────────────┐
│  [NH:2]  [NI:0]  [CB:0]  [AP:0]  [SG:0]  [DNK:0]         │
└────────────────────────────────────────────────────────────┘

ELEMENTS:
- Circular icons with disposition colors
- Count below each icon
- Abbreviation below count
- Tap icon → filter map to that status

ACCEPTANCE CRITERIA:
□ Counts update in real-time
□ Visual matches disposition color
□ Filter mode indicated by highlight
```

---

## 9. PERFORMANCE BENCHMARKS

### 9.1 Required Performance
```
METRIC                          TARGET          FAIL THRESHOLD
────────────────────────────────────────────────────────────────
App launch to map visible       < 2s            > 3s
Pin drop response               < 100ms         > 200ms
Disposition change              < 100ms         > 200ms
Bottom sheet open               < 150ms         > 300ms
Leaderboard refresh             < 500ms         > 1s
Map pan/zoom FPS                60fps           < 30fps
Tab switch                      < 100ms         > 200ms
Sync completion                 < 5s            > 10s
```

### 9.2 Offline Requirements
```
MUST WORK OFFLINE:
□ Pin drop
□ Disposition change
□ Notes entry
□ GPS tracking
□ View existing pins
□ View cached leaderboard

REQUIRES ONLINE:
□ Leaderboard updates
□ Competition sync
□ Address geocoding
□ New badge notifications
```

---

## 10. EDEN-SPECIFIC ENHANCEMENTS

### 10.1 Claim Integration (Eden Advantage)
```
WHEN PIN STATUS = SIGNED:
1. Option to "Create Claim" appears
2. One tap → new claim in Garden (CRM)
3. Address auto-populated
4. Homeowner info auto-populated
5. Photos linked from inspection

ACCEPTANCE CRITERIA:
□ "Create Claim" only appears for signed pins
□ Claim created with single tap
□ All pin data transfers to claim
□ Link back to pin from claim
```

### 10.2 Weather Overlay (Drodat Parity)
```
WHEN WEATHER ENABLED:
1. Semi-transparent storm overlay on map
2. Filter by date range
3. Filter by event type (hail, wind)
4. Filter by hail size
5. Pins show if in storm path

ACCEPTANCE CRITERIA:
□ Weather data from NWS/NOAA API
□ Storm paths render as polygons
□ Pins indicate storm-affected status
□ Performance not degraded (< 10% slower)
```

### 10.3 Rapid Capture Integration
```
FROM PIN BOTTOM SHEET:
1. "Take Photo" button
2. Opens Rapid Capture camera
3. Photos auto-linked to pin
4. Voice notes transcribed
5. GPS embedded in photos

ACCEPTANCE CRITERIA:
□ Camera opens from bottom sheet
□ Photos appear in pin history
□ Photos transfer to claim when created
```

---

## 11. ACCEPTANCE TEST SCENARIOS

### Scenario 1: Cold Start
```
GIVEN: Rep opens app for first time today
WHEN: App launches
THEN:
  - Login via biometric (< 1s)
  - Map loads centered on GPS (< 2s)
  - "Live" indicator appears
  - Previous pins visible
  - Ready to knock in < 3s total
```

### Scenario 2: One-Tap Pin Drop
```
GIVEN: Rep is on map view
WHEN: Rep taps on empty map location
THEN:
  - Pin appears instantly (< 100ms)
  - Haptic feedback
  - Bottom sheet opens
  - Address geocodes (< 2s)
  - No forms, no dialogs
```

### Scenario 3: One-Tap Disposition
```
GIVEN: Pin is selected, bottom sheet open
WHEN: Rep taps "Not Home" button
THEN:
  - Pin turns yellow instantly (< 100ms)
  - Toast "Not Home" appears briefly
  - 1 point awarded
  - Bottom sheet dismisses
  - Pin deselected
  - Ready for next door
```

### Scenario 4: Leaderboard Update
```
GIVEN: Rep has just knocked a door
WHEN: Rep checks leaderboard
THEN:
  - New points reflected (< 5s)
  - Rank updated if changed
  - Trend indicator correct
  - Rep's row highlighted
```

### Scenario 5: Offline → Online Sync
```
GIVEN: Rep was offline for 30 minutes
WHEN: Network reconnects
THEN:
  - Queued actions sync (< 10s)
  - Pins update with server state
  - Leaderboard refreshes
  - No data loss
  - No duplicate pins
```

---

## 12. SUCCESS METRICS

### Field Adoption
- Time to first pin drop: < 10 seconds from app open
- Pins per hour: Target 20+ (skilled rep)
- Disposition completion rate: > 95%
- App crashes per 100 sessions: < 1

### Gamification Engagement
- Leaderboard checks per day: > 5
- Competition participation: > 80%
- Badge earn rate: 1+ per week per rep
- Streak maintenance: > 60% of reps

### Business Impact
- Doors to appointment conversion: Track
- Appointment to signed conversion: Track
- Revenue per door knocked: Track
- Territory coverage efficiency: Track

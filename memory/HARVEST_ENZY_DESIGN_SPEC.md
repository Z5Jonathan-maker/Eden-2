# Eden Harvest - Enzy-Level Design Specification
## Premium Light Theme Design System

*Version: 1.0 | Date: December 2025*

---

## 1. PRODUCT VISION

**Eden Harvest** is the high-performance engine for modern sales teams. It sheds the clunky, utilitarian skin of traditional CRMs to embrace a **"Premium Gamified"** aesthetic inspired by top-tier consumer apps like Enzy and Strava.

The design language is **"Athletic Luxury"**: crisp white surfaces, vibrant data visualizations, and tactile gamification elements that make every door knock feel like a point scored in a high-stakes game.

**Core Promise:** *"Every rep wakes up knowing exactly what they're playing for, how close they are to winning, and who they're competing against."*

---

## 2. DESIGN SYSTEM TOKENS

### 2.1 Typography

| Token | Font | Weight | Size | Tailwind |
|-------|------|--------|------|----------|
| **display** | Plus Jakarta Sans | 800 | 36-48px | `text-4xl md:text-5xl font-extrabold tracking-tight` |
| **h1** | Plus Jakarta Sans | 700 | 30px | `text-3xl font-bold tracking-tight` |
| **h2** | Plus Jakarta Sans | 700 | 24px | `text-2xl font-bold tracking-tight` |
| **h3** | Plus Jakarta Sans | 600 | 20px | `text-xl font-semibold tracking-tight` |
| **body-lg** | Inter | 500 | 18px | `text-lg font-medium leading-relaxed` |
| **body** | Inter | 400 | 16px | `text-base font-normal leading-relaxed` |
| **caption** | Inter | 500 | 14px | `text-sm font-medium text-muted-foreground uppercase tracking-wider` |

**Font Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');
```

### 2.2 Colors

#### Primary Brand
| Token | Hex | Usage |
|-------|-----|-------|
| `accent-primary` | `#EA580C` | Primary CTAs, active states, progress |
| `accent-primary-hover` | `#C2410C` | Hover states for primary |
| `accent-primary-light` | `#FFEDD5` | Light backgrounds, badges |
| `accent-soft` | `rgba(234, 88, 12, 0.1)` | Subtle highlights |

#### Harvest Sub-brand
| Token | Hex | Usage |
|-------|-----|-------|
| `harvest-green` | `#059669` | Harvest-specific accent |
| `harvest-light` | `#D1FAE5` | Light green backgrounds |
| `harvest-dark` | `#064E3B` | Dark green text |

#### Gamification Metals
| Token | Hex | Usage |
|-------|-----|-------|
| `gold` | `#F59E0B` | 1st place, premium rewards |
| `silver` | `#94A3B8` | 2nd place |
| `bronze` | `#B45309` | 3rd place |
| `indigo` | `#6366F1` | Epic tier, special events |
| `purple` | `#8B5CF6` | Legendary, milestones |

#### Surfaces
| Token | Hex | Usage |
|-------|-----|-------|
| `bg-app` | `#FFFFFF` | Main background |
| `bg-surface` | `#F8FAFC` | Card backgrounds, sections |
| `bg-surface-elevated` | `#F1F5F9` | Elevated panels, modals |
| `bg-glass` | `rgba(255, 255, 255, 0.8)` | Floating glass panels |

#### Text
| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` | `#0F172A` | Headlines, primary text |
| `text-secondary` | `#475569` | Body text, descriptions |
| `text-muted` | `#94A3B8` | Captions, hints |

#### Status
| Token | Hex | Usage |
|-------|-----|-------|
| `success` | `#10B981` | Completed, qualified |
| `warning` | `#F59E0B` | At risk, attention |
| `error` | `#EF4444` | Failed, overdue |
| `info` | `#3B82F6` | Informational |

### 2.3 Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Inline spacing |
| `space-2` | 8px | Tight gaps |
| `space-3` | 12px | Component internal |
| `space-4` | 16px | Standard gap |
| `space-5` | 20px | Section internal |
| `space-6` | 24px | Card padding |
| `space-8` | 32px | Section gaps |
| `space-10` | 40px | Page sections |

### 2.4 Corner Radii

| Token | Value | Usage |
|-------|-------|-------|
| `radius-small` | 8px | Badges, chips |
| `radius-medium` | 12px | Inputs, buttons |
| `radius-card` | 16px | Cards |
| `radius-large` | 20px | Large cards, sheets |
| `radius-pill` | 9999px | Pills, full-round |

### 2.5 Shadows & Elevation

| Token | CSS | Usage |
|-------|-----|-------|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle elevation |
| `shadow-card` | `0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)` | Cards |
| `shadow-float` | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)` | Floating panels |
| `shadow-glow` | `0 0 15px rgba(234, 88, 12, 0.3)` | Active/focused glow |

---

## 3. LAYOUT STRUCTURE

### 3.1 Desktop Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ Eden Top Bar (existing)                                         │
├──────────┬──────────────────────────────────────────────────────┤
│          │  ┌───────────────────────────────────────────────┐   │
│  Eden    │  │ HARVEST HEADER                                │   │
│  Sidebar │  │ Title + Key KPIs Strip                        │   │
│          │  ├───────────────────────────────────────────────┤   │
│          │  │ [Map] [Today] [Leaderboard] [Challenges] [Profile]│
│          │  ├───────────────────────────────────────────────┤   │
│          │  │                                               │   │
│          │  │     TAB CONTENT AREA                          │   │
│          │  │     (max-w-7xl mx-auto)                       │   │
│          │  │                                               │   │
│          │  └───────────────────────────────────────────────┘   │
└──────────┴──────────────────────────────────────────────────────┘
```

### 3.2 Mobile Layout
```
┌─────────────────────────────┐
│     TAB CONTENT AREA        │
│                             │
│                             │
│                             │
│                             │
│                             │
│                             │
│     (full screen)           │
│                             │
│                             │
├─────────────────────────────┤
│ [🗺️] [📅] [🏆] [🎯] [👤]    │
│  Map  Today Ranks Chall Prof │
└─────────────────────────────┘
```

---

## 4. COMPONENT SPECIFICATIONS

### 4.1 Card Base
```
┌─────────────────────────────────────┐
│                                     │  ← rounded-2xl (16px)
│     Card Content                    │  ← padding: 20px (p-5)
│                                     │  ← bg-white
│                                     │  ← border: 1px solid #E2E8F0
│                                     │  ← shadow-card
└─────────────────────────────────────┘

Hover: shadow-md, border-orange-200, ring-2 ring-orange-500/10
```

**Tailwind:**
```jsx
className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5 
           transition-all hover:shadow-md hover:border-orange-200"
```

### 4.2 Primary Button
```
┌──────────────────────────┐
│      BUTTON TEXT         │  ← rounded-full (pill)
└──────────────────────────┘  ← bg-primary (#EA580C)
                              ← text-white, font-semibold
                              ← px-6 py-3
                              ← shadow-lg shadow-orange-500/20
                              
Active: scale-95
Hover: bg-primary-hover (#C2410C)
```

**Tailwind:**
```jsx
className="bg-orange-600 text-white font-semibold px-6 py-3 rounded-full 
           shadow-lg shadow-orange-500/20 hover:bg-orange-700 
           transition-transform active:scale-95"
```

### 4.3 Stat Card
```
┌─────────────────────────────┐
│  📊                         │  ← Icon (24px)
│  Doors Knocked              │  ← Caption (text-sm uppercase)
│  67                         │  ← Value (text-4xl font-bold)
│  +12 today                  │  ← Delta (text-sm, success color)
└─────────────────────────────┘
```

### 4.4 Progress Ring
```
      ┌───────────┐
     ╱    67%     ╲
    │    45/67    │         ← Circular SVG
     ╲   DOORS    ╱         ← Gradient stroke (primary)
      └───────────┘         ← Center: value + label
```

### 4.5 Badge Tile
```
┌─────────────────────────────┐
│  ┌─────────────────────┐   │
│  │                     │   │  ← Badge artwork (64x64)
│  │    🏆 ARTWORK       │   │
│  │                     │   │
│  └─────────────────────┘   │
│  Century Club               │  ← Title (font-semibold)
│  100 doors in a week        │  ← Subtitle (text-muted)
│  ✅ UNLOCKED                │  ← Status badge
└─────────────────────────────┘

Locked state: grayscale, opacity-50
```

### 4.6 Challenge Card
```
┌─────────────────────────────────────┐
│  [  GRADIENT ARTWORK BANNER   ] 🏆  │  ← Height: 120px
├─────────────────────────────────────┤
│  ⚡ Weekend Blitz                    │  ← Icon + Title
│  Hit 75 doors for $50 bonus         │  ← Tagline
│                                     │
│  ████████████████░░░░ 67%           │  ← Progress bar
│  67/100 doors                       │
│                                     │
│  ⏱️ 2d 4h remaining    [View →]     │  ← Time + CTA
└─────────────────────────────────────┘
```

### 4.7 Leaderboard Row
```
┌─────────────────────────────────────────────────────┐
│  #4  [👤]  Sarah Mitchell   Denver    876  📈 +3   │
│  ↑   Avatar  Name           Team      Score  Trend  │
└─────────────────────────────────────────────────────┘

Top 3: Special treatment (larger, medals)
Your Row: Highlighted background (bg-orange-50)
```

### 4.8 Podium
```
              🥇
             ████
        🥈  ████████  🥉
       ████ ████████ ████
      ██████████████████████

      2nd    1st      3rd
```

---

## 5. TAB SPECIFICATIONS

### 5.1 Map Tab

**Purpose:** Turf view with pins and knocking workflow

**Desktop Layout:**
- Full main panel map
- Top: Floating glass search bar + filter chips
- Right sidebar (optional): Selected property details
- Bottom: Active route bar (if route in progress)

**Mobile Layout:**
- Full screen map
- Top: Floating search + filters
- Bottom sheet: Property details (draggable)
- FAB: "Start Route" when no route active

**Pin Colors:**
| Status | Color | Shape |
|--------|-------|-------|
| New/Not Knocked | Gray #94A3B8 | Circle |
| Contact Made | Blue #3B82F6 | Circle |
| Appointment Set | Orange #EA580C | Star |
| Signed/Customer | Green #10B981 | Checkmark |
| Do Not Knock | Red #EF4444 | X |
| Follow-up | Yellow #F59E0B | Clock |

**Property Details Panel:**
```
┌─────────────────────────────────────┐
│ 🏠 123 Main Street                  │
│ Denver, CO 80202                    │
│                                     │
│ Homeowner: John Smith               │
│ Last Visit: Jan 15, 2026            │
│ Status: Follow-up                   │
│                                     │
│ [📞 Call] [💬 Text] [📝 Note]       │
│                                     │
│ [     KNOCK THIS DOOR     ]         │  ← Primary CTA
└─────────────────────────────────────┘
```

### 5.2 Today Tab

**Purpose:** Daily command center with goals and schedule

**Hero Section:**
```
┌─────────────────────────────────────────────────────┐
│ Good morning, Sarah! ☀️                Feb 6, 2026  │
│                                                     │
│ 🔥 12 Day Streak                             1.25x  │
├─────────────────────────────────────────────────────┤
│                                                     │
│              ┌─────────────────┐                    │
│              │       67        │                    │
│              │      ─────      │  ← Progress Ring   │
│              │       75        │                    │
│              │     DOORS       │                    │
│              └─────────────────┘                    │
│                                                     │
│       🎯 8 more to hit your goal!                   │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [  67  ]  [  4   ]  [  1   ]  [ 320  ]             │
│   Doors    Appts    Signs    Points                 │
└─────────────────────────────────────────────────────┘
```

**Active Competition Card:**
```
┌─────────────────────────────────────────────────────┐
│ ⚡ ACTIVE COMPETITION                    1d 6h      │
├─────────────────────────────────────────────────────┤
│ Weekend Blitz                                       │
│ Your Rank: #4 (↑2)                                  │
│ 67/75 doors · Prize: $50 GC                         │
│ ████████████████████░░░  89%                        │
│                            [View Leaderboard →]     │
└─────────────────────────────────────────────────────┘
```

**Schedule Section:**
```
┌─────────────────────────────────────────────────────┐
│ 📅 TODAY'S SCHEDULE                                 │
├─────────────────────────────────────────────────────┤
│ ○─── 9:00 AM   Start knocking - Oak Park           │
│ │                                                   │
│ ●─── 11:30 AM  Appointment - 456 Pine St           │
│ │              John Smith · Estimate review         │
│ │                                                   │
│ ○─── 2:00 PM   Team standup                        │
└─────────────────────────────────────────────────────┘
```

### 5.3 Leaderboard Tab

**Purpose:** Rankings and competitive fuel

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ 🏆 LEADERBOARD                                      │
│                                                     │
│ ⚡ Weekend Blitz                           1d 6h    │
├─────────────────────────────────────────────────────┤
│                                                     │
│         🥇               🥈           🥉           │
│        Sarah            Mike         Jake          │
│         89               82           78           │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [Day] [Week] [Month] [Season]    [Doors ▼]         │
├─────────────────────────────────────────────────────┤
│ 1  🥇  Sarah M.    Denver     89  +$100            │
│ 2  🥈  Mike T.     Boulder    82  +$50             │
│ 3  🥉  Jake R.     Aurora     78  +$25             │
│ 4      Lisa K.     Denver     76  ✓ $50            │
│────────────────────────────────────────────────────│
│ 5  ★   YOU ★       Denver     67  8→               │  ← Highlighted
│────────────────────────────────────────────────────│
│ 6      Amy P.      Denver     65                   │
│ 7      Tom W.      Boulder    61                   │
└─────────────────────────────────────────────────────┘
```

### 5.4 Challenges Tab

**Purpose:** Visual frontend for Incentives Engine

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ 🎯 CHALLENGES                                       │
│ 3 active · 12 completed                            │
├─────────────────────────────────────────────────────┤
│ [Active] [Upcoming] [Completed]                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌─────────────────────┐ ┌─────────────────────┐    │
│ │ ⚡ Weekend Blitz    │ │ 🌟 Weekly Ladder    │    │
│ │ [BANNER ART]        │ │ [BANNER ART]        │    │
│ │                     │ │                     │    │
│ │ 75 doors = $50      │ │ Top 10 win prizes   │    │
│ │ ████████░░ 67%      │ │ ███░░░░░░░ 28%      │    │
│ │ 1d 6h left          │ │ 4d 12h left         │    │
│ └─────────────────────┘ └─────────────────────┘    │
│                                                     │
│ ┌─────────────────────┐ ┌─────────────────────┐    │
│ │ ✅ COMPLETED        │ │ 🔒 LOCKED           │    │
│ │ 🎯 Noon Sprint     │ │ 🏆 Storm Chaser     │    │
│ │ [CLAIM 150 PTS]     │ │ Week 3 of employ    │    │
│ └─────────────────────┘ └─────────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5.5 Profile Tab

**Purpose:** Rep's achievement showcase

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ ┌───────────────────────────────────────────────┐   │
│ │         HERO BANNER (light gradient)          │   │
│ │                                               │   │
│ │              [AVATAR]                         │   │
│ │              Sarah Mitchell                   │   │
│ │              ⭐ Senior Canvasser              │   │
│ │                                               │   │
│ │  🔥 12 Day Streak          💎 4,250 pts      │   │
│ └───────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│ [📞 Call] [💬 Text] [📧 Email] [📅 Schedule]       │
├─────────────────────────────────────────────────────┤
│ [Badges] [Stats] [History]                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  📊 THIS WEEK                                       │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │  342   │ │   28   │ │   5    │ │  14    │       │
│  │ Doors  │ │ Appts  │ │ Signs  │ │ Streak │       │
│  └────────┘ └────────┘ └────────┘ └────────┘       │
│                                                     │
│  🏅 BADGE COLLECTION                    [View All]  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│  │  🏆  │ │  ⚡  │ │  🔥  │ │  🎯  │              │
│  │Legend│ │ Epic │ │ Rare │ │Common│              │
│  └──────┘ └──────┘ └──────┘ └──────┘              │
│                                                     │
│  🏆 COMPETITION HISTORY                            │
│  • Weekend Blitz (Jan 27) - 🥇 1st Place - $100   │
│  • New Year Sprint - ✓ Qualified - $50            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 6. MOTION & INTERACTIONS

### 6.1 Base Transitions
```css
/* All interactive elements */
transition: all 200ms ease-out;

/* Cards */
hover: transform: translateY(-2px); box-shadow: shadow-md;

/* Buttons */
active: transform: scale(0.95);
```

### 6.2 Page Transitions
- **Tab switch:** Crossfade 150ms
- **List items:** Staggered fade-in-up (50ms delay between items)
- **Modals:** Fade + scale from 95% to 100%

### 6.3 Celebration Animations
- **Badge unlock:** Full-screen confetti + modal
- **Challenge complete:** Confetti burst + points counter animation
- **Rank improved:** Green glow + slide up effect

### 6.4 Progress Animations
- **Progress rings:** Fill from 0% on mount (800ms ease-out)
- **Progress bars:** Fill from 0% (600ms ease-out)
- **Counter:** Count up animation for large numbers

---

## 7. IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1)
- [ ] Update `tailwind.config.js` with design tokens
- [ ] Import fonts in `index.css`
- [ ] Create shared components: Card, Button, Badge, StatCard
- [ ] Create bottom nav for mobile

### Phase 2: Map + Today (Week 2-3)
- [ ] Implement Map tab with pins and property panel
- [ ] Implement Today tab with hero, progress ring, and schedule
- [ ] Integrate with existing Harvest APIs

### Phase 3: Leaderboard + Challenges (Week 3-4)
- [ ] Implement Leaderboard tab with podium and list
- [ ] Implement Challenges tab with challenge cards
- [ ] Integrate with Incentives Engine APIs

### Phase 4: Profile + Polish (Week 4-5)
- [ ] Implement Profile tab with badges and history
- [ ] Add animations and micro-interactions
- [ ] Mobile optimization and testing

### Phase 5: Platform Rollout (Week 5-6)
- [ ] Apply design system to other Eden modules
- [ ] Documentation and component library
- [ ] Performance optimization

---

*Eden Claims Platform — Stewardship and Excellence*

# Harvest Gamification & UI Overhaul — Design Specification
## Eden Claims Platform — Door-to-Door Canvassing Excellence
**Version:** 1.0 | **Date:** February 2026

---

## 1. High-Level Design Vision

### What Harvest Should Feel Like

Harvest should feel like **entering a competitive arena** where every door knocked is a step toward personal and team glory. During storm season, when urgency is highest, reps should experience a surge of motivation the moment they open the app—a visual feast of their progress, active challenges calling for action, and the tangible rewards waiting at the finish line.

The interface should communicate **"you're a professional athlete of sales"**: clean dashboards showing key metrics, celebratory moments when milestones are hit, and constant awareness of where you stand against your peers. Think less "corporate CRM" and more "fitness app meets fantasy sports."

### The Emotional Arc of a Typical Day

1. **Morning Open (7-8 AM):** Rep sees their daily goal front-and-center on the Today tab. A streak counter shows they're on Day 7—one more day earns a badge. Active challenges display: "50 doors by noon = lunch bonus." The mission of the day is assigned: "Focus on Oak Street subdivision—weather damage confirmed."

2. **First Hours (8-11 AM):** Each logged visit animates the progress ring. Push notifications celebrate micro-wins: "10 doors! Keep the momentum." The map shows pins filling the neighborhood—visual proof of ground covered.

3. **Midday Check (12 PM):** Pop-up celebration: "Challenge Complete: 50 Doors by Noon! +100 bonus points." Streak is safe. Leaderboard shows them climbing from #8 to #5 on the daily board.

4. **Afternoon Push (1-5 PM):** Harvest Coach Bot nudges: "3 more appointments and you unlock the 'Appointment Machine' badge. You've got this!" The next reward tier (Apple AirPods at 2,000 points) is 80% complete—motivation to push through the final hours.

5. **Evening Close (5-6 PM):** Day summary shows: 72 doors, 4 appointments, 1 contract. Badge unlocked: "Week Warrior" (7-day streak). Position on weekly leaderboard: #3. Coach message: "Incredible day! Rest up—tomorrow we chase #1."

---

## 2. Updated Tab Purposes & Layout

### 2.1 Map Tab

**Purpose:** Real-time tactical command center for territory execution.

**Above the Fold:**
- **Daily Goal Pill** (top-left, floating): Circular progress showing doors/goal (e.g., "42/75 Doors")
- **Streak Flame** (top-right, floating): Flame icon with day count (🔥 Day 7)
- **Active Campaign Banner** (top, dismissible): "Weekend Blitz: 2x points until Sunday"
- **Pin Legend** (bottom-right, collapsible): Color codes for visit types

**Layout Changes:**
- Map fills 85% of viewport
- Floating controls don't obscure pins
- Bottom sheet (swipe up) reveals: Quick stats, current challenge progress, nearby POIs

**Visual Hierarchy:**
- **New pins:** Pulsing orange border, larger
- **Visited today:** Solid orange fill
- **Older visits:** Muted gray
- **Appointments set:** Green with checkmark
- **Do Not Knock:** Red with X

---

### 2.2 Today Tab

**Purpose:** Daily mission control—at-a-glance metrics, active challenges, and motivation triggers.

**Above the Fold:**
- **Daily Stats Row:** 
  - Doors (primary metric, largest)
  - Appointments (secondary)
  - Contracts (tertiary)
  - Points (accent)
- **Streak Indicator:** Prominent flame with day count, warning state if at risk
- **Progress Ring:** Animated ring showing daily goal completion
- **Mission of the Day Card:** Drawn from active campaign, shows specific objective
- **Next Reward Progress Bar:** "450 more points to Apple Watch"

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  🔥 Day 7 Streak                          Sat, Feb 5    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│       ┌─────────┐                                        │
│       │   72%   │  ← Animated Progress Ring              │
│       │ 54/75   │                                        │
│       │  DOORS  │                                        │
│       └─────────┘                                        │
│                                                          │
│   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐        │
│   │   54   │  │    4   │  │    1   │  │  320   │        │
│   │ Doors  │  │ Appts  │  │Contract│  │ Points │        │
│   └────────┘  └────────┘  └────────┘  └────────┘        │
├──────────────────────────────────────────────────────────┤
│  📍 MISSION OF THE DAY                                   │
│  ┌──────────────────────────────────────────────────────┐│
│  │ Focus: Riverside Estates                             ││
│  │ Target: 25 doors in hurricane damage zone            ││
│  │ Bonus: +50 points for 5+ appointments               ││
│  └──────────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────┤
│  🎯 TODAY'S CHALLENGES                                   │
│  ┌──────────────────────────────────────────────────────┐│
│  │ ⏰ First 20 Before 10 AM           ████████░░ 85%   ││
│  │ 🏃 Noon Sprint: 50 by 12pm         ████████████ Done!││
│  │ ⭐ Appointment Hat Trick           ██████░░░░ 60%   ││
│  └──────────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────┤
│  🎁 NEXT REWARD                                          │
│  Apple AirPods Pro                          1,550/2,000  │
│  ████████████████████████████░░░░░░░░░                   │
└──────────────────────────────────────────────────────────┘
```

**Colors:**
- Progress ring: Orange gradient (Eden brand)
- Stats cards: White with subtle shadows
- Mission card: Soft blue background
- Challenges: Progress bars in green (complete) / orange (in progress)
- Reward progress: Purple/gold gradient

---

### 2.3 Ranks Tab

**Purpose:** Competitive fuel—see where you stand and who's chasing you.

**Above the Fold:**
- **Your Rank Card:** Large, hero-style showing position, metric, change indicator
- **Time Filter Pills:** Day / Week / Month / All-Time
- **Metric Selector:** Doors / Appointments / Contracts / Points
- **Top 3 Podium:** Visual podium with avatars and names

**Leaderboard Design:**
| Rank | Change | Avatar | Name | Team | Metric |
|------|--------|--------|------|------|--------|
| 1 ⬆️2 | 🥇 | [img] | Sarah M. | Team Alpha | 245 doors |
| 2 ⬇️1 | 🥈 | [img] | Mike T. | Team Beta | 238 doors |
| 3 ➡️ | 🥉 | [img] | Jake R. | Team Alpha | 225 doors |
| ... | | | | | |
| **5** | ⬆️3 | [img] | **You** | Team Alpha | **189 doors** |

**Your Row Highlighting:**
- Highlighted with orange border/gradient
- Sticky when scrolling (always visible)
- Pulse animation when you overtake someone

**Layout Changes:**
- Podium section: 20% of screen
- Leaderboard list: 80% of screen
- Pull-to-refresh with confetti animation if rank improved

---

### 2.4 Challenges Tab

**Purpose:** Gamified objectives that drive specific behaviors and reward completion.

**Above the Fold:**
- **Active Challenges Section:** Cards showing current objectives
- **Progress Bars:** Visual completion percentage
- **Time Remaining:** Countdown for time-limited challenges
- **Reward Preview:** What you get upon completion

**Challenge Card States:**
1. **Locked** (grayed out, requirements shown)
2. **In Progress** (orange border, progress bar)
3. **Completed** (green border, claim button pulsing)
4. **Claimed** (trophy icon, faded)

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  ⚡ ACTIVE CHALLENGES                                    │
├──────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐│
│  │ 🌟 Weekend Warrior                                   ││
│  │ Log 100 doors Sat-Sun                                ││
│  │ ████████████░░░░░░░░░░░░░░░ 45/100  ⏰ 1d 4h left    ││
│  │                                              +500 pts ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌──────────────────────────────────────────────────────┐│
│  │ ✅ COMPLETED - TAP TO CLAIM                          ││
│  │ 🎯 Appointment Machine                               ││
│  │ Set 10 appointments this week                        ││
│  │ ████████████████████████████████ 10/10              ││
│  │                                    [CLAIM 250 pts]   ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌──────────────────────────────────────────────────────┐│
│  │ 🔒 LOCKED                                            ││
│  │ 🏆 Storm Chaser Elite                                ││
│  │ Complete 5 contracts in a single week                ││
│  │ Unlocks at: Week 3 of employment                     ││
│  │                                              +1000 pts││
│  └──────────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────┤
│  📋 CHALLENGE HISTORY                                    │
│  View completed challenges and earned rewards →          │
└──────────────────────────────────────────────────────────┘
```

---

### 2.5 Profile Tab

**Purpose:** Personal achievement showcase and career progress tracker.

**Above the Fold:**
- **Avatar & Name** (large, editable)
- **Level/Title** (e.g., "Senior Canvasser")
- **Lifetime Stats Grid:** Total doors, appointments, contracts, days active
- **Best Streak Badge:** Largest streak achieved
- **Badge Collection Preview:** Top 4 recent badges (tap to see all)

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│                    ┌─────────┐                           │
│                    │  AVATAR │                           │
│                    └─────────┘                           │
│                   Sarah Mitchell                         │
│                  ⭐ Senior Canvasser                     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 📊 LIFETIME STATS                                  │  │
│  │                                                    │  │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐          │  │
│  │  │ 2,847│  │  312 │  │   47 │  │  156 │          │  │
│  │  │Doors │  │Appts │  │Deals │  │ Days │          │  │
│  │  └──────┘  └──────┘  └──────┘  └──────┘          │  │
│  │                                                    │  │
│  │  🔥 Best Streak: 23 days                          │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  🏅 BADGE COLLECTION                    [View All →]    │
│  ┌────────────────────────────────────────────────────┐  │
│  │  [🥇]   [🏆]   [⭐]   [🔥]   +12 more              │  │
│  │  Epic  Legend  Rare  Common                        │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  🎁 REWARDS HISTORY                     [View All →]    │
│  • Apple AirPods Pro - Claimed Feb 3                    │
│  • $100 Visa Gift Card - Claimed Jan 15                 │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Gamification System

### 3.1 Badge Tiers & Rarity

| Tier | Rarity | Border | Glow Effect | Examples |
|------|--------|--------|-------------|----------|
| **Common** | 60% | Gray | None | First Door, 5-Day Streak, 10 Appointments |
| **Rare** | 25% | Blue | Subtle blue shimmer | 14-Day Streak, 100 Doors/Week, 25 Appointments |
| **Epic** | 12% | Purple | Purple pulse | 30-Day Streak, 5 Contracts/Week, Top 10 Monthly |
| **Legendary** | 3% | Gold | Gold radiant glow | 100-Day Streak, 10 Contracts/Month, #1 All-Time |

**Badge Visual Differentiation:**
- **Common:** Matte finish, single-color icon
- **Rare:** Metallic finish, gradient fill
- **Epic:** Holographic effect, animated particles
- **Legendary:** 3D depth effect, animated golden glow, unique frame

**Specific Badge Examples:**
| Badge Name | Tier | Criteria | Icon |
|------------|------|----------|------|
| First Steps | Common | Log first door | 👟 |
| Week Warrior | Common | 7-day streak | 🗓️ |
| Appointment Ace | Rare | 10 appts in one day | 🎯 |
| Century Club | Rare | 100 doors in one week | 💯 |
| Streak Master | Epic | 30-day unbroken streak | 🔥 |
| Contract King | Epic | 5 contracts in one week | 👑 |
| Harvest Legend | Legendary | #1 monthly rank | 🏆 |
| Iron Will | Legendary | 100-day streak | 💎 |

---

### 3.2 Streaks & Heat Indicators

**Streak Visualization:**
```
Day 1-6:  🔥 Small flame, orange
Day 7-13: 🔥🔥 Medium flame, orange-red
Day 14-29: 🔥🔥🔥 Large flame, red with particles
Day 30+:  💎🔥 Diamond flame, animated rainbow glow
```

**Streak Warning States:**
- **Safe:** Green background on streak indicator
- **At Risk (no activity by 3 PM):** Yellow background, pulsing animation
- **Critical (no activity by 5 PM):** Red background, Coach Bot notification

**Coach Bot Streak Messages:**
- Morning: "Day 7 streak! One more week unlocks 'Streak Master' badge!"
- At Risk: "⚠️ Your 12-day streak is at risk! Log 1 door to keep it alive."
- Broken: "💔 Streak ended at 8 days. Start fresh tomorrow—you've got this!"
- Milestone: "🔥 14-DAY STREAK! You're on fire! Only 16 more days to 'Iron Will'!"

---

### 3.3 Rewards & Incentives System

**Reward Data Model:**
```typescript
interface Reward {
  id: string;
  name: string;
  description: string;
  image_url: string;
  category: "gift_card" | "merchandise" | "experience" | "cash_bonus" | "pto";
  points_required: number;
  retail_value_cents: number;
  stock_quantity: number | null;  // null = unlimited
  active_campaign_id: string | null;  // If tied to specific campaign
  is_featured: boolean;
  available_from: string;  // ISO date
  available_until: string | null;  // null = permanent
  created_at: string;
  updated_at: string;
}

interface RewardRedemption {
  id: string;
  user_id: string;
  reward_id: string;
  points_spent: number;
  status: "pending" | "approved" | "fulfilled" | "denied";
  requested_at: string;
  approved_at: string | null;
  approved_by: string | null;
  fulfilled_at: string | null;
  fulfillment_notes: string | null;
  denial_reason: string | null;
}
```

**Progress Visualization:**
```
┌──────────────────────────────────────────────────────────┐
│  🎁 YOUR REWARDS PROGRESS                                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Current Points: 1,550                                   │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Apple AirPods Pro                     2,000 pts    │  │
│  │ ███████████████████████████░░░░░░░   77% complete  │  │
│  │                              450 pts to unlock     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ $50 Amazon Gift Card                  1,000 pts    │  │
│  │ ████████████████████████████████████  ✅ AVAILABLE │  │
│  │                              [REDEEM NOW]          │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Half-Day PTO                          5,000 pts    │  │
│  │ ██████████░░░░░░░░░░░░░░░░░░          31% complete │  │
│  │                            3,450 pts to unlock     │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Redemption Flow:**
1. **Request:** User taps "Redeem" → Confirmation modal shows points deduction
2. **Pending:** Points deducted, status shown in Profile → Rewards History
3. **Approval:** Admin reviews in Console, approves/denies
4. **Fulfillment:** Admin marks fulfilled, user receives notification
5. **Denied:** Points refunded, user notified with reason

---

## 4. Admin Gamification Console

### 4.1 Campaign Data Model

```typescript
interface Campaign {
  id: string;
  name: string;
  description: string;
  
  // Timing
  start_date: string;  // ISO
  end_date: string;
  status: "draft" | "scheduled" | "active" | "completed" | "cancelled";
  
  // Goal Configuration
  goal_type: "doors" | "appointments" | "contracts" | "points" | "custom";
  target_value: number;
  goal_description: string;  // For custom goals
  
  // Reward Configuration
  reward_type: "top_performers" | "threshold" | "lottery";
  reward_ids: string[];  // IDs of rewards from catalog
  top_n: number | null;  // For top_performers: how many winners
  threshold_value: number | null;  // For threshold: minimum to qualify
  
  // Eligibility
  eligibility_rules: {
    min_tenure_days: number | null;
    teams: string[] | null;  // null = all teams
    roles: string[] | null;  // null = all roles
    must_be_active: boolean;
  };
  
  // Display
  announcement_banner_text: string;
  banner_color: string;
  icon: string;
  
  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

**Campaign Types Explained:**
- **Top Performers:** "Top 3 in doors this week win prizes"
- **Threshold:** "Anyone who hits 100 doors gets $50 bonus"
- **Lottery:** "Everyone who hits target enters drawing for grand prize"

---

### 4.2 Campaign Templates

| Template Name | Duration | Metric | Goal | Reward Type | Description |
|---------------|----------|--------|------|-------------|-------------|
| **Weekly Blitz** | 7 days | Doors | 150 | Threshold | Push door volume with guaranteed reward for hitting target |
| **Season Long Ladder** | 90 days | Points | Top 10 | Top Performers | Quarter-long competition with tiered prizes |
| **New Rep Sprint** | 14 days | Appointments | 20 | Threshold | Onboarding challenge for new hires |
| **Storm Response** | 3-7 days | Contracts | 3 | Top Performers | Rapid deployment after weather event |
| **Team Battle** | 30 days | Doors | N/A | Top Performers | Team vs. team competition |

**Template Details:**

**1. Weekly Blitz**
- Duration: Mon-Sun (7 days)
- Default Goal: 150 doors
- Reward: $50 gift card for hitting threshold
- Eligibility: All active reps
- Banner: "Weekly Blitz: Hit 150 doors = $50 bonus!"

**2. Season Long Ladder**
- Duration: 90 days (Q1, Q2, Q3, Q4)
- Default Goal: Cumulative points
- Rewards: 
  - 1st Place: $500 + trophy
  - 2nd Place: $300
  - 3rd Place: $200
  - 4-10th: $50 each
- Banner: "Q1 Ladder: Climb to the top!"

**3. New Rep Sprint**
- Duration: First 14 days of employment
- Default Goal: 20 appointments
- Reward: "Rising Star" badge + $100 bonus
- Eligibility: Reps with <30 days tenure
- Banner: "New Rep Challenge: Prove yourself!"

**4. Storm Response**
- Duration: Flexible (3-7 days post-storm)
- Default Goal: 3 contracts
- Rewards: Top 3 get bonus + recognition
- Eligibility: Deployed reps only
- Banner: "Storm Response: Time to deliver!"

**5. Team Battle**
- Duration: 30 days
- Metric: Team aggregate doors
- Reward: Winning team gets team dinner
- Eligibility: All teams
- Banner: "Team Battle: [Team A] vs [Team B]!"

---

### 4.3 Admin Console UI Layout

**Navigation:**
```
/admin/harvest
├── /campaigns        → Active Campaigns
├── /campaigns/new    → Create Campaign
├── /templates        → Template Library
├── /rewards          → Rewards Catalog
├── /redemptions      → Redemption Requests
└── /history          → Campaign History
```

**Page: Active Campaigns**
```
┌──────────────────────────────────────────────────────────┐
│  ACTIVE CAMPAIGNS                      [+ New Campaign]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🔥 Weekly Blitz - Week 5                           │  │
│  │ Status: Active | Ends in 3 days                    │  │
│  │ Participation: 24/28 reps | 8 qualified            │  │
│  │                                        [Edit] [End]│  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🏆 Q1 Season Ladder                                │  │
│  │ Status: Active | 45 days remaining                 │  │
│  │ Leader: Sarah M. (4,250 pts)                       │  │
│  │                                    [View] [Pause]  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Scheduled: 2 | Draft: 1                                 │
└──────────────────────────────────────────────────────────┘
```

**Page: Templates**
```
┌──────────────────────────────────────────────────────────┐
│  CAMPAIGN TEMPLATES                    [+ New Template]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐              │
│  │  Weekly   │ │  Season   │ │  New Rep  │              │
│  │   Blitz   │ │  Ladder   │ │  Sprint   │              │
│  │           │ │           │ │           │              │
│  │  7 days   │ │  90 days  │ │  14 days  │              │
│  │ Threshold │ │Top Perform│ │ Threshold │              │
│  │           │ │           │ │           │              │
│  │  [Use]    │ │  [Use]    │ │  [Use]    │              │
│  └───────────┘ └───────────┘ └───────────┘              │
│                                                          │
│  ┌───────────┐ ┌───────────┐                            │
│  │   Storm   │ │   Team    │                            │
│  │  Response │ │  Battle   │                            │
│  │           │ │           │                            │
│  │  3-7 days │ │  30 days  │                            │
│  │Top Perform│ │Top Perform│                            │
│  │           │ │           │                            │
│  │  [Use]    │ │  [Use]    │                            │
│  └───────────┘ └───────────┘                            │
└──────────────────────────────────────────────────────────┘
```

**Page: Rewards Catalog**
```
┌──────────────────────────────────────────────────────────┐
│  REWARDS CATALOG                         [+ Add Reward]  │
├──────────────────────────────────────────────────────────┤
│  Filter: [All ▼] [Gift Cards ▼] [In Stock ▼]            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  │ Image │ Name              │ Points │ Stock │ Status │ │
│  │ [img] │ Apple AirPods Pro │ 2,000  │  5    │ Active │ │
│  │ [img] │ $50 Amazon GC     │ 1,000  │  ∞    │ Active │ │
│  │ [img] │ $100 Visa GC      │ 2,500  │  10   │ Active │ │
│  │ [img] │ Half-Day PTO      │ 5,000  │  20   │ Active │ │
│  │ [img] │ Company Hoodie    │  500   │  0    │ Out    │ │
│                                                          │
│  [Edit] [Archive] [Restock]                              │
└──────────────────────────────────────────────────────────┘
```

**Page: Redemption Requests**
```
┌──────────────────────────────────────────────────────────┐
│  REDEMPTION REQUESTS                   Filter: [Pending] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  │ Date    │ Rep       │ Reward          │ Pts  │ Action│
│  │ Feb 5   │ Sarah M.  │ AirPods Pro     │2,000 │[✓] [✗]│
│  │ Feb 4   │ Mike T.   │ $50 Amazon GC   │1,000 │[✓] [✗]│
│  │ Feb 3   │ Jake R.   │ Company Hoodie  │  500 │[✓] [✗]│
│                                                          │
│  Approved: 15 | Pending: 3 | Denied: 1                   │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Visual Design Guidelines

### 5.1 Color Roles

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Primary Accent** | Eden Orange | `#F97316` | Progress bars, wins, CTAs |
| **Success** | Emerald | `#10B981` | Completed challenges, confirmations |
| **Warning** | Amber | `#F59E0B` | Streak at risk, time running out |
| **Danger** | Red | `#EF4444` | Streak broken, denied, errors |
| **Rank Gold** | Gold | `#FBBF24` | 1st place, legendary badges |
| **Rank Silver** | Silver | `#9CA3AF` | 2nd place, common badges |
| **Rank Bronze** | Bronze | `#D97706` | 3rd place |
| **Epic Purple** | Purple | `#8B5CF6` | Epic tier, special campaigns |
| **Background** | Slate 50 | `#F8FAFC` | Main background |
| **Card** | White | `#FFFFFF` | Cards, modals |
| **Text Primary** | Slate 900 | `#0F172A` | Headers, primary text |
| **Text Secondary** | Slate 500 | `#64748B` | Descriptions, metadata |

### 5.2 Iconography Style

- **Style:** Filled with subtle gradients, rounded corners
- **Badge Icons:** 24x24px base, with rarity-specific frames (32x32 with frame)
- **Action Icons:** Lucide React library (consistent with Eden)
- **Reward Icons:** Custom illustrations, consistent style across catalog
- **Animation:** SVG-based for badges, CSS for UI states

### 5.3 Motion & Feedback Guidelines

**Micro-Animations:**
| Trigger | Animation | Duration |
|---------|-----------|----------|
| Door logged | Progress ring increment + pulse | 300ms |
| Challenge progress | Bar fill with ease-out | 400ms |
| Badge unlock | Full-screen celebration | 2000ms |
| Rank change up | Green arrow bounce | 500ms |
| Rank change down | Red arrow slide | 300ms |
| Streak milestone | Flame grow + particle burst | 800ms |
| Reward redeemed | Confetti + success toast | 1500ms |

**Celebration Moments:**
- **Badge Unlock:** Full-screen overlay with badge art rotating in, confetti, "Share" button, stats about how rare the badge is
- **Challenge Complete:** Modal with checkmark animation, points awarded counter, next challenge preview
- **Campaign Win:** Premium celebration with podium visualization, photo moment suggestion, team notification

**Page Load Animations:**
- Stats cards: Staggered fade-in (100ms delay each)
- Progress ring: Animate from 0 to current value
- Leaderboard rows: Slide in from right (50ms stagger)
- Badge grid: Scale in with spring physics

---

## 6. Harvest Coach Bot Integration

### 6.1 Events Bot Should React To

| Event | Priority | Notification Type |
|-------|----------|-------------------|
| 50% challenge progress | Medium | Encouragement |
| Challenge complete | High | Celebration |
| Streak at risk (3 PM) | High | Warning |
| Streak at risk (5 PM) | Critical | Urgent warning |
| Streak broken | Medium | Encouragement |
| New streak milestone (7, 14, 30, 100) | High | Celebration |
| Close to reward (90%+) | Medium | Motivation |
| Rank overtaken | Medium | Competition |
| You overtook someone | Medium | Celebration |
| Campaign ending soon (<24h) | High | Urgency |
| New campaign started | Medium | Announcement |
| Reward approved | Medium | Good news |

### 6.2 Example Notifications

**Encouragement:**
```
🎯 Halfway there! You're 50% to completing "Weekend Warrior" 
(50/100 doors). Keep it up—you've got 36 hours left!
```

**Celebration:**
```
🎉 CHALLENGE COMPLETE: Appointment Hat Trick!
You set 3 appointments today. +150 bonus points earned!
```

**Warning:**
```
⚠️ Streak Alert! Your 12-day streak is at risk.
Log at least 1 door before midnight to keep it alive!
```

**Motivation:**
```
🎁 So close! You're just 120 points from redeeming 
Apple AirPods Pro. That's about 6 more appointments!
```

**Competition:**
```
📈 You've moved up! You're now #4 on the weekly leaderboard,
up from #7. Sarah M. is just 15 doors ahead...
```

**Urgency:**
```
⏰ Weekly Blitz ends in 6 hours! You need 23 more doors 
to hit 150 and earn the $50 bonus. Final push time!
```

### 6.3 Notification Payload Structure

```typescript
interface HarvestCoachNotification {
  id: string;
  user_id: string;
  type: "harvest_coach";
  subtype: 
    | "streak_warning" 
    | "streak_milestone" 
    | "streak_broken"
    | "challenge_progress" 
    | "challenge_complete"
    | "campaign_ending" 
    | "campaign_started"
    | "rank_change" 
    | "reward_progress" 
    | "reward_approved";
  
  title: string;
  body: string;
  
  data: {
    // For challenges
    challenge_id?: string;
    progress_percent?: number;
    
    // For streaks
    streak_days?: number;
    streak_status?: "safe" | "at_risk" | "broken";
    
    // For ranks
    old_rank?: number;
    new_rank?: number;
    leaderboard_type?: "daily" | "weekly" | "monthly";
    
    // For rewards
    reward_id?: string;
    points_progress?: number;
    points_required?: number;
    
    // For campaigns
    campaign_id?: string;
    time_remaining_hours?: number;
  };
  
  action_url: string;  // Deep link to relevant tab
  created_at: string;
}
```

---

## 7. Implementation Roadmap (6 Weeks)

### Phase 1: Foundation (Week 1-2)

| # | Task | Area | Description | Dependencies |
|---|------|------|-------------|--------------|
| 1 | Create Rewards data model | `backend` | Add `rewards`, `reward_redemptions` collections to MongoDB; Pydantic models | None |
| 2 | Create Campaigns data model | `backend` | Add `campaigns`, `campaign_templates` collections; Pydantic models | None |
| 3 | Implement Rewards API | `backend` | CRUD endpoints for `/api/harvest/rewards/*` | Task 1 |
| 4 | Implement Campaigns API | `backend` | CRUD endpoints for `/api/harvest/campaigns/*` | Task 2 |
| 5 | Add badge tier system | `backend` | Extend existing badge model with `tier` field; migration script | None |
| 6 | Create streak service | `backend` | Service to calculate/update user streaks; integrate with visit logging | None |

### Phase 2: Today & Profile Tabs (Week 2-3)

| # | Task | Area | Description | Dependencies |
|---|------|------|-------------|--------------|
| 7 | Redesign Today tab layout | `frontend` | Implement new Today tab UI per spec; progress ring, stats grid, mission card | Tasks 4, 6 |
| 8 | Add streak visualization | `frontend` | Flame icon component with day count, color states, animations | Task 6 |
| 9 | Build reward progress component | `frontend` | Progress bar toward next reward; points counter | Task 3 |
| 10 | Redesign Profile tab | `frontend` | New layout with lifetime stats, badge grid, rewards history | Tasks 3, 5 |
| 11 | Create badge detail modal | `frontend` | Modal showing badge art, criteria, earn date, rarity stats | Task 5 |
| 12 | Add badge tier visuals | `frontend` | CSS/SVG for Common/Rare/Epic/Legendary borders and effects | Task 5 |

### Phase 3: Challenges Tab (Week 3-4)

| # | Task | Area | Description | Dependencies |
|---|------|------|-------------|--------------|
| 13 | Create Challenge model | `backend` | Extend campaigns to support individual challenges; progress tracking | Task 4 |
| 14 | Implement challenge progress API | `backend` | Endpoints to get user challenges, update progress, claim rewards | Task 13 |
| 15 | Build Challenges tab | `frontend` | Challenge cards with states (locked, in-progress, completed, claimed) | Task 14 |
| 16 | Add challenge progress animations | `frontend` | Progress bar fills, completion celebration modal | Task 15 |
| 17 | Implement claim flow | `frontend` | Claim button, confirmation, points animation | Tasks 14, 15 |

### Phase 4: Harvest Coach Integration (Week 4-5)

| # | Task | Area | Description | Dependencies |
|---|------|------|-------------|--------------|
| 18 | Extend notification system | `backend` | Add `harvest_coach` notification type with new payloads | Tasks 6, 13 |
| 19 | Build streak warning job | `backend` | Scheduled job to check streaks at 3 PM, 5 PM; send notifications | Task 18 |
| 20 | Build challenge progress triggers | `backend` | Event handlers to send notifications at 50%, 100% | Tasks 13, 18 |
| 21 | Build rank change notifications | `backend` | Detect rank changes; notify when overtaken/overtaking | Task 18 |
| 22 | Update notification UI | `frontend` | Harvest-specific notification cards with appropriate styling | Task 18 |

### Phase 5: Admin Console (Week 5-6)

| # | Task | Area | Description | Dependencies |
|---|------|------|-------------|--------------|
| 23 | Build Campaign management pages | `frontend` | List, create, edit, end campaigns; template library | Task 4 |
| 24 | Build Rewards catalog page | `frontend` | Add, edit, archive rewards; stock management | Task 3 |
| 25 | Build Redemption requests page | `frontend` | List pending, approve/deny flow, fulfillment tracking | Task 3 |
| 26 | Create campaign templates seed | `backend` | Seed data for 5 default templates | Task 4 |
| 27 | Add admin RBAC | `backend` | Ensure only admin role can access gamification console | Tasks 23-25 |

### Phase 6: Polish & Testing (Week 6)

| # | Task | Area | Description | Dependencies |
|---|------|------|-------------|--------------|
| 28 | Implement celebration animations | `frontend` | Badge unlock full-screen, challenge complete modal, confetti | All frontend |
| 29 | Add loading states | `frontend` | Skeleton loaders for all new components | All frontend |
| 30 | E2E testing | `product/UX` | Playwright tests for Today, Challenges, Profile, Admin flows | All |
| 31 | Performance optimization | `frontend` | Lazy load badge images, optimize animations for mobile | All frontend |
| 32 | User acceptance testing | `product/UX` | Internal testing with field team; gather feedback | All |

---

## 8. Data Migration & Seed Data

### Existing Data Preservation
- All existing visit logs, appointments, contracts remain unchanged
- Current points/scores continue to accumulate
- Existing badges migrate with `tier: "common"` default

### New Collections
```javascript
// rewards
{
  "_id": ObjectId,
  "id": "reward-airpods-pro",
  "name": "Apple AirPods Pro",
  "description": "Premium wireless earbuds",
  "image_url": "/rewards/airpods-pro.png",
  "category": "merchandise",
  "points_required": 2000,
  "retail_value_cents": 24900,
  "stock_quantity": 5,
  "is_featured": true,
  "available_from": "2026-02-01T00:00:00Z",
  "created_at": "2026-02-01T00:00:00Z"
}

// campaigns
{
  "_id": ObjectId,
  "id": "campaign-weekly-blitz-w5",
  "name": "Weekly Blitz - Week 5",
  "goal_type": "doors",
  "target_value": 150,
  "reward_type": "threshold",
  "reward_ids": ["reward-50-amazon"],
  "start_date": "2026-02-03T00:00:00Z",
  "end_date": "2026-02-09T23:59:59Z",
  "status": "active"
}

// campaign_templates
{
  "_id": ObjectId,
  "id": "template-weekly-blitz",
  "name": "Weekly Blitz",
  "duration_days": 7,
  "goal_type": "doors",
  "default_target": 150,
  "reward_type": "threshold",
  "description": "Push door volume with guaranteed reward"
}
```

---

## Summary

This specification provides a complete blueprint for transforming Eden's Harvest module into a best-in-class D2D canvassing experience:

- **Phase 1 (Today, Profile):** Delivers immediate visual impact with gamified daily experience
- **Phase 2 (Challenges):** Adds engagement layer with objectives and rewards
- **Phase 3 (Admin Console):** Empowers leadership to run incentive programs
- **Future:** Map and Ranks tabs refinement

The gamification system is designed to:
1. **Motivate** through visible progress and achievable goals
2. **Reward** both consistent effort (streaks) and exceptional performance (badges)
3. **Compete** healthily with transparent leaderboards
4. **Celebrate** wins with memorable moments

---

*Eden Claims Platform — Stewardship and Excellence in Claims Handling*

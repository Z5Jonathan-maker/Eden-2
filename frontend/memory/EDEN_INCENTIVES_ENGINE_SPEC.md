# Eden Incentives Engine — Enzy-Inspired Specification
## Full-Stack Gamification & Competition System for Harvest
**Version:** 1.0 | **Date:** February 2026

---

# Section 1: High-Level Incentives Vision for Eden

## 1.1 Philosophy: Competitions as a Product, Not a Feature

The core insight from Enzy's success is treating **incentives as infrastructure**, not one-off contests. Every company using Enzy can:
- Create unlimited competitions without developer involvement
- Use any KPI their business tracks
- Plug in any reward fulfillment partner
- Run overlapping competitions (daily sprints + weekly challenges + monthly ladders simultaneously)

Eden's Harvest module must adopt this same philosophy: **the incentives engine is a configurable platform** that any roofing company, solar installer, or ministry organization can customize to their culture without code changes.

## 1.2 Core Principles

### 1.2.1 Any KPI, Any Time Window
- **Metric-agnostic:** Competitions can target doors, appointments, contracts, installs, reviews, referrals, training completions, or any custom metric
- **Flexible time windows:** Day, weekend, week, month, quarter, season, or custom date range
- **Compound metrics:** Support ratios (e.g., "appointment-to-contract rate") and weighted combinations

### 1.2.2 Individual + Team + Company-Wide
- **Individual:** Classic "top rep wins" or "hit X threshold, everyone who qualifies wins"
- **Team:** Office vs. office, crew vs. crew, region vs. region
- **Hybrid:** Individual performance contributes to team score; both get rewarded

### 1.2.3 Templates > Hard-Coded Contests
- Admins save successful competitions as templates
- Templates include: metric, duration, rules, suggested prizes, messaging
- One-click launch: "Run Weekend Blitz again" or "Start Q2 Ladder from template"

### 1.2.4 Pluggable Fulfillment
- Start simple: Manual fulfillment with notification
- Design for future: Abstract `FulfillmentProvider` interface
- Enzy's model: Multiple partners (gift cards, merch, experiences) with automated delivery

### 1.2.5 Omnipresent Recognition
- Competitions visible in **Today** (current progress), **Leaderboard** (live rankings), **Challenges** (all active/upcoming), **Profile** (history and wins)
- Real-time updates when someone overtakes you
- Celebration moments for milestones and wins

---

## 1.3 What Makes This "Enzy-Level"

| Enzy Feature | Eden Implementation |
|--------------|---------------------|
| Any KPI from CRM | Any metric from Harvest (doors, AP, SG, contracts, installs, reviews, custom) |
| Templates library | `CompetitionTemplate` collection with one-click launch |
| Real-time leaderboards | WebSocket updates on metric changes |
| Automated fulfillment | `FulfillmentProvider` abstraction with manual → automated progression |
| Constant competitions | Multiple concurrent competitions with different scopes/durations |
| Team battles | `scope: team` with aggregation by office/crew/region |
| Recognition everywhere | Today, Leaderboard, Challenges, Profile integration |

---

# Section 2: Data Model

## 2.1 Entity Relationship Overview

```
┌──────────────────┐      ┌──────────────────┐
│     Metric       │      │ FulfillmentProvider │
│   (KPI types)    │      │   (reward delivery) │
└────────┬─────────┘      └─────────┬──────────┘
         │                          │
         │                          │
         ▼                          ▼
┌──────────────────┐      ┌──────────────────┐
│ CompetitionTemplate│     │     Reward       │
│  (reusable blueprints)│  │  (prize catalog) │
└────────┬─────────┘      └─────────┬──────────┘
         │                          │
         │ creates                  │ links to
         ▼                          │
┌──────────────────┐               │
│   Competition    │◄──────────────┘
│ (active instance)│
└────────┬─────────┘
         │
         │ has many
         ▼
┌──────────────────┐      ┌──────────────────┐
│ IncentiveRule    │      │ Participant      │
│ (win conditions) │      │ (user + progress)│
└──────────────────┘      └────────┬─────────┘
                                   │
                                   │ earns
                                   ▼
                          ┌──────────────────┐
                          │ FulfillmentEvent │
                          │ (reward delivery) │
                          └──────────────────┘
```

## 2.2 Core Entities

### 2.2.1 Metric (KPI Definition)

```typescript
interface Metric {
  id: string;
  slug: string;                    // "doors", "appointments", "contracts", "installs"
  name: string;                    // "Doors Knocked"
  description: string;
  
  // Calculation
  source_collection: string;       // "harvest_visits", "appointments", "contracts"
  source_field: string;            // Field to count/sum
  aggregation: "count" | "sum" | "avg" | "ratio";
  
  // For ratio metrics (e.g., close rate)
  numerator_metric_id?: string;
  denominator_metric_id?: string;
  
  // Display
  icon: string;
  unit: string;                    // "doors", "appointments", "$", "%"
  format: "integer" | "decimal" | "currency" | "percentage";
  
  // Scoping
  supports_individual: boolean;
  supports_team: boolean;
  supports_company: boolean;
  
  is_system: boolean;              // Built-in vs. custom
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

**Seed Metrics:**
| Slug | Name | Source | Aggregation |
|------|------|--------|-------------|
| doors | Doors Knocked | harvest_visits | count |
| appointments | Appointments Set | appointments | count |
| contracts | Contracts Signed | contracts | count |
| installs | Installs Completed | installs | count |
| reviews | Reviews Collected | reviews | count |
| referrals | Referrals Generated | referrals | count |
| revenue | Revenue Generated | contracts.value | sum |
| close_rate | Close Rate | appointments → contracts | ratio |
| points | Harvest Points | harvest_score_events | sum |

### 2.2.2 CompetitionTemplate

```typescript
interface CompetitionTemplate {
  id: string;
  name: string;                    // "Weekend Blitz", "Monthly Ladder"
  description: string;
  
  // Template settings (defaults for new competitions)
  default_metric_id: string;
  default_duration_type: "day" | "weekend" | "week" | "month" | "quarter" | "custom";
  default_duration_days?: number;  // For custom
  
  // Scope
  default_scope: "individual" | "team" | "company";
  default_team_grouping?: "office" | "crew" | "region" | "custom";
  
  // Rules template
  default_rules: IncentiveRuleTemplate[];
  
  // Suggested rewards
  suggested_reward_ids: string[];
  suggested_points_bonus: number;
  
  // Display
  icon: string;
  banner_color: string;
  category: "sprint" | "ladder" | "threshold" | "team_battle" | "milestone";
  
  // Usage tracking
  times_used: number;
  last_used_at?: string;
  
  is_system: boolean;              // Built-in vs. user-created
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

**Seed Templates:**

| Name | Duration | Metric | Scope | Rule Type |
|------|----------|--------|-------|-----------|
| Daily Sprint | 1 day | doors | individual | threshold |
| Weekend Blitz | 3 days | doors | individual | threshold + top_n |
| Weekly Ladder | 7 days | points | individual | top_n |
| Monthly Championship | 30 days | revenue | individual | top_n |
| Office Battle | 7 days | doors | team | top_n |
| New Rep Challenge | 14 days | appointments | individual | threshold |
| Storm Season Push | custom | contracts | individual | threshold |

### 2.2.3 Competition (Active Instance)

```typescript
interface Competition {
  id: string;
  template_id?: string;            // If created from template
  
  // Identity
  name: string;
  description: string;
  icon: string;
  banner_color: string;
  
  // Timing
  start_date: string;              // ISO datetime
  end_date: string;
  timezone: string;                // "America/Denver"
  status: "draft" | "scheduled" | "active" | "evaluating" | "completed" | "cancelled";
  
  // Metric configuration
  metric_id: string;
  metric_snapshot?: Metric;        // Denormalized for historical accuracy
  
  // Scope
  scope: "individual" | "team" | "company";
  team_grouping?: "office" | "crew" | "region" | "custom";
  custom_team_ids?: string[];      // For custom team grouping
  
  // Eligibility
  eligibility: {
    all_users: boolean;
    min_tenure_days?: number;
    required_role_ids?: string[];
    required_team_ids?: string[];
    excluded_user_ids?: string[];
  };
  
  // Rules (who wins)
  rules: IncentiveRule[];
  
  // Rewards
  reward_pool: CompetitionReward[];
  points_bonus: number;            // Bonus points for participants
  
  // Display settings
  show_in_today: boolean;
  show_in_leaderboard: boolean;
  show_in_challenges: boolean;
  announcement_text?: string;
  
  // Results (populated after evaluation)
  results?: CompetitionResult[];
  evaluated_at?: string;
  
  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

### 2.2.4 IncentiveRule

```typescript
interface IncentiveRule {
  id: string;
  competition_id: string;
  
  // Rule type
  type: "top_n" | "threshold" | "milestone" | "improvement" | "lottery";
  
  // Conditions based on type
  // top_n: Top N performers win
  top_n?: number;
  top_n_per_team?: boolean;        // Top N per team, not overall
  
  // threshold: Anyone who hits value wins
  threshold_value?: number;
  threshold_operator?: "gte" | "gt" | "eq";
  
  // milestone: Multiple tiers (hit 50 = bronze, 100 = silver, 150 = gold)
  milestones?: { value: number; tier: string; reward_id?: string }[];
  
  // improvement: Beat your own baseline by X%
  improvement_percent?: number;
  baseline_period?: "last_week" | "last_month" | "last_competition";
  
  // lottery: Random draw from qualifiers
  lottery_qualifier_threshold?: number;
  lottery_winner_count?: number;
  
  // Reward mapping
  reward_id?: string;              // Single reward for this rule
  reward_tiers?: {                 // Tiered rewards (1st, 2nd, 3rd place)
    rank: number;
    reward_id: string;
  }[];
  points_award?: number;
  badge_id?: string;               // Badge awarded for this achievement
  
  // Priority (for evaluation order)
  priority: number;
  
  created_at: string;
}
```

### 2.2.5 Reward

```typescript
interface Reward {
  id: string;
  name: string;
  description: string;
  
  // Type
  type: "gift_card" | "merchandise" | "experience" | "cash" | "pto" | "points" | "badge" | "custom";
  
  // Value
  value_cents?: number;            // Monetary value
  points_value?: number;           // If type is "points"
  badge_id?: string;               // If type is "badge"
  
  // Fulfillment
  fulfillment_provider_id?: string;
  fulfillment_sku?: string;        // SKU/code for automated fulfillment
  requires_shipping: boolean;
  requires_approval: boolean;
  
  // Inventory
  stock_quantity?: number;         // null = unlimited
  max_per_user?: number;           // Limit per user per period
  
  // Display
  image_url?: string;
  icon: string;
  
  // Availability
  is_active: boolean;
  available_from?: string;
  available_until?: string;
  
  created_at: string;
  updated_at: string;
}
```

### 2.2.6 FulfillmentProvider

```typescript
interface FulfillmentProvider {
  id: string;
  name: string;                    // "Manual", "Tremendous", "Tango Card", "SwagUp"
  type: "manual" | "api" | "webhook";
  
  // Configuration (encrypted)
  config: {
    api_url?: string;
    api_key?: string;
    webhook_url?: string;
    // Provider-specific fields
  };
  
  // Capabilities
  supported_reward_types: string[];
  supports_bulk: boolean;
  supports_instant: boolean;
  
  // Status
  is_active: boolean;
  last_health_check?: string;
  health_status?: "healthy" | "degraded" | "down";
  
  created_at: string;
  updated_at: string;
}
```

**Initial Providers:**
| ID | Name | Type | Description |
|----|------|------|-------------|
| manual | Manual Fulfillment | manual | Admin manually fulfills and marks complete |
| notification | Notification Only | manual | Sends congratulations, manager handles fulfillment |

### 2.2.7 FulfillmentEvent

```typescript
interface FulfillmentEvent {
  id: string;
  
  // Source
  competition_id: string;
  rule_id: string;
  participant_id: string;
  user_id: string;
  
  // Reward
  reward_id: string;
  reward_snapshot: Reward;         // Denormalized
  
  // Fulfillment
  provider_id: string;
  status: "pending" | "processing" | "sent" | "delivered" | "failed" | "cancelled";
  
  // Provider response
  provider_reference?: string;     // External tracking ID
  provider_response?: object;      // Raw response
  
  // Delivery details
  delivery_method?: "email" | "physical" | "in_app" | "api";
  delivery_address?: object;       // Shipping address if needed
  delivery_email?: string;
  
  // Timeline
  created_at: string;
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  failure_reason?: string;
  
  // Manual fulfillment
  fulfilled_by?: string;           // Admin user ID
  fulfillment_notes?: string;
}
```

### 2.2.8 Participant

```typescript
interface Participant {
  id: string;
  competition_id: string;
  user_id: string;
  team_id?: string;                // For team competitions
  
  // Current state
  current_value: number;           // Current metric value
  rank?: number;                   // Current rank (updated on value change)
  previous_rank?: number;          // For rank change detection
  
  // Qualification
  qualified_rules: string[];       // Rule IDs this participant has qualified for
  milestone_reached?: string;      // Highest milestone tier reached
  
  // Status
  is_eligible: boolean;            // Meets eligibility requirements
  joined_at: string;
  last_activity_at: string;
  
  // Notifications sent
  notifications_sent: {
    type: string;
    sent_at: string;
  }[];
  
  updated_at: string;
}
```

### 2.2.9 CompetitionResult

```typescript
interface CompetitionResult {
  id: string;
  competition_id: string;
  
  // Winner info
  user_id: string;
  team_id?: string;
  final_rank: number;
  final_value: number;
  
  // Rule matched
  rule_id: string;
  rule_type: string;
  
  // Award
  reward_id?: string;
  points_awarded: number;
  badge_awarded?: string;
  
  // Fulfillment
  fulfillment_event_id?: string;
  fulfillment_status: string;
  
  created_at: string;
}
```

## 2.3 Supporting Collections

### MetricValue (Time-Series Snapshots)

```typescript
interface MetricValue {
  id: string;
  user_id: string;
  team_id?: string;
  metric_id: string;
  
  // Value
  value: number;
  
  // Time bucket
  period_type: "hour" | "day" | "week" | "month";
  period_start: string;
  period_end: string;
  
  // Context
  competition_id?: string;         // If captured for a specific competition
  
  created_at: string;
}
```

### CompetitionNotification

```typescript
interface CompetitionNotification {
  id: string;
  competition_id: string;
  user_id: string;
  
  type: 
    | "competition_started"
    | "rank_change"
    | "threshold_approaching"
    | "threshold_reached"
    | "milestone_reached"
    | "overtaken"
    | "competition_ending_soon"
    | "competition_ended"
    | "winner_announced"
    | "reward_sent";
  
  title: string;
  body: string;
  data: object;
  
  channels: ("in_app" | "push" | "email" | "sms")[];
  sent_at?: string;
  read_at?: string;
  
  created_at: string;
}
```

---

# Section 3: Core Flows and Logic

## 3.1 Admin Creates Competition from Template

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CREATE COMPETITION FROM TEMPLATE                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Admin navigates to Competitions → Templates                         │
│     └─ System displays template library (system + custom)               │
│                                                                         │
│  2. Admin clicks "Use Template" on desired template                     │
│     └─ System opens Create Competition modal                            │
│     └─ Modal pre-fills: metric, duration, rules, suggested rewards      │
│                                                                         │
│  3. Admin customizes:                                                   │
│     ├─ Name (e.g., "February Weekend Blitz")                           │
│     ├─ Start/End dates                                                  │
│     ├─ Eligibility rules (optional)                                     │
│     ├─ Reward selection from catalog                                    │
│     └─ Announcement text                                                │
│                                                                         │
│  4. Admin clicks "Create" or "Save as Draft"                           │
│     └─ System validates:                                                │
│        ├─ Dates are valid (start < end, not in past)                   │
│        ├─ Metric exists and is active                                   │
│        ├─ At least one rule defined                                     │
│        └─ Rewards have sufficient stock                                 │
│                                                                         │
│  5. System creates Competition document                                 │
│     ├─ Status: "scheduled" (if future) or "active" (if now)            │
│     ├─ Creates empty Participant documents for eligible users           │
│     └─ Increments template.times_used                                   │
│                                                                         │
│  6. If status = "active":                                               │
│     ├─ Send "competition_started" notifications                         │
│     ├─ Update Today/Leaderboard/Challenges views                        │
│     └─ Start metric value tracking                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3.2 Admin Saves Competition as New Template

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SAVE COMPETITION AS TEMPLATE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Admin views completed (or active) competition                       │
│     └─ Sees "Save as Template" action                                   │
│                                                                         │
│  2. Admin clicks "Save as Template"                                     │
│     └─ System opens template creation modal                             │
│                                                                         │
│  3. Modal pre-fills from competition:                                   │
│     ├─ Name (editable, suggests "Copy of X")                           │
│     ├─ Description                                                      │
│     ├─ Metric                                                           │
│     ├─ Duration (extracts day count)                                    │
│     ├─ Rules (generalized)                                              │
│     └─ Suggested rewards                                                │
│                                                                         │
│  4. Admin customizes template name/description                          │
│     └─ Optionally adjusts default values                                │
│                                                                         │
│  5. Admin clicks "Save Template"                                        │
│     └─ System creates CompetitionTemplate document                      │
│        ├─ is_system: false (user-created)                              │
│        ├─ created_by: current admin                                     │
│        └─ times_used: 0                                                 │
│                                                                         │
│  6. New template appears in template library                            │
│     └─ Can be used for future competitions                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3.3 System Evaluates Winners and Triggers Rewards

### 3.3.1 Real-Time Evaluation (Event-Driven)

```
┌─────────────────────────────────────────────────────────────────────────┐
│              EVENT-DRIVEN EVALUATION (On Metric Change)                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Trigger: New visit/appointment/contract/install created                │
│                                                                         │
│  1. Event published to "metric.updated" channel                         │
│     └─ Payload: { user_id, metric_slug, new_value, delta, timestamp }  │
│                                                                         │
│  2. Competition Engine receives event                                   │
│     └─ Queries active competitions using this metric                    │
│                                                                         │
│  3. For each relevant competition:                                      │
│     ├─ Find/create Participant for user                                │
│     ├─ Update participant.current_value                                 │
│     ├─ Recalculate rank (if individual) or team score (if team)        │
│     └─ Check rules:                                                     │
│                                                                         │
│  4. Rule evaluation:                                                    │
│     ├─ threshold: Did user just cross threshold?                       │
│     │   └─ YES: Add rule_id to qualified_rules, trigger notification   │
│     ├─ milestone: Did user reach new milestone tier?                   │
│     │   └─ YES: Update milestone_reached, trigger celebration          │
│     └─ top_n: Did rank change?                                         │
│         ├─ Moved UP: Trigger "you're now #X" notification              │
│         └─ Moved DOWN: Trigger "you've been overtaken" notification    │
│                                                                         │
│  5. Broadcast updates via WebSocket                                     │
│     └─ Clients update Today/Leaderboard/Challenges in real-time        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3.2 Scheduled Evaluation (End of Competition)

```
┌─────────────────────────────────────────────────────────────────────────┐
│              SCHEDULED EVALUATION (Competition End)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Trigger: Cron job at competition.end_date + 1 minute                   │
│                                                                         │
│  1. System queries competitions with status = "active"                  │
│     and end_date <= now                                                 │
│                                                                         │
│  2. For each competition to finalize:                                   │
│     ├─ Set status = "evaluating" (prevent further updates)             │
│     └─ Capture final metric values for all participants                │
│                                                                         │
│  3. Evaluate all rules in priority order:                               │
│     ├─ top_n: Get top N by final_value                                 │
│     ├─ threshold: Get all with final_value >= threshold                │
│     ├─ milestone: Get highest tier reached per participant             │
│     ├─ improvement: Compare to baseline, get improvers                 │
│     └─ lottery: Random select from qualifiers                          │
│                                                                         │
│  4. For each winner/qualifier:                                          │
│     ├─ Create CompetitionResult document                               │
│     ├─ Award points (add to user's total)                              │
│     ├─ Award badge (if configured)                                      │
│     └─ Create FulfillmentEvent for reward                              │
│                                                                         │
│  5. Trigger fulfillment:                                                │
│     ├─ manual: Set status = "pending", notify admin                    │
│     └─ api: Call provider, set status based on response                │
│                                                                         │
│  6. Send notifications:                                                 │
│     ├─ Winners: "Congratulations! You won X"                           │
│     ├─ Top N: "Competition ended. You finished #X"                     │
│     └─ All participants: "Competition completed. See results"          │
│                                                                         │
│  7. Set competition.status = "completed"                                │
│     └─ Store results summary                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3.4 Fulfillment Provider Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      FULFILLMENT FLOW                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FulfillmentEvent created with status = "pending"                       │
│                                                                         │
│  Provider Type: MANUAL                                                  │
│  ─────────────────────────────                                          │
│  1. Admin sees pending fulfillments in dashboard                        │
│  2. Admin clicks "Fulfill" → enters tracking/notes                      │
│  3. System sets status = "sent"                                         │
│  4. User receives "your reward is on the way" notification              │
│  5. Admin clicks "Mark Delivered" when confirmed                        │
│  6. System sets status = "delivered"                                    │
│                                                                         │
│  Provider Type: API (Future: Tremendous, Tango, etc.)                   │
│  ────────────────────────────────────────────────────                   │
│  1. System calls provider API:                                          │
│     POST /api/rewards                                                   │
│     { recipient_email, reward_sku, amount, message }                   │
│  2. Provider returns { order_id, status, delivery_url }                │
│  3. System sets status = "sent", stores provider_reference              │
│  4. User receives reward via provider's delivery method                 │
│  5. Provider webhook confirms delivery → status = "delivered"          │
│                                                                         │
│  Error Handling:                                                        │
│  ────────────────                                                       │
│  • API failure → status = "failed", alert admin                        │
│  • Retry logic: 3 attempts with exponential backoff                    │
│  • Fallback: Convert to manual fulfillment after max retries           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3.5 Rep Views: Today, Leaderboard, Challenges, Profile

### 3.5.1 Today Tab Integration

```
Rep opens Today tab:

1. System queries active competitions where user is participant
2. For each competition, render:
   ├─ Competition card (name, icon, time remaining)
   ├─ User's current value and rank
   ├─ Progress toward threshold/milestone (if applicable)
   ├─ Gap to next rank ("15 more doors to overtake Sarah")
   └─ Reward preview ("Win: $50 Amazon Gift Card")

3. Mission of the Day:
   └─ If competition has announcement_text, show as featured mission

4. Real-time updates via WebSocket:
   └─ Value/rank changes animate without refresh
```

### 3.5.2 Leaderboard Tab Integration

```
Rep opens Leaderboard tab:

1. System checks for active competitions with show_in_leaderboard = true
2. If active competition exists:
   ├─ Leaderboard defaults to competition metric
   ├─ Time filter locked to competition period
   └─ Competition banner shown at top

3. Leaderboard displays:
   ├─ Top 3 podium with avatars
   ├─ Full ranking with metric values
   ├─ User's row highlighted (sticky when scrolling)
   ├─ Rank change indicators (↑↓→)
   └─ Prize indicator for winning positions

4. Scope toggle (if team competition):
   └─ Individual | Team | Office

5. Real-time updates:
   └─ Rows animate on rank changes
```

### 3.5.3 Challenges Tab Integration

```
Rep opens Challenges tab:

1. Active Competitions section:
   ├─ All competitions with status = "active"
   ├─ Sorted by end_date (ending soonest first)
   └─ Each shows: name, progress, time remaining, reward

2. Upcoming Competitions section:
   ├─ Competitions with status = "scheduled"
   └─ "Starting in X days" countdown

3. Completed Competitions section:
   ├─ Recent completions (last 30 days)
   ├─ User's final rank and any rewards won
   └─ "View Results" button

4. Challenge card interactions:
   ├─ Tap to expand: Full rules, leaderboard preview, rewards
   └─ "Join Now" if not yet enrolled (for opt-in competitions)
```

### 3.5.4 Profile Tab Integration

```
Rep opens Profile tab:

1. Competition Stats section:
   ├─ Total competitions entered
   ├─ Total wins
   ├─ Win rate percentage
   └─ Total rewards value earned

2. Recent Wins section:
   ├─ Last 5 competition victories
   ├─ Each shows: competition name, rank, reward
   └─ Link to full history

3. Badges section:
   ├─ Badges earned from competitions highlighted
   └─ "Competition Winner" badge collection

4. Rewards History:
   ├─ All rewards earned
   ├─ Fulfillment status for each
   └─ Redeemable points balance
```

---

# Section 4: UX/Screen Breakdown

## 4.1 Admin: Competitions & Incentives Area

### 4.1.1 Main Navigation

```
/admin/incentives
├── /competitions          → Active & Recent Competitions
├── /competitions/new      → Create Competition
├── /competitions/:id      → Competition Detail + Results
├── /templates             → Template Library
├── /templates/new         → Create Template
├── /rewards               → Reward Catalog
├── /rewards/new           → Add Reward
├── /fulfillment           → Pending Fulfillments
├── /fulfillment/history   → Fulfillment History
└── /settings              → Providers, Metrics, Defaults
```

### 4.1.2 Competitions List Screen

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🏆 Competitions & Incentives                          [+ New Competition]│
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [Active] [Scheduled] [Completed] [All]                 🔍 Search        │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ ⚡ Weekend Blitz - February                          ACTIVE        │ │
│  │ 47 participants · Ends in 1d 6h · Metric: Doors                   │ │
│  │ Leader: Sarah M. (89 doors) · You: #4 (67 doors)                  │ │
│  │                                              [View] [Edit] [End]  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 🏆 Q1 Championship Ladder                            ACTIVE        │ │
│  │ 52 participants · Ends in 23d · Metric: Points                    │ │
│  │ Leader: Mike T. (4,250 pts) · You: #7 (2,890 pts)                │ │
│  │                                              [View] [Edit] [End]  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 🌟 March Madness                                     SCHEDULED     │ │
│  │ Starts Mar 1 · Duration: 31 days · Metric: Contracts              │ │
│  │                                             [View] [Edit] [Cancel]│ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  📊 Quick Stats                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │      2       │ │      1       │ │     47       │ │    $1,250    │   │
│  │   Active     │ │  Scheduled   │ │ Participants │ │  Rewards     │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.1.3 Create Competition Screen

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Back                Create Competition                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Start from Template (recommended)                                       │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                │
│  │   ⚡   │ │   🏆   │ │   🌟   │ │   🌪️   │ │   ⚔️   │                │
│  │Weekend │ │Monthly │ │New Rep │ │ Storm  │ │ Team   │                │
│  │ Blitz  │ │Ladder  │ │Sprint  │ │Response│ │Battle  │                │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘                │
│                                                                          │
│  ─────────────────── Or create from scratch ───────────────────         │
│                                                                          │
│  BASIC INFO                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Competition Name *                                                 │ │
│  │ [February Weekend Blitz                                    ]      │ │
│  │                                                                    │ │
│  │ Description                                                        │ │
│  │ [Hit 75 doors this weekend for a $50 gift card!           ]      │ │
│  │                                                                    │ │
│  │ Icon                    Banner Color                               │ │
│  │ [⚡ ▼]                  [█████ #F97316 ▼]                         │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  TIMING                                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Duration Type                                                      │ │
│  │ ○ Day  ○ Weekend  ● Week  ○ Month  ○ Custom                       │ │
│  │                                                                    │ │
│  │ Start Date              End Date                                   │ │
│  │ [Feb 7, 2026 ▼]        [Feb 14, 2026 ▼]                          │ │
│  │                                                                    │ │
│  │ Timezone: America/Denver                                           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  METRIC & SCOPE                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Metric *                          Scope *                          │ │
│  │ [Doors Knocked ▼]                 ● Individual ○ Team ○ Company   │ │
│  │                                                                    │ │
│  │ Team Grouping (if Team scope)                                      │ │
│  │ ○ Office  ○ Crew  ○ Region  ○ Custom                              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  RULES                                                      [+ Add Rule] │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Rule 1: Threshold                                          [×]    │ │
│  │ Anyone who reaches [75] doors wins                                │ │
│  │ Reward: [$50 Amazon Gift Card ▼]                                  │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ Rule 2: Top Performers                                     [×]    │ │
│  │ Top [3] performers also win:                                      │ │
│  │ 1st: [$100 Gift Card ▼]  2nd: [$50 ▼]  3rd: [$25 ▼]             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ELIGIBILITY (Optional)                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ ☑ All active users                                                │ │
│  │ ☐ Minimum tenure: [   ] days                                      │ │
│  │ ☐ Specific teams only: [Select teams...]                          │ │
│  │ ☐ Specific roles only: [Select roles...]                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│                        [Save as Draft]  [Create Competition]             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.1.4 Competition Detail Screen

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Back to Competitions                                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ⚡ Weekend Blitz - February                                    ACTIVE  │
│  Hit 75 doors this weekend for a $50 gift card!                         │
│  Feb 7-9, 2026 · 1d 6h remaining · Doors · Individual                   │
│                                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │     47       │ │     12       │ │     89       │ │    $600      │   │
│  │ Participants │ │  Qualified   │ │  Top Score   │ │ Rewards Pool │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                                          │
│  [Leaderboard] [Qualifiers] [Rules] [Settings]                          │
│                                                                          │
│  LIVE LEADERBOARD                                          Auto-refresh │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ # │ Rep          │ Team     │ Doors │ Status     │ Reward         │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ 1 │ 🥇 Sarah M.  │ Denver   │  89   │ Qualified  │ $100 (1st)     │ │
│  │ 2 │ 🥈 Mike T.   │ Boulder  │  82   │ Qualified  │ $50 (2nd)      │ │
│  │ 3 │ 🥉 Jake R.   │ Denver   │  78   │ Qualified  │ $25 (3rd)      │ │
│  │ 4 │    Lisa K.   │ Springs  │  76   │ Qualified  │ $50 (threshold)│ │
│  │ 5 │    Tom W.    │ Denver   │  75   │ Qualified  │ $50 (threshold)│ │
│  │ 6 │    Amy P.    │ Boulder  │  72   │ 3 to go    │ -              │ │
│  │...│              │          │       │            │                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ACTIONS                                                                 │
│  [Edit Competition] [End Early] [Duplicate] [Save as Template]          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## 4.2 Rep Views: Mobile Harvest Tabs

### 4.2.1 Today Tab (Competition Integration)

```
┌────────────────────────────┐
│ Today's Progress           │
│ Thu, Feb 6                 │
├────────────────────────────┤
│                            │
│      ┌───────────┐         │
│      │    67     │         │
│      │  of 75    │         │
│      │  doors    │         │
│      └───────────┘         │
│      ████████████░░  89%   │
│                            │
│ 🔥 8 more to qualify!      │
│                            │
├────────────────────────────┤
│ ⚡ ACTIVE COMPETITION      │
│ ┌────────────────────────┐ │
│ │ Weekend Blitz          │ │
│ │ Ends in 1d 6h          │ │
│ │                        │ │
│ │ Your Rank: #4          │ │
│ │ 67 doors (75 to win)   │ │
│ │                        │ │
│ │ Prize: $50 Gift Card   │ │
│ │ [View Leaderboard →]   │ │
│ └────────────────────────┘ │
│                            │
├────────────────────────────┤
│ 📊 Today's Stats           │
│ ┌────┐ ┌────┐ ┌────┐      │
│ │ 23 │ │  2 │ │  0 │      │
│ │Door│ │Appt│ │Sign│      │
│ └────┘ └────┘ └────┘      │
│                            │
├────────────────────────────┤
│ 🎯 Daily Challenges        │
│ • 25 doors today   ████░ 92%│
│ • 3 appointments   ██░░░ 67%│
│                            │
└────────────────────────────┘
```

### 4.2.2 Leaderboard Tab (Competition Mode)

```
┌────────────────────────────┐
│ ⚡ Weekend Blitz           │
│ Ends in 1d 6h              │
├────────────────────────────┤
│                            │
│      🥇         🥈    🥉   │
│     Sarah      Mike  Jake  │
│      89        82    78    │
│                            │
├────────────────────────────┤
│ 🏆 Leaderboard             │
│ ┌────────────────────────┐ │
│ │ 1  Sarah M.    89  +$100│ │
│ │ 2  Mike T.     82  +$50 │ │
│ │ 3  Jake R.     78  +$25 │ │
│ │ 4  Lisa K.     76  ✓$50 │ │
│ │ ─────────────────────── │ │
│ │ 5  ★ YOU ★     67  8→   │ │
│ │ ─────────────────────── │ │
│ │ 6  Amy P.      65       │ │
│ │ 7  Tom W.      61       │ │
│ │ ...                     │ │
│ └────────────────────────┘ │
│                            │
│ ✓ = Qualified for $50     │
│ 8→ = 8 more to qualify    │
│                            │
├────────────────────────────┤
│ [Day] [Week] [Month]       │
│ [All] [My Team]            │
│                            │
└────────────────────────────┘
```

### 4.2.3 Challenges Tab (Competition Cards)

```
┌────────────────────────────┐
│ Challenges                 │
├────────────────────────────┤
│                            │
│ 🔥 ACTIVE (2)              │
│                            │
│ ┌────────────────────────┐ │
│ │ ⚡ Weekend Blitz        │ │
│ │ 75 doors = $50 card    │ │
│ │ ████████████░░  67/75  │ │
│ │ Ends: 1d 6h            │ │
│ │ [View Details]         │ │
│ └────────────────────────┘ │
│                            │
│ ┌────────────────────────┐ │
│ │ 🏆 Q1 Championship     │ │
│ │ Top 10 win prizes      │ │
│ │ Your Rank: #7          │ │
│ │ Ends: 23 days          │ │
│ │ [View Details]         │ │
│ └────────────────────────┘ │
│                            │
│ 📅 UPCOMING (1)            │
│                            │
│ ┌────────────────────────┐ │
│ │ 🌟 March Madness       │ │
│ │ Starts: Mar 1          │ │
│ │ 31 days · Contracts    │ │
│ │ [Set Reminder]         │ │
│ └────────────────────────┘ │
│                            │
│ ✅ COMPLETED (3)           │
│ [View Past Competitions →] │
│                            │
└────────────────────────────┘
```

### 4.2.4 Profile Tab (Competition History)

```
┌────────────────────────────┐
│ Profile                    │
├────────────────────────────┤
│       ┌─────────┐          │
│       │  🏆 👤  │          │
│       └─────────┘          │
│       Sarah Mitchell       │
│       Senior Canvasser     │
│                            │
├────────────────────────────┤
│ 🎮 Competition Stats       │
│ ┌──────┐ ┌──────┐ ┌──────┐│
│ │  12  │ │   5  │ │ 42%  ││
│ │Entered│ │ Wins │ │Win % ││
│ └──────┘ └──────┘ └──────┘│
│                            │
│ Total Rewards: $475        │
│                            │
├────────────────────────────┤
│ 🏅 Recent Wins             │
│                            │
│ • Weekend Blitz (Jan 27)   │
│   🥇 1st Place - $100      │
│                            │
│ • New Year Sprint          │
│   ✓ Qualified - $50        │
│                            │
│ • Holiday Challenge        │
│   🥉 3rd Place - $25       │
│                            │
│ [View All History →]       │
│                            │
├────────────────────────────┤
│ 🎖️ Competition Badges      │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐       │
│ │🏆│ │⚡│ │🔥│ │🎯│ +4    │
│ └──┘ └──┘ └──┘ └──┘       │
│                            │
└────────────────────────────┘
```

---

# Section 5: Phased Implementation Plan

## Phase 0: Foundation (Current State)
✅ Already implemented in Harvest:
- Basic campaigns with time windows
- Threshold and top_n rules
- Rewards catalog
- Points system
- Badges

## Phase 1: Config-Driven Rules Engine (Week 1-2)

| # | Task | Area | Description |
|---|------|------|-------------|
| 1 | Create Metric collection | backend | Define metrics with source_collection, aggregation, scoping |
| 2 | Seed system metrics | backend | doors, appointments, contracts, installs, points, revenue |
| 3 | Refactor Competition model | backend | Add metric_id, rules array, eligibility object |
| 4 | Build IncentiveRule evaluator | backend | Generic rule evaluation: threshold, top_n, milestone |
| 5 | Create metric value tracker | backend | Service to calculate metric values for any user/team |
| 6 | Add event-driven updates | backend | On visit/appointment/contract, publish metric.updated event |

## Phase 2: Templates System (Week 2-3)

| # | Task | Area | Description |
|---|------|------|-------------|
| 7 | Create CompetitionTemplate model | backend | Full template schema with defaults |
| 8 | Seed system templates | backend | 7 built-in templates (blitz, ladder, sprint, etc.) |
| 9 | Build "Create from Template" API | backend | POST /competitions/from-template/:id |
| 10 | Build "Save as Template" API | backend | POST /templates from competition |
| 11 | Admin Templates UI | frontend | Template library with cards, use buttons |
| 12 | Template usage tracking | backend | Increment times_used, last_used_at |

## Phase 3: Enhanced Admin Console (Week 3-4)

| # | Task | Area | Description |
|---|------|------|-------------|
| 13 | Redesign Create Competition flow | frontend | Template picker → form with pre-fills |
| 14 | Add Rules builder UI | frontend | Visual rule configuration (threshold, top_n, milestone) |
| 15 | Add Eligibility builder UI | frontend | Tenure, teams, roles filters |
| 16 | Competition Detail dashboard | frontend | Live leaderboard, qualifiers list, stats |
| 17 | Bulk actions | frontend | End multiple, duplicate, export results |

## Phase 4: Rep Experience Enhancement (Week 4-5)

| # | Task | Area | Description |
|---|------|------|-------------|
| 18 | Today tab competition cards | frontend | Active competitions with progress |
| 19 | Leaderboard competition mode | frontend | Auto-switch to competition metric when active |
| 20 | Challenges tab competition list | frontend | Active, upcoming, completed sections |
| 21 | Profile competition stats | frontend | Entries, wins, win rate, rewards total |
| 22 | Real-time updates (WebSocket) | backend+frontend | Rank changes, threshold crossings |
| 23 | Competition notifications | backend | Started, rank change, threshold approaching, ended |

## Phase 5: Advanced Rules & Fulfillment (Week 5-6)

| # | Task | Area | Description |
|---|------|------|-------------|
| 24 | Milestone rules | backend | Multiple tiers with separate rewards |
| 25 | Improvement rules | backend | Beat baseline by X% |
| 26 | Lottery rules | backend | Random draw from qualifiers |
| 27 | Team competitions | backend | Team aggregation, team leaderboards |
| 28 | FulfillmentProvider abstraction | backend | Interface for manual + future API providers |
| 29 | Fulfillment dashboard | frontend | Pending queue, process, history |
| 30 | Delivery notifications | backend | Reward sent, delivered confirmations |

## Phase 6: Polish & Scale (Week 6-7)

| # | Task | Area | Description |
|---|------|------|-------------|
| 31 | Competition end evaluation job | backend | Scheduled job for automatic finalization |
| 32 | Results archive | backend | Store final results for historical queries |
| 33 | Analytics dashboard | frontend | Competition performance, engagement metrics |
| 34 | Custom metrics UI | frontend | Admin can define new metrics |
| 35 | Bulk notification settings | frontend | Control what notifications reps receive |
| 36 | Mobile optimizations | frontend | Touch gestures, offline support |

## Future: External Fulfillment Partners

| # | Provider | Integration Type | Status |
|---|----------|------------------|--------|
| F1 | Tremendous | API | Planned |
| F2 | Tango Card | API | Planned |
| F3 | SwagUp (merch) | API | Planned |
| F4 | Custom webhook | Webhook | Planned |

---

# Summary

This specification transforms Eden's Harvest gamification from a basic points/badges system into a **full Enzy-style incentives platform**:

1. **Any KPI** can be used for competitions (doors, appointments, contracts, revenue, custom)
2. **Templates** enable one-click competition creation without code changes
3. **Flexible rules** support threshold, top_n, milestone, improvement, and lottery mechanics
4. **Pluggable fulfillment** starts simple (manual) but is architected for API partners
5. **Omnipresent recognition** integrates competitions into Today, Leaderboard, Challenges, and Profile
6. **Real-time updates** keep reps engaged with live rank changes and notifications

The phased approach allows shipping value incrementally while building toward full Enzy feature parity.

---

*Eden Claims Platform — Stewardship and Excellence in Claims Handling*

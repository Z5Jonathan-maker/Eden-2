# Eden Incentives Engine — Enzy-Level Specification v2
## Full-Stack Competition & Rewards Platform for Harvest
**Version:** 2.0 | **Date:** December 2025

---

# Section 1 — Vision (Enzy-Level)

## 1.1 The Vision

Eden's Incentives Engine transforms every door knocked, every appointment set, and every contract signed into a **moment in an ongoing story of achievement**. This isn't gamification bolted onto a CRM—it's a **continuous competition platform** where sales reps wake up knowing exactly what they're playing for, how close they are to winning, and who they're competing against.

**The core promise:** Any KPI. Any timeframe. Any reward. All configurable without code.

### What Makes This Enzy-Level

| Enzy Feature | Eden Implementation |
|--------------|---------------------|
| Always-on Seasons | `Season` entity groups competitions into 90-day campaigns with cumulative points |
| Any KPI Competition | `Metric` entity abstracts all trackable events (doors, appointments, revenue, custom) |
| Templates Library | `CompetitionTemplate` collection enables one-click launches |
| Real-time Leaderboards | WebSocket updates push rank changes instantly to all participants |
| Automated Fulfillment | `FulfillmentProvider` abstraction ready for Tremendous/Tango/SwagUp |
| Team Battles | `scope: team` with aggregation by office, crew, region, or custom groups |
| Milestone Chains | Multiple reward tiers within single competition (bronze → silver → gold) |
| Recognition Everywhere | Today, Leaderboard, Challenges, Profile all pull from unified competition state |

## 1.2 The Emotional Design

**The feeling we're creating:**

- **Morning:** "I'm 8 doors from the daily bonus. The weekend blitz starts tomorrow. I'm currently #6 but Sarah is only 12 doors ahead."
- **Midday:** "Challenge complete! I just unlocked 'First Fruits'—my first signed contract this season. Push notification: 'Jake just passed you on the ladder.'"
- **Evening:** "Daily summary: 67 doors, 3 appointments, 1 contract. 850 points today. I moved from #6 to #4. 200 more points to redeem AirPods."

**The cultural shift:** Competitions aren't random spiffs announced in Slack. They're **seasons**—continuous periods where effort compounds. Every action contributes to multiple simultaneous objectives:
- Daily challenges (micro-wins)
- Weekly competitions (medium stakes)
- Season ladder (long game)
- Personal milestones (badges, streaks)

## 1.3 Core Principles

### 1.3.1 Any KPI, Any Timeframe
- **Metric-agnostic:** Competitions can target doors, appointments, contracts, installs, reviews, referrals, training completions, or any custom metric
- **Flexible time windows:** Day, weekend, week, month, quarter, season, or custom date range
- **Compound metrics:** Support ratios (e.g., "appointment-to-contract rate") and weighted combinations
- **Event-driven:** Every relevant action triggers re-evaluation in real-time

### 1.3.2 Individual + Team + Company-Wide Scopes
- **Individual:** Classic "top rep wins" or "hit X threshold, everyone who qualifies wins"
- **Team:** Office vs. office, crew vs. crew, region vs. region with aggregated scores
- **Hybrid:** Individual performance contributes to team score; both layers rewarded
- **Company:** Everyone works toward a shared goal with collective reward

### 1.3.3 Templates as First-Class Citizens
- Admins save successful competitions as templates
- Templates include: metric, duration, rules, suggested prizes, messaging, visual theme
- One-click launch: "Run Weekend Blitz again" or "Start Q2 Ladder from template"
- Templates track usage stats for optimization

### 1.3.4 Pluggable Fulfillment
- **Phase 1:** Manual fulfillment with admin notification queue
- **Phase 2:** Abstract `FulfillmentProvider` interface for future API partners
- **Future:** Tremendous, Tango Card, SwagUp integration with automated delivery
- **Always:** Audit trail of every reward promised and delivered

### 1.3.5 Seasons Over Random Spiffs
- Competitions grouped into **Seasons** (typically quarterly)
- Season points accumulate across all competitions
- Season-end recognition: "Q1 2026 Champion"
- Creates narrative arc and sustained engagement vs. disconnected one-offs

---

# Section 2 — Final Data Model

## 2.1 Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Season      │     │     Metric      │     │FulfillmentProvider│
│ (grouping layer)│     │  (KPI types)    │     │(reward delivery) │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ CompetitionTemplate│   │   Competition   │◄───│     Reward      │
│(reusable blueprints)│  │(active instance)│     │ (prize catalog) │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ creates               │ has many              │
         ▼                       ▼                       ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │ IncentiveRule   │     │  RewardTier     │
                        │(win conditions) │     │ (prize levels)  │
                        └────────┬────────┘     └─────────────────┘
                                 │
                                 │ evaluates
                                 ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    TeamGroup    │     │  Participant    │     │FulfillmentEvent │
│(org structure)  │────▶│(user + progress)│────▶│(reward delivery)│
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 │ earns
                                 ▼
                        ┌─────────────────┐
                        │CompetitionResult│
                        │(final standings)│
                        └─────────────────┘
```

## 2.2 Core Entities

### 2.2.1 Season

**Purpose:** Groups competitions into time-bounded campaigns. Creates narrative arc ("Q1 Season") and enables cumulative rankings.

```typescript
interface Season {
  id: string;
  name: string;                    // "Q1 2026 Storm Season"
  description: string;
  
  // Timing
  start_date: string;              // ISO datetime
  end_date: string;
  status: "upcoming" | "active" | "completed";
  
  // Theme
  theme_name: string;              // "Thunder & Lightning"
  theme_color: string;             // "#6366F1"
  banner_image_url?: string;
  
  // Cumulative tracking
  points_multiplier: number;       // Season-wide multiplier (default 1.0)
  
  // Relationships
  competition_ids: string[];       // Competitions in this season
  
  // Results (populated at end)
  final_standings?: SeasonStanding[];
  champion_user_id?: string;
  
  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface SeasonStanding {
  rank: number;
  user_id: string;
  total_points: number;
  competitions_entered: number;
  competitions_won: number;
}
```

**Relationships:**
- One Season → Many Competitions (one-to-many)
- One Season → Many SeasonStandings (one-to-many)

### 2.2.2 Metric

**Purpose:** Defines trackable KPIs with aggregation logic. The building block for all competitions.

```typescript
interface Metric {
  id: string;
  slug: string;                    // "doors", "appointments", "close_rate"
  name: string;                    // "Doors Knocked"
  description: string;
  
  // Calculation
  source_collection: string;       // "harvest_visits", "appointments"
  source_field?: string;           // Field to count/sum (null for count)
  aggregation: "count" | "sum" | "avg" | "max" | "ratio";
  filter_query?: object;           // MongoDB filter (e.g., {status: "SG"})
  
  // For ratio metrics (e.g., close rate = contracts / appointments)
  numerator_metric_id?: string;
  denominator_metric_id?: string;
  
  // Display
  icon: string;                    // "🚪", "📅", "$"
  unit: string;                    // "doors", "appointments", "$", "%"
  format: "integer" | "decimal" | "currency" | "percentage";
  
  // Scoping capabilities
  supports_individual: boolean;
  supports_team: boolean;
  supports_company: boolean;
  
  // Admin
  is_system: boolean;              // Built-in vs. custom
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

**Seed Metrics (10 Core):**

| Slug | Name | Source | Aggregation | Unit |
|------|------|--------|-------------|------|
| doors | Doors Knocked | harvest_visits | count | doors |
| contacts | Contacts Made | harvest_visits (NI+CB+AP+SG) | count | contacts |
| appointments | Appointments Set | harvest_visits (AP) | count | appts |
| contracts | Contracts Signed | harvest_visits (SG) | count | contracts |
| installs | Installs Completed | installs | count | installs |
| reviews | Reviews Collected | reviews | count | reviews |
| referrals | Referrals Generated | referrals | count | referrals |
| revenue | Revenue Generated | contracts.value | sum | $ |
| close_rate | Close Rate | appointments → contracts | ratio | % |
| points | Harvest Points | harvest_score_events | sum | pts |

**Relationships:**
- One Metric → Many Competitions (one-to-many)
- Ratio Metrics reference two other Metrics (self-referential)

### 2.2.3 CompetitionTemplate

**Purpose:** Reusable blueprints for competitions. Enables one-click launches without rebuilding configuration.

```typescript
interface CompetitionTemplate {
  id: string;
  name: string;                    // "Weekend Blitz"
  description: string;
  tagline: string;                 // "75 doors = $50 guaranteed"
  
  // Default configuration
  default_metric_id: string;
  default_duration_type: "day" | "weekend" | "week" | "month" | "quarter" | "custom";
  default_duration_days?: number;
  
  // Scope
  default_scope: "individual" | "team" | "company";
  default_team_grouping?: "office" | "crew" | "region" | "custom";
  
  // Rules template (array of rule configs)
  default_rules: IncentiveRuleConfig[];
  
  // Suggested rewards
  suggested_reward_ids: string[];
  suggested_points_bonus: number;
  
  // Visual
  icon: string;                    // "⚡", "🏆", "🌟"
  banner_color: string;            // "#F97316"
  category: "sprint" | "ladder" | "threshold" | "team_battle" | "milestone" | "lottery";
  
  // Usage tracking
  times_used: number;
  last_used_at?: string;
  avg_participation_rate?: number;
  
  // Admin
  is_system: boolean;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface IncentiveRuleConfig {
  type: "top_n" | "threshold" | "milestone" | "improvement" | "lottery";
  config: object;                  // Type-specific configuration
  reward_config: {
    reward_id?: string;
    points_award?: number;
    badge_id?: string;
  };
}
```

**Seed Templates (7 Built-In):**

| Name | Duration | Metric | Category | Rule Type | Description |
|------|----------|--------|----------|-----------|-------------|
| Daily Sprint | 1 day | doors | sprint | threshold | Hit X doors today |
| Weekend Blitz | 3 days | doors | threshold | threshold + top_n | Weekend door push |
| Weekly Ladder | 7 days | points | ladder | top_n | Weekly ranking |
| Monthly Championship | 30 days | revenue | ladder | top_n | Monthly big stakes |
| Office Battle | 7 days | doors | team_battle | top_n | Team competition |
| New Rep Challenge | 14 days | appointments | milestone | milestone | Onboarding journey |
| Storm Response | custom | contracts | sprint | top_n + threshold | Post-storm activation |

**Relationships:**
- One Template → Many Competitions (one-to-many)

### 2.2.4 Competition

**Purpose:** Active competition instance. Created from template or from scratch.

```typescript
interface Competition {
  id: string;
  template_id?: string;            // If created from template
  season_id?: string;              // If part of a season
  
  // Identity
  name: string;
  description: string;
  tagline: string;                 // Short hook for cards
  
  // Visual
  icon: string;
  banner_color: string;
  banner_image_url?: string;
  
  // Timing
  start_date: string;              // ISO datetime
  end_date: string;
  timezone: string;                // "America/Denver"
  status: "draft" | "scheduled" | "active" | "evaluating" | "completed" | "cancelled";
  
  // Metric
  metric_id: string;
  metric_snapshot?: Metric;        // Denormalized for historical accuracy
  
  // Scope
  scope: "individual" | "team" | "company";
  team_grouping?: "office" | "crew" | "region" | "custom";
  custom_team_ids?: string[];
  
  // Eligibility
  eligibility: CompetitionEligibility;
  
  // Rules
  rules: IncentiveRule[];
  
  // Rewards
  reward_pool: CompetitionReward[];
  points_bonus: number;            // Participation points
  
  // Display settings
  show_in_today: boolean;
  show_in_leaderboard: boolean;
  show_in_challenges: boolean;
  show_real_time_updates: boolean;
  announcement_text?: string;
  
  // Participation
  participant_count: number;
  qualified_count: number;
  
  // Results (populated after evaluation)
  results?: CompetitionResult[];
  evaluated_at?: string;
  
  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CompetitionEligibility {
  all_users: boolean;
  min_tenure_days?: number;
  max_tenure_days?: number;        // For "new rep" competitions
  required_role_ids?: string[];
  required_team_ids?: string[];
  excluded_user_ids?: string[];
  requires_opt_in: boolean;        // Must explicitly join
}

interface CompetitionReward {
  rank_or_tier: string;            // "1", "2", "3" or "threshold" or "gold"
  reward_id: string;
  quantity: number;
}
```

**Relationships:**
- One Competition → One Template (optional, many-to-one)
- One Competition → One Season (optional, many-to-one)
- One Competition → One Metric (many-to-one)
- One Competition → Many IncentiveRules (one-to-many)
- One Competition → Many Participants (one-to-many)
- One Competition → Many CompetitionResults (one-to-many)

### 2.2.5 IncentiveRule

**Purpose:** Defines win conditions within a competition. Supports multiple rule types for flexible incentive design.

```typescript
interface IncentiveRule {
  id: string;
  competition_id: string;
  
  // Rule type
  type: "top_n" | "threshold" | "milestone" | "improvement" | "lottery";
  
  // Priority (evaluation order)
  priority: number;
  
  // Type-specific configuration
  
  // top_n: Top N performers win
  top_n?: number;
  top_n_per_team?: boolean;        // Top N per team, not overall
  tiebreaker?: "first_to_reach" | "secondary_metric" | "random";
  secondary_metric_id?: string;
  
  // threshold: Anyone hitting value qualifies
  threshold_value?: number;
  threshold_operator?: "gte" | "gt" | "eq";
  max_winners?: number;            // Cap winners (first N to qualify)
  
  // milestone: Multiple tiers
  milestones?: MilestoneConfig[];
  
  // improvement: Beat baseline by X%
  improvement_percent?: number;
  baseline_period?: "last_week" | "last_month" | "last_quarter" | "last_competition";
  baseline_metric_id?: string;     // Can compare different metrics
  
  // lottery: Random draw from qualifiers
  lottery_qualifier_threshold?: number;
  lottery_winner_count?: number;
  lottery_drawn_at?: string;
  lottery_seed?: string;           // For reproducibility
  
  // Reward mapping
  reward_id?: string;              // Single reward for this rule
  reward_tiers?: RewardTierConfig[];
  points_award?: number;
  badge_id?: string;
  
  // Display
  display_name?: string;           // "Gold Tier", "Top 3"
  display_description?: string;
  
  created_at: string;
}

interface MilestoneConfig {
  tier: string;                    // "bronze", "silver", "gold", "diamond"
  value: number;
  reward_id?: string;
  points_award?: number;
  badge_id?: string;
  icon?: string;
  color?: string;
}

interface RewardTierConfig {
  rank: number;                    // 1, 2, 3
  reward_id: string;
  bonus_points?: number;
}
```

**Relationships:**
- One IncentiveRule → One Competition (many-to-one)
- One IncentiveRule → One Reward (optional, many-to-one)

### 2.2.6 Reward

**Purpose:** Prize catalog item. Can be physical, digital, or internal (PTO, points).

```typescript
interface Reward {
  id: string;
  name: string;
  description: string;
  
  // Type
  type: "gift_card" | "merchandise" | "experience" | "cash" | "pto" | "points" | "badge" | "custom";
  
  // Value
  value_cents?: number;            // Monetary value for reporting
  points_value?: number;           // If type is "points"
  badge_id?: string;               // If type is "badge"
  
  // Fulfillment
  fulfillment_provider_id: string;
  fulfillment_sku?: string;        // SKU for automated fulfillment
  requires_shipping: boolean;
  requires_approval: boolean;      // Admin must approve before fulfillment
  
  // Inventory
  stock_quantity?: number;         // null = unlimited
  stock_reserved: number;          // Currently reserved for pending competitions
  max_per_user_per_month?: number;
  
  // Display
  image_url?: string;
  thumbnail_url?: string;
  icon: string;
  
  // Availability
  is_active: boolean;
  is_featured: boolean;
  available_from?: string;
  available_until?: string;
  
  // Categories for filtering
  categories: string[];            // ["gift_card", "tech", "featured"]
  
  created_at: string;
  updated_at: string;
}
```

**Relationships:**
- One Reward → One FulfillmentProvider (many-to-one)
- One Reward → Many IncentiveRules (one-to-many)

### 2.2.7 RewardTier (Optional Enhancement)

**Purpose:** Defines tiered rewards within a single reward item (e.g., $25/$50/$100 gift card options).

```typescript
interface RewardTier {
  id: string;
  reward_id: string;
  
  tier_name: string;               // "Bronze", "Silver", "Gold"
  value_cents: number;
  fulfillment_sku?: string;
  
  display_order: number;
}
```

### 2.2.8 FulfillmentProvider

**Purpose:** Abstracts reward delivery. Starts manual, designed for API partners.

```typescript
interface FulfillmentProvider {
  id: string;
  name: string;                    // "Manual", "Tremendous", "Tango Card"
  type: "manual" | "api" | "webhook" | "internal";
  
  // Configuration (encrypted in DB)
  config: {
    api_url?: string;
    api_key_encrypted?: string;
    webhook_url?: string;
    callback_secret?: string;
  };
  
  // Capabilities
  supported_reward_types: string[];
  supports_bulk_fulfillment: boolean;
  supports_instant_delivery: boolean;
  supports_physical_shipping: boolean;
  
  // Status
  is_active: boolean;
  last_health_check?: string;
  health_status?: "healthy" | "degraded" | "down";
  
  // Rate limits
  rate_limit_per_hour?: number;
  rate_limit_per_day?: number;
  
  created_at: string;
  updated_at: string;
}
```

**Initial Providers:**

| ID | Name | Type | Description |
|----|------|------|-------------|
| manual | Manual Fulfillment | manual | Admin reviews and fulfills manually |
| internal_points | Internal Points | internal | Automatically credits user points |
| internal_badge | Internal Badge | internal | Automatically awards badge |
| notification | Notification Only | manual | Congratulates, manager handles rest |

### 2.2.9 FulfillmentEvent

**Purpose:** Tracks each reward delivery from request to completion.

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
  reward_snapshot: Reward;         // Denormalized for history
  value_cents: number;
  
  // Fulfillment
  provider_id: string;
  status: "pending_approval" | "approved" | "processing" | "sent" | "delivered" | "failed" | "cancelled" | "refunded";
  
  // Approval workflow
  requires_approval: boolean;
  approved_by?: string;
  approved_at?: string;
  denial_reason?: string;
  
  // Provider interaction
  provider_reference?: string;     // External tracking ID
  provider_request?: object;       // What we sent
  provider_response?: object;      // What they returned
  
  // Delivery
  delivery_method?: "email" | "physical" | "in_app" | "sms";
  delivery_address?: object;
  delivery_email?: string;
  tracking_number?: string;
  tracking_url?: string;
  
  // Timeline
  created_at: string;
  processed_at?: string;
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  failure_reason?: string;
  
  // Manual fulfillment
  fulfilled_by?: string;
  fulfillment_notes?: string;
  
  // Retry handling
  retry_count: number;
  next_retry_at?: string;
}
```

**Relationships:**
- One FulfillmentEvent → One Competition (many-to-one)
- One FulfillmentEvent → One Participant (many-to-one)
- One FulfillmentEvent → One Reward (many-to-one)
- One FulfillmentEvent → One FulfillmentProvider (many-to-one)

### 2.2.10 Participant

**Purpose:** Tracks individual user's state within a competition.

```typescript
interface Participant {
  id: string;
  competition_id: string;
  user_id: string;
  team_id?: string;                // For team competitions
  
  // Current state
  current_value: number;           // Current metric value
  previous_value: number;          // For delta tracking
  rank?: number;                   // Current rank
  previous_rank?: number;          // For rank change detection
  percentile?: number;             // Top X%
  
  // Progress tracking
  value_at_start: number;          // Baseline when joined
  peak_value: number;              // Highest value reached
  peak_rank: number;               // Best rank reached
  
  // Qualification
  qualified_rules: string[];       // Rule IDs qualified for
  milestone_reached?: string;      // Highest milestone tier
  improvement_percent?: number;    // For improvement rules
  
  // Engagement
  is_eligible: boolean;
  opted_in: boolean;               // For opt-in competitions
  joined_at: string;
  last_activity_at: string;
  activity_count: number;          // Number of metric events
  
  // Notifications sent (avoid spam)
  notifications_sent: NotificationRecord[];
  
  updated_at: string;
}

interface NotificationRecord {
  type: string;
  sent_at: string;
  data?: object;
}
```

**Relationships:**
- One Participant → One Competition (many-to-one)
- One Participant → One User (many-to-one)
- One Participant → One TeamGroup (optional, many-to-one)

### 2.2.11 CompetitionResult

**Purpose:** Immutable record of final standings and awards.

```typescript
interface CompetitionResult {
  id: string;
  competition_id: string;
  
  // Standings
  user_id: string;
  team_id?: string;
  final_rank: number;
  final_value: number;
  final_percentile: number;
  
  // Rule matched
  rule_id: string;
  rule_type: string;
  qualification_reason: string;    // "Top 3", "Threshold: 75+", "Gold Tier"
  
  // Awards
  reward_id?: string;
  reward_name?: string;
  reward_value_cents?: number;
  points_awarded: number;
  badge_id?: string;
  badge_name?: string;
  
  // Fulfillment link
  fulfillment_event_id?: string;
  fulfillment_status: string;
  
  // Timestamps
  created_at: string;
  awarded_at?: string;
}
```

**Relationships:**
- One CompetitionResult → One Competition (many-to-one)
- One CompetitionResult → One Participant (one-to-one)
- One CompetitionResult → One FulfillmentEvent (optional, one-to-one)

### 2.2.12 TeamGroup

**Purpose:** Organizational unit for team competitions. Flexible enough for offices, crews, regions, or custom groups.

```typescript
interface TeamGroup {
  id: string;
  name: string;
  description?: string;
  
  // Type
  group_type: "office" | "crew" | "region" | "custom";
  
  // Hierarchy
  parent_team_id?: string;         // For nested structures
  
  // Members
  member_user_ids: string[];
  manager_user_ids: string[];
  
  // Display
  icon?: string;
  color?: string;
  
  // Stats (denormalized for performance)
  member_count: number;
  
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

**Relationships:**
- One TeamGroup → Many Users (many-to-many via member_user_ids)
- One TeamGroup → One Parent TeamGroup (optional, self-referential)

## 2.3 Supporting Collections

### 2.3.1 MetricValue (Time-Series Cache)

**Purpose:** Pre-aggregated metric values for fast leaderboard queries.

```typescript
interface MetricValue {
  id: string;
  user_id: string;
  team_id?: string;
  metric_id: string;
  
  // Value
  value: number;
  delta: number;                   // Change from last period
  
  // Time bucket
  period_type: "hour" | "day" | "week" | "month" | "quarter" | "year";
  period_start: string;
  period_end: string;
  
  // Context
  competition_id?: string;
  season_id?: string;
  
  created_at: string;
  updated_at: string;
}
```

### 2.3.2 MetricEvent (Raw Events)

**Purpose:** Individual metric-affecting events for audit and replay.

```typescript
interface MetricEvent {
  id: string;
  user_id: string;
  metric_id: string;
  
  // Event
  event_type: string;              // "visit_logged", "contract_signed"
  source_collection: string;
  source_document_id: string;
  
  // Value
  value: number;
  
  // Context
  competition_ids?: string[];      // Competitions affected
  
  created_at: string;
}
```

### 2.3.3 CompetitionNotification

**Purpose:** Tracks notifications sent for competition events.

```typescript
interface CompetitionNotification {
  id: string;
  competition_id: string;
  user_id: string;
  
  type: 
    | "competition_started"
    | "competition_ending_soon"
    | "competition_ended"
    | "rank_improved"
    | "rank_dropped"
    | "overtaken"
    | "threshold_approaching"
    | "threshold_reached"
    | "milestone_reached"
    | "winner_announced"
    | "reward_pending"
    | "reward_approved"
    | "reward_shipped"
    | "reward_delivered";
  
  title: string;
  body: string;
  data: object;
  
  channels: ("in_app" | "push" | "email" | "sms")[];
  
  sent_at?: string;
  read_at?: string;
  clicked_at?: string;
  
  created_at: string;
}
```

---

# Section 3 — Core Logic & Flows

## 3.1 Metric Ingestion & Aggregation

### 3.1.1 Event Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    METRIC EVENT PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. SOURCE EVENT (e.g., harvest_visits collection)                      │
│     └─ Document inserted: { user_id, status: "SG", lat, lng, ... }     │
│                                                                         │
│  2. EVENT PUBLISHED (via change stream or application code)             │
│     └─ Topic: "metric.raw_event"                                        │
│     └─ Payload: {                                                       │
│          user_id: "user_123",                                           │
│          event_type: "visit_logged",                                    │
│          source_collection: "harvest_visits",                           │
│          source_document_id: "visit_456",                               │
│          status: "SG",                                                  │
│          timestamp: "2026-02-05T14:30:00Z"                              │
│        }                                                                │
│                                                                         │
│  3. METRIC RESOLVER                                                     │
│     └─ Query: Which metrics does this event affect?                     │
│     └─ Match: "doors" (all visits), "contracts" (SG only), "points"    │
│     └─ For each matched metric:                                         │
│        ├─ Get aggregation rule (count, sum, etc.)                      │
│        ├─ Calculate delta (usually 1 for count)                        │
│        └─ Emit: { metric_id, user_id, delta, timestamp }               │
│                                                                         │
│  4. METRIC VALUE UPDATER                                                │
│     └─ For each metric affected:                                        │
│        ├─ Upsert MetricValue for current day/week/month                │
│        ├─ value += delta                                                │
│        └─ Create MetricEvent audit record                               │
│                                                                         │
│  5. COMPETITION UPDATER (called after metric values updated)            │
│     └─ Query: Which active competitions use this metric?                │
│     └─ For each competition:                                            │
│        ├─ Find or create Participant for user                          │
│        ├─ Update participant.current_value                              │
│        ├─ Recalculate ranks (if needed)                                 │
│        └─ Evaluate rules (threshold, milestone crossings)              │
│                                                                         │
│  6. NOTIFICATION DISPATCHER                                             │
│     └─ Based on rule evaluations and rank changes                       │
│     └─ Send appropriate notifications                                   │
│                                                                         │
│  7. WEBSOCKET BROADCASTER                                               │
│     └─ Push updates to connected clients                                │
│     └─ Channels: user-specific, competition-specific, global            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.1.2 Aggregation Logic Per Scope

**Individual Scope:**
```python
def get_user_metric_value(user_id: str, metric_id: str, start: datetime, end: datetime) -> float:
    metric = get_metric(metric_id)
    
    if metric.aggregation == "count":
        return db[metric.source_collection].count_documents({
            "user_id": user_id,
            "created_at": {"$gte": start, "$lte": end},
            **metric.filter_query
        })
    
    elif metric.aggregation == "sum":
        pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": start, "$lte": end}, **metric.filter_query}},
            {"$group": {"_id": None, "total": {"$sum": f"${metric.source_field}"}}}
        ]
        result = list(db[metric.source_collection].aggregate(pipeline))
        return result[0]["total"] if result else 0
    
    elif metric.aggregation == "ratio":
        numerator = get_user_metric_value(user_id, metric.numerator_metric_id, start, end)
        denominator = get_user_metric_value(user_id, metric.denominator_metric_id, start, end)
        return (numerator / denominator * 100) if denominator > 0 else 0
```

**Team Scope:**
```python
def get_team_metric_value(team_id: str, metric_id: str, start: datetime, end: datetime) -> float:
    team = get_team_group(team_id)
    total = 0
    for user_id in team.member_user_ids:
        total += get_user_metric_value(user_id, metric_id, start, end)
    return total
```

**Company Scope:**
```python
def get_company_metric_value(metric_id: str, start: datetime, end: datetime) -> float:
    metric = get_metric(metric_id)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": start, "$lte": end}, **metric.filter_query}},
        {"$group": {"_id": None, "total": {"$sum": 1 if metric.aggregation == "count" else f"${metric.source_field}"}}}
    ]
    result = list(db[metric.source_collection].aggregate(pipeline))
    return result[0]["total"] if result else 0
```

## 3.2 Competition Lifecycle

### 3.2.1 Create Competition from Template

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CREATE COMPETITION FROM TEMPLATE                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  INPUT:                                                                 │
│  ├─ template_id: "template-weekend-blitz"                              │
│  ├─ name: "February Weekend Blitz"                                      │
│  ├─ start_date: "2026-02-07T00:00:00-07:00"                            │
│  ├─ end_date: "2026-02-09T23:59:59-07:00"                              │
│  ├─ overrides: { threshold_value: 100 }  (optional customizations)     │
│  └─ season_id: "season-q1-2026" (optional)                             │
│                                                                         │
│  PROCESS:                                                               │
│                                                                         │
│  1. LOAD TEMPLATE                                                       │
│     └─ template = db.competition_templates.find_one({"id": template_id})│
│                                                                         │
│  2. VALIDATE DATES                                                      │
│     ├─ start_date must be in future (or within 24h for "starting now") │
│     ├─ end_date must be after start_date                               │
│     └─ Duration must match template type or be custom                  │
│                                                                         │
│  3. CREATE COMPETITION DOCUMENT                                         │
│     └─ competition = {                                                  │
│          id: generate_uuid(),                                           │
│          template_id: template.id,                                      │
│          season_id: season_id,                                          │
│          name: name,                                                    │
│          description: template.description,                             │
│          tagline: template.tagline,                                     │
│          icon: template.icon,                                           │
│          banner_color: template.banner_color,                           │
│          start_date: start_date,                                        │
│          end_date: end_date,                                            │
│          timezone: "America/Denver",                                    │
│          status: "scheduled" if start_date > now else "active",        │
│          metric_id: template.default_metric_id,                         │
│          scope: template.default_scope,                                 │
│          eligibility: template.default_eligibility,                     │
│          rules: create_rules_from_template(template, overrides),       │
│          reward_pool: [],                                               │
│          participant_count: 0,                                          │
│          qualified_count: 0,                                            │
│          created_by: current_user.id,                                   │
│          created_at: now                                                │
│        }                                                                │
│                                                                         │
│  4. CREATE RULES                                                        │
│     └─ For each rule_config in template.default_rules:                 │
│        └─ Create IncentiveRule with competition_id                     │
│                                                                         │
│  5. INITIALIZE PARTICIPANTS (if not opt-in)                            │
│     └─ For each eligible user:                                         │
│        └─ Create Participant with current_value = 0, is_eligible = true │
│                                                                         │
│  6. UPDATE TEMPLATE STATS                                               │
│     └─ template.times_used += 1                                        │
│     └─ template.last_used_at = now                                     │
│                                                                         │
│  7. IF STATUS = "active":                                               │
│     ├─ Broadcast "competition_started" event                           │
│     ├─ Send notifications to eligible users                            │
│     └─ Update Season standings (if season_id)                          │
│                                                                         │
│  OUTPUT:                                                                │
│  └─ competition document with id                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2.2 Save Competition as Template

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SAVE COMPETITION AS TEMPLATE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  INPUT:                                                                 │
│  ├─ competition_id: "comp-weekend-blitz-feb-2026"                      │
│  └─ template_name: "Super Blitz" (optional, defaults to comp name)     │
│                                                                         │
│  PROCESS:                                                               │
│                                                                         │
│  1. LOAD COMPETITION                                                    │
│     └─ comp = db.competitions.find_one({"id": competition_id})         │
│                                                                         │
│  2. EXTRACT DURATION                                                    │
│     └─ duration_days = (comp.end_date - comp.start_date).days          │
│     └─ duration_type = infer_type(duration_days)                       │
│        # 1 = day, 2-3 = weekend, 7 = week, 30 = month, else custom     │
│                                                                         │
│  3. GENERALIZE RULES                                                    │
│     └─ rule_configs = []                                                │
│     └─ For each rule in comp.rules:                                    │
│        └─ rule_configs.append({                                        │
│             type: rule.type,                                            │
│             config: extract_config(rule),  # Remove IDs, keep values   │
│             reward_config: { points_award: rule.points_award }         │
│           })                                                            │
│                                                                         │
│  4. CREATE TEMPLATE                                                     │
│     └─ template = {                                                     │
│          id: generate_uuid(),                                           │
│          name: template_name or f"Copy of {comp.name}",                │
│          description: comp.description,                                 │
│          tagline: comp.tagline,                                         │
│          default_metric_id: comp.metric_id,                             │
│          default_duration_type: duration_type,                          │
│          default_duration_days: duration_days,                          │
│          default_scope: comp.scope,                                     │
│          default_team_grouping: comp.team_grouping,                     │
│          default_rules: rule_configs,                                   │
│          suggested_reward_ids: extract_reward_ids(comp),               │
│          suggested_points_bonus: comp.points_bonus,                     │
│          icon: comp.icon,                                               │
│          banner_color: comp.banner_color,                               │
│          category: infer_category(comp),                                │
│          times_used: 0,                                                 │
│          is_system: false,                                              │
│          is_active: true,                                               │
│          created_by: current_user.id,                                   │
│          created_at: now                                                │
│        }                                                                │
│                                                                         │
│  5. INSERT TEMPLATE                                                     │
│     └─ db.competition_templates.insert_one(template)                   │
│                                                                         │
│  OUTPUT:                                                                │
│  └─ template document with id                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2.3 Competition State Machine

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMPETITION STATE MACHINE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│        ┌──────────┐                                                     │
│        │  draft   │ ← Admin creates, not scheduled yet                  │
│        └────┬─────┘                                                     │
│             │ schedule()                                                │
│             ▼                                                           │
│        ┌──────────┐                                                     │
│        │scheduled │ ← Start date in future                              │
│        └────┬─────┘                                                     │
│             │ start() [triggered by scheduler at start_date]            │
│             ▼                                                           │
│        ┌──────────┐                                                     │
│        │  active  │ ← Participants can compete                          │
│        └────┬─────┘                                                     │
│             │ end() [triggered by scheduler at end_date]                │
│             ▼                                                           │
│        ┌──────────────┐                                                 │
│        │  evaluating  │ ← Calculating final results                     │
│        └──────┬───────┘                                                 │
│               │ finalize()                                              │
│               ▼                                                         │
│        ┌──────────────┐                                                 │
│        │  completed   │ ← Results locked, fulfillment started           │
│        └──────────────┘                                                 │
│                                                                         │
│  SIDE TRANSITIONS:                                                      │
│  ├─ Any state → cancelled (admin action)                               │
│  └─ active → paused → active (admin can pause/resume)                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3.3 Incentive Evaluation

### 3.3.1 Real-Time Evaluation (Event-Driven)

```
┌─────────────────────────────────────────────────────────────────────────┐
│              REAL-TIME RULE EVALUATION                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  TRIGGER: Participant.current_value updated                             │
│                                                                         │
│  async def evaluate_participant_progress(participant: Participant):     │
│                                                                         │
│      competition = get_competition(participant.competition_id)          │
│      notifications = []                                                 │
│                                                                         │
│      # Process each rule in priority order                              │
│      for rule in sorted(competition.rules, key=lambda r: r.priority):   │
│                                                                         │
│          # THRESHOLD RULE                                               │
│          if rule.type == "threshold":                                   │
│              old_qualified = rule.id in participant.qualified_rules     │
│              now_qualified = participant.current_value >= rule.threshold_value│
│                                                                         │
│              if now_qualified and not old_qualified:                    │
│                  # Just crossed threshold!                              │
│                  participant.qualified_rules.append(rule.id)            │
│                  notifications.append({                                 │
│                      "type": "threshold_reached",                       │
│                      "title": "Threshold Reached!",                     │
│                      "body": f"You hit {rule.threshold_value} {metric.unit}!"│
│                  })                                                     │
│              elif not now_qualified and is_approaching(participant, rule):│
│                  # Close to threshold (90%+)                            │
│                  notifications.append({                                 │
│                      "type": "threshold_approaching",                   │
│                      "title": "Almost there!",                          │
│                      "body": f"Just {gap} more to qualify!"             │
│                  })                                                     │
│                                                                         │
│          # MILESTONE RULE                                               │
│          elif rule.type == "milestone":                                 │
│              for milestone in rule.milestones:                          │
│                  if participant.current_value >= milestone.value:       │
│                      if participant.milestone_reached != milestone.tier:│
│                          participant.milestone_reached = milestone.tier │
│                          notifications.append({                         │
│                              "type": "milestone_reached",               │
│                              "title": f"{milestone.tier.title()} Unlocked!"│
│                          })                                             │
│                          break                                          │
│                                                                         │
│          # TOP_N RULE (rank changes)                                    │
│          elif rule.type == "top_n":                                     │
│              new_rank = calculate_rank(participant, competition)        │
│              if new_rank != participant.rank:                           │
│                  direction = "improved" if new_rank < participant.rank else "dropped"│
│                  participant.previous_rank = participant.rank           │
│                  participant.rank = new_rank                            │
│                                                                         │
│                  if direction == "improved" and new_rank <= rule.top_n: │
│                      notifications.append({                             │
│                          "type": "rank_improved",                       │
│                          "title": f"You're now #{new_rank}!",           │
│                          "body": "Keep pushing!"                        │
│                      })                                                 │
│                                                                         │
│      # Save participant and send notifications                          │
│      save_participant(participant)                                      │
│      for notif in notifications:                                        │
│          send_notification(participant.user_id, notif)                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3.2 Scheduled Evaluation (End of Competition)

```
┌─────────────────────────────────────────────────────────────────────────┐
│              END-OF-COMPETITION EVALUATION                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  TRIGGER: Scheduled job runs at competition.end_date + 1 minute         │
│                                                                         │
│  async def finalize_competition(competition_id: str):                   │
│                                                                         │
│      # 1. Lock competition                                              │
│      competition = get_competition(competition_id)                      │
│      competition.status = "evaluating"                                  │
│      save_competition(competition)                                      │
│                                                                         │
│      # 2. Freeze final values                                           │
│      participants = get_all_participants(competition_id)                │
│      for p in participants:                                             │
│          p.final_value = p.current_value                                │
│          p.final_rank = p.rank                                          │
│                                                                         │
│      # 3. Evaluate rules and create results                             │
│      results = []                                                       │
│      fulfillment_events = []                                            │
│                                                                         │
│      for rule in sorted(competition.rules, key=lambda r: r.priority):   │
│                                                                         │
│          if rule.type == "top_n":                                       │
│              winners = get_top_n(participants, rule.top_n)              │
│              for rank, winner in enumerate(winners, 1):                 │
│                  result = create_result(winner, rule, rank)             │
│                  results.append(result)                                 │
│                  if rule.reward_tiers:                                  │
│                      tier = get_tier_for_rank(rule.reward_tiers, rank)  │
│                      if tier:                                           │
│                          fe = create_fulfillment_event(winner, tier.reward_id)│
│                          fulfillment_events.append(fe)                  │
│                                                                         │
│          elif rule.type == "threshold":                                 │
│              qualifiers = [p for p in participants                      │
│                           if p.current_value >= rule.threshold_value]   │
│              for q in qualifiers:                                       │
│                  result = create_result(q, rule, "qualified")           │
│                  results.append(result)                                 │
│                  if rule.reward_id:                                     │
│                      fe = create_fulfillment_event(q, rule.reward_id)   │
│                      fulfillment_events.append(fe)                      │
│                                                                         │
│          elif rule.type == "lottery":                                   │
│              qualifiers = [p for p in participants                      │
│                           if p.current_value >= rule.lottery_qualifier_threshold]│
│              winners = random_select(qualifiers, rule.lottery_winner_count)│
│              rule.lottery_drawn_at = now()                              │
│              for winner in winners:                                     │
│                  result = create_result(winner, rule, "lottery_winner") │
│                  results.append(result)                                 │
│                                                                         │
│      # 4. Award points and badges                                       │
│      for result in results:                                             │
│          user = get_user(result.user_id)                                │
│          user.total_points += result.points_awarded                     │
│          if result.badge_id:                                            │
│              award_badge(user, result.badge_id)                         │
│          save_user(user)                                                │
│                                                                         │
│      # 5. Create fulfillment events                                     │
│      for fe in fulfillment_events:                                      │
│          db.fulfillment_events.insert_one(fe)                           │
│                                                                         │
│      # 6. Save results and complete                                     │
│      competition.results = results                                      │
│      competition.evaluated_at = now()                                   │
│      competition.status = "completed"                                   │
│      save_competition(competition)                                      │
│                                                                         │
│      # 7. Update season standings (if applicable)                       │
│      if competition.season_id:                                          │
│          update_season_standings(competition.season_id)                 │
│                                                                         │
│      # 8. Send completion notifications                                 │
│      for p in participants:                                             │
│          send_competition_ended_notification(p)                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3.4 Rewards and Fulfillment

### 3.4.1 Fulfillment Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      FULFILLMENT PIPELINE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FulfillmentEvent created with status = "pending_approval"              │
│  (or "approved" if reward.requires_approval = false)                    │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│  MANUAL PROVIDER FLOW                                                   │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  1. EVENT CREATED → status: "pending_approval"                          │
│     └─ Admin sees in fulfillment dashboard                              │
│                                                                         │
│  2. ADMIN REVIEWS                                                       │
│     ├─ APPROVE → status: "approved"                                    │
│     │   └─ approved_by: admin_id, approved_at: now                     │
│     └─ DENY → status: "cancelled"                                      │
│         └─ denial_reason: "...", points refunded if applicable         │
│                                                                         │
│  3. ADMIN PROCESSES (for approved events)                               │
│     ├─ Orders gift card / ships merch / schedules PTO                  │
│     ├─ status: "processing"                                            │
│     └─ fulfillment_notes: "Ordered from Amazon, arriving Feb 10"       │
│                                                                         │
│  4. ADMIN MARKS SENT                                                    │
│     ├─ status: "sent"                                                  │
│     ├─ tracking_number: "1Z..." (if applicable)                        │
│     └─ User receives "Your reward is on the way!" notification         │
│                                                                         │
│  5. ADMIN MARKS DELIVERED                                               │
│     ├─ status: "delivered"                                             │
│     └─ User receives "Your reward has arrived!" notification           │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│  API PROVIDER FLOW (Future: Tremendous, Tango, etc.)                    │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  1. EVENT CREATED → status: "approved" (auto-approved)                  │
│                                                                         │
│  2. FULFILLMENT PROCESSOR runs                                          │
│     ├─ Gets provider config                                            │
│     ├─ Builds API request:                                             │
│     │   POST /api/rewards                                              │
│     │   {                                                              │
│     │     recipient_email: user.email,                                 │
│     │     reward_sku: reward.fulfillment_sku,                          │
│     │     amount_cents: reward.value_cents,                            │
│     │     message: "Congratulations on your Weekend Blitz win!"        │
│     │   }                                                              │
│     └─ Sends request to provider                                       │
│                                                                         │
│  3. HANDLE RESPONSE                                                     │
│     ├─ SUCCESS: status = "sent", provider_reference = response.order_id│
│     └─ FAILURE: status = "failed", retry_count++, schedule retry       │
│                                                                         │
│  4. WEBHOOK CALLBACK (provider calls us)                                │
│     ├─ Event: "reward.delivered"                                       │
│     ├─ status = "delivered"                                            │
│     └─ User notification sent                                          │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│  ERROR HANDLING                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  • API failure: Retry 3x with exponential backoff (1m, 5m, 30m)        │
│  • Max retries exceeded: status = "failed", alert admin, offer manual  │
│  • Provider down: Queue events, process when health restored           │
│  • Invalid reward: status = "failed", notify admin, suggest substitute │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3.5 Recognition Hooks

### 3.5.1 Event → Recognition Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      RECOGNITION SYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  When someone qualifies or wins, trigger all recognition channels:      │
│                                                                         │
│  1. IN-APP NOTIFICATION                                                 │
│     └─ Created in notifications collection                              │
│     └─ Appears in NotificationBell                                      │
│     └─ CTA links to relevant competition                                │
│                                                                         │
│  2. PUSH NOTIFICATION (if user has enabled)                             │
│     └─ Sent via Firebase/APNs                                           │
│     └─ Rich notification with competition icon                          │
│                                                                         │
│  3. COACH BOT MESSAGE                                                   │
│     └─ Harvest Coach generates congratulatory message                   │
│     └─ Added to bot notifications feed                                  │
│                                                                         │
│  4. BADGE AWARD (if rule includes badge)                                │
│     └─ Badge added to user.badges array                                 │
│     └─ earned_at timestamp recorded                                     │
│     └─ Badge unlock celebration triggered on next app open              │
│                                                                         │
│  5. PROFILE UPDATE                                                      │
│     └─ Competition added to user's history                              │
│     └─ Stats updated (competitions_entered, wins)                       │
│     └─ Recent wins section refreshed                                    │
│                                                                         │
│  6. LEADERBOARD HIGHLIGHT (for top performers)                          │
│     └─ Winner badge shown next to name                                  │
│     └─ Celebration animation on leaderboard view                        │
│                                                                         │
│  7. SEASON STANDINGS UPDATE (if competition is in season)               │
│     └─ Season points credited                                           │
│     └─ Season rank recalculated                                         │
│                                                                         │
│  8. FULFILLMENT QUEUE (if reward attached)                              │
│     └─ FulfillmentEvent created                                         │
│     └─ Admin notified of pending fulfillment                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# Section 4 — Gamified UI & Visual System

## 4.1 Visual Theme & Design Language

### 4.1.1 Overall Theme: "Competition League"

**Concept:** The UI should feel like a fantasy sports league crossed with a fitness achievement app. Every element communicates progress, standing, and aspiration.

**Core Aesthetic:**
- **Dark mode preferred** for immersive experience (optional light mode)
- **Hero gradients** for accomplishments and CTAs
- **Depth through shadows** and glass-morphism on cards
- **Motion as reward** - meaningful animations for achievements

### 4.1.2 Color System

| Role | Light Mode | Dark Mode | Usage |
|------|------------|-----------|-------|
| **Primary (Eden Orange)** | `#F97316` | `#FB923C` | CTAs, progress, wins |
| **Secondary (Electric Blue)** | `#3B82F6` | `#60A5FA` | Active competitions |
| **Success** | `#10B981` | `#34D399` | Completed, qualified |
| **Warning** | `#F59E0B` | `#FBBF24` | At risk, ending soon |
| **Danger** | `#EF4444` | `#F87171` | Streak broken, failed |
| **Gold (Rank 1)** | `#FBBF24` | `#FCD34D` | First place, legendary |
| **Silver (Rank 2)** | `#9CA3AF` | `#D1D5DB` | Second place |
| **Bronze (Rank 3)** | `#D97706` | `#F59E0B` | Third place |
| **Epic Purple** | `#8B5CF6` | `#A78BFA` | Epic tier, special |
| **Background** | `#F8FAFC` | `#0F172A` | Base background |
| **Surface** | `#FFFFFF` | `#1E293B` | Cards, modals |
| **Text Primary** | `#0F172A` | `#F8FAFC` | Headers |
| **Text Secondary** | `#64748B` | `#94A3B8` | Descriptions |

### 4.1.3 Iconography Style

- **Competition Icons:** Custom illustrated, gradient fills (⚡🏆🌟🔥⚔️)
- **Badge Icons:** 32x32 base with tier-specific frames
- **UI Icons:** Lucide React library (consistent with Eden)
- **Status Icons:** Simple, high-contrast for quick recognition

### 4.1.4 Motion & Animation Principles

| Trigger | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Progress increment | Ring fill + pulse | 300ms | ease-out |
| Rank change up | Slide up + green glow | 400ms | spring |
| Rank change down | Subtle slide down | 200ms | ease-in |
| Badge unlock | Full-screen celebration | 2000ms | custom |
| Challenge complete | Confetti burst | 1500ms | ease-out |
| Milestone reached | Tier glow + sound | 800ms | ease-in-out |
| Card enter | Fade up + scale | 200ms | ease-out |
| Tab switch | Crossfade | 150ms | linear |

---

## 4.2 Rep Experience (Mobile-First)

### 4.2.1 Today Tab

**Purpose:** Daily mission control. Everything needed for today in one scroll.

```
┌────────────────────────────────────┐
│ ☀️ Good morning, Sarah       Feb 6 │
│                                    │
│ 🔥 Day 12 Streak          1.25x   │
├────────────────────────────────────┤
│                                    │
│       ┌─────────────────┐          │
│       │                 │          │
│       │    67 / 75      │          │
│       │                 │          │
│       │  ████████████░  │          │
│       │      89%        │          │
│       │                 │          │
│       │    DOORS        │          │
│       └─────────────────┘          │
│                                    │
│  🔥 8 more to hit your goal!       │
│                                    │
├────────────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐      │
│ │ 67 │ │  4 │ │  1 │ │320 │      │
│ │Door│ │Appt│ │Sign│ │Pts │      │
│ └────┘ └────┘ └────┘ └────┘      │
├────────────────────────────────────┤
│                                    │
│ ⚡ ACTIVE COMPETITION              │
│ ┌────────────────────────────────┐ │
│ │ Weekend Blitz           1d 6h │ │
│ │ Your Rank: #4 (↑2)            │ │
│ │ 67/75 doors · Prize: $50 GC   │ │
│ │ ███████████████░░░  89%       │ │
│ │              [View Leaderboard]│ │
│ └────────────────────────────────┘ │
│                                    │
├────────────────────────────────────┤
│ 🎯 TODAY'S CHALLENGES              │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ ⏰ Early Bird                  │ │
│ │ 20 doors before 10 AM          │ │
│ │ ████████████████░░░ 85% +100  │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ ✅ Noon Sprint        COMPLETE │ │
│ │ 50 doors by noon               │ │
│ │ █████████████████████ +150    │ │
│ │                    [CLAIMED]   │ │
│ └────────────────────────────────┘ │
│                                    │
├────────────────────────────────────┤
│ 🎁 NEXT REWARD                     │
│ Apple AirPods Pro       450 to go │
│ ████████████████████░░░░░ 77%    │
│                                    │
└────────────────────────────────────┘
```

**Components:**
1. **Greeting Header:** Personalized with streak badge
2. **Progress Ring:** Animated SVG, gradient fill, pulsing on activity
3. **Stats Row:** 4 key metrics in equal-width cards
4. **Competition Card:** Hero card for primary active competition
5. **Challenges Section:** Scrollable list of daily objectives
6. **Reward Progress:** Bar showing distance to next redemption

**States:**
- **Morning (before first activity):** Encouraging message, full ring to fill
- **Active (mid-day):** Real-time updates, progress animations
- **At Risk (afternoon, low progress):** Warning styling, coach nudge
- **Complete (daily goal hit):** Celebration state, next goal shown

### 4.2.2 Leaderboard Tab

**Purpose:** Competitive fuel. See where you stand and who to chase.

```
┌────────────────────────────────────┐
│ 🏆 LEADERBOARD                     │
│                                    │
│ ⚡ Weekend Blitz          1d 6h   │
├────────────────────────────────────┤
│                                    │
│     🥇       🥈       🥉          │
│    Sarah    Mike     Jake         │
│     89       82       78          │
│                                    │
├────────────────────────────────────┤
│ [Day] [Week] [Month] [All-Time]   │
│ [Doors ▼]                         │
├────────────────────────────────────┤
│                                    │
│ 1  🥇 Sarah M.      89  +$100    │
│ 2  🥈 Mike T.       82  +$50     │
│ 3  🥉 Jake R.       78  +$25     │
│ 4     Lisa K.       76  ✓ $50    │
│ ─────────────────────────────────  │
│ 5  ★ YOU ★          67  8→       │
│ ─────────────────────────────────  │
│ 6     Amy P.        65            │
│ 7     Tom W.        61            │
│ 8     Dan S.        58            │
│ ...                               │
│                                    │
├────────────────────────────────────┤
│ ✓ = Qualified for threshold       │
│ 8→ = 8 more to qualify            │
│ +$X = Prize for position          │
│                                    │
└────────────────────────────────────┘
```

**Components:**
1. **Competition Banner:** Shows active competition driving leaderboard
2. **Podium:** Visual top-3 with avatars and metrics
3. **Time Filter Pills:** Day/Week/Month/All-Time toggles
4. **Metric Selector:** Dropdown to switch between metrics
5. **Leaderboard List:** Scrollable rankings with:
   - Rank (medal icons for top 3)
   - Avatar
   - Name
   - Metric value
   - Prize indicator or gap to qualify
6. **Your Row:** Always highlighted, sticky when scrolling
7. **Legend:** Explains symbols

**Animations:**
- **Rank improved:** Row slides up with green trail
- **Rank dropped:** Subtle red flash
- **Pull to refresh:** Confetti if you moved up

### 4.2.3 Challenges Tab

**Purpose:** Gamified objectives with clear progress and rewards.

```
┌────────────────────────────────────┐
│ 🎯 CHALLENGES                      │
│ 3 active · 12 completed            │
├────────────────────────────────────┤
│                                    │
│ ⚡ ACTIVE CAMPAIGN                 │
│ ┌────────────────────────────────┐ │
│ │ ⚡ Weekend Blitz       1d 6h   │ │
│ │ Hit 75 doors for $50 bonus     │ │
│ │ ████████████████░░░ 67/75     │ │
│ │                        +500 pts│ │
│ └────────────────────────────────┘ │
│                                    │
├────────────────────────────────────┤
│ [Active] [Upcoming] [Completed]   │
├────────────────────────────────────┤
│                                    │
│ ┌────────────────────────────────┐ │
│ │ 🌟 Weekend Warrior      IN PROGRESS │
│ │ Log 100 doors Sat-Sun          │ │
│ │ ████████████░░░░░ 45/100      │ │
│ │ ⏰ 1d 4h left          +500 pts│ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ ✅ COMPLETED - TAP TO CLAIM    │ │
│ │ 🎯 Appointment Machine         │ │
│ │ Set 10 appointments this week  │ │
│ │ ████████████████████ 10/10    │ │
│ │               [CLAIM 250 PTS]  │ │
│ └────────────────────────────────┘ │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ 🔒 LOCKED                      │ │
│ │ 🏆 Storm Chaser Elite          │ │
│ │ Complete 5 contracts in a week │ │
│ │ Unlocks: Week 3 of employment  │ │
│ │                       +1000 pts│ │
│ └────────────────────────────────┘ │
│                                    │
└────────────────────────────────────┘
```

**Challenge Card States:**

| State | Visual Treatment |
|-------|------------------|
| **Locked** | Grayed out, lock icon, unlock requirement shown |
| **In Progress** | Orange/blue border, animated progress bar |
| **About to Unlock** | Pulsing border, "Almost there!" badge |
| **Completed** | Green border, pulsing CLAIM button |
| **Claimed** | Purple faded, checkmark, earned date |
| **Expired** | Red faded, "Expired" badge |

**Claim Flow:**
1. User taps pulsing "CLAIM" button
2. Full-screen celebration modal
3. Points counter animation
4. Badge unlock (if applicable)
5. Next challenge preview

### 4.2.4 Profile Tab

**Purpose:** Personal achievement showcase and career progress tracker.

```
┌────────────────────────────────────┐
│             ┌────────┐             │
│             │ AVATAR │             │
│             │   🔥   │             │
│             └────────┘             │
│          Sarah Mitchell            │
│       ⭐ Senior Canvasser          │
│                                    │
│  🔥 12 Day Streak    💎 4,250 pts  │
├────────────────────────────────────┤
│                                    │
│ 📊 THIS WEEK                       │
│ ┌────────┐ ┌────────┐             │
│ │  342   │ │   28   │             │
│ │ Doors  │ │ Appts  │             │
│ └────────┘ └────────┘             │
│ ┌────────┐ ┌────────┐             │
│ │   5    │ │   14   │             │
│ │Contracts│ │ Best   │             │
│ └────────┘ │Streak  │             │
│            └────────┘             │
│                                    │
├────────────────────────────────────┤
│ 🏅 BADGE COLLECTION    [View All] │
│                                    │
│ [Common ▼]                        │
│                                    │
│ ┌──────┐ ┌──────┐ ┌──────┐       │
│ │  🏆  │ │  ⚡  │ │  🔥  │       │
│ │Legend│ │ Epic │ │ Rare │       │
│ │EARNED│ │EARNED│ │EARNED│       │
│ └──────┘ └──────┘ └──────┘       │
│                                    │
│ ┌──────┐ ┌──────┐ ┌──────┐       │
│ │  🎯  │ │  🔒  │ │  🔒  │       │
│ │Common│ │ Rare │ │ Epic │       │
│ │EARNED│ │LOCKED│ │LOCKED│       │
│ └──────┘ └──────┘ └──────┘       │
│                                    │
│                          +8 more  │
├────────────────────────────────────┤
│ 🎁 REWARDS PROGRESS               │
│                                    │
│ Apple AirPods Pro                  │
│ ██████████████████░░ 77% (450→)   │
│                                    │
│ $50 Amazon Gift Card               │
│ ████████████████████ ✅ AVAILABLE │
│                    [REDEEM NOW]    │
│                                    │
├────────────────────────────────────┤
│ 🏆 COMPETITION HISTORY            │
│                                    │
│ • Weekend Blitz (Jan 27)          │
│   🥇 1st Place - $100             │
│                                    │
│ • New Year Sprint                  │
│   ✓ Qualified - $50               │
│                                    │
│              [View All History →]  │
│                                    │
└────────────────────────────────────┘
```

**Components:**
1. **Profile Header:** Avatar with flame overlay, name, title
2. **Key Stats:** Streak and total points prominently displayed
3. **This Week Grid:** 2x2 grid of current period stats
4. **Badge Collection:** Filterable grid with tier badges
5. **Rewards Progress:** Bars showing distance to redeemable rewards
6. **Competition History:** Recent wins and placements

---

## 4.3 Badges & Challenge Card System

### 4.3.1 Badge Concepts (10 Examples)

| Badge Name | Tier | Unlock Condition | Icon | Color Treatment |
|------------|------|------------------|------|-----------------|
| **First Steps** | Common | Log first door | 👟 | Gray border |
| **Ten Doors Down** | Common | 10 doors in a day | 🚪 | Gray border |
| **Week Warrior** | Common | 7-day streak | 🗓️ | Gray border |
| **Early Bird** | Common | Activity before 8 AM | 🌅 | Gray border |
| **Century Club** | Rare | 100 doors in a week | 💯 | Blue glow |
| **Appointment Ace** | Rare | 10 appointments in a day | 🎯 | Blue glow |
| **Streak Master** | Epic | 30-day streak | 🔥 | Purple pulse |
| **Contract King** | Epic | 5 contracts in a week | 👑 | Purple pulse |
| **Harvest Legend** | Legendary | #1 monthly rank | 🏆 | Gold radiance |
| **Iron Will** | Legendary | 100-day streak | 💎 | Gold radiance |

### 4.3.2 Challenge Templates (10 Examples)

| Challenge Name | Type | Duration | Goal | Reward |
|----------------|------|----------|------|--------|
| **Daily Doors** | Sprint | 1 day | 25 doors | 50 pts |
| **Early Bird Special** | Sprint | 1 day | 10 doors before 10 AM | 100 pts |
| **Weekend Warrior** | Threshold | 3 days | 100 doors | 500 pts + badge |
| **Appointment Hat Trick** | Threshold | 1 day | 3 appointments | 150 pts |
| **First Fruits** | Milestone | Season | First contract | 250 pts + badge |
| **Review Rush** | Sprint | 7 days | 5 reviews | 200 pts |
| **Referral Ramp** | Ladder | 30 days | Most referrals | Tiered prizes |
| **New Rep Sprint** | Milestone | 14 days | 20 appts for new hires | 500 pts + badge |
| **Storm Surge** | Team | Variable | Team doors goal | Team reward |
| **Quarter Champion** | Ladder | 90 days | Top 10 in season | Major prizes |

### 4.3.3 Visual States

```
LOCKED                    IN PROGRESS              ABOUT TO UNLOCK
┌────────────────┐       ┌────────────────┐       ┌────────────────┐
│      🔒       │       │      🎯       │       │    ✨ 🎯 ✨    │
│               │       │               │       │               │
│   Gray fill   │       │ Orange border │       │ Pulsing border│
│               │       │               │       │               │
│  "Unlocks at  │       │ ████████░░░   │       │ ███████████░  │
│   Week 3"     │       │    75%        │       │    95%        │
└────────────────┘       └────────────────┘       └────────────────┘

COMPLETED                 CLAIMED
┌────────────────┐       ┌────────────────┐
│    ✅ 🎯      │       │      🎯       │
│               │       │      ✓        │
│ Green border  │       │ Purple faded  │
│ Pulse anim    │       │               │
│               │       │ Claimed Feb 5 │
│ [CLAIM +150]  │       │   +150 pts    │
└────────────────┘       └────────────────┘
```

---

## 4.4 Copy & Microcopy

### 4.4.1 Challenge Names & Taglines

| Challenge | Name | Tagline |
|-----------|------|---------|
| Daily doors | "Daily Grind" | "Hit your daily door target" |
| Weekend push | "Weekend Warrior" | "Own the weekend, own the leaderboard" |
| Appointment focus | "Appointment Machine" | "Book your way to the top" |
| New hire | "Rising Star" | "Prove yourself in your first 14 days" |
| Contract goal | "Closer's Club" | "Sign the dotted line" |
| Team competition | "Office Showdown" | "Your team vs. theirs" |
| Streak | "Iron Will" | "Never miss a day" |
| Review collection | "5-Star General" | "Collect reviews, collect rewards" |

### 4.4.2 Notification Copy

**Celebration:**
```
🎉 CHALLENGE COMPLETE!
You crushed "Weekend Warrior"!
+500 points earned
```

**Encouragement:**
```
🎯 Halfway there!
50/100 doors toward Weekend Warrior.
36 hours left — you've got this!
```

**Warning:**
```
⚠️ Streak Alert!
Your 12-day streak is at risk.
Log 1 door before midnight to keep it alive!
```

**Competition:**
```
📈 You've moved up!
Now #4 on the weekly leaderboard.
Sarah M. is just 15 doors ahead...
```

**Urgency:**
```
⏰ 6 HOURS LEFT!
Weekly Blitz ends tonight.
23 more doors to hit 150 and win $50.
```

**Reward:**
```
🎁 So close to AirPods!
Just 120 points away.
That's about 6 appointments!
```

### 4.4.3 Empty States

**No Active Challenges:**
```
🎯 No Active Challenges

Check back soon — new challenges 
launch every week!

[View Completed Challenges]
```

**No Badges Yet:**
```
🏅 Your Badge Collection

Start earning badges by completing
challenges and hitting milestones.

Your first badge is waiting!

[View All Badges]
```

**No Competition History:**
```
🏆 No Competition History Yet

Join your first competition to
start building your track record!

[View Active Competitions]
```

### 4.4.4 Season Headers

```
⚡ Q1 2026: STORM SEASON
January 1 - March 31

Chase the thunder. Earn the glory.
```

```
🔥 SUMMER SURGE
June 1 - August 31

The heat is on. Time to dominate.
```

---

# Section 5 — Implementation Roadmap

## 5.1 Overview (6-8 Weeks)

**Goal:** Ship an Enzy-level "wow" moment quickly, then iterate.

**Strategy:**
1. Foundation first (data models, basic CRUD)
2. One amazing competition flow live fast (Week 2)
3. User-facing polish (Weeks 3-4)
4. Admin console (Weeks 4-5)
5. Advanced features (Weeks 5-6)
6. Polish and scale (Weeks 6-8)

## 5.2 Phase 1: Config-Driven Foundation (Week 1-2)

**Goal:** Backend infrastructure that enables any competition without code changes.

| # | Task | Area | Deliverable | Dependencies |
|---|------|------|-------------|--------------|
| 1 | Create `metrics` collection | Backend | Metric CRUD, 10 seed metrics | None |
| 2 | Create `seasons` collection | Backend | Season CRUD, Q1 2026 seed | None |
| 3 | Refactor Competition model | Backend | Updated schema per spec | Task 1 |
| 4 | Build IncentiveRule evaluator | Backend | Rule engine for threshold, top_n | Task 3 |
| 5 | Create metric event pipeline | Backend | Event → MetricValue → Participant updates | Tasks 1, 3 |
| 6 | Real-time rank calculation | Backend | Efficient rank updates on value changes | Task 5 |

**Release Value:** Backend ready for competitions. Internal testing possible.

## 5.3 Phase 2: Templates & First Competition (Week 2-3)

**Goal:** Launch one "Weekend Blitz" competition that feels magical.

| # | Task | Area | Deliverable | Dependencies |
|---|------|------|-------------|--------------|
| 7 | Create `competition_templates` | Backend | Template CRUD, 7 seed templates | None |
| 8 | "Create from Template" API | Backend | POST /api/competitions/from-template | Task 7 |
| 9 | "Save as Template" API | Backend | POST /api/templates from competition | Task 7 |
| 10 | Competition lifecycle jobs | Backend | Scheduler for start/end/evaluate | Task 4 |
| 11 | Today Tab competition cards | Frontend | Active competition display | Task 3 |
| 12 | Basic Leaderboard (competition) | Frontend | Live rankings for active competition | Task 6 |

**Release Value:** Reps see live competition on Today tab and Leaderboard. First "wow" moment.

## 5.4 Phase 3: User Experience Polish (Week 3-4)

**Goal:** Full user-facing gamification experience.

| # | Task | Area | Deliverable | Dependencies |
|---|------|------|-------------|--------------|
| 13 | Progress ring with animations | Frontend | Animated SVG, gradient fills | Task 11 |
| 14 | Streak visualization upgrade | Frontend | Flame tiers, warning states | Backend streak service |
| 15 | Challenges Tab implementation | Frontend | Active/upcoming/completed sections | Task 10 |
| 16 | Challenge card states | Frontend | Locked/progress/complete/claimed | Task 15 |
| 17 | Claim flow with celebration | Frontend | Confetti, points animation | Task 16 |
| 18 | Profile Tab upgrade | Frontend | Badge wall, competition history | Task 4 |
| 19 | Badge detail modal | Frontend | Tier visuals, unlock criteria | Task 18 |
| 20 | Real-time WebSocket updates | Both | Rank changes, threshold crossings | Task 6 |

**Release Value:** Complete gamified user experience. Reps fully engaged.

## 5.5 Phase 4: Admin Console (Week 4-5)

**Goal:** Leadership can create and manage competitions without developer help.

| # | Task | Area | Deliverable | Dependencies |
|---|------|------|-------------|--------------|
| 21 | Competitions list page | Frontend | Active/scheduled/completed tabs | Task 3 |
| 22 | Create Competition wizard | Frontend | Template picker → form → confirm | Tasks 7, 8 |
| 23 | Competition detail dashboard | Frontend | Live leaderboard, qualifiers, stats | Task 6 |
| 24 | Templates library page | Frontend | Grid of templates, "Use" buttons | Task 7 |
| 25 | Rewards catalog page | Frontend | Add/edit/archive rewards | Existing rewards API |
| 26 | Redemption queue page | Frontend | Approve/deny/fulfill flow | Existing redemptions API |
| 27 | Admin RBAC enforcement | Backend | Route guards for admin endpoints | Existing auth |

**Release Value:** Self-service competition management. Leadership empowered.

## 5.6 Phase 5: Advanced Rules & Fulfillment (Week 5-6)

**Goal:** Full rule type support and automated fulfillment readiness.

| # | Task | Area | Deliverable | Dependencies |
|---|------|------|-------------|--------------|
| 28 | Milestone rules | Backend | Multi-tier goals within competition | Task 4 |
| 29 | Improvement rules | Backend | "Beat your baseline by X%" | Task 4, metric history |
| 30 | Lottery rules | Backend | Random draw from qualifiers | Task 4 |
| 31 | Team competition support | Backend | Team aggregation, team leaderboards | Task 6 |
| 32 | FulfillmentProvider abstraction | Backend | Interface for manual + future API | Task 10 |
| 33 | Fulfillment dashboard | Frontend | Pending queue, process, history | Task 32 |
| 34 | Notification system integration | Backend | Competition events → notifications | Task 10 |

**Release Value:** Full Enzy feature parity for rules. Fulfillment streamlined.

## 5.7 Phase 6: Polish & Scale (Week 6-8)

**Goal:** Production hardening and performance optimization.

| # | Task | Area | Deliverable | Dependencies |
|---|------|------|-------------|--------------|
| 35 | Competition end job refinement | Backend | Reliable evaluation, retry logic | Task 10 |
| 36 | Results archive and history | Backend | Queryable historical data | Task 35 |
| 37 | Season standings and awards | Backend | Season champion recognition | Task 2 |
| 38 | Analytics dashboard | Frontend | Competition engagement metrics | All |
| 39 | Performance optimization | Both | Lazy loading, efficient queries | All |
| 40 | E2E test suite | Testing | Playwright tests for all flows | All |
| 41 | Mobile gesture optimization | Frontend | Touch interactions, offline support | Task 39 |
| 42 | Documentation and training | Docs | Admin guide, API docs | All |

**Release Value:** Production-ready, scalable system. Ready for partner API integrations.

## 5.8 Future: External Fulfillment Partners

| # | Provider | Integration | Status |
|---|----------|-------------|--------|
| F1 | Tremendous | Gift cards, prepaid | Planned Q2 |
| F2 | Tango Card | Digital rewards | Planned Q2 |
| F3 | SwagUp | Custom merchandise | Planned Q3 |
| F4 | Custom webhook | Generic integration | Planned Q2 |

---

# Summary

This specification transforms Eden's Harvest incentives from basic gamification into a **full Enzy-level competition platform**:

1. **Any KPI** can power competitions (doors, appointments, contracts, revenue, custom)
2. **Seasons** create sustained engagement over quarters, not random spiffs
3. **Templates** enable one-click competition launches
4. **Flexible rules** support threshold, top_n, milestone, improvement, and lottery
5. **Pluggable fulfillment** starts manual, architected for automated partners
6. **Omnipresent recognition** integrates into Today, Leaderboard, Challenges, Profile
7. **Real-time updates** keep reps engaged with live rank changes and notifications
8. **Premium UI** with thoughtful animations, celebrations, and visual hierarchy

The phased roadmap delivers a magical "wow" moment by Week 2-3, with full feature parity by Week 6-8.

---

*Eden Claims Platform — Stewardship and Excellence in Claims Handling*

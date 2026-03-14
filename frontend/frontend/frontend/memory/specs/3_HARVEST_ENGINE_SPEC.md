# HARVEST ENGINE SPEC
## Build-Ready Technical Patterns

---

## 1. DATA MODELS

### 1.1 Pin Model
```typescript
interface Pin {
  id: string;                    // UUID
  created_at: datetime;          // ISO timestamp
  updated_at: datetime;          // ISO timestamp
  
  // Location
  latitude: number;              // GPS coordinate
  longitude: number;             // GPS coordinate
  address: string;               // Geocoded address
  city: string;
  state: string;
  zip: string;
  
  // Status
  disposition: DispositionType;  // Current status
  disposition_history: DispositionEvent[];
  
  // Ownership
  rep_id: string;                // Assigned rep
  turf_id: string;               // Territory assignment
  org_id: string;                // Organization
  
  // Contact Info
  homeowner_name?: string;
  phone?: string;
  email?: string;
  
  // Metadata
  notes: string;
  tags: string[];
  source: 'manual' | 'import' | 'lead_machine';
  
  // Scheduling
  callback_time?: datetime;
  appointment_time?: datetime;
  
  // Scoring
  points_awarded: number;
  knocked_count: number;
  last_knocked_at?: datetime;
}

type DispositionType = 
  | 'unmarked'
  | 'not_home'
  | 'not_interested'
  | 'callback'
  | 'appointment'
  | 'signed'
  | 'do_not_knock'
  | 'renter';
```

### 1.2 Disposition Event Model
```typescript
interface DispositionEvent {
  id: string;
  pin_id: string;
  rep_id: string;
  
  from_status: DispositionType;
  to_status: DispositionType;
  
  timestamp: datetime;
  latitude: number;              // Rep location at time of change
  longitude: number;
  
  notes?: string;
  points_awarded: number;
}
```

### 1.3 Turf Model
```typescript
interface Turf {
  id: string;
  name: string;
  org_id: string;
  
  // Geometry
  coordinates: [number, number][]; // Polygon vertices
  center: [number, number];
  
  // Assignment
  assigned_rep_ids: string[];
  manager_id: string;
  
  // Stats (computed)
  total_pins: number;
  pins_by_status: Record<DispositionType, number>;
  coverage_percentage: number;
  
  // Metadata
  color: string;                 // Display color
  created_at: datetime;
  updated_at: datetime;
}
```

### 1.4 Rep Event Model (For Scoring)
```typescript
interface RepEvent {
  id: string;
  rep_id: string;
  org_id: string;
  
  event_type: RepEventType;
  timestamp: datetime;
  
  // Location
  latitude: number;
  longitude: number;
  
  // Context
  pin_id?: string;
  turf_id?: string;
  competition_id?: string;
  
  // Scoring
  base_points: number;
  multiplier: number;
  final_points: number;
  
  // Metadata
  metadata: Record<string, any>;
}

type RepEventType =
  | 'door_knocked'
  | 'contact_made'
  | 'callback_scheduled'
  | 'appointment_set'
  | 'contract_signed'
  | 'first_knock_of_day'
  | 'streak_maintained'
  | 'badge_earned'
  | 'competition_milestone';
```

### 1.5 Score Event Model (Event Sourcing)
```typescript
interface ScoreEvent {
  id: string;
  rep_id: string;
  
  // Event data
  event_type: string;
  points_delta: number;          // Can be negative for corrections
  timestamp: datetime;
  
  // Source reference
  source_event_id: string;
  source_event_type: string;
  
  // Multipliers applied
  multipliers: {
    streak?: number;
    competition?: number;
    bonus?: number;
  };
  
  // Resulting state
  new_total: number;
}
```

### 1.6 Leaderboard Entry Model
```typescript
interface LeaderboardEntry {
  rep_id: string;
  org_id: string;
  
  // Period
  period: 'day' | 'week' | 'month' | 'all_time' | 'competition';
  period_start: datetime;
  period_end: datetime;
  competition_id?: string;
  
  // Scores
  total_points: number;
  
  // KPIs
  doors_knocked: number;
  contacts_made: number;
  callbacks_scheduled: number;
  appointments_set: number;
  contracts_signed: number;
  
  // Streaks
  current_streak: number;
  longest_streak: number;
  
  // Ranking
  rank: number;
  rank_change: number;           // vs previous period
  
  // Computed
  updated_at: datetime;
}
```

### 1.7 Badge Model
```typescript
interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'activity' | 'performance' | 'streak' | 'special';
  
  // Earn criteria
  criteria: {
    event_type?: RepEventType;
    threshold?: number;
    period?: 'day' | 'week' | 'month' | 'all_time';
    special_condition?: string;
  };
  
  // Rarity
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  points_bonus: number;
}

interface EarnedBadge {
  id: string;
  badge_id: string;
  rep_id: string;
  earned_at: datetime;
  earned_for_event_id?: string;
}
```

### 1.8 Competition Model
```typescript
interface Competition {
  id: string;
  org_id: string;
  name: string;
  description: string;
  
  // Timing
  start_date: datetime;
  end_date: datetime;
  status: 'upcoming' | 'active' | 'completed';
  
  // Type
  type: 'individual' | 'team';
  kpi: 'doors' | 'appointments' | 'signed' | 'points';
  
  // Participants
  participant_ids: string[];     // Rep IDs or Team IDs
  
  // Prizes
  prizes: {
    rank: number;
    description: string;
    value?: number;
  }[];
  
  // Multiplier
  points_multiplier: number;     // Applied during competition
  
  // Results
  final_rankings?: {
    rank: number;
    participant_id: string;
    score: number;
  }[];
}
```

---

## 2. STATE MACHINES

### 2.1 Pin Disposition State Machine
```
                    ┌─────────────┐
                    │  UNMARKED   │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────────┐ ┌──────────┐ ┌────────────────┐
    │   NOT_HOME   │ │  RENTER  │ │ DO_NOT_KNOCK   │
    └──────┬───────┘ └──────────┘ └────────────────┘
           │              │              │
           │              │              │ (terminal)
           ▼              │              
    ┌──────────────┐      │              
    │ CALLBACK     │◄─────┘              
    └──────┬───────┘                     
           │                             
    ┌──────┴───────┐                     
    ▼              ▼                     
┌──────────┐ ┌─────────────────┐         
│ NOT_INT  │ │   APPOINTMENT   │         
└──────────┘ └────────┬────────┘         
                      │                  
                      ▼                  
               ┌──────────┐              
               │  SIGNED  │              
               └──────────┘              

VALID TRANSITIONS:
- unmarked → any
- not_home → callback, not_interested, appointment, signed, do_not_knock
- callback → not_interested, appointment, signed, not_home
- appointment → signed, not_interested, callback
- not_interested → (terminal, but can be overridden by manager)
- signed → (terminal)
- do_not_knock → (terminal, manager override only)
- renter → do_not_knock, (terminal otherwise)
```

### 2.2 Rep Daily State Machine
```
                ┌─────────────┐
                │   OFFLINE   │
                └──────┬──────┘
                       │ app_open
                       ▼
                ┌─────────────┐
                │    IDLE     │
                └──────┬──────┘
                       │ enter_canvassing
                       ▼
                ┌─────────────┐
                │   ACTIVE    │◄────────┐
                └──────┬──────┘         │
                       │                │
           ┌───────────┼───────────┐    │
           │           │           │    │
           ▼           ▼           ▼    │
     ┌──────────┐ ┌─────────┐ ┌────────┐│
     │ KNOCKING │ │ MOVING  │ │ PAUSED ││
     └────┬─────┘ └────┬────┘ └───┬────┘│
          │            │          │     │
          └────────────┴──────────┴─────┘
                       │
                       │ day_end / logout
                       ▼
                ┌─────────────┐
                │   SYNCING   │
                └──────┬──────┘
                       │
                       ▼
                ┌─────────────┐
                │  COMPLETE   │
                └─────────────┘

STATE DATA:
- ACTIVE: GPS tracking on, events streaming
- KNOCKING: At door, bottom sheet open
- MOVING: Between doors, tracking movement
- PAUSED: Break time, tracking suspended
- SYNCING: Uploading queued events
```

---

## 3. SCORING ENGINE

### 3.1 Point Values
```typescript
const POINT_VALUES: Record<RepEventType, number> = {
  door_knocked: 1,
  contact_made: 3,
  callback_scheduled: 5,
  appointment_set: 10,
  contract_signed: 50,
  first_knock_of_day: 5,
  streak_maintained: 0,        // Multiplier only
  badge_earned: 0,             // Varies by badge
  competition_milestone: 0,    // Varies by competition
};
```

### 3.2 Multiplier Calculation
```typescript
function calculateMultiplier(rep: Rep, event: RepEvent): number {
  let multiplier = 1.0;
  
  // Streak multiplier
  const streak = rep.current_streak;
  if (streak >= 30) multiplier *= 2.0;
  else if (streak >= 10) multiplier *= 1.5;
  else if (streak >= 5) multiplier *= 1.25;
  else if (streak >= 3) multiplier *= 1.1;
  
  // Active competition multiplier
  const activeCompetition = getActiveCompetition(rep.org_id);
  if (activeCompetition && activeCompetition.participant_ids.includes(rep.id)) {
    multiplier *= activeCompetition.points_multiplier;
  }
  
  // Time-based bonuses
  const hour = new Date(event.timestamp).getHours();
  if (hour < 8 && event.event_type === 'door_knocked') {
    multiplier *= 1.1; // Early bird bonus
  }
  if (hour >= 19 && event.event_type === 'door_knocked') {
    multiplier *= 1.1; // Night owl bonus
  }
  
  return multiplier;
}
```

### 3.3 Leaderboard Computation
```typescript
// Using event sourcing pattern
async function computeLeaderboard(
  org_id: string,
  period: LeaderboardPeriod,
  kpi: string
): Promise<LeaderboardEntry[]> {
  
  const periodStart = getPeriodStart(period);
  const periodEnd = getPeriodEnd(period);
  
  // Aggregate score events
  const pipeline = [
    {
      $match: {
        org_id,
        timestamp: { $gte: periodStart, $lte: periodEnd }
      }
    },
    {
      $group: {
        _id: '$rep_id',
        total_points: { $sum: '$points_delta' },
        doors_knocked: {
          $sum: { $cond: [{ $eq: ['$event_type', 'door_knocked'] }, 1, 0] }
        },
        appointments_set: {
          $sum: { $cond: [{ $eq: ['$event_type', 'appointment_set'] }, 1, 0] }
        },
        contracts_signed: {
          $sum: { $cond: [{ $eq: ['$event_type', 'contract_signed'] }, 1, 0] }
        }
      }
    },
    {
      $sort: { [kpi === 'points' ? 'total_points' : kpi]: -1 }
    },
    {
      $setWindowFields: {
        sortBy: { total_points: -1 },
        output: {
          rank: { $rank: {} }
        }
      }
    }
  ];
  
  return await ScoreEvent.aggregate(pipeline);
}
```

---

## 4. OFFLINE ARCHITECTURE

### 4.1 Local Storage Schema
```typescript
interface LocalStore {
  // Pending actions queue
  pendingEvents: RepEvent[];
  
  // Cached data
  pins: Map<string, Pin>;
  turfs: Map<string, Turf>;
  leaderboard: LeaderboardEntry[];
  
  // Sync metadata
  lastSyncTimestamp: datetime;
  syncStatus: 'idle' | 'syncing' | 'error';
  
  // User state
  currentRepId: string;
  currentTurfId: string;
  gpsTrail: [number, number, datetime][];
}
```

### 4.2 Offline Action Queue
```typescript
interface QueuedAction {
  id: string;
  type: 'pin_create' | 'pin_update' | 'disposition_change' | 'gps_update';
  payload: any;
  timestamp: datetime;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
}

class OfflineQueue {
  private queue: QueuedAction[] = [];
  
  enqueue(action: Omit<QueuedAction, 'id' | 'status' | 'retryCount'>): void {
    this.queue.push({
      ...action,
      id: uuid(),
      status: 'pending',
      retryCount: 0
    });
    this.persistQueue();
  }
  
  async sync(): Promise<void> {
    const pending = this.queue.filter(a => a.status === 'pending');
    
    for (const action of pending) {
      try {
        action.status = 'syncing';
        await this.sendToServer(action);
        action.status = 'completed';
      } catch (error) {
        action.retryCount++;
        action.status = action.retryCount >= 3 ? 'failed' : 'pending';
      }
    }
    
    // Remove completed
    this.queue = this.queue.filter(a => a.status !== 'completed');
    this.persistQueue();
  }
}
```

### 4.3 Conflict Resolution
```typescript
// Last-write-wins with timestamp
function resolveConflict(local: Pin, remote: Pin): Pin {
  if (local.updated_at > remote.updated_at) {
    return local;
  }
  return remote;
}

// For disposition changes, always take the "more progressed" state
function resolveDispositionConflict(
  local: DispositionType,
  remote: DispositionType
): DispositionType {
  const priority: Record<DispositionType, number> = {
    unmarked: 0,
    not_home: 1,
    renter: 1,
    callback: 2,
    not_interested: 3,
    appointment: 4,
    signed: 5,
    do_not_knock: 6
  };
  
  return priority[local] > priority[remote] ? local : remote;
}
```

---

## 5. PERFORMANCE TARGETS

### 5.1 Response Time Budgets
```
ACTION                    TARGET      MAX
─────────────────────────────────────────
App launch to map         1.5s        3s
Pin tap to sheet open     50ms        100ms
Disposition change        50ms        100ms
Leaderboard refresh       200ms       500ms
Map pan/zoom frame        16ms        33ms
GPS location update       100ms       500ms
Offline queue persist     10ms        50ms
Background sync           5s          15s
```

### 5.2 Data Size Budgets
```
DATA TYPE                 SIZE LIMIT
─────────────────────────────────────
Pins in viewport          500 max
Leaderboard entries       100 per view
GPS trail points          500 stored
Offline queue size        1000 actions
Pin history events        50 per pin
```

### 5.3 Battery Optimization
```typescript
const GPS_CONFIG = {
  active_interval: 5000,      // ms between updates when active
  idle_interval: 30000,       // ms between updates when idle
  accuracy: 'high',           // 'high' | 'balanced' | 'low'
  batch_threshold: 10,        // Updates before batch upload
  background_mode: false      // Disable when app backgrounded
};
```

---

## 6. API CONTRACTS

### 6.1 Pin Endpoints
```
POST   /api/harvest/pins              Create pin
GET    /api/harvest/pins              List pins (with geo filter)
GET    /api/harvest/pins/:id          Get pin detail
PATCH  /api/harvest/pins/:id          Update pin
DELETE /api/harvest/pins/:id          Delete pin

POST   /api/harvest/pins/:id/disposition  Change disposition
GET    /api/harvest/pins/:id/history      Get disposition history
```

### 6.2 Leaderboard Endpoints
```
GET    /api/harvest/leaderboard       Get leaderboard
       ?period=day|week|month|all_time
       ?kpi=points|doors|appointments|signed
       ?limit=10|50|100

GET    /api/harvest/leaderboard/me    Get my rank + nearby
```

### 6.3 Event Streaming
```
WebSocket /ws/harvest/events

EVENTS EMITTED:
- pin_created
- pin_updated
- disposition_changed
- leaderboard_updated
- competition_updated
- badge_earned

EVENTS RECEIVED:
- rep_location_update
- disposition_change
- pin_create
```

---

## 7. IMPLEMENTATION PRIORITIES

### Phase 1: Core Loop
1. Pin drop (one-tap)
2. Disposition change (one-tap)
3. Optimistic UI updates
4. Local persistence

### Phase 2: Gamification
1. Score event streaming
2. Leaderboard computation
3. Real-time leaderboard updates
4. Badge evaluation engine

### Phase 3: Offline
1. Action queue
2. Background sync
3. Conflict resolution
4. Offline-first GPS

### Phase 4: Scale
1. Redis leaderboard cache
2. WebSocket event broadcasting
3. Sharded score computation
4. CDN for map tiles

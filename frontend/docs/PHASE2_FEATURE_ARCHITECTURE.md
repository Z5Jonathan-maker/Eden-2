# Phase 2: Feature-Based Architecture Plan

## Overview

Transform the monolithic component structure into a scalable feature-based architecture following Domain-Driven Design principles.

## Current Structure Problems

### Issue 1: Monolithic Components
```
src/components/
├── ClaimDetails.jsx       (88KB, 2000 lines, 58 useState!)
├── Harvest.jsx            (92KB, 2300 lines)
├── IncentivesAdminConsole (109KB, 2800 lines)
└── 214 more components...
```

**Problems:**
- Impossible to maintain
- Poor performance (too many re-renders)
- Hard to test
- Difficult onboarding
- High cognitive load

### Issue 2: No Clear Domain Boundaries
Everything in `components/` - no separation of concerns:
- Business logic mixed with UI
- API calls scattered across components
- Duplicate code between similar features
- No clear ownership

### Issue 3: Poor Code Reusability
- Duplicate utilities (`coerceNumber` in 3 places)
- API calls duplicated (no service layer)
- Styles repeated (no design system)

---

## Target Architecture

### Feature-Based Structure
```
src/
├── features/              # Business domains
│   ├── claims/
│   │   ├── api/          # API client for claims
│   │   ├── components/   # Claim-specific components
│   │   ├── hooks/        # Claim-specific hooks
│   │   ├── types/        # TypeScript types
│   │   ├── utils/        # Claim utilities
│   │   └── index.ts      # Public API
│   │
│   ├── harvest/          # Harvest feature
│   │   ├── api/
│   │   ├── components/
│   │   │   ├── MapView.tsx
│   │   │   ├── TodayTab.tsx
│   │   │   ├── ChallengesTab.tsx
│   │   │   └── ProfileTab.tsx
│   │   ├── hooks/
│   │   ├── store/        # Zustand store for Harvest state
│   │   └── index.ts
│   │
│   ├── incentives/       # Incentives/BattlePass
│   ├── contracts/        # Contracts management
│   ├── documents/        # Document management
│   ├── weather/          # Weather verification
│   └── ai/               # AI assistant (EveAI)
│
├── shared/               # Shared across features
│   ├── ui/              # Design system components
│   │   ├── Button/
│   │   ├── Card/
│   │   ├── Dialog/
│   │   └── index.ts
│   ├── hooks/           # Generic hooks
│   ├── utils/           # Generic utilities
│   ├── types/           # Shared types
│   └── layouts/         # Page layouts
│
├── lib/                 # Core libraries
│   ├── api.ts           # Base API client
│   ├── sentry.ts        # Error tracking
│   ├── auth.ts          # Auth utilities
│   └── constants.ts     # App constants
│
└── pages/               # Route pages (thin, compose features)
    ├── ClaimsPage.tsx
    ├── HarvestPage.tsx
    └── DashboardPage.tsx
```

---

## Migration Strategy

### Phase 2A: Create Feature Structure (2 days)

1. **Create Directory Structure**
   ```bash
   mkdir -p src/features/{claims,harvest,incentives,contracts,documents}
   mkdir -p src/shared/{ui,hooks,utils,types,layouts}
   mkdir -p src/pages
   ```

2. **Move Existing Components**
   - Start with smaller features (contracts, documents)
   - Extract into feature modules
   - Create feature index.ts with public API

3. **Create Feature Template**
   ```typescript
   // features/[feature]/index.ts
   export { default as FeaturePage } from './components/FeaturePage';
   export * from './hooks';
   export * from './types';
   export { featureApi } from './api';
   ```

### Phase 2B: Extract Design System (3 days)

**Goal:** Move Radix UI components to `shared/ui/`

1. **Audit Current UI Components**
   ```bash
   ls src/components/ui/*.jsx
   # ~30 UI components from Radix
   ```

2. **Move to Shared**
   ```
   src/components/ui/ → src/shared/ui/
   ```

3. **Document Each Component**
   - Props interface
   - Usage examples
   - Storybook stories

### Phase 2C: Break Up Monolithic Components (5 days)

#### ClaimDetails.jsx (88KB → 6 components)

**Before:**
```jsx
// ClaimDetails.jsx - 2000 lines, 58 useState
function ClaimDetails() {
  const [claim, setClaim] = useState(null);
  const [notes, setNotes] = useState([]);
  const [documents, setDocuments] = useState([]);
  // ... 55 more useState
  return (
    <div>
      {/* Massive JSX */}
    </div>
  );
}
```

**After:**
```typescript
// features/claims/components/ClaimDetailsPage.tsx (200 lines)
export function ClaimDetailsPage() {
  const { claimId } = useParams();
  const { claim, loading } = useClaimDetails(claimId);

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-2">
        <ClaimOverview claim={claim} />
        <ClaimTimeline claim={claim} />
      </div>
      <div>
        <ClaimNotes claimId={claimId} />
        <ClaimDocuments claimId={claimId} />
      </div>
    </div>
  );
}

// features/claims/components/ClaimOverview.tsx (150 lines)
// features/claims/components/ClaimTimeline.tsx (200 lines)
// features/claims/components/ClaimNotes.tsx (180 lines)
// features/claims/components/ClaimDocuments.tsx (150 lines)
// features/claims/hooks/useClaimDetails.ts (100 lines)
```

**Benefits:**
- Each component <200 lines
- Single responsibility
- Testable in isolation
- Reusable across features

#### Harvest.jsx (92KB → 8 components)

**Break into:**
```
features/harvest/
├── components/
│   ├── HarvestPage.tsx       (Main layout, 150 lines)
│   ├── MapView.tsx           (Map with pins, 300 lines)
│   ├── TodayTab.tsx          (Today's tasks, 200 lines)
│   ├── ChallengesTab.tsx     (Challenges, 180 lines)
│   ├── ProfileTab.tsx        (User profile, 150 lines)
│   ├── LeaderboardTab.tsx    (Rankings, 120 lines)
│   └── BadgesTab.tsx         (Achievements, 100 lines)
├── hooks/
│   ├── useHarvestPins.ts     (Map pins management)
│   ├── useHarvestMetrics.ts  (Stats calculations)
│   └── useOfflineSync.ts     (Offline support)
├── store/
│   └── harvestStore.ts       (Zustand store for state)
└── api/
    └── harvestApi.ts         (API calls)
```

---

## Feature Template

Every feature follows this structure:

```typescript
// features/[feature]/
├── api/
│   └── [feature]Api.ts         # API client
├── components/
│   ├── [Feature]Page.tsx       # Main page component
│   ├── [Feature]List.tsx       # List view
│   ├── [Feature]Detail.tsx     # Detail view
│   └── [Feature]Form.tsx       # Create/edit form
├── hooks/
│   ├── use[Feature].ts         # Main hook
│   └── use[Feature]Mutations.ts # Create/update/delete
├── types/
│   └── [feature].types.ts      # TypeScript interfaces
├── utils/
│   └── [feature].utils.ts      # Feature-specific utilities
├── store/ (if needed)
│   └── [feature]Store.ts       # Zustand store
└── index.ts                     # Public API
```

---

## Rules & Guidelines

### 1. Feature Independence
- Features should NOT import from other features
- Use shared/ for cross-feature code
- Features can import from lib/ and shared/

### 2. Component Size Limits
- Max 200 lines per component
- Max 5 props per component
- Extract to sub-components if exceeding

### 3. State Management
- Local state: `useState` (component-only)
- Shared feature state: Zustand store
- Global state: React Context (auth, theme)
- Server state: TanStack Query (coming in Phase 3)

### 4. File Naming Conventions
```
components/  → PascalCase (ClaimsList.tsx)
hooks/       → camelCase (useClaimList.ts)
utils/       → camelCase (formatClaimId.ts)
types/       → camelCase (claim.types.ts)
api/         → camelCase (claimsApi.ts)
```

### 5. Import Rules
```typescript
// ✅ Good: Feature imports from shared
import { Button } from '@/shared/ui';
import { formatDate } from '@/shared/utils';

// ✅ Good: Feature imports from lib
import { apiGet } from '@/lib/api';

// ❌ Bad: Feature imports from another feature
import { ClaimsList } from '@/features/claims';

// ✅ Good: Use shared/ui instead
import { List } from '@/shared/ui';
```

---

## Migration Checklist

### Week 1: Structure & Design System
- [ ] Create feature directories
- [ ] Move ui/ components to shared/ui/
- [ ] Update imports across app
- [ ] Test: App still works

### Week 2: Extract First Feature (Contracts)
- [ ] Create features/contracts/
- [ ] Move contracts components
- [ ] Create contracts API client
- [ ] Create contracts hooks
- [ ] Update routes
- [ ] Test: Contracts feature works

### Week 3: Extract Harvest
- [ ] Break Harvest.jsx into 8 components
- [ ] Create harvest store (Zustand)
- [ ] Extract harvest hooks
- [ ] Create harvest API client
- [ ] Test: Harvest feature works

### Week 4: Extract Claims
- [ ] Break ClaimDetails.jsx into 6 components
- [ ] Create claims API client
- [ ] Extract claims hooks
- [ ] Update routes
- [ ] Test: Claims feature works

---

## Success Metrics

### Code Quality
- **Average component size:** <200 lines (currently 400+)
- **Max component size:** <500 lines (currently 2800)
- **Components with <10 useState:** 100% (currently 20%)

### Developer Experience
- **Time to find code:** <1 minute (currently 5+ minutes)
- **Time to add feature:** -50% (clearer structure)
- **New dev onboarding:** -60% (better docs, clear structure)

### Performance
- **Bundle size:** -20% (better code splitting)
- **Initial load:** -30% (lazy loading by feature)
- **Re-render frequency:** -50% (smaller components)

---

## Resources

- [Feature-Sliced Design](https://feature-sliced.design/)
- [Domain-Driven Design](https://khalilstemmler.com/articles/domain-driven-design-intro/)
- [Modular Monolith](https://www.thoughtworks.com/insights/blog/modular-monoliths)

---

## Timeline

**Total Time:** 3 weeks (120 hours)

- Week 1: Structure + Design System (40h)
- Week 2: 2 features (Contracts, Documents) (40h)
- Week 3: 2 features (Harvest, Claims) (40h)

**ROI:**
- Improved maintainability
- Faster feature development
- Better code reusability
- Easier testing
- Clearer ownership

---

*Next: Begin Phase 2A - Create Feature Structure*

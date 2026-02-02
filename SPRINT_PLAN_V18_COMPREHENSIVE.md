# Sprint Plan V18: Comprehensive Platform Hardening

**Created**: February 1, 2026  
**Status**: Ready for Execution  
**Reviewed By**: Subagent (corrections incorporated)  
**Goal**: Harden platform integration, eliminate technical debt, achieve production-grade reliability

---

## Executive Summary

### Current State (Validated)
| Metric | Value | Status |
|--------|-------|--------|
| App.tsx lines | 3,473 | 🔴 Critical - God component |
| Tests passing | 3,285 / 3,289 | ✅ Good |
| Components | 67 | ✅ Good |
| Railway backend | Healthy | ✅ Good |
| E2E specs | 18 | ⚠️ Needs desktop coverage |

### What's Already Done (Subagent Validated)
- ✅ `main.tsx` wraps App with `AppProvider`
- ✅ `DesktopLayout` component imported and used in App.tsx
- ✅ `useSequences` hook exists with full Railway CRUD
- ✅ Webhook Railway sync implemented (calendly.ts, inbound.ts)
- ✅ Railway healthy and deployed
- ✅ LazyIcon system for INP performance

### Critical Gaps Remaining
| Gap | Impact | Sprint |
|-----|--------|--------|
| App.tsx still 3,473 lines with 50+ useState | Unmaintainable | 901 |
| SequenceBuilder uses Firestore, not Railway | Data inconsistency | 903 |
| No webhook integration tests | Untested Railway sync | 900 |
| No production smoke tests in CI | Silent failures | 904 |
| Desktop E2E coverage minimal | Regressions | 905 |
| Tier type mismatches (T1 vs Tier 1) | Runtime bugs | 902 |

---

## Sprint Order (Optimized)

```
Sprint 900: Webhook Integration Tests (SAFETY NET)
    ↓
Sprint 901: App.tsx Decomposition (FOUNDATION)
    ↓
Sprint 902: Type Safety Layer (CORRECTNESS)
    ↓
Sprint 903: SequenceBuilder Railway Integration (FEATURE)
    ↓
Sprint 904: Production Monitoring (RELIABILITY)
    ↓
Sprint 905: E2E Desktop Coverage (QUALITY)
```

**Rationale**: Build safety nets (tests) before major refactoring.

---

## Sprint 900: Webhook Integration Tests

**Goal**: Verify webhooks correctly sync to BOTH Firestore AND Railway  
**Effort**: 4-6 hours  
**Demoable**: Test suite proves bidirectional sync works  
**Validation**: `npm test -- --run src/__tests__/api/webhook-integration*.test.ts` passes

### T900.1: Create Railway Server Client Mock Utility

**Files to create**: 
- `src/__tests__/mocks/railwayServerClient.mock.ts`

**Implementation**:
```typescript
import { vi } from 'vitest';

export const mockRailwayServerClient = {
  patch: vi.fn().mockResolvedValue({ ok: true }),
  get: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  post: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  delete: vi.fn().mockResolvedValue({ ok: true }),
};

export function resetRailwayMocks() {
  Object.values(mockRailwayServerClient).forEach(fn => fn.mockClear());
}
```

**Test**: Import and call mock, verify it captures calls.

---

### T900.2: Calendly Webhook Integration Test - Meeting Booked

**Files to create**: 
- `src/__tests__/api/webhook-integration-calendly.test.ts`

**Test Cases**:
1. `invitee.created` → Firestore enrollment status = 'meeting'
2. `invitee.created` → Railway `patch()` called with correct payload
3. Railway failure → Firestore still updated (non-blocking)
4. Missing `railwayEnrollmentId` → No Railway call, no error

**Validation Pattern**:
```typescript
it('syncs meeting status to Railway', async () => {
  // Setup: Create enrollment with railwayEnrollmentId
  // Act: Call handler with invitee.created payload
  // Assert: mockRailwayServerClient.patch called with:
  //   - endpoint: /api/enrollments/{id}
  //   - body: { status: 'meeting', completionReason: 'meeting_booked' }
});
```

---

### T900.3: Calendly Webhook Integration Test - Meeting Canceled

**Test Cases**:
1. `invitee.canceled` → Firestore meeting status = 'canceled'
2. Prospect status updated back to previous state (if applicable)

---

### T900.4: Inbound Webhook Integration Test - Reply Detected

**Files to create**: 
- `src/__tests__/api/webhook-integration-inbound.test.ts`

**Test Cases**:
1. Human reply → Firestore enrollment status = 'replied'
2. Human reply → Railway `patch()` called with `status: 'replied'`
3. OOO detected → Firestore enrollment status = 'paused'
4. OOO detected → Railway `patch()` called with `status: 'paused', resumeAt: <date>`
5. Railway failure → Logged but Firestore updated

---

### T900.5: Inbound Webhook Integration Test - OOO with Resume Date

**Test Cases**:
1. Parse "Back on March 1st" → resumeAt = March 1, 2026
2. Parse "Out until next week" → resumeAt = 7 days from now
3. No return date → Default 7-day pause

---

### T900.6: SendGrid Webhook Suppression Test

**Files to create**: 
- `src/__tests__/api/webhook-integration-sendgrid.test.ts`

**Test Cases**:
1. `bounce` event → Email added to suppression list
2. `spamreport` event → Email added to suppression list
3. `unsubscribe` event → Email added to suppression list
4. `open` event → Recorded in email_events, NOT suppressed

---

### T900.7: Error Handling & Logging Test

**Test Cases**:
1. Invalid signature → 401 returned, no processing
2. Missing payload fields → 400 returned, logged
3. Railway timeout → Firestore updated, error logged, 200 returned

---

## Sprint 901: App.tsx Decomposition

**Goal**: Reduce App.tsx from 3,473 to <800 lines  
**Effort**: 8-12 hours  
**Demoable**: App works identically, architecture clean  
**Validation**: 
- `wc -l src/App.tsx` < 800
- All existing tests pass
- No new console errors

### T901.0: Audit App.tsx Structure

**Actions**:
1. Document all 50+ useState calls by domain
2. Identify already-extracted components not being used
3. List inline JSX blocks >50 lines that should be components
4. Create extraction priority order

**Deliverable**: Comment in PR with extraction plan

---

### T901.1: Extract Firebase Initialization to lib/firebase.ts

**Problem**: App.tsx initializes Firebase inline (lines 33-45). This conflicts with `getAdminDb()` pattern.

**Files to create**:
- `src/lib/firebase.ts`

**Implementation**:
```typescript
// src/lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  // ... rest of config
};

// Singleton pattern - prevent double initialization
const app = getApps().length === 0 
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };
```

**Test**: Import from `lib/firebase.ts`, verify no "already initialized" error.

---

### T901.2: Extract ProspectDetailPanel Component

**Current**: Lines ~2400-2900 in App.tsx

**Files to create**:
- `src/components/panels/ProspectDetailPanel.tsx`
- `src/__tests__/components/panels/ProspectDetailPanel.test.tsx`

**Props Interface**:
```typescript
interface ProspectDetailPanelProps {
  prospect: Prospect;
  onClose: () => void;
  onStatusChange: (status: string) => void;
  onEmailEdit: (email: string) => void;
  onEnroll: (sequenceId: string) => void;
  onBookMeeting: () => void;
  enrollment?: SequenceEnrollment;
}
```

**Test Cases**:
1. Renders prospect name, company, title
2. Status change calls handler
3. Close button calls onClose
4. Email editing works

---

### T901.3: Extract HitlistPanel Component

**Current**: Lines ~2000-2400 in App.tsx

**Files to create**:
- `src/components/panels/HitlistPanel.tsx`
- `src/__tests__/components/panels/HitlistPanel.test.tsx`

**Props Interface**:
```typescript
interface HitlistPanelProps {
  prospects: Prospect[];
  selectedIds: Set<string>;
  onSelect: (id: string, event: React.MouseEvent) => void;
  onSelectAll: () => void;
  onProspectClick: (prospect: Prospect) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  tierFilter: string;
  onTierFilterChange: (tier: string) => void;
}
```

**Test Cases**:
1. Renders list of prospects
2. Filter input filters list
3. Tier filter works
4. Selection works

---

### T901.4: Extract DashboardPanel Component

**Current**: Lines ~1850-2000 in App.tsx

**Files to create**:
- `src/components/panels/DashboardPanel.tsx`
- `src/__tests__/components/panels/DashboardPanel.test.tsx`

**Test Cases**:
1. Renders KPI cards
2. Renders charts
3. Date range picker works

---

### T901.5: Extract MainContent Tab Router

**Current**: Giant switch/case for tabs in App.tsx

**Files to create**:
- `src/components/MainContent.tsx`

**Implementation**:
```typescript
interface MainContentProps {
  activeTab: TabId;
  // Pass only what's needed per tab, not everything
}

export function MainContent({ activeTab }: MainContentProps) {
  switch (activeTab) {
    case 'dashboard': return <DashboardPanel />;
    case 'prospects': return <HitlistPanel />;
    case 'sequences': return <SequenceManagerPanel />;
    // ... etc
  }
}
```

**Test**: Renders correct panel for each tab.

---

### T901.6: State Consolidation with useReducer

**Current**: 50+ individual useState calls

**Files to create**:
- `src/hooks/useAppState.ts`

**Group state by domain**:
```typescript
interface AppState {
  // Navigation
  activeTab: TabId;
  isSidebarOpen: boolean;
  
  // Selection
  selectedProspect: Prospect | null;
  selectedIds: Set<string>;
  
  // Modals
  showSequenceBuilder: boolean;
  showMeetingModal: boolean;
  bulkActionModal: 'sequence' | 'tag' | 'delete' | null;
  
  // Filters
  filter: string;
  tierFilter: string;
  dateRange: DateRange;
}

type AppAction = 
  | { type: 'SET_TAB'; tab: TabId }
  | { type: 'SELECT_PROSPECT'; prospect: Prospect | null }
  | { type: 'TOGGLE_SIDEBAR' }
  // ... etc
```

**Test**: Dispatch actions, verify state changes.

---

### T901.7: Delete Dead Code

**Actions**:
1. Run `npx knip` to find unused exports
2. Remove commented-out code
3. Remove unused imports
4. Remove duplicate type definitions

**Validation**: Build passes, no warnings about unused.

---

## Sprint 902: Type Safety Layer

**Goal**: Eliminate Firestore/Railway type mismatches  
**Effort**: 4-6 hours  
**Demoable**: Type errors caught at compile time  
**Validation**: `npx tsc --noEmit` passes with strict mode

### T902.1: Audit Tier Type Usage

**Action**: Find all tier usage patterns

```bash
grep -rn "'T1'\|'T2'\|'T3'\|'Tier 1'\|'Tier 2'\|'Tier 3'" src/ --include="*.ts" --include="*.tsx" | wc -l
```

**Deliverable**: Document in PR which pattern is used where.

---

### T902.2: Create Tier Adapter Utility

**Files to create**:
- `src/utils/tierAdapter.ts`
- `src/__tests__/utils/tierAdapter.test.ts`

**Implementation**:
```typescript
export type FirestoreTier = 'T1' | 'T2' | 'T3' | 'T4';
export type RailwayTier = 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4';

export function toRailwayTier(tier: FirestoreTier): RailwayTier {
  const map: Record<FirestoreTier, RailwayTier> = {
    'T1': 'Tier 1',
    'T2': 'Tier 2', 
    'T3': 'Tier 3',
    'T4': 'Tier 4',
  };
  return map[tier];
}

export function toFirestoreTier(tier: RailwayTier): FirestoreTier {
  const map: Record<RailwayTier, FirestoreTier> = {
    'Tier 1': 'T1',
    'Tier 2': 'T2',
    'Tier 3': 'T3',
    'Tier 4': 'T4',
  };
  return map[tier];
}
```

**Test Cases**:
1. Converts all tiers both directions
2. Handles unknown tier gracefully (throws or defaults)

---

### T902.3: Create Prospect Mapper Utility

**Files to create**:
- `src/utils/prospectMapper.ts`
- `src/__tests__/utils/prospectMapper.test.ts`

**Implementation**:
```typescript
import type { Prospect } from '@/types/firestore';
import type { CreateProspectRequest, RailwayProspect } from '@/types/railway';
import { toRailwayTier, toFirestoreTier } from './tierAdapter';

export function toRailwayProspect(prospect: Prospect): CreateProspectRequest {
  return {
    email: prospect.email,
    firstName: prospect.name.split(' ')[0],
    lastName: prospect.name.split(' ').slice(1).join(' '),
    company: prospect.company,
    title: prospect.title,
    tier: toRailwayTier(prospect.tier as FirestoreTier),
    // ... map all fields
  };
}

export function toFirestoreProspect(prospect: RailwayProspect): Partial<Prospect> {
  return {
    name: `${prospect.firstName} ${prospect.lastName}`,
    email: prospect.email,
    company: prospect.company,
    tier: toFirestoreTier(prospect.tier),
    // ... map all fields
  };
}
```

---

### T902.4: Create Enrollment Status Mapper

**Files to create**:
- `src/utils/enrollmentMapper.ts`

**Implementation**: Map between Firestore and Railway enrollment status representations.

---

### T902.5: Add Zod Schemas for Webhook Payloads

**Files to create**:
- `src/schemas/webhooks.ts`

**Implementation**:
```typescript
import { z } from 'zod';

export const CalendlyInviteeSchema = z.object({
  uri: z.string(),
  email: z.string().email(),
  name: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

export const CalendlyEventSchema = z.object({
  event: z.enum(['invitee.created', 'invitee.canceled']),
  payload: z.object({
    invitee: CalendlyInviteeSchema,
    event: z.object({
      uri: z.string(),
      name: z.string(),
      start_time: z.string(),
      end_time: z.string(),
    }),
  }),
});
```

**Test**: Parse valid/invalid payloads, verify errors.

---

### T902.6: Apply Mappers to Railway API Calls

**Actions**:
1. Find all `railwayClient` calls that pass prospect data
2. Wrap with `toRailwayProspect()` mapper
3. Find all responses, wrap with `toFirestoreProspect()`

**Validation**: TypeScript errors if wrong type passed.

---

## Sprint 903: SequenceBuilder Railway Integration

**Goal**: SequenceBuilder creates/updates sequences in Railway (not just Firestore)  
**Effort**: 6-8 hours  
**Demoable**: Create sequence → appears in Railway → enroll prospects  
**Validation**: Sequence created via UI visible in Railway database

### T903.1: Wire SequenceBuilder to useSequences Hook

**Current Problem**: SequenceBuilder uses `EmailSequenceService` which writes to Firestore.

**Files to modify**:
- `src/components/SequenceBuilder.tsx`

**Changes**:
```typescript
// Before:
import { createSequence } from '@/services/EmailSequenceService';

// After:
import { useSequences } from '@/hooks/useSequences';

function SequenceBuilder({ onSave, onCancel }: Props) {
  const { createSequence, updateSequence, isCreating } = useSequences();
  
  const handleSave = async () => {
    const result = await createSequence(sequence);
    if (result.ok) {
      onSave?.(result.data);
    }
  };
}
```

**Test**: Create sequence, verify Railway client called.

---

### T903.2: Add Loading States to SequenceBuilder

**Implementation**:
- Show spinner when creating/updating
- Disable save button during operation
- Show success/error toast

**Test**: UI shows loading state during save.

---

### T903.3: Load Existing Sequences for Editing

**Implementation**:
```typescript
// When editing existing sequence
const { sequence, isLoading } = useSequence(sequenceId);

useEffect(() => {
  if (sequence) {
    setLocalSequence(sequence);
  }
}, [sequence]);
```

**Test**: Open existing sequence, fields populated.

---

### T903.4: Delete Sequence Functionality

**Implementation**:
- Add delete button with confirmation
- Call `deleteSequence(id)` from hook
- Show success toast, close builder

**Test**: Delete sequence, verify removed from list.

---

### T903.5: Sequence Template Library (Enhancement)

**Files to create**:
- `src/components/SequenceTemplateLibrary.tsx`

**Templates**:
1. "3-Touch Quick" - 3 emails over 1 week
2. "5-Touch Standard" - 5 emails over 2 weeks
3. "Long-Play Nurture" - 8 emails over 6 weeks

**Test**: Select template, sequence populated.

---

### T903.6: Sequence Preview Mode

**Implementation**:
- "Preview" tab shows rendered emails
- Variable replacement with sample data
- Send test email to self

**Test**: Preview shows interpolated content.

---

### T903.7: E2E Test - Sequence Creation Flow

**Files to create**:
- `e2e/sequence-builder.spec.ts`

**Test Flow**:
1. Open SequenceBuilder
2. Add 3 steps
3. Set content and delays
4. Save
5. Verify appears in sequence list
6. Enroll prospect
7. Verify enrollment created

---

### T903.8: Inject "Primo" Presets

**Implementation**:
- Add a "Load Success Metrics" button to the Sequence Builder
- Auto-populates the email body with the verified Primo stats:
  - $30M EBITDA
  - 4% Volume
  - Headcount neutral

### T903.9: Dynamic ROI Snippet

**Implementation**:
- Create a variable `{{estimated_roi}}`
- Logic: `Facilities * $1M`
- Inserts calculated value into the email template automatically

---

## Sprint 904: Production Monitoring

**Goal**: Automated verification of production readiness  
**Effort**: 4-6 hours  
**Demoable**: CI blocks deploy on health check failure  
**Validation**: Failed health check prevents deployment

### T904.1: Enhance /api/health Endpoint

**Current**: Basic health check exists.

**Enhancement**:
```typescript
// /api/health?details=true
{
  "status": "healthy",
  "timestamp": "2026-02-01T10:00:00Z",
  "checks": {
    "vercel": { "status": "ok" },
    "railway": { "status": "ok", "latency": 45 },
    "firebase": { "status": "ok", "latency": 23 },
    "redis": { "status": "ok" },
    "postgres": { "status": "ok" }
  },
  "version": "1.2.3",
  "commit": "abc123"
}
```

**Test**: Health endpoint returns all checks.

---

### T904.2: Add Health Check to CI Pipeline

**Files to modify**:
- `.github/workflows/ci.yml`

**Implementation**:
```yaml
smoke-test:
  needs: deploy
  runs-on: ubuntu-latest
  steps:
    - name: Wait for deployment
      run: sleep 30
    
    - name: Health check
      run: |
        response=$(curl -s ${{ secrets.PRODUCTION_URL }}/api/health?details=true)
        status=$(echo $response | jq -r '.status')
        if [ "$status" != "healthy" ]; then
          echo "Health check failed: $response"
          exit 1
        fi
```

---

### T904.3: Email Delivery Verification Script

**Files to create**:
- `scripts/verify-email-delivery.ts`

**Implementation**:
1. Send test email to known address
2. Wait for webhook (30s timeout)
3. Verify `delivered` event received
4. Return success/failure

---

### T904.4: Queue Depth Monitoring

**Implementation**:
- Check Railway queue depths via `/api/health`
- Alert if any queue > 100 items
- Alert if oldest item > 10 minutes

---

### T904.5: Create Status Page

**Files to create**:
- `src/components/StatusPage.tsx`
- Add route `/status`

**Implementation**:
- Public page showing system health
- No auth required
- Auto-refresh every 30s

---

## Sprint 905: E2E Desktop Coverage

**Goal**: E2E tests cover desktop experience  
**Effort**: 4-6 hours  
**Demoable**: Playwright runs desktop scenarios  
**Validation**: All E2E tests pass at 1440x900

### T905.1: Configure Desktop Viewport in Playwright

**Files to modify**:
- `playwright.config.ts`

**Implementation**:
```typescript
projects: [
  {
    name: 'Desktop Chrome',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1440, height: 900 },
    },
  },
  {
    name: 'Mobile Safari',
    use: { ...devices['iPhone 13'] },
  },
],
```

---

### T905.2: Sidebar Interaction E2E Tests

**Files to create**:
- `e2e/desktop-sidebar.spec.ts`

**Test Cases**:
1. Sidebar visible on desktop
2. Collapse button works
3. Collapsed state persists after refresh
4. Keyboard navigation (Arrow Up/Down)
5. Tab through nav items

---

### T905.3: Desktop Navigation E2E Tests

**Test Cases**:
1. Click each tab, verify content loads
2. Browser back button works
3. Deep link to tab works (if implemented)

---

### T905.4: Bulk Actions Desktop E2E

**Test Cases**:
1. Select multiple prospects with Shift+Click
2. Bulk actions toolbar appears
3. Bulk enroll flow works
4. Bulk tag flow works

---

### T905.5: Responsive Breakpoint Tests

**Test Cases**:
1. 1440px - Full desktop layout
2. 1024px - Compressed sidebar
3. 768px - Tablet (sidebar hidden)
4. 375px - Mobile

---

## Sprint 906: The "Manifest" Dashboard

**Goal**: Enable on-floor sales at Manifest Conference  
**Effort**: 6-8 hours  
**Demoable**: Filter by "Network Size", instant ROI calculation  

### T906.1: UI Component Scaffolding

**Implementation**:
- Create `src/components/ui/card.tsx` (or install shadcn/ui)
- Create `src/components/ui/slider.tsx`
- Ensure `ROICalculator` compiles with provided code.

### T906.2: Lead Scorer View & Facility Inference

**Implementation**:
- Create `FacilityInferenceService`:
  - Logic: IF industry = "Manufacturing/Logistics" AND employees > 1000 THEN facilities = employees / 200.
  - Else default to 1.
- Create Sortable Prospect List:
  - Sort by `estimatedFacilities` desc.
  - Filter: `isAssetBasedShipper` = true.

### T906.3: "The Brain" Integration

**Implementation**:
- Connect `useSequences` to OpenAI API.
- Prompt Engineering: 
  - "Rewrite this email to increase tension (norepinephrine) about losing market share."
  - "Rewrite this email to trigger dopamine (intrigue) about $30M savings."

---

## Validation Checklist

### Sprint 900 ✓
- [ ] `npm test -- webhook-integration` all pass
- [ ] Railway mock captures correct payloads
- [ ] Error handling tests pass

### Sprint 901 ✓
- [ ] `wc -l src/App.tsx` < 800
- [ ] All existing tests pass
- [ ] No new console errors
- [ ] Firebase init in `lib/firebase.ts`

### Sprint 902 ✓
- [ ] `npx tsc --noEmit` passes
- [ ] No runtime tier conversion errors
- [ ] Zod schemas validate webhooks

### Sprint 903 ✓
- [ ] Create sequence via UI → appears in Railway
- [ ] Edit sequence → changes in Railway
- [ ] Delete sequence → removed from Railway
- [ ] E2E test passes

### Sprint 904 ✓
- [ ] Health check returns all systems
- [ ] CI fails on unhealthy deploy
- [ ] Queue monitoring alerts work

### Sprint 905 ✓
- [ ] All E2E tests pass at 1440x900
- [ ] Sidebar tests pass
- [ ] Bulk actions tests pass

---

## Files Changed Summary

### Sprint 900 (Tests)
```
src/__tests__/mocks/railwayServerClient.mock.ts (new)
src/__tests__/api/webhook-integration-calendly.test.ts (new)
src/__tests__/api/webhook-integration-inbound.test.ts (new)
src/__tests__/api/webhook-integration-sendgrid.test.ts (new)
```

### Sprint 901 (Decomposition)
```
src/lib/firebase.ts (new)
src/components/panels/ProspectDetailPanel.tsx (new)
src/components/panels/HitlistPanel.tsx (new)
src/components/panels/DashboardPanel.tsx (new)
src/components/MainContent.tsx (new)
src/hooks/useAppState.ts (new)
src/App.tsx (reduced from 3473 to <800 lines)
```

### Sprint 902 (Types)
```
src/utils/tierAdapter.ts (new)
src/utils/prospectMapper.ts (new)
src/utils/enrollmentMapper.ts (new)
src/schemas/webhooks.ts (new)
```

### Sprint 903 (Sequence Builder)
```
src/components/SequenceBuilder.tsx (modified)
src/components/SequenceTemplateLibrary.tsx (new)
e2e/sequence-builder.spec.ts (new)
```

### Sprint 904 (Monitoring)
```
api/health.ts (enhanced)
.github/workflows/ci.yml (enhanced)
scripts/verify-email-delivery.ts (new)
src/components/StatusPage.tsx (new)
```

### Sprint 905 (E2E)
```
playwright.config.ts (enhanced)
e2e/desktop-sidebar.spec.ts (new)
e2e/desktop-navigation.spec.ts (new)
e2e/desktop-bulk-actions.spec.ts (new)
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Sprint 901 breaks app | Keep old App.tsx in git, incremental extraction |
| Type changes break runtime | Add runtime validation with Zod |
| E2E tests flaky | Use `test.retry(2)` in Playwright |
| Railway sync fails silently | Alerting in Sprint 904 |

---

## Definition of Done

Each sprint is complete when:
1. All tasks have passing tests
2. Build passes (`npm run build`)
3. Type check passes (`npx tsc --noEmit`)
4. PR reviewed and merged
5. Demo recorded or shown to stakeholder
6. Documentation updated (if applicable)

---

## Quick Start Commands

```bash
# Run specific sprint tests
npm test -- --run webhook-integration  # Sprint 900
npm test -- --run panels              # Sprint 901
npm test -- --run tierAdapter         # Sprint 902

# E2E tests
npm run test:e2e -- --project="Desktop Chrome"

# Health check
curl https://gtm-yard-flow.vercel.app/api/health?details=true | jq
```

---

## Appendix: Manifest Mission Components

### A. ROI Calculator Component (src/components/panels/ROICalculator.tsx)

```tsx
import React, { useState, useEffect } from "react";
// Assumes components created in T906.0
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from "recharts";

const ROICalculator = () => {
  const [facilities, setFacilities] = useState(50);
  const [marginPerFacility, setMarginPerFacility] = useState(1000000);
  const [networkEfficiencyGain, setNetworkEfficiencyGain] = useState(1.5); // %
  
  const [data, setData] = useState([]);

  useEffect(() => {
    const paperSavings = facilities * 5000; // $5k/facility generic SaaS savings
    const laborSavings = facilities * 45000; // 1 FTE efficiency/facility
    
    // The "Network Effect" - Volume impact
    // 1.5% of Total Margin Volume = The big number
    const totalMargin = facilities * marginPerFacility;
    const networkSavings = totalMargin * (networkEfficiencyGain / 100);

    const chartData = [
      { 
        name: "Paper/SaaS", 
        value: paperSavings, 
        color: "#94a3b8",
        description: "Digitizing BOLs (Table Stakes)" 
      },
      { 
        name: "Labor Efficiency", 
        value: laborSavings, 
        color: "#60a5fa",
        description: "Gate/Dock Automation" 
      },
      { 
        name: "Network Volume", 
        value: networkSavings, 
        color: "#2563eb", // Primary Brand Color
        description: "Turnover & Asset Utilization (The Gold Mine)" 
      }
    ];
    setData(chartData);
  }, [facilities, marginPerFacility, networkEfficiencyGain]);

  const totalROI = data.reduce((acc, curr) => acc + curr.value, 0);

  const formatCurrency = (val) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
    return `$${val}`;
  };

  return (
    <Card className="w-full max-w-4xl bg-slate-50">
      <CardHeader>
        <CardTitle className="text-2xl font-bold flex justify-between items-center">
          <span>YardFlow Value Logic</span>
          <span className="text-emerald-600 text-3xl">
            {formatCurrency(totalROI)} <span className="text-sm text-slate-500 font-normal">/ yr</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="space-y-4">
            <label className="text-sm font-medium text-slate-700">
              Facility Network Size
            </label>
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold text-slate-800 w-16">{facilities}</span>
              <Slider
                value={[facilities]}
                onValueChange={(vals) => setFacilities(vals[0])}
                min={1}
                max={500}
                step={1}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-slate-500">Distribution Centers / Plants</p>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium text-slate-700">
              Avg. Margin / Facility
            </label>
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-slate-800 w-20">
                {formatCurrency(marginPerFacility)}
              </span>
              <Slider
                value={[marginPerFacility]}
                onValueChange={(vals) => setMarginPerFacility(vals[0])}
                min={500000}
                max={10000000}
                step={500000}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-slate-500">Revenue - COGS per site</p>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium text-slate-700">
              Network Efficiency Gain
            </label>
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold text-blue-600 w-16">
                {networkEfficiencyGain}%
              </span>
              <Slider
                value={[networkEfficiencyGain]}
                onValueChange={(vals) => setNetworkEfficiencyGain(vals[0])}
                min={0.1}
                max={5.0} // Conservative upper bound
                step={0.1}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-slate-500">Volume throughput increase</p>
          </div>
        </div>

        {/* Visualizer */}
        <div className="h-96 w-full mt-8">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <XAxis type="number" tickFormatter={formatCurrency} />
              <YAxis type="category" dataKey="name" width={120} tick={{fontSize: 12}} />
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Narrative */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-center">
          {data.map((item, idx) => (
            <div key={idx} className="p-3 bg-slate-50 rounded border border-slate-100">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{item.name}</div>
              <div className="font-semibold text-slate-700">{formatCurrency(item.value)}</div>
              <div className="text-xs text-slate-400 mt-1 italic">{item.description}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ROICalculator;
```

### B. Sequence Templates (src/data/sequenceTemplates.ts)

```typescript
// src/data/sequenceTemplates.ts

export const MANIFEST_SEQUENCES = [
  {
    id: 'manifest-meeting-room',
    name: 'Manifest: "In the Area" (High Priority)',
    description: 'For prospects with meeting rooms (Pepsi, Kraft, GXO, etc.)',
    steps: [
      {
        day: 0,
        type: 'email',
        subject: 'Swing by your meeting room?',
        body: `Hi {{firstName}},

I'll be "holding court" in the meeting rooms area on Monday afternoon at Manifest. 

We helped Primo Brands (fka Nestle Waters) scale volume by 4% across 24 facilities while keeping headcount flat. That's ~$1M incremental margin per facility. [cite: 43]

I have a hunch we can deliver similar results for {{company}}.

Since I'll be right next door to your team, should I swing by the {{company}} room? Or you can grab a slot on my calendar here: {{calendly_link}} [cite: 341]

Best,
Jake`
      }
    ]
  },
  {
    id: 'manifest-co-dev',
    name: 'Manifest: Co-Development Invitation',
    description: 'Invitation to the Yard Network Protocol (YNP) cohort',
    steps: [
      {
        day: 0,
        type: 'email',
        subject: 'Co-development partner for {{company}}?',
        body: `Hi {{firstName}},

We are selecting partners for a new co-development cohort at Manifest to roll out our Yard Network Protocol (YNP), and I’d love to include {{company}}. [cite: 32, 44]

We recently deployed this with Primo Brands, generating $30M+ in network effects by standardizing their yard data models. [cite: 4]

Are you open to discussing what a similar "Network Effect" strategy would look like for {{company}}'s facilities?

Best,
Jake`
      }
    ]
  }
];
```

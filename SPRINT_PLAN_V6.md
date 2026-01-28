# YardFlow GTM Hub - Sprint Plan V6 (Technical Debt + Analytics)

## Status Summary
| Metric | Value |
|--------|-------|
| **Tests** | 790 passing |
| **Build** | ✅ Passes (180KB main + vendor chunks) |
| **Deploy** | gtm-yard-flow.vercel.app |
| **IDE Errors** | 98 (TypeScript strict mode in tests - runtime OK) |
| **Sprints 0-27** | ✅ Complete (archived) |
| **Sprint 28** | 🔄 In Progress (T28.1 ✅, T28.2 partial) |

## Priority: Technical Debt Before Features

The codebase has accumulated technical debt that should be addressed before continuing Sprint 28:
1. **Bundle splitting** - ✅ DONE (was 758KB, now chunked properly)
2. **IDE TypeScript errors** - 98 errors in test files (tests pass, but poor DX)
3. **Mock type safety** - Test mocks don't match interface signatures
4. **Test file organization** - Missing proper tsconfig for test files

---

## Sprint 28A: Technical Debt Remediation
**Goal:** Fix all IDE errors, improve type safety, clean developer experience.
**Demo:** IDE shows 0 errors, tests pass, build passes with no warnings.
**Duration:** ~1.5 days (realistic estimate)

### Task Dependency Graph
```
T28A.1 (vitest.config) ──┬── T28A.2 (test tsconfig) ───────────────────┬
                         │                                              │
T28A.3 (setup.ts) ───────┘                                              │
                                                                        ├── T28A.9 (verify)
T28A.4 (HubSpot mock types) ──┬── T28A.5 (EmailSequence) ───────────────┤
                              │                                          │
                              ├── T28A.6 (SocialChannel) ────────────────┤
                              │                                          │
                              ├── T28A.7 (MarketingModule/benchmark) ────┤
                              │                                          │
                              └── T28A.8 (prospects/utils mocks) ────────┘
```

### T28A.1: Fix Vitest Config TypeScript [XS - 30m]
**Goal:** Fix vitest.config.ts TypeScript error about `test` property.
**Files:** `vitest.config.ts`
**Problem:** IDE shows "Object literal may only specify known properties, and 'test' does not exist"
**Root Cause:** Using `defineConfig` from 'vite' instead of 'vitest/config'
**Solution:**
```typescript
// Change from:
import { defineConfig } from 'vite'
// To:
import { defineConfig } from 'vitest/config'
```
**Acceptance Criteria:**
- `vitest.config.ts` has no red squiggles
- `npm test` still passes
- `npm run build` still passes
**Validation:** `get_errors` shows 0 errors in vitest.config.ts

### T28A.2: Complete Test TypeScript Config [S - 1.5h]
**Goal:** Proper TypeScript configuration for test files with vitest globals.
**Files:** `tsconfig.test.json`, `.vscode/settings.json`
**Status:** tsconfig.test.json created, needs VS Code integration
**Remaining Work:**
- Create/update `.vscode/settings.json` with test file associations
- Verify IDE uses tsconfig.test.json for test files
**Acceptance Criteria:**
- Test files show `vi`, `describe`, `it`, `expect` as valid
- No "Cannot find name 'vi'" errors in IDE
**Validation:** Open any test file, IDE shows no vitest global errors

### T28A.3: Fix Test Setup Types [DONE ✅]
**Goal:** Add proper imports to setup.ts for IDE recognition.
**Files:** `src/__tests__/setup.ts`
**Status:** Completed - added vitest imports

### T28A.4: Fix HubSpot Mock Types [M - 3h]
**Goal:** Properly type HubSpot test mocks to satisfy interfaces.
**Files:** 
- `src/__tests__/services/HubSpotSync.test.ts` (20 instances)
- `src/__tests__/services/HubSpotActivity.test.ts` (1 instance - missing hs_timestamp)
**Problem:** `mockProspectRepo` doesn't match `ProspectRepository` interface
**Solution:**
```typescript
const mockProspectRepo: ProspectRepository = {
  getAll: vi.fn().mockResolvedValue([]),
  getById: vi.fn().mockResolvedValue(null),
  // ... properly typed
};
```
**Acceptance Criteria:**
- All 20 HubSpotSync mock errors fixed
- HubSpotActivity mock includes required hs_timestamp
- IDE shows 0 type errors in these files
**Validation:** `get_errors` on affected files returns empty

### T28A.5: Fix EmailSequence Test Types [S - 1h]
**Goal:** Add missing `condition` field to all addStep calls.
**Files:** `src/__tests__/services/EmailSequence.test.ts` (15 instances)
**Problem:** `addStep` requires `condition` field, tests don't provide it
**Solution:** Add `condition: 'always'` to all test data objects
**Acceptance Criteria:**
- All 15 EmailSequence type errors fixed
- Tests still pass
**Validation:** `npm test -- EmailSequence` passes, IDE shows 0 errors

### T28A.6: Fix SocialChannel Test Types [S - 30m]
**Goal:** Add missing required fields to createCadence calls.
**Files:** `src/__tests__/services/SocialChannel.test.ts` (2 instances)
**Problem:** `createCadence` requires `skipIfConnected` field
**Solution:** Add required fields to step objects
**Acceptance Criteria:**
- All SocialChannel type errors fixed
- Tests still pass
**Validation:** `npm test -- SocialChannel` passes

### T28A.7: Fix MarketingModule & Benchmark Tests [S - 1h]
**Goal:** Fix import and function signature issues.
**Files:** 
- `src/__tests__/services/MarketingModule.test.ts` (1 instance - splitName import)
- `src/__tests__/performance/benchmark.test.ts` (1 instance - createSequence args)
**Problems:**
1. MarketingModule imports non-existent `splitName` from ColumnMapperService
2. benchmark calls `createSequence` with 3 args, expects 1-2
**Solutions:**
1. Either export `splitName` from ColumnMapperService or remove unused import
2. Fix `createSequence` call signature
**Acceptance Criteria:**
- Both files have 0 type errors
- Tests still pass
**Validation:** `npm test -- Marketing benchmark`

### T28A.8: Fix Prospect Mock & Utils Types [S - 1h]
**Goal:** Fix mock data types and type narrowing issues.
**Files:** 
- `src/__tests__/mocks/prospects.ts` (7 instances - tier/status types)
- `src/__tests__/utils.test.ts` (2 instances - never type)
**Problems:**
1. `tier` is number but type expects string
2. `status` values don't match union type ('not_started', 'replied' not in type)
3. Type narrowing issue with filtered arrays
**Solutions:**
1. Change tier values to strings: `tier: '1'`
2. Use valid status values: 'new', 'drafted', 'contacted', 'meeting_booked'
3. Add type assertion or fix filter return type
**Acceptance Criteria:**
- prospects.ts matches ProspectFields type exactly
- utils.test.ts has no 'never' type errors
**Validation:** IDE shows 0 errors in both files

### T28A.9: Verify Clean State [XS - 30m]
**Goal:** Final verification that all issues are resolved.
**Validation Checklist:**
- [ ] `npm run build` passes with no warnings
- [ ] `npm test` shows 790+ tests passing
- [ ] `get_errors` returns 0 total errors
- [ ] Build chunks are properly split (main < 200KB)
- [ ] Commit changes: "fix: resolve technical debt in test files"
**Acceptance Criteria:**
- Clean CI/CD pipeline
- No IDE warnings/errors
- Ready for Sprint 28B

---

## Sprint 28B: Analytics Dashboard (Complete)
**Goal:** Complete Analytics Dashboard with full visualization suite.
**Demo:** Dashboard with charts, KPIs, date range filtering, team leaderboard.
**Dependencies:** Sprint 28A (clean codebase), Sprint 27 (Firestore data), AnalyticsAggregator (T28.1)
**Duration:** ~4 days (realistic estimate)
**Required Packages:** `npm install html-to-image jspdf` (for T28B.7)

### Task Dependency Graph
```
T28B.0 (verify aggregator) ─┐
                            │
T28B.1a-d (chart tests) ────┼── T28B.4 (dashboard layout) ──┬── T28B.7 (export)
                            │                               │
T28B.2 (date picker) ───────┼───────────────────────────────┤
                            │                               │
T28B.3 (KPI cards) ─────────┤                               ├── T28B.9 (E2E)
                            │                               │
T28B.5 (leaderboard) ───────┼── T28B.6 (skeleton/error) ────┤
                            │                               │
                            └── T28B.8 (integration hook) ──┘
```

### T28B.0: Verify AnalyticsAggregator [XS - 30m]
**Goal:** Confirm AnalyticsAggregator service and tests are complete.
**Files:** `src/services/AnalyticsAggregator.ts`, `src/__tests__/services/AnalyticsAggregator.test.ts`
**Status:** ✅ Already exists with 28 tests
**Verification:**
- [ ] All aggregation methods work: getKPIs, getFunnelData, getActivityMetrics, etc.
- [ ] Types exported from `src/types/analytics.ts`
**Validation:** `npm test -- AnalyticsAggregator` shows 28 tests passing

### T28B.1a: FunnelChart Tests [S - 1.5h]
**Goal:** Test FunnelChart component.
**Files:** `src/__tests__/components/charts/FunnelChart.test.tsx`
**Test Cases:**
1. Renders vertical funnel with data
2. Renders horizontal funnel variant
3. Shows conversion rates between stages
4. Handles empty data array
5. Click handler fires with stage data
6. Tooltip displays on hover
7. Custom colors applied
**Validation:** `npm test -- FunnelChart`

### T28B.1b: BarChart Tests [S - 1.5h]
**Goal:** Test BarChart component.
**Files:** `src/__tests__/components/charts/BarChart.test.tsx`
**Test Cases:**
1. Renders vertical bars
2. Renders horizontal bars
3. Stacked mode works
4. ActivityBarChart variant renders
5. Click handler fires
6. Legend visibility toggle
7. Custom formatters applied
**Validation:** `npm test -- BarChart`

### T28B.1c: LineChart Tests [S - 1.5h]
**Goal:** Test LineChart component.
**Files:** `src/__tests__/components/charts/LineChart.test.tsx`
**Test Cases:**
1. Renders line with time series data
2. Area fill mode works
3. Multiple series displayed
4. Smooth vs linear curves
5. TrendLineChart variant renders
6. PipelineTrendChart variant renders
7. Date formatting works
**Validation:** `npm test -- LineChart`

### T28B.1d: PieChart Tests [S - 1.5h]
**Goal:** Test PieChart component.
**Files:** `src/__tests__/components/charts/PieChart.test.tsx`
**Test Cases:**
1. Renders pie with data
2. DonutChart variant with center label
3. SourceDistributionChart variant
4. Percentage labels displayed
5. Legend shows all slices
6. Click handler fires with slice data
7. Small slices handled (< 5%)
**Validation:** `npm test -- PieChart`

### T28B.2: Date Range Picker [S - 2h]
**Goal:** Reusable date range selector for dashboard filtering.
**Files:** 
- `src/components/DateRangePicker.tsx`
- `src/__tests__/components/DateRangePicker.test.tsx`
**Interface:**
```typescript
interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  presets?: Array<{ label: string; getValue: () => DateRange }>;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}
```
**Features:**
- Preset buttons: Today, Last 7 days, Last 30 days, This Month, Last Month, Custom
- Custom range calendar picker
- Keyboard accessible (Tab, Enter, Arrow keys)
- Display format: "Jan 1 - Jan 31, 2026"
- ARIA labels for accessibility
**Acceptance Criteria:**
- Preset buttons update range correctly
- Custom range allows start/end selection
- Invalid ranges prevented (start > end)
- onChange fires with correct DateRange
- Keyboard navigation works
**Validation:** Unit tests pass, manual browser testing

### T28B.3: KPI Cards [S - 2h]
**Goal:** Display key performance indicators with trend arrows.
**Files:**
- `src/components/KPICard.tsx`
- `src/__tests__/components/KPICard.test.tsx`
**Interface:**
```typescript
interface KPICardProps {
  title: string;
  value: number | string;
  previousValue?: number;
  format?: 'number' | 'currency' | 'percent';
  icon?: React.ReactNode;
  loading?: boolean;
  onClick?: () => void;
}
```
**Features:**
- Large primary value display
- Trend indicator: ↑ green (+X%), ↓ red (-X%), → neutral (0%)
- Percent change calculation: ((current - previous) / previous) * 100
- Loading skeleton state
**Acceptance Criteria:**
- Positive change shows green up arrow with percentage
- Negative change shows red down arrow with percentage
- Zero change shows gray horizontal arrow
- Currency format: $1,234.56
- Percent format: 12.3%
- Number format: 1,234
- Click fires onClick callback
**Test Cases:**
1. Renders with value only
2. Shows positive trend (green ↑)
3. Shows negative trend (red ↓)
4. Shows neutral trend (gray →)
5. Formats currency correctly
6. Formats percent correctly
7. Loading state shows skeleton
8. Click handler fires
**Validation:** Unit tests pass

### T28B.4: Dashboard Layout [M - 5h]
**Goal:** Grid-based dashboard with responsive widget layout.
**Files:**
- `src/components/Dashboard.tsx`
- `src/components/DashboardWidget.tsx`
- `src/__tests__/components/Dashboard.test.tsx`
**Interface:**
```typescript
interface DashboardProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  widgets: DashboardWidgetConfig[];
}

interface DashboardWidgetConfig {
  id: string;
  type: 'funnel' | 'pipeline' | 'activities' | 'kpi' | 'leaderboard' | 'trend';
  title: string;
  width: 1 | 2 | 3; // grid columns (12-col grid, so 1=4cols, 2=8cols, 3=12cols)
  height: 1 | 2; // grid rows
}
```
**Features:**
- CSS Grid with 12-column layout
- Responsive breakpoints:
  - Desktop (≥1024px): 3-column grid
  - Tablet (768-1023px): 2-column grid  
  - Mobile (<768px): 1-column stacked
- Widget cards with title bar, content area
- Date range picker in dashboard header
- Refresh button triggers data reload
**Acceptance Criteria:**
- Grid renders at all breakpoints
- Widgets respect width/height config
- Date range picker is prominent in header
- Refresh button visible and functional
- Error in one widget isolated (Error Boundary)
**Test Cases:**
1. Renders with widget config
2. Date range picker visible
3. Refresh button triggers callback
4. Widgets render in grid
5. Error boundary catches widget errors
**Validation:** Unit tests, visual testing at 1280px, 768px, 480px widths

### T28B.5: Team Leaderboard [M - 3h]
**Goal:** Ranked list of team members by performance metrics.
**Files:**
- `src/components/Leaderboard.tsx`
- `src/__tests__/components/Leaderboard.test.tsx`
**Interface:**
```typescript
interface LeaderboardProps {
  data: TeamMetrics[];
  metric: 'activities' | 'meetings' | 'pipeline' | 'conversion';
  maxItems?: number;
  showAvatars?: boolean;
}
```
**Features:**
- Ranked list with position indicators (🥇 🥈 🥉 for top 3, numbers for rest)
- Avatar with initials fallback (first letter of first + last name)
- Primary metric value with horizontal bar visualization
- Metric selector dropdown
**Acceptance Criteria:**
- Correct ranking by selected metric (descending)
- Ties handled with same position number
- Top 3 have medal icons
- Metric selector changes ranking
- Empty state when no data
**Test Cases:**
1. Renders ranked list
2. Top 3 have medal icons
3. Ties show same position
4. Metric selector works
5. Empty state displays
6. Avatars show initials
7. maxItems limits display
**Validation:** Unit tests pass

### T28B.6: Skeleton & Error Components [S - 1.5h]
**Goal:** Loading skeleton and error boundary for dashboard widgets.
**Files:**
- `src/components/SkeletonLoader.tsx`
- `src/components/WidgetErrorBoundary.tsx`
- `src/__tests__/components/SkeletonLoader.test.tsx`
**Features:**
- SkeletonLoader: Animated placeholder for charts, KPIs, lists
- WidgetErrorBoundary: Catches widget errors, shows friendly message, retry button
**Acceptance Criteria:**
- Skeleton matches widget dimensions
- Error boundary isolates failures
- Retry button attempts re-render
**Validation:** Unit tests, visual inspection

### T28B.7: Dashboard Export [M - 4h]
**Goal:** Export dashboard as PNG or PDF.
**Files:**
- `src/services/DashboardExporter.ts`
- `src/__tests__/services/DashboardExporter.test.ts`
**Prerequisites:** `npm install html-to-image jspdf`
**Interface:**
```typescript
interface DashboardExporter {
  exportToPng(dashboardRef: HTMLElement, filename?: string): Promise<Blob>;
  exportToPdf(dashboardRef: HTMLElement, filename?: string): Promise<Blob>;
  copyToClipboard(dashboardRef: HTMLElement): Promise<void>;
}
```
**Features:**
- Capture full dashboard as PNG using html-to-image
- Multi-page PDF for dashboards > 1 page (jspdf)
- Include date range header in exports
- Loading indicator during export
- Browser compatibility check (Safari fallback)
**Acceptance Criteria:**
- PNG captures all visible widgets
- PDF paginates correctly (test with 10+ widgets → 2+ pages)
- Export includes date range label in header
- Error handling for oversized content
- Copy to clipboard works in Chrome/Edge
**Test Cases:**
1. PNG export creates blob
2. PDF export creates blob
3. Filename includes date
4. Large dashboard paginates
5. Error on invalid element
**Validation:** Manual export test, unit tests

### T28B.8: Dashboard Integration Hook [M - 4h]
**Goal:** Connect dashboard to live Firestore data via AnalyticsAggregator.
**Files:**
- `src/hooks/useDashboardData.ts`
- `src/__tests__/hooks/useDashboardData.test.ts`
**Dependencies:** AnalyticsAggregator (T28.1 ✅), Firestore hooks (Sprint 27 ✅)
**Interface:**
```typescript
function useDashboardData(dateRange: DateRange): {
  kpis: KPIValue[];
  funnel: FunnelData;
  activities: ActivityMetrics;
  pipeline: PipelineMetrics;
  team: TeamMetrics[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}
```
**Features:**
- Uses AnalyticsAggregator.getSummary() for aggregated data
- Caches results for 60 seconds (configurable)
- Refetch on dateRange change
- Loading state during fetch
- Error state with retry capability
**Acceptance Criteria:**
- Returns aggregated data from AnalyticsAggregator
- Loading true during initial fetch
- Error captured and exposed
- refetch() triggers new data load
- Date range change triggers refetch
**Test Cases:**
1. Returns loading initially
2. Returns data after fetch
3. Handles error gracefully
4. refetch triggers reload
5. Date range change triggers reload
**Validation:** Unit tests with mocked aggregator

### T28B.9: Dashboard E2E Tests [M - 3h]
**Goal:** End-to-end tests for complete dashboard flows.
**Files:** `e2e/dashboard.spec.ts`
**Test Scenarios:**
1. Dashboard loads with default date range (last 30 days)
2. Date range change updates all widgets
3. KPI cards display with correct formatting
4. Leaderboard shows ranked team members
5. Export PNG button generates downloadable file
6. Empty state displays when no data
7. Error recovery: reload button after simulated failure
8. Mobile layout: widgets stack at 480px width
**Acceptance Criteria:**
- All 8 scenarios pass in Playwright
- Tests complete in < 90 seconds (realistic for 8 scenarios)
- No flaky tests (retry mechanism for async operations)
**Validation:** `npm run test:e2e -- dashboard.spec.ts`

---

## Sprint 28 Summary

### Sprint 28A: Technical Debt (~1.5 days)
| Task | Estimate | Files | Status |
|------|----------|-------|--------|
| T28A.1 | 30m | vitest.config.ts | ⏳ |
| T28A.2 | 1.5h | tsconfig.test.json, .vscode | ⏳ |
| T28A.3 | - | setup.ts | ✅ Done |
| T28A.4 | 3h | HubSpotSync/Activity tests | ⏳ |
| T28A.5 | 1h | EmailSequence.test.ts | ⏳ |
| T28A.6 | 30m | SocialChannel.test.ts | ⏳ |
| T28A.7 | 1h | Marketing/benchmark tests | ⏳ |
| T28A.8 | 1h | prospects.ts, utils.test.ts | ⏳ |
| T28A.9 | 30m | Verification | ⏳ |
| **Total** | **~9h** | | |

### Sprint 28B: Analytics Dashboard (~4 days)
| Task | Estimate | Files | Status |
|------|----------|-------|--------|
| T28B.0 | 30m | Verify aggregator | ✅ Done (28 tests) |
| T28B.1a | 1.5h | FunnelChart tests | ⏳ |
| T28B.1b | 1.5h | BarChart tests | ⏳ |
| T28B.1c | 1.5h | LineChart tests | ⏳ |
| T28B.1d | 1.5h | PieChart tests | ⏳ |
| T28B.2 | 2h | DateRangePicker | ⏳ |
| T28B.3 | 2h | KPICard | ⏳ |
| T28B.4 | 5h | Dashboard layout | ⏳ |
| T28B.5 | 3h | Leaderboard | ⏳ |
| T28B.6 | 1.5h | Skeleton/Error | ⏳ |
| T28B.7 | 4h | Dashboard export | ⏳ |
| T28B.8 | 4h | Integration hook | ⏳ |
| T28B.9 | 3h | E2E tests | ⏳ |
| **Total** | **~31h** | | |

---

## Sprint 29-33: Queued (Unchanged)
See original sprint plan for:
- Sprint 29: LinkedIn Sales Navigator Import
- Sprint 30: Advanced Search & Filters
- Sprint 31: Bulk Operations
- Sprint 32: Offline PWA Support
- Sprint 33: PDF Report Export

---

## Definition of Done (All Tasks)
- [ ] Code compiles without TypeScript errors (IDE shows 0 errors)
- [ ] All new code has unit tests (≥80% coverage)
- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`) with no warnings
- [ ] Feature works in browser
- [ ] PR reviewed or self-reviewed
- [ ] Commit follows conventional format

## Definition of Done (All Sprints)
- [ ] All tasks complete
- [ ] E2E tests pass for sprint features
- [ ] Demo recorded or live demo works
- [ ] Deployed to Vercel
- [ ] Sprint plan updated with status

---

## Quick Reference: Current File Errors

| File | Error Count | Primary Issue |
|------|-------------|---------------|
| HubSpotSync.test.ts | 20 | mockProspectRepo type mismatch |
| EmailSequence.test.ts | 15 | addStep missing `condition` |
| mocks/prospects.ts | 7 | tier=number, status invalid |
| SocialChannel.test.ts | 2 | createCadence missing fields |
| utils.test.ts | 2 | never type narrowing |
| HubSpotActivity.test.ts | 1 | properties missing hs_timestamp |
| MarketingModule.test.ts | 1 | splitName not exported |
| vitest.config.ts | 1 | wrong defineConfig import |
| benchmark.test.ts | 1 | createSequence arg count |
| **Total** | **98** | |

---

## Completed Work (This Session)

### ✅ T28A.0: Bundle Splitting [DONE]
**Changes:**
- Updated `vite.config.ts` with manualChunks:
  - vendor-react (140KB)
  - vendor-firebase (436KB)
  - vendor-charts (pending first use)
- Main bundle reduced from 758KB to 180KB
- No more chunk size warnings

### ✅ T28A.3: Test Setup Types [DONE]
**Changes:**
- Added vitest/globals reference to `src/__tests__/setup.ts`
- Added explicit imports: `import { vi, beforeAll, afterAll } from 'vitest'`

### ✅ T28A.2 (Partial): Test TypeScript Config [DONE]
**Changes:**
- Created `tsconfig.test.json` extending base config with vitest types

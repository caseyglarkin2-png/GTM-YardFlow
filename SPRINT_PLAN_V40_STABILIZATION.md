# Sprint Plan V40: Stabilization & Production Readiness

**Status**: 🚀 IN PROGRESS  
**Created**: February 7, 2026  
**Goal**: Zero runtime errors, complete test suite, production-ready deployment  
**North Star**: Site loads, users can send emails, no console errors

---

## Executive Summary

### Current State (Post-Fixes)
| Issue | Status | Commit |
|-------|--------|--------|
| Firebase env var corruption (`\n` suffix) | ✅ FIXED | `dfb2c60` |
| Unsafe `getAuth()` calls crash on init | ✅ FIXED | `64eb804` |
| PWA icons were 1x1 placeholders | ✅ FIXED | `64eb804` |
| Missing `@/types/spamScore` module | ✅ FIXED | `5ea9b8d` |
| `RecordStatus` not exported | ✅ FIXED | `5ea9b8d` |
| `useFocusTrap` wrong signature | ✅ FIXED | `5ea9b8d` |
| `useEmailAnalytics` type mismatch | ✅ FIXED | `5ea9b8d` |
| API route errors (`sendAlert`, `withSentry`) | ✅ FIXED | `3ea0659` |

### Remaining Tech Debt
| Issue | Severity | Sprint |
|-------|----------|--------|
| Test TypeScript errors (13) | 🟡 Medium | S40B |
| App.tsx is 2286 lines | 🟡 Medium | S40C |
| Main bundle is 2.75MB | 🟡 Medium | S40D |
| Duplicate state (AppContext vs App.tsx) | 🟡 Medium | S40C.0 |
| Lucide icons bundle 440KB | 🟢 Low | S40D.3 |

---

## Sprint Dependencies

```
S40A (Verification)
    ↓
S40B.0-3 (Fix TS Errors) → S40B.4 (Run Tests)
    ↓
S40C.0 (Migrate State) → S40C.1-5 (Decomposition)
    ↓
S40D (Bundle Optimization) ←── can start after S40C.2
    
S40E (Error Boundaries) ←── can run parallel after S40A
    ↓
S40F (Documentation)
```

---

## Sprint S40A: Critical Path Verification [P0 - BLOCKING]

**Goal**: Verify all critical user paths work end-to-end  
**Demo**: User can sign in, view prospects, send email, see tracking  
**Duration**: 1-2 hours

---

### T40A.1: Manual E2E Smoke Test [S - 1hr]

**Description**: Manually test all critical flows in production

**Validation Checklist**:
- [ ] Site loads without white screen
- [ ] No console errors on initial load
- [ ] Anonymous auth completes
- [ ] Prospect list renders with data
- [ ] Can filter prospects by tier
- [ ] Can sort prospects by columns
- [ ] Can open prospect detail panel
- [ ] Can navigate between tabs
- [ ] Can compose email (BulkEmailModal opens)
- [ ] Can close modals with Escape key
- [ ] Railway health indicator shows status

**Files**: None (manual testing)

**Acceptance**: All flows work, no console errors, no white screens

---

### T40A.2: Fix Any Runtime Crashes Found [M - 2hr]

**Description**: Fix any issues discovered during smoke testing

**Validation**: Re-run smoke test, all checks pass

**Files**: TBD based on findings

**Acceptance**: No console errors during normal usage

---

### T40A.3: Verify Error Monitoring [S - 30min]

**Description**: Ensure Sentry captures unhandled errors

**Validation**:
```typescript
// Test in browser console:
throw new Error('Test Sentry capture');
// Should appear in Sentry dashboard within 1 minute
```

**Files**: `src/main.tsx`, `src/components/GlobalErrorBoundary.tsx`

**Acceptance**: Test error visible in Sentry dashboard

---

## Sprint S40B: Test Suite Repair [P1 - HIGH]

**Goal**: All tests pass with `npm test -- --run`  
**Demo**: CI shows green checkmark, all 194 test files pass  
**Duration**: 2-3 hours

---

### T40B.0: Enumerate Test TypeScript Errors [S - 15min]

**Description**: Document all test file TypeScript errors

**Validation**:
```bash
npx tsc --noEmit 2>&1 | grep "__tests__" | grep "error TS"
```

**Expected errors** (13 total):
1. `factories/index.ts` - `firstName` not in Prospect (line 36)
2. `factories/index.ts` - `company` not in RailwayProspect (line 106)
3. `factories/index.ts` - SequenceStep missing `id`, `order` (lines 123-125)
4. `factories/index.ts` - `currentStep` not in RailwayEnrollment (line 141)
5. `factories/factories.test.ts` - `currentStep` doesn't exist (line 206)
6. `hooks/useSortableTable.test.ts` - Wrong generic type (6 errors, lines 91-213)
7. `components/SpamScoreIndicator.test.tsx` - Missing module (line 10)

**Acceptance**: All 13 errors documented with fix assignments

---

### T40B.1: Fix Test Factory Types [M - 1hr]

**Description**: Update test factories to match current type definitions

**Files**: `src/__tests__/factories/index.ts`

**Changes**:
```typescript
// Prospect factory - remove firstName, use name
export const createMockProspect = (overrides?: Partial<Prospect>): Prospect => ({
  id: `prospect-${Date.now()}`,
  name: 'John Doe',  // NOT firstName/lastName
  email: 'john@example.com',
  company: 'Acme Inc',  // This IS valid for Prospect
  // ... rest
});

// RailwayProspect factory - use companyId, not company
export const createMockRailwayProspect = (overrides?: Partial<RailwayProspect>): RailwayProspect => ({
  id: `rp-${Date.now()}`,
  companyId: 'company-123',  // NOT company
  // ... rest
});

// SequenceStep factory - add required fields
export const createMockSequenceStep = (overrides?: Partial<SequenceStep>): SequenceStep => ({
  id: `step-${Date.now()}`,
  order: 1,
  type: 'email',
  subject: 'Test Subject',
  body: 'Test Body',
  delayDays: 1,
  ...overrides,
});

// RailwayEnrollment factory - remove currentStep
export const createMockRailwayEnrollment = (overrides?: Partial<RailwayEnrollment>): RailwayEnrollment => ({
  id: `enrollment-${Date.now()}`,
  status: 'active',
  // NO currentStep field
  ...overrides,
});
```

**Validation**: `npx tsc --noEmit src/__tests__/factories/index.ts`

**Acceptance**: Factory file compiles without errors

---

### T40B.2: Fix useSortableTable Test Types [S - 30min]

**Description**: Update test to use correct generic type argument

**Files**: `src/__tests__/hooks/useSortableTable.test.ts`

**Changes**:
```typescript
// The test uses { id, name, score } but hook needs keyof T to be sortable
// Either use valid keys or update the generic constraint

interface TestItem {
  id: number;
  score: number;  // Use 'score' as the sortable field
}

// Update all handleSort('name') to handleSort('score')
```

**Validation**: `npm test -- --run useSortableTable`

**Acceptance**: Hook tests pass

---

### T40B.3: Fix SpamScoreIndicator Test Import [S - 15min]

**Description**: Verify test imports work after type file creation

**Files**: `src/__tests__/components/SpamScoreIndicator.test.tsx`

**Validation**: `npm test -- --run SpamScoreIndicator`

**Acceptance**: Component tests pass

---

### T40B.4: Run Full Test Suite [M - 30min]

**Description**: Ensure all 194 test files pass

**Validation**:
```bash
npm test -- --run
# Should exit 0 with no failures
```

**Acceptance**: Exit code 0, all tests pass

---

## Sprint S40C: Tech Debt - App.tsx Decomposition [P2 - MEDIUM]

**Goal**: Break App.tsx (2286 lines) into manageable components  
**Demo**: Same functionality, App.tsx under 800 lines  
**Duration**: 6-8 hours

---

### T40C.0: Consolidate State in AppContext [M - 2hr] ⚠️ DO FIRST

**Description**: Remove duplicate state from App.tsx, use AppContext

**Problem**: App.tsx has state duplicated in AppContext:
- `activeTab` (App.tsx line 252) vs AppContext
- `selectedProspect` (App.tsx line 273)
- `viewMode` (App.tsx line 303)
- `showSequenceBuilder` (App.tsx line 334)

**Files**: 
- `src/App.tsx`
- `src/context/AppContext.tsx`

**Changes**:
1. Audit all useState in App.tsx
2. Identify which are already in AppContext
3. Import from AppContext instead of local state
4. Remove duplicate useState calls

**Validation**: 
- App still works
- Console shows no "duplicate state" patterns
- useState count in App.tsx reduced by 50%+

**Acceptance**: No duplicate state between App.tsx and AppContext

---

### T40C.1: Extract AuthProvider [M - 1.5hr]

**Description**: Move all auth state/logic to dedicated provider

**Files**: Create `src/providers/AuthProvider.tsx`

**Changes**:
- Move `user`, `loading`, `authError` state
- Move auth listeners and effects
- Export `useAuth()` hook
- Update App.tsx to wrap content with AuthProvider

**Interface**:
```typescript
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}
```

**Validation**: Auth still works, can sign in/out

**Acceptance**: Auth logic isolated, App.tsx ~200 lines smaller

---

### T40C.2: Extract TabRouter [M - 2hr]

**Description**: Move tab content rendering to dedicated component

**Files**: Create `src/components/TabRouter.tsx`

**Changes**:
- Move all `case 'dashboard':`, `case 'prospects':`, etc.
- Accept `activeTab` as prop from AppContext
- Add `React.lazy()` for heavy components (prep for S40D)

**Interface**:
```typescript
interface TabRouterProps {
  onProspectSelect: (prospect: Prospect) => void;
  // ... other callbacks
}
```

**Validation**: Navigation still works, all tabs render

**Acceptance**: Tab content isolated, App.tsx ~500 lines smaller

---

### T40C.3: Migrate Remaining Modals to AppContext [M - 1.5hr]

**Description**: Centralize all modal state in AppContext

**Files**: 
- `src/App.tsx`
- `src/context/AppContext.tsx`

**Modals to migrate**:
- `showEmailCompose`
- `showBulkEmail`  
- `showEnrollment`
- `showSettings`
- `showHelp`
- `showDelete`

**Changes**:
- Add modal state to AppContext
- Export modal control hooks
- Remove local modal state from App.tsx

**Validation**: All modals still open/close correctly

**Acceptance**: Modal logic centralized, App.tsx ~100 lines smaller

---

### T40C.4: Extract Keyboard Shortcuts [S - 45min]

**Description**: Move keyboard shortcut handling to dedicated hook

**Files**: Create `src/hooks/useGlobalKeyboardShortcuts.ts`

**Changes**:
- Move all keyboard event listeners
- Use AppContext for actions (tab switch, modal toggle)

**Validation**: All keyboard shortcuts work

**Acceptance**: Keyboard logic isolated

---

### T40C.5: Final App.tsx Cleanup [S - 30min]

**Description**: Remove any remaining logic that should be elsewhere

**Validation**: 
```bash
wc -l src/App.tsx
# Should be under 800 lines
```

**Acceptance**: App.tsx under 800 lines, clear structure

---

### T40C.6: Check for Circular Imports [S - 15min]

**Description**: Verify decomposition didn't introduce circular deps

**Validation**:
```bash
npx madge --circular src/
# Should show no cycles
```

**Acceptance**: No circular imports

---

## Sprint S40D: Performance - Bundle Optimization [P2 - MEDIUM]

**Goal**: Reduce main bundle from 2.75MB to under 2MB  
**Demo**: Lighthouse performance score improves  
**Duration**: 3-4 hours

---

### T40D.0: Install Bundle Analyzer [S - 15min]

**Description**: Add visualization tool for bundle analysis

**Command**:
```bash
npm i -D rollup-plugin-visualizer
```

**Files**: Update `vite.config.ts`:
```typescript
import { visualizer } from 'rollup-plugin-visualizer';

plugins: [
  // ... existing
  visualizer({
    filename: 'dist/bundle-stats.html',
    gzipSize: true,
  }),
]
```

**Validation**: `npm run build` generates `dist/bundle-stats.html`

**Acceptance**: Can view bundle composition

---

### T40D.1: Add Route-Based Code Splitting [M - 1.5hr]

**Description**: Lazy load tab content components

**Files**: `src/components/TabRouter.tsx`

**Changes**:
```typescript
const Dashboard = React.lazy(() => import('./Dashboard'));
const ProspectList = React.lazy(() => import('./ProspectList'));
const SequenceManager = React.lazy(() => import('./SequenceManager'));
// ... etc

// Wrap in Suspense
<Suspense fallback={<TabSkeleton />}>
  {renderTabContent()}
</Suspense>
```

**Validation**: Network tab shows chunks loading on tab switch

**Acceptance**: Initial bundle reduced by 500KB+

---

### T40D.2: Lazy Load Heavy Dependencies [M - 1hr]

**Description**: Dynamic import for charts, PDF, html2canvas

**Target libraries**:
- `recharts` - 158KB
- `html2canvas` - 201KB
- Chart components

**Changes**: Use dynamic import in components that use these:
```typescript
const exportToPdf = async () => {
  const html2canvas = (await import('html2canvas')).default;
  // ...
};
```

**Validation**: Bundle analyzer shows these in separate chunks

**Acceptance**: Main chunk under 2MB

---

### T40D.3: Audit and Fix Lucide Icon Imports [M - 1hr]

**Description**: Lucide bundle is 440KB - find and fix direct imports

**Audit Command**:
```bash
grep -rn "from 'lucide-react'" src/ --include="*.tsx" | grep -v LazyIcon
```

**Changes**:
- Convert any direct imports to use `LazyIcon`
- Verify no barrel imports

**Validation**: `vendor-lucide` chunk under 100KB

**Acceptance**: Only dynamically loaded icons in bundle

---

### T40D.4: Final Bundle Analysis [S - 30min]

**Description**: Review final bundle composition

**Validation**:
- Open `dist/bundle-stats.html`
- Main chunk under 2MB
- No unexpected large dependencies

**Acceptance**: Bundle meets size targets

---

## Sprint S40E: Hardening - Error Boundaries [P3 - LOW]

**Goal**: Graceful degradation for all error scenarios  
**Demo**: App recovers from errors without full reload  
**Duration**: 2-3 hours

---

### T40E.1: Audit Existing ErrorBoundary Coverage [S - 30min]

**Description**: Verify all panels wrapped, add any missing

**Current coverage** (App.tsx lines 1978-2051):
- ✅ Dashboard
- ✅ Inbox
- ✅ AI Assistant  
- ✅ ROI Calculator
- ✅ Assets
- ✅ Import

**Missing**:
- [ ] Sequences panel
- [ ] Integrations panel
- [ ] ProspectDetail panel

**Validation**: Throw test error in each panel, verify contained

**Acceptance**: 100% panel coverage documented

---

### T40E.2: Add Firebase-Specific Error Fallback [S - 45min]

**Description**: Show helpful message when Firebase fails

**Files**: `src/components/GlobalErrorBoundary.tsx`

**Changes**:
```typescript
// Detect Firebase initialization errors
const isFirebaseError = error.message?.includes('No Firebase App') ||
  error.message?.includes('Firebase: No Firebase App');

if (isFirebaseError) {
  return (
    <div className="...">
      <h2>Configuration Error</h2>
      <p>Firebase is not configured. Please check environment variables.</p>
      <code>VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID</code>
    </div>
  );
}
```

**Validation**: Temporarily break Firebase config, see helpful message

**Acceptance**: Firebase errors show actionable message

---

### T40E.3: Add Hook Error Handling [M - 1hr]

**Description**: Graceful fallback when hooks fail

**Critical hooks**:
- `useProspectState`
- `useSequences`
- `useRailwayHealth`

**Changes**:
- Return `{ error, isError }` states
- Don't throw on async failures
- Show inline error messages in UI

**Validation**: Hook failure shows UI message, not crash

**Acceptance**: No unhandled hook errors

---

## Sprint S40F: Documentation & Cleanup [P3 - LOW]

**Goal**: Clean repo, updated docs  
**Demo**: New developer can onboard in under 1 hour  
**Duration**: 2-3 hours

---

### T40F.1: Archive Old Sprint Plans [S - 30min]

**Description**: Move completed sprint plans to archive folder

**Command**:
```bash
mkdir -p docs/archive/sprints
mv SPRINT_PLAN_V{6..39}*.md docs/archive/sprints/
```

**Keep in root**:
- `SPRINT_PLAN_V40_STABILIZATION.md` (this file)
- `SPRINT_ROADMAP.md`

**Acceptance**: Root directory cleaner, less than 20 files

---

### T40F.2: Update README [M - 1hr]

**Description**: Current setup instructions, architecture diagram

**Sections to update**:
- Quick start instructions
- Environment variable list
- Architecture overview
- Link to active sprint plan

**Validation**: Follow instructions on clean machine

**Acceptance**: Can run dev server in 5 minutes

---

### T40F.3: Update copilot-instructions.md [M - 1hr]

**Description**: Reflect current architecture and patterns

**Updates needed**:
- Current sprint status
- New component patterns (AuthProvider, TabRouter)
- Updated file locations
- Test patterns

**Validation**: AI agent can follow instructions successfully

**Acceptance**: Instructions match current code

---

### T40F.4: Remove Dead Files [S - 30min]

**Description**: Delete unused components, hooks, services

**Audit command**:
```bash
# Find potentially unused exports
npx ts-prune | head -50
```

**Validation**: Build still works after removal

**Acceptance**: No orphaned files

---

## Success Criteria (Exit V40)

| Metric | Target | Validation |
|--------|--------|------------|
| Production runtime errors | 0 | Manual smoke test |
| TypeScript errors (prod) | 0 | `npx tsc --noEmit \| grep -v __tests__` |
| TypeScript errors (tests) | 0 | `npx tsc --noEmit` |
| Test pass rate | 100% | `npm test -- --run` |
| Main bundle size | < 2MB | Bundle analyzer |
| App.tsx lines | < 800 | `wc -l src/App.tsx` |
| First Contentful Paint | < 2s | Lighthouse |
| Circular imports | 0 | `npx madge --circular src/` |

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AppContext migration breaks navigation | Medium | High | Add integration test first |
| Code splitting breaks Suspense boundaries | Low | Medium | Check existing Suspense before adding |
| Bundle analyzer data misleading | Low | Low | Cross-check with Chrome DevTools |
| Decomposition creates circular imports | Medium | Medium | Run madge after each task |
| Test fixes expose more type issues | Medium | Low | Budget extra time for T40B |

---

## Appendix: Commits Already Made (Feb 7, 2026)

| Commit | Description |
|--------|-------------|
| `dfb2c60` | Fix: sanitize literal `\n` in Firebase env vars |
| `64eb804` | Fix: use safe Firebase auth singleton + PWA icons |
| `5ea9b8d` | Fix: resolve production TypeScript errors |
| `3ea0659` | Fix: resolve remaining API route TypeScript errors |

---

*Last Updated: February 7, 2026*

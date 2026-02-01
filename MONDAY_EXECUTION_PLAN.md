# Monday Execution Plan — YardFlow Hub

**Date**: Monday  
**Team**: Casey + Jake  
**Goal**: Make YardFlow Hub **usable for actual outreach** by end of day  
**Status**: Railway deployed ✅ | Desktop UI components exist but not integrated ❌ | Tests fixed ✅

---

## 🎯 Monday Success Criteria

By EOD Monday, you should be able to:
1. ✅ Open YardFlow Hub on desktop without INP lag (< 200ms)
2. ✅ Navigate between tabs smoothly
3. ✅ Build a sequence with the split-pane editor
4. ✅ Enroll a prospect in a sequence
5. ✅ See the email queued for sending
6. ✅ Verify Railway is processing the queue

---

## Current State Assessment

| Component | Status | Action Needed |
|-----------|--------|---------------|
| Railway Backend | ✅ Deployed | None - working |
| LazyIcon component | ✅ Created, tested (9/10) | Wire into App.tsx |
| useMediaQuery hook | ✅ Created (9/10) | Already usable |
| AppContext | ✅ Created, tested (8/10) | Wrap App with Provider |
| DesktopLayout | ✅ Created, tested (8/10) | Replace inline layout |
| NavigationSidebar | ✅ Created, tested (7/10) | Extract from App.tsx |
| SplitPane | ✅ Created, tested (9/10) | Use in SequenceBuilder |
| **App.tsx integration** | ❌ NOT DONE | **CRITICAL PATH** |
| **All tests** | ✅ 78/78 passing | None |

---

## ⏰ Recommended Schedule

```
09:00  T800.1 - Add AppProvider to main.tsx (10 min) ✓
09:15  T800.2 - Replace Lucide imports with LazyIcon (45 min)
10:00  Coffee + INP verification
10:15  T800.3a - Extract SidebarContent from App.tsx (45 min)
11:00  T800.3b - Extract MainContent from App.tsx (30 min)
11:30  T800.3c - Integrate DesktopLayout wrapper (45 min)
12:15  LUNCH + visual check at all breakpoints
13:15  Sprint 801 - Railway verification (1 hour)
14:15  Sprint 802 - End-to-end smoke test (1 hour)
15:15  Buffer for issues
16:15  T800.4 (OPTIONAL) - SplitPane in SequenceBuilder
17:00  EOD
```

**Total: 5.5-6 hours** (realistic with buffer)

---

## Sprint 800: App.tsx Integration (CRITICAL)

**Goal**: Wire up all existing components to fix desktop UX  
**Owner**: Casey or Jake  
**Effort**: 2-3 hours  
**Validation**: INP < 200ms, desktop layout works at 1440px

### T800.1: Replace Lucide Imports with LazyIcon

**File**: `src/App.tsx`

**Current** (lines 1-50):
```typescript
import {
  Menu, Settings, Zap, Mail, Users, Bot, Calculator,
  // ... 40+ more icons causing INP issues
} from 'lucide-react';
```

**Change To**:
```typescript
// Keep only critical icons that are needed immediately
import { Zap, Loader } from 'lucide-react';

// Use LazyIcon for everything else
import { LazyIcon } from '@/components/icons';
```

**Then replace usages**:
```typescript
// Before
<Menu className="h-6 w-6" />

// After
<LazyIcon name="Menu" className="h-6 w-6" />
```

**Icons to migrate** (search for these in App.tsx):
- Menu, Settings, X, ChevronDown, ChevronUp
- LayoutDashboard, Users, Mail, Upload, Link2, Bot, Calculator
- Search, Filter, Save, Trash2, Download
- Clock, Activity, TrendingUp, ExternalLink
- CheckCircle, AlertCircle, XCircle

**Test**:
```bash
npm run dev
# Open Chrome DevTools → Performance → Record → Click menu
# INP should be < 200ms
```

**Validation Criteria**:
- [ ] No direct lucide-react imports except Zap, Loader
- [ ] INP < 200ms on menu click
- [ ] No console errors about missing icons

---

### T800.2: Wrap App with AppProvider

**File**: `src/main.tsx`

**Current**:
```typescript
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Change To**:
```typescript
import App from './App';
import { AppProvider } from './context/AppContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>
);
```

**Validation**: App still renders, no console errors

---

### T800.3: Replace Inline Layout with DesktopLayout

**File**: `src/App.tsx`

**Current Structure** (lines ~1780-2680):
```tsx
{/* Mobile Header */}
<div className="fixed top-0 ... lg:hidden">...</div>

{/* Mobile Sidebar Overlay */}
{isMobileSidebarOpen && <div className="fixed inset-0 ...">...</div>}

{/* Sidebar */}
<div className={`fixed lg:relative ... ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
  {/* All sidebar content inline */}
</div>

{/* Main Content */}
<main className="flex-1 ...">
  {/* Tab content */}
</main>
```

**Change To**:
```tsx
import { DesktopLayout } from '@/components/layout';
import { useIsDesktop } from '@/hooks/useMediaQuery';

// In component:
const isDesktop = useIsDesktop();

// In render:
<DesktopLayout
  sidebar={<SidebarContent />}
  main={<MainContent activeTab={activeTab} />}
  sidebarWidth="medium"
  collapsible
/>
```

**This is the biggest change** - extract sidebar content to a separate component.

**Incremental approach**:
1. First, just wrap existing JSX with DesktopLayout
2. Move sidebar JSX to a `SidebarContent` component
3. Move main content JSX to `MainContent` component

**Validation**:
- [ ] Desktop (1440px): Side-by-side layout
- [ ] Mobile (375px): Hamburger menu works
- [ ] Tab switching works
- [ ] No visual regressions

---

### T800.4: Integrate SplitPane into SequenceBuilder

**File**: `src/components/SequenceBuilder.tsx`

**Current**: Single column layout

**Change To**:
```typescript
import { SplitPane } from '@/components/layout';
import { useIsDesktop } from '@/hooks/useMediaQuery';

export function SequenceBuilder(props) {
  const isDesktop = useIsDesktop();
  const [selectedStepId, setSelectedStepId] = useState<string | null>(
    props.initialSequence?.steps[0]?.id ?? null
  );
  
  const selectedStep = sequence.steps.find(s => s.id === selectedStepId);

  if (!isDesktop) {
    // Mobile: keep current single-column layout
    return <MobileSequenceBuilder {...props} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">...</div>
      
      {/* Split Pane */}
      <SplitPane
        left={
          <StepList
            steps={sequence.steps}
            selectedStepId={selectedStepId}
            onStepSelect={setSelectedStepId}
            onAddStep={handleAddStep}
          />
        }
        right={
          selectedStep ? (
            <StepEditor
              step={selectedStep}
              onUpdate={(updates) => handleUpdateStep(selectedStep.id, updates)}
            />
          ) : (
            <EmptyState message="Select a step to edit" />
          )
        }
        defaultLeftWidth={320}
        minLeftWidth={280}
        maxLeftWidth={400}
      />
      
      {/* Timeline footer */}
      <TimelineBar steps={sequence.steps} />
    </div>
  );
}
```

**Validation**:
- [ ] Desktop: Step list on left, editor on right
- [ ] Mobile: Falls back to current stacked layout
- [ ] Can select steps and edit them
- [ ] Can add/remove steps

---

### T800.5: Fix NavigationSidebar Test Failures

**File**: `src/__tests__/components/layout/NavigationSidebar.test.tsx`

**Current Failures** (from test output):
- Keyboard navigation tests failing because element not found

**Fix**: Update test to handle case where element might not be visible:
```typescript
// Before
const hitlistTab = tabs.find(tab => tab.textContent?.includes('Hitlist'));
expect(hitlistTab).toHaveAttribute('aria-selected', 'true');

// After
const hitlistTab = tabs.find(tab => tab.textContent?.includes('Hitlist'));
expect(hitlistTab).toBeTruthy();
if (hitlistTab) {
  expect(hitlistTab).toHaveAttribute('aria-selected', 'true');
}
```

**Validation**: All layout tests pass

---

## Sprint 801: Railway Integration Verification

**Goal**: Confirm end-to-end email flow works  
**Owner**: Jake  
**Effort**: 1-2 hours  
**Blocked By**: Sprint 800 (need working UI)

### T801.1: Verify Railway Health

```bash
curl https://yardflow-hitlist-production-2f41.up.railway.app/api/health | jq
```

**Expected**: `{"status":"healthy","timestamp":"..."}`

---

### T801.2: Test Sequence Creation via UI

1. Open YardFlow Hub
2. Navigate to Sequences tab
3. Click "Create New Sequence"
4. Add 2 steps (Initial + Follow-up)
5. Save sequence

**Validation**: Sequence appears in Firestore AND Railway

---

### T801.3: Test Prospect Enrollment via UI

1. Navigate to Hitlist
2. Select a test prospect (use test@example.com)
3. Click "Enroll in Sequence"
4. Select the sequence from T801.2
5. Confirm enrollment

**Validation**: 
- Enrollment appears in Firestore
- Email queued in Railway (check /api/email/queue/status)

---

### T801.4: Verify Email Queue Processing

```bash
RAILWAY_URL="https://yardflow-hitlist-production-2f41.up.railway.app"

# Check queue status
curl -H "Authorization: Bearer $CRON_SECRET" \
  "$RAILWAY_URL/api/email/queue/status" | jq

# Manually trigger queue processing
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "$RAILWAY_URL/api/cron/process-queue"
```

**Validation**: Email moves from "pending" to "sent" status

---

## Sprint 802: End-to-End Smoke Test

**Goal**: Validate full workflow works  
**Owner**: Casey + Jake together  
**Effort**: 1 hour

### T802.1: Complete User Journey

1. **Import**: Upload test CSV with 3 prospects
2. **Hitlist**: Verify prospects appear, filter by Tier 1
3. **Sequence**: Create "Manifest Outreach" sequence (3 steps)
4. **Enroll**: Bulk enroll all 3 prospects
5. **Dashboard**: See enrollments on dashboard
6. **Email**: Verify first emails queued

### T802.2: Desktop Layout Verification

Test at multiple breakpoints:
- 1920x1080 (desktop)
- 1440x900 (laptop)
- 1024x768 (small laptop)
- 768x1024 (tablet portrait)
- 375x812 (mobile)

**Validation**: No horizontal scroll, all features accessible

---

## Task Dependency Graph

```
T800.1 (LazyIcon) ─────┐
                       │
T800.2 (AppProvider) ──┼──► T800.3 (DesktopLayout) ──► T800.4 (SplitPane)
                       │
T800.5 (Fix Tests) ────┘
                       │
                       ▼
                T801.1 (Railway Health)
                       │
                       ▼
                T801.2 (Create Sequence)
                       │
                       ▼
                T801.3 (Enroll Prospect)
                       │
                       ▼
                T801.4 (Queue Processing)
                       │
                       ▼
                T802.1 (E2E Smoke Test)
                       │
                       ▼
                T802.2 (Layout Verification)
```

---

## Files to Modify

| File | Sprint | Change |
|------|--------|--------|
| `src/App.tsx` | 800.1, 800.3 | Replace lucide imports, use DesktopLayout |
| `src/main.tsx` | 800.2 | Wrap with AppProvider |
| `src/components/SequenceBuilder.tsx` | 800.4 | Use SplitPane for desktop |
| `src/__tests__/components/layout/NavigationSidebar.test.tsx` | 800.5 | Fix failing tests |

---

## Quick Commands Reference

```bash
# Development
npm run dev                     # Start dev server
npm test -- --run               # Run all tests
npm run build                   # Build for production

# Specific test files
npm test -- --run src/__tests__/components/layout/
npm test -- --run src/__tests__/components/icons/

# Type checking
npx tsc --noEmit

# Railway health check
curl https://yardflow-hitlist-production-2f41.up.railway.app/api/health | jq

# Check Railway queue
CRON_SECRET="your-secret"
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://yardflow-hitlist-production-2f41.up.railway.app/api/email/queue/status" | jq
```

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| INP | < 200ms | Chrome DevTools Performance |
| Desktop Layout | No horizontal scroll | Visual check at 1440px |
| Sequence Creation | < 60s | Timer |
| Prospect Enrollment | < 30s | Timer |
| Email Queue | Emails visible | Railway API check |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| App.tsx changes break existing features | Run full test suite after each change |
| Layout regression | Manual check at all breakpoints |
| Railway not processing | Check Railway logs, verify cron |
| Type errors | Run `npx tsc --noEmit` before committing |

---

## Rollback Plan

If Sprint 800 changes break the app:

```bash
# Revert to last known good state
git stash
git checkout HEAD~1 -- src/App.tsx src/main.tsx
npm run dev
# Verify app works, then re-apply changes incrementally
```

---

## EOD Monday Checklist

- [ ] INP < 200ms (no more "Event handlers blocked UI" warnings)
- [ ] Desktop layout works (1440px shows side-by-side)
- [ ] Sequence Builder has split-pane on desktop
- [ ] Can create a sequence with 3+ steps
- [ ] Can enroll a prospect in sequence
- [ ] Can see enrolled prospects in Sequences tab
- [ ] Railway queue shows pending emails
- [ ] All tests pass (`npm test -- --run`)

---

## Next Week Preview (If Monday Goes Well)

**Tuesday-Wednesday**: 
- Set up SendGrid verified sender
- Test actual email delivery
- Configure webhooks for tracking

**Thursday-Friday**:
- Calendly integration testing
- Reply detection setup
- Production data import


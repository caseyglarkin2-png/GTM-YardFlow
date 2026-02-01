# Monday Execution Plan — YardFlow Hub

**Date**: Monday (Updated: Feb 1, 2026)  
**Team**: Casey + Jake  
**Goal**: Make YardFlow Hub **usable for actual outreach** by end of day  
**Status**: Railway deployed ✅ | LazyIcon migrated ✅ | DesktopLayout integration pending

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

## ✅ Completed Tasks (Feb 1)

| Task | Status | Notes |
|------|--------|-------|
| T800.1 AppProvider in main.tsx | ✅ Done | App wrapped with context |
| T800.2 LazyIcon in App.tsx | ✅ Done | All icons except Zap/Loader use LazyIcon |
| SequenceBuilder LazyIcon | ✅ Done | 16 icons migrated |
| DesktopLayout LazyIcon | ✅ Done | X icon migrated |
| NavigationSidebar LazyIcon | ✅ Done | ExternalLink, Settings migrated |
| SplitPane LazyIcon | ✅ Done | ChevronLeft, ChevronRight, GripVertical migrated |
| Full test suite | ✅ 3260 tests pass | All 129 test files green |
| Railway health check | ✅ Healthy | Endpoint responding |

---

## 🚀 SHIP-TODAY CHECKLIST (End User Workflow)

**Goal**: Casey + Jake can login, pick prospects, generate ≤250 char Manifest DMs, and send email outreach.

### Prerequisites

| Step | Status | Action |
|------|--------|--------|
| Set `VITE_MEETING_LINK_SHORT` | ⏳ | Add to Vercel env vars (e.g., `https://cal.co/j/15`) |
| Import emails from CSV | ⏳ | Use Import tab → "Import Emails from CSV" |
| Deploy latest changes | ⏳ | `git push` triggers Vercel deploy |

### User Flow

1. **Login**: Use existing Firebase auth
2. **Filter prospects**: Click "Has Email" filter button to show only prospects with email addresses
3. **Select prospect**: Click any prospect row to view detail panel
4. **Generate DM**: 
   - Select a template from the template dropdown
   - Preview rendered message with {{firstName}}, {{company}}, {{calendlyLink}} replaced
   - Character counter shows remaining chars (limit: 250)
   - ⚠️ Warning appears at 200 chars
   - ❌ Copy blocked if over 250 chars
5. **Copy DM**: Click "Copy DM" button (only enabled when under 250 chars)
6. **Send Email**: Click "Send Email" button OR "Copy Email Payload" for manual sending
7. **Bulk actions**: Use multi-select (checkbox column) for bulk operations

### Changes Made (Session)

| Fix | Description | Files Changed |
|-----|-------------|---------------|
| **FIX A** | Sidebar widths increased 40px each for readability | `DesktopLayout.tsx` |
| **FIX B** | Email import from CSV with prospect matching | `EmailImportService.ts`, `EmailImportModal.tsx`, `App.tsx`, `ImportTab.tsx` |
| **FIX C** | Short meeting link config + 250-char counter + template updates | `App.tsx` (constants, templates, UI) |
| **FIX D** | Email filter (all/has/no) + Copy Email Payload button | `App.tsx` (filter state, UI buttons) |

### New Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_MEETING_LINK_SHORT` | Short calendly link for DMs | `https://cal.co/j/15` |

### Tests Added

- `src/__tests__/utils/dmCharacterCounter.test.ts` — 24 tests for char limit logic
- `src/__tests__/services/EmailImportService.test.ts` — 11 tests for CSV parsing & matching

### Validation Commands

```bash
# Type check
npx tsc --noEmit

# Run new tests
npm test -- --run dmCharacterCounter EmailImportService

# Full test suite
npm test -- --run
```

---

## Current State Assessment

| Component | Status | Action Needed |
|-----------|--------|---------------|
| Railway Backend | ✅ Deployed | None - working |
| LazyIcon migration | ✅ Complete | All components use LazyIcon |
| useMediaQuery hook | ✅ Created, tested | Already usable |
| AppContext | ✅ Created, tested | Wrapped in main.tsx |
| DesktopLayout | ✅ Created, tested | **Integrate into App.tsx** |
| NavigationSidebar | ✅ Created, tested | **Wire to replace inline tabs** |
| SplitPane | ✅ Created, tested | Use in SequenceBuilder (optional) |
| **App.tsx layout integration** | ❌ NOT DONE | **CRITICAL PATH** |
| All tests | ✅ 3260/3260 passing | None |

---

## ⏰ Updated Schedule

```
COMPLETED:
✓ T800.1 - Add AppProvider to main.tsx
✓ T800.2 - Replace Lucide imports with LazyIcon (App.tsx)
✓ Additional - Migrate SequenceBuilder, layout components

REMAINING (Sprint 800.3):
□ T800.3.0  - State sharing strategy design (30 min)
□ T800.3.1  - Extract SidebarContent component (2-3 hours)
□ T800.3.2  - Extract MainContent component (3-4 hours)  
□ T800.3.3  - Integrate DesktopLayout wrapper (2-3 hours)

Sprint 801-802:
□ T801.1-4  - Railway integration verification (1 hour)
□ T802.1-2  - End-to-end smoke test (1 hour)
```

---

# Sprint 800.3: DesktopLayout Integration (DETAILED)

## Executive Summary

**Current State**: App.tsx is a 3,471-line monolith with inline responsive layout logic (~900 lines for layout/sidebar/tabs). The `DesktopLayout`, `NavigationSidebar`, and `SplitPane` components exist and are fully tested but not integrated.

**Target State**: App.tsx uses composition pattern with extracted `SidebarContent` and `MainContent` components rendered via `DesktopLayout`, reducing App.tsx by ~800 lines.

**Risk Level**: Medium-High (touches core layout, affects all tabs)

**Estimated Effort**: 8-12 hours (11 atomic tasks across 4 sprints)

**Approach**: "Strangler Fig" pattern - wrap existing code incrementally, never break functionality

---

## Sprint 800.3.0: Foundation & State Strategy

**Goal**: Define how state flows between extracted components before extraction.
**Demoable Outcome**: Design document with clear prop interfaces.
**Duration**: 30-45 minutes

### T800.3.0a: Audit State Dependencies

**Description**: Document all useState/useCallback calls in App.tsx that sidebar and main content need.

**Deliverable**: State dependency map:
```
Sidebar needs:
- activeTab, setActiveTab
- isMobileSidebarOpen, setIsMobileSidebarOpen  
- filter, setFilter (hitlist only)
- tierFilter, setTierFilter (hitlist only)
- statusFilter, setStatusFilter (hitlist only)
- viewMode, setViewMode (hitlist only)
- offlineQueue (sync status display)
- announce (a11y)
- setShowSettings

MainContent needs:
- activeTab
- prospects, selectedProspect, setSelectedProspect
- chatHistory, setChatHistory (AI tab)
- dashboardData (dashboard tab)
- sequences, enrollments (sequences tab)
- ... (15+ more per tab)
```

**Validation**:
- [ ] All useState calls in render section documented
- [ ] Props grouped by which component needs them
- [ ] Decision: Context vs Props (recommend: Props for now, Context later)

---

### T800.3.0b: Reconcile TabId Types

**Files**: `src/config/navigation.ts`, `src/App.tsx`

**Description**: The navigation config uses TabId with 7 tabs, but App.tsx uses string literals including 'stats' and 'assets' which aren't in the config.

**Action**:
1. Add missing tabs to `NAVIGATION_TABS` OR
2. Remove unused tabs from App.tsx

**Current App.tsx tabs**: `'dashboard' | 'prospects' | 'sequences' | 'import' | 'integrations' | 'assistant' | 'roi' | 'stats' | 'assets'`

**Navigation config tabs**: `'dashboard' | 'prospects' | 'sequences' | 'import' | 'integrations' | 'assistant' | 'roiCalculator'`

**Mismatches**:
- `'roi'` in App vs `'roiCalculator'` in config
- `'stats'` in App, not in config
- `'assets'` in App, not in config

**Validation**:
- [ ] TypeScript compiles with `TabId` used everywhere
- [ ] All tabs render correctly
- [ ] No runtime errors on tab switch

---

## Sprint 800.3.1: Extract Sidebar Content

**Goal**: Extract sidebar JSX from App.tsx into standalone component.
**Demoable Outcome**: App renders identically, sidebar code in separate file.
**Duration**: 2-3 hours

### T800.3.1a: Create SidebarContent Component Shell

**File**: `src/components/layout/SidebarContent.tsx`

**Description**: Create component that accepts all sidebar dependencies as props.

```typescript
// src/components/layout/SidebarContent.tsx
import { type ReactNode } from 'react';
import { type TabId } from '@/config/navigation';
import { type ViewMode } from '@/components/ViewModeToggle';

export interface SidebarContentProps {
  // Navigation
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
  onSettingsClick: () => void;
  onCloseMobile?: () => void;
  
  // Hitlist filters (only used when activeTab === 'prospects')
  filter?: string;
  onFilterChange?: (value: string) => void;
  tierFilter?: string;
  onTierFilterChange?: (value: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  tagFilter?: string[];
  onTagFilterChange?: (tags: string[]) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  
  // Status display
  syncStatus?: { status: string; pendingCount: number; retry: () => void };
  
  // Accessibility
  announce?: (message: string) => void;
  
  // Additional content slots
  headerContent?: ReactNode;
  footerContent?: ReactNode;
}

export function SidebarContent(props: SidebarContentProps): React.ReactElement {
  // Implementation in subsequent tasks
  return <div data-testid="sidebar-content">TODO</div>;
}
```

**Test** (`src/__tests__/components/layout/SidebarContent.test.tsx`):
```typescript
describe('SidebarContent', () => {
  it('renders without crashing', () => {
    render(<SidebarContent activeTab="dashboard" onTabChange={vi.fn()} onSettingsClick={vi.fn()} />);
    expect(screen.getByTestId('sidebar-content')).toBeInTheDocument();
  });
});
```

**Validation**:
- [ ] TypeScript compiles
- [ ] Test passes
- [ ] Exports match interface

---

### T800.3.1b: Extract Tab Navigation

**Files**: 
- Source: `src/App.tsx` (lines 1871-1943)
- Target: `src/components/layout/SidebarContent.tsx`

**Description**: Move the 7 tab buttons into SidebarContent. Use NAVIGATION_TABS config for consistency.

**JSX to Extract**:
```tsx
<div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg mb-4" role="tablist">
  {NAVIGATION_TABS.map(tab => (
    <button
      key={tab.id}
      onClick={() => { onTabChange(tab.id); announce?.(`${tab.label} tab selected`); }}
      role="tab"
      aria-selected={activeTab === tab.id}
      aria-controls={tab.panelId}
      className={`... ${activeTab === tab.id ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
    >
      <LazyIcon name={tab.icon.name} className="h-3 w-3 mr-1" />
      {tab.label}
    </button>
  ))}
</div>
```

**Note**: NAVIGATION_TABS uses LucideIcon components directly. Need to map to LazyIcon names.

**Test**:
```typescript
it('renders all 7 tabs', () => {
  render(<SidebarContent {...defaultProps} />);
  expect(screen.getAllByRole('tab')).toHaveLength(7);
});

it('marks active tab as selected', () => {
  render(<SidebarContent {...defaultProps} activeTab="sequences" />);
  expect(screen.getByRole('tab', { name: /sequences/i })).toHaveAttribute('aria-selected', 'true');
});

it('calls onTabChange when tab clicked', () => {
  const onTabChange = vi.fn();
  render(<SidebarContent {...defaultProps} onTabChange={onTabChange} />);
  fireEvent.click(screen.getByRole('tab', { name: /hitlist/i }));
  expect(onTabChange).toHaveBeenCalledWith('prospects');
});
```

**Validation**:
- [ ] All 7 tabs render
- [ ] Click each tab → correct callback fired
- [ ] aria-selected reflects activeTab

---

### T800.3.1c: Extract Sidebar Header

**Files**: 
- Source: `src/App.tsx` (lines 1815-1870)
- Target: `src/components/layout/SidebarContent.tsx`

**Description**: Move YardFlow logo, Railway link, SyncStatus, and Settings button.

**JSX to Extract**:
```tsx
<div className="p-4 border-b border-slate-100">
  <div className="hidden lg:flex items-center justify-between mb-4">
    <div className="flex items-center space-x-2">
      <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
        <Zap className="h-5 w-5 text-white" />
      </div>
      <h1 className="font-bold text-lg">YardFlow <span className="text-blue-600">Hub</span></h1>
    </div>
    <div className="flex items-center gap-2">
      <a href="..." target="_blank">Railway</a>
      <SyncStatus ... />
      <button onClick={onSettingsClick}>Settings</button>
    </div>
  </div>
</div>
```

**Test**:
```typescript
it('renders logo', () => {
  render(<SidebarContent {...defaultProps} />);
  expect(screen.getByText('YardFlow')).toBeInTheDocument();
});

it('settings button calls onSettingsClick', () => {
  const onSettingsClick = vi.fn();
  render(<SidebarContent {...defaultProps} onSettingsClick={onSettingsClick} />);
  fireEvent.click(screen.getByLabelText(/settings/i));
  expect(onSettingsClick).toHaveBeenCalled();
});
```

**Validation**:
- [ ] Header renders with logo
- [ ] Railway link has correct href
- [ ] Settings button works

---

### T800.3.1d: Extract Hitlist Filters

**Files**: 
- Source: `src/App.tsx` (lines 1944-2126)
- Target: `src/components/layout/SidebarContent.tsx`

**Description**: Move the filter section that shows when `activeTab === 'prospects'`.

**JSX to Extract** (conditionally rendered):
```tsx
{activeTab === 'prospects' && (
  <div className="p-4 space-y-3">
    {/* Search input */}
    <input type="text" placeholder="Search..." value={filter} onChange={...} />
    
    {/* Tier dropdown */}
    <select value={tierFilter} onChange={...}>...</select>
    
    {/* Status dropdown */}
    <select value={statusFilter} onChange={...}>...</select>
    
    {/* View mode toggle */}
    <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
  </div>
)}
```

**Test**:
```typescript
it('shows filters when activeTab is prospects', () => {
  render(<SidebarContent {...defaultProps} activeTab="prospects" />);
  expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
});

it('hides filters when activeTab is not prospects', () => {
  render(<SidebarContent {...defaultProps} activeTab="dashboard" />);
  expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
});

it('updates filter on input', () => {
  const onFilterChange = vi.fn();
  render(<SidebarContent {...defaultProps} activeTab="prospects" onFilterChange={onFilterChange} />);
  fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'test' } });
  expect(onFilterChange).toHaveBeenCalledWith('test');
});
```

**Validation**:
- [ ] Filters hidden on non-prospects tabs
- [ ] Search input updates filter
- [ ] Dropdowns work
- [ ] ViewModeToggle works

---

### T800.3.1e: Wire SidebarContent into App.tsx

**File**: `src/App.tsx`

**Description**: Replace inline sidebar JSX with `<SidebarContent />` component.

**Before** (lines 1815-2126, ~300 lines):
```tsx
<div className="p-4 border-b border-slate-100">
  {/* Header */}
  {/* Tabs */}
  {/* Filters */}
</div>
```

**After**:
```tsx
import { SidebarContent } from '@/components/layout/SidebarContent';

// In render:
<SidebarContent
  activeTab={activeTab}
  onTabChange={setActiveTab}
  onSettingsClick={() => setShowSettings(true)}
  onCloseMobile={() => setIsMobileSidebarOpen(false)}
  filter={filter}
  onFilterChange={setFilter}
  tierFilter={tierFilter}
  onTierFilterChange={setTierFilter}
  statusFilter={statusFilter}
  onStatusFilterChange={setStatusFilter}
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  syncStatus={offlineQueue}
  announce={announce}
/>
```

**Test**: Smoke test all existing functionality still works.

**Validation**:
- [ ] App.tsx reduced by ~300 lines
- [ ] All tabs switch correctly
- [ ] Hitlist filters work
- [ ] Mobile sidebar opens/closes
- [ ] All 3260 tests still pass

---

## Sprint 800.3.2: Extract Main Content

**Goal**: Extract main content area (tab panels) into separate component.
**Demoable Outcome**: App renders identically, main content in separate file.
**Duration**: 3-4 hours

### T800.3.2a: Create MainContent Component Shell

**File**: `src/components/layout/MainContent.tsx`

**Description**: Create component that renders correct panel based on activeTab.

```typescript
// src/components/layout/MainContent.tsx
import { type TabId } from '@/config/navigation';

export interface MainContentProps {
  activeTab: TabId;
  // Tab-specific props passed through
  children?: React.ReactNode;
}

export function MainContent({ activeTab, children }: MainContentProps): React.ReactElement {
  return (
    <main id="main-content" className="flex-1 flex flex-col bg-slate-50 overflow-hidden" role="main">
      {children}
    </main>
  );
}
```

**Note**: We'll use children pattern initially, then extract individual panels.

**Validation**:
- [ ] Component renders
- [ ] main element has correct role

---

### T800.3.2b: Extract Dashboard Panel

**Files**: 
- Source: `src/App.tsx` (lines 2127-2383)
- Target: `src/components/panels/DashboardPanel.tsx`

**Description**: Extract the full dashboard including KPIs, charts, and stats.

**Sub-components** (already exist or extract):
- KPICard grid (6 cards)
- DateRangePicker
- FunnelChart, BarChart, PieChart, LineChart
- Leaderboard
- Export button

**Test**:
```typescript
it('renders KPI cards', () => {
  render(<DashboardPanel {...mockProps} />);
  expect(screen.getAllByTestId('kpi-card')).toHaveLength(6);
});

it('renders charts', () => {
  render(<DashboardPanel {...mockProps} />);
  expect(screen.getByTestId('funnel-chart')).toBeInTheDocument();
});
```

**Validation**:
- [ ] Dashboard loads without errors
- [ ] All 6 KPI cards display
- [ ] Charts render
- [ ] Date picker works
- [ ] Export works

---

### T800.3.2c: Extract Sequences Panel

**Files**: 
- Source: `src/App.tsx` (lines 2384-2430)
- Target: `src/components/panels/SequencesPanel.tsx`

**Description**: Extract the sequences tab with SequenceManagerPanel and SequencePerformancePanel.

**Test**:
```typescript
it('renders sequence manager', () => {
  render(<SequencesPanel {...mockProps} />);
  expect(screen.getByText(/create.*sequence/i)).toBeInTheDocument();
});
```

**Validation**:
- [ ] Sequences tab loads
- [ ] Can see sequence list
- [ ] Performance metrics display

---

### T800.3.2d: Extract Remaining Panels

**Files**: 
- Source: `src/App.tsx` (lines 2431-2675)
- Target: Multiple panel files

**Panels to Extract**:
1. `ImportPanel.tsx` - ImportWizard wrapper
2. `IntegrationsPanel.tsx` - HubSpot integration
3. `AIAssistantPanel.tsx` - Chat interface
4. `ROIPanel.tsx` - ROI calculator

**Validation**:
- [ ] Import: can see upload interface
- [ ] Integrations: HubSpot section visible
- [ ] AI: can see chat input
- [ ] ROI: calculator renders

---

### T800.3.2e: Wire MainContent into App.tsx

**File**: `src/App.tsx`

**Description**: Replace inline main content with panels rendered via MainContent.

**Before** (~550 lines of tab content):
```tsx
<main>
  {activeTab === 'dashboard' ? <DashboardStuff /> : 
   activeTab === 'sequences' ? <SequenceStuff /> : ...}
</main>
```

**After**:
```tsx
<MainContent activeTab={activeTab}>
  {activeTab === 'dashboard' && <DashboardPanel {...dashboardProps} />}
  {activeTab === 'sequences' && <SequencesPanel {...sequenceProps} />}
  {activeTab === 'prospects' && <ProspectsPanel {...prospectProps} />}
  {/* etc */}
</MainContent>
```

**Validation**:
- [ ] App.tsx reduced by ~500 lines
- [ ] All tabs functional
- [ ] All tests pass

---

## Sprint 800.3.3: Integrate DesktopLayout Wrapper

**Goal**: Wrap with DesktopLayout for collapsible sidebar and proper responsive behavior.
**Demoable Outcome**: Desktop shows collapsible sidebar, mobile shows slide-out drawer.
**Duration**: 2-3 hours

### T800.3.3a: Replace Inline Layout with DesktopLayout

**File**: `src/App.tsx`

**Description**: Replace mobile header, overlay, and sidebar wrapper with DesktopLayout.

**Current Pattern** (lines 1775-1815):
```tsx
{/* Mobile Header */}
<div className="lg:hidden">...</div>

{/* Mobile Overlay */}
{isMobileSidebarOpen && <div className="fixed inset-0 z-40">...</div>}

{/* Sidebar wrapper */}
<div className={`fixed lg:relative ... ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
  <SidebarContent />
</div>

{/* Main */}
<MainContent />
```

**New Pattern**:
```tsx
import { DesktopLayout } from '@/components/layout';

// Mobile header stays OUTSIDE DesktopLayout for z-index control
<div className="lg:hidden fixed top-0 ...">
  <button onClick={() => setIsMobileSidebarOpen(true)}>Menu</button>
</div>

<DesktopLayout
  sidebar={<SidebarContent {...sidebarProps} />}
  main={
    <MainContent activeTab={activeTab}>
      {/* Tab panels */}
    </MainContent>
  }
  sidebarWidth="medium"
  collapsible
  isMobileSidebarOpen={isMobileSidebarOpen}
  onMobileSidebarClose={() => setIsMobileSidebarOpen(false)}
/>
```

**Test**:
```typescript
describe('App Layout Integration', () => {
  it('desktop: shows sidebar and main side by side', () => {
    mockUseIsDesktop.mockReturnValue(true);
    render(<App />);
    expect(screen.getByRole('complementary')).toBeVisible();
    expect(screen.getByRole('main')).toBeVisible();
  });
  
  it('mobile: hamburger opens sidebar', () => {
    mockUseIsDesktop.mockReturnValue(false);
    render(<App />);
    fireEvent.click(screen.getByLabelText(/open navigation/i));
    expect(screen.getByRole('dialog')).toBeVisible();
  });
});
```

**Validation**:
- [ ] Desktop at 1440px: side-by-side layout
- [ ] Mobile at 375px: hamburger menu works
- [ ] Collapse button works on desktop
- [ ] Collapse state persists in localStorage
- [ ] No horizontal scroll

---

### T800.3.3b: Remove Duplicate Mobile Header

**File**: `src/App.tsx`

**Description**: DesktopLayout handles mobile sidebar overlay. Remove duplicate code from App.tsx but keep the mobile header bar (hamburger + logo + settings).

**Keep**:
```tsx
{/* Mobile Header - OUTSIDE DesktopLayout */}
<div className="fixed top-0 ... lg:hidden z-30">
  <button onClick={() => setIsMobileSidebarOpen(true)}>Menu</button>
  <Logo />
  <button onClick={() => setShowSettings(true)}>Settings</button>
</div>
```

**Remove**:
```tsx
{/* Mobile Sidebar Overlay - DesktopLayout handles this */}
{isMobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50">...</div>}
```

**Validation**:
- [ ] No duplicate overlay on mobile
- [ ] Hamburger still opens sidebar
- [ ] Backdrop click closes sidebar

---

### T800.3.3c: Add Integration Tests

**File**: `src/__tests__/integration/layout-integration.test.tsx`

**Description**: End-to-end tests for layout behavior.

```typescript
describe('Layout Integration', () => {
  describe('Desktop', () => {
    beforeEach(() => mockUseIsDesktop.mockReturnValue(true));
    
    it('renders sidebar and main content', () => {...});
    it('tab navigation changes main content', () => {...});
    it('sidebar collapse persists across reload', () => {...});
  });
  
  describe('Mobile', () => {
    beforeEach(() => mockUseIsDesktop.mockReturnValue(false));
    
    it('sidebar is hidden by default', () => {...});
    it('hamburger opens sidebar', () => {...});
    it('tab change closes sidebar', () => {...});
    it('backdrop click closes sidebar', () => {...});
  });
  
  describe('Responsive', () => {
    it('layout changes at 1024px breakpoint', () => {...});
  });
});
```

**Validation**:
- [ ] All integration tests pass
- [ ] Coverage for critical user journeys
- [ ] No console errors

---

## Dependency Graph

```
T800.3.0a (State audit) ─────┐
T800.3.0b (TabId types) ─────┼─► Foundation complete
                              │
                              ▼
T800.3.1a (SidebarContent shell) ────┐
T800.3.1b (Tab nav) ─────────────────┤
T800.3.1c (Header) ──────────────────┼─► T800.3.1e (Wire Sidebar)
T800.3.1d (Filters) ─────────────────┘         │
                                               ▼
                              Sprint 800.3.1 complete ✓
                                               │
                                               ▼
T800.3.2a (MainContent shell) ───────┐
T800.3.2b (Dashboard) ───────────────┤
T800.3.2c (Sequences) ───────────────┼─► T800.3.2e (Wire MainContent)
T800.3.2d (Other panels) ────────────┘         │
                                               ▼
                              Sprint 800.3.2 complete ✓
                                               │
                                               ▼
T800.3.3a (DesktopLayout wrapper) ──────┐
T800.3.3b (Remove duplicates) ──────────┼─► T800.3.3c (Integration tests)
                                        │
                                        ▼
                              Sprint 800.3.3 complete ✓
```

---

## Rollback Strategy

Each sprint is independently deployable:

| After Sprint | State | Rollback |
|--------------|-------|----------|
| 800.3.0 | Types fixed, state documented | N/A |
| 800.3.1 | SidebarContent extracted | `git checkout HEAD~1 -- src/App.tsx` |
| 800.3.2 | MainContent extracted | `git checkout HEAD~1 -- src/App.tsx` |
| 800.3.3 | Full DesktopLayout | `git checkout HEAD~1 -- src/App.tsx` |

**Feature Flag Option** (if needed):
```typescript
// src/config/featureFlags.ts
export const useNewLayout = () => 
  import.meta.env.VITE_NEW_LAYOUT === 'true';
```

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| App.tsx lines | 3,471 | ~2,200 (-1,200) |
| Sidebar code in App.tsx | ~900 lines | 0 |
| Main content in App.tsx | ~550 lines | 0 |
| Components used | 0 layout | 3 (DesktopLayout, SidebarContent, MainContent) |
| Test count | 3,260 | 3,260+ (no regression + new tests) |
| INP on tab click | <200ms | <200ms (no regression) |

---

## Time Estimates (Realistic)

| Sprint | Tasks | Estimated Time |
|--------|-------|----------------|
| 800.3.0 | 2 | 30-45 min |
| 800.3.1 | 5 | 2-3 hours |
| 800.3.2 | 5 | 3-4 hours |
| 800.3.3 | 3 | 2-3 hours |
| **Total** | **15** | **8-11 hours** |

**Buffer**: Add 2-3 hours for unexpected issues = **10-14 hours total**
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


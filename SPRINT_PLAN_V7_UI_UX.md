# YardFlow GTM Hub - Sprint Plan V7 (UI/UX Integration & Bug Fixes)

## Executive Summary

**Problem:** Backend services (Sprints 26-33) are built and tested but NOT wired to the UI. Integration buttons are fake, components exist but aren't rendered, and E2E tests fail due to missing UI elements.

**Goal:** Wire all existing services to the UI, fix broken integrations, add missing components, and ensure E2E tests pass.

**Current State:**
- Tests: 1870 passing (unit tests)
- E2E: Multiple failures expected due to missing UI
- Components: 15+ built but not imported
- Services: 10+ tested but not connected

**Revised Estimates:** ~75-85 hours total (47 tasks across 9 sprints)

---

## 🚀 Parallel Execution Plan (Sprints 34, 36, 43)

**See [SPRINT_PARALLEL_EXECUTION.md](./SPRINT_PARALLEL_EXECUTION.md) for the detailed atomic task breakdown.**

### Priority Workstreams (Execute Simultaneously)

| Workstream | Sprint | Focus | Effort | Status |
|------------|--------|-------|--------|--------|
| A | 34 | HubSpot OAuth UI Wiring | ~11h | 🔄 Ready |
| B | 36 | Bulk Operations UI | ~14h | 🔄 Ready |
| C | 43 | Email Infrastructure | ~38h | 🔄 Ready |

**Total Parallel Effort:** ~63-68 hours
**Estimated Duration:** 7-8 days with parallel execution

### Pre-Execution Requirements
```bash
# Install required dependencies
npm install @sendgrid/mail@^7.7.0 @sendgrid/eventwebhook@^7.7.0 firebase-admin@^12.0.0
```

### Critical Environment Variables
```bash
# Firebase Admin (Server-side)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'

# HubSpot OAuth
VITE_HUBSPOT_CLIENT_ID=xxx
VITE_HUBSPOT_REDIRECT_URI=https://gtm-yard-flow.vercel.app/oauth/callback
HUBSPOT_CLIENT_SECRET=xxx

# SendGrid
SENDGRID_API_KEY=SG.xxx
SENDGRID_WEBHOOK_SIGNING_KEY=xxx
```

---

## Sprint 34: Critical UI Wiring (Foundation)
**Goal:** Wire critical services to UI so core features actually work.
**Demo:** Click "Connect HubSpot" → OAuth flow starts. Ctrl+K opens command palette.
**Validation:** E2E tests pass for navigation.spec.ts

### T34.0: Audit and Add data-testid Attributes [XS - 30m]
**Goal:** Ensure E2E tests can locate elements.
**Files:**
- `src/App.tsx` - Add missing data-testid attributes
- Various components
**Changes:**
1. Add `data-testid="command-palette"` to CommandPalette
2. Add `data-testid="hubspot-connect"` to HubSpot button
3. Add `data-testid="sync-status"` to SyncStatus
4. Add `data-testid="offline-banner"` to OfflineBanner
5. Verify E2E selectors match
**Tests:**
- E2E: Verify selectors find elements
**Validation:**
- [ ] All E2E selectors from navigation.spec.ts have matching data-testid
- [ ] All E2E selectors from offline.spec.ts have matching data-testid

### T34.1a: Create useHubSpot Hook with OAuth [M - 2h]
**Goal:** Create React hook that wraps HubSpotAuthService for OAuth initiation.
**Files:**
- `src/hooks/useHubSpot.ts` (new) - React hook for HubSpot integration
**Dependencies:** None
**Changes:**
1. Create `useHubSpot` hook that wraps HubSpotAuthService
2. Implement `connect()` function that starts OAuth flow
3. Handle popup blocker fallback to redirect flow
4. Add `disconnect()` function
5. Expose connection state
**Interface:**
```typescript
function useHubSpot() {
  return {
    status: 'disconnected' | 'connecting' | 'connected' | 'error',
    portalId: string | null,
    error: string | null,
    connect: () => Promise<void>,
    disconnect: () => void,
    isConnected: boolean,
  };
}
```
**Tests:**
- Unit: `src/__tests__/hooks/useHubSpot.test.ts`
**Validation:**
- [ ] Hook initializes with correct default state
- [ ] `connect()` opens OAuth popup or redirects
- [ ] Unit tests pass

### T34.1b: Handle OAuth Callback and Token Persistence [M - 2h]
**Goal:** Complete OAuth flow by handling callback and persisting tokens.
**Files:**
- `src/hooks/useHubSpot.ts` - Add callback handling
- `src/App.tsx` - Import and use hook
**Dependencies:** T34.1a
**Changes:**
1. Parse OAuth callback URL parameters (code, state)
2. Exchange authorization code for tokens
3. Store tokens in localStorage with expiry
4. Auto-refresh tokens before expiry
5. Wire hook to "Connect HubSpot" button in App.tsx
6. Replace fake `setHubspotConnectionStatus` with actual hook
**Tests:**
- Unit: Token persistence and refresh
- E2E: `e2e/integrations.spec.ts` (create)
**Validation:**
- [ ] Click "Connect HubSpot" → Opens HubSpot OAuth
- [ ] After auth → Status shows "Connected"
- [ ] Refresh page → Connection persists
- [ ] Token auto-refreshes

### T34.2: Add CommandPalette to App [XS - 30m]
**Goal:** Enable Ctrl+K / Cmd+K keyboard shortcut for quick navigation.
**Files:**
- `src/App.tsx` - Import and render CommandPalette
**Dependencies:** None (useCommandPalette hook already exists)
**Changes:**
1. Import `CommandPalette` component
2. Import `useCommandPalette` hook (already exists)
3. Add to render tree (top level, always mounted)
4. Verify keyboard shortcut works via existing hook
**Tests:**
- E2E: `e2e/navigation.spec.ts` - Ctrl+K opens palette
**Validation:**
- [ ] Press Ctrl+K → Command palette opens
- [ ] Type "dashboard" → Shows Dashboard option
- [ ] Press Enter → Navigates to Dashboard tab
- [ ] Press Escape → Closes palette
- [ ] E2E test passes

### T34.3: Create useOfflineQueue Hook and Wire Sync/Offline [M - 2h]
**Goal:** Create hook for OfflineQueue state and wire both SyncStatus and OfflineBanner.
**Files:**
- `src/hooks/useOfflineQueue.ts` (new) - React hook for OfflineQueue
- `src/App.tsx` - Import and wire SyncStatus and OfflineBanner
**Dependencies:** None
**Changes:**
1. Create `useOfflineQueue` hook wrapping OfflineQueue service
2. Expose `pendingCount`, `isSyncing`, `lastSyncTime` state
3. Import `SyncStatus` component
4. Add SyncStatus to desktop header (next to settings button)
5. Wire OfflineBanner (already imported) to hook state
6. Fix z-index and positioning for OfflineBanner
**Interface:**
```typescript
function useOfflineQueue() {
  return {
    pendingCount: number,
    isSyncing: boolean,
    lastSyncTime: Date | null,
    syncNow: () => Promise<void>,
    isOnline: boolean,
  };
}
```
**Tests:**
- Unit: `src/__tests__/hooks/useOfflineQueue.test.ts`
- E2E: `e2e/offline.spec.ts` - Offline banner appears
**Validation:**
- [ ] Sync indicator visible in header
- [ ] Shows "Synced" when up to date
- [ ] Shows pending count when items queued
- [ ] Toggle devtools network to offline → OfflineBanner appears
- [ ] Toggle back to online → Banner shows "Back online" then fades

### T34.4: Add PresenceIndicator for Multi-User [S - 1h]
**Goal:** Show who else is viewing the same prospect.
**Files:**
- `src/App.tsx` - Import PresenceIndicator
- Add to prospect detail header
**Dependencies:** None
**Changes:**
1. Import `PresenceIndicator` component
2. Add to prospect detail view header
3. Wire to PresenceService
**Tests:**
- Unit: Verify PresenceIndicator renders with mock users
**Validation:**
- [ ] When another user views same prospect → Avatar appears
- [ ] Hover shows user name
- [ ] Multiple users show stacked avatars

### T34.5: Create e2e/integrations.spec.ts [S - 1h]
**Goal:** Create E2E tests for integration features.
**Files:**
- `e2e/integrations.spec.ts` (new)
**Dependencies:** T34.1a, T34.1b
**Tests:**
1. Navigate to Integrations tab
2. HubSpot connect button visible
3. Click connect → OAuth flow starts (mocked)
4. Verify connected state display
**Validation:**
- [ ] `npm run test:e2e -- integrations.spec.ts` passes

### T34.6: Sprint 34 E2E Validation [S - 1h]
**Goal:** Ensure all Sprint 34 features pass E2E tests.
**Files:**
- `e2e/navigation.spec.ts`
- `e2e/offline.spec.ts`
- `e2e/integrations.spec.ts`
**Dependencies:** T34.0 through T34.5
**Tests:**
1. Command palette opens with Ctrl+K
2. Offline banner appears when offline
3. HubSpot OAuth flow initiates
4. Sync status indicator visible
**Validation:**
- [ ] `npm run test:e2e -- navigation.spec.ts` passes
- [ ] `npm run test:e2e -- offline.spec.ts` passes
- [ ] `npm run test:e2e -- integrations.spec.ts` passes

---

## Sprint 35: Dashboard & Analytics Wire-Up ✅ COMPLETE
**Goal:** Replace inline dashboard with full DashboardLayout, add export functionality.
**Demo:** Dashboard shows full analytics with date picker, export button works.
**Validation:** E2E tests pass for dashboard.spec.ts
**Status:** ✅ COMPLETE - 7 commits pushed (d05861e → 95c78a9)

### T35.0: Wire AnalyticsAggregator to useDashboardData [S - 1h] ✅ DONE
**Goal:** Ensure dashboard hook uses AnalyticsAggregator for real data.
**Files:**
- `src/hooks/useDashboardData.ts` - Added optional `aggregator` parameter
- `src/App.tsx` - Creates aggregator and passes to hook
**Commits:** d05861e, 95c78a9 (critical fix)
**Changes:**
1. ✅ Added `aggregator?: AnalyticsAggregator` option to useDashboardData
2. ✅ Cache key includes source type (agg/mock)
3. ✅ App.tsx creates aggregator with `createAnalyticsAggregator()`
4. ✅ Converts Prospect[] to ProspectData[] format
**Tests:**
- ✅ Unit: 4 aggregator integration tests added
**Validation:**
- [x] useDashboardData returns KPI metrics
- [x] Data matches Firestore state

### T35.1: Refactor Inline Dashboard to use DashboardLayout [M - 3h] ✅ DONE
**Goal:** Use the full DashboardLayout component wrapper with all features.
**Files:**
- `src/App.tsx` - Added DateRangePicker and useDashboardData to dashboard tab
**Commits:** 3a0fa13
**Changes:**
1. ✅ Import DateRangePicker, useDashboardData hook
2. ✅ Add dashboardPeriod, dashboardCustomRange, dashboardDateRange state
3. ✅ Wire DateRangePicker to dashboard header
4. ✅ Dashboard uses useDashboardData hook with date range
**Tests:**
- ✅ E2E: `e2e/dashboard.spec.ts` - T35.1 test added
**Validation:**
- [x] Dashboard shows date range picker
- [x] Changing date range refreshes data

### T35.2: Wire DashboardExporter to Export Button [S - 1.5h] ✅ DONE
**Goal:** Export button downloads PNG or PDF of dashboard.
**Files:**
- `src/App.tsx` - Added export dropdown with PNG/PDF options
**Commits:** db3f02f
**Changes:**
1. ✅ Import dashboardExporter service
2. ✅ Add export dropdown (PNG/PDF options)
3. ✅ Wire button click to export function
4. ✅ Show loading state during export
5. ✅ Add dashboardRef for screenshot capture
**Tests:**
- ✅ E2E: `e2e/dashboard.spec.ts` - T35.2 export visibility test
**Validation:**
- [x] Click export → Dropdown shows PNG/PDF
- [x] Click PNG → Downloads PNG file
- [x] Click PDF → Downloads PDF file

### T35.3: Add Chart Components to Dashboard [M - 3h] ✅ DONE
**Goal:** Render actual charts from the charts/ folder.
**Files:**
- `src/App.tsx` - Dashboard tab
**Commits:** f30eac4
**Changes:**
1. ✅ Import FunnelChart, BarChart, PieChart from components/charts
2. ✅ Add FunnelChart for pipeline stages (New → Contacted → Booked)
3. ✅ Add BarChart for activity by type
4. ✅ Add PieChart for tier distribution (Tier 1/2/3)
5. ✅ Add PieChart for outreach status distribution
6. ✅ Fixed ChartDataPoint type (label vs name property)
**Tests:**
- ✅ E2E: `e2e/dashboard.spec.ts` - T35.3 charts visibility test
**Validation:**
- [x] Funnel chart shows pipeline stages
- [x] Bar chart shows activity counts
- [x] Pie charts show tier/status distribution

### T35.4: Add DateRangePicker to Hitlist Filter [S - 1h] ✅ DONE
**Goal:** Filter prospects by createdAt date.
**Files:**
- `src/App.tsx` - Hitlist tab filter area
**Commits:** 3da68ca
**Changes:**
1. ✅ Add hitlistDatePeriod, hitlistCustomRange state (TimePeriod type)
2. ✅ Compute hitlistDateRange with useMemo
3. ✅ Update filteredProspects to filter by createdAt date
4. ✅ Add DateRangePicker below tier filters
**Tests:**
- ✅ E2E: `e2e/dashboard.spec.ts` - T35.4 hitlist date filter test
**Validation:**
- [x] Date picker visible in Hitlist
- [x] Selecting range filters prospects

### T35.5: Sprint 35 E2E Validation [S - 1h] ✅ DONE
**Goal:** All dashboard E2E tests pass.
**Files:**
- `e2e/dashboard.spec.ts` - Added Sprint 35 test suite
**Commits:** aaed97d
**Changes:**
1. ✅ Added T35.1 test: Dashboard has DateRangePicker
2. ✅ Added T35.2 test: Export dropdown visibility
3. ✅ Added T35.3 test: Dashboard shows charts
4. ✅ Added T35.4 test: Hitlist has date filter
5. ✅ Added dashboard refresh button test
**Validation:**
- [x] E2E tests added for all Sprint 35 tasks
- [x] 1870 unit tests passing

---

## Sprint 36: Bulk Operations UI
**Goal:** Add checkboxes to prospect list, bulk action toolbar, and wire BulkActionService.
**Demo:** Select 10 prospects → Click "Add to Sequence" → All assigned.
**Validation:** E2E tests pass for bulk.spec.ts

### T36.0: Add Selection State Management to App.tsx [S - 1h]
**Goal:** Add state for tracking selected prospect IDs.
**Files:**
- `src/App.tsx` - Add selection state
**Dependencies:** None
**Changes:**
1. Add `selectedProspectIds: Set<string>` state
2. Add `toggleSelection(id)` handler
3. Add `selectAll()` / `clearSelection()` handlers
4. Add `isAllSelected` computed value
**Tests:**
- Unit: Selection state logic
**Validation:**
- [ ] Selection state updates correctly
- [ ] Clear selection works
- [ ] Select all selects visible prospects

### T36.1: Add Checkboxes to Prospect List [M - 2h]
**Goal:** Each prospect row has a selectable checkbox.
**Files:**
- `src/App.tsx` - Prospect list rendering
- Use `src/services/MultiSelectService.ts`
**Dependencies:** T36.0
**Changes:**
1. Add checkbox column to prospect list header
2. Add checkbox to each prospect row
3. Wire to selection state from T36.0
4. Shift+click range selection using MultiSelectService
5. Header checkbox toggles select all
**Tests:**
- Unit: MultiSelectService tests (already exist)
- E2E: `e2e/bulk.spec.ts` - Checkbox selection
**Validation:**
- [ ] Click checkbox → Prospect selected (highlighted)
- [ ] Click header checkbox → All visible selected
- [ ] Shift+click → Range selected
- [ ] Badge shows "X selected"

### T36.2: Add Bulk Actions Toolbar [M - 3h]
**Goal:** When prospects selected, show floating action toolbar.
**Files:**
- `src/components/BulkActionsToolbar.tsx` (new)
- `src/App.tsx` - Render toolbar when selection > 0
**Dependencies:** T36.0, T36.1
**Changes:**
1. Create BulkActionsToolbar component
2. Actions: Assign to Sequence, Add Tag, Change Status, Export, Delete
3. Show selection count
4. Confirm dialog for destructive actions
5. Add data-testid attributes for E2E tests
**Interface:**
```tsx
interface BulkActionsToolbarProps {
  selectedCount: number;
  onAssignSequence: () => void;
  onAddTag: () => void;
  onChangeStatus: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
}
```
**Tests:**
- Unit: `src/__tests__/components/BulkActionsToolbar.test.tsx`
- E2E: Toolbar appears when selected
**Validation:**
- [ ] Select prospects → Toolbar appears at bottom of screen
- [ ] Shows "X selected"
- [ ] Clear button deselects all
- [ ] Toolbar has all action buttons with icons

### T36.3: Wire BulkActionService for Sequence Assignment [M - 2h]
**Goal:** "Assign to Sequence" actually assigns prospects.
**Files:**
- `src/components/BulkActionsToolbar.tsx`
- Wire to `src/services/BulkActionService.ts`
**Dependencies:** T36.2
**Changes:**
1. Import BulkActionService
2. On click → Show sequence selector modal
3. Call bulkAssignSequence(ids, sequenceId)
4. Show progress/success toast
**Tests:**
- Unit: Mock BulkActionService
- E2E: Bulk assign works
**Validation:**
- [ ] Click "Assign to Sequence" → Modal opens
- [ ] Select sequence → Progress shown
- [ ] Success → Toast "X prospects assigned"
- [ ] Prospects now have sequence indicator

### T36.4: Wire BulkExporter for Bulk Export [S - 1.5h]
**Goal:** Export selected prospects as CSV/JSON.
**Files:**
- Wire to `src/services/BulkExporter.ts`
**Dependencies:** T36.2
**Changes:**
1. Export button → Format dropdown (CSV/JSON/Excel)
2. Call BulkExporter.export(ids, format)
3. Download file
**Tests:**
- E2E: Export downloads file
**Validation:**
- [ ] Select prospects → Export dropdown
- [ ] Click CSV → Downloads CSV file
- [ ] File contains correct prospects

### T36.5: Wire BulkDeleteService with Confirmation [S - 1h]
**Goal:** Delete selected prospects with undo option.
**Files:**
- Wire to `src/services/BulkDeleteService.ts`
**Dependencies:** T36.2
**Changes:**
1. Delete button → Confirmation modal
2. Call BulkDeleteService.softDelete(ids)
3. Show undo toast for 10 seconds
4. Undo calls BulkDeleteService.restore(ids)
**Tests:**
- E2E: Delete and undo work
**Validation:**
- [ ] Delete shows confirmation "Delete X prospects?"
- [ ] Confirm → Prospects removed, undo toast
- [ ] Click undo → Prospects restored

### T36.6: Dashboard UX Improvements (Sprint 35 Review Fixes) [S - 1.5h]
**Goal:** Address gaps identified in Sprint 35 review.
**Files:**
- `src/App.tsx` - Dashboard and hitlist sections
- `src/hooks/useDateRange.ts` (new) - Shared date range logic
**Dependencies:** Sprint 35 complete
**Changes:**
1. Extract shared `useDateRange` hook from duplicate date calculation logic
2. Add Escape key handler to close export dropdown (accessibility)
3. Add empty state for hitlist date filter when 0 results match
4. Replace magic numbers (0.8, 25%) with constants
**Tests:**
- Unit: `src/__tests__/hooks/useDateRange.test.ts`
**Validation:**
- [ ] useDateRange hook works for dashboard and hitlist
- [ ] Press Escape closes export dropdown
- [ ] 0 results shows "No prospects in date range" message
- [ ] No magic numbers in KPI calculations

### T36.7: Export Download Verification Tests [XS - 30m]
**Goal:** Add proper E2E tests that verify downloads complete.
**Files:**
- `e2e/dashboard.spec.ts` - Add download verification tests
**Dependencies:** Sprint 35 complete
**Changes:**
1. Add PNG export download test with file verification
2. Add PDF export download test with file verification
3. Verify downloaded file size > 0
**Tests:**
- E2E: Download verification
**Validation:**
- [ ] PNG download test waits for download event
- [ ] PDF download test waits for download event
- [ ] File names match expected format

### T36.8: Aggregator Error Handling Tests [XS - 30m]
**Goal:** Add tests for aggregator failure scenarios.
**Files:**
- `src/__tests__/hooks/useDashboardData.test.ts`
**Dependencies:** Sprint 35 complete
**Changes:**
1. Add test for aggregator throwing error
2. Verify error state is set properly
3. Verify UI doesn't crash on error
**Tests:**
- Unit: Error handling
**Validation:**
- [ ] Aggregator error sets error state
- [ ] Dashboard shows error message
- [ ] Retry button available

### T36.9: Sprint 36 E2E Validation [S - 1h]
**Goal:** All bulk E2E tests pass.
**Files:**
- `e2e/bulk.spec.ts`
**Dependencies:** T36.0 through T36.5
**Validation:**
- [ ] All checkbox selection tests pass
- [ ] All bulk action tests pass
- [ ] `npm run test:e2e -- bulk.spec.ts` passes

---

## Sprint 37: Search & Filters UI
**Goal:** Wire SearchIndexService for fuzzy search, add SavedFilters UI.
**Demo:** Type partial name → Fuzzy matches appear. Save filter → Available in dropdown.
**Validation:** E2E tests pass for search.spec.ts

### T37.1: Wire SearchIndexService for Fuzzy Search [M - 2h]
**Goal:** Replace basic string filter with fuzzy search.
**Files:**
- `src/App.tsx` - Search input
- Wire to `src/services/SearchIndexService.ts`
**Dependencies:** None
**Changes:**
1. Initialize SearchIndexService with prospects on mount
2. On input → Call search(query)
3. Show fuzzy matches with highlight
4. Search across name, company, title, notes
5. Debounce search for performance
**Tests:**
- E2E: Fuzzy search works
**Validation:**
- [ ] Type "jhn" → Matches "John"
- [ ] Type company name → Shows matches
- [ ] Search is fast (< 50ms for 1000 prospects)
- [ ] Highlights matched text

### T37.2: Add Advanced Filter Panel with Saved Filters [M - 4h]
**Goal:** Multi-field filtering UI using FilterBuilderService, with save/load.
**Files:**
- `src/components/AdvancedFilterPanel.tsx` (new)
- `src/components/SavedFiltersDropdown.tsx` (new)
- Wire to `src/services/FilterBuilderService.ts`
- Wire to `src/services/SavedFiltersService.ts`
**Dependencies:** None
**Changes:**
1. Create filter panel (collapsible sidebar)
2. Add filter conditions: field, operator, value
3. Support AND/OR grouping
4. Preview match count
5. Clear all filters button
6. "Save current filter" button with name prompt
7. Saved filters dropdown to load presets
8. Delete saved filter option
**Interface:**
```tsx
<AdvancedFilterPanel
  fields={['status', 'tier', 'company', 'lastActivity', 'tags']}
  onFilterChange={(filter) => {...}}
  matchCount={filteredCount}
  onSave={(name) => {...}}
  savedFilters={filters}
  onLoadFilter={(filter) => {...}}
  onDeleteFilter={(id) => {...}}
/>
```
**Tests:**
- Unit: FilterBuilderService tests (exist)
- Unit: SavedFiltersService tests (exist)
- E2E: Filter panel works, save/load filters
**Validation:**
- [ ] Click "Filters" → Panel opens
- [ ] Add condition "Tier = Tier 1" → List updates
- [ ] Add second condition with AND → Further filters
- [ ] Clear removes all filters
- [ ] Save filter → Appears in dropdown
- [ ] Click saved filter → Applied
- [ ] Delete removes from list

### T37.3: Add Keyboard Shortcuts for Search [S - 1h]
**Goal:** Wire KeyboardNavigationService for search shortcuts.
**Files:**
- Wire to `src/services/KeyboardNavigationService.ts`
**Dependencies:** T37.1
**Changes:**
1. "/" focuses search input
2. Escape clears search and blurs
3. Arrow keys navigate results
4. Enter selects highlighted
**Tests:**
- E2E: Keyboard shortcuts work
**Validation:**
- [ ] Press "/" → Search focused
- [ ] Escape → Search cleared
- [ ] Up/Down → Navigate list
- [ ] Enter → Select prospect

### T37.4: Sprint 37 E2E Validation [S - 1h]
**Files:**
- `e2e/search.spec.ts`
**Dependencies:** T37.1 through T37.3
**Validation:**
- [ ] Fuzzy search tests pass
- [ ] Filter tests pass
- [ ] Keyboard navigation tests pass
- [ ] `npm run test:e2e -- search.spec.ts` passes

---

## Sprint 38: PDF Export & Reports UI
**Goal:** Add PDF export buttons, report generation UI.
**Demo:** Click "Export PDF" → Professional report downloads.
**Validation:** E2E tests pass for pdf-export.spec.ts

### T38.1: Add PDF Export Button to Prospect Detail [S - 1.5h]
**Goal:** Export single prospect summary as PDF.
**Files:**
- `src/App.tsx` - Prospect detail header
- Wire to `src/services/PDFReportService.ts`
**Dependencies:** None
**Changes:**
1. Add "Export PDF" button to prospect detail header
2. Generate prospect-summary template with current prospect data
3. Download PDF with prospect name in filename
**Tests:**
- E2E: PDF downloads for single prospect
**Validation:**
- [ ] Select prospect → "Export PDF" button visible
- [ ] Click → PDF downloads
- [ ] PDF contains prospect details (name, company, notes)

### T38.2: Add Report Templates Selector [S - 1h]
**Goal:** UI to choose from 6 report templates.
**Files:**
- `src/components/ReportTemplateSelector.tsx` (new)
**Dependencies:** None
**Changes:**
1. Create modal/dropdown with all templates from PDFReportService.getTemplates()
2. Show template name and description
3. Preview thumbnail or sample for each
4. Select template → Triggers generation
**Tests:**
- Unit: Component renders templates
**Validation:**
- [ ] Modal shows 6 templates
- [ ] Each has name and description
- [ ] Selecting one triggers callback

### T38.3: Add Batch PDF Generation [M - 2h]
**Goal:** Generate PDFs for multiple selected prospects.
**Files:**
- `src/components/BulkActionsToolbar.tsx` - Add PDF action
- Wire to PDFReportService.batchGenerate
**Dependencies:** T36.2 (BulkActionsToolbar), T38.2
**Changes:**
1. Add "Generate Reports" button to bulk actions toolbar
2. Click opens ReportTemplateSelector
3. Select template → Progress bar during generation
4. Download ZIP of PDFs
**Tests:**
- E2E: Batch export works
**Validation:**
- [ ] Select 5 prospects → "Generate Reports" in toolbar
- [ ] Select "Prospect Summary" type
- [ ] Progress shows 1/5, 2/5, etc.
- [ ] Downloads ZIP with 5 PDFs

### T38.4: Add ROI Report Export [S - 1h]
**Goal:** Export ROI calculator results as PDF.
**Files:**
- `src/components/ROITab.tsx`
- Wire to PDFReportService roi-report template
**Dependencies:** None
**Changes:**
1. Add "Export Report" button to ROI tab header
2. Generate roi-report template with calculator data
3. Include inputs and calculated values
**Tests:**
- E2E: ROI export works
**Validation:**
- [ ] Complete ROI calculation
- [ ] Click "Export Report"
- [ ] PDF downloads with ROI data

### T38.5: Sprint 38 E2E Validation [S - 1h]
**Files:**
- `e2e/pdf-export.spec.ts`
**Dependencies:** T38.1 through T38.4
**Validation:**
- [ ] All PDF export tests pass
- [ ] Downloads contain correct data
- [ ] `npm run test:e2e -- pdf-export.spec.ts` passes

---

## Sprint 39: Message Quality & AI Improvements
**Goal:** Add MessageQualityIndicator, improve AI generation UI.
**Demo:** Type message → Quality grade appears. AI suggestions inline.
**Validation:** Message quality shows accurate grades.

### T39.1: Wire MessageQualityIndicator to Composer [XS - 45m]
**Goal:** Show A-F grade as user types message.
**Files:**
- `src/App.tsx` - Message textarea area
- Import `src/components/MessageQualityIndicator.tsx` (already exists)
**Dependencies:** None
**Changes:**
1. Import MessageQualityIndicator component
2. Position next to character count below textarea
3. Wire to message state - update in real-time as user types
4. Show grade (A-F) with color coding
5. Hover shows breakdown tooltip
**Tests:**
- E2E: Quality indicator visible
**Validation:**
- [ ] Type message → Grade appears
- [ ] Good message → A/B grade (green)
- [ ] Bad message → D/F grade (red)
- [ ] Hover shows detailed breakdown

### T39.2: Add Quality Suggestions Panel [M - 2h]
**Goal:** Show actionable suggestions to improve message.
**Files:**
- `src/App.tsx` - Below message textarea
- Wire to `src/services/MessageQualityService.ts`
**Dependencies:** T39.1
**Changes:**
1. When grade is C or below, show suggestions panel
2. List top 3 improvements (from MessageQualityService)
3. One-click to apply suggestion (if applicable)
4. Dismiss individual suggestions
**Tests:**
- Unit: Suggestions generated correctly
**Validation:**
- [ ] Low grade → Suggestions panel appears below textarea
- [ ] Lists actionable suggestions
- [ ] Dismissing hides suggestion
- [ ] Grade updates after manual fix

### T39.3: Improve AI Generate UX [S - 1.5h]
**Goal:** Better loading state, error handling, retry for AI generation.
**Files:**
- `src/App.tsx` - AI generate button
**Dependencies:** None
**Changes:**
1. Show generating state with typing animation in textarea
2. Error toast with retry button
3. Cancel generation button (AbortController)
4. Disable textarea during generation
**Tests:**
- E2E: AI generation flow
**Validation:**
- [ ] Click generate → Loading animation in textarea
- [ ] Success → Message appears with smooth transition
- [ ] Error → Toast with retry button
- [ ] Can cancel during generation

### T39.4: Add Template Preview on Hover [S - 1h]
**Goal:** Preview template before generating.
**Files:**
- `src/App.tsx` - Template buttons
**Dependencies:** None
**Changes:**
1. Hover template button → Shows preview tooltip
2. Preview shows sample generated text with variables highlighted
3. Variables shown as {{name}}, {{company}}
4. Click still generates
**Tests:**
- E2E: Preview on hover
**Validation:**
- [ ] Hover template → Preview tooltip shows
- [ ] Preview shows sample text
- [ ] Variables are highlighted in blue
- [ ] Tooltip disappears on mouseout

### T39.5: Sprint 39 Validation [S - 1h]
**Dependencies:** T39.1 through T39.4
**Validation:**
- [ ] Quality indicator works for all message lengths
- [ ] AI generation is reliable
- [ ] Templates preview correctly
- [ ] No regressions in message composition flow

---

## Sprint 40: Import Wizard Improvements
**Goal:** Fix ImportWizard integration, add progress, error handling.
**Demo:** Import 100 LinkedIn contacts with duplicate detection.
**Validation:** E2E tests pass for linkedin-import.spec.ts

### T40.1: Wire ImportWizard Completely [M - 3h]
**Goal:** Import wizard modal works end-to-end.
**Files:**
- `src/App.tsx` - ImportWizard integration
- `src/components/ImportWizard.tsx` - Verify all steps work
**Dependencies:** None
**Changes:**
1. Verify ImportWizard renders in Import tab
2. Handle file upload step
3. Show column mapping step with auto-detection
4. Show duplicate detection step with review
5. Confirm import with preview
6. Close wizard and refresh prospect list on success
7. Add proper error handling for each step
**Tests:**
- E2E: `e2e/linkedin-import.spec.ts`
**Validation:**
- [ ] Click "Import CSV" → Wizard opens
- [ ] Upload file → Preview table shown
- [ ] Next → Column mapping with suggestions
- [ ] Next → Duplicates detected and shown
- [ ] Import → Success, prospects added to list
- [ ] Close → Back to Import tab

### T40.2: Add Import Progress Tracking [S - 1h]
**Goal:** Show progress bar during import.
**Files:**
- `src/components/ImportWizard.tsx`
**Dependencies:** T40.1
**Changes:**
1. Track import progress (X of Y processed)
2. Show progress bar with percentage
3. Show current item name being processed
4. Cancel button to abort import
**Tests:**
- E2E: Progress visible during large import
**Validation:**
- [ ] Large import (50+ rows) → Progress bar shows
- [ ] Progress updates as rows processed
- [ ] Can cancel mid-import
- [ ] Partial import saved if cancelled

### T40.3: Add Import Error Handling UI [S - 1h]
**Goal:** Handle and display import errors gracefully.
**Files:**
- `src/components/ImportWizard.tsx`
**Dependencies:** T40.1
**Changes:**
1. Catch CSV parse errors (malformed files)
2. Show row-level errors with line numbers
3. Option to skip bad rows and continue
4. Summary at end showing success/failed counts
**Tests:**
- E2E: Malformed CSV handled
**Validation:**
- [ ] Bad CSV → Error message explaining issue
- [ ] Partial bad rows → Shows which failed with reason
- [ ] Can complete import with only valid rows
- [ ] Summary shows "45 imported, 5 failed"

### T40.4: Add Import History Panel [S - 1h]
**Goal:** Show history of past imports.
**Files:**
- `src/App.tsx` - Import tab
- Wire to `src/services/ImportHistoryService.ts`
**Dependencies:** None
**Changes:**
1. Add import history section to Import tab
2. Show date, filename, count imported for each
3. Click to view import details (which prospects)
4. Option to undo recent import (soft delete)
**Tests:**
- Unit: ImportHistoryService tests
**Validation:**
- [ ] After import → Appears in history list
- [ ] History persists across sessions
- [ ] Click shows imported prospect names
- [ ] Undo removes imported prospects

### T40.5: Sprint 40 E2E Validation [S - 1h]
**Files:**
- `e2e/linkedin-import.spec.ts`
**Dependencies:** T40.1 through T40.4
**Validation:**
- [ ] All import tests pass
- [ ] Error cases handled gracefully
- [ ] `npm run test:e2e -- linkedin-import.spec.ts` passes

---

## Sprint 41: Accessibility & Polish
**Goal:** Ensure WCAG 2.1 AA compliance, keyboard navigation everywhere.
**Demo:** Complete flow using only keyboard. Screen reader tested.
**Validation:** E2E accessibility tests pass.

### T41.1: Audit Keyboard Navigation [M - 2h]
**Goal:** Every interactive element reachable by keyboard.
**Files:**
- All component files
**Changes:**
1. Add tabIndex where missing
2. Add onKeyDown handlers for Enter/Space
3. Focus visible indicators
4. Skip links
**Tests:**
- E2E: `e2e/accessibility.spec.ts`
**Validation:**
- [ ] Tab through entire app
- [ ] All buttons keyboard accessible
- [ ] Focus visible at all times
- [ ] Escape closes modals

### T41.2: Add ARIA Labels [M - 2h]
**Goal:** Screen reader can announce all elements.
**Files:**
- All component files
**Changes:**
1. aria-label on icon buttons
2. aria-describedby for complex widgets
3. role attributes for custom widgets
4. aria-live for dynamic content
**Tests:**
- axe-core accessibility scan
**Validation:**
- [ ] axe-core finds 0 critical errors
- [ ] Screen reader announces correctly
- [ ] Form errors announced

### T41.3: Add Loading Skeletons [S - 1.5h]
**Goal:** Show skeleton UI while loading.
**Files:**
- Create `src/components/Skeleton.tsx` if not exists
- Apply to all loading states
**Changes:**
1. Prospect list loading skeleton
2. Dashboard loading skeleton
3. Detail view loading skeleton
**Tests:**
- E2E: Skeleton visible during load
**Validation:**
- [ ] Initial load → Skeletons show
- [ ] Data loaded → Skeletons replaced
- [ ] No layout shift

### T41.4: Add Error Boundaries [S - 1h]
**Goal:** Errors in one widget don't crash entire app.
**Files:**
- `src/components/ErrorBoundary.tsx` (if not exists)
- Wrap all major sections
**Changes:**
1. Create ErrorBoundary component
2. Wrap Dashboard, Hitlist, Detail, etc.
3. Show friendly error message
4. Retry button
**Tests:**
- Unit: Error boundary catches errors
**Validation:**
- [ ] Component error → Shows error message
- [ ] Rest of app still works
- [ ] Retry reloads component

### T41.5: Sprint 41 E2E Validation [S - 1h]
**Files:**
- `e2e/accessibility.spec.ts`
**Validation:**
- [ ] All accessibility tests pass
- [ ] Keyboard navigation tests pass

---

## Sprint 42: Performance & Final Polish
**Goal:** Optimize performance, add final polish, production ready.
**Demo:** App loads in < 2s, smooth 60fps animations.
**Validation:** Lighthouse score > 90.

### T42.1: Add Virtualized Lists [M - 2h]
**Goal:** Prospect list handles 10,000+ items smoothly.
**Files:**
- `src/App.tsx` - Prospect list
- Consider react-window or react-virtual
**Changes:**
1. Install virtualization library
2. Replace prospect list with virtualized version
3. Maintain scroll position
4. Handle dynamic heights if needed
**Tests:**
- Performance: Render 10,000 items < 100ms
**Validation:**
- [ ] Load 10,000 prospects → No lag
- [ ] Scroll smoothly at 60fps
- [ ] Selection still works

### T42.2: Add Memoization [S - 1.5h]
**Goal:** Prevent unnecessary re-renders.
**Files:**
- Various components
**Changes:**
1. React.memo on list items
2. useMemo for expensive calculations
3. useCallback for handlers
4. Profile and verify improvements
**Tests:**
- React DevTools profiler
**Validation:**
- [ ] Typing in search → Only search rerenders
- [ ] Select prospect → List doesn't rerender
- [ ] DevTools shows minimal renders

### T42.3: Add Code Splitting [S - 1h]
**Goal:** Lazy load non-critical components.
**Files:**
- `src/App.tsx`
**Changes:**
1. Lazy load ImportWizard (rarely used)
2. Lazy load PDFReportService
3. Lazy load charts (only in dashboard)
4. Add suspense fallbacks
**Tests:**
- Network: Initial bundle size reduced
**Validation:**
- [ ] Initial load < 200KB
- [ ] Charts load on dashboard visit
- [ ] Import wizard loads on click

### T42.4: Lighthouse Audit [S - 1h]
**Goal:** Fix issues found by Lighthouse.
**Files:**
- Various
**Changes:**
1. Run Lighthouse audit
2. Fix performance issues
3. Fix accessibility issues
4. Fix best practices issues
**Tests:**
- Lighthouse score
**Validation:**
- [ ] Performance > 90
- [ ] Accessibility > 90
- [ ] Best Practices > 90
- [ ] SEO > 90

### T42.5: Final E2E Test Suite [M - 2h]
**Goal:** All E2E tests pass, full coverage.
**Files:**
- All e2e/*.spec.ts
**Validation:**
- [ ] `npm run test:e2e` passes 100%
- [ ] All 10+ spec files pass
- [ ] No flaky tests

---

## Summary Table

| Sprint | Name | Tasks | Hours | Focus Area |
|--------|------|-------|-------|------------|
| **34** | Critical UI Wiring | 7 | ~10h | HubSpot OAuth, CommandPalette, Sync, Offline, Presence |
| **35** | Dashboard Wire-Up | 6 | ~10.5h | AnalyticsAggregator, DashboardLayout, Export, Charts |
| **36** | Bulk Operations UI | 7 | ~11.5h | Selection State, Checkboxes, Toolbar, Actions, Export |
| **37** | Search & Filters UI | 4 | ~8h | Fuzzy search, Advanced filters + Saved filters, Keyboard |
| **38** | PDF Export UI | 5 | ~6.5h | Single PDF, Templates, Batch, ROI export |
| **39** | Message Quality | 5 | ~6.25h | Quality indicator, Suggestions, AI UX, Preview |
| **40** | Import Wizard | 5 | ~7h | Full flow, Progress, Errors, History |
| **41** | Accessibility | 5 | ~8h | Keyboard, ARIA, Skeletons, Error boundaries |
| **42** | Performance | 5 | ~8h | Virtualization, Memoization, Code split, Lighthouse |

**Total: 9 Sprints, 49 Tasks, ~75-85 hours**

---

## Dependency Graph

```
Sprint 34 (Foundation)
├── T34.0: data-testid audit
├── T34.1a: useHubSpot hook
│   └── T34.1b: OAuth callback (depends on T34.1a)
├── T34.2: CommandPalette
├── T34.3: useOfflineQueue + Sync/Offline
├── T34.4: PresenceIndicator
├── T34.5: integrations.spec.ts (depends on T34.1b)
└── T34.6: E2E validation (depends on all above)

Sprint 35 (Dashboard)
├── T35.0: AnalyticsAggregator wiring
├── T35.1: DashboardLayout refactor (depends on T35.0)
├── T35.2: DashboardExporter (depends on T35.1)
├── T35.3: Chart components (depends on T35.0, T35.1)
├── T35.4: DateRangePicker in Hitlist
└── T35.5: E2E validation (depends on all above)

Sprint 36 (Bulk Operations)
├── T36.0: Selection state
├── T36.1: Checkboxes (depends on T36.0)
├── T36.2: BulkActionsToolbar (depends on T36.0, T36.1)
├── T36.3: BulkActionService wiring (depends on T36.2)
├── T36.4: BulkExporter wiring (depends on T36.2)
├── T36.5: BulkDeleteService wiring (depends on T36.2)
└── T36.6: E2E validation (depends on all above)

Sprint 37 (Search)
├── T37.1: SearchIndexService
├── T37.2: AdvancedFilterPanel + SavedFilters
├── T37.3: Keyboard shortcuts (depends on T37.1)
└── T37.4: E2E validation (depends on all above)

Sprint 38 (PDF) - depends on Sprint 36 for T38.3
├── T38.1: Single PDF export
├── T38.2: ReportTemplateSelector
├── T38.3: Batch PDF (depends on T36.2, T38.2)
├── T38.4: ROI export
└── T38.5: E2E validation (depends on all above)

Sprint 39 (Message Quality)
├── T39.1: MessageQualityIndicator
├── T39.2: Suggestions panel (depends on T39.1)
├── T39.3: AI generate UX
├── T39.4: Template preview
└── T39.5: Validation (depends on all above)

Sprint 40 (Import)
├── T40.1: ImportWizard full wiring
├── T40.2: Progress tracking (depends on T40.1)
├── T40.3: Error handling UI (depends on T40.1)
├── T40.4: Import history
└── T40.5: E2E validation (depends on all above)

Sprint 41 (Accessibility) - can run parallel to 39-40
├── T41.1: Keyboard navigation audit
├── T41.2: ARIA labels
├── T41.3: Loading skeletons
├── T41.4: Error boundaries
└── T41.5: E2E validation (depends on all above)

Sprint 42 (Performance) - final sprint
├── T42.1: Virtualized lists
├── T42.2: Memoization
├── T42.3: Code splitting
├── T42.4: Lighthouse audit
└── T42.5: Final E2E suite (depends on all above)
```

---

## Definition of Done (All Tasks)
- [ ] Code compiles without TypeScript errors
- [ ] Unit tests written and passing (≥80% coverage)
- [ ] E2E test covering happy path
- [ ] Feature works in browser (manual test)
- [ ] Accessible (keyboard navigable, screen reader friendly)
- [ ] Mobile responsive
- [ ] Committed with conventional commit message

## Definition of Done (All Sprints)
- [ ] All tasks complete
- [ ] E2E suite for sprint passes
- [ ] Demo recorded or live demo works
- [ ] Deployed to Vercel
- [ ] Sprint plan updated with status

---

## Quick Reference: Priority Order

1. **P1 - Sprint 34:** Fix broken integrations (HubSpot OAuth, CommandPalette, Sync/Offline)
2. **P1 - Sprint 36:** Bulk operations (E2E tests failing due to missing checkboxes)
3. **P2 - Sprint 35:** Dashboard completion (DashboardLayout, charts, export)
4. **P2 - Sprint 37:** Search improvements (fuzzy search, filters)
5. **P2 - Sprint 38:** PDF exports (single + batch)
6. **P3 - Sprint 39:** Message quality polish
7. **P3 - Sprint 40:** Import wizard polish
8. **P3 - Sprint 41:** Accessibility compliance (can parallelize with 39-40)
9. **P3 - Sprint 42:** Performance optimization (final sprint)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| HubSpot OAuth complexity | Medium | High | Split into T34.1a/b, test with mock OAuth server |
| E2E tests flaky | Medium | Medium | Add data-testid audit (T34.0), increase timeouts |
| Chart library issues | Low | Medium | Charts already built, just wiring |
| PDF generation slow | Medium | Low | Add progress UI, consider web workers |
| Accessibility audit findings | High | Medium | Budget extra time for T41.1/T41.2 |

---

## Testing Strategy

### Unit Tests (Vitest)
- Each new hook: `src/__tests__/hooks/useXxx.test.ts`
- Each new component: `src/__tests__/components/Xxx.test.tsx`
- Mock all services using existing mock patterns

### E2E Tests (Playwright)
- Sprint 34: `navigation.spec.ts`, `offline.spec.ts`, `integrations.spec.ts`
- Sprint 35: `dashboard.spec.ts`
- Sprint 36: `bulk.spec.ts`
- Sprint 37: `search.spec.ts`
- Sprint 38: `pdf-export.spec.ts`
- Sprint 40: `linkedin-import.spec.ts`
- Sprint 41: `accessibility.spec.ts`
- Sprint 42: `performance.spec.ts`

### Manual Testing Checklist (Each Sprint)
- [ ] Desktop Chrome
- [ ] Mobile Safari (responsive)
- [ ] Keyboard-only navigation
- [ ] Offline mode (devtools)
- [ ] Screen reader (VoiceOver)

---

## Commit Message Convention

```
feat(sprint-XX): T[task#] - [description]

- Bullet points of changes
- Files modified

Closes #issue-number
```

Examples:
```
feat(sprint-34): T34.1a - Create useHubSpot hook with OAuth initiation

- Add src/hooks/useHubSpot.ts with connect/disconnect
- Handle popup blocker fallback to redirect
- Add unit tests for hook state management

feat(sprint-36): T36.2 - Add BulkActionsToolbar component

- Create src/components/BulkActionsToolbar.tsx
- Add 5 action buttons with icons
- Wire to App.tsx when selection > 0
- Add data-testid for E2E tests
```

---

# Phase 3: Email Outreach & Account-Based Marketing (Sprints 43-48)

## Current State Analysis

### ✅ What Exists (Built & Tested)
| Component | Status | Location |
|-----------|--------|----------|
| HubSpot OAuth Backend | ✅ Complete | `HubSpotAuthService.ts` |
| HubSpot API Client | ✅ Complete | `HubSpotClient.ts` with rate limiting |
| HubSpot Sync Engine | ✅ Complete | `HubSpotSyncEngine.ts` bi-directional |
| Email Sequence Builder | ✅ Complete | `EmailSequenceService.ts` (746 lines) |
| Pre-built Email Templates | ✅ Complete | Ops Director, CFO sequences |
| AI Message Generation | ✅ Complete | `GeminiService.ts`, `TemplateGenerator.ts` |
| 5,409 Prospect Data | ✅ Complete | `hitlistData.ts` with tiers |
| Template Variables | ✅ Complete | {{firstName}}, {{company}}, {{trailerCount}} |

### ⚠️ Partially Complete (Needs Wiring)
| Component | Status | Gap |
|-----------|--------|-----|
| HubSpot UI Connect | ⚠️ Incomplete | OAuth button uses fake handler |
| Sequence Builder UI | ⚠️ Incomplete | Service exists, no UI |
| Bulk Email Selection | ⚠️ Incomplete | Checkboxes exist, no "Email Selected" action |

### ❌ Not Present (Requires Backend)
| Capability | Required For |
|------------|--------------|
| SendGrid SDK Integration | Actual email sending |
| Vercel Edge Functions | Serverless email API |
| Email Queue System | Rate-limited sending |
| Open/Click Tracking | Analytics |
| Unsubscribe Handling | CAN-SPAM compliance |
| Reply Detection | Sequence pause automation |

---

## Sprint 43: Email Infrastructure (Vercel + SendGrid Backend)
**Goal:** Create serverless email sending infrastructure with SendGrid.
**Demo:** POST /api/email/send → Email delivered to inbox.
**Validation:** Unit tests pass, manual test email received.

### Task Dependency Graph
```
T43.1 (Types) ─────┬── T43.2 (SendGrid Client) ── T43.3 (Queue Service)
                   │                               │
T43.4 (Vercel API) ─────────────────────────────────── T43.5 (Tracking)
                                                        │
T43.6 (Tests) ───────────────────────────────────────────
```

### T43.1: Email Infrastructure Types [S - 1h]
**Goal:** Define TypeScript types for email infrastructure.
**Files:** 
- `src/types/email.ts` (new)
**Changes:**
```typescript
// Core email types
interface EmailMessage {
  id: string;
  to: { email: string; name?: string }[];
  cc?: { email: string; name?: string }[];
  bcc?: { email: string; name?: string }[];
  from: { email: string; name: string };
  replyTo?: { email: string; name?: string };
  subject: string;
  bodyHtml: string;
  bodyText: string;
  templateId?: string;
  variables?: Record<string, string>;
  trackOpens?: boolean;
  trackClicks?: boolean;
  scheduledAt?: string; // ISO date
  tags?: string[];
  prospectId?: string; // Link back to prospect
  sequenceId?: string; // Link to email sequence
  stepNumber?: number;
}

interface EmailQueueItem extends EmailMessage {
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'bounced';
  attempts: number;
  lastAttemptAt?: string;
  sentAt?: string;
  errorMessage?: string;
  sendgridMessageId?: string;
}

interface EmailEvent {
  type: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'spam' | 'unsubscribed';
  emailId: string;
  prospectId: string;
  timestamp: string;
  metadata?: { url?: string; userAgent?: string; ip?: string };
}

interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyToEmail?: string;
  trackingDomain?: string;
  unsubscribeUrl: string;
}

interface EmailStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}
```
**Tests:**
- Zod schema validates sample email objects
- Schema rejects missing required fields
- Stats calculation helpers work
**Validation:**
- [ ] Types compile without errors
- [ ] 5+ unit tests passing

### T43.2: SendGrid Client Service [M - 3h]
**Goal:** Create SendGrid API wrapper with batch support.
**Files:**
- `src/services/SendGridClient.ts` (new)
- `src/__tests__/services/SendGridClient.test.ts` (new)
**Dependencies:** T43.1
**Interface:**
```typescript
interface SendGridClient {
  // Single email
  sendEmail(email: EmailMessage): Promise<{ messageId: string }>;
  
  // Batch (max 1000 per call)
  sendBatch(emails: EmailMessage[]): Promise<{ 
    messageIds: string[];
    failed: Array<{ email: string; error: string }>;
  }>;
  
  // Template support
  sendWithTemplate(
    templateId: string, 
    recipients: Array<{ email: string; variables: Record<string, string> }>
  ): Promise<{ messageIds: string[] }>;
  
  // Status
  getMessageStatus(messageId: string): Promise<EmailEvent[]>;
  
  // Suppression list management
  addToSuppressionList(email: string, reason: 'unsubscribe' | 'bounce'): Promise<void>;
  checkSuppressed(email: string): Promise<boolean>;
}
```
**Implementation Details:**
1. Use `@sendgrid/mail` SDK
2. Rate limit: 10 emails/second (SendGrid API limit of 600 requests/minute)
3. Batch API for bulk sends (up to 1000 per call)
4. Automatic retry on 429/5xx with exponential backoff
5. Suppression list check before sending
6. Error categorization (transient vs permanent)
7. Mock mode for development (no actual sends)
**Tests:**
- Mock SendGrid API responses
- Verify rate limiting works
- Verify batch splitting for >1000 emails
- Verify suppression list check
- Verify retry logic on transient errors
**Validation:**
- [ ] 10+ unit tests passing
- [ ] Mock mode works for development

### T43.3a: Email Queue Service [M - 4h]
**Goal:** Persistent queue for scheduled and rate-limited email sending.
**Files:**
- `src/services/EmailQueueService.ts` (new)
- `src/__tests__/services/EmailQueueService.test.ts` (new)
**Dependencies:** T43.1, T43.2
**Interface:**
```typescript
interface EmailQueueService {
  // Enqueue
  enqueue(email: EmailMessage): Promise<string>; // Returns queue ID
  enqueueBatch(emails: EmailMessage[]): Promise<string[]>;
  enqueueSequenceStep(
    prospectId: string, 
    sequenceId: string, 
    stepNumber: number,
    scheduledAt: Date
  ): Promise<string>;
  
  // Process
  processNext(): Promise<EmailQueueItem | null>;
  processBatch(limit?: number): Promise<{ processed: number; failed: number }>;
  
  // Status
  getQueueStats(): { pending: number; sending: number; failed: number };
  getItemStatus(queueId: string): Promise<EmailQueueItem | null>;
  
  // Retry
  retryFailed(): Promise<number>;
  
  // Cancel
  cancelScheduled(queueId: string): Promise<boolean>;
  cancelByProspect(prospectId: string): Promise<number>; // For sequence stops
}
```
**Storage:** Firestore collection `email_queue` with TTL
**Processing Logic:**
1. Query pending items where `scheduledAt <= now`
2. Update status to 'sending' with Firestore transaction (idempotent)
3. Call SendGridClient.sendEmail()
4. Update status to 'sent' or 'failed'
5. On failure: increment attempts, set exponential backoff delay
6. Max 3 retries for transient errors
7. Permanent failures (bounce) → add to suppression list
8. Dead letter queue for items that fail 3+ times
**Tests:**
- Queue item persists to Firestore (mocked)
- Scheduled items wait until scheduledAt
- Failed items retry with backoff
- Max retries honored
- Cancel removes from queue
- Idempotent processing (same item not double-sent)
**Validation:**
- [ ] 12+ unit tests passing
- [ ] Queue stats accurate

### T43.3b: Email Compliance Service [M - 2h] ⚠️ REQUIRED FOR CAN-SPAM
**Goal:** Ensure all emails meet CAN-SPAM and GDPR requirements.
**Files:**
- `src/services/EmailComplianceService.ts` (new)
- `src/__tests__/services/EmailComplianceService.test.ts` (new)
**Dependencies:** T43.1
**Interface:**
```typescript
interface EmailComplianceService {
  // Validate before sending
  validateEmail(email: EmailMessage): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  
  // Inject required elements
  injectComplianceElements(email: EmailMessage): EmailMessage;
  
  // Consent tracking
  recordConsent(email: string, source: 'import' | 'signup' | 'manual'): void;
  hasConsent(email: string): boolean;
  
  // GDPR right to be forgotten
  processGDPRDeletion(email: string): Promise<void>;
  
  // Suppression management
  addToSuppressionList(email: string, reason: 'unsubscribe' | 'bounce' | 'spam'): Promise<void>;
  isOnSuppressionList(email: string): Promise<boolean>;
}
```
**CAN-SPAM Requirements (Legal):**
1. Add `List-Unsubscribe` header to all emails (RFC 8058)
2. Add `List-Unsubscribe-Post` header for one-click unsubscribe (Gmail/Yahoo required as of Feb 2024)
3. Inject physical mailing address footer (required by law)
4. Clear "From" identification
5. Honest subject lines (no deception)
6. Process unsubscribe within 10 business days
**GDPR Requirements (EU Prospects):**
1. Record consent source for all contacts
2. Support right to access (export data)
3. Support right to deletion (remove all data)
4. Store consent timestamp
**Tests:**
- Email without unsubscribe link fails validation
- Physical address injected correctly
- Suppression list prevents sending
- GDPR deletion removes all prospect data
**Validation:**
- [ ] 8+ unit tests passing
- [ ] All outgoing emails include required headers
- [ ] Unsubscribe link works

### T43.4a: Vercel API Routes - Core Email Operations [M - 4h]
**Goal:** Create core serverless API endpoints for email sending.
**Files:**
- `api/email/send.ts` (new)
- `api/email/batch.ts` (new)
- `api/email/schedule.ts` (new)
- `api/email/cancel.ts` (new)
- `api/email/status.ts` (new)
**Dependencies:** T43.2, T43.3a, T43.3b
**Endpoints:**
```typescript
// POST /api/email/send
// Body: EmailMessage
// Response: { success: true, queueId: string, messageId?: string }

// POST /api/email/batch
// Body: { emails: EmailMessage[], maxPerRequest?: number }
// Response: { success: true, queueIds: string[], count: number }

// POST /api/email/schedule
// Body: { email: EmailMessage, scheduledAt: string }
// Response: { success: true, queueId: string }

// DELETE /api/email/cancel/:queueId
// Response: { success: true }

// GET /api/email/status/:queueId
// Response: EmailQueueItem
```
**Security:**
- All routes require Firebase ID token authentication
- Rate limiting: 100 requests/minute per user (use Vercel Edge Config)
- Request body validation with Zod schemas
- CORS restricted to known origins
**Tests:**
- Unit tests for each endpoint
- Auth rejection for unauthenticated requests
- Rate limiting works
**Validation:**
- [ ] 10+ tests passing
- [ ] Endpoints accessible in Vercel preview

### T43.4b: Vercel API Routes - Webhooks & Tracking [M - 3h]
**Goal:** Create webhook endpoints for SendGrid events and tracking.
**Files:**
- `api/email/webhook.ts` (new) - SendGrid event webhook
- `api/email/unsubscribe.ts` (new) - One-click unsubscribe
- `api/track/open.ts` (new) - Tracking pixel
- `api/track/click.ts` (new) - Link redirect
**Dependencies:** T43.3b, T43.5
**Endpoints:**
```typescript
// POST /api/email/webhook (SendGrid events)
// Headers: X-Twilio-Email-Event-Webhook-Signature
// Body: SendGrid event payload (array of events)
// Response: 200 OK

// GET/POST /api/email/unsubscribe?token=xxx
// GET: Shows confirmation page
// POST: Processes unsubscribe
// Response: HTML confirmation page
```
**Security (Critical):**
1. Validate SendGrid webhook signature using `X-Twilio-Email-Event-Webhook-Signature` header
2. Use constant-time string comparison (prevent timing attacks)
3. Store webhook signing key in Vercel environment variable `SENDGRID_WEBHOOK_SECRET`
4. Log and reject invalid webhook requests with 401
5. Rate limiting: 1000/minute (SendGrid may burst events)
6. Unsubscribe token is HMAC-signed with secret
7. Unsubscribe tokens expire after 30 days
**Webhook Event Types:**
- `delivered` → Update email status
- `open` → Record open event
- `click` → Record click event (URL in payload)
- `bounce` → Add to suppression list
- `spam` → Add to suppression list, pause sequences
- `unsubscribe` → Process unsubscribe
**Tests:**
- Valid signature accepted
- Invalid signature rejected (401)
- Events update correct records
- Bounce adds to suppression
**Validation:**
- [ ] 8+ tests passing
- [ ] Webhook signature validation works

### T43.5: Email Tracking Service [M - 3h]
**Goal:** Track opens, clicks, and engagement for analytics.
**Files:**
- `src/services/EmailTrackingService.ts` (new)
- `src/__tests__/services/EmailTrackingService.test.ts` (new)
**Dependencies:** T43.1
**Implementation:**
1. **Open Tracking:** Inject 1x1 tracking pixel with signed token
2. **Click Tracking:** Rewrite links to go through `/api/track/click?url=X&token=Y`
3. **Event Storage:** Firestore collection `email_events`
4. **Deduplication:** Only count first open/click per email
**Privacy Considerations:**
1. Anonymize IP addresses (zero last octet for privacy)
2. Add tracking disclosure to email footer
3. 90-day retention policy for tracking data
4. No personally identifiable info in tracking tokens
**Interface:**
```typescript
interface EmailTrackingService {
  // Inject tracking into email
  injectTracking(email: EmailMessage): EmailMessage;
  
  // Record events
  recordOpen(emailId: string, metadata?: Record<string, unknown>): Promise<void>;
  recordClick(emailId: string, url: string, metadata?: Record<string, unknown>): Promise<void>;
  
  // Query
  getEmailEvents(emailId: string): Promise<EmailEvent[]>;
  getProspectEngagement(prospectId: string): Promise<{
    totalOpens: number;
    totalClicks: number;
    lastEngagement?: Date;
    engagedEmails: string[];
  }>;
  
  // Stats
  getCampaignStats(campaignId: string): Promise<EmailStats>;
}
```
**Tests:**
- Tracking pixel injected into HTML body
- Links rewritten with tracking parameters
- Open recorded on pixel request
- Click redirects to original URL
- Duplicate opens not counted
**Validation:**
- [ ] 10+ tests passing
- [ ] Tracking pixel returns 1x1 GIF

### T43.6: Sprint 43 Integration Tests [S - 2h]
**Goal:** End-to-end validation of email infrastructure.
**Files:**
- `src/__tests__/integration/email.test.ts` (new)
**Dependencies:** T43.1-T43.5
**Tests:**
1. Full flow: enqueue → process → send (mocked SendGrid)
2. Batch processing respects rate limits
3. Scheduled email waits for time
4. Webhook updates email status
5. Tracking events recorded
6. Suppression list prevents sending
7. Unsubscribe flow works
**Validation:**
- [ ] All integration tests pass
- [ ] `npm test -- email` shows green
- [ ] Manual test: send email to personal inbox

### T43.7: Email Domain Warmup Strategy [S - 1h] ⚠️ REQUIRED FOR DELIVERABILITY
**Goal:** Define warmup schedule to avoid spam filters on new sending domain.
**Files:**
- `docs/EMAIL_WARMUP_PLAN.md` (new)
- `src/services/EmailWarmupService.ts` (new)
**Dependencies:** T43.3a
**Deliverable:** Document and service with:
1. **Warmup Schedule:**
   - Week 1: 20 emails/day
   - Week 2: 50 emails/day
   - Week 3: 100 emails/day
   - Week 4: 250 emails/day
   - Week 5+: Full capacity
2. **Domain Authentication (Pre-requisites):**
   - SPF record configured
   - DKIM signing enabled
   - DMARC policy set (p=none initially)
3. **Automated Throttling:**
   - Track daily send count
   - Enforce warmup limits automatically
   - Alert if bounce rate > 5%
   - Auto-pause if spam rate > 0.1%
**Interface:**
```typescript
interface EmailWarmupService {
  getDailyLimit(): number;
  getRemainingToday(): number;
  canSendNow(): boolean;
  recordSent(): void;
  getWarmupStage(): 'warming' | 'ready';
  getHealthStatus(): {
    bounceRate: number;
    spamRate: number;
    isHealthy: boolean;
  };
}
```
**Tests:**
- Daily limit enforced correctly
- Warmup stage advances after time
- Unhealthy metrics pause sending
**Validation:**
- [ ] Warmup limits prevent over-sending
- [ ] Documentation complete

---

## Sprint 43 Summary
**Effort:** 22h total (was 18h)
**Tasks:** T43.1, T43.2, T43.3a, T43.3b, T43.4a, T43.4b, T43.5, T43.6, T43.7
**Deliverable:** Complete email sending infrastructure with compliance

---

## Sprint 44: Account-Based Email Campaigns
**Goal:** Send persona-based emails at scale with company grouping.
**Demo:** Select 50 prospects → Generate personalized emails → Preview → Send as batch.
**Validation:** Emails sent with personalization, appears in HubSpot activity.

### Task Dependency Graph
```
T44.1 (Campaign Types) ─── T44.2 (Campaign Service) ─── T44.3 (Persona Engine)
                                    │
T44.4 (Campaign Builder UI) ─────────── T44.5 (Preview/Send UI)
                                    │
T44.6 (HubSpot Activity Integration) ───── T44.7 (Tests)
```

### T44.1: Account-Based Campaign Types [S - 1h]
**Goal:** Define types for account-based marketing campaigns.
**Files:**
- `src/types/campaign.ts` (new)
**Changes:**
```typescript
type PersonaType = 'ops_director' | 'exec' | 'cfo' | 'procurement' | 'it' | 'generic';

interface Campaign {
  id: string;
  name: string;
  type: 'account_based' | 'persona_burst' | 'single_send';
  status: 'draft' | 'scheduled' | 'sending' | 'paused' | 'completed';
  
  // Targeting
  targetAccounts: string[]; // Company names or IDs
  targetPersonas: PersonaType[];
  tierFilter?: ('Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4')[];
  
  // Content
  sequenceId?: string; // Use existing sequence
  customEmail?: {
    subject: string;
    bodyHtml: string;
    bodyText: string;
  };
  personalization: {
    useAI: boolean;
    includeROI: boolean;
    includeCalendly: boolean;
    calendlyLink?: string;
  };
  
  // Scheduling
  sendWindow?: {
    startHour: number; // 9 = 9am
    endHour: number; // 17 = 5pm
    timezone: string;
    skipWeekends: boolean;
  };
  throttle?: {
    maxPerHour: number;
    maxPerDay: number;
  };
  
  // Stats
  stats: {
    total: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    unsubscribed: number;
  };
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
  completedAt?: string;
}

interface CampaignProspect {
  prospectId: string;
  email: string;
  persona: PersonaType;
  company: string;
  tier: string;
  personalization: Record<string, string>;
  emailContent?: {
    subject: string;
    body: string;
  };
  status: 'pending' | 'personalized' | 'sent' | 'failed';
}
```
**Tests:**
- Zod schema validates campaign objects
- Persona type inference works
**Validation:**
- [ ] Types compile without errors
- [ ] 3+ tests passing

### T44.2a: Campaign Service - CRUD & Storage [M - 2h]
**Goal:** Create and persist campaign objects with targeting metadata.
**Files:**
- `src/services/CampaignService.ts` (new)
- `src/__tests__/services/CampaignService.test.ts` (new)
**Dependencies:** T43.3a, T44.1
**Interface (CRUD + Targeting only):**
```typescript
interface CampaignService {
  createCampaign(config: Partial<Campaign>): Campaign;
  updateCampaign(id: string, updates: Partial<Campaign>): Campaign;
  deleteCampaign(id: string): void;
  getCampaign(id: string): Campaign | null;
  listCampaigns(filter?: { status?: Campaign['status'] }): Campaign[];
  
  addProspects(campaignId: string, prospectIds: string[]): void;
  removeProspects(campaignId: string, prospectIds: string[]): void;
  getProspects(campaignId: string): CampaignProspect[];
  previewCount(filter: Campaign['tierFilter'], personas: PersonaType[]): number;
}
```
**Implementation Details:**
1. Campaigns stored in Firestore `campaigns` collection
2. Prospect list stored in `campaign_prospects` subcollection
3. Indexes for `status`, `createdAt`, `scheduledAt`
**Tests:**
- Campaign CRUD works
- Prospect add/remove works
- Preview count respects tier/persona filters
**Validation:**
- [ ] 8+ unit tests passing
- [ ] Manual campaign creation works

### T44.2b: Campaign Service - Execution & Stats [M - 3h]
**Goal:** Execute campaigns and track performance metrics.
**Files:**
- `src/services/CampaignService.ts`
- `src/__tests__/services/CampaignServiceExecution.test.ts` (new)
**Dependencies:** T43.3a, T43.5, T44.2a
**Interface (Execution + Stats):**
```typescript
interface CampaignService {
  generatePersonalization(campaignId: string): Promise<void>;
  previewEmail(campaignId: string, prospectId: string): EmailMessage;
  scheduleCampaign(id: string, scheduledAt: Date): void;
  startCampaign(id: string): Promise<void>;
  pauseCampaign(id: string): void;
  resumeCampaign(id: string): Promise<void>;
  getCampaignStats(id: string): Campaign['stats'];
  getDetailedStats(id: string): {
    byPersona: Record<PersonaType, EmailStats>;
    byTier: Record<string, EmailStats>;
    byCompany: Record<string, EmailStats>;
    timeline: Array<{ date: string; sent: number; opened: number }>;
  };
}
```
**Implementation Details:**
1. AI personalization batched (10 prospects at a time)
2. Execution uses EmailQueueService for rate limiting
3. Stats updated in real-time via webhook events
**Tests:**
- Personalization generates unique content
- Throttling respected
- Stats calculated correctly
**Validation:**
- [ ] 10+ unit tests passing

### T44.3: Persona Detection & Personalization Engine [M - 4h]
**Goal:** Auto-detect persona from title, generate persona-specific content.
**Files:**
- `src/services/PersonaEngine.ts` (new)
- `src/__tests__/services/PersonaEngine.test.ts` (new)
**Dependencies:** T44.1
**Interface:**
```typescript
interface PersonaEngine {
  // Detection
  detectPersona(title: string, company?: string): PersonaType;
  
  // Template selection
  getTemplateForPersona(persona: PersonaType): {
    subject: string;
    body: string;
    toneGuide: string;
    painPoints: string[];
    ctaStyle: 'soft' | 'direct' | 'value_first';
  };
  
  // Personalization
  personalizeMessage(
    template: string,
    prospect: Prospect,
    options?: {
      includeROI?: boolean;
      includeCalendly?: boolean;
      calendlyLink?: string;
      companyStats?: { trailerCount?: number; revenue?: string };
    }
  ): string;
  
  // AI Enhancement
  enhanceWithAI(
    message: string,
    prospect: Prospect,
    persona: PersonaType
  ): Promise<string>;
}
```
**Persona Detection Rules:**
```typescript
const PERSONA_KEYWORDS: Record<PersonaType, string[]> = {
  ops_director: ['operations', 'ops', 'logistics', 'supply chain', 'warehouse', 'distribution', 'fleet', 'yard'],
  exec: ['ceo', 'president', 'chief', 'vp', 'vice president', 'founder', 'owner', 'partner'],
  cfo: ['cfo', 'finance', 'controller', 'treasurer', 'accounting'],
  procurement: ['procurement', 'purchasing', 'sourcing', 'buyer', 'vendor'],
  it: ['cto', 'cio', 'technology', 'it ', 'information technology', 'systems', 'developer', 'engineer'],
  generic: [], // Fallback
};
```
**Variable Substitution:**
- `{{firstName}}` → First name from prospect.name
- `{{company}}` → prospect.company
- `{{title}}` → prospect.title
- `{{trailerCount}}` → Company trailer count (if known)
- `{{calendlyLink}}` → Jake's Calendly URL
- `{{roiStat}}` → Persona-specific ROI stat
**Tests:**
- Persona detection accuracy > 90%
- Variable substitution complete
- AI enhancement improves message
**Validation:**
- [ ] 15+ tests passing
- [ ] All personas have templates

### T44.4: Campaign Builder UI [L - 5h]
**Goal:** UI to create and configure email campaigns.
**Files:**
- `src/components/CampaignBuilder.tsx` (new)
- `src/components/CampaignList.tsx` (new)
- `src/components/CampaignCard.tsx` (new)
- Add "Campaigns" tab to App.tsx
**Dependencies:** T44.2, T44.3
**UI Components:**
1. **Campaign List View:**
   - Cards showing campaign name, status, stats
   - Filter by status (draft, scheduled, completed)
   - Click to edit/view details
2. **Campaign Builder Steps:**
   - Step 1: Name & Type (account-based, persona burst, single send)
   - Step 2: Select Targets (tier filter, persona checkboxes, or manual select)
   - Step 3: Content (choose sequence or custom email, AI toggle)
   - Step 4: Personalization (preview 5 random prospects)
   - Step 5: Schedule & Throttle (send now, schedule, send window)
   - Step 6: Review & Launch
3. **Progress Indicators:**
   - Show target count at each step
   - Validation errors inline
   - "Test send to myself" button
**Tests:**
- E2E: Create campaign flow
- Unit: Step navigation
**Validation:**
- [ ] Campaign wizard completes
- [ ] Campaign appears in list

### T44.5: Campaign Preview & Send UI [M - 3h]
**Goal:** Preview personalized emails before sending, batch send with progress.
**Files:**
- `src/components/CampaignPreview.tsx` (new)
- `src/components/CampaignSendProgress.tsx` (new)
**Dependencies:** T44.4
**Features:**
1. **Preview Grid:**
   - Show 10 preview emails (randomized from targets)
   - Click to see full email content
   - Refresh to see different prospects
   - AI regenerate button per email
2. **Send Progress:**
   - Progress bar with percentage
   - Real-time sent/failed counters
   - Pause button
   - View sent emails in expandable list
   - Error log for failed sends
3. **Completion Summary:**
   - Total sent, delivered, failed
   - Link to campaign stats
   - "View in HubSpot" button
**Tests:**
- E2E: Preview shows personalized content
- E2E: Send progress updates
**Validation:**
- [ ] Preview shows unique content per prospect
- [ ] Progress bar animates during send
- [ ] Completion summary accurate

### T44.6: HubSpot Email Activity Integration [M - 3h]
**Goal:** Log sent emails as activities in HubSpot.
**Files:**
- `src/services/HubSpotEmailSync.ts` (new)
- `src/__tests__/services/HubSpotEmailSync.test.ts` (new)
**Dependencies:** T43.2, T44.2, existing HubSpotActivityLogger.ts
**Implementation:**
1. After email sent successfully, call HubSpot Engagements API
2. Create EMAIL engagement on contact
3. Include subject, body preview, sent timestamp
4. Link to deal if exists
5. Add metadata (campaign name, sequence step)
6. Handle rate limiting (queue if needed)
**Interface:**
```typescript
interface HubSpotEmailSync {
  logEmailSent(
    hubspotContactId: string,
    email: EmailMessage,
    campaignId?: string
  ): Promise<string>; // Returns engagement ID
  
  logEmailOpened(hubspotContactId: string, engagementId: string): Promise<void>;
  logEmailClicked(hubspotContactId: string, engagementId: string, url: string): Promise<void>;
  logEmailReplied(hubspotContactId: string, engagementId: string): Promise<void>;
}
```
**Tests:**
- Email logged creates HubSpot engagement
- Activity visible in contact timeline (manual verification)
**Validation:**
- [ ] 6+ tests passing
- [ ] Engagement appears in HubSpot

### T44.7: Sprint 44 E2E Validation [S - 2h]
**Goal:** Full campaign creation and send flow works.
**Files:**
- `e2e/campaigns.spec.ts` (new)
**Dependencies:** T44.1-T44.6
**Tests:**
1. Create campaign with tier filter
2. Add persona-based targeting
3. Preview personalized emails
4. Start campaign
5. Verify progress UI
6. Check completion stats
7. Verify HubSpot activity (mock)
**Validation:**
- [ ] All E2E tests pass
- [ ] `npm run test:e2e -- campaigns.spec.ts` green

---

## Sprint 45: Email Sequences & Automation
**Goal:** Execute multi-step email sequences with smart pausing.
**Demo:** Enroll 10 prospects in 4-step sequence → Emails sent over 2 weeks with auto-pause on reply.
**Validation:** Sequence execution works, replies detected, HubSpot updated.

### T45.1a: Sequence Executor - Enrollment & Scheduling [M - 3h]
**Goal:** Enroll prospects and schedule sequence steps.
**Files:**
- `src/services/SequenceExecutor.ts` (new)
- `src/__tests__/services/SequenceExecutorEnrollment.test.ts` (new)
**Dependencies:** T43.3a, existing EmailSequenceService.ts
**Interface (Enrollment):**
```typescript
interface SequenceExecutor {
  enrollProspect(
    prospectId: string, 
    sequenceId: string,
    options?: { startAt?: Date; skipSteps?: number[] }
  ): Promise<string>;
  enrollBatch(
    prospectIds: string[],
    sequenceId: string,
    options?: { staggerMinutes?: number }
  ): Promise<string[]>;
  getEnrollmentStatus(enrollmentId: string): SequenceEnrollment;
  getProspectEnrollments(prospectId: string): SequenceEnrollment[];
  getSequenceEnrollments(sequenceId: string): SequenceEnrollment[];
  unenrollProspect(prospectId: string, sequenceId: string): void;
  unenrollAll(prospectId: string): void;
}
```
**Scheduling Logic:**
1. Calculate nextStepAt based on step delays and timezone
2. Store in Firestore `sequence_enrollments` collection
3. Validate skipSteps and prevent invalid indices
**Tests:**
- Enrollment creates correct schedule
- Batch enroll staggers steps correctly
- Unenroll removes pending steps
**Validation:**
- [ ] 8+ tests passing

### T45.1b: Sequence Executor - Execution & Pause Logic [M - 3h]
**Goal:** Execute scheduled steps and handle pause/resume.
**Files:**
- `src/services/SequenceExecutor.ts`
- `src/__tests__/services/SequenceExecutorExecution.test.ts` (new)
**Dependencies:** T45.1a, T43.3a
**Interface (Execution):**
```typescript
interface SequenceExecutor {
  processScheduledSteps(): Promise<{ processed: number; skipped: number }>;
  pauseEnrollment(enrollmentId: string, reason: 'reply' | 'meeting' | 'manual'): void;
  resumeEnrollment(enrollmentId: string): void;
  pauseByProspect(prospectId: string): void;
}
```
**Execution Logic:**
1. Query enrollments where `nextStepAt <= now` and status = 'active'
2. For each: generate email, enqueue via EmailQueueService
3. Update enrollment with next step
4. Check pause conditions before each step
**Pause Triggers:**
- Reply detected (via webhook or HubSpot sync)
- Meeting booked (Calendly webhook or manual status)
- Manual pause from UI
- Prospect unsubscribed
**Tests:**
- Steps execute at correct times
- Pause on reply works
- Resume continues from paused step
**Validation:**
- [ ] 10+ tests passing

### T45.2: Reply Detection Integration [M - 4h]
**Goal:** Detect email replies and auto-pause sequences.
**Files:**
- `src/services/ReplyDetectionService.ts` (new)
- `api/webhook/email-reply.ts` (new) - Inbound email webhook
**Dependencies:** T45.1
**Options for Reply Detection:**
1. **SendGrid Inbound Parse** (preferred):
   - Configure MX records for reply subdomain
   - Webhook receives parsed reply
   - Match to original email via In-Reply-To header
2. **Manual Status Update:**
   - User marks prospect as "replied"
   - Triggers pause via UI
3. **HubSpot Sync:**
   - Check HubSpot for new email activities
   - Match by contact and timeframe
**Implementation:**
```typescript
interface ReplyDetectionService {
  // Webhook handler
  handleInboundEmail(parsedEmail: {
    from: string;
    to: string;
    subject: string;
    body: string;
    headers: Record<string, string>;
  }): Promise<void>;
  
  // Manual
  markAsReplied(prospectId: string): Promise<void>;
  
  // Check (for HubSpot sync mode)
  checkForReplies(prospectIds: string[]): Promise<string[]>; // Returns IDs that replied
}
```
**Tests:**
- Reply webhook pauses sequence
- Manual mark pauses sequence
- HubSpot sync detects replies
**Validation:**
- [ ] 8+ tests passing
- [ ] Reply pauses active sequence

### T45.3: Sequence Builder UI Enhancements [M - 3h]
**Goal:** UI to create/edit sequences and monitor enrollments.
**Files:**
- `src/components/SequenceBuilder.tsx` (enhance existing if present, or new)
- `src/components/SequenceEnrollmentList.tsx` (new)
**Dependencies:** T45.1
**Features:**
1. **Sequence Editor:**
   - Drag-drop step reordering
   - Edit step subject/body inline
   - Set delay days between steps
   - Preview with variable substitution
   - Clone existing sequence
2. **Enrollment Dashboard:**
   - List of active enrollments
   - Filter by sequence, status
   - Bulk pause/resume
   - Progress indicator per enrollment (step X of Y)
3. **Stats Panel:**
   - Completion rate, reply rate
   - Step-by-step drop-off
   - A/B test results if applicable
**Tests:**
- E2E: Create sequence, enroll prospect
**Validation:**
- [ ] Can create 4-step sequence
- [ ] Enrollments visible in dashboard

### T45.4: Calendly Integration for Meeting Detection [M - 3h]
**Goal:** Detect when meeting is booked via Calendly, pause sequence.
**Files:**
- `api/webhook/calendly.ts` (new)
- `src/services/CalendlyIntegration.ts` (new)
**Dependencies:** T45.1
**Implementation:**
1. Register Calendly webhook for booking events
2. On booking: extract invitee email
3. Match to prospect by email
4. Update prospect status to 'meeting_booked'
5. Pause any active sequences
6. Log to HubSpot as meeting activity
**Webhook Payload Handling:**
```typescript
interface CalendlyWebhookEvent {
  event: 'invitee.created' | 'invitee.canceled';
  payload: {
    email: string;
    name: string;
    event_type: { name: string };
    scheduled_event: {
      start_time: string;
      end_time: string;
    };
  };
}
```
**Tests:**
- Booking event pauses sequence
- Cancellation resumes sequence
- Meeting logged to HubSpot
**Validation:**
- [ ] 6+ tests passing
- [ ] Manual: Book via Calendly → Sequence pauses

### T45.5: Vercel Cron for Sequence Processing [M - 3h]
**Goal:** Scheduled function to process sequence steps with idempotency.
**Files:**
- `api/cron/process-sequences.ts` (new)
- `vercel.json` - Add cron config
**Dependencies:** T45.1, T45.2
**Cron Config:**
```json
{
  "crons": [
    {
      "path": "/api/cron/process-sequences",
      "schedule": "*/5 * * * *"
    }
  ]
}
```
**Function Logic:**
1. Acquire distributed lock (Firestore transaction) to prevent concurrent runs
2. Check for scheduled steps due
3. Mark items as `processing` before execution (idempotent)
4. Process batch (max 50 per run)
5. Log results + emit metrics
6. Release lock, handle timeouts gracefully
**Tests:**
- Function processes due steps
- Respects batch limit
- Lock prevents concurrent processing
- Idempotent processing (no double-send)
**Validation:**
- [ ] Cron deploys to Vercel
- [ ] Steps processed automatically
- [ ] No duplicate sends observed

### T45.6: Sprint 45 E2E Validation [S - 2h]
**Goal:** Full sequence enrollment and execution works.
**Files:**
- `e2e/sequences.spec.ts` (new)
**Dependencies:** T45.1-T45.5
**Tests:**
1. Create 4-step sequence
2. Enroll prospect
3. First email sends immediately
4. Mock time advance → Second email sends
5. Simulate reply → Sequence pauses
6. Resume → Remaining steps continue
7. Calendly booking pauses (mock)
**Validation:**
- [ ] All E2E tests pass

---

## Sprint 46: Analytics & Reporting Dashboard
**Goal:** Comprehensive email analytics with campaign performance tracking.
**Demo:** View email stats by campaign, persona, company with charts.
**Validation:** Dashboard shows real-time stats, export works.

### T46.1: Email Analytics Service [M - 4h]
**Goal:** Aggregate email metrics from events.
**Files:**
- `src/services/EmailAnalyticsService.ts` (new)
- `src/__tests__/services/EmailAnalyticsService.test.ts` (new)
**Dependencies:** T43.5, T44.2
**Interface:**
```typescript
interface EmailAnalyticsService {
  // Overall stats
  getOverallStats(dateRange?: { start: Date; end: Date }): EmailStats;
  
  // Campaign stats
  getCampaignStats(campaignId: string): EmailStats;
  getCampaignTimeline(campaignId: string): TimeSeriesData[];
  
  // Segmented stats
  getStatsByPersona(): Record<PersonaType, EmailStats>;
  getStatsByTier(): Record<string, EmailStats>;
  getStatsByCompany(limit?: number): Array<{ company: string; stats: EmailStats }>;
  
  // Sequence stats
  getSequenceStats(sequenceId: string): {
    overall: EmailStats;
    byStep: Array<{ step: number; stats: EmailStats }>;
    completionRate: number;
  };
  
  // Engagement trends
  getBestSendTimes(): Array<{ hour: number; day: string; openRate: number }>;
  getTopPerformingSubjects(limit?: number): Array<{ subject: string; openRate: number; count: number }>;
  
  // Prospect-level
  getProspectEngagement(prospectId: string): {
    totalEmails: number;
    opened: number;
    clicked: number;
    replied: number;
    lastEngagement?: Date;
  };
}
```
**Tests:**
- Stats aggregate correctly
- Date filtering works
- Segmentation accurate
**Validation:**
- [ ] 12+ tests passing

### T46.2: Email Analytics Dashboard UI [L - 5h]
**Goal:** Visual dashboard for email performance.
**Files:**
- `src/components/EmailAnalyticsDashboard.tsx` (new)
- `src/components/charts/EmailStatsChart.tsx` (new)
- `src/components/charts/CampaignPerformanceChart.tsx` (new)
- Add to existing Dashboard tab or new "Email Analytics" tab
**Dependencies:** T46.1
**Dashboard Components:**
1. **Summary Cards:**
   - Total Sent, Open Rate, Click Rate, Reply Rate
   - Trend arrows comparing to previous period
2. **Performance Chart:**
   - Line chart: Sent, Opened, Clicked over time
   - Toggle: Daily, Weekly, Monthly
3. **Campaign Leaderboard:**
   - Top 5 campaigns by open rate
   - Click to view campaign details
4. **Persona Breakdown:**
   - Bar chart: Performance by persona
   - Identify best-performing personas
5. **Company Heatmap:**
   - Top engaged companies
   - Click to see contacts at company
6. **Sequence Funnel:**
   - Drop-off visualization per step
   - Identify weak steps
**Tests:**
- E2E: Dashboard renders with data
**Validation:**
- [ ] All charts render
- [ ] Data matches backend

### T46.3: Email Report Export [M - 3h]
**Goal:** Export email analytics as PDF/CSV.
**Files:**
- `src/services/EmailReportExporter.ts` (new)
- `src/__tests__/services/EmailReportExporter.test.ts` (new)
**Dependencies:** T46.1, existing PDFReportService.ts
**Features:**
1. **PDF Report:**
   - Cover page with date range
   - Summary metrics
   - Campaign performance table
   - Charts as images
   - Recommendations section
2. **CSV Export:**
   - Email-level data (subject, recipient, status, opens, clicks)
   - Campaign summary
   - Prospect engagement
**Interface:**
```typescript
interface EmailReportExporter {
  exportToPDF(options: {
    dateRange: { start: Date; end: Date };
    includeCharts: boolean;
    includeCampaigns: boolean;
    includeRecommendations: boolean;
  }): Promise<Blob>;
  
  exportToCSV(options: {
    type: 'emails' | 'campaigns' | 'prospects';
    dateRange: { start: Date; end: Date };
  }): Promise<Blob>;
}
```
**Tests:**
- PDF generates successfully
- CSV has correct columns
**Validation:**
- [ ] 6+ tests passing
- [ ] Manual: PDF opens correctly

### T46.4: Real-Time Stats Updates [S - 2h]
**Goal:** Dashboard updates in real-time as emails are sent/opened.
**Files:**
- `src/hooks/useEmailAnalytics.ts` (new)
- Wire to EmailAnalyticsDashboard.tsx
**Dependencies:** T46.1, T46.2
**Implementation:**
1. Subscribe to Firestore `email_events` collection
2. Update local stats on new events
3. Debounce updates for performance
4. Show "Live" indicator when receiving events
**Tests:**
- New event triggers stats update
- Debouncing works
**Validation:**
- [ ] Stats update without page refresh

### T46.5: Sprint 46 E2E Validation [S - 1h]
**Goal:** Analytics dashboard works end-to-end.
**Files:**
- `e2e/email-analytics.spec.ts` (new)
**Dependencies:** T46.1-T46.4
**Tests:**
1. Dashboard loads with summary cards
2. Charts render
3. PDF export downloads
4. CSV export downloads
5. Real-time updates (mock event)
**Validation:**
- [ ] All E2E tests pass

---

## Sprint 47: Integration Settings & Configuration UI
**Goal:** Complete integrations settings page for all connections.
**Demo:** Navigate to Settings → See all integration status → Configure each.
**Validation:** Settings page fully functional.

### T47.1: Unified Settings Page [M - 4h]
**Goal:** Create comprehensive settings page for all integrations.
**Files:**
- `src/components/SettingsPage.tsx` (new)
- `src/components/settings/HubSpotSettingsPanel.tsx` (new)
- `src/components/settings/SendGridSettingsPanel.tsx` (new)
- `src/components/settings/CalendlySettingsPanel.tsx` (new)
- `src/components/settings/FirestoreSettingsPanel.tsx` (new)
- Add Settings tab to App.tsx navigation
**Dependencies:** All previous integration work
**Layout:**
1. **Navigation:** Sidebar with sections (CRM, Email, Calendar, Database, Profile)
2. **HubSpot Panel:**
   - Connection status
   - Connect/Disconnect button
   - Sync settings (auto-sync toggle, frequency)
   - Field mapping editor
   - Last sync timestamp
3. **SendGrid Panel:**
   - Connection status
   - API key input (masked)
   - From email/name config
   - Test email button
   - Sending limits display
4. **Calendly Panel:**
   - Connection status (webhook configured)
   - Meeting type selection
   - Link display/copy
5. **Firestore Panel:**
   - Connection status
   - Data export button
   - Clear local cache button
**Tests:**
- E2E: Navigate to settings
- E2E: All panels render
**Validation:**
- [ ] Settings page accessible from nav
- [ ] All integration panels show correct status

### T47.2: Environment Variable Management [S - 2h]
**Goal:** Secure handling of API keys without exposing secrets to the client.
**Files:**
- `src/services/ConfigService.ts` (new)
- `api/config/validate.ts` (new)
**Dependencies:** T47.1
**Implementation:**
1. API keys stored ONLY in server-side environment variables (Vercel)
2. Frontend shows connection status only (no raw keys displayed)
3. Settings page calls `/api/config/validate` to test connections
4. Show warning banner if required server env vars missing
5. Add CSP headers to reduce exfiltration risk
**Required Variables (server-side):**
```typescript
const REQUIRED_CONFIG = {
  SENDGRID_API_KEY: { required: true, validator: 'sendgrid' },
  HUBSPOT_CLIENT_ID: { required: true, validator: 'hubspot' },
  HUBSPOT_CLIENT_SECRET: { required: true, validator: 'hubspot' },
  FIREBASE_CONFIG: { required: true, validator: 'firebase' },
  GEMINI_API_KEY: { required: false, validator: 'gemini' },
  CALENDLY_WEBHOOK_SECRET: { required: false, validator: 'calendly' },
};
```
**Tests:**
- Missing var shows warning
- Invalid key shows error
- No secrets present in client bundle
**Validation:**
- [ ] Missing config shows clear message
- [ ] Client never receives API keys

### T47.3: Integration Health Check [M - 3h]
**Goal:** Real-time health status for all integrations.
**Files:**
- `src/services/IntegrationHealthService.ts` (new)
- `src/components/IntegrationHealthIndicator.tsx` (new)
**Dependencies:** T47.1
**Implementation:**
1. Periodic health checks (every 5 minutes)
2. Check endpoints:
   - HubSpot: GET /crm/v3/objects/contacts (test token)
   - SendGrid: GET /v3/user/profile
   - Firestore: Read test document
   - Gemini: Simple completion
3. Display status: 🟢 Healthy | 🟡 Degraded | 🔴 Down
4. Show last check time
5. Manual refresh button
**Interface:**
```typescript
interface IntegrationHealthService {
  checkAll(): Promise<Record<string, { status: 'healthy' | 'degraded' | 'down'; latency: number; error?: string }>>;
  checkSingle(integration: string): Promise<HealthStatus>;
  getLastCheck(): { timestamp: Date; results: Record<string, HealthStatus> };
}
```
**Tests:**
- All integrations checked
- Correct status displayed
**Validation:**
- [ ] Health indicators visible in settings

### T47.4: Sprint 47 Validation [S - 1h]
**Goal:** Settings page fully functional.
**Files:**
- `e2e/settings.spec.ts` (new)
**Tests:**
1. Settings page loads
2. All panels render
3. Health check runs
4. Config validation works
**Validation:**
- [ ] All E2E tests pass

---

## Sprint 48: Contact Data Leverage & Enrichment
**Goal:** Maximize value from 5,409 loaded contacts with smart segmentation.
**Demo:** View contact with enriched data, segment by engagement, prioritize outreach.
**Validation:** Enrichment visible, segmentation works.

### T48.1: Contact Enrichment Display [M - 3h]
**Goal:** Show all available data for each prospect in detail view.
**Files:**
- `src/components/ProspectDetailPanel.tsx` (new)
- Wire to prospect list click event
**Dependencies:** Existing hitlistData.ts
**Display Fields:**
1. **Header:** Name, Title, Company, Tier badge
2. **Contact Info:** Email, LinkedIn URL
3. **Scoring:** Score, breakdown (company tier, engagement, recency)
4. **Qualification:** isOps, isExec, category (Speaker/Attendee/Sponsor)
5. **Activity:** Status, last activity, sequence enrollments
6. **Engagement:** Email opens, clicks, replies
7. **Notes:** Editable notes field
8. **Actions:** Quick buttons (Send Email, Add to Sequence, Update Status)
**Tests:**
- E2E: Click prospect → Detail panel shows
**Validation:**
- [ ] All data fields visible
- [ ] Quick actions work

### T48.2: Smart Segmentation Engine [M - 4h]
**Goal:** Auto-segment contacts for targeted campaigns.
**Files:**
- `src/services/SmartSegmentationService.ts` (new)
- `src/__tests__/services/SmartSegmentation.test.ts` (new)
**Dependencies:** Existing SegmentationService.ts (enhance)
**Pre-built Segments:**
```typescript
const SMART_SEGMENTS: Segment[] = [
  {
    id: 'high-value-uncontacted',
    name: 'High-Value Uncontacted',
    criteria: { tier: ['Tier 1', 'Tier 2'], status: 'new', hasEmail: true },
    description: 'Top tier prospects who haven\'t been contacted yet',
  },
  {
    id: 'engaged-no-meeting',
    name: 'Engaged, No Meeting Yet',
    criteria: { hasOpened: true, status: ['contacted', 'replied'] },
    description: 'Prospects who opened emails but haven\'t booked a meeting',
  },
  {
    id: 'ops-leaders',
    name: 'Operations Leaders',
    criteria: { isOps: true, isExec: true },
    description: 'Decision makers in operations',
  },
  {
    id: 'speakers-manifest',
    name: 'Manifest 2026 Speakers',
    criteria: { category: 'Speaker' },
    description: 'Conference speakers - high visibility',
  },
  {
    id: 'stale-leads',
    name: 'Stale Leads (30+ days)',
    criteria: { lastActivityDaysAgo: { min: 30 }, status: 'contacted' },
    description: 'Contacted but no activity in 30 days - may need re-engagement',
  },
];
```
**Features:**
1. Pre-built segments auto-calculated
2. Custom segment builder
3. Segment counts updated in real-time
4. One-click "Create Campaign" from segment
**Tests:**
- Segment criteria applied correctly
- Counts match filters
**Validation:**
- [ ] 10+ tests passing

### T48.3: Prioritization Score Engine [M - 3h]
**Goal:** Dynamic scoring to prioritize outreach.
**Files:**
- `src/services/PrioritizationService.ts` (new)
- `src/__tests__/services/PrioritizationService.test.ts` (new)
**Dependencies:** T48.2
**Scoring Formula:**
```typescript
function calculatePriority(prospect: Prospect): number {
  let score = 0;
  
  // Company tier (0-40 points)
  const tierScores = { 'Tier 1': 40, 'Tier 2': 30, 'Tier 3': 20, 'Tier 4': 10 };
  score += tierScores[prospect.tier] || 10;
  
  // Role fit (0-30 points)
  if (prospect.isOps) score += 15;
  if (prospect.isExec) score += 15;
  
  // Engagement (0-20 points)
  if (prospect.hasOpened) score += 10;
  if (prospect.hasClicked) score += 10;
  
  // Recency decay (-10 to 0)
  const daysSinceActivity = daysSince(prospect.lastActivityAt);
  if (daysSinceActivity > 30) score -= 10;
  else if (daysSinceActivity > 14) score -= 5;
  
  // Conference presence (0-10 points)
  if (prospect.category === 'Speaker') score += 10;
  else if (prospect.category === 'Sponsor') score += 5;
  
  return Math.max(0, Math.min(100, score));
}
```
**Features:**
1. Auto-calculate priority for all prospects
2. Sort hitlist by priority
3. Priority badge in list view
4. Explain priority breakdown on hover
**Tests:**
- Scoring formula accurate
- Sorting works
**Validation:**
- [ ] 10+ tests passing
- [ ] High-priority prospects at top

### T48.4: Outreach Cadence Recommendations [S - 2h]
**Goal:** Suggest next action for each prospect.
**Files:**
- `src/services/CadenceRecommendationService.ts` (new)
- `src/components/NextActionBadge.tsx` (new)
**Dependencies:** T48.3
**Recommendations:**
```typescript
type NextAction = 
  | { action: 'send_email'; reason: 'Uncontacted high-value' }
  | { action: 'follow_up'; reason: 'No reply to first email (3+ days)' }
  | { action: 'call'; reason: 'Opened 3+ emails but no reply' }
  | { action: 'wait'; reason: 'Recently contacted (< 3 days)' }
  | { action: 'archive'; reason: 'Bounced or unsubscribed' }
  | { action: 'book_meeting'; reason: 'Replied - hot lead!' };
```
**Features:**
1. Badge shows recommended next action
2. Click to execute (opens compose, logs call, etc.)
3. Bulk apply recommendations
**Tests:**
- Recommendations match status
**Validation:**
- [ ] Badges visible in list

### T48.5: Sprint 48 E2E Validation [S - 1h]
**Goal:** Contact data features work end-to-end.
**Files:**
- `e2e/contact-data.spec.ts` (new)
**Tests:**
1. Prospect detail panel opens
2. Smart segments show correct counts
3. Priority sorting works
4. Next action badges visible
**Validation:**
- [ ] All E2E tests pass

---

## Phase 3 Security Checklist (Email Sprints)

- [ ] No API keys in client-side code
- [ ] All webhooks validate signatures
- [ ] Rate limiting on all API routes
- [ ] Suppression list checked before every send
- [ ] Unsubscribe tokens cryptographically signed
- [ ] Tracking tokens cannot be forged
- [ ] CORS restricted to known origins
- [ ] Input sanitization on all email content
- [ ] No PII logged in plain text

## Phase 3 Summary

| Sprint | Focus | Effort | Deliverable |
|--------|-------|--------|-------------|
| 43 | Email Infrastructure | 22h | SendGrid + API routes + queue + compliance |
| 44 | Account-Based Campaigns | 28h | Campaign builder + persona targeting |
| 45 | Email Sequences | 23h | Sequence execution + auto-pause |
| 46 | Email Analytics | 15h | Analytics dashboard + reports |
| 47 | Settings & Config | 12h | Unified settings page |
| 48 | Contact Data | 13h | Enrichment + segmentation + prioritization |

**Total Effort:** ~113 hours
**Dependencies:** Sprints 34-36 should complete first (UI wiring)

### Integration Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         YardFlow GTM Hub                              │
├──────────────────────────────────────────────────────────────────────┤
│  React Frontend                                                        │
│  ├── Campaign Builder UI                                               │
│  ├── Sequence Manager                                                  │
│  ├── Email Analytics Dashboard                                         │
│  └── Settings Page                                                     │
├──────────────────────────────────────────────────────────────────────┤
│  Services Layer                                                        │
│  ├── CampaignService        ──→ Firestore (campaigns)                 │
│  ├── SequenceExecutor       ──→ EmailQueueService                     │
│  ├── PersonaEngine          ──→ GeminiService (AI)                    │
│  ├── EmailAnalyticsService  ──→ Firestore (email_events)              │
│  └── HubSpotEmailSync       ──→ HubSpot API                           │
├──────────────────────────────────────────────────────────────────────┤
│  Vercel API Routes                                                     │
│  ├── /api/email/send        ──→ SendGrid API                          │
│  ├── /api/email/webhook     ←── SendGrid Events                       │
│  ├── /api/track/open        ──→ Firestore (email_events)              │
│  ├── /api/track/click       ──→ Firestore + redirect                  │
│  ├── /api/webhook/calendly  ←── Calendly Bookings                     │
│  └── /api/cron/sequences    ──→ SequenceExecutor (every 5min)         │
├──────────────────────────────────────────────────────────────────────┤
│  External Services                                                     │
│  ├── SendGrid              (Email delivery + events)                   │
│  ├── HubSpot Free          (CRM + activity logging)                   │
│  ├── Firebase/Firestore    (Data persistence)                         │
│  ├── Calendly              (Meeting scheduling)                        │
│  └── Gemini API            (AI personalization)                        │
└──────────────────────────────────────────────────────────────────────┘
```

### Email Platform Recommendation

**Primary: SendGrid** (Already mentioned in existing docs)
- ✅ 100 free emails/day
- ✅ Event webhooks (opens, clicks, bounces)
- ✅ Inbound parse for reply detection
- ✅ Dynamic templates
- ✅ Suppression management

**Alternative Platforms for Account-Based Marketing:**

| Platform | Free Tier | Best For |
|----------|-----------|----------|
| **Mailchimp Transactional (Mandrill)** | $0 credit | High-volume transactional |
| **Postmark** | 100/month | Developer-friendly, fast |
| **Amazon SES** | 62K free (EC2) | Scale, low cost |
| **Brevo (Sendinblue)** | 300/day | Comprehensive marketing suite |

**For HubSpot Free Users:**
- HubSpot Free includes 2,000 email sends/month
- BUT: No sequences, no automation
- Recommendation: Use SendGrid for sending, log to HubSpot as activities

### Key Decisions Needed

1. **SendGrid Plan:** Free (100/day) vs. Essentials ($19.95 for 50K/month)
2. **Reply Detection:** SendGrid Inbound Parse vs. Manual only
3. **Calendly Plan:** Free (1 event type) vs. Standard ($10/mo for teams)
4. **Custom Domain:** For tracking links and unsubscribe (improves deliverability)

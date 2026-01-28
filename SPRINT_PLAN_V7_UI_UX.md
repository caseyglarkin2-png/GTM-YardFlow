# YardFlow GTM Hub - Sprint Plan V7 (UI/UX Integration & Bug Fixes)

## Executive Summary

**Problem:** Backend services (Sprints 26-33) are built and tested but NOT wired to the UI. Integration buttons are fake, components exist but aren't rendered, and E2E tests fail due to missing UI elements.

**Goal:** Wire all existing services to the UI, fix broken integrations, add missing components, and ensure E2E tests pass.

**Current State:**
- Tests: 1825 passing (unit tests)
- E2E: Multiple failures expected due to missing UI
- Components: 15+ built but not imported
- Services: 10+ tested but not connected

**Revised Estimates:** ~75-85 hours total (47 tasks across 9 sprints)

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

## Sprint 35: Dashboard & Analytics Wire-Up
**Goal:** Replace inline dashboard with full DashboardLayout, add export functionality.
**Demo:** Dashboard shows full analytics with date picker, export button works.
**Validation:** E2E tests pass for dashboard.spec.ts

### T35.0: Wire AnalyticsAggregator to useDashboardData [S - 1h]
**Goal:** Ensure dashboard hook uses AnalyticsAggregator for real data.
**Files:**
- `src/hooks/useDashboardData.ts` - Verify connected to AnalyticsAggregator
- `src/services/AnalyticsAggregator.ts`
**Dependencies:** None
**Changes:**
1. Verify useDashboardData uses AnalyticsAggregator
2. Add date range parameter to aggregation
3. Cache results for performance
4. Return typed aggregated data
**Tests:**
- Unit: Verify hook returns aggregated data
**Validation:**
- [ ] useDashboardData returns KPI metrics
- [ ] Date range changes update data
- [ ] Data matches Firestore state

### T35.1: Refactor Inline Dashboard to use DashboardLayout [M - 3h]
**Goal:** Use the full DashboardLayout component wrapper with all features.
**Files:**
- `src/App.tsx` - Replace inline dashboard code with DashboardLayout wrapper
- `src/hooks/useDashboardData.ts` - Already exists, wire it up
**Dependencies:** T35.0
**Changes:**
1. Import `DashboardLayout` as wrapper component
2. Refactor inline KPICard/Chart rendering into DashboardLayout children
3. Add DateRangePicker integration
4. Add refresh button functionality
5. Keep existing KPICard instances but wrap properly
**Interface:**
```tsx
<DashboardLayout
  selectedPeriod={period}
  onPeriodChange={setPeriod}
  onRefresh={refetchData}
  onExport={handleExport}
  isLoading={loading}
>
  <div className="grid grid-cols-4 gap-4">
    <KPICard ... />
    {/* Charts */}
  </div>
</DashboardLayout>
```
**Tests:**
- E2E: `e2e/dashboard.spec.ts` - Date picker works, refresh works
**Validation:**
- [ ] Dashboard shows date range picker
- [ ] Changing date range refreshes data
- [ ] Refresh button triggers reload
- [ ] Loading state shows skeleton

### T35.2: Wire DashboardExporter to Export Button [S - 1.5h]
**Goal:** Export button downloads PNG or PDF of dashboard.
**Files:**
- `src/components/DashboardLayout.tsx` - Wire export handler
- Wire to `src/services/DashboardExporter.ts`
**Dependencies:** T35.1
**Changes:**
1. Import DashboardExporter service
2. Add export dropdown (PNG/PDF options)
3. Wire button click to export function
4. Show loading state during export
**Tests:**
- Unit: Mock DashboardExporter, verify called
- E2E: Click export → File downloads
**Validation:**
- [ ] Click export → Dropdown shows PNG/PDF
- [ ] Click PNG → Downloads PNG file
- [ ] Click PDF → Downloads PDF file
- [ ] Export includes date range header

### T35.3: Add Chart Components to Dashboard [M - 3h]
**Goal:** Render actual charts from the charts/ folder.
**Files:**
- `src/App.tsx` - Dashboard tab
- Import from `src/components/charts/`
**Dependencies:** T35.0, T35.1
**Changes:**
1. Import FunnelChart, BarChart, LineChart, PieChart
2. Add funnel chart for pipeline stages
3. Add bar chart for activity by type
4. Add line chart for trend over time
5. Add pie chart for tier distribution
6. Wire charts to AnalyticsAggregator data
**Tests:**
- E2E: Charts render with data
**Validation:**
- [ ] Funnel chart shows pipeline stages
- [ ] Bar chart shows activity counts
- [ ] Charts update when date range changes
- [ ] Charts show loading state

### T35.4: Add DateRangePicker to Hitlist Filter [S - 1h]
**Goal:** Filter prospects by last activity date.
**Files:**
- `src/App.tsx` - Hitlist tab filter area
**Dependencies:** None
**Changes:**
1. Add DateRangePicker below tier filters
2. Filter prospects by lastActivityDate
3. Clear filter button
**Tests:**
- E2E: Date filter works
**Validation:**
- [ ] Date picker visible in Hitlist
- [ ] Selecting range filters prospects
- [ ] Clear resets to all prospects

### T35.5: Sprint 35 E2E Validation [S - 1h]
**Goal:** All dashboard E2E tests pass.
**Files:**
- `e2e/dashboard.spec.ts`
**Dependencies:** T35.1 through T35.4
**Validation:**
- [ ] `npm run test:e2e -- dashboard.spec.ts` passes
- [ ] All dashboard scenarios pass

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

### T36.6: Sprint 36 E2E Validation [S - 1h]
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

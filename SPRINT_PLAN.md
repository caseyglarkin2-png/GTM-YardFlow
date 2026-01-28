# YardFlow GTM Hub - Sprint Plan V5 (Scale & Integrate)

## Status
- **Sprints 0-25:** ✅ Complete (archived in SPRINT_PLAN_ARCHIVE_V4.md)
- **Tests:** 548 passing | **Build:** 758KB | **Deploy:** gtm-yard-flow.vercel.app
- **Sprint 26:** T26.1 ✅ | T26.2 ✅ | T26.3 ✅ | T26.4 ✅ | T26.5 ✅ | T26.6 ✅ | T26.7 ✅ | T26.8 ✅

## Current Sprint Backlog (26-33)

| Sprint | Name | Difficulty | Value | Status |
|--------|------|------------|-------|--------|
| **26** | HubSpot CRM Integration | 🔴 Hard | 🔥 Critical | 🎯 Active |
| **27** | Real-time Firestore Sync | 🔴 Hard | 🔥 Critical | ⏳ Queued |
| **28** | Analytics Dashboard | 🟡 Medium | 🔥 High | ⏳ Queued |
| **29** | LinkedIn Sales Navigator Import | 🟡 Medium | 🔥 High | ⏳ Queued |
| **30** | Advanced Search & Filters | 🟢 Easy | 🟡 Medium | ⏳ Queued |
| **31** | Bulk Operations | 🟢 Easy | 🟡 Medium | ⏳ Queued |
| **32** | Offline PWA Support | 🟡 Medium | 🟡 Medium | ⏳ Queued |
| **33** | PDF Report Export | 🟢 Easy | 🟡 Medium | ⏳ Queued |

---

## Sprint 26: HubSpot CRM Integration
**Goal:** Bi-directional sync between YardFlow prospects and HubSpot contacts/deals.
**Demo:** Create prospect → syncs to HubSpot. Update in HubSpot → reflects in YardFlow.
**Value:** Direct pipeline integration, sales team adoption, Manifest 2026 tracking.

### Task Overview
```
T26.1 (Types) ──┬── T26.2 (OAuth) ──── T26.3 (API Client) ──┬── T26.5 (Sync Engine)
                │                                            │
T26.4 (Field Map) ──────────────────────────────────────────┘
                                                              │
T26.6 (Deal Pipeline) ─────────────────────────────────────────── T26.7 (Activity Log)
                                                              │
T26.8 (Settings UI) ──────────────────────────────────────────── T26.9 (E2E Tests)
```

### T26.1: HubSpot Types & Schemas [S - 2h]
**Goal:** Define TypeScript types for HubSpot entities.
**Files:** `src/types/hubspot.ts`
**Acceptance Criteria:**
- Types: `HubSpotContact`, `HubSpotDeal`, `HubSpotEngagement`, `HubSpotOwner`
- Zod schemas for runtime validation
- API response wrapper types with pagination
- Error types: `HubSpotApiError`, `RateLimitError`
**Tests:**
- Schema validates sample HubSpot API response
- Schema rejects malformed data
**Validation:** `npm test -- hubspot`

### T26.2: HubSpot OAuth 2.0 Service [L - 5h]
**Goal:** Secure OAuth authentication with PKCE for SPAs.
**Files:** `src/services/HubSpotAuthService.ts`, `src/__tests__/services/HubSpotAuth.test.ts`
**Acceptance Criteria:**
- OAuth 2.0 authorization code flow with PKCE
- Scopes: `crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.objects.deals.read`, `crm.objects.deals.write`
- Token storage in localStorage (encrypted with tenant key)
- Automatic token refresh 5 min before expiry
- State parameter for CSRF protection
- Refresh failure → clear tokens, prompt re-auth
**Interface:**
```typescript
interface HubSpotAuthService {
  getAuthUrl(): string;
  handleCallback(code: string, state: string): Promise<HubSpotTokens>;
  getAccessToken(): Promise<string | null>;
  refreshToken(): Promise<HubSpotTokens>;
  isConnected(): boolean;
  disconnect(): void;
}
```
**Tests:**
- Auth URL includes correct scopes and PKCE verifier
- Token exchange succeeds with valid code
- Token refresh called when access token expires
- Invalid state parameter rejected
- Disconnect clears all stored tokens
**Validation:** Complete OAuth flow in browser

### T26.3: HubSpot API Client [M - 4h]
**Goal:** Type-safe HubSpot API wrapper with rate limiting.
**Files:** `src/services/HubSpotClient.ts`, `src/__tests__/services/HubSpotClient.test.ts`
**Acceptance Criteria:**
- Rate limiting: 100 requests/10 seconds (HubSpot limit)
- Request queue with priority (user actions > background sync)
- Retry with exponential backoff on 429/5xx
- Response caching (5 min TTL for reads)
- Batch API support for bulk operations
**Interface:**
```typescript
interface HubSpotClient {
  // Contacts
  getContacts(params?: ListParams): Promise<PaginatedResponse<HubSpotContact>>;
  getContact(id: string): Promise<HubSpotContact>;
  createContact(data: CreateContactInput): Promise<HubSpotContact>;
  updateContact(id: string, data: Partial<HubSpotContact>): Promise<void>;
  searchContacts(query: string, filters?: SearchFilters): Promise<HubSpotContact[]>;
  batchCreateContacts(contacts: CreateContactInput[]): Promise<BatchResult>;
  
  // Deals
  getDeals(params?: ListParams): Promise<PaginatedResponse<HubSpotDeal>>;
  createDeal(data: CreateDealInput): Promise<HubSpotDeal>;
  updateDeal(id: string, data: Partial<HubSpotDeal>): Promise<void>;
  associateContactToDeal(contactId: string, dealId: string): Promise<void>;
  
  // Engagements
  createNote(objectId: string, body: string): Promise<HubSpotEngagement>;
  createTask(objectId: string, data: TaskInput): Promise<HubSpotEngagement>;
  logEmail(objectId: string, data: EmailLogInput): Promise<HubSpotEngagement>;
}
```
**Tests:**
- Rate limiter queues excess requests
- 429 response triggers retry with backoff
- Cache hit returns without API call
- Pagination fetches all pages
- Batch operations chunk correctly (max 100)
**Validation:** API calls succeed in browser devtools

### T26.4: Field Mapping Service [M - 4h]
**Goal:** Bi-directional field mapping between Prospect and HubSpotContact.
**Files:** `src/services/HubSpotFieldMapper.ts`, `src/config/hubspotFieldMap.ts`
**Acceptance Criteria:**
- Configurable field mappings:
  ```typescript
  const fieldMap: FieldMapping[] = [
    { yardflow: 'name', hubspot: 'firstname,lastname', transform: 'splitName' },
    { yardflow: 'email', hubspot: 'email', transform: 'lowercase' },
    { yardflow: 'company', hubspot: 'company', transform: 'none' },
    { yardflow: 'title', hubspot: 'jobtitle', transform: 'none' },
    { yardflow: 'phone', hubspot: 'phone', transform: 'e164' },
    { yardflow: 'linkedinUrl', hubspot: 'hs_linkedinid', transform: 'extractId' },
    { yardflow: 'status', hubspot: 'hs_lead_status', transform: 'statusMap' },
  ];
  ```
- Transform functions: splitName, joinName, statusMap, timestamp, e164
- Custom property mapping for YardFlow-specific fields
- Null handling: skip null, don't overwrite existing with null
- Conflict detection: compare `updatedAt` timestamps
**Tests:**
- Prospect → HubSpotContact maps all fields
- HubSpotContact → Prospect maps all fields  
- Name split handles "Mary Jane Watson" → first: "Mary Jane", last: "Watson"
- Status mapping is bidirectional
- Null fields don't overwrite existing data
**Validation:** Export prospect, verify all fields in HubSpot

### T26.5: Sync Engine Core [L - 6h]
**Goal:** Reliable bi-directional sync with conflict resolution.
**Files:** `src/services/HubSpotSyncEngine.ts`, `src/__tests__/services/HubSpotSync.test.ts`
**Acceptance Criteria:**
- Sync modes: push, pull, bidirectional
- Incremental sync using `lastModifiedDate` filter
- Batch operations (max 100 per API call)
- Conflict resolution: most recent wins, log conflicts for review
- Sync queue persisted to localStorage
- Background sync every 15 minutes (configurable)
- Manual sync trigger
**Interface:**
```typescript
interface SyncEngine {
  syncAll(direction: 'push' | 'pull' | 'bidirectional'): Promise<SyncResult>;
  syncProspect(prospectId: string): Promise<SyncResult>;
  getSyncStatus(): SyncStatus;
  getConflicts(): ConflictRecord[];
  resolveConflict(id: string, resolution: 'local' | 'remote'): Promise<void>;
  pauseSync(): void;
  resumeSync(): void;
}

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  conflicts: ConflictRecord[];
  duration: number;
}
```
**Tests:**
- New prospect → created in HubSpot
- Updated prospect → updated in HubSpot
- New HubSpot contact → created as prospect
- Conflict: YardFlow newer → YardFlow wins
- Conflict: HubSpot newer → HubSpot wins
- Partial failure → successful items committed, failures logged
- Sync resumes from last checkpoint after interruption
**Validation:** Modify in both systems, sync, verify resolution

### T26.6: Deal Pipeline Integration [M - 4h]
**Goal:** Create and track deals from qualified prospects.
**Files:** `src/services/HubSpotDealService.ts`, `src/__tests__/services/HubSpotDeal.test.ts`
**Acceptance Criteria:**
- Auto-create deal when prospect status = "qualified"
- Deal fields: name, amount (from ROI calculator), stage, closeDate
- Associate contact to deal
- Sync deal stage changes back to YardFlow prospect status
- Stage mapping: Appointment → Discovery → Proposal → Closed Won/Lost
**Tests:**
- Qualified prospect creates deal with correct amount
- Deal associated to contact
- Stage change in HubSpot updates prospect status
- Duplicate deal prevented for same prospect
**Validation:** Qualify prospect, verify deal in HubSpot pipeline

### T26.7: Activity Logging [M - 4h]
**Goal:** Log YardFlow activities to HubSpot contact timeline.
**Files:** `src/services/HubSpotActivityLogger.ts`, `src/__tests__/services/HubSpotActivity.test.ts`
**Acceptance Criteria:**
- Log types: Email sent, Call logged, Meeting scheduled, Note added, DM copied
- Include: timestamp, user, content preview, outcome
- Batch logging for bulk operations (queue and flush)
- Retry failed logs (persist queue in localStorage)
- Activity deduplication (same type + timestamp = skip)
**Tests:**
- Email sequence step logs engagement
- Manual note creates HubSpot note
- Batch of 50 activities logs correctly
- Failed log retried on next sync
- Duplicate activity skipped
**Validation:** Send sequence, verify activities in HubSpot timeline

### T26.8: HubSpot Settings UI [M - 4h]
**Goal:** User-friendly integration settings panel.
**Files:** `src/components/HubSpotSettings.tsx`, `src/__tests__/components/HubSpotSettings.test.tsx`
**Acceptance Criteria:**
- Connect/Disconnect button with OAuth flow
- Connection status: Connected (green), Disconnected (gray), Error (red)
- Last sync timestamp and duration
- Manual sync button with progress spinner
- Sync direction toggle: Push only / Pull only / Bidirectional
- Conflict log viewer (last 10 conflicts with resolution options)
- Error log viewer (last 10 errors)
**Tests:**
- Connect button initiates OAuth redirect
- Disconnect clears tokens and shows disconnected state
- Manual sync shows progress and updates timestamp
- Conflict resolution updates UI
**Validation:** Visual inspection of settings panel states

### T26.9: HubSpot Integration E2E Tests [M - 4h]
**Goal:** End-to-end tests with mocked HubSpot API.
**Files:** `e2e/hubspot.spec.ts`, `e2e/mocks/hubspot-handlers.ts`
**Acceptance Criteria:**
- Mock HubSpot API with MSW (Mock Service Worker)
- Test scenarios:
  1. Connect → OAuth flow completes → status shows connected
  2. Create prospect → sync → appears in mock HubSpot
  3. Update mock HubSpot contact → pull sync → prospect updated
  4. Qualify prospect → deal created
  5. Disconnect → tokens cleared → status disconnected
- Error scenarios: API down (503), rate limited (429), invalid token (401)
**Tests:** All scenarios pass in Playwright
**Validation:** `npm run test:e2e -- hubspot.spec.ts`

---

## Sprint 27: Real-time Firestore Collaboration
**Goal:** Enable real-time multi-user collaboration with Firestore as source of truth.
**Demo:** Two browser windows showing live updates when one user modifies a prospect.
**Dependencies:** Firebase project configured (existing)

### T27.1: Firestore Schema & Security Rules [L - 5h]
**Files:** `firestore.rules`, `firestore.indexes.json`, `src/types/firestore.ts`
**Acceptance Criteria:**
- Collections: `tenants/{tenantId}/prospects`, `/companies`, `/activities`, `/sequences`
- Security rules enforce tenant isolation
- Composite indexes for queries (status + createdAt, assignee + status)
**Tests:** Firebase emulator rule tests pass

### T27.2: Firestore Service Layer [L - 6h]
**Files:** `src/services/FirestoreService.ts`
**Acceptance Criteria:**
- CRUD with optimistic updates and rollback
- Real-time subscriptions with cleanup
- Batch operations (500 docs max)
- Offline queue for pending writes

### T27.3: Real-time Sync Hooks [M - 4h]
**Files:** `src/hooks/useFirestoreCollection.ts`, `useFirestoreDoc.ts`
**Acceptance Criteria:**
- Loading/error states
- Auto-unsubscribe on unmount
- Connection status indicator

### T27.4: Conflict Resolution [M - 4h]
**Files:** `src/services/ConflictResolver.ts`
**Acceptance Criteria:**
- Last-write-wins for simple fields
- Merge strategy for arrays
- Conflict UI for manual resolution

### T27.5: Presence System [M - 4h]
**Files:** `src/services/PresenceService.ts`, `src/components/PresenceIndicator.tsx`
**Acceptance Criteria:**
- Online/idle/offline status
- "Who's viewing" avatar stack
- Heartbeat every 30 seconds

### T27.6: Migration Service [M - 4h]
**Files:** `src/services/MigrationService.ts`
**Acceptance Criteria:**
- One-time localStorage → Firestore migration
- Progress callback for UI
- Rollback within 24 hours

### T27.7: Offline Queue & Sync Status [S - 3h]
**Files:** `src/services/OfflineQueue.ts`, `src/components/SyncStatus.tsx`
**Acceptance Criteria:**
- IndexedDB queue for offline writes
- Auto-sync on reconnect
- "X changes pending" indicator

### T27.8: Firestore E2E Tests [M - 4h]
**Files:** `e2e/firestore-sync.spec.ts`
**Tests:** Multi-user sync scenarios with Firebase emulator

---

## Sprint 28: Analytics Dashboard
**Goal:** Visualize pipeline, activity, and performance metrics.
**Demo:** Dashboard with conversion funnel, activity trends, team leaderboard.
**Dependencies:** Sprint 27 (Firestore for real-time data)

### T28.1: Analytics Data Aggregator [M - 4h]
**Files:** `src/services/AnalyticsAggregator.ts`, `src/types/analytics.ts`

### T28.2: Chart Components (Recharts) [L - 6h]
**Files:** `src/components/charts/FunnelChart.tsx`, `BarChart.tsx`, `LineChart.tsx`

### T28.3: Dashboard Layout [M - 4h]
**Files:** `src/components/Dashboard.tsx`, `src/components/DashboardWidget.tsx`

### T28.4: Date Range Picker [S - 2h]
**Files:** `src/components/DateRangePicker.tsx`

### T28.5: KPI Cards [S - 2h]
**Files:** `src/components/KPICard.tsx`

### T28.6: Team Leaderboard [M - 3h]
**Files:** `src/components/Leaderboard.tsx`

### T28.7: Export Dashboard [S - 3h]
**Files:** `src/services/DashboardExporter.ts` (PNG/PDF)

### T28.8: Dashboard E2E Tests [M - 3h]
**Files:** `e2e/dashboard.spec.ts`

---

## Sprint 29: LinkedIn Sales Navigator Import
**Goal:** Import prospects from Sales Navigator CSV exports.
**Demo:** Upload CSV → column mapping → duplicate detection → import with company matching.

### T29.1: LinkedIn CSV Parser [M - 4h]
**Files:** `src/services/LinkedInCsvParser.ts`

### T29.2: Company Matcher [M - 4h]
**Files:** `src/services/CompanyMatcher.ts` (fuzzy matching)

### T29.3: Duplicate Detector [M - 4h]
**Files:** `src/services/DuplicateDetector.ts`

### T29.4: Import Wizard UI [L - 6h]
**Files:** `src/components/ImportWizard.tsx`

### T29.5: Import History & Undo [S - 3h]
**Files:** `src/services/ImportHistory.ts`

### T29.6: LinkedIn Import E2E Tests [M - 3h]
**Files:** `e2e/linkedin-import.spec.ts`

---

## Sprint 30: Advanced Search & Filters
**Goal:** Powerful search with saved filters and keyboard navigation.
**Demo:** Complex filter query, save as segment, Cmd+K command palette.

### T30.1: Search Index (Fuse.js) [M - 4h]
**Files:** `src/services/SearchIndex.ts`

### T30.2: Filter Builder UI [L - 6h]
**Files:** `src/components/FilterBuilder.tsx`

### T30.3: Saved Filters (Segments) [M - 4h]
**Files:** `src/services/SavedFilters.ts`

### T30.4: Keyboard Navigation [M - 4h]
**Files:** `src/hooks/useKeyboardNav.ts`

### T30.5: Command Palette (Cmd+K) [M - 4h]
**Files:** `src/components/CommandPalette.tsx`

### T30.6: Search E2E Tests [M - 3h]
**Files:** `e2e/search.spec.ts`

---

## Sprint 31: Bulk Operations
**Goal:** Perform actions on multiple prospects at once.
**Demo:** Select 100 prospects → bulk assign to sequence → bulk tag.

### T31.1: Multi-Select UI [M - 4h]
**Files:** `src/components/MultiSelect.tsx`, `src/hooks/useMultiSelect.ts`

### T31.2: Bulk Action Menu [M - 4h]
**Files:** `src/components/BulkActionMenu.tsx`

### T31.3: Bulk Sequence Assignment [M - 4h]
**Files:** `src/services/BulkSequenceService.ts`

### T31.4: Bulk Export [M - 4h]
**Files:** `src/services/BulkExporter.ts`

### T31.5: Bulk Delete + Recovery [S - 3h]
**Files:** `src/services/BulkDeleteService.ts`, `src/components/TrashBin.tsx`

### T31.6: Bulk E2E Tests [M - 3h]
**Files:** `e2e/bulk.spec.ts`

---

## Sprint 32: Offline PWA Support
**Goal:** Full offline functionality with service worker.
**Demo:** Go offline, make changes, come back online, changes sync.
**Dependencies:** Sprint 27 (Firestore offline queue)

### T32.1: Service Worker Setup [L - 6h]
**Files:** `src/sw.ts`, vite-plugin-pwa config

### T32.2: IndexedDB Data Layer [M - 4h]
**Files:** `src/services/IndexedDBService.ts`

### T32.3: Background Sync [M - 4h]
**Files:** `src/services/BackgroundSync.ts`

### T32.4: Offline UI Indicators [S - 3h]
**Files:** `src/components/OfflineIndicator.tsx`

### T32.5: App Install Prompt [S - 2h]
**Files:** `src/components/InstallPrompt.tsx`

### T32.6: PWA E2E Tests [M - 3h]
**Files:** `e2e/offline.spec.ts`

---

## Sprint 33: PDF Report Export
**Goal:** Generate professional PDF reports for prospects and ROI.
**Demo:** Generate prospect report with ROI, activity timeline, branding.

### T33.1: PDF Template Engine [L - 6h]
**Files:** `src/services/PDFTemplateEngine.ts` (@react-pdf/renderer)

### T33.2: Prospect Report Template [M - 4h]
**Files:** `src/templates/pdf/ProspectReport.tsx`

### T33.3: ROI Report Template [M - 4h]
**Files:** `src/templates/pdf/ROIReport.tsx`

### T33.4: PDF Export UI [M - 4h]
**Files:** `src/components/PDFExportModal.tsx`

### T33.5: Batch PDF Generation [M - 4h]
**Files:** `src/services/BatchPDFGenerator.ts`

### T33.6: PDF E2E Tests [M - 3h]
**Files:** `e2e/pdf-export.spec.ts`

---

## Definition of Done (All Tasks)
- [ ] Code compiles without TypeScript errors
- [ ] All new code has unit tests (≥80% coverage)
- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Feature works in browser
- [ ] PR reviewed or self-reviewed

## Definition of Done (All Sprints)
- [ ] All tasks complete
- [ ] E2E tests pass for sprint features
- [ ] Demo recorded or live demo works
- [ ] Deployed to Vercel
- [ ] Sprint plan updated with status

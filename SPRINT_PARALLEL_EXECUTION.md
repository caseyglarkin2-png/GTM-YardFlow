# HubSpot OAuth (add in Vercel Dashboard)
HUBSPOT_CLIENT_SECRET=your_secret

# SendGrid
SENDGRID_API_KEY=SG.your_key
SENDGRID_FROM_EMAIL=notifications@your-domain.com
SENDGRID_WEBHOOK_PUBLIC_KEY=MFkwEw...

# Tracking & Compliance
TRACKING_SECRET=<openssl rand -hex 32>
UNSUBSCRIBE_HMAC_SECRET=<openssl rand -hex 32>

# Firebase Admin
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}# Parallel Sprint Execution Plan: Sprints 34, 36, 43

## Executive Summary

**Goal:** Execute Sprint 34 (UI Wiring), Sprint 36 (Bulk Operations UI), and Sprint 43 (Email Infrastructure) in parallel with atomic, testable tasks.

**Execution Mode:** All three sprints can proceed simultaneously as they have minimal dependencies on each other.

**Total Effort:** ~63-68 hours across all three sprints (revised from 55-60h after review)
**Parallelization:** 3 concurrent workstreams

---

## ⚠️ Pre-Execution Requirements

### Critical Dependencies (Install Before Starting)
```bash
npm install @sendgrid/mail@^7.7.0 @sendgrid/eventwebhook@^7.7.0 firebase-admin@^12.0.0
```

### Environment Variables Required
```bash
# Firebase Admin (Server-side only - for Vercel)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'  # JSON string

# SendGrid
SENDGRID_API_KEY=SG.xxx
SENDGRID_WEBHOOK_SIGNING_KEY=xxx

# HubSpot
HUBSPOT_CLIENT_SECRET=xxx  # Server-side token exchange
```

---

## Current State Analysis (Pre-Execution Audit)

### Sprint 34: UI Wiring
| Component | Status | Evidence |
|-----------|--------|----------|
| `useHubSpot` hook | ✅ EXISTS | `src/hooks/useHubSpot.ts` (344 lines) |
| HubSpot wired to App | ✅ DONE | `App.tsx:283-284` imports and uses hook |
| OAuth flow implemented | ✅ DONE | Popup + redirect fallback in hook |
| **ENV VARS MISSING** | ❌ BLOCKER | `VITE_HUBSPOT_CLIENT_ID`, `VITE_HUBSPOT_REDIRECT_URI` not set |
| CommandPalette wired | ✅ DONE | `App.tsx:86, 289` |
| useOfflineQueue wired | ✅ DONE | `App.tsx:87, 291` |
| PresenceIndicator | ✅ IMPORTED | `App.tsx:93` |
| E2E integrations.spec.ts | ✅ EXISTS | `e2e/integrations.spec.ts` |

**Remaining Work:** Environment variable configuration, Vercel deployment settings, E2E validation

### Sprint 36: Bulk Operations UI
| Component | Status | Evidence |
|-----------|--------|----------|
| Selection state | ❌ MISSING | No `selectedProspectIds` in App.tsx |
| Checkboxes in list | ❌ MISSING | No checkbox elements in prospect rows |
| BulkActionsToolbar | ❌ MISSING | File does not exist |
| BulkActionService | ✅ EXISTS | `src/services/BulkActionService.ts` |
| BulkExporter | ✅ EXISTS | `src/services/BulkExporter.ts` |
| BulkDeleteService | ✅ EXISTS | `src/services/BulkDeleteService.ts` |
| MultiSelectService | ✅ EXISTS | `src/services/MultiSelectService.ts` |
| bulk.spec.ts | ✅ EXISTS | `e2e/bulk.spec.ts` |

**Remaining Work:** All UI components need to be created and wired

### Sprint 43: Email Infrastructure
| Component | Status | Evidence |
|-----------|--------|----------|
| `/api` directory | ❌ MISSING | No Vercel serverless functions |
| SendGridClient | ❌ MISSING | No SendGrid service |
| EmailQueueService | ❌ MISSING | Queue not implemented |
| EmailComplianceService | ❌ MISSING | CAN-SPAM/GDPR not implemented |
| Email types | ❌ MISSING | `src/types/email.ts` doesn't exist |
| EmailSequenceService | ⚠️ PARTIAL | Templates exist, no sending |

**Remaining Work:** Full infrastructure build required

---

## Workstream A: Sprint 34 Completion (HubSpot OAuth)

### A.1: Configure HubSpot OAuth Environment [XS - 30min]
**Goal:** Set up Vercel environment variables for HubSpot OAuth.
**Files:**
- `.env.example` - Document required variables
- `vercel.json` - Verify no env conflicts
**Steps:**
1. Create `.env.example` with required HubSpot variables:
   ```
   VITE_HUBSPOT_CLIENT_ID=your_client_id_here
   VITE_HUBSPOT_REDIRECT_URI=https://your-domain.vercel.app/oauth/callback
   ```
2. Document in README how to obtain HubSpot app credentials
3. Add development callback URL to .env.local
**Validation:**
- [ ] `.env.example` documents all HubSpot variables
- [ ] Local dev starts without errors when env vars set
- [ ] `npm run build` succeeds

### A.2: Create OAuth Callback Route with Server-Side Token Exchange [M - 2h]
**Goal:** Securely exchange OAuth code for tokens server-side (never expose client secret).
**Files:**
- `api/oauth/callback.ts` (new) - Vercel serverless function
- `api/oauth/token.ts` (new) - Token exchange endpoint
**Implementation:**
```typescript
// api/oauth/callback.ts
// Receives OAuth redirect, exchanges code server-side, sets session cookie
export default async function handler(req, res) {
  const { code, state, error } = req.query;
  if (error) {
    return res.redirect(`/?oauth_error=${encodeURIComponent(error)}`);
  }
  
  // Exchange code for tokens SERVER-SIDE
  const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.VITE_HUBSPOT_CLIENT_ID,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET, // Server-only!
      redirect_uri: process.env.VITE_HUBSPOT_REDIRECT_URI,
      code: code as string,
    }),
  });
  
  if (!tokenResponse.ok) {
    return res.redirect('/?oauth_error=token_exchange_failed');
  }
  
  const tokens = await tokenResponse.json();
  
  // Store tokens securely (encrypted in cookie or DB)
  // Set HttpOnly cookie with session token
  res.setHeader('Set-Cookie', `hs_session=${encryptedSessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/`);
  
  return res.redirect('/?oauth_success=true');
}
```
**Security:**
- Client secret NEVER exposed to frontend
- Token exchange happens server-side only
- Session stored in HttpOnly cookie (not localStorage)
- CSRF protection via state parameter
**Tests:**
- Unit: Token exchange with valid code succeeds
- Unit: Invalid code returns error redirect
- Unit: Missing client_secret in env returns 500
**Validation:**
- [ ] `api/oauth/callback.ts` exists and deploys
- [ ] Token exchange uses server-side secret only
- [ ] Frontend never sees client_secret

### A.3: Add HubSpot OAuth Error States to UI [XS - 30min]
**Goal:** Display user-friendly error messages for OAuth failures.
**Files:**
- `src/App.tsx` - Enhance integrations tab error display
**Changes:**
1. Add specific error messages for common OAuth failures:
   - "Popup blocked" → Show instructions to allow popups
   - "Invalid client_id" → Show setup instructions link
   - "User denied" → Show "Authorization cancelled" message
2. Add "Need Help?" link to HubSpot app setup documentation
**Tests:**
- Unit: Error messages render correctly
**Validation:**
- [ ] All error states have user-friendly messages
- [ ] Help link visible when error occurs

### A.4: Create HubSpot Connection Test [S - 1h]
**Goal:** Verify connection works by making test API call.
**Files:**
- `src/services/HubSpotClient.ts` - Add `testConnection()` method
- `src/hooks/useHubSpot.ts` - Add connection test on successful auth
**Implementation:**
```typescript
// In HubSpotClient
async testConnection(): Promise<{ valid: boolean; portalId: string; hubDomain: string }> {
  const response = await fetch('https://api.hubapi.com/account-info/v3/details', {
    headers: { Authorization: `Bearer ${this.accessToken}` }
  });
  const data = await response.json();
  return { valid: true, portalId: data.portalId, hubDomain: data.uiDomain };
}
```
**Tests:**
- Unit: Test connection parses response correctly
- Integration: Mock HubSpot API returns valid data
**Validation:**
- [ ] After OAuth, portal info displays in UI
- [ ] Invalid token shows "Disconnected" state

### A.5: Sprint 34 E2E Test Suite [S - 1h]
**Goal:** Ensure all Sprint 34 features pass E2E tests.
**Files:**
- `e2e/integrations.spec.ts` - Update for real OAuth flow (mocked)
**Tests:**
1. Navigate to Integrations tab
2. HubSpot card shows "Not Connected"
3. Click "Connect HubSpot" → OAuth popup opens (mocked)
4. Mock successful OAuth → Shows "Connected" with portal ID
5. Click "Disconnect" → Shows "Not Connected"
6. Refresh page → Connection persists (when mocking localStorage)
**Validation:**
- [ ] `npm run test:e2e -- integrations.spec.ts` passes
- [ ] All A.1-A.4 tasks validated

### A.6: Implement HubSpot Token Refresh [M - 1h]
**Goal:** Automatically refresh expired HubSpot tokens.
**Files:**
- `api/oauth/refresh.ts` (new) - Token refresh endpoint
- `src/hooks/useHubSpot.ts` - Add auto-refresh logic
**Implementation:**
```typescript
// api/oauth/refresh.ts
export default async function handler(req, res) {
  const refreshToken = getRefreshTokenFromSession(req);
  
  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.VITE_HUBSPOT_CLIENT_ID,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  
  // Update session with new tokens
}
```
**Logic:**
1. Check token expiry before API calls (5 minute buffer)
2. If expired, call `/api/oauth/refresh`
3. Retry original request with new token
4. Handle refresh failure (force re-auth)
**Tests:**
- Unit: Expired token triggers refresh
- Unit: Refresh failure clears session
**Validation:**
- [ ] Token auto-refreshes before expiry
- [ ] Failed refresh shows re-connect prompt

---

## Workstream B: Sprint 36 Bulk Operations UI

### B.1: Add Selection State to App.tsx [S - 45min]
**Goal:** Implement multi-select state management.
**Files:**
- `src/App.tsx` - Add selection state
- `src/__tests__/App.selection.test.tsx` (new) - Unit tests
**Changes:**
```typescript
// Add to App.tsx state section
const [selectedProspectIds, setSelectedProspectIds] = useState<Set<string>>(new Set());

const toggleSelection = useCallback((id: string) => {
  setSelectedProspectIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  });
}, []);

const selectAll = useCallback(() => {
  setSelectedProspectIds(new Set(filteredProspects.map(p => p.id)));
}, [filteredProspects]);

const clearSelection = useCallback(() => {
  setSelectedProspectIds(new Set());
}, []);

const isAllSelected = useMemo(() => 
  filteredProspects.length > 0 && 
  filteredProspects.every(p => selectedProspectIds.has(p.id)),
  [filteredProspects, selectedProspectIds]
);
```
**Tests:**
- `toggleSelection` adds/removes IDs
- `selectAll` selects all visible prospects
- `clearSelection` empties set
- `isAllSelected` true when all visible selected
**Validation:**
- [ ] State updates correctly in React DevTools
- [ ] 4+ unit tests passing

### B.2: Add Checkbox Column to Prospect List [M - 1.5h]
**Goal:** Each prospect row has a selectable checkbox with full accessibility.
**Files:**
- `src/App.tsx` - Prospect list rendering (around line 1500+)
**Changes:**
1. Add header checkbox with indeterminate state:
```tsx
<input
  type="checkbox"
  data-testid="select-all-checkbox"
  checked={isAllSelected}
  ref={el => { if (el) el.indeterminate = selectedProspectIds.size > 0 && !isAllSelected; }}
  onChange={() => isAllSelected ? clearSelection() : selectAll()}
  className="w-4 h-4 rounded border-slate-300 text-blue-600"
  aria-label="Select all prospects"
/>
```
2. Add row checkbox:
```tsx
<input
  type="checkbox"
  data-testid={`select-${prospect.id}`}
  checked={selectedProspectIds.has(prospect.id)}
  onChange={() => toggleSelection(prospect.id)}
  onClick={(e) => e.stopPropagation()} // Prevent row click
  className="w-4 h-4 rounded border-slate-300 text-blue-600"
  aria-label={`Select ${prospect.name}`}
/>
```
3. Highlight selected rows with different background
4. Add keyboard handling (Space to toggle when row focused)
5. **Accessibility (A11y):**
   - Add `role="row"` to prospect rows
   - Add `aria-selected` reflecting selection state
   - Announce selection changes to screen readers via live region
   - Tab navigation follows logical order (checkbox → row content)
**Tests:**
- E2E: Click checkbox → Row selected
- E2E: Click header checkbox → All selected
- E2E: Click selected row checkbox → Row deselected
- Unit: ARIA attributes update correctly
**Validation:**
- [ ] Checkboxes visible in prospect list
- [ ] Selection state updates correctly
- [ ] Shift+click range selection works (via MultiSelectService)
- [ ] Screen reader announces selection changes

### B.3: Create BulkActionsToolbar Component [M - 2h]
**Goal:** Floating toolbar appears when prospects selected.
**Files:**
- `src/components/BulkActionsToolbar.tsx` (new)
- `src/__tests__/components/BulkActionsToolbar.test.tsx` (new)
**Component Props:**
```typescript
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
**UI Elements:**
1. Fixed position at bottom center of screen
2. Selected count badge: "5 selected"
3. Action buttons with icons:
   - Assign to Sequence (MessageSquare icon)
   - Add Tag (Tag icon)
   - Change Status (RefreshCw icon)
   - Export (Download icon)
   - Delete (Trash2 icon, red)
4. Clear selection button (X icon)
5. Animate in/out with CSS transitions
**Tests:**
- Renders with correct count
- All action buttons call handlers
- Clear button calls onClear
- Accessible keyboard navigation
**Validation:**
- [ ] Component renders when selectedCount > 0
- [ ] All buttons have data-testid attributes
- [ ] 6+ unit tests passing

### B.4: Render BulkActionsToolbar in App.tsx [S - 45min]
**Goal:** Wire toolbar to selection state.
**Files:**
- `src/App.tsx` - Import and render BulkActionsToolbar
**Changes:**
1. Import BulkActionsToolbar component
2. Add modal state for bulk actions:
```typescript
const [bulkActionModal, setBulkActionModal] = useState<
  'sequence' | 'tag' | 'status' | 'delete' | null
>(null);
```
3. Render toolbar when selection > 0:
```tsx
{selectedProspectIds.size > 0 && (
  <BulkActionsToolbar
    selectedCount={selectedProspectIds.size}
    onAssignSequence={() => setBulkActionModal('sequence')}
    onAddTag={() => setBulkActionModal('tag')}
    onChangeStatus={() => setBulkActionModal('status')}
    onExport={() => handleBulkExport()}
    onDelete={() => setBulkActionModal('delete')}
    onClear={clearSelection}
  />
)}
```
**Tests:**
- E2E: Select 3 prospects → Toolbar appears with "3 selected"
- E2E: Click Clear → Toolbar disappears
**Validation:**
- [ ] Toolbar appears at bottom when prospects selected
- [ ] Shows correct count
- [ ] Disappears after clear

### B.5: Wire BulkActionService for Sequence Assignment [M - 1.5h]
**Goal:** "Assign to Sequence" actually assigns prospects.
**Files:**
- `src/App.tsx` - Add sequence assignment handler
- `src/components/BulkSequenceModal.tsx` (new) - Sequence picker modal
**Modal UI:**
1. List available sequences from EmailSequenceService
2. Search/filter sequences
3. Confirm button with selected sequence
4. Cancel button
5. **Loading state:** Show spinner while loading sequences
6. **Error state:** Show retry button if load fails
7. **Partial success:** If some assignments fail, show which succeeded/failed
**Implementation:**
```typescript
const handleBulkAssignSequence = async (sequenceId: string) => {
  const ids = Array.from(selectedProspectIds);
  try {
    const result = await bulkActionService.assignToSequence(ids, sequenceId);
    if (result.failedCount > 0) {
      toast.warning(`${result.successCount} assigned, ${result.failedCount} failed`);
    } else {
      toast.success(`${result.successCount} prospects assigned to sequence`);
    }
    clearSelection();
  } catch (error) {
    toast.error('Failed to assign sequence. Please try again.');
  } finally {
    setBulkActionModal(null);
  }
};
```
**Tests:**
- E2E: Select prospects → Assign to Sequence → Modal opens
- E2E: Select sequence → Confirm → Toast shows success
- E2E: Cancel → Modal closes, selection preserved
- Unit: Partial failure shows warning
- Unit: Loading state renders spinner
**Validation:**
- [ ] Modal opens with sequence list
- [ ] Loading and error states handled
- [ ] Partial success shows both counts

### B.5b: Wire BulkActionService for Tag Assignment [S - 45min]
**Goal:** "Add Tag" assigns tags to selected prospects.
**Files:**
- `src/App.tsx` - Add tag assignment handler
- `src/components/BulkTagModal.tsx` (new) - Tag picker/creator modal
**Modal UI:**
1. List existing tags
2. Create new tag option
3. Multi-select tags to add
4. Confirm/Cancel buttons
**Implementation:**
```typescript
const handleBulkAddTag = async (tags: string[]) => {
  const ids = Array.from(selectedProspectIds);
  await bulkActionService.addTags(ids, tags);
  toast.success(`Added ${tags.length} tag(s) to ${ids.length} prospects`);
  clearSelection();
  setBulkActionModal(null);
};
```
**Tests:**
- E2E: Select → Add Tag → Modal → Select tags → Confirm → Success
**Validation:**
- [ ] Tag modal opens with tag list
- [ ] Tags applied to all selected

### B.6: Wire BulkExporter for Export [S - 1h]
**Goal:** Export selected prospects as CSV/JSON.
**Files:**
- `src/App.tsx` - Add export handler
**Implementation:**
```typescript
const handleBulkExport = async () => {
  const ids = Array.from(selectedProspectIds);
  const selectedProspects = prospects.filter(p => ids.includes(p.id));
  
  // Show format dropdown or use default CSV
  const blob = await bulkExporter.exportToCSV(selectedProspects);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prospects-export-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  toast.success(`Exported ${ids.length} prospects`);
};
```
**Tests:**
- E2E: Select prospects → Export → File downloads
- E2E: Downloaded file contains correct data
**Validation:**
- [ ] CSV downloads with correct filename
- [ ] File contains all selected prospect data

### B.7: Wire BulkDeleteService with Confirmation [S - 1h]
**Goal:** Delete selected prospects with undo option.
**Files:**
- `src/App.tsx` - Add delete handler
- `src/components/BulkDeleteModal.tsx` (new) - Confirmation modal
**Modal UI:**
1. Warning icon
2. "Delete X prospects?" message
3. List of affected prospect names (first 5)
4. Confirm button (red)
5. Cancel button
**Implementation:**
```typescript
const handleBulkDelete = async () => {
  const ids = Array.from(selectedProspectIds);
  const result = await bulkDeleteService.softDelete(ids);
  
  toast.success(
    `Deleted ${result.deletedCount} prospects`,
    {
      action: {
        label: 'Undo',
        onClick: async () => {
          await bulkDeleteService.restore(ids);
          toast.success('Restored prospects');
        }
      },
      duration: 10000
    }
  );
  
  clearSelection();
  setBulkActionModal(null);
};
```
**Tests:**
- E2E: Select → Delete → Confirmation modal shows
- E2E: Confirm → Prospects removed, undo toast visible
- E2E: Click Undo → Prospects restored
**Validation:**
- [ ] Confirmation modal shows count and names
- [ ] Delete removes prospects from list
- [ ] Undo restores within 10 seconds

### B.8: Sprint 36 E2E Test Suite [M - 2h]
**Goal:** Full bulk operations flow works end-to-end.
**Files:**
- `e2e/bulk.spec.ts` - Update with new tests
**Tests:**
1. Select single prospect → Checkbox checked, toolbar shows "1 selected"
2. Select all → All checkboxes checked, toolbar shows total count
3. Shift+click → Range selected (complex scenario)
4. Assign sequence → Modal → Confirm → Success toast
5. Add tag → Modal → Select tags → Confirm → Success toast
6. Export → CSV downloads with correct data
7. Delete → Confirm → Deleted, undo works within 10 seconds
8. Clear selection → All deselected, toolbar hidden
9. Keyboard navigation → Tab through checkboxes, Space to toggle
**Validation:**
- [ ] `npm run test:e2e -- bulk.spec.ts` passes
- [ ] All B.1-B.7 tasks validated

---

## Workstream C: Sprint 43 Email Infrastructure

### C.0: Scaffold API Directory and Install Dependencies [XS - 30min]
**Goal:** Set up Vercel API routes structure and required packages.
**Files:**
- `api/.gitkeep` (new) - Create API directory
- `vercel.json` - Verify API routes enabled
- `package.json` - Add server dependencies
**Steps:**
1. Create `/api` directory structure:
   ```
   api/
   ├── email/
   │   ├── send.ts
   │   ├── webhook.ts
   │   └── unsubscribe.ts
   ├── oauth/
   │   ├── callback.ts
   │   └── refresh.ts
   └── track/
       ├── open.ts
       └── click.ts
   ```
2. Install dependencies:
   ```bash
   npm install @sendgrid/mail@^7.7.0 @sendgrid/eventwebhook@^7.7.0 firebase-admin@^12.0.0
   ```
3. Update `vercel.json` to ensure API routes work
4. Create `.env.example` with all required server env vars
**Validation:**
- [ ] `/api` directory exists
- [ ] Dependencies installed
- [ ] Vercel preview deploys successfully

### C.1: Create Email Types [S - 1h]
**Goal:** Define comprehensive email type system.
**Files:**
- `src/types/email.ts` (new)
**Types:**
```typescript
// Email message structure
export interface EmailMessage {
  id: string;
  to: string;
  toName?: string;
  from: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  headers?: Record<string, string>;
  metadata?: {
    prospectId?: string;
    campaignId?: string;
    sequenceId?: string;
    stepNumber?: number;
    personaType?: string;
  };
}

// Queue item for async processing
export interface EmailQueueItem {
  id: string;
  email: EmailMessage;
  status: 'pending' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
  scheduledAt?: Date;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  nextAttemptAt?: Date;
  error?: string;
  sendGridMessageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Webhook events from SendGrid
export type SendGridEventType = 
  | 'processed' | 'dropped' | 'delivered' | 'deferred'
  | 'bounce' | 'open' | 'click' | 'spam' | 'unsubscribe';

export interface SendGridWebhookEvent {
  event: SendGridEventType;
  email: string;
  timestamp: number;
  'smtp-id'?: string;
  sg_event_id: string;
  sg_message_id?: string;
  url?: string; // For click events
  reason?: string; // For bounce/dropped
}

// Suppression list entry
export interface SuppressionEntry {
  email: string;
  reason: 'unsubscribe' | 'bounce' | 'spam_report' | 'manual';
  createdAt: Date;
  source?: string; // Campaign/sequence that triggered
}

// Email statistics
export interface EmailStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  spamReported: number;
  openRate: number;  // opened / delivered
  clickRate: number; // clicked / delivered
  bounceRate: number; // bounced / sent
}
```
**Tests:**
- Zod schema validates EmailMessage
- Type inference works correctly
**Validation:**
- [ ] Types compile without errors
- [ ] 3+ Zod validation tests

### C.2: Create SendGridClient Service [M - 2h]
**Goal:** Wrapper for SendGrid API with error handling.
**Files:**
- `src/services/SendGridClient.ts` (new)
- `src/__tests__/services/SendGridClient.test.ts` (new)
**Interface:**
```typescript
interface SendGridClient {
  // Core sending
  sendEmail(email: EmailMessage): Promise<{ messageId: string }>;
  sendBatch(emails: EmailMessage[], batchSize?: number): Promise<SendBatchResult>;
  
  // Validation
  validateApiKey(): Promise<boolean>;
  
  // Suppression
  addToSuppressionList(email: string, reason: string): Promise<void>;
  removeFromSuppressionList(email: string): Promise<void>;
  isOnSuppressionList(email: string): Promise<boolean>;
}
```
**Implementation Notes:**
1. Uses `@sendgrid/mail` package (v7.7.0 - verified stable)
2. Rate limit: 10 emails/second (SendGrid limit)
3. Retry transient errors (429, 5xx) with exponential backoff
4. Parse and store message ID from response
5. Never log email body content (PII)
6. **Batch size:** Default 1000 per request (SendGrid limit)
**Tests:**
- API key validation works
- Single email sends successfully (mocked)
- Batch respects rate limit
- Retry on 429 response
- Suppression list operations
**Validation:**
- [ ] 10+ unit tests passing
- [ ] Mock SendGrid API responses

### C.3: Create EmailQueueService [M - 4h]
**Goal:** Persistent queue for reliable email delivery with idempotency.
**Files:**
- `src/services/EmailQueueService.ts` (new)
- `src/__tests__/services/EmailQueueService.test.ts` (new)
**Interface:**
```typescript
interface EmailQueueService {
  // Enqueue (with idempotency)
  enqueue(email: EmailMessage, idempotencyKey?: string): Promise<string>;
  enqueueBatch(emails: EmailMessage[]): Promise<string[]>;
  scheduleEmail(email: EmailMessage, scheduledAt: Date): Promise<string>;
  
  // Process
  processNext(): Promise<EmailQueueItem | null>;
  processBatch(limit?: number): Promise<{ processed: number; failed: number }>;
  
  // Status
  getQueueStats(): Promise<{ pending: number; sending: number; failed: number; scheduled: number }>;
  getItemStatus(queueId: string): Promise<EmailQueueItem | null>;
  
  // Retry & Cancel
  retryFailed(queueId: string): Promise<void>;
  cancelScheduled(queueId: string): Promise<boolean>;
  cancelByProspect(prospectId: string): Promise<number>;
}
```
**Storage:** Firestore collection `email_queue` with TTL (30 days)
**Idempotency:**
1. Use `emailId` or provided `idempotencyKey` as document ID
2. Reject duplicate enqueues with same key (return existing queueId)
3. Log duplicate attempts for debugging
**Processing Logic:**
1. Query pending items where `scheduledAt <= now`
2. Mark as 'sending' with Firestore transaction (prevents double-send)
3. Call SendGridClient.sendEmail()
4. Update status to 'sent' or 'failed'
5. On failure: increment attempts, set backoff delay
6. Max 3 retries for transient errors
7. Dead letter queue for items that fail 3+ times
**Tests:**
- Queue item persists to Firestore (mocked)
- Scheduled items wait until scheduledAt
- Transaction prevents concurrent processing
- Failed items retry with backoff
- Max retries honored
- **Duplicate enqueue returns existing ID (idempotent)**
**Validation:**
- [ ] 12+ unit tests passing
- [ ] Idempotent processing verified

### C.4: Create EmailComplianceService [M - 2h]
**Goal:** CAN-SPAM and GDPR compliance.
**Files:**
- `src/services/EmailComplianceService.ts` (new)
- `src/__tests__/services/EmailComplianceService.test.ts` (new)
**Interface:**
```typescript
interface EmailComplianceService {
  // Validate before sending
  validateEmail(email: EmailMessage): ValidationResult;
  
  // Inject required elements
  injectComplianceElements(email: EmailMessage): EmailMessage;
  
  // Suppression (check before every send)
  isOnSuppressionList(email: string): Promise<boolean>;
  addToSuppressionList(email: string, reason: SuppressionReason): Promise<void>;
  
  // Unsubscribe (use emailId, NOT email address for token security)
  generateUnsubscribeToken(emailId: string): string;
  validateUnsubscribeToken(token: string): { valid: boolean; emailId?: string; expired?: boolean };
  processUnsubscribe(emailId: string): Promise<void>;
  
  // Privacy
  respectDoNotTrack(headers: Record<string, string>): boolean;
}
```
**CAN-SPAM Requirements (Mandatory):**
1. `List-Unsubscribe` header in every email
2. `List-Unsubscribe-Post: List-Unsubscribe=One-Click` header (RFC 8058)
3. Physical mailing address in footer
4. Clear sender identification
5. Working unsubscribe mechanism
**GDPR Requirements:**
1. Record consent source for all contacts
2. Support right to erasure
3. Check "Do Not Track" header for tracking pixel injection
**Token Security (Critical):**
- Token contains `emailId` (NOT email address) to prevent PII exposure in logs
- Resolve email address from database using emailId
- HMAC-SHA256 signed with server secret
- 30-day expiry encoded in token
**Tests:**
- Email without unsubscribe link fails validation
- Headers injected correctly
- Unsubscribe token is cryptographically signed
- **Token does NOT contain email address (check payload)**
- Suppression list checked correctly
- Do Not Track respected
**Validation:**
- [ ] 10+ unit tests passing
- [ ] All outgoing emails pass validation
- [ ] Token inspection reveals no PII

### C.4b: Classify Bounce Types [S - 45min]
**Goal:** Distinguish hard vs soft bounces for correct handling.
**Files:**
- `src/services/EmailComplianceService.ts` - Add bounce classification
**Implementation:**
```typescript
type BounceType = 'hard' | 'soft' | 'unknown';

function classifyBounce(event: SendGridWebhookEvent): BounceType {
  const reason = event.reason?.toLowerCase() || '';
  
  // Hard bounces (permanent - add to suppression)
  if (reason.includes('invalid') || reason.includes('not exist') || 
      reason.includes('rejected') || reason.includes('blocked')) {
    return 'hard';
  }
  
  // Soft bounces (temporary - retry with delay)
  if (reason.includes('mailbox full') || reason.includes('temporarily') ||
      reason.includes('timeout') || reason.includes('deferred')) {
    return 'soft';
  }
  
  return 'unknown'; // Treat as soft by default
}
```
**Handling:**
- Hard bounce → Immediate suppression, cancel sequences
- Soft bounce → Retry up to 3 times over 48 hours
**Tests:**
- Hard bounce keywords classified correctly
- Soft bounce allows retries
**Validation:**
- [ ] 5+ test cases for bounce classification

### C.5: Create Vercel API Route - Email Send [M - 2h]
**Goal:** Serverless endpoint for sending emails.
**Files:**
- `api/email/send.ts` (new)
- `lib/firebaseAdmin.ts` (new) - Firebase Admin SDK initialization
**Endpoint:**
```typescript
// POST /api/email/send
// Body: EmailMessage
// Headers: Authorization: Bearer <firebase-id-token>
// Response: { success: true, queueId: string }
```
**Firebase Admin SDK Setup:**
```typescript
// lib/firebaseAdmin.ts
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

export const adminAuth = getAuth();

// Verify token in API routes:
export async function verifyIdToken(token: string) {
  return adminAuth.verifyIdToken(token);
}
```
**Implementation:**
1. Validate Firebase ID token using Admin SDK
2. Rate limit: 100 requests/minute per user
3. Validate email with EmailComplianceService
4. Check suppression list
5. Enqueue with EmailQueueService
6. Return queue ID immediately
**Security:**
- Firebase Auth required (Admin SDK verification)
- Request body validation with Zod
- CORS restricted to known origins
- No API keys exposed to client
**Tests:**
- Authenticated request succeeds
- Unauthenticated request returns 401
- Invalid email body returns 400
- Suppressed email returns 422 with reason
**Validation:**
- [ ] Endpoint deploys to Vercel
- [ ] 8+ unit tests passing
- [ ] Firebase Admin SDK initialized correctly

### C.6: Create Vercel API Route - Webhook [M - 3h]
**Goal:** Receive SendGrid event webhooks with secure signature validation.
**Files:**
- `api/email/webhook.ts` (new)
- `src/services/EmailEventProcessor.ts` (new)
**Endpoint:**
```typescript
// POST /api/email/webhook
// Headers: X-Twilio-Email-Event-Webhook-Signature, X-Twilio-Email-Event-Webhook-Timestamp
// Body: SendGridWebhookEvent[]
// Response: 200 OK
```
**Signature Validation (using @sendgrid/eventwebhook):**
```typescript
import { EventWebhook } from '@sendgrid/eventwebhook';

const eventWebhook = new EventWebhook();
const publicKey = process.env.SENDGRID_WEBHOOK_SIGNING_KEY;

export default async function handler(req, res) {
  const signature = req.headers['x-twilio-email-event-webhook-signature'];
  const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'];
  const payload = JSON.stringify(req.body);
  
  // Verify signature using SendGrid's official library
  const isValid = eventWebhook.verifySignature(
    publicKey,
    payload,
    signature,
    timestamp
  );
  
  if (!isValid) {
    console.warn('[Webhook] Invalid signature - potential attack');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process events...
}
```
**Security (Critical):**
1. Use `@sendgrid/eventwebhook` for signature verification (don't roll your own)
2. Validate timestamp to prevent replay attacks (reject > 5 min old)
3. Reject invalid signatures with 401
4. Log rejection attempts with request IP for attack detection
5. Rate limit: 1000/minute (SendGrid may burst)
**Event Processing:**
```typescript
async function processEvent(event: SendGridWebhookEvent) {
  switch (event.event) {
    case 'delivered':
      await updateEmailStatus(event.sg_message_id, 'delivered');
      break;
    case 'open':
      await recordEmailEvent('open', event);
      break;
    case 'click':
      await recordEmailEvent('click', event, { url: event.url });
      break;
    case 'bounce':
      const bounceType = classifyBounce(event);
      if (bounceType === 'hard') {
        await addToSuppressionList(event.email, 'bounce');
        await pauseSequences(event.email);
      }
      break;
    case 'spam':
      await addToSuppressionList(event.email, 'spam_report');
      await pauseSequences(event.email);
      break;
    case 'unsubscribe':
      await processUnsubscribe(event.email);
      break;
  }
}
```
```
**Tests:**
- Valid signature accepted
- Invalid signature rejected with 401
- Each event type processed correctly
- Bounce adds to suppression list
**Validation:**
- [ ] Webhook receives events from SendGrid
- [ ] 8+ unit tests passing

### C.7: Create Vercel API Route - Unsubscribe [S - 1.5h]
**Goal:** One-click unsubscribe handling per RFC 8058.
**Files:**
- `api/email/unsubscribe.ts` (new)
- `public/unsubscribe-success.html` (new)
**Endpoints:**
```typescript
// GET /api/email/unsubscribe?token=xxx
// Shows confirmation page

// POST /api/email/unsubscribe?token=xxx
// Body: "List-Unsubscribe=One-Click" (RFC 8058 requirement)
// Processes unsubscribe (one-click RFC 8058)
// Response: 200 OK
```
**RFC 8058 Compliance:**
```typescript
export default async function handler(req, res) {
  const { token } = req.query;
  
  // Validate token
  const validation = emailComplianceService.validateUnsubscribeToken(token);
  if (!validation.valid) {
    return res.status(400).send(validation.expired ? 'Link expired' : 'Invalid link');
  }
  
  if (req.method === 'POST') {
    // RFC 8058 one-click: Validate exact body format
    const body = typeof req.body === 'string' ? req.body : '';
    if (!body.includes('List-Unsubscribe=One-Click')) {
      return res.status(400).json({ error: 'Invalid unsubscribe request format' });
    }
    
    // Process unsubscribe using emailId from token (NOT email in token)
    await emailComplianceService.processUnsubscribe(validation.emailId);
    return res.status(200).send('Unsubscribed');
  }
  
  // GET: Show confirmation page
  return res.redirect('/unsubscribe-success.html');
}
```
**Implementation:**
1. Validate token (HMAC-signed, 30-day expiry)
2. Token contains `emailId` only (resolve email from database)
3. Add email to suppression list
4. Cancel any scheduled emails
5. Pause active sequences
6. Log to analytics
7. Show confirmation page
**Security:**
- Token is HMAC-SHA256 signed with server secret
- Token contains emailId + expiry (NO email address)
- Expired tokens show "Link expired" page
- POST validates exact RFC 8058 body format
**Tests:**
- Valid token unsubscribes successfully
- Invalid token shows error page
- Expired token shows expiry message
- POST without correct body format returns 400
- POST with correct body succeeds
**Validation:**
- [ ] Unsubscribe flow works end-to-end
- [ ] RFC 8058 body validation works
- [ ] 6+ unit tests passing

### C.8: Create Email Tracking Service [M - 2h]
**Goal:** Track opens and clicks.
**Files:**
- `src/services/EmailTrackingService.ts` (new)
- `api/track/open.ts` (new)
- `api/track/click.ts` (new)
**Implementation:**
1. **Inject Tracking:**
   - Add 1x1 pixel: `<img src="/api/track/open?token=xxx" width="1" height="1" />`
   - Rewrite links: `href="/api/track/click?url=xxx&token=yyy"`
2. **Open Tracking:**
   - Return 1x1 transparent GIF
   - Record event in Firestore
   - Deduplicate by emailId
3. **Click Tracking:**
   - Record click with URL
   - Redirect to original URL
**Privacy:**
- Anonymize IP (zero last octet)
- 90-day retention for tracking data
- Add tracking disclosure in footer
**Tests:**
- Tracking pixel injected correctly
- Links rewritten with tokens
- Open event recorded once (deduped)
- Click redirects to original URL
**Validation:**
- [ ] 10+ unit tests passing
- [ ] Tracking pixel returns GIF

### C.9: Create Email Warmup Service [S - 1.5h]
**Goal:** Gradual sending volume increase for new domain with persistent storage.
**Files:**
- `src/services/EmailWarmupService.ts` (new)
- `src/__tests__/services/EmailWarmupService.test.ts` (new)
- `docs/EMAIL_WARMUP_PLAN.md` (new)
**Interface:**
```typescript
interface EmailWarmupService {
  getDailyLimit(): number;
  getRemainingToday(): number;
  canSendNow(): boolean;
  recordSent(): void;
  getWarmupStage(): 'warming' | 'ready';
  getHealthStatus(): { bounceRate: number; spamRate: number; isHealthy: boolean };
}
```
**Persistence (Critical for Serverless):**
- Store warmup state in Firestore `email_warmup` collection
- Track: startDate, dailySentCount, lastSentDate, bounces, spamReports
- Reset dailySentCount at midnight UTC
- Survive Vercel cold starts
**Warmup Schedule:**
| Week | Daily Limit |
|------|-------------|
| 1 | 20 |
| 2 | 50 |
| 3 | 100 |
| 4 | 250 |
| 5+ | Full capacity |
**Health Checks:**
- Pause if bounce rate > 5%
- Pause if spam rate > 0.1%
- Alert if approaching limits
**Tests:**
- Daily limit enforced
- Warmup stage advances after time
- Unhealthy metrics trigger pause
- **State survives across function invocations**
**Validation:**
- [ ] Service limits sending correctly
- [ ] State persists in Firestore
- [ ] Documentation complete

### C.10: Sprint 43 Integration Tests [M - 3h]
**Goal:** Full email flow works end-to-end.
**Files:**
- `src/__tests__/integration/email.test.ts` (new)
**Tests:**
1. Enqueue email → Appears in queue
2. Process queue → SendGrid called (mocked)
3. Webhook received → Status updated
4. Suppressed email → Rejected at enqueue
5. Unsubscribe → Added to suppression, emails cancelled
6. Tracking pixel → Event recorded
7. Warmup limits → Enforced correctly
8. Idempotent enqueue → Same key returns existing ID
9. Hard bounce → Suppression + sequence pause
10. Soft bounce → Retry scheduled
**Validation:**
- [ ] All integration tests pass
- [ ] Manual test: send to personal inbox

### C.11: Sync Suppression List with SendGrid [S - 1h]
**Goal:** Pull bounces/unsubscribes from SendGrid API periodically.
**Files:**
- `src/services/SuppressionSyncService.ts` (new)
**Implementation:**
```typescript
interface SuppressionSyncService {
  syncFromSendGrid(): Promise<{ added: number; removed: number }>;
  getLastSyncTime(): Date | null;
}
```
**Sync Logic:**
1. Fetch global suppressions from SendGrid API
2. Compare with local suppression list
3. Add missing entries to local list
4. Log sync results
5. Run on cron (daily) or on-demand
**Tests:**
- Sync adds new suppressions
- Duplicate entries not duplicated
**Validation:**
- [ ] Sync pulls from SendGrid
- [ ] Local list updated correctly

---

## Dependencies Between Workstreams

```
Workstream A (Sprint 34)           Workstream B (Sprint 36)
├── A.1 (env vars)                 ├── B.1 (selection state)
├── A.2 (callback route)           ├── B.2 (checkboxes) ← B.1
├── A.3 (error states)             ├── B.3 (toolbar component)
├── A.4 (connection test)          ├── B.4 (wire toolbar) ← B.1,B.3
└── A.5 (E2E) ← A.1-A.4            ├── B.5 (sequence) ← B.4
                                   ├── B.6 (export) ← B.4
                                   ├── B.7 (delete) ← B.4
                                   └── B.8 (E2E) ← B.1-B.7

Workstream C (Sprint 43)
├── C.1 (types)
├── C.2 (SendGrid client) ← C.1
├── C.3 (queue service) ← C.1,C.2
├── C.4 (compliance) ← C.1
├── C.5 (send API) ← C.0,C.3,C.4
├── C.6 (webhook API) ← C.0,C.4,C.4b
├── C.7 (unsubscribe) ← C.0,C.4
├── C.8 (tracking) ← C.0,C.1
├── C.9 (warmup) ← C.3
├── C.10 (integration) ← C.1-C.9
└── C.11 (suppression sync) ← C.2,C.4
```

**Cross-Workstream Dependencies:** NONE - All three workstreams can execute independently.

---

## Execution Order Recommendation

### Day 1-2: Foundation (Parallel)
- A.1, A.2, A.3 (HubSpot OAuth foundation)
- B.1, B.2, B.3 (Bulk selection foundation)
- C.0, C.1, C.2 (API scaffold, email types, SendGrid client)

### Day 3-4: Core Implementation (Parallel)
- A.4, A.5, A.6 (HubSpot connection test, E2E, token refresh)
- B.4, B.5, B.5b, B.6 (Wire toolbar and actions)
- C.3, C.4, C.4b (Queue, compliance, bounce classification)

### Day 5-6: API Routes & Integration (Parallel)
- Sprint 34 complete → Demo
- B.7, B.8 (Delete and E2E)
- C.5, C.6, C.7 (Vercel API routes)

### Day 7-8: Finish & Test (Parallel)
- Sprint 36 complete → Demo
- C.8, C.9, C.10, C.11 (Tracking, warmup, integration tests, suppression sync)
- Sprint 43 complete → Demo

---

## Validation Criteria

### Sprint 34 Demo
1. Navigate to Integrations tab
2. Click "Connect HubSpot" → OAuth popup opens
3. (With mock) Complete OAuth → Shows "Connected" with portal ID
4. Refresh page → Connection persists
5. Click "Disconnect" → Shows "Not Connected"
6. Token auto-refreshes before expiry

### Sprint 36 Demo
1. Navigate to Prospects tab
2. Click checkbox → Row selected, toolbar appears
3. Click header checkbox → All selected
4. Click "Export" → CSV downloads
5. Click "Delete" → Confirmation → Delete → Undo restores
6. Click "Assign Sequence" → Modal → Select → Assigned
7. Click "Add Tag" → Modal → Select tags → Tagged

### Sprint 43 Demo
1. Run test: Email sends via SendGrid (mock)
2. Webhook updates status in Firestore
3. Suppression list prevents sending
4. Unsubscribe link works (RFC 8058 compliant)
5. Warmup limits enforced
6. Hard vs soft bounce handled differently

---

## Package Dependencies to Add

```json
{
  "dependencies": {
    "@sendgrid/mail": "^7.7.0",
    "@sendgrid/eventwebhook": "^7.7.0",
    "firebase-admin": "^12.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0"
  }
}
```

---

## Environment Variables Required

```bash
# Firebase Admin (Server-side only - for Vercel)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"..."}'  # Full JSON

# HubSpot OAuth (Sprint 34)
VITE_HUBSPOT_CLIENT_ID=xxx
VITE_HUBSPOT_REDIRECT_URI=https://your-domain.vercel.app/oauth/callback
HUBSPOT_CLIENT_SECRET=xxx  # Server-side only

# SendGrid (Sprint 43)
SENDGRID_API_KEY=SG.xxx  # Server-side only
SENDGRID_WEBHOOK_SIGNING_KEY=xxx  # Server-side only (from SendGrid Event Webhook settings)
SENDGRID_FROM_EMAIL=outreach@yourdomain.com
SENDGRID_FROM_NAME=YardFlow

# Compliance
COMPANY_PHYSICAL_ADDRESS="123 Main St, City, ST 12345"
UNSUBSCRIBE_TOKEN_SECRET=xxx  # Server-side only, min 32 chars
```

---

## Summary of Changes from Review

### Critical Issues Fixed:
1. ✅ A.2: OAuth token exchange now happens server-side (secret never exposed)
2. ✅ C.5: Added Firebase Admin SDK setup with `lib/firebaseAdmin.ts`
3. ✅ C.6: Using `@sendgrid/eventwebhook` for signature validation
4. ✅ C.0: Added API directory scaffolding task
5. ✅ C.7: RFC 8058 one-click unsubscribe body validation added
6. ✅ C.4: Unsubscribe token now uses `emailId` (no PII in token)

### Improvements Added:
1. ✅ B.2: Added accessibility (ARIA, screen reader announcements)
2. ✅ C.2: Fixed package version to ^7.7.0 (verified stable)
3. ✅ C.3: Added idempotency key for duplicate prevention
4. ✅ B.5: Added loading/error states, partial failure handling
5. ✅ C.8: Added "Do Not Track" respect
6. ✅ C.9: Added Firestore persistence for warmup state

### Missing Tasks Added:
1. ✅ C.0: Scaffold API directory and install dependencies
2. ✅ C.11: Sync suppression list with SendGrid
3. ✅ A.6: Implement HubSpot token refresh
4. ✅ B.5b: Wire BulkActionService for tag assignment
5. ✅ C.4b: Classify bounce types (hard vs soft)

### Time Estimate Adjustments:
- A.2: 1h → 2h (server-side token exchange)
- C.3: 3h → 4h (idempotency + edge cases)
- C.6: 2h → 3h (proper signature validation)
- C.10: 2h → 3h (10 test scenarios)
- B.8: 1.5h → 2h (9 test scenarios including a11y)

---

## 🚀 DEPLOYMENT STATUS (January 29, 2026)

### Vercel Environment Variables - Current State

| Variable | Status | Value/Notes |
|----------|--------|-------------|
| `VITE_FIREBASE_API_KEY` | ✅ Set | Client-side Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ Set | gtm-eventops.firebaseapp.com |
| `VITE_FIREBASE_PROJECT_ID` | ✅ Set | gtm-eventops |
| `VITE_FIREBASE_STORAGE_BUCKET` | ✅ Set | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ Set | |
| `VITE_FIREBASE_APP_ID` | ✅ Set | |
| `SENDGRID_API_KEY` | ✅ Set | Production key configured |
| `SENDGRID_FROM_EMAIL` | ✅ Set | noreply@freightroll.com |
| `HUBSPOT_CLIENT_SECRET` | ✅ Set | Server-side only |
| `TRACKING_SECRET` | ✅ Set | Auto-generated (64 hex chars) |
| `UNSUBSCRIBE_HMAC_SECRET` | ✅ Set | Auto-generated (64 hex chars) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | ❌ Missing | **BLOCKS ALL API ENDPOINTS** |
| `SENDGRID_WEBHOOK_PUBLIC_KEY` | ❌ Missing | **BLOCKS WEBHOOK VERIFICATION** |
| `VITE_HUBSPOT_CLIENT_ID` | ❌ Missing | **BLOCKS OAUTH FLOW** |
| `VITE_HUBSPOT_REDIRECT_URI` | ❌ Missing | Should be: `https://gtm-yard-flow.vercel.app/api/oauth/callback` |

### Production URL
- **Primary:** https://gtm-yard-flow.vercel.app
- **Project:** gtm-yard-flow @ caseys-projects-2a50de81

---

## 📋 REMAINING DEPLOYMENT TASKS

### Phase 1: Critical (Blocking All APIs)

#### D.1: Configure Firebase Service Account [15min]
**Status:** ❌ BLOCKING
**Steps:**
1. Go to: [Firebase Console](https://console.firebase.google.com) → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Download JSON file
4. Minify to single line: `cat serviceAccountKey.json | jq -c .`
5. Add to Vercel: `vercel env add FIREBASE_SERVICE_ACCOUNT_KEY production`
**Validation:**
- [ ] `vercel logs` shows no Firebase credential errors
- [ ] `/api/email/send` returns 401 (auth required) not 500 (config error)

#### D.2: Configure HubSpot OAuth Credentials [10min]
**Status:** ❌ BLOCKING
**Steps:**
1. Go to: [HubSpot Developers](https://developers.hubspot.com) → Your App → Auth
2. Copy Client ID
3. Add redirect URI: `https://gtm-yard-flow.vercel.app/api/oauth/callback`
4. Run:
   ```bash
   vercel env add VITE_HUBSPOT_CLIENT_ID production
   echo "https://gtm-yard-flow.vercel.app/api/oauth/callback" | vercel env add VITE_HUBSPOT_REDIRECT_URI production
   ```
**Validation:**
- [ ] HubSpot Settings page shows "Connect" button (not config error)
- [ ] OAuth popup opens with HubSpot authorization page

### Phase 2: Webhook Security

#### D.3: Configure SendGrid Signed Webhooks [10min]
**Status:** ❌ BLOCKING WEBHOOKS
**Steps:**
1. Go to: SendGrid → Settings → Mail Settings → Event Webhook
2. Set HTTP Post URL: `https://gtm-yard-flow.vercel.app/api/email/webhook`
3. Select Events: ✅ Delivered, ✅ Opened, ✅ Clicked, ✅ Bounced, ✅ Spam Reports, ✅ Unsubscribed, ✅ Dropped
4. **Enable "Signed Event Webhook Requests"**
5. Copy Verification Key
6. Run: `vercel env add SENDGRID_WEBHOOK_PUBLIC_KEY production`
**Validation:**
- [ ] Test webhook with `curl -X POST ... -d '[]'` returns 401 (signature required)
- [ ] Real SendGrid events appear in Vercel logs

### Phase 3: Domain Setup

#### D.4: Verify freightroll.com in SendGrid [30min]
**Status:** ⚠️ Required for email sending
**Steps:**
1. Go to: SendGrid → Settings → Sender Authentication → Authenticate Your Domain
2. Add domain: `freightroll.com`
3. Add DNS records (CNAME) as instructed
4. Wait for verification (can take up to 48 hours)
**Validation:**
- [ ] Domain shows "Verified" status in SendGrid
- [ ] Test email sends successfully from noreply@freightroll.com

### Phase 4: Optional Enhancements

#### D.5: Add Compliance Variables [5min]
```bash
echo "123 Main St, Suite 100, San Francisco, CA 94102" | vercel env add COMPLIANCE_POSTAL_ADDRESS production
echo "support@freightroll.com" | vercel env add SUPPORT_EMAIL production
```

#### D.6: Add Custom Domain to Vercel [15min]
If you want to use freightroll.com instead of gtm-yard-flow.vercel.app:
```bash
vercel domains add freightroll.com
# Add DNS records as instructed
```

---

## 🔒 SECURITY REVIEW FINDINGS

### ✅ Well Implemented
1. **Webhook Signature Verification** - Proper ECDSA verification with timestamp staleness check
2. **OAuth CSRF Protection** - State parameter with timing-safe comparison
3. **Raw Body Handling** - `x-vercel-raw-body: true` configured in vercel.json
4. **Rate Limiting** - 100 emails/minute per user limit

### ⚠️ Recommendations
1. **Hardcoded Fallback Secrets** - Code has fallback secrets for local dev. Consider removing in production or failing fast.
2. **XOR Token Encryption** - OAuth tokens use simple XOR. Recommend upgrading to AES-256-GCM.

---

## 📊 TEST STATUS

| Metric | Value |
|--------|-------|
| **Total Tests** | 1,897 |
| **Passing** | 1,893 |
| **Skipped** | 4 (placeholder tests) |
| **Failing** | 0 |
| **Build** | ✅ Successful |

---

## 🎯 QUICK DEPLOYMENT CHECKLIST

```
[ ] D.1: Add FIREBASE_SERVICE_ACCOUNT_KEY
[ ] D.2: Add VITE_HUBSPOT_CLIENT_ID  
[ ] D.2: Add VITE_HUBSPOT_REDIRECT_URI
[ ] D.3: Configure SendGrid webhook URL
[ ] D.3: Enable signed webhooks
[ ] D.3: Add SENDGRID_WEBHOOK_PUBLIC_KEY
[ ] D.4: Verify freightroll.com domain in SendGrid
[ ] Run: vercel --prod
[ ] Verify: vercel logs --follow (no errors)
```

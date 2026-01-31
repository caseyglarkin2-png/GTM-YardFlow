# YardFlow GTM Hub - Sprint Plan V14: COMPLETE ROADMAP

> **Last Updated:** January 31, 2026  
> **North Star:** Maximize meetings booked per day through automated, tracked email sequences  
> **Gate Status:** ✅ Build Passing | ✅ 2,687 Tests Passing | ✅ TypeScript Clean  
> **Reviewed By:** Senior Engineering Subagent (V14.1)

---

## Executive Summary

### Current State ✅

| System | Status | Evidence |
|--------|--------|----------|
| Build | ✅ Passing | 14.61s, 2.1MB bundle |
| Tests | ✅ 2,687 passing | 95 test files, 4 skipped |
| TypeScript | ✅ Clean | `tsc --noEmit` passes |
| Vercel API | ✅ Complete | 27 endpoints across 10 domains |
| Railway Proxy | ✅ Working | Health checks pass, 11 endpoints verified |
| Email Sending | ✅ Complete | Vercel/SendGrid path operational |
| Webhooks | ✅ Complete | SendGrid, Calendly, Inbound (signature enforced in prod) |
| Crons | ✅ Complete | execute-sequences, process-queue @5min |
| Security | ✅ Hardened | Webhook signature enforcement, AI proxy (/api/ai/chat) |
| PWA | ✅ Complete | VitePWA generates manifest.webmanifest |

### Recently Completed (Commit e8d93c2)
- ✅ AI Proxy endpoint (`/api/ai/chat`) - Gemini API key server-side
- ✅ Webhook signature enforcement in production
- ✅ WarmupDashboard wired to `/api/warmup/status`

### API Inventory

#### Vercel Endpoints (27 total)
| Domain | Endpoints | Status |
|--------|-----------|--------|
| `/api/admin` | seed | ✅ |
| `/api/ai` | chat | ✅ |
| `/api/cron` | execute-sequences, process-queue | ✅ |
| `/api/dashboard` | stats | ✅ |
| `/api/email` | send, health, status, inbound, unsubscribe, webhook | ✅ |
| `/api/oauth` | callback, refresh, session, token | ✅ |
| `/api/railway` | [...path] proxy (18+ routes) | ✅ |
| `/api/track` | open, click | ✅ |
| `/api/warmup` | status | ✅ |
| `/api/webhooks` | sendgrid, calendly, inbound | ✅ |

#### Railway Endpoints (via proxy)
| Status | Endpoints |
|--------|-----------|
| ✅ Verified | health, outreach/send-email, outreach/generate-ai, enrichment/email, enrichment/smart-guess, sequences, cron/sequences, ai/content/generate |
| 🔴 Missing | prospects CRUD (7), enrollments (5), email/queue (5), auth (4) |

---

## Test Coverage Analysis

### Services (67 total files)
| Category | Covered | Missing | Coverage |
|----------|---------|---------|----------|
| Core Services | 48 | 19 | 72% |
| Email Services | 4 | 3 | 57% |
| HubSpot Services | 7 | 0 | 100% |
| Infrastructure | 8 | 2 | 80% |

**Missing Service Tests (P2):**
- `RailwayEmailService.ts` - Critical email path
- `MeetingAttributionService.ts` - North Star metric
- `SuppressionSyncService.ts` - Email compliance
- `EmailWarmupService.ts` - Warmup logic
- `EmailTrackingService.ts` - Open/click tracking
- `AuthBridge.ts` - Cross-platform auth
- `SegmentationService.ts` - Prospect filtering

### Components (45 total files)
| Category | Covered | Missing | Coverage |
|----------|---------|---------|----------|
| Components | 1 | 44 | 2% |

**Priority Missing Component Tests (P2):**
- `SequenceManagerPanel.tsx` - Enrollment UI
- `BulkEmailModal.tsx` - Bulk operations
- `ProspectTable.tsx` (if exists) - Main data view
- `WarmupDashboard.tsx` - Warmup visualization
- `EmailQueueStatus.tsx` - Queue visibility

### Hooks (26 total files)
| Category | Covered | Missing | Coverage |
|----------|---------|---------|----------|
| Hooks | 12 | 14 | 46% |

**Missing Hook Tests (P2):**
- `useEmailHealth.ts`
- `useEmailQueueHealth.ts`
- `useRailwayStatus.tsx`
- `useRailwayAuth.tsx`
- `useDeadLetterQueue.ts`
- `useProspects.ts`
- `useProspectSearch.ts`

---

## Sprint Roadmap

### Phase 1: Production Hardening (Sprint 300)
**Goal:** Production-ready with rate limiting and pagination

### Phase 2: Test Coverage (Sprints 301-302)
**Goal:** Achieve 80%+ coverage on critical paths

### Phase 3: UX Polish (Sprints 303-305)
**Goal:** Email analytics, reply inbox, hot list

### Phase 4: Railway Migration (Sprints 306-308)
**Goal:** Railway APIs for prospects, enrollments, email queue

### Phase 5: Advanced Features (Sprints 309-311)
**Goal:** A/B testing, meeting attribution UI, reporting

### Phase 6: Quality & Debt (Sprints 312-314)
**Goal:** Data export, accessibility, tech debt cleanup

---

## Parallel Execution Map

```
Sprint 300 (Production Hardening) ─┬─► Sprint 301 & 302 (Tests - can run parallel)
                                   │
                                   ├─► Sprint 303 & 304 & 305 (UX - can run parallel)
                                   │
                                   └─► Sprint 306 (Railway) ─► 307 ─► 308 (sequential)
                                   
Sprint 309 & 310 & 311 (can run parallel after 303-305)

Sprint 312 & 313 & 314 (can run parallel, any time after 300)
```

---

## Sprint 300: Production Hardening

**Goal:** Rate limiting, pagination, error alerting, observability  
**Demoable Deliverable:** App handles 1000+ prospects without performance degradation  
**Validation:** Load test passes, rate limits enforced  
**Dependencies:** None (foundational sprint)

---

### T300.1: Add Distributed Rate Limiting [L - 4h]
**Files:** `lib/rateLimiter.ts` (new), `api/_middleware.ts`

**Description:**  
Create rate limiter with Upstash Redis for distributed storage across Vercel serverless invocations.
In-memory rate limiting won't work because Vercel functions are stateless.

**Implementation:**
```typescript
// lib/rateLimiter.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Create Redis connection (uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Sliding window rate limiter: 100 requests per minute
export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '60 s'),
  analytics: true,
});

// Fallback for development (in-memory)
const devStore = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  ip: string
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  // Use Upstash in production, in-memory in dev
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const result = await ratelimit.limit(ip);
    return { 
      allowed: result.success, 
      remaining: result.remaining, 
      resetAt: result.reset 
    };
  }
  
  // Dev fallback (same as before)
  const now = Date.now();
  const entry = devStore.get(ip);
  if (!entry || now > entry.resetAt) {
    devStore.set(ip, { count: 1, resetAt: now + 60000 });
    return { allowed: true, remaining: 99, resetAt: now + 60000 };
  }
  if (entry.count >= 100) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count++;
  return { allowed: true, remaining: 100 - entry.count, resetAt: entry.resetAt };
}
```

**Environment Variables Required:**
- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST token

**Tests:**
- Unit: `checkRateLimit` returns false after limit exceeded (mocked Redis)
- Unit: Fallback works when Redis not configured
- Integration: API returns 429 when rate limited

**Commit:** `feat(api): add distributed rate limiting with Upstash`
- Integration: API returns 429 when rate limited

**Commit:** `feat(api): add rate limiting with sliding window`

---

### T300.2: Add Firestore Pagination [M - 2h]
**Files:** `src/services/FirestoreService.ts`, `src/hooks/useProspects.ts`

**Description:**  
Add cursor-based pagination to prevent loading all prospects at once.

**Implementation:**
```typescript
// Add to FirestoreService.ts
export interface PaginatedResult<T> {
  items: T[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}

export async function getPaginatedProspects(
  userId: string,
  pageSize: number = 50,
  startAfterDoc?: DocumentSnapshot
): Promise<PaginatedResult<Prospect>> {
  let q = query(
    collection(db, 'prospects'),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc'),
    limit(pageSize + 1)
  );
  
  if (startAfterDoc) {
    q = query(q, startAfter(startAfterDoc));
  }
  
  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  const hasMore = docs.length > pageSize;
  const items = docs.slice(0, pageSize).map(d => ({ id: d.id, ...d.data() })) as Prospect[];
  const lastDoc = items.length > 0 ? docs[items.length - 1] : null;
  
  return { items, lastDoc, hasMore };
}
```

**Tests:**
- Unit: Pagination returns correct page size
- Unit: `hasMore` is false on last page
- Unit: Cursor continues from correct position
- Integration: UI infinite scroll works

**Commit:** `feat(firestore): add cursor-based pagination`

---

### T300.3: Add Error Alerting Service [S - 1h]
**Files:** `src/services/ErrorTracking.ts`

**Description:**  
Enhance ErrorTracking to emit alerts for critical errors. Integrate with existing Sentry.

**Implementation:**
```typescript
// Add to ErrorTracking.ts
export function captureEmailError(error: Error, context: { prospectId?: string; sequenceId?: string }) {
  Sentry.captureException(error, {
    tags: { domain: 'email' },
    extra: context,
  });
  
  // Also log to console for Vercel logs
  console.error('[EMAIL ERROR]', {
    message: error.message,
    ...context,
    timestamp: new Date().toISOString(),
  });
}

export function captureWebhookError(error: Error, webhook: 'sendgrid' | 'calendly' | 'inbound') {
  Sentry.captureException(error, {
    tags: { domain: 'webhook', webhook },
  });
}
```

**Tests:**
- Unit: Sentry.captureException called with correct tags
- Unit: Console.error includes timestamp

**Commit:** `feat(error): add domain-specific error alerting`

---

### T300.4: Add Request Logging [S - 1h]
**Files:** `lib/logger.ts`, `api/_middleware.ts`

**Description:**  
Structured JSON logging for all API requests.

**Implementation:**
```typescript
// lib/logger.ts - enhance existing
export interface RequestLog {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip: string;
  userAgent?: string;
  userId?: string;
}

export function logRequest(log: RequestLog): void {
  console.log(JSON.stringify({
    type: 'request',
    ...log,
    timestamp: new Date().toISOString(),
  }));
}
```

**Tests:**
- Unit: logRequest outputs valid JSON
- Unit: All required fields present

**Commit:** `feat(logging): add structured request logging`

---

### T300.5: Add Health Check Dashboard [M - 2h]
**Files:** `src/components/SystemHealth.tsx` (new), `src/App.tsx`

**Description:**  
Admin panel showing system health: Railway status, queue depth, warmup status.

**Implementation:**
- Create SystemHealth component with useEffect polling
- Display: Railway health, email queue depth, cron last run, error rate
- Add to Settings/Admin tab

**Tests:**
- Unit: Component renders loading state
- Unit: Component displays error on fetch failure
- Unit: Health indicators show correct colors

**Commit:** `feat(ui): add system health dashboard`

---

### T300.6: Validate Environment Variables on Startup [S - 30min]
**Files:** `src/config/envValidation.ts` (new), `src/main.tsx`

**Description:**  
Fail fast if critical environment variables are missing.

**Implementation:**
```typescript
// src/config/envValidation.ts
const REQUIRED_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
];

export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter(v => !import.meta.env[v]);
  if (missing.length > 0) {
    console.error('[Config] Missing required env vars:', missing);
    // Don't throw in browser - just log warning
  }
}
```

**Tests:**
- Unit: Logs warning when vars missing
- Unit: No error when all vars present

**Commit:** `feat(config): add environment variable validation`

---

### T300.7: Add Web Vitals Baseline [S - 1h]
**Files:** `src/services/WebVitals.ts` (new), `src/main.tsx`

**Description:**  
Track Core Web Vitals to establish performance baseline.

**Implementation:**
```typescript
import { getCLS, getFID, getLCP } from 'web-vitals';

export function reportWebVitals(onReport: (metric: any) => void) {
  getCLS(onReport);
  getFID(onReport);
  getLCP(onReport);
}

// In main.tsx
reportWebVitals((metric) => {
  console.log('[WebVitals]', metric.name, metric.value);
  // TODO: Send to analytics endpoint
});
```

**Commit:** `feat(perf): add Web Vitals baseline tracking`

---

## Sprint 301: Critical Service Tests

**Goal:** 80%+ coverage on email, meeting, suppression services  
**Demoable Deliverable:** Test coverage report shows green on critical paths  
**Validation:** `npm test` shows coverage metrics

---

### T301.1: RailwayEmailService Tests [M - 2h]
**Files:** `src/__tests__/services/RailwayEmailService.test.ts` (new)

**Description:**  
Comprehensive tests for the Railway email service including fallback logic.

**Tests to Implement:**
```typescript
describe('RailwayEmailService', () => {
  describe('isRailwayAvailable', () => {
    it('returns false when RAILWAY_EMAIL_ENABLED is false');
    it('returns false when health check fails');
    it('returns true when enabled and healthy');
  });
  
  describe('sendEmailViaRailway', () => {
    it('sends email successfully');
    it('includes correct headers');
    it('throws on 401 auth error');
    it('retries on 500 error');
  });
  
  describe('sendEmailWithFallback', () => {
    it('uses Railway when available');
    it('falls back to Vercel when Railway fails');
    it('logs fallback usage');
  });
});
```

**Commit:** `test: add RailwayEmailService comprehensive tests`

---

### T301.2: MeetingAttributionService Tests [M - 2h]
**Files:** `src/__tests__/services/MeetingAttributionService.test.ts` (new)

**Description:**  
Tests for the North Star metric - meeting attribution.

**Tests to Implement:**
```typescript
describe('MeetingAttributionService', () => {
  describe('attributeMeeting', () => {
    it('links meeting to prospect by email');
    it('links meeting to sequence if enrolled');
    it('calculates time-to-meeting metric');
    it('handles unmatched meetings gracefully');
  });
  
  describe('getMeetingMetrics', () => {
    it('returns correct meeting count by sequence');
    it('returns average time-to-meeting');
    it('filters by date range');
  });
});
```

**Commit:** `test: add MeetingAttributionService tests`

---

### T301.3: SuppressionSyncService Tests [S - 1h]
**Files:** `src/__tests__/services/SuppressionSyncService.test.ts` (new)

**Description:**  
Tests for email suppression list management.

**Tests to Implement:**
```typescript
describe('SuppressionSyncService', () => {
  describe('addToSuppression', () => {
    it('adds bounce to suppression list');
    it('adds spam report to suppression list');
    it('prevents duplicate entries');
  });
  
  describe('isEmailSuppressed', () => {
    it('returns true for suppressed email');
    it('returns false for valid email');
  });
  
  describe('syncWithSendGrid', () => {
    it('imports SendGrid suppression list');
    it('handles pagination');
  });
});
```

**Commit:** `test: add SuppressionSyncService tests`

---

### T301.4: EmailWarmupService Tests [S - 1h]
**Files:** `src/__tests__/services/EmailWarmupService.test.ts` (new)

**Description:**  
Tests for warmup schedule and daily limit logic.

**Tests to Implement:**
```typescript
describe('EmailWarmupService', () => {
  describe('getDailyLimit', () => {
    it('returns 50 for week 1');
    it('returns 100 for week 2');
    it('returns unlimited after week 4');
  });
  
  describe('canSendEmail', () => {
    it('returns true when under limit');
    it('returns false when at limit');
    it('resets count at midnight');
  });
  
  describe('incrementSentCount', () => {
    it('increments daily count');
    it('updates lastSentAt');
  });
});
```

**Commit:** `test: add EmailWarmupService tests`

---

### T301.5: AuthBridge Tests [S - 1h]
**Files:** `src/__tests__/services/AuthBridge.test.ts` (new)

**Description:**  
Tests for dual authentication bridge.

**Tests to Implement:**
```typescript
describe('AuthBridge', () => {
  describe('getServiceToken', () => {
    it('returns S2S token for service calls');
    it('includes correct headers');
  });
  
  describe('mapFirebaseToRailway', () => {
    it('creates Railway user from Firebase user');
    it('syncs user metadata');
  });
  
  describe('isAuthenticated', () => {
    it('returns true for Firebase auth');
    it('returns true for Railway auth');
    it('returns false when neither');
  });
});
```

**Commit:** `test: add AuthBridge tests`

---

## Sprint 302: Hook & Component Tests

**Goal:** 80%+ coverage on critical hooks, 50%+ on components  
**Demoable Deliverable:** Test report shows improved coverage  
**Validation:** Coverage metrics meet thresholds

---

### T302.1: useEmailHealth Tests [S - 1h]
**Files:** `src/__tests__/hooks/useEmailHealth.test.ts` (new)

**Description:**  
Tests for email health hook.

**Tests to Implement:**
```typescript
describe('useEmailHealth', () => {
  it('fetches health status on mount');
  it('returns loading state initially');
  it('returns healthy when API returns healthy');
  it('returns error on fetch failure');
  it('refreshes at interval');
});
```

**Commit:** `test: add useEmailHealth hook tests`

---

### T302.2: useEmailQueueHealth Tests [S - 1h]
**Files:** `src/__tests__/hooks/useEmailQueueHealth.test.ts` (new)

**Tests to Implement:**
```typescript
describe('useEmailQueueHealth', () => {
  it('returns queue depth');
  it('returns processing rate');
  it('returns error rate');
  it('handles empty queue');
});
```

**Commit:** `test: add useEmailQueueHealth hook tests`

---

### T302.3: useRailwayStatus Tests [S - 1h]
**Files:** `src/__tests__/hooks/useRailwayStatus.test.ts` (new)

**Tests to Implement:**
```typescript
describe('useRailwayStatus', () => {
  it('returns connected when Railway healthy');
  it('returns disconnected when Railway down');
  it('caches health check for 5s');
});
```

**Commit:** `test: add useRailwayStatus hook tests`

---

### T302.4: SequenceManagerPanel Component Tests [M - 2h]
**Files:** `src/__tests__/components/SequenceManagerPanel.test.tsx` (new)

**Description:**  
Tests for the main sequence management UI.

**Tests to Implement:**
```typescript
describe('SequenceManagerPanel', () => {
  it('renders sequence list');
  it('shows empty state when no sequences');
  it('opens create modal on button click');
  it('shows enrollment count per sequence');
  it('handles enroll action');
  it('handles pause action');
});
```

**Commit:** `test: add SequenceManagerPanel component tests`

---

### T302.5: WarmupDashboard Component Tests [S - 1h]
**Files:** `src/__tests__/components/WarmupDashboard.test.tsx` (new)

**Tests to Implement:**
```typescript
describe('WarmupDashboard', () => {
  it('renders warmup progress');
  it('shows current daily limit');
  it('shows sent vs limit');
  it('shows warning at 80% usage');
  it('shows bypass mode when enabled');
});
```

**Commit:** `test: add WarmupDashboard component tests`

---

### T302.6: EmailQueueStatus Component Tests [S - 1h]
**Files:** `src/__tests__/components/EmailQueueStatus.test.tsx` (new)

**Tests to Implement:**
```typescript
describe('EmailQueueStatus', () => {
  it('shows queue depth');
  it('shows processing indicator');
  it('shows dead letter count');
  it('refreshes automatically');
});
```

**Commit:** `test: add EmailQueueStatus component tests`

---

## Sprint 303: Email Analytics UI

**Goal:** Visualize email performance metrics  
**Demoable Deliverable:** Dashboard shows open rates, click rates, reply rates  
**Validation:** Charts display real data from email_events collection

---

### T303.1: Email Analytics Service [M - 2h]
**Files:** `src/services/EmailAnalyticsService.ts` (new or enhance existing)

**Description:**  
Aggregate email events into metrics.

**Implementation:**
```typescript
export interface EmailMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

export async function getEmailMetrics(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<EmailMetrics>;

export async function getMetricsBySequence(
  sequenceId: string
): Promise<EmailMetrics>;

export async function getMetricsTrend(
  userId: string,
  days: number
): Promise<{ date: string; metrics: EmailMetrics }[]>;
```

**Tests:**
- Unit: Calculates rates correctly
- Unit: Handles zero sent (no division by zero)
- Unit: Filters by date range

**Commit:** `feat(analytics): add EmailAnalyticsService`

---

### T303.2: Email Analytics Dashboard [M - 2h]
**Files:** `src/components/EmailAnalyticsDashboard.tsx` (new)

**Description:**  
Dashboard showing email metrics with charts.

**Implementation:**
- Summary cards: Sent, Opened, Clicked, Replied, Bounced
- Line chart: Trend over time (7/30/90 days)
- Bar chart: Performance by sequence
- Table: Top performing emails

**Tests:**
- Unit: Renders all metric cards
- Unit: Charts display with data
- Unit: Date range filter works

**Commit:** `feat(ui): add EmailAnalyticsDashboard`

---

### T303.3: Wire Analytics to App [S - 30min]
**Files:** `src/App.tsx`

**Description:**  
Add EmailAnalyticsDashboard to the Dashboard tab.

**Commit:** `feat(ui): wire EmailAnalyticsDashboard to app`

---

### T303.4: Add Analytics API Endpoint [S - 1h]
**Files:** `api/email/analytics.ts` (new)

**Description:**  
API endpoint for email analytics.

**Implementation:**
```typescript
// GET /api/email/analytics?userId=xxx&startDate=xxx&endDate=xxx
export default async function handler(req, res) {
  const { userId, startDate, endDate } = req.query;
  
  // Query email_events collection
  // Aggregate by event type
  // Calculate rates
  
  return res.json(metrics);
}
```

**Tests:**
- Unit: Returns correct aggregations
- Unit: Handles empty results

**Commit:** `feat(api): add email analytics endpoint`

---

## Sprint 304: Reply Inbox UI

**Goal:** UI for viewing and managing email replies  
**Demoable Deliverable:** Inbox shows replies, OOO detection, sequence pause status  
**Validation:** Replies from email_replies collection displayed

---

### T304.1: Reply Inbox Component [M - 2h]
**Files:** `src/components/ReplyInbox.tsx` (new)

**Description:**  
List view of email replies with filtering.

**Features:**
- List all replies with sender, subject, timestamp
- Filter: All, Human Reply, OOO, Unsubscribe
- Badge: Show if sequence was paused
- Action: Mark as read, link to prospect

**Commit:** `feat(ui): add ReplyInbox component`

---

### T304.2: Reply Detail Modal [S - 1h]
**Files:** `src/components/ReplyDetailModal.tsx` (new)

**Description:**  
Modal showing full reply content and actions.

**Features:**
- Full email body (sanitized HTML)
- Link to prospect profile
- Link to sequence enrollment
- Actions: Mark resolved, resume sequence

**Commit:** `feat(ui): add ReplyDetailModal`

---

### T304.3: useReplyInbox Hook [S - 1h]
**Files:** `src/hooks/useReplyInbox.ts` (new)

**Description:**  
Hook for fetching and filtering replies.

**Implementation:**
```typescript
export function useReplyInbox(options?: {
  type?: 'all' | 'human' | 'ooo' | 'unsubscribe';
  limit?: number;
}) {
  // Subscribe to email_replies collection
  // Apply filters
  // Return { replies, loading, error, markAsRead }
}
```

**Commit:** `feat(hooks): add useReplyInbox hook`

---

### T304.4: Wire Reply Inbox to App [S - 30min]
**Files:** `src/App.tsx`

**Description:**  
Add Reply Inbox to navigation (new tab or within Email section).

**Commit:** `feat(ui): wire ReplyInbox to app`

---

## Sprint 305: Hot List / Daily Briefing

**Goal:** Prioritized view of today's actions  
**Demoable Deliverable:** "Today" view with hot prospects and due sequences  
**Validation:** List shows correct priorities

---

### T305.1: Hot List Service [M - 2h]
**Files:** `src/services/HotListService.ts` (new)

**Description:**  
Calculate today's priority actions.

**Implementation:**
```typescript
export interface HotListItem {
  type: 'reply' | 'meeting' | 'sequence_due' | 'high_score';
  priority: number;
  prospect: Prospect;
  reason: string;
  action: string;
}

export async function getHotList(userId: string): Promise<HotListItem[]>;
```

**Priority Factors:**
1. Unreplied human responses (P0)
2. Meetings scheduled today (P1)
3. Sequences due to send (P2)
4. High score prospects not contacted (P3)

**Commit:** `feat(services): add HotListService`

---

### T305.2: Hot List Component [M - 2h]
**Files:** `src/components/HotList.tsx` (new)

**Description:**  
"Today's Focus" component.

**Features:**
- Grouped by priority
- Click to action
- Dismiss/snooze option
- Count badge in nav

**Commit:** `feat(ui): add HotList component`

---

### T305.3: Wire Hot List to Dashboard [S - 30min]
**Files:** `src/App.tsx`

**Description:**  
Add HotList to top of Dashboard tab.

**Commit:** `feat(ui): wire HotList to dashboard`

---

## Sprint 306: Railway Prospect API

**Goal:** Build Railway endpoints for prospect CRUD  
**Demoable Deliverable:** Vercel can CRUD prospects via Railway  
**Validation:** Integration tests pass  
**Note:** This is cross-repo work (YardFlow-Hitlist)

---

### T306.1: Prospect Schema Migration [S - 1h]
**Repo:** YardFlow-Hitlist  
**Files:** `prisma/migrations/xxx_add_prospect_fields.ts`

**Description:**  
Add missing fields to people table.

```sql
ALTER TABLE people ADD COLUMN tier VARCHAR(20);
ALTER TABLE people ADD COLUMN score INTEGER DEFAULT 0;
ALTER TABLE people ADD COLUMN firebase_id VARCHAR(255);
```

**Commit:** `feat(db): add tier, score, firebase_id to people table`

---

### T306.2: Prospect CRUD Endpoints [M - 2h]
**Repo:** YardFlow-Hitlist  
**Files:** `app/api/prospects/route.ts`, `app/api/prospects/[id]/route.ts`

**Description:**  
Implement REST endpoints.

```
GET    /api/prospects      - List with pagination/filter
POST   /api/prospects      - Create
GET    /api/prospects/:id  - Get one
PUT    /api/prospects/:id  - Update
DELETE /api/prospects/:id  - Soft delete
```

**Commit:** `feat(api): add prospect CRUD endpoints`

---

### T306.3: Update Vercel Proxy [S - 30min]
**Repo:** GTM-YardFlow  
**Files:** `api/railway/[...path].ts`

**Description:**  
Verify `/api/prospects` is in ALLOWED_PATHS (already should be).

**Commit:** `feat(proxy): verify prospects path allowed`

---

### T306.4: Integration Tests [M - 2h]
**Files:** `src/__tests__/integration/railway-prospects.test.ts`

**Description:**  
Test Vercel → Railway prospect operations.

**Commit:** `test: add Railway prospect integration tests`

---

## Sprint 307: Railway Enrollment API

**Goal:** Build Railway endpoints for enrollment management  
**Demoable Deliverable:** Sequences can be managed via Railway  
**Validation:** Integration tests pass

---

### T307.1: Enrollment Endpoints [M - 2h]
**Repo:** YardFlow-Hitlist  
**Files:** `app/api/enrollments/route.ts`, etc.

```
GET    /api/enrollments           - List
POST   /api/enrollments           - Create
GET    /api/enrollments/:id       - Get one
POST   /api/enrollments/:id/pause - Pause
POST   /api/enrollments/:id/resume - Resume
DELETE /api/enrollments/:id       - Stop
```

**Commit:** `feat(api): add enrollment management endpoints`

---

### T307.2: Enrollment State Machine [S - 1h]
**Repo:** YardFlow-Hitlist

**Description:**  
Port SequenceStateMachine logic to Railway.

**Commit:** `feat(services): add enrollment state machine`

---

### T307.3: Update Vercel Proxy [S - 30min]
**Repo:** GTM-YardFlow

**Description:**  
Verify `/api/enrollments` paths are allowed.

**Commit:** `feat(proxy): verify enrollment paths allowed`

---

### T307.4: Integration Tests [M - 2h]
**Files:** `src/__tests__/integration/railway-enrollments.test.ts`

**Commit:** `test: add Railway enrollment integration tests`

---

## Sprint 308: Railway Email Queue API

**Goal:** Queue visibility via Railway  
**Demoable Deliverable:** UI shows queue status from Railway  
**Validation:** Queue status displays correctly

---

### T308.1: Queue Status Endpoint [M - 2h]
**Repo:** YardFlow-Hitlist

```
GET /api/email/queue/status    - Queue depth, processing rate
GET /api/email/queue/dead-letter - Failed emails
POST /api/email/queue/retry/:id - Retry failed email
```

**Commit:** `feat(api): add email queue status endpoints`

---

### T308.2: Queue Dashboard Update [S - 1h]
**Repo:** GTM-YardFlow

**Description:**  
Update EmailQueueStatus to fetch from Railway.

**Commit:** `feat(ui): update EmailQueueStatus for Railway`

---

## Sprint 309: Meeting Attribution UI

**Goal:** Visualize meeting attribution (North Star!)  
**Demoable Deliverable:** Dashboard shows meetings by sequence, time-to-meeting  
**Validation:** Charts show real meeting data

---

### T309.1: Meeting Attribution Dashboard [M - 2h]
**Files:** `src/components/MeetingAttributionDashboard.tsx` (new)

**Features:**
- Meetings booked this week/month
- By sequence (which sequences book meetings?)
- Time to meeting (avg days from first email)
- Funnel: Sent → Opened → Replied → Meeting

**Commit:** `feat(ui): add MeetingAttributionDashboard`

---

### T309.2: Attribution API [M - 2h]
**Files:** `api/meetings/attribution.ts` (new)

**Description:**  
API for meeting attribution metrics.

**Commit:** `feat(api): add meeting attribution endpoint`

---

### T309.3: Wire to Dashboard [S - 30min]
**Files:** `src/App.tsx`

**Commit:** `feat(ui): wire MeetingAttributionDashboard to app`

---

## Sprint 310: A/B Testing Framework

**Goal:** Subject line and content A/B tests  
**Demoable Deliverable:** Create A/B test, view results  
**Validation:** Tests run and metrics collected

---

### T310.1: A/B Test Service [M - 2h]
**Files:** `src/services/ABTestService.ts` (new)

```typescript
export interface ABTest {
  id: string;
  name: string;
  type: 'subject' | 'content' | 'send_time';
  variants: Variant[];
  status: 'draft' | 'running' | 'completed';
  winningVariant?: string;
}

export function createTest(test: ABTest): Promise<ABTest>;
export function assignVariant(testId: string, prospectId: string): Promise<Variant>;
export function recordResult(testId: string, variantId: string, metric: string): Promise<void>;
export function getTestResults(testId: string): Promise<TestResults>;
```

**Commit:** `feat(services): add ABTestService`

---

### T310.2: A/B Test UI [M - 2h]
**Files:** `src/components/ABTestManager.tsx` (new)

**Features:**
- Create test with variants
- View live results
- Pick winner and apply

**Commit:** `feat(ui): add ABTestManager component`

---

### T310.3: Integration with Email Send [S - 1h]
**Files:** `src/services/RailwayEmailService.ts`

**Description:**  
When sending, check for active A/B tests and assign variant.

**Commit:** `feat(email): integrate A/B testing`

---

## Phase 6: Tech Debt & Cleanup (Sprint 311)

**Goal:** Clean code, remove unused, improve performance

---

### T311.1: Remove Console.log Statements [S - 1h]
**Description:**  
Replace with structured logger calls.

**Commit:** `chore: replace console.log with structured logging`

---

### T311.2: Bundle Size Optimization [M - 2h]
**Description:**  
Analyze and reduce bundle size. Lazy load charts.

**Commit:** `perf: optimize bundle size`

---

### T311.3: Remove Unused Code [S - 1h]
**Description:**  
Find and remove dead code.

**Commit:** `chore: remove unused code`

---

### T311.4: Documentation Update [S - 1h]
**Description:**  
Update PLATFORM_ARCHITECTURE.md with all changes.

**Commit:** `docs: update architecture documentation`

---

## Priority Matrix

| Priority | Sprint | Focus |
|----------|--------|-------|
| P0 | 300 | Production Hardening |
| P1 | 301-302 | Test Coverage |
| P1 | 303-305 | Email Analytics, Reply Inbox, Hot List |
| P2 | 306-308 | Railway APIs (cross-repo) |
| P2 | 309-311 | Meeting Attribution, A/B Testing, Tech Debt |
| P3 | 312 | Data Export |
| P3 | 313 | Accessibility (a11y) |
| P3 | 314 | Performance Optimization |

---

## Sprint 312: Data Export/Import

**Goal:** User-facing data export for prospects and analytics  
**Demoable Deliverable:** Export button downloads CSV  
**Validation:** CSV opens correctly in Excel

---

### T312.1: Export Prospects to CSV [M - 2h]
**Files:** `src/services/ExportService.ts` (enhance), `src/components/ExportButton.tsx` (new)

**Description:**  
Add export functionality for prospect data with column selection.

**Implementation:**
```typescript
export async function exportProspectsToCSV(
  prospects: Prospect[],
  columns: string[]
): Promise<Blob> {
  const headers = columns.join(',');
  const rows = prospects.map(p => 
    columns.map(c => JSON.stringify(p[c] ?? '')).join(',')
  );
  return new Blob([headers, ...rows].join('\n'), { type: 'text/csv' });
}
```

**Tests:**
- Unit: CSV has correct headers
- Unit: Handles special characters (commas, quotes)
- Unit: Empty prospects returns headers only

**Commit:** `feat(export): add prospect CSV export`

---

### T312.2: Export Email Analytics [S - 1h]
**Files:** `src/services/ExportService.ts`

**Description:**  
Export email metrics by date range.

**Commit:** `feat(export): add email analytics CSV export`

---

### T312.3: Bulk Import Improvements [M - 2h]
**Files:** `src/components/ImportWizard.tsx`

**Description:**  
Improve import UX with:
- Field mapping preview
- Duplicate detection before import
- Import progress indicator
- Error row highlighting

**Commit:** `feat(import): improve bulk import UX`

---

## Sprint 313: Accessibility (a11y)

**Goal:** WCAG 2.1 AA compliance  
**Demoable Deliverable:** axe-core shows zero critical issues  
**Validation:** Screen reader navigation works

---

### T313.1: Run a11y Audit [M - 2h]
**Files:** `src/__tests__/a11y/audit.test.ts` (new)

**Description:**  
Integrate axe-core into test suite, audit all main views.

**Implementation:**
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Accessibility', () => {
  it('Dashboard has no violations', async () => {
    const { container } = render(<Dashboard />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

**Commit:** `test: add axe-core accessibility audit`

---

### T313.2: Fix Critical a11y Issues [L - 4h]
**Files:** Various components

**Common Issues to Fix:**
- Missing alt text on images
- Color contrast issues
- Missing form labels
- Missing ARIA landmarks
- Focus order issues

**Commit:** `fix(a11y): resolve critical accessibility violations`

---

### T313.3: Add Keyboard Navigation Tests [M - 2h]
**Files:** `e2e/accessibility.spec.ts`

**Description:**  
E2E tests for keyboard-only navigation.

**Tests:**
- Tab through all interactive elements
- Escape closes modals
- Enter activates buttons
- Arrow keys navigate lists

**Commit:** `test: add keyboard navigation e2e tests`

---

## Sprint 314: Performance Optimization

**Goal:** Reduce bundle size, improve load time  
**Demoable Deliverable:** Lighthouse performance score >90  
**Validation:** Web Vitals within targets

---

### T314.1: Add Web Vitals Monitoring [S - 1h]
**Files:** `src/services/WebVitals.ts` (new)

**Description:**  
Track Core Web Vitals (LCP, FID, CLS) and send to analytics.

**Implementation:**
```typescript
import { getCLS, getFID, getLCP, getFCP, getTTFB } from 'web-vitals';

export function reportWebVitals() {
  getCLS(console.log);
  getFID(console.log);
  getLCP(console.log);
  getFCP(console.log);
  getTTFB(console.log);
}
```

**Commit:** `feat(perf): add Web Vitals monitoring`

---

### T314.2: Lazy Load Charts [M - 2h]
**Files:** `src/App.tsx`, chart components

**Description:**  
Dynamic import Recharts to reduce initial bundle.

```typescript
const SequenceComparison = lazy(() => import('./components/SequenceComparison'));
```

**Commit:** `perf: lazy load chart components`

---

### T314.3: Bundle Analysis and Optimization [M - 2h]
**Files:** `vite.config.ts`

**Description:**  
Run bundle analyzer, identify and fix large dependencies.

**Targets:**
- Remove unused lodash imports
- Tree-shake Firebase
- Split vendor chunks

**Commit:** `perf: optimize bundle size`

---

### T314.4: Image Optimization [S - 1h]
**Description:**  
Add image optimization for any static assets.

**Commit:** `perf: optimize static images`

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Test Coverage | 72% services, 2% components | 85% services, 50% components |
| Build Time | 15s | <10s |
| Bundle Size | 2.1MB | <1.5MB |
| API Response Time | Unknown | <200ms p95 |
| Email Delivery Rate | Unknown | >95% |
| Meeting Attribution | Manual | Automated |
| Lighthouse Score | Unknown | >90 |
| a11y Violations | Unknown | 0 critical |

---

## Environment Variables Checklist

### Required for Production
```
# Firebase
FIREBASE_API_KEY
FIREBASE_PROJECT_ID

# SendGrid
SENDGRID_API_KEY
SENDGRID_WEBHOOK_VERIFICATION_KEY

# Calendly
CALENDLY_WEBHOOK_SECRET

# Railway
RAILWAY_API_URL
SERVICE_TO_SERVICE_SECRET

# AI
GEMINI_API_KEY

# Sentry
SENTRY_DSN

# Rate Limiting (new)
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

### Feature Flags
```
VITE_RAILWAY_ENABLED=false
VITE_RAILWAY_EMAIL_ENABLED=false
VITE_RAILWAY_AUTH_ENABLED=false
BYPASS_EMAIL_WARMUP=false
```

---

## Appendix: File Reference

### Critical Files by Domain

**Email:**
- `src/services/RailwayEmailService.ts`
- `src/services/EmailQueueService.ts`
- `src/services/EmailWarmupService.ts`
- `api/email/send.ts`
- `api/webhooks/sendgrid.ts`

**Sequences:**
- `src/services/SequenceSchedulerService.ts`
- `src/services/SequenceStateMachine.ts`
- `src/hooks/useSequenceEnrollment.ts`
- `api/cron/execute-sequences.ts`

**Meetings:**
- `src/services/MeetingAttributionService.ts`
- `api/webhooks/calendly.ts`

**Auth:**
- `src/services/AuthBridge.ts`
- `src/config/featureFlags.ts`

**Infrastructure:**
- `api/_middleware.ts`
- `lib/logger.ts`
- `lib/rateLimiter.ts` (new in S300)

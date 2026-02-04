# Copilot Instructions — GTM-YardFlow

## Purpose
Sales automation platform: **enroll prospects → send tracked email sequences → book meetings**.
Calendly handles scheduling — no calendar integration needed.

## For AI Coding Agents (Quick Start)

- **Role:** act like a precise pair-programmer—make small, correct edits, run tests, and iterate.
- **Required tools:** always use `manage_todo_list` to plan multi-step work and `apply_patch` to edit files.
- **Before any tool call:** send a one-line preamble stating what you're about to do (one sentence).
- **Edit workflow:** use `apply_patch` with the repo-style diff format; do not output file contents directly.
- **Verify changes:** run `npx tsc --noEmit` and `npm test -- --run` (or `npm run test` for watch) after edits.
- **Patch example (use apply_patch):**

```
*** Update File: src/some/file.ts
@@
 -const x = 1
 +const x = 2
```

- **Patches should be minimal** and focused on the requested change; avoid unrelated reformatting.
- **When done:** ask for feedback and next steps; include which tests you ran and their results.

## Current Sprint Status

| Sprint | Focus | Status |
|--------|-------|--------|
| 22A/B | Bulk Email + Sequence Fallback | ✅ Complete |
| 23 | Railway S2S Auth | ✅ Complete |
| **24** | **Railway Email Activation** | 🚀 **ACTIVE** |

*Last updated: 2026-02-02*

**Sprint 24 Phases** (see [SPRINT_PLAN_V24_EMAIL_ACTIVATION.md](../SPRINT_PLAN_V24_EMAIL_ACTIVATION.md)):
- S0: Secrets verification → S1: E2E email test → S1.5: Compliance gates → S2: Frontend integration → S3: Error handling → S4: Monitoring

## Architecture

### Two-Repo Platform
| Repo | Platform | Role |
|------|----------|------|
| **GTM-YardFlow** (this) | Vercel | React SPA, Firebase Auth/Firestore, API proxy, webhooks |
| **YardFlow-Hitlist** | Railway | Next.js backend, Postgres, Redis, SendGrid |

### Data Flow
\`\`\`
User → Vercel SPA → api/railway/[...path].ts → Railway → SendGrid
                                                     ↓
                                      api/webhooks/* ← webhooks
                                                     ↓
                                                  Firestore
\`\`\`

## Critical Patterns

### Feature Flags (ALWAYS use these)
\`\`\`typescript
import { shouldUseRailwayEmail, featureFlags } from '@/config/featureFlags';

// ✅ Correct: use flag helpers
if (shouldUseRailwayEmail()) { sendViaRailway(); }

// ❌ Wrong: ad-hoc env checks
if (import.meta.env.VITE_RAILWAY_ENABLED) { ... }
\`\`\`
All flags: \`src/config/featureFlags.ts\` — controlled via \`VITE_*\` env vars.

### Railway API Calls
- **Browser → Railway**: Always through \`railwayClient\` which proxies via \`api/railway/[...path].ts\`
- **Server → Railway**: Use \`lib/railway-client.ts\` with S2S auth via \`PLATFORM_TO_PLATFORM_SECRET\`
\`\`\`typescript
// Browser: use typed client
import { railwayClient } from '@/services/RailwayApiClient';
const result = await railwayClient.prospects.list({ status: 'new' });

// Vercel API route: use server client
import { railwayServerClient } from '@/lib/railway-client';
const data = await railwayServerClient.get('/api/prospects');
\`\`\`

### Logging Pattern
\`\`\`typescript
import { logger } from '@/lib/logger';

// ✅ Correct: error() takes (message, error?, context?)
logger.error('Failed', error instanceof Error ? error : undefined, { userId });
logger.info('Success', { count: 10 }); // info/warn take (message, context?)

// ❌ Wrong: passing unknown to error position
logger.error('Failed', someUnknown);
\`\`\`

### Auth Bridge (Firebase → Railway)
\`\`\`typescript
import { getOrCreateRailwaySession, ensureValidSession } from '@/services/AuthBridge';

// Get or refresh Railway session from Firebase token
const session = await getOrCreateRailwaySession();
// Proactive refresh (call before Railway API calls)
await ensureValidSession();
\`\`\`
Sessions cached in \`sessionStorage\`, auto-refresh 5 min before expiry.

## Service Layer

<details>
<summary><strong>🔐 Auth & Railway</strong></summary>

| Service | Key Methods |
|---------|-------------|
| \`AuthBridge.ts\` | \`getOrCreateRailwaySession()\`, \`ensureValidSession()\`, \`isRailwayAvailable()\` |
| \`HubSpotAuthService.ts\` | \`getAuthUrl()\`, \`exchangeCode()\`, \`refreshToken()\` |
| \`RailwayApiClient.ts\` | \`prospects.*\`, \`sequences.*\`, \`enrollments.*\`, \`health.*\` |
| \`RailwayEmailService.ts\` | \`sendEmailViaRailway()\`, \`isRailwayAvailable()\` |

</details>

<details>
<summary><strong>📧 Email & Sequences</strong></summary>

| Service | Key Methods |
|---------|-------------|
| \`EmailQueueService.ts\` | \`queueEmail()\`, \`processQueue()\`, \`getQueueStatus()\` |
| \`EmailSequenceService.ts\` | \`enrollProspect()\`, \`pauseEnrollment()\`, \`resumeEnrollment()\` |
| \`EmailComplianceService.ts\` | \`checkSuppression()\`, \`addToSuppressionList()\` |
| \`EmailTrackingService.ts\` | \`recordOpen()\`, \`recordClick()\`, \`generateTrackingPixel()\` |
| \`SequenceStateMachine.ts\` | \`canTransition()\`, \`transition()\`, \`isTerminal()\` |
| \`SequenceSchedulerService.ts\` | \`scheduleNextStep()\`, \`executeStep()\` |
| \`SequenceAnalyticsService.ts\` | \`getReplyRate()\`, \`getEnrollmentMetrics()\` |
| \`OutOfOfficeDetector.ts\` | \`detectOOO()\`, \`getResumeDate()\`, \`shouldPauseForOOO()\` |

</details>

<details>
<summary><strong>📊 Data & Import</strong></summary>

| Service | Key Methods |
|---------|-------------|
| \`FirestoreService.ts\` | \`getProspects()\`, \`updateProspect()\`, \`subscribeToProspects()\` |
| \`CsvParserService.ts\` | \`parseCsv()\`, \`previewCsv()\`, \`validateCsvStructure()\` |
| \`ColumnMapperService.ts\` | \`autoDetectMapping()\`, \`applyMapping()\` |
| \`DuplicateDetector.ts\` | \`findDuplicates()\`, \`normalizeEmail()\` |
| \`HotListScoringService.ts\` | \`calculateHotListScore()\`, \`getTopProspects()\` |
| \`PrimoLookalikeScoring.ts\` | \`calculatePrimoLookalikeScore()\`, \`getPrimoTier()\` |

</details>

<details>
<summary><strong>⚙️ Platform & Operations</strong></summary>

| Service | Key Methods |
|---------|-------------|
| \`AnalyticsAggregator.ts\` | \`aggregate()\`, \`getTimeSeries()\` |
| \`TimezoneService.ts\` | \`inferTimezone()\`, \`isBusinessHoursForProspect()\` |
| \`TenantService.ts\` | \`createTenant()\`, \`switchTenant()\`, \`checkPermission()\` |
| \`AuditLogService.ts\` | \`logAction()\`, \`getAuditLog()\` |
| \`PDFReportService.ts\` | \`generateReport()\`, \`exportPipeline()\` |
| \`BulkActionService.ts\` | \`tagMany()\`, \`enrollMany()\`, \`updateStatusMany()\` |
| \`BulkDeleteService.ts\` | \`deleteMany()\`, \`queueDelete()\` |
| \`ErrorTracking.ts\` | \`captureException()\`, \`setUser()\` |
| \`OfflineQueue.ts\` | \`enqueue()\`, \`processQueue()\`, \`getPending()\` |

</details>

## Webhook Handlers (\`api/webhooks/\`)

| Endpoint | Events | Purpose |
|----------|--------|---------|
| \`sendgrid.ts\` | \`delivered\`, \`open\`, \`click\`, \`bounce\`, \`spamreport\`, \`unsubscribe\` | Email tracking → Firestore + suppression list |
| \`calendly.ts\` | \`invitee.created\`, \`invitee.canceled\` | **NORTH STAR** — Meeting attribution, sequence auto-stop |
| \`inbound.ts\` | SendGrid Inbound Parse | Reply detection, OOO classification, sequence pause/stop |

### Webhook → Railway Sync Pattern
Webhooks update BOTH Firestore (source of truth) AND Railway (for email engine sync):
\`\`\`typescript
import { railwayServerClient } from '../../lib/railway-client';

// After Firestore update, sync to Railway if enrollment exists there
if (enrollment.railwayEnrollmentId) {
  await railwayServerClient.patch(\`/api/enrollments/\${enrollment.railwayEnrollmentId}\`, {
    status: 'meeting', // or 'replied', 'paused'
    completionReason: 'meeting_booked',
  });
}
\`\`\`

## API Endpoints

| Path | Method | Purpose |
|------|--------|---------|
| \`/api/health\` | GET | Uptime monitoring, detailed checks optional |
| \`/api/railway/[...path]\` | ALL | Proxy to Railway with auth, rate limiting |
| \`/api/email/send\` | POST | Queue email for sending |
| \`/api/email/stats\` | GET | Email performance stats |
| \`/api/email/unsubscribe\` | GET/POST | CAN-SPAM unsubscribe handling |
| \`/api/track/open\` | GET | 1x1 pixel tracking |
| \`/api/track/click\` | GET | Click tracking redirect |
| \`/api/cron/process-queue\` | GET/POST | Process pending email queue (5-min) |
| \`/api/cron/execute-sequences\` | GET/POST | Execute due sequence steps (5-min) |
| \`/api/dashboard/briefing\` | GET | Daily briefing metrics |

### Railway AI Endpoints (via proxy)

| Railway Path | Method | Purpose |
|--------------|--------|---------|
| \`/api/ai/content/generate\` | POST | Generate email content |
| \`/api/ai/dossier/generate\` | POST | Generate company dossier |
| \`/api/ai/dossier/refresh\` | POST | Force refresh stale dossiers |
| \`/api/ai/research/batch\` | POST | Batch research up to 10 companies |
| \`/api/ai/status\` | GET | AI provider health (requires auth) |
| \`/api/ai/conversations\` | GET/POST/DELETE | Conversation CRUD for multi-turn |

**Conversation Continuity**: Pass \`conversationId\` in chat requests for multi-turn memory.

## Enrollment State Machine

\`\`\`
                     ┌─────────────────────────────────┐
                     │            active               │
                     │  (receiving sequence emails)    │
                     └─────────────────────────────────┘
                        │      │      │      │      │
    Manual Pause ───────┘      │      │      │      └─── User Cancel
    Soft Bounce ───────────────┘      │      │
    OOO Detected ─────────────────────┘      └─────── Hard Bounce
                                   │                      │
              All Steps Done ──────┼──────────────────────┘
                                   ▼
     ┌──────────┐   ┌─────────────┐   ┌─────────┐   ┌─────────┐
     │  paused  │   │  completed  │   │ bounced │   │ replied │
     └──────────┘   └─────────────┘   └─────────┘   └─────────┘
          │                                               │
   Resume │                                               │
          ▼                                               ▼
     ┌──────────┐                                   ┌─────────┐
     │  active  │                                   │ meeting │ ← Calendly webhook
     └──────────┘                                   └─────────┘
\`\`\`

**Terminal States**: \`completed\`, \`cancelled\`, \`replied\`, \`bounced\`, \`meeting\`

**Key Triggers**:
- Reply detected → \`replied\` (sequence stops)
- Calendly webhook → \`meeting\` (sequence stops)
- Hard bounce → \`bounced\` (sequence stops)
- OOO detected → \`paused\` (auto-resume on return date)
- All steps sent → \`completed\`

## Key Files
| Purpose | Location |
|---------|----------|
| Feature flags | \`src/config/featureFlags.ts\` |
| Railway typed client | \`src/services/RailwayApiClient.ts\` |
| Railway proxy | \`api/railway/[...path].ts\` |
| Railway server client | \`lib/railway-client.ts\` |
| Auth bridge | \`src/services/AuthBridge.ts\` |
| State machine | \`src/services/SequenceStateMachine.ts\` |
| Webhooks | \`api/webhooks/{sendgrid,inbound,calendly}.ts\` |
| Crons | \`api/cron/{process-queue,execute-sequences}.ts\` |
| Types | \`src/types/{railway,email,emailSequence}.ts\` |
| Tier adapter | \`src/utils/tierAdapter.ts\` |
| Prospect mapper | \`src/utils/prospectMapper.ts\` |
| Alerting | \`lib/alerting.ts\` |
| Logger | \`lib/logger.ts\` |
| Railway mock (tests) | \`src/__tests__/mocks/railwayServerClient.mock.ts\` |

## Desktop UI Components (Sprint 700+)

**Status: Desktop layout integrated, App.tsx decomposition in progress (Sprint 901).**

### Icons (INP Fix)
\`\`\`typescript
// ✅ Correct: Use LazyIcon for icons
import { LazyIcon } from '@/components/icons';
<LazyIcon name="Menu" className="h-6 w-6" />

// ❌ Wrong: Direct Lucide imports cause INP blocking
import { Menu } from 'lucide-react';
\`\`\`

### Layout Components (\`src/components/layout/\`)
| Component | Purpose |
|-----------|---------|
| DesktopLayout | CSS Grid layout: sidebar + main content |
| NavigationSidebar | Vertical nav with keyboard support, collapsible |
| SidebarContent | Navigation items + Railway status indicator |
| SplitPane | Resizable panels for builders (sequences, etc.) |
| AppLayout | App shell wrapper (responsive) |

### State Management
\`\`\`typescript
// AppContext provides global state - wrap app in AppProvider
import { useAppContext, AppProvider } from '@/context/AppContext';
const { activeTab, setActiveTab, isSidebarOpen, toggleSidebar } = useAppContext();

// Navigation config is centralized
import { NAVIGATION_TABS, type TabId } from '@/config/navigation';
// TabIds: 'dashboard' | 'prospects' | 'sequences' | 'import' | 'integrations' | 'ai' | 'roiCalculator'
\`\`\`

### Responsive Hooks
\`\`\`typescript
import { useIsDesktop, useMediaQuery } from '@/hooks/useMediaQuery';
const isDesktop = useIsDesktop(); // true if >= 1024px
\`\`\`

## Test Structure
\`\`\`
src/__tests__/
├── api/           # API endpoint tests (webhooks, CSRF, tracking)
├── components/    # React component tests (RTL)
├── hooks/         # Custom hook tests
├── services/      # Service unit tests
├── utils/         # Utility function tests (tierAdapter, prospectMapper)
├── mocks/         # Shared mocks (Firebase, Railway, PWA)
└── setup.ts       # Global test setup (Firebase mocks)
\`\`\`

### Test Patterns
\`\`\`typescript
// Tests use Vitest + React Testing Library
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock Railway client
vi.mock('@/services/RailwayApiClient', () => ({
  railwayClient: { prospects: { list: vi.fn() } }
}));

// Railway API response pattern (always wrap in ok/data)
mockFn.mockResolvedValue({ ok: true, data: { items: [] } });
\`\`\`

### Railway Server Mock for Webhook Tests
\`\`\`typescript
// For testing webhook Railway sync (api/webhooks/*.ts)
import { 
  mockRailwayServerClient, 
  resetRailwayMocks,
  simulateRailwayFailure,
  assertRailwaySyncedEnrollment 
} from '../mocks/railwayServerClient.mock';

vi.mock('../../lib/railway-client', () => ({
  railwayServerClient: mockRailwayServerClient,
}));

beforeEach(() => resetRailwayMocks()); // Always reset between tests!

// Assert Railway received correct sync payload
assertRailwaySyncedEnrollment('enrollment-123', {
  status: 'meeting',
  completionReason: 'meeting_booked',
});

// Test error resilience
simulateRailwayFailure('patch');
// Firestore should still update even if Railway fails
\`\`\`

## Common Gotchas

### ❌ Don't: Pass \`unknown\` to logger.error()
\`\`\`typescript
// WRONG - TypeScript won't catch this
logger.error('Failed', someUnknown);

// CORRECT
logger.error('Failed', someUnknown instanceof Error ? someUnknown : undefined, { raw: someUnknown });
\`\`\`

### ❌ Don't: Call Railway directly from browser
\`\`\`typescript
// WRONG - exposes backend URL, no auth
fetch('https://railway.example.com/api/prospects');

// CORRECT - use proxy
import { railwayClient } from '@/services/RailwayApiClient';
\`\`\`

### ❌ Don't: Skip suppression check before sending
\`\`\`typescript
// WRONG - will send to bounced/unsubscribed emails
await sendEmail(to, subject, body);

// CORRECT
const suppressed = await compliance.checkSuppression(to);
if (suppressed) return;
\`\`\`

### ❌ Don't: Use inconsistent tier types without adapter
\`\`\`typescript
// ❌ WRONG - raw string comparison across systems
if (prospect.tier === 'T1') { /* Firestore format */ }
if (railwayProspect.tier === 'Tier 1') { /* Railway format */ }

// ✅ CORRECT - use tier adapter utilities
import { toRailwayTier, toFirestoreTier, isFirestoreTier } from '@/utils/tierAdapter';
const railwayTier = toRailwayTier('T1'); // 'Tier 1'
const firestoreTier = toFirestoreTier('Tier 1'); // 'T1'

// For prospect data conversion between systems:
import { toRailwayProspect, toFirestoreProspect } from '@/utils/prospectMapper';
\`\`\`

### ❌ Don't: Create Firebase Admin multiple times
\`\`\`typescript
// WRONG - will crash
import { initializeApp } from 'firebase-admin/app';
initializeApp();

// CORRECT - use singleton
import { getAdminDb } from '@/lib/firebaseAdmin';
\`\`\`

## Developer Workflow
\`\`\`bash
npm run dev           # Vite dev server (port 5173)
npm run build         # tsc + vite build (fails on type errors!)
npm test              # Vitest watch mode
npm test -- --run     # Single run (CI)
npm run test:e2e      # Playwright
npx tsc --noEmit      # Type check only
\`\`\`

## Environment Variables
| Variable | Purpose |
|----------|---------|
| `VITE_RAILWAY_ENABLED` | Master Railway toggle (client-side) |
| `VITE_RAILWAY_EMAIL_ENABLED` | Route email via Railway |
| `VITE_RAILWAY_DATA_ENABLED` | Route data via Railway Postgres |
| `RAILWAY_API_URL` | Railway backend URL |
| `RAILWAY_API_SECRET` | **Must match Railway's `CRON_SECRET`** |
| `SERVICE_TO_SERVICE_SECRET` | S2S auth (fallback for RAILWAY_API_SECRET) |
| `CRON_SECRET` | Cron job auth (fallback for RAILWAY_API_SECRET) |
| `SENDGRID_API_KEY` | Email sending |
| `SENDGRID_WEBHOOK_VERIFICATION_KEY` | Webhook signature verification |
| `CALENDLY_WEBHOOK_SECRET` | Calendly webhook verification |
| `ALERT_WEBHOOK_URL` | Slack/Teams webhook for alerts |

### Critical: S2S Auth Secret Alignment
The Railway proxy (`api/railway/[...path].ts`) uses this priority:
```typescript
const RAILWAY_API_SECRET = process.env.RAILWAY_API_SECRET || process.env.CRON_SECRET;
```
**All three secrets must have the same value** for S2S auth to work:
- Vercel: `RAILWAY_API_SECRET` 
- Vercel: `CRON_SECRET`
- Railway: `CRON_SECRET`

## Cron Jobs (vercel.json)
- \`/api/cron/process-queue\` — Every 5 min, email queue processing
- \`/api/cron/execute-sequences\` — Every 5 min, sequence step execution

Both have 60s timeout, require \`CRON_SECRET\` header matching Railway's.

## What NOT to Build
- ❌ Calendar integration — Calendly handles this
- ❌ Complex CRM sync — Firestore is the CRM
- ❌ Over-engineered analytics — track send/reply/bounce/meeting only

## Key Docs
- \`docs/RUNBOOK.md\` — Production operations
- \`docs/DEPLOYMENT.md\` — Deployment checklist
- \`docs/api/AUTH_BRIDGE_CONTRACT.md\` — Firebase→Railway auth
- \`docs/ENROLLMENT_STATE_MACHINE.md\` — Sequence states
- \`docs/PLATFORM_ARCHITECTURE.md\` — Full architecture overview

# Copilot Instructions — GTM-YardFlow

## Purpose
Sales automation platform: **enroll prospects → send tracked email sequences → book meetings**.
Calendly handles scheduling — no calendar integration needed.

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

| Domain | Service | Key Methods |
|--------|---------|-------------|
| Auth | \`AuthBridge.ts\` | \`getOrCreateRailwaySession()\`, \`ensureValidSession()\`, \`isRailwayAvailable()\` |
| Auth | \`HubSpotAuthService.ts\` | \`getAuthUrl()\`, \`exchangeCode()\`, \`refreshToken()\` |
| Railway | \`RailwayApiClient.ts\` | \`prospects.*\`, \`sequences.*\`, \`enrollments.*\`, \`health.*\` |
| Railway | \`RailwayEmailService.ts\` | \`sendEmailViaRailway()\`, \`isRailwayAvailable()\` |
| Email | \`EmailQueueService.ts\` | \`queueEmail()\`, \`processQueue()\`, \`getQueueStatus()\` |
| Email | \`EmailSequenceService.ts\` | \`enrollProspect()\`, \`pauseEnrollment()\`, \`resumeEnrollment()\` |
| Email | \`EmailComplianceService.ts\` | \`checkSuppression()\`, \`addToSuppressionList()\` |
| Email | \`EmailTrackingService.ts\` | \`recordOpen()\`, \`recordClick()\`, \`generateTrackingPixel()\` |
| Sequence | \`SequenceStateMachine.ts\` | \`canTransition()\`, \`transition()\`, \`isTerminal()\` |
| Sequence | \`SequenceSchedulerService.ts\` | \`scheduleNextStep()\`, \`executeStep()\` |
| Sequence | \`SequenceAnalyticsService.ts\` | \`getReplyRate()\`, \`getEnrollmentMetrics()\` |
| Detection | \`OutOfOfficeDetector.ts\` | \`detectOOO()\`, \`getResumeDate()\`, \`shouldPauseForOOO()\` |
| Data | \`FirestoreService.ts\` | \`getProspects()\`, \`updateProspect()\`, \`subscribeToProspects()\` |
| Import | \`CsvParserService.ts\` | \`parseCsv()\`, \`previewCsv()\`, \`validateCsvStructure()\` |
| Import | \`ColumnMapperService.ts\` | \`autoDetectMapping()\`, \`applyMapping()\` |
| Import | \`DuplicateDetector.ts\` | \`findDuplicates()\`, \`normalizeEmail()\` |
| Scoring | \`HotListScoringService.ts\` | \`calculateHotListScore()\`, \`getTopProspects()\` |
| Scoring | \`PrimoLookalikeScoring.ts\` | \`calculatePrimoLookalikeScore()\`, \`getPrimoTier()\` |
| Analytics | \`AnalyticsAggregator.ts\` | \`aggregate()\`, \`getTimeSeries()\` |
| Timezone | \`TimezoneService.ts\` | \`inferTimezone()\`, \`isBusinessHoursForProspect()\` |
| Tenant | \`TenantService.ts\` | \`createTenant()\`, \`switchTenant()\`, \`checkPermission()\` |
| Audit | \`AuditLogService.ts\` | \`logAction()\`, \`getAuditLog()\` |
| Export | \`PDFReportService.ts\` | \`generateReport()\`, \`exportPipeline()\` |
| Bulk | \`BulkActionService.ts\` | \`tagMany()\`, \`enrollMany()\`, \`updateStatusMany()\` |
| Bulk | \`BulkDeleteService.ts\` | \`deleteMany()\`, \`queueDelete()\` |
| Error | \`ErrorTracking.ts\` | \`captureException()\`, \`setUser()\` |
| Offline | \`OfflineQueue.ts\` | \`enqueue()\`, \`processQueue()\`, \`getPending()\` |

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
| Auth bridge | \`src/services/AuthBridge.ts\` |
| State machine | \`src/services/SequenceStateMachine.ts\` |
| Webhooks | \`api/webhooks/{sendgrid,inbound,calendly}.ts\` |
| Crons | \`api/cron/{process-queue,execute-sequences}.ts\` |
| Types | \`src/types/{railway,email,emailSequence}.ts\` |
| Alerting | \`lib/alerting.ts\` |
| Logger | \`lib/logger.ts\` |

## Desktop UI Components (Sprint 700+)

**Active refactor in progress - desktop-first layout with component extraction from App.tsx.**

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
├── api/           # API endpoint tests
├── components/    # React component tests (RTL)
├── hooks/         # Custom hook tests
├── services/      # Service unit tests
├── mocks/         # Shared mocks (Firebase, PWA)
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

### ❌ Don't: Use inconsistent tier types
\`\`\`typescript
// Firestore types: 'T1', 'T2', 'T3'
// Railway types: 'Tier 1', 'Tier 2', 'Tier 3'
// Always check src/types/{firestore,railway}.ts
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
| \`VITE_RAILWAY_ENABLED\` | Master Railway toggle |
| \`VITE_RAILWAY_EMAIL_ENABLED\` | Route email via Railway |
| \`RAILWAY_API_URL\` | Railway backend URL |
| \`PLATFORM_TO_PLATFORM_SECRET\` | S2S auth between Vercel ↔ Railway |
| \`CRON_SECRET\` | Cron job authentication |
| \`SENDGRID_API_KEY\` | Email sending |
| \`SENDGRID_WEBHOOK_VERIFICATION_KEY\` | Webhook signature verification |
| \`CALENDLY_WEBHOOK_SECRET\` | Calendly webhook verification |
| \`ALERT_WEBHOOK_URL\` | Slack/Teams webhook for alerts |

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

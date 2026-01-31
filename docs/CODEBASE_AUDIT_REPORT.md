# GTM-YardFlow Codebase Audit Report

**Audit Date:** January 31, 2026  
**Auditor:** Automated Sprint Audit  
**Status:** ✅ Complete

---

## Executive Summary

This audit catalogues all API endpoints, services, and identifies gaps between the current implementation and requirements. The codebase is **well-architected** with clear separation between Vercel frontend and Railway backend, but several Railway API endpoints are pending implementation.

### Key Findings

| Category | Status | Details |
|----------|--------|---------|
| Vercel API Endpoints | ✅ Complete | 27 endpoints fully implemented |
| Railway Proxy | ✅ Complete | 18+ paths configured with rate limiting, circuit breaker |
| Webhooks | ✅ Complete | SendGrid, Calendly, Inbound Parse all implemented |
| Cron Jobs | ✅ Complete | 2 crons configured and implemented |
| Services | ✅ Mostly Complete | 72 services, core email/sequence services done |
| Test Coverage | 🟡 Good | 77 unit tests, 16 e2e tests, some gaps |
| Railway Backend | 🔴 Gaps | Prospect CRUD, Enrollment management missing on Railway |

---

## 1. Vercel API Endpoint Inventory

### `/api/admin/`
| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `seed.ts` | GET, POST | ✅ Complete | Database seeding admin tool |

### `/api/ai/`
| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `chat.ts` | POST | ✅ Complete | Gemini AI chat proxy (secure API key) |

### `/api/cron/`
| Endpoint | Method | Status | Purpose | Vercel Cron |
|----------|--------|--------|---------|-------------|
| `process-queue.ts` | GET, POST | ✅ Complete | Process email queue (25 emails/run) | `*/5 * * * *` |
| `execute-sequences.ts` | GET, POST | ✅ Complete | Execute sequence steps (25/run) | `*/5 * * * *` |

### `/api/dashboard/`
| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `stats.ts` | GET | ✅ Complete | Fetch aggregated stats from Railway |

### `/api/email/`
| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `health.ts` | GET | ✅ Complete | Email config health check |
| `inbound.ts` | POST | ✅ Complete | SendGrid Inbound Parse (replies) |
| `send.ts` | POST | ✅ Complete | Queue email for sending |
| `status.ts` | GET | ✅ Complete | Check email delivery status |
| `unsubscribe.ts` | GET, POST | ✅ Complete | Unsubscribe handling (List-Unsubscribe) |
| `webhook.ts` | POST | ✅ Complete | SendGrid event webhook receiver |

### `/api/oauth/` (HubSpot Integration)
| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `callback.ts` | GET | ✅ Complete | OAuth callback handler |
| `refresh.ts` | POST | ✅ Complete | Token refresh |
| `session.ts` | GET, DELETE | ✅ Complete | Session check/logout |
| `token.ts` | POST | ✅ Complete | Token exchange |

### `/api/railway/`
| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `[...path].ts` | ALL | ✅ Complete | Railway proxy with rate limiting, circuit breaker, caching |

**Allowed Proxy Paths:**
```typescript
const ALLOWED_PATHS = [
  '/api/health',
  '/api/outreach/send-email',
  '/api/outreach/generate-ai',
  '/api/outreach/export',
  '/api/enrichment/email',
  '/api/enrichment/smart-guess',
  '/api/sequences',
  '/api/cron/sequences',
  '/api/ai/content/generate',
  '/api/prospects',      // Pending Railway implementation
  '/api/enrollments',    // Pending Railway implementation
  '/api/email/queue',    // Pending Railway implementation
  '/api/email/events',   // Pending Railway implementation
  '/api/email/analytics',// Pending Railway implementation
  '/api/webhooks/sendgrid',
  '/api/auth',
  '/api/users',
  '/api/dashboards',
  '/api/campaigns',
];
```

### `/api/track/`
| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `click.ts` | GET | ✅ Complete | Track link clicks + redirect |
| `open.ts` | GET | ✅ Complete | Track opens (1x1 pixel) |

### `/api/warmup/`
| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `status.ts` | GET | ✅ Complete | Email warmup status |

### `/api/webhooks/`
| Endpoint | Method | Status | Purpose |
|----------|--------|--------|---------|
| `calendly.ts` | POST | ✅ Complete | Meeting booking attribution (North Star!) |
| `inbound.ts` | POST | ✅ Complete | Reply detection + sequence pause |
| `sendgrid.ts` | POST | ✅ Complete | Email event tracking |

### `/api/_middleware.ts`
| Purpose | Status |
|---------|--------|
| Security headers (CSP, HSTS, XSS) | ✅ Complete |
| CORS handling | ✅ Complete |
| Rate limit headers | ✅ Complete |

---

## 2. Railway Backend Endpoints

### ✅ Verified Working (via proxy)
| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/health` | GET | ✅ Verified | DB/Redis/Queue status |
| `/api/outreach/send-email` | POST | ✅ Verified | Email via BullMQ |
| `/api/outreach/generate-ai` | POST | ✅ Verified | AI content generation |
| `/api/outreach/export` | GET | ✅ Verified | Export data |
| `/api/enrichment/email` | POST/PUT | ✅ Verified | Email enrichment |
| `/api/enrichment/smart-guess` | POST | ✅ Verified | Email guessing |
| `/api/sequences` | GET/POST | ✅ Verified | Sequence CRUD |
| `/api/sequences/[id]/enroll` | POST | ✅ Verified | Enrollment |
| `/api/sequences/[id]/analytics` | GET | ✅ Verified | Sequence metrics |
| `/api/cron/sequences` | GET | ✅ Verified | Process steps |
| `/api/ai/content/generate` | POST | ✅ Verified | AI generation |

### 🔴 Missing on Railway (Blocking)

#### Sprint 93 Blockers - Prospect CRUD
| Endpoint | Method | Priority | Status |
|----------|--------|----------|--------|
| `/api/prospects` | GET | P0 | 🔴 Not Started |
| `/api/prospects` | POST | P0 | 🔴 Not Started |
| `/api/prospects/:id` | GET | P0 | 🔴 Not Started |
| `/api/prospects/:id` | PUT | P0 | 🔴 Not Started |
| `/api/prospects/:id` | DELETE | P0 | 🔴 Not Started |
| `/api/prospects/search` | GET | P0 | 🔴 Not Started |
| `/api/prospects/batch` | POST | P0 | 🔴 Not Started |

#### Sprint 94 Blockers - Enrollment Management
| Endpoint | Method | Priority | Status |
|----------|--------|----------|--------|
| `/api/enrollments` | GET | P0 | 🔴 Not Started |
| `/api/enrollments/:id` | GET | P0 | 🔴 Not Started |
| `/api/enrollments/:id/pause` | POST | P0 | 🔴 Not Started |
| `/api/enrollments/:id/resume` | POST | P0 | 🔴 Not Started |
| `/api/enrollments/:id` | DELETE | P0 | 🔴 Not Started |

#### Sprint 95-96 Blockers - Email Queue
| Endpoint | Method | Priority | Status |
|----------|--------|----------|--------|
| `/api/email/queue/status` | GET | P0 | 🔴 Not Started |
| `/api/email/queue/dead-letter` | GET | P0 | 🔴 Not Started |
| `/api/email/queue/retry/:id` | POST | P0 | 🔴 Not Started |
| `/api/email/events` | GET | P0 | 🔴 Not Started |
| `/api/email/analytics` | GET | P0 | 🔴 Not Started |

#### Sprint 97 Blockers - Authentication
| Endpoint | Method | Priority | Status |
|----------|--------|----------|--------|
| `/api/auth/session` | GET | P0 | 🟡 Partial |
| `/api/auth/login` | POST | P0 | 🟡 Partial |
| `/api/auth/logout` | POST | P0 | 🟡 Partial |
| `/api/auth/refresh` | POST | P0 | 🔴 Not Started |
| `/api/users/from-firebase` | POST | P0 | 🔴 Not Started |

---

## 3. Cross-Reference: Duplicates & Overlaps

### ⚠️ Potential Overlaps Identified

| Vercel Endpoint | Railway Endpoint | Resolution |
|-----------------|------------------|------------|
| `/api/email/send.ts` | `/api/outreach/send-email` | **Intentional** - Vercel queues to Firestore, Railway to BullMQ. Feature flag routes traffic. |
| `/api/email/webhook.ts` | `/api/webhooks/sendgrid` | **Intentional** - Vercel receives webhooks from SendGrid and forwards to Railway. |
| `/api/email/inbound.ts` | `/api/webhooks/inbound` | **Both exist** - Vercel's handles reply detection with OOO detection, Railway's is simpler. **Recommend: Keep Vercel as primary.** |
| `/api/cron/execute-sequences.ts` | `/api/cron/sequences` | **Parallel paths** - Vercel cron for Firestore-based sequences, Railway for Postgres. Migration in progress. |

### ✅ No Action Needed
The overlaps are by design for the hybrid architecture during migration. Feature flags control routing:
- `VITE_RAILWAY_ENABLED` - Master toggle
- `VITE_RAILWAY_EMAIL_ENABLED` - Email routing
- `VITE_RAILWAY_DATA_ENABLED` - Data source

---

## 4. Service Audit

### Core Email Services
| Service | File | Status | Notes |
|---------|------|--------|-------|
| `RailwayEmailService` | [RailwayEmailService.ts](src/services/RailwayEmailService.ts) | ✅ Complete | 248 lines, feature flag integration |
| `EmailQueueService` | [EmailQueueService.ts](src/services/EmailQueueService.ts) | ✅ Complete | 231 lines, retry logic, dead letter |
| `EmailComplianceService` | [EmailComplianceService.ts](src/services/EmailComplianceService.ts) | ✅ Complete | Unsubscribe, suppression |
| `EmailTrackingService` | [EmailTrackingService.ts](src/services/EmailTrackingService.ts) | ✅ Complete | Open/click tracking |
| `EmailWarmupService` | [EmailWarmupService.ts](src/services/EmailWarmupService.ts) | ✅ Complete | 80 lines, warmup schedule |
| `SendGridClient` | [SendGridClient.ts](src/services/SendGridClient.ts) | ✅ Complete | SendGrid API wrapper |

### Core Sequence Services
| Service | File | Status | Notes |
|---------|------|--------|-------|
| `SequenceSchedulerService` | [SequenceSchedulerService.ts](src/services/SequenceSchedulerService.ts) | ✅ Complete | 500 lines, THE ENGINE |
| `SequenceStateMachine` | [SequenceStateMachine.ts](src/services/SequenceStateMachine.ts) | ✅ Complete | 358 lines, state transitions |
| `SequenceAnalyticsService` | [SequenceAnalyticsService.ts](src/services/SequenceAnalyticsService.ts) | ✅ Complete | Has test file |
| `EmailSequenceService` | [EmailSequenceService.ts](src/services/EmailSequenceService.ts) | ✅ Complete | Sequence operations |

### Meeting Attribution
| Service | File | Status | Notes |
|---------|------|--------|-------|
| `MeetingAttributionService` | [MeetingAttributionService.ts](src/services/MeetingAttributionService.ts) | ✅ Complete | 362 lines, North Star tracking |

### Authentication
| Service | File | Status | Notes |
|---------|------|--------|-------|
| `AuthBridge` | [AuthBridge.ts](src/services/AuthBridge.ts) | ✅ Complete | 293 lines, Firebase ↔ Railway bridge |
| `HubSpotAuthService` | [HubSpotAuthService.ts](src/services/HubSpotAuthService.ts) | ✅ Complete | HubSpot OAuth |

### Railway Integration
| Service | File | Status | Notes |
|---------|------|--------|-------|
| `RailwayApiClient` | [RailwayApiClient.ts](src/services/RailwayApiClient.ts) | ✅ Complete | 621 lines, typed client |
| `railwayServerClient` | [lib/railway-client.ts](lib/railway-client.ts) | ✅ Complete | 177 lines, S2S client |

### Other Services (Complete)
Total services in `src/services/`: **72 files**

Key services verified:
- ✅ `FirestoreService.ts` - CRM data
- ✅ `SuppressionSyncService.ts` - Bounce/spam sync
- ✅ `OutOfOfficeDetector.ts` - OOO detection with test
- ✅ `TimezoneService.ts` - Timezone handling with test
- ✅ `BulkActionService.ts` - Bulk operations
- ✅ `ImportHistoryService.ts` - Import tracking
- ✅ `PDFReportService.ts` - Report generation

---

## 5. Component Audit

### Core Components (45 components in `src/components/`)

| Component | Status | Test Coverage |
|-----------|--------|---------------|
| `SequenceManagerPanel.tsx` | ✅ Complete | ❌ No test |
| `SequenceBuilder.tsx` | ✅ Complete | ❌ No test |
| `SequenceEnrollmentBadge.tsx` | ✅ Complete | ❌ No test |
| `SequencePerformancePanel.tsx` | ✅ Complete | ❌ No test |
| `EmailHealthStatus.tsx` | ✅ Complete | ❌ No test |
| `EmailQueueStatus.tsx` | ✅ Complete | ❌ No test |
| `EmailStatsCard.tsx` | ✅ Complete | ❌ No test |
| `WarmupDashboard.tsx` | ✅ Complete | ❌ No test |
| `DeadLetterQueue.tsx` | ✅ Complete | ❌ No test |
| `SuppressionManager.tsx` | ✅ Complete | ❌ No test |
| `MeetingsKPICard.tsx` | ✅ Complete | ❌ No test |
| `DashboardLayout.tsx` | ✅ Complete | ✅ Has test |
| `ImportWizard.tsx` | ✅ Complete | ✅ Has test |
| `BulkActionsToolbar.tsx` | ✅ Complete | ✅ Has test |

---

## 6. Hooks Audit

### Hooks (26 hooks in `src/hooks/`)

| Hook | Status | Test Coverage |
|------|--------|---------------|
| `useSequenceEnrollment.ts` | ✅ Complete | ✅ Has test |
| `useSequences.ts` | ✅ Complete | ✅ Has test |
| `useEmailAnalytics.ts` | ✅ Complete | ❌ No test |
| `useEmailHealth.ts` | ✅ Complete | ❌ No test |
| `useEmailQueueHealth.ts` | ✅ Complete | ❌ No test |
| `useRailwayAuth.tsx` | ✅ Complete | ❌ No test |
| `useRailwayStatus.tsx` | ✅ Complete | ❌ No test |
| `useReplyNotifications.ts` | ✅ Complete | ❌ No test |
| `useDualAuth.ts` | ✅ Complete | ❌ No test |
| `useDashboardData.ts` | ✅ Complete | ✅ Has test |
| `useProspectSearch.ts` | ✅ Complete | ❌ No test |
| `useProspects.ts` | ✅ Complete | ❌ No test |

---

## 7. Test Coverage Analysis

### Unit Tests (77 files)

**Services with tests:** 46/72 (64%)
**Components with tests:** 15/45 (33%)
**Hooks with tests:** 12/26 (46%)

### E2E Tests (16 specs)

| Test | Status |
|------|--------|
| `email.spec.ts` | ✅ |
| `auth.spec.ts` | ✅ |
| `dashboard.spec.ts` | ✅ |
| `prospects.spec.ts` | ✅ |
| `bulk.spec.ts` | ✅ |
| `hitlist.spec.ts` | ✅ |
| `navigation.spec.ts` | ✅ |
| `performance.spec.ts` | ✅ |

### Critical Test Gaps

**Services Missing Tests:**
- ❌ `RailwayEmailService.ts`
- ❌ `AuthBridge.ts`
- ❌ `EmailComplianceService.ts`
- ❌ `EmailTrackingService.ts`
- ❌ `MeetingAttributionService.ts`
- ❌ `SuppressionSyncService.ts`
- ❌ `SendGridClient.ts`

**Components Missing Tests:**
- ❌ `SequenceManagerPanel.tsx`
- ❌ `SequenceBuilder.tsx`
- ❌ `WarmupDashboard.tsx`
- ❌ `DeadLetterQueue.tsx`
- ❌ `EmailHealthStatus.tsx`
- ❌ `MeetingsKPICard.tsx`
- ❌ `SuppressionManager.tsx`

**Hooks Missing Tests:**
- ❌ `useEmailAnalytics.ts`
- ❌ `useEmailHealth.ts`
- ❌ `useRailwayAuth.tsx`
- ❌ `useRailwayStatus.tsx`
- ❌ `useReplyNotifications.ts`

---

## 8. Documentation Status

### ✅ Current Documentation
| Document | Status | Notes |
|----------|--------|-------|
| [PLATFORM_ARCHITECTURE.md](docs/PLATFORM_ARCHITECTURE.md) | ✅ Current | Updated Jan 31, 2026 |
| [RAILWAY_CONTRACT.md](docs/api/RAILWAY_CONTRACT.md) | ✅ Current | API contract documented |
| [RAILWAY_API_AUDIT.md](docs/RAILWAY_API_AUDIT.md) | ✅ Current | Jan 30, 2026 |
| [RAILWAY_API_GAPS.md](docs/RAILWAY_API_GAPS.md) | ✅ Current | Remediation plan |
| [ENROLLMENT_STATE_MACHINE.md](docs/ENROLLMENT_STATE_MACHINE.md) | ✅ Current | State transitions |

### ADRs (2 documents)
| ADR | Status |
|-----|--------|
| [001-security-architecture.md](docs/adr/001-security-architecture.md) | ✅ Complete |
| [002-design-system.md](docs/adr/002-design-system.md) | ✅ Complete |

### 🟡 Recommended Additional ADRs
- ❌ ADR-003: Railway Migration Strategy
- ❌ ADR-004: Feature Flag System
- ❌ ADR-005: Email Queue Architecture

---

## 9. P2 Items (Should Do Soon)

### High Priority
| Item | Category | Effort | Impact |
|------|----------|--------|--------|
| Railway Prospect CRUD endpoints | Backend | High | Blocking |
| Railway Enrollment endpoints | Backend | Medium | Blocking |
| `RailwayEmailService.test.ts` | Testing | Low | Quality |
| `AuthBridge.test.ts` | Testing | Low | Quality |
| `SequenceManagerPanel.test.tsx` | Testing | Medium | Quality |
| Email analytics hook tests | Testing | Low | Quality |

### Vercel Improvements
| Item | Category | Effort | Impact |
|------|----------|--------|--------|
| Add request timeout to Railway proxy | Reliability | Low | Medium |
| Add health check endpoint `/api/health` | Operations | Low | High |
| Consolidate email webhook handlers | Tech Debt | Medium | Medium |

---

## 10. P3 Items (Nice to Have / Tech Debt)

### Tech Debt
| Item | Category | Notes |
|------|----------|-------|
| Remove duplicate `parseCookies` function | Code Quality | In `oauth/session.ts` and `oauth/callback.ts` |
| Consolidate email/inbound.ts with webhooks/inbound.ts | Architecture | Similar functionality |
| Add OpenAPI spec for all endpoints | Documentation | API documentation |
| Add proper logging to all API endpoints | Operations | Use `lib/logger.ts` consistently |
| Migrate from crypto to Web Crypto API | Security | Modern API |

### Component Improvements
| Item | Category | Notes |
|------|----------|-------|
| Add loading skeletons to all async components | UX | Better perceived performance |
| Add error boundaries to email components | Reliability | Graceful error handling |
| Add keyboard shortcuts to sequence manager | Accessibility | Power user feature |

### Testing
| Item | Category | Notes |
|------|----------|-------|
| API integration tests | Testing | Test actual endpoints |
| Visual regression tests | Testing | Percy or Chromatic |
| Load testing for cron endpoints | Performance | Ensure scalability |

---

## 11. Recommended Sprint Structure

### Sprint 100: Railway API Completion
**Goal:** Complete Railway Prospect/Enrollment APIs

| Task | Priority | Owner |
|------|----------|-------|
| Build `/api/prospects` CRUD on Railway | P0 | Railway Team |
| Build `/api/enrollments` management on Railway | P0 | Railway Team |
| Update Vercel proxy paths | P0 | Frontend Team |
| Integration testing | P0 | QA |

### Sprint 101: Email Queue API
**Goal:** Complete email queue visibility APIs

| Task | Priority | Owner |
|------|----------|-------|
| Build `/api/email/queue/status` on Railway | P0 | Railway Team |
| Build `/api/email/events` on Railway | P0 | Railway Team |
| Dead letter queue API | P0 | Railway Team |

### Sprint 102: Test Coverage Sprint
**Goal:** Increase test coverage to 80%

| Task | Priority | Owner |
|------|----------|-------|
| Add tests for RailwayEmailService | P2 | Frontend Team |
| Add tests for AuthBridge | P2 | Frontend Team |
| Add tests for sequence components | P2 | Frontend Team |
| Add tests for email hooks | P2 | Frontend Team |

### Sprint 103: Documentation & Polish
**Goal:** Complete documentation and tech debt

| Task | Priority | Owner |
|------|----------|-------|
| Add ADR-003: Railway Migration | P3 | Tech Lead |
| Consolidate webhook handlers | P3 | Frontend Team |
| Add OpenAPI spec | P3 | Frontend Team |
| Performance optimization | P3 | All |

---

## Appendix A: File Counts

```
api/               27 endpoints
src/services/      72 services
src/components/    45 components  
src/hooks/         26 hooks
src/__tests__/     77+ test files
e2e/               16 test specs
docs/               8 documentation files
docs/adr/           2 ADRs
```

## Appendix B: Feature Flag Configuration

```typescript
// Current flags in src/config/featureFlags.ts
export interface FeatureFlags {
  RAILWAY_ENABLED: boolean;          // Master toggle
  RAILWAY_AUTH_ENABLED: boolean;     // Auth routing
  RAILWAY_EMAIL_ENABLED: boolean;    // Email routing
  RAILWAY_DATA_ENABLED: boolean;     // Data source
  RAILWAY_TRAFFIC_PERCENT: number;   // Gradual rollout
  DUAL_WRITE_ENABLED: boolean;       // Write to both
  FIREBASE_AUTH_FALLBACK: boolean;   // Auth fallback
  DEBUG_RAILWAY_REQUESTS: boolean;   // Debug logging
  DEBUG_FEATURE_FLAGS: boolean;      // Flag debugging
}
```

---

**End of Audit Report**

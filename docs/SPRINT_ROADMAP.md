# YardFlow GTM Hub — Sprint Roadmap

> **Last Updated:** January 31, 2026  
> **North Star:** Maximize meetings booked per day via automated, tracked email sequences  
> **Philosophy:** Ship Fast, Ship Often, Atomic Testable Tasks

---

## Current State

| Component | Status | Notes |
|-----------|--------|-------|
| **Vercel Frontend** | ✅ Live | React SPA, Firebase Auth |
| **Railway Backend** | ❌ 500 Error | Needs investigation |
| **Unit Tests** | ✅ 2,466 passing | Good coverage |
| **E2E Tests** | ✅ 16 spec files | Core flows covered |
| **Email Flow** | ⏳ Blocked | Waiting on Railway |

---

## Sprint 0: Stabilization (BLOCKING)

**Goal:** Get Railway healthy, CI green, and email flow working.  
**Demo:** Send one email through the full pipeline.  
**Exit Criteria:** `curl /api/health` returns 200, test email received.

### T0.1: Diagnose Railway 500 Error
- **Action:** Check Railway deploy logs, identify startup error  
- **Validation:** Root cause identified and documented  
- **Files:** YardFlow-Hitlist repo: Deploy Logs tab

### T0.2: Fix Railway Startup Issue
- **Action:** Apply fix based on T0.1 findings  
- **Validation:** `curl https://yardflow-hitlist-production-2f41.up.railway.app/api/health` returns `{"status":"healthy"}`  
- **Files:** YardFlow-Hitlist repo

### T0.3: Fix CI Pipeline
- **Action:** Run `npm run lint && tsc --noEmit && npm test` locally, fix all errors  
- **Validation:** GitHub Actions "CI - Lint, Typecheck, Test" passes  
- **Files:** YardFlow-Hitlist repo

### T0.4: Apply Railway Service Auth Fix
- **Action:** Apply changes from `docs/RAILWAY_SERVICE_AUTH_CHANGE.md` to Railway  
- **Validation:** Vercel proxy can auth to Railway using Bearer CRON_SECRET  
- **Files:** YardFlow-Hitlist: `eventops/src/app/api/outreach/send-email/route.ts`

### T0.5: Verify Email Flow End-to-End
- **Action:** Send test email through UI, confirm delivery  
- **Validation:** Email received, open tracking pixel loads  
- **Files:** Both repos

---

## Sprint 1: Tracking Infrastructure

**Goal:** Capture all email events and meeting bookings to measure North Star.  
**Demo:** Show dashboard with opens, clicks, replies, and meetings booked.  
**Exit Criteria:** All webhook endpoints deployed and receiving events.

### T1.1: SendGrid Event Webhook
- **Action:** Create `/api/webhooks/sendgrid.ts` to handle delivered/bounced/opened/clicked/spam events  
- **Test:** Unit test for event parsing, integration test with mock webhook payload  
- **Validation:** Events stored in Firestore `email_events` collection  
- **Files:** `api/webhooks/sendgrid.ts`, `src/types/emailEvents.ts`

### T1.2: SendGrid Inbound Parse (Reply Detection)
- **Action:** Create `/api/webhooks/inbound.ts` to detect email replies  
- **Test:** Integration test with mock inbound email payload  
- **Validation:** Reply detected, linked to original outreach, sequence paused  
- **Files:** `api/webhooks/inbound.ts`

### T1.3: Calendly Webhook (Meeting Booked)
- **Action:** Create `/api/webhooks/calendly.ts` to capture bookings, link to prospect  
- **Test:** Integration test with mock Calendly `invitee.created` event  
- **Validation:** Meeting recorded in Firestore, prospect status updated to "Meeting Booked"  
- **Files:** `api/webhooks/calendly.ts`, `src/services/MeetingAttributionService.ts`

### T1.4: Meetings KPI Dashboard Widget
- **Action:** Add "Meetings This Week" KPI card to dashboard using MeetingAttributionService  
- **Test:** E2E test for KPI visibility and data accuracy  
- **Validation:** Card shows count that matches Calendly bookings  
- **Files:** `src/components/DashboardLayout.tsx`, `src/components/KPICard.tsx`

### T1.5: Bounce Handling & Suppression
- **Action:** Process bounce events, add to suppression list, prevent future sends  
- **Test:** Unit test for suppression logic  
- **Validation:** Bounced email automatically suppressed  
- **Files:** `src/services/SuppressionSyncService.ts`

---

## Sprint 2: Email Reliability

**Goal:** Bulletproof email sending with retries, visibility, and deliverability protection.  
**Demo:** Send 10 emails, show queue status, trigger failure, demonstrate auto-retry.  
**Exit Criteria:** DLQ functional, warmup dashboard live.

### T2.1: Enhance EmailQueueStatus Component
- **Action:** Add pending/sent/failed/bounced counts and retry rate to existing component  
- **Test:** Unit test for status calculations  
- **Validation:** Real-time counts visible in UI  
- **Files:** `src/components/EmailQueueStatus.tsx`

### T2.2: Exponential Backoff Retry Logic
- **Action:** Add exponential backoff (1min, 5min, 30min) to EmailQueueService  
- **Test:** Unit test for retry timing calculation  
- **Validation:** Failed email retried with increasing delays  
- **Files:** `src/services/EmailQueueService.ts`

### T2.3: Dead Letter Queue Bulk Actions
- **Action:** Add "Retry All" and "Delete All" buttons to DeadLetterQueue component  
- **Test:** E2E test for bulk retry flow  
- **Validation:** Bulk actions work with staggered execution  
- **Files:** `src/components/DeadLetterQueue.tsx`

### T2.4: Domain Warmup Dashboard
- **Action:** Create UI showing daily send limits, sent today, warmup progress  
- **Test:** E2E test for dashboard visibility  
- **Validation:** Shows data from EmailWarmupService  
- **Files:** `src/components/WarmupDashboard.tsx`

### T2.5: Suppression List Manager UI
- **Action:** Create UI to view/search/remove suppressed emails  
- **Test:** E2E test for suppression management flow  
- **Validation:** Can view and unsuppress emails  
- **Files:** `src/components/SuppressionManager.tsx`

### T2.6: Unsubscribe Link + Landing Page
- **Action:** Add one-click unsubscribe to emails, create landing page  
- **Test:** E2E test for unsubscribe flow  
- **Validation:** CAN-SPAM compliant, unsubscribe processed  
- **Files:** `api/unsubscribe/[token].ts`, `src/components/UnsubscribePage.tsx`

---

## Sprint 3: Sequence Automation

**Goal:** Multi-step sequences that run automatically with proper controls.  
**Demo:** Create 3-step sequence, enroll prospect, show automatic progression.  
**Exit Criteria:** Sequences execute without manual intervention.

### T3.1: Sequence Builder (Visual Editor)
- **Action:** Create drag-drop editor for sequence steps (email, wait, condition)  
- **Test:** E2E test for sequence creation flow  
- **Validation:** Can create, save, and edit sequences visually  
- **Files:** `src/components/SequenceBuilder.tsx`

### T3.2: Extract State Machine
- **Action:** Move state logic from SequenceSchedulerService to dedicated SequenceStateMachine class  
- **Test:** Unit tests for all state transitions (enrolled→step1→step2→completed, pause, skip)  
- **Validation:** All transitions documented and tested  
- **Files:** `src/services/SequenceStateMachine.ts`

### T3.3: Reply Detection Stop-Gate
- **Action:** Wire inbound webhook (T1.2) to SequenceStateMachine to auto-pause on reply  
- **Test:** Integration test for reply→pause flow  
- **Validation:** Sequence stops within 1 minute of reply  
- **Files:** `src/services/SequenceStateMachine.ts`, `api/webhooks/inbound.ts`

### T3.4: Out-of-Office Detection
- **Action:** Detect OOO replies, pause sequence, resume after return date  
- **Test:** Unit test for OOO pattern matching  
- **Validation:** OOO detected, sequence paused with scheduled resume  
- **Files:** `src/services/OutOfOfficeDetector.ts`

### T3.5: Prospect Timezone Support
- **Action:** Add timezone field to prospect, schedule sends in their local time  
- **Test:** Unit test for timezone conversion  
- **Validation:** Email sent at correct local time  
- **Files:** `src/types/index.ts`, `src/services/SequenceSchedulerService.ts`

### T3.6: Cron Execution Audit Log
- **Action:** Log every cron execution with inputs, outputs, errors to Firestore  
- **Test:** Integration test for log persistence  
- **Validation:** Full audit trail visible  
- **Files:** `api/cron/execute-sequences.ts`, `src/services/AuditLogService.ts`

---

## Sprint 4: Analytics & Insights

**Goal:** Understand email and sequence performance at a glance.  
**Demo:** Dashboard showing funnel: sent→opened→clicked→replied→booked.  
**Exit Criteria:** All metrics calculating correctly.

### T4.1: Sequence Funnel Visualization
- **Action:** Enhance SequencePerformancePanel with visual funnel (bars, percentages)  
- **Test:** Unit test for funnel calculation  
- **Validation:** Funnel matches raw event data  
- **Files:** `src/components/SequencePerformancePanel.tsx`

### T4.2: Step-Level Drill-Down
- **Action:** Add expand/collapse to see per-step metrics (which email gets best opens?)  
- **Test:** E2E test for drill-down interaction  
- **Validation:** Can identify best-performing step  
- **Files:** `src/components/SequencePerformancePanel.tsx`

### T4.3: Time-of-Day Analysis
- **Action:** Show heatmap of best send times based on open rates  
- **Test:** Unit test for time bucketing logic  
- **Validation:** Recommendations match data  
- **Files:** `src/components/TimeHeatmap.tsx`, `src/services/TimeAnalysisService.ts`

### T4.4: Comparative Sequence Analysis
- **Action:** Compare two sequences side-by-side (A/B testing at sequence level)  
- **Test:** E2E test for comparison view  
- **Validation:** Can identify winning sequence  
- **Files:** `src/components/SequenceComparison.tsx`

### T4.5: Export Analytics to CSV
- **Action:** Add export button to analytics panels  
- **Test:** E2E test for export and file download  
- **Validation:** CSV contains all displayed data  
- **Files:** `src/services/DashboardExporter.ts`

---

## Sprint 5: Prospect Management

**Goal:** Efficient handling for high-volume outreach campaigns.  
**Demo:** Import 100 prospects, dedupe, auto-tag, bulk enroll.  
**Exit Criteria:** Sub-5-second import for 1000 records.

### T5.1: Enhanced Email Validation
- **Action:** Add stricter email validation (MX check, disposable domain detection)  
- **Test:** Unit tests for validation rules  
- **Validation:** Invalid emails rejected at import  
- **Files:** `src/services/CsvParserService.ts`, `src/services/EmailValidationService.ts`

### T5.2: Auto-Tagging Rules Engine
- **Action:** Define rules: if title contains "VP", tag "executive"; if domain = ".edu", tag "education"  
- **Test:** Unit test for rule matching  
- **Validation:** Tags applied automatically on import  
- **Files:** `src/services/SegmentationService.ts`

### T5.3: Staggered Bulk Enrollment
- **Action:** Enhance BulkSequenceModal to space out enrollments (1 per minute) to avoid spam flags  
- **Test:** E2E test for staggered enrollment  
- **Validation:** Enrollments spread over time  
- **Files:** `src/components/BulkSequenceModal.tsx`

### T5.4: Timezone Auto-Detection
- **Action:** Infer timezone from company HQ location (use Clearbit or domain lookup)  
- **Test:** Unit test for timezone inference  
- **Validation:** Timezone populated for new imports  
- **Files:** `src/services/SegmentationService.ts`

### T5.5: Prospect Merge UI
- **Action:** When duplicates detected, show merge UI to combine records  
- **Test:** E2E test for merge flow  
- **Validation:** Merged prospect has combined data  
- **Files:** `src/components/ProspectMergeModal.tsx`

---

## Sprint 6: Template Intelligence

**Goal:** Help users write better emails faster.  
**Demo:** Generate personalized email, show quality score, save to library.  
**Exit Criteria:** Template generation under 3 seconds.

### T6.1: Template Library Service
- **Action:** Create service for saving/loading/searching templates  
- **Test:** Unit tests for CRUD operations  
- **Validation:** Templates persist across sessions  
- **Files:** `src/services/TemplateLibraryService.ts`

### T6.2: Template Library UI
- **Action:** Create modal to browse, preview, and select templates  
- **Test:** E2E test for template selection flow  
- **Validation:** Can insert template into email  
- **Files:** `src/components/TemplateLibrary.tsx`

### T6.3: AI Subject Line Generator
- **Action:** Generate 3 subject line options via Gemini API based on email body  
- **Test:** Integration test for API call  
- **Validation:** 3 unique, relevant suggestions returned  
- **Files:** `src/services/GeminiService.ts`

### T6.4: Template A/B Variants
- **Action:** Create variant templates, track which performs better  
- **Test:** Unit test for variant selection logic (even distribution)  
- **Validation:** Can see winner after N sends  
- **Files:** `src/services/ABTestService.ts`

### T6.5: Spam Score Check
- **Action:** Check email content for spam triggers (all caps, "FREE", etc.)  
- **Test:** Unit test for spam detection  
- **Validation:** Warning shown if spam score high  
- **Files:** `src/services/SpamScoreService.ts`

---

## Sprint 7: Polish & Performance

**Goal:** Fast, accessible, delightful UX.  
**Demo:** Sub-100ms interactions, full keyboard navigation, mobile responsive.  
**Exit Criteria:** Lighthouse score >90.

### T7.1: Vim-Style Keyboard Navigation
- **Action:** Add j/k navigation in lists, Enter to open, Escape to close  
- **Test:** E2E test for keyboard shortcuts  
- **Validation:** Can navigate without mouse  
- **Files:** `src/services/KeyboardNavigationService.ts`

### T7.2: Mobile Responsive Layout
- **Action:** Responsive design for tablet/phone, collapsible sidebar  
- **Test:** Visual tests at 768px and 375px breakpoints  
- **Validation:** All features usable on mobile  
- **Files:** `src/components/DashboardLayout.tsx`

### T7.3: Error Boundary Improvements
- **Action:** Add retry buttons, more helpful error messages, error reporting  
- **Test:** Test error boundary behavior with thrown errors  
- **Validation:** Graceful degradation with actionable recovery  
- **Files:** `src/components/ErrorBoundary.tsx`

### T7.4: Performance Profiling
- **Action:** Profile with React DevTools, fix slow renders (<16ms target)  
- **Test:** Performance metrics in CI (React Profiler)  
- **Validation:** No renders >50ms  
- **Files:** `src/App.tsx`, performance-critical components

### T7.5: Loading State Consistency
- **Action:** Audit all async operations for proper loading states  
- **Test:** E2E test for loading indicators  
- **Validation:** Every async action shows feedback  
- **Files:** All components with async operations

### T7.6: Accessibility Audit
- **Action:** Run axe-core, fix all critical/serious issues  
- **Test:** Accessibility E2E tests with axe  
- **Validation:** Zero critical accessibility violations  
- **Files:** All components

---

## Future Sprints (Backlog)

### Sprint 8: Multi-User & Permissions
- Team member management
- Role-based access control
- Activity attribution

### Sprint 9: CRM Integrations
- HubSpot two-way sync (enhanced)
- Salesforce integration
- Pipedrive integration

### Sprint 10: Advanced Automation
- Conditional branching in sequences
- Lead scoring triggers
- Webhook triggers

---

## Testing Strategy

| Layer | Tool | Coverage Target |
|-------|------|-----------------|
| Unit Tests | Vitest | 80% code coverage |
| Integration Tests | Vitest | All API interactions |
| E2E Tests | Playwright | All user flows |
| API Contract Tests | Zod schemas | All Railway endpoints |
| Visual Regression | Playwright screenshots | Critical UI components |
| Performance | Lighthouse CI | Score >90 |
| Accessibility | axe-core | Zero critical violations |

---

## Definition of Done (DoD)

Every task is complete when:
- [ ] Code implemented
- [ ] Tests written and passing
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] PR reviewed (or self-reviewed for solo)
- [ ] Deployed to staging/preview
- [ ] Manually verified in preview environment

---

## How to Use This Document

1. **Pick a sprint** — Start with Sprint 0 (stabilization)
2. **Pick a task** — Work on one task at a time
3. **Follow the template:**
   - Read the Action
   - Write the test first (TDD)
   - Implement
   - Verify with Validation criteria
4. **Commit with message:** `feat(sprint-X): T#.# - description`
5. **Move to next task**

---

## Appendix: File Index

| Service/Component | Exists? | Sprint |
|-------------------|---------|--------|
| `EmailQueueStatus.tsx` | ✅ Yes | S2: Enhance |
| `DeadLetterQueue.tsx` | ✅ Yes | S2: Enhance |
| `SequencePerformancePanel.tsx` | ✅ Yes | S4: Enhance |
| `ImportWizard.tsx` | ✅ Yes | — |
| `BulkSequenceModal.tsx` | ✅ Yes | S5: Enhance |
| `MessageQualityIndicator.tsx` | ✅ Yes | — |
| `ProspectListSkeleton.tsx` | ✅ Yes | — |
| `MeetingAttributionService.ts` | ✅ Yes | S1: Wire to UI |
| `EmailWarmupService.ts` | ✅ Yes | S2: Create UI |
| `SuppressionSyncService.ts` | ✅ Yes | S2: Create UI |
| `SequenceStateMachine.ts` | ❌ No | S3: Create |
| `TemplateLibraryService.ts` | ❌ No | S6: Create |
| `api/webhooks/sendgrid.ts` | ❌ No | S1: Create |
| `api/webhooks/calendly.ts` | ❌ No | S1: Create |
| `api/webhooks/inbound.ts` | ❌ No | S1: Create |

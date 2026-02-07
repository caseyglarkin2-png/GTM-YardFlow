# Sprint Plan V41: Comprehensive Product Roadmap

**Status**: 📋 REVIEWED & REVISED  
**Created**: February 7, 2026  
**Revised**: February 7, 2026 (Post-Review)  
**Author**: AI Planning Agent  
**Reviewer**: Senior Engineering Review Agent  

---

## Review Summary

> ⚠️ **Post-Review Revision**: This plan was reviewed by a subagent that identified 10+ duplicate creation tasks for features that already exist. All duplicates have been removed and replaced with verification/integration tasks.

### Validated Existing Components (DO NOT RECREATE)
| Component | Location | Status |
|-----------|----------|--------|
| `useSpamScore` | `src/hooks/useSpamScore.ts` | ✅ 281 lines with tests |
| `SpamScoreIndicator` | `src/components/SpamScoreIndicator.tsx` | ✅ Integrated in BulkEmailModal |
| `SendTimeOptimizer` | `src/services/SendTimeOptimizer.ts` | ✅ With tests |
| `ProspectListSkeleton` | `src/components/ProspectListSkeleton.tsx` | ✅ 293 lines |
| `OutOfOfficeDetector` | `src/services/OutOfOfficeDetector.ts` | ✅ 374 lines with tests |
| `useFocusTrap` | `src/hooks/useFocusTrap.ts` | ✅ 240+ line tests |
| `DataLoadError` | `src/components/DataLoadError.tsx` | ✅ With tests |
| `SpamScoreService` | `src/services/SpamScoreService.ts` | ✅ 646 lines |

---

## Executive Summary

### Product Value Priorities

| Priority | Focus Area | Business Impact | Technical Effort |
|----------|-----------|-----------------|------------------|
| **P0** | Stability & Test Suite | Users can't use broken app | Medium |
| **P0** | Email E2E Verification | Core value proposition | Low (verification) |
| **P1** | Security Audit | Compliance, trust | Medium |
| **P1** | UI/UX Polish & A11y | User retention, compliance | Medium |
| **P1** | Analytics Dashboard | User confidence | Medium |
| **P2** | Sequence Intelligence | Conversion optimization | High |
| **P2** | Advanced Automation | Time savings | High |
| **P3** | Integration Expansion | Market fit | Medium |

### Current State Analysis

**What Works:**
- ✅ Prospect import and management
- ✅ Email sequences with enrollment tracking
- ✅ Bulk email UI with spam scoring (already integrated!)
- ✅ Railway backend integration with S2S auth
- ✅ Webhook handlers (SendGrid, Calendly, Inbound)
- ✅ Warmup limits and compliance infrastructure
- ✅ SpamScoreService + SpamScoreIndicator (646 lines, comprehensive)
- ✅ SendTimeOptimizer service
- ✅ OutOfOfficeDetector service

**Actual Gaps (Verified):**
- ❌ 13 TypeScript errors in test factories
- ❌ ~20 runtime test failures (useBulkEmailSend, email.test.ts)
- ❌ App.tsx is 2,285 lines (unmaintainable monolith)
- ❌ No security audit documented
- ❌ Missing accessibility audit
- ❌ Bundle is 2.75MB (target: <1MB main + lazy chunks)

---

## Sprint Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                        P0: FOUNDATION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  S41 (Test Repair)                                              │
│       │                                                         │
│       ▼                                                         │
│  S42 (Email Works) ────────────────────┐                        │
│       │                                │                        │
│       ▼                                ▼                        │
│  ┌────────────────────┐   ┌────────────────────┐               │
│  │ S43 (UI/UX Polish) │   │ S44 (Analytics)    │  ← P1         │
│  └────────────────────┘   └────────────────────┘               │
│            │                        │                           │
│            └────────┬───────────────┘                           │
│                     ▼                                           │
│            ┌────────────────────┐                               │
│            │ S45 (Intelligence) │  ← P2                         │
│            └────────────────────┘                               │
│                     │                                           │
│                     ▼                                           │
│  ┌─────────────────────────────────────────┐                    │
│  │ S46 (Automation) │ S47 (Integrations)   │  ← P3              │
│  └─────────────────────────────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# SPRINT 41: Test Suite & Type Safety [P0]

**Goal**: All TypeScript compiles without errors, all tests pass  
**Demo**: Run `npm test -- --run` and see 100% green  
**Duration**: 2-4 hours  
**Depends On**: None  

## Exit Criteria
- [ ] `npx tsc --noEmit` exits with 0
- [ ] `npm test -- --run` all tests pass
- [ ] No `any` types in new code

---

### T41.1: Fix Test Factory Prospect Type [S - 15min]

**Description**: Remove `firstName` from Prospect factory, add it to proper location. Prospect uses `name` (full name), not `firstName`.

**Files**: `src/__tests__/factories/index.ts`

**Change**:
```typescript
// BEFORE (line 36)
firstName: faker.person.firstName(),

// AFTER
// Remove firstName entirely - Prospect type uses 'name' not 'firstName'
// If firstName needed elsewhere, compute: name.split(' ')[0]
```

**Tests**: `npm test -- --run factories`

**Validation**: `npx tsc --noEmit 2>&1 | grep -c "firstName"`

**Commit**: `fix(tests): remove invalid firstName from Prospect factory`

---

### T41.2: Fix RailwayProspect Factory Company Field [S - 15min]

**Description**: RailwayProspect uses `companyId`, not `company`. Fix factory.

**Files**: `src/__tests__/factories/index.ts`

**Change**:
```typescript
// BEFORE (line 106)
company: faker.company.name(),

// AFTER
companyId: faker.string.uuid(),
companyName: faker.company.name(), // If this field exists
```

**Tests**: `npm test -- --run factories`

**Validation**: `npx tsc --noEmit 2>&1 | grep "company.*RailwayProspect"`

**Commit**: `fix(tests): use companyId in RailwayProspect factory`

---

### T41.3: Fix SequenceStep Factory Missing Fields [S - 20min]

**Description**: SequenceStep requires `id` and `order`. Add to factory.

**Files**: `src/__tests__/factories/index.ts`

**Change**:
```typescript
// BEFORE (lines 123-125)
{ type: "email", subject: "...", body: "...", delayDays: 0 },
{ type: "wait", delayDays: 3 },
{ type: "email", subject: "...", body: "...", delayDays: 0 },

// AFTER
{ id: faker.string.uuid(), order: 1, type: "email", subject: "...", body: "...", delayDays: 0 },
{ id: faker.string.uuid(), order: 2, type: "wait", delayDays: 3 },
{ id: faker.string.uuid(), order: 3, type: "email", subject: "...", body: "...", delayDays: 0 },
```

**Tests**: `npm test -- --run factories`

**Validation**: `npx tsc --noEmit 2>&1 | grep "SequenceStep"`

**Commit**: `fix(tests): add id and order to SequenceStep factory`

---

### T41.4: Fix RailwayEnrollment Factory Field Name [S - 15min]

**Description**: RailwayEnrollment uses `currentStepIndex`, not `currentStep`. Fix factory and test.

**Files**: 
- `src/__tests__/factories/index.ts`
- `src/__tests__/factories/factories.test.ts`

**Change**:
```typescript
// BEFORE (line 141)
currentStep: 0,

// AFTER
currentStepIndex: 0,
```

**Tests**: `npm test -- --run factories`

**Validation**: `npx tsc --noEmit 2>&1 | grep "currentStep"`

**Commit**: `fix(tests): use currentStepIndex in RailwayEnrollment factory`

---

### T41.5: Fix useSortableTable Generic Type [M - 30min]

**Description**: useSortableTable test uses wrong generic type. The hook infers key from data, test passes wrong keys.

**Files**: `src/__tests__/hooks/useSortableTable.test.ts`

**Change**:
```typescript
// BEFORE
const { sortBy } = result.current;
act(() => sortBy('name')); // Error: 'name' not in type

// AFTER - define test data with correct keys
interface TestRow {
  name: string;
  score: number;
  date: Date;
}
const testData: TestRow[] = [
  { name: 'Alice', score: 95, date: new Date() },
  // ...
];
// Hook will now accept 'name' | 'score' | 'date'
```

**Tests**: `npm test -- --run useSortableTable`

**Validation**: `npx tsc --noEmit 2>&1 | grep "useSortableTable"`

**Commit**: `fix(tests): correct generic types in useSortableTable test`

---

### T41.6: Fix useBulkEmailSend Test Timing Issues [M - 45min]

**Description**: Tests are failing due to async timing issues in status assertions.

**Files**: `src/__tests__/hooks/useBulkEmailSend.test.ts`

**Issue**: Tests check `status` before async operations complete.

**Fix**:
```typescript
// BEFORE
expect(result.current.recipients[0].status).toBe('sent');

// AFTER - wait for async update
await waitFor(() => {
  expect(result.current.recipients[0].status).toBe('sent');
});
```

**Tests**: `npm test -- --run useBulkEmailSend`

**Validation**: All useBulkEmailSend tests pass.

**Commit**: `fix(tests): add waitFor to useBulkEmailSend async assertions`

---

### T41.7: Fix email.test.ts Integration Failures [M - 45min]

**Description**: Email queue `processNext` returns 'failed' instead of 'sent'.

**Files**: `src/__tests__/integration/email.test.ts`

**Issue**: Mock SendGrid client not properly configured or compliance check failing.

**Investigation Steps**:
1. Check if mock is returning success
2. Check if compliance/warmup checks are passing
3. Fix mock setup or add necessary bypasses for test context

**Tests**: `npm test -- --run email.test`

**Validation**: All email integration tests pass.

**Commit**: `fix(tests): resolve email.test.ts mock configuration`

---

### T41.8: Verify All Tests Pass [S - 15min]

**Description**: Run full test suite, ensure 100% pass rate.

**Files**: None (verification only)

**Validation**:
```bash
npm test -- --run 2>&1 | tail -20
# Expected: "X passed, 0 failed"
```

**Commit**: None (verification task)

---

## Sprint 41 Demo Script

```bash
# 1. Type check passes
npx tsc --noEmit && echo "✅ Type check passed"

# 2. Tests pass
npm test -- --run && echo "✅ All tests passed"

# 3. No errors in factory files
npx tsc --noEmit 2>&1 | grep "__tests__" | wc -l
# Expected: 0
```

---

# SPRINT 42: Email E2E Verification & Test Infrastructure [P0]

**Goal**: Verify email flow works end-to-end, add missing test data-testids  
**Demo**: Send test email from UI, verify in inbox, show tracking  
**Duration**: 3-4 hours  
**Depends On**: S41 (tests pass)  

> ⚠️ **IMPORTANT**: SpamScoreIndicator and useSpamScore ALREADY EXIST and are integrated into BulkEmailModal. This sprint verifies they work, NOT recreates them.

## Exit Criteria
- [ ] All email compose UI elements have data-testid attributes
- [ ] E2E test covers compose → send → verify flow
- [ ] Manual verification of spam score in production
- [ ] Tracking pixel injection verified

---

### T42.1: Add data-testid Attributes to BulkEmailModal [S - 30min]

**Description**: Add testable attributes to enable E2E testing.

**Files**: `src/components/BulkEmailModal.tsx`

**Changes**:
```typescript
// Add to subject input
<input data-testid="email-subject" ... />

// Add to body textarea
<textarea data-testid="email-body" ... />

// Add to send button
<button data-testid="bulk-email-send" ... />

// Add to spam score indicator wrapper
<div data-testid="spam-score-indicator" ... />

// Add to modal container
<div data-testid="bulk-email-modal" ... />
```

**Tests**: Component test verifying data-testids exist

**Validation**: `grep -r "data-testid" src/components/BulkEmailModal.tsx | wc -l` (should be 5+)

**Commit**: `test(email): add data-testid attributes to BulkEmailModal`

---

### T42.2: Verify SpamScoreIndicator Integration [S - 30min]

**Description**: Manual verification that spam score shows in compose UI.

**Files**: None (verification only)

**Validation Checklist**:
- [ ] Open BulkEmailModal
- [ ] Type normal content, see green/low score
- [ ] Type "FREE MONEY!!!" → see yellow/red score
- [ ] Type "URGENT!!! CLICK HERE $$$" → see red score with blocked warning
- [ ] Screenshot for documentation

**Commit**: None (verification task)

---

### T42.3: Create Email E2E Test with Correct Selectors [M - 1hr]

**Description**: Playwright test for email compose and send flow.

**Files**: `e2e/email-compose.spec.ts`

**Implementation**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Email Compose Flow', () => {
  test('shows spam score for normal content', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="prospect-row"]');
    
    // Select prospect
    await page.click('[data-testid="prospect-checkbox"]:first-child');
    
    // Open email modal
    await page.click('[data-testid="action-email"]');
    await expect(page.locator('[data-testid="bulk-email-modal"]')).toBeVisible();
    
    // Fill normal content
    await page.fill('[data-testid="email-subject"]', 'Quick question about your operations');
    await page.fill('[data-testid="email-body"]', 'Hi, I wanted to reach out about...');
    
    // Verify spam score is green/low
    const spamIndicator = page.locator('[data-testid="spam-score-indicator"]');
    await expect(spamIndicator).toContainText(/[0-3][0-9]/); // Score 0-39
  });
  
  test('blocks high-spam content', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="prospect-row"]');
    await page.click('[data-testid="prospect-checkbox"]:first-child');
    await page.click('[data-testid="action-email"]');
    
    // Fill spammy content
    await page.fill('[data-testid="email-subject"]', 'FREE MONEY NOW!!!');
    await page.fill('[data-testid="email-body"]', 'URGENT!!! Click here to WIN $$$');
    
    // Verify spam score is high and button disabled
    const sendButton = page.locator('[data-testid="bulk-email-send"]');
    await expect(sendButton).toBeDisabled();
  });
});
```

**Validation**: `npm run test:e2e -- email-compose.spec.ts`

**Commit**: `test(e2e): add email compose flow tests`

---

### T42.4: Verify Tracking Pixel Injection [S - 30min]

**Description**: Verify emails sent include tracking pixel.

**Files**: `api/email/send.ts` (inspection only)

**Validation**:
```bash
# Search for tracking service usage
grep -n "TrackingService\|tracking.*pixel\|trackingId" api/email/send.ts
```

**Verification**: 
1. Send test email to yourself
2. View email source
3. Confirm `<img src="...api/track/open...">` present

**Commit**: None (verification task)

---

### T42.5: Add Email Send Integration Test [M - 45min]

**Description**: Test the full send path with mocked SendGrid.

**Files**: `src/__tests__/integration/email-send-flow.test.ts`

**Implementation**:
```typescript
describe('Email Send Flow Integration', () => {
  it('enqueues email with tracking pixel', async () => {
    const mockSendGrid = createMockSendGrid();
    const queueService = new EmailQueueService(db, mockSendGrid, ...);
    
    await queueService.enqueue({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });
    
    // Verify tracking was injected
    const sent = mockSendGrid.lastSent;
    expect(sent.html).toContain('api/track/open');
  });
  
  it('rejects high-spam content server-side', async () => {
    const response = await sendEmail({
      subject: 'FREE MONEY!!!',
      body: 'CLICK HERE $$$',
    });
    
    expect(response.status).toBe(422);
    expect(response.body.reason).toBe('spam_score_high');
  });
});
```

**Validation**: `npm test -- --run email-send-flow`

**Commit**: `test(email): add email send flow integration tests`

---

### T42.6: Manual E2E Email Verification [M - 1hr]

**Description**: Complete manual verification of email flow.

**Files**: None (manual testing)

**Validation Checklist**:
```markdown
- [ ] Start dev server: `npm run dev`
- [ ] Sign in to app
- [ ] Select a prospect
- [ ] Click Email action
- [ ] Verify spam score indicator visible
- [ ] Enter subject and body
- [ ] Click Send
- [ ] Verify toast shows success
- [ ] Check email inbox (may take 1-2 min)
- [ ] Verify email received
- [ ] Click link in email
- [ ] Verify click tracked in app (check console/network)
- [ ] Screenshot results
```

**Acceptance**: Email successfully sent and received with working tracking.

---

## Sprint 42 Demo Script

```bash
# Demo 1: Spam Score Live
# 1. Open BulkEmailModal
# 2. Show green score for normal content
# 3. Type spam words → show score increase to red

# Demo 2: E2E Test
npm run test:e2e -- email-compose.spec.ts
# Show tests passing

# Demo 3: Send Email
# 1. Select prospect, compose email
# 2. Click Send
# 3. Show email in inbox
# 4. Click tracked link → show tracking logged
```

---

# SPRINT 42A: Security Audit [P1]

**Goal**: Verify security posture of email and authentication flows  
**Demo**: Security checklist completed, no critical vulnerabilities  
**Duration**: 2-3 hours  
**Depends On**: S42 (email verified working)  

## Exit Criteria
- [ ] CSRF protection verified on all mutation endpoints
- [ ] Input sanitization verified for email content
- [ ] S2S auth token handling reviewed
- [ ] Firebase security rules audited

---

### T42A.1: Audit CSRF Protection [M - 45min]

**Description**: Verify all mutation endpoints have CSRF protection.

**Files**: 
- `api/email/send.ts`
- `api/webhooks/*.ts`
- `api/railway/[...path].ts`

**Validation Checklist**:
```markdown
- [ ] `/api/email/send` - Check for origin validation
- [ ] `/api/webhooks/sendgrid` - Verify signature validation
- [ ] `/api/webhooks/calendly` - Verify signature validation  
- [ ] `/api/railway/*` - Check auth header required
```

**Tests**: Review existing webhook tests for signature validation coverage.

**Commit**: `docs(security): document CSRF audit findings`

---

### T42A.2: Audit Email Input Sanitization [M - 45min]

**Description**: Verify email body/subject are sanitized for XSS.

**Files**: 
- `src/services/EmailQueueService.ts`
- `api/email/send.ts`

**Check For**:
```typescript
// Should sanitize HTML in email body
import DOMPurify from 'dompurify';
const sanitizedBody = DOMPurify.sanitize(body);
```

**Tests**: Add test case for XSS in email body.

**Commit**: `security(email): add input sanitization audit`

---

### T42A.3: Review S2S Auth Token Handling [S - 30min]

**Description**: Verify S2S tokens are securely stored and transmitted.

**Files**: 
- `lib/railway-client.ts`
- `api/railway/[...path].ts`

**Validation**:
- [ ] Tokens not logged
- [ ] Tokens in headers, not query params
- [ ] Token rotation policy documented

**Commit**: `docs(security): document S2S auth review`

---

### T42A.4: Audit Firebase Security Rules [M - 45min]

**Description**: Review Firestore rules for prospect data access.

**Files**: `firestore.rules`

**Validation**:
- [ ] Users can only read/write their own data
- [ ] No public read access to prospect emails
- [ ] Admin operations require auth

**Commit**: `security(firestore): audit security rules`

---

## Sprint 42A Demo

```bash
# Show security audit documentation
# Show test coverage for signature validation
# Show Firestore rules protecting user data
```

---

# SPRINT 43: UI/UX Polish, A11y & Performance [P1]

**Goal**: App feels fast, is accessible, and keyboard navigable  
**Demo**: Page load < 3s, a11y audit passes, keyboard navigation works  
**Duration**: 4-6 hours  
**Depends On**: S42 (email verified)  

> ⚠️ **Existing Components**: ProspectListSkeleton, DataLoadError, useFocusTrap all EXIST. This sprint verifies they work and adds missing pieces.

## Exit Criteria
- [ ] Initial bundle < 1MB (excluding vendor chunks)
- [ ] Lighthouse Performance score > 70, Accessibility > 90
- [ ] All modals close with Escape key (verified)
- [ ] Focus trapping works in modals (verified)
- [ ] axe-core audit passes with no critical violations

---

### T43.1: Verify Escape Key Handling in All Modals [S - 30min]

**Description**: Verify (not implement) all modals close on Escape key.

**Files**: Manual verification of:
- `BulkEmailModal`
- `BulkSequenceModal`
- `BulkTagModal`
- `ProspectFormModal`

**Validation**: Open each modal, press Escape, verify close.

**Fix if needed**: Add missing `useEffect` with keyboard listener.

**Commit**: `fix(a11y): ensure all modals close on Escape` (if fixes needed)

---

### T43.2: Verify Focus Trapping in Modals [S - 30min]

**Description**: Verify useFocusTrap hook is applied to all modals.

**Files**: Inspect modal components for `useFocusTrap` usage.

**Validation**:
1. Open modal
2. Tab through all inputs
3. Verify focus cycles within modal
4. Verify focus doesn't escape to background

**Fix if needed**: Add `useFocusTrap` to modals missing it.

**Commit**: `fix(a11y): add focus trapping to modals` (if fixes needed)

---

### T43.3: Run axe-core Accessibility Audit [M - 1hr]

**Description**: Run automated accessibility audit, fix critical violations.

**Files**: Various based on findings

**Implementation**:
```bash
# Install axe-core extension or use CLI
npx @axe-core/cli http://localhost:5173

# Or add to Playwright
import { injectAxe, checkA11y } from 'axe-playwright';
```

**Validation**: 
- No critical violations
- No serious violations in core flows

**Commit**: `fix(a11y): address axe-core audit violations`

---

### T43.4: Add aria-labels to Icon-Only Buttons [S - 30min]

**Description**: Ensure all icon-only buttons have accessible labels.

**Files**: Search for buttons with only icons, add `aria-label`.

**Search Pattern**:
```bash
grep -r "<button.*>" src/components | grep -v "aria-label"
```

**Commit**: `fix(a11y): add aria-labels to icon-only buttons`

---

### T43.5: Verify Loading States (Skeletons) [S - 30min]

**Description**: Verify ProspectListSkeleton and other loading states work.

**Files**: 
- `src/components/ProspectListSkeleton.tsx` (verify exists)
- Parent components that should show skeleton

**Validation**:
1. Slow network in DevTools
2. Reload page
3. Verify skeleton appears during load

**Commit**: None (verification) or `fix(ux): wire loading skeleton` (if needed)

---

### T43.6: Verify Error States (DataLoadError) [S - 30min]

**Description**: Verify DataLoadError component shows on failures.

**Files**: 
- `src/components/DataLoadError.tsx` (verify exists)
- Components that fetch data

**Validation**:
1. Block network to Firestore
2. Reload page
3. Verify error UI with retry button

**Commit**: None (verification) or `fix(ux): wire error state` (if needed)

---

### T43.7: Optimize Bundle - Lazy Load Routes [M - 1hr]

**Description**: Code-split large route components.

**Files**: `src/App.tsx` or route configuration

**Components to lazy load**:
- ROICalculator
- SequenceBuilder
- ImportWizard
- Any component > 50KB

**Implementation**:
```typescript
const ROICalculator = lazy(() => import('./components/ROITab'));
const SequenceBuilder = lazy(() => import('./components/SequenceBuilder'));

// Wrap in Suspense
<Suspense fallback={<LoadingSpinner />}>
  <ROICalculator />
</Suspense>
```

**Validation**: 
```bash
npm run build
ls -la dist/assets/*.js | head -10
# Main chunk should be < 1MB
```

**Commit**: `perf(bundle): lazy load heavy route components`

---

### T43.8: Add Mobile Viewport Tests [M - 45min]

**Description**: Add Playwright tests for mobile viewports.

**Files**: `e2e/mobile.spec.ts`

**Implementation**:
```typescript
import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['iPhone 12'] });

test.describe('Mobile Experience', () => {
  test('can navigate app on mobile', async ({ page }) => {
    await page.goto('/');
    
    // Verify mobile menu exists
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    
    // Can open menu
    await page.click('[data-testid="mobile-menu"]');
    
    // Can navigate
    await page.click('[data-testid="nav-prospects"]');
    await expect(page.url()).toContain('prospects');
  });
  
  test('email modal works on mobile', async ({ page }) => {
    await page.goto('/');
    // ... mobile email flow
  });
});
```

**Validation**: `npm run test:e2e -- mobile.spec.ts`

**Commit**: `test(e2e): add mobile viewport tests`

---

### T43.9: Run Lighthouse Audit [M - 30min]

**Description**: Run Lighthouse, document scores, fix critical issues.

**Files**: Based on findings

**Validation**:
```bash
npx lighthouse http://localhost:5173 --output=html --output-path=./lighthouse-report.html
# Target scores:
# - Performance > 70
# - Accessibility > 90
# - Best Practices > 90
# - SEO > 80
```

**Commit**: `perf(lighthouse): address critical audit findings`

---

## Sprint 43 Demo Script

```bash
# Demo 1: Fast Load
# 1. Clear cache, reload page
# 2. Show skeleton loading
# 3. Show page interactive in < 3s

# Demo 2: Keyboard Navigation
# 1. Tab to email button
# 2. Enter to open modal
# 3. Tab through modal fields
# 4. Escape to close

# Demo 3: Accessibility
# Show axe-core results with 0 critical violations
# Show Lighthouse Accessibility > 90
```

---

# SPRINT 44: Analytics & Visibility [P1]

**Goal**: Users see email performance metrics and can optimize  
**Demo**: Dashboard shows deliverability, opens, clicks, replies  
**Duration**: 4-5 hours  
**Depends On**: S42 (email sends, tracking works)  

## Exit Criteria
- [ ] Email stats card shows sent/delivered/opened/clicked/replied
- [ ] Reputation health score calculated and displayed
- [ ] Domain authentication status visible
- [ ] Sequence performance metrics visible

---

### T44.1: Create useEmailStats Hook [M - 45min]

**Description**: Hook to fetch and aggregate email statistics.

**Files**: `src/hooks/useEmailStats.ts`

**Implementation**:
```typescript
export interface EmailStats {
  period: '24h' | '7d' | '30d';
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  deliverabilityRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

export function useEmailStats(period: '24h' | '7d' | '30d' = '7d'): {
  stats: EmailStats | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}
```

**Tests**: `src/__tests__/hooks/useEmailStats.test.ts`

**Validation**: `npm test -- --run useEmailStats`

**Commit**: `feat(44.1): add useEmailStats hook`

---

### T44.2: Create EmailStatsCard Component [M - 45min]

**Description**: Dashboard card showing email performance metrics.

**Files**: `src/components/dashboard/EmailStatsCard.tsx`

**Implementation**: Card with metrics grid, sparkline trends, health indicator.

**Tests**: `src/__tests__/components/EmailStatsCard.test.tsx`

**Validation**: `npm test -- --run EmailStatsCard`

**Commit**: `feat(44.2): add EmailStatsCard dashboard component`

---

### T44.3: Create ReputationHealthCard Component [M - 1hr]

**Description**: Card showing email reputation health score (0-100).

**Files**: `src/components/dashboard/ReputationHealthCard.tsx`

**Implementation**:
```typescript
// Shows:
// - Health score as gauge (0-100)
// - Grade (A/B/C/D/F)
// - Warning if unhealthy
// - Link to remediation docs
```

**Tests**: `src/__tests__/components/ReputationHealthCard.test.tsx`

**Validation**: `npm test -- --run ReputationHealthCard`

**Commit**: `feat(44.3): add ReputationHealthCard component`

---

### T44.4: Create DomainHealthCard Component [M - 1hr]

**Description**: Card showing SPF/DKIM/DMARC status for sending domain.

**Files**: `src/components/dashboard/DomainHealthCard.tsx`

**Implementation**:
```typescript
// Shows:
// - SPF status: ✓/✗ with record
// - DKIM status: ✓/✗
// - DMARC status: ✓/✗ with policy
// - "Check Domain" button
// - Fix recommendations
```

**Tests**: `src/__tests__/components/DomainHealthCard.test.tsx`

**Validation**: `npm test -- --run DomainHealthCard`

**Commit**: `feat(44.4): add DomainHealthCard component`

---

### T44.5: Create SequencePerformanceCard Component [M - 45min]

**Description**: Card showing sequence-level metrics.

**Files**: `src/components/dashboard/SequencePerformanceCard.tsx`

**Implementation**:
```typescript
// Shows per sequence:
// - Total enrolled
// - Active / Completed / Replied / Meeting
// - Avg steps before reply
// - Best/worst performing sequence
```

**Tests**: `src/__tests__/components/SequencePerformanceCard.test.tsx`

**Validation**: `npm test -- --run SequencePerformanceCard`

**Commit**: `feat(44.5): add SequencePerformanceCard component`

---

### T44.6: Integrate Cards into Dashboard [S - 30min]

**Description**: Add all analytics cards to main dashboard.

**Files**: `src/components/Dashboard.tsx` or `src/components/DashboardLayout.tsx`

**Implementation**: Add responsive grid with EmailStatsCard, ReputationHealthCard, etc.

**Validation**: Manual - open dashboard, see all cards with real data.

**Commit**: `feat(44.6): integrate analytics cards into dashboard`

---

### T44.7: Add /api/email/stats Endpoint [M - 45min]

**Description**: API endpoint returning aggregated email stats.

**Files**: `api/email/stats.ts`

**Implementation**:
```typescript
// GET /api/email/stats?period=7d
// Returns: EmailStats
```

**Tests**: `src/__tests__/api/email-stats.test.ts`

**Validation**: `npm test -- --run email-stats`

**Commit**: `feat(44.7): add /api/email/stats endpoint`

---

## Sprint 44 Demo Script

```bash
# Demo: Analytics Dashboard
# 1. Open app, navigate to Dashboard
# 2. Show EmailStatsCard with 7-day metrics
# 3. Show ReputationHealthCard with score
# 4. Show DomainHealthCard with SPF/DKIM status
# 5. Show SequencePerformanceCard with compare
# 6. Change period to 30d, show data updates
```

---

# SPRINT 44A: Alerting & Monitoring [P1]

**Goal**: Proactive alerts when email health degrades  
**Demo**: Slack notification when bounce rate spikes  
**Duration**: 2-3 hours  
**Depends On**: S44 (analytics available)  

## Exit Criteria
- [ ] Bounce rate spike triggers Slack alert
- [ ] SendGrid quota warning at 80%
- [ ] Railway health degradation alerts
- [ ] Alert history visible in app

---

### T44A.1: Create AlertService with Slack Integration [M - 1hr]

**Description**: Service to send alerts to configured Slack channel.

**Files**: `src/services/AlertService.ts`

**Implementation**:
```typescript
interface Alert {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export class AlertService {
  private webhookUrl = process.env.ALERT_WEBHOOK_URL;
  
  async send(alert: Alert): Promise<void> {
    if (!this.webhookUrl) {
      console.warn('ALERT_WEBHOOK_URL not configured');
      return;
    }
    
    const emoji = {
      info: 'ℹ️',
      warning: '⚠️', 
      critical: '🚨',
    }[alert.severity];
    
    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${emoji} *${alert.title}*\n${alert.message}`,
        attachments: alert.metadata ? [{
          fields: Object.entries(alert.metadata).map(([k, v]) => ({
            title: k,
            value: String(v),
            short: true,
          })),
        }] : undefined,
      }),
    });
  }
  
  async alertBounceRateSpike(rate: number): Promise<void> {
    await this.send({
      severity: 'critical',
      title: 'Bounce Rate Spike Detected',
      message: `Bounce rate is ${rate.toFixed(1)}% (threshold: 5%)`,
      metadata: { rate, threshold: 5 },
    });
  }
  
  async alertSendGridQuota(used: number, limit: number): Promise<void> {
    const percent = (used / limit) * 100;
    if (percent >= 80) {
      await this.send({
        severity: percent >= 95 ? 'critical' : 'warning',
        title: 'SendGrid Quota Warning',
        message: `${percent.toFixed(0)}% of daily quota used`,
        metadata: { used, limit, percent },
      });
    }
  }
}
```

**Tests**: `src/__tests__/services/AlertService.test.ts`

**Validation**: `npm test -- --run AlertService`

**Commit**: `feat(alerting): add AlertService with Slack integration`

---

### T44A.2: Add Bounce Rate Alert Trigger [S - 30min]

**Description**: Check bounce rate after processing SendGrid webhooks.

**Files**: `api/webhooks/sendgrid.ts`

**Implementation**:
```typescript
import { AlertService } from '../../src/services/AlertService';

// After processing bounces:
const alertService = new AlertService();
const bounceRate = await calculateRecentBounceRate(db, '1h');
if (bounceRate > 5) {
  await alertService.alertBounceRateSpike(bounceRate);
}
```

**Validation**: Process bounce webhooks, verify Slack alert sent.

**Commit**: `feat(alerting): trigger alert on bounce rate spike`

---

### T44A.3: Add Alert History to Dashboard [S - 45min]

**Description**: Show recent alerts in dashboard or settings.

**Files**: `src/components/dashboard/AlertHistory.tsx`

**Implementation**:
```typescript
// Store alerts in Firestore
// Show last 10 alerts with severity badges
// Link to detailed metrics
```

**Tests**: `src/__tests__/components/AlertHistory.test.tsx`

**Validation**: `npm test -- --run AlertHistory`

**Commit**: `feat(alerting): add alert history to dashboard`

---

## Sprint 44A Demo Script

```bash
# Demo: Alerting
# 1. Configure ALERT_WEBHOOK_URL to test Slack channel
# 2. Simulate high bounce rate (mock or test data)
# 3. Show Slack notification appears
# 4. Show alert in app's alert history
```

---

# SPRINT 45: Sequence Intelligence [P2]

**Goal**: Sequences optimize based on performance data  
**Demo**: System suggests best send times, A/B test winner selection  
**Duration**: 5-6 hours  
**Depends On**: S44 (analytics visible)  

> ⚠️ **Existing Components**: SendTimeOptimizer and OutOfOfficeDetector EXIST. This sprint wires them to UI and adds remaining intelligence features.

## Exit Criteria
- [ ] Send-time optimization toggle available in UI
- [ ] A/B test winner auto-selection working
- [ ] Sequence recommendations visible
- [ ] OOO detection verified working with sequences

---

### T45.1: Wire SendTimeOptimizer to BulkEmail UI [S - 45min]

**Description**: Add UI toggle to use existing SendTimeOptimizer service.

**Files**: 
- `src/components/BulkEmailModal.tsx`
- `src/services/SendTimeOptimizer.ts` (verify integration)

**Implementation**:
```typescript
import { SendTimeOptimizer } from '@/services/SendTimeOptimizer';

// Add toggle checkbox
<label>
  <input 
    type="checkbox" 
    checked={optimizeSendTime}
    onChange={(e) => setOptimizeSendTime(e.target.checked)}
  />
  Optimize send time for each recipient
</label>

// Show preview times when enabled
{optimizeSendTime && (
  <div className="text-sm text-gray-600">
    Emails will be scheduled for recipient's optimal time
  </div>
)}

// Use optimizer when sending
if (optimizeSendTime) {
  const optimizer = new SendTimeOptimizer();
  recipients.forEach(r => {
    r.scheduledAt = optimizer.calculateOptimalTime(r.prospect);
  });
}
```

**Tests**: Add to BulkEmailModal tests

**Validation**: Enable toggle, verify send times shown per recipient.

**Commit**: `feat(sequence): wire SendTimeOptimizer to email UI`

---

### T45.2: Verify OOO Detection Integration [S - 30min]

**Description**: Verify OutOfOfficeDetector is integrated with sequence state machine.

**Files**: 
- `src/services/OutOfOfficeDetector.ts` (inspect)
- `api/webhooks/inbound.ts` (verify integration)

**Validation**:
1. Check inbound webhook handles OOO replies
2. Verify sequence pauses with resume date
3. Review existing tests pass

**Commit**: None (verification) or `fix(sequence): integrate OOO detector` (if missing)

---

### T45.3: Implement A/B Test Winner Selection Logic [M - 1hr]

**Description**: Add statistical significance check and winner selection.

**Files**: `src/services/ABTestingService.ts` (enhance existing or create)

**Implementation**:
```typescript
export class ABTestingService {
  /**
   * Check if test has enough data for significance
   * Uses chi-squared test or simpler threshold
   */
  hasStatisticalSignificance(test: ABTest): boolean {
    const minSamples = 100;
    const totalSent = test.variants.reduce((sum, v) => sum + v.sent, 0);
    if (totalSent < minSamples) return false;
    
    // Calculate chi-squared or use simple threshold
    const rates = test.variants.map(v => v.opened / v.sent);
    const maxDiff = Math.max(...rates) - Math.min(...rates);
    return maxDiff >= 0.05; // 5% difference threshold
  }
  
  /**
   * Get winning variant ID
   */
  getWinner(test: ABTest): string | null {
    if (!this.hasStatisticalSignificance(test)) return null;
    
    // Winner is variant with highest open rate
    let winner = test.variants[0];
    for (const v of test.variants) {
      if ((v.opened / v.sent) > (winner.opened / winner.sent)) {
        winner = v;
      }
    }
    return winner.id;
  }
  
  /**
   * Auto-select winner and update sequence to use only that variant
   */
  async selectWinner(sequenceId: string, stepId: string): Promise<void> {
    // Get test data
    // Determine winner
    // Update sequence to use winning variant only
  }
}
```

**Tests**: `src/__tests__/services/ABTestingService.test.ts`
```typescript
describe('ABTestingService', () => {
  it('returns false for insufficient samples', () => {});
  it('returns true when difference > 5%', () => {});
  it('returns winner with highest open rate', () => {});
});
```

**Validation**: `npm test -- --run ABTestingService`

**Commit**: `feat(sequence): add A/B test significance calculation`

---

### T45.4: Add A/B Test Results UI [M - 45min]

**Description**: Show A/B test performance in sequence builder.

**Files**: `src/components/sequence/ABTestResults.tsx`

**Implementation**:
```typescript
interface ABTestResultsProps {
  test: ABTest;
  onSelectWinner?: (variantId: string) => void;
}

export function ABTestResults({ test, onSelectWinner }: ABTestResultsProps) {
  const service = new ABTestingService();
  const hasSignificance = service.hasStatisticalSignificance(test);
  const winner = service.getWinner(test);
  
  return (
    <div className="space-y-4">
      <h4>A/B Test Results</h4>
      
      {!hasSignificance && (
        <div className="text-yellow-600">
          Need more data for statistical significance
        </div>
      )}
      
      <table>
        <thead>
          <tr>
            <th>Variant</th>
            <th>Sent</th>
            <th>Opened</th>
            <th>Open Rate</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {test.variants.map(v => (
            <tr key={v.id}>
              <td>{v.name}</td>
              <td>{v.sent}</td>
              <td>{v.opened}</td>
              <td>{((v.opened / v.sent) * 100).toFixed(1)}%</td>
              <td>
                {winner === v.id && (
                  <span className="text-green-600 font-bold">Winner 🏆</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {winner && onSelectWinner && (
        <button onClick={() => onSelectWinner(winner)}>
          Use Winner Only
        </button>
      )}
    </div>
  );
}
```

**Tests**: `src/__tests__/components/ABTestResults.test.tsx`

**Validation**: `npm test -- --run ABTestResults`

**Commit**: `feat(sequence): add A/B test results UI`

---

### T45.5: Create Sequence Recommendations Panel [M - 1hr]

**Description**: Panel suggesting sequence improvements based on data.

**Files**: `src/components/sequence/SequenceRecommendations.tsx`

**Implementation**:
```typescript
interface Recommendation {
  type: 'warning' | 'suggestion' | 'success';
  title: string;
  description: string;
  action?: {
    label: string;
    handler: () => void;
  };
}

export function SequenceRecommendations({ 
  sequence, 
  stats 
}: { 
  sequence: EmailSequence; 
  stats: SequenceStats;
}) {
  const recommendations: Recommendation[] = [];
  
  // Low open rate → suggest subject line changes
  if (stats.openRate < 20) {
    recommendations.push({
      type: 'warning',
      title: 'Low Open Rate',
      description: 'Open rate is below 20%. Consider improving subject lines.',
    });
  }
  
  // Low reply rate → suggest body improvements
  if (stats.replyRate < 2) {
    recommendations.push({
      type: 'suggestion',
      title: 'Low Reply Rate',
      description: 'Try adding a clearer call-to-action.',
    });
  }
  
  // High unsubscribe → targeting issue
  if (stats.unsubscribeRate > 1) {
    recommendations.push({
      type: 'warning',
      title: 'High Unsubscribe Rate',
      description: 'Review your targeting criteria.',
    });
  }
  
  // Good performance → celebrate
  if (stats.replyRate > 10) {
    recommendations.push({
      type: 'success',
      title: 'Great Performance!',
      description: `${stats.replyRate.toFixed(1)}% reply rate is excellent.`,
    });
  }
  
  return (
    <div className="space-y-2">
      <h4>Recommendations</h4>
      {recommendations.map((rec, i) => (
        <RecommendationCard key={i} {...rec} />
      ))}
    </div>
  );
}
```

**Tests**: `src/__tests__/components/SequenceRecommendations.test.tsx`

**Validation**: `npm test -- --run SequenceRecommendations`

**Commit**: `feat(sequence): add recommendations panel`

---

## Sprint 45 Demo Script

```bash
# Demo 1: Send-Time Optimization
# 1. Select prospects from different timezones
# 2. Enable "Optimize send time" checkbox
# 3. Show personalized send times preview

# Demo 2: A/B Test Winner
# 1. Open sequence with A/B test data
# 2. Show variant comparison table
# 3. Show "Winner" badge on best variant
# 4. Click "Use Winner Only" button

# Demo 3: Recommendations
# 1. Open sequence with poor metrics
# 2. Show warning recommendations
# 3. Open high-performing sequence
# 4. Show success celebration
```

---

# SPRINT 46: Advanced Automation [P2]

**Goal**: Reduce manual work through smart automation  
**Demo**: Import triggers auto-enrichment, sequences auto-start  
**Duration**: 5-6 hours  
**Depends On**: S45 (intelligence features)  

## Exit Criteria
- [ ] Import auto-enriches company data
- [ ] Auto-enroll rules based on criteria
- [ ] Webhook triggers for workflow automation
- [ ] Scheduled reports

---

### T46.1: Add Auto-Enrichment on Import [M - 1hr]

**Description**: Automatically enrich company data after import completes.

**Files**: 
- `src/components/ImportWizard.tsx`
- `src/services/CompanyEnrichmentService.ts`

**Implementation**: Post-import hook that queues enrichment for new companies.

**Tests**: Add to ImportWizard tests.

**Validation**: Import CSV, verify company data enriched.

**Commit**: `feat(46.1): add auto-enrichment on import`

---

### T46.2: Create Auto-Enroll Rules Engine [M - 1.5hr]

**Description**: Rules that auto-enroll prospects matching criteria.

**Files**: `src/services/AutoEnrollService.ts`

**Implementation**:
```typescript
interface AutoEnrollRule {
  id: string;
  name: string;
  conditions: Condition[];  // tier, tag, company size, etc.
  sequenceId: string;
  isActive: boolean;
}

export class AutoEnrollService {
  evaluateProspect(prospect: Prospect): string | null; // returns sequenceId
  processNewProspects(prospects: Prospect[]): Promise<EnrollmentResult[]>;
}
```

**Tests**: `src/__tests__/services/AutoEnrollService.test.ts`

**Validation**: `npm test -- --run AutoEnrollService`

**Commit**: `feat(46.2): add auto-enroll rules engine`

---

### T46.3: Create Auto-Enroll Rules UI [M - 1hr]

**Description**: UI for managing auto-enrollment rules.

**Files**: `src/components/settings/AutoEnrollRules.tsx`

**Implementation**: List rules, create/edit/delete, preview matching prospects.

**Tests**: `src/__tests__/components/AutoEnrollRules.test.tsx`

**Validation**: `npm test -- --run AutoEnrollRules`

**Commit**: `feat(46.3): add auto-enroll rules UI`

---

### T46.4: Add Outgoing Webhook Support [M - 1hr]

**Description**: Fire webhooks on key events for external integrations.

**Files**: `src/services/WebhookDispatcher.ts`

**Implementation**:
```typescript
type WebhookEvent = 
  | 'prospect.created'
  | 'email.sent'
  | 'email.opened'
  | 'reply.received'
  | 'meeting.booked';

export class WebhookDispatcher {
  dispatch(event: WebhookEvent, payload: unknown): Promise<void>;
  registerEndpoint(event: WebhookEvent, url: string): void;
}
```

**Tests**: `src/__tests__/services/WebhookDispatcher.test.ts`

**Validation**: `npm test -- --run WebhookDispatcher`

**Commit**: `feat(46.4): add outgoing webhook support`

---

### T46.5: Create Scheduled Reports Service [M - 1hr]

**Description**: Generate and email reports on schedule.

**Files**: 
- `src/services/ScheduledReportService.ts`
- `api/cron/send-reports.ts`

**Implementation**: Daily/weekly email with performance summary.

**Tests**: `src/__tests__/services/ScheduledReportService.test.ts`

**Validation**: `npm test -- --run ScheduledReportService`

**Commit**: `feat(46.5): add scheduled reports service`

---

### T46.6: Add Scheduled Reports UI [S - 45min]

**Description**: UI for configuring report schedule and recipients.

**Files**: `src/components/settings/ScheduledReports.tsx`

**Implementation**: Form for frequency, time, recipients, content selection.

**Tests**: `src/__tests__/components/ScheduledReports.test.tsx`

**Validation**: `npm test -- --run ScheduledReports`

**Commit**: `feat(46.6): add scheduled reports UI`

---

## Sprint 46 Demo Script

```bash
# Demo 1: Auto-Enrichment
# 1. Import CSV with company names only
# 2. Show enrichment running
# 3. Show company data populated

# Demo 2: Auto-Enroll
# 1. Create rule: "Tier 1 + No sequence → Cold Outreach"
# 2. Import new T1 prospects
# 3. Show auto-enrolled in sequence

# Demo 3: Webhooks
# 1. Configure webhook for "meeting.booked"
# 2. Book meeting via Calendly
# 3. Show webhook delivery log
```

---

# SPRINT 47: Integration Expansion [P3]

**Goal**: Connect with external tools users already use  
**Demo**: Sync prospects with HubSpot, export to Slack  
**Duration**: 6-8 hours  
**Depends On**: S46 (automation)  

## Exit Criteria
- [ ] HubSpot bi-directional sync
- [ ] Slack notifications for key events  
- [ ] CSV export with custom columns
- [ ] Zapier-compatible webhook format

---

### T47.1: Complete HubSpot Bi-Directional Sync [M - 1.5hr]

**Description**: Sync prospects and activities with HubSpot CRM.

**Files**: 
- `src/services/HubSpotSyncEngine.ts` (enhance existing)
- `api/integrations/hubspot/sync.ts`

**Implementation**: Full two-way sync with conflict resolution.

**Tests**: `npm test -- --run HubSpotSyncEngine`

**Commit**: `feat(47.1): complete HubSpot bi-directional sync`

---

### T47.2: Add Slack Integration [M - 1hr]

**Description**: Send notifications to Slack on key events.

**Files**: `src/services/SlackIntegration.ts`

**Implementation**:
```typescript
export class SlackIntegration {
  notify(channel: string, message: SlackMessage): Promise<void>;
  notifyMeetingBooked(meeting: Meeting): Promise<void>;
  notifyReplyReceived(reply: InboundEmail): Promise<void>;
}
```

**Tests**: `src/__tests__/services/SlackIntegration.test.ts`

**Validation**: `npm test -- --run SlackIntegration`

**Commit**: `feat(47.2): add Slack integration`

---

### T47.3: Create Integration Settings UI [M - 1hr]

**Description**: Settings page for managing integrations.

**Files**: `src/components/settings/IntegrationSettings.tsx`

**Implementation**: Cards for each integration with connect/disconnect, status, settings.

**Tests**: `src/__tests__/components/IntegrationSettings.test.tsx`

**Validation**: `npm test -- --run IntegrationSettings`

**Commit**: `feat(47.3): add integration settings UI`

---

### T47.4: Enhanced CSV Export [M - 45min]

**Description**: Export prospects with customizable columns.

**Files**: `src/services/BulkExporter.ts`

**Implementation**: Column selector, format options, filtered export.

**Tests**: `npm test -- --run BulkExporter`

**Commit**: `feat(47.4): enhance CSV export with column selection`

---

### T47.5: Zapier-Compatible Webhook Format [S - 30min]

**Description**: Format outgoing webhooks for Zapier compatibility.

**Files**: `src/services/WebhookDispatcher.ts`

**Implementation**: Add Zapier-friendly payload format option.

**Tests**: Add to existing WebhookDispatcher tests.

**Commit**: `feat(47.5): add Zapier-compatible webhook format`

---

### T47.6: Add Integration Status Dashboard [S - 45min]

**Description**: Dashboard widget showing integration health.

**Files**: `src/components/dashboard/IntegrationStatusCard.tsx`

**Implementation**: Show connected services, last sync time, error count.

**Tests**: `src/__tests__/components/IntegrationStatusCard.test.tsx`

**Commit**: `feat(47.6): add integration status dashboard card`

---

## Sprint 47 Demo Script

```bash
# Demo 1: HubSpot Sync
# 1. Connect HubSpot account
# 2. Show prospects syncing to HubSpot
# 3. Update in HubSpot, show change in app

# Demo 2: Slack Notifications
# 1. Configure Slack webhook
# 2. Book meeting
# 3. Show Slack notification

# Demo 3: Export
# 1. Select prospects
# 2. Choose columns for export
# 3. Download CSV with custom columns
```

---

# SPRINT 48: App Decomposition & Scalability [P3]

**Goal**: App.tsx monolith broken into maintainable pieces  
**Demo**: Code is modular, easy to navigate and test  
**Duration**: 6-8 hours  
**Depends On**: S41 (tests pass)  

## Exit Criteria
- [ ] App.tsx < 500 lines (down from 2,285)
- [ ] State management in dedicated modules
- [ ] Routes extracted to separate file
- [ ] Tab content in separate components

---

### T48.1: Extract Route Configuration [S - 30min]

**Description**: Move route definitions to dedicated file.

**Files**: 
- `src/routes/index.tsx` (CREATE)
- `src/App.tsx` (reduce)

**Implementation**: Create routes config, import into App.

**Tests**: Verify routing still works.

**Commit**: `refactor(48.1): extract route configuration`

---

### T48.2: Extract Tab Content Components [M - 1hr]

**Description**: Move tab content to separate files.

**Files**:
- `src/components/tabs/ProspectsTab.tsx`
- `src/components/tabs/SequencesTab.tsx`
- `src/components/tabs/DashboardTab.tsx`
- etc.

**Implementation**: Extract each tab's content into dedicated component.

**Tests**: Verify each tab renders correctly.

**Commit**: `refactor(48.2): extract tab content components`

---

### T48.3: Migrate State to AppContext [M - 1.5hr]

**Description**: Move App.tsx state into AppContext.

**Files**:
- `src/context/AppContext.tsx` (enhance)
- `src/App.tsx` (reduce)

**Implementation**: Move prospects, filters, selection state to context.

**Tests**: Verify state management works.

**Commit**: `refactor(48.3): migrate state to AppContext`

---

### T48.4: Extract Modal Handlers [M - 1hr]

**Description**: Move modal open/close logic to custom hooks.

**Files**:
- `src/hooks/useModalState.ts` (CREATE or enhance)
- `src/App.tsx` (reduce)

**Implementation**: Create hook for each modal's state and handlers.

**Tests**: Verify modals open/close correctly.

**Commit**: `refactor(48.4): extract modal handlers`

---

### T48.5: Extract Filter Logic [M - 1hr]

**Description**: Move filter state and logic to dedicated hook.

**Files**:
- `src/hooks/useProspectFilters.ts`
- `src/App.tsx` (reduce)

**Implementation**: All filter logic in hook, App only consumes.

**Tests**: Verify filters work correctly.

**Commit**: `refactor(48.5): extract filter logic`

---

### T48.6: Final App.tsx Cleanup [M - 1hr]

**Description**: Review App.tsx, move any remaining logic.

**Files**: `src/App.tsx`

**Validation**: `wc -l src/App.tsx` should be < 500.

**Commit**: `refactor(48.6): final App.tsx cleanup`

---

### T48.7: Add Architecture Documentation [S - 30min]

**Description**: Document the new component structure.

**Files**: `docs/ARCHITECTURE.md`

**Implementation**: Diagram of component hierarchy, state flow, key modules.

**Commit**: `docs(48.7): add architecture documentation`

---

## Sprint 48 Demo Script

```bash
# Demo: Code Quality
# 1. Show App.tsx line count < 500
# 2. Navigate codebase showing clear structure
# 3. Show component hierarchy in DevTools
# 4. Run tests proving nothing broke
```

---

# Appendix: Task Size Guide

| Size | Hours | Description |
|------|-------|-------------|
| XS | < 15min | Typo fix, config change |
| S | 15-45min | Single-file change, simple logic |
| M | 45min-2hr | Multi-file change, moderate complexity |
| L | 2-4hr | Feature implementation, multiple components |
| XL | 4+ hr | Should be broken down |

---

# Appendix: Validation Commands

```bash
# Type check
npx tsc --noEmit

# Unit tests
npm test -- --run

# E2E tests
npm run test:e2e

# Build
npm run build

# Bundle analysis
npm run build -- --report

# Lighthouse
npx lighthouse http://localhost:5173 --view
```

---

# Appendix: Commit Convention

```
<type>(<scope>): <description>

Types:
- feat: New feature
- fix: Bug fix
- refactor: Code change without feature/fix
- perf: Performance improvement
- test: Adding tests
- docs: Documentation
- chore: Maintenance
- security: Security-related changes

Scopes (use descriptive names, NOT task numbers):
- email: Email sending, tracking, templates
- sequence: Sequence enrollment, scheduling, state
- tests: Test infrastructure, factories, mocks
- a11y: Accessibility improvements
- bundle: Bundle size, lazy loading
- auth: Authentication, authorization
- webhook: Webhook handlers
- api: API endpoints
- ui: User interface components
- analytics: Metrics, dashboards, reporting

Examples:
- feat(email): add server-side spam blocking
- fix(tests): resolve async timing in useBulkEmailSend
- refactor(app): extract prospect filtering to hook
- test(e2e): add mobile viewport coverage
- security(api): audit CSRF protection
- perf(bundle): lazy load ROI calculator
```

---

**END OF SPRINT PLAN V41 (REVISED)**

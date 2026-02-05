# Sprint Plan V37: QA Gate & Email Integration Verification

**Status**: 🚀 ACTIVE  
**Created**: February 5, 2026  
**Goal**: Full end-to-end verification of all email sending paths and critical user flows  
**North Star**: All email buttons work, Railway integration is solid, no bugs in production

---

## Executive Summary

### Current State
- ✅ 174 test files pass (3928 tests)
- ✅ 318 email-related tests pass
- ✅ 142 Railway integration tests pass
- ✅ S36A-E complete (HitList filtering improvements)
- ✅ Deployed to production (https://gtm-yard-flow.vercel.app)

### QA Gate Objectives
1. **Email Sending Verification** - Every email button works end-to-end
2. **Railway Integration** - All Railway API calls succeed in production
3. **Button Audit** - Every button in the app performs its expected action
4. **Error Handling** - Graceful degradation when Railway is unavailable
5. **Data Consistency** - Firestore ↔ Railway data sync works correctly

### Critical Email Paths to Test
| Path | Component | Action | Expected Result |
|------|-----------|--------|-----------------|
| Company → Email All | CompanyListView | Click email icon | BulkEmailModal opens with company contacts |
| Prospect → Quick Email | ProspectDetailPanel | Click email button | Single email modal/compose |
| Bulk Select → Send | ProspectList | Select multiple → Send | BulkEmailModal with selected prospects |
| Sequence Enroll | ProspectDetailPanel | Click "Add to Sequence" | Enrollment modal opens |
| AI Generate | BulkEmailModal | Click "AI Generate" | Template generation works |

---

## Sprint Breakdown

| Sprint | Focus | Status | Demo |
|--------|-------|--------|------|
| **S37E** | Integration Test Hardening | 🔲 Not Started | No flaky tests, critical gaps filled |
| **S37B** | Railway Health Monitoring | 🔲 Not Started | Health status reflects real state |
| **S37A** | Manual E2E Verification | 🔲 Not Started | All email flows work in production |
| **S37C** | Error Boundary Testing | 🔲 Not Started | App recovers from failures gracefully |
| **S37D** | Button Action Audit | 🔲 Not Started | Every button works as expected |

**Reordered**: S37E first (fix flaky tests before manual testing), S37B second (verify Railway up before email tests)

---

## ⚠️ Critical Test Gaps Identified (from review)

| Gap | Risk | Priority |
|-----|------|----------|
| No tests for `/api/email/send` endpoint | Production email failures | **CRITICAL** |
| No test for `sendRecipient` actual fetch | Bulk send silently fails | **HIGH** |
| Missing 429 rate limit test for email | Cryptic user errors | **HIGH** |
| No partial batch success test | Wrong success/failure counts | **MEDIUM** |
| Missing idempotency collision test | Duplicate emails | **MEDIUM** |
| No Railway offline fallback test | Silent failures | **MEDIUM** |

---

## Sprint S37E: Integration Test Hardening (FIRST)

**Goal**: Fill critical test gaps before manual verification  
**Demo**: All email paths have automated coverage

---

### T37E.1: Add `/api/email/send` Endpoint Tests [M - CRITICAL]

**Files**: Create `src/__tests__/api/email-send.test.ts`

**Implementation**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Railway client
vi.mock('../../lib/railway-client', () => ({
  railwayServerClient: {
    post: vi.fn(),
  },
}));

describe('/api/email/send', () => {
  it('requires authentication', async () => {
    // Test 401 without token
  });

  it('validates required fields (to, subject, body)', async () => {
    // Test missing fields returns 400
  });

  it('routes to Railway when feature flag enabled', async () => {
    // Mock shouldUseRailwayEmail() => true
    // Verify railwayServerClient called
  });

  it('falls back to Firestore queue when Railway unavailable', async () => {
    // Mock Railway timeout
    // Verify Firestore fallback
  });

  it('respects idempotency key - prevents duplicate sends', async () => {
    // Send twice with same key
    // Verify only one email queued
  });

  it('returns 429 with user-friendly message on rate limit', async () => {
    // Mock Railway returning 429
    // Verify response.error is human-readable
  });
});
```

**Exit Criteria**: 6+ tests for email send endpoint.

---

### T37E.2: Add `sendRecipient` Integration Tests [M - HIGH]

**Files**: Update `src/__tests__/hooks/useBulkEmailSend.test.ts`

**Add Tests**:
```typescript
describe('sendRecipient', () => {
  it('sends email via /api/email/send with auth token', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => ({ success: true }) });
    
    const { result } = renderHook(() => useBulkEmailSend());
    act(() => result.current.initRecipients(mockProspects, 'Subject', 'Body'));
    act(() => result.current.approveRecipient('p1'));
    await act(async () => await result.current.sendRecipient('p1'));
    
    expect(mockFetch).toHaveBeenCalledWith('/api/email/send', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Idempotency-Key': expect.stringMatching(/^prospect-p1-/),
      }),
    }));
    expect(result.current.recipients[0].status).toBe('sent');
  });

  it('handles API 500 error gracefully', async () => {
    mockFetch.mockResolvedValueOnce({ 
      ok: false, 
      status: 500,
      json: () => ({ error: 'Internal error' }) 
    });
    
    await act(async () => await result.current.sendRecipient('p1'));
    
    expect(result.current.recipients[0].status).toBe('failed');
    expect(result.current.recipients[0].error).toBe('Internal error');
  });

  it('handles network timeout gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));
    
    await act(async () => await result.current.sendRecipient('p1'));
    
    expect(result.current.recipients[0].status).toBe('failed');
    expect(result.current.recipients[0].error).toContain('timeout');
  });

  it('continues sending after individual failures', async () => {
    // p1 fails, p2 succeeds - verify both attempted
  });
});

describe('idempotency', () => {
  it('prevents duplicate send with same idempotency key', async () => {
    // Call sendRecipient twice
    // Verify fetch called only once
  });
});
```

**Exit Criteria**: 5+ additional tests for send logic.

---

### T37E.3: Add Railway Circuit Breaker Tests [S - MEDIUM]

**Files**: Update `src/__tests__/services/RailwayApiClient.test.ts`

**Add Tests**:
```typescript
describe('circuit breaker', () => {
  it('opens after 3 consecutive failures', async () => {
    // Fail 3 times
    // 4th call should use fallback immediately
  });

  it('half-opens after recovery timeout', async () => {
    // Fail, wait, verify retry attempt
  });
});
```

**Exit Criteria**: Circuit breaker behavior verified.

---

### T37E.4: Add Partial Batch Success Test [S - MEDIUM]

**Files**: `src/__tests__/hooks/useBulkEmailSend.test.ts`

**Test**:
```typescript
it('shows correct counts when 2/5 emails succeed', async () => {
  // Mock: p1 succeeds, p2 fails, p3 succeeds, p4 fails, p5 succeeds
  // Verify: sentCount=3, failedCount=2
  // Verify: toast shows "Sent 3 of 5 emails (2 failed)"
});
```

**Exit Criteria**: Partial success counts accurate.

---

## Sprint S37A: Manual E2E Email Verification

**Goal**: Verify all email sending paths work in production  
**Demo**: Successfully send test email through each path

---

### T37A.1: Test Company-Level Email Button [M]

**Steps**:
1. Open https://gtm-yard-flow.vercel.app
2. Navigate to Hits tab (Company view)
3. Find a company with contacts that have emails
4. Click the email (✉️) icon in the Actions column
5. Verify BulkEmailModal opens with company contacts pre-selected
6. Compose a test email
7. Click "Approve All" then "Send"
8. Verify toast shows success
9. Check Railway dashboard for queued email

**Validation Script**:
```bash
# Check Railway email queue
curl -s "https://yardflow-hitlist-production-2f41.up.railway.app/api/email/stats" \
  -H "x-service-key: $RAILWAY_API_SECRET" | jq .
```

**Exit Criteria**: Email queued successfully in Railway.

---

### T37A.2: Test Prospect Detail Panel Email [M]

**Steps**:
1. Click on a prospect in People view
2. In the detail panel, click "Send Email" button
3. Verify compose modal opens
4. Send test email
5. Verify delivery

**Exit Criteria**: Single prospect email works.

---

### T37A.3: Test Bulk Selection Email [M]

**Steps**:
1. In People view, select 3+ prospects using checkboxes
2. Click "Email Selected" button in header
3. Verify BulkEmailModal opens with correct count
4. Use "AI Generate" to create personalized content
5. Preview each recipient
6. Approve and send
7. Verify all emails queued

**Exit Criteria**: Bulk email with AI personalization works.

---

### T37A.4: Test Sequence Enrollment [M]

**Steps**:
1. Select a prospect in People view
2. In detail panel, click "Add to Sequence"
3. Select a sequence from dropdown
4. Confirm enrollment
5. Verify enrollment appears in Railway

**Validation Script**:
```bash
# Check Railway enrollments
curl -s "https://yardflow-hitlist-production-2f41.up.railway.app/api/enrollments" \
  -H "x-service-key: $RAILWAY_API_SECRET" | jq '.items | length'
```

**Exit Criteria**: Prospect enrolled in sequence.

---

### T37A.5: Test Email Template Selection [S]

**Steps**:
1. Open BulkEmailModal
2. Click template dropdown
3. Verify templates load from Railway
4. Select a template
5. Verify content populates

**Exit Criteria**: Templates load and apply correctly.

---

## Sprint S37B: Railway Health Monitoring Verification

**Goal**: Ensure health indicators accurately reflect Railway status  
**Demo**: Health badge updates when Railway status changes

---

### T37B.1: Verify Health Check Endpoint [S]

**Test**:
```typescript
// src/__tests__/api/railway-health-e2e.test.ts
describe('Railway Health E2E', () => {
  it('returns healthy status when Railway is up', async () => {
    const response = await fetch('/api/railway/health');
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.status).toBe('healthy');
    expect(data.database).toBe('connected');
    expect(data.redis).toBe('connected');
  });
});
```

**Exit Criteria**: Health endpoint returns accurate status.

---

### T37B.2: Verify UI Health Indicator [S]

**Steps**:
1. Check sidebar shows "Connected" with green dot
2. Verify RailwayHealthCard in settings shows detailed status
3. Check SystemHealth component shows all subsystems

**Exit Criteria**: UI reflects Railway health accurately.

---

### T37B.3: Test Offline Mode Fallback [M]

**Steps**:
1. Simulate Railway unavailability (or wait for actual downtime)
2. Verify UI shows "Offline mode" indicator
3. Verify queued operations are stored locally
4. When Railway returns, verify queue processes

**Exit Criteria**: Graceful degradation works.

---

### T37B.4: Test Webhook → Railway Sync [M]

**Steps**:
1. Send email via Railway
2. Manually trigger SendGrid open event (or use ngrok + real email)
3. Verify `/api/webhooks/sendgrid` updates Firestore
4. If enrollment exists, verify Railway sync via `railwayServerClient.patch()`

**Validation**:
- Check `email_events` collection in Firestore
- Check Railway dashboard for updated enrollment status

**Exit Criteria**: Webhook events sync to both Firestore and Railway.

---

### T37B.5: Test Auth Bridge Session Refresh [S]

**Steps**:
1. Login to app
2. Wait for Railway session to near expiry (or mock timer)
3. Send email
4. Verify `ensureValidSession()` refreshes token automatically

**Exit Criteria**: No 401 errors during bulk send.

---

## Sprint S37C: Error Boundary & Recovery Testing

**Goal**: App recovers gracefully from all error conditions  
**Demo**: Errors show friendly messages, app doesn't crash

---

### T37C.1: Test Network Error Handling [M]

**Scenarios**:
- Railway API timeout → Show "Request timed out" + retry option
- 500 error from Railway → Show error toast + fallback UI
- Authentication failure → Prompt re-login
- Rate limit (429) → Show "Please wait" message

**Validation**: Each scenario shows appropriate error and app remains usable.

---

### T37C.2: Test Invalid Data Handling [S]

**Scenarios**:
- Prospect without email → Email button disabled
- Company without contacts → "No contacts" message
- Malformed API response → Error boundary catches

**Exit Criteria**: No unhandled exceptions.

---

### T37C.3: Test State Recovery [S]

**Scenarios**:
- Modal closes unexpectedly → State resets cleanly
- Filter state persists → Reload preserves filters
- Draft email preserved → Unsent content recoverable

**Exit Criteria**: App state is resilient.

---

## Sprint S37D: Button Action Audit

**Goal**: Every button performs its expected action  
**Demo**: Click every button, verify it works

---

### T37D.1: Navigation Buttons [S]

| Button | Location | Expected Action | Status |
|--------|----------|-----------------|--------|
| Dashboard tab | Sidebar | Shows dashboard | 🔲 |
| Hits tab | Sidebar | Shows HitList | 🔲 |
| Sequences tab | Sidebar | Shows sequences | 🔲 |
| Import tab | Sidebar | Shows import wizard | 🔲 |
| Integrations tab | Sidebar | Shows integrations | 🔲 |
| AI tab | Sidebar | Shows AI chat | 🔲 |
| ROI Calculator | Sidebar | Shows calculator | 🔲 |
| Settings gear | Header | Opens settings modal | 🔲 |

---

### T37D.2: HitList Action Buttons [M]

| Button | Location | Expected Action | Status |
|--------|----------|-----------------|--------|
| Company expand | Row chevron | Expands to show contacts | 🔲 |
| Email company | Actions column | Opens BulkEmailModal | 🔲 |
| Sequence company | Actions column | Opens enrollment modal | 🔲 |
| AI Research | Badge | Triggers AI research | 🔲 |
| Sort headers | Table header | Sorts by column | 🔲 |
| Quick filters | Sidebar | Applies filter preset | 🔲 |
| Clear filters | Sidebar | Resets all filters | 🔲 |
| View toggle | Sidebar | Switches Companies/People | 🔲 |

---

### T37D.3: Modal Action Buttons [M]

| Button | Modal | Expected Action | Status |
|--------|-------|-----------------|--------|
| Close (X) | Any modal | Closes modal | 🔲 |
| Cancel | BulkEmailModal | Closes without sending | 🔲 |
| AI Generate | BulkEmailModal | Generates AI content | 🔲 |
| Approve | BulkEmailModal | Marks email approved | 🔲 |
| Approve All | BulkEmailModal | Approves all emails | 🔲 |
| Send | BulkEmailModal | Sends approved emails | 🔲 |
| Preview toggle | BulkEmailModal | Shows recipient preview | 🔲 |

---

### T37D.4: Prospect Detail Panel Buttons [S]

| Button | Expected Action | Status |
|--------|-----------------|--------|
| Send Email | Opens email compose | 🔲 |
| Add to Sequence | Opens enrollment | 🔲 |
| Edit | Opens edit form | 🔲 |
| Copy email | Copies to clipboard | 🔲 |
| External links | Opens in new tab | 🔲 |

---

## Sprint S37E: Integration Test Hardening

**Goal**: Ensure all integration tests are reliable and comprehensive  
**Demo**: All tests pass consistently, no flaky tests

---

### T37E.1: Review Flaky Test Patterns [S]

**Check for**:
- Tests with `setTimeout` that may be timing-dependent
- Tests that depend on external services
- Tests with race conditions in async operations

**Action**: Add proper waitFor/act wrappers.

---

### T37E.2: Add Missing Edge Case Tests [M]

**Missing scenarios to test**:
- Empty prospect list → "No prospects found" message
- All emails suppressed → "No valid recipients" error
- Railway returns partial success → Correct success/failure counts
- Template variables missing data → Graceful fallback

---

### T37E.3: Add E2E Smoke Test Suite [L]

**Create**: `e2e/smoke.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('app loads without errors', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="sidebar-content"]')).toBeVisible();
  });

  test('can navigate to all tabs', async ({ page }) => {
    await page.goto('/');
    for (const tab of ['dashboard', 'prospects', 'sequences']) {
      await page.click(`[id="tab-${tab}"]`);
      await expect(page.locator(`[id="panel-${tab}"]`)).toBeVisible();
    }
  });

  test('health check returns ok', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBe(true);
  });
});
```

**Exit Criteria**: Smoke tests pass in CI.

---

## QA Checklist

### Pre-Deploy (CRITICAL)
- [ ] `npm run build` succeeds (no TypeScript errors)
- [ ] `npx tsc --noEmit` passes
- [ ] All 174+ test files pass locally
- [ ] Railway health check returns `healthy`
- [ ] SendGrid domain authentication verified (Settings → Sender Authentication)
- [ ] `RAILWAY_API_SECRET` matches Railway's `CRON_SECRET`
- [ ] No console errors in browser dev tools

### Email Flows (CRITICAL)
- [ ] Company → Email All works
- [ ] Prospect → Quick Email works
- [ ] Bulk Select → Send works
- [ ] Sequence enrollment works
- [ ] AI template generation works
- [ ] Email templates load from Railway
- [ ] **Email send with suppressed address blocked**
- [ ] **Bulk send partial failure shows correct counts**
- [ ] **Rate limit (429) shows user-friendly message**
- [ ] **Idempotency prevents duplicate on double-click**

### Railway Integration
- [ ] Sidebar shows "Connected" with green dot
- [ ] Health card shows database/redis/queue status
- [ ] Offline mode indicator appears when disconnected
- [ ] **Webhook events sync to Firestore AND Railway**
- [ ] **Auth token auto-refreshes during bulk send**

### UI/UX
- [ ] All navigation tabs work
- [ ] All 8 quick filters apply correctly
- [ ] Column sorting works (asc/desc toggle)
- [ ] Multi-tier filter works (T1+T2 simultaneous)
- [ ] Search filters prospects
- [ ] Column customization (show/hide) persists
- [ ] Modals open and close properly

### Error Handling
- [ ] Network errors show friendly messages
- [ ] Invalid data doesn't crash app
- [ ] Offline mode degrades gracefully

---

## Rollback Plan

If critical bugs found in production:

1. **Immediate**: Revert to last known good commit
   ```bash
   git revert HEAD~1  # Revert last commit
   git push origin main
   ```

2. **Disable Feature**: Set feature flag to disable problematic feature
   ```bash
   # In Vercel dashboard, set:
   VITE_RAILWAY_EMAIL_ENABLED=false
   ```

3. **Hotfix**: Create fix branch, test, merge
   ```bash
   git checkout -b hotfix/issue-description
   # Fix, test, commit
   git push origin hotfix/issue-description
   # Create PR, merge after review
   ```

---

## Key Files for QA

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app entry, all handlers |
| `src/components/BulkEmailModal.tsx` | Bulk email UI |
| `src/hooks/useBulkEmailSend.ts` | Email sending logic |
| `src/services/RailwayApiClient.ts` | Railway API calls |
| `api/railway/[...path].ts` | Railway proxy |
| `api/webhooks/sendgrid.ts` | Email event handling |

---

## Next Steps After QA Gate

1. **S36F**: Data Quality Indicators (if not blocked by QA issues)
2. **Monitoring**: Add Sentry error tracking if not present
3. **Analytics**: Track email send success rates
4. **Documentation**: Update RUNBOOK with new flows

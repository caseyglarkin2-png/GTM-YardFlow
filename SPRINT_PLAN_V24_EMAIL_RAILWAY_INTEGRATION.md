# Sprint Plan V24: Railway Email Integration

**Goal:** Enable bulk email sending through Railway backend (Postgres/BullMQ/SendGrid) with full E2E tracking.

**Date Created:** 2026-02-02  
**Target Completion:** 2026-02-05 (3-day sprint)  
**Owner:** Engineering Lead

---

## Executive Summary

### Current State
- ✅ Railway proxy exists at `api/railway/[...path].ts` with rate limiting (100/min) and circuit breaker
- ✅ S2S auth configured (`RAILWAY_API_SECRET` = `CRON_SECRET`)
- ✅ BulkEmailModal UI complete (Sprint 22A)
- ✅ Railway API client exists (`RailwayApiClient.ts`) with `email.send()` method
- ⚠️ **BUT**: BulkEmailModal routes to local `/api/email/send` (Firestore), NOT Railway
- ⚠️ Feature flag `VITE_RAILWAY_EMAIL_ENABLED` exists but is not wired into bulk email flow

### Target State
- GTM UI → Railway `/api/outreach/send-email` → BullMQ Queue → SendGrid
- Webhooks update Firestore for display (source of truth stays in Firestore)
- Full tracking: sent → delivered → opened → clicked → replied → meeting

### Risk Assessment
| Risk | Mitigation |
|------|------------|
| Railway down | Feature flag fallback to local `/api/email/send` |
| Rate limits | Circuit breaker + batch delays |
| Webhook failures | Idempotent handlers, retry queue |
| Auth mismatch | S0 validates all secrets match |

---

## Environment Variable Checklist

### Vercel (GTM-YardFlow)

```bash
# Required for Railway integration
RAILWAY_API_URL=https://yardflow-hitlist-production.up.railway.app  # Your Railway URL
RAILWAY_API_SECRET=<same-as-railway-CRON_SECRET>
CRON_SECRET=<same-value>  # Fallback, must match RAILWAY_API_SECRET
SERVICE_TO_SERVICE_SECRET=<same-value>  # Optional fallback

# Feature Flags (enable after S1 validation)
VITE_RAILWAY_ENABLED=true
VITE_RAILWAY_EMAIL_ENABLED=true

# SendGrid (for local fallback)
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=noreply@yardflow.io
SENDGRID_WEBHOOK_VERIFICATION_KEY=<from-sendgrid-settings>

# Webhook Secrets
CALENDLY_WEBHOOK_SECRET=<calendly-secret>
```

### Railway (YardFlow-Hitlist)

```bash
# Must match Vercel's RAILWAY_API_SECRET
CRON_SECRET=<same-value-as-vercel>

# SendGrid
SENDGRID_API_KEY=SG.xxxxx

# Database
DATABASE_URL=postgres://...
REDIS_URL=redis://...
```

---

## Dependency Matrix

```
S0 (Secrets) ─────┬─────> S1 (E2E Test)
                  │
                  └─────> S2 (Frontend Wire) ──────> S3 (Error Handling)
                                      │
                                      └───────────> S4 (Monitoring)
```

| Sprint | Depends On | Blocks |
|--------|------------|--------|
| S0 | None | S1, S2 |
| S1 | S0 | S2 (soft), S3 |
| S2 | S0, S1 (soft) | S3, S4 |
| S3 | S1, S2 | S4 |
| S4 | S2, S3 | None |

---

## Sprint S0: Secrets Verification ⏱️ 45 min

**Goal:** Validate all environment variables are correctly configured and S2S auth works.

### T0.1: Document Required Secrets [XS - 15 min]
**Files:** `docs/ENV_RAILWAY_EMAIL.md` (NEW)  
**Description:** Create environment variable reference document for Railway email integration.  
**Validation:** Document exists with all required variables listed.

### T0.2: Verify Vercel Environment Variables [XS - 15 min]
**Files:** None (Vercel Dashboard)  
**Description:**  
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Verify `RAILWAY_API_URL` is set and valid URL
3. Verify `RAILWAY_API_SECRET` matches Railway's `CRON_SECRET`
4. Verify `VITE_RAILWAY_ENABLED=true` (or set it)
5. Verify `VITE_RAILWAY_EMAIL_ENABLED=true` (or set it)

**Validation:**
```bash
# From terminal (requires vercel CLI or manual check)
# Check Railway health through proxy
curl -X GET "https://your-app.vercel.app/api/railway/health" \
  -H "Authorization: Bearer $RAILWAY_API_SECRET"
# Expected: { "status": "healthy", ... }
```

### T0.3: Verify Railway Environment Variables [XS - 15 min]
**Files:** None (Railway Dashboard)  
**Description:**  
1. Go to Railway Dashboard → Your Service → Variables
2. Verify `CRON_SECRET` value matches Vercel's `RAILWAY_API_SECRET`
3. Verify `SENDGRID_API_KEY` is set
4. Verify database/Redis URLs are valid

**Validation:**
```bash
# Direct Railway health check
curl -X GET "https://your-railway-url.up.railway.app/api/health"
# Expected: { "status": "healthy", "checks": { "database": {...}, "redis": {...}, "queues": {...} } }
```

### T0.4: Test S2S Auth Flow [S - 30 min]
**Files:** Create `scripts/test-railway-auth.ts` (NEW)  
**Description:** Script to test full auth chain from Vercel to Railway.  

```typescript
// scripts/test-railway-auth.ts
import { railwayServerClient } from '../lib/railway-client';

async function testAuth() {
  console.log('Testing Railway S2S Auth...');
  console.log('RAILWAY_API_URL:', process.env.RAILWAY_API_URL ? '✓ Set' : '✗ Missing');
  console.log('SERVICE_KEY:', process.env.SERVICE_TO_SERVICE_SECRET || process.env.RAILWAY_API_SECRET ? '✓ Set' : '✗ Missing');
  
  try {
    const health = await railwayServerClient.healthCheck();
    console.log('✓ Health check passed:', health.status);
    return true;
  } catch (error) {
    console.error('✗ Health check failed:', error);
    return false;
  }
}

testAuth().then(ok => process.exit(ok ? 0 : 1));
```

**Validation:**
```bash
npx tsx scripts/test-railway-auth.ts
# Expected: "✓ Health check passed: healthy"
```

**Sprint S0 Exit Criteria:**
- [ ] All environment variables documented
- [ ] Vercel env vars verified in dashboard
- [ ] Railway env vars verified in dashboard  
- [ ] `curl /api/railway/health` returns 200 with healthy status
- [ ] `scripts/test-railway-auth.ts` passes

---

## Sprint S1: End-to-End Email Send [M - 2 hours]

**Goal:** Verify complete email path: GTM API → Railway → SendGrid → Webhook → Firestore

### T1.1: Add `/api/outreach/send-email` to Allowed Paths [XS - 10 min]
**Files:** `api/railway/[...path].ts`  
**Description:** Verify `/api/outreach/send-email` is in `ALLOWED_PATHS` array.  

**Current State:** Already present at line 131:
```typescript
'/api/outreach/send-email',
```

**Validation:**
```bash
grep -n "outreach/send-email" api/railway/\[...path\].ts
# Should show the path in ALLOWED_PATHS
```

### T1.2: Create Railway Email Test Script [S - 30 min]
**Files:** `scripts/test-railway-email-e2e.ts` (NEW)  
**Description:** Script to send a test email through Railway and verify delivery.

```typescript
// scripts/test-railway-email-e2e.ts
import { railwayServerClient } from '../lib/railway-client';

async function testEmailE2E() {
  const testEmail = process.env.TEST_EMAIL || 'your-test@email.com';
  
  console.log('📧 Testing Railway Email E2E...');
  console.log('Test recipient:', testEmail);
  
  try {
    const response = await railwayServerClient.post('/api/outreach/send-email', {
      to: testEmail,
      subject: `[Test] Railway Email E2E - ${new Date().toISOString()}`,
      body: 'This is a test email from the GTM-YardFlow Railway integration.',
      htmlBody: '<p>This is a <strong>test email</strong> from the GTM-YardFlow Railway integration.</p>',
      trackOpens: true,
      trackClicks: true,
    });
    
    console.log('✓ Email queued:', response);
    return true;
  } catch (error) {
    console.error('✗ Email send failed:', error);
    return false;
  }
}

testEmailE2E().then(ok => process.exit(ok ? 0 : 1));
```

**Validation:**
```bash
TEST_EMAIL=your-test@example.com npx tsx scripts/test-railway-email-e2e.ts
# Check your inbox for the test email
```

### T1.3: Test Email via Vercel Proxy (Browser Path) [S - 30 min]
**Files:** Create `scripts/test-railway-email-proxy.ts` (NEW)  
**Description:** Test email sending through the Vercel proxy (simulates browser flow).

```typescript
// scripts/test-railway-email-proxy.ts
// This tests the /api/railway/* proxy path that browser clients use

async function testEmailViaProxy() {
  const testEmail = process.env.TEST_EMAIL || 'your-test@email.com';
  const vercelUrl = process.env.VERCEL_URL || 'http://localhost:3000';
  
  console.log('📧 Testing Railway Email via Vercel Proxy...');
  console.log('Proxy URL:', `${vercelUrl}/api/railway/outreach/send-email`);
  
  try {
    const response = await fetch(`${vercelUrl}/api/railway/outreach/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Browser requests won't have this, but proxy adds it
      },
      body: JSON.stringify({
        to: testEmail,
        subject: `[Proxy Test] Railway Email - ${new Date().toISOString()}`,
        body: 'This is a test email sent through the Vercel proxy.',
        trackOpens: true,
      }),
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', data);
    
    return response.ok;
  } catch (error) {
    console.error('✗ Proxy test failed:', error);
    return false;
  }
}

testEmailViaProxy().then(ok => process.exit(ok ? 0 : 1));
```

**Validation:**
```bash
# Run local dev server first: npm run dev
TEST_EMAIL=your-test@example.com VERCEL_URL=http://localhost:5173 npx tsx scripts/test-railway-email-proxy.ts
```

### T1.4: Verify SendGrid Webhook Receives Events [S - 30 min]
**Files:** `api/webhooks/sendgrid.ts` (verify)  
**Description:** After sending test email, verify webhook receives delivery events.

**Steps:**
1. Send test email (T1.2 or T1.3)
2. Wait 1-2 minutes for SendGrid to deliver
3. Check Firestore `email_events` collection for delivery event
4. Check Firestore `email_stats` collection for updated stats

**Validation:**
```bash
# Check Firestore via Firebase Console or:
# Create a quick script to query email_events
cat << 'EOF' > scripts/check-email-events.ts
import { getAdminDb } from '../lib/firebaseAdmin';

async function checkEvents() {
  const db = getAdminDb();
  const events = await db.collection('email_events')
    .orderBy('receivedAt', 'desc')
    .limit(5)
    .get();
  
  events.docs.forEach(doc => {
    console.log(doc.id, doc.data().type, doc.data().email);
  });
}

checkEvents();
EOF
npx tsx scripts/check-email-events.ts
```

### T1.5: Document E2E Test Results [XS - 15 min]
**Files:** `docs/RAILWAY_EMAIL_E2E_TEST.md` (NEW)  
**Description:** Document the E2E test results with timestamps and evidence.

**Template:**
```markdown
# Railway Email E2E Test Results

**Date:** YYYY-MM-DD HH:MM
**Tester:** [Name]

## Test 1: Direct Railway API
- Sent at: [timestamp]
- Response: { id: "...", status: "queued" }
- Received at: [timestamp]
- Latency: X seconds

## Test 2: Via Vercel Proxy
- Sent at: [timestamp]  
- Response: [status code + body]
- Received at: [timestamp]

## Test 3: Webhook Events
- `delivered` event at: [timestamp]
- Firestore doc ID: [id]
```

**Sprint S1 Exit Criteria:**
- [ ] Test email sent via Railway API directly
- [ ] Test email sent via Vercel proxy
- [ ] Email received in inbox
- [ ] SendGrid webhook fired and recorded in Firestore
- [ ] E2E test documented

---

## Sprint S2: Frontend Integration [L - 4 hours]

**Goal:** Wire BulkEmailModal to use Railway API with feature flag support.

### T2.1: Create `useRailwayEmail` Hook [M - 1 hour]
**Files:** `src/hooks/useRailwayEmail.ts` (NEW)  
**Description:** Custom hook to send emails via Railway with fallback to local API.

```typescript
// src/hooks/useRailwayEmail.ts
import { useCallback, useState } from 'react';
import { railwayClient } from '@/services/RailwayApiClient';
import { shouldUseRailwayEmail } from '@/config/featureFlags';
import { useAuth } from '@/lib/firebase';

interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  body: string;
  htmlBody?: string;
  prospectId?: string;
  metadata?: Record<string, unknown>;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  usedRailway: boolean;
}

export function useRailwayEmail() {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const sendEmail = useCallback(async (params: SendEmailParams): Promise<SendResult> => {
    setIsLoading(true);
    
    try {
      // Check feature flag
      if (shouldUseRailwayEmail()) {
        // Use Railway
        const result = await railwayClient.email.send({
          to: params.to,
          subject: params.subject,
          body: params.body,
          htmlBody: params.htmlBody,
          prospectId: params.prospectId,
          trackOpens: true,
          trackClicks: true,
        });

        if (result.ok && result.data) {
          return {
            success: true,
            messageId: result.data.id,
            usedRailway: true,
          };
        } else {
          // Fall through to local fallback
          console.warn('[Email] Railway failed, falling back to local:', result.error);
        }
      }

      // Fallback: Local /api/email/send
      const token = await user?.getIdToken();
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: params.to,
          toName: params.toName,
          subject: params.subject,
          html: params.htmlBody,
          text: params.body,
          metadata: params.metadata,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          messageId: data.messageId,
          usedRailway: false,
        };
      } else {
        const error = await response.text();
        return { success: false, error, usedRailway: false };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        usedRailway: false,
      };
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return { sendEmail, isLoading };
}
```

**Validation:**
```bash
npm run test -- --run src/__tests__/hooks/useRailwayEmail.test.ts
```

### T2.2: Create `useRailwayEmail` Test [S - 30 min]
**Files:** `src/__tests__/hooks/useRailwayEmail.test.ts` (NEW)  
**Description:** Unit tests for the new hook.

```typescript
// src/__tests__/hooks/useRailwayEmail.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRailwayEmail } from '../../hooks/useRailwayEmail';

// Mock dependencies
vi.mock('@/services/RailwayApiClient', () => ({
  railwayClient: {
    email: {
      send: vi.fn(),
    },
  },
}));

vi.mock('@/config/featureFlags', () => ({
  shouldUseRailwayEmail: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({
  useAuth: () => ({ user: { getIdToken: () => Promise.resolve('test-token') } }),
}));

import { railwayClient } from '@/services/RailwayApiClient';
import { shouldUseRailwayEmail } from '@/config/featureFlags';

describe('useRailwayEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends via Railway when feature flag enabled', async () => {
    (shouldUseRailwayEmail as any).mockReturnValue(true);
    (railwayClient.email.send as any).mockResolvedValue({
      ok: true,
      data: { id: 'msg-123', status: 'queued' },
    });

    const { result } = renderHook(() => useRailwayEmail());
    
    let sendResult: any;
    await act(async () => {
      sendResult = await result.current.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        body: 'Hello',
      });
    });

    expect(sendResult.success).toBe(true);
    expect(sendResult.usedRailway).toBe(true);
    expect(railwayClient.email.send).toHaveBeenCalled();
  });

  it('falls back to local API when Railway disabled', async () => {
    (shouldUseRailwayEmail as any).mockReturnValue(false);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messageId: 'local-123' }),
    });

    const { result } = renderHook(() => useRailwayEmail());
    
    let sendResult: any;
    await act(async () => {
      sendResult = await result.current.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        body: 'Hello',
      });
    });

    expect(sendResult.success).toBe(true);
    expect(sendResult.usedRailway).toBe(false);
    expect(railwayClient.email.send).not.toHaveBeenCalled();
  });
});
```

**Validation:**
```bash
npm run test -- --run src/__tests__/hooks/useRailwayEmail.test.ts
```

### T2.3: Update App.tsx Bulk Email Handler [M - 1 hour]
**Files:** `src/App.tsx`  
**Description:** Replace direct fetch to `/api/email/send` with `useRailwayEmail` hook.

**Current code (lines 810-830):**
```typescript
const response = await fetch('/api/email/send', {
  method: 'POST',
  // ...
});
```

**New code:**
```typescript
// Add hook at component level
const { sendEmail: sendEmailViaRailway } = useRailwayEmail();

// In handleBulkEmailConfirm:
const result = await sendEmailViaRailway({
  to: prospect.email!,
  toName: prospect.name,
  subject: personalizedSubject,
  body: personalizedBody,
  htmlBody: `<div style="...">${personalizedBody.split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('')}</div>`,
  prospectId: prospect.id,
  metadata: {
    prospectId: prospect.id,
    prospectName: prospect.name,
    source: 'BulkEmail',
    templateId,
  },
});

if (result.success) {
  sent++;
  console.log(`Email sent to ${prospect.email} via ${result.usedRailway ? 'Railway' : 'Local'}`);
} else {
  failed++;
  console.error(`Failed to send to ${prospect.email}:`, result.error);
}
```

**Validation:**
```bash
npx tsc --noEmit
npm run test -- --run
# UI test: Select 2 prospects → Bulk Email → Send → Check console for "via Railway/Local"
```

### T2.4: Add Railway Status Indicator to BulkEmailModal [S - 30 min]
**Files:** `src/components/BulkEmailModal.tsx`  
**Description:** Show whether email will route through Railway or local fallback.

**Add to modal header:**
```tsx
import { shouldUseRailwayEmail } from '@/config/featureFlags';
import { useRailwayStatus } from '@/hooks/useRailwayStatus';

// Inside component:
const { isHealthy } = useRailwayStatus();
const willUseRailway = shouldUseRailwayEmail() && isHealthy;

// In header area:
<div className="flex items-center gap-2">
  <span className={`w-2 h-2 rounded-full ${willUseRailway ? 'bg-green-500' : 'bg-yellow-500'}`} />
  <span className="text-xs text-slate-500">
    {willUseRailway ? 'Sending via Railway' : 'Sending via Local'}
  </span>
</div>
```

**Validation:**
- With `VITE_RAILWAY_EMAIL_ENABLED=true`: Shows "Sending via Railway" with green dot
- With `VITE_RAILWAY_EMAIL_ENABLED=false`: Shows "Sending via Local" with yellow dot

### T2.5: Add Batch Delay for Bulk Sends [S - 30 min]
**Files:** `src/App.tsx`  
**Description:** Add delay between emails to avoid hitting Railway rate limits.

```typescript
// In handleBulkEmailConfirm loop:
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000; // 1 second between batches

for (let i = 0; i < eligibleProspects.length; i++) {
  const prospect = eligibleProspects[i];
  
  // ... send email logic ...
  
  // Delay every BATCH_SIZE emails
  if ((i + 1) % BATCH_SIZE === 0 && i < eligibleProspects.length - 1) {
    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
  }
}
```

**Validation:**
- Send 25 emails, verify ~2.5 second total time (2 batch delays)
- No rate limit errors in console

### T2.6: Integration Test: Bulk Email Flow [M - 1 hour]
**Files:** `src/__tests__/integration/bulk-email-railway.test.ts` (NEW)  
**Description:** Integration test for full bulk email flow.

```typescript
// src/__tests__/integration/bulk-email-railway.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BulkEmailModal } from '../../components/BulkEmailModal';

describe('Bulk Email Railway Integration', () => {
  const mockProspects = [
    { id: '1', name: 'John Doe', email: 'john@acme.com', company: 'Acme', title: 'VP' },
    { id: '2', name: 'Jane Smith', email: 'jane@corp.com', company: 'Corp', title: 'Director' },
    { id: '3', name: 'No Email', email: null, company: 'None', title: 'Unknown' },
  ];

  it('shows correct eligible count excluding prospects without email', () => {
    render(
      <BulkEmailModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={async () => {}}
        selectedProspects={mockProspects as any}
        isSending={false}
      />
    );

    expect(screen.getByText('2 prospects will receive this email')).toBeInTheDocument();
    expect(screen.getByText(/1 prospect.* will be skipped/)).toBeInTheDocument();
  });

  it('disables send button when no eligible prospects', () => {
    render(
      <BulkEmailModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={async () => {}}
        selectedProspects={[{ id: '1', name: 'Test', email: null, company: 'X', title: 'Y' }] as any}
        isSending={false}
      />
    );

    const sendButton = screen.getByRole('button', { name: /send to 0 prospects/i });
    expect(sendButton).toBeDisabled();
  });
});
```

**Validation:**
```bash
npm run test -- --run src/__tests__/integration/bulk-email-railway.test.ts
```

**Sprint S2 Exit Criteria:**
- [ ] `useRailwayEmail` hook created and tested
- [ ] App.tsx bulk email uses the new hook
- [ ] Railway status indicator visible in modal
- [ ] Batch delay implemented (10 per second)
- [ ] Integration tests pass
- [ ] Manual test: Send 5 bulk emails, verify in inbox

---

## Sprint S3: Error Handling & Retry Logic [M - 2 hours]

**Goal:** Robust error handling with automatic retries and user feedback.

### T3.1: Enhance Railway Client Error Handling [S - 30 min]
**Files:** `src/services/RailwayApiClient.ts`  
**Description:** Improve error classification and retry logic.

**Add error types:**
```typescript
export type RailwayErrorType = 
  | 'network' 
  | 'auth' 
  | 'rate_limit' 
  | 'server' 
  | 'validation' 
  | 'unknown';

export function classifyError(statusCode: number, error?: string): RailwayErrorType {
  if (statusCode === 401 || statusCode === 403) return 'auth';
  if (statusCode === 429) return 'rate_limit';
  if (statusCode >= 400 && statusCode < 500) return 'validation';
  if (statusCode >= 500) return 'server';
  if (statusCode === 0) return 'network';
  return 'unknown';
}
```

**Validation:**
```bash
npm run test -- --run src/__tests__/services/RailwayApiClient.test.ts
```

### T3.2: Add Circuit Breaker to useRailwayEmail [S - 30 min]
**Files:** `src/hooks/useRailwayEmail.ts`  
**Description:** Local circuit breaker for repeated Railway failures.

```typescript
// Track failures
const failureCount = useRef(0);
const lastFailure = useRef(0);
const FAILURE_THRESHOLD = 3;
const RECOVERY_TIME_MS = 30000;

// Before sending:
const now = Date.now();
if (failureCount.current >= FAILURE_THRESHOLD) {
  if (now - lastFailure.current < RECOVERY_TIME_MS) {
    console.warn('[Email] Circuit breaker open, using fallback');
    // Skip Railway, go straight to fallback
  } else {
    failureCount.current = 0; // Reset after recovery period
  }
}

// After Railway failure:
failureCount.current++;
lastFailure.current = now;
```

**Validation:**
- Test: Mock 3 Railway failures, verify 4th request skips Railway

### T3.3: Add Retry Button for Failed Emails [M - 1 hour]
**Files:** `src/components/BulkEmailModal.tsx`, `src/App.tsx`  
**Description:** Allow retrying failed emails from the bulk send.

**Add to BulkEmailProgress:**
```typescript
interface BulkEmailProgress {
  sent: number;
  total: number;
  failed: number;
  failedProspects: Array<{ id: string; email: string; error: string }>;
}
```

**Add retry UI in modal:**
```tsx
{progress.failedProspects?.length > 0 && !isSending && (
  <div className="mt-4 p-3 bg-red-50 rounded-lg">
    <div className="flex items-center justify-between">
      <span className="text-sm text-red-700">
        {progress.failedProspects.length} emails failed
      </span>
      <button
        onClick={() => onRetryFailed(progress.failedProspects)}
        className="text-sm font-medium text-red-600 hover:text-red-700"
      >
        Retry Failed
      </button>
    </div>
  </div>
)}
```

**Validation:**
- Simulate failure → See retry button → Click → Resend

### T3.4: Log Failed Emails to Firestore [S - 30 min]
**Files:** `src/App.tsx`  
**Description:** Store failed email attempts for debugging.

```typescript
// After bulk send completes with failures:
if (failedProspects.length > 0) {
  await db.collection('email_failures').add({
    timestamp: Date.now(),
    userId: user?.uid,
    failedProspects: failedProspects.map(p => ({
      prospectId: p.id,
      email: p.email,
      error: p.error,
    })),
    templateId,
    totalAttempted: eligibleProspects.length,
    totalFailed: failedProspects.length,
  });
}
```

**Validation:**
- Check Firestore `email_failures` collection after failed send

**Sprint S3 Exit Criteria:**
- [ ] Error classification working
- [ ] Local circuit breaker prevents cascade failures
- [ ] Retry button visible for failed emails
- [ ] Failed emails logged to Firestore
- [ ] Recovery works after circuit breaker timeout

---

## Sprint S4: Monitoring & Stats Dashboard [M - 2 hours]

**Goal:** Real-time visibility into email send status and Railway health.

### T4.1: Create Email Stats API Endpoint [S - 30 min]
**Files:** `api/email/railway-stats.ts` (NEW)  
**Description:** Endpoint to fetch Railway email stats.

```typescript
// api/email/railway-stats.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { railwayServerClient } from '../../lib/railway-client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const [queueStatus, analytics] = await Promise.all([
      railwayServerClient.get('/api/email/queue/status'),
      railwayServerClient.get('/api/email/analytics', { period: 'day' }),
    ]);

    res.json({
      queue: queueStatus,
      analytics,
      railwayHealthy: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.json({
      queue: null,
      analytics: null,
      railwayHealthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
}
```

**Validation:**
```bash
curl http://localhost:5173/api/email/railway-stats
# Expected: { queue: {...}, analytics: {...}, railwayHealthy: true }
```

### T4.2: Create useEmailStats Hook [S - 30 min]
**Files:** `src/hooks/useEmailStats.ts` (NEW or update existing)  
**Description:** Hook to fetch and cache email stats.

```typescript
// src/hooks/useEmailStats.ts
import { useState, useEffect, useCallback } from 'react';

interface EmailStats {
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  } | null;
  analytics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    openRate: number;
  } | null;
  railwayHealthy: boolean;
  lastUpdated: Date | null;
}

export function useEmailStats(refreshInterval = 30000) {
  const [stats, setStats] = useState<EmailStats>({
    queue: null,
    analytics: null,
    railwayHealthy: false,
    lastUpdated: null,
  });
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/email/railway-stats');
      const data = await response.json();
      setStats({
        queue: data.queue?.queues?.emails || null,
        analytics: data.analytics?.metrics || null,
        railwayHealthy: data.railwayHealthy,
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error('Failed to fetch email stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [refresh, refreshInterval]);

  return { stats, isLoading, refresh };
}
```

**Validation:**
```bash
npm run test -- --run src/__tests__/hooks/useEmailStats.test.ts
```

### T4.3: Create EmailStatsCard Component [M - 1 hour]
**Files:** `src/components/EmailStatsCard.tsx` (update existing or create)  
**Description:** Visual component to display email stats.

**Features:**
- Queue status (waiting, active, completed, failed)
- Today's metrics (sent, delivered, opened, clicked)
- Railway health indicator
- Auto-refresh every 30s

```tsx
// src/components/EmailStatsCard.tsx
import React from 'react';
import { useEmailStats } from '@/hooks/useEmailStats';
import { LazyIcon } from './icons';

export function EmailStatsCard() {
  const { stats, isLoading, refresh } = useEmailStats();

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">Email Queue</h3>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${stats.railwayHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-slate-500">
            {stats.railwayHealthy ? 'Railway Online' : 'Railway Offline'}
          </span>
          <button onClick={refresh} disabled={isLoading} className="p-1 hover:bg-slate-100 rounded">
            <LazyIcon name="RefreshCw" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {stats.queue ? (
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{stats.queue.waiting}</div>
            <div className="text-xs text-slate-500">Queued</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600">{stats.queue.active}</div>
            <div className="text-xs text-slate-500">Sending</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{stats.queue.completed}</div>
            <div className="text-xs text-slate-500">Sent</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{stats.queue.failed}</div>
            <div className="text-xs text-slate-500">Failed</div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-slate-400">
          {isLoading ? 'Loading...' : 'Stats unavailable'}
        </div>
      )}

      {stats.analytics && (
        <div className="mt-4 pt-4 border-t">
          <div className="text-xs text-slate-500 mb-2">Today's Performance</div>
          <div className="flex gap-4 text-sm">
            <span>{stats.analytics.sent} sent</span>
            <span>{stats.analytics.openRate.toFixed(1)}% opened</span>
            <span>{stats.analytics.bounced} bounced</span>
          </div>
        </div>
      )}

      {stats.lastUpdated && (
        <div className="text-xs text-slate-400 mt-2">
          Updated {stats.lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
```

**Validation:**
- Component renders with mock data
- Refresh button works
- Auto-refresh every 30s

### T4.4: Add EmailStatsCard to Dashboard [XS - 15 min]
**Files:** `src/App.tsx` or Dashboard component  
**Description:** Add stats card to main dashboard.

**Validation:**
- Stats card visible on dashboard
- Shows real-time queue status

**Sprint S4 Exit Criteria:**
- [ ] `/api/email/railway-stats` returns queue + analytics
- [ ] `useEmailStats` hook fetches and caches
- [ ] EmailStatsCard displays queue status
- [ ] Railway health indicator working
- [ ] Auto-refresh every 30 seconds
- [ ] Card visible on dashboard

---

## Rollback Plan

### Immediate Rollback (< 5 min)
1. Set `VITE_RAILWAY_EMAIL_ENABLED=false` in Vercel dashboard
2. Redeploy (automatic on env change)
3. Emails will route through local `/api/email/send`

### Full Rollback (15 min)
1. Revert App.tsx to use direct `/api/email/send` fetch
2. Remove `useRailwayEmail` hook import
3. Deploy

### Rollback Triggers
- Railway returns 5xx for > 5 consecutive requests
- Email delivery rate drops below 80%
- Queue depth exceeds 1000 (backlog)
- User reports: emails not arriving

---

## Testing Checklist

### Before Deploying to Production

- [ ] **S0:** All env vars verified
- [ ] **S1:** E2E email sends and webhook fires
- [ ] **S2:** Bulk send of 10 emails works (test account)
- [ ] **S3:** Circuit breaker triggers after 3 failures
- [ ] **S4:** Stats dashboard shows queue status

### Production Smoke Test

1. Send 1 test email via bulk modal → Verify delivery
2. Check Railway health in stats card
3. Send 5 emails → Verify all 5 delivered
4. Check Firestore `email_events` for tracking data

---

## Sprint Summary

| Sprint | Tasks | Est. Time | Deliverable |
|--------|-------|-----------|-------------|
| S0 | T0.1-T0.4 | 45 min | Verified secrets, S2S auth working |
| S1 | T1.1-T1.5 | 2 hours | E2E email flow proven |
| S2 | T2.1-T2.6 | 4 hours | Frontend wired to Railway |
| S3 | T3.1-T3.4 | 2 hours | Error handling complete |
| S4 | T4.1-T4.4 | 2 hours | Monitoring dashboard |

**Total Estimated Time:** ~11 hours (3 days with buffer)

---

## Files Modified/Created

### New Files
- `docs/ENV_RAILWAY_EMAIL.md`
- `scripts/test-railway-auth.ts`
- `scripts/test-railway-email-e2e.ts`
- `scripts/test-railway-email-proxy.ts`
- `scripts/check-email-events.ts`
- `docs/RAILWAY_EMAIL_E2E_TEST.md`
- `src/hooks/useRailwayEmail.ts`
- `src/__tests__/hooks/useRailwayEmail.test.ts`
- `src/__tests__/integration/bulk-email-railway.test.ts`
- `api/email/railway-stats.ts`

### Modified Files
- `src/App.tsx` - Bulk email handler
- `src/components/BulkEmailModal.tsx` - Railway indicator, retry button
- `src/services/RailwayApiClient.ts` - Error classification
- `src/hooks/useEmailStats.ts` - Railway stats
- `src/components/EmailStatsCard.tsx` - Queue display

---

## Post-Sprint Actions

1. **Monitor:** Watch Railway queue depth for first 24 hours
2. **Measure:** Compare delivery rates Railway vs Local
3. **Iterate:** Tune batch size based on rate limit feedback
4. **Document:** Update runbook with Railway email troubleshooting

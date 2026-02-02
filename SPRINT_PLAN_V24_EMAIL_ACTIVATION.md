# Sprint Plan V24: Railway Email Activation

**Status**: 🚀 ACTIVE  
**Created**: February 2, 2026  
**Goal**: Route emails through Railway (Prisma/Postgres) for scalable, tracked email sending  
**North Star**: Send 50+ personalized emails to Tier 1 prospects in one session, track opens/clicks

---

## Executive Summary

### Current State
- ✅ Railway backend operational (Postgres, Redis, BullMQ, SendGrid)
- ✅ S2S auth configured (`RAILWAY_API_SECRET` = `CRON_SECRET`)
- ✅ Bulk email UI exists (Sprint 22A) but routes to Firestore queue
- ✅ Railway proxy at `api/railway/[...path].ts` with rate limiting + circuit breaker
- ⚠️ Email pipeline not E2E verified with Railway

### Architecture Flow
```
GTM-YardFlow (Vercel)          YardFlow-Hitlist (Railway)
┌─────────────────────┐        ┌─────────────────────────┐
│ React SPA           │        │ Next.js API             │
│   ↓                 │        │   ↓                     │
│ useRailwayEmail()   │───────▶│ POST /api/email/send    │
│   ↓                 │        │   ↓                     │
│ /api/railway/[...] ─┼────S2S─┼─▶ BullMQ email queue    │
│   (proxy + auth)    │        │   ↓                     │
└─────────────────────┘        │ SendGrid API            │
                               │   ↓                     │
┌─────────────────────┐        │ Webhook → Railway       │
│ /api/webhooks/      │◀───────┼─ Event storage          │
│   sendgrid.ts       │        └─────────────────────────┘
│   ↓                 │
│ Firestore update    │
│ (+ Railway sync)    │
└─────────────────────┘
```

---

## Environment Variable Checklist

### Vercel (GTM-YardFlow)

| Variable | Required | Purpose | Verify |
|----------|----------|---------|--------|
| `RAILWAY_API_URL` | ✅ | Railway backend URL | `https://yardflow-hitlist-production-2f41.up.railway.app` |
| `RAILWAY_API_SECRET` | ✅ | S2S auth (must match Railway's `CRON_SECRET`) | 32+ char secret |
| `CRON_SECRET` | ✅ | Cron auth (fallback for above) | Same as `RAILWAY_API_SECRET` |
| `VITE_RAILWAY_ENABLED` | ✅ | Master Railway toggle | `true` |
| `VITE_RAILWAY_EMAIL_ENABLED` | ✅ | Route email via Railway | `true` |
| `SENDGRID_WEBHOOK_VERIFICATION_KEY` | ✅ | Verify webhook signatures | From SendGrid dashboard |

### Railway (YardFlow-Hitlist)

| Variable | Required | Purpose |
|----------|----------|---------|
| `CRON_SECRET` | ✅ | S2S auth (must match Vercel's `RAILWAY_API_SECRET`) |
| `SENDGRID_API_KEY` | ✅ | Send emails |
| `SENDGRID_FROM_EMAIL` | ✅ | Verified sender address |
| `DATABASE_URL` | ✅ | Postgres connection |
| `REDIS_URL` | ✅ | BullMQ queue backend |

---

## Sprint Overview

| Sprint | Focus | Est. Time | Tasks | Demo |
|--------|-------|-----------|-------|------|
| **S0** | Secrets Verification | 1 hour | T0.1-T0.5 | Health endpoints return OK |
| **S1** | E2E Email Test | 2.5 hours | T1.1-T1.6 | Send test email, see in inbox |
| **S1.5** | Compliance Gates | 1.5 hours | T1.7-T1.10 | Suppression + CAN-SPAM verified |
| **S2** | Frontend Integration | 4 hours | T2.0-T2.8 | UI sends via Railway |
| **S3** | Error Handling | 2.5 hours | T3.1-T3.5 | Graceful degradation |
| **S4** | Monitoring | 2 hours | T4.1-T4.5 | Stats dashboard + alerts |

**Total**: ~13.5 hours (spread across ~3 days)

---

## Dependency Matrix

```
S0.1 ──┬──▶ S0.2 ──▶ S0.3 ──▶ S0.4 ──▶ S0.5
       │
       └──▶ S1.1 ──▶ S1.2 ──▶ S1.3 ──▶ S1.4 ──▶ S1.5 ──▶ S1.6
                                                          │
                     S1.7 ──▶ S1.8 ──▶ S1.9 ──▶ S1.10 ◀───┘
                                                  │
       ┌──────────────────────────────────────────┘
       ▼
     S2.0 ──▶ S2.1 ──▶ S2.2 ──▶ S2.3a ──▶ S2.3b ──▶ S2.4 ──▶ S2.5 ──▶ S2.6 ──▶ S2.7 ──▶ S2.8
                                                                                         │
       ┌─────────────────────────────────────────────────────────────────────────────────┘
       ▼
     S3.1 ──▶ S3.2 ──▶ S3.3 ──▶ S3.4 ──▶ S3.5
                                          │
       ┌──────────────────────────────────┘
       ▼
     S4.1 ──▶ S4.2 ──▶ S4.3 ──▶ S4.4 ──▶ S4.5
```

---

## Sprint S0: Secrets Verification (1 hour)

**Goal**: All environment variables configured, S2S auth verified  
**Demo**: `curl` to both health endpoints returns 200

---

### T0.1: Verify Vercel Environment Variables [XS - 15 min]

**Task**: Check Vercel dashboard for all required env vars.

**Validation**:
```bash
# Run in Vercel Functions log or deploy preview
curl -s https://gtm-yard-flow.vercel.app/api/health | jq .
# Should show: { "status": "ok", "railway": "configured" }
```

**Exit Criteria**: All 6 Vercel vars set (see checklist above).

---

### T0.2: Verify Railway Environment Variables [XS - 15 min]

**Task**: Check Railway dashboard for all required env vars.

**Validation**:
```bash
curl -s "https://yardflow-hitlist-production-2f41.up.railway.app/api/health" | jq .
# Should show: { "database": "ok", "redis": "ok", "queues": {...} }
```

**Exit Criteria**: All 5 Railway vars set (see checklist above).

---

### T0.3: Test S2S Auth [S - 30 min]

**Task**: Verify Vercel can authenticate to Railway.

**Files**: Create `scripts/test-railway-auth.ts`

**Implementation**:
```typescript
// scripts/test-railway-auth.ts
const RAILWAY_API_URL = process.env.RAILWAY_API_URL;
const RAILWAY_API_SECRET = process.env.RAILWAY_API_SECRET || process.env.CRON_SECRET;

async function testAuth() {
  const res = await fetch(`${RAILWAY_API_URL}/api/health`, {
    headers: {
      'x-service-key': RAILWAY_API_SECRET!,
      'Authorization': `Bearer ${RAILWAY_API_SECRET}`,
    },
  });
  
  console.log('Status:', res.status);
  console.log('Body:', await res.json());
  
  if (res.status !== 200) {
    throw new Error(`S2S auth failed: ${res.status}`);
  }
  console.log('✅ S2S auth working');
}

testAuth().catch(console.error);
```

**Validation**:
```bash
npx tsx scripts/test-railway-auth.ts
# Should output: ✅ S2S auth working
```

**Exit Criteria**: Script completes without error.

---

### T0.4: Verify Railway Proxy Works [XS - 10 min]

**Task**: Test the Vercel proxy endpoint forwards to Railway.

**Validation**:
```bash
# Get Firebase token first (or use test token)
curl -s "https://gtm-yard-flow.vercel.app/api/railway/health" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" | jq .
```

**Exit Criteria**: Proxy returns Railway health response.

---

### T0.5: Verify SendGrid Domain Authentication [XS - 10 min]

**Task**: Confirm SendGrid domain (yardflow.com or freightroll.com) is authenticated.

**Validation**:
- Open SendGrid Dashboard → Settings → Sender Authentication
- Verify domain shows "Verified" status
- Screenshot for records

**Exit Criteria**: Domain authentication shows green checkmark.

---

## Sprint S1: E2E Email Test (2.5 hours)

**Goal**: Proven flow from GTM to inbox  
**Demo**: Send test email via Railway, receive in inbox, see Firestore update

---

### T1.1: Create E2E Test Script [M - 45 min]

**Task**: Script to send email through Railway and verify delivery.

**Files**: Create `scripts/test-railway-email-e2e.ts`

**Implementation**:
```typescript
// scripts/test-railway-email-e2e.ts
import { railwayServerClient } from '../lib/railway-client';

const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';

async function testE2E() {
  console.log('🚀 Starting E2E email test');
  
  // 1. Send email via Railway
  const response = await railwayServerClient.post('/api/email/send', {
    to: TEST_EMAIL,
    subject: `E2E Test ${new Date().toISOString()}`,
    body: '<h1>Test Email</h1><p>If you see this, Railway email works!</p>',
    idempotencyKey: `e2e-test-${Date.now()}`,
  });
  
  console.log('📤 Email queued:', response);
  
  // 2. Poll for delivery (Railway should process within 30s)
  const messageId = response.messageId;
  let attempts = 0;
  while (attempts < 6) {
    await new Promise(r => setTimeout(r, 5000));
    const status = await railwayServerClient.get(`/api/email/status/${messageId}`);
    console.log(`📊 Status check ${++attempts}:`, status);
    
    if (status.status === 'delivered') {
      console.log('✅ Email delivered!');
      return;
    }
    if (status.status === 'failed') {
      throw new Error(`Email failed: ${status.error}`);
    }
  }
  
  console.log('⚠️ Email still processing after 30s - check manually');
}

testE2E().catch(console.error);
```

**Validation**:
```bash
TEST_EMAIL=your.email@gmail.com npx tsx scripts/test-railway-email-e2e.ts
```

**Exit Criteria**: Script outputs "Email delivered" and email appears in inbox.

---

### T1.2: Verify SendGrid Webhook Reaches Vercel [S - 30 min]

**Task**: Confirm SendGrid events hit `/api/webhooks/sendgrid`.

**Validation**:
1. Send test email (T1.1)
2. Check Vercel logs for webhook hit
3. Verify Firestore `email_events` collection updated

**Exit Criteria**: Webhook logged in Vercel, event in Firestore.

---

### T1.3: Add Firebase Auth to Test Script [XS - 10 min]

**Task**: Update test scripts to include Firebase ID token.

**Implementation**:
```typescript
// Add to scripts/test-railway-auth.ts header generation
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// ... then get token
const user = await signInWithEmailAndPassword(auth, email, password);
const token = await user.user.getIdToken();
```

**Exit Criteria**: Test scripts authenticate with Firebase token.

---

### T1.4: Document Railway API Endpoints [S - 20 min]

**Task**: Document which Railway endpoints GTM needs.

**Files**: Update `docs/RAILWAY_INTEGRATION.md`

**Endpoints**:
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/email/send` | POST | Queue email for sending |
| `/api/email/status/:id` | GET | Check email status |
| `/api/email/stats` | GET | Queue stats |
| `/api/prospects/sync` | POST | Sync prospect to Railway |

**Exit Criteria**: Docs updated with endpoint table.

---

### T1.5: Test Open/Click Tracking [S - 30 min]

**Task**: Verify tracking pixels and links work.

**Validation**:
1. Open test email
2. Click a link in email
3. Check Firestore for `open` and `click` events

**Exit Criteria**: Events appear in Firestore within 1 minute.

---

### T1.6: Add Webhook → Railway Sync [M - 45 min]

**Task**: When SendGrid webhook fires, sync status to Railway if email was sent via Railway.

**Files**: `api/webhooks/sendgrid.ts`

**Implementation**:
```typescript
// After Firestore update, sync to Railway if needed
const emailDoc = await db.collection('emails').doc(messageId).get();
const emailData = emailDoc.data();

if (emailData?.sentViaRailway && emailData?.railwayMessageId) {
  try {
    await railwayServerClient.post('/api/email/webhook-sync', {
      railwayMessageId: emailData.railwayMessageId,
      event: event.event, // 'open', 'click', 'bounce', etc.
      timestamp: event.timestamp,
    });
    logger.info('Synced event to Railway', { messageId, event: event.event });
  } catch (err) {
    // Non-blocking - Railway sync failure shouldn't break Firestore update
    logger.warn('Railway sync failed', { messageId, error: err });
  }
}
```

**Validation**:
```typescript
// Test: mock Railway client, verify sync called
it('syncs open event to Railway for Railway-sent emails', async () => {
  mockFirestoreDoc({ sentViaRailway: true, railwayMessageId: 'rm-123' });
  await handler(openEventRequest, mockRes);
  expect(railwayServerClient.post).toHaveBeenCalledWith('/api/email/webhook-sync', expect.any(Object));
});
```

**Exit Criteria**: Test passes, events sync to Railway.

---

## Sprint S1.5: Compliance Gates (1.5 hours)

**Goal**: Ensure email sending is compliant before production traffic  
**Demo**: Suppressed emails blocked, CAN-SPAM footer present

---

### T1.7: Create Railway Suppression Check [S - 30 min]

**Task**: Check Firestore suppression list before sending via Railway.

**Files**: `src/hooks/useRailwayEmail.ts` (created in S2), `src/services/EmailComplianceService.ts`

**Implementation**:
```typescript
// Add to useRailwayEmail hook (before send)
import { checkSuppression } from '@/services/EmailComplianceService';

async function sendEmail(prospect: Prospect, subject: string, body: string) {
  // Check suppression first
  const suppressed = await checkSuppression(prospect.email);
  if (suppressed) {
    return { success: false, error: 'Email suppressed', reason: suppressed.reason };
  }
  
  // Proceed with Railway send
  // ...
}
```

**Validation**:
```typescript
it('blocks suppressed emails', async () => {
  mockSuppression('test@example.com', 'hard_bounce');
  const result = await sendViaRailway({ email: 'test@example.com', ... });
  expect(result.success).toBe(false);
  expect(result.reason).toBe('hard_bounce');
});
```

**Exit Criteria**: Test passes, suppressed emails blocked.

---

### T1.8: Verify CAN-SPAM Compliance [S - 30 min]

**Task**: Ensure Railway emails include unsubscribe link and physical address.

**Validation**:
1. Send test email via Railway
2. Check email source for:
   - `List-Unsubscribe` header
   - `List-Unsubscribe-Post` header (one-click)
   - Physical address in footer
   - Unsubscribe link in body

**Exit Criteria**: All 4 compliance elements present in email.

---

### T1.9: Test Unsubscribe Flow [S - 20 min]

**Task**: Verify unsubscribe link works end-to-end.

**Validation**:
1. Click unsubscribe link in test email
2. Verify redirected to confirmation page
3. Check Firestore suppression list updated
4. Verify subsequent sends blocked

**Exit Criteria**: Unsubscribed user cannot receive more emails.

---

### T1.10: Add Compliance Verification to CI [XS - 10 min]

**Task**: Add test to verify compliance service works.

**Files**: `src/__tests__/services/EmailComplianceService.test.ts`

**Validation**:
```bash
npm test -- --run EmailComplianceService
```

**Exit Criteria**: Tests pass in CI.

---

## Sprint S2: Frontend Integration (4 hours)

**Goal**: UI sends emails through Railway  
**Demo**: Select 10 prospects, send bulk email, see success toast

---

### T2.0: Check Enrollment Status Before Send [S - 30 min]

**Task**: Skip prospects in active sequences when bulk sending.

**Files**: `src/App.tsx` (or `BulkEmailModal.tsx`)

**Implementation**:
```typescript
const eligibleProspects = selectedProspects.filter(p => {
  if (!p.email) return false;
  if (p.enrollmentStatus === 'active') {
    logger.warn('Skipping prospect in active sequence', { id: p.id });
    return false;
  }
  return true;
});
```

**Validation**:
```typescript
it('skips prospects in active sequences', () => {
  const prospects = [
    { id: '1', email: 'a@test.com', enrollmentStatus: 'active' },
    { id: '2', email: 'b@test.com', enrollmentStatus: undefined },
  ];
  const eligible = filterEligible(prospects);
  expect(eligible).toHaveLength(1);
  expect(eligible[0].id).toBe('2');
});
```

**Exit Criteria**: Active sequence prospects excluded from bulk send.

---

### T2.1: Create useRailwayEmail Hook [M - 1 hour]

**Task**: Hook to send email via Railway with feature flag check.

**Files**: Create `src/hooks/useRailwayEmail.ts`

**Implementation**:
```typescript
import { useState, useCallback } from 'react';
import { railwayClient } from '@/services/RailwayApiClient';
import { shouldUseRailwayEmail } from '@/config/featureFlags';
import { checkSuppression } from '@/services/EmailComplianceService';
import { logger } from '@/lib/logger';

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface UseRailwayEmailReturn {
  sendEmail: (to: string, subject: string, body: string, prospectId: string) => Promise<SendResult>;
  sendBatch: (emails: BatchEmail[]) => Promise<BatchResult>;
  isLoading: boolean;
  progress: { sent: number; failed: number; total: number };
}

export function useRailwayEmail(): UseRailwayEmailReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });

  const sendEmail = useCallback(async (
    to: string, 
    subject: string, 
    body: string,
    prospectId: string
  ): Promise<SendResult> => {
    // Check suppression
    const suppressed = await checkSuppression(to);
    if (suppressed) {
      return { success: false, error: `Suppressed: ${suppressed.reason}` };
    }

    // Generate idempotency key
    const idempotencyKey = `${prospectId}-${Date.now().toString(36)}`;

    if (!shouldUseRailwayEmail()) {
      // Fallback to local send
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body, idempotencyKey }),
      });
      const data = await res.json();
      return { success: res.ok, messageId: data.messageId, error: data.error };
    }

    // Send via Railway
    try {
      const result = await railwayClient.email.send({
        to,
        subject,
        body,
        idempotencyKey,
        metadata: { prospectId, sentFrom: 'gtm-yardflow' },
      });
      
      return { success: true, messageId: result.data.messageId };
    } catch (err) {
      logger.error('Railway email failed', err instanceof Error ? err : undefined, { to });
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, []);

  const sendBatch = useCallback(async (emails: BatchEmail[]): Promise<BatchResult> => {
    setIsLoading(true);
    setProgress({ sent: 0, failed: 0, total: emails.length });

    const results: SendResult[] = [];
    const BATCH_DELAY_MS = 100; // 10 emails/sec max

    for (const email of emails) {
      const result = await sendEmail(email.to, email.subject, email.body, email.prospectId);
      results.push(result);
      
      setProgress(p => ({
        ...p,
        sent: p.sent + (result.success ? 1 : 0),
        failed: p.failed + (result.success ? 0 : 1),
      }));

      // Delay between sends
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }

    setIsLoading(false);
    return {
      total: emails.length,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }, [sendEmail]);

  return { sendEmail, sendBatch, isLoading, progress };
}
```

**Validation**:
```bash
npm test -- --run useRailwayEmail
```

**Exit Criteria**: Hook sends via Railway when flag enabled, falls back when disabled.

---

### T2.2: Add Railway Email Methods to Client [S - 30 min]

**Task**: Extend `RailwayApiClient.ts` with email methods.

**Files**: `src/services/RailwayApiClient.ts`

**Implementation**:
```typescript
// Add to railwayClient object
email: {
  async send(payload: EmailPayload) {
    return this.fetch<{ messageId: string }>('/api/email/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async getStatus(messageId: string) {
    return this.fetch<{ status: string }>(`/api/email/status/${messageId}`);
  },
  async getStats() {
    return this.fetch<EmailStats>('/api/email/stats');
  },
},
```

**Exit Criteria**: Client has typed email methods.

---

### T2.3a: Wire Hook to App.tsx [S - 30 min]

**Task**: Replace direct fetch with `useRailwayEmail` hook.

**Files**: `src/App.tsx`

**Implementation**:
```typescript
// Import hook
import { useRailwayEmail } from '@/hooks/useRailwayEmail';

// In component
const { sendBatch, isLoading, progress } = useRailwayEmail();

// Update handler
const handleBulkSendEmail = useCallback(async (subject: string, body: string) => {
  const eligible = selectedProspects.filter(p => p.email && p.enrollmentStatus !== 'active');
  
  const emails = eligible.map(p => ({
    to: p.email!,
    subject: personalizeSubject(subject, p),
    body: personalizeBody(body, p),
    prospectId: p.id,
  }));

  const result = await sendBatch(emails);
  
  if (result.failed > 0) {
    toast.warning(`Sent ${result.sent}/${result.total}, ${result.failed} failed`);
  } else {
    toast.success(`Sent ${result.sent} emails!`);
  }
}, [selectedProspects, sendBatch]);
```

**Exit Criteria**: Bulk send uses Railway hook.

---

### T2.3b: Add Progress Tracking UI [S - 30 min]

**Task**: Show progress during batch send.

**Files**: `src/components/BulkEmailModal.tsx`

**Implementation**:
```tsx
// Add progress bar
{isLoading && (
  <div className="mt-4">
    <div className="flex justify-between text-sm">
      <span>Sending...</span>
      <span>{progress.sent + progress.failed}/{progress.total}</span>
    </div>
    <div className="w-full bg-gray-200 rounded h-2 mt-1">
      <div 
        className="bg-blue-600 h-2 rounded transition-all"
        style={{ width: `${((progress.sent + progress.failed) / progress.total) * 100}%` }}
      />
    </div>
    {progress.failed > 0 && (
      <p className="text-red-500 text-sm mt-1">{progress.failed} failed</p>
    )}
  </div>
)}
```

**Exit Criteria**: Progress bar shows during send.

---

### T2.4: Add Railway Status Indicator [S - 30 min]

**Task**: Show Railway health status in modal before sending.

**Files**: `src/components/BulkEmailModal.tsx`, `src/hooks/useRailwayStatus.ts`

**Implementation**:
```typescript
// src/hooks/useRailwayStatus.ts
export function useRailwayStatus() {
  const [status, setStatus] = useState<'checking' | 'healthy' | 'unhealthy'>('checking');
  
  useEffect(() => {
    if (!shouldUseRailwayEmail()) {
      setStatus('healthy'); // Using local, always "healthy"
      return;
    }
    
    railwayClient.health.check()
      .then(() => setStatus('healthy'))
      .catch(() => setStatus('unhealthy'));
  }, []);
  
  return { status, isRailway: shouldUseRailwayEmail() };
}

// In modal
const { status, isRailway } = useRailwayStatus();

{status === 'unhealthy' && (
  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mb-4">
    ⚠️ Railway is experiencing issues. Emails may be delayed.
  </div>
)}
```

**Exit Criteria**: Warning shows when Railway unhealthy.

---

### T2.5: Handle 429 Rate Limit Response [S - 30 min]

**Task**: If Railway returns 429, implement exponential backoff.

**Files**: `src/hooks/useRailwayEmail.ts`

**Implementation**:
```typescript
// In sendEmail function
try {
  const result = await railwayClient.email.send(payload);
  return { success: true, messageId: result.data.messageId };
} catch (err: unknown) {
  if (err instanceof RailwayApiError && err.status === 429) {
    // Exponential backoff
    const retryAfter = err.headers?.get('Retry-After') || '5';
    await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000));
    // Retry once
    const retry = await railwayClient.email.send(payload);
    return { success: true, messageId: retry.data.messageId };
  }
  throw err;
}
```

**Exit Criteria**: 429 responses handled gracefully.

---

### T2.6: Store railwayMessageId in Firestore [S - 30 min]

**Task**: Store Railway message ID for webhook correlation.

**Files**: `src/hooks/useRailwayEmail.ts`, Firestore writes

**Implementation**:
```typescript
// After successful Railway send
if (result.success && result.messageId) {
  await updateDoc(doc(db, 'email_logs', result.messageId), {
    railwayMessageId: result.messageId,
    sentViaRailway: true,
    prospectId,
    sentAt: serverTimestamp(),
  });
}
```

**Exit Criteria**: Email logs include `railwayMessageId`.

---

### T2.7: Unit Tests for useRailwayEmail [S - 30 min]

**Task**: Test hook with mocked Railway client.

**Files**: Create `src/__tests__/hooks/useRailwayEmail.test.ts`

**Implementation**:
```typescript
import { renderHook, act } from '@testing-library/react';
import { useRailwayEmail } from '@/hooks/useRailwayEmail';

vi.mock('@/services/RailwayApiClient', () => ({
  railwayClient: {
    email: {
      send: vi.fn().mockResolvedValue({ ok: true, data: { messageId: 'msg-123' } }),
    },
  },
}));

vi.mock('@/config/featureFlags', () => ({
  shouldUseRailwayEmail: () => true,
}));

describe('useRailwayEmail', () => {
  it('sends email via Railway when enabled', async () => {
    const { result } = renderHook(() => useRailwayEmail());
    
    let sendResult: any;
    await act(async () => {
      sendResult = await result.current.sendEmail('test@example.com', 'Subject', 'Body', 'p-1');
    });
    
    expect(sendResult.success).toBe(true);
    expect(sendResult.messageId).toBe('msg-123');
  });
});
```

**Validation**:
```bash
npm test -- --run useRailwayEmail
```

**Exit Criteria**: All tests pass.

---

### T2.8: Playwright E2E Test [M - 1 hour]

**Task**: Browser test for bulk email flow.

**Files**: Create `e2e/bulk-email.spec.ts`

**Implementation**:
```typescript
import { test, expect } from '@playwright/test';

test('sends bulk email via Railway', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).click();
  // ... auth flow
  
  // Select prospects
  await page.getByTestId('prospect-checkbox-0').click();
  await page.getByTestId('prospect-checkbox-1').click();
  
  // Open bulk email modal
  await page.getByRole('button', { name: /send email/i }).click();
  
  // Fill form
  await page.getByLabel('Subject').fill('Test Subject');
  await page.getByLabel('Message').fill('Hello {name}');
  
  // Send
  await page.getByRole('button', { name: /send to 2 prospects/i }).click();
  
  // Verify success
  await expect(page.getByText(/sent 2 emails/i)).toBeVisible({ timeout: 30000 });
});
```

**Validation**:
```bash
npm run test:e2e -- bulk-email.spec.ts
```

**Exit Criteria**: E2E test passes.

---

## Sprint S3: Error Handling (2.5 hours)

**Goal**: Graceful degradation when Railway fails  
**Demo**: Railway down → falls back to local → user sees warning

---

### T3.1: Classify Error Types [S - 30 min]

**Task**: Create error classification for Railway responses.

**Files**: Create `src/utils/railwayErrors.ts`

**Implementation**:
```typescript
export type RailwayErrorType = 
  | 'network'      // Fetch failed
  | 'timeout'      // Request timed out
  | 'auth'         // 401/403
  | 'rate_limit'   // 429
  | 'server'       // 5xx
  | 'validation'   // 400
  | 'unknown';

export function classifyError(error: unknown): RailwayErrorType {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'network';
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'timeout';
  }
  if (error instanceof RailwayApiError) {
    if (error.status === 401 || error.status === 403) return 'auth';
    if (error.status === 429) return 'rate_limit';
    if (error.status >= 500) return 'server';
    if (error.status === 400) return 'validation';
  }
  return 'unknown';
}

export function isRetryable(type: RailwayErrorType): boolean {
  return ['network', 'timeout', 'rate_limit', 'server'].includes(type);
}
```

**Exit Criteria**: Errors correctly classified.

---

### T3.2: Client-Side Circuit Breaker [M - 45 min]

**Task**: Stop calling Railway after repeated failures.

**Files**: `src/hooks/useRailwayEmail.ts`

**Implementation**:
```typescript
const FAILURE_THRESHOLD = 3;
const RECOVERY_TIME_MS = 30000;

let failureCount = 0;
let circuitOpenedAt = 0;

function isCircuitOpen(): boolean {
  if (failureCount < FAILURE_THRESHOLD) return false;
  if (Date.now() - circuitOpenedAt > RECOVERY_TIME_MS) {
    // Allow one request to test recovery
    failureCount = FAILURE_THRESHOLD - 1;
    return false;
  }
  return true;
}

function recordFailure() {
  failureCount++;
  if (failureCount >= FAILURE_THRESHOLD) {
    circuitOpenedAt = Date.now();
  }
}

function recordSuccess() {
  failureCount = 0;
}

// In sendEmail
if (isCircuitOpen()) {
  logger.warn('Circuit breaker open, falling back to local');
  return sendLocal(to, subject, body);
}
```

**Validation**:
```typescript
it('opens circuit after 3 failures', async () => {
  // Mock 3 failures
  // Assert 4th call uses fallback
});

it('closes circuit after recovery period', async () => {
  // Mock failures, wait RECOVERY_TIME_MS
  // Assert next call attempts Railway
});
```

**Exit Criteria**: Circuit breaker works with recovery.

---

### T3.3: Add Retry Button for Failed Emails [S - 30 min]

**Task**: UI to retry failed emails from batch.

**Files**: `src/components/BulkEmailModal.tsx`

**Implementation**:
```tsx
// After batch complete with failures
{result.failed > 0 && (
  <div className="mt-4 p-3 bg-red-50 rounded">
    <p>{result.failed} emails failed to send</p>
    <button 
      onClick={() => retryFailed(result.results.filter(r => !r.success))}
      className="mt-2 text-red-600 underline"
    >
      Retry failed emails
    </button>
  </div>
)}
```

**Exit Criteria**: Retry button re-sends failed emails.

---

### T3.4: Log Failures to Firestore [S - 30 min]

**Task**: Store failed email attempts for debugging.

**Files**: `src/hooks/useRailwayEmail.ts`

**Implementation**:
```typescript
// On failure
await addDoc(collection(db, 'email_failures'), {
  prospectId,
  to,
  error: error.message,
  errorType: classifyError(error),
  timestamp: serverTimestamp(),
  attemptedVia: 'railway',
});
```

**Exit Criteria**: Failures visible in Firestore.

---

### T3.5: Handle SendGrid Rate Limits [S - 30 min]

**Task**: Detect domain warming limits and notify user.

**Files**: `src/hooks/useRailwayEmail.ts`

**Implementation**:
```typescript
// Check for SendGrid-specific rate limit
if (error.message?.includes('too many requests for this domain')) {
  return {
    success: false,
    error: 'Daily sending limit reached. Try again tomorrow.',
    retryable: false,
  };
}
```

**Exit Criteria**: User sees clear message when limit hit.

---

## Sprint S4: Monitoring Dashboard (2 hours)

**Goal**: Visibility into email pipeline health  
**Demo**: Dashboard shows queue depth, success rate, recent failures

---

### T4.1: Create Railway Stats Endpoint [S - 30 min]

**Task**: API endpoint to fetch Railway email stats.

**Files**: Create `api/email/railway-stats.ts`

**Implementation**:
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { railwayServerClient } from '../../lib/railway-client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const stats = await railwayServerClient.get<RailwayStats>('/api/email/stats');
    res.json(stats);
  } catch (err) {
    res.status(503).json({ error: 'Railway unavailable', fallback: true });
  }
}
```

**Exit Criteria**: Endpoint returns stats or fallback.

---

### T4.2: Create EmailStatsCard Component [M - 45 min]

**Task**: Dashboard card showing email metrics.

**Files**: Create `src/components/EmailStatsCard.tsx`

**Implementation**:
```tsx
export function EmailStatsCard() {
  const { data, isLoading, error } = useQuery(['emailStats'], fetchEmailStats);
  
  if (isLoading) return <Skeleton />;
  if (error) return <ErrorCard message="Stats unavailable" />;
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium mb-4">Email Pipeline</h3>
      
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Queued" value={data.queue.waiting} />
        <Stat label="Sent Today" value={data.sentToday} />
        <Stat label="Success Rate" value={`${data.successRate}%`} />
      </div>
      
      {data.queue.waiting > 100 && (
        <Alert type="warning" className="mt-4">
          High queue depth - emails may be delayed
        </Alert>
      )}
    </div>
  );
}
```

**Exit Criteria**: Stats card renders on dashboard.

---

### T4.3: Add Stats Card to Dashboard [XS - 15 min]

**Task**: Wire card into dashboard layout.

**Files**: `src/components/Dashboard.tsx`

**Implementation**:
```tsx
import { EmailStatsCard } from './EmailStatsCard';

// In dashboard grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <EmailStatsCard />
  {/* ... other cards */}
</div>
```

**Exit Criteria**: Card visible on dashboard.

---

### T4.4: Add Recent Failures Table [S - 30 min]

**Task**: Table showing recent email failures.

**Files**: `src/components/EmailStatsCard.tsx`

**Implementation**:
```tsx
// Below stats grid
<details className="mt-4">
  <summary className="cursor-pointer text-sm text-gray-600">
    Recent failures ({data.recentFailures.length})
  </summary>
  <table className="w-full mt-2 text-sm">
    <thead>
      <tr>
        <th>Email</th>
        <th>Error</th>
        <th>Time</th>
      </tr>
    </thead>
    <tbody>
      {data.recentFailures.map(f => (
        <tr key={f.id}>
          <td>{f.to}</td>
          <td>{f.error}</td>
          <td>{formatRelative(f.timestamp)}</td>
        </tr>
      ))}
    </tbody>
  </table>
</details>
```

**Exit Criteria**: Failures table shows on expand.

---

### T4.5: Add Queue Depth Alerting [S - 30 min]

**Task**: Alert when queue depth exceeds threshold.

**Files**: `api/email/railway-stats.ts`, `lib/alerting.ts`

**Implementation**:
```typescript
// In stats endpoint
if (stats.queue.waiting > 500) {
  await sendAlert({
    channel: 'email-pipeline',
    severity: 'warning',
    message: `Email queue depth high: ${stats.queue.waiting} waiting`,
    metadata: { queueDepth: stats.queue.waiting },
  });
}
```

**Exit Criteria**: Slack alert sent when queue > 500.

---

## Rollback Plan

### Immediate Rollback (< 1 min)
Set `VITE_RAILWAY_EMAIL_ENABLED=false` in Vercel dashboard → Redeploy.

All email sends will route through local `/api/email/send` + Firestore queue.

### Full Rollback (< 5 min)
```bash
# 1. Disable flag
vercel env rm VITE_RAILWAY_EMAIL_ENABLED production

# 2. Revert code changes
git revert HEAD~3  # Revert last 3 commits (S2 changes)
git push origin main

# 3. Verify fallback works
curl -X POST https://gtm-yard-flow.vercel.app/api/email/send \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Rollback test","body":"test"}'
```

### Rollback Triggers
- Email delivery rate drops below 90%
- Queue depth exceeds 1000 for > 10 min
- Circuit breaker opens 3+ times in 1 hour
- SendGrid reports > 5% bounce rate

---

## Post-Sprint Checklist

### After S0
- [ ] All env vars configured
- [ ] S2S auth verified
- [ ] SendGrid domain authenticated

### After S1
- [ ] Test email received in inbox
- [ ] Tracking pixels fire
- [ ] Webhook updates Firestore

### After S1.5
- [ ] Suppressed emails blocked
- [ ] CAN-SPAM compliant
- [ ] Unsubscribe works

### After S2
- [ ] UI sends via Railway
- [ ] Progress bar works
- [ ] E2E test passes

### After S3
- [ ] Fallback works when Railway down
- [ ] Circuit breaker triggers
- [ ] Retry works

### After S4
- [ ] Dashboard shows stats
- [ ] Alerts fire on high queue
- [ ] Failures visible

---

## Key Files Reference

| Purpose | Location |
|---------|----------|
| Railway proxy | `api/railway/[...path].ts` |
| Railway server client | `lib/railway-client.ts` |
| Railway browser client | `src/services/RailwayApiClient.ts` |
| Feature flags | `src/config/featureFlags.ts` |
| Email hook (new) | `src/hooks/useRailwayEmail.ts` |
| SendGrid webhook | `api/webhooks/sendgrid.ts` |
| Compliance service | `src/services/EmailComplianceService.ts` |
| Alerting | `lib/alerting.ts` |

# Sprint Plan V16: Platform Integration & Production Readiness

**Created**: February 1, 2026  
**Status**: Ready for Execution  
**Goal**: Achieve full GTM-YardFlow ↔ YardFlow-Hitlist integration with passing CI, deployed services, and end-to-end email flows  
**Reviewed By**: Subagent on Feb 1, 2026 (23 improvements incorporated)

---

## Executive Summary

The platform consists of two repositories that must work together:

| Repo | Platform | Role | Current Status |
|------|----------|------|----------------|
| **GTM-YardFlow** | Vercel | React SPA + Firebase + API Proxy | ✅ CI passing, 3135 tests |
| **YardFlow-Hitlist** | Railway | Next.js API + Postgres + Redis + BullMQ | ❌ CI failing (TypeScript errors) |

**Critical Path**: Fix YardFlow-Hitlist CI → Railway deploys → Email flows work → Meeting attribution active

---

## Phase 1: CI Green (Blocking Everything)

### Sprint 500: YardFlow-Hitlist TypeScript Fixes

**Repo**: YardFlow-Hitlist  
**Goal**: Fix all TypeScript errors so CI passes and Railway deploys  
**Effort**: 1-2 hours  
**Validation**: `npx tsc --noEmit` returns 0 errors, GitHub Actions green

#### T500.1: Fix API Route Type Errors ✅ (COMPLETED)

**Files Fixed**:
- `src/app/api/ab-tests/[id]/route.ts` - Proper variant indexing types
- `src/app/api/ai/dossier/route.ts` - Safe JSON parsing
- `src/app/api/ai/score-icp/route.ts` - Handle unknown error
- `src/app/api/auth/session/route.ts` - Remove non-existent `image` property
- `src/app/api/cron/google-sync/route.ts` - Error type guards
- `src/app/api/export/route.ts` - Prisma enum usage
- `src/app/api/google/gmail/check-replies/route.ts` - Error type guards
- `src/app/api/outreach/activity/route.ts` - OutreachStatus enum
- `src/app/api/outreach/bulk/route.ts` - Prisma-compatible types
- `src/app/api/prospects/batch/route.ts` - JsonValue casting

**Pattern Applied**:
```typescript
// Before (error: 'error' is of type 'unknown')
catch (error) { logger.error(error.message); }

// After
catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
}
```

**Status**: ✅ COMPLETE - Committed locally, needs push

---

#### T500.2: Fix Library Type Errors ✅ (COMPLETED)

**Files Fixed**:
- `src/lib/agents/orchestrator.ts` - Fix null coalescing precedence
- `src/lib/agents/state-manager.ts` - Add `progress` to task type
- `src/lib/alerts/alert-manager.ts` - LogContext compatibility
- `src/lib/queue/workers.ts` - Import heartbeatQueue, type err param
- `src/lib/env.ts` - Add SENDGRID_API_KEY, SLACK_WEBHOOK_URL

**Pattern Applied**:
```typescript
// Before (error: operator precedence)
const count = params.items?.length ?? 0 === 0;

// After
const count = (params.items?.length ?? 0) === 0;
```

**Status**: ✅ COMPLETE - Committed locally, needs push

---

#### T500.3: Fix Test Type Errors ✅ (COMPLETED)

**Files Fixed**:
- `tests/e2e/e2e-test-suite.ts` - Handle undefined boolean with `!!`

**Status**: ✅ COMPLETE - Committed locally, needs push

---

#### T500.4: Fix Schema & Push

**Actions**:
1. Add `googleId` field to `prisma/schema.prisma` users model
2. Run `npx prisma generate` to update client
3. Push to main: `git push origin main`
4. Wait for GitHub Actions to pass
5. Verify Railway deployment triggers

**Validation**:
```bash
# In YardFlow-Hitlist codespace
cd eventops
npx tsc --noEmit  # Should return 0 errors
npm run lint      # Warnings OK, no errors
git push origin main
# Watch GitHub Actions for green check
```

**Status**: ⏳ PENDING - Needs you to push from YardFlow-Hitlist codespace

---

## Phase 2: Railway Deployment Verification

### Sprint 501: Railway Health Verification

**Repo**: YardFlow-Hitlist  
**Goal**: Verify Railway deploys new code and all endpoints work  
**Effort**: 30 minutes  
**Validation**: All critical endpoints return expected responses

#### T501.1: Verify Railway Deployment Triggered

**Actions**:
1. Check Railway Dashboard → YardFlow-Hitlist → Deployments
2. Confirm "Wait for CI" shows green and deployment started
3. Wait for deployment to complete (~3-5 minutes)

**Validation**:
```bash
curl https://yardflow-hitlist-production-2f41.up.railway.app/api/health | jq
# Should return: {"status":"healthy","checks":{...}}
```

---

#### T501.2: Test Critical API Endpoints

**Validation Script**:
```bash
RAILWAY_URL="https://yardflow-hitlist-production-2f41.up.railway.app"

echo "=== Testing Railway Endpoints ==="
# Health (should be 200)
curl -s -o /dev/null -w "%{http_code} " "$RAILWAY_URL/api/health" && echo "/api/health"

# Sequences (should be 401 - requires auth)
curl -s -o /dev/null -w "%{http_code} " "$RAILWAY_URL/api/sequences" && echo "/api/sequences"

# Prospects (should be 401 - requires auth)
curl -s -o /dev/null -w "%{http_code} " "$RAILWAY_URL/api/prospects" && echo "/api/prospects"

# Enrollments (should be 401 - requires auth)
curl -s -o /dev/null -w "%{http_code} " "$RAILWAY_URL/api/enrollments" && echo "/api/enrollments"

# Email queue status (should be 401 - requires auth)
curl -s -o /dev/null -w "%{http_code} " "$RAILWAY_URL/api/email/queue/status" && echo "/api/email/queue/status"

# Admin seed (should be 200)
curl -s -o /dev/null -w "%{http_code} " "$RAILWAY_URL/api/admin/seed" && echo "/api/admin/seed"
```

**Expected Results**:
- `/api/health` → 200
- `/api/sequences` → 401 (auth required = endpoint exists!)
- `/api/prospects` → 401 (auth required = endpoint exists!)
- `/api/enrollments` → 401 (auth required = endpoint exists!)
- `/api/email/queue/status` → 401 (auth required = endpoint exists!)

**Error Scenarios and Actions**:
| Response | Meaning | Action |
|----------|---------|--------|
| 200 | Healthy | Continue |
| 401 | Auth required | Endpoint exists, auth working ✅ |
| 404 | Endpoint missing | Railway deploy may have failed. Check Railway logs |
| 500 | Server error | Check Railway logs for stack trace |
| Timeout | Railway down | Check Railway Dashboard for deploy errors |

**Status**: ⏳ BLOCKED by T500.4

---

#### T501.3: Test Service-to-Service Auth

**Validation**:
```bash
RAILWAY_URL="https://yardflow-hitlist-production-2f41.up.railway.app"
CRON_SECRET="your-cron-secret-here"

# Test with CRON_SECRET header (S2S auth)
curl -s -H "Authorization: Bearer $CRON_SECRET" \
     "$RAILWAY_URL/api/email/queue/status" | jq
```

**Status**: ⏳ BLOCKED by T501.2

---

## Phase 3: GTM-YardFlow Integration Tests

### Sprint 502: Vercel ↔ Railway Integration

**Repo**: GTM-YardFlow  
**Goal**: Verify Vercel proxy correctly forwards to Railway  
**Effort**: 1 hour  
**Validation**: Integration tests pass, end-to-end flow works

#### T502.1: Run Existing Railway Integration Tests

**Commands**:
```bash
cd /workspaces/GTM-YardFlow
npm test -- --run src/__tests__/integration/railway-*.test.ts
```

**Expected**: 66 tests pass (already created in Sprint 306-308)

**Status**: ✅ COMPLETE - Tests exist and pass with mocks

---

#### T502.2: Test Live Railway Proxy

**Actions**:
1. Start local dev server
2. Test proxy route manually

**Commands**:
```bash
npm run dev
# In another terminal:
curl http://localhost:5173/api/railway/health
```

**Validation**: Should proxy to Railway and return health status

**Status**: ⏳ BLOCKED by T501.2

---

#### T502.3: Verify Firebase → Railway Auth Bridge

**Files**: `src/services/AuthBridge.ts`

**Test Flow**:
1. Sign in with Firebase
2. Call `getOrCreateRailwaySession()`
3. Verify session token returned
4. Use token to call Railway endpoints

**Validation**:
```typescript
// In browser console (logged in)
import { getOrCreateRailwaySession } from '@/services/AuthBridge';
const session = await getOrCreateRailwaySession();
console.log('Railway session:', session);
```

**Status**: ⏳ BLOCKED by T501.2

---

## Phase 4: Email Infrastructure

### Sprint 503: Email Send Flow

**Repos**: Both  
**Goal**: Send emails through Railway/SendGrid pipeline  
**Effort**: 2-3 hours  
**Validation**: Test email received with tracking pixel

#### T503.1: Verify SendGrid Configuration

**Railway Environment Variables Required**:
- `SENDGRID_API_KEY` - SendGrid API key
- `SENDGRID_FROM_EMAIL` - Verified sender email
- `SENDGRID_WEBHOOK_VERIFICATION_KEY` - Webhook signature key

**Validation**:
```bash
# Check Railway Dashboard → YardFlow-Hitlist → Variables
# Verify SENDGRID_API_KEY is set (not the value, just existence)
```

---

#### T503.2: Test Email Send Endpoint

**Validation**:
```bash
RAILWAY_URL="https://yardflow-hitlist-production-2f41.up.railway.app"
CRON_SECRET="your-cron-secret"

curl -X POST "$RAILWAY_URL/api/outreach/send-email" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-test-email@example.com",
    "subject": "Test Email from YardFlow",
    "body": "This is a test email.",
    "outreachId": "test-123"
  }'
```

---

#### T503.3: Verify Webhook Reception

**SendGrid Webhook URL**: `https://yardflow-hitlist-production-2f41.up.railway.app/api/webhooks/sendgrid`

**Test**:
1. Send test email (T503.2)
2. Open the email
3. Check Railway logs for webhook receipt:
```
[Webhook] SendGrid event: open, email: your-test-email@example.com
```

---

#### T503.4: Test GTM-YardFlow Email Flow

**Validation**:
```typescript
// In GTM-YardFlow, with feature flags enabled
import { railwayClient } from '@/services/RailwayApiClient';

await railwayClient.email.send({
  to: 'test@example.com',
  subject: 'Test via Proxy',
  body: 'Sent through Vercel proxy',
});
```

---

## Phase 5: Sequence Enrollment

### Sprint 504: Sequence Engine

**Repos**: Both  
**Goal**: Enroll prospects in sequences, execute steps  
**Effort**: 3-4 hours  
**Validation**: Prospect enrolled, first email sent

#### T504.1: Create Test Sequence in Railway

**Actions**:
```bash
curl -X POST "$RAILWAY_URL/api/sequences" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Sequence",
    "steps": [
      { "type": "EMAIL", "delay": 0, "subject": "Hello {{firstName}}", "body": "Test body" },
      { "type": "EMAIL", "delay": 2, "subject": "Follow up", "body": "Following up..." }
    ]
  }'
```

---

#### T504.2: Create Test Prospect

**Actions**:
```bash
curl -X POST "$RAILWAY_URL/api/prospects" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "Prospect",
    "email": "test-prospect@example.com",
    "companyName": "Test Corp",
    "tier": "Tier 1"
  }'
```

---

#### T504.3: Enroll Prospect in Sequence

**Actions**:
```bash
curl -X POST "$RAILWAY_URL/api/sequences/SEQ_ID/enroll" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "prospectIds": ["PROSPECT_ID"]
  }'
```

---

#### T504.4: Trigger Sequence Execution

**Actions**:
```bash
# Manually trigger the cron job
curl -X POST "$RAILWAY_URL/api/cron/sequences" \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Validation**: Check email was sent to test prospect

---

## Phase 6: Meeting Attribution (North Star)

### Sprint 505: Calendly Integration

**Repos**: GTM-YardFlow (webhooks)  
**Goal**: Attribute meetings to email sequences  
**Effort**: 2-3 hours  
**Validation**: Calendly booking stops sequence, attributes meeting

#### T505.1: Verify Calendly Webhook Configuration

**Calendly Webhook URL**: `https://gtm-yard-flow.vercel.app/api/webhooks/calendly`

**Required Environment Variables**:
- `CALENDLY_WEBHOOK_SECRET` - Webhook signature verification

---

#### T505.2: Test Calendly Webhook Handler

**File**: `api/webhooks/calendly.ts`

**Validation**:
```bash
# Simulate Calendly webhook
curl -X POST "https://gtm-yard-flow.vercel.app/api/webhooks/calendly" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "invitee.created",
    "payload": {
      "email": "test-prospect@example.com",
      "event_type": { "name": "30-Minute Meeting" },
      "scheduled_event": { "start_time": "2026-02-05T10:00:00Z" }
    }
  }'
```

---

#### T505.2.1: Sync Meeting Status to Railway (CRITICAL)

**Problem**: Calendly webhook updates Firestore but Railway has its own Postgres table. Both must be updated.

**File**: `api/webhooks/calendly.ts`

**Changes Required**:
```typescript
import { railwayServerClient } from '../../lib/railway-client';

// After Firestore batch.commit(), add:
if (enrollment.railwayEnrollmentId) {
  await railwayServerClient.patch(
    `/api/enrollments/${enrollment.railwayEnrollmentId}`,
    {
      status: 'meeting',
      completionReason: 'meeting_booked',
    }
  );
}
```

**Validation**: After Calendly webhook, verify BOTH Firestore AND Railway show `meeting` status.

---

#### T505.3: Verify Sequence Stops on Meeting

**Flow**:
1. Prospect enrolled in sequence
2. Prospect books Calendly meeting
3. Webhook received
4. Sequence enrollment status → `meeting`
5. No more emails sent

**Validation**:
```bash
# Check enrollment status after meeting booked
curl "$RAILWAY_URL/api/enrollments/ENROLLMENT_ID" \
  -H "Authorization: Bearer $CRON_SECRET" | jq '.status'
# Should return: "meeting"
```

---

## Phase 7: Reply Detection & OOO Handling

### Sprint 506: Reply Processing

**Repos**: GTM-YardFlow (webhooks), YardFlow-Hitlist (API)  
**Goal**: Detect replies and OOO, update enrollment status  
**Effort**: 2-3 hours

#### T506.1: Configure SendGrid Inbound Parse

**SendGrid Inbound Parse URL**: `https://gtm-yard-flow.vercel.app/api/webhooks/inbound`

**MX Record**: Point to SendGrid's inbound parse servers

---

#### T506.2: Test Reply Detection

**File**: `api/webhooks/inbound.ts`

**Flow**:
1. Email received via inbound parse
2. Parse sender email
3. Find matching enrollment
4. Update status → `replied`

---

#### T506.2.1: Sync Reply Status to Railway (CRITICAL)

**Problem**: Inbound webhook updates Firestore but Railway has its own Postgres table. Both must be updated.

**File**: `api/webhooks/inbound.ts`

**Changes Required**:
```typescript
import { railwayServerClient } from '../../lib/railway-client';

// After updating Firestore enrollment, add:
if (enrollment.railwayEnrollmentId) {
  await railwayServerClient.patch(
    `/api/enrollments/${enrollment.railwayEnrollmentId}`,
    {
      status: classification.type === 'out_of_office' ? 'paused' : 'replied',
      pauseReason: classification.pauseTrigger,
      resumeAt: classification.resumeAt?.toISOString(),
    }
  );
}
```

**Validation**: After reply detection, verify BOTH Firestore AND Railway show correct status.

---

#### T506.3: Test OOO Detection

**File**: `src/services/OutOfOfficeDetector.ts`

**Patterns Detected**:
- "Out of office"
- "On vacation"
- "Will return on [date]"

**Flow**:
1. OOO email received
2. Detect OOO pattern
3. Parse return date
4. Pause enrollment until return

---

## Sprint Summary & Dependencies

```
Sprint 500 (CI Green)
    │
    ▼
Sprint 501 (Railway Deploy)
    │
    ▼
Sprint 502 (Vercel ↔ Railway) ──┐
    │                           │
    ▼                           │
Sprint 503 (Email Send) ◄───────┘
    │
    ▼
Sprint 504 (Sequences)
    │
    ▼
Sprint 505 (Meetings) ◄── Sprint 506 (Replies)
    │                           │
    └───────────┬───────────────┘
                ▼
         🎯 PRODUCTION READY
```

---

## Quick Reference: Current Blockers

| Blocker | Owner | Action Required |
|---------|-------|-----------------|
| YardFlow-Hitlist CI failing | Casey | Push commit from YardFlow-Hitlist codespace |
| Railway not deploying | CI | Blocked until above fixed |
| Email not working | Railway | Blocked until Railway deploys |

---

## Validation Checklist

- [ ] **T500**: YardFlow-Hitlist TypeScript: 0 errors
- [ ] **T501**: Railway endpoints responding
- [ ] **T502**: Vercel proxy forwarding correctly
- [ ] **T503**: Test email received
- [ ] **T504**: Sequence enrollment working
- [ ] **T505**: Meeting attribution working
- [ ] **T506**: Reply detection working

---

## Files Changed Summary

### YardFlow-Hitlist (Changes Ready, Need Push)

```
17 files changed, 60 insertions(+), 45 deletions(-)

 eventops/prisma/schema.prisma              | +1  (googleId field)
 eventops/src/app/api/ab-tests/[id]/route.ts | +11
 eventops/src/app/api/ai/dossier/route.ts   | +2
 eventops/src/app/api/ai/score-icp/route.ts | +2
 eventops/src/app/api/auth/session/route.ts | +2
 eventops/src/app/api/cron/google-sync/route.ts | +4
 eventops/src/app/api/export/route.ts       | +27
 eventops/src/app/api/google/gmail/check-replies/route.ts | +2
 eventops/src/app/api/outreach/activity/route.ts | +4
 eventops/src/app/api/outreach/bulk/route.ts | +9
 eventops/src/app/api/prospects/batch/route.ts | +15
 eventops/src/lib/agents/orchestrator.ts    | +10
 eventops/src/lib/agents/state-manager.ts   | +1
 eventops/src/lib/alerts/alert-manager.ts   | +2
 eventops/src/lib/env.ts                    | +4
 eventops/src/lib/queue/workers.ts          | +7
 eventops/tests/e2e/e2e-test-suite.ts       | +2
```

### GTM-YardFlow (No Changes Needed for Phase 1)

Sprint 306-308 integration tests already complete.

---

## Environment Variables Checklist

### Vercel (GTM-YardFlow)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `RAILWAY_API_URL` | Yes | `https://yardflow-hitlist-production-2f41.up.railway.app` | No trailing slash |
| `RAILWAY_API_SECRET` | Yes | `(copy from Railway CRON_SECRET)` | S2S auth for proxy |
| `SERVICE_TO_SERVICE_SECRET` | No | Same as above | Checked before RAILWAY_API_SECRET |
| `CRON_SECRET` | Yes | `(generate strong secret)` | For incoming cron authentication |
| `SENDGRID_WEBHOOK_VERIFICATION_KEY` | Prod | `(from SendGrid dashboard)` | Skip in dev mode |
| `CALENDLY_WEBHOOK_SECRET` | Prod | `(from Calendly dashboard)` | Skip in dev mode |
| `VITE_RAILWAY_ENABLED` | Yes | `true` | Master Railway toggle |
| `VITE_RAILWAY_EMAIL_ENABLED` | Yes | `true` | Route email via Railway |

### Railway (YardFlow-Hitlist)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | Yes | `postgresql://...` | Railway auto-provides |
| `REDIS_URL` | Yes | `redis://...` | Railway auto-provides |
| `CRON_SECRET` | Yes | `(same as Vercel RAILWAY_API_SECRET)` | Validates incoming S2S calls |
| `SENDGRID_API_KEY` | Yes | `SG.xxxxx` | For sending email |
| `SENDGRID_FROM_EMAIL` | Yes | `outreach@yourdomain.com` | Must be verified in SendGrid |
| `JWT_SECRET` | Yes | `(generate 64-char random)` | For session tokens |
| `AUTH_SECRET` | Yes | `(32+ chars)` | NextAuth secret |

---

## Rollback Procedures

### Phase 1 Rollback (CI Fixes)
If YardFlow-Hitlist fails after push:
```bash
cd YardFlow-Hitlist
git revert HEAD
git push origin main
```

### Phase 2 Rollback (Railway Deployment)
If Railway is in a bad state:
1. Railway Dashboard → YardFlow-Hitlist → Deployments
2. Click previous successful deployment
3. Click "Redeploy"

### Phase 3 Rollback (Vercel-Railway Integration)
If Vercel proxy causes issues:
1. Set `VITE_RAILWAY_ENABLED=false` in Vercel env vars
2. Redeploy Vercel
3. UI falls back to Firestore-only mode

### Phase 4-6 Rollback (Email/Sequences/Webhooks)
If email sends are broken:
1. Pause all sequences: Firestore → `sequenceEnrollments` → update all `active` to `paused`
2. Disable Railway email: Set `VITE_RAILWAY_EMAIL_ENABLED=false`
3. Debug in staging environment before re-enabling

---

## Success Indicators Per Phase

| Phase | Indicator | How to Verify |
|-------|-----------|---------------|
| Phase 1 | GitHub Actions green | Check YardFlow-Hitlist → Actions tab |
| Phase 2 | Railway healthy | `curl /api/health` returns 200 |
| Phase 3 | Proxy working | Vercel logs show Railway responses |
| Phase 4 | Email delivered | Check SendGrid Activity Feed |
| Phase 5 | Meeting attributed | Firestore enrollment shows `status: meeting` |
| Phase 6 | Reply detected | Firestore enrollment shows `status: replied` |

---

## Edge Cases & Error Handling

### Calendly Webhooks
- **Duplicate webhook**: Handler is idempotent - uses `invitee.uri` as document ID
- **Prospect not in Railway**: Log warning, update Firestore only, no user-facing issue
- **Missing email**: Skip processing, log error

### SendGrid Webhooks
- **Large batch (up to 1000 events)**: Batch Firestore writes handle this
- **Timeout risk**: Consider increasing `maxDuration` in vercel.json to 60s
- **Signature verification fails**: Return 401, do not process

### Reply Detection
- **OOO without return date**: Default to 7-day pause
- **Non-English OOO**: Best-effort detection with common patterns
- **Bounced OOO reply**: Don't mark as reply, keep enrollment active

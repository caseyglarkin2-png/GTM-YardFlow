# Email Infrastructure Fix Plan

**Created:** 2026-01-29  
**Status:** Ready for Implementation  
**Priority:** CRITICAL - Emails are queued but never sent

---

## Executive Summary

The email infrastructure has all the necessary components (SendGridClient, EmailQueueService, EmailComplianceService, EmailWarmupService) but has a **critical gap**: there is no worker/cron job to process the queue. Emails are enqueued to Firestore and sit in `pending` status forever.

---

## Complete Issue Inventory

### ✅ Verified from Diagnosis

| Issue | Severity | Status |
|-------|----------|--------|
| No queue processor (cron/worker) | P0 | **CONFIRMED** |
| Missing SENDGRID_API_KEY | P0 | **CONFIRMED** |
| Missing SENDGRID_FROM_EMAIL | P0 | **CONFIRMED** |
| TRACKING_SECRET throws on load | P0 | **CONFIRMED** (line 21-24, EmailTrackingService.ts) |
| UNSUBSCRIBE_HMAC_SECRET throws on load | P0 | **CONFIRMED** (line 55-57, EmailComplianceService.ts) |
| `bodyIncludesOneClick()` undefined | P1 | **CONFIRMED** (line 62, unsubscribe.ts) |
| Zod schema lacks `from` field | P2 | **CONFIRMED** (relies on env fallback) |

### 🔍 Additional Issues Discovered

| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| **No Firestore indexes for queue queries** | P1 | Missing `firestore.indexes.json` entries | Queue queries will fail at scale |
| **ALLOWED_REDIRECT_DOMAINS incomplete** | P2 | [lib/origins.ts](lib/origins.ts) | Click tracking may block valid links |
| **No dead-letter monitoring** | P2 | EmailQueueService | Failed emails invisible |
| **Warmup starts at 50/day, not 20** | P2 | [EmailWarmupService.ts](src/services/EmailWarmupService.ts#L17) | Different from diagnosis |
| **No batch queue processing** | P2 | EmailQueueService | processNext() is O(1), slow for volume |
| **Missing SENDGRID_WEBHOOK_PUBLIC_KEY** | P1 | webhook.ts | Webhooks will 401 |
| **No `from` email validation in frontend** | P2 | Send endpoint | Silent fallback to env |
| **CSV has 3315 enriched contacts** | INFO | Name,...txt | Ready for import |

---

## Prioritized Fix Plan

### 🔴 P0 - Blocking (Emails Cannot Send)

#### P0.1: Create Queue Processing Cron Endpoint
**Files:** `api/cron/process-queue.ts` (new), `vercel.json`  
**Effort:** M (2h)  
**Description:** Create a Vercel cron endpoint that calls `EmailQueueService.processBatch()`

```typescript
// api/cron/process-queue.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../lib/firebaseAdmin';
import { EmailQueueService } from '../../src/services/EmailQueueService';
import { EmailComplianceService } from '../../src/services/EmailComplianceService';
import { EmailWarmupService } from '../../src/services/EmailWarmupService';
import { EmailTrackingService } from '../../src/services/EmailTrackingService';
import { SendGridClient } from '../../src/services/SendGridClient';

const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret (Vercel cron or external scheduler)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getAdminDb();
  const sendGrid = new SendGridClient();
  const compliance = new EmailComplianceService(db, sendGrid);
  const warmup = new EmailWarmupService(db);
  const tracking = new EmailTrackingService(db);
  const queue = new EmailQueueService(db, sendGrid, compliance, warmup, tracking, 'cron-worker');

  const batchSize = Number(req.query.batchSize) || 25;
  const processed = await queue.processBatch(batchSize);

  res.status(200).json({
    processed: processed.length,
    results: processed.map(p => ({ id: p.id, status: p.status })),
  });
}
```

**vercel.json addition:**
```json
{
  "crons": [
    {
      "path": "/api/cron/process-queue",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Note:** Vercel Pro plan ($20/mo) required for native crons. Alternative: Use GitHub Actions, cron-job.org, or Upstash QStash.

---

#### P0.2: Configure Required Environment Variables
**Platform:** Vercel Dashboard → Settings → Environment Variables  
**Effort:** XS (15min)

| Variable | Value | Required For |
|----------|-------|--------------|
| `SENDGRID_API_KEY` | `SG.xxx...` | Sending emails |
| `SENDGRID_FROM_EMAIL` | `outreach@yardflow.com` | Sender address |
| `SENDGRID_WEBHOOK_PUBLIC_KEY` | `MFkwEw...` | Webhook signature verification |
| `TRACKING_SECRET` | `openssl rand -hex 32` | Open/click tracking |
| `UNSUBSCRIBE_HMAC_SECRET` | `openssl rand -hex 32` | Unsubscribe tokens |
| `CRON_SECRET` | `openssl rand -hex 32` | Cron authentication |
| `PUBLIC_BASE_URL` | `https://gtm-yard-flow.vercel.app` | Email links |

**Validation:**
```bash
# Generate secrets locally
openssl rand -hex 32  # Run 3x for each secret
```

---

#### P0.3: Fix TRACKING_SECRET Lazy Loading
**Files:** [src/services/EmailTrackingService.ts](src/services/EmailTrackingService.ts#L20-24)  
**Effort:** S (30min)  
**Issue:** Service throws on import if env var missing, breaking all endpoints

**Current (throws on module load):**
```typescript
const trackingSecret = secret || process.env.TRACKING_SECRET;
if (!trackingSecret) {
  throw new Error('TRACKING_SECRET environment variable is required');
}
this.secret = trackingSecret;
```

**Fix (lazy validation):**
```typescript
constructor(private readonly db: Firestore, baseUrl?: string, secret?: string) {
  const root = baseUrl || process.env.TRACKING_BASE_URL || process.env.PUBLIC_BASE_URL || process.env.VERCEL_URL || '';
  this.baseUrl = root.startsWith('http') ? root : `https://${root}`;
  this.secret = secret || process.env.TRACKING_SECRET || '';
}

private ensureSecret(): void {
  if (!this.secret) {
    throw new Error('TRACKING_SECRET environment variable is required');
  }
}

injectTracking(message: EmailMessage): EmailMessage {
  this.ensureSecret();
  // ... rest of method
}
```

---

#### P0.4: Fix UNSUBSCRIBE_HMAC_SECRET Lazy Loading
**Files:** [src/services/EmailComplianceService.ts](src/services/EmailComplianceService.ts#L55-57)  
**Effort:** S (30min)  
**Same pattern as P0.3**

---

### 🟠 P1 - High (Silent Failures)

#### P1.1: Fix Undefined `bodyIncludesOneClick` Function
**Files:** [api/email/unsubscribe.ts](api/email/unsubscribe.ts#L62)  
**Effort:** XS (15min)

**Issue:** Function called but never defined. Should use existing `isListUnsubscribeOneClick` from validateOrigin.

**Fix:**
```typescript
// Line 62, change:
if (!bodyIncludesOneClick(req)) {
// To:
if (!isListUnsubscribeOneClick(req)) {
```

Already imported at line 3: `import { validateRequestOrigin, isListUnsubscribeOneClick } from '../../lib/validateOrigin';`

---

#### P1.2: Add Firestore Indexes for Queue Queries
**Files:** `firestore.indexes.json`  
**Effort:** S (30min)

**Required indexes:**
```json
{
  "indexes": [
    {
      "collectionGroup": "email_queue",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "scheduledAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "email_queue",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "message.id", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "email_events",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "emailId", "order": "ASCENDING" },
        { "fieldPath": "at", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

#### P1.3: Add SENDGRID_WEBHOOK_PUBLIC_KEY Check
**Files:** Already handled in [api/email/webhook.ts](api/email/webhook.ts#L91-93)  
**Status:** Already returns 401 if missing, but needs env var configured

---

### 🟡 P2 - Medium (Scale Issues)

#### P2.1: Add `from` Field to Zod Schema
**Files:** [api/email/send.ts](api/email/send.ts#L17-30)  
**Effort:** XS (15min)

```typescript
const EmailMessageSchema = z.object({
  id: z.string().optional(),
  to: z.string().email('Invalid email address'),
  from: z.string().email('Invalid sender email').optional(), // ADD THIS
  toName: z.string().optional(),
  // ...
});
```

---

#### P2.2: Expand ALLOWED_REDIRECT_DOMAINS
**Files:** [lib/origins.ts](lib/origins.ts#L32-46)  
**Effort:** XS (15min)

Add common domains prospects might visit:
```typescript
export const ALLOWED_REDIRECT_DOMAINS = [
  'calendly.com',
  'freightroll.com',
  'yardflow.com',
  'gtm-yard-flow.vercel.app',
  'hubspot.com',
  'linkedin.com',
  'zoom.us',
  'meet.google.com',
  'teams.microsoft.com',
  // ADD THESE:
  'google.com',
  'youtube.com',
  'twitter.com',
  'x.com',
  'salesforce.com',
  'stripe.com',
  'loom.com',
] as const;
```

---

#### P2.3: Add Dead-Letter Queue Monitoring
**Files:** `api/admin/dead-letters.ts` (new)  
**Effort:** M (1h)

Create endpoint to view/retry failed emails:
```typescript
// GET /api/admin/dead-letters - List dead-letter queue
// POST /api/admin/dead-letters/:id/retry - Retry a failed email
```

---

#### P2.4: Optimize Batch Processing
**Files:** [src/services/EmailQueueService.ts](src/services/EmailQueueService.ts#L70-78)  
**Effort:** M (2h)

Current `processBatch()` calls `processNext()` N times (N queries). Optimize to:
1. Query N items at once
2. Lock all in a single transaction
3. Process in parallel with concurrency limit

---

## CSV Import Architecture for 3000+ Contacts

### Option A: Frontend Streaming (Recommended)
**Effort:** L (4h)

1. Use existing `ImportWizard.tsx` + `CsvParserService.ts`
2. Process in chunks of 100 contacts
3. Show progress bar with current/total
4. Firestore batched writes (max 500/batch)

**Flow:**
```
CSV File → Papa Parse → Chunks of 100 → Column Mapping UI
→ Validate Emails → Dedupe → Firestore Batch Write
→ Optional: Auto-enroll in sequences
```

### Option B: Server-Side Import Endpoint
**Effort:** M (2h)

```typescript
// api/import/contacts.ts
// POST with multipart/form-data
// Returns import job ID, polls for completion
```

### CSV Structure (from current files)
The enriched CSV at [Name,...txt](Name,First_Name,Last_Name,Company,J.txt) has:
```
Name,First_Name,Last_Name,Company,Job_Title,Category,PersonScore,Enriched_Email,Confidence,Match_Type,Domain_Used,Pattern_Used
```

**Mapping to Prospect:**
| CSV Column | Prospect Field | Notes |
|------------|----------------|-------|
| `First_Name` | `firstName` | |
| `Last_Name` | `lastName` | |
| `Name` | `name` | Fallback if split fails |
| `Company` | `company` | |
| `Job_Title` | `title` | |
| `Enriched_Email` | `email` | Primary contact email |
| `Confidence` | `emailConfidence` | verified/medium/low |
| `PersonScore` | `score` | Primo lookalike score |
| `Category` | `tags[]` | Speaker, Attendee, etc. |

### Import Safeguards
1. **Validate all emails** before import (EmailComplianceService.validateEmail)
2. **Check suppression list** - Skip suppressed emails
3. **Dedupe by email** - Merge with existing contacts
4. **Rate limit imports** - Max 500 contacts/minute
5. **Audit trail** - Log import in ImportHistoryService

---

## Sprint Task Breakdown

### Sprint 58: Email Infrastructure Critical Fixes

| Task ID | Title | Size | Dependencies |
|---------|-------|------|--------------|
| T58.1 | Configure Vercel env vars (P0.2) | XS | None |
| T58.2 | Create cron queue processor (P0.1) | M | T58.1 |
| T58.3 | Fix bodyIncludesOneClick (P1.1) | XS | None |
| T58.4 | Fix TRACKING_SECRET lazy load (P0.3) | S | None |
| T58.5 | Fix UNSUBSCRIBE_HMAC_SECRET lazy load (P0.4) | S | None |
| T58.6 | Add Firestore indexes (P1.2) | S | None |
| T58.7 | Add `from` to Zod schema (P2.1) | XS | None |
| T58.8 | Expand redirect domains (P2.2) | XS | None |

**Sprint Total:** ~6h  
**Parallel Execution:** T58.1 → T58.2, then T58.3-T58.8 in parallel

### Sprint 59: Bulk Import & Monitoring

| Task ID | Title | Size | Dependencies |
|---------|-------|------|--------------|
| T59.1 | Bulk CSV import with progress UI | L | None |
| T59.2 | Dead-letter queue monitoring | M | None |
| T59.3 | Optimize batch queue processing | M | T58.2 |
| T59.4 | Import 3000+ enriched contacts | M | T59.1 |

---

## Verification Checklist

### After Sprint 58
- [ ] Send test email via UI → receives in inbox
- [ ] Check Firestore `email_queue` → status changes from `pending` to `sent`
- [ ] Verify unsubscribe link works (GET + POST)
- [ ] Confirm open/click tracking pixels load

### After Sprint 59
- [ ] Import 100 contacts from CSV
- [ ] Import full 3000+ contact list
- [ ] View dead-letter queue in admin
- [ ] Process 50 emails in under 30 seconds

---

## Alternative: External Cron Service

If Vercel Pro is not available, use one of these:

| Service | Free Tier | Setup |
|---------|-----------|-------|
| **cron-job.org** | 60 jobs/month | Add URL + Bearer token |
| **GitHub Actions** | 2000 min/mo | Workflow with `schedule` trigger |
| **Upstash QStash** | 500 msg/day | SDK integration |
| **Cloudflare Workers** | 100k req/day | Scheduled worker |

Example GitHub Actions workflow:
```yaml
name: Process Email Queue
on:
  schedule:
    - cron: '*/5 * * * *'
jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://gtm-yard-flow.vercel.app/api/cron/process-queue
```

---

## Summary

**Root Cause:** Queue exists, processor doesn't.

**Critical Path:**
1. Set env vars (15 min)
2. Create cron endpoint (2h)
3. Fix undefined function (15 min)
4. Fix lazy loading issues (1h)

**Total to Unblock Email:** ~3.5 hours

**Import 3000 contacts:** Additional ~4 hours with existing ImportWizard infrastructure.

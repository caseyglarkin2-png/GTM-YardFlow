# Sprint Plan V39: Email Sendability Optimization

**Status**: 📋 PLANNING  
**Created**: February 5, 2026  
**Reviewed**: February 5, 2026 (subagent review incorporated)  
**Goal**: Maximize email deliverability, domain reputation, and compliance to ensure emails reach inboxes  
**North Star**: 95%+ deliverability rate, <1% bounce rate, <0.1% spam rate

---

## Review Notes (CRITICAL Issues Fixed)

> ⚠️ **Subagent Review Incorporated**: The following critical issues were identified and addressed:
> 1. **T39A.1**: Extends existing `EmailStatsService` instead of duplicating
> 2. **T39B.1**: Uses DNS-over-HTTPS (DoH) since Vercel Edge doesn't support Node `dns`
> 3. **T39E.1**: Clarified as enhancement of existing `SuppressionSyncService`
> 4. **T39A.7**: Warmup limit status already implemented in S38F (WarmupLimitBadge)
> 5. Added configurable health thresholds via env vars
> 6. Added retry/backoff for cron jobs
> 7. Added idempotency handling for crons

---

## Executive Summary

### The Problem
Email deliverability is critical for sales outreach. Poor sendability = wasted effort:
- Emails land in spam → no opens, no replies, no meetings
- High bounce rates → damaged sender reputation → blacklisting
- Compliance violations → CAN-SPAM fines ($46,517 per email)

### What This Repo Controls (GTM-YardFlow/Vercel)
| Area | Current State | Gap |
|------|---------------|-----|
| **Warmup Limits** | ✅ Implemented (50→100→250→500→∞/day) | Need UI feedback loop |
| **Suppression Lists** | ✅ Implemented (bounce/spam/unsub) | Need SendGrid sync |
| **CAN-SPAM Compliance** | ✅ Headers + footer injected | Need content validation |
| **Bounce/Spam Webhooks** | ✅ Processing events | Need reputation dashboard |
| **Domain Authentication** | ❌ Not shown | Need SPF/DKIM/DMARC display |
| **Content Spam Scoring** | ❌ Not implemented | Pre-send spam check |
| **Send-Time Optimization** | ❌ Not implemented | Timezone-aware scheduling |
| **Reputation Monitoring** | ❌ Not implemented | Track rates over time |

### What Railway Controls (YardFlow-Hitlist)
- Actual SendGrid API calls
- Email template storage
- AI content generation

### Success Metrics
| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Deliverability Rate | Unknown | >95% | delivered/sent |
| Bounce Rate | Unknown | <1% | bounced/sent |
| Spam Rate | Unknown | <0.1% | spam/sent |
| Open Rate | Unknown | >25% | opens/delivered |
| Reply Rate | Unknown | >5% | replies/delivered |

---

## Sprint Breakdown

### Sprint 39A: Reputation Dashboard & Monitoring
**Goal**: Visibility into email health to catch problems before they escalate  
**Demo**: Dashboard shows real-time deliverability metrics with trend charts

### Sprint 39B: Domain Authentication Status
**Goal**: Ensure SPF/DKIM/DMARC are properly configured and visible  
**Demo**: Settings page shows domain auth status with fix guidance

### Sprint 39C: Pre-Send Validation & Spam Score
**Goal**: Prevent spam-triggering content from being sent  
**Demo**: Email compose shows spam score, blocks high-risk content

### Sprint 39D: Smart Send-Time Optimization
**Goal**: Send emails when recipients are most likely to open  
**Demo**: Emails scheduled for recipient's business hours

### Sprint 39E: Suppression List Sync & Hygiene
**Goal**: Keep suppression lists in sync with SendGrid, prevent re-sending to bad addresses  
**Demo**: Suppression sync runs automatically, shows counts in dashboard

### Sprint 39F: Compliance Hardening
**Goal**: Ensure all emails pass compliance checks before sending  
**Demo**: Non-compliant emails are blocked with clear error messages

---

## Sprint 39A: Reputation Dashboard & Monitoring

**Goal**: Give users visibility into their email health  
**Demo**: Dashboard tab shows deliverability, bounce, spam rates with 7/30 day trends

### Task Breakdown

#### T39A.1: Extend EmailStatsService with Reputation Methods [M - 2hr]
**Description**: Extend existing EmailStatsService with health score and trend calculations

> ⚠️ **CRITICAL FIX**: Existing `EmailStatsService` already has similar functionality. This task EXTENDS it rather than duplicating.

**Files**: `src/services/EmailStatsService.ts` (extend existing)

**Implementation**:
```typescript
// EXTEND existing EmailStatsService with these new methods:
export interface ReputationMetrics {
  period: '24h' | '7d' | '30d';
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  spam: number;
  unsubscribed: number;
  // Calculated rates
  deliverabilityRate: number;  // delivered/sent
  bounceRate: number;          // bounced/sent
  spamRate: number;            // spam/sent
  openRate: number;            // opened/delivered
  clickRate: number;           // clicked/delivered
  // Health score (0-100)
  healthScore: number;
}

export class EmailReputationService {
  constructor(private readonly db: Firestore) {}
  
  async getMetrics(tenantId: string, period: '24h' | '7d' | '30d'): Promise<ReputationMetrics>;
  async getHealthScore(tenantId: string): Promise<number>;
  async getTrend(tenantId: string, metric: string, days: number): Promise<{date: string, value: number}[]>;
  shouldPauseSending(metrics: ReputationMetrics): { pause: boolean; reason?: string };
}
```

**Tests**: `src/__tests__/services/EmailReputationService.test.ts`

**Specific Test Scenarios (edge cases)**:
```typescript
describe('EmailReputationService', () => {
  // Edge: 0 sent emails → rates should be 0, not NaN
  it('returns 0 rates when 0 emails sent', () => {
    const metrics = service.calculateRates({ sent: 0, delivered: 0, bounced: 0 });
    expect(metrics.deliverabilityRate).toBe(0);
    expect(Number.isNaN(metrics.bounceRate)).toBe(false);
  });

  // Edge: 0 delivered → bounceRate should be bounded
  it('handles 0 delivered correctly', () => {
    const metrics = service.calculateRates({ sent: 10, delivered: 0, bounced: 10 });
    expect(metrics.bounceRate).toBe(1); // 100%
  });

  // Health score bounds: always 0-100
  it('clamps health score to 0-100', () => {
    const score = service.calculateHealthScore({ bounceRate: 2.0, spamRate: 1.0 });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  // Boundary: exactly at threshold
  it('shouldPauseSending returns true at 5.01% bounce', () => {
    expect(service.shouldPauseSending({ bounceRate: 0.0501 }).pause).toBe(true);
  });
  it('shouldPauseSending returns false at 5.00% bounce', () => {
    expect(service.shouldPauseSending({ bounceRate: 0.05 }).pause).toBe(false);
  });
});
```

**Validation**: `npm test -- --run EmailReputationService`

**Commit**: `feat(39A.1): extend EmailStatsService with reputation methods`

---

#### T39A.2: Add /api/email/reputation endpoint [S - 1hr]
**Description**: API endpoint to fetch reputation metrics

**Files**: `api/email/reputation.ts`

**Implementation**:
```typescript
// GET /api/email/reputation?period=7d
// Returns: ReputationMetrics

// Response includes:
// - Aggregated metrics for period
// - Trend data for charts
// - Health score with grade (A/B/C/D/F)
// - Recommendations if issues detected
```

**Tests**: `src/__tests__/api/email-reputation.test.ts`
- Returns 401 without auth
- Returns metrics for authenticated user
- Supports period query param (24h, 7d, 30d)
- Includes recommendations when health is poor

**Validation**: `npm test -- --run email-reputation`

**Commit**: `feat(39A.2): add /api/email/reputation endpoint`

---

#### T39A.3: Create useEmailReputation hook [S - 1hr]
**Description**: React hook for fetching and caching reputation data

**Files**: `src/hooks/useEmailReputation.ts`

**Implementation**:
```typescript
export function useEmailReputation(options?: {
  period?: '24h' | '7d' | '30d';
  autoRefresh?: boolean;
  refreshInterval?: number;
}): {
  metrics: ReputationMetrics | null;
  isLoading: boolean;
  error: Error | null;
  healthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendations: string[];
  refresh: () => void;
};
```

**Tests**: `src/__tests__/hooks/useEmailReputation.test.ts`
- Fetches on mount
- Calculates health grade correctly
- Handles loading and error states
- Auto-refreshes at interval

**Validation**: `npm test -- --run useEmailReputation`

**Commit**: `feat(39A.3): add useEmailReputation hook`

---

#### T39A.4: Create ReputationCard component [M - 2hr]
**Description**: Dashboard component showing reputation metrics

**Files**: `src/components/dashboard/ReputationCard.tsx`

**Implementation**:
```typescript
// Shows:
// - Health score as circular gauge (0-100)
// - Key metrics: Deliverability, Bounce Rate, Spam Rate, Open Rate
// - Trend sparklines for each metric
// - Color-coded status (green/yellow/red)
// - Warning banner if issues detected
```

**Tests**: `src/__tests__/components/ReputationCard.test.tsx`
- Renders health score gauge
- Shows correct color for health levels
- Displays warning when unhealthy
- Handles loading state

**Validation**: `npm test -- --run ReputationCard`

**Commit**: `feat(39A.4): add ReputationCard dashboard component`

---

#### T39A.5: Integrate ReputationCard into Dashboard [S - 30min]
**Description**: Add reputation card to main dashboard

**Files**: `src/components/Dashboard.tsx`

**Tests**: Visual verification in dev environment

**Commit**: `feat(39A.5): integrate ReputationCard into dashboard`

---

#### T39A.6: Add reputation metrics to Firestore aggregation [M - 1.5hr]
**Description**: Scheduled aggregation of email events into daily/weekly metrics with idempotency

**Files**: `api/cron/aggregate-reputation.ts`

**Implementation**:
```typescript
// Run daily at 1am UTC
// MUST include idempotency check:
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Idempotency: check for recent run
  const lastRun = await db.collection('cron_runs').doc('aggregate-reputation').get();
  if (lastRun.data()?.completedAt > Date.now() - 3600_000) {
    return res.json({ skipped: true, reason: 'recent_run_exists' });
  }

  // 2. Mark run started
  await db.collection('cron_runs').doc('aggregate-reputation').set({
    startedAt: Date.now(),
    status: 'running'
  });

  try {
    // 3. Aggregate email_events into reputation_metrics collection
    // 4. Calculate and store daily stats per tenant
    // 5. Prune data older than 90 days
    
    // 6. Mark complete
    await db.collection('cron_runs').doc('aggregate-reputation').update({
      completedAt: Date.now(),
      status: 'completed'
    });
  } catch (error) {
    await db.collection('cron_runs').doc('aggregate-reputation').update({
      status: 'failed',
      error: error.message
    });
    throw error;
  }
}
```

**Tests**: `src/__tests__/api/aggregate-reputation.test.ts`
- Skips if recent run exists (idempotency)
- Aggregates correctly from email_events
- Updates existing daily record
- Handles missing data gracefully

**Validation**: `npm test -- --run aggregate-reputation`

**Commit**: `feat(39A.6): add reputation metrics aggregation cron with idempotency`

---

### Sprint 39A Exit Criteria
- [ ] EmailReputationService implemented with tests
- [ ] /api/email/reputation endpoint returning metrics
- [ ] useEmailReputation hook working
- [ ] ReputationCard showing on dashboard
- [ ] Aggregation cron scheduled and working
- [ ] All tests passing

**Sprint 39A Demo**: Open dashboard, see real email health metrics with trends

---

## Sprint 39B: Domain Authentication Status

**Goal**: Show SPF/DKIM/DMARC status so users can fix domain issues  
**Demo**: Settings → Domain Health shows authentication status with fix guidance

### Task Breakdown

#### T39B.1: Create DomainAuthService [M - 2hr]
**Description**: Service to check domain authentication status via DNS-over-HTTPS

> ⚠️ **CRITICAL FIX**: Vercel Edge doesn't support Node.js `dns` module. Use DNS-over-HTTPS (DoH) via Google/Cloudflare DNS API.

**Files**: `src/services/DomainAuthService.ts`

**Implementation**:
```typescript
export interface DomainAuthStatus {
  domain: string;
  spf: { valid: boolean; record?: string; issue?: string };
  dkim: { valid: boolean; selector?: string; issue?: string };
  dmarc: { valid: boolean; policy?: string; issue?: string };
  overallHealth: 'good' | 'warning' | 'critical';
  recommendations: string[];
}

// Use DNS-over-HTTPS since Vercel Edge doesn't support Node dns module
export class DomainAuthService {
  private readonly dohEndpoint = 'https://dns.google/resolve';

  async checkSPF(domain: string): Promise<{ valid: boolean; record?: string }> {
    const response = await fetch(`${this.dohEndpoint}?name=${domain}&type=TXT`);
    const data = await response.json();
    const spfRecord = data.Answer?.find((r: any) => r.data?.includes('v=spf1'));
    return { valid: !!spfRecord, record: spfRecord?.data };
  }

  async checkDMARC(domain: string): Promise<{ valid: boolean; policy?: string }> {
    const response = await fetch(`${this.dohEndpoint}?name=_dmarc.${domain}&type=TXT`);
    const data = await response.json();
    const dmarcRecord = data.Answer?.find((r: any) => r.data?.includes('v=DMARC1'));
    return { valid: !!dmarcRecord, policy: dmarcRecord?.data };
  }

  async checkDomain(domain: string): Promise<DomainAuthStatus>;
}
```

**Tests**: `src/__tests__/services/DomainAuthService.test.ts`
- Returns valid status for properly configured domain
- Returns specific issues for each auth type
- Generates actionable recommendations

**Validation**: `npm test -- --run DomainAuthService`

**Commit**: `feat(39B.1): add DomainAuthService for DNS auth checks`

---

#### T39B.2: Add /api/domain/check endpoint [M - 1.5hr]
**Description**: API endpoint to check domain authentication

**Files**: `api/domain/check.ts`

**Implementation**:
```typescript
// POST /api/domain/check
// Body: { domain: "freightroll.com" }
// Returns: DomainAuthStatus

// Uses dns.resolveTxt for SPF/DMARC
// Uses dns.resolve for DKIM selector
// Caches results for 1 hour
```

**Tests**: `src/__tests__/api/domain-check.test.ts`
- Returns 401 without auth
- Returns correct status for domain
- Caches results to avoid rate limiting

**Validation**: `npm test -- --run domain-check`

**Commit**: `feat(39B.2): add /api/domain/check endpoint`

---

#### T39B.3: Create DomainHealthCard component [M - 2hr]
**Description**: UI component showing domain authentication status

**Files**: `src/components/settings/DomainHealthCard.tsx`

**Implementation**:
```typescript
// Shows:
// - Domain name input (or auto-detect from sender email)
// - SPF status with ✓/✗ and record
// - DKIM status with ✓/✗
// - DMARC status with ✓/✗ and policy
// - "Check Domain" button
// - Fix recommendations with documentation links
```

**Tests**: `src/__tests__/components/DomainHealthCard.test.tsx`
- Shows loading state during check
- Displays correct status icons
- Shows recommendations for issues

**Validation**: `npm test -- --run DomainHealthCard`

**Commit**: `feat(39B.3): add DomainHealthCard component`

---

#### T39B.4: Add Domain Health to Settings [S - 30min]
**Description**: Integrate DomainHealthCard into settings page

**Files**: `src/components/Settings.tsx` or appropriate settings component

**Commit**: `feat(39B.4): add domain health to settings`

---

### Sprint 39B Exit Criteria
- [ ] DomainAuthService checking SPF/DKIM/DMARC
- [ ] /api/domain/check endpoint working
- [ ] DomainHealthCard showing status
- [ ] Recommendations displayed for issues
- [ ] All tests passing

**Sprint 39B Demo**: Go to Settings, see domain auth status with any issues highlighted

---

## Sprint 39C: Pre-Send Validation & Spam Score

**Goal**: Catch spam-triggering content before it's sent  
**Demo**: Compose email, see real-time spam score, get warnings for risky content

### Task Breakdown

#### T39C.1: Create SpamScoreService [M - 2hr]
**Description**: Service to analyze email content for spam triggers

**Files**: `src/services/SpamScoreService.ts`

**Implementation**:
```typescript
export interface SpamAnalysis {
  score: number;           // 0-100 (higher = more spammy)
  triggers: SpamTrigger[];
  recommendation: 'send' | 'review' | 'block';
}

export interface SpamTrigger {
  type: 'word' | 'pattern' | 'structure' | 'link';
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestion?: string;
}

export class SpamScoreService {
  analyzeContent(subject: string, body: string): SpamAnalysis;
}

// Checks for:
// - Spam trigger words (FREE, ACT NOW, LIMITED TIME)
// - ALL CAPS abuse
// - Excessive punctuation (!!!, ???)
// - URL shorteners (bit.ly, etc.)
// - Missing personalization
// - Image-to-text ratio (if HTML)
// - Subject line red flags
```

**Tests**: `src/__tests__/services/SpamScoreService.test.ts`
- Scores clean email low
- Detects spam trigger words
- Identifies ALL CAPS abuse
- Flags URL shorteners
- Returns actionable suggestions

**Validation**: `npm test -- --run SpamScoreService`

**Commit**: `feat(39C.1): add SpamScoreService for content analysis`

---

#### T39C.2: Create useSpamScore hook [S - 1hr]
**Description**: Hook for real-time spam scoring during compose

**Files**: `src/hooks/useSpamScore.ts`

**Implementation**:
```typescript
export function useSpamScore(subject: string, body: string, options?: {
  debounceMs?: number;
}): {
  analysis: SpamAnalysis | null;
  isAnalyzing: boolean;
  scoreColor: 'green' | 'yellow' | 'red';
};
```

**Tests**: `src/__tests__/hooks/useSpamScore.test.ts`
- Debounces analysis
- Returns correct score color
- Updates on content change

**Validation**: `npm test -- --run useSpamScore`

**Commit**: `feat(39C.2): add useSpamScore hook`

---

#### T39C.3: Create SpamScoreIndicator component [M - 1.5hr]
**Description**: Visual indicator showing spam score in compose UI

**Files**: `src/components/email/SpamScoreIndicator.tsx`

**Implementation**:
```typescript
// Shows:
// - Score as colored badge (0-100)
// - Expandable list of triggers
// - Suggestions for each trigger
// - "Blocked" warning if score > 70
```

**Tests**: `src/__tests__/components/SpamScoreIndicator.test.tsx`
- Shows correct color for score ranges
- Expands to show triggers
- Shows block warning for high scores

**Validation**: `npm test -- --run SpamScoreIndicator`

**Commit**: `feat(39C.3): add SpamScoreIndicator component`

---

#### T39C.4: Integrate spam score into BulkEmailModal [S - 30min]
**Description**: Add SpamScoreIndicator to email compose flow

**Files**: `src/components/BulkEmailModal.tsx`

**Commit**: `feat(39C.4): integrate spam score into BulkEmailModal`

---

#### T39C.5: Block high-spam emails in /api/email/send [S - 30min]
**Description**: Server-side validation to block high-spam content

**Files**: `api/email/send.ts`

**Implementation**:
- If spam score > 70, return 422 with triggers
- Log blocked emails for analysis

**Tests**: Add test case to existing email-send tests

**Commit**: `feat(39C.5): block high-spam emails server-side`

---

#### T39C.6: Add Railway content validation endpoint [M - 1hr]
**Description**: Railway endpoint for SendGrid-powered content analysis (deeper than local regex)

> ⚠️ **HIGH PRIORITY**: Local regex scoring catches obvious issues but misses many delivery problems. Railway should call SendGrid's content analysis for accurate predictions.

**Files**: Railway repo - `api/email/validate-content.ts`

**Railway Implementation** (document here, implement in Railway repo):
```typescript
// POST /api/email/validate-content
// Request: { subject: string, body: string, fromEmail: string }
// Response: {
//   score: number,           // 0-100 (SendGrid's deliverability prediction)
//   issues: string[],        // Detected problems
//   recommendation: 'send' | 'review' | 'block',
//   sendgridValidation?: object  // Raw SendGrid response
// }

// Implementation calls SendGrid Email Validation API
// Cache results for 1hr to avoid excessive API calls
```

**GTM-YardFlow Changes**:
- Add `railwayClient.email.validateContent()` method
- Call from useSpamScore hook as fallback when local score > 50

**Commit**: `feat(39C.6): integrate Railway content validation`

---

### Sprint 39C Exit Criteria
- [ ] SpamScoreService analyzing content (local)
- [ ] Railway content validation for deeper analysis
- [ ] Real-time scoring in compose UI
- [ ] High-spam emails blocked server-side
- [ ] All tests passing

**Sprint 39C Demo**: Compose email with spam words, see score go red, try to send and get blocked

---

## Sprint 39D: Smart Send-Time Optimization

**Goal**: Send emails when recipients are most likely to engage  
**Demo**: Emails automatically scheduled for recipient's optimal time

### Task Breakdown

#### T39D.1: Enhance TimezoneService for prospect timezone [M - 1.5hr]
**Description**: Infer prospect timezone from location/company data

**Files**: `src/services/TimezoneService.ts` (enhance existing)

**Implementation**:
```typescript
// Add to existing service:
inferTimezoneFromLocation(city?: string, state?: string, country?: string): string;
inferTimezoneFromCompany(companyDomain: string): Promise<string | null>;
getBusinessHoursStart(timezone: string): number; // 8-9am local
getBusinessHoursEnd(timezone: string): number;   // 5-6pm local
```

**Tests**: Enhance existing tests

**Commit**: `feat(39D.1): enhance TimezoneService for prospect timezone inference`

---

#### T39D.2: Create SendTimeOptimizer service [M - 2hr]
**Description**: Calculate optimal send time for each prospect

**Files**: `src/services/SendTimeOptimizer.ts`

**Implementation**:
```typescript
export interface OptimalSendTime {
  timestamp: number;
  timezone: string;
  localTime: string;
  reason: string;
}

export class SendTimeOptimizer {
  constructor(private readonly timezoneService: TimezoneService) {}
  
  getOptimalTime(prospect: { city?: string; state?: string; timezone?: string }): OptimalSendTime;
  
  // Rules:
  // - Tue-Thu best days (avoid Mon/Fri)
  // - 9-11am or 2-4pm recipient local time
  // - Never weekends
  // - If unknown timezone, default to prospect's state or ET
}
```

**Tests**: `src/__tests__/services/SendTimeOptimizer.test.ts`
- Returns time in business hours
- Avoids weekends
- Uses prospect timezone if available
- Falls back to reasonable defaults

**Validation**: `npm test -- --run SendTimeOptimizer`

**Commit**: `feat(39D.2): add SendTimeOptimizer service`

---

#### T39D.3: Add "Optimize Send Time" toggle to BulkEmailModal [S - 1hr]
**Description**: Let users opt-in to smart scheduling

**Files**: `src/components/BulkEmailModal.tsx`

**Implementation**:
- Add checkbox "Optimize send time for each recipient"
- When enabled, show estimated delivery times
- Pass scheduledAt to /api/email/send

**Tests**: Component test for toggle behavior

**Commit**: `feat(39D.3): add send-time optimization toggle`

---

#### T39D.4: Handle scheduled emails in queue processing [M - 1hr]
**Description**: Process queue respecting scheduledAt timestamps

**Files**: `api/cron/process-queue.ts`, `src/services/EmailQueueService.ts`

**Implementation**:
- Query only for emails where scheduledAt <= now
- Sort by scheduledAt ascending

**Tests**: Test that scheduled emails aren't sent early

**Commit**: `feat(39D.4): respect scheduledAt in queue processing`

---

### Sprint 39D Exit Criteria
- [ ] Prospect timezone inference working
- [ ] SendTimeOptimizer calculating optimal times
- [ ] UI toggle for smart scheduling
- [ ] Queue processing respects scheduledAt
- [ ] All tests passing

**Sprint 39D Demo**: Select prospects, enable optimized timing, see scheduled times per prospect

---

## Sprint 39E: Suppression List Sync & Hygiene

**Goal**: Keep suppression lists clean and synced with SendGrid  
**Demo**: Dashboard shows suppression counts, sync runs automatically

### Task Breakdown

#### T39E.1: Enhance SuppressionSyncService with Stats & Cleanup [M - 2hr]
**Description**: Add missing methods to existing SuppressionSyncService

> ⚠️ **CRITICAL FIX**: `SuppressionSyncService` already exists with `syncFromSendGrid()` and `syncToSendGrid()`. This task only adds missing methods.

**Files**: `src/services/SuppressionSyncService.ts` (ENHANCE existing, do NOT recreate)

**Implementation** (add ONLY these new methods):
```typescript
// Existing methods - DO NOT RECREATE:
// - syncFromSendGrid() ✅ already exists
// - syncToSendGrid() ✅ already exists

// NEW methods to add:
export class SuppressionSyncService {
  // Hygiene - NEW
  async removeStale(olderThanDays: number): Promise<number>;
  
  // Stats - NEW
  async getStats(): Promise<{
    total: number;
    byReason: Record<string, number>;
    last30Days: number;
  }>;
}
```

**Tests**: `src/__tests__/services/SuppressionSyncService.test.ts`
- removeStale removes entries older than threshold
- getStats returns correct counts by reason
- getStats handles empty suppression list

**Validation**: `npm test -- --run SuppressionSyncService`

**Commit**: `feat(39E.1): add stats and cleanup methods to SuppressionSyncService`

---

#### T39E.2: Add /api/cron/sync-suppressions endpoint [S - 1.5hr]
**Description**: Cron job to sync suppressions daily with retry/backoff

**Files**: `api/cron/sync-suppressions.ts`

**Implementation**:
```typescript
// Run daily at 2am UTC
// MUST include:
// 1. Idempotency check
const lastRun = await db.collection('cron_runs').doc('sync-suppressions').get();
if (lastRun.data()?.completedAt > Date.now() - 3600_000) {
  return { skipped: true, reason: 'recent_run_exists' };
}

// 2. Exponential backoff (3 retries: 1s, 2s, 4s)
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}

// 3. Partial success handling - continue on individual failures
// 4. Dead-letter logging for items that fail 3x
```

**Tests**: `src/__tests__/api/sync-suppressions.test.ts`
- Skips if recent run exists (idempotency)
- Retries on transient failures
- Logs dead-letter items

**Commit**: `feat(39E.2): add suppression sync cron with retry/backoff`

---

#### T39E.3: Create SuppressionStatsCard component [S - 1hr]
**Description**: Dashboard card showing suppression statistics

**Files**: `src/components/dashboard/SuppressionStatsCard.tsx`

**Implementation**:
- Show total suppressed count
- Breakdown by reason (bounce, spam, unsub)
- Last 30 days trend

**Tests**: Component tests

**Commit**: `feat(39E.3): add SuppressionStatsCard component`

---

#### T39E.4: Add suppression stats to ReputationCard [S - 30min]
**Description**: Include suppression metrics in reputation view

**Files**: Modify `src/components/dashboard/ReputationCard.tsx`

**Commit**: `feat(39E.4): add suppression stats to ReputationCard`

---

### Sprint 39E Exit Criteria
- [ ] SuppressionSyncService syncing with SendGrid
- [ ] Daily sync cron running
- [ ] Stats visible in dashboard
- [ ] All tests passing

**Sprint 39E Demo**: View dashboard, see suppression stats, trigger manual sync

---

## Sprint 39F: Compliance Hardening

**Goal**: Bulletproof CAN-SPAM compliance, no emails sent without required elements  
**Demo**: Send without unsubscribe = blocked with clear error

### Task Breakdown

#### T39F.1: Add content compliance validation [M - 1.5hr]
**Description**: Validate email content has all required CAN-SPAM elements

**Files**: Enhance `src/services/EmailComplianceService.ts`

**Implementation**:
```typescript
// Enhance validateComplianceElements to also check:
// - Sender name present
// - Reply-to address valid
// - Subject not deceptive
// - Body length reasonable (not empty, not just links)
```

**Tests**: Add test cases for new validations

**Commit**: `feat(39F.1): enhance content compliance validation`

---

#### T39F.2: Enforce compliance in /api/email/send [S - 1hr]
**Description**: Block non-compliant emails with clear errors

**Files**: `api/email/send.ts`

**Implementation**:
- Check compliance before queuing
- Return 422 with missing elements listed
- Log compliance blocks for audit

**Tests**: Add test cases for compliance blocking

**Commit**: `feat(39F.2): enforce compliance in email send endpoint`

---

#### T39F.3: Create ComplianceChecklist component [S - 1hr]
**Description**: Show compliance status in compose UI

**Files**: `src/components/email/ComplianceChecklist.tsx`

**Implementation**:
- Checklist showing:
  - ✓ Unsubscribe header present
  - ✓ Physical address in footer
  - ✓ Valid reply-to address
  - ✓ Non-deceptive subject
- Red items = must fix before send

**Tests**: Component tests

**Commit**: `feat(39F.3): add ComplianceChecklist component`

---

#### T39F.4: Add compliance warnings to BulkEmailModal [S - 30min]
**Description**: Show compliance checklist in modal

**Files**: `src/components/BulkEmailModal.tsx`

**Commit**: `feat(39F.4): add compliance checklist to BulkEmailModal`

---

### Sprint 39F Exit Criteria
- [ ] Enhanced compliance validation
- [ ] Non-compliant emails blocked server-side
- [ ] UI shows compliance status
- [ ] All tests passing

**Sprint 39F Demo**: Remove unsubscribe link, try to send, see block message with what's missing

---

## Implementation Order & Dependencies

### Sprint Dependencies (Critical Path)
```
Sprint 39A (Reputation) ← FOUNDATION - Must complete first
    │
    ├── Sprint 39E (Suppression) → depends on 39A.4 ReputationCard
    │
    ├── Sprint 39B (Domain Auth) → independent, can run parallel
    │
    ├── Sprint 39C (Spam Score) → depends on 39A.1 for ReputationMetrics type
    │
    ├── Sprint 39D (Send Time) → independent, can run parallel
    │
    └── Sprint 39F (Compliance) → depends on 39C.1 SpamScoreService
```

### Task-Level Dependencies
| Task | Depends On | Blocks |
|------|------------|--------|
| T39A.1 | - | T39A.2, T39A.3, T39A.4, T39C.1 |
| T39A.4 | T39A.3 | T39A.5, T39E.4 |
| T39C.1 | T39A.1 (types) | T39C.2, T39C.5, T39F.1 |
| T39F.1 | T39C.1 | T39F.2 |

### Recommended Execution Order
```
Week 1: 39A (all tasks) - Foundation
Week 2: 39B + 39E (parallel) - Domain + Hygiene  
Week 3: 39C + 39D (parallel) - Spam + Timing
Week 4: 39F - Final hardening
```
Sprint 39D (Send Time) ← can run parallel after 39A
    ↓
Sprint 39F (Compliance) ← final hardening
```

**Recommended Order**: 39A → 39E → 39B → 39C → 39D → 39F

---

## Testing Strategy

### Unit Tests (Required for every task)
- Service methods tested with mocks
- Hooks tested with renderHook
- Components tested with RTL

### Integration Tests
- API endpoints tested with supertest patterns
- Webhook handlers tested with mock payloads

### Manual Validation
- Dashboard shows correct metrics
- Domain check works with real domain
- Spam score updates in real-time
- Emails scheduled correctly

---

## Environment Variables Required

```bash
# Existing
SENDGRID_API_KEY=...
SENDGRID_WEBHOOK_VERIFICATION_KEY=...

# New for Sprint 39 - Compliance
COMPLIANCE_POSTAL_ADDRESS="FreightRoll, 123 Main St, City, ST 12345"
SUPPORT_EMAIL="support@freightroll.com"
SPAM_SCORE_THRESHOLD=70  # Block if score exceeds

# New for Sprint 39 - Configurable Health Thresholds (HIGH fix)
# Allows tuning without code changes
VITE_BOUNCE_RATE_PAUSE=0.05       # 5% - pause sending if exceeded
VITE_SPAM_RATE_PAUSE=0.001        # 0.1% - pause sending if exceeded
VITE_DELIVERABILITY_WARN=0.90     # 90% - warn if below
VITE_HEALTH_SCORE_CRITICAL=50     # Score below this = critical
```

---

## Rollback Plan

Each sprint is independently deployable. If issues arise:

1. **Reputation Dashboard** - Just UI, disable component
2. **Domain Auth** - Optional feature, disable endpoint
3. **Spam Score** - Remove server-side block, keep UI warning
4. **Send Time** - Disable optimization toggle, emails send immediately
5. **Suppression Sync** - Disable cron, manual sync still works
6. **Compliance** - Relax to warning instead of block

---

## What Railway Needs

For full sendability optimization, Railway should expose:

### 1. Email Analytics Endpoint (Required for 39A)
```
GET /api/email/analytics
Query: ?period=7d
Response: {
  sent: number,
  delivered: number,
  bounced: number,
  opened: number,
  clicked: number,
  spam: number,
  unsubscribed: number
}
```

### 2. SendGrid Suppression List Access (Required for 39E)
```
GET /api/suppressions
Response: { items: [{ email, reason, createdAt }] }

POST /api/suppressions
Body: { email, reason }
```

### 3. Domain Verification Status (Optional for 39B)
```
GET /api/domain/status?domain=freightroll.com
Response: { verified: boolean, spf: boolean, dkim: boolean, dmarc: boolean }
```

---

## Key Files Reference

| Purpose | Location |
|---------|----------|
| Email compliance | `src/services/EmailComplianceService.ts` |
| Warmup limits | `src/services/EmailWarmupService.ts` |
| Queue service | `src/services/EmailQueueService.ts` |
| Send endpoint | `api/email/send.ts` |
| Webhook handler | `api/webhooks/sendgrid.ts` |
| Feature flags | `src/config/featureFlags.ts` |

---

## Next Steps After V39

1. **V40: Sequence Performance** - Track which sequences perform best
2. **V41: A/B Testing** - Test subject lines, send times
3. **V42: AI Content Optimization** - Train AI on what works

---

## Already Implemented (S38F - Pre-requisites Complete)

The following were implemented in Sprint 38F and serve as foundation for V39:

| Component | File | Status |
|-----------|------|--------|
| WarmupLimitBadge | `src/components/WarmupLimitBadge.tsx` | ✅ Done |
| useWarmupStatus | `src/hooks/useWarmupStatus.ts` | ✅ Done |
| BYPASS_EMAIL_WARMUP flag | `src/config/featureFlags.ts` | ✅ Done |
| Warmup badge in BulkEmailModal | `src/components/BulkEmailModal.tsx` | ✅ Done |

These can be leveraged directly in V39 sprint work.

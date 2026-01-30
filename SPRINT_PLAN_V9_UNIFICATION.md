# YardFlow Platform Unification - Sprint Plan V9

## Executive Summary

**Problem:** Two separate apps create fragmented UX, split data, and duplicate effort.

**Solution:** Unify into a single logical application with:
- **Railway** as the backend (PostgreSQL, Redis, SendGrid, Auth)
- **Vercel** as the frontend (React SPA consuming Railway APIs)

**Critical Path:** Email sending must work end-to-end first.

**Auth Strategy Decision:** 
- [x] Use **API key** for Vercel→Railway (simpler, stateless, no cross-domain cookie issues)
- [ ] ~~Use session cookies~~ (too complex for cross-domain)

---

## ⚡ IMMEDIATE ACTION: Sprint 79.5 - Email Quick Win (TODAY)

**Goal:** Users can send emails TODAY via Railway while we build proper integration.
**Time:** 1 hour

### T79.5.1: Add Railway Redirect Button [XS - 30min]
**Files:** `src/App.tsx`
**Purpose:** Open Railway in new tab for immediate email sending

```typescript
// Add to prospect detail panel actions
const handleSendViaRailway = () => {
  const railwayUrl = 'https://yardflow-hitlist-production-2f41.up.railway.app';
  window.open(`${railwayUrl}/people?search=${encodeURIComponent(selectedProspect?.email || '')}`, '_blank');
  showInfo('Railway Opened', 'Send email from the Railway dashboard, then return here.');
};

// Add button next to existing Send Email button:
<button onClick={handleSendViaRailway} className="text-blue-600 underline text-sm">
  Send via Railway →
</button>
```

**Validation:** Click button → Railway opens → can send email there
**Commit:** `feat: add temporary Railway redirect for immediate email sending`

### T79.5.2: Document Railway Login [XS - 15min]
**Files:** Add to `README.md` or show in UI
**Content:**
```
To send emails immediately:
1. Click "Send via Railway →"
2. Login: casey@freightroll.com / FreightRoll2026!
3. Find prospect and send email
4. Return to YardFlow Hub
```

**Commit:** `docs: add Railway login instructions for email`

### T79.5.3: Add Railway Link to Navigation [XS - 15min]
**Files:** `src/App.tsx` header section
**Purpose:** Persistent link to Railway for power users

```typescript
<a 
  href="https://yardflow-hitlist-production-2f41.up.railway.app" 
  target="_blank" 
  className="text-xs text-slate-500 hover:text-blue-600"
>
  Open Railway Dashboard ↗
</a>
```

**Validation:** Link visible in header, opens Railway
**Commit:** `feat: add Railway dashboard link to header`

---

---

## Architecture Decision

### Why Not Two Apps?

| Issue | Impact |
|-------|--------|
| Users switch between apps | Confusing, breaks flow |
| Data in Firebase AND PostgreSQL | No single source of truth |
| Auth in Firebase AND NextAuth | Session management nightmare |
| Features split across codebases | Daily Brief orphaned in Railway |
| Duplicate development effort | Two UIs to maintain |

### Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER BROWSER                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 VERCEL (gtm-yard-flow.vercel.app)               │
│                                                                  │
│  React SPA                     API Routes (Proxy)               │
│  ├── CompanyListView           ├── /api/railway/* → Railway    │
│  ├── CompanyDetailPanel        ├── /api/auth/* → Railway Auth  │
│  ├── ROI Calculator            └── /api/gemini/* → Gemini API  │
│  ├── AI Research UI                                             │
│  └── Email Composer                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTPS API Calls
┌─────────────────────────────────────────────────────────────────┐
│            RAILWAY (yardflow-hitlist-*.railway.app)             │
│                                                                  │
│  Next.js API Routes           Infrastructure                    │
│  ├── /api/auth/* (NextAuth)   ├── PostgreSQL (all data)        │
│  ├── /api/people/*            ├── Redis (queues, cache)        │
│  ├── /api/accounts/*          ├── BullMQ (job processing)      │
│  ├── /api/outreach/*          └── SendGrid (email delivery)    │
│  ├── /api/sequences/*                                           │
│  ├── /api/briefing/*                                            │
│  └── /api/analytics/*                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Key Decisions

1. **Railway is the source of truth** for all data (PostgreSQL)
2. **Railway handles all auth** (NextAuth with credentials + Google)
3. **Railway sends all emails** (SendGrid + tracking)
4. **Vercel is the UI layer** (React SPA + API proxy)
5. **Firebase is deprecated** (migrate data, then remove)

---

## Phase 1: Email Infrastructure (Sprints 80-82)
**Goal:** Emails send reliably end-to-end via Railway.

---

### Sprint 80: Railway Email Verification
**Demo:** Send email from Railway dashboard, verify delivery + tracking.

#### T80.1: Verify Railway Email Endpoint Works [S - 30min]
**Validation Steps:**
1. Login to Railway app: `https://yardflow-hitlist-production-2f41.up.railway.app`
2. Use credentials: `casey@freightroll.com` / `FreightRoll2026!`
3. Navigate to a contact with email
4. Send test email
5. Check inbox for delivery
6. Click link in email, verify tracking recorded

**Success Criteria:**
- [ ] Email received in inbox
- [ ] Open tracking pixel fires (check Railway logs)
- [ ] Click tracking works (check Railway DB)
- [ ] Unsubscribe link works

**If fails:** Document which step failed, proceed to T80.2

---

#### T80.2: Verify SendGrid Configuration [S - 30min]
**Validation Steps:**
1. Railway Dashboard → Variables tab
2. Verify these are set:
   - `SENDGRID_API_KEY` = `SG.xxx...`
   - `SENDGRID_FROM_EMAIL` = verified sender email
3. SendGrid Dashboard → Sender Authentication
4. Verify domain is authenticated (DNS records)

**Test Command:**
```bash
# Test SendGrid API directly
curl -X POST https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "personalizations": [{"to": [{"email": "your-test@email.com"}]}],
    "from": {"email": "outreach@yardflow.com"},
    "subject": "Test from SendGrid",
    "content": [{"type": "text/plain", "value": "It works!"}]
  }'
```

**Success Criteria:**
- [ ] SENDGRID_API_KEY is set
- [ ] SENDGRID_FROM_EMAIL is verified in SendGrid
- [ ] Test email sends successfully

---

#### T80.3: Verify Railway Queue Processing & CORS [S - 45min]
**Validation Steps:**
1. Check health endpoint:
```bash
curl https://yardflow-hitlist-production-2f41.up.railway.app/api/health
```
2. Verify response shows:
   - `database: "ok"`
   - `redis: "ok"`
   - `queues.emails: "ready"`

3. **CRITICAL: Test CORS from Vercel origin:**
```bash
curl -H "Origin: https://gtm-yard-flow.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS \
  https://yardflow-hitlist-production-2f41.up.railway.app/api/health -v

# Must see in response:
# Access-Control-Allow-Origin: https://gtm-yard-flow.vercel.app
# (or Access-Control-Allow-Origin: *)
```

**If CORS not configured:**
- Railway codebase needs middleware update
- This BLOCKS all Vercel→Railway integration
- Document in Railway repo issue tracker

**If queue not processing:**
1. Railway Dashboard → Logs
2. Look for BullMQ worker errors
3. Check Redis connection string

**Success Criteria:**
- [ ] Health check passes
- [ ] All queues show "ready"
- [ ] CORS allows Vercel origin
- [ ] No errors in Railway logs

---

#### T80.4: Document Railway Email Flow [M - 1h]
**Files:** `docs/EMAIL_FLOW.md` (new in GTM-YardFlow repo)
**Content:**
```markdown
# Email Flow Documentation

## Architecture
User Action → Railway API → BullMQ Queue → Worker → SendGrid → Inbox

## Endpoints
- POST /api/outreach/send-email - Queue single email
- POST /api/outreach/batch - Queue batch emails
- GET /api/outreach/status/:id - Check email status

## Tracking
- Open: 1x1 pixel at /api/track/open?id=xxx
- Click: Redirect via /api/track/click?id=xxx&url=yyy
- Unsubscribe: /api/email/unsubscribe?token=xxx

## Error Handling
- Failed emails → dead-letter queue
- Retry logic: 3 attempts with exponential backoff
```

**Success Criteria:**
- [ ] Document committed to repo
- [ ] Reviewed by second team member
- [ ] Matches actual Railway implementation

---

#### T80.5: Create Integration Smoke Test Script [S - 1h]
**Files:** `scripts/verify-railway-integration.ts`
**Purpose:** Automated verification that Railway integration works

```typescript
#!/usr/bin/env npx ts-node

/**
 * Railway Integration Smoke Test
 * Run: npm run verify:railway
 */

const RAILWAY_URL = 'https://yardflow-hitlist-production-2f41.up.railway.app';
const VERCEL_ORIGIN = 'https://gtm-yard-flow.vercel.app';

async function main() {
  console.log('🚂 Railway Integration Smoke Test\n');

  // Test 1: Health check
  const health = await fetch(`${RAILWAY_URL}/api/health`);
  const healthData = await health.json();
  console.log(health.ok ? '✓ Health check: OK' : '✗ Health check: FAILED');

  // Test 2: CORS
  const cors = await fetch(`${RAILWAY_URL}/api/health`, {
    headers: { 'Origin': VERCEL_ORIGIN }
  });
  const corsHeader = cors.headers.get('access-control-allow-origin');
  console.log(corsHeader ? '✓ CORS configured: OK' : '✗ CORS: NOT CONFIGURED');

  // Test 3: Database
  console.log(healthData.database === 'ok' ? '✓ Database: OK' : '✗ Database: FAILED');

  // Test 4: Redis  
  console.log(healthData.redis === 'ok' ? '✓ Redis: OK' : '✗ Redis: FAILED');

  // Test 5: Email queue
  console.log(healthData.queues?.emails === 'ready' ? '✓ Email queue: READY' : '✗ Email queue: NOT READY');

  console.log('\n--- Summary ---');
  console.log('If all checks pass, proceed to Sprint 81.');
  console.log('If CORS fails, Railway codebase needs middleware update FIRST.');
}

main().catch(console.error);
```

**Package.json addition:**
```json
{
  "scripts": {
    "verify:railway": "ts-node scripts/verify-railway-integration.ts"
  }
}
```

**Success Criteria:**
- [ ] Script runs without errors
- [ ] All checks pass
- [ ] Output clearly indicates pass/fail

**Commit:** `chore: add Railway integration smoke test`

---

### Sprint 81: Vercel-to-Railway Email Proxy
**Demo:** Send email from Vercel UI, delivered via Railway.

#### T81.1: Create Railway API Client [M - 2h]
**Files:** `src/services/RailwayApiClient.ts`
**Purpose:** Base client for all Railway API calls with API key auth

```typescript
// RailwayApiClient.ts
/**
 * Railway API Client
 * 
 * Uses API key auth (not session cookies) for simplicity.
 * API key is shared secret between Vercel and Railway.
 */

export class RailwayApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_RAILWAY_URL || 
      'https://yardflow-hitlist-production-2f41.up.railway.app';
    this.apiKey = import.meta.env.VITE_RAILWAY_API_KEY || '';
    
    if (!this.apiKey && import.meta.env.MODE === 'production') {
      console.error('VITE_RAILWAY_API_KEY is required for Railway integration');
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Railway-API-Key': this.apiKey,
      'X-Request-Source': 'vercel-frontend',
    };
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error(`Railway API error: ${response.status}`);
    return response.json();
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Railway API error: ${response.status}`);
    return response.json();
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Railway API error: ${response.status}`);
    return response.json();
  }

  async delete(path: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) throw new Error(`Railway API error: ${response.status}`);
  }
}

export const railwayApi = new RailwayApiClient();
```

**Tests:** `src/__tests__/services/RailwayApiClient.test.ts`
- [ ] `get()` makes GET request with API key header
- [ ] `post()` makes POST request with body
- [ ] Error responses throw with status code
- [ ] Missing API key logs warning in production

  async getSession(): Promise<RailwaySession | null> {
    // GET from Railway /api/auth/session with cookie
  }

  async logout(): Promise<void> {
    // POST to Railway /api/auth/signout
  }

  getAuthHeaders(): Record<string, string> {
    // Return headers for authenticated API calls
  }
}
```

**Tests:** `src/__tests__/services/RailwayAuthService.test.ts`
- [ ] `login()` returns session on valid credentials
- [ ] `login()` throws on invalid credentials
- [ ] `getSession()` returns null when not authenticated
- [ ] `getSession()` returns session when authenticated
- [ ] `logout()` clears session
- [ ] `getAuthHeaders()` includes session cookie

**Validation:** Mock tests pass, integration test against Railway works

---

#### T81.2: Create Railway Email Service [M - 2h]
**Files:** `src/services/RailwayEmailService.ts`
**Purpose:** Send emails via Railway API

```typescript
// RailwayEmailService.ts
export interface SendEmailRequest {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  prospectId?: string;
  metadata?: Record<string, unknown>;
}

export interface SendEmailResponse {
  success: boolean;
  emailId?: string;
  error?: string;
  queuePosition?: number;
}

export class RailwayEmailService {
  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    // POST to /api/railway/outreach/send-email
  }

  async sendBatch(requests: SendEmailRequest[]): Promise<SendEmailResponse[]> {
    // POST to /api/railway/outreach/batch
  }

  async getEmailStatus(emailId: string): Promise<EmailStatus> {
    // GET from /api/railway/outreach/status/:id
  }

  async getEmailAnalytics(prospectId: string): Promise<EmailAnalytics> {
    // GET from /api/railway/outreach/analytics/:prospectId
  }
}
```

**Tests:** `src/__tests__/services/RailwayEmailService.test.ts`
- [ ] `sendEmail()` returns success with emailId
- [ ] `sendEmail()` handles rate limit (429) gracefully
- [ ] `sendBatch()` queues multiple emails
- [ ] `getEmailStatus()` returns correct status
- [ ] Error responses include helpful messages

**Validation:** Mock tests pass, service exported from index

---

#### T81.3: Update API Proxy for Email Routes [M - 1h]
**Files:** `api/railway/[...path].ts`
**Changes:** Add email-specific routes to allowlist

```typescript
const ALLOWED_PATHS = [
  '/api/health',
  // Email routes
  '/api/outreach/send-email',
  '/api/outreach/batch',
  '/api/outreach/status',
  '/api/outreach/analytics',
  // Sequence routes
  '/api/sequences',
  '/api/sequences/enroll',
  // Auth routes
  '/api/auth/session',
  '/api/auth/callback',
  '/api/auth/signout',
  // Enrichment routes
  '/api/enrichment/email',
  '/api/enrichment/smart-guess',
];
```

**Tests:** Update `api/__tests__/railway-proxy.test.ts`
- [ ] Email routes are proxied correctly
- [ ] Auth headers are forwarded
- [ ] Invalid paths still return 403

**Validation:** `curl` test from Vercel to Railway works

---

#### T81.4: Wire Email Send Button to Railway [M - 2h]
**Files:** `src/App.tsx` (update `sendEmailToProspect`)
**Changes:** Replace Firebase email with Railway email

**Current Code (Firebase-based):**
```typescript
const sendEmailToProspect = async () => {
  // ... calls /api/email/send (Vercel endpoint)
};
```

**New Code (Railway-based):**
```typescript
import { RailwayEmailService } from './services/RailwayEmailService';

const railwayEmail = new RailwayEmailService();

const sendEmailToProspect = async () => {
  if (!selectedProspect?.email) {
    setEmailSendStatus('no_email');
    return;
  }

  setIsSendingEmail(true);
  
  try {
    const result = await railwayEmail.sendEmail({
      to: selectedProspect.email,
      toName: selectedProspect.name,
      subject: `YardFlow for ${selectedProspect.company}`,
      html: formatEmailHtml(generatedMessage),
      text: generatedMessage,
      prospectId: selectedProspect.id,
      metadata: {
        company: selectedProspect.company,
        tier: selectedProspect.tier,
      },
    });

    if (result.success) {
      setEmailSendStatus('success');
      handleStatusUpdate('contacted');
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    setEmailSendStatus('error');
    setEmailErrorMessage((error as Error).message);
  } finally {
    setIsSendingEmail(false);
  }
};
```

**Tests:** Update integration tests
- [ ] Send button calls Railway service
- [ ] Success updates prospect status
- [ ] Error shows toast with message
- [ ] Loading state during send

**Validation:** Click Send Email → email arrives in inbox

---

#### T81.5: Add Email Status Indicator [S - 1h]
**Files:** `src/components/EmailStatusBadge.tsx` (new)
**Purpose:** Show email delivery status on prospect cards

```typescript
interface EmailStatusBadgeProps {
  prospectId: string;
  lastEmailStatus?: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced';
  lastEmailAt?: Date;
}

export function EmailStatusBadge({ prospectId, lastEmailStatus, lastEmailAt }: EmailStatusBadgeProps) {
  // Show colored badge: gray=pending, blue=sent, green=delivered, etc.
}
```

**Tests:** `src/__tests__/components/EmailStatusBadge.test.tsx`
- [ ] Renders correct color for each status
- [ ] Shows relative time ("2h ago")
- [ ] Handles undefined gracefully

**Validation:** Badge appears on prospect detail panel

---

### Sprint 82: Email Queue & Tracking
**Demo:** Send 10 emails, see queue drain, view open/click analytics.

#### T82.1: Create Email Queue Dashboard Component [L - 3h]
**Files:** `src/components/EmailQueueDashboard.tsx`
**Purpose:** Show pending, sent, failed emails with real-time updates

**Features:**
- Queue depth chart (pending emails over time)
- Recent sends table (last 50)
- Failure rate metric
- Retry failed button

**Tests:**
- [ ] Renders queue metrics correctly
- [ ] Table pagination works
- [ ] Retry button calls correct API
- [ ] Empty state shows "No pending emails"

**Validation:** Dashboard visible at `/api/admin/email-queue` or in Integrations tab

---

#### T82.2: Create Email Analytics Component [M - 2h]
**Files:** `src/components/EmailAnalytics.tsx`
**Purpose:** Show open/click rates, best performing templates

**Features:**
- Overall stats: sent, delivered, opened, clicked, bounced
- Open rate by hour/day heatmap
- Top templates by click rate
- Per-prospect email history

**Tests:**
- [ ] Stats calculate correctly from mock data
- [ ] Heatmap renders without errors
- [ ] Template ranking works

**Validation:** Analytics visible in Dashboard tab

---

#### T82.3: Implement Batch Email Sending [M - 2h]
**Files:** Update `src/App.tsx`, `src/components/BulkActionsToolbar.tsx`
**Purpose:** Send emails to multiple selected prospects

**Changes to BulkActionsToolbar:**
```typescript
// Add "Send Email" bulk action
const handleBulkSendEmail = async () => {
  const selectedWithEmail = selectedProspects.filter(p => p.email);
  
  if (selectedWithEmail.length === 0) {
    showWarning('No Emails', 'None of the selected prospects have email addresses.');
    return;
  }

  const confirmMessage = `Send ${selectedWithEmail.length} emails?`;
  if (!confirm(confirmMessage)) return;

  setIsProcessing(true);
  
  const results = await railwayEmail.sendBatch(
    selectedWithEmail.map(p => ({
      to: p.email!,
      toName: p.name,
      subject: `YardFlow for ${p.company}`,
      html: generateEmailHtml(p),
      text: generateEmailText(p),
      prospectId: p.id,
    }))
  );

  const succeeded = results.filter(r => r.success).length;
  showSuccess('Emails Queued', `${succeeded}/${selectedWithEmail.length} emails queued for sending.`);
  
  setIsProcessing(false);
  clearSelection();
};
```

**Tests:**
- [ ] Bulk send queues correct number of emails
- [ ] Prospects without email are skipped
- [ ] Success toast shows accurate count
- [ ] Rate limiting handled gracefully

**Validation:** Select 10 prospects → Bulk Send → All receive emails

---

#### T82.4: Add Email Tracking Webhook Handler [M - 2h]
**Files:** `api/email/webhook.ts` (update)
**Purpose:** Receive SendGrid events and update Railway

**Current webhook saves to Firebase. Update to forward to Railway:**

```typescript
// After processing webhook
await forwardToRailway(event);

async function forwardToRailway(event: SendGridEvent) {
  await fetch(`${RAILWAY_API_URL}/api/email/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Railway-Secret': RAILWAY_API_SECRET,
    },
    body: JSON.stringify(event),
  });
}
```

**Tests:**
- [ ] Open events forwarded to Railway
- [ ] Click events forwarded to Railway
- [ ] Bounce events forwarded to Railway
- [ ] Invalid signatures rejected

**Validation:** Send email → open it → Railway shows "opened" status

---

#### T82.5: Email Warmup Integration [S - 1h]
**Files:** `src/services/RailwayEmailService.ts` (update)
**Purpose:** Respect Railway's email warmup limits

**Add warmup check before sending:**
```typescript
async checkWarmupLimit(): Promise<{ remaining: number; limit: number; resetsAt: Date }> {
  const response = await this.fetch('/api/outreach/warmup-status');
  return response.json();
}

async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
  const warmup = await this.checkWarmupLimit();
  
  if (warmup.remaining <= 0) {
    return {
      success: false,
      error: `Daily limit reached (${warmup.limit}). Resets at ${warmup.resetsAt.toLocaleTimeString()}`,
    };
  }
  
  // ... proceed with send
}
```

**Tests:**
- [ ] Warmup status correctly fetched
- [ ] Sends blocked when limit reached
- [ ] Error message includes reset time

**Validation:** After hitting limit, clear error message shown

---

#### T82.6: Email Delivery Monitoring [S - 1h]
**Files:** Configure in SendGrid + Railway
**Purpose:** Know when emails fail to deliver

**Setup Steps:**
1. SendGrid Dashboard → Settings → Mail Settings → Event Webhook
   - Add Railway webhook URL for bounce/complaint events
2. SendGrid Dashboard → Settings → Alerts
   - Create alert: Bounce rate > 5%
   - Create alert: Complaint rate > 0.1%
3. Optional: Add Slack webhook for critical failures

**Validation Checklist:**
- [ ] Bounce events appear in Railway logs
- [ ] High bounce rate triggers alert
- [ ] Team notified of delivery issues

**Success Criteria:**
- [ ] Webhook configured and receiving events
- [ ] Alert thresholds set appropriately
- [ ] Can view delivery failures in Railway dashboard

---

## 🚦 PHASE 1 CHECKPOINT: Email Validation

**Before proceeding to Phase 2, validate email infrastructure works in production:**

### Success Criteria
- [ ] **50+ emails sent** via Vercel UI → Railway → SendGrid
- [ ] **Open tracking working** (open rate > 0%)
- [ ] **Click tracking working** (click rate > 0% for emails with links)
- [ ] **No delivery failures** (bounce rate < 5%)
- [ ] **User feedback collected** (Jake confirms it works)

### Rollback Plan
If email has issues:
1. Revert to Sprint 79.5 redirect button (immediate)
2. Use Railway dashboard directly for sending
3. Debug Railway email pipeline
4. Retry Phase 1 after fixes

### Go/No-Go Decision
- **GO:** All criteria met → Proceed to Phase 2
- **NO-GO:** Any critical failure → Fix before continuing

---

## Phase 2: Authentication Unification (Sprints 83-84)
**Goal:** Single auth system via Railway NextAuth.

> **Note:** Phase 2 can START in parallel with Sprint 82. Auth is independent of email.

---

### Sprint 83: Railway Auth Integration
**Demo:** Login from Vercel UI, session managed by Railway.

#### T83.1: Create Login Page for Railway Auth [M - 3h]
**Files:** `src/components/RailwayLogin.tsx`
**Purpose:** Login form that authenticates via Railway NextAuth

```typescript
export function RailwayLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const session = await railwayAuth.login(email, password);
      if (session) {
        onSuccess();
      }
    } catch (err) {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Login to YardFlow</h2>
      {/* Email, Password inputs */}
      {/* Error display */}
      {/* Submit button */}
      {/* Google OAuth button */}
    </form>
  );
}
```

**Tests:**
- [ ] Form validation works (required fields)
- [ ] Loading state shown during submit
- [ ] Error message displayed on failure
- [ ] Success calls onSuccess callback
- [ ] Google OAuth button triggers OAuth flow

**Validation:** Login with Railway credentials works

---

#### T83.2: Create Auth Context for Railway [M - 2h]
**Files:** `src/contexts/RailwayAuthContext.tsx`
**Purpose:** Provide session state throughout app

```typescript
interface RailwayAuthContextType {
  session: RailwaySession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const RailwayAuthContext = createContext<RailwayAuthContextType | null>(null);

export function RailwayAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<RailwaySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    railwayAuth.getSession().then(setSession).finally(() => setIsLoading(false));
  }, []);

  // ... login, logout, refresh implementations

  return (
    <RailwayAuthContext.Provider value={{ session, isLoading, isAuthenticated: !!session, login, logout, refreshSession }}>
      {children}
    </RailwayAuthContext.Provider>
  );
}
```

**Tests:**
- [ ] Session persists across page reloads
- [ ] Loading state true initially, false after check
- [ ] Logout clears session
- [ ] Refresh updates session

**Validation:** Refresh page → still logged in

---

#### T83.3: Add Protected Route Wrapper [S - 1h]
**Files:** `src/components/ProtectedRoute.tsx`
**Purpose:** Redirect to login if not authenticated

```typescript
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useRailwayAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <RailwayLogin onSuccess={() => window.location.reload()} />;
  }

  return <>{children}</>;
}
```

**Tests:**
- [ ] Shows loading while checking auth
- [ ] Shows login if not authenticated
- [ ] Shows children if authenticated

**Validation:** Unauthenticated user sees login form

---

#### T83.4: Update App.tsx to Use Railway Auth [M - 2h]
**Files:** `src/App.tsx`, `src/main.tsx`
**Purpose:** Replace Firebase auth with Railway auth

**Changes to main.tsx:**
```typescript
import { RailwayAuthProvider } from './contexts/RailwayAuthContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RailwayAuthProvider>
      <ProtectedRoute>
        <App />
      </ProtectedRoute>
    </RailwayAuthProvider>
  </React.StrictMode>
);
```

**Changes to App.tsx:**
- Remove Firebase auth state
- Use `useRailwayAuth()` hook instead
- Update user display to use Railway session

**Tests:**
- [ ] App renders with Railway auth
- [ ] User name displays correctly
- [ ] Logout works from header
- [ ] Protected actions require auth

**Validation:** Full app flow with Railway auth

---

#### T83.5: Google OAuth via Railway [M - 2h]
**Files:** `src/services/RailwayAuthService.ts` (update)
**Purpose:** Support Google sign-in via Railway NextAuth

```typescript
async loginWithGoogle(): Promise<void> {
  // Open Railway OAuth URL in popup/redirect
  const oauthUrl = `${this.baseUrl}/api/auth/signin/google?callbackUrl=${window.location.origin}/auth/callback`;
  window.location.href = oauthUrl;
}
```

**Files:** `src/components/AuthCallback.tsx`
**Purpose:** Handle OAuth callback from Railway

**Tests:**
- [ ] Google button opens OAuth flow
- [ ] Callback page captures session
- [ ] Session cookie set correctly

**Validation:** Login with Google works end-to-end

---

### Sprint 84: Deprecate Firebase Auth
**Demo:** App works entirely without Firebase auth.

#### T84.1: Remove Firebase Auth Imports [M - 2h]
**Files:** Multiple files
**Purpose:** Clean up Firebase auth dependencies

**Steps:**
1. Search for `firebase/auth` imports
2. Remove or replace with Railway auth
3. Update tests to use Railway auth mocks
4. Remove Firebase auth config from environment

**Test Command:**
```bash
# Find all Firebase auth usages
grep -r "firebase/auth\|getAuth\|signIn\|signOut" src/ --include="*.ts" --include="*.tsx"
```

**Success Criteria:**
- [ ] No Firebase auth imports remain
- [ ] All tests still pass
- [ ] App functions without Firebase auth

---

#### T84.2: Update Firestore Writes to Include Railway User [S - 1h]
**Files:** All Firestore write locations
**Purpose:** Use Railway user ID instead of Firebase UID

**Temporary Bridge (during migration):**
```typescript
// Get user ID from Railway session
const userId = railwaySession?.user?.id || 'anonymous';

// Firestore write
await setDoc(docRef, {
  ...data,
  userId,
  lastEditedBy: railwaySession?.user?.email,
});
```

**Success Criteria:**
- [ ] Firestore writes include Railway user ID
- [ ] No Firebase UID references

---

#### T84.3: Create Auth Migration Script [M - 2h]
**Files:** `scripts/migrate-auth.ts`
**Purpose:** Map Firebase UIDs to Railway user IDs in existing data

```typescript
// 1. Fetch all Firestore prospects with Firebase UIDs
// 2. For each, look up corresponding Railway user by email
// 3. Update Firestore document with Railway user ID
// 4. Log migration results
```

**Success Criteria:**
- [ ] Script runs without errors
- [ ] All documents updated with Railway IDs
- [ ] Migration report generated

---

#### T84.4: Feature Flag for Auth System [S - 1h]
**Files:** `src/config/featureFlags.ts`
**Purpose:** Toggle between auth systems during rollout

```typescript
export const FEATURE_FLAGS = {
  USE_RAILWAY_AUTH: import.meta.env.VITE_USE_RAILWAY_AUTH === 'true',
};
```

**Tests:**
- [ ] Flag defaults to false
- [ ] Flag can be overridden via env
- [ ] App switches auth based on flag

**Validation:** Both auth systems work based on flag

---

## Phase 3: Data Unification (Sprints 85-87)
**Goal:** PostgreSQL as single source of truth.

---

### Sprint 85: Railway Data Services
**Demo:** Prospect data CRUD via Railway API.

#### T85.1: Create Railway Prospect Service [L - 4h]
**Files:** `src/services/RailwayProspectService.ts`
**Purpose:** CRUD operations for prospects via Railway

```typescript
export interface ProspectDTO {
  id: string;
  name: string;
  email?: string;
  company: string;
  title?: string;
  tier: 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4';
  status: 'new' | 'drafted' | 'contacted' | 'meeting_booked';
  score: number;
  facilities?: number;
  // ... other fields
}

export class RailwayProspectService {
  async list(filters?: ProspectFilters): Promise<ProspectDTO[]> {
    // GET /api/people
  }

  async get(id: string): Promise<ProspectDTO> {
    // GET /api/people/:id
  }

  async create(prospect: Omit<ProspectDTO, 'id'>): Promise<ProspectDTO> {
    // POST /api/people
  }

  async update(id: string, updates: Partial<ProspectDTO>): Promise<ProspectDTO> {
    // PATCH /api/people/:id
  }

  async delete(id: string): Promise<void> {
    // DELETE /api/people/:id
  }

  async search(query: string): Promise<ProspectDTO[]> {
    // GET /api/people/search?q=xxx
  }

  async bulkUpdate(ids: string[], updates: Partial<ProspectDTO>): Promise<number> {
    // PATCH /api/people/bulk
  }
}
```

**Tests:** Full unit test suite
- [ ] `list()` returns array of prospects
- [ ] `list()` respects filters
- [ ] `get()` returns single prospect
- [ ] `create()` returns created prospect with ID
- [ ] `update()` returns updated prospect
- [ ] `delete()` removes prospect
- [ ] `search()` returns matching results
- [ ] `bulkUpdate()` returns count of updated

**Validation:** Service works with real Railway API

---

#### T85.2: Create Railway Company Service [M - 2h]
**Files:** `src/services/RailwayCompanyService.ts`
**Purpose:** Company/account operations via Railway

```typescript
export class RailwayCompanyService {
  async list(filters?: CompanyFilters): Promise<CompanyDTO[]>;
  async get(id: string): Promise<CompanyDTO>;
  async getWithContacts(id: string): Promise<CompanyWithContacts>;
  async update(id: string, updates: Partial<CompanyDTO>): Promise<CompanyDTO>;
  async enrich(id: string): Promise<EnrichmentResult>;
}
```

**Tests:**
- [ ] All CRUD operations work
- [ ] `getWithContacts()` includes related prospects
- [ ] `enrich()` triggers AI enrichment

---

#### T85.3: Create Data Sync Service [L - 4h]
**Files:** `src/services/DataSyncService.ts`
**Purpose:** Sync data between Firestore and Railway

```typescript
export class DataSyncService {
  // Direction: Firestore → Railway
  async syncProspectsToRailway(batchSize = 100): Promise<SyncResult>;
  
  // Direction: Railway → Firestore (for backwards compat)
  async syncProspectsFromRailway(batchSize = 100): Promise<SyncResult>;
  
  // Conflict resolution
  resolveConflict(firestore: ProspectDTO, railway: ProspectDTO): ProspectDTO;
  
  // Full sync status
  getSyncStatus(): Promise<SyncStatus>;
}
```

**Tests:**
- [ ] Sync creates missing records
- [ ] Sync updates changed records
- [ ] Conflicts resolved by timestamp
- [ ] Status shows progress

---

#### T85.4: Add Railway Data Toggle [S - 1h]
**Files:** `src/config/featureFlags.ts`
**Purpose:** Switch data source between Firestore and Railway

```typescript
export const FEATURE_FLAGS = {
  USE_RAILWAY_AUTH: import.meta.env.VITE_USE_RAILWAY_AUTH === 'true',
  USE_RAILWAY_DATA: import.meta.env.VITE_USE_RAILWAY_DATA === 'true',
};
```

**Validation:** App works with either data source

---

### Sprint 86: UI Updates for Railway Data
**Demo:** All UI uses Railway data services.

#### T86.1: Update App.tsx to Use Railway Prospects [L - 4h]
**Files:** `src/App.tsx`
**Purpose:** Replace Firestore queries with Railway service

**Major changes:**
1. Replace `HITLIST_PROSPECTS` with `railwayProspects.list()`
2. Replace Firestore writes with `railwayProspects.update()`
3. Update real-time sync to poll Railway

**Tests:**
- [ ] Prospects load from Railway
- [ ] Updates persist to Railway
- [ ] Filtering works correctly
- [ ] Sorting works correctly

---

#### T86.2: Update CompanyListView for Railway [M - 2h]
**Files:** `src/components/CompanyListView.tsx`
**Purpose:** Use Railway company data

**Changes:**
1. Fetch companies from `railwayCompanies.list()`
2. Get company details from `railwayCompanies.getWithContacts()`
3. Trigger enrichment via `railwayCompanies.enrich()`

**Tests:**
- [ ] Companies load from Railway
- [ ] Expand shows contacts from Railway
- [ ] Enrichment button triggers API call

---

#### T86.3: Update Search to Use Railway [M - 2h]
**Files:** `src/hooks/useSearch.ts` (update or create)
**Purpose:** Full-text search via Railway

```typescript
export function useSearch(query: string) {
  const [results, setResults] = useState<SearchResults>({ prospects: [], companies: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) return;
    
    setLoading(true);
    Promise.all([
      railwayProspects.search(query),
      railwayCompanies.search(query),
    ]).then(([prospects, companies]) => {
      setResults({ prospects, companies });
    }).finally(() => setLoading(false));
  }, [query]);

  return { results, loading };
}
```

**Tests:**
- [ ] Search debounced (300ms)
- [ ] Results combined from both services
- [ ] Loading state correct

---

#### T86.4: Update Import to Write to Railway [M - 2h]
**Files:** `src/components/ImportWizard.tsx`
**Purpose:** Import CSV data to Railway PostgreSQL

**Changes:**
1. Parse CSV as before
2. Validate and dedupe as before
3. Write to Railway via `railwayProspects.bulkCreate()`
4. Show import progress

**Tests:**
- [ ] Import writes to Railway
- [ ] Duplicates detected and handled
- [ ] Progress shows accurate count

---

### Sprint 87: Firestore Deprecation
**Demo:** App works entirely without Firestore.

#### T87.1: Create Data Migration Script [L - 4h]
**Files:** `scripts/migrate-to-railway.ts`
**Purpose:** One-time migration of all Firestore data to Railway

```typescript
// 1. Export all Firestore collections
// 2. Transform to Railway schema
// 3. Batch import to Railway
// 4. Verify data integrity
// 5. Generate migration report
```

**Validation:**
- [ ] All prospects migrated
- [ ] All companies migrated
- [ ] Data integrity verified (counts match)
- [ ] Migration report saved

---

#### T87.2: Remove Firestore Dependencies [M - 2h]
**Files:** Multiple
**Purpose:** Clean up Firestore code

**Steps:**
1. Remove Firestore SDK imports
2. Remove Firestore config
3. Update environment variables
4. Remove Firestore rules and indexes

**Test Command:**
```bash
# Find all Firestore usages
grep -r "firestore\|getFirestore\|collection\|doc\|setDoc" src/ --include="*.ts" --include="*.tsx"
```

**Success Criteria:**
- [ ] No Firestore imports remain in production code
- [ ] Tests updated to mock Railway
- [ ] App runs without Firebase project

---

#### T87.3: Update Environment Documentation [S - 30min]
**Files:** `README.md`, `docs/ENVIRONMENT.md`
**Purpose:** Document new environment variables

**New Required Variables:**
```
VITE_RAILWAY_URL=https://yardflow-hitlist-production-2f41.up.railway.app
VITE_USE_RAILWAY_AUTH=true
VITE_USE_RAILWAY_DATA=true
```

**Removed Variables:**
```
# No longer needed:
VITE_FIREBASE_API_KEY
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_AUTH_DOMAIN
```

---

## Phase 4: Feature Consolidation (Sprints 88-90)
**Goal:** All features available in unified app.

---

### Sprint 88: Daily Brief Integration
**Demo:** View Daily Brief from Vercel UI.

#### T88.1: Create Daily Brief Service [M - 2h]
**Files:** `src/services/RailwayBriefService.ts`
**Purpose:** Fetch daily brief from Railway

```typescript
export interface DailyBrief {
  date: string;
  summary: string;
  priorityContacts: ProspectDTO[];
  upcomingMeetings: Meeting[];
  emailStats: EmailStats;
  recommendations: Recommendation[];
}

export class RailwayBriefService {
  async getTodaysBrief(): Promise<DailyBrief>;
  async getBriefForDate(date: string): Promise<DailyBrief>;
  async generateBrief(date: string): Promise<DailyBrief>; // Trigger AI generation
}
```

**Tests:**
- [ ] `getTodaysBrief()` returns today's data
- [ ] Handles no brief gracefully
- [ ] Caches result for performance

---

#### T88.2: Create Daily Brief Component [L - 4h]
**Files:** `src/components/DailyBrief.tsx`
**Purpose:** Display daily brief in Vercel UI

**Features:**
- Summary section (AI-generated overview)
- Priority contacts list (click to open detail)
- Upcoming meetings (from calendar)
- Email stats (sent, opened, clicked today)
- AI recommendations (who to contact next)

**Tests:**
- [ ] All sections render correctly
- [ ] Priority contacts are clickable
- [ ] Empty states handled gracefully

---

#### T88.3: Add Daily Brief to Dashboard Tab [M - 2h]
**Files:** `src/App.tsx`
**Purpose:** Show Daily Brief in Dashboard

**Changes:**
1. Add Daily Brief component to dashboard tab
2. Add "Quick Actions" section with links
3. Fix the broken links (they should now work!)

**Validation:**
- [ ] Daily Brief visible on Dashboard
- [ ] "View Full Daily Brief" link works
- [ ] Quick Actions section shows priority contacts

---

#### T88.4: Add Briefing Route to Vercel [S - 1h]
**Files:** Create route handling in App.tsx
**Purpose:** Handle `/briefing` URL

**Options:**
1. Add react-router and create `/briefing` route
2. Or: Redirect to Railway's `/briefing` page
3. Or: Use query param `?tab=briefing`

**Simplest (query param):**
```typescript
// In App.tsx
const searchParams = new URLSearchParams(window.location.search);
const initialTab = searchParams.get('tab') === 'briefing' ? 'dashboard' : 'prospects';
const [activeTab, setActiveTab] = useState(initialTab);

// Show briefing view in dashboard when accessed via ?tab=briefing
```

**Validation:** `/` URL with `?tab=briefing` shows Daily Brief

---

### Sprint 89: Sequence Automation UI
**Demo:** Create and manage sequences from Vercel UI.

#### T89.1: Create Sequence List Component [M - 2h]
**Files:** `src/components/SequenceList.tsx`
**Purpose:** List all sequences with stats

```typescript
export function SequenceList() {
  const sequences = useRailwaySequences();
  
  return (
    <div>
      <h2>Outreach Sequences</h2>
      {sequences.map(seq => (
        <SequenceCard 
          key={seq.id}
          sequence={seq}
          onEdit={() => ...}
          onViewAnalytics={() => ...}
        />
      ))}
    </div>
  );
}
```

**Tests:**
- [ ] Lists all sequences from Railway
- [ ] Shows correct stats per sequence
- [ ] Actions work (edit, analytics)

---

#### T89.2: Create Sequence Builder Component [L - 4h]
**Files:** `src/components/SequenceBuilder.tsx`
**Purpose:** Visual editor for sequence steps

**Features:**
- Add/remove steps
- Set channel per step (Email, LinkedIn, Phone)
- Set delay between steps
- Select template per step
- Preview sequence timeline

**Tests:**
- [ ] Steps can be added/removed
- [ ] Channels selectable
- [ ] Delays configurable
- [ ] Save creates sequence in Railway

---

#### T89.3: Create Enrollment Flow Component [M - 2h]
**Files:** `src/components/SequenceEnrollment.tsx`
**Purpose:** Enroll selected prospects in sequence

**Features:**
- Select sequence from dropdown
- Show selected prospects count
- Confirm enrollment
- Show enrollment status

**Tests:**
- [ ] Can select sequence
- [ ] Enrollment calls Railway API
- [ ] Success shows confirmation

---

#### T89.4: Add Sequences Tab to App [M - 2h]
**Files:** `src/App.tsx`
**Purpose:** New tab for sequence management

**Changes:**
1. Add "Sequences" to tab navigation
2. Wire up SequenceList and SequenceBuilder
3. Add "Enroll in Sequence" to bulk actions

**Validation:**
- [ ] Sequences tab visible
- [ ] Can create new sequence
- [ ] Can enroll prospects

---

### Sprint 90: Analytics Dashboard
**Demo:** Unified analytics across email, sequences, and pipeline.

#### T90.1: Create Unified Analytics Service [M - 2h]
**Files:** `src/services/RailwayAnalyticsService.ts`
**Purpose:** Aggregate analytics from Railway

```typescript
export class RailwayAnalyticsService {
  async getOverview(dateRange: DateRange): Promise<AnalyticsOverview>;
  async getEmailMetrics(dateRange: DateRange): Promise<EmailMetrics>;
  async getSequenceMetrics(dateRange: DateRange): Promise<SequenceMetrics>;
  async getPipelineMetrics(): Promise<PipelineMetrics>;
  async getHeatmap(dateRange: DateRange): Promise<ActivityHeatmap>;
}
```

---

#### T90.2: Update Dashboard with Railway Analytics [L - 4h]
**Files:** `src/components/AnalyticsDashboard.tsx` (update)
**Purpose:** Show Railway-based analytics

**Changes:**
1. Replace Firebase analytics with Railway
2. Add email performance charts
3. Add sequence funnel
4. Add pipeline stage metrics

---

#### T90.3: Create ROI Calculator with Real Data [M - 2h]
**Files:** `src/components/ROITab.tsx` (update)
**Purpose:** Calculate ROI from actual email engagement

**Changes:**
1. Use actual open/click rates from Railway
2. Calculate conversion rate from responses
3. Show projected ROI based on pipeline

---

## Phase 5: Polish & Production (Sprints 91-92)
**Goal:** Production-ready unified platform.

---

### Sprint 91: Performance & Error Handling

#### T91.1: Add Request Caching [M - 2h]
**Files:** `src/services/CacheService.ts`
**Purpose:** Cache Railway API responses

```typescript
export class CacheService {
  private cache = new Map<string, { data: unknown; expiry: number }>();

  get<T>(key: string): T | null;
  set<T>(key: string, data: T, ttlSeconds: number): void;
  invalidate(key: string): void;
  invalidatePattern(pattern: string): void;
}
```

---

#### T91.2: Add Error Boundary [M - 2h]
**Files:** `src/components/ErrorBoundary.tsx`
**Purpose:** Graceful error handling

```typescript
export class ErrorBoundary extends Component<Props, State> {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error tracking service
    // Show user-friendly error UI
  }
}
```

---

#### T91.3: Add Loading Skeletons [M - 2h]
**Files:** `src/components/Skeleton.tsx`
**Purpose:** Better loading UX

```typescript
export function ProspectListSkeleton() {
  return (
    <div className="animate-pulse">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="h-16 bg-gray-200 rounded mb-2" />
      ))}
    </div>
  );
}
```

---

#### T91.4: Add Retry Logic [M - 2h]
**Files:** `src/services/ApiClient.ts`
**Purpose:** Automatic retry for failed requests

```typescript
async function fetchWithRetry(url: string, options: RequestInit, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status >= 500) continue; // Retry server errors
      throw new Error(`${response.status}: ${await response.text()}`);
    } catch (error) {
      if (i === retries - 1) throw error;
      await sleep(1000 * (i + 1)); // Exponential backoff
    }
  }
}
```

---

### Sprint 92: Documentation & Deployment

#### T92.1: Update Architecture Documentation [L - 4h]
**Files:** `docs/ARCHITECTURE.md`
**Content:**
- System diagram (Vercel + Railway)
- Data flow diagrams
- Auth flow diagram
- Email flow diagram

---

#### T92.2: Create Runbook [M - 2h]
**Files:** `docs/RUNBOOK.md`
**Content:**
- Common issues and fixes
- How to check Railway health
- How to check email queue
- How to reset user password
- How to rollback deployments

---

#### T92.3: Update Deployment Scripts [M - 2h]
**Files:** `package.json`, `vercel.json`
**Purpose:** Clean up deployment configuration

**Changes:**
1. Remove Firebase-related build steps
2. Add Railway health check to CI
3. Update environment variable docs

---

#### T92.4: E2E Testing Suite [L - 4h]
**Files:** `e2e/unified-platform.spec.ts`
**Purpose:** End-to-end tests for critical flows

**Test Scenarios:**
1. Login → View Dashboard → See Daily Brief
2. Search Company → View Details → Queue Outreach
3. Select Prospects → Bulk Send Email → Verify Queued
4. Create Sequence → Enroll Prospects → Check Status
5. View Analytics → Export Report

---

## Summary

### Sprint Overview

| Phase | Sprints | Goal | Demo |
|-------|---------|------|------|
| 1 - Email | 80-82 | Email sending works | Send email, see it delivered |
| 2 - Auth | 83-84 | Single auth system | Login once, access everything |
| 3 - Data | 85-87 | Single data source | All data in PostgreSQL |
| 4 - Features | 88-90 | All features unified | Daily Brief, Sequences, Analytics |
| 5 - Polish | 91-92 | Production ready | Stable, documented, tested |

### Task Size Legend

| Size | Time | Example |
|------|------|---------|
| XS | 15 min | Update config file |
| S | 30 min - 1h | Add simple component |
| M | 2-3h | Create service with tests |
| L | 4h+ | Major feature implementation |

### Critical Path

```
T80.1 (Verify Email) 
    → T81.4 (Wire Email Button) 
    → T82.3 (Batch Send)
    → T83.4 (Railway Auth) 
    → T85.1 (Railway Data)
    → T88.3 (Daily Brief)
```

### Environment Variables (Final State)

```bash
# Vercel Environment
VITE_RAILWAY_URL=https://yardflow-hitlist-production-2f41.up.railway.app
VITE_USE_RAILWAY_AUTH=true
VITE_USE_RAILWAY_DATA=true
VITE_GEMINI_API_KEY=xxx  # For AI research

# Railway Environment (already configured)
DATABASE_URL=xxx
REDIS_URL=xxx
AUTH_SECRET=xxx
SENDGRID_API_KEY=xxx
SENDGRID_FROM_EMAIL=xxx
OPENAI_API_KEY=xxx
```

---

## Appendix A: Railway API Endpoints (Reference)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | System health |
| `/api/auth/*` | * | NextAuth routes |
| `/api/people` | GET/POST | List/create prospects |
| `/api/people/:id` | GET/PATCH/DELETE | Single prospect CRUD |
| `/api/accounts` | GET/POST | List/create companies |
| `/api/accounts/:id` | GET/PATCH | Single company CRUD |
| `/api/outreach/send-email` | POST | Queue email |
| `/api/outreach/batch` | POST | Queue batch emails |
| `/api/outreach/status/:id` | GET | Email status |
| `/api/sequences` | GET/POST | List/create sequences |
| `/api/sequences/:id/enroll` | POST | Enroll in sequence |
| `/api/briefing` | GET | Daily brief |
| `/api/analytics/*` | GET | Analytics data |

---

## Appendix B: Migration Checklist

### Pre-Migration
- [ ] Backup all Firestore data
- [ ] Document current Firebase config
- [ ] Verify Railway health
- [ ] Test Railway login

### During Migration
- [ ] Run data sync script
- [ ] Verify data integrity
- [ ] Update feature flags
- [ ] Test critical flows

### Post-Migration
- [ ] Remove Firebase config
- [ ] Update documentation
- [ ] Monitor for errors
- [ ] Archive old code

---

**Document Version:** 9.0  
**Last Updated:** 2026-01-30  
**Status:** Ready for Implementation

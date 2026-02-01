# YardFlow Master Sprint Plan

**Version:** 1.0  
**Created:** February 1, 2026  
**Status:** 🟢 Active  
**North Star Metric:** Prospects enrolled → Meetings booked

---

## Platform Overview

### Two-Repo Architecture

| Repository | Platform | Purpose | Current State |
|------------|----------|---------|---------------|
| **GTM-YardFlow** | Vercel | React SPA, Firebase Auth, API proxy, webhooks | ✅ Healthy (3,159 tests) |
| **YardFlow-Hitlist** | Railway | Next.js backend, Postgres, Redis, SendGrid | ✅ Deployed, CI failing |

### Data Flow
```
User → Vercel SPA → api/railway/[...path].ts → Railway → SendGrid
                                                     ↓
                                      api/webhooks/* ← webhooks
                                                     ↓
                                                  Firestore
```

### Current Blockers
1. **Railway CI** - GitHub Actions failing (TypeScript errors, Prisma issues)
2. **SendGrid Domain Auth** - DNS records need adding in Cloudflare
3. **Cross-repo API gaps** - 21 endpoints needed for unification

---

## Phase 0: Emergency Fixes (Foundation)

### Sprint E0: CI/CD Repair
**Goal:** Railway deploys successfully, SendGrid emails work  
**Demo:** Send test email from production Railway endpoint

#### T-E0.1: Fix Railway TypeScript Errors
**Repo:** YardFlow-Hitlist  
**File:** `eventops/src/**/*.ts`  
**Changes:**
- Add `'use client'` directives to React components using hooks
- Fix `unknown` type in catch blocks: `catch (error) { const msg = error instanceof Error ? error.message : String(error); }`
- Remove unused imports

**Validation:**
```bash
cd eventops && npx tsc --noEmit  # 0 errors
npm run build                     # Succeeds
```

#### T-E0.2: Complete SendGrid Domain Authentication
**Repo:** N/A (External)  
**Changes:**
- Add 3 CNAME records in Cloudflare for freightroll.com
- Wait for DNS propagation (up to 48h)
- Verify in SendGrid dashboard

**Validation:**
```bash
curl -X POST https://yardflow-hitlist-production-2f41.up.railway.app/api/outreach/send-email \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test","body":"Hello"}'
# Returns 200 OK
```

#### T-E0.3: Verify Railway Environment Variables
**Repo:** YardFlow-Hitlist (Railway Dashboard)  
**Current Status:**
- ✅ DATABASE_URL
- ✅ REDIS_URL
- ✅ AUTH_SECRET
- ✅ CRON_SECRET
- ✅ SERVICE_TO_SERVICE_SECRET
- ✅ SENDGRID_API_KEY
- ✅ SENDGRID_FROM_EMAIL (jake@freightroll.com)

**Validation:**
```bash
curl https://yardflow-hitlist-production-2f41.up.railway.app/api/health | jq .
# status: "healthy"
```

---

## Phase 1: Core Email Flow (MVP)

### Sprint 1: End-to-End Email Sending
**Goal:** Send a single email from the UI through Railway  
**Demo:** Click "Send Email" button, email arrives in inbox

#### T-1.1: Create Email Send Form Component
**Repo:** GTM-YardFlow  
**File:** `src/components/SendEmailForm.tsx`  
**Behavior:**
- Input fields: To, Subject, Body
- Submit button triggers Railway API
- Shows success/error toast

**Test:**
```typescript
// src/__tests__/components/SendEmailForm.test.tsx
it('calls Railway API on submit', async () => {
  render(<SendEmailForm />);
  await userEvent.type(screen.getByLabelText('To'), 'test@example.com');
  await userEvent.click(screen.getByRole('button', { name: /send/i }));
  expect(railwayClient.email.send).toHaveBeenCalled();
});
```

#### T-1.2: Add Railway Email Send Endpoint Proxy
**Repo:** GTM-YardFlow  
**File:** `api/railway/[...path].ts`  
**Changes:** Ensure `/api/outreach/send-email` is in ALLOWED_PATHS

**Validation:**
```bash
curl -X POST https://your-vercel.app/api/railway/outreach/send-email \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"to":"test@example.com","subject":"Test","body":"Hello"}'
```

#### T-1.3: Add Email to Queue Instead of Direct Send
**Repo:** YardFlow-Hitlist  
**File:** `eventops/src/app/api/outreach/send-email/route.ts`  
**Changes:**
- Push to BullMQ queue instead of direct SendGrid call
- Return job ID for tracking

**Test:**
```typescript
// In Railway codebase
it('adds email to queue', async () => {
  const res = await POST(mockRequest);
  const body = await res.json();
  expect(body.jobId).toBeDefined();
});
```

---

### Sprint 2: Email Tracking & Webhooks
**Goal:** Track email opens, clicks, bounces  
**Demo:** Send email, open it, see "opened" status in dashboard

#### T-2.1: Implement Open Tracking Pixel
**Repo:** GTM-YardFlow  
**File:** `api/track/open.ts`  
**Behavior:**
- Returns 1x1 transparent GIF
- Records open event in Firestore `email_events`
- Extracts emailId from query param

**Test:**
```typescript
it('returns 1x1 GIF and logs event', async () => {
  const res = await GET({ query: { id: 'email123' } });
  expect(res.headers.get('Content-Type')).toBe('image/gif');
  expect(mockFirestore.collection('email_events').add).toHaveBeenCalled();
});
```

#### T-2.2: Implement Click Tracking Redirect
**Repo:** GTM-YardFlow  
**File:** `api/track/click.ts`  
**Behavior:**
- Records click event
- 302 redirects to original URL
- Handles missing URL gracefully

**Test:**
```typescript
it('redirects to target URL', async () => {
  const res = await GET({ query: { id: 'email123', url: 'https://example.com' } });
  expect(res.status).toBe(302);
  expect(res.headers.get('Location')).toBe('https://example.com');
});
```

#### T-2.3: Implement SendGrid Webhook Handler
**Repo:** GTM-YardFlow  
**File:** `api/webhooks/sendgrid.ts`  
**Events:** delivered, open, click, bounce, spamreport, unsubscribe
**Behavior:**
- Verify webhook signature
- Parse event array
- Update Firestore email_events
- Add to suppression list on bounce/unsubscribe

**Test:**
```typescript
it('processes bounce and adds to suppression', async () => {
  const res = await POST({
    body: [{ event: 'bounce', email: 'bad@example.com', sg_message_id: 'xxx' }]
  });
  expect(mockSuppressionService.add).toHaveBeenCalledWith('bad@example.com');
});
```

---

### Sprint 3: Sequence Builder UI
**Goal:** Create multi-step email sequences in the UI  
**Demo:** Build a 3-step sequence with delays

#### T-3.1: Create Sequence Step Editor
**Repo:** GTM-YardFlow  
**File:** `src/components/sequence/StepEditor.tsx`  
**Features:**
- Subject line input
- Rich text body editor
- Delay selector (hours/days)
- Variable placeholders ({{firstName}}, {{company}})

**Test:**
```typescript
it('renders step with subject and body', () => {
  render(<StepEditor step={mockStep} onChange={vi.fn()} />);
  expect(screen.getByLabelText('Subject')).toHaveValue(mockStep.subject);
});
```

#### T-3.2: Create Draggable Step List
**Repo:** GTM-YardFlow  
**File:** `src/components/sequence/DraggableStepList.tsx`  
**Features:**
- Drag-to-reorder steps
- Add/remove steps
- Step preview on hover

**Test:**
```typescript
it('reorders steps on drag', async () => {
  const onChange = vi.fn();
  render(<DraggableStepList steps={[step1, step2]} onChange={onChange} />);
  // Simulate drag
  expect(onChange).toHaveBeenCalledWith([step2, step1]);
});
```

#### T-3.3: Create Sequence Save API
**Repo:** GTM-YardFlow  
**File:** `src/services/SequenceService.ts`  
**Methods:**
- `createSequence(sequence)` → Firestore + Railway
- `updateSequence(id, changes)`
- `deleteSequence(id)`

**Test:**
```typescript
it('saves to Firestore and Railway', async () => {
  await SequenceService.createSequence(mockSequence);
  expect(mockFirestore.collection('sequences').add).toHaveBeenCalled();
  expect(railwayClient.sequences.create).toHaveBeenCalled();
});
```

---

### Sprint 4: Enrollment Engine
**Goal:** Enroll prospects in sequences, execute steps on schedule  
**Demo:** Enroll 3 prospects, see emails sent at configured intervals

#### T-4.1: Create Enrollment Modal
**Repo:** GTM-YardFlow  
**File:** `src/components/EnrollmentModal.tsx`  
**Features:**
- Sequence selector dropdown
- Prospect list with checkboxes
- Bulk enroll button
- Conflict detection (already enrolled)

**Test:**
```typescript
it('enrolls selected prospects', async () => {
  render(<EnrollmentModal prospects={[p1, p2]} />);
  await userEvent.click(screen.getByRole('checkbox', { name: p1.name }));
  await userEvent.click(screen.getByRole('button', { name: /enroll/i }));
  expect(enrollmentService.enroll).toHaveBeenCalledWith([p1.id], expect.any(String));
});
```

#### T-4.2: Implement Enrollment State Machine
**Repo:** GTM-YardFlow  
**File:** `src/services/SequenceStateMachine.ts`  
**States:** active, paused, completed, stopped, replied, bounced, meeting  
**Transitions:**
- active → paused (manual, OOO, soft bounce)
- active → completed (all steps sent)
- active → stopped (manual cancel, hard bounce)
- active → replied (reply detected)
- paused → active (resume)
- replied → meeting (Calendly webhook)

**Test:**
```typescript
it('transitions from active to paused', () => {
  const sm = new SequenceStateMachine('active');
  expect(sm.canTransition('paused')).toBe(true);
  sm.transition('paused');
  expect(sm.state).toBe('paused');
});

it('prevents invalid transitions', () => {
  const sm = new SequenceStateMachine('completed');
  expect(sm.canTransition('active')).toBe(false);
});
```

#### T-4.3: Implement Cron Job for Step Execution
**Repo:** GTM-YardFlow  
**File:** `api/cron/execute-sequences.ts`  
**Behavior:**
- Query enrollments with nextStepAt <= now
- Execute pending step (send email)
- Update enrollment state
- Schedule next step

**Validation:** Check Vercel cron logs show execution every 5 min

**Test:**
```typescript
it('executes due steps', async () => {
  mockFirestore.collection('enrollments').get.mockResolvedValue([
    { id: 'e1', nextStepAt: pastDate, currentStep: 0 }
  ]);
  await GET(mockRequest);
  expect(emailService.send).toHaveBeenCalled();
});
```

---

### Sprint 5: Inbound Reply Handling
**Goal:** Detect replies and stop sequences automatically  
**Demo:** Reply to sequence email, see enrollment marked as "replied"

#### T-5.1: Configure SendGrid Inbound Parse
**Repo:** N/A (SendGrid Dashboard)  
**Steps:**
1. Add MX record for reply.freightroll.com
2. Configure Inbound Parse URL to `/api/webhooks/inbound`

**Validation:** Send email to test@reply.freightroll.com, check webhook logs

#### T-5.2: Implement Inbound Webhook Handler
**Repo:** GTM-YardFlow  
**File:** `api/webhooks/inbound.ts`  
**Behavior:**
- Parse incoming email (from, subject, body)
- Match to original email via In-Reply-To header
- Classify: reply vs OOO
- Update enrollment state

**Test:**
```typescript
it('stops sequence on reply', async () => {
  const res = await POST({ body: { from: 'prospect@example.com', subject: 'Re: ...' } });
  expect(enrollmentService.transition).toHaveBeenCalledWith('e1', 'replied');
});
```

#### T-5.3: Implement OOO Detection
**Repo:** GTM-YardFlow  
**File:** `src/services/OutOfOfficeDetector.ts`  
**Behavior:**
- Detect OOO patterns in subject/body
- Extract return date if available
- Pause enrollment with resume date

**Test:**
```typescript
it('detects OOO with return date', () => {
  const result = OutOfOfficeDetector.detect('Out of office until Feb 15');
  expect(result.isOOO).toBe(true);
  expect(result.returnDate).toEqual(new Date('2026-02-15'));
});
```

---

## Phase 2: Meeting Attribution (North Star)

### Sprint 6: Calendly Integration
**Goal:** Attribute meetings to email sequences  
**Demo:** Prospect books meeting, sequence stops, dashboard shows attribution

#### T-6.1: Implement Calendly Webhook Handler
**Repo:** GTM-YardFlow  
**File:** `api/webhooks/calendly.ts`  
**Events:** invitee.created, invitee.canceled  
**Behavior:**
- Verify webhook signature
- Extract invitee email
- Match to prospect
- Stop active enrollments
- Create meeting record

**Test:**
```typescript
it('creates meeting and stops enrollment', async () => {
  const res = await POST({
    body: {
      event: 'invitee.created',
      payload: { invitee: { email: 'prospect@example.com' } }
    }
  });
  expect(meetingService.create).toHaveBeenCalled();
  expect(enrollmentService.transition).toHaveBeenCalledWith(expect.any(String), 'meeting');
});
```

#### T-6.2: Create Meeting Attribution Dashboard
**Repo:** GTM-YardFlow  
**File:** `src/components/analytics/MeetingAttributionDashboard.tsx`  
**Metrics:**
- Meetings this week/month
- Source attribution (which sequence)
- Time to meeting (avg days from first email)
- Conversion rate by sequence

**Test:**
```typescript
it('displays meeting metrics', async () => {
  render(<MeetingAttributionDashboard />);
  await waitFor(() => {
    expect(screen.getByText('Meetings This Week')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
```

#### T-6.3: Add Meeting Count to Prospect Card
**Repo:** GTM-YardFlow  
**File:** `src/components/ProspectCard.tsx`  
**Features:**
- Show meeting badge if any meetings
- Click to view meeting details
- Show "Meeting Booked!" toast on webhook

**Test:**
```typescript
it('shows meeting badge', () => {
  render(<ProspectCard prospect={{ ...mockProspect, meetingCount: 1 }} />);
  expect(screen.getByTestId('meeting-badge')).toBeInTheDocument();
});
```

---

## Phase 3: Railway Unification

### Sprint 7: Prospect CRUD Migration
**Goal:** Prospects stored in Railway Postgres, Firestore as read cache  
**Demo:** Create prospect in UI, see it in Railway database

#### T-7.1: Create Railway Prospect Endpoints
**Repo:** YardFlow-Hitlist  
**File:** `eventops/src/app/api/prospects/route.ts`  
**Endpoints:**
- GET /api/prospects (paginated, filtered)
- POST /api/prospects (create)
- GET /api/prospects/:id
- PUT /api/prospects/:id
- DELETE /api/prospects/:id
- POST /api/prospects/batch
- POST /api/prospects/search

**Test:**
```typescript
it('returns paginated prospects', async () => {
  const res = await GET({ query: { limit: '10', cursor: null } });
  const body = await res.json();
  expect(body.data.length).toBeLessThanOrEqual(10);
  expect(body.pagination).toBeDefined();
});
```

#### T-7.2: Add tier/score Columns to Prisma Schema
**Repo:** YardFlow-Hitlist  
**File:** `eventops/prisma/schema.prisma`  
**Changes:**
```prisma
model people {
  // existing fields...
  tier      String?   @default("Tier 2")
  score     Int?      @default(50)
  status    String?   @default("active")
  tags      String[]
}
```

**Validation:**
```bash
npx prisma migrate dev --name add_tier_score
npx prisma generate
```

#### T-7.3: Update GTM-YardFlow Prospect Service
**Repo:** GTM-YardFlow  
**File:** `src/services/ProspectService.ts`  
**Changes:**
- Write to Railway via proxy, fallback to Firestore
- Read from Firestore (synced from Railway)
- Handle offline with queue

**Test:**
```typescript
it('writes to Railway when available', async () => {
  vi.mocked(isRailwayAvailable).mockReturnValue(true);
  await ProspectService.create(mockProspect);
  expect(railwayClient.prospects.create).toHaveBeenCalled();
});

it('falls back to Firestore when Railway unavailable', async () => {
  vi.mocked(isRailwayAvailable).mockReturnValue(false);
  await ProspectService.create(mockProspect);
  expect(mockFirestore.collection('prospects').add).toHaveBeenCalled();
});
```

---

### Sprint 8: Enrollment Migration
**Goal:** Enrollments managed in Railway, synced to Firestore  
**Demo:** Pause enrollment in UI, Railway state updates

#### T-8.1: Create Railway Enrollment Endpoints
**Repo:** YardFlow-Hitlist  
**File:** `eventops/src/app/api/enrollments/` (multiple files)  
**Endpoints:**
- GET /api/enrollments
- GET /api/enrollments/:id
- POST /api/enrollments/:id/pause
- POST /api/enrollments/:id/resume
- DELETE /api/enrollments/:id (stop)

**Test:**
```typescript
it('pauses enrollment and updates state', async () => {
  const res = await POST({ params: { id: 'e1' } });
  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.enrollment.status).toBe('PAUSED');
});
```

#### T-8.2: Update Enrollment Service in GTM-YardFlow
**Repo:** GTM-YardFlow  
**File:** `src/services/EnrollmentService.ts`  
**Methods:**
- `pause(id)` → Railway + Firestore sync
- `resume(id)` → Railway + Firestore sync
- `stop(id, reason)` → Railway + Firestore sync

**Test:**
```typescript
it('calls Railway pause endpoint', async () => {
  await EnrollmentService.pause('e1');
  expect(railwayClient.enrollments.pause).toHaveBeenCalledWith('e1');
});
```

---

### Sprint 9: Email Queue Migration
**Goal:** Email queue managed by Railway BullMQ, status visible in UI  
**Demo:** View email queue status, retry failed emails

#### T-9.1: Create Email Queue Status Endpoint
**Repo:** YardFlow-Hitlist  
**File:** `eventops/src/app/api/email/queue/status/route.ts`  
**Response:**
```typescript
{
  queued: number;
  processing: number;
  sent24h: number;
  failed24h: number;
  deadLetter: number;
}
```

**Test:**
```typescript
it('returns queue metrics', async () => {
  const res = await GET(mockRequest);
  const body = await res.json();
  expect(body.queued).toBeGreaterThanOrEqual(0);
});
```

#### T-9.2: Create Dead Letter Queue UI
**Repo:** GTM-YardFlow  
**File:** `src/components/EmailDeadLetterQueue.tsx`  
**Features:**
- List failed emails with error messages
- Retry button per email
- Bulk retry option
- Clear/dismiss failed

**Test:**
```typescript
it('retries failed email', async () => {
  render(<EmailDeadLetterQueue />);
  await userEvent.click(screen.getByRole('button', { name: /retry/i }));
  expect(railwayClient.email.retry).toHaveBeenCalled();
});
```

---

### Sprint 10: Auth Bridge
**Goal:** Firebase users can access Railway resources seamlessly  
**Demo:** Login with Firebase, access Railway-protected endpoint

#### T-10.1: Create Firebase User Migration Endpoint
**Repo:** YardFlow-Hitlist  
**File:** `eventops/src/app/api/users/from-firebase/route.ts`  
**Behavior:**
- Receive Firebase UID + claims
- Create or update Railway user
- Return Railway session token

**Test:**
```typescript
it('creates Railway user from Firebase', async () => {
  const res = await POST({
    body: { firebaseUid: 'fb123', email: 'user@example.com' }
  });
  const body = await res.json();
  expect(body.railwayUserId).toBeDefined();
});
```

#### T-10.2: Implement Auth Bridge in GTM-YardFlow
**Repo:** GTM-YardFlow  
**File:** `src/services/AuthBridge.ts`  
**Methods:**
- `getOrCreateRailwaySession()` - Exchange Firebase token
- `ensureValidSession()` - Refresh if expiring
- `isRailwayAvailable()` - Check connection

**Test:**
```typescript
it('exchanges Firebase token for Railway session', async () => {
  mockFirebaseAuth.currentUser = { uid: 'fb123', getIdToken: () => Promise.resolve('token') };
  const session = await AuthBridge.getOrCreateRailwaySession();
  expect(session.railwayUserId).toBeDefined();
});
```

---

## Phase 4: Analytics & Optimization

### Sprint 11: Email Analytics Dashboard
**Goal:** Visualize email performance metrics  
**Demo:** View open rates, click rates, reply rates by sequence

#### T-11.1: Create Analytics Aggregator Service
**Repo:** GTM-YardFlow  
**File:** `src/services/AnalyticsAggregator.ts`  
**Methods:**
- `getEmailMetrics(period)` - sent, opened, clicked, replied, bounced
- `getSequenceMetrics(sequenceId)` - per-sequence breakdown
- `getTimeSeries(metric, period)` - for charts

**Test:**
```typescript
it('calculates open rate correctly', async () => {
  mockData.sent = 100;
  mockData.opened = 25;
  const metrics = await AnalyticsAggregator.getEmailMetrics('7d');
  expect(metrics.openRate).toBe(0.25);
});
```

#### T-11.2: Create Email Analytics Charts
**Repo:** GTM-YardFlow  
**Files:** `src/components/charts/{LineChart,BarChart,FunnelChart}.tsx`  
**Charts:**
- Funnel: Sent → Delivered → Opened → Clicked → Replied → Meeting
- Line: Daily sends over time
- Bar: Performance by sequence

**Test:**
```typescript
it('renders funnel with correct values', () => {
  render(<FunnelChart data={mockFunnelData} />);
  expect(screen.getByText('100 Sent')).toBeInTheDocument();
  expect(screen.getByText('25 Opened')).toBeInTheDocument();
});
```

---

### Sprint 12: A/B Testing
**Goal:** Test subject lines and content variations  
**Demo:** Create A/B test, see winner after threshold

#### T-12.1: Create A/B Test Service
**Repo:** GTM-YardFlow  
**File:** `src/services/ABTestingService.ts`  
**Methods:**
- `createTest(sequenceId, stepIndex, variants)`
- `assignVariant(testId, prospectId)` - Random assignment
- `getResults(testId)` - Performance by variant
- `declareWinner(testId)` - Statistical significance check

**Test:**
```typescript
it('randomly assigns variants 50/50', async () => {
  const assignments = Array(100).fill(null).map(() => 
    ABTestingService.assignVariant('test1', `p${Math.random()}`)
  );
  const aCount = assignments.filter(a => a === 'A').length;
  expect(aCount).toBeGreaterThan(40);
  expect(aCount).toBeLessThan(60);
});
```

#### T-12.2: Create A/B Test UI
**Repo:** GTM-YardFlow  
**File:** `src/components/analytics/ABTestingDashboard.tsx`  
**Features:**
- Create new test
- View running tests
- See results with confidence interval
- Apply winner to sequence

**Test:**
```typescript
it('displays variant performance', async () => {
  render(<ABTestingDashboard />);
  await waitFor(() => {
    expect(screen.getByText('Variant A: 15% open rate')).toBeInTheDocument();
    expect(screen.getByText('Variant B: 22% open rate')).toBeInTheDocument();
  });
});
```

---

## Phase 5: Import & Enrichment

### Sprint 13: CSV Import
**Goal:** Import prospects from CSV files  
**Demo:** Upload CSV, map columns, import 100 prospects

#### T-13.1: Create CSV Parser Service
**Repo:** GTM-YardFlow  
**File:** `src/services/CsvParserService.ts`  
**Methods:**
- `parseCsv(file)` - Parse with auto-detect delimiter
- `previewCsv(file, limit)` - First N rows for mapping
- `validateCsvStructure(headers)` - Check required columns

**Test:**
```typescript
it('parses CSV with headers', async () => {
  const csv = 'Name,Email\nJohn,john@example.com';
  const result = await CsvParserService.parseCsv(csv);
  expect(result.rows[0]).toEqual({ Name: 'John', Email: 'john@example.com' });
});
```

#### T-13.2: Create Column Mapper UI
**Repo:** GTM-YardFlow  
**File:** `src/components/import/ColumnMapper.tsx`  
**Features:**
- Auto-detect common column names
- Manual mapping with dropdowns
- Preview transformed data
- Validation warnings

**Test:**
```typescript
it('auto-maps Email column', () => {
  render(<ColumnMapper headers={['Email Address', 'Name']} />);
  expect(screen.getByLabelText('email').value).toBe('Email Address');
});
```

#### T-13.3: Implement Duplicate Detection
**Repo:** GTM-YardFlow  
**File:** `src/services/DuplicateDetector.ts`  
**Methods:**
- `findDuplicates(prospects)` - By email
- `normalizeEmail(email)` - Lowercase, trim
- `suggestMerge(existing, imported)` - Merge strategy

**Test:**
```typescript
it('detects email duplicates', async () => {
  const duplicates = await DuplicateDetector.findDuplicates([
    { email: 'john@example.com' },
    { email: 'JOHN@example.com' }
  ]);
  expect(duplicates.length).toBe(1);
});
```

---

### Sprint 14: LinkedIn Import
**Goal:** Import connections exported from LinkedIn  
**Demo:** Upload LinkedIn export, import 50 connections

#### T-14.1: Create LinkedIn CSV Parser
**Repo:** GTM-YardFlow  
**File:** `src/services/LinkedInCsvParser.ts`  
**Behavior:**
- Parse LinkedIn-specific column names
- Extract company from position
- Build LinkedIn profile URL

**Test:**
```typescript
it('parses LinkedIn export format', async () => {
  const csv = 'First Name,Last Name,Company,Position\nJohn,Doe,Acme Inc,CEO';
  const result = await LinkedInCsvParser.parse(csv);
  expect(result[0].company).toBe('Acme Inc');
  expect(result[0].linkedinUrl).toContain('linkedin.com');
});
```

---

### Sprint 15: Email Enrichment
**Goal:** Find missing email addresses automatically  
**Demo:** Click "Find Email" on prospect, email populated

#### T-15.1: Create Email Pattern Detection
**Repo:** GTM-YardFlow  
**File:** `src/services/EmailPatternService.ts`  
**Methods:**
- `detectPattern(domain, knownEmails)` - Infer pattern
- `guessEmail(firstName, lastName, domain, pattern)` - Generate guess

**Test:**
```typescript
it('detects first.last pattern', () => {
  const pattern = EmailPatternService.detectPattern('acme.com', [
    'john.doe@acme.com', 'jane.smith@acme.com'
  ]);
  expect(pattern).toBe('first.last');
});
```

#### T-15.2: Integrate Hunter.io API
**Repo:** YardFlow-Hitlist  
**File:** `eventops/src/app/api/enrichment/email/route.ts`  
**Behavior:**
- Call Hunter.io email finder
- Validate with email verifier
- Update prospect record

**Test:**
```typescript
it('enriches prospect with verified email', async () => {
  mockHunter.findEmail.mockResolvedValue({ email: 'john@acme.com', score: 95 });
  const res = await POST({ body: { personId: 'p1' } });
  expect(res.status).toBe(200);
});
```

---

## Phase 6: Production Hardening

### Sprint 16: Error Handling & Monitoring
**Goal:** Comprehensive error tracking and alerting  
**Demo:** Error occurs, Slack notification received

#### T-16.1: Implement Error Tracking Service
**Repo:** GTM-YardFlow  
**File:** `src/services/ErrorTracking.ts`  
**Methods:**
- `captureException(error, context)` - Log to Sentry/console
- `captureDomainError(domain, error)` - Typed domain errors
- `setUser(user)` - Associate errors with user

**Test:**
```typescript
it('captures error with context', () => {
  ErrorTracking.captureException(new Error('Test'), { userId: 'u1' });
  expect(mockSentry.captureException).toHaveBeenCalled();
});
```

#### T-16.2: Create Health Dashboard
**Repo:** GTM-YardFlow  
**File:** `src/components/SystemHealth.tsx`  
**Metrics:**
- Railway status (healthy/degraded)
- Email queue depth
- Error rate (last hour)
- Uptime percentage

**Test:**
```typescript
it('shows healthy status when all checks pass', async () => {
  render(<SystemHealth />);
  await waitFor(() => {
    expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
  });
});
```

#### T-16.3: Implement Slack Alerting
**Repo:** GTM-YardFlow  
**File:** `lib/alerting.ts`  
**Triggers:**
- Email queue > 100 items
- Error rate > 5%
- Railway unhealthy > 5 min

**Test:**
```typescript
it('sends Slack alert on threshold breach', async () => {
  await Alerting.checkThresholds({ queueDepth: 150 });
  expect(mockSlack.postMessage).toHaveBeenCalled();
});
```

---

### Sprint 17: Performance Optimization
**Goal:** Sub-second page loads, optimized bundle  
**Demo:** Lighthouse score > 90

#### T-17.1: Implement Code Splitting
**Repo:** GTM-YardFlow  
**Files:** Various component files  
**Changes:**
- Lazy load heavy components (charts, editors)
- Route-based splitting
- Prefetch on hover

**Validation:**
```bash
npm run build
# Bundle analysis shows < 200KB initial load
```

#### T-17.2: Add Web Vitals Monitoring
**Repo:** GTM-YardFlow  
**File:** `src/services/WebVitals.ts`  
**Metrics:** LCP, CLS, INP, TTFB

**Test:**
```typescript
it('reports LCP under 2.5s', async () => {
  const metrics = await WebVitals.measure();
  expect(metrics.lcp).toBeLessThan(2500);
});
```

---

### Sprint 18: Security Hardening
**Goal:** OWASP Top 10 mitigations  
**Demo:** Security audit passes

#### T-18.1: Implement Rate Limiting
**Repo:** GTM-YardFlow  
**File:** `lib/rateLimiter.ts`  
**Limits:**
- 100 req/min per IP for API
- 10 req/min per IP for auth
- 1000 req/min for webhooks

**Test:**
```typescript
it('blocks after limit exceeded', async () => {
  for (let i = 0; i < 101; i++) {
    await rateLimiter.check('192.168.1.1');
  }
  await expect(rateLimiter.check('192.168.1.1')).rejects.toThrow('Rate limited');
});
```

#### T-18.2: Add CSRF Protection
**Repo:** GTM-YardFlow  
**File:** `api/_middleware.ts`  
**Behavior:**
- Generate CSRF token on session start
- Validate token on state-changing requests
- Reject requests without valid token

**Test:**
```typescript
it('rejects POST without CSRF token', async () => {
  const res = await POST({ headers: {} });
  expect(res.status).toBe(403);
});
```

#### T-18.3: Implement Input Validation
**Repo:** Both repos  
**Pattern:** Zod schemas for all API inputs

**Test:**
```typescript
it('rejects invalid email format', async () => {
  const res = await POST({ body: { email: 'not-an-email' } });
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ error: 'VALIDATION_ERROR' });
});
```

---

## Appendix A: Service Dependencies

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Services                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐         │
│  │ AuthBridge  │───▶│ RailwayClient│───▶│ Railway Backend │         │
│  └─────────────┘    └──────────────┘    └─────────────────┘         │
│         │                  │                     │                   │
│         ▼                  ▼                     ▼                   │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐         │
│  │ FirebaseAuth│    │ FirestoreDB  │    │ Postgres (Prisma)│         │
│  └─────────────┘    └──────────────┘    └─────────────────┘         │
│                            │                     │                   │
│                            ▼                     ▼                   │
│                     ┌──────────────┐    ┌─────────────────┐         │
│                     │EmailSequence │    │ BullMQ (Redis)  │         │
│                     │   Service    │    └─────────────────┘         │
│                     └──────────────┘             │                   │
│                            │                     ▼                   │
│                            ▼              ┌─────────────────┐        │
│                     ┌──────────────┐      │ SendGrid API   │        │
│                     │ Enrollment   │      └─────────────────┘        │
│                     │  Service     │                                 │
│                     └──────────────┘                                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Appendix B: Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `VITE_RAILWAY_ENABLED` | `false` | Master toggle for Railway backend |
| `VITE_RAILWAY_EMAIL_ENABLED` | `false` | Route emails through Railway |
| `VITE_RAILWAY_DATA_ENABLED` | `false` | Store data in Railway Postgres |
| `VITE_RAILWAY_AUTH_ENABLED` | `false` | Use Railway for auth |

---

## Appendix C: Environment Variables

### GTM-YardFlow (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `RAILWAY_API_URL` | Yes | Railway backend URL |
| `CRON_SECRET` | Yes | S2S auth secret |
| `SERVICE_TO_SERVICE_SECRET` | Yes | Railway auth |
| `SENDGRID_WEBHOOK_VERIFICATION_KEY` | Yes | Webhook signature |
| `CALENDLY_WEBHOOK_SECRET` | Yes | Calendly auth |
| `VITE_RAILWAY_ENABLED` | No | Feature flag |

### YardFlow-Hitlist (Railway)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection |
| `REDIS_URL` | Yes | Redis connection |
| `AUTH_SECRET` | Yes | NextAuth secret |
| `CRON_SECRET` | Yes | S2S auth secret |
| `SENDGRID_API_KEY` | Yes | Email sending |
| `SENDGRID_FROM_EMAIL` | Yes | Sender address |

---

## Appendix D: Definition of Done

Each task is complete when:
1. ✅ Code implemented and committed
2. ✅ Tests written and passing
3. ✅ No TypeScript errors
4. ✅ PR approved (if applicable)
5. ✅ Deployed to staging/production
6. ✅ Validated per task criteria

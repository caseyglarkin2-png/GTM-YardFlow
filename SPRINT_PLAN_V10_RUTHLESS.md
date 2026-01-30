# YardFlow GTM Hub - Sprint Plan V10: RUTHLESS FOCUS

## 🎯 THE NORTH STAR

> **Maximize meetings booked per day** through automated, tracked email sequences with high-converting messaging.

Everything else is noise.

---

## EXECUTIVE SUMMARY

### What We Learned (Socratic Interrogation)

| Insight | Implication |
|---------|-------------|
| **55 services, 8 tabs, 3000 lines in App.tsx** | We built features, not workflow |
| **Sequence templates exist but don't auto-send** | Core functionality is broken |
| **No reply detection** | Jake doesn't know when prospects respond |
| **No meeting attribution** | We can't measure what works |
| **"Happy to..." appears 8+ times in templates** | Weak frame, supplication language |
| **18-30 min per prospect currently** | 50% reduction achievable |

### What We're Building (Phases)

| Phase | Goal | Sprints | Outcome |
|-------|------|---------|---------|
| **Phase 1: Fix The Core** | Sequences actually send | 80-82 | Emails go out automatically on schedule |
| **Phase 2: Close The Loop** | Know when they reply | 83-84 | Reply detection + meeting attribution |
| **Phase 3: Speed Up Jake** | 50% faster workflow | 85-87 | One-click enrollment, Klaff templates, hot list |
| **Phase 4: Optimize** | Learn what works | 88-89 | A/B testing, template performance |
| **Phase 5: Clean Up** | Remove bloat | 90 | Delete unused code, split App.tsx |

### What We're NOT Building

| Feature | Why Not |
|---------|---------|
| AI Chatbot improvements | Jake sends emails, doesn't chat |
| PWA/Offline enhancements | Jake has internet |
| Presence/Collaboration | Jake works alone |
| New dashboard charts | Vanity metrics |
| HubSpot deep integration | Not proven needed |
| Mobile optimization | Jake uses desktop |

---

## 📋 PHASE 1: FIX THE CORE (Sprints 80-82)

### Goal: Sequences Actually Execute

**Current State:** EmailSequenceService.ts has beautiful templates. BulkSequenceModal lets you enroll prospects. But **nothing actually sends the follow-up emails on schedule**.

**Target State:** Enroll a prospect → emails send automatically at configured intervals → sequence advances until complete or reply detected.

---

### Sprint 80: Sequence Execution Engine

**Sprint Goal:** Create the scheduler that checks enrollments and queues due emails.

#### T80.1: Create SequenceEnrollment Schema [S - 1h]
**Files:** `src/types/sequences.ts`

**Description:** Define the data structure for tracking a prospect's progress through a sequence. This is the state machine that powers automation.

```typescript
export interface SequenceEnrollment {
  id: string;
  prospectId: string;
  sequenceId: string;
  status: 'active' | 'paused' | 'completed' | 'replied' | 'bounced';
  currentStepIndex: number;
  enrolledAt: number;
  lastSentAt: number | null;
  nextSendAt: number | null;
  completedAt: number | null;
  metadata: {
    enrolledBy: string;
    pauseReason?: string;
  };
}
```

**Validation:**
- [ ] Types compile without errors
- [ ] Can create enrollment object matching schema
- [ ] All status transitions documented

**Commit:** `feat(sequences): add SequenceEnrollment type schema`

---

#### T80.2: Create SequenceSchedulerService [M - 3h]
**Files:** `src/services/SequenceSchedulerService.ts`

**Description:** The brain of sequence automation. Scans all active enrollments, identifies which ones are due for their next email, and queues them for sending.

```typescript
export class SequenceSchedulerService {
  // Check all active enrollments, return those due for next step
  async getDueEnrollments(): Promise<SequenceEnrollment[]>;
  
  // Calculate next send time based on step config
  calculateNextSendAt(enrollment: SequenceEnrollment, step: SequenceStep): number;
  
  // Queue the next email for an enrollment
  async queueNextStep(enrollment: SequenceEnrollment): Promise<void>;
  
  // Advance enrollment to next step after successful send
  async advanceStep(enrollment: SequenceEnrollment): Promise<void>;
  
  // Mark enrollment as complete (all steps done)
  async completeEnrollment(enrollment: SequenceEnrollment): Promise<void>;
}
```

**Validation:**
- [ ] Unit tests for `getDueEnrollments` with various time scenarios
- [ ] Unit tests for `calculateNextSendAt` with weekend skipping
- [ ] Integration test: enroll → wait → verify queued

**Commit:** `feat(sequences): add SequenceSchedulerService`

---

#### T80.3: Add Sequence Execution Cron Endpoint [M - 2h]
**Files:** `api/cron/execute-sequences.ts`

**Description:** Vercel cron job that runs every 5 minutes, calls SequenceSchedulerService, and processes due enrollments.

```typescript
// api/cron/execute-sequences.ts
export default async function handler(req, res) {
  const scheduler = getSequenceScheduler();
  const dueEnrollments = await scheduler.getDueEnrollments();
  
  for (const enrollment of dueEnrollments.slice(0, 10)) {
    await scheduler.queueNextStep(enrollment);
  }
  
  return res.json({ processed: dueEnrollments.length });
}
```

**Validation:**
- [ ] Endpoint returns 200 with processed count
- [ ] Cron config in vercel.json runs every 5 min
- [ ] Logs show which enrollments were processed

**Commit:** `feat(sequences): add execution cron endpoint`

---

#### T80.4: Wire Enrollment to Email Queue [M - 2h]
**Files:** `src/services/SequenceSchedulerService.ts`, `src/services/RailwayEmailService.ts`

**Description:** Connect the scheduler output to actual email sending. When an enrollment is due, generate the email from the template and send via Railway.

**Validation:**
- [ ] Enrollment at step 0 → initial email sent
- [ ] Enrollment at step 1 → follow_up_1 sent
- [ ] Email contains correct template with prospect personalization

**Commit:** `feat(sequences): wire scheduler to email queue`

---

#### T80.5: Add Step Advancement After Send [S - 1h]
**Files:** `src/services/SequenceSchedulerService.ts`

**Description:** After email successfully sends, increment `currentStepIndex` and calculate `nextSendAt`. If no more steps, mark enrollment complete.

**Validation:**
- [ ] Send success → currentStepIndex increments
- [ ] Last step sent → status = 'completed'
- [ ] Send failure → step not advanced, retries next cycle

**Commit:** `feat(sequences): advance step after successful send`

---

#### T80.6: Add Idempotency Protection [S - 1h]
**Files:** `src/services/SequenceSchedulerService.ts`

**Description:** Prevent duplicate sends if cron runs multiple times. Check `lastSentAt` before queuing. Add unique key per enrollment+step.

**Validation:**
- [ ] Same enrollment+step never queued twice
- [ ] Idempotency key stored with each send
- [ ] Duplicate detection logged for monitoring

**Commit:** `feat(sequences): add idempotency protection`

---

### Sprint 81: Enrollment Management

**Sprint Goal:** Let Jake enroll prospects in sequences and see enrollment status.

#### T81.1: Add Enrollment Storage [M - 2h]
**Files:** `src/services/SequenceEnrollmentService.ts`

**Description:** CRUD operations for enrollments. Store in localStorage for now (Firebase later if needed).

```typescript
export const SequenceEnrollmentService = {
  enroll(prospectId: string, sequenceId: string): SequenceEnrollment;
  pause(enrollmentId: string, reason: string): void;
  resume(enrollmentId: string): void;
  cancel(enrollmentId: string): void;
  getByProspect(prospectId: string): SequenceEnrollment | null;
  getAllActive(): SequenceEnrollment[];
};
```

**Validation:**
- [ ] Can enroll prospect
- [ ] Can pause/resume/cancel
- [ ] Data persists across page reload

**Commit:** `feat(sequences): add enrollment storage service`

---

#### T81.2: Add Sequence Badge to Prospect Card [S - 1h]
**Files:** `src/App.tsx`

**Description:** Show enrollment status on prospect row. Visual indicator: 📧 enrolled, ⏸️ paused, ✅ completed.

**Validation:**
- [ ] Badge appears for enrolled prospects
- [ ] Badge shows current step (e.g., "Step 2/4")
- [ ] Different icons for paused/completed

**Commit:** `feat(sequences): add enrollment badge to prospect card`

---

#### T81.3: Add One-Click Enroll Button [M - 2h]
**Files:** `src/App.tsx` or `src/components/ProspectDetailPanel.tsx`

**Description:** In prospect detail, add "Start Sequence" dropdown that shows available sequences. One click to enroll.

**Validation:**
- [ ] Dropdown shows all sequences
- [ ] Click sequence → prospect enrolled
- [ ] Success toast shows first email time

**Commit:** `feat(sequences): add one-click enroll button`

---

#### T81.4: Add Bulk Enrollment Action [M - 2h]
**Files:** `src/components/BulkSequenceModal.tsx`

**Description:** Update existing bulk modal to actually create enrollments, not just log intent.

**Validation:**
- [ ] Select 5 prospects → Start sequence → 5 enrollments created
- [ ] First emails queued for all 5
- [ ] Progress indicator shows enrollment count

**Commit:** `feat(sequences): wire bulk enrollment to create actual enrollments`

---

#### T81.5: Add Sequence Management View [M - 3h]
**Files:** `src/components/SequenceManagerPanel.tsx`

**Description:** Simple panel showing all active enrollments. Columns: Prospect, Sequence, Step, Next Send, Status. Actions: Pause, Resume, Cancel.

**Validation:**
- [ ] Lists all active enrollments
- [ ] Can filter by sequence
- [ ] Can pause/resume from UI

**Commit:** `feat(sequences): add sequence manager panel`

---

### Sprint 82: Pause on Events

**Sprint Goal:** Auto-pause sequences when prospect replies, bounces, or unsubscribes.

#### T82.1: Pause on Reply Detection [M - 2h]
**Files:** `api/email/webhook.ts`, `src/services/SequenceEnrollmentService.ts`

**Description:** When SendGrid webhook reports a reply (or we detect via inbound parse), auto-pause the enrollment.

**Validation:**
- [ ] Reply webhook → enrollment paused
- [ ] Prospect status updated to 'replied'
- [ ] No more sequence emails sent

**Commit:** `feat(sequences): pause enrollment on reply`

---

#### T82.2: Pause on Bounce [S - 1h]
**Files:** `api/email/webhook.ts`

**Description:** Hard bounce → cancel enrollment, soft bounce → pause for 48h.

**Validation:**
- [ ] Hard bounce → status = 'bounced', no more sends
- [ ] Soft bounce → paused with reason, resumes in 48h

**Commit:** `feat(sequences): handle bounces in sequences`

---

#### T82.3: Pause on Unsubscribe [S - 1h]
**Files:** `api/email/webhook.ts`, `api/email/unsubscribe.ts`

**Description:** If prospect clicks unsubscribe, cancel all active enrollments.

**Validation:**
- [ ] Unsubscribe click → all enrollments cancelled
- [ ] Prospect flagged as 'unsubscribed'
- [ ] Future enrollments blocked for this prospect

**Commit:** `feat(sequences): cancel sequences on unsubscribe`

---

#### T82.4: Add Manual Pause/Resume [S - 1h]
**Files:** `src/components/SequenceManagerPanel.tsx`

**Description:** Allow Jake to manually pause a sequence (e.g., prospect on vacation) with a reason.

**Validation:**
- [ ] Pause button prompts for reason
- [ ] Resume button available for paused enrollments
- [ ] Pause reason shown in UI

**Commit:** `feat(sequences): add manual pause/resume controls`

---

#### T82.5: Skip Weekends Option [S - 1h]
**Files:** `src/services/SequenceSchedulerService.ts`

**Description:** Respect `skipWeekends: true` in sequence config. Shift weekend sends to Monday.

**Validation:**
- [ ] Next send on Saturday → moves to Monday
- [ ] Next send on Sunday → moves to Monday
- [ ] Weekday sends unaffected

**Commit:** `feat(sequences): implement weekend skipping`

---

## 📋 PHASE 2: CLOSE THE LOOP (Sprints 83-84)

### Goal: Know When Prospects Respond

---

### Sprint 83: Reply Detection

**Sprint Goal:** Detect when prospects reply to sequence emails and attribute to the original send.

#### T83.1: Configure SendGrid Inbound Parse [S - 1h]
**Files:** `docs/INBOUND_EMAIL_SETUP.md`

**Description:** Set up SendGrid Inbound Parse to forward replies to our webhook. Configure MX records.

**Validation:**
- [ ] MX records configured for reply subdomain
- [ ] SendGrid Inbound Parse pointing to our endpoint
- [ ] Test email forwarded successfully

**Commit:** `docs: add SendGrid inbound parse setup instructions`

---

#### T83.2: Create Inbound Email Webhook [M - 3h]
**Files:** `api/email/inbound.ts`

**Description:** Receive parsed emails from SendGrid. Extract sender, subject, body, and headers.

```typescript
export default async function handler(req, res) {
  const { from, subject, text, headers } = req.body;
  const inReplyTo = headers['In-Reply-To'];
  // Match to original email and enrollment...
}
```

**Validation:**
- [ ] Webhook receives forwarded emails
- [ ] Parses sender email correctly
- [ ] Extracts In-Reply-To header

**Commit:** `feat(email): add inbound email webhook`

---

#### T83.3: Match Reply to Original Email [M - 2h]
**Files:** `api/email/inbound.ts`, `src/services/EmailMatchingService.ts`

**Description:** Use Message-ID/In-Reply-To headers to link reply to original send. Fall back to sender email matching.

**Validation:**
- [ ] Reply with In-Reply-To → matched to original
- [ ] Reply without header → matched by sender email
- [ ] Unmatched replies logged for review

**Commit:** `feat(email): add reply-to-original matching`

---

#### T83.4: Record Reply Event [S - 1h]
**Files:** `src/services/EmailTrackingService.ts`

**Description:** Store reply event with timestamp, snippet of reply text, and linked emailId.

**Validation:**
- [ ] Reply event stored with prospectId
- [ ] Enrollment status updated to 'replied'
- [ ] Activity log shows reply

**Commit:** `feat(email): record reply events`

---

#### T83.5: Update Prospect Status on Reply [S - 1h]
**Files:** `src/services/SequenceEnrollmentService.ts`

**Description:** When reply detected, update prospect status to 'replied' and pause sequence.

**Validation:**
- [ ] Prospect card shows 'Replied' badge
- [ ] Sequence automatically paused
- [ ] Jake sees reply notification

**Commit:** `feat(sequences): auto-pause and update status on reply`

---

#### T83.6: Add Reply Notification [S - 1h]
**Files:** `src/App.tsx`

**Description:** Toast notification when reply detected. Click to jump to prospect.

**Validation:**
- [ ] Toast appears within 30s of reply
- [ ] Click toast → navigates to prospect
- [ ] Reply visible in activity panel

**Commit:** `feat(email): add reply notification toast`

---

### Sprint 84: Meeting Attribution

**Sprint Goal:** Track when replies lead to meetings and attribute to the sequence/template that caused them.

#### T84.1: Add "Meeting Booked" Quick Action [S - 1h]
**Files:** `src/App.tsx`

**Description:** Button on prospect card to quickly mark meeting booked. Stores date/time of meeting.

**Validation:**
- [ ] Button visible for contacted prospects
- [ ] Click → datepicker for meeting date
- [ ] Status updates to 'meeting_booked'

**Commit:** `feat(prospects): add meeting booked quick action`

---

#### T84.2: Link Meeting to Source Email/Sequence [M - 2h]
**Files:** `src/types/index.ts`, `src/services/MeetingAttributionService.ts`

**Description:** When meeting marked, record which sequence step led to the reply that led to the meeting.

```typescript
interface MeetingAttribution {
  prospectId: string;
  sequenceId: string;
  stepIndex: number;
  templateId: string;
  emailSentAt: number;
  replyReceivedAt: number;
  meetingBookedAt: number;
}
```

**Validation:**
- [ ] Meeting linked to sequence
- [ ] Can query: "Which template gets most meetings?"
- [ ] Attribution data persists

**Commit:** `feat(meetings): add attribution to sequence/template`

---

#### T84.3: Add Meeting Count to Dashboard [S - 1h]
**Files:** `src/App.tsx` dashboard section

**Description:** Show "Meetings This Week" count prominently. The ONE metric that matters.

**Validation:**
- [ ] Count visible on dashboard
- [ ] Updates when meeting booked
- [ ] Shows week-over-week trend

**Commit:** `feat(dashboard): add meetings booked counter`

---

#### T84.4: Add Sequence Performance Report [M - 2h]
**Files:** `src/components/SequencePerformancePanel.tsx`

**Description:** Table showing each sequence's performance: Enrolled → Replied → Meeting conversion rate.

| Sequence | Enrolled | Replied | Meetings | Conv Rate |
|----------|----------|---------|----------|-----------|
| Cold Ops Director | 45 | 12 | 4 | 8.9% |
| CFO Financial | 23 | 5 | 2 | 8.7% |

**Validation:**
- [ ] Table shows all sequences
- [ ] Metrics calculated correctly
- [ ] Sortable by conversion rate

**Commit:** `feat(analytics): add sequence performance report`

---

#### T84.5: Add Template Performance Report [M - 2h]
**Files:** `src/components/TemplatePerformancePanel.tsx`

**Description:** Show which email templates (step 1 vs step 2 vs breakup) perform best.

**Validation:**
- [ ] Shows open/click/reply rates per template
- [ ] Highlights best performer
- [ ] Links to template for editing

**Commit:** `feat(analytics): add template performance report`

---

## 📋 PHASE 3: SPEED UP JAKE (Sprints 85-87)

### Goal: Cut Time Per Prospect by 50%

---

### Sprint 85: Today's Hot List

**Sprint Goal:** Jake opens app and immediately sees who to contact today, no filtering required.

#### T85.1: Create Hot List Algorithm [M - 2h]
**Files:** `src/services/HotListService.ts`

**Description:** Calculate "Today's Top 10" based on: Tier 1-2, 60+ facilities, not contacted in 7 days, highest Primo score.

```typescript
export function getHotList(prospects: Prospect[]): Prospect[] {
  return prospects
    .filter(p => ['Tier 1', 'Tier 2'].includes(p.tier))
    .filter(p => (p.facilities || 0) >= 60)
    .filter(p => !recentlyContacted(p, 7))
    .sort((a, b) => (b.primoScore || 0) - (a.primoScore || 0))
    .slice(0, 10);
}
```

**Validation:**
- [ ] Returns max 10 prospects
- [ ] All returned are Tier 1-2
- [ ] Sorted by Primo score descending

**Commit:** `feat(hotlist): add hot list algorithm`

---

#### T85.2: Add Hot List Widget to Dashboard [M - 2h]
**Files:** `src/App.tsx` or `src/components/HotListWidget.tsx`

**Description:** Prominent card on dashboard showing today's hot list. Click prospect → goes to detail.

**Validation:**
- [ ] Widget visible on dashboard tab
- [ ] Shows prospect name, company, facilities, score
- [ ] Click → selects prospect

**Commit:** `feat(dashboard): add hot list widget`

---

#### T85.3: Add "Work Hot List" Button [S - 1h]
**Files:** `src/App.tsx`

**Description:** One button to start working the hot list. Selects first prospect and opens detail panel.

**Validation:**
- [ ] Button visible and prominent
- [ ] Click → navigates to hitlist → selects first hot prospect
- [ ] Empty state if no hot prospects

**Commit:** `feat(hotlist): add work hot list quick action`

---

#### T85.4: Add Hot List Badge to Prospects [S - 1h]
**Files:** `src/App.tsx`

**Description:** 🔥 icon on prospect row if they're in today's hot list.

**Validation:**
- [ ] Badge appears on hot list prospects
- [ ] Only appears for top 10
- [ ] Visible in both list and company views

**Commit:** `feat(hotlist): add hot badge to prospect rows`

---

### Sprint 86: Keyboard Shortcuts

**Sprint Goal:** Power users can work entirely from keyboard.

#### T86.1: Add Global Keyboard Shortcut Handler [M - 2h]
**Files:** `src/hooks/useKeyboardShortcuts.ts`

**Description:** Listen for keyboard shortcuts globally. Show cheat sheet on `?`.

| Shortcut | Action |
|----------|--------|
| `j` / `k` | Next / Previous prospect |
| `e` | Open email composer |
| `s` | Start sequence |
| `m` | Mark meeting booked |
| `/` | Focus search |
| `?` | Show shortcut help |

**Validation:**
- [ ] Shortcuts work on hitlist view
- [ ] Don't trigger when typing in input
- [ ] Help modal shows on `?`

**Commit:** `feat(a11y): add global keyboard shortcuts`

---

#### T86.2: Add Prospect Navigation Shortcuts [S - 1h]
**Files:** `src/App.tsx`

**Description:** `j`/`k` to move through prospect list. `Enter` to select.

**Validation:**
- [ ] `j` selects next prospect
- [ ] `k` selects previous
- [ ] Selection stays in view (scroll if needed)

**Commit:** `feat(a11y): add prospect navigation shortcuts`

---

#### T86.3: Add Quick Action Shortcuts [S - 1h]
**Files:** `src/App.tsx`

**Description:** `e` to compose email, `s` to start sequence, `m` to book meeting.

**Validation:**
- [ ] `e` opens email composer
- [ ] `s` opens sequence selector
- [ ] `m` opens meeting booker

**Commit:** `feat(a11y): add quick action shortcuts`

---

### Sprint 87: Klaff Template Rewrites

**Sprint Goal:** Rewrite all templates with prizing frame, eliminate weak language.

#### T87.1: Audit Weak Language [S - 1h]
**Files:** `scripts/audit-weak-language.ts`

**Description:** Script to scan all templates for supplication language: "Happy to", "Just following up", "Quick question", "Worth X min?", etc.

**Validation:**
- [ ] Script runs and outputs findings
- [ ] Flags all instances of weak language
- [ ] Outputs count per template

**Commit:** `chore: add weak language audit script`

---

#### T87.2: Rewrite Cold Outreach Templates [M - 3h]
**Files:** `src/services/EmailSequenceService.ts`

**Description:** Rewrite all 5 sequence templates with Klaff prizing frame.

**BEFORE:**
```
Quick question about {{company}} yard operations.
Happy to share how we've helped companies like Primo Brands.
Worth a 15-min call?
```

**AFTER:**
```
{{firstName}} - ran the numbers on {{company}}.

You're likely leaving $180K+/year on the table in detention and yard chaos.
We fixed this for Primo Brands (now at 260 facilities headcount-neutral).

I have a 1-pager on what we did. Want it?

Jake
```

**Validation:**
- [ ] No "Happy to" in any template
- [ ] No "Quick question" in subjects
- [ ] No "Worth X min?" CTAs
- [ ] All templates reviewed by Casey/Jake

**Commit:** `feat(templates): rewrite with Klaff prizing frame`

---

#### T87.3: Rewrite Subject Lines [S - 1h]
**Files:** `src/services/EmailSequenceService.ts`, `src/data/templates.ts`

**BEFORE:**
- "Quick question about {{company}} yard operations"
- "Following up - yard efficiency"
- "One more try"

**AFTER:**
- "$180K - what {{company}} is leaving on the table"
- "What Primo Brands figured out (you haven't)"
- "Closing your file on Friday"

**Validation:**
- [ ] All subjects create intrigue or urgency
- [ ] No question-based subjects
- [ ] A/B test data captured

**Commit:** `feat(templates): rewrite subject lines`

---

#### T87.4: Add Scarcity Elements [S - 1h]
**Files:** `src/services/GeminiService.ts`

**Description:** Add scarcity to AI-generated messages:
- "We're working with 3 companies in your space this quarter"
- "Our implementation team is booked through Q2"

**Validation:**
- [ ] AI templates include scarcity
- [ ] Scarcity rotates (not same every time)
- [ ] Feels authentic, not pushy

**Commit:** `feat(templates): add scarcity elements`

---

#### T87.5: Rewrite Break-Up Email [S - 1h]
**Files:** `src/services/EmailSequenceService.ts`

**BEFORE:**
```
I don't want to be a pest. If yard visibility isn't a priority right now, 
just let me know and I'll close your file.
```

**AFTER:**
```
{{firstName}} -

I'm moving on from {{company}} unless you tell me otherwise.

Most Ops leaders I talk to either (a) know yard chaos is costing them 
$150K+/year and want to fix it, or (b) know it's a problem but aren't 
ready to prioritize it.

Either is fine—but I need to know which one you are.

Quick reply either way?

Jake
```

**Validation:**
- [ ] No apology language
- [ ] Creates loss aversion
- [ ] Still professional, not aggressive

**Commit:** `feat(templates): rewrite break-up email`

---

## 📋 PHASE 4: OPTIMIZE (Sprints 88-89)

### Goal: Learn What Works, Iterate

---

### Sprint 88: A/B Testing Infrastructure

**Sprint Goal:** Run A/B tests on subject lines and templates, auto-promote winners.

#### T88.1: Add A/B Test Schema [M - 2h]
**Files:** `src/types/experiments.ts`

```typescript
interface ABTest {
  id: string;
  name: string;
  variants: {
    id: string;
    name: string;
    weight: number; // 0-100
    content: string;
  }[];
  metric: 'open_rate' | 'reply_rate' | 'meeting_rate';
  status: 'draft' | 'running' | 'completed';
  winner?: string;
}
```

**Validation:**
- [ ] Types compile
- [ ] Can create test with multiple variants
- [ ] Weights sum to 100

**Commit:** `feat(experiments): add A/B test schema`

---

#### T88.2: Add Variant Assignment Logic [M - 2h]
**Files:** `src/services/ExperimentService.ts`

**Description:** When sending email in a test, randomly assign variant based on weights. Record assignment.

**Validation:**
- [ ] Assignment roughly matches weights over 100 sends
- [ ] Same prospect always gets same variant (sticky)
- [ ] Assignment recorded with email

**Commit:** `feat(experiments): add variant assignment logic`

---

#### T88.3: Add A/B Results Calculator [M - 2h]
**Files:** `src/services/ExperimentService.ts`

**Description:** Calculate performance per variant. Determine statistical significance.

**Validation:**
- [ ] Calculates open/reply/meeting rate per variant
- [ ] Shows sample size per variant
- [ ] Indicates when significance reached

**Commit:** `feat(experiments): add results calculator`

---

#### T88.4: Add A/B Test UI [M - 3h]
**Files:** `src/components/ExperimentPanel.tsx`

**Description:** UI to create tests, view results, promote winners.

**Validation:**
- [ ] Can create new test
- [ ] Can view running tests
- [ ] Can promote winner (copies to default template)

**Commit:** `feat(experiments): add A/B test management UI`

---

### Sprint 89: Performance Dashboard

**Sprint Goal:** One dashboard showing what's working and what isn't.

#### T89.1: Create Performance Dashboard Component [M - 3h]
**Files:** `src/components/PerformanceDashboard.tsx`

**Description:** Single view showing:
- Meetings this week/month
- Best performing sequence
- Best performing template
- Reply rate trend
- Hot prospects to work today

**Validation:**
- [ ] All metrics visible
- [ ] Updates in real-time
- [ ] Links to detailed views

**Commit:** `feat(dashboard): add performance dashboard`

---

#### T89.2: Add Email Velocity Chart [S - 1h]
**Files:** `src/components/PerformanceDashboard.tsx`

**Description:** Line chart showing emails sent per day over last 30 days.

**Validation:**
- [ ] Shows last 30 days
- [ ] Updates with new sends
- [ ] Tooltip shows exact count

**Commit:** `feat(dashboard): add email velocity chart`

---

#### T89.3: Add Reply Rate Trend [S - 1h]
**Files:** `src/components/PerformanceDashboard.tsx`

**Description:** Show reply rate trend (up/down arrow) compared to last period.

**Validation:**
- [ ] Shows percentage change
- [ ] Green for improvement, red for decline
- [ ] Compares to previous 30 days

**Commit:** `feat(dashboard): add reply rate trend`

---

## 📋 PHASE 5: CLEAN UP (Sprint 90)

### Goal: Remove Bloat, Improve Maintainability

---

### Sprint 90: Code Cleanup

#### T90.1: Remove PWA/Offline Code [M - 2h]
**Files:** `src/services/PWAService.ts`, `src/services/OfflineQueue.ts`, `src/components/OfflineBanner.tsx`, `vite.config.ts`

**Description:** Jake has internet. Remove PWA complexity.

**Validation:**
- [ ] PWA files deleted
- [ ] Build still works
- [ ] No offline-related errors in console

**Commit:** `chore: remove PWA/offline code`

---

#### T90.2: Remove Presence/Collaboration Code [M - 2h]
**Files:** `src/services/PresenceService.ts`, `src/components/PresenceIndicator.tsx`, `src/hooks/usePresence.ts`

**Description:** Jake works alone. Remove presence tracking.

**Validation:**
- [ ] Presence files deleted
- [ ] Build still works
- [ ] No Firestore presence writes

**Commit:** `chore: remove presence/collaboration code`

---

#### T90.3: Split App.tsx [L - 4h]
**Files:** `src/App.tsx` → multiple smaller components

**Description:** Break up 3000-line App.tsx into logical components:
- `src/pages/HitlistPage.tsx`
- `src/pages/DashboardPage.tsx`
- `src/layouts/MainLayout.tsx`
- `src/components/ProspectDetailPanel.tsx` (move from App)

**Target:** App.tsx under 500 lines.

**Validation:**
- [ ] App.tsx < 500 lines
- [ ] All views still work
- [ ] No functionality lost

**Commit:** `refactor: split App.tsx into pages and components`

---

#### T90.4: Audit and Remove Dead Services [M - 2h]
**Files:** `src/services/*`

**Description:** Identify services that are never imported. Delete them.

**Validation:**
- [ ] Audit script lists unused services
- [ ] Dead services deleted
- [ ] Build still works

**Commit:** `chore: remove dead service files`

---

#### T90.5: Update Documentation [S - 1h]
**Files:** `README.md`

**Description:** Update README to reflect current state. Remove references to deleted features.

**Validation:**
- [ ] README accurate
- [ ] Setup instructions work
- [ ] No references to removed features

**Commit:** `docs: update README for V10`

---

## 📊 SUMMARY

### Sprint Roadmap

| Sprint | Focus | Key Deliverable |
|--------|-------|-----------------|
| 80 | Sequence Execution | Emails auto-send on schedule |
| 81 | Enrollment Management | Jake can enroll prospects |
| 82 | Pause on Events | Sequences pause on reply/bounce |
| 83 | Reply Detection | System knows when prospects reply |
| 84 | Meeting Attribution | Link meetings to templates |
| 85 | Hot List | Jake sees top 10 instantly |
| 86 | Keyboard Shortcuts | Power user efficiency |
| 87 | Klaff Templates | High-converting messaging |
| 88 | A/B Testing | Learn what works |
| 89 | Performance Dashboard | See metrics that matter |
| 90 | Code Cleanup | Remove bloat |

### Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Emails sent/day | Manual | 50+ automated | Sprint 82 |
| Reply detection | None | Real-time | Sprint 83 |
| Time per prospect | 20 min | 10 min | Sprint 87 |
| Template reply rate | Unknown | 5%+ | Sprint 88 |
| Meetings/week | Unknown | 10+ | Sprint 89 |

### Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Sequence sends duplicates | Idempotency keys (T80.6) |
| Reply detection misses emails | Manual "Mark Replied" fallback |
| SendGrid rate limits | Warmup integration, daily caps |
| A/B tests inconclusive | Minimum sample size before declaring winner |
| Template rewrites hurt performance | A/B test old vs new before full rollout |

---

## CHANGELOG

- **V10.0** (2026-01-30): Initial ruthless focus plan
  - Removed all non-essential features from scope
  - Prioritized sequence execution as #1
  - Added Klaff template rewrite sprint
  - Added reply detection before meeting attribution
  - Reduced from 13 sprints to 11 focused sprints

**\# YardFlow GTM Hub \- Sprint Plan V10: RUTHLESS FOCUS**

**\#\# 🎯 THE NORTH STAR**

\> **\*\*Maximize meetings booked per day\*\*** through automated, tracked email sequences with high-converting messaging.

Everything else is noise.

\---

**\#\# EXECUTIVE SUMMARY**

**\#\#\# What We Learned (Socratic Interrogation)**

| Insight | Implication |  
|---------|-------------|  
| **\*\*55 services, 8 tabs, 3000 lines in App.tsx\*\*** | We built features, not workflow |  
| **\*\*Sequence templates exist but don't auto-send\*\*** | Core functionality is broken |  
| **\*\*No reply detection\*\*** | Jake doesn't know when prospects respond |  
| **\*\*No meeting attribution\*\*** | We can't measure what works |  
| **\*\*"Happy to..." appears 8+ times in templates\*\*** | Weak frame, supplication language |  
| **\*\*18-30 min per prospect currently\*\*** | 50% reduction achievable |

**\#\#\# What We're Building (Phases)**

| Phase | Goal | Sprints | Outcome |  
|-------|------|---------|---------|  
| **\*\*Phase 1: Fix The Core\*\*** | Sequences actually send | 80-82 | Emails go out automatically on schedule |  
| **\*\*Phase 2: Close The Loop\*\*** | Know when they reply | 83-84 | Reply detection \+ meeting attribution |  
| **\*\*Phase 3: Speed Up Jake\*\*** | 50% faster workflow | 85-87 | One-click enrollment, Klaff templates, hot list |  
| **\*\*Phase 4: Optimize\*\*** | Learn what works | 88-89 | A/B testing, template performance |  
| **\*\*Phase 5: Clean Up\*\*** | Remove bloat | 90 | Delete unused code, split App.tsx |

**\#\#\# What We're NOT Building**

| Feature | Why Not |  
|---------|---------|  
| AI Chatbot improvements | Jake sends emails, doesn't chat |  
| PWA/Offline enhancements | Jake has internet |  
| Presence/Collaboration | Jake works alone |  
| New dashboard charts | Vanity metrics |  
| HubSpot deep integration | Not proven needed |  
| Mobile optimization | Jake uses desktop |

\---

**\#\# 📋 PHASE 1: FIX THE CORE (Sprints 80-82)**

**\#\#\# Goal: Sequences Actually Execute**

**\*\*Current State:\*\*** EmailSequenceService.ts has beautiful templates. BulkSequenceModal lets you enroll prospects. But **\*\*nothing actually sends the follow-up emails on schedule\*\***.

**\*\*Target State:\*\*** Enroll a prospect → emails send automatically at configured intervals → sequence advances until complete or reply detected.

\---

**\#\#\# Sprint 80: Sequence Execution Engine**

**\*\*Sprint Goal:\*\*** Create the scheduler that checks enrollments and queues due emails.

**\#\#\#\# T80.1: Create SequenceEnrollment Schema \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/types/sequences.ts\`

**\*\*Description:\*\*** Define the data structure for tracking a prospect's progress through a sequence. This is the state machine that powers automation.

\`\`\`typescript  
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
\`\`\`

**\*\*Validation:\*\***  
\- \[ \] Types compile without errors  
\- \[ \] Can create enrollment object matching schema  
\- \[ \] All status transitions documented

**\*\*Commit:\*\*** \`feat(sequences): add SequenceEnrollment type schema\`

\---

**\#\#\#\# T80.2: Create SequenceSchedulerService \[M \- 3h\]**  
**\*\*Files:\*\*** \`src/services/SequenceSchedulerService.ts\`

**\*\*Description:\*\*** The brain of sequence automation. Scans all active enrollments, identifies which ones are due for their next email, and queues them for sending.

\`\`\`typescript  
export class SequenceSchedulerService {  
  // Check all active enrollments, return those due for next step  
  async getDueEnrollments(): Promise\<SequenceEnrollment\[\]\>;  
   
  // Calculate next send time based on step config  
  calculateNextSendAt(enrollment: SequenceEnrollment, step: SequenceStep): number;  
   
  // Queue the next email for an enrollment  
  async queueNextStep(enrollment: SequenceEnrollment): Promise\<void\>;  
   
  // Advance enrollment to next step after successful send  
  async advanceStep(enrollment: SequenceEnrollment): Promise\<void\>;  
   
  // Mark enrollment as complete (all steps done)  
  async completeEnrollment(enrollment: SequenceEnrollment): Promise\<void\>;  
}  
\`\`\`

**\*\*Validation:\*\***  
\- \[ \] Unit tests for \`getDueEnrollments\` with various time scenarios  
\- \[ \] Unit tests for \`calculateNextSendAt\` with weekend skipping  
\- \[ \] Integration test: enroll → wait → verify queued

**\*\*Commit:\*\*** \`feat(sequences): add SequenceSchedulerService\`

\---

**\#\#\#\# T80.3: Add Sequence Execution Cron Endpoint \[M \- 2h\]**  
**\*\*Files:\*\*** \`api/cron/execute-sequences.ts\`

**\*\*Description:\*\*** Vercel cron job that runs every 5 minutes, calls SequenceSchedulerService, and processes due enrollments.

\`\`\`typescript  
// api/cron/execute-sequences.ts  
export default async function handler(req, res) {  
  const scheduler \= getSequenceScheduler();  
  const dueEnrollments \= await scheduler.getDueEnrollments();  
   
  for (const enrollment of dueEnrollments.slice(0, 10)) {  
    await scheduler.queueNextStep(enrollment);  
  }  
   
  return res.json({ processed: dueEnrollments.length });  
}  
\`\`\`

**\*\*Validation:\*\***  
\- \[ \] Endpoint returns 200 with processed count  
\- \[ \] Cron config in vercel.json runs every 5 min  
\- \[ \] Logs show which enrollments were processed

**\*\*Commit:\*\*** \`feat(sequences): add execution cron endpoint\`

\---

**\#\#\#\# T80.4: Wire Enrollment to Email Queue \[M \- 2h\]**  
**\*\*Files:\*\*** \`src/services/SequenceSchedulerService.ts\`, \`src/services/RailwayEmailService.ts\`

**\*\*Description:\*\*** Connect the scheduler output to actual email sending. When an enrollment is due, generate the email from the template and send via Railway.

**\*\*Validation:\*\***  
\- \[ \] Enrollment at step 0 → initial email sent  
\- \[ \] Enrollment at step 1 → follow\_up\_1 sent  
\- \[ \] Email contains correct template with prospect personalization

**\*\*Commit:\*\*** \`feat(sequences): wire scheduler to email queue\`

\---

**\#\#\#\# T80.5: Add Step Advancement After Send \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/services/SequenceSchedulerService.ts\`

**\*\*Description:\*\*** After email successfully sends, increment \`currentStepIndex\` and calculate \`nextSendAt\`. If no more steps, mark enrollment complete.

**\*\*Validation:\*\***  
\- \[ \] Send success → currentStepIndex increments  
\- \[ \] Last step sent → status \= 'completed'  
\- \[ \] Send failure → step not advanced, retries next cycle

**\*\*Commit:\*\*** \`feat(sequences): advance step after successful send\`

\---

**\#\#\#\# T80.6: Add Idempotency Protection \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/services/SequenceSchedulerService.ts\`

**\*\*Description:\*\*** Prevent duplicate sends if cron runs multiple times. Check \`lastSentAt\` before queuing. Add unique key per enrollment+step.

**\*\*Validation:\*\***  
\- \[ \] Same enrollment+step never queued twice  
\- \[ \] Idempotency key stored with each send  
\- \[ \] Duplicate detection logged for monitoring

**\*\*Commit:\*\*** \`feat(sequences): add idempotency protection\`

\---

**\#\#\# Sprint 81: Enrollment Management**

**\*\*Sprint Goal:\*\*** Let Jake enroll prospects in sequences and see enrollment status.

**\#\#\#\# T81.1: Add Enrollment Storage \[M \- 2h\]**  
**\*\*Files:\*\*** \`src/services/SequenceEnrollmentService.ts\`

**\*\*Description:\*\*** CRUD operations for enrollments. Store in localStorage for now (Firebase later if needed).

\`\`\`typescript  
export const SequenceEnrollmentService \= {  
  enroll(prospectId: string, sequenceId: string): SequenceEnrollment;  
  pause(enrollmentId: string, reason: string): void;  
  resume(enrollmentId: string): void;  
  cancel(enrollmentId: string): void;  
  getByProspect(prospectId: string): SequenceEnrollment | null;  
  getAllActive(): SequenceEnrollment\[\];  
};  
\`\`\`

**\*\*Validation:\*\***  
\- \[ \] Can enroll prospect  
\- \[ \] Can pause/resume/cancel  
\- \[ \] Data persists across page reload

**\*\*Commit:\*\*** \`feat(sequences): add enrollment storage service\`

\---

**\#\#\#\# T81.2: Add Sequence Badge to Prospect Card \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/App.tsx\`

**\*\*Description:\*\*** Show enrollment status on prospect row. Visual indicator: 📧 enrolled, ⏸️ paused, ✅ completed.

**\*\*Validation:\*\***  
\- \[ \] Badge appears for enrolled prospects  
\- \[ \] Badge shows current step (e.g., "Step 2/4")  
\- \[ \] Different icons for paused/completed

**\*\*Commit:\*\*** \`feat(sequences): add enrollment badge to prospect card\`

\---

**\#\#\#\# T81.3: Add One-Click Enroll Button \[M \- 2h\]**  
**\*\*Files:\*\*** \`src/App.tsx\` or \`src/components/ProspectDetailPanel.tsx\`

**\*\*Description:\*\*** In prospect detail, add "Start Sequence" dropdown that shows available sequences. One click to enroll.

**\*\*Validation:\*\***  
\- \[ \] Dropdown shows all sequences  
\- \[ \] Click sequence → prospect enrolled  
\- \[ \] Success toast shows first email time

**\*\*Commit:\*\*** \`feat(sequences): add one-click enroll button\`

\---

**\#\#\#\# T81.4: Add Bulk Enrollment Action \[M \- 2h\]**  
**\*\*Files:\*\*** \`src/components/BulkSequenceModal.tsx\`

**\*\*Description:\*\*** Update existing bulk modal to actually create enrollments, not just log intent.

**\*\*Validation:\*\***  
\- \[ \] Select 5 prospects → Start sequence → 5 enrollments created  
\- \[ \] First emails queued for all 5  
\- \[ \] Progress indicator shows enrollment count

**\*\*Commit:\*\*** \`feat(sequences): wire bulk enrollment to create actual enrollments\`

\---

**\#\#\#\# T81.5: Add Sequence Management View \[M \- 3h\]**  
**\*\*Files:\*\*** \`src/components/SequenceManagerPanel.tsx\`

**\*\*Description:\*\*** Simple panel showing all active enrollments. Columns: Prospect, Sequence, Step, Next Send, Status. Actions: Pause, Resume, Cancel.

**\*\*Validation:\*\***  
\- \[ \] Lists all active enrollments  
\- \[ \] Can filter by sequence  
\- \[ \] Can pause/resume from UI

**\*\*Commit:\*\*** \`feat(sequences): add sequence manager panel\`

\---

**\#\#\# Sprint 82: Pause on Events**

**\*\*Sprint Goal:\*\*** Auto-pause sequences when prospect replies, bounces, or unsubscribes.

**\#\#\#\# T82.1: Pause on Reply Detection \[M \- 2h\]**  
**\*\*Files:\*\*** \`api/email/webhook.ts\`, \`src/services/SequenceEnrollmentService.ts\`

**\*\*Description:\*\*** When SendGrid webhook reports a reply (or we detect via inbound parse), auto-pause the enrollment.

**\*\*Validation:\*\***  
\- \[ \] Reply webhook → enrollment paused  
\- \[ \] Prospect status updated to 'replied'  
\- \[ \] No more sequence emails sent

**\*\*Commit:\*\*** \`feat(sequences): pause enrollment on reply\`

\---

**\#\#\#\# T82.2: Pause on Bounce \[S \- 1h\]**  
**\*\*Files:\*\*** \`api/email/webhook.ts\`

**\*\*Description:\*\*** Hard bounce → cancel enrollment, soft bounce → pause for 48h.

**\*\*Validation:\*\***  
\- \[ \] Hard bounce → status \= 'bounced', no more sends  
\- \[ \] Soft bounce → paused with reason, resumes in 48h

**\*\*Commit:\*\*** \`feat(sequences): handle bounces in sequences\`

\---

**\#\#\#\# T82.3: Pause on Unsubscribe \[S \- 1h\]**  
**\*\*Files:\*\*** \`api/email/webhook.ts\`, \`api/email/unsubscribe.ts\`

**\*\*Description:\*\*** If prospect clicks unsubscribe, cancel all active enrollments.

**\*\*Validation:\*\***  
\- \[ \] Unsubscribe click → all enrollments cancelled  
\- \[ \] Prospect flagged as 'unsubscribed'  
\- \[ \] Future enrollments blocked for this prospect

**\*\*Commit:\*\*** \`feat(sequences): cancel sequences on unsubscribe\`

\---

**\#\#\#\# T82.4: Add Manual Pause/Resume \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/components/SequenceManagerPanel.tsx\`

**\*\*Description:\*\*** Allow Jake to manually pause a sequence (e.g., prospect on vacation) with a reason.

**\*\*Validation:\*\***  
\- \[ \] Pause button prompts for reason  
\- \[ \] Resume button available for paused enrollments  
\- \[ \] Pause reason shown in UI

**\*\*Commit:\*\*** \`feat(sequences): add manual pause/resume controls\`

\---

**\#\#\#\# T82.5: Skip Weekends Option \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/services/SequenceSchedulerService.ts\`

**\*\*Description:\*\*** Respect \`skipWeekends: true\` in sequence config. Shift weekend sends to Monday.

**\*\*Validation:\*\***  
\- \[ \] Next send on Saturday → moves to Monday  
\- \[ \] Next send on Sunday → moves to Monday  
\- \[ \] Weekday sends unaffected

**\*\*Commit:\*\*** \`feat(sequences): implement weekend skipping\`

\---

**\#\# 📋 PHASE 2: CLOSE THE LOOP (Sprints 83-84)**

**\#\#\# Goal: Know When Prospects Respond**

\---

**\#\#\# Sprint 83: Reply Detection**

**\*\*Sprint Goal:\*\*** Detect when prospects reply to sequence emails and attribute to the original send.

**\#\#\#\# T83.1: Configure SendGrid Inbound Parse \[S \- 1h\]**  
**\*\*Files:\*\*** \`docs/INBOUND\_EMAIL\_SETUP.md\`

**\*\*Description:\*\*** Set up SendGrid Inbound Parse to forward replies to our webhook. Configure MX records.

**\*\*Validation:\*\***  
\- \[ \] MX records configured for reply subdomain  
\- \[ \] SendGrid Inbound Parse pointing to our endpoint  
\- \[ \] Test email forwarded successfully

**\*\*Commit:\*\*** \`docs: add SendGrid inbound parse setup instructions\`

\---

**\#\#\#\# T83.2: Create Inbound Email Webhook \[M \- 3h\]**  
**\*\*Files:\*\*** \`api/email/inbound.ts\`

**\*\*Description:\*\*** Receive parsed emails from SendGrid. Extract sender, subject, body, and headers.

\`\`\`typescript  
export default async function handler(req, res) {  
  const { from, subject, text, headers } \= req.body;  
  const inReplyTo \= headers\['In-Reply-To'\];  
  // Match to original email and enrollment...  
}  
\`\`\`

**\*\*Validation:\*\***  
\- \[ \] Webhook receives forwarded emails  
\- \[ \] Parses sender email correctly  
\- \[ \] Extracts In-Reply-To header

**\*\*Commit:\*\*** \`feat(email): add inbound email webhook\`

\---

**\#\#\#\# T83.3: Match Reply to Original Email \[M \- 2h\]**  
**\*\*Files:\*\*** \`api/email/inbound.ts\`, \`src/services/EmailMatchingService.ts\`

**\*\*Description:\*\*** Use Message-ID/In-Reply-To headers to link reply to original send. Fall back to sender email matching.

**\*\*Validation:\*\***  
\- \[ \] Reply with In-Reply-To → matched to original  
\- \[ \] Reply without header → matched by sender email  
\- \[ \] Unmatched replies logged for review

**\*\*Commit:\*\*** \`feat(email): add reply-to-original matching\`

\---

**\#\#\#\# T83.4: Record Reply Event \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/services/EmailTrackingService.ts\`

**\*\*Description:\*\*** Store reply event with timestamp, snippet of reply text, and linked emailId.

**\*\*Validation:\*\***  
\- \[ \] Reply event stored with prospectId  
\- \[ \] Enrollment status updated to 'replied'  
\- \[ \] Activity log shows reply

**\*\*Commit:\*\*** \`feat(email): record reply events\`

\---

**\#\#\#\# T83.5: Update Prospect Status on Reply \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/services/SequenceEnrollmentService.ts\`

**\*\*Description:\*\*** When reply detected, update prospect status to 'replied' and pause sequence.

**\*\*Validation:\*\***  
\- \[ \] Prospect card shows 'Replied' badge  
\- \[ \] Sequence automatically paused  
\- \[ \] Jake sees reply notification

**\*\*Commit:\*\*** \`feat(sequences): auto-pause and update status on reply\`

\---

**\#\#\#\# T83.6: Add Reply Notification \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/App.tsx\`

**\*\*Description:\*\*** Toast notification when reply detected. Click to jump to prospect.

**\*\*Validation:\*\***  
\- \[ \] Toast appears within 30s of reply  
\- \[ \] Click toast → navigates to prospect  
\- \[ \] Reply visible in activity panel

**\*\*Commit:\*\*** \`feat(email): add reply notification toast\`

\---

**\#\#\# Sprint 84: Meeting Attribution**

**\*\*Sprint Goal:\*\*** Track when replies lead to meetings and attribute to the sequence/template that caused them.

**\#\#\#\# T84.1: Add "Meeting Booked" Quick Action \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/App.tsx\`

**\*\*Description:\*\*** Button on prospect card to quickly mark meeting booked. Stores date/time of meeting.

**\*\*Validation:\*\***  
\- \[ \] Button visible for contacted prospects  
\- \[ \] Click → datepicker for meeting date  
\- \[ \] Status updates to 'meeting\_booked'

**\*\*Commit:\*\*** \`feat(prospects): add meeting booked quick action\`

\---

**\#\#\#\# T84.2: Link Meeting to Source Email/Sequence \[M \- 2h\]**  
**\*\*Files:\*\*** \`src/types/index.ts\`, \`src/services/MeetingAttributionService.ts\`

**\*\*Description:\*\*** When meeting marked, record which sequence step led to the reply that led to the meeting.

\`\`\`typescript  
interface MeetingAttribution {  
  prospectId: string;  
  sequenceId: string;  
  stepIndex: number;  
  templateId: string;  
  emailSentAt: number;  
  replyReceivedAt: number;  
  meetingBookedAt: number;  
}  
\`\`\`

**\*\*Validation:\*\***  
\- \[ \] Meeting linked to sequence  
\- \[ \] Can query: "Which template gets most meetings?"  
\- \[ \] Attribution data persists

**\*\*Commit:\*\*** \`feat(meetings): add attribution to sequence/template\`

\---

**\#\#\#\# T84.3: Add Meeting Count to Dashboard \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/App.tsx\` dashboard section

**\*\*Description:\*\*** Show "Meetings This Week" count prominently. The ONE metric that matters.

**\*\*Validation:\*\***  
\- \[ \] Count visible on dashboard  
\- \[ \] Updates when meeting booked  
\- \[ \] Shows week-over-week trend

**\*\*Commit:\*\*** \`feat(dashboard): add meetings booked counter\`

\---

**\#\#\#\# T84.4: Add Sequence Performance Report \[M \- 2h\]**  
**\*\*Files:\*\*** \`src/components/SequencePerformancePanel.tsx\`

**\*\*Description:\*\*** Table showing each sequence's performance: Enrolled → Replied → Meeting conversion rate.

| Sequence | Enrolled | Replied | Meetings | Conv Rate |  
|----------|----------|---------|----------|-----------|  
| Cold Ops Director | 45 | 12 | 4 | 8.9% |  
| CFO Financial | 23 | 5 | 2 | 8.7% |

**\*\*Validation:\*\***  
\- \[ \] Table shows all sequences  
\- \[ \] Metrics calculated correctly  
\- \[ \] Sortable by conversion rate

**\*\*Commit:\*\*** \`feat(analytics): add sequence performance report\`

\---

**\#\#\#\# T84.5: Add Template Performance Report \[M \- 2h\]**  
**\*\*Files:\*\*** \`src/components/TemplatePerformancePanel.tsx\`

**\*\*Description:\*\*** Show which email templates (step 1 vs step 2 vs breakup) perform best.

**\*\*Validation:\*\***  
\- \[ \] Shows open/click/reply rates per template  
\- \[ \] Highlights best performer  
\- \[ \] Links to template for editing

**\*\*Commit:\*\*** \`feat(analytics): add template performance report\`

\---

**\#\# 📋 PHASE 3: SPEED UP JAKE (Sprints 85-87)**

**\#\#\# Goal: Cut Time Per Prospect by 50%**

\---

**\#\#\# Sprint 85: Today's Hot List**

**\*\*Sprint Goal:\*\*** Jake opens app and immediately sees who to contact today, no filtering required.

**\#\#\#\# T85.1: Create Hot List Algorithm \[M \- 2h\]**  
**\*\*Files:\*\*** \`src/services/HotListService.ts\`

**\*\*Description:\*\*** Calculate "Today's Top 10" based on: Tier 1-2, 60+ facilities, not contacted in 7 days, highest Primo score.

\`\`\`typescript  
export function getHotList(prospects: Prospect\[\]): Prospect\[\] {  
  return prospects  
    .filter(p \=\> \['Tier 1', 'Tier 2'\].includes(p.tier))  
    .filter(p \=\> (p.facilities || 0) \>= 60)  
    .filter(p \=\> \!recentlyContacted(p, 7))  
    .sort((a, b) \=\> (b.primoScore || 0) \- (a.primoScore || 0))  
    .slice(0, 10);  
}  
\`\`\`

**\*\*Validation:\*\***  
\- \[ \] Returns max 10 prospects  
\- \[ \] All returned are Tier 1-2  
\- \[ \] Sorted by Primo score descending

**\*\*Commit:\*\*** \`feat(hotlist): add hot list algorithm\`

\---

**\#\#\#\# T85.2: Add Hot List Widget to Dashboard \[M \- 2h\]**  
**\*\*Files:\*\*** \`src/App.tsx\` or \`src/components/HotListWidget.tsx\`

**\*\*Description:\*\*** Prominent card on dashboard showing today's hot list. Click prospect → goes to detail.

**\*\*Validation:\*\***  
\- \[ \] Widget visible on dashboard tab  
\- \[ \] Shows prospect name, company, facilities, score  
\- \[ \] Click → selects prospect

**\*\*Commit:\*\*** \`feat(dashboard): add hot list widget\`

\---

**\#\#\#\# T85.3: Add "Work Hot List" Button \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/App.tsx\`

**\*\*Description:\*\*** One button to start working the hot list. Selects first prospect and opens detail panel.

**\*\*Validation:\*\***  
\- \[ \] Button visible and prominent  
\- \[ \] Click → navigates to hitlist → selects first hot prospect  
\- \[ \] Empty state if no hot prospects

**\*\*Commit:\*\*** \`feat(hotlist): add work hot list quick action\`

\---

**\#\#\#\# T85.4: Add Hot List Badge to Prospects \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/App.tsx\`

**\*\*Description:\*\*** 🔥 icon on prospect row if they're in today's hot list.

**\*\*Validation:\*\***  
\- \[ \] Badge appears on hot list prospects  
\- \[ \] Only appears for top 10  
\- \[ \] Visible in both list and company views

**\*\*Commit:\*\*** \`feat(hotlist): add hot badge to prospect rows\`

\---

**\#\#\# Sprint 86: Keyboard Shortcuts**

**\*\*Sprint Goal:\*\*** Power users can work entirely from keyboard.

**\#\#\#\# T86.1: Add Global Keyboard Shortcut Handler \[M \- 2h\]**  
**\*\*Files:\*\*** \`src/hooks/useKeyboardShortcuts.ts\`

**\*\*Description:\*\*** Listen for keyboard shortcuts globally. Show cheat sheet on \`?\`.

| Shortcut | Action |  
|----------|--------|  
| \`j\` / \`k\` | Next / Previous prospect |  
| \`e\` | Open email composer |  
| \`s\` | Start sequence |  
| \`m\` | Mark meeting booked |  
| \`/\` | Focus search |  
| \`?\` | Show shortcut help |

**\*\*Validation:\*\***  
\- \[ \] Shortcuts work on hitlist view  
\- \[ \] Don't trigger when typing in input  
\- \[ \] Help modal shows on \`?\`

**\*\*Commit:\*\*** \`feat(a11y): add global keyboard shortcuts\`

\---

**\#\#\#\# T86.2: Add Prospect Navigation Shortcuts \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/App.tsx\`

**\*\*Description:\*\*** \`j\`/\`k\` to move through prospect list. \`Enter\` to select.

**\*\*Validation:\*\***  
\- \[ \] \`j\` selects next prospect  
\- \[ \] \`k\` selects previous  
\- \[ \] Selection stays in view (scroll if needed)

**\*\*Commit:\*\*** \`feat(a11y): add prospect navigation shortcuts\`

\---

**\#\#\#\# T86.3: Add Quick Action Shortcuts \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/App.tsx\`

**\*\*Description:\*\*** \`e\` to compose email, \`s\` to start sequence, \`m\` to book meeting.

**\*\*Validation:\*\***  
\- \[ \] \`e\` opens email composer  
\- \[ \] \`s\` opens sequence selector  
\- \[ \] \`m\` opens meeting booker

**\*\*Commit:\*\*** \`feat(a11y): add quick action shortcuts\`

\---

**\#\#\# Sprint 87: Klaff Template Rewrites**

**\*\*Sprint Goal:\*\*** Rewrite all templates with prizing frame, eliminate weak language.

**\#\#\#\# T87.1: Audit Weak Language \[S \- 1h\]**  
**\*\*Files:\*\*** \`scripts/audit-weak-language.ts\`

**\*\*Description:\*\*** Script to scan all templates for supplication language: "Happy to", "Just following up", "Quick question", "Worth X min?", etc.

**\*\*Validation:\*\***  
\- \[ \] Script runs and outputs findings  
\- \[ \] Flags all instances of weak language  
\- \[ \] Outputs count per template

**\*\*Commit:\*\*** \`chore: add weak language audit script\`

\---

**\#\#\#\# T87.2: Rewrite Cold Outreach Templates \[M \- 3h\]**  
**\*\*Files:\*\*** \`src/services/EmailSequenceService.ts\`

**\*\*Description:\*\*** Rewrite all 5 sequence templates with Klaff prizing frame.

**\*\*BEFORE:\*\***  
\`\`\`  
Quick question about {{company}} yard operations.  
Happy to share how we've helped companies like Primo Brands.  
Worth a 15-min call?  
\`\`\`

**\*\*AFTER:\*\***  
\`\`\`  
{{firstName}} \- ran the numbers on {{company}}.

You're likely leaving $180K+/year on the table in detention and yard chaos.  
We fixed this for Primo Brands (now at 260 facilities headcount-neutral).

I have a 1-pager on what we did. Want it?

Jake  
\`\`\`

**\*\*Validation:\*\***  
\- \[ \] No "Happy to" in any template  
\- \[ \] No "Quick question" in subjects  
\- \[ \] No "Worth X min?" CTAs  
\- \[ \] All templates reviewed by Casey/Jake

**\*\*Commit:\*\*** \`feat(templates): rewrite with Klaff prizing frame\`

\---

**\#\#\#\# T87.3: Rewrite Subject Lines \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/services/EmailSequenceService.ts\`, \`src/data/templates.ts\`

**\*\*BEFORE:\*\***  
\- "Quick question about {{company}} yard operations"  
\- "Following up \- yard efficiency"  
\- "One more try"

**\*\*AFTER:\*\***  
\- "$180K \- what {{company}} is leaving on the table"  
\- "What Primo Brands figured out (you haven't)"  
\- "Closing your file on Friday"

**\*\*Validation:\*\***  
\- \[ \] All subjects create intrigue or urgency  
\- \[ \] No question-based subjects  
\- \[ \] A/B test data captured

**\*\*Commit:\*\*** \`feat(templates): rewrite subject lines\`

\---

**\#\#\#\# T87.4: Add Scarcity Elements \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/services/GeminiService.ts\`

**\*\*Description:\*\*** Add scarcity to AI-generated messages:  
\- "We're working with 3 companies in your space this quarter"  
\- "Our implementation team is booked through Q2"

**\*\*Validation:\*\***  
\- \[ \] AI templates include scarcity  
\- \[ \] Scarcity rotates (not same every time)  
\- \[ \] Feels authentic, not pushy

**\*\*Commit:\*\*** \`feat(templates): add scarcity elements\`

\---

**\#\#\#\# T87.5: Rewrite Break-Up Email \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/services/EmailSequenceService.ts\`

**\*\*BEFORE:\*\***  
\`\`\`  
I don't want to be a pest. If yard visibility isn't a priority right now,  
just let me know and I'll close your file.  
\`\`\`

**\*\*AFTER:\*\***  
\`\`\`  
{{firstName}} \-

I'm moving on from {{company}} unless you tell me otherwise.

Most Ops leaders I talk to either (a) know yard chaos is costing them  
$150K+/year and want to fix it, or (b) know it's a problem but aren't  
ready to prioritize it.

Either is fine—but I need to know which one you are.

Quick reply either way?

Jake  
\`\`\`

**\*\*Validation:\*\***  
\- \[ \] No apology language  
\- \[ \] Creates loss aversion  
\- \[ \] Still professional, not aggressive

**\*\*Commit:\*\*** \`feat(templates): rewrite break-up email\`

\---

**\#\# 📋 PHASE 4: OPTIMIZE (Sprints 88-89)**

**\#\#\# Goal: Learn What Works, Iterate**

\---

**\#\#\# Sprint 88: A/B Testing Infrastructure**

**\*\*Sprint Goal:\*\*** Run A/B tests on subject lines and templates, auto-promote winners.

**\#\#\#\# T88.1: Add A/B Test Schema \[M \- 2h\]**  
**\*\*Files:\*\*** \`src/types/experiments.ts\`

\`\`\`typescript  
interface ABTest {  
  id: string;  
  name: string;  
  variants: {  
    id: string;  
    name: string;  
    weight: number; // 0-100  
    content: string;  
  }\[\];  
  metric: 'open\_rate' | 'reply\_rate' | 'meeting\_rate';  
  status: 'draft' | 'running' | 'completed';  
  winner?: string;  
}  
\`\`\`

**\*\*Validation:\*\***  
\- \[ \] Types compile  
\- \[ \] Can create test with multiple variants  
\- \[ \] Weights sum to 100

**\*\*Commit:\*\*** \`feat(experiments): add A/B test schema\`

\---

**\#\#\#\# T88.2: Add Variant Assignment Logic \[M \- 2h\]**  
**\*\*Files:\*\*** \`src/services/ExperimentService.ts\`

**\*\*Description:\*\*** When sending email in a test, randomly assign variant based on weights. Record assignment.

**\*\*Validation:\*\***  
\- \[ \] Assignment roughly matches weights over 100 sends  
\- \[ \] Same prospect always gets same variant (sticky)  
\- \[ \] Assignment recorded with email

**\*\*Commit:\*\*** \`feat(experiments): add variant assignment logic\`

\---

**\#\#\#\# T88.3: Add A/B Results Calculator \[M \- 2h\]**  
**\*\*Files:\*\*** \`src/services/ExperimentService.ts\`

**\*\*Description:\*\*** Calculate performance per variant. Determine statistical significance.

**\*\*Validation:\*\***  
\- \[ \] Calculates open/reply/meeting rate per variant  
\- \[ \] Shows sample size per variant  
\- \[ \] Indicates when significance reached

**\*\*Commit:\*\*** \`feat(experiments): add results calculator\`

\---

**\#\#\#\# T88.4: Add A/B Test UI \[M \- 3h\]**  
**\*\*Files:\*\*** \`src/components/ExperimentPanel.tsx\`

**\*\*Description:\*\*** UI to create tests, view results, promote winners.

**\*\*Validation:\*\***  
\- \[ \] Can create new test  
\- \[ \] Can view running tests  
\- \[ \] Can promote winner (copies to default template)

**\*\*Commit:\*\*** \`feat(experiments): add A/B test management UI\`

\---

**\#\#\# Sprint 89: Performance Dashboard**

**\*\*Sprint Goal:\*\*** One dashboard showing what's working and what isn't.

**\#\#\#\# T89.1: Create Performance Dashboard Component \[M \- 3h\]**  
**\*\*Files:\*\*** \`src/components/PerformanceDashboard.tsx\`

**\*\*Description:\*\*** Single view showing:  
\- Meetings this week/month  
\- Best performing sequence  
\- Best performing template  
\- Reply rate trend  
\- Hot prospects to work today

**\*\*Validation:\*\***  
\- \[ \] All metrics visible  
\- \[ \] Updates in real-time  
\- \[ \] Links to detailed views

**\*\*Commit:\*\*** \`feat(dashboard): add performance dashboard\`

\---

**\#\#\#\# T89.2: Add Email Velocity Chart \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/components/PerformanceDashboard.tsx\`

**\*\*Description:\*\*** Line chart showing emails sent per day over last 30 days.

**\*\*Validation:\*\***  
\- \[ \] Shows last 30 days  
\- \[ \] Updates with new sends  
\- \[ \] Tooltip shows exact count

**\*\*Commit:\*\*** \`feat(dashboard): add email velocity chart\`

\---

**\#\#\#\# T89.3: Add Reply Rate Trend \[S \- 1h\]**  
**\*\*Files:\*\*** \`src/components/PerformanceDashboard.tsx\`

**\*\*Description:\*\*** Show reply rate trend (up/down arrow) compared to last period.

**\*\*Validation:\*\***  
\- \[ \] Shows percentage change  
\- \[ \] Green for improvement, red for decline  
\- \[ \] Compares to previous 30 days

**\*\*Commit:\*\*** \`feat(dashboard): add reply rate trend\`

\---

**\#\# 📋 PHASE 5: CLEAN UP (Sprint 90\)**

**\#\#\# Goal: Remove Bloat, Improve Maintainability**

\---

**\#\#\# Sprint 90: Code Cleanup**

**\#\#\#\# T90.1: Remove PWA/Offline Code \[M \- 2h\]**  
**\*\*Files:\*\*** \`src/services/PWAService.ts\`, \`src/services/OfflineQueue.ts\`, \`src/components/OfflineBanner.tsx\`, \`vite.config.ts\`

**\*\*Description:\*\*** Jake has internet. Remove PWA complexity.

**\*\*Validation:\*\***  
\- \[ \] PWA files deleted  
\- \[ \] Build still works  
\- \[ \] No offline-related errors in console

**\*\*Commit:\*\*** \`chore: remove PWA/offline code\`

\---

**\#\#\#\# T90.2: Remove Presence/Collaboration Code \[M \- 2h\]**  
**\*\*Files:\*\*** \`src/services/PresenceService.ts\`, \`src/components/PresenceIndicator.tsx\`, \`src/hooks/usePresence.ts\`

**\*\*Description:\*\*** Jake works alone. Remove presence tracking.

**\*\*Validation:\*\***  
\- \[ \] Presence files deleted  
\- \[ \] Build still works  
\- \[ \] No Firestore presence writes

**\*\*Commit:\*\*** \`chore: remove presence/collaboration code\`

\---

**\#\#\#\# T90.3: Split App.tsx \[L \- 4h\]**  
**\*\*Files:\*\*** \`src/App.tsx\` → multiple smaller components

**\*\*Description:\*\*** Break up 3000-line App.tsx into logical components:  
\- \`src/pages/HitlistPage.tsx\`  
\- \`src/pages/DashboardPage.tsx\`  
\- \`src/layouts/MainLayout.tsx\`  
\- \`src/components/ProspectDetailPanel.tsx\` (move from App)

**\*\*Target:\*\*** App.tsx under 500 lines.

**\*\*Validation:\*\***  
\- \[ \] App.tsx \< 500 lines  
\- \[ \] All views still work  
\- \[ \] No functionality lost

**\*\*Commit:\*\*** \`refactor: split App.tsx into pages and components\`

\---

**\#\#\#\# T90.4: Audit and Remove Dead Services \[M \- 2h\]**  
**\*\*Files:\*\*** \`src/services/\*\`

**\*\*Description:\*\*** Identify services that are never imported. Delete them.

**\*\*Validation:\*\***  
\- \[ \] Audit script lists unused services  
\- \[ \] Dead services deleted  
\- \[ \] Build still works

**\*\*Commit:\*\*** \`chore: remove dead service files\`

\---

**\#\#\#\# T90.5: Update Documentation \[S \- 1h\]**  
**\*\*Files:\*\*** \`README.md\`

**\*\*Description:\*\*** Update README to reflect current state. Remove references to deleted features.

**\*\*Validation:\*\***  
\- \[ \] README accurate  
\- \[ \] Setup instructions work  
\- \[ \] No references to removed features

**\*\*Commit:\*\*** \`docs: update README for V10\`

\---

**\#\# 📊 SUMMARY**

**\#\#\# Sprint Roadmap**

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

**\#\#\# Success Metrics**

| Metric | Current | Target | Timeline |  
|--------|---------|--------|----------|  
| Emails sent/day | Manual | 50+ automated | Sprint 82 |  
| Reply detection | None | Real-time | Sprint 83 |  
| Time per prospect | 20 min | 10 min | Sprint 87 |  
| Template reply rate | Unknown | 5%+ | Sprint 88 |  
| Meetings/week | Unknown | 10+ | Sprint 89 |

**\#\#\# Risk Mitigations**

| Risk | Mitigation |  
|------|------------|  
| Sequence sends duplicates | Idempotency keys (T80.6) |  
| Reply detection misses emails | Manual "Mark Replied" fallback |  
| SendGrid rate limits | Warmup integration, daily caps |  
| A/B tests inconclusive | Minimum sample size before declaring winner |  
| Template rewrites hurt performance | A/B test old vs new before full rollout |

\---

**\#\# CHANGELOG**

\- **\*\*V10.0\*\*** (2026-01-30): Initial ruthless focus plan  
  \- Removed all non-essential features from scope  
  \- Prioritized sequence execution as \#1  
  \- Added Klaff template rewrite sprint  
  \- Added reply detection before meeting attribution  
  \- Reduced from 13 sprints to 11 focused sprints

![][image1]

[image1]: <data:image/png;base64,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>
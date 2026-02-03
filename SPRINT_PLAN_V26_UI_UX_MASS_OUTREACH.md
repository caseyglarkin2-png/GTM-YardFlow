# Sprint Plan V26: UI/UX Mass Outreach Enablement

**Status**: 🚀 READY TO EXECUTE  
**Created**: February 3, 2026  
**Goal**: Enable Jake to "start slinging" – high-volume personalized outreach for Manifest 2026  
**North Star**: Send 50+ emails with Pepsi/Luis and Co-Dev messaging, see sequence status, manage tags

---

## Executive Summary

### Current State
- ✅ Railway S2S auth working (POST route fix just deployed)
- ✅ Sequences, Tags, Bulk Actions infrastructure exists
- ✅ Email templates in `sequenceTemplates.ts`
- ⚠️ Companies view has width issues
- ⚠️ Sequence visibility poor (no dashboard widget)
- ⚠️ Tags UX unclear (vs +add prospect)
- ⚠️ Missing Pepsi/Luis and Co-Dev messaging frames

### Sprint Priorities

| Sprint | Focus | Est. Time | Demoable Outcome |
|--------|-------|-----------|------------------|
| **26** | Email Engine Validation | 2 hours | Send bulk email, see success toast |
| **27** | Messaging Templates | 2 hours | Pepsi/Luis + Co-Dev templates ready |
| **28** | Companies View Polish | 1.5 hours | Companies column widths fixed |
| **29** | Sequence Visibility | 2.5 hours | Dashboard widget + status badges |
| **30** | Tags UX Improvement | 2 hours | Clear UX, filtering, visual indicators |
| **31** | Quick Wins & Polish | 1.5 hours | Console errors fixed, loading states |

**Total**: ~11.5 hours (2-3 days sprint)

---

## Messaging Framing Reference

### Frame 1: Pepsi/Luis Style (Short, Punchy, Metrics-Driven)
```
Luis, how are the yard pilots going?
Know a YNS pilot rolled to~25 bottle water facilities by EOY25.
Avg. incremental margins conservatively over $1M/per pilot facility. 4% more 53's/day on avg.
Would love to see what it can do for Pepsi
```

**Pattern**: First name hook → Industry proof point → Specific metrics → Company-specific CTA

### Frame 2: Co-Dev Invite (Social Proof + Scarcity)
```
{First_name},
Are gates the most common problem for the ~x-facilities in your Network?

We received confirmation earlier this week that our Yard Network System works for Primo.

[TESTIMONIAL BLOCK with quote from customer about volume handling and dock office optimization]

Conservative estimate?
4%+ volume outperformance by FreightRoll-enabled facilities
= $30M+ incremental EBITDA 💰
or $1M+ incremental margin/facility 🚀

Have a hunch we can deliver similar results for {company_name}.

If you will be at Manifest, can book time with our CEO Jake to learn more here.

He will be holding court in the meeting rooms on Monday and the 1:1 Meeting Zone on Tuesday.

Best,
FreightRoll
```

**Pattern**: Pain question → Social proof → Testimonial → Specific metrics → Scarcity (Manifest availability)

---

## Sprint 26: Email Engine Validation (2 hours)

**Goal**: Verify the POST route fix works E2E  
**Demo**: Select 5 prospects → Bulk email → See success toast with count

---

### T26.1: Verify Railway POST Route [XS - 15 min]

**Files:** Terminal commands (no code changes)

**Description:** Verify the deployed POST route fix works by sending a test request.

**Validation:**
```bash
# Test the POST route directly
curl -X POST "https://yardflow-hitlist-production-2f41.up.railway.app/api/email/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $RAILWAY_API_SECRET" \
  -d '{
    "to": "test@yardflow.com",
    "subject": "E2E Test",
    "body": "Test body",
    "prospectId": "test-1"
  }' | jq .
```

**Exit Criteria:**
- [ ] Returns 200 with `{ id: "...", status: "queued" }`
- [ ] No 404 or method not allowed errors

**Commit:** `test: verify Railway POST route fix`

---

### T26.2: Create E2E Email Test Script [S - 30 min]

**Files:** Create `scripts/test-bulk-email-e2e.ts`

**Description:** Script to test the full email flow from GTM-YardFlow perspective.

**Implementation:**
```typescript
// scripts/test-bulk-email-e2e.ts
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeApp } from 'firebase/app';

const TEST_EMAIL = process.env.TEST_EMAIL || 'jake@freightroll.com';

async function testBulkEmail() {
  console.log('🚀 Testing bulk email flow...');
  
  // 1. Get Firebase token
  const app = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  });
  
  const auth = getAuth(app);
  const userCred = await signInWithEmailAndPassword(
    auth, 
    process.env.TEST_USER_EMAIL!, 
    process.env.TEST_USER_PASSWORD!
  );
  const token = await userCred.user.getIdToken();
  console.log('✅ Got Firebase token');
  
  // 2. Send via Vercel proxy (simulates browser flow)
  const res = await fetch('https://gtm-yard-flow.vercel.app/api/railway/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: TEST_EMAIL,
      subject: `E2E Test ${new Date().toISOString()}`,
      body: '<h1>Test</h1><p>If you see this, the email engine works!</p>',
      prospectId: 'e2e-test-1',
      trackOpens: true,
    }),
  });
  
  const data = await res.json();
  console.log('📤 Response:', data);
  
  if (res.ok) {
    console.log('✅ Email sent successfully!');
    console.log('📧 Message ID:', data.id);
  } else {
    console.error('❌ Failed:', data);
    process.exit(1);
  }
}

testBulkEmail().catch(console.error);
```

**Tests:**
- Script completes without error
- Returns message ID

**Validation:**
- [ ] `npx tsx scripts/test-bulk-email-e2e.ts` succeeds
- [ ] Email appears in test inbox

**Commit:** `test: add E2E bulk email test script`

---

### T26.3: Add Progress Indicator to BulkEmailModal [S - 30 min]

**Files:** `src/components/BulkEmailModal.tsx`

**Description:** Show real-time progress during batch send.

**Implementation:**
```tsx
// Add to BulkEmailModal component state
const [sendProgress, setSendProgress] = useState({ sent: 0, failed: 0, total: 0 });

// In the send handler, update progress
const handleSend = async () => {
  setIsSending(true);
  setSendProgress({ sent: 0, failed: 0, total: selectedProspects.length });
  
  for (let i = 0; i < selectedProspects.length; i++) {
    try {
      await sendEmail(selectedProspects[i]);
      setSendProgress(prev => ({ ...prev, sent: prev.sent + 1 }));
    } catch {
      setSendProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
    }
  }
  
  setIsSending(false);
};

// Add progress bar UI
{isSending && (
  <div className="mt-4 space-y-2">
    <div className="flex justify-between text-sm text-slate-600">
      <span>Sending emails...</span>
      <span>{sendProgress.sent + sendProgress.failed}/{sendProgress.total}</span>
    </div>
    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
      <div 
        className="h-full bg-blue-600 transition-all duration-300"
        style={{ width: `${((sendProgress.sent + sendProgress.failed) / sendProgress.total) * 100}%` }}
      />
    </div>
    {sendProgress.failed > 0 && (
      <p className="text-sm text-red-600">{sendProgress.failed} failed</p>
    )}
  </div>
)}
```

**Tests:**
```typescript
it('shows progress bar during batch send', async () => {
  render(<BulkEmailModal isOpen={true} prospects={mockProspects} ... />);
  await userEvent.click(screen.getByRole('button', { name: /send/i }));
  expect(screen.getByText(/sending emails/i)).toBeInTheDocument();
});
```

**Validation:**
- [ ] Progress bar appears during send
- [ ] Progress updates in real-time
- [ ] Failed count shows if any fail

**Commit:** `feat(email): add progress indicator to bulk email modal`

---

### T26.4: Add Error Handling with Retry [S - 30 min]

**Files:** `src/components/BulkEmailModal.tsx`

**Description:** Show failed emails with retry option.

**Implementation:**
```tsx
// State for tracking failures
const [failedEmails, setFailedEmails] = useState<BatchEmailItem[]>([]);

// After send completes
{!isSending && failedEmails.length > 0 && (
  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
    <div className="flex items-center gap-2 text-red-800">
      <AlertCircle className="h-5 w-5" />
      <span className="font-medium">{failedEmails.length} emails failed</span>
    </div>
    <button
      onClick={() => retryFailed(failedEmails)}
      className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
    >
      Retry failed emails
    </button>
  </div>
)}
```

**Tests:**
```typescript
it('shows retry button when emails fail', async () => {
  mockSendEmail.mockRejectedValueOnce(new Error('Network error'));
  render(<BulkEmailModal ... />);
  await userEvent.click(screen.getByRole('button', { name: /send/i }));
  await waitFor(() => {
    expect(screen.getByText(/retry failed/i)).toBeInTheDocument();
  });
});
```

**Validation:**
- [ ] Failed emails tracked correctly
- [ ] Retry button retries only failed emails
- [ ] Success toast shows final count

**Commit:** `feat(email): add retry for failed bulk emails`

---

### T26.5: Add Success Toast with Metrics [XS - 15 min]

**Files:** `src/components/BulkEmailModal.tsx`

**Description:** Show success toast with sent count and any failures.

**Implementation:**
```tsx
// After send completes
if (sendProgress.failed === 0) {
  toast.success(`🚀 Sent ${sendProgress.sent} emails successfully!`);
} else {
  toast.warning(
    `Sent ${sendProgress.sent}/${sendProgress.total} emails. ${sendProgress.failed} failed.`,
    { duration: 5000 }
  );
}
```

**Validation:**
- [ ] Toast shows after all emails sent
- [ ] Toast includes correct counts
- [ ] Warning style for partial failures

**Commit:** `feat(email): add success toast with metrics`

---

## Sprint 27: Messaging Templates (2 hours)

**Goal**: Add Pepsi/Luis and Co-Dev messaging frames  
**Demo**: Select sequence → See new templates with proper framing

---

### T27.1: Add Pepsi/Luis Style Template [S - 30 min]

**Files:** `src/data/sequenceTemplates.ts`

**Description:** Add the short, punchy, metrics-driven template.

**Implementation:**
```typescript
// Add to MANIFEST_SEQUENCES array
{
  id: 'manifest-pepsi-style',
  name: 'Manifest: Metrics-Driven Cold (Pepsi Style)',
  description: 'Short, punchy outreach with specific metrics. Best for ops leaders.',
  category: 'manifest_outreach',
  persona: 'ops_director',
  usageCount: 0,
  tags: ['manifest', 'q1_2026', 'cold', 'metrics'],
  steps: [
    {
      delayDays: 0,
      type: 'initial',
      subjectTemplate: '{{firstName}}, quick yard question',
      bodyTemplate: `{{firstName}}, how are the yard pilots going at {{company}}?

Know a YNS pilot rolled to ~25 bottled water facilities by EOY25.

Avg. incremental margins conservatively over $1M/per pilot facility.
4% more 53's/day on avg.

Would love to see what it can do for {{company}}.

Will be at Manifest in the meeting rooms Monday + 1:1 zone Tuesday.

Best,
Jake`,
    },
    {
      delayDays: 3,
      type: 'follow_up_1',
      subjectTemplate: 'Re: {{firstName}}, quick yard question',
      bodyTemplate: `{{firstName}},

Quick bump on this - curious if yard efficiency is on the radar for {{company}} this year?

The 4% volume lift we're seeing at Primo facilities translates to real dollars.

Worth a quick chat at Manifest?

Jake`,
    },
    {
      delayDays: 7,
      type: 'break_up',
      subjectTemplate: 'Closing loop',
      bodyTemplate: `{{firstName}},

Haven't heard back so I'll assume timing isn't right.

Taking you off my Manifest invite list - reach out if that changes.

Jake`,
    },
  ],
},
```

**Tests:**
```typescript
it('includes pepsi-style template with 3 steps', () => {
  const template = MANIFEST_SEQUENCES.find(s => s.id === 'manifest-pepsi-style');
  expect(template).toBeDefined();
  expect(template?.steps.length).toBe(3);
  expect(template?.steps[0].bodyTemplate).toContain('$1M');
});
```

**Validation:**
- [ ] Template appears in BulkSequenceModal dropdown
- [ ] Preview shows correct messaging
- [ ] Variables replaced correctly

**Commit:** `feat(sequences): add Pepsi/Luis style metrics-driven template`

---

### T27.2: Add Co-Dev Invite Template [M - 45 min]

**Files:** `src/data/sequenceTemplates.ts`

**Description:** Add the social proof + scarcity template with testimonial block.

**Implementation:**
```typescript
{
  id: 'manifest-co-dev-invite',
  name: 'Manifest: Co-Development Invite (Social Proof)',
  description: 'Primo testimonial + Manifest scarcity. Best for executives.',
  category: 'manifest_outreach',
  persona: 'c_suite',
  usageCount: 0,
  tags: ['manifest', 'q1_2026', 'social_proof', 'scarcity'],
  steps: [
    {
      delayDays: 0,
      type: 'initial',
      subjectTemplate: 'Co-development partner for {{company}}?',
      bodyTemplate: `{{firstName}},

Are gates the most common problem for the facilities in your network?

We received confirmation earlier this week that our Yard Network System works for Primo.

<div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; margin: 16px 0; font-style: italic;">
"Ever since they installed the YNS, they've exceeded volume. It was phenomenal. Even the people in the dock office, they're saying this thing is amazing - it tells us when trucks are available."
<br/>— Primo Brands Facility Manager
</div>

Conservative estimate?
• 4%+ volume outperformance by FreightRoll-enabled facilities
• = $30M+ incremental EBITDA 💰
• = $1M+ incremental margin/facility 🚀

Have a hunch we can deliver similar results for {{company}}.

If you'll be at Manifest, I'd love to grab time to discuss.

I'll be holding court in the meeting rooms on Monday and the 1:1 Meeting Zone on Tuesday: {{calendly_link}}

Best,
Jake
FreightRoll`,
    },
    {
      delayDays: 4,
      type: 'follow_up_1',
      subjectTemplate: 'Re: Co-development partner for {{company}}?',
      bodyTemplate: `{{firstName}},

Bubbling this up - are you considering any yard tech investments for {{company}} this year?

The Primo results speak for themselves: $1M+ incremental margin per facility.

Happy to walk through the case study at Manifest.

Jake`,
    },
    {
      delayDays: 8,
      type: 'follow_up_2',
      subjectTemplate: 'Manifest room availability',
      bodyTemplate: `{{firstName}},

Quick note - my meeting room slots for Monday at Manifest are filling up.

If {{company}} is evaluating yard solutions, I'd love to include you in the co-development cohort.

Book here before I'm fully booked: {{calendly_link}}

Jake`,
    },
    {
      delayDays: 12,
      type: 'break_up',
      subjectTemplate: 'Removing from list',
      bodyTemplate: `{{firstName}},

Haven't connected, so I'll close the loop on the co-development invite.

If yard ops becomes a priority for {{company}}, you know where to find me.

Jake`,
    },
  ],
},
```

**Tests:**
```typescript
it('includes co-dev template with testimonial block', () => {
  const template = MANIFEST_SEQUENCES.find(s => s.id === 'manifest-co-dev-invite');
  expect(template).toBeDefined();
  expect(template?.steps[0].bodyTemplate).toContain('Primo Brands');
  expect(template?.steps[0].bodyTemplate).toContain('$30M');
  expect(template?.steps.length).toBe(4);
});
```

**Validation:**
- [ ] Template appears in dropdown
- [ ] Testimonial block renders with styling
- [ ] Scarcity messaging present

**Commit:** `feat(sequences): add Co-Dev invite template with Primo testimonial`

---

### T27.3: Add Manifest Gate-Problem Template [S - 30 min]

**Files:** `src/data/sequenceTemplates.ts`

**Description:** Template focused on gate problems (the common pain point).

**Implementation:**
```typescript
{
  id: 'manifest-gate-problem',
  name: 'Manifest: Gate Problem Hook',
  description: 'Leads with gate problem question. Good for facility managers.',
  category: 'manifest_outreach',
  persona: 'facility_manager',
  usageCount: 0,
  tags: ['manifest', 'q1_2026', 'pain_point'],
  steps: [
    {
      delayDays: 0,
      type: 'initial',
      subjectTemplate: 'Gate backup at {{company}}?',
      bodyTemplate: `{{firstName}},

Quick question: is gate congestion still one of the top 3 problems at your facilities?

We just rolled out a system at Primo Brands that cut gate dwell time by 40%.

Carriers love it (faster turns), and your dock team gets real-time visibility.

Worth 15 min at Manifest to see if it fits {{company}}?

Jake`,
    },
    {
      delayDays: 3,
      type: 'follow_up_1',
      subjectTemplate: 'Re: Gate backup at {{company}}?',
      bodyTemplate: `{{firstName}},

Curious if you saw my note about gate congestion.

The before/after at Primo facilities is pretty dramatic - happy to share the case study.

Free Monday at Manifest?

Jake`,
    },
  ],
},
```

**Validation:**
- [ ] Template appears in dropdown
- [ ] Gate problem messaging prominent

**Commit:** `feat(sequences): add gate-problem hook template`

---

### T27.4: Update Template Preview with Rich Formatting [S - 30 min]

**Files:** `src/components/BulkSequenceModal.tsx`

**Description:** Show HTML preview for templates with rich formatting.

**Implementation:**
```tsx
// Template preview section
{selectedTemplate && (
  <div className="mt-4 p-4 bg-slate-50 rounded-lg">
    <h4 className="text-sm font-medium text-slate-700 mb-2">Preview</h4>
    <div className="text-sm text-slate-600">
      <p className="font-medium">Subject: {selectedTemplate.steps[0].subjectTemplate}</p>
      <div 
        className="mt-2 prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ 
          __html: renderTemplatePreview(selectedTemplate.steps[0].bodyTemplate, mockProspect) 
        }}
      />
    </div>
    <div className="mt-3 flex gap-2 text-xs text-slate-500">
      <span className="px-2 py-1 bg-slate-200 rounded">{selectedTemplate.steps.length} steps</span>
      <span className="px-2 py-1 bg-slate-200 rounded">
        ~{calculateSequenceDuration(selectedTemplate)} days
      </span>
    </div>
  </div>
)}

// Helper function
function renderTemplatePreview(template: string, prospect: Partial<Prospect>): string {
  return template
    .replace(/\{\{firstName\}\}/g, prospect.firstName || 'John')
    .replace(/\{\{company\}\}/g, prospect.company || 'Acme Corp')
    .replace(/\{\{calendly_link\}\}/g, '<a href="#">[Calendly Link]</a>');
}
```

**Validation:**
- [ ] HTML templates render with styling
- [ ] Variables replaced with sample data
- [ ] Step count and duration shown

**Commit:** `feat(sequences): add rich template preview`

---

### T27.5: Add Template Category Filter [XS - 15 min]

**Files:** `src/components/BulkSequenceModal.tsx`

**Description:** Filter templates by category (Manifest, Cold, etc.)

**Implementation:**
```tsx
const [categoryFilter, setCategoryFilter] = useState<string>('all');

const filteredTemplates = useMemo(() => {
  if (categoryFilter === 'all') return templates;
  return templates.filter(t => t.category === categoryFilter);
}, [templates, categoryFilter]);

// Category filter UI
<div className="flex gap-2 mb-4">
  {['all', 'manifest_outreach', 'cold_outreach'].map(cat => (
    <button
      key={cat}
      onClick={() => setCategoryFilter(cat)}
      className={`px-3 py-1 text-xs rounded-full ${
        categoryFilter === cat 
          ? 'bg-blue-600 text-white' 
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {cat === 'all' ? 'All' : cat.replace('_', ' ')}
    </button>
  ))}
</div>
```

**Validation:**
- [ ] Filter buttons appear
- [ ] Clicking filters templates correctly
- [ ] "All" shows all templates

**Commit:** `feat(sequences): add template category filter`

---

## Sprint 28: Companies View Polish (1.5 hours)

**Goal**: Fix column width issues in Companies view  
**Demo**: Company names show full text or proper truncation with tooltip

---

### T28.1: Audit Current Column Widths [XS - 10 min]

**Files:** `src/components/CompanyListView.tsx`

**Description:** Identify the current width constraints causing truncation.

**Analysis needed:**
- Current `flex-1` on company name column
- Fixed widths on other columns: `w-14`, `w-12`, `w-20`
- Total available space calculation

**Commit:** No commit (analysis only)

---

### T28.2: Increase Company Name Column Width [S - 30 min]

**Files:** `src/components/CompanyListView.tsx`

**Description:** Give company name more room by adjusting flex proportions.

**Implementation:**
```tsx
// Current header
<span className="flex-1">Company</span>  // flex-1 = equal share

// Change to min-width approach
<span className="flex-1 min-w-[200px]">Company</span>

// Also reduce fixed widths where possible
<span className="w-12 text-center">Tier</span>  // was w-14
<span className="w-10 text-center"><Users /></span>  // was w-12
<span className="w-12 text-center"><Building2 /></span>  // was w-14
<span className="w-10 text-center">Gate?</span>  // was w-12
<span className="w-16 text-right">ROI</span>  // was w-20
<span className="w-10 text-center"><Zap /></span>  // was w-12
```

**Validation:**
- [ ] Company names have more horizontal space
- [ ] No column overlap
- [ ] Responsive behavior maintained

**Commit:** `fix(ui): increase company name column width`

---

### T28.3: Add Text Truncation with Tooltip [S - 30 min]

**Files:** `src/components/CompanyListView.tsx`

**Description:** Truncate long company names with tooltip showing full text.

**Implementation:**
```tsx
// Create reusable tooltip component
function TruncatedText({ text, maxWidth = 200 }: { text: string; maxWidth?: number }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    if (textRef.current) {
      setIsTruncated(textRef.current.scrollWidth > textRef.current.clientWidth);
    }
  }, [text]);

  return (
    <span className="relative inline-block" style={{ maxWidth }}>
      <span
        ref={textRef}
        className="block truncate"
        onMouseEnter={() => isTruncated && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {text}
      </span>
      {showTooltip && (
        <span className="absolute z-50 left-0 top-full mt-1 px-2 py-1 text-xs bg-slate-900 text-white rounded shadow-lg whitespace-nowrap">
          {text}
        </span>
      )}
    </span>
  );
}

// Use in company row
<TruncatedText text={company.name} maxWidth={220} />
```

**Tests:**
```typescript
it('shows tooltip on hover for long company names', async () => {
  render(<TruncatedText text="Very Long Company Name That Gets Truncated Inc." maxWidth={100} />);
  await userEvent.hover(screen.getByText(/very long/i));
  await waitFor(() => {
    expect(screen.getByText(/Inc\./)).toBeInTheDocument();
  });
});
```

**Validation:**
- [ ] Long names truncate with ellipsis
- [ ] Tooltip appears on hover
- [ ] Short names don't show tooltip

**Commit:** `feat(ui): add truncated text with tooltip for company names`

---

### T28.4: Improve Responsive Behavior [S - 30 min]

**Files:** `src/components/CompanyListView.tsx`

**Description:** Hide less important columns on smaller screens.

**Implementation:**
```tsx
// Header with responsive visibility
<div className="flex items-center gap-2 text-[11px]">
  <span className="w-6" />
  <span className="flex-1 min-w-[200px]">Company</span>
  <span className="w-12 text-center">Tier</span>
  <span className="w-10 text-center hidden md:block"><Users /></span>
  <span className="w-12 text-center"><Building2 /></span>
  <span className="w-10 text-center hidden lg:block">Gate?</span>
  <span className="w-16 text-right">ROI</span>
  <span className="w-10 text-center hidden lg:block"><Zap /></span>
</div>

// Same for data rows - hide matching columns
```

**Validation:**
- [ ] On medium screens, contacts column hides
- [ ] On large screens, all columns visible
- [ ] Company name always visible

**Commit:** `fix(ui): improve responsive column visibility`

---

### T28.5: Add Horizontal Scroll Indicator [XS - 15 min]

**Files:** `src/components/CompanyListView.tsx`

**Description:** Add visual indicator when table can scroll horizontally.

**Implementation:**
```tsx
// Add gradient fade on scroll
<div className="relative overflow-x-auto">
  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
  {/* Table content */}
</div>
```

**Validation:**
- [ ] Fade visible when content overflows
- [ ] Scrolling works smoothly

**Commit:** `feat(ui): add scroll indicator to companies view`

---

## Sprint 29: Sequence Visibility & Management (2.5 hours)

**Goal**: Show sequence status prominently  
**Demo**: Dashboard shows active sequences, prospect cards show enrollment status

---

### T29.1: Create ActiveSequencesWidget Component [M - 45 min]

**Files:** Create `src/components/ActiveSequencesWidget.tsx`

**Description:** Dashboard widget showing current sequence activity.

**Implementation:**
```tsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Mail, Play, Pause, CheckCircle } from 'lucide-react';

interface SequenceStats {
  active: number;
  paused: number;
  completed: number;
  totalSent: number;
}

export function ActiveSequencesWidget() {
  const [stats, setStats] = useState<SequenceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const enrollmentsRef = collection(db, 'sequenceEnrollments');
      
      const [activeSnap, pausedSnap, completedSnap] = await Promise.all([
        getDocs(query(enrollmentsRef, where('status', '==', 'active'))),
        getDocs(query(enrollmentsRef, where('status', '==', 'paused'))),
        getDocs(query(enrollmentsRef, where('status', '==', 'completed'))),
      ]);

      setStats({
        active: activeSnap.size,
        paused: pausedSnap.size,
        completed: completedSnap.size,
        totalSent: completedSnap.docs.reduce((acc, doc) => acc + (doc.data().stepsSent || 0), 0),
      });
      setIsLoading(false);
    }

    fetchStats();
  }, []);

  if (isLoading) {
    return <div className="animate-pulse bg-slate-100 h-32 rounded-lg" />;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
        <Mail className="h-4 w-4 text-blue-600" />
        Sequence Activity
      </h3>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-green-600">
            <Play className="h-4 w-4" />
            <span className="text-2xl font-bold">{stats?.active || 0}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Active</p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-yellow-600">
            <Pause className="h-4 w-4" />
            <span className="text-2xl font-bold">{stats?.paused || 0}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Paused</p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-blue-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-2xl font-bold">{stats?.completed || 0}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Completed</p>
        </div>
      </div>
      
      <div className="mt-4 pt-3 border-t border-slate-100 text-center">
        <span className="text-xs text-slate-500">
          {stats?.totalSent || 0} emails sent via sequences
        </span>
      </div>
    </div>
  );
}
```

**Tests:**
```typescript
it('displays sequence stats correctly', async () => {
  mockFirestore({ active: 5, paused: 2, completed: 10 });
  render(<ActiveSequencesWidget />);
  await waitFor(() => {
    expect(screen.getByText('5')).toBeInTheDocument(); // Active
  });
});
```

**Validation:**
- [ ] Widget shows active/paused/completed counts
- [ ] Loading state works
- [ ] Real data from Firestore

**Commit:** `feat(dashboard): add active sequences widget`

---

### T29.2: Add Widget to Dashboard [XS - 15 min]

**Files:** `src/components/DashboardLayout.tsx` or `src/App.tsx`

**Description:** Wire the widget into the dashboard grid.

**Implementation:**
```tsx
import { ActiveSequencesWidget } from './ActiveSequencesWidget';

// In dashboard grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <ActiveSequencesWidget />
  {/* Other widgets */}
</div>
```

**Validation:**
- [ ] Widget appears on dashboard
- [ ] Responsive layout works

**Commit:** `feat(dashboard): wire active sequences widget`

---

### T29.3: Add Enrollment Status Badge to Prospect Cards [S - 30 min]

**Files:** `src/components/ProspectCard.tsx` or prospect row component

**Description:** Show visual badge when prospect is enrolled in sequence.

**Implementation:**
```tsx
// Status badge component
function EnrollmentBadge({ status }: { status: EnrollmentStatus | undefined }) {
  if (!status) return null;
  
  const config = {
    active: { color: 'bg-green-100 text-green-700', icon: Play, label: 'In Sequence' },
    paused: { color: 'bg-yellow-100 text-yellow-700', icon: Pause, label: 'Paused' },
    completed: { color: 'bg-blue-100 text-blue-700', icon: CheckCircle, label: 'Done' },
    replied: { color: 'bg-purple-100 text-purple-700', icon: Mail, label: 'Replied' },
    meeting: { color: 'bg-orange-100 text-orange-700', icon: Calendar, label: 'Meeting' },
  }[status];
  
  if (!config) return null;
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${config.color}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// In prospect row
<EnrollmentBadge status={prospect.enrollmentStatus} />
```

**Tests:**
```typescript
it('shows active badge for enrolled prospects', () => {
  render(<EnrollmentBadge status="active" />);
  expect(screen.getByText('In Sequence')).toBeInTheDocument();
});
```

**Validation:**
- [ ] Badge appears on enrolled prospects
- [ ] Colors match status
- [ ] Clicking badge could open sequence details (future)

**Commit:** `feat(ui): add enrollment status badge to prospect cards`

---

### T29.4: Add Quick Pause/Resume Actions [M - 45 min]

**Files:** `src/components/ProspectCard.tsx`, `src/services/EmailSequenceService.ts`

**Description:** Right-click or hover menu to pause/resume enrollment.

**Implementation:**
```tsx
// Quick actions dropdown
function EnrollmentActions({ 
  prospectId, 
  enrollmentId, 
  status 
}: { 
  prospectId: string; 
  enrollmentId: string; 
  status: EnrollmentStatus 
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePause = async () => {
    setIsLoading(true);
    await updateDoc(doc(db, 'sequenceEnrollments', enrollmentId), {
      status: 'paused',
      pausedAt: serverTimestamp(),
    });
    toast.success('Sequence paused');
    setIsLoading(false);
  };

  const handleResume = async () => {
    setIsLoading(true);
    await updateDoc(doc(db, 'sequenceEnrollments', enrollmentId), {
      status: 'active',
      resumedAt: serverTimestamp(),
    });
    toast.success('Sequence resumed');
    setIsLoading(false);
  };

  return (
    <div className="flex gap-1">
      {status === 'active' && (
        <button
          onClick={handlePause}
          disabled={isLoading}
          className="p-1 text-slate-400 hover:text-yellow-600 transition-colors"
          title="Pause sequence"
        >
          <Pause className="h-4 w-4" />
        </button>
      )}
      {status === 'paused' && (
        <button
          onClick={handleResume}
          disabled={isLoading}
          className="p-1 text-slate-400 hover:text-green-600 transition-colors"
          title="Resume sequence"
        >
          <Play className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
```

**Tests:**
```typescript
it('pauses active enrollment on click', async () => {
  render(<EnrollmentActions status="active" enrollmentId="enr-1" prospectId="p-1" />);
  await userEvent.click(screen.getByTitle('Pause sequence'));
  expect(mockUpdateDoc).toHaveBeenCalledWith(expect.any(Object), {
    status: 'paused',
    pausedAt: expect.any(Object),
  });
});
```

**Validation:**
- [ ] Pause button shows for active enrollments
- [ ] Resume button shows for paused enrollments
- [ ] Actions update Firestore correctly

**Commit:** `feat(sequences): add quick pause/resume actions`

---

### T29.5: Add Sequence Activity Feed [S - 30 min]

**Files:** Create `src/components/SequenceActivityFeed.tsx`

**Description:** Recent sequence events (sends, opens, replies).

**Implementation:**
```tsx
export function SequenceActivityFeed({ limit = 10 }: { limit?: number }) {
  const [events, setEvents] = useState<SequenceEvent[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'sequenceEvents'),
      orderBy('timestamp', 'desc'),
      limit(limit)
    );
    
    return onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as SequenceEvent)));
    });
  }, [limit]);

  return (
    <div className="space-y-2">
      {events.map(event => (
        <div key={event.id} className="flex items-center gap-2 text-sm text-slate-600">
          <span className="text-slate-400">{formatRelativeTime(event.timestamp)}</span>
          <span>{event.message}</span>
        </div>
      ))}
    </div>
  );
}
```

**Validation:**
- [ ] Real-time updates via onSnapshot
- [ ] Events show with relative time
- [ ] Limit prop works

**Commit:** `feat(dashboard): add sequence activity feed`

---

## Sprint 30: Tags UX Improvement (2 hours)

**Goal**: Clarify tags UX, add filtering, visual indicators  
**Demo**: User understands tags vs +add, can filter by tag, sees tags on rows

---

### T30.1: Add Tooltip Explaining Tags vs Add Prospect [S - 30 min]

**Files:** `src/components/BulkActionsToolbar.tsx`

**Description:** Add info tooltip explaining the difference.

**Implementation:**
```tsx
import { Tooltip } from '@/components/ui/Tooltip';
import { HelpCircle } from 'lucide-react';

// Near the Tags button
<div className="flex items-center gap-1">
  <button onClick={() => setShowTagModal(true)} className="...">
    <Tag className="h-4 w-4" />
    <span>Add Tags</span>
  </button>
  <Tooltip content="Tags organize existing prospects. Use +Add to create new prospects from scratch.">
    <HelpCircle className="h-4 w-4 text-slate-400 cursor-help" />
  </Tooltip>
</div>
```

**Tests:**
```typescript
it('shows tooltip explaining tags vs add', async () => {
  render(<BulkActionsToolbar selectedCount={5} ... />);
  await userEvent.hover(screen.getByRole('button', { name: /help/i }));
  expect(screen.getByText(/organize existing prospects/i)).toBeInTheDocument();
});
```

**Validation:**
- [ ] Tooltip appears on hover
- [ ] Explanation is clear
- [ ] Doesn't obstruct other UI

**Commit:** `feat(ux): add tooltip explaining tags vs add prospect`

---

### T30.2: Add Tag Filter to Prospect List [M - 45 min]

**Files:** `src/components/FilterBar.tsx` or create `src/components/TagFilter.tsx`

**Description:** Dropdown to filter prospects by tag.

**Implementation:**
```tsx
export function TagFilter({ 
  availableTags, 
  selectedTags, 
  onTagsChange 
}: TagFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-slate-50"
      >
        <Tag className="h-4 w-4" />
        <span>
          {selectedTags.length > 0 ? `${selectedTags.length} tags` : 'Filter by tag'}
        </span>
        <ChevronDown className="h-3 w-3" />
      </button>
      
      {isOpen && (
        <div className="absolute top-full mt-1 left-0 bg-white border rounded-lg shadow-lg p-2 min-w-[200px] z-50">
          {availableTags.map(tag => (
            <label key={tag} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={selectedTags.includes(tag)}
                onChange={() => {
                  if (selectedTags.includes(tag)) {
                    onTagsChange(selectedTags.filter(t => t !== tag));
                  } else {
                    onTagsChange([...selectedTags, tag]);
                  }
                }}
              />
              <span className="text-sm">{tag}</span>
            </label>
          ))}
          
          {selectedTags.length > 0 && (
            <button
              onClick={() => onTagsChange([])}
              className="w-full mt-2 px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

**Tests:**
```typescript
it('filters prospects when tag selected', async () => {
  const onTagsChange = vi.fn();
  render(<TagFilter availableTags={['Hot', 'Cold']} selectedTags={[]} onTagsChange={onTagsChange} />);
  await userEvent.click(screen.getByText('Filter by tag'));
  await userEvent.click(screen.getByText('Hot'));
  expect(onTagsChange).toHaveBeenCalledWith(['Hot']);
});
```

**Validation:**
- [ ] Dropdown shows available tags
- [ ] Selecting tag filters list
- [ ] Clear button resets filter

**Commit:** `feat(ui): add tag filter to prospect list`

---

### T30.3: Add Tag Indicators on Prospect Rows [S - 30 min]

**Files:** `src/components/ProspectRow.tsx` or similar

**Description:** Show visual tag pills on prospect rows.

**Implementation:**
```tsx
// In prospect row component
{prospect.tags && prospect.tags.length > 0 && (
  <div className="flex flex-wrap gap-1 mt-1">
    {prospect.tags.slice(0, 3).map(tag => (
      <span 
        key={tag} 
        className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600 rounded"
      >
        {tag}
      </span>
    ))}
    {prospect.tags.length > 3 && (
      <span className="text-[10px] text-slate-400">+{prospect.tags.length - 3}</span>
    )}
  </div>
)}
```

**Tests:**
```typescript
it('shows first 3 tags with overflow indicator', () => {
  render(<ProspectRow prospect={{ tags: ['A', 'B', 'C', 'D', 'E'] }} />);
  expect(screen.getByText('A')).toBeInTheDocument();
  expect(screen.getByText('+2')).toBeInTheDocument();
});
```

**Validation:**
- [ ] Tags appear below prospect info
- [ ] Truncated at 3 with +N indicator
- [ ] Consistent styling

**Commit:** `feat(ui): add tag indicators on prospect rows`

---

### T30.4: Add Smart Tag Suggestions [S - 30 min]

**Files:** `src/components/BulkTagModal.tsx`

**Description:** Suggest tags based on selected prospects' tier/persona.

**Implementation:**
```tsx
// Add suggestions section to BulkTagModal
const suggestedTags = useMemo(() => {
  const suggestions: string[] = [];
  
  // If all selected are Tier 1
  if (selectedProspects.every(p => p.tier === 'T1')) {
    suggestions.push('Tier 1 Priority', 'Hot Lead');
  }
  
  // If all are C-suite
  if (selectedProspects.every(p => p.title?.match(/CEO|CFO|COO|VP/i))) {
    suggestions.push('Decision Maker', 'Budget Holder');
  }
  
  // If Manifest attendees
  if (selectedProspects.some(p => p.event === 'Manifest 2026')) {
    suggestions.push('Manifest 2026');
  }
  
  return suggestions.filter(s => !selectedTags.has(s));
}, [selectedProspects, selectedTags]);

// Render suggestions
{suggestedTags.length > 0 && (
  <div className="mb-4">
    <p className="text-xs text-slate-500 mb-2">Suggested tags:</p>
    <div className="flex flex-wrap gap-2">
      {suggestedTags.map(tag => (
        <button
          key={tag}
          onClick={() => toggleTag(tag)}
          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
        >
          + {tag}
        </button>
      ))}
    </div>
  </div>
)}
```

**Validation:**
- [ ] Suggestions appear based on selection
- [ ] Clicking adds to selected
- [ ] Already-selected not shown

**Commit:** `feat(tags): add smart tag suggestions based on tier/persona`

---

### T30.5: Add Tag Color Coding [XS - 15 min]

**Files:** `src/utils/tagColors.ts`, `src/components/ProspectRow.tsx`

**Description:** Color-code tags by type for quick visual scanning.

**Implementation:**
```typescript
// src/utils/tagColors.ts
export const TAG_COLORS: Record<string, string> = {
  'Tier 1 Priority': 'bg-orange-100 text-orange-700',
  'Hot Lead': 'bg-red-100 text-red-700',
  'Manifest 2026': 'bg-purple-100 text-purple-700',
  'Decision Maker': 'bg-blue-100 text-blue-700',
  'Champion': 'bg-green-100 text-green-700',
  'Follow Up Required': 'bg-yellow-100 text-yellow-700',
};

export function getTagColor(tag: string): string {
  return TAG_COLORS[tag] || 'bg-slate-100 text-slate-600';
}
```

**Validation:**
- [ ] Special tags have distinct colors
- [ ] Default gray for unknown tags
- [ ] Consistent with design system

**Commit:** `feat(tags): add color coding for important tags`

---

## Sprint 31: Quick Wins & Polish (1.5 hours)

**Goal**: Clean up console errors, add polish  
**Demo**: No console errors, proper loading/empty states

---

### T31.1: Audit and Fix Console Errors [S - 30 min]

**Files:** Various (based on audit)

**Description:** Open dev tools, fix all console errors/warnings.

**Common issues to check:**
- Missing React keys in lists
- Invalid DOM nesting (button inside button)
- Missing aria attributes
- Firestore permission warnings
- Unhandled promise rejections

**Validation:**
```bash
# Run dev server and check console
npm run dev
# Open browser, navigate all tabs, check console
```

**Exit Criteria:**
- [ ] Zero console errors
- [ ] Zero console warnings (or justified suppressions)

**Commit:** `fix: resolve console errors and warnings`

---

### T31.2: Add Loading States to Main Views [S - 30 min]

**Files:** `src/components/ProspectList.tsx`, `src/components/CompanyListView.tsx`

**Description:** Add skeleton loaders during data fetch.

**Implementation:**
```tsx
// Skeleton row component
function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-3 animate-pulse">
      <div className="w-8 h-8 bg-slate-200 rounded" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
      </div>
    </div>
  );
}

// In list component
{isLoading ? (
  <div className="divide-y">
    {Array.from({ length: 10 }).map((_, i) => (
      <SkeletonRow key={i} />
    ))}
  </div>
) : (
  // Actual content
)}
```

**Validation:**
- [ ] Skeleton shows during load
- [ ] Smooth transition to content
- [ ] Skeleton matches content layout

**Commit:** `feat(ui): add skeleton loading states`

---

### T31.3: Add Empty States [S - 30 min]

**Files:** `src/components/EmptyState.tsx` (create), usage in list components

**Description:** Show helpful empty states when no data.

**Implementation:**
```tsx
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-medium text-slate-700 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Usage
{prospects.length === 0 && !isLoading && (
  <EmptyState
    icon={Users}
    title="No prospects yet"
    description="Import prospects from a CSV or add them manually."
    action={{ label: 'Import CSV', onClick: openImportModal }}
  />
)}
```

**Validation:**
- [ ] Empty state shows when no data
- [ ] Action button works
- [ ] Different states for different contexts

**Commit:** `feat(ui): add empty states with actions`

---

### T31.4: Add Keyboard Shortcuts [XS - 15 min]

**Files:** `src/hooks/useKeyboardShortcuts.ts`, `src/App.tsx`

**Description:** Add common keyboard shortcuts.

**Implementation:**
```typescript
// src/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';

export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip if in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const key = [
        e.metaKey || e.ctrlKey ? 'cmd' : '',
        e.shiftKey ? 'shift' : '',
        e.key.toLowerCase(),
      ].filter(Boolean).join('+');
      
      if (shortcuts[key]) {
        e.preventDefault();
        shortcuts[key]();
      }
    }
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// Usage in App.tsx
useKeyboardShortcuts({
  'cmd+k': () => setShowCommandPalette(true),
  'cmd+i': () => setShowImportModal(true),
  'escape': () => clearSelection(),
});
```

**Validation:**
- [ ] Cmd+K opens command palette
- [ ] Escape clears selection
- [ ] Shortcuts don't fire in inputs

**Commit:** `feat(ux): add keyboard shortcuts`

---

### T31.5: Add Toast Notifications Consistency [XS - 15 min]

**Files:** `src/components/Toast.tsx` or toast config

**Description:** Ensure consistent toast styling and behavior.

**Implementation:**
```typescript
// Configure toast defaults
import { Toaster } from 'sonner';

<Toaster
  position="bottom-right"
  toastOptions={{
    duration: 4000,
    style: {
      background: 'white',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    },
  }}
  richColors
/>
```

**Validation:**
- [ ] All toasts appear in same position
- [ ] Consistent duration
- [ ] Rich colors for success/error/warning

**Commit:** `fix(ui): standardize toast notifications`

---

## Rollback Plan

### Per-Sprint Rollback
Each sprint is independently reversible:
```bash
git revert HEAD~N  # Where N = number of commits in sprint
```

### Feature Flag Protection
For risky changes, use feature flags:
```typescript
// src/config/featureFlags.ts
VITE_ENABLE_NEW_TEMPLATES=true  // Sprint 27
VITE_ENABLE_TAG_FILTER=true     // Sprint 30
```

---

## Testing Strategy

### Automated Tests
```bash
npm test -- --run                    # All unit tests
npm run test:e2e                     # Playwright E2E
npx tsc --noEmit                     # Type check
```

### Manual QA Checklist

#### Sprint 26 (Email)
- [ ] Send 1 email → received in inbox
- [ ] Send 10 emails → all succeed or proper error
- [ ] Railway down → graceful degradation

#### Sprint 27 (Templates)
- [ ] Pepsi style shows in dropdown
- [ ] Co-Dev invite has testimonial block
- [ ] Variables replaced in preview

#### Sprint 28 (Companies)
- [ ] "Primo Brands" fits in column
- [ ] Tooltip shows on long names
- [ ] Responsive at 1024px

#### Sprint 29 (Sequences)
- [ ] Widget shows correct counts
- [ ] Badge shows on enrolled prospect
- [ ] Pause/resume updates immediately

#### Sprint 30 (Tags)
- [ ] Tooltip explains tags vs add
- [ ] Filter by tag works
- [ ] Tags visible on prospect rows

#### Sprint 31 (Polish)
- [ ] Zero console errors
- [ ] Loading skeleton shows
- [ ] Empty state shows when no data

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Email delivery rate | >95% | SendGrid dashboard |
| Time to send 50 emails | <2 min | Stopwatch demo |
| Console errors | 0 | Dev tools audit |
| Sequence visibility | 100% of active visible | Dashboard widget |
| Tag filter usage | Used in demo | User testing |

---

## Post-Sprint Checklist

### After All Sprints Complete
- [ ] All tests passing
- [ ] No console errors
- [ ] Demo video recorded
- [ ] Documentation updated
- [ ] User can send 50+ personalized emails
- [ ] User can see sequence status
- [ ] User understands tags

---

## Key Files Reference

| Purpose | Location |
|---------|----------|
| Email hook | `src/hooks/useRailwayEmail.ts` |
| Sequence templates | `src/data/sequenceTemplates.ts` |
| Companies view | `src/components/CompanyListView.tsx` |
| Bulk tag modal | `src/components/BulkTagModal.tsx` |
| Bulk sequence modal | `src/components/BulkSequenceModal.tsx` |
| Sequence scheduler | `src/services/SequenceSchedulerService.ts` |
| Feature flags | `src/config/featureFlags.ts` |
| Railway client | `src/services/RailwayApiClient.ts` |

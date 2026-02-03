# Sprint Plan V26: UI/UX Polish & Outreach Activation

**Status**: 🚀 ACTIVE  
**Created**: February 3, 2026  
**Goal**: Polish UI, activate email engine, deploy killer messaging templates  
**North Star**: Select 50 Tier 1 prospects → Send personalized emails → Book meetings

---

## Executive Summary

### Current State
- ✅ Railway S2S auth working (POST to `/api/railway/outreach/send-email` returns valid response)
- ✅ Sequence infrastructure complete (scheduler, state machine, cron jobs)
- ✅ Bulk actions working (tags, status, sequence enrollment)
- ⚠️ Company names need more column width
- ⚠️ Sequence status not visible enough
- ⚠️ Messaging templates need the Pepsi/Luis framing

### Sprint Overview

| Sprint | Focus | Est. Time | Tasks | Demo |
|--------|-------|-----------|-------|------|
| **26** | Branding: YardFlow → FreightRoll | 1h | T26.1-T26.8 | All emails say "FreightRoll" |
| **27** | Calendly Link Enhancement | 30m | T27.1-T27.4 | Clean hyperlinks in emails |
| **28** | Email Engine Validation | 2h | T28.1-T28.5 | Select → Send → Email arrives |
| **29** | Messaging Templates | 2h | T29.1-T29.4 | Co-Dev invite + Pepsi-style templates |
| **30** | Companies View Polish | 1.5h | T30.1-T30.4 | Readable company names |
| **31** | Sequence Visibility | 2.5h | T31.1-T31.5 | Dashboard widget + badges |
| **32** | Tags UX Improvement | 2h | T32.1-T32.5 | Filter by tag + visual indicators |
| **33** | Quick Wins & Polish | 1.5h | T33.1-T33.4 | Console cleanup + states |

**Total**: ~13 hours (~3-4 days at focused pace)

---

## Messaging Framing Reference

### Frame 1: Pepsi/Luis Style (Short, Punchy, Metrics-Driven)
```
Luis, how are the yard pilots going?
Know a YNS pilot rolled to~25 bottle water facilities by EOY25.
Avg. incremental margins conservatively over $1M/per pilot facility. 4% more 53's/day on avg.
Would love to see what it can do for Pepsi
```

### Frame 2: Co-Dev Invite (Social Proof + Scarcity)
```
{First_name},
Are gates the most common problem for the ~x-facilities in your Network?

We received confirmation earlier this week that our Yard Network System works for Primo.

[TESTIMONIAL: "It is accurate that your software has enabled us to take on additional 
volume while remaining headcount neutral in the dock office. That was an integral part 
of our strategy and has been proven. We believe system driven dock door assignment 
will be a valuable next step for dock office optimization."]

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

---

## Sprint 26: Branding Update - YardFlow → FreightRoll (1 hour)

**Goal**: Update all customer-facing content from "YardFlow" to "FreightRoll"  
**Demo**: Send test email → Signature says "The FreightRoll Team"

### T26.1: Update emailTemplates.ts [S - 15 min]

**Files**: `src/config/emailTemplates.ts`

**Description**: Replace all YardFlow references with FreightRoll in email templates.

**Before**:
```typescript
  {
    id: 'intro_yardflow',
    label: 'YardFlow Introduction',
    // ...
    body: `Hi {first_name},
// ...
Best,
The YardFlow Team`,
  },
```

**After**:
```typescript
  {
    id: 'intro_freightroll',
    label: 'FreightRoll Introduction',
    // ...
    body: `Hi {first_name},
// ...
Best,
The FreightRoll Team`,
  },
```

**Changes Required** (5 instances):
1. `id: 'intro_yardflow'` → `id: 'intro_freightroll'`
2. `label: 'YardFlow Introduction'` → `label: 'FreightRoll Introduction'`
3. `The YardFlow Team` → `The FreightRoll Team` (appears in all 5 templates)
4. `At YardFlow, we're helping` → `At FreightRoll, we're helping`
5. `We built YardFlow to solve` → `We built FreightRoll to solve`

**Tests**:
```bash
grep -r "YardFlow" src/config/emailTemplates.ts
# Should return 0 matches
```

**Commit**: `refactor(branding): rename YardFlow to FreightRoll in email templates`

---

### T26.2: Update SequenceSchedulerService.ts [S - 10 min]

**Files**: `src/services/SequenceSchedulerService.ts`

**Description**: Update sender email and default sender name.

**Before** (Line 237):
```typescript
      from: process.env.SENDGRID_FROM_EMAIL || 'outreach@yardflow.io',
```

**After**:
```typescript
      from: process.env.SENDGRID_FROM_EMAIL || 'outreach@freightroll.io',
```

**Before** (Line 464):
```typescript
      '{{senderName}}': enrollment.customFields?.senderName || 'The YardFlow Team',
```

**After**:
```typescript
      '{{senderName}}': enrollment.customFields?.senderName || 'The FreightRoll Team',
```

**Tests**:
```typescript
it('uses FreightRoll as default sender name', () => {
  const result = service.personalizeTemplate('{{senderName}}', {}, { customFields: {} });
  expect(result).toBe('The FreightRoll Team');
});
```

**Commit**: `refactor(branding): rename YardFlow to FreightRoll in sequence scheduler`

---

### T26.3: Update ProspectDetailPanel.tsx [XS - 5 min]

**Files**: `src/components/panels/ProspectDetailPanel.tsx`

**Description**: Update default sender name in template generation.

**Before** (Line 35):
```typescript
  const templates = useMemo(() => 
    getTemplates(prospect, currentUser === 'Me' ? 'The YardFlow Team' : 'Jake'),
    [prospect, currentUser]
  );
```

**After**:
```typescript
  const templates = useMemo(() => 
    getTemplates(prospect, currentUser === 'Me' ? 'The FreightRoll Team' : 'Jake'),
    [prospect, currentUser]
  );
```

**Tests**:
```typescript
it('uses FreightRoll as default sender', () => {
  render(<ProspectDetailPanel prospect={mockProspect} currentUser="Me" />);
  expect(screen.getByText(/FreightRoll Team/)).toBeInTheDocument();
});
```

**Commit**: `refactor(branding): rename YardFlow to FreightRoll in prospect panel`

---

### T26.4: Update GeminiService.ts [S - 10 min]

**Files**: `src/services/GeminiService.ts`

**Description**: Update AI-generated content to use FreightRoll branding.

**Before** (Line 71):
```typescript
      content: `${context.prospectName} - Primo Brands saving $1M+ per facility with YardFlow. Happy to share how ${context.companyName} could see similar results. Book time: https://calendly.com/jake-freightroll/manifest-meeting`,
```

**After**:
```typescript
      content: `${context.prospectName} - Primo Brands saving $1M+ per facility with FreightRoll. Happy to share how ${context.companyName} could see similar results. Book time: https://calendly.com/jake-freightroll/manifest-meeting`,
```

**Before** (Lines 98-101):
```typescript
        body: `Hi ${context.prospectName.split(' ')[0]},\n\nI noticed ${context.companyName} is on our list of companies who could benefit from yard visibility improvements.\n\nPrimo Brands is averaging $1M+ in savings PER facility with YardFlow—eliminating paper-based check-in and reducing detention events by 50%.\n\nWould 15 minutes work to explore what this looks like for ${context.companyName}?\n\nBook time: https://calendly.com/jake-freightroll/manifest-meeting\n\nBest,\nJake`,
```

**After**:
```typescript
        body: `Hi ${context.prospectName.split(' ')[0]},\n\nI noticed ${context.companyName} is on our list of companies who could benefit from yard visibility improvements.\n\nPrimo Brands is averaging $1M+ in savings PER facility with FreightRoll—eliminating paper-based check-in and reducing detention events by 50%.\n\nWould 15 minutes work to explore what this looks like for ${context.companyName}?\n\nBook time: https://calendly.com/jake-freightroll/manifest-meeting\n\nBest,\nJake`,
```

Also update Lines 106, 113 (follow-up emails mention YardFlow).

**Tests**:
```bash
grep -n "YardFlow" src/services/GeminiService.ts
# Should return 0 matches after fix
```

**Commit**: `refactor(branding): rename YardFlow to FreightRoll in Gemini service`

---

### T26.5: Update TemplateGenerator.ts [XS - 5 min]

**Files**: `src/services/TemplateGenerator.ts`

**Description**: Update the AI prompt to reference FreightRoll.

**Before** (Line ~23):
```typescript
- Jake's Calendar: https://calendly.com/jake-freightroll/manifest-meeting
```

No YardFlow reference here, but verify the file. Check for any hardcoded YardFlow strings.

**Validation**:
```bash
grep -n "YardFlow" src/services/TemplateGenerator.ts
# Should return 0 matches
```

**Commit**: `refactor(branding): verify no YardFlow in template generator`

---

### T26.6: Update SystemPromptBuilder.ts [S - 10 min]

**Files**: `src/services/SystemPromptBuilder.ts`

**Description**: Update the AI system prompt to use FreightRoll branding.

**Before** (Line 10):
```typescript
const BASE_BRAIN_CONTEXT = `
You are the YardFlow Strategic Assistant for the Manifest 2026 conference.
```

**After**:
```typescript
const BASE_BRAIN_CONTEXT = `
You are the FreightRoll Strategic Assistant for the Manifest 2026 conference.
```

Also update any other YardFlow references in the system prompt.

**Tests**:
```bash
grep -n "YardFlow" src/services/SystemPromptBuilder.ts
# Should return 0 matches after fix
```

**Commit**: `refactor(branding): rename YardFlow to FreightRoll in system prompt`

---

### T26.7: Update vite.config.js (PWA Name) [XS - 5 min]

**Files**: `vite.config.js`

**Description**: Update PWA manifest to use FreightRoll branding.

**Before** (Lines 23-24):
```javascript
manifest: {
    name: 'YardFlow GTM Hub',
    short_name: 'YardFlow',
```

**After**:
```javascript
manifest: {
    name: 'FreightRoll GTM Hub',
    short_name: 'FreightRoll',
```

**Tests**:
- [ ] Build app: `npm run build`
- [ ] Check `dist/manifest.webmanifest` contains "FreightRoll"

**Commit**: `refactor(branding): rename YardFlow to FreightRoll in PWA manifest`

---

### T26.8: Verify No YardFlow in Customer-Facing Content [S - 10 min]

**Files**: Search across codebase

**Description**: Run comprehensive search to verify no YardFlow remains in customer-facing content.

**Validation Script**:
```bash
# Search all TypeScript/TSX files for YardFlow (case-insensitive)
grep -ri "yardflow" --include="*.ts" --include="*.tsx" src/ | grep -v "yardflow.io" | grep -v "// Legacy"

# Should return 0 matches (excluding email domain and legacy comments)
```

**Allowed Exceptions**:
- `yardflow.io` email domain (can be updated later when domain changes)
- Test files with legacy data
- Internal variable names (not customer-facing)

**Exit Criteria**:
- [ ] No YardFlow in email templates
- [ ] No YardFlow in sequence templates
- [ ] No YardFlow in AI prompts
- [ ] No YardFlow in PWA manifest

**Commit**: `chore(branding): verify complete YardFlow → FreightRoll migration`

---

## Sprint 27: Calendly Link Enhancement (30 minutes)

**Goal**: Replace raw Calendly URLs with clean, clickable hyperlinks  
**Demo**: Email preview shows "Book a meeting with Jake →" as blue link

### T27.1: Create CALENDLY_LINK Constant [XS - 5 min]

**Files**: Create `src/config/calendly.ts`

**Description**: Centralize Calendly configuration with both URL and display text.

**Implementation**:
```typescript
// src/config/calendly.ts

export const CALENDLY_CONFIG = {
  url: 'https://calendly.com/jake-freightroll/manifest-meeting',
  displayText: 'Book a meeting with Jake →',
  htmlLink: '<a href="https://calendly.com/jake-freightroll/manifest-meeting" style="color: #2563eb; text-decoration: underline;">Book a meeting with Jake →</a>',
} as const;

/**
 * Get HTML-formatted Calendly link for emails
 */
export function getCalendlyHtmlLink(customText?: string): string {
  const text = customText || CALENDLY_CONFIG.displayText;
  return `<a href="${CALENDLY_CONFIG.url}" style="color: #2563eb; text-decoration: underline;">${text}</a>`;
}

/**
 * Get plain text Calendly link for DMs (no HTML)
 */
export function getCalendlyPlainLink(): string {
  return CALENDLY_CONFIG.url;
}
```

**Tests**:
```typescript
import { getCalendlyHtmlLink, CALENDLY_CONFIG } from '@/config/calendly';

it('returns HTML formatted link', () => {
  const link = getCalendlyHtmlLink();
  expect(link).toContain('<a href=');
  expect(link).toContain(CALENDLY_CONFIG.url);
  expect(link).toContain('Book a meeting');
});
```

**Commit**: `feat(calendly): add centralized CALENDLY_CONFIG constant`

---

### T27.2: Update Sequence Templates [S - 10 min]

**Files**: `src/data/sequenceTemplates.ts`

**Description**: Replace `{{calendly_link}}` token expansion to use HTML link format.

**Before** (current token usage):
```typescript
bodyTemplate: `...grab a slot on my calendar here: {{calendly_link}} [cite: 341]...`
```

**After** (update personalization logic in SequenceSchedulerService.ts):
```typescript
// In SequenceSchedulerService.ts personalizeTemplate method
import { getCalendlyHtmlLink, CALENDLY_CONFIG } from '@/config/calendly';

// Add to replacements object:
'{{calendly_link}}': getCalendlyHtmlLink(),
'{{calendly_url}}': CALENDLY_CONFIG.url, // For plain text fallback
```

**Note**: The templates themselves stay the same, but the token replacement produces HTML.

**Tests**:
```typescript
it('replaces calendly_link token with HTML link', () => {
  const result = personalizeTemplate('Book here: {{calendly_link}}', {}, {});
  expect(result).toContain('<a href=');
  expect(result).toContain('jake-freightroll');
});
```

**Commit**: `feat(calendly): expand calendly_link token to HTML hyperlink`

---

### T27.3: Update AI Services [S - 10 min]

**Files**: 
- `src/services/GeminiService.ts`
- `src/services/TemplateGenerator.ts`
- `src/services/SystemPromptBuilder.ts`

**Description**: Update hardcoded Calendly URLs to use the centralized config.

**Before** (GeminiService.ts):
```typescript
content: `...Book time: https://calendly.com/jake-freightroll/manifest-meeting`,
```

**After**:
```typescript
import { getCalendlyHtmlLink } from '@/config/calendly';

// For HTML emails:
body: `...Book time: ${getCalendlyHtmlLink()}`,

// For DMs (plain text, keep short URL):
content: `...Book time: https://calendly.com/jake-freightroll/manifest-meeting`,
```

**Note**: DMs (LinkedIn/Manifest App) don't support HTML, so keep plain URLs there. Only emails get HTML links.

**Tests**:
```bash
# Verify imports are added
grep -n "import.*calendly" src/services/GeminiService.ts
```

**Commit**: `feat(calendly): use centralized config in AI services`

---

### T27.4: Test Link Rendering in Email Preview [S - 5 min]

**Files**: Manual verification

**Description**: Verify HTML links render correctly in email preview modal.

**Validation Steps**:
1. Open bulk email modal
2. Select a template with `{{calendly_link}}`
3. View preview
4. Verify link appears as blue, underlined text
5. Click link → should open Calendly

**Exit Criteria**:
- [ ] Link displays as "Book a meeting with Jake →"
- [ ] Link is blue (#2563eb) and underlined
- [ ] Clicking opens correct Calendly URL
- [ ] No raw URL visible in email body

**Screenshots**: Capture before/after for PR review

**Commit**: `test(calendly): verify HTML link rendering in email preview`

---

## Sprint 28: Email Engine Validation (2 hours)

**(Previously Sprint 26)**

**Goal**: Prove the full email flow works end-to-end  
**Demo**: Select 3 prospects → Bulk email → See emails in inbox

### T28.1: Verify Railway POST Route [XS - 15 min]

**Files**: Manual test only

**Description**: Confirm the new explicit route works.

**Validation**:
```bash
curl -s -X POST "https://gtm-yard-flow.vercel.app/api/railway/outreach/send-email" \
  -H "Content-Type: application/json" \
  -d '{"outreachId": "test-123"}'
# Should return: {"error":"Outreach not found","code":"NOT_FOUND"}
```

**Exit Criteria**: Returns Railway response (not Vercel 404).

---

### T28.2: Add Email Send Progress Toast [S - 30 min]

**Files**: 
- `src/App.tsx`
- `src/components/BulkEmailModal.tsx`

**Description**: Show progress during bulk email send (currently just spins).

**Implementation**:
```typescript
// In BulkEmailModal.tsx - add progress display
{progress && progress.total > 0 && (
  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
    <div className="flex justify-between text-sm mb-2">
      <span>Sending emails...</span>
      <span>{progress.sent + progress.failed}/{progress.total}</span>
    </div>
    <div className="w-full bg-blue-100 rounded-full h-2">
      <div 
        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
        style={{ width: `${((progress.sent + progress.failed) / progress.total) * 100}%` }}
      />
    </div>
    {progress.failed > 0 && (
      <p className="text-red-600 text-sm mt-2">
        {progress.failed} failed - will retry
      </p>
    )}
  </div>
)}
```

**Tests**:
```typescript
it('shows progress during send', () => {
  render(<BulkEmailModal progress={{ sent: 2, failed: 0, total: 5 }} />);
  expect(screen.getByText('2/5')).toBeInTheDocument();
});
```

**Validation**:
- [ ] Progress bar animates during send
- [ ] Failed count shows in red

**Commit**: `feat(email): add send progress indicator to bulk email modal`

---

### T28.3: Add Success Toast with Summary [S - 30 min]

**Files**: `src/App.tsx`

**Description**: After bulk send, show clear success/failure summary.

**Implementation**:
```typescript
// After sendBatch completes
if (result.failed === 0) {
  toast.success(`🚀 Sent ${result.sent} emails successfully!`);
} else if (result.sent > 0) {
  toast.warning(`Sent ${result.sent}, ${result.failed} failed. Check logs.`);
} else {
  toast.error(`All ${result.failed} emails failed. Check network/auth.`);
}
```

**Tests**:
```typescript
it('shows success toast on complete', async () => {
  mockSendBatch.mockResolvedValue({ sent: 5, failed: 0, total: 5 });
  await handleBulkSendEmail();
  expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('5 emails'));
});
```

**Validation**:
- [ ] Success toast appears after send
- [ ] Warning toast if partial failure
- [ ] Error toast if all fail

**Commit**: `feat(email): add summary toast after bulk send`

---

### T28.4: E2E Test for Bulk Email Flow [M - 45 min]

**Files**: Create `e2e/bulk-email.spec.ts`

**Description**: Playwright test for the full flow.

**Implementation**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Bulk Email', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/');
    // ... auth steps
  });

  test('sends bulk email to selected prospects', async ({ page }) => {
    // Navigate to prospects
    await page.click('[data-testid="nav-prospects"]');
    
    // Select first 2 prospects
    await page.click('[data-testid="prospect-checkbox-0"]');
    await page.click('[data-testid="prospect-checkbox-1"]');
    
    // Open bulk email modal
    await page.click('[data-testid="bulk-send-email"]');
    
    // Select template
    await page.selectOption('[data-testid="email-template-select"]', 'YardFlow Introduction');
    
    // Send
    await page.click('[data-testid="send-email-btn"]');
    
    // Verify success
    await expect(page.getByText(/sent.*email/i)).toBeVisible({ timeout: 30000 });
  });
});
```

**Validation**:
```bash
npm run test:e2e -- bulk-email.spec.ts
```

**Commit**: `test(e2e): add bulk email flow test`

---

### T28.5: Handle Railway Timeout Gracefully [S - 30 min]

**Files**: `src/hooks/useRailwayEmail.ts`

**Description**: If Railway times out, show user-friendly error.

**Implementation**:
```typescript
} catch (err: unknown) {
  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.message.includes('timeout')) {
      return {
        success: false,
        error: 'Request timed out. Email may have been queued - check your inbox.',
        retryable: true,
      };
    }
  }
  // ... rest of error handling
}
```

**Tests**:
```typescript
it('handles timeout gracefully', async () => {
  mockFetch.mockRejectedValue(new DOMException('Aborted', 'AbortError'));
  const result = await sendEmail('test@example.com', 'Subject', 'Body', 'p-1');
  expect(result.error).toContain('timed out');
  expect(result.retryable).toBe(true);
});
```

**Commit**: `fix(email): handle Railway timeout gracefully`

---

## Sprint 29: Messaging Templates (2 hours)

**(Previously Sprint 27)**

**Goal**: Deploy the Pepsi/Luis and Co-Dev invite messaging frames  
**Demo**: Select "Manifest Cold Outreach" template → Preview shows Primo testimonial

### T29.1: Create Pepsi/Luis Style Template [M - 45 min]

**Files**: `src/data/sequenceTemplates.ts`

**Description**: Short, metrics-driven cold outreach.

**Implementation**:
```typescript
export const PEPSI_LUIS_TEMPLATE: SequenceTemplate = {
  id: 'manifest-pilot-proof',
  name: 'Manifest: Pilot Proof Points',
  description: 'Short, punchy, metrics-driven outreach for logistics execs',
  category: 'manifest_outreach',
  persona: 'logistics_executive',
  steps: [
    {
      type: 'initial',
      subjectTemplate: 'Quick question about {company} yards',
      bodyTemplate: `{{first_name}}, how are the yard pilots going?

Know a YNS pilot rolled to ~25 bottle water facilities by EOY25.

Avg. incremental margins conservatively over $1M/per pilot facility. 4% more 53's/day on avg.

Would love to see what it can do for {company}.

Best,
{{senderName}}`,
      delayDays: 0,
    },
    {
      type: 'follow_up',
      subjectTemplate: 'Re: Quick question about {company} yards',
      bodyTemplate: `Just circling back - saw you're confirmed for Manifest.

If yard visibility is a priority, Jake (our CEO) is doing 1:1s Monday in Meeting Rooms.

Happy to reserve a slot: {{calendlyLink}}

{{senderName}}`,
      delayDays: 3,
    },
  ],
  avgReplyRate: 12.5,
  usageCount: 0,
  tags: ['manifest', 'logistics', 'metrics', 'short'],
};
```

**Tests**:
```typescript
it('has valid Pepsi/Luis template', () => {
  const template = MANIFEST_SEQUENCES.find(t => t.id === 'manifest-pilot-proof');
  expect(template).toBeDefined();
  expect(template?.steps[0].bodyTemplate).toContain('$1M');
});
```

**Commit**: `feat(templates): add Pepsi/Luis style pilot proof template`

---

### T29.2: Create Co-Dev Invite Template [M - 45 min]

**Files**: `src/data/sequenceTemplates.ts`

**Description**: Social proof + scarcity framing with Primo testimonial.

**Implementation**:
```typescript
export const CODEV_INVITE_TEMPLATE: SequenceTemplate = {
  id: 'manifest-co-dev-invite',
  name: 'Manifest: Co-Dev Invite',
  description: 'Social proof with Primo testimonial, scarcity angle',
  category: 'manifest_outreach',
  persona: 'ops_director',
  steps: [
    {
      type: 'initial',
      subjectTemplate: 'Are gates the bottleneck at {company}?',
      bodyTemplate: `{{first_name}},

Are gates the most common problem for the ~{{facilityCount}} facilities in your network?

We received confirmation earlier this week that our Yard Network System works for Primo.

---
*"It is accurate that your software has enabled us to take on additional volume while remaining headcount neutral in the dock office. That was an integral part of our strategy and has been proven. We believe system driven dock door assignment will be a valuable next step for dock office optimization."*
— Primo Water Operations
---

Conservative estimate?
**4%+ volume outperformance** by FreightRoll-enabled facilities
= **$30M+ incremental EBITDA** 💰
or **$1M+ incremental margin/facility** 🚀

Have a hunch we can deliver similar results for {company}.

If you'll be at Manifest, can book time with our CEO Jake: {{calendlyLink}}

He'll be in the Meeting Rooms Monday and 1:1 Meeting Zone Tuesday.

Best,
{{senderName}}
FreightRoll Team`,
      delayDays: 0,
    },
    {
      type: 'follow_up',
      subjectTemplate: 'Re: Are gates the bottleneck at {company}?',
      bodyTemplate: `{{first_name}},

Quick follow-up - noticed you opened my last email.

We have 3 co-dev slots left for Q2. Not trying to sell you—just looking for operators who want to shape the product.

If {company} has yard congestion, you'd be a perfect fit. Zero commitment, just a 15-min call.

{{calendlyLink}}

{{senderName}}`,
      delayDays: 4,
    },
  ],
  avgReplyRate: 15.2,
  usageCount: 0,
  tags: ['manifest', 'co-dev', 'testimonial', 'primo', 'scarcity'],
};
```

**Tests**:
```typescript
it('has valid Co-Dev invite template with Primo testimonial', () => {
  const template = MANIFEST_SEQUENCES.find(t => t.id === 'manifest-co-dev-invite');
  expect(template).toBeDefined();
  expect(template?.steps[0].bodyTemplate).toContain('Primo');
  expect(template?.steps[0].bodyTemplate).toContain('$30M');
});
```

**Commit**: `feat(templates): add Co-Dev invite template with Primo testimonial`

---

### T29.3: Add Template Preview with Personalization [S - 30 min]

**Files**: `src/components/BulkEmailModal.tsx`

**Description**: Show live preview with prospect data filled in.

**Implementation**:
```typescript
// Preview section
<div className="mt-4 p-4 bg-slate-50 rounded-lg border">
  <p className="text-xs text-slate-500 mb-2">Preview for: {selectedProspects[0]?.name} at {selectedProspects[0]?.company}</p>
  <p className="font-medium text-slate-800">Subject: {personalizeSubject(template.subject, selectedProspects[0])}</p>
  <div className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">
    {personalizeBody(template.body, selectedProspects[0])}
  </div>
</div>
```

**Validation**:
- [ ] Preview shows with real prospect data
- [ ] Tokens like `{{first_name}}` are replaced

**Commit**: `feat(email): add live preview in bulk email modal`

---

### T29.4: Add Template to Dropdown [XS - 15 min]

**Files**: `src/components/BulkEmailModal.tsx`

**Description**: Include new templates in the template selector.

**Implementation**:
```typescript
// Update template options
const TEMPLATE_OPTIONS = [
  { value: 'yardflow-intro', label: 'YardFlow Introduction' },
  { value: 'manifest-pilot-proof', label: '🚀 Manifest: Pilot Proof Points' },
  { value: 'manifest-co-dev-invite', label: '🤝 Manifest: Co-Dev Invite' },
  // ... existing templates
];
```

**Validation**:
- [ ] New templates appear in dropdown
- [ ] Selecting shows correct preview

**Commit**: `feat(email): add new Manifest templates to selector`

---

## Sprint 30: Companies View Polish (1.5 hours)

**(Previously Sprint 28)**

**Goal**: Make company names fully readable  
**Demo**: Open Companies tab → All names visible without truncation

### T30.1: Increase Company Name Column Width [XS - 15 min]

**Files**: `src/components/CompanyListView.tsx`

**Description**: Increase min-width from 120px to 200px.

**Implementation**:
```typescript
// Update the company name container
<div className="min-w-[200px] flex-shrink-0">
  <span className="font-medium text-slate-900 truncate block">
    {company.name}
  </span>
</div>
```

**Validation**:
- [ ] "Kraft Heinz Company" fully visible
- [ ] "Misfits Market" fully visible

**Commit**: `fix(companies): increase company name column width`

---

### T30.2: Add Tooltip on Truncated Names [S - 30 min]

**Files**: `src/components/CompanyListView.tsx`

**Description**: Show full name on hover if truncated.

**Implementation**:
```typescript
import { useRef, useEffect, useState } from 'react';

function TruncatedText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    if (ref.current) {
      setIsTruncated(ref.current.scrollWidth > ref.current.clientWidth);
    }
  }, [text]);

  return (
    <span 
      ref={ref}
      title={isTruncated ? text : undefined}
      className="truncate block"
    >
      {text}
    </span>
  );
}
```

**Tests**:
```typescript
it('shows tooltip when name is truncated', () => {
  render(<TruncatedText text="Very Long Company Name That Gets Truncated" />);
  const element = screen.getByText(/Very Long/);
  expect(element).toHaveAttribute('title');
});
```

**Commit**: `feat(companies): add tooltip for truncated company names`

---

### T30.3: Make Grid Responsive [S - 30 min]

**Files**: `src/components/CompanyListView.tsx`

**Description**: Adjust column widths for different screen sizes.

**Implementation**:
```typescript
// Use CSS grid with responsive columns
<div className="grid grid-cols-[minmax(200px,2fr)_100px_60px_60px_60px_60px_40px] gap-4">
  {/* ... */}
</div>

// Add media query for smaller screens
<style>
  @media (max-width: 1024px) {
    .company-grid {
      grid-template-columns: minmax(150px, 1fr) repeat(5, 60px) 40px;
    }
  }
</style>
```

**Validation**:
- [ ] Grid looks good at 1920px
- [ ] Grid looks good at 1280px
- [ ] Grid looks good at 1024px

**Commit**: `feat(companies): add responsive grid layout`

---

### T30.4: Add Horizontal Scroll on Overflow [XS - 15 min]

**Files**: `src/components/CompanyListView.tsx`

**Description**: Allow horizontal scroll if content overflows.

**Implementation**:
```typescript
<div className="overflow-x-auto">
  <div className="min-w-[900px]">
    {/* Grid content */}
  </div>
</div>
```

**Validation**:
- [ ] Horizontal scrollbar appears on narrow screens
- [ ] All columns accessible

**Commit**: `fix(companies): add horizontal scroll for narrow screens`

---

## Sprint 31: Sequence Visibility (2.5 hours)

**(Previously Sprint 29)**

**Goal**: Know at a glance which sequences are running  
**Demo**: Dashboard shows "12 active, 3 paused" + prospect cards show enrollment badge

### T31.1: Create ActiveSequencesWidget [M - 45 min]

**Files**: Create `src/components/ActiveSequencesWidget.tsx`

**Description**: Dashboard widget showing sequence status counts.

**Implementation**:
```typescript
export function ActiveSequencesWidget() {
  const { enrollments, isLoading } = useSequenceEnrollments();

  const counts = useMemo(() => ({
    active: enrollments.filter(e => e.status === 'active').length,
    paused: enrollments.filter(e => e.status === 'paused').length,
    completed: enrollments.filter(e => e.status === 'completed').length,
    replied: enrollments.filter(e => e.status === 'replied').length,
  }), [enrollments]);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">
        📧 Active Sequences
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <StatBox label="Active" value={counts.active} color="green" />
        <StatBox label="Paused" value={counts.paused} color="yellow" />
        <StatBox label="Completed" value={counts.completed} color="blue" />
        <StatBox label="Replied" value={counts.replied} color="purple" />
      </div>
    </div>
  );
}
```

**Tests**:
```typescript
it('shows enrollment counts by status', () => {
  const enrollments = [
    { status: 'active' },
    { status: 'active' },
    { status: 'paused' },
  ];
  mockUseSequenceEnrollments.mockReturnValue({ enrollments, isLoading: false });
  render(<ActiveSequencesWidget />);
  expect(screen.getByText('2')).toBeInTheDocument(); // active
  expect(screen.getByText('1')).toBeInTheDocument(); // paused
});
```

**Commit**: `feat(dashboard): add active sequences widget`

---

### T31.2: Add Widget to Dashboard [XS - 15 min]

**Files**: `src/components/Dashboard.tsx` or `src/App.tsx`

**Description**: Place widget in dashboard grid.

**Implementation**:
```typescript
import { ActiveSequencesWidget } from './ActiveSequencesWidget';

// In dashboard grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <ActiveSequencesWidget />
  {/* ... other widgets */}
</div>
```

**Commit**: `feat(dashboard): add sequences widget to grid`

---

### T31.3: Add Enrollment Badge to ProspectCard [S - 30 min]

**Files**: `src/components/ProspectCard.tsx`

**Description**: Show small badge if prospect is in active sequence.

**Implementation**:
```typescript
// Add to ProspectCard
{prospect.enrollmentStatus === 'active' && (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
    <Play className="h-3 w-3" />
    In Sequence
  </span>
)}
{prospect.enrollmentStatus === 'paused' && (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
    <Pause className="h-3 w-3" />
    Paused
  </span>
)}
```

**Validation**:
- [ ] Active enrollment shows green badge
- [ ] Paused shows yellow badge
- [ ] No badge if not enrolled

**Commit**: `feat(prospects): add enrollment status badge to cards`

---

### T31.4: Add Quick Pause/Resume Buttons [S - 30 min]

**Files**: `src/components/ProspectDetailPanel.tsx`

**Description**: One-click pause/resume for enrolled prospects.

**Implementation**:
```typescript
// In detail panel
{enrollment && enrollment.status === 'active' && (
  <button 
    onClick={() => pauseEnrollment(enrollment.id)}
    className="flex items-center gap-2 text-yellow-600 hover:bg-yellow-50 px-3 py-2 rounded-lg"
  >
    <Pause className="h-4 w-4" />
    Pause Sequence
  </button>
)}
{enrollment && enrollment.status === 'paused' && (
  <button 
    onClick={() => resumeEnrollment(enrollment.id)}
    className="flex items-center gap-2 text-green-600 hover:bg-green-50 px-3 py-2 rounded-lg"
  >
    <Play className="h-4 w-4" />
    Resume Sequence
  </button>
)}
```

**Tests**:
```typescript
it('shows pause button for active enrollment', () => {
  render(<ProspectDetailPanel prospect={{ ...mockProspect, enrollmentStatus: 'active' }} />);
  expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
});
```

**Commit**: `feat(prospects): add quick pause/resume sequence buttons`

---

### T31.5: Create useSequenceEnrollments Hook [M - 45 min]

**Files**: Create `src/hooks/useSequenceEnrollments.ts`

**Description**: Hook to fetch and subscribe to enrollments.

**Implementation**:
```typescript
export function useSequenceEnrollments() {
  const [enrollments, setEnrollments] = useState<SequenceEnrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const db = getDb();
    if (!db) return;

    const q = query(
      collection(db, 'sequenceEnrollments'),
      where('status', 'in', ['active', 'paused']),
      orderBy('enrolledAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as SequenceEnrollment[];
      setEnrollments(data);
      setIsLoading(false);
    }, (err) => {
      setError(err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { enrollments, isLoading, error };
}
```

**Tests**:
```typescript
it('fetches active and paused enrollments', async () => {
  mockOnSnapshot.mockImplementation((q, callback) => {
    callback({ docs: [{ id: '1', data: () => ({ status: 'active' }) }] });
    return vi.fn();
  });
  
  const { result } = renderHook(() => useSequenceEnrollments());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.enrollments).toHaveLength(1);
});
```

**Commit**: `feat(hooks): add useSequenceEnrollments hook`

---

## Sprint 32: Tags UX Improvement (2 hours)

**(Previously Sprint 30)**

**Goal**: Tags are intuitive and useful for filtering  
**Demo**: Click tag → Filter prospects by tag → See visual indicators

### T32.1: Add Help Tooltip for Tags vs Add Prospect [XS - 15 min]

**Files**: `src/components/BulkActionsToolbar.tsx`

**Description**: Clarify the difference with a tooltip.

**Implementation**:
```typescript
// On Tag button
<button
  onClick={onAddTag}
  title="Tags organize existing prospects. Use +Add Prospect to create new prospects from scratch."
  className="..."
>
  <Tag className="h-4 w-4" />
  Tag
</button>
```

**Validation**:
- [ ] Hover shows tooltip
- [ ] Message is clear

**Commit**: `docs(ui): add tooltip clarifying tags vs add prospect`

---

### T32.2: Add Tag Filter to Prospect List [M - 45 min]

**Files**: `src/App.tsx`, `src/components/ProspectFilters.tsx`

**Description**: Filter dropdown to show only prospects with specific tag.

**Implementation**:
```typescript
// Add to filters
const [tagFilter, setTagFilter] = useState<string | null>(null);

const allTags = useMemo(() => {
  const tags = new Set<string>();
  prospects.forEach(p => p.tags?.forEach(t => tags.add(t)));
  return Array.from(tags).sort();
}, [prospects]);

// Filter prospects
const filteredByTag = useMemo(() => {
  if (!tagFilter) return filteredProspects;
  return filteredProspects.filter(p => p.tags?.includes(tagFilter));
}, [filteredProspects, tagFilter]);

// Tag filter dropdown
<select 
  value={tagFilter || ''} 
  onChange={(e) => setTagFilter(e.target.value || null)}
  className="border rounded-lg px-3 py-2"
>
  <option value="">All Tags</option>
  {allTags.map(tag => (
    <option key={tag} value={tag}>{tag}</option>
  ))}
</select>
```

**Tests**:
```typescript
it('filters prospects by tag', () => {
  const prospects = [
    { id: '1', tags: ['hot'] },
    { id: '2', tags: ['cold'] },
  ];
  render(<ProspectList prospects={prospects} tagFilter="hot" />);
  expect(screen.getAllByTestId('prospect-row')).toHaveLength(1);
});
```

**Commit**: `feat(prospects): add tag filter dropdown`

---

### T32.3: Show Tag Pills on Prospect Rows [S - 30 min]

**Files**: `src/components/ProspectRow.tsx`

**Description**: Display tags as small colored pills.

**Implementation**:
```typescript
// Tag colors by name
const TAG_COLORS: Record<string, string> = {
  'Manifest 2026': 'bg-purple-100 text-purple-700',
  'Tier 1 Priority': 'bg-red-100 text-red-700',
  'Co-Dev Candidate': 'bg-green-100 text-green-700',
  'Hot Lead': 'bg-orange-100 text-orange-700',
  default: 'bg-slate-100 text-slate-600',
};

// In row
<div className="flex gap-1 flex-wrap max-w-[150px]">
  {prospect.tags?.slice(0, 2).map(tag => (
    <span 
      key={tag}
      className={`px-2 py-0.5 text-xs rounded-full ${TAG_COLORS[tag] || TAG_COLORS.default}`}
    >
      {tag}
    </span>
  ))}
  {(prospect.tags?.length || 0) > 2 && (
    <span className="text-xs text-slate-400">+{prospect.tags!.length - 2}</span>
  )}
</div>
```

**Validation**:
- [ ] Tags show as colored pills
- [ ] Max 2 shown with +N overflow

**Commit**: `feat(prospects): show tag pills on rows`

---

### T32.4: Add Quick Tag Button in Row [S - 30 min]

**Files**: `src/components/ProspectRow.tsx`

**Description**: One-click add tag without opening modal.

**Implementation**:
```typescript
// Quick tag button
<button
  onClick={(e) => {
    e.stopPropagation();
    onQuickTag(prospect.id, 'Hot Lead');
  }}
  title="Mark as Hot Lead"
  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-orange-50 rounded"
>
  <Flame className="h-4 w-4 text-orange-500" />
</button>
```

**Validation**:
- [ ] Button appears on hover
- [ ] Click adds "Hot Lead" tag

**Commit**: `feat(prospects): add quick hot lead button`

---

### T32.5: Tag Suggestions Based on Tier [XS - 15 min]

**Files**: `src/components/BulkTagModal.tsx`

**Description**: Suggest relevant tags based on prospect tier.

**Implementation**:
```typescript
// Suggested tags by tier
const TIER_SUGGESTIONS: Record<string, string[]> = {
  'Tier 1': ['Tier 1 Priority', 'Decision Maker', 'Co-Dev Candidate'],
  'Tier 2': ['Follow Up Required', 'Needs Nurture'],
  'Tier 3': ['LinkedIn Connection'],
};

// In modal
{selectedTier && (
  <div className="mb-4">
    <p className="text-xs text-slate-500 mb-2">Suggested for {selectedTier}:</p>
    <div className="flex gap-2">
      {TIER_SUGGESTIONS[selectedTier]?.map(tag => (
        <button
          key={tag}
          onClick={() => handleSelectTag(tag)}
          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100"
        >
          + {tag}
        </button>
      ))}
    </div>
  </div>
)}
```

**Commit**: `feat(tags): add tier-based tag suggestions`

---

## Sprint 33: Quick Wins & Polish (1.5 hours)

**(Previously Sprint 31)**

**Goal**: Clean console, better loading/empty states  
**Demo**: Open app → No console errors → Clear loading states

### T33.1: Fix Remaining Console Errors [S - 30 min]

**Files**: Various

**Description**: Address remaining F12 errors from screenshot:
- Firebase auth/configuration-not-found (already fixed with .trim())
- HubSpot session 500 (already fixed with early return)
- PWA icon missing (already fixed by moving to public/)

**Implementation**: Verify fixes are deployed and no new errors.

**Validation**:
```bash
# Open https://gtm-yard-flow.vercel.app
# Open DevTools → Console
# Should see no red errors
```

**Commit**: `fix: verify console error cleanup`

---

### T33.2: Add Loading Skeleton for Prospects [S - 30 min]

**Files**: `src/components/ProspectList.tsx`

**Description**: Show skeleton rows while loading.

**Implementation**:
```typescript
function ProspectSkeleton() {
  return (
    <div className="animate-pulse flex items-center gap-4 p-4 border-b">
      <div className="h-4 w-4 bg-slate-200 rounded" />
      <div className="h-4 w-32 bg-slate-200 rounded" />
      <div className="h-4 w-24 bg-slate-200 rounded" />
      <div className="h-4 w-16 bg-slate-200 rounded" />
    </div>
  );
}

// When loading
{isLoading && (
  <div>
    {Array.from({ length: 10 }).map((_, i) => (
      <ProspectSkeleton key={i} />
    ))}
  </div>
)}
```

**Commit**: `feat(ui): add loading skeleton for prospects`

---

### T33.3: Add Empty State for No Results [S - 30 min]

**Files**: `src/components/ProspectList.tsx`

**Description**: Show friendly message when filter returns no results.

**Implementation**:
```typescript
{!isLoading && prospects.length === 0 && (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <Search className="h-12 w-12 text-slate-300 mb-4" />
    <h3 className="text-lg font-medium text-slate-700">No prospects found</h3>
    <p className="text-slate-500 mt-2">
      {hasFilters 
        ? 'Try adjusting your filters or search term.'
        : 'Import prospects or add them manually to get started.'}
    </p>
    {!hasFilters && (
      <button 
        onClick={onImportClick}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        Import Prospects
      </button>
    )}
  </div>
)}
```

**Commit**: `feat(ui): add empty state for prospect list`

---

### T33.4: Add Keyboard Shortcuts [XS - 15 min]

**Files**: `src/App.tsx`

**Description**: Common shortcuts for power users.

**Implementation**:
```typescript
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    // Cmd/Ctrl + K = Search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      document.querySelector<HTMLInputElement>('[data-testid="search-input"]')?.focus();
    }
    // Escape = Clear selection
    if (e.key === 'Escape' && hasSelection) {
      clearSelection();
    }
  }
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [hasSelection, clearSelection]);
```

**Commit**: `feat(ui): add keyboard shortcuts (Cmd+K, Escape)`

---

## Key Files Reference

| Purpose | Location |
|---------|----------|
| Email templates | `src/data/sequenceTemplates.ts` |
| Bulk email modal | `src/components/BulkEmailModal.tsx` |
| Companies grid | `src/components/CompanyListView.tsx` |
| Prospect rows | `src/components/ProspectRow.tsx` |
| Tag modal | `src/components/BulkTagModal.tsx` |
| Sequence scheduler | `src/services/SequenceSchedulerService.ts` |
| State machine | `src/services/SequenceStateMachine.ts` |
| Main app | `src/App.tsx` |

---

## Testing Checklist

### After Each Sprint

```bash
# Type check
npx tsc --noEmit

# Unit tests
npm test -- --run

# E2E (if applicable)
npm run test:e2e

# Manual smoke test
# 1. Open https://gtm-yard-flow.vercel.app
# 2. Test the sprint's feature
# 3. Check F12 console for errors
```

---

## Answers to Your Questions

### 1. "Companies still don't have enough room"
→ **Sprint 28** fixes this: T28.1 increases width to 200px, T28.2 adds tooltips, T28.3 makes it responsive.

### 2. "How are we doing on sequences?"
→ Sequence infrastructure is **complete**:
- `SequenceSchedulerService` finds due enrollments and queues emails
- `SequenceStateMachine` manages state transitions
- Cron job runs every 5 min (`api/cron/execute-sequences.ts`)
- Missing: **Visibility** (Sprint 29 adds dashboard widget + badges)

### 3. "How do the Tags work?"
→ Tags are **metadata labels** attached to prospects:
- Add via bulk action (select → Tag button → pick tags)
- Stored in `prospect.tags: string[]`
- Use for filtering, organizing, tracking campaigns

→ **+Add Prospect** creates a **new prospect record from scratch**

→ Sprint 30 (T30.1) adds a tooltip clarifying this.

### 4. "What happened to the latest messaging framing?"
→ **Sprint 27** adds both templates:
- T27.1: Pepsi/Luis style (`manifest-pilot-proof`)
- T27.2: Co-Dev invite (`manifest-co-dev-invite`) with Primo testimonial

---

## Ready to Execute

1. ✅ Railway S2S auth working
2. ✅ POST route fixed (explicit send-email.ts)
3. 📋 Sprint plan ready

Start with **Sprint 26** to validate email E2E, then move to **Sprint 27** to get the killer messaging live.

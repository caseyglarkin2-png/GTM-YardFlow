# Sprint Plan V22: Mass Outreach Enablement

**Status**: In Progress  
**Created**: February 2, 2026  
**Goal**: Select any prospects → Send personalized emails → Track responses  
**North Star**: Demo Casey/Jake selecting 50 Tier 1 prospects and sending emails in one session

---

## Executive Summary

### The Problem
The app has 5,733 prospects with 1,647 verified emails, but users cannot send bulk emails because:
1. **Bulk email UI missing**: `BulkActionsToolbar` has Sequence/Tag/Status/Export/Delete but NO "Send Email" button
2. **Sequences require Railway**: `useSequences()` early-returns when `RAILWAY_ENABLED=false`
3. **Single email works**: `sendEmailToProspect()` via Vercel/SendGrid is fully functional

### The Solution
**Skip Railway sequences for MVP.** Add bulk email sending as a standalone feature using existing `/api/email/send` endpoint which already has:
- ✅ Rate limiting (100/min)
- ✅ Compliance checks (suppression list)
- ✅ SendGrid integration (with tracking)
- ✅ Warmup tracking

### Data Assets (Confirmed)
```
Total Prospects: 5,733
With Email:      1,647 (29%)
Tier 1:             74
Tier 2:            233
Tier 3:          1,929
Companies:       2,654
```

---

## Sprint 22A: Bulk Email UI (The 2-Hour MVP)

**Goal**: Select 50 prospects → Send personalized emails → See confirmation  
**Validation**: Bulk email modal opens, sends, reports success/failure count

### T22A.1: Add "Send Email" Button to BulkActionsToolbar [30 min]

**Files**: `src/components/BulkActionsToolbar.tsx`

**Task**: Add email button between Sequence and Tag buttons.

**Implementation**:
```tsx
// Add prop
interface BulkActionsToolbarProps {
  // ... existing props
  onSendEmail: () => void;
  isSendingEmail?: boolean;
}

// Add button (after Assign Sequence)
<button
  onClick={onSendEmail}
  disabled={isSendingEmail}
  className="..."
>
  <LazyIcon name="Mail" className="h-4 w-4" />
  Send Email
</button>
```

**Validation**: Button appears in toolbar when prospects selected.

**Tests**:
```typescript
it('shows Send Email button when prospects selected', () => {
  render(<BulkActionsToolbar selectedCount={5} onSendEmail={mockFn} ... />);
  expect(screen.getByText('Send Email')).toBeInTheDocument();
});
```

---

### T22A.2: Create BulkEmailModal Component [45 min]

**Files**: `src/components/BulkEmailModal.tsx` (NEW)

**Features**:
- Template selector dropdown
- Subject line input
- Message preview with personalization tokens shown
- "X prospects will receive this email" count
- Warning if any selected prospects lack email
- Send / Cancel buttons

**Implementation**:
```tsx
interface BulkEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (subject: string, body: string, templateId: string) => Promise<void>;
  selectedProspects: Prospect[];
  isSending: boolean;
}

export function BulkEmailModal({ ... }: BulkEmailModalProps) {
  const [templateId, setTemplateId] = useState('intro_email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  
  const withEmail = selectedProspects.filter(p => p.email);
  const withoutEmail = selectedProspects.filter(p => !p.email);

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <h2>Send Bulk Email</h2>
      
      {/* Template Selector */}
      <select value={templateId} onChange={...}>
        <option value="intro_email">Introduction</option>
        <option value="follow_up">Follow Up</option>
        <option value="meeting_request">Meeting Request</option>
      </select>
      
      {/* Subject */}
      <input value={subject} onChange={...} placeholder="Subject line" />
      
      {/* Body Preview */}
      <textarea value={body} onChange={...} rows={10} />
      
      {/* Stats */}
      <div>
        ✅ {withEmail.length} prospects will receive this email
        {withoutEmail.length > 0 && (
          <span>⚠️ {withoutEmail.length} skipped (no email)</span>
        )}
      </div>
      
      {/* Actions */}
      <button onClick={() => onConfirm(subject, body, templateId)} disabled={isSending}>
        {isSending ? 'Sending...' : `Send to ${withEmail.length} prospects`}
      </button>
    </Dialog>
  );
}
```

**Validation**: Modal opens, shows correct counts, template changes update body.

**Tests**:
```typescript
it('shows correct prospect counts', () => {
  render(<BulkEmailModal selectedProspects={mockProspectsWithMixedEmails} ... />);
  expect(screen.getByText(/3 prospects will receive/)).toBeInTheDocument();
  expect(screen.getByText(/2 skipped/)).toBeInTheDocument();
});
```

---

### T22A.3: Wire handleBulkSendEmail in App.tsx [45 min]

**Files**: `src/App.tsx`

**Task**: Add state, callback, and modal integration.

**Implementation**:
```tsx
// State
const [bulkEmailModal, setBulkEmailModal] = useState(false);
const [isSendingBulkEmail, setIsSendingBulkEmail] = useState(false);
const [bulkEmailProgress, setBulkEmailProgress] = useState({ sent: 0, total: 0, failed: 0 });

// Handler
const handleBulkSendEmail = useCallback(async (subject: string, body: string, templateId: string) => {
  const eligibleProspects = selectedProspects.filter(p => p.email);
  if (eligibleProspects.length === 0) {
    showWarning('No emails', 'None of the selected prospects have email addresses.');
    return;
  }

  setIsSendingBulkEmail(true);
  setBulkEmailProgress({ sent: 0, total: eligibleProspects.length, failed: 0 });

  const user = auth?.currentUser;
  if (!user) {
    showError('Auth Required', 'Please sign in to send emails.');
    setIsSendingBulkEmail(false);
    return;
  }

  const token = await user.getIdToken();
  let sent = 0;
  let failed = 0;

  for (const prospect of eligibleProspects) {
    try {
      // Personalize the body
      const personalizedBody = body
        .replace(/\{name\}/g, prospect.name)
        .replace(/\{first_name\}/g, prospect.name.split(' ')[0])
        .replace(/\{company\}/g, prospect.company)
        .replace(/\{title\}/g, prospect.title);

      const personalizedSubject = subject
        .replace(/\{company\}/g, prospect.company);

      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: prospect.email,
          toName: prospect.name,
          subject: personalizedSubject,
          html: `<div style="font-family: Arial, sans-serif;">${personalizedBody.split('\n').map(l => `<p>${l}</p>`).join('')}</div>`,
          text: personalizedBody,
          metadata: { prospectId: prospect.id, source: 'BulkEmail' },
        }),
      });

      if (response.ok) {
        sent++;
        // Update prospect status
        await handleStatusUpdate('contacted', prospect.id);
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
      console.error(`Failed to send to ${prospect.email}:`, err);
    }

    setBulkEmailProgress({ sent, total: eligibleProspects.length, failed });
  }

  setIsSendingBulkEmail(false);
  setBulkEmailModal(false);
  clearSelection();
  
  if (sent > 0) {
    showSuccess('Emails Sent', `Successfully sent ${sent} emails.`);
  }
  if (failed > 0) {
    showWarning('Some Failed', `${failed} emails failed to send.`);
  }
}, [selectedProspects, auth, handleStatusUpdate, clearSelection, showSuccess, showWarning, showError]);

// In JSX - Add to BulkActionsToolbar
<BulkActionsToolbar
  ...
  onSendEmail={() => setBulkEmailModal(true)}
  isSendingEmail={isSendingBulkEmail}
/>

// Add Modal
<BulkEmailModal
  isOpen={bulkEmailModal}
  onClose={() => setBulkEmailModal(false)}
  onConfirm={handleBulkSendEmail}
  selectedProspects={selectedProspects}
  isSending={isSendingBulkEmail}
/>
```

**Validation**: Select 3 prospects → Click Send Email → Modal opens → Click Send → All receive email.

**Tests**:
```typescript
it('sends emails to all selected prospects with email addresses', async () => {
  // Mock fetch
  global.fetch = vi.fn().mockResolvedValue({ ok: true });
  
  // Render and trigger
  // Assert fetch called N times with correct prospects
});
```

---

### T22A.4: Add Email Templates to Config [20 min]

**Files**: `src/config/emailTemplates.ts` (NEW or extend `templates.ts`)

**Task**: Create reusable email templates for bulk sends.

**Implementation**:
```typescript
export const EMAIL_TEMPLATES = [
  {
    id: 'intro_yardflow',
    label: 'YardFlow Introduction',
    subject: 'Reducing trailer dwell time at {company}',
    body: `Hi {first_name},

I noticed {company} is in the logistics/supply chain space and wanted to reach out.

We're helping distribution centers reduce yard congestion and trailer dwell time by 40% with real-time visibility into every asset on the property.

Would you be open to a quick 15-minute call to see if there's a fit?

Best,
The YardFlow Team`,
  },
  {
    id: 'manifest_followup',
    label: 'Manifest 2026 Follow-up',
    subject: 'Great connecting at Manifest',
    body: `Hi {first_name},

It was great connecting at Manifest 2026. I wanted to follow up on our conversation about yard management challenges.

At YardFlow, we're helping companies like {company} gain real-time visibility into their yard operations. I'd love to schedule a quick demo to show you what we've built.

Would next week work for a 15-minute call?

Best,
The YardFlow Team`,
  },
  {
    id: 'tier1_executive',
    label: 'Executive Outreach (Tier 1)',
    subject: 'Quick question about {company} yard ops',
    body: `{first_name},

I'll keep this brief - I know your time is valuable.

We've helped companies reduce yard congestion by 40% and eliminate trailer detention fees. Given {company}'s scale, I suspect you're leaving money on the table.

Worth a 10-minute conversation?

Best,
The YardFlow Team`,
  },
];
```

**Validation**: Templates appear in BulkEmailModal dropdown.

---

### T22A.5: Progress Indicator During Bulk Send [15 min]

**Files**: `src/components/BulkEmailModal.tsx`

**Task**: Show live progress during send operation.

**Implementation**:
```tsx
// Add progress display
{isSending && (
  <div className="mt-4">
    <div className="flex justify-between text-sm mb-1">
      <span>Sending...</span>
      <span>{progress.sent}/{progress.total}</span>
    </div>
    <div className="w-full bg-slate-200 rounded h-2">
      <div 
        className="bg-blue-600 h-2 rounded transition-all"
        style={{ width: `${(progress.sent / progress.total) * 100}%` }}
      />
    </div>
    {progress.failed > 0 && (
      <div className="text-red-500 text-sm mt-1">
        {progress.failed} failed
      </div>
    )}
  </div>
)}
```

**Validation**: Progress bar animates during bulk send.

---

## Sprint 22B: Default Sequences in Firestore (Optional, 1 Hour)

**Goal**: Enable sequence enrollment without Railway  
**Prerequisite**: Firebase Admin access or Firestore console access

### T22B.1: Create Default Sequences via Script [30 min]

**Files**: `scripts/seedDefaultSequences.ts` (NEW)

**Task**: Insert 3 default sequences into Firestore.

```typescript
const DEFAULT_SEQUENCES = [
  {
    id: 'seq_intro_3step',
    name: '3-Step Introduction',
    description: 'Standard intro → follow-up → break-up sequence',
    status: 'active',
    steps: [
      { order: 1, type: 'email', delayDays: 0, templateId: 'intro_yardflow' },
      { order: 2, type: 'email', delayDays: 3, templateId: 'manifest_followup' },
      { order: 3, type: 'email', delayDays: 5, templateId: 'tier1_executive' },
    ],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
  // ... 2 more sequences
];
```

**Validation**: `npm run seed:sequences` creates documents in Firestore.

---

### T22B.2: Wire useSequenceEnrollment to Firestore Fallback [30 min]

**Files**: `src/hooks/useSequenceEnrollment.ts`

**Task**: When Railway is disabled, load sequences from Firestore instead.

**Validation**: Sequences dropdown populated without Railway.

---

## Sprint 23: Railway Data Sync (Enhancement, 3 Hours)

**Goal**: All 5,733 prospects in Railway for advanced sequence automation  
**Prerequisite**: Railway backend running, `RAILWAY_API_URL` set

### T23.1: Configure Environment Variables [15 min]

**Files**: Vercel Dashboard

**Task**: Set production environment variables:
```
VITE_RAILWAY_ENABLED=true
VITE_RAILWAY_EMAIL_ENABLED=true
VITE_RAILWAY_DATA_ENABLED=true
RAILWAY_API_URL=https://yardflow-hitlist-production-2f41.up.railway.app
RAILWAY_API_SECRET=<shared secret>
```

**Validation**: Feature flags log shows Railway enabled.

---

### T23.2: Run Migration Script [1 hour]

**Files**: `scripts/migrateProspectsToRailway.ts`

**Task**: Migrate all local prospects to Railway.

```bash
# Dry run first
npx tsx scripts/migrateProspectsToRailway.ts --dry-run

# Full migration
npx tsx scripts/migrateProspectsToRailway.ts
```

**Validation**: Railway `/api/prospects` returns 5,733 prospects.

---

### T23.3: Alternative - Batch Upsert via API [30 min]

**Files**: New script or one-time operation

**Task**: If migration script requires Firebase Admin (not available), use Railway API directly.

```typescript
// Read from JSON, batch upsert to Railway
import data from '../src/data/hitlistProspects.json';

const BATCH_SIZE = 100;
for (let i = 0; i < data.length; i += BATCH_SIZE) {
  const batch = data.slice(i, i + BATCH_SIZE);
  await railwayClient.prospects.batchUpsert({
    prospects: batch.map(p => ({
      firstName: p.name.split(' ')[0],
      lastName: p.name.split(' ').slice(1).join(' '),
      email: p.email,
      companyName: p.company,
      title: p.title,
      tier: p.tier,
      score: p.score,
    })),
    updateOnConflict: true,
  });
}
```

**Validation**: Railway DB matches local JSON count.

---

## Sprint 24: Bulk Operations & Automation (2 Hours)

### T24.1: Batch Status Updates [30 min]

**Task**: After bulk email, update all prospects to "contacted" in one batch.

### T24.2: Email Queue Dashboard [45 min]

**Task**: Add tab showing email queue status, sent count, bounce rate.

### T24.3: One-Click "Email All Tier 1" [30 min]

**Task**: Quick action button for filtered views.

---

## Execution Checklist

### Sprint 22A (MVP - TODAY)
- [ ] T22A.1: Add Send Email button to BulkActionsToolbar
- [ ] T22A.2: Create BulkEmailModal component
- [ ] T22A.3: Wire handleBulkSendEmail in App.tsx
- [ ] T22A.4: Add email templates to config
- [ ] T22A.5: Progress indicator

### Sprint 22B (Optional)
- [ ] T22B.1: Seed default sequences
- [ ] T22B.2: Firestore fallback for useSequenceEnrollment

### Sprint 23 (Railway)
- [ ] T23.1: Environment variables
- [ ] T23.2/T23.3: Migration

---

## Definition of Done

**Sprint 22A Complete When**:
1. `npm run build` passes
2. Select 5 prospects with email → Click "Send Email" → Modal opens
3. Click Send → All 5 receive email (check SendGrid activity)
4. Progress bar shows during send
5. Prospects marked as "contacted" after send

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Rate limit (20 emails/day warmup) | Set `BYPASS_EMAIL_WARMUP=true` in Vercel |
| SendGrid quota | Monitor usage in SendGrid dashboard |
| Personalization errors | Show preview before send |
| Partial failure | Continue sending on error, report count at end |

---

## Files Changed Summary

### Sprint 22A (New/Modified)
```
src/components/BulkActionsToolbar.tsx (modified)
src/components/BulkEmailModal.tsx (NEW)
src/config/emailTemplates.ts (NEW or extend templates.ts)
src/App.tsx (modified - add handler + modal)
```

### Tests
```
src/__tests__/components/BulkEmailModal.test.tsx (NEW)
src/__tests__/components/BulkActionsToolbar.test.tsx (update)
```

---

## Quick Start

```bash
# Build to verify no errors
npm run build

# Test locally
npm run dev

# After deployment, verify warmup bypass
curl -X POST https://gtm-yard-flow.vercel.app/api/email/health
```

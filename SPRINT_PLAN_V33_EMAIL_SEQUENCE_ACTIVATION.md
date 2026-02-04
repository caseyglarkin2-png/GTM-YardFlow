# Sprint Plan V33: Email & Sequence Activation

**Status**: 🚀 ACTIVE  
**Created**: February 4, 2026  
**Goal**: Fix sequence loading, enable company-level email, activate full outreach workflow  
**North Star**: User selects company → sends bulk email to all contacts OR enrolls in sequence

---

## Executive Summary

### Current State Analysis

**What Works:**
- ✅ `BulkEmailModal` - Sends emails to selected prospects
- ✅ `BulkSequenceModal` - UI exists for assigning sequences
- ✅ `SequenceBuilder` - Can create/edit sequences  
- ✅ `SequenceTemplateLibrary` - Template selection UI exists
- ✅ `useSequences` hook - Railway CRUD operations
- ✅ `useSequenceEnrollment` hook - Enrollment operations
- ✅ Email templates (`SEQUENCE_TEMPLATES`, `MANIFEST_SEQUENCES`)
- ✅ Cron jobs for sequence execution (`/api/cron/execute-sequences`)

**What's Broken (Screenshot Issue):**
- ❌ **"No sequences available"** - `refreshSequences()` in `useSequenceEnrollment` queries **Firestore**, not Railway
- ❌ Sequences may not exist in either Firestore OR Railway (never migrated)
- ❌ `sequences` prop passed to `BulkSequenceModal` comes from `useSequenceEnrollment`, not `useSequences`

**What's Missing:**
- ❌ **Company-level email action** - Can't send email from CompanyListView
- ❌ **Company-level sequence assignment** - Can't assign all company contacts to sequence
- ❌ **Default sequence seeding** - Templates exist but aren't in database
- ❌ **Sequence templates in modal** - User can't pick from pre-built templates

### Root Cause Analysis

```
User clicks "Assign to Sequence"
         │
         ▼
BulkSequenceModal receives sequences={sequences}
         │
         ▼
sequences comes from useSequenceEnrollment().sequences
         │
         ▼
refreshSequences() queries Firestore collection('sequences')
         │
         ▼
Firestore has NO sequences (never seeded) → "No sequences available"
```

**Fix Strategy:**
1. Seed default sequences to Railway on first load
2. Update `useSequenceEnrollment` to use Railway as source
3. Add company-level email/sequence actions
4. Wire template library into sequence assignment flow

---

## Architecture

### Data Flow (Fixed)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Sequence Assignment Flow                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  User selects prospects → Click "Sequence" button                   │
│         │                                                           │
│         ▼                                                           │
│  BulkSequenceModal opens                                            │
│         │                                                           │
│         ▼                                                           │
│  useSequenceEnrollment.sequences ← Railway API (FIXED)              │
│         │                                                           │
│         ▼                                                           │
│  User selects sequence (or creates from template)                   │
│         │                                                           │
│         ▼                                                           │
│  enrollProspects() → Railway /api/enrollments                       │
│         │                                                           │
│         ▼                                                           │
│  Cron /api/cron/execute-sequences → sends emails on schedule        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Company-Level Actions (New)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Company Action Flow (NEW)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CompanyListView                                                    │
│         │                                                           │
│         ├──▶ [📧 Email All] → Opens BulkEmailModal with company     │
│         │                     contacts pre-selected                 │
│         │                                                           │
│         ├──▶ [📋 Sequence] → Opens BulkSequenceModal with company   │
│         │                    contacts pre-selected                  │
│         │                                                           │
│         └──▶ [🔍 Research] → Existing AI research flow              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Sprint Overview

| Sprint | Focus | Est. Time | Demo |
|--------|-------|-----------|------|
| **S0** | Fix Sequence Loading | 2.5 hours | Modal shows sequences |
| **S1** | Seed Default Sequences | 1.5 hours | 5+ templates available |
| **S2** | Company Email Action | 2.5 hours | Email from company view |
| **S3** | Company Sequence Action | 1.5 hours | Sequence from company view |
| **S4** | Template Selection | 2 hours | Pick template in modal |
| **S5** | E2E Testing | 1.5 hours | Full workflow verified |

**Total**: ~11.5 hours

---

## Sprint S0: Fix Sequence Loading (2 hours)

**Goal**: BulkSequenceModal shows available sequences  
**Demo**: Open modal → See 5+ sequences (not "No sequences available")

### T0.1: Update useSequenceEnrollment to Use Railway [M - 45 min]

**Task**: Refactor `refreshSequences()` to fetch from Railway API instead of Firestore.

**Files**: `src/hooks/useSequenceEnrollment.ts`

**Current (Broken)**:
```typescript
// Line 228-248: Queries Firestore (empty)
const sequencesRef = collection(db, 'sequences');
const q = query(sequencesRef, where('status', 'in', ['active', 'draft']));
const snapshot = await getDocs(q);
```

**Fixed**:
```typescript
const refreshSequences = useCallback(async () => {
  setIsLoadingSequences(true);
  setSequencesError(null);
  
  try {
    // Priority 1: Use Railway if enabled
    if (featureFlags.RAILWAY_ENABLED) {
      const result = await railwayClient.sequences.list();
      
      if (result.ok && result.data) {
        const railwaySequences: SequenceOption[] = result.data.map(seq => ({
          id: seq.id,
          name: seq.name,
          description: seq.description || undefined,
          stepCount: seq.steps?.length || 0,
          activeProspects: seq.activeEnrollmentCount || 0,
          status: seq.status as 'active' | 'paused' | 'draft',
        }));
        
        setSequences(railwaySequences);
        return;
      }
    }
    
    // Fallback: Use default templates when Railway unavailable
    const defaultSequences: SequenceOption[] = MANIFEST_SEQUENCES.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      stepCount: t.steps.length,
      activeProspects: 0,
      status: 'active' as const,
    }));
    
    setSequences(defaultSequences);
  } catch (err) {
    console.error('[useSequenceEnrollment] Failed to load sequences:', err);
    setSequencesError(err instanceof Error ? err.message : 'Failed to load sequences');
    
    // Even on error, show default templates
    const fallbackSequences: SequenceOption[] = MANIFEST_SEQUENCES.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      stepCount: t.steps.length,
      activeProspects: 0,
      status: 'active' as const,
    }));
    setSequences(fallbackSequences);
  } finally {
    setIsLoadingSequences(false);
  }
}, []);
```

**Validation**:
```typescript
// src/__tests__/hooks/useSequenceEnrollment.test.ts
describe('refreshSequences', () => {
  it('fetches sequences from Railway when enabled', async () => {
    vi.mocked(featureFlags.RAILWAY_ENABLED).mockReturnValue(true);
    vi.mocked(railwayClient.sequences.list).mockResolvedValue({
      ok: true,
      data: [{ id: 'seq-1', name: 'Test Sequence', steps: [], status: 'active' }],
    });
    
    const { result } = renderHook(() => useSequenceEnrollment());
    await act(() => result.current.refreshSequences());
    
    expect(result.current.sequences).toHaveLength(1);
    expect(result.current.sequences[0].name).toBe('Test Sequence');
  });

  it('falls back to default templates when Railway fails', async () => {
    vi.mocked(featureFlags.RAILWAY_ENABLED).mockReturnValue(true);
    vi.mocked(railwayClient.sequences.list).mockRejectedValue(new Error('Network error'));
    
    const { result } = renderHook(() => useSequenceEnrollment());
    await act(() => result.current.refreshSequences());
    
    expect(result.current.sequences.length).toBeGreaterThan(0);
    expect(result.current.sequencesError).toBeTruthy();
  });
});
```

**Exit Criteria**: 
- [ ] `refreshSequences()` calls Railway API first
- [ ] Falls back to `MANIFEST_SEQUENCES` on failure
- [ ] Tests pass

---

### T0.2: Add Auto-Refresh on Mount [S - 20 min]

**Task**: Automatically load sequences when `useSequenceEnrollment` mounts.

**Files**: `src/hooks/useSequenceEnrollment.ts`

**Current State**: `refreshSequences()` is extracted from the hook but NEVER called automatically.

**Implementation** (add after other useEffects, around line 170):
```typescript
// Auto-load sequences on mount
useEffect(() => {
  refreshSequences();
}, [refreshSequences]);
```

**Exit Criteria**: Opening BulkSequenceModal triggers automatic sequence fetch.

---

### T0.3: Pass isLoadingSequences to Modal [S - 15 min]

**Task**: Wire `isLoadingSequences` from hook through to modal.

**Files**: `src/App.tsx`

**Current Code** (line ~2068):
```typescript
isLoading={isEnrolling}  // Missing isLoadingSequences
```

**Fixed Code**:
```typescript
<BulkSequenceModal
  isOpen={bulkActionModal === 'sequence'}
  onClose={() => setBulkActionModal(null)}
  onConfirm={handleBulkAssignSequence}
  selectedCount={selectedCount}
  sequences={sequences}
  isLoading={isLoadingSequences || isEnrolling}  // FIXED: Add isLoadingSequences
  error={sequencesError}  // NEW: Pass error state
  onRetry={refreshSequences}
/>
```

**Exit Criteria**: Spinner shows during load, error shows on failure with retry button.

---

### T0.3b: Update BulkSequenceModal Props [XS - 10 min]

**Task**: Add `error` prop to BulkSequenceModal interface.

**Files**: `src/components/BulkSequenceModal.tsx`

**Implementation**:
```typescript
interface BulkSequenceModalProps {
  // ... existing props
  error?: string | null;  // NEW
}

// In component, show error state
{error && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
    <p className="text-red-700 text-sm">{error}</p>
    {onRetry && (
      <button onClick={onRetry} className="text-red-600 underline text-sm mt-1">
        Try again
      </button>
    )}
  </div>
)}
```

**Exit Criteria**: Modal shows error with retry option.

---

### T0.4: Handle Empty Railway Response [S - 15 min]

**Task**: When Railway returns empty array (valid but no sequences), fall back to templates.

**Files**: `src/hooks/useSequenceEnrollment.ts`

**Add to refreshSequences()** (after Railway call):
```typescript
if (result.ok && result.data) {
  // Handle empty Railway response - use default templates
  if (result.data.length === 0) {
    console.info('[useSequenceEnrollment] Railway returned empty, using default templates');
    const defaultSequences: SequenceOption[] = MANIFEST_SEQUENCES.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      stepCount: t.steps.length,
      activeProspects: 0,
      status: 'active' as const,
    }));
    setSequences(defaultSequences);
    return;
  }
  
  // Normal case: use Railway sequences
  const railwaySequences: SequenceOption[] = result.data.map(seq => ({ ... }));
  setSequences(railwaySequences);
  return;
}
```

**Exit Criteria**: Empty Railway response shows default templates, not empty state.

---

### T0.5: Verify Modal Shows Sequences [XS - 10 min]

**Task**: Manual verification that sequences appear.

**Steps**:
1. Start dev server: `npm run dev`
2. Select 2+ prospects
3. Click "Sequence" in toolbar
4. Verify sequences appear (not "No sequences available")

**Exit Criteria**: Modal displays at least 3 sequences.

---

### T0.6: Add Sequence Loading Tests [S - 30 min]

**Task**: Test the sequence loading flow end-to-end.

**Files**: `src/__tests__/components/BulkSequenceModal.test.tsx` (new)

**Implementation**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BulkSequenceModal } from '../../components/BulkSequenceModal';

const mockSequences = [
  { id: 'seq-1', name: 'Cold Outreach', stepCount: 4, activeProspects: 10, status: 'active' as const },
  { id: 'seq-2', name: 'Manifest Follow-up', stepCount: 3, activeProspects: 5, status: 'active' as const },
];

describe('BulkSequenceModal', () => {
  it('shows sequences when loaded', () => {
    render(
      <BulkSequenceModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        selectedCount={5}
        sequences={mockSequences}
        isLoading={false}
      />
    );
    
    expect(screen.getByText('Cold Outreach')).toBeInTheDocument();
    expect(screen.getByText('Manifest Follow-up')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <BulkSequenceModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        selectedCount={5}
        sequences={[]}
        isLoading={true}
      />
    );
    
    expect(screen.getByRole('status')).toBeInTheDocument(); // Spinner
  });

  it('shows empty state when no sequences', () => {
    render(
      <BulkSequenceModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        selectedCount={5}
        sequences={[]}
        isLoading={false}
      />
    );
    
    expect(screen.getByText(/no sequences available/i)).toBeInTheDocument();
  });
});
```

**Exit Criteria**: All 3 test cases pass.

---

## Sprint S1: Seed Default Sequences (1.5 hours)

**Goal**: Ensure default sequences exist in Railway  
**Demo**: 5+ production-ready sequences available for enrollment

### T1.1: Create Sequence Seeding Script [M - 45 min]

**Task**: Script to seed default sequences to Railway if they don't exist.

**Files**: `scripts/seedSequences.ts`

**Implementation**:
```typescript
#!/usr/bin/env npx ts-node
/**
 * seedSequences.ts - Seed default sequences to Railway
 * 
 * Usage:
 *   npx ts-node scripts/seedSequences.ts
 *   npx ts-node scripts/seedSequences.ts --dry-run
 */

import { MANIFEST_SEQUENCES, SEQUENCE_TEMPLATES } from '../src/data/sequenceTemplates';
import { SEQUENCE_TEMPLATES as SERVICE_TEMPLATES } from '../src/services/EmailSequenceService';

const RAILWAY_API_URL = process.env.RAILWAY_API_URL || 'https://yardflow-hitlist-production.up.railway.app';
const RAILWAY_API_SECRET = process.env.RAILWAY_API_SECRET || process.env.CRON_SECRET;
const DRY_RUN = process.argv.includes('--dry-run');

interface SequencePayload {
  name: string;
  description: string;
  status: 'active' | 'draft';
  steps: {
    order: number;
    type: 'email';
    subject: string;
    body: string;
    delayDays: number;
  }[];
}

async function getExistingSequences(): Promise<string[]> {
  const response = await fetch(`${RAILWAY_API_URL}/api/sequences`, {
    headers: {
      'Authorization': `Bearer ${RAILWAY_API_SECRET}`,
      'x-service-key': RAILWAY_API_SECRET!,
    },
  });
  
  if (!response.ok) {
    console.warn('Could not fetch existing sequences:', response.status);
    return [];
  }
  
  const data = await response.json();
  return (data.data || data || []).map((s: any) => s.name);
}

async function createSequence(payload: SequencePayload): Promise<boolean> {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would create: ${payload.name}`);
    return true;
  }
  
  const response = await fetch(`${RAILWAY_API_URL}/api/sequences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RAILWAY_API_SECRET}`,
      'x-service-key': RAILWAY_API_SECRET!,
    },
    body: JSON.stringify(payload),
  });
  
  if (response.ok) {
    console.log(`✅ Created: ${payload.name}`);
    return true;
  } else {
    const error = await response.text();
    console.error(`❌ Failed to create ${payload.name}: ${error}`);
    return false;
  }
}

async function main() {
  console.log('🌱 Seeding Default Sequences to Railway\n');
  
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }
  
  // Combine all templates
  const allTemplates = [...MANIFEST_SEQUENCES, ...SERVICE_TEMPLATES];
  
  // Get existing
  const existing = await getExistingSequences();
  console.log(`Found ${existing.length} existing sequences\n`);
  
  let created = 0;
  let skipped = 0;
  
  for (const template of allTemplates) {
    if (existing.includes(template.name)) {
      console.log(`⏭️  Skipping (exists): ${template.name}`);
      skipped++;
      continue;
    }
    
    const payload: SequencePayload = {
      name: template.name,
      description: template.description,
      status: 'active',
      steps: template.steps.map((step, idx) => ({
        order: idx + 1,
        type: 'email',
        subject: step.subjectTemplate,
        body: step.bodyTemplate,
        delayDays: step.delayDays,
      })),
    };
    
    const success = await createSequence(payload);
    if (success) created++;
  }
  
  console.log(`\n📊 Summary: ${created} created, ${skipped} skipped`);
}

main().catch(console.error);
```

**Validation**:
```bash
npx ts-node scripts/seedSequences.ts --dry-run
# Should output: [DRY RUN] Would create: Manifest Conference Intro...
```

**Exit Criteria**: Script runs without error, lists sequences to create.

---

### T1.2: Run Seeding Script [XS - 15 min]

**Task**: Execute seeding script against Railway.

**Steps**:
```bash
# Set env vars
export RAILWAY_API_URL="https://yardflow-hitlist-production-2f41.up.railway.app"
export RAILWAY_API_SECRET="your-secret"

# Run seeding
npx ts-node scripts/seedSequences.ts
```

**Exit Criteria**: 5+ sequences created in Railway.

---

### T1.3: Verify Sequences in API [XS - 10 min]

**Task**: Confirm sequences are available via API.

**Validation**:
```bash
curl -s "$RAILWAY_API_URL/api/sequences" \
  -H "Authorization: Bearer $RAILWAY_API_SECRET" \
  -H "x-service-key: $RAILWAY_API_SECRET" | jq '.data[].name'
```

**Exit Criteria**: API returns list of sequence names.

---

### T1.4: Add Seeding to CI/CD [S - 20 min]

**Task**: Optionally run seeding on deploy (idempotent).

**Files**: `package.json`, `vercel.json`

**Implementation**:
```json
// package.json
{
  "scripts": {
    "seed:sequences": "ts-node scripts/seedSequences.ts",
    "seed:sequences:dry-run": "ts-node scripts/seedSequences.ts --dry-run"
  }
}
```

**Exit Criteria**: `npm run seed:sequences` works.

---

## Sprint S2: Company Email Action (2 hours)

**Goal**: Send bulk email from company view  
**Demo**: Click company → Click "Email All" → BulkEmailModal opens with contacts

### T2.1: Add Email Action to CompanyListView [M - 45 min]

**Task**: Add "Email All" button to company row actions.

**Files**: `src/components/CompanyListView.tsx`

**Current Props**:
```typescript
interface CompanyListViewProps {
  companies: CompanyRow[];
  onCompanySelect: (company: CompanyRow) => void;
  onContactSelect: (prospect: Prospect) => void;
  onResearchClick?: (company: CompanyRow) => void;
  isResearching?: string | null;
  // ... more props
}
```

**Add Props**:
```typescript
interface CompanyListViewProps {
  // ... existing props
  onEmailCompany?: (company: CompanyRow) => void;
  onSequenceCompany?: (company: CompanyRow) => void;
}
```

**Implementation** (add to row actions area):
```tsx
{/* Company Action Buttons */}
<div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
  {/* Email All */}
  {onEmailCompany && company.contacts?.filter(c => c.email).length > 0 && (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onEmailCompany(company);
      }}
      className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50"
      title={`Email ${company.contacts?.filter(c => c.email).length} contacts`}
    >
      <Mail className="h-4 w-4" />
    </button>
  )}
  
  {/* Sequence All */}
  {onSequenceCompany && company.contacts?.filter(c => c.email).length > 0 && (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onSequenceCompany(company);
      }}
      className="p-1.5 rounded-md text-purple-600 hover:bg-purple-50"
      title={`Add ${company.contacts?.filter(c => c.email).length} to sequence`}
    >
      <Zap className="h-4 w-4" />
    </button>
  )}
  
  {/* Research (existing) */}
  {onResearchClick && (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onResearchClick(company);
      }}
      className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50"
      disabled={isResearching === company.company}
    >
      {isResearching === company.company ? (
        <Loader className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
    </button>
  )}
</div>
```

**Exit Criteria**: Email/Sequence buttons visible on hover over company row.

---

### T2.2: Wire Company Email Handler in App.tsx [M - 45 min]

**Task**: Handle company email action by selecting contacts and opening modal.

**Files**: `src/App.tsx`

**Implementation**:
```typescript
// Add handler
const handleEmailCompany = useCallback((company: CompanyRow) => {
  // Get all contacts with email for this company
  const companyContacts = prospects.filter(
    p => p.company === company.company && p.email
  );
  
  if (companyContacts.length === 0) {
    showWarning('No Emails', 'No contacts have email addresses for this company.');
    return;
  }
  
  // Select all company contacts
  clearSelection();
  companyContacts.forEach(c => toggleSelection(c.id));
  
  // Open bulk email modal
  setBulkEmailModalOpen(true);
  
  showInfo(
    'Company Email',
    `Selected ${companyContacts.length} contacts from ${company.company}`
  );
}, [prospects, clearSelection, toggleSelection, showWarning, showInfo]);

// Pass to CompanyListView in HitlistPanel
<CompanyListView
  companies={companies}
  onCompanySelect={onSelectCompany}
  onContactSelect={onSelectProspect}
  onResearchClick={onResearchClick}
  isResearching={isResearchingCompany}
  onEmailCompany={handleEmailCompany}  // NEW
  onSequenceCompany={handleSequenceCompany}  // NEW (Sprint S3)
/>
```

**Exit Criteria**: Clicking email button selects contacts and opens modal.

---

### T2.3: Update HitlistPanel Props Interface [S - 20 min]

**Task**: Add company action props to HitlistPanel interface and wire through.

**Files**: `src/components/panels/HitlistPanel.tsx`

**Current HitlistPanelProps** (missing email/sequence handlers):
```typescript
interface HitlistPanelProps {
  // ... existing props like companies, onResearchClick, etc.
}
```

**Updated Interface**:
```typescript
interface HitlistPanelProps {
  // ... existing props
  onEmailCompany?: (company: CompanyRow) => void;
  onSequenceCompany?: (company: CompanyRow) => void;
}
```

**Wire to CompanyListView** (inside HitlistPanel component):
```tsx
<CompanyListView
  companies={companies}
  onCompanySelect={onSelectCompany}
  onContactSelect={onSelectProspect}
  onResearchClick={onResearchClick}
  isResearching={isResearchingCompany}
  onEmailCompany={onEmailCompany}  // NEW
  onSequenceCompany={onSequenceCompany}  // NEW
/>
```

**Exit Criteria**: Props flow from App → HitlistPanel → CompanyListView.

---

### T2.4: Wire HitlistPanel in App.tsx [S - 15 min]

**Task**: Pass company action handlers to HitlistPanel in App.tsx.

**Files**: `src/App.tsx`

**Find HitlistPanel usage and add props**:
```tsx
<HitlistPanel
  // ... existing props
  onEmailCompany={handleEmailCompany}
  onSequenceCompany={handleSequenceCompany}
/>
```

**Exit Criteria**: Company actions flow through to CompanyListView.

---

### T2.5: Test Company Email Flow [S - 30 min]

**Task**: Write tests for company email action.

**Files**: `src/__tests__/components/CompanyListView.test.tsx`

**Implementation**:
```typescript
describe('Company Actions', () => {
  it('shows email button for companies with emailable contacts', () => {
    const company = {
      company: 'Acme Corp',
      contacts: [
        { id: '1', email: 'john@acme.com' },
        { id: '2', email: 'jane@acme.com' },
      ],
    };
    
    render(
      <CompanyListView
        companies={[company]}
        onCompanySelect={vi.fn()}
        onContactSelect={vi.fn()}
        onEmailCompany={vi.fn()}
      />
    );
    
    // Hover to show actions
    fireEvent.mouseEnter(screen.getByText('Acme Corp').closest('div')!);
    
    expect(screen.getByTitle(/email 2 contacts/i)).toBeInTheDocument();
  });

  it('calls onEmailCompany when email button clicked', async () => {
    const onEmailCompany = vi.fn();
    const company = { company: 'Acme Corp', contacts: [{ id: '1', email: 'test@test.com' }] };
    
    render(
      <CompanyListView
        companies={[company]}
        onCompanySelect={vi.fn()}
        onContactSelect={vi.fn()}
        onEmailCompany={onEmailCompany}
      />
    );
    
    fireEvent.mouseEnter(screen.getByText('Acme Corp').closest('div')!);
    fireEvent.click(screen.getByTitle(/email 1 contacts/i));
    
    expect(onEmailCompany).toHaveBeenCalledWith(company);
  });
});
```

**Exit Criteria**: Tests pass.

---

## Sprint S3: Company Sequence Action (1.5 hours)

**Goal**: Assign company contacts to sequence from company view  
**Demo**: Click company → Click "Sequence" → BulkSequenceModal opens

### T3.1: Wire Company Sequence Handler [M - 30 min]

**Task**: Handle company sequence action similar to email.

**Files**: `src/App.tsx`

**Implementation**:
```typescript
const handleSequenceCompany = useCallback((company: CompanyRow) => {
  const companyContacts = prospects.filter(
    p => p.company === company.company && p.email
  );
  
  if (companyContacts.length === 0) {
    showWarning('No Emails', 'No contacts have email addresses for this company.');
    return;
  }
  
  // Select all company contacts
  clearSelection();
  companyContacts.forEach(c => toggleSelection(c.id));
  
  // Open sequence modal
  setBulkActionModal('sequence');
  
  showInfo(
    'Company Sequence',
    `Selected ${companyContacts.length} contacts from ${company.company}`
  );
}, [prospects, clearSelection, toggleSelection, showWarning, showInfo]);
```

**Exit Criteria**: Clicking sequence button opens modal with contacts selected.

---

### T3.2: Add Visual Feedback for Company Actions [S - 30 min]

**Task**: Show toast/notification when company action triggered.

**Files**: `src/App.tsx`

**Exit Criteria**: User sees confirmation of action.

---

### T3.3: Test Company Sequence Flow [S - 30 min]

**Task**: Write tests for company sequence action.

**Files**: `src/__tests__/components/CompanyListView.test.tsx`

**Exit Criteria**: Tests pass.

---

## Sprint S4: Template Selection in Modal (2 hours)

**Goal**: User can pick from template library when assigning sequence  
**Demo**: Open sequence modal → Click "Browse Templates" → Pick template → Assign

### T4.1: Add Template Tab to BulkSequenceModal [M - 45 min]

**Task**: Add tabs for "My Sequences" vs "Templates".

**Files**: `src/components/BulkSequenceModal.tsx`

**Implementation**:
```tsx
const [activeTab, setActiveTab] = useState<'sequences' | 'templates'>('sequences');

// Tab selector
<div className="flex border-b border-slate-200 mb-4">
  <button
    onClick={() => setActiveTab('sequences')}
    className={`px-4 py-2 ${activeTab === 'sequences' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}
  >
    My Sequences ({sequences.length})
  </button>
  <button
    onClick={() => setActiveTab('templates')}
    className={`px-4 py-2 ${activeTab === 'templates' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}
  >
    Templates ({templates.length})
  </button>
</div>

{/* Conditional content */}
{activeTab === 'sequences' ? (
  <SequenceList sequences={filteredSequences} ... />
) : (
  <TemplateList templates={templates} onSelect={handleTemplateSelect} />
)}
```

**Exit Criteria**: Tabs switch between sequences and templates.

---

### T4.2: Add Template Props to Modal [S - 30 min]

**Task**: Pass templates to modal.

**Files**: `src/App.tsx`, `src/components/BulkSequenceModal.tsx`

**Implementation**:
```typescript
// Import templates
import { MANIFEST_SEQUENCES } from '@/data/sequenceTemplates';
import { SEQUENCE_TEMPLATES } from '@/services/EmailSequenceService';

const allTemplates = [...MANIFEST_SEQUENCES, ...SEQUENCE_TEMPLATES];

<BulkSequenceModal
  ...
  templates={allTemplates}
  onCreateFromTemplate={handleCreateFromTemplate}
/>
```

**Exit Criteria**: Templates available in modal.

---

### T4.3: Handle Template Selection [M - 45 min]

**Task**: When user picks template, create sequence then enroll.

**Files**: `src/App.tsx`

**Implementation**:
```typescript
const handleCreateFromTemplate = useCallback(async (template: SequenceTemplate): Promise<string | null> => {
  try {
    // Create sequence from template via Railway
    const newSequence = await createSequence({
      name: `${template.name} - ${new Date().toLocaleDateString()}`,
      description: template.description,
      status: 'active',
      steps: template.steps.map((step, idx) => ({
        order: idx + 1,
        type: 'email' as const,
        subject: step.subjectTemplate,
        body: step.bodyTemplate,
        delayDays: step.delayDays,
      })),
    });
    
    if (newSequence) {
      showSuccess('Sequence Created', `Created "${newSequence.name}" from template`);
      return newSequence.id;
    }
    return null;
  } catch (error) {
    showError('Failed', 'Could not create sequence from template');
    return null;
  }
}, [createSequence, showSuccess, showError]);
```

**Exit Criteria**: Template creates sequence and returns ID for enrollment.

---

### T4.4: Test Template Flow [S - 30 min]

**Task**: Test template selection and sequence creation.

**Exit Criteria**: Tests pass.

---

## Sprint S5: E2E Testing (1.5 hours)

**Goal**: Full workflow verified end-to-end  
**Demo**: Run E2E tests, all pass

### T5.1: E2E Test - Sequence Assignment [M - 30 min]

**Task**: Playwright test for sequence assignment flow.

**Files**: `e2e/sequence-assignment.spec.ts`

**Implementation**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Sequence Assignment', () => {
  test('assigns prospects to sequence', async ({ page }) => {
    await page.goto('/');
    
    // Select prospects
    await page.click('[data-testid="prospect-checkbox-0"]');
    await page.click('[data-testid="prospect-checkbox-1"]');
    
    // Click sequence button
    await page.click('[data-testid="bulk-assign-sequence"]');
    
    // Wait for modal
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Verify sequences loaded (not empty)
    await expect(page.locator('text=No sequences available')).not.toBeVisible({ timeout: 5000 });
    
    // Select first sequence
    await page.click('[data-testid="sequence-option-0"]');
    
    // Confirm
    await page.click('button:has-text("Assign to Sequence")');
    
    // Verify success toast
    await expect(page.locator('text=Enrolled in Sequence')).toBeVisible({ timeout: 5000 });
  });
});
```

**Exit Criteria**: E2E test passes.

---

### T5.2: E2E Test - Company Email [M - 30 min]

**Task**: Playwright test for company email flow.

**Files**: `e2e/company-email.spec.ts`

**Implementation**:
```typescript
test('sends email from company view', async ({ page }) => {
  await page.goto('/');
  
  // Switch to company view
  await page.click('[data-testid="view-mode-companies"]');
  
  // Hover over first company
  await page.hover('[data-testid="company-row-0"]');
  
  // Click email button
  await page.click('[data-testid="company-email-btn"]');
  
  // Verify bulk email modal opens
  await expect(page.locator('[data-testid="bulk-email-modal"]')).toBeVisible();
  
  // Verify contacts pre-selected
  await expect(page.locator('text=Send to')).toContainText(/\d+ prospects/);
});
```

**Exit Criteria**: E2E test passes.

---

### T5.3: Manual QA Checklist [S - 30 min]

**Task**: Walk through all workflows manually.

**Checklist**:
- [ ] Open sequence modal → sequences load (not empty)
- [ ] Select sequence → click assign → prospects enrolled
- [ ] Click company → hover shows email button
- [ ] Click email button → modal opens with contacts
- [ ] Click sequence button → modal opens with contacts
- [ ] Browse templates → select one → sequence created

**Exit Criteria**: All checklist items pass.

---

## Key Files Reference

| Purpose | Location |
|---------|----------|
| Sequence enrollment hook | `src/hooks/useSequenceEnrollment.ts` |
| Sequence CRUD hook | `src/hooks/useSequences.ts` |
| Bulk sequence modal | `src/components/BulkSequenceModal.tsx` |
| Bulk email modal | `src/components/BulkEmailModal.tsx` |
| Company list view | `src/components/CompanyListView.tsx` |
| Hitlist panel | `src/components/panels/HitlistPanel.tsx` |
| Sequence templates | `src/data/sequenceTemplates.ts` |
| Service templates | `src/services/EmailSequenceService.ts` |
| Railway client | `src/services/RailwayApiClient.ts` |
| App.tsx handlers | `src/App.tsx` |

---

## Rollback Plan

### If sequences break:
1. Set `VITE_RAILWAY_ENABLED=false`
2. `useSequenceEnrollment` will use `MANIFEST_SEQUENCES` as fallback

### If company actions break:
1. Remove `onEmailCompany`/`onSequenceCompany` props from CompanyListView
2. Users can still select prospects manually

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Sequence modal shows sequences | 100% of opens |
| Company email click → modal opens | < 500ms |
| Sequence enrollment success rate | > 95% |
| Template → sequence creation | < 2s |

---

## Post-Sprint Checklist

### After S0
- [ ] `refreshSequences()` calls Railway API
- [ ] Fallback to default templates works
- [ ] Empty Railway response falls back to templates
- [ ] Modal shows loading state
- [ ] `isLoadingSequences` passed to modal

### After S1
- [ ] 5+ sequences exist in Railway
- [ ] API returns sequences

### After S2
- [ ] Email button visible on company hover
- [ ] Click → modal opens with contacts selected
- [ ] HitlistPanel props updated
- [ ] Props wired through to CompanyListView

### After S3
- [ ] Sequence button visible on company hover
- [ ] Click → modal opens with contacts selected

### After S4
- [ ] Templates tab visible in modal
- [ ] Template selection creates sequence

### After S5
- [ ] All E2E tests pass
- [ ] Manual QA checklist complete

---

## Review Notes (Subagent Analysis)

### Issues Found & Addressed
1. ✅ `refreshSequences()` queries Firestore, not Railway → T0.1 fixes this
2. ✅ `refreshSequences()` never called on mount → T0.2 adds useEffect
3. ✅ `isLoadingSequences` not passed to modal → T0.3 fixes this
4. ✅ Empty Railway response not handled → T0.4 adds fallback
5. ✅ HitlistPanel props incomplete → T2.3 + T2.4 add wiring
6. ✅ CompanyListView missing email actions → T2.1 adds buttons

### Code Locations Verified
- `useSequenceEnrollment.ts` line 228-248: Firestore query (will be replaced)
- `App.tsx` line 2068: `isLoading={isEnrolling}` (needs `isLoadingSequences`)
- `BulkSequenceModal.tsx` line 1-150: Accepts `sequences`, `isLoading`, `onRetry` props
- `CompanyListView.tsx`: No `onEmailCompany`/`onSequenceCompany` props (will be added)

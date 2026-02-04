# Sprint Plan V32: AI & Email Feature Testing and Fixes

**Status**: 🚀 ACTIVE  
**Created**: February 4, 2026  
**Goal**: Fix AI Research integration, validate Email functionality, ensure all features work E2E  
**North Star**: User can click AI Research on any company, see dossier, and send bulk email

---

## Executive Summary

### Diagnostic Results
| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| AI Chat | ✅ Works | ✅ Wired | ⚠️ Needs E2E test |
| AI Research | ✅ Works | ❌ **NOT WIRED** | 🔴 BROKEN |
| DossierPanel | N/A | ✅ Created | ❌ Not receiving data |
| Email Send | ✅ Works | ✅ Wired | ⚠️ Needs validation |
| Email Stats | ❌ Error | ✅ Has handler | 🟡 AUTH REQUIRED |

### Root Cause Analysis

**AI Research Not Working:**
1. `App.tsx:365` - Variable `_researchResults` is prefixed with underscore (intentionally unused)
2. `HitlistPanel.tsx` renders `CompanyDetailPanel` without `onResearchClick` prop
3. `HitlistPanel.tsx` renders `CompanyListView` without passing existing `onResearchClick` prop
4. `research` results from `App.tsx` are not passed down to `HitlistPanel`
5. Props are defined in `CompanyListView` interface but not wired through `HitlistPanel`

**Email Stats Error:**
1. `api/email/stats.ts` requires authentication (already has error handling!)
2. No Firebase token provided in request
3. Need to either add auth or create public health endpoint

### Subagent Review Findings
- Variable name `_researchResults` → must rename to `researchResults`
- `CompanyListView` already has `onResearchClick` in interface - just needs wiring
- `api/email/stats.ts` already has error handling (S3.3 not needed)
- `needsResearch` field controls button visibility - must verify it's set
- E2E selectors need `data-testid` attributes for reliability

---

## Sprint Overview

| Sprint | Focus | Est. Time | Status | Demo |
|--------|-------|-----------|--------|------|
| **S0** | Critical Pre-work | 30 min | ⏳ Pending | Variables renamed, needsResearch verified |
| **S1** | Wire AI Research Props | 2 hours | ⏳ Pending | Click Research → See loading |
| **S2** | Wire Dossier Data Flow | 1.5 hours | ⏳ Pending | Click Dossier tab → See data |
| **S3** | Fix Email Stats Endpoint | 45 min | ⏳ Pending | Stats endpoint returns data |
| **S4** | E2E Testing Suite | 2.5 hours | ⏳ Pending | All tests pass |
| **S5** | Polish & Error States | 1 hour | ⏳ Pending | Graceful errors everywhere |

**Total**: ~8.25 hours

---

## Sprint S0: Critical Pre-work (30 min)

**Goal**: Fix variable naming and verify prerequisite conditions  
**Demo**: `npx tsc --noEmit` passes, needsResearch field verified

### S0.1: Rename _researchResults to researchResults [10 min]

**Task**: Remove underscore prefix from unused variable.

**Files**: `src/App.tsx` (line 365)

**Changes**:
```typescript
// BEFORE (line 365):
const [_researchResults, setResearchResults] = useState<Map<string, CompanyResearchResult>>(new Map());

// AFTER:
const [researchResults, setResearchResults] = useState<Map<string, CompanyResearchResult>>(new Map());
```

**Validation**:
```bash
npx tsc --noEmit
```

**Exit Criteria**: No TypeScript errors, variable usable.

---

### S0.2: Verify needsResearch Field Is Populated [15 min]

**Task**: Confirm `CompanyRow.needsResearch` is set by `CompanyAggregator`.

**Files**: `src/services/CompanyAggregator.ts` (line 156, 177)

**Verification**:
```typescript
// CompanyAggregator.ts already sets this:
const needsResearch = !enrichment?.facilityCount || !enrichment?.industryCategory;
// ...
return {
  // ...
  needsResearch,
};
```

**Test**: Add console.log in dev to verify field is set:
```bash
npm run dev
# Check browser console for companies with needsResearch: true
```

**Exit Criteria**: At least some companies have `needsResearch: true`.

---

### S0.3: Add data-testid Attributes for E2E Tests [5 min]

**Task**: Add test IDs to research buttons for reliable E2E selection.

**Files**: `src/components/CompanyListView.tsx`, `src/components/CompanyDetailPanel.tsx`

**Implementation**:
```tsx
// In research button:
<button data-testid="research-button" onClick={...}>
```

**Exit Criteria**: Buttons have testid attributes.

---

## Sprint S1: Wire AI Research Props (2 hours)

**Goal**: AI Research button triggers research and shows loading state  
**Demo**: Click "AI Research" on company → see "Researching..." → see success toast

### S1.1: Add Research Props to HitlistPanel Interface [15 min]

**Task**: Extend `HitlistPanelProps` interface with research-related props.

**Files**: `src/components/panels/HitlistPanel.tsx`

**Changes**:
```typescript
import type { CompanyResearchResult } from '../../services/CompanyResearchService';

interface HitlistPanelProps {
  // ... existing props ...
  
  // NEW: AI Research props
  onResearchClick?: (company: CompanyRow) => void;
  isResearchingCompany?: string | null; // Company name being researched
  researchResults?: Map<string, CompanyResearchResult>;
}
```

**Validation**:
```bash
npx tsc --noEmit
```

**Exit Criteria**: TypeScript compiles without errors.

---

### S1.2: Pass Research Props from App.tsx to HitlistPanel [20 min]

**Task**: Wire `handleCompanyResearch`, `isResearchingCompany`, and `researchResults` to HitlistPanel.

**Files**: `src/App.tsx`

**Implementation**:
Find the `<HitlistPanel` JSX and add:
```tsx
<HitlistPanel
  // ... existing props ...
  onResearchClick={handleCompanyResearch}
  isResearchingCompany={isResearchingCompany}
  researchResults={researchResults}
/>
```

**Validation**:
```bash
npm run build
```

**Exit Criteria**: Build succeeds.

---

### S1.3: Wire Research Props to CompanyDetailPanel [20 min]

**Task**: Pass research props from HitlistPanel to CompanyDetailPanel.

**Files**: `src/components/panels/HitlistPanel.tsx`

**Implementation**:
```tsx
if (selectedCompany) {
  return (
    <CompanyDetailPanel
      company={selectedCompany}
      onContactSelect={onSelectProspect}
      onBack={() => onSelectCompany(null)}
      // NEW: Wire research (note: isResearching not isResearchingCompany)
      onResearchClick={() => onResearchClick?.(selectedCompany)}
      isResearching={isResearchingCompany === selectedCompany.company}
      research={researchResults?.get(selectedCompany.company) || null}
    />
  );
}
```

**Validation**:
```typescript
// Unit test
it('passes research props to CompanyDetailPanel', () => {
  const onResearch = vi.fn();
  render(<HitlistPanel onResearchClick={onResearch} ... />);
  // Click research button
  expect(onResearch).toHaveBeenCalled();
});
```

**Exit Criteria**: Research button click triggers handler.

---

### S1.4: Wire Existing Research Props to CompanyListView [15 min]

**Task**: Wire existing `onResearchClick` and `isResearching` props (already in interface) to CompanyListView.

**Files**: `src/components/panels/HitlistPanel.tsx`

**Note**: `CompanyListView` already defines these props in its interface:
```typescript
// CompanyListView already has:
interface CompanyListViewProps {
  onResearchClick?: (company: CompanyRow) => void;
  isResearching?: string | null;
}
```

**Implementation**:
```tsx
return (
  <CompanyListView
    companies={companies}
    onCompanySelect={onSelectCompany}
    onContactSelect={onSelectProspect}
    // NEW: Wire existing props
    onResearchClick={onResearchClick}
    isResearching={isResearchingCompany}
  />
);
```

**Validation**: Visual test - research button visible in company list.

**Exit Criteria**: Research button appears in company list view.

---

### S1.5: Add Unit Test for Research Flow [30 min]

**Task**: Create test for research prop wiring.

**Files**: `src/__tests__/components/HitlistPanel.test.tsx` (new)

**Implementation**:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { HitlistPanel } from '@/components/panels/HitlistPanel';
import { vi, describe, it, expect } from 'vitest';

describe('HitlistPanel', () => {
  const mockCompany = {
    company: 'Sysco',
    tier: 'Tier 1' as const,
    contacts: [],
    contactCount: 0,
    // ... other required fields
  };

  it('calls onResearchClick when research button clicked in company view', () => {
    const onResearchClick = vi.fn();
    
    render(
      <HitlistPanel
        viewMode="companies"
        selectedCompany={mockCompany}
        companies={[mockCompany]}
        onResearchClick={onResearchClick}
        // ... other required props
      />
    );

    const researchButton = screen.getByRole('button', { name: /research/i });
    fireEvent.click(researchButton);
    
    expect(onResearchClick).toHaveBeenCalledWith(mockCompany);
  });

  it('shows loading state when researching', () => {
    render(
      <HitlistPanel
        viewMode="companies"
        selectedCompany={mockCompany}
        companies={[mockCompany]}
        isResearchingCompany="Sysco"
        // ... other required props
      />
    );

    expect(screen.getByText(/researching/i)).toBeInTheDocument();
  });
});
```

**Validation**:
```bash
npm test -- --run HitlistPanel
```

**Exit Criteria**: Tests pass.

---

### S1.6: Manual E2E Validation [20 min]

**Task**: Test research flow in browser.

**Steps**:
1. Run `npm run dev`
2. Navigate to Prospects tab
3. Switch to Company view
4. Select a company
5. Click "AI Research" button
6. Verify loading state appears
7. Verify success toast appears
8. Verify research data stored

**Exit Criteria**: Full flow works in browser.

---

## Sprint S2: Wire Dossier Data Flow (1.5 hours)

**Goal**: Dossier tab shows AI-generated research data  
**Demo**: Click company → Click "AI Dossier" tab → See company insights

### S2.1: Verify DossierPanel Receives Props [15 min]

**Task**: Ensure CompanyDetailPanel passes correct props to DossierPanel.

**Files**: `src/components/CompanyDetailPanel.tsx`

**Verification**: Read code and confirm these props are passed:
- `companyName` - Company name string
- `research` - Research result or null
- `contacts` - Company contacts array
- `isLoading` - Boolean loading state
- `onResearch` - Callback to trigger research
- `onContactClick` - Callback when contact clicked

**Exit Criteria**: All props correctly passed.

---

### S2.2: Add Empty State with Research CTA [20 min]

**Task**: When no research data, show "Research with AI" button.

**Files**: `src/components/panels/DossierPanel.tsx`

**Implementation**: Already exists, verify it works:
```tsx
if (!research || !data) {
  return (
    <div className="p-6 flex flex-col items-center justify-center h-64 text-center">
      <LazyIcon name="Building2" className="h-12 w-12 text-slate-300 mb-4" />
      <h3 className="text-lg font-medium text-slate-700 mb-2">{companyName}</h3>
      <p className="text-slate-500 mb-4">No research data available yet.</p>
      {onResearch && (
        <button onClick={onResearch} className="...">
          Research with AI
        </button>
      )}
    </div>
  );
}
```

**Validation**: Visual test - empty state renders with CTA.

**Exit Criteria**: Empty state shows research button.

---

### S2.3: Test Dossier Data Rendering [30 min]

**Task**: Create unit test for DossierPanel with data.

**Files**: `src/__tests__/components/panels/DossierPanel.test.tsx` (new)

**Implementation**:
```typescript
import { render, screen } from '@testing-library/react';
import { DossierPanel } from '@/components/panels/DossierPanel';
import { vi, describe, it, expect } from 'vitest';

describe('DossierPanel', () => {
  const mockResearch = {
    success: true,
    companyName: 'Sysco',
    researchedAt: new Date(),
    data: {
      description: 'Leading foodservice distributor',
      facilityCount: 300,
      industryCategory: 'foodservice_distribution',
      headquarters: 'Houston, TX',
      talkingPoints: ['High volume', 'Gate congestion'],
      yardPainPoints: ['Detention charges', 'Driver wait times'],
    },
    confidence: { overall: 'high' as const },
  };

  it('renders loading state', () => {
    render(<DossierPanel companyName="Sysco" research={null} isLoading />);
    expect(screen.getByText(/researching/i)).toBeInTheDocument();
  });

  it('renders empty state with research CTA', () => {
    const onResearch = vi.fn();
    render(<DossierPanel companyName="Sysco" research={null} onResearch={onResearch} />);
    expect(screen.getByText(/research with ai/i)).toBeInTheDocument();
  });

  it('renders research data', () => {
    render(<DossierPanel companyName="Sysco" research={mockResearch} />);
    expect(screen.getByText('Leading foodservice distributor')).toBeInTheDocument();
    expect(screen.getByText(/300/)).toBeInTheDocument();
    expect(screen.getByText(/houston/i)).toBeInTheDocument();
  });

  it('renders talking points', () => {
    render(<DossierPanel companyName="Sysco" research={mockResearch} />);
    expect(screen.getByText('High volume')).toBeInTheDocument();
    expect(screen.getByText('Gate congestion')).toBeInTheDocument();
  });
});
```

**Validation**:
```bash
npm test -- --run DossierPanel
```

**Exit Criteria**: All tests pass.

---

### S2.4: E2E Dossier Flow Test [25 min]

**Task**: Verify complete dossier flow in browser.

**Steps**:
1. Run `npm run dev`
2. Select a company
3. Click "AI Research" button
4. Wait for research to complete
5. Click "AI Dossier" tab
6. Verify all sections render:
   - Company Profile
   - Talking Points
   - Yard Pain Points
   - Key Contacts

**Exit Criteria**: Dossier tab shows all research data.

---

## Sprint S3: Fix Email Stats Endpoint (45 min)

**Goal**: Email stats endpoint works without auth for health checks  
**Demo**: `curl /api/email/stats?health=true` returns valid stats

### S3.1: Diagnose Email Stats Error [15 min]

**Task**: Check Vercel logs for specific error.

**Steps**:
```bash
# Test with auth header
curl -s -X GET https://gtm-yard-flow.vercel.app/api/email/stats \
  -H "x-service-key: $RAILWAY_API_SECRET"
```

**Exit Criteria**: Understand the specific error.

---

### S3.2: Add Public Health Mode [30 min]

**Task**: Allow unauthenticated basic health check.

**Files**: `api/email/stats.ts`

**Note**: Error handling already exists in this file! (verified by subagent review)

**Implementation**:
```typescript
// At the start of handler, before auth check:
const isHealthCheck = req.query.health === 'true';

if (isHealthCheck) {
  // Return basic stats without auth
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    // No detailed data for public
  });
  return;
}

// Continue with auth for full stats...
```

**Validation**:
```bash
curl -s https://gtm-yard-flow.vercel.app/api/email/stats?health=true
```

**Exit Criteria**: Health check returns 200.

---

### ~~S3.3: Add Error Handling~~ [ALREADY IMPLEMENTED]

**Status**: ✅ SKIP - Error handling already exists in `api/email/stats.ts`:
```typescript
// Already in codebase:
} catch (error) {
  logger.error('Email stats error:', error instanceof Error ? error : undefined);
  res.status(500).json({ 
    error: 'Failed to fetch email statistics',
    message: error instanceof Error ? error.message : 'Unknown error'
  });
}
```

---

## Sprint S4: E2E Testing Suite (2.5 hours)

**Goal**: Automated tests for AI and Email features  
**Demo**: `npm run test:e2e` passes all AI/Email tests

### S4.1: Create AI Chat E2E Test [30 min]

**Task**: Playwright test for Brain chat.

**Files**: `e2e/ai-chat.spec.ts` (new)

**Implementation**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('AI Brain Chat', () => {
  test('sends message and receives response', async ({ page }) => {
    await page.goto('/');
    
    // Open Brain panel (assuming there's a button)
    await page.getByRole('button', { name: /brain|ai|chat/i }).click();
    
    // Type message
    await page.getByPlaceholder(/ask/i).fill('What are prospect tiers?');
    await page.getByRole('button', { name: /send/i }).click();
    
    // Wait for response
    await expect(page.getByText(/tier 1|tier 2|tier 3/i)).toBeVisible({ timeout: 30000 });
  });
});
```

**Validation**:
```bash
npm run test:e2e -- ai-chat.spec.ts
```

**Exit Criteria**: Test passes.

---

### S4.2: Create AI Research E2E Test [30 min]

**Task**: Playwright test for company research.

**Files**: `e2e/ai-research.spec.ts` (new)

**Note**: Uses `data-testid` attributes added in S0.3 for reliable selectors.

**Implementation**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('AI Company Research', () => {
  test('researches company and shows dossier', async ({ page }) => {
    await page.goto('/');
    
    // Switch to company view (use text pattern from existing tests)
    await page.locator('text=/Companies|Hitlist/i').first().click();
    
    // Select a company with needsResearch: true
    await page.getByText('Sysco').first().click();
    
    // Click research button (uses data-testid from S0.3)
    await page.getByTestId('research-button').click();
    
    // Wait for research to complete
    await expect(page.getByText(/research complete|researched/i)).toBeVisible({ timeout: 60000 });
    
    // Click dossier tab
    await page.getByRole('tab', { name: /dossier/i }).click();
    
    // Verify dossier content
    await expect(page.getByText(/talking points/i)).toBeVisible();
  });
});
```

**Validation**:
```bash
npm run test:e2e -- ai-research.spec.ts
```

**Exit Criteria**: Test passes.

---

### S4.3: Create Email Send E2E Test [30 min]

**Task**: Playwright test for bulk email (mock send).

**Files**: `e2e/bulk-email.spec.ts` (new)

**Note**: Requires `data-testid` attributes on prospect checkboxes.

**Implementation**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Bulk Email', () => {
  test('opens bulk email modal and shows preview', async ({ page }) => {
    await page.goto('/');
    
    // Select prospects with email (using data-testid)
    await page.getByTestId('prospect-checkbox').first().click();
    await page.getByTestId('prospect-checkbox').nth(1).click();
    
    // Click email button
    await page.getByRole('button', { name: /email|send/i }).click();
    
    // Verify modal opens
    await expect(page.getByText(/send email|compose/i)).toBeVisible();
    
    // Fill subject
    await page.getByPlaceholder(/subject/i).fill('Test Subject');
    
    // Verify personalization variables available
    await expect(page.getByText(/\{first_?name\}|\{name\}/i)).toBeVisible();
  });
});
```

**Validation**:
```bash
npm run test:e2e -- bulk-email.spec.ts
```

**Exit Criteria**: Test passes.

---

### S4.4: Add Test Data Fixtures [20 min]

**Task**: Create fixture data for predictable E2E tests.

**Files**: `e2e/fixtures/test-companies.json` (new)

**Implementation**:
```json
{
  "companies": [
    {
      "company": "Test Corp",
      "tier": "Tier 1",
      "needsResearch": true,
      "contacts": [
        { "name": "John Doe", "email": "john@testcorp.com" }
      ]
    }
  ]
}
```

**Exit Criteria**: Fixtures available for tests.

---

### S4.5: Create Test Runner Script [20 min]

**Task**: NPM script to run all AI/Email tests.

**Files**: `package.json`

**Implementation**:
```json
{
  "scripts": {
    "test:ai-email": "vitest run --reporter=verbose src/__tests__/**/DossierPanel* src/__tests__/**/HitlistPanel* && playwright test e2e/ai-*.spec.ts e2e/bulk-email.spec.ts"
  }
}
```

**Validation**:
```bash
npm run test:ai-email
```

**Exit Criteria**: All tests pass.

---

## Sprint S5: Polish & Error States (1 hour)

**Goal**: Graceful error handling throughout  
**Demo**: All error states show helpful messages

### S5.1: Add Research Error State [15 min]

**Task**: Show error UI when research fails.

**Files**: `src/components/panels/DossierPanel.tsx`

**Implementation**: Already exists, verify:
```tsx
if (!research.success && research.error) {
  return (
    <div className="p-6 flex flex-col items-center justify-center h-64 text-center">
      <LazyIcon name="AlertCircle" className="h-12 w-12 text-red-400 mb-4" />
      <h3 className="text-lg font-medium text-slate-700 mb-2">Research Failed</h3>
      <p className="text-red-500 mb-4">{research.error}</p>
      <button onClick={onResearch} className="...">Retry</button>
    </div>
  );
}
```

**Exit Criteria**: Error state renders with retry button.

---

### S5.2: Add Chat Error Handling [15 min]

**Task**: Show error when chat fails.

**Files**: `src/components/panels/ChatPanel.tsx`

**Verification**: Check error handling in sendMessage:
```typescript
catch (error) {
  setMessages(prev => [...prev, {
    role: 'model',
    content: 'Sorry, I encountered an error. Please try again.',
    error: true,
  }]);
}
```

**Exit Criteria**: Chat shows error message on failure.

---

### S5.3: Add Email Queue Error Recovery [15 min]

**Task**: Retry failed emails option.

**Files**: `src/components/BulkEmailModal.tsx`

**Verification**: Check if failed emails have retry option.

**Exit Criteria**: Failed emails can be retried.

---

### S5.4: Add Loading Skeletons [15 min]

**Task**: Add skeleton loading states.

**Files**: Various components

**Implementation**:
- DossierPanel: Skeleton cards while loading
- CompanyDetailPanel: Skeleton for metrics
- ChatPanel: Typing indicator

**Exit Criteria**: Loading states are polished.

---

## Rollback Plan

If any sprint causes regressions:

1. **Revert HitlistPanel changes**:
   ```bash
   git checkout HEAD~1 -- src/components/panels/HitlistPanel.tsx
   ```

2. **Disable AI Research**:
   Set `VITE_AI_MOCK=true` to force mock mode.

3. **Disable Dossier Tab**:
   Comment out dossier tab in CompanyDetailPanel.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Research button hidden** (needsResearch=false) | High | High | S0.2 verifies field is populated |
| **E2E tests flaky** due to selector mismatches | Medium | Medium | S0.3 adds data-testid attributes |
| **Type errors** from interface changes | Low | Low | Run `npx tsc --noEmit` after each task |
| **Railway API timeout** during E2E | Medium | Medium | Add retry logic or mock Railway |
| **Firebase auth required for email stats test** | Medium | Low | S3.2 adds health check mode |
| **Prop drilling depth causes merge conflicts** | Low | Medium | Atomic commits per task |
| **Variable rename breaks existing code** | Low | High | S0.1 is first task, caught by tsc |

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| AI Research success rate | > 90% | Unknown |
| Dossier render time | < 2s | N/A (broken) |
| Email send success | > 95% | Unknown |
| E2E test pass rate | 100% | 0% (not written) |

---

## Key Files Reference

| Purpose | Location |
|---------|----------|
| App.tsx (research handler) | `src/App.tsx` (line 365, 1401-1441) |
| HitlistPanel (needs fixes) | `src/components/panels/HitlistPanel.tsx` |
| CompanyDetailPanel | `src/components/CompanyDetailPanel.tsx` |
| CompanyListView | `src/components/CompanyListView.tsx` |
| DossierPanel | `src/components/panels/DossierPanel.tsx` |
| CompanyAggregator | `src/services/CompanyAggregator.ts` (line 156, 177) |
| Email Stats API | `api/email/stats.ts` |
| AI Chat API | `api/ai/chat.ts` |
| AI Research API | `api/ai/research.ts` |
| CompanyResearchService | `src/services/CompanyResearchService.ts` |

---

## Dependencies Between Sprints

```
S0 (Critical Pre-work) ───┬──► S1 (Wire Research Props)
                          │         │
                          │         └───► S2 (Wire Dossier Data)
                          │                     │
                          │                     └───► S4 (E2E Tests)
                          │                               │
                          │                               └───► S5 (Polish)
                          │                               
                          └──► S3 (Fix Email Stats) ──────────┘
```

S0 must complete first. Then S1-S2 and S3 can run in parallel.

---

## Post-Sprint Checklist

### After S0
- [ ] `_researchResults` renamed to `researchResults`
- [ ] `npx tsc --noEmit` passes
- [ ] At least some companies have `needsResearch: true`
- [ ] Research buttons have `data-testid`

### After S1
- [ ] Research button visible in company view
- [ ] Clicking button triggers research
- [ ] Loading state shows
- [ ] Success/error toast appears

### After S2
- [ ] Dossier tab visible in company detail
- [ ] Empty state shows research CTA
- [ ] Research data renders correctly
- [ ] All sections populated

### After S3
- [ ] Email stats health check works
- [ ] Authenticated stats work
- [ ] Errors return JSON

### After S4
- [ ] All unit tests pass
- [ ] All E2E tests pass
- [ ] Test coverage > 80%

### After S5
- [ ] All error states graceful
- [ ] Loading skeletons polished
- [ ] No console errors

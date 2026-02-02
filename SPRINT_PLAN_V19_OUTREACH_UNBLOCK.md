# Sprint Plan V19: Outreach Throughput Unblock

**Created**: February 1, 2026  
**Status**: Ready for Execution  
**Goal**: Enable Casey + Jake to login → pick company → confirm TAM fit → pick prospect(s) → generate copy → send email/DM → book meeting

---

## Executive Summary

### Current Blockers Identified

| Issue | Impact | Root Cause |
|-------|--------|------------|
| App shows 0 prospects | **CRITICAL** - Demo unusable | `HITLIST_PROSPECTS` has 5,409 prospects but 0 emails; "Has Email" filter shows nothing |
| INP blocking 713.5ms | Poor UX | Rendering 5,409 prospects without virtualization |
| No email enrichment | Can't contact ~80% of prospects | EmailPatternService doesn't exist |
| Railway connection unclear | Data source confusion | Feature flags may be misconfigured |

### Data Assets Available

| Source | Rows | With Email | Status |
|--------|------|------------|--------|
| `enriched attendee list 2.csv` (NEW) | 1,816 | 1,103 (61%) | **Ready to import** |
| `Manifest Speakers (Enriched).csv` | 220 | 173 (79%) | Previously analyzed |
| `People Hitlist v3.csv` | 5,408 | 0 (0%) | Current source - NO emails |
| `Company Hitlist v3.csv` | 2,652 | N/A | Company data only |

### Email Pattern Analysis (from enriched data)

```
687 domains with known patterns:
├── first.last@domain  (247 domains, 36%)
├── first@domain       (230 domains, 33%)
├── f+last@domain      (172 domains, 25%)
├── f.last@domain      (17 domains, 2.5%)
├── firstlast@domain   (13 domains, 2%)
├── first_last@domain  (6 domains, 1%)
└── last@domain        (2 domains, <1%)
```

**Key Insight**: We can infer emails for prospects at 687 companies if we know their name + company.

---

## Sprint Execution Order

```
Sprint 1000: Data Bootstrap [TODAY - 4h]
    ↓ UNBLOCKS DEMO
Sprint 1002: Outreach Flow Polish [3h]
    ↓ PARALLEL WITH
Sprint 1003: Production Reliability [3h]
    ↓ DEFERRED
Sprint 1001: Email Pattern Inference Engine [4h] (optional)
```

**Rationale**: 1,103 verified emails is enough to demo. Sprint 1000 unblocks everything.

---

## Sprint 1000: Data Bootstrap

**Goal**: Prospects with emails visible in the app TODAY  
**Effort**: 4 hours  
**Demoable**: Filter "Has Email" shows 1,000+ prospects  
**Validation**: `npm run build` succeeds + app loads prospects

### T1000.1: Merge Enriched Emails into Hitlist Data [HIGH - 2h]

**Problem**: `generateHitlistData.ts` only parses People Hitlist which has no emails.

**Solution**: Update the script to merge emails from enriched CSV.

**Files to modify**:
- `scripts/generateHitlistData.ts`

**Implementation Steps**:

```typescript
// 1. Load enriched email data
const enrichedEmails = new Map<string, { email: string; confidence: string }>();

// Parse enriched CSV
const enrichedCsv = readFileSync('enriched attendee list 2 - enriched attendee list 2 (1).csv', 'utf-8');
const enrichedRows = parseCSV(enrichedCsv);

for (const row of enrichedRows) {
  const email = row['Email']?.trim();
  if (!email || !email.includes('@')) continue;
  
  // Normalize name for matching
  const firstName = row['First Name']?.trim().toLowerCase() || '';
  const lastName = row['Last Name']?.trim().toLowerCase() || '';
  const company = row['Company Name']?.trim().toLowerCase() || row['Company']?.trim().toLowerCase() || '';
  
  const key = `${firstName}|${lastName}|${company}`;
  enrichedEmails.set(key, { email, confidence: 'verified' });
}

// 2. When generating prospects, check for email match
for (const prospect of rawProspects) {
  const firstName = prospect.name.split(' ')[0].toLowerCase();
  const lastName = prospect.name.split(' ').slice(1).join(' ').toLowerCase();
  const company = prospect.company.toLowerCase();
  
  const key = `${firstName}|${lastName}|${company}`;
  const enriched = enrichedEmails.get(key);
  
  if (enriched) {
    prospect.email = enriched.email;
    prospect.emailConfidence = enriched.confidence;
  }
}
```

**Validation**:
```bash
# After running script:
grep -c '"email":' src/data/hitlistData.ts  # Should show 1000+
npm run build  # Must pass
```

**Test**:
```typescript
// src/__tests__/data/hitlistData.test.ts
it('should have 1000+ prospects with emails', () => {
  const withEmail = HITLIST_PROSPECTS.filter(p => p.email);
  expect(withEmail.length).toBeGreaterThan(1000);
});
```

---

### T1000.2: Add Email Validation During Import [MEDIUM - 30m]

**Problem**: Malformed emails like "N/A", "none", or invalid formats could be imported.

**Files to create**:
- `src/utils/emailValidator.ts`

**Implementation**:
```typescript
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_VALUES = ['n/a', 'none', 'na', 'null', 'undefined', '-', 'test'];

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  if (INVALID_VALUES.includes(normalized)) return false;
  return EMAIL_REGEX.test(normalized);
}

export function sanitizeEmail(email: string): string | null {
  if (!isValidEmail(email)) return null;
  return email.trim().toLowerCase();
}
```

**Test**:
```typescript
describe('emailValidator', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('john.doe@acme.com')).toBe(true);
  });
  
  it('rejects N/A and none', () => {
    expect(isValidEmail('N/A')).toBe(false);
    expect(isValidEmail('none')).toBe(false);
  });
  
  it('rejects malformed emails', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
  });
});
```

---

### T1000.3: Verify Feature Flags and Data Source [MEDIUM - 30m]

**Problem**: Unclear if app loads from Railway or local data.

**Files to modify**:
- `src/App.tsx` (add startup logging)
- `src/config/featureFlags.ts` (verify defaults)

**Implementation**:
```typescript
// Add to App.tsx after imports
if (import.meta.env.DEV) {
  console.log('[YardFlow] Feature Flags:', {
    RAILWAY_ENABLED: featureFlags.RAILWAY_ENABLED,
    RAILWAY_DATA_ENABLED: featureFlags.RAILWAY_DATA_ENABLED,
    DUAL_WRITE_ENABLED: featureFlags.DUAL_WRITE_ENABLED,
  });
}
```

**Check Vercel env vars**:
- `VITE_RAILWAY_ENABLED` - should be `true` or `false`
- `VITE_RAILWAY_DATA_ENABLED` - should be `true` or `false`

**Validation**: Console shows feature flag values on app load.

---

### T1000.4: Add Data Load Error Boundary [MEDIUM - 30m]

**Problem**: If hitlistData.ts fails to load, app may white-screen.

**Files to create**:
- `src/components/DataLoadError.tsx`

**Implementation**:
```typescript
interface DataLoadErrorProps {
  error: Error;
  onRetry: () => void;
}

export function DataLoadError({ error, onRetry }: DataLoadErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-8">
      <div className="text-red-500 mb-4">
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-slate-800 mb-2">Failed to Load Data</h2>
      <p className="text-slate-600 text-center mb-4 max-w-md">
        {error.message}
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Retry
      </button>
    </div>
  );
}
```

---

### T1000.5: Update Prospect Type for Email Confidence [LOW - 15m]

**Files to modify**:
- `src/types/index.ts`

**Add to Prospect type**:
```typescript
export interface Prospect {
  // ... existing fields
  email?: string;
  emailConfidence?: 'verified' | 'high' | 'medium' | 'low' | 'inferred';
}
```

---

## Sprint 1002: Outreach Flow Polish

**Goal**: Optimize the exact flow for Casey + Jake  
**Effort**: 3 hours  
**Demoable**: Complete outreach flow in <60 seconds  
**Validation**: End-to-end flow works

### T1002.1: Fix Empty State with Actionable Message [HIGH - 30m]

**Problem**: "No prospects found" gives no guidance.

**Files to modify**:
- `src/App.tsx` (line ~2743)

**Current**:
```tsx
{filteredProspects.length === 0 && (
  <div className="p-8 text-center text-slate-400 text-sm">
    No prospects found.
  </div>
)}
```

**Improved**:
```tsx
{filteredProspects.length === 0 && (
  <div className="p-8 text-center space-y-3">
    <div className="text-slate-400 text-sm">
      {prospects.length === 0 ? (
        <>
          <p className="font-medium text-slate-600">No prospects loaded</p>
          <p>Import data from the Import tab to get started.</p>
        </>
      ) : (
        <>
          <p className="font-medium text-slate-600">No matches for current filters</p>
          <p>Try adjusting your filters or search query.</p>
        </>
      )}
    </div>
    {prospects.length === 0 && (
      <button
        onClick={() => setActiveTab('import')}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
      >
        Go to Import
      </button>
    )}
    {prospects.length > 0 && (
      <button
        onClick={() => { setFilter(''); setTierFilter('All'); setEmailFilter('all'); }}
        className="px-4 py-2 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300"
      >
        Clear Filters
      </button>
    )}
  </div>
)}
```

**Test**: Verify empty state shows appropriate message based on data state.

---

### T1002.2: Company Drill-Down View [MEDIUM - 1h]

**Problem**: Can't quickly see all prospects at a target company.

**Files to modify**:
- `src/App.tsx` or extract to `src/components/CompanyProspectList.tsx`

**Implementation**:
- When in company view mode, clicking a company filters to show all prospects at that company
- Add "Back to all companies" button
- Show company-level stats: total contacts, emails available

**Acceptance Criteria**:
1. Click company → see all prospects at that company
2. See count: "5 contacts, 3 with email"
3. Back button returns to company list

---

### T1002.3: Quick Copy Actions [MEDIUM - 30m]

**Problem**: Multiple clicks to copy email or message.

**Files to modify**:
- `src/App.tsx` (prospect row actions)

**Implementation**:
```tsx
// Add keyboard shortcut
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selectedProspect?.email) {
      e.preventDefault();
      copyToClipboard(selectedProspect.email);
      showSuccess('Email copied!');
    }
  }
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedProspect]);

// Add copy buttons to prospect row
<button onClick={() => copyToClipboard(prospect.email)} title="Copy email">
  <LazyIcon name="Mail" className="h-4 w-4" />
</button>
```

---

### T1002.4: Filter State Persistence [LOW - 30m]

**Problem**: Filters reset on page reload.

**Files to modify**:
- `src/App.tsx`

**Implementation**:
```typescript
// Load filters from localStorage on mount
useEffect(() => {
  const savedFilters = localStorage.getItem('yardflow-filters');
  if (savedFilters) {
    const { tierFilter, emailFilter, filter } = JSON.parse(savedFilters);
    setTierFilter(tierFilter || 'All');
    setEmailFilter(emailFilter || 'all');
    setFilter(filter || '');
  }
}, []);

// Save filters on change
useEffect(() => {
  localStorage.setItem('yardflow-filters', JSON.stringify({
    tierFilter, emailFilter, filter
  }));
}, [tierFilter, emailFilter, filter]);
```

---

## Sprint 1003: Production Reliability

**Goal**: App works reliably without console errors  
**Effort**: 3 hours  
**Demoable**: Lighthouse INP <200ms  
**Validation**: No console errors, smooth scrolling

### T1003.1: Environment Variable Validation [MEDIUM - 30m]

**Problem**: Missing env vars cause silent failures.

**Files to create**:
- `src/utils/envValidation.ts`

**Implementation**:
```typescript
const REQUIRED_ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_AUTH_DOMAIN',
];

const OPTIONAL_ENV_VARS = [
  'VITE_RAILWAY_ENABLED',
  'VITE_RAILWAY_API_URL',
  'VITE_MEETING_LINK_SHORT',
];

export function validateEnv(): { valid: boolean; missing: string[]; warnings: string[] } {
  const missing = REQUIRED_ENV_VARS.filter(v => !import.meta.env[v]);
  const warnings = OPTIONAL_ENV_VARS.filter(v => !import.meta.env[v]);
  
  if (import.meta.env.DEV) {
    if (missing.length > 0) {
      console.error('[YardFlow] Missing required env vars:', missing);
    }
    if (warnings.length > 0) {
      console.warn('[YardFlow] Missing optional env vars:', warnings);
    }
  }
  
  return { valid: missing.length === 0, missing, warnings };
}
```

**Call at app start**:
```typescript
// In App.tsx
import { validateEnv } from './utils/envValidation';

const envResult = validateEnv();
if (!envResult.valid) {
  console.error('Environment validation failed');
}
```

---

### T1003.2: Virtualize Prospect List [HIGH - 2h]

**Problem**: Rendering 5,409 prospects causes 713.5ms INP.

**Files to modify**:
- `src/App.tsx` (prospect list section)

**Dependencies**:
```bash
npm install @tanstack/react-virtual
```

**Implementation**:
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

// In prospect list rendering:
const parentRef = useRef<HTMLDivElement>(null);

const virtualizer = useVirtualizer({
  count: filteredProspects.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 56, // Row height
  overscan: 10,
});

return (
  <div ref={parentRef} className="flex-1 overflow-auto">
    <div
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        position: 'relative',
      }}
    >
      {virtualizer.getVirtualItems().map(virtualRow => {
        const prospect = filteredProspects[virtualRow.index];
        return (
          <div
            key={prospect.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <ProspectRow prospect={prospect} />
          </div>
        );
      })}
    </div>
  </div>
);
```

**Validation**:
- Open Chrome DevTools → Performance
- Record interaction
- INP should be <200ms

**Test**:
```typescript
it('renders large prospect list without blocking', async () => {
  const startTime = performance.now();
  render(<App />);
  const renderTime = performance.now() - startTime;
  expect(renderTime).toBeLessThan(200);
});
```

---

## Sprint 1001: Email Pattern Inference Engine (DEFERRED)

**Status**: Optional - only needed if 1,103 emails insufficient  
**Effort**: 4 hours  
**Demoable**: Infer emails for 500+ additional prospects

### T1001.1: Create EmailPatternService [2h]

**Files to create**:
- `src/services/EmailPatternService.ts`

```typescript
export type EmailPattern = 
  | 'first.last'    // john.doe@company.com
  | 'first'         // john@company.com
  | 'f+last'        // jdoe@company.com
  | 'f.last'        // j.doe@company.com
  | 'firstlast'     // johndoe@company.com
  | 'first_last'    // john_doe@company.com
  | 'last'          // doe@company.com
  | 'unknown';

export interface PatternMatch {
  email: string;
  pattern: EmailPattern;
  confidence: number; // 0-100
}

export class EmailPatternService {
  private domainPatterns: Map<string, EmailPattern> = new Map();
  
  constructor(patternData?: Record<string, EmailPattern>) {
    if (patternData) {
      for (const [domain, pattern] of Object.entries(patternData)) {
        this.domainPatterns.set(domain, pattern);
      }
    }
  }
  
  detectPattern(
    domain: string,
    samples: Array<{ email: string; firstName: string; lastName: string }>
  ): EmailPattern {
    const patterns: EmailPattern[] = [];
    
    for (const sample of samples) {
      const local = sample.email.split('@')[0].toLowerCase();
      const first = sample.firstName.toLowerCase();
      const last = sample.lastName.toLowerCase();
      
      if (local === first) patterns.push('first');
      else if (local === `${first}.${last}`) patterns.push('first.last');
      else if (local === `${first[0]}${last}`) patterns.push('f+last');
      else if (local === `${first[0]}.${last}`) patterns.push('f.last');
      else if (local === `${first}${last}`) patterns.push('firstlast');
      else if (local === `${first}_${last}`) patterns.push('first_last');
      else if (local === last) patterns.push('last');
    }
    
    // Return most common pattern
    const counts = new Map<EmailPattern, number>();
    patterns.forEach(p => counts.set(p, (counts.get(p) || 0) + 1));
    
    let maxPattern: EmailPattern = 'unknown';
    let maxCount = 0;
    counts.forEach((count, pattern) => {
      if (count > maxCount) {
        maxCount = count;
        maxPattern = pattern;
      }
    });
    
    return maxPattern;
  }
  
  generateEmail(
    firstName: string,
    lastName: string,
    domain: string,
    pattern?: EmailPattern
  ): PatternMatch {
    const p = pattern || this.domainPatterns.get(domain) || 'first.last';
    const f = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const l = lastName.toLowerCase().replace(/[^a-z]/g, '');
    
    let email: string;
    switch (p) {
      case 'first': email = `${f}@${domain}`; break;
      case 'first.last': email = `${f}.${l}@${domain}`; break;
      case 'f+last': email = `${f[0]}${l}@${domain}`; break;
      case 'f.last': email = `${f[0]}.${l}@${domain}`; break;
      case 'firstlast': email = `${f}${l}@${domain}`; break;
      case 'first_last': email = `${f}_${l}@${domain}`; break;
      case 'last': email = `${l}@${domain}`; break;
      default: email = `${f}.${l}@${domain}`;
    }
    
    const confidence = this.domainPatterns.has(domain) ? 85 : 50;
    return { email, pattern: p, confidence };
  }
}
```

### T1001.2: Build Domain Pattern Database [1h]

**Files to create**:
- `src/data/domainPatterns.json`

**Script to generate**:
```python
# scripts/generateDomainPatterns.py
import csv
from collections import Counter, defaultdict
import json

domain_patterns = defaultdict(list)

with open('enriched attendee list 2 - enriched attendee list 2 (1).csv') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # ... pattern detection logic
        pass

# Output: { "acme.com": "first.last", "bigco.com": "f+last" }
output = {}
for domain, patterns in domain_patterns.items():
    if patterns:
        output[domain] = Counter(patterns).most_common(1)[0][0]

with open('src/data/domainPatterns.json', 'w') as f:
    json.dump(output, f, indent=2)
```

---

## Validation Checklist

### Sprint 1000 ✓
- [ ] `npm run build` passes
- [ ] App shows 1000+ prospects with emails
- [ ] "Has Email" filter works
- [ ] Feature flags logged at startup
- [ ] Email validation rejects N/A, none

### Sprint 1002 ✓
- [ ] Empty state shows actionable message
- [ ] Company drill-down works
- [ ] Cmd+C copies selected prospect email
- [ ] Filters persist after reload

### Sprint 1003 ✓
- [ ] Lighthouse INP <200ms
- [ ] No console errors on load
- [ ] Env validation runs on startup

### Sprint 1001 ✓ (if implemented)
- [ ] EmailPatternService tests pass
- [ ] Domain patterns JSON contains 600+ entries
- [ ] Inferred emails show confidence badge

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Data generation breaks existing | Add `--dry-run` flag, git commit before running |
| Railway enabled but returns empty | Fallback to local HITLIST_PROSPECTS |
| Virtualization breaks scroll behavior | Test keyboard navigation after implementation |
| Inferred emails bounce | Mark as "inferred", require verification before send |

---

## Files Changed Summary

### Sprint 1000
```
scripts/generateHitlistData.ts (modified)
src/data/hitlistData.ts (regenerated)
src/utils/emailValidator.ts (new)
src/components/DataLoadError.tsx (new)
src/types/index.ts (modified)
src/__tests__/data/hitlistData.test.ts (new tests)
src/__tests__/utils/emailValidator.test.ts (new)
```

### Sprint 1002
```
src/App.tsx (modified - empty state, drill-down, copy actions, filter persistence)
```

### Sprint 1003
```
src/utils/envValidation.ts (new)
src/App.tsx (modified - virtualization)
package.json (@tanstack/react-virtual dependency)
```

### Sprint 1001 (if implemented)
```
src/services/EmailPatternService.ts (new)
src/data/domainPatterns.json (new)
src/__tests__/services/EmailPatternService.test.ts (new)
```

---

## Quick Start Commands

```bash
# Sprint 1000: Regenerate hitlist with emails
npx tsx scripts/generateHitlistData.ts

# Verify email count
grep -c '"email":' src/data/hitlistData.ts

# Run tests
npm test -- --run emailValidator
npm test -- --run hitlistData

# Build and verify
npm run build

# Sprint 1003: Install virtualization
npm install @tanstack/react-virtual

# Run Lighthouse audit
npx lighthouse https://gtm-yard-flow.vercel.app --view
```

---

## Definition of Done

Each sprint complete when:
1. All tasks have passing tests
2. `npm run build` succeeds
3. Demo works as specified
4. No new console errors
5. PR merged to main
6. Vercel deployment successful

---

## Next Steps After V19

Once outreach flow is unblocked:

1. **Sprint 1004**: Data Quality & Dedup - merge all CSV sources, prevent duplicate imports
2. **Sprint 1005**: Sequence Builder Polish - ensure sequences work with Railway
3. **Sprint 1006**: Meeting Attribution - Calendly webhook → mark as meeting booked
4. Resume Sprint 901+ from V18 (App.tsx decomposition)

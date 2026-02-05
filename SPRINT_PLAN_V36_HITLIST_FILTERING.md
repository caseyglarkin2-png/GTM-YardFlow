# Sprint Plan V36: HitList Filtering & Column UX Improvements

**Status**: ✅ COMPLETE  
**Created**: February 5, 2026  
**Completed**: February 5, 2026  
**Goal**: Make HitList filtering intuitive and columns meaningful for sales workflow  
**North Star**: User can find high-value prospects in <30 seconds with clear, actionable filters

---

## Executive Summary

### Problem Statement
The current HitList view (Companies tab) has usability issues:
1. **Column headers are unclear** - Icons only (👤, 🏢) without labels
2. **GATE? column shows "?" for most** - Unclear meaning without context
3. **ROI column shows same value** - Appears static/placeholder
4. **Tier all shows same value** - 2535 companies all showing T4
5. **No column sorting** - Can't click headers to sort
6. **Limited quick filters** - Only 3 presets (Manifest, T1+Email, Needs Email)
7. **No multi-select filtering** - Can't filter by multiple tiers simultaneously

### Solution Overview
Transform the HitList into a powerful, user-friendly filtering experience:
1. **Clear column headers** with tooltips explaining each metric
2. **Sortable columns** with visual indicators
3. **Smart quick filters** based on sales workflow
4. **Multi-select tier filtering**
5. **Column customization** (show/hide)
6. **Visual data quality indicators** when data is missing/incomplete

### Files Affected
| File | Changes |
|------|---------|
| `src/components/CompanyListView.tsx` | Column headers, sorting, tooltips |
| `src/components/layout/SidebarContent.tsx` | Enhanced quick filters |
| `src/components/MultiSelectDropdown.tsx` | NEW: Multi-select filter component |
| `src/components/SortableHeader.tsx` | NEW: Reusable sortable headers |
| `src/hooks/useSortableTable.ts` | NEW: Sorting logic hook |
| `src/hooks/useColumnPreferences.ts` | NEW: Column visibility preferences |
| `src/services/CompanyAggregator.ts` | Enhanced filtering options |
| `src/__tests__/components/CompanyListView.test.tsx` | Updated tests |
| `src/__tests__/hooks/useSortableTable.test.ts` | NEW: Sorting tests |

---

## Critical Implementation Notes

### Existing Patterns to Leverage
1. **`SortButton` Component** - Already exists in [CompanyListView.tsx](src/components/CompanyListView.tsx#L113-L124). Refactor and extract rather than duplicate.
2. **`useFocusTrap` Hook** - Exists at [src/hooks/useFocusTrap.ts](src/hooks/useFocusTrap.ts). Use for dropdown accessibility.
3. **`useSavedFilters` Hook** - Pattern for localStorage persistence already established.

### Accessibility Requirements (WCAG 2.1 AA)
- All interactive elements must have `focus-visible` styles
- Dropdowns need `role="listbox"` + `aria-multiselectable="true"` + `aria-selected`
- Headers need `aria-sort="ascending|descending|none"`
- Keyboard navigation: Arrow keys, Enter, Escape for all dropdowns

### Type Alignment
- Quick filter `emailStatus` values must match existing filter state type: `'all' | 'has_email' | 'no_email'`
- Tier values must use Railway format: `'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4'`

### Time Estimate Adjustments (from review)
- T36A.3 (Tooltip): 30 → 45 min (no existing Tooltip component)
- T36C.3 (Quick Filter Logic): 45 → 60 min (complex filter combinations)
- T36E.3 (Column Menu): 45 → 60 min (accessibility + keyboard nav)

---

## Sprint Breakdown

| Sprint | Focus | Est. Time | Status | Demo |
|--------|-------|-----------|--------|------|
| **S36A** | Column Clarity | 3 hours | ✅ Complete | Headers have labels + tooltips |
| **S36B** | Sortable Columns | 2.5 hours | ✅ Complete | Click header to sort |
| **S36C** | Enhanced Quick Filters | 2 hours | ✅ Complete | 8+ quick filter presets |
| **S36D** | Multi-Select Tier Filter | 2 hours | ✅ Complete | Check multiple tiers at once |
| **S36E** | Column Customization | 2 hours | ✅ Complete | Show/hide columns menu |
| **S36F** | Data Quality Indicators | 1.5 hours | ✅ Complete | Visual cues for missing data |
| **S36G** | AI Templates for 1-Off Emails | 2.5 hours | ✅ Complete | AI Generate in detail panel |
| **S36H** | Per-Recipient Preview | 2 hours | ✅ Complete | Approve before send |

**Total**: ~17.5 hours (~5 hours complete)

---

## Sprint S36A: Column Clarity (3 hours)

**Goal**: Every column has a clear, understandable header with helpful tooltips  
**Demo**: Hover over any column header → see explanation of what the metric means

---

### T36A.1: Add Text Labels to Icon-Only Headers [M - 45 min]

**Problem**: Current headers use icons only (👤, 🏢, ⚡) which are ambiguous.

**Files**: [src/components/CompanyListView.tsx](src/components/CompanyListView.tsx)

**Current** (line ~180):
```tsx
<span className="w-12 text-center" title="Contacts">
  <Users className="h-3 w-3 mx-auto" />
</span>
```

**Implementation**:
```tsx
<span className="w-14 text-center flex flex-col items-center gap-0.5" title="Number of contacts at this company">
  <Users className="h-3 w-3" aria-hidden="true" />
  <span className="text-[9px] font-normal">Contacts</span>
</span>
```

**All Headers to Update**:
| Current | Icon | New Label | Tooltip |
|---------|------|-----------|---------|
| (people icon) | Users | Contacts | Number of contacts at this company |
| (building icon) | Building2 | Facilities | Estimated distribution facilities count |
| Gate? | Truck | Gate Issue | Likelihood of yard congestion problems |
| ROI | $ | ROI Potential | Estimated annual ROI from solving yard issues |
| (lightning) | Zap | Score | Primo lookalike score (higher = better fit) |

**Validation**:
```typescript
// src/__tests__/components/CompanyListView.test.tsx
it('displays text labels under column icons', () => {
  render(<CompanyListView companies={mockCompanies} {...defaultProps} />);
  expect(screen.getByText('Contacts')).toBeInTheDocument();
  expect(screen.getByText('Facilities')).toBeInTheDocument();
  expect(screen.getByText('Gate Issue')).toBeInTheDocument();
  expect(screen.getByText('ROI Potential')).toBeInTheDocument();
  expect(screen.getByText('Score')).toBeInTheDocument();
});
```

**Exit Criteria**: All column headers have visible text labels.

---

### T36A.2: Add Tooltip Component with Rich Explanations [S - 30 min]

**Problem**: `title` attributes are boring. Need richer tooltips with examples.

**Files**: Create [src/components/Tooltip.tsx](src/components/Tooltip.tsx)

**Implementation**:
```tsx
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export function Tooltip({ 
  children, 
  content, 
  placement = 'top',
  delay = 200 
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const show = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPosition({
          top: placement === 'bottom' ? rect.bottom + 8 : rect.top - 8,
          left: rect.left + rect.width / 2,
        });
      }
      setVisible(true);
    }, delay);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </div>
      {visible && createPortal(
        <div
          role="tooltip"
          className={`
            fixed z-50 px-3 py-2 text-xs bg-slate-800 text-white rounded-lg shadow-lg
            max-w-xs transform -translate-x-1/2
            ${placement === 'bottom' ? '' : '-translate-y-full'}
          `}
          style={{ top: position.top, left: position.left }}
        >
          {content}
          <div 
            className={`
              absolute left-1/2 -translate-x-1/2 border-4 border-transparent
              ${placement === 'bottom' 
                ? '-top-2 border-b-slate-800' 
                : '-bottom-2 border-t-slate-800'
              }
            `}
          />
        </div>,
        document.body
      )}
    </>
  );
}
```

**Validation**:
```typescript
// src/__tests__/components/Tooltip.test.tsx
it('shows tooltip on hover after delay', async () => {
  render(
    <Tooltip content="Helpful text">
      <button>Hover me</button>
    </Tooltip>
  );
  
  await userEvent.hover(screen.getByText('Hover me'));
  await waitFor(() => {
    expect(screen.getByRole('tooltip')).toHaveTextContent('Helpful text');
  }, { timeout: 300 });
});
```

**Exit Criteria**: Tooltip component renders with proper positioning.

---

### T36A.3: Add Rich Tooltips to Column Headers [S - 45 min]

**Files**: [src/components/CompanyListView.tsx](src/components/CompanyListView.tsx)

**Implementation**: Wrap each header in Tooltip with detailed explanations

```tsx
import { Tooltip } from './Tooltip';

// In table header
<Tooltip content={
  <div className="space-y-1">
    <div className="font-semibold">Facilities Count</div>
    <div>Estimated number of distribution centers, warehouses, or yards.</div>
    <div className="text-slate-300">💡 60+ facilities = high-priority target</div>
  </div>
}>
  <span className="w-14 text-center flex flex-col items-center gap-0.5 cursor-help">
    <Building2 className="h-3 w-3" aria-hidden="true" />
    <span className="text-[9px] font-normal">Facilities</span>
  </span>
</Tooltip>
```

**Tooltip Content for Each Column**:
| Column | Tooltip Content |
|--------|-----------------|
| Tier | "Company priority tier based on fit score. T1 = highest priority, T4 = lowest." |
| Contacts | "Number of people at this company in your prospect list. Click to expand and see all contacts." |
| Facilities | "Estimated distribution centers, warehouses, or yards. 💡 60+ = high-priority target" |
| Gate Issue | "Likelihood of yard congestion/gate issues. ✅ = confirmed, ? = unknown. Based on industry + facility data." |
| ROI Potential | "Estimated annual savings from solving yard issues. Based on facility count × average savings." |
| Score | "Primo lookalike score (0-100). Higher = more similar to ideal customer profile. 70+ = hot lead." |

**Exit Criteria**: All headers show rich tooltips on hover.

---

### T36A.4: Add "What's This?" Info Panel [S - 30 min]

**Problem**: New users need context for the scoring system.

**Files**: [src/components/CompanyListView.tsx](src/components/CompanyListView.tsx)

**Implementation**: Collapsible info panel above the table

```tsx
import { HelpCircle } from 'lucide-react';

// Inside component
const [showHelp, setShowHelp] = useState(false);

// In header area, after search
<button
  onClick={() => setShowHelp(!showHelp)}
  className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1"
>
  <HelpCircle className="h-3 w-3" />
  {showHelp ? 'Hide guide' : 'How to use'}
</button>

{showHelp && (
  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs space-y-2">
    <h4 className="font-semibold text-blue-800">Quick Guide</h4>
    <div className="grid grid-cols-2 gap-2 text-blue-700">
      <div><span className="font-medium">T1-T4:</span> Priority tiers (T1 = best)</div>
      <div><span className="font-medium">Score:</span> Fit score (0-100)</div>
      <div><span className="font-medium">Facilities:</span> Distribution sites (60+ = 🔥)</div>
      <div><span className="font-medium">Gate Issue:</span> Yard congestion likelihood</div>
    </div>
    <div className="text-blue-600">💡 Click a row to expand contacts. Click column headers to sort.</div>
  </div>
)}
```

**Validation**:
```typescript
it('toggles help panel visibility', async () => {
  render(<CompanyListView companies={mockCompanies} {...defaultProps} />);
  
  expect(screen.queryByText('Quick Guide')).not.toBeInTheDocument();
  
  await userEvent.click(screen.getByText('How to use'));
  expect(screen.getByText('Quick Guide')).toBeInTheDocument();
  
  await userEvent.click(screen.getByText('Hide guide'));
  expect(screen.queryByText('Quick Guide')).not.toBeInTheDocument();
});
```

**Exit Criteria**: Help panel toggles with clear explanations.

---

### T36A.5: Run Tests & Commit [XS - 15 min]

```bash
npx tsc --noEmit && npm test -- --run CompanyListView Tooltip
git add -A && git commit -m "feat(S36A): add clear column headers with tooltips and help guide"
```

**Exit Criteria**: All tests pass, committed.

---

## Sprint S36B: Sortable Columns (2.5 hours)

**Goal**: Click any column header to sort ascending/descending  
**Demo**: Click "Score" → companies sorted by score desc, click again → asc

---

### T36B.1: Create useSortableTable Hook [M - 45 min]

**Files**: Create [src/hooks/useSortableTable.ts](src/hooks/useSortableTable.ts)

**Implementation**:
```typescript
import { useState, useMemo, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortState<T extends string> {
  column: T;
  direction: SortDirection;
}

export interface UseSortableTableOptions<T extends string> {
  defaultColumn: T;
  defaultDirection?: SortDirection;
  persistKey?: string; // localStorage key
}

export function useSortableTable<T extends string>({
  defaultColumn,
  defaultDirection = 'desc',
  persistKey,
}: UseSortableTableOptions<T>) {
  const [sortState, setSortState] = useState<SortState<T>>(() => {
    if (persistKey) {
      const saved = localStorage.getItem(persistKey);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return { column: defaultColumn, direction: defaultDirection };
  });

  const toggleSort = useCallback((column: T) => {
    setSortState((prev) => {
      const newState: SortState<T> = {
        column,
        direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc',
      };
      if (persistKey) {
        localStorage.setItem(persistKey, JSON.stringify(newState));
      }
      return newState;
    });
  }, [persistKey]);

  const getSortIndicator = useCallback((column: T): 'asc' | 'desc' | null => {
    return sortState.column === column ? sortState.direction : null;
  }, [sortState]);

  return {
    sortState,
    toggleSort,
    getSortIndicator,
  };
}

/**
 * Sort an array of items based on sort state
 */
export function sortItems<T, K extends string>(
  items: T[],
  sortState: SortState<K>,
  getters: Record<K, (item: T) => number | string | null>
): T[] {
  const getter = getters[sortState.column];
  if (!getter) return items;

  return [...items].sort((a, b) => {
    const aVal = getter(a);
    const bVal = getter(b);

    // Handle nulls - push to end
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    // Compare values
    const cmp = typeof aVal === 'string'
      ? aVal.localeCompare(bVal as string)
      : (aVal as number) - (bVal as number);

    return sortState.direction === 'desc' ? -cmp : cmp;
  });
}
```

**Validation**:
```typescript
// src/__tests__/hooks/useSortableTable.test.ts
describe('useSortableTable', () => {
  it('toggles sort direction on same column', () => {
    const { result } = renderHook(() => 
      useSortableTable({ defaultColumn: 'score' as const })
    );
    
    expect(result.current.sortState).toEqual({ column: 'score', direction: 'desc' });
    
    act(() => result.current.toggleSort('score'));
    expect(result.current.sortState.direction).toBe('asc');
    
    act(() => result.current.toggleSort('score'));
    expect(result.current.sortState.direction).toBe('desc');
  });

  it('resets to desc when switching columns', () => {
    const { result } = renderHook(() => 
      useSortableTable({ defaultColumn: 'score' as const })
    );
    
    act(() => result.current.toggleSort('score')); // now asc
    act(() => result.current.toggleSort('facilities')); // switch column
    
    expect(result.current.sortState).toEqual({ column: 'facilities', direction: 'desc' });
  });
});

describe('sortItems', () => {
  const items = [
    { name: 'A', score: 50 },
    { name: 'B', score: 80 },
    { name: 'C', score: null },
  ];

  it('sorts by number desc', () => {
    const sorted = sortItems(items, { column: 'score', direction: 'desc' }, {
      score: (i) => i.score,
    });
    expect(sorted.map(i => i.name)).toEqual(['B', 'A', 'C']);
  });

  it('pushes nulls to end', () => {
    const sorted = sortItems(items, { column: 'score', direction: 'asc' }, {
      score: (i) => i.score,
    });
    expect(sorted.map(i => i.name)).toEqual(['A', 'B', 'C']);
  });
});
```

**Exit Criteria**: Hook works with persistence and null handling.

---

### T36B.2: Create SortableHeader Component [S - 30 min]

**Files**: Create [src/components/SortableHeader.tsx](src/components/SortableHeader.tsx)

**Implementation**:
```tsx
import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface SortableHeaderProps {
  label: string;
  icon?: React.ReactNode;
  tooltip?: React.ReactNode;
  sortDirection: 'asc' | 'desc' | null;
  onClick: () => void;
  className?: string;
}

export function SortableHeader({
  label,
  icon,
  tooltip,
  sortDirection,
  onClick,
  className = '',
}: SortableHeaderProps) {
  const content = (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center gap-0.5 cursor-pointer hover:text-blue-600 transition-colors
        ${sortDirection ? 'text-blue-700' : 'text-slate-500'}
        ${className}
      `}
      aria-sort={sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none'}
    >
      <span className="flex items-center gap-1">
        {icon}
        {sortDirection === 'asc' && <ArrowUp className="h-2.5 w-2.5" />}
        {sortDirection === 'desc' && <ArrowDown className="h-2.5 w-2.5" />}
        {!sortDirection && <ArrowUpDown className="h-2.5 w-2.5 opacity-50" />}
      </span>
      <span className="text-[9px] font-normal">{label}</span>
    </button>
  );

  if (tooltip) {
    return <Tooltip content={tooltip}>{content}</Tooltip>;
  }

  return content;
}
```

**Exit Criteria**: Component shows sort state visually.

---

### T36B.3: Integrate Sorting into CompanyListView [M - 45 min]

**Files**: [src/components/CompanyListView.tsx](src/components/CompanyListView.tsx)

**Implementation**:
```tsx
import { useSortableTable, sortItems } from '../hooks/useSortableTable';
import { SortableHeader } from './SortableHeader';

type SortColumn = 'company' | 'tier' | 'contacts' | 'facilities' | 'gate' | 'roi' | 'score';

// Inside component
const { sortState, toggleSort, getSortIndicator } = useSortableTable<SortColumn>({
  defaultColumn: 'score',
  persistKey: 'company-list-sort',
});

// Sort companies
const sortedCompanies = useMemo(() => {
  return sortItems(companies, sortState, {
    company: (c) => c.company?.toLowerCase() || '',
    tier: (c) => tierRank[c.tier] || 99,
    contacts: (c) => c.contactCount,
    facilities: (c) => c.facilityCount,
    gate: (c) => c.hasGateBottleneck ? 1 : 0,
    roi: (c) => c.roiPotential,
    score: (c) => c.primoLookalikeScore,
  });
}, [companies, sortState]);

const tierRank: Record<string, number> = {
  'Tier 1': 1, 'Tier 2': 2, 'Tier 3': 3, 'Tier 4': 4, 'Unscored': 5,
};

// Update table header
<div className="px-3 py-2 flex items-center gap-2 ...">
  <span className="w-6" />
  <SortableHeader
    label="Company"
    sortDirection={getSortIndicator('company')}
    onClick={() => toggleSort('company')}
    className="flex-1 text-left"
  />
  <SortableHeader
    label="Tier"
    sortDirection={getSortIndicator('tier')}
    onClick={() => toggleSort('tier')}
    tooltip="Company priority tier (T1 = highest)"
    className="w-14"
  />
  {/* ... repeat for other columns */}
</div>
```

**Validation**:
```typescript
it('sorts companies when clicking header', async () => {
  const companies = [
    { ...mockCompany, company: 'Zebra', primoLookalikeScore: 30 },
    { ...mockCompany, company: 'Alpha', primoLookalikeScore: 90 },
  ];
  
  render(<CompanyListView companies={companies} {...defaultProps} />);
  
  // Default sort by score desc
  const rows = screen.getAllByRole('row').slice(1); // skip header
  expect(rows[0]).toHaveTextContent('Alpha'); // score 90
  
  // Click company header to sort A-Z
  await userEvent.click(screen.getByRole('button', { name: /company/i }));
  const sortedRows = screen.getAllByRole('row').slice(1);
  expect(sortedRows[0]).toHaveTextContent('Alpha');
});
```

**Exit Criteria**: All columns sortable with visual indicators.

---

### T36B.4: Persist Sort Preference [XS - 15 min]

Already handled in `useSortableTable` with `persistKey`.

**Validation**:
```typescript
it('persists sort preference to localStorage', () => {
  const { rerender } = render(<CompanyListView companies={mockCompanies} {...defaultProps} />);
  
  await userEvent.click(screen.getByRole('button', { name: /facilities/i }));
  
  // Simulate page reload
  rerender(<CompanyListView companies={mockCompanies} {...defaultProps} />);
  
  expect(screen.getByRole('button', { name: /facilities/i }))
    .toHaveAttribute('aria-sort', 'descending');
});
```

---

### T36B.5: Run Tests & Commit [XS - 15 min]

```bash
npx tsc --noEmit && npm test -- --run useSortableTable SortableHeader CompanyListView
git add -A && git commit -m "feat(S36B): add sortable columns with persistence"
```

---

## Sprint S36C: Enhanced Quick Filters (2 hours)

**Goal**: Sales-oriented quick filter presets for common workflows  
**Demo**: Click "High-Value" → filters to T1-T2 with 60+ facilities

---

### T36C.1: Define Quick Filter Presets [S - 30 min]

**Files**: Create [src/config/quickFilters.ts](src/config/quickFilters.ts)

**Implementation**:
```typescript
export interface QuickFilterPreset {
  id: string;
  label: string;
  emoji: string;
  description: string;
  filters: {
    tiers?: string[];
    emailStatus?: 'has_email' | 'no_email' | 'all';
    tags?: string[];
    minFacilities?: number;
    minScore?: number;
    hasGateIssue?: boolean;
  };
  color: {
    bg: string;
    bgActive: string;
    text: string;
  };
}

export const QUICK_FILTER_PRESETS: QuickFilterPreset[] = [
  {
    id: 'manifest-2026',
    label: 'Manifest 2026',
    emoji: '🎯',
    description: 'Conference attendees',
    filters: { tags: ['Manifest 2026'] },
    color: { bg: 'bg-purple-100', bgActive: 'bg-purple-600', text: 'text-purple-700' },
  },
  {
    id: 't1-ready',
    label: 'T1 Ready',
    emoji: '⭐',
    description: 'Tier 1 with email',
    filters: { tiers: ['Tier 1'], emailStatus: 'has_email' },
    color: { bg: 'bg-amber-100', bgActive: 'bg-amber-600', text: 'text-amber-700' },
  },
  {
    id: 'high-value',
    label: 'High Value',
    emoji: '💰',
    description: '60+ facilities',
    filters: { minFacilities: 60 },
    color: { bg: 'bg-green-100', bgActive: 'bg-green-600', text: 'text-green-700' },
  },
  {
    id: 'hot-leads',
    label: 'Hot Leads',
    emoji: '🔥',
    description: 'Score 70+',
    filters: { minScore: 70 },
    color: { bg: 'bg-orange-100', bgActive: 'bg-orange-600', text: 'text-orange-700' },
  },
  {
    id: 'gate-issues',
    label: 'Gate Issues',
    emoji: '🚛',
    description: 'Confirmed yard problems',
    filters: { hasGateIssue: true },
    color: { bg: 'bg-red-100', bgActive: 'bg-red-600', text: 'text-red-700' },
  },
  {
    id: 'needs-email',
    label: 'Needs Email',
    emoji: '📧',
    description: 'Missing contact email',
    filters: { emailStatus: 'no_email' },
    color: { bg: 'bg-slate-100', bgActive: 'bg-slate-600', text: 'text-slate-700' },
  },
  {
    id: 'needs-research',
    label: 'Needs Research',
    emoji: '🔬',
    description: 'Not yet AI researched',
    // Filter companies where aiResearchDate is null/undefined
    // This requires checking CompanyRow.aiResearchDate field
    filters: { hasAIResearch: false },
    color: { bg: 'bg-blue-100', bgActive: 'bg-blue-600', text: 'text-blue-700' },
  },
  {
    id: 't1-t2',
    label: 'T1 + T2',
    emoji: '🏆',
    description: 'Top two tiers',
    filters: { tiers: ['Tier 1', 'Tier 2'] },
    color: { bg: 'bg-indigo-100', bgActive: 'bg-indigo-600', text: 'text-indigo-700' },
  },
];
```

**Exit Criteria**: Preset config complete with 8+ filters.

---

### T36C.2: Update SidebarContent Quick Filters [M - 45 min]

**Files**: [src/components/layout/SidebarContent.tsx](src/components/layout/SidebarContent.tsx)

**Implementation**:
```tsx
import { QUICK_FILTER_PRESETS, QuickFilterPreset } from '../../config/quickFilters';

// Add new props to SidebarContentProps
interface SidebarContentProps {
  // ... existing props
  onQuickFilterChange?: (preset: QuickFilterPreset | null) => void;
  activeQuickFilter?: string | null;
  minFacilitiesFilter?: number;
  onMinFacilitiesChange?: (min: number | undefined) => void;
  minScoreFilter?: number;
  onMinScoreChange?: (min: number | undefined) => void;
}

// In the quick filters section
<div className="space-y-1.5">
  <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
    Quick Filters
  </span>
  <div className="flex flex-wrap gap-1.5">
    {QUICK_FILTER_PRESETS.map((preset) => {
      const isActive = activeQuickFilter === preset.id;
      return (
        <button
          key={preset.id}
          onClick={() => {
            if (isActive) {
              onQuickFilterChange?.(null);
            } else {
              onQuickFilterChange?.(preset);
            }
          }}
          className={`
            px-2 py-1 text-xs rounded-full transition-colors
            ${isActive 
              ? `${preset.color.bgActive} text-white` 
              : `${preset.color.bg} ${preset.color.text} hover:opacity-80`
            }
          `}
          title={preset.description}
          data-testid={`quick-filter-${preset.id}`}
        >
          {preset.emoji} {preset.label}
        </button>
      );
    })}
  </div>
</div>
```

**Validation**:
```typescript
it('renders all quick filter presets', () => {
  render(<SidebarContent {...defaultProps} />);
  
  QUICK_FILTER_PRESETS.forEach(preset => {
    expect(screen.getByTestId(`quick-filter-${preset.id}`)).toBeInTheDocument();
  });
});

it('activates quick filter on click', async () => {
  const onQuickFilterChange = vi.fn();
  render(<SidebarContent {...defaultProps} onQuickFilterChange={onQuickFilterChange} />);
  
  await userEvent.click(screen.getByTestId('quick-filter-high-value'));
  
  expect(onQuickFilterChange).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'high-value' })
  );
});
```

**Exit Criteria**: 8 quick filter buttons render and toggle correctly.

---

### T36C.3: Wire Quick Filters to App.tsx [M - 60 min]

**Files**: [src/App.tsx](src/App.tsx), [src/services/CompanyAggregator.ts](src/services/CompanyAggregator.ts)

**Note**: Multi-tier filtering (`setMultiTierFilter`) is added in S36D. This task only supports single-tier quick filters until then.

**Implementation** (App.tsx):
```tsx
const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);
const [minFacilitiesFilter, setMinFacilitiesFilter] = useState<number | undefined>();
const [minScoreFilter, setMinScoreFilter] = useState<number | undefined>();

const handleQuickFilterChange = useCallback((preset: QuickFilterPreset | null) => {
  if (!preset) {
    // Clear all quick filter state
    setActiveQuickFilter(null);
    setTierFilter('All');
    setEmailFilter('all');
    setTagFilter(null);
    setMinFacilitiesFilter(undefined);
    setMinScoreFilter(undefined);
    return;
  }

  setActiveQuickFilter(preset.id);
  
  // Apply tier filter (single-tier only until S36D adds multi-select)
  if (preset.filters.tiers?.length === 1) {
    setTierFilter(preset.filters.tiers[0]);
  } else if (preset.filters.tiers?.length > 1) {
    // TODO: S36D will add setMultiTierFilter for multi-tier quick filters
    // For now, just use the first tier
    setTierFilter(preset.filters.tiers[0]);
  }
  
  if (preset.filters.emailStatus) {
    setEmailFilter(preset.filters.emailStatus);
  }
  
  if (preset.filters.tags) {
    setTagFilter(preset.filters.tags[0]);
  }
  
  if (preset.filters.minFacilities) {
    setMinFacilitiesFilter(preset.filters.minFacilities);
  }
  
  if (preset.filters.minScore) {
    setMinScoreFilter(preset.filters.minScore);
  }
}, []);
```

**Exit Criteria**: Quick filters apply correct filter combinations.

---

### T36C.4: Run Tests & Commit [XS - 15 min]

```bash
npx tsc --noEmit && npm test -- --run quickFilter SidebarContent
git add -A && git commit -m "feat(S36C): add 8 quick filter presets for sales workflow"
```

---

## Sprint S36D: Multi-Select Tier Filter (2 hours)

**Goal**: Select multiple tiers simultaneously (e.g., T1 + T2)  
**Demo**: Check both T1 and T2 in dropdown → shows only those tiers

---

### T36D.1: Create MultiSelectDropdown Component [M - 45 min]

**Files**: Create [src/components/MultiSelectDropdown.tsx](src/components/MultiSelectDropdown.tsx)

**Implementation** (with full keyboard navigation and ARIA):
```tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface Option {
  value: string;
  label: string;
  count?: number;
}

interface MultiSelectDropdownProps {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  id?: string;
}

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Select...',
  id = 'multi-select',
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  // Use focus trap for accessibility
  useFocusTrap(listRef, isOpen);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev => Math.min(prev + 1, options.length - 1));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen) {
          toggleOption(options[highlightedIndex].value);
        } else {
          setIsOpen(true);
        }
        break;
    }
  }, [isOpen, highlightedIndex, options]);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const displayText = selected.length === 0
    ? placeholder
    : selected.length === 1
    ? options.find(o => o.value === selected[0])?.label || selected[0]
    : `${selected.length} selected`;

  const listboxId = `${id}-listbox`;

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <label 
        id={`${id}-label`}
        className="block text-[10px] font-medium text-slate-500 uppercase mb-1"
      >
        {label}
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${id}-label`}
        aria-controls={listboxId}
        className={`
          w-full flex items-center justify-between px-3 py-2 text-sm
          border rounded-lg bg-white
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
          ${isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200'}
          ${selected.length > 0 ? 'text-slate-800' : 'text-slate-400'}
        `}
      >
        <span>{displayText}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div 
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          aria-labelledby={`${id}-label`}
          className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg py-1"
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              role="option"
              aria-selected={selected.includes(option.value)}
              onClick={() => toggleOption(option.value)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`
                w-full flex items-center justify-between px-3 py-2 text-sm text-left
                transition-colors focus-visible:outline-none
                ${highlightedIndex === index ? 'bg-slate-100' : ''}
                ${selected.includes(option.value) ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}
              `}
            >
              <span>{option.label}</span>
              <span className="flex items-center gap-2">
                {option.count !== undefined && (
                  <span className="text-xs text-slate-400">{option.count}</span>
                )}
                {selected.includes(option.value) && (
                  <Check className="h-4 w-4 text-blue-600" aria-hidden="true" />
                )}
              </span>
            </button>
          ))}
          
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full px-3 py-2 text-xs text-slate-500 hover:text-slate-700 border-t border-slate-100 focus-visible:outline-none focus-visible:bg-slate-100"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

**Validation**:
```typescript
it('allows selecting multiple options', async () => {
  const onChange = vi.fn();
  render(
    <MultiSelectDropdown
      label="Tier"
      options={[
        { value: 'Tier 1', label: '⭐ Tier 1' },
        { value: 'Tier 2', label: 'Tier 2' },
      ]}
      selected={[]}
      onChange={onChange}
    />
  );

  await userEvent.click(screen.getByRole('button'));
  await userEvent.click(screen.getByText(/Tier 1/));
  
  // Uses Railway format 'Tier 1' not Firestore 'T1'
  expect(onChange).toHaveBeenCalledWith(['Tier 1']);
});
```

**Exit Criteria**: Multi-select dropdown works with check indicators.

---

### T36D.2: Replace Tier Dropdown in Sidebar [S - 30 min]

**Files**: [src/components/layout/SidebarContent.tsx](src/components/layout/SidebarContent.tsx)

**Implementation**:
```tsx
import { MultiSelectDropdown } from '../MultiSelectDropdown';

// Add new props
multiTierFilter?: string[];
onMultiTierFilterChange?: (tiers: string[]) => void;
tierCounts?: Record<string, number>;

// Replace single-select tier dropdown
<MultiSelectDropdown
  label="Tier"
  options={[
    { value: 'Tier 1', label: '⭐ Tier 1', count: tierCounts?.['Tier 1'] },
    { value: 'Tier 2', label: 'Tier 2', count: tierCounts?.['Tier 2'] },
    { value: 'Tier 3', label: 'Tier 3', count: tierCounts?.['Tier 3'] },
    { value: 'Tier 4', label: 'Tier 4', count: tierCounts?.['Tier 4'] },
  ]}
  selected={multiTierFilter || []}
  onChange={onMultiTierFilterChange || (() => {})}
  placeholder="All Tiers"
/>
```

**Exit Criteria**: Tier dropdown supports multi-select.

---

### T36D.3: Update Filtering Logic in App.tsx [S - 30 min]

**Files**: [src/App.tsx](src/App.tsx)

**Implementation**:
```tsx
const [multiTierFilter, setMultiTierFilter] = useState<string[]>([]);

// Update filterProspects function
const filteredProspects = useMemo(() => {
  return prospects.filter(p => {
    // Multi-tier filter
    if (multiTierFilter.length > 0 && !multiTierFilter.includes(p.tier)) {
      return false;
    }
    // ... rest of filters
  });
}, [prospects, multiTierFilter, /* other deps */]);
```

**Exit Criteria**: Multi-tier filter applies correctly.

---

### T36D.4: Run Tests & Commit [XS - 15 min]

```bash
npx tsc --noEmit && npm test -- --run MultiSelectDropdown
git add -A && git commit -m "feat(S36D): add multi-select tier filtering"
```

---

## Sprint S36E: Column Customization (2 hours)

**Goal**: User can show/hide columns based on preference  
**Demo**: Click gear icon → uncheck "Gate" → column hidden

---

### T36E.1: Create useColumnPreferences Hook [S - 30 min]

**Files**: Create [src/hooks/useColumnPreferences.ts](src/hooks/useColumnPreferences.ts)

**Implementation**:
```typescript
import { useState, useCallback } from 'react';

export interface ColumnConfig {
  id: string;
  label: string;
  defaultVisible: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'company', label: 'Company', defaultVisible: true },
  { id: 'tier', label: 'Tier', defaultVisible: true },
  { id: 'contacts', label: 'Contacts', defaultVisible: true },
  { id: 'facilities', label: 'Facilities', defaultVisible: true },
  { id: 'gate', label: 'Gate Issue', defaultVisible: true },
  { id: 'roi', label: 'ROI Potential', defaultVisible: true },
  { id: 'score', label: 'Score', defaultVisible: true },
];

const STORAGE_KEY = 'company-list-columns';

export function useColumnPreferences() {
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return new Set(JSON.parse(saved));
      } catch {}
    }
    return new Set(DEFAULT_COLUMNS.filter(c => c.defaultVisible).map(c => c.id));
  });

  const toggleColumn = useCallback((columnId: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const isVisible = useCallback((columnId: string) => {
    return visibleColumns.has(columnId);
  }, [visibleColumns]);

  const resetToDefaults = useCallback(() => {
    const defaults = new Set(DEFAULT_COLUMNS.filter(c => c.defaultVisible).map(c => c.id));
    setVisibleColumns(defaults);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...defaults]));
  }, []);

  return {
    columns: DEFAULT_COLUMNS,
    visibleColumns,
    toggleColumn,
    isVisible,
    resetToDefaults,
  };
}
```

**Exit Criteria**: Hook persists column visibility.

---

### T36E.2: Create ColumnSettingsMenu Component [S - 30 min]

**Files**: Create [src/components/ColumnSettingsMenu.tsx](src/components/ColumnSettingsMenu.tsx)

**Implementation**:
```tsx
import React, { useState, useRef, useEffect } from 'react';
import { Settings, Check, RotateCcw } from 'lucide-react';
import type { ColumnConfig } from '../hooks/useColumnPreferences';

interface ColumnSettingsMenuProps {
  columns: ColumnConfig[];
  visibleColumns: Set<string>;
  onToggle: (columnId: string) => void;
  onReset: () => void;
}

export function ColumnSettingsMenu({
  columns,
  visibleColumns,
  onToggle,
  onReset,
}: ColumnSettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        title="Customize columns"
        aria-label="Customize visible columns"
      >
        <Settings className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20">
          <div className="px-3 py-2 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-700">Visible Columns</span>
          </div>
          
          {columns.map(col => (
            <button
              key={col.id}
              onClick={() => onToggle(col.id)}
              disabled={col.id === 'company'} // Company always visible
              className={`
                w-full flex items-center justify-between px-3 py-1.5 text-sm text-left
                hover:bg-slate-50 transition-colors
                ${col.id === 'company' ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <span>{col.label}</span>
              {visibleColumns.has(col.id) && (
                <Check className="h-4 w-4 text-blue-600" />
              )}
            </button>
          ))}
          
          <button
            onClick={onReset}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-slate-700 border-t border-slate-100"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}
```

**Exit Criteria**: Menu toggles columns with checkbox indicators.

---

### T36E.3: Integrate into CompanyListView [M - 60 min]

**Files**: [src/components/CompanyListView.tsx](src/components/CompanyListView.tsx)

**Implementation**:
```tsx
import { useColumnPreferences } from '../hooks/useColumnPreferences';
import { ColumnSettingsMenu } from './ColumnSettingsMenu';

// In component
const { columns, visibleColumns, toggleColumn, isVisible, resetToDefaults } = useColumnPreferences();

// In header area
<div className="flex items-center justify-between">
  <span className="text-slate-400">Sort:</span>
  {/* ... sort buttons */}
  <ColumnSettingsMenu
    columns={columns}
    visibleColumns={visibleColumns}
    onToggle={toggleColumn}
    onReset={resetToDefaults}
  />
</div>

// In table header and rows, conditionally render columns
{isVisible('contacts') && (
  <SortableHeader
    label="Contacts"
    icon={<Users className="h-3 w-3" />}
    sortDirection={getSortIndicator('contacts')}
    onClick={() => toggleSort('contacts')}
    className="w-12"
  />
)}
```

**Exit Criteria**: Columns can be toggled on/off.

---

### T36E.4: Run Tests & Commit [XS - 15 min]

```bash
npx tsc --noEmit && npm test -- --run useColumnPreferences ColumnSettingsMenu
git add -A && git commit -m "feat(S36E): add column customization with persistence"
```

---

## Sprint S36F: Data Quality Indicators (1.5 hours)

**Goal**: Visual cues when data is missing or incomplete  
**Demo**: Company with no facilities shows "?" with tooltip explaining

---

### T36F.1: Add Data Quality Badges [S - 30 min]

**Files**: [src/components/CompanyListView.tsx](src/components/CompanyListView.tsx)

**Implementation**:
```tsx
// Helper for data quality
const getDataQuality = (company: CompanyRow): 'complete' | 'partial' | 'minimal' => {
  const hasFields = [
    company.facilityCount !== null,
    company.roiPotential !== null,
    company.industryCategory !== null,
    company.hasGateBottleneck !== null,
  ];
  const filledCount = hasFields.filter(Boolean).length;
  
  if (filledCount === 4) return 'complete';
  if (filledCount >= 2) return 'partial';
  return 'minimal';
};

// In company row, add quality indicator
const quality = getDataQuality(company);

{quality !== 'complete' && (
  <Tooltip content={
    <div>
      <div className="font-semibold mb-1">
        {quality === 'minimal' ? 'Limited Data' : 'Partial Data'}
      </div>
      <div className="text-slate-300">
        Click "AI Research" to enrich this company's data
      </div>
    </div>
  }>
    <span className={`
      inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium
      ${quality === 'minimal' 
        ? 'bg-amber-100 text-amber-700' 
        : 'bg-slate-100 text-slate-600'
      }
    `}>
      {quality === 'minimal' ? '⚠️' : 'ℹ️'}
      {quality === 'minimal' ? 'Limited' : 'Partial'}
    </span>
  </Tooltip>
)}
```

**Validation**:
```typescript
it('shows data quality indicator for incomplete companies', () => {
  const company = { ...mockCompany, facilityCount: null, roiPotential: null };
  render(<CompanyListView companies={[company]} {...defaultProps} />);
  
  expect(screen.getByText('Limited')).toBeInTheDocument();
});
```

**Exit Criteria**: Quality badges appear on incomplete records.

---

### T36F.2: Style Null Values Distinctively [S - 30 min]

**Files**: [src/components/CompanyListView.tsx](src/components/CompanyListView.tsx)

**Implementation**:
```tsx
// Update formatROI to show styled placeholder
const formatROI = (roi: number | null): React.ReactNode => {
  if (roi === null) {
    return (
      <Tooltip content="ROI not calculated - run AI Research">
        <span className="text-slate-300 italic">—</span>
      </Tooltip>
    );
  }
  // ... existing formatting
};

// Update formatFacilities
const formatFacilities = (count: number | null): React.ReactNode => {
  if (count === null) {
    return (
      <Tooltip content="Facility count unknown - run AI Research">
        <span className="text-slate-300">?</span>
      </Tooltip>
    );
  }
  return count.toString();
};

// Update gate indicator
{company.gateConfidence === 'unknown' && (
  <Tooltip content="Gate status unknown - needs industry research">
    <span className="text-slate-300 cursor-help">?</span>
  </Tooltip>
)}
```

**Exit Criteria**: Null values have distinct styling with tooltips.

---

### T36F.3: Add "Data Completeness" Column Option [S - 30 min]

**Files**: [src/hooks/useColumnPreferences.ts](src/hooks/useColumnPreferences.ts), [src/components/CompanyListView.tsx](src/components/CompanyListView.tsx)

**Implementation**:
```typescript
// Add to DEFAULT_COLUMNS
{ id: 'dataQuality', label: 'Data Quality', defaultVisible: false },

// In CompanyListView
{isVisible('dataQuality') && (
  <div className="w-16 text-center">
    <span className={`
      inline-block px-2 py-0.5 rounded text-[10px] font-medium
      ${quality === 'complete' ? 'bg-green-100 text-green-700' :
        quality === 'partial' ? 'bg-amber-100 text-amber-700' :
        'bg-red-100 text-red-700'}
    `}>
      {quality === 'complete' ? '✓ Full' :
       quality === 'partial' ? '◐ Partial' :
       '○ Minimal'}
    </span>
  </div>
)}
```

**Exit Criteria**: Data quality column shows completeness status.

---

### T36F.4: Run Tests & Commit [XS - 15 min]

```bash
npx tsc --noEmit && npm test -- --run dataQuality CompanyListView
git add -A && git commit -m "feat(S36F): add data quality indicators for incomplete records"
```

---

## Validation Checklist

### After S36A (Column Clarity)
- [ ] All column headers have visible text labels
- [ ] Tooltips explain each column's meaning
- [ ] "How to use" help panel works
- [ ] Tests pass

### After S36B (Sortable Columns)
- [ ] Click any header to sort
- [ ] Sort direction indicator shows
- [ ] Sort preference persists in localStorage
- [ ] Tests pass

### After S36C (Quick Filters)
- [ ] 8 quick filter presets visible
- [ ] Clicking preset applies correct filters
- [ ] Presets toggle on/off
- [ ] Tests pass

### After S36D (Multi-Select Tier)
- [ ] Can select multiple tiers
- [ ] Count shown per tier option
- [ ] Clear selection works
- [ ] Tests pass

### After S36E (Column Customization)
- [ ] Gear icon opens column menu
- [ ] Can hide/show columns
- [ ] Preference persists
- [ ] Tests pass

### After S36F (Data Quality)
- [ ] Incomplete records show badges
- [ ] Null values have distinct styling
- [ ] Data quality column available
- [ ] Tests pass

---

## Sprint S36G: AI Templates for 1-Off Emails (2.5 hours)

**Goal**: Replace fallback templates in Prospect Detail Panel with AI-generated content  
**Demo**: Click AI Generate → get personalized email like bulk modal → preview before send

---

### T36G.1: Add AI Generate Button to Message Generator [M - 45 min]

**Problem**: Current Message Generator uses static fallback templates (templates.ts). Bulk email modal has AI generation via `useAIGenerate` hook - we need the same capability for 1-off emails in the detail panel.

**Files**: [src/components/panels/ProspectDetailPanel.tsx](src/components/panels/ProspectDetailPanel.tsx)

**Current State** (line ~280):
```tsx
<label className="text-xs font-semibold text-slate-500 uppercase">Message Generator</label>
<select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} ...>
```

**Implementation**:
```tsx
import { useAIGenerate } from '../../hooks/useAIGenerate';
import { TONE_OPTIONS, DEFAULT_TONE, type ToneId } from '../../config/tones';

// Inside component
const { generate: generateAI, isGenerating, error: aiError } = useAIGenerate();
const [selectedTone, setSelectedTone] = useState<ToneId>(DEFAULT_TONE);
const [isAIMode, setIsAIMode] = useState(false);

// AI Generate handler
const handleAIGenerate = useCallback(async () => {
  const result = await generateAI({
    tone: selectedTone,
    prospectName: prospect.name?.split(' ')[0] || 'there',
    companyName: prospect.company || 'your company',
    title: prospect.title,
    goal: 'Schedule a meeting to discuss yard operations',
  });

  if (result.success) {
    setGeneratedMessage(result.content || '');
    // Store subject for email send
    if (result.subject) {
      setAISubject(result.subject);
    }
    setIsAIMode(true);
  }
}, [generateAI, selectedTone, prospect]);

// In the header section
<div className="flex items-center justify-between">
  <label className="text-xs font-semibold text-slate-500 uppercase">Message Generator</label>
  <div className="flex items-center gap-2">
    {/* Template selector */}
    <select 
      value={selectedTemplateId}
      onChange={(e) => { setSelectedTemplateId(e.target.value); setIsAIMode(false); }}
      className="text-xs border-none bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer"
    >
      {templates.map(t => (
        <option key={t.id} value={t.id}>{t.label}</option>
      ))}
    </select>
    
    {/* Tone selector for AI */}
    <select
      value={selectedTone}
      onChange={(e) => setSelectedTone(e.target.value as ToneId)}
      className="text-xs border border-slate-200 rounded px-2 py-1"
    >
      {TONE_OPTIONS.map(t => (
        <option key={t.id} value={t.id}>{t.label}</option>
      ))}
    </select>
    
    {/* AI Generate button */}
    <button
      onClick={handleAIGenerate}
      disabled={isGenerating}
      className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
    >
      {isGenerating ? (
        <>
          <LazyIcon name="Loader2" className="h-3 w-3 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <LazyIcon name="Sparkles" className="h-3 w-3" />
          Generate
        </>
      )}
    </button>
  </div>
</div>

{/* AI error display */}
{aiError && (
  <div className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">
    {aiError}
  </div>
)}

{/* AI mode indicator */}
{isAIMode && (
  <div className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded flex items-center gap-1">
    <LazyIcon name="Sparkles" className="h-3 w-3" />
    AI Generated • {TONE_OPTIONS.find(t => t.id === selectedTone)?.label} tone
  </div>
)}
```

**Validation**:
```typescript
// src/__tests__/components/panels/ProspectDetailPanel.test.tsx
it('shows AI Generate button and generates content', async () => {
  const mockGenerate = vi.fn().mockResolvedValue({
    success: true,
    content: 'AI generated body',
    subject: 'AI Subject',
  });
  vi.mocked(useAIGenerate).mockReturnValue({
    generate: mockGenerate,
    isGenerating: false,
    error: null,
    clearError: vi.fn(),
  });
  
  render(<ProspectDetailPanel prospect={mockProspect} {...defaultProps} />);
  
  await userEvent.click(screen.getByRole('button', { name: /generate/i }));
  
  expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({
    prospectName: 'John',
    companyName: 'Test Corp',
  }));
  
  await waitFor(() => {
    expect(screen.getByText(/AI generated body/)).toBeInTheDocument();
  });
});
```

**Exit Criteria**: AI Generate button in detail panel, generates personalized content.

---

### T36G.2: Add Preview Mode to Detail Panel [S - 30 min]

**Problem**: User wants to see what the personalized email will look like before hitting send.

**Files**: [src/components/panels/ProspectDetailPanel.tsx](src/components/panels/ProspectDetailPanel.tsx)

**Implementation**:
```tsx
const [showPreview, setShowPreview] = useState(false);

// Preview toggle button next to textarea
<div className="flex items-center justify-between">
  <span className={isOverLimit ? 'text-red-500 font-medium' : ''}>
    {charCount} / {isShortDM ? DM_CHAR_LIMIT : '∞'} chars
  </span>
  <button
    onClick={() => setShowPreview(!showPreview)}
    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
  >
    <LazyIcon name={showPreview ? 'Edit' : 'Eye'} className="h-3 w-3" />
    {showPreview ? 'Edit' : 'Preview'}
  </button>
</div>

{/* Preview pane */}
{showPreview && (
  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
    <div className="text-xs text-slate-500 mb-1">Subject:</div>
    <div className="text-sm font-medium text-slate-800 mb-3">
      {isAIMode ? aiSubject : currentTemplate.subject}
    </div>
    <div className="text-xs text-slate-500 mb-1">Message:</div>
    <div className="text-sm text-slate-700 whitespace-pre-wrap">
      {generatedMessage}
    </div>
  </div>
)}
```

**Validation**:
```typescript
it('toggles preview mode showing subject and body', async () => {
  render(<ProspectDetailPanel prospect={mockProspect} {...defaultProps} />);
  
  const previewBtn = screen.getByRole('button', { name: /preview/i });
  await userEvent.click(previewBtn);
  
  expect(screen.getByText('Subject:')).toBeInTheDocument();
  expect(screen.getByText(/Message:/)).toBeInTheDocument();
  
  await userEvent.click(screen.getByRole('button', { name: /edit/i }));
  expect(screen.queryByText('Subject:')).not.toBeInTheDocument();
});
```

**Exit Criteria**: Preview toggle shows formatted email before send.

---

### T36G.3: Update Branding - YardFlow → FreightRoll, Luis → FreightRoll Team [M - 45 min]

**Problem**: Templates reference old branding. Need to update:
- 'YardFlow' → 'FreightRoll'
- 'Luis' or sender name → 'The FreightRoll Team'

**Files**: 
- [src/config/templates.ts](src/config/templates.ts) - Fallback templates
- [src/config/emailTemplates.ts](src/config/emailTemplates.ts) - Bulk email templates
- [src/config/brainSystemPrompt.ts](src/config/brainSystemPrompt.ts) - AI system prompt

**Implementation** (templates.ts):
```typescript
// BEFORE:
body: `Hi ${prospect.name.split(' ')[0]}, Primo saving $1M+/facility. FreightRoll Co-Dev: voting seats open. 15 min? ${CALENDAR_LINK} -${senderName}`

// Ensure senderName defaults to "The FreightRoll Team" in getTemplates call
export const getTemplates = (prospect: Prospect, senderName: string = 'The FreightRoll Team'): MessageTemplate[] => [
  // ... templates
];
```

**ProspectDetailPanel.tsx update**:
```typescript
// BEFORE:
const templates = useMemo(() => 
  getTemplates(prospect, currentUser === 'Me' ? 'The FreightRoll Team' : 'Jake'),
  [prospect, currentUser]
);

// AFTER:
const templates = useMemo(() => 
  getTemplates(prospect, 'The FreightRoll Team'),
  [prospect]
);
```

**Bulk email template search**:
```bash
grep -r "YardFlow" src/config/*.ts
grep -r "Luis" src/config/*.ts
```

**Validation**:
```typescript
it('templates use FreightRoll branding', () => {
  const templates = getTemplates(mockProspect, 'The FreightRoll Team');
  
  templates.forEach(t => {
    expect(t.body).not.toContain('YardFlow');
    expect(t.body).not.toContain('-Luis');
    expect(t.body).toContain('FreightRoll');
  });
});

it('templates sign off with The FreightRoll Team', () => {
  const templates = getTemplates(mockProspect);
  
  templates.forEach(t => {
    expect(t.body).toContain('-The FreightRoll Team');
  });
});
```

**Exit Criteria**: All frontend templates use FreightRoll branding, sign off with team name.

---

### T36G.4: Run Tests & Commit [XS - 15 min]

```bash
npx tsc --noEmit && npm test -- --run ProspectDetailPanel templates branding
git add -A && git commit -m "feat(S36G): add AI generation to detail panel with FreightRoll branding"
```

---

## Sprint S36H: AI Per-Recipient Preview Before Send (2 hours)

**Goal**: In "AI Per-Recipient" mode, show full preview of each generated message before sending  
**Demo**: Generate All → expand any recipient → see full personalized message → approve and send

**Backend Note**: AI generation is handled by Railway backend (`/api/ai/content/generate`). The frontend only needs to display what Railway returns. No backend changes needed for this sprint.

---

### T36H.1: Enhance RecipientRow with Full Preview [M - 45 min]

**Problem**: Current RecipientRow (line ~85 in BulkEmailModal.tsx) has expandable preview but it's basic. User wants to clearly see and approve each personalized message before hitting send.

**Files**: [src/components/BulkEmailModal.tsx](src/components/BulkEmailModal.tsx)

**Current** (RecipientRow component):
```tsx
{/* Expandable preview section */}
{isExpanded && hasContent && (
  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
    <div className="text-xs text-slate-500 mb-1">Subject:</div>
    <div className="text-sm font-medium text-slate-800 mb-3">{recipient.subject}</div>
    ...
  </div>
)}
```

**Enhanced Implementation**:
```tsx
function RecipientRow({ 
  recipient, 
  onGenerate,
  onApprove,
  onEdit,
  disabled 
}: { 
  recipient: BulkRecipient; 
  onGenerate: () => void;
  onApprove?: () => void;
  onEdit?: (subject: string, body: string) => void;
  disabled: boolean;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editSubject, setEditSubject] = React.useState('');
  const [editBody, setEditBody] = React.useState('');
  
  const statusDisplay = getStatusDisplay(recipient.status);
  const isGenerating = recipient.status === 'generating';
  const canGenerate = recipient.status === 'pending' || recipient.status === 'failed';
  const hasContent = (recipient.status === 'generated' || recipient.status === 'approved') 
    && recipient.subject && recipient.body;
  const isApproved = recipient.status === 'approved';
  
  // Start editing
  const handleEdit = () => {
    setEditSubject(recipient.subject || '');
    setEditBody(recipient.body || '');
    setIsEditing(true);
  };
  
  // Save edits
  const handleSaveEdit = () => {
    onEdit?.(editSubject, editBody);
    setIsEditing(false);
  };

  return (
    <div className={`border-b border-slate-100 last:border-b-0 ${isApproved ? 'bg-green-50/50' : ''}`}>
      {/* Main row */}
      <div 
        className={`flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 ${hasContent ? 'cursor-pointer' : ''}`}
        onClick={hasContent ? () => setIsExpanded(!isExpanded) : undefined}
      >
        {/* Status indicator with approval badge */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative">
            <LazyIcon 
              name={statusDisplay.icon} 
              className={`h-4 w-4 flex-shrink-0 ${statusDisplay.color} ${isGenerating ? 'animate-spin' : ''}`} 
            />
            {isApproved && (
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
            )}
          </div>
          
          {/* Prospect info */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800 truncate flex items-center gap-2">
              {recipient.prospect.name}
              {isApproved && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Approved</span>}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {recipient.prospect.company} • {recipient.prospect.email}
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasContent && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
              className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <LazyIcon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} className="h-3 w-3" />
              {isExpanded ? 'Hide' : 'Preview'}
            </button>
          )}
          
          <span className={`text-xs ${statusDisplay.color}`}>
            {statusDisplay.label}
          </span>
          
          {canGenerate && (
            <button
              onClick={(e) => { e.stopPropagation(); onGenerate(); }}
              disabled={disabled}
              className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50 flex items-center gap-1"
            >
              <LazyIcon name="Sparkles" className="h-3 w-3" />
              Generate
            </button>
          )}
        </div>
      </div>
      
      {/* Enhanced expandable preview section */}
      {isExpanded && hasContent && (
        <div className="px-4 py-4 bg-slate-50 border-t border-slate-100">
          {isEditing ? (
            /* Edit mode */
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Subject:</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Body:</label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            /* Preview mode */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Subject:</span>
                <button
                  onClick={handleEdit}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <LazyIcon name="Edit2" className="h-3 w-3" />
                  Edit
                </button>
              </div>
              <div className="text-sm font-medium text-slate-800 bg-white px-3 py-2 rounded border border-slate-100">
                {recipient.subject}
              </div>
              
              <div className="text-xs text-slate-500">Body:</div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap bg-white px-3 py-3 rounded border border-slate-100 max-h-48 overflow-y-auto">
                {recipient.body}
              </div>
              
              {/* Approval button */}
              {!isApproved && (
                <button
                  onClick={() => onApprove?.()}
                  className="w-full py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <LazyIcon name="CheckCircle" className="h-4 w-4" />
                  Approve for Sending
                </button>
              )}
              
              {isApproved && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-green-700 bg-green-100 rounded-lg">
                  <LazyIcon name="CheckCircle" className="h-4 w-4" />
                  Approved - Ready to Send
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Exit Criteria**: Each recipient has expandable preview with edit capability.

---

### T36H.2: Add Approval Flow to Bulk Send [S - 30 min]

**Problem**: User wants explicit approval before sending personalized emails.

**Files**: [src/hooks/useBulkEmailSend.ts](src/hooks/useBulkEmailSend.ts), [src/components/BulkEmailModal.tsx](src/components/BulkEmailModal.tsx)

**Implementation** (useBulkEmailSend.ts):
```typescript
// Add 'approved' status to RecipientStatus
export type RecipientStatus = 'pending' | 'generating' | 'generated' | 'approved' | 'sending' | 'sent' | 'failed';

// Add approve function
const approveRecipient = useCallback((prospectId: string) => {
  setRecipients(prev => prev.map(r => 
    r.prospect.id === prospectId && r.status === 'generated'
      ? { ...r, status: 'approved' as RecipientStatus }
      : r
  ));
}, []);

// Add approveAll function
const approveAll = useCallback(() => {
  setRecipients(prev => prev.map(r => 
    r.status === 'generated'
      ? { ...r, status: 'approved' as RecipientStatus }
      : r
  ));
}, []);
```

**Update BulkEmailModal send button logic**:
```tsx
// Only count approved recipients as ready to send
const readyToSend = bulkSend.recipients.filter(r => r.status === 'approved').length;
const allGenerated = bulkSend.recipients.filter(r => r.status === 'generated' || r.status === 'approved').length;

// Update send button
<button
  onClick={handleSendAIMode}
  disabled={readyToSend === 0}
  className="..."
>
  <LazyIcon name="Send" className="h-4 w-4" />
  Send {readyToSend} personalized
</button>

{/* Approve all button if any generated but not approved */}
{allGenerated > readyToSend && (
  <button
    onClick={bulkSend.approveAll}
    className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1"
  >
    <LazyIcon name="CheckCircle2" className="h-3 w-3" />
    Approve All ({allGenerated - readyToSend})
  </button>
)}
```

**Exit Criteria**: Approval required before sending, with approve-all option.

---

### T36H.3: Update Status Display for Approval State [XS - 15 min]

**Files**: [src/components/BulkEmailModal.tsx](src/components/BulkEmailModal.tsx)

**Implementation** (update getStatusDisplay):
```typescript
function getStatusDisplay(status: RecipientStatus): { icon: string; color: string; label: string } {
  switch (status) {
    case 'pending':
      return { icon: 'Circle', color: 'text-slate-400', label: 'Pending' };
    case 'generating':
      return { icon: 'Loader2', color: 'text-purple-500', label: 'Generating...' };
    case 'generated':
      return { icon: 'Eye', color: 'text-amber-500', label: 'Review' };
    case 'approved':
      return { icon: 'CheckCircle2', color: 'text-green-500', label: 'Approved' };
    case 'sending':
      return { icon: 'Loader2', color: 'text-blue-500', label: 'Sending...' };
    case 'sent':
      return { icon: 'CheckCircle2', color: 'text-green-600', label: 'Sent' };
    case 'failed':
      return { icon: 'XCircle', color: 'text-red-500', label: 'Failed' };
    default:
      return { icon: 'Circle', color: 'text-slate-400', label: 'Unknown' };
  }
}
```

**Exit Criteria**: Status badges reflect approval workflow.

---

### T36H.4: Unit Tests for Approval Flow [S - 30 min]

**Files**: Create/update [src/__tests__/components/BulkEmailModal.approval.test.tsx](src/__tests__/components/BulkEmailModal.approval.test.tsx)

**Tests**:
```typescript
describe('BulkEmailModal AI Approval Flow', () => {
  it('shows Review status after generation', async () => {
    const { container } = render(<BulkEmailModal {...defaultProps} />);
    
    // Switch to AI mode
    await userEvent.click(screen.getByText('AI Per-Recipient'));
    
    // Generate
    await userEvent.click(screen.getByText('Generate All'));
    
    await waitFor(() => {
      expect(screen.getAllByText('Review')).toHaveLength(2); // 2 recipients
    });
  });
  
  it('allows individual approval via preview', async () => {
    render(<BulkEmailModal {...defaultProps} />);
    
    // ... setup with generated content
    
    // Expand first recipient
    await userEvent.click(screen.getAllByText('Preview')[0]);
    
    // Click approve
    await userEvent.click(screen.getByText('Approve for Sending'));
    
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });
  
  it('approve all button approves all generated', async () => {
    render(<BulkEmailModal {...defaultProps} />);
    
    // ... setup with generated content
    
    await userEvent.click(screen.getByText(/Approve All/));
    
    expect(screen.getAllByText('Approved')).toHaveLength(2);
  });
  
  it('send button only counts approved recipients', async () => {
    render(<BulkEmailModal {...defaultProps} />);
    
    // ... setup with 1 approved, 1 generated
    
    expect(screen.getByText('Send 1 personalized')).toBeInTheDocument();
  });
  
  it('allows editing before approval', async () => {
    render(<BulkEmailModal {...defaultProps} />);
    
    // ... setup with generated content
    
    await userEvent.click(screen.getAllByText('Preview')[0]);
    await userEvent.click(screen.getByText('Edit'));
    
    const subjectInput = screen.getByRole('textbox', { name: /subject/i });
    await userEvent.clear(subjectInput);
    await userEvent.type(subjectInput, 'New Subject');
    
    await userEvent.click(screen.getByText('Save Changes'));
    
    expect(screen.getByText('New Subject')).toBeInTheDocument();
  });
});
```

**Exit Criteria**: Tests cover approval workflow.

---

### T36H.5: Run Tests & Commit [XS - 15 min]

```bash
npx tsc --noEmit && npm test -- --run BulkEmailModal approval
git add -A && git commit -m "feat(S36H): add preview and approval flow for AI per-recipient emails"
```

---

## Validation Checklist (Updated)

### After S36G (AI Templates for 1-Off)
- [ ] AI Generate button visible in detail panel
- [ ] Tone selector works
- [ ] Preview mode shows subject + body
- [ ] Templates use FreightRoll branding
- [ ] Sign-off is "The FreightRoll Team"
- [ ] Tests pass

### After S36H (Per-Recipient Preview)
- [ ] Each recipient expandable in AI mode
- [ ] Edit button allows changes
- [ ] Approve button per recipient
- [ ] Approve All button works
- [ ] Send only sends approved
- [ ] Tests pass

---

## Rollback Plan

Each sprint is independently committable. To rollback:
```bash
git revert <commit-hash>  # Reverts specific sprint
```

No database migrations or backend changes - all frontend-only.

---

## Key Files Reference

| Purpose | Location |
|---------|----------|
| Company list view | [src/components/CompanyListView.tsx](src/components/CompanyListView.tsx) |
| Sidebar filters | [src/components/layout/SidebarContent.tsx](src/components/layout/SidebarContent.tsx) |
| Quick filter config | [src/config/quickFilters.ts](src/config/quickFilters.ts) (NEW) |
| Sorting hook | [src/hooks/useSortableTable.ts](src/hooks/useSortableTable.ts) (NEW) |
| Column prefs hook | [src/hooks/useColumnPreferences.ts](src/hooks/useColumnPreferences.ts) (NEW) |
| Tooltip component | [src/components/Tooltip.tsx](src/components/Tooltip.tsx) (NEW) |
| Multi-select dropdown | [src/components/MultiSelectDropdown.tsx](src/components/MultiSelectDropdown.tsx) (NEW) |
| Company aggregator | [src/services/CompanyAggregator.ts](src/services/CompanyAggregator.ts) |
| Detail panel | [src/components/panels/ProspectDetailPanel.tsx](src/components/panels/ProspectDetailPanel.tsx) |
| Bulk email modal | [src/components/BulkEmailModal.tsx](src/components/BulkEmailModal.tsx) |
| AI generate hook | [src/hooks/useAIGenerate.ts](src/hooks/useAIGenerate.ts) |
| Templates config | [src/config/templates.ts](src/config/templates.ts) |

---

## Post-Sprint Review Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Time to find high-value prospects | <30 seconds | Manual testing with stopwatch |
| Filter preset usage | 80%+ use quick filters | Analytics tracking (future) |
| Help panel open rate | <10% (intuitive UI) | Analytics tracking (future) |

---

## Verification for Completed Sprints

### S36G + S36H Verification (Complete)

Run these commands to verify the completed sprints still work:

```bash
# TypeScript check
npx tsc --noEmit

# Run related tests
npm test -- --run ProspectDetailPanel BulkEmailModal useBulkEmailSend useAIGenerate

# Expected: All tests pass
```

**Commit**: `ebf267c` - feat(S36G/S36H): add AI generation to detail panel, preview mode, approval flow

### Features Verified
- ✅ AI Generate button with tone selector in ProspectDetailPanel
- ✅ Preview/Edit toggle for AI-generated content
- ✅ FreightRoll branding (not YardFlow)
- ✅ "The FreightRoll Team" sign-off
- ✅ Approval workflow: must approve before sending
- ✅ Approve All button in bulk email footer
- ✅ Railway enrollment fix: sends `flowId` instead of `sequenceId`
| Column customization usage | Track which columns hidden | localStorage sampling |
| AI generation usage | 50%+ use AI over fallback | Count AI vs template sends |
| Approval rate | 90%+ approve after preview | Track approve vs reject |

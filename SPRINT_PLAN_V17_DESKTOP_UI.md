# Sprint Plan V17: Desktop UI Responsiveness & Performance

**Created**: February 1, 2026  
**Status**: Ready for Execution  
**Goal**: Fix desktop layout issues, improve responsive design, and resolve INP performance problems  
**Context**: Mobile UI is optimized; desktop experience needs improvement for sequence builder and main navigation  
**Reviewed By**: Subagent on Feb 1, 2026 (Critical issues fixed, 23 improvements incorporated)

---

## Executive Summary

The current YardFlow Hub UI was optimized for mobile-first (Sprint 14), but desktop experience has regressions:
- SequenceBuilder sidebar panel doesn't adapt well to larger screens
- Navigation tabs compress content unnecessarily on desktop
- INP (Interaction to Next Paint) issue with Lucide icons blocking UI for 360ms

**Key Metrics to Improve**:
- INP: <200ms (currently 360ms on menu icon)
- Sequence Builder usability on 1440px+ screens
- Navigation tab visibility on desktop

---

## Phase 1: INP Performance Fix

### Sprint 700: Lucide Icon Performance Optimization

**Goal**: Fix the INP issue where `lucide-react` icons block UI updates for 360ms  
**Effort**: 2-3 hours  
**Validation**: Chrome DevTools INP measurement <200ms

#### T700.1: Lazy Load Lucide Icons

**Problem**: The Lucide icons bundle imports all icons synchronously, blocking the main thread.

**File**: `src/App.tsx`

**Current Pattern** (Problematic):
```typescript
import {
  Menu,
  Settings,
  Zap,
  Mail,
  // ... 40+ more icons
} from 'lucide-react';
```

**Solution**: Create a lazy icon loader and use dynamic imports.

**Files to Create**:
- `src/components/icons/LazyIcon.tsx`

**Interface**:
```typescript
interface LazyIconProps {
  name: string;
  className?: string;
  size?: number;
  'aria-hidden'?: boolean;
}

// Usage:
<LazyIcon name="Menu" className="h-6 w-6" />
```

**Implementation Strategy**:
1. Create icon name map for commonly used icons
2. Use React.lazy() with dynamic imports
3. Add Suspense fallback with matching dimensions to prevent layout shift
4. Memoize icon components
5. **⚠️ CRITICAL**: Wrap with ErrorBoundary for network failures

**Suspense Fallback** (must match icon size):
```typescript
// Fallback must preserve layout - use same dimensions as icon
const IconFallback = ({ size = 24 }: { size?: number }) => (
  <span 
    className="inline-block bg-slate-200 rounded animate-pulse"
    style={{ width: size, height: size }}
    aria-hidden="true"
  />
);

// Component wraps itself with Suspense + ErrorBoundary
export function LazyIcon({ name, size = 24, className, ...props }: LazyIconProps) {
  return (
    <IconErrorBoundary fallback={<IconFallback size={size} />}>
      <Suspense fallback={<IconFallback size={size} />}>
        <LazyIconInner name={name} size={size} className={className} {...props} />
      </Suspense>
    </IconErrorBoundary>
  );
}
```

**Test File**: `src/__tests__/components/icons/LazyIcon.test.tsx`

**Test Cases**:
1. Renders icon after lazy load
2. Shows fallback during load (matches dimensions)
3. Handles unknown icon gracefully (shows fallback, no crash)
4. Memoization prevents re-renders
5. **⚠️ Error boundary catches network failures**
6. Fallback dimensions match requested size prop

**Validation**:
```bash
# Run performance test
npm run build
npx lighthouse http://localhost:4173 --only-categories=performance --output=json | jq '.audits["interaction-to-next-paint"]'
```

**Acceptance Criteria**:
- [ ] INP < 200ms on menu icon click
- [ ] No visible layout shift during icon load
- [ ] Bundle size reduced by ~30KB

---

#### T700.2: Icon Preload for Critical Path

**Problem**: After lazy loading, critical icons might flash during initial render.

**Solution**: Preload icons used in initial viewport.

**File**: `src/main.tsx`

**Changes**:
```typescript
// Preload critical icons before render
import { preloadIcons } from './components/icons/iconPreloader';

preloadIcons(['Menu', 'Settings', 'Zap', 'Mail', 'LayoutDashboard', 'Users']);

createRoot(document.getElementById('root')!).render(<App />);
```

**Validation**: First Contentful Paint unaffected

---

#### T700.3: Event Handler Optimization

**Problem**: Event handlers on icons may be causing jank.

**File**: `src/App.tsx`

**Pattern to Fix**:
```typescript
// BEFORE (causes repaint on every click)
<button onClick={() => setIsMobileSidebarOpen(true)}>
  <Menu className="h-6 w-6" />
</button>

// AFTER (stable reference, event delegation)
const handleMenuClick = useCallback(() => {
  startTransition(() => {
    setIsMobileSidebarOpen(true);
  });
}, []);

<button onClick={handleMenuClick}>
  <Menu className="h-6 w-6" />
</button>
```

**Changes**:
- Wrap state updates in `startTransition` for non-urgent updates
- Memoize click handlers with `useCallback`
- Add `will-change: transform` to animated elements
- **⚠️ Add import**: `import { startTransition } from 'react'`

**Validation**:
- Profile with Chrome DevTools → Performance → Record
- Verify no long tasks >50ms during navigation

---

#### T700.4: Bundle Size Baseline

**Problem**: Plan claims "~30KB reduction" but no baseline measurement exists.

**Actions**:
1. Run bundle analysis before changes
2. Document baseline sizes
3. Compare after Sprint 700 complete

**Commands**:
```bash
# Install analyzer (if not present)
npm install -D rollup-plugin-visualizer

# Add to vite.config.ts temporarily
import { visualizer } from 'rollup-plugin-visualizer';
// plugins: [visualizer({ open: true })]

# Generate report
npm run build
# Opens stats.html with bundle breakdown
```

**Metrics to Record**:
- Total bundle size (main.js)
- lucide-react chunk size
- Icon-related imports size

---

## Phase 2: Desktop Layout System

### Sprint 701: Responsive Container Architecture

**Goal**: Create a flexible layout system that adapts to desktop screen sizes  
**Effort**: 5-6 hours  
**Validation**: UI looks correct at 1024px, 1440px, 1920px breakpoints

#### T701.0: Prerequisites (MUST DO FIRST)

**⚠️ Critical Dependencies**: These must be completed before T701.1

**T701.0a: Create useMediaQuery hook**

Move `useMediaQuery` from Sprint 702 to here as it's required for DesktopLayout.

**File**: `src/hooks/useMediaQuery.ts` (see T702.5 for implementation)

---

**T701.0b: Extract Tab Configuration**

**Problem**: Tab config is inline in App.tsx, making extraction harder.

**File**: `src/config/navigation.ts`

```typescript
import { 
  LayoutDashboard, Users, Mail, Upload, Link2, Bot, Calculator 
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface TabConfig {
  id: string;
  label: string;
  shortLabel: string;  // For mobile
  icon: LucideIcon;
  ariaLabel: string;
}

export const NAVIGATION_TABS: readonly TabConfig[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Dash', icon: LayoutDashboard, ariaLabel: 'Analytics Dashboard' },
  { id: 'prospects', label: 'Hitlist', shortLabel: 'Hits', icon: Users, ariaLabel: 'Prospect Hitlist' },
  { id: 'sequences', label: 'Sequences', shortLabel: 'Seq', icon: Mail, ariaLabel: 'Email Sequences' },
  { id: 'import', label: 'Import', shortLabel: 'Imp', icon: Upload, ariaLabel: 'Import Prospects' },
  { id: 'integrations', label: 'Integrations', shortLabel: 'Int', icon: Link2, ariaLabel: 'Integrations' },
  { id: 'assistant', label: 'AI Brain', shortLabel: 'AI', icon: Bot, ariaLabel: 'AI Assistant' },
  { id: 'roi', label: 'ROI Calculator', shortLabel: 'ROI', icon: Calculator, ariaLabel: 'ROI Calculator' },
] as const;

export type TabId = typeof NAVIGATION_TABS[number]['id'];
```

---

**T701.0c: Create AppContext for State Management**

**Problem**: App.tsx has ~30+ useState hooks. Extracting components requires either:
1. Prop drilling (messy, brittle)
2. Context (clean, scalable)

**Solution**: Create AppContext to share essential app state.

**File**: `src/context/AppContext.tsx`

```typescript
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { TabId } from '../config/navigation';
import type { Prospect } from '../types/firestore';

interface AppState {
  // Navigation
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  
  // Sidebar
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  
  // Selected items
  selectedProspect: Prospect | null;
  setSelectedProspect: (prospect: Prospect | null) => void;
  
  // View mode
  viewMode: 'people' | 'companies';
  setViewMode: (mode: 'people' | 'companies') => void;
  
  // Announcements (a11y)
  announce: (message: string) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [viewMode, setViewMode] = useState<'people' | 'companies'>('companies');
  const [announcement, setAnnouncement] = useState('');
  
  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);
  const announce = useCallback((message: string) => setAnnouncement(message), []);
  
  return (
    <AppContext.Provider value={{
      activeTab, setActiveTab,
      isSidebarOpen, toggleSidebar,
      selectedProspect, setSelectedProspect,
      viewMode, setViewMode,
      announce,
    }}>
      {children}
      {/* SR-only live region */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </AppContext.Provider>
  );
}

export function useAppContext(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}
```

**Usage in Extracted Components**:
```typescript
// In NavigationSidebar.tsx
import { useAppContext } from '@/context/AppContext';

export function NavigationSidebar() {
  const { activeTab, setActiveTab, announce } = useAppContext();
  // ...
}
```

---

#### T701.1: Create Desktop Layout Container

**Problem**: Current layout is mobile-first with fixed breakpoints that don't scale well to desktop.

**File**: `src/components/layout/DesktopLayout.tsx`

**Prerequisites**: T701.0a (useMediaQuery)

**Interface**:
```typescript
interface DesktopLayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
  sidebarWidth?: 'narrow' | 'medium' | 'wide';  // 280, 320, 400px
  sidebarPosition?: 'left' | 'right';
  collapsible?: boolean;
}

// Usage in App.tsx:
<DesktopLayout
  sidebar={<NavigationSidebar />}
  main={<MainContent />}
  sidebarWidth="medium"
  collapsible
/>
```

**Features**:
- CSS Grid-based layout for desktop
- Flexbox fallback for mobile
- Collapsible sidebar with animation
- Resizable sidebar (optional)

**CSS Classes**:
```css
/* Breakpoints */
lg: 1024px   /* Desktop starts */
xl: 1280px   /* Wide desktop */
2xl: 1536px  /* Ultra-wide */

/* Layout */
.desktop-layout {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
}

@media (max-width: 1023px) {
  .desktop-layout {
    display: flex;
    flex-direction: column;
  }
}
```

**Test File**: `src/__tests__/components/layout/DesktopLayout.test.tsx`

**Test Cases**:
1. Renders sidebar and main content
2. Applies correct grid at desktop sizes
3. Collapses to flex on mobile
4. Sidebar toggle works
5. Preserves collapse state in localStorage

---

#### T701.2: Refactor App.tsx Layout Container

**Problem**: App.tsx has ~3500 lines with inline layout logic.

**Changes**:
1. Extract layout to `<AppLayout>`
2. Move sidebar to `<NavigationSidebar>`
3. Move main content routing to `<MainContentRouter>`

**Files to Create**:
- `src/components/layout/AppLayout.tsx`
- `src/components/layout/NavigationSidebar.tsx`
- `src/components/layout/MainContentRouter.tsx`

**App.tsx After** (Target: <1000 lines):
```typescript
export default function App() {
  // State hooks...
  
  return (
    <AppLayout
      sidebar={
        <NavigationSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          // ... props
        />
      }
      main={
        <MainContentRouter
          activeTab={activeTab}
          // ... props
        />
      }
    />
  );
}
```

**Validation**:
- All existing tests pass
- E2E navigation tests pass
- No visual regressions

---

#### T701.3: Desktop Tab Navigation

**Problem**: Navigation tabs are cramped on desktop, showing abbreviated text.

**File**: `src/components/layout/NavigationSidebar.tsx` (new)

**Current** (in App.tsx lines 1888-1958):
```tsx
<div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg mb-4">
  <button className="flex-1 flex items-center justify-center py-1.5 rounded text-xs">
    <LayoutDashboard className="h-3 w-3 mr-1" /> Dashboard
  </button>
  // ... 7 more tabs
</div>
```

**Solution - Responsive Tab Design**:
```tsx
// Mobile: Icon-only horizontal tabs
// Tablet: Icon + abbreviated text
// Desktop: Vertical navigation list with full labels

<nav className="
  /* Mobile: horizontal scroll */
  flex lg:flex-col
  overflow-x-auto lg:overflow-visible
  /* Desktop: vertical list */
  lg:space-y-1
">
  {tabs.map(tab => (
    <button
      key={tab.id}
      className="
        /* Mobile */
        flex items-center justify-center p-2 min-w-[48px]
        /* Desktop */
        lg:justify-start lg:w-full lg:px-3 lg:py-2
      "
    >
      <tab.icon className="h-5 w-5 lg:mr-3" />
      <span className="hidden lg:inline">{tab.label}</span>
    </button>
  ))}
</nav>
```

**Tab Configuration**:
```typescript
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'prospects', label: 'Hitlist', icon: Users },
  { id: 'sequences', label: 'Sequences', icon: Mail },
  { id: 'import', label: 'Import', icon: Upload },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'assistant', label: 'AI Brain', icon: Bot },
  { id: 'roi', label: 'ROI Calculator', icon: Calculator },
] as const;
```

**Test Cases**:
1. Tabs render in horizontal mode on mobile
2. Tabs render vertically on desktop
3. Active tab highlighted correctly
4. Keyboard navigation works (roving tabindex pattern)
5. Arrow keys navigate between tabs
6. Enter/Space activates selected tab

**Accessibility - Roving Tabindex Pattern**:
```typescript
// Only active tab in tab order, arrows navigate
const [focusedIndex, setFocusedIndex] = useState(0);

const handleKeyDown = (e: KeyboardEvent, index: number) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    e.preventDefault();
    setFocusedIndex((index + 1) % tabs.length);
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault();
    setFocusedIndex((index - 1 + tabs.length) % tabs.length);
  }
};

<button
  tabIndex={index === focusedIndex ? 0 : -1}
  onKeyDown={(e) => handleKeyDown(e, index)}
  // ...
>
```

---

## Phase 3: Sequence Builder Desktop Optimization

### Sprint 702: Two-Panel Sequence Builder

**Goal**: Redesign Sequence Builder for optimal desktop experience  
**Effort**: 6-8 hours  
**Validation**: SequenceBuilder usable and efficient on 1440px+ screens

#### T702.1: Split-Pane Layout for Desktop

**Problem**: Current SequenceBuilder is single-column, wasting horizontal space on desktop.

**File**: `src/components/SequenceBuilder.tsx`

**Current Layout**:
```
┌─────────────────────────────────────┐
│         Header (Save, Cancel)       │
├─────────────────────────────────────┤
│                                     │
│         Steps (stacked)             │
│                                     │
├─────────────────────────────────────┤
│            Timeline                 │
└─────────────────────────────────────┘
```

**Desktop Layout (1024px+)**:
```
┌─────────────────────────────────────────────────────────┐
│              Header (Sequence Name, Save, Cancel)        │
├──────────────────────┬──────────────────────────────────┤
│                      │                                   │
│   Step List          │   Step Detail Editor             │
│   (scrollable)       │   (selected step)                │
│                      │                                   │
│   ┌─────────────┐    │   Subject: _______________       │
│   │ Step 1 ✓   │    │                                   │
│   └─────────────┘    │   Body:                          │
│   ┌─────────────┐    │   ┌───────────────────────┐      │
│   │ Step 2 ●   │◄───│   │                       │      │
│   └─────────────┘    │   │   Email content...    │      │
│   ┌─────────────┐    │   │                       │      │
│   │ + Add Step │    │   └───────────────────────┘      │
│   └─────────────┘    │                                   │
│                      │   Preview | Settings              │
├──────────────────────┴──────────────────────────────────┤
│                Timeline: Day 0 → Day 3 → Day 7          │
└─────────────────────────────────────────────────────────┘
```

**Implementation**:
```typescript
interface SequenceBuilderDesktopProps {
  // ... existing props
}

export function SequenceBuilder(props: SequenceBuilderDesktopProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  
  if (isDesktop) {
    return <DesktopSequenceBuilder {...props} />;
  }
  
  return <MobileSequenceBuilder {...props} />;
}
```

**New Files**:
- `src/components/sequence/DesktopSequenceBuilder.tsx`
- `src/components/sequence/MobileSequenceBuilder.tsx`
- `src/components/sequence/StepList.tsx`
- `src/components/sequence/StepEditor.tsx`
- `src/components/sequence/TimelineBar.tsx`

---

#### T702.2: Step List Component

**File**: `src/components/sequence/StepList.tsx`

**Interface**:
```typescript
interface StepListProps {
  steps: EmailStep[];
  selectedStepId: string | null;
  onStepSelect: (stepId: string) => void;
  onStepAdd: (afterStepId?: string) => void;
  onStepRemove: (stepId: string) => void;
  onStepReorder: (fromIndex: number, toIndex: number) => void;
  validationErrors: ValidationError[];
  readOnly?: boolean;
}
```

**Features**:
- Compact step cards with status indicators
- Drag-and-drop reordering (desktop)
- Add step between existing steps
- Clear visual hierarchy

**Drag-and-Drop Library**: `@dnd-kit/core` (RECOMMENDED)

**Why @dnd-kit**:
- Best accessibility support (screen reader announcements, keyboard DnD)
- Works with virtualized lists
- Tree-shakable, small bundle impact
- Active maintenance

**Installation**:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Implementation Pattern**:
```typescript
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

function StepList({ steps, onStepReorder }: StepListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = steps.findIndex(s => s.id === active.id);
      const newIndex = steps.findIndex(s => s.id === over.id);
      onStepReorder(oldIndex, newIndex);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={steps} strategy={verticalListSortingStrategy}>
        {steps.map(step => (
          <SortableStepCard key={step.id} step={step} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

**Test Cases**:
1. Renders all steps
2. Highlights selected step
3. Shows validation errors on steps
4. Drag and drop reorders correctly
5. Add step creates new step after selected
6. **Keyboard DnD**: Space to lift, arrows to move, Space to drop
7. **Screen reader announcements** during drag operations

---

#### T702.3: Step Editor Component

**File**: `src/components/sequence/StepEditor.tsx`

**Interface**:
```typescript
interface StepEditorProps {
  step: EmailStep;
  onUpdate: (updates: Partial<EmailStep>) => void;
  validationErrors: ValidationError[];
  readOnly?: boolean;
}
```

**Features**:
- Full step editing form
- Rich text-ish email body editor
- Merge tag insertion toolbar
- Preview mode toggle
- Validation feedback inline

---

#### T702.4: Timeline Bar Component

**File**: `src/components/sequence/TimelineBar.tsx`

**Interface**:
```typescript
interface TimelineBarProps {
  steps: EmailStep[];
  selectedStepId: string | null;
  onStepClick: (stepId: string) => void;
}
```

**Visual Design**:
```
Day 0         Day 3         Day 7         Day 14
  ●─────────────●─────────────●─────────────●
  │             │             │             │
Initial     Follow-up 1   Follow-up 2   Break-up
```

**Features**:
- Visual day-to-day representation
- Click to select step
- Hover for step preview
- Color-coded by step type

---

#### T702.5: Responsive Breakpoint Integration

**File**: `src/hooks/useMediaQuery.ts`

**⚠️ CRITICAL**: Use `useSyncExternalStore` for SSR safety and hydration consistency.

**Implementation** (SSR-safe):
```typescript
import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const subscribe = (callback: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', callback);
    return () => mql.removeEventListener('change', callback);
  };
  
  const getSnapshot = () => window.matchMedia(query).matches;
  const getServerSnapshot = () => false; // SSR fallback - assume mobile
  
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Preset hooks
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

export function useIsWideDesktop(): boolean {
  return useMediaQuery('(min-width: 1440px)');
}

export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}
```

**Why `useSyncExternalStore`**:
- Avoids hydration mismatch (window undefined on server)
- Works correctly with React 18 concurrent rendering
- No tearing during rapid updates

**Test Cases**:
1. Returns true when matches
2. Updates on resize
3. Cleans up listener on unmount
4. Returns `false` during SSR (getServerSnapshot)
5. No hydration mismatch warnings

---

## Phase 4: Main Content Area Optimization

### Sprint 703: Desktop-Optimized Content Panels

**Goal**: Optimize main content area for desktop viewing  
**Effort**: 4-5 hours  
**Validation**: Content fills available space appropriately on all screen sizes

#### T703.1: Prospects/Hitlist Desktop View

**Problem**: Hitlist uses same layout on mobile and desktop.

**Current**: Card list that's fine for mobile but wastes space on desktop.

**Desktop Solution**: Split view with list on left, detail panel on right.

```
┌─────────────────────────────────────────────────────────┐
│  Search [_____________]  Filter: [All ▼]  View: [Grid]  │
├────────────────────────┬────────────────────────────────┤
│ ┌──────────────────┐   │                                │
│ │ John Smith       │   │   John Smith                   │
│ │ Acme Corp        │   │   CEO @ Acme Corp              │
│ │ ★ Tier 1         │   │                                │
│ └──────────────────┘   │   Email: john@acme.com         │
│ ┌──────────────────┐   │   Phone: (555) 123-4567        │
│ │ Jane Doe         │   │                                │
│ │ Tech Inc         │◄──│   --- Activity ---             │
│ │   Tier 2         │   │   • Enrolled in Sequence A     │
│ └──────────────────┘   │   • Opened email (2d ago)      │
│ ┌──────────────────┐   │                                │
│ │ Bob Wilson       │   │   [Send Email] [Schedule]      │
│ │ Growth Co        │   │                                │
│ └──────────────────┘   │                                │
└────────────────────────┴────────────────────────────────┘
```

**Files to Modify**:
- `src/App.tsx` - Extract prospects section
- Create `src/components/prospects/ProspectsDesktopView.tsx`
- Create `src/components/prospects/ProspectDetailPanel.tsx`

---

#### T703.2: Dashboard Desktop Grid

**Problem**: Dashboard widgets stack vertically even on wide screens.

**Solution**: Dynamic grid based on screen width.

**File**: `src/components/DashboardLayout.tsx`

**Changes**:
```typescript
// Current
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

// Enhanced
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
```

**Widget Size System**:
```typescript
interface WidgetConfig {
  id: string;
  title: string;
  component: ReactNode;
  size: 'sm' | 'md' | 'lg' | 'xl';  // 1, 2, 3, or 4 columns
}
```

---

#### T703.3: Content Max-Width Constraints

**Problem**: On ultra-wide screens (2560px+), content stretches too wide to read comfortably.

**Solution**: Add max-width constraints with centered content.

**CSS Utilities**:
```css
/* Add to index.css */
.content-container {
  max-width: 1600px;
  margin-left: auto;
  margin-right: auto;
}

.content-container-narrow {
  max-width: 1200px;
}

.content-container-wide {
  max-width: 1920px;
}
```

---

## Phase 5: Polish & Accessibility

### Sprint 704: Desktop UX Polish

**Goal**: Fine-tune desktop interactions and accessibility  
**Effort**: 3-4 hours

#### T704.1: Keyboard Navigation Enhancement

**Current State**: Basic tab navigation exists.

**Enhancements**:
- Arrow keys to navigate lists
- Escape to close modals/panels
- Enter to confirm actions
- Focus trapping in modals

**Test Cases**:
1. Tab moves through interactive elements
2. Arrow keys navigate lists
3. Escape closes active overlay
4. Focus returns after modal close

---

#### T704.2: Hover States & Tooltips

**Problem**: Many desktop interactions lack hover feedback.

**Solution**: Add consistent hover states and tooltips.

**Pattern**:
```typescript
<button
  className="
    hover:bg-slate-100
    focus-visible:ring-2 focus-visible:ring-blue-500
    transition-colors duration-150
  "
  title="Detailed action description"
>
```

---

#### T704.3: Desktop Transition Animations

**Problem**: Some transitions are jarring on desktop.

**Solution**: Add subtle, fast transitions.

**CSS**:
```css
/* Smooth state transitions */
.transition-smooth {
  transition: all 150ms ease-out;
}

/* Panel slide-in */
.panel-enter {
  transform: translateX(100%);
}
.panel-enter-active {
  transform: translateX(0);
  transition: transform 200ms ease-out;
}
```

---

## Sprint Summary & Dependencies

**Corrected dependency graph** (per subagent review):

```
T700.1 (LazyIcon) ─────────┬─────► T700.2 (Preloader)
                           │
                           └─────► T700.3 (Event handlers)
                           │
                           └─────► T700.4 (Bundle baseline)


T701.0a (useMediaQuery) ──────────┐
                                  │
T701.0b (TABS config) ────────────┼───► T701.1 (DesktopLayout)
                                  │            │
T701.0c (AppContext) ─────────────┘            ▼
                                         T701.2 (Refactor App.tsx)
                                               │
                                               ▼
                                         T701.3 (NavigationSidebar)


Sprint 702 requires:
  - useMediaQuery (from T701.0a)
  - AppContext (from T701.0c)


Full Sprint Flow:
┌──────────────────────────────────────────────────────────┐
│ Sprint 700 (INP Performance)                             │
│   T700.1 → T700.2 → T700.3 → T700.4                     │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│ Sprint 701 (Layout Architecture)                         │
│   T701.0a,b,c (parallel) → T701.1 → T701.2 → T701.3     │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│ Sprint 702 (Sequence Builder)                            │
│   T702.1 → T702.2 → T702.3 → T702.4 → T702.5            │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│ Sprint 703 (Content Optimization)                        │
│   T703.1 → T703.2 → T703.3                              │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│ Sprint 704 (Polish & A11y)                               │
│   T704.1 → T704.2 → T704.3                              │
└──────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

| Sprint | Priority | Effort | Impact |
|--------|----------|--------|--------|
| **700** | 🔴 HIGH | 3-4h | Fixes Core Web Vital (INP) |
| **701** | 🔴 HIGH | 5-6h | Enables all desktop work + state mgmt |
| **702** | 🔴 HIGH | 6-8h | Primary user complaint (screenshot) |
| **703** | 🟡 MEDIUM | 4-5h | General desktop improvement |
| **704** | 🟢 LOW | 3-4h | Polish, non-blocking |

---

## Validation Checklist

### Performance (Sprint 700)
- [ ] INP < 200ms (down from 360ms)
- [ ] LCP < 2.5s maintained
- [ ] Bundle size not significantly increased

### Layout (Sprint 701)
- [ ] Desktop (1024px): Two-column layout works
- [ ] Tablet (768px): Sidebar collapsible
- [ ] Mobile (375px): Single column, hamburger menu
- [ ] No horizontal scroll at any breakpoint

### Sequence Builder (Sprint 702)
- [ ] Desktop shows split-pane view
- [ ] Mobile shows stacked view
- [ ] All existing functionality preserved
- [ ] Drag-and-drop reordering works

### Content (Sprint 703)
- [ ] Hitlist has detail panel on desktop
- [ ] Dashboard widgets use full width
- [ ] Max-width prevents over-stretching
- [ ] Ultra-wide (2560px) displays correctly

### Accessibility (Sprint 704)
- [ ] Full keyboard navigation
- [ ] Focus management correct
- [ ] Screen reader announcements work
- [ ] Reduced motion respected

---

## Files to Create

| File | Sprint | Purpose |
|------|--------|---------|
| `src/components/icons/LazyIcon.tsx` | 700 | Lazy-loaded icon wrapper with ErrorBoundary |
| `src/components/icons/IconErrorBoundary.tsx` | 700 | Error boundary for icon load failures |
| `src/components/icons/iconPreloader.ts` | 700 | Preload critical icons |
| `src/hooks/useMediaQuery.ts` | 701 | **MOVED**: Responsive hook (prerequisite) |
| `src/config/navigation.ts` | 701 | Tab configuration |
| `src/context/AppContext.tsx` | 701 | App state management context |
| `src/components/layout/DesktopLayout.tsx` | 701 | Desktop grid layout |
| `src/components/layout/AppLayout.tsx` | 701 | App shell container |
| `src/components/layout/NavigationSidebar.tsx` | 701 | Extracted nav component |
| `src/components/layout/MainContentRouter.tsx` | 701 | Content area router |
| `src/components/sequence/DesktopSequenceBuilder.tsx` | 702 | Desktop sequence view |
| `src/components/sequence/MobileSequenceBuilder.tsx` | 702 | Mobile sequence view |
| `src/components/sequence/StepList.tsx` | 702 | Step list with @dnd-kit |
| `src/components/sequence/SortableStepCard.tsx` | 702 | Sortable step card |
| `src/components/sequence/StepEditor.tsx` | 702 | Step detail editor |
| `src/components/sequence/TimelineBar.tsx` | 702 | Visual timeline |
| `src/components/prospects/ProspectsDesktopView.tsx` | 703 | Desktop hitlist |
| `src/components/prospects/ProspectDetailPanel.tsx` | 703 | Prospect detail |

---

## Test Files to Create

| Test File | Sprint | Tests |
|-----------|--------|-------|
| `src/__tests__/components/icons/LazyIcon.test.tsx` | 700 | Lazy loading, error handling |
| `src/__tests__/hooks/useMediaQuery.test.ts` | 701 | SSR safety, hydration |
| `src/__tests__/context/AppContext.test.tsx` | 701 | Context state management |
| `src/__tests__/components/layout/DesktopLayout.test.tsx` | 701 | Layout behavior |
| `src/__tests__/components/layout/NavigationSidebar.test.tsx` | 701 | Tab navigation, a11y |
| `src/__tests__/components/sequence/StepList.test.tsx` | 702 | Step list, DnD a11y |
| `src/__tests__/components/sequence/StepEditor.test.tsx` | 702 | Step editing |
| `e2e/desktop-layout.spec.ts` | 701 | Desktop layout E2E |
| `e2e/sequence-builder-desktop.spec.ts` | 702 | Sequence builder E2E |

---

## Edge Cases to Handle

| Edge Case | Scenario | Handling |
|-----------|----------|----------|
| **Window resize during interaction** | User resizes while editing step | Preserve `selectedStepId` across Desktop↔Mobile switch |
| **Print styles** | User prints hitlist or dashboard | Add `@media print` rules: hide sidebars, expand content |
| **High zoom levels** | Users at 150-200% zoom | Test layouts; may trigger mobile breakpoints |
| **Sidebar resize collision** | Rapid collapse/expand toggling | Debounce resize, prevent animation conflicts |
| **RTL languages** | `sidebarPosition: 'left'` assumes LTR | Use logical properties (`inset-inline-start`) |
| **Empty sequence state** | SequenceBuilder with no steps | Show empty state in StepEditor: "Select or add a step" |
| **Icon load failure** | Network error during lazy load | ErrorBoundary renders fallback icon |
| **LocalStorage quota** | Saving sidebar collapse state | Wrap in try/catch, fail gracefully |
| **Concurrent updates** | Multiple rapid tab clicks | Use `startTransition` for all navigation |
| **Split-pane no selection** | Desktop view, no step selected | Auto-select first step or show CTA |

---

## Playwright Desktop Test Configuration

Add to `playwright.config.ts`:
```typescript
// Add desktop viewport projects
{
  name: 'Desktop Chrome',
  use: { 
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
  },
},
{
  name: 'Desktop Large',
  use: { 
    ...devices['Desktop Chrome'],
    viewport: { width: 1920, height: 1080 },
  },
},
{
  name: 'Desktop Ultra-wide',
  use: { 
    ...devices['Desktop Chrome'],
    viewport: { width: 2560, height: 1440 },
  },
},
```

---

## Accessibility Testing

Add aXe integration to E2E tests:
```typescript
// e2e/fixtures.ts
import AxeBuilder from '@axe-core/playwright';

export async function checkAccessibility(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

// Usage in tests
test('desktop layout is accessible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await checkAccessibility(page);
});
```

---

## Quick Reference: Breakpoints

| Breakpoint | Tailwind | Width | Layout |
|------------|----------|-------|--------|
| Mobile | default | <640px | Single column, hamburger menu |
| Tablet | `sm:` | 640-767px | Single column, visible tabs |
| Tablet+ | `md:` | 768-1023px | Two columns possible |
| Desktop | `lg:` | 1024-1279px | Full desktop layout |
| Wide | `xl:` | 1280-1535px | Extra widgets visible |
| Ultra-wide | `2xl:` | 1536px+ | Max-width constraints |

---

## Dependencies to Install

```bash
# Sprint 700 - No new deps (lucide-react already installed)

# Sprint 702 - Drag and drop
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Sprint 704 (optional) - Accessibility testing
npm install -D @axe-core/playwright
```

---

## Environment Setup

No new environment variables required. All changes are frontend-only.

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Regression in mobile UI | Extensive E2E tests at mobile breakpoints |
| Bundle size increase from layout code | Code splitting, lazy loading |
| Accessibility regression | aXe testing, manual screen reader test |
| Breaking existing functionality | Feature flags for gradual rollout |


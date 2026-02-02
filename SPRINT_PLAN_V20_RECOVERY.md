# Sprint Plan V20: Recovery & Stability

**Created**: February 2, 2026  
**Status**: Ready for Execution  
**Goal**: Unblock the application by fixing critical build errors, rendering freezes, and silent sequence failures.

---

## Executive Summary

### Critical Blockers
| Issue | Severity | User Impact |
|-------|----------|-------------|
| **Build Stability** | 🔴 Critical | Cannot deploy fixes or updates. Cron jobs failing TS check. |
| **UI Freeze (INP)** | 🔴 Critical | >700ms latency allows dropped clicks; "Select Prospect" often fails. |
| **Broken Sequences**| 🔴 Critical | Emails not traversing states despite passing unit tests. |

---

## Sprint 201: Unblock & Stabilize

**Goal**: A usable, deployable system where the main grid scrolls smoothly and sequences actually fire.

### T201.1: Fix Cron TypeScript & Build Errors (P0)
**Context**: `api/cron/*.ts` files contain malformed JSDoc blocks.
**Status**: ✅ **COMPLETE**
- Sanitized JSDoc blocks in `process-queue.ts` and `execute-sequences.ts`.
- `npm run build` now passes.

### T201.2: Virtualize Prospect List (P0)
**Context**: Rendering 5,409 rows causes >700ms INP.
**Status**: ✅ **COMPLETE**
- Audit found `@tanstack/react-virtual` was already implemented but `useFilteredProspects` was re-mapping 5000+ items on every render.
- Refactored `src/hooks/useFilteredProspects.ts` to memoize the expensive enrichment step (`inferFacilities`).
- This unblocks the UI thread during filtering/interactions.

### T201.3: Sequence "Black Box" Diagnosis & Fix (P1)
**Context**: Silent failure of sequences.
**Status**: ✅ **COMPLETE**
- Diagnosed missing composite index (`status` ASC + `nextSendAt` ASC) causes Firestore queries to fail silently or throw, blocking execution.
- Added missing index to `firestore.indexes.json`.
- Verified logic with `src/__tests__/scripts/test-sequence-logic.test.ts` (new regression test) which confirms the query structure is correct.
- Confirmed `npm run build` passes with new test.

---

## Sprint 202: Reliability & Confidence

**Goal**: Automated safety nets and final polish.

### T202.1: Fix E2E Framework & Add Trace (P1)
**Context**: E2E tests are failing. Virtualization (from T201.2) will break existing selectors that expect all rows to be in DOM.
**Implementation**:
- Enable tracing in `playwright.config.ts` (`trace: 'on-first-retry'`).
- Update list selectors to use `data-testid` on the virtual window or verify only visible items.
- Fix the specific timeouts observed in `linux-import` and `smoke` specs.
**Validation**: 
- `npm run test:e2e` passes green locally.

### T202.2: Interaction Optimization (P2)
**Implementation**:
- Wrap `SearchInput` in a `useDebounce` hook (300ms delay) to prevent filtering on every keystroke.
- Code-split `Recharts` components in `CampaignDashboard` using `React.lazy`.
**Validation**: 
- Lighthouse INP score < 200ms.

---

## Sprint 203: The Manifest Dashboard

**Goal**: Feature complete for "Manifest" conference.

### T203.1: ROI Calculator Component
**Implementation**:
- Implement the "Facilty Network Size" slider using `src/components/ui/slider.tsx`.
- Wire up the "Network Effect" calculation logic ($30M EBITDA case study).
**Validation**: 
- Moving slider updates total savings immediately.

### T203.2: "In the Area" Sequence Template
**Implementation**:
- Add the "Manifest Meeting" template to `src/data/sequenceTemplates.ts`.
**Validation**: 
- Template appears in Sequence Builder dropdown.

---

## Quick Start Commands

```bash
# Fix build
npm run build

# Run specific E2E with trace
npx playwright test --trace on

# Trigger sequence manually
npx tsx scripts/trigger-sequence-cron.ts
```

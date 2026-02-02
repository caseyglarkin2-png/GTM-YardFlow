# Sprint Plan V19: Manifest Hardening & App Decomposition

**Status**: Ready for Execution  
**Goal**: Harden the "Manifest Dashboard" for production use, decompose the massive `App.tsx`, and ensure reliability via automated testing.

---

## Executive Summary

### Implementation Gap Analysis
| Feature | Status | Gaps |
| :--- | :--- | :--- |
| **Manifest ROI Calculator** | ✅ Implemented | • Not persisted (refresh = data loss)<br>• No unit tests<br>• Hardcoded magic numbers |
| **Lead Scoring** | ✅ Implemented | • `FacilityInferenceService` has 0% coverage<br>• Logic buried in `App.tsx` sort function |
| **App Architecture** | 🔴 Critical | • `App.tsx` is 3,765 lines (God Component)<br>• Impossible to maintain cleanly |
| **Reliability** | ⚠️ Risks | • No E2E test for the demo flow<br>• No error boundary for calculator |

---

## Strategy: "Stabilize, then Decompose"

1.  **Sprint 907 (Manifest Polish)**: Fix the immediate UX issues (persistence) and add safety nets (tests) for the new features.
2.  **Sprint 908 (Decomposition)**: Break `App.tsx` into manageable chunks (~500 lines each) to enable faster feature development.
3.  **Sprint 909 (Reliability)**: Add E2E automation so we know "all buttons work" before every deploy.

---

## Sprint 907: Manifest Polish & Persistence (The "Demo Ready" Sprint)
**Status**: ✅ DOMPLETED
**Goal**: Ensure the Manifest demo flow is bulletproof and data persists.
**Validation**: Automated tests pass, refresh preserves state.

### T907.1: Persist ROI Calculator State [HIGH]
**Status**: ✅ Done
**Goal**: Save calculator inputs so the "perfect pitch" isn't lost on refresh.
**Implementation**:
- Create `src/hooks/useROICalculator.ts`.
- Use `localStorage` to sync `facilities`, `margin`, `efficiency`.
- Add "Reset to Defaults" button.
**Validation**: Open calculator, change values, refresh page → values remain.

### T907.2: Unit Tests for Lead Scoring [HIGH]
**Status**: ✅ Done
**Goal**: Verify `FacilityInferenceService` correctly identifies asset-heavy prospects.
**Implementation**:
- Create `src/__tests__/services/FacilityInferenceService.test.ts`.
- Test cases:
    - 1000 employees + Logistics = 5 facilities.
    - 50 employees + Logistics = 1 facility.
    - 5000 employees + Retail = 1 facility (not asset-based).
**Validation**: `npm test -- FacilityInferenceService` passes.

### T907.3: Extract Constants & Magic Numbers [MEDIUM]
**Status**: ✅ Done
**Goal**: Centralize configuration.
**Implementation**:
- Create `src/config/roiDefaults.ts`.
- Move hardcoded costs ($5k/facility, $45k labor) to config.
**Validation**: Change config value → UI updates.

### T907.4: Component Tests for ROI Calculator [MEDIUM]
**Status**: ✅ Done
**Goal**: Ensure math works in the UI.
**Implementation**:
- `src/__tests__/components/ROICalculator.test.tsx`.
- Fire event: Change slider → Verify total ROI updates.
**Validation**: `npm test -- ROICalculator` passes.

---

## Sprint 908: The Great Decomposition (Architectural Sprint)
**Goal**: Reduce `App.tsx` from ~3,800 lines to <1,000 lines.
**Validation**: Functionality remains identical, `wc -l` confirms reduction.

### T908.1: Extract `ProspectListPanel`
**Goal**: Move the complex virtualized list and sort logic.
**Implementation**:
- Create `src/components/panels/ProspectListPanel.tsx`.
- Props: `prospects`, `onSelect`, `virtualizer`.
- Move `FacilityInference` sort logic here.
**Validation**: Prospect list renders identical to before.

### T908.2: Extract `ChatPanel` (AI Brain)
**Goal**: ISOlate the complexity of the AI assistant.
**Implementation**:
- Create `src/components/panels/ChatPanel.tsx`.
- Encapsulate `ConversationManager` and message state.
**Validation**: Chat still works, `App.tsx` loses ~500 lines.

### T908.3: Extract `CampaignDashboard`
**Goal**: Move the top-level stats and charts.
**Implementation**:
- Create `src/components/panels/CampaignDashboard.tsx`.
- Move `EmailStatsCard`, `KPICard`, and `ROICalculator` wiring here.
**Validation**: Dashboard tab loads correctly.

---

## Sprint 909: Automated Reliability (The "Sleep at Night" Sprint)
**Goal**: Automated "click all buttons" verification.
**Validation**: Playwright suite passes on CI.

### T909.1: E2E Test - The Manifest Demo Flow
**Goal**: Automate the exact path Casey/Jake will take.
**Implementation**:
- `e2e/manifest-demo.spec.ts`.
- Steps:
    1.  Login.
    2.  Check "Manifest ROI" tab (verify visible).
    3.  Adjust slider to "20 Facilities".
    4.  Verify ROI > $0.
    5.  Go to Hitlist.
    6.  Sort by "Asset Density".
    7.  Click top result (Pepsi/Primo).
    8.  Check "Manifest: In the Area" template.
**Validation**: `npx playwright test manifest-demo` passes.

### T909.2: Type Safety for ROI Props
**Goal**: Ensure `App.tsx` passes correct props to new components.
**Implementation**:
- Add strict Zod schemas for all new Component props.
**Validation**: `npx tsc --noEmit` clean.

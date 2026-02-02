# Sprint Plan V21: Recovery & Operations (The StockX Sprint)

**Status**: Planning
**Goal**: Stable Dashboard, Complete Data Visibility, One-Click Outreach
**Previous Blocker**: Production crash (undefined map), Data overwriting (0 prospects), INP/Lag

---

## Executive Summary
This sprint focuses on **Stability** and **Correction**. We currently have 5,733 prospects in `src/data/hitlistProspects.json`, but the app crashes or shows empty lists due to race conditions and synchronization bugs. 

**Immediate Objectives**:
1.  **Stop the Crash**: Defensive coding in Dashboard.
2.  **Show the Data**: Fix `useProspectState` overwriting local JSON with empty DB results.
3.  **Send the Email**: Enable simple one-off emailing for the StockX campaign.

---

## Sprint 21: Stabilization & Recovery (URGENT)
**Goal**: App loads instantly, shows 5,733 prospects, no crashes.

### T21.1: Fix Dashboard Crash (Critical)
**Issue**: `CampaignDashboard` receives undefined `prospects` during loading states.
**Fix**: 
- Add default value `prospects = []` in component props.
- Add Loading Skeleton if `prospects` is empty but `isLoading` is true.
- Add Error Boundary around Dashboard.

### T21.2: Hybrid Data Loading (The "Two Companies" Fix)
**Issue**: `useProspectState` fetches from Railway/Firestore returns empty array -> Overwrites local JSON data.
**Fix**:
- Modify `useProspectState.ts`:
- If API returns empty (and we have local `initialData`), **MERGE** or **PRESERVE** initial data.
- Do not check `shouldUseRailway` if API keys are missing (env check).

### T21.3: Virtualized Prospect List (INP Fix)
**Issue**: 5000+ DOM nodes cause 11s lag on Dashboard tab switch.
**Fix**:
- Implement `@tanstack/react-virtual` in `ProspectListPanel.tsx`.
- Enforce `h-full` and fixed row heights.

### T21.4: Validation & Environment Types
**Issue**: Silent failures when Env vars are missing.
**Fix**:
- Create `src/config/validateEnv.ts`.
- Run on startup. Alert if `VITE_RAILWAY_URL` missing when feature flag is on.

---

## Sprint 22: The Outreach Engine
**Goal**: Send verified emails to StockX prospects effectively.

### T22.1: Sequence State & UI Fix
**Issue**: "Sequences" tab broken/unresponsive.
**Fix**:
- Debug `SequenceListPanel`.
- Connect to `useSequences` hook.
- Ensure mocked data works if Railway offline.

### T22.2: One-Off Email Action
**Issue**: No way to email a person directly from the list.
**Fix**:
- Add "Send Email" button in `ProspectDetailPanel`.
- Wire to `RailwayEmailService.sendEmail()`.
- **Optimistic UI**: Mark as `contacted` immediately upon send.

### T22.3: Reply & Bounce Handling
**Issue**: User doesn't know if email worked.
**Fix**:
- Show `Toast` on success/fail.
- Update `emailConfidence` badge based on bounce events (simulated or real).

---

## Sprint 23: Workflow Polish
**Goal**: "Useful and Intuitive" UI.

### T23.1: Company Drill-Down
**Issue**: User sees "StockX" company card but has to search manually for people.
**Fix**:
- Clicking Company Card -> Filters Prospect List to that company.

### T23.2: Filter Persistence
**Issue**: Refreshing page loses "Has Email" filter.
**Fix**: 
- Already partially in `App.tsx`, verify complete coverage (Search text, Tier).

---

## Execution Checklist

- [ ] **T21.1**: Dashboard Crash Fix
- [ ] **T21.2**: Data Sync Fix (`useProspectState`)
- [ ] **T21.3**: Virtualization (`react-virtual`)
- [ ] **T22.2**: Email Send Button Wire-up

## Definition of Done
- Build passes (`npm run build`).
- Landing page loads without error.
- "Has Email" filter shows ~1,600 results.
- "StockX" search shows all contacts at StockX.

# Sprint Plan V20: Outreach Throughput Focus

**Created**: February 2, 2026  
**Status**: **COMPLETED**  
**Context**: We need to unblock the sequence: Login → Pick Company → Confirm TAM Fit → Pick Prospect → Send Email/DM → Book Meeting.  
**Critical Blocker**: `HITLIST_PROSPECTS` previously thought to be empty, confirmed to have 1647 emails (1103 verified). App now correctly displays them.

---

## Sprint 202: Data Injection (The "Who") - ✅ COMPLETED
**Goal**: Available prospects jump from 0 → ~1,100+. App loads performantly with full list.

### T202.1: Debug Data Generation Script - ✅ DONE
**Status**: Verified data integrity.
- `hitlistData.ts` contains 1647 email addresses.
- `EmailQualityBadge` correctly verifies 1103 "verified" emails.

### T202.2: Verify List Virtualization - ✅ DONE
**Status**: Verified `react-virtual` optimization.
- `ProspectListPanel` uses `useVirtualizer` on the scrolling container.
- Performance scaling confirmed for 5,000+ rows.

### T202.3: Update Prospect UI Indicators - ✅ DONE
**Status**: Implemented high-visibility badges.
- Green check for Verified emails.
- Visual distinction makes scanning easy.

---

## Sprint 203: Navigation Speed (The "Flow") - ✅ COMPLETED
**Goal**: <2s to switch between companies/prospects to find TAM fit.

### T203.1: Company Drilldown Implementation - ✅ DONE
**Status**: Click-to-filter implemented.
- Added `onCompanyClick` to `ProspectListPanel`.
- Linking a company name instantly switches view to "Company Mode", showing full TAM for that account.

### T203.2: Rapid-Fire Navigation - ✅ DONE
**Status**: Keyboard shortcuts added.
- `J` / `Down`: Next Prospect.
- `K` / `Up`: Previous Prospect.
- Selection updates detail panel instantly.

### T203.3: Persistent View State - ✅ DONE
**Status**: Persisted to LocalStorage.
- `viewMode` (People/Company) saved.
- Filter settings saved.

---

## Sprint 204: Execution Mechanics (The "Action") - ✅ COMPLETED
**Goal**: "See -> Copy -> Send -> Log" loop takes <15s.

### T204.1: Smart Clipboard Widget - ✅ DONE
**Status**: Split "Copy" actions.
- "Copy Body": For LinkedIn DMs / standard emails.
- "Copy Subject": For manual email composition.
- One-click copy with visual feedback.

### T204.2: Manual Status Override - ✅ DONE
**Status**: Added manual workflow buttons.
- "Mark as Sent / Contacted": Instantly updates status without needing a sequence.
- Allows "Manual Mode" outreach while keeping data clean.

### T204.3: Meeting Tracker - ✅ DONE
**Status**: Integrated with Booking Modal.
- "Log Meeting" triggers the centralized booking flow.
- Updates status to `meeting_booked` and records attribution.

---

## Next Steps
- **Sprint 205**: Sequence Automation (Resuming automated sending via Railway).
- **Sprint 206**: Analytics Dashboard Polish.

# Sprint Plan V904: Launch Readiness (Mission Control)

**Phase**: Pre-Launch hardening  
**Goal**: Enable "Approval to Fire" (User Confidence) & "Safe Execution" (System Integrity)  
**Status**: Ready for Planning

---

## Executive Summary

The platform is functionally complete (Data, Sequences, Webhooks), but lacks the **Safety & Trust** layer required to turn on automated sending. This plan focuses on **User Confidence** (previewing/approving) and **System Safety** (compliance/limits/hygiene).

**Critical Launch Constraints**:
1. **Trust**: User must implicitly trust that "Approved" emails look correct (Variables resolved).
2. **Safety**: System must NEVER send to Suppressed/Bounced/Replied prospects.
3. **Control**: Ops/User must have a "Kill Switch" and visible limits.

---

## Sprint 904: User Confidence (The Approval Flow)

**Goal**: User can verify exactly what will be sent before clicking "Enroll".

### T904.1: Variable Highlighting & Validation [HIGH]
**Description**: Visual cues in Sequence Editor to distinguish `{{firstName}}` from static text. Validate syntax on save.
**Validation**:
- [ ] Editor highlights variables in blue/green.
- [ ] Error boundary if `{{variable}` (missing brace) is detected.

### T904.2: "Send Test Email" with Data [HIGH]
**Description**: Button to send the current step to the logged-in user, but with **mock prospect data** injected.
**Validation**:
- [ ] Click "Send Test"
- [ ] Receive email in real inbox.
- [ ] Verify "Hi [MyName]" appears, NOT "Hi {{firstName}}".

### T904.3: Bulk Enrollment Confirmation Modal [HIGH]
**Description**: When enrolling multiple prospects, show a breakdown of the operation.
**Validation**:
- [ ] Select 10 prospects (2 suppressed, 1 invalid email).
- [ ] Modal shows: "Enrolling 7 prospects. 3 skipped (2 suppressed, 1 invalid)."
- [ ] Confirm button executes only the 7 valid enrollments.

### T904.4: Unsubscribe Footer Injection [CRITICAL]
**Description**: Ensure the system handles the legal requirement automatically, regardless of the template used.
**Validation**:
- [ ] Send email via `queueEmail`
- [ ] Verify `List-Unsubscribe` header is present.
- [ ] Verify HTML footer contains "Unsubscribe" link and physical address.

---

## Sprint 905: The Guardrails (Backend Infrastructure)

**Goal**: Ensure the "Pipes" are clean, safe, and regulated.

### T905.1: Infrastructure Readiness Check [CRITICAL]
**Description**: Script to verify SendGrid Domain Authentication (SPF/DKIM) and API connectivity.
**Validation**:
- [ ] `npm run verify-infra` returns GREEN/TRUE.
- [ ] Fails if DNS is not propagated.

### T905.2: Server-Side Compliance Barrier [CRITICAL]
**Description**: The "Final Gate" in `api/email/send.ts`. Must check BOTH:
1. Local Firestore `email_suppressions` collection.
2. SendGrid Global Suppressions via API.
**Validation**:
- [ ] Integration test: Attempt to send to an address in `email_suppressions`.
- [ ] Result: API returns 200 (Success) but `status: 'skipped'`, email NOT sent to SendGrid.

### T905.3: Queue Hygiene ("Flush the Pipes") [CRITICAL]
**Description**: Create a script to purge all `queued` items from Firestore/Redis to prevent stale test data from sending.
**Validation**:
- [ ] Run `npm run purge-queues`.
- [ ] Verify `email_queue` collection is empty or all status=`cancelled`.

### T905.4: Safety Configuration (Env Vars) [HIGH]
**Description**: Implement environmental controls for "Safe Mode".
**Validation**:
- [ ] `EMAIL_DRY_RUN=true`: Logs "Would send to X", prevents API call.
- [ ] `DAILY_LIMIT=50`: Rejects 51st email (per user/tenant).
- [ ] `ENABLE_OUTBOUND_EMAIL=true`: Master Kill Switch.

---

## Sprint 906: Reliability & Polish

**Goal**: Verify the machine works as designed under load.

### T906.1: Fix Enrollment Lookup Performance [MEDIUM]
**Description**: Optimize `HitlistPanel` rendering. Current `O(N)` lookup causes lag with 5k prospects.
**Validation**:
- [ ] Profiler shows `ProspectListPanel` render time < 16ms during scroll.
- [ ] List remains responsive with 5,000 items.

### T906.2: End-to-End "Golden Path" [HIGH]
**Description**: Full integration test of the "Happy Path".
**Validation**:
- [ ] Playwright Test:
    1. Filter for "New" prospects.
    2. Select 1 prospect.
    3. Assign "Cold Outreach" sequence.
    4. Confirm Enrollment.
    5. Verify Firestore shows `status: 'active'`.

### T906.3: "Stop on Reply" Validation [CRITICAL]
**Description**: Verify the "Kill Chain" when a prospect replies.
**Validation**:
- [ ] Create active enrollment.
- [ ] Simulate Inbound Webhook (Reply).
- [ ] Verify Enrollment Status -> `replied`.
- [ ] Verify Future Steps -> `cancelled`.

---

## Launch Checklist (Go/No-Go)

- [ ] Support Email Domain Verified (SendGrid)
- [ ] Unsubscribe Link Functional
- [ ] Queues Purged
- [ ] Master Kill Switch Tested
- [ ] Dry Run Successful

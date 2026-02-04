# Sprint Plan V29: Production UI/UX Gate

**Status**: 🚀 ACTIVE  
**Created**: February 4, 2026  
**Deployed**: https://gtm-yard-flow.vercel.app  
**Commit**: `a48b3d9`  
**Goal**: Comprehensive UI/UX quality gate before Manifest 2026 campaign launch  
**Reviewed By**: UX Expert Subagent (High Bar for User Experience)

---

## Executive Summary

This sprint plan focuses on validating the production deployment through a structured UI/UX review process. The goal is to ensure the platform is user-friendly, accessible, and fully functional before launching the Manifest 2026 ABM email campaign.

### Production URLs

| Environment | URL | Status |
|-------------|-----|--------|
| Production | https://gtm-yard-flow.vercel.app | ✅ Deployed |
| Health | https://gtm-yard-flow.vercel.app/api/health | ✅ Responding |
| Status Page | https://gtm-yard-flow.vercel.app/status | To verify |

### Quality Gate Criteria

| Category | Threshold | Weight |
|----------|-----------|--------|
| **Functionality** | All critical paths work (including failure paths) | 40% |
| **Usability** | < 3 friction points per flow, actionable errors | 25% |
| **Accessibility** | WCAG 2.1 AA, touch targets ≥44px | 15% |
| **Performance** | LCP < 2.5s, INP < 200ms, 500 prospects <2s | 10% |
| **Visual Polish** | No broken layouts/icons, consistent spacing | 10% |

### Critical Gaps Identified (UX Review)

| Gap | Impact | Priority |
|-----|--------|----------|
| Empty states | New users see broken/confusing UI | **P0** |
| Partial failure handling | Users don't know which emails succeeded | **P0** |
| Import flow testing | Core onboarding path untested | **P0** |
| Enrollment flow | Revenue-critical flow not covered | **P0** |
| Loading states audit | UI feels frozen/broken | **P1** |
| Error message quality | Support tickets for unclear errors | **P1** |
| Mobile touch targets | Mobile users can't tap buttons | **P1** |
| Session timeout | Users lose work unexpectedly | **P1** |

---

## Sprint Overview

| Sprint | Focus | Est. Time | Demo |
|--------|-------|-----------|------|
| **G0** | Deployment Verification | 30 min | Health checks pass, app loads |
| **G0.5** | Test Data Setup | 40 min | Test accounts with various states |
| **G1** | Critical Path Testing | 2.5 hours | All core flows work E2E |
| **G1.5** | Import Flow Testing | 1 hour | CSV import works E2E |
| **G2** | Usability Audit | 2 hours | Friction points documented |
| **G3** | Accessibility Audit | 1.5 hours | WCAG violations fixed |
| **G4** | Performance Audit | 1.5 hours | Core Web Vitals pass |
| **G5** | Visual Polish | 1.5 hours | No layout/icon issues |
| **G6** | Fix & Validate | 2 hours | All issues resolved |
| **G7** | Edge Case Stress Testing | 1.5 hours | Failure paths verified |

**Total**: ~14 hours

---

## Sprint G0: Deployment Verification (30 min)

**Goal**: Confirm production deployment is healthy  
**Demo**: All health checks green, app loads without errors

---

### T0.1: Verify Health Endpoints [XS - 5 min]

**Purpose**: Confirm API layer is responding

**Validation**:
```bash
# Health endpoint
curl -s https://gtm-yard-flow.vercel.app/api/health | jq .
# Expected: {"status":"ok","version":"a48b3d9",...}

# Railway proxy health (if enabled)
curl -s https://gtm-yard-flow.vercel.app/api/railway/health -H "Authorization: Bearer test" | head -50
```

**Exit Criteria**: 
- [ ] `/api/health` returns `{"status":"ok"}`
- [ ] Response includes version hash

---

### T0.2: Verify App Loads [XS - 5 min]

**Purpose**: Confirm React SPA hydrates correctly

**Validation** (Manual):
1. Open https://gtm-yard-flow.vercel.app in Chrome
2. Open DevTools Console (F12)
3. Verify no red errors in console
4. Verify page renders content (not blank)

**Exit Criteria**:
- [ ] App renders visible content
- [ ] No critical console errors
- [ ] Loading indicator appears then resolves

---

### T0.3: Verify Status Page [XS - 5 min]

**Purpose**: Confirm status page route works

**Validation**:
1. Navigate to https://gtm-yard-flow.vercel.app/status
2. Verify status page renders (not 404)
3. Verify shows system components

**Exit Criteria**:
- [ ] Status page loads
- [ ] Shows component status (Database, API, etc.)

---

### T0.4: Run E2E Smoke Tests [S - 15 min]

**Purpose**: Automated verification of critical paths

**Command**:
```bash
cd /workspaces/GTM-YardFlow
npx playwright test e2e/smoke.spec.ts --project=chromium
```

**Exit Criteria**:
- [ ] All smoke tests pass
- [ ] No flaky failures

---

## Sprint G0.5: Test Data Setup (40 min)

**Goal**: Create test accounts with various data states for comprehensive testing  
**Demo**: Multiple test scenarios ready for G1 testing

---

### T0.5.1: Create Empty State Test Account [XS - 10 min]

**Purpose**: Test new user experience with no data

**Validation**:
1. Create/use test account with zero prospects
2. Verify dashboard shows empty state
3. Verify prospect list shows empty state with CTA
4. Verify sequence list shows empty state

**Exit Criteria**:
- [ ] Empty account ready for FTUE testing
- [ ] All empty states render (not broken/blank)

---

### T0.5.2: Create Large Dataset Test Account [XS - 10 min]

**Purpose**: Test performance with 500+ prospects

**Validation**:
1. Import or create account with 500+ prospects
2. Verify list renders without performance issues
3. Verify search/filter still responsive

**Exit Criteria**:
- [ ] 500+ prospect account ready
- [ ] Basic navigation works on large dataset

---

### T0.5.3: Create Active Sequences Test Account [XS - 10 min]

**Purpose**: Test sequence enrollment scenarios

**Validation**:
1. Create account with active sequences
2. Add prospects enrolled in sequences
3. Include varied enrollment states (active, paused, completed)

**Exit Criteria**:
- [ ] Account with active sequences ready
- [ ] Multiple enrollment states present

---

### T0.5.4: Create Mixed Email States Test Account [XS - 10 min]

**Purpose**: Test email tracking display

**Validation**:
1. Create account with emails in various states
2. Include: sent, delivered, opened, clicked, bounced, replied
3. Verify status badges display correctly

**Exit Criteria**:
- [ ] Account with mixed email states ready
- [ ] All email states represented

---

## Sprint G1: Critical Path Testing (2.5 hours)

**Goal**: Verify all user-facing critical paths work end-to-end  
**Demo**: Record Loom video of each flow working

---

### T1.1: Auth Flow Testing [S - 20 min]

**Purpose**: Verify authentication works

**Test Scenarios**:
| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | Anonymous Load | Open app fresh | App loads, shows login prompt or auto-anon auth |
| 2 | Firebase Auth | Sign in with email (if enabled) | User authenticated, name shown |
| 3 | Session Persistence | Refresh page after login | User remains logged in |
| 4 | Auth Error | Disable network, try action | Graceful error message |

**Validation** (Manual testing + Screenshot each state)

**Exit Criteria**:
- [ ] Anonymous auth works (or proper login flow)
- [ ] Session persists across refresh
- [ ] Auth errors handled gracefully

---

### T1.2: Prospect List Flow [M - 30 min]

**Purpose**: Verify prospect viewing and filtering

**Test Scenarios**:
| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | View List | Navigate to Prospects tab | List renders with data |
| 2 | Search | Type in search box | Filtered results |
| 3 | Filter by Tier | Apply tier filter | Only matching tiers shown |
| 4 | Sort | Click column header | Sort applied correctly |
| 5 | Select Multi | Shift+click multiple rows | Selection count updates |
| 6 | View Detail | Click prospect row | Detail panel opens |
| 7 | Empty State | Filter to no results | "No prospects" message |

**Validation**:
```typescript
// e2e/prospects.spec.ts should cover this
npx playwright test e2e/prospects.spec.ts --project=chromium
```

**Exit Criteria**:
- [ ] Prospect list loads with data
- [ ] Search filters correctly
- [ ] Multi-select works
- [ ] Detail panel opens

---

### T1.3: Bulk Email Flow [M - 30 min]

**Purpose**: Verify bulk email composition and preview

**Test Scenarios**:
| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | Open Modal | Select prospects → Email button | Modal opens |
| 2 | Template Select | Choose template from dropdown | Subject/body populate |
| 3 | AI Generate | Click "Generate AI" | Content generates with provider indicator |
| 4 | Preview | View preview panel | Personalized content shown |
| 5 | Char Limits | Type long subject | Warning appears at 60+ chars |
| 6 | Confirmation | Click Send | Confirmation dialog shows count |
| 7 | Cancel | Click Cancel | Modal closes, no action |

**Validation**:
```bash
npx playwright test e2e/bulk.spec.ts --project=chromium
```

**Exit Criteria**:
- [ ] Modal opens and populates
- [ ] Templates load from Railway (or fallback)
- [ ] AI generation works (or shows fallback)
- [ ] Preview shows personalized content
- [ ] Send confirmation shows recipient count

---

### T1.4: Sequence Builder Flow [S - 20 min]

**Purpose**: Verify sequence creation and management

**Test Scenarios**:
| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | Open Builder | Navigate to Sequences tab | Builder loads |
| 2 | Create Sequence | Click "New Sequence" | Empty sequence created |
| 3 | Add Step | Click "Add Step" | Step form appears |
| 4 | Set Delay | Configure delay between steps | Delay saved |
| 5 | Save | Click Save | Sequence persisted |
| 6 | List View | Return to sequence list | New sequence appears |

**Validation**:
```bash
npx playwright test e2e/sequence-builder.spec.ts --project=chromium
```

**Exit Criteria**:
- [ ] Sequence builder loads
- [ ] Can add/remove steps
- [ ] Sequences persist

---

### T1.5: Dashboard Flow [S - 20 min]

**Purpose**: Verify dashboard displays correctly

**Test Scenarios**:
| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | Load Dashboard | Navigate to Dashboard tab | KPI cards render |
| 2 | View Charts | Scroll to charts section | Charts display data |
| 3 | Railway Health | Find health card | Status indicator visible |
| 4 | Meeting Card | Find meeting attribution | Metrics displayed |
| 5 | Refresh | Click refresh/reload | Data updates |

**Validation**:
```bash
npx playwright test e2e/dashboard.spec.ts --project=chromium
```

**Exit Criteria**:
- [ ] Dashboard loads with metrics
- [ ] Health status visible
- [ ] Charts render correctly

---

### T1.6: Navigation Flow [S - 20 min]

**Purpose**: Verify all navigation paths work

**Test Scenarios**:
| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | Tab Navigation | Click each tab | Tab content loads |
| 2 | Desktop Sidebar | (Desktop) Click sidebar items | Panel changes |
| 3 | Mobile Menu | (Mobile) Toggle hamburger | Menu opens/closes |
| 4 | Keyboard Nav | Press Tab repeatedly | Focus moves logically |
| 5 | Command Palette | Press Cmd+K | Palette opens |

**Validation**:
```bash
npx playwright test e2e/navigation.spec.ts --project=chromium
npx playwright test e2e/desktop-navigation.spec.ts --project=chromium
```

**Exit Criteria**:
- [ ] All tabs accessible
- [ ] Desktop sidebar works
- [ ] Mobile menu toggles
- [ ] Command palette opens

---

### T1.7: Empty State Testing [S - 15 min]

**Purpose**: Verify empty states are helpful, not broken

**Test Scenarios** (Use empty state test account from G0.5.1):
| # | Area | Expected |
|---|------|----------|
| 1 | Empty Dashboard | Shows helpful message + "Import Prospects" CTA |
| 2 | Empty Prospect List | Shows "No prospects yet" + import button |
| 3 | Empty Sequence List | Shows "Create your first sequence" CTA |
| 4 | Empty Search Results | Shows "No results found" + clear filters option |
| 5 | Empty Activity | Shows "No activity yet" message |

**Exit Criteria**:
- [ ] All empty states render correctly
- [ ] Each has clear CTA for next action
- [ ] No broken/blank UI on empty data

---

### T1.8: Bulk Send Partial Failure [M - 20 min]

**Purpose**: Verify graceful handling when some emails fail

**Test Scenarios**:
| # | Scenario | Expected |
|---|----------|----------|
| 1 | 3/10 fail (suppressed) | Clear report showing which failed and why |
| 2 | Railway timeout | Timeout message, retry option |
| 3 | Circuit breaker trips | Fallback notification, queue indication |

**Validation**:
1. Include suppressed emails in batch
2. Verify failure report shows specific failures
3. Verify retry option for retryable failures

**Exit Criteria**:
- [ ] Partial failures clearly reported
- [ ] User knows which succeeded/failed
- [ ] Retry option available for retryable failures

---

### T1.9: Session Timeout Recovery [S - 15 min]

**Purpose**: Verify graceful recovery when auth token expires

**Test Scenarios**:
| # | Scenario | Expected |
|---|----------|----------|
| 1 | Token expires during idle | Gentle re-auth prompt, not data loss |
| 2 | Token expires mid-edit | Draft preserved, re-auth then continue |
| 3 | Token expires mid-bulk-send | Queue remaining, resume after re-auth |

**Exit Criteria**:
- [ ] No data loss on session timeout
- [ ] Clear re-auth message
- [ ] User can continue after re-auth

---

### T1.10: Prospect Enrollment Flow [M - 20 min]

**Purpose**: Verify sequence enrollment works end-to-end

**Test Scenarios**:
| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | Single Enroll | Select 1 prospect → Enroll in sequence | Confirmation, badge appears |
| 2 | Bulk Enroll | Select 5 prospects → Bulk enroll | Progress, all enrolled |
| 3 | Already Enrolled | Try enrolling already-enrolled prospect | Clear conflict message |
| 4 | View Status | Click enrolled prospect | Enrollment status visible |
| 5 | Pause/Resume | Pause enrollment | Status updates to paused |

**Exit Criteria**:
- [ ] Single enrollment works
- [ ] Bulk enrollment works
- [ ] Conflicts handled gracefully
- [ ] Status visible in prospect detail

---

### T1.11: Cancel Mid-Operation [S - 15 min]

**Purpose**: Verify clean cancellation of in-progress operations

**Test Scenarios**:
| # | Scenario | Expected |
|---|----------|----------|
| 1 | Cancel bulk send at 50% | Clear state, shows X sent, Y cancelled |
| 2 | Cancel CSV import at 50% | No partial data imported |
| 3 | Cancel sequence creation | No orphan sequence created |

**Exit Criteria**:
- [ ] Cancel button visible during long operations
- [ ] Clean state after cancel
- [ ] Clear indication of what was/wasn't done

---

### T1.12: Railway Unavailable Fallback [S - 15 min]

**Purpose**: Verify graceful degradation when Railway is down

**Test Scenarios**:
| # | Scenario | Expected |
|---|----------|----------|
| 1 | Railway timeout | Loading → Error with retry button |
| 2 | Circuit breaker open | Fallback message, local queue indication |
| 3 | Template load fails | Fallback to static templates |

**Validation**: Simulate by blocking Railway requests in DevTools

**Exit Criteria**:
- [ ] App remains usable when Railway down
- [ ] Clear fallback messaging
- [ ] Retry option available

---

### T1.13: Deep Link Navigation [S - 10 min]

**Purpose**: Verify direct URLs work correctly

**Test Scenarios**:
| # | URL | Expected |
|---|-----|----------|
| 1 | /prospects | Loads prospect list directly |
| 2 | /sequences | Loads sequence builder directly |
| 3 | /dashboard | Loads dashboard directly |
| 4 | Invalid route | 404 page or redirect to home |

**Exit Criteria**:
- [ ] All deep links work
- [ ] Auth required pages prompt login first
- [ ] Invalid routes handled gracefully

---

### T1.14: Browser Back Button [S - 10 min]

**Purpose**: Verify back button doesn't break navigation

**Test Scenarios**:
| # | Scenario | Expected |
|---|----------|----------|
| 1 | Back from modal | Modal closes, not page navigate |
| 2 | Back from detail panel | Panel closes, list visible |
| 3 | Back between tabs | Returns to previous tab |

**Exit Criteria**:
- [ ] Modals close on back (not page navigate)
- [ ] Tab history works correctly
- [ ] No unexpected navigation

---

## Sprint G1.5: Import Flow Testing (1 hour)

**Goal**: Verify CSV import works end-to-end (core onboarding flow)  
**Demo**: Import 50 prospects from CSV, see them in list

---

### T1.5.1: CSV Import Happy Path [M - 15 min]

**Purpose**: Verify basic import works

**Test Scenarios**:
| # | Step | Expected |
|---|------|----------|
| 1 | Upload CSV (50 rows) | File parsed, preview shown |
| 2 | Column Mapping | Auto-detect works for name, email, company |
| 3 | Preview | Shows first 5 rows with mapped columns |
| 4 | Import | Progress indicator, success message |
| 5 | Verify | Prospects appear in list |

**Exit Criteria**:
- [ ] CSV parses correctly
- [ ] Column mapping works
- [ ] Prospects imported successfully

---

### T1.5.2: CSV Import with Duplicates [S - 15 min]

**Purpose**: Verify duplicate detection works

**Validation**:
1. Upload CSV with 5 duplicates (matching emails)
2. Verify duplicate detection UI appears
3. Choose skip/merge/overwrite
4. Verify correct action taken

**Exit Criteria**:
- [ ] Duplicates detected
- [ ] User can choose resolution strategy
- [ ] No unintended duplicates created

---

### T1.5.3: CSV Import with Bad Data [S - 15 min]

**Purpose**: Verify error handling for invalid data

**Test Scenarios**:
| # | Error Type | Expected |
|---|------------|----------|
| 1 | Invalid email format | Row highlighted, error message |
| 2 | Missing required field | Row highlighted, can fix or skip |
| 3 | Encoding issues | Warning shown, preview readable |

**Exit Criteria**:
- [ ] Errors highlighted per row
- [ ] User can fix or skip bad rows
- [ ] Partial import works (good rows imported)

---

### T1.5.4: Large CSV Import [S - 10 min]

**Purpose**: Verify large file handling

**Validation**:
1. Upload CSV with 500+ rows
2. Verify progress indicator appears
3. Verify browser doesn't freeze
4. Verify all rows imported

**Exit Criteria**:
- [ ] Progress indicator visible
- [ ] Browser responsive during import
- [ ] Large file imports successfully

---

### T1.5.5: Column Mapping Accuracy [XS - 5 min]

**Purpose**: Verify auto-detection of common columns

**Test Columns**:
| Column Name | Should Map To |
|-------------|---------------|
| First Name | firstName |
| Last Name | lastName |
| Email | email |
| Company | company |
| Title / Job Title | title |
| Phone | phone |
| LinkedIn | linkedInUrl |

**Exit Criteria**:
- [ ] Common column names auto-detected
- [ ] Manual mapping available for unrecognized columns

---

## Sprint G2: Usability Audit (2 hours)

**Goal**: Identify and document UX friction points  
**Demo**: Friction point report with severity ratings

---

### T2.1a: Empty Dashboard CTA Clarity [S - 10 min]

**Purpose**: Verify new users know what to do on empty dashboard

**Validation**:
1. Load app with empty account
2. Verify clear value proposition visible
3. Verify obvious first action (import prospects)
4. Time to first meaningful action < 30 seconds

**Exit Criteria**:
- [ ] Clear CTA on empty dashboard
- [ ] User understands what to do within 30s

---

### T2.1b: First Prospect Add Flow [S - 10 min]

**Purpose**: Evaluate adding first prospect experience

**Validation**:
1. Click "Add Prospect" (or equivalent)
2. Measure clicks to complete
3. Verify helpful field labels/hints
4. Verify success feedback

**Target**: < 5 clicks to add first prospect

**Exit Criteria**:
- [ ] Add prospect flow is intuitive
- [ ] Form has helpful hints
- [ ] Success clearly indicated

---

### T2.1c: First Sequence Create Flow [S - 10 min]

**Purpose**: Evaluate creating first sequence experience

**Validation**:
1. Navigate to sequences
2. Click "Create Sequence"
3. Add 2 steps
4. Save sequence
5. Measure total clicks/time

**Target**: < 10 clicks to create basic sequence

**Exit Criteria**:
- [ ] Sequence creation is intuitive
- [ ] Step templates available
- [ ] Delay configuration clear

---

### T2.1d: First Email Send Guidance [S - 10 min]

**Purpose**: Evaluate sending first email experience

**Validation**:
1. Select a prospect
2. Initiate email send
3. Compose/select template
4. Send
5. Verify confirmation

**Target**: < 5 clicks from prospect to sent email

**Exit Criteria**:
- [ ] Email flow is straightforward
- [ ] Templates easily accessible
- [ ] Send confirmation clear

---

### T2.2a: Bulk Select Efficiency [S - 10 min]

**Purpose**: Measure efficiency of selecting many prospects

**Validation**:
1. Select 20 of 100 prospects (using shift-click, checkbox)
2. Measure clicks required
3. Verify select all / select none available

**Target**: < 25 clicks to select 20 non-contiguous prospects

**Exit Criteria**:
- [ ] Multi-select is efficient
- [ ] Select all works
- [ ] Selection count visible

---

### T2.2b: Filter to Find Specific Tier [S - 10 min]

**Purpose**: Measure efficiency of tier-based filtering

**Validation**:
1. Filter prospect list to Tier 1 only
2. Measure clicks required
3. Verify filter is visible/accessible

**Target**: < 3 clicks to filter by tier

**Exit Criteria**:
- [ ] Tier filter easily accessible
- [ ] Filter state visible
- [ ] Clear filter option available

---

### T2.2c: Send Email from Prospect Detail [S - 10 min]

**Purpose**: Measure efficiency of contextual email send

**Validation**:
1. Open prospect detail panel
2. Initiate email from panel
3. Measure clicks to send

**Target**: < 3 clicks from detail panel to send

**Exit Criteria**:
- [ ] Quick action available in detail panel
- [ ] Context preserved (prospect auto-selected)

---

### T2.2d: Check Sequence Performance [S - 10 min]

**Purpose**: Measure efficiency of viewing sequence metrics

**Validation**:
1. Navigate to sequence analytics/performance
2. Verify key metrics visible (open rate, reply rate)
3. Measure clicks required

**Target**: < 3 clicks to view sequence performance

**Exit Criteria**:
- [ ] Performance metrics easily accessible
- [ ] Key metrics prominently displayed

---

### T2.3: Error State & Edge Case Audit [S - 30 min]

**Purpose**: Verify error handling is user-friendly

**Scenarios to Test**:
| Scenario | Expected | Actual | Notes |
|----------|----------|--------|-------|
| Network offline | Offline banner appears | | |
| API timeout | Loading → Error with retry | | |
| Invalid form input | Inline error message | | |
| Empty search results | "No results" message | | |
| Rate limit hit | User-friendly message | | |
| Session expired | Re-auth prompt | | |

**Method**: Simulate each condition, verify handling

**Exit Criteria**:
- [ ] All error states tested
- [ ] User-friendly messages confirmed
- [ ] Missing error states flagged

---

### T2.4: Loading State Consistency [S - 15 min]

**Purpose**: Verify all async actions have visible loading states

**Checklist**:
| Action | Has Loading State | Type (Skeleton/Spinner) | Notes |
|--------|-------------------|-------------------------|-------|
| Page load | | | |
| Search/filter | | | |
| Modal open | | | |
| AI generate | | | |
| Save action | | | |
| Bulk operation | | | |

**Exit Criteria**:
- [ ] All async actions have loading states
- [ ] Skeletons used for content, spinners for actions
- [ ] No frozen UI during loading

---

### T2.5: Error Message Quality [S - 15 min]

**Purpose**: Verify error messages are actionable

**Checklist** (for each error found):
| Error | Is Specific | Is Actionable | Has Recovery Path | Notes |
|-------|-------------|---------------|-------------------|-------|
| | | | | |

**Good Example**: "Email bounced - the address john@acme.com appears to be invalid. Remove from list?"  
**Bad Example**: "Error sending email"

**Exit Criteria**:
- [ ] All errors are specific (not generic)
- [ ] All errors suggest action
- [ ] Recovery path available where possible

---

### T2.6: Confirmation Dialog Clarity [S - 10 min]

**Purpose**: Verify destructive actions have clear confirmations

**Checklist**:
| Action | Has Confirmation | Shows What Will Happen | Has Undo | Notes |
|--------|------------------|------------------------|----------|-------|
| Delete prospect | | | | |
| Remove from sequence | | | | |
| Bulk delete | | | | |
| Clear filters | | | | |

**Exit Criteria**:
- [ ] Destructive actions require confirmation
- [ ] Confirmation shows impact ("Delete 5 prospects?")
- [ ] Undo available where practical

---

### T2.7: Progress Feedback for Bulk Operations [S - 10 min]

**Purpose**: Verify bulk operations show progress

**Checklist**:
| Operation | Shows X/Y | Shows ETA | Is Cancellable | Notes |
|-----------|-----------|-----------|----------------|-------|
| Bulk email | | | | |
| CSV import | | | | |
| Bulk enroll | | | | |
| Bulk delete | | | | |

**Exit Criteria**:
- [ ] All bulk operations show progress
- [ ] Users can cancel in-progress operations
- [ ] Clear indication when complete

---

### T2.8: Zero Results State [S - 10 min]

**Purpose**: Verify helpful messaging when no results

**Scenarios**:
| Scenario | Message Quality | Has Clear Filter CTA | Notes |
|----------|-----------------|----------------------|-------|
| Search no match | | | |
| Filter no match | | | |
| Date range empty | | | |

**Exit Criteria**:
- [ ] Zero results shows helpful message
- [ ] Clear filters option visible
- [ ] Suggestions for broadening search

---

### T2.9: Form Validation Timing [S - 15 min]

**Purpose**: Verify validation UX is smooth

**Checklist**:
| Form | Validates on Blur | Summary on Submit | Focus on First Error | Notes |
|------|-------------------|-------------------|----------------------|-------|
| Add prospect | | | | |
| Email compose | | | | |
| Sequence step | | | | |
| Import mapping | | | | |

**Exit Criteria**:
- [ ] Inline validation on blur
- [ ] Error summary on submit
- [ ] Focus jumps to first error
- [ ] Errors clear when fixed

---

### T2.10: Success Feedback [S - 10 min]

**Purpose**: Verify successful actions are clearly confirmed

**Checklist**:
| Action | Has Confirmation | Type (Toast/Inline) | Duration Appropriate | Notes |
|--------|------------------|---------------------|----------------------|-------|
| Save prospect | | | | |
| Send email | | | | |
| Create sequence | | | | |
| Import complete | | | | |
| Enroll complete | | | | |

**Exit Criteria**:
- [ ] Every action has success feedback
- [ ] Toasts auto-dismiss appropriately (3-5s)
- [ ] Critical success persists until acknowledged

---

## Sprint G3: Accessibility Audit (1.5 hours)

**Goal**: Verify WCAG 2.1 AA compliance  
**Demo**: Lighthouse accessibility score ≥ 90

---

### T3.1: Automated Accessibility Scan [S - 20 min]

**Purpose**: Run automated accessibility checks

**Tools**:
1. Lighthouse Accessibility Audit
2. axe DevTools browser extension
3. Playwright accessibility tests

**Commands**:
```bash
# Run Playwright accessibility tests
npx playwright test e2e/accessibility.spec.ts --project=chromium

# Manual: Run Lighthouse in Chrome DevTools
# Performance → Accessibility audit
```

**Exit Criteria**:
- [ ] Lighthouse accessibility ≥ 90
- [ ] axe reports 0 critical issues
- [ ] Playwright a11y tests pass

---

### T3.2: Keyboard Navigation Audit [S - 20 min]

**Purpose**: Verify full keyboard accessibility

**Checklist**:
| Element | Tab Reachable | Enter Activates | Focus Visible | Skip Link |
|---------|---------------|-----------------|---------------|-----------|
| Main nav tabs | | | | |
| Prospect list rows | | | | |
| Modal dialogs | | | | |
| Form inputs | | | | |
| Buttons/actions | | | | |

**Method**: Navigate entire app using only keyboard

**Exit Criteria**:
- [ ] All interactive elements tab-reachable
- [ ] Focus indicator always visible
- [ ] Focus trap works in modals
- [ ] No keyboard traps

---

### T3.3: Screen Reader Testing [S - 20 min]

**Purpose**: Verify content is readable by screen readers

**Checklist**:
| Element | Has Label | Announces State | Logical Order |
|---------|-----------|-----------------|---------------|
| Navigation | | | |
| Data tables | | | |
| Status badges | | | |
| Form fields | | | |
| Buttons | | | |
| Loading states | | | |

**Method**: Use VoiceOver (Mac) or NVDA (Windows) to navigate

**Exit Criteria**:
- [ ] All elements properly labeled
- [ ] State changes announced
- [ ] Reading order logical

---

### T3.4: Focus Management Audit [S - 10 min]

**Purpose**: Verify focus is managed correctly after user actions

**Scenarios**:
| Scenario | Focus Should Return To |
|----------|------------------------|
| Modal closes | Button that opened modal |
| Inline edit saves | Saved field or next field |
| Item deleted from list | Previous/next item in list |
| Bulk action completes | Toolbar or first selected item |

**Exit Criteria**:
- [ ] Focus returns to logical element after action
- [ ] No focus lost to body/nowhere

---

### T3.5: Dynamic Content Announcements [S - 10 min]

**Purpose**: Verify dynamic content changes announced to screen readers

**Scenarios**:
| Content Change | Should Announce |
|----------------|-----------------|
| Bulk send progress | "Sending X of Y emails" |
| Import progress | "Importing X of Y prospects" |
| Toast notification | Toast message content |
| Error message | Error text |

**Method**: Use aria-live regions or role="status"

**Exit Criteria**:
- [ ] Progress updates announced
- [ ] Errors announced
- [ ] Toasts announced

---

### T3.6: Skip Navigation [S - 5 min]

**Purpose**: Verify skip link exists for keyboard users

**Validation**:
1. Tab on fresh page load
2. First focusable should be "Skip to main content"
3. Activating should jump to main content area

**Exit Criteria**:
- [ ] Skip link present
- [ ] Skip link functional
- [ ] Skip link visible on focus

---

### T3.7: Color Contrast Verification [S - 10 min]

**Purpose**: Verify all text meets 4.5:1 contrast ratio

**Checklist** (use axe DevTools or manual check):
| Element | Passes 4.5:1 | Notes |
|---------|--------------|-------|
| Body text | | |
| Link text | | |
| Button text | | |
| Error text (red on white) | | |
| Warning text (yellow) | | |
| Success text (green) | | |
| Placeholder text | | |

**Exit Criteria**:
- [ ] All text meets 4.5:1 ratio
- [ ] Error/warning/success states contrast compliant

---

### T3.8: Touch Target Sizes [S - 10 min]

**Purpose**: Verify all interactive elements ≥ 44x44px on mobile

**Method**:
1. Open DevTools → Device emulation (iPhone 14)
2. Use "Show element sizes" to measure touch targets
3. Check buttons, links, checkboxes, icons

**Problem Areas to Check**:
| Element | Size | Passes 44px | Notes |
|---------|------|-------------|-------|
| Table row checkboxes | | | |
| Action icon buttons | | | |
| Close X buttons | | | |
| Filter tags | | | |

**Exit Criteria**:
- [ ] All touch targets ≥ 44x44px
- [ ] Small targets have padding to meet minimum

---

## Sprint G4: Performance Audit (1.5 hours)

**Goal**: Verify Core Web Vitals meet targets  
**Demo**: Lighthouse performance score ≥ 80

---

### T4.1: Core Web Vitals Measurement [S - 20 min]

**Purpose**: Measure LCP, INP, CLS

**Targets**:
| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| LCP (Largest Contentful Paint) | < 2.5s | < 4s | > 4s |
| INP (Interaction to Next Paint) | < 200ms | < 500ms | > 500ms |
| CLS (Cumulative Layout Shift) | < 0.1 | < 0.25 | > 0.25 |

**Tools**:
- Chrome DevTools → Performance panel
- Lighthouse Performance audit
- WebPageTest.org

**Exit Criteria**:
- [ ] LCP < 2.5s
- [ ] INP < 200ms (verified with LazyIcon fix)
- [ ] CLS < 0.1

---

### T4.2: Bundle Size Analysis [S - 20 min]

**Purpose**: Identify large bundles impacting load time

**Command**:
```bash
cd /workspaces/GTM-YardFlow
npm run build 2>&1 | grep -E "kB|KB|MB"
```

**Current Bundle Sizes** (from deployment):
| Bundle | Size | Gzipped | Action |
|--------|------|---------|--------|
| index (main) | 2,652 kB | 530 kB | ⚠️ Large - code split |
| vendor-charts | 518 kB | 157 kB | Lazy load |
| vendor-lucide | 440 kB | 114 kB | ✅ Using LazyIcon |
| vendor-firebase | 416 kB | 125 kB | Consider alternatives |

**Exit Criteria**:
- [ ] Bundle sizes documented
- [ ] Largest bundles have mitigation plan

---

### T4.3: Network Waterfall Analysis [S - 20 min]

**Purpose**: Identify blocking requests

**Method**:
1. Open DevTools → Network panel
2. Hard refresh (Cmd+Shift+R)
3. Check waterfall for blocking resources
4. Verify API calls parallelized

**Checklist**:
| Item | Status | Notes |
|------|--------|-------|
| No render-blocking CSS | | |
| JS loaded with defer/async | | |
| API calls parallelized | | |
| Images lazy loaded | | |
| Service worker caching | | |

**Exit Criteria**:
- [ ] No render-blocking resources
- [ ] API calls don't block UI
- [ ] SW pre-caches critical assets

---

### T4.4: Large Dataset Performance [S - 20 min]

**Purpose**: Verify app performs well with 500+ prospects

**Test Scenarios** (Use large dataset test account from G0.5.2):
| Scenario | Target | Measure | Notes |
|----------|--------|---------|-------|
| Load 500 prospect list | < 2s | Time to interactive | |
| Scroll through list | 60fps | No jank | |
| Search 500 prospects | < 300ms | Filter response | |
| Select 50 prospects | Instant | No lag | |

**Method**: 
1. Use Chrome DevTools Performance panel
2. Record scroll/interaction performance
3. Check for dropped frames

**Exit Criteria**:
- [ ] 500 prospects loads in < 2s
- [ ] Scrolling is smooth (60fps)
- [ ] No interaction lag

---

### T4.5: Search Debounce Verification [XS - 10 min]

**Purpose**: Verify search doesn't trigger excessive API calls

**Validation**:
1. Open DevTools → Network panel
2. Type quickly in search box (10 characters in 1 second)
3. Count API calls triggered

**Target**: ≤ 1 API call per 300ms of typing

**Exit Criteria**:
- [ ] Search is debounced (not every keystroke)
- [ ] Max 3-4 API calls for rapid typing

---

### T4.6: Image/Asset Lazy Loading [XS - 10 min]

**Purpose**: Verify below-fold content lazy loads

**Validation**:
1. Load page with Network panel open
2. Check images marked "loading=lazy" or use Intersection Observer
3. Scroll down, verify images load as needed

**Exit Criteria**:
- [ ] Below-fold images lazy load
- [ ] No layout shift when images load (CLS)

---

### T4.7: Memory Leak Check [S - 20 min]

**Purpose**: Verify no memory leaks during navigation

**Validation**:
1. Open Chrome Task Manager (Shift+Esc)
2. Note initial memory usage
3. Navigate between all tabs 10 times
4. Open/close modals 10 times
5. Check memory usage

**Target**: Memory should not continuously grow (minor GC spikes OK)

**Exit Criteria**:
- [ ] Memory stable after navigation
- [ ] No continuous growth pattern
- [ ] GC runs effectively

---

## Sprint G5: Visual Polish Audit (1.5 hours)

**Goal**: Fix layout issues, broken icons, visual inconsistencies  
**Demo**: All pages render correctly on desktop and mobile

---

### T5.1: Desktop Layout Audit [S - 20 min]

**Purpose**: Verify desktop layouts render correctly

**Viewports to Test**: 1440px, 1280px, 1024px

**Checklist**:
| Page/Component | 1440px | 1280px | 1024px | Notes |
|----------------|--------|--------|--------|-------|
| Dashboard | | | | |
| Prospect List | | | | |
| Bulk Email Modal | | | | |
| Sequence Builder | | | | |
| Detail Panel | | | | |
| Sidebar | | | | |

**Method**: Resize browser, check each component

**Exit Criteria**:
- [ ] No overlapping elements
- [ ] No horizontal scroll
- [ ] Sidebar toggles correctly

---

### T5.2: Mobile Layout Audit [S - 20 min]

**Purpose**: Verify mobile responsiveness

**Viewports to Test**: 375px (iPhone), 768px (iPad)

**Checklist**:
| Page/Component | 375px | 768px | Notes |
|----------------|-------|-------|-------|
| Dashboard | | | |
| Prospect List | | | |
| Modals | | | |
| Forms | | | |
| Navigation | | | |

**Method**: DevTools device emulation

**Exit Criteria**:
- [ ] Touch targets ≥ 44px
- [ ] No horizontal scroll
- [ ] Modals fit viewport

---

### T5.3: Icon & Asset Audit [S - 20 min]

**Purpose**: Verify all icons load correctly

**Checklist**:
| Area | Icons Load | Consistent Style | Notes |
|------|------------|------------------|-------|
| Navigation | | | |
| Buttons | | | |
| Status badges | | | |
| Table actions | | | |
| Empty states | | | |
| Loading states | | | |

**Method**: Visual scan all pages for broken/missing icons

**Exit Criteria**:
- [ ] All icons render (no placeholders)
- [ ] Consistent icon style (Lucide)
- [ ] LazyIcon loading works smoothly

---

### T5.4: Hover/Focus States [S - 15 min]

**Purpose**: Verify all interactive elements have visible feedback

**Checklist**:
| Element | Has Hover State | Has Focus State | Consistent Style | Notes |
|---------|-----------------|-----------------|------------------|-------|
| Buttons | | | | |
| Links | | | | |
| Table rows | | | | |
| Cards | | | | |
| Menu items | | | | |
| Form inputs | | | | |

**Exit Criteria**:
- [ ] All interactive elements have hover state
- [ ] All focusable elements have focus state
- [ ] Consistent visual language

---

### T5.5: Text Truncation Handling [S - 10 min]

**Purpose**: Verify long text truncates gracefully

**Test Scenarios**:
| Location | Long Text | Expected |
|----------|-----------|----------|
| Prospect name column | 50+ char name | Truncate + ellipsis + tooltip |
| Company column | Very long company name | Truncate + ellipsis + tooltip |
| Email subject preview | Long subject | Truncate with tooltip |
| Sidebar nav items | Long labels | Truncate appropriately |

**Exit Criteria**:
- [ ] Long text truncates with ellipsis
- [ ] Full text available on hover (tooltip)
- [ ] No layout breaking from long text

---

### T5.6: Spacing Consistency [S - 15 min]

**Purpose**: Verify 8px grid system is respected

**Audit Areas**:
| Area | Margins | Padding | Gaps | Notes |
|------|---------|---------|------|-------|
| Cards | | | | |
| Modal content | | | | |
| Form fields | | | | |
| Table cells | | | | |
| Button groups | | | | |

**Target**: All spacing should be multiples of 4px (preferably 8px)

**Exit Criteria**:
- [ ] Consistent spacing throughout
- [ ] No arbitrary pixel values
- [ ] Visual rhythm maintained

---

### T5.7: Dark Mode Verification (if supported) [S - 10 min]

**Purpose**: Verify dark mode renders correctly

**Checklist**:
| Component | Readable | Contrast OK | No Artifacts | Notes |
|-----------|----------|-------------|--------------|-------|
| Dashboard | | | | |
| Prospect list | | | | |
| Modals | | | | |
| Forms | | | | |
| Charts | | | | |

**Exit Criteria**:
- [ ] All components work in dark mode
- [ ] Contrast ratios maintained
- [ ] No white flashes or artifacts

---

### T5.8: Print Styles (if needed) [XS - 5 min]

**Purpose**: Verify printable pages render correctly

**Pages to Test**:
- Dashboard summary
- Prospect list
- Sequence performance report

**Exit Criteria**:
- [ ] Printable content is usable
- [ ] No broken layouts in print
- [ ] Unnecessary UI hidden (nav, buttons)

---

## Sprint G6: Fix & Validate (2 hours)

**Goal**: Address all issues found in G0-G5  
**Demo**: All audits re-run and pass

---

### T6.1: Critical Issue Fixes [M - 1 hour]

**Purpose**: Fix all Critical/High severity issues

**Issue Tracking Format**:
| ID | Severity | Category | Description | Fix | Status |
|----|----------|----------|-------------|-----|--------|
| G1 | Critical | | | | |
| G2 | High | | | | |

**Process**:
1. Prioritize by severity
2. Fix each issue with atomic commit
3. Add test if applicable
4. Verify fix locally

**Exit Criteria**:
- [ ] All Critical issues fixed
- [ ] All High issues fixed
- [ ] Each fix has commit

---

### T6.2: Re-run All Audits [S - 30 min]

**Purpose**: Verify all fixes work

**Validation**:
```bash
# E2E tests
npx playwright test --project=chromium

# Type check
npx tsc --noEmit

# Unit tests
npm test -- --run
```

**Exit Criteria**:
- [ ] All E2E tests pass
- [ ] No TypeScript errors
- [ ] Unit tests pass

---

### T6.3: Deploy Fixes to Production [S - 15 min]

**Purpose**: Deploy validated fixes

**Command**:
```bash
git add -A && git commit -m "fix: UI/UX gate issues"
npx vercel --prod
```

**Exit Criteria**:
- [ ] Production deployed
- [ ] Health endpoint responds
- [ ] Smoke tests pass on prod

---

### T6.4: Final Sign-off Checklist [S - 15 min]

**Purpose**: Gate approval

**Sign-off Matrix**:
| Category | Auditor | Pass/Fail | Notes |
|----------|---------|-----------|-------|
| Functionality (G1) | | | |
| Usability (G2) | | | |
| Accessibility (G3) | | | |
| Performance (G4) | | | |
| Visual Polish (G5) | | | |

**Gate Decision**:
- [ ] **APPROVED** - Ready for Manifest 2026 campaign
- [ ] **CONDITIONAL** - Minor issues tracked, can proceed
- [ ] **BLOCKED** - Critical issues must be fixed first

---

## Sprint G7: Edge Case Stress Testing (1.5 hours)

**Goal**: Verify failure paths and edge cases work correctly  
**Demo**: All stress scenarios handled gracefully

---

### T7.1: Rapid Click Testing [S - 15 min]

**Purpose**: Verify double-submit prevention works

**Test Scenarios**:
| Action | Expected |
|--------|----------|
| Double-click "Send Email" button | Only one email sent |
| Rapid-click "Save" | Only one save operation |
| Spam-click "Add to Sequence" | Single enrollment |
| Quick double-click "Delete" | Only one delete (with confirmation) |

**Validation**:
1. Open Network panel
2. Rapidly click buttons
3. Count API calls

**Exit Criteria**:
- [ ] Buttons disable on click (during processing)
- [ ] No duplicate operations
- [ ] Visual feedback during processing

---

### T7.2: Multi-Tab Consistency [S - 15 min]

**Purpose**: Verify data consistency across browser tabs

**Test Scenarios**:
| Scenario | Expected |
|----------|----------|
| Edit prospect in Tab A, refresh Tab B | Tab B shows updated data |
| Delete prospect in Tab A, view in Tab B | Tab B shows deletion (or graceful error) |
| Both tabs select same prospect | No conflict |

**Exit Criteria**:
- [ ] Data refreshes on tab focus (or real-time sync)
- [ ] No stale data shown after edits
- [ ] Conflicts handled gracefully

---

### T7.3: Slow Network Simulation [S - 20 min]

**Purpose**: Verify app works on slow connections

**Method**:
1. DevTools → Network → Throttle → Slow 3G
2. Navigate through app
3. Verify loading states appear
4. Verify no timeouts or errors on slow load

**Test Areas**:
| Area | Loading State Appears | Completes Eventually | Notes |
|------|----------------------|----------------------|-------|
| Dashboard load | | | |
| Prospect list | | | |
| Email send | | | |
| CSV import | | | |

**Exit Criteria**:
- [ ] App works on slow 3G (with loading states)
- [ ] No premature timeouts
- [ ] Users can still complete tasks

---

### T7.4: Token Refresh During Active Session [S - 15 min]

**Purpose**: Verify token refresh doesn't disrupt user

**Validation**:
1. Start a bulk operation (or long form edit)
2. Wait for token to near expiry (or simulate)
3. Verify background refresh occurs
4. Verify operation completes

**Exit Criteria**:
- [ ] Token refreshes silently
- [ ] No interruption to user
- [ ] No data loss

---

### T7.5: Concurrent Bulk Operations [S - 15 min]

**Purpose**: Verify parallel operations from multiple sources

**Test Scenarios**:
| Scenario | Expected |
|----------|----------|
| Tab A bulk emailing, Tab B starts import | Both complete, clear feedback |
| Two users editing same prospect | Last write wins (or conflict message) |
| Bulk email while sequence running | Both proceed (or queue) |

**Exit Criteria**:
- [ ] Concurrent operations don't conflict
- [ ] Clear feedback for each operation
- [ ] No data corruption

---

### T7.6: Recovery from Browser Crash/Close [S - 15 min]

**Purpose**: Verify draft recovery and state persistence

**Test Scenarios**:
| Scenario | Expected |
|----------|----------|
| Close tab mid-email-compose | Draft saved or warning on close |
| Browser crash during CSV import | Can resume or clear indication of failure |
| Close during sequence creation | Draft preserved or explicit discard |

**Method**:
1. Start an operation
2. Close browser tab (or force quit)
3. Reopen and check state

**Exit Criteria**:
- [ ] Important state is preserved (or warning shown)
- [ ] No orphaned data from incomplete operations
- [ ] Clear indication of what was/wasn't saved

---

### T7.7: Browser Compatibility Verification [S - 15 min]

**Purpose**: Verify core functionality works across browsers

**Browsers to Test**:
| Browser | Version | Core Load | Navigation | Forms | Modals |
|---------|---------|-----------|------------|-------|--------|
| Chrome | Latest | | | | |
| Safari | Latest | | | | |
| Firefox | Latest | | | | |
| Edge | Latest | | | | |
| Safari iOS | Latest | | | | |
| Chrome Android | Latest | | | | |

**Exit Criteria**:
- [ ] Core functionality works in all major browsers
- [ ] No critical JS errors
- [ ] Layouts render correctly

---

## Appendix A: Issue Template

```markdown
## Issue: [Title]

**Severity**: Critical / High / Medium / Low
**Category**: Functionality / Usability / Accessibility / Performance / Visual

**Description**:
[What's wrong]

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected**:
[What should happen]

**Actual**:
[What actually happens]

**Screenshot/Video**:
[Attach]

**Proposed Fix**:
[If known]
```

---

## Appendix B: E2E Test Coverage Map

| Flow | E2E Test File | Status |
|------|---------------|--------|
| App Load | `smoke.spec.ts` | ✅ |
| Navigation | `navigation.spec.ts` | ✅ |
| Prospects | `prospects.spec.ts` | ✅ |
| Bulk Actions | `bulk.spec.ts` | ✅ |
| Email | `email.spec.ts` | ✅ |
| Sequences | `sequence-builder.spec.ts` | ✅ |
| Dashboard | `dashboard.spec.ts` | ✅ |
| Accessibility | `accessibility.spec.ts` | ✅ |
| Performance | `performance.spec.ts` | ✅ |
| Desktop UI | `desktop-*.spec.ts` | ✅ |

---

## Appendix C: Quick Reference Commands

```bash
# Run all E2E tests
npx playwright test --project=chromium

# Run specific test file
npx playwright test e2e/smoke.spec.ts

# Run with UI
npx playwright test --ui

# Generate report
npx playwright show-report

# Health check
curl -s https://gtm-yard-flow.vercel.app/api/health | jq .

# Deploy to production
npx vercel --prod
```

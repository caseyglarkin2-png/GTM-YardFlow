# YardFlow Sprint Roadmap — February 2026

**Mission**: Sales automation platform that can send tracked email sequences and book meetings.

---

## Current State Summary

| Area | Status | Notes |
|------|--------|-------|
| **Railway Backend** | ✅ Deployed | YardFlow-Hitlist on Railway with Postgres, Redis, SendGrid |
| **Desktop UI Components** | ✅ Created | LazyIcon, DesktopLayout, SplitPane all tested |
| **App.tsx Integration** | ⚠️ Partial | T800.1-T800.2 complete, T800.3 deferred |
| **Email Sending** | ⚠️ Ready | Railway has SendGrid, just needs verified sender |
| **Webhooks** | ⚠️ Ready | SendGrid, Calendly handlers exist, need testing |
| **Tests** | ✅ 128/129 passing | 1 pre-existing failure in StepPreview |

---

## Sprint 800: App.tsx Integration ✅ COMPLETED

**Goal**: Wire up existing components to fix desktop UX and INP  
**Status**: ✅ Foundation complete, layout extraction deferred  
**Validation**: TypeScript compiles, 128/129 tests pass

### T800.1: Add AppProvider to main.tsx ✅
- **File**: `src/main.tsx`
- **Change**: Wrap `<App />` with `<AppProvider>`
- **Status**: ✅ COMPLETE
- **Validation**: App renders, no console errors

### T800.2: Replace Lucide Imports with LazyIcon ✅
- **File**: `src/App.tsx`
- **Change**: 
  - Replaced 56 icon usages with LazyIcon
  - Kept only `Zap, Loader` as critical imports
  - Added `preloadCriticalIcons()` call on mount
- **Status**: ✅ COMPLETE
- **Validation**: TypeScript compiles, icons render correctly

### T800.3: Layout Integration (Deferred to Sprint 810)
- **Rationale**: App.tsx at 3,470 lines requires incremental extraction
- **Risk Assessment**: Full extraction would risk regressions in coupled state
- **Prep Work Done**: 
  - ✅ useIsDesktop hook imported and instantiated
  - ✅ All layout components tested and ready
- **Status**: ⏸️ DEFERRED - safer as incremental migration

### T800.4: SplitPane in SequenceBuilder (Deferred)
- **Status**: ⏸️ DEFERRED to Sprint 810

---

## Sprint 810: Incremental Layout Extraction (Future)

**Goal**: Incrementally extract App.tsx into composable components  
**Approach**: One component per PR, with full test coverage

### T810.1: Extract TabNavigation Component
- **From**: Lines 1867-1967 of App.tsx (tab buttons)
- **To**: `src/components/layout/TabNavigation.tsx`
- **Why**: Tab nav is self-contained, low coupling

### T810.2: Extract ProspectFilters Component
- **From**: Lines 1968-2100 of App.tsx (filter UI)
- **To**: `src/components/ProspectFilters.tsx`
- **Why**: Filter state can be lifted cleanly

### T810.3: Integrate NavigationSidebar
- **Replace**: Inline tab navigation with NavigationSidebar component
- **Why**: Use existing tested component

### T810.4: Integrate DesktopLayout Wrapper
- **Replace**: Inline flex layout with DesktopLayout component
- **Why**: CSS Grid provides better responsive behavior

### T810.5: SplitPane in SequenceBuilder
- **Unchanged from original T800.4 scope**

---

## Sprint 801: Railway Integration Verification (Monday Afternoon)

**Goal**: Confirm end-to-end email flow works  
**Effort**: 1 hour  
**Blocked By**: Sprint 800 (need working UI to test properly)

### T801.1: Verify Railway Health
```bash
curl https://yardflow-hitlist-production-2f41.up.railway.app/api/health | jq
```
- **Expected**: `{"status":"healthy","timestamp":"..."}`
- **Effort**: 5 minutes

### T801.2: Test Sequence Creation via UI
1. Navigate to Sequences tab
2. Click "Create New Sequence"
3. Add 2 steps (Initial + Follow-up)
4. Save sequence
- **Validation**: Sequence appears in Firestore AND Railway
- **Effort**: 15 minutes

### T801.3: Test Prospect Enrollment via UI
1. Navigate to Hitlist
2. Select a test prospect
3. Click "Enroll in Sequence"
4. Select the test sequence
5. Confirm enrollment
- **Validation**: Enrollment in Firestore, email queued in Railway
- **Effort**: 15 minutes

### T801.4: Verify Email Queue Processing
```bash
# Check queue status
curl -H "Authorization: Bearer $CRON_SECRET" \
  "$RAILWAY_URL/api/email/queue/status" | jq

# Trigger queue processing
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "$RAILWAY_URL/api/cron/process-queue"
```
- **Validation**: Email moves from "pending" to "sent"
- **Effort**: 15 minutes

---

## Sprint 802: End-to-End Smoke Test (Monday EOD)

**Goal**: Validate full workflow works  
**Effort**: 1 hour

### T802.1: Complete User Journey
1. **Import**: Upload test CSV with 3 prospects
2. **Hitlist**: Verify prospects appear, filter by Tier 1
3. **Sequence**: Create "Manifest Outreach" sequence (3 steps)
4. **Enroll**: Bulk enroll all 3 prospects
5. **Dashboard**: See enrollments on dashboard
6. **Email**: Verify first emails queued
- **Effort**: 45 minutes

### T802.2: Desktop Layout Verification
Test at breakpoints:
- 1920x1080 (desktop)
- 1440x900 (laptop)
- 1024x768 (small laptop)
- 768x1024 (tablet portrait)
- 375x812 (mobile)
- **Validation**: No horizontal scroll, all features accessible
- **Effort**: 15 minutes

---

## Sprint 803: SendGrid Production Setup (Tuesday)

**Goal**: Enable actual email delivery  
**Effort**: 2-3 hours

### T803.1: Verify SendGrid Domain
- Configure SPF, DKIM records
- Verify sender domain
- **Validation**: SendGrid shows domain verified

### T803.2: Configure Webhooks
- Set up SendGrid webhook URL: `{VERCEL_URL}/api/webhooks/sendgrid`
- Enable events: delivered, open, click, bounce, spamreport, unsubscribe
- **Validation**: Test webhook receives events

### T803.3: Test Real Email Delivery
- Create test sequence
- Enroll yourself as test prospect
- Verify email arrives in inbox
- **Validation**: Email received with correct content

---

## Sprint 804: Reply Detection (Wednesday)

**Goal**: Detect when prospects reply to stop sequences  
**Effort**: 3-4 hours

### T804.1: Configure SendGrid Inbound Parse
- Set up MX records for reply domain
- Configure SendGrid inbound parse webhook
- **Validation**: Inbound emails reach `/api/webhooks/inbound`

### T804.2: Test Reply Detection
- Reply to test email
- Verify sequence pauses/stops
- Verify reply logged in Firestore
- **Validation**: Enrollment moves to `replied` state

### T804.3: Implement OOO Detection
- Integrate OutOfOfficeDetector service
- Parse return date from OOO messages
- Auto-pause with resume date
- **Validation**: OOO reply → enrollment paused → auto-resume

---

## Sprint 805: Calendly Integration (Thursday)

**Goal**: Track meetings booked via Calendly links  
**Effort**: 2-3 hours

### T805.1: Configure Calendly Webhook
- Register webhook in Calendly admin
- Point to `/api/webhooks/calendly`
- Enable `invitee.created`, `invitee.canceled` events
- **Validation**: Webhook receives test booking

### T805.2: Meeting Attribution
- Match booking email to prospect
- Update enrollment to `meeting` state
- Stop sequence on meeting booked
- **Validation**: Book meeting → sequence stops → prospect marked as won

### T805.3: Dashboard Metrics
- Add meeting count to dashboard
- Show meeting conversion rate
- **Validation**: Dashboard shows accurate meeting metrics

---

## Sprint 806: Production Data Import (Friday)

**Goal**: Import real Manifest 2026 prospect data  
**Effort**: 2-3 hours

### T806.1: Prepare CSV Data
- Clean Manifest contacts CSV
- Validate required fields (email, name, company)
- Remove duplicates
- **Validation**: Clean CSV ready for import

### T806.2: Bulk Import
- Use Import wizard to upload CSV
- Map columns to prospect fields
- Review duplicates
- **Validation**: Prospects appear in Hitlist

### T806.3: Tier Assignment
- Apply Primo Lookalike scoring
- Assign T1/T2/T3 tiers
- **Validation**: Prospects have correct tier assignments

---

## Sprint 807: Launch Readiness (Next Week)

**Goal**: Everything ready for actual outreach  
**Effort**: Full day

### T807.1: Create Production Sequences
- Build 3-step Manifest outreach sequence
- Review email copy
- Test with internal team
- **Validation**: Sequence approved by team

### T807.2: Enroll First Batch
- Select T1 prospects (highest priority)
- Bulk enroll in sequence
- Monitor first sends
- **Validation**: First batch of emails sent successfully

### T807.3: Monitor & Iterate
- Check delivery rates
- Monitor bounce rates
- Adjust sequence timing if needed
- **Validation**: 95%+ delivery rate

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| App.tsx changes break features | High | Run full test suite after each change |
| SendGrid domain not verified | High | Start verification Monday |
| Railway returns 502 | Medium | Check Railway logs, verify health endpoint |
| INP still high after LazyIcon | Medium | Profile with DevTools, preload critical icons |
| Sequence builder UX poor | Low | Defer SplitPane if time-constrained |

---

## Quick Commands

```bash
# Development
npm run dev                     # Start dev server
npm test -- --run               # Run all tests
npm run build                   # Build for production

# Type checking
npx tsc --noEmit

# Railway health check
curl https://yardflow-hitlist-production-2f41.up.railway.app/api/health | jq

# Check email queue
CRON_SECRET="your-secret"
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://yardflow-hitlist-production-2f41.up.railway.app/api/email/queue/status" | jq
```

---

## Success Metrics

| Metric | Target | Actual (Feb 1) |
|--------|--------|----------------|
| TypeScript | Compiles | ✅ Zero errors |
| Tests Passing | 128+/129 | ✅ 128/129 (1 pre-existing) |
| LazyIcon Integration | App.tsx | ✅ 56 instances replaced |
| AppProvider | main.tsx | ✅ Complete |
| INP | < 200ms | ⏳ Needs verification |
| Desktop Layout | Works at 1440px | ⏳ Sprint 810 |

---

## Sprint 800 Completion Summary

**Date Completed**: February 1, 2026

### What Was Done
| Task | Status | Details |
|------|--------|---------|
| T800.1 | ✅ | AppProvider wraps App in main.tsx |
| T800.2 | ✅ | 56 LazyIcon replacements, preloadCriticalIcons on mount |
| T800.3 | ⏸️ | Deferred - useIsDesktop added, full extraction too risky |
| T800.4 | ⏸️ | Deferred - SplitPane ready when layout is extracted |

### Why T800.3 Was Deferred
App.tsx is 3,470 lines with highly coupled state. Full extraction risk:
- **High regression risk** - 50+ useState calls reference each other
- **No isolated test coverage** for extracted components
- **Better approach**: Incremental extraction in Sprint 810

### Files Changed
- `src/main.tsx` - AppProvider wrapper
- `src/App.tsx` - 56 LazyIcon replacements, preloadCriticalIcons, useIsDesktop

### Subagent Review Score
| Aspect | Score |
|--------|-------|
| Code Quality | 8/10 |
| Test Coverage | 7/10 |
| Risk Management | 9/10 |
| Documentation | 6/10 → Now updated |
| Production Readiness | 8/10 |
| **Overall** | **7.5/10** |

---

## Definition of Done (Per Task)

Each task is complete when:
1. ✅ Code changes implemented
2. ✅ Tests pass (`npm test -- --run`)
3. ✅ TypeScript compiles (`npx tsc --noEmit`)
4. ✅ Visual verification at key breakpoints
5. ✅ Committed with descriptive message
6. ✅ Can demo the feature

---

## Team Assignments (Suggested)

| Person | Focus Area |
|--------|------------|
| **Casey** | Sprint 810 (Incremental layout extraction) - Knows the frontend |
| **Jake** | Sprint 801-802 (Railway verification) - Knows the backend |
| **Both** | Sprint 803+ (Production setup) - Cross-functional |

---

## Monday Morning Priorities

Since Sprint 800 foundation is complete, Monday should focus on:

1. **Sprint 801** - Verify Railway health and test sequence creation
2. **Sprint 802** - End-to-end smoke test with real UI
3. **Verify INP** - Chrome DevTools → Performance → Check INP < 200ms
4. **Sprint 803** - Start SendGrid domain verification

Layout extraction (Sprint 810) can happen incrementally after production flow is validated.

---

*Last Updated: February 1, 2026*  
*Next Review: Monday EOD*---

*Last Updated: Session End*  
*Next Review: Monday EOD*

# YardFlow Sprint Roadmap — January 2025

**Mission**: Sales automation platform that can send tracked email sequences and book meetings.

---

## Current State Summary

| Area | Status | Notes |
|------|--------|-------|
| **Railway Backend** | ✅ Deployed | YardFlow-Hitlist on Railway with Postgres, Redis, SendGrid |
| **Desktop UI Components** | ✅ Created | LazyIcon, DesktopLayout, SplitPane all tested |
| **App.tsx Integration** | ❌ Not done | 3489-line monolith needs refactoring |
| **Email Sending** | ⚠️ Ready | Railway has SendGrid, just needs verified sender |
| **Webhooks** | ⚠️ Ready | SendGrid, Calendly handlers exist, need testing |
| **Tests** | ✅ 78/78 passing | Layout, icons, context tests all green |

---

## Sprint 800: App.tsx Integration (Monday Morning)

**Goal**: Wire up existing components to fix desktop UX and INP  
**Effort**: 3.5-4 hours  
**Validation**: INP < 200ms, desktop layout works at 1440px

### T800.1: Add AppProvider to main.tsx
- **File**: `src/main.tsx`
- **Change**: Wrap `<App />` with `<AppProvider>`
- **Why**: Enable accessibility announcer, prepare for state migration
- **Test**: App still renders, no console errors
- **Effort**: 10 minutes

### T800.2: Replace Lucide Imports with LazyIcon
- **File**: `src/App.tsx`
- **Change**: 
  - Remove ~30 icon imports from lucide-react
  - Keep only `Zap, Loader` for critical above-fold use
  - Import `LazyIcon` from `@/components/icons`
  - Replace all icon usages: `<Menu />` → `<LazyIcon name="Menu" />`
- **Why**: Fix INP blocking from synchronous icon bundle
- **Test**: Chrome DevTools → Performance → INP < 200ms
- **Effort**: 45 minutes (~40 replacements)

### T800.3a: Extract SidebarContent Component
- **File**: `src/App.tsx` → new `src/components/layout/SidebarContent.tsx`
- **Change**: Move sidebar JSX (lines ~1816-1960) to separate component
- **Why**: Enable clean DesktopLayout integration
- **Test**: Sidebar still renders, tabs still work
- **Effort**: 45 minutes

### T800.3b: Extract MainContent Component
- **File**: `src/App.tsx` → new `src/components/layout/MainContent.tsx`
- **Change**: Move main content JSX (lines ~2280-3400) to separate component
- **Why**: Enable clean DesktopLayout integration
- **Test**: All tabs still render their content
- **Effort**: 30 minutes

### T800.3c: Integrate DesktopLayout Wrapper
- **File**: `src/App.tsx`
- **Change**: Replace inline layout with DesktopLayout component
- **Why**: Proper responsive grid layout, sidebar collapse
- **Test**: 
  - 1440px: Side-by-side layout
  - 375px: Hamburger menu works
- **Effort**: 45 minutes

### T800.4: SplitPane in SequenceBuilder (Optional)
- **File**: `src/components/SequenceBuilder.tsx`
- **Change**: Use SplitPane for desktop sequence editing
- **Why**: Better UX for building sequences
- **Test**: Can edit sequence steps with list on left, editor on right
- **Effort**: 1 hour
- **Note**: SKIP if T800.3 runs long

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

| Metric | Monday Target | Week Target |
|--------|---------------|-------------|
| INP | < 200ms | < 100ms |
| Tests Passing | 78/78 | 90+ |
| Desktop Layout | Works at 1440px | All breakpoints |
| Email Delivery | Queue working | 95%+ delivered |
| Meetings Booked | N/A | 5+ from sequences |

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
| **Casey** | Sprint 800 (App.tsx integration) - Knows the frontend |
| **Jake** | Sprint 801-802 (Railway verification) - Knows the backend |
| **Both** | Sprint 803+ (Production setup) - Cross-functional |

---

*Last Updated: Session End*  
*Next Review: Monday EOD*

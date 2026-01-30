# YardFlow GTM Hub - Sprint Plan V12: EMAIL UNBLOCK

## 🎯 THE NORTH STAR

> **Jake needs to send outreach emails TODAY.** Everything else is secondary.

---

## EXECUTIVE SUMMARY

### Current State Analysis (2026-01-30)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYSTEM STATUS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Railway Backend:    ✅ HEALTHY (database: 70ms, redis: 1ms, all queues OK)  │
│ Railway Email:      ❌ BLOCKED (requires NextAuth session, not Firebase)    │
│ Vercel Email:       ✅ READY (SendGrid configured, api/email/health OK)     │
│ Vercel Crons:       ✅ CONFIGURED (execute-sequences + process-queue @5min) │
│ Email Fallback:     ⚠️  WORKS BUT INEFFICIENT (tries Railway first, fails)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Real Problem

1. **Railway email auth is broken** - It expects NextAuth session, but users auth with Firebase
2. **App tries Railway first** - `isRailwayAvailable()` returns TRUE (health check passes)
3. **Every email send has a delay** - First tries Railway, gets 401, THEN falls back to Vercel
4. **Soak test is irrelevant** - That's for USER AUTH migration, not email sending

### What We Need

| Need | Solution | ETA |
|------|----------|-----|
| Send emails immediately | Fix Railway fallback logic | 30 min |
| Sequence automation | Already works via Vercel crons | ✅ Done |
| Email tracking | Vercel has SendGrid webhooks configured | ✅ Done |
| Better UX | Skip Railway attempt when auth not available | 30 min |

---

## 🚨 CRITICAL PATH: Sprint 101 (SHIP TODAY)

### Goal: Jake sends outreach emails within the hour

---

### Sprint 101: Email Unblock

**Sprint Goal:** Remove Railway email attempt when auth unavailable, ensure Vercel fallback is primary path.

---

#### T101.0: Verify Vercel Environment Variables [S - 5min]
**Platform:** Vercel Dashboard

**Problem:** Vite inlines env vars at build time. If Railway flags were set to `true` during a previous build, the deployed app will still try Railway.

**Process:**
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Verify these are set correctly for Production:
   - `VITE_RAILWAY_ENABLED` = `false`
   - `VITE_RAILWAY_EMAIL_ENABLED` = `false`
   - `VITE_RAILWAY_AUTH_ENABLED` = `false`
3. If any are missing or `true`, add/update them
4. Trigger redeploy after env var changes

**Validation:**
- [ ] All three Railway flags are explicitly set to `false` in Vercel
- [ ] New deployment triggered after changes

**Commit:** N/A (environment configuration)

---

#### T101.1: Fix isRailwayAvailable to Use Feature Flags [S - 15min]
**Files:** `src/services/RailwayEmailService.ts`

**Problem:** `isRailwayAvailable()` only checks health, not the feature flags. Railway is healthy but can't accept our auth tokens.

**Solution:** Use the existing `shouldUseRailwayEmail()` feature flag helper (from `featureFlags.ts`) instead of hardcoding.

```typescript
// Current (broken):
export async function isRailwayAvailable(): Promise<boolean> {
  const health = await checkRailwayHealth();
  return health?.status === 'healthy';
}

// Fixed:
import { shouldUseRailwayEmail } from '../config/featureFlags';

export async function isRailwayAvailable(): Promise<boolean> {
  // Use feature flag system - checks RAILWAY_ENABLED AND RAILWAY_EMAIL_ENABLED
  if (!shouldUseRailwayEmail()) {
    console.log('[Email] Railway email disabled via feature flag, using Vercel');
    return false;
  }
  
  const health = await checkRailwayHealth();
  return health?.status === 'healthy';
}
```

**Why this is better:**
- Uses existing, well-designed feature flag infrastructure
- Checks BOTH `RAILWAY_ENABLED` (master switch) AND `RAILWAY_EMAIL_ENABLED` (specific switch)
- Consistent with other Railway feature routing patterns in the codebase

**Validation:**
- [ ] `npm run build` succeeds
- [ ] `npx tsc --noEmit` passes
- [ ] `isRailwayAvailable()` returns `false` when feature flags are off
- [ ] Email sends go directly to Vercel endpoint (no Railway 401 errors in console)

**Commit:** `fix(email): skip Railway when email feature flag disabled`

---

#### T101.2: Add Railway Auth Prerequisite Check [S - 15min]
**Files:** `src/App.tsx` (sendEmailToProspect function)

**Problem:** Even with T101.1, the current code has verbose Railway logging that confuses debugging.

**Solution:** Add clear logging about which email path is being used.

```typescript
// In sendEmailToProspect:
const useRailway = await isRailwayAvailable();
console.log(`[Email] Using ${useRailway ? 'Railway' : 'Vercel'} for email to ${selectedProspect.email}`);
```

**Validation:**
- [ ] Console clearly shows "Using Vercel for email" when Railway auth not enabled
- [ ] No misleading "Railway send failed" messages

**Commit:** `fix(email): add clear email path logging`

---

#### T101.3: Verify Vercel Email Health in UI [S - 20min]
**Files:** `src/hooks/useEmailHealth.ts` (new), `src/components/EmailStatusIndicator.tsx` (new)

**Problem:** Jake doesn't know if email is working until he tries to send.

**Solution:** Add a status indicator that shows email system health.

```typescript
// src/hooks/useEmailHealth.ts
export function useEmailHealth() {
  const [status, setStatus] = useState<'checking' | 'healthy' | 'degraded' | 'down'>('checking');
  
  useEffect(() => {
    fetch('/api/email/health')
      .then(r => r.json())
      .then(data => setStatus(data.status === 'healthy' ? 'healthy' : 'degraded'))
      .catch(() => setStatus('down'));
  }, []);
  
  return { status };
}
```

**Validation:**
- [ ] Hook correctly detects email health
- [ ] Status shows in UI (can be minimal - just a colored dot)
- [ ] No build errors

**Commit:** `feat(email): add email health status hook and indicator`

---

#### T101.4: Test Email Send E2E [S - 20min]
**Files:** None (manual test)

**Process:**
1. Open https://gtm-yard-flow.vercel.app
2. Login with Firebase
3. Select a prospect with a valid email
4. Generate AI message
5. Click "Send Email"
6. Verify:
   - [ ] Console shows "Using Vercel for email"
   - [ ] Email queues successfully (success toast)
   - [ ] Prospect status updates to "contacted"
   - [ ] Email appears in prospect's inbox (check real email or SendGrid activity)

**Documentation:** Fill in results in `docs/EMAIL_SEND_TEST_RESULTS.md`

**Commit:** `docs(email): add manual email test results`

---

#### T101.5: Verify Sequence Execution Works [S - 20min]
**Files:** None (manual verification)

**Process:**
1. Check Vercel logs for `/api/cron/execute-sequences` runs
2. Verify crons are running every 5 minutes
3. Enroll a test prospect in a sequence
4. Verify:
   - [ ] Enrollment created in Firestore (`sequenceEnrollments` collection)
   - [ ] First email queued (check `email_queue` collection)
   - [ ] Cron processes queue and sends email

**Documentation:** Update `docs/SEQUENCE_VERIFICATION.md`

**Commit:** `docs(sequences): verify cron execution working`

---

## 📊 Sprint 101 Definition of Done

| Criteria | Status |
|----------|--------|
| Jake can send individual emails from UI | ⬜ |
| Emails go via Vercel (no Railway 401 errors) | ⬜ |
| Email health visible in UI | ⬜ |
| Sequence enrollments work | ⬜ |
| Cron jobs executing (check Vercel logs) | ⬜ |
| All tests pass | ⬜ |
| Build succeeds | ⬜ |
| Committed and pushed | ⬜ |

---

## 🔮 FUTURE SPRINTS (After Jake is unblocked)

### Sprint 102: Railway Auth Bridge (Post-Soak Test)

**Prerequisite:** Complete AUTH_SOAK_TEST_RESULTS.md with passing metrics

Once Railway auth is proven stable:
- T102.1: Enable VITE_RAILWAY_AUTH_ENABLED=true
- T102.2: Test Railway email sending with auth bridge
- T102.3: Gradual rollout (10% → 50% → 100%)
- T102.4: Remove Vercel email fallback

### Sprint 103: Email Analytics Dashboard

- T103.1: Email stats cards (sent, delivered, opened, clicked)
- T103.2: Sequence performance metrics
- T103.3: Reply detection integration
- T103.4: Meeting attribution from sequences

---

## 📋 APPENDIX: Why The Soak Test Isn't Blocking Email

The `AUTH_SOAK_TEST_RESULTS.md` is for validating:
1. User LOGIN via Railway NextAuth vs Firebase Auth
2. Session management (token refresh, expiry)
3. Traffic splitting between auth systems
4. User migration from Firebase to Railway

**Email sending is a SEPARATE system:**
- Vercel has its own SendGrid integration
- Vercel has its own email queue (Firestore)
- Vercel has its own crons for sequence execution
- NO user auth is needed for backend email processing

The soak test becomes relevant when we want to:
- Store user data in Railway PostgreSQL instead of Firestore
- Use Railway's BullMQ instead of Firestore queue
- Route ALL frontend API calls through Railway

**But for email TODAY:** Vercel works. Use it.

---

## 📋 APPENDIX: Quick Reference Commands

```bash
# Check Railway health
curl https://yardflow-hitlist-production-2f41.up.railway.app/api/health

# Check Vercel email health  
curl https://gtm-yard-flow.vercel.app/api/email/health

# Manually trigger sequence execution (requires CRON_SECRET)
curl -X POST https://gtm-yard-flow.vercel.app/api/cron/execute-sequences \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Manually trigger queue processing (requires CRON_SECRET)
curl -X POST https://gtm-yard-flow.vercel.app/api/cron/process-queue \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 📋 APPENDIX: Environment Variables Status

| Variable | Vercel Status | Needed For |
|----------|---------------|------------|
| SENDGRID_API_KEY | ✅ Configured | Email sending |
| SENDGRID_FROM_EMAIL | ✅ Configured | Email sending |
| EMAIL_TRACKING_SECRET | ✅ Configured | Open/click tracking |
| EMAIL_UNSUBSCRIBE_SECRET | ✅ Configured | CAN-SPAM compliance |
| PUBLIC_BASE_URL | ✅ Configured | Tracking URLs |
| CRON_SECRET | ⚠️ Not set | External cron auth (optional, Vercel crons don't need it) |
| VITE_RAILWAY_ENABLED | Should be false | Skip Railway data |
| VITE_RAILWAY_AUTH_ENABLED | Should be false | Skip Railway auth |
| VITE_RAILWAY_EMAIL_ENABLED | Should be false | Skip Railway email |

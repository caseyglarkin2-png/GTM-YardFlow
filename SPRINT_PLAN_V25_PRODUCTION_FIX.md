# Sprint Plan V25: Production Environment & UX Fix

**Status**: 🚨 CRITICAL  
**Created**: February 3, 2026  
**Updated**: February 3, 2026 (Post-Review)  
**Goal**: Fix production blockers preventing email sends and company display  
**North Star**: Jake and Casey can send bulk emails and see company names

---

## Root Cause Analysis

### Issue 1: Vercel Environment Variables Have Trailing Newlines
All environment variables in Vercel have `\n` appended:
```
RAILWAY_API_URL="https://yardflow-hitlist-production-2f41.up.railway.app\n"
VITE_FIREBASE_PROJECT_ID="gtm-eventops\n"
```

This causes:
- **Railway 404 errors** - URL becomes `https://...railway.app\n/api/outreach/send-email`
- **Firebase auth errors** - Project ID is `gtm-eventops\n` not `gtm-eventops`

### Issue 2: Wrong Variable Name
- `VITE_GEMINI_API` should be `VITE_GEMINI_API_KEY`

### Issue 3: Company Names Not Displaying
- CSS `min-w-0` on parent container allows text to collapse completely
- Need minimum width to ensure visibility

---

## Code Fixes Applied (This Session)

The following defensive fixes have been applied to prevent recurrence:

### ✅ Environment Variable Sanitization
All env var usages now call `.trim()` to handle trailing newlines:

| File | Change |
|------|--------|
| `lib/railway-client.ts` | `BASE_URL = process.env.RAILWAY_API_URL?.trim()` |
| `api/railway/[...path].ts` | `RAILWAY_API_URL = process.env.RAILWAY_API_URL?.trim()` |
| `src/lib/firebase.ts` | All Firebase config values use `sanitize()` helper |

### ✅ HubSpot Session Check Guard
`src/hooks/useHubSpot.ts` - Skip session check if `VITE_HUBSPOT_CLIENT_ID` not configured.

### ✅ Company Name CSS Fix
`src/components/CompanyListView.tsx` - Changed `min-w-0` to `min-w-[120px]` on parent container.

### ✅ PWA Icons Moved
Icons moved from root to `public/` folder.

---

## Sprint Overview

| Sprint | Focus | Tasks | Demo |
|--------|-------|-------|------|
| **S0** | Vercel Env Fix | T0.1-T0.3 | API calls succeed |
| **S1** | Verification | T1.1-T1.3 | All features work |
| **S2** | Email E2E Test | T2.1-T2.3 | Bulk email works |

**Total**: ~2 hours (reduced from 4 due to code fixes already applied)

---

## Sprint S0: Vercel Environment Fix (CRITICAL)

**Goal**: All environment variables properly set without trailing characters  
**Demo**: `curl` to Railway via proxy returns 200

---

### T0.1: Fix Vercel Environment Variables [M - 20 min]

**Task**: Remove trailing newlines from ALL Vercel environment variables.

**Action Required** (Manual in Vercel Dashboard):

1. Go to **Vercel Dashboard → GTM-YardFlow → Settings → Environment Variables**
2. For EACH variable below, click Edit and re-enter the value WITHOUT trailing newline:

| Variable | Action |
|----------|--------|
| `RAILWAY_API_URL` | Delete and recreate with: `https://yardflow-hitlist-production-2f41.up.railway.app` |
| `VITE_FIREBASE_API_KEY` | Delete and recreate (get value from Firebase Console) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Delete and recreate: `gtm-eventops.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Delete and recreate: `gtm-eventops` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Delete and recreate: `gtm-eventops.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Delete and recreate (get from Firebase Console) |
| `VITE_FIREBASE_APP_ID` | Delete and recreate (get from Firebase Console) |
| `VITE_GEMINI_API` | DELETE this (wrong name) |
| `VITE_GEMINI_API_KEY` | CREATE with your Gemini API key |

**Validation**:
```bash
# After changes, verify no trailing chars by exporting and checking
vercel env pull .env.check --yes
cat .env.check | grep RAILWAY_API_URL
# Should NOT have \n at end
```

**Exit Criteria**: All env vars have no trailing characters.

---

### T0.2: Redeploy Vercel and Push Code Fixes [S - 10 min]

**Task**: Push code changes and trigger redeploy.

**Action**:
```bash
cd /workspaces/GTM-YardFlow
git add -A
git commit -m "fix: Add env var sanitization and UI fixes

- Add .trim() to all RAILWAY_API_URL usages (prevents trailing newline bugs)
- Add sanitize() helper to Firebase config
- Skip HubSpot session check if not configured
- Fix company name CSS min-width
- Move PWA icons to public folder

Sprint 25: Production environment fixes"
git push origin main
```

Then in Vercel Dashboard: **Deployments** → **⋯** → **Redeploy**

**Validation**: Deployment shows "Ready" status.

**Exit Criteria**: Code deployed with sanitization fixes.

---

### T0.3: Verify RAILWAY_API_SECRET Matches [S - 5 min]

**Task**: Confirm Vercel's `RAILWAY_API_SECRET` matches Railway's `CRON_SECRET`.

**Action**:
1. In Vercel Dashboard, copy `RAILWAY_API_SECRET` value
2. In Railway Dashboard, compare to `CRON_SECRET` value
3. They MUST be identical

**Validation**: Values match exactly.

**Exit Criteria**: S2S auth confirmed aligned.

---

## Sprint S1: Verification

**Goal**: Confirm all fixes working in production  
**Demo**: Clean console, features functional

---

### T1.1: Verify Firebase Auth [S - 5 min]

**Task**: Confirm Firebase authentication works.

**Steps**:
1. Open https://gtm-yard-flow.vercel.app in incognito
2. Sign in with test account
3. Check console for `auth/configuration-not-found` error

**Validation**: NO Firebase auth errors in console.

**Exit Criteria**: User can sign in.

---

### T1.2: Verify Railway Proxy [S - 5 min]

**Task**: Confirm Railway API calls succeed.

**Steps**:
1. Sign in to app
2. Open Console (F12)
3. Look for `[Email] Railway health check passed`

**Validation**: Health check passes, no 404 errors.

**Exit Criteria**: Railway connection working.

---

### T1.3: Verify Company Names Visible [S - 5 min]

**Task**: Confirm company names display in Companies view.

**Steps**:
1. Navigate to Companies view
2. Verify company names visible (not just "Research" badges)

**Validation**: All 2535 companies show names.

**Exit Criteria**: Company names visible.

---

## Sprint S2: Email E2E Test

**Goal**: Bulk email sends successfully via Railway  
**Demo**: Select prospects, send email, receive in inbox

---

### T2.1: Send Single Test Email [S - 10 min]

**Task**: Send one email to yourself.

**Steps**:
1. Go to Prospects view
2. Select yourself (or a @yardflow.com address)
3. Click Email → fill subject/body → Send

**Validation**:
- Console shows `[Email] Railway enabled, sending via Railway`
- Console shows `POST /api/railway/outreach/send-email 200` (not 404!)
- Email arrives in inbox

**Exit Criteria**: Test email received.

---

### T2.2: Send Bulk Test (3-5 prospects) [M - 15 min]

**Task**: Send to multiple team members.

**Test Email Allowlist** (use only these):
- Your email (@yardflow.com)
- Jake's email
- Any @mailinator.com for testing

**Steps**:
1. Select 3-5 test prospects from allowlist
2. Click Email
3. Subject: `[TEST] Bulk email verification`
4. Send

**Validation**:
- Progress bar completes
- All emails show success
- Emails arrive

**Exit Criteria**: Bulk send works.

---

### T2.3: Verify Console is Clean [S - 5 min]

**Task**: Final console audit.

**Expected Console State**:
- ✅ No red errors
- ✅ No 404s to Railway
- ✅ No Firebase auth errors
- ⚠️ Warning about Gemini mock mode OK if API key not yet set
- ⚠️ PWA icon warning OK (placeholder icons)

**Exit Criteria**: Clean or acceptable console state.

---

## Rollback Plan

### If Email Still Fails After Env Fix

1. **Check Railway logs** for errors on their end
2. **Verify secrets match**: Vercel `RAILWAY_API_SECRET` === Railway `CRON_SECRET`
3. **Test direct endpoint**:
   ```bash
   curl -X POST "https://yardflow-hitlist-production-2f41.up.railway.app/api/outreach/send-email" \
     -H "x-service-key: YOUR_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"to":"test@test.com","subject":"Test","body":"<p>test</p>"}'
   ```
4. **Fall back to Firestore queue**:
   - Set `VITE_RAILWAY_EMAIL_ENABLED=false` in Vercel
   - Redeploy

### Rollback Timeline
- Immediate (< 1 min): Set flag to false, redeploy
- Notification: Slack/Teams message to team

---

## Files Changed This Session

| File | Change | Status |
|------|--------|--------|
| `lib/railway-client.ts` | Add `.trim()` to env vars | ✅ Done |
| `api/railway/[...path].ts` | Add `.trim()` to env vars | ✅ Done |
| `src/lib/firebase.ts` | Add `sanitize()` helper | ✅ Done |
| `src/hooks/useHubSpot.ts` | Skip if not configured | ✅ Done |
| `src/components/CompanyListView.tsx` | Fix min-width CSS | ✅ Done |
| `public/pwa-192x192.png` | Moved from root | ✅ Done |
| `public/pwa-512x512.png` | Moved from root | ✅ Done |

---

## Post-Sprint Checklist

### After S0 (Env Fix)
- [ ] All env vars have no trailing chars
- [ ] Code pushed with sanitization
- [ ] Secrets match between Vercel and Railway

### After S1 (Verification)
- [ ] Firebase auth works
- [ ] Railway proxy returns 200
- [ ] Company names visible

### After S2 (Email E2E)
- [ ] Single email works
- [ ] Bulk email works
- [ ] Console is clean

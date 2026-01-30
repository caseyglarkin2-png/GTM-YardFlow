# YardFlow GTM Hub — Consolidated Sprint Plan (V10–V12)

## North Star
Maximize meetings booked per day via automated, tracked sequences.
**We use Calendly links in outreach — no calendar integration needed.**

## Current Reality (2026-01-30)
- ✅ Railway backend is seeded and healthy (casey@freightroll.com / FreightRoll2026!)
- ✅ Sequences tab added to UI for enrollment management
- 🔄 Vercel flags need to be set to enable Railway email
- Email flow: Firestore queue → crons → Railway/SendGrid

## Active Decisions
1. **Railway for email** → flip `VITE_RAILWAY_ENABLED=true` + `VITE_RAILWAY_EMAIL_ENABLED=true` in Vercel
2. **Calendly for scheduling** → no calendar integration needed, just push Jake's link
3. **Firestore as CRM** → no complex sync needed

## Vercel Flags to Set (Dashboard → Settings → Environment Variables)
| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_RAILWAY_ENABLED` | `true` | Master Railway toggle |
| `VITE_RAILWAY_EMAIL_ENABLED` | `true` | Route email via Railway |
| `RAILWAY_API_URL` | `https://yardflow-hitlist-production-2f41.up.railway.app` | Backend URL |
| `RAILWAY_API_SECRET` | (first 16 chars of AUTH_SECRET) | Proxy auth |

After setting, redeploy Vercel for changes to take effect.

## Completed
- [x] Preflight checks: block send/enroll without email
- [x] Railway seed: casey@freightroll.com created
- [x] Sequences tab: SequenceManagerPanel exposed in UI
- [x] Copilot instructions: updated with north star focus

## Remaining Priority
1. **Set Vercel flags** → enable Railway email (manual step)
2. **Test email flow** → verify emails send through Railway
3. **Scheduler hardening** → stop-gating, dead-letter handling, stale locks

## What NOT to Build
- ❌ Calendar/scheduling integration (Calendly handles this)
- ❌ Complex CRM sync (Firestore is sufficient)
- ❌ Over-engineered analytics (focus on send/reply/bounce)
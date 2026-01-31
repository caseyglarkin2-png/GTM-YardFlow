# YardFlow GTM Hub — Consolidated Sprint Plan

## North Star
Maximize meetings booked per day via automated, tracked sequences.
**We use Calendly links in outreach — no calendar integration needed.**

---

## Current Reality (2026-01-31)

### Platform Status
| Component | Status | Notes |
|-----------|--------|-------|
| **Vercel SPA** | ✅ Deployed | Firebase Auth, Sequences tab live |
| **Railway Production** | ✅ Healthy | 4+ hour uptime, DB/Redis/Queues OK |
| **Railway Builds** | ❌ Failing | ~20 failures, running stale code |
| **Email Flow** | ⏳ Blocked | Waiting for Railway builds to pass |

### Railway Health Check
```
https://yardflow-hitlist-production-2f41.up.railway.app/api/health
✅ system: ok (uptime ~4.3 hours)
✅ database: ok (49ms latency)
✅ redis: ok (2ms latency)
✅ queues: ok
```

---

## 🔴 BLOCKING ISSUE: Railway Build Failures

Railway production is running OLD code. New deployments fail on Dockerfile COPY commands.

### Root Cause
Dockerfiles reference files that don't exist:
- `COPY prisma.config.ts ./` — file doesn't exist
- YardFlow-Worker has wrong build context (repo root instead of eventops/)

### Required Fixes in YardFlow-Hitlist Repo

**1. Remove prisma.config.ts COPY from BOTH Dockerfiles:**
```dockerfile
# DELETE this line from Dockerfile AND Dockerfile.worker:
COPY prisma.config.ts ./
```

**2. Set YardFlow-Worker Root Directory:**
- Railway Dashboard → YardFlow-Worker → Settings → Build
- Set Root Directory = `eventops`

**3. Apply service auth to send-email route:**
See `docs/RAILWAY_SERVICE_AUTH_CHANGE.md` for full code

**4. Fix campaigns/route.ts line 102:**
```typescript
// BEFORE (bug)
userId: session.user.id
// AFTER (fix)  
userId: authResult.userId
```

---

## Completed Work

### GTM-YardFlow (Vercel) ✅
- [x] Preflight checks: block send/enroll without email
- [x] Railway proxy with CRON_SECRET fallback auth
- [x] Sequences tab in UI navigation
- [x] Feature flags for Railway email routing
- [x] Service auth documentation created
- [x] Copilot instructions updated

### YardFlow-Hitlist (Railway) ✅
- [x] Railway seeded: casey@freightroll.com / FreightRoll2026!
- [x] dockerfileContext = eventops for main service
- [x] Health endpoint working

---

## After Railway Builds Pass

1. **Verify email flow**: Send test email through UI
2. **Enable crons**: Confirm `/api/cron/*` endpoints work
3. **Scheduler hardening**: Stop-gating, dead-letter handling

---

## Environment Variables

### Vercel Dashboard
| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_RAILWAY_ENABLED` | `true` | Master Railway toggle |
| `VITE_RAILWAY_EMAIL_ENABLED` | `true` | Route email via Railway |
| `RAILWAY_API_URL` | `https://yardflow-hitlist-production-2f41.up.railway.app` | Backend URL |
| `RAILWAY_API_SECRET` | (same as CRON_SECRET) | Proxy auth |

### Railway Dashboard
| Variable | Required | Purpose |
|----------|----------|---------|
| `CRON_SECRET` | Yes | Service-to-service auth |
| `SENDGRID_API_KEY` | Yes | Email sending |
| `DATABASE_URL` | Yes | Postgres connection |
| `REDIS_URL` | Yes | BullMQ queues |

---

## What NOT to Build
- ❌ Calendar/scheduling integration (Calendly handles this)
- ❌ Complex CRM sync (Firestore is sufficient)
- ❌ Over-engineered analytics (focus on send/reply/bounce)
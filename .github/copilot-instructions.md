# Copilot Instructions — GTM-YardFlow

## 🎯 North Star
**Maximize meetings booked per day via automated, tracked email sequences.**
- We push Jake's Calendly link in outreach — no calendar integration needed.
- Every feature must serve: enroll → send → track → book meetings.

## Architecture (current state: 2026-01-31)

### Two Repos, One Platform
| Repo | Platform | Purpose |
|------|----------|---------|
| **GTM-YardFlow** (this repo) | Vercel | React SPA + serverless APIs, Firebase Auth/Firestore |
| **YardFlow-Hitlist** | Railway | Next.js backend, Postgres/Redis/SendGrid |

### Integration Pattern
```
Vercel SPA → api/railway/[...path].ts (proxy) → Railway Backend
                    ↓
            Bearer CRON_SECRET auth
                    ↓
            Railway /api/outreach/send-email
```

### Email Flow
1. User clicks "Send" in Vercel UI
2. Request proxied to Railway via `api/railway/[...path].ts`
3. Railway sends via SendGrid, updates Postgres
4. Crons (`/api/cron/*`) process queues every 5 min

## Key Files (This Repo)
| Purpose | Location |
|---------|----------|
| Feature flags | `src/config/featureFlags.ts` |
| Sequence scheduler | `src/services/SequenceSchedulerService.ts` |
| Email queue | `src/services/EmailQueueService.ts` |
| Railway email client | `src/services/RailwayEmailService.ts` |
| Sequence manager UI | `src/components/SequenceManagerPanel.tsx` |
| Railway proxy | `api/railway/[...path].ts` |
| Cron: process queue | `api/cron/process-queue.ts` |
| Cron: execute sequences | `api/cron/execute-sequences.ts` |

## Railway Integration Rules
- **All Railway calls** go through `api/railway/[...path].ts` proxy
- **Use `shouldUseRailwayEmail()`** from `featureFlags.ts` — never ad-hoc checks
- **Auth**: Proxy sends `Bearer CRON_SECRET` header; Railway accepts both this AND NextAuth sessions
- **Credentials**: `casey@freightroll.com` / `FreightRoll2026!`
- **Health check**: `https://yardflow-hitlist-production-2f41.up.railway.app/api/health`

## Unification Status (2026-01-31)

### ✅ Complete in GTM-YardFlow (Vercel)
- Railway proxy with CRON_SECRET fallback auth
- Feature flags for Railway email routing
- Sequences tab in UI navigation
- Service auth documentation

### ⏳ Pending in YardFlow-Hitlist (Railway)
- Remove `COPY prisma.config.ts` from both Dockerfiles
- Set Root Directory = `eventops` for YardFlow-Worker service
- Apply service auth changes to `send-email/route.ts` (see `docs/RAILWAY_SERVICE_AUTH_CHANGE.md`)
- Fix `campaigns/route.ts` line 102: `session.user.id` → `authResult.userId`

### 🔴 Blocking Issue
Railway builds keep failing (~20 failures). Production is running OLD code from 4+ hours ago.
Root cause: Dockerfile COPY commands reference files that don't exist.

## What NOT to Build
- ❌ Calendar/scheduling integration — we use Calendly links
- ❌ Complex CRM sync — Firestore is our CRM
- ❌ Over-engineered analytics — focus on send/reply/bounce metrics

## Developer Workflows
```bash
npm run dev          # Dev server
npm run build        # Typecheck + bundle
npm test             # Vitest unit tests
npm run test:e2e     # Playwright E2E
npm run verify:railway  # Railway health check
```

## Environment Variables (Vercel Dashboard)
| Flag | Purpose | Required Value |
|------|---------|----------------|
| `VITE_RAILWAY_ENABLED` | Master Railway toggle | `true` |
| `VITE_RAILWAY_EMAIL_ENABLED` | Route email via Railway | `true` |
| `RAILWAY_API_URL` | Railway backend URL | `https://yardflow-hitlist-production-2f41.up.railway.app` |
| `RAILWAY_API_SECRET` | Proxy auth (or use CRON_SECRET) | Same as Railway's CRON_SECRET |

## Cross-Repo Coordination
When making changes that affect both repos:
1. Check `docs/RAILWAY_SERVICE_AUTH_CHANGE.md` for pending Railway changes
2. Sync `CRON_SECRET` between Vercel and Railway env vars
3. Test via Railway health endpoint before enabling features
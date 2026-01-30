# Copilot Instructions — GTM-YardFlow

## 🎯 North Star
**Maximize meetings booked per day via automated, tracked email sequences.**
- We push Jake's Calendly link in outreach — no calendar integration needed.
- Every feature must serve: enroll → send → track → book meetings.

## Architecture (current state: 2026-01-30)
- **Vercel**: React SPA + serverless APIs in `api/`. Firebase Auth + Firestore for prospects, sequences, queues.
- **Railway** (innovation-ambition): Postgres/Redis/SendGrid backend. Access via Vercel proxy at `api/railway/[...path].ts`.
- **Email flow**: Railway is now the primary path (`VITE_RAILWAY_EMAIL_ENABLED=true`). Crons at `/api/cron/process-queue` and `/api/cron/execute-sequences` run every 5 min.
- **Sequences**: `SequenceSchedulerService` + `EmailQueueService` manage enrollment → queue → send → advance step.

## Key files
| Purpose | Location |
|---------|----------|
| Feature flags | `src/config/featureFlags.ts` |
| Sequence scheduler | `src/services/SequenceSchedulerService.ts` |
| Email queue | `src/services/EmailQueueService.ts` |
| Railway email | `src/services/RailwayEmailService.ts` |
| Sequence manager UI | `src/components/SequenceManagerPanel.tsx` |
| Railway proxy | `api/railway/[...path].ts` |
| Cron: process queue | `api/cron/process-queue.ts` |
| Cron: execute sequences | `api/cron/execute-sequences.ts` |

## Railway integration rules
- All Railway calls go through the Vercel proxy; update allowlist in `api/railway/[...path].ts` if adding endpoints.
- Use `shouldUseRailwayEmail()` from `featureFlags.ts` — never ad-hoc checks.
- Railway auth: NextAuth session required. User credentials: `casey@freightroll.com` / `FreightRoll2026!`

## What NOT to build
- ❌ Calendar/scheduling integration — we use Calendly links
- ❌ Complex CRM sync — Firestore is our CRM
- ❌ Over-engineered analytics — focus on send/reply/bounce metrics

## Developer workflows
```bash
npm run dev          # Dev server
npm run build        # Typecheck + bundle
npm test             # Vitest unit tests
npm run test:e2e     # Playwright E2E
npm run verify:railway  # Railway health check
```

## Environment flags (Vercel dashboard)
| Flag | Purpose | Current |
|------|---------|---------|
| `VITE_RAILWAY_ENABLED` | Enable Railway backend | `true` |
| `VITE_RAILWAY_EMAIL_ENABLED` | Route email via Railway | `true` |
| `RAILWAY_API_URL` | Railway backend URL | Set |
| `RAILWAY_API_SECRET` | Proxy auth secret | Set |
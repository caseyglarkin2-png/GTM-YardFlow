# YardFlow Platform Architecture

> **Last Updated:** January 31, 2026  
> **Purpose:** Clear separation of concerns between the two repositories

---

## Overview

YardFlow is a **two-repo platform** that combines a Vercel frontend with a Railway backend.

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GTM-YardFlow (Vercel)                         │
│                                                                  │
│  • React SPA (UI)                                                │
│  • Firebase Auth (login)                                         │
│  • Firestore (CRM data)                                          │
│  • Serverless API endpoints                                      │
│  • Railway Proxy (forwards to backend)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                    api/railway/[...path].ts
                    (Bearer CRON_SECRET auth)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  YardFlow-Hitlist (Railway)                      │
│                                                                  │
│  • Next.js API Routes                                            │
│  • Postgres (Prisma ORM)                                         │
│  • Redis (BullMQ queues)                                         │
│  • SendGrid (email delivery)                                     │
│  • Worker service (background jobs)                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## GTM-YardFlow (Vercel Frontend)

**Repository:** `github.com/caseyglarkin2-png/GTM-YardFlow`  
**Platform:** Vercel  
**URL:** Your Vercel deployment URL

### What Lives Here

| Feature | Location | Purpose |
|---------|----------|---------|
| **UI/Dashboard** | `src/components/` | Prospect cards, sequence manager, analytics |
| **Firebase Auth** | `src/services/AuthService.ts` | User login/logout |
| **Firestore CRM** | `src/services/` | Prospects, sequences, email queue storage |
| **Railway Proxy** | `api/railway/[...path].ts` | Forwards requests to Railway backend |
| **Cron Jobs** | `api/cron/` | `process-queue.ts`, `execute-sequences.ts` |
| **Feature Flags** | `src/config/featureFlags.ts` | Toggle Railway features on/off |
| **Email Tracking** | `api/track/` | Open/click pixel endpoints |
| **Sequence Manager** | `src/components/SequenceManagerPanel.tsx` | Enrollment management UI |

### Key Files

```
src/
├── components/           # React UI components
├── config/
│   └── featureFlags.ts   # Railway feature toggles
├── services/
│   ├── AuthService.ts    # Firebase authentication
│   ├── RailwayEmailService.ts  # Email via Railway
│   ├── SequenceSchedulerService.ts
│   └── EmailQueueService.ts
└── hooks/                # React hooks

api/
├── railway/
│   └── [...path].ts      # Proxy to Railway backend
├── cron/
│   ├── process-queue.ts
│   └── execute-sequences.ts
└── track/                # Email tracking pixels
```

### Environment Variables (Vercel Dashboard)

| Variable | Purpose |
|----------|---------|
| `VITE_RAILWAY_ENABLED` | Master toggle for Railway |
| `VITE_RAILWAY_EMAIL_ENABLED` | Route emails through Railway |
| `RAILWAY_API_URL` | `https://yardflow-hitlist-production-2f41.up.railway.app` |
| `RAILWAY_API_SECRET` | Same as Railway's CRON_SECRET |

---

## YardFlow-Hitlist (Railway Backend)

**Repository:** `github.com/caseyglarkin2-png/YardFlow-Hitlist`  
**Platform:** Railway  
**URL:** `https://yardflow-hitlist-production-2f41.up.railway.app`

### What Lives Here

| Feature | Location | Purpose |
|---------|----------|---------|
| **SendGrid Email** | `eventops/src/app/api/outreach/` | Actually sends emails |
| **Postgres DB** | Prisma schema | Persistent data storage |
| **Redis Queues** | BullMQ | Email job queues |
| **NextAuth** | `eventops/src/auth.ts` | Railway UI authentication |
| **API Routes** | `eventops/src/app/api/` | Backend business logic |
| **Worker Service** | `Dockerfile.worker` | Background job processing |
| **Health Endpoint** | `/api/health` | Service health check |

### Key Files

```
eventops/
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── outreach/
│   │       │   └── send-email/route.ts  # Email sending
│   │       ├── campaigns/route.ts
│   │       └── health/route.ts
│   ├── auth.ts           # NextAuth config
│   └── lib/
│       └── db.ts         # Prisma client
├── prisma/
│   └── schema.prisma     # Database schema
├── Dockerfile            # Main service
└── Dockerfile.worker     # Worker service
```

### Railway Services

| Service | Dockerfile | Purpose |
|---------|------------|---------|
| YardFlow-Hitlist | `Dockerfile` | Main API server |
| YardFlow-Worker | `Dockerfile.worker` | Background job processing |
| Redis | (managed) | Queue storage |

### Environment Variables (Railway Dashboard)

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Service-to-service auth |
| `SENDGRID_API_KEY` | Email sending |
| `DATABASE_URL` | Postgres connection |
| `REDIS_URL` | Redis connection |
| `AUTH_SECRET` | NextAuth secret |

---

## How They Connect

### Email Send Flow

```
1. User clicks "Send Email" in Vercel UI
                    │
2. UI calls api/railway/outreach/send-email
                    │
3. Proxy adds: Authorization: Bearer CRON_SECRET
                    │
4. Railway receives request, validates auth
                    │
5. Railway calls SendGrid API
                    │
6. Email delivered to recipient
                    │
7. Open/click tracked via api/track/*
```

### Authentication Flow

```
Vercel (Firebase Auth)          Railway (NextAuth)
        │                              │
   User logs in                  Service-to-service
   via Firebase              via Bearer CRON_SECRET
        │                              │
   JWT stored                   No user session
   in browser                   needed for proxy
```

---

## Quick Reference: Where to Edit

| If you need to... | Edit this repo |
|-------------------|----------------|
| Change the UI | GTM-YardFlow |
| Add a new UI component | GTM-YardFlow |
| Change how emails send | YardFlow-Hitlist |
| Add a new API endpoint | YardFlow-Hitlist |
| Change prospect data display | GTM-YardFlow |
| Modify email templates | YardFlow-Hitlist |
| Update feature flags | GTM-YardFlow |
| Change database schema | YardFlow-Hitlist |
| Update cron job logic | GTM-YardFlow |
| Add background workers | YardFlow-Hitlist |

---

## Deployment

### GTM-YardFlow (Vercel)
- **Trigger:** Push to `main` branch
- **Build:** Automatic via Vercel
- **No CI gate** (deploys immediately)

### YardFlow-Hitlist (Railway)
- **Trigger:** Push to `main` branch
- **CI Gate:** "Wait for CI" enabled
- **Build:** After GitHub Actions pass
- **Two services:** Both rebuild on push

---

## Staying in Sync

### Shared Configuration
- `CRON_SECRET` must match in both platforms
- Railway URL must be correct in Vercel env vars

### Breaking Changes
If you change Railway API endpoints, update the proxy in GTM-YardFlow:
- Edit `api/railway/[...path].ts` allowlist

### Testing Integration
```bash
# From GTM-YardFlow:
curl https://yardflow-hitlist-production-2f41.up.railway.app/api/health

# Expected: {"status":"healthy",...}
```

---

## Credentials

| Service | Email | Password |
|---------|-------|----------|
| Railway (NextAuth) | casey@freightroll.com | FreightRoll2026! |

---

## Support

- **Vercel Dashboard:** vercel.com
- **Railway Dashboard:** railway.app
- **This Doc:** `docs/PLATFORM_ARCHITECTURE.md`

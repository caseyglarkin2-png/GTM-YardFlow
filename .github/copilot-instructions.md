# Copilot Instructions — GTM-YardFlow

## 🎯 Purpose
Sales automation platform: **enroll prospects → send tracked email sequences → book meetings**.
Jake's Calendly link handles scheduling — no calendar integration needed.

## Architecture

### Two-Repo Platform
| Repo | Platform | Role |
|------|----------|------|
| **GTM-YardFlow** (this) | Vercel | React SPA, Firebase Auth/Firestore, API proxy, webhooks |
| **YardFlow-Hitlist** | Railway | Next.js backend, Postgres, Redis, SendGrid |

### Data Flow
```
User → Vercel SPA → api/railway/[...path].ts → Railway → SendGrid
                                                             ↓
                                              api/webhooks/* ← webhooks
                                                             ↓
                                                          Firestore
```

## Critical Patterns

### Feature Flags (ALWAYS use these)
```typescript
import { shouldUseRailwayEmail } from '@/config/featureFlags';

// ✅ Correct: use flag helpers
if (shouldUseRailwayEmail()) { sendViaRailway(); }

// ❌ Wrong: ad-hoc env checks
if (import.meta.env.VITE_RAILWAY_ENABLED) { ... }
```
All flags: `src/config/featureFlags.ts` — controlled via `VITE_*` env vars.

### Railway API Calls
- **Browser → Railway**: Always through proxy `api/railway/[...path].ts`
- **Server → Railway**: Use `lib/railway-client.ts` with S2S auth
```typescript
// In Vercel API route
import { railwayServerClient } from '@/lib/railway-client';
const data = await railwayServerClient.get('/api/prospects');
```

### Service Layer Organization
| Domain | Service | Key Methods |
|--------|---------|-------------|
| Email | `RailwayEmailService.ts` | `sendEmailViaRailway()`, `isRailwayAvailable()` |
| Sequences | `SequenceSchedulerService.ts` | Enrollment state machine |
| Meetings | `MeetingAttributionService.ts` | Link Calendly → prospect → sequence |
| Suppression | `SuppressionSyncService.ts` | Bounce/spam list sync |
| Prospects | `FirestoreService.ts` | CRUD, queries |
| Auth | `AuthBridge.ts` | Firebase ↔ Railway session bridge |

### Email Sequence State Machine
Enrollment states: `active` → `paused` | `completed` | `stopped`
See `docs/ENROLLMENT_STATE_MACHINE.md` for transitions.

## Key Files
| Purpose | Location |
|---------|----------|
| Feature flags | `src/config/featureFlags.ts` |
| Railway proxy | `api/railway/[...path].ts` |
| **Webhooks** | `api/webhooks/{sendgrid,inbound,calendly}.ts` |
| Email tracking | `api/track/{open,click}.ts` |
| S2S client | `lib/railway-client.ts` |
| Email service | `src/services/RailwayEmailService.ts` |
| Sequence UI | `src/components/SequenceManagerPanel.tsx` |
| Types | `src/types/{email,emailEvents,emailSequence}.ts` |
| Crons | `api/cron/{process-queue,execute-sequences}.ts` |

### Webhook Handlers (`api/webhooks/`)
| Endpoint | Events | Purpose |
|----------|--------|---------|
| `sendgrid.ts` | delivered, open, click, bounce, spam | Email tracking + suppression |
| `inbound.ts` | Inbound Parse | Reply detection, pause sequences |
| `calendly.ts` | invitee.created/canceled | **Meeting attribution (North Star!)** |

## Developer Workflow
```bash
npm run dev           # Vite dev server
npm run build         # tsc + vite build (fails on type errors)
npm test              # Vitest (watch mode)
npm run test:e2e      # Playwright
npm run verify:railway # Health check Railway backend
```

## Environment Variables (Vercel)
| Variable | Purpose |
|----------|---------|
| `VITE_RAILWAY_ENABLED` | Master Railway toggle |
| `VITE_RAILWAY_EMAIL_ENABLED` | Route email via Railway |
| `RAILWAY_API_URL` | Railway backend URL |
| `SERVICE_TO_SERVICE_SECRET` | S2S auth (same as Railway's CRON_SECRET) |

## What NOT to Build
- ❌ Calendar integration — Calendly handles this
- ❌ Complex CRM sync — Firestore is the CRM
- ❌ Over-engineered analytics — track send/reply/bounce only

## Cross-Repo Coordination
1. **API Contract**: `docs/api/RAILWAY_CONTRACT.md` — paths, auth, webhooks
2. Pending Railway changes: `docs/RAILWAY_SERVICE_AUTH_CHANGE.md`
3. Architecture overview: `docs/PLATFORM_ARCHITECTURE.md`
4. Ensure `CRON_SECRET` matches between Vercel and Railway
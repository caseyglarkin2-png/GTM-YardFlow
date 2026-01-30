# Railway API Audit

**Audit Date:** 2026-01-30
**Auditor:** Automated Sprint 90
**Status:** ✅ Complete

---

## Executive Summary

This document audits all Railway API endpoints to identify what exists, what's missing, and what needs to be built before the unification migration can proceed.

---

## Existing Endpoints (Verified via Proxy)

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/health` | GET | ✅ Verified | Returns DB/Redis status, queue health |
| `/api/outreach/send-email` | POST | ✅ Verified | Queues email via BullMQ |
| `/api/outreach/generate-ai` | POST | ✅ Verified | AI content generation |
| `/api/outreach/export` | GET | ✅ Verified | Export outreach data |
| `/api/enrichment/email` | POST/PUT | ✅ Verified | Single/batch enrichment |
| `/api/enrichment/smart-guess` | POST | ✅ Verified | Free email guessing |
| `/api/sequences` | GET/POST | ✅ Verified | List/create sequences |
| `/api/sequences/[id]/enroll` | POST | ✅ Verified | Enroll contacts |
| `/api/sequences/[id]/analytics` | GET | ✅ Verified | Sequence metrics |
| `/api/cron/sequences` | GET | ✅ Verified | Process pending steps |
| `/api/ai/content/generate` | POST | ✅ Verified | AI content generation |

---

## Missing Endpoints (Need to Build on Railway)

### P0 - Critical (Blocking Sprint 93-94)

| Endpoint | Method | Priority | Blocking Sprint | Description |
|----------|--------|----------|-----------------|-------------|
| `/api/prospects` | GET | P0 | Sprint 93 | List all prospects with pagination/filtering |
| `/api/prospects` | POST | P0 | Sprint 93 | Create new prospect |
| `/api/prospects/:id` | GET | P0 | Sprint 93 | Get single prospect |
| `/api/prospects/:id` | PUT/PATCH | P0 | Sprint 93 | Update prospect |
| `/api/prospects/:id` | DELETE | P0 | Sprint 93 | Delete prospect |
| `/api/prospects/search` | GET | P0 | Sprint 93 | Full-text search prospects |
| `/api/prospects/batch` | POST | P0 | Sprint 93 | Batch upsert for migration |

### P0 - Critical (Blocking Sprint 94)

| Endpoint | Method | Priority | Blocking Sprint | Description |
|----------|--------|----------|-----------------|-------------|
| `/api/enrollments` | GET | P0 | Sprint 94 | List enrollments (by prospect or sequence) |
| `/api/enrollments/:id` | GET | P0 | Sprint 94 | Get enrollment details |
| `/api/enrollments/:id/pause` | POST | P0 | Sprint 94 | Pause enrollment |
| `/api/enrollments/:id/resume` | POST | P0 | Sprint 94 | Resume enrollment |
| `/api/enrollments/:id` | DELETE | P0 | Sprint 94 | Cancel enrollment |

### P0 - Critical (Blocking Sprint 95-96)

| Endpoint | Method | Priority | Blocking Sprint | Description |
|----------|--------|----------|-----------------|-------------|
| `/api/email/queue/status` | GET | P0 | Sprint 95 | Queue health (pending, processing, failed) |
| `/api/email/queue/dead-letter` | GET | P0 | Sprint 95 | Failed emails list |
| `/api/email/queue/retry/:id` | POST | P0 | Sprint 95 | Retry failed email |
| `/api/email/events` | GET | P0 | Sprint 96 | Email events by prospect |
| `/api/email/analytics` | GET | P0 | Sprint 96 | Email stats (sent, opened, clicked, etc.) |
| `/api/webhooks/sendgrid` | POST | P0 | Sprint 96 | Webhook receiver for Railway |

### P0 - Critical (Blocking Sprint 97)

| Endpoint | Method | Priority | Blocking Sprint | Description |
|----------|--------|----------|-----------------|-------------|
| `/api/auth/session` | GET | P0 | Sprint 97 | Check current session |
| `/api/auth/login` | POST | P0 | Sprint 97 | Login with credentials |
| `/api/auth/logout` | POST | P0 | Sprint 97 | Logout, clear session |
| `/api/auth/refresh` | POST | P0 | Sprint 97 | Refresh JWT token |
| `/api/users/from-firebase` | POST | P0 | Sprint 97 | Create user from Firebase migration |

### P1 - Important (Nice to have)

| Endpoint | Method | Priority | Description |
|----------|--------|----------|-------------|
| `/api/meetings` | GET/POST | P1 | Meeting records |
| `/api/templates` | GET/POST | P1 | Email templates |
| `/api/analytics/dashboard` | GET | P1 | Dashboard stats |

---

## Proxy Configuration Analysis

### Current Allowed Paths (`api/railway/[...path].ts`)

```typescript
const ALLOWED_PATHS = [
  '/api/health',
  '/api/outreach/send-email',
  '/api/outreach/generate-ai',
  '/api/outreach/export',
  '/api/enrichment/email',
  '/api/enrichment/smart-guess',
  '/api/sequences',
  '/api/cron/sequences',
  '/api/ai/content/generate',
];
```

### Required Additions for Migration

```typescript
// Add these paths after Railway endpoints are built
const ALLOWED_PATHS = [
  // ... existing paths ...
  
  // Prospects (Sprint 93)
  '/api/prospects',
  
  // Enrollments (Sprint 94)
  '/api/enrollments',
  
  // Email Queue (Sprint 95-96)
  '/api/email/queue',
  '/api/email/events',
  '/api/email/analytics',
  '/api/webhooks/sendgrid',
  
  // Auth (Sprint 97)
  '/api/auth',
  '/api/users',
];
```

---

## Railway Infrastructure Status

Based on health check:

```json
{
  "status": "healthy",
  "checks": {
    "database": { "status": "ok", "latencyMs": 2 },
    "redis": { "status": "ok", "latencyMs": 0 },
    "queues": {
      "enrichment": "ready",
      "outreach": "ready",
      "emails": "ready",
      "sequence": "ready"
    }
  }
}
```

**Infrastructure Ready:** ✅ Yes
**Blocking Issues:** None

---

## Database Schema Analysis

### Existing Tables (Railway Prisma Schema)

| Table | Purpose | Can Store Prospects? |
|-------|---------|---------------------|
| `people` | Contact records | ⚠️ Similar but not exact match to Firestore `prospects` |
| `target_accounts` | Companies | ⚠️ Similar to Firestore data |
| `campaigns` | Marketing campaigns | ✅ Exists |
| `sequences` | Outreach sequences | ⚠️ Different structure than Firestore |
| `outreach` | Outreach records | ✅ Exists |
| `EmailActivity` | Email tracking | ✅ Exists |
| `SequenceEnrollment` | Enrollments | ✅ Exists |

### Schema Migration Needed

The Railway `people` table may need to be extended or a new `prospects` table created to match Firestore schema:

| Firestore Field | Railway Equivalent | Action Needed |
|-----------------|-------------------|---------------|
| `id` | `id` | ✅ Same |
| `name` | `firstName` + `lastName` | ⚠️ Combine/compute |
| `email` | `email` | ✅ Same |
| `company` | `companyName` or `targetAccount.name` | ⚠️ Normalize |
| `title` | `title` | ✅ Same |
| `linkedinUrl` | `linkedinUrl` | ✅ Same |
| `status` | `status` | ⚠️ Enum values may differ |
| `tier` | ❌ Missing | 🔴 Add column |
| `score` | ❌ Missing | 🔴 Add column |
| `createdAt` | `createdAt` | ✅ Same |
| `updatedAt` | `updatedAt` | ✅ Same |

---

## Recommendations

### Before Sprint 93

1. **Railway Team:** Create `/api/prospects` CRUD endpoints
2. **Railway Team:** Add `tier` and `score` columns to `people` table (or create `prospects` view)
3. **Vercel Team:** Update proxy ALLOWED_PATHS

### Before Sprint 94

1. **Railway Team:** Expose enrollment management endpoints
2. **Railway Team:** Add enrollment polling endpoint or WebSocket

### Before Sprint 95

1. **Railway Team:** Add email queue status endpoints
2. **Railway Team:** Add dead letter queue management

### Before Sprint 97

1. **Railway Team:** Expose NextAuth session endpoints
2. **Railway Team:** Add user creation endpoint for Firebase migration

---

## Action Items

| ID | Action | Owner | ETA | Status |
|----|--------|-------|-----|--------|
| 1 | Build `/api/prospects` CRUD | Railway Team | Before Sprint 93 | 🔴 Not Started |
| 2 | Add `tier`, `score` to people schema | Railway Team | Before Sprint 93 | 🔴 Not Started |
| 3 | Build `/api/enrollments` management | Railway Team | Before Sprint 94 | 🔴 Not Started |
| 4 | Build email queue status endpoints | Railway Team | Before Sprint 95 | 🔴 Not Started |
| 5 | Expose auth session endpoints | Railway Team | Before Sprint 97 | 🔴 Not Started |
| 6 | Update proxy ALLOWED_PATHS | Vercel Team | Sprint 90 (T90.5) | 🟡 This Sprint |

---

## Appendix: Curl Tests

```bash
# Test Railway health (via proxy)
curl -s https://gtm-yard-flow.vercel.app/api/railway/health | jq

# Test Railway health (direct)
curl -s https://yardflow-hitlist-production-2f41.up.railway.app/api/health | jq

# Test sequences endpoint
curl -s https://gtm-yard-flow.vercel.app/api/railway/sequences | jq
```

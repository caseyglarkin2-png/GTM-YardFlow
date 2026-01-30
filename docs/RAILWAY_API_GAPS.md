# Railway API Gap Remediation Plan

**Created:** 2026-01-30
**Status:** 🔴 Action Required
**Owner:** Engineering Team

---

## Executive Summary

Based on the Railway API Audit (T90.1), several endpoints required for the unification migration do not exist on Railway. This document tracks remediation.

---

## Critical Gaps (P0)

### Sprint 93 Blockers - Prospect CRUD

| Endpoint | Method | Status | Owner | ETA | Ticket |
|----------|--------|--------|-------|-----|--------|
| `/api/prospects` | GET | 🔴 Not Started | Railway Team | Before Sprint 93 | TBD |
| `/api/prospects` | POST | 🔴 Not Started | Railway Team | Before Sprint 93 | TBD |
| `/api/prospects/:id` | GET | 🔴 Not Started | Railway Team | Before Sprint 93 | TBD |
| `/api/prospects/:id` | PUT | 🔴 Not Started | Railway Team | Before Sprint 93 | TBD |
| `/api/prospects/:id` | DELETE | 🔴 Not Started | Railway Team | Before Sprint 93 | TBD |
| `/api/prospects/search` | GET | 🔴 Not Started | Railway Team | Before Sprint 93 | TBD |
| `/api/prospects/batch` | POST | 🔴 Not Started | Railway Team | Before Sprint 93 | TBD |

**Schema Changes Required:**
- Add `tier` column to people table (enum: 'Tier 1', 'Tier 2', 'Tier 3')
- Add `score` column to people table (integer 0-100)
- Create computed `name` field (firstName + lastName)

---

### Sprint 94 Blockers - Enrollment Management

| Endpoint | Method | Status | Owner | ETA | Ticket |
|----------|--------|--------|-------|-----|--------|
| `/api/enrollments` | GET | 🔴 Not Started | Railway Team | Before Sprint 94 | TBD |
| `/api/enrollments/:id` | GET | 🔴 Not Started | Railway Team | Before Sprint 94 | TBD |
| `/api/enrollments/:id/pause` | POST | 🔴 Not Started | Railway Team | Before Sprint 94 | TBD |
| `/api/enrollments/:id/resume` | POST | 🔴 Not Started | Railway Team | Before Sprint 94 | TBD |
| `/api/enrollments/:id` | DELETE | 🔴 Not Started | Railway Team | Before Sprint 94 | TBD |

**Notes:**
- `SequenceEnrollment` table exists but no REST endpoints
- Need to expose via Next.js API routes

---

### Sprint 95-96 Blockers - Email Queue

| Endpoint | Method | Status | Owner | ETA | Ticket |
|----------|--------|--------|-------|-----|--------|
| `/api/email/queue/status` | GET | 🔴 Not Started | Railway Team | Before Sprint 95 | TBD |
| `/api/email/queue/dead-letter` | GET | 🔴 Not Started | Railway Team | Before Sprint 95 | TBD |
| `/api/email/queue/retry/:id` | POST | 🔴 Not Started | Railway Team | Before Sprint 95 | TBD |
| `/api/email/events` | GET | 🔴 Not Started | Railway Team | Before Sprint 96 | TBD |
| `/api/email/analytics` | GET | 🔴 Not Started | Railway Team | Before Sprint 96 | TBD |
| `/api/webhooks/sendgrid` | POST | 🔴 Not Started | Railway Team | Before Sprint 96 | TBD |

---

### Sprint 97 Blockers - Authentication

| Endpoint | Method | Status | Owner | ETA | Ticket |
|----------|--------|--------|-------|-----|--------|
| `/api/auth/session` | GET | 🟡 Partial | Railway Team | Before Sprint 97 | TBD |
| `/api/auth/login` | POST | 🟡 Partial | Railway Team | Before Sprint 97 | TBD |
| `/api/auth/logout` | POST | 🟡 Partial | Railway Team | Before Sprint 97 | TBD |
| `/api/auth/refresh` | POST | 🔴 Not Started | Railway Team | Before Sprint 97 | TBD |
| `/api/users/from-firebase` | POST | 🔴 Not Started | Railway Team | Before Sprint 97 | TBD |

**Notes:**
- NextAuth already on Railway but may need custom endpoints
- Firebase user migration endpoint is new requirement

---

## Remediation Timeline

```
Week 1 (Before Sprint 93):
├── Day 1-2: Prospect schema changes (tier, score)
├── Day 2-3: /api/prospects CRUD endpoints
└── Day 3-4: Testing & verification

Week 2 (Before Sprint 94):
├── Day 1-2: /api/enrollments endpoints
└── Day 2-3: Testing & verification

Week 3 (Before Sprint 95-96):
├── Day 1-2: Email queue status endpoints
├── Day 2-3: Dead letter queue management
└── Day 3-4: Email analytics endpoints

Week 4 (Before Sprint 97):
├── Day 1-2: Auth endpoint enhancements
├── Day 2-3: Firebase user migration endpoint
└── Day 3-4: Testing & verification
```

---

## Vercel Proxy Updates Required

After Railway endpoints are built, update `api/railway/[...path].ts`:

```typescript
const ALLOWED_PATHS = [
  // Existing
  '/api/health',
  '/api/outreach/send-email',
  '/api/outreach/generate-ai',
  '/api/outreach/export',
  '/api/enrichment/email',
  '/api/enrichment/smart-guess',
  '/api/sequences',
  '/api/cron/sequences',
  '/api/ai/content/generate',
  
  // NEW: Prospects (Sprint 93)
  '/api/prospects',
  
  // NEW: Enrollments (Sprint 94)
  '/api/enrollments',
  
  // NEW: Email Queue (Sprint 95-96)
  '/api/email/queue',
  '/api/email/events',
  '/api/email/analytics',
  '/api/webhooks/sendgrid',
  
  // NEW: Auth (Sprint 97)
  '/api/auth',
  '/api/users',
];
```

---

## Risk Assessment

| Gap | Impact if Not Fixed | Mitigation |
|-----|---------------------|------------|
| No prospect endpoints | Sprint 93 blocked | Build endpoints before sprint |
| No enrollment endpoints | Sprint 94 blocked | Build endpoints before sprint |
| No email queue status | No visibility into queue | Can proceed but UX degraded |
| No auth endpoints | Sprint 97 blocked | Build endpoints before sprint |

---

## Communication

### Stakeholders to Notify
- [ ] Railway backend team
- [ ] Product owner
- [ ] QA team

### Escalation Path
1. If P0 gaps not addressed within timeline → Escalate to engineering manager
2. If timeline slips > 2 days → Notify product owner
3. If Sprint blocked → Delay sprint start

---

## Acceptance Criteria

For each endpoint:
- [ ] Endpoint responds with correct status codes
- [ ] Request/response matches TypeScript types in `src/types/railway.ts`
- [ ] Error responses include meaningful messages
- [ ] Endpoint added to ALLOWED_PATHS in proxy
- [ ] Basic integration test passes
- [ ] Documentation updated

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering Lead | TBD | TBD | |
| Railway Team Lead | TBD | TBD | |
| Product Owner | TBD | TBD | |

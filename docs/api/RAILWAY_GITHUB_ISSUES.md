# GitHub Issues for YardFlow-Hitlist

> Copy these issues to the YardFlow-Hitlist repository to track Railway API implementation.

---

## Issue 1: Sprint 306 - Prospect CRUD API Endpoints

**Title:** `[API] Implement Prospect CRUD endpoints (Sprint 306 Blocker)`

**Labels:** `api`, `priority:critical`, `frontend-blocker`

**Body:**

```markdown
## Summary
GTM-YardFlow frontend is blocked waiting for Prospect CRUD endpoints. These are required for Sprint 306 (Feb 7 deadline).

## Required Endpoints

| Method | Path | Priority | Description |
|--------|------|----------|-------------|
| GET | `/api/prospects` | P0 | List with pagination, filtering |
| POST | `/api/prospects` | P0 | Create prospect |
| GET | `/api/prospects/:id` | P0 | Get single prospect |
| PUT | `/api/prospects/:id` | P0 | Update prospect |
| DELETE | `/api/prospects/:id` | P1 | Soft-delete (archive) |
| POST | `/api/prospects/batch` | P1 | Bulk import |
| GET | `/api/prospects/search` | P2 | Advanced search |

## Database Changes Required
- Add `tier` column (VARCHAR(10), default 'Tier 2')
- Add `score` column (INTEGER, default 50)
- Add `status` column (VARCHAR(20), default 'active')
- Add `tags` column (TEXT[] or JSON)
- Add `custom_fields` column (JSONB)
- Add `last_contacted_at` column (TIMESTAMP)

## Authentication
Must accept S2S auth from Vercel proxy:
- `Authorization: Bearer {CRON_SECRET}`
- `x-service-key: {SERVICE_TO_SERVICE_SECRET}`
- `x-user-id: {firebase_uid}`

## Full Specification
See: [RAILWAY_IMPLEMENTATION_SPEC.md](../docs/api/RAILWAY_IMPLEMENTATION_SPEC.md) in GTM-YardFlow

## Acceptance Criteria
- [ ] All endpoints return correct status codes
- [ ] Pagination works with cursor-based pagination
- [ ] S2S auth accepted alongside NextAuth
- [ ] TypeScript types match spec
- [ ] Database migrations complete
```

---

## Issue 2: Sprint 307 - Enrollment Management API

**Title:** `[API] Implement Enrollment Management endpoints (Sprint 307 Blocker)`

**Labels:** `api`, `priority:high`, `frontend-blocker`

**Body:**

```markdown
## Summary
GTM-YardFlow needs enrollment management endpoints for sequence automation. Required for Sprint 307 (Feb 14 deadline).

## Required Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/enrollments` | List enrollments with filters |
| GET | `/api/enrollments/:id` | Get single enrollment |
| POST | `/api/enrollments/:id/pause` | Pause active enrollment |
| POST | `/api/enrollments/:id/resume` | Resume paused enrollment |
| DELETE | `/api/enrollments/:id` | Stop enrollment permanently |

## State Machine
Enrollments follow this state machine:
- `active` → can transition to: `paused`, `completed`, `stopped`
- `paused` → can transition to: `active`, `stopped`
- `completed` → terminal state
- `stopped` → terminal state

## Authentication
Same S2S auth as Prospect endpoints.

## Full Specification
See: [RAILWAY_IMPLEMENTATION_SPEC.md](../docs/api/RAILWAY_IMPLEMENTATION_SPEC.md) in GTM-YardFlow
```

---

## Issue 3: Sprint 308 - Email Queue API

**Title:** `[API] Implement Email Queue endpoints (Sprint 308 Blocker)`

**Labels:** `api`, `priority:high`, `frontend-blocker`

**Body:**

```markdown
## Summary
GTM-YardFlow needs email queue monitoring and dead letter handling. Required for Sprint 308 (Feb 21 deadline).

## Required Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/email/queue/status` | Current queue status |
| GET | `/api/email/queue/dead-letter` | Failed emails list |
| POST | `/api/email/queue/retry/:id` | Retry failed email |
| GET | `/api/email/events` | Email tracking events |
| GET | `/api/email/analytics` | Aggregate analytics |
| GET | `/api/email/health` | Health check for monitoring |

## Database Tables Required
- `email_queue` table (see spec for schema)
- `email_events` table (see spec for schema)

## Full Specification
See: [RAILWAY_IMPLEMENTATION_SPEC.md](../docs/api/RAILWAY_IMPLEMENTATION_SPEC.md) in GTM-YardFlow
```

---

## Issue 4: Sprint 309 - Auth Bridge API

**Title:** `[API] Implement Auth Bridge endpoints (Sprint 309 Blocker)`

**Labels:** `api`, `priority:high`, `frontend-blocker`

**Body:**

```markdown
## Summary
GTM-YardFlow needs auth bridge endpoints to link Firebase users with Railway. Required for Sprint 309 (Feb 28 deadline).

## Required Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/session` | Get current session |
| POST | `/api/auth/refresh` | Refresh session token |
| POST | `/api/users/from-firebase` | Create/link Railway user from Firebase |

## Integration Notes
- Firebase is the primary auth on Vercel frontend
- Railway uses NextAuth (or similar)
- Need bidirectional linking via `firebaseUid` field

## Full Specification
See: [RAILWAY_IMPLEMENTATION_SPEC.md](../docs/api/RAILWAY_IMPLEMENTATION_SPEC.md) in GTM-YardFlow
```

---

## Issue 5: S2S Authentication Middleware

**Title:** `[Infra] Add S2S authentication middleware for Vercel proxy`

**Labels:** `infrastructure`, `priority:critical`, `security`

**Body:**

```markdown
## Summary
The Railway API needs to accept service-to-service authentication from the Vercel proxy alongside NextAuth sessions.

## Requirements

### Headers to Accept
```
Authorization: Bearer {CRON_SECRET}
x-service-key: {SERVICE_TO_SERVICE_SECRET}
x-user-id: {firebase_uid} | "service:gtm-frontend"
x-source: "gtm-yardflow-vercel"
x-request-id: {uuid}
```

### Middleware Logic
```typescript
// Pseudo-code
if (hasBearerToken && hasServiceKey) {
  // Validate CRON_SECRET and SERVICE_TO_SERVICE_SECRET
  // Extract user from x-user-id header
  // Set request context
} else if (hasNextAuthSession) {
  // Existing NextAuth flow
} else {
  return 401 Unauthorized
}
```

### Environment Variables
- `CRON_SECRET` - Must match Vercel's `SERVICE_TO_SERVICE_SECRET`
- Already configured in Railway, just need middleware to use it

## Acceptance Criteria
- [ ] Middleware accepts both S2S and session auth
- [ ] S2S requests can specify user context via `x-user-id`
- [ ] Request ID passed through for tracing
- [ ] Unauthorized requests return 401 with proper error format
```

---

## Meta Issue: API Implementation Tracking

**Title:** `[Meta] GTM-YardFlow API Integration - Sprint 306-309`

**Labels:** `epic`, `cross-repo`

**Body:**

```markdown
## Overview
Tracking issue for all API endpoints needed by GTM-YardFlow frontend.

## Sprint Timeline

| Sprint | Deadline | Status | Endpoints |
|--------|----------|--------|-----------|
| 306 | Feb 7 | 🔴 Not Started | Prospect CRUD (7 endpoints) |
| 307 | Feb 14 | 🔴 Not Started | Enrollments (5 endpoints) |
| 308 | Feb 21 | 🔴 Not Started | Email Queue (6 endpoints) |
| 309 | Feb 28 | 🔴 Not Started | Auth (3 endpoints) |

## Related Issues
- #XX - Prospect CRUD endpoints
- #XX - Enrollment Management endpoints
- #XX - Email Queue endpoints
- #XX - Auth Bridge endpoints
- #XX - S2S Authentication middleware

## Cross-Repo Communication
- GTM-YardFlow repo: `caseyglarkin2-png/GTM-YardFlow`
- Full spec: `docs/api/RAILWAY_IMPLEMENTATION_SPEC.md`
- API contract: `docs/api/RAILWAY_CONTRACT.md`
```

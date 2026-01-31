# YardFlow-Hitlist API Implementation Specification

> **For:** Railway Backend Team (YardFlow-Hitlist repo)
> **From:** GTM-YardFlow Frontend Team
> **Date:** 2026-01-31
> **Priority:** 🔴 CRITICAL - Blocking Sprints 306-309

---

## Overview

GTM-YardFlow requires the following API endpoints from YardFlow-Hitlist (Railway) to complete the platform unification. This document provides complete implementation specifications.

**Timeline:**
- Sprint 306 (Prospects) - Needs endpoints by: **Feb 7**
- Sprint 307 (Enrollments) - Needs endpoints by: **Feb 14**
- Sprint 308 (Email Queue) - Needs endpoints by: **Feb 21**
- Sprint 309 (Auth) - Needs endpoints by: **Feb 28**

---

## Authentication Requirements

All endpoints must accept these authentication methods:

### Method 1: Service-to-Service (from Vercel proxy)
```
Authorization: Bearer {CRON_SECRET}
x-service-key: {SERVICE_TO_SERVICE_SECRET}
x-user-id: {firebase_uid} | "service:gtm-frontend"
x-source: "gtm-yardflow-vercel"
x-request-id: {uuid}
```

### Method 2: NextAuth Session (from Railway UI)
Standard NextAuth session cookie authentication.

**Middleware should accept EITHER method.**

---

## Sprint 306 Blockers: Prospect CRUD

### 1. GET /api/prospects

**Purpose:** List prospects with filtering, sorting, and pagination

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 25 | Page size (max 100) |
| `cursor` | string | null | Pagination cursor (base64 encoded ID) |
| `status` | string | null | Filter: 'active' \| 'contacted' \| 'converted' \| 'archived' |
| `tier` | string | null | Filter: 'Tier 1' \| 'Tier 2' \| 'Tier 3' |
| `company` | string | null | Filter by company name (partial match) |
| `search` | string | null | Full-text search across name, email, company |
| `orderBy` | string | 'createdAt' | Sort field |
| `order` | string | 'desc' | Sort direction: 'asc' \| 'desc' |

**Response (200):**
```typescript
{
  data: Prospect[];
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;
    total: number;
  };
}
```

**Prospect Schema:**
```typescript
interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  name: string;              // computed: firstName + " " + lastName
  email: string;
  company: string;
  title: string;
  linkedinUrl?: string;
  phone?: string;
  tier: 'Tier 1' | 'Tier 2' | 'Tier 3';
  score: number;             // 0-100
  status: 'active' | 'contacted' | 'converted' | 'archived';
  tags?: string[];
  customFields?: Record<string, unknown>;
  lastContactedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### 2. POST /api/prospects

**Purpose:** Create a new prospect

**Request Body:**
```typescript
{
  firstName: string;         // required
  lastName: string;          // required
  email: string;             // required, unique
  company: string;           // required
  title?: string;
  linkedinUrl?: string;
  phone?: string;
  tier?: 'Tier 1' | 'Tier 2' | 'Tier 3';  // default: 'Tier 2'
  score?: number;            // default: 50
  tags?: string[];
  customFields?: Record<string, unknown>;
}
```

**Response (201):**
```typescript
{
  id: string;
  ...Prospect
}
```

**Error (409):** Duplicate email
```typescript
{
  error: "DUPLICATE_EMAIL",
  message: "A prospect with this email already exists",
  existingId: string
}
```

---

### 3. GET /api/prospects/:id

**Purpose:** Get a single prospect by ID

**Response (200):** `Prospect`

**Response (404):**
```typescript
{
  error: "NOT_FOUND",
  message: "Prospect not found"
}
```

---

### 4. PUT /api/prospects/:id

**Purpose:** Update a prospect

**Request Body:** Partial<Prospect> (any fields to update)

**Response (200):** Updated `Prospect`

---

### 5. DELETE /api/prospects/:id

**Purpose:** Soft-delete a prospect (set status = 'archived')

**Response (204):** No content

---

### 6. POST /api/prospects/batch

**Purpose:** Bulk create/update prospects (for imports)

**Request Body:**
```typescript
{
  prospects: Array<{
    email: string;           // required, used for matching
    firstName?: string;
    lastName?: string;
    company?: string;
    title?: string;
    tier?: string;
    // ... other fields
  }>;
  mode: 'create' | 'upsert';  // upsert = update if exists
}
```

**Response (200):**
```typescript
{
  created: number;
  updated: number;
  errors: Array<{
    index: number;
    email: string;
    error: string;
  }>;
}
```

---

### 7. GET /api/prospects/search

**Purpose:** Advanced search with filters

**Request Body (POST for complex queries):**
```typescript
{
  query: string;             // full-text search
  filters: {
    tier?: string[];
    status?: string[];
    company?: string[];
    tags?: string[];
    scoreMin?: number;
    scoreMax?: number;
    createdAfter?: string;
    createdBefore?: string;
  };
  limit?: number;
  cursor?: string;
}
```

---

## Sprint 307 Blockers: Enrollment Management

### 1. GET /api/enrollments

**Purpose:** List sequence enrollments

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `prospectId` | string | Filter by prospect |
| `sequenceId` | string | Filter by sequence |
| `status` | string | Filter: 'active' \| 'paused' \| 'completed' \| 'stopped' |
| `limit` | number | Page size |
| `cursor` | string | Pagination cursor |

**Response (200):**
```typescript
{
  data: SequenceEnrollment[];
  pagination: { hasMore: boolean; nextCursor: string | null; };
}
```

**SequenceEnrollment Schema:**
```typescript
interface SequenceEnrollment {
  id: string;
  prospectId: string;
  sequenceId: string;
  status: 'active' | 'paused' | 'completed' | 'stopped';
  currentStep: number;
  totalSteps: number;
  startedAt: string;
  lastStepAt?: string;
  nextStepAt?: string;
  pausedAt?: string;
  pauseReason?: string;
  completedAt?: string;
  stoppedAt?: string;
  stopReason?: string;
  metrics: {
    emailsSent: number;
    emailsOpened: number;
    emailsClicked: number;
    repliesReceived: number;
  };
}
```

---

### 2. GET /api/enrollments/:id

**Response (200):** `SequenceEnrollment`

---

### 3. POST /api/enrollments/:id/pause

**Purpose:** Pause an active enrollment

**Request Body:**
```typescript
{
  reason?: string;  // e.g., "Prospect replied", "Manual pause"
}
```

**Response (200):**
```typescript
{
  success: true;
  enrollment: SequenceEnrollment;
}
```

**Error (400):** Enrollment not active
```typescript
{
  error: "INVALID_STATE",
  message: "Cannot pause enrollment with status: completed"
}
```

---

### 4. POST /api/enrollments/:id/resume

**Purpose:** Resume a paused enrollment

**Response (200):**
```typescript
{
  success: true;
  enrollment: SequenceEnrollment;
  nextStepAt: string;  // ISO date of next scheduled step
}
```

---

### 5. DELETE /api/enrollments/:id

**Purpose:** Stop an enrollment permanently

**Query Param:** `reason` (optional)

**Response (204):** No content

---

## Sprint 308 Blockers: Email Queue

### 1. GET /api/email/queue/status

**Purpose:** Get current queue status for monitoring

**Response (200):**
```typescript
{
  queued: number;           // Emails waiting to be sent
  processing: number;       // Currently sending
  sent24h: number;          // Sent in last 24 hours
  failed24h: number;        // Failed in last 24 hours
  deadLetter: number;       // In dead letter queue
  rateLimitRemaining: number; // SendGrid rate limit remaining
  oldestQueuedAt?: string;  // Timestamp of oldest queued email
}
```

---

### 2. GET /api/email/queue/dead-letter

**Purpose:** List failed emails for retry/inspection

**Response (200):**
```typescript
{
  data: Array<{
    id: string;
    prospectId: string;
    prospectEmail: string;
    sequenceId?: string;
    enrollmentId?: string;
    stepNumber?: number;
    subject: string;
    error: string;
    failedAt: string;
    attempts: number;
    lastAttemptAt: string;
  }>;
  pagination: { hasMore: boolean; nextCursor: string | null; };
}
```

---

### 3. POST /api/email/queue/retry/:id

**Purpose:** Retry a failed email from dead letter queue

**Response (200):**
```typescript
{
  success: true;
  message: "Email requeued for sending";
}
```

---

### 4. GET /api/email/events

**Purpose:** Get email tracking events (opens, clicks, etc.)

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `emailId` | string | Filter by email |
| `prospectId` | string | Filter by prospect |
| `event` | string | Filter: 'sent' \| 'delivered' \| 'opened' \| 'clicked' \| 'bounced' \| 'spam' |
| `since` | string | ISO date - events after this time |
| `limit` | number | Page size |

**Response (200):**
```typescript
{
  data: Array<{
    id: string;
    emailId: string;
    prospectId: string;
    event: string;
    timestamp: string;
    metadata?: {
      ip?: string;
      userAgent?: string;
      url?: string;       // for click events
    };
  }>;
}
```

---

### 5. GET /api/email/analytics

**Purpose:** Aggregate email analytics

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `period` | string | '7d' \| '30d' \| '90d' \| 'all' |
| `groupBy` | string | 'day' \| 'week' \| 'sequence' \| 'prospect' |
| `sequenceId` | string | Filter by sequence |

**Response (200):**
```typescript
{
  summary: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    openRate: number;      // percentage
    clickRate: number;     // percentage
    replyRate: number;     // percentage
    bounceRate: number;    // percentage
  };
  byPeriod?: Array<{
    period: string;        // e.g., "2026-01-30"
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
  }>;
}
```

---

### 6. GET /api/email/health

**Purpose:** Email service health check (for SystemHealth component)

**Response (200):**
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy';
  sendgrid: {
    status: string;
    rateLimitRemaining: number;
  };
  queue: {
    depth: number;
    oldestMessage?: string;
  };
  lastSentAt?: string;
}
```

---

## Sprint 309 Blockers: Authentication

### 1. GET /api/auth/session

**Purpose:** Get current session info (for auth bridge)

**Response (200):**
```typescript
{
  user: {
    id: string;
    email: string;
    name?: string;
    image?: string;
  };
  firebaseUid?: string;    // if linked
  expiresAt: string;
}
```

---

### 2. POST /api/auth/refresh

**Purpose:** Refresh session token

**Response (200):**
```typescript
{
  success: true;
  expiresAt: string;
}
```

---

### 3. POST /api/users/from-firebase

**Purpose:** Create/link Railway user from Firebase auth

**Request Body:**
```typescript
{
  firebaseUid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}
```

**Response (200):**
```typescript
{
  railwayUserId: string;
  isNewUser: boolean;
}
```

---

## Database Schema Changes Required

### people table additions:
```sql
ALTER TABLE people ADD COLUMN tier VARCHAR(10) DEFAULT 'Tier 2';
ALTER TABLE people ADD COLUMN score INTEGER DEFAULT 50;
ALTER TABLE people ADD COLUMN status VARCHAR(20) DEFAULT 'active';
ALTER TABLE people ADD COLUMN tags TEXT[];  -- or JSON array
ALTER TABLE people ADD COLUMN custom_fields JSONB;
ALTER TABLE people ADD COLUMN last_contacted_at TIMESTAMP;

-- Computed column (or view)
-- name = first_name || ' ' || last_name
```

### email_queue table (if not exists):
```sql
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES people(id),
  enrollment_id UUID REFERENCES sequence_enrollments(id),
  sequence_id UUID REFERENCES sequences(id),
  step_number INTEGER,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  status VARCHAR(20) DEFAULT 'queued', -- queued, sending, sent, failed
  error TEXT,
  attempts INTEGER DEFAULT 0,
  scheduled_at TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  sendgrid_message_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_scheduled ON email_queue(scheduled_at) WHERE status = 'queued';
```

### email_events table (if not exists):
```sql
CREATE TABLE email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES email_queue(id),
  prospect_id UUID REFERENCES people(id),
  event_type VARCHAR(20) NOT NULL, -- sent, delivered, opened, clicked, bounced, spam
  timestamp TIMESTAMP NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_events_email ON email_events(email_id);
CREATE INDEX idx_email_events_prospect ON email_events(prospect_id);
CREATE INDEX idx_email_events_type ON email_events(event_type);
```

---

## Error Response Format

All endpoints should return errors in this format:

```typescript
{
  error: string;           // Error code: "NOT_FOUND", "INVALID_STATE", etc.
  message: string;         // Human-readable message
  statusCode: number;      // HTTP status code
  details?: unknown;       // Optional additional context
}
```

**Standard HTTP Status Codes:**
- 200: Success
- 201: Created
- 204: No Content (DELETE)
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict (duplicate)
- 422: Unprocessable Entity
- 429: Rate Limited
- 500: Internal Server Error

---

## Testing Checklist

For each endpoint, verify:

- [ ] Returns correct status codes
- [ ] Accepts both S2S and NextAuth authentication
- [ ] Pagination works correctly
- [ ] Filters work as expected
- [ ] Error responses match format
- [ ] TypeScript types match response
- [ ] Added to ALLOWED_PATHS in GTM-YardFlow proxy

---

## Contact

**GTM-YardFlow Team:**
- Repo: `caseyglarkin2-png/GTM-YardFlow`
- Proxy: `api/railway/[...path].ts`
- Contract: `docs/api/RAILWAY_CONTRACT.md`

**Questions?** File an issue in GTM-YardFlow with label `railway-api`.

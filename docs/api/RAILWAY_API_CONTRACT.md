# Railway API Contract for GTM-YardFlow

> **Parent doc**: [.github/copilot-instructions.md](../../.github/copilot-instructions.md)

**Version**: 1.0.0  
**Updated**: February 5, 2026  
**Railway URL**: `https://yardflow-hitlist-production-2f41.up.railway.app`

This document specifies the exact request/response formats for API endpoints consumed by GTM-YardFlow (Vercel frontend).

---

## Authentication

All endpoints require either:
1. **S2S Auth** (service-to-service): `Authorization: Bearer <CRON_SECRET>` OR `x-service-key: <SERVICE_TO_SERVICE_SECRET>`
2. **Session Auth**: NextAuth session cookie (internal dashboard only)

### S2S Headers
All Vercel → Railway requests include:
```
x-service-key: $SERVICE_TO_SERVICE_SECRET
Authorization: Bearer $SERVICE_TO_SERVICE_SECRET
x-user-id: <firebase-uid> | service:gtm-frontend
x-request-id: <8-char-uuid>
x-source: gtm-yardflow-vercel
```

Optional header for S2S: `x-user-id: <userId>` to impersonate user context.

---

## Endpoints

### GET /api/health

Health check endpoint. **No auth required.**

**Response (200)**:
```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2026-02-05T15:51:45.903Z",
  "environment": {
    "critical": [],
    "optional_missing": ["GOOGLE_CLIENT_ID"]
  },
  "checks": {
    "database": { "status": "ok", "latencyMs": 12 },
    "redis": { "status": "ok", "latencyMs": 5 },
    "worker": { "status": "ok", "lagMs": 45000 },
    "queues": { "status": "ok", "queues": {} },
    "email": { "status": "ok", "recentSends": 5 },
    "ai": {
      "status": "ok" | "degraded" | "error",
      "gemini": { "ok": true } | { "ok": false, "waitSeconds": 43 },
      "openai": { "ok": true }
    }
  }
}
```

---

### POST /api/ai/chat

Brain chat endpoint for AI assistant.

**Request**:
```json
{
  "message": "Show me high-value prospects",
  "conversationId": "optional-uuid",
  "context": {
    "accountId": "optional",
    "personId": "optional",
    "pageContext": "dashboard" | "prospects" | "sequences"
  }
}
```

OR (GTM-YardFlow format):
```json
{
  "messages": [
    { "role": "user", "content": "Show me high-value prospects" }
  ],
  "conversationId": "optional-uuid"
}
```

**Response (200)**:
```json
{
  "message": "Here are your top prospects...",
  "conversationId": "uuid",
  "actions": [
    {
      "type": "navigate",
      "destination": "prospects",
      "tab": "prospects",
      "confidence": 0.9
    }
  ],
  "suggestions": ["Show me accounts with ICP > 80"],
  "provider": "gemini" | "openai",
  "tokensUsed": 150
}
```

---

### POST /api/ai/content/generate

Generate email content with FreightRoll voice.

**Request**:
```json
{
  "type": "email",
  "tone": "freightroll" | "professional" | "challenger",
  "goal": "Book a demo at Manifest",
  "context": {
    "prospectName": "John Smith",
    "companyName": "Acme Logistics",
    "title": "VP Operations"
  }
}
```

**Response (200)**:
```json
{
  "subject": "Quick question about Acme's yard ops",
  "content": "John, noticed Acme has 25 facilities...",
  "provider": "gemini" | "openai",
  "model": "gemini-2.0-flash" | "gpt-4o-mini",
  "tokensUsed": 89,
  "promptVersion": "v1"
}
```

**Error (400)** - Invalid tone:
```json
{
  "error": "validation_error",
  "details": "Invalid enum value. Expected 'freightroll' | 'professional' | 'challenger'"
}
```

---

### POST /api/ai/dossier/generate

Generate company research dossier.

**Request**:
```json
{
  "companyName": "Acme Logistics",
  "website": "https://acme-logistics.com",
  "industry": "Logistics"
}
```

**Response (200)**:
```json
{
  "company": "Acme Logistics",
  "summary": "Acme Logistics is a...",
  "keyInsights": ["Insight 1", "Insight 2"],
  "painPoints": ["Pain point 1"],
  "competitivePosition": "Market leader in...",
  "recentNews": ["News item 1"],
  "yardOpsRelevance": "High relevance because...",
  "talkingPoints": ["Talking point 1"],
  "icpMatch": 85,
  "recommendedApproach": "Lead with efficiency metrics",
  "provider": "gemini"
}
```

---

### GET /api/email/analytics

Email performance analytics.

**Query Params**:
- `period`: `7d` | `30d` | `90d` | `all` (default: `30d`)
- `groupBy`: `day` | `week` | `month` (default: `day`)
- `sequenceId`: optional filter

**Response (200)**:
```json
{
  "sent": 150,
  "delivered": 145,
  "opens": 45,
  "clicks": 12,
  "bounces": 5,
  "complaints": 0,
  "openRate": 0.31,
  "clickRate": 0.08,
  "bounceRate": 0.03,
  "replied": 8,
  "replyRate": 0.05,
  "byPeriod": [
    {
      "period": "2026-02-05",
      "sent": 20,
      "opens": 8,
      "clicks": 2,
      "replied": 1
    }
  ]
}
```

**Note**: Rates are decimals (0.31 = 31%), not percentages.

---

### GET /api/email/stats

Email queue and delivery stats.

**Query Params**:
- `period`: `24h` | `7d` | `30d` (default: `24h`)
- `groupBy`: `day` | `hour` (default: none)

**Response (200)**:
```json
{
  "total": 500,
  "sent": 450,
  "delivered": 440,
  "opened": 150,
  "clicked": 30,
  "bounced": 10,
  "failed": 5,
  "pending": 35
}
```

---

### POST /api/email/send

Send email via SendGrid.

**Request**:
```json
{
  "to": "prospect@company.com",
  "subject": "Quick question about yard ops",
  "body": "Hi John, I noticed...",
  "from": "jake@freightroll.com",
  "prospectId": "optional-person-id",
  "sequenceId": "optional-enrollment-id"
}
```

**Response (201)**:
```json
{
  "success": true,
  "messageId": "sendgrid-message-id",
  "outreachId": "outreach-record-id"
}
```

---

### GET /api/people

List contacts/prospects with filtering.

**Query Params**:
- `eventId`: Filter by event (optional for S2S)
- `limit`: Max records (default: 100, max: 500)
- `skip`: Offset for pagination
- `missingEmail`: `true` to filter contacts without email
- `minIcpScore`: Minimum ICP score filter
- `persona`: Filter by persona (can repeat: `?persona=isExecOps&persona=isOps`)

**Response (200)**:
```json
{
  "people": [
    {
      "id": "person-uuid",
      "name": "John Smith",
      "title": "VP Operations",
      "email": "john@acme.com",
      "phone": "+1-555-1234",
      "linkedin": "https://linkedin.com/in/johnsmith",
      "isExecOps": true,
      "isOps": false,
      "accountId": "account-uuid",
      "target_accounts": {
        "id": "account-uuid",
        "name": "Acme Logistics",
        "icpScore": 85
      }
    }
  ],
  "pagination": {
    "limit": 100,
    "skip": 0,
    "total": 1234,
    "hasMore": true
  }
}
```

---

### GET /api/accounts

List target accounts.

**Query Params**:
- `cursor`: Pagination cursor
- `limit`: Max records (default: 50)

**Response (200)**:
```json
{
  "accounts": [
    {
      "id": "account-uuid",
      "name": "Acme Logistics",
      "website": "https://acme.com",
      "industry": "Logistics",
      "headquarters": "Chicago, IL",
      "icpScore": 85,
      "eventId": "event-uuid"
    }
  ],
  "pagination": {
    "nextCursor": "cursor-string",
    "hasMore": true
  }
}
```

---

### GET /api/sequences

List outreach sequences.

**Query Params**:
- `status`: Filter by status (`active`, `paused`, `draft`)

**Response (200)**:
```json
{
  "sequences": [
    {
      "id": "sequence-uuid",
      "name": "Manifest 2026 Outreach",
      "description": "Pre-event sequence",
      "status": "active",
      "steps": 3,
      "totalEnrolled": 150,
      "totalCompleted": 45,
      "totalActive": 105,
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ]
}
```

---

### GET /api/enrollments

List sequence enrollments.

**Query Params**:
- `prospectId`: Filter by prospect
- `sequenceId`: Filter by sequence
- `status`: Filter by status
- `cursor`: Pagination cursor
- `limit`: Max records (default: 25, max: 100)

**Response (200)**:
```json
{
  "data": [
    {
      "id": "enrollment-uuid",
      "prospectId": "person-uuid",
      "sequenceId": "sequence-uuid",
      "status": "active",
      "currentStep": 2,
      "totalSteps": 3,
      "startedAt": "2026-02-01T10:00:00Z",
      "lastStepAt": "2026-02-03T10:00:00Z",
      "metrics": {
        "emailsSent": 2,
        "emailsOpened": 1,
        "emailsClicked": 0,
        "repliesReceived": 0
      },
      "sequence": { "id": "...", "name": "..." },
      "prospect": { "id": "...", "name": "...", "email": "..." }
    }
  ],
  "pagination": {
    "hasMore": false,
    "nextCursor": null
  }
}
```

---

## Error Responses

All endpoints return consistent error format:

**400 Bad Request**:
```json
{
  "error": "validation_error",
  "details": "Description of what's wrong"
}
```

**401 Unauthorized**:
```json
{
  "error": "unauthorized"
}
```

**404 Not Found**:
```json
{
  "error": "not_found",
  "message": "Resource not found"
}
```

**422 Unprocessable Entity**:
```json
{
  "error": "Email blocked",
  "reason": "suppressed",
  "requestId": "abc123"
}
```

**429 Rate Limited**:
```json
{
  "error": "rate_limited"
}
```
Headers: `Retry-After: 30`

**500 Internal Server Error**:
```json
{
  "error": "INTERNAL_ERROR",
  "message": "Error description",
  "statusCode": 500
}
```

---

## Type Definitions

All types are defined in [`src/types/railway.ts`](../../src/types/railway.ts):

- `RailwayProspect` / `RailwayPerson` - Contact entity with tier, ICP score
- `RailwayAccount` - Company entity with ICP scoring
- `RailwaySequence` - Sequence with steps array
- `RailwayEnrollment` - Prospect-Sequence relationship
- `RailwayEmail` - Email entity with tracking
- `RailwayHealthResponse` - Health check response
- `PaginatedResponse<T>` - Standard pagination wrapper

---

## Circuit Breaker

The proxy (`api/railway/[...path].ts`) implements a circuit breaker:

1. **Closed**: Normal operation, requests pass through
2. **Open**: After 5 consecutive failures, requests fail immediately (503)
3. **Half-Open**: After 30s, allow one test request
4. **Closed**: On success, reset to normal

When circuit is open, callers should:
- Show "Service temporarily unavailable" message
- Queue operations for retry
- Use cached data if available

---

## Request Tracing

Every request includes:
1. `x-request-id` header (generated by caller)
2. Response includes `requestId` in errors
3. Railway logs correlate via this ID

For debugging production issues:
```bash
# Find request in Vercel logs
vercel logs | grep "x-request-id: abc123"

# Find in Railway logs
railway logs | grep "abc123"
```

---

## Troubleshooting Guide

### Common Issues

#### 1. "Service temporarily unavailable" (503)

**Symptoms:**
- Email sends fail with 503
- Railway health check returns 503
- Circuit breaker is open

**Diagnosis:**
```bash
# Check Railway backend health directly
curl -H "x-service-key: $RAILWAY_API_SECRET" \
  https://yardflow-hitlist-production-2f41.up.railway.app/api/health

# Check Vercel proxy logs
vercel logs --since 5m | grep -E "(circuit|503|railway)"
```

**Solutions:**
1. **Railway is down** - Check Railway dashboard for deployment issues
2. **Network issues** - Check Railway region connectivity
3. **Auth mismatch** - Verify `RAILWAY_API_SECRET` matches Railway's `CRON_SECRET`

#### 2. "Invalid token" (401) from Railway

**Symptoms:**
- All Railway API calls fail with 401
- Works locally but not in production

**Diagnosis:**
```bash
# Verify the secret is set correctly (check length, not value)
vercel env ls | grep -E "(RAILWAY_API_SECRET|SERVICE_TO_SERVICE_SECRET)"
```

**Solutions:**
1. **Secrets not synced** - Ensure both Vercel and Railway have matching secrets
2. **Secret has whitespace** - Re-paste secret, check for trailing newlines
3. **Wrong priority** - `SERVICE_TO_SERVICE_SECRET` takes precedence over `RAILWAY_API_SECRET`

#### 3. "Rate limit exceeded" (429)

**Symptoms:**
- Bulk sends fail partway through
- Individual sends work but batch fails

**Diagnosis:**
```javascript
// Check response headers
const remaining = response.headers.get('X-RateLimit-Remaining');
const resetAt = response.headers.get('X-RateLimit-Reset');
console.log(`Remaining: ${remaining}, Resets: ${new Date(resetAt * 1000)}`);
```

**Solutions:**
1. **Warmup limit** - New accounts have 20 emails/day limit
2. **Per-minute limit** - Wait 60 seconds between batches
3. **Add delays** - Use sequential sends with 100ms delays

#### 4. "Email blocked" / "suppressed" (422)

**Symptoms:**
- Specific emails fail with 422
- Error reason is "suppressed"

**Solutions:**
1. **Previous hard bounce** - Email is permanently on suppression list
2. **Previous spam report** - Email has complained, don't send again
3. **Unsubscribed** - Recipient opted out via CAN-SPAM link

### Debug Checklist

Before escalating, verify:

- [ ] **Environment variables set** - All `RAILWAY_*` vars in Vercel
- [ ] **Secrets match** - Same value in Vercel and Railway
- [ ] **Feature flag enabled** - `VITE_RAILWAY_ENABLED=true`
- [ ] **Firebase token valid** - User is authenticated
- [ ] **Email not suppressed** - Check suppression list
- [ ] **Within rate limits** - Not hitting 100/min or warmup limits
- [ ] **Circuit breaker closed** - No 503 errors indicating open circuit

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-05 | V1.0.0 - Synchronized with Railway contract |
| 2026-02-05 | Removed `luis` tone, now `freightroll` only |
| 2026-02-05 | Email analytics returns rates as decimals |
| 2026-02-05 | Added /api/people, /api/accounts endpoints |
| 2026-02-05 | Added /api/ai/chat endpoint |

# GTM-YardFlow ↔ Railway API Contract

> **Purpose**: Define the integration points between GTM-YardFlow (Vercel) and YardFlow-Hitlist (Railway)

---

## Authentication

### Vercel → Railway (S2S)
All proxy requests include these headers:
```
Authorization: Bearer {CRON_SECRET}
x-service-key: {SERVICE_TO_SERVICE_SECRET}
x-user-id: {firebase_uid} | "service:gtm-frontend"
x-user-email: {user_email}  # optional
x-source: "gtm-yardflow-vercel" | "gtm-yardflow-proxy"
x-request-id: {uuid}
```

Railway should accept EITHER:
1. NextAuth session (for Railway UI)
2. Bearer token matching `CRON_SECRET` (for Vercel proxy)

---

## Allowed Proxy Paths

GTM-YardFlow proxy (`api/railway/[...path].ts`) forwards these paths to Railway:

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
  '/api/prospects',
  '/api/enrollments',
  '/api/email/queue',
  '/api/email/events',
  '/api/email/analytics',
  '/api/webhooks/sendgrid',
  '/api/auth',
  '/api/users',
  '/api/dashboards',
  '/api/campaigns',
];
```

To add new paths: Edit `api/railway/[...path].ts` in GTM-YardFlow.

---

## Webhooks (Railway → Vercel)

Railway should configure SendGrid to send webhooks directly to Vercel (not Railway):

| Webhook | Vercel Endpoint | Events |
|---------|-----------------|--------|
| SendGrid | `https://{vercel-domain}/api/webhooks/sendgrid` | delivered, open, click, bounce, spamreport, unsubscribe |
| SendGrid Inbound Parse | `https://{vercel-domain}/api/webhooks/inbound` | Reply detection |
| Calendly | `https://{vercel-domain}/api/webhooks/calendly` | invitee.created, invitee.canceled |

### SendGrid Webhook Payload Requirements

When Railway sends emails via SendGrid, include these `custom_args`:
```json
{
  "emailId": "uuid",
  "prospectId": "uuid",
  "sequenceId": "uuid",         // if from sequence
  "enrollmentId": "uuid",       // if from sequence
  "stepIndex": 0,               // sequence step number
  "campaignId": "uuid"          // optional
}
```

These are used by Vercel to:
- Track email events in Firestore
- Attribute opens/clicks to prospects
- Pause sequences on replies
- Attribute meetings to sequences (North Star!)

---

## Expected Railway Endpoints

### Health Check
```
GET /api/health
Response: {
  status: "healthy" | "unhealthy",
  checks: {
    database: { status: string, latencyMs: number },
    redis: { status: string, latencyMs: number },
    queues: { status: string }
  },
  timestamp: string
}
```

### Send Email
```
POST /api/outreach/send-email
Headers: Authorization: Bearer {CRON_SECRET}
Body: { outreachId: string }
Response: {
  success: boolean,
  messageId?: string,
  error?: string
}
```

### Prospects CRUD
```
GET    /api/prospects
POST   /api/prospects
GET    /api/prospects/:id
PUT    /api/prospects/:id
DELETE /api/prospects/:id
```

### Sequences & Enrollments
```
GET    /api/sequences
POST   /api/sequences
GET    /api/enrollments
POST   /api/enrollments
PUT    /api/enrollments/:id/pause
PUT    /api/enrollments/:id/resume
PUT    /api/enrollments/:id/stop
```

---

## Firestore Collections (Vercel-owned)

Vercel writes to these Firestore collections (Railway should NOT write here):

| Collection | Purpose |
|------------|---------|
| `email_events` | Webhook events from SendGrid |
| `email_suppressions` | Bounces, spam reports, unsubscribes |
| `meetings` | Calendly meeting data |
| `prospects` | Prospect CRM data (mirror) |

---

## Environment Variable Sync

These must match between Vercel and Railway:

| Vercel Variable | Railway Variable | Purpose |
|-----------------|------------------|---------|
| `SERVICE_TO_SERVICE_SECRET` | `CRON_SECRET` | S2S auth |
| `RAILWAY_API_URL` | (Railway URL) | Backend URL |

---

## Error Handling

Railway should return consistent error responses:
```json
{
  "error": "ErrorType",
  "message": "Human readable message",
  "statusCode": 400
}
```

Vercel proxy will:
- Retry on 5xx with exponential backoff (3 attempts)
- Circuit break after 5 consecutive failures (30s cooldown)
- Cache health checks for 5s

# Railway Integration Guide 🚂

## Overview

YardFlow operates with **two deployment platforms**:

| Platform | URL | Repository | Purpose |
|----------|-----|------------|---------|
| **Railway** | `yardflow-hitlist-production-2f41.up.railway.app` | `YardFlow-Hitlist` | Full backend (Postgres, Redis, Workers) |
| **Vercel** | `gtm-yard-flow.vercel.app` | `GTM-YardFlow` | Frontend + Firebase integration |

## Railway Platform Services

### Infrastructure Status ✅
As of 2026-01-30, Railway is fully operational:

```json
{
  "database": "ok (2ms latency)",
  "redis": "ok (0ms latency)",
  "queues": {
    "enrichment": "ready",
    "outreach": "ready",
    "emails": "ready",
    "sequence": "ready"
  }
}
```

### Key Features on Railway

1. **Email Infrastructure**
   - SendGrid integration with tracking
   - Open/click tracking pixels
   - Unsubscribe handling (CAN-SPAM compliant)
   - Batch sending with rate limiting

2. **Outreach Sequences**
   - Multi-step automated sequences
   - EMAIL, LINKEDIN, MANIFEST, PHONE channels
   - Delay-based scheduling
   - Enrollment management

3. **Job Processing (BullMQ + Redis)**
   - `enrichment` - Email pattern detection
   - `outreach` - Outreach campaign processing
   - `emails` - Email sending queue
   - `sequence` - Sequence step execution

4. **Database (Postgres + Prisma)**
   - `people` - Contact records with emails
   - `target_accounts` - Company accounts
   - `campaigns` - Marketing campaigns
   - `sequences` - Outreach sequences
   - `outreach` - Individual outreach records
   - `EmailActivity` - Email send/open/click tracking
   - `OutreachSequence` - Sequence definitions
   - `SequenceEnrollment` - Person enrollments

## Integration Strategy

### Option 1: API Proxy (Recommended) 🎯

Have Vercel proxy email-related API calls to Railway:

```
Vercel Frontend → Vercel API → Railway Backend → SendGrid
```

**Benefits:**
- Keep existing frontend code
- Leverage Railway's robust email infrastructure
- No Firebase changes needed for core app

**Implementation:**
1. Create `/api/proxy/[...path].ts` to forward requests
2. Set `RAILWAY_API_URL` environment variable
3. Forward auth headers appropriately

### Option 2: Direct Railway Usage

Redirect users entirely to the Railway app for email/outreach features.

### Option 3: Migrate to Railway

Move everything to Railway, deprecate Vercel deployment.

## Environment Variables

### Required for Railway Integration

```bash
# Railway API URL
RAILWAY_API_URL=https://yardflow-hitlist-production-2f41.up.railway.app

# Shared secrets for API authentication
RAILWAY_API_SECRET=<shared-secret-between-apps>
```

### Railway Variables (already configured)
```bash
DATABASE_URL          # Postgres connection
REDIS_URL             # Redis connection
AUTH_SECRET           # NextAuth secret
SENDGRID_API_KEY      # Email sending
SENDGRID_FROM_EMAIL   # From email address
OPENAI_API_KEY        # AI content generation
HUNTER_API_KEY        # Email enrichment (optional)
```

## API Endpoints on Railway

### Health & Status
- `GET /api/health` - Full system health check

### Email & Outreach
- `POST /api/outreach/send-email` - Send email via SendGrid
- `POST /api/outreach/generate-ai` - Generate AI outreach content
- `GET /api/outreach/export` - Export outreach data

### Enrichment
- `POST /api/enrichment/email` - Enrich single contact
- `PUT /api/enrichment/email` - Batch enrichment
- `POST /api/enrichment/smart-guess` - Free email guessing

### Sequences
- `GET/POST /api/sequences` - List/create sequences
- `POST /api/sequences/[id]/enroll` - Enroll contacts
- `GET /api/sequences/[id]/analytics` - Sequence metrics

### Cron Jobs
- `GET /api/cron/sequences` - Process pending sequence steps

## Quick Start: Testing Railway

```bash
# Test Railway health
curl https://yardflow-hitlist-production-2f41.up.railway.app/api/health

# Test with authentication (requires session)
curl -X POST https://yardflow-hitlist-production-2f41.up.railway.app/api/outreach/send-email \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<your-token>" \
  -d '{"outreachId": "xxx"}'
```

## Migration Checklist

- [ ] Verify Railway app is healthy
- [ ] Test Railway API endpoints
- [ ] Set up API proxy in Vercel (if using Option 1)
- [ ] Update frontend to use Railway for email features
- [ ] Configure shared authentication
- [ ] Test email sending end-to-end
- [ ] Update deployment documentation

## Support

- **Railway Dashboard**: https://railway.app/dashboard
- **YardFlow-Hitlist Repo**: https://github.com/caseyglarkin2-png/YardFlow-Hitlist
- **Production URL**: https://yardflow-hitlist-production-2f41.up.railway.app

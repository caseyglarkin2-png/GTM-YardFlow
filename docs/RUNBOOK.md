# GTM-YardFlow Production Runbook

## Overview

This runbook provides procedures for operating and troubleshooting GTM-YardFlow in production.

## Quick Reference

| Issue | Check | Action |
|-------|-------|--------|
| App not loading | `/api/health` | Check Vercel status |
| Emails not sending | Railway health | Check Railway logs |
| Auth failing | Firebase Console | Check quota/rules |
| Sequences stuck | Cron logs | Run manual cron |

## Emergency Contacts

| Role | Contact |
|------|---------|
| Platform Owner | jake@yardflow.io |
| Vercel Support | Vercel Dashboard |
| Railway Support | Railway Dashboard |
| Firebase Support | Firebase Console |

---

## 1. Health Checks

### 1.1 Vercel Health

```bash
# Check Vercel health endpoint
curl https://your-domain.vercel.app/api/health

# Expected response
{
  "status": "ok",
  "version": "abc1234",
  "timestamp": "2026-01-19T12:00:00.000Z",
  "environment": "production"
}

# Detailed check
curl https://your-domain.vercel.app/api/health?details=true
```

### 1.2 Railway Health

```bash
# Check Railway API
curl https://your-railway-app.railway.app/api/health

# Check via proxy
curl https://your-domain.vercel.app/api/railway/health
```

### 1.3 Firebase Health

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Check Firestore → Usage
3. Check Authentication → Users
4. Check Functions → Logs (if applicable)

---

## 2. Email Operations

### 2.1 Check Email Queue Status

```bash
# Via API
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.vercel.app/api/cron/execute-sequences

# Expected response
{
  "success": true,
  "processed": 10,
  "errors": 0
}
```

### 2.2 Retry Failed Emails

1. Go to Firestore → `email_events` collection
2. Filter by `status == 'failed'`
3. For each failed email:
   - Check `error` field
   - If transient error: Update `status` to `pending`
   - If permanent error: Update enrollment status

### 2.3 Clear Dead Letter Queue

```bash
# Check dead letter queue
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-railway-app.railway.app/api/email/dead-letter

# Process dead letters
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://your-railway-app.railway.app/api/email/dead-letter/process
```

---

## 3. Cron Jobs

### 3.1 Check Cron Status

1. Go to Vercel Dashboard → Your Project → Settings → Cron Jobs
2. Check "Last Run" and "Next Run"
3. Click on job to see logs

### 3.2 Manual Cron Execution

```bash
# Execute sequences manually
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.vercel.app/api/cron/execute-sequences

# Process queue manually
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.vercel.app/api/cron/process-queue
```

### 3.3 Cron Not Running

**Symptoms:** Emails not being sent, sequences stuck

**Diagnosis:**
1. Check Vercel cron configuration in `vercel.json`
2. Check cron logs in Vercel Dashboard
3. Verify `CRON_SECRET` matches between Vercel and Railway

**Resolution:**
1. If config wrong: Update `vercel.json`, redeploy
2. If secret mismatch: Update env vars, redeploy
3. If timeout: Increase cron duration in `vercel.json`

---

## 4. Database Operations

### 4.1 Firestore Queries

```javascript
// Check stuck enrollments
db.collection('sequence_enrollments')
  .where('status', '==', 'active')
  .where('nextStepAt', '<', new Date(Date.now() - 24 * 60 * 60 * 1000))
  .get()
  .then(snap => console.log(`Stuck enrollments: ${snap.size}`));

// Check email queue backlog
db.collection('email_queue')
  .where('status', '==', 'pending')
  .get()
  .then(snap => console.log(`Queue backlog: ${snap.size}`));
```

### 4.2 Firestore Indexes

If queries are slow or failing:

1. Check Firestore console for "Indexes" tab
2. Look for "Building" status
3. If index missing, create via `firestore.indexes.json`

```bash
firebase deploy --only firestore:indexes
```

---

## 5. Authentication Issues

### 5.1 Firebase Auth Down

**Symptoms:** Users can't log in, "auth/network-request-failed"

**Resolution:**
1. Check [Firebase Status](https://status.firebase.google.com)
2. If Firebase down: Wait for recovery
3. If not Firebase: Check network/DNS

### 5.2 Railway Auth Bridge Failing

**Symptoms:** Users logged in via Firebase but Railway calls fail

**Diagnosis:**
1. Check browser console for auth errors
2. Check Railway logs for bridge endpoint
3. Verify `FIREBASE_SERVICE_ACCOUNT_KEY` in Railway

**Resolution:**
1. If key expired: Regenerate in Firebase Console
2. If bridge endpoint error: Check Railway deployment

---

## 6. Common Issues

### 6.1 High Latency

**Symptoms:** Pages slow to load, API timeouts

**Diagnosis:**
1. Check Vercel Analytics → Performance
2. Check Railway metrics → CPU/Memory
3. Check Firestore usage → Reads/Writes

**Resolution:**
1. If Firestore: Add query limits, check indexes
2. If Railway: Scale up or optimize queries
3. If CDN: Check Vercel edge function regions

### 6.2 High Error Rate

**Symptoms:** Error spike in logs, users reporting issues

**Diagnosis:**
1. Check Vercel Logs for errors
2. Check Railway logs
3. Check Sentry/error tracking

**Resolution:**
1. Identify error pattern
2. If code bug: Deploy hotfix
3. If dependency: Check status pages

### 6.3 Webhook Failures

**Symptoms:** Email events not being tracked, Calendly not syncing

**Diagnosis:**
1. Check SendGrid Activity → Webhook Logs
2. Check Calendly → Developer → Webhooks
3. Check Vercel Logs for webhook endpoints

**Resolution:**
1. If timeout: Increase function duration
2. If auth: Check webhook secrets
3. If parse error: Check payload format

---

## 7. Rollback Procedures

### 7.1 Vercel Rollback

1. Go to Vercel Dashboard → Deployments
2. Find last working deployment
3. Click "..." → "Promote to Production"

### 7.2 Railway Rollback

1. Go to Railway Dashboard → Deployments
2. Find last working deployment
3. Click "Rollback"

### 7.3 Firestore Backup/Restore

```bash
# Export (backup)
gcloud firestore export gs://your-bucket/backups/$(date +%Y%m%d)

# Import (restore)
gcloud firestore import gs://your-bucket/backups/20260119
```

---

## 8. Monitoring Setup

### 8.1 Uptime Monitoring

Configure UptimeRobot or similar:

| Monitor | URL | Interval |
|---------|-----|----------|
| Vercel Health | `/api/health` | 1 min |
| Railway Health | `/api/railway/health` | 1 min |
| Frontend | `/` | 5 min |

### 8.2 Alerts

Set up alerts for:
- Health check failures
- Error rate spikes (> 5%)
- Latency degradation (p95 > 3s)
- Cron job failures

---

## 9. Appendix

### Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `CRON_SECRET` | Vercel + Railway | Cron authentication |
| `RAILWAY_API_URL` | Vercel | Railway backend URL |
| `SERVICE_TO_SERVICE_SECRET` | Vercel | S2S auth |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Railway | Firebase token verification |

### Useful Links

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Railway Dashboard](https://railway.app/dashboard)
- [Firebase Console](https://console.firebase.google.com)
- [SendGrid Activity](https://app.sendgrid.com/email_activity)
- [Platform Architecture](./PLATFORM_ARCHITECTURE.md)
- [Auth Bridge Contract](./api/AUTH_BRIDGE_CONTRACT.md)

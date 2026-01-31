# Deployment Guide

## Overview

This document describes the deployment process for GTM-YardFlow.

## Deployment Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   GitHub        │────>│   Vercel        │
│   (main branch) │     │   (Production)  │
└─────────────────┘     └─────────────────┘
         │
         └─────────────>┌─────────────────┐
                        │   Railway       │
                        │   (Production)  │
                        └─────────────────┘
```

## Pre-Deployment Checklist

### Before Starting

- [ ] All tests passing locally (`npm test -- --run`)
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] E2E tests passing (`npm run test:e2e`)
- [ ] No console errors in development
- [ ] Feature flags set correctly for deployment

### Code Review

- [ ] PR approved by at least one reviewer
- [ ] No security warnings from GitHub
- [ ] Bundle size within limits
- [ ] Documentation updated if needed

### Environment

- [ ] Environment variables verified (no placeholders)
- [ ] Secrets rotated if compromised
- [ ] Railway API URL correct for environment

---

## Deployment Steps

### 1. Merge to Main

```bash
# Ensure local main is up to date
git checkout main
git pull origin main

# Merge feature branch
git merge feature/your-feature

# Push to trigger deployment
git push origin main
```

### 2. Monitor Vercel Deployment

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Watch deployment progress
3. Check for build errors
4. Verify preview deployment works

### 3. Railway Deployment (if applicable)

1. Railway auto-deploys from main branch
2. Check Railway Dashboard for status
3. Verify health endpoint responds

### 4. Verify Production

```bash
# Check health endpoints
curl https://your-domain.vercel.app/api/health
curl https://your-railway-app.railway.app/api/health

# Quick smoke test
curl https://your-domain.vercel.app
```

---

## Post-Deployment Verification

### Immediate (within 5 minutes)

- [ ] App loads in browser
- [ ] Health endpoint returns 200
- [ ] No errors in Vercel logs
- [ ] No errors in Railway logs (if applicable)

### Short-term (within 1 hour)

- [ ] Users can log in
- [ ] Prospects page loads
- [ ] Email sequences visible
- [ ] Cron jobs running (check logs)

### Extended (within 24 hours)

- [ ] Email sends succeeding
- [ ] Webhooks processing
- [ ] No error rate increase
- [ ] Performance within norms

---

## Rollback Procedure

### When to Rollback

- Critical functionality broken
- Error rate > 5%
- Security vulnerability discovered
- Data corruption detected

### Vercel Rollback

1. Go to Vercel Dashboard → Deployments
2. Find the last working deployment
3. Click "..." → "Promote to Production"
4. Confirm the rollback
5. Verify with health check

### Railway Rollback

1. Go to Railway Dashboard → Deployments
2. Find the last working deployment
3. Click "Rollback"
4. Confirm and verify

### Post-Rollback

1. Notify team of rollback
2. Document the issue
3. Create hotfix branch
4. Test fix thoroughly before re-deploying

---

## Environment Variables

### Vercel Production

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_FIREBASE_API_KEY` | Yes | Firebase Web API |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase Auth |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase Project |
| `RAILWAY_API_URL` | Yes | Railway backend URL |
| `CRON_SECRET` | Yes | Cron job auth |
| `SERVICE_TO_SERVICE_SECRET` | Yes | S2S auth |

### Railway Production

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Postgres connection |
| `REDIS_URL` | Yes | Redis connection |
| `CRON_SECRET` | Yes | Cron job auth |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Yes | Firebase token verify |
| `SENDGRID_API_KEY` | Yes | Email sending |

---

## Feature Flags

Before deploying, verify feature flags in `src/config/featureFlags.ts`:

```typescript
// Production settings
VITE_RAILWAY_ENABLED=true
VITE_RAILWAY_EMAIL_ENABLED=true
VITE_FIREBASE_AUTH_FALLBACK=true
```

---

## Monitoring

### During Deployment

- Watch Vercel deployment logs
- Monitor Railway build (if applicable)
- Check Sentry for new errors

### After Deployment

- Check [Vercel Analytics](https://vercel.com/analytics)
- Monitor error rates
- Check cron job execution
- Verify webhook processing

---

## Hotfix Procedure

For urgent production issues:

1. Create hotfix branch from main
   ```bash
   git checkout main
   git pull
   git checkout -b hotfix/description
   ```

2. Make minimal fix only

3. Test locally and with E2E

4. Get expedited review (ping in Slack)

5. Merge and deploy

6. Document in incident log

---

## Appendix

### Useful Commands

```bash
# Build and test locally
npm run build
npm test -- --run
npm run test:e2e

# Check bundle size
npm run build -- --analyze

# Verify Railway integration
npm run verify:railway

# Deploy preview (automatic on PR)
vercel
```

### Related Documentation

- [Runbook](./RUNBOOK.md)
- [Architecture](./ARCHITECTURE.md)
- [Feature Flags](../src/config/featureFlags.ts)
- [Platform Architecture](./PLATFORM_ARCHITECTURE.md)

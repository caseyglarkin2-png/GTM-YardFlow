# Auth Soak Test Results

## T97.5: Railway Auth Production Soak Test

**Test Period:** [PENDING - Fill in dates]  
**Test Duration:** 24 hours minimum  
**Test Owner:** [Your Name]

---

## Pre-Test Checklist

- [ ] T97.0 (AuthBridge) deployed to production
- [ ] T97.0.5 (User Migration) completed for existing users
- [ ] T97.1-T97.3 (Railway auth) deployed to production
- [ ] Feature flags configured:
  - `RAILWAY_ENABLED=true`
  - `RAILWAY_AUTH_ENABLED=true`
  - `FIREBASE_AUTH_FALLBACK=true`
  - `RAILWAY_TRAFFIC_PERCENT=10`
- [ ] Monitoring dashboards ready
- [ ] Rollback plan documented

---

## Traffic Split Configuration

| Auth System | Traffic % | Flag |
|------------|-----------|------|
| Railway (Primary) | 10% | `RAILWAY_TRAFFIC_PERCENT=10` |
| Firebase (Fallback) | 90% | `FIREBASE_AUTH_FALLBACK=true` |

---

## Metrics Collection (24h Period)

### Login Events

| Metric | Count | Notes |
|--------|-------|-------|
| Railway login attempts | ___ | |
| Railway login success | ___ | |
| Railway login failures | ___ | |
| Firebase fallback attempts | ___ | |
| Firebase fallback success | ___ | |

### Session Events

| Metric | Count | Notes |
|--------|-------|-------|
| Token refresh events | ___ | |
| Token refresh failures | ___ | |
| Session expiry events | ___ | |
| Auto-logout events (401) | ___ | |

### Error Events

| Metric | Count | Notes |
|--------|-------|-------|
| 500 errors (auth routes) | ___ | |
| 401 errors (expired token) | ___ | |
| 403 errors (forbidden) | ___ | |
| Network timeouts | ___ | |

### User Migration

| Metric | Count | Notes |
|--------|-------|-------|
| Users migrated (background) | ___ | |
| Migration failures | ___ | |

---

## Calculated Rates

| Rate | Value | Target | Status |
|------|-------|--------|--------|
| Railway Login Success Rate | ___% | >99% | ⬜ |
| Token Refresh Success Rate | ___% | >99.9% | ⬜ |
| 5xx Error Rate | ___% | <0.1% | ⬜ |
| Mean Login Latency | ___ms | <500ms | ⬜ |
| P99 Login Latency | ___ms | <2000ms | ⬜ |

---

## Error Log Analysis

### Critical Errors (require fix before proceeding)

```
[Paste any critical errors here]
```

### Warnings (monitor but non-blocking)

```
[Paste any warnings here]
```

### Known Issues

| Issue | Impact | Mitigation |
|-------|--------|------------|
| | | |

---

## User Feedback

| Source | Feedback | Action |
|--------|----------|--------|
| | | |

---

## Test Matrix Results

| User Type | Login | Session Persist | Token Refresh | Logout | Status |
|-----------|-------|-----------------|---------------|--------|--------|
| New Railway user | ⬜ | ⬜ | ⬜ | ⬜ | |
| Migrated user | ⬜ | ⬜ | ⬜ | ⬜ | |
| Firebase fallback user | ⬜ | ⬜ | ⬜ | ⬜ | |
| Mobile browser | ⬜ | ⬜ | ⬜ | ⬜ | |
| Incognito mode | ⬜ | ⬜ | ⬜ | ⬜ | |

---

## Decision

### Test Result: [ ] PASS / [ ] FAIL

**Rationale:**
[Explain why test passed or failed]

### Recommended Actions

If PASS:
- [ ] Increase Railway traffic to 50%
- [ ] Continue monitoring for 24h
- [ ] Schedule Firebase removal for [date]

If FAIL:
- [ ] Document root cause
- [ ] Create fix tickets
- [ ] Schedule re-test for [date]

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Test Owner | | | |
| Engineering Lead | | | |
| Product Owner | | | |

---

## Appendix

### A. Monitoring Queries

```sql
-- Railway login success rate
SELECT 
  COUNT(CASE WHEN success = true THEN 1 END) * 100.0 / COUNT(*) as success_rate
FROM auth_events
WHERE source = 'railway'
AND timestamp > NOW() - INTERVAL '24 hours';
```

```sql
-- Token refresh events
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN success = true THEN 1 END) as success,
  COUNT(CASE WHEN success = false THEN 1 END) as failed
FROM token_refresh_events
WHERE timestamp > NOW() - INTERVAL '24 hours';
```

### B. Rollback Procedure

1. Set `RAILWAY_AUTH_ENABLED=false` in Vercel
2. Deploy config change (no code change needed)
3. All users will use Firebase auth
4. Monitor for 30 minutes
5. Communicate to stakeholders

### C. Escalation Contacts

| Role | Contact | Escalate When |
|------|---------|---------------|
| On-call Engineer | | Any critical error |
| Security Lead | | Auth bypass suspected |
| Infrastructure | | Railway API down |

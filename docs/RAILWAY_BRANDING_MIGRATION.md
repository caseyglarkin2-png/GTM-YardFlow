# Railway Branding Migration Guide

> **Sprint 38A**: FreightRoll rebrand — YardFlow → FreightRoll, Luis → configurable sender

## Summary

This document tracks branding changes needed on both GTM-YardFlow (Vercel) and YardFlow-Hitlist (Railway).

## Changes Completed (GTM-YardFlow)

| File | Change |
|------|--------|
| `api/ai/generate.ts` | System prompt now says "FreightRoll", sign-off uses `{{senderName}}` |
| `src/config/brainSystemPrompt.ts` | "YardFlow Brain" → "FreightRoll Brain" |
| `src/config/tones.ts` | `luis` → `freightroll`, "Luis Style" → "FreightRoll Voice" |
| `src/types/railway.ts` | `TemplateTone` updated |
| `src/utils/templateAdapter.ts` | `LUIS` → `FREIGHTROLL` mappings |
| `src/data/sequenceTemplates.ts` | Template IDs and descriptions updated |
| `src/services/RailwayApiClient.ts` | Tone type comments updated |
| `src/components/BulkEmailModal.tsx` | "Luis" option → "FreightRoll" |

## Changes Needed (Railway Backend)

**Repository**: `innovative-ambition/yardflow-hitlist`

| File | Change Needed |
|------|---------------|
| `lib/prompts/email-tones.ts` | Rename `LUIS` tone key to `FREIGHTROLL` |
| `app/api/ai/chat/route.ts` | Update any hardcoded "YardFlow" → "FreightRoll" |
| Database | Update existing templates with `tone: 'LUIS'` → `tone: 'FREIGHTROLL'` |

### SQL Migration (if needed)
```sql
-- Update existing templates to new tone
UPDATE templates 
SET tone = 'FREIGHTROLL' 
WHERE tone = 'LUIS';
```

---

## Email Sending Limits & Aggressive Warmup Strategy

### Current Warmup Limits (Conservative)
| Week | Daily Limit | Notes |
|------|-------------|-------|
| 1 | 50/day | New accounts |
| 2 | 100/day | Building reputation |
| 3 | 250/day | Gaining trust |
| 4 | 500/day | Established sender |
| 5+ | Unlimited | Mature account |

### 🚀 AGGRESSIVE WARMUP STRATEGY (Recommended)

**Goal**: Maximize volume from Day 1 while maintaining deliverability.

#### 1. Domain Authentication (CRITICAL - Do This First)
- [ ] **SPF Record**: Add SendGrid to DNS TXT record
- [ ] **DKIM Signing**: Enable domain authentication in SendGrid
- [ ] **DMARC Policy**: Start with `p=none`, move to `quarantine`
- [ ] **Custom Tracking Domain**: Use `track.freightroll.com` instead of SendGrid default

#### 2. IP Warming Strategy
**Option A: Dedicated IP (Recommended for volume)**
- Purchase dedicated IP from SendGrid ($20-80/mo)
- Full control over reputation
- Start at 50/day, double every 2-3 days if bounce rate < 2%

**Option B: Shared IP Pool (Current)**
- SendGrid's shared pool
- Reputation affected by other senders
- Limits enforced by SendGrid automatically

#### 3. Bypass Warmup for Verified Senders
```typescript
// In EmailWarmupService or feature flags
const BYPASS_WARMUP_DOMAINS = [
  'freightroll.com',  // Our domain - we trust ourselves
];

// Or set env var in Railway/Vercel:
// BYPASS_EMAIL_WARMUP=true
```

#### 4. SendGrid Sender Verification
- [ ] Verify `jake@freightroll.com` as sender
- [ ] Verify `casey@freightroll.com` as sender  
- [ ] Verify `team@freightroll.com` as sender
- [ ] Set up domain authentication (not just single sender)

#### 5. Aggressive but Safe Limits
| Day | Recommended Volume | Condition |
|-----|-------------------|-----------|
| 1-2 | 100/day | If domain authenticated |
| 3-5 | 250/day | If bounce < 3%, complaint < 0.1% |
| 6-10 | 500/day | If bounce < 2%, complaint < 0.05% |
| 11+ | 1000+/day | If metrics stay clean |

#### 6. Quality Signals That Help
- **Engagement**: Opens, clicks, replies → SendGrid sees these
- **Low Bounces**: Keep < 2% (clean your list!)
- **Low Complaints**: Keep < 0.1% (good unsubscribe process)
- **Consistent Volume**: Don't spike from 50 to 1000 in one day

### Environment Variables for Warmup Override

```bash
# Vercel / Railway
BYPASS_EMAIL_WARMUP=true          # Skip warmup checks entirely
EMAIL_DAILY_LIMIT=500             # Override default limit
EMAIL_RATE_LIMIT_PER_MIN=100      # Current: 100/min
```

### Quick Win: Use Railway's Existing Endpoints

Railway (`yardflow-hitlist`) already has:
- `/api/email/send` - Direct email sending
- `/api/email/bulk` - Batch sending with rate limiting
- `/api/email/stats` - Delivery metrics
- SendGrid integration with webhooks

**No need to rebuild** - just ensure domain auth is complete.

---

## Sender Identity Configuration (S38B)

### Senders to Configure
| Name | Email | Use Case |
|------|-------|----------|
| Jake | jake@freightroll.com | CEO outreach, high-value prospects |
| Casey | casey@freightroll.com | SDR outreach, bulk campaigns |
| Team | team@freightroll.com | Automated sequences, newsletters |

### SendGrid Sender Setup
1. Go to SendGrid → Settings → Sender Authentication
2. Add each sender email
3. Verify via email confirmation
4. Enable domain authentication for `freightroll.com`

---

## Rollback Plan

If Railway tone breaks:
```typescript
// Temporary backward compatibility in templateAdapter.ts
const map: Record<TemplateTone, RailwayTone | undefined> = {
  'freightroll': 'FREIGHTROLL',
  'luis': 'LUIS',  // Keep for backward compat until Railway updated
  // ...
};
```

---

## Verification Checklist

- [ ] AI Generate returns "FreightRoll" in content
- [ ] Brain assistant identifies as "FreightRoll Brain"
- [ ] Tone dropdown shows "FreightRoll Voice" (not "Luis")
- [ ] Templates use `{{senderName}}` variable
- [ ] Railway accepts `tone: 'freightroll'` in API calls
- [ ] SendGrid domain authentication complete
- [ ] Test email sends successfully from jake@freightroll.com

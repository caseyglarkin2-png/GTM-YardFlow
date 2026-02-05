# Sprint Plan V38: FreightRoll Rebrand, Dashboard Analytics & CaseyOS Integration

**Status**: 📋 QUEUED  
**Created**: February 5, 2026  
**Goal**: Rebrand all AI messaging to FreightRoll, fix dashboard analytics, integrate CaseyOS  
**Priority**: P0 (Manifest launch blocking)

---

## Executive Summary

### User Requirements
1. **Rebrand AI messaging**: Replace "YardFlow" → "FreightRoll", "Luis" → configurable sender (Jake/Casey/Team)
2. **Fix Dashboard Analytics**: Show email stats, sequence performance, template effectiveness
3. **Sender Identity**: Allow selection between Jake, Casey, or "The FreightRoll Team"
4. **Email Limits Documentation**: Surface warmup limits in UI
5. **CaseyOS Integration**: Connect to `https://web-production-a6ccf.up.railway.app/` for AI features
6. **Sprint E & F**: Tags/Filters/Search + Bulk Send UX from V35 queue

### Email Sending Limitations (Reference)

| Week | Daily Limit | Notes |
|------|-------------|-------|
| 1 | 50 | New sender warmup |
| 2 | 100 | Building reputation |
| 3 | 250 | Establishing pattern |
| 4 | 500 | Near full capacity |
| 5+ | Unlimited | Full sending rights |

**Additional Limits:**
- 100 requests/minute API rate limit
- Override: Set `BYPASS_EMAIL_WARMUP=true` in Vercel env vars

---

## Sprint Overview

| Sprint | Focus | Priority | Size | Demo |
|--------|-------|----------|------|------|
| **S38A** | FreightRoll Branding Swap | P0 | S | AI generates without "YardFlow"/"Luis" |
| **S38B** | Sender Identity Configuration | P0 | M | User selects Jake/Casey/Team |
| **S38C** | Dashboard Analytics Fix | P1 | M | Dashboard shows real email stats |
| **S38D** | ~~CaseyOS Integration~~ | P3 | L | ⏸️ DEFERRED - stick with innovative-ambition |
| **S38E** | Tags, Filters & Search | P1 | M | Filter prospects by tag |
| **S38F** | Bulk Send UX & Limits Display | P1 | M | See warmup limits + progress |

### Dependency Graph

```
S38A (Branding) ──► S38B (Sender) ──┐
                                    ├──► S38F (Bulk UX)
S38C (Dashboard) ──────────────────┘
                                    
S38E (Tags) ──► [Parallel, no deps]

S38D (CaseyOS) ──► [⏸️ DEFERRED - Est. 4-6 hours when needed]
```

### S38D Effort Estimate (Deferred)

If we ever need to migrate to a different Railway backend:
- **Discovery & API contract doc**: 1-2 hours
- **Feature flag + client creation**: 1-2 hours  
- **Proxy route updates**: 1-2 hours
- **Testing & validation**: 1 hour
- **Total**: ~4-6 hours

Currently sticking with **innovative-ambition** (yardflow-hitlist) which has all needed endpoints.

---

## S38A: FreightRoll Branding Swap [P0 - SMALL]

**Goal**: Replace all "YardFlow" and "Luis" references in AI generation  
**Demo**: AI generates email without mentioning "YardFlow" or "Luis"  
**Est. Time**: 1 hour

---

### T38A.1: Update AI Generate System Prompt [XS - 15 min]

**Files**: [api/ai/generate.ts](api/ai/generate.ts)

**Current** (Line 164):
```typescript
systemPrompt: 'You are an expert sales copywriter specializing in B2B cold outreach for yard management software. Generate compelling, personalized emails that get replies. Always respond with valid JSON.',
```

**Change to**:
```typescript
systemPrompt: 'You are an expert sales copywriter specializing in B2B cold outreach for FreightRoll, a freight and yard management platform. Generate compelling, personalized emails that get replies. Never mention "YardFlow" - always use "FreightRoll" as the product name. Always respond with valid JSON.',
```

**Validation**:
```bash
curl -X POST https://gtm-yard-flow.vercel.app/api/ai/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tone":"professional","prospectName":"Test","companyName":"Acme"}' | jq .
# Verify response doesn't contain "YardFlow"
```

**Tests**: Add assertion in `src/__tests__/api/ai-generate.test.ts`:
```typescript
it('system prompt contains FreightRoll not YardFlow', () => {
  const prompt = buildSystemPrompt();
  expect(prompt).toContain('FreightRoll');
  expect(prompt).not.toContain('YardFlow');
});
```

**Commit**: `fix(branding): replace YardFlow with FreightRoll in AI prompts`

---

### T38A.2: Update Brain System Prompt [S - 20 min]

**Files**: [src/config/brainSystemPrompt.ts](src/config/brainSystemPrompt.ts)

**Changes**:
| Line | Current | New |
|------|---------|-----|
| 2 | "Brain System Prompt - YardFlow GTM Hub" | "Brain System Prompt - FreightRoll GTM Hub" |
| 13 | "You are YardFlow Brain, an AI assistant..." | "You are FreightRoll Brain, an AI assistant..." |
| 17 | "**FreightRoll/YardFlow** is yard management..." | "**FreightRoll** is yard management..." |
| 166 | "You are YardFlow Brain, a sales AI assistant..." | "You are FreightRoll Brain, a sales AI assistant..." |

**Implementation**:
```typescript
// Line 13 - Replace
export const BRAIN_SYSTEM_PROMPT = `You are FreightRoll Brain, an AI assistant for sales prospecting and outreach at FreightRoll.

// Line 17 - Replace
**FreightRoll** is yard management software that helps logistics companies:
```

**Tests**: Snapshot test for prompt content
```typescript
// src/__tests__/config/brainSystemPrompt.test.ts
it('does not contain YardFlow brand', () => {
  expect(BRAIN_SYSTEM_PROMPT).not.toMatch(/YardFlow/);
  expect(BRAIN_SYSTEM_PROMPT).toContain('FreightRoll');
});
```

**Commit**: `fix(branding): update Brain system prompt to FreightRoll`

---

### T38A.3: Rename Luis Tone to FreightRoll Voice [S - 15 min]

**Files**: 
- [src/config/tones.ts](src/config/tones.ts)
- [src/components/BulkEmailModal.tsx](src/components/BulkEmailModal.tsx)
- [api/ai/generate.ts](api/ai/generate.ts)

**tones.ts Changes**:
```typescript
// Current
export type ToneId = 'luis' | 'professional' | 'challenger';

// New
export type ToneId = 'freightroll' | 'professional' | 'challenger';

// Current TONE_OPTIONS[0]
{
  id: 'luis',
  label: 'Luis Style',
  description: 'Short, punchy, metrics-driven (250 chars)',
  charLimit: 250,
},

// New
{
  id: 'freightroll',
  label: 'FreightRoll Voice',
  description: 'Short, punchy, metrics-driven (250 chars)',
  charLimit: 250,
},
```

**BulkEmailModal.tsx Changes** (Line 1158):
```tsx
// Current
<option value="luis">Luis</option>

// New
<option value="freightroll">FreightRoll Voice</option>
```

**api/ai/generate.ts Changes** (Line 23):
```typescript
// Current
export interface GenerateRequest {
  tone: 'luis' | 'professional' | 'challenger';

// New
export interface GenerateRequest {
  tone: 'freightroll' | 'professional' | 'challenger';
```

**Tests**:
```typescript
// src/__tests__/config/tones.test.ts
it('has freightroll tone instead of luis', () => {
  const toneIds = TONE_OPTIONS.map(t => t.id);
  expect(toneIds).toContain('freightroll');
  expect(toneIds).not.toContain('luis');
});
```

**Commit**: `fix(branding): rename luis tone to freightroll`

---

### T38A.4: Update Sequence Templates [S - 20 min]

**Files**: [src/data/sequenceTemplates.ts](src/data/sequenceTemplates.ts)

**Changes**:
1. Replace hardcoded "Jake" with `{{senderName}}` variable
2. Update template IDs and names referencing "Luis"
3. Keep Primo Brands case study (approved claim)

**Template Updates**:
```typescript
// Current (Line 7)
id: 'manifest-dm-luis',
name: 'DM: Luis Style (Short)',

// New
id: 'manifest-dm-freightroll',
name: 'DM: FreightRoll Voice (Short)',

// Current body (Line 17) - hardcoded Jake
bodyTemplate: `{{firstName}}, yard pilots going?... Worth 15 min? {{calendlyUrl}}`

// New - use senderName
bodyTemplate: `{{firstName}}, yard pilots going?... Worth 15 min? {{calendlyUrl}} -{{senderName}}`
```

**Update ALL templates** to use `{{senderName}}` instead of hardcoded "Jake":
- `manifest-dm-luis` → `manifest-dm-freightroll`
- `manifest-meeting-room` → Update "Jake" to `{{senderName}}`
- `manifest-co-dev` → Update "Jake" to `{{senderName}}`

**Tests**:
```typescript
// src/__tests__/data/sequenceTemplates.test.ts
it('all templates use senderName variable not hardcoded names', () => {
  const allTemplates = [...MANIFEST_DM_TEMPLATES, ...MANIFEST_SEQUENCES];
  allTemplates.forEach(template => {
    template.steps.forEach(step => {
      expect(step.bodyTemplate).not.toMatch(/\bJake\b/);
      expect(step.bodyTemplate).not.toMatch(/\bLuis\b/);
      // If template signs off with name, should use variable
      if (step.bodyTemplate.includes('-')) {
        expect(step.bodyTemplate).toContain('{{senderName}}');
      }
    });
  });
});
```

**Commit**: `fix(branding): update sequence templates to use senderName variable`

---

### T38A.5: Create Railway Migration Doc [XS - 10 min]

**Files**: Create `docs/RAILWAY_BRANDING_MIGRATION.md`

**Content**:
```markdown
# Railway Backend Branding Migration

## Required Changes in YardFlow-Hitlist Repo

The following changes need to be made in the Railway backend to match the FreightRoll rebrand:

### 1. Voice/Tone System Prompts
File: `src/config/voices.ts` (or equivalent)
- Rename `luis` voice configuration to `freightroll`
- Update system prompt to reference "FreightRoll" not "YardFlow"

### 2. Email Templates (if stored in Railway)
- Update any hardcoded "Jake" to use sender variable
- Remove "YardFlow" references

### 3. API Response Messages
- Search for "YardFlow" in error messages, update to "FreightRoll"

## Verification
After Railway changes:
\`\`\`bash
curl -X POST https://yardflow-hitlist-production-2f41.up.railway.app/api/ai/content/generate \
  -H "x-service-key: $SECRET" \
  -d '{"tone":"freightroll","prospectId":"test"}'
\`\`\`

Ensure response doesn't contain "YardFlow" or "Luis".
```

**Commit**: `docs: add Railway branding migration guide`

---

## S38B: Sender Identity Configuration [P0 - MEDIUM]

**Goal**: Allow flexible sender identity selection  
**Demo**: User selects sender before sending, email uses correct from address  
**Depends on**: S38A (tone rename must be done first)  
**Est. Time**: 2 hours

---

### T38B.1: Create Sender Config [XS - 10 min]

**Files**: Create `src/config/senders.ts`

**Implementation**:
```typescript
/**
 * Sender Identity Configuration
 * Sprint 38B: Configurable sender for outreach emails
 */

export interface Sender {
  id: string;
  name: string;
  email: string;
  calendlyUrl: string;
  signature: string;
}

export const SENDERS: Sender[] = [
  {
    id: 'jake',
    name: 'Jake',
    email: 'jake@freightroll.com',
    calendlyUrl: 'https://calendly.com/jake-freightroll/manifest-meeting',
    signature: 'Jake',
  },
  {
    id: 'casey',
    name: 'Casey',
    email: 'casey@freightroll.com',
    calendlyUrl: 'https://calendly.com/casey-freightroll/meeting',
    signature: 'Casey',
  },
  {
    id: 'team',
    name: 'The FreightRoll Team',
    email: 'team@freightroll.com',
    calendlyUrl: 'https://calendly.com/freightroll/meeting',
    signature: 'The FreightRoll Team',
  },
];

export const DEFAULT_SENDER = SENDERS[0]; // Jake

export function getSenderById(id: string): Sender | undefined {
  return SENDERS.find(s => s.id === id);
}

export function getSenderByEmail(email: string): Sender | undefined {
  return SENDERS.find(s => s.email === email);
}
```

**Tests**:
```typescript
// src/__tests__/config/senders.test.ts
describe('senders config', () => {
  it('exports valid senders array', () => {
    expect(SENDERS).toHaveLength(3);
    SENDERS.forEach(s => {
      expect(s.email).toMatch(/@freightroll\.com$/);
    });
  });

  it('getSenderById returns correct sender', () => {
    expect(getSenderById('jake')?.name).toBe('Jake');
    expect(getSenderById('invalid')).toBeUndefined();
  });
});
```

**Commit**: `feat(email): add sender identity configuration`

---

### T38B.2: Add Sender Selection to BulkEmailModal [S - 30 min]

**Files**: [src/components/BulkEmailModal.tsx](src/components/BulkEmailModal.tsx)

**Changes**:

1. Import senders config:
```typescript
import { SENDERS, DEFAULT_SENDER, type Sender } from '../config/senders';
```

2. Add state (near other useState calls):
```typescript
const [selectedSender, setSelectedSender] = useState<Sender>(DEFAULT_SENDER);
```

3. Add sender dropdown UI (in the header/controls area):
```tsx
{/* Sender Selection */}
<div className="flex items-center gap-2">
  <label htmlFor="sender-select" className="text-sm font-medium text-gray-700">
    From:
  </label>
  <select
    id="sender-select"
    value={selectedSender.id}
    onChange={(e) => {
      const sender = SENDERS.find(s => s.id === e.target.value);
      if (sender) setSelectedSender(sender);
    }}
    className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
    data-testid="sender-select"
  >
    {SENDERS.map(sender => (
      <option key={sender.id} value={sender.id}>
        {sender.name} ({sender.email})
      </option>
    ))}
  </select>
</div>
```

4. Update template personalization to use sender:
```typescript
// When personalizing template
const personalizedBody = personalizeTemplate(template.body, {
  ...prospect,
  senderName: selectedSender.signature,
  calendlyUrl: selectedSender.calendlyUrl,
});
```

**Tests**:
```typescript
// src/__tests__/components/BulkEmailModal.sender.test.tsx
describe('BulkEmailModal sender selection', () => {
  it('shows sender dropdown with all senders', () => {
    render(<BulkEmailModal {...defaultProps} />);
    const select = screen.getByTestId('sender-select');
    expect(select).toBeInTheDocument();
    expect(screen.getByText(/jake@freightroll\.com/i)).toBeInTheDocument();
  });

  it('defaults to Jake as sender', () => {
    render(<BulkEmailModal {...defaultProps} />);
    const select = screen.getByTestId('sender-select') as HTMLSelectElement;
    expect(select.value).toBe('jake');
  });

  it('updates sender when selection changes', async () => {
    render(<BulkEmailModal {...defaultProps} />);
    await userEvent.selectOptions(screen.getByTestId('sender-select'), 'casey');
    expect(screen.getByText(/casey@freightroll\.com/i)).toBeInTheDocument();
  });
});
```

**Commit**: `feat(email): add sender selection to BulkEmailModal`

---

### T38B.3: Wire Sender to useBulkEmailSend Hook [M - 40 min]

**Files**: 
- [src/hooks/useBulkEmailSend.ts](src/hooks/useBulkEmailSend.ts)
- [api/email/send.ts](api/email/send.ts)

**Hook Changes**:
```typescript
// Add sender to initRecipients params
function initRecipients(
  prospects: Prospect[],
  subject: string,
  body: string,
  sender?: Sender  // NEW
): void {
  // Store sender for use in sendRecipient
  senderRef.current = sender || DEFAULT_SENDER;
}

// Update sendRecipient to include from field
async function sendRecipient(recipientId: string): Promise<void> {
  // ... existing code ...
  const response = await fetch('/api/email/send', {
    method: 'POST',
    headers: { /* ... */ },
    body: JSON.stringify({
      to: recipient.prospect.email,
      subject: recipient.subject,
      text: recipient.body,
      html: recipient.body,
      from: senderRef.current?.email,  // NEW
      senderName: senderRef.current?.name,  // NEW
      replyTo: senderRef.current?.email,  // NEW
    }),
  });
}
```

**API Changes** (api/email/send.ts):
```typescript
// Update schema to accept from field
const emailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  text: z.string().min(1),
  html: z.string().optional(),
  from: z.string().email().optional(),  // NEW
  senderName: z.string().optional(),    // NEW
  replyTo: z.string().email().optional(), // NEW
});

// Use in SendGrid call
const msg = {
  to: email.to,
  from: email.from || process.env.SENDGRID_FROM_EMAIL || 'team@freightroll.com',
  replyTo: email.replyTo || email.from,
  subject: email.subject,
  text: email.text,
  html: email.html,
};
```

**Tests**:
```typescript
// src/__tests__/hooks/useBulkEmailSend.sender.test.ts
describe('useBulkEmailSend with sender', () => {
  it('includes from field in API request', async () => {
    const mockFetch = vi.spyOn(global, 'fetch');
    const { result } = renderHook(() => useBulkEmailSend());
    
    const sender = { id: 'casey', name: 'Casey', email: 'casey@freightroll.com' };
    act(() => result.current.initRecipients(mockProspects, 'Sub', 'Body', sender));
    await act(async () => result.current.sendRecipient('p1'));
    
    expect(mockFetch).toHaveBeenCalledWith('/api/email/send', expect.objectContaining({
      body: expect.stringContaining('casey@freightroll.com'),
    }));
  });
});
```

**Commit**: `feat(email): wire sender identity to email send flow`

---

### T38B.4: Verify SendGrid Sender Authentication [XS - 10 min]

**Files**: `docs/SENDER_SETUP.md` (create)

**Content**:
```markdown
# Sender Email Setup

## Required SendGrid Configuration

All sender emails must be authenticated in SendGrid:

1. **jake@freightroll.com** - ✅ Verify status
2. **casey@freightroll.com** - ✅ Verify status  
3. **team@freightroll.com** - ✅ Verify status

### Verification Steps

1. Go to SendGrid Dashboard → Settings → Sender Authentication
2. Verify domain: `freightroll.com`
3. Add each sender email as Single Sender if domain not verified

### Testing

\`\`\`bash
# Test each sender
for email in jake casey team; do
  curl -X POST https://api.sendgrid.com/v3/mail/send \
    -H "Authorization: Bearer $SENDGRID_API_KEY" \
    -d '{
      "from": {"email": "'$email'@freightroll.com"},
      "to": [{"email": "test@example.com"}],
      "subject": "Test",
      "content": [{"type": "text/plain", "value": "Test"}]
    }'
done
\`\`\`
```

**Commit**: `docs: add sender email setup guide`

---

## S38C: Dashboard Analytics Fix [P1 - MEDIUM]

**Goal**: Show working email/sequence/template analytics on dashboard  
**Demo**: Dashboard displays real sent counts, open rates, reply rates  
**Est. Time**: 3 hours

---

### T38C.1: Verify/Fix /api/email/stats Endpoint [M - 45 min]

**Files**: [api/email/stats.ts](api/email/stats.ts)

**Current State**: Endpoint exists but may return errors or empty data

**Required Response Schema**:
```typescript
interface EmailStatsResponse {
  success: boolean;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    replied: number;
    openRate: number;  // 0-100
    clickRate: number; // 0-100
    replyRate: number; // 0-100
    bounceRate: number; // 0-100
  };
  period: {
    start: string; // ISO date
    end: string;   // ISO date
  };
  byDay?: Array<{
    date: string;
    sent: number;
    opened: number;
  }>;
}
```

**Implementation**:
```typescript
// api/email/stats.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../lib/firebaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Health check mode (no auth required)
  if (req.query.health === 'true') {
    return res.json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  // Period from query (default: last 7 days)
  const days = parseInt(req.query.days as string) || 7;
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  try {
    const db = getAdminDb();
    const eventsRef = db.collection('email_events');
    
    // Query events in period
    const snapshot = await eventsRef
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<=', endDate)
      .get();

    const events = snapshot.docs.map(d => d.data());
    
    // Aggregate stats
    const stats = {
      sent: events.filter(e => e.type === 'sent').length,
      delivered: events.filter(e => e.type === 'delivered').length,
      opened: events.filter(e => e.type === 'open').length,
      clicked: events.filter(e => e.type === 'click').length,
      bounced: events.filter(e => e.type === 'bounce').length,
      replied: events.filter(e => e.type === 'reply').length,
    };

    const delivered = stats.delivered || 1; // Avoid division by zero
    const calculated = {
      ...stats,
      openRate: Math.round((stats.opened / delivered) * 100),
      clickRate: Math.round((stats.clicked / delivered) * 100),
      replyRate: Math.round((stats.replied / delivered) * 100),
      bounceRate: Math.round((stats.bounced / stats.sent || 1) * 100),
    };

    return res.json({
      success: true,
      stats: calculated,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Email Stats] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch stats',
    });
  }
}
```

**Validation**:
```bash
curl -s https://gtm-yard-flow.vercel.app/api/email/stats?health=true
# Should return: {"status":"ok","timestamp":"..."}

curl -s https://gtm-yard-flow.vercel.app/api/email/stats?days=7 \
  -H "Authorization: Bearer $TOKEN" | jq .
# Should return stats object
```

**Tests**:
```typescript
// src/__tests__/api/email-stats.test.ts
describe('/api/email/stats', () => {
  it('returns health check without auth', async () => {
    const res = await handler(mockReq({ query: { health: 'true' } }), mockRes);
    expect(res.status).toBe(200);
  });

  it('returns stats with valid period', async () => {
    const res = await handler(mockReq({ query: { days: '7' } }), mockRes);
    expect(res.json).toHaveProperty('stats.sent');
    expect(res.json).toHaveProperty('stats.openRate');
  });
});
```

**Commit**: `fix(api): ensure email stats endpoint returns valid data`

---

### T38C.2: Create useEmailStats Hook [S - 30 min]

**Files**: Create `src/hooks/useEmailStats.ts`

**Implementation**:
```typescript
/**
 * Email Statistics Hook
 * Sprint 38C: Dashboard analytics
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export interface EmailStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  replied: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

export interface UseEmailStatsOptions {
  days?: number;
  refreshInterval?: number; // ms
}

export function useEmailStats(options: UseEmailStatsOptions = {}) {
  const { days = 7, refreshInterval = 60000 } = options;
  const { getIdToken } = useAuth();
  
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = await getIdToken();
      const response = await fetch(`/api/email/stats?days=${days}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setIsLoading(false);
    }
  }, [days, getIdToken]);

  useEffect(() => {
    fetchStats();
    
    if (refreshInterval > 0) {
      const interval = setInterval(fetchStats, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchStats, refreshInterval]);

  return { stats, isLoading, error, refresh: fetchStats };
}
```

**Tests**:
```typescript
// src/__tests__/hooks/useEmailStats.test.ts
describe('useEmailStats', () => {
  it('fetches stats on mount', async () => {
    const { result } = renderHook(() => useEmailStats());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stats).toBeDefined();
  });

  it('auto-refreshes at interval', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useEmailStats({ refreshInterval: 1000 }));
    
    await waitFor(() => expect(result.current.stats).toBeDefined());
    const initialStats = result.current.stats;
    
    vi.advanceTimersByTime(1000);
    // Would fetch again
    vi.useRealTimers();
  });
});
```

**Commit**: `feat(hooks): add useEmailStats hook for dashboard`

---

### T38C.3: Create Email Stats Widget [M - 45 min]

**Files**: Create `src/components/analytics/EmailStatsWidget.tsx`

**Implementation**:
```tsx
/**
 * Email Statistics Widget
 * Sprint 38C: Dashboard analytics card
 */
import { useEmailStats } from '../../hooks/useEmailStats';
import { LazyIcon } from '../icons';

interface EmailStatsWidgetProps {
  days?: number;
  className?: string;
}

export function EmailStatsWidget({ days = 7, className = '' }: EmailStatsWidgetProps) {
  const { stats, isLoading, error, refresh } = useEmailStats({ days });

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`} data-testid="email-stats-widget">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Email Performance</h3>
          <button onClick={refresh} className="text-blue-600 hover:text-blue-700 text-sm">
            Retry
          </button>
        </div>
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`} data-testid="email-stats-widget">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Email Performance</h3>
        <span className="text-sm text-gray-500">Last {days} days</span>
      </div>

      {isLoading && !stats ? (
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      ) : stats ? (
        <>
          {/* Primary metric */}
          <div className="mb-6">
            <div className="text-3xl font-bold text-gray-900">{stats.sent}</div>
            <div className="text-sm text-gray-500">Emails Sent</div>
          </div>

          {/* Rate cards */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Open Rate"
              value={`${stats.openRate}%`}
              subtext={`${stats.opened} opened`}
              color="blue"
            />
            <StatCard
              label="Click Rate"
              value={`${stats.clickRate}%`}
              subtext={`${stats.clicked} clicked`}
              color="green"
            />
            <StatCard
              label="Reply Rate"
              value={`${stats.replyRate}%`}
              subtext={`${stats.replied} replies`}
              color="purple"
            />
            <StatCard
              label="Bounce Rate"
              value={`${stats.bounceRate}%`}
              subtext={`${stats.bounced} bounced`}
              color={stats.bounceRate > 5 ? 'red' : 'gray'}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  subtext, 
  color 
}: { 
  label: string; 
  value: string; 
  subtext: string; 
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
    red: 'text-red-600 bg-red-50',
    gray: 'text-gray-600 bg-gray-50',
  };

  return (
    <div className={`p-4 rounded-lg ${colorClasses[color] || colorClasses.gray}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs opacity-75">{subtext}</div>
    </div>
  );
}
```

**Tests**:
```typescript
// src/__tests__/components/analytics/EmailStatsWidget.test.tsx
describe('EmailStatsWidget', () => {
  it('shows loading skeleton initially', () => {
    render(<EmailStatsWidget />);
    expect(screen.getByTestId('email-stats-widget')).toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('displays stats after loading', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        stats: { sent: 100, openRate: 45, clickRate: 12, replyRate: 8, bounceRate: 2 },
      }),
    });

    render(<EmailStatsWidget />);
    await waitFor(() => expect(screen.getByText('100')).toBeInTheDocument());
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('shows error state with retry button', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    
    render(<EmailStatsWidget />);
    await waitFor(() => expect(screen.getByText(/retry/i)).toBeInTheDocument());
  });
});
```

**Commit**: `feat(dashboard): add EmailStatsWidget component`

---

### T38C.4: Wire Dashboard Panel [M - 30 min]

**Files**: 
- Create or update `src/components/panels/DashboardPanel.tsx`
- Update `src/App.tsx` to use it

**Implementation**:
```tsx
/**
 * Dashboard Panel
 * Sprint 38C: Main dashboard with analytics widgets
 */
import { EmailStatsWidget } from '../analytics/EmailStatsWidget';
import { MeetingsKPICard } from '../MeetingsKPICard';
import { EmailQueueStatus } from '../EmailQueueStatus';

interface DashboardPanelProps {
  className?: string;
}

export function DashboardPanel({ className = '' }: DashboardPanelProps) {
  return (
    <div className={`p-6 space-y-6 ${className}`} data-testid="dashboard-panel">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <span className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </span>
      </header>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MeetingsKPICard />
        <EmailQueueStatus />
        {/* Placeholder for sequence stats */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Active Sequences</h3>
          <div className="text-3xl font-bold text-gray-900">--</div>
          <div className="text-sm text-gray-500">Coming soon</div>
        </div>
      </div>

      {/* Email Performance */}
      <EmailStatsWidget days={7} />

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickActionButton label="Send Bulk Email" icon="Mail" />
          <QuickActionButton label="Import Prospects" icon="Upload" />
          <QuickActionButton label="View Sequences" icon="GitBranch" />
          <QuickActionButton label="AI Research" icon="Brain" />
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({ label, icon }: { label: string; icon: string }) {
  return (
    <button className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
      <span className="text-blue-600">{/* Icon would go here */}</span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </button>
  );
}
```

**Commit**: `feat(dashboard): create DashboardPanel with analytics widgets`

---

## S38D: CaseyOS Railway Integration [P2 - LARGE] ⚠️ BLOCKED

**Goal**: Connect AI features to CaseyOS Railway app  
**Demo**: AI chat uses `https://web-production-a6ccf.up.railway.app/`  
**Status**: **BLOCKED** - Needs API contract from CaseyOS  
**Est. Time**: 4 hours (once unblocked)

### ⚠️ Blocking Questions

Before starting this sprint, need answers to:

1. **What is the CaseyOS API contract?**
   - What endpoints exist at `https://web-production-a6ccf.up.railway.app/`?
   - What authentication method does it use?
   - What request/response formats?

2. **Is this a replacement or addition?**
   - Replace existing Railway (yardflow-hitlist)?
   - Or add as additional AI provider?

3. **What features move to CaseyOS?**
   - AI chat only?
   - Email sending?
   - All backend features?

### T38D.1: Document CaseyOS API Contract [M - 60 min]

**Files**: Create `docs/api/CASEYOS_API_CONTRACT.md`

**Blocked**: Need to inspect the CaseyOS Railway app first

```bash
# Discovery commands to run once access confirmed
curl -s https://web-production-a6ccf.up.railway.app/api/health
curl -s https://web-production-a6ccf.up.railway.app/api/docs
curl -s https://web-production-a6ccf.up.railway.app/openapi.json
```

---

### T38D.2: Add CaseyOS Feature Flag [XS]

**Files**: `src/config/featureFlags.ts`

```typescript
// Add to featureFlags.ts
export const CASEYOS_ENABLED = 
  import.meta.env.VITE_CASEYOS_ENABLED === 'true';

export const CASEYOS_API_URL = 
  import.meta.env.VITE_CASEYOS_API_URL || 
  'https://web-production-a6ccf.up.railway.app';
```

---

### T38D.3: Create CaseyOS API Client [M]

**Files**: Create `src/services/CaseyOSClient.ts`

**Blocked**: Need API contract first

---

### T38D.4: Update AI Proxy Routes [M]

**Files**: `api/ai/chat.ts`, `api/ai/research.ts`

**Blocked**: Need to understand CaseyOS endpoints

---

## S38E: Tags, Filters & Search [P1 - MEDIUM]

**Goal**: Enable filtering prospects by tags  
**Demo**: Create tag, assign to prospects, filter by tag  
**Est. Time**: 2.5 hours

(Ported from V35 Sprint E - see SPRINT_PLAN_V35_UI_UX_GATE.md for full details)

---

### T38E.1: Tag Data Model [S - 20 min]

**Files**: 
- `src/types/index.ts` - Add Tag type
- `src/services/TagService.ts` - CRUD operations

```typescript
// types/index.ts
export interface Tag {
  id: string;
  name: string;
  color: string; // hex color
  createdAt: Date;
  prospectCount: number;
}

// services/TagService.ts
export class TagService {
  async createTag(name: string, color: string): Promise<Tag>;
  async deleteTag(id: string): Promise<void>;
  async assignTag(tagId: string, prospectIds: string[]): Promise<void>;
  async removeTag(tagId: string, prospectId: string): Promise<void>;
  async getProspectsByTag(tagId: string): Promise<Prospect[]>;
}
```

---

### T38E.2: Tag Filter UI [M - 40 min]

**Files**: `src/components/filters/TagFilter.tsx`

**Implementation**: Multi-select dropdown with color indicators

---

### T38E.3: Tag Management Modal [M - 40 min]

**Files**: `src/components/TagManagementModal.tsx`

**Features**:
- Create new tag with name + color picker
- Edit existing tags
- Delete tags (with confirmation)
- Show prospect counts

---

### T38E.4: Tag Assignment in Bulk Actions [S - 30 min]

**Files**: `src/components/BulkActionsBar.tsx`

**Changes**:
- Add "Tag Selected" action
- Tag selection dropdown
- Bulk assign to selected prospects

---

## S38F: Bulk Send UX & Limits Display [P1 - MEDIUM]

**Goal**: Show warmup limits and improve bulk send progress UX  
**Demo**: User sees "Week 1: 45/50 sent today" and progress during bulk send  
**Depends on**: S38C (needs stats endpoint)  
**Est. Time**: 2.5 hours

---

### T38F.1: Create useWarmupStatus Hook [S - 30 min]

**Files**: Create `src/hooks/useWarmupStatus.ts`

```typescript
export interface WarmupStatus {
  week: number;
  dailyLimit: number;
  sentToday: number;
  remaining: number;
  canSend: boolean;
  resetsAt: Date;
}

export function useWarmupStatus() {
  const [status, setStatus] = useState<WarmupStatus | null>(null);
  
  // Fetch from /api/warmup/status or calculate from email_warmup_state
  // ...
  
  return { status, isLoading, refresh };
}
```

---

### T38F.2: Add Warmup Status to BulkEmailModal [M - 45 min]

**Files**: `src/components/BulkEmailModal.tsx`

**Changes**:
- Show warmup status banner at top
- Disable send if over limit
- Show "X of Y remaining today"

```tsx
{warmupStatus && (
  <div className={`p-3 rounded-lg mb-4 ${
    warmupStatus.remaining > 0 ? 'bg-blue-50' : 'bg-yellow-50'
  }`}>
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">
        Week {warmupStatus.week} Warmup: {warmupStatus.remaining} of {warmupStatus.dailyLimit} remaining today
      </span>
      {warmupStatus.remaining === 0 && (
        <span className="text-xs text-yellow-700">
          Resets at {warmupStatus.resetsAt.toLocaleTimeString()}
        </span>
      )}
    </div>
    {/* Progress bar */}
    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
      <div 
        className="h-full bg-blue-600 transition-all"
        style={{ width: `${(warmupStatus.sentToday / warmupStatus.dailyLimit) * 100}%` }}
      />
    </div>
  </div>
)}
```

---

### T38F.3: Improve Bulk Send Progress UI [M - 45 min]

**Files**: `src/components/BulkEmailModal.tsx`

**Changes**:
- Per-recipient status icons (pending/sending/sent/failed)
- Overall progress bar
- Time estimate
- Pause/Resume capability

```tsx
{/* During send */}
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <span>Sending {progress.current} of {progress.total}</span>
    <span>{progress.successCount} sent, {progress.failedCount} failed</span>
  </div>
  <ProgressBar value={progress.current} max={progress.total} />
  <div className="text-xs text-gray-500">
    Estimated time remaining: {estimateTimeRemaining(progress)}
  </div>
</div>
```

---

### T38F.4: Rate Limit Warning Dialog [S - 20 min]

**Files**: Create `src/components/RateLimitWarning.tsx`

**Implementation**: Modal shown when attempting to send more than remaining limit

```tsx
export function RateLimitWarning({ 
  requested, 
  available, 
  onProceed, 
  onCancel 
}: RateLimitWarningProps) {
  return (
    <Modal>
      <h2>Daily Limit Warning</h2>
      <p>
        You're trying to send {requested} emails, but only {available} remain today.
      </p>
      <p className="text-sm text-gray-500">
        Limit resets at midnight. You can bypass this limit in settings.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => onProceed(available)}>
          Send {available} Now
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
```

---

## Verification Checklist

### S38A: Branding (After completion)
- [ ] `npm run build` succeeds
- [ ] AI generation returns "FreightRoll" not "YardFlow"
- [ ] Tone dropdown shows "FreightRoll Voice" not "Luis"
- [ ] All templates use `{{senderName}}` variable

### S38B: Sender (After completion)
- [ ] Sender dropdown appears in BulkEmailModal
- [ ] Email sends use selected sender's email
- [ ] SendGrid accepts all 3 sender emails

### S38C: Dashboard (After completion)
- [ ] `/api/email/stats` returns valid data
- [ ] Dashboard shows real email counts
- [ ] Stats auto-refresh every 60s
- [ ] Error states show retry option

### S38E: Tags (After completion)
- [ ] Can create/edit/delete tags
- [ ] Can assign tags to prospects
- [ ] Tag filter works in HitList

### S38F: Bulk UX (After completion)
- [ ] Warmup status shows in modal
- [ ] Progress bar during send
- [ ] Warning when over limit

---

## Files Modified Summary

| Sprint | Files Created | Files Modified |
|--------|---------------|----------------|
| S38A | 1 (migration doc) | 4 (prompts, tones, modal, templates) |
| S38B | 2 (senders.ts, setup doc) | 3 (modal, hook, API) |
| S38C | 3 (hook, widget, panel) | 1 (API endpoint) |
| S38D | 3 (contract, client, flags) | 2 (AI routes) |
| S38E | 3 (types, service, components) | 2 (bulk actions, filters) |
| S38F | 2 (hook, warning) | 1 (modal) |

---

## Next Steps

1. **Immediate**: Start S38A (branding) - no dependencies
2. **Parallel**: S38C (dashboard) can run alongside S38A
3. **After S38A**: S38B (sender configuration)
4. **After S38C**: S38F (bulk UX needs stats endpoint)
5. **Blocked**: S38D (CaseyOS) - needs API contract

## Questions for Product

1. **CaseyOS**: What's the API contract? Can you share endpoint documentation?
2. **Sender emails**: Are all 3 (jake@, casey@, team@) verified in SendGrid?
3. **Calendly URLs**: What are Casey's and team's Calendly URLs?
4. **Dashboard priority**: Which metrics matter most? Open rate? Reply rate? Meetings?

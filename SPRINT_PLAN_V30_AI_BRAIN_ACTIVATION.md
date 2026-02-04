# Sprint Plan V30: AI Brain Activation

**Status**: 🚀 ACTIVE  
**Created**: February 2026  
**Goal**: Activate Brain AI chat, AI Research, and enable smart prospecting with account dossiers  
**North Star**: "The brain controls the limbs of the app" - AI can navigate, filter, research, and act

---

## Executive Summary

### Current State
- ✅ `/api/ai/chat.ts` exists - proxies to Gemini for Brain
- ✅ `/api/ai/generate.ts` exists - proxies to Railway for content generation
- ✅ CompanyResearchService exists with mock fallback
- ✅ BulkEmailModal exists and is wired up
- ⚠️ Brain shows "Error connecting to AI service" - needs `GEMINI_API_KEY` in Vercel
- ⚠️ AI Research in mock mode - needs `VITE_GEMINI_API_KEY` for client-side

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GTM-YardFlow (Vercel)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ ChatPanel   │───▶│/api/ai/chat  │───▶│ Gemini 1.5 Flash     │   │
│  │ (Brain UI)  │    │ (Proxy)      │    │ (GEMINI_API_KEY)     │   │
│  └─────────────┘    └──────────────┘    └──────────────────────┘   │
│                                                                     │
│  ┌─────────────┐    ┌──────────────────────────────────────────┐   │
│  │ AI Research │───▶│ CompanyResearchService.ts                │   │
│  │ Button      │    │ (VITE_GEMINI_API_KEY - Client-side)      │   │
│  └─────────────┘    └──────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │ Content Gen │───▶│/api/ai/      │───▶│ Railway Backend      │   │
│  │ (Bulk Email)│    │generate      │    │ (Gemini→OpenAI)      │   │
│  └─────────────┘    └──────────────┘    └──────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables Checklist

### Vercel Dashboard Configuration

| Variable | Scope | Purpose | Status |
|----------|-------|---------|--------|
| `GEMINI_API_KEY` | All | Server-side Brain chat | ⚠️ Verify |
| `VITE_GEMINI_API_KEY` | All | Client-side AI Research | ❌ Missing |
| `OPENAI_API_KEY` | All | Fallback (future) | ⚠️ Verify |
| `RAILWAY_API_URL` | All | Content generation proxy | ✅ |
| `RAILWAY_API_SECRET` | All | S2S auth | ✅ |

**Action**: Add `VITE_GEMINI_API_KEY` with same value as `GEMINI_API_KEY`.

---

## Sprint Overview

| Sprint | Focus | Est. Time | Demo |
|--------|-------|-----------|------|
| **B0** | Environment Fix | 30 min | Brain responds, Research works |
| **B1** | Brain System Prompt | 1 hour | Brain understands app context |
| **B2** | Brain Actions | 3 hours | Brain can navigate/filter/act |
| **B3** | Account Dossiers | 2 hours | Rich company research view |
| **B4** | Bulk Email Verify | 1 hour | Send 50 emails via UI |

**Total**: ~7.5 hours

---

## Sprint B0: Environment Fix (30 min)

**Goal**: Both Brain and AI Research work with real Gemini  
**Demo**: Brain responds to "Hello", AI Research enriches a company

### B0.1: Add VITE_GEMINI_API_KEY to Vercel [5 min]

**Task**: Add client-side API key to Vercel dashboard.

**Steps**:
1. Go to Vercel Dashboard → GTM-YardFlow → Settings → Environment Variables
2. Add new variable:
   - Key: `VITE_GEMINI_API_KEY`
   - Value: (same as GEMINI_API_KEY)
   - Environments: All (Production, Preview, Development)
3. Click "Save"
4. Redeploy: `vercel --prod`

**Exit Criteria**: Variable appears in Vercel dashboard.

---

### B0.2: Verify GEMINI_API_KEY Scope [5 min]

**Task**: Confirm server-side key is available in Production.

**Steps**:
1. In Vercel Dashboard → Environment Variables
2. Find `GEMINI_API_KEY`
3. Verify "Production" checkbox is enabled
4. If not, edit and enable Production scope

**Exit Criteria**: GEMINI_API_KEY shows Production scope.

---

### B0.3: Redeploy to Production [5 min]

**Task**: Redeploy after env var changes.

**Command**:
```bash
cd /workspaces/GTM-YardFlow
npx vercel --prod
```

**Exit Criteria**: Deployment completes successfully.

---

### B0.4: Test Brain Chat [5 min]

**Task**: Verify Brain responds.

**Steps**:
1. Open https://gtm-yard-flow.vercel.app
2. Click Brain icon (bottom right)
3. Type "Hello, what can you help me with?"
4. Verify response (not "Error connecting to AI service")

**Exit Criteria**: Brain responds with helpful message.

---

### B0.5: Test AI Research [5 min]

**Task**: Verify AI Research works.

**Steps**:
1. Switch to Company View (toggle in toolbar)
2. Find a company with "AI Research" button
3. Click button
4. Verify toast shows "Researching..." then "Research Complete"

**Exit Criteria**: Company shows enriched data (facilities, industry).

---

### B0.6: Verify Bulk Email Button [5 min]

**Task**: Confirm bulk email UI is accessible.

**Steps**:
1. Select 2+ prospects with emails
2. Look for bulk action toolbar
3. Click "Email" button
4. Verify modal opens with compose form

**Exit Criteria**: BulkEmailModal opens with selected prospects count.

---

## Sprint B1: Brain System Prompt (1 hour)

**Goal**: Brain understands YardFlow context and can provide relevant help  
**Demo**: Brain explains tiers, suggests actions, knows the product

### B1.1: Create Rich System Prompt [30 min]

**Task**: Define comprehensive system prompt for Brain.

**Files**: `src/config/brainSystemPrompt.ts`

**Implementation**:
```typescript
export const BRAIN_SYSTEM_PROMPT = `You are YardFlow Brain, an AI assistant for sales prospecting and outreach.

## Context
YardFlow is a sales automation platform for yard management software. Users:
- Import prospect lists (companies and contacts)
- Research companies with AI to score fit
- Build email sequences for outreach
- Track opens, clicks, and replies
- Book meetings (Calendly integration)

## Prospect Tiers
- **Tier 1**: High priority - large fleets, multiple facilities, yard-intensive operations
- **Tier 2**: Medium priority - mid-size operations, some yard complexity
- **Tier 3**: Lower priority - smaller operations, less urgent need

## What You Can Help With
1. **Navigate**: "Show me Tier 1 prospects" → guide to filter
2. **Research**: "Tell me about Acme Trucking" → company research
3. **Analyze**: "Who should I contact first?" → prioritization advice
4. **Draft**: "Write an email to a VP of Operations" → content help
5. **Explain**: "How does the Primo score work?" → feature education

## Tone
Be concise, actionable, and sales-focused. Users are busy - get to the point.

## Current Data Available
You don't have direct access to the prospect database, but you can:
- Guide users to use filters and views
- Explain how features work
- Help draft outreach content
- Answer questions about sales strategy
`;
```

**Exit Criteria**: System prompt defined and exported.

---

### B1.2: Wire System Prompt to ChatPanel [15 min]

**Task**: Use system prompt in chat API calls.

**Files**: `src/components/panels/ChatPanel.tsx`

**Implementation**:
```typescript
import { BRAIN_SYSTEM_PROMPT } from '@/config/brainSystemPrompt';

// In sendMessage function:
const response = await fetch('/api/ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: messages,
    systemInstruction: {
      parts: [{ text: BRAIN_SYSTEM_PROMPT }],
    },
  }),
});
```

**Exit Criteria**: Chat sends system prompt.

---

### B1.3: Test Contextual Responses [15 min]

**Task**: Verify Brain understands context.

**Test Cases**:
1. "What are the prospect tiers?" → Explains T1/T2/T3
2. "How do I send bulk email?" → Explains select + email button
3. "Write a cold email for a logistics VP" → Generates relevant content

**Exit Criteria**: Brain provides contextual, accurate responses.

---

## Sprint B2: Brain Actions (3 hours)

**Goal**: Brain can navigate app and trigger actions  
**Demo**: "Show me Tier 1 prospects without emails" → app filters accordingly

### B2.1: Define Action Schema [30 min]

**Task**: Create typed action interface for Brain commands.

**Files**: `src/types/brainActions.ts`

**Implementation**:
```typescript
export type BrainAction = 
  | { type: 'navigate'; tab: 'prospects' | 'sequences' | 'import' | 'dashboard' }
  | { type: 'filter'; tier?: 'Tier 1' | 'Tier 2' | 'Tier 3'; hasEmail?: boolean }
  | { type: 'search'; query: string }
  | { type: 'select'; prospectIds: string[] }
  | { type: 'research'; companyName: string }
  | { type: 'explain'; topic: string };

export interface BrainResponse {
  message: string;
  action?: BrainAction;
}
```

**Exit Criteria**: Action types defined.

---

### B2.2: Add Function Calling to System Prompt [30 min]

**Task**: Enable Gemini function calling for structured actions.

**Files**: `src/config/brainSystemPrompt.ts`, `api/ai/chat.ts`

**Implementation**:
```typescript
// Add to system prompt
export const BRAIN_FUNCTIONS = [
  {
    name: 'navigate',
    description: 'Navigate to a specific tab in the app',
    parameters: {
      type: 'object',
      properties: {
        tab: { type: 'string', enum: ['prospects', 'sequences', 'import', 'dashboard'] },
      },
      required: ['tab'],
    },
  },
  {
    name: 'filter',
    description: 'Apply filters to the prospect list',
    parameters: {
      type: 'object',
      properties: {
        tier: { type: 'string', enum: ['Tier 1', 'Tier 2', 'Tier 3'] },
        hasEmail: { type: 'boolean' },
      },
    },
  },
  // ... more functions
];
```

**Exit Criteria**: Functions defined and sent to Gemini.

---

### B2.3: Create Action Dispatcher [45 min]

**Task**: Execute actions returned by Brain in the UI.

**Files**: `src/hooks/useBrainActions.ts`

**Implementation**:
```typescript
export function useBrainActions({ 
  setActiveTab, 
  setTierFilter, 
  setEmailFilter,
  setFilter,
  handleCompanyResearch,
}: BrainActionHandlers) {
  
  const dispatch = useCallback((action: BrainAction) => {
    switch (action.type) {
      case 'navigate':
        setActiveTab(action.tab);
        break;
      case 'filter':
        if (action.tier) setTierFilter(action.tier);
        if (action.hasEmail !== undefined) {
          setEmailFilter(action.hasEmail ? 'has_email' : 'no_email');
        }
        break;
      case 'search':
        setFilter(action.query);
        break;
      case 'research':
        // Find company and trigger research
        handleCompanyResearch({ company: action.companyName } as CompanyRow);
        break;
    }
  }, [setActiveTab, setTierFilter, setEmailFilter, setFilter, handleCompanyResearch]);

  return { dispatch };
}
```

**Exit Criteria**: Actions execute in UI.

---

### B2.4: Wire ChatPanel to Actions [45 min]

**Task**: Parse Brain responses and dispatch actions.

**Files**: `src/components/panels/ChatPanel.tsx`

**Implementation**:
```typescript
const { dispatch } = useBrainActions({
  setActiveTab,
  setTierFilter,
  setEmailFilter,
  setFilter,
  handleCompanyResearch,
});

// After receiving response
if (response.action) {
  dispatch(response.action);
  // Optionally show toast: "Navigating to Tier 1 prospects..."
}
```

**Exit Criteria**: Brain actions execute automatically.

---

### B2.5: Add Action Confirmation UI [30 min]

**Task**: Show user what action Brain will take before executing.

**Files**: `src/components/panels/ChatPanel.tsx`

**Implementation**:
```tsx
// Add action preview before execution
{pendingAction && (
  <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
    <span>Brain wants to: {describeAction(pendingAction)}</span>
    <button onClick={() => executeAction(pendingAction)}>Confirm</button>
    <button onClick={() => setPendingAction(null)}>Cancel</button>
  </div>
)}
```

**Exit Criteria**: User confirms actions before execution.

---

## Sprint B3: Account Dossiers (2 hours)

**Goal**: Rich company research view with AI-generated insights  
**Demo**: Click company → see facilities, industry, key contacts, talking points

### B3.1: Enhance Research Response [30 min]

**Task**: Add more fields to research output.

**Files**: `src/services/CompanyResearchService.ts`

**Add Fields**:
- `talkingPoints: string[]` - Pain points to mention
- `competitors: string[]` - Who they might compare to
- `recentNews: string[]` - Recent company news
- `decisionMakers: string[]` - Likely titles to target

**Exit Criteria**: Research returns richer data.

---

### B3.2: Create DossierPanel Component [45 min]

**Task**: Display account dossier in a dedicated panel.

**Files**: `src/components/panels/DossierPanel.tsx`

**Implementation**:
```tsx
export function DossierPanel({ company, research }: DossierPanelProps) {
  return (
    <div className="p-6 space-y-6">
      <header>
        <h2 className="text-2xl font-bold">{company.company}</h2>
        <p className="text-gray-600">{research.data?.description}</p>
      </header>
      
      <section>
        <h3 className="font-semibold">Company Profile</h3>
        <dl className="grid grid-cols-2 gap-4">
          <dt>Facilities</dt><dd>{research.data?.facilityCount}</dd>
          <dt>Industry</dt><dd>{research.data?.industryCategory}</dd>
          <dt>HQ</dt><dd>{research.data?.headquarters}</dd>
        </dl>
      </section>
      
      <section>
        <h3 className="font-semibold">Talking Points</h3>
        <ul className="list-disc pl-5">
          {research.data?.talkingPoints?.map(tp => (
            <li key={tp}>{tp}</li>
          ))}
        </ul>
      </section>
      
      <section>
        <h3 className="font-semibold">Key Contacts</h3>
        {/* List contacts at this company */}
      </section>
    </div>
  );
}
```

**Exit Criteria**: Dossier panel renders research data.

---

### B3.3: Wire Dossier to Company Detail [30 min]

**Task**: Show dossier when company is selected.

**Files**: `src/components/CompanyDetailPanel.tsx`

**Implementation**:
- Add "Dossier" tab to company detail
- Fetch/show research data
- Trigger research if not cached

**Exit Criteria**: Dossier accessible from company view.

---

### B3.4: Cache Research Results [15 min]

**Task**: Store research in Firestore for persistence.

**Files**: `src/services/CompanyResearchService.ts`

**Implementation**:
```typescript
// After successful research
await setDoc(doc(db, 'company_research', companyName), {
  ...result,
  cachedAt: serverTimestamp(),
});

// Before API call
const cached = await getDoc(doc(db, 'company_research', companyName));
if (cached.exists() && isRecent(cached.data().cachedAt)) {
  return cached.data() as CompanyResearchResult;
}
```

**Exit Criteria**: Research persists across sessions.

---

## Sprint B4: Bulk Email Verification (1 hour)

**Goal**: Confirm bulk email works end-to-end  
**Demo**: Send 10 test emails, verify delivery

### B4.1: Test Bulk Email Flow [30 min]

**Task**: Walk through complete flow.

**Steps**:
1. Select 5 prospects with emails
2. Click Email button in toolbar
3. Choose template or write custom
4. Click Send
5. Verify progress bar
6. Verify success toast

**Exit Criteria**: Emails sent successfully.

---

### B4.2: Verify Email Delivery [15 min]

**Task**: Confirm emails arrive (use test addresses).

**Steps**:
1. Use test email addresses (your own)
2. Check inbox for delivery
3. Verify personalization (name, company)
4. Verify tracking pixel present

**Exit Criteria**: Emails delivered with correct content.

---

### B4.3: Document Bulk Email Usage [15 min]

**Task**: Add usage docs to README.

**Content**:
- How to select prospects
- How to access bulk email
- Template options
- Rate limits
- Troubleshooting

**Exit Criteria**: Docs in README or docs folder.

---

## Cross-Repo Coordination

### What GTM-YardFlow Needs from Railway

1. **AI Content Generation Endpoint**
   - Endpoint: `POST /api/ai/content/generate`
   - Auth: `x-service-key` header
   - Response: `{ content, subject, provider }`

2. **Fallback Pattern**
   - Railway implements Gemini → OpenAI fallback
   - Returns `provider` field indicating which was used
   - Returns `rateLimit.fallbackUsed` if rate limited

### What Railway Needs from GTM-YardFlow

1. **Consistent S2S Auth**
   - `RAILWAY_API_SECRET` = `CRON_SECRET`
   - Use `x-service-key` header

2. **Webhook Sync**
   - SendGrid events synced via `/api/email/webhook-sync`
   - Include `railwayMessageId` for correlation

---

## Rollback Plan

### Disable Brain
Set `VITE_BRAIN_ENABLED=false` (need to add feature flag).

### Disable AI Research  
Set `VITE_GEMINI_MOCK=true` to force mock mode.

### Disable Bulk Email
Set `VITE_BULK_EMAIL_ENABLED=false` (need to add feature flag).

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Brain response latency | < 3s |
| AI Research success rate | > 95% |
| Bulk email send success | > 98% |
| User activates Brain | > 50% of sessions |

---

## Key Files Reference

| Purpose | Location |
|---------|----------|
| Brain chat API | `api/ai/chat.ts` |
| Content generation API | `api/ai/generate.ts` |
| ChatPanel (Brain UI) | `src/components/panels/ChatPanel.tsx` |
| Company Research | `src/services/CompanyResearchService.ts` |
| Bulk Email Modal | `src/components/BulkEmailModal.tsx` |
| System Prompt (new) | `src/config/brainSystemPrompt.ts` |
| Brain Actions (new) | `src/hooks/useBrainActions.ts` |

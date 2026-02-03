# Sprint Plan V27: Voice, Templates & AI Content Integration

**Status**: � ACTIVE  
**Created**: February 3, 2026  
**Reviewed**: February 3, 2026 (Subagent review completed, issues fixed)  
**Railway R3 Ready**: February 3, 2026 ✅  
**Goal**: Integrate "Luis-style" voice/messaging into bulk email sends with AI content generation  
**North Star**: Send 50+ personalized emails using consistent brand voice with 1-click template selection

---

## Review Summary

**Subagent Review Completed**: 4 critical issues, 6 minor issues, 5 missing tasks identified and addressed below.

### Key Fixes Applied:
- ✅ Fixed `personalizeEmail` → use existing `personalizeTemplate` function
- ✅ Added missing `CALENDLY_CONFIG` import
- ✅ Made `tone` parameter optional with default for backwards compatibility
- ✅ Added missing unit test tasks (T1.5, T2.0, T3.2.5)
- ✅ Fixed Railway AI endpoint path (uses proxy `/api/railway/ai/content/generate`)
- ✅ Added accessibility labels to dropdowns
- ✅ Fixed E2E script to use direct fetch instead of browser-dependent client

---

## Executive Summary

### Current State Analysis

#### ✅ What's Working (GTM-YardFlow)
1. **Email Sending Pipeline**: Railway two-step outreach flow implemented (commit `54ebff0`)
   - `POST /api/outreach` creates outreach record with content
   - `POST /api/outreach/send-email` triggers send with `outreachId`
2. **Static Templates**: `src/config/emailTemplates.ts` has 5 hardcoded templates
3. **Luis-Style DM Template**: `src/data/sequenceTemplates.ts` has `manifest-dm-luis` template
4. **Personalization**: Token replacement works (`{first_name}`, `{company}`, etc.)
5. **Bulk Email Modal**: Enhanced UX (Sprint UX-1A+1B) with progress, skipped list

#### ⚠️ What's Missing
1. **AI Content Generation UI**: `generateAIContent()` exists but not wired to bulk send modal
2. **Tone/Voice Selection**: No UI for selecting "Luis" vs "Challenger" vs "Professional" style
3. **Template Library Management**: No ability to save/edit/create templates in UI
4. **Railway AI Endpoint**: `/api/railway/ai/content/generate` exists but untested E2E
5. **System Prompt (Luis Voice)**: Not defined in this repo - likely in Railway backend

#### 🔴 Architecture Decision: Where Does Voice Live?

**Answer: BOTH repositories need coordination**

| Component | Location | Purpose |
|-----------|----------|---------|
| Voice/Tone System Prompt | **Railway** (`yardflow-hitlist`) | Defines AI personality, proof points, style rules |
| Template Selection UI | **Vercel** (`GTM-YardFlow`) | User-facing dropdown, template management |
| AI Content Generation | **Railway** | OpenAI/Gemini API calls with system prompt |
| Template Storage | **Railway** Postgres | CRUD for user-created templates |
| Template Display | **Vercel** | Read templates from Railway, display in modal |

---

## Architecture: Voice & Template Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        GTM-YardFlow (Vercel)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  BulkEmailModal                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ [Template Dropdown]  [Generate AI ✨]  [Tone: Luis/Pro/Challenger] │ │
│  │                                                                   │   │
│  │ Subject: ________________________                                 │   │
│  │ Body:    [────────────────────────]                              │   │
│  │          [────────────────────────]                              │   │
│  │                                                                   │   │
│  │ Preview (personalized for first prospect):                       │   │
│  │ ┌─────────────────────────────────────┐                          │   │
│  │ │ Hi Casey, yard pilots going? YNP... │                          │   │
│  │ └─────────────────────────────────────┘                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                           │                                             │
│                           ▼                                             │
│  railwayClient.ai.generateContent({ tone: 'luis', prospect })          │
│                           │                                             │
└───────────────────────────┼─────────────────────────────────────────────┘
                            │ POST /api/railway/ai/content/generate
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      YardFlow-Hitlist (Railway)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  /api/ai/content/generate                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ const systemPrompt = VOICE_CONFIGS[tone];  // ← "Luis" lives here │ │
│  │                                                                   │   │
│  │ const response = await openai.chat.completions.create({          │   │
│  │   model: 'gpt-4o',                                                │   │
│  │   messages: [                                                     │   │
│  │     { role: 'system', content: systemPrompt },                   │   │
│  │     { role: 'user', content: prospectContext },                  │   │
│  │   ],                                                              │   │
│  │ });                                                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  VOICE_CONFIGS = {                                                      │
│    luis: "You write like a busy logistics exec. Short, punchy,         │
│           metrics-driven. 250 char max. Reference Primo $1M+/facility. │
│           Always include Calendly link.",                               │
│    challenger: "Ask provocative questions. Challenge status quo...",   │
│    professional: "Formal, value-focused, clear CTA...",                │
│  }                                                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Sprint Overview

| Sprint | Focus | Tasks | Demo |
|--------|-------|-------|------|
| **S1** | Template UI | T1.1-T1.5 | Dropdown selects template, preview updates |
| **S2** | AI Generation UI | T2.0-T2.4 | "Generate AI ✨" button populates subject/body |
| **S3** | Voice/Tone Selector | T3.1-T3.3 + T3.2.5 | Tone dropdown changes AI output style |
| **S4** | Template CRUD (Railway) | T4.1-T4.4 | Save/edit custom templates |
| **S5** | E2E Integration | T5.1-T5.3 | Full flow working with all components |

---

## Sprint S1: Template Selection UI

**Goal**: Allow users to select from existing templates in bulk email modal  
**Demo**: Select "Luis Style" template → subject/body auto-fill → preview shows personalized version

---

### T1.1: Add Template Dropdown to BulkEmailModal [S - 30 min]

**File**: `src/components/BulkEmailModal.tsx`

**Changes**:
```typescript
// Add state for selected template
const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

// Import templates and config
import { EMAIL_TEMPLATES, getEmailTemplate, personalizeTemplate } from '@/config/emailTemplates';
import { MANIFEST_DM_TEMPLATES } from '@/data/sequenceTemplates';
import { CALENDLY_CONFIG } from '@/config/calendly'; // Needed for token replacement

// Combine templates
const allTemplates = [...EMAIL_TEMPLATES, ...MANIFEST_DM_TEMPLATES.map(t => ({
  id: t.id,
  label: t.name,
  subject: t.steps[0]?.subjectTemplate || '',
  body: t.steps[0]?.bodyTemplate || '',
  category: 'manifest' as const,
}))];

// Render dropdown with accessibility label
<label htmlFor="template-select" className="sr-only">Select email template</label>
<select 
  id="template-select"
  aria-label="Select email template"
  value={selectedTemplateId || ''} 
  onChange={(e) => handleTemplateSelect(e.target.value)}
  className="..."
>
  <option value="">Select template...</option>
  {allTemplates.map(t => (
    <option key={t.id} value={t.id}>{t.label}</option>
  ))}
</select>
```

**Validation**:
- Unit test: Template dropdown renders all options
- Unit test: Selecting template updates `selectedTemplateId` state
- Accessibility test: Dropdown has aria-label
- Manual: Dropdown appears in modal, shows all templates

**Exit Criteria**: Dropdown visible with all template options.

---

### T1.2: Auto-fill Subject/Body on Template Selection [S - 30 min]

**File**: `src/components/BulkEmailModal.tsx`

**Changes**:
```typescript
const handleTemplateSelect = useCallback((templateId: string) => {
  setSelectedTemplateId(templateId);
  
  const template = allTemplates.find(t => t.id === templateId);
  if (!template) return;
  
  // Convert template tokens to our format
  const convertedSubject = template.subject
    .replace(/\{\{firstName\}\}/g, '{first_name}')
    .replace(/\{\{company\}\}/g, '{company}')
    .replace(/\{\{calendlyUrl\}\}/g, CALENDLY_CONFIG.url);
    
  const convertedBody = template.body
    .replace(/\{\{firstName\}\}/g, '{first_name}')
    .replace(/\{\{company\}\}/g, '{company}')
    .replace(/\{\{calendlyUrl\}\}/g, CALENDLY_CONFIG.url);
  
  setSubject(convertedSubject);
  setBody(convertedBody);
}, [allTemplates]);
```

**Validation**:
- Unit test: `handleTemplateSelect` updates subject/body
- Unit test: Token conversion works (`{{firstName}}` → `{first_name}`)
- Manual: Select "Luis Style" → subject/body populate

**Exit Criteria**: Template selection populates editable fields.

---

### T1.3: Add Live Preview with First Prospect [S - 30 min]

**File**: `src/components/BulkEmailModal.tsx`

**Changes**:
```typescript
import { personalizeTemplate } from '@/config/emailTemplates';

// Get first prospect for preview (with email preferred)
const firstProspect = selectedProspects.find(p => p.email) || selectedProspects[0];

// Personalize for preview using existing personalizeTemplate function
const { subject: previewSubject, body: previewBody } = useMemo(() => {
  if (!firstProspect || !subject || !body) {
    return { subject: '', body: '' };
  }
  
  // Create pseudo-template for personalization
  const pseudoTemplate = { 
    id: 'preview', 
    label: '', 
    subject, 
    body, 
    category: 'custom' as const 
  };
  
  return personalizeTemplate(pseudoTemplate, {
    name: firstProspect.name || 'there',
    company: firstProspect.company || 'your company',
    title: firstProspect.title || '',
  });
}, [subject, body, firstProspect]);

// Render preview section
<div className="mt-4 p-4 bg-gray-50 rounded-lg border">
  <h4 className="text-sm font-medium text-gray-700 mb-2">
    Preview (for {firstProspect?.name || 'first prospect'})
  </h4>
  <div className="text-sm">
    <p className="font-medium">{previewSubject}</p>
    <p className="whitespace-pre-wrap text-gray-600 mt-2">{previewBody}</p>
  </div>
</div>
```

**Validation**:
- Unit test: Preview shows personalized content
- Manual: Type template → see preview update in real-time

**Exit Criteria**: Live preview shows personalized email for first prospect.

---

### T1.4: Add Template Category Tabs [XS - 20 min]

**File**: `src/components/BulkEmailModal.tsx`

**Changes**:
```typescript
const [templateCategory, setTemplateCategory] = useState<'all' | 'intro' | 'followup' | 'manifest'>('all');

const filteredTemplates = allTemplates.filter(t => 
  templateCategory === 'all' || t.category === templateCategory
);

// Category tabs (using template literal instead of cn utility)
<div className="flex gap-2 mb-2">
  {['all', 'intro', 'followup', 'manifest'].map(cat => (
    <button
      key={cat}
      onClick={() => setTemplateCategory(cat as any)}
      className={`px-3 py-1 text-sm rounded ${
        templateCategory === cat ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'
      }`}
    >
      {cat.charAt(0).toUpperCase() + cat.slice(1)}
    </button>
  ))}
</div>
```

**Validation**:
- Unit test: Category filter works
- Manual: Click "Manifest" tab → only shows Manifest templates

**Exit Criteria**: Templates filterable by category.

---

### T1.5: Unit Tests for Template Selection [S - 30 min]

**File**: Create `src/__tests__/components/BulkEmailModal.template.test.tsx`

**Changes**:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkEmailModal } from '@/components/BulkEmailModal';
import { EMAIL_TEMPLATES } from '@/config/emailTemplates';

describe('BulkEmailModal - Template Selection', () => {
  const mockProspects = [
    { id: '1', name: 'John Doe', email: 'john@example.com', company: 'Acme Corp' },
  ];

  it('renders template dropdown with all options', () => {
    render(<BulkEmailModal isOpen={true} prospects={mockProspects} onClose={() => {}} />);
    
    const dropdown = screen.getByRole('combobox', { name: /template/i });
    expect(dropdown).toBeInTheDocument();
    
    EMAIL_TEMPLATES.forEach(t => {
      expect(screen.getByText(t.label)).toBeInTheDocument();
    });
  });

  it('auto-fills subject and body on template selection', () => {
    render(<BulkEmailModal isOpen={true} prospects={mockProspects} onClose={() => {}} />);
    
    const dropdown = screen.getByRole('combobox', { name: /template/i });
    fireEvent.change(dropdown, { target: { value: 'intro_freightroll' } });
    
    const subjectInput = screen.getByLabelText(/subject/i);
    const bodyInput = screen.getByLabelText(/body|message/i);
    
    expect(subjectInput).toHaveValue(expect.stringContaining('FreightRoll'));
    expect(bodyInput).toHaveValue(expect.stringContaining(''));
  });

  it('shows preview with personalized tokens', () => {
    render(<BulkEmailModal isOpen={true} prospects={mockProspects} onClose={() => {}} />);
    
    const dropdown = screen.getByRole('combobox', { name: /template/i });
    fireEvent.change(dropdown, { target: { value: 'intro_freightroll' } });
    
    // Preview should show "John" not "{first_name}"
    expect(screen.getByText(/john/i)).toBeInTheDocument();
  });

  it('filters templates by category', () => {
    render(<BulkEmailModal isOpen={true} prospects={mockProspects} onClose={() => {}} />);
    
    const manifestTab = screen.getByRole('button', { name: /manifest/i });
    fireEvent.click(manifestTab);
    
    // Should only show manifest templates
    expect(screen.queryByText('Introduction - FreightRoll')).not.toBeInTheDocument();
    expect(screen.getByText(/luis/i)).toBeInTheDocument();
  });
});
```

**Validation**:
```bash
npm test -- --run BulkEmailModal.template
```

**Exit Criteria**: All 4 tests pass.

---

## Sprint S2: AI Content Generation UI

**Goal**: Add "Generate AI ✨" button that calls Railway AI endpoint  
**Demo**: Click generate → AI-written subject/body appears → edit and send

---

### T2.0: Verify Railway AI Endpoint Exists [S - 20 min]

**Purpose**: Confirm Railway backend has `/api/ai/content/generate` endpoint before building UI

**Files**: None (verification only)

**Verification Steps**:
```bash
# 1. Check Railway health
curl -s "https://yardflow-hitlist-production-2f41.up.railway.app/api/health" | jq .

# 2. Test AI endpoint exists (expect 401 or 400, not 404)
curl -s -o /dev/null -w "%{http_code}" \
  "https://yardflow-hitlist-production-2f41.up.railway.app/api/ai/content/generate"
# Expected: 401 or 400 (auth/validation error), NOT 404

# 3. If 404, check Railway repo for endpoint or create GitHub issue
```

**Alternative**: Use Vercel proxy to test:
```bash
# Via proxy (requires Firebase token)
curl -s "https://gtm-yard-flow.vercel.app/api/railway/ai/content/generate" \
  -H "Authorization: Bearer FIREBASE_TOKEN" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"channel": "email", "context": {"recipientName": "Test"}}'
```

**Exit Criteria**: 
- If endpoint exists: Document response format, proceed to T2.1
- If 404: Create issue in YardFlow-Hitlist repo, mark T2.1-T2.4 as blocked

---

### T2.1: Add Generate AI Button to Modal [S - 30 min]

**File**: `src/components/BulkEmailModal.tsx`

**Prerequisites**: T2.0 must confirm endpoint exists (not 404)

**Changes**:
```typescript
import { generateAIContent } from '@/services/RailwayEmailService';
import { shouldUseRailwayEmail } from '@/config/featureFlags';

const [isGenerating, setIsGenerating] = useState(false);

// Define firstProspect (same as T1.3)
const firstProspect = selectedProspects.find(p => p.email) || selectedProspects[0];

const handleGenerateAI = useCallback(async () => {
  // Feature flag check
  if (!shouldUseRailwayEmail()) {
    toast.error('AI generation requires Railway to be enabled');
    return;
  }
  
  if (!firstProspect) {
    toast.error('No prospect selected');
    return;
  }
  
  setIsGenerating(true);
  try {
    const result = await generateAIContent(
      firstProspect.name || 'there',
      firstProspect.company || 'your company',
      'email',
      `Title: ${firstProspect.title || 'unknown'}` // Context for AI
    );
    
    if (result.success && result.content) {
      if (result.content.subject) setSubject(result.content.subject);
      setBody(result.content.body);
      toast.success('AI content generated!');
    } else {
      toast.error(result.error || 'Generation failed');
    }
  } finally {
    setIsGenerating(false);
  }
}, [firstProspect]);

// Button next to template dropdown
<button
  onClick={handleGenerateAI}
  disabled={isGenerating || !firstProspect}
  className="..."
>
  {isGenerating ? <Loader className="animate-spin" /> : '✨ Generate AI'}
</button>
```

**Validation**:
- Unit test: Button calls `generateAIContent` with correct params
- Mock test: AI response populates subject/body
- Manual: Click generates content (requires Railway AI endpoint working)

**Exit Criteria**: Generate button visible and functional.

---

### T2.2: Test Railway AI Endpoint E2E [M - 45 min]

**File**: Create `scripts/test-railway-ai.ts`

**Script**:
```typescript
#!/usr/bin/env npx tsx

const RAILWAY_API_URL = process.env.RAILWAY_API_URL || 
  'https://yardflow-hitlist-production-2f41.up.railway.app';
const S2S_SECRET = process.env.SERVICE_TO_SERVICE_SECRET || 
  's2s_yf_9d8f7a6c2b3e4f5a1d2c3b4e5f6a7b8c';

async function testAIGeneration() {
  console.log('🧪 Testing Railway AI endpoint...');
  
  const response = await fetch(`${RAILWAY_API_URL}/api/ai/content/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-service-key': S2S_SECRET,
    },
    body: JSON.stringify({
      type: 'email',
      context: {
        prospectName: 'Casey Larkin',
        companyName: 'FreightRoll',
        title: 'VP Operations',
        tone: 'professional',
        goal: 'Schedule meeting to discuss yard visibility',
      },
    }),
  });
  
  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));
  
  if (response.ok && data.content) {
    console.log('✅ AI generation working!');
  } else {
    console.error('❌ AI generation failed:', data.error);
  }
}

testAIGeneration().catch(console.error);
```

**Validation**:
```bash
npx tsx scripts/test-railway-ai.ts
# Should output generated email content
```

**Exit Criteria**: Script confirms AI endpoint working OR identifies what's missing in Railway.

---

### T2.3: Add Loading State During Generation [XS - 15 min]

**File**: `src/components/BulkEmailModal.tsx`

**Changes**:
```typescript
// Replace subject/body inputs with loading skeleton
{isGenerating ? (
  <div className="space-y-3">
    <div className="h-10 bg-gray-200 rounded animate-pulse" />
    <div className="h-32 bg-gray-200 rounded animate-pulse" />
    <p className="text-sm text-gray-500 text-center">Generating AI content...</p>
  </div>
) : (
  <>
    <input value={subject} onChange={...} />
    <textarea value={body} onChange={...} />
  </>
)}
```

**Validation**:
- Unit test: Loading skeleton appears when `isGenerating` true
- Manual: Click generate → see skeleton → content appears

**Exit Criteria**: Smooth loading UX during generation.

---

### T2.4: Handle AI Generation Errors Gracefully [S - 20 min]

**File**: `src/components/BulkEmailModal.tsx`

**Changes**:
```typescript
const [aiError, setAiError] = useState<string | null>(null);

const handleGenerateAI = useCallback(async () => {
  setAiError(null);
  // ... existing logic ...
  
  if (!result.success) {
    setAiError(result.error || 'Generation failed');
    // Don't clear existing content on error
    return;
  }
}, []);

// Error display
{aiError && (
  <div className="flex items-center gap-2 p-2 bg-red-50 text-red-600 rounded text-sm">
    <AlertCircle className="h-4 w-4" />
    {aiError}
    <button onClick={() => setAiError(null)} className="ml-auto">×</button>
  </div>
)}
```

**Validation**:
- Unit test: Error state displayed correctly
- Mock test: Error doesn't clear existing content
- Manual: Disconnect Railway → see error message

**Exit Criteria**: Errors handled gracefully with user feedback.

---

## Sprint S3: Voice/Tone Selection

**Goal**: Add tone selector that changes AI generation style  
**Demo**: Select "Luis" → generate → get short punchy message; select "Professional" → get formal message

---

### T3.1: Add Tone Dropdown to Modal [S - 30 min]

**File**: `src/components/BulkEmailModal.tsx`

**Changes**:
```typescript
type ToneOption = 'luis' | 'professional' | 'challenger';

const TONE_OPTIONS: { value: ToneOption; label: string; description: string }[] = [
  { value: 'luis', label: 'Luis Style', description: 'Short, punchy, metrics-driven (250 chars)' },
  { value: 'professional', label: 'Professional', description: 'Formal, value-focused, clear CTA' },
  { value: 'challenger', label: 'Challenger', description: 'Provocative questions, challenge status quo' },
];

const [selectedTone, setSelectedTone] = useState<ToneOption>('professional');

// Dropdown with descriptions
<select
  value={selectedTone}
  onChange={(e) => setSelectedTone(e.target.value as ToneOption)}
  className="..."
>
  {TONE_OPTIONS.map(opt => (
    <option key={opt.value} value={opt.value}>
      {opt.label} - {opt.description}
    </option>
  ))}
</select>
```

**Validation**:
- Unit test: Tone dropdown renders with all options
- Manual: Dropdown visible and selectable

**Exit Criteria**: Tone selector visible in modal.

---

### T3.2: Pass Tone to AI Generation [S - 20 min]

**File**: `src/components/BulkEmailModal.tsx`, `src/services/RailwayEmailService.ts`

**Changes**:

Update `generateAIContent` signature (tone optional with default):
```typescript
export async function generateAIContent(
  recipientName: string,
  companyName: string,
  channel: 'email' | 'linkedin' | 'phone',
  context?: string,
  tone: 'luis' | 'professional' | 'challenger' = 'professional' // Optional with default
): Promise<...>
```

Update call in modal:
```typescript
const result = await generateAIContent(
  firstProspect.name || 'there',
  firstProspect.company || 'your company',
  'email',
  `Title: ${firstProspect.title || 'unknown'}`,
  selectedTone // Pass selected tone (defaults to 'professional' if undefined)
);
```

**Backward Compatibility Note**:
Existing calls without the `tone` parameter will default to `'professional'`, ensuring no breaking changes.

**Validation**:
- Unit test: `generateAIContent` includes tone in request body
- Unit test: Calling without tone uses 'professional' default
- Manual: Check Railway logs show tone in request

**Exit Criteria**: Tone passed to Railway AI endpoint.

---

### T3.2.5: Update Existing Tests for Tone Parameter [S - 20 min]

**File**: `src/__tests__/services/RailwayEmailService.test.ts`

**Changes**:
Add tests for tone parameter:
```typescript
describe('generateAIContent', () => {
  it('includes tone in request when provided', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse);
    
    await generateAIContent('John', 'Acme', 'email', 'context', 'luis');
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"tone":"luis"'),
      })
    );
  });

  it('defaults to professional tone when not provided', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse);
    
    await generateAIContent('John', 'Acme', 'email', 'context');
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"tone":"professional"'),
      })
    );
  });
});
```

**Validation**:
```bash
npm test -- --run RailwayEmailService
```

**Exit Criteria**: All tests pass including new tone tests.

---

### T3.3: Update Railway Types for Tone [XS - 15 min]

**File**: `src/types/railway.ts`, `src/services/RailwayApiClient.ts`

**Changes**:
```typescript
// Add tone to AI generate request type
ai = {
  generateContent: async (data: {
    type: 'email' | 'linkedin' | 'subject';
    context: {
      prospectName?: string;
      companyName?: string;
      title?: string;
      previousMessages?: string[];
      tone?: 'luis' | 'professional' | 'challenger' | 'casual' | 'friendly';
      goal?: string;
    };
  }): Promise<RailwayApiResult<{ content: string; subject?: string }>> => {
    return this.post('/ai/content/generate', data);
  },
};
```

**Validation**:
- TypeScript compiles without errors
- Types match Railway API contract

**Exit Criteria**: Types updated for tone support.

---

## Sprint S4: Template CRUD (Railway Backend Ready ✅)

**Goal**: Save/edit/delete custom templates stored in Railway Postgres  
**Demo**: Create new template → save → appears in dropdown next session

> ✅ **Railway R3 is ready!** Template CRUD endpoints available. See "Railway Backend Requirements" section for schema details.

---

### T4.1: Create Template Management Types [S - 20 min]

**File**: `src/types/railway.ts`

**Changes**:
```typescript
export interface EmailTemplateRecord {
  id: UUID;
  name: string;
  subject: string;
  body: string;
  category: 'intro' | 'followup' | 'meeting' | 'manifest' | 'custom';
  tone?: 'luis' | 'professional' | 'challenger';
  isDefault: boolean;
  createdBy: UUID;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface CreateTemplateRequest {
  name: string;
  subject: string;
  body: string;
  category: string;
  tone?: string;
}
```

**Validation**: TypeScript compiles.

**Exit Criteria**: Types defined for template CRUD.

---

### T4.2: Add Template Endpoints to RailwayApiClient [S - 30 min]

**File**: `src/services/RailwayApiClient.ts`

**Changes**:
```typescript
templates = {
  list: async (): Promise<RailwayApiResult<EmailTemplateRecord[]>> => {
    return this.get('/templates');
  },
  
  get: async (id: UUID): Promise<RailwayApiResult<EmailTemplateRecord>> => {
    return this.get(`/templates/${id}`);
  },
  
  create: async (data: CreateTemplateRequest): Promise<RailwayApiResult<EmailTemplateRecord>> => {
    return this.post('/templates', data);
  },
  
  update: async (id: UUID, data: Partial<CreateTemplateRequest>): Promise<RailwayApiResult<EmailTemplateRecord>> => {
    return this.patch(`/templates/${id}`, data);
  },
  
  delete: async (id: UUID): Promise<RailwayApiResult<void>> => {
    return this.delete(`/templates/${id}`);
  },
};
```

**Validation**:
- Unit test: Template API methods exist and call correct endpoints

**Exit Criteria**: Client has template CRUD methods.

---

### T4.3: Create useTemplates Hook [S - 30 min]

**File**: Create `src/hooks/useTemplates.ts`

**Implementation**:
```typescript
import { useState, useEffect, useCallback } from 'react';
import { railwayClient } from '@/services/RailwayApiClient';
import { EMAIL_TEMPLATES } from '@/config/emailTemplates';
import { MANIFEST_DM_TEMPLATES } from '@/data/sequenceTemplates';

export function useTemplates() {
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch Railway templates, fallback to static
  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await railwayClient.templates.list();
      if (result.ok && result.data) {
        setTemplates(result.data);
      } else {
        // Fallback to static templates
        setTemplates(convertStaticTemplates());
      }
    } catch {
      setTemplates(convertStaticTemplates());
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  
  return { templates, isLoading, error, reload: loadTemplates };
}
```

**Validation**:
- Unit test: Hook fetches from Railway
- Unit test: Hook falls back to static templates on error

**Exit Criteria**: Hook provides template data with fallback.

---

### T4.4: Add "Save as Template" Button to Modal [M - 45 min]

**File**: `src/components/BulkEmailModal.tsx`

**Changes**:
```typescript
const [showSaveDialog, setShowSaveDialog] = useState(false);
const [templateName, setTemplateName] = useState('');

const handleSaveTemplate = useCallback(async () => {
  if (!templateName.trim() || !subject.trim() || !body.trim()) {
    toast.error('Template name, subject, and body required');
    return;
  }
  
  const result = await railwayClient.templates.create({
    name: templateName,
    subject,
    body,
    category: 'custom',
    tone: selectedTone,
  });
  
  if (result.ok) {
    toast.success('Template saved!');
    setShowSaveDialog(false);
    reloadTemplates();
  } else {
    toast.error(result.error || 'Failed to save template');
  }
}, [templateName, subject, body, selectedTone]);

// Button in modal footer
<button onClick={() => setShowSaveDialog(true)}>
  Save as Template
</button>
```

**Validation**:
- Unit test: Save dialog opens and submits
- E2E test: Create template → reload → template appears

**Exit Criteria**: Users can save custom templates.

---

## Sprint S5: E2E Integration Testing

**Goal**: Verify full flow works end-to-end  
**Demo**: Select prospects → choose template → generate AI → send → emails delivered

---

### T5.1: Create E2E Test Script [M - 45 min]

**File**: Create `scripts/test-email-e2e.ts`

**Script**:
```typescript
#!/usr/bin/env npx tsx
/**
 * E2E Email Flow Test
 * 1. Create outreach record
 * 2. Trigger send
 * 3. Verify email delivered
 */

import { railwayClient } from '../src/services/RailwayApiClient';

async function runE2E() {
  console.log('🧪 Starting E2E email test...\n');
  
  // Step 1: Create outreach
  console.log('1️⃣ Creating outreach record...');
  const createResult = await railwayClient.outreach.create({
    personId: 'test-person-id',
    subject: 'E2E Test ' + new Date().toISOString(),
    body: '<p>This is an E2E test email.</p>',
    textBody: 'This is an E2E test email.',
    channel: 'email',
    metadata: { test: true },
  });
  
  if (!createResult.ok) {
    console.error('❌ Failed to create outreach:', createResult.error);
    return;
  }
  console.log('✅ Outreach created:', createResult.data.id);
  
  // Step 2: Send email
  console.log('\n2️⃣ Triggering email send...');
  const sendResult = await railwayClient.outreach.send({
    outreachId: createResult.data.id,
    force: false,
  });
  
  if (!sendResult.ok) {
    console.error('❌ Failed to send:', sendResult.error);
    return;
  }
  console.log('✅ Email queued:', sendResult.data.status);
  
  console.log('\n✅ E2E test complete! Check inbox for email.');
}

runE2E().catch(console.error);
```

**Validation**: Run script, email appears in inbox.

**Exit Criteria**: Automated E2E test exists.

---

### T5.2: Create Playwright E2E Test [M - 1 hour]

**File**: Create `e2e/bulk-email-templates.spec.ts`

**Implementation**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Bulk Email with Templates', () => {
  test('selects template and sends email', async ({ page }) => {
    await page.goto('/');
    
    // Select prospects
    await page.getByTestId('prospect-checkbox-0').click();
    
    // Open bulk email modal
    await page.getByRole('button', { name: /email/i }).click();
    
    // Select template
    await page.getByRole('combobox', { name: /template/i }).selectOption('manifest-dm-luis');
    
    // Verify subject populated
    const subject = await page.getByRole('textbox', { name: /subject/i }).inputValue();
    expect(subject).toContain('Manifest');
    
    // Send
    await page.getByRole('button', { name: /send/i }).click();
    
    // Verify success
    await expect(page.getByText(/sent.*email/i)).toBeVisible({ timeout: 30000 });
  });
});
```

**Validation**: `npm run test:e2e -- bulk-email-templates.spec.ts` passes.

**Exit Criteria**: Playwright test covers template selection + send.

---

### T5.3: Document Voice Configuration for Railway [S - 30 min]

**File**: Create `docs/VOICE_CONFIGURATION.md`

**Content**:
- How voice/tone system prompts work
- Where they're defined (Railway)
- How to add new voices
- Token usage/cost considerations
- Example prompts for each tone

**Validation**: Doc merged and reviewed.

**Exit Criteria**: Team knows how to configure voices.

---

## Railway Backend Requirements (yardflow-hitlist Repo)

> ✅ **Railway R3 Backend is Ready!** (February 3, 2026)

The following endpoints are now available in Railway:

### R1: AI Content Generation Endpoint ✅ READY
- **Endpoint**: `POST /api/ai/content/generate`
- **Header**: `x-service-key: <SERVICE_TO_SERVICE_SECRET>`
- **Request Schema** (aligned with GTM V27):
  ```json
  {
    "type": "email",
    "tone": "luis",           // top-level
    "goal": "Schedule demo",  // top-level
    "context": {
      "prospectName": "Casey",
      "companyName": "Pesti",
      "title": "VP"
    }
  }
  ```
- **Response**:
  ```json
  {
    "subject": "...",
    "content": "..."
  }
  ```

### R2: Voice System Prompts ✅ READY
- Uses Gemini API (verify `GEMINI_API_KEY` is set in Railway env vars)
- Supports tones: `LUIS`, `PROFESSIONAL`, `CHALLENGER`

### R3: Template CRUD Endpoints ✅ READY
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/templates` | List (supports `?tone=LUIS&channel=EMAIL`) |
| POST | `/api/templates` | Create |
| GET | `/api/templates/:id` | Get single |
| PATCH | `/api/templates/:id` | Update |
| DELETE | `/api/templates/:id` | Delete |

**Template Schema** (Railway):
```typescript
{
  name: string,
  channel: "EMAIL" | "LINKEDIN" | "PHONE",  // Note: Different from GTM 'category'
  tone?: "LUIS" | "PROFESSIONAL" | "CHALLENGER",  // UPPERCASE
  subject?: string,
  template: string,  // Note: Railway uses 'template', GTM uses 'body'
  isActive?: boolean,
  isDefault?: boolean
}
```

### ⚠️ Schema Alignment Required (GTM-YardFlow)
The GTM types need minor updates to match Railway:
- `category` → `channel` (or map in adapter)
- `body` → `template` (or map in adapter)
- Tone values: `luis` → `LUIS` (uppercase)

### 🔧 Action Required on Railway
1. Verify `GEMINI_API_KEY` is set in Railway env vars
2. Run migration: `npx prisma migrate deploy`

---

## Dependency Matrix

```
GTM-YardFlow Sprint Dependencies:

S1 (Template UI) ✅ COMPLETE
  ├── T1.1 ──▶ T1.2 ──▶ T1.3 ──▶ T1.4
  │
  └──▶ S2 (AI Generation) ✅ COMPLETE
         ├── T2.1 ──▶ T2.2 ──▶ T2.3 ──▶ T2.4
         │
         └──▶ S3 (Tone Selection) ✅ COMPLETE
                ├── T3.1 ──▶ T3.2 ──▶ T3.3
                │
                └──▶ S5 (E2E Integration)
                       └── T5.1 ──▶ T5.2 ──▶ T5.3

S4 (Template CRUD) ✅ Railway R3 Ready! 
  └── T4.1 ✅ ──▶ T4.2 ✅ ──▶ T4.3 ✅ ──▶ T4.4 ✅ ──▶ T4.5 ✅ ──▶ T4.6 ✅ ──▶ T4.7 ✅
  └── ⚠️ Schema alignment task needed (see T4.8 below)
```

---

## Key Files Reference

| Purpose | Location |
|---------|----------|
| Static email templates | `src/config/emailTemplates.ts` |
| Luis DM templates | `src/data/sequenceTemplates.ts` |
| Bulk email modal | `src/components/BulkEmailModal.tsx` |
| AI content generation | `src/services/RailwayEmailService.ts` |
| Railway API client | `src/services/RailwayApiClient.ts` |
| Railway types | `src/types/railway.ts` |
| Template generator | `src/services/TemplateGenerator.ts` |
| Asset prompt builder | `src/services/AssetPromptBuilder.ts` |

---

## Acceptance Criteria Summary

| Sprint | Acceptance Criteria |
|--------|---------------------|
| S1 | Template dropdown works, auto-fills subject/body, preview updates live |
| S2 | "Generate AI" button works, calls Railway, populates fields |
| S3 | Tone selector changes AI output style |
| S4 | Custom templates saved to Railway, persist across sessions |
| S5 | E2E test passes, documentation complete |

---

## Rollback Plan

If AI generation fails:
1. Disable "Generate AI" button (hide via feature flag)
2. Static templates still work
3. Manual entry still works

If Railway templates fail:
1. `useTemplates` hook falls back to static templates
2. No user impact

---

## Next Actions

1. ✅ ~~**This Repo (GTM-YardFlow)**: Implement S1-S3~~ (COMPLETE)
2. ✅ ~~**Railway Repo (yardflow-hitlist)**: Verify/implement R1, R2, R3~~ (READY)
3. ✅ ~~**S4 Frontend Prep**: Template CRUD frontend ready~~ (COMPLETE - commit `f5f70f9`)
4. **🔧 Schema Alignment (T4.8)**: Update GTM types to match Railway schema:
   - Map `category` → `channel` (EMAIL/LINKEDIN/PHONE)
   - Map `body` → `template`
   - Uppercase tone values (LUIS/PROFESSIONAL/CHALLENGER)
5. **Test E2E**: Enable `VITE_RAILWAY_TEMPLATES_ENABLED=true` and test against live Railway
6. **Run S5 E2E tests**: Full integration validation

---

*Document created by GitHub Copilot (Claude Opus 4.5)*  
*Last updated: February 3, 2026*

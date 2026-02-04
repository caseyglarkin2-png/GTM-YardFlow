# Sprint Plan V28-GTM: Manifest 2026 Frontend Readiness

**Status**: 🚀 ACTIVE  
**Created**: February 4, 2026  
**Goal**: Production-ready GTM frontend for Manifest 2026 ABM campaign  
**Repo**: GTM-YardFlow (Vercel Frontend)  
**Companion Plan**: V28 Railway Backend (YardFlow-Hitlist)

---

## Executive Summary

This sprint plan focuses on GTM-YardFlow (Vercel frontend) work that complements the Railway V28 backend work. The goal is a fully integrated, production-ready platform for Manifest 2026 mass email outreach.

### Cross-Repo Coordination

| GTM-YardFlow (This Plan) | Railway V28 (Companion) |
|--------------------------|------------------------|
| S0: AI Fallback UI | T0.1: AI Provider Resolution |
| S1: Health Dashboard | T1.1: Health Endpoint AI Check |
| S2: Template UI Integration | Sprint 3: Template Management |
| S3: Email Compose Flow | Sprint 4: Email Pipeline |
| S4: Prospect Management UI | Sprint 5: Prospect API |
| S5: Meeting Attribution UI | Sprint 6: Meeting Attribution |

### Current State (GTM-YardFlow)

| Component | Status | Notes |
|-----------|--------|-------|
| Railway Proxy | ✅ Working | `/api/railway/[...path].ts` with S2S auth |
| Template Adapter | ✅ Working | Lowercase tones for AI, UPPERCASE for templates |
| `useTemplates` Hook | ✅ Working | Fetches from Railway with static fallback |
| `RailwayApiClient` | ✅ Working | Typed client with templates + AI methods |
| Feature Flags | ✅ Working | `VITE_RAILWAY_TEMPLATES_ENABLED=true` deployed |
| BulkEmailModal | ⚠️ Partial | Needs template dropdown + AI generate wired |
| Health Dashboard | ⚠️ Basic | Needs Railway + AI provider status |

---

## Sprint 0: AI Fallback UX (Complements Railway T0.1)

**Goal**: Handle AI provider fallback gracefully in UI  
**Demo**: Generate AI content → shows provider used → graceful degradation on errors  
**Depends On**: Railway T0.1 (AI Provider Resolution)

---

### T0.1: Add Provider Indicator to AI Response [XS - 15 min]

**Purpose**: Show users which AI provider generated their content (Gemini/OpenAI)

**File**: `src/components/BulkEmailModal.tsx`

**Implementation**:
```typescript
interface AIGenerationResult {
  success: boolean;
  content?: { subject: string; body: string };
  provider?: 'gemini' | 'openai';  // NEW
  error?: string;
}

// In handleGenerateAI success path:
if (result.success && result.content) {
  setSubject(result.content.subject);
  setBody(result.content.body);
  const providerLabel = result.provider === 'openai' ? ' (OpenAI fallback)' : '';
  toast.success(`AI content generated!${providerLabel}`);
}
```

**Validation**:
```typescript
it('shows provider in success toast', () => {
  mockAIGenerate.mockResolvedValue({ success: true, content: {...}, provider: 'openai' });
  // ... trigger generation
  expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('OpenAI'));
});
```

**Exit Criteria**: Toast shows which provider was used.

---

### T0.2: Handle Rate Limit Response in UI [S - 30 min]

**Purpose**: Show user-friendly message when AI is rate limited

**File**: `src/components/BulkEmailModal.tsx`

**Implementation**:
```typescript
// Add rate limit state
const [rateLimitInfo, setRateLimitInfo] = useState<{
  isLimited: boolean;
  retryAfterSeconds?: number;
  fallbackUsed?: string;
} | null>(null);

// In handleGenerateAI:
if (result.error === 'rate_limited') {
  setRateLimitInfo({
    isLimited: true,
    retryAfterSeconds: result.retryAfterSeconds,
    fallbackUsed: result.fallbackUsed,
  });
  
  if (result.fallbackUsed && result.content) {
    // Fallback succeeded - show content with warning
    setSubject(result.content.subject);
    setBody(result.content.body);
    toast.warning(`Generated with ${result.fallbackUsed} (primary provider rate limited)`);
  } else {
    toast.error(`AI rate limited. Try again in ${result.retryAfterSeconds}s`);
  }
  return;
}

// Rate limit banner
{rateLimitInfo?.isLimited && !rateLimitInfo.fallbackUsed && (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
    <p className="text-sm text-yellow-700">
      ⚠️ AI generation temporarily limited. 
      {rateLimitInfo.retryAfterSeconds && (
        <> Retry available in {Math.ceil(rateLimitInfo.retryAfterSeconds / 60)} minutes.</>
      )}
    </p>
  </div>
)}
```

**Validation**:
```typescript
it('shows rate limit warning when fallback used', () => {
  mockAIGenerate.mockResolvedValue({ 
    success: true, 
    content: {...}, 
    error: 'rate_limited',
    fallbackUsed: 'openai' 
  });
  // ... trigger generation
  expect(toast.warning).toHaveBeenCalled();
});

it('shows rate limit error when no fallback available', () => {
  mockAIGenerate.mockResolvedValue({ 
    success: false, 
    error: 'rate_limited',
    retryAfterSeconds: 60 
  });
  // ... trigger generation
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('60s'));
});
```

**Exit Criteria**: Rate limits handled gracefully with clear user feedback.

---

### T0.3: Fallback to Manual Entry Mode [S - 20 min]

**Purpose**: When AI unavailable, allow users to continue with manual entry

**File**: `src/components/BulkEmailModal.tsx`

**Implementation**:
```typescript
const [aiUnavailable, setAiUnavailable] = useState(false);

// In handleGenerateAI error path:
if (result.error === 'provider_unavailable') {
  setAiUnavailable(true);
  toast.error('AI generation temporarily unavailable. Please enter content manually.');
  return;
}

// Disable AI button when unavailable
<button
  onClick={handleGenerateAI}
  disabled={isGenerating || !firstProspect || aiUnavailable}
  title={aiUnavailable ? 'AI temporarily unavailable' : undefined}
  className={aiUnavailable ? 'opacity-50 cursor-not-allowed' : '...'}
>
  {aiUnavailable ? '✨ AI Unavailable' : '✨ Generate AI'}
</button>
```

**Validation**:
```typescript
it('disables AI button when provider unavailable', async () => {
  mockAIGenerate.mockResolvedValue({ success: false, error: 'provider_unavailable' });
  // ... trigger generation
  expect(screen.getByText('AI Unavailable')).toBeDisabled();
});
```

**Exit Criteria**: Users can continue workflow when AI is down.

---

### T0.4: Unit Tests for AI Fallback States [S - 30 min]

**File**: Create `src/__tests__/components/BulkEmailModal.ai-fallback.test.tsx`

**Implementation**:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BulkEmailModal } from '@/components/BulkEmailModal';

// Mock AI service
vi.mock('@/services/RailwayEmailService', () => ({
  generateAIContent: vi.fn(),
}));

describe('BulkEmailModal - AI Fallback', () => {
  const mockProspects = [
    { id: '1', name: 'John', email: 'john@test.com', company: 'Acme' },
  ];

  it('shows provider indicator when OpenAI fallback used', async () => {
    const { generateAIContent } = await import('@/services/RailwayEmailService');
    vi.mocked(generateAIContent).mockResolvedValue({
      success: true,
      content: { subject: 'Test', body: 'Hello' },
      provider: 'openai',
    });
    
    render(<BulkEmailModal isOpen prospects={mockProspects} onClose={() => {}} />);
    fireEvent.click(screen.getByText(/generate ai/i));
    
    await waitFor(() => {
      expect(screen.getByText(/openai/i)).toBeInTheDocument();
    });
  });

  it('handles rate limit with fallback content', async () => {
    // ... test implementation
  });

  it('handles complete provider unavailability', async () => {
    // ... test implementation
  });

  it('allows manual entry when AI unavailable', async () => {
    // ... test implementation
  });
});
```

**Validation**:
```bash
npm test -- --run BulkEmailModal.ai-fallback
```

**Exit Criteria**: All 4 tests pass.

---

### T0.5: Add AI Request Timeout [S - 25 min]

**Purpose**: Prevent hung requests with AbortController timeout

**File**: `src/services/RailwayApiClient.ts`

**Implementation**:
```typescript
// In AI generate method
async generateContent(payload: AIContentPayload): Promise<RailwayApiResult<AIContent>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
  
  try {
    return await this.post('/ai/content/generate', payload, {
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        ok: false,
        error: 'AI generation timed out. Please try again.',
        status: 408,
      };
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Validation**:
```typescript
it('times out after 15 seconds', async () => {
  vi.useFakeTimers();
  mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
  
  const promise = client.ai.generateContent(payload);
  vi.advanceTimersByTime(16000);
  
  const result = await promise;
  expect(result.ok).toBe(false);
  expect(result.error).toContain('timed out');
});
```

**Exit Criteria**: AI requests timeout gracefully after 15 seconds.

---

## Sprint 1: Health Dashboard Enhancement (Complements Railway T1.1)

**Goal**: Unified health view showing Railway + AI provider status  
**Demo**: Dashboard shows green/yellow/red for all services including AI providers  
**Depends On**: Railway T1.1 (Health Endpoint AI Check)

---

### T1.1: Create RailwayHealthCard Component [M - 45 min]

**Purpose**: Display Railway backend health status

**File**: Create `src/components/RailwayHealthCard.tsx`

**Implementation**:
```typescript
import { useState, useEffect } from 'react';
import { railwayClient } from '@/services/RailwayApiClient';

interface HealthCheck {
  status: 'ok' | 'degraded' | 'error';
  latencyMs?: number;
}

interface RailwayHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    ai?: {
      gemini: HealthCheck & { quotaRemaining?: number };
      openai: HealthCheck;
    };
  };
  version?: string;
}

export function RailwayHealthCard() {
  const [health, setHealth] = useState<RailwayHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const result = await railwayClient.health.check();
        if (result.ok) {
          setHealth(result.data);
        } else {
          setError('Failed to fetch health');
        }
      } catch {
        setError('Railway unreachable');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (isLoading) return <HealthCardSkeleton />;
  if (error) return <HealthCardError error={error} />;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">Railway Backend</h3>
        <StatusBadge status={health?.status} />
      </div>
      
      <div className="space-y-2">
        <HealthRow label="Database" check={health?.checks.database} />
        <HealthRow label="Redis" check={health?.checks.redis} />
        
        {health?.checks.ai && (
          <>
            <div className="border-t pt-2 mt-2">
              <span className="text-xs text-gray-500 uppercase">AI Providers</span>
            </div>
            <HealthRow 
              label="Gemini" 
              check={health.checks.ai.gemini}
              extra={health.checks.ai.gemini.quotaRemaining !== undefined && (
                <span className="text-xs text-gray-400">
                  {health.checks.ai.gemini.quotaRemaining} remaining
                </span>
              )}
            />
            <HealthRow label="OpenAI (fallback)" check={health.checks.ai.openai} />
          </>
        )}
      </div>
      
      {health?.version && (
        <p className="text-xs text-gray-400 mt-4">v{health.version}</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const colors = {
    healthy: 'bg-green-100 text-green-800',
    degraded: 'bg-yellow-100 text-yellow-800',
    unhealthy: 'bg-red-100 text-red-800',
  };
  
  return (
    <span className={`px-2 py-1 text-xs rounded-full ${colors[status as keyof typeof colors] || colors.unhealthy}`}>
      {status || 'unknown'}
    </span>
  );
}

function HealthRow({ label, check, extra }: { label: string; check?: HealthCheck; extra?: React.ReactNode }) {
  const statusIcon = check?.status === 'ok' ? '✓' : check?.status === 'degraded' ? '⚠' : '✗';
  const statusColor = check?.status === 'ok' ? 'text-green-600' : check?.status === 'degraded' ? 'text-yellow-600' : 'text-red-600';
  
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        {extra}
        {check?.latencyMs && <span className="text-xs text-gray-400">{check.latencyMs}ms</span>}
        <span className={statusColor}>{statusIcon}</span>
      </div>
    </div>
  );
}
```

**Validation**:
```typescript
it('renders health status with all checks', () => {
  // Mock health response
  // Verify database, redis, AI sections render
});

it('shows degraded state when AI quota low', () => {
  // Mock quota_exceeded response
  // Verify warning state displayed
});

it('refreshes health every 30 seconds', () => {
  vi.useFakeTimers();
  // Verify interval fires
});
```

**Exit Criteria**: Card displays all Railway health info including AI providers.

---

### T1.2: Add Health Card to Dashboard [XS - 15 min]

**Purpose**: Wire RailwayHealthCard into main dashboard

**File**: `src/components/dashboard/DashboardOverview.tsx` (or equivalent)

**Implementation**:
```typescript
import { RailwayHealthCard } from '@/components/RailwayHealthCard';

// In dashboard grid:
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <RailwayHealthCard />
  <EmailStatsCard />
  {/* ... other cards */}
</div>
```

**Validation**: Manual - Health card visible on dashboard.

**Exit Criteria**: Health card displays on main dashboard.

---

### T1.3: Add Health Check to RailwayApiClient [S - 20 min]

**Purpose**: Typed health check method with AI provider info

**File**: `src/services/RailwayApiClient.ts`

**Implementation**:
```typescript
// Add to health object
health = {
  check: async (): Promise<RailwayApiResult<RailwayHealthResponse>> => {
    return this.get('/health');
  },
  
  checkDetailed: async (): Promise<RailwayApiResult<RailwayDetailedHealth>> => {
    return this.get('/health?detailed=true');
  },
};

// Types
interface RailwayHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    system: { status: string };
    database: { status: string; latencyMs?: number };
    redis: { status: string; latencyMs?: number };
    ai?: {
      gemini: { status: string; quotaRemaining?: number };
      openai: { status: string };
    };
  };
  version?: string;
}
```

**Validation**:
```typescript
it('parses health response with AI providers', async () => {
  mockFetch.mockResolvedValue({ ok: true, data: mockHealthWithAI });
  const result = await client.health.check();
  expect(result.data.checks.ai?.gemini.status).toBe('ok');
});
```

**Exit Criteria**: Health client returns typed AI provider status.

---

### T1.4: Unit Tests for Health Components [S - 30 min]

**File**: Create `src/__tests__/components/RailwayHealthCard.test.tsx`

**Implementation**:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RailwayHealthCard } from '@/components/RailwayHealthCard';

vi.mock('@/services/RailwayApiClient', () => ({
  railwayClient: {
    health: {
      check: vi.fn(),
    },
  },
}));

describe('RailwayHealthCard', () => {
  it('shows healthy status when all checks pass', async () => {
    const { railwayClient } = await import('@/services/RailwayApiClient');
    vi.mocked(railwayClient.health.check).mockResolvedValue({
      ok: true,
      data: {
        status: 'healthy',
        checks: {
          database: { status: 'ok', latencyMs: 12 },
          redis: { status: 'ok', latencyMs: 3 },
          ai: {
            gemini: { status: 'ok', quotaRemaining: 1000 },
            openai: { status: 'ok' },
          },
        },
      },
    });
    
    render(<RailwayHealthCard />);
    
    await waitFor(() => {
      expect(screen.getByText('healthy')).toBeInTheDocument();
      expect(screen.getByText('Database')).toBeInTheDocument();
      expect(screen.getByText('Gemini')).toBeInTheDocument();
    });
  });

  it('shows degraded when Gemini quota exhausted', async () => {
    // ... mock degraded response
  });

  it('shows error state when Railway unreachable', async () => {
    // ... mock network error
  });
});
```

**Validation**:
```bash
npm test -- --run RailwayHealthCard
```

**Exit Criteria**: All health card tests pass.

---

## Sprint 2: Template UI Integration (Complements Railway Sprint 3)

**Goal**: Full template CRUD in UI with Railway backend  
**Demo**: Create, edit, delete templates; see them persist across sessions  
**Depends On**: Railway `/api/templates` (already working ✅)

---

### T2.1: Wire Template Dropdown to useTemplates Hook [S - 30 min]

**Purpose**: Replace static templates with Railway-sourced templates

**File**: `src/components/BulkEmailModal.tsx`

**Implementation**:
```typescript
import { useTemplates } from '@/hooks/useTemplates';

// Replace static allTemplates with hook
const { templates, isLoading: templatesLoading, error: templatesError, reload: reloadTemplates } = useTemplates();

// Loading state for dropdown
{templatesLoading ? (
  <select disabled className="animate-pulse bg-gray-100">
    <option>Loading templates...</option>
  </select>
) : (
  <select
    aria-label="Select email template"
    value={selectedTemplateId || ''}
    onChange={(e) => handleTemplateSelect(e.target.value)}
  >
    <option value="">Select template...</option>
    {templates.map(t => (
      <option key={t.id} value={t.id}>{t.name}</option>
    ))}
  </select>
)}

// Error state
{templatesError && (
  <p className="text-xs text-red-500">Failed to load templates. Using defaults.</p>
)}
```

**Validation**:
```typescript
it('loads templates from Railway via useTemplates', async () => {
  mockUseTemplates.mockReturnValue({ templates: mockRailwayTemplates, isLoading: false });
  render(<BulkEmailModal ... />);
  expect(screen.getByText(mockRailwayTemplates[0].name)).toBeInTheDocument();
});

it('shows loading state while templates fetch', () => {
  mockUseTemplates.mockReturnValue({ templates: [], isLoading: true });
  render(<BulkEmailModal ... />);
  expect(screen.getByText('Loading templates...')).toBeInTheDocument();
});
```

**Exit Criteria**: Dropdown shows templates from Railway.

---

### T2.2: Implement "Save as Template" Flow [M - 45 min]

**Purpose**: Save current subject/body as new template

**File**: `src/components/BulkEmailModal.tsx`

**Implementation**:
```typescript
const [showSaveDialog, setShowSaveDialog] = useState(false);
const [newTemplateName, setNewTemplateName] = useState('');
const [isSaving, setIsSaving] = useState(false);

const handleSaveAsTemplate = async () => {
  if (!newTemplateName.trim() || !subject.trim() || !body.trim()) {
    toast.error('Name, subject, and body required');
    return;
  }
  
  setIsSaving(true);
  try {
    const result = await railwayClient.templates.create({
      name: newTemplateName,
      subject,
      body,
      category: 'custom',
      tone: selectedTone,
    });
    
    if (result.ok) {
      toast.success('Template saved!');
      setShowSaveDialog(false);
      setNewTemplateName('');
      reloadTemplates(); // Refresh template list
    } else {
      toast.error(result.error || 'Failed to save template');
    }
  } finally {
    setIsSaving(false);
  }
};

// Save dialog
{showSaveDialog && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-96">
      <h3 className="text-lg font-medium mb-4">Save as Template</h3>
      <input
        type="text"
        placeholder="Template name..."
        value={newTemplateName}
        onChange={(e) => setNewTemplateName(e.target.value)}
        className="w-full border rounded px-3 py-2 mb-4"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <button onClick={() => setShowSaveDialog(false)} disabled={isSaving}>
          Cancel
        </button>
        <button onClick={handleSaveAsTemplate} disabled={isSaving || !newTemplateName.trim()}>
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  </div>
)}

// Button in modal footer
<button onClick={() => setShowSaveDialog(true)} disabled={!subject || !body}>
  💾 Save as Template
</button>
```

**Validation**:
```typescript
it('saves template and refreshes list', async () => {
  mockRailwayClient.templates.create.mockResolvedValue({ ok: true, data: newTemplate });
  // Open modal, fill form, click save
  await waitFor(() => {
    expect(mockRailwayClient.templates.create).toHaveBeenCalled();
    expect(mockReloadTemplates).toHaveBeenCalled();
  });
});
```

**Exit Criteria**: Users can save custom templates to Railway.

---

### T2.3: Add Template Edit Button [S - 30 min]

**Purpose**: Edit selected template inline

**File**: `src/components/BulkEmailModal.tsx`

**Implementation**:
```typescript
const [isEditMode, setIsEditMode] = useState(false);

const handleUpdateTemplate = async () => {
  if (!selectedTemplateId) return;
  
  const result = await railwayClient.templates.update(selectedTemplateId, {
    subject,
    body,
    tone: selectedTone,
  });
  
  if (result.ok) {
    toast.success('Template updated!');
    setIsEditMode(false);
    reloadTemplates();
  } else {
    toast.error(result.error || 'Failed to update');
  }
};

// Edit button next to dropdown
{selectedTemplateId && !isEditMode && (
  <button onClick={() => setIsEditMode(true)} className="text-sm text-blue-600">
    ✏️ Edit
  </button>
)}

{isEditMode && (
  <div className="flex gap-2">
    <button onClick={handleUpdateTemplate} className="text-sm text-green-600">
      💾 Save Changes
    </button>
    <button onClick={() => setIsEditMode(false)} className="text-sm text-gray-500">
      Cancel
    </button>
  </div>
)}
```

**Validation**:
```typescript
it('updates template on save changes', async () => {
  // Select template, modify, click save
  expect(mockRailwayClient.templates.update).toHaveBeenCalledWith(templateId, expect.any(Object));
});
```

**Exit Criteria**: Users can edit existing templates.

---

### T2.4: Add Template Delete Confirmation [S - 25 min]

**Purpose**: Delete templates with confirmation

**File**: `src/components/BulkEmailModal.tsx`

**Implementation**:
```typescript
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

const handleDeleteTemplate = async () => {
  if (!selectedTemplateId) return;
  
  const result = await railwayClient.templates.delete(selectedTemplateId);
  
  if (result.ok) {
    toast.success('Template deleted');
    setSelectedTemplateId(null);
    setSubject('');
    setBody('');
    reloadTemplates();
  } else if (result.error?.includes('in_use')) {
    toast.error('Cannot delete: template is used in active sequences');
  } else {
    toast.error(result.error || 'Failed to delete');
  }
  setShowDeleteConfirm(false);
};

// Delete button
{selectedTemplateId && (
  <button onClick={() => setShowDeleteConfirm(true)} className="text-sm text-red-600">
    🗑️ Delete
  </button>
)}

// Confirmation dialog
{showDeleteConfirm && (
  <ConfirmDialog
    title="Delete Template?"
    message="This cannot be undone. Templates in use by sequences cannot be deleted."
    onConfirm={handleDeleteTemplate}
    onCancel={() => setShowDeleteConfirm(false)}
  />
)}
```

**Validation**:
```typescript
it('deletes template after confirmation', async () => {
  // Select template, click delete, confirm
  expect(mockRailwayClient.templates.delete).toHaveBeenCalledWith(templateId);
});

it('shows error when template in use', async () => {
  mockRailwayClient.templates.delete.mockResolvedValue({ ok: false, error: 'template_in_use' });
  // ... trigger delete
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('in use'));
});
```

**Exit Criteria**: Users can delete templates with proper error handling.

---

### T2.5: Template CRUD Integration Tests [M - 45 min]

**File**: Create `src/__tests__/components/BulkEmailModal.templates.test.tsx`

**Implementation**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkEmailModal } from '@/components/BulkEmailModal';

// Mock all dependencies
vi.mock('@/services/RailwayApiClient');
vi.mock('@/hooks/useTemplates');

describe('BulkEmailModal - Template CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Template Loading', () => {
    it('fetches templates from Railway on mount');
    it('shows loading skeleton while fetching');
    it('falls back to static templates on error');
  });

  describe('Template Selection', () => {
    it('populates subject/body when template selected');
    it('converts Railway body→subject fields correctly');
    it('applies tone from selected template');
  });

  describe('Save as Template', () => {
    it('opens save dialog on button click');
    it('validates name is required');
    it('calls create API with correct payload');
    it('refreshes template list after save');
  });

  describe('Edit Template', () => {
    it('enables edit mode for selected template');
    it('calls update API with changes');
    it('exits edit mode after save');
  });

  describe('Delete Template', () => {
    it('shows confirmation before delete');
    it('calls delete API on confirm');
    it('clears selection after delete');
    it('handles in-use error gracefully');
  });
});
```

**Validation**:
```bash
npm test -- --run BulkEmailModal.templates
```

**Exit Criteria**: All 15+ template tests pass.

---

### T2.6: Validate Template Name Uniqueness [S - 20 min]

**Purpose**: Pre-validate template name before save to avoid Railway error

**File**: `src/components/BulkEmailModal.tsx`

**Implementation**:
```typescript
const [nameError, setNameError] = useState<string | null>(null);

const validateTemplateName = useCallback((name: string) => {
  if (!name.trim()) {
    setNameError('Name is required');
    return false;
  }
  
  const existingNames = templates.map(t => t.name.toLowerCase());
  if (existingNames.includes(name.toLowerCase())) {
    setNameError('Template name already exists');
    return false;
  }
  
  setNameError(null);
  return true;
}, [templates]);

// In save handler
const handleSaveAsTemplate = async () => {
  if (!validateTemplateName(newTemplateName)) return;
  // ... proceed with save
};

// In UI
<input
  value={newTemplateName}
  onChange={(e) => {
    setNewTemplateName(e.target.value);
    validateTemplateName(e.target.value);
  }}
  className={nameError ? 'border-red-500' : ''}
/>
{nameError && <p className="text-xs text-red-500">{nameError}</p>}
```

**Validation**:
```typescript
it('shows error for duplicate template name', () => {
  mockTemplates([{ name: 'Existing Template', ... }]);
  render(<BulkEmailModal ... />);
  // Open save dialog, enter "Existing Template"
  expect(screen.getByText('Template name already exists')).toBeInTheDocument();
});
```

**Exit Criteria**: Duplicate names prevented client-side.

---

## Sprint 3: Email Compose Flow (Complements Railway Sprint 4)

**Goal**: Complete email composition with AI, templates, and preview  
**Demo**: Select prospects → choose template/generate AI → preview → send  
**Depends On**: Railway `/api/outreach/send-email` verified

---

### T3.1: Add AI Generation Button with Tone Selector [M - 45 min]

**Purpose**: Complete AI generation UI with tone selection

**File**: `src/components/BulkEmailModal.tsx`

**Implementation**:
```typescript
type ToneOption = 'luis' | 'professional' | 'challenger';

const TONE_OPTIONS: { value: ToneOption; label: string; description: string }[] = [
  { value: 'luis', label: 'Luis Style', description: 'Short, punchy, metrics-driven' },
  { value: 'professional', label: 'Professional', description: 'Formal, value-focused' },
  { value: 'challenger', label: 'Challenger', description: 'Provocative questions' },
];

const [selectedTone, setSelectedTone] = useState<ToneOption>('professional');
const [isGenerating, setIsGenerating] = useState(false);

const handleGenerateAI = async () => {
  if (!firstProspect) return;
  
  setIsGenerating(true);
  try {
    const result = await railwayClient.ai.generateContent({
      type: 'email',
      tone: selectedTone, // lowercase for AI endpoint
      goal: 'Schedule meeting to discuss yard management',
      context: {
        prospectName: firstProspect.name || 'there',
        companyName: firstProspect.company || 'your company',
        title: firstProspect.title,
      },
    });
    
    if (result.ok && result.data) {
      setSubject(result.data.subject || '');
      setBody(result.data.content);
      toast.success(`Generated with ${result.data.provider || 'AI'}`);
    } else {
      handleAIError(result);
    }
  } finally {
    setIsGenerating(false);
  }
};

// UI Layout
<div className="flex items-center gap-3 mb-4">
  <select
    value={selectedTone}
    onChange={(e) => setSelectedTone(e.target.value as ToneOption)}
    className="border rounded px-3 py-2"
    aria-label="Select voice/tone"
  >
    {TONE_OPTIONS.map(opt => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
  
  <button
    onClick={handleGenerateAI}
    disabled={isGenerating || !firstProspect}
    className="bg-purple-600 text-white px-4 py-2 rounded flex items-center gap-2"
  >
    {isGenerating ? (
      <>
        <Loader className="animate-spin h-4 w-4" />
        Generating...
      </>
    ) : (
      <>✨ Generate AI</>
    )}
  </button>
</div>
```

**Validation**:
```typescript
it('calls AI with selected tone', async () => {
  render(<BulkEmailModal ... />);
  
  // Select luis tone
  fireEvent.change(screen.getByLabelText(/voice/i), { target: { value: 'luis' } });
  fireEvent.click(screen.getByText(/generate ai/i));
  
  await waitFor(() => {
    expect(mockRailwayClient.ai.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'luis' })
    );
  });
});
```

**Exit Criteria**: AI generation works with tone selection.

---

### T3.2: Add Live Preview Panel [S - 30 min]

**Purpose**: Show personalized preview for first prospect

**File**: `src/components/BulkEmailModal.tsx`

**Implementation**:
```typescript
const firstProspect = useMemo(() => 
  selectedProspects.find(p => p.email) || selectedProspects[0],
  [selectedProspects]
);

const previewContent = useMemo(() => {
  if (!subject || !body || !firstProspect) return null;
  
  return {
    subject: personalizeString(subject, firstProspect),
    body: personalizeString(body, firstProspect),
  };
}, [subject, body, firstProspect]);

function personalizeString(text: string, prospect: Prospect): string {
  return text
    .replace(/{first_name}/g, prospect.name?.split(' ')[0] || 'there')
    .replace(/{name}/g, prospect.name || 'there')
    .replace(/{company}/g, prospect.company || 'your company')
    .replace(/{title}/g, prospect.title || '')
    .replace(/{calendly_url}/g, CALENDLY_CONFIG.url);
}

// Preview panel
<div className="bg-gray-50 rounded-lg p-4 border">
  <div className="flex items-center justify-between mb-2">
    <h4 className="text-sm font-medium text-gray-700">
      Preview for {firstProspect?.name || 'first prospect'}
    </h4>
    <span className="text-xs text-gray-400">
      {selectedProspects.length} recipient{selectedProspects.length !== 1 ? 's' : ''}
    </span>
  </div>
  
  {previewContent ? (
    <div className="space-y-2">
      <p className="font-medium text-sm">{previewContent.subject}</p>
      <p className="text-sm text-gray-600 whitespace-pre-wrap">{previewContent.body}</p>
    </div>
  ) : (
    <p className="text-sm text-gray-400 italic">Enter subject and body to see preview</p>
  )}
</div>
```

**Validation**:
```typescript
it('shows personalized preview with prospect data', () => {
  render(<BulkEmailModal prospects={[{ name: 'John Doe', company: 'Acme' }]} ... />);
  
  fireEvent.change(screen.getByLabelText(/subject/i), { target: { value: 'Hi {first_name}' } });
  
  expect(screen.getByText('Hi John')).toBeInTheDocument();
});
```

**Exit Criteria**: Preview shows personalized content in real-time.

---

### T3.3: Add Character Count Validation [XS - 20 min]

**Purpose**: Warn when content exceeds recommended limits

**File**: `src/components/BulkEmailModal.tsx`

**Implementation**:
```typescript
const LIMITS = {
  subject: 60,
  body: { luis: 500, professional: 1000, challenger: 800 },
};

const subjectLength = subject.length;
const bodyLength = body.length;
const bodyLimit = LIMITS.body[selectedTone];

const isSubjectOverLimit = subjectLength > LIMITS.subject;
const isBodyOverLimit = bodyLength > bodyLimit;

// Subject field with counter
<div className="relative">
  <input
    value={subject}
    onChange={(e) => setSubject(e.target.value)}
    className={isSubjectOverLimit ? 'border-yellow-500' : ''}
    placeholder="Subject..."
  />
  <span className={`absolute right-2 top-2 text-xs ${isSubjectOverLimit ? 'text-yellow-600' : 'text-gray-400'}`}>
    {subjectLength}/{LIMITS.subject}
  </span>
</div>

// Body field with counter
<div className="relative">
  <textarea
    value={body}
    onChange={(e) => setBody(e.target.value)}
    className={isBodyOverLimit ? 'border-yellow-500' : ''}
    placeholder="Email body..."
  />
  <span className={`absolute right-2 bottom-2 text-xs ${isBodyOverLimit ? 'text-yellow-600' : 'text-gray-400'}`}>
    {bodyLength}/{bodyLimit}
  </span>
</div>

// Warning banner
{(isSubjectOverLimit || isBodyOverLimit) && (
  <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm text-yellow-700">
    ⚠️ Content exceeds recommended limits for {selectedTone} tone. Consider shortening.
  </div>
)}
```

**Validation**:
```typescript
it('shows warning when subject exceeds 60 chars', () => {
  render(<BulkEmailModal ... />);
  fireEvent.change(screen.getByLabelText(/subject/i), { 
    target: { value: 'A'.repeat(70) } 
  });
  expect(screen.getByText(/exceeds recommended/i)).toBeInTheDocument();
});
```

**Exit Criteria**: Character limits enforced with visual feedback.

---

### T3.4: Add Send Confirmation with Summary [S - 30 min]

**Purpose**: Confirm before sending with recipient summary

**File**: `src/components/BulkEmailModal.tsx`

**Implementation**:
```typescript
const [showSendConfirm, setShowSendConfirm] = useState(false);

const eligibleRecipients = selectedProspects.filter(p => 
  p.email && p.enrollmentStatus !== 'active'
);
const skippedRecipients = selectedProspects.filter(p => 
  !p.email || p.enrollmentStatus === 'active'
);

const handleConfirmSend = async () => {
  setShowSendConfirm(false);
  // Proceed with send
  await handleBulkSend();
};

// Pre-send confirmation
{showSendConfirm && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-[500px]">
      <h3 className="text-lg font-medium mb-4">Confirm Send</h3>
      
      <div className="space-y-3 mb-6">
        <div className="flex justify-between">
          <span>Recipients</span>
          <span className="font-medium text-green-600">{eligibleRecipients.length}</span>
        </div>
        {skippedRecipients.length > 0 && (
          <div className="flex justify-between text-yellow-600">
            <span>Skipped (no email or in sequence)</span>
            <span>{skippedRecipients.length}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Tone</span>
          <span>{selectedTone}</span>
        </div>
      </div>
      
      <div className="bg-gray-50 rounded p-3 mb-4">
        <p className="text-sm font-medium">{subject}</p>
        <p className="text-sm text-gray-600 mt-1 line-clamp-3">{body}</p>
      </div>
      
      <div className="flex justify-end gap-2">
        <button onClick={() => setShowSendConfirm(false)}>Cancel</button>
        <button 
          onClick={handleConfirmSend}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Send to {eligibleRecipients.length} recipients
        </button>
      </div>
    </div>
  </div>
)}
```

**Validation**:
```typescript
it('shows send confirmation with recipient count', () => {
  render(<BulkEmailModal prospects={mockProspects} ... />);
  // Fill form, click send
  expect(screen.getByText(/send to 5 recipients/i)).toBeInTheDocument();
});

it('shows skipped recipients count', () => {
  // Include prospect without email
  expect(screen.getByText(/skipped.*1/i)).toBeInTheDocument();
});
```

**Exit Criteria**: Send confirmation shows complete summary.

---

### T3.5: Email Compose Flow Integration Tests [M - 45 min]

**File**: Create `src/__tests__/components/BulkEmailModal.compose.test.tsx`

**Implementation**:
```typescript
describe('BulkEmailModal - Compose Flow', () => {
  describe('AI Generation', () => {
    it('generates content with selected tone');
    it('shows loading state during generation');
    it('handles generation errors gracefully');
    it('shows provider in success message');
  });

  describe('Preview', () => {
    it('personalizes tokens in preview');
    it('updates preview in real-time');
    it('shows recipient count');
  });

  describe('Validation', () => {
    it('warns when subject exceeds limit');
    it('adjusts body limit based on tone');
    it('disables send when required fields empty');
  });

  describe('Send Confirmation', () => {
    it('shows confirmation dialog before send');
    it('displays recipient summary');
    it('excludes prospects without email');
    it('excludes prospects in active sequences');
  });
});
```

**Validation**:
```bash
npm test -- --run BulkEmailModal.compose
```

**Exit Criteria**: All compose flow tests pass.

---

### T3.6: Add Debounce to AI Generate Button [S - 20 min]

**Purpose**: Prevent accidental double-clicks triggering multiple AI requests

**File**: `src/components/BulkEmailModal.tsx`

**Implementation**:
```typescript
const [lastGenerateTime, setLastGenerateTime] = useState(0);
const DEBOUNCE_MS = 3000; // 3 second cooldown

const handleGenerateAI = async () => {
  const now = Date.now();
  if (now - lastGenerateTime < DEBOUNCE_MS) {
    toast.info('Please wait before generating again');
    return;
  }
  
  if (!firstProspect) return;
  
  setLastGenerateTime(now);
  setIsGenerating(true);
  // ... rest of generation logic
};

// Button also guarded by isGenerating
<button
  onClick={handleGenerateAI}
  disabled={isGenerating || !firstProspect}
  className={isGenerating ? 'opacity-50' : ''}
>
  {isGenerating ? (
    <>
      <Loader className="animate-spin h-4 w-4" />
      Generating...
    </>
  ) : (
    <>✨ Generate AI</>
  )}
</button>
```

**Validation**:
```typescript
it('prevents double-click within 3 seconds', async () => {
  render(<BulkEmailModal ... />);
  
  fireEvent.click(screen.getByText(/generate ai/i));
  await act(() => Promise.resolve()); // Let first request start
  
  fireEvent.click(screen.getByText(/generate ai/i)); // Second click
  
  expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('wait'));
  expect(mockAIGenerate).toHaveBeenCalledTimes(1);
});
```

**Exit Criteria**: Double-click prevented with debounce.

---

## Sprint 4: Prospect Management UI (Complements Railway Sprint 5)

**Goal**: View and manage prospects with activity timeline  
**Demo**: View prospect list → click prospect → see activity timeline  
**Depends On**: Railway `/api/activity` endpoint

---

### T4.1: Create ProspectDetailPanel Component [M - 1 hour]

**Purpose**: Detailed view of single prospect with timeline

**File**: Create `src/components/ProspectDetailPanel.tsx`

**Implementation**:
```typescript
import { useState, useEffect } from 'react';
import { railwayClient } from '@/services/RailwayApiClient';

interface Activity {
  id: string;
  type: 'email_sent' | 'email_opened' | 'email_clicked' | 'meeting_booked' | 'reply_received';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface ProspectDetailPanelProps {
  prospectId: string;
  onClose: () => void;
}

export function ProspectDetailPanel({ prospectId, onClose }: ProspectDetailPanelProps) {
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [prospectRes, activityRes] = await Promise.all([
          railwayClient.prospects.get(prospectId),
          railwayClient.activity.list({ personId: prospectId }),
        ]);
        
        if (prospectRes.ok) setProspect(prospectRes.data);
        if (activityRes.ok) setActivities(activityRes.data);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [prospectId]);

  if (isLoading) return <DetailPanelSkeleton />;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl border-l">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-medium">{prospect?.name}</h2>
        <button onClick={onClose}>×</button>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Prospect Info */}
        <div className="space-y-2">
          <InfoRow label="Company" value={prospect?.company} />
          <InfoRow label="Title" value={prospect?.title} />
          <InfoRow label="Email" value={prospect?.email} />
          <InfoRow label="Tier" value={prospect?.tier} />
        </div>
        
        {/* Activity Timeline */}
        <div className="border-t pt-4">
          <h3 className="font-medium mb-3">Activity Timeline</h3>
          {activities.length === 0 ? (
            <p className="text-sm text-gray-400">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {activities.map(activity => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ activity }: { activity: Activity }) {
  const icons: Record<string, string> = {
    email_sent: '📤',
    email_opened: '👁️',
    email_clicked: '🔗',
    meeting_booked: '📅',
    reply_received: '💬',
  };
  
  return (
    <div className="flex items-start gap-3 text-sm">
      <span>{icons[activity.type] || '•'}</span>
      <div>
        <p className="font-medium">{formatActivityType(activity.type)}</p>
        <p className="text-xs text-gray-400">{formatDate(activity.timestamp)}</p>
      </div>
    </div>
  );
}
```

**Validation**:
```typescript
it('loads prospect and activity data', async () => {
  render(<ProspectDetailPanel prospectId="123" onClose={() => {}} />);
  await waitFor(() => {
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Email Sent')).toBeInTheDocument();
  });
});
```

**Exit Criteria**: Detail panel shows prospect info and activity timeline.

---

### T4.2: Add Activity API to RailwayApiClient [S - 20 min]

**Purpose**: Typed activity API methods

**File**: `src/services/RailwayApiClient.ts`

**Implementation**:
```typescript
activity = {
  list: async (params: { 
    personId?: string; 
    accountId?: string; 
    limit?: number;
    cursor?: string;
  }): Promise<RailwayApiResult<Activity[]>> => {
    const query = new URLSearchParams();
    if (params.personId) query.set('personId', params.personId);
    if (params.accountId) query.set('accountId', params.accountId);
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.cursor) query.set('cursor', params.cursor);
    
    return this.get(`/activity?${query.toString()}`);
  },
};
```

**Validation**:
```typescript
it('fetches activity with person filter', async () => {
  await client.activity.list({ personId: '123' });
  expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('personId=123'));
});
```

**Exit Criteria**: Activity API method works with filters.

---

### T4.3: Wire Detail Panel to Prospect List [S - 30 min]

**Purpose**: Click prospect row to open detail panel

**File**: `src/components/ProspectListView.tsx` (or equivalent)

**Implementation**:
```typescript
const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);

// Row click handler
<tr 
  key={prospect.id}
  onClick={() => setSelectedProspectId(prospect.id)}
  className="cursor-pointer hover:bg-gray-50"
>
  {/* ... row content */}
</tr>

// Detail panel
{selectedProspectId && (
  <ProspectDetailPanel
    prospectId={selectedProspectId}
    onClose={() => setSelectedProspectId(null)}
  />
)}
```

**Validation**: Manual - click prospect row, panel opens.

**Exit Criteria**: Prospect list integrates with detail panel.

---

### T4.4: Add Quick Actions to Detail Panel [S - 30 min]

**Purpose**: Quick actions (email, enroll in sequence) from panel

**File**: `src/components/ProspectDetailPanel.tsx`

**Implementation**:
```typescript
// Quick action buttons
<div className="flex gap-2 mb-4">
  <button
    onClick={() => onOpenEmail(prospect)}
    className="flex-1 bg-blue-600 text-white py-2 rounded text-sm"
  >
    📧 Send Email
  </button>
  <button
    onClick={() => onEnrollSequence(prospect)}
    className="flex-1 bg-purple-600 text-white py-2 rounded text-sm"
  >
    📋 Add to Sequence
  </button>
</div>
```

**Validation**:
```typescript
it('triggers email action on button click', () => {
  const onOpenEmail = vi.fn();
  render(<ProspectDetailPanel onOpenEmail={onOpenEmail} ... />);
  fireEvent.click(screen.getByText(/send email/i));
  expect(onOpenEmail).toHaveBeenCalled();
});
```

**Exit Criteria**: Quick actions work from detail panel.

---

### T4.5: Prospect Management Tests [M - 45 min]

**File**: Create `src/__tests__/components/ProspectDetailPanel.test.tsx`

**Implementation**:
```typescript
describe('ProspectDetailPanel', () => {
  describe('Data Loading', () => {
    it('fetches prospect and activity on mount');
    it('shows loading skeleton while fetching');
    it('handles prospect not found');
  });

  describe('Display', () => {
    it('shows prospect info fields');
    it('renders activity timeline');
    it('formats activity timestamps');
    it('shows empty state when no activity');
  });

  describe('Quick Actions', () => {
    it('triggers email action');
    it('triggers sequence action');
  });
});
```

**Validation**:
```bash
npm test -- --run ProspectDetailPanel
```

**Exit Criteria**: All prospect panel tests pass.

---

### T4.6: Add Activity Timeline Pagination [S - 30 min]

**Purpose**: Load more activities for prospects with extensive history

**File**: `src/components/ProspectDetailPanel.tsx`

**Implementation**:
```typescript
const [activities, setActivities] = useState<Activity[]>([]);
const [cursor, setCursor] = useState<string | null>(null);
const [hasMore, setHasMore] = useState(false);
const [isLoadingMore, setIsLoadingMore] = useState(false);

const loadActivities = async (reset = false) => {
  if (reset) {
    setActivities([]);
    setCursor(null);
  }
  
  const result = await railwayClient.activity.list({
    personId: prospectId,
    limit: 10,
    cursor: reset ? undefined : cursor,
  });
  
  if (result.ok) {
    setActivities(prev => reset ? result.data.items : [...prev, ...result.data.items]);
    setCursor(result.data.nextCursor);
    setHasMore(!!result.data.nextCursor);
  }
};

const handleLoadMore = async () => {
  setIsLoadingMore(true);
  await loadActivities(false);
  setIsLoadingMore(false);
};

// In timeline section
<div className="space-y-3">
  {activities.map(activity => (
    <ActivityItem key={activity.id} activity={activity} />
  ))}
  
  {hasMore && (
    <button
      onClick={handleLoadMore}
      disabled={isLoadingMore}
      className="text-sm text-blue-600 w-full py-2"
    >
      {isLoadingMore ? 'Loading...' : 'Load more activity'}
    </button>
  )}
</div>
```

**Validation**:
```typescript
it('loads more activities on button click', async () => {
  mockActivityList.mockResolvedValueOnce({ 
    ok: true, 
    data: { items: activities1, nextCursor: 'cursor-1' } 
  });
  mockActivityList.mockResolvedValueOnce({ 
    ok: true, 
    data: { items: activities2, nextCursor: null } 
  });
  
  render(<ProspectDetailPanel ... />);
  
  await waitFor(() => screen.getByText('Load more'));
  fireEvent.click(screen.getByText('Load more'));
  
  await waitFor(() => {
    expect(activities2[0].type).toBeInTheDocument();
    expect(screen.queryByText('Load more')).not.toBeInTheDocument();
  });
});
```

**Exit Criteria**: Activity timeline supports pagination.

---

## Sprint 5: Meeting Attribution UI (Complements Railway Sprint 6)

**Goal**: Display meeting attribution and ROI metrics  
**Demo**: View dashboard showing emails sent → meetings booked conversion  
**Depends On**: Railway `/api/meetings` with outreach linking

---

### T5.1: Create MeetingAttributionCard Component [M - 45 min]

**Purpose**: Show email-to-meeting conversion metrics

**File**: Create `src/components/MeetingAttributionCard.tsx`

**Implementation**:
```typescript
interface MeetingMetrics {
  emailsSent: number;
  meetingsBooked: number;
  conversionRate: number;
  recentMeetings: Array<{
    id: string;
    prospectName: string;
    companyName: string;
    bookedAt: string;
    sourceOutreachId?: string;
  }>;
}

export function MeetingAttributionCard() {
  const [metrics, setMetrics] = useState<MeetingMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const result = await railwayClient.meetings.getMetrics();
      if (result.ok) setMetrics(result.data);
      setIsLoading(false);
    }
    load();
  }, []);

  if (isLoading) return <CardSkeleton />;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-medium mb-4">Meeting Attribution</h3>
      
      <div className="grid grid-cols-3 gap-4 mb-4">
        <MetricBox label="Emails Sent" value={metrics?.emailsSent || 0} />
        <MetricBox label="Meetings Booked" value={metrics?.meetingsBooked || 0} />
        <MetricBox 
          label="Conversion" 
          value={`${((metrics?.conversionRate || 0) * 100).toFixed(1)}%`}
          highlight
        />
      </div>
      
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium mb-2">Recent Meetings</h4>
        {metrics?.recentMeetings.length === 0 ? (
          <p className="text-sm text-gray-400">No meetings yet</p>
        ) : (
          <div className="space-y-2">
            {metrics?.recentMeetings.slice(0, 5).map(meeting => (
              <div key={meeting.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{meeting.prospectName}</p>
                  <p className="text-xs text-gray-400">{meeting.companyName}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{formatDate(meeting.bookedAt)}</p>
                  {meeting.sourceOutreachId && (
                    <span className="text-xs text-green-600">📧 Attributed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Validation**:
```typescript
it('displays conversion rate correctly', () => {
  mockMetrics({ emailsSent: 100, meetingsBooked: 5, conversionRate: 0.05 });
  render(<MeetingAttributionCard />);
  expect(screen.getByText('5.0%')).toBeInTheDocument();
});

it('shows attribution badge for linked meetings', () => {
  mockMetrics({ recentMeetings: [{ ...meeting, sourceOutreachId: 'abc' }] });
  render(<MeetingAttributionCard />);
  expect(screen.getByText('Attributed')).toBeInTheDocument();
});
```

**Exit Criteria**: Card shows conversion metrics and attribution.

---

### T5.2: Add Meetings API to RailwayApiClient [S - 20 min]

**# T5.5: Verify Calendly Webhook → Railway Sync [M - 45 min]

**Purpose**: Ensure Calendly meetings sync to Railway for attribution

**File**: Update `api/webhooks/calendly.ts`

**Context**: GTM-YardFlow receives Calendly webhooks, but Railway owns meeting storage. We need to forward meeting data to Railway for attribution.

**Implementation**:
```typescript
import { railwayServerClient } from '../../lib/railway-client';

// After Firestore update, sync to Railway
async function syncMeetingToRailway(meeting: CalendlyEvent, prospectId: string) {
  try {
    await railwayServerClient.post('/api/meetings/sync', {
      calendlyEventId: meeting.event.uuid,
      prospectId,
      email: meeting.invitee.email,
      scheduledAt: meeting.event.start_time,
      status: 'scheduled',
      metadata: {
        eventType: meeting.event.event_type,
        location: meeting.event.location?.location,
      },
    });
    logger.info('Meeting synced to Railway', { eventId: meeting.event.uuid });
  } catch (err) {
    // Non-blocking - Railway sync failure shouldn't break Firestore update
    logger.warn('Failed to sync meeting to Railway', { error: err });
  }
}

// In main handler after Firestore write
if (event === 'invitee.created') {
  await syncMeetingToRailway(payload, matchedProspectId);
}
```

**Validation**:
```typescript
describe('Calendly Webhook → Railway Sync', () => {
  it('syncs new meeting to Railway', async () => {
    const webhookPayload = createCalendlyWebhook('invitee.created');
    await handler(createRequest(webhookPayload), mockRes);
    
    expect(railwayServerClient.post).toHaveBeenCalledWith(
      '/api/meetings/sync',
      expect.objectContaining({
        calendlyEventId: webhookPayload.event.uuid,
        status: 'scheduled',
      })
    );
  });

  it('continues on Railway sync failure', async () => {
    railwayServerClient.post.mockRejectedValue(new Error('Railway down'));
    const webhookPayload = createCalendlyWebhook('invitee.created');
    
    await handler(createRequest(webhookPayload), mockRes);
    
    // Firestore should still update
    expect(mockFirestoreUpdate).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });
});
```

**Exit Criteria**: Calendly meetings sync to Railway for attribution.

---

##Purpose**: Typed meetings API methods

**File**: `src/services/RailwayApiClient.ts`

**Implementation**:
```typescript
meetings = {
  list: async (params?: { 
    status?: 'scheduled' | 'completed' | 'cancelled';
    limit?: number;
  }): Promise<RailwayApiResult<Meeting[]>> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', params.limit.toString());
    
    return this.get(`/meetings?${query.toString()}`);
  },
  
  getMetrics: async (): Promise<RailwayApiResult<MeetingMetrics>> => {
    return this.get('/meetings/metrics');
  },
};
```

**Validation**:
```typescript
it('fetches meeting metrics', async () => {
  await client.meetings.getMetrics();
  expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/meetings/metrics'));
});
```

**Exit Criteria**: Meetings API methods work.

---

### T5.3: Add Attribution Card to Dashboard [XS - 15 min]

**Purpose**: Wire attribution card into dashboard

**File**: `src/components/dashboard/DashboardOverview.tsx`

**Implementation**:
```typescript
import { MeetingAttributionCard } from '@/components/MeetingAttributionCard';

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <RailwayHealthCard />
  <EmailStatsCard />
  <MeetingAttributionCard />
  {/* ... */}
</div>
```

**Validation**: Manual - card visible on dashboard.

**Exit Criteria**: Attribution card on dashboard.

---

### T5.4: Meeting Attribution Tests [S - 30 min]

**File**: Create `src/__tests__/components/MeetingAttributionCard.test.tsx`

**Implementation**:
```typescript
describe('MeetingAttributionCard', () => {
  it('displays email and meeting counts');
  it('calculates conversion rate');
  it('shows recent meetings');
  it('indicates attributed meetings');
  it('handles empty state');
});
```

**Validation**:
```bash
npm test -- --run MeetingAttributionCard
```

**Exit Criteria**: All attribution tests pass.

---

## Sprint 6: E2E Integration Testing

**Goal**: Full E2E test coverage for complete workflows  
**Demo**: Automated tests pass for complete user journeys

---

### T6.1: Create Playwright E2E Test Suite [L - 2 hours]

**File**: Create `e2e/complete-workflow.spec.ts`

**Implementation**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Complete Email Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Auth setup if needed
  });

  test('generates AI content and sends bulk email', async ({ page }) => {
    // 1. Navigate to prospects
    await page.click('text=Prospects');
    
    // 2. Select prospects
    await page.getByTestId('prospect-checkbox-0').click();
    await page.getByTestId('prospect-checkbox-1').click();
    
    // 3. Open bulk email modal
    await page.getByRole('button', { name: /send email/i }).click();
    
    // 4. Select template
    await page.getByRole('combobox', { name: /template/i }).selectOption({ index: 1 });
    
    // 5. Or generate AI
    await page.getByRole('combobox', { name: /tone/i }).selectOption('luis');
    await page.getByRole('button', { name: /generate ai/i }).click();
    
    // 6. Wait for content
    await expect(page.getByLabelText(/subject/i)).not.toBeEmpty({ timeout: 10000 });
    
    // 7. Verify preview
    await expect(page.getByText(/preview/i)).toBeVisible();
    
    // 8. Send
    await page.getByRole('button', { name: /send/i }).click();
    
    // 9. Confirm
    await page.getByRole('button', { name: /confirm/i }).click();
    
    // 10. Verify success
    await expect(page.getByText(/sent.*2.*email/i)).toBeVisible({ timeout: 30000 });
  });

  test('saves and reuses custom template', async ({ page }) => {
    // ... template CRUD flow
  });

  test('views prospect activity timeline', async ({ page }) => {
    // ... prospect detail flow
  });
});
```

**Validation**:
```bash
npm run test:e2e -- complete-workflow.spec.ts
```

**Exit Criteria**: E2E tests pass.

---

### T6.2: Create Health Check Script [S - 30 min]

**File**: Create `scripts/health-check.ts`

**Implementation**:
```typescript
#!/usr/bin/env npx tsx

const CHECKS = [
  { name: 'Vercel App', url: process.env.VERCEL_URL || 'https://gtm-yard-flow.vercel.app' },
  { name: 'Railway API', url: 'https://yardflow-hitlist-production-2f41.up.railway.app/api/health' },
  { name: 'Railway Templates', url: 'https://yardflow-hitlist-production-2f41.up.railway.app/api/templates' },
];

async function checkHealth() {
  console.log('🏥 Running health checks...\n');
  
  const results = await Promise.all(
    CHECKS.map(async ({ name, url }) => {
      try {
        const res = await fetch(url, {
          headers: { 'x-service-key': process.env.SERVICE_TO_SERVICE_SECRET || '' },
        });
        return { name, status: res.ok ? 'ok' : `error (${res.status})`, latency: 0 };
      } catch (e) {
        return { name, status: 'unreachable', latency: 0 };
      }
    })
  );
  
  results.forEach(r => {
    const icon = r.status === 'ok' ? '✅' : '❌';
    console.log(`${icon} ${r.name}: ${r.status}`);
  });
  
  const allOk = results.every(r => r.status === 'ok');
  process.exit(allOk ? 0 : 1);
}

checkHealth();
```

**Validation**:
```bash
npx tsx scripts/health-check.ts
```

**Exit Criteria**: Health check script works.

---

### T6.3: Add Firebase Auth Mock for E2E Tests [M - 45 min]

**Purpose**: Enable E2E tests with authenticated sessions

**File**: Create `e2e/fixtures/auth.ts`

**Implementation**: ──▶ T0.5
       │
       └──▶ S1 (Health Dashboard)
              └── T1.1 ──▶ T1.2 ──▶ T1.3 ──▶ T1.4

S2 (Template UI) - Can start in parallel with S0/S1
  └── T2.1 ──▶ T2.2 ──▶ T2.3 ──▶ T2.4 ──▶ T2.5 ──▶ T2.6
       │
       └──▶ S3 (Email Compose)
              └── T3.1 ──▶ T3.2 ──▶ T3.3 ──▶ T3.4 ──▶ T3.5 ──▶ T3.6

S4 (Prospect Management) - Depends on Railway activity API
  └── T4.1 ──▶ T4.2 ──▶ T4.3 ──▶ T4.4 ──▶ T4.5 ──▶ T4.6

S5 (Meeting Attribution) - Depends on Railway meetings API
  └── T5.1 ──▶ T5.2 ──▶ T5.3 ──▶ T5.4 ──▶ T5.5

S6 (E2E Testing) - After S0-S5 complete
  └── T6.1 ──▶ T6.2 ──▶ T6.3 ──▶ T6.4 && TEST_PASSWORD) {
      // Perform login flow
      await page.click('[data-testid="sign-in-button"]');
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      await page.click('button[type="submit"]');
      
      // Wait for auth to complete
      await page.waitForSelector('[data-testid="user-menu"]', { timeout: 10000 });
    }
    
    // Use authenticated page
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

**Update E2E Tests**:
```typescript
// e2e/complete-workflow.spec.ts
import { test, expect } from './fixtures/auth';

test.describe('Complete Email Workflow', () => {
  test('generates AI content and sends bulk email', async ({ authenticatedPage: page }) => {
    // Page is already authenticated
    await page.click('text=Prospects');
    // ... rest of test
  });
});
```

**Validation**:
```bash
# Run with test credentials
E2E_TEST_EMAIL=test@yardflow.com E2E_TEST_PASSWORD=secret npm run test:e2e
```

**Exit Criteria**: E2E tests run with authenticated user sessions.

---

### T6.4: Create Shared Types File [S - 20 min]

**Purpose**: Consolidate V28 interface definitions

**File**: Create `src/types/railway-v28.ts`

**Implementation**:
```typescript
// ========================
// AI Types
// ========================
export type AITone = 'luis' | 'professional' | 'challenger';

export interface AIContentPayload {
  type: 'email' | 'follow_up' | 'linkedin';
  tone: AITone;
  goal: string;
  context: {
    prospectName?: string;
    companyName?: string;
    title?: string;
    industry?: string;
  };
}

export interface AIContentResponse {
  subject?: string;
  content: string;
  provider: 'gemini' | 'openai';
  model: string;
}

export interface AIGenerationResult {
  success: boolean;
  content?: AIContentResponse;
  provider?: 'gemini' | 'openai';
  error?: string;
  retryAfterSeconds?: number;
  fallbackUsed?: string;
}

// ========================
// Health Types
// ========================
export interface HealthCheck {
  status: 'ok' | 'degraded' | 'error';
  latencyMs?: number;
}

export interface RailwayHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    system: HealthCheck;
    database: HealthCheck;
    redis: HealthCheck;
    ai?: {
      gemini: HealthCheck & { quotaRemaining?: number };
      openai: HealthCheck;
    };
  };
  version?: string;
}

// ========================
// Activity Types
// ========================
export type ActivityType = 
  | 'email_sent' 
  | 'email_opened' 
  | 'email_clicked' 
  | 'meeting_booked' 
  | 'reply_received';

export interface Activity {
  id: string;
  type: ActivityType;
  timestamp: string;
  personId?: string;
  accountId?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityListResponse {
  items: Activity[];
  nextCursor: string | null;
}

// ========================
// Meeting Types
// ========================
export interface Meeting {
  id: string;
  prospectId: string;
  prospectName: string;
  companyName: string;
  scheduledAt: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  sourceOutreachId?: string;
  calendlyEventId?: string;
}

export interface MeetingMetrics {
  emailsSent: number;
  meetingsBooked: number;
  conversionRate: number;
  recentMeetings: Meeting[];
}

// ========================
// Template Types (from existing adapter)
// ========================
export { type GTMTemplate, type RailwayTemplate } from '../utils/templateAdapter';
```

**Validation**:
```typescript
// Verify types are exported correctly
import type { AITone, RailwayHealth, Meeting } from '@/types/railway-v28';
```

**Exit Criteria**: Types consolidated in single file, imported where needed.

---

## Dependency Matrix

```
GTM-YardFlow Sprint Dependencies:

S0 (AI Fallback UX)
  └── T0.1 ──▶ T0.2 ──▶ T0.3 ──▶ T0.4
       │
       └──▶ S1 (Health Dashboard)
              └── T1.1 ──▶ T1.2 ──▶ T1.3 ──▶ T1.4

S2 (Template UI) - Can start in parallel with S0/S1
  └── T2.1 ──▶ T2.2 ──▶ T2.3 ──▶ T2.4 ──▶ T2.5
       │
       └──▶ S3 (Email Compose)
              └── T3.1 ──▶ T3.2 ──▶ T3.3 ──▶ T3.4 ──▶ T3.5

S4 (Prospect Management) - Depends on Railway activity API
  └── T4.1 ──▶ T4.2 ──▶ T4.3 ──▶ T4.4 ──▶ T4.5

S5 (Meeting Attribution) - Depends on Railway meetings API
  └── T5.1 ──▶ T5.2 ──▶ T5.3 ──▶ T5.4

S6 (E2E Testing) - After S0-S5 complete
  └── T6.1 ──▶ T6.2
```

---

## Cross-Repo Sync Points

| GTM Task | Depends On Railway | Sync Action |
|----------|-------------------|-------------|
| T0.1-T0.4 | T0.1 AI Provider | Wait for Railway to implement fallback |
| T1.1 Health Card | T1.1 Health AI Check | Health response includes AI status |
| T2.1-T2.5 Templates | Already working ✅ | None needed |
| T3.1 AI Generation | T0.1 complete | Ensure tone lowercase works |
| T4.1-T4.5 Activity | T5.5 Activity API | Wait for Railway activity endpoint |
| T5.1-T5.4 Meetings | T6.1 Meeting attribution | Wait for outreach→meeting link |

---

## Key Files Reference

| Purpose | Location |
|---------|----------|
| Railway API Client | `src/services/RailwayApiClient.ts` |
| Template Adapter | `src/utils/templateAdapter.ts` |
| Templates Hook | `src/hooks/useTemplates.ts` |
| Feature Flags | `src/config/featureFlags.ts` |
| Bulk Email Modal | `src/components/BulkEmailModal.tsx` |
| Health Dashboard | `src/components/RailwayHealthCard.tsx` (NEW) |
| Prospect Detail | `src/components/ProspectDetailPanel.tsx` (NEW) |
| Meeting Attribution | `src/components/MeetingAttributionCard.tsx` (NEW) |

---

## Acceptance Criteria Summary

| Sprint | Acceptance Criteria |
|--------|---------------------|
| S0 | AI fallback shows provider, handles rate limits gracefully |
| S1 | Health dashboard shows Railway + AI provider status |
| S2 | Template CRUD works end-to-end with Railway |
| S3 | Complete email compose flow with AI, preview, send |
| S4 | Prospect detail panel with activity timeline |
| S5 | Meeting attribution metrics on dashboard |
| S6 | E2E tests pass for all workflows |

---

## Rollback Plan

**If Railway API unavailable:**
1. Templates fall back to static (built-in)
2. AI button disabled with message
3. Health card shows error state
4. Activity/meetings cards show cached data

**If AI providers both unavailable:**
1. Generate button shows "unavailable"
2. Users continue with manual entry
3. Templates still work

---

*Document created by GitHub Copilot (Claude Opus 4.5)*  
*Created: February 4, 2026*

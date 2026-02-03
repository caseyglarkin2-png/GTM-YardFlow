# Sprint Plan V35: UI/UX Gate & Production Deployment

**Status**: ✅ DEPLOYED  
**Created**: February 3, 2026  
**Completed**: February 3, 2026  
**Goal**: Comprehensive UI/UX audit, fix critical issues, deploy to production  
**Commit**: `e3542f9` - `feat(sprint-34): UI/UX gate fixes`

---

## Executive Summary

This sprint focused on a full UI/UX gate check before production deployment. A subagent performed a comprehensive audit covering:
- Consistent styling
- Loading/empty/error states
- Keyboard navigation & accessibility
- Toast notifications
- Form validation
- TypeScript type safety

### Audit Grade: B+ → A- (after fixes)

## 2026-02-03 Updates (Sprint A & B execution)

| Task | Status | Notes |
|------|--------|-------|
| TA.2 Railway health hook | ✅ | Added polling/timeout hook `useRailwayHealth` with feature-flag bypass. |
| TA.3 Email fallback via health | ✅ | `useRailwayEmail` now falls back to `/api/email/send` when Railway unhealthy. |
| TA.4 Sidebar connection indicator | ✅ | Health LED + text in sidebar header (prop-driven). |
| TA.5 Offline/online toasts | ✅ | Global toasts from App on status transitions. |
| TB.1 Modal focus traps | ✅ | Applied `useFocusTrap` to bulk modals and command palette. |
| TB.2 Keyboard shortcuts help | ✅ | '?' opens modal listing core shortcuts with focus trap. |
| TB.4 ARIA live updates | ✅ | Toast container now `aria-live="polite"`/`aria-atomic`. |

Tests: `npx tsc --noEmit` (fails: missing @sentry/node types; existing EmailQueueService.test typing mismatch).

---

## Completed Sprints

### Sprints 29-33: Previously Completed (session 1)

| Sprint | Focus | Status | Commit |
|--------|-------|--------|--------|
| 29 | Messaging Templates (DM + Email) | ✅ Complete | `466061d` |
| 30 | Company View Polish (width, tooltip) | ✅ Complete | `466061d` |
| 31 | Sequence Visibility (badge exists) | ✅ Already done | N/A |
| 32 | Tags UX (pills, filter dropdown) | ✅ Complete | `466061d` |
| 33 | Quick Wins (skeleton, empty states) | ✅ Already done | N/A |

### Sprint 34: UI/UX Gate Fixes (session 2)

| Task | Status | Description |
|------|--------|-------------|
| T34.1 ErrorBoundary Wrapping | ✅ | All major panels wrapped (Dashboard, Inbox, Hitlist, etc.) |
| T34.2 Fix `any` Types | ✅ | `ProspectEnrollmentInfo` type instead of `any` |
| T34.3 Email Validation | ✅ | Regex validation with visual error feedback |
| T34.4 Send Button Loading | ✅ | Spinner + disabled state during async send |
| T34.5 Skip Link | ✅ | Keyboard-accessible skip-to-content link |
| T34.6 Company Empty State | ✅ | Actionable messaging with clear CTAs |
| T34.7 Icon Accessibility | ✅ | `aria-hidden` on decorative icons |

---

## UI/UX Audit Checklist (Final)

| # | Criteria | Status | Notes |
|---|----------|--------|-------|
| 1 | Consistent styling | ✅ | Tailwind, blue-600 primary, tier badges |
| 2 | Loading states | ✅ | Spinners, skeletons present |
| 3 | Empty states | ✅ | Actionable CTAs in all major views |
| 4 | Error states | ✅ | ErrorBoundary wrapping all panels |
| 5 | Keyboard navigation | ✅ | Roving tabindex, Enter/Space handlers |
| 6 | ARIA labels | ✅ | aria-label, aria-hidden, aria-describedby |
| 7 | Responsive design | ✅ | Mobile/desktop layout switching |
| 8 | Toast notifications | ✅ | Success/error/warning variants |
| 9 | Form validation | ✅ | Email regex with visual feedback |
| 10 | TypeScript types | ✅ | No critical `any` usage |

---

## Files Modified (Sprint 34)

### [src/App.tsx](src/App.tsx)
- Added `ErrorBoundary` import and wrapping for all major panels
- Added skip-to-content link for keyboard accessibility

### [src/components/panels/ProspectDetailPanel.tsx](src/components/panels/ProspectDetailPanel.tsx)
- Fixed `any` type with proper `ProspectEnrollmentInfo` import
- Added `EMAIL_REGEX` constant and `emailError` state
- Added email validation in `handleSaveEmail`
- Added `handleEmailInputChange` for clearing errors
- Added `isSendingEmail` state for loading indicator
- Updated email input with validation UI (red border, error message, aria-invalid)
- Updated Send Email button with loading spinner

### [src/components/CompanyListView.tsx](src/components/CompanyListView.tsx)
- Improved empty state with icon, better messaging, and clear search button

### [src/__tests__/components/CompanyListView.test.tsx](src/__tests__/components/CompanyListView.test.tsx)
- Updated test for new empty state messaging

---

## Recommended Future Improvements (Nice to Have)

These were identified in the audit but not critical for deployment:

1. **Focus trap for modals** - Prevent tab escaping modals
2. **Virtualized list keyboard scroll** - Arrow key row navigation
3. **Character counter accessibility** - `aria-live="polite"` for char count
4. **Color tokens** - Extract tier colors to semantic tokens in tailwind.config.js
5. **Research button spinner** - Add spinning animation during research

---

## Deployment

### Production URL
- **Vercel**: Auto-deployed from `main` branch
- **Commit**: `e3542f9`
- **Build**: ✅ Successful (2,409 KB bundle)

### Verification Steps
1. ✅ TypeScript compilation passes
2. ✅ Production build succeeds
3. ✅ Tests pass (CompanyListView, SidebarContent, NavigationSidebar)
4. ✅ Pushed to `origin/main`
5. ✅ Vercel auto-deploy triggered

---

## Sprint Breakdown Template

For future reference, here's the atomic task structure used:

```markdown
### T[ID]: [Task Name] [Size - XS/S/M/L]

**Description**: What and why
**Files**: Which files to modify
**Implementation**: Code changes
**Validation**: How to verify
**Exit Criteria**: Definition of done
**Commit**: `type(scope): message`
```

### Size Guidelines
- **XS** (< 15 min): Config change, small fix
- **S** (15-30 min): Single component update
- **M** (30-60 min): New component or hook
- **L** (1-2 hours): Multi-file feature

---

## Lessons Learned

1. **Type safety matters**: The `any` type in `ProspectDetailPanel` was a code smell - always use proper types
2. **ErrorBoundary is cheap insurance**: Wrapping panels prevents cascade failures
3. **Empty states need CTAs**: "No data found" is useless; tell users what to do
4. **Accessibility is free**: `aria-hidden`, `aria-label` cost nothing but help users
5. **Validate at the boundary**: Email validation should happen on input, not just server-side

---

# Sprint Queue: V36+ Comprehensive Breakdown

**Created**: February 3, 2026  
**Status**: 🚀 QUEUED  
**Total Sprints**: 16 (10 Feature + 6 Critical)

---

## Sprint Overview Matrix

| Sprint | Focus | Priority | Est. Hours | Demo |
|--------|-------|----------|------------|------|
| **A** | Core Stability & Safety | P0 | 4h | Error tracking + safe deploys |
| **B** | Accessibility & Keyboard UX | P1 | 3h | Full keyboard navigation |
| **C** | Email Pipeline E2E & Compliance | P0 | 5h | Send → Track → Verify flow |
| **D** | Sequences & State Machine | P1 | 4h | Enroll → Execute → Complete |
| **E** | Tags, Filters & Search | P2 | 3h | Filter by tag, search prospects |
| **F** | Bulk Send UX & Rate Limits | P1 | 4h | Send 50+ emails with progress |
| **G** | Monitoring & Alerts | P1 | 3h | Dashboard + Slack alerts |
| **H** | Tests, CI & E2E | P1 | 4h | 90%+ coverage, E2E green |
| **I** | Docs, Runbook & Secrets | P2 | 2h | Production runbook |
| **J** | Polish & Release | P2 | 2h | Final QA + Release notes |
| **CRIT-1** | Secrets Guardrails | P0 | 2h | No secrets in client bundle |
| **CRIT-2** | Server-side CAN-SPAM | P0 | 3h | Compliance on all emails |
| **CRIT-3** | Observability & Error Tracking | P0 | 3h | Sentry + structured logs |
| **CRIT-4** | Rate-limiting Middleware | P0 | 2h | API protection |
| **CRIT-5** | Security Scanning & CI | P1 | 2h | Automated vuln scanning |
| **CRIT-6** | Privacy & Data Retention | P1 | 3h | GDPR-ready data handling |

**Total**: ~49 hours (~2 weeks at focused pace)

---

## Dependency Graph

```
CRIT-1 (Secrets) ──┬──▶ Sprint A (Stability)
                   │
CRIT-4 (Rate Limit)┘
                         │
                         ▼
CRIT-2 (CAN-SPAM) ──▶ Sprint C (Email) ──▶ Sprint F (Bulk Send)
                         │
CRIT-3 (Observability)───┼─────────────────────────┐
                         │                         │
                         ▼                         ▼
                   Sprint D (Sequences) ──▶ Sprint G (Monitoring)
                         │                   (Sentry required)
Sprint B (A11y) ─────────┼──▶ Sprint E (Tags) ──▶ Sprint H (Tests)
                         │                              │
                         │                              ▼
CRIT-5 (Security) ───────┴──▶ Sprint I (Docs) ──▶ Sprint J (Release)
                              │
CRIT-6 (Privacy) ─────────────┘
```

---

# CRITICAL SPRINTS (Execute First)

---

## CRIT-1: Secrets Guardrails [P0 - 2.5 hours]

**Goal**: Ensure no secrets leak into client bundle  
**Demo**: `npm run build` passes, no secrets in dist/, pre-commit blocks secrets

### T-CRIT1.0: Add pre-commit hook for secrets scanning [S - 30 min] ⭐ NEW

**Description**: Prevent commits containing secrets patterns before they reach git history.

**Files**: Create `.husky/pre-commit`, update `package.json`

**Implementation**:
```bash
# Install husky
npm install -D husky
npx husky init

# Create pre-commit hook
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Check for secrets in staged files
PATTERNS=(
  "SENDGRID_API_KEY"
  "RAILWAY_API_SECRET"
  "CRON_SECRET"
  "FIREBASE_ADMIN"
  "SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}"
  "sk-[a-zA-Z0-9]{48}"
)

for pattern in "${PATTERNS[@]}"; do
  if git diff --cached --name-only | xargs grep -E "$pattern" 2>/dev/null; then
    echo "❌ BLOCKED: Potential secret matching '$pattern' found in staged files"
    exit 1
  fi
done

echo "✅ No secrets detected in staged files"
EOF
chmod +x .husky/pre-commit
```

**Validation**:
```bash
# Test by staging a file with a fake secret
echo "SENDGRID_API_KEY=test" > test-secret.txt
git add test-secret.txt
git commit -m "test" # Should fail
rm test-secret.txt
```

**Exit Criteria**: Pre-commit hook blocks commits with secrets.

**Commit**: `chore(security): add pre-commit hook for secrets scanning`

---

### T-CRIT1.1: Create secrets audit script [S - 30 min]

**Description**: Script to scan build output for leaked secrets.

**Files**: Create `scripts/audit-secrets.ts`

**Implementation**:
```typescript
// scripts/audit-secrets.ts
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const FORBIDDEN_PATTERNS = [
  /SENDGRID_API_KEY/i,
  /FIREBASE_.*_KEY/i,
  /RAILWAY_API_SECRET/i,
  /CRON_SECRET/i,
  /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/,  // SendGrid API key pattern
  /sk-[a-zA-Z0-9]{48}/,  // OpenAI pattern
  /AIza[a-zA-Z0-9_-]{35}/,  // Firebase API key pattern
];

async function scanDir(dir: string): Promise<string[]> {
  const violations: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      violations.push(...await scanDir(path));
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      const content = await readFile(path, 'utf8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${path}: matches ${pattern}`);
        }
      }
    }
  }
  return violations;
}

async function main() {
  console.log('🔍 Scanning dist/ for leaked secrets...');
  const violations = await scanDir('./dist');
  
  if (violations.length > 0) {
    console.error('❌ SECRETS FOUND IN BUILD:');
    violations.forEach(v => console.error(`  - ${v}`));
    process.exit(1);
  }
  
  console.log('✅ No secrets found in build output');
}

main().catch(console.error);
```

**Validation**:
```bash
npm run build && npx tsx scripts/audit-secrets.ts
```

**Exit Criteria**: Script runs without violations on clean build.

**Commit**: `chore(security): add secrets audit script`

---

### T-CRIT1.2: Add VITE_ prefix validation [S - 20 min]

**Description**: Ensure only VITE_ prefixed vars reach client.

**Files**: `vite.config.ts`

**Implementation**: Add `envPrefix` validation:
```typescript
export default defineConfig({
  envPrefix: 'VITE_',
  define: {
    // Explicitly block dangerous vars
    'process.env.SENDGRID_API_KEY': JSON.stringify(''),
    'process.env.RAILWAY_API_SECRET': JSON.stringify(''),
    'process.env.FIREBASE_ADMIN_SDK': JSON.stringify(''),
  },
  // ... rest of config
});
```

**Validation**: `npm run build`, grep for blocked env vars in output.

**Exit Criteria**: Blocked vars replaced with empty strings.

**Commit**: `chore(security): enforce VITE_ env prefix`

---

### T-CRIT1.3: Add CI secrets check [S - 20 min]

**Description**: Add secrets scan to GitHub Actions.

**Files**: Create/update `.github/workflows/ci.yml`

**Implementation**:
```yaml
  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npx tsx scripts/audit-secrets.ts
```

**Validation**: Push PR, verify CI job passes.

**Exit Criteria**: CI blocks PRs with leaked secrets.

**Commit**: `ci: add secrets scanning to workflow`

---

### T-CRIT1.4: Document env var categories [XS - 15 min]

**Description**: Document which vars are client-safe vs server-only.

**Files**: Update `.env.example`

**Implementation**:
```bash
# === CLIENT-SAFE (VITE_ prefix) ===
VITE_RAILWAY_ENABLED=true
VITE_RAILWAY_EMAIL_ENABLED=true
VITE_MEETING_LINK_SHORT=https://cal.co/j/15

# === SERVER-ONLY (never expose to client) ===
# SENDGRID_API_KEY=SG.xxx  # Set in Vercel dashboard
# RAILWAY_API_SECRET=xxx   # Set in Vercel dashboard
# FIREBASE_ADMIN_SDK=xxx   # Set in Vercel dashboard
```

**Exit Criteria**: `.env.example` clearly categorizes vars.

**Commit**: `docs: categorize env vars by exposure level`

---

### T-CRIT1.5: Unit test for feature flags safety [S - 15 min]

**Description**: Verify featureFlags.ts doesn't access server-only vars.

**Files**: Create `src/__tests__/config/featureFlags.test.ts`

**Implementation**:
```typescript
import { featureFlags } from '@/config/featureFlags';

describe('featureFlags', () => {
  it('only accesses VITE_ prefixed environment variables', () => {
    // This test ensures the module can be safely imported client-side
    expect(() => featureFlags).not.toThrow();
  });

  it('does not contain server secrets', () => {
    const serialized = JSON.stringify(featureFlags);
    expect(serialized).not.toContain('SENDGRID');
    expect(serialized).not.toContain('SECRET');
    expect(serialized).not.toContain('ADMIN');
  });
});
```

**Validation**: `npm test -- --run featureFlags`

**Exit Criteria**: Test passes.

**Commit**: `test: add feature flags safety tests`

---

## CRIT-2: Server-side CAN-SPAM & Suppression [P0 - 3 hours]

**Goal**: All emails comply with CAN-SPAM, suppression enforced server-side  
**Demo**: Send to suppressed email → rejected, all emails have unsubscribe link

### T-CRIT2.1: Add suppression check to email API [M - 45 min]

**Description**: Block sends to suppressed emails at API level.

**Files**: `api/email/send.ts`

**Implementation**:
```typescript
import { EmailComplianceService } from '../../src/services/EmailComplianceService';

// In handler, before queueing:
const compliance = new EmailComplianceService(db);
const validation = await compliance.validateEmail(to);

if (!validation.valid) {
  logger.warn('Email blocked by compliance', { to, reason: validation.reason });
  return res.status(422).json({ 
    error: 'Email blocked', 
    reason: validation.reason 
  });
}
```

**Validation**:
```bash
# Add test@suppressed.com to suppression list, then:
curl -X POST /api/email/send -d '{"to":"test@suppressed.com"}'
# Should return 422
```

**Exit Criteria**: Suppressed emails return 422.

**Commit**: `feat(compliance): block suppressed emails at API`

---

### T-CRIT2.2: Enforce CAN-SPAM elements in EmailComplianceService [M - 40 min]

**Description**: Ensure unsubscribe link + postal address on all emails.

**Files**: `src/services/EmailComplianceService.ts`

**Implementation**:
```typescript
validateComplianceElements(message: EmailMessage): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  // Check for unsubscribe header
  if (!message.headers?.['List-Unsubscribe']) {
    missing.push('List-Unsubscribe header');
  }
  
  // Check for unsubscribe link in body
  if (!message.html?.includes('unsubscribe') && !message.html?.includes('Unsubscribe')) {
    missing.push('Unsubscribe link in body');
  }
  
  // Check for postal address
  const postalAddress = process.env.COMPLIANCE_POSTAL_ADDRESS;
  if (!postalAddress || !message.html?.includes(postalAddress)) {
    missing.push('Physical postal address');
  }
  
  return { valid: missing.length === 0, missing };
}
```

**Validation**: Unit test with messages missing each element.

**Exit Criteria**: Validation catches all missing elements.

**Commit**: `feat(compliance): validate CAN-SPAM elements`

---

### T-CRIT2.3: Add compliance gate to email queue processor [S - 30 min]

**Description**: Double-check compliance before actual send.

**Files**: `api/cron/process-queue.ts`

**Implementation**:
```typescript
// Before sending each email:
const complianceCheck = compliance.validateComplianceElements(item.message);
if (!complianceCheck.valid) {
  logger.error('Email failed compliance check', { 
    emailId: item.id, 
    missing: complianceCheck.missing 
  });
  await markAsFailed(item.id, `Missing: ${complianceCheck.missing.join(', ')}`);
  continue;
}
```

**Validation**: Queue email without unsubscribe link → should fail.

**Exit Criteria**: Non-compliant emails fail gracefully.

**Commit**: `feat(compliance): gate queue processing on CAN-SPAM`

---

### T-CRIT2.4: Sync suppression list to SendGrid [M - 45 min]

**Description**: Keep Firestore suppression list in sync with SendGrid.

**Files**: `src/services/SuppressionSyncService.ts`

**Implementation**:
```typescript
export class SuppressionSyncService {
  async syncToSendGrid(): Promise<{ synced: number; errors: number }> {
    const snapshot = await this.db.collection('email_suppressions').get();
    let synced = 0, errors = 0;
    
    for (const doc of snapshot.docs) {
      try {
        await this.sendGrid.addToGlobalSuppression(doc.id);
        synced++;
      } catch (err) {
        errors++;
      }
    }
    
    return { synced, errors };
  }
  
  async syncFromSendGrid(): Promise<{ imported: number }> {
    const suppressions = await this.sendGrid.getGlobalSuppressions();
    let imported = 0;
    
    for (const email of suppressions) {
      const exists = await this.db.collection('email_suppressions').doc(email).get();
      if (!exists.exists) {
        await this.db.collection('email_suppressions').doc(email).set({
          email,
          reason: 'sendgrid_sync',
          createdAt: Date.now(),
        });
        imported++;
      }
    }
    
    return { imported };
  }
}
```

**Validation**: Add email to Firestore suppression, run sync, verify in SendGrid.

**Exit Criteria**: Two-way sync working.

**Commit**: `feat(compliance): two-way suppression sync with SendGrid`

---

### T-CRIT2.5: Unit tests for compliance service [S - 30 min]

**Description**: Full test coverage for EmailComplianceService.

**Files**: `src/__tests__/services/EmailComplianceService.test.ts`

**Implementation**:
```typescript
describe('EmailComplianceService', () => {
  describe('validateEmail', () => {
    it('rejects invalid email format', async () => {
      const result = await service.validateEmail('not-an-email');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_format');
    });
    
    it('rejects suppressed email', async () => {
      mockDb.collection('email_suppressions').doc('test@blocked.com').get
        .mockResolvedValue({ exists: true });
      
      const result = await service.validateEmail('test@blocked.com');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('suppressed');
    });
  });
  
  describe('validateComplianceElements', () => {
    it('catches missing unsubscribe header', () => {
      const msg = { html: '<p>Hello</p>', headers: {} };
      const result = service.validateComplianceElements(msg);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('List-Unsubscribe header');
    });
  });
});
```

**Validation**: `npm test -- --run EmailComplianceService`

**Exit Criteria**: 100% branch coverage on compliance service.

**Commit**: `test(compliance): full coverage for EmailComplianceService`

---

## CRIT-3: Observability & Error Tracking [P0 - 3 hours]

**Goal**: All errors captured in Sentry, structured logging throughout  
**Demo**: Trigger error → see in Sentry with full context

### T-CRIT3.1a: Configure Sentry for Browser (React) [M - 45 min]

**Description**: Set up Sentry with source maps and release tracking for browser.

**Files**: `src/lib/sentry.ts`, `vite.config.ts`

**Implementation**:
```typescript
// src/lib/sentry.ts
import * as Sentry from '@sentry/react';

export function initSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, { extra: context });
}
```

**Validation**: Throw error in dev, verify appears in Sentry.

**Exit Criteria**: Errors appear in Sentry with source maps.

**Commit**: `feat(observability): configure browser Sentry with source maps`

---

### T-CRIT3.1b: Configure Sentry for API Routes (Server) [M - 40 min] ⭐ NEW

**Description**: Set up server-side Sentry for Vercel API routes with request isolation.

**Files**: Create `lib/sentry-server.ts`, update API routes

**Implementation**:
```typescript
// lib/sentry-server.ts
import * as Sentry from '@sentry/node';

let initialized = false;

export function initServerSentry() {
  if (initialized || !process.env.SENTRY_DSN) return;
  
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV || 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0.2,
  });
  
  initialized = true;
}

export function captureServerError(
  error: Error, 
  context?: { requestId?: string; path?: string; [key: string]: unknown }
) {
  Sentry.withScope((scope) => {
    if (context?.requestId) scope.setTag('requestId', context.requestId);
    if (context?.path) scope.setTag('path', context.path);
    scope.setExtras(context || {});
    Sentry.captureException(error);
  });
}

// Wrapper for API handlers
export function withSentry<T>(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<T>
) {
  return async (req: VercelRequest, res: VercelResponse): Promise<T> => {
    initServerSentry();
    try {
      return await handler(req, res);
    } catch (error) {
      captureServerError(error as Error, { path: req.url });
      throw error;
    }
  };
}
```

**Validation**: Trigger API error, verify appears in Sentry with request context.

**Exit Criteria**: API route errors tracked with request isolation.

**Commit**: `feat(observability): configure server-side Sentry for API routes`

---

### T-CRIT3.2: Add ErrorBoundary Sentry integration [S - 30 min]

**Description**: Report ErrorBoundary catches to Sentry.

**Files**: `src/components/ui/ErrorBoundary.tsx`

**Implementation**:
```typescript
import { captureError } from '@/lib/sentry';

class ErrorBoundary extends React.Component<Props, State> {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    captureError(error, {
      componentStack: errorInfo.componentStack,
      ...this.props.context,
    });
  }
  // ... rest of component
}
```

**Validation**: Trigger ErrorBoundary, verify Sentry event includes component stack.

**Exit Criteria**: Component errors tracked with full context.

**Commit**: `feat(observability): integrate ErrorBoundary with Sentry`

---

### T-CRIT3.3: Structured logging for API routes [M - 40 min]

**Description**: Consistent JSON logging format for all API routes.

**Files**: `lib/logger.ts`

**Implementation**:
```typescript
export interface LogContext {
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  duration?: number;
  [key: string]: unknown;
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...context,
    }));
  },
  
  warn(message: string, context?: LogContext) {
    console.warn(JSON.stringify({
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      ...context,
    }));
  },
  
  error(message: string, error?: Error, context?: LogContext) {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      timestamp: new Date().toISOString(),
      ...context,
    }));
  },
};
```

**Validation**: Check Vercel logs for structured JSON output.

**Exit Criteria**: All logs are valid JSON with consistent schema.

**Commit**: `feat(observability): structured JSON logging`

---

### T-CRIT3.4: Add request ID middleware [S - 30 min]

**Description**: Add unique request ID to all API requests.

**Files**: `api/_middleware.ts`

**Implementation**:
```typescript
import { v4 as uuidv4 } from 'uuid';

export function addRequestId(req: VercelRequest): string {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  return requestId;
}

// Use in all handlers:
const requestId = addRequestId(req);
logger.info('Request started', { requestId, path: req.url, method: req.method });
```

**Validation**: Make API request, verify request ID in logs.

**Exit Criteria**: All requests have traceable ID.

**Commit**: `feat(observability): add request ID tracing`

---

### T-CRIT3.5: Add cron job health metrics [S - 30 min]

**Description**: Track cron job success/failure rates.

**Files**: `api/cron/process-queue.ts`, `api/cron/execute-sequences.ts`

**Implementation**:
```typescript
// At end of each cron handler:
await recordCronMetrics({
  cronName: 'process-queue',
  success: results.errors === 0,
  duration: Date.now() - startTime,
  processed: results.processed,
  failed: results.errors,
});

async function recordCronMetrics(metrics: CronMetrics): Promise<void> {
  await db.collection('cron_metrics').add({
    ...metrics,
    timestamp: Date.now(),
  });
  
  // Alert on high failure rate
  if (metrics.failed > metrics.processed * 0.1) {
    await sendAlert(
      `High failure rate in ${metrics.cronName}`,
      AlertSeverity.WARNING,
      { ...metrics }
    );
  }
}
```

**Validation**: Run cron, verify metrics in Firestore.

**Exit Criteria**: Cron metrics tracked and alerting works.

**Commit**: `feat(observability): cron job health metrics`

---

## CRIT-4: Rate-limiting Middleware [P0 - 1.5 hours] ⭐ REVISED (existing code)

**Goal**: All public APIs protected from abuse  
**Demo**: Hit API 100 times rapidly → get 429

> **Note**: Rate limiter already exists in `lib/rateLimiter.ts` (226 lines) with Upstash Redis sliding window. These tasks extend/apply existing code.

### T-CRIT4.1: Apply existing rate limiter to all API routes [S - 30 min] ⭐ REVISED

**Description**: Wrap all API handlers with the existing rate limiting middleware.

**Files**: `api/_middleware.ts`, key `api/**/*.ts` handlers

**Implementation**:
```typescript
// api/_middleware.ts - create helper that uses existing rateLimiter
import { rateLimit, getRateLimitConfig } from '../lib/rateLimiter';

export async function withRateLimit(
  req: VercelRequest,
  res: VercelResponse
): Promise<boolean> {
  const config = getRateLimitConfig(req.url || '');
  if (config.limit === 0) return true; // No limit for this route
  
  const identifier = req.headers['x-forwarded-for'] as string || 'anonymous';
  const result = await rateLimit(identifier, config.limit, config.windowMs);
  
  res.setHeader('X-RateLimit-Limit', result.limit);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', result.resetAt);
  
  if (!result.allowed) {
    res.status(429).json({ 
      error: 'Too many requests',
      retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
    });
    return false;
  }
  
  return true;
}
```

**Validation**: Hit endpoint 101 times, verify 429 on 101st.

**Exit Criteria**: Rate limiting active on all public endpoints.

**Commit**: `feat(security): apply rate limiting middleware to APIs`

---

### T-CRIT4.2: Add per-route rate limits config [S - 25 min] ⭐ REVISED

**Description**: Add route-specific limits to existing rateLimiter.ts.

**Files**: `lib/rateLimiter.ts` (extend existing)

**Implementation**:
```typescript
// Add to existing lib/rateLimiter.ts
export const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  // Webhook endpoints - high limit (SendGrid can burst)
  '/api/webhooks/*': { limit: 1000, windowMs: 60000 },
  
  // Email send - conservative (protect SendGrid reputation)
  '/api/email/send': { limit: 10, windowMs: 60000 },
  
  // Railway proxy - moderate
  '/api/railway/*': { limit: 100, windowMs: 60000 },
  
  // Health check - no limit
  '/api/health': { limit: 0, windowMs: 0 },
  
  // Default for all other routes
  '*': { limit: 100, windowMs: 60000 },
};

export function getRateLimitConfig(path: string): { limit: number; windowMs: number } {
  for (const [pattern, config] of Object.entries(RATE_LIMITS)) {
    if (pattern === '*') continue;
    if (matchPath(pattern, path)) return config;
  }
  return RATE_LIMITS['*'];
}

function matchPath(pattern: string, path: string): boolean {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(path);
}
```

**Validation**: Test different endpoints hit their configured limits.

**Exit Criteria**: Per-route limits working.

**Commit**: `feat(security): per-route rate limit configuration`

---

### T-CRIT4.3: Add authenticated user higher limits [S - 25 min]

**Description**: Authenticated users get higher rate limits.

**Files**: `lib/rateLimiter.ts`

**Implementation**:
```typescript
export function getIdentifier(req: VercelRequest): { key: string; multiplier: number } {
  const authHeader = req.headers.authorization;
  
  if (authHeader?.startsWith('Bearer ')) {
    // Authenticated users get 3x the limit
    const token = authHeader.slice(7);
    return { key: `user:${hashToken(token)}`, multiplier: 3 };
  }
  
  // Anonymous users
  const ip = req.headers['x-forwarded-for'] as string || 'anonymous';
  return { key: `ip:${ip}`, multiplier: 1 };
}
```

**Validation**: Test authenticated vs anonymous rate limits.

**Exit Criteria**: Authenticated users have higher limits.

**Commit**: `feat(security): higher rate limits for authenticated users`

---

### T-CRIT4.4: Unit tests for rate limiter [S - 20 min]

**Description**: Test rate limiter edge cases.

**Files**: `lib/__tests__/rateLimiter.test.ts`

**Implementation**:
```typescript
describe('rateLimiter', () => {
  it('allows requests under limit', async () => {
    const result = await rateLimit('test-user', 10, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });
  
  it('blocks requests over limit', async () => {
    for (let i = 0; i < 10; i++) {
      await rateLimit('test-user-2', 10, 60000);
    }
    const result = await rateLimit('test-user-2', 10, 60000);
    expect(result.allowed).toBe(false);
  });
  
  it('resets after window expires', async () => {
    // Mock time passing
  });
});
```

**Validation**: `npm test -- --run rateLimiter`

**Exit Criteria**: All rate limiter tests pass.

**Commit**: `test: add rate limiter unit tests`

---

## CRIT-5: Security Scanning & CI [P1 - 2 hours]

**Goal**: Automated vulnerability scanning in CI  
**Demo**: PR with known vuln dependency → CI fails

### T-CRIT5.1: Add npm audit to CI [S - 20 min]

**Description**: Run npm audit in CI pipeline.

**Files**: `.github/workflows/ci.yml`

**Implementation**:
```yaml
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm audit --audit-level=high
        continue-on-error: false
```

**Validation**: Add vulnerable dep, verify CI fails.

**Exit Criteria**: CI blocks high-severity vulnerabilities.

**Commit**: `ci: add npm audit security scanning`

---

### T-CRIT5.2: Add CodeQL analysis [M - 40 min]

**Description**: Enable GitHub CodeQL for security analysis.

**Files**: Create `.github/workflows/codeql.yml`

**Implementation**:
```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: typescript
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
```

**Validation**: Push to main, verify CodeQL scan runs.

**Exit Criteria**: CodeQL running on all PRs.

**Commit**: `ci: add CodeQL security analysis`

---

### T-CRIT5.3: Add Dependabot configuration [S - 15 min]

**Description**: Enable Dependabot for dependency updates.

**Files**: Create `.github/dependabot.yml`

**Implementation**:
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    groups:
      production-dependencies:
        patterns:
          - "*"
        exclude-patterns:
          - "@types/*"
          - "eslint*"
          - "vitest*"
          - "playwright*"
```

**Validation**: Verify Dependabot PRs appear.

**Exit Criteria**: Dependabot creating update PRs.

**Commit**: `ci: add Dependabot configuration`

---

### T-CRIT5.4: Add SECURITY.md [XS - 15 min]

**Description**: Document security reporting process.

**Files**: Create `SECURITY.md`

**Implementation**:
```markdown
# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities via email to security@freightroll.io.

Do NOT open public issues for security vulnerabilities.

## Supported Versions

| Version | Supported |
|---------|-----------|
| main    | ✅        |
| others  | ❌        |

## Security Updates

Security updates are released as patch versions and announced via:
- GitHub Security Advisories
- Release notes
```

**Exit Criteria**: SECURITY.md in repo root.

**Commit**: `docs: add security reporting policy`

---

## CRIT-6: Privacy & Data Retention [P1 - 3 hours]

**Goal**: GDPR-ready data handling with retention policies  
**Demo**: Export user data, delete user data on request

### T-CRIT6.1: Create data export endpoint [M - 45 min]

**Description**: Export all user data in portable format.

**Files**: Create `api/admin/export-user-data.ts`

**Implementation**:
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Require admin auth
  const userId = req.query.userId as string;
  
  const userData = {
    prospects: await db.collection('prospects')
      .where('createdBy', '==', userId).get(),
    emails: await db.collection('email_logs')
      .where('userId', '==', userId).get(),
    sequences: await db.collection('sequence_enrollments')
      .where('enrolledBy', '==', userId).get(),
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="user-${userId}-export.json"`);
  res.json(userData);
}
```

**Validation**: Export data for test user, verify all collections included.

**Exit Criteria**: Full user data export working.

**Commit**: `feat(privacy): add user data export endpoint`

---

### T-CRIT6.2: Create data deletion endpoint [M - 45 min]

**Description**: Delete all user data on request.

**Files**: Create `api/admin/delete-user-data.ts`

**Implementation**:
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Require admin auth + confirmation token
  const userId = req.body.userId;
  const confirmationToken = req.body.confirmationToken;
  
  // Verify deletion request
  const request = await db.collection('deletion_requests').doc(confirmationToken).get();
  if (!request.exists || request.data()?.userId !== userId) {
    return res.status(403).json({ error: 'Invalid confirmation' });
  }
  
  // Delete all user data
  const batch = db.batch();
  
  const prospects = await db.collection('prospects')
    .where('createdBy', '==', userId).get();
  prospects.docs.forEach(doc => batch.delete(doc.ref));
  
  // ... delete from other collections
  
  await batch.commit();
  
  // Log deletion
  await db.collection('audit_log').add({
    action: 'user_data_deleted',
    userId,
    timestamp: Date.now(),
    deletedCollections: ['prospects', 'email_logs', 'sequences'],
  });
  
  res.json({ success: true, deleted: prospects.size });
}
```

**Validation**: Delete test user data, verify removed from all collections.

**Exit Criteria**: Complete data deletion working.

**Commit**: `feat(privacy): add user data deletion endpoint`

---

### T-CRIT6.3: Add email log retention policy [M - 40 min]

**Description**: Auto-delete email logs older than retention period.

**Files**: Create `api/cron/cleanup-old-data.ts`

**Implementation**:
```typescript
const RETENTION_DAYS = 90;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cutoff = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
  
  // Delete old email events (tracking data)
  const oldEvents = await db.collection('email_events')
    .where('timestamp', '<', cutoff)
    .limit(500)
    .get();
  
  const batch = db.batch();
  oldEvents.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  
  logger.info('Cleaned up old data', { deleted: oldEvents.size });
  
  res.json({ deleted: oldEvents.size });
}
```

**Validation**: Insert old data, run cron, verify deleted.

**Exit Criteria**: Old data cleaned up automatically.

**Commit**: `feat(privacy): add data retention cleanup job`

---

### T-CRIT6.4: Document data handling in privacy policy [S - 30 min]

**Description**: Document what data is collected and retained.

**Files**: Create `docs/DATA_HANDLING.md`

**Implementation**:
```markdown
# Data Handling Policy

## Data Collected

| Data Type | Purpose | Retention |
|-----------|---------|-----------|
| Email addresses | Outreach | Until deleted |
| Email events (opens/clicks) | Analytics | 90 days |
| Prospect data | CRM | Until deleted |
| Audit logs | Compliance | 1 year |

## Data Subject Rights

- **Access**: Request data export via admin panel
- **Deletion**: Request deletion via admin panel
- **Portability**: Export in JSON format

## Data Locations

- Firestore: US region (firebase.google.com)
- Railway: US East (railway.app)
- Vercel: Edge network (vercel.com)
```

**Exit Criteria**: Data handling documented.

**Commit**: `docs: add data handling policy`

---

### T-CRIT6.5: Add PII masking in structured logs [S - 30 min] ⭐ NEW

**Description**: Mask email addresses and names in log output for GDPR compliance.

**Files**: `lib/logger.ts`

**Implementation**:
```typescript
// Add PII masking functions to lib/logger.ts

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***@***';
  const maskedLocal = local.length > 2 
    ? local[0] + '***' + local[local.length - 1]
    : '***';
  return `${maskedLocal}@${domain}`;
}

function maskPII(obj: unknown): unknown {
  if (typeof obj === 'string') {
    // Mask email patterns
    return obj.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 
      (match) => maskEmail(match)
    );
  }
  
  if (Array.isArray(obj)) {
    return obj.map(maskPII);
  }
  
  if (obj && typeof obj === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Mask specific field names
      if (['email', 'to', 'from', 'name', 'firstName', 'lastName'].includes(key)) {
        masked[key] = typeof value === 'string' ? maskEmail(value) : '***';
      } else {
        masked[key] = maskPII(value);
      }
    }
    return masked;
  }
  
  return obj;
}

// Update logger functions to use maskPII
export const logger = {
  info(message: string, context?: LogContext) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...maskPII(context),
    }));
  },
  // ... apply to warn, error as well
};
```

**Validation**:
```typescript
it('masks email addresses in logs', () => {
  const spy = vi.spyOn(console, 'log');
  logger.info('User action', { email: 'john.doe@example.com', userId: '123' });
  expect(spy).toHaveBeenCalledWith(expect.stringContaining('j***e@example.com'));
  expect(spy).not.toHaveBeenCalledWith(expect.stringContaining('john.doe@example.com'));
});
```

**Exit Criteria**: PII masked in all log output.

**Commit**: `feat(privacy): add PII masking to structured logs`

---

# FEATURE SPRINTS

---

## Sprint A: Core Stability & Safety [P0 - 4 hours]

**Goal**: Bulletproof error handling, graceful degradation  
**Demo**: Railway down → app still works with Firestore fallback

### TA.1: Enhance ErrorBoundary with retry [S - 30 min]

**Description**: Add retry button to ErrorBoundary fallback UI.

**Files**: `src/components/ui/ErrorBoundary.tsx`

**Implementation**:
```typescript
render() {
  if (this.state.hasError) {
    return (
      <div className="p-6 bg-red-50 rounded-lg">
        <h2 className="text-red-800 font-semibold">Something went wrong</h2>
        <p className="text-red-600 text-sm mt-2">{this.state.error?.message}</p>
        <button 
          onClick={() => this.setState({ hasError: false, error: null })}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }
  return this.props.children;
}
```

**Validation**: Trigger error, click retry, verify component re-renders.

**Exit Criteria**: Retry button works.

**Commit**: `feat(ui): add retry button to ErrorBoundary`

---

### TA.2: Add Railway health check hook [M - 45 min]

**Description**: Hook to check Railway health and enable fallback mode.

**Files**: Create `src/hooks/useRailwayHealth.ts`

**Implementation**:
```typescript
export function useRailwayHealth() {
  const [status, setStatus] = useState<'checking' | 'healthy' | 'unhealthy'>('checking');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/railway/health', { 
          signal: AbortSignal.timeout(5000) 
        });
        setStatus(res.ok ? 'healthy' : 'unhealthy');
      } catch {
        setStatus('unhealthy');
      }
      setLastCheck(new Date());
    };
    
    checkHealth();
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, []);
  
  return { status, lastCheck, isHealthy: status === 'healthy' };
}
```

**Validation**: Mock Railway failure, verify status changes.

**Exit Criteria**: Hook reports health status correctly.

**Commit**: `feat(resilience): add Railway health check hook`

---

### TA.3: Implement fallback mode for email sending [M - 45 min]

**Description**: Fall back to Firestore queue when Railway is down.

**Files**: `src/hooks/useRailwayEmail.ts`

**Implementation**:
```typescript
export function useRailwayEmail() {
  const { isHealthy } = useRailwayHealth();
  
  const sendEmail = async (payload: EmailPayload) => {
    if (!isHealthy || !shouldUseRailwayEmail()) {
      // Fallback to Firestore queue
      return sendViaFirestoreQueue(payload);
    }
    
    try {
      return await railwayClient.email.send(payload);
    } catch (err) {
      logger.warn('Railway send failed, falling back', { error: err });
      return sendViaFirestoreQueue(payload);
    }
  };
  
  return { sendEmail, isRailwayHealthy: isHealthy };
}
```

**Validation**: Block Railway, send email, verify queued to Firestore.

**Exit Criteria**: Graceful fallback working.

**Commit**: `feat(resilience): fallback to Firestore when Railway down`

---

### TA.4: Add connection status indicator [S - 30 min]

**Description**: Show Railway connection status in UI.

**Files**: `src/components/layout/SidebarContent.tsx`

**Implementation**:
```typescript
const { status } = useRailwayHealth();

<div className="flex items-center gap-2 px-3 py-2">
  <div className={cn(
    "w-2 h-2 rounded-full",
    status === 'healthy' && "bg-green-500",
    status === 'unhealthy' && "bg-red-500",
    status === 'checking' && "bg-yellow-500 animate-pulse"
  )} />
  <span className="text-xs text-gray-500">
    {status === 'healthy' ? 'Connected' : 
     status === 'unhealthy' ? 'Offline Mode' : 'Checking...'}
  </span>
</div>
```

**Validation**: Toggle Railway health, verify indicator updates.

**Exit Criteria**: Status indicator visible in sidebar.

**Commit**: `feat(ui): add Railway connection status indicator`

---

### TA.5: Add offline toast notification [S - 20 min]

**Description**: Show toast when entering offline mode.

**Files**: `src/hooks/useRailwayHealth.ts`

**Implementation**:
```typescript
useEffect(() => {
  if (prevStatus === 'healthy' && status === 'unhealthy') {
    toast.warning('Connection lost. Working in offline mode.');
  }
  if (prevStatus === 'unhealthy' && status === 'healthy') {
    toast.success('Connection restored!');
  }
}, [status, prevStatus]);
```

**Validation**: Toggle health, verify toasts appear.

**Exit Criteria**: Toasts notify users of status changes.

**Commit**: `feat(ui): toast notifications for connection status`

---

## Sprint B: Accessibility & Keyboard UX [P1 - 3 hours]

**Goal**: Full keyboard navigation, screen reader support  
**Demo**: Navigate entire app with keyboard only

### TB.1: Add focus trap to modals [M - 40 min]

**Description**: Prevent tab escaping modal dialogs.

**Files**: Create `src/hooks/useFocusTrap.ts`

**Implementation**:
```typescript
export function useFocusTrap(ref: RefObject<HTMLElement>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !ref.current) return;
    
    const focusableElements = ref.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };
    
    document.addEventListener('keydown', handleTab);
    firstElement?.focus();
    
    return () => document.removeEventListener('keydown', handleTab);
  }, [isActive, ref]);
}
```

**Validation**: Open modal, tab through, verify focus stays in modal.

**Exit Criteria**: Focus trapped in all modals.

**Commit**: `feat(a11y): add focus trap for modals`

---

### TB.2: Add keyboard shortcuts help [S - 30 min]

**Description**: Show keyboard shortcuts overlay on ? key.

**Files**: Create `src/components/KeyboardShortcutsHelp.tsx`

**Implementation**:
```typescript
const SHORTCUTS = [
  { key: '/', description: 'Focus search' },
  { key: 'n', description: 'New prospect' },
  { key: 'e', description: 'Send email' },
  { key: 'j/k', description: 'Navigate list' },
  { key: 'Enter', description: 'Select item' },
  { key: 'Escape', description: 'Close modal' },
];

export function KeyboardShortcutsHelp({ isOpen, onClose }: Props) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md">
        <h2 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h2>
        <dl className="space-y-2">
          {SHORTCUTS.map(({ key, description }) => (
            <div key={key} className="flex justify-between">
              <kbd className="bg-gray-100 px-2 py-1 rounded">{key}</kbd>
              <span>{description}</span>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
```

**Validation**: Press ?, verify shortcuts help appears.

**Exit Criteria**: Help dialog accessible via ? key.

**Commit**: `feat(a11y): add keyboard shortcuts help dialog`

---

### TB.3: Implement j/k list navigation (ref-based) [M - 40 min]

**Description**: Arrow and j/k keys navigate prospect list using roving tabindex and refs to avoid stale closures and ensure focus sync with virtualized rows.

**Files**: `src/components/ProspectListView.tsx`

**Implementation**:
```typescript
const listRef = useRef<HTMLDivElement>(null);
const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
const [focusedIndex, setFocusedIndex] = useState(0);

useEffect(() => {
  const container = listRef.current;
  if (!container) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;

    const maxIndex = prospects.length - 1;
    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => Math.min(i + 1, maxIndex));
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onSelectProspect(prospects[focusedIndex]);
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  return () => container.removeEventListener('keydown', handleKeyDown);
}, [prospects, onSelectProspect, focusedIndex]);

useEffect(() => {
  itemRefs.current[focusedIndex]?.focus();
}, [focusedIndex]);

// Each row
<div
  ref={el => (itemRefs.current[index] = el)}
  tabIndex={index === focusedIndex ? 0 : -1}
  onClick={() => setFocusedIndex(index)}
  role="option"
  aria-selected={index === focusedIndex}
>
  {/* row content */}
</div>
```

**Validation**: Use j/k to navigate list, Enter to select, verify focus indicator follows the focused row and works with virtualized rendering.

**Exit Criteria**: Full keyboard list navigation without focus loss.

**Commit**: `feat(a11y): j/k keyboard navigation for prospect list`

---

### TB.4: Add aria-live regions for dynamic content [S - 25 min]

**Description**: Announce dynamic updates to screen readers.

**Files**: `src/components/ui/Toast.tsx`, character counter

**Implementation**:
```typescript
// Toast container
<div 
  aria-live="polite" 
  aria-atomic="true"
  className="fixed bottom-4 right-4 z-50"
>
  {toasts.map(toast => (
    <div role="alert" key={toast.id}>
      {toast.message}
    </div>
  ))}
</div>

// Character counter
<span 
  aria-live="polite" 
  className={cn("text-sm", charCount > limit && "text-red-600")}
>
  {charCount}/{limit} characters
</span>
```

**Validation**: Test with screen reader, verify announcements.

**Exit Criteria**: Dynamic content announced.

**Commit**: `feat(a11y): add aria-live regions for dynamic content`

---

### TB.5: Add reduced motion support [S - 20 min]

**Description**: Respect prefers-reduced-motion setting.

**Files**: `src/index.css`, animations

**Implementation**:
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Validation**: Enable reduced motion in OS, verify animations disabled.

**Exit Criteria**: Animations respect user preference.

**Commit**: `feat(a11y): respect prefers-reduced-motion`

---

## Sprint C: Email Pipeline E2E & Compliance [P0 - 5.5 hours]

**Goal**: Complete email flow with tracking and compliance  
**Demo**: Send email → Track open → Track click → Unsubscribe works

### TC.0: Verify idempotency key enforcement [S - 30 min] ⭐ NEW

**Description**: Test that duplicate sends with same idempotency key are deduplicated.

**Files**: Create `src/__tests__/api/email/send-idempotency.test.ts`

**Implementation**:
```typescript
describe('Email send idempotency', () => {
  it('deduplicates sends with same idempotency key', async () => {
    const idempotencyKey = 'test-key-123';
    const payload = { to: 'test@example.com', subject: 'Test', body: 'Hello' };
    
    // First send - should succeed
    const res1 = await handler(mockRequest({
      body: { ...payload, idempotencyKey }
    }), mockResponse());
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    const firstId = mockResponse.json.mock.calls[0][0].messageId;
    
    // Second send with same key - should return cached result
    const res2 = await handler(mockRequest({
      body: { ...payload, idempotencyKey }
    }), mockResponse());
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    const secondId = mockResponse.json.mock.calls[1][0].messageId;
    
    // Should return same message ID (deduplicated)
    expect(firstId).toBe(secondId);
    
    // Should only have one email in queue
    const queuedEmails = await db.collection('email_queue')
      .where('idempotencyKey', '==', idempotencyKey)
      .get();
    expect(queuedEmails.docs.length).toBe(1);
  });
  
  it('allows resend with different idempotency key', async () => {
    const payload = { to: 'test@example.com', subject: 'Test', body: 'Hello' };
    
    await handler(mockRequest({
      body: { ...payload, idempotencyKey: 'key-1' }
    }), mockResponse());
    
    await handler(mockRequest({
      body: { ...payload, idempotencyKey: 'key-2' }
    }), mockResponse());
    
    // Should have two emails queued
    const queuedEmails = await db.collection('email_queue')
      .where('to', '==', 'test@example.com')
      .get();
    expect(queuedEmails.docs.length).toBe(2);
  });
});
```

**Validation**: `npm test -- --run send-idempotency`

**Exit Criteria**: Idempotency prevents duplicate emails.

**Commit**: `test: verify email send idempotency enforcement`

---

### TC.1: Verify email send E2E [M - 45 min]

**Description**: Create E2E test for complete email flow.

**Files**: Create `e2e/email-flow.spec.ts`

**Implementation**:
```typescript
test('email send E2E flow', async ({ page }) => {
  await page.goto('/');
  await loginAsTestUser(page);
  
  // Select prospect
  await page.getByTestId('prospect-row-0').click();
  
  // Open email modal
  await page.getByRole('button', { name: /send email/i }).click();
  
  // Fill email form
  await page.getByLabel('Subject').fill('Test Subject');
  await page.getByRole('button', { name: /send/i }).click();
  
  // Verify success toast
  await expect(page.getByText(/email sent/i)).toBeVisible();
  
  // Verify in email logs
  await page.goto('/admin/email-logs');
  await expect(page.getByText('Test Subject')).toBeVisible();
});
```

**Validation**: `npm run test:e2e -- email-flow.spec.ts`

**Exit Criteria**: E2E test passes.

**Commit**: `test(e2e): add email send flow test`

---

### TC.2: Add open tracking verification [M - 40 min]

**Description**: Verify open tracking pixel fires correctly.

**Files**: `api/track/open.ts`, test file

**Implementation**:
```typescript
// Verify tracking pixel endpoint
test('open tracking records event', async () => {
  const emailId = 'test-email-123';
  
  const response = await fetch(`/api/track/open?id=${emailId}`);
  
  // Should return 1x1 transparent GIF
  expect(response.headers.get('content-type')).toBe('image/gif');
  expect(response.status).toBe(200);
  
  // Verify event recorded in Firestore
  const event = await db.collection('email_events')
    .where('emailId', '==', emailId)
    .where('type', '==', 'open')
    .get();
  
  expect(event.docs.length).toBe(1);
});
```

**Validation**: Run test, verify tracking works.

**Exit Criteria**: Open tracking recorded correctly.

**Commit**: `test: verify open tracking functionality`

---

### TC.3: Add click tracking verification [M - 40 min]

**Description**: Verify click tracking and redirect works.

**Files**: `api/track/click.ts`, test file

**Implementation**:
```typescript
test('click tracking records event and redirects', async () => {
  const emailId = 'test-email-123';
  const targetUrl = 'https://example.com/page';
  
  const response = await fetch(
    `/api/track/click?id=${emailId}&url=${encodeURIComponent(targetUrl)}`,
    { redirect: 'manual' }
  );
  
  // Should redirect
  expect(response.status).toBe(302);
  expect(response.headers.get('location')).toBe(targetUrl);
  
  // Verify event recorded
  const event = await db.collection('email_events')
    .where('emailId', '==', emailId)
    .where('type', '==', 'click')
    .get();
  
  expect(event.docs[0].data().url).toBe(targetUrl);
});
```

**Validation**: Run test, verify tracking works.

**Exit Criteria**: Click tracking and redirect working.

**Commit**: `test: verify click tracking functionality`

---

### TC.4: Verify unsubscribe flow E2E [M - 45 min]

**Description**: Test complete unsubscribe flow.

**Files**: Create `e2e/unsubscribe.spec.ts`

**Implementation**:
```typescript
test('unsubscribe flow', async ({ page }) => {
  // Generate valid unsubscribe token
  const token = await getTestUnsubscribeToken('test@example.com');
  
  // Visit unsubscribe page
  await page.goto(`/api/email/unsubscribe?token=${token}`);
  
  // Verify confirmation page
  await expect(page.getByText(/successfully unsubscribed/i)).toBeVisible();
  
  // Verify added to suppression list
  const suppression = await db.collection('email_suppressions')
    .doc('test@example.com')
    .get();
  
  expect(suppression.exists).toBe(true);
});
```

**Validation**: Run E2E test.

**Exit Criteria**: Unsubscribe flow working.

**Commit**: `test(e2e): verify unsubscribe flow`

---

### TC.5: Add webhook signature verification test [S - 30 min]

**Description**: Verify SendGrid webhook signature validation.

**Files**: `src/__tests__/api/webhooks/sendgrid.test.ts`

**Implementation**:
```typescript
describe('SendGrid webhook', () => {
  it('rejects invalid signature', async () => {
    const response = await handler(
      mockRequest({ 
        body: [{ event: 'open' }],
        headers: { 'x-twilio-email-event-webhook-signature': 'invalid' }
      }),
      mockResponse()
    );
    
    expect(mockResponse.status).toHaveBeenCalledWith(401);
  });
  
  it('accepts valid signature', async () => {
    const validSignature = generateValidSignature(payload);
    
    const response = await handler(
      mockRequest({ 
        body: payload,
        headers: { 'x-twilio-email-event-webhook-signature': validSignature }
      }),
      mockResponse()
    );
    
    expect(mockResponse.status).toHaveBeenCalledWith(200);
  });
});
```

**Validation**: `npm test -- --run sendgrid`

**Exit Criteria**: Signature verification tested.

**Commit**: `test: verify SendGrid webhook signature validation`

---

## Sprint D: Sequences & State Machine [P1 - 4 hours]

**Goal**: Reliable sequence execution with proper state transitions  
**Demo**: Enroll → Auto-send steps → Complete or pause on reply

### TD.1: Add sequence execution integration test [M - 45 min]

**Description**: Test full sequence execution flow.

**Files**: Create `src/__tests__/integration/sequence-execution.test.ts`

**Implementation**:
```typescript
describe('Sequence Execution', () => {
  it('executes sequence steps on schedule', async () => {
    // Create sequence with 2 steps
    const sequence = await createTestSequence([
      { type: 'email', delayDays: 0 },
      { type: 'email', delayDays: 1 },
    ]);
    
    // Enroll prospect
    const enrollment = await enrollProspect(testProspect, sequence);
    expect(enrollment.status).toBe('active');
    expect(enrollment.currentStepIndex).toBe(0);
    
    // Execute cron
    await executeCron();
    
    // Verify first email queued
    const emails = await getQueuedEmails(testProspect.email);
    expect(emails.length).toBe(1);
    
    // Verify enrollment advanced
    const updated = await getEnrollment(enrollment.id);
    expect(updated.currentStepIndex).toBe(1);
  });
});
```

**Validation**: `npm test -- --run sequence-execution`

**Exit Criteria**: Integration test passes.

**Commit**: `test: add sequence execution integration test`

---

### TD.2: Verify state machine transitions [M - 40 min]

**Description**: Test all state machine transitions.

**Files**: `src/__tests__/services/SequenceStateMachine.test.ts` (extend)

**Implementation**:
```typescript
describe('SequenceStateMachine transitions', () => {
  test.each([
    ['active', 'reply_detected', 'replied'],
    ['active', 'meeting_booked', 'meeting'],
    ['active', 'hard_bounce', 'bounced'],
    ['active', 'manual_pause', 'paused'],
    ['paused', 'resume', 'active'],
    ['active', 'all_steps_completed', 'completed'],
  ])('%s + %s = %s', (from, trigger, expected) => {
    const result = stateMachine.transition(from, trigger);
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe(expected);
  });
  
  test.each([
    ['completed', 'resume'],
    ['replied', 'manual_pause'],
    ['meeting', 'reply_detected'],
  ])('rejects %s + %s (terminal state)', (from, trigger) => {
    const result = stateMachine.transition(from, trigger);
    expect(result.success).toBe(false);
  });
});
```

**Validation**: `npm test -- --run SequenceStateMachine`

**Exit Criteria**: All transitions tested.

**Commit**: `test: complete state machine transition coverage`

---

### TD.3: Add reply detection integration [M - 45 min]

**Description**: Verify reply detection pauses sequence.

**Files**: `api/webhooks/inbound.ts`, test

**Implementation**:
```typescript
test('reply detection stops sequence', async () => {
  // Create active enrollment
  const enrollment = await createActiveEnrollment(testProspect);
  
  // Simulate inbound reply webhook
  await handler(mockRequest({
    body: {
      from: testProspect.email,
      subject: 'Re: Your email',
      text: 'Thanks for reaching out!',
    }
  }), mockResponse());
  
  // Verify enrollment status changed
  const updated = await getEnrollment(enrollment.id);
  expect(updated.status).toBe('replied');
});
```

**Validation**: `npm test -- --run inbound`

**Exit Criteria**: Reply detection working.

**Commit**: `test: verify reply detection stops sequence`

---

### TD.4: Add OOO detection and pause [S - 35 min]

**Description**: Verify OOO detection pauses sequence.

**Files**: `src/services/OutOfOfficeDetector.ts`, test

**Implementation**:
```typescript
describe('OutOfOfficeDetector', () => {
  const oooPatterns = [
    'I am out of the office',
    'I will be out of office until',
    'Currently on vacation',
    'Away from email until January 15',
    'Auto-reply: OOO',
  ];
  
  test.each(oooPatterns)('detects OOO: "%s"', (text) => {
    const result = detector.detectOOO(text);
    expect(result.isOOO).toBe(true);
  });
  
  it('extracts return date', () => {
    const result = detector.detectOOO('Out until January 15, 2026');
    expect(result.returnDate).toEqual(new Date('2026-01-15'));
  });
});
```

**Validation**: `npm test -- --run OutOfOfficeDetector`

**Exit Criteria**: OOO detection tested.

**Commit**: `test: verify OOO detection and date extraction`

---

### TD.5: Add Calendly webhook integration test [M - 40 min]

**Description**: Verify meeting booking stops sequence.

**Files**: `api/webhooks/calendly.ts`, test

**Implementation**:
```typescript
test('Calendly booking stops sequence', async () => {
  // Create active enrollment
  const enrollment = await createActiveEnrollment(testProspect);
  
  // Simulate Calendly webhook
  await handler(mockRequest({
    body: {
      event: 'invitee.created',
      payload: {
        email: testProspect.email,
        event_type: { name: 'Discovery Call' },
        scheduled_event: { start_time: '2026-02-05T10:00:00Z' },
      }
    }
  }), mockResponse());
  
  // Verify enrollment status
  const updated = await getEnrollment(enrollment.id);
  expect(updated.status).toBe('meeting');
  
  // Verify prospect status updated
  const prospect = await getProspect(testProspect.id);
  expect(prospect.meetingBooked).toBe(true);
});
```

**Validation**: `npm test -- --run calendly`

**Exit Criteria**: Meeting attribution working.

**Commit**: `test: verify Calendly webhook stops sequence`

---

## Sprint E: Tags, Filters & Search [P2 - 3 hours]

**Goal**: Filter prospects by tag, full-text search  
**Demo**: Add tag → Filter by tag → Search finds prospect

### TE.1: Add tag filter dropdown [M - 40 min]

**Description**: Dropdown to filter prospects by tag.

**Files**: `src/components/FilterBar.tsx`

**Implementation**:
```typescript
const availableTags = useMemo(() => {
  const tags = new Set<string>();
  prospects.forEach(p => p.tags?.forEach(t => tags.add(t)));
  return Array.from(tags).sort();
}, [prospects]);

<select 
  value={selectedTag}
  onChange={(e) => onTagFilterChange(e.target.value)}
  className="border rounded px-3 py-2"
>
  <option value="">All Tags</option>
  {availableTags.map(tag => (
    <option key={tag} value={tag}>{tag}</option>
  ))}
</select>
```

**Validation**: Add tags to prospects, verify filter works.

**Exit Criteria**: Tag filter dropdown working.

**Commit**: `feat(filters): add tag filter dropdown`

---

### TE.2: Add multi-tag filter support [S - 30 min]

**Description**: Filter by multiple tags (AND/OR logic).

**Files**: `src/components/FilterBar.tsx`

**Implementation**:
```typescript
const [tagFilterMode, setTagFilterMode] = useState<'and' | 'or'>('or');
const [selectedTags, setSelectedTags] = useState<string[]>([]);

const filteredProspects = useMemo(() => {
  if (selectedTags.length === 0) return prospects;
  
  return prospects.filter(p => {
    const prospectTags = p.tags || [];
    if (tagFilterMode === 'and') {
      return selectedTags.every(t => prospectTags.includes(t));
    }
    return selectedTags.some(t => prospectTags.includes(t));
  });
}, [prospects, selectedTags, tagFilterMode]);
```

**Validation**: Select multiple tags, toggle AND/OR, verify filtering.

**Exit Criteria**: Multi-tag filtering working.

**Commit**: `feat(filters): add multi-tag filter with AND/OR`

---

### TE.3: Add fuzzy search with Fuse.js [M - 45 min]

**Description**: Full-text fuzzy search across prospect fields.

**Files**: Create `src/hooks/useFuzzySearch.ts`

**Implementation**:
```typescript
import Fuse from 'fuse.js';

export function useFuzzySearch<T>(
  items: T[],
  keys: string[],
  query: string
): T[] {
  const fuse = useMemo(() => new Fuse(items, {
    keys,
    threshold: 0.3,
    ignoreLocation: true,
  }), [items, keys]);
  
  return useMemo(() => {
    if (!query.trim()) return items;
    return fuse.search(query).map(r => r.item);
  }, [fuse, query, items]);
}

// Usage in component:
const searchResults = useFuzzySearch(prospects, [
  'name', 'company', 'email', 'title', 'tags'
], searchQuery);
```

**Validation**: Search for partial name, verify matches.

**Exit Criteria**: Fuzzy search working.

**Commit**: `feat(search): add fuzzy search with Fuse.js`

---

### TE.4: Add search highlighting [S - 30 min]

**Description**: Highlight matching text in search results.

**Files**: Create `src/components/HighlightedText.tsx`

**Implementation**:
```typescript
export function HighlightedText({ text, query }: Props) {
  if (!query) return <>{text}</>;
  
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200">{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
}
```

**Validation**: Search, verify matches highlighted.

**Exit Criteria**: Search highlighting working.

**Commit**: `feat(search): add search result highlighting`

---

### TE.5: Add saved filters [S - 30 min]

**Description**: Save and load filter presets.

**Files**: `src/services/SavedFiltersService.ts`

**Implementation**:
```typescript
export interface SavedFilter {
  id: string;
  name: string;
  filters: {
    tags: string[];
    tagMode: 'and' | 'or';
    tier?: string;
    hasEmail?: boolean;
    status?: string;
  };
}

export class SavedFiltersService {
  async save(userId: string, filter: Omit<SavedFilter, 'id'>): Promise<string> {
    const ref = await db.collection('users').doc(userId)
      .collection('saved_filters').add(filter);
    return ref.id;
  }
  
  async load(userId: string): Promise<SavedFilter[]> {
    const snap = await db.collection('users').doc(userId)
      .collection('saved_filters').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedFilter));
  }
}
```

**Validation**: Save filter, reload page, load saved filter.

**Exit Criteria**: Saved filters persisted.

**Commit**: `feat(filters): add saved filter presets`

---

## Sprint F: Bulk Send UX & Rate Limits [P1 - 4 hours]

**Goal**: Send 50+ emails with progress tracking and rate limiting  
**Demo**: Select 50 prospects → Send bulk → See progress bar → All sent

### TF.1: Add bulk send progress modal [M - 45 min]

**Description**: Modal showing send progress during bulk operations.

**Files**: Create `src/components/BulkSendProgressModal.tsx`

**Implementation**:
```typescript
export function BulkSendProgressModal({ 
  isOpen, 
  total, 
  sent, 
  failed, 
  onCancel 
}: Props) {
  const progress = ((sent + failed) / total) * 100;
  
  return (
    <Dialog open={isOpen}>
      <div className="p-6">
        <h2 className="text-lg font-semibold">Sending Emails</h2>
        
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span>{sent + failed} of {total}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        
        <div className="mt-4 flex gap-4 text-sm">
          <span className="text-green-600">✓ {sent} sent</span>
          {failed > 0 && <span className="text-red-600">✗ {failed} failed</span>}
        </div>
        
        <button 
          onClick={onCancel}
          className="mt-6 w-full py-2 border rounded hover:bg-gray-50"
        >
          Cancel Remaining
        </button>
      </div>
    </Dialog>
  );
}
```

**Validation**: Trigger bulk send, verify progress updates.

**Exit Criteria**: Progress modal shows real-time status.

**Commit**: `feat(bulk): add bulk send progress modal`

---

### TF.2: Implement client-side rate limiting [M - 40 min]

**Description**: Throttle sends to avoid overwhelming API.

**Files**: `src/hooks/useBulkSend.ts`

**Implementation**:
```typescript
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000; // 1 second between batches

export function useBulkSend() {
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const cancelRef = useRef(false);
  
  const sendBulk = async (emails: EmailPayload[]) => {
    setProgress({ sent: 0, failed: 0, total: emails.length });
    cancelRef.current = false;
    
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      if (cancelRef.current) break;
      
      const batch = emails.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(e => sendEmail(e))
      );
      
      const sent = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      setProgress(p => ({
        ...p,
        sent: p.sent + sent,
        failed: p.failed + failed,
      }));
      
      // Rate limit delay
      if (i + BATCH_SIZE < emails.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }
  };
  
  const cancel = () => { cancelRef.current = true; };
  
  return { sendBulk, progress, cancel };
}
```

**Validation**: Send 50 emails, verify batching and delays.

**Exit Criteria**: Rate limiting prevents API overload.

**Commit**: `feat(bulk): add client-side rate limiting`

---

### TF.3: Add retry failed emails UI [S - 30 min]

**Description**: Show failed emails with retry option.

**Files**: `src/components/BulkSendResultsModal.tsx`

**Implementation**:
```typescript
export function BulkSendResultsModal({ results, onRetryFailed }: Props) {
  const failed = results.filter(r => !r.success);
  
  return (
    <Dialog>
      <div className="p-6">
        <h2>Send Complete</h2>
        
        <div className="mt-4">
          <p className="text-green-600">
            ✓ {results.length - failed.length} sent successfully
          </p>
          
          {failed.length > 0 && (
            <>
              <p className="text-red-600 mt-2">
                ✗ {failed.length} failed
              </p>
              
              <ul className="mt-2 max-h-40 overflow-y-auto text-sm">
                {failed.map(f => (
                  <li key={f.email} className="text-gray-600">
                    {f.email}: {f.error}
                  </li>
                ))}
              </ul>
              
              <button 
                onClick={() => onRetryFailed(failed)}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded"
              >
                Retry {failed.length} Failed
              </button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
```

**Validation**: Fail some emails, verify retry works.

**Exit Criteria**: Retry functionality working.

**Commit**: `feat(bulk): add retry failed emails UI`

---

### TF.4: Add daily send limit warning [S - 25 min]

**Description**: Warn when approaching daily send limit.

**Files**: `src/hooks/useSendLimits.ts`

**Implementation**:
```typescript
export function useSendLimits() {
  const [stats, setStats] = useState({ sent: 0, limit: 100, remaining: 100 });
  
  useEffect(() => {
    const fetchStats = async () => {
      const res = await fetch('/api/email/stats');
      const data = await res.json();
      setStats({
        sent: data.sentToday,
        limit: data.dailyLimit,
        remaining: data.dailyLimit - data.sentToday,
      });
    };
    
    fetchStats();
  }, []);
  
  const canSend = (count: number) => stats.remaining >= count;
  const warningThreshold = stats.limit * 0.8;
  const showWarning = stats.sent >= warningThreshold;
  
  return { stats, canSend, showWarning };
}
```

**Validation**: Approach limit, verify warning shows.

**Exit Criteria**: Limit warning working.

**Commit**: `feat(bulk): add daily send limit warning`

---

### TF.5: Add bulk send confirmation [S - 25 min]

**Description**: Confirmation dialog before bulk send.

**Files**: `src/components/BulkSendConfirmation.tsx`

**Implementation**:
```typescript
export function BulkSendConfirmation({ count, onConfirm, onCancel }: Props) {
  const { stats, canSend, showWarning } = useSendLimits();
  
  return (
    <Dialog>
      <div className="p-6">
        <h2>Send {count} Emails?</h2>
        
        <p className="mt-2 text-gray-600">
          This will send emails to {count} selected prospects.
        </p>
        
        {showWarning && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            ⚠️ You've used {stats.sent}/{stats.limit} of your daily limit
          </div>
        )}
        
        {!canSend(count) && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            ❌ This exceeds your daily limit. Only {stats.remaining} remaining.
          </div>
        )}
        
        <div className="mt-6 flex gap-3">
          <button onClick={onCancel}>Cancel</button>
          <button 
            onClick={onConfirm}
            disabled={!canSend(count)}
          >
            Send {count} Emails
          </button>
        </div>
      </div>
    </Dialog>
  );
}
```

**Validation**: Attempt bulk send, verify confirmation.

**Exit Criteria**: Confirmation required for bulk send.

**Commit**: `feat(bulk): add send confirmation dialog`

---

## Sprint G: Monitoring & Alerts [P1 - 3.5 hours]

**Goal**: Dashboard shows system health, alerts on issues  
**Demo**: View dashboard → See queue depth → Trigger alert  
**Prerequisite**: CRIT-3 (Sentry) must be complete before dashboard can show error rates
### TG.0: Verify stats API endpoints [S - 25 min] ⭐ NEW

**Description**: Ensure `/api/email/stats` and `/api/railway/[...]/health` return required fields (queue depth, sentToday, successRate, recentFailures) before wiring widgets.

**Files**: `api/email/railway-stats.ts`, `api/railway/health.ts`

**Implementation**:
```typescript
// api/email/railway-stats.ts
const stats = await railwayServerClient.get('/api/email/stats');
return res.status(200).json({
  queued: stats.queue.waiting,
  sentToday: stats.sentToday,
  successRate: stats.successRate,
  recentFailures: stats.recentFailures?.slice(0, 10) ?? [],
});

// api/railway/health.ts
// add queue + sendgrid checks to payload used by dashboard
```

**Validation**:
```bash
curl -s http://localhost:3000/api/email/railway-stats | jq .
curl -s http://localhost:3000/api/railway/health | jq .
```

**Exit Criteria**: Stats endpoints return required fields consumed by dashboard widgets.

**Commit**: `feat(monitoring): expose email stats for dashboard`

---


### TG.0: Create/verify stats API endpoints [S - 30 min] ⭐ NEW

**Description**: Ensure backend APIs exist to provide data for dashboard widgets. Dashboard widgets (TG.1-TG.3) depend on these endpoints.

**Files**: Verify/create `api/email/stats.ts`, `api/sequences/health.ts`

**Implementation**:
```typescript
// api/email/stats.ts - verify or create
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { railwayServerClient } from '../../lib/railway-client';
import { getAdminDb } from '../../lib/firebaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Try Railway first for queue stats
    const railwayStats = await railwayServerClient.get('/api/email/stats');
    
    // Supplement with Firestore data
    const db = getAdminDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sentToday = await db.collection('email_logs')
      .where('sentAt', '>=', today)
      .count()
      .get();
    
    const bounced = await db.collection('suppression_list')
      .where('reason', '==', 'hard_bounce')
      .count()
      .get();
    
    res.json({
      queued: railwayStats.queue?.waiting || 0,
      sentToday: sentToday.data().count,
      bounceRate: (bounced.data().count / sentToday.data().count * 100) || 0,
      successRate: 100 - (bounced.data().count / sentToday.data().count * 100) || 100,
    });
  } catch (err) {
    res.status(503).json({ error: 'Stats unavailable', fallback: true });
  }
}
```

**Validation**:
```bash
curl -s http://localhost:3000/api/email/stats | jq .
# Should return: { "queued": 0, "sentToday": X, "successRate": Y }
```

**Exit Criteria**: Stats endpoints return valid data.

**Commit**: `feat(api): add email and sequence stats endpoints`

---

### TG.1: Create email pipeline dashboard [M - 45 min]

**Description**: Dashboard widget showing email queue status.

**Files**: Create `src/components/dashboard/EmailPipelineWidget.tsx`

**Implementation**:
```typescript
export function EmailPipelineWidget() {
  const { data, isLoading } = useQuery(['emailStats'], fetchEmailStats);
  
  if (isLoading) return <Skeleton />;
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-semibold">Email Pipeline</h3>
      
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Stat label="Queued" value={data.queued} />
        <Stat label="Sent Today" value={data.sentToday} />
        <Stat label="Success Rate" value={`${data.successRate}%`} />
      </div>
      
      {data.queued > 100 && (
        <Alert type="warning" className="mt-4">
          High queue depth - emails may be delayed
        </Alert>
      )}
    </div>
  );
}
```

**Validation**: View dashboard, verify stats display.

**Exit Criteria**: Email pipeline widget working.

**Commit**: `feat(monitoring): add email pipeline dashboard widget`

---

### TG.2: Create sequence health widget [M - 40 min]

**Description**: Dashboard widget showing sequence execution health.

**Files**: Create `src/components/dashboard/SequenceHealthWidget.tsx`

**Implementation**:
```typescript
export function SequenceHealthWidget() {
  const { data } = useQuery(['sequenceHealth'], fetchSequenceHealth);
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-semibold">Sequence Health</h3>
      
      <div className="mt-4 space-y-3">
        <div className="flex justify-between">
          <span>Active Enrollments</span>
          <span className="font-medium">{data.activeEnrollments}</span>
        </div>
        <div className="flex justify-between">
          <span>Steps Due</span>
          <span className="font-medium">{data.stepsDue}</span>
        </div>
        <div className="flex justify-between">
          <span>Last Execution</span>
          <span className="font-medium">
            {formatRelative(data.lastExecutionTime)}
          </span>
        </div>
      </div>
      
      {data.lastExecutionFailed && (
        <Alert type="error" className="mt-4">
          Last cron execution failed!
        </Alert>
      )}
    </div>
  );
}
```

**Validation**: View dashboard, verify sequence stats.

**Exit Criteria**: Sequence health widget working.

**Commit**: `feat(monitoring): add sequence health dashboard widget`

---

### TG.3: Add Slack webhook integration [M - 40 min]

**Description**: Send alerts to Slack channel.

**Files**: `lib/alerting.ts`

**Implementation**:
```typescript
async function sendSlackAlert(
  message: string, 
  severity: AlertSeverity, 
  context: AlertContext
): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return false;
  
  const color = {
    [AlertSeverity.INFO]: '#36a64f',
    [AlertSeverity.WARNING]: '#ffcc00',
    [AlertSeverity.ERROR]: '#ff0000',
    [AlertSeverity.CRITICAL]: '#8b0000',
  }[severity];
  
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [{
          color,
          title: `[${severity.toUpperCase()}] ${message}`,
          fields: Object.entries(context).map(([k, v]) => ({
            title: k,
            value: String(v),
            short: true,
          })),
          ts: Math.floor(Date.now() / 1000),
        }],
      }),
    });
    return true;
  } catch {
    return false;
  }
}
```

**Validation**: Trigger alert, verify Slack message.

**Exit Criteria**: Slack alerts working.

**Commit**: `feat(monitoring): add Slack webhook alerts`

---

### TG.4: Add alert thresholds configuration [S - 30 min]

**Description**: Configurable thresholds for alerts.

**Files**: `lib/alerting.ts`

**Implementation**:
```typescript
export const ALERT_THRESHOLDS = {
  emailQueueDepth: {
    warning: 100,
    critical: 500,
  },
  cronFailureRate: {
    warning: 0.1, // 10%
    critical: 0.5, // 50%
  },
  sequenceStepsDue: {
    warning: 50,
    critical: 200,
  },
};

export function checkThresholds(metrics: SystemMetrics): Alert[] {
  const alerts: Alert[] = [];
  
  if (metrics.emailQueueDepth >= ALERT_THRESHOLDS.emailQueueDepth.critical) {
    alerts.push({
      severity: AlertSeverity.CRITICAL,
      message: `Email queue depth critical: ${metrics.emailQueueDepth}`,
    });
  } else if (metrics.emailQueueDepth >= ALERT_THRESHOLDS.emailQueueDepth.warning) {
    alerts.push({
      severity: AlertSeverity.WARNING,
      message: `Email queue depth high: ${metrics.emailQueueDepth}`,
    });
  }
  
  // ... check other thresholds
  
  return alerts;
}
```

**Validation**: Exceed thresholds, verify correct alerts fire.

**Exit Criteria**: Threshold-based alerting working.

**Commit**: `feat(monitoring): add configurable alert thresholds`

---

### TG.5: Add alert history dashboard [S - 25 min]

**Description**: View recent alerts in dashboard.

**Files**: Create `src/components/dashboard/AlertHistoryWidget.tsx`

**Implementation**:
```typescript
export function AlertHistoryWidget() {
  const { data } = useQuery(['alertHistory'], async () => {
    const snap = await db.collection('alerts')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    return snap.docs.map(d => d.data());
  });
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-semibold">Recent Alerts</h3>
      
      <div className="mt-4 space-y-2">
        {data?.map((alert, i) => (
          <div 
            key={i}
            className={cn(
              "p-2 rounded text-sm",
              alert.severity === 'error' && "bg-red-50",
              alert.severity === 'warning' && "bg-yellow-50"
            )}
          >
            <span className="font-medium">{alert.message}</span>
            <span className="text-gray-500 text-xs ml-2">
              {formatRelative(alert.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Validation**: Trigger alerts, verify appear in history.

**Exit Criteria**: Alert history visible.

**Commit**: `feat(monitoring): add alert history widget`

---

## Sprint H: Tests, CI & E2E [P1 - 4 hours]

**Goal**: 90%+ test coverage, all E2E tests green  
**Demo**: Run full test suite → All green → Coverage report

### TH.1: Add missing service tests [M - 45 min]

**Description**: Increase coverage for core services.

**Files**: Various test files

**Tasks**:
- `EmailQueueService.test.ts` - processBatch, cancelPending
- `SequenceSchedulerService.test.ts` - getDueEnrollments edge cases
- `RailwayApiClient.test.ts` - error handling, retries

**Validation**: `npm run test:coverage`

**Exit Criteria**: Service coverage > 90%.

**Commit**: `test: increase service test coverage`

---

### TH.2: Add missing component tests [M - 45 min]

**Description**: Increase coverage for UI components.

**Files**: Various test files

**Tasks**:
- `BulkSendProgressModal.test.tsx`
- `FilterBar.test.tsx`
- `KeyboardShortcutsHelp.test.tsx`

**Validation**: `npm run test:coverage`

**Exit Criteria**: Component coverage > 85%.

**Commit**: `test: increase component test coverage`

---

### TH.3: Fix flaky tests [M - 40 min]

**Description**: Identify and fix flaky tests.

**Implementation**:
```bash
# Run tests multiple times to identify flaky tests
for i in {1..10}; do npm test -- --run 2>&1 | grep -E "FAIL|PASS"; done
```

Common fixes:
- Add proper async/await
- Mock timers consistently
- Reset mocks in beforeEach

**Validation**: Run tests 10 times, all pass.

**Exit Criteria**: No flaky tests.

**Commit**: `test: fix flaky tests`

---

### TH.4: Add E2E test for sequence enrollment [M - 45 min]

**Description**: E2E test for enrolling prospect in sequence.

**Files**: Create `e2e/sequence-enrollment.spec.ts`

**Implementation**:
```typescript
test('enroll prospect in sequence', async ({ page }) => {
  await loginAsTestUser(page);
  
  // Select prospect
  await page.getByTestId('prospect-row-0').click();
  
  // Click enroll button
  await page.getByRole('button', { name: /enroll in sequence/i }).click();
  
  // Select sequence
  await page.getByRole('option', { name: /intro sequence/i }).click();
  
  // Confirm enrollment
  await page.getByRole('button', { name: /confirm/i }).click();
  
  // Verify success
  await expect(page.getByText(/enrolled/i)).toBeVisible();
  
  // Verify badge shows
  await expect(page.getByTestId('sequence-badge')).toBeVisible();
});
```

**Validation**: `npm run test:e2e -- sequence-enrollment`

**Exit Criteria**: E2E test passes.

**Commit**: `test(e2e): add sequence enrollment test`

---

### TH.5: Add CI workflow enhancements [S - 30 min]

**Description**: Enhance CI with coverage reporting and caching.

**Files**: `.github/workflows/ci.yml`

**Implementation**:
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run test:coverage
      
      - uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true
          
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npm run test:e2e
      
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

**Validation**: Push PR, verify CI runs all checks.

**Exit Criteria**: CI runs tests, coverage, E2E.

**Commit**: `ci: add coverage reporting and E2E to workflow`

---

### TH.6: Add load testing for bulk operations [M - 45 min] ⭐ NEW

**Description**: Ensure bulk email and bulk tag operations perform well under load. Tests should verify the system handles 100+ prospects without UI freezing or backend timeouts.

**Files**: Create `e2e/bulk-operations-load.spec.ts`, `src/__tests__/hooks/useBulkOperations.perf.test.ts`

**Implementation**:
```typescript
// e2e/bulk-operations-load.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Bulk operations load testing', () => {
  test.beforeEach(async ({ page }) => {
    // Seed 150 test prospects
    await page.request.post('/api/test/seed-prospects', {
      data: { count: 150 }
    });
    await page.goto('/');
    await loginAsTestUser(page);
  });

  test('bulk tag 100 prospects completes in under 10s', async ({ page }) => {
    // Select all visible prospects
    await page.getByTestId('select-all').click();
    
    // Open bulk tag modal
    await page.getByRole('button', { name: /tag/i }).click();
    
    // Start timing
    const startTime = Date.now();
    
    // Apply tag
    await page.getByLabel('Tag').fill('load-test');
    await page.getByRole('button', { name: /apply/i }).click();
    
    // Wait for completion
    await expect(page.getByText(/tagged 100/i)).toBeVisible({ timeout: 15000 });
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(10000);
  });

  test('bulk email 50 prospects shows progress without freezing', async ({ page }) => {
    // Select 50 prospects
    for (let i = 0; i < 50; i++) {
      await page.getByTestId(`prospect-checkbox-${i}`).click();
    }
    
    // Open bulk email modal
    await page.getByRole('button', { name: /send email/i }).click();
    
    // Fill form
    await page.getByLabel('Subject').fill('Load test');
    await page.getByLabel('Message').fill('Hello {name}');
    
    // Send
    await page.getByRole('button', { name: /send/i }).click();
    
    // Verify progress bar updates (not frozen)
    await expect(page.getByTestId('progress-bar')).toBeVisible();
    const initialProgress = await page.getByTestId('progress-text').textContent();
    
    await page.waitForTimeout(2000);
    
    const updatedProgress = await page.getByTestId('progress-text').textContent();
    expect(updatedProgress).not.toBe(initialProgress);
    
    // Wait for completion
    await expect(page.getByText(/sent 50/i)).toBeVisible({ timeout: 60000 });
  });
});

// src/__tests__/hooks/useBulkOperations.perf.test.ts
describe('useBulkOperations performance', () => {
  it('processes 100 tag operations in under 5 seconds', async () => {
    const { result } = renderHook(() => useBulkOperations());
    
    const prospects = Array.from({ length: 100 }, (_, i) => ({
      id: `p-${i}`,
      email: `test${i}@example.com`,
    }));
    
    const startTime = performance.now();
    
    await act(async () => {
      await result.current.tagMany(prospects, 'perf-test');
    });
    
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(5000);
  });
});
```

**Validation**:
```bash
npm run test:e2e -- bulk-operations-load.spec.ts
npm test -- --run useBulkOperations.perf
```

**Exit Criteria**: Bulk operations complete within acceptable time limits.

**Commit**: `test(perf): add load testing for bulk operations`

---

## Sprint I: Docs, Runbook & Secrets [P2 - 2 hours]

**Goal**: Complete documentation for production operations  
**Demo**: Follow runbook to diagnose and fix issue

### TI.1: Create production runbook [M - 40 min]

**Description**: Runbook for common production issues.

**Files**: Create `docs/RUNBOOK.md`

**Content**:
- Email queue backed up
- Sequence execution failing
- Railway connection issues
- High error rate
- Rate limit exceeded

**Exit Criteria**: Runbook covers top 5 issues.

**Commit**: `docs: add production runbook`

---

### TI.1b: Incident response playbook [S - 25 min] ⭐ NEW

**Description**: Playbook for on-call response with clear severity levels, comms templates, and SLO/SLI references.

**Files**: Create `docs/INCIDENT_RESPONSE.md`

**Content**:
- Severity matrix (SEV-1 to SEV-4) with examples (email outage, webhook backlog, high bounce rate)
- Roles and contacts (incident commander, communications, on-call)
- Runbook links (RUNBOOK.md sections), alert channels
- Templates: initial notice, hourly update, resolution, postmortem checklist

**Exit Criteria**: Playbook printable and actionable for on-call.

**Commit**: `docs: add incident response playbook`

---

### TI.2: Document secrets rotation process [S - 25 min]

**Description**: How to rotate secrets safely.

**Files**: Create `docs/SECRETS_ROTATION.md`

**Content**:
- SENDGRID_API_KEY rotation
- RAILWAY_API_SECRET rotation
- Firebase service account rotation
- Rollback procedures

**Exit Criteria**: Rotation process documented.

**Commit**: `docs: add secrets rotation guide`

---

### TI.3: Create deployment checklist [S - 25 min]

**Description**: Pre-deployment verification checklist.

**Files**: Create `docs/DEPLOYMENT_CHECKLIST.md`

**Content**:
```markdown
## Pre-Deployment

- [ ] All tests pass locally
- [ ] TypeScript compiles without errors
- [ ] No console.log statements in production code
- [ ] Environment variables documented
- [ ] Migration scripts tested

## Post-Deployment

- [ ] Health check passes
- [ ] Smoke test email sends
- [ ] Cron jobs running
- [ ] No new errors in Sentry
- [ ] Monitor for 15 minutes
```

**Exit Criteria**: Checklist covers all steps.

**Commit**: `docs: add deployment checklist`

---

### TI.4: Update copilot-instructions.md [S - 30 min]

**Description**: Update with latest patterns and sprints.

**Files**: `.github/copilot-instructions.md`

**Updates**:
- Current sprint status
- New services added
- New patterns (hooks, components)
- Updated file references

**Exit Criteria**: Instructions current.

**Commit**: `docs: update copilot instructions`

---

## Sprint J: Polish & Release [P2 - 2 hours]

**Goal**: Final polish and v1.0 release  
**Demo**: Complete walkthrough of all features

### TJ.1: Console.log cleanup [S - 25 min]

**Description**: Remove debug console.log statements.

**Implementation**:
```bash
# Find console.log statements
grep -r "console.log" src/ --include="*.ts" --include="*.tsx" | grep -v ".test."

# Replace with logger where appropriate
```

**Exit Criteria**: No console.log in production code.

**Commit**: `chore: remove debug console.log statements`

---

### TJ.2: Bundle size optimization [M - 35 min]

**Description**: Analyze and reduce bundle size.

**Implementation**:
```bash
npm run build -- --analyze
```

Optimizations:
- Lazy load heavy components
- Tree shake unused exports
- Optimize images

**Exit Criteria**: Bundle < 2MB.

**Commit**: `perf: optimize bundle size`

---

### TJ.3: Create CHANGELOG [S - 25 min]

**Description**: Document changes for v1.0 release.

**Files**: Create `CHANGELOG.md`

**Content**:
```markdown
# Changelog

## [1.0.0] - 2026-02-03

### Added
- Email sequence automation
- Bulk email sending with progress tracking
- Railway backend integration
- Keyboard navigation
- Accessibility improvements

### Fixed
- ErrorBoundary for all panels
- Email validation
- Rate limiting

### Security
- Secrets audit
- CAN-SPAM compliance
- Data retention policies
```

**Exit Criteria**: CHANGELOG complete.

**Commit**: `docs: add CHANGELOG for v1.0`

---

### TJ.4: Create release tag [XS - 15 min]

**Description**: Tag v1.0.0 release.

**Implementation**:
```bash
git tag -a v1.0.0 -m "v1.0.0 - Production Release"
git push origin v1.0.0
```

**Exit Criteria**: Tag pushed to GitHub.

**Commit**: `release: v1.0.0`

---

## Validation Commands Summary

```bash
# Type check
npx tsc --noEmit

# Unit tests
npm test -- --run

# Coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# Build
npm run build

# Secrets audit
npx tsx scripts/audit-secrets.ts

# Lint (if configured)
npm run lint
```

---

## Post-Sprint Checklist

### After CRIT Sprints
- [ ] Secrets audit passing in CI
- [ ] CAN-SPAM compliance verified
- [ ] Sentry receiving errors
- [ ] Rate limiting active
- [ ] Security scanning enabled
- [ ] Data retention policy documented

### After Feature Sprints
- [ ] All E2E tests green
- [ ] Coverage > 85%
- [ ] No flaky tests
- [ ] Runbook complete
- [ ] v1.0.0 tagged

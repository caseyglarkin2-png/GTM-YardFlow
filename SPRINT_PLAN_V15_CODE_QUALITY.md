# Sprint Plan V15: Code Quality & Technical Debt Elimination

**Created**: January 31, 2026  
**Status**: Ready for Execution  
**Goal**: Eliminate all IDE errors (145+) in GTM-YardFlow and ESLint warnings (53) in YardFlow-Hitlist  
**Reviewed By**: Subagent on Jan 31, 2026

---

## Executive Summary

Two categories of code quality issues need resolution:

| Repo | Issue Type | Count | Severity | Blocking? |
|------|-----------|-------|----------|-----------|
| GTM-YardFlow | IDE TypeScript Errors | 145+ | Low | ❌ Build passes |
| YardFlow-Hitlist | ESLint Warnings | 53 | Low | ❌ Build passes |

All issues are **non-blocking** but create developer friction and mask real errors.

---

## Sprint 400A: IDE Config Root Cause (GTM-YardFlow)

**Goal**: Fix TypeScript configuration so IDE recognizes test types  
**Effort**: Small (15 minutes)  
**Root Cause**: IDE uses `tsconfig.json` which excludes tests. Need to configure types in `tsconfig.test.json` and add declaration file.

### T400.1: Add Complete Type References to Test Config
**Problem**: `toBeInTheDocument()`, `import.meta.env` not recognized in test files  
**Root Cause**: `tsconfig.test.json` missing jest-dom and vite/client types

**Files Modified**:
- `tsconfig.test.json` - Add `@testing-library/jest-dom` and `vite/client` to types
- `src/__tests__/vitest.d.ts` - Create declaration file extending Vitest matchers

**Changes Applied**:
```json
// tsconfig.test.json
{
  "compilerOptions": {
    "types": ["vitest/globals", "node", "@testing-library/jest-dom", "vite/client"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

```typescript
// src/__tests__/vitest.d.ts
/// <reference types="vitest" />
/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />
/// <reference types="vite/client" />

import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  interface Assertion<T = unknown> extends TestingLibraryMatchers<T, void> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, void> {}
}
```

**Validation**:
```bash
npm test -- --run
# All tests pass
```

**Status**: ✅ COMPLETE

---

### T400.2: Fix Module Resolution for Tests
**Problem**: IDE can't resolve `@/components/...`, `@/hooks/...`, `@/services/...` in test files  
**Root Cause**: `tsconfig.test.json` needed `baseUrl` and `paths` from parent

**Files Modified**:
- `tsconfig.test.json` - Added `baseUrl` and `paths`

**Status**: ✅ COMPLETE (done in T400.1)

---

### T400.3: Fix Mock Type Mismatch
**Problem**: Type assertion error in HealthDashboard.test.tsx line 28  
**Root Cause**: Direct cast from RailwayApiClient to mock type fails

**Files Modified**:
- `src/__tests__/components/HealthDashboard.test.tsx`

**Changes Applied**:
```typescript
// Before:
const mockRailwayClient = railwayClient as { health: { check: ... } };

// After:
const mockRailwayClient = railwayClient as unknown as { health: { check: ... } };
```

**Status**: ✅ COMPLETE

---

## Sprint 400B: Remaining Test File Fixes (GTM-YardFlow)

**Goal**: Fix remaining IDE errors in test files  
**Effort**: Small (30 minutes)

### T400.4: Fix Implicit Any in Test Callbacks
**Problem**: Some test callbacks have implicit `any` types

**Files to Check**:
- `src/__tests__/services/HotListScoringService.test.ts`

**Pattern Fix**:
```typescript
// Before:
buckets.critical.map(b => b.prospectId)

// After:
buckets.critical.map((b: ProspectScore) => b.prospectId)
```

**Validation**:
```bash
npx tsc -p tsconfig.test.json --noEmit
```

---

### T400.5: Fix E2E Test Unused Variables
**Problem**: Unused variables in e2e tests cause TS6133 errors

**Files to Fix**:
- `e2e/*.spec.ts`

**Pattern Fix**:
```typescript
// Before:
const skeleton = page.locator('.skeleton');

// After:
const _skeleton = page.locator('.skeleton'); // prefix with underscore
```

**Validation**:
```bash
npx tsc -p tsconfig.test.json --noEmit
```

---

### T400.6: Verify Zero IDE Errors and Commit
**Actions**:
1. Restart TypeScript server in VS Code: `Cmd+Shift+P` → "TypeScript: Restart TS Server"
2. Open Problems panel and verify 0 errors in test files
3. Run full test suite
4. Commit with message: `Sprint 400: Fix IDE type configuration`

**Validation**:
```bash
npm test -- --run && npx tsc --noEmit
# All tests pass, no type errors
```

---

## Sprint 401: ESLint Cleanup (YardFlow-Hitlist)

> ⚠️ **Note**: This sprint targets a **different repository** (YardFlow-Hitlist on Railway).
> Track in that repo's issue tracker. Link as dependency rather than sequential task.

**Goal**: Eliminate all 53 ESLint warnings in YardFlow-Hitlist  
**Effort**: Medium (2-3 hours)  
**Validation**: `npx eslint src --max-warnings 0` passes

### T401.1: Define SendGrid Webhook Types
**Problem**: `@typescript-eslint/no-explicit-any` in sendgrid webhook handler  
**Location**: `src/app/api/webhooks/sendgrid/route.ts`

**Files to Create**:
- `src/types/sendgrid-webhooks.ts`

**Type Definitions**:
```typescript
export interface SendGridWebhookEvent {
  email: string;
  timestamp: number;
  event: 'delivered' | 'open' | 'click' | 'bounce' | 'dropped' | 'spamreport' | 'unsubscribe' | 'deferred';
  sg_event_id: string;
  sg_message_id: string;
  useragent?: string;
  ip?: string;
  url?: string;
  reason?: string;
  status?: string;
  type?: string;
  // Custom args passed from send
  emailId?: string;
  prospectId?: string;
  sequenceId?: string;
  enrollmentId?: string;
}

export type SendGridWebhookPayload = SendGridWebhookEvent[];
```

---

### T401.2: Define Sequence API Types
**Problem**: `@typescript-eslint/no-explicit-any` in sequence routes  
**Location**: `src/app/api/sequences/**/*.ts`

**Files to Create**:
- `src/types/sequence-api.ts`

---

### T401.3: Replace `any` with Specific Types
**Problem**: Remaining `any` usages in API routes

**Pattern Replacements**:
```typescript
// Before: 
const data: any = await req.json();
// After:
const data = await req.json() as SendGridWebhookPayload;

// Before:
catch (error: any)
// After:
catch (error: unknown)
```

---

### T401.4: Commit and Verify Zero Warnings
```bash
npx eslint src --max-warnings 0
npm run build
git commit -m "Sprint 401: Fix ESLint warnings (53 → 0)"
```

---

## Sprint 402: Test Coverage Gaps

**Goal**: Ensure all critical paths have test coverage  
**Effort**: Medium (2-3 hours)  
**Validation**: Coverage meets thresholds (70% statements, 60% branches)

### T402.1: Add Missing Hook Tests
**Files to Test** (verified to exist):
- `src/hooks/useSequenceEnrollment.ts`
- `src/hooks/useEmailQueueHealth.ts` ✓
- `src/hooks/useProspectSearch.ts` ✓

---

### T402.2: Add Missing Component Tests
**Files to Test**:
- `src/components/sequences/SequenceBuilder.tsx`
- `src/components/prospects/ProspectFilters.tsx`
- `src/components/email/EmailPreview.tsx`

---

### T402.3: Add Integration Test for Email Flow
**Test File**: `src/__tests__/integration/email-send-flow.test.ts`

---

## Sprint 403: Documentation Hygiene

**Goal**: Ensure all documentation is current and accurate  
**Effort**: Small (1 hour)

### T403.1: Update API Documentation
### T403.2: Archive Completed Sprint Plans
### T403.3: Update README with Current Architecture

---

## Execution Order (Revised per Subagent Review)

```
Sprint 400A (15 min) → Sprint 400B (30 min)
     ↓                      ↓
  Config Fix             Test Fixes
     ↓                      ↓
  Types Working          0 IDE Errors
                              ↓
                    ┌─────────┴──────────┐
                    ↓                    ↓
             Sprint 402             Sprint 403
            (2-3 hrs)               (1 hr)
            Coverage                 Docs
                    ↓
             Sprint 401 (SEPARATE REPO)
            (2-3 hrs, YardFlow-Hitlist)
```

---

## Success Criteria

| Sprint | Metric | Target | Status |
|--------|--------|--------|--------|
| 400A | Test type config | Complete | ✅ Done |
| 400B | IDE Errors | 0 | ⏳ Pending |
| 401 | ESLint Warnings | 0 | ⏳ Pending (separate repo) |
| 402 | Statement Coverage | ≥70% | ⏳ Pending |
| 403 | Stale Docs | 0 | ⏳ Pending |

---

## Changes from V15 Original (per Subagent Review)

1. **Split Sprint 400** into 400A (config) and 400B (fixes)
2. **Added vite/client types** for import.meta.env support
3. **Added vitest.d.ts** declaration file for proper type extension
4. **Fixed file references** in Sprint 402 (useEmailQueueHealth, useProspectSearch)
5. **Marked Sprint 401** as separate repo with explicit note
6. **Added T400.4** for implicit any fixes
7. **Added T400.5** for e2e unused variable fixes
8. **Clarified root cause** - IDE uses tsconfig.json which excludes tests

# YardFlow GTM Hub - Sprint & Task Breakdown V4 (Meeting Machine)

## Project Overview
YardFlow Hub is a React/TypeScript SPA that transforms a prospect hitlist into booked meetings at Manifest 2026. The app generates persona-aware DMs (≤250 chars), long-form email sequences, deterministic ROI assets, and HubSpot-ready exports.

**Tech Stack:** Vite 5.x + React 18 + TypeScript 5.x + Tailwind CSS 3.4 + Firebase (Auth/Firestore) + Gemini AI + Zod

**Deployed:** https://gtm-yard-flow.vercel.app

**Test Coverage:** 40 tests passing (Vitest + React Testing Library)

---

## North Star
A prospect cockpit that turns an attendee hitlist into booked meetings by generating:
- Event-app DMs (≤250 chars) that don't sound like vendor oatmeal
- Persona-aware email + follow-up sequences
- Deterministic ROI snapshots + exportable micro-assets
- A Marketing Module that segments and exports HubSpot-ready sequences

## Non-Negotiables
- **No scraping/automation** that violates event app ToS
- **Deterministic ROI math** — no AI for arithmetic
- **Every ticket is atomic** + committable with tests/validation
- **Every sprint ends with a demoable increment**
- **No hallucinated claims** — only allowlisted proof points

## Core Messaging Framework (Embedded in All Prompts/Templates)
**ROI in 4 Tiers:**
1. Baseline paper savings (~$0.50/pallet)
2. Hard/soft costs (FTEs, detention @ $150/incident, shipper-of-choice)
3. Volume benefits (Primo Brands: $1M+ contribution margin across 25→260 facilities)
4. Network effects (value increases with facility count)

**Network Effects Value Sources:**
- Standard data model → historical reporting + benchmarking
- Standard support → fewer FTEs per facility/system
- Standard yard protocols → drivers learn one flow → reduced check-in/dock/checkout

**Quant Themes:**
- Carrier benchmarking: bottom quartile wastes ~5 min/shipment
- Avoidable fines: late pickup fees ($500/shipment) in ~2% of shipments
- Predictive intelligence: scenario modeling reduces surge pricing

---

## Completed Sprints Summary

| Sprint | Goal | Status |
|--------|------|--------|
| Sprint 0-9 | Foundation, UI Shell, Prospect List, Templates, Stats, AI Brain | ✅ Complete |
| Sprint 10 | AI Memory & Context (ConversationManager, SystemPromptBuilder) | ✅ Complete |
| Sprint 11 | Dynamic Template Generation (AI-powered templates) | ✅ Complete |
| Sprint 12 | Testing Infrastructure (Vitest, 40 unit tests) | ✅ Complete |
| Sprint 13 | Accessibility (ARIA, keyboard nav, reduced motion, skip links) | ✅ Complete |
| Sprint 14 | Mobile Responsiveness (hamburger menu, touch targets) | ✅ Complete |
| Sprint 15 | Data Export (JSON/CSV export in Settings) | ✅ Complete |
| Sprint 17 | Activity Feed (ActivityTracker, collaboration feed) | ✅ Complete |

---

## Future Sprints Priority Matrix

| Sprint | Goal | Impact | Effort | Demoable Outcome |
|--------|------|--------|--------|------------------|
| Sprint 18 | ROI Module Foundation | Critical | Medium | ROI tab with calculators + export |
| Sprint 19 | Asset Generator + Email Foundation | Critical | High | AI-generated briefs, DMs, sequences |
| Sprint 20 | Marketing Module Core | Critical | Medium | CSV import, segmentation, HubSpot export |
| Sprint 21 | Message Quality System | High | Medium | Lint engine, persona switching |
| Sprint 22 | Email Sequences + Campaigns | High | Medium | Sequence builder, approval workflow |
| Sprint 23 | Social Channel Integration | Medium | Medium | Platform-optimized DMs, tracking |
| Sprint 24 | Multi-tenant Foundation | Medium | Low | Feature flags, workspace config |
| Sprint 25 | E2E Testing + Performance | Medium | High | Playwright tests, bundle optimization |

**Recommended Order:** 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25

**Sprint Dependency Graph:**
```
Sprint 18: ROI Module
    │
    ├──► Sprint 19: Asset Generator (uses ROI outputs)
    │         │
    │         ├──► Sprint 20: Marketing Module (uses generated assets)
    │         │         │
    │         │         └──► Sprint 22: Email Sequences (sequences need campaigns)
    │         │
    │         └──► Sprint 21: Message Quality (lints generated content)
    │
    └──► Sprint 23: Social Channels (uses ROI DM lines)

Sprint 24: Multi-tenant (independent, can run parallel)
Sprint 25: E2E Testing (requires all features complete)
```

---

## Enriched Data Assets (Already in Repo)

The following CSV files contain the enriched hitlist data:

| File | Records | Key Fields |
|------|---------|------------|
| `YardFlow_Manifest2026_Hitlist_v3.xlsx - People Hitlist (1).csv` | 5,408 | Name, Category, Job Title, Company, Country, Qualified, Revenue, PersonScore, is_ops, is_exec, is_exec_ops, is_proc, is_sales |
| `YardFlow_Manifest2026_Hitlist_v3.xlsx - Company Hitlist (2).csv` | 2,652 | Company, attendees, exec_ops_count, ops_count, proc_count, sales_count, tech_count, max_revenue, non_ops, ops_share, vendor_penalty, mega_boost, Score, Tier, Recommended Targets, TopTitles |
| `Manifest Contacts 2026 from App  (1).xlsx - Speakers (Enriched).csv` | 220 | Full Name, Job Title, Company, Domain, First/Last Name, **Email**, Person LinkedIn URL, City, State, Country, # Employees, Annual Revenue, Total Funding, Company LinkedIn URL |

**Data Relationship:**
- People ↔ Companies: Join on `Company` field
- Speakers (Enriched) has **email addresses** and **LinkedIn URLs** for 220 high-value contacts
- Company data includes scoring (Score, Tier) and persona composition (exec_ops_count, proc_count, etc.)

---

## Sprint 18: ROI Module Foundation
**Goal:** Add deterministic ROI calculators with per-prospect/company inputs, live calculation display, and exportable outputs.
**Demo:** Select prospect → open ROI tab → inputs auto-populate from company data → see Quick Win + Network Effects outputs → export JSON → copy "ROI DM line" (≤120 chars)
**Dependencies:** None

### Task Dependency Graph
```
T18.0 (formula spec) ─── T18.1 (schemas) ─┬── T18.2 (quick win calc)
                                          └── T18.3 (network calc)
T18.4a (storage hook) ─── T18.4b (prefill service) ─── T18.5 (UI)
T18.6 (exporter) ─── T18.7 (DM line generator)
T18.8 (comparison view) - independent polish
T18.9 (input validation) - runs last
```

### Tasks

#### T18.0: ROI Formula Specification [Design Doc - S]
- **Goal:** Document all ROI formulas with variables, units, and example calculations before implementation.
- **Description:** Create specification document with stakeholder-approved formulas.
- **Acceptance Criteria:**
  - Document exists at `src/config/roiFormulas.md`
  - Quick Win formula defined with all variables
  - Network Effects formula defined with all variables
  - 3+ example calculations with known inputs/outputs
  - Stakeholder sign-off documented
- **Validation:** Manual review + approval comment in PR

**ROI Formulas (to be documented):**
```
Quick Win Calculator:
- Paper Savings = pallets_per_month × $0.50
- Labor Savings = shipments_per_month × avg_delay_minutes × (hourly_rate / 60)
- Detention Savings = shipments_per_month × detention_rate × avg_detention_cost
- Total Annual = (Paper + Labor + Detention) × 12

Network Effects Calculator:
- Marginal Value = base_value × (1 + ln(facility_count) / 10)
- Carrier Benchmark Savings = slow_driver_pct × avg_delay × shipments × (hourly_rate / 60)
- Avoidable Fines = shipments × late_pickup_rate × avg_fine
- Total Network Value = Marginal + Benchmark + Fines
```

#### T18.1: ROI Type Definitions + Zod Schemas [S - 2h]
- **Goal:** Create typed interfaces and runtime validation for all ROI inputs/outputs.
- **Description:** Define Zod schemas for type safety and runtime validation.
- **Acceptance Criteria:**
  - Create `src/types/roi.ts` with:
    - `ROIQuickWinInputSchema` (pallets, shipments, delays, rates)
    - `ROIQuickWinOutputSchema` (paper, labor, detention, total, annual)
    - `NetworkUpliftInputSchema` (facilities, base_value, carrier metrics)
    - `NetworkUpliftOutputSchema` (marginal, benchmark, fines, total)
  - All fields have descriptions and reasonable bounds
  - Export TypeScript types derived from schemas
- **Tests:**
  - Unit test: valid inputs pass schema validation
  - Unit test: out-of-range inputs fail with descriptive errors
  - Unit test: optional fields handled correctly
- **Validation:** `npm test` passes, types used in subsequent tasks

#### T18.2: Quick Win Calculator Service [M - 3h]
- **Goal:** Deterministic calculator for paper/labor/detention savings.
- **Description:** Pure function with no external dependencies, fully testable.
- **Acceptance Criteria:**
  - Create `src/services/ROICalculator.ts`
  - Function: `calculateQuickWin(input: ROIQuickWinInput): ROIQuickWinOutput`
  - Formulas match T18.0 specification exactly
  - Handles edge cases: zero inputs, null optionals, max bounds
  - Returns breakdown + total + annual projection
- **Tests:**
  - Unit test: 5+ fixtures with known inputs/outputs from T18.0
  - Unit test: zero inputs return zero savings (not NaN)
  - Unit test: boundary values (max shipments, max delay)
- **Validation:** All unit tests pass

#### T18.3: Network Effects Calculator Service [M - 3h]
- **Goal:** Deterministic calculator for multi-facility adoption value.
- **Description:** Implements network effects math with carrier benchmarking.
- **Acceptance Criteria:**
  - Add to `src/services/ROICalculator.ts`
  - Function: `calculateNetworkEffects(input: NetworkUpliftInput): NetworkUpliftOutput`
  - Implements logarithmic marginal value curve
  - Carrier benchmarking: bottom quartile identification
  - Avoidable fines calculation
  - Formulas match T18.0 specification exactly
- **Tests:**
  - Unit test: marginal value increases with ln(facilities)
  - Unit test: 1 facility = base value (no multiplier)
  - Unit test: carrier benchmark savings calculated correctly
  - Unit test: edge cases (0 facilities throws, 100 facilities works)
- **Validation:** All unit tests pass

#### T18.4a: ROI Storage Hook [S - 2h]
- **Goal:** Persist ROI inputs/outputs per prospect with localStorage.
- **Description:** Custom React hook for ROI data CRUD operations.
- **Acceptance Criteria:**
  - Create `src/hooks/useROIData.ts`
  - Hook: `useROIData(prospectId: string)`
  - Returns: `{ inputs, outputs, saveInputs, clearData, lastCalculated }`
  - Persists to localStorage with key `roi_${prospectId}`
  - Automatically recalculates outputs when inputs change
- **Tests:**
  - Unit test: save persists to localStorage
  - Unit test: load retrieves from localStorage
  - Unit test: different prospectIds have separate data
- **Validation:** Manual verification of persistence across refresh

#### T18.4b: ROI Input Prefill Service [S - 2h]
- **Goal:** Auto-populate ROI inputs from prospect/company data.
- **Description:** Map company enrichment data to ROI input fields.
- **Acceptance Criteria:**
  - Create `src/services/ROIPrefillService.ts`
  - Function: `prefillROIInputs(prospect: Prospect, company?: CompanyData): Partial<ROIQuickWinInput>`
  - Mappings:
    - `max_revenue` → estimate shipments (revenue ÷ $50K avg shipment value)
    - `attendees` → estimate facility count
    - `tier` → default assumptions (Tier 1 = larger scale)
  - Returns partial inputs, user can override
- **Tests:**
  - Unit test: Tier 1 company gets larger default values
  - Unit test: missing revenue returns null for that field
  - Unit test: known company data maps correctly
- **Validation:** Visual inspection of prefilled values for sample prospects

#### T18.5: ROI Tab UI Component [L - 5h]
- **Goal:** Interactive ROI calculator UI integrated into prospect detail view.
- **Description:** Form with live calculation and summary display.
- **Acceptance Criteria:**
  - Create `src/components/ROITab.tsx`
  - Add "ROI" tab to prospect detail panel
  - Input form with:
    - Facilities (number, 1-500)
    - Shipments/month (number, 0-1M)
    - Avg dwell time (minutes, 0-480)
    - Detention rate (%, 0-20)
    - Hourly labor rate ($/hr, default $25)
  - Live calculation display (debounced 300ms)
  - Summary cards: Annual Savings, Payback Period, Network Multiplier
  - "Copy ROI DM Line" button
  - "Export JSON" button
- **Tests:**
  - RTL test: form inputs update state
  - RTL test: calculations display updates on input change
  - RTL test: copy button copies to clipboard
- **Validation:** Manual demo with 3 different prospects

#### T18.6: ROI JSON Exporter [S - 2h]
- **Goal:** Export ROI calculation as structured JSON for downstream use.
- **Description:** Generate downloadable JSON blob with schema version.
- **Acceptance Criteria:**
  - Function: `exportROIJson(prospectId, inputs, outputs): Blob`
  - JSON structure:
    ```json
    {
      "schemaVersion": "1.0",
      "exportedAt": "2026-01-28T12:00:00Z",
      "prospectId": "123",
      "prospectName": "Jamie Saucedo",
      "company": "GXO",
      "inputs": { ... },
      "quickWinOutputs": { ... },
      "networkEffectsOutputs": { ... },
      "summaryLine": "GXO: $1.2M annual savings potential"
    }
    ```
  - Download triggers with filename `roi_${company}_${date}.json`
- **Tests:**
  - Unit test: JSON matches schema
  - Unit test: timestamp is valid ISO format
  - Unit test: filename sanitizes company name
- **Validation:** Download and validate JSON in browser

#### T18.7: ROI DM Line Generator [S - 2h]
- **Goal:** Generate ≤120 char message hook from ROI outputs.
- **Description:** Template-based generator for copy-paste into DMs.
- **Acceptance Criteria:**
  - Function: `generateROIDMLine(company, outputs): string`
  - Always ≤120 characters
  - Template options:
    - `"{company} could save ${total}/mo—5 min to see how? ☕"`
    - `"Saw ${detention}% detention savings for {industry} peers—relevant for {company}?"`
  - Auto-selects best template based on which numbers are most impressive
  - Includes copy button with success feedback
- **Tests:**
  - Unit test: output always ≤120 chars
  - Unit test: template selection based on outputs
  - Unit test: handles $0 savings gracefully
- **Validation:** Generate lines for 5 prospects, verify all ≤120 chars

#### T18.8: ROI Comparison View [M - 3h]
- **Goal:** Compare ROI across 2-3 prospects for prioritization.
- **Description:** Side-by-side comparison of ROI calculations.
- **Acceptance Criteria:**
  - Create `src/components/ROIComparison.tsx`
  - Select 2-3 prospects from dropdown
  - Side-by-side cards showing key metrics
  - Highlight "best" values in green
  - "Export Comparison" as combined JSON
- **Tests:**
  - RTL test: comparison renders selected prospects
  - RTL test: highlighting applies to highest values
- **Validation:** Compare 3 Tier 1 prospects

#### T18.9: ROI Input Validation UI [S - 2h]
- **Goal:** User-friendly validation errors for out-of-range inputs.
- **Description:** Real-time validation feedback in form.
- **Acceptance Criteria:**
  - Red border on invalid inputs
  - Error message below field
  - Disable calculate button when invalid
  - Validation messages:
    - "Facilities must be 1-500"
    - "Shipments cannot exceed 1,000,000"
    - "Detention rate must be 0-20%"
- **Tests:**
  - RTL test: error message displays for invalid input
  - RTL test: button disabled when form invalid
- **Validation:** Try invalid inputs, verify feedback

---

## Sprint 19: Asset Generator + Email Foundation
**Goal:** AI-powered asset generation using Gemini API with caching, approved claims only, and email template infrastructure.
**Demo:** Click "Generate Assets" → see 1-page mini-brief + 3 DM variants + 4-step email sequence; refresh page and outputs are cached; configure email from/subject defaults.
**Dependencies:** Sprint 18 (ROI outputs feed into asset generation)

### Task Dependency Graph
```
T19.0 (mock service) ─── T19.1 (API wrapper) ─── T19.3 (prompt builder)
T19.2 (claims registry) ─── T19.3
T19.4 (cache layer) ─── T19.5 (mini-brief) ─┬── T19.9 (assets panel)
                       ─── T19.6 (DM variants) ─┤
T19.7 (email schema) ─── T19.8 (sequence gen) ─┘
T19.10 (email config) - independent
T19.11 (rate limit UI) - depends on T19.1
```

### Tasks

#### T19.0: Gemini Mock Service [S - 2h]
- **Goal:** Enable offline development and reliable CI testing without API calls.
- **Description:** Mock implementation matching real API response structure.
- **Acceptance Criteria:**
  - Create `src/services/__mocks__/GeminiService.ts`
  - Returns realistic mock responses for all asset types
  - Configurable delay to simulate network latency
  - Configurable error injection for error handling tests
  - Jest auto-mocking compatible
- **Tests:**
  - Unit test: mock returns expected structure
  - Unit test: delay works correctly
  - Unit test: error injection triggers correctly
- **Validation:** `npm test` passes without API key

#### T19.1: Gemini API Service Wrapper [M - 4h]
- **Goal:** Centralized Gemini client with retries, token budgets, and error handling.
- **Description:** Production-ready wrapper for Google Gemini API.
- **Acceptance Criteria:**
  - Create `src/services/GeminiService.ts`
  - Function: `generateAssets(prompt: string, context: AssetContext): Promise<GeneratedAssets>`
  - Configuration:
    - Model: `gemini-1.5-flash` (configurable)
    - Max output tokens: 4096
    - Retry: 3x with exponential backoff (1s, 2s, 4s)
  - Error categorization: `rate_limit`, `auth_error`, `content_filter`, `network`
  - Request/response logging for debugging (opt-in)
  - Uses `VITE_GEMINI_API_KEY` environment variable
- **Tests:**
  - Unit test with mock: successful generation returns typed response
  - Unit test: retry logic triggers on 429 status
  - Unit test: auth error detected on 401/403
  - Integration test (skipped in CI): real API call succeeds
- **Validation:** Generate asset with real API key

#### T19.2: Approved Claims Registry [S - 2h]
- **Goal:** Prevent AI hallucination by restricting to curated proof points.
- **Description:** Centralized registry of approved customer claims and statistics.
- **Acceptance Criteria:**
  - Create `src/config/approvedClaims.ts`
  - Structure:
    ```typescript
    interface ApprovedClaim {
      id: string;
      category: 'roi' | 'network-effects' | 'case-study' | 'benchmark';
      claim: string;
      source: string;
      approved: boolean;
      lastVerified: string;
    }
    ```
  - Initial claims:
    - Primo Brands: "$1M+ contribution margin across 25 facilities"
    - Primo Brands: "Rolling to 260 facilities"
    - Benchmark: "Bottom quartile wastes ~5 min/shipment"
    - Benchmark: "Late pickup fees $500/shipment in ~2% of cases"
  - Function: `getApprovedClaims(categories?: string[]): ApprovedClaim[]`
- **Tests:**
  - Unit test: all claims have required fields
  - Unit test: filter by category works
  - Unit test: no unapproved claims returned
- **Validation:** Review claims with stakeholder

#### T19.3: Asset Prompt Builder [M - 4h]
- **Goal:** Compose AI prompts with prospect context, ROI data, and approved claims only.
- **Description:** Template-based prompt assembly with guardrails.
- **Acceptance Criteria:**
  - Create `src/services/AssetPromptBuilder.ts`
  - Function: `buildAssetPrompt(prospect, roiData?, claimCategories?): string`
  - Prompt structure:
    1. System context (YardFlow value prop, writing style)
    2. Prospect context (name, company, title, tier, persona)
    3. ROI data (if available from Sprint 18)
    4. Approved claims only (injected from registry)
    5. Output format instructions (JSON structure)
  - Explicit instruction: "Use ONLY the claims provided. Do not invent statistics."
  - Character budgets per section
- **Tests:**
  - Unit test: prompt includes prospect name/company
  - Unit test: prompt includes only allowlisted claims
  - Unit test: prompt excludes unapproved claims
  - Unit test: ROI data included when provided
- **Validation:** Review generated prompts for correctness

#### T19.4: Asset Cache Layer [M - 4h]
- **Goal:** Avoid repeated token burn by caching generated assets per prospect.
- **Description:** Hash-based caching with TTL and invalidation.
- **Acceptance Criteria:**
  - Create `src/services/AssetCacheService.ts`
  - Cache key: `sha256(prospectId + promptHash)`
  - Storage: localStorage with IndexedDB fallback for large assets
  - TTL: 7 days (configurable)
  - Max cache size: 50MB with LRU eviction
  - Invalidation triggers:
    - Prospect data changes
    - "Regenerate" button click
    - Manual clear in settings
  - Functions: `getCached(key)`, `setCache(key, value)`, `invalidate(prospectId)`, `clearAll()`
- **Tests:**
  - Unit test: cache hit returns stored value
  - Unit test: cache miss returns null
  - Unit test: TTL expiry works
  - Unit test: LRU eviction when over limit
  - Unit test: invalidate removes specific prospect
- **Validation:** Generate, refresh, verify cache hit in DevTools

#### T19.5: Mini-Brief Generator [M - 4h]
- **Goal:** Generate 1-page prospect-specific ROI summary.
- **Description:** AI-generated executive brief with structured sections.
- **Acceptance Criteria:**
  - Function: `generateMiniBrief(prospect, roiData?): Promise<MiniBrief>`
  - Output structure:
    ```typescript
    interface MiniBrief {
      hook: string;           // 1-2 sentences, attention grabber
      painPoints: string[];   // 3 bullet points, prospect-specific
      valueProps: string[];   // 3 bullet points, mapped to pain
      roiSnapshot: string;    // ROI numbers if available
      cta: string;            // Call to action
    }
    ```
  - ~500 words total
  - Uses approved claims only
  - Caches result
- **Tests:**
  - Unit test with mock: returns valid MiniBrief structure
  - Unit test: uses cache on second call
  - Integration test: generated content is reasonable length
- **Validation:** Generate for 3 Tier 1 prospects, review quality

#### T19.6: DM Variants Generator [M - 3h]
- **Goal:** Generate 3 persona-aware DM variants, each ≤250 chars.
- **Description:** Short message variants for different angles.
- **Acceptance Criteria:**
  - Function: `generateDMVariants(prospect): Promise<DMVariant[]>`
  - 3 variants:
    1. **Exec variant**: Strategic, ROI-focused, peer validation
    2. **Ops variant**: Tactical, specific metrics, process improvement
    3. **Challenger variant**: Provocative question, status quo challenge
  - Each ≤250 characters (hard enforced)
  - Includes ROI hook from Sprint 18 if available
  - Validation: reject and regenerate if >250 chars
- **Tests:**
  - Unit test: all variants ≤250 chars
  - Unit test: 3 variants returned
  - Unit test: variants are distinct (not copies)
  - Unit test: regenerate if initial generation >250
- **Validation:** Generate for 5 prospects, verify char counts

#### T19.7: Email Template Schema + Editor [M - 4h]
- **Goal:** Define email template structure and basic editing UI.
- **Description:** Foundation for email sequences.
- **Acceptance Criteria:**
  - Create `src/types/email.ts`:
    ```typescript
    interface EmailTemplate {
      id: string;
      name: string;
      subject: string;
      body: string;
      variables: string[];  // ['firstName', 'company', 'roiSavings']
      persona: 'exec' | 'ops' | 'proc' | 'all';
      sequencePosition: number;
    }
    ```
  - Variable syntax: `{{variableName}}`
  - Function: `interpolateEmail(template, prospect, data): string`
  - Basic rich text editor for body (markdown support)
- **Tests:**
  - Unit test: variable interpolation works
  - Unit test: missing variable shows placeholder
  - Unit test: schema validation catches invalid templates
- **Validation:** Create template, preview interpolated

#### T19.8: Follow-up Sequence Generator [M - 4h]
- **Goal:** Generate 4-step email sequence with timing.
- **Description:** AI-generated email sequence building on initial contact.
- **Acceptance Criteria:**
  - Function: `generateEmailSequence(prospect, dmVariant?): Promise<EmailSequence>`
  - Sequence structure:
    ```typescript
    interface EmailSequence {
      steps: {
        position: number;
        delayDays: number;  // Days after previous step
        subject: string;
        body: string;
        persona: string;
      }[];
    }
    ```
  - Default timing: Day 0 (DM) → Day 2 (Email 1) → Day 5 (Email 2) → Day 10 (Email 3)
  - Each email builds on previous (not repetitive)
  - Subject lines ≤60 chars
  - Body ≤500 words
- **Tests:**
  - Unit test: 4 steps generated
  - Unit test: timing is sequential
  - Unit test: subject lines ≤60 chars
  - Unit test: bodies reference previous touchpoints
- **Validation:** Generate for Tier 1 exec, review sequence quality

#### T19.9: Assets Panel UI [L - 5h]
- **Goal:** Display all generated assets with copy buttons and regenerate.
- **Description:** Unified view of mini-brief, DMs, and emails.
- **Acceptance Criteria:**
  - Create `src/components/AssetsPanel.tsx`
  - Add "Assets" tab to prospect detail panel
  - Tabs: Brief | DMs | Emails
  - "Generate All" button (if nothing cached)
  - "Regenerate" button per section
  - Copy buttons with toast confirmation
  - Loading states with skeletons
  - Error states with retry
  - Show "Using cached from {date}" indicator
- **Tests:**
  - RTL test: tabs switch content
  - RTL test: copy button triggers clipboard + toast
  - RTL test: loading state shows skeleton
  - RTL test: error state shows retry button
- **Validation:** Full demo of generate → copy → regenerate flow

#### T19.10: Email Config Settings [S - 2h]
- **Goal:** Configure email sender defaults for compliance.
- **Description:** Settings for email metadata.
- **Acceptance Criteria:**
  - Add to Settings modal:
    - From Name (text, default "Jake at YardFlow")
    - Reply-To Email (email format validation)
    - Unsubscribe Text (text, default "Reply STOP to unsubscribe")
    - Compliance Footer (textarea, default company info)
  - Persist in localStorage
  - Applied to all generated emails
- **Tests:**
  - Unit test: settings persist across refresh
  - Unit test: email validation works
  - Unit test: settings applied to generated emails
- **Validation:** Change settings, verify in generated emails

#### T19.11: Rate Limit UI Feedback [S - 2h]
- **Goal:** User-friendly feedback when hitting Gemini API limits.
- **Description:** Graceful degradation with retry countdown.
- **Acceptance Criteria:**
  - Detect rate limit (429) from API wrapper
  - Show toast: "Rate limit reached. Retry in {seconds}s"
  - Countdown timer
  - "Retry Now" button (enabled after countdown)
  - "Use Cached" option if available
  - Log rate limit events for monitoring
- **Tests:**
  - Unit test: rate limit detected from 429
  - Unit test: countdown decrements
  - Unit test: retry enabled after countdown
- **Validation:** Trigger rate limit (rapid requests), verify UI

---

## Sprint 20: Marketing Module Core
**Goal:** Import enriched hitlists, segment by persona/tier/score, generate campaigns, export to HubSpot.
**Demo:** Load existing CSV hitlists → filter to Tier 1 exec_ops → select segment → apply sequence → export HubSpot-ready CSV with 5,000+ contacts.
**Dependencies:** Sprint 19 (generated assets used in campaigns)

### Existing Enriched Data (in repo)
- **People Hitlist:** 5,408 contacts with persona flags (is_ops, is_exec, is_proc, is_sales), scores, tiers
- **Company Hitlist:** 2,652 companies with scoring, recommended targets, attendee composition
- **Speakers Enriched:** 220 high-value contacts with **emails** and **LinkedIn URLs**

### Task Dependency Graph
```
T20.1 (types) ─── T20.2 (parser) ─── T20.3 (mapper) ─── T20.4 (pipeline)
T20.5 (filter service) ─── T20.6 (filter UI) ─── T20.7 (campaign builder)
T20.8a (HubSpot spec) ─── T20.8b (exporter)
T20.9 (import history) - independent
T20.10 (duplicate detection) - depends on T20.4
```

### Tasks

#### T20.1: Enriched Data Type Definitions [S - 2h]
- **Goal:** Define TypeScript types matching the CSV structures.
- **Description:** Types for all hitlist fields.
- **Acceptance Criteria:**
  - Update `src/types/index.ts` with:
    ```typescript
    interface EnrichedPerson {
      name: string;
      category: 'Speaker' | 'Attendee' | 'Sponsor';
      jobTitle: string;
      company: string;
      country?: string;
      qualified?: boolean;
      revenue?: string;
      personScore: number;
      isOps: boolean;
      isExec: boolean;
      isExecOps: boolean;
      isProc: boolean;
      isSales: boolean;
      // From Speakers Enriched (when available)
      email?: string;
      linkedinUrl?: string;
      employeeCount?: number;
      annualRevenue?: string;
    }
    
    interface EnrichedCompany {
      company: string;
      attendees: number;
      execOpsCount: number;
      opsCount: number;
      procCount: number;
      salesCount: number;
      techCount: number;
      maxRevenue?: number;
      nonOps: number;
      opsShare: number;
      vendorPenalty: number;
      megaBoost: number;
      score: number;
      tier: 'Tier 1' | 'Tier 2' | 'Tier 3';
      recommendedTargets: string;
      topTitles: string;
    }
    ```
  - Zod schemas for runtime validation
- **Tests:**
  - Unit test: sample CSV row parses to type
  - Unit test: invalid data fails validation
- **Validation:** Types match actual CSV headers

#### T20.2: CSV Parser Service [M - 3h]
- **Goal:** Robust CSV parsing with error handling.
- **Description:** Papa Parse wrapper with validation.
- **Acceptance Criteria:**
  - Create `src/services/CsvParserService.ts`
  - Uses Papa Parse for parsing
  - Returns: `{ data: T[], errors: ParseError[], warnings: string[] }`
  - Handles: BOM, encoding (UTF-8, Latin-1), quoted fields, embedded commas
  - Reports: row number + field for each error
  - Preview mode: parse first N rows only
- **Tests:**
  - Unit test: simple CSV parses correctly
  - Unit test: quoted fields with commas work
  - Unit test: malformed row reported with line number
  - Unit test: BOM stripped correctly
- **Validation:** Parse provided hitlist CSVs successfully

#### T20.3: Column Mapper Service [M - 3h]
- **Goal:** Map CSV columns to typed fields with auto-detection.
- **Description:** Fuzzy matching for common column names.
- **Acceptance Criteria:**
  - Create `src/services/ColumnMapperService.ts`
  - Function: `autoDetectMapping(headers: string[]): ColumnMapping`
  - Auto-detect mappings:
    - "Name" / "Full Name" → name
    - "Job Title" / "Title" → jobTitle
    - "Company" / "Company Name" → company
    - "PersonScore" / "Score" → personScore
    - Boolean columns (TRUE/FALSE) → boolean type
  - Confidence score for each mapping (0-1)
  - Manual override UI support
  - Remember mappings for repeat imports (localStorage)
- **Tests:**
  - Unit test: "Job Title" maps to jobTitle
  - Unit test: "is_ops" (TRUE/FALSE) maps to boolean
  - Unit test: unknown column flagged for manual mapping
- **Validation:** Auto-map provided CSVs with >90% accuracy

#### T20.4: Import Pipeline [L - 5h]
- **Goal:** End-to-end import flow with merge logic.
- **Description:** Parse → validate → map → merge with existing → store.
- **Acceptance Criteria:**
  - Create `src/services/ImportPipelineService.ts`
  - Pipeline stages: parse → validate → map → dedupe → merge → store
  - Merge strategy:
    - Match on: name + company (case-insensitive)
    - Conflict resolution: incoming data wins, preserve user notes
    - Track: imported vs updated vs skipped counts
  - Store in app state + localStorage
  - Progress callback for large files
  - Rollback capability (see T20.9)
- **Tests:**
  - Unit test: new record imported
  - Unit test: existing record updated (not duplicated)
  - Unit test: merge preserves user notes
  - Unit test: progress callback fires
- **Validation:** Import 5,408 people, verify count matches

#### T20.5: Segmentation Filter Service [M - 4h]
- **Goal:** Composable filters for prospect segmentation.
- **Description:** Filter predicates that combine with AND logic.
- **Acceptance Criteria:**
  - Create `src/services/SegmentationService.ts`
  - Filter types:
    - `tier`: ['Tier 1', 'Tier 2', 'Tier 3']
    - `persona`: ['exec', 'ops', 'proc', 'sales'] (multi-select)
    - `category`: ['Speaker', 'Attendee', 'Sponsor']
    - `scoreRange`: { min: number, max: number }
    - `hasEmail`: boolean
    - `qualified`: boolean
    - `search`: string (fuzzy match on name/company/title)
  - Function: `applyFilters(prospects, filters): EnrichedPerson[]`
  - Performance: <100ms for 10K records
- **Tests:**
  - Unit test: tier filter works
  - Unit test: multiple persona filters combine correctly
  - Unit test: score range inclusive
  - Unit test: search matches name/company/title
  - Performance test: <100ms for 10K records
- **Validation:** Filter to "Tier 1 + exec_ops + has email" → expect ~50 results

#### T20.6: Segmentation UI [M - 4h]
- **Goal:** Interactive filter bar with saved segments.
- **Description:** Filter controls with real-time results.
- **Acceptance Criteria:**
  - Create `src/components/SegmentationBar.tsx`
  - Filter chips: Tier, Persona, Category, Score, Email, Qualified
  - Multi-select dropdowns for Tier/Persona
  - Range slider for Score
  - Search input with debounce (300ms)
  - Result count: "Showing 47 of 5,408"
  - "Clear All" button
  - "Save Segment" → name + store filters
  - "Load Segment" dropdown
- **Tests:**
  - RTL test: filter changes update results
  - RTL test: saved segment loads correctly
  - RTL test: clear all resets filters
- **Validation:** Demo filtering from 5K → 50 prospects

#### T20.7: Campaign Builder Core [M - 4h]
- **Goal:** Assign sequences to segmented prospects.
- **Description:** Bulk sequence assignment with preview.
- **Acceptance Criteria:**
  - Create `src/components/CampaignBuilder.tsx`
  - Steps:
    1. Select segment (or use current filters)
    2. Choose sequence template (from Sprint 19)
    3. Preview personalization for sample prospect
    4. Confirm: "Apply sequence to 47 prospects"
  - Bulk update: `sequenceAssigned: true`, `sequenceId: string`
  - Track: assignment timestamp, sequence version
- **Tests:**
  - RTL test: sequence selection works
  - RTL test: preview shows interpolated content
  - RTL test: confirm updates all selected
- **Validation:** Apply sequence to Tier 1 segment

#### T20.8a: HubSpot Schema Specification [Design Doc - S]
- **Goal:** Document exact HubSpot CSV format requirements.
- **Description:** Mapping from internal types to HubSpot properties.
- **Acceptance Criteria:**
  - Document at `src/config/hubspotSchema.md`
  - Required columns:
    - `Email` (required for import)
    - `First Name`, `Last Name`
    - `Company`
    - `Job Title`
    - `hs_lead_status` (HubSpot property)
  - Custom properties:
    - `yf_tier`, `yf_persona`, `yf_score`
    - `yf_sequence_1`, `yf_sequence_2`, etc.
  - UTF-8 with BOM for Excel compatibility
- **Validation:** Manual review + HubSpot import dry-run

#### T20.8b: HubSpot CSV Exporter [M - 4h]
- **Goal:** Export segment with sequences to HubSpot-ready CSV.
- **Description:** Generate importable CSV file.
- **Acceptance Criteria:**
  - Create `src/services/HubSpotExporter.ts`
  - Function: `exportToHubSpot(prospects, sequences): Blob`
  - Columns per T20.8a specification
  - Split name into first/last (intelligent split)
  - Include sequence steps as separate columns
  - UTF-8 with BOM
  - Filename: `hubspot_export_${segment}_${date}.csv`
  - Validation: reject if no email addresses
- **Tests:**
  - Unit test: CSV columns match spec
  - Unit test: name splitting works ("Jamie Saucedo" → "Jamie", "Saucedo")
  - Unit test: BOM present
  - Unit test: reject if all emails missing
- **Validation:** Import exported CSV into HubSpot sandbox

#### T20.9: Import History + Rollback [M - 3h]
- **Goal:** Track imports with rollback capability.
- **Description:** Audit log for data changes.
- **Acceptance Criteria:**
  - Create `src/services/ImportHistoryService.ts`
  - Log per import:
    - Timestamp, filename, row count
    - Added/updated/skipped counts
    - Snapshot of previous state (for rollback)
  - Keep last 5 imports
  - Rollback: restore to pre-import state
  - UI: view history in Settings
- **Tests:**
  - Unit test: import logged correctly
  - Unit test: rollback restores previous state
  - Unit test: old imports purged after 5
- **Validation:** Import, rollback, verify restoration

#### T20.10: Duplicate Detection [M - 3h]
- **Goal:** Flag potential duplicates on import.
- **Description:** Fuzzy matching to identify duplicates.
- **Acceptance Criteria:**
  - Detection rules:
    - Exact email match → high confidence
    - Name + company exact → high confidence
    - Name fuzzy (>85% Levenshtein) + company exact → medium
  - UI: show duplicate candidates before merge
  - Actions: merge, skip, keep both
  - Bulk resolution for large imports
- **Tests:**
  - Unit test: exact email match detected
  - Unit test: fuzzy name match at threshold
  - Unit test: different company = not duplicate
- **Validation:** Import file with known duplicates

---

## Sprint 21: Message Quality System
**Goal:** Lint engine that catches weak copy, enforces character limits, and routes templates by persona.
**Demo:** Type weak DM → lint highlights "learn more" → suggests replacement → persona toggle changes template → all DMs pass ≤250 chars.
**Dependencies:** Sprint 19 (lints generated content), Sprint 20 (applies to campaign builder)

### Task Dependency Graph
```
T21.1 (char counter) ─── T21.5 (lint UI)
T21.2 (banned phrases) ─── T21.3 (lint engine) ─── T21.4 (suggestions) ─── T21.5
T21.6 (persona types) ─── T21.7 (router) ─── T21.8 (switcher UI)
T21.9 (message history) - independent
T21.10 (compliance) - depends on T21.3
```

### Tasks

#### T21.1: Character Counter Utility [S - 2h]
- **Goal:** Accurate character counting matching event app behavior.
- **Description:** Shared utility for consistent counting.
- **Acceptance Criteria:**
  - Create `src/utils/characterCounter.ts`
  - Function: `countCharacters(text: string): CharacterCount`
  - Output: `{ total: number, remaining: number, isOver: boolean, overBy: number }`
  - Counting rules:
    - Newlines = 1 character
    - Emojis = varies (use grapheme splitter)
    - Spaces count
  - Configurable limit (default 250)
- **Tests:**
  - Unit test: "Hello" = 5
  - Unit test: "Hello\nWorld" = 11
  - Unit test: emoji "👋" = correct count
  - Unit test: 251 chars → isOver: true, overBy: 1
- **Validation:** Compare counts with actual Manifest app

#### T21.2: Banned Phrases Registry [S - 2h]
- **Goal:** Configurable list of weak/banned phrases.
- **Description:** Phrases that make messages generic.
- **Acceptance Criteria:**
  - Create `src/config/bannedPhrases.ts`
  - Structure:
    ```typescript
    interface BannedPhrase {
      phrase: string;
      reason: string;
      severity: 'error' | 'warning';
      suggestion?: string;
    }
    ```
  - Initial list:
    - "learn more" → "see the ROI breakdown"
    - "current landscape" → specific metric
    - "touch base" → "discuss the 5-min savings model"
    - "reaching out" → specific reason
    - "synergy" → specific outcome
  - Case-insensitive matching
  - Configurable (can add/remove in settings)
- **Tests:**
  - Unit test: all phrases have required fields
  - Unit test: case-insensitive match works
  - Unit test: severity levels correct
- **Validation:** Review list with stakeholder

#### T21.3: Message Lint Engine [M - 4h]
- **Goal:** Detect issues and require quality hooks.
- **Description:** Rule-based message analysis.
- **Acceptance Criteria:**
  - Create `src/services/MessageLintService.ts`
  - Function: `lintMessage(text, options): LintResult`
  - Rules:
    1. Character limit (≤250 for DM, ≤60 for subject)
    2. Banned phrases detected
    3. Must have ≥1 "hook" (quant number OR operational specific)
    4. Must have CTA (question or meeting request)
    5. No ALL CAPS words (except acronyms)
    6. No excessive punctuation (!!!, ???)
  - Output:
    ```typescript
    interface LintResult {
      isValid: boolean;
      errors: LintIssue[];
      warnings: LintIssue[];
      score: number;  // 0-100
    }
    ```
- **Tests:**
  - Unit test: banned phrase detected
  - Unit test: missing hook flagged
  - Unit test: valid message passes
  - Unit test: score reflects issue count
- **Validation:** Lint 10 sample messages, verify results

#### T21.4: Lint Suggestions Service [M - 3h]
- **Goal:** Provide actionable replacements for issues.
- **Description:** Rule-based or AI-powered suggestions.
- **Acceptance Criteria:**
  - Create `src/services/LintSuggestionService.ts`
  - Function: `getSuggestions(issue: LintIssue, context): string[]`
  - Suggestion sources:
    1. Static replacements from banned phrases registry
    2. Context-aware templates (inject prospect data)
    3. AI-powered (optional, if no static suggestion)
  - Max 3 suggestions per issue
  - One-click apply suggestion
- **Tests:**
  - Unit test: static suggestion returned for known phrase
  - Unit test: context variables interpolated
  - Unit test: max 3 suggestions
- **Validation:** Get suggestions for common issues

#### T21.5: Lint UI Integration [M - 4h]
- **Goal:** Real-time lint display in message editor.
- **Description:** Inline error highlighting and suggestions.
- **Acceptance Criteria:**
  - Update message editor component
  - Underline banned phrases (wavy red for errors, orange for warnings)
  - Sidebar panel: list of issues with suggestions
  - Character counter: green → orange (>200) → red (>250)
  - "Lint Score" badge (0-100)
  - "Fix All" button for auto-fixable issues
  - Debounced linting (300ms)
- **Tests:**
  - RTL test: banned phrase underlined
  - RTL test: suggestion click replaces text
  - RTL test: character counter color changes
- **Validation:** Type weak message, observe lint feedback

#### T21.6: Persona Types + Config [S - 2h]
- **Goal:** Define persona taxonomy with messaging characteristics.
- **Description:** Persona definitions for template routing.
- **Acceptance Criteria:**
  - Create `src/config/personas.ts`
  - Personas:
    ```typescript
    interface Persona {
      id: 'exec' | 'ops' | 'proc';
      name: string;
      description: string;
      toneKeywords: string[];
      painPoints: string[];
      valueProps: string[];
      dmMaxLength: number;
    }
    ```
  - Exec: strategic, ROI-focused, peer validation, ≤200 chars
  - Ops: tactical, specific metrics, process improvement, ≤250 chars
  - Proc: cost-focused, compliance, vendor consolidation, ≤250 chars
- **Tests:**
  - Unit test: all personas have required fields
  - Unit test: persona lookup by id works
- **Validation:** Review personas with stakeholder

#### T21.7: Persona Template Router [M - 3h]
- **Goal:** Select templates based on persona.
- **Description:** Template selection logic.
- **Acceptance Criteria:**
  - Create `src/services/PersonaRouterService.ts`
  - Function: `getTemplatesForPersona(persona, templateType): Template[]`
  - Template tagging: each template has `persona` field
  - Fallback: if no persona-specific template, use 'all'
  - Sorting: persona-specific first, then relevance
- **Tests:**
  - Unit test: exec persona gets exec templates
  - Unit test: fallback to 'all' templates
  - Unit test: sorting is correct
- **Validation:** Switch personas, verify template changes

#### T21.8: Persona Switcher UI [M - 3h]
- **Goal:** Toggle persona in message editor.
- **Description:** Persona selection affects templates and talking points.
- **Acceptance Criteria:**
  - Add persona toggle to message editor (horizontal pills)
  - Icons: Briefcase (Exec), Settings (Ops), DollarSign (Proc)
  - Selection updates:
    - Available templates
    - Talking points sidebar
    - Character limit display
  - Persist per prospect
  - Auto-detect from prospect data (isExec, isOps, isProc)
- **Tests:**
  - RTL test: persona toggle changes templates
  - RTL test: auto-detect sets correct default
  - RTL test: persistence across navigation
- **Validation:** Switch personas, observe template changes

#### T21.9: Message History [M - 3h]
- **Goal:** Track all messages generated/sent per prospect.
- **Description:** Audit trail for team handoffs.
- **Acceptance Criteria:**
  - Create `src/services/MessageHistoryService.ts`
  - Log per message:
    - Timestamp, author, message text, template used
    - Lint score, persona, channel
    - Status: drafted, sent, responded
  - View history in prospect detail
  - Export history as CSV
- **Tests:**
  - Unit test: message logged correctly
  - Unit test: history retrieved by prospect
  - Unit test: export generates valid CSV
- **Validation:** Generate messages, view history

#### T21.10: Compliance Checker [S - 2h]
- **Goal:** Flag messages missing required elements.
- **Description:** Compliance rules for email legality.
- **Acceptance Criteria:**
  - Add to lint engine:
    - Email must have unsubscribe mention
    - Email must have sender identification
    - No misleading subject lines
  - Severity: error (blocks send)
  - Auto-add compliance footer option
- **Tests:**
  - Unit test: missing unsubscribe flagged
  - Unit test: compliance footer added
- **Validation:** Lint email without compliance, verify error

---

## Sprint 22: Email Sequences + Campaign Automation
**Goal:** Sequence builder with approval workflow, bulk application, and status tracking.
**Demo:** Create sequence → preview for prospect → submit for approval → approve → apply to segment → track status.
**Dependencies:** Sprint 20 (segments), Sprint 21 (lint validation)

### Task Dependency Graph
```
T22.1 (sequence schema) ─── T22.2 (builder UI) ─── T22.3 (preview)
T22.4 (approval workflow) ─── T22.5 (approval UI)
T22.6 (storage) ─── T22.7 (bulk apply)
T22.8 (status tracking) ─── T22.9 (analytics)
T22.10 (templates) - independent
```

### Tasks

#### T22.1: Sequence Schema + Validation [S - 2h]
- **Goal:** Define sequence data structure with validation.
- **Description:** Multi-step sequence with timing.
- **Acceptance Criteria:**
  - Create `src/types/sequence.ts`:
    ```typescript
    interface Sequence {
      id: string;
      name: string;
      description: string;
      steps: SequenceStep[];
      persona: 'exec' | 'ops' | 'proc' | 'all';
      status: 'draft' | 'pending' | 'approved' | 'active';
      createdAt: number;
      updatedAt: number;
      approvedBy?: string;
    }
    
    interface SequenceStep {
      position: number;
      channel: 'dm' | 'email' | 'linkedin';
      delayDays: number;
      subject?: string;
      body: string;
      variables: string[];
    }
    ```
  - Zod validation
  - Max 6 steps per sequence
- **Tests:**
  - Unit test: valid sequence passes
  - Unit test: >6 steps rejected
  - Unit test: missing required fields rejected
- **Validation:** Create sequence, verify validation

#### T22.2: Sequence Builder UI [L - 5h]
- **Goal:** Visual sequence editor.
- **Description:** Drag-and-drop step builder.
- **Acceptance Criteria:**
  - Create `src/components/SequenceBuilder.tsx`
  - Add step: select channel, set delay, write content
  - Reorder steps via drag-and-drop
  - Delete step with confirmation
  - Timeline visualization (vertical)
  - Per-step lint validation (green/red indicator)
  - Variable insertion picker
  - Save as draft
- **Tests:**
  - RTL test: add step works
  - RTL test: reorder updates positions
  - RTL test: lint indicator shows status
- **Validation:** Build 4-step sequence

#### T22.3: Sequence Preview Component [M - 4h]
- **Goal:** Preview sequence with prospect data interpolated.
- **Description:** See exactly what prospect receives.
- **Acceptance Criteria:**
  - Create `src/components/SequencePreview.tsx`
  - Select prospect from dropdown
  - Show each step with:
    - Interpolated content
    - Scheduled date (based on today + delays)
    - Character count
    - Lint status
  - "Previous" / "Next" step navigation
  - Print/export preview
- **Tests:**
  - RTL test: variables interpolated correctly
  - RTL test: dates calculated correctly
  - RTL test: navigation works
- **Validation:** Preview for 3 different prospects

#### T22.4: Approval Workflow Service [M - 3h]
- **Goal:** Sequence approval state machine.
- **Description:** Draft → pending → approved → active flow.
- **Acceptance Criteria:**
  - Create `src/services/ApprovalWorkflowService.ts`
  - States: draft, pending_approval, approved, active, paused
  - Transitions:
    - draft → pending_approval (submit)
    - pending_approval → approved (approve)
    - pending_approval → draft (reject with notes)
    - approved → active (activate)
    - active → paused (pause)
  - Track: who, when, notes for each transition
  - Notification hooks (for future integration)
- **Tests:**
  - Unit test: valid transitions work
  - Unit test: invalid transitions rejected
  - Unit test: history tracked
- **Validation:** Walk through full approval flow

#### T22.5: Approval Queue UI [M - 4h]
- **Goal:** Admin view for pending approvals.
- **Description:** Review and approve/reject sequences.
- **Acceptance Criteria:**
  - Create `src/components/ApprovalQueue.tsx`
  - List pending sequences with:
    - Name, creator, submitted date
    - Step count, persona
    - Preview button
  - Approve button → confirmation
  - Reject button → require notes
  - Bulk approve (select multiple)
  - Filter by: persona, creator
- **Tests:**
  - RTL test: approve updates status
  - RTL test: reject requires notes
  - RTL test: bulk approve works
- **Validation:** Submit, approve, verify status

#### T22.6: Sequence Storage Service [M - 3h]
- **Goal:** Persist sequences with version history.
- **Description:** CRUD operations with versioning.
- **Acceptance Criteria:**
  - Create `src/services/SequenceStorageService.ts`
  - Storage: localStorage (IndexedDB for large data)
  - CRUD: create, read, update, delete, list
  - Version history: track last 5 versions per sequence
  - Rollback to previous version
  - Search by name
- **Tests:**
  - Unit test: CRUD operations work
  - Unit test: version history tracked
  - Unit test: rollback restores previous
- **Validation:** Create, edit, rollback sequence

#### T22.7: Bulk Sequence Application [M - 4h]
- **Goal:** Apply sequence to segment of prospects.
- **Description:** Bulk assignment with conflict handling.
- **Acceptance Criteria:**
  - Function: `applySequenceToSegment(sequenceId, prospectIds): ApplyResult`
  - Updates each prospect:
    - `sequenceId`, `sequenceAssignedAt`, `sequenceStatus: 'assigned'`
  - Conflict handling:
    - Already has sequence → prompt: replace, skip, or queue
  - Progress indicator for large batches
  - Summary: applied X, skipped Y, queued Z
- **Tests:**
  - Unit test: prospects updated correctly
  - Unit test: conflicts detected
  - Unit test: progress callback fires
- **Validation:** Apply to 100 prospects

#### T22.8: Sequence Status Tracking [M - 3h]
- **Goal:** Track sequence progress per prospect.
- **Description:** What step is each prospect at?
- **Acceptance Criteria:**
  - Status per prospect:
    - `currentStep`, `stepCompletedAt[]`, `nextStepDue`
  - Status indicators in prospect list:
    - Step 1/4, Step 2/4, Complete
  - "Advance to next step" manual action
  - "Skip step" with reason
  - "Pause sequence" for prospect
- **Tests:**
  - Unit test: status calculated correctly
  - Unit test: advance updates step
  - Unit test: pause stops sequence
- **Validation:** Advance prospect through sequence

#### T22.9: Sequence Analytics [M - 4h]
- **Goal:** Dashboard for sequence performance.
- **Description:** Track: assigned, in-progress, completed, responses.
- **Acceptance Criteria:**
  - Create `src/components/SequenceAnalytics.tsx`
  - Metrics:
    - Total assigned, in-progress, completed
    - Step completion rates (funnel)
    - Response rate (manual entry)
    - Meeting booked rate
  - Per-sequence breakdown
  - Time series: assignments over time
  - Export as CSV
- **Tests:**
  - Unit test: metrics calculated correctly
  - RTL test: charts render
- **Validation:** View analytics with test data

#### T22.10: Sequence Template Library [M - 3h]
- **Goal:** Pre-built sequence templates.
- **Description:** Starting points for common scenarios.
- **Acceptance Criteria:**
  - Create `src/config/sequenceTemplates.ts`
  - Templates:
    1. "Manifest Conference" - 4 steps, exec-focused
    2. "Procurement Cycle" - 3 steps, proc-focused
    3. "Operations Deep Dive" - 4 steps, ops-focused
  - "Use Template" button in builder
  - Customize after applying
- **Tests:**
  - Unit test: templates valid
  - RTL test: template applies to builder
- **Validation:** Create sequence from template

---

## Sprint 23: Social Channel Integration
**Goal:** Platform-specific message optimization, social profile tracking, and engagement logging.
**Demo:** Add LinkedIn/Twitter handles → see profile links → generate platform-optimized DMs → copy for each channel → track what was sent.
**Dependencies:** Sprint 21 (character limits per platform)

### Task Dependency Graph
```
T23.1 (types) ─── T23.2 (editor UI) ─── T23.7 (status indicators)
T23.3 (LinkedIn URL) ─── T23.5 (copy buttons)
T23.4 (optimizer) ─── T23.5 ─── T23.6 (engagement)
T23.8 (platform limits) - independent
T23.9 (verification) - depends on T23.3
```

### Tasks

#### T23.1: Social Profile Types [S - 2h]
- **Goal:** Type definitions for social data.
- **Description:** LinkedIn, Twitter handle storage.
- **Acceptance Criteria:**
  - Update `src/types/index.ts`:
    ```typescript
    interface SocialProfiles {
      linkedinUrl?: string;
      twitterHandle?: string;
      lastVerified?: number;
      source: 'import' | 'manual' | 'enriched';
    }
    ```
  - Add to Prospect interface
  - Validation: URL format, handle format
- **Tests:**
  - Unit test: valid LinkedIn URL accepted
  - Unit test: invalid URL rejected
  - Unit test: Twitter handle normalized (@ stripped)
- **Validation:** Prospects have social fields

#### T23.2: Social Profile Editor UI [M - 3h]
- **Goal:** Add/edit social handles per prospect.
- **Description:** Inline editing in prospect detail.
- **Acceptance Criteria:**
  - Add "Social" section to prospect detail
  - Fields: LinkedIn URL, Twitter handle
  - Inline edit with save/cancel
  - "Open" button → new tab
  - "Copy URL" button
  - Source indicator (imported, manual, enriched)
- **Tests:**
  - RTL test: edit and save works
  - RTL test: open button triggers new tab
- **Validation:** Add social profiles to prospect

#### T23.3: LinkedIn URL Generator [S - 2h]
- **Goal:** Generate LinkedIn search URL from name/company.
- **Description:** Helper when URL not known.
- **Acceptance Criteria:**
  - Function: `generateLinkedInSearchUrl(name, company): string`
  - URL: `https://linkedin.com/search/results/people/?keywords=${encodeURIComponent(name + ' ' + company)}`
  - "Find on LinkedIn" button in UI
  - Opens in new tab
- **Tests:**
  - Unit test: URL format correct
  - Unit test: special characters encoded
- **Validation:** Search finds correct person

#### T23.4: Platform Message Optimizer [M - 4h]
- **Goal:** Adjust message for platform constraints.
- **Description:** Platform-specific formatting.
- **Acceptance Criteria:**
  - Create `src/services/PlatformOptimizerService.ts`
  - Platforms and limits:
    - Manifest DM: 250 chars
    - LinkedIn InMail: 1,900 chars
    - LinkedIn connection note: 300 chars
    - Twitter DM: 10,000 chars (but keep short)
    - Email subject: 60 chars
  - Function: `optimizeForPlatform(message, platform): OptimizedMessage`
  - Optimizations:
    - Truncate with ellipsis if over
    - Suggest shorter version if close to limit
    - Platform-specific CTAs
- **Tests:**
  - Unit test: message truncated correctly
  - Unit test: platform limits applied
- **Validation:** Optimize same message for different platforms

#### T23.5: Platform Copy Buttons [M - 3h]
- **Goal:** Copy optimized message for specific platform.
- **Description:** One-click copy with platform context.
- **Acceptance Criteria:**
  - Update message editor with platform buttons:
    - "Copy for Manifest" (250 char)
    - "Copy for LinkedIn" (300 char connection note)
    - "Copy for Twitter" (short version)
    - "Copy for Email" (full version)
  - Each shows char count
  - Toast confirmation with platform name
  - Log copy action (for T23.6)
- **Tests:**
  - RTL test: copy triggers clipboard
  - RTL test: toast shows platform name
  - RTL test: copy logged
- **Validation:** Copy for each platform

#### T23.6: Engagement Tracker [M - 3h]
- **Goal:** Log interactions per platform per prospect.
- **Description:** Manual tracking of sends and responses.
- **Acceptance Criteria:**
  - Create `src/services/EngagementTrackerService.ts`
  - Log types:
    - `copied` (platform, timestamp)
    - `sent` (platform, timestamp) - manual mark
    - `responded` (platform, timestamp, notes) - manual mark
    - `meeting_booked` (timestamp, notes)
  - View engagement timeline in prospect detail
  - Filter prospects by engagement status
- **Tests:**
  - Unit test: engagement logged correctly
  - Unit test: timeline sorted by date
- **Validation:** Log engagement, view timeline

#### T23.7: Social Status Indicators [S - 2h]
- **Goal:** Show social status in prospect list.
- **Description:** Icons indicating social profile availability.
- **Acceptance Criteria:**
  - Update prospect list row:
    - LinkedIn icon: gray (none), blue (has URL)
    - Twitter icon: gray (none), blue (has handle)
    - Engagement dot: green (recent), yellow (stale), gray (none)
  - Hover tooltip: "LinkedIn: linked" / "Twitter: @handle"
  - Filter by "has LinkedIn" / "has Twitter"
- **Tests:**
  - RTL test: icon colors correct
  - RTL test: tooltip shows correct text
- **Validation:** Visual inspection of list

#### T23.8: Platform Character Limit Display [S - 2h]
- **Goal:** Real-time counter per platform.
- **Description:** Show remaining chars for selected platform.
- **Acceptance Criteria:**
  - Platform selector in message editor
  - Character counter updates with platform limit:
    - Manifest: "150/250"
    - LinkedIn: "150/300"
    - etc.
  - Color coding: green → orange (80%) → red (100%)
  - Keyboard shortcut to switch platforms
- **Tests:**
  - RTL test: limit changes with platform
  - RTL test: color changes at thresholds
- **Validation:** Switch platforms, observe counter

#### T23.9: Social Profile Verification [S - 2h]
- **Goal:** Validate LinkedIn URLs without scraping.
- **Description:** Format validation only (no API calls).
- **Acceptance Criteria:**
  - Validate LinkedIn URL format:
    - Must be linkedin.com domain
    - Must be /in/ profile path
    - Extract vanity URL if present
  - Indicate validation status: ✓ Valid format, ⚠ May not exist
  - Last verified timestamp
  - Note: actual existence requires manual verification
- **Tests:**
  - Unit test: valid URL passes
  - Unit test: invalid domain rejected
  - Unit test: /company/ URL rejected (not person)
- **Validation:** Validate sample URLs

---

## Sprint 24: Multi-tenant Foundation
**Goal:** Feature flags and workspace configuration for future multi-client support.
**Demo:** Enable feature flag → workspace-specific branding → config isolation works.
**Dependencies:** None (can run parallel)

### Scope Reduction Note
Full multi-tenancy (entity scoping, workspace switching) deferred. Sprint 24 focuses on:
1. Feature flag infrastructure
2. Workspace config (branding, claims, templates)
3. Default YardFlow workspace

### Task Dependency Graph
```
T24.1 (flags) ─── T24.2 (workspace model) ─── T24.3 (config schema)
T24.4 (context) ─── T24.5 (bootstrap) ─── T24.6 (branding UI)
T24.7 (switcher stub) - independent, behind flag
```

### Tasks

#### T24.1: Feature Flag System [M - 3h]
- **Goal:** Environment-based feature flags with runtime override.
- **Description:** Control feature availability.
- **Acceptance Criteria:**
  - Create `src/services/FeatureFlagService.ts`
  - Flags defined in `src/config/featureFlags.ts`
  - Sources (priority order):
    1. Runtime override (for testing)
    2. localStorage override
    3. Environment variable
    4. Default value
  - Function: `isEnabled(flagName): boolean`
  - React hook: `useFeatureFlag(flagName): boolean`
  - Initial flags:
    - `MULTI_TENANT`: false
    - `AI_GENERATION`: true
    - `SEQUENCE_BUILDER`: true
- **Tests:**
  - Unit test: env var takes precedence
  - Unit test: runtime override works
  - Unit test: hook returns correct value
- **Validation:** Toggle flag, verify feature hidden

#### T24.2: Workspace Data Model [S - 2h]
- **Goal:** Define workspace schema.
- **Description:** Basic workspace structure.
- **Acceptance Criteria:**
  - Create `src/types/workspace.ts`:
    ```typescript
    interface Workspace {
      id: string;
      name: string;
      slug: string;
      config: WorkspaceConfig;
      createdAt: number;
      updatedAt: number;
    }
    ```
  - No entity scoping yet (deferred)
  - Zod validation
- **Tests:**
  - Unit test: valid workspace passes
- **Validation:** Create workspace object

#### T24.3: Workspace Config Schema [M - 3h]
- **Goal:** Per-workspace configuration.
- **Description:** Branding, claims, templates per workspace.
- **Acceptance Criteria:**
  - Create `src/types/workspaceConfig.ts`:
    ```typescript
    interface WorkspaceConfig {
      branding: {
        name: string;
        logoUrl?: string;
        primaryColor: string;
        tagline: string;
      };
      approvedClaims: ApprovedClaim[];
      defaultPersona: 'exec' | 'ops' | 'proc';
      dmCharLimit: number;
      emailSignature: string;
    }
    ```
  - Zod validation
  - Default config for YardFlow
- **Tests:**
  - Unit test: schema validation works
  - Unit test: defaults applied for missing fields
- **Validation:** Create config, verify all fields

#### T24.4: Workspace Context Provider [M - 3h]
- **Goal:** React context for current workspace.
- **Description:** Access workspace config throughout app.
- **Acceptance Criteria:**
  - Create `src/contexts/WorkspaceContext.tsx`
  - Provider wraps app root
  - Hook: `useWorkspace(): { workspace, config }`
  - Gated behind MULTI_TENANT flag (uses default if disabled)
  - Updates propagate to all consumers
- **Tests:**
  - RTL test: context provides workspace
  - RTL test: hook returns config
- **Validation:** Access config in component

#### T24.5: Default Workspace Bootstrap [S - 2h]
- **Goal:** Create YardFlow workspace on first run.
- **Description:** Initialize with YardFlow configuration.
- **Acceptance Criteria:**
  - Create `src/services/WorkspaceBootstrapService.ts`
  - On first load:
    - Check if workspace exists
    - If not, create "YardFlow" workspace with full config
  - Store in localStorage
  - Include all approved claims from T19.2
- **Tests:**
  - Unit test: workspace created if missing
  - Unit test: existing workspace not overwritten
- **Validation:** Clear localStorage, reload, verify workspace

#### T24.6: Branding Application [M - 3h]
- **Goal:** Apply workspace branding to UI.
- **Description:** Dynamic theming from config.
- **Acceptance Criteria:**
  - Read branding from workspace config
  - Apply to:
    - App header (logo, name)
    - Primary color (buttons, links)
    - Email signature
  - CSS variables for theming
  - Preview in settings (if MULTI_TENANT enabled)
- **Tests:**
  - RTL test: header shows workspace name
  - RTL test: primary color applied
- **Validation:** Change branding, observe UI update

#### T24.7: Workspace Switcher Stub [S - 2h]
- **Goal:** Hidden UI for future workspace switching.
- **Description:** Stubbed component behind flag.
- **Acceptance Criteria:**
  - Create `src/components/WorkspaceSwitcher.tsx`
  - Behind MULTI_TENANT feature flag
  - UI: dropdown with current workspace
  - Non-functional (shows "Coming soon" for switch)
  - Visible only when flag enabled
- **Tests:**
  - RTL test: hidden when flag disabled
  - RTL test: visible when flag enabled
- **Validation:** Enable flag, see switcher

---

## Sprint 25: E2E Testing + Performance
**Goal:** Comprehensive E2E coverage for critical flows, performance optimization.
**Demo:** All E2E tests pass in CI → Lighthouse ≥90 → bundle optimized.
**Dependencies:** All previous sprints complete

### Task Dependency Graph
```
T25.1 (setup) ─── T25.2 (ROI E2E) ─┬── T25.8 (smoke suite)
              ─── T25.3 (marketing E2E) ─┤
              ─── T25.4 (assets E2E) ────┘
T25.5 (bundle) - independent
T25.6 (error boundary) - independent
T25.7 (performance) - depends on T25.5
T25.9 (flag E2E) - depends on T25.1
```

### Tasks

#### T25.1: Playwright Setup [M - 3h]
- **Goal:** Configure Playwright for E2E testing.
- **Description:** Browser testing infrastructure.
- **Acceptance Criteria:**
  - Install Playwright
  - `playwright.config.ts`:
    - Browsers: Chromium, Firefox, WebKit
    - Base URL: localhost:5173
    - Screenshot on failure
    - Video on failure (optional)
  - npm scripts: `test:e2e`, `test:e2e:headed`, `test:e2e:ui`
  - CI config: GitHub Actions workflow
  - Test fixtures and helpers
- **Tests:**
  - Sample test passes on all browsers
- **Validation:** `npm run test:e2e` succeeds

#### T25.2: ROI Flow E2E Test [M - 4h]
- **Goal:** Test ROI calculator end-to-end.
- **Description:** Full ROI workflow test.
- **Acceptance Criteria:**
  - Test file: `e2e/roi.spec.ts`
  - Test scenarios:
    1. Select prospect → open ROI tab → inputs prefilled
    2. Modify inputs → see calculation update
    3. Export JSON → verify download
    4. Copy DM line → verify clipboard
  - Assertions on calculated values
  - Screenshot comparisons
- **Tests:**
  - E2E test passes on Chromium
  - E2E test passes on Firefox
- **Validation:** Watch test run in headed mode

#### T25.3: Marketing Flow E2E Test [M - 4h]
- **Goal:** Test marketing module end-to-end.
- **Description:** Import → filter → export flow.
- **Acceptance Criteria:**
  - Test file: `e2e/marketing.spec.ts`
  - Test scenarios:
    1. Load page → see imported prospects
    2. Apply filters → count updates
    3. Select segment → apply sequence
    4. Export to HubSpot → verify download
  - Test with sample data fixture
- **Tests:**
  - E2E test passes
- **Validation:** Watch test run

#### T25.4: Asset Generation E2E Test [M - 4h]
- **Goal:** Test AI asset generation end-to-end.
- **Description:** Generate → cache → regenerate flow.
- **Acceptance Criteria:**
  - Test file: `e2e/assets.spec.ts`
  - Test scenarios:
    1. Select prospect → open assets tab
    2. Generate assets → see loading → see results
    3. Copy DM → verify clipboard
    4. Refresh → see cached results
    5. Regenerate → see new results
  - Mock Gemini API for deterministic tests
- **Tests:**
  - E2E test passes with mock API
- **Validation:** Watch test run

#### T25.5: Bundle Size Optimization [M - 4h]
- **Goal:** Reduce bundle size to <500KB.
- **Description:** Code splitting and tree shaking.
- **Acceptance Criteria:**
  - Add bundle analyzer: `rollup-plugin-visualizer`
  - Code splitting:
    - Lazy load: ROI tab, Assets tab, Marketing module
    - Route-based chunks
  - Tree shaking:
    - Import only used Lucide icons
    - Remove unused dependencies
  - Target: main bundle <300KB, lazy chunks <100KB each
  - Document largest dependencies
- **Tests:**
  - Build produces expected chunks
  - Total size <500KB
- **Validation:** `npm run build && npm run analyze`

#### T25.6: Error Boundary Implementation [M - 3h]
- **Goal:** Global error handling with recovery.
- **Description:** Catch and display errors gracefully.
- **Acceptance Criteria:**
  - Create `src/components/ErrorBoundary.tsx`
  - Wrap app root
  - Error UI:
    - "Something went wrong" message
    - Error details (collapsible for dev)
    - "Reload" button
    - "Report" button (logs to console)
  - Per-feature error boundaries for isolation
  - Log errors to monitoring (console for now)
- **Tests:**
  - RTL test: error caught and displayed
  - RTL test: reload button resets state
- **Validation:** Trigger error, observe boundary

#### T25.7: Performance Audit + Fixes [M - 4h]
- **Goal:** Lighthouse performance ≥90.
- **Description:** Identify and fix performance issues.
- **Acceptance Criteria:**
  - Run Lighthouse audit
  - Target scores:
    - Performance: ≥90
    - Accessibility: ≥95
    - Best Practices: ≥95
    - SEO: ≥90
  - Common fixes:
    - Image optimization
    - Font loading strategy
    - Critical CSS extraction
    - Preload key resources
  - Document current vs target scores
- **Tests:**
  - Lighthouse CI integration (optional)
- **Validation:** Lighthouse report in CI

#### T25.8: Smoke Test Suite [S - 2h]
- **Goal:** Fast minimal test for CI feedback.
- **Description:** Critical path only, <1 minute.
- **Acceptance Criteria:**
  - Test file: `e2e/smoke.spec.ts`
  - Tests:
    1. App loads without error
    2. Prospect list renders
    3. Select prospect → detail loads
    4. Generate button exists
  - Target: <30 seconds
  - Run on every PR
- **Tests:**
  - Smoke test passes
- **Validation:** Run in CI, verify speed

#### T25.9: Feature Flag E2E Tests [S - 2h]
- **Goal:** Verify flags actually gate features.
- **Description:** Test feature flag behavior.
- **Acceptance Criteria:**
  - Test file: `e2e/feature-flags.spec.ts`
  - Tests:
    1. MULTI_TENANT=false → workspace switcher hidden
    2. MULTI_TENANT=true → workspace switcher visible
    3. Flag toggle updates UI without refresh
- **Tests:**
  - E2E test passes
- **Validation:** Toggle flag, verify behavior

---

## Risk Register

### 🚨 High Risk

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Gemini API rate limits during Manifest | High | High | Pre-generate assets for top 50 prospects. Aggressive caching. Template fallback. |
| HubSpot import fails | Medium | High | Add dry-run mode. Validate against schema. Test with sandbox. |
| ROI formulas incorrect | Medium | High | Get stakeholder sign-off before Sprint 18. Test with known outputs. |
| 250-char limit differs from actual | Medium | Medium | Verify actual Manifest app limit. Configurable limit. |

### ⚠️ Medium Risk

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Campaign Builder scope creep | High | Medium | Strictly MVP: assign + export. No scheduling, no sending. |
| localStorage limits | Medium | Medium | IndexedDB fallback. Cache size monitoring. LRU eviction. |
| Feature flag test matrix explosion | Medium | Medium | Define 2-3 canonical configs. Document supported combinations. |

---

## Technical Debt Backlog

### Known Issues
1. **App.tsx:** 1248 lines → extract components (Sprint 25)
2. **Hardcoded templates:** Move to config/database
3. **No error boundary:** Add global handling (T25.6)

### Refactoring Opportunities
- [ ] Extract: ProspectList, ProspectDetail, MessageEditor
- [ ] Create: useProspect, useChat, useAuth hooks
- [ ] Add: React Query for data fetching
- [ ] Move: templates to workspace config

---

## Definition of Done (Global)

- [ ] App can be demoed end-to-end on fresh dataset
- [ ] No hallucinated claims: only allowlisted proof points
- [ ] Every DM exported is ≤250 characters and passes lint
- [ ] ROI outputs are deterministic and unit-tested
- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] No TypeScript errors
- [ ] PR reviewed and approved

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Meetings Booked | 0 | 50+ at Manifest |
| Time to First Message | ~5 min | <1 min |
| Test Coverage | ~40% | >80% |
| Lighthouse Performance | Unknown | ≥90 |
| Bundle Size | 647KB | <500KB |
| Prospects in System | 40 (hardcoded) | 5,408 (full hitlist) |


---

## Changelog

- **V4 (Meeting Machine):** Complete rewrite for new priorities
  - Replaced Sprint 18-25 with ROI → Assets → Marketing → Quality → Multi-tenant sequence
  - Added enriched data documentation (5,408 people, 2,652 companies, 220 speakers)
  - Added ROI formula specifications with stakeholder sign-off requirement
  - Added Gemini mock service for testing
  - Added approved claims registry to prevent AI hallucination
  - Added HubSpot schema specification
  - Added message lint engine with banned phrases
  - Added sequence builder with approval workflow
  - Added social channel optimization
  - Reduced multi-tenant scope (flags + config only, entity scoping deferred)
  - Added comprehensive E2E testing strategy
  - Added risk register with mitigations
  - Incorporated subagent review feedback
- **V3:** UI/UX polish, emotional messaging, social integration (superseded by V4)
- **V2:** Initial sprint structure
- **V1:** Project foundation

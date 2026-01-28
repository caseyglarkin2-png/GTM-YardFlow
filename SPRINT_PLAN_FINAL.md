# YardFlow GTM Hub - Sprint & Task Breakdown V3 (Final)

## Project Overview
YardFlow Hub is a React/TypeScript SPA for the Manifest 2026 conference GTM strategy. It provides prospect management, AI-powered message generation, emotional messaging personalization, multi-channel social outreach, and team collaboration features.

**Tech Stack:** Vite 5.x + React 18 + TypeScript 5.x + Tailwind CSS 3.4 + Firebase (Auth/Firestore) + Gemini AI

**Deployed:** https://gtm-yard-flow.vercel.app

**Test Coverage:** 40 tests passing (Vitest + React Testing Library)

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

| Sprint | Goal | Impact | Effort | Est. Time |
|--------|------|--------|--------|-----------|
| Sprint 18 | UI/UX Audit & Polish | High | Medium | 2 weeks |
| Sprint 19 | Emotional Messaging Layer | High | Medium | 2 weeks |
| Sprint 20 | Enriched Leads Import System | High | Medium | 1.5 weeks |
| Sprint 21 | Social Media Feeds Integration | High | High | 3 weeks |
| Sprint 22 | Multi-Channel Outreach Automation | High | High | 3 weeks |
| Sprint 23 | Advanced Analytics Dashboard | Medium | Medium | 2 weeks |
| Sprint 24 | Code Splitting & Performance | Medium | Medium | 1 week |
| Sprint 25 | E2E Testing with Playwright | Medium | High | 2 weeks |

**Recommended Order:** 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25

**Rationale:**
- Sprint 18 (UI/UX): Foundation polish enables better user testing of later features
- Sprint 19 (Emotional): Core messaging enhancement, high ROI for conference outreach
- Sprint 20 (Leads Import): Unblocks enriched data flowing in; needed before social matching
- Sprint 21 (Social Feeds): Enables multi-channel visibility, depends on enriched data
- Sprint 22 (Automation): Highest complexity, needs stable social integrations
- Sprint 23-25: Polish and scale

---

## Sprint 18: UI/UX Audit & Polish
**Goal:** Comprehensive audit and refinement of visual design, micro-interactions, and user experience.
**Demo:** Before/after screenshots, Lighthouse scores ≥95, user flow recordings.
**Dependencies:** None

### Task Dependency Graph
```
T18.1 ─┬── T18.6 (colors)
       └── T18.7 (typography)
T18.2 (animations) - independent
T18.3 (skeletons) - independent  
T18.4 (empty states) - independent
T18.5 (validation) - independent
T18.8 ─── T18.9 (after icons → focus)
T18.10 (responsive) - runs last, validates all
```

### Tasks

#### T18.1: Visual Hierarchy & Contrast Audit [S - 2h]
- **Description:** Audit all screens for contrast ratios and spacing consistency
- **Acceptance Criteria:**
  - All text meets WCAG AA contrast (4.5:1 normal, 3:1 large)
  - Spacing scale applied: 4, 8, 16, 24, 32, 48px
  - Primary actions visually prominent; secondary de-emphasized
  - Create `src/styles/spacing.ts` constants
- **Tests:**
  - `npm run test:a11y` passes (Lighthouse accessibility ≥ 95)
  - Unit test: spacing constants export correctly
- **Validation:** axe-core browser extension reports 0 contrast issues

#### T18.2: Micro-Interaction Animations [M - 4h]
- **Description:** Add subtle animations for state changes respecting reduced motion
- **Acceptance Criteria:**
  - Button hover: scale(1.02), 150ms ease-out
  - Button active: scale(0.98), 50ms
  - Tab switches: opacity fade 150ms
  - Modal: fade + scale from 95%, 200ms
  - Status badge: background transition 300ms
  - All wrapped in `@media (prefers-reduced-motion: no-preference)`
- **Tests:**
  - Unit test: animation classes apply on state change
  - Unit test: `prefers-reduced-motion: reduce` disables animations
- **Validation:** Chrome DevTools → Rendering → Enable CSS animations inspection

#### T18.3: Loading Skeleton Components [M - 4h]
- **Description:** Replace spinners with skeleton loading states
- **Acceptance Criteria:**
  - Create `<Skeleton />` component with shimmer animation
  - Prospect list: skeleton cards during load
  - Chat: typing indicator with pulsing dots
  - Template generation: shimmer on editor
  - Skeleton color: `bg-slate-200` with gradient shimmer
- **Tests:**
  - Unit test: `<Skeleton />` renders with correct width/height props
  - Unit test: skeleton replaced by content when `isLoading=false`
- **Validation:** Network throttle 3G, observe skeletons

#### T18.4: Empty States Enhancement [M - 3h]
- **Description:** Create actionable empty states for zero-data scenarios
- **Acceptance Criteria:**
  - No prospects: illustration + "Adjust filters" + clear button
  - No search results: suggestions based on query
  - No chat history: clickable conversation starters
  - No activity: "Select a prospect to begin" with arrow
  - Each state has primary CTA
- **Tests:**
  - Unit test: empty state renders when `data.length === 0`
  - Unit test: CTA onClick triggers expected action
- **Validation:** Manually trigger each empty state

#### T18.5a: Form Validation States [S - 2h]
- **Description:** Add inline validation with visual feedback
- **Acceptance Criteria:**
  - API key input: ✓ when valid format, ✗ when invalid
  - Character counter: green → orange (>200) → red (>250)
  - Over-limit: shake animation + "X chars over"
  - Input border colors: green/red based on validity
- **Tests:**
  - Unit test: validation state computed correctly
  - Unit test: shake animation class applied when over limit
- **Validation:** Type invalid input, observe feedback

#### T18.5b: Toast Notification System [M - 3h]
- **Description:** Global toast notifications for errors and success
- **Acceptance Criteria:**
  - Create `<Toast />` component and `useToast` hook
  - Position: top-right, stacked
  - Auto-dismiss after 5s (configurable)
  - Types: success (green), error (red), warning (orange), info (blue)
  - Network errors trigger toast with retry button
- **Tests:**
  - Unit test: toast renders with correct type styling
  - Unit test: auto-dismiss after timeout
  - Unit test: manual dismiss removes toast
- **Validation:** Trigger network error, observe toast

#### T18.6: Semantic Color Tokens [S - 2h]
- **Description:** Define semantic color system in Tailwind config
- **Acceptance Criteria:**
  - Add to `tailwind.config.js`:
    - `primary-*`: blue-600 scale
    - `success-*`: green-600 scale  
    - `warning-*`: orange-500 scale
    - `danger-*`: red-600 scale
  - Status: new=slate, drafted=yellow, contacted=green, booked=purple
  - Tier: Tier1=orange, Tier2=blue, Tier3=slate
  - CSS custom properties for future theming
- **Tests:**
  - Build succeeds with new config
  - Snapshot test: existing components render correctly
- **Validation:** `npm run build` passes

#### T18.7: Typography Scale Documentation [S - 2h]
- **Description:** Document and enforce typography scale
- **Acceptance Criteria:**
  - Create `src/styles/typography.md` with scale:
    - xs=10px, sm=12px, base=14px, lg=16px, xl=18px, 2xl=24px
  - Heading hierarchy: H1=2xl bold, H2=xl semibold, H3=lg medium
  - Body: base/relaxed for content, sm for labels
  - Create `<Heading level={1-4} />` component
- **Tests:**
  - Snapshot test: Heading component renders correct tags
- **Validation:** Typography specimen in Storybook or test page

#### T18.8: Icon Consistency Audit [S - 2h]
- **Description:** Standardize icon sizing and accessibility
- **Acceptance Criteria:**
  - Sizes: xs=12, sm=16, md=20, lg=24, xl=32
  - All from lucide-react (no mixed libraries)
  - All have `aria-hidden="true"` with adjacent labels
  - Create `<IconButton />` with 44×44px touch target
- **Tests:**
  - Unit test: IconButton has min-width/min-height 44px
  - Snapshot test: icon sizes match spec
- **Validation:** Audit all icon usages in codebase

#### T18.9: Focus State Enhancement [M - 3h]
- **Description:** Improve keyboard focus indicators
- **Acceptance Criteria:**
  - Focus ring: 2px solid blue-500, 2px offset
  - Use `focus-visible` (not `focus`)
  - High contrast mode: 3px solid
  - Focus order follows DOM order
  - Custom focus for: buttons, cards, inputs, tabs
- **Tests:**
  - Unit test: focus-visible class applied on keyboard nav
  - E2E test: tab through app without focus loss
- **Validation:** Keyboard-only navigation test

#### T18.10: Responsive Breakpoint Validation [M - 3h]
- **Description:** Test all components at every breakpoint
- **Acceptance Criteria:**
  - Test at: 320, 375, 414, 768, 1024, 1440, 1920px
  - No horizontal scroll at any size
  - All touch targets ≥44px on mobile
  - Document any device-specific fixes
- **Tests:**
  - Snapshot tests at each breakpoint
  - Visual regression with Percy/Chromatic (optional)
- **Validation:** Manual testing on iPhone SE, iPad, Desktop

---

## Sprint 19: Emotional Messaging Layer
**Goal:** Add emotional intelligence and personality to fact-based messaging sequences.
**Demo:** Side-by-side cold vs warm messages, tone selector UI, sentiment analysis.
**Dependencies:** Sprint 18 complete (UI components available)

### Task Dependency Graph
```
T19.1 (framework) ─── T19.2 (UI) ─── T19.3 (prompt)
T19.4 (variants) - depends on T19.1
T19.5 (power words) - independent
T19.6 (sentiment) ─── T19.7 (personality score)
T19.8 (A/B storage) - independent
T19.9 (hooks) - depends on T19.3
T19.10 (tokens) - independent
```

### Tasks

#### T19.1: Emotional Tone Framework Definition [S - 2h]
- **Description:** Define the emotional tone taxonomy for messaging
- **Acceptance Criteria:**
  - Create `src/data/emotionalTones.ts` with 5 tones:
    1. **Challenger**: Confident, provocative, data-backed
    2. **Collaborative**: Partnership-focused, "we" language
    3. **Empathetic**: Pain-aware, understanding
    4. **Urgent**: Time-sensitive, FOMO, exclusive
    5. **Inspirational**: Vision-focused, aspirational
  - Each tone: name, description, trigger words, example phrase
  - Mapping function: `getToneForProspect(prospect)` based on tier/persona
- **Tests:**
  - Unit test: all 5 tones have required properties
  - Unit test: mapper returns Challenger for Tier 1 Execs
- **Validation:** Review documentation with team

#### T19.2: Tone Selection UI Component [M - 3h]
- **Description:** Add tone selector to message editor
- **Acceptance Criteria:**
  - Horizontal pill buttons below template selector
  - Icons: Zap, Users, Heart, Clock, Sparkles
  - Auto-select based on prospect (from T19.1 mapper)
  - Selection persists in localStorage per prospect
  - Tooltip on hover explains each tone
- **Tests:**
  - Unit test: renders 5 options
  - Unit test: selection updates state
  - Unit test: localStorage persistence works
- **Validation:** Click each tone, verify visual feedback

#### T19.3: Update SystemPromptBuilder with Tone [M - 3h]
- **Description:** Inject emotional tone into AI prompts
- **Acceptance Criteria:**
  - Add `tone?: EmotionalTone` to `SystemPromptOptions`
  - Tone instructions injected into prompt:
    - Challenger: "Use confident language, challenge status quo"
    - Collaborative: "Use 'we' language, mutual benefit"
    - Empathetic: "Acknowledge challenges, show understanding"
    - Urgent: "Create appropriate urgency, limited availability"
    - Inspirational: "Paint vision of transformed operations"
  - Affects both Brain chat and template generation
- **Tests:**
  - Unit test: `buildSystemPrompt({ tone: 'challenger' })` includes tone text
  - Unit test: prompt excludes tone section when undefined
- **Validation:** Generate messages with different tones, compare outputs

#### T19.4: Template Variants with Emotional Angles [L - 5h]
- **Description:** Create emotional variants of existing templates
- **Acceptance Criteria:**
  - Each base template (dm_codev, dm_exec, dm_ops, dm_carrier) × 5 tones = 20 variants
  - Variant naming: `dm_codev_challenger`, etc.
  - Store in `src/data/templateVariants.ts`
  - UI: "Variants" dropdown when template selected
  - Preview variant body before applying
- **Tests:**
  - Unit test: 20 variants exist
  - Unit test: variant selection updates editor
- **Validation:** Review all variants for quality

#### T19.5: Emotional Power Words Database [M - 3h]
- **Description:** Create database of power words for message enhancement
- **Acceptance Criteria:**
  - Create `src/data/powerWords.ts`
  - Categories: urgency, exclusivity, trust, achievement, curiosity
  - ≥20 words per category
  - Power word suggester component with contextual suggestions
  - Click word to insert at cursor position
- **Tests:**
  - Unit test: filter by category works
  - Unit test: insert at cursor position
- **Validation:** All words reviewed for appropriateness

#### T19.6: Sentiment Analysis Utility [M - 4h]
- **Description:** Real-time lexicon-based sentiment scoring
- **Acceptance Criteria:**
  - Create `src/utils/sentimentAnalyzer.ts`
  - No external API—local lexicon-based
  - Score 1-5: cold → warm
  - Visual indicator: thermometer or gradient bar
  - Debounced 300ms to prevent excess recalculation
  - Tooltip shows breakdown: confidence, urgency, warmth words
- **Tests:**
  - Unit test: "urgent deadline" scores higher urgency
  - Unit test: "excited to partner" scores higher warmth
  - Unit test: debounce prevents spam
- **Validation:** Test with known cold/warm messages

#### T19.7: Message Personality Radar Chart [M - 4h]
- **Description:** Visualize message personality dimensions
- **Acceptance Criteria:**
  - Dimensions: Directness, Warmth, Urgency, Professionalism (1-5 each)
  - Radar chart in message editor sidebar
  - Recommended ranges shown based on prospect tier
  - "Balance" suggestions if scores extreme
  - Uses analyzer from T19.6
- **Tests:**
  - Unit test: score calculator returns 4 dimensions
  - Unit test: radar chart renders with correct data
- **Validation:** Visual inspection of chart accuracy

#### T19.8: A/B Variant Tracking Storage [M - 3h]
- **Description:** Track which variants are sent for A/B analysis
- **Acceptance Criteria:**
  - Store per send: prospectId, templateId, tone, variantId, timestamp
  - Data in localStorage (future: Firestore)
  - Export capability for analysis (CSV)
  - Prevent duplicate variant to same prospect (warning)
- **Tests:**
  - Unit test: variant logged on copy
  - Unit test: duplicate detection triggers warning
  - Unit test: export generates valid CSV
- **Validation:** Send multiple messages, export, verify structure

#### T19.9: AI Conversation Hooks Generator [M - 4h]
- **Description:** AI-generated conversation starters based on prospect
- **Acceptance Criteria:**
  - "Hooks" section below template selector
  - 3 AI-generated hooks per prospect (cached in memory)
  - Hook types: pain point, industry trend, company news
  - Click hook to insert into message
  - Regenerate button for new hooks
  - Rate limit: max 10 hook generations per minute
- **Tests:**
  - Unit test: API called with prospect data
  - Unit test: hook inserted on click
  - Unit test: rate limit enforced
- **Validation:** Generate hooks for 5 prospects, review quality

#### T19.10: Personalization Token System [M - 4h]
- **Description:** Dynamic tokens for deeper personalization
- **Acceptance Criteria:**
  - Tokens: `{first_name}`, `{company}`, `{title}`, `{tier_pitch}`, `{pain_point}`
  - Token picker UI component
  - Tokens highlighted in editor (distinct color)
  - Preview mode shows resolved tokens
  - Warning if prospect missing required data
  - `{tier_pitch}` maps to tier-specific value prop
- **Tests:**
  - Unit test: tokens replaced with prospect data
  - Unit test: missing data shows warning
  - Unit test: token picker inserts at cursor
- **Validation:** Create message with all tokens, preview

---

## Sprint 20: Enriched Leads Import System
**Goal:** Import and process enriched lead lists with additional data fields.
**Demo:** Import CSV with custom fields, auto-mapping, enrichment display, duplicate handling.
**Dependencies:** None (can run parallel with Sprint 19)

### Task Dependency Graph
```
T20.1 (CSV service) ─── T20.2 (mapping UI) ─── T20.5 (progress)
T20.3 (type extension) - independent, do first
T20.4 (duplicates) - depends on T20.1
T20.6 (display) - depends on T20.3
T20.7 (quality) - depends on T20.6
T20.8 (history) - depends on T20.5
T20.9 (API enrich) - independent
T20.10 (bulk ops) - depends on T20.3
```

### Tasks

#### T20.1: CSV Import Service [M - 4h]
- **Description:** Robust CSV parsing with error handling
- **Acceptance Criteria:**
  - Create `src/services/CsvImportService.ts`
  - Support CSV, TSV formats
  - Handle: quoted fields, commas in values, line breaks
  - Encoding: UTF-8, Latin-1 detection
  - Preview first 10 rows before import
  - Error report: invalid rows with line numbers
  - Library: Papa Parse
- **Tests:**
  - Unit test: parse simple CSV correctly
  - Unit test: handle quoted fields with embedded commas
  - Unit test: detect and report invalid rows
- **Validation:** Import provided hitlist CSVs

#### T20.2: Field Mapping Interface [M - 4h]
- **Description:** Map CSV columns to prospect fields
- **Acceptance Criteria:**
  - Auto-detect common names: Name, Company, Title, Email
  - Dropdown to manually map each column
  - Preview mapped data (5 rows)
  - Remember mappings for same-format files (localStorage)
  - Skip/ignore unmapped columns
  - Custom fields stored in `metadata` object
- **Tests:**
  - Unit test: auto-detect maps "Company Name" → company
  - Unit test: manual mapping persists
  - Unit test: custom fields in metadata
- **Validation:** Map hitlist columns, verify import

#### T20.3: Enriched Prospect Type Extension [S - 2h]
- **Description:** Extend Prospect type with enrichment fields
- **Acceptance Criteria:**
  - Update `src/types/index.ts`:
    ```typescript
    email?: string;
    phone?: string;
    linkedInUrl?: string;
    twitterHandle?: string;
    revenue?: string;
    employeeCount?: number;
    industry?: string;
    recentNews?: string[];
    techStack?: string[];
    customFields?: Record<string, string | number | boolean>;
    dataSource?: string;
    importedAt?: number;
    ```
  - Existing prospects remain valid
- **Tests:**
  - Build succeeds
  - Unit test: old prospects pass validation
- **Validation:** Create prospect with all new fields

#### T20.4: Duplicate Detection & Merge [M - 4h]
- **Description:** Identify and resolve duplicates on import
- **Acceptance Criteria:**
  - Match: exact name + company (high confidence)
  - Match: fuzzy name (>80% Levenshtein) + same company (medium)
  - Match: email exact (high confidence)
  - UI: show duplicates with merge options
  - Merge strategies: keep newest, keep existing, merge non-null
  - Bulk duplicate resolution
- **Tests:**
  - Unit test: exact match detected
  - Unit test: fuzzy match at 80% threshold
  - Unit test: merge preserves non-null values
- **Validation:** Import file with duplicates, resolve

#### T20.5: Import Progress & Validation [M - 3h]
- **Description:** Progress tracking during import
- **Acceptance Criteria:**
  - Progress bar: "Processing X of Y rows"
  - Validation: missing required fields highlighted
  - Warning: unrecognized tier values
  - Summary: X imported, Y updated, Z skipped
  - Undo import within 5 minutes
- **Tests:**
  - Unit test: progress updates correctly
  - Unit test: validation catches missing name
  - Unit test: summary counts accurate
- **Validation:** Import 5000+ row file, monitor progress

#### T20.6: Enrichment Display in Prospect Detail [M - 4h]
- **Description:** Show all enriched data in prospect view
- **Acceptance Criteria:**
  - "Enrichment" collapsible section in detail view
  - Display: email, phone, LinkedIn, Twitter with action icons
  - Revenue & employee count badges
  - Industry tag pill
  - Recent news as expandable list
  - Tech stack as tag cloud
  - Custom fields in key-value table
- **Tests:**
  - Unit test: section renders when data present
  - Unit test: hidden when no enrichment
- **Validation:** View enriched prospect, verify fields

#### T20.7: Enrichment Quality Indicators [S - 2h]
- **Description:** Show data completeness and freshness
- **Acceptance Criteria:**
  - Completeness: % of enrichment fields populated
  - Freshness: "Updated X days ago"
  - Source: "From Manifest Hitlist v3"
  - Quality badge: Gold (>80%), Silver (50-80%), Bronze (<50%)
  - Filter by quality level
- **Tests:**
  - Unit test: completeness calculated correctly
  - Unit test: badge assigned correctly
- **Validation:** Review indicators for various prospects

#### T20.8: Import History & Rollback [M - 3h]
- **Description:** Track imports with rollback capability
- **Acceptance Criteria:**
  - Log: filename, timestamp, row count, user
  - View past imports in Settings
  - Rollback: restore to pre-import state
  - Keep last 10 imports only
  - Rollback data stored in localStorage
- **Tests:**
  - Unit test: import logged correctly
  - Unit test: rollback restores state
- **Validation:** Import, rollback, verify restoration

#### T20.9: External Enrichment API Prep [M - 3h]
- **Description:** Prepare for future API enrichment integrations
- **Acceptance Criteria:**
  - Create `src/services/EnrichmentApiService.ts` interface
  - Stub implementations for: Clearbit, Apollo, ZoomInfo
  - API key configuration in Settings
  - Batch request structure (100 at a time)
  - Cache layer to avoid redundant calls
  - Documented: "API integration not yet active"
- **Tests:**
  - Unit test: interface methods exist
  - Unit test: cache prevents duplicate calls
- **Validation:** Code review for extensibility

#### T20.10: Bulk Data Operations [M - 4h]
- **Description:** Bulk edit and organize imported leads
- **Acceptance Criteria:**
  - Multi-select with checkboxes on prospect list
  - Bulk actions: change status, change tier, delete, export
  - Tag system: create custom tags, filter by tag
  - Bulk action confirmation with count
  - "Select all visible" option
- **Tests:**
  - Unit test: multi-select tracks selection
  - Unit test: bulk status change updates all
  - Unit test: tag filter works
- **Validation:** Select 20, bulk change status

---

## Sprint 21: Social Media Feeds Integration
**Goal:** Connect Twitter/X and LinkedIn for multi-channel visibility and outreach.
**Demo:** OAuth connection, social feeds, profile matching, DM drafts.
**Dependencies:** Sprint 20 (enriched data with social handles)

### Important API Limitations Note
```
⚠️ TWITTER/X: Requires API access ($100/mo Basic tier minimum)
   - Free tier has very limited access
   - DM API requires elevated access approval
   
⚠️ LINKEDIN: Very restrictive API
   - No public timeline access
   - Messaging requires Sales Navigator ($99/mo+)
   - Best effort: profile link + manual copy
```

### Task Dependency Graph
```
T21.0 (security) - do first
T21.1 (OAuth) ─── T21.2 (connection UI)
T21.3 (Twitter service) ─── T21.6 (feed component)
T21.4 (LinkedIn service) ──┘
T21.5 (profile matcher) - depends on T21.3, T21.4
T21.7 (engagement tracking) - depends on T21.6
T21.8 (DM drafts) - depends on T21.5
T21.9 (enrichment display) - depends on T21.5
T21.10 (status indicators) - depends on T21.5
```

### Tasks

#### T21.0: Social Integration Security Rules [S - 2h]
- **Description:** Security considerations for OAuth and token storage
- **Acceptance Criteria:**
  - Document security model in `SECURITY.md`
  - Tokens encrypted before localStorage (AES-256 with derived key)
  - Create `src/utils/tokenEncryption.ts`
  - Warning in UI: "Tokens stored locally"
  - Automatic token refresh before expiry
  - Logout clears all tokens
- **Tests:**
  - Unit test: encryption/decryption roundtrip
  - Unit test: decryption fails with wrong key
- **Validation:** Security review

#### T21.1: OAuth2 Authentication Service [L - 5h]
- **Description:** OAuth2 service for social platforms
- **Acceptance Criteria:**
  - Create `src/services/OAuthService.ts`
  - Twitter/X OAuth 2.0 with PKCE flow
  - LinkedIn OAuth 2.0
  - Encrypted token storage (from T21.0)
  - Token refresh handling
  - Logout/disconnect per platform
  - Environment variables for client IDs
- **Tests:**
  - Unit test: auth URL generated with correct params
  - Unit test: callback token parsed correctly
  - Unit test: refresh triggered at 5 min before expiry
- **Validation:** Complete OAuth flow manually

#### T21.2: Social Account Connection UI [M - 4h]
- **Description:** Settings panel for connecting accounts
- **Acceptance Criteria:**
  - "Connections" section in Settings modal
  - Connect buttons: Twitter/X, LinkedIn
  - Connected state: avatar, username, disconnect button
  - Connection status icons in app header
  - Error handling with retry option
  - Loading state during OAuth
- **Tests:**
  - Unit test: connect button triggers OAuth
  - Unit test: connected state shows account info
  - Unit test: disconnect clears tokens
- **Validation:** Connect/disconnect each platform

#### T21.3: Twitter/X Feed Service [M - 4h]
- **Description:** Fetch and cache Twitter data
- **Acceptance Criteria:**
  - Create `src/services/TwitterService.ts`
  - Methods: `searchTweets(query)`, `getUserTimeline(handle)`
  - Cache in memory (5 min TTL)
  - Rate limit handling with exponential backoff
  - Fallback to embed tweets if API unavailable
  - Types: `Tweet`, `TwitterUser`
- **Tests:**
  - Unit test: cache returns within TTL
  - Unit test: cache refreshes after TTL
  - Unit test: rate limit triggers backoff
- **Validation:** Fetch real tweets (if API access)

#### T21.4: LinkedIn Service (Limited) [M - 3h]
- **Description:** LinkedIn integration with API limitations
- **Acceptance Criteria:**
  - Create `src/services/LinkedInService.ts`
  - Methods: `getProfile()` (basic info only)
  - Document API limitations clearly
  - Fallback: `openProfile(url)` opens LinkedIn in new tab
  - Profile link generator from name/company
  - Types: `LinkedInProfile`
- **Tests:**
  - Unit test: profile URL generated correctly
  - Unit test: openProfile uses window.open
- **Validation:** Authenticate, fetch own profile

#### T21.5: Prospect Social Profile Matcher [M - 4h]
- **Description:** Match prospects to social profiles
- **Acceptance Criteria:**
  - Manual entry: `twitterHandle`, `linkedInUrl` fields
  - "Find on Twitter" button: search by name + company
  - "Find on LinkedIn" button: generate profile URL guess
  - Match confidence indicator (manual = high)
  - Save matched profile to prospect
- **Tests:**
  - Unit test: Twitter search query formatted correctly
  - Unit test: LinkedIn URL pattern correct
  - Unit test: match saved to prospect
- **Validation:** Match 5 prospects manually

#### T21.6: Social Feed Tab Component [M - 4h]
- **Description:** Display social activity for prospect
- **Acceptance Criteria:**
  - "Social" section in prospect detail (collapsible)
  - Twitter: last 10 tweets if handle known
  - Each post: text, date, engagement, link to original
  - "Compose Reply" opens draft composer
  - Empty state: "Add social handles to see activity"
  - Loading skeleton while fetching
- **Tests:**
  - Unit test: feed renders tweet list
  - Unit test: empty state when no handles
  - Unit test: loading state shows skeleton
- **Validation:** View feed for prospect with handle

#### T21.7: Social Engagement Tracking [M - 3h]
- **Description:** Track interactions with prospects on social
- **Acceptance Criteria:**
  - Log: liked, retweeted, replied, viewed profile
  - Timestamp and platform per interaction
  - Display in activity feed (Sprint 17)
  - Engagement score: weighted sum
  - "Last engaged" timestamp on prospect card
- **Tests:**
  - Unit test: engagement logged correctly
  - Unit test: score calculated from interactions
- **Validation:** Log interactions, verify in feed

#### T21.8: Platform-Specific DM Draft [M - 4h]
- **Description:** Generate platform-optimized DM drafts
- **Acceptance Criteria:**
  - Platform selector in message editor
  - Twitter DM: optimize for 280 chars (show count)
  - LinkedIn InMail: 1,900 char limit
  - Character counter adapts to platform
  - "Copy for Twitter" / "Copy for LinkedIn" buttons
  - "Open in Twitter/LinkedIn" link
- **Tests:**
  - Unit test: char limit changes with platform
  - Unit test: template adjusted for platform
- **Validation:** Generate DM for each, verify appropriateness

#### T21.9: Social Enrichment Display [S - 2h]
- **Description:** Show social data on prospect profile
- **Acceptance Criteria:**
  - Profile picture from social (if available, cached)
  - Bio/headline displayed
  - Follower counts with formatting (1.2K)
  - "Last active" indicator (if available)
  - Fallback gracefully when data unavailable
- **Tests:**
  - Unit test: data displayed when available
  - Unit test: graceful fallback when missing
- **Validation:** View enriched profile

#### T21.10: Social Status Indicators in List [S - 2h]
- **Description:** Show social status in prospect list
- **Acceptance Criteria:**
  - Small Twitter/LinkedIn icons if handles known
  - Icon colors: gray=no handle, blue=handle, green=recent activity
  - Hover tooltip: last post date, follower count
  - Bulk action: "Find Social Profiles" for selected
- **Tests:**
  - Unit test: icon color logic correct
  - Unit test: tooltip content accurate
- **Validation:** Visual inspection across list

---

## Sprint 22: Multi-Channel Outreach Automation
**Goal:** Enable approved message scheduling and automation to connected platforms.
**Demo:** Draft → Approve → Schedule → Send flow, automation rules, analytics.
**Dependencies:** Sprint 21 (social connections), Firebase required

### ⚠️ Important Limitations
```
- Full automation requires API access (paid tiers)
- This sprint focuses on the WORKFLOW and INFRASTRUCTURE
- Actual automated sending is platform-dependent
- Start with "copy + open platform" fallback
```

### Task Dependency Graph
```
T22.0 (Firebase rules) - do first
T22.1 (approval workflow) ─── T22.2 (queue service) ─── T22.3 (scheduling UI)
T22.4 (Manifest copy) - independent
T22.5 (Twitter send) ─┬── T22.9 (analytics)
T22.6 (LinkedIn open) ─┤
T22.7 (Email prep) ────┘
T22.8 (rules engine) - depends on T22.2
T22.10 (safety) - applies to all, do last
```

### Tasks

#### T22.0: Firestore Security Rules for Messaging [S - 2h]
- **Description:** Define security rules for message queue
- **Acceptance Criteria:**
  - Create/update `firestore.rules`
  - `message_queue`: read/write only by authenticated users
  - `automation_rules`: read/write by owner only
  - `send_history`: append-only, read by owner
  - Deploy rules to Firebase
- **Tests:**
  - Firebase emulator: unauthorized write rejected
  - Firebase emulator: authorized write succeeds
- **Validation:** `firebase deploy --only firestore:rules`

#### T22.1: Message Approval Workflow [M - 4h]
- **Description:** Create approval queue for outbound messages
- **Acceptance Criteria:**
  - New status: `pending_approval` between `drafted` and `contacted`
  - Approval queue view in sidebar
  - Approve/Reject buttons with optional notes
  - Approval history: timestamp, approver
  - Rejected: returns to draft with feedback
  - Feature hidden when only 1 user
- **Tests:**
  - Unit test: submit moves to pending
  - Unit test: approve moves to approved
  - Unit test: reject returns to draft with notes
- **Validation:** Submit, approve, verify flow

#### T22.2: Message Queue Service [M - 4h]
- **Description:** Firestore service for message queue
- **Acceptance Criteria:**
  - Create `src/services/MessageQueueService.ts`
  - Firestore collection: `message_queue`
  - Fields: prospectId, channel, message, status, scheduledAt, sentAt, attempts
  - Status: draft, pending, approved, scheduled, sent, failed
  - Real-time listener for queue updates
  - Retry logic: max 3 attempts, exponential backoff
- **Tests:**
  - Unit test: message added to queue
  - Unit test: status transitions work
  - Unit test: retry increments attempts
- **Validation:** Add messages, observe Firestore

#### T22.3: Scheduling Interface [M - 4h]
- **Description:** UI for scheduling approved messages
- **Acceptance Criteria:**
  - Date/time picker with native inputs
  - Timezone selector (default: user's local)
  - "Best times" suggestions: 9am, 2pm prospect local
  - Batch scheduling: select multiple, set time
  - Calendar view of scheduled sends (weekly)
  - Reschedule and cancel options
- **Tests:**
  - Unit test: schedule saved with correct timestamp
  - Unit test: timezone conversion accurate
  - Unit test: cancel removes from queue
- **Validation:** Schedule messages, view calendar

#### T22.4: Manifest App Integration [M - 3h]
- **Description:** Integration for Manifest conference app
- **Acceptance Criteria:**
  - Research Manifest app's API (document findings)
  - "Copy to Manifest" button with confirmation
  - Track "copied for Manifest" as engagement
  - Instructions: "Open Manifest app and paste in DM"
  - Manifest-specific tips in UI
- **Tests:**
  - Unit test: copy action logged
  - Unit test: instructions displayed
- **Validation:** Manual copy flow tested

#### T22.5: Twitter/X DM Automation (Prep) [M - 4h]
- **Description:** Prepare Twitter DM automation (requires API access)
- **Acceptance Criteria:**
  - Create `src/services/TwitterDmService.ts`
  - Method: `sendDm(recipientId, message)`
  - Pre-send validation: check if can DM (follows or open DMs)
  - Rate limit awareness: 1000 DMs/day max
  - Fallback: "Open Twitter Compose" with prefilled text
  - Document API requirements
- **Tests:**
  - Unit test: DM payload structured correctly
  - Unit test: rate limit error handled
  - Mock test: successful send returns ID
- **Validation:** Test with mock/sandbox if available

#### T22.6: LinkedIn Message Fallback [S - 2h]
- **Description:** LinkedIn message opener (API restrictions)
- **Acceptance Criteria:**
  - "Message on LinkedIn" button
  - Opens LinkedIn messaging URL (if available)
  - Prefill message in URL if possible
  - Track as "opened LinkedIn message"
  - Document: "Full automation requires Sales Navigator"
- **Tests:**
  - Unit test: URL generated correctly
  - Unit test: fallback tracked as engagement
- **Validation:** Click button, verify LinkedIn opens

#### T22.7: Email Integration Prep [M - 4h]
- **Description:** Prepare email channel (backend required for sending)
- **Acceptance Criteria:**
  - Email template preview in editor
  - "Email" channel option with different char limit
  - HTML email preview (basic markdown → HTML)
  - Unsubscribe link placeholder (for compliance)
  - Document: "Requires SMTP/SendGrid backend"
  - Store email drafts in queue
- **Tests:**
  - Unit test: email template renders correctly
  - Unit test: markdown converted to HTML
- **Validation:** Preview email draft

#### T22.8: Basic Automation Rules [L - 5h]
- **Description:** Rule-based automation triggers
- **Acceptance Criteria:**
  - Create `src/services/AutomationRulesService.ts`
  - Rules UI: trigger → condition → action
  - Example rules:
    - "If status=contacted for 7 days, suggest follow-up"
    - "If Tier 1, auto-schedule for priority time slot"
  - Enable/disable individual rules
  - Rule execution log
  - Safety: max 3 auto-messages per prospect per week
- **Tests:**
  - Unit test: rule evaluation returns correct action
  - Unit test: safety limit enforced
- **Validation:** Create rule, trigger, verify action

#### T22.9: Send Analytics Dashboard [M - 4h]
- **Description:** Dashboard for outreach performance
- **Acceptance Criteria:**
  - Metrics: sent, opened (if trackable), replied (manual), bounced
  - Breakdown by: channel, template, tone, time
  - Time series: sends per day (bar chart)
  - Conversion funnel: sent → replied → booked
  - Export as CSV
- **Tests:**
  - Unit test: metrics calculated correctly
  - Unit test: chart data structure valid
- **Validation:** View dashboard with test data

#### T22.10: Automation Safety Controls [M - 3h]
- **Description:** Prevent accidental mass sends
- **Acceptance Criteria:**
  - Daily send limit per channel (configurable, default 50)
  - Confirmation required for >10 messages
  - "Pause all automation" kill switch
  - Quiet hours: no sends 9pm-7am (configurable)
  - Per-prospect cooldown: 24h minimum
  - Audit log of all automated actions
- **Tests:**
  - Unit test: daily limit blocks excess
  - Unit test: quiet hours enforced
  - Unit test: cooldown enforced
- **Validation:** Attempt to exceed, verify blocks

---

## Sprint 23: Advanced Analytics Dashboard
**Goal:** Deep insights into outreach performance, prioritization, and ROI.
**Demo:** Interactive dashboard with charts, filters, goal tracking.
**Dependencies:** Sprint 22 (send data), Sprint 17 (activity data)

### Tasks

#### T23.1: Analytics Data Service [M - 4h]
- **Description:** Aggregate data for analytics
- **Acceptance Criteria:**
  - Create `src/services/AnalyticsService.ts`
  - Methods: getOutreachStats(dateRange), getConversionFunnel(), getTemplatePerformance()
  - Memoized computation
  - Date range filtering
  - Export raw data as JSON
- **Tests:**
  - Unit test: stats calculated correctly
  - Unit test: date filtering works
- **Validation:** Retrieve analytics, verify

#### T23.2: Conversion Funnel Chart [M - 4h]
- **Description:** Visual funnel showing stages
- **Acceptance Criteria:**
  - Stages: Total → Contacted → Responded → Meeting → Closed
  - Funnel chart (recharts or custom SVG)
  - Conversion rates between stages
  - Click stage to filter prospects
  - Comparison: this week vs last
- **Tests:**
  - Unit test: funnel data structure correct
  - Snapshot test: chart renders
- **Validation:** Visual inspection

#### T23.3: Activity Time Series [M - 4h]
- **Description:** Activity over time chart
- **Acceptance Criteria:**
  - Line/bar chart: messages per day
  - Stacked by channel
  - Zoom: day, week, month
  - Tooltips with exact counts
- **Tests:**
  - Unit test: data aggregated by day
  - Snapshot test: chart renders
- **Validation:** View with real data

#### T23.4: Template Performance Table [M - 3h]
- **Description:** Rank templates by effectiveness
- **Acceptance Criteria:**
  - Columns: name, uses, response rate, booking rate
  - Sort by any column
  - Highlight top performers
  - Flag underperformers
- **Tests:**
  - Unit test: performance calculated
  - Unit test: sort works
- **Validation:** Review with test data

#### T23.5: Priority Score Display [M - 3h]
- **Description:** Show prioritization score on prospects
- **Acceptance Criteria:**
  - Score 1-100 based on: tier, engagement, recency
  - Display on prospect card
  - "Hot Leads" filter: top 10%
  - Explanation tooltip
- **Tests:**
  - Unit test: score calculated
  - Unit test: filter works
- **Validation:** Review scores

#### T23.6: Meeting ROI Calculator [S - 2h]
- **Description:** Calculate ROI from booked meetings
- **Acceptance Criteria:**
  - Inputs: deal value, close rate
  - Calculate: meetings × close rate × value = pipeline
  - Display: "X meetings = $Y potential"
- **Tests:**
  - Unit test: ROI calculated
  - Unit test: handles zero
- **Validation:** Input numbers, verify

#### T23.7: Goal Tracking [M - 4h]
- **Description:** Set and track outreach goals
- **Acceptance Criteria:**
  - Goals: meetings/week, contacts/day
  - Visual progress indicator
  - Alerts: "Behind pace this week"
  - Celebration animation when met
- **Tests:**
  - Unit test: progress calculated
  - Unit test: alert triggers
- **Validation:** Set goal, track

#### T23.8: Report Export [M - 3h]
- **Description:** Generate stakeholder reports
- **Acceptance Criteria:**
  - "Weekly Summary" one-click report
  - Formats: HTML, Markdown
  - Includes: funnel, top prospects, performance
- **Tests:**
  - Unit test: report structure correct
- **Validation:** Generate, review

---

## Sprint 24: Code Splitting & Performance
**Goal:** Reduce bundle size (currently ~647KB) and improve load times.
**Demo:** Lighthouse performance ≥90, bundle <500KB.
**Dependencies:** None

### Tasks

#### T24.1: Route-Based Code Splitting [M - 4h]
- **Description:** Lazy load major sections
- **Acceptance Criteria:**
  - React.lazy() for Stats, Brain tabs
  - Suspense with skeleton fallback
  - Main bundle <300KB
  - Tab chunks <100KB each
- **Tests:**
  - Build outputs expected chunks
  - Unit test: Suspense renders fallback
- **Validation:** Network tab shows lazy loads

#### T24.2: Tree Shaking Audit [M - 3h]
- **Description:** Eliminate unused code
- **Acceptance Criteria:**
  - Add rollup-plugin-visualizer
  - Remove unused lucide-react icons (import only used)
  - Verify no duplicate deps
  - Document largest deps
- **Tests:**
  - Build size decreases
- **Validation:** Bundle analyzer report

#### T24.3: Asset Optimization [S - 2h]
- **Description:** Optimize static assets
- **Acceptance Criteria:**
  - Font subsetting if using web fonts
  - Lazy load images below fold
  - Total assets <100KB
- **Tests:**
  - Build size verified
- **Validation:** Lighthouse audit

#### T24.4: Service Worker Setup [M - 4h]
- **Description:** Add PWA capabilities
- **Acceptance Criteria:**
  - vite-plugin-pwa
  - Cache static assets
  - Offline mode shows cached data
  - Update notification
- **Tests:**
  - SW registers
  - Offline works
- **Validation:** Kill network, verify

---

## Sprint 25: E2E Testing with Playwright
**Goal:** Comprehensive E2E coverage for critical flows.
**Demo:** All E2E tests passing, CI integration.
**Dependencies:** Sprint 24 (stable build)

### Tasks

#### T25.1: Playwright Setup [M - 3h]
- **Description:** Install and configure Playwright
- **Acceptance Criteria:**
  - playwright.config.ts
  - Browsers: chromium, firefox, webkit
  - npm scripts: test:e2e, test:e2e:headed
  - Screenshot on failure
  - CI config (GitHub Actions)
- **Tests:**
  - Sample test passes
- **Validation:** `npm run test:e2e`

#### T25.2: Core Flow Tests [L - 6h]
- **Description:** Test critical user journeys
- **Acceptance Criteria:**
  - Flow 1: Select prospect → Generate → Copy
  - Flow 2: Search → Filter → Select → Status change
  - Flow 3: AI Brain conversation
  - Flow 4: Settings → API key → Save
  - Happy path + error cases
- **Tests:**
  - All flow tests passing
- **Validation:** Watch headed mode

#### T25.3: Mobile E2E Tests [M - 4h]
- **Description:** Test mobile interactions
- **Acceptance Criteria:**
  - Hamburger menu open/close
  - Touch targets verified
  - Mobile viewport sizes
  - Orientation changes
- **Tests:**
  - Mobile tests pass
- **Validation:** Test recordings

#### T25.4: Visual Regression [M - 4h]
- **Description:** Detect visual changes
- **Acceptance Criteria:**
  - Screenshot key states
  - Compare against baseline
  - 0.1% threshold
  - Update process documented
- **Tests:**
  - No unexpected changes
- **Validation:** Intentional change detected

---

## Technical Debt & Maintenance

### Known Issues
1. **Bundle Size:** ~647KB (target <500KB) → Sprint 24
2. **App.tsx:** 1248 lines, needs extraction
3. **No E2E Tests:** Only unit tests → Sprint 25
4. **Hardcoded Templates:** Should be database-driven
5. **No Error Boundary:** Need global error handling

### Refactoring Backlog
- [ ] Extract: ProspectList, ProspectDetail, MessageEditor components
- [ ] Create: useProspect, useChat, useAuth hooks
- [ ] Add: React Query for data fetching (if complexity grows)
- [ ] Add: Global error boundary
- [ ] Move: templates to Firestore for dynamic updates

---

## Security Checklist

- [ ] API keys encrypted in localStorage (T21.0)
- [ ] Firestore security rules deployed (T22.0)
- [ ] No secrets in frontend code
- [ ] OAuth tokens have expiry
- [ ] CSP headers configured
- [ ] HTTPS enforced (Vercel default)

---

## Appendix: API Requirements

### Twitter/X
- **Required:** API access ($100/mo Basic minimum)
- **OAuth:** 2.0 with PKCE
- **Scopes:** tweet.read, dm.write, users.read
- **Limits:** 1000 DMs/day, 100 tweets/15min

### LinkedIn  
- **Required:** LinkedIn Developer App
- **OAuth:** 2.0
- **Scopes:** r_liteprofile, w_member_social
- **Limits:** Very restrictive, no DM API without Sales Navigator

### Manifest App
- **Status:** Unknown - research required
- **Fallback:** Copy-to-clipboard workflow

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Meetings Booked | 0 | 50+ at Manifest |
| Time to First Message | ~5 min | <1 min |
| Test Coverage | ~40% | >80% |
| Lighthouse Performance | Unknown | >90 |
| Bundle Size | 647KB | <500KB |

---

## Changelog

- **V3 (Final):** Incorporated subagent review feedback
  - Split large tasks (T18.5, T21.0 added)
  - Added security tasks (T21.0, T22.0)
  - Reordered priority (Sprint 20 before 21)
  - Added task dependency graphs
  - Added time estimates (S/M/L)
  - Removed risky swipe gestures task
  - Added API limitations documentation
  - Enhanced testability criteria

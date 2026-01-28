# YardFlow GTM Hub - Sprint & Task Breakdown

## Project Overview
YardFlow Hub is a React/TypeScript SPA for the Manifest 2026 conference GTM strategy. It provides prospect management, AI-powered message generation, and team collaboration features.

**Tech Stack:** Vite + React 18 + TypeScript + Tailwind CSS + Firebase (Auth/Firestore) + Gemini AI

**Current Status:** ✅ Deployed at https://gtm-yard-flow.vercel.app

---

## Priority Matrix

| Sprint | Goal | Impact | Effort | Priority |
|--------|------|--------|--------|----------|
| Sprint 0-9 | Foundation & Core Features | High | High | ✅ Complete |
| Sprint 10 | AI Memory & Context | High | Medium | 🔴 Critical |
| Sprint 11 | Dynamic Templates | High | Medium | 🔴 Critical |
| Sprint 12 | Testing Infrastructure | High | High | 🟡 Important |
| Sprint 13 | Accessibility | High | Medium | 🔴 Critical |
| Sprint 14 | Mobile Responsiveness | Medium | High | 🟡 Important |
| Sprint 15 | Data Export/Import | Medium | Medium | 🟢 Nice-to-have |
| Sprint 16 | Advanced Analytics | Medium | Medium | 🟢 Nice-to-have |
| Sprint 17 | Collaboration Features | High | High | 🟡 Important |

**Recommended Order:** 10 → 11 → 13 → 12 → 14 → 17 → 15 → 16

---

## Sprint 0: Project Foundation & Infrastructure
**Goal:** Deployable skeleton app with CI/CD pipeline, dev environment, and core configuration.

### Tasks

#### T0.1: Initialize Vite React TypeScript Project
- **Description:** Scaffold Vite project with React and TypeScript template
- **Acceptance Criteria:**
  - `npm create vite@latest . -- --template react-ts` executed
  - `npm run dev` starts local dev server on port 5173
  - `npm run build` produces `dist/` with `index.html`
- **Validation:** `curl localhost:5173` returns HTML with `<div id="root">`

#### T0.2: Configure Tailwind CSS
- **Description:** Install and configure Tailwind with PostCSS
- **Acceptance Criteria:**
  - `tailwind.config.js` exists with content paths for `./src/**/*.{ts,tsx}`
  - `postcss.config.js` configured
  - `src/index.css` contains `@tailwind base/components/utilities`
  - Sample Tailwind class (`bg-blue-500`) renders correctly
- **Validation:** Visual inspection of colored element in browser

#### T0.3: Configure TypeScript Strict Mode
- **Description:** Enable strict TypeScript configuration
- **Acceptance Criteria:**
  - `tsconfig.json` has `"strict": true`
  - `"noUnusedLocals": true`, `"noUnusedParameters": true`
  - `npm run build` passes with zero type errors
- **Validation:** `tsc --noEmit` exits with code 0

#### T0.4: Create Vercel Deployment Configuration
- **Description:** Add `vercel.json` for SPA routing and build settings
- **Acceptance Criteria:**
  - `vercel.json` specifies `outputDirectory: "dist"`
  - `buildCommand: "npm run build"`
  - SPA rewrite rule: `/(.*) -> /`
- **Validation:** `vercel --prod` deploys successfully; deep links don't 404

#### T0.5: Setup Environment Variable Structure
- **Description:** Create `.env.example` and TypeScript types for env vars
- **Acceptance Criteria:**
  - `.env.example` documents all `VITE_*` variables
  - `src/vite-env.d.ts` declares `ImportMetaEnv` interface
  - `.gitignore` excludes `.env`, `.env.local`
- **Validation:** `import.meta.env.VITE_*` has TypeScript autocomplete

#### T0.6: Setup Git Repository & Branch Protection
- **Description:** Initialize git, create `.gitignore`, push to GitHub
- **Acceptance Criteria:**
  - `.gitignore` excludes `node_modules/`, `dist/`, `.env*`, `.vercel/`
  - Initial commit pushed to `main`
  - README.md with project description
- **Validation:** `git log` shows initial commit; GitHub repo accessible

---

## Sprint 1: Core UI Shell & Navigation
**Goal:** Functional app shell with sidebar, tabs, and responsive layout.

### Tasks

#### T1.1: Create App Layout Component
- **Description:** Implement main flex layout with sidebar and content area
- **Acceptance Criteria:**
  - Root div uses `flex h-screen`
  - Sidebar is fixed 320px width (`w-80`)
  - Main content area is `flex-1`
  - No horizontal scroll on viewport
- **Validation:** Visual inspection; resize browser confirms no overflow

#### T1.2: Implement Sidebar Header with Logo
- **Description:** Create branded header with YardFlow logo and settings button
- **Acceptance Criteria:**
  - Logo uses `Zap` icon from lucide-react in blue container
  - "YardFlow Hub" text with "Hub" in blue accent
  - Settings gear icon button (non-functional placeholder)
- **Validation:** Screenshot matches design spec

#### T1.3: Create Tab Navigation Component
- **Description:** Implement 3-tab navigation (Targets, Stats, Brain)
- **Acceptance Criteria:**
  - Tabs render as segmented control in `bg-slate-100`
  - Active tab has white background, shadow, blue text
  - Icons: `Users`, `BarChart2`, `Bot` from lucide-react
  - State managed with `useState<'prospects' | 'stats' | 'assistant'>`
- **Validation:** Click each tab → activeTab state changes → correct styling applied

#### T1.4: Implement Conditional Content Rendering
- **Description:** Render different content based on active tab
- **Acceptance Criteria:**
  - `activeTab === 'prospects'` renders prospect list placeholder
  - `activeTab === 'stats'` renders stats dashboard placeholder
  - `activeTab === 'assistant'` renders AI chat placeholder
  - No content flash on tab switch
- **Validation:** Tab clicks show correct placeholder content immediately

#### T1.5: Create Loading State Component
- **Description:** Implement full-screen loading indicator
- **Acceptance Criteria:**
  - Centered "Loading War Room..." text
  - `bg-slate-50` background
  - Shown when `loading === true`
- **Validation:** Set `loading: true` in DevTools → loading screen visible

---

## Sprint 2: Prospect Data Layer & List View
**Goal:** Display prospect list with filtering, sorting, and status indicators.

### Tasks

#### T2.1: Define TypeScript Interfaces for Domain Models
- **Description:** Create type definitions for Prospect, MessageTemplate, ChatMessage
- **Acceptance Criteria:**
  - `Prospect` interface with: id, name, title, company, tier, score, isOps, isExec, status, notes?, lastEditedBy?
  - `status` is union type: `'new' | 'drafted' | 'contacted' | 'meeting_booked'`
  - Interfaces exported from `src/types.ts` or defined in `App.tsx`
- **Validation:** TypeScript compiler accepts interfaces; IntelliSense works

#### T2.2: Create Initial Seed Data
- **Description:** Define `INITIAL_PROSPECTS` array with 8 sample prospects
- **Acceptance Criteria:**
  - Array typed as `Prospect[]`
  - Mix of Tier 1 and Tier 2 prospects
  - Various `isOps`/`isExec` combinations
  - All start with `status: 'new'`
- **Validation:** `prospects.length === 8`; TypeScript validates all fields

#### T2.3: Implement Prospect List Item Component
- **Description:** Create clickable list item for each prospect
- **Acceptance Criteria:**
  - Shows name (bold), title (muted), company with Briefcase icon
  - Status badge with color coding (getStatusColor helper)
  - Tier 1 indicator: orange dot with ring
  - Selected state: `bg-blue-50/50`, name in blue
  - Hover state: `bg-slate-50`
- **Validation:** Click prospect → `selectedProspect` state updates; visual states correct

#### T2.4: Implement Search Filter
- **Description:** Add search input that filters by name or company
- **Acceptance Criteria:**
  - Search icon inside input field
  - Filters `prospects` array on input change
  - Case-insensitive matching
  - Uses `useMemo` for performance
- **Validation:** Type "GXO" → only GXO prospect visible; clear → all visible

#### T2.5: Implement Tier Filter Buttons
- **Description:** Add filter buttons for All, Tier 1, Tier 2
- **Acceptance Criteria:**
  - Three buttons in horizontal scroll container
  - Active filter has blue background/border
  - Filters combine with search (AND logic)
  - State: `tierFilter: 'All' | 'Tier 1' | 'Tier 2'`
- **Validation:** Click "Tier 1" → only Tier 1 prospects shown; combined with search works

#### T2.6: Implement Prospect Sorting
- **Description:** Sort prospects by score descending
- **Acceptance Criteria:**
  - `filteredProspects` sorted by `score` descending
  - Sorting happens after filtering
  - Highest score prospect appears first
- **Validation:** Inspect list order matches `sort((a,b) => b.score - a.score)`

#### T2.7: Display Prospect Count Footer
- **Description:** Add footer showing filtered prospect count
- **Acceptance Criteria:**
  - Text: `"{n} Targets Loaded"`
  - Updates dynamically with filter changes
  - Only visible on prospects tab
- **Validation:** Apply filters → count updates correctly

---

## Sprint 3: Prospect Detail View & Message Templates
**Goal:** Display prospect details with template-based message generation.

### Tasks

#### T3.1: Create Empty State for No Selection
- **Description:** Show placeholder when no prospect is selected
- **Acceptance Criteria:**
  - Centered Users icon in gray circle
  - "Select a target to start outreach" heading
  - Descriptive subtext
  - Only shown when `selectedProspect === null`
- **Validation:** Page load shows empty state; click prospect hides it

#### T3.2: Implement Prospect Header Component
- **Description:** Display selected prospect details in header
- **Acceptance Criteria:**
  - Large name heading
  - Title and company inline
  - Tier 1 badge (orange) if applicable
  - Ops Leader badge (blue) if `isOps`
  - Hitlist Score display
- **Validation:** Select Tier 1 Ops prospect → both badges visible

#### T3.3: Create Status Toggle Component
- **Description:** Segmented control for prospect status updates
- **Acceptance Criteria:**
  - Three buttons: New (Users), Sent (Send), Booked (CheckCircle)
  - Active status has white background, shadow
  - Clicking updates `selectedProspect.status`
  - Updates `prospects` array state
- **Validation:** Click "Booked" → status updates; list item badge changes color

#### T3.4: Define Message Templates Function
- **Description:** Create `TEMPLATES` function generating prospect-specific messages
- **Acceptance Criteria:**
  - Function takes `(prospect: Prospect, senderName: string)`
  - Returns array of `MessageTemplate[]`
  - 3 short DMs (type: 'short_dm') + 1 email (type: 'codev')
  - Templates interpolate prospect first name and company
- **Validation:** Call with prospect → templates contain prospect.name and prospect.company

#### T3.5: Implement Template Selection UI
- **Description:** Display template buttons grouped by type
- **Acceptance Criteria:**
  - "Manifest App DMs (Max 250)" section header
  - "Long Form (Email)" section header
  - Selected template has blue border
  - Co-Dev template shows Zap icon
  - Template preview text (2 lines, truncated)
- **Validation:** Click template → `selectedTemplateId` updates; border style changes

#### T3.6: Create Message Editor Component
- **Description:** Editable textarea with character counter
- **Acceptance Criteria:**
  - Textarea displays current template body
  - Editable; changes update `generatedMessage` state
  - Character count: `{n}/250 chars`
  - Reset button restores greeting prefix
- **Validation:** Edit text → char count updates; click Reset → message resets

#### T3.7: Implement Character Limit Indicator
- **Description:** Visual progress bar and over-limit warning
- **Acceptance Criteria:**
  - Progress bar fills based on `charCount / 250`
  - Blue under 200, orange 200-250, red over 250
  - "Over Limit" badge with AlertCircle icon when >250
  - Border turns red when over limit
- **Validation:** Type past 250 chars → all warning states activate

#### T3.8: Implement Copy to Clipboard
- **Description:** Copy button with success feedback
- **Acceptance Criteria:**
  - "Copy for App" button with MessageSquare icon
  - Copies `generatedMessage` to clipboard
  - Button changes to "Copied!" (green) for 2 seconds
  - Auto-updates status to 'drafted'
- **Validation:** Click copy → paste in external app confirms text; button animates

#### T3.9: Create Talking Points Context Box
- **Description:** Info box with messaging guidance
- **Acceptance Criteria:**
  - Blue background box below editor
  - "Talking Points Logic" header
  - Ops and Exec messaging tips
- **Validation:** Visual inspection matches design

---

## Sprint 4: Sender Selection & Co-Dev Potential
**Goal:** Multi-user sender selection and prospect prioritization display.

### Tasks

#### T4.1: Implement Sender Toggle
- **Description:** Toggle between "Me" and "Jake" as message sender
- **Acceptance Criteria:**
  - Segmented control with "Me" and "Jake" buttons
  - State: `currentUser: 'Jake' | 'Me'`
  - Active sender has blue background
  - Only visible on prospects tab
- **Validation:** Toggle sender → UI updates; affects template generation

#### T4.2: Update Templates with Sender Name
- **Description:** Templates use sender name in signature
- **Acceptance Criteria:**
  - "Me" → signature is "The YardFlow Team"
  - "Jake" → signature is "Jake"
  - Template body updates when sender changes
- **Validation:** Switch sender → message signature changes

#### T4.3: Display Co-Dev Potential Badge
- **Description:** Show priority indicator in prospect header
- **Acceptance Criteria:**
  - Tier 1: "High Priority" with Zap icon, green styling
  - Tier 2: "Standard Outreach" with gray styling
  - Positioned top-right of header
- **Validation:** Select Tier 1 vs Tier 2 prospects → correct badge shown

#### T4.4: Indicate Remote Edits from Other User
- **Description:** Show indicator when prospect was edited by other user
- **Acceptance Criteria:**
  - Blue pulsing dot on list item
  - Only shows if `lastEditedBy !== currentUser` AND `status !== 'new'`
  - Tooltip shows "Updated by {name}"
- **Validation:** Simulate `lastEditedBy: 'Jake'` when `currentUser: 'Me'` → dot visible

---

## Sprint 5: Stats Dashboard
**Goal:** Analytics view with key metrics and progress indicators.

### Tasks

#### T5.1: Create Stats Tab Layout
- **Description:** Layout for stats dashboard with card grid
- **Acceptance Criteria:**
  - Full sidebar width usage
  - Vertical spacing between cards
  - Renders when `activeTab === 'stats'`
- **Validation:** Click Stats tab → layout visible

#### T5.2: Implement Total Booked Hero Card
- **Description:** Large gradient card showing meetings booked
- **Acceptance Criteria:**
  - Blue-to-indigo gradient background
  - Large number (4xl) showing `stats.booked`
  - "Total Booked" label, "Meetings confirmed" subtext
- **Validation:** Book a meeting (change status) → count increments

#### T5.3: Create Contacted Progress Card
- **Description:** Card with progress bar for contacted prospects
- **Acceptance Criteria:**
  - Shows `stats.contacted` count
  - Progress bar: `(contacted / total) * 100%` width
  - Green progress bar color
- **Validation:** Contact prospects → bar fills proportionally

#### T5.4: Create Remaining Count Card
- **Description:** Simple card showing remaining prospects
- **Acceptance Criteria:**
  - Shows `stats.total - stats.contacted`
  - Updates as prospects are contacted
- **Validation:** Contact prospect → remaining decreases by 1

#### T5.5: Create Tier 1 Progress Alert
- **Description:** Highlighted box for Tier 1 focus
- **Acceptance Criteria:**
  - Orange background with border
  - Zap icon
  - Shows `stats.tier1` count
  - Guidance text about Co-Dev conversion
- **Validation:** Inspect → tier1 count matches Tier 1 prospects

#### T5.6: Implement Stats Calculation with useMemo
- **Description:** Memoized stats computation
- **Acceptance Criteria:**
  - `stats` object calculated via `useMemo`
  - Dependencies: `[prospects]`
  - Contains: total, contacted, booked, tier1
- **Validation:** DevTools profiler → no recalculation on unrelated state changes

---

## Sprint 6: AI Assistant (Brain) Tab
**Goal:** Chat interface with Gemini AI integration.

### Tasks

#### T6.1: Create Brain Tab Info Panel
- **Description:** Sidebar info when Brain tab is active
- **Acceptance Criteria:**
  - Bot icon in blue circle
  - "Connected to YardFlow Strategy Brain" text
  - Context info: "RFQ Deck, Hitlist Logic, Manifest Outreach Doc"
- **Validation:** Click Brain tab → info panel visible in sidebar

#### T6.2: Define BRAIN_CONTEXT System Prompt
- **Description:** Create comprehensive AI context string
- **Acceptance Criteria:**
  - Defines assistant role and mission
  - Documents core concepts: Reynolds Number, Earnings Stability, Co-Dev
  - Specifies targeting logic for Tier 1/2 and Ops/Exec
  - Notes 250 char constraint and tone guidelines
- **Validation:** String is >500 chars; covers all domain concepts

#### T6.3: Create Chat Message List Component
- **Description:** Scrollable list of chat messages
- **Acceptance Criteria:**
  - User messages: right-aligned, blue background, rounded-br-none
  - Bot messages: left-aligned, white background, border, rounded-bl-none
  - Auto-scroll to bottom on new message (useRef + scrollIntoView)
  - Initial bot greeting message
- **Validation:** Send messages → alternating layout; scroll follows

#### T6.4: Create Chat Input Component
- **Description:** Input field with send button
- **Acceptance Criteria:**
  - Full-width input with rounded-full styling
  - Send button (Send icon) inside input, right side
  - Enter key triggers send
  - Disabled while `isGenerating`
- **Validation:** Type message, press Enter → message sends; disabled during generation

#### T6.5: Implement Gemini API Integration
- **Description:** Connect to Gemini API for chat responses
- **Acceptance Criteria:**
  - POST to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent`
  - Includes `systemInstruction` with BRAIN_CONTEXT
  - API key from localStorage (`yardflow_gemini_key`)
  - Parses response: `data.candidates[0].content.parts[0].text`
- **Validation:** Send question → receive contextually relevant response

#### T6.6: Handle Missing API Key
- **Description:** Graceful error when no API key configured
- **Acceptance Criteria:**
  - If `!geminiApiKey`, add error message to chat
  - Message: "⚠️ Please enter your Gemini API Key in Settings..."
  - Does not make network request
- **Validation:** Clear API key → send message → error message appears

#### T6.7: Implement Generation Loading State
- **Description:** Show loading indicator during API call
- **Acceptance Criteria:**
  - `isGenerating` state set true during fetch
  - Loader icon with spin animation
  - "Brain is thinking..." text
  - Input disabled during generation
- **Validation:** Send message → loader visible until response arrives

#### T6.8: Handle API Errors Gracefully
- **Description:** Display error message on API failure
- **Acceptance Criteria:**
  - Try/catch around fetch
  - Error message added to chat history
  - "Error connecting to Gemini. Check your API key."
  - `isGenerating` set to false on error
- **Validation:** Use invalid API key → error message appears; UI recovers

---

## Sprint 7: Settings Modal & API Key Management
**Goal:** User-configurable settings with secure API key storage.

### Tasks

#### T7.1: Create Settings Modal Component
- **Description:** Modal overlay for settings
- **Acceptance Criteria:**
  - Triggered by Settings icon click
  - Centered white card over backdrop blur
  - Header with Settings icon and "Settings" text
  - "Done" button closes modal
- **Validation:** Click gear → modal opens; click Done → modal closes

#### T7.2: Implement API Key Input
- **Description:** Password input for Gemini API key
- **Acceptance Criteria:**
  - `type="password"` input
  - Label: "Gemini API Key"
  - Placeholder: "Paste AI Studio Key here..."
  - Value bound to `geminiApiKey` state
- **Validation:** Paste key → value visible as dots; state updates

#### T7.3: Persist API Key to localStorage
- **Description:** Save and load API key from localStorage
- **Acceptance Criteria:**
  - On input change: `localStorage.setItem('yardflow_gemini_key', key)`
  - On mount: load from localStorage if exists
  - Key survives page refresh
- **Validation:** Enter key → refresh page → key still present

#### T7.4: Toggle Modal with State
- **Description:** Manage modal visibility state
- **Acceptance Criteria:**
  - `showSettings: boolean` state
  - Settings button sets `showSettings: true`
  - Done button sets `showSettings: false`
  - Click outside modal could close (optional enhancement)
- **Validation:** State toggles correctly; modal visibility follows state

---

## Sprint 8: Firebase Integration
**Goal:** Real-time data sync with Firestore and anonymous authentication.

### Tasks

#### T8.1: Configure Firebase App Initialization
- **Description:** Initialize Firebase from environment variables
- **Acceptance Criteria:**
  - Read config from `import.meta.env.VITE_FIREBASE_*`
  - Conditional init: only if `apiKey && projectId` exist
  - Export `app`, `auth`, `db` (or null if unconfigured)
- **Validation:** Console shows Firebase initialized; no crash if env vars missing

#### T8.2: Implement Anonymous Authentication
- **Description:** Sign in anonymously on app load
- **Acceptance Criteria:**
  - Call `signInAnonymously(auth)` in useEffect
  - Set `user` state via `onAuthStateChanged`
  - Set `loading: false` after auth resolves
  - Handle auth errors gracefully
- **Validation:** DevTools Network shows auth request; `user` state populated

#### T8.3: Setup Firestore Collection Structure
- **Description:** Define Firestore document schema
- **Acceptance Criteria:**
  - Path: `artifacts/{appId}/public/data/prospects/{docId}`
  - Document fields: originalId, status, lastEditedBy, updatedAt, name
  - `docId` format: `prospect_{originalId}`
- **Validation:** Firebase Console shows correct structure after write

#### T8.4: Implement Real-time Prospect Sync
- **Description:** Subscribe to Firestore changes with onSnapshot
- **Acceptance Criteria:**
  - `onSnapshot` listener on prospects collection
  - Merge remote status/notes/lastEditedBy with local seed data
  - Unsubscribe on component unmount
  - Handle snapshot errors
- **Validation:** Change status in Firebase Console → UI updates without refresh

#### T8.5: Persist Status Changes to Firestore
- **Description:** Write status updates to Firestore
- **Acceptance Criteria:**
  - `handleStatusUpdate` calls `setDoc` with merge
  - Includes: originalId, status, lastEditedBy, updatedAt, name
  - Updates both local state and Firestore
  - Works without Firebase (local-only mode)
- **Validation:** Change status → Firebase Console shows document update

#### T8.6: Handle Firebase Unavailable Gracefully
- **Description:** App works without Firebase configuration
- **Acceptance Criteria:**
  - If `!db`, skip Firestore operations
  - Local state changes still work
  - No console errors when Firebase unconfigured
  - User can still use all features locally
- **Validation:** Remove env vars → app still functional; no crashes

---

## Sprint 9: Polish & Production Readiness
**Goal:** Final polish, error handling, and deployment verification.

### Tasks

#### T9.1: Add README.md with Setup Instructions
- **Description:** Documentation for running and deploying
- **Acceptance Criteria:**
  - Project description
  - Local development setup steps
  - Environment variable documentation
  - Vercel deployment instructions
  - Firebase setup guide
- **Validation:** New developer can follow README to run locally

#### T9.2: Verify Production Build
- **Description:** Ensure production build works correctly
- **Acceptance Criteria:**
  - `npm run build` succeeds with no errors
  - `npm run preview` serves working app
  - All features work in production build
  - No console errors in production mode
- **Validation:** Run preview → all features functional

#### T9.3: Test Responsive Behavior
- **Description:** Verify layout at different viewport sizes
- **Acceptance Criteria:**
  - Desktop (1920px): full layout visible
  - Laptop (1280px): no horizontal scroll
  - Tablet (768px): acceptable layout (may need responsive fixes)
  - Document any required responsive improvements
- **Validation:** Browser DevTools device emulation → no broken layouts

#### T9.4: Verify Vercel Deployment Pipeline
- **Description:** Confirm GitHub → Vercel auto-deploy works
- **Acceptance Criteria:**
  - Push to `main` triggers Vercel build
  - Build completes successfully
  - Production URL loads app
  - No 404 errors on any routes
- **Validation:** Push commit → Vercel shows deployment → site accessible

#### T9.5: Add Error Boundary
- **Description:** Catch and display React errors gracefully
- **Acceptance Criteria:**
  - ErrorBoundary component wraps App
  - Shows user-friendly error message on crash
  - Logs error details to console
  - Recovery option (refresh page)
- **Validation:** Force error → error boundary catches; no white screen

---

## Definition of Done (All Tasks)
- [ ] Code compiles with zero TypeScript errors
- [ ] Feature works as described in acceptance criteria
- [ ] No console errors or warnings
- [ ] Code follows existing patterns and conventions
- [ ] Changes are atomic and committable

## Sprint Demo Checklist
- [ ] All sprint tasks completed
- [ ] App builds successfully (`npm run build`)
- [ ] App runs locally (`npm run dev`)
- [ ] New features are demonstrable
- [ ] No regressions in existing features
---

## Sprint 10: Enhanced AI Brain with Conversation Memory
**Goal:** Transform the Brain from a stateless assistant to a context-aware partner with memory.

**Demo Deliverable:** AI assistant that remembers conversation context, references selected prospects, and provides contextually relevant responses.

### Tasks

#### T10.1: Create Conversation Context Manager
- **Description:** Service class to manage conversation state and context building
- **Acceptance Criteria:**
  - New file: `src/services/ConversationManager.ts`
  - Class with methods: `addMessage()`, `getHistory()`, `clearHistory()`, `buildContext()`
  - Stores: messages array, prospect context, user preferences
  - Exports singleton instance
- **Validation:** Unit test: add messages → getHistory returns them in order

#### T10.2: Implement Rolling Context Window
- **Description:** Limit conversation history to prevent token overflow
- **Acceptance Criteria:**
  - Maximum 30 messages in context (configurable)
  - Older messages summarized by AI when limit reached
  - Summary injected as first message: "Previous conversation summary: ..."
  - Token count estimation: ~4 chars per token, max 8000 tokens for context
- **Validation:** Send 35 messages → first 5 summarized; API call succeeds

#### T10.3: Build Dynamic System Prompt Generator
- **Description:** Generate context-aware system prompts based on current state
- **Acceptance Criteria:**
  - New function: `buildSystemPrompt(options: { prospect?, stats?, recentActions? })`
  - Includes base `BRAIN_CONTEXT`
  - Appends: selected prospect details, current stats, recent status changes
  - Format: structured sections with clear headers
- **Validation:** Call with prospect → prompt includes prospect JSON

#### T10.4: Inject Prospect Context into AI Calls
- **Description:** Automatically include selected prospect in AI requests
- **Acceptance Criteria:**
  - If `selectedProspect`, add to system prompt: "Currently viewing: {prospect details}"
  - Include: all prospect fields, current status, tier implications
  - Add instruction: "Reference this prospect when drafting messages or giving advice"
- **Validation:** Select prospect → ask "What should I say?" → response mentions prospect name

#### T10.5: Pass Conversation History to Gemini API
- **Description:** Include full conversation in API requests for context
- **Acceptance Criteria:**
  - API request includes `contents` array with all previous messages
  - Each message formatted as `{ role: 'user' | 'model', parts: [{ text }] }`
  - Maximum 20 messages to prevent token overflow
  - System instruction remains separate from conversation history
- **Validation:** Ask "What did I just ask?" → AI recalls previous question

#### T10.6: Add Recent Activity Context
- **Description:** Include recent user actions in AI context
- **Acceptance Criteria:**
  - Track last 5 status changes: `{ prospectId, from, to, timestamp }`
  - Include in system prompt: "Recent actions: ..."
  - Helps AI understand user workflow
- **Validation:** Change 3 statuses → ask AI "What have I done today?" → lists changes

#### T10.7: Implement Chat History Persistence
- **Description:** Save and restore chat history across sessions
- **Acceptance Criteria:**
  - Save to localStorage on each new message
  - Key: `yardflow_chat_history`
  - Load on component mount
  - "Clear Chat" button in Brain tab header
- **Validation:** Send messages → refresh → messages persist; clear → messages gone

#### T10.8: Add Conversation Export
- **Description:** Export chat history as markdown or JSON
- **Acceptance Criteria:**
  - "Export Chat" button with Download icon
  - Formats: `.md` (human-readable) or `.json` (machine-readable)
  - Filename includes timestamp: `yardflow-chat-2026-01-27.md`
  - Triggers browser download
- **Validation:** Click export → file downloads; content matches chat

---

## Sprint 11: AI-Powered Dynamic Template Generation
**Goal:** Replace static templates with AI-generated, prospect-specific messages.

**Demo Deliverable:** Click "Generate with AI" → receive personalized, contextual message drafts for any prospect.

### Tasks

#### T11.1: Create Template Generation Service
- **Description:** Service for generating templates via Gemini API
- **Acceptance Criteria:**
  - New file: `src/services/TemplateGenerator.ts`
  - Function: `generateTemplate(prospect, templateType, constraints)`
  - Returns: `Promise<MessageTemplate>`
  - Handles errors gracefully
- **Validation:** Call with prospect → returns valid template

#### T11.2: Define Template Generation Prompts
- **Description:** Create specialized prompts for each template type
- **Acceptance Criteria:**
  - Prompt for short DM (250 char limit enforced in prompt)
  - Prompt for Co-Dev invitation email
  - Prompt for Ops-focused message
  - Prompt for Exec-focused message
  - Each prompt references BRAIN_CONTEXT
- **Validation:** Review prompts → each mentions constraints

#### T11.3: Add "Generate with AI" Button to Template UI
- **Description:** Button to request AI-generated template
- **Acceptance Criteria:**
  - Button with Sparkles icon next to template selector
  - Disabled if no API key or no prospect selected
  - Loading state with spinner during generation
  - Error toast if generation fails
- **Validation:** Click → loading → template appears in editor

#### T11.4: Implement Template Regeneration
- **Description:** Allow regenerating template with feedback
- **Acceptance Criteria:**
  - "Regenerate" button with RefreshCw icon
  - Optional feedback input: "Make it more casual"
  - Feedback appended to generation prompt
  - Previous attempt shown for comparison
- **Validation:** Generate → provide feedback → new version differs

#### T11.5: Add Template Variation Generator
- **Description:** Generate multiple template variations at once
- **Acceptance Criteria:**
  - "Generate 3 Variations" option
  - Parallel API calls with different temperature settings (0.7, 0.9, 1.1)
  - Display as tabs: "Version A", "Version B", "Version C"
  - User selects preferred version
- **Validation:** Click → 3 variations appear; selection updates editor

#### T11.6: Implement Template Caching
- **Description:** Cache generated templates to reduce API calls
- **Acceptance Criteria:**
  - Cache key: `${prospectId}_${templateType}_${timestamp}`
  - Cache expires after 1 hour
  - Stored in localStorage
  - "Use cached" indicator on template button
- **Validation:** Generate → close → reopen → cached version available

#### T11.7: Add Template Quality Scoring
- **Description:** AI self-evaluation of generated templates
- **Acceptance Criteria:**
  - After generation, request AI score (1-10) with reasoning
  - Display score badge on template
  - Criteria: tone match, length compliance, personalization depth
  - Auto-regenerate if score < 6
- **Validation:** Generate low-quality template → auto-regenerates

#### T11.8: Preserve Static Templates as Fallback
- **Description:** Keep original templates as non-AI options
- **Acceptance Criteria:**
  - Toggle: "AI Templates" vs "Classic Templates"
  - Classic templates always available without API key
  - User preference saved to localStorage
- **Validation:** Disable AI toggle → static templates shown

---

## Sprint 12: Testing Infrastructure
**Goal:** Establish comprehensive testing with unit, integration, and e2e coverage.

**Demo Deliverable:** `npm test` runs full test suite with >70% coverage; CI blocks PRs with failing tests.

### Tasks

#### T12.1: Setup Vitest for Unit Testing
- **Description:** Configure Vitest with React Testing Library
- **Acceptance Criteria:**
  - Install: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
  - `vitest.config.ts` with jsdom environment
  - Add npm script: `"test": "vitest"`, `"test:ui": "vitest --ui"`
  - Sample test passes: `expect(true).toBe(true)`
- **Validation:** `npm test` runs without errors

#### T12.2: Create Test Utilities and Mocks
- **Description:** Shared test utilities and mock factories
- **Acceptance Criteria:**
  - `src/__tests__/utils/renderWithProviders.tsx` - custom render with context
  - `src/__tests__/mocks/prospects.ts` - mock prospect data
  - `src/__tests__/mocks/firebase.ts` - Firebase mock
  - `src/__tests__/mocks/gemini.ts` - Gemini API mock
- **Validation:** Mocks import without errors; types are correct

#### T12.3: Write Unit Tests for Utility Functions
- **Description:** Test pure functions and helpers
- **Acceptance Criteria:**
  - Test `getStatusColor`: all status values return correct classes
  - Test `TEMPLATES`: returns correct number of templates
  - Test `filteredProspects` logic: filters and sorts correctly
  - Test `stats` calculation: correct counts
  - Minimum 90% coverage for utility functions
- **Validation:** `npm test -- --coverage` shows >90% for utils

#### T12.4: Write Component Unit Tests
- **Description:** Test React components in isolation
- **Acceptance Criteria:**
  - Test prospect list item: renders name, company, badges
  - Test status toggle: clicking updates status
  - Test search input: filters list
  - Test template selector: clicking changes selected
  - Test character counter: shows correct count, changes color
- **Validation:** All component tests pass

#### T12.5: Setup Playwright for E2E Testing
- **Description:** Configure Playwright for end-to-end tests
- **Acceptance Criteria:**
  - Install: `@playwright/test`
  - `playwright.config.ts` configured for local dev server
  - Add npm script: `"test:e2e": "playwright test"`
  - GitHub Actions workflow for E2E tests
- **Validation:** `npm run test:e2e` runs sample test

#### T12.6: Write E2E Test: Prospect Selection Flow
- **Description:** Test selecting prospect and viewing details
- **Acceptance Criteria:**
  - Navigate to app
  - Click on prospect in list
  - Verify detail panel shows prospect info
  - Verify template is loaded
  - Test runs in < 10 seconds
- **Validation:** E2E test passes in CI

#### T12.7: Write E2E Test: Status Update Flow
- **Description:** Test updating prospect status
- **Acceptance Criteria:**
  - Select prospect
  - Click "Sent" status button
  - Verify status badge updates in list
  - Verify stats tab reflects change
- **Validation:** E2E test passes

#### T12.8: Write E2E Test: AI Chat Flow
- **Description:** Test AI assistant interaction (mocked API)
- **Acceptance Criteria:**
  - Navigate to Brain tab
  - Enter message in chat
  - Verify message appears in history
  - Mock API response
  - Verify bot response appears
- **Validation:** E2E test passes with mocked Gemini

#### T12.9: Add Test Coverage Reporting
- **Description:** Generate and track coverage reports
- **Acceptance Criteria:**
  - Coverage report generated in `coverage/` directory
  - HTML report viewable locally
  - Coverage badge in README
  - Minimum thresholds: 70% statements, 60% branches
- **Validation:** `npm test -- --coverage` generates report

#### T12.10: Add Pre-commit Test Hook
- **Description:** Run tests before allowing commits
- **Acceptance Criteria:**
  - Install: `husky`, `lint-staged`
  - Pre-commit hook runs `npm test -- --run`
  - Failed tests block commit
  - Optional skip with `--no-verify`
- **Validation:** Commit with failing test → blocked

---

## Sprint 13: Accessibility (A11y) Implementation
**Goal:** Ensure WCAG 2.1 AA compliance with full keyboard and screen reader support.

**Demo Deliverable:** Full keyboard navigation; zero axe violations; screen reader announces all actions.

### Tasks

#### T13.1: Add ARIA Labels to Interactive Elements
- **Description:** Label all buttons, inputs, and controls
- **Acceptance Criteria:**
  - All `<button>` elements have `aria-label` or visible text
  - All `<input>` elements have associated `<label>` or `aria-labelledby`
  - Icons-only buttons have `aria-label` describing action
  - Tab navigation and status toggle have `role="tablist"` and `role="tab"`
- **Validation:** axe DevTools shows 0 ARIA violations

#### T13.2: Implement Keyboard Navigation for Prospect List
- **Description:** Navigate list with arrow keys
- **Acceptance Criteria:**
  - `↓` key moves to next prospect
  - `↑` key moves to previous prospect
  - `Enter` key selects focused prospect
  - `Home` jumps to first, `End` to last
  - Focus ring visible on focused item
- **Validation:** Tab to list → arrow keys navigate → Enter selects

#### T13.3: Implement Keyboard Navigation for Tabs
- **Description:** Tab navigation per WAI-ARIA pattern
- **Acceptance Criteria:**
  - `Tab` moves focus to tab list, then to content
  - `←` and `→` arrows switch between tabs
  - `Space` or `Enter` activates focused tab
  - `aria-selected="true"` on active tab
- **Validation:** Keyboard-only navigation works correctly

#### T13.4: Add Focus Management for Modal
- **Description:** Trap focus in settings modal
- **Acceptance Criteria:**
  - Focus moves to modal when opened
  - `Tab` cycles through modal elements only (focus trap)
  - `Escape` closes modal
  - Focus returns to trigger button on close
- **Validation:** Open modal → Tab → focus stays in modal

#### T13.5: Add Screen Reader Announcements
- **Description:** Live region announcements for dynamic content
- **Acceptance Criteria:**
  - `aria-live="polite"` region for status updates
  - Announce: status changes, copy success, message sent
  - Announce: AI response received
  - Announce: error messages
- **Validation:** VoiceOver/NVDA announces changes

#### T13.6: Ensure Color Contrast Compliance
- **Description:** All text meets WCAG contrast ratios
- **Acceptance Criteria:**
  - Normal text: 4.5:1 minimum
  - Large text (18px+): 3:1 minimum
  - UI components: 3:1 against adjacent colors
  - Fix any low-contrast text in status badges
- **Validation:** axe DevTools shows 0 contrast violations

#### T13.7: Add Skip Links
- **Description:** Skip navigation for keyboard users
- **Acceptance Criteria:**
  - "Skip to main content" link at top of page
  - Visible on focus only
  - Jumps to main content area
  - "Skip to prospect list" option
- **Validation:** Tab on page load → skip link appears

#### T13.8: Add Reduced Motion Support
- **Description:** Respect user's motion preferences
- **Acceptance Criteria:**
  - Check `prefers-reduced-motion` media query
  - Disable animations when preferred
  - Keep essential state transitions
  - No auto-scrolling in reduced motion mode
- **Validation:** Enable reduced motion in OS → no animations

#### T13.9: Write Accessibility Tests
- **Description:** Automated a11y testing in test suite
- **Acceptance Criteria:**
  - Install: `@axe-core/react` or `vitest-axe`
  - Add a11y test to each component test file
  - Zero violations for all components
  - Add to CI pipeline
- **Validation:** `npm test` includes a11y checks

---

## Sprint 14: Mobile Responsiveness
**Goal:** Fully responsive design optimized for mobile and tablet devices.

**Demo Deliverable:** App fully usable on iPhone and Android; sidebar collapses; touch gestures work.

### Tasks

#### T14.1: Implement Mobile-First Layout System
- **Description:** Restructure layout with responsive breakpoints
- **Acceptance Criteria:**
  - Mobile (<768px): single column, stacked layout
  - Tablet (768-1024px): sidebar as overlay, main content full
  - Desktop (>1024px): current side-by-side layout
  - Use Tailwind responsive prefixes: `md:`, `lg:`
- **Validation:** Resize browser → layout adapts smoothly

#### T14.2: Create Collapsible Mobile Sidebar
- **Description:** Hamburger menu for mobile navigation
- **Acceptance Criteria:**
  - Hamburger icon (Menu) visible on mobile only
  - Tap opens sidebar as full-height overlay
  - Backdrop blur behind sidebar
  - Swipe left or tap backdrop to close
  - Selected prospect closes sidebar
- **Validation:** Mobile viewport → hamburger works → sidebar slides

#### T14.3: Implement Bottom Sheet for Prospect Detail
- **Description:** Mobile-optimized detail view
- **Acceptance Criteria:**
  - On mobile, detail panel slides up from bottom
  - Drag handle at top for gestures
  - Snap points: 50% (half), 90% (full)
  - Drag down to dismiss
  - Uses CSS or framer-motion for animation
- **Validation:** Select prospect on mobile → bottom sheet appears

#### T14.4: Optimize Touch Targets
- **Description:** Ensure all interactive elements are touch-friendly
- **Acceptance Criteria:**
  - Minimum tap target: 44x44px
  - Add padding to small buttons
  - Increase spacing between list items
  - Status toggle buttons enlarged on mobile
- **Validation:** No tap target < 44px on mobile

#### T14.5: Add Pull-to-Refresh
- **Description:** Mobile gesture to refresh data
- **Acceptance Criteria:**
  - Pull down on prospect list triggers refresh
  - Loading spinner during refresh
  - Re-fetches from Firestore if connected
  - Works without Firebase (just resets local state)
- **Validation:** Pull down → spinner → data refreshes

#### T14.6: Optimize Chat Interface for Mobile
- **Description:** Mobile-optimized AI chat experience
- **Acceptance Criteria:**
  - Chat input sticks to bottom (above keyboard)
  - Messages scroll correctly with virtual keyboard
  - Send button larger on mobile
  - Auto-resize textarea for longer inputs
- **Validation:** Type on mobile → keyboard doesn't obscure input

#### T14.7: Add Mobile Navigation Gestures
- **Description:** Swipe gestures for tab switching
- **Acceptance Criteria:**
  - Swipe left/right on main content switches tabs
  - Visual indicator shows current tab
  - Gesture disabled when scrolling
  - Uses touch events, no external dependency
- **Validation:** Swipe left → switches to next tab

#### T14.8: Test on Real Devices
- **Description:** Manual testing on iOS and Android
- **Acceptance Criteria:**
  - Test on iPhone 14 (Safari)
  - Test on Android (Chrome)
  - Document any device-specific issues
  - Fix critical issues before sprint completion
- **Validation:** App fully usable on both platforms

---

## Sprint 15: Data Management & Export
**Goal:** Import/export functionality for data portability and backup.

**Demo Deliverable:** Export prospects as JSON/CSV; import from file; auto-backup with restore.

### Tasks

#### T15.1: Implement Prospect Data Export
- **Description:** Export prospects as JSON or CSV
- **Acceptance Criteria:**
  - Export button in settings or sidebar footer
  - Formats: JSON (full data) and CSV (tabular)
  - Filename: `yardflow-prospects-{date}.{ext}`
  - Includes all prospect fields and status
- **Validation:** Click export → file downloads → data is correct

#### T15.2: Implement Prospect Data Import
- **Description:** Import prospects from JSON file
- **Acceptance Criteria:**
  - Import button in settings
  - File picker accepts `.json` files
  - Validates data structure before import
  - Merge or replace options
  - Error handling for invalid files
- **Validation:** Import valid JSON → prospects appear

#### T15.3: Add Data Validation Layer
- **Description:** Validate all data before saving
- **Acceptance Criteria:**
  - Create Zod schemas for all types: `ProspectSchema`, etc.
  - Validate on import, on Firestore write, on state update
  - Return detailed error messages
  - Invalid data rejected with explanation
- **Validation:** Import invalid data → error message shown

#### T15.4: Implement Backup to Local Storage
- **Description:** Automatic local backup of all data
- **Acceptance Criteria:**
  - Auto-save to localStorage every 60 seconds
  - Key: `yardflow_backup_{timestamp}`
  - Keep last 5 backups, delete older
  - "Restore from backup" option in settings
- **Validation:** Make changes → check localStorage → backup exists

#### T15.5: Add Data Reset Functionality
- **Description:** Reset all data to initial state
- **Acceptance Criteria:**
  - "Reset to Defaults" button in settings
  - Confirmation modal: "This will erase all changes"
  - Resets: prospects, chat history, settings
  - Does NOT reset API key
- **Validation:** Reset → all data returns to initial state

#### T15.6: Implement Notes Field for Prospects
- **Description:** Add editable notes to each prospect
- **Acceptance Criteria:**
  - Textarea in prospect detail panel
  - Auto-saves to state and Firestore
  - Character limit: 500 chars
  - Timestamp shows last edited
- **Validation:** Add note → refresh → note persists

#### T15.7: Add Bulk Actions
- **Description:** Perform actions on multiple prospects
- **Acceptance Criteria:**
  - Checkbox on each list item
  - "Select All" checkbox in header
  - Bulk actions: "Mark as Contacted", "Export Selected"
  - Action confirmation modal
- **Validation:** Select 3 → mark as contacted → all 3 update

---

## Sprint 16: Advanced Analytics & Insights
**Goal:** Rich analytics dashboard with conversion tracking and AI-powered insights.

**Demo Deliverable:** Funnel visualization; tier comparison; AI-generated strategy recommendations.

### Tasks

#### T16.1: Track Prospect Funnel Metrics
- **Description:** Calculate conversion rates between statuses
- **Acceptance Criteria:**
  - Track: New → Drafted → Contacted → Booked
  - Calculate: conversion rate at each stage
  - Store: timestamp of each status change
  - Compute: average time between stages
- **Validation:** Change statuses → funnel metrics update

#### T16.2: Create Funnel Visualization
- **Description:** Visual funnel chart in stats tab
- **Acceptance Criteria:**
  - Horizontal funnel showing stage counts
  - Percentages between stages
  - Color gradient: gray → yellow → green → purple
  - Responsive width based on counts
- **Validation:** Visual inspection → funnel proportions correct

#### T16.3: Add Tier Performance Comparison
- **Description:** Compare Tier 1 vs Tier 2 performance
- **Acceptance Criteria:**
  - Side-by-side cards: Tier 1 stats vs Tier 2 stats
  - Metrics: response rate, meeting rate, avg time to book
  - Highlight better performing tier
- **Validation:** Stats reflect actual tier distribution

#### T16.4: Implement Outreach Velocity Chart
- **Description:** Track outreach pace over time
- **Acceptance Criteria:**
  - Line chart: messages sent per day
  - Data stored in localStorage with timestamps
  - Show last 7 days
  - Lightweight chart (SVG, no D3)
- **Validation:** Send messages over days → chart shows trend

#### T16.5: Add AI-Powered Insights
- **Description:** AI generates strategic insights from data
- **Acceptance Criteria:**
  - "Get AI Insights" button in stats tab
  - Sends current stats to Gemini
  - Prompt: "Analyze this outreach data and suggest optimizations"
  - Displays insights in collapsible card
- **Validation:** Click → AI provides actionable insights

#### T16.6: Create Sender Performance Comparison
- **Description:** Compare "Me" vs "Jake" effectiveness
- **Acceptance Criteria:**
  - Track which sender was used for each outreach
  - Compare: messages sent, meetings booked per sender
  - Show in stats tab as bar comparison
- **Validation:** Use both senders → comparison reflects data

#### T16.7: Add Goal Setting & Progress
- **Description:** Set and track meeting booking goals
- **Acceptance Criteria:**
  - Goal input: "Target: X meetings"
  - Progress ring/bar showing current vs goal
  - Celebrate animation when goal met
  - Goal persisted to localStorage
- **Validation:** Set goal → book meetings → progress updates

---

## Sprint 17: Collaboration Features
**Goal:** Real-time collaboration with presence indicators and activity feeds.

**Demo Deliverable:** See when teammates are viewing prospects; activity feed shows real-time updates.

### Tasks

#### T17.1: Implement Real-Time Presence Indicators
- **Description:** Show which prospects are being viewed by team members
- **Acceptance Criteria:**
  - Firestore path: `presence/{appId}/{prospectId}`
  - Document contains: userId, timestamp, user name
  - Update on prospect selection, remove on deselect
  - Show avatar/indicator on list items being viewed
- **Validation:** Two browsers → select same prospect → both see indicator

#### T17.2: Add "Currently Editing" Badge
- **Description:** Show when another user is editing a prospect
- **Acceptance Criteria:**
  - Badge with pulsing animation on list item
  - Tooltip: "Jake is viewing this"
  - Clears after 30 seconds of inactivity
  - Updates in real-time via Firestore listener
- **Validation:** User A selects → User B sees badge

#### T17.3: Implement Prospect Comments
- **Description:** Add comments/notes visible to all users
- **Acceptance Criteria:**
  - Comment section in prospect detail
  - Each comment: text, author, timestamp
  - Stored in Firestore: `prospects/{id}/comments`
  - Real-time updates via onSnapshot
- **Validation:** Add comment → appears for other users

#### T17.4: Add Comment Mentions
- **Description:** @mention team members in comments
- **Acceptance Criteria:**
  - Type `@` to trigger user dropdown
  - Select user to insert mention
  - Mentions styled distinctly
  - Future: notification system hook
- **Validation:** Type @Jake → dropdown appears → selection works

#### T17.5: Create Activity Feed
- **Description:** Stream of recent team actions
- **Acceptance Criteria:**
  - Collapsible panel in sidebar (on Stats or separate tab)
  - Shows: "{User} updated {Prospect} to {Status}"
  - Last 20 activities
  - Stored in Firestore: `activity/{appId}/log`
- **Validation:** Change status → activity appears in feed

#### T17.6: Implement Optimistic Locking
- **Description:** Prevent conflicting edits
- **Acceptance Criteria:**
  - Each Firestore doc has `version` field
  - On update, check `version` matches
  - If conflict: show merge dialog
  - Options: "Keep mine", "Keep theirs", "Merge"
- **Validation:** Simultaneous edits → conflict detected → dialog shown

#### T17.7: Add Team Assignment
- **Description:** Assign prospects to team members
- **Acceptance Criteria:**
  - "Assigned to" dropdown in prospect detail
  - Options: Me, Jake, Unassigned
  - Filter by assignment in list
  - Visual indicator on assigned items
- **Validation:** Assign to Jake → filter by Jake → prospect appears

#### T17.8: Implement Notification System
- **Description:** In-app notifications for mentions and updates
- **Acceptance Criteria:**
  - Bell icon in header with badge count
  - Notifications: mentions, assignments, status changes by others
  - Mark as read functionality
  - Click navigates to relevant prospect
- **Validation:** Get mentioned → notification appears → click navigates

---

## Dependencies for Future Sprints

```json
{
  "dependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "jsdom": "^23.0.0",
    "@playwright/test": "^1.40.0",
    "husky": "^8.0.0",
    "lint-staged": "^15.0.0",
    "@axe-core/react": "^4.8.0"
  }
}
```

---

## Definition of Done (All Tasks)
- [ ] Code compiles with zero TypeScript errors
- [ ] Feature works as described in acceptance criteria
- [ ] No console errors or warnings
- [ ] Code follows existing patterns and conventions
- [ ] Changes are atomic and committable
- [ ] Appropriate tests written (unit/integration/e2e)
- [ ] Accessibility requirements met
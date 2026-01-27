# YardFlow GTM Hub - Sprint & Task Breakdown

## Project Overview
YardFlow Hub is a React/TypeScript SPA for the Manifest 2026 conference GTM strategy. It provides prospect management, AI-powered message generation, and team collaboration features.

**Tech Stack:** Vite + React 18 + TypeScript + Tailwind CSS + Firebase (Auth/Firestore) + Gemini AI

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

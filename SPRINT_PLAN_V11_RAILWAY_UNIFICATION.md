# YardFlow GTM Hub - Sprint Plan V11: RAILWAY UNIFICATION

## 🎯 THE NORTH STAR

> **Railway as Source of Truth, Vercel as UI Layer** — All email operations, data persistence, and job processing move to Railway. Vercel becomes a pure React SPA with excellent UX.

**User Request:** "Optimize for UI/UX. Need to start lining up emails ripping them out."

---

## EXECUTIVE SUMMARY

### Current Architecture (Hybrid Mess)

```
┌─────────────────────────────────────────┐     ┌────────────────────────────────────┐
│  Vercel (GTM-YardFlow)                  │     │  Railway (YardFlow-Hitlist)        │
│                                         │     │                                    │
│  React Frontend                         │     │  PostgreSQL (Prisma)               │
│  Firebase Auth (duplicated)             │     │  Redis + BullMQ                    │
│  Firestore (duplicated data!)     ─────?────▶│  SendGrid (emails)                 │
│  Vercel Cron (sequences)                │     │  NextAuth (unused?)                │
│  /api/railway/* (proxy)                 │     │  Sequence workers (unused?)        │
│  /api/email/* (direct SendGrid)         │     │                                    │
└─────────────────────────────────────────┘     └────────────────────────────────────┘
```

**Problems:**
- Data in two places (Firestore + PostgreSQL) — no sync
- Emails sent from Vercel directly, bypassing Railway's queue
- Sequence execution on Vercel cron, not Railway BullMQ
- Two auth systems (Firebase on Vercel, NextAuth on Railway)
- No proper job queue (Firestore polling every 5 min)

### Target Architecture (Clean)

```
┌─────────────────────────────────────────┐        ┌────────────────────────────────────┐
│  VERCEL (Frontend Only)                 │        │  RAILWAY (Backend / Source of Truth)│
│                                         │        │                                    │
│  React SPA                              │        │  PostgreSQL (all data)             │
│  - Company View                         │        │  - prospects, sequences            │
│  - AI Research UI                       │  API   │  - enrollments, email_events       │
│  - ROI Calculator                       │◄──────▶│  - meetings, templates             │
│  - Real-time Dashboard                  │  Proxy │                                    │
│  - Sequence Management                  │        │  Redis + BullMQ (all queues)       │
│                                         │        │  - email queue                     │
│  NO Firebase Auth                       │        │  - sequence execution              │
│  NO Firestore data                      │        │  - enrichment jobs                 │
│  NO direct SendGrid calls               │        │                                    │
│                                         │        │  SendGrid (via Railway only)       │
│                                         │        │  NextAuth (single auth source)     │
└─────────────────────────────────────────┘        └────────────────────────────────────┘
```

**Auth Flow:** `Vercel → Railway NextAuth → JWT → All API calls authenticated`
**Data Flow:** `All CRUD → Railway API → PostgreSQL`
**Email Flow:** `UI → Railway API → BullMQ → SendGrid → Tracking webhook`

---

## 🚨 RISK MITIGATION

### Rollback Strategy

#### Level 1: Feature Flag Rollback (< 5 min)
- Set `RAILWAY_ENABLED=false` in Vercel env
- Frontend reverts to Firestore calls
- Railway data becomes stale but app works

#### Level 2: DNS/Proxy Rollback (< 15 min)
- Revert `api/railway/[...path].ts` to return 503
- Direct email sending to Vercel→SendGrid path
- Requires code deploy

#### Level 3: Full Rollback (< 2 hours)
- Restore Firestore backup from pre-migration
- Revert auth to Firebase
- Deploy previous known-good version
- Send user communication about data loss window

#### Dual-Write Strategy (During Migration)
- Write to BOTH Firestore and Railway for 48h
- If rollback needed, minimal data loss
- Firestore remains read-fallback

---

## 📋 PHASE 0: FOUNDATION (Sprint 90)

### Goal: Verify Railway readiness and establish safety measures

---

### Sprint 90: Railway Audit & Safety Setup

**Sprint Goal:** Verify Railway APIs exist and establish rollback infrastructure

#### T90.1: Audit Railway API Endpoints [M - 2h]
**Files:** `docs/RAILWAY_API_AUDIT.md`

**Description:** Document ALL existing Railway endpoints and identify gaps.

**Output:**
```markdown
# Railway API Audit

## Existing Endpoints
| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| /health | GET | ✅ | Returns DB/Redis status |
| /api/email/send | POST | ✅ | Queues email via BullMQ |
| ... | ... | ... | ... |

## Missing Endpoints (Need to Build on Railway)
| Endpoint | Priority | Blocking Sprint |
|----------|----------|-----------------|
| /api/prospects | P0 | Sprint 93 |
| /api/sequences | P0 | Sprint 94 |
| ... | ... | ... |
```

**Validation:**
- [ ] All ALLOWED_PATHS in proxy verified against Railway
- [ ] Missing endpoints documented
- [ ] Railway team notified of gaps
- [ ] Blocking dependencies identified

**Commit:** `docs(railway): add API endpoint audit`

---

#### T90.2: Create Firestore Backup Script [M - 2h]
**Files:** `scripts/backupFirestore.ts`

**Description:** Export all Firestore collections to JSON before any migration.

```typescript
// scripts/backupFirestore.ts
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { writeFileSync, mkdirSync } from 'fs';

const COLLECTIONS = ['prospects', 'sequences', 'sequenceEnrollments', 'email_events', 'email_queue'];

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `./backups/firestore-${timestamp}`;
  mkdirSync(backupDir, { recursive: true });
  
  for (const collectionName of COLLECTIONS) {
    console.log(`Backing up ${collectionName}...`);
    const snapshot = await getDocs(collection(db, collectionName));
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    writeFileSync(`${backupDir}/${collectionName}.json`, JSON.stringify(data, null, 2));
    console.log(`  → ${data.length} documents`);
  }
  
  console.log(`\nBackup complete: ${backupDir}`);
}
```

**Validation:**
- [ ] Script runs without errors
- [ ] All collections exported
- [ ] JSON files are valid and restorable
- [ ] Backup stored securely (not in git)

**Commit:** `chore(safety): add Firestore backup script`

---

#### T90.3: Create Firestore Restore Script [M - 2h]
**Files:** `scripts/restoreFirestore.ts`

**Description:** Restore Firestore from backup in case of emergency.

**Validation:**
- [ ] Restore script works on empty Firestore
- [ ] Document counts match after restore
- [ ] Data integrity verified

**Commit:** `chore(safety): add Firestore restore script`

---

#### T90.4: Setup Feature Flags [M - 2h]
**Files:** `src/config/featureFlags.ts`, `.env.example`

**Description:** Create feature flag system for gradual rollout.

```typescript
// src/config/featureFlags.ts
export const featureFlags = {
  // Railway migration flags
  RAILWAY_ENABLED: import.meta.env.VITE_RAILWAY_ENABLED === 'true',
  RAILWAY_AUTH_ENABLED: import.meta.env.VITE_RAILWAY_AUTH_ENABLED === 'true',
  RAILWAY_EMAIL_ENABLED: import.meta.env.VITE_RAILWAY_EMAIL_ENABLED === 'true',
  
  // Traffic percentage (0-100)
  RAILWAY_TRAFFIC_PERCENT: parseInt(import.meta.env.VITE_RAILWAY_TRAFFIC_PERCENT || '0'),
  
  // Dual-write mode (write to both Firestore and Railway)
  DUAL_WRITE_ENABLED: import.meta.env.VITE_DUAL_WRITE_ENABLED === 'true',
};

export function shouldUseRailway(): boolean {
  if (!featureFlags.RAILWAY_ENABLED) return false;
  if (featureFlags.RAILWAY_TRAFFIC_PERCENT >= 100) return true;
  return Math.random() * 100 < featureFlags.RAILWAY_TRAFFIC_PERCENT;
}
```

**Validation:**
- [ ] Flags read from environment
- [ ] Default to Firestore (safe)
- [ ] Can toggle without redeploy (Vercel env)
- [ ] Traffic percentage works correctly

**Commit:** `feat(config): add feature flag system`

---

#### T90.5: Add Performance Baseline [S - 1h]
**Files:** `docs/PERFORMANCE_BASELINE.md`

**Description:** Measure current Firestore performance for comparison.

**Metrics to capture:**
- Prospect list load time (P50, P95)
- Search response time
- Enrollment creation time
- Email send → delivery time

**Validation:**
- [ ] P50/P95 latencies captured for: prospect list, search, enrollment create, email send
- [ ] Each metric measured 3x and averaged
- [ ] Measurement tool specified (Lighthouse, Performance API, custom script)
- [ ] Target improvements defined (e.g., "Railway should be within 10% of Firestore")
- [ ] Baseline stored in `docs/PERFORMANCE_BASELINE.md` with ISO timestamps

**Commit:** `docs(perf): add performance baseline`

---

#### T90.6: Create Railway API Gap Remediation Plan [M - 2h]
**Files:** `docs/RAILWAY_API_GAPS.md`

**Description:** Based on T90.1 audit, create actionable tickets for any missing Railway endpoints. Each gap needs an owner and ETA.

**Output:**
```markdown
# Railway API Gaps

| Missing Endpoint | Required By Sprint | Priority | Owner | ETA | JIRA Ticket |
|-----------------|-------------------|----------|-------|-----|-------------|
| POST /api/prospects | Sprint 93 | P0 | @railway-team | Day 3 | YARD-xxx |
| GET /api/sequences | Sprint 94 | P0 | @railway-team | Day 5 | YARD-xxx |
```

**Validation:**
- [ ] Every missing endpoint has a ticket
- [ ] Each ticket has owner and ETA
- [ ] Blocking sprints explicitly linked
- [ ] Railway team acknowledged and agreed to ETAs
- [ ] Slack/email confirmation documented

**Commit:** `docs(railway): create API gap remediation plan`

---

## 📋 PHASE 1: RAILWAY API CLIENT (Sprints 91-92)

### Goal: Create robust typed API client for Railway backend

**Current State:** RailwayEmailService.ts exists but is incomplete. No typed responses, no error handling, no retry logic.

**Target State:** Full typed client with all Railway endpoints, proper auth, error handling, and offline fallback.

---

### Sprint 91: Railway API Client Foundation

**Sprint Goal:** Create typed API client for all Railway endpoints

#### T91.1: Define Railway API Types [M - 2h]
**Files:** `src/types/railway.ts`

**Description:** Define TypeScript interfaces matching Railway's PostgreSQL schema (from Prisma).

```typescript
// src/types/railway.ts
export interface RailwayProspect {
  id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  linkedinUrl?: string;
  status: 'new' | 'contacted' | 'replied' | 'meeting_booked' | 'closed';
  tier: 'Tier 1' | 'Tier 2' | 'Tier 3';
  score: number;
  createdAt: string;
  updatedAt: string;
}

export interface RailwaySequence {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'archived';
  steps: RailwaySequenceStep[];
  createdAt: string;
}

export interface RailwaySequenceStep {
  index: number;
  subject: string;
  body: string;
  delayDays: number;
}

export interface RailwayEnrollment {
  id: string;
  prospectId: string;
  sequenceId: string;
  status: 'active' | 'paused' | 'completed' | 'replied' | 'bounced';
  currentStepIndex: number;
  enrolledAt: string;
  lastSentAt?: string;
  nextSendAt?: string;
}

export interface RailwayEmailEvent {
  id: string;
  emailId: string;
  type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'spam' | 'reply';
  prospectId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface RailwayMeeting {
  id: string;
  prospectId: string;
  sequenceId?: string;
  enrollmentId?: string;
  meetingDate: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  createdAt: string;
}

// API Response wrappers
export interface RailwayApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { total?: number; page?: number; limit?: number };
}

export interface RailwayHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: { status: string; latencyMs: number };
  redis: { status: string; latencyMs: number };
  queues: Record<string, 'ready' | 'paused' | 'error'>;
  version: string;
}
```

**Validation:**
- [ ] Types compile without errors
- [ ] Types match Railway Prisma schema (verify against docs/RAILWAY_INTEGRATION.md)
- [ ] All API response shapes covered

**Commit:** `feat(railway): add Railway API type definitions`

---

#### T91.2: Create RailwayApiClient Class [L - 4h]
**Files:** `src/services/RailwayApiClient.ts`

**Description:** Central API client class with typed methods, auth handling, and error handling.

```typescript
// src/services/RailwayApiClient.ts
import type {
  RailwayProspect,
  RailwaySequence,
  RailwayEnrollment,
  RailwayApiResponse,
  RailwayHealthResponse
} from '../types/railway';

interface RailwayClientConfig {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
}

export class RailwayApiClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;
  private authToken: string | null = null;

  constructor(config: RailwayClientConfig = {}) {
    this.baseUrl = config.baseUrl || '/api/railway';
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 3;
  }

  // Auth
  setAuthToken(token: string): void { this.authToken = token; }
  clearAuth(): void { this.authToken = null; }

  // Health
  async health(): Promise<RailwayHealthResponse>;
  async isAvailable(): Promise<boolean>;

  // Prospects
  async getProspects(params?: { status?: string; tier?: string; limit?: number }): Promise<RailwayApiResponse<RailwayProspect[]>>;
  async getProspect(id: string): Promise<RailwayApiResponse<RailwayProspect>>;
  async createProspect(data: Omit<RailwayProspect, 'id' | 'createdAt' | 'updatedAt'>): Promise<RailwayApiResponse<RailwayProspect>>;
  async updateProspect(id: string, data: Partial<RailwayProspect>): Promise<RailwayApiResponse<RailwayProspect>>;

  // Sequences
  async getSequences(): Promise<RailwayApiResponse<RailwaySequence[]>>;
  async getSequence(id: string): Promise<RailwayApiResponse<RailwaySequence>>;

  // Enrollments
  async enrollProspect(prospectId: string, sequenceId: string): Promise<RailwayApiResponse<RailwayEnrollment>>;
  async getEnrollments(prospectId?: string): Promise<RailwayApiResponse<RailwayEnrollment[]>>;
  async pauseEnrollment(enrollmentId: string, reason?: string): Promise<RailwayApiResponse<RailwayEnrollment>>;
  async resumeEnrollment(enrollmentId: string): Promise<RailwayApiResponse<RailwayEnrollment>>;
  async cancelEnrollment(enrollmentId: string): Promise<RailwayApiResponse<void>>;

  // Emails
  async sendEmail(params: { prospectId: string; subject: string; body: string; templateId?: string }): Promise<RailwayApiResponse<{ emailId: string }>>;
  async getEmailEvents(prospectId: string): Promise<RailwayApiResponse<RailwayEmailEvent[]>>;

  // Meetings
  async recordMeeting(data: { prospectId: string; meetingDate: string; notes?: string }): Promise<RailwayApiResponse<RailwayMeeting>>;
  async getMeetings(params?: { startDate?: string; endDate?: string }): Promise<RailwayApiResponse<RailwayMeeting[]>>;

  // Internal
  private async request<T>(method: string, path: string, body?: unknown): Promise<T>;
  private async withRetry<T>(fn: () => Promise<T>): Promise<T>;
}

export const railwayClient = new RailwayApiClient();
```

**Validation:**
- [ ] Unit tests for each method with mocked responses
- [ ] Error handling test: API returns 500 → client throws RailwayApiError
- [ ] Retry test: transient failure → retries up to 3 times
- [ ] Timeout test: request exceeds 30s → throws timeout error

**Commit:** `feat(railway): add RailwayApiClient class`

---

#### T91.3: Add Auth Integration [M - 2h]
**Files:** `src/services/RailwayApiClient.ts`, `src/hooks/useRailwayAuth.ts`

**Description:** Integrate with Railway NextAuth. Get JWT from Railway, store in memory, attach to all requests.

```typescript
// src/hooks/useRailwayAuth.ts
export function useRailwayAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<RailwayUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession(): Promise<void>;
  async function login(email: string, password: string): Promise<void>;
  async function logout(): Promise<void>;
  
  return { isAuthenticated, user, isLoading, login, logout };
}
```

**Validation:**
- [ ] Login → token stored, client configured
- [ ] API calls include Authorization header
- [ ] 401 response → auto-logout, redirect to login
- [ ] Session persists across page reload (via cookie)

**Commit:** `feat(railway): add auth integration for Railway client`

---

#### T91.4: Add Offline/Fallback Mode [M - 2h]
**Files:** `src/services/RailwayApiClient.ts`, `src/hooks/useRailwayStatus.ts`

**Description:** Gracefully handle Railway being unavailable. Cache last-known data, show connection status.

```typescript
// src/hooks/useRailwayStatus.ts
export function useRailwayStatus() {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  // Health check every 30 seconds
  useEffect(() => {
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return { status, lastCheck, checkNow: checkHealth };
}
```

**Validation:**
- [ ] Railway down → status shows "disconnected"
- [ ] UI shows connection warning banner
- [ ] Reconnection → status updates, banner hides
- [ ] Read operations work from cache when disconnected

**Commit:** `feat(railway): add offline mode and connection status`

---

#### T91.5: Add Railway Client Unit Tests [M - 2h]
**Files:** `src/services/__tests__/RailwayApiClient.test.ts`

**Description:** Comprehensive unit tests for RailwayApiClient using MSW (Mock Service Worker).

```typescript
// src/services/__tests__/RailwayApiClient.test.ts
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { railwayClient } from '../RailwayApiClient';

const server = setupServer(
  rest.get('/api/railway/health', (req, res, ctx) => {
    return res(ctx.json({ status: 'healthy' }));
  }),
  // ... mock all endpoints
);

describe('RailwayApiClient', () => {
  describe('health()', () => {
    it('returns health status on success', async () => {
      const result = await railwayClient.health();
      expect(result.status).toBe('healthy');
    });
    
    it('throws on 500 error', async () => {
      server.use(rest.get('/api/railway/health', (_, res, ctx) => res(ctx.status(500))));
      await expect(railwayClient.health()).rejects.toThrow('RailwayApiError');
    });
    
    it('retries on transient failure', async () => { /* ... */ });
    it('times out after 30s', async () => { /* ... */ });
  });
  
  // Tests for each method...
});
```

**Validation:**
- [ ] Minimum 80% code coverage on RailwayApiClient
- [ ] Tests for success, 4xx, 5xx, timeout, network error cases
- [ ] Tests for retry logic (verify 3 retries on transient failures)
- [ ] Tests for auth header attachment
- [ ] All tests pass in CI

**Commit:** `test(railway): add RailwayApiClient unit tests`

---

### Sprint 92: Railway Proxy Improvements

**Sprint Goal:** Improve the Vercel → Railway proxy for reliability and observability

#### T92.1: Add Request/Response Logging [S - 1h]
**Files:** `api/railway/[...path].ts`

**Description:** Log all Railway API calls for debugging. Include timing, status, and sanitized payloads.

```typescript
// Add to proxy handler
const startTime = Date.now();
const response = await fetch(railwayUrl, options);
const duration = Date.now() - startTime;

console.log(JSON.stringify({
  type: 'railway_proxy',
  method: req.method,
  path: railwayPath,
  status: response.status,
  durationMs: duration,
  timestamp: new Date().toISOString()
}));
```

**Validation:**
- [ ] Every proxy request logged with timing
- [ ] Sensitive data (auth tokens) redacted
- [ ] Logs visible in Vercel dashboard

**Commit:** `feat(railway): add request logging to proxy`

---

#### T92.2: Add Rate Limiting to Proxy [M - 2h]
**Files:** `api/railway/[...path].ts`, `lib/rateLimiter.ts`

**Description:** Prevent abuse of proxy. Limit to 100 requests/minute per IP. Uses Railway's Redis for distributed rate limiting (not in-memory Map which won't work across Vercel instances).

```typescript
// lib/rateLimiter.ts
export class RateLimiter {
  private redisClient: Redis;
  
  constructor(private maxRequests: number, private windowMs: number) {
    this.redisClient = createRedisClient(process.env.RAILWAY_REDIS_URL);
  }
  
  async check(key: string): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
    const now = Date.now();
    const windowKey = `ratelimit:${key}:${Math.floor(now / this.windowMs)}`;
    
    const count = await this.redisClient.incr(windowKey);
    if (count === 1) {
      await this.redisClient.expire(windowKey, Math.ceil(this.windowMs / 1000));
    }
    
    return {
      allowed: count <= this.maxRequests,
      remaining: Math.max(0, this.maxRequests - count),
      resetIn: this.windowMs - (now % this.windowMs)
    };
  }
}
```

**Validation:**
- [ ] Under limit → requests pass through
- [ ] Over limit → 429 Too Many Requests
- [ ] Limit resets after window
- [ ] Different IPs have independent limits
- [ ] Works across multiple Vercel instances (Redis-backed)

**Commit:** `feat(railway): add rate limiting to proxy`

---

#### T92.3: Add Circuit Breaker [M - 2h]
**Files:** `api/railway/[...path].ts`, `lib/circuitBreaker.ts`

**Description:** If Railway fails repeatedly, stop hammering it. Open circuit after 5 failures, retry after 30s.

```typescript
// lib/circuitBreaker.ts
type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private lastFailure: number = 0;
  
  constructor(
    private threshold: number = 5,
    private resetTimeout: number = 30000
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T>;
  getState(): CircuitState;
  reset(): void;
}
```

**Validation:**
- [ ] 5 consecutive failures → circuit opens
- [ ] Open circuit → immediate rejection (no Railway call)
- [ ] After 30s → half-open, next request tests Railway
- [ ] Success in half-open → circuit closes

**Commit:** `feat(railway): add circuit breaker to proxy`

---

#### T92.4: Add Response Caching [M - 2h]
**Files:** `api/railway/[...path].ts`, `lib/proxyCache.ts`

**Description:** Cache GET requests to reduce Railway load. 60s TTL for lists, 5min for single resources.

```typescript
// lib/proxyCache.ts
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  etag?: string;
}

export class ProxyCache {
  private store: Map<string, CacheEntry<unknown>> = new Map();
  
  get<T>(key: string): T | null;
  set<T>(key: string, data: T, ttlMs: number): void;
  invalidate(pattern: string): void;
  clear(): void;
}
```

**Validation:**
- [ ] GET /prospects → cached 60s
- [ ] GET /prospects/:id → cached 5min
- [ ] POST/PUT/DELETE → invalidates relevant cache
- [ ] Cache-Control headers respected

**Commit:** `feat(railway): add response caching to proxy`

---

## 📋 PHASE 2: DATA MIGRATION (Sprints 93-94)

### Goal: Move all data operations from Firestore to Railway PostgreSQL

**Current State:** Prospects, sequences, enrollments, email_events all in Firestore.

**Target State:** All data in PostgreSQL via Railway API. Firestore removed.

---

### Sprint 93: Prospect Data Migration

**Sprint Goal:** Read/write prospects from Railway instead of Firestore

**⚠️ PREREQUISITE:** Run T93.0 migration script BEFORE starting other Sprint 93 tasks. Railway must have prospect data for hooks to work.

#### T93.0: Execute Prospect Data Migration [S - 1h]
**Files:** `scripts/migrateProspectsToRailway.ts` (created in T93.8)

**Description:** Actually run the migration script to populate Railway with Firestore data. This is a manual execution step, not code development.

**Steps:**
1. Verify Railway API is accessible: `curl $RAILWAY_URL/health`
2. Create fresh Firestore backup: `npm run backup:firestore`
3. Run migration: `npx ts-node scripts/migrateProspectsToRailway.ts`
4. Verify counts match

**Validation:**
- [ ] Railway /health returns 200
- [ ] Fresh Firestore backup created
- [ ] Migration script completes without errors
- [ ] Prospect count in Railway matches Firestore
- [ ] Spot-check 5 random records for data accuracy
- [ ] Screenshot of Railway DB prospect count saved to `docs/migration-evidence/`

**Commit:** `docs(migration): add prospect migration evidence`

---

#### T93.1: Create useProspects Hook with Railway Backend [M - 3h]
**Files:** `src/hooks/useProspects.ts`

**Description:** New hook that fetches prospects from Railway API instead of Firestore.

```typescript
// src/hooks/useProspects.ts
export function useProspects() {
  const [prospects, setProspects] = useState<RailwayProspect[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch from Railway
  useEffect(() => {
    loadProspects();
  }, []);

  async function loadProspects(): Promise<void>;
  async function createProspect(data: CreateProspectInput): Promise<RailwayProspect>;
  async function updateProspect(id: string, data: Partial<RailwayProspect>): Promise<void>;
  async function deleteProspect(id: string): Promise<void>;
  
  return { prospects, isLoading, error, createProspect, updateProspect, deleteProspect, refresh: loadProspects };
}
```

**Validation:**
- [ ] Prospects load from Railway on mount
- [ ] Create prospect → API call → list refreshes
- [ ] Update prospect → API call → optimistic update
- [ ] Loading/error states work correctly

**Commit:** `feat(data): add useProspects hook with Railway backend`

---

#### T93.2: Extract Prospect State to Custom Hook [M - 2h]
**Files:** `src/hooks/useProspectState.ts`, `src/App.tsx`

**Description:** First step of App.tsx refactor - extract all prospect-related state and Firestore listeners into a dedicated hook. This makes the subsequent Railway migration easier.

```typescript
// src/hooks/useProspectState.ts
export function useProspectState() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Move existing Firestore onSnapshot here
  useEffect(() => {
    // existing prospect loading logic from App.tsx
  }, []);
  
  return { prospects, isLoading, error, setProspects };
}
```

**Validation:**
- [ ] App.tsx prospect state moved to hook
- [ ] No behavior change - app works identically
- [ ] Hook can be called from App.tsx

**Commit:** `refactor(app): extract prospect state to custom hook`

---

#### T93.3: Replace Prospect Reads with Railway [M - 2h]
**Files:** `src/hooks/useProspectState.ts`

**Description:** Inside the extracted hook, add feature flag to read from Railway instead of Firestore.

```typescript
useEffect(() => {
  if (featureFlags.RAILWAY_ENABLED) {
    loadFromRailway();
  } else {
    loadFromFirestore();
  }
}, []);

async function loadFromRailway() {
  const response = await railwayClient.getProspects();
  if (response.success) {
    setProspects(response.data);
  }
}
```

**Validation:**
- [ ] Feature flag OFF → loads from Firestore
- [ ] Feature flag ON → loads from Railway
- [ ] Both paths work correctly
- [ ] Loading states work for both

**Commit:** `feat(data): add Railway prospect reads with feature flag`

---

#### T93.4: Replace Prospect Mutations with Railway [M - 2h]
**Files:** `src/hooks/useProspectState.ts`

**Description:** Update prospect mutations (status change, update, delete) to use Railway API.

```typescript
async function updateProspect(id: string, data: Partial<Prospect>) {
  if (featureFlags.RAILWAY_ENABLED) {
    await railwayClient.updateProspect(id, data);
  }
  
  if (featureFlags.DUAL_WRITE_ENABLED || !featureFlags.RAILWAY_ENABLED) {
    await setDoc(doc(db, 'prospects', id), data, { merge: true });
  }
  
  // Optimistic update
  setProspects(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
}
```

**Validation:**
- [ ] Status changes persist to Railway
- [ ] Dual-write mode writes to both
- [ ] Optimistic updates work
- [ ] Error handling shows toast AND reverts optimistic update within 200ms
- [ ] API failure: UI reverts to previous state
- [ ] Network error: retry with exponential backoff

**Commit:** `feat(data): add Railway prospect mutations`

---

#### T93.5: Remove Firestore Prospect Imports from App.tsx [S - 1h]
**Files:** `src/App.tsx`

**Description:** Final cleanup - remove all Firestore prospect code from App.tsx now that hook handles everything.

**Validation:**
- [ ] No `collection(db, 'prospects')` in App.tsx
- [ ] No `onSnapshot` for prospects in App.tsx
- [ ] App.tsx uses only useProspectState hook
- [ ] Build succeeds

**Commit:** `refactor(app): remove Firestore prospect code from App.tsx`

---

#### T93.6: Add Loading Skeletons for Prospect List [S - 1h]
**Files:** `src/components/ProspectListSkeleton.tsx`, `src/App.tsx`

**Description:** Railway API calls may be slower than Firestore real-time. Add skeleton loading UI.

```typescript
// src/components/ProspectListSkeleton.tsx
export function ProspectListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-16 bg-slate-100 rounded-lg" />
      ))}
    </div>
  );
}
```

**Validation:**
- [ ] Skeleton shows during load
- [ ] Smooth transition to real data
- [ ] No layout shift when data loads
- [ ] Works on slow connections

**Commit:** `feat(ux): add prospect list loading skeletons`

---

#### T93.7: Add Prospect Search via Railway [M - 2h]
**Files:** `src/hooks/useProspectSearch.ts`, `src/services/RailwayApiClient.ts`

**Description:** Move search from client-side filtering to Railway API with full-text search.

```typescript
// Add to RailwayApiClient
async searchProspects(query: string, filters?: {
  status?: string[];
  tier?: string[];
  score?: { min?: number; max?: number };
}): Promise<RailwayApiResponse<RailwayProspect[]>>;
```

**Validation:**
- [ ] Search query sent to Railway
- [ ] Results return quickly (< 200ms)
- [ ] Filters apply server-side
- [ ] Empty query returns all prospects

**Commit:** `feat(data): add prospect search via Railway API`

---

#### T93.8: Add Data Migration Script [M - 3h]
**Files:** `scripts/migrateProspectsToRailway.ts`

**Description:** One-time script to export Firestore prospects and import to Railway. Uses batch transactions with checkpointing for reliability.

```typescript
// scripts/migrateProspectsToRailway.ts
const BATCH_SIZE = 50;
const CHECKPOINT_FILE = './migration-checkpoint.json';

async function migrate() {
  // Load checkpoint if exists (resume from crash)
  const checkpoint = loadCheckpoint();
  const startIndex = checkpoint?.lastIndex || 0;
  
  console.log('Fetching prospects from Firestore...');
  const firestoreProspects = await getFirestoreProspects();
  console.log(`Found ${firestoreProspects.length} prospects, starting at ${startIndex}`);
  
  for (let i = startIndex; i < firestoreProspects.length; i += BATCH_SIZE) {
    const batch = firestoreProspects.slice(i, i + BATCH_SIZE);
    
    // Batch upsert to Railway (idempotent)
    const result = await railwayClient.batchUpsertProspects(
      batch.map(p => ({ ...transformToRailwaySchema(p), firestoreId: p.id }))
    );
    
    // Save checkpoint
    saveCheckpoint({ lastIndex: i + batch.length, timestamp: new Date().toISOString() });
    console.log(`Migrated ${i + batch.length}/${firestoreProspects.length}`);
  }
  
  console.log('Migration complete!');
}
```

**Validation:**
- [ ] Script runs without errors
- [ ] All Firestore prospects appear in Railway (count matches)
- [ ] Checkpoint file created and updated during run
- [ ] Interrupted script can resume from checkpoint
- [ ] Re-running doesn't duplicate (upsert by firestoreId)
- [ ] Data integrity: spot-check 10 random records for field accuracy

**Commit:** `chore(data): add Firestore to Railway migration script`

---

#### T93.9: Create Railway→Firestore Reverse Sync Script [M - 2h]
**Files:** `scripts/reverseSync.ts`

**Description:** Emergency rollback script to sync Railway data back to Firestore if migration causes issues.

```typescript
// scripts/reverseSync.ts
async function reverseSync() {
  console.log('Fetching prospects from Railway...');
  const railwayProspects = await railwayClient.getProspects({ limit: 10000 });
  
  console.log(`Syncing ${railwayProspects.data.length} prospects back to Firestore...`);
  for (const prospect of railwayProspects.data) {
    await setDoc(doc(db, 'prospects', prospect.firestoreId || prospect.id), 
      transformToFirestoreSchema(prospect));
  }
  
  console.log('Reverse sync complete!');
}
```

**Validation:**
- [ ] Script runs without errors
- [ ] All Railway prospects appear in Firestore
- [ ] Data integrity verified (counts match)
- [ ] Original Firestore IDs preserved

**Commit:** `chore(data): add Railway to Firestore reverse sync script`

---

### Sprint 94: Sequence & Enrollment Migration

**Sprint Goal:** Move sequence definitions and enrollments to Railway

#### T94.1: Create useSequences Hook with Railway Backend [M - 2h]
**Files:** `src/hooks/useSequences.ts`

**Description:** Fetch sequences from Railway instead of hardcoded templates.

```typescript
export function useSequences() {
  const [sequences, setSequences] = useState<RailwaySequence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  async function loadSequences(): Promise<void>;
  async function createSequence(data: CreateSequenceInput): Promise<RailwaySequence>;
  async function updateSequence(id: string, data: Partial<RailwaySequence>): Promise<void>;
  
  return { sequences, isLoading, createSequence, updateSequence, refresh: loadSequences };
}
```

**Validation:**
- [ ] Sequences load from Railway
- [ ] BulkSequenceModal shows Railway sequences
- [ ] Create/update operations persist

**Commit:** `feat(data): add useSequences hook with Railway backend`

---

#### T94.2: Migrate Sequence Templates to Railway [M - 3h]
**Files:** `scripts/migrateSequencesToRailway.ts`

**Description:** Export hardcoded EmailSequenceService templates to Railway.

```typescript
// Current templates in EmailSequenceService.ts:
// - cold_outreach (4 steps)
// - follow_up_sequence (3 steps)
// - meeting_request (2 steps)

async function migrate() {
  const templates = [
    {
      name: 'Cold Outreach',
      steps: [
        { index: 0, subject: '{{first_name}} - quick thought on {{company}}', body: '...', delayDays: 0 },
        { index: 1, subject: 'Re: {{company}}', body: '...', delayDays: 3 },
        // ...
      ]
    },
    // ...
  ];
  
  for (const template of templates) {
    await railwayClient.createSequence(template);
  }
}
```

**Validation:**
- [ ] All 3 sequence templates migrated
- [ ] Step order preserved
- [ ] Delay days correct
- [ ] Templates editable via Railway admin

**Commit:** `chore(data): migrate sequence templates to Railway`

---

#### T94.3a: Add Railway Enrollment API Calls [M - 2h]
**Files:** `src/hooks/useSequenceEnrollment.ts`

**Description:** Add Railway API calls for enrollment operations alongside existing Firestore code.

```typescript
async function enrollProspect(prospectId: string, sequenceId: string) {
  if (featureFlags.RAILWAY_ENABLED) {
    const result = await railwayClient.enrollProspect(prospectId, sequenceId);
    if (result.success) {
      setEnrollments(prev => [...prev, result.data]);
      return result.data;
    }
  }
  // Firestore fallback still in place
}
```

**Validation:**
- [ ] Enroll prospect → Railway API called
- [ ] Pause enrollment → Railway API called
- [ ] Resume enrollment → Railway API called
- [ ] Cancel enrollment → Railway API called
- [ ] Feature flag controls which backend is used

**Commit:** `feat(data): add Railway enrollment API calls`

---

#### T94.3b: Add Enrollment Polling Mechanism [M - 1h]
**Files:** `src/hooks/useSequenceEnrollment.ts`

**Description:** Poll Railway for enrollment status updates since we're removing Firestore's real-time listener.

```typescript
useEffect(() => {
  if (!featureFlags.RAILWAY_ENABLED) return;
  
  // Poll every 5 seconds for enrollment updates
  const interval = setInterval(async () => {
    const result = await railwayClient.getEnrollments();
    if (result.success) {
      setEnrollments(result.data);
    }
  }, 5000);
  
  return () => clearInterval(interval);
}, []);
```

**Validation:**
- [ ] Enrollment updates appear within 5 seconds
- [ ] Polling stops when component unmounts
- [ ] Polling is disabled when using Firestore
- [ ] Network errors don't crash the polling loop

**Commit:** `feat(data): add enrollment polling for Railway`

---

#### T94.3c: Remove Firestore Enrollment Listener [S - 1h]
**Files:** `src/hooks/useSequenceEnrollment.ts`

**Description:** Remove Firestore `onSnapshot` listener now that Railway polling is in place.

**Validation:**
- [ ] No `onSnapshot` for enrollments
- [ ] No Firestore enrollment imports
- [ ] Polling provides updates
- [ ] Feature flag fallback still works for Firestore

**Commit:** `refactor(data): remove Firestore enrollment listener`

---

#### T94.4: Remove Firestore Enrollment Storage [M - 2h]
**Files:** `src/services/SequenceEnrollmentService.ts`, `src/services/SequenceSchedulerService.ts`

**Description:** Remove all Firestore enrollment code now that Railway is source of truth.

**Validation:**
- [ ] No `sequenceEnrollments` Firestore collection references
- [ ] All enrollment reads from Railway API
- [ ] Build succeeds with no Firestore enrollment imports

**Commit:** `refactor(data): remove Firestore enrollment storage`

---

#### T94.5: Document Enrollment State Machine [S - 1h]
**Files:** `docs/ENROLLMENT_STATE_MACHINE.md`

**Description:** Document the enrollment state transitions for debugging and onboarding.

```markdown
# Enrollment State Machine

## States
- `active` - Prospect receiving sequence emails
- `paused` - Temporarily stopped (manual or bounce)
- `completed` - All steps sent
- `replied` - Prospect replied, sequence stopped
- `bounced` - Email bounced, sequence stopped

## Transitions
active → paused (manual pause, bounce)
active → completed (all steps sent)
active → replied (reply detected)
paused → active (manual resume)
```

**Validation:**
- [ ] All states documented
- [ ] All transitions documented with trigger
- [ ] Diagram included (mermaid or ASCII)
- [ ] Edge cases noted (e.g., what if paused + replied?)

**Commit:** `docs(enrollment): add state machine documentation`

---

## 📋 PHASE 3: EMAIL INFRASTRUCTURE (Sprints 95-96)

### Goal: All email operations go through Railway's BullMQ queue

**Current State:** Emails sent via Vercel → SendGrid directly. Queue is Firestore-based polling.

**Target State:** UI → Railway API → BullMQ → SendGrid. Proper job queue with retries.

---

### Sprint 95: Email Queue Migration

**Sprint Goal:** Route all emails through Railway's BullMQ queue

#### T95.1: Create Railway Email API Endpoints [M - 2h]
**Files:** `src/services/RailwayApiClient.ts`

**Description:** Add email-specific methods to Railway client.

```typescript
// Add to RailwayApiClient
interface SendEmailParams {
  prospectId: string;
  subject: string;
  body: string;
  scheduledFor?: string; // ISO date for delayed send
  sequenceId?: string;
  stepIndex?: number;
}

async sendEmail(params: SendEmailParams): Promise<RailwayApiResponse<{ jobId: string; emailId: string }>>;
async getEmailStatus(emailId: string): Promise<RailwayApiResponse<{ status: 'queued' | 'sent' | 'delivered' | 'failed'; sentAt?: string }>>;
async cancelEmail(emailId: string): Promise<RailwayApiResponse<void>>;
```

**Validation:**
- [ ] Send email → returns job ID
- [ ] Get status → shows queue position or sent time
- [ ] Cancel → removes from queue (if not sent)

**Commit:** `feat(email): add Railway email queue API methods`

---

#### T95.2: Replace Direct SendGrid Calls [L - 4h]
**Files:** `src/services/EmailClient.ts`, `src/App.tsx`, `api/email/send.ts`

**Description:** All email sends route through Railway instead of direct SendGrid.

**Changes:**
- `EmailClient.send()` → `railwayClient.sendEmail()`
- Remove `@sendgrid/mail` dependency from Vercel
- Update all UI email buttons to use Railway

**Validation:**
- [ ] "Send Email" button → Railway API → BullMQ
- [ ] No direct SendGrid imports in frontend
- [ ] Email appears in Railway queue dashboard
- [ ] Email delivers successfully

**Commit:** `refactor(email): route all emails through Railway queue`

---

#### T95.3: Update Sequence Execution to Use Railway Queue [M - 3h]
**Files:** `api/cron/execute-sequences.ts`, `src/services/SequenceSchedulerService.ts`

**Description:** Vercel cron no longer sends emails directly. It tells Railway to process sequences. **CRITICAL:** Uses Redis distributed lock to prevent dual-execution during migration.

```typescript
// api/cron/execute-sequences.ts (simplified)
export default async function handler(req: Request) {
  // Acquire distributed lock to prevent dual-execution with Railway cron
  const redis = createRedisClient(process.env.RAILWAY_REDIS_URL);
  const lockKey = 'sequence-processor-lock';
  const lockValue = `vercel-${Date.now()}`;
  const lockTTL = 300; // 5 minutes
  
  // Try to acquire lock (SET NX EX)
  const acquired = await redis.set(lockKey, lockValue, 'NX', 'EX', lockTTL);
  if (!acquired) {
    return Response.json({ 
      skipped: true, 
      reason: 'Another processor is running' 
    });
  }
  
  try {
    // Trigger Railway's sequence processor
    const response = await fetch(`${RAILWAY_URL}/api/sequences/process`, {
      method: 'POST',
      headers: { 'X-Cron-Secret': process.env.CRON_SECRET }
    });
    
    return Response.json({ triggered: true });
  } finally {
    // Release lock if we still own it
    const currentLock = await redis.get(lockKey);
    if (currentLock === lockValue) {
      await redis.del(lockKey);
    }
  }
}
```

**Validation:**
- [ ] Cron job triggers Railway processor
- [ ] Railway handles finding due enrollments
- [ ] Railway queues emails in BullMQ
- [ ] No Vercel → SendGrid direct calls
- [ ] Distributed lock prevents dual-execution

**Commit:** `refactor(email): delegate sequence execution to Railway`

---

#### T95.4: Remove Vercel Email Queue [M - 2h]
**Files:** `src/services/EmailQueueService.ts`, `api/cron/process-queue.ts`

**Description:** Delete the Firestore-based email queue now that Railway handles it.

**Validation:**
- [ ] `EmailQueueService.ts` deleted
- [ ] `api/cron/process-queue.ts` deleted or simplified
- [ ] No `email_queue` Firestore collection writes
- [ ] Build succeeds

**Commit:** `refactor(email): remove Vercel email queue`

---

#### T95.5: Add Email Queue Status UI [M - 2h]
**Files:** `src/components/EmailQueueStatus.tsx`, `src/hooks/useEmailQueueHealth.ts`

**Description:** Add a visual indicator showing queue health: pending count, processing rate, any stuck jobs.

```typescript
// src/components/EmailQueueStatus.tsx
export function EmailQueueStatus() {
  const { data } = useEmailQueueHealth();
  
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
      <div className={cn(
        "w-2 h-2 rounded-full",
        data.health === 'healthy' ? 'bg-green-500' : 
        data.health === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
      )} />
      <div className="text-sm">
        <span className="font-medium">{data.pending}</span> pending
        <span className="text-slate-500 ml-2">•</span>
        <span className="ml-2">{data.sentToday}</span> sent today (UTC)
      </div>
    </div>
  );
}
```

**Validation:**
- [ ] Queue health indicator shows correctly
- [ ] Pending count updates every 30 seconds
- [ ] Warning state when queue is slow (> 100 pending)
- [ ] Error state when queue is stuck (oldest job > 5 min old)
- [ ] Timezone clarified (UTC for "sent today")

**Commit:** `feat(ux): add email queue status indicator`

---

#### T95.6: Add Email Dead Letter Queue UI [M - 2h]
**Files:** `src/components/DeadLetterQueue.tsx`, `src/hooks/useDeadLetterQueue.ts`

**Description:** Show failed emails with retry capability. Critical for email operations.

```typescript
// src/components/DeadLetterQueue.tsx
export function DeadLetterQueue() {
  const { failedEmails, retryEmail, discardEmail } = useDeadLetterQueue();
  
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-red-600">
        Failed Emails ({failedEmails.length})
      </h3>
      {failedEmails.map(email => (
        <div key={email.id} className="p-3 bg-red-50 rounded-lg">
          <div className="font-medium">{email.subject}</div>
          <div className="text-sm text-slate-600">To: {email.prospectEmail}</div>
          <div className="text-xs text-red-600">Error: {email.error}</div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => retryEmail(email.id)}>Retry</button>
            <button onClick={() => discardEmail(email.id)}>Discard</button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Validation:**
- [ ] Failed emails listed with error messages
- [ ] Retry button re-queues email
- [ ] Discard button removes from dead letter queue
- [ ] Empty state when no failed emails
- [ ] Count badge shows on parent nav/tab

**Commit:** `feat(ux): add dead letter queue UI`

---

### Sprint 96: Email Tracking & Webhooks

**Sprint Goal:** All email events flow through Railway

#### T96.1: Update Webhook Endpoint to Proxy to Railway [M - 2h]
**Files:** `api/email/webhook.ts`

**Description:** SendGrid webhooks still hit Vercel, but forward to Railway for processing.

```typescript
// api/email/webhook.ts
export default async function handler(req: Request) {
  // Verify SendGrid signature
  if (!verifySignature(req)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  // Forward to Railway
  const response = await fetch(`${RAILWAY_URL}/api/webhooks/sendgrid`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Original-Signature': req.headers.get('X-Twilio-Email-Event-Webhook-Signature')
    },
    body: JSON.stringify(await req.json())
  });
  
  return Response.json({ forwarded: true });
}
```

**Validation:**
- [ ] SendGrid webhooks still work
- [ ] Events appear in Railway email_events table
- [ ] Open/click tracking records correctly
- [ ] Bounce/spam triggers enrollment pause

**Commit:** `refactor(email): forward webhooks to Railway`

---

#### T96.2: Create Email Analytics Hook [M - 2h]
**Files:** `src/hooks/useEmailAnalytics.ts`

**Description:** Fetch email performance data from Railway for dashboard.

```typescript
export function useEmailAnalytics(dateRange: { start: Date; end: Date }) {
  const [stats, setStats] = useState<EmailStats | null>(null);
  
  interface EmailStats {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
  }
  
  return { stats, isLoading, error };
}
```

**Validation:**
- [ ] Stats load from Railway
- [ ] Date range filtering works
- [ ] Rates calculated correctly
- [ ] Refreshes when date range changes

**Commit:** `feat(email): add email analytics hook`

---

#### T96.3: Update Dashboard with Railway Email Stats [M - 2h]
**Files:** `src/App.tsx`, `src/components/EmailStatsCard.tsx`

**Description:** Dashboard shows email metrics from Railway instead of Firestore.

**Validation:**
- [ ] Dashboard shows real email stats
- [ ] Open/click rates display correctly
- [ ] Sequence performance uses Railway data
- [ ] No Firestore email_events queries

**Commit:** `feat(email): update dashboard with Railway email stats`

---

#### T96.4: Remove Firestore Email Events [S - 1h]
**Files:** Various

**Description:** Remove all Firestore email_events references.

**Validation:**
- [ ] No `email_events` collection writes
- [ ] No `email_events` collection reads
- [ ] Build succeeds

**Commit:** `refactor(email): remove Firestore email events`

---

#### T96.5: Add Webhook Delivery Retry Logic [S - 1h]
**Files:** `api/email/webhook.ts`

**Description:** Handle cases where webhook forwarding to Railway fails.

```typescript
// api/email/webhook.ts
async function forwardWithRetry(payload: unknown, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${RAILWAY_URL}/api/webhooks/sendgrid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) return { success: true };
      
      // Don't retry on 4xx (client error)
      if (response.status >= 400 && response.status < 500) {
        return { success: false, error: 'Client error', status: response.status };
      }
    } catch (error) {
      console.log(`Webhook forward attempt ${attempt} failed:`, error);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
      }
    }
  }
  
  // All retries failed - log to dead letter for manual processing
  console.error('Webhook forwarding failed after retries:', payload);
  return { success: false, error: 'Max retries exceeded' };
}
```

**Validation:**
- [ ] Transient failure → retries up to 3 times
- [ ] 4xx errors → no retry (log and fail)
- [ ] All retries failed → logged for manual review
- [ ] Successful forward returns 200

**Commit:** `feat(email): add webhook delivery retry logic`

---

## 📋 PHASE 4: AUTH UNIFICATION (Sprints 97-98)

### Goal: Single auth source (Railway NextAuth), remove Firebase Auth

**Current State:** Firebase Auth on Vercel, NextAuth on Railway (unused?)

**Target State:** Railway NextAuth is single source of truth. JWT passed to all API calls.

---

### Sprint 97: Auth Migration

**Sprint Goal:** Implement Railway NextAuth login flow with graceful transition

#### T97.0: Add Dual-Auth Bridge for Safe Transition [L - 4h]
**Files:** `src/hooks/useDualAuth.ts`, `src/services/AuthBridge.ts`

**Description:** **CRITICAL SAFETY TASK.** During auth migration, we need both Firebase and Railway auth to work simultaneously. This bridge allows users to login with either system during the transition period.

```typescript
// src/services/AuthBridge.ts
export class AuthBridge {
  async authenticate(): Promise<AuthResult> {
    // Try Railway first
    const railwayAuth = await this.tryRailwayAuth();
    if (railwayAuth.success) {
      return railwayAuth;
    }
    
    // Fallback to Firebase
    if (featureFlags.FIREBASE_AUTH_FALLBACK) {
      const firebaseAuth = await this.tryFirebaseAuth();
      if (firebaseAuth.success) {
        // Migrate user to Railway in background
        this.migrateToRailway(firebaseAuth.user);
        return firebaseAuth;
      }
    }
    
    return { success: false, error: 'Authentication failed' };
  }
  
  async migrateToRailway(user: FirebaseUser) {
    // Create Railway account for Firebase user
    await railwayClient.createUserFromFirebase(user);
  }
}
```

**Validation:**
- [ ] Firebase users can still login during transition
- [ ] Railway auth works for new users
- [ ] User migration happens transparently
- [ ] No user loses access during migration
- [ ] Feature flag controls fallback behavior
- [ ] Test matrix verified: Firebase-only user ✓, Railway-only user ✓, migrated user ✓

**Commit:** `feat(auth): add dual-auth bridge for safe migration`

---

#### T97.0.5: Create Firebase→Railway User Migration Script [M - 3h]
**Files:** `scripts/migrateUsersToRailway.ts`

**Description:** Migrate existing Firebase users to Railway NextAuth database so they don't lose access.

```typescript
// scripts/migrateUsersToRailway.ts
import { getAuth } from 'firebase-admin/auth';

async function migrateUsers() {
  console.log('Fetching Firebase users...');
  const listResult = await getAuth().listUsers(1000);
  
  console.log(`Found ${listResult.users.length} users`);
  
  for (const user of listResult.users) {
    // Create user in Railway NextAuth
    const railwayUser = await railwayClient.createUser({
      email: user.email,
      name: user.displayName,
      firebaseUid: user.uid,
      // Password will need to be reset or use OAuth
    });
    
    console.log(`Migrated: ${user.email} -> ${railwayUser.id}`);
  }
  
  console.log('User migration complete!');
}
```

**Validation:**
- [ ] Script runs without errors
- [ ] All Firebase users created in Railway
- [ ] User count matches (Firebase = Railway)
- [ ] Email addresses preserved
- [ ] Duplicate emails handled gracefully (skip or update)
- [ ] Migration is idempotent

**Commit:** `chore(auth): add Firebase to Railway user migration script`

---

#### T97.1: Create Login Page with Railway Auth [M - 3h]
**Files:** `src/pages/Login.tsx`, `src/hooks/useRailwayAuth.ts`

**Description:** New login page that authenticates against Railway NextAuth with polished UI.

```typescript
// src/pages/Login.tsx
export function LoginPage() {
  const { login, isLoading, error } = useRailwayAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await login(email, password);
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">YardFlow GTM Hub</h1>
          <p className="text-slate-600 mt-2">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Polished email/password inputs */}
        </form>
      </div>
    </div>
  );
}
```

**Validation:**
- [ ] Login form renders with polished design
- [ ] Valid credentials → authenticated, redirected to app
- [ ] Invalid credentials → error message shown
- [ ] Loading state during auth
- [ ] Mobile responsive

**Commit:** `feat(auth): add Railway NextAuth login page`

---

#### T97.2: Add Auth Route Protection [M - 2h]
**Files:** `src/App.tsx`, `src/components/AuthGuard.tsx`

**Description:** Protect app routes, redirect unauthenticated users to login.

```typescript
// src/components/AuthGuard.tsx
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useRailwayAuth();
  
  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return <>{children}</>;
}
```

**Validation:**
- [ ] Unauthenticated → redirects to /login
- [ ] Authenticated → shows app
- [ ] Loading state while checking auth
- [ ] Deep links work after login

**Commit:** `feat(auth): add auth route protection`

---

#### T97.3: Store JWT and Attach to API Calls [M - 2h]
**Files:** `src/hooks/useRailwayAuth.ts`, `src/services/RailwayApiClient.ts`

**Description:** Store JWT token, automatically attach to all Railway API calls.

**Validation:**
- [ ] Login → JWT stored (memory + httpOnly cookie)
- [ ] API calls include Authorization header
- [ ] Token refresh before expiry
- [ ] 401 → auto-logout

**Commit:** `feat(auth): wire JWT to Railway API client`

---

#### T97.5: Railway Auth Production Soak Test [M - 2h]
**Files:** `docs/AUTH_SOAK_TEST_RESULTS.md`

**Description:** **SAFETY GATE.** Before removing Firebase Auth, verify Railway auth works in production for 24 hours. This is a manual verification step.

**Procedure:**
1. Deploy T97.0-T97.3 to production
2. Enable Railway auth for 10% of traffic (feature flag)
3. Monitor for 24 hours
4. Check for: login failures, 500 errors, token refresh issues
5. Document results

**Checklist:**
```markdown
# Auth Soak Test Results - [DATE]

## Traffic Split
- Railway auth: 10%
- Firebase fallback: 90%

## Metrics (24h period)
- Railway logins: ___
- Railway login failures: ___
- Firebase fallback logins: ___
- 500 errors: ___
- Token refresh events: ___
- Token refresh failures: ___

## Errors (paste any from logs)
[None / list errors]

## Decision
[ ] PASS - Proceed with Firebase removal
[ ] FAIL - Fix issues and re-test
```

**Validation:**
- [ ] 24 hours of production traffic with Railway auth
- [ ] Error rate < 0.1%
- [ ] No users locked out
- [ ] Token refresh working
- [ ] Documentation saved to `docs/AUTH_SOAK_TEST_RESULTS.md`

**Commit:** `docs(auth): add production soak test results`

---

#### T97.6: Remove Firebase Auth [L - 4h]
**Files:** `src/App.tsx`, various

**Description:** Remove all Firebase Auth code and dependencies. **ONLY PROCEED AFTER T97.5 PASSES.**

**Changes:**
- Remove `firebase/auth` imports
- Remove `onAuthStateChanged` listeners
- Remove Firebase auth config
- Remove `firebase` package if no longer needed

**Validation:**
- [ ] T97.5 soak test passed
- [ ] No Firebase auth imports
- [ ] App works with Railway auth only
- [ ] Build succeeds
- [ ] Bundle size reduced (~50-100KB less)
- [ ] No user reports of login issues within 2 hours of deploy

**Commit:** `refactor(auth): remove Firebase Auth`

---

### Sprint 98: Session Management

**Sprint Goal:** Robust session handling with refresh tokens

#### T98.1: Implement Token Refresh [M - 2h]
**Files:** `src/hooks/useRailwayAuth.ts`

**Description:** Automatically refresh JWT before expiry.

**Validation:**
- [ ] Token refreshed 5 minutes before expiry
- [ ] Background refresh doesn't interrupt user
- [ ] Refresh failure → logout
- [ ] Multiple tabs share session

**Commit:** `feat(auth): implement token refresh`

---

#### T98.2: Add Session Persistence [M - 2h]
**Files:** `src/hooks/useRailwayAuth.ts`

**Description:** Session survives page reload via httpOnly cookie.

**Validation:**
- [ ] Close tab, reopen → still authenticated
- [ ] Cookie set with proper flags (httpOnly, secure, sameSite)
- [ ] Logout clears cookie
- [ ] Works in incognito mode

**Commit:** `feat(auth): add session persistence`

---

#### T98.3: Add Logout Flow [S - 1h]
**Files:** `src/hooks/useRailwayAuth.ts`, `src/App.tsx`

**Description:** Proper logout that clears session on Railway.

**Validation:**
- [ ] Logout button works
- [ ] Session cleared on Railway
- [ ] Redirects to login
- [ ] API calls fail after logout

**Commit:** `feat(auth): add logout flow`

---

#### T98.4: Add Auth Error Handling [M - 2h]
**Files:** `src/hooks/useRailwayAuth.ts`, `src/components/AuthErrorBoundary.tsx`

**Description:** Handle auth errors gracefully (expired session, network issues).

**Validation:**
- [ ] Expired session → redirect to login with message
- [ ] Network error → retry with exponential backoff
- [ ] Invalid token → clear and re-auth
- [ ] User sees friendly error messages

**Commit:** `feat(auth): add auth error handling`

---

## 📋 PHASE 5: CLEANUP & OPTIMIZATION (Sprints 99-100)

### Goal: Remove all Firebase/Firestore code, optimize bundle

---

### Sprint 99: Firebase Removal

**Sprint Goal:** Complete removal of Firebase from codebase

#### T99.1: Remove Firestore Imports [L - 4h]
**Files:** `src/App.tsx`, various services

**Description:** Remove all `firebase/firestore` imports and usages.

**Validation:**
- [ ] No `firebase/firestore` imports
- [ ] No `collection()`, `doc()`, `onSnapshot()` calls
- [ ] Build succeeds
- [ ] All data comes from Railway

**Commit:** `refactor(cleanup): remove Firestore imports`

---

#### T99.2: Remove Firebase Config [S - 30m]
**Files:** `src/App.tsx`, `.env`

**Description:** Remove Firebase configuration and environment variables.

**Validation:**
- [ ] No `firebaseConfig` object
- [ ] No `VITE_FIREBASE_*` env vars
- [ ] App runs without Firebase

**Commit:** `refactor(cleanup): remove Firebase config`

---

#### T99.3: Remove Firebase Package [S - 30m]
**Files:** `package.json`

**Description:** Uninstall Firebase package.

```bash
npm uninstall firebase
```

**Validation:**
- [ ] `firebase` not in package.json
- [ ] npm install succeeds
- [ ] Build succeeds
- [ ] Bundle size reduced

**Commit:** `refactor(cleanup): remove Firebase package`

---

#### T99.4: Remove Vercel Email Endpoints [M - 2h]
**Files:** `api/email/send.ts`, `api/email/status.ts`

**Description:** Remove direct email endpoints now that Railway handles all email.

**Validation:**
- [ ] Email endpoints removed or simplified to proxy
- [ ] No direct SendGrid calls from Vercel
- [ ] All email operations route to Railway

**Commit:** `refactor(cleanup): remove Vercel email endpoints`

---

#### T99.5: Add Railway Connection Status Indicator [S - 1h]
**Files:** `src/components/ConnectionStatus.tsx`, `src/hooks/useRailwayHealth.ts`

**Description:** Show users when Railway is connected vs disconnected. Essential for trust in the new architecture.

```typescript
// src/components/ConnectionStatus.tsx
export function ConnectionStatus() {
  const { isConnected, latency, lastCheck } = useRailwayHealth();
  
  if (isConnected) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        <span>Connected</span>
        {latency && <span className="text-slate-400">{latency}ms</span>}
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 text-xs text-amber-600">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      <span>Reconnecting...</span>
    </div>
  );
}
```

**Validation:**
- [ ] Green indicator when connected
- [ ] Amber indicator when reconnecting
- [ ] Red indicator on persistent failure (> 3 consecutive failures)
- [ ] Latency displayed when available
- [ ] Positioned in app header (top right)

**Commit:** `feat(ux): add Railway connection status indicator`

---

#### T99.6: Deprecate Firestore Security Rules [S - 30m]
**Files:** `firestore.rules`, `firestore.indexes.json`

**Description:** Archive Firestore configuration files since we no longer use Firestore.

```bash
mkdir -p archive/firestore
mv firestore.rules archive/firestore/
mv firestore.indexes.json archive/firestore/
echo "# Archived on $(date) - Migrated to Railway PostgreSQL" > archive/firestore/README.md
```

**Validation:**
- [ ] `firestore.rules` moved to archive
- [ ] `firestore.indexes.json` moved to archive
- [ ] README explains why archived
- [ ] Git history preserved

**Commit:** `chore(cleanup): archive Firestore configuration`

---

### Sprint 100: Performance & Polish

**Sprint Goal:** Optimize for production, add observability, final E2E verification

#### T100.1: Analyze Bundle Size [M - 2h]
**Files:** `vite.config.ts`, `docs/BUNDLE_ANALYSIS.md`

**Description:** Use bundle analyzer to identify large dependencies. Document results.

```bash
npm run build -- --analyze
```

**Target:** 
- `main.js` < 300KB gzipped
- `vendor.js` < 200KB gzipped
- Lazy-loaded routes not counted in initial bundle

**Validation:**
- [ ] Bundle analyzer report generated
- [ ] Largest chunks identified and documented
- [ ] Firebase completely gone from bundle
- [ ] Code splitting working for routes
- [ ] Results saved to `docs/BUNDLE_ANALYSIS.md`

**Commit:** `chore(perf): analyze and document bundle size`

---

#### T100.2: Add Error Tracking [M - 2h]
**Files:** `src/services/ErrorTracking.ts`, `src/App.tsx`

**Description:** Add Sentry or similar for production error tracking.

**Validation:**
- [ ] Errors reported to tracking service
- [ ] Source maps uploaded
- [ ] User context attached
- [ ] Performance metrics tracked

**Commit:** `feat(observability): add error tracking`

---

#### T100.3: Update Documentation [M - 2h]
**Files:** `README.md`, `docs/ARCHITECTURE.md`

**Description:** Document new Railway-first architecture.

**Validation:**
- [ ] README updated with new setup
- [ ] Architecture diagram updated
- [ ] API documentation updated
- [ ] Environment variables documented

**Commit:** `docs: update for Railway architecture`

---

#### T100.4a: Add Auth E2E Tests [M - 1h]
**Files:** `e2e/auth.spec.ts`

**Description:** E2E tests for authentication flows.

```typescript
test.describe('Auth', () => {
  test('login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name=email]', 'test@example.com');
    await page.fill('[name=password]', 'password');
    await page.click('button[type=submit]');
    await expect(page.getByTestId('dashboard')).toBeVisible();
  });
  
  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name=email]', 'wrong@example.com');
    await page.fill('[name=password]', 'wrong');
    await page.click('button[type=submit]');
    await expect(page.getByText('Invalid credentials')).toBeVisible();
  });
  
  test('logout redirects to login', async ({ page, authContext }) => {
    await page.goto('/');
    await page.click('[data-testid=logout]');
    await expect(page).toHaveURL('/login');
  });
});
```

**Validation:**
- [ ] Login success test passes
- [ ] Login failure test passes
- [ ] Logout test passes
- [ ] Protected route redirect test passes

**Commit:** `test(e2e): add auth E2E tests`

---

#### T100.4b: Add Prospect CRUD E2E Tests [M - 1h]
**Files:** `e2e/prospects.spec.ts`

**Description:** E2E tests for prospect operations.

**Validation:**
- [ ] Create prospect test passes
- [ ] Update prospect test passes
- [ ] Search prospect test passes
- [ ] Status change test passes

**Commit:** `test(e2e): add prospect CRUD E2E tests`

---

#### T100.4c: Add Email Workflow E2E Tests [M - 1h]
**Files:** `e2e/email.spec.ts`

**Description:** E2E tests for email and sequence operations.

**Validation:**
- [ ] Send email test passes
- [ ] Enroll in sequence test passes
- [ ] Pause enrollment test passes
- [ ] View email analytics test passes

**Commit:** `test(e2e): add email workflow E2E tests`

---

#### T100.4d: Full Journey Integration Test [M - 1h]
**Files:** `e2e/full-journey.spec.ts`

**Description:** End-to-end test of complete user workflow via Railway.

```typescript
// e2e/full-journey.spec.ts
test.describe('Full Journey', () => {
  test('complete sales workflow', async ({ page }) => {
    // 1. Login via Railway auth
    await page.goto('/login');
    await page.fill('[name=email]', 'test@example.com');
    await page.fill('[name=password]', 'password');
    await page.click('button[type=submit]');
    
    // 2. View prospects from Railway
    await expect(page.getByTestId('prospect-list')).toBeVisible();
    
    // 3. Create new prospect
    await page.click('[data-testid=add-prospect]');
    await page.fill('[name=name]', 'Test Prospect');
    await page.fill('[name=email]', 'test.prospect@example.com');
    await page.click('[data-testid=save-prospect]');
    
    // 4. Enroll prospect in sequence
    await page.click('[data-testid=prospect-row]:first-child');
    await page.click('[data-testid=start-sequence]');
    await page.click('[data-testid=sequence-cold-outreach]');
    
    // 5. Verify enrollment
    await expect(page.getByText('Enrolled in Cold Outreach')).toBeVisible();
    
    // 6. Check email queue status shows pending
    await expect(page.getByTestId('queue-status')).toContainText('pending');
  });
});
```

**Validation:**
- [ ] E2E test passes end-to-end
- [ ] All Railway API calls work
- [ ] Auth flow works
- [ ] Email queuing works
- [ ] Test completes in < 60 seconds

**Commit:** `test(e2e): add full journey integration test`

---

#### T100.5: Add Railway Health Monitoring Dashboard [M - 2h]
**Files:** `docs/MONITORING_SETUP.md`, Railway dashboard configuration

**Description:** Set up monitoring and alerting for Railway services.

**Metrics to track:**
- Railway API latency (P50, P95, P99)
- Railway API error rate
- BullMQ queue depth
- PostgreSQL connection pool usage
- Redis memory usage

**Alerts to configure:**
- API latency > 1s for 5 minutes
- Error rate > 1% for 5 minutes
- Queue depth > 100 for 10 minutes
- Database connections > 80% for 5 minutes

**Validation:**
- [ ] Health check endpoint monitored (uptime service)
- [ ] Latency tracking configured
- [ ] Error rate alerting configured
- [ ] Queue depth alerting configured
- [ ] Alert notification channel configured (Slack/email)
- [ ] Documentation saved to `docs/MONITORING_SETUP.md`

**Commit:** `chore(ops): add Railway monitoring configuration`

---

#### T100.6: Update CI/CD Pipeline [M - 2h]
**Files:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

**Description:** Update CI/CD to remove Firebase steps and add Railway health checks.

**Changes:**
- Remove Firebase deploy steps
- Remove Firebase emulator from tests
- Add Railway health check before deploy
- Add post-deploy verification
- Update environment variables

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    steps:
      - name: Pre-deploy Railway health check
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" $RAILWAY_URL/health)
          if [ "$response" != "200" ]; then
            echo "Railway unhealthy, aborting deploy"
            exit 1
          fi
      
      - name: Deploy to Vercel
        run: vercel deploy --prod
      
      - name: Post-deploy verification
        run: |
          sleep 30
          curl -f $VERCEL_URL/api/railway/health
```

**Validation:**
- [ ] CI passes without Firebase
- [ ] Railway health check runs before deploy
- [ ] Post-deploy verification passes
- [ ] No Firebase environment variables in CI
- [ ] Build time improved (no Firebase setup)

**Commit:** `ci: update pipeline for Railway architecture`

---

## 📊 SPRINT SUMMARY

| Sprint | Phase | Goal | Tasks | Est. Hours |
|--------|-------|------|-------|------------|
| 90 | Foundation | Safety & audit | 6 | 11h |
| 91 | API Client | Railway API client foundation | 5 | 12h |
| 92 | API Client | Proxy improvements | 4 | 8h |
| 93 | Data Migration | Prospect migration | 10 | 18h |
| 94 | Data Migration | Sequence/enrollment migration | 6 | 11h |
| 95 | Email | Email queue migration | 6 | 15h |
| 96 | Email | Tracking & webhooks | 5 | 8h |
| 97 | Auth | Auth migration | 7 | 20h |
| 98 | Auth | Session management | 4 | 7h |
| 99 | Cleanup | Firebase removal | 6 | 9h |
| 100 | Cleanup | Performance & polish | 8 | 14h |

**Total: 67 tasks, ~133 hours**

**Key Changes from Review:**
- Fixed duplicate T93.4 → renamed to T93.8
- Added T90.6 (API gap remediation plan)
- Added T91.5 (Railway client unit tests)
- Added T93.0 (execute migration as prerequisite)
- Added T93.9 (reverse sync for rollback)
- Split T94.3 into T94.3a, T94.3b, T94.3c
- Added T94.5 (enrollment state machine docs)
- Added T95.6 (dead letter queue UI)
- Added T96.5 (webhook retry logic)
- Added T97.0.5 (user migration script)
- Added T97.5 (production soak test)
- Renumbered T97.4 → T97.6
- Added T99.6 (archive Firestore config)
- Split T100.4 into T100.4a-d
- Added T100.5 (monitoring dashboard)
- Added T100.6 (CI/CD update)
- Improved validation criteria throughout

---

## 🎯 SUCCESS CRITERIA

1. **No Firestore:** Zero Firebase/Firestore imports in codebase
2. **Single Auth:** Railway NextAuth is only auth source
3. **Email via Railway:** All emails queued through BullMQ
4. **Data in PostgreSQL:** All CRUD via Railway API
5. **Bundle < 500KB:** main.js < 300KB, vendor.js < 200KB gzipped
6. **E2E Passing:** Integration tests pass against Railway
7. **UX Polish:** Loading skeletons, connection indicators, queue status visible
8. **Observability:** Monitoring and alerting configured
9. **Documentation:** Architecture docs updated

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Migration (Sprint 90)
- [ ] Firestore backup created (T90.2)
- [ ] Railway API endpoints verified (T90.1)
- [ ] Missing endpoint tickets created (T90.6)
- [ ] Feature flags tested (T90.4)
- [ ] Performance baseline documented (T90.5)

### Data Migration (Sprint 93-94)
- [ ] Prospect migration script tested in staging
- [ ] Sequence migration script tested in staging
- [ ] User migration script tested in staging
- [ ] Reverse sync script tested and ready

### Auth Migration (Sprint 97)
- [ ] Dual-auth bridge tested
- [ ] 24h production soak test passed (T97.5)
- [ ] No user lockouts reported

### Final (Sprint 99-100)
- [ ] Railway backend deployed and healthy
- [ ] PostgreSQL migrated with all data
- [ ] Redis/BullMQ queues running
- [ ] SendGrid webhooks pointed to Vercel proxy
- [ ] NextAuth configured with production secrets
- [ ] Vercel env vars updated (remove Firebase, add Railway)
- [ ] DNS configured for production
- [ ] SSL certificates valid
- [ ] Monitoring/alerting configured (T100.5)
- [ ] CI/CD updated (T100.6)
- [ ] All E2E tests passing

---

## 📅 SPRINT DEMO SCRIPTS

| Sprint | Demo | Expected Outcome |
|--------|------|------------------|
| 90 | Run backup, show feature flag toggle, show baseline doc | Safety measures in place |
| 91 | Call `railwayClient.health()` in console, show typed response | API client ready |
| 92 | Fire 150 req/min → show 429, disconnect Railway → circuit opens | Proxy is production-grade |
| 93 | Toggle flag → prospects from Railway, create prospect → shows in DB | Prospects migrated |
| 94 | Show sequences from Railway, enroll prospect, pause enrollment | Sequences migrated |
| 95 | Send email → show in BullMQ, show queue status component | Email queue working |
| 96 | Send email → open → show event in Railway, show analytics | Tracking working |
| 97 | Login with Railway, show JWT cookie, Firebase fallback works | Auth migrated safely |
| 98 | Login → close tab → reopen → still logged in, logout works | Sessions robust |
| 99 | `npm run build` → no Firebase, show bundle size reduction | Firebase removed |
| 100 | E2E suite passes, Sentry dashboard, monitoring alerts | Production ready |

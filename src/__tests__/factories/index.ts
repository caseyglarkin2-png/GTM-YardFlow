/**
 * Test Mock Factories - GTM YardFlow
 * 
 * Provides factory functions for creating consistent mock data in tests.
 * Use these instead of inline mock objects for maintainability.
 */

import type { Prospect } from '@/types';
import type { CompanyRow } from '@/services/CompanyAggregator';
import type { RailwayHealthResponse, RailwayProspect, RailwaySequence, RailwayEnrollment } from '@/types/railway';
import type { CompanyTier } from '@/types/marketing';

// =============================================================================
// ID Generators
// =============================================================================

let idCounter = 0;

export function generateId(prefix = 'test'): string {
  return `${prefix}-${++idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

// =============================================================================
// Prospect Factories
// =============================================================================

export function createMockProspect(overrides: Partial<Prospect> = {}): Prospect {
  const id = generateId('prospect');
  return {
    id,
    name: `Test User ${id}`,
    firstName: 'Test',
    lastName: 'User',
    email: `test-${id}@example.com`,
    company: 'Test Corp',
    title: 'VP Operations',
    tier: 'Tier 1',
    score: 75,
    qualified: true,
    isExec: false,
    isOps: true,
    status: 'new',
    notes: '',
    ...overrides,
  };
}

export function createMockProspects(count: number, overrides: Partial<Prospect> = {}): Prospect[] {
  return Array.from({ length: count }, () => createMockProspect(overrides));
}

// =============================================================================
// Company Factories
// =============================================================================

export function createMockCompanyRow(overrides: Partial<CompanyRow> = {}): CompanyRow {
  const id = generateId('company');
  const contacts = overrides.contacts || [
    createMockProspect({ isExec: true }),
    createMockProspect({ isOps: true }),
  ];
  
  return {
    id,
    company: `Test Company ${id}`,
    tier: 'Tier 2' as CompanyTier,
    contactCount: contacts.length,
    facilityCount: 50,
    hasGateBottleneck: true,
    gateConfidence: 'high',
    gateLabel: 'Likely',
    industryCategory: 'beverage',
    estimatedTruckVolume: 100,
    distributionFootprint: 'national',
    primoLookalikeScore: 65,
    roiPotential: 50_000_000,
    contacts,
    execCount: contacts.filter(c => c.isExec).length,
    opsCount: contacts.filter(c => c.isOps).length,
    execOpsCount: 0,
    lastResearchedAt: null,
    needsResearch: false,
    ...overrides,
  };
}

export function createMockCompanyRows(count: number, overrides: Partial<CompanyRow> = {}): CompanyRow[] {
  return Array.from({ length: count }, () => createMockCompanyRow(overrides));
}

// =============================================================================
// Railway Type Factories
// =============================================================================

export function createMockRailwayProspect(overrides: Partial<RailwayProspect> = {}): RailwayProspect {
  const id = generateId('rw-prospect');
  return {
    id,
    email: `railway-${id}@example.com`,
    firstName: 'Railway',
    lastName: 'User',
    company: 'Railway Corp',
    title: 'Director',
    tier: 'Tier 1',
    status: 'new',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockRailwaySequence(overrides: Partial<RailwaySequence> = {}): RailwaySequence {
  const id = generateId('sequence');
  return {
    id,
    name: `Test Sequence ${id}`,
    description: 'Test sequence for unit tests',
    steps: [
      { type: 'email', subject: 'Step 1', body: 'First email', delayDays: 0 },
      { type: 'wait', delayDays: 3 },
      { type: 'email', subject: 'Step 2', body: 'Follow up', delayDays: 0 },
    ],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockRailwayEnrollment(overrides: Partial<RailwayEnrollment> = {}): RailwayEnrollment {
  const id = generateId('enrollment');
  return {
    id,
    prospectId: generateId('prospect'),
    sequenceId: generateId('sequence'),
    status: 'active',
    currentStep: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// =============================================================================
// Health Response Factories
// =============================================================================

export function createMockHealthResponse(
  status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
): RailwayHealthResponse {
  const isHealthy = status === 'healthy';
  const isDegraded = status === 'degraded';
  
  return {
    status,
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: isHealthy || isDegraded ? 'ok' : 'error', latencyMs: 5 },
      redis: { status: isHealthy ? 'ok' : 'error', latencyMs: 2 },
      queues: {
        enrichment: isHealthy ? 'ready' : 'paused',
        outreach: isHealthy ? 'ready' : 'paused',
        emails: isHealthy ? 'ready' : 'error',
        sequence: isHealthy ? 'ready' : 'paused',
      },
      ai: {
        gemini: { status: isHealthy ? 'ok' : 'error', latencyMs: 150, quotaRemaining: 1000 },
        openai: { status: isHealthy ? 'ok' : 'error', latencyMs: 200 },
      },
    },
    version: '1.0.0',
    uptime: 86400,
  };
}

// =============================================================================
// Bulk Email Factories
// =============================================================================

export interface MockBulkRecipient {
  id: string;
  prospect: Prospect;
  status: 'pending' | 'generating' | 'generated' | 'approved' | 'sending' | 'sent' | 'failed';
  subject: string;
  body: string;
  error?: string;
}

export function createMockBulkRecipient(
  status: MockBulkRecipient['status'] = 'pending',
  overrides: Partial<MockBulkRecipient> = {}
): MockBulkRecipient {
  const prospect = createMockProspect();
  return {
    id: prospect.id,
    prospect,
    status,
    subject: 'Test Subject',
    body: 'Test body content',
    ...overrides,
  };
}

export function createMockBulkRecipients(
  count: number,
  statuses?: MockBulkRecipient['status'][]
): MockBulkRecipient[] {
  return Array.from({ length: count }, (_, i) => 
    createMockBulkRecipient(statuses?.[i] || 'pending')
  );
}

// =============================================================================
// API Response Factories
// =============================================================================

export function createMockPaginatedResponse<T>(items: T[], total?: number) {
  return {
    items,
    total: total ?? items.length,
    limit: 50,
    offset: 0,
  };
}

export function createMockErrorResponse(
  status: number,
  message: string,
  code?: string
) {
  return {
    error: message,
    code,
    requestId: generateId('req'),
    detail: `Error occurred at ${new Date().toISOString()}`,
  };
}

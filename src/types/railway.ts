/**
 * T91.1: Railway TypeScript Types
 * 
 * Type definitions for all Railway API entities.
 * These mirror the Railway PostgreSQL schema and API responses.
 */

// =============================================================================
// Base Types
// =============================================================================

export type UUID = string;
export type ISO8601 = string; // ISO 8601 date string

export interface Timestamps {
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

// =============================================================================
// Prospect Types
// =============================================================================

export type ProspectStatus =
  | 'new'
  | 'researching'
  | 'contacted'
  | 'replied'
  | 'meeting_scheduled'
  | 'closed_won'
  | 'closed_lost'
  | 'nurturing';

export type ProspectTier = 'Tier 1' | 'Tier 2' | 'Tier 3';

export interface RailwayProspect extends Timestamps {
  id: UUID;
  firstName: string;
  lastName: string;
  name: string; // Computed: firstName + lastName
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  title: string | null;
  companyName: string | null;
  companyId: UUID | null;
  linkedinUrl: string | null;
  status: ProspectStatus;
  tier: ProspectTier;
  score: number; // 0-100
  notes: string | null;
  lastContactedAt: ISO8601 | null;
  timezone: string | null;
  tags: string[];
  customFields: Record<string, unknown>;
}

export interface CreateProspectRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  companyName?: string;
  companyId?: UUID;
  linkedinUrl?: string;
  status?: ProspectStatus;
  tier?: ProspectTier;
  score?: number;
  notes?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

export interface UpdateProspectRequest {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  companyName?: string | null;
  companyId?: UUID | null;
  linkedinUrl?: string | null;
  status?: ProspectStatus;
  tier?: ProspectTier;
  score?: number;
  notes?: string | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

// Type aliases for hook compatibility
export type CreateProspectInput = CreateProspectRequest;
export type UpdateProspectInput = UpdateProspectRequest;
export type ProspectFilters = ProspectSearchParams;

export interface ProspectSearchParams {
  query?: string;
  status?: ProspectStatus | ProspectStatus[];
  tier?: ProspectTier | ProspectTier[];
  companyId?: UUID;
  tags?: string[];
  minScore?: number;
  maxScore?: number;
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'score' | 'createdAt' | 'updatedAt' | 'lastContactedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface BatchUpsertProspectRequest {
  prospects: CreateProspectRequest[];
  updateOnConflict?: boolean; // If true, update existing by email
}

export interface BatchUpsertProspectResponse {
  created: number;
  updated: number;
  failed: number;
  errors: Array<{
    index: number;
    email?: string;
    error: string;
  }>;
}

// =============================================================================
// Sequence Types
// =============================================================================

export type SequenceStatus = 'draft' | 'active' | 'paused' | 'completed';

export type StepType = 'email' | 'wait' | 'task' | 'linkedin' | 'call';

export interface SequenceStep {
  id: UUID;
  order: number;
  type: StepType;
  delayDays: number;
  delayHours?: number;
  subject?: string; // For email steps
  body?: string; // For email steps
  taskDescription?: string; // For task steps
  templateId?: UUID;
  skipWeekends?: boolean;
  skipHolidays?: boolean;
}

export interface RailwaySequence extends Timestamps {
  id: UUID;
  name: string;
  description: string | null;
  status: SequenceStatus;
  steps: SequenceStep[];
  enrollmentCount: number;
  activeEnrollmentCount: number;
  completedEnrollmentCount: number;
  ownerId: UUID;
}

export interface CreateSequenceRequest {
  name: string;
  description?: string;
  steps: Omit<SequenceStep, 'id'>[];
}

export interface UpdateSequenceRequest {
  name?: string;
  description?: string | null;
  status?: SequenceStatus;
  steps?: Omit<SequenceStep, 'id'>[];
}

// =============================================================================
// Enrollment Types
// =============================================================================

export type EnrollmentStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'replied'; // Auto-pause on reply

export interface RailwayEnrollment extends Timestamps {
  id: UUID;
  sequenceId: UUID;
  prospectId: UUID;
  status: EnrollmentStatus;
  currentStepIndex: number;
  totalSteps: number;
  nextStepAt: ISO8601 | null;
  nextSendAt?: ISO8601 | null; // Alias for nextStepAt for compatibility
  completedAt: ISO8601 | null;
  pausedAt: ISO8601 | null;
  pauseReason: string | null;
  sequence?: RailwaySequence;
  prospect?: RailwayProspect;
}

export interface CreateEnrollmentRequest {
  sequenceId: UUID;
  prospectId: UUID;
  startImmediately?: boolean;
}

export interface BulkEnrollRequest {
  sequenceId: UUID;
  prospectIds: UUID[];
  startImmediately?: boolean;
}

export interface BulkEnrollResponse {
  enrolled: number;
  skipped: number; // Already enrolled
  failed: number;
  errors: Array<{
    prospectId: UUID;
    error: string;
  }>;
}

// =============================================================================
// Email Types
// =============================================================================

export type EmailStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'failed'
  | 'complained';

export interface RailwayEmail extends Timestamps {
  id: UUID;
  prospectId: UUID;
  enrollmentId: UUID | null;
  sequenceId: UUID | null;
  stepIndex: number | null;
  to: string;
  from: string;
  subject: string;
  body: string;
  htmlBody?: string;
  status: EmailStatus;
  sentAt: ISO8601 | null;
  deliveredAt: ISO8601 | null;
  openedAt: ISO8601 | null;
  clickedAt: ISO8601 | null;
  bouncedAt: ISO8601 | null;
  bounceReason: string | null;
  sendgridMessageId: string | null;
}

export interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  prospectId?: UUID;
  enrollmentId?: UUID;
  sequenceId?: UUID;
  stepIndex?: number;
  scheduledAt?: ISO8601;
  trackOpens?: boolean;
  trackClicks?: boolean;
}

export interface SendEmailResponse {
  id: UUID;
  status: 'queued' | 'sent';
  scheduledAt?: ISO8601;
}

// =============================================================================
// Email Queue Types
// =============================================================================

export interface QueueStatus {
  name: string;
  status: 'ready' | 'paused' | 'error';
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface DeadLetterItem {
  id: string;
  name: string;
  data: Record<string, unknown>;
  failedReason: string;
  attemptsMade: number;
  timestamp: ISO8601;
}

export interface EmailQueueStatusResponse {
  queues: {
    emails: QueueStatus;
    outreach: QueueStatus;
    enrichment: QueueStatus;
    sequence: QueueStatus;
  };
  deadLetterCount: number;
}

// =============================================================================
// Analytics Types
// =============================================================================

export interface EmailAnalytics {
  period: 'day' | 'week' | 'month';
  startDate: ISO8601;
  endDate: ISO8601;
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
    openRate: number; // 0-100
    clickRate: number; // 0-100
    bounceRate: number; // 0-100
  };
  byDay?: Array<{
    date: ISO8601;
    sent: number;
    opened: number;
    clicked: number;
  }>;
}

export interface SequenceAnalytics {
  sequenceId: UUID;
  name: string;
  metrics: {
    totalEnrollments: number;
    activeEnrollments: number;
    completedEnrollments: number;
    repliedEnrollments: number;
    cancelledEnrollments: number;
    avgStepsCompleted: number;
    replyRate: number; // 0-100
    completionRate: number; // 0-100
  };
  stepMetrics: Array<{
    stepIndex: number;
    type: StepType;
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
  }>;
}

// =============================================================================
// Health Check Types
// =============================================================================

export interface RailwayHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: ISO8601;
  checks: {
    database: {
      status: 'ok' | 'error';
      latencyMs: number;
      message?: string;
    };
    redis: {
      status: 'ok' | 'error';
      latencyMs: number;
      message?: string;
    };
    queues: {
      enrichment: 'ready' | 'paused' | 'error';
      outreach: 'ready' | 'paused' | 'error';
      emails: 'ready' | 'paused' | 'error';
      sequence: 'ready' | 'paused' | 'error';
    };
  };
  version?: string;
  uptime?: number; // seconds
}

// =============================================================================
// Auth Types (for Sprint 97)
// =============================================================================

export interface RailwayUser {
  id: UUID;
  email: string;
  name: string | null;
  image: string | null;
  role: 'admin' | 'user' | 'viewer';
  createdAt: ISO8601;
  lastLoginAt: ISO8601 | null;
}

export interface RailwaySession {
  user: RailwayUser;
  accessToken: string;
  refreshToken?: string;
  expiresAt: ISO8601;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface MigrateFromFirebaseRequest {
  firebaseUid: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  emailVerified: boolean;
}

// =============================================================================
// Webhook Types
// =============================================================================

export interface SendGridWebhookEvent {
  email: string;
  timestamp: number;
  'smtp-id': string;
  event: 'processed' | 'dropped' | 'delivered' | 'bounce' | 'open' | 'click' | 'spamreport' | 'unsubscribe';
  sg_event_id: string;
  sg_message_id: string;
  category?: string[];
  reason?: string;
  status?: string;
  url?: string; // For click events
  useragent?: string;
  ip?: string;
}

// =============================================================================
// API Response Wrappers
// =============================================================================

export type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: ApiError };

export interface RailwayApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}

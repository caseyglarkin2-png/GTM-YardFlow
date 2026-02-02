/**
 * Email Sequence Types - YardFlow Hub
 * 
 * Type definitions for multi-step email campaigns,
 * sequence templates, and A/B testing.
 */

import { z } from 'zod';

// ============================================
// Email Step Types
// ============================================

export const EmailStepTypeSchema = z.enum([
  'initial',       // First cold outreach
  'follow_up_1',   // First follow-up (value-add)
  'follow_up_2',   // Second follow-up (pain agitation)
  'break_up',      // Final "breaking up" email
  'meeting_confirm', // Meeting confirmation
  'no_show',       // No-show follow-up
]);

export type EmailStepType = z.infer<typeof EmailStepTypeSchema>;

// ============================================
// Email Template Variant Types (for A/B Testing)
// ============================================

export const EmailTemplateVariantSchema = z.object({
  id: z.string(),
  parentTemplateId: z.string().optional(), // Reference to parent step/template
  name: z.string(), // e.g., "Variant A", "Variant B"
  subject: z.string().optional(),
  body: z.string(),
  traffic: z.number().min(0).max(100).default(50), // percentage 0-100
});

export type EmailTemplateVariant = z.infer<typeof EmailTemplateVariantSchema>;

export const EmailStepSchema = z.object({
  id: z.string(),
  type: EmailStepTypeSchema,
  subject: z.string(),
  body: z.string(),
  delayDays: z.number().min(0),
  delayHours: z.number().min(0).max(23).optional(),
  sendTime: z.enum(['morning', 'midday', 'afternoon', 'evening']).optional(),
  condition: z.enum([
    'always',           // Always send
    'no_reply',         // Only if no reply yet
    'no_open',          // Only if not opened
    'opened_no_click',  // Opened but didn't click
    'clicked',          // Clicked a link
  ]).optional().default('no_reply'),
  variants: z.array(EmailTemplateVariantSchema).optional(),
});

export type EmailStep = z.infer<typeof EmailStepSchema>;

// ============================================
// Sequence Types
// ============================================

export const SequenceStatusSchema = z.enum([
  'draft',
  'active',
  'paused',
  'completed',
  'archived',
]);

export type SequenceStatus = z.infer<typeof SequenceStatusSchema>;

export const EmailSequenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  persona: z.enum(['ops_director', 'cfo', 'cio', 'vp_supply_chain', 'manifest_attendee', 'logistics_executive']).optional(),
  tier: z.enum(['Tier 1', 'Tier 2', 'Tier 3']).optional(),
  steps: z.array(EmailStepSchema),
  status: SequenceStatusSchema.default('draft'),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().optional(),
  
  // Metrics
  enrolledCount: z.number().default(0),
  completedCount: z.number().default(0),
  replyRate: z.number().min(0).max(100).optional(),
  meetingRate: z.number().min(0).max(100).optional(),
  
  // Settings
  skipWeekends: z.boolean().default(true),
  pauseOnReply: z.boolean().default(true),
  pauseOnMeeting: z.boolean().default(true),
  timezone: z.string().default('America/New_York'),
});

export type EmailSequence = z.infer<typeof EmailSequenceSchema>;

// ============================================
// Enrollment Types
// ============================================

export const EnrollmentStatusSchema = z.enum([
  'active',     // Currently receiving emails
  'paused',     // Temporarily paused
  'completed',  // Finished all steps
  'replied',    // Prospect replied
  'meeting',    // Meeting booked
  'bounced',    // Email bounced
  'unsubscribed', // Opted out
]);

export type EnrollmentStatus = z.infer<typeof EnrollmentStatusSchema>;

export const SequenceEnrollmentSchema = z.object({
  id: z.string(),
  sequenceId: z.string(),
  prospectId: z.string(),
  prospectEmail: z.string().email(),
  prospectName: z.string(),
  companyName: z.string(),
  
  status: EnrollmentStatusSchema,
  currentStepIndex: z.number().default(0),
  
  enrolledAt: z.string(),
  lastSentAt: z.string().optional(),      // When last step was sent
  nextSendAt: z.string().optional(),      // When next step should be sent (ISO timestamp)
  completedAt: z.string().optional(),
  pausedAt: z.string().optional(),
  pauseReason: z.string().optional(),
  
  // Step history
  stepHistory: z.array(z.object({
    stepId: z.string(),
    variantId: z.string().optional(),
    sentAt: z.string(),
    openedAt: z.string().optional(),
    clickedAt: z.string().optional(),
    repliedAt: z.string().optional(),
    bouncedAt: z.string().optional(),
  })).default([]),
  
  // Personalization overrides
  customFields: z.record(z.string(), z.string()).optional(),
  
  // T904.4: User Attribution & Rate Limiting
  userId: z.string().optional(),
});

export type SequenceEnrollment = z.infer<typeof SequenceEnrollmentSchema>;

// ============================================
// Campaign Types
// ============================================

export const CampaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  
  // Campaign targets
  sequenceIds: z.array(z.string()),
  segmentId: z.string().optional(),
  
  // Schedule
  startDate: z.string(),
  endDate: z.string().optional(),
  
  status: z.enum(['draft', 'scheduled', 'active', 'paused', 'completed']),
  
  // Goals
  targetEnrollments: z.number().optional(),
  targetReplies: z.number().optional(),
  targetMeetings: z.number().optional(),
  
  // Metrics
  metrics: z.object({
    totalEnrolled: z.number().default(0),
    totalSent: z.number().default(0),
    totalOpened: z.number().default(0),
    totalClicked: z.number().default(0),
    totalReplied: z.number().default(0),
    totalMeetings: z.number().default(0),
    totalBounced: z.number().default(0),
    totalUnsubscribed: z.number().default(0),
  }).default({
    totalEnrolled: 0,
    totalSent: 0,
    totalOpened: 0,
    totalClicked: 0,
    totalReplied: 0,
    totalMeetings: 0,
    totalBounced: 0,
    totalUnsubscribed: 0,
  }),
  
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Campaign = z.infer<typeof CampaignSchema>;

// ============================================
// A/B Test Types
// ============================================

export const ABTestSchema = z.object({
  id: z.string(),
  name: z.string(),
  sequenceId: z.string(),
  stepId: z.string(),
  
  // Test configuration
  testType: z.enum(['subject', 'body', 'send_time', 'full_email']),
  variants: z.array(z.object({
    id: z.string(),
    name: z.string(),
    content: z.record(z.string(), z.string()),  // subject, body, etc.
    weight: z.number().default(50),
  })),
  
  // Test parameters
  sampleSize: z.number().min(10).default(100),
  winningMetric: z.enum(['open_rate', 'click_rate', 'reply_rate']).default('reply_rate'),
  confidenceLevel: z.number().min(0.8).max(0.99).default(0.95),
  
  // Status
  status: z.enum(['draft', 'running', 'complete', 'cancelled']),
  winner: z.string().optional(),  // Variant ID of winner
  
  // Results per variant
  results: z.array(z.object({
    variantId: z.string(),
    sent: z.number(),
    opened: z.number(),
    clicked: z.number(),
    replied: z.number(),
    conversionRate: z.number(),
    statisticalSignificance: z.number().optional(),
  })).default([]),
  
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

export type ABTest = z.infer<typeof ABTestSchema>;

// ============================================
// Sequence Template Types
// ============================================

export const SequenceTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum([
    'cold_outreach',
    'warm_intro',
    'event_follow_up',
    'content_nurture',
    'meeting_request',
    'break_up',
    'manifest_outreach',
  ]),
  persona: z.enum(['ops_director', 'cfo', 'cio', 'vp_supply_chain', 'manifest_attendee', 'logistics_executive']).optional(),
  
  steps: z.array(z.object({
    type: EmailStepTypeSchema,
    subjectTemplate: z.string(),
    bodyTemplate: z.string(),
    delayDays: z.number(),
    tips: z.array(z.string()).optional(),
  })),
  
  // Template metadata
  avgReplyRate: z.number().optional(),
  usageCount: z.number().default(0),
  rating: z.number().min(1).max(5).optional(),
  tags: z.array(z.string()).default([]),
});

export type SequenceTemplate = z.infer<typeof SequenceTemplateSchema>;

// ============================================
// Email Send Queue Types
// ============================================

export const EmailQueueItemSchema = z.object({
  id: z.string(),
  enrollmentId: z.string(),
  stepId: z.string(),
  variantId: z.string().optional(),
  
  // Recipient
  toEmail: z.string().email(),
  toName: z.string(),
  
  // Content (personalized)
  subject: z.string(),
  body: z.string(),
  
  // Scheduling
  scheduledFor: z.string(),
  timezone: z.string(),
  
  // Status
  status: z.enum(['queued', 'sending', 'sent', 'failed', 'cancelled']),
  sentAt: z.string().optional(),
  error: z.string().optional(),
  
  // Tracking
  trackingId: z.string(),
});

export type EmailQueueItem = z.infer<typeof EmailQueueItemSchema>;

// ============================================
// Utility Types
// ============================================

export interface SequenceStats {
  totalSteps: number;
  totalDuration: number;  // in days
  avgStepDelay: number;
  hasABTests: boolean;
  variantCount: number;
}

export interface EnrollmentProgress {
  currentStep: number;
  totalSteps: number;
  percentComplete: number;
  nextSendDate: string | null;
  daysRemaining: number;
}

export interface CampaignRates {
  openRate: number;
  clickRate: number;
  replyRate: number;
  meetingRate: number;
  bounceRate: number;
  unsubscribeRate: number;
}

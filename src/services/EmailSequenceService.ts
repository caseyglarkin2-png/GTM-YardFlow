/**
 * Email Sequence Service - YardFlow Hub
 * 
 * Core service for building, managing, and executing
 * multi-step email sequences with A/B testing support.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  EmailSequence,
  EmailStep,
  SequenceEnrollment,
  SequenceTemplate,
  SequenceStats,
  EnrollmentProgress,
  Campaign,
  CampaignRates,
  ABTest,
  EmailQueueItem,
} from '../types/emailSequence';

// Extended prospect type for email sequences
export interface EmailProspect {
  id: string;
  name: string;
  email: string;
  company: string;
  title: string;
  linkedinUrl?: string;
  persona?: string;
  industry?: string;
  company_trailer_count?: number;
}

// ============================================
// Sequence Templates
// ============================================

/**
 * Pre-built sequence templates for common use cases
 */
export const SEQUENCE_TEMPLATES: SequenceTemplate[] = [
  {
    id: 'cold-ops-director',
    name: 'Ops Director Cold Outreach',
    description: '4-step sequence targeting Operations Directors with yard management pain points',
    category: 'cold_outreach',
    persona: 'ops_director',
    steps: [
      {
        type: 'initial',
        subjectTemplate: 'Quick question about {{company}} yard operations',
        bodyTemplate: `Hi {{firstName}},

Noticed {{company}} is running {{trailerCount}}+ trailers—curious if detention fees are eating into margins.

YardFlow customers typically cut dwell time 40% and save $150+ per trailer annually.

Worth a 15-min chat to see if this applies to your operation?

Best,
{{senderName}}`,
        delayDays: 0,
        tips: ['Personalize trailer count if known', 'Reference recent company news if available'],
      },
      {
        type: 'follow_up_1',
        subjectTemplate: 'Re: Quick question about {{company}} yard operations',
        bodyTemplate: `Hi {{firstName}},

Just following up on my note about yard visibility. Wanted to share a quick win our customers see:

→ $180K average annual savings
→ 40% reduction in detention fees
→ 6-month payback period

Happy to share specific numbers for your trailer volume. When works for a quick call?

{{senderName}}`,
        delayDays: 3,
        tips: ['Keep reply thread', 'Lead with specific ROI numbers'],
      },
      {
        type: 'follow_up_2',
        subjectTemplate: 'Thought of you when I saw this...',
        bodyTemplate: `{{firstName}},

Just helped a {{industry}} company with a similar setup cut their yard chaos by 40%.

Their biggest pain? Drivers waiting 2+ hours for dock assignments—sound familiar?

If detention fees are a headache, I'd love to show you how we solved it. 15 minutes?

{{senderName}}`,
        delayDays: 5,
        tips: ['Reference similar customer if possible', 'Agitate the pain point'],
      },
      {
        type: 'break_up',
        subjectTemplate: 'Should I close your file?',
        bodyTemplate: `Hi {{firstName}},

I've reached out a few times about reducing detention costs at {{company}}. 

I don't want to be a pest. If yard visibility isn't a priority right now, just let me know and I'll close your file.

But if it is something you're thinking about, I'm happy to pick this back up when timing is better.

Either way, wishing you and the team well.

{{senderName}}`,
        delayDays: 7,
        tips: ['Creates urgency without pressure', 'Often gets highest response rate'],
      },
    ],
    avgReplyRate: 12.5,
    usageCount: 156,
    rating: 4.5,
    tags: ['cold', 'operations', 'detention', 'roi'],
  },
  {
    id: 'cold-cfo',
    name: 'CFO Value Sequence',
    description: '3-step sequence for CFOs focused on financial impact and ROI',
    category: 'cold_outreach',
    persona: 'cfo',
    steps: [
      {
        type: 'initial',
        subjectTemplate: '{{company}}: $180K annual opportunity',
        bodyTemplate: `Hi {{firstName}},

Quick question: Is {{company}} tracking the true cost of yard inefficiency?

Companies with {{trailerCount}}+ trailers typically have $200K+ in hidden detention and dwell costs.

YardFlow customers see 4.2× ROI in Year 1 with 6-month payback.

Worth 15 minutes to run the numbers for {{company}}?

Best,
{{senderName}}`,
        delayDays: 0,
      },
      {
        type: 'follow_up_1',
        subjectTemplate: 'Re: {{company}}: $180K annual opportunity',
        bodyTemplate: `{{firstName}},

Following up with some specific numbers:

• $150/trailer/year in detention savings
• 40% reduction in yard dwell time
• 90-day implementation, 6-month payback

I can put together a custom ROI model for {{company}} if helpful. Just need 15 minutes.

{{senderName}}`,
        delayDays: 4,
      },
      {
        type: 'break_up',
        subjectTemplate: 'Quick follow-up on yard costs',
        bodyTemplate: `{{firstName}},

I'll keep this short—I know you're busy.

If reducing detention costs isn't a priority this quarter, no worries. 

If it is, I'm happy to put together a 1-page ROI summary for {{company}}. Just say the word.

Best,
{{senderName}}`,
        delayDays: 6,
      },
    ],
    avgReplyRate: 8.2,
    usageCount: 89,
    rating: 4.2,
    tags: ['cold', 'cfo', 'roi', 'financial'],
  },
];

// ============================================
// Sequence Builder
// ============================================

/**
 * Create a new email sequence from scratch
 */
export function createSequence(
  name: string,
  options: Partial<Omit<EmailSequence, 'id' | 'createdAt' | 'updatedAt' | 'steps'>> = {}
): EmailSequence {
  const now = new Date().toISOString();
  
  return {
    id: uuidv4(),
    name,
    steps: [],
    status: 'draft',
    enrolledCount: 0,
    completedCount: 0,
    skipWeekends: true,
    pauseOnReply: true,
    pauseOnMeeting: true,
    timezone: 'America/New_York',
    createdAt: now,
    updatedAt: now,
    ...options,
  };
}

/**
 * Create sequence from a template
 */
export function createFromTemplate(
  template: SequenceTemplate,
  name?: string
): EmailSequence {
  const sequence = createSequence(name || `${template.name} (Copy)`, {
    description: template.description,
    persona: template.persona,
  });
  
  sequence.steps = template.steps.map((step, index) => ({
    id: uuidv4(),
    type: step.type,
    subject: step.subjectTemplate,
    body: step.bodyTemplate,
    delayDays: step.delayDays,
    condition: index === 0 ? 'always' : 'no_reply',
  }));
  
  return sequence;
}

/**
 * Add a step to a sequence
 */
export function addStep(
  sequence: EmailSequence,
  step: Omit<EmailStep, 'id'>
): EmailSequence {
  return {
    ...sequence,
    steps: [...sequence.steps, { ...step, id: uuidv4() }],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Update a step in a sequence
 */
export function updateStep(
  sequence: EmailSequence,
  stepId: string,
  updates: Partial<EmailStep>
): EmailSequence {
  return {
    ...sequence,
    steps: sequence.steps.map(step =>
      step.id === stepId ? { ...step, ...updates } : step
    ),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Remove a step from a sequence
 */
export function removeStep(
  sequence: EmailSequence,
  stepId: string
): EmailSequence {
  return {
    ...sequence,
    steps: sequence.steps.filter(step => step.id !== stepId),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Reorder steps in a sequence
 */
export function reorderSteps(
  sequence: EmailSequence,
  fromIndex: number,
  toIndex: number
): EmailSequence {
  const steps = [...sequence.steps];
  const [removed] = steps.splice(fromIndex, 1);
  steps.splice(toIndex, 0, removed);
  
  return {
    ...sequence,
    steps,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================
// Sequence Validation
// ============================================

export interface ValidationError {
  field: string;
  message: string;
  stepId?: string;
}

/**
 * Validate a sequence before activation
 */
export function validateSequence(sequence: EmailSequence): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!sequence.name.trim()) {
    errors.push({ field: 'name', message: 'Sequence name is required' });
  }
  
  if (sequence.steps.length === 0) {
    errors.push({ field: 'steps', message: 'Sequence must have at least one step' });
  }
  
  sequence.steps.forEach((step, index) => {
    if (!step.subject.trim()) {
      errors.push({
        field: 'subject',
        message: `Step ${index + 1}: Subject line is required`,
        stepId: step.id,
      });
    }
    
    if (!step.body.trim()) {
      errors.push({
        field: 'body',
        message: `Step ${index + 1}: Email body is required`,
        stepId: step.id,
      });
    }
    
    if (index > 0 && step.delayDays < 1) {
      errors.push({
        field: 'delayDays',
        message: `Step ${index + 1}: Follow-up must be at least 1 day after previous step`,
        stepId: step.id,
      });
    }
    
    // Check for unresolved merge tags
    const unresolvedTags = findUnresolvedMergeTags(step.subject + step.body);
    if (unresolvedTags.length > 0) {
      errors.push({
        field: 'mergeTags',
        message: `Step ${index + 1}: Unresolved merge tags: ${unresolvedTags.join(', ')}`,
        stepId: step.id,
      });
    }
  });
  
  return errors;
}

/**
 * Find unresolved merge tags in content
 */
function findUnresolvedMergeTags(content: string): string[] {
  const validTags = [
    'firstName', 'lastName', 'fullName', 'email',
    'company', 'title', 'industry', 'trailerCount',
    'senderName', 'senderTitle', 'senderCompany',
  ];
  
  const tagPattern = /\{\{(\w+)\}\}/g;
  const found: string[] = [];
  let match;
  
  while ((match = tagPattern.exec(content)) !== null) {
    const tag = match[1];
    if (!validTags.includes(tag) && !found.includes(tag)) {
      found.push(`{{${tag}}}`);
    }
  }
  
  return found;
}

// ============================================
// Personalization
// ============================================

export interface PersonalizationContext {
  prospect: EmailProspect;
  sender: {
    name: string;
    title: string;
    company: string;
  };
  customFields?: Record<string, string>;
}

/**
 * Personalize email content with prospect data
 */
export function personalizeContent(
  content: string,
  context: PersonalizationContext
): string {
  const { prospect, sender, customFields = {} } = context;
  
  const nameParts = prospect.name.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  const replacements: Record<string, string> = {
    firstName,
    lastName,
    fullName: prospect.name,
    email: prospect.email,
    company: prospect.company,
    title: prospect.title,
    industry: prospect.industry || '',
    trailerCount: String(prospect.company_trailer_count || '50+'),
    senderName: sender.name,
    senderTitle: sender.title,
    senderCompany: sender.company,
    ...customFields,
  };
  
  let result = content;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  
  return result;
}

// ============================================
// Sequence Statistics
// ============================================

/**
 * Calculate sequence statistics
 */
export function getSequenceStats(sequence: EmailSequence): SequenceStats {
  const steps = sequence.steps;
  
  let totalDuration = 0;
  let variantCount = 0;
  
  steps.forEach((step, index) => {
    if (index > 0) {
      totalDuration += step.delayDays;
    }
    if (step.variants && step.variants.length > 0) {
      variantCount += step.variants.length;
    }
  });
  
  return {
    totalSteps: steps.length,
    totalDuration,
    avgStepDelay: steps.length > 1 ? totalDuration / (steps.length - 1) : 0,
    hasABTests: variantCount > 0,
    variantCount,
  };
}

// ============================================
// Enrollment Management
// ============================================

/**
 * Enroll a prospect in a sequence
 */
export function enrollProspect(
  sequence: EmailSequence,
  prospect: EmailProspect,
  customFields?: Record<string, string>
): SequenceEnrollment {
  return {
    id: uuidv4(),
    sequenceId: sequence.id,
    prospectId: prospect.id,
    prospectEmail: prospect.email,
    prospectName: prospect.name,
    companyName: prospect.company,
    status: 'active',
    currentStepIndex: 0,
    enrolledAt: new Date().toISOString(),
    stepHistory: [],
    customFields,
  };
}

/**
 * Calculate enrollment progress
 */
export function getEnrollmentProgress(
  enrollment: SequenceEnrollment,
  sequence: EmailSequence
): EnrollmentProgress {
  const totalSteps = sequence.steps.length;
  const currentStep = enrollment.currentStepIndex;
  const percentComplete = Math.round((currentStep / totalSteps) * 100);
  
  // Calculate next send date
  let nextSendDate: string | null = null;
  let daysRemaining = 0;
  
  if (currentStep < totalSteps && enrollment.status === 'active') {
    const nextStep = sequence.steps[currentStep];
    const lastSent = enrollment.stepHistory[enrollment.stepHistory.length - 1]?.sentAt;
    
    if (lastSent) {
      const lastDate = new Date(lastSent);
      lastDate.setDate(lastDate.getDate() + nextStep.delayDays);
      nextSendDate = lastDate.toISOString();
      
      const now = new Date();
      daysRemaining = Math.ceil((lastDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }
  }
  
  return {
    currentStep,
    totalSteps,
    percentComplete,
    nextSendDate,
    daysRemaining: Math.max(0, daysRemaining),
  };
}

// ============================================
// Campaign Management
// ============================================

/**
 * Create a new campaign
 */
export function createCampaign(
  name: string,
  sequenceIds: string[],
  options: Partial<Campaign> = {}
): Campaign {
  const now = new Date().toISOString();
  
  return {
    id: uuidv4(),
    name,
    sequenceIds,
    startDate: now,
    status: 'draft',
    metrics: {
      totalEnrolled: 0,
      totalSent: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalReplied: 0,
      totalMeetings: 0,
      totalBounced: 0,
      totalUnsubscribed: 0,
    },
    createdAt: now,
    updatedAt: now,
    ...options,
  };
}

/**
 * Calculate campaign performance rates
 */
export function getCampaignRates(campaign: Campaign): CampaignRates {
  const { metrics } = campaign;
  const sent = metrics.totalSent || 1; // Avoid division by zero
  
  return {
    openRate: (metrics.totalOpened / sent) * 100,
    clickRate: (metrics.totalClicked / sent) * 100,
    replyRate: (metrics.totalReplied / sent) * 100,
    meetingRate: (metrics.totalMeetings / sent) * 100,
    bounceRate: (metrics.totalBounced / sent) * 100,
    unsubscribeRate: (metrics.totalUnsubscribed / sent) * 100,
  };
}

// ============================================
// A/B Testing
// ============================================

/**
 * Create an A/B test for a sequence step
 */
export function createABTest(
  sequenceId: string,
  stepId: string,
  variants: Array<{ name: string; subject?: string; body: string }>
): ABTest {
  return {
    id: uuidv4(),
    name: `A/B Test - ${new Date().toLocaleDateString()}`,
    sequenceId,
    stepId,
    testType: 'full_email',
    variants: variants.map((v, i) => ({
      id: uuidv4(),
      name: v.name || `Variant ${String.fromCharCode(65 + i)}`,
      content: { subject: v.subject || '', body: v.body },
      weight: Math.floor(100 / variants.length),
    })),
    sampleSize: 100,
    winningMetric: 'reply_rate',
    confidenceLevel: 0.95,
    status: 'draft',
    results: [],
  };
}

/**
 * Select a variant for a prospect based on weights
 */
export function selectVariant(test: ABTest): string {
  const totalWeight = test.variants.reduce((sum, v) => sum + v.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const variant of test.variants) {
    random -= variant.weight;
    if (random <= 0) {
      return variant.id;
    }
  }
  
  return test.variants[0].id;
}

/**
 * Check if A/B test has reached statistical significance
 */
export function checkStatisticalSignificance(test: ABTest): {
  isSignificant: boolean;
  winner: string | null;
  confidence: number;
} {
  if (test.results.length < 2) {
    return { isSignificant: false, winner: null, confidence: 0 };
  }
  
  // Simple significance check based on sample size and conversion difference
  // In production, would use proper statistical tests
  const totalSent = test.results.reduce((sum, r) => sum + r.sent, 0);
  if (totalSent < test.sampleSize) {
    return { isSignificant: false, winner: null, confidence: 0 };
  }
  
  const sorted = [...test.results].sort((a, b) => b.conversionRate - a.conversionRate);
  const best = sorted[0];
  const second = sorted[1];
  
  // Simple heuristic: need 20%+ relative difference for significance
  const relativeDiff = best.conversionRate > 0 
    ? (best.conversionRate - second.conversionRate) / best.conversionRate 
    : 0;
  
  const isSignificant = relativeDiff >= 0.2 && best.sent >= 20;
  
  return {
    isSignificant,
    winner: isSignificant ? best.variantId : null,
    confidence: isSignificant ? test.confidenceLevel : relativeDiff,
  };
}

// ============================================
// Email Queue Management
// ============================================

/**
 * Queue an email for sending
 */
export function queueEmail(
  enrollment: SequenceEnrollment,
  step: EmailStep,
  personalizedSubject: string,
  personalizedBody: string,
  scheduledFor: Date,
  variantId?: string
): EmailQueueItem {
  return {
    id: uuidv4(),
    enrollmentId: enrollment.id,
    stepId: step.id,
    variantId,
    toEmail: enrollment.prospectEmail,
    toName: enrollment.prospectName,
    subject: personalizedSubject,
    body: personalizedBody,
    scheduledFor: scheduledFor.toISOString(),
    timezone: 'America/New_York',
    status: 'queued',
    trackingId: uuidv4(),
  };
}

/**
 * Calculate next send time respecting business hours and weekends
 */
export function calculateSendTime(
  baseDate: Date,
  delayDays: number,
  sendTime: 'morning' | 'midday' | 'afternoon' | 'evening' = 'morning',
  skipWeekends = true
): Date {
  const result = new Date(baseDate);
  let daysToAdd = delayDays;
  
  while (daysToAdd > 0) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    
    if (skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      continue; // Skip weekends
    }
    
    daysToAdd--;
  }
  
  // Set time of day
  const hours: Record<typeof sendTime, number> = {
    morning: 9,
    midday: 12,
    afternoon: 14,
    evening: 17,
  };
  
  result.setHours(hours[sendTime], 0, 0, 0);
  
  return result;
}

// ============================================
// Export utilities
// ============================================

export { SEQUENCE_TEMPLATES as templates };

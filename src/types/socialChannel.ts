/**
 * Social Channel Types - YardFlow Hub
 * 
 * Type definitions for multi-channel social outreach:
 * - LinkedIn (DM, Connection Request, InMail)
 * - Twitter/X (DM, Reply, Quote Tweet)
 * - Integration with CRM systems
 */

import { z } from 'zod';

// ============================================
// Channel Configuration
// ============================================

export const SocialChannelSchema = z.enum([
  'linkedin_connection',
  'linkedin_dm',
  'linkedin_inmail',
  'twitter_dm',
  'twitter_reply',
  'twitter_quote',
]);

export type SocialChannel = z.infer<typeof SocialChannelSchema>;

/**
 * Channel-specific limits and best practices
 */
export const SOCIAL_CHANNEL_CONFIG = {
  linkedin_connection: {
    name: 'LinkedIn Connection Request',
    maxChars: 300,
    icon: 'linkedin',
    color: '#0077B5',
    tips: [
      'Personalize with mutual connection or shared interest',
      'Keep it brief - connection notes have low visibility',
      'Include a soft value proposition',
    ],
    bestPractices: {
      optimalLength: { min: 50, max: 200 },
      includeQuestion: false,
      mentionMutualConnection: true,
    },
  },
  linkedin_dm: {
    name: 'LinkedIn Direct Message',
    maxChars: 8000,
    icon: 'linkedin',
    color: '#0077B5',
    tips: [
      'Start with personalized observation',
      'Keep first message under 300 chars for mobile',
      'End with a clear, soft CTA',
    ],
    bestPractices: {
      optimalLength: { min: 100, max: 300 },
      includeQuestion: true,
      mentionMutualConnection: false,
    },
  },
  linkedin_inmail: {
    name: 'LinkedIn InMail',
    maxChars: 1900,
    icon: 'linkedin',
    color: '#0077B5',
    tips: [
      'InMail has higher open rates for 1st degree connections',
      'Subject line is crucial - keep it intriguing',
      'Mention specific pain point or opportunity',
    ],
    bestPractices: {
      optimalLength: { min: 200, max: 500 },
      includeQuestion: true,
      mentionMutualConnection: false,
    },
  },
  twitter_dm: {
    name: 'Twitter/X Direct Message',
    maxChars: 10000,
    icon: 'twitter',
    color: '#1DA1F2',
    tips: [
      'Casual tone works better on Twitter',
      'Reference a recent tweet if relevant',
      'Keep first message tweet-length (~280 chars)',
    ],
    bestPractices: {
      optimalLength: { min: 50, max: 280 },
      includeQuestion: true,
      mentionMutualConnection: false,
    },
  },
  twitter_reply: {
    name: 'Twitter/X Public Reply',
    maxChars: 280,
    icon: 'twitter',
    color: '#1DA1F2',
    tips: [
      'Add value to the conversation first',
      'Avoid promotional language in public',
      'Use to start relationship before DM',
    ],
    bestPractices: {
      optimalLength: { min: 30, max: 200 },
      includeQuestion: false,
      mentionMutualConnection: false,
    },
  },
  twitter_quote: {
    name: 'Twitter/X Quote Tweet',
    maxChars: 280,
    icon: 'twitter',
    color: '#1DA1F2',
    tips: [
      'Add thoughtful commentary',
      'Tag the original author',
      'Build thought leadership first',
    ],
    bestPractices: {
      optimalLength: { min: 50, max: 200 },
      includeQuestion: false,
      mentionMutualConnection: false,
    },
  },
} as const;

// ============================================
// Social Outreach Types
// ============================================

export const SocialOutreachStatusSchema = z.enum([
  'draft',
  'scheduled',
  'sent',
  'delivered',
  'opened',      // For InMail
  'clicked',
  'replied',
  'connected',   // LinkedIn specific
  'failed',
  'bounced',
]);

export type SocialOutreachStatus = z.infer<typeof SocialOutreachStatusSchema>;

export const SocialOutreachSchema = z.object({
  id: z.string(),
  prospectId: z.string(),
  prospectName: z.string(),
  
  // Channel info
  channel: SocialChannelSchema,
  profileUrl: z.string().url().optional(),
  
  // Content
  message: z.string(),
  subject: z.string().optional(), // For InMail
  
  // Status tracking
  status: SocialOutreachStatusSchema,
  sentAt: z.string().optional(),
  deliveredAt: z.string().optional(),
  openedAt: z.string().optional(),
  repliedAt: z.string().optional(),
  
  // Engagement metrics
  wasOpened: z.boolean().default(false),
  wasClicked: z.boolean().default(false),
  wasReplied: z.boolean().default(false),
  
  // Context
  campaignId: z.string().optional(),
  sequenceId: z.string().optional(),
  stepIndex: z.number().optional(),
  
  // Metadata
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().optional(),
  notes: z.string().optional(),
});

export type SocialOutreach = z.infer<typeof SocialOutreachSchema>;

// ============================================
// Social Profile Types
// ============================================

export const SocialProfileSchema = z.object({
  id: z.string(),
  prospectId: z.string(),
  
  // LinkedIn
  linkedinUrl: z.string().url().optional(),
  linkedinUsername: z.string().optional(),
  linkedinHeadline: z.string().optional(),
  linkedinConnections: z.number().optional(),
  linkedinIsConnected: z.boolean().default(false),
  linkedinLastActivity: z.string().optional(),
  
  // Twitter
  twitterUrl: z.string().url().optional(),
  twitterHandle: z.string().optional(),
  twitterBio: z.string().optional(),
  twitterFollowers: z.number().optional(),
  twitterIsFollowing: z.boolean().default(false),
  twitterLastTweet: z.string().optional(),
  
  // Engagement history
  lastContactedAt: z.string().optional(),
  totalOutreaches: z.number().default(0),
  totalReplies: z.number().default(0),
  
  // Preferences
  preferredChannel: SocialChannelSchema.optional(),
  bestContactTime: z.enum(['morning', 'afternoon', 'evening']).optional(),
  
  updatedAt: z.string(),
});

export type SocialProfile = z.infer<typeof SocialProfileSchema>;

// ============================================
// Touchpoint Types
// ============================================

export const TouchpointTypeSchema = z.enum([
  'linkedin_view_profile',
  'linkedin_like_post',
  'linkedin_comment',
  'linkedin_share',
  'linkedin_connection_request',
  'linkedin_dm',
  'linkedin_inmail',
  'twitter_follow',
  'twitter_like',
  'twitter_retweet',
  'twitter_reply',
  'twitter_dm',
  'email_sent',
  'email_opened',
  'email_clicked',
  'phone_call',
  'meeting_scheduled',
  'meeting_completed',
]);

export type TouchpointType = z.infer<typeof TouchpointTypeSchema>;

export const TouchpointSchema = z.object({
  id: z.string(),
  prospectId: z.string(),
  type: TouchpointTypeSchema,
  channel: z.string(),
  timestamp: z.string(),
  
  // Details
  content: z.string().optional(),
  url: z.string().optional(),
  
  // Outcome
  wasSuccessful: z.boolean().default(true),
  response: z.string().optional(),
  
  // Attribution
  campaignId: z.string().optional(),
  sequenceId: z.string().optional(),
  userId: z.string().optional(),
});

export type Touchpoint = z.infer<typeof TouchpointSchema>;

// ============================================
// Cadence Types
// ============================================

/**
 * Multi-channel cadence for coordinated outreach
 */
export const CadenceStepSchema = z.object({
  id: z.string(),
  order: z.number(),
  channel: SocialChannelSchema.or(z.literal('email')),
  action: z.string(), // e.g., "send_dm", "view_profile", "like_post"
  delayDays: z.number(),
  delayHours: z.number().optional(),
  
  // Content (if applicable)
  messageTemplate: z.string().optional(),
  subjectTemplate: z.string().optional(),
  
  // Conditions
  skipIfReplied: z.boolean().default(true),
  skipIfConnected: z.boolean().default(false),
  requiredPreviousAction: z.string().optional(),
});

export type CadenceStep = z.infer<typeof CadenceStepSchema>;

export const CadenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  
  // Target
  persona: z.enum(['ops_director', 'cfo', 'cio', 'vp_supply_chain']).optional(),
  tier: z.enum(['Tier 1', 'Tier 2', 'Tier 3']).optional(),
  
  // Steps
  steps: z.array(CadenceStepSchema),
  
  // Settings
  status: z.enum(['draft', 'active', 'paused', 'archived']),
  skipWeekends: z.boolean().default(true),
  maxTouchesBeforePause: z.number().default(10),
  
  // Metrics
  enrolledCount: z.number().default(0),
  completedCount: z.number().default(0),
  replyRate: z.number().optional(),
  connectRate: z.number().optional(),
  
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Cadence = z.infer<typeof CadenceSchema>;

// ============================================
// Analytics Types
// ============================================

export interface ChannelPerformance {
  channel: SocialChannel;
  sent: number;
  delivered: number;
  opened: number;
  replied: number;
  connected: number;
  openRate: number;
  replyRate: number;
  connectRate: number;
}

export interface OutreachAnalytics {
  period: 'day' | 'week' | 'month' | 'quarter';
  startDate: string;
  endDate: string;
  
  // Totals
  totalOutreaches: number;
  totalReplies: number;
  totalConnections: number;
  totalMeetings: number;
  
  // Rates
  overallReplyRate: number;
  overallConnectRate: number;
  
  // By channel
  byChannel: ChannelPerformance[];
  
  // By day of week
  byDayOfWeek: Array<{
    day: string;
    sent: number;
    replied: number;
    replyRate: number;
  }>;
  
  // By time of day
  byTimeOfDay: Array<{
    hour: number;
    sent: number;
    replied: number;
    replyRate: number;
  }>;
}

// ============================================
// Integration Types
// ============================================

export interface LinkedInIntegration {
  isConnected: boolean;
  accountEmail: string;
  salesNavigatorEnabled: boolean;
  inmailCreditsRemaining: number;
  connectionRequestsToday: number;
  dailyLimitReached: boolean;
  lastSyncAt: string;
}

export interface TwitterIntegration {
  isConnected: boolean;
  accountHandle: string;
  dmLimitReached: boolean;
  rateLimitResetsAt: string;
  lastSyncAt: string;
}

/**
 * Social Channel Service - YardFlow Hub
 * 
 * Core service for multi-channel social outreach:
 * - Message formatting per channel
 * - Outreach tracking and analytics
 * - Cadence management
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SOCIAL_CHANNEL_CONFIG,
  type SocialChannel,
  type SocialOutreach,
  type SocialProfile,
  type Touchpoint,
  type TouchpointType,
  type Cadence,
  type CadenceStep,
  type ChannelPerformance,
  type OutreachAnalytics,
} from '../types/socialChannel';
import type { EmailProspect } from './EmailSequenceService';

// ============================================
// Message Formatting
// ============================================

export interface FormatOptions {
  prospect: EmailProspect;
  sender: {
    name: string;
    title: string;
    company: string;
  };
  customFields?: Record<string, string>;
}

/**
 * Format a message for a specific social channel
 */
export function formatForChannel(
  message: string,
  channel: SocialChannel,
  options: FormatOptions
): { formatted: string; warnings: string[] } {
  const config = SOCIAL_CHANNEL_CONFIG[channel];
  const warnings: string[] = [];
  
  // Personalize the message
  let formatted = personalizeMessage(message, options);
  
  // Check length
  if (formatted.length > config.maxChars) {
    warnings.push(`Message exceeds ${channel} limit (${formatted.length}/${config.maxChars} chars)`);
    // Truncate with ellipsis for display purposes
    formatted = formatted.substring(0, config.maxChars - 3) + '...';
  }
  
  // Channel-specific formatting
  switch (channel) {
    case 'twitter_reply':
    case 'twitter_quote':
      // Ensure it fits in a tweet
      if (formatted.length > 280) {
        warnings.push('Twitter messages should be under 280 characters');
      }
      break;
      
    case 'linkedin_connection':
      // Connection notes should be very concise
      if (formatted.length > 200) {
        warnings.push('Connection notes work best under 200 characters');
      }
      break;
      
    case 'linkedin_dm':
    case 'twitter_dm':
      // First message should be short
      if (formatted.length > 300) {
        warnings.push('First DMs perform better under 300 characters');
      }
      break;
  }
  
  // Check for best practices
  const { bestPractices } = config;
  if (bestPractices.includeQuestion && !formatted.includes('?')) {
    warnings.push('Consider adding a question to encourage response');
  }
  
  return { formatted, warnings };
}

/**
 * Personalize message with prospect data
 */
function personalizeMessage(message: string, options: FormatOptions): string {
  const { prospect, sender, customFields = {} } = options;
  
  const nameParts = prospect.name.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  const replacements: Record<string, string> = {
    firstName,
    lastName,
    fullName: prospect.name,
    company: prospect.company,
    title: prospect.title,
    industry: prospect.industry || '',
    senderName: sender.name,
    senderTitle: sender.title,
    senderCompany: sender.company,
    ...customFields,
  };
  
  let result = message;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  
  return result;
}

/**
 * Get channel-specific tips
 */
export function getChannelTips(channel: SocialChannel): readonly string[] {
  return SOCIAL_CHANNEL_CONFIG[channel].tips;
}

/**
 * Check if message meets channel best practices
 */
export function checkBestPractices(
  message: string,
  channel: SocialChannel
): { passes: boolean; feedback: string[] } {
  const config = SOCIAL_CHANNEL_CONFIG[channel];
  const { bestPractices } = config;
  const feedback: string[] = [];
  
  const length = message.length;
  
  if (length < bestPractices.optimalLength.min) {
    feedback.push(`Message too short (${length} chars, aim for ${bestPractices.optimalLength.min}+)`);
  }
  
  if (length > bestPractices.optimalLength.max) {
    feedback.push(`Message too long (${length} chars, aim for ${bestPractices.optimalLength.max} max)`);
  }
  
  if (bestPractices.includeQuestion && !message.includes('?')) {
    feedback.push('Add a question to encourage engagement');
  }
  
  return {
    passes: feedback.length === 0,
    feedback,
  };
}

// ============================================
// Outreach Management
// ============================================

/**
 * Create a new social outreach record
 */
export function createOutreach(
  prospectId: string,
  prospectName: string,
  channel: SocialChannel,
  message: string,
  options: {
    subject?: string;
    profileUrl?: string;
    campaignId?: string;
    sequenceId?: string;
    stepIndex?: number;
    notes?: string;
  } = {}
): SocialOutreach {
  const now = new Date().toISOString();
  
  return {
    id: uuidv4(),
    prospectId,
    prospectName,
    channel,
    message,
    subject: options.subject,
    profileUrl: options.profileUrl,
    status: 'draft',
    wasOpened: false,
    wasClicked: false,
    wasReplied: false,
    campaignId: options.campaignId,
    sequenceId: options.sequenceId,
    stepIndex: options.stepIndex,
    notes: options.notes,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update outreach status
 */
export function updateOutreachStatus(
  outreach: SocialOutreach,
  status: SocialOutreach['status'],
  timestamp?: string
): SocialOutreach {
  const now = timestamp || new Date().toISOString();
  
  const updates: Partial<SocialOutreach> = {
    status,
    updatedAt: now,
  };
  
  switch (status) {
    case 'sent':
      updates.sentAt = now;
      break;
    case 'delivered':
      updates.deliveredAt = now;
      break;
    case 'opened':
      updates.openedAt = now;
      updates.wasOpened = true;
      break;
    case 'replied':
      updates.repliedAt = now;
      updates.wasReplied = true;
      break;
  }
  
  return { ...outreach, ...updates };
}

// ============================================
// Social Profile Management
// ============================================

/**
 * Create a social profile for a prospect
 */
export function createSocialProfile(
  prospectId: string,
  linkedinUrl?: string,
  twitterHandle?: string
): SocialProfile {
  return {
    id: uuidv4(),
    prospectId,
    linkedinUrl,
    linkedinUsername: linkedinUrl ? extractLinkedInUsername(linkedinUrl) : undefined,
    linkedinIsConnected: false,
    twitterUrl: twitterHandle ? `https://twitter.com/${twitterHandle}` : undefined,
    twitterHandle,
    twitterIsFollowing: false,
    totalOutreaches: 0,
    totalReplies: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Extract LinkedIn username from URL
 */
function extractLinkedInUsername(url: string): string | undefined {
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  return match ? match[1] : undefined;
}

/**
 * Update social profile metrics
 */
export function updateProfileMetrics(
  profile: SocialProfile,
  outreach: SocialOutreach
): SocialProfile {
  return {
    ...profile,
    lastContactedAt: outreach.sentAt || profile.lastContactedAt,
    totalOutreaches: profile.totalOutreaches + 1,
    totalReplies: outreach.wasReplied ? profile.totalReplies + 1 : profile.totalReplies,
    linkedinIsConnected: outreach.status === 'connected' || profile.linkedinIsConnected,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================
// Touchpoint Tracking
// ============================================

/**
 * Record a touchpoint interaction
 */
export function recordTouchpoint(
  prospectId: string,
  type: TouchpointType,
  options: {
    content?: string;
    url?: string;
    wasSuccessful?: boolean;
    response?: string;
    campaignId?: string;
    sequenceId?: string;
    userId?: string;
  } = {}
): Touchpoint {
  // Derive channel from touchpoint type
  const channel = type.startsWith('linkedin') 
    ? 'linkedin' 
    : type.startsWith('twitter')
    ? 'twitter'
    : type.startsWith('email')
    ? 'email'
    : 'other';
  
  return {
    id: uuidv4(),
    prospectId,
    type,
    channel,
    timestamp: new Date().toISOString(),
    content: options.content,
    url: options.url,
    wasSuccessful: options.wasSuccessful ?? true,
    response: options.response,
    campaignId: options.campaignId,
    sequenceId: options.sequenceId,
    userId: options.userId,
  };
}

/**
 * Get touchpoint count for a prospect
 */
export function countTouchpoints(touchpoints: Touchpoint[], prospectId: string): number {
  return touchpoints.filter(t => t.prospectId === prospectId).length;
}

/**
 * Check if prospect has been contacted recently
 */
export function hasRecentContact(
  touchpoints: Touchpoint[],
  prospectId: string,
  withinDays: number = 7
): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - withinDays);
  
  return touchpoints.some(
    t => t.prospectId === prospectId && new Date(t.timestamp) > cutoff
  );
}

// ============================================
// Cadence Management
// ============================================

/**
 * Create a multi-channel cadence
 */
export function createCadence(
  name: string,
  steps: Array<Omit<CadenceStep, 'id'>>,
  options: Partial<Cadence> = {}
): Cadence {
  const now = new Date().toISOString();
  
  return {
    id: uuidv4(),
    name,
    steps: steps.map((step, index) => ({
      ...step,
      id: uuidv4(),
      order: index,
    })),
    status: 'draft',
    skipWeekends: true,
    maxTouchesBeforePause: 10,
    enrolledCount: 0,
    completedCount: 0,
    createdAt: now,
    updatedAt: now,
    ...options,
  };
}

/**
 * Pre-built cadence templates
 */
export const CADENCE_TEMPLATES = {
  tier1_multitouch: {
    name: 'Tier 1 Multi-Touch Cadence',
    description: 'Warm up with LinkedIn activity before direct outreach',
    steps: [
      { order: 0, channel: 'linkedin_connection' as const, action: 'view_profile', delayDays: 0, messageTemplate: '' },
      { order: 1, channel: 'linkedin_connection' as const, action: 'like_post', delayDays: 1, messageTemplate: '' },
      { order: 2, channel: 'linkedin_connection' as const, action: 'send_connection', delayDays: 2, messageTemplate: 'Hi {{firstName}}, impressed by {{company}}\'s growth. Would love to connect!' },
      { order: 3, channel: 'email' as const, action: 'send_email', delayDays: 4, messageTemplate: '' },
      { order: 4, channel: 'linkedin_dm' as const, action: 'send_dm', delayDays: 6, skipIfReplied: true, messageTemplate: '{{firstName}}, following up on my email...' },
      { order: 5, channel: 'email' as const, action: 'send_email', delayDays: 9, skipIfReplied: true, messageTemplate: '' },
      { order: 6, channel: 'linkedin_dm' as const, action: 'send_dm', delayDays: 12, skipIfReplied: true, messageTemplate: '' },
    ],
  },
  
  quick_connect: {
    name: 'Quick Connect Cadence',
    description: 'Fast LinkedIn connection and follow-up sequence',
    steps: [
      { order: 0, channel: 'linkedin_connection' as const, action: 'send_connection', delayDays: 0, messageTemplate: 'Hi {{firstName}}, saw we\'re both in {{industry}}. Let\'s connect!' },
      { order: 1, channel: 'linkedin_dm' as const, action: 'send_dm', delayDays: 2, skipIfConnected: false, messageTemplate: 'Thanks for connecting! Quick question about yard operations at {{company}}...' },
      { order: 2, channel: 'linkedin_dm' as const, action: 'send_dm', delayDays: 5, skipIfReplied: true, messageTemplate: '' },
    ],
  },
};

/**
 * Get next step in cadence
 */
export function getNextCadenceStep(
  cadence: Cadence,
  currentStepIndex: number,
  status: { replied: boolean; connected: boolean }
): CadenceStep | null {
  for (let i = currentStepIndex; i < cadence.steps.length; i++) {
    const step = cadence.steps[i];
    
    // Check skip conditions
    if (step.skipIfReplied && status.replied) {
      continue;
    }
    if (step.skipIfConnected && status.connected) {
      continue;
    }
    
    return step;
  }
  
  return null; // Cadence complete
}

// ============================================
// Analytics
// ============================================

/**
 * Calculate channel performance metrics
 */
export function calculateChannelPerformance(
  outreaches: SocialOutreach[],
  channel: SocialChannel
): ChannelPerformance {
  const channelOutreaches = outreaches.filter(o => o.channel === channel);
  
  const sent = channelOutreaches.filter(o => o.status !== 'draft').length;
  const delivered = channelOutreaches.filter(o => 
    ['delivered', 'opened', 'replied', 'connected'].includes(o.status)
  ).length;
  const opened = channelOutreaches.filter(o => o.wasOpened).length;
  const replied = channelOutreaches.filter(o => o.wasReplied).length;
  const connected = channelOutreaches.filter(o => o.status === 'connected').length;
  
  return {
    channel,
    sent,
    delivered,
    opened,
    replied,
    connected,
    openRate: sent > 0 ? (opened / sent) * 100 : 0,
    replyRate: sent > 0 ? (replied / sent) * 100 : 0,
    connectRate: sent > 0 ? (connected / sent) * 100 : 0,
  };
}

/**
 * Calculate overall outreach analytics
 */
export function calculateOutreachAnalytics(
  outreaches: SocialOutreach[],
  period: 'day' | 'week' | 'month' | 'quarter'
): OutreachAnalytics {
  const now = new Date();
  let startDate: Date;
  
  switch (period) {
    case 'day':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case 'quarter':
      startDate = new Date(now.setMonth(now.getMonth() - 3));
      break;
  }
  
  const periodOutreaches = outreaches.filter(
    o => o.createdAt && new Date(o.createdAt) >= startDate
  );
  
  const totalOutreaches = periodOutreaches.length;
  const totalReplies = periodOutreaches.filter(o => o.wasReplied).length;
  const totalConnections = periodOutreaches.filter(o => o.status === 'connected').length;
  const totalMeetings = 0; // Would need meeting data
  
  // Calculate by channel
  const channels: SocialChannel[] = [
    'linkedin_connection', 'linkedin_dm', 'linkedin_inmail',
    'twitter_dm', 'twitter_reply', 'twitter_quote',
  ];
  
  const byChannel = channels.map(channel => 
    calculateChannelPerformance(periodOutreaches, channel)
  ).filter(p => p.sent > 0);
  
  // Calculate by day of week
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byDayOfWeek = dayNames.map(day => {
    const dayIndex = dayNames.indexOf(day);
    const dayOutreaches = periodOutreaches.filter(
      o => o.sentAt && new Date(o.sentAt).getDay() === dayIndex
    );
    const sent = dayOutreaches.length;
    const replied = dayOutreaches.filter(o => o.wasReplied).length;
    
    return {
      day,
      sent,
      replied,
      replyRate: sent > 0 ? (replied / sent) * 100 : 0,
    };
  });
  
  // Calculate by time of day
  const byTimeOfDay = Array.from({ length: 24 }, (_, hour) => {
    const hourOutreaches = periodOutreaches.filter(
      o => o.sentAt && new Date(o.sentAt).getHours() === hour
    );
    const sent = hourOutreaches.length;
    const replied = hourOutreaches.filter(o => o.wasReplied).length;
    
    return {
      hour,
      sent,
      replied,
      replyRate: sent > 0 ? (replied / sent) * 100 : 0,
    };
  });
  
  return {
    period,
    startDate: startDate.toISOString(),
    endDate: new Date().toISOString(),
    totalOutreaches,
    totalReplies,
    totalConnections,
    totalMeetings,
    overallReplyRate: totalOutreaches > 0 ? (totalReplies / totalOutreaches) * 100 : 0,
    overallConnectRate: totalOutreaches > 0 ? (totalConnections / totalOutreaches) * 100 : 0,
    byChannel,
    byDayOfWeek,
    byTimeOfDay,
  };
}

// ============================================
// Exports
// ============================================

export { SOCIAL_CHANNEL_CONFIG };

/**
 * Email Event Types
 * 
 * Comprehensive type definitions for email tracking events,
 * webhook payloads, and meeting attribution.
 */

// =============================================================================
// SendGrid Webhook Events
// =============================================================================

export type SendGridEventType = 
  | 'processed'
  | 'delivered' 
  | 'open' 
  | 'click' 
  | 'bounce' 
  | 'spamreport' 
  | 'unsubscribe'
  | 'dropped'
  | 'deferred';

export interface SendGridWebhookEvent {
  event: SendGridEventType;
  email: string;
  timestamp: number;
  sg_event_id?: string;
  sg_message_id?: string;
  url?: string;
  ip?: string;
  reason?: string;
  type?: string; // bounce type: 'bounce' | 'blocked' | etc.
  useragent?: string;
  category?: string | string[];
  status?: string;
  custom_args?: Record<string, string>;
  
  // Additional fields for specific events
  asm_group_id?: number;
  attempt?: string;
  pool?: {
    name: string;
    id: number;
  };
  tls?: number;
  cert_error?: number;
  marketing_campaign_id?: number;
  marketing_campaign_name?: string;
}

// =============================================================================
// Internal Email Event Storage
// =============================================================================

export type EmailEventType = 
  | 'delivered'
  | 'open'
  | 'click'
  | 'bounce'
  | 'spam'
  | 'unsubscribe'
  | 'reply'
  | 'dropped'
  | 'deferred';

export interface EmailEvent {
  eventId: string;
  emailId: string;
  type: EmailEventType;
  email: string;
  timestamp: number;
  receivedAt: number;
  
  // Event-specific fields
  url?: string;
  reason?: string;
  bounceType?: 'hard' | 'soft';
  userAgent?: string;
  ip?: string;
  status?: string;
  
  // Metadata
  category?: string[];
  customArgs?: Record<string, string>;
  sgMessageId?: string;
  
  // For reply events
  replyId?: string;
  
  // TTL for cleanup
  expiresAt: number;
}

// =============================================================================
// Email Stats (Aggregated per email)
// =============================================================================

export interface EmailStats {
  emailId: string;
  status: 'pending' | 'sent' | 'delivered' | 'bounced' | 'spam';
  
  // Delivery
  sentAt?: number;
  deliveredAt?: number;
  
  // Engagement
  firstOpenedAt?: number;
  lastOpenedAt?: number;
  openCount: number;
  
  firstClickedAt?: number;
  lastClickedAt?: number;
  clickCount: number;
  
  // Issues
  bouncedAt?: number;
  bounceType?: 'hard' | 'soft';
  bounceReason?: string;
  
  spamReportedAt?: number;
  unsubscribedAt?: number;
  
  // Reply tracking
  repliedAt?: number;
  replyId?: string;
  
  // Timestamps
  lastEventAt: number;
  updatedAt: number;
}

// =============================================================================
// Inbound Email (Reply)
// =============================================================================

export interface InboundEmail {
  id: string;
  from: string;
  fromFull: string;
  to: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  receivedAt: number;
  
  // Linking
  originalEmailId?: string;
  linkedToOutreach: boolean;
  fuzzyMatched?: boolean;
  
  // Processing
  processed: boolean;
  sequencePaused: boolean;
  enrollmentId?: string;
  
  envelope?: {
    from: string;
    to: string[];
  };
}

// =============================================================================
// Suppression Management
// =============================================================================

export type SuppressionReason = 
  | 'bounce'
  | 'spam'
  | 'unsubscribe'
  | 'manual'
  | 'feedback'
  | 'invalid';

export interface SuppressionEntry {
  email: string;
  reason: SuppressionReason;
  bounceType?: 'hard' | 'soft';
  bounceReason?: string;
  createdAt: number;
  expiresAt?: number; // For soft bounces that expire
  source?: 'sendgrid_webhook' | 'manual' | 'sync' | 'user_request';
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Meeting/Calendly Events
// =============================================================================

export type MeetingStatus = 
  | 'booked'
  | 'confirmed'
  | 'canceled'
  | 'rescheduled'
  | 'completed'
  | 'no_show';

export interface Meeting {
  id: string;
  source: 'calendly' | 'manual' | 'other';
  
  // Invitee details
  inviteeEmail: string;
  inviteeName: string;
  inviteeFirstName?: string;
  inviteeLastName?: string;
  inviteeTimezone?: string;
  
  // Event details
  eventName: string;
  eventType?: string;
  eventDuration?: number;
  startTime: number;
  endTime: number;
  
  // Location
  locationType?: string;
  locationUrl?: string;
  
  // Status
  status: MeetingStatus;
  bookedAt: number;
  canceledAt?: number;
  cancelerName?: string;
  cancelReason?: string;
  
  // Prospect linking (attribution)
  prospectId?: string;
  prospectName?: string;
  prospectCompany?: string;
  linkedAt?: number;
  
  // Attribution (UTM params)
  attribution?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    salesforce_uuid?: string;
  };
  
  // Q&A responses from booking
  questionsAndAnswers?: Array<{
    question: string;
    answer: string;
  }>;
  
  // Links
  rescheduleUrl?: string;
  cancelUrl?: string;
  
  // Calendly references
  calendlyInviteeUri?: string;
  calendlyEventUri?: string;
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
}

// =============================================================================
// Webhook Configuration
// =============================================================================

export interface WebhookConfig {
  sendgrid: {
    verificationKey?: string;
    enabledEvents: SendGridEventType[];
  };
  calendly: {
    webhookSecret?: string;
    enabledEvents: ('invitee.created' | 'invitee.canceled')[];
  };
  inbound: {
    enabled: boolean;
    domain?: string;
  };
}

// =============================================================================
// Event Processing
// =============================================================================

export interface EventProcessingResult {
  processed: number;
  errors: number;
  suppressed?: number;
}

export interface WebhookResponse {
  success: boolean;
  event?: string;
  error?: string;
  details?: EventProcessingResult;
}

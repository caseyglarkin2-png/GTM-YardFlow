export interface EmailMessage {
  id: string;
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
  substitutions?: Record<string, string>;
  categories?: string[];
  customArgs?: Record<string, string>;
  metadata?: {
    userId?: string;
    tenantId?: string;
    sequenceId?: string;
    campaignId?: string;
    doNotTrack?: boolean;
  };
  scheduledAt?: number;
}

export type EmailQueueStatus =
  | 'pending'
  | 'processing'
  | 'scheduled'
  | 'sent'
  | 'failed'
  | 'dead-letter'
  | 'canceled';

export interface EmailQueueItem {
  id: string;
  message: EmailMessage;
  status: EmailQueueStatus;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  idempotencyKey?: string;
  scheduledAt?: number;
  lockedAt?: number;
  lockedBy?: string;
  createdAt: number;
  updatedAt: number;
  tenantId?: string;
  userId?: string;
}

export interface SendGridWebhookEvent {
  event:
    | 'delivered'
    | 'open'
    | 'click'
    | 'bounce'
    | 'spamreport'
    | 'unsubscribe'
    | 'processed'
    | 'deferred'
    | 'dropped';
  email: string;
  timestamp: number;
  sg_event_id?: string;
  sg_message_id?: string;
  url?: string;
  ip?: string;
  reason?: string;
  type?: string;
  useragent?: string;
  category?: string | string[];
  status?: string;
  custom_args?: Record<string, string>;
}

export interface SuppressionEntry {
  email: string;
  reason: 'bounce' | 'spam' | 'unsubscribe' | 'manual' | 'feedback';
  bounceType?: 'hard' | 'soft';
  createdAt: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
  source?: string;
}

export interface EmailStats {
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  spam: number;
  unsubscribed: number;
  lastEventAt?: number;
  bounceRate?: number;
  spamRate?: number;
}

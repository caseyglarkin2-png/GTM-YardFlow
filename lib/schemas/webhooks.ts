/**
 * Webhook Payload Schemas
 * 
 * Zod definitions for incoming external webhooks (Calendly, SendGrid, Inbound).
 * Used for runtime validation before processing.
 * 
 * Sprint 902: Type Safety Layer - T902.5
 */

import { z } from 'zod';

// =============================================================================
// Calendly Webhooks
// =============================================================================

export const CalendlyInviteeSchema = z.object({
  uri: z.string(),
  email: z.string().email(),
  name: z.string(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  status: z.enum(['active', 'canceled']).optional(),
  cancel_reason: z.string().nullable().optional(),
  rescheduled: z.boolean().optional(),
  timezone: z.string().nullable().optional(),
});

export const CalendlyEventPayloadSchema = z.object({
  event: z.string(), // "invitee.created", "invitee.canceled"
  payload: z.object({
    invitee: CalendlyInviteeSchema,
    event: z.object({
      uri: z.string(),
      name: z.string(),
      start_time: z.string(),
      end_time: z.string(),
      status: z.string().optional(),
    }),
    tracking: z.object({
      utm_campaign: z.string().nullable().optional(),
      utm_source: z.string().nullable().optional(),
      utm_content: z.string().nullable().optional(),
    }).optional(),
  }),
  created_at: z.string(),
});

// =============================================================================
// SendGrid Webhooks
// =============================================================================

export const SendGridEventSchema = z.object({
  email: z.string().email(),
  timestamp: z.number(),
  event: z.enum([
    'processed',
    'dropped',
    'delivered',
    'deferred',
    'bounce',
    'open',
    'click',
    'spamreport',
    'unsubscribe',
    'group_unsubscribe',
    'group_resubscribe'
  ]),
  sg_event_id: z.string(),
  sg_message_id: z.string(),
  // Custom args
  emailId: z.string().optional(),
  prospectId: z.string().optional(),
  enrollmentId: z.string().optional(),
  campaign: z.string().optional(),
  // Bounce/Drop details
  reason: z.string().optional(),
  status: z.string().optional(),
  // Click details
  url: z.string().url().optional(),
  useragent: z.string().optional(),
  ip: z.string().optional(),
}).passthrough(); // Allow extra SendGrid fields

export const SendGridPayloadSchema = z.array(SendGridEventSchema);

// =============================================================================
// Inbound Parse Webhooks (SendGrid)
// =============================================================================

export const InboundEmailSchema = z.object({
  headers: z.string(),
  dkim: z.string().optional(),
  to: z.string(),
  from: z.string(),
  html: z.string().optional(),
  text: z.string().optional(),
  sender_ip: z.string().optional(),
  envelope: z.string().optional(), // JSON string
  subject: z.string().optional(),
  charsets: z.string().optional(), // JSON string
  spf: z.string().optional(),
}).passthrough(); // Attachments etc

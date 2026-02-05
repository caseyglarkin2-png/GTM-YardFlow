/**
 * Template Adapter
 * 
 * Sprint 27 T4.8: Schema alignment between GTM-YardFlow and Railway
 * 
 * Railway uses different field names and enum values:
 * - GTM `category` (intro/followup) → Railway `channel` (EMAIL/LINKEDIN/PHONE)
 * - GTM `body` → Railway `template`
 * - GTM `tone` (lowercase) → Railway `tone` (UPPERCASE)
 * 
 * This adapter provides bidirectional mapping to keep both systems in sync
 * without breaking existing GTM code.
 */

import type { 
  EmailTemplateRecord, 
  CreateTemplateRequest, 
  UpdateTemplateRequest,
  TemplateCategory,
  TemplateTone,
} from '@/types/railway';

// =============================================================================
// Railway Schema Types (External API)
// =============================================================================

/** Railway's channel enum (UPPERCASE) */
export type RailwayChannel = 'EMAIL' | 'LINKEDIN' | 'PHONE';

/** Railway's tone enum (UPPERCASE) */
export type RailwayTone = 'FREIGHTROLL' | 'PROFESSIONAL' | 'CHALLENGER';

/** Template as stored in Railway Postgres */
export interface RailwayTemplateRecord {
  id: string;
  name: string;
  channel: RailwayChannel;
  tone?: RailwayTone;
  subject?: string;
  template: string; // Railway uses 'template' not 'body'
  isActive?: boolean;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Request to create template in Railway */
export interface RailwayCreateTemplateRequest {
  name: string;
  channel: RailwayChannel;
  tone?: RailwayTone;
  subject?: string;
  template: string;
  isActive?: boolean;
  isDefault?: boolean;
}

/** Request to update template in Railway */
export interface RailwayUpdateTemplateRequest {
  name?: string;
  channel?: RailwayChannel;
  tone?: RailwayTone;
  subject?: string;
  template?: string;
  isActive?: boolean;
  isDefault?: boolean;
}

// =============================================================================
// Tone Mapping
// =============================================================================

/** Map GTM lowercase tone to Railway UPPERCASE */
export function toRailwayTone(tone: TemplateTone | undefined): RailwayTone | undefined {
  if (!tone) return undefined;
  
  const map: Record<TemplateTone, RailwayTone | undefined> = {
    'freightroll': 'FREIGHTROLL',
    'professional': 'PROFESSIONAL',
    'challenger': 'CHALLENGER',
    // These don't have Railway equivalents yet - default to PROFESSIONAL
    'casual': 'PROFESSIONAL',
    'friendly': 'PROFESSIONAL',
    'formal': 'PROFESSIONAL',
  };
  
  return map[tone] ?? 'PROFESSIONAL';
}

/** Map Railway UPPERCASE tone to GTM lowercase */
export function toGtmTone(tone: RailwayTone | string | undefined): TemplateTone | undefined {
  if (!tone) return undefined;
  
  const map: Record<string, TemplateTone> = {
    'FREIGHTROLL': 'freightroll',
    'PROFESSIONAL': 'professional',
    'CHALLENGER': 'challenger',
  };
  
  return map[tone.toUpperCase()] ?? 'professional';
}

// =============================================================================
// Channel Mapping
// =============================================================================

/** 
 * Map GTM category to Railway channel
 * Note: Railway uses channel (EMAIL/LINKEDIN/PHONE) for delivery method,
 * while GTM uses category (intro/followup/etc.) for template purpose.
 * For now, we default to EMAIL for all templates.
 */
export function toRailwayChannel(category: TemplateCategory | undefined): RailwayChannel {
  // Railway channel is about delivery method, not template type
  // All email templates should use EMAIL channel
  return 'EMAIL';
}

/**
 * Map Railway channel back to GTM category
 * Since Railway doesn't store our category concept, we default to 'custom'
 * for Railway-sourced templates
 */
export function toGtmCategory(channel: RailwayChannel | undefined): TemplateCategory {
  // Railway doesn't have our category concept - templates from Railway are 'custom'
  return 'custom';
}

// =============================================================================
// Record Mapping: Railway → GTM
// =============================================================================

/**
 * Convert Railway template record to GTM EmailTemplateRecord
 */
export function toGtmTemplate(railway: RailwayTemplateRecord): EmailTemplateRecord {
  return {
    id: railway.id,
    name: railway.name,
    subject: railway.subject ?? '',
    body: railway.template, // Railway 'template' → GTM 'body'
    category: toGtmCategory(railway.channel),
    tone: toGtmTone(railway.tone),
    isDefault: railway.isDefault,
    isActive: railway.isActive,
    createdAt: railway.createdAt ?? new Date().toISOString(),
    updatedAt: railway.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * Convert array of Railway templates to GTM format
 */
export function toGtmTemplates(railwayTemplates: RailwayTemplateRecord[]): EmailTemplateRecord[] {
  return railwayTemplates.map(toGtmTemplate);
}

// =============================================================================
// Request Mapping: GTM → Railway
// =============================================================================

/**
 * Convert GTM CreateTemplateRequest to Railway format
 */
export function toRailwayCreateRequest(gtm: CreateTemplateRequest): RailwayCreateTemplateRequest {
  return {
    name: gtm.name,
    channel: toRailwayChannel(gtm.category),
    tone: toRailwayTone(gtm.tone),
    subject: gtm.subject,
    template: gtm.body, // GTM 'body' → Railway 'template'
    isActive: true,
  };
}

/**
 * Convert GTM UpdateTemplateRequest to Railway format
 */
export function toRailwayUpdateRequest(gtm: UpdateTemplateRequest): RailwayUpdateTemplateRequest {
  const request: RailwayUpdateTemplateRequest = {};
  
  if (gtm.name !== undefined) request.name = gtm.name;
  if (gtm.category !== undefined) request.channel = toRailwayChannel(gtm.category);
  if (gtm.tone !== undefined) request.tone = toRailwayTone(gtm.tone);
  if (gtm.subject !== undefined) request.subject = gtm.subject;
  if (gtm.body !== undefined) request.template = gtm.body;
  
  return request;
}

// =============================================================================
// Validation Helpers
// =============================================================================

/** Valid Railway tone values (must be exact match) */
const VALID_RAILWAY_TONES = ['FREIGHTROLL', 'PROFESSIONAL', 'CHALLENGER'] as const;

/** Valid Railway channel values (must be exact match) */
const VALID_RAILWAY_CHANNELS = ['EMAIL', 'LINKEDIN', 'PHONE'] as const;

/**
 * Check if a tone value is valid for Railway API (exact case match required)
 */
export function isValidRailwayTone(tone: string): tone is RailwayTone {
  return VALID_RAILWAY_TONES.includes(tone as RailwayTone);
}

/**
 * Check if a channel value is valid for Railway API (exact case match required)
 */
export function isValidRailwayChannel(channel: string): channel is RailwayChannel {
  return VALID_RAILWAY_CHANNELS.includes(channel as RailwayChannel);
}

/**
 * Normalize tone input to Railway format (handles mixed case)
 */
export function normalizeToRailwayTone(input: string | undefined): RailwayTone | undefined {
  if (!input) return undefined;
  const upper = input.toUpperCase();
  if (isValidRailwayTone(upper)) return upper as RailwayTone;
  // Try mapping from GTM lowercase
  return toRailwayTone(input.toLowerCase() as TemplateTone);
}

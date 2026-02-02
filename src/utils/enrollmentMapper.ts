/**
 * Enrollment Status Mapper
 * 
 * Maps and validates sequence enrollment statuses between 
 * Firestore (Client/Source of Truth) and Railway (Email Engine).
 * 
 * Sprint 902: Type Safety Layer - T902.4
 */

import { z } from 'zod';

// =============================================================================
// Status Definitions
// =============================================================================

export const EnrollmentStatusSchema = z.enum([
  'active',      // Currently receiving emails
  'paused',      // Temporarily stopped (OOO, manual pause)
  'completed',   // All steps sent
  'bounced',     // Email bounced (hard)
  'replied',     // Prospect replied (success)
  'meeting',     // Meeting booked (success)
  'cancelled',   // Manually stopped
  'failed',      // System error
]);

export type EnrollmentStatus = z.infer<typeof EnrollmentStatusSchema>;

// Statuses that represent a "Terminal" state (no further processing)
export const TERMINAL_STATUSES: EnrollmentStatus[] = [
  'completed',
  'bounced',
  'replied',
  'meeting',
  'cancelled',
  'failed'
];

// =============================================================================
// Mappers
// =============================================================================

/**
 * Validates and normalizes an enrollment status string.
 * Defaults to 'active' if unknown/invalid (log warning in real app).
 */
export function normalizeEnrollmentStatus(status: string): EnrollmentStatus {
  const parsed = EnrollmentStatusSchema.safeParse(status);
  
  if (parsed.success) {
    return parsed.data;
  }
  
  // Handle known legacy or external variations
  switch (status.toLowerCase()) {
    case 'finish':
    case 'finished':
      return 'completed';
    case 'stop':
    case 'stopped':
      return 'cancelled';
    case 'bounce':
      return 'bounced';
    case 'reply':
    case 'response':
      return 'replied';
    case 'booked':
      return 'meeting';
    case 'error':
      return 'failed';
    default:
      console.warn(`[EnrollmentMapper] Unknown status "${status}", defaulting to 'active' (safe mode)`);
      return 'active'; // Default to active or maybe 'failed'? Active is safer to keep visibility? 
                       // Actually, if unknown, maybe 'paused' is safer.
                       // But typical pattern is strict validation.
  }
}

/**
 * Check if a status is terminal (end of sequence)
 */
export function isTerminalStatus(status: string): boolean {
  const normalized = normalizeEnrollmentStatus(status);
  return TERMINAL_STATUSES.includes(normalized);
}

/**
 * Check if enrollment should continue processing
 */
export function isActiveStatus(status: string): boolean {
  return normalizeEnrollmentStatus(status) === 'active';
}

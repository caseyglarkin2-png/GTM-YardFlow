/**
 * AI Tone Configuration
 * 
 * Sprint 27: F1 - Tone presets for AI content generation
 * 
 * These tones control the AI's writing style when generating email content.
 * The actual system prompts live on the Railway backend.
 */

export type ToneId = 'freightroll' | 'professional' | 'challenger';

export interface ToneOption {
  id: ToneId;
  label: string;
  description: string;
  /** Max character limit for this tone (UI warning only, backend enforces) */
  charLimit?: number;
}

export const TONE_OPTIONS: ToneOption[] = [
  {
    id: 'freightroll',
    label: 'FreightRoll Voice',
    description: 'Short, punchy, metrics-driven (250 chars)',
    charLimit: 250,
  },
  {
    id: 'professional',
    label: 'Professional',
    description: 'Formal, value-focused, clear CTA',
  },
  {
    id: 'challenger',
    label: 'Challenger',
    description: 'Provocative questions, challenge status quo',
  },
];

/**
 * Get a tone by ID
 */
export function getTone(id: ToneId): ToneOption | undefined {
  return TONE_OPTIONS.find(t => t.id === id);
}

/**
 * Default tone for new compositions
 */
export const DEFAULT_TONE: ToneId = 'professional';

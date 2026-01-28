/**
 * TemplateGenerator - Sprint 11
 * AI-powered template generation and refinement
 */

import { Prospect } from '../types';

const TEMPLATE_GENERATION_PROMPT = `
You are a sales messaging expert. Generate a personalized outreach message for Manifest 2026.

**CRITICAL CONSTRAINTS:**
- Manifest App DMs have a strict 250 CHARACTER LIMIT (not words - characters including spaces)
- Be concise, punchy, and direct
- End with a clear CTA (coffee, chat, 10 mins, etc.)
- Sign off with the sender name

**KEY PROOF POINTS TO USE:**
- Primo Brands: 25 facilities → $1M+ contribution margin, rolling to 260 yards
- "Headcount neutral while taking on additional volume"
- "System-driven dock door assignment"
- Carrier benchmarking: 40% of carriers have 10% underperforming drivers
- Bottleneck ID: Bottom quartile facilities waste 5 min/shipment on dock assignments

**PERSONALIZATION:**
- Reference their company name
- Adapt tone based on their role (Ops vs Exec)
- For Tier 1: emphasize Co-Dev voting seat opportunity
- For qualified prospects: be more direct about meeting
`;

export interface GeneratedTemplate {
  id: string;
  label: string;
  body: string;
  charCount: number;
  type: 'short_dm' | 'codev' | 'custom';
  generated: boolean;
}

export interface TemplateGenerationRequest {
  prospect: Prospect;
  style: 'codev' | 'ops_focused' | 'exec_focused' | 'carrier_benchmarking' | 'custom';
  customPrompt?: string;
  senderName: string;
}

/**
 * Generate a personalized template using Gemini
 */
export async function generateTemplate(
  request: TemplateGenerationRequest,
  apiKey: string
): Promise<GeneratedTemplate> {
  const { prospect, style, customPrompt, senderName } = request;

  // Build the generation prompt
  let styleInstructions = '';
  switch (style) {
    case 'codev':
      styleInstructions = 'Focus on the Co-Development Program opportunity. Mention voting seat on roadmap. Reference Primo Brands expansion.';
      break;
    case 'ops_focused':
      styleInstructions = 'Focus on operational bottlenecks, dock assignment optimization, and carrier benchmarking. Use concrete numbers.';
      break;
    case 'exec_focused':
      styleInstructions = 'Focus on contribution margin, headcount neutrality, and network-wide visibility. Speak to strategic value.';
      break;
    case 'carrier_benchmarking':
      styleInstructions = 'Focus on carrier performance data, underperforming drivers, and yard flow optimization.';
      break;
    case 'custom':
      styleInstructions = customPrompt || 'Create a compelling, personalized message.';
      break;
  }

  const prompt = `
${TEMPLATE_GENERATION_PROMPT}

**PROSPECT DETAILS:**
- Name: ${prospect.name}
- Title: ${prospect.title}
- Company: ${prospect.company}
- Tier: ${prospect.tier}
- Role Type: ${prospect.isOps ? 'Operations Leader' : ''}${prospect.isOps && prospect.isExec ? ' & ' : ''}${prospect.isExec ? 'Executive' : ''}
- Category: ${prospect.category || 'Attendee'}
${prospect.qualified ? '- Pre-qualified: Yes (be more direct)' : ''}

**STYLE INSTRUCTIONS:**
${styleInstructions}

**SENDER NAME:** ${senderName}

Generate a Manifest App DM message (MUST be under 250 characters). Return ONLY the message text, nothing else.
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 150,
          }
        })
      }
    );

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'API error');
    }

    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    
    // Clean up any quotes or extra formatting
    const cleanedText = generatedText
      .replace(/^["']|["']$/g, '')
      .replace(/^\*\*.*?\*\*\n?/g, '')
      .trim();

    return {
      id: `generated_${Date.now()}`,
      label: `AI Generated: ${style.replace('_', ' ')}`,
      body: cleanedText,
      charCount: cleanedText.length,
      type: 'custom',
      generated: true
    };
  } catch (error) {
    console.error('Template generation error:', error);
    throw error;
  }
}

/**
 * Refine an existing template using AI
 */
export async function refineTemplate(
  currentMessage: string,
  refinementRequest: string,
  prospect: Prospect,
  apiKey: string
): Promise<string> {
  const prompt = `
You are refining a Manifest 2026 outreach message.

**CURRENT MESSAGE:**
${currentMessage}

**REFINEMENT REQUEST:**
${refinementRequest}

**PROSPECT:**
- ${prospect.name}, ${prospect.title} at ${prospect.company}
- Tier: ${prospect.tier}

**CONSTRAINTS:**
- MUST be under 250 characters (current: ${currentMessage.length})
- Keep the core message but apply the refinement
- Maintain professional, challenger-sale tone

Return ONLY the refined message text.
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 150,
          }
        })
      }
    );

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'API error');
    }

    const refinedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || currentMessage;
    
    return refinedText
      .replace(/^["']|["']$/g, '')
      .replace(/^\*\*.*?\*\*\n?/g, '')
      .trim();
  } catch (error) {
    console.error('Template refinement error:', error);
    return currentMessage;
  }
}

/**
 * Check if message is within character limit
 */
export function isWithinLimit(message: string, limit: number = 250): boolean {
  return message.length <= limit;
}

/**
 * Get character count status
 */
export function getCharacterStatus(message: string, limit: number = 250): {
  count: number;
  limit: number;
  isOver: boolean;
  remaining: number;
  percentage: number;
} {
  const count = message.length;
  return {
    count,
    limit,
    isOver: count > limit,
    remaining: limit - count,
    percentage: Math.min((count / limit) * 100, 100)
  };
}

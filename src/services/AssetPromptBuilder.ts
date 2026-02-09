/**
 * Asset Prompt Builder - YardFlow Hub
 * 
 * Composes AI prompts with prospect context, ROI data, and approved claims only.
 * Ensures all generated content uses only verified statistics.
 */

import type { AssetContext } from '../types/assets';
import { getClaimsForContext } from '../config/approvedClaims';

// ============================================
// Prompt Templates
// ============================================

const SYSTEM_CONTEXT = `You are a B2B sales assistant for FreightRoll, a yard management system that helps logistics and manufacturing companies optimize their yard operations.

WRITING STYLE:
- Professional but conversational
- Focus on specific, measurable outcomes
- Use peer validation (reference Primo Brands success)
- Be concise and action-oriented
- Never be pushy or salesy

VALUE PROPOSITION:
- Digital check-in/check-out eliminates paper delays
- Automated dock assignment saves labor
- Proactive alerts reduce detention charges
- Network effects at scale (multi-facility adoption)

CRITICAL RULES:
1. Use ONLY the approved claims provided below. Do not invent statistics.
2. Personalize to the prospect's role and company.
3. Keep DMs under 250 characters.
4. Keep email subjects under 60 characters.
5. Reference ROI data when available.
`;

const OUTPUT_FORMAT_INSTRUCTIONS = `
OUTPUT FORMAT:
Return a valid JSON object with the following structure:
\`\`\`json
{
  "miniBrief": {
    "hook": "1-2 sentence attention grabber",
    "painPoints": ["pain 1", "pain 2", "pain 3"],
    "valueProps": ["value 1", "value 2", "value 3"],
    "roiSnapshot": "ROI summary if data provided",
    "cta": "Call to action"
  },
  "dmVariants": [
    {"type": "exec", "content": "Strategic, ROI-focused message ≤250 chars"},
    {"type": "ops", "content": "Tactical, process-focused message ≤250 chars"},
    {"type": "challenger", "content": "Provocative question ≤250 chars"}
  ],
  "emailSequence": {
    "name": "Sequence Name",
    "steps": [
      {"position": 1, "delayDays": 0, "subject": "Subject ≤60 chars", "body": "Email body ≤500 words", "persona": "exec|ops|all"},
      {"position": 2, "delayDays": 2, "subject": "...", "body": "...", "persona": "..."},
      {"position": 3, "delayDays": 5, "subject": "...", "body": "...", "persona": "..."},
      {"position": 4, "delayDays": 10, "subject": "...", "body": "...", "persona": "..."}
    ]
  }
}
\`\`\`
`;

// ============================================
// Prompt Building Functions
// ============================================

/**
 * Build prospect context section
 */
function buildProspectContext(context: AssetContext): string {
  const personaType = context.isExec 
    ? 'Executive (strategic focus, ROI-driven)' 
    : context.isOps 
      ? 'Operations (tactical focus, process improvement)' 
      : 'Procurement (cost focus, vendor management)';

  let section = `
PROSPECT CONTEXT:
- Name: ${context.prospectName}
- Title: ${context.prospectTitle}
- Company: ${context.companyName}
- Tier: ${context.tier}
- Persona: ${personaType}
`;

  return section;
}

/**
 * Build ROI data section
 */
function buildROIContext(context: AssetContext): string {
  if (!context.roiData) {
    return '\nROI DATA: Not available. Focus on general value props and peer validation.';
  }

  const roi = context.roiData;
  let section = '\nROI DATA (use these specific numbers in messaging):';
  
  if (roi.totalAnnualSavings) {
    section += `\n- Total Annual Savings: $${(roi.totalAnnualSavings / 1000).toFixed(0)}K`;
  }
  if (roi.paperSavings) {
    section += `\n- Paper Savings: $${(roi.paperSavings / 1000).toFixed(0)}K/year`;
  }
  if (roi.laborSavings) {
    section += `\n- Labor Savings: $${(roi.laborSavings / 1000).toFixed(0)}K/year`;
  }
  if (roi.detentionSavings) {
    section += `\n- Detention Savings: $${(roi.detentionSavings / 1000).toFixed(0)}K/year`;
  }
  if (roi.paybackMonths) {
    section += `\n- Payback Period: ${roi.paybackMonths.toFixed(1)} months`;
  }
  if (roi.networkMultiplier) {
    section += `\n- Network Multiplier: ${roi.networkMultiplier.toFixed(2)}x`;
  }

  return section;
}

/**
 * Build approved claims section
 */
function buildClaimsContext(targetAssets: AssetContext['targetAssets']): string {
  // Determine which claim categories to include based on target assets
  let claimsText = '';
  
  if (targetAssets.includes('dms')) {
    claimsText += '\n' + getClaimsForContext('dm');
  } else if (targetAssets.includes('emails')) {
    claimsText += '\n' + getClaimsForContext('email');
  } else if (targetAssets.includes('brief')) {
    claimsText += '\n' + getClaimsForContext('brief');
  } else {
    claimsText += '\n' + getClaimsForContext('all');
  }
  
  return claimsText;
}

/**
 * Build specific instructions based on target assets
 */
function buildAssetInstructions(context: AssetContext): string {
  let instructions = '\nSPECIFIC REQUIREMENTS:';
  
  if (context.targetAssets.includes('brief')) {
    instructions += `
- Mini-Brief: Create a 1-page summary (~500 words total)
  - Hook: Grab attention with a specific observation about ${context.companyName}
  - Pain Points: 3 bullets relevant to ${context.isOps ? 'operations' : context.isExec ? 'executive' : 'procurement'} role
  - Value Props: 3 bullets mapping directly to the pain points
  - ROI Snapshot: Use provided ROI data or reference Primo Brands success
  - CTA: Specific ask for a 15-minute demo
`;
  }
  
  if (context.targetAssets.includes('dms')) {
    instructions += `
- DM Variants: Create 3 distinct messages, each UNDER 250 characters
  - Exec variant: Strategic, ROI-focused, peer validation
  - Ops variant: Tactical, specific metrics, process improvement
  - Challenger variant: Provocative question about status quo
  - Each must work as a standalone LinkedIn/event app message
`;
  }
  
  if (context.targetAssets.includes('emails')) {
    instructions += `
- Email Sequence: 4-step campaign building on initial contact
  - Day 0: Initial outreach, value prop, specific ask
  - Day 2: Follow-up with additional proof point
  - Day 5: Shorter, more direct ask
  - Day 10: Last chance, soft close
  - Each email should reference previous touchpoint
  - Subject lines MUST be under 60 characters
  - Body should be under 500 words
`;
    
    if (context.existingDMForSequence) {
      instructions += `\n  - Initial DM sent: "${context.existingDMForSequence}"`;
    }
  }
  
  return instructions;
}

// ============================================
// Main Export: Build Asset Prompt
// ============================================

/**
 * Build a complete prompt for asset generation
 * 
 * @param context - Asset generation context with prospect and ROI data
 * @returns Complete prompt string for Gemini API
 */
export function buildAssetPrompt(context: AssetContext): string {
  const sections = [
    SYSTEM_CONTEXT,
    buildProspectContext(context),
    buildROIContext(context),
    buildClaimsContext(context.targetAssets),
    buildAssetInstructions(context),
    OUTPUT_FORMAT_INSTRUCTIONS,
  ];
  
  return sections.join('\n');
}

/**
 * Build a prompt for DM generation only
 */
export function buildDMPrompt(context: AssetContext): string {
  return buildAssetPrompt({
    ...context,
    targetAssets: ['dms'],
  });
}

/**
 * Build a prompt for mini-brief generation only
 */
export function buildBriefPrompt(context: AssetContext): string {
  return buildAssetPrompt({
    ...context,
    targetAssets: ['brief'],
  });
}

/**
 * Build a prompt for email sequence generation only
 */
export function buildEmailPrompt(context: AssetContext, existingDM?: string): string {
  return buildAssetPrompt({
    ...context,
    targetAssets: ['emails'],
    existingDMForSequence: existingDM,
  });
}

/**
 * Estimate token count for a prompt (rough approximation)
 */
export function estimateTokenCount(prompt: string): number {
  // GPT-style approximation: ~4 chars per token
  return Math.ceil(prompt.length / 4);
}

/**
 * Get the claims that will be included in a prompt
 * (useful for debugging and review)
 */
export function getClaimsForPromptPreview(targetAssets: AssetContext['targetAssets']): string {
  return buildClaimsContext(targetAssets);
}

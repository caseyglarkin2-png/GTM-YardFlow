/**
 * SystemPromptBuilder - Sprint 10 (T10.3), Updated Sprint 30 (B1)
 * Generates context-aware system prompts based on current state
 */

import { ProspectContext, RecentAction } from './ConversationManager';
import { BRAIN_SYSTEM_PROMPT, getPageContextPrompt } from '../config/brainSystemPrompt';

// Base brain context - now imported from brainSystemPrompt.ts
const BASE_BRAIN_CONTEXT = BRAIN_SYSTEM_PROMPT;

export interface SystemPromptOptions {
  prospect?: ProspectContext | null;
  stats?: {
    total: number;
    contacted: number;
    booked: number;
    tier1: number;
  } | null;
  recentActions?: RecentAction[];
  pageContext?: string;
}

/**
 * Build a dynamic system prompt with context
 */
export function buildSystemPrompt(options: SystemPromptOptions = {}): string {
  const sections: string[] = [BASE_BRAIN_CONTEXT];

  // Add prospect context if available
  if (options.prospect) {
    const p = options.prospect;
    const prospectContext = `
---
**CURRENT PROSPECT CONTEXT:**
You are helping draft messages for this specific prospect. Reference their details naturally.

- **Name:** ${p.name}
- **Title:** ${p.title}
- **Company:** ${p.company}
- **Tier:** ${p.tier} ${p.tier === 'Tier 1' ? '(High Priority - Co-Dev Candidate)' : '(Standard Outreach)'}
- **Score:** ${p.score}
- **Persona:** ${p.isOps ? 'Operations Leader' : ''}${p.isOps && p.isExec ? ' & ' : ''}${p.isExec ? 'Executive' : ''}
- **Current Status:** ${p.status}

${p.isOps ? '→ Focus on "Operational Reynolds Number" and friction reduction.' : ''}
${p.isExec ? '→ Focus on "Earnings Stability" and financial impact.' : ''}
${p.tier === 'Tier 1' ? '→ Pitch the Co-Development Program and "Voting Seat" opportunity.' : '→ Pitch Fluidity and New Architecture.'}

When drafting messages, personalize for ${p.name.split(' ')[0]} at ${p.company}.
`;
    sections.push(prospectContext);
  }

  // Add stats context if available
  if (options.stats) {
    const s = options.stats;
    const conversionRate = s.total > 0 ? Math.round((s.booked / s.total) * 100) : 0;
    const statsContext = `
---
**CURRENT CAMPAIGN STATS:**
- Total Prospects: ${s.total}
- Contacted: ${s.contacted} (${s.total > 0 ? Math.round((s.contacted / s.total) * 100) : 0}%)
- Meetings Booked: ${s.booked}
- Conversion Rate: ${conversionRate}%
- Tier 1 Prospects: ${s.tier1}
- Remaining: ${s.total - s.contacted}

Use these stats to provide context-aware advice about pacing and prioritization.
`;
    sections.push(statsContext);
  }

  // Add recent actions if available
  if (options.recentActions && options.recentActions.length > 0) {
    const actionsText = options.recentActions
      .map(a => `- ${a.prospectName}: ${a.fromStatus} → ${a.toStatus} (${new Date(a.timestamp).toLocaleTimeString()})`)
      .join('\n');
    
    const actionsContext = `
---
**RECENT ACTIONS:**
${actionsText}

Reference these recent activities when appropriate.
`;
    sections.push(actionsContext);
  }

  // Add page context if available
  if (options.pageContext) {
    const pageContextAddition = getPageContextPrompt(options.pageContext);
    if (pageContextAddition) {
      sections.push(`
---
**CURRENT PAGE CONTEXT:**
${pageContextAddition}
`);
    }
  }

  // Add helpful instructions
  sections.push(`
---
**INSTRUCTIONS:**
- Be concise and actionable
- Reference the prospect's specific details when drafting messages
- For DMs, always respect the 250 character limit
- Provide specific, tailored messaging based on the prospect's tier and persona
- You can reference previous conversation context
`);

  return sections.join('\n');
}

/**
 * Get base brain context (for when no dynamic context needed)
 */
export function getBaseBrainContext(): string {
  return BASE_BRAIN_CONTEXT;
}

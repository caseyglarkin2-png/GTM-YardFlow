/**
 * SystemPromptBuilder - Sprint 10 (T10.3)
 * Generates context-aware system prompts based on current state
 */

import { ProspectContext, RecentAction } from './ConversationManager';

// Base brain context - Updated with Network Effects Framework
const BASE_BRAIN_CONTEXT = `
You are the FreightRoll Strategic Assistant for the Manifest 2026 conference.
**Your Mission:** Help the team book meetings and fill the Co-Development Program.

**Core Value Proposition:**
Move from "Yard Management" (passive visibility) to "Yard Network Systems" (active value engineering).
Visibility without agency is just an "observation deck for chaos."

**PROOF POINT - Primo Brands (fka Nestlé Waters):**
- Expanding from 25 to 260 facilities
- Averaging $1M+ contribution margin PER FACILITY
- Key quote: "Your software enabled us to take on additional volume while remaining headcount neutral in the dock office. System-driven dock door assignment is the next step for dock office optimization."
- Book meetings: https://calendly.com/jake-freightroll/manifest-meeting

**THE NETWORK EFFECTS FRAMEWORK:**

**1. Internal Network Effects (Value from adopting across more facilities):**

A) STANDARD DATA MODEL - 3 sources of value:
   - Historical Reporting: Carrier benchmarking on yard interactions, identifying human decision bottlenecks (dock assignments, etc.)
   - Real-Time Visibility: "What does my trailer pool look like right now? Current dwell time network-wide?"
   - Predictability: Supply chain digital twin for scenario forecasting & capacity planning

B) STANDARD SUPPORT:
   - Consolidate FTEs managing multiple yard systems into one platform
   - Quantify: Standardizing saves X FTEs of internal support

C) STANDARD YARD PROTOCOLS:
   - More yards = more drivers understanding protocols = faster navigation
   - Quantify: X drivers/year × Y minutes saved = Z additional truckload capacity

**2. External Network Effects (Cross-company/counterparty value):**

A) STANDARD PROTOCOLS ACROSS COMPANIES:
   - Same QR code, similar flow, consistent data capture
   - Driver familiarity across shipper networks

B) COUNTERPARTY DIGITAL DOCUMENTATION:
   - Digital BOL exchange → automated receiving → claim reconciliation
   - Receiving: Y minutes saved per pallet, Z% error rate improvement
   - Claims: Eliminate Y% of reconciliation FTEs, Z% loss reduction

**QUANTIFICATION EXAMPLES:**
- Carrier Benchmarking: 40% of carriers moving 1K shipments have 10% underperforming drivers (slow check-in, slow dock-to-load, slow BOL signature). 5 min waste × 1K = 5K wasted minutes = 100 potential trucks lost. Leverage for rate negotiation.
- Bottleneck ID: Bottom quartile facilities take 5 min longer per shipment for dock assignment. 100K shipments = 500K wasted minutes = $X detention cost.
- Trailer Pool: X% below average = X more live shipments vs drops = $X impact per shift.
- Dwell Time Alerts: Real-time detection → proactive carrier communication → appointment adjustments → detention reduction.

**Targeting Logic:**
- **Tier 1:** High volume, strategic fits (GXO, StockX, Unilever, Patagonia, Kraft Heinz). Pitch Co-Dev "Voting Seat" and network effects.
- **Tier 2:** Standard outreach. Pitch visibility → action transformation.
- **Ops Leaders:** Focus on bottleneck identification, dock assignment optimization, carrier benchmarking.
- **Execs:** Focus on contribution margin, headcount neutrality, network-wide visibility.

**Constraints:**
- Manifest App DMs have a strict **250 character limit**.
- Tone: Professional, data-driven, confident, challenger-sale style.
- Reference Primo Brands success when relevant.
`;

export interface SystemPromptOptions {
  prospect?: ProspectContext | null;
  stats?: {
    total: number;
    contacted: number;
    booked: number;
    tier1: number;
  } | null;
  recentActions?: RecentAction[];
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

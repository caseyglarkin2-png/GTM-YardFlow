/**
 * Tests for Brain Actions
 * 
 * Sprint 30: B2 - Brain can navigate app and trigger actions
 */

import { describe, it, expect, vi } from 'vitest';
import { parseActionsFromResponse, validateAction } from '@/types/brainActions';

describe('parseActionsFromResponse', () => {
  it('parses a single action from response', () => {
    const response = `I'll filter to show Tier 1 prospects.

\`\`\`action
{"type": "filter", "filters": {"tier": "T1"}}
\`\`\``;

    const parsed = parseActionsFromResponse(response);
    
    expect(parsed.text).toBe("I'll filter to show Tier 1 prospects.");
    expect(parsed.actions).toHaveLength(1);
    expect(parsed.actions?.[0]).toEqual({
      type: 'filter',
      filters: { tier: 'T1' }
    });
  });

  it('parses multiple actions from response', () => {
    const response = `Navigating to sequences and selecting prospects.

\`\`\`action
[
  {"type": "navigate", "tab": "sequences"},
  {"type": "select", "criteria": {"tier": "T1", "limit": 5}}
]
\`\`\``;

    const parsed = parseActionsFromResponse(response);
    
    expect(parsed.actions).toHaveLength(2);
    expect(parsed.actions?.[0].type).toBe('navigate');
    expect(parsed.actions?.[1].type).toBe('select');
  });

  it('returns text without actions if no action block', () => {
    const response = 'Just a plain text response without actions.';
    
    const parsed = parseActionsFromResponse(response);
    
    expect(parsed.text).toBe(response);
    expect(parsed.actions).toBeUndefined();
  });

  it('handles malformed action JSON gracefully', () => {
    const response = `Here's my response.

\`\`\`action
{not valid json}
\`\`\``;

    const parsed = parseActionsFromResponse(response);
    
    expect(parsed.text).toContain("Here's my response");
    // Malformed JSON results in no actions (undefined)
    expect(parsed.actions).toBeUndefined();
  });
});

describe('validateAction', () => {
  it('validates navigate action', () => {
    expect(validateAction({ type: 'navigate', tab: 'sequences' })).toBe(true);
    expect(validateAction({ type: 'navigate' })).toBe(false);
  });

  it('validates filter action', () => {
    expect(validateAction({ type: 'filter', filters: { tier: 'T1' } })).toBe(true);
    expect(validateAction({ type: 'filter' })).toBe(false);
  });

  it('validates select action with IDs', () => {
    expect(validateAction({ type: 'select', prospectIds: ['1', '2'] })).toBe(true);
  });

  it('validates select action with criteria', () => {
    expect(validateAction({ type: 'select', criteria: { tier: 'T1', limit: 5 } })).toBe(true);
  });

  it('validates notify action', () => {
    expect(validateAction({ type: 'notify', message: 'Hello', severity: 'info' })).toBe(true);
    expect(validateAction({ type: 'notify' })).toBe(false);
  });

  it('rejects invalid action types', () => {
    expect(validateAction({ type: 'unknownAction' })).toBe(false);
    expect(validateAction(null)).toBe(false);
    expect(validateAction('string')).toBe(false);
  });
});

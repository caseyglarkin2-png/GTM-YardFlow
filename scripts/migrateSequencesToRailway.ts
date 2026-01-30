/**
 * migrateSequencesToRailway.ts - Sequence template migration script
 * 
 * Sprint 94: T94.2 - Migrate Sequence Templates to Railway
 * 
 * Exports hardcoded email sequence templates to Railway.
 * 
 * Usage:
 *   npx ts-node scripts/migrateSequencesToRailway.ts
 *   npx ts-node scripts/migrateSequencesToRailway.ts --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Configuration
// =============================================================================

const RAILWAY_API_URL = process.env.RAILWAY_API_URL || process.env.VITE_RAILWAY_URL || 'http://localhost:3000';
const DRY_RUN = process.argv.includes('--dry-run');
const EVIDENCE_DIR = path.join(__dirname, '../docs/migration-evidence');

interface SequenceStep {
  order: number;
  type: 'email' | 'wait' | 'task' | 'linkedin' | 'call';
  subject?: string;
  body?: string;
  delayDays?: number;
  delayHours?: number;
  skipWeekends?: boolean;
  skipHolidays?: boolean;
}

interface SequenceTemplate {
  name: string;
  description: string;
  steps: SequenceStep[];
}

// =============================================================================
// Sequence Templates
// =============================================================================

// These templates are based on the existing EmailSequenceService.ts
const SEQUENCE_TEMPLATES: SequenceTemplate[] = [
  {
    name: 'Cold Outreach',
    description: 'Standard 4-step cold outreach sequence for initial prospect contact',
    steps: [
      {
        order: 0,
        type: 'email',
        subject: '{{first_name}} - quick thought on {{company}}',
        body: `Hi {{first_name}},

I noticed {{company}} is growing rapidly in the {{industry}} space. We've been helping similar companies streamline their yard operations.

Would you be open to a 15-minute chat to see if there's a fit?

Best,
{{sender_name}}`,
        delayDays: 0,
        skipWeekends: true,
      },
      {
        order: 1,
        type: 'wait',
        delayDays: 3,
      },
      {
        order: 2,
        type: 'email',
        subject: 'Re: {{company}}',
        body: `{{first_name}},

Quick follow-up on my last note. I wanted to share a quick case study on how we helped a {{industry}} company reduce yard dwell time by 40%.

Worth a quick chat?

{{sender_name}}`,
        delayDays: 0,
        skipWeekends: true,
      },
      {
        order: 3,
        type: 'wait',
        delayDays: 4,
      },
      {
        order: 4,
        type: 'email',
        subject: 'Last check-in re: yard operations',
        body: `Hi {{first_name}},

I don't want to be a pest, so this will be my last note for now.

If streamlining yard operations isn't a priority right now, no worries at all. But if timing changes, I'd love to connect.

Cheers,
{{sender_name}}`,
        delayDays: 0,
        skipWeekends: true,
      },
    ],
  },
  {
    name: 'Follow-up Sequence',
    description: '3-step follow-up sequence for prospects who showed initial interest',
    steps: [
      {
        order: 0,
        type: 'email',
        subject: 'Following up from our conversation',
        body: `Hi {{first_name}},

Great chatting with you about {{company}}'s yard operations. As promised, here's more info on how we can help:

• Real-time visibility into yard inventory
• Automated appointment scheduling
• Dwell time analytics and optimization

Let me know if you'd like to schedule a demo.

Best,
{{sender_name}}`,
        delayDays: 0,
        skipWeekends: true,
      },
      {
        order: 1,
        type: 'wait',
        delayDays: 3,
      },
      {
        order: 2,
        type: 'email',
        subject: 'Quick demo this week?',
        body: `{{first_name}},

Wanted to check if you had a chance to review the info I sent over?

I'd love to show you a quick demo tailored to {{company}}'s specific needs. Would you have 20 minutes this week?

{{sender_name}}`,
        delayDays: 0,
        skipWeekends: true,
      },
      {
        order: 3,
        type: 'wait',
        delayDays: 5,
      },
      {
        order: 4,
        type: 'email',
        subject: 'Re: {{company}} yard optimization',
        body: `Hi {{first_name}},

Haven't heard back, so I'll keep this brief.

Would it help if I connected you with a reference customer in the {{industry}} space who's seen great results?

Just let me know.

{{sender_name}}`,
        delayDays: 0,
        skipWeekends: true,
      },
    ],
  },
  {
    name: 'Meeting Request',
    description: '2-step meeting request sequence for qualified prospects',
    steps: [
      {
        order: 0,
        type: 'email',
        subject: '15 minutes to discuss {{company}} yard efficiency?',
        body: `Hi {{first_name}},

Based on our research, it looks like {{company}} could benefit from better yard visibility and scheduling automation.

Would you be open to a brief 15-minute call to explore whether there's a fit?

I'm flexible on timing - just let me know what works for you.

Best,
{{sender_name}}`,
        delayDays: 0,
        skipWeekends: true,
      },
      {
        order: 1,
        type: 'wait',
        delayDays: 4,
      },
      {
        order: 2,
        type: 'email',
        subject: 'Re: Quick chat about yard operations',
        body: `{{first_name}},

Circling back on my note from earlier this week. 

I know schedules get busy - if a call isn't convenient, I'm happy to send over a brief video walkthrough of how YardFlow could help {{company}}.

Just say the word.

{{sender_name}}`,
        delayDays: 0,
        skipWeekends: true,
      },
    ],
  },
  {
    name: 'Event Follow-up',
    description: 'Post-event follow-up sequence for conference/trade show contacts',
    steps: [
      {
        order: 0,
        type: 'email',
        subject: 'Great meeting you at {{event_name}}',
        body: `Hi {{first_name}},

It was great connecting at {{event_name}}! I enjoyed our conversation about {{company}}'s logistics challenges.

As discussed, here's a link to our case study on yard optimization: [link]

Would love to continue the conversation - are you free for a quick call next week?

Best,
{{sender_name}}`,
        delayDays: 1,
        skipWeekends: true,
      },
      {
        order: 1,
        type: 'wait',
        delayDays: 3,
      },
      {
        order: 2,
        type: 'task',
        body: 'Connect with {{first_name}} on LinkedIn',
        delayDays: 0,
      },
      {
        order: 3,
        type: 'wait',
        delayDays: 4,
      },
      {
        order: 4,
        type: 'email',
        subject: 'Following up from {{event_name}}',
        body: `{{first_name}},

Hope you're recovered from {{event_name}}! 

I wanted to follow up on our chat about improving {{company}}'s yard operations. Do you have time for a quick demo this week?

{{sender_name}}`,
        delayDays: 0,
        skipWeekends: true,
      },
    ],
  },
];

// =============================================================================
// Helpers
// =============================================================================

function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const prefix = {
    info: '  ',
    warn: '⚠️ ',
    error: '❌ ',
  };
  console.log(`${prefix[level]}${message}`);
}

function ensureEvidenceDir(): void {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
}

// =============================================================================
// Railway API
// =============================================================================

async function checkRailwayHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${RAILWAY_API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function createSequence(template: SequenceTemplate): Promise<{ success: boolean; id?: string; error?: string }> {
  if (DRY_RUN) {
    log(`[DRY RUN] Would create sequence: ${template.name}`);
    return { success: true, id: 'dry-run-id' };
  }

  try {
    const response = await fetch(`${RAILWAY_API_URL}/api/sequences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: template.name,
        description: template.description,
        status: 'active',
        steps: template.steps,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { success: true, id: data.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function getExistingSequences(): Promise<string[]> {
  try {
    const response = await fetch(`${RAILWAY_API_URL}/api/sequences`);
    if (response.ok) {
      const data = await response.json();
      return (data || []).map((s: { name: string }) => s.name);
    }
  } catch {
    // Ignore errors
  }
  return [];
}

// =============================================================================
// Main Migration
// =============================================================================

async function migrate(): Promise<void> {
  console.log('\n🚂 Railway Sequence Migration');
  console.log('='.repeat(50));
  
  if (DRY_RUN) {
    console.log('🏃 Running in DRY RUN mode - no data will be written\n');
  }

  // Check Railway health
  log('Checking Railway API health...');
  const railwayHealthy = await checkRailwayHealth();
  if (!railwayHealthy && !DRY_RUN) {
    log('Railway API is not accessible. Aborting.', 'error');
    log(`  URL: ${RAILWAY_API_URL}`);
    process.exit(1);
  }
  log('Railway API is healthy ✓');

  // Check for existing sequences
  log('Checking for existing sequences...');
  const existingNames = await getExistingSequences();
  log(`Found ${existingNames.length} existing sequences`);

  // Process templates
  const stats = {
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [] as { name: string; error: string }[],
  };

  console.log('');
  for (const template of SEQUENCE_TEMPLATES) {
    log(`Processing: ${template.name}...`);

    // Skip if already exists
    if (existingNames.includes(template.name)) {
      log(`  ⏭️  Already exists, skipping`);
      stats.skipped++;
      continue;
    }

    const result = await createSequence(template);

    if (result.success) {
      log(`  ✓ Created with ID: ${result.id}`);
      stats.created++;
    } else {
      log(`  ✗ Failed: ${result.error}`, 'error');
      stats.failed++;
      stats.errors.push({ name: template.name, error: result.error || 'Unknown error' });
    }
  }

  // Generate evidence
  ensureEvidenceDir();
  const evidenceFile = path.join(
    EVIDENCE_DIR,
    `sequence-migration-${new Date().toISOString().split('T')[0]}.json`
  );

  const evidence = {
    timestamp: new Date().toISOString(),
    dryRun: DRY_RUN,
    templates: SEQUENCE_TEMPLATES.map(t => ({ name: t.name, steps: t.steps.length })),
    stats,
  };

  if (!DRY_RUN) {
    fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
    log(`\nEvidence saved to: ${evidenceFile}`);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary');
  console.log('='.repeat(50));
  console.log(`  Templates processed: ${SEQUENCE_TEMPLATES.length}`);
  console.log(`  Created:            ${stats.created}`);
  console.log(`  Skipped (existing): ${stats.skipped}`);
  console.log(`  Failed:             ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log('\n  Errors:');
    stats.errors.forEach(e => {
      console.log(`    - ${e.name}: ${e.error}`);
    });
  }

  if (stats.failed === 0) {
    console.log('\n✅ Migration completed successfully!');
  } else {
    console.log('\n⚠️  Migration completed with errors');
  }

  console.log('');
}

// =============================================================================
// Entry Point
// =============================================================================

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

#!/usr/bin/env npx ts-node
/**
 * seedSequences.ts - Seed default sequences to Railway
 * 
 * Sprint S1: Ensures Railway has sequence templates for the BulkSequenceModal
 * 
 * Usage:
 *   npx ts-node scripts/seedSequences.ts
 *   npx ts-node scripts/seedSequences.ts --dry-run
 * 
 * Environment variables required:
 *   RAILWAY_API_URL - Railway backend URL
 *   RAILWAY_API_SECRET or CRON_SECRET - S2S auth secret
 */

// Load environment from .env if available
import * as dotenv from 'dotenv';
dotenv.config();

const RAILWAY_API_URL = process.env.RAILWAY_API_URL || 'https://yardflow-hitlist-production-2f41.up.railway.app';
const RAILWAY_API_SECRET = process.env.RAILWAY_API_SECRET || process.env.CRON_SECRET;
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

// Template definitions (inline to avoid module resolution issues in ts-node)
interface SequenceStep {
  order: number;
  type: 'email';
  subject: string;
  body: string;
  delayDays: number;
}

interface SequencePayload {
  name: string;
  description: string;
  status: 'active' | 'draft';
  steps: SequenceStep[];
}

// Default sequences to seed (subset of MANIFEST_SEQUENCES)
const DEFAULT_SEQUENCES: SequencePayload[] = [
  {
    name: 'Manifest: In the Area (High Priority)',
    description: 'For prospects with meeting rooms (Pepsi, Kraft, GXO, etc.)',
    status: 'active',
    steps: [
      {
        order: 1,
        type: 'email',
        subject: 'Swing by your meeting room?',
        body: `Hi {{firstName}},

I'll be "holding court" in the meeting rooms area on Monday afternoon at Manifest. 

We helped Primo Brands (fka Nestle Waters) scale volume by 4% across 24 facilities while keeping headcount flat. That's ~$1M incremental margin per facility.

I have a hunch we can deliver similar results for {{company}}.

Since I'll be right next door to your team, should I swing by the {{company}} room? Or you can grab a slot on my calendar here: {{calendlyUrl}}

Best,
Jake`,
        delayDays: 0,
      },
      {
        order: 2,
        type: 'email',
        subject: 'Re: Swing by your meeting room?',
        body: `Hi {{firstName}},

Just wanted to bump this - I'll be at Manifest through Wednesday and would love to connect.

Even a 10-minute chat would be great to see if there's alignment.

Best,
Jake`,
        delayDays: 2,
      },
    ],
  },
  {
    name: 'Manifest: Co-Development Invitation',
    description: 'Invitation to the Yard Network Protocol (YNP) cohort',
    status: 'active',
    steps: [
      {
        order: 1,
        type: 'email',
        subject: 'Co-development partner for {{company}}?',
        body: `Hi {{firstName}},

We are selecting partners for a new co-development cohort at Manifest to roll out our Yard Network Protocol (YNP), and I'd love to include {{company}}.

We recently deployed this with Primo Brands, generating $30M+ in network effects by standardizing their yard data models.

Are you open to discussing what a similar "Network Effect" strategy would look like for {{company}}'s facilities?

Best,
Jake`,
        delayDays: 0,
      },
    ],
  },
  {
    name: '3-Touch Quick Sequence',
    description: 'Simple 3-step sequence for fast follow-up',
    status: 'active',
    steps: [
      {
        order: 1,
        type: 'email',
        subject: 'Quick question for {{firstName}}',
        body: `Hi {{firstName}},

I'm reaching out because {{company}} caught my attention as a potential fit for our yard management solution.

We help companies like Primo Brands increase throughput by 4% while keeping headcount flat.

Would a 15-minute call this week make sense to explore if there's a fit?

Best,
Jake`,
        delayDays: 0,
      },
      {
        order: 2,
        type: 'email',
        subject: 'Re: Quick question for {{firstName}}',
        body: `Hi {{firstName}},

Just wanted to follow up on my previous note.

I know you're busy, so I'll keep this short - would next week work better for a quick chat?

Best,
Jake`,
        delayDays: 3,
      },
      {
        order: 3,
        type: 'email',
        subject: 'One more try',
        body: `{{firstName}},

I don't want to be a pest, but I wanted to give this one more shot.

If yard operations aren't a priority right now, no worries at all. But if there's any interest in improving throughput without adding headcount, I'd love to chat.

Either way, wishing you and the {{company}} team a great quarter!

Best,
Jake`,
        delayDays: 5,
      },
    ],
  },
  {
    name: 'T1 Executive Outreach',
    description: 'Personalized sequence for Tier 1 executives',
    status: 'active',
    steps: [
      {
        order: 1,
        type: 'email',
        subject: '{{company}} + YardFlow: Quick thought',
        body: `Hi {{firstName}},

I wanted to reach out directly because {{company}} is exactly the type of organization we built YardFlow for.

We recently helped Primo Brands (24 facilities) increase their trailer throughput by 4% without adding headcount. That translated to roughly $1M in incremental margin per facility.

Given your role at {{company}}, I'd imagine operational efficiency is always top of mind. Would you be open to a 15-minute call to explore if there's a similar opportunity?

Best,
Jake`,
        delayDays: 0,
      },
      {
        order: 2,
        type: 'email',
        subject: 'Re: {{company}} + YardFlow: Quick thought',
        body: `Hi {{firstName}},

I wanted to share a quick case study that might be relevant:

Primo Brands deployed our Yard Network Protocol across 24 sites and saw:
- 4% increase in trailer moves per day
- Zero headcount increase
- $30M+ in network effects from standardized data

I'm curious if {{company}} is facing similar challenges. Worth a conversation?

Best,
Jake`,
        delayDays: 4,
      },
    ],
  },
  {
    name: 'LinkedIn Connection Follow-up',
    description: 'Follow-up after connecting on LinkedIn',
    status: 'active',
    steps: [
      {
        order: 1,
        type: 'email',
        subject: 'Great connecting on LinkedIn, {{firstName}}',
        body: `Hi {{firstName}},

Thanks for connecting on LinkedIn! I noticed you're at {{company}} and wanted to reach out.

We help logistics leaders like yourself improve yard operations without adding complexity. Companies like Primo Brands have seen a 4% increase in throughput using our approach.

Would you be open to a quick 15-minute call to see if there's a fit for {{company}}?

Best,
Jake`,
        delayDays: 0,
      },
    ],
  },
];

async function getExistingSequences(): Promise<string[]> {
  if (!RAILWAY_API_SECRET) {
    console.warn('⚠️  No RAILWAY_API_SECRET found - cannot fetch existing sequences');
    return [];
  }

  try {
    const response = await fetch(`${RAILWAY_API_URL}/api/sequences`, {
      headers: {
        'Authorization': `Bearer ${RAILWAY_API_SECRET}`,
        'x-service-key': RAILWAY_API_SECRET,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`⚠️  Could not fetch existing sequences: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const sequences = data.data || data || [];
    return sequences.map((s: { name: string }) => s.name);
  } catch (error) {
    console.warn('⚠️  Error fetching existing sequences:', error);
    return [];
  }
}

async function createSequence(payload: SequencePayload): Promise<boolean> {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would create: "${payload.name}" (${payload.steps.length} steps)`);
    return true;
  }

  if (!RAILWAY_API_SECRET) {
    console.error('❌ Cannot create sequences without RAILWAY_API_SECRET');
    return false;
  }

  try {
    const response = await fetch(`${RAILWAY_API_URL}/api/sequences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAILWAY_API_SECRET}`,
        'x-service-key': RAILWAY_API_SECRET,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Created: "${payload.name}" (ID: ${result.data?.id || result.id || 'unknown'})`);
      return true;
    } else {
      const error = await response.text();
      console.error(`❌ Failed to create "${payload.name}": ${response.status} - ${error}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error creating "${payload.name}":`, error);
    return false;
  }
}

async function main() {
  console.log('🌱 Seeding Default Sequences to Railway\n');
  console.log(`   Railway URL: ${RAILWAY_API_URL}`);
  console.log(`   API Secret: ${RAILWAY_API_SECRET ? '***' + RAILWAY_API_SECRET.slice(-4) : 'NOT SET'}`);
  console.log('');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  if (!RAILWAY_API_SECRET) {
    console.error('❌ RAILWAY_API_SECRET or CRON_SECRET environment variable is required');
    console.error('   Set it via: export RAILWAY_API_SECRET="your-secret"');
    process.exit(1);
  }

  // Get existing sequences
  const existing = await getExistingSequences();
  console.log(`📋 Found ${existing.length} existing sequence(s) in Railway\n`);
  
  if (VERBOSE && existing.length > 0) {
    console.log('   Existing:');
    existing.forEach(name => console.log(`     - ${name}`));
    console.log('');
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const sequence of DEFAULT_SEQUENCES) {
    if (existing.includes(sequence.name)) {
      console.log(`⏭️  Skipping (exists): "${sequence.name}"`);
      skipped++;
      continue;
    }

    const success = await createSequence(sequence);
    if (success) {
      created++;
    } else {
      failed++;
    }
  }

  console.log('\n📊 Summary');
  console.log(`   ✅ Created: ${created}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📋 Total: ${DEFAULT_SEQUENCES.length}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

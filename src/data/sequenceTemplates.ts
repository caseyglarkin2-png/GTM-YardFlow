// src/data/sequenceTemplates.ts
import type { SequenceTemplate } from '@/types/emailSequence';

export const MANIFEST_SEQUENCES: SequenceTemplate[] = [
  {
    id: 'manifest-meeting-room',
    name: 'Manifest: "In the Area" (High Priority)',
    description: 'For prospects with meeting rooms (Pepsi, Kraft, GXO, etc.)',
    category: 'manifest_outreach',
    persona: 'manifest_attendee',
    usageCount: 0,
    tags: ['manifest', 'q1_2026'],
    steps: [
      {
        delayDays: 0,
        type: 'initial',
        subjectTemplate: 'Swing by your meeting room?',
        bodyTemplate: `Hi {{firstName}},

I'll be "holding court" in the meeting rooms area on Monday afternoon at Manifest. 

We helped Primo Brands (fka Nestle Waters) scale volume by 4% across 24 facilities while keeping headcount flat. That's ~$1M incremental margin per facility. [cite: 43]

I have a hunch we can deliver similar results for {{company}}.

Since I'll be right next door to your team, should I swing by the {{company}} room? Or you can grab a slot on my calendar here: {{calendly_link}} [cite: 341]

Best,
Jake`
      }
    ]
  },
  {
    id: 'manifest-co-dev',
    name: 'Manifest: Co-Development Invitation',
    description: 'Invitation to the Yard Network Protocol (YNP) cohort', 
    category: 'manifest_outreach',
    persona: 'logistics_executive',
    usageCount: 0,
    tags: ['manifest', 'q1_2026'],
    steps: [
      {
        delayDays: 0,
        type: 'initial',
        subjectTemplate: 'Co-development partner for {{company}}?',
        bodyTemplate: `Hi {{firstName}},

We are selecting partners for a new co-development cohort at Manifest to roll out our Yard Network Protocol (YNP), and I’d love to include {{company}}. [cite: 32, 44]

We recently deployed this with Primo Brands, generating $30M+ in network effects by standardizing their yard data models. [cite: 4]

Are you open to discussing what a similar "Network Effect" strategy would look like for {{company}}'s facilities?

Best,
Jake`
      }
    ]
  }
];

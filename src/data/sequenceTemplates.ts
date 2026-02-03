// src/data/sequenceTemplates.ts
import type { SequenceTemplate } from '@/types/emailSequence';

// Sprint 29: Pepsi/Luis style DM template - short, punchy, metrics-driven
export const MANIFEST_DM_TEMPLATES: SequenceTemplate[] = [
  {
    id: 'manifest-dm-luis',
    name: 'DM: Luis Style (Short)',
    description: 'Short punchy DM for Manifest app (250 char limit)',
    category: 'manifest_outreach',
    persona: 'logistics_executive',
    usageCount: 0,
    tags: ['manifest', 'dm', 'short'],
    steps: [
      {
        delayDays: 0,
        type: 'initial',
        subjectTemplate: 'Manifest Connect',
        bodyTemplate: `{{firstName}}, yard pilots going? YNP rolled to ~25 Primo facilities EOY25. $1M+/facility avg. 4% more 53's/day. Worth 15 min? {{calendlyUrl}}`
      }
    ]
  },
  {
    id: 'manifest-dm-codev',
    name: 'DM: Co-Dev Invite (Short)',
    description: 'Co-development invite for DM platforms',
    category: 'manifest_outreach',
    persona: 'ops_director',
    usageCount: 0,
    tags: ['manifest', 'dm', 'codev'],
    steps: [
      {
        delayDays: 0,
        type: 'initial',
        subjectTemplate: 'Manifest Connect',
        bodyTemplate: `{{firstName}}, selecting 3 co-dev partners for Q2. Primo: $1M+/facility, headcount neutral. {{company}} a fit? {{calendlyUrl}}`
      }
    ]
  }
];

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
  },
  // T903.5 Standard Templates
  {
    id: 'quick-3-touch',
    name: '3-Touch Quick',
    description: 'Aggressive 1-week sprint to get a yes/no',
    category: 'cold_outreach',
    usageCount: 0,
    tags: ['cold', 'short_cycle'],
    steps: [
      {
        type: 'initial',
        subjectTemplate: 'Quick question for {{company}}',
        bodyTemplate: `Hi {{firstName}},

Are you currently evaluating yard management solutions for {{company}}? 

We helped reduce detention costs by 40% for carriers like yours.

Best,
{{senderName}}`,
        delayDays: 0
      },
      {
        type: 'follow_up_1',
        subjectTemplate: 'Thoughts on this?',
        bodyTemplate: `Hi {{firstName}},

Just bubbling this up - did you see my note about yard management?`,
        delayDays: 2
      },
      {
        type: 'break_up',
        subjectTemplate: 'Assume this isnt a priority',
        bodyTemplate: `Hi {{firstName}},

haven't heard back so I'll assume yard ops isn't top of mind right now. I'll take you off my list.`,
        delayDays: 4
      }
    ]
  },
  {
    id: 'standard-5-touch',
    name: '5-Touch Standard',
    description: '2-week value-add sequence',
    category: 'cold_outreach',
    usageCount: 0,
    tags: ['cold', 'value_add'],
    steps: [
      {
        type: 'initial',
        subjectTemplate: 'Yard efficiency at {{company}}',
        bodyTemplate: `Hi {{firstName}}, ...`,
        delayDays: 0
      },
      {
        type: 'follow_up_1',
        subjectTemplate: 'Case study: 40% reduction',
        bodyTemplate: `Hi {{firstName}}, ...`,
        delayDays: 3
      },
      {
        type: 'follow_up_2',
        subjectTemplate: 'Any thoughts?',
        bodyTemplate: `Hi {{firstName}}, ...`,
        delayDays: 6
      },
      {
        type: 'break_up',
        subjectTemplate: 'Last attempt',
        bodyTemplate: `Hi {{firstName}}, ...`,
        delayDays: 10
      }
    ]
  },
  // Sprint 29: Co-Dev Email with Primo Testimonial
  {
    id: 'manifest-codev-primo',
    name: 'Manifest: Co-Dev + Primo Proof',
    description: 'Social proof with Primo testimonial for email (more space)',
    category: 'manifest_outreach',
    persona: 'logistics_executive',
    usageCount: 0,
    tags: ['manifest', 'email', 'codev', 'testimonial'],
    steps: [
      {
        delayDays: 0,
        type: 'initial',
        subjectTemplate: 'Are gates the bottleneck at {{company}}?',
        bodyTemplate: `Hi {{firstName}},

Are gates a common problem for facilities in your network?

We just got confirmation that our Yard Network System works for Primo:

---
*"Your software enabled us to take on additional volume while remaining headcount neutral in the dock office. System-driven dock door assignment is the next step for dock office optimization."*
— Primo Water Operations
---

Conservative estimate for {{company}}:
• 4%+ volume outperformance by enabled facilities
• $1M+ incremental margin/facility

If you'll be at Manifest, Jake can walk through the math: {{calendlyLink}}

He'll be in Meeting Rooms Monday and 1:1 Zone Tuesday.

Best,
{{senderName}}
FreightRoll Team`
      },
      {
        delayDays: 4,
        type: 'follow_up_1',
        subjectTemplate: 'Re: Are gates the bottleneck at {{company}}?',
        bodyTemplate: `{{firstName}},

Quick follow-up — saw you opened my last email.

We have 3 co-dev slots left for Q2. Not selling — just looking for operators who want to shape the product.

If {{company}} has yard congestion, you'd be a perfect fit. 15-min call: {{calendlyLink}}

{{senderName}}`
      }
    ]
  },
  // Sprint 29: Pilot Proof Points (Luis Style for Email)
  {
    id: 'manifest-pilot-proof',
    name: 'Manifest: Pilot Proof Points',
    description: 'Short metrics-driven outreach for logistics execs (Pepsi/Luis style)',
    category: 'manifest_outreach',
    persona: 'logistics_executive',
    usageCount: 0,
    tags: ['manifest', 'email', 'metrics', 'short'],
    steps: [
      {
        delayDays: 0,
        type: 'initial',
        subjectTemplate: 'Quick question about {{company}} yards',
        bodyTemplate: `{{firstName}}, how are the yard pilots going?

Know a YNP pilot rolled to ~25 bottle water facilities by EOY25.

Avg. incremental margins conservatively over $1M/per pilot facility. 4% more 53's/day on avg.

Would love to see what it can do for {{company}}.

Best,
{{senderName}}`
      },
      {
        delayDays: 3,
        type: 'follow_up_1',
        subjectTemplate: 'Re: Quick question about {{company}} yards',
        bodyTemplate: `Just circling back — saw you're confirmed for Manifest.

If yard visibility is a priority, Jake (our CEO) is doing 1:1s Monday in Meeting Rooms.

Happy to reserve a slot: {{calendlyLink}}

{{senderName}}`
      }
    ]
  }
];

// Export combined list for template selection
export const ALL_SEQUENCE_TEMPLATES = [...MANIFEST_DM_TEMPLATES, ...MANIFEST_SEQUENCES];

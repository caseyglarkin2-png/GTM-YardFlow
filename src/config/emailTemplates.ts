/**
 * Email Templates for Bulk Send
 * 
 * Sprint 22A: T22A.4 - Email templates for personalized bulk sends
 * 
 * Tokens supported:
 * - {first_name} - First name of prospect
 * - {name} - Full name
 * - {company} - Company name
 * - {title} - Job title
 */

export interface EmailTemplate {
  id: string;
  label: string;
  subject: string;
  body: string;
  category: 'intro' | 'followup' | 'meeting' | 'custom';
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'intro_yardflow',
    label: 'YardFlow Introduction',
    category: 'intro',
    subject: 'Reducing trailer dwell time at {company}',
    body: `Hi {first_name},

I noticed {company} is in the logistics/supply chain space and wanted to reach out.

We're helping distribution centers reduce yard congestion and trailer dwell time by 40% with real-time visibility into every asset on the property.

Would you be open to a quick 15-minute call to see if there's a fit?

Best,
The YardFlow Team`,
  },
  {
    id: 'manifest_followup',
    label: 'Manifest 2026 Follow-up',
    category: 'followup',
    subject: 'Great connecting at Manifest',
    body: `Hi {first_name},

It was great connecting at Manifest 2026. I wanted to follow up on our conversation about yard management challenges.

At YardFlow, we're helping companies like {company} gain real-time visibility into their yard operations. I'd love to schedule a quick demo to show you what we've built.

Would next week work for a 15-minute call?

Best,
The YardFlow Team`,
  },
  {
    id: 'tier1_executive',
    label: 'Executive Outreach (Tier 1)',
    category: 'meeting',
    subject: 'Quick question about {company} yard ops',
    body: `{first_name},

I'll keep this brief - I know your time is valuable.

We've helped companies reduce yard congestion by 40% and eliminate trailer detention fees. Given {company}'s scale, I suspect you're leaving money on the table.

Worth a 10-minute conversation?

Best,
The YardFlow Team`,
  },
  {
    id: 'ops_director',
    label: 'Ops Director Intro',
    category: 'intro',
    subject: 'Yard visibility for {company}',
    body: `Hi {first_name},

As {title} at {company}, you're likely dealing with the daily chaos of yard operations - lost trailers, detention fees, and drivers waiting for dock assignments.

We built YardFlow to solve exactly this. Our platform gives you real-time visibility into every asset in your yard, automated check-in/out, and predictive dock scheduling.

Would love to show you a quick demo. Do you have 15 minutes this week?

Best,
The YardFlow Team`,
  },
  {
    id: 'breakup',
    label: 'Final Follow-up (Breakup)',
    category: 'followup',
    subject: 'Closing the loop',
    body: `Hi {first_name},

I've reached out a couple of times and haven't heard back, so I'll assume the timing isn't right.

If yard management ever becomes a priority at {company}, feel free to reach out. I'm happy to help.

Best,
The YardFlow Team`,
  },
];

/**
 * Get template by ID
 */
export function getEmailTemplate(id: string): EmailTemplate | undefined {
  return EMAIL_TEMPLATES.find(t => t.id === id);
}

/**
 * Personalize template with prospect data
 */
export function personalizeTemplate(
  template: EmailTemplate,
  prospect: { name: string; company: string; title: string }
): { subject: string; body: string } {
  const firstName = prospect.name.split(' ')[0] || prospect.name;
  
  const personalize = (text: string) => text
    .replace(/\{first_name\}/g, firstName)
    .replace(/\{name\}/g, prospect.name)
    .replace(/\{company\}/g, prospect.company)
    .replace(/\{title\}/g, prospect.title);

  return {
    subject: personalize(template.subject),
    body: personalize(template.body),
  };
}

// Sprint 901: Extracted from App.tsx
import { Prospect, MessageTemplate } from '../types';

// VITE_MEETING_LINK_SHORT is preferred for Manifest DMs (must be <=30 chars to fit 250 char limit)
// Fallback to long Calendly URL if short link not configured
const MEETING_LINK_SHORT = import.meta.env.VITE_MEETING_LINK_SHORT || '';
const MEETING_LINK_LONG = 'https://calendly.com/jake-freightroll/manifest-meeting';
export const CALENDAR_LINK = MEETING_LINK_SHORT || MEETING_LINK_LONG;
export const IS_SHORT_LINK_CONFIGURED = !!MEETING_LINK_SHORT;

// DM Character limit for Manifest app
export const DM_CHAR_LIMIT = 250;

// --- Templates with Network Effects Messaging ---
// Shortened for platform character limits (Manifest DM = 250 chars MAX, LinkedIn DM ~300 chars)
// Using shorter templates when short link is configured
export const getTemplates = (prospect: Prospect, senderName: string): MessageTemplate[] => [
  {
    id: 'dm_codev',
    label: 'DM: Co-Dev (Short)',
    type: 'short_dm',
    subject: 'Manifest Connect',
    body: `Hi ${prospect.name.split(' ')[0]}, Primo saving $1M+/facility. YardFlow Co-Dev: voting seats open. 15 min? ${CALENDAR_LINK} -${senderName}`
  },
  {
    id: 'dm_exec',
    label: 'DM: Exec - Headcount Neutral',
    type: 'short_dm',
    subject: 'Manifest Connect',
    body: `Hi ${prospect.name.split(' ')[0]}, Primo: $1M+/facility, headcount neutral. Curious about ${prospect.company}? ${CALENDAR_LINK} -${senderName}`
  },
  {
    id: 'dm_ops',
    label: 'DM: Ops - Dock Time',
    type: 'short_dm',
    subject: 'Manifest Connect',
    body: `Hi ${prospect.name.split(' ')[0]}, 5 min/shipment wasted on dock assignments. System fix. Compare notes? ${CALENDAR_LINK} -${senderName}`
  },
  {
    id: 'dm_carrier',
    label: 'DM: Carrier Benchmarking',
    type: 'short_dm',
    subject: 'Manifest Connect',
    body: `Hi ${prospect.name.split(' ')[0]}, benchmarking driver yard performance. Relevant for ${prospect.company}? ${CALENDAR_LINK} -${senderName}`
  },
  {
    id: 'codev_invite',
    label: 'Email: Co-Dev Invitation',
    type: 'codev',
    subject: `Manifest: Design Partner for ${prospect.company}?`,
    body: `Hi ${prospect.name.split(' ')[0]},

Saw you're at Manifest—wanted to flag something for ${prospect.company}.

We're launching the YardFlow Co-Dev Program: 2-3 enterprise partners get a voting seat on the 2026 roadmap.

**The proof:** Primo Brands is rolling YardFlow from 25→260 facilities. Each averages $1M+ margin improvement—headcount neutral.

**Network effects:**
• Standard data model = carrier benchmarking + bottleneck ID
• Real-time visibility = trailer optimization + dwell alerts
• Standard protocols = faster driver navigation

Given ${prospect.company}'s scale, I'd walk through this math.

${CALENDAR_LINK}

-${senderName}`
  }
];

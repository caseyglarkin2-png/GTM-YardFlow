/**
 * YardFlow Type Definitions
 */

export interface Prospect {
  id: string;
  name: string;
  title: string;
  company: string;
  tier: string;
  score: number;
  isOps: boolean;
  isExec: boolean;
  status: 'new' | 'drafted' | 'contacted' | 'meeting_booked';
  notes?: string;
  lastEditedBy?: string;
  category?: 'Speaker' | 'Attendee' | 'Sponsor';
  qualified?: boolean;
  country?: string;
  revenue?: string;
}

export interface MessageTemplate {
  id: string;
  label: string;
  subject: string;
  body: string;
  type: 'intro' | 'codev' | 'technical' | 'short_dm' | 'custom';
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface CompanyInfo {
  tier: string;
  companyScore: number;
  attendees?: number;
  execOpsCount?: number;
  recommendedTargets?: string[];
}

export type TierFilter = 'All' | 'Tier 1' | 'Tier 2' | 'Tier 3';
export type StatusFilter = 'All' | 'new' | 'drafted' | 'contacted' | 'meeting_booked';

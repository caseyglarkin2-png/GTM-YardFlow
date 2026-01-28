import type { Prospect } from '../../types'

export const mockProspects: Prospect[] = [
  {
    id: '1',
    name: 'John Smith',
    company: 'Acme Logistics',
    title: 'VP Operations',
    tier: '1',
    score: 95,
    isOps: true,
    isExec: true,
    status: 'new',
    notes: 'Test notes',
  },
  {
    id: '2',
    name: 'Jane Doe',
    company: 'Global Freight Inc',
    title: 'Director Supply Chain',
    tier: '2',
    score: 85,
    isOps: false,
    isExec: true,
    status: 'contacted',
    notes: 'Follow up next week',
  },
  {
    id: '3',
    name: 'Bob Wilson',
    company: 'Fast Shipping Co',
    title: 'CEO',
    tier: '3',
    score: 75,
    isOps: true,
    isExec: false,
    status: 'meeting_booked',
    notes: 'Interested in demo',
  },
]

export const createMockProspect = (overrides: Partial<Prospect> = {}): Prospect => ({
  id: Math.random().toString(36).substr(2, 9),
  name: 'Test Prospect',
  company: 'Test Company',
  title: 'Test Title',
  tier: '2',
  score: 50,
  isOps: false,
  isExec: false,
  status: 'new',
  notes: '',
  ...overrides,
})

import { describe, it, expect } from 'vitest'

describe('Sample Test Suite', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true)
  })

  it('should do basic math', () => {
    expect(2 + 2).toBe(4)
  })
})

describe('Tier Mapping', () => {
  const tierMapping: Record<string, number> = {
    'GXO Logistics': 1,
    'StockX': 1,
    'NFI': 1,
    'Ryder': 1,
    'XPO': 1,
    'Unknown Company': 3,
  }

  it('should map tier 1 companies correctly', () => {
    expect(tierMapping['GXO Logistics']).toBe(1)
    expect(tierMapping['StockX']).toBe(1)
  })

  it('should default unknown companies to tier 3', () => {
    expect(tierMapping['Unknown Company']).toBe(3)
  })
})

describe('Status Colors', () => {
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'not_started': return 'bg-slate-100 text-slate-500 border-slate-200'
      case 'contacted': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'replied': return 'bg-green-100 text-green-800 border-green-200'
      case 'meeting_booked': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'drafted': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-gray-100 text-gray-500 border-gray-200'
    }
  }

  it('should return correct colors for not_started', () => {
    const color = getStatusColor('not_started')
    expect(color).toContain('slate')
  })

  it('should return correct colors for contacted', () => {
    const color = getStatusColor('contacted')
    expect(color).toContain('blue')
  })

  it('should return correct colors for replied', () => {
    const color = getStatusColor('replied')
    expect(color).toContain('green')
  })

  it('should return correct colors for meeting_booked', () => {
    const color = getStatusColor('meeting_booked')
    expect(color).toContain('purple')
  })

  it('should return correct colors for drafted', () => {
    const color = getStatusColor('drafted')
    expect(color).toContain('yellow')
  })

  it('should return gray for unknown status', () => {
    const color = getStatusColor('unknown')
    expect(color).toContain('gray')
  })
})

describe('Priority Filtering', () => {
  const prospects = [
    { name: 'High Priority', priority: 95, tier: 1 },
    { name: 'Medium Priority', priority: 60, tier: 2 },
    { name: 'Low Priority', priority: 30, tier: 3 },
  ]

  it('should sort by priority descending', () => {
    const sorted = [...prospects].sort((a, b) => b.priority - a.priority)
    expect(sorted[0].name).toBe('High Priority')
    expect(sorted[2].name).toBe('Low Priority')
  })

  it('should filter by tier', () => {
    const tier1Only = prospects.filter(p => p.tier === 1)
    expect(tier1Only.length).toBe(1)
    expect(tier1Only[0].name).toBe('High Priority')
  })
})

describe('Search Filtering', () => {
  const prospects = [
    { name: 'John Smith', company: 'Acme Corp' },
    { name: 'Jane Doe', company: 'Global Logistics' },
    { name: 'Bob Wilson', company: 'Fast Freight' },
  ]

  it('should filter by name', () => {
    const searchTerm = 'john'
    const filtered = prospects.filter(
      p => p.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    expect(filtered.length).toBe(1)
    expect(filtered[0].name).toBe('John Smith')
  })

  it('should filter by company', () => {
    const searchTerm = 'logistics'
    const filtered = prospects.filter(
      p => p.company.toLowerCase().includes(searchTerm.toLowerCase())
    )
    expect(filtered.length).toBe(1)
    expect(filtered[0].company).toBe('Global Logistics')
  })

  it('should return all when search is empty', () => {
    const searchTerm = ''
    const filtered = prospects.filter(
      p => 
        searchTerm === '' ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.company.toLowerCase().includes(searchTerm.toLowerCase())
    )
    expect(filtered.length).toBe(3)
  })
})

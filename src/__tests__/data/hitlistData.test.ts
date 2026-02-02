import { describe, it, expect } from 'vitest'
import { 
  HITLIST_PROSPECTS, 
  HITLIST_STATS,
  getAllProspects, 
  getTier1Prospects, 
  getQualifiedProspects,
  getProspectsWithEmail,
} from '../../data/hitlistData'
import { isValidEmail } from '../../utils/emailValidator'

describe('Hitlist Data', () => {
  it('should have prospect data loaded', () => {
    expect(HITLIST_PROSPECTS.length).toBeGreaterThan(0)
  })

  it('should have more than 5000 prospects', () => {
    expect(HITLIST_PROSPECTS.length).toBeGreaterThan(5000)
  })

  it('should have required fields for each prospect', () => {
    HITLIST_PROSPECTS.forEach(prospect => {
      expect(prospect).toHaveProperty('id')
      expect(prospect).toHaveProperty('name')
      expect(prospect).toHaveProperty('company')
      expect(prospect).toHaveProperty('title')
      expect(prospect).toHaveProperty('score')
      expect(prospect).toHaveProperty('tier')
    })
  })

  it('should have valid tier values', () => {
    const validTiers = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4']
    HITLIST_PROSPECTS.forEach(prospect => {
      expect(validTiers).toContain(prospect.tier)
    })
  })

  it('should have score values', () => {
    HITLIST_PROSPECTS.forEach(prospect => {
      expect(typeof prospect.score).toBe('number')
    })
  })

  it('should have valid status values', () => {
    const validStatuses = ['new', 'contacted', 'replied', 'meeting_booked', 'drafted']
    HITLIST_PROSPECTS.forEach(prospect => {
      expect(validStatuses).toContain(prospect.status)
    })
  })

  it('should include top tier 1 companies', () => {
    const companies = HITLIST_PROSPECTS.map(p => p.company)
    // Check for at least some known tier 1 companies
    expect(companies.some(c => 
      c.includes('GXO') || c.includes('XPO') || c.includes('Ryder') || 
      c.includes('StockX') || c.includes('NFI')
    )).toBe(true)
  })
})

describe('Hitlist Helper Functions', () => {
  it('getAllProspects should return all prospects', () => {
    const allProspects = getAllProspects()
    expect(allProspects.length).toBe(HITLIST_PROSPECTS.length)
  })

  it('getTier1Prospects should filter tier 1 only', () => {
    const tier1 = getTier1Prospects()
    tier1.forEach(prospect => {
      expect(prospect.tier).toBe('Tier 1')
    })
  })

  it('getQualifiedProspects should filter qualified only', () => {
    const qualified = getQualifiedProspects()
    qualified.forEach(prospect => {
      expect(prospect.qualified).toBe(true)
    })
  })
})

describe('Prospect Data Integrity', () => {
  it('should have unique IDs', () => {
    const ids = HITLIST_PROSPECTS.map(p => p.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should have non-empty names', () => {
    HITLIST_PROSPECTS.forEach(prospect => {
      expect(prospect.name.trim().length).toBeGreaterThan(0)
    })
  })

  it('should have non-empty company names', () => {
    HITLIST_PROSPECTS.forEach(prospect => {
      expect(prospect.company.trim().length).toBeGreaterThan(0)
    })
  })
})

describe('Email Coverage', () => {
  it('should have at least 700 prospects with emails', () => {
    const withEmail = HITLIST_PROSPECTS.filter(p => p.email)
    expect(withEmail.length).toBeGreaterThanOrEqual(700)
  })

  it('should have accurate withEmail count in stats', () => {
    const actualWithEmail = HITLIST_PROSPECTS.filter(p => p.email).length
    expect(HITLIST_STATS.withEmail).toBe(actualWithEmail)
  })

  it('should only have valid email formats', () => {
    const withEmail = HITLIST_PROSPECTS.filter(p => p.email)
    withEmail.forEach(p => {
      expect(isValidEmail(p.email)).toBe(true)
    })
  })

  it('should have emailConfidence set when email exists', () => {
    const withEmail = HITLIST_PROSPECTS.filter(p => p.email)
    withEmail.forEach(p => {
      expect(p.emailConfidence).toBeDefined()
      expect(['verified', 'high', 'medium', 'low', 'inferred']).toContain(p.emailConfidence)
    })
  })

  it('getProspectsWithEmail returns only prospects with email', () => {
    const withEmail = getProspectsWithEmail()
    expect(withEmail.length).toBeGreaterThan(0)
    withEmail.forEach(p => {
      expect(p.email).toBeDefined()
      expect(p.email).toContain('@')
    })
  })
})

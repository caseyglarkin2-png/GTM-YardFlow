import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Import after mocking
import { ActivityTracker } from '../../services/ActivityTracker'

describe('ActivityTracker', () => {
  let tracker: ActivityTracker

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    tracker = new ActivityTracker()
  })

  describe('Activity Tracking', () => {
    it('should track new activities', () => {
      tracker.track({
        type: 'status_change',
        user: 'Me',
        prospectId: '1',
        prospectName: 'John Smith',
        details: 'Changed status from new to contacted',
      })

      const activities = tracker.getRecent()
      expect(activities.length).toBe(1)
      expect(activities[0].prospectName).toBe('John Smith')
    })

    it('should add timestamps and ids automatically', () => {
      tracker.track({
        type: 'status_change',
        user: 'Jake',
        prospectId: '2',
        prospectName: 'Jane Doe',
        details: 'Changed status',
      })

      const activities = tracker.getRecent()
      expect(activities[0].id).toBeDefined()
      expect(activities[0].timestamp).toBeDefined()
      expect(typeof activities[0].timestamp).toBe('number')
    })

    it('should order activities most recent first', () => {
      tracker.track({
        type: 'status_change',
        user: 'Me',
        prospectId: '1',
        prospectName: 'First',
        details: 'First action',
      })

      tracker.track({
        type: 'status_change',
        user: 'Jake',
        prospectId: '2',
        prospectName: 'Second',
        details: 'Second action',
      })

      const activities = tracker.getRecent()
      expect(activities[0].prospectName).toBe('Second')
      expect(activities[1].prospectName).toBe('First')
    })

    it('should limit returned activities with count parameter', () => {
      for (let i = 0; i < 10; i++) {
        tracker.track({
          type: 'status_change',
          user: 'Me',
          prospectId: String(i),
          prospectName: `Prospect ${i}`,
          details: 'Action',
        })
      }

      const activities = tracker.getRecent(5)
      expect(activities.length).toBe(5)
    })
  })

  describe('Prospect-specific Activities', () => {
    it('should get activities for specific prospect', () => {
      tracker.track({
        type: 'status_change',
        user: 'Me',
        prospectId: '1',
        prospectName: 'John Smith',
        details: 'Action 1',
      })

      tracker.track({
        type: 'status_change',
        user: 'Jake',
        prospectId: '2',
        prospectName: 'Jane Doe',
        details: 'Action 2',
      })

      tracker.track({
        type: 'message_drafted',
        user: 'Me',
        prospectId: '1',
        prospectName: 'John Smith',
        details: 'Action 3',
      })

      const johnActivities = tracker.getForProspect('1')
      expect(johnActivities.length).toBe(2)
      expect(johnActivities[0].prospectName).toBe('John Smith')
    })
  })

  describe('Clear Activities', () => {
    it('should clear all activities', () => {
      tracker.track({
        type: 'status_change',
        user: 'Me',
        prospectId: '1',
        prospectName: 'John',
        details: 'Action',
      })

      tracker.clear()
      const activities = tracker.getRecent()

      expect(activities.length).toBe(0)
    })
  })
})

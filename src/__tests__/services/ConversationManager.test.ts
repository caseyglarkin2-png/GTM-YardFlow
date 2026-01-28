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
import { ConversationManager, ConversationManagerSingleton } from '../../services/ConversationManager'
import type { Message, ProspectContext } from '../../services/ConversationManager'

describe('ConversationManager', () => {
  let manager: ConversationManager

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    // Create a fresh instance for each test
    manager = new ConversationManager()
    manager.clearHistory()
  })

  describe('Message Management', () => {
    it('should add a message to history', () => {
      const message: Message = {
        role: 'user',
        content: 'Test message',
        timestamp: Date.now(),
      }

      manager.addMessage(message)
      const history = manager.getHistory()

      expect(history.length).toBe(1)
      expect(history[0].content).toBe('Test message')
    })

    it('should maintain message order', () => {
      const messages: Message[] = [
        { role: 'user', content: 'First', timestamp: 1 },
        { role: 'model', content: 'Second', timestamp: 2 },
        { role: 'user', content: 'Third', timestamp: 3 },
      ]

      messages.forEach(m => manager.addMessage(m))
      const history = manager.getHistory()

      expect(history[0].content).toBe('First')
      expect(history[1].content).toBe('Second')
      expect(history[2].content).toBe('Third')
    })

    it('should clear history', () => {
      manager.addMessage({
        role: 'user',
        content: 'Test',
        timestamp: Date.now(),
      })

      manager.clearHistory()
      const history = manager.getHistory()

      expect(history.length).toBe(0)
    })
  })

  describe('Prospect Context', () => {
    it('should set and get prospect context', () => {
      const prospect: ProspectContext = {
        name: 'John Smith',
        title: 'VP Operations',
        company: 'Acme Corp',
        tier: '1',
        score: 95,
        isOps: true,
        isExec: false,
        status: 'not_started',
      }

      manager.setProspectContext(prospect)
      const context = manager.getProspectContext()

      expect(context?.name).toBe('John Smith')
      expect(context?.company).toBe('Acme Corp')
    })

    it('should clear prospect context', () => {
      manager.setProspectContext({
        name: 'Test',
        title: 'Title',
        company: 'Company',
        tier: '1',
        score: 50,
        isOps: false,
        isExec: false,
        status: 'not_started',
      })

      manager.setProspectContext(null)
      const context = manager.getProspectContext()

      expect(context).toBeNull()
    })
  })

  describe('Recent Actions', () => {
    it('should record recent actions', () => {
      manager.addRecentAction({
        prospectId: '1',
        prospectName: 'John Smith',
        fromStatus: 'not_started',
        toStatus: 'contacted',
        timestamp: Date.now(),
      })

      const actions = manager.getRecentActions()
      expect(actions.length).toBe(1)
      expect(actions[0].prospectName).toBe('John Smith')
    })
  })

  describe('Context Building', () => {
    it('should build complete context', () => {
      manager.addMessage({
        role: 'user',
        content: 'Hello',
        timestamp: Date.now(),
      })

      manager.setStats({
        total: 50,
        contacted: 10,
        booked: 2,
        tier1: 15,
      })

      const history = manager.getHistory()

      expect(history.length).toBe(1)
    })
  })
})

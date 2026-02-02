
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SequenceSchedulerService } from '../../services/SequenceSchedulerService';

// Mock types
const mockEnrollment = {
  id: 'enroll-1',
  prospectId: 'prospect-1',
  sequenceId: 'seq-1',
  status: 'active',
  currentStep: 'initial',
  currentStepIndex: 0, // Added field
  nextSendAt: '2025-01-01T00:00:00.000Z',
  completedSteps: [],
  history: [],
};

const mockSequence = {
  id: 'seq-1',
  steps: [
    { id: 'step-1', type: 'initial', delayDays: 0, subjectTemplate: 'Hi', bodyTemplate: 'Hello' },
    { id: 'step-2', type: 'follow_up_1', delayDays: 2, subjectTemplate: 'Re: Hi', bodyTemplate: 'Just checking in' }
  ]
};

// Simple mock for DocumentReference
const mockDocRef = {
  get: vi.fn(),
  update: vi.fn().mockResolvedValue({}),
  set: vi.fn().mockResolvedValue({}),
  delete: vi.fn().mockResolvedValue({}),
};

// Simple mock for CollectionReference
const mockCollection: any = {
  where: vi.fn().mockImplementation((field, op, val) => {
    console.log(`Query: where ${field} ${op} ${val}`);
    return mockCollection;
  }),
  limit: vi.fn().mockReturnThis(),
  get: vi.fn().mockImplementation(() => {
    console.log('get() called. Returning empty snapshot.');
    return Promise.resolve({ empty: true, docs: [] });
  }),
  doc: vi.fn(() => mockDocRef), // Return doc ref
};

const mockDb: any = {
  collection: vi.fn(() => mockCollection),
  batch: vi.fn(() => ({ commit: vi.fn(), update: vi.fn(), set: vi.fn() })),
  runTransaction: vi.fn(),
};

describe('SequenceSchedulerService Logic Check', () => {
  let scheduler: SequenceSchedulerService;

  beforeEach(() => {
    vi.clearAllMocks();
    scheduler = new SequenceSchedulerService(mockDb);
  });

  it('generates the correct query for due enrollments', async () => {
    mockCollection.get.mockResolvedValue({ docs: [] });
    
    await scheduler.getDueEnrollments(25);
    
    // Check if the query matches our expectation (Status + Time)
    expect(mockDb.collection).toHaveBeenCalledWith('sequenceEnrollments');
    expect(mockCollection.where).toHaveBeenCalledWith('status', '==', 'active');
    
    // The second where clause uses "now", so we just check it was called
    const calls = mockCollection.where.mock.calls;
    const timeCall = calls.find((c: any[]) => c[0] === 'nextSendAt');
    expect(timeCall).toBeDefined();
    if (timeCall) {
        expect(timeCall[1]).toBe('<=');
        // Call[2] is the timestamp
        console.log('Query Time used:', timeCall[2]);
    }
  });

  it('returns enrollments when query matches', async () => {
    mockCollection.get
      .mockResolvedValueOnce({ docs: [{ id: 'enroll-1', data: () => mockEnrollment }] })
      .mockResolvedValueOnce({ empty: true, docs: [] });
    
    // Mock getting the sequence
    mockCollection.doc.mockImplementation((path: string) => {
      console.log('Fetching Doc:', path);
      if (path === 'seq-1') {
        return {
          get: vi.fn().mockResolvedValue({ exists: true, data: () => mockSequence }),
          update: vi.fn(), 
        } as any;
      }
      return mockDocRef;
    });

    const results = await scheduler.getDueEnrollments(25);
    console.log('Results:', JSON.stringify(results, null, 2));
    
    expect(results.length).toBe(1);
    expect(results[0].enrollment.id).toBe('enroll-1');
    expect(results[0].nextStep.type).toBe('initial');
  });
});

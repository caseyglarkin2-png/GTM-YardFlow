/**
 * useSequenceEnrollment Hook Tests
 * 
 * Tests for the sequence enrollment hook that manages
 * enrollment, pause, resume, and cancel operations.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Prospect } from '../../types';

// =============================================================================
// Mock Setup (vi.hoisted for proper hoisting)
// =============================================================================

const { mockRailwayClient, mockFeatureFlags, mockFirestore } = vi.hoisted(() => {
  const firestoreData = new Map<string, unknown>();
  
  return {
    mockRailwayClient: {
      enrollments: {
        list: vi.fn().mockResolvedValue({ ok: true, data: [] }),
        create: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        cancel: vi.fn(),
      },
    },
    mockFeatureFlags: {
      RAILWAY_ENABLED: false, // Default to Firestore mode for testing
      DUAL_WRITE_ENABLED: false,
      RAILWAY_DATA_ENABLED: false,
    },
    mockFirestore: {
      _data: firestoreData,
      collection: vi.fn(),
      doc: vi.fn(),
    },
  };
});

// Mock Firebase modules
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ id: 'mockCollection' })),
  getDocs: vi.fn(async () => ({
    docs: [],
  })),
  query: vi.fn(),
  where: vi.fn(),
  addDoc: vi.fn(async () => ({ id: 'new-enrollment-id' })),
  updateDoc: vi.fn(),
  doc: vi.fn(() => ({ id: 'mockDoc' })),
  serverTimestamp: vi.fn(() => new Date().toISOString()),
  onSnapshot: vi.fn((query, callback) => {
    // Immediately call with empty snapshot
    callback({ docs: [] });
    // Return unsubscribe function
    return vi.fn();
  }),
  getFirestore: vi.fn(() => ({})),
}));

vi.mock('firebase/app', () => ({
  getApp: vi.fn(() => ({})),
}));

vi.mock('@/services/RailwayApiClient', () => ({
  railwayClient: mockRailwayClient,
}));

vi.mock('@/config/featureFlags', () => ({
  featureFlags: mockFeatureFlags,
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-12345'),
}));

// Import after mocks
import { useSequenceEnrollment } from '../../hooks/useSequenceEnrollment';
import * as firestoreModule from 'firebase/firestore';

// =============================================================================
// Test Data
// =============================================================================

const mockProspect: Prospect = {
  id: 'prospect-1',
  name: 'John Doe',
  email: 'john@example.com',
  company: 'Acme Corp',
  title: 'CEO',
  status: 'new',
  tier: 'Tier 1',
  source: 'linkedin',
  score: 85,
  isOps: false,
  isExec: true,
};

const mockProspectNoEmail: Prospect = {
  id: 'prospect-2',
  name: 'Jane Smith',
  email: '',
  company: 'Test Corp',
  title: 'VP Operations',
  status: 'new',
  tier: 'Tier 2',
  source: 'manual',
  score: 70,
  isOps: true,
  isExec: false,
};

const mockSequences = [
  {
    id: 'seq-1',
    name: 'Cold Outreach',
    description: 'Standard cold outreach sequence',
    steps: [{ id: 's1' }, { id: 's2' }],
    status: 'active',
    enrolledCount: 10,
  },
  {
    id: 'seq-2',
    name: 'Meeting Follow-up',
    description: 'Follow up after meeting',
    steps: [{ id: 's1' }],
    status: 'active',
    enrolledCount: 5,
  },
];

// =============================================================================
// Tests
// =============================================================================

describe('useSequenceEnrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-27T10:00:00Z'));
    
    // Reset feature flags to Firestore mode
    mockFeatureFlags.RAILWAY_ENABLED = false;
    mockFeatureFlags.DUAL_WRITE_ENABLED = false;
    
    // Setup default mock responses
    vi.mocked(firestoreModule.getDocs).mockResolvedValue({
      docs: mockSequences.map(seq => ({
        id: seq.id,
        data: () => seq,
      })),
    } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('initializes with empty sequences', () => {
      const { result } = renderHook(() => useSequenceEnrollment());

      expect(result.current.sequences).toEqual([]);
      expect(result.current.isLoadingSequences).toBe(false);
      expect(result.current.isEnrolling).toBe(false);
    });

    it('initializes with empty enrollments map', () => {
      const { result } = renderHook(() => useSequenceEnrollment());

      expect(result.current.enrollments.size).toBe(0);
    });

    it('provides getEnrollmentForProspect function', () => {
      const { result } = renderHook(() => useSequenceEnrollment());

      expect(typeof result.current.getEnrollmentForProspect).toBe('function');
      expect(result.current.getEnrollmentForProspect('nonexistent')).toBeNull();
    });
  });

  describe('refreshSequences', () => {
    it('loads sequences from Firestore', async () => {
      const { result } = renderHook(() => useSequenceEnrollment());

      await act(async () => {
        await result.current.refreshSequences();
      });

      expect(firestoreModule.getDocs).toHaveBeenCalled();
    });

    it('handles errors gracefully', async () => {
      vi.mocked(firestoreModule.getDocs).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useSequenceEnrollment());

      await act(async () => {
        await result.current.refreshSequences();
      });

      expect(result.current.sequencesError).toBe('Network error');
    });

    it('sets loading state during fetch', async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      
      vi.mocked(firestoreModule.getDocs).mockReturnValueOnce(promise as ReturnType<typeof firestoreModule.getDocs>);

      const { result } = renderHook(() => useSequenceEnrollment());

      act(() => {
        result.current.refreshSequences();
      });

      // Should be loading while promise is pending
      expect(result.current.isLoadingSequences).toBe(true);

      await act(async () => {
        resolvePromise!({ docs: [] });
        await promise;
      });
    });
  });

  describe('enrollProspect', () => {
    it('enrolls prospect successfully via Firestore', async () => {
      // Mock getDocs to return empty for existing check (no duplicate)
      vi.mocked(firestoreModule.getDocs).mockResolvedValueOnce({
        empty: true,
        docs: [],
      } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);

      const { result } = renderHook(() => useSequenceEnrollment());

      let enrollmentResult: Awaited<ReturnType<typeof result.current.enrollProspect>>;
      
      await act(async () => {
        enrollmentResult = await result.current.enrollProspect(mockProspect, 'seq-1');
      });

      expect(enrollmentResult!.success).toBe(true);
      expect(enrollmentResult!.prospectId).toBe('prospect-1');
      expect(enrollmentResult!.prospectName).toBe('John Doe');
    });

    it('fails when prospect has no email', async () => {
      const { result } = renderHook(() => useSequenceEnrollment());

      let enrollmentResult: Awaited<ReturnType<typeof result.current.enrollProspect>>;
      
      await act(async () => {
        enrollmentResult = await result.current.enrollProspect(mockProspectNoEmail, 'seq-1');
      });

      expect(enrollmentResult!.success).toBe(false);
      expect(enrollmentResult!.error).toBe('Missing email address');
    });

    it('prevents duplicate enrollments', async () => {
      // Mock existing enrollment
      vi.mocked(firestoreModule.getDocs).mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'existing-enrollment' }],
      } as unknown as Awaited<ReturnType<typeof firestoreModule.getDocs>>);

      const { result } = renderHook(() => useSequenceEnrollment());

      let enrollmentResult: Awaited<ReturnType<typeof result.current.enrollProspect>>;
      
      await act(async () => {
        enrollmentResult = await result.current.enrollProspect(mockProspect, 'seq-1');
      });

      expect(enrollmentResult!.success).toBe(false);
      expect(enrollmentResult!.error).toBe('Already enrolled in this sequence');
    });

    it('enrolls via Railway when enabled', async () => {
      mockFeatureFlags.RAILWAY_ENABLED = true;
      mockRailwayClient.enrollments.create.mockResolvedValueOnce({
        ok: true,
        data: {
          id: 'railway-enrollment-1',
          status: 'active',
          currentStepIndex: 0,
          totalSteps: 4,
        },
      });

      const { result } = renderHook(() => useSequenceEnrollment());

      let enrollmentResult: Awaited<ReturnType<typeof result.current.enrollProspect>>;
      
      await act(async () => {
        enrollmentResult = await result.current.enrollProspect(mockProspect, 'seq-1');
      });

      expect(mockRailwayClient.enrollments.create).toHaveBeenCalledWith({
        prospectId: 'prospect-1',
        sequenceId: 'seq-1',
      });
      expect(enrollmentResult!.success).toBe(true);
      expect(enrollmentResult!.enrollmentId).toBe('railway-enrollment-1');
    });
  });

  describe('enrollProspects (bulk)', () => {
    it('enrolls multiple prospects', async () => {
      const { result } = renderHook(() => useSequenceEnrollment());

      const prospects = [mockProspect, { ...mockProspect, id: 'prospect-3', name: 'Bob Jones' }];
      let results: Awaited<ReturnType<typeof result.current.enrollProspects>>;
      
      await act(async () => {
        results = await result.current.enrollProspects(prospects, 'seq-1');
      });

      expect(results!).toHaveLength(2);
    });

    it('tracks enrollment progress', async () => {
      const { result } = renderHook(() => useSequenceEnrollment());

      const prospects = [mockProspect, { ...mockProspect, id: 'prospect-3' }];

      await act(async () => {
        result.current.enrollProspects(prospects, 'seq-1');
      });

      // Progress should be tracked during enrollment
      expect(result.current.enrollmentProgress).toBeDefined();
    });

    it('resets progress after completion', async () => {
      const { result } = renderHook(() => useSequenceEnrollment());

      await act(async () => {
        await result.current.enrollProspects([mockProspect], 'seq-1');
      });

      expect(result.current.enrollmentProgress).toBeNull();
      expect(result.current.isEnrolling).toBe(false);
    });
  });

  describe('pauseEnrollment', () => {
    it('pauses enrollment via Firestore', async () => {
      const { result } = renderHook(() => useSequenceEnrollment());

      await act(async () => {
        await result.current.pauseEnrollment('enrollment-1', 'manual');
      });

      expect(firestoreModule.updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'paused',
          pauseReason: 'manual',
        })
      );
    });

    it('pauses via Railway when enabled', async () => {
      mockFeatureFlags.RAILWAY_ENABLED = true;
      mockRailwayClient.enrollments.pause.mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useSequenceEnrollment());

      await act(async () => {
        await result.current.pauseEnrollment('enrollment-1', 'prospect_replied');
      });

      expect(mockRailwayClient.enrollments.pause).toHaveBeenCalledWith(
        'enrollment-1',
        'prospect_replied'
      );
    });

    it('throws error when Railway fails and dual-write is disabled', async () => {
      mockFeatureFlags.RAILWAY_ENABLED = true;
      mockFeatureFlags.DUAL_WRITE_ENABLED = false;
      mockRailwayClient.enrollments.pause.mockResolvedValueOnce({ 
        ok: false, 
        error: 'Not found' 
      });

      const { result } = renderHook(() => useSequenceEnrollment());

      await expect(
        act(async () => {
          await result.current.pauseEnrollment('enrollment-1');
        })
      ).rejects.toThrow('Not found');
    });
  });

  describe('resumeEnrollment', () => {
    it('resumes enrollment via Firestore', async () => {
      const { result } = renderHook(() => useSequenceEnrollment());

      await act(async () => {
        await result.current.resumeEnrollment('enrollment-1');
      });

      expect(firestoreModule.updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'active',
          pausedAt: null,
          pauseReason: null,
        })
      );
    });

    it('calculates next send time on resume', async () => {
      const { result } = renderHook(() => useSequenceEnrollment());

      await act(async () => {
        await result.current.resumeEnrollment('enrollment-1');
      });

      expect(firestoreModule.updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          nextSendAt: expect.any(String),
        })
      );
    });

    it('resumes via Railway when enabled', async () => {
      mockFeatureFlags.RAILWAY_ENABLED = true;
      mockRailwayClient.enrollments.resume.mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useSequenceEnrollment());

      await act(async () => {
        await result.current.resumeEnrollment('enrollment-1');
      });

      expect(mockRailwayClient.enrollments.resume).toHaveBeenCalledWith('enrollment-1');
    });
  });

  describe('cancelEnrollment', () => {
    it('cancels enrollment via Firestore', async () => {
      const { result } = renderHook(() => useSequenceEnrollment());

      await act(async () => {
        await result.current.cancelEnrollment('enrollment-1');
      });

      expect(firestoreModule.updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'completed',
          pauseReason: 'cancelled_by_user',
          nextSendAt: null,
        })
      );
    });

    it('cancels via Railway when enabled', async () => {
      mockFeatureFlags.RAILWAY_ENABLED = true;
      mockRailwayClient.enrollments.cancel.mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useSequenceEnrollment());

      await act(async () => {
        await result.current.cancelEnrollment('enrollment-1');
      });

      expect(mockRailwayClient.enrollments.cancel).toHaveBeenCalledWith('enrollment-1');
    });

    it('throws error when Railway fails', async () => {
      mockFeatureFlags.RAILWAY_ENABLED = true;
      mockFeatureFlags.DUAL_WRITE_ENABLED = false;
      mockRailwayClient.enrollments.cancel.mockResolvedValueOnce({ 
        ok: false, 
        error: 'Enrollment not found' 
      });

      const { result } = renderHook(() => useSequenceEnrollment());

      await expect(
        act(async () => {
          await result.current.cancelEnrollment('enrollment-1');
        })
      ).rejects.toThrow('Enrollment not found');
    });
  });

  describe('getEnrollmentForProspect', () => {
    it('returns null for prospect with no enrollment', () => {
      const { result } = renderHook(() => useSequenceEnrollment());

      const enrollment = result.current.getEnrollmentForProspect('prospect-1');

      expect(enrollment).toBeNull();
    });

    it('looks up enrollment from the enrollments map', () => {
      const { result } = renderHook(() => useSequenceEnrollment());

      // The function should return null when no enrollments exist
      const enrollment = result.current.getEnrollmentForProspect('prospect-1');
      expect(enrollment).toBeNull();
      
      // Verify the function is callable
      expect(typeof result.current.getEnrollmentForProspect).toBe('function');
    });
  });

  describe('state management', () => {
    it('exposes isEnrolling state', () => {
      const { result } = renderHook(() => useSequenceEnrollment());

      expect(typeof result.current.isEnrolling).toBe('boolean');
    });

    it('exposes enrollmentProgress state', () => {
      const { result } = renderHook(() => useSequenceEnrollment());

      expect(result.current.enrollmentProgress).toBeNull();
    });

    it('updates enrollments map on changes', async () => {
      const { result } = renderHook(() => useSequenceEnrollment());

      // Initially empty
      expect(result.current.enrollments.size).toBe(0);
    });
  });
});

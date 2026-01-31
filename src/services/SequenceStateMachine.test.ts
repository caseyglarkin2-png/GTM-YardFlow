/**
 * Tests for SequenceStateMachine
 * 
 * Sprint 3 T3.2: Unit tests for enrollment state transitions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  SequenceStateMachine, 
  sequenceStateMachine,
  canTransitionEnrollment,
  getEnrollmentStatusDisplay,
  type TransitionTrigger,
  type TransitionEvent 
} from './SequenceStateMachine';
import type { SequenceEnrollment, EnrollmentStatus } from '../types/emailSequence';

// Helper to create mock enrollment
function createMockEnrollment(status: EnrollmentStatus): SequenceEnrollment {
  return {
    id: 'test-enrollment-1',
    sequenceId: 'seq-1',
    prospectId: 'prospect-1',
    prospectEmail: 'test@example.com',
    prospectName: 'Test User',
    companyName: 'Test Company',
    status,
    currentStepIndex: 0,
    enrolledAt: new Date().toISOString(),
    stepHistory: [],
  };
}

describe('SequenceStateMachine', () => {
  let stateMachine: SequenceStateMachine;

  beforeEach(() => {
    stateMachine = new SequenceStateMachine();
  });

  describe('canTransition', () => {
    it('should allow active -> paused', () => {
      expect(stateMachine.canTransition('active', 'paused')).toBe(true);
    });

    it('should allow active -> completed', () => {
      expect(stateMachine.canTransition('active', 'completed')).toBe(true);
    });

    it('should allow active -> replied', () => {
      expect(stateMachine.canTransition('active', 'replied')).toBe(true);
    });

    it('should allow active -> meeting', () => {
      expect(stateMachine.canTransition('active', 'meeting')).toBe(true);
    });

    it('should allow paused -> active (resume)', () => {
      expect(stateMachine.canTransition('paused', 'active')).toBe(true);
    });

    it('should allow paused -> unsubscribed (user cancel)', () => {
      expect(stateMachine.canTransition('paused', 'unsubscribed')).toBe(true);
    });

    it('should NOT allow completed -> active', () => {
      expect(stateMachine.canTransition('completed', 'active')).toBe(false);
    });

    it('should NOT allow replied -> paused', () => {
      expect(stateMachine.canTransition('replied', 'paused')).toBe(false);
    });
  });

  describe('isTerminal', () => {
    it('should identify completed as terminal', () => {
      expect(stateMachine.isTerminal('completed')).toBe(true);
    });

    it('should identify replied as terminal', () => {
      expect(stateMachine.isTerminal('replied')).toBe(true);
    });

    it('should identify meeting as terminal', () => {
      expect(stateMachine.isTerminal('meeting')).toBe(true);
    });

    it('should identify unsubscribed as terminal', () => {
      expect(stateMachine.isTerminal('unsubscribed')).toBe(true);
    });

    it('should NOT identify active as terminal', () => {
      expect(stateMachine.isTerminal('active')).toBe(false);
    });

    it('should NOT identify paused as terminal', () => {
      expect(stateMachine.isTerminal('paused')).toBe(false);
    });
  });

  describe('transition', () => {
    it('should successfully transition active -> paused via manual_pause', () => {
      const enrollment = createMockEnrollment('active');
      const result = stateMachine.transition(enrollment, 'manual_pause');
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('paused');
    });

    it('should successfully transition active -> completed via all_steps_completed', () => {
      const enrollment = createMockEnrollment('active');
      const result = stateMachine.transition(enrollment, 'all_steps_completed');
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('completed');
    });

    it('should successfully transition active -> replied via reply_detected', () => {
      const enrollment = createMockEnrollment('active');
      const result = stateMachine.transition(enrollment, 'reply_detected');
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('replied');
    });

    it('should successfully transition active -> paused via ooo_detected', () => {
      const enrollment = createMockEnrollment('active');
      const result = stateMachine.transition(enrollment, 'ooo_detected');
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('paused');
    });

    it('should successfully transition paused -> active via resume', () => {
      const enrollment = createMockEnrollment('paused');
      const result = stateMachine.transition(enrollment, 'resume');
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('active');
    });

    it('should fail to transition from terminal state', () => {
      const enrollment = createMockEnrollment('completed');
      const result = stateMachine.transition(enrollment, 'resume');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('terminal state');
    });

    it('should return success with same status if already in target state', () => {
      const enrollment = createMockEnrollment('active');
      // Try to enroll an already active enrollment
      enrollment.status = 'active';
      const result = stateMachine.transition(enrollment, 'enroll');
      
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('active');
      expect(result.reason).toContain('Already in target state');
    });

    it('should fail with invalid transition path', () => {
      const enrollment = createMockEnrollment('paused');
      const result = stateMachine.transition(enrollment, 'all_steps_completed');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transition');
    });
  });

  describe('buildTransitionUpdate', () => {
    it('should build paused update with pausedAt and pauseReason', () => {
      const update = stateMachine.buildTransitionUpdate('paused', 'manual_pause');
      
      expect(update.status).toBe('paused');
      expect(update.pausedAt).toBeDefined();
      expect(update.pauseReason).toBe('Manually paused by user');
      expect(update.nextSendAt).toBeNull();
    });

    it('should build OOO pause update with appropriate reason', () => {
      const update = stateMachine.buildTransitionUpdate('paused', 'ooo_detected');
      
      expect(update.status).toBe('paused');
      expect(update.pauseReason).toBe('Out-of-office reply detected');
    });

    it('should build completed update with completedAt', () => {
      const update = stateMachine.buildTransitionUpdate('completed', 'all_steps_completed');
      
      expect(update.status).toBe('completed');
      expect(update.completedAt).toBeDefined();
      expect(update.nextSendAt).toBeNull();
    });

    it('should build active update clearing pause fields', () => {
      const update = stateMachine.buildTransitionUpdate('active', 'resume');
      
      expect(update.status).toBe('active');
      expect(update.pausedAt).toBeNull();
      expect(update.pauseReason).toBeNull();
    });
  });

  describe('event listeners', () => {
    it('should emit transition events to listeners', () => {
      const listener = vi.fn();
      const unsubscribe = stateMachine.onTransition(listener);
      
      const enrollment = createMockEnrollment('active');
      stateMachine.transition(enrollment, 'reply_detected');
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        enrollmentId: 'test-enrollment-1',
        fromStatus: 'active',
        toStatus: 'replied',
        trigger: 'reply_detected',
      }));
      
      unsubscribe();
    });

    it('should allow unsubscribing from events', () => {
      const listener = vi.fn();
      const unsubscribe = stateMachine.onTransition(listener);
      
      unsubscribe();
      
      const enrollment = createMockEnrollment('active');
      stateMachine.transition(enrollment, 'reply_detected');
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();
      
      stateMachine.onTransition(errorListener);
      stateMachine.onTransition(normalListener);
      
      const enrollment = createMockEnrollment('active');
      
      // Should not throw
      expect(() => {
        stateMachine.transition(enrollment, 'manual_pause');
      }).not.toThrow();
      
      // Normal listener should still be called
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('canSendNextStep', () => {
    it('should return true for active enrollments', () => {
      const enrollment = createMockEnrollment('active');
      expect(stateMachine.canSendNextStep(enrollment)).toBe(true);
    });

    it('should return false for paused enrollments', () => {
      const enrollment = createMockEnrollment('paused');
      expect(stateMachine.canSendNextStep(enrollment)).toBe(false);
    });

    it('should return false for completed enrollments', () => {
      const enrollment = createMockEnrollment('completed');
      expect(stateMachine.canSendNextStep(enrollment)).toBe(false);
    });

    it('should return false for replied enrollments', () => {
      const enrollment = createMockEnrollment('replied');
      expect(stateMachine.canSendNextStep(enrollment)).toBe(false);
    });
  });

  describe('getStatusDisplay', () => {
    it('should return green for active', () => {
      const display = stateMachine.getStatusDisplay('active');
      expect(display.color).toBe('green');
      expect(display.label).toBe('Active');
    });

    it('should return yellow for paused', () => {
      const display = stateMachine.getStatusDisplay('paused');
      expect(display.color).toBe('yellow');
      expect(display.label).toBe('Paused');
    });

    it('should return purple for replied', () => {
      const display = stateMachine.getStatusDisplay('replied');
      expect(display.color).toBe('purple');
      expect(display.label).toBe('Replied');
    });

    it('should return green for meeting booked', () => {
      const display = stateMachine.getStatusDisplay('meeting');
      expect(display.color).toBe('green');
      expect(display.label).toBe('Meeting Booked');
    });
  });

  describe('getValidTransitions', () => {
    it('should return valid transitions for active state', () => {
      const transitions = stateMachine.getValidTransitions('active');
      expect(transitions).toContain('paused');
      expect(transitions).toContain('completed');
      expect(transitions).toContain('replied');
      expect(transitions).toContain('meeting');
    });

    it('should return empty array for terminal states', () => {
      expect(stateMachine.getValidTransitions('completed')).toEqual([]);
      expect(stateMachine.getValidTransitions('replied')).toEqual([]);
      expect(stateMachine.getValidTransitions('unsubscribed')).toEqual([]);
    });
  });
});

describe('Helper exports', () => {
  describe('canTransitionEnrollment', () => {
    it('should use singleton and check transition', () => {
      const enrollment = createMockEnrollment('active');
      expect(canTransitionEnrollment(enrollment, 'reply_detected')).toBe(true);
    });
  });

  describe('getEnrollmentStatusDisplay', () => {
    it('should return display info for status', () => {
      const display = getEnrollmentStatusDisplay('active');
      expect(display.label).toBe('Active');
    });
  });
});

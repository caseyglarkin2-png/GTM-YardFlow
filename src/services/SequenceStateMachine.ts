/**
 * Sequence State Machine - YardFlow Hub
 * 
 * Sprint 3 T3.2: Extracted state machine for enrollment lifecycle management.
 * 
 * This class encapsulates all enrollment state transitions following
 * the documented state machine in docs/ENROLLMENT_STATE_MACHINE.md
 * 
 * States:
 * - active: Prospect is receiving sequence emails on schedule
 * - paused: Temporarily stopped (manual or automatic)
 * - completed: All sequence steps sent successfully
 * - cancelled: Manually cancelled by user
 * - replied: Prospect replied, sequence auto-stopped
 * - failed: Permanent failure (invalid email, too many bounces)
 * 
 * @see docs/ENROLLMENT_STATE_MACHINE.md
 */

import type { EnrollmentStatus, SequenceEnrollment } from '../types/emailSequence';

// ============================================
// Types
// ============================================

export type TransitionTrigger =
  // Entry triggers
  | 'enroll'
  | 'bulk_enroll'
  | 'import_auto_enroll'
  // Active state triggers
  | 'manual_pause'
  | 'soft_bounce'
  | 'all_steps_completed'
  | 'reply_detected'
  | 'hard_bounce'
  | 'invalid_email'
  | 'user_cancel'
  | 'ooo_detected'
  // Paused state triggers
  | 'resume'
  // Meeting triggers
  | 'meeting_booked';

export interface TransitionResult {
  success: boolean;
  newStatus?: EnrollmentStatus;
  reason?: string;
  error?: string;
}

export interface TransitionEvent {
  enrollmentId: string;
  fromStatus: EnrollmentStatus | null;
  toStatus: EnrollmentStatus;
  trigger: TransitionTrigger;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface StateTransitionUpdate {
  status: EnrollmentStatus;
  pausedAt?: string | null;
  pauseReason?: string | null;
  completedAt?: string | null;
  nextSendAt?: string | null;
  lastUpdated: string;
}

// ============================================
// State Machine Configuration
// ============================================

/**
 * Valid state transitions map
 * Key: current state
 * Value: array of allowed next states
 * 
 * Note: 'cancelled' and 'failed' are represented as 'unsubscribed' and 'bounced'
 * in the actual EnrollmentStatus type
 */
const VALID_TRANSITIONS: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  active: ['paused', 'completed', 'replied', 'bounced', 'meeting', 'unsubscribed'],
  paused: ['active', 'unsubscribed', 'replied', 'meeting'],
  completed: [], // Terminal state
  replied: [], // Terminal state
  meeting: [], // Terminal state
  bounced: ['active'], // Can retry after bounce resolution
  unsubscribed: [], // Terminal state
};

/**
 * Terminal states - no further transitions allowed
 */
const TERMINAL_STATES: EnrollmentStatus[] = ['completed', 'replied', 'meeting', 'unsubscribed'];

/**
 * Trigger to target state mapping
 */
const TRIGGER_TO_STATE: Record<TransitionTrigger, EnrollmentStatus | null> = {
  // Entry triggers -> active
  enroll: 'active',
  bulk_enroll: 'active',
  import_auto_enroll: 'active',
  
  // Active -> paused triggers
  manual_pause: 'paused',
  soft_bounce: 'paused',
  ooo_detected: 'paused',
  
  // Active -> terminal triggers
  all_steps_completed: 'completed',
  reply_detected: 'replied',
  hard_bounce: 'bounced',
  invalid_email: 'bounced',
  user_cancel: 'unsubscribed',
  meeting_booked: 'meeting',
  
  // Paused -> active
  resume: 'active',
};

// ============================================
// State Machine Class
// ============================================

export class SequenceStateMachine {
  private eventListeners: ((event: TransitionEvent) => void)[] = [];

  /**
   * Check if a transition is valid from the current state
   */
  canTransition(currentStatus: EnrollmentStatus, targetStatus: EnrollmentStatus): boolean {
    const allowedTransitions = VALID_TRANSITIONS[currentStatus];
    return allowedTransitions?.includes(targetStatus) ?? false;
  }

  /**
   * Check if the state is terminal (no further transitions)
   */
  isTerminal(status: EnrollmentStatus): boolean {
    return TERMINAL_STATES.includes(status);
  }

  /**
   * Get the target state for a given trigger
   */
  getTargetState(trigger: TransitionTrigger): EnrollmentStatus | null {
    return TRIGGER_TO_STATE[trigger] ?? null;
  }

  /**
   * Get all valid transitions from a given state
   */
  getValidTransitions(currentStatus: EnrollmentStatus): EnrollmentStatus[] {
    return VALID_TRANSITIONS[currentStatus] ?? [];
  }

  /**
   * Get the update payload for Railway synchronization
   * Ensures the Railway state matches the Firestore logic
   */
  getRailwayUpdate(
    status: EnrollmentStatus, 
    trigger: TransitionTrigger,
    metadata?: Record<string, any>
  ): Record<string, any> {
    const update: Record<string, any> = {
      status, 
      lastUpdated: new Date().toISOString()
    };

    // Add specific fields based on terminal states
    if (this.isTerminal(status)) {
      update.completionReason = trigger;
      update.completedAt = new Date().toISOString();
    }

    if (status === 'paused') {
      update.pauseReason = trigger;
    }

    // Merge any transition metadata (e.g., replyId, meetingId)
    if (metadata) {
      Object.assign(update, metadata);
    }
    
    return update;
  }

  /**
   * Attempt to transition an enrollment to a new state
   * 
   * @param enrollment Current enrollment data
   * @param trigger The event triggering the transition
   * @returns TransitionResult with success/failure and new status
   */
  transition(
    enrollment: SequenceEnrollment,
    trigger: TransitionTrigger
  ): TransitionResult {
    const currentStatus = enrollment.status;
    const targetStatus = this.getTargetState(trigger);

    if (!targetStatus) {
      return {
        success: false,
        error: `Unknown trigger: ${trigger}`,
      };
    }

    // Check if already in target state
    if (currentStatus === targetStatus) {
      return {
        success: true,
        newStatus: targetStatus,
        reason: 'Already in target state',
      };
    }

    // Check if current state is terminal
    if (this.isTerminal(currentStatus)) {
      return {
        success: false,
        error: `Cannot transition from terminal state: ${currentStatus}`,
      };
    }

    // Check if transition is valid
    if (!this.canTransition(currentStatus, targetStatus)) {
      return {
        success: false,
        error: `Invalid transition: ${currentStatus} -> ${targetStatus} (trigger: ${trigger})`,
      };
    }

    // Transition is valid
    const event: TransitionEvent = {
      enrollmentId: enrollment.id,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      trigger,
      timestamp: new Date().toISOString(),
    };

    // Emit event to listeners
    this.emitEvent(event);

    return {
      success: true,
      newStatus: targetStatus,
      reason: `Transitioned via ${trigger}`,
    };
  }

  /**
   * Build the Firestore update object for a transition
   */
  buildTransitionUpdate(
    targetStatus: EnrollmentStatus,
    trigger: TransitionTrigger
  ): StateTransitionUpdate {
    const now = new Date().toISOString();
    const base: StateTransitionUpdate = {
      status: targetStatus,
      lastUpdated: now,
    };

    switch (targetStatus) {
      case 'paused':
        return {
          ...base,
          pausedAt: now,
          pauseReason: this.getPauseReason(trigger),
          nextSendAt: null,
        };

      case 'completed':
      case 'replied':
      case 'meeting':
        return {
          ...base,
          completedAt: now,
          nextSendAt: null,
        };

      case 'bounced':
      case 'unsubscribed':
        return {
          ...base,
          nextSendAt: null,
        };

      case 'active':
        return {
          ...base,
          pausedAt: null,
          pauseReason: null,
        };

      default:
        return base;
    }
  }

  /**
   * Get the human-readable pause reason for a trigger
   */
  private getPauseReason(trigger: TransitionTrigger): string {
    switch (trigger) {
      case 'manual_pause':
        return 'Manually paused by user';
      case 'soft_bounce':
        return 'Soft bounce detected - temporary delivery issue';
      case 'ooo_detected':
        return 'Out-of-office reply detected';
      default:
        return `Paused due to: ${trigger}`;
    }
  }

  /**
   * Register a listener for state transition events
   */
  onTransition(listener: (event: TransitionEvent) => void): () => void {
    this.eventListeners.push(listener);
    // Return unsubscribe function
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit a transition event to all listeners
   */
  private emitEvent(event: TransitionEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[StateMachine] Error in transition listener:', error);
      }
    }
  }

  /**
   * Validate enrollment can receive the next step
   * 
   * @returns true if enrollment is active and not in terminal state
   */
  canSendNextStep(enrollment: SequenceEnrollment): boolean {
    return enrollment.status === 'active';
  }

  /**
   * Get status display information
   */
  getStatusDisplay(status: EnrollmentStatus): { label: string; color: string; icon: string } {
    const displays: Record<EnrollmentStatus, { label: string; color: string; icon: string }> = {
      active: { label: 'Active', color: 'green', icon: '🟢' },
      paused: { label: 'Paused', color: 'yellow', icon: '🟡' },
      completed: { label: 'Completed', color: 'blue', icon: '✅' },
      replied: { label: 'Replied', color: 'purple', icon: '💬' },
      meeting: { label: 'Meeting Booked', color: 'green', icon: '📅' },
      bounced: { label: 'Bounced', color: 'red', icon: '🔴' },
      unsubscribed: { label: 'Unsubscribed', color: 'gray', icon: '🚫' },
    };
    return displays[status] ?? { label: status, color: 'gray', icon: '❓' };
  }
}

// Singleton instance for convenience
export const sequenceStateMachine = new SequenceStateMachine();

// Export helper functions for common operations
export function canTransitionEnrollment(
  enrollment: SequenceEnrollment,
  trigger: TransitionTrigger
): boolean {
  const result = sequenceStateMachine.transition(enrollment, trigger);
  return result.success;
}

export function getEnrollmentStatusDisplay(status: EnrollmentStatus) {
  return sequenceStateMachine.getStatusDisplay(status);
}

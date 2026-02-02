/**
 * Sequence Mapper Utility
 * 
 * Maps between Client EmailSequence (UI state) and Railway Sequence (API payload).
 * 
 * Sprint 903: SequenceBuilder Railway Integration
 */

import type { EmailSequence, EmailStep, EmailStepType } from '../types/emailSequence';
import type { 
  RailwaySequence, 
  CreateSequenceRequest, 
  SequenceStep, 
  StepType 
} from '../types/railway';

/**
 * Convert Client EmailSequence to Railway CreateRequest
 */
export function toRailwayCreateRequest(sequence: EmailSequence): CreateSequenceRequest {
  return {
    name: sequence.name,
    description: sequence.description,
    steps: sequence.steps.map((step, index) => ({
      order: index,
      type: 'email' as StepType,
      delayDays: step.delayDays,
      delayHours: step.delayHours,
      subject: step.subject,
      body: step.body,
      // Mapping semantic type to taskDescription if needed, otherwise lost
      // For now we assume all steps in builder are emails
    }))
  };
}

/**
 * Convert Railway Sequence to Client EmailSequence
 * Note: Some UI-specific metadata (Step Type labels) might be inferred
 */
export function toClientSequence(railwaySeq: RailwaySequence): EmailSequence {
  return {
    id: railwaySeq.id,
    name: railwaySeq.name,
    description: railwaySeq.description || undefined,
    createdAt: railwaySeq.createdAt,
    updatedAt: railwaySeq.updatedAt,
    steps: railwaySeq.steps
      .sort((a, b) => a.order - b.order)
      .map((step, index) => mapRailwayStepToEmailStep(step, index)),
    enrolledCount: railwaySeq.enrollmentCount || 0,
    completedCount: railwaySeq.completedEnrollmentCount || 0,
    // Reply rate would require more calculation or backend data
    replyRate: 0,
    meetingRate: 0,
    
    // Defaulting these pending backend schema update
    status: (railwaySeq.status as any) || 'draft', // Type cast if needed depending on exact enum match
    skipWeekends: true,
    pauseOnReply: true,
    pauseOnMeeting: true,
    timezone: 'America/New_York',
  };
}

function mapRailwayStepToEmailStep(step: SequenceStep, index: number): EmailStep {
  // Infer UI step type based on index
  // 0 -> initial
  // Last -> break_up (heuristic)
  // Others -> follow_up
  
  let type: EmailStepType = 'follow_up_1';
  if (index === 0) type = 'initial';
  // We can refine this logic later or store it in metadata if schema permits
  
  return {
    id: step.id,
    type,
    subject: step.subject || '',
    body: step.body || '',
    delayDays: step.delayDays,
    delayHours: step.delayHours,
    condition: 'no_reply', // Default behavior for yardflow
  };
}

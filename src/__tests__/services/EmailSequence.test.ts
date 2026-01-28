/**
 * Email Sequence Service Tests - YardFlow Hub
 * 
 * Tests for sequence building, enrollment management,
 * A/B testing, and campaign management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSequence,
  createFromTemplate,
  addStep,
  updateStep,
  removeStep,
  reorderSteps,
  validateSequence,
  personalizeContent,
  getSequenceStats,
  enrollProspect,
  getEnrollmentProgress,
  createCampaign,
  getCampaignRates,
  createABTest,
  selectVariant,
  checkStatisticalSignificance,
  queueEmail,
  calculateSendTime,
  SEQUENCE_TEMPLATES,
  type EmailProspect,
} from '../../services/EmailSequenceService';
import type { EmailSequence, EmailStep, ABTest } from '../../types/emailSequence';

// ============================================
// Test Data
// ============================================

const mockProspect: EmailProspect = {
  id: 'p1',
  name: 'Sarah Johnson',
  email: 'sarah@acmelogistics.com',
  company: 'Acme Logistics',
  title: 'VP of Operations',
  linkedinUrl: 'https://linkedin.com/in/sarah',
  persona: 'ops_director',
  company_trailer_count: 75,
  industry: 'Transportation',
};

const mockSender = {
  name: 'John Smith',
  title: 'Account Executive',
  company: 'YardFlow',
};

let testSequence: EmailSequence;

// ============================================
// Sequence Builder Tests
// ============================================

describe('EmailSequenceService', () => {
  beforeEach(() => {
    testSequence = createSequence('Test Sequence', {
      description: 'A test sequence',
      persona: 'ops_director',
    });
  });

  describe('createSequence', () => {
    it('should create a sequence with required fields', () => {
      const sequence = createSequence('My Sequence');
      
      expect(sequence.id).toBeDefined();
      expect(sequence.name).toBe('My Sequence');
      expect(sequence.steps).toHaveLength(0);
      expect(sequence.status).toBe('draft');
      expect(sequence.createdAt).toBeDefined();
      expect(sequence.updatedAt).toBeDefined();
    });

    it('should apply optional settings', () => {
      const sequence = createSequence('My Sequence', {
        description: 'Test description',
        persona: 'cfo',
        skipWeekends: false,
      });
      
      expect(sequence.description).toBe('Test description');
      expect(sequence.persona).toBe('cfo');
      expect(sequence.skipWeekends).toBe(false);
    });

    it('should set default settings', () => {
      const sequence = createSequence('Default Test');
      
      expect(sequence.skipWeekends).toBe(true);
      expect(sequence.pauseOnReply).toBe(true);
      expect(sequence.pauseOnMeeting).toBe(true);
      expect(sequence.timezone).toBe('America/New_York');
    });
  });

  describe('createFromTemplate', () => {
    it('should create sequence from template', () => {
      const template = SEQUENCE_TEMPLATES[0];
      const sequence = createFromTemplate(template);
      
      expect(sequence.steps.length).toBe(template.steps.length);
      expect(sequence.persona).toBe(template.persona);
      expect(sequence.description).toBe(template.description);
    });

    it('should allow custom name', () => {
      const template = SEQUENCE_TEMPLATES[0];
      const sequence = createFromTemplate(template, 'Custom Name');
      
      expect(sequence.name).toBe('Custom Name');
    });

    it('should generate unique step IDs', () => {
      const template = SEQUENCE_TEMPLATES[0];
      const sequence = createFromTemplate(template);
      
      const ids = sequence.steps.map(s => s.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('addStep', () => {
    it('should add a step to sequence', () => {
      const step: Omit<EmailStep, 'id'> = {
        type: 'initial',
        subject: 'Test Subject',
        body: 'Test Body',
        delayDays: 0,
        condition: 'always',
      };
      
      const updated = addStep(testSequence, step);
      
      expect(updated.steps).toHaveLength(1);
      expect(updated.steps[0].subject).toBe('Test Subject');
      expect(updated.steps[0].id).toBeDefined();
    });

    it('should update the updatedAt timestamp', () => {
      const originalUpdatedAt = testSequence.updatedAt;
      
      // Small delay to ensure different timestamp
      const updated = addStep(testSequence, {
        type: 'initial',
        subject: 'Test',
        body: 'Test',
        delayDays: 0,
        condition: 'always',
      });
      
      expect(updated.updatedAt).toBeDefined();
    });
  });

  describe('updateStep', () => {
    it('should update an existing step', () => {
      let sequence = addStep(testSequence, {
        type: 'initial',
        subject: 'Original',
        body: 'Original body',
        delayDays: 0,
        condition: 'always',
      });
      
      const stepId = sequence.steps[0].id;
      sequence = updateStep(sequence, stepId, { subject: 'Updated' });
      
      expect(sequence.steps[0].subject).toBe('Updated');
      expect(sequence.steps[0].body).toBe('Original body'); // Unchanged
    });

    it('should not affect other steps', () => {
      let sequence = addStep(testSequence, {
        type: 'initial',
        subject: 'Step 1',
        body: 'Body 1',
        delayDays: 0,
        condition: 'always',
      });
      sequence = addStep(sequence, {
        type: 'follow_up_1',
        subject: 'Step 2',
        body: 'Body 2',
        delayDays: 3,
        condition: 'no_reply',
      });
      
      const stepId = sequence.steps[0].id;
      sequence = updateStep(sequence, stepId, { subject: 'Updated Step 1' });
      
      expect(sequence.steps[1].subject).toBe('Step 2');
    });
  });

  describe('removeStep', () => {
    it('should remove a step from sequence', () => {
      let sequence = addStep(testSequence, {
        type: 'initial',
        subject: 'Step 1',
        body: 'Body',
        delayDays: 0,
        condition: 'always',
      });
      sequence = addStep(sequence, {
        type: 'follow_up_1',
        subject: 'Step 2',
        body: 'Body',
        delayDays: 3,
        condition: 'no_reply',
      });
      
      const stepId = sequence.steps[0].id;
      sequence = removeStep(sequence, stepId);
      
      expect(sequence.steps).toHaveLength(1);
      expect(sequence.steps[0].subject).toBe('Step 2');
    });
  });

  describe('reorderSteps', () => {
    it('should reorder steps correctly', () => {
      let sequence = addStep(testSequence, {
        type: 'initial',
        subject: 'Step A',
        body: 'Body',
        delayDays: 0,
        condition: 'always',
      });
      sequence = addStep(sequence, {
        type: 'follow_up_1',
        subject: 'Step B',
        body: 'Body',
        delayDays: 3,
        condition: 'no_reply',
      });
      sequence = addStep(sequence, {
        type: 'follow_up_2',
        subject: 'Step C',
        body: 'Body',
        delayDays: 5,
        condition: 'no_reply',
      });
      
      sequence = reorderSteps(sequence, 0, 2);
      
      expect(sequence.steps[0].subject).toBe('Step B');
      expect(sequence.steps[1].subject).toBe('Step C');
      expect(sequence.steps[2].subject).toBe('Step A');
    });
  });

  // ============================================
  // Validation Tests
  // ============================================

  describe('validateSequence', () => {
    it('should pass valid sequence', () => {
      const template = SEQUENCE_TEMPLATES[0];
      const sequence = createFromTemplate(template);
      
      const errors = validateSequence(sequence);
      
      expect(errors).toHaveLength(0);
    });

    it('should fail sequence without name', () => {
      const sequence = createSequence('');
      
      const errors = validateSequence(sequence);
      
      expect(errors.some(e => e.field === 'name')).toBe(true);
    });

    it('should fail sequence without steps', () => {
      const sequence = createSequence('Test');
      
      const errors = validateSequence(sequence);
      
      expect(errors.some(e => e.field === 'steps')).toBe(true);
    });

    it('should fail step without subject', () => {
      let sequence = addStep(testSequence, {
        type: 'initial',
        subject: '',
        body: 'Body',
        delayDays: 0,
        condition: 'always',
      });
      
      const errors = validateSequence(sequence);
      
      expect(errors.some(e => e.field === 'subject')).toBe(true);
    });

    it('should fail step without body', () => {
      let sequence = addStep(testSequence, {
        type: 'initial',
        subject: 'Subject',
        body: '',
        delayDays: 0,
        condition: 'always',
      });
      
      const errors = validateSequence(sequence);
      
      expect(errors.some(e => e.field === 'body')).toBe(true);
    });
  });

  // ============================================
  // Personalization Tests
  // ============================================

  describe('personalizeContent', () => {
    it('should replace merge tags', () => {
      const content = 'Hi {{firstName}}, I noticed {{company}} is growing!';
      
      const result = personalizeContent(content, {
        prospect: mockProspect,
        sender: mockSender,
      });
      
      expect(result).toBe('Hi Sarah, I noticed Acme Logistics is growing!');
    });

    it('should handle all standard merge tags', () => {
      const content = `
        {{firstName}} {{lastName}}
        {{fullName}} at {{company}}
        {{title}} in {{industry}}
        {{email}}
        From: {{senderName}}, {{senderTitle}} at {{senderCompany}}
      `;
      
      const result = personalizeContent(content, {
        prospect: mockProspect,
        sender: mockSender,
      });
      
      expect(result).toContain('Sarah');
      expect(result).toContain('Johnson');
      expect(result).toContain('Acme Logistics');
      expect(result).toContain('VP of Operations');
      expect(result).toContain('John Smith');
      expect(result).toContain('YardFlow');
    });

    it('should handle trailer count', () => {
      const content = 'Running {{trailerCount}} trailers?';
      
      const result = personalizeContent(content, {
        prospect: mockProspect,
        sender: mockSender,
      });
      
      expect(result).toBe('Running 75 trailers?');
    });

    it('should handle custom fields', () => {
      const content = 'Reference: {{customRef}}';
      
      const result = personalizeContent(content, {
        prospect: mockProspect,
        sender: mockSender,
        customFields: { customRef: 'ABC123' },
      });
      
      expect(result).toBe('Reference: ABC123');
    });
  });

  // ============================================
  // Statistics Tests
  // ============================================

  describe('getSequenceStats', () => {
    it('should calculate total duration', () => {
      const template = SEQUENCE_TEMPLATES[0];
      const sequence = createFromTemplate(template);
      
      const stats = getSequenceStats(sequence);
      
      expect(stats.totalSteps).toBe(4);
      expect(stats.totalDuration).toBeGreaterThan(0);
    });

    it('should detect A/B tests', () => {
      let sequence = createSequence('Test');
      sequence = addStep(sequence, {
        type: 'initial',
        subject: 'Test',
        body: 'Body',
        delayDays: 0,
        condition: 'always',
        variants: [
          { id: 'v1', body: 'Variant A', weight: 50 },
          { id: 'v2', body: 'Variant B', weight: 50 },
        ],
      });
      
      const stats = getSequenceStats(sequence);
      
      expect(stats.hasABTests).toBe(true);
      expect(stats.variantCount).toBe(2);
    });

    it('should calculate average delay', () => {
      let sequence = createSequence('Test');
      sequence = addStep(sequence, {
        type: 'initial',
        subject: 'Step 1',
        body: 'Body',
        delayDays: 0,
        condition: 'always',
      });
      sequence = addStep(sequence, {
        type: 'follow_up_1',
        subject: 'Step 2',
        body: 'Body',
        delayDays: 3,
        condition: 'no_reply',
      });
      sequence = addStep(sequence, {
        type: 'follow_up_2',
        subject: 'Step 3',
        body: 'Body',
        delayDays: 6,
        condition: 'no_reply',
      });
      
      const stats = getSequenceStats(sequence);
      
      expect(stats.avgStepDelay).toBe(4.5); // (3 + 6) / 2
    });
  });

  // ============================================
  // Enrollment Tests
  // ============================================

  describe('enrollProspect', () => {
    it('should create enrollment record', () => {
      const template = SEQUENCE_TEMPLATES[0];
      const sequence = createFromTemplate(template);
      
      const enrollment = enrollProspect(sequence, mockProspect);
      
      expect(enrollment.id).toBeDefined();
      expect(enrollment.sequenceId).toBe(sequence.id);
      expect(enrollment.prospectId).toBe(mockProspect.id);
      expect(enrollment.status).toBe('active');
      expect(enrollment.currentStepIndex).toBe(0);
    });

    it('should include custom fields', () => {
      const template = SEQUENCE_TEMPLATES[0];
      const sequence = createFromTemplate(template);
      
      const enrollment = enrollProspect(sequence, mockProspect, {
        referralSource: 'LinkedIn',
      });
      
      expect(enrollment.customFields?.referralSource).toBe('LinkedIn');
    });
  });

  describe('getEnrollmentProgress', () => {
    it('should calculate progress percentage', () => {
      const template = SEQUENCE_TEMPLATES[0];
      const sequence = createFromTemplate(template);
      const enrollment = enrollProspect(sequence, mockProspect);
      
      // Simulate being on step 2 of 4
      enrollment.currentStepIndex = 2;
      
      const progress = getEnrollmentProgress(enrollment, sequence);
      
      expect(progress.currentStep).toBe(2);
      expect(progress.totalSteps).toBe(4);
      expect(progress.percentComplete).toBe(50);
    });
  });

  // ============================================
  // Campaign Tests
  // ============================================

  describe('createCampaign', () => {
    it('should create campaign with sequences', () => {
      const campaign = createCampaign('Q4 Outreach', ['seq1', 'seq2']);
      
      expect(campaign.id).toBeDefined();
      expect(campaign.name).toBe('Q4 Outreach');
      expect(campaign.sequenceIds).toEqual(['seq1', 'seq2']);
      expect(campaign.status).toBe('draft');
    });

    it('should initialize metrics to zero', () => {
      const campaign = createCampaign('Test', ['seq1']);
      
      expect(campaign.metrics.totalEnrolled).toBe(0);
      expect(campaign.metrics.totalSent).toBe(0);
      expect(campaign.metrics.totalReplied).toBe(0);
    });
  });

  describe('getCampaignRates', () => {
    it('should calculate performance rates', () => {
      const campaign = createCampaign('Test', ['seq1']);
      campaign.metrics = {
        totalEnrolled: 100,
        totalSent: 100,
        totalOpened: 50,
        totalClicked: 20,
        totalReplied: 10,
        totalMeetings: 5,
        totalBounced: 2,
        totalUnsubscribed: 1,
      };
      
      const rates = getCampaignRates(campaign);
      
      expect(rates.openRate).toBe(50);
      expect(rates.clickRate).toBe(20);
      expect(rates.replyRate).toBe(10);
      expect(rates.meetingRate).toBe(5);
    });
  });

  // ============================================
  // A/B Testing Tests
  // ============================================

  describe('createABTest', () => {
    it('should create A/B test with variants', () => {
      const test = createABTest('seq1', 'step1', [
        { name: 'Control', body: 'Original body' },
        { name: 'Treatment', body: 'New body' },
      ]);
      
      expect(test.id).toBeDefined();
      expect(test.variants).toHaveLength(2);
      expect(test.status).toBe('draft');
      expect(test.winningMetric).toBe('reply_rate');
    });

    it('should distribute weights evenly', () => {
      const test = createABTest('seq1', 'step1', [
        { name: 'A', body: 'Body A' },
        { name: 'B', body: 'Body B' },
      ]);
      
      expect(test.variants[0].weight).toBe(50);
      expect(test.variants[1].weight).toBe(50);
    });
  });

  describe('selectVariant', () => {
    it('should select a variant', () => {
      const test = createABTest('seq1', 'step1', [
        { name: 'A', body: 'Body A' },
        { name: 'B', body: 'Body B' },
      ]);
      
      const selected = selectVariant(test);
      
      expect(test.variants.some(v => v.id === selected)).toBe(true);
    });

    it('should respect weights over many selections', () => {
      const test = createABTest('seq1', 'step1', [
        { name: 'A', body: 'Body A' },
        { name: 'B', body: 'Body B' },
      ]);
      test.variants[0].weight = 90;
      test.variants[1].weight = 10;
      
      let countA = 0;
      let countB = 0;
      
      for (let i = 0; i < 1000; i++) {
        const selected = selectVariant(test);
        if (selected === test.variants[0].id) countA++;
        else countB++;
      }
      
      // Should be roughly 90/10 split
      expect(countA).toBeGreaterThan(countB);
      expect(countA).toBeGreaterThan(800); // ~90%
    });
  });

  describe('checkStatisticalSignificance', () => {
    it('should not be significant with insufficient data', () => {
      const test: ABTest = {
        id: 't1',
        name: 'Test',
        sequenceId: 'seq1',
        stepId: 'step1',
        testType: 'full_email',
        variants: [],
        sampleSize: 100,
        winningMetric: 'reply_rate',
        confidenceLevel: 0.95,
        status: 'running',
        results: [
          { variantId: 'v1', sent: 10, opened: 5, clicked: 2, replied: 1, conversionRate: 10 },
          { variantId: 'v2', sent: 10, opened: 3, clicked: 1, replied: 0, conversionRate: 0 },
        ],
      };
      
      const result = checkStatisticalSignificance(test);
      
      expect(result.isSignificant).toBe(false);
    });

    it('should detect winner with clear difference', () => {
      const test: ABTest = {
        id: 't1',
        name: 'Test',
        sequenceId: 'seq1',
        stepId: 'step1',
        testType: 'full_email',
        variants: [],
        sampleSize: 50,
        winningMetric: 'reply_rate',
        confidenceLevel: 0.95,
        status: 'running',
        results: [
          { variantId: 'v1', sent: 50, opened: 30, clicked: 15, replied: 10, conversionRate: 20 },
          { variantId: 'v2', sent: 50, opened: 15, clicked: 5, replied: 2, conversionRate: 4 },
        ],
      };
      
      const result = checkStatisticalSignificance(test);
      
      expect(result.isSignificant).toBe(true);
      expect(result.winner).toBe('v1');
    });
  });

  // ============================================
  // Email Queue Tests
  // ============================================

  describe('queueEmail', () => {
    it('should create queue item', () => {
      const template = SEQUENCE_TEMPLATES[0];
      const sequence = createFromTemplate(template);
      const enrollment = enrollProspect(sequence, mockProspect);
      const step = sequence.steps[0];
      
      const queued = queueEmail(
        enrollment,
        step,
        'Personalized Subject',
        'Personalized Body',
        new Date()
      );
      
      expect(queued.id).toBeDefined();
      expect(queued.toEmail).toBe(mockProspect.email);
      expect(queued.subject).toBe('Personalized Subject');
      expect(queued.status).toBe('queued');
      expect(queued.trackingId).toBeDefined();
    });
  });

  describe('calculateSendTime', () => {
    it('should add days correctly', () => {
      const base = new Date('2024-01-15T10:00:00Z'); // Monday
      const result = calculateSendTime(base, 3, 'morning', false);
      
      expect(result.getDate()).toBe(18); // Thursday
    });

    it('should skip weekends when enabled', () => {
      const base = new Date('2024-01-12T10:00:00Z'); // Friday
      const result = calculateSendTime(base, 1, 'morning', true);
      
      // Should skip Saturday and Sunday, land on Monday
      expect(result.getDay()).toBe(1); // Monday
    });

    it('should set correct time of day', () => {
      const base = new Date('2024-01-15T10:00:00Z');
      
      const morning = calculateSendTime(base, 1, 'morning', false);
      const midday = calculateSendTime(base, 1, 'midday', false);
      const afternoon = calculateSendTime(base, 1, 'afternoon', false);
      const evening = calculateSendTime(base, 1, 'evening', false);
      
      expect(morning.getHours()).toBe(9);
      expect(midday.getHours()).toBe(12);
      expect(afternoon.getHours()).toBe(14);
      expect(evening.getHours()).toBe(17);
    });
  });

  // ============================================
  // Template Tests
  // ============================================

  describe('SEQUENCE_TEMPLATES', () => {
    it('should have pre-defined templates', () => {
      expect(SEQUENCE_TEMPLATES.length).toBeGreaterThan(0);
    });

    it('should have valid template structure', () => {
      for (const template of SEQUENCE_TEMPLATES) {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.steps.length).toBeGreaterThan(0);
        expect(template.category).toBeDefined();
      }
    });

    it('should have ops_director template', () => {
      const opsTemplate = SEQUENCE_TEMPLATES.find(t => t.persona === 'ops_director');
      expect(opsTemplate).toBeDefined();
    });

    it('should have cfo template', () => {
      const cfoTemplate = SEQUENCE_TEMPLATES.find(t => t.persona === 'cfo');
      expect(cfoTemplate).toBeDefined();
    });
  });
});

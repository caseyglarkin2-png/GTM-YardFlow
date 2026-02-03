/**
 * useBulkEmailSend Hook
 * 
 * Sprint 27: F5/F6 - Bulk email send orchestration with status tracking
 * 
 * Features:
 * - Per-recipient status tracking (pending/generating/sent/failed)
 * - Batch generation with concurrency control
 * - Idempotency key generation (prevents duplicate sends)
 * - Integration with existing send pipeline
 */

import { useState, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import type { Prospect } from '../types';
import type { ToneId } from '../config/tones';
import { useAIGenerate } from './useAIGenerate';

/** Status for each recipient in bulk send */
export type RecipientStatus = 'pending' | 'generating' | 'generated' | 'sending' | 'sent' | 'failed';

export interface BulkRecipient {
  id: string;
  prospect: Prospect;
  status: RecipientStatus;
  /** Generated or custom content for this recipient */
  subject?: string;
  body?: string;
  /** Error message if failed */
  error?: string;
  /** Idempotency key to prevent duplicate sends */
  idempotencyKey: string;
}

export interface BulkSendProgress {
  total: number;
  generated: number;
  sent: number;
  failed: number;
}

export interface UseBulkEmailSendReturn {
  /** List of recipients with their status */
  recipients: BulkRecipient[];
  /** Initialize recipients from prospect list */
  initRecipients: (prospects: Prospect[], baseSubject: string, baseBody: string) => void;
  /** Generate AI content for a single recipient */
  generateForRecipient: (recipientId: string, tone: ToneId) => Promise<void>;
  /** Generate AI content for all pending recipients (with concurrency limit) */
  generateAll: (tone: ToneId, concurrency?: number) => Promise<void>;
  /** Send email for a single recipient */
  sendRecipient: (recipientId: string) => Promise<void>;
  /** Send all generated/ready recipients */
  sendAll: (onConfirm: (subject: string, body: string, templateId: string) => Promise<void>) => Promise<void>;
  /** Update content for a recipient */
  updateRecipientContent: (recipientId: string, subject: string, body: string) => void;
  /** Current progress */
  progress: BulkSendProgress;
  /** Is any operation in progress */
  isProcessing: boolean;
  /** Reset all state */
  reset: () => void;
}

/**
 * Generate idempotency key for a recipient + template combination
 * Format: prospect-{id}-{timestamp}-{random}
 */
function generateIdempotencyKey(prospectId: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `prospect-${prospectId}-${timestamp}-${random}`;
}

/**
 * Hook for managing bulk email sends with per-recipient tracking
 */
export function useBulkEmailSend(): UseBulkEmailSendReturn {
  const [recipients, setRecipients] = useState<BulkRecipient[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { generate } = useAIGenerate();
  
  // Track sent idempotency keys to prevent duplicates
  const sentKeysRef = useRef<Set<string>>(new Set());

  // Calculate progress from recipients
  const progress: BulkSendProgress = {
    total: recipients.length,
    generated: recipients.filter(r => 
      ['generated', 'sending', 'sent'].includes(r.status)
    ).length,
    sent: recipients.filter(r => r.status === 'sent').length,
    failed: recipients.filter(r => r.status === 'failed').length,
  };

  // Initialize recipients from prospect list
  const initRecipients = useCallback((
    prospects: Prospect[], 
    baseSubject: string, 
    baseBody: string
  ) => {
    const newRecipients: BulkRecipient[] = prospects
      .filter(p => p.email) // Only prospects with email
      .map(p => ({
        id: p.id,
        prospect: p,
        status: 'pending' as RecipientStatus,
        subject: baseSubject,
        body: baseBody,
        idempotencyKey: generateIdempotencyKey(p.id),
      }));
    
    setRecipients(newRecipients);
    sentKeysRef.current.clear();
  }, []);

  // Generate AI content for single recipient
  const generateForRecipient = useCallback(async (recipientId: string, tone: ToneId) => {
    setRecipients(prev => prev.map(r => 
      r.id === recipientId ? { ...r, status: 'generating' as RecipientStatus } : r
    ));

    const recipient = recipients.find(r => r.id === recipientId);
    if (!recipient) return;

    const result = await generate({
      tone,
      prospectName: recipient.prospect.name?.split(' ')[0] || 'there',
      companyName: recipient.prospect.company || 'your company',
      title: recipient.prospect.title,
    });

    setRecipients(prev => prev.map(r => {
      if (r.id !== recipientId) return r;
      
      if (result.success) {
        return {
          ...r,
          status: 'generated' as RecipientStatus,
          subject: result.subject || r.subject,
          body: result.content || r.body,
        };
      } else {
        return {
          ...r,
          status: 'failed' as RecipientStatus,
          error: result.error || 'Generation failed',
        };
      }
    }));
  }, [recipients, generate]);

  // Generate AI content for all pending with concurrency control
  const generateAll = useCallback(async (tone: ToneId, concurrency = 3) => {
    setIsProcessing(true);
    
    const pending = recipients.filter(r => r.status === 'pending');
    
    // Process in batches with delay for rate limiting
    for (let i = 0; i < pending.length; i += concurrency) {
      const batch = pending.slice(i, i + concurrency);
      
      // Process batch in parallel
      await Promise.all(
        batch.map(r => generateForRecipient(r.id, tone))
      );
      
      // Small delay between batches to avoid rate limiting
      if (i + concurrency < pending.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setIsProcessing(false);
  }, [recipients, generateForRecipient]);

  // Send single recipient
  const sendRecipient = useCallback(async (recipientId: string) => {
    const recipient = recipients.find(r => r.id === recipientId);
    if (!recipient || !recipient.subject || !recipient.body) return;

    // Check idempotency - don't send if already sent with this key
    if (sentKeysRef.current.has(recipient.idempotencyKey)) {
      console.warn(`Duplicate send prevented for ${recipientId}`);
      return;
    }

    setRecipients(prev => prev.map(r => 
      r.id === recipientId ? { ...r, status: 'sending' as RecipientStatus } : r
    ));

    try {
      // Get Firebase token
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      
      const token = await user.getIdToken();

      // Call existing send endpoint with idempotency key
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Idempotency-Key': recipient.idempotencyKey,
        },
        body: JSON.stringify({
          to: recipient.prospect.email,
          subject: recipient.subject,
          body: recipient.body,
          prospectId: recipient.prospect.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Send failed (${response.status})`);
      }

      // Mark as sent and track idempotency key
      sentKeysRef.current.add(recipient.idempotencyKey);
      
      setRecipients(prev => prev.map(r => 
        r.id === recipientId ? { ...r, status: 'sent' as RecipientStatus } : r
      ));

    } catch (err) {
      setRecipients(prev => prev.map(r => 
        r.id === recipientId 
          ? { ...r, status: 'failed' as RecipientStatus, error: err instanceof Error ? err.message : 'Send failed' } 
          : r
      ));
    }
  }, [recipients]);

  // Send all generated recipients
  const sendAll = useCallback(async (
    onConfirm: (subject: string, body: string, templateId: string) => Promise<void>
  ) => {
    setIsProcessing(true);
    
    const ready = recipients.filter(r => 
      ['pending', 'generated'].includes(r.status) && r.subject && r.body
    );
    
    // Send sequentially to respect rate limits
    for (const recipient of ready) {
      await sendRecipient(recipient.id);
      // Small delay between sends
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    setIsProcessing(false);
  }, [recipients, sendRecipient]);

  // Update content for a specific recipient
  const updateRecipientContent = useCallback((
    recipientId: string, 
    subject: string, 
    body: string
  ) => {
    setRecipients(prev => prev.map(r => 
      r.id === recipientId 
        ? { ...r, subject, body, status: r.status === 'pending' ? 'generated' as RecipientStatus : r.status } 
        : r
    ));
  }, []);

  // Reset all state
  const reset = useCallback(() => {
    setRecipients([]);
    setIsProcessing(false);
    sentKeysRef.current.clear();
  }, []);

  return {
    recipients,
    initRecipients,
    generateForRecipient,
    generateAll,
    sendRecipient,
    sendAll,
    updateRecipientContent,
    progress,
    isProcessing,
    reset,
  };
}

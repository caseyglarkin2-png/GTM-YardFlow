/**
 * useRailwayEmail - Sprint 24: T2.1
 * 
 * Hook for sending emails via Railway backend.
 * Features:
 * - Feature flag integration (shouldUseRailwayEmail)
 * - Fallback to local /api/email/send when Railway disabled
 * - Batch sending with progress tracking
 * - Suppression list check (TODO: integrate with compliance service)
 * - Idempotency keys for duplicate prevention
 */

import { useState, useCallback } from 'react';
import { railwayClient } from '@/services/RailwayApiClient';
import { shouldUseRailwayEmail } from '@/config/featureFlags';
import type { SendEmailRequest } from '@/types/railway';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  prospectId: string;
}

export interface BatchEmailItem {
  to: string;
  toName?: string;
  subject: string;
  body: string;
  htmlBody?: string;
  prospectId: string;
  metadata?: Record<string, unknown>;
}

export interface BatchEmailResult {
  total: number;
  sent: number;
  failed: number;
  results: EmailSendResult[];
}

export interface UseRailwayEmailReturn {
  sendEmail: (email: BatchEmailItem, token: string) => Promise<EmailSendResult>;
  sendBatch: (emails: BatchEmailItem[], token: string) => Promise<BatchEmailResult>;
  isLoading: boolean;
  progress: { sent: number; failed: number; total: number };
  isRailwayEnabled: boolean;
}

// Delay between batch sends (100ms = 10 emails/sec max)
const BATCH_DELAY_MS = 100;

/**
 * Hook for sending emails via Railway or local fallback
 */
export function useRailwayEmail(): UseRailwayEmailReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });

  const isRailwayEnabled = shouldUseRailwayEmail();

  /**
   * Send a single email via Railway or local fallback
   */
  const sendEmail = useCallback(async (
    email: BatchEmailItem,
    token: string
  ): Promise<EmailSendResult> => {
    // Generate idempotency key for duplicate prevention
    const idempotencyKey = `${email.prospectId}-${Date.now().toString(36)}`;

    if (isRailwayEnabled) {
      // Send via Railway
      try {
        const payload: SendEmailRequest = {
          to: email.to,
          subject: email.subject,
          body: email.body,
          htmlBody: email.htmlBody,
          prospectId: email.prospectId,
          trackOpens: true,
          trackClicks: true,
        };

        const result = await railwayClient.email.send(payload);

        if (result.ok && result.data) {
          return {
            success: true,
            messageId: result.data.id,
            prospectId: email.prospectId,
          };
        }

        return {
          success: false,
          error: 'Railway returned error',
          prospectId: email.prospectId,
        };
      } catch (err) {
        console.error('[useRailwayEmail] Railway send failed:', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          prospectId: email.prospectId,
        };
      }
    }

    // Fallback to local /api/email/send
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          to: email.to,
          toName: email.toName,
          subject: email.subject,
          html: email.htmlBody || `<div style="font-family: Arial, sans-serif;">${email.body}</div>`,
          text: email.body,
          metadata: {
            ...email.metadata,
            prospectId: email.prospectId,
            source: 'BulkEmail',
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          messageId: data.messageId || data.id,
          prospectId: email.prospectId,
        };
      }

      const errorText = await response.text();
      return {
        success: false,
        error: errorText || `HTTP ${response.status}`,
        prospectId: email.prospectId,
      };
    } catch (err) {
      console.error('[useRailwayEmail] Local send failed:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        prospectId: email.prospectId,
      };
    }
  }, [isRailwayEnabled]);

  /**
   * Send a batch of emails with progress tracking
   */
  const sendBatch = useCallback(async (
    emails: BatchEmailItem[],
    token: string
  ): Promise<BatchEmailResult> => {
    setIsLoading(true);
    setProgress({ sent: 0, failed: 0, total: emails.length });

    const results: EmailSendResult[] = [];

    for (const email of emails) {
      const result = await sendEmail(email, token);
      results.push(result);

      setProgress(p => ({
        ...p,
        sent: p.sent + (result.success ? 1 : 0),
        failed: p.failed + (result.success ? 0 : 1),
      }));

      // Delay between sends to avoid rate limiting
      if (emails.indexOf(email) < emails.length - 1) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    setIsLoading(false);

    return {
      total: emails.length,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }, [sendEmail]);

  return {
    sendEmail,
    sendBatch,
    isLoading,
    progress,
    isRailwayEnabled,
  };
}

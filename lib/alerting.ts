/**
 * Alerting Module for Cron Job Failures
 * 
 * Provides a unified alerting interface for monitoring cron job health.
 * Supports multiple notification channels with graceful fallback.
 * 
 * Usage:
 *   import { sendAlert, AlertSeverity } from '@/lib/alerting';
 *   await sendAlert('Cron job failed', AlertSeverity.ERROR, { cronName: 'execute-sequences' });
 */

import { logger } from './logger';

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface AlertContext {
  cronName?: string;
  error?: string;
  errorStack?: string;
  duration?: number;
  timestamp?: string;
  environment?: string;
  [key: string]: unknown;
}

export interface AlertResult {
  success: boolean;
  channels: string[];
  errors?: string[];
}

/**
 * Send an alert through configured notification channels.
 * 
 * Currently supports:
 * - Console logging (always on)
 * - Webhook (ALERT_WEBHOOK_URL env var)
 * - Email (via Railway when ALERT_EMAIL env var is set)
 * 
 * @param message - Human-readable alert message
 * @param severity - Alert severity level
 * @param context - Additional context about the alert
 * @returns Promise<AlertResult> with delivery status
 */
export async function sendAlert(
  message: string,
  severity: AlertSeverity,
  context: AlertContext = {}
): Promise<AlertResult> {
  const timestamp = new Date().toISOString();
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
  
  const enrichedContext: AlertContext = {
    ...context,
    timestamp,
    environment,
  };

  const results: AlertResult = {
    success: true,
    channels: [],
    errors: [],
  };

  // Always log to console/structured logger
  const alertMessage = `[ALERT:${severity.toUpperCase()}] ${message}`;
  if (severity === AlertSeverity.CRITICAL || severity === AlertSeverity.ERROR) {
    // error() expects (message, error?, context?) - pass undefined for error, context as third arg
    logger.error(alertMessage, undefined, enrichedContext as Record<string, unknown>);
  } else if (severity === AlertSeverity.WARNING) {
    logger.warn(alertMessage, enrichedContext as Record<string, unknown>);
  } else {
    logger.info(alertMessage, enrichedContext as Record<string, unknown>);
  }
  results.channels.push('console');

  // Send to webhook if configured
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const webhookPayload = {
        text: `[${severity.toUpperCase()}] ${message}`,
        severity,
        context: enrichedContext,
        source: 'gtm-yardflow',
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });

      if (response.ok) {
        results.channels.push('webhook');
      } else {
        results.errors?.push(`Webhook failed: ${response.status}`);
      }
    } catch (err) {
      results.errors?.push(`Webhook error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  // Send email alert if configured (critical/error only)
  const alertEmail = process.env.ALERT_EMAIL;
  const railwayUrl = process.env.RAILWAY_API_URL;
  const serviceSecret = process.env.SERVICE_TO_SERVICE_SECRET;
  
  if (alertEmail && railwayUrl && serviceSecret && 
      (severity === AlertSeverity.CRITICAL || severity === AlertSeverity.ERROR)) {
    try {
      const emailPayload = {
        to: alertEmail,
        subject: `[${environment.toUpperCase()}] ${severity.toUpperCase()}: ${message}`,
        html: formatAlertEmail(message, severity, enrichedContext),
      };

      const response = await fetch(`${railwayUrl}/api/email/internal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': serviceSecret,
        },
        body: JSON.stringify(emailPayload),
      });

      if (response.ok) {
        results.channels.push('email');
      } else {
        results.errors?.push(`Email alert failed: ${response.status}`);
      }
    } catch (err) {
      results.errors?.push(`Email error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  // Set overall success based on whether at least console succeeded
  results.success = results.channels.includes('console');

  return results;
}

/**
 * Format alert context as HTML email body
 */
function formatAlertEmail(
  message: string,
  severity: AlertSeverity,
  context: AlertContext
): string {
  const severityColors: Record<AlertSeverity, string> = {
    [AlertSeverity.INFO]: '#3b82f6',
    [AlertSeverity.WARNING]: '#f59e0b',
    [AlertSeverity.ERROR]: '#ef4444',
    [AlertSeverity.CRITICAL]: '#dc2626',
  };

  const color = severityColors[severity];
  
  const contextHtml = Object.entries(context)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `<tr><td style="padding: 4px 8px; font-weight: 500;">${key}</td><td style="padding: 4px 8px;">${String(value)}</td></tr>`)
    .join('');

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${color}; color: white; padding: 16px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 18px;">${severity.toUpperCase()} Alert</h1>
      </div>
      <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #1e293b; margin: 0 0 16px 0;">${message}</p>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 4px;">
          <tbody>
            ${contextHtml}
          </tbody>
        </table>
      </div>
      <p style="color: #64748b; font-size: 12px; margin-top: 12px;">
        Sent from GTM-YardFlow monitoring
      </p>
    </div>
  `;
}

/**
 * Convenience function for cron job failure alerts
 */
export async function alertCronFailure(
  cronName: string,
  error: Error | string,
  duration?: number
): Promise<AlertResult> {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  return sendAlert(
    `Cron job "${cronName}" failed: ${errorMessage}`,
    AlertSeverity.ERROR,
    {
      cronName,
      error: errorMessage,
      errorStack,
      duration,
    }
  );
}

/**
 * Convenience function for cron job success with metrics
 */
export async function alertCronSuccess(
  cronName: string,
  metrics: Record<string, unknown>,
  duration: number
): Promise<AlertResult> {
  // Only alert on success if explicitly enabled (to reduce noise)
  if (!process.env.ALERT_ON_SUCCESS) {
    return { success: true, channels: [] };
  }

  return sendAlert(
    `Cron job "${cronName}" completed successfully`,
    AlertSeverity.INFO,
    {
      cronName,
      duration,
      ...metrics,
    }
  );
}

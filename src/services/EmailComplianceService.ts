import { createHmac, timingSafeEqual } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { EmailMessage, SuppressionEntry, SendGridWebhookEvent } from '../types/email';
import { SendGridClient } from './SendGridClient';

const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
const SUPPRESSION_COLLECTION = 'email_suppressions';

function now(): number {
  return Date.now();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
}

export class EmailComplianceService {
  constructor(private readonly db: Firestore, private readonly sendGrid?: SendGridClient) {}

  async validateEmail(email: string): Promise<EmailValidationResult> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, reason: 'invalid_format' };
    }
    if (await this.isOnSuppressionList(email)) {
      return { valid: false, reason: 'suppressed' };
    }
    return { valid: true };
  }

  injectComplianceElements(message: EmailMessage): EmailMessage {
    const token = this.generateUnsubscribeToken(message.id);
    const baseUrl = process.env.PUBLIC_BASE_URL || process.env.VERCEL_URL || '';
    const unsubscribeUrl = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
    const headers = { ...(message.headers || {}) };
    headers['List-Unsubscribe'] = `<mailto:${process.env.SUPPORT_EMAIL || 'unsubscribe@yardflow.invalid'}>, <${unsubscribeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';

    const footerAddress = process.env.COMPLIANCE_POSTAL_ADDRESS || 'YardFlow GTM Hub';
    const footerHtml = `<div style="margin-top:16px;font-size:12px;color:#6b7280;line-height:18px;">You are receiving this email because you interacted with YardFlow GTM Hub.\n<a href="${unsubscribeUrl}">Unsubscribe</a> | ${footerAddress}</div>`;

    return {
      ...message,
      headers,
      html: `${message.html}${footerHtml}`,
    };
  }

  generateUnsubscribeToken(emailId: string): string {
    const secret = process.env.UNSUBSCRIBE_HMAC_SECRET;
    if (!secret) {
      throw new Error('UNSUBSCRIBE_HMAC_SECRET environment variable is required');
    }
    const expiresAt = now() + TOKEN_EXPIRY_MS;
    const payload = `${emailId}:${expiresAt}`;
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    return Buffer.from(`${payload}:${signature}`).toString('base64url');
  }

  validateUnsubscribeToken(token: string): { valid: boolean; emailId?: string; reason?: string } {
    const secret = process.env.UNSUBSCRIBE_HMAC_SECRET;
    if (!secret) {
      return { valid: false, reason: 'missing_secret' };
    }
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const [emailId, expiresAtRaw, signature] = decoded.split(':');
      if (!emailId || !expiresAtRaw || !signature) {
        return { valid: false, reason: 'invalid_token' };
      }
      const expected = createHmac('sha256', secret).update(`${emailId}:${expiresAtRaw}`).digest('hex');
      // Use timing-safe comparison to prevent timing attacks
      if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
        return { valid: false, reason: 'signature_mismatch' };
      }
      const expiresAt = Number(expiresAtRaw);
      if (Number.isNaN(expiresAt) || expiresAt < now()) {
        return { valid: false, reason: 'expired' };
      }
      return { valid: true, emailId };
    } catch {
      return { valid: false, reason: 'invalid_token' };
    }
  }

  async isOnSuppressionList(email: string): Promise<boolean> {
    const docId = normalizeEmail(email);
    const snap = await this.db.collection(SUPPRESSION_COLLECTION).doc(docId).get();
    return snap.exists;
  }

  async addToSuppressionList(entry: SuppressionEntry): Promise<void> {
    const docId = normalizeEmail(entry.email);
    await this.db.collection(SUPPRESSION_COLLECTION).doc(docId).set({
      ...entry,
      email: docId,
      updatedAt: now(),
    }, { merge: true });

    if (this.sendGrid) {
      try {
        await this.sendGrid.addToSuppression(docId, entry.reason);
      } catch (err) {
        console.warn('Failed to sync suppression to SendGrid', err);
      }
    }
  }

  respectDoNotTrack(message: EmailMessage): boolean {
    return Boolean(message.metadata?.doNotTrack);
  }

  classifyBounce(event: SendGridWebhookEvent): 'hard' | 'soft' | 'unknown' {
    if (event.event === 'bounce' && event.reason?.toLowerCase().includes('invalid')) {
      return 'hard';
    }
    const reason = (event.reason || '').toLowerCase();
    if (reason.includes('user unknown') || reason.includes('mailbox') || reason.includes('no such')) {
      return 'hard';
    }
    if (reason.includes('full') || reason.includes('quota') || reason.includes('rate limit')) {
      return 'soft';
    }
    if (event.event === 'bounce' && event.status?.startsWith('5')) {
      return 'hard';
    }
    return 'soft';
  }
}

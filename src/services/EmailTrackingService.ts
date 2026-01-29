import { createHash, createHmac, timingSafeEqual } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { EmailMessage } from '../types/email';

const EVENT_COLLECTION = 'email_events';
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const TOKEN_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000; // 90 days token expiry

function currentMs(): number {
  return Date.now();
}

export class EmailTrackingService {
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor(private readonly db: Firestore, baseUrl?: string, secret?: string) {
    const root = baseUrl || process.env.TRACKING_BASE_URL || process.env.PUBLIC_BASE_URL || process.env.VERCEL_URL || '';
    this.baseUrl = root.startsWith('http') ? root : `https://${root}`;
    const trackingSecret = secret || process.env.TRACKING_SECRET;
    if (!trackingSecret) {
      throw new Error('TRACKING_SECRET environment variable is required');
    }
    this.secret = trackingSecret;
  }

  injectTracking(message: EmailMessage): EmailMessage {
    const openToken = this.generateToken({ emailId: message.id, type: 'open' });
    const openPixelUrl = `${this.baseUrl}/api/track/open?token=${encodeURIComponent(openToken)}`;
    const trackedHtml = this.rewriteLinks(message.html, message.id);
    const pixel = `<img src="${openPixelUrl}" alt="" width="1" height="1" style="display:none;" />`;
    return { ...message, html: `${trackedHtml}${pixel}` };
  }

  rewriteLinks(html: string, emailId: string): string {
    return html.replace(/href="(https?:[^"\s]+)"/g, (_match, url) => {
      if (url.startsWith('mailto:')) return `href="${url}"`;
      const token = this.generateToken({ emailId, type: 'click', url });
      const tracked = `${this.baseUrl}/api/track/click?token=${encodeURIComponent(token)}`;
      return `href="${tracked}"`;
    });
  }

  async recordOpen(token: string, ip?: string, userAgent?: string): Promise<void> {
    const payload = this.validateToken(token, 'open');
    if (!payload.valid || !payload.emailId) return;
    const eventId = `open:${payload.emailId}`;
    await this.storeEvent(eventId, {
      emailId: payload.emailId,
      type: 'open',
      at: currentMs(),
      ip: this.anonymize(ip),
      userAgent,
    });
  }

  async recordClick(token: string, ip?: string, userAgent?: string): Promise<{ url?: string }> {
    const payload = this.validateToken(token, 'click');
    if (!payload.valid || !payload.emailId) return {};
    const hashUrl = createHash('sha256').update(payload.url || '').digest('hex');
    const eventId = `click:${payload.emailId}:${hashUrl}`;
    await this.storeEvent(eventId, {
      emailId: payload.emailId,
      type: 'click',
      at: currentMs(),
      url: payload.url,
      ip: this.anonymize(ip),
      userAgent,
    });
    return { url: payload.url };
  }

  private async storeEvent(id: string, data: Record<string, unknown>): Promise<void> {
    const expiresAt = currentMs() + RETENTION_MS;
    await this.db.collection(EVENT_COLLECTION).doc(id).set({ ...data, expiresAt }, { merge: true });
  }

  private anonymize(ip?: string): string | undefined {
    if (!ip) return undefined;
    return createHash('sha256').update(`${ip}:${this.secret}`).digest('hex');
  }

  private generateToken(payload: { emailId: string; type: 'open' | 'click'; url?: string }): string {
    const issuedAt = currentMs();
    const body = `${payload.emailId}|${payload.type}|${payload.url || ''}|${issuedAt}`;
    const signature = createHmac('sha256', this.secret).update(body).digest('hex');
    return Buffer.from(`${body}|${signature}`).toString('base64url');
  }

  private validateToken(token: string, expectedType: 'open' | 'click'):
    { valid: boolean; emailId?: string; url?: string } {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const [emailId, type, url, issuedAt, signature] = decoded.split('|');
      if (!emailId || !type || !issuedAt || !signature) return { valid: false };
      if (type !== expectedType) return { valid: false };
      
      // Check token expiry (90 days)
      const issuedAtMs = Number(issuedAt);
      if (Number.isNaN(issuedAtMs) || currentMs() - issuedAtMs > TOKEN_EXPIRY_MS) {
        return { valid: false };
      }
      
      const check = createHmac('sha256', this.secret).update(`${emailId}|${type}|${url || ''}|${issuedAt}`).digest('hex');
      // Use timing-safe comparison to prevent timing attacks
      if (!timingSafeEqual(Buffer.from(check), Buffer.from(signature))) return { valid: false };
      return { valid: true, emailId, url };
    } catch {
      return { valid: false };
    }
  }
}

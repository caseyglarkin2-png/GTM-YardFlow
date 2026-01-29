import sgMail, { type MailDataRequired, type ClientResponse } from '@sendgrid/mail';
import sgClient from '@sendgrid/client';
import type { EmailMessage } from '../types/email';

const RETRIABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const RATE_LIMIT_PER_SECOND = 10;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class SendGridClient {
  private readonly apiKey?: string;

  constructor(apiKey: string | undefined = process.env.SENDGRID_API_KEY) {
    this.apiKey = apiKey;
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      sgClient.setApiKey(apiKey);
    }
  }

  private ensureApiKey(): void {
    if (!this.apiKey) {
      throw new Error('SendGrid API key not configured');
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      this.ensureApiKey();
      const [res] = await sgClient.request({ method: 'GET', url: '/v3/user/credits' });
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (err) {
      console.warn('SendGrid API key validation failed', err);
      return false;
    }
  }

  private buildPayload(message: EmailMessage): MailDataRequired {
    const from = message.from || process.env.SENDGRID_FROM_EMAIL;
    if (!from) {
      throw new Error('Missing sender email');
    }

    return {
      to: message.to,
      from,
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: message.headers,
      substitutions: message.substitutions,
      categories: message.categories,
      customArgs: {
        emailId: message.id,
        tenantId: message.metadata?.tenantId,
        userId: message.metadata?.userId,
        ...message.customArgs,
      },
    } satisfies MailDataRequired;
  }

  private async sendWithRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
    try {
      return await fn();
    } catch (err: unknown) {
      const status = (err as { code?: number }).code ?? (err as { statusCode?: number }).statusCode;
      const shouldRetry = RETRIABLE_STATUS.has(status ?? 0) && attempt < MAX_RETRIES;
      if (!shouldRetry) {
        throw err;
      }
      const backoff = Math.min(2000 * (attempt + 1), 8000);
      await sleep(backoff);
      return this.sendWithRetry(fn, attempt + 1);
    }
  }

  async sendEmail(message: EmailMessage): Promise<ClientResponse> {
    this.ensureApiKey();
    const payload = this.buildPayload(message);
    const [response] = await this.sendWithRetry(() => sgMail.send(payload, false));
    return response;
  }

  async sendBatch(messages: EmailMessage[]): Promise<ClientResponse[]> {
    this.ensureApiKey();
    const responses: ClientResponse[] = [];
    for (let i = 0; i < messages.length; i += RATE_LIMIT_PER_SECOND) {
      const chunk = messages.slice(i, i + RATE_LIMIT_PER_SECOND);
      const chunkResponses = await Promise.all(chunk.map(msg => this.sendEmail(msg)));
      responses.push(...chunkResponses);
      if (i + RATE_LIMIT_PER_SECOND < messages.length) {
        await sleep(1000);
      }
    }
    return responses;
  }

  async addToSuppression(email: string, source?: string): Promise<void> {
    this.ensureApiKey();
    await this.sendWithRetry(() => sgClient.request({
      method: 'POST',
      url: '/v3/asm/suppressions/global',
      body: { recipient_emails: [email], source },
    }));
  }

  async removeFromSuppression(email: string): Promise<void> {
    this.ensureApiKey();
    await sgClient.request({
      method: 'DELETE',
      url: `/v3/asm/suppressions/global/${encodeURIComponent(email)}`,
    });
  }

  async listSuppressions(limit = 1000): Promise<string[]> {
    this.ensureApiKey();
    const [res] = await sgClient.request({
      method: 'GET',
      url: `/v3/asm/suppressions/global?limit=${limit}`,
    });
    const body = res.body as { recipient_emails?: string[] };
    return body.recipient_emails || [];
  }
}

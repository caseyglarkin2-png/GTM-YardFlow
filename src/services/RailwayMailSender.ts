import { railwayServerClient } from '../../lib/railway-client';
import type { IEmailSender } from './IEmailSender';
import type { EmailMessage } from '../types/email';
import type { RailwayEmailRequest } from './RailwayEmailService';

export class RailwayMailSender implements IEmailSender {
  async sendEmail(message: EmailMessage): Promise<{ statusCode: number; headers: any; body: any }> {
    const payload: RailwayEmailRequest = {
      to: message.to,
      subject: message.subject,
      htmlBody: message.html,
      textBody: message.text,
      // Metadata mapping
      prospectId: message.metadata?.prospectId, 
      campaignId: message.metadata?.campaignId,
    };
    
    // Call Railway API
    // Using /api/outreach/send-email as per Audit
    const response = await railwayServerClient.post<any>('/api/outreach/send-email', payload);
    
    if (!response.ok) {
        throw new Error(`Railway send failed: ${response.error || 'Unknown error'}`);
    }

    // Map response to match SendGrid-like output expected by queue
    // SendGrid returns [response, body]. Queue service expects { statusCode, ... }
    return {
        statusCode: 200, // Railway API result.ok implies 2xx
        headers: {},
        body: response.data
    };
  }
}

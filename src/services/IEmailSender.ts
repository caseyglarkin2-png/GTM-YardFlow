import type { EmailMessage } from '../types/email';

export interface IEmailSender {
  sendEmail(message: EmailMessage): Promise<{ statusCode: number; headers: any; body: any }>;
}

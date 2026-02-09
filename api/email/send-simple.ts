import type { VercelRequest, VercelResponse } from '@vercel/node';
import sgMail from '@sendgrid/mail';

/**
 * Simple email send endpoint - no external dependencies
 * 
 * POST /api/email/send-simple
 * Headers: 
 *   - Authorization: Bearer <Firebase ID token> 
 *   - x-service-key: <SERVICE_TO_SERVICE_SECRET> (alternative auth)
 * Body: { "to": "email@example.com", "subject": "Subject", "html": "<p>Body</p>", "text": "Body" }
 */

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Simple auth check - either Firebase token or service key
  const authHeader = req.headers.authorization;
  const serviceKey = req.headers['x-service-key'] as string;
  const expectedServiceKey = process.env.SERVICE_TO_SERVICE_SECRET || process.env.CRON_SECRET;

  const hasToken = authHeader?.startsWith('Bearer ');
  const hasServiceKey = serviceKey && expectedServiceKey && serviceKey === expectedServiceKey;

  if (!hasToken && !hasServiceKey) {
    res.status(401).json({ error: 'Missing authentication' });
    return;
  }

  // Parse body
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { to, subject, html, text } = body;

  if (!to || !subject || (!html && !text)) {
    res.status(400).json({ error: 'Missing required fields: to, subject, and (html or text)' });
    return;
  }

  // Validate env
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim();

  if (!apiKey) {
    res.status(500).json({ error: 'SENDGRID_API_KEY not configured' });
    return;
  }
  if (!fromEmail) {
    res.status(500).json({ error: 'SENDGRID_FROM_EMAIL not configured' });
    return;
  }

  sgMail.setApiKey(apiKey);

  try {
    const [response] = await sgMail.send({
      to: to.trim(),
      from: fromEmail,
      subject,
      html: html || `<p>${text}</p>`,
      text: text || html?.replace(/<[^>]*>/g, '') || '',
    });

    res.status(200).json({
      success: true,
      messageId: response.headers?.['x-message-id'],
      statusCode: response.statusCode,
    });
  } catch (err: unknown) {
    const error = err as { response?: { body?: unknown; statusCode?: number }; message?: string };
    console.error('[send-simple] Error:', error);
    
    res.status(500).json({
      error: 'Failed to send email',
      detail: error.message || 'Unknown error',
      sendgridError: error.response?.body || null,
    });
  }
}

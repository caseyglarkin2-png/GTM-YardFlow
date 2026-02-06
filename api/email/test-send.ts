import type { VercelRequest, VercelResponse } from '@vercel/node';
import sgMail from '@sendgrid/mail';

/**
 * Test endpoint to verify SendGrid configuration and send a test email.
 * 
 * Usage:
 *   POST /api/email/test-send
 *   Headers: x-service-key: <SERVICE_TO_SERVICE_SECRET>
 *   Body: { "to": "casey@freightroll.com", "subject": "Test", "body": "Hello!" }
 * 
 * Or use query param for GET request:
 *   GET /api/email/test-send?to=casey@freightroll.com&key=<SECRET>
 */

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Allow both GET (for simple browser testing) and POST
  const isGet = req.method === 'GET';
  const isPost = req.method === 'POST';
  
  if (!isGet && !isPost) {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Auth via service key (header or query param)
  const serviceKey = (req.headers['x-service-key'] as string) || (req.query.key as string);
  const expectedKey = process.env.SERVICE_TO_SERVICE_SECRET || process.env.CRON_SECRET;
  
  if (!expectedKey) {
    res.status(500).json({ 
      error: 'Server misconfigured', 
      detail: 'SERVICE_TO_SERVICE_SECRET not set',
    });
    return;
  }
  
  if (serviceKey !== expectedKey) {
    res.status(401).json({ 
      error: 'Unauthorized',
      detail: 'Invalid or missing x-service-key header',
    });
    return;
  }

  // Diagnostic info
  const diagnostics = {
    hasSendGridKey: !!process.env.SENDGRID_API_KEY,
    sendGridKeyLength: process.env.SENDGRID_API_KEY?.length || 0,
    sendGridKeyPrefix: process.env.SENDGRID_API_KEY?.substring(0, 6) || null,
    fromEmail: process.env.SENDGRID_FROM_EMAIL || null,
    hasFromEmail: !!process.env.SENDGRID_FROM_EMAIL,
    vercelEnv: process.env.VERCEL_ENV || 'unknown',
    nodeEnv: process.env.NODE_ENV || 'unknown',
  };

  // Get recipient from body or query
  const to = isGet 
    ? (req.query.to as string)
    : typeof req.body === 'string' ? JSON.parse(req.body).to : req.body?.to;
  
  const subject = isGet
    ? (req.query.subject as string) || 'FreightRoll Test Email'
    : typeof req.body === 'string' ? JSON.parse(req.body).subject : req.body?.subject || 'FreightRoll Test Email';
  
  const body = isGet
    ? (req.query.body as string) || 'This is a test email from FreightRoll to verify SendGrid integration.'
    : typeof req.body === 'string' ? JSON.parse(req.body).body : req.body?.body || 'This is a test email from FreightRoll.';

  // Validate required config
  if (!process.env.SENDGRID_API_KEY) {
    res.status(500).json({
      error: 'SendGrid API key not configured',
      diagnostics,
    });
    return;
  }

  if (!process.env.SENDGRID_FROM_EMAIL) {
    res.status(500).json({
      error: 'SENDGRID_FROM_EMAIL not configured',
      diagnostics,
    });
    return;
  }

  if (!to) {
    res.status(400).json({
      error: 'Missing recipient email',
      usage: 'POST with body { "to": "email@example.com" } or GET with ?to=email@example.com',
      diagnostics,
    });
    return;
  }

  // Test SendGrid connectivity first
  sgMail.setApiKey(process.env.SENDGRID_API_KEY.trim());

  const msg = {
    to: to.trim(),
    from: process.env.SENDGRID_FROM_EMAIL.trim(),
    subject,
    text: body,
    html: `<p>${body}</p><hr><p style="font-size:10px;color:#666;">Sent via FreightRoll test endpoint at ${new Date().toISOString()}</p>`,
  };

  console.log('[test-send] Attempting to send:', { to: msg.to, from: msg.from, subject: msg.subject });

  try {
    const [response] = await sgMail.send(msg);
    
    console.log('[test-send] SendGrid response:', {
      statusCode: response.statusCode,
      headers: response.headers,
    });

    res.status(200).json({
      success: true,
      message: `Test email sent to ${to}`,
      sendgridResponse: {
        statusCode: response.statusCode,
        messageId: response.headers?.['x-message-id'],
      },
      diagnostics,
    });
  } catch (err: unknown) {
    console.error('[test-send] SendGrid error:', err);

    // Extract SendGrid-specific error details
    const sgError = err as { response?: { body?: { errors?: Array<{ message: string; field?: string }> }; statusCode?: number } };
    const errorBody = sgError.response?.body;
    const errorCode = sgError.response?.statusCode;

    res.status(500).json({
      error: 'Failed to send email',
      detail: (err as Error).message,
      sendgridError: errorBody?.errors || null,
      sendgridStatusCode: errorCode || null,
      diagnostics,
    });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../lib/firebaseAdmin';
import { validateRequestOrigin, isListUnsubscribeOneClick } from '../../lib/validateOrigin';
import { EmailComplianceService } from '../../src/services/EmailComplianceService';
import { EmailQueueService } from '../../src/services/EmailQueueService';
import { EmailWarmupService } from '../../src/services/EmailWarmupService';
import { EmailTrackingService } from '../../src/services/EmailTrackingService';
import { SendGridClient } from '../../src/services/SendGridClient';

// Lazy-loaded services to prevent crashes on missing env vars
let _services: {
  db: ReturnType<typeof getAdminDb>;
  compliance: EmailComplianceService;
  queue: EmailQueueService;
} | null = null;

function getServices() {
  if (!_services) {
    const db = getAdminDb();
    const sendGrid = new SendGridClient();
    const compliance = new EmailComplianceService(db, sendGrid);
    const warmup = new EmailWarmupService(db);
    const tracking = new EmailTrackingService(db);
    const queue = new EmailQueueService(db, sendGrid, compliance, warmup, tracking, 'api-unsubscribe');
    _services = { db, compliance, queue };
  }
  return _services;
}

// CSRF validation for unsubscribe
// Uses shared validateRequestOrigin with List-Unsubscribe One-Click support
function validateOriginOrListUnsubscribe(req: VercelRequest): boolean {
  return validateRequestOrigin(req, {
    allowGetWithoutOrigin: true, // GET requests for landing page allowed (token validates user)
    customValidator: isListUnsubscribeOneClick, // List-Unsubscribe One-Click POST without origin
  });
}

async function resolveEmailAddress(db: ReturnType<typeof getAdminDb>, emailId: string): Promise<string | null> {
  const snap = await db.collection('email_queue').doc(emailId).get();
  const data = snap.data() as { message?: { to?: string } } | undefined;
  return data?.message?.to || null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // CSRF Protection
  if (!validateOriginOrListUnsubscribe(req)) {
    res.status(403).json({ error: 'Invalid origin' });
    return;
  }

  // Initialize services lazily
  let services: ReturnType<typeof getServices>;
  try {
    services = getServices();
  } catch (err) {
    res.status(503).json({ error: 'Service unavailable', detail: (err as Error).message });
    return;
  }
  
  const { db, compliance, queue } = services;

  const token = (req.query.token as string | undefined) || (req.body?.token as string | undefined);
  if (!token) {
    res.status(400).json({ error: 'Missing token' });
    return;
  }

  const validation = compliance.validateUnsubscribeToken(token);
  if (!validation.valid || !validation.emailId) {
    res.status(400).json({ error: 'Invalid or expired token', reason: validation.reason });
    return;
  }

  if (req.method === 'GET') {
    // Return a proper landing page that loads the React component
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe - YardFlow</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
    .loader { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body class="min-h-screen bg-gradient-to-b from-gray-50 to-white">
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="max-w-md w-full">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-800">Email Preferences</h1>
      </div>
      
      <div class="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden p-8">
        <h2 class="text-xl font-semibold text-gray-800 text-center mb-4">
          Unsubscribe from emails?
        </h2>
        <p class="text-gray-600 text-center mb-6">
          You will no longer receive marketing and sales emails from us.
          Important transactional emails may still be sent.
        </p>
        
        <form action="/api/email/unsubscribe" method="POST" class="space-y-3">
          <input type="hidden" name="token" value="${validation.emailId ? token : ''}">
          <input type="hidden" name="List-Unsubscribe" value="One-Click">
          <button type="submit" class="w-full py-3 px-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Unsubscribe Me
          </button>
        </form>
      </div>
      
      <div class="text-center mt-6 text-sm text-gray-500">
        <p>© ${new Date().getFullYear()} YardFlow. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`);
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isListUnsubscribeOneClick(req)) {
    res.status(400).json({ error: 'Missing List-Unsubscribe confirmation' });
    return;
  }

  const email = await resolveEmailAddress(db, validation.emailId);
  if (!email) {
    res.status(404).json({ error: 'Email not found' });
    return;
  }

  await compliance.addToSuppressionList({
    email,
    reason: 'unsubscribe',
    createdAt: Date.now(),
    source: 'one-click',
  });

  await queue.cancelPendingByEmailId(validation.emailId);

  // Check if this is an API call (Accept: application/json) or browser form submission
  const acceptHeader = req.headers.accept || '';
  if (acceptHeader.includes('application/json')) {
    res.status(200).json({ success: true });
    return;
  }

  // Return success HTML page for browser form submissions
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribed - YardFlow</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>
<body class="min-h-screen bg-gradient-to-b from-gray-50 to-white">
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="max-w-md w-full">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-800">You've been unsubscribed</h1>
      </div>
      
      <div class="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden p-8 text-center">
        <p class="text-gray-600 mb-6">
          You will no longer receive marketing and sales emails from us.
          It may take up to 24 hours to fully process.
        </p>
        
        <div class="p-4 bg-gray-50 rounded-lg text-left">
          <p class="text-sm text-gray-600">
            <strong>Changed your mind?</strong> Contact us and we can re-subscribe you.
          </p>
        </div>
      </div>
      
      <div class="text-center mt-6 text-sm text-gray-500">
        <p>© ${new Date().getFullYear()} YardFlow. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`);
}

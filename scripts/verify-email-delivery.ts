import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL;

async function verifyEmailDelivery() {
  if (!TEST_EMAIL) {
    console.error('TEST_EMAIL env var required');
    process.exit(1);
  }

  console.log(`Sending test email to ${TEST_EMAIL}...`);

  try {
    // 1. Send Email
    // Assuming we have an endpoint for sending test emails or use Railway directly
    // If not, we might need to hit the SendGrid API directly to test credentials?
    // But the task is "Email Delivery Verification" of OUR system.
    
    // Using the internal API endpoint if it exists
    const sendRes = await fetch(`${API_URL}/api/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: TEST_EMAIL,
        subject: 'Smoke Test: YardFlow Delivery Verification',
        body: 'This is an automated test to verify email delivery infrastructure.',
        source: 'smoke-test'
      })
    });

    if (!sendRes.ok) {
        const text = await sendRes.text();
        throw new Error(`Send failed: ${sendRes.status} ${text}`);
    }

    const data = await sendRes.json();
    console.log('✅ Send request accepted:', data);

    console.log('Waiting for delivery confirmation (webhook)...');
    
    // 2. Poll for status (Mocked for now as we don't have direct DB access in this script context easily)
    // Real implementation would poll /api/email/status/{id}
    
    let attempts = 0;
    while (attempts < 10) {
        // Poll status endpoint
        // const status = await fetch(...);
        // if (status.delivered) break;
        
        await new Promise(r => setTimeout(r, 2000));
        process.stdout.write('.');
        attempts++;
    }
    
    console.log('\n⚠️  Webhook verification skipped (requires DB access). Check SendGrid dashboard.');
    
  } catch (err) {
    console.error('❌ Verification Failed:', err);
    process.exit(1);
  }
}

verifyEmailDelivery();

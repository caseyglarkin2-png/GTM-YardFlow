
import { config } from 'dotenv';
config();

import fetch from 'node-fetch';

async function triggerCron() {
  const cronSecret = process.env.CRON_SECRET;
  
  // Use local dev server by default or production URL if provided
  const baseUrl = process.env.RAILWAY_STATIC_URL 
    ? `https://${process.env.RAILWAY_STATIC_URL}` 
    : 'http://localhost:5173'; // Vite dev server port

  // During dev, Vercel functions might be at a different port or mocked
  // For local testing of the logic, we might need to invoke the handler logic directly
  // But let's verify if we can hit the endpoint.
  
  // Actually, if we are in local dev, 'api/cron/execute-sequences.ts' isn't running as a server (it's a serverless function).
  // Vite doesn't serve /api routes like Vercel does unless configured.
  // So we should probably run the handler function code directly for diagnosis.
  
  console.log(' Diagnosing Sequence Execution Logic...');
  console.log('----------------------------------------');
  
  try {
     // Dynamic import to bypass server requirement
     // We need to mock the Request/Response objects for Vercel
     const handlerModule = await import('../api/cron/execute-sequences');
     const handler = handlerModule.default;

     const req = {
       method: 'POST',
       headers: {
         authorization: `Bearer ${cronSecret || 'test-secret'}`,
         'x-vercel-cron': '1' // Simulate authorized cron
       },
       body: {}
     } as any;

     const res = {
       status: (code: number) => ({
         json: (body: any) => {
           console.log(`\n[${code}] Response:`, JSON.stringify(body, null, 2));
           return body;
         }
       }),
       json: (body: any) => {
          console.log(`\n[200] Response:`, JSON.stringify(body, null, 2));
       }
     } as any;
     
     console.log('Running handler...');
     await handler(req, res);
     console.log('Handler completed.');
     
  } catch (error) {
    console.error('Fatal Error running sequence handler:', error);
  }
}

triggerCron();

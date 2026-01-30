import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Admin Seed Endpoint
 * 
 * One-time setup endpoint to seed the Railway database with initial users.
 * This proxies the seed request to Railway using the AUTH_SECRET.
 * 
 * Usage:
 *   GET  /api/admin/seed - Returns HTML form to enter AUTH_SECRET
 *   POST /api/admin/seed - Calls Railway seed endpoint with provided secret
 */

const RAILWAY_API_URL = process.env.RAILWAY_API_URL;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!RAILWAY_API_URL) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Railway backend not configured',
    });
  }

  // GET: Return simple HTML form
  if (req.method === 'GET') {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YardFlow Admin - Seed Database</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 { color: #1a1a2e; margin-bottom: 8px; font-size: 24px; }
    .subtitle { color: #666; margin-bottom: 24px; font-size: 14px; }
    .status { 
      background: #e8f5e9; 
      border: 1px solid #4caf50; 
      border-radius: 8px; 
      padding: 12px; 
      margin-bottom: 24px;
      font-size: 13px;
    }
    .status.error { background: #ffebee; border-color: #f44336; }
    label { display: block; font-weight: 600; margin-bottom: 8px; color: #333; }
    input[type="text"] {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      font-family: monospace;
      margin-bottom: 8px;
    }
    input[type="text"]:focus { border-color: #2196f3; outline: none; }
    .hint { color: #888; font-size: 12px; margin-bottom: 20px; }
    button {
      width: 100%;
      padding: 14px;
      background: #2196f3;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #1976d2; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    .result { 
      margin-top: 20px; 
      padding: 16px; 
      border-radius: 8px; 
      font-size: 13px;
      white-space: pre-wrap;
      font-family: monospace;
    }
    .result.success { background: #e8f5e9; border: 1px solid #4caf50; }
    .result.error { background: #ffebee; border: 1px solid #f44336; }
    .credentials {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 16px;
      margin-top: 20px;
    }
    .credentials h3 { font-size: 14px; margin-bottom: 12px; color: #333; }
    .credentials table { width: 100%; font-size: 13px; }
    .credentials td { padding: 4px 0; }
    .credentials td:first-child { color: #666; }
    .credentials td:last-child { font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚂 YardFlow Database Seed</h1>
    <p class="subtitle">One-time setup to create admin users in Railway</p>
    
    <div class="status" id="status">
      Railway: <strong>${RAILWAY_API_URL}</strong>
    </div>

    <form id="seedForm">
      <label for="secret">AUTH_SECRET (first 16 characters)</label>
      <input 
        type="text" 
        id="secret" 
        name="secret" 
        placeholder="Enter first 16 chars of AUTH_SECRET"
        maxlength="20"
        required
      />
      <p class="hint">
        Find this in Railway Dashboard → YardFlow-Hitlist → Variables → AUTH_SECRET
      </p>
      <button type="submit" id="submitBtn">Seed Database</button>
    </form>

    <div id="result"></div>

    <div class="credentials">
      <h3>After seeding, login with:</h3>
      <table>
        <tr><td>Email:</td><td>casey@freightroll.com</td></tr>
        <tr><td>Password:</td><td>FreightRoll2026!</td></tr>
      </table>
    </div>
  </div>

  <script>
    document.getElementById('seedForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      const result = document.getElementById('result');
      const secret = document.getElementById('secret').value.trim();
      
      btn.disabled = true;
      btn.textContent = 'Seeding...';
      result.innerHTML = '';
      
      try {
        const response = await fetch('/api/admin/seed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          result.className = 'result success';
          result.textContent = JSON.stringify(data, null, 2);
        } else {
          result.className = 'result error';
          result.textContent = 'Error: ' + (data.error || data.message || 'Unknown error');
        }
      } catch (error) {
        result.className = 'result error';
        result.textContent = 'Network error: ' + error.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Seed Database';
      }
    });
  </script>
</body>
</html>
    `.trim();

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  }

  // POST: Call Railway seed endpoint
  if (req.method === 'POST') {
    const { secret } = req.body;

    if (!secret || typeof secret !== 'string' || secret.length < 10) {
      return res.status(400).json({
        error: 'Invalid secret',
        message: 'Please provide the first 16 characters of AUTH_SECRET',
      });
    }

    try {
      const seedUrl = `${RAILWAY_API_URL}/api/admin/seed?secret=${encodeURIComponent(secret)}`;
      
      const response = await fetch(seedUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (error) {
      console.error('Seed error:', error);
      return res.status(502).json({
        error: 'Failed to reach Railway',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

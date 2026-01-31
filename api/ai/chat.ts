import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../../lib/logger';

/**
 * AI Chat Proxy Endpoint
 * 
 * Proxies Gemini API calls through the server to:
 * 1. Keep API key secure (not exposed in browser network tools)
 * 2. Allow rate limiting and monitoring
 * 3. Provide consistent error handling
 * 
 * Client sends chat contents, server adds API key and forwards to Gemini.
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

interface ChatRequest {
  contents: Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
  }>;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Get API key from environment (server-side only)
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    logger.warn('[AI Proxy] GEMINI_API_KEY not configured');
    res.status(503).json({ 
      error: 'AI service not configured',
      message: 'The Gemini API key has not been configured on the server.'
    });
    return;
  }

  try {
    const { contents, systemInstruction } = req.body as ChatRequest;

    if (!contents || !Array.isArray(contents)) {
      res.status(400).json({ error: 'Missing or invalid contents array' });
      return;
    }

    // Forward request to Gemini with server-side API key
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error('[AI Proxy] Gemini API error:', data);
      res.status(response.status).json({
        error: 'AI service error',
        message: data.error?.message || 'Failed to generate response',
      });
      return;
    }

    // Return the Gemini response
    res.status(200).json(data);
  } catch (error) {
    logger.error('[AI Proxy] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to process AI request'
    });
  }
}

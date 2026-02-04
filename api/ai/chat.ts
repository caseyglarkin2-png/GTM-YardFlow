import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * AI Chat Proxy Endpoint
 * 
 * Sprint 30: Routes all AI through Railway backend
 * 
 * CRITICAL: DO NOT add AI keys to Vercel
 * All AI calls route through Railway which handles Gemini/OpenAI
 */

// Inline config - no external imports to avoid initialization errors
const RAILWAY_API_URL = process.env.RAILWAY_API_URL?.trim() || '';
const RAILWAY_API_SECRET = (
  process.env.RAILWAY_API_SECRET || 
  process.env.SERVICE_TO_SERVICE_SECRET || 
  process.env.CRON_SECRET
)?.trim() || '';

interface ChatRequest {
  contents: Array<{
    role: 'user' | 'model' | 'assistant';
    parts: Array<{ text: string }>;
  }>;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  context?: {
    pageContext?: string;
    selectedProspects?: number;
  };
}

export default async function handler(
  req: VercelRequest, 
  res: VercelResponse
): Promise<void> {
  // Method check
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Config check
  if (!RAILWAY_API_URL) {
    res.status(503).json({ 
      error: 'Service not configured',
      message: 'RAILWAY_API_URL not set'
    });
    return;
  }

  if (!RAILWAY_API_SECRET) {
    res.status(503).json({ 
      error: 'Service not configured',
      message: 'RAILWAY_API_SECRET not set'
    });
    return;
  }

  try {
    const body = req.body as ChatRequest;
    
    if (!body.contents || !Array.isArray(body.contents)) {
      res.status(400).json({ error: 'Missing or invalid contents array' });
      return;
    }

    // Build a single message string from conversation history
    // Railway's /api/ai/chat expects { message: string, systemPrompt?: string }
    const lastUserMessage = body.contents
      .filter(c => c.role === 'user')
      .pop();
    
    if (!lastUserMessage) {
      res.status(400).json({ error: 'No user message found' });
      return;
    }

    const message = lastUserMessage.parts.map(p => p.text).join('\n');
    const systemPrompt = body.systemInstruction?.parts.map(p => p.text).join('\n');

    // Call Railway AI chat endpoint
    const railwayResponse = await fetch(`${RAILWAY_API_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAILWAY_API_SECRET}`,
        'x-service-key': RAILWAY_API_SECRET,
        'x-source': 'gtm-yardflow-vercel',
      },
      body: JSON.stringify({
        message,
        systemPrompt,
      }),
    });

    const data = await railwayResponse.json();

    if (!railwayResponse.ok) {
      console.error('[AI Chat] Railway error:', railwayResponse.status, data);
      res.status(railwayResponse.status).json({
        error: 'AI service error',
        message: data.error || data.message || 'Failed to generate response',
      });
      return;
    }

    // Railway returns { response: string (JSON), provider: string, fallbackUsed: boolean }
    // Parse the response field if it's JSON
    let responseText = '';
    try {
      if (data.response) {
        const parsed = JSON.parse(data.response);
        responseText = parsed.content || parsed.message || data.response;
      } else {
        responseText = data.content || data.message || '';
      }
    } catch {
      responseText = data.response || data.content || data.message || '';
    }

    // Convert back to Gemini format for frontend compatibility
    const geminiResponse = {
      candidates: [{
        content: {
          parts: [{ text: responseText }],
          role: 'model',
        },
        finishReason: 'STOP',
      }],
      usageMetadata: {
        promptTokenCount: data.usage?.promptTokens || 0,
        candidatesTokenCount: data.usage?.completionTokens || 0,
        totalTokenCount: (data.usage?.promptTokens || 0) + (data.usage?.completionTokens || 0),
      },
      _provider: data.provider,
      _fallbackUsed: data.fallbackUsed,
    };

    res.status(200).json(geminiResponse);

  } catch (error) {
    console.error('[AI Chat] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

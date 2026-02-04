import type { VercelRequest, VercelResponse } from '@vercel/node';
import { railwayServerClient } from '../../lib/railway-client';

/**
 * AI Chat Proxy Endpoint
 * 
 * Sprint 30: Refactored to proxy through Railway backend
 * 
 * All AI calls route through Railway which has the AI keys.
 * This endpoint:
 * 1. Receives chat request from frontend
 * 2. Forwards to Railway's AI content/chat endpoint
 * 3. Returns Railway's response
 * 
 * Auth: Uses S2S auth via RAILWAY_API_SECRET
 */

interface ChatRequest {
  contents: Array<{
    role: 'user' | 'model' | 'assistant';
    parts: Array<{ text: string }>;
  }>;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  /** Optional: type of chat (defaults to 'general') */
  type?: 'general' | 'research' | 'email' | 'analysis';
}

interface RailwayChatRequest {
  type: 'chat';
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  systemPrompt?: string;
}

interface RailwayChatResponse {
  success: boolean;
  content?: string;
  error?: string;
  provider?: 'gemini' | 'openai';
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { contents, systemInstruction } = req.body as ChatRequest;

    if (!contents || !Array.isArray(contents)) {
      res.status(400).json({ error: 'Missing or invalid contents array' });
      return;
    }

    // Convert Gemini-style format to Railway format
    const messages = contents.map(c => ({
      role: c.role === 'model' ? 'assistant' as const : c.role as 'user' | 'assistant',
      content: c.parts.map(p => p.text).join('\n'),
    }));

    // Add system prompt if provided
    const systemPrompt = systemInstruction?.parts.map(p => p.text).join('\n');

    // Build Railway request
    const railwayRequest: RailwayChatRequest = {
      type: 'chat',
      messages,
      ...(systemPrompt && { systemPrompt }),
    };

    // Forward to Railway AI endpoint
    const response = await railwayServerClient.post<RailwayChatResponse>(
      '/api/ai/content/generate',
      railwayRequest
    );

    if (!response.success) {
      console.error('[AI Chat] Railway error:', response.error);
      res.status(502).json({
        error: 'AI service error',
        message: response.error || 'Failed to generate response',
      });
      return;
    }

    // Convert back to Gemini-style response format for frontend compatibility
    const geminiStyleResponse = {
      candidates: [{
        content: {
          parts: [{ text: response.content }],
          role: 'model',
        },
        finishReason: 'STOP',
      }],
      usageMetadata: {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0,
      },
      // Include provider info for debugging
      _provider: response.provider,
    };

    res.status(200).json(geminiStyleResponse);
  } catch (error) {
    console.error('[AI Chat] Request failed:', error);
    
    // Return detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check if it's a Railway client error
    if (error instanceof Error && 'status' in error) {
      const status = (error as { status: number }).status;
      res.status(status).json({
        error: 'Railway API error',
        message: errorMessage,
        status,
      });
      return;
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: errorMessage,
      debug: process.env.NODE_ENV !== 'production' ? String(error) : undefined,
    });
  }
}

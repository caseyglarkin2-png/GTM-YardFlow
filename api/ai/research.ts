import type { VercelRequest, VercelResponse } from '@vercel/node';
import { railwayServerClient } from '../../lib/railway-client';

/**
 * AI Company Research Proxy Endpoint
 * 
 * Sprint 30: Proxy to Railway's AI dossier endpoint
 * 
 * Routes: 
 * - POST /api/ai/research - Generate company research dossier
 * 
 * Auth: Uses S2S auth via RAILWAY_API_SECRET
 */

interface ResearchRequest {
  companyName: string;
  domain?: string;
  existingData?: {
    industry?: string;
    size?: string;
    location?: string;
  };
  depth?: 'quick' | 'standard' | 'deep';
}

interface RailwayDossierRequest {
  companyName: string;
  domain?: string;
  context?: Record<string, unknown>;
  depth?: string;
}

interface RailwayDossierResponse {
  success: boolean;
  dossier?: {
    summary: string;
    facilityCount?: number;
    industryCategory?: string;
    distributionFootprint?: string;
    isYardIntensive?: boolean;
    headquarters?: string;
    website?: string;
    talkingPoints?: string[];
    competitors?: string[];
    keyContacts?: string[];
    recentNews?: string[];
  };
  error?: string;
  provider?: 'gemini' | 'openai';
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { companyName, domain, existingData, depth } = req.body as ResearchRequest;

    if (!companyName) {
      res.status(400).json({ error: 'Missing required field: companyName' });
      return;
    }

    // Build Railway request
    const railwayRequest: RailwayDossierRequest = {
      companyName,
      domain,
      context: existingData,
      depth: depth || 'standard',
    };

    // Forward to Railway AI dossier endpoint
    const response = await railwayServerClient.post<RailwayDossierResponse>(
      '/api/ai/dossier/generate',
      railwayRequest
    );

    if (!response.success) {
      console.error('[AI Research] Railway error:', response.error);
      res.status(502).json({
        success: false,
        error: response.error || 'Failed to generate research',
      });
      return;
    }

    // Return research result
    res.status(200).json({
      success: true,
      companyName,
      researchedAt: new Date().toISOString(),
      data: response.dossier,
      provider: response.provider,
    });
  } catch (error) {
    console.error('[AI Research] Request failed:', error);
    
    if (error instanceof Error && 'status' in error) {
      const status = (error as { status: number }).status;
      if (status === 503) {
        res.status(503).json({
          success: false,
          error: 'AI service unavailable',
        });
        return;
      }
      if (status === 404) {
        res.status(404).json({
          success: false,
          error: 'Research endpoint not available on Railway',
        });
        return;
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to process research request'
    });
  }
}

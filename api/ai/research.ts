import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * AI Company Research Proxy Endpoint
 * 
 * Sprint 30: Routes to Railway /api/ai/dossier/generate
 * 
 * CRITICAL: DO NOT add AI keys to Vercel
 * All AI calls route through Railway
 */

const RAILWAY_API_URL = process.env.RAILWAY_API_URL?.trim() || '';
const RAILWAY_API_SECRET = (
  process.env.RAILWAY_API_SECRET || 
  process.env.SERVICE_TO_SERVICE_SECRET || 
  process.env.CRON_SECRET
)?.trim() || '';

interface ResearchRequest {
  companyName: string;
  domain?: string;
  existingData?: Record<string, unknown>;
  depth?: 'quick' | 'standard' | 'deep';
}

export default async function handler(
  req: VercelRequest, 
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!RAILWAY_API_URL || !RAILWAY_API_SECRET) {
    res.status(503).json({ 
      success: false,
      error: 'Service not configured',
    });
    return;
  }

  try {
    const { companyName, domain, existingData, depth = 'standard' } = req.body as ResearchRequest;

    if (!companyName) {
      res.status(400).json({ success: false, error: 'Missing companyName' });
      return;
    }

    // Use Railway's /api/ai/chat endpoint with a research-focused prompt
    // Since dossier/generate requires a real accountId from Railway's database
    const researchPrompt = `Research the company "${companyName}"${domain ? ` (domain: ${domain})` : ''}.

Provide the following information in JSON format:
{
  "description": "Brief company description",
  "industryCategory": "Primary industry",
  "facilityCount": "Estimated number of facilities/locations (number or 'unknown')",
  "employeeCount": "Estimated employee count (number or 'unknown')",
  "headquarters": "HQ location if known",
  "yardOperations": "Description of yard/logistics operations if applicable",
  "keyDecisionMakers": ["Typical decision maker titles"],
  "talkingPoints": ["Pain points or opportunities for yard management software"],
  "competitivePosition": "Market position and key competitors"
}

${existingData ? `Existing context: ${JSON.stringify(existingData)}` : ''}

Focus on information relevant to selling yard management software.`;

    const railwayResponse = await fetch(`${RAILWAY_API_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAILWAY_API_SECRET}`,
        'x-service-key': RAILWAY_API_SECRET,
        'x-source': 'gtm-yardflow-vercel',
      },
      body: JSON.stringify({
        message: researchPrompt,
        systemPrompt: 'You are a B2B company research analyst. Provide structured, factual company information. Always respond with valid JSON.',
      }),
    });

    const data = await railwayResponse.json();

    if (!railwayResponse.ok) {
      console.error('[AI Research] Railway error:', railwayResponse.status, data);
      res.status(railwayResponse.status).json({
        success: false,
        error: data.error || data.message || 'Research failed',
      });
      return;
    }

    // Parse response from Railway chat endpoint
    let researchData: Record<string, unknown> = {};
    try {
      // Railway returns { response: string (JSON), provider, fallbackUsed }
      const responseText = data.response || '';
      
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        researchData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.warn('[AI Research] Failed to parse JSON response, using raw text');
      researchData = { rawResponse: data.response };
    }

    // Return normalized response
    res.status(200).json({
      success: true,
      companyName,
      researchedAt: new Date().toISOString(),
      data: researchData,
      provider: data.provider,
      fallbackUsed: data.fallbackUsed,
      sources: [],
    });

  } catch (error) {
    console.error('[AI Research] Error:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

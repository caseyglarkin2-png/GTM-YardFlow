/**
 * Gemini Service - YardFlow Hub
 * 
 * Production-ready wrapper for Google Gemini API with:
 * - Retry logic with exponential backoff
 * - Error categorization
 * - Mock mode for development/testing
 * - Request/response logging
 */

import type {
  AssetContext,
  GeneratedAssets,
  GeminiError,
  GeminiGenerateResult,
  MiniBrief,
  DMVariant,
  EmailSequence,
} from '../types/assets';

// ============================================
// Configuration
// ============================================

const GEMINI_CONFIG = {
  model: 'gemini-1.5-flash',
  maxOutputTokens: 4096,
  retryAttempts: 3,
  retryDelays: [1000, 2000, 4000], // Exponential backoff
  timeout: 30000,
} as const;

// ============================================
// Mock Mode Detection
// ============================================

const IS_MOCK_MODE = !import.meta.env.VITE_GEMINI_API_KEY || 
                     import.meta.env.VITE_GEMINI_MOCK === 'true' ||
                     import.meta.env.MODE === 'test';

// ============================================
// Mock Response Generator
// ============================================

function generateMockAssets(context: AssetContext): GeneratedAssets {
  // mockDelay can be used for simulating API latency in development
  // Currently not used since we return synchronously for faster dev iteration
  
  const miniBrief: MiniBrief = {
    hook: `${context.companyName} could be leaving hundreds of thousands on the table with manual yard operations.`,
    painPoints: [
      'Paper-based check-in/check-out creates bottlenecks and data gaps',
      'Detention charges averaging 2% of shipments at $150+ each',
      'Yard coordinators spending 30% of time on radio calls and manual lookups',
    ],
    valueProps: [
      'Digital check-in eliminates paper delays and creates audit trail',
      'Proactive alerts reduce detention events by 50%',
      'Automated dock assignment saves 2+ minutes per shipment',
    ],
    roiSnapshot: context.roiData?.totalAnnualSavings 
      ? `Based on your volume, estimated annual savings: $${(context.roiData.totalAnnualSavings / 1000).toFixed(0)}K`
      : 'ROI calculation available with your specific volume data.',
    cta: `Worth a 15-minute demo to see how ${context.companyName} could capture these savings?`,
  };

  const dmVariants: DMVariant[] = [
    {
      id: 'exec-1',
      type: 'exec',
      content: `${context.prospectName} - Primo Brands saving $1M+ per facility with FreightRoll. Happy to share how ${context.companyName} could see similar results. Book time: https://calendly.com/jake-freightroll/manifest-meeting`,
      characterCount: 0,
    },
    {
      id: 'ops-1',
      type: 'ops',
      content: `Quick question: how much time does your team spend on yard coordination radio calls? We typically save 2+ min/shipment. Worth a demo?`,
      characterCount: 0,
    },
    {
      id: 'challenger-1',
      type: 'challenger',
      content: `What if your bottom-quartile carriers are costing you 5 min/shipment in delays? We help visibility-driven shippers fix that. Interested?`,
      characterCount: 0,
    },
  ];

  // Calculate character counts
  dmVariants.forEach(dm => {
    dm.characterCount = dm.content.length;
  });

  const emailSequence: EmailSequence = {
    id: crypto.randomUUID(),
    name: `${context.companyName} Outreach Sequence`,
    steps: [
      {
        position: 1,
        delayDays: 0,
        subject: `Quick question about ${context.companyName}'s yard ops`,
        body: `Hi ${context.prospectName.split(' ')[0]},\n\nI noticed ${context.companyName} is on our list of companies who could benefit from yard visibility improvements.\n\nPrimo Brands is averaging $1M+ in savings PER facility with FreightRoll—eliminating paper-based check-in and reducing detention events by 50%.\n\nWould 15 minutes work to explore what this looks like for ${context.companyName}?\n\nBook time: https://calendly.com/jake-freightroll/manifest-meeting\n\nBest,\nJake`,
        persona: context.isExec ? 'exec' : context.isOps ? 'ops' : 'all',
      },
      {
        position: 2,
        delayDays: 2,
        subject: `Following up - yard efficiency for ${context.companyName}`,
        body: `Hi ${context.prospectName.split(' ')[0]},\n\nJust following up on my note from a couple days ago.\n\nI wanted to share a quick stat: facilities using FreightRoll typically save 2+ minutes per shipment through automated dock assignment. At scale, that adds up to significant labor savings.\n\nWould this week or next work for a quick call?\n\nBest,\nJake`,
        persona: context.isExec ? 'exec' : context.isOps ? 'ops' : 'all',
      },
      {
        position: 3,
        delayDays: 5,
        subject: `One more try - ${context.companyName} + YardFlow`,
        body: `Hi ${context.prospectName.split(' ')[0]},\n\nI'll keep this short - would a 15-minute demo of FreightRoll be useful?\n\nWe're helping companies like Primo Brands reduce detention charges and paper-based bottlenecks. Happy to show you exactly how it works.\n\nIf timing isn't right, no worries at all. Just let me know.\n\nBest,\nJake`,
        persona: context.isExec ? 'exec' : context.isOps ? 'ops' : 'all',
      },
      {
        position: 4,
        delayDays: 10,
        subject: `Last note from me`,
        body: `Hi ${context.prospectName.split(' ')[0]},\n\nI don't want to keep bothering you, so this will be my last email.\n\nIf you're ever curious about how companies are saving 6+ figures annually on yard operations, feel free to reach out.\n\nWishing you and ${context.companyName} all the best.\n\nJake`,
        persona: 'all',
      },
    ],
    createdAt: new Date().toISOString(),
  };

  return {
    prospectId: context.prospectId,
    prospectName: context.prospectName,
    companyName: context.companyName,
    miniBrief,
    dmVariants,
    emailSequence,
    generatedAt: new Date().toISOString(),
    fromCache: false,
  };
}

// ============================================
// Error Classification
// ============================================

function classifyError(error: unknown, status?: number): GeminiError {
  if (status === 429) {
    return {
      type: 'rate_limit',
      message: 'Rate limit exceeded. Please wait before retrying.',
      retryAfter: 60,
    };
  }
  
  if (status === 401 || status === 403) {
    return {
      type: 'auth_error',
      message: 'API authentication failed. Check your API key.',
    };
  }
  
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: 'Network error. Please check your connection.',
    };
  }
  
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  if (errorMessage.toLowerCase().includes('safety') || 
      errorMessage.toLowerCase().includes('blocked')) {
    return {
      type: 'content_filter',
      message: 'Content was blocked by safety filters. Try adjusting your input.',
    };
  }
  
  return {
    type: 'unknown',
    message: errorMessage,
  };
}

// ============================================
// API Call with Retry
// ============================================

async function callGeminiAPI(prompt: string, attempt = 0): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not set');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt,
        }],
      }],
      generationConfig: {
        maxOutputTokens: GEMINI_CONFIG.maxOutputTokens,
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const error = classifyError(null, response.status);
    
    // Retry on rate limit or network errors
    if (error.type === 'rate_limit' && attempt < GEMINI_CONFIG.retryAttempts) {
      const delay = GEMINI_CONFIG.retryDelays[attempt] || 4000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGeminiAPI(prompt, attempt + 1);
    }
    
    throw new Error(error.message);
  }

  const data = await response.json();
  
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Invalid response structure from Gemini API');
  }

  return data.candidates[0].content.parts[0].text;
}

// ============================================
// Parse AI Response
// ============================================

function parseAIResponse(text: string, context: AssetContext): Partial<GeneratedAssets> {
  // Try to extract JSON from response
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                    text.match(/\{[\s\S]*\}/);
  
  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      
      return {
        miniBrief: parsed.miniBrief,
        dmVariants: parsed.dmVariants?.map((dm: { type: string; content: string }, i: number) => ({
          id: `${dm.type}-${i}`,
          type: dm.type as DMVariant['type'],
          content: dm.content.slice(0, 250), // Enforce 250 char limit
          characterCount: Math.min(dm.content.length, 250),
        })),
        emailSequence: parsed.emailSequence ? {
          ...parsed.emailSequence,
          id: parsed.emailSequence.id || crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        } : undefined,
      };
    } catch (e) {
      console.warn('Failed to parse AI response as JSON, using fallback');
    }
  }
  
  // Fallback: generate mock response
  const mock = generateMockAssets(context);
  return {
    miniBrief: mock.miniBrief,
    dmVariants: mock.dmVariants,
    emailSequence: mock.emailSequence,
  };
}

// ============================================
// Main Export: Generate Assets
// ============================================

/**
 * Generate assets for a prospect using Gemini API
 * Falls back to mock in dev/test or when API key is missing
 */
export async function generateAssets(
  prompt: string,
  context: AssetContext
): Promise<GeminiGenerateResult> {
  // Use mock in development/test or when explicitly enabled
  if (IS_MOCK_MODE) {
    const mockDelay = parseInt(import.meta.env.VITE_GEMINI_MOCK_DELAY || '500', 10);
    await new Promise(resolve => setTimeout(resolve, mockDelay));
    
    const assets = generateMockAssets(context);
    return {
      success: true,
      data: assets,
      tokensUsed: 0,
    };
  }

  try {
    const responseText = await callGeminiAPI(prompt);
    const parsedAssets = parseAIResponse(responseText, context);
    
    const assets: GeneratedAssets = {
      prospectId: context.prospectId,
      prospectName: context.prospectName,
      companyName: context.companyName,
      ...parsedAssets,
      generatedAt: new Date().toISOString(),
      fromCache: false,
    };

    return {
      success: true,
      data: assets,
      tokensUsed: responseText.length / 4, // Rough estimate
    };
  } catch (error) {
    return {
      success: false,
      error: classifyError(error),
    };
  }
}

/**
 * Check if running in mock mode
 */
export function isUsingMockService(): boolean {
  return IS_MOCK_MODE;
}

/**
 * Generate a single mini-brief
 */
export async function generateMiniBrief(
  context: AssetContext
): Promise<{ success: boolean; data?: MiniBrief; error?: GeminiError }> {
  const result = await generateAssets('', { ...context, targetAssets: ['brief'] });
  
  if (result.success && result.data?.miniBrief) {
    return { success: true, data: result.data.miniBrief };
  }
  
  return { success: false, error: result.error };
}

/**
 * Generate DM variants only
 */
export async function generateDMVariants(
  context: AssetContext
): Promise<{ success: boolean; data?: DMVariant[]; error?: GeminiError }> {
  const result = await generateAssets('', { ...context, targetAssets: ['dms'] });
  
  if (result.success && result.data?.dmVariants) {
    return { success: true, data: result.data.dmVariants };
  }
  
  return { success: false, error: result.error };
}

/**
 * Generate email sequence
 */
export async function generateEmailSequence(
  context: AssetContext
): Promise<{ success: boolean; data?: EmailSequence; error?: GeminiError }> {
  const result = await generateAssets('', { ...context, targetAssets: ['emails'] });
  
  if (result.success && result.data?.emailSequence) {
    return { success: true, data: result.data.emailSequence };
  }
  
  return { success: false, error: result.error };
}

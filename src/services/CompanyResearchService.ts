/**
 * Company Research Service - YardFlow Hub
 * 
 * AI-powered company research using Gemini API.
 * Researches companies on-demand to populate Primo Lookalike scoring fields.
 * 
 * Sprint 58: On-demand company research with Gemini
 */

import type { EnrichedCompany } from '../types/marketing';
import {
  type IndustryCategory,
  type DistributionFootprint,
  isValidIndustryCategory,
  isValidDistributionFootprint,
} from './PrimoLookalikeScoring';

// ============================================
// Types
// ============================================

export interface CompanyResearchRequest {
  companyName: string;
  existingData?: Partial<EnrichedCompany>;
  researchDepth?: 'quick' | 'standard' | 'deep';
}

export interface CompanyResearchResult {
  success: boolean;
  companyName: string;
  researchedAt: Date;
  data?: ResearchedCompanyData;
  sources?: string[];
  confidence?: ResearchConfidence;
  error?: string;
  rawResponse?: string;
}

export interface ResearchedCompanyData {
  facilityCount?: number;
  facilityCountSource?: string;
  industryCategory?: IndustryCategory;
  industryCategoryReasoning?: string;
  distributionFootprint?: DistributionFootprint;
  distributionFootprintReasoning?: string;
  isYardIntensive?: boolean;
  isYardIntensiveReasoning?: string;
  estimatedTruckVolume?: number;
  headquarters?: string;
  website?: string;
  description?: string;
  parentCompany?: string;
  keyProducts?: string[];
  revenueEstimate?: string;
}

export interface ResearchConfidence {
  overall: 'high' | 'medium' | 'low';
  facilityCount: 'verified' | 'estimated' | 'unknown';
  industryCategory: 'verified' | 'inferred' | 'unknown';
  distributionFootprint: 'verified' | 'inferred' | 'unknown';
}

export interface BatchResearchResult {
  total: number;
  successful: number;
  failed: number;
  results: CompanyResearchResult[];
}

export interface ResearchQueueItem {
  companyName: string;
  companyId?: string;
  priority: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  result?: CompanyResearchResult;
}

// ============================================
// Configuration
// ============================================

const RESEARCH_CONFIG = {
  model: 'gemini-1.5-flash',
  maxOutputTokens: 4096,
  temperature: 0.3, // Lower temperature for more factual responses
  retryAttempts: 2,
  retryDelayMs: 2000,
  rateLimitDelayMs: 1000, // Delay between batch requests
} as const;

const IS_MOCK_MODE = !import.meta.env.VITE_GEMINI_API_KEY || 
                     import.meta.env.VITE_GEMINI_MOCK === 'true' ||
                     import.meta.env.MODE === 'test';

// Production safety check
if (import.meta.env.MODE === 'production' && IS_MOCK_MODE) {
  console.error(
    '[CompanyResearchService] CRITICAL: Running in mock mode in production! ' +
    'Set VITE_GEMINI_API_KEY to enable real AI research.'
  );
}

// ============================================
// Prompt Templates
// ============================================

/**
 * Build research prompt for Gemini
 */
/**
 * Sanitize input for safe prompt injection
 */
function sanitizeForPrompt(input: string): string {
  return input
    .replace(/[\r\n]+/g, ' ')  // Remove newlines
    .replace(/```/g, '')        // Remove code blocks
    .replace(/\$/g, '')         // Remove template literals
    .trim()
    .substring(0, 500);         // Limit length
}

export function buildResearchPrompt(request: CompanyResearchRequest): string {
  const { companyName, existingData, researchDepth = 'standard' } = request;
  const safeCompanyName = sanitizeForPrompt(companyName);
  
  const depthInstructions = {
    quick: 'Provide a brief overview focusing on facility count and industry.',
    standard: 'Provide comprehensive research on all requested fields.',
    deep: 'Provide in-depth research with multiple sources and detailed reasoning.',
  };

  const existingContext = existingData ? `
Known information about ${companyName}:
- Tier: ${existingData.tier || 'Unknown'}
- Attendees at trade shows: ${existingData.attendees || 'Unknown'}
- Current exec/ops share: ${existingData.opsShare ? `${Math.round(existingData.opsShare * 100)}%` : 'Unknown'}
- Max Revenue tier: ${existingData.maxRevenue || 'Unknown'}
` : '';

  return `You are a business research analyst helping qualify sales prospects for YardFlow, a yard management software company.

Research the following company and provide structured data for sales qualification:

**Company Name:** ${safeCompanyName}
${existingContext}

${depthInstructions[researchDepth]}

Please research and provide the following information in JSON format:

\`\`\`json
{
  "facilityCount": <number or null if unknown>,
  "facilityCountSource": "<where you found this information>",
  "industryCategory": "<one of: beverage, cpg, food_manufacturing, cold_chain, distribution, manufacturing, other>",
  "industryCategoryReasoning": "<why you chose this category>",
  "distributionFootprint": "<one of: local, regional, national, international>",
  "distributionFootprintReasoning": "<why you chose this>",
  "isYardIntensive": <true/false>,
  "isYardIntensiveReasoning": "<reasoning - consider: large DCs, high trailer volumes, multiple dock doors>",
  "estimatedTruckVolume": <estimated trucks per day across all facilities, or null>,
  "headquarters": "<city, state/country>",
  "website": "<company website URL>",
  "description": "<1-2 sentence company description>",
  "parentCompany": "<parent company name if subsidiary, or null>",
  "keyProducts": ["<product 1>", "<product 2>"],
  "revenueEstimate": "<revenue tier like '$1B-$5B' or null>",
  "sources": ["<source 1>", "<source 2>"],
  "confidence": {
    "overall": "<high/medium/low>",
    "facilityCount": "<verified/estimated/unknown>",
    "industryCategory": "<verified/inferred/unknown>",
    "distributionFootprint": "<verified/inferred/unknown>"
  }
}
\`\`\`

**Important Context for YardFlow Qualification:**
- We are looking for companies similar to Primo Brands (260 facilities, beverage industry, national footprint)
- "Yard intensive" means: multiple distribution centers, high trailer/truck throughput, dock door operations
- Industries like beverage, CPG, food manufacturing are high-value targets
- Companies with 50+ facilities are strong prospects
- We care about logistics operations footprint, not retail store counts

If you cannot find specific information, provide your best estimate with low confidence, or null if completely unknown.`;
}

// ============================================
// Mock Response Generator
// ============================================

function generateMockResearch(companyName: string): ResearchedCompanyData {
  // Generate plausible mock data based on company name patterns
  const nameLower = companyName.toLowerCase();
  
  const isBeverage = nameLower.includes('beverage') || nameLower.includes('drink') || 
                     nameLower.includes('water') || nameLower.includes('soda');
  const isFood = nameLower.includes('food') || nameLower.includes('snack') || 
                 nameLower.includes('bakery');
  const isDistribution = nameLower.includes('logistics') || nameLower.includes('distribution') ||
                         nameLower.includes('freight') || nameLower.includes('supply');
  
  let industry: IndustryCategory = 'other';
  if (isBeverage) industry = 'beverage';
  else if (isFood) industry = 'food_manufacturing';
  else if (isDistribution) industry = 'distribution';
  
  return {
    facilityCount: Math.floor(Math.random() * 200) + 10,
    facilityCountSource: 'Mock data - company website estimate',
    industryCategory: industry,
    industryCategoryReasoning: `Inferred from company name: ${companyName}`,
    distributionFootprint: 'regional',
    distributionFootprintReasoning: 'Default assumption for mid-size company',
    isYardIntensive: isBeverage || isFood || isDistribution,
    isYardIntensiveReasoning: 'Based on industry type',
    estimatedTruckVolume: Math.floor(Math.random() * 500) + 50,
    headquarters: 'Tampa, FL',
    website: `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
    description: `${companyName} is a company in the ${industry} industry.`,
    keyProducts: ['Product A', 'Product B'],
    revenueEstimate: '$100M-$500M',
  };
}

function generateMockConfidence(): ResearchConfidence {
  return {
    overall: 'medium',
    facilityCount: 'estimated',
    industryCategory: 'inferred',
    distributionFootprint: 'inferred',
  };
}

// ============================================
// API Call Functions
// ============================================

/**
 * Call Gemini API for company research
 * 
 * TODO: [SECURITY] For production, route this through a backend API endpoint
 * (e.g., /api/research/company) to keep the API key server-side.
 * Current implementation exposes the key in browser network tools.
 * See: https://ai.google.dev/gemini-api/docs/get-started/web
 */
async function callGeminiForResearch(prompt: string, attempt = 0): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not set');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${RESEARCH_CONFIG.model}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }],
        }],
        generationConfig: {
          maxOutputTokens: RESEARCH_CONFIG.maxOutputTokens,
          temperature: RESEARCH_CONFIG.temperature,
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429 && attempt < RESEARCH_CONFIG.retryAttempts) {
        // Rate limited - retry with delay
        await new Promise(resolve => setTimeout(resolve, RESEARCH_CONFIG.retryDelayMs * (attempt + 1)));
        return callGeminiForResearch(prompt, attempt + 1);
      }
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response structure from Gemini API');
    }

    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    if (attempt < RESEARCH_CONFIG.retryAttempts) {
      await new Promise(resolve => setTimeout(resolve, RESEARCH_CONFIG.retryDelayMs));
      return callGeminiForResearch(prompt, attempt + 1);
    }
    throw error;
  }
}

// ============================================
// Response Parsing
// ============================================

/**
 * Parse Gemini research response into structured data
 */
export function parseResearchResponse(rawResponse: string): {
  data: ResearchedCompanyData;
  sources: string[];
  confidence: ResearchConfidence;
} {
  // Extract JSON from response
  const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
                    rawResponse.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error('No JSON found in research response');
  }

  const jsonStr = jsonMatch[1] || jsonMatch[0];
  
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
    throw new Error(`Failed to parse research response JSON: ${errorMessage}. Raw: ${jsonStr.substring(0, 200)}...`);
  }

  // Type-safe accessors
  const getString = (key: string): string | undefined => {
    const val = parsed[key];
    return typeof val === 'string' ? val : undefined;
  };
  const getNumber = (key: string): number | undefined => {
    const val = parsed[key];
    return typeof val === 'number' ? val : undefined;
  };
  const getBoolean = (key: string): boolean | undefined => {
    const val = parsed[key];
    return typeof val === 'boolean' ? val : undefined;
  };
  const getStringArray = (key: string): string[] | undefined => {
    const val = parsed[key];
    return Array.isArray(val) && val.every(v => typeof v === 'string') ? val : undefined;
  };
  const getConfidenceObj = (): Record<string, string> => {
    const val = parsed.confidence;
    return typeof val === 'object' && val !== null ? val as Record<string, string> : {};
  };

  // Validate and normalize industry category
  let industryCategory: IndustryCategory | undefined;
  const rawIndustryCategory = getString('industryCategory');
  if (rawIndustryCategory) {
    const normalized = rawIndustryCategory.toLowerCase().replace(/[^a-z_]/g, '');
    if (isValidIndustryCategory(normalized)) {
      industryCategory = normalized;
    }
  }

  // Validate and normalize distribution footprint
  let distributionFootprint: DistributionFootprint | undefined;
  const rawDistributionFootprint = getString('distributionFootprint');
  if (rawDistributionFootprint) {
    const normalized = rawDistributionFootprint.toLowerCase().replace(/[^a-z]/g, '');
    if (isValidDistributionFootprint(normalized)) {
      distributionFootprint = normalized;
    }
  }

  const data: ResearchedCompanyData = {
    facilityCount: getNumber('facilityCount'),
    facilityCountSource: getString('facilityCountSource'),
    industryCategory,
    industryCategoryReasoning: getString('industryCategoryReasoning'),
    distributionFootprint,
    distributionFootprintReasoning: getString('distributionFootprintReasoning'),
    isYardIntensive: getBoolean('isYardIntensive'),
    isYardIntensiveReasoning: getString('isYardIntensiveReasoning'),
    estimatedTruckVolume: getNumber('estimatedTruckVolume'),
    headquarters: getString('headquarters'),
    website: getString('website'),
    description: getString('description'),
    parentCompany: getString('parentCompany'),
    keyProducts: getStringArray('keyProducts'),
    revenueEstimate: getString('revenueEstimate'),
  };

  const sources: string[] = getStringArray('sources') || [];

  const confidenceObj = getConfidenceObj();
  const confidence: ResearchConfidence = {
    overall: ['high', 'medium', 'low'].includes(confidenceObj.overall) 
      ? confidenceObj.overall as 'high' | 'medium' | 'low'
      : 'low',
    facilityCount: ['verified', 'estimated', 'unknown'].includes(confidenceObj.facilityCount)
      ? confidenceObj.facilityCount as 'verified' | 'estimated' | 'unknown'
      : 'unknown',
    industryCategory: ['verified', 'inferred', 'unknown'].includes(confidenceObj.industryCategory)
      ? confidenceObj.industryCategory as 'verified' | 'inferred' | 'unknown'
      : 'unknown',
    distributionFootprint: ['verified', 'inferred', 'unknown'].includes(confidenceObj.distributionFootprint)
      ? confidenceObj.distributionFootprint as 'verified' | 'inferred' | 'unknown'
      : 'unknown',
  };

  return { data, sources, confidence };
}

// ============================================
// Main Research Functions
// ============================================

/**
 * Research a single company using Gemini API
 * This is the main function users call to research a company on-demand
 */
export async function researchCompany(
  request: CompanyResearchRequest
): Promise<CompanyResearchResult> {
  const { companyName } = request;
  
  if (!companyName || companyName.trim().length === 0) {
    return {
      success: false,
      companyName: '',
      researchedAt: new Date(),
      error: 'Company name is required',
    };
  }

  try {
    // Use mock mode for development/testing
    if (IS_MOCK_MODE) {
      const mockData = generateMockResearch(companyName);
      const mockConfidence = generateMockConfidence();
      
      return {
        success: true,
        companyName,
        researchedAt: new Date(),
        data: mockData,
        sources: ['Mock data source'],
        confidence: mockConfidence,
      };
    }

    // Build prompt and call Gemini
    const prompt = buildResearchPrompt(request);
    const rawResponse = await callGeminiForResearch(prompt);
    
    // Parse response
    const { data, sources, confidence } = parseResearchResponse(rawResponse);
    
    return {
      success: true,
      companyName,
      researchedAt: new Date(),
      data,
      sources,
      confidence,
      rawResponse,
    };
  } catch (error) {
    return {
      success: false,
      companyName,
      researchedAt: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error during research',
    };
  }
}

/**
 * Research multiple companies in batch with rate limiting
 */
export async function batchResearchCompanies(
  companies: CompanyResearchRequest[],
  options?: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<BatchResearchResult> {
  const { concurrency = 1, onProgress } = options || {};
  const results: CompanyResearchResult[] = [];
  let successful = 0;
  let failed = 0;

  // Process in batches to respect rate limits
  for (let i = 0; i < companies.length; i += concurrency) {
    const batch = companies.slice(i, i + concurrency);
    
    const batchResults = await Promise.all(
      batch.map(request => researchCompany(request))
    );
    
    for (const result of batchResults) {
      results.push(result);
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    onProgress?.(results.length, companies.length);

    // Rate limit delay between batches (skip for mock mode)
    if (!IS_MOCK_MODE && i + concurrency < companies.length) {
      await new Promise(resolve => setTimeout(resolve, RESEARCH_CONFIG.rateLimitDelayMs));
    }
  }

  return {
    total: companies.length,
    successful,
    failed,
    results,
  };
}

/**
 * Research companies from a priority queue (e.g., Tier 1 first)
 */
export async function researchFromQueue(
  queue: ResearchQueueItem[],
  options?: {
    maxItems?: number;
    onProgress?: (item: ResearchQueueItem, index: number, total: number) => void;
  }
): Promise<BatchResearchResult> {
  const { maxItems, onProgress } = options || {};
  const results: CompanyResearchResult[] = [];
  
  // Sort by priority (lower = higher priority)
  const sortedQueue = [...queue].sort((a, b) => a.priority - b.priority);
  const itemsToProcess = maxItems ? sortedQueue.slice(0, maxItems) : sortedQueue;

  for (let i = 0; i < itemsToProcess.length; i++) {
    const item = itemsToProcess[i];
    item.status = 'in-progress';
    
    onProgress?.(item, i, itemsToProcess.length);

    const result = await researchCompany({
      companyName: item.companyName,
    });

    item.result = result;
    item.status = result.success ? 'completed' : 'failed';
    results.push(result);

    // Rate limit delay (skip for mock mode)
    if (!IS_MOCK_MODE && i < itemsToProcess.length - 1) {
      await new Promise(resolve => setTimeout(resolve, RESEARCH_CONFIG.rateLimitDelayMs));
    }
  }

  return {
    total: itemsToProcess.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  };
}

/**
 * Create a research queue from unenriched companies, prioritized by tier and attendees
 */
export function createResearchQueue(
  companies: Partial<EnrichedCompany>[],
  options?: {
    filterFn?: (company: Partial<EnrichedCompany>) => boolean;
  }
): ResearchQueueItem[] {
  const { filterFn } = options || {};
  
  // Filter to only companies that need research
  const needsResearch = companies.filter(company => {
    // Skip if no company name
    if (!company.company) return false;
    
    // Apply custom filter if provided
    if (filterFn && !filterFn(company)) return false;
    
    // Check if missing key enrichment data
    const missingFacilityCount = company.facilityCount === undefined;
    const missingIndustry = company.industryCategory === undefined;
    const missingFootprint = company.distributionFootprint === undefined;
    
    return missingFacilityCount || missingIndustry || missingFootprint;
  });

  // Create queue items with priority scoring
  const tierPriority: Record<string, number> = {
    'Tier 1': 0,
    'Tier 2': 100,
    'Tier 3': 200,
    'Tier 4': 300,
  };

  return needsResearch.map(company => {
    // Priority = tier priority + (1000 - attendees)
    // This puts Tier 1 first, then within tier, higher attendees first
    const tier = company.tier || 'Tier 4';
    const attendees = company.attendees || 0;
    const priority = (tierPriority[tier] ?? 300) + (1000 - Math.min(attendees, 1000));

    return {
      companyName: company.company!,
      companyId: company.id,
      priority,
      status: 'pending' as const,
    };
  }).sort((a, b) => a.priority - b.priority);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if a company needs research
 */
export function needsResearch(company: Partial<EnrichedCompany>): boolean {
  return (
    company.facilityCount === undefined ||
    company.industryCategory === undefined ||
    company.distributionFootprint === undefined
  );
}

/**
 * Get research summary for a list of companies
 */
export function getResearchSummary(companies: Partial<EnrichedCompany>[]): {
  total: number;
  fullyResearched: number;
  partiallyResearched: number;
  notResearched: number;
  byTier: Record<string, { total: number; researched: number }>;
} {
  const byTier: Record<string, { total: number; researched: number }> = {};
  let fullyResearched = 0;
  let partiallyResearched = 0;
  let notResearched = 0;

  for (const company of companies) {
    const tier = company.tier || 'Unknown';
    if (!byTier[tier]) {
      byTier[tier] = { total: 0, researched: 0 };
    }
    byTier[tier].total++;

    const hasFacility = company.facilityCount !== undefined;
    const hasIndustry = company.industryCategory !== undefined;
    const hasFootprint = company.distributionFootprint !== undefined;
    const fieldsPopulated = [hasFacility, hasIndustry, hasFootprint].filter(Boolean).length;

    if (fieldsPopulated === 3) {
      fullyResearched++;
      byTier[tier].researched++;
    } else if (fieldsPopulated > 0) {
      partiallyResearched++;
      byTier[tier].researched += 0.5; // Count as half researched
    } else {
      notResearched++;
    }
  }

  return {
    total: companies.length,
    fullyResearched,
    partiallyResearched,
    notResearched,
    byTier,
  };
}

/**
 * Estimate research time for a queue
 */
export function estimateResearchTime(queueLength: number): {
  estimatedMinutes: number;
  estimatedTokens: number;
  estimatedCost: string;
} {
  // Rough estimates based on Gemini API performance
  const secondsPerCompany = 5; // ~5 seconds per research call
  const tokensPerCompany = 1500; // Prompt + response tokens
  const costPer1MTokens = 0.075; // Gemini 1.5 Flash pricing

  const estimatedMinutes = Math.ceil((queueLength * secondsPerCompany) / 60);
  const estimatedTokens = queueLength * tokensPerCompany;
  const estimatedCost = ((estimatedTokens / 1_000_000) * costPer1MTokens).toFixed(4);

  return {
    estimatedMinutes,
    estimatedTokens,
    estimatedCost: `$${estimatedCost}`,
  };
}

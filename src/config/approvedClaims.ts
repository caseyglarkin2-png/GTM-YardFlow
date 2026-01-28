/**
 * Approved Claims Registry - YardFlow Hub
 * 
 * Centralized registry of approved customer claims and statistics.
 * Only these claims may be used in AI-generated content to prevent hallucination.
 * 
 * See /src/config/roiFormulas.md for proof point documentation.
 */

// ============================================
// Types
// ============================================

export interface ApprovedClaim {
  id: string;
  category: 'roi' | 'network-effects' | 'case-study' | 'benchmark';
  claim: string;
  source: string;
  approved: boolean;
  lastVerified: string;  // YYYY-MM format
}

// ============================================
// Approved Claims Database
// ============================================

const APPROVED_CLAIMS: ApprovedClaim[] = [
  // ROI Claims
  {
    id: 'ROI-001',
    category: 'roi',
    claim: 'Paper handling costs ~$0.50/pallet',
    source: 'Industry analysis, 2026-01',
    approved: true,
    lastVerified: '2026-01',
  },
  {
    id: 'ROI-002',
    category: 'roi',
    claim: 'YardFlow typically reduces detention events by 50%',
    source: 'Customer aggregate data, 2025',
    approved: true,
    lastVerified: '2026-01',
  },
  {
    id: 'ROI-003',
    category: 'roi',
    claim: 'Average 2 minutes saved per shipment through automation',
    source: 'Bottom-quartile facility improvement data',
    approved: true,
    lastVerified: '2026-01',
  },
  
  // Network Effects Claims
  {
    id: 'NET-001',
    category: 'network-effects',
    claim: '$1M+ contribution margin across 25 facilities',
    source: 'Jake (internal) - Primo Brands reference',
    approved: true,
    lastVerified: '2026-01',
  },
  {
    id: 'NET-002',
    category: 'network-effects',
    claim: 'Rolling to 260 facilities',
    source: 'Jake (internal) - Primo Brands reference',
    approved: true,
    lastVerified: '2026-01',
  },
  {
    id: 'NET-003',
    category: 'network-effects',
    claim: 'Network value increases logarithmically with facility count',
    source: 'YardFlow economics model',
    approved: true,
    lastVerified: '2026-01',
  },
  
  // Case Study Claims
  {
    id: 'CS-001',
    category: 'case-study',
    claim: 'Primo Brands achieved $40K/facility/year in savings',
    source: 'Primo Brands partnership data, 2025',
    approved: true,
    lastVerified: '2026-01',
  },
  {
    id: 'CS-002',
    category: 'case-study',
    claim: 'Implementation typically completes in 2-4 weeks',
    source: 'Customer implementation averages',
    approved: true,
    lastVerified: '2026-01',
  },
  
  // Benchmark Claims
  {
    id: 'BM-001',
    category: 'benchmark',
    claim: 'Bottom quartile facilities waste ~5 min/shipment on yard coordination',
    source: 'Industry analysis, 2026-01',
    approved: true,
    lastVerified: '2026-01',
  },
  {
    id: 'BM-002',
    category: 'benchmark',
    claim: 'Late pickup fees average $500/shipment in ~2% of cases',
    source: 'Carrier data aggregate',
    approved: true,
    lastVerified: '2026-01',
  },
  {
    id: 'BM-003',
    category: 'benchmark',
    claim: 'Average detention rates range from 1-5% across industries',
    source: 'Industry analysis, 2025',
    approved: true,
    lastVerified: '2026-01',
  },
  {
    id: 'BM-004',
    category: 'benchmark',
    claim: 'Yard visibility typically requires 3-5 FTEs without automation',
    source: 'Customer discovery interviews',
    approved: true,
    lastVerified: '2026-01',
  },
];

// ============================================
// Access Functions
// ============================================

/**
 * Get all approved claims, optionally filtered by category
 * Only returns claims where approved=true
 */
export function getApprovedClaims(categories?: ApprovedClaim['category'][]): ApprovedClaim[] {
  const approvedOnly = APPROVED_CLAIMS.filter(c => c.approved);
  
  if (!categories || categories.length === 0) {
    return approvedOnly;
  }
  
  return approvedOnly.filter(c => categories.includes(c.category));
}

/**
 * Get a single claim by ID
 */
export function getClaimById(id: string): ApprovedClaim | undefined {
  return APPROVED_CLAIMS.find(c => c.id === id && c.approved);
}

/**
 * Format claims for injection into AI prompts
 */
export function formatClaimsForPrompt(claims: ApprovedClaim[]): string {
  if (claims.length === 0) {
    return 'No approved claims available.';
  }
  
  const lines = claims.map((c, i) => `${i + 1}. ${c.claim} [Source: ${c.source}]`);
  return `APPROVED CLAIMS (use ONLY these statistics, do not invent others):\n${lines.join('\n')}`;
}

/**
 * Get claims formatted for a specific use case
 */
export function getClaimsForContext(context: 'dm' | 'email' | 'brief' | 'all'): string {
  let categories: ApprovedClaim['category'][];
  
  switch (context) {
    case 'dm':
      // Short DMs use ROI + benchmark
      categories = ['roi', 'benchmark'];
      break;
    case 'email':
      // Emails can use case studies too
      categories = ['roi', 'network-effects', 'case-study'];
      break;
    case 'brief':
      // Briefs use everything
      categories = ['roi', 'network-effects', 'case-study', 'benchmark'];
      break;
    case 'all':
    default:
      return formatClaimsForPrompt(getApprovedClaims());
  }
  
  return formatClaimsForPrompt(getApprovedClaims(categories));
}

/**
 * Validate that text only uses approved claims (basic check)
 * Returns list of suspicious claims that may need review
 */
export function checkForUnapprovedClaims(text: string): string[] {
  const suspiciousPatterns = [
    /\d+%\s*(reduction|improvement|savings|increase)/gi,
    /\$[\d,]+[KMB]?\s*(savings?|annually|per)/gi,
    /save[ds]?\s+\$[\d,]+/gi,
    /ROI\s+of\s+\d+/gi,
  ];
  
  const suspiciousClaims: string[] = [];
  const approvedClaimTexts = APPROVED_CLAIMS.filter(c => c.approved).map(c => c.claim.toLowerCase());
  
  for (const pattern of suspiciousPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Check if this match is part of an approved claim
        const isApproved = approvedClaimTexts.some(claim => 
          claim.includes(match.toLowerCase()) || match.toLowerCase().includes(claim.slice(0, 20))
        );
        
        if (!isApproved) {
          suspiciousClaims.push(match);
        }
      }
    }
  }
  
  return [...new Set(suspiciousClaims)];
}

// ============================================
// Admin Functions (for future use)
// ============================================

/**
 * Get all claims including unapproved (for admin review)
 */
export function getAllClaimsForReview(): ApprovedClaim[] {
  return [...APPROVED_CLAIMS];
}

/**
 * Get claims that need re-verification (> 6 months old)
 */
export function getClaimsNeedingVerification(): ApprovedClaim[] {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const cutoffDate = sixMonthsAgo.toISOString().slice(0, 7); // YYYY-MM
  
  return APPROVED_CLAIMS.filter(c => c.lastVerified < cutoffDate);
}

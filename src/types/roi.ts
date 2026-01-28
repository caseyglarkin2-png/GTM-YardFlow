/**
 * ROI Module Types - YardFlow Hub
 * 
 * Defines Zod schemas and TypeScript types for ROI calculations.
 * See /src/config/roiFormulas.md for formula specification.
 */

import { z } from 'zod';

// ============================================
// Quick Win Calculator Schemas
// ============================================

/**
 * Quick Win Calculator Input Schema
 * Validates user input for single-facility ROI calculation
 */
export const QuickWinInputSchema = z.object({
  facilitiesCount: z.number()
    .int()
    .min(1, 'At least 1 facility required')
    .max(500, 'Maximum 500 facilities')
    .default(1),
  
  shipmentsPerMonth: z.number()
    .int()
    .min(0, 'Shipments cannot be negative')
    .max(1_000_000, 'Maximum 1M shipments/month')
    .default(10_000),
  
  avgDwellTimeMinutes: z.number()
    .min(0, 'Dwell time cannot be negative')
    .max(480, 'Maximum 8 hours dwell time')
    .default(45),
  
  detentionRatePercent: z.number()
    .min(0, 'Rate cannot be negative')
    .max(20, 'Maximum 20% detention rate')
    .default(2),
  
  avgDetentionCost: z.number()
    .min(0, 'Cost cannot be negative')
    .max(1000, 'Maximum $1,000 per detention event')
    .default(150),
  
  hourlyLaborRate: z.number()
    .min(10, 'Minimum $10/hour labor rate')
    .max(100, 'Maximum $100/hour labor rate')
    .default(25),
  
  palletsPerMonth: z.number()
    .int()
    .min(0, 'Pallets cannot be negative')
    .max(10_000_000, 'Maximum 10M pallets/month')
    .default(50_000),
});

export type QuickWinInput = z.infer<typeof QuickWinInputSchema>;

/**
 * Quick Win Calculator Output Schema
 * Structured breakdown of all savings categories
 */
export const QuickWinOutputSchema = z.object({
  // Paper savings (digitization)
  paperSavingsMonthly: z.number(),
  paperSavingsAnnual: z.number(),
  
  // Labor savings (process efficiency)
  laborSavingsMonthly: z.number(),
  laborSavingsAnnual: z.number(),
  
  // Detention savings (carrier cost avoidance)
  detentionSavingsMonthly: z.number(),
  detentionSavingsAnnual: z.number(),
  
  // Totals
  totalMonthly: z.number(),
  totalAnnual: z.number(),
  
  // Metadata
  calculatedAt: z.string().datetime(),
  inputSnapshot: QuickWinInputSchema,
});

export type QuickWinOutput = z.infer<typeof QuickWinOutputSchema>;

// ============================================
// Network Effects Calculator Schemas
// ============================================

/**
 * Network Effects Calculator Input Schema
 * Validates input for multi-facility network value calculation
 */
export const NetworkEffectsInputSchema = z.object({
  facilityCount: z.number()
    .int()
    .min(1, 'At least 1 facility required')
    .max(500, 'Maximum 500 facilities')
    .default(5),
  
  baseValuePerFacility: z.number()
    .min(0, 'Value cannot be negative')
    .max(10_000_000, 'Maximum $10M per facility')
    .default(100_000),
  
  shipmentVolume: z.number()
    .int()
    .min(0, 'Shipments cannot be negative')
    .max(10_000_000, 'Maximum 10M shipments/month')
    .default(100_000),
  
  slowDriverPercent: z.number()
    .min(0, 'Percentage cannot be negative')
    .max(50, 'Maximum 50% slow drivers')
    .default(10),
  
  avgDelayMinutes: z.number()
    .min(0, 'Delay cannot be negative')
    .max(60, 'Maximum 60 minutes delay')
    .default(5),
  
  latePickupRatePercent: z.number()
    .min(0, 'Rate cannot be negative')
    .max(10, 'Maximum 10% late pickup rate')
    .default(2),
  
  avgLateFee: z.number()
    .min(0, 'Fee cannot be negative')
    .max(2000, 'Maximum $2,000 per late fee')
    .default(500),
  
  hourlyLaborRate: z.number()
    .min(10, 'Minimum $10/hour labor rate')
    .max(100, 'Maximum $100/hour labor rate')
    .default(25),
});

export type NetworkEffectsInput = z.infer<typeof NetworkEffectsInputSchema>;

/**
 * Network Effects Calculator Output Schema
 * Structured breakdown of network-level value
 */
export const NetworkEffectsOutputSchema = z.object({
  // Network multiplier (logarithmic scale)
  networkMultiplier: z.number(),
  
  // Marginal network value (base × facilities × multiplier)
  marginalValueAnnual: z.number(),
  
  // Carrier benchmark savings
  carrierBenchmarkSavingsMonthly: z.number(),
  carrierBenchmarkSavingsAnnual: z.number(),
  
  // Avoidable fines (late pickup fees)
  avoidableFinesMonthly: z.number(),
  avoidableFinesAnnual: z.number(),
  
  // Totals
  totalNetworkValueAnnual: z.number(),
  
  // Metadata
  calculatedAt: z.string().datetime(),
  inputSnapshot: NetworkEffectsInputSchema,
});

export type NetworkEffectsOutput = z.infer<typeof NetworkEffectsOutputSchema>;

// ============================================
// Combined ROI Report Schema
// ============================================

/**
 * Combined ROI Report
 * Aggregates Quick Win and Network Effects for export/display
 */
export const ROIReportSchema = z.object({
  id: z.string().uuid(),
  prospectId: z.string().optional(),
  prospectName: z.string().optional(),
  companyName: z.string().optional(),
  
  quickWin: QuickWinOutputSchema.optional(),
  networkEffects: NetworkEffectsOutputSchema.optional(),
  
  // Payback calculation
  paybackMonths: z.number().optional(),
  implementationCost: z.number().optional(),
  
  // Metadata
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.literal('1.0'),
});

export type ROIReport = z.infer<typeof ROIReportSchema>;

// ============================================
// Approved Proof Points Schema
// ============================================

/**
 * Proof Point - Verified customer claims for generated content
 */
export const ProofPointSchema = z.object({
  id: z.string().regex(/^PP-\d{3}$/, 'Format: PP-XXX'),
  customer: z.string(),
  claim: z.string(),
  source: z.string(),
  verifiedDate: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
});

export type ProofPoint = z.infer<typeof ProofPointSchema>;

/**
 * Approved proof points allowlist - only these may appear in generated content
 */
export const APPROVED_PROOF_POINTS: ProofPoint[] = [
  {
    id: 'PP-001',
    customer: 'Primo Brands',
    claim: '$1M+ contribution margin across 25 facilities',
    source: 'Jake (internal)',
    verifiedDate: '2026-01',
  },
  {
    id: 'PP-002',
    customer: 'Primo Brands',
    claim: 'Rolling to 260 facilities',
    source: 'Jake (internal)',
    verifiedDate: '2026-01',
  },
  {
    id: 'PP-003',
    customer: 'Benchmark',
    claim: 'Bottom quartile wastes ~5 min/shipment',
    source: 'Industry analysis',
    verifiedDate: '2026-01',
  },
  {
    id: 'PP-004',
    customer: 'Benchmark',
    claim: 'Late pickup fees $500/shipment in ~2% of cases',
    source: 'Carrier data',
    verifiedDate: '2026-01',
  },
  {
    id: 'PP-005',
    customer: 'Benchmark',
    claim: 'Paper handling costs ~$0.50/pallet',
    source: 'Industry analysis',
    verifiedDate: '2026-01',
  },
];

// ============================================
// Constants
// ============================================

/**
 * ROI Calculator Constants - hardcoded to prevent manipulation
 */
export const ROI_CONSTANTS = {
  // Paper savings rate (per pallet)
  PAPER_COST_PER_PALLET: 0.50,
  
  // Labor efficiency (minutes saved per shipment)
  MINUTES_SAVED_PER_SHIPMENT: 2,
  
  // Detention/fee reduction rate (YardFlow typically halves incidents)
  REDUCTION_RATE: 0.50,
  
  // Default labor rate for carrier benchmark calc
  DEFAULT_LABOR_RATE: 25,
  
  // Implementation cost estimate (per facility)
  IMPLEMENTATION_COST_PER_FACILITY: 50_000,
  
  // Months per year (for annual calculations)
  MONTHS_PER_YEAR: 12,
} as const;

// ============================================
// Validation Helpers
// ============================================

/**
 * Parses and validates Quick Win input, returning typed input or throwing ZodError
 */
export function parseQuickWinInput(input: unknown): QuickWinInput {
  return QuickWinInputSchema.parse(input);
}

/**
 * Safely parses Quick Win input, returning result object
 */
export function safeParseQuickWinInput(input: unknown) {
  return QuickWinInputSchema.safeParse(input);
}

/**
 * Parses and validates Network Effects input, returning typed input or throwing ZodError
 */
export function parseNetworkEffectsInput(input: unknown): NetworkEffectsInput {
  return NetworkEffectsInputSchema.parse(input);
}

/**
 * Safely parses Network Effects input, returning result object
 */
export function safeParseNetworkEffectsInput(input: unknown) {
  return NetworkEffectsInputSchema.safeParse(input);
}

/**
 * Creates default Quick Win input with all default values
 */
export function getDefaultQuickWinInput(): QuickWinInput {
  return QuickWinInputSchema.parse({});
}

/**
 * Creates default Network Effects input with all default values
 */
export function getDefaultNetworkEffectsInput(): NetworkEffectsInput {
  return NetworkEffectsInputSchema.parse({});
}

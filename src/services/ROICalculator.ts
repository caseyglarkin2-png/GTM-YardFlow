/**
 * ROI Calculator Service - YardFlow Hub
 * 
 * Implements deterministic ROI calculations for:
 * 1. Quick Win (single-facility baseline savings)
 * 2. Network Effects (multi-facility adoption value)
 * 
 * All formulas are documented in /src/config/roiFormulas.md
 * NO AI involvement - pure arithmetic for auditability.
 */

import {
  QuickWinInput,
  QuickWinOutput,
  NetworkEffectsInput,
  NetworkEffectsOutput,
  ROIReport,
  ROI_CONSTANTS,
  parseQuickWinInput,
  parseNetworkEffectsInput,
} from '../types/roi';

// ============================================
// Quick Win Calculator
// ============================================

/**
 * Calculate Quick Win ROI (single-facility baseline savings)
 * 
 * Includes:
 * - Paper savings (digitization)
 * - Labor savings (process efficiency)
 * - Detention savings (carrier cost avoidance)
 * 
 * @param input - Validated QuickWinInput object
 * @returns QuickWinOutput with all savings broken down
 */
export function calculateQuickWin(input: QuickWinInput): QuickWinOutput {
  // Validate input through Zod schema
  const validInput = parseQuickWinInput(input);
  
  const {
    shipmentsPerMonth,
    detentionRatePercent,
    avgDetentionCost,
    hourlyLaborRate,
    palletsPerMonth,
  } = validInput;
  
  const {
    PAPER_COST_PER_PALLET,
    MINUTES_SAVED_PER_SHIPMENT,
    REDUCTION_RATE,
    MONTHS_PER_YEAR,
  } = ROI_CONSTANTS;
  
  // 1. Paper Savings (Digitization)
  // Eliminates paper-based check-in/check-out, BOL handling, and manual logging
  const paperSavingsMonthly = palletsPerMonth * PAPER_COST_PER_PALLET;
  const paperSavingsAnnual = paperSavingsMonthly * MONTHS_PER_YEAR;
  
  // 2. Labor Savings (Process Efficiency)
  // Reduces manual coordination, radio calls, and yard checks
  const minuteRate = hourlyLaborRate / 60;
  const laborSavingsMonthly = shipmentsPerMonth * MINUTES_SAVED_PER_SHIPMENT * minuteRate;
  const laborSavingsAnnual = laborSavingsMonthly * MONTHS_PER_YEAR;
  
  // 3. Detention Savings (Carrier Cost Avoidance)
  // Reduces detention charges through better visibility and proactive alerts
  const detentionRate = detentionRatePercent / 100;
  const currentDetentionCostMonthly = shipmentsPerMonth * detentionRate * avgDetentionCost;
  const detentionSavingsMonthly = currentDetentionCostMonthly * REDUCTION_RATE;
  const detentionSavingsAnnual = detentionSavingsMonthly * MONTHS_PER_YEAR;
  
  // 4. Totals
  const totalMonthly = paperSavingsMonthly + laborSavingsMonthly + detentionSavingsMonthly;
  const totalAnnual = totalMonthly * MONTHS_PER_YEAR;
  
  return {
    paperSavingsMonthly: roundToTwoDecimals(paperSavingsMonthly),
    paperSavingsAnnual: roundToTwoDecimals(paperSavingsAnnual),
    laborSavingsMonthly: roundToTwoDecimals(laborSavingsMonthly),
    laborSavingsAnnual: roundToTwoDecimals(laborSavingsAnnual),
    detentionSavingsMonthly: roundToTwoDecimals(detentionSavingsMonthly),
    detentionSavingsAnnual: roundToTwoDecimals(detentionSavingsAnnual),
    totalMonthly: roundToTwoDecimals(totalMonthly),
    totalAnnual: roundToTwoDecimals(totalAnnual),
    calculatedAt: new Date().toISOString(),
    inputSnapshot: validInput,
  };
}

// ============================================
// Network Effects Calculator
// ============================================

/**
 * Calculate Network Effects ROI (multi-facility adoption value)
 * 
 * Includes:
 * - Network multiplier (logarithmic scale)
 * - Marginal network value
 * - Carrier benchmark savings
 * - Avoidable fines (late pickup fees)
 * 
 * @param input - Validated NetworkEffectsInput object
 * @returns NetworkEffectsOutput with all value components
 */
export function calculateNetworkEffects(input: NetworkEffectsInput): NetworkEffectsOutput {
  // Validate input through Zod schema
  const validInput = parseNetworkEffectsInput(input);
  
  const {
    facilityCount,
    baseValuePerFacility,
    shipmentVolume,
    slowDriverPercent,
    avgDelayMinutes,
    latePickupRatePercent,
    avgLateFee,
    hourlyLaborRate,
  } = validInput;
  
  const {
    REDUCTION_RATE,
    MONTHS_PER_YEAR,
  } = ROI_CONSTANTS;
  
  // 1. Network Multiplier (Logarithmic Scale)
  // Value increases with facility count due to shared learning, carrier benchmarking
  const networkMultiplier = 1 + (Math.log(facilityCount) / 10);
  
  // 2. Marginal Network Value
  // Total value considering network effects multiplier
  const marginalValueAnnual = baseValuePerFacility * facilityCount * networkMultiplier;
  
  // 3. Carrier Benchmark Savings
  // Identifies and addresses bottom-quartile carrier/driver performance
  const slowDriverRate = slowDriverPercent / 100;
  const slowDriverShipments = shipmentVolume * slowDriverRate;
  const wastedMinutes = slowDriverShipments * avgDelayMinutes;
  const minuteRate = hourlyLaborRate / 60;
  const carrierBenchmarkSavingsMonthly = wastedMinutes * minuteRate;
  const carrierBenchmarkSavingsAnnual = carrierBenchmarkSavingsMonthly * MONTHS_PER_YEAR;
  
  // 4. Avoidable Fines (Late Pickup Fees)
  // Proactive alerts and coordination reduce late pickups
  const latePickupRate = latePickupRatePercent / 100;
  const latePickupEvents = shipmentVolume * latePickupRate;
  const avoidableFinesMonthly = latePickupEvents * avgLateFee * REDUCTION_RATE;
  const avoidableFinesAnnual = avoidableFinesMonthly * MONTHS_PER_YEAR;
  
  // 5. Total Network Effects Value
  const totalNetworkValueAnnual = marginalValueAnnual + carrierBenchmarkSavingsAnnual + avoidableFinesAnnual;
  
  return {
    networkMultiplier: roundToFourDecimals(networkMultiplier),
    marginalValueAnnual: roundToTwoDecimals(marginalValueAnnual),
    carrierBenchmarkSavingsMonthly: roundToTwoDecimals(carrierBenchmarkSavingsMonthly),
    carrierBenchmarkSavingsAnnual: roundToTwoDecimals(carrierBenchmarkSavingsAnnual),
    avoidableFinesMonthly: roundToTwoDecimals(avoidableFinesMonthly),
    avoidableFinesAnnual: roundToTwoDecimals(avoidableFinesAnnual),
    totalNetworkValueAnnual: roundToTwoDecimals(totalNetworkValueAnnual),
    calculatedAt: new Date().toISOString(),
    inputSnapshot: validInput,
  };
}

// ============================================
// Payback Period Calculator
// ============================================

/**
 * Calculate payback period in months
 * 
 * @param totalAnnualSavings - Total annual savings from Quick Win or combined
 * @param facilitiesCount - Number of facilities
 * @returns Payback period in months
 */
export function calculatePaybackMonths(
  totalAnnualSavings: number,
  facilitiesCount: number = 1
): number {
  if (totalAnnualSavings <= 0) {
    return Infinity;
  }
  
  const implementationCost = facilitiesCount * ROI_CONSTANTS.IMPLEMENTATION_COST_PER_FACILITY;
  const monthlySavings = totalAnnualSavings / ROI_CONSTANTS.MONTHS_PER_YEAR;
  const paybackMonths = implementationCost / monthlySavings;
  
  return roundToOneDecimal(paybackMonths);
}

// ============================================
// Combined ROI Report Generator
// ============================================

/**
 * Generate a complete ROI report combining Quick Win and Network Effects
 * 
 * @param quickWinInput - Optional Quick Win input
 * @param networkEffectsInput - Optional Network Effects input
 * @param metadata - Optional report metadata (prospectId, prospectName, companyName)
 * @returns Complete ROI Report
 */
export function generateROIReport(
  quickWinInput?: QuickWinInput,
  networkEffectsInput?: NetworkEffectsInput,
  metadata?: {
    prospectId?: string;
    prospectName?: string;
    companyName?: string;
  }
): ROIReport {
  const now = new Date().toISOString();
  
  const quickWin = quickWinInput ? calculateQuickWin(quickWinInput) : undefined;
  const networkEffects = networkEffectsInput ? calculateNetworkEffects(networkEffectsInput) : undefined;
  
  // Calculate payback based on available data
  let paybackMonths: number | undefined;
  let implementationCost: number | undefined;
  
  if (quickWin) {
    const facilitiesCount = quickWinInput?.facilitiesCount ?? 1;
    implementationCost = facilitiesCount * ROI_CONSTANTS.IMPLEMENTATION_COST_PER_FACILITY;
    paybackMonths = calculatePaybackMonths(quickWin.totalAnnual, facilitiesCount);
  }
  
  return {
    id: crypto.randomUUID(),
    prospectId: metadata?.prospectId,
    prospectName: metadata?.prospectName,
    companyName: metadata?.companyName,
    quickWin,
    networkEffects,
    paybackMonths,
    implementationCost,
    createdAt: now,
    updatedAt: now,
    version: '1.0',
  };
}

// ============================================
// Formatting Utilities
// ============================================

/**
 * Format currency for display
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format large currency values (e.g., $1.2M)
 */
export function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return formatCurrency(value);
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format payback period for display
 */
export function formatPaybackPeriod(months: number): string {
  if (!isFinite(months)) {
    return 'N/A';
  }
  if (months < 1) {
    return '< 1 month';
  }
  if (months < 12) {
    return `${months.toFixed(1)} months`;
  }
  const years = months / 12;
  return `${years.toFixed(1)} years`;
}

// ============================================
// Internal Helpers
// ============================================

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundToFourDecimals(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

// ============================================
// DM Line Generator (for message integration)
// ============================================

/**
 * Generate a short ROI-based DM line (<=250 chars) for outreach
 * 
 * @param quickWin - Quick Win calculation output
 * @param companyName - Target company name
 * @returns Short DM line with ROI hook
 */
export function generateROIDMLine(
  quickWin: QuickWinOutput,
  companyName?: string
): string {
  const savings = formatCurrencyCompact(quickWin.totalAnnual);
  const companyRef = companyName ? `at ${companyName}` : 'at your facilities';
  
  // Template: "Based on {volume}, YardFlow could save {company} ~{savings}/yr in detention + yard labor. Worth a 15-min demo?"
  const line = `Based on your volume, YardFlow could save ${companyRef} ~${savings}/yr in detention + yard labor. Worth a 15-min demo?`;
  
  // Ensure <= 250 chars
  if (line.length <= 250) {
    return line;
  }
  
  // Fallback shorter version
  return `YardFlow could save you ~${savings}/yr in detention + yard labor. Worth 15 mins?`;
}

/**
 * Generate network effects pitch line
 */
export function generateNetworkDMLine(
  networkEffects: NetworkEffectsOutput,
  facilityCount: number
): string {
  const totalValue = formatCurrencyCompact(networkEffects.totalNetworkValueAnnual);
  const multiplier = `${(networkEffects.networkMultiplier * 100 - 100).toFixed(0)}%`;
  
  return `With ${facilityCount} facilities on YardFlow, you'd see a ${multiplier} network boost—that's ~${totalValue}/yr in total value. Let's map it out.`;
}

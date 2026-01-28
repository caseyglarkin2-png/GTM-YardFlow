/**
 * ROI Calculator Tests - YardFlow Hub
 * 
 * Tests for Quick Win and Network Effects calculators.
 * Validates formulas match specification in /src/config/roiFormulas.md
 */

import { describe, it, expect } from 'vitest';
import {
  calculateQuickWin,
  calculateNetworkEffects,
  calculatePaybackMonths,
  generateROIReport,
  formatCurrency,
  formatCurrencyCompact,
  formatPaybackPeriod,
  generateROIDMLine,
  generateNetworkDMLine,
} from '../../services/ROICalculator';
import {
  QuickWinInputSchema,
  NetworkEffectsInputSchema,
  ROI_CONSTANTS,
  getDefaultQuickWinInput,
  getDefaultNetworkEffectsInput,
  safeParseQuickWinInput,
  safeParseNetworkEffectsInput,
} from '../../types/roi';

describe('ROI Types & Schemas', () => {
  describe('QuickWinInputSchema', () => {
    it('should validate valid input', () => {
      const input = {
        facilitiesCount: 5,
        shipmentsPerMonth: 20000,
        avgDwellTimeMinutes: 60,
        detentionRatePercent: 3,
        avgDetentionCost: 200,
        hourlyLaborRate: 30,
        palletsPerMonth: 100000,
      };
      
      const result = QuickWinInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
    
    it('should apply defaults for missing fields', () => {
      const result = QuickWinInputSchema.parse({});
      
      expect(result.facilitiesCount).toBe(1);
      expect(result.shipmentsPerMonth).toBe(10000);
      expect(result.avgDwellTimeMinutes).toBe(45);
      expect(result.detentionRatePercent).toBe(2);
      expect(result.avgDetentionCost).toBe(150);
      expect(result.hourlyLaborRate).toBe(25);
      expect(result.palletsPerMonth).toBe(50000);
    });
    
    it('should reject out-of-range values', () => {
      const invalidInputs = [
        { facilitiesCount: 0 },        // Min 1
        { facilitiesCount: 501 },      // Max 500
        { shipmentsPerMonth: -1 },     // Min 0
        { detentionRatePercent: 25 },  // Max 20
        { hourlyLaborRate: 5 },        // Min 10
      ];
      
      invalidInputs.forEach((input) => {
        const result = safeParseQuickWinInput(input);
        expect(result.success).toBe(false);
      });
    });
  });
  
  describe('NetworkEffectsInputSchema', () => {
    it('should validate valid input', () => {
      const input = {
        facilityCount: 25,
        baseValuePerFacility: 100000,
        shipmentVolume: 500000,
        slowDriverPercent: 10,
        avgDelayMinutes: 5,
        latePickupRatePercent: 2,
        avgLateFee: 500,
        hourlyLaborRate: 25,
      };
      
      const result = NetworkEffectsInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
    
    it('should apply defaults for missing fields', () => {
      const result = NetworkEffectsInputSchema.parse({});
      
      expect(result.facilityCount).toBe(5);
      expect(result.baseValuePerFacility).toBe(100000);
      expect(result.shipmentVolume).toBe(100000);
      expect(result.slowDriverPercent).toBe(10);
    });
  });
});

describe('Quick Win Calculator', () => {
  it('should calculate paper savings correctly', () => {
    const input = getDefaultQuickWinInput();
    const result = calculateQuickWin(input);
    
    // Paper savings = pallets × $0.50
    const expectedMonthly = 50000 * 0.50; // $25,000
    expect(result.paperSavingsMonthly).toBe(expectedMonthly);
    expect(result.paperSavingsAnnual).toBe(expectedMonthly * 12);
  });
  
  it('should calculate labor savings correctly', () => {
    const input = getDefaultQuickWinInput();
    const result = calculateQuickWin(input);
    
    // Labor = shipments × 2 min × ($25/60)
    const expectedMonthly = 10000 * 2 * (25 / 60); // ~$8,333.33
    expect(result.laborSavingsMonthly).toBeCloseTo(expectedMonthly, 2);
  });
  
  it('should calculate detention savings correctly', () => {
    const input = getDefaultQuickWinInput();
    const result = calculateQuickWin(input);
    
    // Detention = shipments × rate × cost × 50%
    const expectedMonthly = 10000 * 0.02 * 150 * 0.50; // $1,500
    expect(result.detentionSavingsMonthly).toBe(expectedMonthly);
  });
  
  it('should match spec example calculation', () => {
    // Example from roiFormulas.md
    const input = {
      facilitiesCount: 1,
      shipmentsPerMonth: 10000,
      avgDwellTimeMinutes: 45,
      detentionRatePercent: 2,
      avgDetentionCost: 150,
      hourlyLaborRate: 25,
      palletsPerMonth: 50000,
    };
    
    const result = calculateQuickWin(input);
    
    // Expected from spec (corrected):
    // Paper: $25,000/mo = $300,000/yr
    // Labor: $8,333/mo = $100,000/yr
    // Detention: 10,000 × 2% × $150 × 50% = $15,000/mo = $180,000/yr
    // Total: ~$580,000/yr
    
    expect(result.paperSavingsAnnual).toBe(300000);
    expect(result.laborSavingsAnnual).toBeCloseTo(100000, 0);
    expect(result.detentionSavingsAnnual).toBe(180000);
    expect(result.totalAnnual).toBeCloseTo(580000, 0);
  });
  
  it('should include input snapshot in output', () => {
    const input = getDefaultQuickWinInput();
    const result = calculateQuickWin(input);
    
    expect(result.inputSnapshot).toEqual(input);
    expect(result.calculatedAt).toBeDefined();
  });
  
  it('should handle zero inputs gracefully', () => {
    const input = {
      ...getDefaultQuickWinInput(),
      shipmentsPerMonth: 0,
      palletsPerMonth: 0,
    };
    
    const result = calculateQuickWin(input);
    
    expect(result.paperSavingsMonthly).toBe(0);
    expect(result.laborSavingsMonthly).toBe(0);
    expect(result.detentionSavingsMonthly).toBe(0);
    expect(result.totalAnnual).toBe(0);
  });
});

describe('Network Effects Calculator', () => {
  it('should calculate network multiplier correctly', () => {
    // Formula: 1 + ln(facilityCount) / 10
    const testCases = [
      { facilityCount: 1, expected: 1.0 },
      { facilityCount: 5, expected: 1.1609 },
      { facilityCount: 10, expected: 1.2303 },
      { facilityCount: 25, expected: 1.3219 },
      { facilityCount: 100, expected: 1.4605 },
    ];
    
    testCases.forEach(({ facilityCount, expected }) => {
      const input = { ...getDefaultNetworkEffectsInput(), facilityCount };
      const result = calculateNetworkEffects(input);
      expect(result.networkMultiplier).toBeCloseTo(expected, 3);
    });
  });
  
  it('should calculate carrier benchmark savings correctly', () => {
    const input = getDefaultNetworkEffectsInput();
    const result = calculateNetworkEffects(input);
    
    // slowDriverShipments = 100,000 × 10% = 10,000
    // wastedMinutes = 10,000 × 5 = 50,000
    // monthly = 50,000 × ($25/60) = $20,833.33
    const expectedMonthly = 100000 * 0.10 * 5 * (25 / 60);
    expect(result.carrierBenchmarkSavingsMonthly).toBeCloseTo(expectedMonthly, 2);
  });
  
  it('should calculate avoidable fines correctly', () => {
    const input = getDefaultNetworkEffectsInput();
    const result = calculateNetworkEffects(input);
    
    // latePickups = 100,000 × 2% = 2,000
    // monthly = 2,000 × $500 × 50% = $500,000
    const expectedMonthly = 100000 * 0.02 * 500 * 0.50;
    expect(result.avoidableFinesMonthly).toBe(expectedMonthly);
  });
  
  it('should match spec example calculation (Primo scale)', () => {
    const input = {
      facilityCount: 25,
      baseValuePerFacility: 100000,
      shipmentVolume: 500000,
      slowDriverPercent: 10,
      avgDelayMinutes: 5,
      latePickupRatePercent: 2,
      avgLateFee: 500,
      hourlyLaborRate: 25,
    };
    
    const result = calculateNetworkEffects(input);
    
    // Expected from spec (corrected):
    // Multiplier: 1.32
    // Marginal: $100K × 25 × 1.32 = $3.3M
    // Carrier benchmark: ~$1.25M/yr
    // Avoidable fines: 500K × 2% × $500 × 0.5 × 12 = $30M/yr
    // Total: ~$34.55M/yr
    
    expect(result.networkMultiplier).toBeCloseTo(1.32, 1);
    expect(result.marginalValueAnnual).toBeCloseTo(3300000, -4);
    expect(result.carrierBenchmarkSavingsAnnual).toBeCloseTo(1250000, -4);
    expect(result.avoidableFinesAnnual).toBeCloseTo(30000000, -4);
    expect(result.totalNetworkValueAnnual).toBeCloseTo(34550000, -4);
  });
});

describe('Payback Period Calculator', () => {
  it('should calculate payback months correctly', () => {
    // $600K/yr savings, 1 facility @ $50K implementation
    const payback = calculatePaybackMonths(600000, 1);
    
    // Monthly savings = $50K, cost = $50K, payback = 1 month
    expect(payback).toBe(1);
  });
  
  it('should scale with facility count', () => {
    // 5 facilities @ $50K each = $250K implementation
    // $500K/yr = ~$41.7K/mo, payback = ~6 months
    const payback = calculatePaybackMonths(500000, 5);
    expect(payback).toBe(6);
  });
  
  it('should return Infinity for zero savings', () => {
    const payback = calculatePaybackMonths(0, 1);
    expect(payback).toBe(Infinity);
  });
  
  it('should return Infinity for negative savings', () => {
    const payback = calculatePaybackMonths(-10000, 1);
    expect(payback).toBe(Infinity);
  });
});

describe('ROI Report Generator', () => {
  it('should generate complete report with both calculators', () => {
    const quickWinInput = getDefaultQuickWinInput();
    const networkEffectsInput = getDefaultNetworkEffectsInput();
    
    const report = generateROIReport(quickWinInput, networkEffectsInput, {
      prospectId: 'test-123',
      prospectName: 'John Doe',
      companyName: 'Test Corp',
    });
    
    expect(report.id).toBeDefined();
    expect(report.prospectId).toBe('test-123');
    expect(report.prospectName).toBe('John Doe');
    expect(report.companyName).toBe('Test Corp');
    expect(report.quickWin).toBeDefined();
    expect(report.networkEffects).toBeDefined();
    expect(report.paybackMonths).toBeDefined();
    expect(report.version).toBe('1.0');
  });
  
  it('should work with only Quick Win input', () => {
    const report = generateROIReport(getDefaultQuickWinInput());
    
    expect(report.quickWin).toBeDefined();
    expect(report.networkEffects).toBeUndefined();
    expect(report.paybackMonths).toBeDefined();
  });
  
  it('should work with only Network Effects input', () => {
    const report = generateROIReport(undefined, getDefaultNetworkEffectsInput());
    
    expect(report.quickWin).toBeUndefined();
    expect(report.networkEffects).toBeDefined();
    expect(report.paybackMonths).toBeUndefined();
  });
});

describe('Formatting Utilities', () => {
  it('should format currency correctly', () => {
    expect(formatCurrency(1234.56)).toBe('$1,235');
    expect(formatCurrency(1000000)).toBe('$1,000,000');
    expect(formatCurrency(0)).toBe('$0');
  });
  
  it('should format compact currency correctly', () => {
    expect(formatCurrencyCompact(500)).toBe('$500');
    expect(formatCurrencyCompact(5000)).toBe('$5K');
    expect(formatCurrencyCompact(1500000)).toBe('$1.5M');
    expect(formatCurrencyCompact(7500000)).toBe('$7.5M');
  });
  
  it('should format payback period correctly', () => {
    expect(formatPaybackPeriod(0.5)).toBe('< 1 month');
    expect(formatPaybackPeriod(6)).toBe('6.0 months');
    expect(formatPaybackPeriod(18)).toBe('1.5 years');
    expect(formatPaybackPeriod(Infinity)).toBe('N/A');
  });
});

describe('DM Line Generators', () => {
  it('should generate Quick Win DM line under 250 chars', () => {
    const quickWin = calculateQuickWin(getDefaultQuickWinInput());
    const dmLine = generateROIDMLine(quickWin, 'Acme Corp');
    
    expect(dmLine.length).toBeLessThanOrEqual(250);
    expect(dmLine).toContain('Acme Corp');
    expect(dmLine).toContain('/yr');
  });
  
  it('should handle missing company name', () => {
    const quickWin = calculateQuickWin(getDefaultQuickWinInput());
    const dmLine = generateROIDMLine(quickWin);
    
    expect(dmLine.length).toBeLessThanOrEqual(250);
    expect(dmLine).toContain('your facilities');
  });
  
  it('should generate Network Effects DM line', () => {
    const networkEffects = calculateNetworkEffects(getDefaultNetworkEffectsInput());
    const dmLine = generateNetworkDMLine(networkEffects, 5);
    
    expect(dmLine.length).toBeLessThanOrEqual(250);
    expect(dmLine).toContain('5 facilities');
    expect(dmLine).toContain('network boost');
  });
});

describe('ROI Constants', () => {
  it('should have correct constant values', () => {
    expect(ROI_CONSTANTS.PAPER_COST_PER_PALLET).toBe(0.50);
    expect(ROI_CONSTANTS.MINUTES_SAVED_PER_SHIPMENT).toBe(2);
    expect(ROI_CONSTANTS.REDUCTION_RATE).toBe(0.50);
    expect(ROI_CONSTANTS.DEFAULT_LABOR_RATE).toBe(25);
    expect(ROI_CONSTANTS.IMPLEMENTATION_COST_PER_FACILITY).toBe(50000);
    expect(ROI_CONSTANTS.MONTHS_PER_YEAR).toBe(12);
  });
});

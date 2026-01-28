/**
 * ROI Tab Component - YardFlow Hub
 * 
 * Provides the ROI Calculator UI with:
 * - Quick Win Calculator (single-facility baseline)
 * - Network Effects Calculator (multi-facility adoption)
 * - Results visualization
 * - Export and DM generation
 */

import { useCallback } from 'react';
import { Calculator, TrendingUp, Download, MessageSquare, RotateCcw, Building2 } from 'lucide-react';
import { useROI, formatCurrency, formatCurrencyCompact } from '../hooks/useROI';
import { generateROIDMLine, generateNetworkDMLine } from '../services/ROICalculator';
import type { QuickWinInput, QuickWinOutput, NetworkEffectsInput, NetworkEffectsOutput } from '../types/roi';
import type { Prospect } from '../types';

interface ROITabProps {
  selectedProspect: Prospect | null;
  onGenerateDM?: (dmText: string) => void;
}

export function ROITab({ selectedProspect, onGenerateDM }: ROITabProps) {
  const [state, actions] = useROI();
  
  const {
    quickWinInput,
    networkEffectsInput,
    quickWinOutput,
    networkEffectsOutput,
    activeCalculator,
    validationErrors,
    isCalculating,
  } = state;
  
  // Handle calculation
  const handleCalculate = useCallback(() => {
    if (activeCalculator === 'quickWin') {
      actions.calculateQuickWinROI();
    } else {
      actions.calculateNetworkROI();
    }
  }, [activeCalculator, actions]);
  
  // Handle reset
  const handleReset = useCallback(() => {
    if (activeCalculator === 'quickWin') {
      actions.resetQuickWinInput();
    } else {
      actions.resetNetworkInput();
    }
  }, [activeCalculator, actions]);
  
  // Handle prefill from prospect
  const handlePrefill = useCallback(() => {
    if (selectedProspect) {
      actions.prefillFromProspect(selectedProspect);
    }
  }, [selectedProspect, actions]);
  
  // Handle DM generation
  const handleGenerateDM = useCallback(() => {
    let dmLine = '';
    if (activeCalculator === 'quickWin' && quickWinOutput) {
      dmLine = generateROIDMLine(quickWinOutput, selectedProspect?.company);
    } else if (activeCalculator === 'networkEffects' && networkEffectsOutput) {
      dmLine = generateNetworkDMLine(networkEffectsOutput, networkEffectsInput.facilityCount);
    }
    if (dmLine && onGenerateDM) {
      onGenerateDM(dmLine);
    }
  }, [activeCalculator, quickWinOutput, networkEffectsOutput, networkEffectsInput.facilityCount, selectedProspect, onGenerateDM]);
  
  // Handle export
  const handleExport = useCallback(() => {
    const report = actions.generateReport({
      prospectId: selectedProspect?.id,
      prospectName: selectedProspect?.name,
      companyName: selectedProspect?.company,
    });
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roi-report-${report.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [actions, selectedProspect]);
  
  // Get error for field
  const getFieldError = (field: string) => {
    return validationErrors.find(e => e.field === field)?.message;
  };
  
  return (
    <div className="h-full flex flex-col bg-slate-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">ROI Calculator</h2>
        </div>
        
        {/* Calculator Toggle */}
        <div className="flex bg-slate-700 rounded-lg p-1">
          <button
            onClick={() => actions.setActiveCalculator('quickWin')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeCalculator === 'quickWin'
                ? 'bg-emerald-500 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Quick Win
          </button>
          <button
            onClick={() => actions.setActiveCalculator('networkEffects')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeCalculator === 'networkEffects'
                ? 'bg-emerald-500 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Network Effects
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeCalculator === 'quickWin' ? (
          <QuickWinForm
            input={quickWinInput}
            onFieldChange={actions.setQuickWinField}
            getFieldError={getFieldError}
          />
        ) : (
          <NetworkEffectsForm
            input={networkEffectsInput}
            onFieldChange={actions.setNetworkField}
            getFieldError={getFieldError}
          />
        )}
        
        {/* Results */}
        {(quickWinOutput && activeCalculator === 'quickWin') && (
          <QuickWinResults output={quickWinOutput} />
        )}
        
        {(networkEffectsOutput && activeCalculator === 'networkEffects') && (
          <NetworkEffectsResults output={networkEffectsOutput} />
        )}
        
        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400 font-medium mb-1">Validation Errors:</p>
            <ul className="text-sm text-red-300 list-disc list-inside">
              {validationErrors.map((err, i) => (
                <li key={i}>{err.field}: {err.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-t border-slate-700">
        {selectedProspect && (
          <button
            onClick={handlePrefill}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Prefill
          </button>
        )}
        
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
        
        <div className="flex-1" />
        
        <button
          onClick={handleExport}
          disabled={!quickWinOutput && !networkEffectsOutput}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
        
        <button
          onClick={handleGenerateDM}
          disabled={(!quickWinOutput && activeCalculator === 'quickWin') || (!networkEffectsOutput && activeCalculator === 'networkEffects')}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MessageSquare className="w-4 h-4" />
          DM Line
        </button>
        
        <button
          onClick={handleCalculate}
          disabled={isCalculating}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded transition-colors disabled:opacity-50"
        >
          <TrendingUp className="w-4 h-4" />
          {isCalculating ? 'Calculating...' : 'Calculate'}
        </button>
      </div>
    </div>
  );
}

// ============================================
// Quick Win Form Component
// ============================================

interface QuickWinFormProps {
  input: QuickWinInput;
  onFieldChange: <K extends keyof QuickWinInput>(field: K, value: QuickWinInput[K]) => void;
  getFieldError: (field: string) => string | undefined;
}

function QuickWinForm({ input, onFieldChange, getFieldError }: QuickWinFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputField
          label="Facilities"
          value={input.facilitiesCount}
          onChange={(v) => onFieldChange('facilitiesCount', v)}
          error={getFieldError('facilitiesCount')}
          min={1}
          max={500}
          step={1}
        />
        <InputField
          label="Shipments / Month"
          value={input.shipmentsPerMonth}
          onChange={(v) => onFieldChange('shipmentsPerMonth', v)}
          error={getFieldError('shipmentsPerMonth')}
          min={0}
          max={1000000}
          step={1000}
        />
        <InputField
          label="Avg Dwell (min)"
          value={input.avgDwellTimeMinutes}
          onChange={(v) => onFieldChange('avgDwellTimeMinutes', v)}
          error={getFieldError('avgDwellTimeMinutes')}
          min={0}
          max={480}
          step={5}
        />
        <InputField
          label="Detention Rate (%)"
          value={input.detentionRatePercent}
          onChange={(v) => onFieldChange('detentionRatePercent', v)}
          error={getFieldError('detentionRatePercent')}
          min={0}
          max={20}
          step={0.5}
        />
        <InputField
          label="Avg Detention Cost ($)"
          value={input.avgDetentionCost}
          onChange={(v) => onFieldChange('avgDetentionCost', v)}
          error={getFieldError('avgDetentionCost')}
          min={0}
          max={1000}
          step={25}
          prefix="$"
        />
        <InputField
          label="Hourly Labor Rate ($)"
          value={input.hourlyLaborRate}
          onChange={(v) => onFieldChange('hourlyLaborRate', v)}
          error={getFieldError('hourlyLaborRate')}
          min={10}
          max={100}
          step={5}
          prefix="$"
        />
        <InputField
          label="Pallets / Month"
          value={input.palletsPerMonth}
          onChange={(v) => onFieldChange('palletsPerMonth', v)}
          error={getFieldError('palletsPerMonth')}
          min={0}
          max={10000000}
          step={10000}
          className="col-span-2"
        />
      </div>
    </div>
  );
}

// ============================================
// Network Effects Form Component
// ============================================

interface NetworkEffectsFormProps {
  input: NetworkEffectsInput;
  onFieldChange: <K extends keyof NetworkEffectsInput>(field: K, value: NetworkEffectsInput[K]) => void;
  getFieldError: (field: string) => string | undefined;
}

function NetworkEffectsForm({ input, onFieldChange, getFieldError }: NetworkEffectsFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InputField
          label="Facility Count"
          value={input.facilityCount}
          onChange={(v) => onFieldChange('facilityCount', v)}
          error={getFieldError('facilityCount')}
          min={1}
          max={500}
          step={1}
        />
        <InputField
          label="Base Value / Facility ($)"
          value={input.baseValuePerFacility}
          onChange={(v) => onFieldChange('baseValuePerFacility', v)}
          error={getFieldError('baseValuePerFacility')}
          min={0}
          max={10000000}
          step={10000}
          prefix="$"
        />
        <InputField
          label="Total Shipments / Month"
          value={input.shipmentVolume}
          onChange={(v) => onFieldChange('shipmentVolume', v)}
          error={getFieldError('shipmentVolume')}
          min={0}
          max={10000000}
          step={10000}
        />
        <InputField
          label="Slow Driver %"
          value={input.slowDriverPercent}
          onChange={(v) => onFieldChange('slowDriverPercent', v)}
          error={getFieldError('slowDriverPercent')}
          min={0}
          max={50}
          step={1}
        />
        <InputField
          label="Avg Delay (min)"
          value={input.avgDelayMinutes}
          onChange={(v) => onFieldChange('avgDelayMinutes', v)}
          error={getFieldError('avgDelayMinutes')}
          min={0}
          max={60}
          step={1}
        />
        <InputField
          label="Late Pickup Rate (%)"
          value={input.latePickupRatePercent}
          onChange={(v) => onFieldChange('latePickupRatePercent', v)}
          error={getFieldError('latePickupRatePercent')}
          min={0}
          max={10}
          step={0.5}
        />
        <InputField
          label="Avg Late Fee ($)"
          value={input.avgLateFee}
          onChange={(v) => onFieldChange('avgLateFee', v)}
          error={getFieldError('avgLateFee')}
          min={0}
          max={2000}
          step={50}
          prefix="$"
        />
        <InputField
          label="Hourly Labor Rate ($)"
          value={input.hourlyLaborRate}
          onChange={(v) => onFieldChange('hourlyLaborRate', v)}
          error={getFieldError('hourlyLaborRate')}
          min={10}
          max={100}
          step={5}
          prefix="$"
        />
      </div>
    </div>
  );
}

// ============================================
// Results Components
// ============================================

interface QuickWinResultsProps {
  output: QuickWinOutput;
}

function QuickWinResults({ output }: QuickWinResultsProps) {
  return (
    <div className="mt-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
      <h3 className="text-sm font-medium text-slate-300 mb-3">Quick Win Savings</h3>
      
      <div className="space-y-3">
        <ResultRow label="Paper Savings" monthly={output.paperSavingsMonthly} annual={output.paperSavingsAnnual} />
        <ResultRow label="Labor Savings" monthly={output.laborSavingsMonthly} annual={output.laborSavingsAnnual} />
        <ResultRow label="Detention Savings" monthly={output.detentionSavingsMonthly} annual={output.detentionSavingsAnnual} />
        
        <div className="border-t border-slate-600 pt-3 mt-3">
          <div className="flex items-center justify-between">
            <span className="text-white font-medium">Total Savings</span>
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-400">
                {formatCurrencyCompact(output.totalAnnual)}<span className="text-sm text-slate-400">/yr</span>
              </div>
              <div className="text-sm text-slate-400">
                {formatCurrency(output.totalMonthly)}/mo
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface NetworkEffectsResultsProps {
  output: NetworkEffectsOutput;
}

function NetworkEffectsResults({ output }: NetworkEffectsResultsProps) {
  return (
    <div className="mt-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
      <h3 className="text-sm font-medium text-slate-300 mb-3">Network Effects Value</h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Network Multiplier</span>
          <span className="text-white font-medium">{output.networkMultiplier.toFixed(2)}x</span>
        </div>
        
        <ResultRow label="Marginal Value" annual={output.marginalValueAnnual} />
        <ResultRow label="Carrier Benchmark" monthly={output.carrierBenchmarkSavingsMonthly} annual={output.carrierBenchmarkSavingsAnnual} />
        <ResultRow label="Avoidable Fines" monthly={output.avoidableFinesMonthly} annual={output.avoidableFinesAnnual} />
        
        <div className="border-t border-slate-600 pt-3 mt-3">
          <div className="flex items-center justify-between">
            <span className="text-white font-medium">Total Network Value</span>
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-400">
                {formatCurrencyCompact(output.totalNetworkValueAnnual)}<span className="text-sm text-slate-400">/yr</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Shared Components
// ============================================

interface InputFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  className?: string;
}

function InputField({ label, value, onChange, error, min, max, step, prefix, className }: InputFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{prefix}</span>
        )}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          className={`w-full bg-slate-700 text-white rounded px-3 py-2 text-sm border ${
            error ? 'border-red-500' : 'border-slate-600'
          } focus:border-emerald-500 focus:outline-none ${prefix ? 'pl-7' : ''}`}
        />
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

interface ResultRowProps {
  label: string;
  monthly?: number;
  annual: number;
}

function ResultRow({ label, monthly, annual }: ResultRowProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <div className="text-right">
        <span className="text-white">{formatCurrency(annual)}/yr</span>
        {monthly !== undefined && (
          <span className="text-slate-500 text-xs ml-2">({formatCurrency(monthly)}/mo)</span>
        )}
      </div>
    </div>
  );
}

export default ROITab;

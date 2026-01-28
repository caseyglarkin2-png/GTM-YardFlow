/**
 * ROI Hook - YardFlow Hub
 * 
 * React hook for managing ROI calculator state, including:
 * - Input management with validation
 * - Calculation execution
 * - Report generation
 * - Prospect data prefilling
 * - Local storage persistence
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  QuickWinInput,
  QuickWinOutput,
  NetworkEffectsInput,
  NetworkEffectsOutput,
  ROIReport,
  getDefaultQuickWinInput,
  getDefaultNetworkEffectsInput,
  safeParseQuickWinInput,
  safeParseNetworkEffectsInput,
} from '../types/roi';
import {
  calculateQuickWin,
  calculateNetworkEffects,
  generateROIReport,
  formatCurrency,
  formatCurrencyCompact,
  formatPaybackPeriod,
} from '../services/ROICalculator';
import type { Prospect } from '../types';

// ============================================
// Storage Keys
// ============================================

const STORAGE_KEY_QUICK_WIN = 'yardflow_roi_quick_win_input';
const STORAGE_KEY_NETWORK = 'yardflow_roi_network_input';
const STORAGE_KEY_REPORTS = 'yardflow_roi_reports';

// ============================================
// Types
// ============================================

export interface ROIValidationError {
  field: string;
  message: string;
}

export interface ROIHookState {
  // Inputs
  quickWinInput: QuickWinInput;
  networkEffectsInput: NetworkEffectsInput;
  
  // Outputs (calculated on demand)
  quickWinOutput: QuickWinOutput | null;
  networkEffectsOutput: NetworkEffectsOutput | null;
  
  // Reports
  currentReport: ROIReport | null;
  savedReports: ROIReport[];
  
  // UI State
  activeCalculator: 'quickWin' | 'networkEffects';
  validationErrors: ROIValidationError[];
  isCalculating: boolean;
}

export interface ROIHookActions {
  // Input setters
  setQuickWinField: <K extends keyof QuickWinInput>(field: K, value: QuickWinInput[K]) => void;
  setNetworkField: <K extends keyof NetworkEffectsInput>(field: K, value: NetworkEffectsInput[K]) => void;
  resetQuickWinInput: () => void;
  resetNetworkInput: () => void;
  
  // Calculator actions
  calculateQuickWinROI: () => QuickWinOutput | null;
  calculateNetworkROI: () => NetworkEffectsOutput | null;
  
  // Report actions
  generateReport: (metadata?: { prospectId?: string; prospectName?: string; companyName?: string }) => ROIReport;
  saveReport: (report: ROIReport) => void;
  deleteReport: (reportId: string) => void;
  loadReport: (reportId: string) => ROIReport | null;
  
  // Prefill actions
  prefillFromProspect: (prospect: Prospect) => void;
  
  // UI actions
  setActiveCalculator: (calc: 'quickWin' | 'networkEffects') => void;
  clearErrors: () => void;
}

// ============================================
// Local Storage Helpers
// ============================================

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (e) {
    console.warn(`Failed to load ${key} from storage:`, e);
  }
  return defaultValue;
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to save ${key} to storage:`, e);
  }
}

// ============================================
// Hook Implementation
// ============================================

export function useROI(): [ROIHookState, ROIHookActions] {
  // Initialize state from localStorage or defaults
  const [quickWinInput, setQuickWinInput] = useState<QuickWinInput>(() =>
    loadFromStorage(STORAGE_KEY_QUICK_WIN, getDefaultQuickWinInput())
  );
  
  const [networkEffectsInput, setNetworkEffectsInput] = useState<NetworkEffectsInput>(() =>
    loadFromStorage(STORAGE_KEY_NETWORK, getDefaultNetworkEffectsInput())
  );
  
  const [quickWinOutput, setQuickWinOutput] = useState<QuickWinOutput | null>(null);
  const [networkEffectsOutput, setNetworkEffectsOutput] = useState<NetworkEffectsOutput | null>(null);
  
  const [currentReport, setCurrentReport] = useState<ROIReport | null>(null);
  const [savedReports, setSavedReports] = useState<ROIReport[]>(() =>
    loadFromStorage(STORAGE_KEY_REPORTS, [])
  );
  
  const [activeCalculator, setActiveCalculator] = useState<'quickWin' | 'networkEffects'>('quickWin');
  const [validationErrors, setValidationErrors] = useState<ROIValidationError[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  
  // Persist inputs to localStorage
  useEffect(() => {
    saveToStorage(STORAGE_KEY_QUICK_WIN, quickWinInput);
  }, [quickWinInput]);
  
  useEffect(() => {
    saveToStorage(STORAGE_KEY_NETWORK, networkEffectsInput);
  }, [networkEffectsInput]);
  
  useEffect(() => {
    saveToStorage(STORAGE_KEY_REPORTS, savedReports);
  }, [savedReports]);
  
  // ============================================
  // Input Setters
  // ============================================
  
  const setQuickWinField = useCallback(<K extends keyof QuickWinInput>(
    field: K,
    value: QuickWinInput[K]
  ) => {
    setQuickWinInput(prev => ({
      ...prev,
      [field]: value,
    }));
    // Clear validation errors for this field
    setValidationErrors(prev => prev.filter(e => e.field !== field));
  }, []);
  
  const setNetworkField = useCallback(<K extends keyof NetworkEffectsInput>(
    field: K,
    value: NetworkEffectsInput[K]
  ) => {
    setNetworkEffectsInput(prev => ({
      ...prev,
      [field]: value,
    }));
    setValidationErrors(prev => prev.filter(e => e.field !== field));
  }, []);
  
  const resetQuickWinInput = useCallback(() => {
    setQuickWinInput(getDefaultQuickWinInput());
    setQuickWinOutput(null);
    setValidationErrors([]);
  }, []);
  
  const resetNetworkInput = useCallback(() => {
    setNetworkEffectsInput(getDefaultNetworkEffectsInput());
    setNetworkEffectsOutput(null);
    setValidationErrors([]);
  }, []);
  
  // ============================================
  // Calculator Actions
  // ============================================
  
  const calculateQuickWinROI = useCallback((): QuickWinOutput | null => {
    setIsCalculating(true);
    setValidationErrors([]);
    
    const result = safeParseQuickWinInput(quickWinInput);
    
    if (!result.success) {
      const errors = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      setValidationErrors(errors);
      setIsCalculating(false);
      return null;
    }
    
    try {
      const output = calculateQuickWin(result.data);
      setQuickWinOutput(output);
      setIsCalculating(false);
      return output;
    } catch (e) {
      console.error('Quick Win calculation error:', e);
      setValidationErrors([{ field: 'general', message: 'Calculation failed. Please check your inputs.' }]);
      setIsCalculating(false);
      return null;
    }
  }, [quickWinInput]);
  
  const calculateNetworkROI = useCallback((): NetworkEffectsOutput | null => {
    setIsCalculating(true);
    setValidationErrors([]);
    
    const result = safeParseNetworkEffectsInput(networkEffectsInput);
    
    if (!result.success) {
      const errors = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      setValidationErrors(errors);
      setIsCalculating(false);
      return null;
    }
    
    try {
      const output = calculateNetworkEffects(result.data);
      setNetworkEffectsOutput(output);
      setIsCalculating(false);
      return output;
    } catch (e) {
      console.error('Network Effects calculation error:', e);
      setValidationErrors([{ field: 'general', message: 'Calculation failed. Please check your inputs.' }]);
      setIsCalculating(false);
      return null;
    }
  }, [networkEffectsInput]);
  
  // ============================================
  // Report Actions
  // ============================================
  
  const generateReportAction = useCallback((metadata?: {
    prospectId?: string;
    prospectName?: string;
    companyName?: string;
  }): ROIReport => {
    const report = generateROIReport(
      quickWinOutput ? quickWinInput : undefined,
      networkEffectsOutput ? networkEffectsInput : undefined,
      metadata
    );
    setCurrentReport(report);
    return report;
  }, [quickWinInput, networkEffectsInput, quickWinOutput, networkEffectsOutput]);
  
  const saveReport = useCallback((report: ROIReport) => {
    setSavedReports(prev => {
      // Replace if exists, otherwise add
      const index = prev.findIndex(r => r.id === report.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = { ...report, updatedAt: new Date().toISOString() };
        return updated;
      }
      return [...prev, report];
    });
  }, []);
  
  const deleteReport = useCallback((reportId: string) => {
    setSavedReports(prev => prev.filter(r => r.id !== reportId));
    if (currentReport?.id === reportId) {
      setCurrentReport(null);
    }
  }, [currentReport]);
  
  const loadReport = useCallback((reportId: string): ROIReport | null => {
    const report = savedReports.find(r => r.id === reportId);
    if (report) {
      setCurrentReport(report);
      // Restore inputs from report
      if (report.quickWin?.inputSnapshot) {
        setQuickWinInput(report.quickWin.inputSnapshot);
        setQuickWinOutput(report.quickWin);
      }
      if (report.networkEffects?.inputSnapshot) {
        setNetworkEffectsInput(report.networkEffects.inputSnapshot);
        setNetworkEffectsOutput(report.networkEffects);
      }
      return report;
    }
    return null;
  }, [savedReports]);
  
  // ============================================
  // Prefill Actions
  // ============================================
  
  const prefillFromProspect = useCallback((prospect: Prospect) => {
    // Prefill with reasonable estimates based on prospect data
    const companyInfo = prospect.company;
    
    // Estimate volume based on company tier or size
    let estimatedShipments = 10000; // default
    let estimatedFacilities = 1;
    let estimatedPallets = 50000;
    
    // Use tier to estimate volume if available
    if (companyInfo) {
      // Tier-based estimation
      const tierEstimates: Record<string, { shipments: number; facilities: number; pallets: number }> = {
        'Tier 1': { shipments: 50000, facilities: 10, pallets: 250000 },
        'Tier 2': { shipments: 25000, facilities: 5, pallets: 125000 },
        'Tier 3': { shipments: 10000, facilities: 2, pallets: 50000 },
        'Tier 4': { shipments: 5000, facilities: 1, pallets: 25000 },
      };
      
      // Try to match tier from prospect metadata
      const tier = (prospect as unknown as Record<string, unknown>)['tier'] as string | undefined;
      if (tier && tierEstimates[tier]) {
        const estimates = tierEstimates[tier];
        estimatedShipments = estimates.shipments;
        estimatedFacilities = estimates.facilities;
        estimatedPallets = estimates.pallets;
      }
    }
    
    setQuickWinInput(prev => ({
      ...prev,
      facilitiesCount: estimatedFacilities,
      shipmentsPerMonth: estimatedShipments,
      palletsPerMonth: estimatedPallets,
    }));
    
    setNetworkEffectsInput(prev => ({
      ...prev,
      facilityCount: estimatedFacilities,
      shipmentVolume: estimatedShipments * estimatedFacilities,
    }));
  }, []);
  
  // ============================================
  // UI Actions
  // ============================================
  
  const clearErrors = useCallback(() => {
    setValidationErrors([]);
  }, []);
  
  // ============================================
  // Build state and actions
  // ============================================
  
  const state: ROIHookState = useMemo(() => ({
    quickWinInput,
    networkEffectsInput,
    quickWinOutput,
    networkEffectsOutput,
    currentReport,
    savedReports,
    activeCalculator,
    validationErrors,
    isCalculating,
  }), [
    quickWinInput,
    networkEffectsInput,
    quickWinOutput,
    networkEffectsOutput,
    currentReport,
    savedReports,
    activeCalculator,
    validationErrors,
    isCalculating,
  ]);
  
  const actions: ROIHookActions = useMemo(() => ({
    setQuickWinField,
    setNetworkField,
    resetQuickWinInput,
    resetNetworkInput,
    calculateQuickWinROI,
    calculateNetworkROI,
    generateReport: generateReportAction,
    saveReport,
    deleteReport,
    loadReport,
    prefillFromProspect,
    setActiveCalculator,
    clearErrors,
  }), [
    setQuickWinField,
    setNetworkField,
    resetQuickWinInput,
    resetNetworkInput,
    calculateQuickWinROI,
    calculateNetworkROI,
    generateReportAction,
    saveReport,
    deleteReport,
    loadReport,
    prefillFromProspect,
    setActiveCalculator,
    clearErrors,
  ]);
  
  return [state, actions];
}

// ============================================
// Utility Exports
// ============================================

export {
  formatCurrency,
  formatCurrencyCompact,
  formatPaybackPeriod,
};

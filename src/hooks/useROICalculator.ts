import { useState, useEffect, useCallback } from 'react';
import { ROI_DEFAULTS } from '../config/roiDefaults';

export interface ROIState {
  facilities: number;
  marginPerFacility: number;
  networkEfficiencyGain: number;
}

const STORAGE_KEY = 'yardflow_roi_state';

const defaultState: ROIState = {
  facilities: ROI_DEFAULTS.FACILITIES,
  marginPerFacility: ROI_DEFAULTS.MARGIN_PER_FACILITY,
  networkEfficiencyGain: ROI_DEFAULTS.NETWORK_EFFICIENCY_GAIN,
};

export function useROICalculator() {
  // Initialize state from local storage or defaults
  const [state, setState] = useState<ROIState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load ROI state from local storage', e);
    }
    return defaultState;
  });

  // Persist state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save ROI state to local storage', e);
    }
  }, [state]);

  const setFacilities = useCallback((val: number) => {
    setState(s => ({ ...s, facilities: val }));
  }, []);

  const setMarginPerFacility = useCallback((val: number) => {
    setState(s => ({ ...s, marginPerFacility: val }));
  }, []);

  const setNetworkEfficiencyGain = useCallback((val: number) => {
    setState(s => ({ ...s, networkEfficiencyGain: val }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setState(defaultState);
  }, []);

  // Calculation Logic (Moved from Component)
  const calculations = useMemo(() => {
    const { facilities, marginPerFacility, networkEfficiencyGain } = state;

    const paperSavings = facilities * ROI_DEFAULTS.PAPER_SAVINGS_PER_FACILITY;
    const laborSavings = facilities * ROI_DEFAULTS.LABOR_SAVINGS_PER_FACILITY;
    
    const totalMargin = facilities * marginPerFacility;
    const networkSavings = totalMargin * (networkEfficiencyGain / 100);

    const chartData = [
      { 
        name: "Paper/SaaS", 
        value: paperSavings, 
        color: "#94a3b8",
        description: ROI_DEFAULTS.DESCRIPTIONS.PAPER 
      },
      { 
        name: "Labor Efficiency", 
        value: laborSavings, 
        color: "#60a5fa",
        description: ROI_DEFAULTS.DESCRIPTIONS.LABOR 
      },
      { 
        name: "Network Volume", 
        value: networkSavings, 
        color: "#2563eb", 
        description: ROI_DEFAULTS.DESCRIPTIONS.NETWORK 
      }
    ];

    const totalROI = chartData.reduce((acc, curr) => acc + curr.value, 0);

    return { chartData, totalROI };
  }, [state]);

  return {
    ...state,
    setFacilities,
    setMarginPerFacility,
    setNetworkEfficiencyGain,
    resetToDefaults,
    ...calculations
  };
}

// Helper to use useMemo (need to import React hooks properly if used in a raw function, but here it's inside a hook)
import { useMemo } from 'react';

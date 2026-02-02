// src/config/roiDefaults.ts

export const ROI_DEFAULTS = {
  // Default Initial Values
  FACILITIES: 50,
  MARGIN_PER_FACILITY: 1000000,
  NETWORK_EFFICIENCY_GAIN: 1.5, // Percentage

  // Constants (Multipliers)
  PAPER_SAVINGS_PER_FACILITY: 5000, // Generic SaaS savings (digitizing BOLs)
  LABOR_SAVINGS_PER_FACILITY: 45000, // 1 FTE efficiency/facility (Gate/Dock Automation)
  
  // Slider Limits
  LIMITS: {
    FACILITIES: { MIN: 1, MAX: 500, STEP: 1 },
    MARGIN: { MIN: 500000, MAX: 10000000, STEP: 500000 },
    EFFICIENCY: { MIN: 0.1, MAX: 5.0, STEP: 0.1 }
  },

  // Descriptions
  DESCRIPTIONS: {
    PAPER: "Digitizing BOLs (Table Stakes)",
    LABOR: "Gate/Dock Automation",
    NETWORK: "Turnover & Asset Utilization (The Gold Mine)"
  }
} as const;

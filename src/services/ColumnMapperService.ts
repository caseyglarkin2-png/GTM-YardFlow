/**
 * Column Mapper Service - YardFlow Hub
 * 
 * Auto-detects and maps CSV columns to typed fields with fuzzy matching.
 */

import type { ColumnMapping } from '../types/marketing';

// ============================================
// Mapping Configuration
// ============================================

/**
 * Known column mappings with aliases
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  // Person fields
  name: ['name', 'full name', 'fullname', 'contact name', 'person', 'attendee'],
  category: ['category', 'type', 'contact type', 'attendee type'],
  jobTitle: ['job title', 'jobtitle', 'title', 'position', 'role'],
  company: ['company', 'company name', 'companyname', 'organization', 'org'],
  country: ['country', 'location', 'region'],
  email: ['email', 'email address', 'e-mail', 'contact email'],
  linkedinUrl: ['linkedin', 'linkedin url', 'linkedinurl', 'linkedin profile'],
  
  // Scoring fields
  personScore: ['personscore', 'person score', 'score', 'contact score'],
  qualified: ['qualified', 'is qualified', 'qualification'],
  revenue: ['revenue', 'company revenue', 'annual revenue'],
  
  // Persona flags
  isOps: ['is_ops', 'isops', 'ops', 'operations'],
  isExec: ['is_exec', 'isexec', 'exec', 'executive'],
  isExecOps: ['is_exec_ops', 'exec_ops', 'execops'],
  isProc: ['is_proc', 'isproc', 'proc', 'procurement'],
  isSales: ['is_sales', 'issales', 'sales'],
  isTech: ['is_tech', 'istech', 'tech', 'technology'],
  
  // Company fields
  attendees: ['attendees', 'attendee count', 'total attendees'],
  execOpsCount: ['exec_ops_count', 'execopscount', 'exec ops'],
  opsCount: ['ops_count', 'opscount'],
  procCount: ['proc_count', 'proccount'],
  salesCount: ['sales_count', 'salescount'],
  techCount: ['tech_count', 'techcount'],
  nonOps: ['non_ops', 'nonops', 'non ops'],
  opsShare: ['ops_share', 'opsshare'],
  vendorPenalty: ['vendor_penalty', 'vendorpenalty'],
  megaBoost: ['mega_boost', 'megaboost'],
  maxRevenue: ['max_revenue', 'maxrevenue'],
  tier: ['tier', 'company tier', 'score tier'],
  recommendedTargets: ['recommended targets', 'recommendedtargets', 'targets'],
  topTitles: ['top titles', 'toptitles', 'titles'],
  
  // Enrichment fields
  employeeCount: ['employee count', 'employeecount', 'employees', 'employee_count'],
  annualRevenue: ['annual revenue', 'annualrevenue', 'revenue'],
  
  // Primo Lookalike fields (Sprint 53)
  facilityCount: ['facility_count', 'facilitycount', 'facilities', 'num_facilities', 'locations', 'site_count', 'sites'],
  industryCategory: ['industry_category', 'industrycategory', 'industry', 'sector', 'vertical', 'industry_type'],
  distributionFootprint: ['distribution_footprint', 'footprint', 'geographic_coverage', 'coverage', 'geographic_scope'],
  isYardIntensive: ['is_yard_intensive', 'yard_intensive', 'yardintensive', 'yard_operations'],
  estimatedTruckVolume: ['estimated_truck_volume', 'truck_volume', 'daily_trucks', 'truck_movements'],
  primoLookalikeScore: ['primo_lookalike_score', 'primo_score', 'primoscore', 'lookalike_score'],
};

// ============================================
// Mapping Functions
// ============================================

/**
 * Auto-detect column mappings from headers
 */
export function autoDetectMapping(headers: string[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  const usedTargets = new Set<string>();
  
  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().trim();
    let bestMatch: { field: string; confidence: number } | null = null;
    
    // Check each target field
    for (const [targetField, aliases] of Object.entries(COLUMN_ALIASES)) {
      // Skip if already mapped
      if (usedTargets.has(targetField)) continue;
      
      // Check for exact match
      if (aliases.includes(normalizedHeader)) {
        bestMatch = { field: targetField, confidence: 1.0 };
        break;
      }
      
      // Check for partial match
      const partialMatch = aliases.find(
        (alias) => normalizedHeader.includes(alias) || alias.includes(normalizedHeader)
      );
      
      if (partialMatch) {
        const confidence = calculateSimilarity(normalizedHeader, partialMatch);
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { field: targetField, confidence };
        }
      }
    }
    
    if (bestMatch && bestMatch.confidence >= 0.5) {
      usedTargets.add(bestMatch.field);
      mappings.push({
        sourceColumn: header,
        targetField: bestMatch.field,
        confidence: bestMatch.confidence,
        transform: detectTransformType(bestMatch.field),
      });
    } else {
      // Unknown column - include with low confidence for manual review
      mappings.push({
        sourceColumn: header,
        targetField: '', // Unmapped
        confidence: 0,
      });
    }
  }
  
  return mappings;
}

/**
 * Calculate similarity between two strings (Jaccard-like)
 */
function calculateSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Detect the transform type for a field
 */
function detectTransformType(field: string): 'string' | 'number' | 'boolean' | 'date' {
  // Boolean fields
  if (field.startsWith('is') || field === 'qualified' || field === 'sequenceAssigned') {
    return 'boolean';
  }
  
  // Number fields
  if (
    field.includes('Score') ||
    field.includes('Count') ||
    field.includes('count') ||
    field === 'attendees' ||
    field === 'opsShare' ||
    field === 'vendorPenalty' ||
    field === 'megaBoost' ||
    field === 'maxRevenue' ||
    field === 'employeeCount' ||
    field === 'personScore' ||
    field === 'score'
  ) {
    return 'number';
  }
  
  return 'string';
}

/**
 * Apply mapping to transform a CSV row
 */
export function applyMapping<T>(
  row: Record<string, string>,
  mappings: ColumnMapping[]
): Partial<T> {
  const result: Record<string, unknown> = {};
  
  for (const mapping of mappings) {
    if (!mapping.targetField) continue;
    
    const sourceValue = row[mapping.sourceColumn];
    if (sourceValue === undefined || sourceValue === '') continue;
    
    result[mapping.targetField] = transformValue(sourceValue, mapping.transform);
  }
  
  return result as Partial<T>;
}

/**
 * Transform a value based on type
 */
export function transformValue(
  value: string,
  transform?: 'string' | 'number' | 'boolean' | 'date'
): unknown {
  if (!transform || transform === 'string') {
    return value;
  }
  
  switch (transform) {
    case 'boolean':
      return ['true', 'yes', '1', 'TRUE', 'YES'].includes(value);
    
    case 'number':
      const num = parseFloat(value.replace(/[,$]/g, ''));
      return isNaN(num) ? 0 : num;
    
    case 'date':
      return value; // Keep as string for now
    
    default:
      return value;
  }
}

/**
 * Get unmapped columns from a mapping result
 */
export function getUnmappedColumns(mappings: ColumnMapping[]): string[] {
  return mappings
    .filter((m) => !m.targetField || m.confidence < 0.5)
    .map((m) => m.sourceColumn);
}

/**
 * Get high-confidence mappings
 */
export function getConfidentMappings(
  mappings: ColumnMapping[],
  threshold: number = 0.8
): ColumnMapping[] {
  return mappings.filter((m) => m.confidence >= threshold);
}

// ============================================
// Local Storage for Saved Mappings
// ============================================

const MAPPING_STORAGE_KEY = 'yardflow_column_mappings';

/**
 * Save a mapping configuration for reuse
 */
export function saveMappingConfig(
  name: string,
  mappings: ColumnMapping[]
): void {
  const stored = loadAllMappingConfigs();
  stored[name] = mappings;
  localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(stored));
}

/**
 * Load all saved mapping configurations
 */
export function loadAllMappingConfigs(): Record<string, ColumnMapping[]> {
  try {
    const stored = localStorage.getItem(MAPPING_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Load a specific mapping configuration
 */
export function loadMappingConfig(name: string): ColumnMapping[] | null {
  const stored = loadAllMappingConfigs();
  return stored[name] || null;
}

/**
 * Delete a saved mapping configuration
 */
export function deleteMappingConfig(name: string): void {
  const stored = loadAllMappingConfigs();
  delete stored[name];
  localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(stored));
}

import { Prospect } from '@/types';

/**
 * Service to infer facility count based on company firmographics.
 * Used for Lead Scoring in the Manifest Dashboard.
 * 
 * Logic:
 * - Direct: Use existing facility count if available
 * - Inference: Manufacturing/Logistics & >1000 employees -> employees / 200
 * - Default: 1
 */
export class FacilityInferenceService {
  
  /**
   * Calculate/Infer estimated facility count for a prospect's company
   */
  static inferFacilities(prospect: Prospect, employees?: number): number {
    // 1. Direct data (if enriched)
    if (prospect.companyFacilityCount && prospect.companyFacilityCount > 0) {
      return prospect.companyFacilityCount;
    }

    // 2. Inference Logic
    // Normalized logic based on typical yard ratios for enterprise shippers
    const industry = (prospect.companyIndustry || prospect.industry || '').toLowerCase();
    
    const isAssetHeavy = 
      industry.includes('manufacturing') || 
      industry.includes('logistics') || 
      industry.includes('transportation') ||
      industry.includes('food') ||
      industry.includes('beverage') ||
      industry.includes('retail');

    if (isAssetHeavy && employees) {
      if (employees > 1000) {
        // Rule of thumb: 1 major distribution center per 200 employees for large ops
        return Math.max(1, Math.round(employees / 200));
      } else if (employees > 100) {
         // Mid-market
         return 2;
      }
    }

    // 3. Fallback
    return 1;
  }

  /**
   * Check if company matches "Asset-Based Shipper" profile
   */
  static isAssetBasedShipper(prospect: Prospect): boolean {
    const industry = (prospect.companyIndustry || prospect.industry || '').toLowerCase();
    const title = (prospect.title || '').toLowerCase();
    
    // Industry check
    const industryMatch = 
      industry.includes('manufacturing') || 
      industry.includes('logistics') || 
      industry.includes('transportation') ||
      industry.includes('food') ||
      industry.includes('beverage') ||
      industry.includes('retail') ||
      industry.includes('cpg');
      
    // Title check: Ops/Supply Chain leaders are good proxy
    const titleMatch = 
      title.includes('director') || 
      title.includes('vp') || 
      title.includes('head') ||
      title.includes('manager') ||
      title.includes('logistics') ||
      title.includes('supply chain') ||
      title.includes('transportation') ||
      title.includes('operations');

    return industryMatch || (titleMatch && industryMatch);
  }
}

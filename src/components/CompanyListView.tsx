/**
 * Company List View Component
 * 
 * Displays aggregated companies in a table with expand/collapse for contacts.
 * Company-centric view for Jake's workflow.
 * 
 * Sprint 72: T72.1a - Company List UI
 */

import React, { useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Users,
  MapPin,
  Truck,
  AlertCircle,
  Search,
  Filter,
  Zap,
  User,
  Briefcase,
  Mail,
  ExternalLink,
  Sparkles,
  CheckCircle,
  Loader,
  HelpCircle,
} from 'lucide-react';
import { Tooltip } from './Tooltip';
import { SortableHeader } from './SortableHeader';
import type { SortDirection } from '@/hooks/useSortableTable';
import type { CompanyRow } from '../services/CompanyAggregator';
import type { Prospect } from '../types';
import type { CompanyTier } from '../types/marketing';

interface CompanyListViewProps {
  companies: CompanyRow[];
  onCompanySelect: (company: CompanyRow) => void;
  onContactSelect: (prospect: Prospect) => void;
  onResearchClick?: (company: CompanyRow) => void;
  isResearching?: string | null; // Company name currently being researched
  selectedCompanyId?: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  sortBy?: 'score' | 'facilities' | 'contacts' | 'roi';
  sortDirection?: SortDirection;
  onSortChange?: (sortBy: 'score' | 'facilities' | 'contacts' | 'roi') => void;
  // Sprint V33: Company-level action handlers
  onEmailCompany?: (company: CompanyRow) => void;
  onSequenceCompany?: (company: CompanyRow) => void;
}

// Tier badge colors
const tierColors: Record<CompanyTier, string> = {
  'Tier 1': 'bg-orange-100 text-orange-800 border-orange-200',
  'Tier 2': 'bg-blue-100 text-blue-800 border-blue-200',
  'Tier 3': 'bg-slate-100 text-slate-700 border-slate-200',
  'Tier 4': 'bg-slate-50 text-slate-500 border-slate-100',
  'Unscored': 'bg-gray-50 text-gray-400 border-gray-100',
};

// Gate confidence colors
const gateConfidenceColors: Record<string, string> = {
  high: 'text-green-600',
  medium: 'text-yellow-600',
  low: 'text-slate-400',
  unknown: 'text-slate-300',
};

// Sprint S36F: Data quality assessment
type DataQuality = 'complete' | 'partial' | 'minimal';

/**
 * Assess data completeness for a company row
 * @returns 'complete' if all key fields have values, 'partial' if 2+, 'minimal' if <2
 */
const getDataQuality = (company: CompanyRow): DataQuality => {
  const hasFields = [
    company.facilityCount !== null,
    company.roiPotential !== null,
    company.industryCategory !== null,
    company.hasGateBottleneck !== null,
  ];
  const filledCount = hasFields.filter(Boolean).length;
  
  if (filledCount === 4) return 'complete';
  if (filledCount >= 2) return 'partial';
  return 'minimal';
};

// Data quality badge styles
const dataQualityStyles: Record<DataQuality, string> = {
  complete: 'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
  minimal: 'bg-red-100 text-red-700',
};

const dataQualityLabels: Record<DataQuality, string> = {
  complete: '✓ Complete',
  partial: '◐ Partial',
  minimal: '○ Minimal',
};

export function CompanyListView({
  companies,
  onCompanySelect,
  onContactSelect,
  onResearchClick,
  isResearching,
  selectedCompanyId,
  searchTerm = '',
  onSearchChange,
  sortBy = 'score',
  sortDirection = 'desc',
  onSortChange,
  // Sprint V33: Company-level action handlers
  onEmailCompany,
  onSequenceCompany,
}: CompanyListViewProps) {
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [showHelp, setShowHelp] = useState(false);

  // Sprint 1003: Virtualize company list to prevent INP blocking
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: companies.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // Base height of company row
    overscan: 5,
  });

  const toggleExpanded = (companyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
    // Force re-measurement after expansion toggle
    // Note: This happens automatically as the size changes
  };

  // Get sort indicator for a column
  const getSortIndicator = (field: typeof sortBy): SortDirection | null => {
    return sortBy === field ? sortDirection : null;
  };

  // Handle sort column click
  const handleSortClick = (field: string) => {
    onSortChange?.(field as typeof sortBy);
  };

  // Format ROI as currency - Sprint S36F: styled placeholder for null
  const formatROI = (roi: number | null): React.ReactNode => {
    if (roi === null) {
      return (
        <Tooltip content="ROI not calculated — click AI Research to estimate">
          <span className="text-slate-300 italic cursor-help">—</span>
        </Tooltip>
      );
    }
    if (roi >= 1_000_000_000) return `$${(roi / 1_000_000_000).toFixed(1)}B`;
    if (roi >= 1_000_000) return `$${(roi / 1_000_000).toFixed(0)}M`;
    if (roi >= 1_000) return `$${(roi / 1_000).toFixed(0)}K`;
    return `$${roi}`;
  };

  // Format facility count - Sprint S36F: styled placeholder for null
  const formatFacilities = (count: number | null): React.ReactNode => {
    if (count === null) {
      return (
        <Tooltip content="Facility count unknown — click AI Research to discover">
          <span className="text-slate-300 cursor-help">?</span>
        </Tooltip>
      );
    }
    return count.toString();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with Search and Sort */}
      <div className="p-3 border-b border-slate-200 bg-white space-y-3">
        {/* Search */}
        {onSearchChange && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search companies..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Sort Controls */}
        {onSortChange && (
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Sort:
              </span>
              <SortableHeader
                column="score"
                label="Score"
                sortIndicator={getSortIndicator('score')}
                onSort={handleSortClick}
                className="px-2 py-1 rounded hover:bg-slate-100"
              />
              <SortableHeader
                column="facilities"
                label="Facilities"
                sortIndicator={getSortIndicator('facilities')}
                onSort={handleSortClick}
                className="px-2 py-1 rounded hover:bg-slate-100"
              />
              <SortableHeader
                column="contacts"
                label="Contacts"
                sortIndicator={getSortIndicator('contacts')}
                onSort={handleSortClick}
                className="px-2 py-1 rounded hover:bg-slate-100"
              />
              <SortableHeader
                column="roi"
                label="ROI"
                sortIndicator={getSortIndicator('roi')}
                onSort={handleSortClick}
                className="px-2 py-1 rounded hover:bg-slate-100"
              />
            </div>
            
            {/* Help Toggle */}
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
              aria-expanded={showHelp}
              aria-controls="company-list-help"
            >
              <HelpCircle className="h-3 w-3" />
              <span>{showHelp ? 'Hide guide' : 'How to use'}</span>
            </button>
          </div>
        )}
        
        {/* Help Panel - Collapsible Guide */}
        {showHelp && (
          <div 
            id="company-list-help"
            className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs space-y-2"
          >
            <h4 className="font-semibold text-blue-800">Quick Guide</h4>
            <div className="grid grid-cols-2 gap-2 text-blue-700">
              <div><span className="font-medium">T1-T4:</span> Priority tiers (T1 = best fit)</div>
              <div><span className="font-medium">Score:</span> Primo lookalike score (0-100)</div>
              <div><span className="font-medium">Facilities:</span> Distribution sites (60+ = 🔥)</div>
              <div><span className="font-medium">Gate:</span> Yard congestion likelihood</div>
            </div>
            <div className="text-blue-600 pt-1 border-t border-blue-200">
              💡 <strong>Tips:</strong> Click a row to expand contacts. Click column headers to see detailed explanations. Use quick filters in the sidebar.
            </div>
          </div>
        )}
      </div>

      {/* Table Header */}
      <div
        role="row"
        className="px-3 py-2 flex items-center gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200"
      >
        <span className="w-6" /> {/* Expand toggle */}
        <span className="flex-1">Company</span>
        
        {/* Tier Column Header */}
        <Tooltip
          content={
            <div className="space-y-1">
              <strong>Company Tier</strong>
              <p>Priority tier based on fit score:</p>
              <ul className="text-[10px] space-y-0.5">
                <li>⭐ T1 = Highest priority</li>
                <li>🔵 T2 = High potential</li>
                <li>⚪ T3 = Standard</li>
                <li>⬜ T4 = Lower priority</li>
              </ul>
            </div>
          }
        >
          <span className="w-14 text-center cursor-help flex flex-col items-center gap-0.5">
            <span>Tier</span>
          </span>
        </Tooltip>
        
        {/* Contacts Column Header */}
        <Tooltip
          content={
            <div className="space-y-1">
              <strong>Contacts</strong>
              <p>Number of people at this company in your prospect list.</p>
              <p className="text-blue-300">💡 Click row to expand and see all contacts</p>
            </div>
          }
        >
          <span className="w-12 text-center cursor-help flex flex-col items-center gap-0.5">
            <Users className="h-3 w-3" aria-hidden="true" />
            <span className="text-[9px] font-normal normal-case">Contacts</span>
          </span>
        </Tooltip>
        
        {/* Facilities Column Header */}
        <Tooltip
          content={
            <div className="space-y-1">
              <strong>Facilities</strong>
              <p>Estimated distribution centers, warehouses, or yards.</p>
              <p className="text-green-300">💡 60+ facilities = high-priority target ★</p>
            </div>
          }
        >
          <span className="w-14 text-center cursor-help flex flex-col items-center gap-0.5">
            <Building2 className="h-3 w-3" aria-hidden="true" />
            <span className="text-[9px] font-normal normal-case">Facilities</span>
          </span>
        </Tooltip>
        
        {/* Gate Issue Column Header */}
        <Tooltip
          content={
            <div className="space-y-1">
              <strong>Gate Issue</strong>
              <p>Likelihood of yard congestion or gate problems:</p>
              <ul className="text-[10px] space-y-0.5">
                <li>✅ = Confirmed gate issues</li>
                <li>? = Unknown (needs research)</li>
                <li>— = No known issues</li>
              </ul>
              <p className="text-blue-300">Based on industry + facility data</p>
            </div>
          }
        >
          <span className="w-12 text-center cursor-help flex flex-col items-center gap-0.5">
            <Truck className="h-3 w-3" aria-hidden="true" />
            <span className="text-[9px] font-normal normal-case">Gate</span>
          </span>
        </Tooltip>
        
        {/* ROI Column Header */}
        <Tooltip
          content={
            <div className="space-y-1">
              <strong>ROI Potential</strong>
              <p>Estimated annual savings from solving yard issues.</p>
              <p className="text-[10px]">Based on: facility count × average savings per site</p>
              <p className="text-green-300">💡 $100M+ = exceptional opportunity</p>
            </div>
          }
        >
          <span className="w-20 text-right cursor-help flex flex-col items-center gap-0.5">
            <span>ROI</span>
          </span>
        </Tooltip>
        
        {/* Score Column Header */}
        <Tooltip
          content={
            <div className="space-y-1">
              <strong>Primo Score</strong>
              <p>Lookalike score (0-100). Higher = more similar to ideal customer profile.</p>
              <ul className="text-[10px] space-y-0.5">
                <li>🔥 70+ = Hot lead</li>
                <li>🔵 50-69 = Warm lead</li>
                <li>⚪ &lt;50 = Cold lead</li>
              </ul>
            </div>
          }
        >
          <span className="w-12 text-center cursor-help flex flex-col items-center gap-0.5">
            <Zap className="h-3 w-3" aria-hidden="true" />
            <span className="text-[9px] font-normal normal-case">Score</span>
          </span>
        </Tooltip>
        
        {/* Sprint V33: Actions column */}
        {(onEmailCompany || onSequenceCompany) && (
          <span className="w-20 text-center">Actions</span>
        )}
      </div>

      {/* Company Rows */}
      <div 
        ref={parentRef}
        className="flex-1 overflow-y-auto" 
        role="grid" 
        aria-label="Company list"
      >
        {companies.length > 0 ? (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const company = companies[virtualRow.index];
              const isExpanded = expandedCompanies.has(company.id);
              const isSelected = selectedCompanyId === company.id;

              return (
                <div
                  key={company.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {/* Company Row */}
                  <div
                    role="row"
                    aria-selected={isSelected}
                    aria-expanded={isExpanded}
                    tabIndex={0}
                    onClick={() => onCompanySelect(company)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onCompanySelect(company);
                      if (e.key === ' ') {
                        e.preventDefault();
                        toggleExpanded(company.id, e as unknown as React.MouseEvent);
                      }
                    }}
                    className={`px-3 py-2.5 flex items-center gap-2 cursor-pointer transition-colors border-b border-slate-100 ${
                      isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Expand Toggle */}
                    <button
                      onClick={(e) => toggleExpanded(company.id, e)}
                      className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={isExpanded ? 'Collapse contacts' : 'Expand contacts'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    {/* Company Name & Industry - Sprint 30: Increased width for readability */}
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <h3 
                          className={`font-semibold text-sm truncate flex-shrink-0 ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}
                          title={company.company || company.id || 'Unknown Company'}
                        >
                          {company.company || company.id || 'Unknown Company'}
                        </h3>
                        
                        {/* Sprint S36F: Data quality indicator for incomplete records */}
                        {(() => {
                          const quality = getDataQuality(company);
                          if (quality !== 'complete') {
                            return (
                              <Tooltip
                                content={
                                  <div className="space-y-1">
                                    <div className="font-semibold">
                                      {quality === 'minimal' ? '⚠️ Limited Data' : 'ℹ️ Partial Data'}
                                    </div>
                                    <div className="text-slate-300 text-xs">
                                      Click "AI Research" to enrich this company's data
                                    </div>
                                  </div>
                                }
                              >
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium cursor-help ${
                                  quality === 'minimal' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {quality === 'minimal' ? '⚠️' : 'ℹ️'}
                                </span>
                              </Tooltip>
                            );
                          }
                          return null;
                        })()}
                        
                        {/* AI Research Status - Always visible */}
                        {onResearchClick && (
                          company.needsResearch ? (
                            <button
                              data-testid="research-button-list"
                              onClick={(e) => {
                                e.stopPropagation();
                                onResearchClick(company);
                              }}
                              disabled={isResearching === company.company}
                              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md font-medium transition-colors ${
                                isResearching === company.company 
                                  ? 'bg-blue-100 text-blue-600 cursor-wait'
                                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                              }`}
                              title={isResearching === company.company ? 'Researching...' : 'AI Research this company'}
                            >
                              {isResearching === company.company ? (
                                <>
                                  <Loader className="h-3 w-3 animate-spin" />
                                  <span>Researching</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-3 w-3" />
                                  <span>AI Research</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 bg-green-50 rounded-md" title="AI research complete">
                              <CheckCircle className="h-3 w-3" />
                              Researched
                            </span>
                          )
                        )}
                      </div>
                      {company.industryCategory && (
                        <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {company.industryCategory.replace('_', ' ')}
                          {company.distributionFootprint && (
                            <>
                              <span className="text-slate-300">•</span>
                              <MapPin className="h-3 w-3" />
                              {company.distributionFootprint}
                            </>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Tier Badge */}
                    <div className="w-14 text-center">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded border ${tierColors[company.tier]}`}>
                        {company.tier.replace('Tier ', 'T')}
                      </span>
                    </div>

                    {/* Contact Count */}
                    <div className="w-12 text-center">
                      <span className="text-sm font-medium text-slate-700 flex items-center justify-center gap-1">
                        <Users className="h-3 w-3 text-slate-400" />
                        {company.contactCount}
                      </span>
                    </div>

                    {/* Facility Count */}
                    <div className="w-14 text-center">
                      <span className={`text-sm font-semibold ${
                        company.facilityCount !== null && company.facilityCount >= 60
                          ? 'text-green-600'
                          : company.facilityCount !== null
                          ? 'text-slate-700'
                          : 'text-slate-400'
                      }`}>
                        {formatFacilities(company.facilityCount)}
                      </span>
                      {company.facilityCount !== null && company.facilityCount >= 60 && (
                        <span className="ml-0.5 text-[10px] text-green-500">★</span>
                      )}
                    </div>

                    {/* Gate Bottleneck Indicator - Sprint S36F: styled unknown with tooltip */}
                    <div className="w-12 text-center">
                      <span
                        className={`text-xs font-medium ${gateConfidenceColors[company.gateConfidence]}`}
                        title={company.gateLabel}
                      >
                        {company.hasGateBottleneck ? (
                          <Truck className="h-4 w-4 mx-auto text-green-500" />
                        ) : company.gateConfidence === 'unknown' ? (
                          <Tooltip content="Gate status unknown — needs industry research">
                            <span className="text-slate-300 cursor-help">?</span>
                          </Tooltip>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </span>
                    </div>

                    {/* ROI Potential */}
                    <div className="w-20 text-right">
                      <span className={`text-xs font-semibold ${
                        company.roiPotential !== null && company.roiPotential >= 100_000_000
                          ? 'text-green-600'
                          : company.roiPotential !== null && company.roiPotential >= 50_000_000
                          ? 'text-blue-600'
                          : 'text-slate-600'
                      }`}>
                        {formatROI(company.roiPotential)}
                      </span>
                    </div>

                    {/* Primo Score */}
                    <div className="w-12 text-center">
                      <span className={`text-xs font-bold ${
                        company.primoLookalikeScore >= 70
                          ? 'text-orange-500'
                          : company.primoLookalikeScore >= 50
                          ? 'text-blue-500'
                          : 'text-slate-500'
                      }`}>
                        {Math.round(company.primoLookalikeScore)}
                      </span>
                    </div>

                    {/* Sprint V33: Company Action Buttons */}
                    {(onEmailCompany || onSequenceCompany) && (
                      <div className="w-20 flex items-center justify-center gap-1">
                        {onEmailCompany && company.contacts?.filter(c => c.email).length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEmailCompany(company);
                            }}
                            className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 transition-colors"
                            title={`Email ${company.contacts?.filter(c => c.email).length} contacts`}
                            aria-label={`Email all contacts at ${company.company}`}
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                        )}
                        {onSequenceCompany && company.contacts?.filter(c => c.email).length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSequenceCompany(company);
                            }}
                            className="p-1.5 rounded-md text-purple-600 hover:bg-purple-50 transition-colors"
                            title={`Add ${company.contacts?.filter(c => c.email).length} to sequence`}
                            aria-label={`Add all contacts at ${company.company} to sequence`}
                          >
                            <Zap className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expanded Contacts */}
                  {isExpanded && (
                    <div className="bg-slate-50 border-b border-slate-200">
                      {company.contacts.map(contact => (
                        <div
                          key={contact.id}
                          role="row"
                          onClick={() => onContactSelect(contact)}
                          className="pl-12 pr-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-slate-100 transition-colors border-t border-slate-100"
                        >
                          <User className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-700 truncate">
                              {contact.name}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {contact.title}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {contact.isExec && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-700 rounded">
                                Exec
                              </span>
                            )}
                            {contact.isOps && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-700 rounded">
                                Ops
                              </span>
                            )}
                            {contact.email && (
                              <a 
                                href={`mailto:${contact.email}`} 
                                title={`Email ${contact.email}`}
                                className="hover:text-blue-600 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Mail className="h-3.5 w-3.5 text-slate-400 hover:text-blue-600" />
                              </a>
                            )}
                            {contact.linkedinUrl && (
                              <a 
                                href={contact.linkedinUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                title="View LinkedIn Profile"
                                className="hover:text-blue-600 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3.5 w-3.5 text-blue-400 hover:text-blue-600" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                      {company.contacts.length === 0 && (
                        <div className="pl-12 pr-3 py-2 text-xs text-slate-400 italic">
                          No contacts found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="mb-3">
              <Building2 className="h-10 w-10 mx-auto text-slate-300" aria-hidden="true" />
            </div>
            <p className="font-medium text-slate-700">No companies found</p>
            <p className="text-sm text-slate-500 mt-1">
              {searchTerm ? 'Try adjusting your search or filters' : 'Import prospects to see companies here'}
            </p>
            {searchTerm && onSearchChange && (
              <button 
                onClick={() => onSearchChange('')}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-400 text-center">
        {companies.length} Companies
      </div>
    </div>
  );
}

export default CompanyListView;

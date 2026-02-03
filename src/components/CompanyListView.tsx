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
  ArrowUpDown,
  Zap,
  User,
  Briefcase,
  Mail,
  ExternalLink,
} from 'lucide-react';
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
  onSortChange?: (sortBy: 'score' | 'facilities' | 'contacts' | 'roi') => void;
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
  onSortChange,
}: CompanyListViewProps) {
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());

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

  // Sort buttons
  const SortButton = ({ field, label }: { field: typeof sortBy; label: string }) => (
    <button
      onClick={() => onSortChange?.(field)}
      className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
        sortBy === field
          ? 'bg-blue-100 text-blue-700'
          : 'text-slate-500 hover:bg-slate-100'
      }`}
    >
      <ArrowUpDown className="h-3 w-3" />
      {label}
    </button>
  );

  // Format ROI as currency
  const formatROI = (roi: number | null): string => {
    if (roi === null) return '—';
    if (roi >= 1_000_000_000) return `$${(roi / 1_000_000_000).toFixed(1)}B`;
    if (roi >= 1_000_000) return `$${(roi / 1_000_000).toFixed(0)}M`;
    if (roi >= 1_000) return `$${(roi / 1_000).toFixed(0)}K`;
    return `$${roi}`;
  };

  // Format facility count
  const formatFacilities = (count: number | null): string => {
    if (count === null) return '?';
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
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Filter className="h-3 w-3" />
              Sort:
            </span>
            <SortButton field="score" label="Score" />
            <SortButton field="facilities" label="Facilities" />
            <SortButton field="contacts" label="Contacts" />
            <SortButton field="roi" label="ROI" />
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
        <span className="w-14 text-center">Tier</span>
        <span className="w-12 text-center" title="Contacts">
          <Users className="h-3 w-3 mx-auto" />
        </span>
        <span className="w-14 text-center" title="Facilities">
          <Building2 className="h-3 w-3 mx-auto" />
        </span>
        <span className="w-12 text-center">Gate?</span>
        <span className="w-20 text-right">ROI</span>
        <span className="w-12 text-center" title="Score">
          <Zap className="h-3 w-3 mx-auto" />
        </span>
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

                    {/* Company Name & Industry */}
                    <div className="flex-1 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold text-sm truncate flex-shrink-0 ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                          {company.company || company.id || 'Unknown Company'}
                        </h3>
                        {company.needsResearch && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onResearchClick?.(company);
                            }}
                            disabled={isResearching === company.company}
                            className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
                              isResearching === company.company 
                                ? 'bg-blue-50 text-blue-500 border-blue-200 cursor-wait'
                                : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                            }`}
                            title={isResearching === company.company ? 'Researching...' : 'Click to research'}
                          >
                            <AlertCircle className={`h-3 w-3 ${isResearching === company.company ? 'animate-pulse' : ''}`} />
                            {isResearching === company.company ? 'Researching...' : 'Research'}
                          </button>
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

                    {/* Gate Bottleneck Indicator */}
                    <div className="w-12 text-center">
                      <span
                        className={`text-xs font-medium ${gateConfidenceColors[company.gateConfidence]}`}
                        title={company.gateLabel}
                      >
                        {company.hasGateBottleneck ? (
                          <Truck className="h-4 w-4 mx-auto text-green-500" />
                        ) : company.gateConfidence === 'unknown' ? (
                          <span className="text-slate-300">?</span>
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
          <div className="p-8 text-center text-slate-400 text-sm">
            No companies found.
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

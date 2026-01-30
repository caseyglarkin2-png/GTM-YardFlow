/**
 * Company Detail Panel Component
 * 
 * Shows detailed company information with research button and inline ROI.
 * Used when in company-centric view mode.
 * 
 * Sprint 72: T72.3 - Company Detail Panel
 */

import { useState } from 'react';
import {
  Building2,
  Users,
  Truck,
  DollarSign,
  Search,
  Sparkles,
  ChevronDown,
  ExternalLink,
  Mail,
  User,
  Briefcase,
  Target,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import type { CompanyRow } from '../services/CompanyAggregator';
import type { Prospect } from '../types';
import type { CompanyTier } from '../types/marketing';

interface CompanyDetailPanelProps {
  company: CompanyRow;
  onContactSelect: (prospect: Prospect) => void;
  onResearchClick?: (company: CompanyRow) => void;
  onQueueOutreach?: (company: CompanyRow, contacts: Prospect[]) => void;
  isResearching?: boolean;
}

// Tier badge colors
const tierColors: Record<CompanyTier, string> = {
  'Tier 1': 'bg-orange-100 text-orange-800 border-orange-200',
  'Tier 2': 'bg-blue-100 text-blue-800 border-blue-200',
  'Tier 3': 'bg-slate-100 text-slate-700 border-slate-200',
  'Tier 4': 'bg-slate-50 text-slate-500 border-slate-100',
  'Unscored': 'bg-gray-50 text-gray-400 border-gray-100',
};

export function CompanyDetailPanel({
  company,
  onContactSelect,
  onResearchClick,
  onQueueOutreach,
  isResearching = false,
}: CompanyDetailPanelProps) {
  const [showAllContacts, setShowAllContacts] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());

  // Format ROI as currency
  const formatROI = (roi: number | null): string => {
    if (roi === null) return 'Unknown';
    if (roi >= 1_000_000_000) return `$${(roi / 1_000_000_000).toFixed(1)}B`;
    if (roi >= 1_000_000) return `$${(roi / 1_000_000).toFixed(0)}M`;
    if (roi >= 1_000) return `$${(roi / 1_000).toFixed(0)}K`;
    return `$${roi}`;
  };

  // Get visible contacts (limited or all)
  const visibleContacts = showAllContacts 
    ? company.contacts 
    : company.contacts.slice(0, 5);

  // Toggle contact selection for outreach
  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  // Get selected contacts
  const selectedContacts = company.contacts.filter(c => selectedContactIds.has(c.id));

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 truncate">
                  {company.company}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${tierColors[company.tier]}`}>
                    {company.tier}
                  </span>
                  {company.industryCategory && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {company.industryCategory.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Research Button */}
          {company.needsResearch && (
            <button
              onClick={() => onResearchClick?.(company)}
              disabled={isResearching}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                isResearching
                  ? 'bg-slate-100 text-slate-400 cursor-wait'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              }`}
            >
              {isResearching ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  AI Research
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Facilities */}
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Building2 className="h-3.5 w-3.5" />
              Facilities
            </div>
            <div className={`text-xl font-bold ${
              company.facilityCount !== null && company.facilityCount >= 60
                ? 'text-green-600'
                : 'text-slate-800'
            }`}>
              {company.facilityCount ?? '?'}
              {company.facilityCount !== null && company.facilityCount >= 60 && (
                <span className="ml-1 text-sm text-green-500">★</span>
              )}
            </div>
            {company.facilityCount === null && (
              <div className="text-[10px] text-amber-600 flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3" />
                Needs research
              </div>
            )}
          </div>

          {/* ROI Potential */}
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              ROI Potential
            </div>
            <div className={`text-xl font-bold ${
              company.roiPotential !== null && company.roiPotential >= 100_000_000
                ? 'text-green-600'
                : company.roiPotential !== null && company.roiPotential >= 50_000_000
                ? 'text-blue-600'
                : 'text-slate-800'
            }`}>
              {formatROI(company.roiPotential)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              $1M per facility
            </div>
          </div>

          {/* Gate Bottleneck */}
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Truck className="h-3.5 w-3.5" />
              Gate Bottleneck
            </div>
            <div className={`text-lg font-bold flex items-center gap-2 ${
              company.hasGateBottleneck ? 'text-green-600' : 'text-slate-400'
            }`}>
              {company.hasGateBottleneck ? (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Likely
                </>
              ) : company.gateConfidence === 'unknown' ? (
                <>
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  Unknown
                </>
              ) : (
                <>
                  <span className="text-slate-400">—</span>
                  Unlikely
                </>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 capitalize">
              {company.gateConfidence} confidence
            </div>
          </div>

          {/* Primo Score */}
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Zap className="h-3.5 w-3.5" />
              Primo Score
            </div>
            <div className={`text-xl font-bold ${
              company.primoLookalikeScore >= 70
                ? 'text-orange-500'
                : company.primoLookalikeScore >= 50
                ? 'text-blue-500'
                : 'text-slate-500'
            }`}>
              {Math.round(company.primoLookalikeScore)}
              <span className="text-sm font-normal text-slate-400">/100</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {company.primoLookalikeScore >= 70
                ? 'High ICP match'
                : company.primoLookalikeScore >= 50
                ? 'Medium ICP match'
                : 'Low ICP match'}
            </div>
          </div>
        </div>
      </div>

      {/* Company Details */}
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-slate-400" />
          Company Profile
        </h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Industry:</span>
            <span className="font-medium text-slate-700">
              {company.industryCategory?.replace('_', ' ') || 'Unknown'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Footprint:</span>
            <span className="font-medium text-slate-700 capitalize">
              {company.distributionFootprint || 'Unknown'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Est. Volume:</span>
            <span className="font-medium text-slate-700">
              {company.estimatedTruckVolume 
                ? `${company.estimatedTruckVolume} trucks/day`
                : 'Unknown'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Contacts:</span>
            <span className="font-medium text-slate-700">
              {company.contactCount} people
            </span>
          </div>
        </div>
      </div>

      {/* Contacts Section */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400" />
            Contacts ({company.contactCount})
          </h3>
          {selectedContacts.length > 0 && onQueueOutreach && (
            <button
              onClick={() => onQueueOutreach(company, selectedContacts)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              Queue {selectedContacts.length} for Outreach
            </button>
          )}
        </div>

        <div className="space-y-2">
          {visibleContacts.map(contact => (
            <div
              key={contact.id}
              className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer border border-slate-100"
              onClick={() => onContactSelect(contact)}
            >
              <input
                type="checkbox"
                checked={selectedContactIds.has(contact.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleContactSelection(contact.id);
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-slate-800 truncate">
                  {contact.name}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {contact.title}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {contact.isExec && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-700 rounded font-medium">
                    Exec
                  </span>
                )}
                {contact.isOps && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-700 rounded font-medium">
                    Ops
                  </span>
                )}
                {contact.email && (
                  <span title="Has email">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </span>
                )}
                {contact.linkedinUrl && (
                  <span title="Has LinkedIn">
                    <ExternalLink className="h-4 w-4 text-blue-400" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {company.contacts.length > 5 && (
          <button
            onClick={() => setShowAllContacts(!showAllContacts)}
            className="mt-3 w-full flex items-center justify-center gap-1 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showAllContacts ? 'rotate-180' : ''}`} />
            {showAllContacts ? 'Show less' : `Show all ${company.contacts.length} contacts`}
          </button>
        )}
      </div>

      {/* Action Footer */}
      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
        <div className="flex items-center gap-3">
          {onQueueOutreach && (
            <button
              onClick={() => {
                // Select all contacts and queue
                const allIds = new Set(company.contacts.map(c => c.id));
                setSelectedContactIds(allIds);
                onQueueOutreach(company, company.contacts);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Mail className="h-4 w-4" />
              Queue All for Outreach
            </button>
          )}
          {onResearchClick && !company.needsResearch && (
            <button
              onClick={() => onResearchClick(company)}
              disabled={isResearching}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 bg-white text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Search className="h-4 w-4" />
              Re-research
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CompanyDetailPanel;

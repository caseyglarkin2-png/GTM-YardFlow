/**
 * DossierPanel - Account Dossier View
 * 
 * Sprint 30: B3 - Rich company research display
 * 
 * Shows AI-generated company insights:
 * - Facility count and distribution footprint
 * - Industry analysis and yard intensity
 * - Talking points for outreach
 * - Key contacts at the company
 */

import React from 'react';
import { LazyIcon } from '../icons';
import type { CompanyResearchResult, ResearchedCompanyData } from '../../services/CompanyResearchService';
import type { Prospect } from '../../types';

interface DossierPanelProps {
  companyName: string;
  research: CompanyResearchResult | null;
  contacts?: Prospect[];
  isLoading?: boolean;
  onResearch?: () => void;
  onContactClick?: (prospect: Prospect) => void;
}

export function DossierPanel({ 
  companyName, 
  research, 
  contacts = [], 
  isLoading = false,
  onResearch,
  onContactClick,
}: DossierPanelProps) {
  const data = research?.data;

  // Render loading state
  if (isLoading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64">
        <LazyIcon name="Loader" className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-600">Researching {companyName}...</p>
      </div>
    );
  }

  // Render empty state with research CTA
  if (!research || !data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 text-center">
        <LazyIcon name="Building2" className="h-12 w-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-700 mb-2">{companyName}</h3>
        <p className="text-slate-500 mb-4">No research data available yet.</p>
        {onResearch && (
          <button
            onClick={onResearch}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <LazyIcon name="Sparkles" className="h-4 w-4" />
            Research with AI
          </button>
        )}
      </div>
    );
  }

  // Render error state
  if (!research.success && research.error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 text-center">
        <LazyIcon name="AlertCircle" className="h-12 w-12 text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-700 mb-2">Research Failed</h3>
        <p className="text-red-500 mb-4">{research.error}</p>
        {onResearch && (
          <button
            onClick={onResearch}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <LazyIcon name="RefreshCw" className="h-4 w-4" />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <header className="border-b border-slate-200 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{companyName}</h2>
            {data.description && (
              <p className="text-slate-600 mt-1">{data.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <ConfidenceBadge confidence={research.confidence?.overall} />
            {research.researchedAt && (
              <span className="text-xs text-slate-500">
                Updated {new Date(research.researchedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        {data.website && (
          <a 
            href={data.website.startsWith('http') ? data.website : `https://${data.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-sm mt-2 inline-flex items-center gap-1"
          >
            <LazyIcon name="ExternalLink" className="h-3 w-3" />
            {data.website}
          </a>
        )}
        {/* Re-research Button */}
        {onResearch && (
          <button
            onClick={onResearch}
            className="mt-3 flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <LazyIcon name="RefreshCw" className="h-3 w-3" />
            Re-research
          </button>
        )}
      </header>

      {/* Company Profile Grid */}
      <section>
        <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <LazyIcon name="Building2" className="h-4 w-4" />
          Company Profile
        </h3>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <ProfileItem label="Facilities" value={data.facilityCount?.toString()} />
          <ProfileItem label="Industry" value={data.industryCategory} />
          <ProfileItem label="Footprint" value={data.distributionFootprint} />
          <ProfileItem label="Headquarters" value={data.headquarters} />
          <ProfileItem label="Revenue" value={data.revenueEstimate} />
          <ProfileItem 
            label="Yard Intensive" 
            value={data.isYardIntensive ? 'Yes' : data.isYardIntensive === false ? 'No' : undefined} 
          />
        </dl>
      </section>

      {/* Yard Pain Points */}
      {data.yardPainPoints && data.yardPainPoints.length > 0 && (
        <section>
          <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <LazyIcon name="AlertTriangle" className="h-4 w-4 text-amber-500" />
            Yard Pain Points
          </h3>
          <ul className="space-y-2">
            {data.yardPainPoints.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0" />
                {point}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Talking Points */}
      {data.talkingPoints && data.talkingPoints.length > 0 && (
        <section>
          <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <LazyIcon name="MessageSquare" className="h-4 w-4 text-blue-500" />
            Talking Points
          </h3>
          <ul className="space-y-2">
            {data.talkingPoints.map((tp, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 bg-blue-50 p-2 rounded">
                <LazyIcon name="Quote" className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                {tp}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Competitors */}
      {data.competitors && data.competitors.length > 0 && (
        <section>
          <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <LazyIcon name="Users" className="h-4 w-4" />
            Competitors
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.competitors.map((comp, idx) => (
              <span 
                key={idx} 
                className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
              >
                {comp}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Decision Makers */}
      {data.decisionMakers && data.decisionMakers.length > 0 && (
        <section>
          <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <LazyIcon name="UserCheck" className="h-4 w-4 text-green-500" />
            Target Decision Makers
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.decisionMakers.map((dm, idx) => (
              <span 
                key={idx} 
                className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-sm"
              >
                {dm}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Key Contacts at Company */}
      {contacts.length > 0 && (
        <section>
          <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <LazyIcon name="Contact" className="h-4 w-4" />
            Contacts ({contacts.length})
          </h3>
          <div className="space-y-2">
            {contacts.slice(0, 5).map((contact) => (
              <button
                key={contact.id}
                onClick={() => onContactClick?.(contact)}
                className="w-full flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors text-left"
              >
                <div>
                  <p className="font-medium text-slate-800">{contact.name}</p>
                  <p className="text-sm text-slate-500">{contact.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  {contact.email && (
                    <span className="text-green-600">
                      <LazyIcon name="Mail" className="h-4 w-4" />
                    </span>
                  )}
                  {contact.tier && (
                    <TierBadge tier={contact.tier} />
                  )}
                </div>
              </button>
            ))}
            {contacts.length > 5 && (
              <p className="text-sm text-slate-500 text-center">
                +{contacts.length - 5} more contacts
              </p>
            )}
          </div>
        </section>
      )}

      {/* Research Metadata */}
      <footer className="pt-4 border-t border-slate-200 text-xs text-slate-400">
        <p>Researched: {new Date(research.researchedAt).toLocaleDateString()}</p>
        {research.sources && research.sources.length > 0 && (
          <p>Sources: {research.sources.join(', ')}</p>
        )}
      </footer>
    </div>
  );
}

// Helper Components

function ProfileItem({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">
        {value || <span className="text-slate-400">Unknown</span>}
      </dd>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence?: 'high' | 'medium' | 'low' }) {
  if (!confidence) return null;
  
  const config = {
    high: { bg: 'bg-green-100', text: 'text-green-700', label: 'High Confidence' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Medium Confidence' },
    low: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Low Confidence' },
  };
  
  const { bg, text, label } = config[confidence];
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    'Tier 1': 'bg-emerald-100 text-emerald-700',
    'Tier 2': 'bg-blue-100 text-blue-700',
    'Tier 3': 'bg-slate-100 text-slate-600',
  };
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[tier] || colors['Tier 3']}`}>
      {tier}
    </span>
  );
}

export default DossierPanel;

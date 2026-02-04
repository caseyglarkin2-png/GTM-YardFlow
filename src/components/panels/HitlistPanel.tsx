// src/components/panels/HitlistPanel.tsx
import React, { useEffect } from 'react';
import { ViewMode } from '../ViewModeToggle';
import { CompanyRow } from '../../services/CompanyAggregator';
import { Prospect } from '../../types';
import type { CompanyResearchResult } from '../../services/CompanyResearchService';
import type { ProspectEnrollmentInfo } from '../../hooks/useSequenceEnrollment';
import { CompanyDetailPanel } from '../CompanyDetailPanel';
import { CompanyListView } from '../CompanyListView';
import { ProspectListPanel } from './ProspectListPanel';
import { ProspectDetailPanel } from './ProspectDetailPanel';

export type CurrentUser = 'Jake' | 'Me';

export interface SelectionState {
  isSelected: (id: string) => boolean;
  handleSelectionClick: (id: string, e: React.MouseEvent) => void;
  toggleSelection: (id: string, options?: { extend: boolean }) => void;
  toggleAll: () => void;
  isAllSelected: boolean;
}

interface HitlistPanelProps {
  viewMode: ViewMode;
  selectedCompany: CompanyRow | null;
  companies: CompanyRow[];
  filteredProspects: Prospect[];
  allProspects: Prospect[];
  isLoading: boolean;
  selectedProspect: Prospect | null;
  onSelectProspect: (p: Prospect | null) => void;
  onSelectCompany: (c: CompanyRow | null) => void;
  currentUser: CurrentUser;
  getEnrollmentForProspect: (id: string) => ProspectEnrollmentInfo | null;
  selection: SelectionState;
  onClearFilters: () => void;
  onGoToImport: () => void;
  onAddProspect?: () => void;
  onUpdateProspect: (updates: Partial<Prospect>) => Promise<void>;
  onBookMeeting: () => void;
  onSendEmail: (templateId: string, body: string, subject?: string) => Promise<void>;
  // Sprint 32: AI Research props
  onResearchClick?: (company: CompanyRow) => void;
  isResearchingCompany?: string | null;
  researchResults?: Map<string, CompanyResearchResult>;
  // Sprint V33: Company-level action handlers
  onEmailCompany?: (company: CompanyRow) => void;
  onSequenceCompany?: (company: CompanyRow) => void;
}

export function HitlistPanel({
  viewMode,
  selectedCompany,
  companies,
  filteredProspects,
  allProspects,
  isLoading,
  selectedProspect,
  onSelectProspect,
  onSelectCompany,
  currentUser,
  getEnrollmentForProspect,
  selection,
  onClearFilters,
  onGoToImport,
  onAddProspect,
  onUpdateProspect,
  onBookMeeting,
  onSendEmail,
  // Sprint 32: AI Research props
  onResearchClick,
  isResearchingCompany,
  researchResults,
  // Sprint V33: Company-level action handlers
  onEmailCompany,
  onSequenceCompany,
}: HitlistPanelProps) {

  // Sprint 203: Rapid-fire navigation (J/K)
  useEffect(() => {
    // Only active when a prospect is selected (Detail view open)
    // or arguably when list is focused, but let's stick to detail view context for now
    // actually rapid fire implies moving through list while seeing detail
    if (!selectedProspect) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if ((e.target as HTMLElement).isContentEditable) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        const idx = filteredProspects.findIndex(p => p.id === selectedProspect.id);
        if (idx !== -1 && idx < filteredProspects.length - 1) {
          e.preventDefault(); // Prevent page scroll
          onSelectProspect(filteredProspects[idx + 1]);
        }
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        const idx = filteredProspects.findIndex(p => p.id === selectedProspect.id);
        if (idx > 0) {
          e.preventDefault();
          onSelectProspect(filteredProspects[idx - 1]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProspect, filteredProspects, onSelectProspect]);

  if (viewMode === 'companies') {
    if (selectedCompany) {
      return (
        <CompanyDetailPanel
          company={selectedCompany}
          onContactSelect={onSelectProspect}
          onBack={() => onSelectCompany(null)}
          onResearchClick={onResearchClick ? () => onResearchClick(selectedCompany) : undefined}
          isResearching={isResearchingCompany === selectedCompany.company}
          research={researchResults?.get(selectedCompany.company) ?? null}
        />
      );
    }
    return (
      <CompanyListView
        companies={companies}
        onCompanySelect={onSelectCompany}
        onContactSelect={onSelectProspect}
        onResearchClick={onResearchClick}
        isResearching={isResearchingCompany}
        onEmailCompany={onEmailCompany}
        onSequenceCompany={onSequenceCompany}
      />
    );
  }

  // People View
  return (
    <div className="flex flex-1 overflow-hidden h-full">
      <div className="flex-1 min-w-0 h-full">
        <ProspectListPanel
          filteredProspects={filteredProspects}
          isLoading={isLoading}
          prospectsCount={allProspects.length}
          selectedProspectId={selectedProspect?.id || null}
          onSelectProspect={onSelectProspect}
          selection={selection}
          getEnrollmentForProspect={getEnrollmentForProspect}
          onClearFilters={onClearFilters}
          onGoToImport={onGoToImport}
          onAddProspect={onAddProspect}
          onCompanyClick={(companyName) => {
            // Find company row case-insensitive
            const company = companies.find(c => c.company.toLowerCase() === companyName.toLowerCase());
            if (company) {
              onSelectCompany(company);
            } else {
              // Fallback if company aggregation hasn't happened or text mismatch
              // We could potentially create a transient company object, but for now just log/noop
              console.warn(`Company row not found for: ${companyName}`);
            }
          }}
          currentUser={currentUser}
        />
      </div>
      {selectedProspect && (
        <div className="w-[400px] border-l border-slate-200 bg-white z-10 flex-shrink-0 h-full shadow-xl">
          <ProspectDetailPanel
            prospect={selectedProspect}
            currentUser={currentUser}
            onClose={() => onSelectProspect(null)}
            onUpdateProspect={onUpdateProspect}
            onBookMeeting={onBookMeeting}
            onSendEmail={onSendEmail}
            enrollment={getEnrollmentForProspect(selectedProspect.id)}
          />
        </div>
      )}
    </div>
  );
}

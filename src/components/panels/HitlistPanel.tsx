// src/components/panels/HitlistPanel.tsx
import React from 'react';
import { ViewMode } from '../ViewModeToggle';
import { CompanyRow } from '../../services/CompanyAggregator';
import { Prospect } from '../../types';
import { CompanyDetailPanel } from '../CompanyDetailPanel';
import { CompanyListView } from '../CompanyListView';
import { ProspectListPanel } from './ProspectListPanel';
import { ProspectDetailPanel } from './ProspectDetailPanel';

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
  currentUser: any;
  getEnrollmentForProspect: (id: string) => any;
  selection: SelectionState;
  onClearFilters: () => void;
  onGoToImport: () => void;
  onUpdateProspect: (updates: Partial<Prospect>) => Promise<void>;
  onBookMeeting: () => void;
  onSendEmail: (templateId: string, body: string, subject?: string) => Promise<void>;
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
  onUpdateProspect,
  onBookMeeting,
  onSendEmail
}: HitlistPanelProps) {

  if (viewMode === 'companies') {
    if (selectedCompany) {
      return (
        <CompanyDetailPanel
          company={selectedCompany}
          onContactSelect={onSelectProspect}
          onBack={() => onSelectCompany(null)}
        />
      );
    }
    return (
      <CompanyListView
        companies={companies}
        onCompanySelect={onSelectCompany}
        onContactSelect={onSelectProspect}
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
          // @ts-ignore - Local definition matches but TS might still complain about named types
          selection={selection}
          getEnrollmentForProspect={getEnrollmentForProspect}
          onClearFilters={onClearFilters}
          onGoToImport={onGoToImport}
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

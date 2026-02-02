import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { LazyIcon } from '../icons';
import { SequenceEnrollmentBadge } from '../SequenceEnrollmentBadge';
import { EmailQualityBadge } from '../EmailQualityBadge';
import { Prospect } from '../../types';

interface SelectionProps {
  isSelected: (id: string) => boolean;
  handleSelectionClick: (id: string, event: React.MouseEvent) => void;
  toggleSelection: (id: string, options?: { extend: boolean }) => void;
  toggleAll: () => void;
  isAllSelected: boolean;
}

interface ProspectListPanelProps {
  filteredProspects: Prospect[];
  isLoading?: boolean;
  prospectsCount: number; // Total prospects (unfiltered) count to determine empty state message
  selectedProspectId: string | null;
  onSelectProspect: (prospect: Prospect) => void;
  selection: SelectionProps;
  getEnrollmentForProspect: (id: string) => any;
  onClearFilters: () => void;
  onGoToImport: () => void;
  currentUser: string;
}

export function ProspectListPanel({
  filteredProspects,
  isLoading,
  prospectsCount,
  selectedProspectId,
  onSelectProspect,
  selection,
  getEnrollmentForProspect,
  onClearFilters,
  onGoToImport,
  currentUser
}: ProspectListPanelProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredProspects.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 65,
    overscan: 10,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ranking': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'new': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'contacted': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'meeting_booked': return 'bg-green-100 text-green-800 border-green-200';
      case 'bounced': return 'bg-red-100 text-red-800 border-red-200';
      case 'replied': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LazyIcon name="Loader" className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div role="grid" aria-label="Prospect list" aria-multiselectable="true" className="flex flex-col h-full bg-slate-50">
      <div
        role="row"
        className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center gap-3 text-[11px] font-semibold text-slate-500 uppercase flex-shrink-0"
      >
        <input
          ref={selectAllCheckboxRef}
          type="checkbox"
          aria-label="Select all prospects"
          data-testid="select-all-checkbox"
          checked={selection.isAllSelected}
          onChange={selection.toggleAll}
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="flex-1">Prospect</span>
        <span className="w-32 text-right">Company</span>
        <span className="w-20 text-right">Tier</span>
        <span className="w-28 text-right">Status</span>
        <span className="w-20 text-right">Enrollment</span>
      </div>

      <div 
        ref={parentRef}
        className="flex-1 overflow-auto"
        style={{ contain: 'strict' }}
      >
        {filteredProspects.length > 0 ? (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const prospect = filteredProspects[virtualRow.index];
              const isRowSelected = selection.isSelected(prospect.id);
              const isActive = selectedProspectId === prospect.id;
              
              return (
                <div
                  key={prospect.id}
                  role="row"
                  aria-selected={isRowSelected}
                  tabIndex={0}
                  onClick={() => onSelectProspect(prospect)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onSelectProspect(prospect);
                    }
                    if (e.key === ' ' || e.key === 'Spacebar') {
                      e.preventDefault();
                      selection.toggleSelection(prospect.id, { extend: e.ctrlKey || e.metaKey });
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={`px-4 py-3 flex items-start gap-3 cursor-pointer transition-colors relative focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 border-b border-slate-100 ${
                    isActive ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : isRowSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${prospect.name}`}
                    data-testid={`row-checkbox-${prospect.id}`}
                    checked={isRowSelected}
                    onClick={(e) => {
                      e.stopPropagation();
                      selection.handleSelectionClick(prospect.id, e);
                    }}
                    onChange={() => {}}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1.5">
                        <h3 className={`font-semibold text-sm truncate ${isActive ? 'text-blue-700' : 'text-slate-800'}`}>
                          {prospect.name}
                        </h3>
                        <EmailQualityBadge prospect={prospect} />
                      </div>
                      {prospect.lastEditedBy && prospect.lastEditedBy !== currentUser && prospect.status !== 'new' && (
                        <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0 ml-1" title={`Updated by ${prospect.lastEditedBy}`} aria-label={`Updated by ${prospect.lastEditedBy}`} />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{prospect.title}</p>
                  </div>

                  <div className="w-32 min-w-0 text-right">
                    <div className="text-xs font-medium text-slate-700 flex items-center justify-end gap-1">
                      <LazyIcon name="Briefcase" className="h-3 w-3 text-slate-400 flex-shrink-0" aria-hidden="true" />
                      <span className="truncate">{prospect.company}</span>
                    </div>
                  </div>

                  <div className="w-20 text-right flex-shrink-0">
                    <span className="inline-flex items-center justify-end text-[11px] font-semibold text-slate-600">
                      {prospect.tier}
                      {prospect.tier === 'Tier 1' && (
                        <span className="ml-1 flex h-2 w-2 rounded-full bg-orange-500 ring-2 ring-orange-100" title="Tier 1" aria-label="Tier 1 priority target" />
                      )}
                    </span>
                  </div>
                  <div className="w-28 text-right">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${getStatusColor(prospect.status)}`}>
                      {prospect.status === 'meeting_booked' ? 'BOOKED' : prospect.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="w-20 text-right flex-shrink-0">
                    <SequenceEnrollmentBadge 
                      enrollment={getEnrollmentForProspect(prospect.id)} 
                      compact 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center space-y-3" role="row">
            {prospectsCount === 0 ? (
              <>
                <p className="font-medium text-slate-600">No prospects loaded</p>
                <p className="text-slate-400 text-sm">Import data from the Import tab to get started.</p>
                <button
                  onClick={onGoToImport}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go to Import
                </button>
              </>
            ) : (
              <>
                <p className="font-medium text-slate-600">No matches for current filters</p>
                <p className="text-slate-400 text-sm">Try adjusting your filters or search query.</p>
                <button
                  onClick={onClearFilters}
                  className="px-4 py-2 bg-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Clear Filters
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

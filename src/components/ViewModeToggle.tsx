/**
 * View Mode Toggle Component
 * 
 * Toggles between People (person-centric) and Company (company-centric) views.
 * 
 * Sprint 72: T72.2 - View Toggle Switch
 */

import { Users, Building2 } from 'lucide-react';

export type ViewMode = 'people' | 'companies';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  peopleCount?: number;
  companyCount?: number;
}

export function ViewModeToggle({
  viewMode,
  onViewModeChange,
  peopleCount,
  companyCount,
}: ViewModeToggleProps) {
  return (
    <div
      className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200"
      role="group"
      aria-label="View mode selection"
    >
      <button
        onClick={() => onViewModeChange('companies')}
        aria-pressed={viewMode === 'companies'}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
          viewMode === 'companies'
            ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
            : 'text-slate-500 hover:text-slate-700'
        }`}
        title="Company-centric view"
      >
        <Building2 className="h-3.5 w-3.5" />
        <span>Companies</span>
        {companyCount !== undefined && (
          <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded ${
            viewMode === 'companies' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'
          }`}>
            {companyCount}
          </span>
        )}
      </button>
      
      <button
        onClick={() => onViewModeChange('people')}
        aria-pressed={viewMode === 'people'}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
          viewMode === 'people'
            ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
            : 'text-slate-500 hover:text-slate-700'
        }`}
        title="Person-centric view"
      >
        <Users className="h-3.5 w-3.5" />
        <span>People</span>
        {peopleCount !== undefined && (
          <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded ${
            viewMode === 'people' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'
          }`}>
            {peopleCount}
          </span>
        )}
      </button>
    </div>
  );
}

export default ViewModeToggle;

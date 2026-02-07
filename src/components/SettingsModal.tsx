import React from 'react';
import { LazyIcon } from './icons';
import type { Prospect } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prospects: Prospect[];
}

/**
 * Settings modal with data export functionality
 * Extracted from App.tsx for maintainability
 */
export function SettingsModal({ isOpen, onClose, prospects }: SettingsModalProps): React.ReactElement | null {
  if (!isOpen) return null;

  const handleExportJSON = () => {
    const data = {
      prospects: prospects,
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yardflow-prospects-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Company', 'Title', 'Tier', 'Status', 'Score'];
    const csvRows = [
      headers.join(','),
      ...prospects.map(p => [
        `"${p.name}"`,
        `"${p.company}"`,
        `"${p.title}"`,
        p.tier,
        p.status,
        p.score
      ].join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yardflow-prospects-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 id="settings-title" className="text-lg font-bold text-slate-800 mb-4 flex items-center">
          <LazyIcon name="Settings" className="h-5 w-5 mr-2 text-slate-500" aria-hidden="true" />
          Settings
        </h3>
        
        {/* AI Configuration Note */}
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <p className="font-medium">AI Configuration</p>
          <p className="text-xs mt-1">AI features are powered by the Railway backend. No API key configuration needed.</p>
        </div>
        
        {/* Data Management Section */}
        <div className="border-t border-slate-200 pt-4 mb-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Data Management</h4>
          <div className="space-y-2">
            <button
              onClick={handleExportJSON}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                <LazyIcon name="Download" className="h-4 w-4 text-slate-500" />
                Export Prospects (JSON)
              </span>
              <span className="text-xs text-slate-400">{prospects.length} records</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors"
            >
              <span className="flex items-center gap-2">
                <LazyIcon name="Download" className="h-4 w-4 text-slate-500" />
                Export Prospects (CSV)
              </span>
              <span className="text-xs text-slate-400">Spreadsheet format</span>
            </button>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button 
            onClick={onClose}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

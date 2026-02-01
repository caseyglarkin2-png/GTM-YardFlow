import React from 'react';
import { Upload, Mail } from 'lucide-react';

export interface ImportTabProps {
  onOpenImportWizard: () => void;
  onOpenEmailImport?: () => void;
}

/**
 * ImportTab - Import center for CSV/LinkedIn data
 * 
 * Self-contained component for triggering the import wizard.
 * Displays import features and CSV upload button.
 */
export function ImportTab({ onOpenImportWizard, onOpenEmailImport }: ImportTabProps): React.ReactElement {
  return (
    <div className="p-6 space-y-6">
      <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-xl p-6 text-white shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <Upload className="h-5 w-5" />
          <span className="text-green-100 text-xs font-medium uppercase tracking-wider">Import Center</span>
        </div>
        <div className="text-2xl font-bold">LinkedIn Sales Navigator</div>
        <div className="text-green-200 text-xs mt-2">Import contacts from CSV exports</div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={onOpenImportWizard}
          className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
        >
          <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
          <div className="text-sm font-medium text-slate-700">Import New Contacts</div>
          <div className="text-xs text-slate-500 mt-1">LinkedIn Sales Navigator CSV</div>
        </button>
        
        {onOpenEmailImport && (
          <button
            onClick={onOpenEmailImport}
            className="bg-white border-2 border-dashed border-purple-300 rounded-xl p-6 text-center hover:border-purple-400 hover:bg-purple-50/50 transition-colors"
          >
            <Mail className="h-10 w-10 text-purple-400 mx-auto mb-3" />
            <div className="text-sm font-medium text-slate-700">Import Emails</div>
            <div className="text-xs text-slate-500 mt-1">Add emails to existing prospects</div>
          </button>
        )}
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="text-sm font-bold text-blue-800 mb-2">Import Features</h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>✓ Automatic column mapping</li>
          <li>✓ Duplicate detection & merging</li>
          <li>✓ Company matching</li>
          <li>✓ Tier classification</li>
          <li>✓ Email matching to existing prospects</li>
        </ul>
      </div>
    </div>
  );
}

export default ImportTab;

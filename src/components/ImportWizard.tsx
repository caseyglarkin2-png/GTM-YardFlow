/**
 * Import Wizard Component - YardFlow Hub
 * 
 * Multi-step wizard for importing LinkedIn Sales Navigator CSV exports.
 * Handles file upload, column mapping, duplicate detection, and import confirmation.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { parseLinkedInCsv, validateLinkedInCsv, type LinkedInParseResult, type LinkedInContact } from '../services/LinkedInCsvParser';
import { DuplicateDetector, type DuplicatePair } from '../services/DuplicateDetector';
import { CompanyMatcher, type CompanyMatch } from '../services/CompanyMatcher';
import type { Prospect, Company } from '../types';

// ============================================
// Types
// ============================================

export type ImportStep = 'upload' | 'preview' | 'duplicates' | 'confirm' | 'complete';

export interface ImportWizardProps {
  /** Existing prospects for duplicate detection */
  existingProspects?: Prospect[];
  /** Existing companies for company matching */
  existingCompanies?: Company[];
  /** Called when import is complete */
  onComplete: (imported: Prospect[]) => void;
  /** Called when wizard is cancelled */
  onCancel: () => void;
  /** Custom class name */
  className?: string;
}

export interface ImportProgress {
  current: number;
  total: number;
  status: 'idle' | 'parsing' | 'checking' | 'importing' | 'complete' | 'error';
  message: string;
}

export interface DuplicateResolution {
  contactId: string;
  action: 'skip' | 'merge' | 'import';
  mergeWithId?: string;
}

// ============================================
// Step Components
// ============================================

interface UploadStepProps {
  onFileSelect: (file: File) => void;
  onPaste: (content: string) => void;
  isLoading: boolean;
  error: string | null;
}

const UploadStep: React.FC<UploadStepProps> = ({
  onFileSelect,
  onPaste,
  isLoading,
  error,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteContent, setPasteContent] = useState('');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  }, [onFileSelect]);

  const handlePaste = useCallback(() => {
    if (pasteContent.trim()) {
      onPaste(pasteContent);
    }
  }, [pasteContent, onPaste]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900">Import LinkedIn Contacts</h2>
        <p className="mt-2 text-gray-600">
          Upload a CSV export from LinkedIn Sales Navigator
        </p>
      </div>

      {!pasteMode ? (
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-8
            transition-colors cursor-pointer
            ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            ${isLoading ? 'opacity-50 pointer-events-none' : ''}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isLoading}
            aria-label="Upload CSV file"
          />
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
            </p>
            <p className="mt-1 text-xs text-gray-500">CSV files only</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <textarea
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            placeholder="Paste CSV content here..."
            className="w-full h-48 p-4 border rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
            aria-label="Paste CSV content"
          />
          <button
            onClick={handlePaste}
            disabled={!pasteContent.trim() || isLoading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Parse CSV
          </button>
        </div>
      )}

      <div className="text-center">
        <button
          onClick={() => setPasteMode(!pasteMode)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {pasteMode ? 'Upload file instead' : 'Or paste CSV content'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-3 text-gray-600">Parsing CSV...</span>
        </div>
      )}
    </div>
  );
};

interface PreviewStepProps {
  parseResult: LinkedInParseResult;
  onContinue: () => void;
  onBack: () => void;
}

const PreviewStep: React.FC<PreviewStepProps> = ({
  parseResult,
  onContinue,
  onBack,
}) => {
  const { contacts, columnMap, errors } = parseResult;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900">Preview Import</h2>
        <p className="mt-2 text-gray-600">
          Review the data before importing
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-green-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-600">{contacts.length}</p>
          <p className="text-sm text-green-700">Contacts Found</p>
        </div>
        <div className="p-4 bg-blue-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-600">
            {Object.values(columnMap).filter(Boolean).length}
          </p>
          <p className="text-sm text-blue-700">Fields Mapped</p>
        </div>
        {errors.length > 0 && (
          <div className="p-4 bg-yellow-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-yellow-600">{errors.length}</p>
            <p className="text-sm text-yellow-700">Warnings</p>
          </div>
        )}
      </div>

      {/* Column Mapping Preview */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b">
          <h3 className="font-medium text-gray-700">Column Mapping</h3>
        </div>
        <div className="p-4 grid grid-cols-2 gap-2 text-sm">
          {Object.entries(columnMap).map(([field, column]) => (
            <div key={field} className="flex justify-between">
              <span className="text-gray-500">{field}:</span>
              <span className={column ? 'text-gray-900' : 'text-gray-400'}>
                {column || 'Not mapped'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Sample Data */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b">
          <h3 className="font-medium text-gray-700">Sample Data (First 5)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Title</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Company</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Email</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contacts.slice(0, 5).map((contact, index) => (
                <tr key={index}>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {contact.firstName} {contact.lastName}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">{contact.title || '-'}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{contact.company || '-'}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{contact.email || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Errors/Warnings */}
      {errors.length > 0 && (
        <div className="border border-yellow-200 rounded-lg overflow-hidden">
          <div className="bg-yellow-50 px-4 py-2 border-b border-yellow-200">
            <h3 className="font-medium text-yellow-700">Warnings</h3>
          </div>
          <ul className="p-4 space-y-1 max-h-32 overflow-y-auto">
            {errors.slice(0, 10).map((error, index) => (
              <li key={index} className="text-sm text-yellow-600">
                Row {error.row}: {error.message}
              </li>
            ))}
            {errors.length > 10 && (
              <li className="text-sm text-yellow-600">
                ...and {errors.length - 10} more warnings
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={onContinue}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Check Duplicates
        </button>
      </div>
    </div>
  );
};

interface DuplicateStepProps {
  duplicates: DuplicatePair[];
  resolutions: Map<string, DuplicateResolution>;
  onResolve: (contactId: string, resolution: DuplicateResolution) => void;
  onContinue: () => void;
  onBack: () => void;
}

const DuplicateStep: React.FC<DuplicateStepProps> = ({
  duplicates,
  resolutions,
  onResolve,
  onContinue,
  onBack,
}) => {
  if (duplicates.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">No Duplicates Found</h2>
          <p className="mt-2 text-gray-600">All contacts are unique and ready to import</p>
        </div>
        <div className="flex justify-between pt-4">
          <button
            onClick={onBack}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={onContinue}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Continue to Import
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900">Resolve Duplicates</h2>
        <p className="mt-2 text-gray-600">
          We found {duplicates.length} potential duplicate{duplicates.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {duplicates.map((pair) => {
          const resolution = resolutions.get(pair.duplicate.id);
          const action = resolution?.action || 'skip';

          return (
            <div
              key={pair.duplicate.id}
              className="border rounded-lg p-4 space-y-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-gray-900">{pair.duplicate.name}</p>
                  <p className="text-sm text-gray-500">{pair.duplicate.company}</p>
                  <p className="text-sm text-gray-500">{pair.duplicate.email}</p>
                </div>
                <span
                  className={`
                    px-2 py-1 text-xs rounded-full
                    ${pair.confidence === 'exact' ? 'bg-red-100 text-red-700' : ''}
                    ${pair.confidence === 'high' ? 'bg-orange-100 text-orange-700' : ''}
                    ${pair.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' : ''}
                    ${pair.confidence === 'low' ? 'bg-gray-100 text-gray-700' : ''}
                  `}
                >
                  {pair.confidence} match ({pair.score}%)
                </span>
              </div>

              <div className="text-sm text-gray-500">
                Matches existing: <span className="font-medium">{pair.original.name}</span>
                {' '}({pair.matchedFields.join(', ')})
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onResolve(pair.duplicate.id, { contactId: pair.duplicate.id, action: 'skip' })}
                  className={`
                    flex-1 py-2 px-3 text-sm rounded-lg border
                    ${action === 'skip' ? 'bg-gray-100 border-gray-400' : 'border-gray-300 hover:bg-gray-50'}
                  `}
                >
                  Skip
                </button>
                <button
                  onClick={() => onResolve(pair.duplicate.id, { 
                    contactId: pair.duplicate.id, 
                    action: 'merge',
                    mergeWithId: pair.original.id,
                  })}
                  className={`
                    flex-1 py-2 px-3 text-sm rounded-lg border
                    ${action === 'merge' ? 'bg-blue-100 border-blue-400' : 'border-gray-300 hover:bg-gray-50'}
                  `}
                >
                  Merge
                </button>
                <button
                  onClick={() => onResolve(pair.duplicate.id, { contactId: pair.duplicate.id, action: 'import' })}
                  className={`
                    flex-1 py-2 px-3 text-sm rounded-lg border
                    ${action === 'import' ? 'bg-green-100 border-green-400' : 'border-gray-300 hover:bg-gray-50'}
                  `}
                >
                  Import Anyway
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={onContinue}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Continue to Import
        </button>
      </div>
    </div>
  );
};

interface ConfirmStepProps {
  totalContacts: number;
  toImport: number;
  toMerge: number;
  toSkip: number;
  onImport: () => void;
  onBack: () => void;
  isImporting: boolean;
  progress: ImportProgress;
}

const ConfirmStep: React.FC<ConfirmStepProps> = ({
  totalContacts,
  toImport,
  toMerge,
  toSkip,
  onImport,
  onBack,
  isImporting,
  progress,
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900">Confirm Import</h2>
        <p className="mt-2 text-gray-600">Review your import summary</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-600">{totalContacts}</p>
          <p className="text-sm text-blue-700">Total Contacts</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-600">{toImport}</p>
          <p className="text-sm text-green-700">New Imports</p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-purple-600">{toMerge}</p>
          <p className="text-sm text-purple-700">To Merge</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-gray-600">{toSkip}</p>
          <p className="text-sm text-gray-700">Skipped</p>
        </div>
      </div>

      {isImporting && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{progress.message}</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          disabled={isImporting}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={onImport}
          disabled={isImporting || toImport + toMerge === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {isImporting ? 'Importing...' : `Import ${toImport + toMerge} Contacts`}
        </button>
      </div>
    </div>
  );
};

interface CompleteStepProps {
  imported: number;
  merged: number;
  skipped: number;
  onClose: () => void;
}

const CompleteStep: React.FC<CompleteStepProps> = ({
  imported,
  merged,
  skipped,
  onClose,
}) => {
  return (
    <div className="space-y-6 text-center">
      <svg
        className="mx-auto h-16 w-16 text-green-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>

      <div>
        <h2 className="text-xl font-semibold text-gray-900">Import Complete!</h2>
        <p className="mt-2 text-gray-600">Your contacts have been imported successfully</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-2xl font-bold text-green-600">{imported}</p>
          <p className="text-sm text-green-700">New</p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg">
          <p className="text-2xl font-bold text-purple-600">{merged}</p>
          <p className="text-sm text-purple-700">Merged</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-600">{skipped}</p>
          <p className="text-sm text-gray-700">Skipped</p>
        </div>
      </div>

      <button
        onClick={onClose}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Done
      </button>
    </div>
  );
};

// ============================================
// Main Import Wizard Component
// ============================================

export const ImportWizard: React.FC<ImportWizardProps> = ({
  existingProspects = [],
  existingCompanies = [],
  onComplete,
  onCancel,
  className = '',
}) => {
  // State
  const [step, setStep] = useState<ImportStep>('upload');
  const [parseResult, setParseResult] = useState<LinkedInParseResult | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [resolutions, setResolutions] = useState<Map<string, DuplicateResolution>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress>({
    current: 0,
    total: 0,
    status: 'idle',
    message: '',
  });
  const [importedCount, setImportedCount] = useState(0);
  const [mergedCount, setMergedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  // Initialize services
  const duplicateDetector = useMemo(() => {
    const detector = new DuplicateDetector();
    detector.loadProspects(existingProspects);
    return detector;
  }, [existingProspects]);

  const companyMatcher = useMemo(() => {
    const matcher = new CompanyMatcher();
    matcher.loadCompanies(existingCompanies);
    return matcher;
  }, [existingCompanies]);

  // Convert LinkedIn contact to Prospect
  const contactToProspect = useCallback((contact: LinkedInContact, companyMatch?: CompanyMatch): Prospect => {
    const now = Date.now();
    return {
      id: `import-${now}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${contact.firstName} ${contact.lastName}`.trim(),
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
      title: contact.title || '',
      linkedinUrl: contact.linkedInUrl || '',
      industry: contact.industry || companyMatch?.company.industry || '',
      location: contact.location || '',
      source: 'linkedin',
      status: 'new',
      tier: '3',
      score: 0,
      isOps: false,
      isExec: false,
      tags: ['linkedin-import'],
      notes: contact.notes || '',
      createdAt: now,
      updatedAt: now,
    };
  }, []);

  // Handlers
  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const content = await file.text();
      const result = parseLinkedInCsv(content);
      
      if (result.contacts.length === 0) {
        throw new Error('No contacts found in CSV file');
      }

      setParseResult(result);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePaste = useCallback((content: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const validation = validateLinkedInCsv(content);
      if (!validation.valid) {
        throw new Error(`Invalid CSV: missing required columns (${validation.missingRequired.join(', ')})`);
      }

      const result = parseLinkedInCsv(content);
      
      if (result.contacts.length === 0) {
        throw new Error('No contacts found in CSV content');
      }

      setParseResult(result);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV content');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCheckDuplicates = useCallback(() => {
    if (!parseResult) return;

    setProgress({ current: 0, total: parseResult.contacts.length, status: 'checking', message: 'Checking for duplicates...' });

    // Convert contacts to prospects for duplicate checking
    const importProspects = parseResult.contacts.map((contact) => {
      const companyMatch = companyMatcher.findBestMatch({ companyName: contact.company });
      return contactToProspect(contact, companyMatch || undefined);
    });

    // Find duplicates
    const result = duplicateDetector.findImportDuplicates(importProspects);

    setDuplicates(result.duplicatePairs);

    // Set default resolutions (skip for high confidence, review for others)
    const defaultResolutions = new Map<string, DuplicateResolution>();
    for (const pair of result.duplicatePairs) {
      defaultResolutions.set(pair.duplicate.id, {
        contactId: pair.duplicate.id,
        action: pair.recommendation === 'merge' ? 'skip' : 'import',
      });
    }
    setResolutions(defaultResolutions);

    setStep('duplicates');
  }, [parseResult, duplicateDetector, companyMatcher, contactToProspect]);

  const handleResolve = useCallback((contactId: string, resolution: DuplicateResolution) => {
    setResolutions((prev) => {
      const next = new Map(prev);
      next.set(contactId, resolution);
      return next;
    });
  }, []);

  const handleImport = useCallback(async () => {
    if (!parseResult) return;

    setProgress({
      current: 0,
      total: parseResult.contacts.length,
      status: 'importing',
      message: 'Importing contacts...',
    });

    const imported: Prospect[] = [];
    let newCount = 0;
    let mergeCount = 0;
    let skipCount = 0;

    // Get duplicate IDs that should be skipped
    const skipIds = new Set<string>();
    const mergeMap = new Map<string, string>(); // duplicate ID -> original ID

    for (const pair of duplicates) {
      const resolution = resolutions.get(pair.duplicate.id);
      if (resolution?.action === 'skip') {
        skipIds.add(pair.duplicate.id);
      } else if (resolution?.action === 'merge' && resolution.mergeWithId) {
        mergeMap.set(pair.duplicate.id, resolution.mergeWithId);
      }
    }

    // Process contacts
    for (let i = 0; i < parseResult.contacts.length; i++) {
      const contact = parseResult.contacts[i];
      const companyMatch = companyMatcher.findBestMatch({ companyName: contact.company });
      const prospect = contactToProspect(contact, companyMatch || undefined);

      // Check if this prospect should be skipped (by matching against generated ID pattern)
      const matchingDuplicate = duplicates.find(
        (d) => d.duplicate.name === prospect.name && d.duplicate.email === prospect.email
      );

      if (matchingDuplicate && skipIds.has(matchingDuplicate.duplicate.id)) {
        skipCount++;
      } else if (matchingDuplicate && mergeMap.has(matchingDuplicate.duplicate.id)) {
        // Find original and merge
        const originalId = mergeMap.get(matchingDuplicate.duplicate.id);
        const original = existingProspects.find((p) => p.id === originalId);
        if (original) {
          const merged = duplicateDetector.mergeProspects(original, prospect);
          imported.push(merged);
          mergeCount++;
        } else {
          imported.push(prospect);
          newCount++;
        }
      } else {
        imported.push(prospect);
        newCount++;
      }

      setProgress({
        current: i + 1,
        total: parseResult.contacts.length,
        status: 'importing',
        message: `Importing ${contact.firstName} ${contact.lastName}...`,
      });

      // Small delay to show progress
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    setImportedCount(newCount);
    setMergedCount(mergeCount);
    setSkippedCount(skipCount);
    setProgress({ current: parseResult.contacts.length, total: parseResult.contacts.length, status: 'complete', message: 'Import complete!' });
    setStep('complete');
    onComplete(imported);
  }, [parseResult, duplicates, resolutions, contactToProspect, companyMatcher, duplicateDetector, existingProspects, onComplete]);

  // Calculate import summary
  const importSummary = useMemo(() => {
    if (!parseResult) return { total: 0, toImport: 0, toMerge: 0, toSkip: 0 };

    const total = parseResult.contacts.length;
    let toSkip = 0;
    let toMerge = 0;

    for (const pair of duplicates) {
      const resolution = resolutions.get(pair.duplicate.id);
      if (resolution?.action === 'skip') toSkip++;
      else if (resolution?.action === 'merge') toMerge++;
    }

    return { total, toImport: total - toSkip, toMerge, toSkip };
  }, [parseResult, duplicates, resolutions]);

  // Render step indicator
  const steps: { key: ImportStep; label: string }[] = [
    { key: 'upload', label: 'Upload' },
    { key: 'preview', label: 'Preview' },
    { key: 'duplicates', label: 'Duplicates' },
    { key: 'confirm', label: 'Confirm' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className={`bg-white rounded-xl shadow-lg max-w-2xl mx-auto ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <h1 className="text-lg font-semibold text-gray-900">Import LinkedIn Contacts</h1>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Step Indicator */}
      {step !== 'complete' && (
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            {steps.map((s, index) => (
              <React.Fragment key={s.key}>
                <div className="flex items-center">
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                      ${index < currentStepIndex ? 'bg-green-500 text-white' : ''}
                      ${index === currentStepIndex ? 'bg-blue-600 text-white' : ''}
                      ${index > currentStepIndex ? 'bg-gray-200 text-gray-500' : ''}
                    `}
                  >
                    {index < currentStepIndex ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={`ml-2 text-sm hidden sm:block ${
                      index <= currentStepIndex ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 ${
                      index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="p-6">
        {step === 'upload' && (
          <UploadStep
            onFileSelect={handleFileSelect}
            onPaste={handlePaste}
            isLoading={isLoading}
            error={error}
          />
        )}

        {step === 'preview' && parseResult && (
          <PreviewStep
            parseResult={parseResult}
            onContinue={handleCheckDuplicates}
            onBack={() => setStep('upload')}
          />
        )}

        {step === 'duplicates' && (
          <DuplicateStep
            duplicates={duplicates}
            resolutions={resolutions}
            onResolve={handleResolve}
            onContinue={() => setStep('confirm')}
            onBack={() => setStep('preview')}
          />
        )}

        {step === 'confirm' && (
          <ConfirmStep
            totalContacts={importSummary.total}
            toImport={importSummary.toImport}
            toMerge={importSummary.toMerge}
            toSkip={importSummary.toSkip}
            onImport={handleImport}
            onBack={() => setStep('duplicates')}
            isImporting={progress.status === 'importing'}
            progress={progress}
          />
        )}

        {step === 'complete' && (
          <CompleteStep
            imported={importedCount}
            merged={mergedCount}
            skipped={skippedCount}
            onClose={onCancel}
          />
        )}
      </div>
    </div>
  );
};

export default ImportWizard;

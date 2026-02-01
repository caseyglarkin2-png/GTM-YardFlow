/**
 * EmailImportModal - Import email addresses from CSV to existing prospects
 * 
 * Features:
 * - Drag and drop CSV upload
 * - Preview matches before applying
 * - Download unmatched rows for manual review
 * - Confidence-based matching with visual indicators
 */

import React, { useState, useCallback } from 'react';
import { LazyIcon } from './icons';
import {
  parseCSV,
  matchEmailsToProspects,
  exportUnmatchedToCSV,
  readFileAsText,
  type MatchResult,
  type ImportRow,
  type ImportResult,
  type ProspectForMatching,
} from '../services/EmailImportService';
import type { Prospect } from '../types';

interface EmailImportModalProps {
  prospects: Prospect[];
  onImportComplete: (updates: Array<{ id: string; email: string; emailSource: string }>) => void;
  onClose: () => void;
}

type ImportStep = 'upload' | 'preview' | 'complete';

export function EmailImportModal({ prospects, onImportComplete, onClose }: EmailImportModalProps): React.ReactElement {
  const [step, setStep] = useState<ImportStep>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);

  // Convert prospects to matching format (only those without email)
  const prospectsForMatching: ProspectForMatching[] = prospects.map(p => ({
    id: p.id,
    name: p.name,
    company: p.company,
    email: p.email,
  }));

  const handleFileUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      // Check file type
      if (!file.name.endsWith('.csv')) {
        throw new Error('Please upload a CSV file. XLSX support coming soon.');
      }

      const content = await readFileAsText(file);
      const rows = parseCSV(content);

      if (rows.length === 0) {
        throw new Error('No valid email rows found in the CSV. Make sure there is an "Email" column.');
      }

      const result = matchEmailsToProspects(rows, prospectsForMatching);
      setImportResult(result);

      // Auto-select all strong matches
      const autoSelected = new Set(
        result.matched
          .filter(m => m.matchType === 'strong' || m.confidence >= 70)
          .map(m => m.prospectId)
      );
      setSelectedMatches(autoSelected);

      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
    } finally {
      setIsLoading(false);
    }
  }, [prospectsForMatching]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const toggleMatch = (prospectId: string) => {
    setSelectedMatches(prev => {
      const next = new Set(prev);
      if (next.has(prospectId)) {
        next.delete(prospectId);
      } else {
        next.add(prospectId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!importResult) return;
    setSelectedMatches(new Set(importResult.matched.map(m => m.prospectId)));
  };

  const deselectAll = () => {
    setSelectedMatches(new Set());
  };

  const handleApplyEmails = () => {
    if (!importResult) return;

    const updates = importResult.matched
      .filter(m => selectedMatches.has(m.prospectId))
      .map(m => ({
        id: m.prospectId,
        email: m.email,
        emailSource: 'csv_import',
      }));

    onImportComplete(updates);
    setStep('complete');
  };

  const handleDownloadUnmatched = () => {
    if (!importResult || importResult.unmatched.length === 0) return;

    const csv = exportUnmatchedToCSV(importResult.unmatched);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'unmatched-emails.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getConfidenceBadge = (match: MatchResult) => {
    if (match.matchType === 'strong') {
      return <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Strong</span>;
    }
    if (match.matchType === 'medium') {
      return <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Medium</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">Weak</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <LazyIcon name="Mail" className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Import Emails</h2>
              <p className="text-xs text-slate-500">
                {step === 'upload' && 'Upload a CSV with email addresses'}
                {step === 'preview' && 'Review and apply matches'}
                {step === 'complete' && 'Import complete'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <LazyIcon name="X" className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Drop zone */}
              <div
                className={`
                  border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer
                  ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'}
                  ${isLoading ? 'opacity-50 pointer-events-none' : ''}
                `}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('email-import-file')?.click()}
              >
                <input
                  id="email-import-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="hidden"
                />
                <LazyIcon name="Upload" className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 font-medium">
                  {isLoading ? 'Processing...' : 'Drop CSV here or click to browse'}
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  CSV must have an "Email" column. Matches by Full Name + Company.
                </p>
              </div>

              {/* Help text */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <LazyIcon name="Info" className="h-4 w-4 text-blue-500" />
                  How it works
                </h4>
                <ul className="text-sm text-slate-600 space-y-1">
                  <li>• Upload a CSV with email addresses and contact names</li>
                  <li>• We'll match emails to your existing prospects</li>
                  <li>• Strong matches are auto-selected, review weaker ones</li>
                  <li>• Download unmatched rows for manual review</li>
                </ul>
              </div>

              {/* Existing CSV files in repo */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium text-blue-700 mb-2 flex items-center gap-2">
                  <LazyIcon name="FileText" className="h-4 w-4" />
                  Tip: CSV files in this repo
                </h4>
                <p className="text-sm text-blue-600">
                  The workspace has "Manifest Contacts 2026" CSV with emails. 
                  Export from the repo root and upload here.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <LazyIcon name="AlertCircle" className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-700">Import Error</p>
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && importResult && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-700">{importResult.stats.matchedCount}</div>
                  <div className="text-xs text-green-600">Matched</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-slate-700">{importResult.stats.unmatchedCount}</div>
                  <div className="text-xs text-slate-600">Unmatched</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-700">{selectedMatches.size}</div>
                  <div className="text-xs text-blue-600">Selected</div>
                </div>
              </div>

              {/* Match list */}
              {importResult.matched.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-200">
                    <span className="text-sm font-medium text-slate-700">Matched Emails</span>
                    <div className="flex gap-2">
                      <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">Select All</button>
                      <span className="text-slate-300">|</span>
                      <button onClick={deselectAll} className="text-xs text-slate-500 hover:underline">Deselect All</button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {importResult.matched.map((match) => (
                      <label
                        key={match.prospectId}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMatches.has(match.prospectId)}
                          onChange={() => toggleMatch(match.prospectId)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800 truncate">{match.prospectName}</span>
                            {getConfidenceBadge(match)}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {match.prospectCompany} → <span className="text-blue-600">{match.email}</span>
                          </div>
                        </div>
                        <span className="text-xs text-slate-400">{match.confidence}%</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Unmatched warning */}
              {importResult.unmatched.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LazyIcon name="AlertTriangle" className="h-5 w-5 text-amber-600" />
                      <span className="font-medium text-amber-700">
                        {importResult.unmatched.length} rows couldn't be matched
                      </span>
                    </div>
                    <button
                      onClick={handleDownloadUnmatched}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200"
                    >
                      <LazyIcon name="Download" className="h-3 w-3" />
                      Download CSV
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-12">
              <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <LazyIcon name="CheckCircle" className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Import Complete!</h3>
              <p className="text-slate-600">
                {selectedMatches.size} email addresses have been added to your prospects.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50">
          {step === 'upload' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg"
            >
              Cancel
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg"
              >
                Back
              </button>
              <button
                onClick={handleApplyEmails}
                disabled={selectedMatches.size === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LazyIcon name="Check" className="h-4 w-4" />
                Apply {selectedMatches.size} Emails
              </button>
            </>
          )}

          {step === 'complete' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmailImportModal;

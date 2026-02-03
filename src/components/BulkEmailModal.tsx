/**
 * BulkEmailModal - Sprint 22A: T22A.2
 * 
 * Modal for sending emails to multiple selected prospects at once.
 * Features:
 * - Template selection
 * - Subject/body editing
 * - Live preview with personalization
 * - Progress indicator during send
 * - Count of eligible vs skipped prospects
 * - Expandable list of skipped prospects with reasons
 * - Inline email editing for prospects missing emails
 * - Per-prospect send results with retry
 * 
 * Sprint UX-1: Enhanced with better feedback and inline editing
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LazyIcon } from './icons';
import { EMAIL_TEMPLATES, personalizeTemplate, type EmailTemplate } from '../config/emailTemplates';
import { TONE_OPTIONS, DEFAULT_TONE, getTone, type ToneId } from '../config/tones';
import { CALENDLY_CONFIG } from '../config/calendly';
import { useAIGenerate } from '../hooks/useAIGenerate';
import { isValidEmail } from '../utils/emailValidator';
import type { Prospect } from '../types';

/** Result for a single email send attempt */
export interface EmailSendResult {
  prospectId: string;
  prospectName: string;
  email: string;
  success: boolean;
  error?: string;
}

export interface BulkEmailProgress {
  sent: number;
  total: number;
  failed: number;
  results?: EmailSendResult[];
}

/** Reason a prospect is skipped */
type SkipReason = 'no_email' | 'invalid_email' | 'in_sequence';

interface SkippedProspect {
  id: string;
  name: string;
  company: string;
  reason: SkipReason;
  email?: string;
}

/** Modal state machine */
type ModalState = 'composing' | 'sending' | 'results';

export interface BulkEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (subject: string, body: string, templateId: string) => Promise<void>;
  selectedProspects: Prospect[];
  isSending: boolean;
  progress?: BulkEmailProgress;
  onUpdateProspect?: (id: string, updates: Partial<Prospect>) => Promise<void>;
}

export function BulkEmailModal({
  isOpen,
  onClose,
  onConfirm,
  selectedProspects,
  isSending,
  progress = { sent: 0, total: 0, failed: 0 },
  onUpdateProspect,
}: BulkEmailModalProps) {
  const [templateId, setTemplateId] = useState(EMAIL_TEMPLATES[0]?.id || 'intro_yardflow');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTone, setSelectedTone] = useState<ToneId>(DEFAULT_TONE);
  const [showPreview, setShowPreview] = useState(false);
  const [showSkippedList, setShowSkippedList] = useState(false);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  
  // AI generation hook
  const { generate: generateAI, isGenerating, error: aiError, clearError: clearAIError } = useAIGenerate();
  
  // Track local email updates for immediate UI feedback
  const [localEmailUpdates, setLocalEmailUpdates] = useState<Record<string, string>>({});
  
  // Determine modal state
  const modalState: ModalState = useMemo(() => {
    if (progress.results && progress.results.length > 0) return 'results';
    if (isSending) return 'sending';
    return 'composing';
  }, [isSending, progress.results]);

  // Get current template
  const currentTemplate = useMemo(
    () => EMAIL_TEMPLATES.find(t => t.id === templateId) || EMAIL_TEMPLATES[0],
    [templateId]
  );

  // Apply local email updates to prospects for immediate UI feedback
  const prospectsWithUpdates = useMemo(() => 
    selectedProspects.map(p => ({
      ...p,
      email: localEmailUpdates[p.id] || p.email,
    })),
    [selectedProspects, localEmailUpdates]
  );

  // Categorize prospects: sendable vs skipped (with reasons)
  const { withEmail, skippedProspects } = useMemo(() => {
    const sendable: Prospect[] = [];
    const skipped: SkippedProspect[] = [];
    
    for (const p of prospectsWithUpdates) {
      if (!p.email) {
        skipped.push({ id: p.id, name: p.name, company: p.company, reason: 'no_email' });
      } else if (!isValidEmail(p.email)) {
        skipped.push({ id: p.id, name: p.name, company: p.company, reason: 'invalid_email', email: p.email });
      } else {
        sendable.push(p);
      }
    }
    
    return { withEmail: sendable, skippedProspects: skipped };
  }, [prospectsWithUpdates]);

  // For backwards compatibility
  const withoutEmail = skippedProspects;

  // Validation: subject and body required
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!subject.trim()) errors.push('Subject is required');
    if (!body.trim()) errors.push('Message body is required');
    return errors;
  }, [subject, body]);

  const canSend = withEmail.length > 0 && validationErrors.length === 0;

  // Sample prospect for preview (first one with email)
  const sampleProspect = withEmail[0] || {
    name: 'John Doe',
    company: 'Acme Logistics',
    title: 'VP Operations',
  };

  // Update subject/body when template changes
  useEffect(() => {
    if (currentTemplate) {
      setSubject(currentTemplate.subject);
      setBody(currentTemplate.body);
    }
  }, [currentTemplate]);

  // Generate preview with personalization
  const preview = useMemo(() => {
    return personalizeTemplate(
      { id: templateId, label: '', category: 'intro', subject, body },
      sampleProspect
    );
  }, [subject, body, sampleProspect, templateId]);

  // Handle inline email edit
  const handleStartEmailEdit = useCallback((prospect: SkippedProspect) => {
    setEditingEmailId(prospect.id);
    setEmailInput(prospect.email || '');
    setEmailError(null);
  }, []);

  const handleSaveEmail = useCallback(async (prospectId: string) => {
    const trimmedEmail = emailInput.trim();
    
    if (!trimmedEmail) {
      setEmailError('Email is required');
      return;
    }
    
    if (!isValidEmail(trimmedEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    setIsSavingEmail(true);
    setEmailError(null);
    
    try {
      // Update locally for immediate UI feedback
      setLocalEmailUpdates(prev => ({ ...prev, [prospectId]: trimmedEmail }));
      
      // Persist to backend if handler provided
      if (onUpdateProspect) {
        await onUpdateProspect(prospectId, { email: trimmedEmail });
      }
      
      setEditingEmailId(null);
      setEmailInput('');
    } catch (err) {
      setEmailError('Failed to save email. Please try again.');
      // Rollback local update
      setLocalEmailUpdates(prev => {
        const updated = { ...prev };
        delete updated[prospectId];
        return updated;
      });
    } finally {
      setIsSavingEmail(false);
    }
  }, [emailInput, onUpdateProspect]);

  const handleCancelEmailEdit = useCallback(() => {
    setEditingEmailId(null);
    setEmailInput('');
    setEmailError(null);
  }, []);

  // Get skip reason display text
  const getSkipReasonText = (reason: SkipReason): string => {
    switch (reason) {
      case 'no_email': return 'No email';
      case 'invalid_email': return 'Invalid email';
      case 'in_sequence': return 'In active sequence';
      default: return 'Unknown';
    }
  };

  // AI Content Generation Handler
  const handleGenerateAI = useCallback(async () => {
    const prospect = sampleProspect;
    if (!prospect) return;

    const result = await generateAI({
      tone: selectedTone,
      prospectName: prospect.name?.split(' ')[0] || 'there',
      companyName: prospect.company || 'your company',
      title: prospect.title,
      goal: 'Schedule a meeting to discuss yard operations',
    });

    if (result.success) {
      if (result.subject) setSubject(result.subject);
      if (result.content) setBody(result.content);
    }
  }, [generateAI, selectedTone, sampleProspect]);

  // Character count helpers for Luis tone warning
  const currentTone = getTone(selectedTone);
  const charCount = body.length;
  const isOverLimit = currentTone?.charLimit && charCount > currentTone.charLimit;
  const hasCalendlyLink = body.includes(CALENDLY_CONFIG.url) || body.toLowerCase().includes('calendly');

  const handleSubmit = async () => {
    if (!canSend) return;
    await onConfirm(subject, body, templateId);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget && !isSending) onClose(); }}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <LazyIcon name="Mail" className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Send Bulk Email</h2>
              <p className="text-sm text-slate-500">
                {withEmail.length} prospects will receive this email
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isSending}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-50"
          >
            <LazyIcon name="X" className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Warning for skipped prospects with expandable list */}
          {skippedProspects.length > 0 && modalState === 'composing' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowSkippedList(!showSkippedList)}
                className="w-full flex items-center justify-between p-3 hover:bg-amber-100/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <LazyIcon name="AlertTriangle" className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-amber-800">
                      {skippedProspects.length} prospect{skippedProspects.length > 1 ? 's' : ''} will be skipped
                    </p>
                    <p className="text-xs text-amber-600">
                      {onUpdateProspect ? 'Click to add missing emails' : 'Missing or invalid email addresses'}
                    </p>
                  </div>
                </div>
                <LazyIcon 
                  name={showSkippedList ? 'ChevronUp' : 'ChevronDown'} 
                  className="h-5 w-5 text-amber-600" 
                />
              </button>
              
              {showSkippedList && (
                <div className="border-t border-amber-200 max-h-48 overflow-y-auto">
                  {skippedProspects.map((prospect) => (
                    <div 
                      key={prospect.id}
                      className="flex items-center justify-between px-3 py-2 border-b border-amber-100 last:border-b-0"
                    >
                      {editingEmailId === prospect.id ? (
                        // Inline email edit mode
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="email"
                            value={emailInput}
                            onChange={(e) => {
                              setEmailInput(e.target.value);
                              if (emailError) setEmailError(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEmail(prospect.id);
                              if (e.key === 'Escape') handleCancelEmailEdit();
                            }}
                            placeholder="email@company.com"
                            className={`flex-1 text-sm px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 ${
                              emailError ? 'border-red-400 bg-red-50' : 'border-slate-300'
                            }`}
                            autoFocus
                            disabled={isSavingEmail}
                          />
                          <button
                            onClick={() => handleSaveEmail(prospect.id)}
                            disabled={isSavingEmail}
                            className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                            title="Save email"
                          >
                            {isSavingEmail ? (
                              <LazyIcon name="Loader2" className="h-4 w-4 animate-spin" />
                            ) : (
                              <LazyIcon name="Check" className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={handleCancelEmailEdit}
                            disabled={isSavingEmail}
                            className="p-1 text-slate-400 hover:bg-slate-50 rounded disabled:opacity-50"
                            title="Cancel"
                          >
                            <LazyIcon name="X" className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        // Display mode
                        <>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-amber-800 truncate">
                              {prospect.name}
                            </p>
                            <p className="text-xs text-amber-600 truncate">
                              {prospect.company} • {getSkipReasonText(prospect.reason)}
                              {prospect.email && <span className="ml-1">({prospect.email})</span>}
                            </p>
                          </div>
                          {onUpdateProspect && prospect.reason !== 'in_sequence' && (
                            <button
                              onClick={() => handleStartEmailEdit(prospect)}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:bg-blue-50 px-2 py-1 rounded"
                            >
                              {prospect.reason === 'invalid_email' ? 'Fix email' : 'Add email'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  {emailError && (
                    <p className="px-3 py-2 text-xs text-red-600 bg-red-50">{emailError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Validation errors */}
          {validationErrors.length > 0 && modalState === 'composing' && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <LazyIcon name="AlertCircle" className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Please fix the following:</p>
                <ul className="text-xs text-red-600 mt-1 list-disc list-inside">
                  {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            </div>
          )}

          {/* AI Error Display */}
          {aiError && modalState === 'composing' && (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <LazyIcon name="AlertCircle" className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 flex-1">{aiError}</p>
              <button
                onClick={clearAIError}
                className="p-1 text-red-400 hover:text-red-600 rounded"
              >
                <LazyIcon name="X" className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Template + Tone + Generate Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Template Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Template
              </label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={isSending || isGenerating}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
              >
                {EMAIL_TEMPLATES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Tone Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tone
              </label>
              <select
                value={selectedTone}
                onChange={(e) => setSelectedTone(e.target.value as ToneId)}
                disabled={isSending || isGenerating}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
              >
                {TONE_OPTIONS.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Generate AI Button */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                AI Generate
              </label>
              <button
                onClick={handleGenerateAI}
                disabled={isSending || isGenerating || !sampleProspect}
                className="w-full px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <LazyIcon name="Loader2" className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <LazyIcon name="Sparkles" className="h-4 w-4" />
                    Generate ✨
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Subject Line */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
              placeholder="Email subject..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
            />
            <p className="text-xs text-slate-400 mt-1">
              Use {'{company}'} for personalization
            </p>
          </div>

          {/* Message Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Message Body
              </label>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {showPreview ? 'Edit' : 'Preview'}
              </button>
            </div>
            
            {showPreview ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg min-h-[200px]">
                <p className="text-sm text-slate-500 mb-2">
                  Preview for: <strong>{sampleProspect.name}</strong> at <strong>{sampleProspect.company}</strong>
                </p>
                <div className="border-t border-slate-200 pt-3">
                  <p className="font-medium text-slate-800 mb-2">Subject: {preview.subject}</p>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">
                    {preview.body}
                  </div>
                </div>
              </div>
            ) : (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={isSending || isGenerating}
                rows={10}
                placeholder="Email body..."
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 font-mono text-sm ${
                  isOverLimit ? 'border-amber-400 bg-amber-50' : 'border-slate-300'
                }`}
              />
            )}
            
            {/* Copy Guardrails: Char count + Calendly indicator */}
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-slate-400">
                Tokens: {'{first_name}'}, {'{name}'}, {'{company}'}, {'{title}'}
              </p>
              <div className="flex items-center gap-3">
                {/* Calendly indicator */}
                <span className={`text-xs flex items-center gap-1 ${hasCalendlyLink ? 'text-green-600' : 'text-slate-400'}`}>
                  <LazyIcon name="Calendar" className="h-3 w-3" />
                  {hasCalendlyLink ? 'Calendly ✓' : 'No Calendly'}
                </span>
                
                {/* Character count */}
                {currentTone?.charLimit && (
                  <span className={`text-xs font-mono ${
                    isOverLimit ? 'text-amber-600 font-medium' : 'text-slate-400'
                  }`}>
                    {charCount}/{currentTone.charLimit}
                    {isOverLimit && ' ⚠️'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progress indicator */}
          {modalState === 'sending' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium text-blue-800">Sending emails...</span>
                <span className="text-blue-600">
                  {progress.sent + progress.failed} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? ((progress.sent + progress.failed) / progress.total) * 100 : 0}%` }}
                />
              </div>
              {progress.failed > 0 && (
                <p className="text-sm text-red-600 mt-2">
                  {progress.failed} email{progress.failed > 1 ? 's' : ''} failed to send
                </p>
              )}
            </div>
          )}

          {/* Results display */}
          {modalState === 'results' && progress.results && (
            <div className="space-y-3">
              {/* Summary */}
              <div className={`p-4 rounded-lg border ${
                progress.failed === 0 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center gap-3">
                  <LazyIcon 
                    name={progress.failed === 0 ? 'CheckCircle2' : 'AlertTriangle'} 
                    className={`h-6 w-6 ${progress.failed === 0 ? 'text-green-600' : 'text-amber-600'}`} 
                  />
                  <div>
                    <p className={`font-medium ${progress.failed === 0 ? 'text-green-800' : 'text-amber-800'}`}>
                      {progress.failed === 0 
                        ? `All ${progress.sent} emails sent successfully!`
                        : `${progress.sent} sent, ${progress.failed} failed`
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Per-prospect results */}
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Prospect</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Email</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {progress.results.map((result) => (
                      <tr key={result.prospectId} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-800">{result.prospectName}</td>
                        <td className="px-3 py-2 text-slate-600 truncate max-w-[150px]">{result.email}</td>
                        <td className="px-3 py-2">
                          {result.success ? (
                            <span className="inline-flex items-center gap-1 text-green-700">
                              <LazyIcon name="Check" className="h-4 w-4" />
                              Sent
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600" title={result.error}>
                              <LazyIcon name="X" className="h-4 w-4" />
                              {result.error || 'Failed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
          <div className="text-sm text-slate-500">
            {modalState === 'results' ? (
              <span>
                <span className="font-medium text-green-700">{progress.sent}</span> sent
                {progress.failed > 0 && (
                  <>, <span className="font-medium text-red-600">{progress.failed}</span> failed</>
                )}
              </span>
            ) : (
              <span>
                <span className="font-medium text-slate-700">{withEmail.length}</span> emails will be sent
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={modalState === 'sending'}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              {modalState === 'results' ? 'Close' : 'Cancel'}
            </button>
            {modalState === 'composing' && (
              <button
                onClick={handleSubmit}
                disabled={!canSend}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <LazyIcon name="Send" className="h-4 w-4" />
                Send to {withEmail.length} prospect{withEmail.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BulkEmailModal;

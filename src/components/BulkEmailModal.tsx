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
 */

import React, { useState, useEffect, useMemo } from 'react';
import { LazyIcon } from './icons';
import { EMAIL_TEMPLATES, personalizeTemplate, type EmailTemplate } from '../config/emailTemplates';
import type { Prospect } from '../types';

export interface BulkEmailProgress {
  sent: number;
  total: number;
  failed: number;
}

export interface BulkEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (subject: string, body: string, templateId: string) => Promise<void>;
  selectedProspects: Prospect[];
  isSending: boolean;
  progress?: BulkEmailProgress;
}

export function BulkEmailModal({
  isOpen,
  onClose,
  onConfirm,
  selectedProspects,
  isSending,
  progress = { sent: 0, total: 0, failed: 0 },
}: BulkEmailModalProps) {
  const [templateId, setTemplateId] = useState(EMAIL_TEMPLATES[0]?.id || 'intro_yardflow');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Get current template
  const currentTemplate = useMemo(
    () => EMAIL_TEMPLATES.find(t => t.id === templateId) || EMAIL_TEMPLATES[0],
    [templateId]
  );

  // Split prospects by email availability
  const { withEmail, withoutEmail } = useMemo(() => ({
    withEmail: selectedProspects.filter(p => p.email),
    withoutEmail: selectedProspects.filter(p => !p.email),
  }), [selectedProspects]);

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

  const handleSubmit = async () => {
    if (withEmail.length === 0) return;
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
          {/* Warning for prospects without email */}
          {withoutEmail.length > 0 && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <LazyIcon name="AlertTriangle" className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  {withoutEmail.length} prospect{withoutEmail.length > 1 ? 's' : ''} will be skipped
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  These prospects don't have email addresses.
                </p>
              </div>
            </div>
          )}

          {/* Template Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email Template
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={isSending}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
            >
              {EMAIL_TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
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
                disabled={isSending}
                rows={10}
                placeholder="Email body..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 font-mono text-sm"
              />
            )}
            <p className="text-xs text-slate-400 mt-1">
              Available tokens: {'{first_name}'}, {'{name}'}, {'{company}'}, {'{title}'}
            </p>
          </div>

          {/* Progress indicator */}
          {isSending && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium text-blue-800">Sending emails...</span>
                <span className="text-blue-600">
                  {progress.sent} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.sent / progress.total) * 100 : 0}%` }}
                />
              </div>
              {progress.failed > 0 && (
                <p className="text-sm text-red-600 mt-2">
                  {progress.failed} email{progress.failed > 1 ? 's' : ''} failed to send
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
          <div className="text-sm text-slate-500">
            <span className="font-medium text-slate-700">{withEmail.length}</span> emails will be sent
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSending || withEmail.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSending ? (
                <>
                  <LazyIcon name="Loader2" className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <LazyIcon name="Send" className="h-4 w-4" />
                  Send to {withEmail.length} prospects
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BulkEmailModal;

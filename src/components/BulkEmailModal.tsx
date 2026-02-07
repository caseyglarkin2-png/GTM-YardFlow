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
import { SuccessCelebration } from './SuccessCelebration';
import { WarmupLimitBadge } from './WarmupLimitBadge';
import { SpamScoreIndicator } from './SpamScoreIndicator';
import { ComplianceChecklist } from './email/ComplianceChecklist';
import { useSpamScore } from '../hooks/useSpamScore';
import { sendTimeOptimizer, type OptimalSendTime } from '../services/SendTimeOptimizer';
import { personalizeTemplate } from '../config/emailTemplates';
import { TONE_OPTIONS, DEFAULT_TONE, getTone, type ToneId } from '../config/tones';
import { SENDER_IDENTITIES, getDefaultSender, interpolateSender, type SenderId } from '../config/senders';
import { CALENDLY_CONFIG } from '../config/calendly';
import { useAIGenerate } from '../hooks/useAIGenerate';
import { useBulkEmailSend, type BulkRecipient, type RecipientStatus } from '../hooks/useBulkEmailSend';
import { useTemplates } from '../hooks/useTemplates';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { shouldUseRailwayTemplates } from '../config/featureFlags';
import { isValidEmail } from '../utils/emailValidator';
import type { Prospect } from '../types';
import type { TemplateTone, TemplateCategory } from '../types/railway';

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
  /** Sprint V34 P2.2: Currently processing recipient name */
  currentRecipientName?: string;
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

/** Helper to get status indicator color/icon */
function getStatusDisplay(status: RecipientStatus): { icon: string; color: string; label: string } {
  switch (status) {
    case 'pending':
      return { icon: 'Circle', color: 'text-slate-400', label: 'Pending' };
    case 'generating':
      return { icon: 'Loader2', color: 'text-purple-500', label: 'Generating...' };
    case 'generated':
      return { icon: 'Eye', color: 'text-amber-500', label: 'Review' };
    case 'approved':
      return { icon: 'CheckCircle2', color: 'text-green-500', label: 'Approved' };
    case 'sending':
      return { icon: 'Loader2', color: 'text-blue-500', label: 'Sending...' };
    case 'sent':
      return { icon: 'CheckCircle2', color: 'text-green-600', label: 'Sent' };
    case 'failed':
      return { icon: 'XCircle', color: 'text-red-500', label: 'Failed' };
    default:
      return { icon: 'Circle', color: 'text-slate-400', label: 'Unknown' };
  }
}

/** Single recipient row in AI mode table with expandable preview */
function RecipientRow({ 
  recipient, 
  onGenerate,
  onApprove,
  onEdit,
  disabled 
}: { 
  recipient: BulkRecipient; 
  onGenerate: () => void;
  onApprove?: () => void;
  onEdit?: (subject: string, body: string) => void;
  disabled: boolean;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editSubject, setEditSubject] = React.useState('');
  const [editBody, setEditBody] = React.useState('');
  
  const statusDisplay = getStatusDisplay(recipient.status);
  const isGenerating = recipient.status === 'generating';
  const canGenerate = recipient.status === 'pending' || recipient.status === 'failed';
  const hasContent = (recipient.status === 'generated' || recipient.status === 'approved') && recipient.subject && recipient.body;
  const isApproved = recipient.status === 'approved';
  
  // Start editing
  const handleEdit = () => {
    setEditSubject(recipient.subject || '');
    setEditBody(recipient.body || '');
    setIsEditing(true);
  };
  
  // Save edits
  const handleSaveEdit = () => {
    onEdit?.(editSubject, editBody);
    setIsEditing(false);
  };
  
  return (
    <div className={`border-b border-slate-100 last:border-b-0 ${isApproved ? 'bg-green-50/50' : ''}`}>
      {/* Main row */}
      <div 
        className={`flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 ${hasContent ? 'cursor-pointer' : ''}`}
        onClick={hasContent ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Status icon with approval indicator */}
          <div className="relative">
            <LazyIcon 
              name={statusDisplay.icon} 
              className={`h-4 w-4 flex-shrink-0 ${statusDisplay.color} ${isGenerating ? 'animate-spin' : ''}`} 
            />
            {isApproved && (
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
            )}
          </div>
          
          {/* Prospect info */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800 truncate flex items-center gap-2">
              {recipient.prospect.name}
              {isApproved && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Approved</span>}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {recipient.prospect.company} • {recipient.prospect.email}
            </p>
          </div>
        </div>
        
        {/* Status + action */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasContent && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
              className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <LazyIcon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} className="h-3 w-3" />
              {isExpanded ? 'Hide' : 'Preview'}
            </button>
          )}
          
          <span className={`text-xs ${statusDisplay.color}`}>
            {statusDisplay.label}
          </span>
          
          {canGenerate && (
            <button
              onClick={(e) => { e.stopPropagation(); onGenerate(); }}
              disabled={disabled}
              className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50 flex items-center gap-1"
            >
              <LazyIcon name="Sparkles" className="h-3 w-3" />
              Generate
            </button>
          )}
          
          {recipient.status === 'failed' && recipient.error && (
            <span className="text-xs text-red-500 truncate max-w-[100px]" title={recipient.error}>
              {recipient.error}
            </span>
          )}
        </div>
      </div>
      
      {/* Enhanced expandable preview section */}
      {isExpanded && hasContent && (
        <div className="px-4 py-4 bg-slate-50 border-t border-slate-100">
          {isEditing ? (
            /* Edit mode */
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Subject:</label>
                <input
                  type="text"
                  data-testid="bulk-email-edit-subject"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Body:</label>
                <textarea
                  data-testid="bulk-email-edit-body"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            /* Preview mode */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Subject:</span>
                <button
                  onClick={handleEdit}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <LazyIcon name="Edit2" className="h-3 w-3" />
                  Edit
                </button>
              </div>
              <div className="text-sm font-medium text-slate-800 bg-white px-3 py-2 rounded border border-slate-100">
                {recipient.subject}
              </div>
              
              <div className="text-xs text-slate-500">Body:</div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap bg-white px-3 py-3 rounded border border-slate-100 max-h-48 overflow-y-auto">
                {recipient.body}
              </div>
              
              {/* Approval button - only show if not already approved */}
              {!isApproved && (
                <button
                  onClick={() => onApprove?.()}
                  className="w-full py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <LazyIcon name="CheckCircle" className="h-4 w-4" />
                  Approve for Sending
                </button>
              )}
              
              {isApproved && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-green-700 bg-green-100 rounded-lg">
                  <LazyIcon name="CheckCircle" className="h-4 w-4" />
                  Approved - Ready to Send
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  // Initial template ID - will be updated when hook loads templates
  const [templateId, setTemplateId] = useState('intro_freightroll');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTone, setSelectedTone] = useState<ToneId>(DEFAULT_TONE);
  const [selectedSender, setSelectedSender] = useState<SenderId>(getDefaultSender().id as SenderId);
  
  // Accessibility: Focus trap and Escape key handling
  const dialogRef = useFocusTrap(isOpen, { onEscape: onClose, returnFocus: true });
  const [showPreview, setShowPreview] = useState(false);
  const [showSkippedList, setShowSkippedList] = useState(false);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  
  // AI generation hook
  const { generate: generateAI, isGenerating, error: aiError, clearError: clearAIError } = useAIGenerate();
  
  // AI fallback states (T0.1-T0.3)
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai' | null>(null);
  const [aiRateLimitInfo, setAiRateLimitInfo] = useState<{
    isLimited: boolean;
    retryAfterSeconds?: number;
    fallbackUsed?: 'gemini' | 'openai';
  } | null>(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [lastGenerateTime, setLastGenerateTime] = useState(0);
  const DEBOUNCE_MS = 3000; // 3 second cooldown between generates
  
  // Bulk email send hook for per-recipient AI generation mode
  const bulkSend = useBulkEmailSend();
  
  // Template CRUD hook (Railway or static fallback)
  const templateCRUD = useTemplates();
  
  // Save as Template state
  const [showSaveTemplateForm, setShowSaveTemplateForm] = useState(false);
  const [templateSaveName, setTemplateSaveName] = useState('');
  const [templateSaveCategory, setTemplateSaveCategory] = useState<TemplateCategory>('outreach');
  const [templateSaveTone, setTemplateSaveTone] = useState<TemplateTone>('professional');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateSaveError, setTemplateSaveError] = useState<string | null>(null);
  const [templateSaveSuccess, setTemplateSaveSuccess] = useState(false);
  
  // Template Edit/Delete state (T2.3, T2.4)
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUpdatingTemplate, setIsUpdatingTemplate] = useState(false);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
  const [templateActionError, setTemplateActionError] = useState<string | null>(null);
  
  // Mode: 'template' = same template for all, 'ai' = AI-generated per recipient
  const [sendMode, setSendMode] = useState<'template' | 'ai'>('template');
  
  // Track local email updates for immediate UI feedback
  const [localEmailUpdates, setLocalEmailUpdates] = useState<Record<string, string>>({});
  
  // Sprint V34 P1.3: Success celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Sprint 39D: Send time optimization
  const [optimizeSendTime, setOptimizeSendTime] = useState(false);
  
  // Determine modal state
  const modalState: ModalState = useMemo(() => {
    if (progress.results && progress.results.length > 0) return 'results';
    if (isSending) return 'sending';
    return 'composing';
  }, [isSending, progress.results]);
  
  // Sprint 39C: Spam score analysis for email content
  const spamAnalysis = useSpamScore({
    subject,
    body,
    debounceMs: 500,
    enabled: sendMode === 'template' && modalState === 'composing',
  });

  // Sprint V34 P1.3: Trigger celebration when all emails succeed
  useEffect(() => {
    if (modalState === 'results' && progress.results && progress.failed === 0 && progress.sent > 0) {
      setShowCelebration(true);
      // Reset after animation completes
      const timer = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [modalState, progress.results, progress.failed, progress.sent]);

  // Get current template from Railway (or static fallback)
  const currentTemplate = useMemo(
    () => {
      const templates = templateCRUD.templates;
      const found = templates.find(t => t.id === templateId);
      if (found) return found;
      // Fallback to first template or create a default
      return templates[0] || { id: 'default', name: 'Default', subject: '', body: '', category: 'outreach' as const };
    },
    [templateId, templateCRUD.templates]
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

  // Sprint 39D: Compute optimal send times when optimization is enabled
  const scheduledTimes = useMemo(() => {
    if (!optimizeSendTime) return null;
    
    const times = new Map<string, OptimalSendTime>();
    for (const prospect of withEmail) {
      // Parse location for state/city if available (format: "City, State" or "State")
      const locationParts = prospect.location?.split(',').map(s => s.trim()) || [];
      const city = locationParts.length > 1 ? locationParts[0] : undefined;
      const state = locationParts.length > 1 ? locationParts[1] : locationParts[0];
      
      times.set(prospect.id, sendTimeOptimizer.getOptimalTime({
        state,
        city,
        country: prospect.country,
      }));
    }
    return times;
  }, [optimizeSendTime, withEmail]);

  // Validation: subject and body required
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!subject.trim()) errors.push('Subject is required');
    if (!body.trim()) errors.push('Message body is required');
    return errors;
  }, [subject, body]);

  // Validation depends on mode
  const canSend = useMemo(() => {
    if (sendMode === 'template') {
      return withEmail.length > 0 && validationErrors.length === 0;
    } else {
      // AI mode: at least one recipient generated
      return bulkSend.recipients.filter(r => 
        r.status === 'generated' && r.subject && r.body
      ).length > 0;
    }
  }, [sendMode, withEmail.length, validationErrors.length, bulkSend.recipients]);

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

  // Initialize bulk recipients when switching to AI mode
  useEffect(() => {
    if (sendMode === 'ai' && withEmail.length > 0) {
      // Sprint 39D: Pass scheduled times if optimization is enabled
      const scheduled = optimizeSendTime && scheduledTimes 
        ? new Map(Array.from(scheduledTimes.entries()).map(([id, opt]) => [id, { scheduledAt: opt.scheduledAt.getTime() }]))
        : undefined;
      bulkSend.initRecipients(withEmail, subject, body, scheduled);
    }
    // Only re-init when switching mode or prospect list changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendMode, withEmail.length, optimizeSendTime]);

  // Handle mode switch
  const handleModeSwitch = useCallback((mode: 'template' | 'ai') => {
    if (mode !== sendMode) {
      setSendMode(mode);
      if (mode === 'template') {
        bulkSend.reset();
      }
    }
  }, [sendMode, bulkSend]);

  // Handle generate all for AI mode
  const handleGenerateAll = useCallback(async () => {
    if (sendMode !== 'ai') return;
    await bulkSend.generateAll(selectedTone, 3);
  }, [sendMode, selectedTone, bulkSend]);

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
    
    // Debounce: prevent rapid re-clicks (T0.3/T3.6)
    const now = Date.now();
    if (now - lastGenerateTime < DEBOUNCE_MS) {
      // Show toast for rapid clicks - just silently ignore
      return;
    }
    setLastGenerateTime(now);

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
      
      // Track which provider was used (T0.1)
      if (result.provider) {
        setAiProvider(result.provider);
      }
      
      // Check if fallback was used due to rate limit (T0.2)
      if (result.rateLimit?.fallbackUsed) {
        setAiRateLimitInfo({
          isLimited: true,
          fallbackUsed: result.rateLimit.fallbackUsed,
        });
      } else {
        setAiRateLimitInfo(null);
      }
    } else {
      // Handle different error types (T0.2, T0.3)
      if (result.error === 'rate_limited') {
        setAiRateLimitInfo({
          isLimited: true,
          retryAfterSeconds: result.rateLimit?.retryAfterSeconds,
        });
      } else if (result.error === 'timeout' || result.error?.includes('unavailable')) {
        setAiUnavailable(true);
      }
    }
  }, [generateAI, selectedTone, sampleProspect, lastGenerateTime]);

  // Character count helpers for FreightRoll tone warning
  const currentTone = getTone(selectedTone);
  const charCount = body.length;
  const isOverLimit = currentTone?.charLimit && charCount > currentTone.charLimit;
  const hasCalendlyLink = body.includes(CALENDLY_CONFIG.url) || body.toLowerCase().includes('calendly');

  // Handle Save as Template
  const handleSaveAsTemplate = useCallback(async () => {
    const trimmedName = templateSaveName.trim();
    
    if (!trimmedName || !subject.trim() || !body.trim()) {
      setTemplateSaveError('Template name, subject, and body are required');
      return;
    }
    
    // T2.6: Check for duplicate template name
    const existingNames = templateCRUD.templates.map(t => t.name.toLowerCase());
    if (existingNames.includes(trimmedName.toLowerCase())) {
      setTemplateSaveError('A template with this name already exists');
      return;
    }
    
    setIsSavingTemplate(true);
    setTemplateSaveError(null);
    
    try {
      await templateCRUD.create({
        name: trimmedName,
        subject,
        body,
        category: templateSaveCategory,
        tone: templateSaveTone,
      });
      
      setTemplateSaveSuccess(true);
      setShowSaveTemplateForm(false);
      setTemplateSaveName('');
      
      // Auto-hide success message after 3s
      setTimeout(() => setTemplateSaveSuccess(false), 3000);
    } catch (err) {
      setTemplateSaveError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSavingTemplate(false);
    }
  }, [templateSaveName, subject, body, templateSaveCategory, templateSaveTone, templateCRUD]);

  // T2.3: Handle Update Template
  const handleUpdateTemplate = useCallback(async () => {
    if (!templateId || !subject.trim() || !body.trim()) {
      setTemplateActionError('Subject and body are required');
      return;
    }

    // Can't edit default/system templates
    if (currentTemplate.isDefault) {
      setTemplateActionError('Cannot edit default templates. Use "Save as Template" to create a copy.');
      return;
    }
    
    setIsUpdatingTemplate(true);
    setTemplateActionError(null);
    
    try {
      const result = await templateCRUD.update(templateId, {
        subject,
        body,
      });
      
      if (result.ok) {
        setIsEditMode(false);
        await templateCRUD.reload();
      } else {
        setTemplateActionError(result.error || 'Failed to update template');
      }
    } catch (err) {
      setTemplateActionError(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setIsUpdatingTemplate(false);
    }
  }, [templateId, subject, body, currentTemplate, templateCRUD]);

  // T2.4: Handle Delete Template
  const handleDeleteTemplate = useCallback(async () => {
    if (!templateId) return;

    // Can't delete default/system templates
    if (currentTemplate.isDefault) {
      setTemplateActionError('Cannot delete default templates');
      setShowDeleteConfirm(false);
      return;
    }
    
    setIsDeletingTemplate(true);
    setTemplateActionError(null);
    
    try {
      const result = await templateCRUD.deleteTemplate(templateId);
      
      if (result.ok) {
        // Reset to first available template
        const remaining = templateCRUD.templates.filter(t => t.id !== templateId);
        if (remaining.length > 0) {
          setTemplateId(remaining[0].id);
        }
        setSubject('');
        setBody('');
        setShowDeleteConfirm(false);
        await templateCRUD.reload();
      } else if (result.error?.includes('in_use') || result.error?.includes('in use')) {
        setTemplateActionError('Cannot delete: template is used in active sequences');
      } else {
        setTemplateActionError(result.error || 'Failed to delete template');
      }
    } catch (err) {
      setTemplateActionError(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setIsDeletingTemplate(false);
      setShowDeleteConfirm(false);
    }
  }, [templateId, currentTemplate, templateCRUD]);

  // Can this template be edited/deleted? (only custom, not default)
  const canModifyTemplate = useMemo(() => {
    return templateCRUD.isRailwaySource && !currentTemplate.isDefault;
  }, [templateCRUD.isRailwaySource, currentTemplate]);

  const handleSubmit = async () => {
    if (!canSend) return;
    
    if (sendMode === 'template') {
      // Template mode: use existing onConfirm which sends same template to all
      await onConfirm(subject, body, templateId);
    } else {
      // AI mode: send each recipient with their personalized content
      await bulkSend.sendAll(onConfirm);
    }
  };

  // Count recipients by status in AI mode
  const approvedCount = sendMode === 'ai' 
    ? bulkSend.recipients.filter(r => r.status === 'approved').length
    : 0;
  const pendingReviewCount = sendMode === 'ai'
    ? bulkSend.recipients.filter(r => r.status === 'generated' && r.subject && r.body).length
    : 0;
  // Ready to send = approved recipients only (must review before sending)
  const readyToSendCount = sendMode === 'ai' ? approvedCount : withEmail.length;

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget && !isSending) onClose(); }}
    >
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-email-title"
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
              <h2 id="bulk-email-title" className="font-semibold text-slate-800">Send Bulk Email</h2>
              <p className="text-sm text-slate-500">
                {withEmail.length} prospects will receive this email
              </p>
            </div>
            {/* Sprint 38F: Warmup limit indicator */}
            <WarmupLimitBadge pendingSendCount={withEmail.length} compact />
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
              <label htmlFor="template-selector" className="block text-sm font-medium text-slate-700 mb-1.5">
                Template {templateCRUD.isRailwaySource && <span className="text-xs text-green-600">(Railway)</span>}
              </label>
              {templateCRUD.isLoading ? (
                <select
                  id="template-selector"
                  disabled
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 animate-pulse"
                >
                  <option>Loading templates...</option>
                </select>
              ) : (
                <div className="flex gap-1">
                  <select
                    id="template-selector"
                    data-testid="bulk-email-template-selector"
                    value={templateId}
                    onChange={(e) => { setTemplateId(e.target.value); setIsEditMode(false); }}
                    disabled={isSending || isGenerating}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
                  >
                    {templateCRUD.templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>
                    ))}
                  </select>
                  {/* Edit/Delete buttons for custom templates */}
                  {canModifyTemplate && !isEditMode && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setIsEditMode(true)}
                        disabled={isSending || isGenerating}
                        title="Edit template"
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <LazyIcon name="Edit2" className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={isSending || isGenerating}
                        title="Delete template"
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <LazyIcon name="Trash2" className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {/* Save/Cancel buttons in edit mode */}
                  {isEditMode && (
                    <div className="flex gap-1">
                      <button
                        onClick={handleUpdateTemplate}
                        disabled={isUpdatingTemplate || !subject.trim() || !body.trim()}
                        title="Save changes"
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isUpdatingTemplate ? (
                          <LazyIcon name="Loader2" className="h-4 w-4 animate-spin" />
                        ) : (
                          <LazyIcon name="Check" className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setIsEditMode(false)}
                        disabled={isUpdatingTemplate}
                        title="Cancel edit"
                        className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <LazyIcon name="X" className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
              {templateCRUD.error && (
                <p className="text-xs text-amber-600 mt-1">Using fallback templates</p>
              )}
              {templateActionError && (
                <p className="text-xs text-red-600 mt-1">{templateActionError}</p>
              )}
              {isEditMode && (
                <p className="text-xs text-blue-600 mt-1">Editing: modify subject/body and click ✓ to save</p>
              )}
            </div>

            {/* Tone Selector */}
            <div>
              <label htmlFor="tone-selector" className="block text-sm font-medium text-slate-700 mb-1.5">
                Tone
              </label>
              <select
                id="tone-selector"
                data-testid="bulk-email-tone-selector"
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

            {/* Sender Selector - Sprint 38B */}
            <div>
              <label htmlFor="sender-selector" className="block text-sm font-medium text-slate-700 mb-1.5">
                Send As
              </label>
              <select
                id="sender-selector"
                data-testid="bulk-email-sender-selector"
                value={selectedSender}
                onChange={(e) => setSelectedSender(e.target.value as SenderId)}
                disabled={isSending || isGenerating}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
              >
                {SENDER_IDENTITIES.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
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
                disabled={isSending || isGenerating || !sampleProspect || aiUnavailable}
                title={aiUnavailable ? 'AI temporarily unavailable' : undefined}
                data-testid="bulk-email-generate-ai"
                className="w-full px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <LazyIcon name="Loader2" className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : aiUnavailable ? (
                  <>
                    <LazyIcon name="AlertCircle" className="h-4 w-4" />
                    AI Unavailable
                  </>
                ) : (
                  <>
                    <LazyIcon name="Sparkles" className="h-4 w-4" />
                    Generate ✨
                  </>
                )}
              </button>
              
              {/* Provider indicator (T0.1) */}
              {aiProvider && !isGenerating && subject && (
                <p className="text-xs text-slate-500 mt-1 text-center">
                  Generated with {aiProvider === 'openai' ? 'OpenAI' : 'Gemini'}
                  {aiRateLimitInfo?.fallbackUsed && (
                    <span className="text-amber-600"> (fallback)</span>
                  )}
                </p>
              )}
            </div>
          </div>
          
          {/* Rate limit warning banner (T0.2) */}
          {aiRateLimitInfo?.isLimited && !aiRateLimitInfo.fallbackUsed && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <LazyIcon name="AlertTriangle" className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-700">
                <p className="font-medium">AI generation temporarily limited</p>
                {aiRateLimitInfo.retryAfterSeconds && (
                  <p className="text-xs mt-0.5">
                    Retry available in {Math.ceil(aiRateLimitInfo.retryAfterSeconds / 60)} minute(s)
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* AI unavailable warning (T0.3) */}
          {aiUnavailable && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-2">
              <LazyIcon name="Info" className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-600">
                <p>AI generation is temporarily unavailable. Please enter content manually or select a template.</p>
                <button 
                  onClick={() => setAiUnavailable(false)}
                  className="text-blue-600 hover:underline text-xs mt-1"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Save as Template - Feature Flagged */}
          {shouldUseRailwayTemplates() && modalState === 'composing' && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {/* Toggle button */}
              <button
                type="button"
                onClick={() => setShowSaveTemplateForm(!showSaveTemplateForm)}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <LazyIcon name="Save" className="h-4 w-4 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">Save as Template</span>
                </div>
                <LazyIcon 
                  name={showSaveTemplateForm ? 'ChevronUp' : 'ChevronDown'} 
                  className="h-4 w-4 text-slate-500" 
                />
              </button>
              
              {/* Expandable form */}
              {showSaveTemplateForm && (
                <div className="p-3 border-t border-slate-200 space-y-3">
                  {/* Template Name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      value={templateSaveName}
                      onChange={(e) => setTemplateSaveName(e.target.value)}
                      placeholder="e.g., Q1 Outreach - Decision Makers"
                      disabled={isSavingTemplate}
                      className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
                    />
                  </div>
                  
                  {/* Category + Tone row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Category
                      </label>
                      <select
                        value={templateSaveCategory}
                        onChange={(e) => setTemplateSaveCategory(e.target.value as TemplateCategory)}
                        disabled={isSavingTemplate}
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="outreach">Outreach</option>
                        <option value="follow-up">Follow-up</option>
                        <option value="introduction">Introduction</option>
                        <option value="closing">Closing</option>
                        <option value="re-engagement">Re-engagement</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Tone
                      </label>
                      <select
                        value={templateSaveTone}
                        onChange={(e) => setTemplateSaveTone(e.target.value as TemplateTone)}
                        disabled={isSavingTemplate}
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="professional">Professional</option>
                        <option value="casual">Casual</option>
                        <option value="freightroll">FreightRoll</option>
                        <option value="friendly">Friendly</option>
                        <option value="formal">Formal</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Error display */}
                  {templateSaveError && (
                    <div className="flex items-center gap-2 text-xs text-red-600">
                      <LazyIcon name="AlertCircle" className="h-3 w-3" />
                      {templateSaveError}
                    </div>
                  )}
                  
                  {/* Save button */}
                  <button
                    onClick={handleSaveAsTemplate}
                    disabled={isSavingTemplate || !templateSaveName.trim() || !subject.trim() || !body.trim()}
                    className="w-full px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSavingTemplate ? (
                      <>
                        <LazyIcon name="Loader2" className="h-3 w-3 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <LazyIcon name="Save" className="h-3 w-3" />
                        Save Template
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {/* Success message */}
              {templateSaveSuccess && (
                <div className="px-3 py-2 bg-green-50 border-t border-green-200 flex items-center gap-2 text-xs text-green-700">
                  <LazyIcon name="CheckCircle2" className="h-3 w-3" />
                  Template saved successfully!
                </div>
              )}
            </div>
          )}

          {/* Send Mode Toggle */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <span className="text-sm font-medium text-slate-700">Mode:</span>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => handleModeSwitch('template')}
                disabled={isSending || bulkSend.isProcessing}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  sendMode === 'template' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Same Template
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('ai')}
                disabled={isSending || bulkSend.isProcessing}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  sendMode === 'ai' 
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                AI Per-Recipient ✨
              </button>
            </div>
          </div>

          {/* AI Mode: Recipient Table with Status */}
          {sendMode === 'ai' && modalState === 'composing' && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {/* Header with Generate All button */}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                <span className="text-sm font-medium text-slate-700">
                  Recipients ({bulkSend.recipients.length})
                </span>
                <div className="flex items-center gap-2">
                  {bulkSend.progress.generated > 0 && (
                    <span className="text-xs text-slate-500">
                      {bulkSend.progress.generated}/{bulkSend.progress.total} generated
                    </span>
                  )}
                  <button
                    onClick={handleGenerateAll}
                    disabled={bulkSend.isProcessing || bulkSend.recipients.length === 0}
                    data-testid="bulk-email-generate-all"
                    className="px-3 py-1 text-xs font-medium bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {bulkSend.isProcessing ? (
                      <>
                        <LazyIcon name="Loader2" className="h-3 w-3 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <LazyIcon name="Sparkles" className="h-3 w-3" />
                        Generate All
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Recipient list */}
              <div className="max-h-48 overflow-y-auto">
                {bulkSend.recipients.map((recipient) => (
                  <RecipientRow 
                    key={recipient.id} 
                    recipient={recipient}
                    onGenerate={() => bulkSend.generateForRecipient(recipient.id, selectedTone)}
                    onApprove={() => bulkSend.approveRecipient(recipient.id)}
                    onEdit={(subject, body) => bulkSend.updateRecipientContent(recipient.id, subject, body)}
                    disabled={bulkSend.isProcessing}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Subject Line (only show in template mode) */}
          {sendMode === 'template' && (
          <>
          <div>
            <label htmlFor="email-subject" className="block text-sm font-medium text-slate-700 mb-1.5">
              Subject Line
            </label>
            <input
              id="email-subject"
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
              <label htmlFor="email-body" className="block text-sm font-medium text-slate-700">
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
                id="email-body"
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
            
            {/* Sprint 39C: Spam Score Indicator */}
            {(subject.trim() || body.trim()) && (
              <SpamScoreIndicator
                result={spamAnalysis.result}
                isLoading={spamAnalysis.isLoading}
                error={spamAnalysis.error}
                testId="bulk-email-spam-indicator"
                className="mt-3"
              />
            )}
            
            {/* Sprint 39F: Compliance Checklist */}
            {(subject.trim() || body.trim()) && (
              <ComplianceChecklist
                subject={subject}
                body={body}
                from={SENDER_IDENTITIES.find(s => s.id === selectedSender)?.email || SENDER_IDENTITIES[0].email}
                className="mt-3"
              />
            )}
            
            {/* Sprint 39D: Send Time Optimization Toggle */}
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <LazyIcon name="Clock" className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">
                    Optimize send time for each recipient
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={optimizeSendTime}
                  onClick={() => setOptimizeSendTime(!optimizeSendTime)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    optimizeSendTime ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      optimizeSendTime ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
              
              {optimizeSendTime && scheduledTimes && (
                <div className="mt-2 text-xs text-slate-500 space-y-1">
                  <p className="flex items-center gap-1">
                    <LazyIcon name="Info" className="h-3 w-3" />
                    Emails will be scheduled for each recipient's optimal business hours
                  </p>
                  {withEmail.length > 0 && scheduledTimes.get(withEmail[0].id) && (
                    <p className="text-blue-600">
                      Example: {withEmail[0].name} → {scheduledTimes.get(withEmail[0].id)?.localTime}
                    </p>
                  )}
                </div>
              )}
            </div>
            
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
          </>
          )}

          {/* Progress indicator */}
          {modalState === 'sending' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between text-sm mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-blue-800">Sending emails...</span>
                  {/* Sprint V34 P2.2: Show current recipient */}
                  {progress.currentRecipientName && (
                    <span className="text-blue-600 text-xs truncate max-w-[200px]" title={progress.currentRecipientName}>
                      → {progress.currentRecipientName}
                    </span>
                  )}
                </div>
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
            ) : sendMode === 'ai' ? (
              <span>
                <span className="font-medium text-green-700">{approvedCount}</span> approved
                {pendingReviewCount > 0 && (
                  <>, <span className="font-medium text-amber-600">{pendingReviewCount}</span> pending review</>
                )}
                {bulkSend.progress.total > (approvedCount + pendingReviewCount) && (
                  <span className="text-slate-400"> of {bulkSend.progress.total}</span>
                )}
              </span>
            ) : (
              <span>
                <span className="font-medium text-slate-700">{withEmail.length}</span> emails will be sent
              </span>
            )}
          </div>
          <div className="flex gap-3">
            {/* Approve All button - only show when there are pending reviews in AI mode */}
            {sendMode === 'ai' && pendingReviewCount > 0 && modalState === 'composing' && (
              <button
                onClick={() => bulkSend.approveAll()}
                disabled={bulkSend.isProcessing || isSending}
                className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 flex items-center gap-2"
              >
                <LazyIcon name="CheckCircle" className="h-4 w-4" />
                Approve All ({pendingReviewCount})
              </button>
            )}
            <button
              onClick={onClose}
              disabled={modalState === 'sending' || bulkSend.isProcessing}
              data-testid="bulk-email-cancel"
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              {modalState === 'results' ? 'Close' : 'Cancel'}
            </button>
            {modalState === 'composing' && (
              <button
                onClick={handleSubmit}
                disabled={!canSend || bulkSend.isProcessing || isSending || (sendMode === 'ai' && approvedCount === 0)}
                data-testid="bulk-email-send"
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                  sendMode === 'ai' 
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {(isSending || bulkSend.isProcessing) ? (
                  <>
                    <LazyIcon name="Loader2" className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <LazyIcon name="Send" className="h-4 w-4" />
                    {sendMode === 'ai' 
                      ? approvedCount > 0 
                        ? `Send ${approvedCount} approved`
                        : 'Approve emails first'
                      : `Send to ${withEmail.length} prospect${withEmail.length !== 1 ? 's' : ''}`
                    }
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog (T2.4) */}
      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <LazyIcon name="AlertTriangle" className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Delete Template?</h3>
                <p className="text-sm text-slate-600 mt-1">
                  This will permanently delete "{currentTemplate.name}". This action cannot be undone.
                </p>
                {currentTemplate.isDefault && (
                  <p className="text-sm text-amber-600 mt-2">
                    ⚠️ Default templates cannot be deleted.
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeletingTemplate}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTemplate}
                disabled={isDeletingTemplate || currentTemplate.isDefault}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isDeletingTemplate && <LazyIcon name="Loader2" className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sprint V34 P1.3: Success celebration confetti */}
      <SuccessCelebration show={showCelebration} />
    </div>
  );
}

export default BulkEmailModal;

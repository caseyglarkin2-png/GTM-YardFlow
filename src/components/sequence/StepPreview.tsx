/**
 * StepPreview - Sprint 702 T702.3
 * 
 * Preview panel for a selected sequence step.
 * Shows full step details when a step is selected in the list.
 * 
 * Features:
 * - Subject and body preview
 * - Merge tag highlighting
 * - Edit mode toggle
 * - Delay visualization
 */

import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { 
  Mail, 
  Clock, 
  Edit3, 
  Eye, 
  Save, 
  X,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import type { EmailStep, EmailStepType } from '@/types/emailSequence';

// =============================================================================
// Types
// =============================================================================

export interface StepPreviewProps {
  /** Step to preview */
  step: EmailStep | null;
  /** Step index (for display) */
  stepIndex?: number;
  /** Validation errors for this step */
  errors?: Array<{ field: string; message: string }>;
  /** Whether editing is allowed */
  editable?: boolean;
  /** Callback when step is updated */
  onUpdate?: (updates: Partial<EmailStep>) => void;
  /** Empty state content */
  emptyState?: ReactNode;
  /** Additional CSS class */
  className?: string;
}

interface StepTypeConfig {
  label: string;
  color: string;
  bgColor: string;
}

// =============================================================================
// Constants
// =============================================================================

const STEP_TYPES: Record<EmailStepType, StepTypeConfig> = {
  initial: { label: 'Initial Outreach', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  follow_up_1: { label: 'Follow-up 1', color: 'text-purple-700', bgColor: 'bg-purple-50' },
  follow_up_2: { label: 'Follow-up 2', color: 'text-indigo-700', bgColor: 'bg-indigo-50' },
  break_up: { label: 'Break-up', color: 'text-orange-700', bgColor: 'bg-orange-50' },
  meeting_confirm: { label: 'Meeting Confirm', color: 'text-green-700', bgColor: 'bg-green-50' },
  no_show: { label: 'No-show Follow-up', color: 'text-red-700', bgColor: 'bg-red-50' },
};

const MERGE_TAGS = [
  { tag: '{{firstName}}', label: 'First Name', color: 'bg-blue-100 text-blue-700' },
  { tag: '{{lastName}}', label: 'Last Name', color: 'bg-blue-100 text-blue-700' },
  { tag: '{{company}}', label: 'Company', color: 'bg-green-100 text-green-700' },
  { tag: '{{title}}', label: 'Title', color: 'bg-purple-100 text-purple-700' },
  { tag: '{{senderName}}', label: 'Sender', color: 'bg-slate-100 text-slate-700' },
];

// =============================================================================
// Component
// =============================================================================

export function StepPreview({
  step,
  stepIndex = 0,
  errors = [],
  editable = false,
  onUpdate,
  emptyState,
  className = '',
}: StepPreviewProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  
  const hasErrors = errors.length > 0;
  const typeConfig = step ? STEP_TYPES[step.type] : null;
  
  // Highlight merge tags in content
  const highlightMergeTags = useCallback((content: string): ReactNode => {
    if (!content) return null;
    
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    
    // Find all merge tags
    const tagRegex = /\{\{(\w+)\}\}/g;
    let match: RegExpExecArray | null;
    
    while ((match = tagRegex.exec(content)) !== null) {
      // Add text before tag
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      
      // Add highlighted tag
      const currentMatch = match; // Capture for safety
      const tagInfo = MERGE_TAGS.find(t => t.tag === currentMatch[0]);
      parts.push(
        <span 
          key={currentMatch.index}
          className={`px-1 py-0.5 rounded text-xs font-medium ${tagInfo?.color || 'bg-slate-100'}`}
        >
          {tagInfo?.label || currentMatch[1]}
        </span>
      );
      
      lastIndex = currentMatch.index + currentMatch[0].length;
    }
    
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }
    
    return parts;
  }, []);
  
  const startEditing = useCallback(() => {
    if (!step) return;
    setEditSubject(step.subject);
    setEditBody(step.body);
    setIsEditing(true);
  }, [step]);
  
  const cancelEditing = useCallback(() => {
    setIsEditing(false);
  }, []);
  
  const saveEditing = useCallback(() => {
    if (!onUpdate) return;
    onUpdate({
      subject: editSubject,
      body: editBody,
    });
    setIsEditing(false);
  }, [onUpdate, editSubject, editBody]);
  
  // Calculate timeline position
  const timelineInfo = useMemo(() => {
    if (!step) return null;
    
    // This would be calculated from sequence context in real usage
    return {
      day: step.delayDays,
      isFirst: stepIndex === 0,
    };
  }, [step, stepIndex]);
  
  // ==========================================================================
  // Empty State
  // ==========================================================================
  
  if (!step) {
    return (
      <div className={`flex flex-col items-center justify-center h-full p-8 text-center ${className}`}>
        {emptyState || (
          <>
            <Mail className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">
              No Step Selected
            </h3>
            <p className="text-sm text-slate-500">
              Select a step from the list to preview and edit
            </p>
          </>
        )}
      </div>
    );
  }
  
  // ==========================================================================
  // Preview/Edit View
  // ==========================================================================
  
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${typeConfig?.bgColor}`}>
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-white ${typeConfig?.color} font-semibold text-sm border`}>
            {stepIndex + 1}
          </div>
          <div>
            <div className={`font-medium ${typeConfig?.color}`}>
              {typeConfig?.label}
            </div>
            {!timelineInfo?.isFirst && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                {step.delayDays} day{step.delayDays !== 1 ? 's' : ''} after previous
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {hasErrors ? (
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{errors.length} issue{errors.length !== 1 ? 's' : ''}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>Valid</span>
            </div>
          )}
          
          {editable && !isEditing && (
            <button
              onClick={startEditing}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              aria-label="Edit step"
            >
              <Edit3 className="w-4 h-4 text-slate-600" />
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Subject Line */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Subject Line
          </label>
          {isEditing ? (
            <input
              type="text"
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter subject..."
            />
          ) : (
            <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 min-h-[40px]">
              {highlightMergeTags(step.subject) || (
                <span className="text-slate-400 italic">No subject</span>
              )}
            </div>
          )}
          {errors.find(e => e.field === 'subject') && (
            <p className="text-xs text-red-600 mt-1">
              {errors.find(e => e.field === 'subject')?.message}
            </p>
          )}
        </div>
        
        {/* Email Body */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Email Body
          </label>
          {isEditing ? (
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="Write your email content..."
            />
          ) : (
            <div className="px-3 py-3 bg-slate-50 rounded-lg border border-slate-200 min-h-[200px] whitespace-pre-wrap text-sm">
              {highlightMergeTags(step.body) || (
                <span className="text-slate-400 italic">No content</span>
              )}
            </div>
          )}
          {errors.find(e => e.field === 'body') && (
            <p className="text-xs text-red-600 mt-1">
              {errors.find(e => e.field === 'body')?.message}
            </p>
          )}
        </div>
        
        {/* Merge Tags Reference */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Available Merge Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {MERGE_TAGS.map(({ tag, label, color }) => (
              <button
                key={tag}
                onClick={() => {
                  if (isEditing) {
                    setEditBody(prev => prev + tag);
                  }
                }}
                disabled={!isEditing}
                className={`px-2 py-1 rounded text-xs font-medium ${color} ${isEditing ? 'cursor-pointer hover:opacity-80' : 'opacity-60'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Edit Actions */}
      {isEditing && (
        <div className="flex items-center justify-end gap-2 p-4 border-t bg-slate-50">
          <button
            onClick={cancelEditing}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 inline mr-1" />
            Cancel
          </button>
          <button
            onClick={saveEditing}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4 inline mr-1" />
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}

export default StepPreview;

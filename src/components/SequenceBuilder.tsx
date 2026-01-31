/**
 * SequenceBuilder Component - YardFlow Hub
 * 
 * Sprint 3 T3.1: Visual sequence builder for creating email sequences
 * 
 * Features:
 * - Add/remove/reorder steps
 * - Set delays between steps
 * - Choose step type (initial, follow_up, break_up)
 * - Write email content with variable insertion
 * - Timeline visualization
 * - Validation indicators
 * - Template selection
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Mail,
  Clock,
  ChevronUp,
  ChevronDown,
  Save,
  AlertCircle,
  CheckCircle,
  FileText,
  Variable,
  Eye,
  EyeOff,
  LayoutTemplate,
  X,
} from 'lucide-react';
import type { EmailSequence, EmailStep, SequenceTemplate, EmailStepType } from '@/types/emailSequence';
import { 
  createSequence, 
  addStep, 
  updateStep, 
  removeStep, 
  reorderSteps, 
  validateSequence,
  createFromTemplate,
  SEQUENCE_TEMPLATES,
  type ValidationError 
} from '@/services/EmailSequenceService';

// =============================================================================
// Types
// =============================================================================

interface SequenceBuilderProps {
  /** Initial sequence to edit (optional) */
  initialSequence?: EmailSequence;
  /** Callback when sequence is saved */
  onSave?: (sequence: EmailSequence) => void;
  /** Callback when cancelled */
  onCancel?: () => void;
  /** Read-only mode */
  readOnly?: boolean;
}

type StepTypeConfig = {
  label: string;
  color: string;
  bgColor: string;
};

// =============================================================================
// Constants
// =============================================================================

const STEP_TYPES: Record<EmailStepType, StepTypeConfig> = {
  initial: { label: 'Initial Outreach', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  follow_up_1: { label: 'Follow-up 1', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  follow_up_2: { label: 'Follow-up 2', color: 'text-indigo-700', bgColor: 'bg-indigo-50 border-indigo-200' },
  break_up: { label: 'Break-up', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
  meeting_confirm: { label: 'Meeting Confirm', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  no_show: { label: 'No-show Follow-up', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200' },
};

const MERGE_TAGS = [
  { tag: '{{firstName}}', label: 'First Name' },
  { tag: '{{lastName}}', label: 'Last Name' },
  { tag: '{{company}}', label: 'Company' },
  { tag: '{{title}}', label: 'Title' },
  { tag: '{{senderName}}', label: 'Sender Name' },
  { tag: '{{senderTitle}}', label: 'Sender Title' },
];

const DEFAULT_DELAYS: Record<EmailStepType, number> = {
  initial: 0,
  follow_up_1: 2,
  follow_up_2: 4,
  break_up: 7,
  meeting_confirm: 0,
  no_show: 1,
};

// =============================================================================
// Sub-components
// =============================================================================

interface StepEditorProps {
  step: EmailStep;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  errors: ValidationError[];
  readOnly?: boolean;
  onUpdate: (updates: Partial<EmailStep>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function StepEditor({
  step,
  index,
  isFirst,
  isLast,
  errors,
  readOnly,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: StepEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  
  const typeConfig = STEP_TYPES[step.type];
  const stepErrors = errors.filter(e => e.stepId === step.id);
  const hasErrors = stepErrors.length > 0;
  
  const insertMergeTag = useCallback((tag: string, field: 'subject' | 'body') => {
    const currentValue = step[field];
    onUpdate({ [field]: currentValue + tag });
  }, [step, onUpdate]);

  return (
    <div className={`border rounded-lg ${typeConfig.bgColor} ${hasErrors ? 'ring-2 ring-red-300' : ''}`}>
      {/* Step Header */}
      <div className="flex items-center gap-3 p-4">
        {!readOnly && (
          <div className="flex flex-col gap-1">
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="p-1 hover:bg-white/50 rounded disabled:opacity-30"
              title="Move up"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="p-1 hover:bg-white/50 rounded disabled:opacity-30"
              title="Move down"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        )}
        
        <div className="flex items-center gap-2 flex-1">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-white ${typeConfig.color} font-semibold text-sm border`}>
            {index + 1}
          </div>
          <div>
            <div className={`font-medium ${typeConfig.color}`}>{typeConfig.label}</div>
            {index > 0 && (
              <div className="text-xs text-gray-500">
                {step.delayDays} day{step.delayDays !== 1 ? 's' : ''} after previous
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {hasErrors ? (
            <AlertCircle className="w-5 h-5 text-red-500" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-500" />
          )}
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-white/50 rounded"
          >
            {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          
          {!readOnly && (
            <button
              onClick={onRemove}
              className="p-2 hover:bg-red-100 text-red-600 rounded"
              title="Remove step"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Step Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/50 pt-4">
          {/* Step Type & Delay */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Step Type
              </label>
              <select
                value={step.type}
                onChange={(e) => onUpdate({ type: e.target.value as EmailStepType })}
                disabled={readOnly}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(STEP_TYPES).map(([type, config]) => (
                  <option key={type} value={type}>{config.label}</option>
                ))}
              </select>
            </div>
            
            {index > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Delay (days)
                </label>
                <input
                  type="number"
                  min={1}
                  value={step.delayDays}
                  onChange={(e) => onUpdate({ delayDays: parseInt(e.target.value) || 1 })}
                  disabled={readOnly}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
          
          {/* Subject Line */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Subject Line</label>
              <div className="flex items-center gap-1">
                {MERGE_TAGS.slice(0, 3).map(({ tag, label }) => (
                  <button
                    key={tag}
                    onClick={() => insertMergeTag(tag, 'subject')}
                    disabled={readOnly}
                    className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    title={`Insert ${label}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={step.subject}
              onChange={(e) => onUpdate({ subject: e.target.value })}
              disabled={readOnly}
              placeholder="Enter subject line..."
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
            {stepErrors.find(e => e.field === 'subject') && (
              <p className="text-xs text-red-600 mt-1">Subject line is required</p>
            )}
          </div>
          
          {/* Email Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">Email Body</label>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs text-blue-600 hover:underline"
              >
                {showPreview ? 'Edit' : 'Preview'}
              </button>
            </div>
            
            {/* Merge Tag Toolbar */}
            <div className="flex flex-wrap gap-1 mb-2">
              {MERGE_TAGS.map(({ tag, label }) => (
                <button
                  key={tag}
                  onClick={() => insertMergeTag(tag, 'body')}
                  disabled={readOnly}
                  className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1"
                >
                  <Variable className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>
            
            {showPreview ? (
              <div className="w-full min-h-[160px] p-3 bg-white border border-gray-300 rounded-lg text-sm whitespace-pre-wrap">
                {step.body || <span className="text-gray-400 italic">No content</span>}
              </div>
            ) : (
              <textarea
                value={step.body}
                onChange={(e) => onUpdate({ body: e.target.value })}
                disabled={readOnly}
                placeholder="Write your email content..."
                rows={6}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-mono"
              />
            )}
            {stepErrors.find(e => e.field === 'body') && (
              <p className="text-xs text-red-600 mt-1">Email body is required</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface TemplatePickerProps {
  onSelect: (template: SequenceTemplate) => void;
  onClose: () => void;
}

function TemplatePicker({ onSelect, onClose }: TemplatePickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Choose a Template</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
          {SEQUENCE_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => {
                onSelect(template);
                onClose();
              }}
              className="w-full text-left p-4 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">{template.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                  {template.steps.length} steps
                </span>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                {template.avgReplyRate && (
                  <span>~{template.avgReplyRate}% reply rate</span>
                )}
                {template.persona && (
                  <span className="capitalize">{template.persona.replace('_', ' ')}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function SequenceBuilder({
  initialSequence,
  onSave,
  onCancel,
  readOnly = false,
}: SequenceBuilderProps) {
  const [sequence, setSequence] = useState<EmailSequence>(
    initialSequence || createSequence('New Sequence')
  );
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Validation
  const validationErrors = useMemo(() => validateSequence(sequence), [sequence]);
  const isValid = validationErrors.length === 0;
  
  // Timeline calculation
  const timeline = useMemo(() => {
    let day = 0;
    return sequence.steps.map((step, idx) => {
      if (idx > 0) {
        day += step.delayDays;
      }
      return { step, day };
    });
  }, [sequence.steps]);
  
  // Handlers
  const handleNameChange = useCallback((name: string) => {
    setSequence(prev => ({ ...prev, name, updatedAt: new Date().toISOString() }));
  }, []);
  
  const handleAddStep = useCallback((type: EmailStepType = 'follow_up_1') => {
    setSequence(prev => addStep(prev, {
      type,
      subject: '',
      body: '',
      delayDays: DEFAULT_DELAYS[type],
      condition: 'no_reply',
    }));
  }, []);
  
  const handleUpdateStep = useCallback((stepId: string, updates: Partial<EmailStep>) => {
    setSequence(prev => updateStep(prev, stepId, updates));
  }, []);
  
  const handleRemoveStep = useCallback((stepId: string) => {
    setSequence(prev => removeStep(prev, stepId));
  }, []);
  
  const handleMoveStep = useCallback((fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= sequence.steps.length) return;
    setSequence(prev => reorderSteps(prev, fromIndex, toIndex));
  }, [sequence.steps.length]);
  
  const handleTemplateSelect = useCallback((template: SequenceTemplate) => {
    const newSequence = createFromTemplate(template);
    setSequence(newSequence);
  }, []);
  
  const handleSave = useCallback(async () => {
    if (!isValid) return;
    
    setIsSaving(true);
    try {
      onSave?.(sequence);
    } finally {
      setIsSaving(false);
    }
  }, [sequence, isValid, onSave]);
  
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              value={sequence.name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={readOnly}
              className="text-xl font-semibold text-gray-900 bg-transparent border-0 focus:ring-0 w-full"
              placeholder="Sequence Name"
            />
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span>{sequence.steps.length} steps</span>
              <span>•</span>
              <span>{timeline.length > 0 ? timeline[timeline.length - 1].day : 0} days total</span>
              {!isValid && (
                <>
                  <span>•</span>
                  <span className="text-red-600">{validationErrors.length} issue(s)</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {!readOnly && (
              <>
                <button
                  onClick={() => setShowTemplatePicker(true)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <LayoutTemplate className="w-4 h-4" />
                  Templates
                </button>
                
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                )}
                
                <button
                  onClick={handleSave}
                  disabled={!isValid || isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Sequence'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Empty State */}
          {sequence.steps.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
              <Mail className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No steps yet</h3>
              <p className="text-gray-500 mb-6">
                Add your first email step or start from a template
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => handleAddStep('initial')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add First Step
                </button>
                <button
                  onClick={() => setShowTemplatePicker(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  <FileText className="w-4 h-4" />
                  Use Template
                </button>
              </div>
            </div>
          )}
          
          {/* Step Editors */}
          {sequence.steps.map((step, index) => (
            <div key={step.id} className="relative">
              {/* Timeline connector */}
              {index > 0 && (
                <div className="absolute left-6 -top-4 h-4 w-0.5 bg-gray-300" />
              )}
              
              <StepEditor
                step={step}
                index={index}
                isFirst={index === 0}
                isLast={index === sequence.steps.length - 1}
                errors={validationErrors}
                readOnly={readOnly}
                onUpdate={(updates) => handleUpdateStep(step.id, updates)}
                onRemove={() => handleRemoveStep(step.id)}
                onMoveUp={() => handleMoveStep(index, 'up')}
                onMoveDown={() => handleMoveStep(index, 'down')}
              />
            </div>
          ))}
          
          {/* Add Step Button */}
          {!readOnly && sequence.steps.length > 0 && (
            <div className="flex items-center justify-center pt-4">
              <div className="relative group">
                <button
                  onClick={() => handleAddStep()}
                  className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Step
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Timeline Preview (optional sidebar visualization) */}
      {sequence.steps.length > 0 && (
        <div className="bg-white border-t px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span className="font-medium">Timeline:</span>
            {timeline.map(({ step, day }, idx) => (
              <span key={step.id} className="flex items-center gap-1">
                {idx > 0 && <span className="text-gray-400">→</span>}
                <span className={`${STEP_TYPES[step.type].color}`}>
                  Day {day}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Template Picker Modal */}
      {showTemplatePicker && (
        <TemplatePicker
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}
    </div>
  );
}

export default SequenceBuilder;

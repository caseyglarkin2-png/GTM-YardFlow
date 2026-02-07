import React, { useState, useEffect } from 'react';
import { LazyIcon } from './icons';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { Prospect } from '../types';

interface ProspectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Prospect>) => Promise<void>;
  initialData?: Prospect | null;
  mode: 'create' | 'edit';
  isProcessing?: boolean;
}

const TIERS = ['Tier 1', 'Tier 2', 'Tier 3'];
const STATUSES = ['new', 'contacted', 'meeting_booked', 'replied', 'bounced', 'unsubscribed'];

export function ProspectFormModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  mode,
  isProcessing = false
}: ProspectFormModalProps) {
  const [formData, setFormData] = useState<Partial<Prospect>>({
    name: '',
    title: '',
    company: '',
    email: '',
    linkedinUrl: '',
    tier: 'Tier 2',
    status: 'new',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Accessibility: Focus trap and Escape key handling
  const dialogRef = useFocusTrap(isOpen, { onEscape: onClose, returnFocus: true });

  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        ...initialData
      });
    } else if (isOpen && mode === 'create') {
      setFormData({
        name: '',
        title: '',
        company: '',
        email: '',
        linkedinUrl: '',
        tier: 'Tier 2',
        status: 'new',
        notes: '',
      });
    }
    setErrors({});
  }, [isOpen, initialData, mode]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) newErrors.name = 'Name is required';
    if (!formData.company?.trim()) newErrors.company = 'Company is required';
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save prospect:', error);
      setErrors(prev => ({ ...prev, form: 'Failed to save. Please try again.' }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prospect-form-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 id="prospect-form-title" className="text-lg font-semibold text-slate-800">
            {mode === 'create' ? 'Add New Prospect' : 'Edit Prospect'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
          >
            <LazyIcon name="X" className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.form && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
              <LazyIcon name="AlertCircle" className="h-4 w-4" />
              {errors.form}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                  errors.name ? 'border-red-300 bg-red-50' : 'border-slate-300'
                }`}
                placeholder="e.g. Jane Doe"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Company <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={e => setFormData({ ...formData, company: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                  errors.company ? 'border-red-300 bg-red-50' : 'border-slate-300'
                }`}
                placeholder="e.g. Acme Corp"
              />
              {errors.company && <p className="text-red-500 text-xs mt-1">{errors.company}</p>}
            </div>

            <div className="col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="e.g. VP of Operations"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                errors.email ? 'border-red-300 bg-red-50' : 'border-slate-300'
              }`}
              placeholder="e.g. jane@acme.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              LinkedIn URL
            </label>
            <input
              type="url"
              value={formData.linkedinUrl}
              onChange={e => setFormData({ ...formData, linkedinUrl: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="https://linkedin.com/in/..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tier</label>
              <select
                value={formData.tier}
                onChange={e => setFormData({ ...formData, tier: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              >
                {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              >
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
              </select>
            </div>
          </div>
          
           <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="Add internal notes..."
              rows={3}
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-200 transition-colors flex items-center gap-2"
            >
              {isProcessing ? (
                <>Saving...</>
              ) : (
                <>
                  <LazyIcon name="Check" className="h-4 w-4" />
                  {mode === 'create' ? 'Create Prospect' : 'Save Changes'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

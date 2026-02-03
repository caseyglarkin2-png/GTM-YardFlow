import React, { useState, useEffect, useMemo } from 'react';
import { LazyIcon } from '../icons';
import { Prospect } from '../../types';
import { getTemplates, DM_CHAR_LIMIT } from '../../config/templates';
import { copyToClipboard } from '../../services/ClipboardService';
import { EmailQualityBadge } from '../EmailQualityBadge';
import { SequenceEnrollmentBadge } from '../SequenceEnrollmentBadge';

interface ProspectDetailPanelProps {
  prospect: Prospect;
  currentUser: string;
  onClose: () => void;
  onUpdateProspect: (updates: Partial<Prospect>) => Promise<void>;
  onBookMeeting: () => void;
  onSendEmail: (templateId: string, body: string, subject?: string) => Promise<void>;
  enrollment?: any; // Type strictly if possible
}

export function ProspectDetailPanel({
  prospect,
  currentUser,
  onClose,
  onUpdateProspect,
  onBookMeeting,
  onSendEmail,
  enrollment
}: ProspectDetailPanelProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('dm_codev');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [showCopied, setShowCopied] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState(prospect.email || '');

  const templates = useMemo(() => 
    getTemplates(prospect, currentUser === 'Me' ? 'The FreightRoll Team' : 'Jake'),
    [prospect, currentUser]
  );

  const currentTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  useEffect(() => {
    setGeneratedMessage(currentTemplate.body);
  }, [currentTemplate]);

  // Handle manual edits to message
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setGeneratedMessage(e.target.value);
  };

  const handleCopy = async () => {
    const result = await copyToClipboard(generatedMessage);
    if (result.success) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
      onUpdateProspect({ status: 'drafted' });
    }
  };

  const handleSaveEmail = async () => {
    if (emailInput.trim() !== prospect.email) {
      await onUpdateProspect({ email: emailInput.trim() || undefined });
    }
    setIsEditingEmail(false);
  };

  const isShortDM = currentTemplate.type === 'short_dm';
  const charCount = generatedMessage.length;
  const isOverLimit = isShortDM && charCount > DM_CHAR_LIMIT;

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 shadow-xl w-[400px]">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-semibold text-slate-800 truncate" title={prospect.name}>
              {prospect.name}
            </h2>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold 
              ${prospect.tier === 'Tier 1' ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              {prospect.tier}
            </span>
          </div>
          <div className="text-sm text-slate-600 truncate">{prospect.title}</div>
          <div className="text-sm text-slate-500 truncate flex items-center gap-1">
             <LazyIcon name="Building2" className="h-3 w-3" />
             {prospect.company}
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
          <LazyIcon name="X" className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-6">
        
        {/* Contact Info Section */}
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-500 uppercase">Contact</label>
                {!isEditingEmail && (
                    <button onClick={() => setIsEditingEmail(true)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                        Edit
                    </button>
                )}
            </div>
            
            {isEditingEmail ? (
                <div className="flex gap-2">
                    <input 
                        type="email" 
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="flex-1 text-sm border rounded px-2 py-1"
                        placeholder="email@company.com"
                        autoFocus
                    />
                    <button onClick={handleSaveEmail} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <LazyIcon name="Check" className="h-4 w-4" />
                    </button>
                    <button onClick={() => { setIsEditingEmail(false); setEmailInput(prospect.email || ''); }} className="p-1 text-red-400 hover:bg-red-50 rounded">
                        <LazyIcon name="X" className="h-4 w-4" />
                    </button>
                </div>
            ) : (
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <LazyIcon name="Mail" className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <span className="text-sm text-slate-700 truncate select-all">{prospect.email || 'No email'}</span>
                    </div>
                    <EmailQualityBadge prospect={prospect} />
                </div>
            )}
            
            {prospect.linkedinUrl && (
                <a 
                    href={prospect.linkedinUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline pl-2"
                >
                    <LazyIcon name="Linkedin" className="h-4 w-4" />
                    LinkedIn Profile
                    <LazyIcon name="ExternalLink" className="h-3 w-3" />
                </a>
            )}
        </div>

        {/* Status & Enrollment */}
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Status</label>
                <select 
                    value={prospect.status}
                    onChange={(e) => onUpdateProspect({ status: e.target.value as Prospect['status'] })}
                    className="w-full text-sm border-slate-200 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="new">New</option>
                    <option value="drafted">Drafted</option>
                    <option value="contacted">Contacted</option>
                    <option value="meeting_booked">Meeting Booked</option>
                    <option value="bounced">Bounced</option>
                </select>
            </div>
            <div>
                 <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Sequence</label>
                 <SequenceEnrollmentBadge enrollment={enrollment} />
            </div>
        </div>

        {/* Message Generator */}
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-500 uppercase">Message Generator</label>
                <select 
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="text-xs border-none bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer text-right"
                >
                    {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                </select>
            </div>

            <textarea
                value={generatedMessage}
                onChange={handleMessageChange}
                rows={8}
                className={`w-full p-3 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-sans
                    ${isOverLimit ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
            />
            
            <div className="flex items-center justify-between text-xs text-slate-400">
                <span className={isOverLimit ? 'text-red-500 font-medium' : ''}>
                    {charCount} / {isShortDM ? DM_CHAR_LIMIT : '∞'} chars
                </span>
                {showCopied && <span className="text-green-600 font-medium flex items-center gap-1"><LazyIcon name="Check" className="h-3 w-3" /> Copied</span>}
            </div>
            
            {/* T204.1: Smart Clipboard Widget */}
            <div className="flex gap-2 pt-1">
                <button
                    onClick={async () => {
                        await copyToClipboard(generatedMessage);
                        setShowCopied(true);
                        setTimeout(() => setShowCopied(false), 2000);
                        onUpdateProspect({ status: 'drafted' });
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 hover:border-slate-300 transition-all text-xs font-medium"
                    title="Copy body text for LinkedIn/Email"
                >
                    <LazyIcon name="Copy" className="h-3.5 w-3.5" />
                    Copy Body
                </button>
                {currentTemplate.subject && (
                    <button
                        onClick={async () => {
                            await copyToClipboard(currentTemplate.subject);
                            setShowCopied(true);
                            setTimeout(() => setShowCopied(false), 2000);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 hover:border-slate-300 transition-all text-xs font-medium"
                        title="Copy subject line"
                    >
                        <LazyIcon name="Type" className="h-3.5 w-3.5" />
                        Copy Subject
                    </button>
                )}
            </div>
        </div>
      </div>

      {/* Actions Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
        {/* T204.2: Manual Status Override */}
        {prospect.status !== 'contacted' && prospect.status !== 'meeting_booked' && (
            <button
                onClick={() => onUpdateProspect({ status: 'contacted', lastContactedAt: new Date().toISOString() })}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-green-200 text-green-700 rounded-lg hover:bg-green-50 transition-all font-medium text-sm shadow-sm"
            >
                <LazyIcon name="CheckCircle" className="h-4 w-4" />
                Mark as Sent / Contacted
            </button>
        )}

        <div className="flex gap-3">
            <button
                onClick={onBookMeeting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-all text-sm font-medium"
            >
                <LazyIcon name="Calendar" className="h-4 w-4" />
                Log Meeting
            </button>
            <button
                onClick={() => onSendEmail(selectedTemplateId, generatedMessage, currentTemplate.subject)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!prospect.email}
                title={!prospect.email ? 'Add email to send' : 'Send via Railway/SendGrid'}
            >
                <LazyIcon name="Send" className="h-4 w-4" />
                Send Email
            </button>
        </div>
      </div>
    </div>
  );
}

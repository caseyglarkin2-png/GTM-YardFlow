import React, { useState } from 'react';
import { Prospect } from '../../types';
import { LazyIcon } from '../icons';
import { ProspectDetailPanel } from './ProspectDetailPanel';

interface InboxPanelProps {
  prospects: Prospect[];
  onUpdateProspect: (id: string, updates: Partial<Prospect>) => Promise<void>;
  isLoading: boolean;
  currentUser: string;
  onBookMeeting: () => void;
  onSendEmail: (templateId: string, body: string, subject?: string) => Promise<void>;
}

export function InboxPanel({ 
  prospects, 
  onUpdateProspect, 
  isLoading,
  currentUser,
  onBookMeeting,
  onSendEmail
}: InboxPanelProps) {
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);

  // Filter for replied prospects
  const repliedProspects = prospects.filter(p => p.status === 'replied' || p.needsResponse);

  const selectedProspect = prospects.find(p => p.id === selectedProspectId) || null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <LazyIcon name="Loader" className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (repliedProspects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <LazyIcon name="Inbox" className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-900">All caught up!</h3>
        <p className="text-sm text-slate-500 mt-1">No unread replies in your inbox.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white">
      {/* List of Replies */}
      <div className={`${selectedProspect ? 'hidden lg:flex' : 'flex'} w-full lg:w-96 flex-col border-r border-slate-200 bg-white`}>
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <LazyIcon name="Inbox" className="h-5 w-5 text-blue-600" />
            Inbox
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
              {repliedProspects.length}
            </span>
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {repliedProspects.map(prospect => (
            <div
              key={prospect.id}
              onClick={() => setSelectedProspectId(prospect.id)}
              className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                selectedProspectId === prospect.id ? 'bg-blue-50/50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-semibold text-slate-900">{prospect.name}</span>
                <span className="text-xs text-slate-400">
                  {prospect.lastReplyAt ? new Date(prospect.lastReplyAt).toLocaleDateString() : 'Unknown'}
                </span>
              </div>
              <div className="text-sm text-slate-600 truncate mb-1">{prospect.company}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  prospect.status === 'replied' 
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {prospect.status === 'replied' ? 'Reply' : 'Update'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reply Detail / Chat */}
      <div className={`${selectedProspect ? 'flex' : 'hidden lg:flex'} flex-1 flex-col bg-slate-50`}>
        {selectedProspect ? (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between lg:justify-end">
              <button 
                onClick={() => setSelectedProspectId(null)}
                className="lg:hidden text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                <LazyIcon name="ArrowLeft" className="h-4 w-4" /> Back
              </button>
              <div className="flex gap-2">
                 <button
                  onClick={() => {
                     // TODO: Mark as handled logic
                     onUpdateProspect(selectedProspect.id, { needsResponse: false, status: 'contacted' }); 
                     setSelectedProspectId(null);
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 text-sm rounded hover:bg-slate-50 flex items-center gap-2"
                >
                  <LazyIcon name="Check" className="h-4 w-4" />
                  Mark Handled
                </button>
              </div>
            </div>
            
            {/* Reuse ProspectDetailPanel but maybe hide some tabs or default to Activity */}
            <div className="flex-1 overflow-hidden">
                {/* 
                  Note: ProspectDetailPanel is complex. 
                  Ideally we should pass an 'initialTab="activity"' prop if supported. 
                  For now we just render it. 
                */}
                <ProspectDetailPanel 
                    prospect={selectedProspect}
                    currentUser={currentUser}
                    onClose={() => setSelectedProspectId(null)}
                    onUpdateProspect={(updates) => onUpdateProspect(selectedProspect.id, updates)}
                    onBookMeeting={onBookMeeting}
                    onSendEmail={onSendEmail}
                />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <LazyIcon name="MessageSquare" className="h-12 w-12 mb-4 opacity-20" />
            <p>Select a conversation to reply</p>
          </div>
        )}
      </div>
    </div>
  );
}

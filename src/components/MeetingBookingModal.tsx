import React from 'react';
import { Loader } from 'lucide-react';
import { LazyIcon } from './icons';
import type { Prospect } from '../types';
import type { ProspectEnrollmentInfo } from '../hooks/useSequenceEnrollment';

interface MeetingBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProspect: Prospect;
  meetingDate: string;
  meetingNotes: string;
  isBookingMeeting: boolean;
  onMeetingDateChange: (date: string) => void;
  onMeetingNotesChange: (notes: string) => void;
  onBookMeeting: () => void;
  getEnrollmentForProspect: (prospectId: string) => ProspectEnrollmentInfo | null;
}

/**
 * Sprint 84.1: Meeting Booking Modal
 * Log meetings with prospects, shows sequence attribution
 * Extracted from App.tsx for maintainability
 */
export function MeetingBookingModal({
  isOpen,
  onClose,
  selectedProspect,
  meetingDate,
  meetingNotes,
  isBookingMeeting,
  onMeetingDateChange,
  onMeetingNotesChange,
  onBookMeeting,
  getEnrollmentForProspect
}: MeetingBookingModalProps): React.ReactElement | null {
  if (!isOpen || !selectedProspect) return null;

  const enrollment = getEnrollmentForProspect(selectedProspect.id);

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Log Meeting</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <LazyIcon name="X" className="h-5 w-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Prospect
            </label>
            <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm">
              <div className="font-medium text-slate-800">{selectedProspect.name}</div>
              <div className="text-xs text-slate-500">{selectedProspect.company}</div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Meeting Date *
            </label>
            <input
              type="datetime-local"
              value={meetingDate}
              onChange={(e) => onMeetingDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={meetingNotes}
              onChange={(e) => onMeetingNotesChange(e.target.value)}
              placeholder="Meeting context, topics discussed..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
            />
          </div>
          
          {/* Attribution Preview */}
          {enrollment && enrollment.sequenceName && (
            <div className="bg-blue-50 rounded-lg p-3 text-xs">
              <div className="font-medium text-blue-800 mb-1">Attribution Preview</div>
              <div className="text-blue-600">
                Sequence: {enrollment.sequenceName} (Step {enrollment.currentStepIndex + 1}/{enrollment.totalSteps})
              </div>
            </div>
          )}
        </div>
        
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onBookMeeting}
            disabled={!meetingDate || isBookingMeeting}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isBookingMeeting ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <LazyIcon name="CheckCircle" className="h-4 w-4" />
                Book Meeting
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * SequenceEnrollmentBadge Component - YardFlow Hub
 * 
 * Sprint 81.2: Visual indicator for sequence enrollment status on prospect rows.
 * Shows: 📧 enrolled (active), ⏸️ paused, ✅ completed
 */

import React from 'react';
import { Mail, Pause, CheckCircle } from 'lucide-react';
import type { ProspectEnrollmentInfo } from '../hooks/useSequenceEnrollment';

interface SequenceEnrollmentBadgeProps {
  enrollment: ProspectEnrollmentInfo | null;
  compact?: boolean;
}

export function SequenceEnrollmentBadge({ 
  enrollment, 
  compact = false 
}: SequenceEnrollmentBadgeProps): React.ReactElement | null {
  if (!enrollment) return null;

  const { status, currentStepIndex, totalSteps, sequenceName } = enrollment;

  // Determine badge appearance based on status
  const getBadgeConfig = () => {
    switch (status) {
      case 'active':
        return {
          icon: Mail,
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-200',
          label: compact ? `${currentStepIndex + 1}/${totalSteps}` : `Step ${currentStepIndex + 1}/${totalSteps}`,
          tooltip: `Active in ${sequenceName || 'sequence'} - Step ${currentStepIndex + 1} of ${totalSteps}`,
        };
      case 'paused':
        return {
          icon: Pause,
          bgColor: 'bg-amber-100',
          textColor: 'text-amber-700',
          borderColor: 'border-amber-200',
          label: compact ? '⏸️' : 'Paused',
          tooltip: `Paused in ${sequenceName || 'sequence'}`,
        };
      case 'completed':
        return {
          icon: CheckCircle,
          bgColor: 'bg-green-100',
          textColor: 'text-green-700',
          borderColor: 'border-green-200',
          label: compact ? '✅' : 'Done',
          tooltip: `Completed ${sequenceName || 'sequence'}`,
        };
      case 'replied':
        return {
          icon: CheckCircle,
          bgColor: 'bg-emerald-100',
          textColor: 'text-emerald-700',
          borderColor: 'border-emerald-200',
          label: compact ? '💬' : 'Replied',
          tooltip: 'Prospect replied!',
        };
      case 'meeting':
        return {
          icon: CheckCircle,
          bgColor: 'bg-purple-100',
          textColor: 'text-purple-700',
          borderColor: 'border-purple-200',
          label: compact ? '📅' : 'Meeting',
          tooltip: 'Meeting booked!',
        };
      default:
        return null;
    }
  };

  const config = getBadgeConfig();
  if (!config) return null;

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${config.bgColor} ${config.textColor} ${config.borderColor}`}
      title={config.tooltip}
      aria-label={config.tooltip}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </span>
  );
}

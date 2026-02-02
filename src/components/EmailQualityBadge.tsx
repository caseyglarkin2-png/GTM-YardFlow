/**
 * Email Quality Badge Component
 * 
 * Sprint 1004: Displays email confidence level as a small badge
 * 
 * Used in prospect rows to quickly identify email quality.
 */

import type { Prospect } from '@/types';

interface EmailQualityBadgeProps {
  prospect: Pick<Prospect, 'email' | 'emailConfidence'>;
  className?: string;
  showLabel?: boolean;
}

/**
 * Get color and label for email quality level
 */
function getEmailQualityStyle(
  email: string | undefined,
  confidence: Prospect['emailConfidence']
): { color: string; bgColor: string; label: string; icon: string } {
  if (!email) {
    return {
      color: 'text-slate-400',
      bgColor: 'bg-slate-100',
      label: 'No email',
      icon: '○',
    };
  }
  
  switch (confidence) {
    case 'verified':
      return {
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        label: 'Verified',
        icon: '✓',
      };
    case 'high':
      return {
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        label: 'High',
        icon: '↑',
      };
    case 'medium':
      return {
        color: 'text-amber-600',
        bgColor: 'bg-amber-100',
        label: 'Medium',
        icon: '→',
      };
    case 'low':
      return {
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        label: 'Low',
        icon: '↓',
      };
    case 'inferred':
      return {
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
        label: 'Inferred',
        icon: '⟡',
      };
    default:
      // Has email but unknown confidence - treat as having email
      return {
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        label: 'Email',
        icon: '●',
      };
  }
}

/**
 * EmailQualityBadge displays a small badge indicating email quality
 */
export function EmailQualityBadge({ prospect, className = '', showLabel = false }: EmailQualityBadgeProps) {
  const style = getEmailQualityStyle(prospect.email, prospect.emailConfidence);
  
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${style.color} ${showLabel ? `${style.bgColor} px-1.5 py-0.5 rounded` : ''} ${className}`}
      title={prospect.email ? `${style.label}: ${prospect.email}` : 'No email address'}
    >
      <span aria-hidden="true">{style.icon}</span>
      {showLabel && <span>{style.label}</span>}
    </span>
  );
}

export default EmailQualityBadge;

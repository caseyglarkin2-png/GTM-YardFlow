import React from 'react';

/**
 * EmailConfidenceBadge Component
 * 
 * Displays confidence score based on email format and source.
 * Extracted from App.tsx for better modularity.
 */

interface EmailConfidenceBadgeProps {
  email: string;
}

type ConfidenceLevel = 'high' | 'medium' | 'low';

interface ConfidenceInfo {
  level: ConfidenceLevel;
  label: string;
  color: string;
}

function getEmailConfidence(email: string): ConfidenceInfo {
  // High confidence: Personal email patterns (first.last@, first_last@, etc.)
  const personalPattern = /^[a-z]+[._-]?[a-z]+@/i;
  const isPersonalFormat = personalPattern.test(email);
  
  // Check for common corporate domains vs generic
  const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
  const domain = email.split('@')[1]?.toLowerCase() || '';
  const isCorporateDomain = !genericDomains.includes(domain);
  
  // High: Corporate domain + personal format
  if (isCorporateDomain && isPersonalFormat) {
    return { level: 'high', label: 'Verified', color: 'bg-green-100 text-green-700 border-green-200' };
  }
  // Medium: Corporate domain OR personal format
  if (isCorporateDomain || isPersonalFormat) {
    return { level: 'medium', label: 'Likely', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  }
  // Low: Generic domain + no personal format
  return { level: 'low', label: 'Unverified', color: 'bg-slate-100 text-slate-500 border-slate-200' };
}

export function EmailConfidenceBadge({ email }: EmailConfidenceBadgeProps): React.ReactElement | null {
  const confidence = getEmailConfidence(email);
  
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${confidence.color}`}>
      {confidence.label}
    </span>
  );
}

// Export confidence function for testing
export { getEmailConfidence };
export type { ConfidenceLevel, ConfidenceInfo };

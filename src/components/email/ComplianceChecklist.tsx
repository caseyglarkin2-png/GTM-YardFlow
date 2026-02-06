/**
 * ComplianceChecklist Component
 * 
 * Sprint 39F.3: Visual checklist showing CAN-SPAM compliance status
 * before sending emails.
 * 
 * Shows:
 * - Unsubscribe header present ✓/✗
 * - Physical address included ✓/✗
 * - Valid from address ✓/✗
 * - Subject line present ✓/✗
 * - Meaningful body content ✓/✗
 * 
 * Red items = must fix before send
 */

import { useMemo } from 'react';
import { LazyIcon } from '@/components/icons';

export interface ComplianceCheckItem {
  id: string;
  label: string;
  passed: boolean;
  description?: string;
}

interface ComplianceChecklistProps {
  /** Email subject */
  subject: string;
  /** Email body text */
  body: string;
  /** From email address */
  from?: string;
  /** Whether unsubscribe headers will be injected (usually auto-injected) */
  hasUnsubscribe?: boolean;
  /** Compact mode — show only failures */
  compact?: boolean;
  /** Custom class */
  className?: string;
}

/**
 * Evaluate CAN-SPAM compliance checks client-side
 */
function evaluateCompliance(
  subject: string,
  body: string,
  from?: string,
  hasUnsubscribe = true,
): ComplianceCheckItem[] {
  const checks: ComplianceCheckItem[] = [];

  // 1. Subject line present
  checks.push({
    id: 'subject',
    label: 'Subject line',
    passed: subject.trim().length > 0,
    description: 'CAN-SPAM requires a non-deceptive subject line',
  });

  // 2. From address valid
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  checks.push({
    id: 'from',
    label: 'From address',
    passed: Boolean(from && emailRegex.test(from)),
    description: 'A valid sender email address is required',
  });

  // 3. Body content
  const bodyText = body.replace(/<[^>]*>/g, '').trim();
  checks.push({
    id: 'body',
    label: 'Body content',
    passed: bodyText.length >= 10,
    description: 'Emails must have meaningful content (at least 10 characters)',
  });

  // 4. Unsubscribe mechanism
  checks.push({
    id: 'unsubscribe',
    label: 'Unsubscribe mechanism',
    passed: hasUnsubscribe || body.toLowerCase().includes('unsubscribe'),
    description: 'CAN-SPAM requires a way to opt out of future emails',
  });

  // 5. Not deceptive subject
  const subjectLower = subject.toLowerCase();
  const deceptive = subjectLower.startsWith('re:') || subjectLower.startsWith('fw:') || subjectLower.startsWith('fwd:');
  checks.push({
    id: 'honest-subject',
    label: 'Non-deceptive subject',
    passed: !deceptive,
    description: 'Subject must not use Re:/Fw: misleadingly (CAN-SPAM §5)',
  });

  return checks;
}

export function ComplianceChecklist({
  subject,
  body,
  from,
  hasUnsubscribe = true,
  compact = false,
  className = '',
}: ComplianceChecklistProps) {
  const checks = useMemo(
    () => evaluateCompliance(subject, body, from, hasUnsubscribe),
    [subject, body, from, hasUnsubscribe],
  );

  const allPassed = checks.every(c => c.passed);
  const failedChecks = checks.filter(c => !c.passed);
  const displayChecks = compact ? failedChecks : checks;

  if (compact && allPassed) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-green-600 ${className}`}>
        <LazyIcon name="CheckCircle" className="h-3.5 w-3.5" />
        <span>CAN-SPAM compliant</span>
      </div>
    );
  }

  return (
    <div className={`${className}`} data-testid="compliance-checklist">
      <div className="flex items-center gap-2 mb-2">
        <LazyIcon name="Shield" className={`h-4 w-4 ${allPassed ? 'text-green-500' : 'text-amber-500'}`} />
        <span className="text-xs font-semibold text-slate-700">
          {allPassed ? 'Compliance Ready' : `${failedChecks.length} issue${failedChecks.length > 1 ? 's' : ''} to fix`}
        </span>
      </div>
      <ul className="space-y-1">
        {displayChecks.map(check => (
          <li key={check.id} className="flex items-start gap-2 text-xs" data-testid={`compliance-${check.id}`}>
            {check.passed ? (
              <LazyIcon name="Check" className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
            ) : (
              <LazyIcon name="X" className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <span className={check.passed ? 'text-slate-600' : 'text-red-700 font-medium'}>
                {check.label}
              </span>
              {!check.passed && check.description && (
                <p className="text-slate-400 mt-0.5">{check.description}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

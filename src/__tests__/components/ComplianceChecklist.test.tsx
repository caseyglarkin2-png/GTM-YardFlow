/**
 * ComplianceChecklist Tests
 * Sprint 39F.3: Tests for CAN-SPAM compliance checklist component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComplianceChecklist } from '../../components/email/ComplianceChecklist';

// Mock LazyIcon
vi.mock('@/components/icons', () => ({
  LazyIcon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className}>{name}</span>
  ),
}));

describe('ComplianceChecklist', () => {
  const validProps = {
    subject: 'Meeting follow-up',
    body: 'Hi there, this is a follow-up about our meeting last week.',
    from: 'jake@freightroll.com',
    hasUnsubscribe: true,
  };

  it('shows all checks as passed when compliant', () => {
    render(<ComplianceChecklist {...validProps} />);
    
    expect(screen.getByText('Compliance Ready')).toBeTruthy();
    expect(screen.getByText('Subject line')).toBeTruthy();
    expect(screen.getByText('From address')).toBeTruthy();
    expect(screen.getByText('Body content')).toBeTruthy();
    expect(screen.getByText('Unsubscribe mechanism')).toBeTruthy();
    expect(screen.getByText('Non-deceptive subject')).toBeTruthy();
  });

  it('flags missing subject', () => {
    render(<ComplianceChecklist {...validProps} subject="" />);
    
    const subjectCheck = screen.getByTestId('compliance-subject');
    expect(subjectCheck.querySelector('[data-testid="icon-X"]')).toBeTruthy();
  });

  it('flags missing from address', () => {
    render(<ComplianceChecklist {...validProps} from="" />);
    
    const fromCheck = screen.getByTestId('compliance-from');
    expect(fromCheck.querySelector('[data-testid="icon-X"]')).toBeTruthy();
  });

  it('flags invalid from address', () => {
    render(<ComplianceChecklist {...validProps} from="not-an-email" />);
    
    const fromCheck = screen.getByTestId('compliance-from');
    expect(fromCheck.querySelector('[data-testid="icon-X"]')).toBeTruthy();
  });

  it('flags short body content', () => {
    render(<ComplianceChecklist {...validProps} body="Hi" />);
    
    const bodyCheck = screen.getByTestId('compliance-body');
    expect(bodyCheck.querySelector('[data-testid="icon-X"]')).toBeTruthy();
  });

  it('flags deceptive Re: subject', () => {
    render(<ComplianceChecklist {...validProps} subject="Re: Our conversation" />);
    
    const honestCheck = screen.getByTestId('compliance-honest-subject');
    expect(honestCheck.querySelector('[data-testid="icon-X"]')).toBeTruthy();
  });

  it('flags deceptive Fw: subject', () => {
    render(<ComplianceChecklist {...validProps} subject="Fw: Important document" />);
    
    const honestCheck = screen.getByTestId('compliance-honest-subject');
    expect(honestCheck.querySelector('[data-testid="icon-X"]')).toBeTruthy();
  });

  it('flags missing unsubscribe when not auto-injected', () => {
    render(<ComplianceChecklist {...validProps} hasUnsubscribe={false} />);
    
    const unsubCheck = screen.getByTestId('compliance-unsubscribe');
    expect(unsubCheck.querySelector('[data-testid="icon-X"]')).toBeTruthy();
  });

  it('passes unsubscribe when body contains unsubscribe text', () => {
    render(
      <ComplianceChecklist
        {...validProps}
        hasUnsubscribe={false}
        body="Click here to unsubscribe from future emails. This is our follow-up."
      />
    );
    
    const unsubCheck = screen.getByTestId('compliance-unsubscribe');
    expect(unsubCheck.querySelector('[data-testid="icon-Check"]')).toBeTruthy();
  });

  it('shows issue count when non-compliant', () => {
    render(<ComplianceChecklist subject="" body="" from="" hasUnsubscribe={false} />);
    
    // Multiple issues detected
    expect(screen.getByText(/issue/)).toBeTruthy();
  });

  it('compact mode shows green checkmark when all pass', () => {
    render(<ComplianceChecklist {...validProps} compact />);
    
    expect(screen.getByText('CAN-SPAM compliant')).toBeTruthy();
    // Should NOT show individual checks
    expect(screen.queryByText('Subject line')).toBeNull();
  });

  it('compact mode shows only failing checks', () => {
    render(<ComplianceChecklist {...validProps} subject="" compact />);
    
    // Should show Subject line as failing
    expect(screen.getByText('Subject line')).toBeTruthy();
    // Should NOT show passing checks
    expect(screen.queryByText('From address')).toBeNull();
  });

  it('shows description for failing checks', () => {
    render(<ComplianceChecklist {...validProps} subject="" />);
    
    expect(screen.getByText('CAN-SPAM requires a non-deceptive subject line')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ComplianceChecklist {...validProps} className="my-test-class" />
    );
    
    expect(container.querySelector('.my-test-class')).toBeTruthy();
  });

  it('strips HTML tags when checking body length', () => {
    // HTML with tags but very little actual text
    render(
      <ComplianceChecklist
        {...validProps}
        body="<div><p><br/></p></div><img src='x'/>Hi"
      />
    );
    
    // "Hi" is only 2 chars after stripping tags — should fail
    const bodyCheck = screen.getByTestId('compliance-body');
    expect(bodyCheck.querySelector('[data-testid="icon-X"]')).toBeTruthy();
  });
});

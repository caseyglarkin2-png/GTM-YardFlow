/**
 * EmailQualityBadge Tests
 * 
 * Sprint 1004: Tests for email quality badge component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailQualityBadge } from '@/components/EmailQualityBadge';

describe('EmailQualityBadge', () => {
  describe('No Email', () => {
    it('renders no email indicator when email is undefined', () => {
      render(<EmailQualityBadge prospect={{ email: undefined }} />);
      
      expect(screen.getByTitle('No email address')).toBeInTheDocument();
      expect(screen.getByText('○')).toBeInTheDocument();
    });

    it('shows No email label when showLabel is true', () => {
      render(<EmailQualityBadge prospect={{ email: undefined }} showLabel />);
      
      expect(screen.getByText('No email')).toBeInTheDocument();
    });
  });

  describe('Verified Email', () => {
    it('renders verified indicator', () => {
      render(
        <EmailQualityBadge 
          prospect={{ email: 'test@example.com', emailConfidence: 'verified' }} 
        />
      );
      
      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.getByTitle('Verified: test@example.com')).toBeInTheDocument();
    });

    it('shows Verified label with showLabel', () => {
      render(
        <EmailQualityBadge 
          prospect={{ email: 'test@example.com', emailConfidence: 'verified' }} 
          showLabel 
        />
      );
      
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('applies green color for verified', () => {
      const { container } = render(
        <EmailQualityBadge 
          prospect={{ email: 'test@example.com', emailConfidence: 'verified' }} 
        />
      );
      
      expect(container.firstChild).toHaveClass('text-green-600');
    });
  });

  describe('High Confidence Email', () => {
    it('renders high confidence indicator', () => {
      render(
        <EmailQualityBadge 
          prospect={{ email: 'test@example.com', emailConfidence: 'high' }} 
        />
      );
      
      expect(screen.getByText('↑')).toBeInTheDocument();
      expect(screen.getByTitle('High: test@example.com')).toBeInTheDocument();
    });
  });

  describe('Medium Confidence Email', () => {
    it('renders medium confidence indicator', () => {
      render(
        <EmailQualityBadge 
          prospect={{ email: 'test@example.com', emailConfidence: 'medium' }} 
        />
      );
      
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('applies amber color for medium', () => {
      const { container } = render(
        <EmailQualityBadge 
          prospect={{ email: 'test@example.com', emailConfidence: 'medium' }} 
        />
      );
      
      expect(container.firstChild).toHaveClass('text-amber-600');
    });
  });

  describe('Low Confidence Email', () => {
    it('renders low confidence indicator', () => {
      render(
        <EmailQualityBadge 
          prospect={{ email: 'test@example.com', emailConfidence: 'low' }} 
        />
      );
      
      expect(screen.getByText('↓')).toBeInTheDocument();
    });
  });

  describe('Inferred Email', () => {
    it('renders inferred indicator', () => {
      render(
        <EmailQualityBadge 
          prospect={{ email: 'test@example.com', emailConfidence: 'inferred' }} 
        />
      );
      
      expect(screen.getByText('⟡')).toBeInTheDocument();
      expect(screen.getByTitle('Inferred: test@example.com')).toBeInTheDocument();
    });

    it('applies purple color for inferred', () => {
      const { container } = render(
        <EmailQualityBadge 
          prospect={{ email: 'test@example.com', emailConfidence: 'inferred' }} 
        />
      );
      
      expect(container.firstChild).toHaveClass('text-purple-600');
    });

    it('shows Inferred label with showLabel', () => {
      render(
        <EmailQualityBadge 
          prospect={{ email: 'test@example.com', emailConfidence: 'inferred' }} 
          showLabel 
        />
      );
      
      expect(screen.getByText('Inferred')).toBeInTheDocument();
    });
  });

  describe('Unknown Confidence', () => {
    it('renders default indicator when email exists but no confidence', () => {
      render(
        <EmailQualityBadge 
          prospect={{ email: 'test@example.com', emailConfidence: undefined }} 
        />
      );
      
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByTitle('Email: test@example.com')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('applies custom className', () => {
      const { container } = render(
        <EmailQualityBadge 
          prospect={{ email: 'test@example.com', emailConfidence: 'verified' }} 
          className="custom-class"
        />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('applies background when showLabel is true', () => {
      const { container } = render(
        <EmailQualityBadge 
          prospect={{ email: 'test@example.com', emailConfidence: 'verified' }} 
          showLabel 
        />
      );
      
      expect(container.firstChild).toHaveClass('bg-green-100');
      expect(container.firstChild).toHaveClass('px-1.5');
    });
  });
});

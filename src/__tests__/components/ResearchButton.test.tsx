/**
 * Research Button Tests - YardFlow Hub
 * 
 * Tests for the inline research button component.
 * 
 * Sprint 59: T59.2 - Research Button Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResearchButton } from '../../components/ResearchButton';
import * as CompanyResearchService from '../../services/CompanyResearchService';
import * as CompanyEnrichmentService from '../../services/CompanyEnrichmentService';

// Mock the services
vi.mock('../../services/CompanyResearchService', () => ({
  researchCompany: vi.fn(),
}));

vi.mock('../../services/CompanyEnrichmentService', () => ({
  setEnrichmentData: vi.fn(),
}));

describe('ResearchButton', () => {
  const mockResearchCompany = vi.mocked(CompanyResearchService.researchCompany);
  const mockSetEnrichmentData = vi.mocked(CompanyEnrichmentService.setEnrichmentData);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    companyId: 'company-123',
    companyName: 'Acme Corp',
  };

  describe('Rendering', () => {
    it('renders icon variant by default', () => {
      render(<ResearchButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('title', 'Research Acme Corp');
    });

    it('renders text variant', () => {
      render(<ResearchButton {...defaultProps} variant="text" />);
      
      expect(screen.getByText('Research')).toBeInTheDocument();
    });

    it('renders full variant with company name', () => {
      render(<ResearchButton {...defaultProps} variant="full" />);
      
      expect(screen.getByText('Research Acme Corp')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ResearchButton {...defaultProps} className="custom-class" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('applies size classes correctly', () => {
      const { rerender } = render(<ResearchButton {...defaultProps} size="sm" />);
      expect(screen.getByRole('button')).toHaveClass('p-1');

      rerender(<ResearchButton {...defaultProps} size="md" />);
      expect(screen.getByRole('button')).toHaveClass('p-2');

      rerender(<ResearchButton {...defaultProps} size="lg" />);
      expect(screen.getByRole('button')).toHaveClass('p-3');
    });

    it('disables button when disabled prop is true', () => {
      render(<ResearchButton {...defaultProps} disabled />);
      
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('Research Flow', () => {
    it('calls researchCompany on click', async () => {
      mockResearchCompany.mockResolvedValueOnce({
        success: true,
        data: {
          companyName: 'Acme Corp',
          facilityCount: 5,
          industryCategory: 'Manufacturing',
          distributionFootprint: 'Regional',
          isYardIntensive: true,
          estimatedTruckVolume: 'High',
          confidence: 0.85,
        },
      });

      render(<ResearchButton {...defaultProps} />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(mockResearchCompany).toHaveBeenCalledWith({ companyName: 'Acme Corp' });
      });
    });

    it('saves enrichment data on successful research', async () => {
      mockResearchCompany.mockResolvedValueOnce({
        success: true,
        data: {
          companyName: 'Acme Corp',
          facilityCount: 5,
          industryCategory: 'Manufacturing',
          distributionFootprint: 'Regional',
          isYardIntensive: true,
          estimatedTruckVolume: 'High',
          confidence: 0.85,
        },
      });

      render(<ResearchButton {...defaultProps} />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(mockSetEnrichmentData).toHaveBeenCalledWith('company-123', {
          facilityCount: 5,
          industryCategory: 'Manufacturing',
          distributionFootprint: 'Regional',
          isYardIntensive: true,
          estimatedTruckVolume: 'High',
        });
      });
    });

    it('calls onComplete callback on success', async () => {
      const onComplete = vi.fn();
      mockResearchCompany.mockResolvedValueOnce({
        success: true,
        data: {
          companyName: 'Acme Corp',
          facilityCount: 5,
          industryCategory: 'Manufacturing',
          distributionFootprint: 'Regional',
          isYardIntensive: true,
          estimatedTruckVolume: 'High',
          confidence: 0.85,
        },
      });

      render(<ResearchButton {...defaultProps} onComplete={onComplete} />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
        }));
      });
    });

    it('calls onError callback on failure', async () => {
      const onError = vi.fn();
      mockResearchCompany.mockResolvedValueOnce({
        success: false,
        error: 'API error',
      });

      render(<ResearchButton {...defaultProps} onError={onError} />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('API error');
      });
    });

    it('handles exception during research', async () => {
      const onError = vi.fn();
      mockResearchCompany.mockRejectedValueOnce(new Error('Network error'));

      render(<ResearchButton {...defaultProps} onError={onError} />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Network error');
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner during research', async () => {
      mockResearchCompany.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: {
            companyName: 'Acme Corp',
            facilityCount: 5,
            industryCategory: 'Manufacturing',
            distributionFootprint: 'Regional',
            isYardIntensive: true,
            estimatedTruckVolume: 'High',
            confidence: 0.85,
          },
        }), 100))
      );

      render(<ResearchButton {...defaultProps} />);
      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByRole('button')).toHaveAttribute('title', 'Researching...');
    });

    it('shows loading text in text variant', async () => {
      mockResearchCompany.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: {
            companyName: 'Acme Corp',
            facilityCount: 5,
            industryCategory: 'Manufacturing',
            distributionFootprint: 'Regional',
            isYardIntensive: true,
            estimatedTruckVolume: 'High',
            confidence: 0.85,
          },
        }), 100))
      );

      render(<ResearchButton {...defaultProps} variant="text" />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Researching...')).toBeInTheDocument();
      });
    });

    it('disables button during research', async () => {
      mockResearchCompany.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: {
            companyName: 'Acme Corp',
            facilityCount: 5,
            industryCategory: 'Manufacturing',
            distributionFootprint: 'Regional',
            isYardIntensive: true,
            estimatedTruckVolume: 'High',
            confidence: 0.85,
          },
        }), 100))
      );

      render(<ResearchButton {...defaultProps} />);
      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('prevents multiple clicks during research', async () => {
      mockResearchCompany.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: {
            companyName: 'Acme Corp',
            facilityCount: 5,
            industryCategory: 'Manufacturing',
            distributionFootprint: 'Regional',
            isYardIntensive: true,
            estimatedTruckVolume: 'High',
            confidence: 0.85,
          },
        }), 100))
      );

      render(<ResearchButton {...defaultProps} />);
      const button = screen.getByRole('button');
      
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockResearchCompany).toHaveBeenCalledTimes(1);
    });
  });

  describe('Success State', () => {
    it('shows success state after research completes', async () => {
      mockResearchCompany.mockResolvedValueOnce({
        success: true,
        data: {
          companyName: 'Acme Corp',
          facilityCount: 5,
          industryCategory: 'Manufacturing',
          distributionFootprint: 'Regional',
          isYardIntensive: true,
          estimatedTruckVolume: 'High',
          confidence: 0.85,
        },
      });

      render(<ResearchButton {...defaultProps} variant="text" />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument();
      });
    });

    it('shows success state in full variant', async () => {
      mockResearchCompany.mockResolvedValueOnce({
        success: true,
        data: {
          companyName: 'Acme Corp',
          facilityCount: 5,
          industryCategory: 'Manufacturing',
          distributionFootprint: 'Regional',
          isYardIntensive: true,
          estimatedTruckVolume: 'High',
          confidence: 0.85,
        },
      });

      render(<ResearchButton {...defaultProps} variant="full" />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Research Complete')).toBeInTheDocument();
      });
    });

    it('applies success styling', async () => {
      mockResearchCompany.mockResolvedValueOnce({
        success: true,
        data: {
          companyName: 'Acme Corp',
          facilityCount: 5,
          industryCategory: 'Manufacturing',
          distributionFootprint: 'Regional',
          isYardIntensive: true,
          estimatedTruckVolume: 'High',
          confidence: 0.85,
        },
      });

      render(<ResearchButton {...defaultProps} />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toHaveClass('text-green-600');
      });
    });
  });

  describe('Edge Cases', () => {
    it('does not research when company name is empty', () => {
      render(<ResearchButton companyId="123" companyName="" />);
      fireEvent.click(screen.getByRole('button'));

      expect(mockResearchCompany).not.toHaveBeenCalled();
    });

    it('handles default error message when error is missing', async () => {
      const onError = vi.fn();
      mockResearchCompany.mockResolvedValueOnce({
        success: false,
      });

      render(<ResearchButton {...defaultProps} onError={onError} />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Research failed');
      });
    });

    it('handles non-Error exceptions', async () => {
      const onError = vi.fn();
      mockResearchCompany.mockRejectedValueOnce('String error');

      render(<ResearchButton {...defaultProps} onError={onError} />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Unknown error');
      });
    });
  });
});

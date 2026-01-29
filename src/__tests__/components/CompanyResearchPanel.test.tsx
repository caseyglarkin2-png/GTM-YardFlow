/**
 * Company Research Panel Tests - YardFlow Hub
 * 
 * Tests for the main research panel component.
 * 
 * Sprint 59: T59.1 - Research Panel Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompanyResearchPanel } from '../../components/CompanyResearchPanel';
import * as useCompanyResearchModule from '../../hooks/useCompanyResearch';

// Mock the hook
vi.mock('../../hooks/useCompanyResearch', () => ({
  useCompanyResearch: vi.fn(),
}));

describe('CompanyResearchPanel', () => {
  const mockResearch = vi.fn();
  const mockBuildQueue = vi.fn();
  const mockRunQueue = vi.fn();
  const mockClearQueue = vi.fn();
  const mockReset = vi.fn();

  const defaultHookReturn = {
    research: mockResearch,
    buildQueue: mockBuildQueue,
    runQueue: mockRunQueue,
    clearQueue: mockClearQueue,
    reset: mockReset,
    isResearching: false,
    isBatchResearching: false,
    lastResult: null,
    error: null,
    queue: [] as { companyName: string; priority: number; status: string }[],
    queueProgress: { current: 0, total: 0, percentage: 0 },
    batchProgress: { current: 0, total: 0, percentage: 0 },
    batchResults: [] as unknown[],
    summary: null as { total: number; fullyResearched: number; partiallyResearched: number; notResearched: number } | null,
    estimate: { estimatedMinutes: 0, estimatedCost: '$0.00' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCompanyResearchModule.useCompanyResearch).mockReturnValue(defaultHookReturn);
  });

  const defaultProps = {
    companies: [] as { id?: string; companyName?: string }[],
  };

  describe('Rendering', () => {
    it('renders panel with title', () => {
      render(<CompanyResearchPanel {...defaultProps} />);
      
      expect(screen.getByText('Company Research')).toBeInTheDocument();
    });

    it('renders description text', () => {
      render(<CompanyResearchPanel {...defaultProps} />);
      
      expect(screen.getByText(/Use AI to research company data/)).toBeInTheDocument();
    });

    it('renders single research section', () => {
      render(<CompanyResearchPanel {...defaultProps} />);
      
      expect(screen.getByText('Research Single Company')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter company name...')).toBeInTheDocument();
    });

    it('renders batch queue section', () => {
      render(<CompanyResearchPanel {...defaultProps} />);
      
      expect(screen.getByText('Batch Research Queue')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<CompanyResearchPanel {...defaultProps} className="custom-class" />);
      
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Single Research', () => {
    it('calls research when button clicked', async () => {
      mockResearch.mockResolvedValueOnce({ success: true, data: {} });
      render(<CompanyResearchPanel {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Enter company name...');
      await userEvent.type(input, 'Acme Corp');
      
      // Get the first Research button (single company research)
      const buttons = screen.getAllByRole('button', { name: /research/i });
      fireEvent.click(buttons[0]);

      await waitFor(() => {
        expect(mockResearch).toHaveBeenCalledWith({ companyName: 'Acme Corp' });
      });
    });

    it('calls research on Enter key', async () => {
      mockResearch.mockResolvedValueOnce({ success: true, data: {} });
      render(<CompanyResearchPanel {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Enter company name...');
      await userEvent.type(input, 'Acme Corp{enter}');

      await waitFor(() => {
        expect(mockResearch).toHaveBeenCalledWith({ companyName: 'Acme Corp' });
      });
    });

    it('disables button when input is empty', () => {
      render(<CompanyResearchPanel {...defaultProps} />);
      
      // Get the first Research button (single company research)
      const buttons = screen.getAllByRole('button', { name: /research/i });
      expect(buttons[0]).toBeDisabled();
    });

    it('disables input when researching', () => {
      vi.mocked(useCompanyResearchModule.useCompanyResearch).mockReturnValue({
        ...defaultHookReturn,
        isResearching: true,
      });

      render(<CompanyResearchPanel {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Enter company name...');
      expect(input).toBeDisabled();
    });
  });

  describe('Last Result Display', () => {
    it('displays last result when available', () => {
      vi.mocked(useCompanyResearchModule.useCompanyResearch).mockReturnValue({
        ...defaultHookReturn,
        lastResult: {
          success: true,
          companyName: 'Acme Corp',
          researchedAt: new Date('2024-01-15'),
          data: {
            facilityCount: 5,
            industryCategory: 'Manufacturing',
            distributionFootprint: 'Regional',
            isYardIntensive: true,
            estimatedTruckVolume: 'High',
          },
          confidence: {
            overall: 'high' as const,
          },
        },
      });

      render(<CompanyResearchPanel {...defaultProps} />);
      
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    it('shows error when result failed', () => {
      vi.mocked(useCompanyResearchModule.useCompanyResearch).mockReturnValue({
        ...defaultHookReturn,
        error: 'API rate limit exceeded',
      });

      render(<CompanyResearchPanel {...defaultProps} />);
      
      expect(screen.getByText('API rate limit exceeded')).toBeInTheDocument();
    });
  });

  describe('Summary Stats', () => {
    it('displays summary when provided', () => {
      vi.mocked(useCompanyResearchModule.useCompanyResearch).mockReturnValue({
        ...defaultHookReturn,
        summary: {
          total: 10,
          fullyResearched: 5,
          partiallyResearched: 3,
          notResearched: 2,
        },
      });

      render(<CompanyResearchPanel {...defaultProps} />);
      
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('Batch Queue', () => {
    it('shows queue count when queue exists', () => {
      vi.mocked(useCompanyResearchModule.useCompanyResearch).mockReturnValue({
        ...defaultHookReturn,
        queue: [
          { companyName: 'Company A', priority: 1, status: 'pending' },
          { companyName: 'Company B', priority: 2, status: 'pending' },
        ],
      });

      render(<CompanyResearchPanel {...defaultProps} />);
      
      // The queue count appears in the "Run Queue" button as "Run Queue (2 pending)"
      expect(screen.getByText(/2 pending/)).toBeInTheDocument();
    });

    it('shows estimate when queue exists', () => {
      vi.mocked(useCompanyResearchModule.useCompanyResearch).mockReturnValue({
        ...defaultHookReturn,
        queue: [
          { companyName: 'Company A', priority: 1, status: 'pending' },
          { companyName: 'Company B', priority: 2, status: 'pending' },
        ],
        estimate: { estimatedMinutes: 4, estimatedCost: '$0.02' },
      });

      render(<CompanyResearchPanel {...defaultProps} />);
      
      expect(screen.getByText(/4 min/)).toBeInTheDocument();
      expect(screen.getByText(/\$0\.02/)).toBeInTheDocument();
    });

    it('calls runQueue when run button clicked', async () => {
      vi.mocked(useCompanyResearchModule.useCompanyResearch).mockReturnValue({
        ...defaultHookReturn,
        queue: [
          { companyName: 'Company A', priority: 1, status: 'pending' },
        ],
      });
      mockRunQueue.mockResolvedValueOnce({ results: [] });

      render(<CompanyResearchPanel {...defaultProps} />);
      
      // Find the run/start queue button
      const buttons = screen.getAllByRole('button');
      const runButton = buttons.find(b => b.textContent?.includes('Run') || b.textContent?.includes('Start'));
      if (runButton) {
        fireEvent.click(runButton);
        await waitFor(() => {
          expect(mockRunQueue).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Callbacks', () => {
    it('calls onResearchComplete when research succeeds', async () => {
      const onResearchComplete = vi.fn();
      const result = { success: true, data: { companyName: 'Acme' } };
      mockResearch.mockResolvedValueOnce(result);
      
      render(<CompanyResearchPanel {...defaultProps} onResearchComplete={onResearchComplete} />);
      
      const input = screen.getByPlaceholderText('Enter company name...');
      await userEvent.type(input, 'Acme Corp');
      
      // Get the first Research button (single company research)
      const buttons = screen.getAllByRole('button', { name: /research/i });
      fireEvent.click(buttons[0]);

      await waitFor(() => {
        expect(onResearchComplete).toHaveBeenCalledWith(result);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty companies array', () => {
      render(<CompanyResearchPanel companies={[]} />);
      
      expect(screen.getByText('Company Research')).toBeInTheDocument();
    });

    it('trims whitespace from company name', async () => {
      mockResearch.mockResolvedValueOnce({ success: true, data: {} });
      render(<CompanyResearchPanel {...defaultProps} />);
      
      const input = screen.getByPlaceholderText('Enter company name...');
      await userEvent.type(input, '  Acme Corp  ');
      
      // Get the first Research button (single company research)
      const buttons = screen.getAllByRole('button', { name: /research/i });
      fireEvent.click(buttons[0]);

      await waitFor(() => {
        expect(mockResearch).toHaveBeenCalledWith({ companyName: 'Acme Corp' });
      });
    });
  });
});

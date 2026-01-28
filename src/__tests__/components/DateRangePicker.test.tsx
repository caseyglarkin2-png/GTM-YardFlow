/**
 * DateRangePicker Component Tests
 * Sprint 28B - T28B.2
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DateRangePicker, type DateRangePickerProps } from '../../components/DateRangePicker';
import type { TimePeriod, DateRange } from '../../types/analytics';

describe('DateRangePicker', () => {
  const defaultProps: DateRangePickerProps = {
    selectedPeriod: 'month',
    onPeriodChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial rendering', () => {
    it('renders the date range picker', () => {
      render(<DateRangePicker {...defaultProps} />);
      expect(screen.getByTestId('date-range-picker')).toBeInTheDocument();
    });

    it('shows the trigger button', () => {
      render(<DateRangePicker {...defaultProps} />);
      expect(screen.getByTestId('date-range-trigger')).toBeInTheDocument();
    });

    it('displays the selected period label', () => {
      render(<DateRangePicker {...defaultProps} selectedPeriod="month" />);
      expect(screen.getByText('This Month')).toBeInTheDocument();
    });

    it('displays Today for today period', () => {
      render(<DateRangePicker {...defaultProps} selectedPeriod="today" />);
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('displays This Week for week period', () => {
      render(<DateRangePicker {...defaultProps} selectedPeriod="week" />);
      expect(screen.getByText('This Week')).toBeInTheDocument();
    });

    it('displays This Quarter for quarter period', () => {
      render(<DateRangePicker {...defaultProps} selectedPeriod="quarter" />);
      expect(screen.getByText('This Quarter')).toBeInTheDocument();
    });

    it('displays This Year for year period', () => {
      render(<DateRangePicker {...defaultProps} selectedPeriod="year" />);
      expect(screen.getByText('This Year')).toBeInTheDocument();
    });

    it('displays All Time for all period', () => {
      render(<DateRangePicker {...defaultProps} selectedPeriod="all" />);
      expect(screen.getByText('All Time')).toBeInTheDocument();
    });

    it('displays custom range when selected', () => {
      const customRange: DateRange = {
        start: new Date('2025-01-01'),
        end: new Date('2025-01-31'),
      };
      render(
        <DateRangePicker 
          {...defaultProps} 
          selectedPeriod="custom" 
          customRange={customRange}
        />
      );
      expect(screen.getByText(/Jan 1, 2025/)).toBeInTheDocument();
      expect(screen.getByText(/Jan 31, 2025/)).toBeInTheDocument();
    });

    it('dropdown is closed by default', () => {
      render(<DateRangePicker {...defaultProps} />);
      expect(screen.queryByTestId('date-range-dropdown')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<DateRangePicker {...defaultProps} className="custom-class" />);
      expect(screen.getByTestId('date-range-picker')).toHaveClass('custom-class');
    });
  });

  describe('dropdown behavior', () => {
    it('opens dropdown when trigger is clicked', () => {
      render(<DateRangePicker {...defaultProps} />);
      fireEvent.click(screen.getByTestId('date-range-trigger'));
      expect(screen.getByTestId('date-range-dropdown')).toBeInTheDocument();
    });

    it('closes dropdown when trigger is clicked again', () => {
      render(<DateRangePicker {...defaultProps} />);
      const trigger = screen.getByTestId('date-range-trigger');
      fireEvent.click(trigger);
      expect(screen.getByTestId('date-range-dropdown')).toBeInTheDocument();
      fireEvent.click(trigger);
      expect(screen.queryByTestId('date-range-dropdown')).not.toBeInTheDocument();
    });

    it('shows all period options in dropdown', () => {
      render(<DateRangePicker {...defaultProps} />);
      fireEvent.click(screen.getByTestId('date-range-trigger'));
      
      // Use getAllByRole to find options since the trigger also shows current selection
      const options = screen.getAllByRole('option');
      const optionTexts = options.map(opt => opt.textContent);
      
      expect(optionTexts).toContain('Today');
      expect(optionTexts).toContain('This Week');
      expect(optionTexts).toContain('This Month');
      expect(optionTexts).toContain('This Quarter');
      expect(optionTexts).toContain('This Year');
      expect(optionTexts).toContain('All Time');
      expect(optionTexts).toContain('Custom Range');
    });

    it('highlights current selection', () => {
      render(<DateRangePicker {...defaultProps} selectedPeriod="week" />);
      fireEvent.click(screen.getByTestId('date-range-trigger'));
      
      const weekOption = screen.getByRole('option', { selected: true });
      expect(weekOption).toHaveTextContent('This Week');
    });
  });

  describe('period selection', () => {
    it('calls onPeriodChange when period is selected', () => {
      const onPeriodChange = vi.fn();
      render(<DateRangePicker {...defaultProps} onPeriodChange={onPeriodChange} />);
      
      fireEvent.click(screen.getByTestId('date-range-trigger'));
      fireEvent.click(screen.getByText('This Week'));
      
      expect(onPeriodChange).toHaveBeenCalledWith('week');
    });

    it('closes dropdown after selection', () => {
      render(<DateRangePicker {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('date-range-trigger'));
      fireEvent.click(screen.getByText('This Week'));
      
      expect(screen.queryByTestId('date-range-dropdown')).not.toBeInTheDocument();
    });

    it.each([
      ['Today', 'today'],
      ['This Week', 'week'],
      ['This Month', 'month'],
      ['This Quarter', 'quarter'],
      ['This Year', 'year'],
      ['All Time', 'all'],
    ])('selects %s and calls onPeriodChange with %s', (label, value) => {
      const onPeriodChange = vi.fn();
      render(<DateRangePicker {...defaultProps} selectedPeriod="today" onPeriodChange={onPeriodChange} />);
      
      fireEvent.click(screen.getByTestId('date-range-trigger'));
      // Find the option button specifically, not the trigger label
      const options = screen.getAllByRole('option');
      const targetOption = options.find(opt => opt.textContent === label);
      expect(targetOption).toBeDefined();
      fireEvent.click(targetOption!);
      
      expect(onPeriodChange).toHaveBeenCalledWith(value);
    });
  });

  describe('custom range selection', () => {
    it('shows custom picker when Custom Range is clicked', () => {
      render(<DateRangePicker {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('date-range-trigger'));
      fireEvent.click(screen.getByText('Custom Range'));
      
      expect(screen.getByTestId('custom-range-picker')).toBeInTheDocument();
    });

    it('shows start and end date inputs', () => {
      render(<DateRangePicker {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('date-range-trigger'));
      fireEvent.click(screen.getByText('Custom Range'));
      
      expect(screen.getByTestId('start-date-input')).toBeInTheDocument();
      expect(screen.getByTestId('end-date-input')).toBeInTheDocument();
    });

    it('shows Apply button in custom picker', () => {
      render(<DateRangePicker {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('date-range-trigger'));
      fireEvent.click(screen.getByText('Custom Range'));
      
      expect(screen.getByTestId('apply-custom-range')).toBeInTheDocument();
    });

    it('shows Back button in custom picker', () => {
      render(<DateRangePicker {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('date-range-trigger'));
      fireEvent.click(screen.getByText('Custom Range'));
      
      expect(screen.getByText('Back')).toBeInTheDocument();
    });

    it('goes back to period list when Back is clicked', () => {
      render(<DateRangePicker {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('date-range-trigger'));
      fireEvent.click(screen.getByText('Custom Range'));
      fireEvent.click(screen.getByText('Back'));
      
      expect(screen.queryByTestId('custom-range-picker')).not.toBeInTheDocument();
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('calls onCustomRangeChange when Apply is clicked', () => {
      const onPeriodChange = vi.fn();
      const onCustomRangeChange = vi.fn();
      
      render(
        <DateRangePicker 
          {...defaultProps} 
          onPeriodChange={onPeriodChange}
          onCustomRangeChange={onCustomRangeChange}
        />
      );
      
      fireEvent.click(screen.getByTestId('date-range-trigger'));
      fireEvent.click(screen.getByText('Custom Range'));
      
      fireEvent.change(screen.getByTestId('start-date-input'), { target: { value: '2025-01-01' } });
      fireEvent.change(screen.getByTestId('end-date-input'), { target: { value: '2025-01-31' } });
      
      fireEvent.click(screen.getByTestId('apply-custom-range'));
      
      expect(onPeriodChange).toHaveBeenCalledWith('custom');
      expect(onCustomRangeChange).toHaveBeenCalled();
    });

    it('closes dropdown after applying custom range', () => {
      render(<DateRangePicker {...defaultProps} />);
      
      fireEvent.click(screen.getByTestId('date-range-trigger'));
      fireEvent.click(screen.getByText('Custom Range'));
      fireEvent.click(screen.getByTestId('apply-custom-range'));
      
      expect(screen.queryByTestId('date-range-dropdown')).not.toBeInTheDocument();
    });

    it('uses existing custom range values as defaults', () => {
      const customRange: DateRange = {
        start: new Date('2025-02-01'),
        end: new Date('2025-02-28'),
      };
      
      render(
        <DateRangePicker 
          {...defaultProps} 
          selectedPeriod="custom" 
          customRange={customRange}
        />
      );
      
      fireEvent.click(screen.getByTestId('date-range-trigger'));
      fireEvent.click(screen.getByText('Custom Range'));
      
      const startInput = screen.getByTestId('start-date-input') as HTMLInputElement;
      const endInput = screen.getByTestId('end-date-input') as HTMLInputElement;
      
      expect(startInput.value).toBe('2025-02-01');
      expect(endInput.value).toBe('2025-02-28');
    });
  });

  describe('accessibility', () => {
    it('has aria-expanded attribute on trigger', () => {
      render(<DateRangePicker {...defaultProps} />);
      const trigger = screen.getByTestId('date-range-trigger');
      
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('has aria-haspopup attribute on trigger', () => {
      render(<DateRangePicker {...defaultProps} />);
      expect(screen.getByTestId('date-range-trigger')).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('has role=listbox on options list', () => {
      render(<DateRangePicker {...defaultProps} />);
      fireEvent.click(screen.getByTestId('date-range-trigger'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('has role=option on each period option', () => {
      render(<DateRangePicker {...defaultProps} />);
      fireEvent.click(screen.getByTestId('date-range-trigger'));
      
      const options = screen.getAllByRole('option');
      expect(options.length).toBe(7); // 7 period options
    });
  });
});

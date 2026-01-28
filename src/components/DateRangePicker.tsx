/**
 * DateRangePicker Component
 * Sprint 28B - T28B.2
 * 
 * Allows users to select date ranges for analytics filtering.
 */

import { useState, useRef, useEffect } from 'react';
import type { TimePeriod, DateRange } from '../types/analytics';

export interface DateRangePickerProps {
  selectedPeriod: TimePeriod;
  customRange?: DateRange;
  onPeriodChange: (period: TimePeriod) => void;
  onCustomRangeChange?: (range: DateRange) => void;
  className?: string;
}

const PERIOD_OPTIONS: { value: TimePeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DateRangePicker({
  selectedPeriod,
  customRange,
  onPeriodChange,
  onCustomRangeChange,
  className = '',
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [tempStart, setTempStart] = useState<string>(
    customRange ? formatDate(customRange.start) : formatDate(new Date())
  );
  const [tempEnd, setTempEnd] = useState<string>(
    customRange ? formatDate(customRange.end) : formatDate(new Date())
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCustomPicker(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePeriodSelect = (period: TimePeriod) => {
    if (period === 'custom') {
      setShowCustomPicker(true);
    } else {
      onPeriodChange(period);
      setIsOpen(false);
      setShowCustomPicker(false);
    }
  };

  const handleApplyCustomRange = () => {
    const start = new Date(tempStart);
    const end = new Date(tempEnd);
    
    if (start <= end) {
      onPeriodChange('custom');
      onCustomRangeChange?.({ start, end });
      setIsOpen(false);
      setShowCustomPicker(false);
    }
  };

  const getDisplayText = (): string => {
    if (selectedPeriod === 'custom' && customRange) {
      return `${formatDisplayDate(customRange.start)} - ${formatDisplayDate(customRange.end)}`;
    }
    return PERIOD_OPTIONS.find(opt => opt.value === selectedPeriod)?.label || 'Select Period';
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`} data-testid="date-range-picker">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg 
                   hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 
                   text-gray-700 text-sm font-medium shadow-sm transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        data-testid="date-range-trigger"
      >
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{getDisplayText()}</span>
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
             fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute z-50 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg"
          data-testid="date-range-dropdown"
        >
          {!showCustomPicker ? (
            <ul className="py-1" role="listbox">
              {PERIOD_OPTIONS.map((option) => (
                <li key={option.value}>
                  <button
                    onClick={() => handlePeriodSelect(option.value)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors
                              ${selectedPeriod === option.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                    role="option"
                    aria-selected={selectedPeriod === option.value}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 space-y-4" data-testid="custom-range-picker">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={tempStart}
                  onChange={(e) => setTempStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm 
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="start-date-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={tempEnd}
                  onChange={(e) => setTempEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm 
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="end-date-input"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCustomPicker(false)}
                  className="flex-1 px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-md 
                           hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleApplyCustomRange}
                  className="flex-1 px-3 py-2 text-sm text-white bg-blue-600 rounded-md 
                           hover:bg-blue-700 transition-colors"
                  data-testid="apply-custom-range"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

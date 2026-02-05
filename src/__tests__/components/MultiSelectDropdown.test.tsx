/**
 * Tests for MultiSelectDropdown Component
 * 
 * Sprint 36D: T36D.1 - Multi-select tier filter tests
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiSelectDropdown, type MultiSelectOption } from '@/components/MultiSelectDropdown';

const defaultOptions: MultiSelectOption[] = [
  { value: 'Tier 1', label: 'Tier 1', emoji: '⭐' },
  { value: 'Tier 2', label: 'Tier 2', emoji: '🔵' },
  { value: 'Tier 3', label: 'Tier 3', emoji: '⚪' },
  { value: 'Tier 4', label: 'Tier 4', emoji: '⬜' },
];

describe('MultiSelectDropdown', () => {
  it('renders with label', () => {
    render(
      <MultiSelectDropdown
        label="Filter by Tier"
        options={defaultOptions}
        selected={[]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Filter by Tier')).toBeInTheDocument();
  });

  it('shows placeholder when nothing selected', () => {
    render(
      <MultiSelectDropdown
        label="Tier"
        options={defaultOptions}
        selected={[]}
        onChange={vi.fn()}
        placeholder="All Tiers"
      />
    );

    expect(screen.getByText('All Tiers')).toBeInTheDocument();
  });

  it('shows single value when one selected', () => {
    render(
      <MultiSelectDropdown
        label="Tier"
        options={defaultOptions}
        selected={['Tier 1']}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Tier 1')).toBeInTheDocument();
  });

  it('shows count when multiple selected', () => {
    render(
      <MultiSelectDropdown
        label="Tier"
        options={defaultOptions}
        selected={['Tier 1', 'Tier 2']}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('opens dropdown on click', async () => {
    const user = userEvent.setup();
    render(
      <MultiSelectDropdown
        label="Tier"
        options={defaultOptions}
        selected={[]}
        onChange={vi.fn()}
        id="tier"
      />
    );

    await user.click(screen.getByTestId('tier-button'));
    
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByTestId('tier-option-tier-1')).toBeInTheDocument();
  });

  it('selects option on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    
    render(
      <MultiSelectDropdown
        label="Tier"
        options={defaultOptions}
        selected={[]}
        onChange={onChange}
        id="tier"
      />
    );

    await user.click(screen.getByTestId('tier-button'));
    await user.click(screen.getByTestId('tier-option-tier-1'));
    
    // Uses Railway format 'Tier 1' not Firestore 'T1'
    expect(onChange).toHaveBeenCalledWith(['Tier 1']);
  });

  it('adds to selection on second click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    
    render(
      <MultiSelectDropdown
        label="Tier"
        options={defaultOptions}
        selected={['Tier 1']}
        onChange={onChange}
        id="tier"
      />
    );

    await user.click(screen.getByTestId('tier-button'));
    await user.click(screen.getByTestId('tier-option-tier-2'));
    
    expect(onChange).toHaveBeenCalledWith(['Tier 1', 'Tier 2']);
  });

  it('removes from selection when clicking selected option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    
    render(
      <MultiSelectDropdown
        label="Tier"
        options={defaultOptions}
        selected={['Tier 1', 'Tier 2']}
        onChange={onChange}
        id="tier"
      />
    );

    await user.click(screen.getByTestId('tier-button'));
    await user.click(screen.getByTestId('tier-option-tier-1'));
    
    expect(onChange).toHaveBeenCalledWith(['Tier 2']);
  });

  it('clears selection on clear button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    
    render(
      <MultiSelectDropdown
        label="Tier"
        options={defaultOptions}
        selected={['Tier 1', 'Tier 2']}
        onChange={onChange}
        id="tier"
      />
    );

    await user.click(screen.getByTestId('tier-button'));
    await user.click(screen.getByTestId('tier-clear'));
    
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows checkmarks on selected options', async () => {
    const user = userEvent.setup();
    
    render(
      <MultiSelectDropdown
        label="Tier"
        options={defaultOptions}
        selected={['Tier 1']}
        onChange={vi.fn()}
        id="tier"
      />
    );

    await user.click(screen.getByTestId('tier-button'));
    
    const tier1Option = screen.getByTestId('tier-option-tier-1');
    expect(tier1Option).toHaveAttribute('aria-selected', 'true');
    
    const tier2Option = screen.getByTestId('tier-option-tier-2');
    expect(tier2Option).toHaveAttribute('aria-selected', 'false');
  });

  describe('Keyboard Navigation', () => {
    it('opens on Enter key', async () => {
      const user = userEvent.setup();
      
      render(
        <MultiSelectDropdown
          label="Tier"
          options={defaultOptions}
          selected={[]}
          onChange={vi.fn()}
          id="tier"
        />
      );

      const button = screen.getByTestId('tier-button');
      button.focus();
      await user.keyboard('{Enter}');
      
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('opens on Space key', async () => {
      const user = userEvent.setup();
      
      render(
        <MultiSelectDropdown
          label="Tier"
          options={defaultOptions}
          selected={[]}
          onChange={vi.fn()}
          id="tier"
        />
      );

      const button = screen.getByTestId('tier-button');
      button.focus();
      await user.keyboard(' ');
      
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('navigates with ArrowDown', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      
      render(
        <MultiSelectDropdown
          label="Tier"
          options={defaultOptions}
          selected={[]}
          onChange={onChange}
          id="tier"
        />
      );

      const button = screen.getByTestId('tier-button');
      button.focus();
      await user.keyboard('{Enter}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      
      // Should select second option (Tier 2)
      expect(onChange).toHaveBeenCalledWith(['Tier 2']);
    });

    it('closes on Escape', async () => {
      const user = userEvent.setup();
      
      render(
        <MultiSelectDropdown
          label="Tier"
          options={defaultOptions}
          selected={[]}
          onChange={vi.fn()}
          id="tier"
        />
      );

      await user.click(screen.getByTestId('tier-button'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes on button', () => {
      render(
        <MultiSelectDropdown
          label="Tier"
          options={defaultOptions}
          selected={[]}
          onChange={vi.fn()}
          id="tier"
        />
      );

      const button = screen.getByTestId('tier-button');
      expect(button).toHaveAttribute('aria-haspopup', 'listbox');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('has correct ARIA attributes when open', async () => {
      const user = userEvent.setup();
      
      render(
        <MultiSelectDropdown
          label="Tier"
          options={defaultOptions}
          selected={[]}
          onChange={vi.fn()}
          id="tier"
        />
      );

      await user.click(screen.getByTestId('tier-button'));
      
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-multiselectable', 'true');
      
      const button = screen.getByTestId('tier-button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('options have role="option"', async () => {
      const user = userEvent.setup();
      
      render(
        <MultiSelectDropdown
          label="Tier"
          options={defaultOptions}
          selected={[]}
          onChange={vi.fn()}
          id="tier"
        />
      );

      await user.click(screen.getByTestId('tier-button'));
      
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(4);
    });
  });

  it('displays option counts when provided', async () => {
    const user = userEvent.setup();
    
    const optionsWithCounts: MultiSelectOption[] = [
      { value: 'Tier 1', label: 'Tier 1', count: 25 },
      { value: 'Tier 2', label: 'Tier 2', count: 42 },
    ];
    
    render(
      <MultiSelectDropdown
        label="Tier"
        options={optionsWithCounts}
        selected={[]}
        onChange={vi.fn()}
        id="tier"
      />
    );

    await user.click(screen.getByTestId('tier-button'));
    
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    
    render(
      <MultiSelectDropdown
        label="Tier"
        options={defaultOptions}
        selected={[]}
        onChange={onChange}
        id="tier"
        disabled
      />
    );

    const button = screen.getByTestId('tier-button');
    expect(button).toBeDisabled();
    
    await user.click(button);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

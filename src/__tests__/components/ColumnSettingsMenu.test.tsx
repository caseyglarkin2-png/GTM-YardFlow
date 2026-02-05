/**
 * Tests for ColumnSettingsMenu Component
 * 
 * Sprint 36E: T36E.2 - Column settings menu tests
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColumnSettingsMenu } from '@/components/ColumnSettingsMenu';
import { DEFAULT_COLUMNS } from '@/hooks/useColumnPreferences';

describe('ColumnSettingsMenu', () => {
  const defaultProps = {
    columns: DEFAULT_COLUMNS,
    visibleColumns: new Set(['company', 'tier', 'contacts']),
    onToggle: vi.fn(),
    onReset: vi.fn(),
  };

  it('renders settings button', () => {
    render(<ColumnSettingsMenu {...defaultProps} />);
    
    expect(screen.getByTestId('column-settings-button')).toBeInTheDocument();
    expect(screen.getByLabelText('Customize visible columns')).toBeInTheDocument();
  });

  it('opens menu on button click', async () => {
    const user = userEvent.setup();
    render(<ColumnSettingsMenu {...defaultProps} />);
    
    await user.click(screen.getByTestId('column-settings-button'));
    
    expect(screen.getByTestId('column-settings-menu')).toBeInTheDocument();
  });

  it('closes menu on second click', async () => {
    const user = userEvent.setup();
    render(<ColumnSettingsMenu {...defaultProps} />);
    
    await user.click(screen.getByTestId('column-settings-button'));
    expect(screen.getByTestId('column-settings-menu')).toBeInTheDocument();
    
    await user.click(screen.getByTestId('column-settings-button'));
    expect(screen.queryByTestId('column-settings-menu')).not.toBeInTheDocument();
  });

  it('renders all column toggles', async () => {
    const user = userEvent.setup();
    render(<ColumnSettingsMenu {...defaultProps} />);
    
    await user.click(screen.getByTestId('column-settings-button'));
    
    DEFAULT_COLUMNS.forEach(col => {
      expect(screen.getByTestId(`column-toggle-${col.id}`)).toBeInTheDocument();
    });
  });

  it('shows check mark for visible columns', async () => {
    const user = userEvent.setup();
    render(<ColumnSettingsMenu {...defaultProps} />);
    
    await user.click(screen.getByTestId('column-settings-button'));
    
    const tierToggle = screen.getByTestId('column-toggle-tier');
    expect(tierToggle).toHaveAttribute('aria-checked', 'true');
    
    const facilitiesToggle = screen.getByTestId('column-toggle-facilities');
    expect(facilitiesToggle).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onToggle when clicking column', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<ColumnSettingsMenu {...defaultProps} onToggle={onToggle} />);
    
    await user.click(screen.getByTestId('column-settings-button'));
    await user.click(screen.getByTestId('column-toggle-facilities'));
    
    expect(onToggle).toHaveBeenCalledWith('facilities');
  });

  it('does not call onToggle for required columns', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<ColumnSettingsMenu {...defaultProps} onToggle={onToggle} />);
    
    await user.click(screen.getByTestId('column-settings-button'));
    await user.click(screen.getByTestId('column-toggle-company'));
    
    // Company is required, should not toggle
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('disables required column buttons', async () => {
    const user = userEvent.setup();
    render(<ColumnSettingsMenu {...defaultProps} />);
    
    await user.click(screen.getByTestId('column-settings-button'));
    
    const companyToggle = screen.getByTestId('column-toggle-company');
    expect(companyToggle).toBeDisabled();
  });

  it('shows visible count', async () => {
    const user = userEvent.setup();
    render(<ColumnSettingsMenu {...defaultProps} />);
    
    await user.click(screen.getByTestId('column-settings-button'));
    
    // 3 visible out of total columns
    expect(screen.getByText('3/' + DEFAULT_COLUMNS.length)).toBeInTheDocument();
  });

  it('calls onReset and closes menu', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<ColumnSettingsMenu {...defaultProps} onReset={onReset} />);
    
    await user.click(screen.getByTestId('column-settings-button'));
    await user.click(screen.getByTestId('column-settings-reset'));
    
    expect(onReset).toHaveBeenCalled();
    expect(screen.queryByTestId('column-settings-menu')).not.toBeInTheDocument();
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();
    render(<ColumnSettingsMenu {...defaultProps} />);
    
    await user.click(screen.getByTestId('column-settings-button'));
    expect(screen.getByTestId('column-settings-menu')).toBeInTheDocument();
    
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('column-settings-menu')).not.toBeInTheDocument();
  });

  it('closes on click outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ColumnSettingsMenu {...defaultProps} />
        <div data-testid="outside">Outside</div>
      </div>
    );
    
    await user.click(screen.getByTestId('column-settings-button'));
    expect(screen.getByTestId('column-settings-menu')).toBeInTheDocument();
    
    // Click outside the menu
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('column-settings-menu')).not.toBeInTheDocument();
  });

  it('has correct ARIA attributes', async () => {
    const user = userEvent.setup();
    render(<ColumnSettingsMenu {...defaultProps} />);
    
    const button = screen.getByTestId('column-settings-button');
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    
    const menu = screen.getByTestId('column-settings-menu');
    expect(menu).toHaveAttribute('role', 'menu');
  });

  it('shows lock icon for required columns', async () => {
    const user = userEvent.setup();
    render(<ColumnSettingsMenu {...defaultProps} />);
    
    await user.click(screen.getByTestId('column-settings-button'));
    
    // Company is required, should show lock
    const companyToggle = screen.getByTestId('column-toggle-company');
    expect(companyToggle.textContent).toContain('🔒');
  });
});

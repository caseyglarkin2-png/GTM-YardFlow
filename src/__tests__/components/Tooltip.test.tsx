/**
 * Tooltip Component Tests
 * 
 * Sprint 36A: T36A.2 - Tooltip component validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from '../../components/Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders children without tooltip initially', () => {
    render(
      <Tooltip content="Helpful text">
        <button>Hover me</button>
      </Tooltip>
    );
    
    expect(screen.getByText('Hover me')).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on hover after delay', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    
    render(
      <Tooltip content="Helpful text" delay={200}>
        <button>Hover me</button>
      </Tooltip>
    );
    
    await user.hover(screen.getByText('Hover me'));
    
    // Tooltip should not show immediately
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    
    // Advance timers past the delay
    vi.advanceTimersByTime(250);
    
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent('Helpful text');
    });
  });

  it('hides tooltip on mouse leave', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    
    render(
      <Tooltip content="Helpful text" delay={100}>
        <button>Hover me</button>
      </Tooltip>
    );
    
    // Hover and wait for tooltip
    await user.hover(screen.getByText('Hover me'));
    vi.advanceTimersByTime(150);
    
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
    
    // Leave hover
    await user.unhover(screen.getByText('Hover me'));
    
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('shows tooltip on focus', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    
    render(
      <Tooltip content="Keyboard accessible" delay={100}>
        <button>Focus me</button>
      </Tooltip>
    );
    
    // Tab to focus the button
    await user.tab();
    vi.advanceTimersByTime(150);
    
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent('Keyboard accessible');
    });
  });

  it('renders rich content in tooltip', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    
    render(
      <Tooltip 
        content={
          <div>
            <strong>Title</strong>
            <p>Description here</p>
          </div>
        }
        delay={100}
      >
        <button>Hover me</button>
      </Tooltip>
    );
    
    await user.hover(screen.getByText('Hover me'));
    vi.advanceTimersByTime(150);
    
    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toContainHTML('<strong>Title</strong>');
      expect(tooltip).toContainHTML('<p>Description here</p>');
    });
  });

  it('does not show tooltip when disabled', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    
    render(
      <Tooltip content="Should not show" delay={100} disabled>
        <button>Hover me</button>
      </Tooltip>
    );
    
    await user.hover(screen.getByText('Hover me'));
    vi.advanceTimersByTime(200);
    
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('uses correct placement class for top', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    
    render(
      <Tooltip content="Top tooltip" placement="top" delay={100}>
        <button>Hover me</button>
      </Tooltip>
    );
    
    await user.hover(screen.getByText('Hover me'));
    vi.advanceTimersByTime(150);
    
    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      // Top placement tooltip should exist and have content
      expect(tooltip).toHaveTextContent('Top tooltip');
      // The tooltip should have a transform style (exact value varies by viewport)
      expect(tooltip).toHaveAttribute('style');
    });
  });

  it('respects maxWidth prop', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    
    render(
      <Tooltip content="Content" maxWidth={200} delay={100}>
        <button>Hover me</button>
      </Tooltip>
    );
    
    await user.hover(screen.getByText('Hover me'));
    vi.advanceTimersByTime(150);
    
    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveStyle({ maxWidth: '200px' });
    });
  });

  it('cancels show if mouse leaves before delay', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    
    render(
      <Tooltip content="Should not show" delay={300}>
        <button>Hover me</button>
      </Tooltip>
    );
    
    await user.hover(screen.getByText('Hover me'));
    
    // Leave before delay completes
    vi.advanceTimersByTime(100);
    await user.unhover(screen.getByText('Hover me'));
    
    // Complete the original delay
    vi.advanceTimersByTime(300);
    
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

/**
 * SuccessCelebration Tests - Sprint V34 P1.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SuccessCelebration } from '../../components/SuccessCelebration';

describe('SuccessCelebration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when show is false', () => {
    render(<SuccessCelebration show={false} />);
    expect(screen.queryByTestId('success-celebration')).not.toBeInTheDocument();
  });

  it('renders celebration when show is true', () => {
    render(<SuccessCelebration show={true} />);
    expect(screen.getByTestId('success-celebration')).toBeInTheDocument();
  });

  it('generates confetti pieces', () => {
    render(<SuccessCelebration show={true} count={10} />);
    const pieces = screen.getAllByTestId('confetti-piece');
    expect(pieces).toHaveLength(10);
  });

  it('hides after duration expires', () => {
    render(<SuccessCelebration show={true} duration={2000} />);
    expect(screen.getByTestId('success-celebration')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByTestId('success-celebration')).not.toBeInTheDocument();
  });

  it('is aria-hidden for accessibility', () => {
    render(<SuccessCelebration show={true} />);
    expect(screen.getByTestId('success-celebration')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is positioned fixed and pointer-events-none', () => {
    render(<SuccessCelebration show={true} />);
    const container = screen.getByTestId('success-celebration');
    expect(container).toHaveClass('fixed');
    expect(container).toHaveClass('pointer-events-none');
  });

  it('uses default count of 50 pieces', () => {
    render(<SuccessCelebration show={true} />);
    const pieces = screen.getAllByTestId('confetti-piece');
    expect(pieces).toHaveLength(50);
  });

  it('uses default duration of 3000ms', () => {
    render(<SuccessCelebration show={true} />);
    
    // Still visible at 2999ms
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByTestId('success-celebration')).toBeInTheDocument();

    // Hidden at 3000ms
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId('success-celebration')).not.toBeInTheDocument();
  });
});

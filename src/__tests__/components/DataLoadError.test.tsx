/**
 * Tests for DataLoadError component
 *
 * @module __tests__/components/DataLoadError.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataLoadError, DataLoadErrorFullPage } from '../../components/DataLoadError';

describe('DataLoadError', () => {
  const mockError = new Error('Test error message');
  const mockRetry = vi.fn();

  beforeEach(() => {
    mockRetry.mockClear();
  });

  it('renders error message', () => {
    render(<DataLoadError error={mockError} onRetry={mockRetry} />);

    expect(screen.getByText('Failed to Load Data')).toBeInTheDocument();
    expect(
      screen.getByText(/Unable to load prospect data/i)
    ).toBeInTheDocument();
  });

  it('shows custom context', () => {
    render(
      <DataLoadError
        error={mockError}
        onRetry={mockRetry}
        context="email templates"
      />
    );

    expect(
      screen.getByText(/Unable to load email templates/i)
    ).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    render(<DataLoadError error={mockError} onRetry={mockRetry} />);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('shows technical details in development', () => {
    // DEV is always true in vitest environment
    render(<DataLoadError error={mockError} onRetry={mockRetry} />);

    const details = screen.getByText('Technical Details');
    expect(details).toBeInTheDocument();
  });

  it('shows support link', () => {
    render(<DataLoadError error={mockError} onRetry={mockRetry} />);

    const supportLink = screen.getByRole('link', { name: /contact support/i });
    expect(supportLink).toBeInTheDocument();
    expect(supportLink).toHaveAttribute('href', 'mailto:support@yardflow.io');
  });
});

describe('DataLoadErrorFullPage', () => {
  it('renders full page layout', () => {
    const mockError = new Error('Test error');
    const mockRetry = vi.fn();

    render(<DataLoadErrorFullPage error={mockError} onRetry={mockRetry} />);

    expect(screen.getByText('Failed to Load Data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

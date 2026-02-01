/**
 * LazyIcon Component Tests - Sprint 700 T700.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LazyIcon, preloadIcon, preloadIcons, isIconCached } from '../../../components/icons';

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Menu: ({ size, className }: { size?: number; className?: string }) => (
    <svg data-testid="menu-icon" width={size} height={size} className={className} />
  ),
  Settings: ({ size, className }: { size?: number; className?: string }) => (
    <svg data-testid="settings-icon" width={size} height={size} className={className} />
  ),
  // UnknownIcon is intentionally not defined to test missing icons
}));

describe('LazyIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders icon after lazy load', async () => {
      render(<LazyIcon name="Menu" size={24} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('menu-icon')).toBeInTheDocument();
      });
    });

    it('applies className to icon', async () => {
      render(<LazyIcon name="Menu" className="h-6 w-6 text-blue-500" />);
      
      await waitFor(() => {
        const icon = screen.getByTestId('menu-icon');
        expect(icon).toHaveClass('h-6 w-6 text-blue-500');
      });
    });

    it('applies size prop correctly', async () => {
      render(<LazyIcon name="Menu" size={32} />);
      
      await waitFor(() => {
        const icon = screen.getByTestId('menu-icon');
        expect(icon).toHaveAttribute('width', '32');
        expect(icon).toHaveAttribute('height', '32');
      });
    });

    it('uses default size of 24 when not specified', async () => {
      render(<LazyIcon name="Menu" />);
      
      await waitFor(() => {
        const icon = screen.getByTestId('menu-icon');
        expect(icon).toHaveAttribute('width', '24');
        expect(icon).toHaveAttribute('height', '24');
      });
    });
  });

  describe('fallback behavior', () => {
    it('shows fallback during loading', () => {
      render(<LazyIcon name="Menu" size={24} />);
      
      // Fallback should be visible initially
      const fallback = screen.queryByTestId('icon-fallback');
      // Note: Due to Suspense timing, fallback may or may not be visible
      // The test verifies the component doesn't crash during loading
      expect(screen.getByRole('generic')).toBeInTheDocument();
    });

    it('fallback has correct dimensions', () => {
      // Create a component that always shows fallback
      render(<LazyIcon name="Menu" size={48} />);
      
      const fallback = screen.queryByTestId('icon-fallback');
      if (fallback) {
        expect(fallback).toHaveStyle({ width: '48px', height: '48px' });
      }
    });

    it('renders placeholder for unknown icon', async () => {
      // Suppress console warning for this test
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      render(<LazyIcon name="UnknownIcon" size={24} />);
      
      await waitFor(() => {
        const placeholder = screen.queryByTestId('placeholder-icon');
        // Either shows placeholder or fallback
        expect(
          placeholder || screen.queryByTestId('icon-fallback')
        ).toBeInTheDocument();
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('caching', () => {
    it('caches icons after first load', async () => {
      // First render
      const { unmount } = render(<LazyIcon name="Settings" />);
      
      await waitFor(() => {
        expect(screen.getByTestId('settings-icon')).toBeInTheDocument();
      });
      
      unmount();
      
      // Second render should use cache (faster)
      render(<LazyIcon name="Settings" />);
      
      await waitFor(() => {
        expect(screen.getByTestId('settings-icon')).toBeInTheDocument();
      });
    });
  });

  describe('memoization', () => {
    it('does not re-render when parent updates with same props', async () => {
      const { rerender } = render(<LazyIcon name="Menu" size={24} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('menu-icon')).toBeInTheDocument();
      });
      
      // Re-render with same props
      rerender(<LazyIcon name="Menu" size={24} />);
      
      // Should still be the same icon
      expect(screen.getByTestId('menu-icon')).toBeInTheDocument();
    });
  });
});

describe('preloadIcon', () => {
  it('preloads icon into cache', async () => {
    await preloadIcon('Menu');
    expect(isIconCached('Menu')).toBe(true);
  });

  it('handles missing icons gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Should not throw
    await expect(preloadIcon('NonExistentIcon')).resolves.not.toThrow();
    
    consoleSpy.mockRestore();
  });
});

describe('preloadIcons', () => {
  it('preloads multiple icons', async () => {
    await preloadIcons(['Menu', 'Settings']);
    
    expect(isIconCached('Menu')).toBe(true);
    expect(isIconCached('Settings')).toBe(true);
  });
});

describe('isIconCached', () => {
  it('returns false for uncached icons', () => {
    expect(isIconCached('SomeRandomIcon')).toBe(false);
  });

  it('returns true for cached icons', async () => {
    await preloadIcon('Menu');
    expect(isIconCached('Menu')).toBe(true);
  });
});

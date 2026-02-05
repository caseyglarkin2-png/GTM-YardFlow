/**
 * Shared Test Utilities - GTM YardFlow
 * 
 * Provides common test helpers, providers wrapper, and render utilities
 * for consistent testing across the codebase.
 */

import React, { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * Mock AppContext for testing
 */
export const mockAppContextValue = {
  activeTab: 'prospects' as const,
  setActiveTab: vi.fn(),
  isSidebarOpen: true,
  toggleSidebar: vi.fn(),
  isSettingsOpen: false,
  setIsSettingsOpen: vi.fn(),
};

/**
 * Minimal provider wrapper for component tests
 */
export function TestProviders({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/**
 * Render with all required providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult {
  return render(ui, {
    wrapper: TestProviders,
    ...options,
  });
}

/**
 * Create a spy on global fetch with automatic cleanup
 */
export function createFetchSpy() {
  const spy = vi.spyOn(global, 'fetch');
  return {
    spy,
    mockResolve: (data: unknown, init?: Partial<Response>) => {
      spy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(JSON.stringify(data)),
        headers: new Headers(),
        ...init,
      } as Response);
    },
    mockReject: (error: Error) => {
      spy.mockRejectedValueOnce(error);
    },
    mockError: (status: number, data: unknown) => {
      spy.mockResolvedValueOnce({
        ok: false,
        status,
        json: () => Promise.resolve(data),
        headers: new Headers(),
      } as Response);
    },
    restore: () => spy.mockRestore(),
  };
}

/**
 * Wait for async operations in tests
 */
export function waitForAsync(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock toast notifications
 */
export const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
  custom: vi.fn(),
};

/**
 * Setup mock for react-hot-toast
 */
export function setupToastMock() {
  vi.mock('react-hot-toast', () => ({
    default: mockToast,
    toast: mockToast,
    Toaster: () => null,
  }));
}

/**
 * Mock clipboard API for copy button tests
 */
export function setupClipboardMock() {
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(''),
    },
  });
}

/**
 * Mock window.open for external link tests
 */
export function setupWindowOpenMock() {
  const mockOpen = vi.fn();
  window.open = mockOpen;
  return mockOpen;
}

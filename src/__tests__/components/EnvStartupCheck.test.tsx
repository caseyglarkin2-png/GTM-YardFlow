/**
 * EnvStartupCheck Tests
 * Sprint 50 - T50.2
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// We need to mock the module before importing the component
let mockHasFirebaseConfig = true;

vi.mock('../../lib/firebase', () => ({
  hasFirebaseConfig: false,
  get default() {
    return { hasFirebaseConfig: mockHasFirebaseConfig };
  },
}));

// Import after mocking
import { EnvStartupCheck } from '../../components/EnvStartupCheck';

describe('EnvStartupCheck', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows error screen when Firebase is not configured', async () => {
    // Re-mock with hasFirebaseConfig = false for this test
    vi.doMock('../../lib/firebase', () => ({
      hasFirebaseConfig: false,
    }));
    
    const { EnvStartupCheck: TestComponent } = await import('../../components/EnvStartupCheck');
    
    render(
      <TestComponent>
        <div data-testid="app-content">App Content</div>
      </TestComponent>
    );
    
    // Should show error
    expect(screen.getByText(/Configuration Error/i)).toBeInTheDocument();
    // Use getAllByText since VITE_FIREBASE_PROJECT_ID appears twice (list and hint)
    expect(screen.getAllByText(/VITE_FIREBASE_PROJECT_ID/).length).toBeGreaterThan(0);
    expect(screen.getByText(/VITE_FIREBASE_API_KEY/)).toBeInTheDocument();
    
    // Should NOT show app content
    expect(screen.queryByTestId('app-content')).not.toBeInTheDocument();
  });

  it('renders children when Firebase is configured', async () => {
    // Re-mock with hasFirebaseConfig = true for this test
    vi.doMock('../../lib/firebase', () => ({
      hasFirebaseConfig: true,
    }));
    
    const { EnvStartupCheck: TestComponent } = await import('../../components/EnvStartupCheck');
    
    render(
      <TestComponent>
        <div data-testid="app-content">App Content</div>
      </TestComponent>
    );
    
    // Should show app content
    expect(screen.getByTestId('app-content')).toBeInTheDocument();
    
    // Should NOT show error
    expect(screen.queryByText(/Configuration Error/i)).not.toBeInTheDocument();
  });

  it('displays common mistake hint', async () => {
    vi.doMock('../../lib/firebase', () => ({
      hasFirebaseConfig: false,
    }));
    
    const { EnvStartupCheck: TestComponent } = await import('../../components/EnvStartupCheck');
    
    render(
      <TestComponent>
        <div>App</div>
      </TestComponent>
    );
    
    expect(screen.getByText(/FIREBASE_PROJECT_ID instead of VITE_FIREBASE_PROJECT_ID/)).toBeInTheDocument();
  });

  it('has proper accessibility role', async () => {
    vi.doMock('../../lib/firebase', () => ({
      hasFirebaseConfig: false,
    }));
    
    const { EnvStartupCheck: TestComponent } = await import('../../components/EnvStartupCheck');
    
    render(
      <TestComponent>
        <div>App</div>
      </TestComponent>
    );
    
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

/**
 * useAIGenerate Hook Tests
 * 
 * Sprint 27: F3 - Unit tests for AI generation hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAIGenerate } from '../../hooks/useAIGenerate';

// Mock Firebase auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: {
      getIdToken: vi.fn(() => Promise.resolve('mock-firebase-token')),
    },
  })),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useAIGenerate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useAIGenerate());

    expect(result.current.isGenerating).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.generate).toBe('function');
  });

  it('sets loading state during generation', async () => {
    mockFetch.mockImplementation(() => 
      new Promise(resolve => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: () => Promise.resolve({ 
              success: true, 
              content: 'Test content',
              subject: 'Test subject',
            }),
          });
        }, 100);
      })
    );

    const { result } = renderHook(() => useAIGenerate());

    let generatePromise: Promise<unknown>;
    act(() => {
      generatePromise = result.current.generate({
        tone: 'professional',
        prospectName: 'Test',
        companyName: 'Test Co',
      });
    });

    // Should be generating
    expect(result.current.isGenerating).toBe(true);

    await act(async () => {
      await generatePromise;
    });

    // Should be done
    expect(result.current.isGenerating).toBe(false);
  });

  it('returns generated content on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ 
        success: true, 
        content: 'Generated body content',
        subject: 'Generated subject line',
      }),
    });

    const { result } = renderHook(() => useAIGenerate());

    let generateResult: unknown;
    await act(async () => {
      generateResult = await result.current.generate({
        tone: 'luis',
        prospectName: 'Casey',
        companyName: 'FreightRoll',
        title: 'VP Operations',
      });
    });

    expect(generateResult).toEqual({
      success: true,
      content: 'Generated body content',
      subject: 'Generated subject line',
    });
    expect(result.current.error).toBeNull();
  });

  it('sets error state on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ 
        success: false, 
        error: 'AI service error',
      }),
    });

    const { result } = renderHook(() => useAIGenerate());

    let generateResult: unknown;
    await act(async () => {
      generateResult = await result.current.generate({
        tone: 'professional',
        prospectName: 'Test',
        companyName: 'Test Co',
      });
    });

    expect((generateResult as { success: boolean }).success).toBe(false);
    expect(result.current.error).toBe('AI service error');
  });

  it('clears error with clearError()', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ success: false, error: 'Test error' }),
    });

    const { result } = renderHook(() => useAIGenerate());

    await act(async () => {
      await result.current.generate({
        tone: 'professional',
        prospectName: 'Test',
        companyName: 'Test Co',
      });
    });

    expect(result.current.error).toBe('Test error');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('calls API with correct payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, content: 'Test', subject: 'Test' }),
    });

    const { result } = renderHook(() => useAIGenerate());

    await act(async () => {
      await result.current.generate({
        tone: 'challenger',
        prospectName: 'John',
        companyName: 'Acme',
        title: 'CEO',
        goal: 'Book demo',
      });
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ai/generate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-firebase-token',
        }),
        body: JSON.stringify({
          tone: 'challenger',
          prospectName: 'John',
          companyName: 'Acme',
          title: 'CEO',
          goal: 'Book demo',
        }),
      })
    );
  });
});

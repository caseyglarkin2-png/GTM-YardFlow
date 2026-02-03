/**
 * Tests for useTemplates hook (Sprint 27 S4)
 * 
 * Tests:
 * - Railway fetch when flag enabled
 * - Static fallback when Railway unavailable
 * - CRUD operations
 * - Filter methods
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock dependencies before imports - use __esModule pattern for hoisting
vi.mock('@/config/featureFlags', () => ({
  featureFlags: {
    RAILWAY_ENABLED: true,
    RAILWAY_TEMPLATES_ENABLED: true,
  },
  shouldUseRailwayTemplates: () => true,
}));

vi.mock('@/services/RailwayApiClient', () => ({
  railwayClient: {
    templates: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/config/emailTemplates', () => ({
  EMAIL_TEMPLATES: [
    { id: 'static-1', label: 'Static Template 1', subject: 'Subject 1', body: 'Body 1', category: 'outreach' },
    { id: 'static-2', label: 'Static Template 2', subject: 'Subject 2', body: 'Body 2', category: 'follow-up' },
  ],
}));

// Import after mocks
import { useTemplates } from '@/hooks/useTemplates';
import { railwayClient } from '@/services/RailwayApiClient';
import type { EmailTemplateRecord } from '@/types/railway';

// Get mock references after import
const mockTemplatesApi = vi.mocked(railwayClient.templates);

describe('useTemplates', () => {
  const mockRailwayTemplates: EmailTemplateRecord[] = [
    {
      id: 'railway-1',
      name: 'Railway Template 1',
      subject: 'Railway Subject 1',
      body: 'Railway Body 1',
      category: 'outreach',
      tone: 'professional',
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'railway-2',
      name: 'Railway Template 2',
      subject: 'Railway Subject 2',
      body: 'Railway Body 2',
      category: 'follow-up',
      tone: 'casual',
      isActive: true,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock import.meta.env
    vi.stubEnv('VITE_RAILWAY_TEMPLATES_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('initialization', () => {
    it('starts in loading state', () => {
      mockTemplatesApi.list.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      const { result } = renderHook(() => useTemplates());
      
      expect(result.current.isLoading).toBe(true);
      expect(result.current.templates).toEqual([]);
    });

    it('fetches templates from Railway when enabled', async () => {
      mockTemplatesApi.list.mockResolvedValue({
        ok: true,
        data: mockRailwayTemplates,
      } as never);

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Hook merges Railway + static templates (Railway takes precedence by ID)
      // 2 Railway templates + 2 static templates = 4 total (no overlapping IDs)
      expect(result.current.templates.length).toBeGreaterThanOrEqual(2);
      expect(result.current.isRailwaySource).toBe(true);
      // Railway templates should be present
      expect(result.current.templates.find(t => t.id === 'railway-1')).toBeDefined();
      expect(result.current.templates.find(t => t.id === 'railway-2')).toBeDefined();
    });

    it('falls back to static templates on Railway 404', async () => {
      mockTemplatesApi.list.mockRejectedValue({ status: 404, message: 'Not found' });

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.templates.length).toBeGreaterThan(0);
      expect(result.current.isRailwaySource).toBe(false);
      expect(result.current.templates[0].name).toBe('Static Template 1');
    });

    it('falls back to static templates on network error', async () => {
      mockTemplatesApi.list.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.templates.length).toBeGreaterThan(0);
      expect(result.current.isRailwaySource).toBe(false);
    });
  });

  describe('CRUD operations', () => {
    it('creates a new template and updates local state', async () => {
      const newTemplate: EmailTemplateRecord = {
        id: 'new-1',
        name: 'New Template',
        subject: 'New Subject',
        body: 'New Body',
        category: 'introduction',
        tone: 'friendly',
        isActive: true,
        createdAt: '2024-01-03T00:00:00Z',
        updatedAt: '2024-01-03T00:00:00Z',
      };

      mockTemplatesApi.list.mockResolvedValue({ ok: true, data: mockRailwayTemplates } as never);
      mockTemplatesApi.create.mockResolvedValue({ ok: true, data: newTemplate } as never);

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCount = result.current.templates.length;
      const created = await result.current.create({
        name: 'New Template',
        subject: 'New Subject',
        body: 'New Body',
        category: 'introduction',
        tone: 'friendly',
      });
      
      expect(created.ok).toBe(true);
      
      // Wait for state update
      await waitFor(() => {
        expect(result.current.templates.find(t => t.id === 'new-1')).toBeDefined();
      });
    });

    it('updates an existing template', async () => {
      const updatedTemplate: EmailTemplateRecord = {
        ...mockRailwayTemplates[0],
        name: 'Updated Name',
      };

      mockTemplatesApi.list.mockResolvedValue({ ok: true, data: mockRailwayTemplates } as never);
      mockTemplatesApi.update.mockResolvedValue({ ok: true, data: updatedTemplate } as never);

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.update('railway-1', { name: 'Updated Name' });

      // Wait for state update
      await waitFor(() => {
        const updated = result.current.templates.find(t => t.id === 'railway-1');
        expect(updated?.name).toBe('Updated Name');
      });
    });

    it('deletes a template', async () => {
      mockTemplatesApi.list.mockResolvedValue({ ok: true, data: mockRailwayTemplates } as never);
      mockTemplatesApi.delete.mockResolvedValue({ ok: true, data: { success: true } } as never);

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.deleteTemplate('railway-1');

      // Wait for state update - railway-1 should be gone
      await waitFor(() => {
        expect(result.current.templates.find(t => t.id === 'railway-1')).toBeUndefined();
      });
      
      // railway-2 should still exist
      expect(result.current.templates.find(t => t.id === 'railway-2')).toBeDefined();
    });
  });

  describe('filter methods', () => {
    it('filters templates by category', async () => {
      mockTemplatesApi.list.mockResolvedValue({ ok: true, data: mockRailwayTemplates } as never);

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Hook merges Railway + static templates, filter should work on combined set
      const outreachTemplates = result.current.filterByCategory('outreach');
      // At least 1 outreach template (railway-1 + static-1 both have outreach category)
      expect(outreachTemplates.length).toBeGreaterThanOrEqual(1);
      expect(outreachTemplates.every(t => t.category === 'outreach')).toBe(true);
    });

    it('filters templates by tone', async () => {
      mockTemplatesApi.list.mockResolvedValue({ ok: true, data: mockRailwayTemplates } as never);

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const casualTemplates = result.current.filterByTone('casual');
      expect(casualTemplates).toHaveLength(1);
      expect(casualTemplates[0].tone).toBe('casual');
    });
  });

  describe('reload', () => {
    it('reloads templates from Railway', async () => {
      mockTemplatesApi.list.mockResolvedValue({ ok: true, data: mockRailwayTemplates } as never);

      const { result } = renderHook(() => useTemplates());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have Railway + static templates merged
      const initialCount = result.current.templates.length;
      expect(initialCount).toBeGreaterThanOrEqual(2);

      // Update mock to return different data - railway-1 with new name
      const newTemplates = [{ ...mockRailwayTemplates[0], name: 'Reloaded Template' }];
      mockTemplatesApi.list.mockResolvedValue({ ok: true, data: newTemplates } as never);

      await result.current.reload();
      
      // Wait for templates to update
      await waitFor(() => {
        const reloadedTemplate = result.current.templates.find(t => t.id === 'railway-1');
        expect(reloadedTemplate?.name).toBe('Reloaded Template');
      });
    });
  });
});

/**
 * useTemplates Hook
 * 
 * Sprint 27 S4: Template CRUD
 * 
 * Fetches templates from Railway with graceful fallback to static templates.
 * This allows the UI to work immediately while Railway R3 is being built.
 * 
 * Features:
 * - Fetches from Railway /api/templates when available
 * - Falls back to static EMAIL_TEMPLATES on 404/error
 * - Caches templates in state
 * - Provides CRUD operations
 * - Feature-flagged via RAILWAY_TEMPLATES_ENABLED
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { railwayClient } from '@/services/RailwayApiClient';
import { EMAIL_TEMPLATES, type EmailTemplate } from '@/config/emailTemplates';
import { featureFlags, shouldUseRailwayTemplates } from '@/config/featureFlags';
import type { 
  EmailTemplateRecord, 
  CreateTemplateRequest, 
  UpdateTemplateRequest,
  TemplateCategory,
  TemplateTone,
} from '@/types/railway';

// Re-export types for convenience
export type { EmailTemplateRecord, CreateTemplateRequest, UpdateTemplateRequest };

/**
 * Convert static EmailTemplate to EmailTemplateRecord format
 */
function convertStaticTemplate(template: EmailTemplate): EmailTemplateRecord {
  return {
    id: template.id,
    name: template.label,
    subject: template.subject,
    body: template.body,
    category: template.category as TemplateCategory,
    tone: undefined,
    isDefault: true,
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Convert all static templates to EmailTemplateRecord format
 */
function getStaticTemplates(): EmailTemplateRecord[] {
  return EMAIL_TEMPLATES.map(convertStaticTemplate);
}

export interface UseTemplatesReturn {
  /** All available templates (Railway + static fallback) */
  templates: EmailTemplateRecord[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Whether using Railway templates (vs static fallback) */
  isRailwaySource: boolean;
  /** Reload templates from source */
  reload: () => Promise<void>;
  /** Create a new template (Railway only) */
  create: (data: CreateTemplateRequest) => Promise<{ ok: boolean; error?: string; template?: EmailTemplateRecord }>;
  /** Update a template (Railway only, custom templates) */
  update: (id: string, data: UpdateTemplateRequest) => Promise<{ ok: boolean; error?: string }>;
  /** Delete a template (Railway only, custom templates) */
  deleteTemplate: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** Filter templates by category */
  filterByCategory: (category: TemplateCategory | 'all') => EmailTemplateRecord[];
  /** Filter templates by tone */
  filterByTone: (tone: TemplateTone | 'all') => EmailTemplateRecord[];
}

/**
 * Check if Railway templates feature is enabled
 * Uses the centralized feature flag helper from config
 */
function isRailwayTemplatesEnabled(): boolean {
  // Use centralized feature flag + window check for SSR safety
  return shouldUseRailwayTemplates() && typeof window !== 'undefined';
}

/**
 * Hook for managing email templates with Railway backend + fallback
 */
export function useTemplates(): UseTemplatesReturn {
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRailwaySource, setIsRailwaySource] = useState(false);

  /**
   * Load templates from Railway or fall back to static
   */
  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // If Railway templates not enabled, use static immediately
    if (!isRailwayTemplatesEnabled()) {
      setTemplates(getStaticTemplates());
      setIsRailwaySource(false);
      setIsLoading(false);
      return;
    }

    try {
      const result = await railwayClient.templates.list();

      if (result.ok && result.data && Array.isArray(result.data)) {
        // Merge Railway templates with static (Railway takes precedence)
        const railwayTemplates = result.data;
        const staticTemplates = getStaticTemplates();
        
        // Static templates that aren't overridden by Railway
        const railwayIds = new Set(railwayTemplates.map(t => t.id));
        const nonOverriddenStatic = staticTemplates.filter(t => !railwayIds.has(t.id));
        
        setTemplates([...railwayTemplates, ...nonOverriddenStatic]);
        setIsRailwaySource(true);
      } else {
        // Railway returned error - fall back to static
        setTemplates(getStaticTemplates());
        setIsRailwaySource(false);
        
        // Only set error if it's not a 404 (expected when R3 not deployed)
        if (result.statusCode !== 404) {
          setError(result.error || 'Failed to load templates');
        }
      }
    } catch (err) {
      // Network error - fall back to static
      setTemplates(getStaticTemplates());
      setIsRailwaySource(false);
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  /**
   * Create a new template (Railway only)
   */
  const create = useCallback(async (
    data: CreateTemplateRequest
  ): Promise<{ ok: boolean; error?: string; template?: EmailTemplateRecord }> => {
    if (!isRailwayTemplatesEnabled()) {
      return { ok: false, error: 'Template creation requires Railway. Enable VITE_RAILWAY_TEMPLATES_ENABLED.' };
    }

    try {
      const result = await railwayClient.templates.create(data);
      
      if (result.ok && result.data) {
        // Add to local state
        setTemplates(prev => [...prev, result.data!]);
        return { ok: true, template: result.data };
      } else {
        return { ok: false, error: result.error || 'Failed to create template' };
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to create template' };
    }
  }, []);

  /**
   * Update an existing template (Railway only, custom templates)
   */
  const update = useCallback(async (
    id: string,
    data: UpdateTemplateRequest
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!isRailwayTemplatesEnabled()) {
      return { ok: false, error: 'Template updates require Railway. Enable VITE_RAILWAY_TEMPLATES_ENABLED.' };
    }

    // Check if it's a system template
    const template = templates.find(t => t.id === id);
    if (template?.isDefault) {
      return { ok: false, error: 'Cannot edit system templates. Create a copy instead.' };
    }

    try {
      const result = await railwayClient.templates.update(id, data);
      
      if (result.ok && result.data) {
        // Update in local state
        setTemplates(prev => prev.map(t => t.id === id ? result.data! : t));
        return { ok: true };
      } else {
        return { ok: false, error: result.error || 'Failed to update template' };
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to update template' };
    }
  }, [templates]);

  /**
   * Delete a template (Railway only, custom templates)
   */
  const deleteTemplate = useCallback(async (
    id: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!isRailwayTemplatesEnabled()) {
      return { ok: false, error: 'Template deletion requires Railway. Enable VITE_RAILWAY_TEMPLATES_ENABLED.' };
    }

    // Check if it's a system template
    const template = templates.find(t => t.id === id);
    if (template?.isDefault) {
      return { ok: false, error: 'Cannot delete system templates.' };
    }

    try {
      const result = await railwayClient.templates.delete(id);
      
      if (result.ok) {
        // Remove from local state
        setTemplates(prev => prev.filter(t => t.id !== id));
        return { ok: true };
      } else {
        return { ok: false, error: result.error || 'Failed to delete template' };
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete template' };
    }
  }, [templates]);

  /**
   * Filter templates by category
   */
  const filterByCategory = useCallback((
    category: TemplateCategory | 'all'
  ): EmailTemplateRecord[] => {
    if (category === 'all') return templates;
    return templates.filter(t => t.category === category);
  }, [templates]);

  /**
   * Filter templates by tone
   */
  const filterByTone = useCallback((
    tone: TemplateTone | 'all'
  ): EmailTemplateRecord[] => {
    if (tone === 'all') return templates;
    return templates.filter(t => t.tone === tone);
  }, [templates]);

  return {
    templates,
    isLoading,
    error,
    isRailwaySource,
    reload: loadTemplates,
    create,
    update,
    deleteTemplate,
    filterByCategory,
    filterByTone,
  };
}

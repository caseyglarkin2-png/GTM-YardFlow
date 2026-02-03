/**
 * useAIGenerate Hook
 * 
 * Sprint 27: F3 - Client hook for AI content generation
 * 
 * Calls the server-side proxy at /api/ai/generate
 * which securely forwards to Railway backend.
 */

import { useState, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import type { ToneId } from '../config/tones';

export interface GenerateParams {
  tone: ToneId;
  prospectName: string;
  companyName: string;
  title?: string;
  goal?: string;
}

export interface GenerateResult {
  success: boolean;
  content?: string;
  subject?: string;
  error?: string;
}

export interface UseAIGenerateReturn {
  /** Generate AI content */
  generate: (params: GenerateParams) => Promise<GenerateResult>;
  /** Loading state */
  isGenerating: boolean;
  /** Last error message */
  error: string | null;
  /** Clear error state */
  clearError: () => void;
}

/**
 * Hook for generating AI email content
 * 
 * @example
 * const { generate, isGenerating, error } = useAIGenerate();
 * 
 * const result = await generate({
 *   tone: 'luis',
 *   prospectName: 'Casey',
 *   companyName: 'FreightRoll',
 * });
 * 
 * if (result.success) {
 *   setSubject(result.subject);
 *   setBody(result.content);
 * }
 */
export function useAIGenerate(): UseAIGenerateReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (params: GenerateParams): Promise<GenerateResult> => {
    setIsGenerating(true);
    setError(null);

    try {
      // Get Firebase token for auth
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        const err = 'Please sign in to use AI generation';
        setError(err);
        return { success: false, error: err };
      }

      const token = await user.getIdToken();

      // Call server-side proxy (never call Railway directly from browser)
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errMsg = data.error || `Generation failed (${response.status})`;
        setError(errMsg);
        return { success: false, error: errMsg };
      }

      return {
        success: true,
        content: data.content,
        subject: data.subject,
      };

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to generate content';
      setError(errMsg);
      return { success: false, error: errMsg };
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    generate,
    isGenerating,
    error,
    clearError,
  };
}

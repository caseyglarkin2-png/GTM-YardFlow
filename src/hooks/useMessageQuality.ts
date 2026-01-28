/**
 * useMessageQuality Hook - YardFlow Hub
 * 
 * React hook for real-time message quality analysis.
 * Provides debounced analysis as user types.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Channel, Persona, MessageAnalysisOutput, QualityScore } from '../types/messageQuality';
import { analyzeMessage, quickValidate, CHANNEL_LIMITS } from '../services/MessageQualityService';

// ============================================
// Types
// ============================================

interface UseMessageQualityOptions {
  /** Debounce delay in milliseconds (default: 300ms) */
  debounceMs?: number;
  /** Skip analysis for messages under this length */
  minLength?: number;
  /** Enable real-time analysis (default: true) */
  enabled?: boolean;
}

interface UseMessageQualityReturn {
  /** Full analysis result */
  analysis: MessageAnalysisOutput | null;
  /** Just the quality score */
  score: QualityScore | null;
  /** Is analysis currently running */
  isAnalyzing: boolean;
  /** Quick validation errors */
  validationErrors: string[];
  /** Is message valid for sending */
  isValid: boolean;
  /** Character count */
  charCount: number;
  /** Word count */
  wordCount: number;
  /** Characters remaining before limit */
  charsRemaining: number;
  /** Percentage of character limit used */
  charPercentage: number;
  /** Trigger manual analysis */
  analyze: () => void;
  /** Reset analysis state */
  reset: () => void;
}

// ============================================
// Hook Implementation
// ============================================

export function useMessageQuality(
  message: string,
  channel: Channel,
  options: UseMessageQualityOptions & {
    persona?: Persona;
    companyName?: string;
    prospectName?: string;
  } = {}
): UseMessageQualityReturn {
  const {
    debounceMs = 300,
    minLength = 10,
    enabled = true,
    persona,
    companyName,
    prospectName,
  } = options;

  // State
  const [analysis, setAnalysis] = useState<MessageAnalysisOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized limits
  const limits = useMemo(() => CHANNEL_LIMITS[channel], [channel]);

  // Quick metrics (no debounce needed)
  const quickMetrics = useMemo(() => {
    const trimmed = message.trim();
    const charCount = trimmed.length;
    const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
    const charsRemaining = limits.maxChars - charCount;
    const charPercentage = Math.min(100, (charCount / limits.maxChars) * 100);
    
    return { charCount, wordCount, charsRemaining, charPercentage };
  }, [message, limits.maxChars]);

  // Quick validation (no debounce)
  const quickValidation = useMemo(() => {
    if (!enabled || message.trim().length < minLength) {
      return { valid: true, errors: [] };
    }
    return quickValidate(message, channel);
  }, [message, channel, enabled, minLength]);

  // Debounced full analysis
  const runAnalysis = useCallback(() => {
    if (!enabled || message.trim().length < minLength) {
      setAnalysis(null);
      return;
    }

    setIsAnalyzing(true);
    
    // Run analysis (synchronous but we wrap for future async support)
    try {
      const result = analyzeMessage({
        message,
        channel,
        persona,
        companyName,
        prospectName,
      });
      setAnalysis(result);
    } catch (error) {
      console.error('Message analysis failed:', error);
      setAnalysis(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [message, channel, persona, companyName, prospectName, enabled, minLength]);

  // Debounced effect
  useEffect(() => {
    if (!enabled) {
      setAnalysis(null);
      return;
    }

    if (message.trim().length < minLength) {
      setAnalysis(null);
      return;
    }

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new timeout
    setIsAnalyzing(true);
    debounceRef.current = setTimeout(() => {
      runAnalysis();
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [message, channel, persona, enabled, debounceMs, minLength, runAnalysis]);

  // Reset function
  const reset = useCallback(() => {
    setAnalysis(null);
    setIsAnalyzing(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, []);

  // Manual analysis trigger
  const analyze = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    runAnalysis();
  }, [runAnalysis]);

  return {
    analysis,
    score: analysis?.score ?? null,
    isAnalyzing,
    validationErrors: quickValidation.errors,
    isValid: quickValidation.valid,
    charCount: quickMetrics.charCount,
    wordCount: quickMetrics.wordCount,
    charsRemaining: quickMetrics.charsRemaining,
    charPercentage: quickMetrics.charPercentage,
    analyze,
    reset,
  };
}

// ============================================
// Utility Hooks
// ============================================

/**
 * Hook for just character/word counting (lightweight)
 */
export function useMessageMetrics(message: string, channel: Channel) {
  const limits = CHANNEL_LIMITS[channel];
  
  return useMemo(() => {
    const trimmed = message.trim();
    const charCount = trimmed.length;
    const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
    
    return {
      charCount,
      wordCount,
      charsRemaining: limits.maxChars - charCount,
      wordsRemaining: limits.maxWords - wordCount,
      charPercentage: Math.min(100, (charCount / limits.maxChars) * 100),
      wordPercentage: Math.min(100, (wordCount / limits.maxWords) * 100),
      isOverCharLimit: charCount > limits.maxChars,
      isOverWordLimit: wordCount > limits.maxWords,
      isOverIdealChars: charCount > limits.idealChars,
      isOverIdealWords: wordCount > limits.idealWords,
    };
  }, [message, limits]);
}

/**
 * Hook for grade color styling
 */
export function useGradeColor(grade: 'A' | 'B' | 'C' | 'D' | 'F' | null): string {
  return useMemo(() => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-50 border-green-200';
      case 'B': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'C': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'D': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'F': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-slate-400 bg-slate-50 border-slate-200';
    }
  }, [grade]);
}

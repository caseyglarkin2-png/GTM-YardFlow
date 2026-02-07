/**
 * Spam Score Types
 * 
 * Re-exports from SpamScoreService for cleaner imports.
 * Sprint 39C: Spam Score UI Integration
 */

import type { SpamScoreResult as _SpamScoreResult } from '@/services/SpamScoreService';

export type {
  SpamScoreResult,
  SpamIssue,
  SpamAnalysis,
} from '@/services/SpamScoreService';

// Derived types for UI components
export type SpamRiskLevel = _SpamScoreResult['level'];

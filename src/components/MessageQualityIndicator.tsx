/**
 * Message Quality Indicator Component - YardFlow Hub
 * 
 * Visual indicator showing real-time message quality:
 * - Grade badge (A-F)
 * - Character/word count
 * - Quality breakdown
 * - Issue list with suggestions
 */

import { useState, useMemo } from 'react';
import { 
  AlertCircle, CheckCircle, Info, XCircle,
  ChevronDown, ChevronUp, Zap, Target, Shield, BookOpen
} from 'lucide-react';
import type { QualityScore, QualityIssue, Channel, Persona } from '../types/messageQuality';
import { useMessageQuality, useGradeColor } from '../hooks/useMessageQuality';

// ============================================
// Types
// ============================================

interface MessageQualityIndicatorProps {
  message: string;
  channel: Channel;
  persona?: Persona;
  companyName?: string;
  prospectName?: string;
  compact?: boolean;
  showBreakdown?: boolean;
}

// ============================================
// Main Component
// ============================================

export function MessageQualityIndicator({
  message,
  channel,
  persona,
  companyName,
  prospectName,
  compact = false,
  showBreakdown = true,
}: MessageQualityIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const {
    score,
    isAnalyzing,
    charCount,
    wordCount,
    charsRemaining,
    charPercentage,
  } = useMessageQuality(message, channel, {
    persona,
    companyName,
    prospectName,
    debounceMs: 300,
    minLength: 10,
  });

  const gradeColor = useGradeColor(score?.grade ?? null);

  // Determine character count color
  const charCountColor = useMemo(() => {
    if (charPercentage >= 100) return 'text-red-600';
    if (charPercentage >= 85) return 'text-orange-500';
    if (charPercentage >= 70) return 'text-yellow-600';
    return 'text-slate-500';
  }, [charPercentage]);

  if (message.trim().length < 10) {
    return (
      <div className="text-xs text-slate-400 py-1">
        Start typing to see quality score...
      </div>
    );
  }

  if (compact) {
    return (
      <CompactIndicator
        score={score}
        charCount={charCount}
        charsRemaining={charsRemaining}
        charPercentage={charPercentage}
        charCountColor={charCountColor}
        gradeColor={gradeColor}
        isAnalyzing={isAnalyzing}
      />
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Grade Badge */}
          <div className={`px-2 py-0.5 rounded-md border font-bold text-sm ${gradeColor}`}>
            {isAnalyzing ? '...' : score?.grade ?? '-'}
          </div>
          
          {/* Score */}
          <div className="text-sm">
            <span className="font-medium text-slate-700">
              {isAnalyzing ? 'Analyzing...' : `${score?.overall ?? 0}%`}
            </span>
            <span className="text-slate-400 ml-1">quality</span>
          </div>
          
          {/* Pass/Fail indicator */}
          {score && (
            <div className={`flex items-center gap-1 text-xs ${
              score.passesMinimum ? 'text-green-600' : 'text-red-600'
            }`}>
              {score.passesMinimum ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {score.passesMinimum ? 'Ready' : 'Needs work'}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Character count */}
          <div className={`text-xs ${charCountColor}`}>
            {charCount} / {charsRemaining > 0 ? `${charsRemaining} left` : `${Math.abs(charsRemaining)} over`}
          </div>
          
          {/* Expand toggle */}
          {showBreakdown && (
            isExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )
          )}
        </div>
      </button>
      
      {/* Expanded content */}
      {isExpanded && showBreakdown && score && (
        <div className="border-t border-slate-100 px-3 py-3 space-y-3">
          {/* Score breakdown */}
          <div className="grid grid-cols-2 gap-2">
            <ScoreBar 
              label="Length" 
              score={score.breakdown.length} 
              icon={<Zap className="h-3 w-3" />}
            />
            <ScoreBar 
              label="Persona" 
              score={score.breakdown.persona} 
              icon={<Target className="h-3 w-3" />}
            />
            <ScoreBar 
              label="Compliance" 
              score={score.breakdown.compliance} 
              icon={<Shield className="h-3 w-3" />}
            />
            <ScoreBar 
              label="Readability" 
              score={score.breakdown.readability} 
              icon={<BookOpen className="h-3 w-3" />}
            />
          </div>
          
          {/* Issues list */}
          {score.issues.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Issues ({score.issues.length})
              </div>
              {score.issues.map((issue, i) => (
                <IssueItem key={i} issue={issue} />
              ))}
            </div>
          )}
          
          {/* No issues message */}
          {score.issues.length === 0 && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              No issues detected - message looks great!
            </div>
          )}
          
          {/* Word count */}
          <div className="flex justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
            <span>{wordCount} words</span>
            <span>~{Math.ceil(wordCount / 200 * 60)}s read time</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Compact Indicator
// ============================================

interface CompactIndicatorProps {
  score: QualityScore | null;
  charCount: number;
  charsRemaining: number;
  charPercentage: number;
  charCountColor: string;
  gradeColor: string;
  isAnalyzing: boolean;
}

function CompactIndicator({
  score,
  charCount,
  charsRemaining: _charsRemaining,
  charPercentage,
  charCountColor,
  gradeColor,
  isAnalyzing,
}: CompactIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Grade badge */}
      <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${gradeColor}`}>
        {isAnalyzing ? '...' : score?.grade ?? '-'}
      </span>
      
      {/* Character progress bar */}
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
        <div 
          className={`h-full transition-all ${
            charPercentage >= 100 ? 'bg-red-500' :
            charPercentage >= 85 ? 'bg-orange-500' :
            charPercentage >= 70 ? 'bg-yellow-500' :
            'bg-green-500'
          }`}
          style={{ width: `${Math.min(100, charPercentage)}%` }}
        />
      </div>
      
      {/* Character count */}
      <span className={`text-[10px] tabular-nums ${charCountColor}`}>
        {charCount}
      </span>
    </div>
  );
}

// ============================================
// Score Bar Component
// ============================================

interface ScoreBarProps {
  label: string;
  score: number;
  icon: React.ReactNode;
}

function ScoreBar({ label, score, icon }: ScoreBarProps) {
  const color = useMemo(() => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  }, [score]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-slate-600">
          {icon}
          {label}
        </div>
        <span className="font-medium text-slate-700">{score}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ============================================
// Issue Item Component
// ============================================

interface IssueItemProps {
  issue: QualityIssue;
}

function IssueItem({ issue }: IssueItemProps) {
  const icon = useMemo(() => {
    switch (issue.type) {
      case 'error':
        return <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />;
      case 'warning':
        return <AlertCircle className="h-3 w-3 text-orange-500 flex-shrink-0" />;
      case 'info':
        return <Info className="h-3 w-3 text-blue-500 flex-shrink-0" />;
      default:
        return <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />;
    }
  }, [issue.type]);

  return (
    <div className="flex items-start gap-2 text-xs">
      {icon}
      <div className="flex-1">
        <span className="text-slate-700">{issue.message}</span>
        {issue.suggestion && (
          <span className="text-slate-400 ml-1">— {issue.suggestion}</span>
        )}
      </div>
    </div>
  );
}

// ============================================
// Inline Character Counter
// ============================================

interface CharacterCounterProps {
  message: string;
  channel: Channel;
  showWords?: boolean;
}

export function CharacterCounter({ message, channel, showWords = false }: CharacterCounterProps) {
  const { charCount, wordCount, charsRemaining, charPercentage } = useMessageQuality(
    message, 
    channel, 
    { enabled: true, debounceMs: 0 }
  );

  const color = useMemo(() => {
    if (charPercentage >= 100) return 'text-red-600';
    if (charPercentage >= 85) return 'text-orange-500';
    if (charPercentage >= 70) return 'text-yellow-600';
    return 'text-slate-500';
  }, [charPercentage]);

  return (
    <span className={`text-xs tabular-nums ${color}`}>
      {charCount} chars
      {showWords && <span className="text-slate-300 mx-1">|</span>}
      {showWords && `${wordCount} words`}
      {charsRemaining < 50 && (
        <span className="ml-1">
          ({charsRemaining > 0 ? `${charsRemaining} left` : `${Math.abs(charsRemaining)} over`})
        </span>
      )}
    </span>
  );
}

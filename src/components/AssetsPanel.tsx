/**
 * Assets Panel Component - YardFlow Hub
 * 
 * Unified view of AI-generated assets:
 * - Mini-Brief (1-page ROI summary)
 * - DM Variants (3 persona-aware messages)
 * - Email Sequence (4-step campaign)
 */

import { useState, useCallback, useEffect } from 'react';
import { 
  Sparkles, FileText, MessageSquare, Mail, 
  Copy, RefreshCw, Check, AlertCircle, Loader2, Clock 
} from 'lucide-react';
import type { Prospect } from '../types';
import type { 
  GeneratedAssets, 
  MiniBrief, 
  DMVariant, 
  EmailSequence, 
  AssetContext 
} from '../types/assets';
import type { QuickWinOutput } from '../types/roi';
import { generateAssets, isUsingMockService } from '../services/GeminiService';
import { buildAssetPrompt, estimateTokenCount } from '../services/AssetPromptBuilder';
import { 
  getCached, 
  setCache, 
  generateCacheKey, 
  invalidateProspect,
  getCacheEntryInfo,
} from '../services/AssetCacheService';

// ============================================
// Types
// ============================================

interface AssetsPanelProps {
  selectedProspect: Prospect | null;
  roiOutput?: QuickWinOutput | null;
  onDMSelect?: (dm: string) => void;
}

type AssetTab = 'brief' | 'dms' | 'emails';

interface CopyState {
  [key: string]: boolean;
}

// ============================================
// Component
// ============================================

export function AssetsPanel({ selectedProspect, roiOutput, onDMSelect }: AssetsPanelProps) {
  const [activeTab, setActiveTab] = useState<AssetTab>('brief');
  const [assets, setAssets] = useState<GeneratedAssets | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<CopyState>({});
  const [cacheInfo, setCacheInfo] = useState<{ cachedAt: string } | null>(null);

  // Build context from prospect
  const buildContext = useCallback((): AssetContext | null => {
    if (!selectedProspect) return null;

    return {
      prospectId: selectedProspect.id,
      prospectName: selectedProspect.name,
      prospectTitle: selectedProspect.title,
      companyName: selectedProspect.company,
      tier: selectedProspect.tier,
      isOps: selectedProspect.isOps,
      isExec: selectedProspect.isExec,
      roiData: roiOutput ? {
        totalAnnualSavings: roiOutput.totalAnnual,
        paperSavings: roiOutput.paperSavingsAnnual,
        laborSavings: roiOutput.laborSavingsAnnual,
        detentionSavings: roiOutput.detentionSavingsAnnual,
      } : undefined,
      targetAssets: ['brief', 'dms', 'emails'],
    };
  }, [selectedProspect, roiOutput]);

  // Check cache on prospect change
  useEffect(() => {
    if (!selectedProspect) {
      setAssets(null);
      setCacheInfo(null);
      return;
    }

    const context = buildContext();
    if (!context) return;

    const prompt = buildAssetPrompt(context);
    const promptHash = String(estimateTokenCount(prompt));
    const cacheKey = generateCacheKey(context.prospectId, promptHash);
    
    const cached = getCached(cacheKey);
    if (cached) {
      setAssets(cached);
      const info = getCacheEntryInfo(cacheKey);
      if (info) {
        setCacheInfo({ cachedAt: info.cachedAt });
      }
    } else {
      setAssets(null);
      setCacheInfo(null);
    }
  }, [selectedProspect, buildContext]);

  // Generate assets
  const handleGenerate = useCallback(async (regenerate = false) => {
    const context = buildContext();
    if (!context) return;

    setIsLoading(true);
    setError(null);

    if (regenerate) {
      invalidateProspect(context.prospectId);
    }

    const prompt = buildAssetPrompt(context);
    const promptHash = String(estimateTokenCount(prompt));
    const cacheKey = generateCacheKey(context.prospectId, promptHash);

    // Check cache first (unless regenerating)
    if (!regenerate) {
      const cached = getCached(cacheKey);
      if (cached) {
        setAssets(cached);
        setIsLoading(false);
        const info = getCacheEntryInfo(cacheKey);
        if (info) {
          setCacheInfo({ cachedAt: info.cachedAt });
        }
        return;
      }
    }

    try {
      const result = await generateAssets(prompt, context);

      if (result.success && result.data) {
        setAssets(result.data);
        setCache(cacheKey, result.data, promptHash);
        setCacheInfo(null); // Fresh generation
      } else {
        setError(result.error?.message || 'Failed to generate assets');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [buildContext]);

  // Copy to clipboard
  const handleCopy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopyState(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  }, []);

  // Handle DM selection
  const handleDMClick = useCallback((dm: DMVariant) => {
    if (onDMSelect) {
      onDMSelect(dm.content);
    }
  }, [onDMSelect]);

  if (!selectedProspect) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <p>Select a prospect to generate assets</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">AI Assets</h2>
          {isUsingMockService() && (
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
              Mock Mode
            </span>
          )}
        </div>

        {/* Cache indicator */}
        {cacheInfo && (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            Cached {new Date(cacheInfo.cachedAt).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <TabButton 
          active={activeTab === 'brief'} 
          onClick={() => setActiveTab('brief')}
          icon={<FileText className="w-4 h-4" />}
          label="Brief"
        />
        <TabButton 
          active={activeTab === 'dms'} 
          onClick={() => setActiveTab('dms')}
          icon={<MessageSquare className="w-4 h-4" />}
          label="DMs"
        />
        <TabButton 
          active={activeTab === 'emails'} 
          onClick={() => setActiveTab('emails')}
          icon={<Mail className="w-4 h-4" />}
          label="Emails"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={() => handleGenerate()} />
        ) : !assets ? (
          <EmptyState onGenerate={() => handleGenerate()} />
        ) : (
          <>
            {activeTab === 'brief' && assets.miniBrief && (
              <MiniBriefView 
                brief={assets.miniBrief} 
                onCopy={handleCopy}
                copyState={copyState}
              />
            )}
            {activeTab === 'dms' && assets.dmVariants && (
              <DMVariantsView 
                variants={assets.dmVariants}
                onCopy={handleCopy}
                onSelect={handleDMClick}
                copyState={copyState}
              />
            )}
            {activeTab === 'emails' && assets.emailSequence && (
              <EmailSequenceView 
                sequence={assets.emailSequence}
                onCopy={handleCopy}
                copyState={copyState}
              />
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-t border-slate-700">
        {assets && (
          <button
            onClick={() => handleGenerate(true)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            Regenerate
          </button>
        )}
        
        <div className="flex-1" />
        
        {!assets && (
          <button
            onClick={() => handleGenerate()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-purple-500 hover:bg-purple-600 rounded transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            Generate All
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'text-purple-400 border-b-2 border-purple-400 bg-slate-800/50'
          : 'text-slate-400 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-3/4 mb-2" />
          <div className="h-4 bg-slate-700 rounded w-1/2" />
        </div>
      ))}
      <div className="flex items-center gap-2 text-slate-400 mt-6">
        <Loader2 className="w-4 h-4 animate-spin" />
        Generating assets...
      </div>
    </div>
  );
}

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
      <p className="text-red-400 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

interface EmptyStateProps {
  onGenerate: () => void;
}

function EmptyState({ onGenerate }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <Sparkles className="w-12 h-12 text-slate-600 mb-4" />
      <p className="text-slate-400 mb-4">No assets generated yet</p>
      <button
        onClick={onGenerate}
        className="px-4 py-2 text-sm text-white bg-purple-500 hover:bg-purple-600 rounded transition-colors"
      >
        Generate Assets
      </button>
    </div>
  );
}

interface MiniBriefViewProps {
  brief: MiniBrief;
  onCopy: (text: string, key: string) => void;
  copyState: CopyState;
}

function MiniBriefView({ brief, onCopy, copyState }: MiniBriefViewProps) {
  const fullText = `${brief.hook}\n\nPain Points:\n${brief.painPoints.map(p => `• ${p}`).join('\n')}\n\nValue Props:\n${brief.valueProps.map(v => `• ${v}`).join('\n')}\n\n${brief.roiSnapshot}\n\n${brief.cta}`;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CopyButton 
          onClick={() => onCopy(fullText, 'brief')}
          copied={copyState['brief']}
        />
      </div>

      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <p className="text-white font-medium text-lg mb-4">{brief.hook}</p>
        
        <div className="mb-4">
          <h4 className="text-sm font-medium text-purple-400 mb-2">Pain Points</h4>
          <ul className="space-y-1">
            {brief.painPoints.map((point, i) => (
              <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                <span className="text-red-400">•</span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-4">
          <h4 className="text-sm font-medium text-purple-400 mb-2">Value Props</h4>
          <ul className="space-y-1">
            {brief.valueProps.map((prop, i) => (
              <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                <span className="text-emerald-400">•</span>
                {prop}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-slate-700/50 rounded p-3 mb-4">
          <p className="text-emerald-400 text-sm">{brief.roiSnapshot}</p>
        </div>

        <p className="text-white font-medium">{brief.cta}</p>
      </div>
    </div>
  );
}

interface DMVariantsViewProps {
  variants: DMVariant[];
  onCopy: (text: string, key: string) => void;
  onSelect: (dm: DMVariant) => void;
  copyState: CopyState;
}

function DMVariantsView({ variants, onCopy, onSelect, copyState }: DMVariantsViewProps) {
  const variantLabels: Record<DMVariant['type'], { label: string; color: string }> = {
    exec: { label: 'Executive', color: 'text-blue-400' },
    ops: { label: 'Operations', color: 'text-emerald-400' },
    challenger: { label: 'Challenger', color: 'text-orange-400' },
  };

  return (
    <div className="space-y-4">
      {variants.map((dm, i) => (
        <div 
          key={dm.id || i}
          className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors cursor-pointer"
          onClick={() => onSelect(dm)}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${variantLabels[dm.type]?.color || 'text-slate-400'}`}>
              {variantLabels[dm.type]?.label || dm.type}
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${dm.characterCount <= 250 ? 'text-slate-400' : 'text-red-400'}`}>
                {dm.characterCount}/250
              </span>
              <CopyButton 
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy(dm.content, `dm-${i}`);
                }}
                copied={copyState[`dm-${i}`]}
              />
            </div>
          </div>
          <p className="text-white text-sm">{dm.content}</p>
        </div>
      ))}
    </div>
  );
}

interface EmailSequenceViewProps {
  sequence: EmailSequence;
  onCopy: (text: string, key: string) => void;
  copyState: CopyState;
}

function EmailSequenceView({ sequence, onCopy, copyState }: EmailSequenceViewProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-slate-300">{sequence.name}</h3>
      
      {sequence.steps.map((step, i) => (
        <div 
          key={i}
          className="bg-slate-800 rounded-lg p-4 border border-slate-700"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                Email {step.position}
              </span>
              <span className="text-xs text-slate-500">
                Day {step.delayDays}
              </span>
            </div>
            <CopyButton 
              onClick={() => onCopy(`Subject: ${step.subject}\n\n${step.body}`, `email-${i}`)}
              copied={copyState[`email-${i}`]}
            />
          </div>
          
          <p className="text-white font-medium text-sm mb-2">
            Subject: {step.subject}
            <span className={`ml-2 text-xs ${step.subject.length <= 60 ? 'text-slate-400' : 'text-red-400'}`}>
              ({step.subject.length}/60)
            </span>
          </p>
          
          <p className="text-slate-300 text-sm whitespace-pre-wrap">{step.body}</p>
        </div>
      ))}
    </div>
  );
}

interface CopyButtonProps {
  onClick: (e: React.MouseEvent) => void;
  copied: boolean;
}

function CopyButton({ onClick, copied }: CopyButtonProps) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 text-slate-400 hover:text-white transition-colors"
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? (
        <Check className="w-4 h-4 text-emerald-400" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );
}

export default AssetsPanel;

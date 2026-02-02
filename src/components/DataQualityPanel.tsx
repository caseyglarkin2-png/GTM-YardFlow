/**
 * Data Quality Panel Component
 * 
 * Sprint 1004: Displays data quality metrics for prospect data
 * 
 * Features:
 * - Overall quality score with visual gauge
 * - Email breakdown (verified/inferred/missing)
 * - Field completeness overview
 * - Actionable recommendations
 */

import { useMemo } from 'react';
import { LazyIcon } from '@/components/icons';
import { getDataQualityService, type DataQualityReport } from '@/services/DataQualityService';
import type { Prospect } from '@/types';

interface DataQualityPanelProps {
  prospects: Prospect[];
  className?: string;
  compact?: boolean;
}

/**
 * Quality level to color mapping
 */
function getQualityColor(level: 'excellent' | 'good' | 'fair' | 'poor'): string {
  switch (level) {
    case 'excellent': return 'text-green-600 bg-green-50 border-green-200';
    case 'good': return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'fair': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'poor': return 'text-red-600 bg-red-50 border-red-200';
    default: return 'text-slate-600 bg-slate-50 border-slate-200';
  }
}

function getQualityLabel(level: 'excellent' | 'good' | 'fair' | 'poor'): string {
  switch (level) {
    case 'excellent': return 'Excellent';
    case 'good': return 'Good';
    case 'fair': return 'Fair';
    case 'poor': return 'Needs Work';
    default: return 'Unknown';
  }
}

/**
 * Circular progress indicator
 */
function QualityGauge({ score, size = 100 }: { score: number; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  
  const color = score >= 85 ? '#16a34a' : score >= 70 ? '#2563eb' : score >= 50 ? '#d97706' : '#dc2626';
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={10}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-slate-800">{score}</span>
      </div>
    </div>
  );
}

/**
 * Email breakdown bar chart
 */
function EmailBreakdown({ breakdown }: { breakdown: DataQualityReport['emailBreakdown'] }) {
  const total = breakdown.verified + breakdown.inferred + breakdown.missing;
  
  const verifiedPct = total > 0 ? (breakdown.verified / total) * 100 : 0;
  const inferredPct = total > 0 ? (breakdown.inferred / total) * 100 : 0;
  const missingPct = total > 0 ? (breakdown.missing / total) * 100 : 0;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-slate-600">Email Coverage</span>
        <span className="font-medium text-slate-800">
          {breakdown.contactable.toLocaleString()} / {total.toLocaleString()} ({breakdown.contactablePercentage}%)
        </span>
      </div>
      
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
        <div 
          className="bg-green-500 transition-all duration-300"
          style={{ width: `${verifiedPct}%` }}
          title={`Verified: ${breakdown.verified}`}
        />
        <div 
          className="bg-blue-400 transition-all duration-300"
          style={{ width: `${inferredPct}%` }}
          title={`Inferred: ${breakdown.inferred}`}
        />
        <div 
          className="bg-slate-300 transition-all duration-300"
          style={{ width: `${missingPct}%` }}
          title={`Missing: ${breakdown.missing}`}
        />
      </div>
      
      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-slate-600">Verified ({breakdown.verified})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-slate-600">Inferred ({breakdown.inferred})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-slate-300" />
          <span className="text-slate-600">Missing ({breakdown.missing})</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Field completeness bars
 */
function FieldCompleteness({ fields }: { fields: DataQualityReport['fieldCompleteness'] }) {
  const priorityFields = ['email', 'name', 'company', 'title', 'linkedinUrl'];
  const sortedFields = fields
    .filter(f => priorityFields.includes(f.field))
    .sort((a, b) => priorityFields.indexOf(a.field) - priorityFields.indexOf(b.field));
  
  return (
    <div className="space-y-2">
      {sortedFields.map(field => (
        <div key={field.field} className="flex items-center gap-2">
          <span className="text-xs text-slate-600 w-20 capitalize">{field.field}</span>
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${
                field.percentage >= 80 ? 'bg-green-500' :
                field.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${field.percentage}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-700 w-10 text-right">
            {field.percentage}%
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Main Data Quality Panel component
 */
export function DataQualityPanel({ prospects, className = '', compact = false }: DataQualityPanelProps) {
  const report = useMemo(() => {
    if (prospects.length === 0) return null;
    const service = getDataQualityService();
    return service.generateReport(prospects);
  }, [prospects]);
  
  if (!report) {
    return (
      <div className={`bg-white rounded-lg border border-slate-200 p-6 ${className}`}>
        <div className="text-center text-slate-400">
          <LazyIcon name="Database" className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">No data to analyze</p>
        </div>
      </div>
    );
  }
  
  if (compact) {
    // Compact version for sidebar or small spaces
    return (
      <div className={`bg-white rounded-lg border border-slate-200 p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <QualityGauge score={report.qualityScore.overall} size={60} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded border ${getQualityColor(report.qualityScore.level)}`}>
                {getQualityLabel(report.qualityScore.level)}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {report.emailBreakdown.contactable.toLocaleString()} contactable prospects
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`bg-white rounded-lg border border-slate-200 ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LazyIcon name="BarChart3" className="w-5 h-5 text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-800">Data Quality</h3>
          </div>
          <span className={`text-sm font-medium px-3 py-1 rounded-full border ${getQualityColor(report.qualityScore.level)}`}>
            {getQualityLabel(report.qualityScore.level)}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Quality Score Section */}
        <div className="flex items-center gap-6">
          <QualityGauge score={report.qualityScore.overall} size={100} />
          <div className="flex-1 space-y-2">
            <div className="text-sm text-slate-600">Quality Score Breakdown</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Completeness</span>
                <span className="font-medium">{report.qualityScore.breakdown.completeness}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email Quality</span>
                <span className="font-medium">{report.qualityScore.breakdown.emailQuality}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duplicate Risk</span>
                <span className="font-medium">{report.qualityScore.breakdown.duplicateRisk}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Data Freshness</span>
                <span className="font-medium">{report.qualityScore.breakdown.dataFreshness}%</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Email Breakdown */}
        <div>
          <EmailBreakdown breakdown={report.emailBreakdown} />
        </div>
        
        {/* Field Completeness */}
        <div>
          <div className="text-sm font-medium text-slate-700 mb-2">Field Completeness</div>
          <FieldCompleteness fields={report.fieldCompleteness} />
        </div>
        
        {/* Tier Distribution */}
        <div>
          <div className="text-sm font-medium text-slate-700 mb-2">Tier Distribution</div>
          <div className="flex gap-2">
            {Object.entries(report.tierDistribution)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([tier, count]) => (
                <div 
                  key={tier}
                  className={`flex-1 text-center p-2 rounded-lg ${
                    tier === 'Tier 1' ? 'bg-green-50 text-green-700' :
                    tier === 'Tier 2' ? 'bg-blue-50 text-blue-700' :
                    tier === 'Tier 3' ? 'bg-amber-50 text-amber-700' :
                    'bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="text-lg font-bold">{count.toLocaleString()}</div>
                  <div className="text-xs">{tier}</div>
                </div>
              ))}
          </div>
        </div>
        
        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">Recommendations</div>
            <ul className="space-y-1">
              {report.recommendations.slice(0, 3).map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                  <LazyIcon name="Lightbulb" className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 rounded-b-lg">
        <div className="flex justify-between text-xs text-slate-500">
          <span>{report.totalProspects.toLocaleString()} prospects analyzed</span>
          <span>Updated {report.generatedAt.toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}

export default DataQualityPanel;

/**
 * EmailHealthStatus Component
 * 
 * Sprint 101: T101.3 - Email Health Indicator
 * 
 * Shows at a glance:
 * - Which email backend is active (Railway vs Vercel)
 * - Current health status
 * - Quick diagnostic info if unhealthy
 */

import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Loader, 
  Server, 
  Cloud,
  RefreshCw 
} from 'lucide-react';
import { useEmailHealth, type EmailHealthStatus as HealthStatus } from '@/hooks/useEmailHealth';

// =============================================================================
// Status Badge Component
// =============================================================================

interface StatusBadgeProps {
  status: HealthStatus;
  backend: 'railway' | 'vercel';
}

function StatusBadge({ status, backend }: StatusBadgeProps) {
  const statusConfig = {
    healthy: {
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      label: 'Healthy',
    },
    degraded: {
      icon: AlertCircle,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      label: 'Degraded',
    },
    unhealthy: {
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      label: 'Unhealthy',
    },
    checking: {
      icon: Loader,
      color: 'text-slate-500',
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      label: 'Checking...',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;
  const BackendIcon = backend === 'railway' ? Server : Cloud;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg} ${config.border}`}>
      <BackendIcon className="w-4 h-4 text-slate-500" />
      <span className="text-sm font-medium text-slate-700 capitalize">{backend}</span>
      <span className="text-slate-300">•</span>
      <Icon className={`w-4 h-4 ${config.color} ${status === 'checking' ? 'animate-spin' : ''}`} />
      <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

interface EmailHealthStatusProps {
  /** Show detailed diagnostic info */
  showDetails?: boolean;
  /** Compact mode for toolbar */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

export function EmailHealthStatus({ 
  showDetails = false, 
  compact = false,
  className = '' 
}: EmailHealthStatusProps) {
  const { data, isLoading, refresh } = useEmailHealth();

  if (compact) {
    // Compact mode: Just an icon + tooltip
    const statusColors = {
      healthy: 'text-green-500',
      degraded: 'text-yellow-500',
      unhealthy: 'text-red-500',
      checking: 'text-slate-400',
    };

    const StatusIcon = data.status === 'checking' ? Loader : 
                       data.status === 'healthy' ? CheckCircle :
                       data.status === 'degraded' ? AlertCircle : XCircle;

    return (
      <div className={`relative group ${className}`} title={data.message}>
        <StatusIcon 
          className={`w-5 h-5 ${statusColors[data.status]} ${data.status === 'checking' ? 'animate-spin' : ''}`}
        />
        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          <div className="font-medium">{data.backend === 'railway' ? 'Railway' : 'Vercel SendGrid'}</div>
          <div>{data.message}</div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">Email Service</h3>
        <button
          onClick={() => refresh()}
          disabled={isLoading}
          className="p-1 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
          title="Refresh health check"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status Badge */}
      <StatusBadge status={data.status} backend={data.backend} />

      {/* Message */}
      <p className="text-sm text-slate-600">{data.message}</p>

      {/* Error Details */}
      {data.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{data.error}</p>
        </div>
      )}

      {/* Detailed Checks (when showDetails is true) */}
      {showDetails && data.checks && (
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Configuration Checks
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data.checks).map(([key, value]) => (
              <div 
                key={key}
                className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                  value ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {value ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                <span className="truncate">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Check Time */}
      {data.lastCheck && (
        <p className="text-xs text-slate-400">
          Last checked: {data.lastCheck.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

export default EmailHealthStatus;

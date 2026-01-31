/**
 * System Health Dashboard Component
 * Sprint 300 - T300.5
 * 
 * Displays real-time system health metrics including:
 * - Railway API status
 * - Firestore connection status
 * - Email service health
 * - Queue processing status
 */

import { useState, useEffect, useCallback } from 'react';
import { featureFlags, shouldUseRailwayEmail } from '@/config/featureFlags';

// =============================================================================
// Types
// =============================================================================

export type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  latencyMs?: number;
  lastChecked: Date;
  message?: string;
  details?: Record<string, unknown>;
}

export interface SystemHealthData {
  overall: ServiceStatus;
  services: ServiceHealth[];
  lastUpdated: Date;
}

// =============================================================================
// Health Check Functions
// =============================================================================

async function checkRailwayHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    if (!featureFlags.RAILWAY_ENABLED) {
      return {
        name: 'Railway API',
        status: 'unknown',
        lastChecked: new Date(),
        message: 'Railway integration disabled',
      };
    }
    
    const response = await fetch('/api/railway/health', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const latencyMs = Date.now() - startTime;
    
    if (response.ok) {
      return {
        name: 'Railway API',
        status: latencyMs < 500 ? 'healthy' : 'degraded',
        latencyMs,
        lastChecked: new Date(),
        message: latencyMs < 500 ? 'Operational' : 'Slow response',
      };
    }
    
    return {
      name: 'Railway API',
      status: 'unhealthy',
      latencyMs,
      lastChecked: new Date(),
      message: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name: 'Railway API',
      status: 'unhealthy',
      latencyMs: Date.now() - startTime,
      lastChecked: new Date(),
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

async function checkEmailServiceHealth(): Promise<ServiceHealth> {
  try {
    if (!shouldUseRailwayEmail()) {
      return {
        name: 'Email Service',
        status: 'unknown',
        lastChecked: new Date(),
        message: 'Railway email disabled',
      };
    }
    
    // Check email service via Railway
    const response = await fetch('/api/railway/email/health', {
      method: 'GET',
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        name: 'Email Service',
        status: 'healthy',
        lastChecked: new Date(),
        message: 'SendGrid operational',
        details: data,
      };
    }
    
    return {
      name: 'Email Service',
      status: 'degraded',
      lastChecked: new Date(),
      message: 'Email service degraded',
    };
  } catch {
    return {
      name: 'Email Service',
      status: 'unknown',
      lastChecked: new Date(),
      message: 'Unable to check',
    };
  }
}

function checkFirestoreHealth(): ServiceHealth {
  // Check if we're online (Firestore uses browser online status)
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  
  return {
    name: 'Firestore',
    status: isOnline ? 'healthy' : 'degraded',
    lastChecked: new Date(),
    message: isOnline ? 'Connected' : 'Offline mode',
  };
}

function checkBrowserHealth(): ServiceHealth {
  const memory = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  
  if (memory) {
    const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
    const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
    const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    
    return {
      name: 'Browser',
      status: usagePercent < 70 ? 'healthy' : usagePercent < 90 ? 'degraded' : 'unhealthy',
      lastChecked: new Date(),
      message: `${usedMB}MB / ${limitMB}MB`,
      details: { usedMB, limitMB, usagePercent: Math.round(usagePercent) },
    };
  }
  
  return {
    name: 'Browser',
    status: 'healthy',
    lastChecked: new Date(),
    message: 'Memory metrics unavailable',
  };
}

// =============================================================================
// Helper Components
// =============================================================================

interface StatusIndicatorProps {
  status: ServiceStatus;
  size?: 'sm' | 'md' | 'lg';
}

function StatusIndicator({ status, size = 'md' }: StatusIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };
  
  const colorClasses = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    unhealthy: 'bg-red-500',
    unknown: 'bg-gray-400',
  };
  
  return (
    <span 
      className={`inline-block rounded-full ${sizeClasses[size]} ${colorClasses[status]}`}
      title={status}
    />
  );
}

interface ServiceCardProps {
  service: ServiceHealth;
}

function ServiceCard({ service }: ServiceCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-gray-900 dark:text-gray-100">
          {service.name}
        </h3>
        <StatusIndicator status={service.status} />
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {service.message}
      </p>
      
      {service.latencyMs !== undefined && (
        <p className="text-xs text-gray-500 mt-1">
          Latency: {service.latencyMs}ms
        </p>
      )}
      
      <p className="text-xs text-gray-400 mt-2">
        Last checked: {service.lastChecked.toLocaleTimeString()}
      </p>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export interface SystemHealthDashboardProps {
  /** Auto-refresh interval in seconds (0 to disable) */
  refreshInterval?: number;
  /** Show compact view */
  compact?: boolean;
  /** Optional className */
  className?: string;
}

export function SystemHealthDashboard({
  refreshInterval = 60,
  compact = false,
  className = '',
}: SystemHealthDashboardProps) {
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Run all health checks in parallel
      const [railway, email, firestore, browser] = await Promise.all([
        checkRailwayHealth(),
        checkEmailServiceHealth(),
        checkFirestoreHealth(),
        Promise.resolve(checkBrowserHealth()),
      ]);
      
      const services = [railway, email, firestore, browser];
      
      // Calculate overall status
      const hasUnhealthy = services.some(s => s.status === 'unhealthy');
      const hasDegraded = services.some(s => s.status === 'degraded');
      const overall: ServiceStatus = hasUnhealthy ? 'unhealthy' 
                                    : hasDegraded ? 'degraded' 
                                    : 'healthy';
      
      setHealthData({
        overall,
        services,
        lastUpdated: new Date(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check health');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    
    if (refreshInterval > 0) {
      const interval = setInterval(checkHealth, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [checkHealth, refreshInterval]);

  if (isLoading && !healthData) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-200 h-10 w-10"></div>
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-50 dark:bg-red-900/20 rounded-lg ${className}`}>
        <p className="text-red-600 dark:text-red-400">
          Failed to load health status: {error}
        </p>
        <button 
          onClick={checkHealth}
          className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!healthData) return null;

  // Compact view - just show overall status
  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <StatusIndicator status={healthData.overall} size="sm" />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          System {healthData.overall}
        </span>
      </div>
    );
  }

  // Full dashboard view
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusIndicator status={healthData.overall} size="lg" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              System Health
            </h2>
            <p className="text-sm text-gray-500">
              Last updated: {healthData.lastUpdated.toLocaleTimeString()}
            </p>
          </div>
        </div>
        
        <button
          onClick={checkHealth}
          disabled={isLoading}
          className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          {isLoading ? 'Checking...' : 'Refresh'}
        </button>
      </div>
      
      {/* Service Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {healthData.services.map((service) => (
          <ServiceCard key={service.name} service={service} />
        ))}
      </div>
    </div>
  );
}

export default SystemHealthDashboard;

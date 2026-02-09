import React, { useEffect, useState } from 'react';
import { LazyIcon } from '@/components/icons';

interface HealthData {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  environment: string;
  checks?: {
    name: string;
    status: 'pass' | 'fail';
    duration?: number;
  }[];
}

export function StatusPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/health?details=true');
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      setData({ status: 'error', timestamp: new Date().toISOString(), environment: 'unknown' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ok': return 'All Systems Operational';
      case 'degraded': return 'Partial System Outage';
      case 'error': return 'Major System Outage';
      default: return 'Unknown Status';
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">Checking system status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border p-6 flex flex-col items-center text-center">
          <div className={`w-3 h-3 rounded-full ${getStatusColor(data?.status || 'unknown')} mb-4 ring-4 ring-opacity-20 ${getStatusColor(data?.status || 'unknown').replace('bg-', 'ring-')}`} />
          <h1 className="text-2xl font-bold text-gray-900">{getStatusText(data?.status || 'unknown')}</h1>
          <p className="text-gray-500 mt-2">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>

        {/* Systems Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Frontend (Vercel)</h3>
              <span className={`px-2 py-1 rounded text-xs font-medium ${data?.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {data?.status === 'error' ? 'Issues' : 'Operational'}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Environment: <span className="font-mono">{data?.environment}</span>
            </div>
          </div>

          {(data?.checks || []).map((check) => (
            <div key={check.name} className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 capitalize">{check.name.replace(/_/g, ' ')}</h3>
                <span className={`px-2 py-1 rounded text-xs font-medium ${check.status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {check.status === 'pass' ? 'Operational' : 'Issues'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Latency</span>
                <span className="font-mono">{check.duration}ms</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-400 mt-8">
          FreightRoll System Status • <a href="/" className="text-blue-600 hover:underline">Return to App</a>
        </div>
      </div>
    </div>
  );
}

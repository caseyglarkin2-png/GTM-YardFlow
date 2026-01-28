/**
 * PWAUpdateNotification - YardFlow Hub
 * 
 * Update notification banner when new version is available.
 */

import React from 'react';
import { usePWA } from '../hooks/usePWA';

interface PWAUpdateNotificationProps {
  className?: string;
}

export function PWAUpdateNotification({ className = '' }: PWAUpdateNotificationProps): React.ReactElement | null {
  const { hasUpdate, applyUpdate } = usePWA();
  const [applying, setApplying] = React.useState(false);

  if (!hasUpdate) {
    return null;
  }

  const handleUpdate = async () => {
    setApplying(true);
    try {
      await applyUpdate();
    } catch {
      setApplying(false);
    }
  };

  return (
    <div
      className={`fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-green-600 text-white rounded-lg shadow-lg p-4 z-50 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-2xl">🔄</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Update Available</h3>
          <p className="text-xs text-green-100 mt-1">
            A new version of YardFlow is ready. Refresh to get the latest features.
          </p>
        </div>
      </div>
      <div className="mt-3">
        <button
          onClick={handleUpdate}
          disabled={applying}
          className="w-full bg-white text-green-600 font-medium text-sm py-2 px-4 rounded hover:bg-green-50 transition-colors disabled:opacity-50"
        >
          {applying ? 'Updating...' : 'Refresh Now'}
        </button>
      </div>
    </div>
  );
}

export default PWAUpdateNotification;

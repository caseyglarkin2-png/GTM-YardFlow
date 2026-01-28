/**
 * PWAInstallPrompt - YardFlow Hub
 * 
 * Install prompt banner for PWA installation.
 */

import React from 'react';
import { usePWA } from '../hooks/usePWA';

interface PWAInstallPromptProps {
  className?: string;
}

export function PWAInstallPrompt({ className = '' }: PWAInstallPromptProps): React.ReactElement | null {
  const { canInstall, promptInstall, isStandalone } = usePWA();
  const [dismissed, setDismissed] = React.useState(false);

  // Don't show if already standalone, can't install, or dismissed
  if (isStandalone || !canInstall || dismissed) {
    return null;
  }

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (!installed) {
      // User dismissed, hide for this session
      setDismissed(true);
    }
  };

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-blue-600 text-white rounded-lg shadow-lg p-4 z-50 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-2xl">📱</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Install YardFlow</h3>
          <p className="text-xs text-blue-100 mt-1">
            Install this app on your device for quick access and offline use.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-blue-200 hover:text-white"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleInstall}
          className="flex-1 bg-white text-blue-600 font-medium text-sm py-2 px-4 rounded hover:bg-blue-50 transition-colors"
        >
          Install App
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-blue-200 hover:text-white text-sm py-2 px-4"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

export default PWAInstallPrompt;

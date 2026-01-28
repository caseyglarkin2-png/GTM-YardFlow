/**
 * OfflineBanner - YardFlow Hub
 * 
 * Banner displayed when the app is offline.
 */

import React from 'react';
import { usePWA } from '../hooks/usePWA';

interface OfflineBannerProps {
  className?: string;
}

export function OfflineBanner({ className = '' }: OfflineBannerProps): React.ReactElement | null {
  const { isOnline } = usePWA();
  const [showBanner, setShowBanner] = React.useState(false);

  React.useEffect(() => {
    if (!isOnline) {
      setShowBanner(true);
    } else {
      // Delay hiding to show "back online" briefly
      const timer = setTimeout(() => setShowBanner(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!showBanner && isOnline) {
    return null;
  }

  if (isOnline && showBanner) {
    return (
      <div
        className={`fixed top-0 left-0 right-0 bg-green-500 text-white text-center py-2 text-sm z-50 ${className}`}
        role="status"
        data-testid="offline-banner-online"
      >
        ✓ Back online
      </div>
    );
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 bg-yellow-500 text-yellow-900 text-center py-2 text-sm z-50 ${className}`}
      role="alert"
      data-testid="offline-banner"
    >
      <span className="mr-2">📡</span>
      You're offline. Changes will sync when you reconnect.
    </div>
  );
}

export default OfflineBanner;

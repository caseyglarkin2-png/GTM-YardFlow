/**
 * Mock for virtual:pwa-register
 * 
 * Provides mock implementation of the PWA register functions
 * for testing PWAService without actual service worker.
 */

export function registerSW(options?: {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: Error) => void;
}): (reloadPage?: boolean) => Promise<void> {
  // Call callbacks if provided
  if (options?.onOfflineReady) {
    setTimeout(() => options.onOfflineReady?.(), 0);
  }
  
  // Return update function
  return async (reloadPage?: boolean) => {
    if (reloadPage) {
      // Would reload in real implementation
    }
  };
}

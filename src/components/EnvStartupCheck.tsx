/**
 * EnvStartupCheck - Displays helpful error if Firebase config is missing
 * Sprint 50 - T50.2
 * 
 * Shows a user-friendly error page instead of blank screen when
 * required environment variables are missing.
 */
import React from 'react';
import { hasFirebaseConfig } from '../lib/firebase';

interface Props {
  children: React.ReactNode;
}

export function EnvStartupCheck({ children }: Props): React.ReactElement {
  if (!hasFirebaseConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md" role="alert">
          <h1 className="text-xl font-bold text-red-600 mb-4">
            Configuration Error
          </h1>
          <p className="text-gray-600 mb-4">
            Firebase is not configured. Please check that the following 
            environment variables are set in your deployment:
          </p>
          <ul className="list-disc list-inside text-sm font-mono bg-gray-50 p-3 rounded mb-4">
            <li>VITE_FIREBASE_API_KEY</li>
            <li>VITE_FIREBASE_PROJECT_ID</li>
            <li>VITE_FIREBASE_AUTH_DOMAIN</li>
            <li>VITE_FIREBASE_APP_ID</li>
          </ul>
          <p className="text-xs text-gray-500">
            If you are the admin, add these in Vercel Project Settings → 
            Environment Variables. Remember to use the VITE_ prefix for 
            client-side variables.
          </p>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-400">
              Common mistake: Using FIREBASE_PROJECT_ID instead of VITE_FIREBASE_PROJECT_ID
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

export default EnvStartupCheck;

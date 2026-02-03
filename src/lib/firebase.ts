/**
 * Firebase Client Configuration
 * 
 * Singleton Firebase instance for client-side (browser) usage.
 * Server-side code should use lib/firebaseAdmin.ts instead.
 * 
 * Sprint 901: App.tsx Decomposition - T901.1
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Helper to sanitize env vars (handles trailing newlines from Vercel dashboard copy/paste)
const sanitize = (val: string | undefined): string => val?.trim() || '';

// Firebase configuration from environment
const firebaseConfig = {
  apiKey: sanitize(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: sanitize(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: sanitize(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: sanitize(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: sanitize(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: sanitize(import.meta.env.VITE_FIREBASE_APP_ID),
};

/**
 * Check if Firebase is properly configured
 */
export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

/**
 * Get or create Firebase app instance (singleton pattern)
 */
function getFirebaseApp(): FirebaseApp | null {
  if (!hasFirebaseConfig) {
    console.warn('[Firebase] Not configured - missing API key or project ID');
    return null;
  }
  
  // Prevent multiple initialization
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }
  
  return initializeApp(firebaseConfig);
}

// Initialize singleton instances
const app = getFirebaseApp();

/**
 * Firebase Auth instance
 * May be null if Firebase is not configured
 */
export const auth: Auth | null = app ? getAuth(app) : null;

/**
 * Firebase Firestore instance
 * May be null if Firebase is not configured
 */
export const db: Firestore | null = app ? getFirestore(app) : null;

/**
 * Firebase App instance
 * May be null if Firebase is not configured
 */
export { app };

/**
 * App ID for multi-tenant scenarios
 */
export const appId = import.meta.env.VITE_FIREBASE_APP_ID || 'default-app-id';

/**
 * Helper to ensure Firestore is available
 * @throws Error if Firestore is not configured
 */
export function requireFirestore(): Firestore {
  if (!db) {
    throw new Error('Firestore is not configured. Check VITE_FIREBASE_* environment variables.');
  }
  return db;
}

/**
 * Helper to ensure Auth is available
 * @throws Error if Auth is not configured
 */
export function requireAuth(): Auth {
  if (!auth) {
    throw new Error('Firebase Auth is not configured. Check VITE_FIREBASE_* environment variables.');
  }
  return auth;
}

import { applicationDefault, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Build Firebase Admin credentials.
 * Priority:
 * 1. FIREBASE_SERVICE_ACCOUNT_KEY - Full JSON service account
 * 2. FIREBASE_SERVICE_ACCOUNT - Alias for above
 * 3. Application Default Credentials (for Cloud Run, etc.)
 */
function buildCredentials() {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!key) {
    return applicationDefault();
  }

  try {
    const parsed = JSON.parse(key);
    return cert(parsed);
  } catch (err) {
    console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY, falling back to applicationDefault', err);
    return applicationDefault();
  }
}

/**
 * Get or initialize the Firebase Admin app.
 * Handles both production and emulator environments.
 */
function getAdminApp() {
  if (getApps().length) {
    return getApp();
  }
  
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  
  // Check if running with emulator
  const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
  
  if (isEmulator) {
    // For emulator, we can initialize without credentials
    console.log('[Firebase Admin] Connecting to Firestore Emulator at:', process.env.FIRESTORE_EMULATOR_HOST);
    return initializeApp({
      projectId: projectId || 'demo-yardflow',
    });
  }
  
  return initializeApp({
    credential: buildCredentials(),
    projectId,
  });
}

/**
 * Get Firestore Admin instance.
 * Automatically connects to emulator if FIRESTORE_EMULATOR_HOST is set.
 */
export function getAdminDb() {
  const app = getAdminApp();
  const db = getFirestore(app);
  
  // Configure Firestore settings if not already configured
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Settings already configured, ignore
  }
  
  return db;
}

/**
 * Get Firebase Auth Admin instance.
 * For local development, use the Auth Emulator (FIREBASE_AUTH_EMULATOR_HOST).
 */
export function getAdminAuth() {
  return getAuth(getAdminApp());
}

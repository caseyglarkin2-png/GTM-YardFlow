import { applicationDefault, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Build Firebase Admin credentials.
 * Priority:
 * 1. FIREBASE_SERVICE_ACCOUNT_KEY - Full JSON service account
 * 2. FIREBASE_SERVICE_ACCOUNT - Alias for above
 * 3. Application Default Credentials (for Cloud Run, etc.)
 * 
 * ⚠️ In Vercel, you MUST set FIREBASE_SERVICE_ACCOUNT_KEY
 *    applicationDefault() only works in Google Cloud environments
 */
function buildCredentials() {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (!key) {
    // Check if we're in a Google Cloud environment where ADC works
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT) {
      console.log('[Firebase Admin] Using Application Default Credentials');
      return applicationDefault();
    }
    
    // In Vercel or other non-GCP environments, we need explicit credentials
    console.error('[Firebase Admin] CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY not set!');
    console.error('[Firebase Admin] Set this env var in Vercel with your Firebase service account JSON');
    throw new Error(
      'Firebase Admin SDK requires FIREBASE_SERVICE_ACCOUNT_KEY environment variable. ' +
      'Get this from Firebase Console > Project Settings > Service Accounts > Generate new private key'
    );
  }

  try {
    const parsed = JSON.parse(key);
    return cert(parsed);
  } catch (err) {
    console.error('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY as JSON:', err);
    throw new Error(
      'Invalid FIREBASE_SERVICE_ACCOUNT_KEY: must be valid JSON. ' +
      'Paste the entire service account JSON file contents.'
    );
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

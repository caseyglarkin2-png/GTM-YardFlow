/**
 * T97.0: Auth Bridge Service
 * T206.3: Railway Session Exchange
 * T206.7: Session Refresh Middleware
 * T206.8: Railway Health Check
 * 
 * Provides graceful transition between Firebase and Railway authentication.
 * During migration, both systems work simultaneously with Railway as primary
 * and Firebase as fallback.
 */

import { railwayClient } from './RailwayApiClient';
import { featureFlags } from '../config/featureFlags';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  getAuth,
  type User as FirebaseUser 
} from 'firebase/auth';
import type { RailwayUser, RailwaySession } from '../types/railway';

// Firebase auth instance - lazy initialized
let firebaseAuth: ReturnType<typeof getAuth> | null = null;

function getFirebaseAuth() {
  if (!firebaseAuth) {
    try {
      firebaseAuth = getAuth();
    } catch {
      console.warn('Firebase Auth not initialized');
    }
  }
  return firebaseAuth;
}

// =============================================================================
// Constants
// =============================================================================

const RAILWAY_SESSION_KEY = 'railway_session';
const SESSION_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const RAILWAY_HEALTH_TIMEOUT_MS = 3000; // 3 seconds

// =============================================================================
// Types
// =============================================================================

export interface AuthResult {
  success: boolean;
  user?: RailwayUser | FirebaseUser;
  session?: RailwaySession;
  error?: string;
  source: 'railway' | 'firebase';
}

export interface AuthBridgeConfig {
  onRailwaySuccess?: (session: RailwaySession) => void;
  onFirebaseFallback?: (user: FirebaseUser) => void;
  onMigration?: (user: FirebaseUser, railwayUser: RailwayUser) => void;
}

export interface CachedSession {
  sessionToken: string;
  expiresAt: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

// =============================================================================
// Railway Session Management
// =============================================================================

/**
 * T206.8: Check if Railway is available before attempting auth bridge
 */
export async function isRailwayAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RAILWAY_HEALTH_TIMEOUT_MS);
    
    const response = await fetch('/api/railway/health', {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('[AuthBridge] Railway health check failed:', error);
    return false;
  }
}

/**
 * Get cached Railway session from sessionStorage
 */
export function getCachedSession(): CachedSession | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  
  try {
    const cached = sessionStorage.getItem(RAILWAY_SESSION_KEY);
    if (!cached) return null;
    return JSON.parse(cached) as CachedSession;
  } catch {
    return null;
  }
}

/**
 * Save Railway session to sessionStorage
 */
export function setCachedSession(session: CachedSession): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  
  try {
    sessionStorage.setItem(RAILWAY_SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn('[AuthBridge] Failed to cache session:', error);
  }
}

/**
 * Clear Railway session from sessionStorage
 */
export function clearCachedSession(): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  
  try {
    sessionStorage.removeItem(RAILWAY_SESSION_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Check if cached session is valid (not expired)
 */
export function isSessionValid(session: CachedSession): boolean {
  try {
    const expiresAt = new Date(session.expiresAt).getTime();
    return expiresAt > Date.now();
  } catch {
    return false;
  }
}

/**
 * Check if session is nearing expiry and needs refresh
 */
export function isSessionNearExpiry(session: CachedSession): boolean {
  try {
    const expiresAt = new Date(session.expiresAt).getTime();
    return expiresAt - Date.now() < SESSION_REFRESH_THRESHOLD_MS;
  } catch {
    return true;
  }
}

/**
 * T206.3: Exchange Firebase token for Railway session
 */
export async function exchangeFirebaseToken(firebaseToken: string): Promise<CachedSession | null> {
  try {
    const response = await fetch('/api/railway/auth/bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firebaseToken }),
    });
    
    if (!response.ok) {
      console.warn('[AuthBridge] Token exchange failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    return {
      sessionToken: data.sessionToken,
      expiresAt: data.expiresAt,
      user: data.user,
    };
  } catch (error) {
    console.error('[AuthBridge] Token exchange error:', error);
    return null;
  }
}

/**
 * T206.3: Get or create Railway session from Firebase auth
 */
export async function getOrCreateRailwaySession(): Promise<string | null> {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  
  if (!user) {
    console.log('[AuthBridge] No Firebase user, cannot get Railway session');
    return null;
  }
  
  // Check cached session
  const cached = getCachedSession();
  if (cached && isSessionValid(cached) && !isSessionNearExpiry(cached)) {
    return cached.sessionToken;
  }
  
  // T206.8: Check Railway health first
  if (!await isRailwayAvailable()) {
    console.log('[AuthBridge] Railway unavailable, skipping session exchange');
    return null;
  }
  
  // Get Firebase token
  let firebaseToken: string;
  try {
    firebaseToken = await user.getIdToken();
  } catch (error) {
    console.error('[AuthBridge] Failed to get Firebase token:', error);
    return null;
  }
  
  // Exchange for Railway session
  const session = await exchangeFirebaseToken(firebaseToken);
  
  if (!session) {
    return null;
  }
  
  // Cache session
  setCachedSession(session);
  console.log('[AuthBridge] Railway session obtained successfully');
  
  return session.sessionToken;
}

/**
 * T206.7: Ensure valid session with proactive refresh
 */
export async function ensureValidSession(): Promise<string | null> {
  const cached = getCachedSession();
  
  if (cached && isSessionValid(cached)) {
    // If more than 5 minutes remaining, use cached
    if (!isSessionNearExpiry(cached)) {
      return cached.sessionToken;
    }
    
    // Less than 5 minutes - refresh proactively
    console.log('[AuthBridge] Session expiring soon, refreshing...');
  }
  
  // Get fresh session
  return getOrCreateRailwaySession();
}

// =============================================================================
// Auth Bridge Class
// =============================================================================

export class AuthBridge {
  private config: AuthBridgeConfig;
  private migrationInProgress = new Set<string>();

  constructor(config: AuthBridgeConfig = {}) {
    this.config = config;
  }

  /**
   * Authenticate user with Railway first, falling back to Firebase
   */
  async authenticate(email: string, password: string): Promise<AuthResult> {
    // Try Railway first if enabled
    if (featureFlags.RAILWAY_AUTH_ENABLED) {
      const railwayAuth = await this.tryRailwayAuth(email, password);
      if (railwayAuth.success) {
        this.config.onRailwaySuccess?.(railwayAuth.session!);
        return railwayAuth;
      }
    }

    // Fallback to Firebase if enabled
    if (featureFlags.FIREBASE_AUTH_FALLBACK) {
      const firebaseAuth = await this.tryFirebaseAuth(email, password);
      if (firebaseAuth.success) {
        this.config.onFirebaseFallback?.(firebaseAuth.user as FirebaseUser);
        
        // Migrate user to Railway in background
        this.migrateToRailwayAsync(firebaseAuth.user as FirebaseUser, password);
        
        return firebaseAuth;
      }
    }

    return {
      success: false,
      error: 'Authentication failed. Please check your credentials.',
      source: 'railway',
    };
  }

  /**
   * Try Railway NextAuth login
   */
  private async tryRailwayAuth(email: string, password: string): Promise<AuthResult> {
    try {
      const result = await railwayClient.auth.login({ email, password });

      if (result.ok && result.data) {
        return {
          success: true,
          user: result.data.user,
          session: result.data,
          source: 'railway',
        };
      }

      return {
        success: false,
        error: result.error || 'Railway authentication failed',
        source: 'railway',
      };
    } catch (error) {
      console.warn('Railway auth error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Railway auth error',
        source: 'railway',
      };
    }
  }

  /**
   * Try Firebase Authentication
   */
  private async tryFirebaseAuth(email: string, password: string): Promise<AuthResult> {
    try {
      const auth = getFirebaseAuth();
      if (!auth) {
        return {
          success: false,
          error: 'Firebase Auth not available',
          source: 'firebase',
        };
      }
      
      const credential = await signInWithEmailAndPassword(auth, email, password);
      
      return {
        success: true,
        user: credential.user,
        source: 'firebase',
      };
    } catch (error) {
      console.warn('Firebase auth error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Firebase auth error',
        source: 'firebase',
      };
    }
  }

  /**
   * Migrate Firebase user to Railway in background
   */
  private async migrateToRailwayAsync(user: FirebaseUser, _password: string): Promise<void> {
    // Prevent duplicate migrations
    if (this.migrationInProgress.has(user.uid)) {
      return;
    }

    this.migrationInProgress.add(user.uid);

    try {
      // Use migrateFromFirebase instead of checkEmail/register
      const result = await railwayClient.auth.migrateFromFirebase({
        firebaseUid: user.uid,
        email: user.email!,
        displayName: user.displayName || undefined,
        emailVerified: user.emailVerified,
      });

      if (result.ok && result.data) {
        console.log(`Migrated Firebase user ${user.email} to Railway`);
        this.config.onMigration?.(user, result.data);
      } else {
        console.error('Failed to migrate user to Railway:', result.error);
      }
    } catch (error) {
      console.error('User migration error:', error);
    } finally {
      this.migrationInProgress.delete(user.uid);
    }
  }

  /**
   * Logout from both systems
   */
  async logout(): Promise<void> {
    const promises: Promise<void>[] = [];

    // Logout from Railway
    if (featureFlags.RAILWAY_AUTH_ENABLED) {
      promises.push(
        railwayClient.auth.logout().then(() => undefined).catch(err => {
          console.warn('Railway logout error:', err);
        })
      );
    }

    // Logout from Firebase
    if (featureFlags.FIREBASE_AUTH_FALLBACK) {
      const auth = getFirebaseAuth();
      if (auth) {
        promises.push(
          signOut(auth).catch(err => 
            console.warn('Firebase logout error:', err)
          )
        );
      }
    }

    // Clear cached Railway session
    clearCachedSession();

    await Promise.all(promises);
  }

  /**
   * Check if user is authenticated in either system
   */
  async checkAuth(): Promise<AuthResult | null> {
    // Check Railway first
    if (featureFlags.RAILWAY_AUTH_ENABLED) {
      const railwaySession = await railwayClient.auth.getSession();
      if (railwaySession.ok && railwaySession.data) {
        return {
          success: true,
          user: railwaySession.data.user,
          session: railwaySession.data,
          source: 'railway',
        };
      }
    }

    // Check Firebase
    if (featureFlags.FIREBASE_AUTH_FALLBACK) {
      const auth = getFirebaseAuth();
      const currentUser = auth?.currentUser;
      if (currentUser) {
        return {
          success: true,
          user: currentUser,
          source: 'firebase',
        };
      }
    }

    return null;
  }

  /**
   * Subscribe to auth state changes from both systems
   */
  onAuthStateChange(callback: (result: AuthResult | null) => void): () => void {
    let unsubscribeFirebase: (() => void) | null = null;

    // Subscribe to Firebase auth changes
    if (featureFlags.FIREBASE_AUTH_FALLBACK) {
      const auth = getFirebaseAuth();
      if (auth) {
        unsubscribeFirebase = onAuthStateChanged(auth, (user) => {
          if (user) {
            callback({
              success: true,
              user,
              source: 'firebase',
            });
          } else {
            callback(null);
          }
        });
      }
    }

    // Return cleanup function
    return () => {
      unsubscribeFirebase?.();
    };
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const authBridge = new AuthBridge();

export default authBridge;

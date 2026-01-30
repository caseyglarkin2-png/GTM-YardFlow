/**
 * T97.0: Auth Bridge Service
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

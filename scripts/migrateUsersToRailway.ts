/**
 * T97.0.5: Firebase → Railway User Migration Script
 * 
 * Migrates existing Firebase Auth users to Railway NextAuth database.
 * Run this script before disabling Firebase Auth fallback.
 * 
 * Usage:
 *   npx tsx scripts/migrateUsersToRailway.ts
 *   
 * Options:
 *   --dry-run     Preview migration without making changes
 *   --limit N     Only migrate first N users
 *   --email E     Migrate specific email only
 */

import { getAuth } from 'firebase-admin/auth';
import { initializeApp, cert, getApps } from 'firebase-admin/app';

// Initialize Firebase Admin if not already done
if (getApps().length === 0) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined;
    
  if (serviceAccount) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    initializeApp(); // Uses GOOGLE_APPLICATION_CREDENTIALS
  }
}

const RAILWAY_API_URL = process.env.RAILWAY_API_URL || 'https://api.railway.internal';
const RAILWAY_ADMIN_KEY = process.env.RAILWAY_ADMIN_API_KEY;

// =============================================================================
// Types
// =============================================================================

interface MigrationResult {
  email: string;
  success: boolean;
  railwayId?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  results: MigrationResult[];
}

interface RailwayCreateUserRequest {
  email: string;
  name?: string;
  firebaseUid: string;
  requirePasswordReset: boolean;
}

// =============================================================================
// Railway API
// =============================================================================

async function checkUserExists(email: string): Promise<boolean> {
  const response = await fetch(`${RAILWAY_API_URL}/api/admin/users/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RAILWAY_ADMIN_KEY}`,
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(`Failed to check user: ${response.status}`);
  }

  const data = await response.json();
  return data.exists;
}

async function createRailwayUser(user: RailwayCreateUserRequest): Promise<{ id: string }> {
  const response = await fetch(`${RAILWAY_API_URL}/api/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RAILWAY_ADMIN_KEY}`,
    },
    body: JSON.stringify(user),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `Failed to create user: ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// Migration Logic
// =============================================================================

async function migrateUser(
  firebaseUser: { uid: string; email?: string; displayName?: string | null },
  dryRun: boolean
): Promise<MigrationResult> {
  const email = firebaseUser.email;
  
  if (!email) {
    return {
      email: firebaseUser.uid,
      success: false,
      skipped: true,
      skipReason: 'No email address',
    };
  }

  try {
    // Check if already exists in Railway
    const exists = await checkUserExists(email);
    
    if (exists) {
      return {
        email,
        success: true,
        skipped: true,
        skipReason: 'Already exists in Railway',
      };
    }

    if (dryRun) {
      return {
        email,
        success: true,
        skipped: true,
        skipReason: 'Dry run - would create',
      };
    }

    // Create user in Railway
    const result = await createRailwayUser({
      email,
      name: firebaseUser.displayName || undefined,
      firebaseUid: firebaseUser.uid,
      requirePasswordReset: true, // Force password reset on first Railway login
    });

    return {
      email,
      success: true,
      railwayId: result.id,
    };
  } catch (error) {
    return {
      email,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function runMigration(options: {
  dryRun: boolean;
  limit?: number;
  email?: string;
}): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    results: [],
  };

  console.log('\n🚀 Starting Firebase → Railway User Migration');
  console.log(`   Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (options.limit) console.log(`   Limit: ${options.limit} users`);
  if (options.email) console.log(`   Single email: ${options.email}`);
  console.log('');

  const auth = getAuth();

  // Handle single email migration
  if (options.email) {
    try {
      const user = await auth.getUserByEmail(options.email);
      stats.total = 1;
      const result = await migrateUser(user, options.dryRun);
      stats.results.push(result);
      
      if (result.success && !result.skipped) stats.migrated++;
      else if (result.skipped) stats.skipped++;
      else stats.failed++;
      
      return stats;
    } catch (error) {
      console.error(`User not found: ${options.email}`);
      return stats;
    }
  }

  // Paginate through all Firebase users
  let nextPageToken: string | undefined;
  let processedCount = 0;

  do {
    const listResult = await auth.listUsers(100, nextPageToken);
    
    for (const user of listResult.users) {
      if (options.limit && processedCount >= options.limit) {
        break;
      }

      stats.total++;
      processedCount++;

      const result = await migrateUser(user, options.dryRun);
      stats.results.push(result);

      if (result.success && !result.skipped) {
        stats.migrated++;
        console.log(`✅ ${result.email} → ${result.railwayId}`);
      } else if (result.skipped) {
        stats.skipped++;
        console.log(`⏭️  ${result.email} (${result.skipReason})`);
      } else {
        stats.failed++;
        console.log(`❌ ${result.email}: ${result.error}`);
      }
    }

    nextPageToken = listResult.pageToken;
  } while (nextPageToken && (!options.limit || processedCount < options.limit));

  return stats;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  if (!RAILWAY_ADMIN_KEY) {
    console.error('❌ RAILWAY_ADMIN_API_KEY environment variable required');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((_, i) => args[i - 1] === '--limit');
  const emailArg = args.find((_, i) => args[i - 1] === '--email');

  try {
    const stats = await runMigration({
      dryRun,
      limit: limitArg ? parseInt(limitArg, 10) : undefined,
      email: emailArg,
    });

    console.log('\n📊 Migration Summary');
    console.log('─'.repeat(40));
    console.log(`   Total users:   ${stats.total}`);
    console.log(`   Migrated:      ${stats.migrated}`);
    console.log(`   Skipped:       ${stats.skipped}`);
    console.log(`   Failed:        ${stats.failed}`);
    console.log('');

    if (stats.failed > 0) {
      console.log('❌ Some migrations failed. Review errors above.');
      process.exit(1);
    }

    if (dryRun) {
      console.log('ℹ️  This was a dry run. Run without --dry-run to apply changes.');
    } else {
      console.log('✅ Migration complete!');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();

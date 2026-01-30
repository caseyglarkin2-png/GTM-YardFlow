/**
 * migrateProspectsToRailway.ts - Firestore to Railway migration script
 * 
 * Sprint 93: T93.8 - Add Data Migration Script
 * 
 * One-time script to export Firestore prospects and import to Railway.
 * Uses batch transactions with checkpointing for reliability.
 * 
 * Usage:
 *   npx ts-node scripts/migrateProspectsToRailway.ts
 *   npx ts-node scripts/migrateProspectsToRailway.ts --dry-run
 *   npx ts-node scripts/migrateProspectsToRailway.ts --resume
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// =============================================================================
// Configuration
// =============================================================================

const BATCH_SIZE = 50;
const CHECKPOINT_FILE = path.join(__dirname, '../.migration-checkpoint.json');
const EVIDENCE_DIR = path.join(__dirname, '../docs/migration-evidence');
const RAILWAY_API_URL = process.env.RAILWAY_API_URL || process.env.VITE_RAILWAY_URL || 'http://localhost:3000';
const DRY_RUN = process.argv.includes('--dry-run');
const RESUME = process.argv.includes('--resume');
const VERBOSE = process.argv.includes('--verbose');

interface Checkpoint {
  lastIndex: number;
  lastProspectId: string | null;
  migrated: number;
  failed: number;
  startedAt: string;
  lastUpdatedAt: string;
}

interface MigrationStats {
  total: number;
  migrated: number;
  failed: number;
  skipped: number;
  errors: Array<{ id: string; email?: string; error: string }>;
}

interface FirestoreProspect {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  title?: string;
  company?: string;
  companyName?: string;
  linkedinUrl?: string;
  linkedIn?: string;
  status?: string;
  tier?: string;
  score?: number;
  notes?: string;
  tags?: string[];
  createdAt?: Date | { toDate: () => Date };
  updatedAt?: Date | { toDate: () => Date };
  lastContactedAt?: Date | { toDate: () => Date } | null;
  [key: string]: unknown;
}

// =============================================================================
// Helpers
// =============================================================================

function log(message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info') {
  const prefix = {
    info: '  ',
    warn: '⚠️ ',
    error: '❌ ',
    debug: '🔍 ',
  };
  
  if (level === 'debug' && !VERBOSE) return;
  
  console.log(`${prefix[level]}${message}`);
}

function loadCheckpoint(): Checkpoint | null {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    log(`Failed to load checkpoint: ${err}`, 'warn');
  }
  return null;
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  try {
    checkpoint.lastUpdatedAt = new Date().toISOString();
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
  } catch (err) {
    log(`Failed to save checkpoint: ${err}`, 'warn');
  }
}

function clearCheckpoint(): void {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE);
    }
  } catch (err) {
    log(`Failed to clear checkpoint: ${err}`, 'warn');
  }
}

function ensureEvidenceDir(): void {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }
}

function toISOString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'toDate' in value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate().toISOString();
  }
  return null;
}

function normalizeProspect(doc: FirestoreProspect): Record<string, unknown> {
  // Parse name if firstName/lastName not provided
  let firstName = doc.firstName;
  let lastName = doc.lastName;
  
  if (!firstName && !lastName && doc.name) {
    const parts = doc.name.split(' ');
    firstName = parts[0];
    lastName = parts.slice(1).join(' ');
  }

  // Normalize status
  const statusMap: Record<string, string> = {
    'New': 'new',
    'Researching': 'researching',
    'Contacted': 'contacted',
    'Replied': 'replied',
    'Meeting Scheduled': 'meeting_scheduled',
    'Closed Won': 'closed_won',
    'Closed Lost': 'closed_lost',
    'Nurturing': 'nurturing',
  };
  const status = statusMap[doc.status || ''] || doc.status || 'new';

  // Normalize tier
  const tierMap: Record<string, string> = {
    '1': 'Tier 1',
    '2': 'Tier 2',
    '3': 'Tier 3',
    'tier1': 'Tier 1',
    'tier2': 'Tier 2',
    'tier3': 'Tier 3',
  };
  const tier = tierMap[doc.tier || ''] || doc.tier || 'Tier 3';

  return {
    firestoreId: doc.id, // Keep reference to original
    firstName: firstName || '',
    lastName: lastName || '',
    email: doc.email || null,
    phone: doc.phone || null,
    title: doc.title || null,
    companyName: doc.company || doc.companyName || null,
    linkedinUrl: doc.linkedinUrl || doc.linkedIn || null,
    status,
    tier,
    score: typeof doc.score === 'number' ? doc.score : 50,
    notes: doc.notes || null,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    lastContactedAt: toISOString(doc.lastContactedAt),
    createdAt: toISOString(doc.createdAt) || new Date().toISOString(),
    updatedAt: toISOString(doc.updatedAt) || new Date().toISOString(),
  };
}

// =============================================================================
// Firebase Setup
// =============================================================================

function initFirebase() {
  if (getApps().length === 0) {
    // Try to load service account from environment or file
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
      path.join(__dirname, '../serviceAccountKey.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
      initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      // Use default credentials (e.g., when running in GCP)
      initializeApp();
    }
  }
  
  return getFirestore();
}

// =============================================================================
// Railway API
// =============================================================================

async function checkRailwayHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${RAILWAY_API_URL}/health`);
    return response.ok;
  } catch (err) {
    return false;
  }
}

async function getRailwayProspectCount(): Promise<number> {
  try {
    const response = await fetch(`${RAILWAY_API_URL}/api/prospects?pageSize=1`);
    if (response.ok) {
      const data = await response.json();
      return data.pagination?.total || 0;
    }
  } catch (err) {
    log(`Failed to get Railway count: ${err}`, 'warn');
  }
  return 0;
}

async function batchUpsertToRailway(prospects: Record<string, unknown>[]): Promise<{
  success: boolean;
  created: number;
  updated: number;
  errors: Array<{ index: number; error: string }>;
}> {
  if (DRY_RUN) {
    log(`[DRY RUN] Would upsert ${prospects.length} prospects`, 'debug');
    return { success: true, created: prospects.length, updated: 0, errors: [] };
  }

  try {
    const response = await fetch(`${RAILWAY_API_URL}/api/prospects/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prospects,
        updateOnConflict: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
      success: true,
      created: data.created || 0,
      updated: data.updated || 0,
      errors: data.errors || [],
    };
  } catch (err) {
    log(`Batch upsert failed: ${err}`, 'error');
    return {
      success: false,
      created: 0,
      updated: 0,
      errors: [{ index: 0, error: String(err) }],
    };
  }
}

// =============================================================================
// Main Migration
// =============================================================================

async function migrate(): Promise<void> {
  console.log('\n🚂 Railway Prospect Migration');
  console.log('='.repeat(50));
  
  if (DRY_RUN) {
    console.log('🏃 Running in DRY RUN mode - no data will be written\n');
  }

  // Check Railway health
  log('Checking Railway API health...');
  const railwayHealthy = await checkRailwayHealth();
  if (!railwayHealthy && !DRY_RUN) {
    log('Railway API is not accessible. Aborting.', 'error');
    log(`  URL: ${RAILWAY_API_URL}`);
    log('  Make sure RAILWAY_API_URL environment variable is set correctly.');
    process.exit(1);
  }
  log('Railway API is healthy ✓');

  // Initialize Firebase
  log('Connecting to Firestore...');
  const db = initFirebase();
  log('Connected to Firestore ✓');

  // Load checkpoint if resuming
  let checkpoint: Checkpoint | null = null;
  let startIndex = 0;
  
  if (RESUME) {
    checkpoint = loadCheckpoint();
    if (checkpoint) {
      startIndex = checkpoint.lastIndex;
      log(`Resuming from checkpoint: ${startIndex} prospects already processed`);
    }
  } else {
    clearCheckpoint();
  }

  // Fetch all prospects from Firestore
  log('Fetching prospects from Firestore...');
  const snapshot = await db.collection('prospects').get();
  const firestoreProspects = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as FirestoreProspect[];
  
  log(`Found ${firestoreProspects.length} prospects in Firestore`);

  if (firestoreProspects.length === 0) {
    log('No prospects to migrate. Done!');
    return;
  }

  // Initialize stats
  const stats: MigrationStats = {
    total: firestoreProspects.length,
    migrated: checkpoint?.migrated || 0,
    failed: checkpoint?.failed || 0,
    skipped: startIndex,
    errors: [],
  };

  // Create new checkpoint
  checkpoint = {
    lastIndex: startIndex,
    lastProspectId: null,
    migrated: stats.migrated,
    failed: stats.failed,
    startedAt: checkpoint?.startedAt || new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
  };

  // Process in batches
  log(`Processing prospects in batches of ${BATCH_SIZE}...`);
  console.log('');

  for (let i = startIndex; i < firestoreProspects.length; i += BATCH_SIZE) {
    const batch = firestoreProspects.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(firestoreProspects.length / BATCH_SIZE);
    
    log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} prospects)...`, 'info');

    // Normalize prospects
    const normalizedBatch = batch.map(normalizeProspect);

    // Upsert to Railway
    const result = await batchUpsertToRailway(normalizedBatch);

    if (result.success) {
      stats.migrated += result.created + result.updated;
      log(`  ✓ Created: ${result.created}, Updated: ${result.updated}`, 'info');
    } else {
      stats.failed += batch.length;
      stats.errors.push(
        ...result.errors.map(e => ({
          id: batch[e.index]?.id || 'unknown',
          error: e.error,
        }))
      );
      log(`  ✗ Batch failed`, 'error');
    }

    // Update checkpoint
    checkpoint.lastIndex = i + batch.length;
    checkpoint.lastProspectId = batch[batch.length - 1]?.id || null;
    checkpoint.migrated = stats.migrated;
    checkpoint.failed = stats.failed;
    saveCheckpoint(checkpoint);

    // Progress bar
    const progress = ((i + batch.length) / firestoreProspects.length * 100).toFixed(1);
    process.stdout.write(`  Progress: ${progress}%\r`);
  }

  console.log('\n');

  // Final verification
  log('Verifying migration...');
  const railwayCount = await getRailwayProspectCount();
  log(`Railway prospect count: ${railwayCount}`);
  log(`Firestore prospect count: ${firestoreProspects.length}`);

  // Generate evidence
  ensureEvidenceDir();
  const evidenceFile = path.join(
    EVIDENCE_DIR,
    `prospect-migration-${new Date().toISOString().split('T')[0]}.json`
  );
  
  const evidence = {
    timestamp: new Date().toISOString(),
    dryRun: DRY_RUN,
    firestoreCount: firestoreProspects.length,
    railwayCount,
    stats,
    checkpoint,
    sampleRecords: firestoreProspects.slice(0, 5).map(p => ({
      id: p.id,
      name: p.name || `${p.firstName} ${p.lastName}`,
      email: p.email,
    })),
  };

  if (!DRY_RUN) {
    fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
    log(`Evidence saved to: ${evidenceFile}`);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary');
  console.log('='.repeat(50));
  console.log(`  Total prospects:    ${stats.total}`);
  console.log(`  Successfully migrated: ${stats.migrated}`);
  console.log(`  Failed:             ${stats.failed}`);
  console.log(`  Skipped (resumed):  ${stats.skipped}`);
  
  if (stats.errors.length > 0) {
    console.log('\n  Errors:');
    stats.errors.slice(0, 10).forEach(e => {
      console.log(`    - ${e.id}: ${e.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`    ... and ${stats.errors.length - 10} more`);
    }
  }

  if (railwayCount >= firestoreProspects.length * 0.95) {
    console.log('\n✅ Migration completed successfully!');
    clearCheckpoint();
  } else {
    console.log('\n⚠️  Migration may be incomplete. Re-run with --resume to continue.');
  }

  console.log('');
}

// =============================================================================
// Entry Point
// =============================================================================

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

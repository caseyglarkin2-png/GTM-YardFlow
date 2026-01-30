#!/usr/bin/env npx ts-node

/**
 * T90.3: Firestore Restore Script
 * 
 * Restores Firestore collections from a backup created by backupFirestore.ts.
 * Use this for emergency rollback if migration causes issues.
 * 
 * Usage:
 *   npx ts-node scripts/restoreFirestore.ts ./backups/firestore-2026-01-30_12-00-00
 *   npm run restore:firestore -- ./backups/firestore-2026-01-30_12-00-00
 * 
 * Options:
 *   --dry-run    Preview what would be restored without making changes
 *   --force      Skip confirmation prompts
 *   --collection Restore only specific collection(s)
 * 
 * Example:
 *   npx ts-node scripts/restoreFirestore.ts ./backups/firestore-2026-01-30_12-00-00 --dry-run
 *   npx ts-node scripts/restoreFirestore.ts ./backups/firestore-2026-01-30_12-00-00 --collection prospects
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, WriteBatch } from 'firebase-admin/firestore';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import * as readline from 'readline';

// Parse command line arguments
const args = process.argv.slice(2);
const backupPath = args.find(a => !a.startsWith('--'));
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');
const collectionFilter = args.find(a => a.startsWith('--collection='))?.split('=')[1]?.split(',');

const BATCH_SIZE = 500; // Firestore batch limit

// Initialize Firebase Admin
function initializeFirebase() {
  if (getApps().length > 0) {
    return getFirestore();
  }
  
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  
  if (serviceAccountPath && existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  } else if (projectId) {
    initializeApp({ projectId });
  } else {
    throw new Error(
      'Firebase credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID'
    );
  }
  
  return getFirestore();
}

async function confirm(message: string): Promise<boolean> {
  if (isForce) return true;
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise(resolve => {
    rl.question(`${message} (y/N): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

interface BackupManifest {
  timestamp: string;
  collections: {
    name: string;
    documentCount: number;
    sizeBytes: number;
  }[];
  totalDocuments: number;
  totalSizeBytes: number;
}

async function restoreCollection(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  documents: any[],
  isDryRun: boolean
): Promise<number> {
  console.log(`  Restoring ${collectionName} (${documents.length} documents)...`);
  
  if (isDryRun) {
    console.log(`    → [DRY RUN] Would restore ${documents.length} documents`);
    return documents.length;
  }
  
  let restored = 0;
  
  // Process in batches
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch: WriteBatch = db.batch();
    const batchDocs = documents.slice(i, i + BATCH_SIZE);
    
    for (const doc of batchDocs) {
      const { id, _metadata, ...data } = doc;
      const docRef = db.collection(collectionName).doc(id);
      
      // Convert date strings back to Firestore timestamps
      const processedData = processDateFields(data);
      
      batch.set(docRef, processedData, { merge: true });
      restored++;
    }
    
    await batch.commit();
    console.log(`    → Restored ${Math.min(i + BATCH_SIZE, documents.length)}/${documents.length}`);
  }
  
  console.log(`    ✅ Restored ${restored} documents`);
  return restored;
}

function processDateFields(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    // Check if it's an ISO date string
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj)) {
      return new Date(obj);
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(processDateFields);
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip metadata fields
      if (key === '_metadata') continue;
      result[key] = processDateFields(value);
    }
    return result;
  }
  
  return obj;
}

async function restore() {
  console.log('═══════════════════════════════════════════');
  console.log('  Firestore Restore Script');
  console.log('═══════════════════════════════════════════');
  console.log();
  
  // Validate backup path
  if (!backupPath) {
    console.error('❌ Usage: npx ts-node scripts/restoreFirestore.ts <backup-path> [options]');
    console.log();
    console.log('Options:');
    console.log('  --dry-run              Preview without making changes');
    console.log('  --force                Skip confirmation prompts');
    console.log('  --collection=name      Restore specific collection(s)');
    console.log();
    console.log('Example:');
    console.log('  npx ts-node scripts/restoreFirestore.ts ./backups/firestore-2026-01-30_12-00-00');
    process.exit(1);
  }
  
  if (!existsSync(backupPath)) {
    console.error(`❌ Backup path not found: ${backupPath}`);
    process.exit(1);
  }
  
  // Load manifest
  const manifestPath = join(backupPath, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(`❌ manifest.json not found in backup`);
    process.exit(1);
  }
  
  const manifest: BackupManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  
  console.log(`📁 Backup: ${basename(backupPath)}`);
  console.log(`📅 Created: ${manifest.timestamp}`);
  console.log(`📊 Total Documents: ${manifest.totalDocuments}`);
  if (isDryRun) {
    console.log('🔍 Mode: DRY RUN (no changes will be made)');
  }
  console.log();
  
  // Filter collections if specified
  let collectionsToRestore = manifest.collections.filter(c => c.documentCount > 0);
  if (collectionFilter) {
    collectionsToRestore = collectionsToRestore.filter(c => 
      collectionFilter.includes(c.name)
    );
  }
  
  console.log('Collections to restore:');
  collectionsToRestore.forEach(c => {
    console.log(`  - ${c.name}: ${c.documentCount} documents`);
  });
  console.log();
  
  // Confirm
  if (!isDryRun) {
    console.log('⚠️  WARNING: This will OVERWRITE existing data in Firestore!');
    const confirmed = await confirm('Are you sure you want to proceed?');
    if (!confirmed) {
      console.log('Restore cancelled.');
      process.exit(0);
    }
  }
  console.log();
  
  // Initialize Firebase
  console.log('🔥 Initializing Firebase...');
  let db: FirebaseFirestore.Firestore;
  try {
    db = initializeFirebase();
    console.log('   ✅ Firebase initialized');
  } catch (error) {
    console.error('   ❌ Firebase initialization failed:', error);
    process.exit(1);
  }
  console.log();
  
  // Restore each collection
  console.log('📦 Restoring collections...');
  let totalRestored = 0;
  
  for (const collection of collectionsToRestore) {
    const filePath = join(backupPath, `${collection.name}.json`);
    if (!existsSync(filePath)) {
      console.log(`  ⚠️  Skipping ${collection.name}: file not found`);
      continue;
    }
    
    const documents = JSON.parse(readFileSync(filePath, 'utf-8'));
    const restored = await restoreCollection(db, collection.name, documents, isDryRun);
    totalRestored += restored;
  }
  
  console.log();
  console.log('═══════════════════════════════════════════');
  console.log(`  Restore Complete! ${isDryRun ? '(DRY RUN)' : '✅'}`);
  console.log('═══════════════════════════════════════════');
  console.log();
  console.log(`  📊 Documents Restored: ${totalRestored}`);
  console.log();
  
  if (isDryRun) {
    console.log('💡 Run without --dry-run to perform actual restore.');
  }
}

// Run restore
restore().catch(error => {
  console.error('Restore failed:', error);
  process.exit(1);
});

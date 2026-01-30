#!/usr/bin/env npx ts-node

/**
 * T90.2: Firestore Backup Script
 * 
 * Exports all Firestore collections to JSON files before migration.
 * This is a critical safety measure - ALWAYS run before any migration.
 * 
 * Usage:
 *   npx ts-node scripts/backupFirestore.ts
 *   npm run backup:firestore
 * 
 * Output:
 *   ./backups/firestore-{timestamp}/
 *     ├── prospects.json
 *     ├── sequences.json
 *     ├── sequenceEnrollments.json
 *     ├── email_events.json
 *     ├── email_queue.json
 *     └── manifest.json (metadata)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Collections to backup
const COLLECTIONS = [
  'prospects',
  'sequences', 
  'sequenceEnrollments',
  'email_events',
  'email_queue',
  'email_dead_letter',
  'users',
  'templates',
];

// Initialize Firebase Admin
function initializeFirebase() {
  if (getApps().length > 0) {
    return getFirestore();
  }
  
  // Check for service account
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  
  if (serviceAccountPath && existsSync(serviceAccountPath)) {
    // Use service account file
    const serviceAccount = require(serviceAccountPath);
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  } else if (projectId) {
    // Use application default credentials
    initializeApp({
      projectId,
    });
  } else {
    throw new Error(
      'Firebase credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID'
    );
  }
  
  return getFirestore();
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
  durationMs: number;
}

async function backupCollection(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  backupDir: string
): Promise<{ count: number; size: number }> {
  console.log(`  Backing up ${collectionName}...`);
  
  try {
    const snapshot = await db.collection(collectionName).get();
    const documents = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      _metadata: {
        createTime: doc.createTime?.toDate().toISOString(),
        updateTime: doc.updateTime?.toDate().toISOString(),
      },
    }));
    
    const jsonData = JSON.stringify(documents, null, 2);
    const filePath = join(backupDir, `${collectionName}.json`);
    writeFileSync(filePath, jsonData);
    
    const sizeBytes = Buffer.byteLength(jsonData, 'utf8');
    console.log(`    → ${documents.length} documents (${(sizeBytes / 1024).toFixed(1)} KB)`);
    
    return { count: documents.length, size: sizeBytes };
  } catch (error) {
    if ((error as any).code === 'permission-denied') {
      console.log(`    → Skipped (no permission or doesn't exist)`);
      return { count: 0, size: 0 };
    }
    throw error;
  }
}

async function backup() {
  const startTime = Date.now();
  
  console.log('═══════════════════════════════════════════');
  console.log('  Firestore Backup Script');
  console.log('═══════════════════════════════════════════');
  console.log();
  
  // Create backup directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const backupDir = join(process.cwd(), 'backups', `firestore-${timestamp}`);
  
  console.log(`📁 Creating backup directory: ${backupDir}`);
  mkdirSync(backupDir, { recursive: true });
  console.log();
  
  // Initialize Firebase
  console.log('🔥 Initializing Firebase...');
  let db: FirebaseFirestore.Firestore;
  try {
    db = initializeFirebase();
    console.log('   ✅ Firebase initialized');
  } catch (error) {
    console.error('   ❌ Firebase initialization failed:', error);
    console.log();
    console.log('💡 To fix this:');
    console.log('   1. Download a service account key from Firebase Console');
    console.log('   2. Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json');
    console.log('   OR');
    console.log('   3. Set FIREBASE_PROJECT_ID=your-project-id');
    console.log('   4. Run: gcloud auth application-default login');
    process.exit(1);
  }
  console.log();
  
  // Backup each collection
  console.log('📦 Backing up collections...');
  const manifest: BackupManifest = {
    timestamp: new Date().toISOString(),
    collections: [],
    totalDocuments: 0,
    totalSizeBytes: 0,
    durationMs: 0,
  };
  
  for (const collectionName of COLLECTIONS) {
    const { count, size } = await backupCollection(db, collectionName, backupDir);
    manifest.collections.push({
      name: collectionName,
      documentCount: count,
      sizeBytes: size,
    });
    manifest.totalDocuments += count;
    manifest.totalSizeBytes += size;
  }
  
  // Calculate duration
  manifest.durationMs = Date.now() - startTime;
  
  // Write manifest
  const manifestPath = join(backupDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log();
  console.log('═══════════════════════════════════════════');
  console.log('  Backup Complete! ✅');
  console.log('═══════════════════════════════════════════');
  console.log();
  console.log(`  📁 Location: ${backupDir}`);
  console.log(`  📊 Total Documents: ${manifest.totalDocuments}`);
  console.log(`  💾 Total Size: ${(manifest.totalSizeBytes / 1024).toFixed(1)} KB`);
  console.log(`  ⏱️  Duration: ${manifest.durationMs}ms`);
  console.log();
  console.log('  Collections backed up:');
  manifest.collections
    .filter(c => c.documentCount > 0)
    .forEach(c => {
      console.log(`    - ${c.name}: ${c.documentCount} docs`);
    });
  console.log();
  
  // Add to .gitignore reminder
  console.log('⚠️  Remember: backups/ is in .gitignore');
  console.log('   Store backups securely outside of git!');
  console.log();
}

// Run backup
backup().catch(error => {
  console.error('Backup failed:', error);
  process.exit(1);
});

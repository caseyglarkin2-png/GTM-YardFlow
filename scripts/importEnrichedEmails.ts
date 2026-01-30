#!/usr/bin/env npx ts-node
/**
 * Bulk Import Script for Enriched Contact Emails
 * 
 * Imports enriched email data from CSV files and updates existing prospects
 * in Firestore with their email addresses and confidence levels.
 * 
 * Usage:
 *   npx ts-node scripts/importEnrichedEmails.ts [csv-file] [--dry-run]
 * 
 * Examples:
 *   npx ts-node scripts/importEnrichedEmails.ts "Name,First_Name,Last_Name,Company,J.txt"
 *   npx ts-node scripts/importEnrichedEmails.ts --dry-run
 * 
 * CSV Format Expected:
 *   Name,First_Name,Last_Name,Company,Job_Title,Category,PersonScore,Enriched_Email,Confidence,Match_Type,Domain_Used,Pattern_Used
 */

import { readFileSync, existsSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// Types
interface EnrichedContact {
  Name: string;
  First_Name: string;
  Last_Name: string;
  Company: string;
  Job_Title: string;
  Category: string;
  PersonScore: string;
  Enriched_Email: string;
  Confidence: 'verified' | 'high' | 'medium' | 'low' | 'none' | '';
  Match_Type: string;
  Domain_Used: string;
  Pattern_Used: string;
}

interface ImportStats {
  total: number;
  withEmail: number;
  matched: number;
  updated: number;
  skipped: number;
  errors: number;
  byConfidence: Record<string, number>;
}

// Parse CSV (simple parser for this format)
function parseCSV(content: string): EnrichedContact[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const records: EnrichedContact[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const record: Record<string, string> = {};
    
    headers.forEach((header, idx) => {
      record[header] = values[idx] || '';
    });
    
    records.push(record as unknown as EnrichedContact);
  }
  
  return records;
}

// Validate email format
function isValidEmail(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Normalize name for matching
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Normalize company for matching
function normalizeCompany(company: string): string {
  return company
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '')
    .replace(/\binc\b|\bcorp\b|\bllc\b|\bltd\b|\bco\b/gi, '')
    .trim();
}

// Initialize Firebase Admin
function initFirebase(): Firestore {
  if (getApps().length === 0) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountKey) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT environment variable is required.\n' +
        'Set it with the JSON content of your Firebase service account key.'
      );
    }
    
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      initializeApp({
        credential: cert(serviceAccount),
      });
    } catch (err) {
      throw new Error(`Failed to parse Firebase service account: ${(err as Error).message}`);
    }
  }
  
  return getFirestore();
}

// Find matching prospect by name and company
async function findMatchingProspect(
  db: Firestore, 
  name: string, 
  company: string
): Promise<{ id: string; data: Record<string, unknown> } | null> {
  // Try exact match first
  const exactQuery = await db.collection('prospects')
    .where('name', '==', name)
    .where('company', '==', company)
    .limit(1)
    .get();
  
  if (!exactQuery.empty) {
    const doc = exactQuery.docs[0];
    return { id: doc.id, data: doc.data() };
  }
  
  // Try fuzzy match by name only (for company name variations)
  const nameQuery = await db.collection('prospects')
    .where('name', '==', name)
    .limit(10)
    .get();
  
  if (!nameQuery.empty) {
    const normalizedTarget = normalizeCompany(company);
    for (const doc of nameQuery.docs) {
      const data = doc.data();
      if (normalizeCompany(data.company as string) === normalizedTarget) {
        return { id: doc.id, data };
      }
    }
  }
  
  return null;
}

// Main import function
async function importEnrichedEmails(csvPath: string, dryRun: boolean = false): Promise<ImportStats> {
  const stats: ImportStats = {
    total: 0,
    withEmail: 0,
    matched: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    byConfidence: { verified: 0, high: 0, medium: 0, low: 0, none: 0 },
  };

  console.log(`\n📧 Enriched Email Import ${dryRun ? '(DRY RUN)' : ''}`);
  console.log('='.repeat(50));
  console.log(`Source: ${csvPath}\n`);

  // Load CSV
  if (!existsSync(csvPath)) {
    throw new Error(`File not found: ${csvPath}`);
  }
  
  const content = readFileSync(csvPath, 'utf-8');
  const records = parseCSV(content);
  stats.total = records.length;
  
  console.log(`📊 Found ${stats.total} records in CSV\n`);

  // Filter to those with valid emails
  const withEmails = records.filter(r => isValidEmail(r.Enriched_Email));
  stats.withEmail = withEmails.length;
  
  // Count by confidence
  for (const record of withEmails) {
    const conf = record.Confidence || 'none';
    stats.byConfidence[conf] = (stats.byConfidence[conf] || 0) + 1;
  }
  
  console.log(`📬 ${stats.withEmail} have valid email addresses`);
  console.log(`   Verified: ${stats.byConfidence.verified || 0}`);
  console.log(`   High: ${stats.byConfidence.high || 0}`);
  console.log(`   Medium: ${stats.byConfidence.medium || 0}`);
  console.log(`   Low: ${stats.byConfidence.low || 0}`);
  console.log('');

  if (dryRun) {
    console.log('🔍 DRY RUN - No changes will be made\n');
  }

  // Initialize Firebase
  const db = initFirebase();
  
  // Process in batches
  const BATCH_SIZE = 50;
  let processed = 0;
  
  for (let i = 0; i < withEmails.length; i += BATCH_SIZE) {
    const chunk = withEmails.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    let batchUpdates = 0;
    
    for (const contact of chunk) {
      try {
        const match = await findMatchingProspect(db, contact.Name, contact.Company);
        
        if (match) {
          stats.matched++;
          
          // Check if already has email
          const existingEmail = match.data.email as string | undefined;
          if (existingEmail && isValidEmail(existingEmail)) {
            // Skip if already has a verified email
            if (match.data.emailConfidence === 'verified') {
              stats.skipped++;
              continue;
            }
            // Skip if new email is lower confidence than existing
            const confOrder = ['verified', 'high', 'medium', 'low', 'none'];
            const existingConf = confOrder.indexOf(match.data.emailConfidence as string);
            const newConf = confOrder.indexOf(contact.Confidence || 'none');
            if (newConf > existingConf) {
              stats.skipped++;
              continue;
            }
          }
          
          if (!dryRun) {
            const ref = db.collection('prospects').doc(match.id);
            batch.update(ref, {
              email: contact.Enriched_Email,
              emailConfidence: contact.Confidence || 'none',
              personScore: parseInt(contact.PersonScore) || 0,
              enrichedAt: new Date().toISOString(),
              matchType: contact.Match_Type,
            });
            batchUpdates++;
          }
          
          stats.updated++;
        } else {
          stats.skipped++;
        }
      } catch (err) {
        console.error(`Error processing ${contact.Name}: ${(err as Error).message}`);
        stats.errors++;
      }
    }
    
    if (!dryRun && batchUpdates > 0) {
      await batch.commit();
    }
    
    processed += chunk.length;
    process.stdout.write(`\r⏳ Processed ${processed}/${withEmails.length}...`);
  }
  
  console.log('\n');
  console.log('✅ Import Complete!');
  console.log('='.repeat(50));
  console.log(`   Total records: ${stats.total}`);
  console.log(`   With emails: ${stats.withEmail}`);
  console.log(`   Matched to prospects: ${stats.matched}`);
  console.log(`   Updated: ${stats.updated}`);
  console.log(`   Skipped (no match/already has): ${stats.skipped}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log('');
  
  return stats;
}

// CLI Entry Point
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const csvPath = args.find(a => !a.startsWith('--')) || 'Name,First_Name,Last_Name,Company,J.txt';
  
  try {
    await importEnrichedEmails(csvPath, dryRun);
  } catch (err) {
    console.error('\n❌ Import failed:', (err as Error).message);
    process.exit(1);
  }
}

main();

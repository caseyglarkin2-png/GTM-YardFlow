#!/usr/bin/env node
/**
 * Generate Domain Email Patterns from Enriched CSV
 * 
 * Sprint 1001: Email Pattern Inference
 * 
 * Parses the enriched attendee list to learn email patterns per domain.
 * Outputs a JSON file with pattern data for each domain.
 * 
 * Usage: npx tsx scripts/generateDomainPatterns.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const ENRICHED_CSV = path.join(ROOT, 'enriched attendee list 2 - enriched attendee list 2 (1).csv');
const OUTPUT_FILE = path.join(ROOT, 'src/data/domainPatterns.json');

// Email pattern types
type EmailPattern = 
  | 'first.last' | 'first' | 'flast' | 'f.last' 
  | 'firstlast' | 'first_last' | 'last' | 'lastf' | 'last.first' | 'unknown';

interface DomainPatternData {
  pattern: EmailPattern;
  sampleCount: number;
  confidence: number;
}

// Parse CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Normalize name for pattern matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

// Extract domain from email
function extractDomain(email: string): string {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : '';
}

// Detect which pattern an email follows
function detectPattern(email: string, firstName: string, lastName: string): EmailPattern {
  const local = email.split('@')[0]?.toLowerCase() || '';
  const first = normalizeName(firstName);
  const last = normalizeName(lastName);
  
  if (!local || !first || !last) return 'unknown';
  
  if (local === `${first}.${last}`) return 'first.last';
  if (local === `${first}${last}`) return 'firstlast';
  if (local === `${first}_${last}`) return 'first_last';
  if (local === `${first[0]}${last}`) return 'flast';
  if (local === `${first[0]}.${last}`) return 'f.last';
  if (local === `${last}.${first}`) return 'last.first';
  if (local === `${last}${first[0]}`) return 'lastf';
  if (local === first) return 'first';
  if (local === last) return 'last';
  
  return 'unknown';
}

function generate() {
  console.log('📊 Generating Domain Email Patterns...\n');

  if (!fs.existsSync(ENRICHED_CSV)) {
    console.error(`❌ Enriched CSV not found at ${ENRICHED_CSV}`);
    process.exit(1);
  }

  // Parse enriched CSV
  console.log('1️⃣ Parsing Enriched Attendee List...');
  const csvData = fs.readFileSync(ENRICHED_CSV, 'utf-8').replace(/\r/g, '');
  const lines = csvData.split('\n').filter(l => l.trim());
  
  if (lines.length < 2) {
    console.error('❌ CSV file appears to be empty');
    process.exit(1);
  }

  // Parse header
  const headers = parseCSVLine(lines[0]);
  const colIndex = {
    firstName: headers.indexOf('First Name'),
    lastName: headers.indexOf('Last Name'),
    email: headers.indexOf('Email'),
    company: headers.indexOf('Company Name'),
    companyFallback: headers.indexOf('Company'),
  };

  // Group samples by domain
  const domainSamples = new Map<string, Array<{ pattern: EmailPattern; email: string }>>();
  let validCount = 0;
  let unknownCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    
    const email = fields[colIndex.email]?.trim().toLowerCase();
    if (!email || !email.includes('@')) continue;
    
    const firstName = fields[colIndex.firstName]?.trim() || '';
    const lastName = fields[colIndex.lastName]?.trim() || '';
    const domain = extractDomain(email);
    
    if (!firstName || !lastName || !domain) continue;
    
    const pattern = detectPattern(email, firstName, lastName);
    
    if (pattern === 'unknown') {
      unknownCount++;
      continue;
    }
    
    validCount++;
    
    const existing = domainSamples.get(domain) || [];
    existing.push({ pattern, email });
    domainSamples.set(domain, existing);
  }

  console.log(`   ✅ ${validCount} emails with detected patterns`);
  console.log(`   ⚠️  ${unknownCount} emails with unknown patterns\n`);

  // Calculate best pattern per domain
  console.log('2️⃣ Analyzing patterns per domain...');
  
  const domainPatterns: Record<string, DomainPatternData> = {};
  const patternStats: Record<EmailPattern, number> = {
    'first.last': 0, 'first': 0, 'flast': 0, 'f.last': 0,
    'firstlast': 0, 'first_last': 0, 'last': 0, 'lastf': 0, 
    'last.first': 0, 'unknown': 0,
  };

  for (const [domain, samples] of domainSamples) {
    // Count occurrences of each pattern
    const patternCounts = new Map<EmailPattern, number>();
    for (const sample of samples) {
      patternCounts.set(sample.pattern, (patternCounts.get(sample.pattern) || 0) + 1);
    }
    
    // Find most common pattern
    let bestPattern: EmailPattern = 'first.last';
    let bestCount = 0;
    for (const [pattern, count] of patternCounts) {
      if (count > bestCount) {
        bestCount = count;
        bestPattern = pattern;
      }
    }
    
    // Calculate confidence
    const confidence = Math.round((bestCount / samples.length) * 100);
    
    domainPatterns[domain] = {
      pattern: bestPattern,
      sampleCount: samples.length,
      confidence,
    };
    
    patternStats[bestPattern]++;
  }

  console.log(`   ✅ ${Object.keys(domainPatterns).length} domains with patterns\n`);

  // Pattern distribution
  console.log('3️⃣ Pattern Distribution:');
  const sortedPatterns = Object.entries(patternStats)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  
  for (const [pattern, count] of sortedPatterns) {
    const pct = ((count / Object.keys(domainPatterns).length) * 100).toFixed(1);
    console.log(`   ${pattern.padEnd(12)} ${count.toString().padStart(4)} domains (${pct}%)`);
  }
  console.log('');

  // High confidence domains
  const highConfidence = Object.values(domainPatterns).filter(d => d.confidence >= 80).length;
  const avgConfidence = Object.values(domainPatterns).reduce((sum, d) => sum + d.confidence, 0) / Object.keys(domainPatterns).length;
  
  console.log('4️⃣ Confidence Stats:');
  console.log(`   High confidence (≥80%): ${highConfidence} domains`);
  console.log(`   Average confidence: ${avgConfidence.toFixed(1)}%\n`);

  // Write output
  console.log('5️⃣ Writing output...');
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(domainPatterns, null, 2));
  console.log(`   ✅ Written to ${OUTPUT_FILE}\n`);

  // Sample domains
  console.log('📋 Sample Domains:');
  const sampleDomains = Object.entries(domainPatterns)
    .sort((a, b) => b[1].sampleCount - a[1].sampleCount)
    .slice(0, 10);
  
  for (const [domain, data] of sampleDomains) {
    console.log(`   ${domain.padEnd(30)} ${data.pattern.padEnd(12)} (${data.sampleCount} samples, ${data.confidence}% conf)`);
  }

  console.log('\n✅ Done!');
}

generate();

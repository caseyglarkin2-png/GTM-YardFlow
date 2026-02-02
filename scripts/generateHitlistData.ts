#!/usr/bin/env node
/**
 * Generate hitlistData.ts from Manifest CSV files
 * 
 * Parses:
 * - YardFlow_Manifest2026_Hitlist_v3.xlsx - People Hitlist (1).csv (5,408 people)
 * - YardFlow_Manifest2026_Hitlist_v3.xlsx - Company Hitlist (2).csv (2,652 companies)
 * - Manifest Contacts 2026 from App (1).xlsx - Speakers (Enriched).csv (220 speakers)
 * - enriched attendee list 2 - enriched attendee list 2 (1).csv (1,816 enriched with emails)
 * 
 * Outputs:
 * - src/data/hitlistData.ts with all prospects pre-loaded (with merged emails)
 * 
 * Usage: npx tsx scripts/generateHitlistData.ts
 *        npx tsx scripts/generateHitlistData.ts --dry-run (preview without writing)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI args
const DRY_RUN = process.argv.includes('--dry-run');

// Paths
const ROOT = path.join(__dirname, '..');
const PEOPLE_CSV = path.join(ROOT, 'YardFlow_Manifest2026_Hitlist_v3.xlsx - People Hitlist (1).csv');
const COMPANY_CSV = path.join(ROOT, 'YardFlow_Manifest2026_Hitlist_v3.xlsx - Company Hitlist (2).csv');
const ENRICHED_CSV = path.join(ROOT, 'enriched attendee list 2 - enriched attendee list 2 (1).csv');
const DOMAIN_PATTERNS_FILE = path.join(ROOT, 'src/data/domainPatterns.json');
const OUTPUT_FILE = path.join(ROOT, 'src/data/hitlistData.ts');

// Email pattern types for inference
type EmailPattern = 
  | 'first.last' | 'first' | 'flast' | 'f.last' 
  | 'firstlast' | 'first_last' | 'last' | 'lastf' | 'last.first' | 'unknown';

interface DomainPatternData {
  pattern: EmailPattern;
  sampleCount: number;
  confidence: number;
}

interface PersonRow {
  name: string;
  category: string;
  title: string;
  company: string;
  country: string;
  qualified: boolean;
  revenue: string;
  score: number;
  isOps: boolean;
  isExec: boolean;
  isExecOps: boolean;
  isProc: boolean;
  isSales: boolean;
  // Email fields (from enriched merge)
  email?: string;
  emailConfidence?: 'verified' | 'high' | 'medium' | 'low' | 'inferred';
  linkedinUrl?: string;
}

interface EnrichedRow {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  linkedinUrl: string;
}

interface CompanyRow {
  company: string;
  attendees: number;
  execOpsCount: number;
  opsCount: number;
  score: number;
  tier: string;
  recommendedTargets: string;
  topTitles: string;
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

// Parse boolean from CSV
function parseBool(val: string): boolean {
  return val?.toUpperCase() === 'TRUE';
}

// Parse number from CSV
function parseNum(val: string): number {
  const num = parseInt(val, 10);
  return isNaN(num) ? 0 : num;
}

// Generate unique ID from name + company
function generateId(name: string, company: string): string {
  const slug = `${name}-${company}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  return slug;
}

// Calculate tier from company data
function lookupTier(company: string, companyTiers: Map<string, string>): string {
  return companyTiers.get(company.toLowerCase()) || 'Tier 3';
}

// Email validation (mirrors src/utils/emailValidator.ts)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_EMAIL_VALUES = new Set([
  'n/a', 'na', 'none', 'null', 'undefined', '-', '--', 'test',
  'test@test.com', 'example@example.com', 'no email', 'noemail',
  'not available', 'not provided', 'unknown', 'tbd', 'pending', ''
]);
const INVALID_DOMAINS = new Set([
  'example.com', 'test.com', 'localhost', 'invalid.com', 'placeholder.com'
]);

function isValidEmail(email: string | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  if (INVALID_EMAIL_VALUES.has(normalized)) return false;
  if (!EMAIL_REGEX.test(normalized)) return false;
  const domain = normalized.split('@')[1];
  if (domain && INVALID_DOMAINS.has(domain)) return false;
  return true;
}

function sanitizeEmail(email: string): string | null {
  if (!isValidEmail(email)) return null;
  return email.trim().toLowerCase();
}

// Normalize name for pattern matching
function normalizeNameForPattern(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

// Generate email based on pattern
function generateEmailFromPattern(
  firstName: string,
  lastName: string,
  domain: string,
  pattern: EmailPattern
): string {
  const first = normalizeNameForPattern(firstName);
  const last = normalizeNameForPattern(lastName);
  
  if (!first || !last || !domain) return '';
  
  switch (pattern) {
    case 'first.last':
      return `${first}.${last}@${domain}`;
    case 'first':
      return `${first}@${domain}`;
    case 'flast':
      return `${first[0]}${last}@${domain}`;
    case 'f.last':
      return `${first[0]}.${last}@${domain}`;
    case 'firstlast':
      return `${first}${last}@${domain}`;
    case 'first_last':
      return `${first}_${last}@${domain}`;
    case 'last':
      return `${last}@${domain}`;
    case 'lastf':
      return `${last}${first[0]}@${domain}`;
    case 'last.first':
      return `${last}.${first}@${domain}`;
    default:
      return `${first}.${last}@${domain}`;
  }
}

// Normalize name for matching (handles variations)
function normalizeNameKey(firstName: string, lastName: string, company: string): string {
  const fn = (firstName || '').toLowerCase().replace(/[^a-z]/g, '');
  const ln = (lastName || '').toLowerCase().replace(/[^a-z]/g, '');
  const co = (company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${fn}|${ln}|${co}`;
}

// Main generator
function generate() {
  console.log('📊 Generating hitlistData.ts from Manifest CSVs...\n');
  if (DRY_RUN) console.log('🔍 DRY RUN MODE - no files will be written\n');

  // 1. Parse Company CSV for tier lookup
  console.log('1️⃣ Parsing Company Hitlist...');
  const companyData = fs.readFileSync(COMPANY_CSV, 'utf-8').replace(/\r/g, '');
  const companyLines = companyData.split('\n').filter(l => l.trim());
  const companyTiers = new Map<string, string>();
  const companyScores = new Map<string, number>();
  
  for (let i = 1; i < companyLines.length; i++) {
    const fields = parseCSVLine(companyLines[i]);
    if (fields.length >= 14) {
      const company = fields[0].toLowerCase();
      const tier = fields[13] || 'Tier 3';
      const score = parseNum(fields[12]);
      companyTiers.set(company, tier);
      companyScores.set(company, score);
    }
  }
  console.log(`   ✅ ${companyTiers.size} companies loaded\n`);

  // 2. Parse Enriched Attendee CSV for email lookup
  console.log('2️⃣ Parsing Enriched Attendee List (emails)...');
  const enrichedEmails = new Map<string, { email: string; linkedinUrl: string; confidence: 'verified' }>();
  
  if (fs.existsSync(ENRICHED_CSV)) {
    const enrichedData = fs.readFileSync(ENRICHED_CSV, 'utf-8').replace(/\r/g, '');
    const enrichedLines = enrichedData.split('\n').filter(l => l.trim());
    
    // Parse header to get column indices
    // Columns: Name,Category,Job Title,Company,Result,First Name,Last Name,Title,Person Linkedin Url,
    //          City,State,Country,Email,Company Name,...
    const headerLine = enrichedLines[0];
    const headers = parseCSVLine(headerLine);
    const colIndex = {
      firstName: headers.indexOf('First Name'),
      lastName: headers.indexOf('Last Name'),
      email: headers.indexOf('Email'),
      company: headers.indexOf('Company Name'),
      companyFallback: headers.indexOf('Company'),
      linkedinUrl: headers.indexOf('Person Linkedin Url'),
    };
    
    let validEmailCount = 0;
    
    for (let i = 1; i < enrichedLines.length; i++) {
      const fields = parseCSVLine(enrichedLines[i]);
      
      const rawEmail = fields[colIndex.email];
      const email = sanitizeEmail(rawEmail);
      if (!email) continue;
      
      const firstName = fields[colIndex.firstName] || '';
      const lastName = fields[colIndex.lastName] || '';
      const company = fields[colIndex.company] || fields[colIndex.companyFallback] || '';
      const linkedinUrl = fields[colIndex.linkedinUrl] || '';
      
      // Create key for matching
      const key = normalizeNameKey(firstName, lastName, company);
      
      enrichedEmails.set(key, {
        email,
        linkedinUrl,
        confidence: 'verified',
      });
      validEmailCount++;
    }
    
    console.log(`   ✅ ${validEmailCount} verified emails loaded from enriched data\n`);
  } else {
    console.log(`   ⚠️ Enriched CSV not found at ${ENRICHED_CSV}\n`);
  }

  // 2b. Load domain patterns for email inference
  console.log('2b️⃣ Loading domain patterns for inference...');
  let domainPatterns: Record<string, DomainPatternData> = {};
  let companyDomains = new Map<string, string>(); // company name -> domain
  
  if (fs.existsSync(DOMAIN_PATTERNS_FILE)) {
    domainPatterns = JSON.parse(fs.readFileSync(DOMAIN_PATTERNS_FILE, 'utf-8'));
    console.log(`   ✅ ${Object.keys(domainPatterns).length} domain patterns loaded`);
    
    // Build company -> domain lookup from enriched data
    // We need to map company names to their email domains
    if (fs.existsSync(ENRICHED_CSV)) {
      const enrichedData = fs.readFileSync(ENRICHED_CSV, 'utf-8').replace(/\r/g, '');
      const enrichedLines = enrichedData.split('\n').filter(l => l.trim());
      const headers = parseCSVLine(enrichedLines[0]);
      const emailIdx = headers.indexOf('Email');
      const companyIdx = headers.indexOf('Company Name');
      const companyFallbackIdx = headers.indexOf('Company');
      
      for (let i = 1; i < enrichedLines.length; i++) {
        const fields = parseCSVLine(enrichedLines[i]);
        const email = fields[emailIdx]?.trim().toLowerCase();
        const company = (fields[companyIdx] || fields[companyFallbackIdx] || '').toLowerCase();
        
        if (email && email.includes('@') && company) {
          const domain = email.split('@')[1];
          if (domain && domainPatterns[domain]) {
            companyDomains.set(company, domain);
          }
        }
      }
    }
    console.log(`   ✅ ${companyDomains.size} companies mapped to domains\n`);
  } else {
    console.log(`   ⚠️ Domain patterns not found. Run: npx tsx scripts/generateDomainPatterns.ts\n`);
  }

  // 3. Parse People CSV
  console.log('3️⃣ Parsing People Hitlist...');
  const peopleData = fs.readFileSync(PEOPLE_CSV, 'utf-8').replace(/\r/g, '');
  const peopleLines = peopleData.split('\n').filter(l => l.trim());
  
  const prospects: PersonRow[] = [];
  const seenIds = new Set<string>();
  let emailMatchCount = 0;
  
  for (let i = 1; i < peopleLines.length; i++) {
    const fields = parseCSVLine(peopleLines[i]);
    if (fields.length >= 8 && fields[0]) {
      const name = fields[0];
      const company = fields[3];
      
      // Generate unique ID
      let id = generateId(name, company);
      let suffix = 1;
      while (seenIds.has(id)) {
        id = `${generateId(name, company)}-${suffix++}`;
      }
      seenIds.add(id);
      
      // Try to match enriched email data
      // Parse name into first/last for matching
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const matchKey = normalizeNameKey(firstName, lastName, company);
      const enrichedMatch = enrichedEmails.get(matchKey);
      
      // Try to infer email if no enriched match found
      let inferredEmail: string | undefined;
      let inferredConfidence: 'inferred' | undefined;
      
      if (!enrichedMatch) {
        const companyLower = company.toLowerCase();
        const domain = companyDomains.get(companyLower);
        
        if (domain && domainPatterns[domain]) {
          const patternData = domainPatterns[domain];
          // Only infer if confidence is high enough (>=70%)
          if (patternData.confidence >= 70 && firstName && lastName) {
            inferredEmail = generateEmailFromPattern(
              firstName,
              lastName,
              domain,
              patternData.pattern
            );
            if (inferredEmail) {
              inferredConfidence = 'inferred';
            }
          }
        }
      }
      
      if (enrichedMatch) {
        emailMatchCount++;
      }
      
      prospects.push({
        name,
        category: fields[1] || 'Attendee',
        title: fields[2] || '',
        company,
        country: fields[4] || '',
        qualified: parseBool(fields[5]),
        revenue: fields[6] || '',
        score: parseNum(fields[7]) || 50, // Default score if missing
        isOps: parseBool(fields[8]),
        isExec: parseBool(fields[9]),
        isExecOps: parseBool(fields[10]),
        isProc: parseBool(fields[11]),
        isSales: parseBool(fields[12]),
        // Merge enriched email data if available, or use inferred
        email: enrichedMatch?.email || inferredEmail,
        emailConfidence: enrichedMatch?.confidence || inferredConfidence,
        linkedinUrl: enrichedMatch?.linkedinUrl,
      });
    }
  }
  
  // Count inferred emails
  const inferredCount = prospects.filter(p => p.emailConfidence === 'inferred').length;
  
  console.log(`   ✅ ${prospects.length} prospects loaded`);
  console.log(`   📧 ${emailMatchCount} prospects matched with enriched emails`);
  console.log(`   🔮 ${inferredCount} prospects with inferred emails\n`);

  // 4. Generate TypeScript file
  console.log('4️⃣ Generating TypeScript...');
  
  // Build compact data array (JSON-like for performance)
  // Track seen IDs to ensure uniqueness
  const outputIds = new Set<string>();
  let emailsInOutput = 0;
  let verifiedInOutput = 0;
  let inferredInOutput = 0;
  
  const prospectData = prospects.map((p, index) => {
    const tier = lookupTier(p.company, companyTiers);
    const companyScore = companyScores.get(p.company.toLowerCase()) || 0;
    const combinedScore = Math.round((p.score + companyScore) / 2);
    const category = ['Speaker', 'Attendee', 'Sponsor'].includes(p.category) ? p.category : 'Attendee';
    
    // Generate unique ID
    let baseId = generateId(p.name, p.company);
    let id = baseId;
    let suffix = 1;
    while (outputIds.has(id)) {
      id = `${baseId}-${suffix++}`;
    }
    outputIds.add(id);
    
    if (p.email) {
      emailsInOutput++;
      if (p.emailConfidence === 'verified') verifiedInOutput++;
      if (p.emailConfidence === 'inferred') inferredInOutput++;
    }
    
    return {
      id,
      name: p.name,
      title: p.title,
      company: p.company,
      tier,
      score: combinedScore || p.score,
      isOps: p.isOps,
      isExec: p.isExec,
      status: 'new',
      category,
      qualified: p.qualified,
      country: p.country,
      revenue: p.revenue,
      // Email fields from enriched data
      email: p.email || undefined,
      emailConfidence: p.emailConfidence || undefined,
      linkedinUrl: p.linkedinUrl || undefined,
    };
  });
  
  console.log(`   📧 ${emailsInOutput} prospects with email in output`);
  console.log(`      ✓ ${verifiedInOutput} verified`);
  console.log(`      🔮 ${inferredInOutput} inferred\n`);
  
  const output = `/**
 * YardFlow Manifest 2026 Hitlist Data
 * 
 * AUTO-GENERATED from CSV files - DO NOT EDIT MANUALLY
 * Generated: ${new Date().toISOString()}
 * 
 * Source files:
 * - YardFlow_Manifest2026_Hitlist_v3.xlsx - People Hitlist (1).csv
 * - YardFlow_Manifest2026_Hitlist_v3.xlsx - Company Hitlist (2).csv
 * - enriched attendee list 2 - enriched attendee list 2 (1).csv (emails)
 * 
 * To regenerate: npx tsx scripts/generateHitlistData.ts
 */

import type { Prospect } from '../types';

// Import raw prospect data from JSON file
// This avoids TypeScript inference complexity with large arrays
import rawProspectData from './hitlistProspects.json';

// Raw prospect data type for type-safe mapping
interface RawProspect {
  id: string;
  name: string;
  title: string;
  company: string;
  tier: string;
  score: number;
  isOps: boolean;
  isExec: boolean;
  status: string;
  category: string;
  qualified: boolean;
  country: string;
  revenue: string;
  email?: string;
  emailConfidence?: string;
  linkedinUrl?: string;
}

const RAW_PROSPECTS: RawProspect[] = rawProspectData;

/**
 * Full Manifest 2026 Hitlist
 * Total: ${prospects.length} prospects
 * With Email: ${emailsInOutput} prospects
 */
export const HITLIST_PROSPECTS: Prospect[] = RAW_PROSPECTS.map(p => ({
  ...p,
  status: p.status as Prospect['status'],
  category: p.category as Prospect['category'],
  emailConfidence: p.emailConfidence as Prospect['emailConfidence'],
  createdAt: Date.now(),
  updatedAt: Date.now(),
}));

// Company tier lookup for enrichment
export const COMPANY_TIERS: Record<string, { tier: string; score: number }> = ${JSON.stringify(
  Object.fromEntries(
    Array.from(companyTiers.entries()).map(([k, v]) => [k, { tier: v, score: companyScores.get(k) || 0 }])
  )
)};

/**
 * Get all prospects
 */
export function getAllProspects(): Prospect[] {
  return HITLIST_PROSPECTS;
}

/**
 * Get prospects sorted by score (highest first)
 */
export function getTopProspects(limit = 50): Prospect[] {
  return [...HITLIST_PROSPECTS].sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Get Tier 1 prospects only
 */
export function getTier1Prospects(): Prospect[] {
  return HITLIST_PROSPECTS.filter(p => p.tier === 'Tier 1').sort((a, b) => b.score - a.score);
}

/**
 * Get qualified prospects only
 */
export function getQualifiedProspects(): Prospect[] {
  return HITLIST_PROSPECTS.filter(p => p.qualified).sort((a, b) => b.score - a.score);
}

/**
 * Get prospects by company
 */
export function getProspectsByCompany(company: string): Prospect[] {
  const lowerCompany = company.toLowerCase();
  return HITLIST_PROSPECTS.filter(p => p.company.toLowerCase().includes(lowerCompany));
}

/**
 * Get company tier info
 */
export function getCompanyTier(company: string): { tier: string; score: number } | null {
  return COMPANY_TIERS[company.toLowerCase()] || null;
}

/**
 * Stats summary
 */
export const HITLIST_STATS = {
  total: ${prospects.length},
  withEmail: ${emailsInOutput},
  tier1: ${prospectData.filter(p => p.tier === 'Tier 1').length},
  tier2: ${prospectData.filter(p => p.tier === 'Tier 2').length},
  tier3: ${prospectData.filter(p => p.tier === 'Tier 3').length},
  qualified: ${prospectData.filter(p => p.qualified).length},
  speakers: ${prospectData.filter(p => p.category === 'Speaker').length},
  attendees: ${prospectData.filter(p => p.category === 'Attendee').length},
  companies: ${companyTiers.size},
};

/**
 * Get prospects with email only
 */
export function getProspectsWithEmail(): Prospect[] {
  return HITLIST_PROSPECTS.filter(p => p.email).sort((a, b) => b.score - a.score);
}
`;

  const JSON_OUTPUT_FILE = path.join(ROOT, 'src/data/hitlistProspects.json');

  if (DRY_RUN) {
    console.log(`   🔍 DRY RUN: Would write to ${OUTPUT_FILE}\n`);
    console.log(`   🔍 DRY RUN: Would write JSON to ${JSON_OUTPUT_FILE}\n`);
    console.log('   First 3 prospects with email:');
    prospectData.filter(p => p.email).slice(0, 3).forEach(p => {
      console.log(`     - ${p.name} <${p.email}> @ ${p.company}`);
    });
    console.log('');
  } else {
    // Write JSON data file first
    fs.writeFileSync(JSON_OUTPUT_FILE, JSON.stringify(prospectData, null, 0));
    console.log(`   ✅ Written JSON to ${JSON_OUTPUT_FILE}`);
    
    // Write TypeScript wrapper
    fs.writeFileSync(OUTPUT_FILE, output);
    console.log(`   ✅ Written to ${OUTPUT_FILE}\n`);
  }
  
  // 5. Summary
  console.log('📈 Summary:');
  console.log(`   Total Prospects: ${prospectData.length}`);
  console.log(`   With Email: ${emailsInOutput} (${((emailsInOutput / prospectData.length) * 100).toFixed(1)}%)`);
  console.log(`   Tier 1: ${prospectData.filter(p => p.tier === 'Tier 1').length}`);
  console.log(`   Tier 2: ${prospectData.filter(p => p.tier === 'Tier 2').length}`);
  console.log(`   Tier 3: ${prospectData.filter(p => p.tier === 'Tier 3').length}`);
  console.log(`   Qualified: ${prospectData.filter(p => p.qualified).length}`);
  console.log(`   Speakers: ${prospectData.filter(p => p.category === 'Speaker').length}`);
  console.log(`   Companies: ${companyTiers.size}`);
  console.log('\n✅ Done!');
}

generate();

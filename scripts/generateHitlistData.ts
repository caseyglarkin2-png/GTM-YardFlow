#!/usr/bin/env node
/**
 * Generate hitlistData.ts from Manifest CSV files
 * 
 * Parses:
 * - YardFlow_Manifest2026_Hitlist_v3.xlsx - People Hitlist (1).csv (5,408 people)
 * - YardFlow_Manifest2026_Hitlist_v3.xlsx - Company Hitlist (2).csv (2,652 companies)
 * - Manifest Contacts 2026 from App (1).xlsx - Speakers (Enriched).csv (220 speakers)
 * 
 * Outputs:
 * - src/data/hitlistData.ts with all prospects pre-loaded
 * 
 * Usage: node scripts/generateHitlistData.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const ROOT = path.join(__dirname, '..');
const PEOPLE_CSV = path.join(ROOT, 'YardFlow_Manifest2026_Hitlist_v3.xlsx - People Hitlist (1).csv');
const COMPANY_CSV = path.join(ROOT, 'YardFlow_Manifest2026_Hitlist_v3.xlsx - Company Hitlist (2).csv');
const OUTPUT_FILE = path.join(ROOT, 'src/data/hitlistData.ts');

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

// Main generator
function generate() {
  console.log('📊 Generating hitlistData.ts from Manifest CSVs...\n');

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

  // 2. Parse People CSV
  console.log('2️⃣ Parsing People Hitlist...');
  const peopleData = fs.readFileSync(PEOPLE_CSV, 'utf-8').replace(/\r/g, '');
  const peopleLines = peopleData.split('\n').filter(l => l.trim());
  
  const prospects: PersonRow[] = [];
  const seenIds = new Set<string>();
  
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
      });
    }
  }
  console.log(`   ✅ ${prospects.length} prospects loaded\n`);

  // 3. Generate TypeScript file
  console.log('3️⃣ Generating TypeScript...');
  
  // Build compact data array (JSON-like for performance)
  // Track seen IDs to ensure uniqueness
  const outputIds = new Set<string>();
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
    };
  });
  
  const output = `/**
 * YardFlow Manifest 2026 Hitlist Data
 * 
 * AUTO-GENERATED from CSV files - DO NOT EDIT MANUALLY
 * Generated: ${new Date().toISOString()}
 * 
 * Source files:
 * - YardFlow_Manifest2026_Hitlist_v3.xlsx - People Hitlist (1).csv
 * - YardFlow_Manifest2026_Hitlist_v3.xlsx - Company Hitlist (2).csv
 * 
 * To regenerate: npx tsx scripts/generateHitlistData.ts
 */

import type { Prospect } from '../types';

// Raw prospect data (loaded from CSV)
// Using JSON to avoid TypeScript union type complexity with 5400+ objects
const RAW_PROSPECTS = ${JSON.stringify(prospectData)} as const;

/**
 * Full Manifest 2026 Hitlist
 * Total: ${prospects.length} prospects
 */
export const HITLIST_PROSPECTS: Prospect[] = RAW_PROSPECTS.map(p => ({
  ...p,
  status: p.status as Prospect['status'],
  category: p.category as Prospect['category'],
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
  tier1: ${prospectData.filter(p => p.tier === 'Tier 1').length},
  tier2: ${prospectData.filter(p => p.tier === 'Tier 2').length},
  tier3: ${prospectData.filter(p => p.tier === 'Tier 3').length},
  qualified: ${prospectData.filter(p => p.qualified).length},
  speakers: ${prospectData.filter(p => p.category === 'Speaker').length},
  attendees: ${prospectData.filter(p => p.category === 'Attendee').length},
  companies: ${companyTiers.size},
};
`;

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`   ✅ Written to ${OUTPUT_FILE}\n`);
  
  // 4. Summary
  console.log('📈 Summary:');
  console.log(`   Total Prospects: ${prospectData.length}`);
  console.log(`   Tier 1: ${prospectData.filter(p => p.tier === 'Tier 1').length}`);
  console.log(`   Tier 2: ${prospectData.filter(p => p.tier === 'Tier 2').length}`);
  console.log(`   Tier 3: ${prospectData.filter(p => p.tier === 'Tier 3').length}`);
  console.log(`   Qualified: ${prospectData.filter(p => p.qualified).length}`);
  console.log(`   Speakers: ${prospectData.filter(p => p.category === 'Speaker').length}`);
  console.log(`   Companies: ${companyTiers.size}`);
  console.log('\n✅ Done!');
}

generate();

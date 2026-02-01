/**
 * EmailImportService - Import email addresses from CSV/XLSX files
 * 
 * Matches email addresses to existing prospects using:
 * 1. Strong match: Normalized full name + company
 * 2. Medium match: First + last + company domain
 * 3. Fallback: Exact name match
 * 
 * Returns matched prospects and unmatched rows for manual review.
 */

export interface ImportRow {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  email?: string;
  domain?: string;
  title?: string;
  linkedinUrl?: string;
  rawRow: Record<string, string>;
}

export interface MatchResult {
  prospectId: string;
  prospectName: string;
  prospectCompany: string;
  email: string;
  matchType: 'strong' | 'medium' | 'weak';
  confidence: number;
}

export interface ImportResult {
  matched: MatchResult[];
  unmatched: ImportRow[];
  stats: {
    totalRows: number;
    matchedCount: number;
    unmatchedCount: number;
    duplicateEmails: number;
  };
}

export interface ProspectForMatching {
  id: string;
  name: string;
  company: string;
  email?: string;
}

/**
 * Normalize a string for matching: lowercase, remove special chars, trim
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract domain from email
 */
function extractDomain(email: string): string {
  const match = email.match(/@([^@]+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.length === 0 || nb.length === 0) return 0;
  
  // Simple Levenshtein-based similarity
  const longer = na.length > nb.length ? na : nb;
  const shorter = na.length > nb.length ? nb : na;
  
  if (longer.includes(shorter)) return shorter.length / longer.length;
  
  // Count matching words
  const wordsA = na.split(' ');
  const wordsB = nb.split(' ');
  const matchingWords = wordsA.filter(w => wordsB.includes(w)).length;
  return matchingWords / Math.max(wordsA.length, wordsB.length);
}

/**
 * Parse CSV content into rows
 */
export function parseCSV(content: string): ImportRow[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  
  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim());
  
  // Map common column names
  const columnMap: Record<string, number> = {};
  const columnMappings: Record<string, string[]> = {
    fullName: ['full name', 'fullname', 'contact name'],
    firstName: ['first name', 'firstname'],
    lastName: ['last name', 'lastname'],
    company: ['company', 'company name', 'organization', 'employer'],
    email: ['email', 'email address', 'e-mail', 'work email', 'business email'],
    domain: ['domain', 'company domain', 'website'],
    title: ['title', 'job title', 'position', 'role'],
    linkedinUrl: ['linkedin', 'linkedin url', 'person linkedin url', 'profile url'],
  };
  
  for (const [field, aliases] of Object.entries(columnMappings)) {
    // Use exact match or startsWith to avoid partial matches like 'name' matching 'first name'
    const index = headers.findIndex(h => aliases.some(a => h === a || h.startsWith(a + ' ') || h.endsWith(' ' + a)));
    if (index !== -1) {
      columnMap[field] = index;
    }
  }
  
  // Also check for exact 'name' column (fallback for fullName)
  if (columnMap.fullName === undefined) {
    const nameIndex = headers.findIndex(h => h === 'name');
    if (nameIndex !== -1) {
      columnMap.fullName = nameIndex;
    }
  }
  
  // Parse data rows
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    
    const rawRow: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rawRow[h] = values[idx] || '';
    });
    
    const row: ImportRow = {
      rawRow,
      fullName: columnMap.fullName !== undefined ? values[columnMap.fullName]?.trim() : undefined,
      firstName: columnMap.firstName !== undefined ? values[columnMap.firstName]?.trim() : undefined,
      lastName: columnMap.lastName !== undefined ? values[columnMap.lastName]?.trim() : undefined,
      company: columnMap.company !== undefined ? values[columnMap.company]?.trim() : undefined,
      email: columnMap.email !== undefined ? values[columnMap.email]?.trim() : undefined,
      domain: columnMap.domain !== undefined ? values[columnMap.domain]?.trim() : undefined,
      title: columnMap.title !== undefined ? values[columnMap.title]?.trim() : undefined,
      linkedinUrl: columnMap.linkedinUrl !== undefined ? values[columnMap.linkedinUrl]?.trim() : undefined,
    };
    
    // Build full name from first + last if not present
    if (!row.fullName && row.firstName) {
      row.fullName = [row.firstName, row.lastName].filter(Boolean).join(' ');
    }
    
    // Only include rows with email
    if (row.email && row.email.includes('@')) {
      rows.push(row);
    }
  }
  
  return rows;
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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

/**
 * Match import rows to existing prospects
 */
export function matchEmailsToProspects(
  importRows: ImportRow[],
  prospects: ProspectForMatching[]
): ImportResult {
  const matched: MatchResult[] = [];
  const unmatched: ImportRow[] = [];
  const seenEmails = new Set<string>();
  let duplicateEmails = 0;
  
  for (const row of importRows) {
    if (!row.email) {
      unmatched.push(row);
      continue;
    }
    
    const email = row.email.toLowerCase().trim();
    
    // Skip duplicate emails
    if (seenEmails.has(email)) {
      duplicateEmails++;
      continue;
    }
    seenEmails.add(email);
    
    // Try to find matching prospect
    let bestMatch: { prospect: ProspectForMatching; type: 'strong' | 'medium' | 'weak'; confidence: number } | null = null;
    
    for (const prospect of prospects) {
      // Skip if prospect already has email
      if (prospect.email) continue;
      
      const importName = row.fullName || '';
      const importCompany = row.company || '';
      const importDomain = row.domain || extractDomain(email);
      
      // Strong match: Normalized name + company both match
      const nameSim = similarity(importName, prospect.name);
      const companySim = similarity(importCompany, prospect.company);
      
      if (nameSim >= 0.8 && companySim >= 0.7) {
        const confidence = (nameSim + companySim) / 2;
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { prospect, type: 'strong', confidence };
        }
        continue;
      }
      
      // Medium match: Name matches + domain matches company
      if (nameSim >= 0.7) {
        const prospectDomain = normalize(prospect.company).replace(/\s+/g, '');
        const importDomainNorm = normalize(importDomain).replace(/\.(com|org|net|io|co)$/, '');
        
        if (importDomainNorm.includes(prospectDomain) || prospectDomain.includes(importDomainNorm)) {
          const confidence = nameSim * 0.8;
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = { prospect, type: 'medium', confidence };
          }
          continue;
        }
      }
      
      // Weak match: Exact name match only
      if (nameSim >= 0.9) {
        const confidence = nameSim * 0.6;
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { prospect, type: 'weak', confidence };
        }
      }
    }
    
    if (bestMatch && bestMatch.confidence >= 0.5) {
      matched.push({
        prospectId: bestMatch.prospect.id,
        prospectName: bestMatch.prospect.name,
        prospectCompany: bestMatch.prospect.company,
        email,
        matchType: bestMatch.type,
        confidence: Math.round(bestMatch.confidence * 100),
      });
    } else {
      unmatched.push(row);
    }
  }
  
  return {
    matched,
    unmatched,
    stats: {
      totalRows: importRows.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      duplicateEmails,
    },
  };
}

/**
 * Export unmatched rows back to CSV for manual review
 */
export function exportUnmatchedToCSV(unmatched: ImportRow[]): string {
  if (unmatched.length === 0) return '';
  
  // Get all unique headers
  const headers = new Set<string>();
  unmatched.forEach(row => {
    Object.keys(row.rawRow).forEach(h => headers.add(h));
  });
  
  const headerArr = Array.from(headers);
  const lines = [headerArr.join(',')];
  
  for (const row of unmatched) {
    const values = headerArr.map(h => {
      const val = row.rawRow[h] || '';
      // Escape quotes and wrap in quotes if contains comma
      if (val.includes(',') || val.includes('"')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    lines.push(values.join(','));
  }
  
  return lines.join('\n');
}

/**
 * Read file as text (works for CSV and simple XLSX parsing)
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

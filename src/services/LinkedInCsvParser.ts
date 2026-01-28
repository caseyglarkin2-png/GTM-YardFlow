/**
 * LinkedIn Sales Navigator CSV Parser - YardFlow Hub
 * 
 * Parses LinkedIn Sales Navigator CSV exports and maps them to YardFlow prospects.
 * Handles various LinkedIn export formats and column naming variations.
 */

import { parseCsv, type ParsedRow } from './CsvParserService';
import type { CsvParseError } from '../types/marketing';
import type { Prospect } from '../types';

// ============================================
// Types
// ============================================

/**
 * LinkedIn Sales Navigator standard fields
 */
export interface LinkedInContact {
  firstName: string;
  lastName: string;
  fullName: string;
  title: string;
  company: string;
  location: string;
  connectionDegree: string;
  sharedConnections: number;
  linkedInUrl: string;
  email?: string;
  phone?: string;
  industry?: string;
  companySize?: string;
  tags?: string[];
  notes?: string;
  savedAt?: Date;
  listName?: string;
}

/**
 * Column mapping for LinkedIn CSV
 */
export interface LinkedInColumnMap {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  title?: string;
  company?: string;
  location?: string;
  connectionDegree?: string;
  sharedConnections?: string;
  linkedInUrl?: string;
  email?: string;
  phone?: string;
  industry?: string;
  companySize?: string;
  tags?: string;
  notes?: string;
  savedAt?: string;
  listName?: string;
}

/**
 * Parse result with LinkedIn contacts
 */
export interface LinkedInParseResult {
  contacts: LinkedInContact[];
  prospects: Partial<Prospect>[];
  errors: CsvParseError[];
  warnings: string[];
  rowCount: number;
  parsedCount: number;
  skippedCount: number;
  columnMap: LinkedInColumnMap;
}

/**
 * Import options
 */
export interface LinkedInImportOptions {
  /** Skip rows without company */
  requireCompany?: boolean;
  /** Skip rows without name */
  requireName?: boolean;
  /** Default tier for imported prospects */
  defaultTier?: string;
  /** Default status for imported prospects */
  defaultStatus?: Prospect['status'];
  /** Custom column mapping override */
  columnMap?: Partial<LinkedInColumnMap>;
  /** Tags to add to all imported prospects */
  importTags?: string[];
  /** Maximum rows to import */
  maxRows?: number;
}

// ============================================
// Column Aliases
// ============================================

/**
 * Known LinkedIn column name variations
 */
const LINKEDIN_COLUMN_ALIASES: Record<keyof LinkedInColumnMap, string[]> = {
  firstName: ['first name', 'firstname', 'first', 'given name', 'contact first name'],
  lastName: ['last name', 'lastname', 'last', 'surname', 'family name', 'contact last name'],
  fullName: ['full name', 'fullname', 'name', 'contact name', 'member'],
  title: ['title', 'job title', 'jobtitle', 'position', 'role', 'occupation', 'headline'],
  company: ['company', 'company name', 'companyname', 'organization', 'organization name', 'org', 'current company', 'employer'],
  location: ['location', 'geography', 'region', 'country', 'city', 'area'],
  connectionDegree: ['connection', 'degree', 'connection degree', 'relationship', '1st', '2nd', '3rd'],
  sharedConnections: ['shared connections', 'sharedconnections', 'mutual connections', 'connections in common'],
  linkedInUrl: ['linkedin url', 'linkedinurl', 'linkedin', 'profile url', 'profile link', 'url', 'person linkedin url'],
  email: ['email', 'email address', 'e-mail', 'contact email', 'work email'],
  phone: ['phone', 'phone number', 'mobile', 'telephone', 'cell'],
  industry: ['industry', 'sector', 'field'],
  companySize: ['company size', 'companysize', 'employees', 'employee count', 'size', 'headcount'],
  tags: ['tags', 'labels', 'lists', 'list name'],
  notes: ['notes', 'note', 'comments', 'description'],
  savedAt: ['saved at', 'savedat', 'date saved', 'added at', 'added on', 'created'],
  listName: ['list name', 'listname', 'list', 'saved list', 'lead list'],
};

// ============================================
// Core Parser Functions
// ============================================

/**
 * Auto-detect column mapping from headers
 */
export function detectLinkedInColumns(headers: string[]): LinkedInColumnMap {
  const mapping: LinkedInColumnMap = {};
  const usedHeaders = new Set<string>();

  // First pass: exact matches only
  for (const [field, aliases] of Object.entries(LINKEDIN_COLUMN_ALIASES)) {
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      
      const normalizedHeader = header.toLowerCase().trim();
      
      // Check exact match
      if (aliases.includes(normalizedHeader)) {
        mapping[field as keyof LinkedInColumnMap] = header;
        usedHeaders.add(header);
        break;
      }
    }
  }

  // Second pass: partial matches for unmapped fields
  for (const [field, aliases] of Object.entries(LINKEDIN_COLUMN_ALIASES)) {
    // Skip if already mapped
    if (mapping[field as keyof LinkedInColumnMap]) continue;
    
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      
      const normalizedHeader = header.toLowerCase().trim();
      
      // Check partial match
      const partialMatch = aliases.find(
        alias => normalizedHeader.includes(alias) || alias.includes(normalizedHeader)
      );
      
      if (partialMatch) {
        mapping[field as keyof LinkedInColumnMap] = header;
        usedHeaders.add(header);
        break;
      }
    }
  }

  return mapping;
}

/**
 * Parse a single row to LinkedInContact
 */
function parseLinkedInRow(
  row: ParsedRow,
  columnMap: LinkedInColumnMap,
  rowIndex: number
): { contact: LinkedInContact | null; errors: CsvParseError[] } {
  const errors: CsvParseError[] = [];
  
  const getValue = (field: keyof LinkedInColumnMap): string => {
    const column = columnMap[field];
    return column ? (row[column] || '').trim() : '';
  };

  const firstName = getValue('firstName');
  const lastName = getValue('lastName');
  const fullName = getValue('fullName') || `${firstName} ${lastName}`.trim();

  // Skip if no name
  if (!fullName) {
    errors.push({
      row: rowIndex + 2, // 1-indexed + header
      message: 'No name found in row',
      type: 'warning',
    });
    return { contact: null, errors };
  }

  // Parse shared connections
  const sharedConnectionsStr = getValue('sharedConnections');
  const sharedConnections = parseInt(sharedConnectionsStr, 10) || 0;

  // Parse saved date
  const savedAtStr = getValue('savedAt');
  let savedAt: Date | undefined;
  if (savedAtStr) {
    const parsed = new Date(savedAtStr);
    if (!isNaN(parsed.getTime())) {
      savedAt = parsed;
    }
  }

  // Parse tags
  const tagsStr = getValue('tags');
  const tags = tagsStr ? tagsStr.split(/[,;]/).map(t => t.trim()).filter(Boolean) : [];

  const contact: LinkedInContact = {
    firstName: firstName || extractFirstName(fullName),
    lastName: lastName || extractLastName(fullName),
    fullName,
    title: getValue('title'),
    company: getValue('company'),
    location: getValue('location'),
    connectionDegree: getValue('connectionDegree'),
    sharedConnections,
    linkedInUrl: normalizeLinkedInUrl(getValue('linkedInUrl')),
    email: getValue('email') || undefined,
    phone: getValue('phone') || undefined,
    industry: getValue('industry') || undefined,
    companySize: getValue('companySize') || undefined,
    tags: tags.length > 0 ? tags : undefined,
    notes: getValue('notes') || undefined,
    savedAt,
    listName: getValue('listName') || undefined,
  };

  return { contact, errors };
}

/**
 * Convert LinkedInContact to YardFlow Prospect
 */
export function linkedInContactToProspect(
  contact: LinkedInContact,
  options: LinkedInImportOptions = {}
): Partial<Prospect> {
  const {
    defaultTier = 'Tier 3',
    defaultStatus = 'new',
  } = options;

  // Determine ops/exec flags from title
  const titleLower = (contact.title || '').toLowerCase();
  const isOps = /supply\s*chain|logistics|operations|procurement|sourcing|warehouse|inventory|distribution/i.test(titleLower);
  const isExec = /^(ceo|cfo|coo|cpo|cso|cto|cio|chief|president|vp|vice president|svp|evp|director|head of|general manager|gm)\b/i.test(titleLower);

  return {
    id: generateProspectId(contact),
    name: contact.fullName,
    title: contact.title,
    company: contact.company,
    tier: defaultTier,
    score: calculateImportScore(contact),
    isOps,
    isExec,
    status: defaultStatus,
    notes: buildImportNotes(contact, options),
    country: contact.location,
  };
}

/**
 * Parse LinkedIn CSV content
 */
export function parseLinkedInCsv(
  content: string,
  options: LinkedInImportOptions = {}
): LinkedInParseResult {
  const {
    requireCompany = false,
    requireName = true,
    columnMap: customColumnMap,
    maxRows,
  } = options;

  // Parse raw CSV
  const rawResult = parseCsv(content, { maxRows });
  
  // Detect columns
  const headers = rawResult.data.length > 0 ? Object.keys(rawResult.data[0]) : [];
  const columnMap: LinkedInColumnMap = {
    ...detectLinkedInColumns(headers),
    ...customColumnMap,
  };

  // Check for required columns
  const warnings: string[] = [...rawResult.warnings];
  if (!columnMap.fullName && !columnMap.firstName && !columnMap.lastName) {
    warnings.push('No name column detected. Please map name columns manually.');
  }
  if (!columnMap.company) {
    warnings.push('No company column detected.');
  }

  // Parse rows
  const contacts: LinkedInContact[] = [];
  const prospects: Partial<Prospect>[] = [];
  const errors: CsvParseError[] = [...rawResult.errors];
  let skippedCount = 0;

  for (let i = 0; i < rawResult.data.length; i++) {
    const row = rawResult.data[i];
    const { contact, errors: rowErrors } = parseLinkedInRow(row, columnMap, i);
    errors.push(...rowErrors);

    if (!contact) {
      skippedCount++;
      continue;
    }

    // Skip if required fields missing
    if (requireName && !contact.fullName) {
      skippedCount++;
      errors.push({
        row: i + 2,
        message: 'Skipped: No name',
        type: 'warning',
      });
      continue;
    }

    if (requireCompany && !contact.company) {
      skippedCount++;
      errors.push({
        row: i + 2,
        message: 'Skipped: No company',
        type: 'warning',
      });
      continue;
    }

    contacts.push(contact);
    prospects.push(linkedInContactToProspect(contact, options));
  }

  return {
    contacts,
    prospects,
    errors,
    warnings,
    rowCount: rawResult.rowCount,
    parsedCount: contacts.length,
    skippedCount,
    columnMap,
  };
}

/**
 * Parse LinkedIn CSV from File object
 */
export async function parseLinkedInFile(
  file: File,
  options: LinkedInImportOptions = {}
): Promise<LinkedInParseResult> {
  // Read file content and parse with LinkedIn-specific logic
  const content = await readFileAsText(file);
  return parseLinkedInCsv(content, options);
}

/**
 * Validate LinkedIn CSV before import
 */
export function validateLinkedInCsv(content: string): {
  valid: boolean;
  headers: string[];
  columnMap: LinkedInColumnMap;
  missingRequired: string[];
  warnings: string[];
  previewRows: LinkedInContact[];
} {
  const rawResult = parseCsv(content, { maxRows: 5 });
  const headers = rawResult.data.length > 0 ? Object.keys(rawResult.data[0]) : [];
  const columnMap = detectLinkedInColumns(headers);
  
  const missingRequired: string[] = [];
  const warnings: string[] = [];

  // Check for name columns
  if (!columnMap.fullName && !columnMap.firstName) {
    missingRequired.push('Name (Full Name, First Name, or Last Name)');
  }

  // Recommended columns
  if (!columnMap.company) {
    warnings.push('Company column not found - company matching will be limited');
  }
  if (!columnMap.title) {
    warnings.push('Title column not found - persona detection may be less accurate');
  }
  if (!columnMap.linkedInUrl) {
    warnings.push('LinkedIn URL column not found - duplicate detection will use name/company only');
  }

  // Parse preview rows
  const previewRows: LinkedInContact[] = [];
  for (let i = 0; i < Math.min(5, rawResult.data.length); i++) {
    const { contact } = parseLinkedInRow(rawResult.data[i], columnMap, i);
    if (contact) {
      previewRows.push(contact);
    }
  }

  return {
    valid: missingRequired.length === 0,
    headers,
    columnMap,
    missingRequired,
    warnings,
    previewRows,
  };
}

/**
 * Get suggested column mappings with confidence scores
 */
export function getSuggestedMappings(headers: string[]): Array<{
  header: string;
  suggestedField: keyof LinkedInColumnMap | null;
  confidence: number;
  alternatives: Array<{ field: keyof LinkedInColumnMap; confidence: number }>;
}> {
  return headers.map(header => {
    const normalizedHeader = header.toLowerCase().trim();
    let bestMatch: { field: keyof LinkedInColumnMap; confidence: number } | null = null;
    const alternatives: Array<{ field: keyof LinkedInColumnMap; confidence: number }> = [];

    for (const [field, aliases] of Object.entries(LINKEDIN_COLUMN_ALIASES)) {
      // Check exact match
      if (aliases.includes(normalizedHeader)) {
        const match = { field: field as keyof LinkedInColumnMap, confidence: 1.0 };
        if (!bestMatch || match.confidence > bestMatch.confidence) {
          if (bestMatch) alternatives.push(bestMatch);
          bestMatch = match;
        } else {
          alternatives.push(match);
        }
        continue;
      }

      // Check partial match
      for (const alias of aliases) {
        if (normalizedHeader.includes(alias) || alias.includes(normalizedHeader)) {
          const similarity = calculateStringSimilarity(normalizedHeader, alias);
          const match = { field: field as keyof LinkedInColumnMap, confidence: similarity };
          if (!bestMatch || match.confidence > bestMatch.confidence) {
            if (bestMatch) alternatives.push(bestMatch);
            bestMatch = match;
          } else if (similarity > 0.3) {
            alternatives.push(match);
          }
          break;
        }
      }
    }

    return {
      header,
      suggestedField: bestMatch?.field || null,
      confidence: bestMatch?.confidence || 0,
      alternatives: alternatives.slice(0, 3),
    };
  });
}

// ============================================
// Helper Functions
// ============================================

/**
 * Extract first name from full name
 */
function extractFirstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[0] || '';
}

/**
 * Extract last name from full name
 */
function extractLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}

/**
 * Normalize LinkedIn URL to standard format
 */
function normalizeLinkedInUrl(url: string): string {
  if (!url) return '';
  
  let normalized = url.trim();
  
  // Remove query params and trailing slashes
  normalized = normalized
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
  
  // Already has full linkedin.com URL with protocol
  if (normalized.match(/^https?:\/\/.*linkedin\.com/i)) {
    return normalized;
  }
  
  // Has linkedin.com but no protocol
  if (normalized.includes('linkedin.com')) {
    return 'https://' + normalized.replace(/^\/+/, '');
  }
  
  // Is a path like /in/username
  if (normalized.startsWith('/in/')) {
    return `https://www.linkedin.com${normalized}`;
  }
  
  // Just a username (alphanumeric and hyphens only)
  if (normalized.match(/^[a-z0-9-]+$/i)) {
    return `https://www.linkedin.com/in/${normalized}`;
  }
  
  // Something else - just add protocol if missing
  if (!normalized.startsWith('http')) {
    normalized = 'https://' + normalized.replace(/^\/+/, '');
  }
  
  return normalized;
}

/**
 * Generate unique prospect ID from LinkedIn contact
 */
function generateProspectId(contact: LinkedInContact): string {
  // Use LinkedIn URL if available
  if (contact.linkedInUrl) {
    const match = contact.linkedInUrl.match(/\/in\/([^/]+)/);
    if (match) {
      return `li_${match[1]}`;
    }
  }
  
  // Fall back to name + company hash
  const base = `${contact.fullName}_${contact.company}`.toLowerCase().replace(/\s+/g, '_');
  return `import_${base}_${Date.now()}`;
}

/**
 * Calculate import score based on LinkedIn data
 */
function calculateImportScore(contact: LinkedInContact): number {
  let score = 0;
  
  // Title signals
  const titleLower = (contact.title || '').toLowerCase();
  if (/chief|ceo|cfo|coo|president/i.test(titleLower)) score += 30;
  else if (/vp|vice president|svp|evp/i.test(titleLower)) score += 25;
  else if (/director|head of/i.test(titleLower)) score += 20;
  else if (/manager|lead/i.test(titleLower)) score += 15;
  
  // Ops/Supply Chain signals
  if (/supply\s*chain|logistics|operations|procurement|sourcing|warehouse/i.test(titleLower)) {
    score += 20;
  }
  
  // Connection degree
  if (contact.connectionDegree === '1st' || contact.connectionDegree === '1') score += 10;
  else if (contact.connectionDegree === '2nd' || contact.connectionDegree === '2') score += 5;
  
  // Shared connections
  if (contact.sharedConnections > 10) score += 10;
  else if (contact.sharedConnections > 5) score += 5;
  
  // Has complete data
  if (contact.email) score += 10;
  if (contact.company) score += 5;
  
  return Math.min(100, score);
}

/**
 * Build import notes from LinkedIn data
 */
function buildImportNotes(contact: LinkedInContact, options: LinkedInImportOptions): string {
  const parts: string[] = [];
  
  if (contact.listName) {
    parts.push(`Imported from list: ${contact.listName}`);
  }
  
  if (contact.connectionDegree) {
    parts.push(`${contact.connectionDegree} connection`);
  }
  
  if (contact.sharedConnections > 0) {
    parts.push(`${contact.sharedConnections} shared connections`);
  }
  
  if (contact.industry) {
    parts.push(`Industry: ${contact.industry}`);
  }
  
  if (contact.notes) {
    parts.push(`Notes: ${contact.notes}`);
  }
  
  if (options.importTags && options.importTags.length > 0) {
    parts.push(`Tags: ${options.importTags.join(', ')}`);
  }
  
  parts.push(`Imported: ${new Date().toISOString().split('T')[0]}`);
  
  return parts.join(' | ');
}

/**
 * Calculate string similarity (Levenshtein-based)
 */
function calculateStringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0;
  
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  
  // Simple containment check
  if (longer.includes(shorter)) {
    return shorter.length / longer.length;
  }
  
  // Count matching characters
  let matches = 0;
  const shorterChars = shorter.split('');
  for (const char of shorterChars) {
    if (longer.includes(char)) matches++;
  }
  
  return matches / longer.length;
}

/**
 * Read file as text
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ============================================
// Export
// ============================================

export const LinkedInCsvParser = {
  parse: parseLinkedInCsv,
  parseFile: parseLinkedInFile,
  validate: validateLinkedInCsv,
  detectColumns: detectLinkedInColumns,
  getSuggestedMappings,
  contactToProspect: linkedInContactToProspect,
  normalizeUrl: normalizeLinkedInUrl,
};

export default LinkedInCsvParser;

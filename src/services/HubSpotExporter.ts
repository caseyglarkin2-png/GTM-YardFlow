/**
 * HubSpot Exporter Service - YardFlow Hub
 * 
 * Exports segmented prospects to HubSpot-ready CSV format.
 */

import type { EnrichedPerson, HubSpotContact } from '../types/marketing';

// ============================================
// Types
// ============================================

export interface ExportOptions {
  /** Include sequence data in export */
  includeSequences?: boolean;
  /** Include custom YardFlow properties */
  includeCustomProps?: boolean;
  /** Lead status to assign */
  leadStatus?: string;
  /** Segment name for filename */
  segmentName?: string;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  rowCount: number;
  skippedCount: number;
  blob: Blob;
  errors: string[];
}

// ============================================
// Name Splitting
// ============================================

/**
 * Intelligently split full name into first and last
 */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  
  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }
  
  // Handle special cases
  const parts = trimmed.split(/\s+/);
  
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  
  if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] };
  }
  
  // 3+ parts: assume last word is last name, rest is first
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ');
  
  return { firstName, lastName };
}

/**
 * Determine persona string from flags
 */
function getPersonaString(person: EnrichedPerson): string {
  const personas: string[] = [];
  
  if (person.isExecOps) personas.push('ExecOps');
  else {
    if (person.isExec) personas.push('Exec');
    if (person.isOps) personas.push('Ops');
  }
  if (person.isProc) personas.push('Proc');
  if (person.isSales) personas.push('Sales');
  if (person.isTech) personas.push('Tech');
  
  return personas.join(', ') || 'Unknown';
}

// ============================================
// CSV Generation
// ============================================

/**
 * Convert prospect to HubSpot contact row
 */
export function toHubSpotContact(
  person: EnrichedPerson,
  options: ExportOptions = {}
): HubSpotContact | null {
  // Email is required for HubSpot import
  if (!person.email || person.email.trim() === '') {
    return null;
  }
  
  const { firstName, lastName } = splitName(person.name);
  
  const contact: HubSpotContact = {
    Email: person.email,
    'First Name': firstName,
    'Last Name': lastName,
    Company: person.company,
    'Job Title': person.jobTitle,
    'Lead Status': options.leadStatus || 'NEW',
  };
  
  // Add custom YardFlow properties if requested
  if (options.includeCustomProps !== false) {
    contact.yf_persona = getPersonaString(person);
    contact.yf_score = person.personScore;
    contact.yf_category = person.category;
    
    if (person.linkedinUrl) {
      contact.yf_linkedin_url = person.linkedinUrl;
    }
    
    if (person.sequenceId) {
      contact.yf_sequence_id = person.sequenceId;
    }
  }
  
  return contact;
}

/**
 * Escape a CSV value
 */
function escapeCSV(value: string | number | undefined): string {
  if (value === undefined || value === null) {
    return '';
  }
  
  const str = String(value);
  
  // If contains comma, quote, or newline, wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

/**
 * Generate CSV content from contacts
 */
function generateCSV(contacts: HubSpotContact[]): string {
  if (contacts.length === 0) {
    return '';
  }
  
  // Get all unique keys
  const allKeys = new Set<string>();
  contacts.forEach((c) => Object.keys(c).forEach((k) => allKeys.add(k)));
  const headers = Array.from(allKeys);
  
  // Build CSV
  const lines: string[] = [];
  
  // Header row
  lines.push(headers.map(escapeCSV).join(','));
  
  // Data rows
  for (const contact of contacts) {
    const row = headers.map((h) => escapeCSV((contact as Record<string, unknown>)[h] as string | number | undefined));
    lines.push(row.join(','));
  }
  
  return lines.join('\n');
}

// ============================================
// Export Functions
// ============================================

/**
 * Export prospects to HubSpot-ready CSV
 */
export function exportToHubSpot(
  prospects: EnrichedPerson[],
  options: ExportOptions = {}
): ExportResult {
  const errors: string[] = [];
  const contacts: HubSpotContact[] = [];
  let skippedCount = 0;
  
  // Convert prospects to contacts
  for (const prospect of prospects) {
    const contact = toHubSpotContact(prospect, options);
    
    if (contact) {
      contacts.push(contact);
    } else {
      skippedCount++;
    }
  }
  
  // Validate we have exportable data
  if (contacts.length === 0) {
    return {
      success: false,
      filename: '',
      rowCount: 0,
      skippedCount: prospects.length,
      blob: new Blob([]),
      errors: ['No contacts with valid email addresses to export'],
    };
  }
  
  // Generate CSV
  const csvContent = generateCSV(contacts);
  
  // Add UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
  
  // Generate filename
  const date = new Date().toISOString().split('T')[0];
  const segment = options.segmentName?.replace(/[^a-z0-9]/gi, '_') || 'export';
  const filename = `hubspot_${segment}_${date}.csv`;
  
  return {
    success: true,
    filename,
    rowCount: contacts.length,
    skippedCount,
    blob,
    errors,
  };
}

/**
 * Trigger download of export
 */
export function downloadExport(result: ExportResult): void {
  if (!result.success) {
    console.error('Cannot download failed export:', result.errors);
    return;
  }
  
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validate prospects before export
 */
export function validateForExport(prospects: EnrichedPerson[]): {
  valid: boolean;
  exportableCount: number;
  missingEmailCount: number;
  warnings: string[];
} {
  let exportableCount = 0;
  let missingEmailCount = 0;
  const warnings: string[] = [];
  
  for (const p of prospects) {
    if (p.email && p.email.trim() !== '') {
      exportableCount++;
    } else {
      missingEmailCount++;
    }
  }
  
  if (exportableCount === 0) {
    warnings.push('No prospects have email addresses. Export will be empty.');
  } else if (missingEmailCount > 0) {
    warnings.push(`${missingEmailCount} prospects will be skipped (no email).`);
  }
  
  return {
    valid: exportableCount > 0,
    exportableCount,
    missingEmailCount,
    warnings,
  };
}

/**
 * LinkedIn CSV Parser Tests
 * 
 * Tests for parsing LinkedIn Sales Navigator CSV exports
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseLinkedInCsv,
  detectLinkedInColumns,
  validateLinkedInCsv,
  getSuggestedMappings,
  linkedInContactToProspect,
  LinkedInCsvParser,
  type LinkedInContact,
  type LinkedInImportOptions,
} from '../../services/LinkedInCsvParser';

// ============================================
// Test Data
// ============================================

const SAMPLE_CSV_STANDARD = `First Name,Last Name,Title,Company,Location,Connection,LinkedIn URL
John,Doe,VP of Supply Chain,Acme Corp,New York,1st,https://linkedin.com/in/johndoe
Jane,Smith,Director of Operations,Tech Inc,San Francisco,2nd,https://linkedin.com/in/janesmith
Bob,Johnson,Procurement Manager,Global Ltd,Chicago,3rd,https://linkedin.com/in/bobjohnson`;

const SAMPLE_CSV_FULL_NAME = `Full Name,Job Title,Company Name,Geography,Profile URL
Mary Jane Watson,Chief Procurement Officer,Parker Industries,Boston,https://linkedin.com/in/mjwatson
Peter Parker,VP Logistics,Daily Bugle,New York,https://linkedin.com/in/peterparker`;

const SAMPLE_CSV_SALES_NAV = `Member,Headline,Current Company,Country,Person Linkedin Url,Shared Connections
Tony Stark,CEO & Founder,Stark Industries,USA,linkedin.com/in/tonystark,25
Bruce Wayne,Chairman,Wayne Enterprises,USA,linkedin.com/in/brucewayne,15`;

const SAMPLE_CSV_MINIMAL = `Name,Company
Alice Brown,Corp A
Charlie Davis,Corp B`;

const SAMPLE_CSV_WITH_EXTRAS = `First Name,Last Name,Title,Company,Email,Phone,Industry,Notes,Tags
Eva,Green,Head of Sourcing,Mega Corp,eva@mega.com,555-1234,Manufacturing,Met at conference,Prospect;Hot Lead
Frank,White,Operations Director,Small Co,frank@small.co,,Retail,Follow up in Q2,`;

const SAMPLE_CSV_EMPTY_ROWS = `First Name,Last Name,Title,Company
Test,User,Manager,Test Co

,,
Another,Person,Director,Another Co`;

const SAMPLE_CSV_MALFORMED = `First Name,Last Name,Title,Company
Only,Three,Fields`;

// ============================================
// Column Detection Tests
// ============================================

describe('LinkedInCsvParser - Column Detection', () => {
  it('should detect standard LinkedIn column names', () => {
    const headers = ['First Name', 'Last Name', 'Title', 'Company', 'Location', 'LinkedIn URL'];
    const mapping = detectLinkedInColumns(headers);
    
    expect(mapping.firstName).toBe('First Name');
    expect(mapping.lastName).toBe('Last Name');
    expect(mapping.title).toBe('Title');
    expect(mapping.company).toBe('Company');
    expect(mapping.location).toBe('Location');
    expect(mapping.linkedInUrl).toBe('LinkedIn URL');
  });

  it('should detect alternative column names', () => {
    const headers = ['Full Name', 'Job Title', 'Company Name', 'Geography', 'Profile URL'];
    const mapping = detectLinkedInColumns(headers);
    
    expect(mapping.fullName).toBe('Full Name');
    expect(mapping.title).toBe('Job Title');
    expect(mapping.company).toBe('Company Name');
    expect(mapping.location).toBe('Geography');
    expect(mapping.linkedInUrl).toBe('Profile URL');
  });

  it('should detect Sales Navigator specific columns', () => {
    const headers = ['Member', 'Headline', 'Current Company', 'Person Linkedin Url', 'Shared Connections'];
    const mapping = detectLinkedInColumns(headers);
    
    expect(mapping.fullName).toBe('Member');
    expect(mapping.title).toBe('Headline');
    expect(mapping.company).toBe('Current Company');
    expect(mapping.linkedInUrl).toBe('Person Linkedin Url');
    expect(mapping.sharedConnections).toBe('Shared Connections');
  });

  it('should handle case-insensitive matching', () => {
    const headers = ['FIRST NAME', 'last name', 'COMPANY'];
    const mapping = detectLinkedInColumns(headers);
    
    expect(mapping.firstName).toBe('FIRST NAME');
    expect(mapping.lastName).toBe('last name');
    expect(mapping.company).toBe('COMPANY');
  });

  it('should handle partial matches', () => {
    const headers = ['Contact First Name', 'Contact Last Name', 'Organization Name'];
    const mapping = detectLinkedInColumns(headers);
    
    // Partial matches should work
    expect(mapping.firstName).toBe('Contact First Name');
    expect(mapping.lastName).toBe('Contact Last Name');
    expect(mapping.company).toBe('Organization Name');
  });

  it('should not duplicate mappings', () => {
    const headers = ['Name', 'Full Name', 'Contact Name'];
    const mapping = detectLinkedInColumns(headers);
    
    // Should only map one column to fullName
    const mappedValues = Object.values(mapping);
    const uniqueValues = new Set(mappedValues);
    expect(mappedValues.length).toBe(uniqueValues.size);
  });
});

// ============================================
// CSV Parsing Tests
// ============================================

describe('LinkedInCsvParser - CSV Parsing', () => {
  it('should parse standard LinkedIn CSV', () => {
    const result = parseLinkedInCsv(SAMPLE_CSV_STANDARD);
    
    expect(result.contacts).toHaveLength(3);
    expect(result.prospects).toHaveLength(3);
    expect(result.parsedCount).toBe(3);
    expect(result.errors).toHaveLength(0);
  });

  it('should parse full name format', () => {
    const result = parseLinkedInCsv(SAMPLE_CSV_FULL_NAME);
    
    expect(result.contacts).toHaveLength(2);
    expect(result.contacts[0].fullName).toBe('Mary Jane Watson');
    expect(result.contacts[0].title).toBe('Chief Procurement Officer');
    expect(result.contacts[0].company).toBe('Parker Industries');
  });

  it('should combine first and last name', () => {
    const result = parseLinkedInCsv(SAMPLE_CSV_STANDARD);
    
    expect(result.contacts[0].fullName).toBe('John Doe');
    expect(result.contacts[0].firstName).toBe('John');
    expect(result.contacts[0].lastName).toBe('Doe');
  });

  it('should extract first/last name from full name', () => {
    const result = parseLinkedInCsv(SAMPLE_CSV_FULL_NAME);
    
    expect(result.contacts[0].firstName).toBe('Mary');
    expect(result.contacts[0].lastName).toBe('Jane Watson');
  });

  it('should normalize LinkedIn URLs', () => {
    const result = parseLinkedInCsv(SAMPLE_CSV_SALES_NAV);
    
    // URLs with linkedin.com should be normalized with https but not add www
    expect(result.contacts[0].linkedInUrl).toBe('https://linkedin.com/in/tonystark');
    expect(result.contacts[1].linkedInUrl).toBe('https://linkedin.com/in/brucewayne');
  });

  it('should parse shared connections', () => {
    const result = parseLinkedInCsv(SAMPLE_CSV_SALES_NAV);
    
    expect(result.contacts[0].sharedConnections).toBe(25);
    expect(result.contacts[1].sharedConnections).toBe(15);
  });

  it('should parse email and phone', () => {
    const result = parseLinkedInCsv(SAMPLE_CSV_WITH_EXTRAS);
    
    expect(result.contacts[0].email).toBe('eva@mega.com');
    expect(result.contacts[0].phone).toBe('555-1234');
    expect(result.contacts[1].email).toBe('frank@small.co');
    expect(result.contacts[1].phone).toBeUndefined();
  });

  it('should parse tags as array', () => {
    const result = parseLinkedInCsv(SAMPLE_CSV_WITH_EXTRAS);
    
    expect(result.contacts[0].tags).toEqual(['Prospect', 'Hot Lead']);
    expect(result.contacts[1].tags).toBeUndefined();
  });

  it('should skip empty rows', () => {
    const result = parseLinkedInCsv(SAMPLE_CSV_EMPTY_ROWS);
    
    expect(result.contacts).toHaveLength(2);
    expect(result.contacts[0].fullName).toBe('Test User');
    expect(result.contacts[1].fullName).toBe('Another Person');
  });

  it('should handle minimal CSV', () => {
    const result = parseLinkedInCsv(SAMPLE_CSV_MINIMAL);
    
    expect(result.contacts).toHaveLength(2);
    expect(result.contacts[0].fullName).toBe('Alice Brown');
    expect(result.contacts[0].company).toBe('Corp A');
  });

  it('should report row count and parsed count', () => {
    const result = parseLinkedInCsv(SAMPLE_CSV_STANDARD);
    
    expect(result.rowCount).toBeGreaterThan(0);
    expect(result.parsedCount).toBe(result.contacts.length);
  });

  it('should respect maxRows option', () => {
    const result = parseLinkedInCsv(SAMPLE_CSV_STANDARD, { maxRows: 1 });
    
    expect(result.contacts.length).toBeLessThanOrEqual(1);
  });

  it('should apply custom column mapping', () => {
    const csv = `Custom Name,Custom Company
Test Person,Test Corp`;
    
    const result = parseLinkedInCsv(csv, {
      columnMap: {
        fullName: 'Custom Name',
        company: 'Custom Company',
      },
    });
    
    expect(result.contacts[0].fullName).toBe('Test Person');
    expect(result.contacts[0].company).toBe('Test Corp');
  });
});

// ============================================
// Import Options Tests
// ============================================

describe('LinkedInCsvParser - Import Options', () => {
  it('should skip rows without company when requireCompany=true', () => {
    const csv = `Name,Company
With Company,Acme Corp
No Company,`;
    
    const result = parseLinkedInCsv(csv, { requireCompany: true });
    
    expect(result.contacts).toHaveLength(1);
    expect(result.contacts[0].fullName).toBe('With Company');
    expect(result.skippedCount).toBe(1);
  });

  it('should include rows without company when requireCompany=false', () => {
    const csv = `Name,Company
With Company,Acme Corp
No Company,`;
    
    const result = parseLinkedInCsv(csv, { requireCompany: false });
    
    expect(result.contacts).toHaveLength(2);
  });

  it('should apply default tier', () => {
    const result = parseLinkedInCsv(SAMPLE_CSV_MINIMAL, { defaultTier: 'Tier 1' });
    
    expect(result.prospects[0].tier).toBe('Tier 1');
    expect(result.prospects[1].tier).toBe('Tier 1');
  });

  it('should apply default status', () => {
    const result = parseLinkedInCsv(SAMPLE_CSV_MINIMAL, { defaultStatus: 'contacted' });
    
    expect(result.prospects[0].status).toBe('contacted');
    expect(result.prospects[1].status).toBe('contacted');
  });

  it('should add import tags to notes', () => {
    const result = parseLinkedInCsv(SAMPLE_CSV_MINIMAL, { importTags: ['LinkedIn', 'Q1 2024'] });
    
    expect(result.prospects[0].notes).toContain('Tags: LinkedIn, Q1 2024');
  });
});

// ============================================
// Prospect Conversion Tests
// ============================================

describe('LinkedInCsvParser - Prospect Conversion', () => {
  const baseContact: LinkedInContact = {
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    title: 'VP of Supply Chain',
    company: 'Acme Corp',
    location: 'New York',
    connectionDegree: '1st',
    sharedConnections: 10,
    linkedInUrl: 'https://linkedin.com/in/johndoe',
  };

  it('should convert LinkedIn contact to prospect', () => {
    const prospect = linkedInContactToProspect(baseContact);
    
    expect(prospect.name).toBe('John Doe');
    expect(prospect.title).toBe('VP of Supply Chain');
    expect(prospect.company).toBe('Acme Corp');
    expect(prospect.country).toBe('New York');
  });

  it('should detect ops persona from title', () => {
    const opsContact: LinkedInContact = {
      ...baseContact,
      title: 'Director of Logistics',
    };
    
    const prospect = linkedInContactToProspect(opsContact);
    expect(prospect.isOps).toBe(true);
  });

  it('should detect exec persona from title', () => {
    const execContact: LinkedInContact = {
      ...baseContact,
      title: 'Chief Procurement Officer',
    };
    
    const prospect = linkedInContactToProspect(execContact);
    expect(prospect.isExec).toBe(true);
    expect(prospect.isOps).toBe(true);
  });

  it('should calculate score based on title seniority', () => {
    const ceoContact: LinkedInContact = { ...baseContact, title: 'CEO' };
    const managerContact: LinkedInContact = { ...baseContact, title: 'Manager' };
    
    const ceoProspect = linkedInContactToProspect(ceoContact);
    const managerProspect = linkedInContactToProspect(managerContact);
    
    expect(ceoProspect.score).toBeGreaterThan(managerProspect.score!);
  });

  it('should include connection info in notes', () => {
    const prospect = linkedInContactToProspect(baseContact);
    
    expect(prospect.notes).toContain('1st connection');
    expect(prospect.notes).toContain('10 shared connections');
  });

  it('should generate ID from LinkedIn URL', () => {
    const prospect = linkedInContactToProspect(baseContact);
    
    expect(prospect.id).toBe('li_johndoe');
  });

  it('should generate fallback ID when no LinkedIn URL', () => {
    const contactNoUrl: LinkedInContact = {
      ...baseContact,
      linkedInUrl: '',
    };
    
    const prospect = linkedInContactToProspect(contactNoUrl);
    
    expect(prospect.id).toContain('import_');
    expect(prospect.id).toContain('john_doe_acme_corp');
  });
});

// ============================================
// Validation Tests
// ============================================

describe('LinkedInCsvParser - Validation', () => {
  it('should validate CSV with all required columns', () => {
    const result = validateLinkedInCsv(SAMPLE_CSV_STANDARD);
    
    expect(result.valid).toBe(true);
    expect(result.missingRequired).toHaveLength(0);
    expect(result.headers.length).toBeGreaterThan(0);
  });

  it('should detect missing name column', () => {
    const csv = `Company,Title
Acme Corp,Manager`;
    
    const result = validateLinkedInCsv(csv);
    
    expect(result.valid).toBe(false);
    expect(result.missingRequired).toContain('Name (Full Name, First Name, or Last Name)');
  });

  it('should warn about missing company column', () => {
    const csv = `Name,Title
John Doe,Manager`;
    
    const result = validateLinkedInCsv(csv);
    
    expect(result.valid).toBe(true); // Company is recommended, not required
    expect(result.warnings.some(w => w.includes('Company'))).toBe(true);
  });

  it('should warn about missing LinkedIn URL', () => {
    const csv = `Name,Company
John Doe,Acme`;
    
    const result = validateLinkedInCsv(csv);
    
    expect(result.warnings.some(w => w.includes('LinkedIn URL'))).toBe(true);
  });

  it('should return column mapping', () => {
    const result = validateLinkedInCsv(SAMPLE_CSV_STANDARD);
    
    expect(result.columnMap).toBeDefined();
    expect(result.columnMap.firstName).toBe('First Name');
  });

  it('should return preview rows', () => {
    const result = validateLinkedInCsv(SAMPLE_CSV_STANDARD);
    
    expect(result.previewRows.length).toBeGreaterThan(0);
    expect(result.previewRows.length).toBeLessThanOrEqual(5);
    expect(result.previewRows[0].fullName).toBe('John Doe');
  });
});

// ============================================
// Suggested Mappings Tests
// ============================================

describe('LinkedInCsvParser - Suggested Mappings', () => {
  it('should suggest mappings with confidence scores', () => {
    const headers = ['First Name', 'Last Name', 'Unknown Column'];
    const suggestions = getSuggestedMappings(headers);
    
    expect(suggestions).toHaveLength(3);
    expect(suggestions[0].suggestedField).toBe('firstName');
    expect(suggestions[0].confidence).toBe(1.0);
    expect(suggestions[1].suggestedField).toBe('lastName');
    expect(suggestions[1].confidence).toBe(1.0);
  });

  it('should return null for unknown columns', () => {
    const headers = ['Random Column', 'XYZ123'];
    const suggestions = getSuggestedMappings(headers);
    
    expect(suggestions[0].suggestedField).toBeNull();
    expect(suggestions[0].confidence).toBe(0);
  });

  it('should provide alternative mappings', () => {
    const headers = ['Name']; // Could be fullName or firstName
    const suggestions = getSuggestedMappings(headers);
    
    expect(suggestions[0].suggestedField).toBeDefined();
    // Alternatives should include other possible mappings
  });

  it('should handle partial matches with lower confidence', () => {
    const headers = ['Contact First Name'];
    const suggestions = getSuggestedMappings(headers);
    
    expect(suggestions[0].suggestedField).toBe('firstName');
    expect(suggestions[0].confidence).toBeGreaterThan(0);
    expect(suggestions[0].confidence).toBeLessThanOrEqual(1.0);
  });
});

// ============================================
// URL Normalization Tests
// ============================================

describe('LinkedInCsvParser - URL Normalization', () => {
  it('should normalize URL without protocol', () => {
    const normalized = LinkedInCsvParser.normalizeUrl('linkedin.com/in/johndoe');
    expect(normalized).toBe('https://linkedin.com/in/johndoe');
  });

  it('should normalize URL with www', () => {
    const normalized = LinkedInCsvParser.normalizeUrl('www.linkedin.com/in/johndoe');
    expect(normalized).toBe('https://www.linkedin.com/in/johndoe');
  });

  it('should keep https URL as-is', () => {
    const normalized = LinkedInCsvParser.normalizeUrl('https://linkedin.com/in/johndoe');
    expect(normalized).toBe('https://linkedin.com/in/johndoe');
  });

  it('should remove trailing slashes', () => {
    const normalized = LinkedInCsvParser.normalizeUrl('https://linkedin.com/in/johndoe/');
    expect(normalized).toBe('https://linkedin.com/in/johndoe');
  });

  it('should remove query parameters', () => {
    const normalized = LinkedInCsvParser.normalizeUrl('https://linkedin.com/in/johndoe?utm_source=test');
    expect(normalized).toBe('https://linkedin.com/in/johndoe');
  });

  it('should handle username only', () => {
    const normalized = LinkedInCsvParser.normalizeUrl('johndoe');
    expect(normalized).toBe('https://www.linkedin.com/in/johndoe');
  });

  it('should handle path only', () => {
    const normalized = LinkedInCsvParser.normalizeUrl('/in/johndoe');
    expect(normalized).toBe('https://www.linkedin.com/in/johndoe');
  });

  it('should return empty string for empty input', () => {
    const normalized = LinkedInCsvParser.normalizeUrl('');
    expect(normalized).toBe('');
  });
});

// ============================================
// Export Interface Tests
// ============================================

describe('LinkedInCsvParser - Export Interface', () => {
  it('should export parse function', () => {
    expect(LinkedInCsvParser.parse).toBeDefined();
    expect(typeof LinkedInCsvParser.parse).toBe('function');
  });

  it('should export validate function', () => {
    expect(LinkedInCsvParser.validate).toBeDefined();
    expect(typeof LinkedInCsvParser.validate).toBe('function');
  });

  it('should export detectColumns function', () => {
    expect(LinkedInCsvParser.detectColumns).toBeDefined();
    expect(typeof LinkedInCsvParser.detectColumns).toBe('function');
  });

  it('should export getSuggestedMappings function', () => {
    expect(LinkedInCsvParser.getSuggestedMappings).toBeDefined();
    expect(typeof LinkedInCsvParser.getSuggestedMappings).toBe('function');
  });

  it('should export contactToProspect function', () => {
    expect(LinkedInCsvParser.contactToProspect).toBeDefined();
    expect(typeof LinkedInCsvParser.contactToProspect).toBe('function');
  });

  it('should export normalizeUrl function', () => {
    expect(LinkedInCsvParser.normalizeUrl).toBeDefined();
    expect(typeof LinkedInCsvParser.normalizeUrl).toBe('function');
  });
});

// ============================================
// Edge Cases
// ============================================

describe('LinkedInCsvParser - Edge Cases', () => {
  it('should handle CSV with BOM character', () => {
    const csvWithBom = '\uFEFFName,Company\nJohn,Acme';
    const result = parseLinkedInCsv(csvWithBom);
    
    expect(result.contacts).toHaveLength(1);
    expect(result.warnings.some(w => w.includes('BOM'))).toBe(true);
  });

  it('should handle quoted fields with commas', () => {
    const csv = `Name,Company
"Doe, John","Acme, Inc."`;
    
    const result = parseLinkedInCsv(csv);
    
    expect(result.contacts[0].fullName).toBe('Doe, John');
    expect(result.contacts[0].company).toBe('Acme, Inc.');
  });

  it('should handle newlines in quoted fields', () => {
    const csv = `Name,Notes
John,"Line 1
Line 2"`;
    
    const result = parseLinkedInCsv(csv);
    
    expect(result.contacts[0].notes).toContain('Line 1');
    expect(result.contacts[0].notes).toContain('Line 2');
  });

  it('should handle special characters in names', () => {
    const csv = `Name,Company
José García,Açaí Corp
François Müller,Über Inc`;
    
    const result = parseLinkedInCsv(csv);
    
    expect(result.contacts[0].fullName).toBe('José García');
    expect(result.contacts[1].fullName).toBe('François Müller');
  });

  it('should handle very long fields', () => {
    const longTitle = 'Senior Vice President of Global Supply Chain Operations and Strategic Procurement';
    const csv = `Name,Title
John Doe,${longTitle}`;
    
    const result = parseLinkedInCsv(csv);
    
    expect(result.contacts[0].title).toBe(longTitle);
  });

  it('should handle empty CSV', () => {
    const result = parseLinkedInCsv('');
    
    expect(result.contacts).toHaveLength(0);
    expect(result.parsedCount).toBe(0);
  });

  it('should handle header-only CSV', () => {
    const csv = 'Name,Company,Title';
    const result = parseLinkedInCsv(csv);
    
    expect(result.contacts).toHaveLength(0);
    expect(result.parsedCount).toBe(0);
  });
});

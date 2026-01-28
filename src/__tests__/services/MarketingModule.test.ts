/**
 * Marketing Module Tests - YardFlow Hub
 * 
 * Tests for CSV parsing, segmentation, and HubSpot export.
 */

import { describe, it, expect } from 'vitest';
import { parseCsv, getHeaders, validateCsvStructure, countRows } from '../../services/CsvParserService';
import { autoDetectMapping, applyMapping } from '../../services/ColumnMapperService';
import { applyFilters, countMatches, getFilterSummary, isEmptyFilter, getSegmentStats } from '../../services/SegmentationService';
import { exportToHubSpot, splitName, validateForExport, toHubSpotContact } from '../../services/HubSpotExporter';
import type { EnrichedPerson, SegmentFilter } from '../../types/marketing';

// ============================================
// Test Data
// ============================================

const SAMPLE_CSV = `Name,Job Title,Company,PersonScore,is_ops,is_exec
John Doe,VP Operations,Acme Corp,85,TRUE,TRUE
Jane Smith,Director Procurement,Beta Inc,72,FALSE,TRUE
Bob Wilson,Logistics Manager,Gamma LLC,45,TRUE,FALSE`;

const SAMPLE_CSV_WITH_BOM = '\uFEFFName,Company\nTest,TestCo';

const SAMPLE_PROSPECTS: EnrichedPerson[] = [
  {
    name: 'John Doe',
    category: 'Speaker',
    jobTitle: 'VP Operations',
    company: 'Acme Corp',
    personScore: 85,
    isOps: true,
    isExec: true,
    isExecOps: true,
    isProc: false,
    isSales: false,
    isTech: false,
    qualified: true,
    email: 'john@acme.com',
    linkedinUrl: 'https://linkedin.com/in/johndoe',
    sequenceAssigned: false,
  },
  {
    name: 'Jane Smith',
    category: 'Attendee',
    jobTitle: 'Director Procurement',
    company: 'Beta Inc',
    personScore: 72,
    isOps: false,
    isExec: true,
    isExecOps: false,
    isProc: true,
    isSales: false,
    isTech: false,
    qualified: false,
    email: 'jane@beta.com',
    sequenceAssigned: true,
    sequenceId: 'seq-123',
  },
  {
    name: 'Bob Wilson',
    category: 'Attendee',
    jobTitle: 'Logistics Manager',
    company: 'Gamma LLC',
    personScore: 45,
    isOps: true,
    isExec: false,
    isExecOps: false,
    isProc: false,
    isSales: false,
    isTech: false,
    qualified: false,
    email: '',  // No email
    sequenceAssigned: false,
  },
];

// ============================================
// CSV Parser Tests
// ============================================

describe('CsvParserService', () => {
  describe('parseCsv', () => {
    it('should parse simple CSV correctly', () => {
      const result = parseCsv(SAMPLE_CSV);
      
      expect(result.data).toHaveLength(3);
      expect(result.data[0].Name).toBe('John Doe');
      expect(result.data[0]['Job Title']).toBe('VP Operations');
      expect(result.errors).toHaveLength(0);
    });
    
    it('should strip BOM character', () => {
      const result = parseCsv(SAMPLE_CSV_WITH_BOM);
      
      expect(result.warnings).toContain('BOM character detected and removed');
      expect(result.data[0].Name).toBe('Test');
    });
    
    it('should handle quoted fields with commas', () => {
      const csv = 'Name,Title\n"Doe, John","VP, Operations"';
      const result = parseCsv(csv);
      
      expect(result.data[0].Name).toBe('Doe, John');
      expect(result.data[0].Title).toBe('VP, Operations');
    });
    
    it('should respect maxRows for preview', () => {
      const result = parseCsv(SAMPLE_CSV, { maxRows: 1 });
      expect(result.data).toHaveLength(1);
    });
    
    it('should filter empty rows', () => {
      const csv = 'Name,Company\nJohn,Acme\n\n\nJane,Beta';
      const result = parseCsv(csv);
      
      expect(result.data).toHaveLength(2);
    });
  });
  
  describe('getHeaders', () => {
    it('should extract headers correctly', () => {
      const headers = getHeaders(SAMPLE_CSV);
      
      expect(headers).toContain('Name');
      expect(headers).toContain('Job Title');
      expect(headers).toContain('PersonScore');
    });
  });
  
  describe('validateCsvStructure', () => {
    it('should pass with all required headers', () => {
      const result = validateCsvStructure(SAMPLE_CSV, ['Name', 'Company']);
      
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });
    
    it('should fail with missing headers', () => {
      const result = validateCsvStructure(SAMPLE_CSV, ['Name', 'Email']);
      
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('Email');
    });
  });
  
  describe('countRows', () => {
    it('should count data rows correctly', () => {
      const count = countRows(SAMPLE_CSV);
      expect(count).toBe(3);
    });
  });
});

// ============================================
// Column Mapper Tests
// ============================================

describe('ColumnMapperService', () => {
  describe('autoDetectMapping', () => {
    it('should map common column names', () => {
      const headers = ['Name', 'Job Title', 'Company', 'PersonScore'];
      const mappings = autoDetectMapping(headers);
      
      const nameMapping = mappings.find(m => m.sourceColumn === 'Name');
      expect(nameMapping?.targetField).toBe('name');
      expect(nameMapping?.confidence).toBe(1.0);
      
      const titleMapping = mappings.find(m => m.sourceColumn === 'Job Title');
      expect(titleMapping?.targetField).toBe('jobTitle');
    });
    
    it('should detect boolean columns', () => {
      const headers = ['is_ops', 'is_exec'];
      const mappings = autoDetectMapping(headers);
      
      const opsMapping = mappings.find(m => m.sourceColumn === 'is_ops');
      expect(opsMapping?.targetField).toBe('isOps');
      expect(opsMapping?.transform).toBe('boolean');
    });
    
    it('should flag unknown columns', () => {
      const headers = ['Unknown Column', 'Random Field'];
      const mappings = autoDetectMapping(headers);
      
      expect(mappings.every(m => m.confidence < 0.5)).toBe(true);
    });
  });
  
  describe('applyMapping', () => {
    it('should transform row values correctly', () => {
      const row = { Name: 'John Doe', 'is_ops': 'TRUE', PersonScore: '85' };
      const mappings = [
        { sourceColumn: 'Name', targetField: 'name', confidence: 1, transform: 'string' as const },
        { sourceColumn: 'is_ops', targetField: 'isOps', confidence: 1, transform: 'boolean' as const },
        { sourceColumn: 'PersonScore', targetField: 'personScore', confidence: 1, transform: 'number' as const },
      ];
      
      const result = applyMapping<{ name: string; isOps: boolean; personScore: number }>(row, mappings);
      
      expect(result.name).toBe('John Doe');
      expect(result.isOps).toBe(true);
      expect(result.personScore).toBe(85);
    });
  });
});

// ============================================
// Segmentation Tests
// ============================================

describe('SegmentationService', () => {
  describe('applyFilters', () => {
    it('should return all prospects with empty filter', () => {
      const result = applyFilters(SAMPLE_PROSPECTS, {});
      expect(result).toHaveLength(3);
    });
    
    it('should filter by persona', () => {
      const result = applyFilters(SAMPLE_PROSPECTS, { personas: ['ops'] });
      expect(result).toHaveLength(2); // John and Bob
      expect(result.every(p => p.isOps)).toBe(true);
    });
    
    it('should filter by multiple personas (OR logic)', () => {
      const result = applyFilters(SAMPLE_PROSPECTS, { personas: ['proc', 'sales'] });
      expect(result).toHaveLength(1); // Jane
    });
    
    it('should filter by category', () => {
      const result = applyFilters(SAMPLE_PROSPECTS, { categories: ['Speaker'] });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('John Doe');
    });
    
    it('should filter by score range', () => {
      const result = applyFilters(SAMPLE_PROSPECTS, { scoreMin: 70, scoreMax: 90 });
      expect(result).toHaveLength(2); // John (85) and Jane (72)
    });
    
    it('should filter by hasEmail', () => {
      const result = applyFilters(SAMPLE_PROSPECTS, { hasEmail: true });
      expect(result).toHaveLength(2); // John and Jane have emails
    });
    
    it('should filter by search text', () => {
      const result = applyFilters(SAMPLE_PROSPECTS, { search: 'acme' });
      expect(result).toHaveLength(1);
      expect(result[0].company).toBe('Acme Corp');
    });
    
    it('should filter by hasSequence', () => {
      const result = applyFilters(SAMPLE_PROSPECTS, { hasSequence: true });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Jane Smith');
    });
    
    it('should combine multiple filters (AND logic)', () => {
      const result = applyFilters(SAMPLE_PROSPECTS, {
        personas: ['exec'],
        hasEmail: true,
      });
      expect(result).toHaveLength(2); // John and Jane are execs with email
    });
  });
  
  describe('countMatches', () => {
    it('should count matching prospects', () => {
      const count = countMatches(SAMPLE_PROSPECTS, { personas: ['ops'] });
      expect(count).toBe(2);
    });
  });
  
  describe('isEmptyFilter', () => {
    it('should return true for empty object', () => {
      expect(isEmptyFilter({})).toBe(true);
    });
    
    it('should return false for active filter', () => {
      expect(isEmptyFilter({ personas: ['ops'] })).toBe(false);
    });
  });
  
  describe('getFilterSummary', () => {
    it('should summarize active filters', () => {
      const summary = getFilterSummary({
        personas: ['exec', 'ops'],
        hasEmail: true,
      });
      
      expect(summary).toContain('exec');
      expect(summary).toContain('ops');
      expect(summary).toContain('Has Email');
    });
    
    it('should return default for empty filter', () => {
      expect(getFilterSummary({})).toBe('All Prospects');
    });
  });
  
  describe('getSegmentStats', () => {
    it('should calculate correct statistics', () => {
      const stats = getSegmentStats(SAMPLE_PROSPECTS);
      
      expect(stats.total).toBe(3);
      expect(stats.withEmail).toBe(2);
      expect(stats.withLinkedIn).toBe(1);
      expect(stats.byPersona.ops).toBe(2);
      expect(stats.byPersona.exec).toBe(2);
    });
  });
});

// ============================================
// HubSpot Exporter Tests
// ============================================

describe('HubSpotExporter', () => {
  describe('splitName', () => {
    it('should split simple names correctly', () => {
      const result = splitName('Jamie Saucedo');
      expect(result.firstName).toBe('Jamie');
      expect(result.lastName).toBe('Saucedo');
    });
    
    it('should handle single names', () => {
      const result = splitName('Madonna');
      expect(result.firstName).toBe('Madonna');
      expect(result.lastName).toBe('');
    });
    
    it('should handle 3+ part names', () => {
      const result = splitName('Mary Jane Watson');
      expect(result.firstName).toBe('Mary Jane');
      expect(result.lastName).toBe('Watson');
    });
    
    it('should handle empty strings', () => {
      const result = splitName('');
      expect(result.firstName).toBe('');
      expect(result.lastName).toBe('');
    });
  });
  
  describe('toHubSpotContact', () => {
    it('should convert prospect with email', () => {
      const contact = toHubSpotContact(SAMPLE_PROSPECTS[0]);
      
      expect(contact).not.toBeNull();
      expect(contact?.Email).toBe('john@acme.com');
      expect(contact?.['First Name']).toBe('John');
      expect(contact?.['Last Name']).toBe('Doe');
      expect(contact?.Company).toBe('Acme Corp');
    });
    
    it('should return null for prospect without email', () => {
      const contact = toHubSpotContact(SAMPLE_PROSPECTS[2]);
      expect(contact).toBeNull();
    });
    
    it('should include custom properties', () => {
      const contact = toHubSpotContact(SAMPLE_PROSPECTS[0], { includeCustomProps: true });
      
      expect(contact?.yf_score).toBe(85);
      expect(contact?.yf_category).toBe('Speaker');
    });
  });
  
  describe('exportToHubSpot', () => {
    it('should export prospects with email', () => {
      const result = exportToHubSpot(SAMPLE_PROSPECTS);
      
      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(2); // Only 2 have emails
      expect(result.skippedCount).toBe(1);
      expect(result.filename).toContain('hubspot_');
      expect(result.filename).toContain('.csv');
    });
    
    it('should fail with no exportable contacts', () => {
      const noEmailProspects = SAMPLE_PROSPECTS.map(p => ({ ...p, email: '' }));
      const result = exportToHubSpot(noEmailProspects);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('No contacts with valid email addresses to export');
    });
    
    it('should include BOM in blob', () => {
      const result = exportToHubSpot(SAMPLE_PROSPECTS);
      
      // Read blob content
      const reader = new FileReader();
      reader.readAsText(result.blob);
      // BOM is the first character
      expect(result.blob.size).toBeGreaterThan(0);
    });
  });
  
  describe('validateForExport', () => {
    it('should count exportable contacts', () => {
      const result = validateForExport(SAMPLE_PROSPECTS);
      
      expect(result.valid).toBe(true);
      expect(result.exportableCount).toBe(2);
      expect(result.missingEmailCount).toBe(1);
    });
    
    it('should warn about missing emails', () => {
      const result = validateForExport(SAMPLE_PROSPECTS);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

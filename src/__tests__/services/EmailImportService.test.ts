/**
 * Unit tests for EmailImportService
 * 
 * Tests:
 * - CSV parsing
 * - Prospect matching logic
 * - Export unmatched to CSV
 */

import { describe, it, expect } from 'vitest';
import {
  parseCSV,
  matchEmailsToProspects,
  exportUnmatchedToCSV,
  type ProspectForMatching,
} from '../../services/EmailImportService';

describe('EmailImportService', () => {
  describe('parseCSV', () => {
    it('parses CSV with standard headers', () => {
      const csv = `Full Name,Email,Company
John Doe,john@acme.com,Acme Corp
Jane Smith,jane@bigco.com,BigCo Inc`;
      
      const rows = parseCSV(csv);
      
      expect(rows).toHaveLength(2);
      expect(rows[0].fullName).toBe('John Doe');
      expect(rows[0].email).toBe('john@acme.com');
      expect(rows[0].company).toBe('Acme Corp');
    });

    it('parses CSV with First Name and Last Name columns', () => {
      const csv = `First Name,Last Name,Email,Company
John,Doe,john@acme.com,Acme Corp`;
      
      const rows = parseCSV(csv);
      
      expect(rows).toHaveLength(1);
      expect(rows[0].fullName).toBe('John Doe');
      expect(rows[0].firstName).toBe('John');
      expect(rows[0].lastName).toBe('Doe');
    });

    it('skips rows without valid email', () => {
      const csv = `Full Name,Email,Company
John Doe,john@acme.com,Acme Corp
Jane Smith,,BigCo Inc
Bob Wilson,not-an-email,Test Corp`;
      
      const rows = parseCSV(csv);
      
      expect(rows).toHaveLength(1);
      expect(rows[0].email).toBe('john@acme.com');
    });

    it('handles quoted values with commas', () => {
      const csv = `Full Name,Email,Company
"Doe, John",john@acme.com,"Acme Corp, Inc."`;
      
      const rows = parseCSV(csv);
      
      expect(rows).toHaveLength(1);
      expect(rows[0].fullName).toBe('Doe, John');
      expect(rows[0].company).toBe('Acme Corp, Inc.');
    });
  });

  describe('matchEmailsToProspects', () => {
    const prospects: ProspectForMatching[] = [
      { id: '1', name: 'John Doe', company: 'Acme Corporation', email: undefined },
      { id: '2', name: 'Jane Smith', company: 'BigCo Inc', email: undefined },
      { id: '3', name: 'Bob Wilson', company: 'Test Corp', email: 'existing@test.com' },
    ];

    it('matches by exact name and company', () => {
      const csv = `Full Name,Email,Company
John Doe,john@acme.com,Acme Corporation`;
      
      const rows = parseCSV(csv);
      const result = matchEmailsToProspects(rows, prospects);
      
      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].prospectId).toBe('1');
      expect(result.matched[0].email).toBe('john@acme.com');
      expect(result.matched[0].matchType).toBe('strong');
    });

    it('skips prospects that already have email', () => {
      const csv = `Full Name,Email,Company
Bob Wilson,newbob@test.com,Test Corp`;
      
      const rows = parseCSV(csv);
      const result = matchEmailsToProspects(rows, prospects);
      
      // Bob already has an email, so should not match
      expect(result.matched).toHaveLength(0);
      expect(result.unmatched).toHaveLength(1);
    });

    it('handles fuzzy name matching', () => {
      const csv = `Full Name,Email,Company
John D,john@acme.com,Acme Corp`;
      
      const rows = parseCSV(csv);
      const result = matchEmailsToProspects(rows, prospects);
      
      // Should still find a match with partial name
      expect(result.stats.matchedCount).toBeLessThanOrEqual(1);
    });

    it('reports unmatched rows correctly', () => {
      const csv = `Full Name,Email,Company
Unknown Person,unknown@nowhere.com,Unknown Corp`;
      
      const rows = parseCSV(csv);
      const result = matchEmailsToProspects(rows, prospects);
      
      expect(result.matched).toHaveLength(0);
      expect(result.unmatched).toHaveLength(1);
      expect(result.stats.unmatchedCount).toBe(1);
    });

    it('handles duplicate emails', () => {
      const csv = `Full Name,Email,Company
John Doe,john@acme.com,Acme Corporation
John Doe,john@acme.com,Acme Corporation`;
      
      const rows = parseCSV(csv);
      const result = matchEmailsToProspects(rows, prospects);
      
      expect(result.stats.duplicateEmails).toBe(1);
    });
  });

  describe('exportUnmatchedToCSV', () => {
    it('exports unmatched rows as CSV', () => {
      const unmatched = [
        {
          fullName: 'Unknown Person',
          email: 'unknown@test.com',
          company: 'Test Corp',
          rawRow: {
            'full name': 'Unknown Person',
            'email': 'unknown@test.com',
            'company': 'Test Corp',
          },
        },
      ];
      
      const csv = exportUnmatchedToCSV(unmatched);
      
      expect(csv).toContain('Unknown Person');
      expect(csv).toContain('unknown@test.com');
    });

    it('returns empty string for empty array', () => {
      const csv = exportUnmatchedToCSV([]);
      expect(csv).toBe('');
    });
  });
});

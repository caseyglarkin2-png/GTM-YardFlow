/**
 * Tests for SequenceAnalyticsService
 * 
 * Sprint 4: Unit tests for analytics functionality
 * 
 * Note: These tests verify the service's logic and data transformation.
 * Firestore operations are mocked.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  SequenceAnalyticsService, 
  type AnalyticsExportRow 
} from './SequenceAnalyticsService';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  getApp: vi.fn(() => ({})),
}));

describe('SequenceAnalyticsService', () => {
  let service: SequenceAnalyticsService;

  beforeEach(() => {
    service = new SequenceAnalyticsService();
    vi.clearAllMocks();
  });

  describe('exportToCsv', () => {
    it('should generate CSV with headers', () => {
      const rows: AnalyticsExportRow[] = [
        {
          sequenceName: 'Test Sequence',
          stepNumber: 1,
          stepType: 'initial',
          subject: 'Hello there',
          sent: 100,
          opened: 50,
          clicked: 25,
          replied: 10,
          bounced: 2,
          openRate: '50.0%',
          clickRate: '50.0%',
          replyRate: '10.0%',
          bounceRate: '2.0%',
          dateRange: 'All time',
        },
      ];

      const csv = service.exportToCsv(rows);
      const lines = csv.split('\n');

      expect(lines[0]).toContain('Sequence Name');
      expect(lines[0]).toContain('Step #');
      expect(lines[0]).toContain('Open Rate');
      expect(lines[1]).toContain('Test Sequence');
      expect(lines[1]).toContain('Hello there');
    });

    it('should escape quotes in subject', () => {
      const rows: AnalyticsExportRow[] = [
        {
          sequenceName: 'Test',
          stepNumber: 1,
          stepType: 'initial',
          subject: 'He said "hello"',
          sent: 10,
          opened: 5,
          clicked: 2,
          replied: 1,
          bounced: 0,
          openRate: '50.0%',
          clickRate: '40.0%',
          replyRate: '10.0%',
          bounceRate: '0.0%',
          dateRange: 'All time',
        },
      ];

      const csv = service.exportToCsv(rows);
      
      // Quotes should be escaped by doubling
      expect(csv).toContain('""hello""');
    });

    it('should handle empty rows', () => {
      const csv = service.exportToCsv([]);
      const lines = csv.split('\n');
      
      // Should still have header row
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain('Sequence Name');
    });

    it('should handle multiple rows', () => {
      const rows: AnalyticsExportRow[] = [
        {
          sequenceName: 'Sequence A',
          stepNumber: 1,
          stepType: 'initial',
          subject: 'First email',
          sent: 100,
          opened: 60,
          clicked: 30,
          replied: 15,
          bounced: 2,
          openRate: '60.0%',
          clickRate: '50.0%',
          replyRate: '15.0%',
          bounceRate: '2.0%',
          dateRange: 'Jan 2024',
        },
        {
          sequenceName: 'Sequence A',
          stepNumber: 2,
          stepType: 'follow_up_1',
          subject: 'Follow up',
          sent: 80,
          opened: 40,
          clicked: 20,
          replied: 8,
          bounced: 1,
          openRate: '50.0%',
          clickRate: '50.0%',
          replyRate: '10.0%',
          bounceRate: '1.3%',
          dateRange: 'Jan 2024',
        },
      ];

      const csv = service.exportToCsv(rows);
      const lines = csv.split('\n');

      expect(lines.length).toBe(3); // Header + 2 data rows
      expect(lines[1]).toContain('First email');
      expect(lines[2]).toContain('Follow up');
    });
  });

  describe('downloadCsv', () => {
    it('should create download link', () => {
      // Mock DOM methods
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: vi.fn(),
      } as unknown as HTMLAnchorElement);

      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const rows: AnalyticsExportRow[] = [
        {
          sequenceName: 'Test',
          stepNumber: 1,
          stepType: 'initial',
          subject: 'Test email',
          sent: 50,
          opened: 25,
          clicked: 10,
          replied: 5,
          bounced: 1,
          openRate: '50.0%',
          clickRate: '40.0%',
          replyRate: '10.0%',
          bounceRate: '2.0%',
          dateRange: 'All time',
        },
      ];

      service.downloadCsv(rows, 'test-export.csv');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();

      // Cleanup
      createElementSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });
});

describe('CSV Export Format', () => {
  let service: SequenceAnalyticsService;

  beforeEach(() => {
    service = new SequenceAnalyticsService();
  });

  it('should have correct number of columns', () => {
    const rows: AnalyticsExportRow[] = [
      {
        sequenceName: 'Test',
        stepNumber: 1,
        stepType: 'initial',
        subject: 'Email',
        sent: 10,
        opened: 5,
        clicked: 2,
        replied: 1,
        bounced: 0,
        openRate: '50.0%',
        clickRate: '40.0%',
        replyRate: '10.0%',
        bounceRate: '0.0%',
        dateRange: 'All time',
      },
    ];

    const csv = service.exportToCsv(rows);
    const lines = csv.split('\n');
    const headerCols = lines[0].split(',').length;
    
    // Should have 14 columns
    expect(headerCols).toBe(14);
  });

  it('should handle special characters', () => {
    const rows: AnalyticsExportRow[] = [
      {
        sequenceName: 'Test, with comma',
        stepNumber: 1,
        stepType: 'initial',
        subject: 'Email with "quotes" and, commas',
        sent: 10,
        opened: 5,
        clicked: 2,
        replied: 1,
        bounced: 0,
        openRate: '50.0%',
        clickRate: '40.0%',
        replyRate: '10.0%',
        bounceRate: '0.0%',
        dateRange: 'Jan 1, 2024 - Jan 31, 2024',
      },
    ];

    const csv = service.exportToCsv(rows);
    
    // Commas within quotes should be preserved
    expect(csv).toContain('"Test, with comma"');
    expect(csv).toContain('"Jan 1, 2024 - Jan 31, 2024"');
  });
});

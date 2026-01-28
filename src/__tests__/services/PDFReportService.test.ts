import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Prospect } from '../../types';

// Mock jsPDF - define the factory function inline
vi.mock('jspdf', () => {
  // Mock jsPDF class defined inside the mock factory
  class MockJsPDF {
    internal = {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    };
    
    text() { return this; }
    setFontSize() { return this; }
    setTextColor() { return this; }
    setFillColor() { return this; }
    setDrawColor() { return this; }
    rect() { return this; }
    line() { return this; }
    addPage() { return this; }
    setPage() { return this; }
    addImage() { return this; }
    getNumberOfPages() { return 1; }
    output() { return new Blob(['test'], { type: 'application/pdf' }); }
  }
  
  return {
    default: MockJsPDF,
    jsPDF: MockJsPDF,
  };
});

// Import after mock is set up
import {
  PDFReportService,
  getPDFReportService,
  resetPDFReportService,
  type ReportTemplate,
  type ReportData,
  type ReportOptions,
} from '../../services/PDFReportService';

describe('PDFReportService', () => {
  let service: PDFReportService;

  const sampleProspects: Prospect[] = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      company: 'Acme Corp',
      title: 'CEO',
      tier: 'Tier 1',
      status: 'contacted',
      priority: 'high',
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      company: 'Tech Inc',
      title: 'CTO',
      tier: 'Tier 2',
      status: 'meeting_booked',
      priority: 'medium',
    },
  ];

  beforeEach(() => {
    resetPDFReportService();
    service = new PDFReportService();
  });

  describe('generateReport', () => {
    it('should generate prospect-summary report', async () => {
      const result = await service.generateReport(
        { prospects: sampleProspects },
        { template: 'prospect-summary', title: 'Test Report' }
      );

      expect(result.success).toBe(true);
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.pageCount).toBeGreaterThan(0);
    });

    it('should generate prospect-list report', async () => {
      const result = await service.generateReport(
        { prospects: sampleProspects },
        { template: 'prospect-list' }
      );

      expect(result.success).toBe(true);
      expect(result.filename).toContain('prospect-list');
    });

    it('should generate roi-report', async () => {
      const result = await service.generateReport(
        {
          metrics: {
            pipelineValue: 100000,
            expectedRevenue: 50000,
            roi: 250,
          },
        },
        { template: 'roi-report' }
      );

      expect(result.success).toBe(true);
      expect(result.filename).toContain('roi-report');
    });

    it('should generate pipeline-report', async () => {
      const result = await service.generateReport(
        {
          metrics: {
            new: 10,
            contacted: 5,
            meeting_booked: 3,
          },
        },
        { template: 'pipeline-report' }
      );

      expect(result.success).toBe(true);
    });

    it('should generate activity-report', async () => {
      const result = await service.generateReport(
        {
          metrics: {
            emailsSent: 100,
            callsMade: 50,
            meetingsHeld: 10,
          },
        },
        { template: 'activity-report' }
      );

      expect(result.success).toBe(true);
    });

    it('should generate custom report', async () => {
      const result = await service.generateReport(
        {
          customData: {
            'Custom Field': 'Custom Value',
            'Another Field': 123,
          },
        },
        { template: 'custom', title: 'Custom Report' }
      );

      expect(result.success).toBe(true);
    });

    it('should include title and subtitle', async () => {
      const result = await service.generateReport(
        { prospects: [] },
        {
          template: 'prospect-summary',
          title: 'My Report',
          subtitle: 'Q1 2026',
        }
      );

      expect(result.success).toBe(true);
    });

    it('should include date range', async () => {
      const result = await service.generateReport(
        { prospects: [] },
        {
          template: 'prospect-summary',
          dateRange: {
            start: new Date('2026-01-01'),
            end: new Date('2026-03-31'),
          },
        }
      );

      expect(result.success).toBe(true);
    });

    it('should use custom filename', async () => {
      const result = await service.generateReport(
        { prospects: [] },
        {
          template: 'prospect-summary',
          filename: 'my-custom-report.pdf',
        }
      );

      expect(result.filename).toBe('my-custom-report.pdf');
    });

    it('should use landscape orientation', async () => {
      const result = await service.generateReport(
        { prospects: [] },
        {
          template: 'prospect-list',
          orientation: 'landscape',
        }
      );

      expect(result.success).toBe(true);
    });

    it('should use letter page size', async () => {
      const result = await service.generateReport(
        { prospects: [] },
        {
          template: 'prospect-summary',
          pageSize: 'letter',
        }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('progress callback', () => {
    it('should call progress callback', async () => {
      const onProgress = vi.fn();

      await service.generateReport(
        { prospects: sampleProspects },
        { template: 'prospect-summary' },
        onProgress
      );

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'preparing', percentage: 0 })
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ stage: 'finalizing', percentage: 100 })
      );
    });
  });

  describe('batchGenerate', () => {
    it('should generate multiple reports', async () => {
      const reports = [
        { data: { prospects: sampleProspects }, options: { template: 'prospect-summary' as ReportTemplate } },
        { data: { metrics: { roi: 100 } }, options: { template: 'roi-report' as ReportTemplate } },
      ];

      const results = await service.batchGenerate(reports);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should call progress callback for each report', async () => {
      const onProgress = vi.fn();
      const reports = [
        { data: {}, options: { template: 'prospect-summary' as ReportTemplate } },
        { data: {}, options: { template: 'roi-report' as ReportTemplate } },
      ];

      await service.batchGenerate(reports, onProgress);

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledWith(1, 2, expect.any(Object));
      expect(onProgress).toHaveBeenCalledWith(2, 2, expect.any(Object));
    });
  });

  describe('getTemplates', () => {
    it('should return available templates', () => {
      const templates = service.getTemplates();

      expect(templates).toHaveLength(6);
      expect(templates[0]).toHaveProperty('id');
      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('description');
    });

    it('should include all template types', () => {
      const templates = service.getTemplates();
      const ids = templates.map(t => t.id);

      expect(ids).toContain('prospect-summary');
      expect(ids).toContain('prospect-list');
      expect(ids).toContain('roi-report');
      expect(ids).toContain('pipeline-report');
      expect(ids).toContain('activity-report');
      expect(ids).toContain('custom');
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      resetPDFReportService();
      const instance1 = getPDFReportService();
      const instance2 = getPDFReportService();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = getPDFReportService();
      resetPDFReportService();
      const instance2 = getPDFReportService();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty prospects', async () => {
      const result = await service.generateReport(
        { prospects: [] },
        { template: 'prospect-list' }
      );

      expect(result.success).toBe(true);
    });

    it('should handle empty metrics', async () => {
      const result = await service.generateReport(
        { metrics: {} },
        { template: 'roi-report' }
      );

      expect(result.success).toBe(true);
    });

    it('should handle undefined data', async () => {
      const result = await service.generateReport(
        {},
        { template: 'prospect-summary' }
      );

      expect(result.success).toBe(true);
    });

    it('should handle very long names', async () => {
      const longNameProspect: Prospect = {
        id: '1',
        name: 'A'.repeat(100),
        email: 'test@example.com',
        company: 'B'.repeat(100),
        title: 'C'.repeat(100),
        tier: 'Tier 1',
        status: 'new',
        priority: 'high',
      };

      const result = await service.generateReport(
        { prospects: [longNameProspect] },
        { template: 'prospect-list' }
      );

      expect(result.success).toBe(true);
    });

    it('should handle large number of prospects', async () => {
      const manyProspects = Array.from({ length: 100 }, (_, i) => ({
        ...sampleProspects[0],
        id: String(i),
        name: `Prospect ${i}`,
      }));

      const result = await service.generateReport(
        { prospects: manyProspects },
        { template: 'prospect-list' }
      );

      expect(result.success).toBe(true);
    });
  });
});

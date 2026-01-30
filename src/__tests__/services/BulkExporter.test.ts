import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BulkExporter,
  getBulkExporter,
  resetBulkExporter,
  type ExportFormat,
  type ExportField,
  type ExportOptions,
} from '../../services/BulkExporter';
import type { Prospect } from '../../types';

// Mock DOM APIs for download tests
const mockCreateElement = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockClick = vi.fn();

vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:test-url'),
  revokeObjectURL: vi.fn(),
});

describe('BulkExporter', () => {
  let exporter: BulkExporter;

  // Sample prospect data
  const sampleProspects: Prospect[] = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      company: 'Acme Corp',
      title: 'CEO',
      phone: '555-1234',
      linkedinUrl: 'https://linkedin.com/in/johndoe',
      tier: 'Tier 1',
      status: 'new',
      score: 80,
      isOps: false,
      isExec: true,
      source: 'Manifest',
      tags: ['hot', 'decision-maker'],
      notes: 'Important contact',
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      company: 'Tech Inc',
      title: 'CTO',
      phone: '555-5678',
      linkedinUrl: 'https://linkedin.com/in/janesmith',
      tier: 'Tier 2',
      status: 'contacted',
      score: 70,
      isOps: false,
      isExec: true,
      source: 'LinkedIn',
      tags: ['tech'],
      notes: '',
    },
  ];

  beforeEach(() => {
    resetBulkExporter();
    exporter = new BulkExporter();

    // Mock document for download tests
    Object.defineProperty(global, 'document', {
      value: {
        createElement: mockCreateElement.mockReturnValue({
          href: '',
          download: '',
          click: mockClick,
        }),
        body: {
          appendChild: mockAppendChild,
          removeChild: mockRemoveChild,
        },
      },
      writable: true,
    });
  });

  describe('fields management', () => {
    it('should return default fields', () => {
      const fields = exporter.getFields();
      expect(fields.length).toBeGreaterThan(0);
    });

    it('should return fields sorted by order', () => {
      const fields = exporter.getFields();
      for (let i = 1; i < fields.length; i++) {
        expect(fields[i].order).toBeGreaterThanOrEqual(fields[i - 1].order);
      }
    });

    it('should return only enabled fields', () => {
      const enabledFields = exporter.getEnabledFields();
      expect(enabledFields.every(f => f.enabled)).toBe(true);
    });

    it('should toggle field enabled state', () => {
      exporter.setFieldEnabled('notes', true);
      const field = exporter.getFields().find(f => f.key === 'notes');
      expect(field?.enabled).toBe(true);
    });

    it('should set field order', () => {
      exporter.setFieldOrder('name', 100);
      const field = exporter.getFields().find(f => f.key === 'name');
      expect(field?.order).toBe(100);
    });

    it('should toggle all fields', () => {
      exporter.toggleAllFields(false);
      const fields = exporter.getFields();
      expect(fields.every(f => !f.enabled)).toBe(true);

      exporter.toggleAllFields(true);
      const fieldsAfter = exporter.getFields();
      expect(fieldsAfter.every(f => f.enabled)).toBe(true);
    });

    it('should reset fields to default', () => {
      exporter.toggleAllFields(false);
      exporter.resetFields();
      const enabledFields = exporter.getEnabledFields();
      expect(enabledFields.length).toBeGreaterThan(0);
    });

    it('should add custom field', () => {
      exporter.addCustomField({
        key: 'customField',
        label: 'Custom Field',
        enabled: true,
      });

      const field = exporter.getFields().find(f => f.key === 'customField');
      expect(field).toBeDefined();
      expect(field?.label).toBe('Custom Field');
    });

    it('should assign order to custom field', () => {
      const initialFields = exporter.getFields();
      const maxOrder = Math.max(...initialFields.map(f => f.order));

      exporter.addCustomField({
        key: 'custom',
        label: 'Custom',
        enabled: true,
      });

      const field = exporter.getFields().find(f => f.key === 'custom');
      expect(field?.order).toBe(maxOrder + 1);
    });
  });

  describe('CSV export', () => {
    it('should export to CSV with headers', () => {
      const fields = exporter.getEnabledFields().slice(0, 3);
      const csv = exporter.toCsv(sampleProspects, fields);

      expect(csv).toContain(fields[0].label);
      expect(csv).toContain('John Doe');
      expect(csv).toContain('Jane Smith');
    });

    it('should export to CSV without headers', () => {
      const fields = exporter.getEnabledFields().slice(0, 3);
      const csv = exporter.toCsv(sampleProspects, fields, {
        includeHeaders: false,
      });

      expect(csv).not.toContain('Name');
      expect(csv).toContain('John Doe');
    });

    it('should use custom delimiter', () => {
      const fields = exporter.getEnabledFields().slice(0, 2);
      const csv = exporter.toCsv(sampleProspects, fields, {
        delimiter: ';',
      });

      expect(csv).toContain(';');
      expect(csv.split('\n')[0]).toContain(';');
    });

    it('should escape values containing delimiter', () => {
      const prospectWithComma: Prospect = {
        ...sampleProspects[0],
        company: 'Acme, Inc',
      };

      const fields = [{ key: 'company', label: 'Company', enabled: true, order: 0 }];
      const csv = exporter.toCsv([prospectWithComma], fields);

      expect(csv).toContain('"Acme, Inc"');
    });

    it('should escape values containing quotes', () => {
      const prospectWithQuote: Prospect = {
        ...sampleProspects[0],
        notes: 'Said "hello"',
      };

      const fields = [{ key: 'notes', label: 'Notes', enabled: true, order: 0 }];
      const csv = exporter.toCsv([prospectWithQuote], fields);

      expect(csv).toContain('""hello""');
    });

    it('should escape values containing newlines', () => {
      const prospectWithNewline: Prospect = {
        ...sampleProspects[0],
        notes: 'Line 1\nLine 2',
      };

      const fields = [{ key: 'notes', label: 'Notes', enabled: true, order: 0 }];
      const csv = exporter.toCsv([prospectWithNewline], fields);

      expect(csv).toContain('"Line 1\nLine 2"');
    });

    it('should join array values with semicolon', () => {
      const fields = [{ key: 'tags', label: 'Tags', enabled: true, order: 0 }];
      const csv = exporter.toCsv(sampleProspects, fields);

      expect(csv).toContain('hot; decision-maker');
    });
  });

  describe('JSON export', () => {
    it('should export to JSON', () => {
      const fields = exporter.getEnabledFields().slice(0, 3);
      const json = exporter.toJson(sampleProspects, fields);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe('John Doe');
    });

    it('should include only selected fields', () => {
      const fields = [
        { key: 'name', label: 'Name', enabled: true, order: 0 },
        { key: 'email', label: 'Email', enabled: true, order: 1 },
      ];
      const json = exporter.toJson(sampleProspects, fields);
      const parsed = JSON.parse(json);

      expect(Object.keys(parsed[0])).toEqual(['name', 'email']);
    });

    it('should format JSON with indentation', () => {
      const fields = [{ key: 'name', label: 'Name', enabled: true, order: 0 }];
      const json = exporter.toJson(sampleProspects, fields);

      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });
  });

  describe('export method', () => {
    it('should export to CSV format', async () => {
      const result = await exporter.export(sampleProspects, { format: 'csv' });

      expect(result.success).toBe(true);
      expect(result.format).toBe('csv');
      expect(result.rowCount).toBe(2);
      expect(result.data).toContain('John Doe');
    });

    it('should export to JSON format', async () => {
      const result = await exporter.export(sampleProspects, { format: 'json' });

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(result.rowCount).toBe(2);
    });

    it('should fail for empty prospects', async () => {
      const result = await exporter.export([]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No prospects');
    });

    it('should fail for no fields selected', async () => {
      exporter.toggleAllFields(false);
      const result = await exporter.export(sampleProspects);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No fields');
    });

    it('should fail for unsupported format', async () => {
      const result = await exporter.export(sampleProspects, {
        format: 'xlsx' as ExportFormat,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported format');
    });

    it('should call progress callback', async () => {
      const onProgress = vi.fn();

      await exporter.export(sampleProspects, { format: 'csv' }, onProgress);

      expect(onProgress).toHaveBeenCalledWith({
        total: 2,
        processed: 0,
        percentage: 0,
      });

      expect(onProgress).toHaveBeenCalledWith({
        total: 2,
        processed: 2,
        percentage: 100,
      });
    });

    it('should generate filename', async () => {
      const result = await exporter.export(sampleProspects, { format: 'csv' });

      expect(result.filename).toMatch(/yardflow-export-.*\.csv/);
    });

    it('should use custom filename', async () => {
      const result = await exporter.export(sampleProspects, {
        format: 'csv',
        filename: 'my-export.csv',
      });

      expect(result.filename).toBe('my-export.csv');
    });

    it('should use custom fields', async () => {
      const customFields: ExportField[] = [
        { key: 'name', label: 'Full Name', enabled: true, order: 0 },
      ];

      const result = await exporter.export(sampleProspects, {
        format: 'csv',
        fields: customFields,
      });

      expect(result.data).toContain('Full Name');
    });
  });

  describe('field value extraction', () => {
    it('should extract simple string values', () => {
      const field: ExportField = {
        key: 'name',
        label: 'Name',
        enabled: true,
        order: 0,
      };

      const value = exporter.getFieldValue(sampleProspects[0], field);
      expect(value).toBe('John Doe');
    });

    it('should handle null values', () => {
      const prospect: Prospect = {
        ...sampleProspects[0],
        notes: undefined,
      };

      const field: ExportField = {
        key: 'notes',
        label: 'Notes',
        enabled: true,
        order: 0,
      };

      const value = exporter.getFieldValue(prospect, field);
      expect(value).toBe('');
    });

    it('should join array values', () => {
      const field: ExportField = {
        key: 'tags',
        label: 'Tags',
        enabled: true,
        order: 0,
      };

      const value = exporter.getFieldValue(sampleProspects[0], field);
      expect(value).toBe('hot; decision-maker');
    });

    it('should format Date values', () => {
      const timestamp = new Date('2024-01-15T10:30:00Z').getTime();
      const prospect: Prospect = {
        ...sampleProspects[0],
        createdAt: timestamp,
      };

      const field: ExportField = {
        key: 'createdAt',
        label: 'Created',
        enabled: true,
        order: 0,
      };

      const value = exporter.getFieldValue(prospect, field);
      // createdAt is stored as timestamp number, exported as string
      expect(value).toBe(String(timestamp));
    });

    it('should use custom formatter', () => {
      const field: ExportField = {
        key: 'name',
        label: 'Name',
        enabled: true,
        order: 0,
        formatter: (value) => String(value).toUpperCase(),
      };

      const value = exporter.getFieldValue(sampleProspects[0], field);
      expect(value).toBe('JOHN DOE');
    });

    it('should stringify objects', () => {
      const prospect = {
        ...sampleProspects[0],
        customData: { key: 'value' },
      } as Prospect;

      const field: ExportField = {
        key: 'customData',
        label: 'Custom',
        enabled: true,
        order: 0,
      };

      const value = exporter.getFieldValue(prospect, field);
      expect(value).toBe('{"key":"value"}');
    });
  });

  describe('date formatting', () => {
    it('should format date with default format', () => {
      const date = new Date('2024-03-15T14:30:45Z');
      const formatted = exporter.formatDate(date);

      expect(formatted).toBe('2024-03-15');
    });

    it('should format date with custom format', () => {
      const date = new Date('2024-03-15T14:30:45Z');
      const formatted = exporter.formatDate(date, 'YYYY/MM/DD');

      expect(formatted).toBe('2024/03/15');
    });

    it('should include time in format', () => {
      const date = new Date('2024-03-15T14:30:45Z');
      const formatted = exporter.formatDate(date, 'YYYY-MM-DD HH:mm:ss');

      expect(formatted).toMatch(/2024-03-15 \d{2}:\d{2}:\d{2}/);
    });
  });

  describe('filename generation', () => {
    it('should generate CSV filename', () => {
      const filename = exporter.generateFilename('csv');

      expect(filename).toMatch(/^yardflow-export-.*\.csv$/);
    });

    it('should generate JSON filename', () => {
      const filename = exporter.generateFilename('json');

      expect(filename).toMatch(/^yardflow-export-.*\.json$/);
    });

    it('should include timestamp', () => {
      const filename = exporter.generateFilename('csv');

      // Check for date-like pattern
      expect(filename).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('MIME types', () => {
    it('should return CSV MIME type', () => {
      const mime = exporter.getMimeType('csv');
      expect(mime).toContain('text/csv');
    });

    it('should return JSON MIME type', () => {
      const mime = exporter.getMimeType('json');
      expect(mime).toContain('application/json');
    });

    it('should return XLSX MIME type', () => {
      const mime = exporter.getMimeType('xlsx');
      expect(mime).toContain('spreadsheetml');
    });
  });

  describe('preview', () => {
    it('should preview first N rows', () => {
      const preview = exporter.preview(sampleProspects, { format: 'csv' }, 1);
      const lines = preview.split('\n');

      // Header + 1 data row
      expect(lines).toHaveLength(2);
    });

    it('should preview in JSON format', () => {
      const preview = exporter.preview(sampleProspects, { format: 'json' }, 1);
      const parsed = JSON.parse(preview);

      expect(parsed).toHaveLength(1);
    });

    it('should default to 5 rows', () => {
      const manyProspects = Array.from({ length: 10 }, (_, i) => ({
        ...sampleProspects[0],
        id: String(i),
      }));

      const preview = exporter.preview(manyProspects, { format: 'csv' });
      const lines = preview.split('\n');

      // Header + 5 data rows
      expect(lines).toHaveLength(6);
    });
  });

  describe('size estimation', () => {
    it('should estimate file size', () => {
      const fields = exporter.getEnabledFields();
      const size = exporter.estimateSize(sampleProspects, fields);

      expect(size).toBeGreaterThan(0);
    });

    it('should scale with prospect count', () => {
      const fields = exporter.getEnabledFields();
      const manyProspects = Array.from({ length: 100 }, (_, i) => ({
        ...sampleProspects[0],
        id: String(i),
      }));

      const size1 = exporter.estimateSize(sampleProspects, fields);
      const size100 = exporter.estimateSize(manyProspects, fields);

      expect(size100).toBeGreaterThan(size1 * 10);
    });

    it('should format file sizes', () => {
      expect(exporter.formatFileSize(500)).toBe('500 B');
      expect(exporter.formatFileSize(2048)).toBe('2.0 KB');
      expect(exporter.formatFileSize(1500000)).toBe('1.4 MB');
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      resetBulkExporter();
      const instance1 = getBulkExporter();
      const instance2 = getBulkExporter();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = getBulkExporter();
      resetBulkExporter();
      const instance2 = getBulkExporter();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('edge cases', () => {
    it('should handle single prospect', async () => {
      const result = await exporter.export([sampleProspects[0]], { format: 'csv' });

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1);
    });

    it('should handle prospect with empty strings', async () => {
      const prospect: Prospect = {
        id: '1',
        name: '',
        email: '',
        company: '',
        title: '',
        tier: '',
        status: 'new',
        score: 0,
        isOps: false,
        isExec: false,
      };

      const result = await exporter.export([prospect], { format: 'csv' });
      expect(result.success).toBe(true);
    });

    it('should handle large number of prospects', async () => {
      const largeList = Array.from({ length: 1000 }, (_, i) => ({
        ...sampleProspects[0],
        id: String(i),
      }));

      const result = await exporter.export(largeList, { format: 'csv' });

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1000);
    });

    it('should handle missing field in prospect', () => {
      const prospect = { id: '1', name: 'Test' } as Prospect;
      const field: ExportField = {
        key: 'nonexistent',
        label: 'Missing',
        enabled: true,
        order: 0,
      };

      const value = exporter.getFieldValue(prospect, field);
      expect(value).toBe('');
    });
  });
});

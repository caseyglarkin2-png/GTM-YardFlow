/**
 * BulkExporter - YardFlow Hub
 * 
 * Exports selected prospects to CSV or JSON format with field selection
 * and formatting options.
 */

import type { Prospect } from '../types';

// ============================================
// Types
// ============================================

/**
 * Export format
 */
export type ExportFormat = 'csv' | 'json' | 'xlsx';

/**
 * Field configuration for export
 */
export interface ExportField {
  key: string;
  label: string;
  enabled: boolean;
  order: number;
  formatter?: (value: unknown, prospect: Prospect) => string;
}

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  fields: ExportField[];
  includeHeaders?: boolean;
  delimiter?: string;
  filename?: string;
  dateFormat?: string;
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  format: ExportFormat;
  rowCount: number;
  filename: string;
  data?: string | Blob;
  error?: string;
}

/**
 * Export progress callback
 */
export type ExportProgressCallback = (progress: {
  total: number;
  processed: number;
  percentage: number;
}) => void;

// ============================================
// Default Fields
// ============================================

/**
 * Get default fields - returns fresh copies each time
 */
function getDefaultFields(): ExportField[] {
  return [
    { key: 'name', label: 'Name', enabled: true, order: 0 },
    { key: 'email', label: 'Email', enabled: true, order: 1 },
    { key: 'company', label: 'Company', enabled: true, order: 2 },
    { key: 'title', label: 'Title', enabled: true, order: 3 },
    { key: 'phone', label: 'Phone', enabled: true, order: 4 },
    { key: 'linkedInUrl', label: 'LinkedIn URL', enabled: true, order: 5 },
    { key: 'tier', label: 'Tier', enabled: true, order: 6 },
    { key: 'status', label: 'Status', enabled: true, order: 7 },
    { key: 'priority', label: 'Priority', enabled: true, order: 8 },
    { key: 'source', label: 'Source', enabled: true, order: 9 },
    { key: 'tags', label: 'Tags', enabled: true, order: 10 },
    { key: 'notes', label: 'Notes', enabled: false, order: 11 },
    { key: 'createdAt', label: 'Created At', enabled: false, order: 12 },
    { key: 'updatedAt', label: 'Updated At', enabled: false, order: 13 },
  ];
}

// ============================================
// BulkExporter
// ============================================

export class BulkExporter {
  private fields: ExportField[];
  private defaultDelimiter = ',';
  private defaultDateFormat = 'YYYY-MM-DD';

  constructor() {
    this.fields = getDefaultFields();
  }

  /**
   * Get available export fields
   */
  getFields(): ExportField[] {
    return [...this.fields].sort((a, b) => a.order - b.order);
  }

  /**
   * Get enabled fields
   */
  getEnabledFields(): ExportField[] {
    return this.getFields().filter(f => f.enabled);
  }

  /**
   * Set field enabled state
   */
  setFieldEnabled(key: string, enabled: boolean): void {
    const field = this.fields.find(f => f.key === key);
    if (field) {
      field.enabled = enabled;
    }
  }

  /**
   * Set field order
   */
  setFieldOrder(key: string, order: number): void {
    const field = this.fields.find(f => f.key === key);
    if (field) {
      field.order = order;
    }
  }

  /**
   * Toggle all fields
   */
  toggleAllFields(enabled: boolean): void {
    for (const field of this.fields) {
      field.enabled = enabled;
    }
  }

  /**
   * Reset fields to default
   */
  resetFields(): void {
    this.fields = getDefaultFields();
  }

  /**
   * Add custom field
   */
  addCustomField(field: Omit<ExportField, 'order'>): void {
    const maxOrder = Math.max(...this.fields.map(f => f.order), -1);
    this.fields.push({
      ...field,
      order: maxOrder + 1,
    });
  }

  /**
   * Export prospects to specified format
   */
  async export(
    prospects: Prospect[],
    options: Partial<ExportOptions> = {},
    onProgress?: ExportProgressCallback
  ): Promise<ExportResult> {
    const format = options.format || 'csv';
    const fields = options.fields || this.getEnabledFields();
    const filename = options.filename || this.generateFilename(format);

    if (prospects.length === 0) {
      return {
        success: false,
        format,
        rowCount: 0,
        filename,
        error: 'No prospects to export',
      };
    }

    if (fields.length === 0) {
      return {
        success: false,
        format,
        rowCount: 0,
        filename,
        error: 'No fields selected for export',
      };
    }

    try {
      onProgress?.({ total: prospects.length, processed: 0, percentage: 0 });

      let data: string;

      switch (format) {
        case 'csv':
          data = this.toCsv(prospects, fields, options);
          break;
        case 'json':
          data = this.toJson(prospects, fields);
          break;
        default:
          return {
            success: false,
            format,
            rowCount: 0,
            filename,
            error: `Unsupported format: ${format}`,
          };
      }

      onProgress?.({
        total: prospects.length,
        processed: prospects.length,
        percentage: 100,
      });

      return {
        success: true,
        format,
        rowCount: prospects.length,
        filename,
        data,
      };
    } catch (error) {
      return {
        success: false,
        format,
        rowCount: 0,
        filename,
        error: error instanceof Error ? error.message : 'Export failed',
      };
    }
  }

  /**
   * Convert prospects to CSV
   */
  toCsv(
    prospects: Prospect[],
    fields: ExportField[],
    options: Partial<ExportOptions> = {}
  ): string {
    const delimiter = options.delimiter || this.defaultDelimiter;
    const includeHeaders = options.includeHeaders !== false;

    const lines: string[] = [];

    // Header row
    if (includeHeaders) {
      const headers = fields.map(f => this.escapeCsvValue(f.label, delimiter));
      lines.push(headers.join(delimiter));
    }

    // Data rows
    for (const prospect of prospects) {
      const values = fields.map(field => {
        const value = this.getFieldValue(prospect, field);
        return this.escapeCsvValue(value, delimiter);
      });
      lines.push(values.join(delimiter));
    }

    return lines.join('\n');
  }

  /**
   * Convert prospects to JSON
   */
  toJson(prospects: Prospect[], fields: ExportField[]): string {
    const data = prospects.map(prospect => {
      const obj: Record<string, string> = {};
      for (const field of fields) {
        obj[field.key] = this.getFieldValue(prospect, field);
      }
      return obj;
    });

    return JSON.stringify(data, null, 2);
  }

  /**
   * Get field value from prospect
   */
  getFieldValue(prospect: Prospect, field: ExportField): string {
    // Use type-safe property access
    const prospectRecord = prospect as unknown as Record<string, unknown>;
    
    if (field.formatter) {
      return field.formatter(prospectRecord[field.key], prospect);
    }

    const value = prospectRecord[field.key];

    if (value === null || value === undefined) {
      return '';
    }

    if (Array.isArray(value)) {
      return value.join('; ');
    }

    if (value instanceof Date) {
      return this.formatDate(value);
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Escape CSV value
   */
  escapeCsvValue(value: string, delimiter: string): string {
    // Check if value needs escaping
    const needsEscaping =
      value.includes(delimiter) ||
      value.includes('"') ||
      value.includes('\n') ||
      value.includes('\r');

    if (!needsEscaping) {
      return value;
    }

    // Escape double quotes by doubling them
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  /**
   * Format date
   */
  formatDate(date: Date, format?: string): string {
    const fmt = format || this.defaultDateFormat;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return fmt
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  /**
   * Generate filename
   */
  generateFilename(format: ExportFormat): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `yardflow-export-${timestamp}.${format}`;
  }

  /**
   * Download export result
   */
  download(result: ExportResult): void {
    if (!result.success || !result.data) {
      throw new Error(result.error || 'No data to download');
    }

    const blob =
      result.data instanceof Blob
        ? result.data
        : new Blob([result.data], { type: this.getMimeType(result.format) });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Get MIME type for format
   */
  getMimeType(format: ExportFormat): string {
    switch (format) {
      case 'csv':
        return 'text/csv;charset=utf-8';
      case 'json':
        return 'application/json;charset=utf-8';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default:
        return 'text/plain;charset=utf-8';
    }
  }

  /**
   * Convenience: export prospects to CSV
   */
  async exportToCSV(prospects: Prospect[], filename?: string): Promise<ExportResult> {
    return this.export(prospects, { format: 'csv', filename });
  }

  /**
   * Export and download in one step
   */
  async exportAndDownload(
    prospects: Prospect[],
    options: Partial<ExportOptions> = {},
    onProgress?: ExportProgressCallback
  ): Promise<ExportResult> {
    const result = await this.export(prospects, options, onProgress);

    if (result.success) {
      this.download(result);
    }

    return result;
  }

  /**
   * Create preview of export (first N rows)
   */
  preview(
    prospects: Prospect[],
    options: Partial<ExportOptions> = {},
    maxRows: number = 5
  ): string {
    const format = options.format || 'csv';
    const fields = options.fields || this.getEnabledFields();
    const previewProspects = prospects.slice(0, maxRows);

    if (format === 'json') {
      return this.toJson(previewProspects, fields);
    }

    return this.toCsv(previewProspects, fields, options);
  }

  /**
   * Estimate export file size
   */
  estimateSize(prospects: Prospect[], fields: ExportField[]): number {
    // Rough estimation: ~100 bytes per field per row
    const avgFieldSize = 100;
    return prospects.length * fields.length * avgFieldSize;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// ============================================
// Singleton
// ============================================

let exporterInstance: BulkExporter | null = null;

export function getBulkExporter(): BulkExporter {
  if (!exporterInstance) {
    exporterInstance = new BulkExporter();
  }
  return exporterInstance;
}

export function resetBulkExporter(): void {
  exporterInstance = null;
}

/**
 * PDFReportService - YardFlow Hub
 * 
 * Generates PDF reports for prospects, ROI calculations,
 * and dashboards with configurable templates.
 */

import jsPDF from 'jspdf';
import type { Prospect } from '../types';

// ============================================
// Types
// ============================================

/**
 * Report template type
 */
export type ReportTemplate = 
  | 'prospect-summary'
  | 'prospect-list'
  | 'roi-report'
  | 'pipeline-report'
  | 'activity-report'
  | 'custom';

/**
 * Report options
 */
export interface ReportOptions {
  template: ReportTemplate;
  title?: string;
  subtitle?: string;
  dateRange?: { start: Date; end: Date };
  includeCharts?: boolean;
  includeLogo?: boolean;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'a4' | 'letter';
  filename?: string;
}

/**
 * Report data
 */
export interface ReportData {
  prospects?: Prospect[];
  metrics?: Record<string, number | string>;
  chartImages?: string[];
  customData?: Record<string, unknown>;
}

/**
 * Report result
 */
export interface ReportResult {
  success: boolean;
  filename: string;
  blob?: Blob;
  pageCount: number;
  error?: string;
}

/**
 * Progress callback
 */
export type ReportProgressCallback = (progress: {
  stage: 'preparing' | 'rendering' | 'finalizing';
  percentage: number;
}) => void;

// ============================================
// PDF Styles
// ============================================

const COLORS = {
  primary: [59, 130, 246] as [number, number, number], // Blue
  secondary: [107, 114, 128] as [number, number, number], // Gray
  success: [34, 197, 94] as [number, number, number], // Green
  danger: [239, 68, 68] as [number, number, number], // Red
  text: [31, 41, 55] as [number, number, number], // Dark gray
  lightGray: [243, 244, 246] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

const FONTS = {
  header: 24,
  subheader: 16,
  body: 11,
  small: 9,
};

// ============================================
// PDFReportService
// ============================================

export class PDFReportService {
  private defaultOptions: Partial<ReportOptions> = {
    orientation: 'portrait',
    pageSize: 'a4',
    includeLogo: true,
    includeCharts: true,
  };

  /**
   * Generate a PDF report
   */
  async generateReport(
    data: ReportData,
    options: ReportOptions,
    onProgress?: ReportProgressCallback
  ): Promise<ReportResult> {
    const opts = { ...this.defaultOptions, ...options };
    const filename = opts.filename || this.generateFilename(opts.template);

    try {
      onProgress?.({ stage: 'preparing', percentage: 0 });

      const doc = new jsPDF({
        orientation: opts.orientation,
        unit: 'mm',
        format: opts.pageSize,
      });

      onProgress?.({ stage: 'rendering', percentage: 25 });

      // Add header
      this.addHeader(doc, opts);

      // Generate content based on template
      switch (opts.template) {
        case 'prospect-summary':
          this.renderProspectSummary(doc, data, opts);
          break;
        case 'prospect-list':
          this.renderProspectList(doc, data, opts);
          break;
        case 'roi-report':
          this.renderROIReport(doc, data, opts);
          break;
        case 'pipeline-report':
          this.renderPipelineReport(doc, data, opts);
          break;
        case 'activity-report':
          this.renderActivityReport(doc, data, opts);
          break;
        case 'custom':
          this.renderCustomReport(doc, data, opts);
          break;
      }

      onProgress?.({ stage: 'rendering', percentage: 75 });

      // Add footer to all pages
      this.addFooters(doc);

      onProgress?.({ stage: 'finalizing', percentage: 90 });

      const blob = doc.output('blob');
      const pageCount = doc.getNumberOfPages();

      onProgress?.({ stage: 'finalizing', percentage: 100 });

      return {
        success: true,
        filename,
        blob,
        pageCount,
      };
    } catch (error) {
      return {
        success: false,
        filename,
        pageCount: 0,
        error: error instanceof Error ? error.message : 'Failed to generate report',
      };
    }
  }

  /**
   * Generate and download report
   */
  async downloadReport(
    data: ReportData,
    options: ReportOptions,
    onProgress?: ReportProgressCallback
  ): Promise<ReportResult> {
    const result = await this.generateReport(data, options, onProgress);

    if (result.success && result.blob) {
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    return result;
  }

  /**
   * Add header to PDF
   */
  private addHeader(doc: jsPDF, options: ReportOptions): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // Title
    doc.setFontSize(FONTS.header);
    doc.setTextColor(...COLORS.text);
    doc.text(options.title || 'FreightRoll Report', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Subtitle
    if (options.subtitle) {
      doc.setFontSize(FONTS.subheader);
      doc.setTextColor(...COLORS.secondary);
      doc.text(options.subtitle, pageWidth / 2, y, { align: 'center' });
      y += 8;
    }

    // Date range
    if (options.dateRange) {
      doc.setFontSize(FONTS.small);
      const dateStr = `${this.formatDate(options.dateRange.start)} - ${this.formatDate(options.dateRange.end)}`;
      doc.text(dateStr, pageWidth / 2, y, { align: 'center' });
      y += 5;
    }

    // Horizontal line
    doc.setDrawColor(...COLORS.lightGray);
    doc.line(15, y + 3, pageWidth - 15, y + 3);
  }

  /**
   * Add footers to all pages
   */
  private addFooters(doc: jsPDF): void {
    const pageCount = doc.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(FONTS.small);
      doc.setTextColor(...COLORS.secondary);

      // Page number
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Generated timestamp
      doc.text(`Generated: ${new Date().toLocaleString()}`, 15, pageHeight - 10);

      // Branding
      doc.text('FreightRoll GTM Hub', pageWidth - 15, pageHeight - 10, { align: 'right' });
    }
  }

  /**
   * Render prospect summary report
   */
  private renderProspectSummary(doc: jsPDF, data: ReportData, _options: ReportOptions): void {
    const prospects = data.prospects || [];
    let y = 45;

    // Summary stats
    doc.setFontSize(FONTS.subheader);
    doc.setTextColor(...COLORS.text);
    doc.text('Summary', 15, y);
    y += 8;

    doc.setFontSize(FONTS.body);
    const stats = [
      `Total Prospects: ${prospects.length}`,
      `Tier 1: ${prospects.filter(p => p.tier === 'Tier 1').length}`,
      `Tier 2: ${prospects.filter(p => p.tier === 'Tier 2').length}`,
      `Contacted: ${prospects.filter(p => p.status === 'contacted').length}`,
      `Meetings Booked: ${prospects.filter(p => p.status === 'meeting_booked').length}`,
    ];

    for (const stat of stats) {
      doc.text(stat, 20, y);
      y += 6;
    }
  }

  /**
   * Render prospect list report
   */
  private renderProspectList(doc: jsPDF, data: ReportData, _options: ReportOptions): void {
    const prospects = data.prospects || [];
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 45;

    // Table header
    doc.setFillColor(...COLORS.primary);
    doc.rect(15, y - 4, pageWidth - 30, 8, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(FONTS.small);

    const headers = ['Name', 'Company', 'Title', 'Tier', 'Status'];
    const colWidths = [40, 45, 40, 20, 25];
    let x = 17;

    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x, y);
      x += colWidths[i];
    }
    y += 8;

    // Table rows
    doc.setTextColor(...COLORS.text);
    doc.setFontSize(FONTS.small);

    for (const prospect of prospects) {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }

      // Alternating row colors
      if (prospects.indexOf(prospect) % 2 === 0) {
        doc.setFillColor(...COLORS.lightGray);
        doc.rect(15, y - 4, pageWidth - 30, 7, 'F');
      }

      x = 17;
      const row = [
        this.truncate(prospect.name || '', 20),
        this.truncate(prospect.company || '', 22),
        this.truncate(prospect.title || '', 20),
        prospect.tier || '',
        prospect.status || '',
      ];

      for (let i = 0; i < row.length; i++) {
        doc.text(row[i], x, y);
        x += colWidths[i];
      }
      y += 7;
    }
  }

  /**
   * Render ROI report
   */
  private renderROIReport(doc: jsPDF, data: ReportData, _options: ReportOptions): void {
    const metrics = data.metrics || {};
    let y = 45;

    doc.setFontSize(FONTS.subheader);
    doc.setTextColor(...COLORS.text);
    doc.text('ROI Analysis', 15, y);
    y += 10;

    doc.setFontSize(FONTS.body);
    const roiMetrics = [
      ['Total Pipeline Value', this.formatCurrency(metrics.pipelineValue as number || 0)],
      ['Expected Revenue', this.formatCurrency(metrics.expectedRevenue as number || 0)],
      ['Cost Per Lead', this.formatCurrency(metrics.costPerLead as number || 0)],
      ['ROI', `${metrics.roi || 0}%`],
      ['Conversion Rate', `${metrics.conversionRate || 0}%`],
      ['Average Deal Size', this.formatCurrency(metrics.avgDealSize as number || 0)],
    ];

    for (const [label, value] of roiMetrics) {
      doc.setTextColor(...COLORS.secondary);
      doc.text(label + ':', 20, y);
      doc.setTextColor(...COLORS.text);
      doc.text(String(value), 80, y);
      y += 8;
    }
  }

  /**
   * Render pipeline report
   */
  private renderPipelineReport(doc: jsPDF, data: ReportData, _options: ReportOptions): void {
    const metrics = data.metrics || {};
    let y = 45;

    doc.setFontSize(FONTS.subheader);
    doc.setTextColor(...COLORS.text);
    doc.text('Pipeline Overview', 15, y);
    y += 10;

    doc.setFontSize(FONTS.body);
    const stages = [
      ['New', metrics.new || 0],
      ['Contacted', metrics.contacted || 0],
      ['Meeting Scheduled', metrics.meeting_scheduled || 0],
      ['Meeting Booked', metrics.meeting_booked || 0],
      ['Proposal Sent', metrics.proposal_sent || 0],
      ['Won', metrics.won || 0],
    ];

    for (const [stage, count] of stages) {
      doc.setTextColor(...COLORS.secondary);
      doc.text(stage + ':', 20, y);
      doc.setTextColor(...COLORS.text);
      doc.text(String(count), 70, y);
      y += 8;
    }
  }

  /**
   * Render activity report
   */
  private renderActivityReport(doc: jsPDF, data: ReportData, _options: ReportOptions): void {
    const metrics = data.metrics || {};
    let y = 45;

    doc.setFontSize(FONTS.subheader);
    doc.setTextColor(...COLORS.text);
    doc.text('Activity Summary', 15, y);
    y += 10;

    doc.setFontSize(FONTS.body);
    const activities = [
      ['Emails Sent', metrics.emailsSent || 0],
      ['LinkedIn Messages', metrics.linkedinMessages || 0],
      ['Calls Made', metrics.callsMade || 0],
      ['Meetings Held', metrics.meetingsHeld || 0],
      ['Proposals Sent', metrics.proposalsSent || 0],
    ];

    for (const [activity, count] of activities) {
      doc.setTextColor(...COLORS.secondary);
      doc.text(activity + ':', 20, y);
      doc.setTextColor(...COLORS.text);
      doc.text(String(count), 70, y);
      y += 8;
    }
  }

  /**
   * Render custom report
   */
  private renderCustomReport(doc: jsPDF, data: ReportData, _options: ReportOptions): void {
    let y = 45;

    if (data.customData) {
      doc.setFontSize(FONTS.body);
      doc.setTextColor(...COLORS.text);

      for (const [key, value] of Object.entries(data.customData)) {
        doc.text(`${key}: ${String(value)}`, 20, y);
        y += 7;
      }
    }

    // Add chart images if provided
    if (data.chartImages) {
      for (const imgData of data.chartImages) {
        if (y > 200) {
          doc.addPage();
          y = 20;
        }
        try {
          doc.addImage(imgData, 'PNG', 15, y, 180, 80);
          y += 90;
        } catch {
          // Skip invalid images
        }
      }
    }
  }

  /**
   * Generate filename
   */
  private generateFilename(template: ReportTemplate): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `yardflow-${template}-${timestamp}.pdf`;
  }

  /**
   * Format date
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Format currency
   */
  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  /**
   * Truncate text
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 2) + '...';
  }

  /**
   * Batch generate reports
   */
  async batchGenerate(
    reports: Array<{ data: ReportData; options: ReportOptions }>,
    onProgress?: (index: number, total: number, result: ReportResult) => void
  ): Promise<ReportResult[]> {
    const results: ReportResult[] = [];

    for (let i = 0; i < reports.length; i++) {
      const { data, options } = reports[i];
      const result = await this.generateReport(data, options);
      results.push(result);
      onProgress?.(i + 1, reports.length, result);
    }

    return results;
  }

  /**
   * Get available templates
   */
  getTemplates(): Array<{ id: ReportTemplate; name: string; description: string }> {
    return [
      { id: 'prospect-summary', name: 'Prospect Summary', description: 'Overview of all prospects with statistics' },
      { id: 'prospect-list', name: 'Prospect List', description: 'Detailed table of all prospects' },
      { id: 'roi-report', name: 'ROI Report', description: 'Return on investment analysis' },
      { id: 'pipeline-report', name: 'Pipeline Report', description: 'Sales pipeline stage breakdown' },
      { id: 'activity-report', name: 'Activity Report', description: 'Team activity summary' },
      { id: 'custom', name: 'Custom Report', description: 'Custom data with charts' },
    ];
  }
}

// ============================================
// Singleton
// ============================================

let reportInstance: PDFReportService | null = null;

export function getPDFReportService(): PDFReportService {
  if (!reportInstance) {
    reportInstance = new PDFReportService();
  }
  return reportInstance;
}

export function resetPDFReportService(): void {
  reportInstance = null;
}

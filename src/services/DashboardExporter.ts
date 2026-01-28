/**
 * Dashboard Exporter Service
 * Sprint 28B - T28B.7
 * 
 * Exports dashboard as PNG or PDF.
 */

import { toPng, toBlob } from 'html-to-image';
import { jsPDF } from 'jspdf';

export interface ExportOptions {
  filename?: string;
  includeHeader?: boolean;
  dateRange?: { start: Date; end: Date };
  quality?: number; // 0-1 for PNG
  scale?: number; // Pixel scale factor
}

export interface ExportResult {
  success: boolean;
  filename: string;
  size: number;
  error?: string;
}

function formatDateRange(start: Date, end: Date): string {
  const format = (d: Date) => d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${format(start)} - ${format(end)}`;
}

function generateFilename(prefix: string, extension: string): string {
  const date = new Date().toISOString().split('T')[0];
  return `${prefix}-${date}.${extension}`;
}

export class DashboardExporter {
  /**
   * Export dashboard element as PNG blob
   */
  async exportToPng(
    element: HTMLElement,
    options: ExportOptions = {}
  ): Promise<Blob> {
    const {
      quality = 0.95,
      scale = 2,
    } = options;

    try {
      const blob = await toBlob(element, {
        quality,
        pixelRatio: scale,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      if (!blob) {
        throw new Error('Failed to generate PNG blob');
      }

      return blob;
    } catch (error) {
      throw new Error(`PNG export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export dashboard element as PNG and trigger download
   */
  async downloadPng(
    element: HTMLElement,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    const filename = options.filename || generateFilename('dashboard', 'png');

    try {
      const blob = await this.exportToPng(element, options);
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return {
        success: true,
        filename,
        size: blob.size,
      };
    } catch (error) {
      return {
        success: false,
        filename,
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Export dashboard element as PDF blob
   */
  async exportToPdf(
    element: HTMLElement,
    options: ExportOptions = {}
  ): Promise<Blob> {
    const {
      scale = 2,
      dateRange,
      includeHeader = true,
    } = options;

    try {
      // First convert to PNG
      const dataUrl = await toPng(element, {
        pixelRatio: scale,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      // Calculate dimensions
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
      });

      const imgWidth = img.width;
      const imgHeight = img.height;

      // Create PDF (A4 portrait)
      const pdf = new jsPDF({
        orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Add header if requested
      let yOffset = 20;
      if (includeHeader) {
        pdf.setFontSize(16);
        pdf.text('YardFlow Dashboard', 20, yOffset);
        yOffset += 20;

        if (dateRange) {
          pdf.setFontSize(10);
          pdf.text(`Date Range: ${formatDateRange(dateRange.start, dateRange.end)}`, 20, yOffset);
          yOffset += 10;
        }

        pdf.setFontSize(8);
        pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, yOffset);
        yOffset += 15;
      }

      // Calculate image dimensions to fit page
      const availableHeight = pdfHeight - yOffset - 20;
      const ratio = Math.min(
        (pdfWidth - 40) / imgWidth,
        availableHeight / imgHeight
      );
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;

      // Check if we need multiple pages
      if (scaledHeight > availableHeight) {
        // Multi-page export
        const pageHeight = availableHeight;
        const totalPages = Math.ceil(imgHeight / (pageHeight / ratio));

        for (let page = 0; page < totalPages; page++) {
          if (page > 0) {
            pdf.addPage();
            yOffset = 20;
          }

          // Create a canvas for this page's portion
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Failed to get canvas context');

          const sourceY = page * (pageHeight / ratio);
          const sourceHeight = Math.min(pageHeight / ratio, imgHeight - sourceY);
          
          canvas.width = imgWidth;
          canvas.height = sourceHeight;
          ctx.drawImage(img, 0, sourceY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight);

          const pageDataUrl = canvas.toDataURL('image/png');
          pdf.addImage(pageDataUrl, 'PNG', 20, yOffset, scaledWidth, sourceHeight * ratio);
        }
      } else {
        // Single page export
        pdf.addImage(dataUrl, 'PNG', 20, yOffset, scaledWidth, scaledHeight);
      }

      // Return as blob
      return pdf.output('blob');
    } catch (error) {
      throw new Error(`PDF export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export dashboard element as PDF and trigger download
   */
  async downloadPdf(
    element: HTMLElement,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    const filename = options.filename || generateFilename('dashboard', 'pdf');

    try {
      const blob = await this.exportToPdf(element, options);
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return {
        success: true,
        filename,
        size: blob.size,
      };
    } catch (error) {
      return {
        success: false,
        filename,
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Copy dashboard as PNG to clipboard
   */
  async copyToClipboard(element: HTMLElement): Promise<boolean> {
    try {
      const blob = await this.exportToPng(element, { scale: 2 });
      
      // Check clipboard API availability
      if (!navigator.clipboard?.write) {
        throw new Error('Clipboard API not available');
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob,
        }),
      ]);

      return true;
    } catch (error) {
      console.error('Copy to clipboard failed:', error);
      return false;
    }
  }

  /**
   * Check if export is supported in current browser
   */
  isSupported(): { png: boolean; pdf: boolean; clipboard: boolean } {
    return {
      png: true, // html-to-image works in all modern browsers
      pdf: true, // jspdf works in all modern browsers
      clipboard: typeof navigator.clipboard?.write === 'function',
    };
  }
}

// Singleton instance
export const dashboardExporter = new DashboardExporter();

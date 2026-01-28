/**
 * CSV Parser Service - YardFlow Hub
 * 
 * Robust CSV parsing with Papa Parse, error handling, and validation.
 */

import Papa from 'papaparse';
import type { CsvParseError, CsvParseResult } from '../types/marketing';

// ============================================
// Types
// ============================================

export interface ParseOptions {
  /** Maximum rows to parse (for preview) */
  maxRows?: number;
  /** Expected headers for validation */
  expectedHeaders?: string[];
  /** Skip empty rows */
  skipEmptyRows?: boolean;
  /** Trim whitespace from values */
  trimValues?: boolean;
  /** Encoding detection */
  encoding?: string;
}

export interface ParsedRow {
  [key: string]: string;
}

// ============================================
// CSV Parser Service
// ============================================

/**
 * Parse a CSV file with comprehensive error handling
 */
export function parseCsv(
  content: string,
  options: ParseOptions = {}
): CsvParseResult<ParsedRow> {
  const {
    maxRows,
    expectedHeaders = [],
    skipEmptyRows = true,
    trimValues = true,
  } = options;
  
  const errors: CsvParseError[] = [];
  const warnings: string[] = [];
  
  // Strip BOM if present
  let cleanContent = content;
  if (content.charCodeAt(0) === 0xFEFF) {
    cleanContent = content.slice(1);
    warnings.push('BOM character detected and removed');
  }
  
  // Parse with Papa Parse
  const parseResult = Papa.parse<ParsedRow>(cleanContent, {
    header: true,
    skipEmptyLines: skipEmptyRows,
    transformHeader: (header) => header.trim(),
    transform: trimValues ? (value) => value.trim() : undefined,
    preview: maxRows,
  });
  
  // Collect Papa Parse errors
  parseResult.errors.forEach((err) => {
    errors.push({
      row: err.row !== undefined ? err.row + 2 : 0, // +2 for 1-indexed + header row
      message: err.message,
      type: err.type === 'FieldMismatch' ? 'warning' : 'error',
    });
  });
  
  // Validate headers if expected
  if (expectedHeaders.length > 0 && parseResult.meta.fields) {
    const actualHeaders = parseResult.meta.fields;
    const missingHeaders = expectedHeaders.filter(
      (h) => !actualHeaders.some((a) => a.toLowerCase() === h.toLowerCase())
    );
    
    if (missingHeaders.length > 0) {
      warnings.push(`Missing expected headers: ${missingHeaders.join(', ')}`);
    }
  }
  
  // Filter out completely empty rows
  const data = parseResult.data.filter((row) => {
    const values = Object.values(row);
    return values.some((v) => v && v.trim() !== '');
  });
  
  return {
    data,
    errors,
    warnings,
    rowCount: parseResult.data.length,
    parsedCount: data.length,
  };
}

/**
 * Parse a CSV file from a File object
 */
export function parseCsvFile(
  file: File,
  options: ParseOptions = {}
): Promise<CsvParseResult<ParsedRow>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) {
        reject(new Error('Failed to read file content'));
        return;
      }
      resolve(parseCsv(content, options));
    };
    
    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${reader.error?.message}`));
    };
    
    reader.readAsText(file, options.encoding || 'UTF-8');
  });
}

/**
 * Preview first N rows of a CSV
 */
export function previewCsv(
  content: string,
  rows: number = 5
): CsvParseResult<ParsedRow> {
  return parseCsv(content, { maxRows: rows });
}

/**
 * Get headers from CSV content
 */
export function getHeaders(content: string): string[] {
  const result = parseCsv(content, { maxRows: 1 });
  if (result.data.length > 0) {
    return Object.keys(result.data[0]);
  }
  return [];
}

/**
 * Validate CSV structure
 */
export function validateCsvStructure(
  content: string,
  requiredHeaders: string[]
): { valid: boolean; missing: string[]; errors: string[] } {
  const headers = getHeaders(content);
  const headersLower = headers.map((h) => h.toLowerCase());
  
  const missing = requiredHeaders.filter(
    (h) => !headersLower.includes(h.toLowerCase())
  );
  
  const errors: string[] = [];
  
  if (headers.length === 0) {
    errors.push('No headers found in CSV');
  }
  
  if (missing.length > 0) {
    errors.push(`Missing required headers: ${missing.join(', ')}`);
  }
  
  return {
    valid: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  };
}

/**
 * Detect encoding from file content
 */
export function detectEncoding(content: string): string {
  // Check for UTF-8 BOM
  if (content.charCodeAt(0) === 0xFEFF) {
    return 'UTF-8-BOM';
  }
  
  // Check for common encoding issues (mojibake)
  if (content.includes('Ã©') || content.includes('Ã¨')) {
    return 'UTF-8-as-Latin1';
  }
  
  return 'UTF-8';
}

/**
 * Count rows in CSV (fast, without full parse)
 */
export function countRows(content: string): number {
  // Count newlines, accounting for header
  const lines = content.split('\n').filter((line) => line.trim() !== '');
  return Math.max(0, lines.length - 1); // Subtract header
}

/**
 * DataQualityPanel Tests
 * 
 * Sprint 1004: UI component tests for data quality visualization
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataQualityPanel } from '@/components/DataQualityPanel';
import type { Prospect } from '@/types';

// Mock LazyIcon
vi.mock('@/components/icons', () => ({
  LazyIcon: ({ name, className }: { name: string; className?: string }) => (
    <span data-testid={`icon-${name}`} className={className} />
  ),
}));

// Mock DataQualityService
vi.mock('@/services/DataQualityService', () => ({
  getDataQualityService: () => ({
    generateReport: (prospects: Prospect[]) => ({
      totalProspects: prospects.length,
      qualityScore: {
        overall: 72,
        level: 'good' as const,
        breakdown: {
          completeness: 80,
          emailQuality: 75,
          duplicateRisk: 90,
          dataFreshness: 65,
        },
      },
      emailBreakdown: {
        verified: 50,
        inferred: 30,
        missing: 20,
        contactable: 80,
        contactablePercentage: 80,
      },
      fieldCompleteness: [
        { field: 'email', total: 100, filled: 80, percentage: 80 },
        { field: 'name', total: 100, filled: 100, percentage: 100 },
        { field: 'company', total: 100, filled: 95, percentage: 95 },
        { field: 'title', total: 100, filled: 70, percentage: 70 },
        { field: 'linkedinUrl', total: 100, filled: 60, percentage: 60 },
      ],
      tierDistribution: {
        'Tier 1': 30,
        'Tier 2': 40,
        'Tier 3': 30,
      },
      recommendations: [
        'Enrich missing emails using pattern inference',
        'Add LinkedIn URLs for better prospect verification',
        'Consider removing duplicate prospects',
      ],
      generatedAt: new Date('2026-02-01T10:00:00Z'),
    }),
  }),
}));

describe('DataQualityPanel', () => {
  const mockProspects: Prospect[] = Array.from({ length: 100 }, (_, i) => ({
    id: `prospect-${i}`,
    name: `Prospect ${i}`,
    company: `Company ${i % 10}`,
    title: `Title ${i}`,
    email: i % 5 === 0 ? undefined : `prospect${i}@company${i % 10}.com`,
    tier: i % 3 === 0 ? 'T1' : i % 3 === 1 ? 'T2' : 'T3',
    score: 50 + (i % 50),
    isOps: i % 4 === 0,
    isExec: i % 3 === 0,
    status: 'new' as const,
  }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders empty state when no prospects', () => {
      render(<DataQualityPanel prospects={[]} />);
      
      expect(screen.getByText('No data to analyze')).toBeInTheDocument();
    });

    it('renders full panel with prospects', () => {
      render(<DataQualityPanel prospects={mockProspects} />);
      
      expect(screen.getByText('Data Quality')).toBeInTheDocument();
      expect(screen.getByText('Good')).toBeInTheDocument();
    });

    it('renders quality score gauge', () => {
      render(<DataQualityPanel prospects={mockProspects} />);
      
      expect(screen.getByText('72')).toBeInTheDocument();
    });

    it('renders email breakdown section', () => {
      render(<DataQualityPanel prospects={mockProspects} />);
      
      expect(screen.getByText('Email Coverage')).toBeInTheDocument();
      expect(screen.getByText('Verified (50)')).toBeInTheDocument();
      expect(screen.getByText('Inferred (30)')).toBeInTheDocument();
      expect(screen.getByText('Missing (20)')).toBeInTheDocument();
    });

    it('renders field completeness section', () => {
      render(<DataQualityPanel prospects={mockProspects} />);
      
      expect(screen.getByText('Field Completeness')).toBeInTheDocument();
      // Should show priority fields
      expect(screen.getByText('email')).toBeInTheDocument();
      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('company')).toBeInTheDocument();
    });

    it('renders tier distribution', () => {
      render(<DataQualityPanel prospects={mockProspects} />);
      
      expect(screen.getByText('Tier Distribution')).toBeInTheDocument();
      expect(screen.getByText('Tier 1')).toBeInTheDocument();
      expect(screen.getByText('Tier 2')).toBeInTheDocument();
      expect(screen.getByText('Tier 3')).toBeInTheDocument();
    });

    it('renders recommendations', () => {
      render(<DataQualityPanel prospects={mockProspects} />);
      
      expect(screen.getByText('Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Enrich missing emails using pattern inference')).toBeInTheDocument();
    });

    it('renders footer with prospect count and timestamp', () => {
      render(<DataQualityPanel prospects={mockProspects} />);
      
      expect(screen.getByText('100 prospects analyzed')).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('renders compact version with minimal info', () => {
      render(<DataQualityPanel prospects={mockProspects} compact />);
      
      // Should still show score
      expect(screen.getByText('72')).toBeInTheDocument();
      expect(screen.getByText('Good')).toBeInTheDocument();
      
      // Should not show detailed sections
      expect(screen.queryByText('Field Completeness')).not.toBeInTheDocument();
      expect(screen.queryByText('Recommendations')).not.toBeInTheDocument();
    });

    it('shows contactable count in compact mode', () => {
      render(<DataQualityPanel prospects={mockProspects} compact />);
      
      expect(screen.getByText('80 contactable prospects')).toBeInTheDocument();
    });
  });

  describe('Quality Levels', () => {
    it('applies correct color for good quality', () => {
      render(<DataQualityPanel prospects={mockProspects} />);
      
      const qualityBadge = screen.getByText('Good');
      expect(qualityBadge.className).toContain('text-blue-600');
    });
  });

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      const { container } = render(
        <DataQualityPanel prospects={mockProspects} className="custom-class" />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Score Breakdown', () => {
    it('shows all breakdown components', () => {
      render(<DataQualityPanel prospects={mockProspects} />);
      
      expect(screen.getByText('Completeness')).toBeInTheDocument();
      expect(screen.getByText('Email Quality')).toBeInTheDocument();
      expect(screen.getByText('Duplicate Risk')).toBeInTheDocument();
      expect(screen.getByText('Data Freshness')).toBeInTheDocument();
    });

    it('displays breakdown percentages', () => {
      render(<DataQualityPanel prospects={mockProspects} />);
      
      // Multiple elements may have same percentage - use getAllByText
      expect(screen.getAllByText('80%').length).toBeGreaterThanOrEqual(1); // completeness + email field
      expect(screen.getByText('75%')).toBeInTheDocument(); // emailQuality
      expect(screen.getByText('90%')).toBeInTheDocument(); // duplicateRisk
      expect(screen.getByText('65%')).toBeInTheDocument(); // dataFreshness
    });
  });
});

/**
 * Tests for Company List View Component
 * 
 * Sprint 72: T72.1a - Company List UI
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CompanyListView } from '../../components/CompanyListView';
import type { CompanyRow } from '../../services/CompanyAggregator';
import type { Prospect } from '../../types';
import type { CompanyTier } from '../../types/marketing';

// Mock virtualizer for lists
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }).map((_, i) => ({
      index: i,
      start: i * 50,
      size: 50,
      key: i,
    })),
    getTotalSize: () => count * 50,
  }),
}));

// Helper to create mock prospects
function createMockProspect(overrides: Partial<Prospect> = {}): Prospect {
  return {
    id: Math.random().toString(36).substr(2, 9),
    name: 'John Doe',
    title: 'VP Operations',
    company: 'Acme Corp',
    score: 75,
    qualified: true,
    isExec: false,
    isOps: true,
    status: 'new',
    notes: '',
    tier: 'Tier 1',
    ...overrides,
  };
}

// Helper to create mock company rows
function createMockCompanyRow(overrides: Partial<CompanyRow> = {}): CompanyRow {
  const contacts = [
    createMockProspect({ name: 'John Doe', isExec: true }),
    createMockProspect({ name: 'Jane Smith', isOps: true }),
  ];
  
  return {
    id: 'acme-corp',
    company: 'Acme Corporation',
    tier: 'Tier 2' as CompanyTier,
    contactCount: 2,
    facilityCount: 50,
    hasGateBottleneck: true,
    gateConfidence: 'high',
    gateLabel: 'Likely',
    industryCategory: 'beverage',
    estimatedTruckVolume: 100,
    distributionFootprint: 'national',
    primoLookalikeScore: 65,
    roiPotential: 50_000_000,
    contacts,
    execCount: 1,
    opsCount: 1,
    execOpsCount: 0,
    lastResearchedAt: null,
    needsResearch: false,
    ...overrides,
  };
}

describe('CompanyListView', () => {
  let mockOnCompanySelect: (company: CompanyRow) => void;
  let mockOnContactSelect: (prospect: Prospect) => void;
  let mockOnResearchClick: ((company: CompanyRow) => void) | undefined;
  let mockOnSearchChange: ((term: string) => void) | undefined;
  let mockOnSortChange: ((sortBy: 'roi' | 'score' | 'facilities' | 'contacts') => void) | undefined;
  let companies: CompanyRow[];

  beforeEach(() => {
    mockOnCompanySelect = vi.fn();
    mockOnContactSelect = vi.fn();
    mockOnResearchClick = vi.fn();
    mockOnSearchChange = vi.fn();
    mockOnSortChange = vi.fn();
    companies = [
      createMockCompanyRow({
        id: 'primo',
        company: 'Primo Brands',
        tier: 'Tier 1',
        facilityCount: 260,
        primoLookalikeScore: 95,
        roiPotential: 260_000_000,
        industryCategory: 'beverage',
      }),
      createMockCompanyRow({
        id: 'acme',
        company: 'Acme Corp',
        tier: 'Tier 2',
        facilityCount: 50,
        primoLookalikeScore: 65,
        roiPotential: 50_000_000,
        needsResearch: true,
      }),
      createMockCompanyRow({
        id: 'small',
        company: 'Small Co',
        tier: 'Tier 3',
        facilityCount: 10,
        primoLookalikeScore: 35,
        roiPotential: 10_000_000,
      }),
    ];
  });

  it('renders company list', () => {
    render(
      <CompanyListView
        companies={companies}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
      />
    );

    expect(screen.getByText('Primo Brands')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Small Co')).toBeInTheDocument();
  });

  it('displays company count footer', () => {
    render(
      <CompanyListView
        companies={companies}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
      />
    );

    expect(screen.getByText('3 Companies')).toBeInTheDocument();
  });

  it('calls onCompanySelect when clicking a company', () => {
    render(
      <CompanyListView
        companies={companies}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
      />
    );

    fireEvent.click(screen.getByText('Primo Brands'));
    expect(mockOnCompanySelect).toHaveBeenCalledWith(companies[0]);
  });

  it('expands to show contacts when toggle clicked', () => {
    render(
      <CompanyListView
        companies={companies}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
      />
    );

    // Contacts should not be visible initially
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();

    // Click the expand button (first one)
    const expandButtons = screen.getAllByLabelText('Expand contacts');
    fireEvent.click(expandButtons[0]);

    // Now contacts should be visible
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('collapses contacts when toggle clicked again', () => {
    render(
      <CompanyListView
        companies={companies}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
      />
    );

    // Expand
    const expandButton = screen.getAllByLabelText('Expand contacts')[0];
    fireEvent.click(expandButton);
    expect(screen.getByText('John Doe')).toBeInTheDocument();

    // Collapse
    const collapseButton = screen.getByLabelText('Collapse contacts');
    fireEvent.click(collapseButton);
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('calls onContactSelect when clicking a contact', () => {
    render(
      <CompanyListView
        companies={companies}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
      />
    );

    // Expand first company
    const expandButton = screen.getAllByLabelText('Expand contacts')[0];
    fireEvent.click(expandButton);

    // Click on contact
    fireEvent.click(screen.getByText('John Doe'));
    expect(mockOnContactSelect).toHaveBeenCalled();
  });

  it('displays tier badges with correct styling', () => {
    render(
      <CompanyListView
        companies={companies}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
      />
    );

    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText('T2')).toBeInTheDocument();
    expect(screen.getByText('T3')).toBeInTheDocument();
  });

  it('shows facility count with star for 60+ facilities', () => {
    render(
      <CompanyListView
        companies={companies}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
      />
    );

    // 260 facilities should have a star
    expect(screen.getByText('260')).toBeInTheDocument();
    expect(screen.getByText('★')).toBeInTheDocument();
  });

  it('shows Research button for companies needing research', () => {
    render(
      <CompanyListView
        companies={companies}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
        onResearchClick={mockOnResearchClick}
      />
    );

    // Only Acme has needsResearch: true
    const researchButtons = screen.getAllByText('Research');
    expect(researchButtons).toHaveLength(1);
  });

  it('calls onResearchClick when Research button clicked', () => {
    render(
      <CompanyListView
        companies={companies}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
        onResearchClick={mockOnResearchClick}
      />
    );

    fireEvent.click(screen.getByText('Research'));
    expect(mockOnResearchClick).toHaveBeenCalledWith(companies[1]); // Acme
  });

  it('formats ROI correctly', () => {
    render(
      <CompanyListView
        companies={companies}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
      />
    );

    expect(screen.getByText('$260M')).toBeInTheDocument();
    expect(screen.getByText('$50M')).toBeInTheDocument();
  });

  it('renders search input when onSearchChange provided', () => {
    render(
      <CompanyListView
        companies={companies}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
        onSearchChange={mockOnSearchChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search companies...');
    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Primo' } });
    expect(mockOnSearchChange).toHaveBeenCalledWith('Primo');
  });

  it('renders sort buttons when onSortChange provided', () => {
    render(
      <CompanyListView
        companies={companies}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
        onSortChange={mockOnSortChange}
        sortBy="score"
      />
    );

    // Use getAllByRole to find buttons specifically
    const sortButtons = screen.getAllByRole('button');
    const facilitiesButton = sortButtons.find(btn => btn.textContent?.includes('Facilities'));
    const contactsButton = sortButtons.find(btn => btn.textContent?.includes('Contacts'));
    const roiButton = sortButtons.find(btn => btn.textContent?.includes('ROI'));
    
    expect(facilitiesButton).toBeInTheDocument();
    expect(contactsButton).toBeInTheDocument();
    expect(roiButton).toBeInTheDocument();

    if (facilitiesButton) {
      fireEvent.click(facilitiesButton);
      expect(mockOnSortChange).toHaveBeenCalledWith('facilities');
    }
  });

  it('highlights selected company', () => {
    render(
      <CompanyListView
        companies={companies}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
        selectedCompanyId="primo"
      />
    );

    // Check that Primo Brands has the selected styling
    const primoText = screen.getByText('Primo Brands');
    expect(primoText).toHaveClass('text-blue-700');
  });

  it('shows empty state when no companies', () => {
    render(
      <CompanyListView
        companies={[]}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
      />
    );

    // Sprint 34: Updated empty state with better messaging
    expect(screen.getByText('No companies found')).toBeInTheDocument();
    expect(screen.getByText('Import prospects to see companies here')).toBeInTheDocument();
    expect(screen.getByText('0 Companies')).toBeInTheDocument();
  });

  it('shows industry and distribution footprint', () => {
    render(
      <CompanyListView
        companies={companies}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
      />
    );

    // Use getAllBy since these may appear multiple times
    const beverageElements = screen.getAllByText(/beverage/i);
    expect(beverageElements.length).toBeGreaterThan(0);
    const nationalElements = screen.getAllByText(/national/i);
    expect(nationalElements.length).toBeGreaterThan(0);
  });

  it('handles keyboard navigation', () => {
    render(
      <CompanyListView
        companies={companies}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
      />
    );

    const rows = screen.getAllByRole('row');
    const companyRow = rows.find(r => r.textContent?.includes('Primo Brands'));
    
    if (companyRow) {
      fireEvent.keyDown(companyRow, { key: 'Enter' });
      expect(mockOnCompanySelect).toHaveBeenCalled();
    }
  });

  it('shows contact persona badges', () => {
    render(
      <CompanyListView
        companies={companies}
        onCompanySelect={mockOnCompanySelect}
        onContactSelect={mockOnContactSelect}
      />
    );

    // Expand first company
    const expandButton = screen.getAllByLabelText('Expand contacts')[0];
    fireEvent.click(expandButton);

    // Check for persona badges - use getAllBy since there may be multiple
    const execBadges = screen.getAllByText('Exec');
    expect(execBadges.length).toBeGreaterThan(0);
    const opsBadges = screen.getAllByText('Ops');
    expect(opsBadges.length).toBeGreaterThan(0);
  });
});

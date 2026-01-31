/**
 * Tests for HotListPanel component
 * Sprint 203: Hot List & Daily Briefing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HotListPanel } from '@/components/HotListPanel';

// Mock Firebase
const mockGetDocs = vi.fn();

vi.mock('firebase/app', () => ({
  getApp: () => ({}),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  limit: () => ({}),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

describe('HotListPanel', () => {
  const createMockProspects = () => [
    {
      id: 'prospect-1',
      tier: 'Tier 1',
      name: 'John Doe',
      email: 'john@example.com',
      company: 'Acme Inc',
      needsResponse: true,
      emailOpened: true,
    },
    {
      id: 'prospect-2',
      tier: 'Tier 2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      company: 'Tech Corp',
      emailClicked: true,
    },
    {
      id: 'prospect-3',
      tier: 'Tier 3',
      name: 'Bob Wilson',
      email: 'bob@example.com',
      company: 'StartupCo',
    },
  ];

  const createMockSnapshot = (prospects: ReturnType<typeof createMockProspects>) => ({
    docs: prospects.map((p) => ({
      id: p.id,
      data: () => p,
    })),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocs.mockResolvedValue(createMockSnapshot(createMockProspects()));
  });

  it('should render loading state initially', () => {
    // Make getDocs never resolve to stay in loading
    mockGetDocs.mockImplementation(() => new Promise(() => {}));

    render(<HotListPanel />);

    expect(screen.getByText('Hot List')).toBeInTheDocument();
    expect(screen.getByTestId('hotlist-panel')).toBeInTheDocument();
  });

  it('should render list of hot prospects', async () => {
    render(<HotListPanel />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
  });

  it('should show tier badges', async () => {
    render(<HotListPanel />);

    await waitFor(() => {
      expect(screen.getByText('T1')).toBeInTheDocument();
    });

    expect(screen.getByText('T2')).toBeInTheDocument();
    expect(screen.getByText('T3')).toBeInTheDocument();
  });

  it('should show engagement indicators', async () => {
    render(<HotListPanel />);

    await waitFor(() => {
      expect(screen.getByText('Replied')).toBeInTheDocument();
    });

    expect(screen.getByText('Clicked')).toBeInTheDocument();
    expect(screen.getByText('Opened')).toBeInTheDocument();
  });

  it('should sort by score (highest first)', async () => {
    render(<HotListPanel />);

    await waitFor(() => {
      const items = screen.getAllByTestId(/hotlist-item/);
      expect(items[0]).toHaveTextContent('John Doe'); // Tier 1 + needsResponse
    });
  });

  it('should call onProspectClick when clicking prospect name', async () => {
    const onProspectClick = vi.fn();
    render(<HotListPanel onProspectClick={onProspectClick} />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('John Doe'));

    expect(onProspectClick).toHaveBeenCalledWith('prospect-1');
  });

  it('should expand to show reasons when clicking expand button', async () => {
    render(<HotListPanel />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const expandButtons = screen.getAllByLabelText('Expand reasons');
    fireEvent.click(expandButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Why this prospect is hot:')).toBeInTheDocument();
      expect(screen.getByText('Tier 1 account')).toBeInTheDocument();
    });
  });

  it('should refresh when clicking refresh button', async () => {
    render(<HotListPanel />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    mockGetDocs.mockClear();
    
    fireEvent.click(screen.getByTitle('Refresh'));

    await waitFor(() => {
      expect(mockGetDocs).toHaveBeenCalled();
    });
  });

  it('should render empty state when no prospects', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    render(<HotListPanel />);

    await waitFor(() => {
      expect(screen.getByText('No hot prospects')).toBeInTheDocument();
      expect(screen.getByText('Start outreach to build your hot list')).toBeInTheDocument();
    });
  });

  it('should render error state on failure', async () => {
    mockGetDocs.mockRejectedValue(new Error('Network error'));

    render(<HotListPanel />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('should retry on error', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('Network error'));
    mockGetDocs.mockResolvedValueOnce(createMockSnapshot(createMockProspects()));

    render(<HotListPanel />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('should respect maxProspects prop', async () => {
    render(<HotListPanel maxProspects={2} />);

    await waitFor(() => {
      const items = screen.getAllByTestId(/hotlist-item/);
      expect(items).toHaveLength(2);
    });
  });

  it('should show priority counts in header', async () => {
    render(<HotListPanel />);

    await waitFor(() => {
      // John Doe has score >= 50 (critical: Tier1 + needsResponse)
      expect(screen.getByText(/critical/)).toBeInTheDocument();
    });
  });
});

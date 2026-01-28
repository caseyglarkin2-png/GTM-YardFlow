/**
 * Leaderboard Component Tests
 * Sprint 28B - T28B.5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { 
  Leaderboard, 
  CompactLeaderboard,
  type LeaderboardProps,
  type CompactLeaderboardProps,
} from '../../components/Leaderboard';
import type { UserActivitySummary } from '../../types/analytics';

const mockUsers: UserActivitySummary[] = [
  {
    userId: 'user1',
    userName: 'Alice Johnson',
    userAvatar: 'https://example.com/alice.jpg',
    totalActivities: 150,
    prospectsContacted: 45,
    dealsCreated: 12,
    dealsWon: 8,
    revenue: 125000,
    avgResponseTime: 2.5,
    rank: 1,
  },
  {
    userId: 'user2',
    userName: 'Bob Smith',
    totalActivities: 120,
    prospectsContacted: 38,
    dealsCreated: 10,
    dealsWon: 6,
    revenue: 95000,
    avgResponseTime: 3.2,
    rank: 2,
  },
  {
    userId: 'user3',
    userName: 'Carol Davis',
    totalActivities: 100,
    prospectsContacted: 30,
    dealsCreated: 8,
    dealsWon: 5,
    revenue: 75000,
    avgResponseTime: 4.0,
    rank: 3,
  },
  {
    userId: 'user4',
    userName: 'David Lee',
    totalActivities: 80,
    prospectsContacted: 25,
    dealsCreated: 6,
    dealsWon: 3,
    revenue: 45000,
    avgResponseTime: 5.5,
    rank: 4,
  },
  {
    userId: 'user5',
    userName: 'Eve Wilson',
    totalActivities: 60,
    prospectsContacted: 20,
    dealsCreated: 4,
    dealsWon: 2,
    revenue: 30000,
    avgResponseTime: 6.0,
    rank: 5,
  },
  {
    userId: 'user6',
    userName: 'Frank Brown',
    totalActivities: 40,
    prospectsContacted: 15,
    dealsCreated: 2,
    dealsWon: 1,
    revenue: 15000,
    avgResponseTime: 8.0,
    rank: 6,
  },
];

describe('Leaderboard', () => {
  const defaultProps: LeaderboardProps = {
    data: mockUsers.slice(0, 5),
  };

  describe('rendering', () => {
    it('renders the leaderboard', () => {
      render(<Leaderboard {...defaultProps} />);
      expect(screen.getByTestId('leaderboard')).toBeInTheDocument();
    });

    it('displays the default title', () => {
      render(<Leaderboard {...defaultProps} />);
      expect(screen.getByTestId('leaderboard-title')).toHaveTextContent('Top Performers');
    });

    it('displays custom title', () => {
      render(<Leaderboard {...defaultProps} title="Sales Leaders" />);
      expect(screen.getByTestId('leaderboard-title')).toHaveTextContent('Sales Leaders');
    });

    it('renders all users in data', () => {
      render(<Leaderboard {...defaultProps} />);
      const items = screen.getAllByTestId('leaderboard-item');
      expect(items).toHaveLength(5);
    });

    it('applies custom className', () => {
      render(<Leaderboard {...defaultProps} className="custom-class" />);
      expect(screen.getByTestId('leaderboard')).toHaveClass('custom-class');
    });
  });

  describe('user display', () => {
    it('shows user names', () => {
      render(<Leaderboard {...defaultProps} />);
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    });

    it('shows activity count', () => {
      render(<Leaderboard {...defaultProps} />);
      const activities = screen.getAllByTestId('user-activities');
      expect(activities[0]).toHaveTextContent('150 activities');
    });

    it('shows prospects contacted', () => {
      render(<Leaderboard {...defaultProps} />);
      const prospects = screen.getAllByTestId('user-prospects');
      expect(prospects[0]).toHaveTextContent('45 prospects');
    });

    it('shows revenue formatted as currency', () => {
      render(<Leaderboard {...defaultProps} />);
      const revenues = screen.getAllByTestId('user-revenue');
      expect(revenues[0]).toHaveTextContent('$125,000');
    });

    it('shows deals won/created', () => {
      render(<Leaderboard {...defaultProps} />);
      const deals = screen.getAllByTestId('user-deals');
      expect(deals[0]).toHaveTextContent('8 won / 12 created');
    });
  });

  describe('rank display', () => {
    it('shows rank by default', () => {
      render(<Leaderboard {...defaultProps} />);
      const ranks = screen.getAllByTestId('user-rank');
      expect(ranks).toHaveLength(5);
    });

    it('hides rank when showRank is false', () => {
      render(<Leaderboard {...defaultProps} showRank={false} />);
      expect(screen.queryByTestId('user-rank')).not.toBeInTheDocument();
    });

    it('shows gold medal for rank 1', () => {
      render(<Leaderboard {...defaultProps} />);
      const ranks = screen.getAllByTestId('user-rank');
      expect(ranks[0]).toHaveTextContent('🥇');
    });

    it('shows silver medal for rank 2', () => {
      render(<Leaderboard {...defaultProps} />);
      const ranks = screen.getAllByTestId('user-rank');
      expect(ranks[1]).toHaveTextContent('🥈');
    });

    it('shows bronze medal for rank 3', () => {
      render(<Leaderboard {...defaultProps} />);
      const ranks = screen.getAllByTestId('user-rank');
      expect(ranks[2]).toHaveTextContent('🥉');
    });

    it('shows number for rank 4+', () => {
      render(<Leaderboard {...defaultProps} />);
      const ranks = screen.getAllByTestId('user-rank');
      expect(ranks[3]).toHaveTextContent('4');
    });
  });

  describe('avatar display', () => {
    it('shows avatar by default', () => {
      render(<Leaderboard {...defaultProps} />);
      const avatars = screen.getAllByTestId('user-avatar');
      expect(avatars).toHaveLength(5);
    });

    it('hides avatar when showAvatar is false', () => {
      render(<Leaderboard {...defaultProps} showAvatar={false} />);
      expect(screen.queryByTestId('user-avatar')).not.toBeInTheDocument();
    });

    it('shows image when avatar URL is provided', () => {
      render(<Leaderboard {...defaultProps} />);
      // First user has avatar
      expect(screen.getByTestId('user-avatar-image')).toBeInTheDocument();
    });

    it('shows initials when no avatar URL', () => {
      render(<Leaderboard {...defaultProps} />);
      // Second user (Bob Smith) has no avatar - should show initials
      const initials = screen.getAllByTestId('user-avatar-initials');
      expect(initials.length).toBeGreaterThan(0);
      expect(initials[0]).toHaveTextContent('BS');
    });
  });

  describe('max items', () => {
    it('limits displayed items to maxItems', () => {
      render(<Leaderboard data={mockUsers} maxItems={3} />);
      const items = screen.getAllByTestId('leaderboard-item');
      expect(items).toHaveLength(3);
    });

    it('shows "+N more" when there are more items', () => {
      render(<Leaderboard data={mockUsers} maxItems={3} />);
      expect(screen.getByTestId('leaderboard-more')).toHaveTextContent('+3 more');
    });

    it('does not show "+N more" when all items fit', () => {
      render(<Leaderboard data={mockUsers.slice(0, 3)} maxItems={5} />);
      expect(screen.queryByTestId('leaderboard-more')).not.toBeInTheDocument();
    });
  });

  describe('interactivity', () => {
    it('calls onUserClick when user is clicked', () => {
      const onUserClick = vi.fn();
      render(<Leaderboard {...defaultProps} onUserClick={onUserClick} />);
      
      const items = screen.getAllByTestId('leaderboard-item');
      fireEvent.click(items[0]);
      
      expect(onUserClick).toHaveBeenCalledWith(mockUsers[0]);
    });

    it('has button role when clickable', () => {
      const onUserClick = vi.fn();
      render(<Leaderboard {...defaultProps} onUserClick={onUserClick} />);
      
      const items = screen.getAllByTestId('leaderboard-item');
      expect(items[0]).toHaveAttribute('role', 'button');
    });

    it('has no role when not clickable', () => {
      render(<Leaderboard {...defaultProps} />);
      
      const items = screen.getAllByTestId('leaderboard-item');
      expect(items[0]).not.toHaveAttribute('role');
    });
  });

  describe('empty state', () => {
    it('shows empty message when no data', () => {
      render(<Leaderboard data={[]} />);
      expect(screen.getByTestId('leaderboard-empty')).toHaveTextContent('No data available');
    });

    it('does not show list when no data', () => {
      render(<Leaderboard data={[]} />);
      expect(screen.queryByTestId('leaderboard-list')).not.toBeInTheDocument();
    });
  });
});

describe('CompactLeaderboard', () => {
  const defaultProps: CompactLeaderboardProps = {
    data: mockUsers.slice(0, 5),
    metric: 'revenue',
  };

  describe('rendering', () => {
    it('renders the compact leaderboard', () => {
      render(<CompactLeaderboard {...defaultProps} />);
      expect(screen.getByTestId('compact-leaderboard')).toBeInTheDocument();
    });

    it('displays the default title', () => {
      render(<CompactLeaderboard {...defaultProps} />);
      expect(screen.getByTestId('compact-leaderboard-title')).toHaveTextContent('Top Performers');
    });

    it('displays custom title', () => {
      render(<CompactLeaderboard {...defaultProps} title="Revenue Leaders" />);
      expect(screen.getByTestId('compact-leaderboard-title')).toHaveTextContent('Revenue Leaders');
    });

    it('renders items with progress bars', () => {
      render(<CompactLeaderboard {...defaultProps} />);
      const progressBars = screen.getAllByTestId('progress-bar');
      expect(progressBars).toHaveLength(5);
    });

    it('applies custom className', () => {
      render(<CompactLeaderboard {...defaultProps} className="custom-compact" />);
      expect(screen.getByTestId('compact-leaderboard')).toHaveClass('custom-compact');
    });
  });

  describe('metrics', () => {
    it('shows revenue values', () => {
      render(<CompactLeaderboard {...defaultProps} metric="revenue" />);
      expect(screen.getByText('$125,000')).toBeInTheDocument();
    });

    it('shows activities values', () => {
      render(<CompactLeaderboard {...defaultProps} metric="activities" />);
      expect(screen.getByText('150')).toBeInTheDocument();
    });

    it('shows deals values', () => {
      render(<CompactLeaderboard {...defaultProps} metric="deals" />);
      expect(screen.getByText('8 won')).toBeInTheDocument();
    });

    it('shows response time values', () => {
      render(<CompactLeaderboard {...defaultProps} metric="responseTime" />);
      expect(screen.getByText('2.5h')).toBeInTheDocument();
    });
  });

  describe('max items', () => {
    it('limits displayed items to maxItems', () => {
      render(<CompactLeaderboard data={mockUsers} metric="revenue" maxItems={3} />);
      const items = screen.getAllByTestId('compact-leaderboard-item');
      expect(items).toHaveLength(3);
    });
  });

  describe('progress bars', () => {
    it('sets 100% width for top performer', () => {
      render(<CompactLeaderboard {...defaultProps} />);
      const progressBars = screen.getAllByTestId('progress-bar');
      expect(progressBars[0]).toHaveStyle({ width: '100%' });
    });

    it('sets proportional width for others', () => {
      render(<CompactLeaderboard {...defaultProps} />);
      const progressBars = screen.getAllByTestId('progress-bar');
      // Second user has $95k of $125k = 76%
      const width = parseInt(progressBars[1].style.width);
      expect(width).toBeGreaterThan(70);
      expect(width).toBeLessThan(80);
    });
  });
});

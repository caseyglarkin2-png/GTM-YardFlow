/**
 * SyncStatus Component Tests
 * 
 * Tests for the sync status indicators
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncStatus, SyncIndicator, OfflineBanner, SyncingToast } from '../../components/SyncStatus';

describe('SyncStatus Component', () => {
  describe('SyncStatus Badge', () => {
    it('renders synced status correctly', () => {
      render(<SyncStatus status="synced" pendingCount={0} />);
      
      expect(screen.getByTestId('sync-status')).toBeInTheDocument();
      expect(screen.getByText('Synced')).toBeInTheDocument();
    });
    
    it('renders syncing status with animation', () => {
      render(<SyncStatus status="syncing" pendingCount={5} />);
      
      expect(screen.getByText('Syncing')).toBeInTheDocument();
      expect(screen.getByText('(5 pending)')).toBeInTheDocument();
    });
    
    it('renders offline status', () => {
      render(<SyncStatus status="offline" pendingCount={3} />);
      
      expect(screen.getByText('Offline')).toBeInTheDocument();
      expect(screen.getByText('(3 pending)')).toBeInTheDocument();
    });
    
    it('renders error status with retry button', () => {
      const onRetry = vi.fn();
      render(<SyncStatus status="error" pendingCount={2} onRetry={onRetry} />);
      
      expect(screen.getByText('Error')).toBeInTheDocument();
      
      const retryButton = screen.getByLabelText('Retry sync');
      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalled();
    });
    
    it('hides pending count when showDetails is false', () => {
      render(<SyncStatus status="syncing" pendingCount={5} showDetails={false} />);
      
      expect(screen.getByText('Syncing')).toBeInTheDocument();
      expect(screen.queryByText('(5 pending)')).not.toBeInTheDocument();
    });
    
    it('has correct ARIA role and live region', () => {
      render(<SyncStatus status="synced" pendingCount={0} />);
      
      const status = screen.getByTestId('sync-status');
      expect(status).toHaveAttribute('role', 'status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });
    
    it('applies custom className', () => {
      render(<SyncStatus status="synced" pendingCount={0} className="custom-class" />);
      
      expect(screen.getByTestId('sync-status')).toHaveClass('custom-class');
    });
  });
  
  describe('SyncIndicator', () => {
    it('renders synced indicator', () => {
      render(<SyncIndicator status="synced" />);
      
      const indicator = screen.getByTestId('sync-indicator');
      expect(indicator).toBeInTheDocument();
    });
    
    it('renders offline indicator', () => {
      render(<SyncIndicator status="offline" />);
      
      const indicator = screen.getByTestId('sync-indicator');
      expect(indicator).toBeInTheDocument();
    });
    
    it('applies custom className', () => {
      render(<SyncIndicator status="synced" className="custom-indicator" />);
      
      expect(screen.getByTestId('sync-indicator')).toHaveClass('custom-indicator');
    });
  });
  
  describe('SyncingToast', () => {
    it('renders sync progress', () => {
      render(<SyncingToast processed={5} total={10} />);
      
      expect(screen.getByTestId('syncing-toast')).toBeInTheDocument();
      expect(screen.getByText('Syncing changes...')).toBeInTheDocument();
      expect(screen.getByText('5 of 10 (50%)')).toBeInTheDocument();
    });
    
    it('calculates percentage correctly', () => {
      render(<SyncingToast processed={3} total={4} />);
      
      expect(screen.getByText('3 of 4 (75%)')).toBeInTheDocument();
    });
    
    it('handles zero total gracefully', () => {
      render(<SyncingToast processed={0} total={0} />);
      
      expect(screen.getByText('Syncing changes...')).toBeInTheDocument();
      // Should not show progress when total is 0
      expect(screen.queryByText(/of/)).not.toBeInTheDocument();
    });
    
    it('has status role', () => {
      render(<SyncingToast processed={1} total={5} />);
      
      expect(screen.getByTestId('syncing-toast')).toHaveAttribute('role', 'status');
    });
  });
  
  describe('OfflineBanner', () => {
    it('renders when visible', () => {
      render(<OfflineBanner />);
      
      expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
      expect(screen.getByText(/offline/i)).toBeInTheDocument();
    });
    
    it('renders banner (component always renders)', () => {
      // OfflineBanner always renders when mounted
      render(<OfflineBanner />);
      
      // Verify the banner renders
      const banner = screen.queryByTestId('offline-banner');
      expect(banner).toBeInTheDocument();
    });
    
    it('shows pending count with changes text', () => {
      render(<OfflineBanner pendingCount={7} />);
      
      // The actual text is "7 changes will sync when you reconnect"
      expect(screen.getByText(/7/)).toBeInTheDocument();
      expect(screen.getByText(/will sync/i)).toBeInTheDocument();
    });
    
    it('has alert role', () => {
      render(<OfflineBanner />);
      
      expect(screen.getByTestId('offline-banner')).toHaveAttribute('role', 'alert');
    });
  });
});

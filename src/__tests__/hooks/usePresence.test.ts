/**
 * usePresence Hook Tests
 * Sprint 34 - T34.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePresence, usePresenceViewTracker } from '../../hooks/usePresence';

// Mock the PresenceService
const mockSubscribe = vi.fn();
const mockDestroy = vi.fn();
const mockSetCurrentView = vi.fn();
const mockClearCurrentView = vi.fn();
const mockGetUsersViewingDoc = vi.fn();
const mockGetUsersInView = vi.fn();
const mockGetMyStatus = vi.fn();

const mockPresenceService = {
  subscribe: mockSubscribe,
  destroy: mockDestroy,
  setCurrentView: mockSetCurrentView,
  clearCurrentView: mockClearCurrentView,
  getUsersViewingDoc: mockGetUsersViewingDoc,
  getUsersInView: mockGetUsersInView,
  getMyStatus: mockGetMyStatus,
  getAllPresences: vi.fn(() => []),
  getOnlineUsers: vi.fn(() => []),
  getActiveUsers: vi.fn(() => []),
  updateMyPresence: vi.fn(),
  getMyPresence: vi.fn(),
  getTimeSinceActive: vi.fn(() => 0),
  updateUserPresence: vi.fn(),
  removeUserPresence: vi.fn(),
  setAllPresences: vi.fn(),
  getIdleUsers: vi.fn(() => []),
  getUserPresence: vi.fn(),
  getPresenceCount: vi.fn(() => ({ online: 0, idle: 0, offline: 0, total: 0 })),
  _handleActivity: vi.fn(),
  _sendHeartbeat: vi.fn(),
};

vi.mock('../../services/PresenceService', () => ({
  createPresenceService: vi.fn(() => mockPresenceService),
}));

describe('usePresence', () => {
  const defaultConfig = {
    tenantId: 'tenant-123',
    userId: 'user-123',
    displayName: 'Test User',
    email: 'test@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribe.mockReturnValue(() => {});
    mockGetUsersViewingDoc.mockReturnValue([]);
    mockGetUsersInView.mockReturnValue([]);
    mockGetMyStatus.mockReturnValue('online');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with offline status when disabled', () => {
    const { result } = renderHook(() => usePresence({ ...defaultConfig, enabled: false }));

    expect(result.current.service).toBeNull();
    expect(result.current.isReady).toBe(false);
    expect(result.current.myStatus).toBe('offline');
  });

  it('should initialize with offline status when userId is missing', () => {
    const { result } = renderHook(() => usePresence({ ...defaultConfig, userId: '' }));

    expect(result.current.service).toBeNull();
    expect(result.current.isReady).toBe(false);
  });

  it('should initialize with offline status when tenantId is missing', () => {
    const { result } = renderHook(() => usePresence({ ...defaultConfig, tenantId: '' }));

    expect(result.current.service).toBeNull();
    expect(result.current.isReady).toBe(false);
  });

  it('should create presence service when enabled', async () => {
    const { createPresenceService } = await import('../../services/PresenceService');
    
    const { result } = renderHook(() => usePresence(defaultConfig));

    expect(createPresenceService).toHaveBeenCalledWith({
      tenantId: 'tenant-123',
      userId: 'user-123',
      displayName: 'Test User',
      email: 'test@example.com',
      avatarUrl: undefined,
    });
    expect(result.current.service).toBe(mockPresenceService);
    expect(result.current.isReady).toBe(true);
  });

  it('should subscribe to presence updates', async () => {
    renderHook(() => usePresence(defaultConfig));

    expect(mockSubscribe).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should update activeUsers when presence callback fires', async () => {
    let presenceCallback: (users: unknown[]) => void = () => {};
    mockSubscribe.mockImplementation((cb) => {
      presenceCallback = cb;
      return () => {};
    });

    const { result } = renderHook(() => usePresence(defaultConfig));

    const mockUsers = [
      { userId: 'user-123', displayName: 'Test User', status: 'online', lastActive: new Date().toISOString() },
      { userId: 'user-456', displayName: 'Other User', status: 'online', lastActive: new Date().toISOString() },
      { userId: 'user-789', displayName: 'Offline User', status: 'offline', lastActive: new Date().toISOString() },
    ];

    act(() => {
      presenceCallback(mockUsers);
    });

    // Should only include non-offline users
    expect(result.current.activeUsers).toHaveLength(2);
    expect(result.current.onlineCount).toBe(2);
  });

  it('should update myStatus from presence callback', async () => {
    let presenceCallback: (users: unknown[]) => void = () => {};
    mockSubscribe.mockImplementation((cb) => {
      presenceCallback = cb;
      return () => {};
    });

    const { result } = renderHook(() => usePresence(defaultConfig));

    act(() => {
      presenceCallback([
        { userId: 'user-123', displayName: 'Test User', status: 'idle', lastActive: new Date().toISOString() },
      ]);
    });

    expect(result.current.myStatus).toBe('idle');
  });

  it('should call setCurrentView on service when setView is called', () => {
    const { result } = renderHook(() => usePresence(defaultConfig));

    act(() => {
      result.current.setView('prospects', 'doc-123');
    });

    expect(mockSetCurrentView).toHaveBeenCalledWith('prospects', 'doc-123');
  });

  it('should call clearCurrentView on service when clearView is called', () => {
    const { result } = renderHook(() => usePresence(defaultConfig));

    act(() => {
      result.current.clearView();
    });

    expect(mockClearCurrentView).toHaveBeenCalled();
  });

  it('should delegate getUsersViewingDoc to service', () => {
    mockGetUsersViewingDoc.mockReturnValue([
      { userId: 'user-456', displayName: 'Other User', status: 'online', lastActive: new Date().toISOString() },
    ]);

    const { result } = renderHook(() => usePresence(defaultConfig));

    const users = result.current.getUsersViewingDoc('doc-123');

    expect(mockGetUsersViewingDoc).toHaveBeenCalledWith('doc-123');
    expect(users).toHaveLength(1);
  });

  it('should delegate getUsersInView to service', () => {
    mockGetUsersInView.mockReturnValue([
      { userId: 'user-456', displayName: 'Other User', status: 'online', lastActive: new Date().toISOString() },
    ]);

    const { result } = renderHook(() => usePresence(defaultConfig));

    const users = result.current.getUsersInView('dashboard');

    expect(mockGetUsersInView).toHaveBeenCalledWith('dashboard');
    expect(users).toHaveLength(1);
  });

  it('should return empty arrays when service is not ready', () => {
    const { result } = renderHook(() => usePresence({ ...defaultConfig, enabled: false }));

    expect(result.current.getUsersViewingDoc('doc-123')).toEqual([]);
    expect(result.current.getUsersInView('dashboard')).toEqual([]);
  });

  it('should destroy service on unmount', () => {
    const { unmount } = renderHook(() => usePresence(defaultConfig));

    unmount();

    expect(mockDestroy).toHaveBeenCalled();
  });

  it('should unsubscribe on unmount', () => {
    const mockUnsubscribe = vi.fn();
    mockSubscribe.mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => usePresence(defaultConfig));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

describe('usePresenceViewTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set current view when mounted', () => {
    renderHook(() => usePresenceViewTracker(mockPresenceService as any, 'prospects', 'doc-123'));

    expect(mockSetCurrentView).toHaveBeenCalledWith('prospects', 'doc-123');
  });

  it('should update view when view changes', () => {
    const { rerender } = renderHook(
      ({ view, docId }) => usePresenceViewTracker(mockPresenceService as any, view, docId),
      { initialProps: { view: 'prospects', docId: 'doc-123' } }
    );

    expect(mockSetCurrentView).toHaveBeenCalledWith('prospects', 'doc-123');

    rerender({ view: 'dashboard', docId: '' });

    expect(mockSetCurrentView).toHaveBeenCalledWith('dashboard', '');
  });

  it('should not set view when service is null', () => {
    renderHook(() => usePresenceViewTracker(null, 'prospects', 'doc-123'));

    expect(mockSetCurrentView).not.toHaveBeenCalled();
  });
});

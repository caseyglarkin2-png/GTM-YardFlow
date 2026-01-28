/**
 * useCommandPalette Hook
 * 
 * Manages command palette state and keyboard shortcuts.
 */

import { useState, useCallback, useEffect } from 'react';
import { getKeyboardNavigationService } from '../services/KeyboardNavigationService';

export interface UseCommandPaletteReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  recentCommands: string[];
  recordCommandUsage: (commandId: string) => void;
}

export function useCommandPalette(): UseCommandPaletteReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  const recordCommandUsage = useCallback((commandId: string) => {
    setRecentCommands(prev => {
      const filtered = prev.filter(id => id !== commandId);
      return [commandId, ...filtered].slice(0, 10);
    });
  }, []);

  // Register Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const service = getKeyboardNavigationService();
    
    service.registerShortcut({
      id: 'commandPalette.open',
      key: 'k',
      modifiers: { ctrl: true },
      description: 'Open command palette',
      category: 'Navigation',
      action: toggle,
      global: true,
    });

    // Also register Cmd+K for Mac
    service.registerShortcut({
      id: 'commandPalette.openMeta',
      key: 'k',
      modifiers: { meta: true },
      description: 'Open command palette',
      category: 'Navigation',
      action: toggle,
      global: true,
    });

    return () => {
      service.unregisterShortcut('commandPalette.open');
      service.unregisterShortcut('commandPalette.openMeta');
    };
  }, [toggle]);

  return {
    isOpen,
    open,
    close,
    toggle,
    recentCommands,
    recordCommandUsage,
  };
}

export default useCommandPalette;

/**
 * KeyboardNavigationService Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  KeyboardNavigationService,
  KeyboardShortcut,
  isMac,
  getPrimaryModifier,
  formatShortcut,
  parseShortcut,
  matchesShortcut,
  isInputElement,
  registerDefaultShortcuts,
  getKeyboardNavigationService,
  resetKeyboardNavigationService,
} from '../../services/KeyboardNavigationService';

// Mock navigator
const mockNavigator = (platform: string) => {
  Object.defineProperty(global, 'navigator', {
    value: { platform },
    writable: true,
    configurable: true,
  });
};

describe('isMac', () => {
  it('returns true on macOS', () => {
    mockNavigator('MacIntel');
    expect(isMac()).toBe(true);
  });

  it('returns false on Windows', () => {
    mockNavigator('Win32');
    expect(isMac()).toBe(false);
  });

  it('returns false on Linux', () => {
    mockNavigator('Linux x86_64');
    expect(isMac()).toBe(false);
  });
});

describe('getPrimaryModifier', () => {
  it('returns meta on Mac', () => {
    mockNavigator('MacIntel');
    expect(getPrimaryModifier()).toBe('meta');
  });

  it('returns ctrl on Windows', () => {
    mockNavigator('Win32');
    expect(getPrimaryModifier()).toBe('ctrl');
  });
});

describe('formatShortcut', () => {
  beforeEach(() => {
    mockNavigator('Win32');
  });

  it('formats simple key', () => {
    const shortcut: KeyboardShortcut = {
      id: 'test',
      key: 'a',
      modifiers: {},
      description: 'Test',
      category: 'Test',
      action: () => {},
    };
    
    expect(formatShortcut(shortcut)).toBe('A');
  });

  it('formats ctrl+key on Windows', () => {
    mockNavigator('Win32');
    const shortcut: KeyboardShortcut = {
      id: 'test',
      key: 'k',
      modifiers: { ctrl: true },
      description: 'Test',
      category: 'Test',
      action: () => {},
    };
    
    expect(formatShortcut(shortcut)).toBe('Ctrl+K');
  });

  it('formats multiple modifiers', () => {
    const shortcut: KeyboardShortcut = {
      id: 'test',
      key: 'p',
      modifiers: { ctrl: true, shift: true },
      description: 'Test',
      category: 'Test',
      action: () => {},
    };
    
    expect(formatShortcut(shortcut)).toBe('Ctrl+Shift+P');
  });
});

describe('parseShortcut', () => {
  it('parses simple shortcut', () => {
    const result = parseShortcut('Ctrl+K');
    
    expect(result).toEqual({
      key: 'k',
      modifiers: { ctrl: true },
    });
  });

  it('parses complex shortcut', () => {
    const result = parseShortcut('Ctrl+Shift+P');
    
    expect(result).toEqual({
      key: 'p',
      modifiers: { ctrl: true, shift: true },
    });
  });

  it('parses cmd shortcut', () => {
    const result = parseShortcut('Cmd+K');
    
    expect(result).toEqual({
      key: 'k',
      modifiers: { meta: true },
    });
  });

  it('returns null for invalid shortcut', () => {
    const result = parseShortcut('Ctrl+');
    expect(result).toBeNull();
  });
});

describe('matchesShortcut', () => {
  it('matches simple shortcut', () => {
    const shortcut: KeyboardShortcut = {
      id: 'test',
      key: 'k',
      modifiers: { ctrl: true },
      description: 'Test',
      category: 'Test',
      action: () => {},
    };

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
    });

    expect(matchesShortcut(event, shortcut)).toBe(true);
  });

  it('does not match wrong key', () => {
    const shortcut: KeyboardShortcut = {
      id: 'test',
      key: 'k',
      modifiers: { ctrl: true },
      description: 'Test',
      category: 'Test',
      action: () => {},
    };

    const event = new KeyboardEvent('keydown', {
      key: 'j',
      ctrlKey: true,
    });

    expect(matchesShortcut(event, shortcut)).toBe(false);
  });

  it('does not match wrong modifiers', () => {
    const shortcut: KeyboardShortcut = {
      id: 'test',
      key: 'k',
      modifiers: { ctrl: true },
      description: 'Test',
      category: 'Test',
      action: () => {},
    };

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: false,
    });

    expect(matchesShortcut(event, shortcut)).toBe(false);
  });

  it('matches with shift', () => {
    const shortcut: KeyboardShortcut = {
      id: 'test',
      key: 'z',
      modifiers: { ctrl: true, shift: true },
      description: 'Test',
      category: 'Test',
      action: () => {},
    };

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      shiftKey: true,
    });

    expect(matchesShortcut(event, shortcut)).toBe(true);
  });
});

describe('isInputElement', () => {
  it('returns true for input element', () => {
    const input = document.createElement('input');
    expect(isInputElement(input)).toBe(true);
  });

  it('returns true for textarea', () => {
    const textarea = document.createElement('textarea');
    expect(isInputElement(textarea)).toBe(true);
  });

  it('returns true for select', () => {
    const select = document.createElement('select');
    expect(isInputElement(select)).toBe(true);
  });

  it('returns true for contenteditable', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    expect(isInputElement(div)).toBe(true);
  });

  it('returns false for regular element', () => {
    const div = document.createElement('div');
    expect(isInputElement(div)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isInputElement(null)).toBe(false);
  });
});

describe('KeyboardNavigationService', () => {
  let service: KeyboardNavigationService;

  beforeEach(() => {
    resetKeyboardNavigationService();
    service = new KeyboardNavigationService();
  });

  describe('shortcuts', () => {
    it('registers a shortcut', () => {
      const shortcut: KeyboardShortcut = {
        id: 'test.shortcut',
        key: 'k',
        modifiers: { ctrl: true },
        description: 'Test shortcut',
        category: 'Test',
        action: vi.fn(),
      };

      service.registerShortcut(shortcut);
      
      expect(service.getShortcuts().length).toBe(1);
    });

    it('unregisters a shortcut', () => {
      service.registerShortcut({
        id: 'test.shortcut',
        key: 'k',
        modifiers: {},
        description: 'Test',
        category: 'Test',
        action: () => {},
      });

      service.unregisterShortcut('test.shortcut');
      
      expect(service.getShortcuts().length).toBe(0);
    });

    it('groups shortcuts by category', () => {
      service.registerShortcut({
        id: 's1',
        key: 'a',
        modifiers: {},
        description: 'A',
        category: 'Navigation',
        action: () => {},
      });
      service.registerShortcut({
        id: 's2',
        key: 'b',
        modifiers: {},
        description: 'B',
        category: 'Navigation',
        action: () => {},
      });
      service.registerShortcut({
        id: 's3',
        key: 'c',
        modifiers: {},
        description: 'C',
        category: 'Actions',
        action: () => {},
      });

      const byCategory = service.getShortcutsByCategory();
      
      expect(byCategory.get('Navigation')?.length).toBe(2);
      expect(byCategory.get('Actions')?.length).toBe(1);
    });
  });

  describe('commands', () => {
    it('registers a command', () => {
      service.registerCommand({
        id: 'test.command',
        name: 'Test Command',
        category: 'Test',
        action: vi.fn(),
      });
      
      expect(service.getCommands().length).toBe(1);
    });

    it('executes a command', async () => {
      const action = vi.fn();
      service.registerCommand({
        id: 'test.command',
        name: 'Test Command',
        category: 'Test',
        action,
      });

      const result = await service.executeCommand('test.command');
      
      expect(result).toBe(true);
      expect(action).toHaveBeenCalled();
    });

    it('returns false for non-existent command', async () => {
      const result = await service.executeCommand('nonexistent');
      expect(result).toBe(false);
    });

    it('returns false for disabled command', async () => {
      const action = vi.fn();
      service.registerCommand({
        id: 'test.command',
        name: 'Test Command',
        category: 'Test',
        action,
        enabled: false,
      });

      const result = await service.executeCommand('test.command');
      
      expect(result).toBe(false);
      expect(action).not.toHaveBeenCalled();
    });

    it('searches commands', () => {
      service.registerCommand({
        id: 'search.open',
        name: 'Open Search',
        description: 'Opens the search panel',
        category: 'Navigation',
        action: () => {},
      });
      service.registerCommand({
        id: 'filter.apply',
        name: 'Apply Filter',
        category: 'Filters',
        action: () => {},
      });

      const results = service.searchCommands('search');
      
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('search.open');
    });
  });

  describe('navigation context', () => {
    it('creates navigation context', () => {
      const items = [
        { id: '1', element: document.createElement('div') },
        { id: '2', element: document.createElement('div') },
      ];

      const context = service.createNavigationContext('list', items);
      
      expect(context.items.length).toBe(2);
      expect(context.selectedIndex).toBe(-1);
    });

    it('navigates to next item', () => {
      const items = [
        { id: '1', element: document.createElement('div') },
        { id: '2', element: document.createElement('div') },
        { id: '3', element: document.createElement('div') },
      ];

      service.createNavigationContext('list', items);
      
      const item1 = service.navigateNext('list');
      expect(item1?.id).toBe('1');
      
      const item2 = service.navigateNext('list');
      expect(item2?.id).toBe('2');
    });

    it('wraps around at end', () => {
      const items = [
        { id: '1', element: document.createElement('div') },
        { id: '2', element: document.createElement('div') },
      ];

      service.createNavigationContext('list', items);
      
      service.navigateNext('list'); // 1
      service.navigateNext('list'); // 2
      const wrapped = service.navigateNext('list'); // wrap to 1
      
      expect(wrapped?.id).toBe('1');
    });

    it('navigates to previous item', () => {
      const items = [
        { id: '1', element: document.createElement('div') },
        { id: '2', element: document.createElement('div') },
      ];

      service.createNavigationContext('list', items);
      service.navigateNext('list'); // 1
      service.navigateNext('list'); // 2
      
      const prev = service.navigatePrevious('list');
      
      expect(prev?.id).toBe('1');
    });

    it('skips disabled items', () => {
      const items = [
        { id: '1', element: document.createElement('div') },
        { id: '2', element: document.createElement('div'), disabled: true },
        { id: '3', element: document.createElement('div') },
      ];

      service.createNavigationContext('list', items);
      
      service.navigateNext('list'); // 1
      const skipped = service.navigateNext('list'); // skip 2, go to 3
      
      expect(skipped?.id).toBe('3');
    });

    it('selects current item', () => {
      const onSelect = vi.fn();
      const items = [
        { id: '1', element: document.createElement('div'), onSelect },
        { id: '2', element: document.createElement('div') },
      ];

      service.createNavigationContext('list', items);
      service.navigateNext('list'); // Select first
      service.selectCurrent('list');
      
      expect(onSelect).toHaveBeenCalled();
    });

    it('resets selection', () => {
      const items = [
        { id: '1', element: document.createElement('div') },
      ];

      service.createNavigationContext('list', items);
      service.navigateNext('list');
      service.resetSelection('list');
      
      const context = service.getNavigationContext('list');
      expect(context?.selectedIndex).toBe(-1);
    });
  });

  describe('listeners', () => {
    it('adds and removes listeners', () => {
      const listener = vi.fn();
      
      service.addListener(listener);
      expect(() => service.removeListener(listener)).not.toThrow();
    });
  });

  describe('clear', () => {
    it('clears all shortcuts and commands', () => {
      service.registerShortcut({
        id: 's1',
        key: 'a',
        modifiers: {},
        description: 'A',
        category: 'Test',
        action: () => {},
      });
      service.registerCommand({
        id: 'c1',
        name: 'Command',
        category: 'Test',
        action: () => {},
      });

      service.clear();
      
      expect(service.getShortcuts().length).toBe(0);
      expect(service.getCommands().length).toBe(0);
    });
  });
});

describe('registerDefaultShortcuts', () => {
  let service: KeyboardNavigationService;

  beforeEach(() => {
    mockNavigator('Win32');
    service = new KeyboardNavigationService();
  });

  it('registers search shortcut', () => {
    const openSearch = vi.fn();
    registerDefaultShortcuts(service, { openSearch });
    
    const shortcuts = service.getShortcuts();
    const search = shortcuts.find(s => s.id === 'global.search');
    
    expect(search).toBeDefined();
    expect(search?.key).toBe('f');
  });

  it('registers command palette shortcut', () => {
    const openCommandPalette = vi.fn();
    registerDefaultShortcuts(service, { openCommandPalette });
    
    const shortcuts = service.getShortcuts();
    const palette = shortcuts.find(s => s.id === 'global.commandPalette');
    
    expect(palette).toBeDefined();
    expect(palette?.key).toBe('k');
  });

  it('registers save shortcut', () => {
    const save = vi.fn();
    registerDefaultShortcuts(service, { save });
    
    const shortcuts = service.getShortcuts();
    const saveShortcut = shortcuts.find(s => s.id === 'global.save');
    
    expect(saveShortcut).toBeDefined();
    expect(saveShortcut?.key).toBe('s');
  });

  it('registers undo/redo shortcuts', () => {
    registerDefaultShortcuts(service, {
      undo: vi.fn(),
      redo: vi.fn(),
    });
    
    const shortcuts = service.getShortcuts();
    
    expect(shortcuts.find(s => s.id === 'global.undo')).toBeDefined();
    expect(shortcuts.find(s => s.id === 'global.redo')).toBeDefined();
  });

  it('registers escape shortcut', () => {
    const escape = vi.fn();
    registerDefaultShortcuts(service, { escape });
    
    const shortcuts = service.getShortcuts();
    const escapeShortcut = shortcuts.find(s => s.id === 'global.escape');
    
    expect(escapeShortcut?.key).toBe('Escape');
  });
});

describe('getKeyboardNavigationService', () => {
  beforeEach(() => {
    resetKeyboardNavigationService();
  });

  it('returns singleton instance', () => {
    const instance1 = getKeyboardNavigationService();
    const instance2 = getKeyboardNavigationService();
    
    expect(instance1).toBe(instance2);
  });

  it('creates new instance after reset', () => {
    const instance1 = getKeyboardNavigationService();
    resetKeyboardNavigationService();
    const instance2 = getKeyboardNavigationService();
    
    expect(instance1).not.toBe(instance2);
  });
});

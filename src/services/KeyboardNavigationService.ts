/**
 * KeyboardNavigationService
 * 
 * Provides keyboard navigation and shortcuts for the application.
 * Supports customizable keybindings and command registration.
 */

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  id: string;
  key: string;
  modifiers: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean; // Cmd on Mac
  };
  description: string;
  category: string;
  action: () => void | Promise<void>;
  enabled?: boolean;
  global?: boolean; // Works even when focus is in an input
}

/**
 * Registered command
 */
export interface RegisteredCommand {
  id: string;
  name: string;
  description?: string;
  category: string;
  action: () => void | Promise<void>;
  shortcut?: string; // Display string like "Ctrl+K"
  icon?: string;
  enabled?: boolean;
}

/**
 * Navigation item for lists
 */
export interface NavigableItem {
  id: string;
  element: HTMLElement;
  onSelect?: () => void;
  disabled?: boolean;
}

/**
 * Navigation context for keyboard list navigation
 */
export interface NavigationContext {
  items: NavigableItem[];
  selectedIndex: number;
  wrapAround: boolean;
  orientation: 'vertical' | 'horizontal';
}

/**
 * Platform detection
 */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.platform.toLowerCase().includes('mac');
}

/**
 * Get the modifier key name based on platform
 */
export function getPrimaryModifier(): 'meta' | 'ctrl' {
  return isMac() ? 'meta' : 'ctrl';
}

/**
 * Format a shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  const { modifiers, key } = shortcut;

  if (modifiers.meta) parts.push(isMac() ? '⌘' : 'Win');
  if (modifiers.ctrl) parts.push(isMac() ? '⌃' : 'Ctrl');
  if (modifiers.alt) parts.push(isMac() ? '⌥' : 'Alt');
  if (modifiers.shift) parts.push(isMac() ? '⇧' : 'Shift');

  // Capitalize single letters
  const displayKey = key.length === 1 ? key.toUpperCase() : key;
  parts.push(displayKey);

  return isMac() ? parts.join('') : parts.join('+');
}

/**
 * Parse a shortcut string like "Ctrl+K" or "Cmd+Shift+P"
 */
export function parseShortcut(shortcutString: string): Omit<KeyboardShortcut, 'id' | 'description' | 'category' | 'action'> | null {
  const parts = shortcutString.toLowerCase().split('+').map(p => p.trim());
  
  const modifiers: KeyboardShortcut['modifiers'] = {};
  let key = '';

  for (const part of parts) {
    switch (part) {
      case 'ctrl':
      case 'control':
        modifiers.ctrl = true;
        break;
      case 'cmd':
      case 'meta':
      case 'command':
        modifiers.meta = true;
        break;
      case 'shift':
        modifiers.shift = true;
        break;
      case 'alt':
      case 'option':
        modifiers.alt = true;
        break;
      default:
        key = part;
    }
  }

  if (!key) return null;

  return { key, modifiers };
}

/**
 * Check if a keyboard event matches a shortcut
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const { key, modifiers } = shortcut;
  
  // Check key (case insensitive for letters)
  const eventKey = event.key.toLowerCase();
  const shortcutKey = key.toLowerCase();
  if (eventKey !== shortcutKey) return false;

  // Check modifiers
  if (!!modifiers.ctrl !== event.ctrlKey) return false;
  if (!!modifiers.shift !== event.shiftKey) return false;
  if (!!modifiers.alt !== event.altKey) return false;
  if (!!modifiers.meta !== event.metaKey) return false;

  return true;
}

/**
 * Check if the event target is an input element
 */
export function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  // Check both the property and attribute for contentEditable
  if (target.isContentEditable === true) return true;
  if (target.getAttribute('contenteditable') === 'true') return true;
  
  return false;
}

/**
 * KeyboardNavigationService class
 */
export class KeyboardNavigationService {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private commands: Map<string, RegisteredCommand> = new Map();
  private contexts: Map<string, NavigationContext> = new Map();
  private listeners: Set<(event: KeyboardEvent) => void> = new Set();
  private enabled: boolean = true;
  private boundHandler: (event: KeyboardEvent) => void;

  constructor() {
    this.boundHandler = this.handleKeyDown.bind(this);
  }

  /**
   * Start listening for keyboard events
   */
  start(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this.boundHandler);
    }
  }

  /**
   * Stop listening for keyboard events
   */
  stop(): void {
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.boundHandler);
    }
  }

  /**
   * Enable or disable all keyboard handling
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Handle keydown event
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.enabled) return;

    // Check if we're in an input and should skip non-global shortcuts
    const inInput = isInputElement(event.target);

    // Check shortcuts
    for (const shortcut of this.shortcuts.values()) {
      if (shortcut.enabled === false) continue;
      if (inInput && !shortcut.global) continue;

      if (matchesShortcut(event, shortcut)) {
        event.preventDefault();
        event.stopPropagation();
        shortcut.action();
        return;
      }
    }

    // Notify listeners
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * Register a keyboard shortcut
   */
  registerShortcut(shortcut: KeyboardShortcut): void {
    this.shortcuts.set(shortcut.id, shortcut);
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregisterShortcut(id: string): void {
    this.shortcuts.delete(id);
  }

  /**
   * Get all registered shortcuts
   */
  getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Get shortcuts by category
   */
  getShortcutsByCategory(): Map<string, KeyboardShortcut[]> {
    const byCategory = new Map<string, KeyboardShortcut[]>();
    
    for (const shortcut of this.shortcuts.values()) {
      const category = shortcut.category;
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category)!.push(shortcut);
    }

    return byCategory;
  }

  /**
   * Register a command
   */
  registerCommand(command: RegisteredCommand): void {
    this.commands.set(command.id, command);
  }

  /**
   * Unregister a command
   */
  unregisterCommand(id: string): void {
    this.commands.delete(id);
  }

  /**
   * Get all registered commands
   */
  getCommands(): RegisteredCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Execute a command by ID
   */
  async executeCommand(id: string): Promise<boolean> {
    const command = this.commands.get(id);
    if (!command || command.enabled === false) return false;

    await command.action();
    return true;
  }

  /**
   * Search commands by name
   */
  searchCommands(query: string): RegisteredCommand[] {
    const lowerQuery = query.toLowerCase();
    return this.getCommands().filter(
      cmd =>
        cmd.enabled !== false &&
        (cmd.name.toLowerCase().includes(lowerQuery) ||
          cmd.description?.toLowerCase().includes(lowerQuery) ||
          cmd.category.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Add a keydown event listener
   */
  addListener(listener: (event: KeyboardEvent) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove a keydown event listener
   */
  removeListener(listener: (event: KeyboardEvent) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Create a navigation context for list navigation
   */
  createNavigationContext(
    id: string,
    items: NavigableItem[],
    options?: Partial<NavigationContext>
  ): NavigationContext {
    const context: NavigationContext = {
      items,
      selectedIndex: -1,
      wrapAround: true,
      orientation: 'vertical',
      ...options,
    };

    this.contexts.set(id, context);
    return context;
  }

  /**
   * Get a navigation context
   */
  getNavigationContext(id: string): NavigationContext | undefined {
    return this.contexts.get(id);
  }

  /**
   * Update navigation context
   */
  updateNavigationContext(id: string, updates: Partial<NavigationContext>): void {
    const context = this.contexts.get(id);
    if (context) {
      Object.assign(context, updates);
    }
  }

  /**
   * Remove a navigation context
   */
  removeNavigationContext(id: string): void {
    this.contexts.delete(id);
  }

  /**
   * Navigate to next item in context
   */
  navigateNext(contextId: string): NavigableItem | undefined {
    const context = this.contexts.get(contextId);
    if (!context || context.items.length === 0) return undefined;

    let newIndex = context.selectedIndex + 1;
    
    if (newIndex >= context.items.length) {
      if (context.wrapAround) {
        newIndex = 0;
      } else {
        newIndex = context.items.length - 1;
      }
    }

    // Skip disabled items
    let attempts = 0;
    while (context.items[newIndex]?.disabled && attempts < context.items.length) {
      newIndex = (newIndex + 1) % context.items.length;
      attempts++;
    }

    context.selectedIndex = newIndex;
    return context.items[newIndex];
  }

  /**
   * Navigate to previous item in context
   */
  navigatePrevious(contextId: string): NavigableItem | undefined {
    const context = this.contexts.get(contextId);
    if (!context || context.items.length === 0) return undefined;

    let newIndex = context.selectedIndex - 1;
    
    if (newIndex < 0) {
      if (context.wrapAround) {
        newIndex = context.items.length - 1;
      } else {
        newIndex = 0;
      }
    }

    // Skip disabled items
    let attempts = 0;
    while (context.items[newIndex]?.disabled && attempts < context.items.length) {
      newIndex = (newIndex - 1 + context.items.length) % context.items.length;
      attempts++;
    }

    context.selectedIndex = newIndex;
    return context.items[newIndex];
  }

  /**
   * Select current item in context
   */
  selectCurrent(contextId: string): NavigableItem | undefined {
    const context = this.contexts.get(contextId);
    if (!context || context.selectedIndex < 0) return undefined;

    const item = context.items[context.selectedIndex];
    if (item && !item.disabled && item.onSelect) {
      item.onSelect();
    }
    return item;
  }

  /**
   * Reset selection in context
   */
  resetSelection(contextId: string): void {
    const context = this.contexts.get(contextId);
    if (context) {
      context.selectedIndex = -1;
    }
  }

  /**
   * Clear all shortcuts and commands
   */
  clear(): void {
    this.shortcuts.clear();
    this.commands.clear();
    this.contexts.clear();
    this.listeners.clear();
  }
}

/**
 * Register default application shortcuts
 */
export function registerDefaultShortcuts(
  service: KeyboardNavigationService,
  handlers: {
    openSearch?: () => void;
    openCommandPalette?: () => void;
    save?: () => void;
    undo?: () => void;
    redo?: () => void;
    newItem?: () => void;
    delete?: () => void;
    escape?: () => void;
    help?: () => void;
  }
): void {
  const primaryMod = getPrimaryModifier();

  if (handlers.openSearch) {
    service.registerShortcut({
      id: 'global.search',
      key: 'f',
      modifiers: { [primaryMod]: true },
      description: 'Open search',
      category: 'Navigation',
      action: handlers.openSearch,
      global: true,
    });
  }

  if (handlers.openCommandPalette) {
    service.registerShortcut({
      id: 'global.commandPalette',
      key: 'k',
      modifiers: { [primaryMod]: true },
      description: 'Open command palette',
      category: 'Navigation',
      action: handlers.openCommandPalette,
      global: true,
    });
  }

  if (handlers.save) {
    service.registerShortcut({
      id: 'global.save',
      key: 's',
      modifiers: { [primaryMod]: true },
      description: 'Save',
      category: 'Actions',
      action: handlers.save,
      global: true,
    });
  }

  if (handlers.undo) {
    service.registerShortcut({
      id: 'global.undo',
      key: 'z',
      modifiers: { [primaryMod]: true },
      description: 'Undo',
      category: 'Edit',
      action: handlers.undo,
      global: false,
    });
  }

  if (handlers.redo) {
    service.registerShortcut({
      id: 'global.redo',
      key: 'z',
      modifiers: { [primaryMod]: true, shift: true },
      description: 'Redo',
      category: 'Edit',
      action: handlers.redo,
      global: false,
    });
  }

  if (handlers.newItem) {
    service.registerShortcut({
      id: 'global.new',
      key: 'n',
      modifiers: { [primaryMod]: true },
      description: 'New item',
      category: 'Actions',
      action: handlers.newItem,
      global: false,
    });
  }

  if (handlers.delete) {
    service.registerShortcut({
      id: 'global.delete',
      key: 'Delete',
      modifiers: {},
      description: 'Delete selected',
      category: 'Actions',
      action: handlers.delete,
      global: false,
    });

    service.registerShortcut({
      id: 'global.deleteBackspace',
      key: 'Backspace',
      modifiers: {},
      description: 'Delete selected',
      category: 'Actions',
      action: handlers.delete,
      global: false,
    });
  }

  if (handlers.escape) {
    service.registerShortcut({
      id: 'global.escape',
      key: 'Escape',
      modifiers: {},
      description: 'Cancel / Close',
      category: 'Navigation',
      action: handlers.escape,
      global: true,
    });
  }

  if (handlers.help) {
    service.registerShortcut({
      id: 'global.help',
      key: '?',
      modifiers: { shift: true },
      description: 'Show keyboard shortcuts',
      category: 'Help',
      action: handlers.help,
      global: false,
    });
  }
}

/**
 * Singleton instance
 */
let globalKeyboardService: KeyboardNavigationService | null = null;

/**
 * Get or create the global keyboard navigation service
 */
export function getKeyboardNavigationService(): KeyboardNavigationService {
  if (!globalKeyboardService) {
    globalKeyboardService = new KeyboardNavigationService();
    globalKeyboardService.start();
  }
  return globalKeyboardService;
}

/**
 * Reset the global service (for testing)
 */
export function resetKeyboardNavigationService(): void {
  if (globalKeyboardService) {
    globalKeyboardService.stop();
    globalKeyboardService = null;
  }
}

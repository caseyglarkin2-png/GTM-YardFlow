/**
 * CommandPalette Component
 * 
 * A keyboard-driven command palette (Cmd+K / Ctrl+K) for quick access
 * to actions, navigation, and search across the application.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RegisteredCommand } from '../services/KeyboardNavigationService';
import { CommandPaletteResult, PaletteResult, PaletteResultType } from './CommandPaletteResult';
import { useFocusTrap } from '@/hooks/useFocusTrap';

// Re-export the hook for backwards compatibility
export { useCommandPalette } from '../hooks/useCommandPalette';

/**
 * Default icons for categories
 */
const CATEGORY_ICONS: Record<string, string> = {
  Navigation: '🧭',
  Actions: '⚡',
  Edit: '✏️',
  Filters: '🔖',
  Help: '❓',
  Search: '🔍',
};

const TYPE_ICONS: Record<PaletteResultType, string> = {
  command: '⚡',
  search: '🔍',
  recent: '🕐',
  filter: '🔖',
};

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands?: RegisteredCommand[];
  recentCommands?: string[];
  placeholder?: string;
  maxResults?: number;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands = [],
  recentCommands = [],
  placeholder = 'Type a command or search...',
  maxResults = 10,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<PaletteResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build results based on query
  useEffect(() => {
    const newResults: PaletteResult[] = [];

    if (!query.trim()) {
      // Show recent commands first
      for (const cmdId of recentCommands.slice(0, 5)) {
        const cmd = commands.find(c => c.id === cmdId);
        if (cmd && cmd.enabled !== false) {
          newResults.push({
            id: `recent-${cmd.id}`,
            type: 'recent',
            title: cmd.name,
            subtitle: cmd.description,
            icon: cmd.icon || CATEGORY_ICONS[cmd.category] || TYPE_ICONS.recent,
            shortcut: cmd.shortcut,
            category: cmd.category,
            action: cmd.action,
          });
        }
      }

      // Show available commands
      for (const cmd of commands.filter(c => c.enabled !== false)) {
        if (!recentCommands.includes(cmd.id)) {
          newResults.push({
            id: `cmd-${cmd.id}`,
            type: 'command',
            title: cmd.name,
            subtitle: cmd.description,
            icon: cmd.icon || CATEGORY_ICONS[cmd.category] || TYPE_ICONS.command,
            shortcut: cmd.shortcut,
            category: cmd.category,
            action: cmd.action,
          });
        }
      }
    } else {
      // Search commands
      const lowerQuery = query.toLowerCase();
      const matchingCommands = commands.filter(
        cmd =>
          cmd.enabled !== false &&
          (cmd.name.toLowerCase().includes(lowerQuery) ||
            cmd.description?.toLowerCase().includes(lowerQuery) ||
            cmd.category.toLowerCase().includes(lowerQuery))
      );

      for (const cmd of matchingCommands) {
        newResults.push({
          id: `cmd-${cmd.id}`,
          type: 'command',
          title: cmd.name,
          subtitle: cmd.description,
          icon: cmd.icon || CATEGORY_ICONS[cmd.category] || TYPE_ICONS.command,
          shortcut: cmd.shortcut,
          category: cmd.category,
          action: cmd.action,
        });
      }
    }

    setResults(newResults.slice(0, maxResults));
    setSelectedIndex(0);
  }, [query, commands, recentCommands, maxResults]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && results.length > 0 && selectedIndex < listRef.current.children.length) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement?.scrollIntoView) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, results.length]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (results.length === 0 && event.key !== 'Escape') return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev => (prev + 1) % results.length);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
          break;
        case 'Enter':
          event.preventDefault();
          if (results[selectedIndex]) {
            results[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        case 'Tab':
          event.preventDefault();
          if (event.shiftKey) {
            setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
          } else {
            setSelectedIndex(prev => (prev + 1) % results.length);
          }
          break;
      }
    },
    [results, selectedIndex, onClose]
  );

  const handleResultClick = useCallback(
    (result: PaletteResult, index: number) => {
      setSelectedIndex(index);
      result.action();
      onClose();
    },
    [onClose]
  );

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const dialogRef = useFocusTrap(isOpen, { onEscape: onClose, returnFocus: true });

  if (!isOpen) return null;

  // Group results by category
  const groupedResults = results.reduce<Record<string, PaletteResult[]>>((acc, result) => {
    const category = result.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(result);
    return acc;
  }, {});

  let resultIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-palette-label"
      data-testid="command-palette-overlay"
    >
      <div ref={dialogRef} className="w-full max-w-xl bg-white rounded-lg shadow-2xl overflow-hidden" data-testid="command-palette">
        {/* Hidden title for screen readers */}
        <h2 id="command-palette-label" className="sr-only">Command Palette</h2>
        
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-gray-200">
          <span className="text-gray-400 mr-3" aria-hidden="true">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none text-lg"
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls="command-palette-listbox"
            aria-activedescendant={results.length > 0 ? `command-palette-option-${selectedIndex}` : undefined}
            role="combobox"
            aria-expanded={results.length > 0}
            data-testid="command-palette-input"
          />
          <kbd className="hidden sm:inline-block px-2 py-1 text-xs text-gray-400 bg-gray-100 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="command-palette-listbox"
          className="max-h-80 overflow-y-auto"
          role="listbox"
          aria-label="Command results"
        >
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              {query ? 'No results found' : 'No commands available'}
            </div>
          ) : (
            Object.entries(groupedResults).map(([category, categoryResults]) => (
              <div key={category}>
                <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                  {category}
                </div>
                {categoryResults.map(result => {
                  const currentIndex = resultIndex++;
                  return (
                    <CommandPaletteResult
                      key={result.id}
                      result={result}
                      isSelected={currentIndex === selectedIndex}
                      index={currentIndex}
                      onClick={handleResultClick}
                      onMouseEnter={setSelectedIndex}
                    />
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded mr-1">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">↓</kbd>
              {' '}to navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">↵</kbd>
              {' '}to select
            </span>
          </div>
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;

/**
 * CommandPaletteResult Component
 * 
 * Individual result item for the command palette.
 */

import React from 'react';

export type PaletteResultType = 'command' | 'search' | 'recent' | 'filter';

export interface PaletteResult {
  id: string;
  type: PaletteResultType;
  title: string;
  subtitle?: string;
  icon?: string;
  shortcut?: string;
  category?: string;
  action: () => void;
  data?: unknown;
}

interface CommandPaletteResultProps {
  result: PaletteResult;
  isSelected: boolean;
  index: number;
  onClick: (result: PaletteResult, index: number) => void;
  onMouseEnter: (index: number) => void;
}

export const CommandPaletteResult: React.FC<CommandPaletteResultProps> = ({
  result,
  isSelected,
  index,
  onClick,
  onMouseEnter,
}) => {
  return (
    <div
      id={`command-palette-option-${index}`}
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
      onClick={() => onClick(result, index)}
      onMouseEnter={() => onMouseEnter(index)}
      className={`px-4 py-3 flex items-center cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      <span className="text-lg mr-3">{result.icon}</span>
      <div className="flex-1 min-w-0">
        <div className={`font-medium ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
          {result.title}
        </div>
        {result.subtitle && (
          <div className="text-sm text-gray-500 truncate">{result.subtitle}</div>
        )}
      </div>
      {result.shortcut && (
        <kbd className="ml-2 px-2 py-1 text-xs text-gray-400 bg-gray-100 rounded">
          {result.shortcut}
        </kbd>
      )}
    </div>
  );
};

export default CommandPaletteResult;

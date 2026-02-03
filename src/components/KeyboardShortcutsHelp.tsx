import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export interface ShortcutItem {
  key: string;
  description: string;
}

const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  { key: '/', description: 'Focus search' },
  { key: 'n', description: 'New prospect' },
  { key: 'e', description: 'Send email' },
  { key: 'j / k', description: 'Navigate lists' },
  { key: 'Enter', description: 'Select item' },
  { key: 'Esc', description: 'Close modal' },
];

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts?: ShortcutItem[];
}

export function KeyboardShortcutsHelp({ isOpen, onClose, shortcuts = DEFAULT_SHORTCUTS }: KeyboardShortcutsHelpProps) {
  const dialogRef = useFocusTrap(isOpen, { onEscape: onClose, returnFocus: true });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
        className="bg-white rounded-lg shadow-2xl w-full max-w-md"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 id="keyboard-shortcuts-title" className="text-lg font-semibold text-slate-800">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            aria-label="Close shortcuts help"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {shortcuts.map(({ key, description }) => (
            <div key={key} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <kbd className="min-w-[64px] text-center px-2 py-1 bg-slate-100 text-slate-700 rounded font-mono text-sm">
                {key}
              </kbd>
              <span className="text-sm text-slate-700">{description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default KeyboardShortcutsHelp;

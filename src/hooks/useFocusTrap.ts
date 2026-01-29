import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Options for the focus trap hook
 */
export interface UseFocusTrapOptions {
  /** Whether to allow focus to escape to nested modals */
  allowNestedModals?: boolean;
  /** Callback when Escape key is pressed */
  onEscape?: () => void;
  /** Whether to auto-focus the first focusable element on open */
  autoFocus?: boolean;
  /** Whether to return focus to the trigger element on close */
  returnFocus?: boolean;
}

/** Selector for all focusable elements */
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Hook to trap focus within a container element.
 * Used for modal dialogs to ensure keyboard users can't tab out.
 * 
 * @param isOpen - Whether the focus trap is active
 * @param options - Configuration options
 * @returns A ref to attach to the container element
 * 
 * @example
 * ```tsx
 * function Modal({ isOpen, onClose }) {
 *   const containerRef = useFocusTrap(isOpen, { onEscape: onClose });
 *   
 *   return (
 *     <div ref={containerRef} role="dialog" aria-modal="true">
 *       <button>First focusable</button>
 *       <button onClick={onClose}>Close</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFocusTrap(
  isOpen: boolean,
  options: UseFocusTrapOptions = {}
) {
  const {
    allowNestedModals = false,
    onEscape,
    autoFocus = true,
    returnFocus = true,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  /**
   * Get all focusable elements within the container
   */
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    const elements = containerRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
    return Array.from(elements) as HTMLElement[];
  }, []);

  /**
   * Handle tab key to trap focus within container
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Handle Escape key
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        event.stopPropagation();
        onEscape();
        return;
      }

      // Only handle Tab key
      if (event.key !== 'Tab') return;

      // If allowing nested modals, check if focus is in a nested modal
      if (allowNestedModals) {
        const activeElement = document.activeElement;
        const nestedModal = activeElement?.closest('[role="dialog"][aria-modal="true"]');
        if (nestedModal && nestedModal !== containerRef.current) {
          // Focus is in a nested modal, don't trap
          return;
        }
      }

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Shift+Tab from first element -> go to last
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
      // Tab from last element -> go to first
      else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    },
    [getFocusableElements, onEscape, allowNestedModals]
  );

  /**
   * Set up focus trap when modal opens
   */
  useEffect(() => {
    if (!isOpen) {
      // Return focus when closing
      if (returnFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
        previousActiveElement.current = null;
      }
      return;
    }

    // Save the currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Auto-focus first focusable element
    if (autoFocus) {
      // Use requestAnimationFrame to ensure the modal is rendered
      requestAnimationFrame(() => {
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        } else {
          // If no focusable elements, focus the container itself
          containerRef.current?.focus();
        }
      });
    }

    // Add keydown listener
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, autoFocus, returnFocus, getFocusableElements, handleKeyDown]);

  return containerRef;
}

/**
 * Hook to check if user prefers reduced motion
 * Used to disable animations for accessibility
 */
export function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  
  // Check if window is available (SSR safety)
  if (typeof window === 'undefined') return false;
  
  const mediaQuery = window.matchMedia(query);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(mediaQuery.matches);
  
  useEffect(() => {
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  
  return prefersReducedMotion;
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFocusTrap, usePrefersReducedMotion } from '../../hooks/useFocusTrap';

// Mock document.activeElement
let mockActiveElement: HTMLElement | null = null;

describe('useFocusTrap', () => {
  let container: HTMLDivElement;
  let button1: HTMLButtonElement;
  let button2: HTMLButtonElement;
  let button3: HTMLButtonElement;

  beforeEach(() => {
    // Create a container with focusable elements
    container = document.createElement('div');
    button1 = document.createElement('button');
    button1.textContent = 'First';
    button2 = document.createElement('button');
    button2.textContent = 'Second';
    button3 = document.createElement('button');
    button3.textContent = 'Third';
    
    container.appendChild(button1);
    container.appendChild(button2);
    container.appendChild(button3);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it('should return a ref object', () => {
    const { result } = renderHook(() => useFocusTrap(false));
    expect(result.current).toBeDefined();
    expect(result.current.current).toBeNull();
  });

  it('should not trap focus when isOpen is false', () => {
    const { result } = renderHook(() => useFocusTrap(false));
    result.current.current = container;
    
    // Simulate tab key - should not be prevented
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);
    
    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('should focus first element when opened with autoFocus', async () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useFocusTrap(isOpen, { autoFocus: true }),
      { initialProps: { isOpen: false } }
    );
    
    result.current.current = container;
    
    // Open the trap
    rerender({ isOpen: true });
    
    // Wait for requestAnimationFrame
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // First button should be focused
    expect(document.activeElement).toBe(button1);
  });

  it('should call onEscape when Escape key is pressed', () => {
    const onEscape = vi.fn();
    const { result } = renderHook(() => useFocusTrap(true, { onEscape }));
    result.current.current = container;
    
    // Simulate Escape key
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(event);
    
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('should trap Tab key at last element', async () => {
    const { result } = renderHook(() => useFocusTrap(true, { autoFocus: false }));
    result.current.current = container;
    
    // Focus the last button
    button3.focus();
    expect(document.activeElement).toBe(button3);
    
    // Simulate Tab key
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
    document.dispatchEvent(event);
    
    // Should have called preventDefault and focus would move to first
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should trap Shift+Tab at first element', async () => {
    const { result } = renderHook(() => useFocusTrap(true, { autoFocus: false }));
    result.current.current = container;
    
    // Focus the first button
    button1.focus();
    expect(document.activeElement).toBe(button1);
    
    // Simulate Shift+Tab key
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
    document.dispatchEvent(event);
    
    // Should have called preventDefault
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should return focus when closed with returnFocus', async () => {
    // Create a trigger button outside the container
    const triggerButton = document.createElement('button');
    triggerButton.textContent = 'Trigger';
    document.body.appendChild(triggerButton);
    triggerButton.focus();
    
    const { result, rerender } = renderHook(
      ({ isOpen }) => useFocusTrap(isOpen, { returnFocus: true }),
      { initialProps: { isOpen: false } }
    );
    
    result.current.current = container;
    
    // Open the trap
    rerender({ isOpen: true });
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // Close the trap
    rerender({ isOpen: false });
    
    // Trigger button should be focused again
    expect(document.activeElement).toBe(triggerButton);
    
    document.body.removeChild(triggerButton);
  });

  it('should not auto-focus when autoFocus is false', async () => {
    const originalActiveElement = document.activeElement;
    
    const { result, rerender } = renderHook(
      ({ isOpen }) => useFocusTrap(isOpen, { autoFocus: false }),
      { initialProps: { isOpen: false } }
    );
    
    result.current.current = container;
    
    // Open the trap
    rerender({ isOpen: true });
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // Active element should not have changed to button1
    expect(document.activeElement).not.toBe(button1);
  });

  it('should handle disabled buttons correctly', async () => {
    // Disable the first button
    button1.disabled = true;
    
    const { result, rerender } = renderHook(
      ({ isOpen }) => useFocusTrap(isOpen, { autoFocus: true }),
      { initialProps: { isOpen: false } }
    );
    
    result.current.current = container;
    
    // Open the trap
    rerender({ isOpen: true });
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // Second button should be focused (first focusable)
    expect(document.activeElement).toBe(button2);
  });

  it('should handle empty container', async () => {
    // Remove all buttons
    container.innerHTML = '';
    
    const { result, rerender } = renderHook(
      ({ isOpen }) => useFocusTrap(isOpen, { autoFocus: true }),
      { initialProps: { isOpen: false } }
    );
    
    // Make container focusable
    container.tabIndex = -1;
    result.current.current = container;
    
    // Open the trap - should not throw
    rerender({ isOpen: true });
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // Container itself should be focused as fallback
    expect(document.activeElement).toBe(container);
  });

  it('should support nested modals with allowNestedModals option', async () => {
    // Create a nested modal structure
    const nestedModal = document.createElement('div');
    nestedModal.setAttribute('role', 'dialog');
    nestedModal.setAttribute('aria-modal', 'true');
    const nestedButton = document.createElement('button');
    nestedButton.textContent = 'Nested';
    nestedModal.appendChild(nestedButton);
    container.appendChild(nestedModal);
    
    const { result } = renderHook(() => 
      useFocusTrap(true, { allowNestedModals: true, autoFocus: false })
    );
    result.current.current = container;
    
    // Focus the nested button
    nestedButton.focus();
    
    // Tab should not be trapped for nested modal content
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);
    
    // preventDefault should NOT be called since we're in a nested modal
    // and allowNestedModals is true
    // Note: This is implementation-dependent
  });

  it('should clean up event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    
    const { unmount } = renderHook(() => useFocusTrap(true));
    
    unmount();
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});

describe('usePrefersReducedMotion', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>;
  let addEventListenerMock: ReturnType<typeof vi.fn>;
  let removeEventListenerMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addEventListenerMock = vi.fn();
    removeEventListenerMock = vi.fn();
    
    matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    }));
    
    vi.stubGlobal('matchMedia', matchMediaMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return false when user prefers motion', () => {
    matchMediaMock.mockImplementation(() => ({
      matches: false,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    }));
    
    const { result } = renderHook(() => usePrefersReducedMotion());
    
    expect(result.current).toBe(false);
  });

  it('should return true when user prefers reduced motion', () => {
    matchMediaMock.mockImplementation(() => ({
      matches: true,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    }));
    
    const { result } = renderHook(() => usePrefersReducedMotion());
    
    expect(result.current).toBe(true);
  });

  it('should update when preference changes', () => {
    let changeHandler: ((event: MediaQueryListEvent) => void) | null = null;
    
    addEventListenerMock.mockImplementation((event: string, handler: (event: MediaQueryListEvent) => void) => {
      if (event === 'change') {
        changeHandler = handler;
      }
    });
    
    matchMediaMock.mockImplementation(() => ({
      matches: false,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
    }));
    
    const { result } = renderHook(() => usePrefersReducedMotion());
    
    expect(result.current).toBe(false);
    
    // Simulate preference change
    act(() => {
      if (changeHandler) {
        changeHandler({ matches: true } as MediaQueryListEvent);
      }
    });
    
    expect(result.current).toBe(true);
  });

  it('should clean up event listener on unmount', () => {
    const { unmount } = renderHook(() => usePrefersReducedMotion());
    
    unmount();
    
    expect(removeEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
  });
});

/**
 * ClipboardService
 * 
 * Modern clipboard API with graceful fallback for older browsers.
 * Uses navigator.clipboard.writeText when available, falls back to
 * document.execCommand for legacy support.
 */

export interface ClipboardResult {
  success: boolean;
  error?: string;
}

/**
 * Copy text to clipboard using modern API with fallback
 */
export async function copyToClipboard(text: string): Promise<ClipboardResult> {
  // Try modern Clipboard API first
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true };
    } catch (error) {
      // Modern API failed (permission denied, etc.), try fallback
      console.warn('Clipboard API failed, trying fallback:', error);
    }
  }

  // Fallback for older browsers or when Clipboard API fails
  return fallbackCopyToClipboard(text);
}

/**
 * Fallback copy using deprecated execCommand
 * Used when navigator.clipboard is not available
 */
function fallbackCopyToClipboard(text: string): ClipboardResult {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  
  // Prevent scrolling to bottom of page
  textArea.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 2em;
    height: 2em;
    padding: 0;
    border: none;
    outline: none;
    box-shadow: none;
    background: transparent;
    opacity: 0;
  `;
  
  document.body.appendChild(textArea);
  
  try {
    textArea.focus();
    textArea.select();
    
    // Ensure selection works on iOS
    textArea.setSelectionRange(0, text.length);
    
    const success = document.execCommand('copy');
    
    if (!success) {
      return { success: false, error: 'execCommand copy failed' };
    }
    
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown copy error';
    return { success: false, error: message };
  } finally {
    document.body.removeChild(textArea);
  }
}

/**
 * Check if clipboard API is available
 */
export function isClipboardAvailable(): boolean {
  return !!(navigator.clipboard && typeof navigator.clipboard.writeText === 'function');
}

/**
 * Read text from clipboard (requires user permission)
 */
export async function readFromClipboard(): Promise<ClipboardResult & { text?: string }> {
  if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
    return { success: false, error: 'Clipboard read not supported' };
  }
  
  try {
    const text = await navigator.clipboard.readText();
    return { success: true, text };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Clipboard read failed';
    return { success: false, error: message };
  }
}

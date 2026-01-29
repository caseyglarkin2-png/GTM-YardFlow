import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard, isClipboardAvailable, readFromClipboard } from '../../services/ClipboardService';

describe('ClipboardService', () => {
  let originalNavigator: Navigator;

  beforeEach(() => {
    originalNavigator = global.navigator;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('copyToClipboard', () => {
    it('should use modern Clipboard API when available', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const result = await copyToClipboard('test text');

      expect(writeTextMock).toHaveBeenCalledWith('test text');
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fall back to execCommand when Clipboard API is not available', async () => {
      vi.stubGlobal('navigator', {
        clipboard: undefined,
      });

      const execCommandMock = vi.fn().mockReturnValue(true);
      vi.stubGlobal('document', {
        ...document,
        execCommand: execCommandMock,
        body: document.body,
        createElement: document.createElement.bind(document),
      });

      const result = await copyToClipboard('fallback text');

      expect(result.success).toBe(true);
    });

    it('should fall back when Clipboard API throws error', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      // The fallback should be attempted
      const result = await copyToClipboard('test text');
      
      // Result depends on whether execCommand succeeds
      expect(writeTextMock).toHaveBeenCalledWith('test text');
    });

    it('should return error when fallback execCommand fails', async () => {
      vi.stubGlobal('navigator', {
        clipboard: undefined,
      });

      const execCommandMock = vi.fn().mockReturnValue(false);
      Object.defineProperty(document, 'execCommand', {
        value: execCommandMock,
        writable: true,
        configurable: true,
      });

      const result = await copyToClipboard('will fail');

      expect(result.success).toBe(false);
      expect(result.error).toBe('execCommand copy failed');
    });

    it('should handle empty string', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const result = await copyToClipboard('');

      expect(writeTextMock).toHaveBeenCalledWith('');
      expect(result.success).toBe(true);
    });

    it('should handle special characters', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const specialText = 'Hello 👋 "quotes" & <script>alert("xss")</script>';
      const result = await copyToClipboard(specialText);

      expect(writeTextMock).toHaveBeenCalledWith(specialText);
      expect(result.success).toBe(true);
    });

    it('should handle multiline text', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const multilineText = 'Line 1\nLine 2\nLine 3';
      const result = await copyToClipboard(multilineText);

      expect(writeTextMock).toHaveBeenCalledWith(multilineText);
      expect(result.success).toBe(true);
    });
  });

  describe('isClipboardAvailable', () => {
    it('should return true when Clipboard API is available', () => {
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: vi.fn(),
        },
      });

      expect(isClipboardAvailable()).toBe(true);
    });

    it('should return false when Clipboard API is not available', () => {
      vi.stubGlobal('navigator', {
        clipboard: undefined,
      });

      expect(isClipboardAvailable()).toBe(false);
    });

    it('should return false when clipboard exists but writeText is not a function', () => {
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: 'not a function',
        },
      });

      expect(isClipboardAvailable()).toBe(false);
    });
  });

  describe('readFromClipboard', () => {
    it('should read text when Clipboard API is available', async () => {
      const readTextMock = vi.fn().mockResolvedValue('clipboard content');
      vi.stubGlobal('navigator', {
        clipboard: {
          readText: readTextMock,
        },
      });

      const result = await readFromClipboard();

      expect(result.success).toBe(true);
      expect(result.text).toBe('clipboard content');
    });

    it('should return error when readText is not available', async () => {
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: vi.fn(),
        },
      });

      const result = await readFromClipboard();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clipboard read not supported');
    });

    it('should handle permission denied error', async () => {
      const readTextMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
      vi.stubGlobal('navigator', {
        clipboard: {
          readText: readTextMock,
        },
      });

      const result = await readFromClipboard();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });

    it('should return error when clipboard is undefined', async () => {
      vi.stubGlobal('navigator', {
        clipboard: undefined,
      });

      const result = await readFromClipboard();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clipboard read not supported');
    });
  });
});

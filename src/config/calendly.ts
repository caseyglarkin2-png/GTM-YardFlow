/**
 * Calendly Configuration
 * 
 * Sprint 27: T27.1 - Centralized Calendly configuration with HTML link helpers
 * 
 * Usage:
 * - For HTML emails: getCalendlyHtmlLink()
 * - For plain text (DMs): CALENDLY_CONFIG.url or getCalendlyPlainLink()
 */

export const CALENDLY_CONFIG = {
  /** Jake's Manifest 2026 meeting booking URL */
  url: 'https://calendly.com/jake-freightroll/manifest-meeting',
  
  /** Default display text for the link - short and clean like Google Docs hyperlinks */
  displayText: "Jake's Calendar",
  
  /** Pre-built HTML link for quick use */
  htmlLink: '<a href="https://calendly.com/jake-freightroll/manifest-meeting" style="color: #2563eb; text-decoration: underline;">Jake\'s Calendar</a>',
} as const;

/**
 * Get HTML-formatted Calendly link for emails
 * 
 * @param customText - Optional custom link text (defaults to "Jake's Calendar")
 * @returns HTML anchor tag with proper styling
 * 
 * @example
 * // Default usage - short and clean
 * getCalendlyHtmlLink() 
 * // => '<a href="..." style="color: #2563eb; ...">Jake's Calendar</a>'
 * 
 * // Custom text for specific CTAs
 * getCalendlyHtmlLink('Book time here')
 * // => '<a href="..." style="color: #2563eb; ...">Book time here</a>'
 */
export function getCalendlyHtmlLink(customText?: string): string {
  const text = customText || CALENDLY_CONFIG.displayText;
  return `<a href="${CALENDLY_CONFIG.url}" style="color: #2563eb; text-decoration: underline;">${text}</a>`;
}

/**
 * Get plain text Calendly URL for DMs (LinkedIn, Manifest App - no HTML support)
 * 
 * @returns The raw Calendly URL
 */
export function getCalendlyPlainLink(): string {
  return CALENDLY_CONFIG.url;
}

/**
 * Get Markdown-formatted Calendly link
 * 
 * @param customText - Optional custom link text
 * @returns Markdown link syntax
 */
export function getCalendlyMarkdownLink(customText?: string): string {
  const text = customText || CALENDLY_CONFIG.displayText;
  return `[${text}](${CALENDLY_CONFIG.url})`;
}

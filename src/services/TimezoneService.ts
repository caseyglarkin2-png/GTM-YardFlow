/**
 * Timezone Utility Service - YardFlow Hub
 * 
 * Sprint 3 T3.5: Timezone utilities for scheduling emails in prospect's local time.
 * 
 * Features:
 * - Convert timestamps between timezones
 * - Calculate send times in prospect's timezone
 * - Skip weekends/holidays in local time
 * - Common timezone shortcuts
 */

// ============================================
// Types
// ============================================

export interface LocalSendTime {
  hour: number;
  minute: number;
  timezone: string;
}

export interface ScheduleResult {
  sendAt: Date;
  sendAtLocal: string;
  timezone: string;
  dayOfWeek: string;
  isWeekend: boolean;
  wasAdjusted: boolean;
  adjustmentReason?: string;
}

// ============================================
// Common Timezone Mappings
// ============================================

/**
 * Common timezone shortcuts for US-based prospects
 */
export const TIMEZONE_SHORTCUTS: Record<string, string> = {
  // US Time zones
  'EST': 'America/New_York',
  'EDT': 'America/New_York',
  'CST': 'America/Chicago',
  'CDT': 'America/Chicago',
  'MST': 'America/Denver',
  'MDT': 'America/Denver',
  'PST': 'America/Los_Angeles',
  'PDT': 'America/Los_Angeles',
  'AST': 'America/Anchorage',
  'HST': 'Pacific/Honolulu',
  
  // European
  'GMT': 'Europe/London',
  'BST': 'Europe/London',
  'CET': 'Europe/Paris',
  'CEST': 'Europe/Paris',
  
  // Other common
  'UTC': 'UTC',
  'ET': 'America/New_York',
  'CT': 'America/Chicago',
  'MT': 'America/Denver',
  'PT': 'America/Los_Angeles',
};

/**
 * US state to timezone mapping
 */
export const US_STATE_TIMEZONES: Record<string, string> = {
  // Eastern
  'CT': 'America/New_York',
  'DE': 'America/New_York',
  'DC': 'America/New_York',
  'FL': 'America/New_York',
  'GA': 'America/New_York',
  'IN': 'America/Indiana/Indianapolis',
  'KY': 'America/Kentucky/Louisville',
  'ME': 'America/New_York',
  'MD': 'America/New_York',
  'MA': 'America/New_York',
  'MI': 'America/Detroit',
  'NH': 'America/New_York',
  'NJ': 'America/New_York',
  'NY': 'America/New_York',
  'NC': 'America/New_York',
  'OH': 'America/New_York',
  'PA': 'America/New_York',
  'RI': 'America/New_York',
  'SC': 'America/New_York',
  'VT': 'America/New_York',
  'VA': 'America/New_York',
  'WV': 'America/New_York',
  
  // Central
  'AL': 'America/Chicago',
  'AR': 'America/Chicago',
  'IL': 'America/Chicago',
  'IA': 'America/Chicago',
  'KS': 'America/Chicago',
  'LA': 'America/Chicago',
  'MN': 'America/Chicago',
  'MS': 'America/Chicago',
  'MO': 'America/Chicago',
  'NE': 'America/Chicago',
  'ND': 'America/Chicago',
  'OK': 'America/Chicago',
  'SD': 'America/Chicago',
  'TN': 'America/Chicago',
  'TX': 'America/Chicago',
  'WI': 'America/Chicago',
  
  // Mountain
  'AZ': 'America/Phoenix', // No DST
  'CO': 'America/Denver',
  'ID': 'America/Boise',
  'MT': 'America/Denver',
  'NM': 'America/Denver',
  'UT': 'America/Denver',
  'WY': 'America/Denver',
  
  // Pacific
  'CA': 'America/Los_Angeles',
  'NV': 'America/Los_Angeles',
  'OR': 'America/Los_Angeles',
  'WA': 'America/Los_Angeles',
  
  // Other
  'AK': 'America/Anchorage',
  'HI': 'Pacific/Honolulu',
};

// ============================================
// Timezone Utility Class
// ============================================

export class TimezoneService {
  private defaultTimezone: string;

  constructor(defaultTimezone = 'America/New_York') {
    this.defaultTimezone = defaultTimezone;
  }

  /**
   * Normalize timezone string to IANA format
   */
  normalizeTimezone(timezone: string | null | undefined): string {
    if (!timezone) {
      return this.defaultTimezone;
    }

    // Check shortcuts
    const upper = timezone.toUpperCase();
    if (TIMEZONE_SHORTCUTS[upper]) {
      return TIMEZONE_SHORTCUTS[upper];
    }

    // Check if it's a US state code
    if (US_STATE_TIMEZONES[upper]) {
      return US_STATE_TIMEZONES[upper];
    }

    // Assume it's already in IANA format
    return timezone;
  }

  /**
   * Get timezone from prospect's location data
   */
  inferTimezone(data: {
    timezone?: string | null;
    state?: string | null;
    country?: string | null;
    city?: string | null;
  }): string {
    // Explicit timezone takes priority
    if (data.timezone) {
      return this.normalizeTimezone(data.timezone);
    }

    // Try to infer from US state
    if (data.state) {
      const stateCode = data.state.toUpperCase().slice(0, 2);
      if (US_STATE_TIMEZONES[stateCode]) {
        return US_STATE_TIMEZONES[stateCode];
      }
    }

    // Default timezone
    return this.defaultTimezone;
  }

  /**
   * Get the current time in a specific timezone
   */
  getCurrentTimeInTimezone(timezone: string): Date {
    const normalizedTz = this.normalizeTimezone(timezone);
    const now = new Date();
    
    // Use Intl.DateTimeFormat to get the local time
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: normalizedTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const getValue = (type: string) => parts.find(p => p.type === type)?.value || '0';

    return new Date(
      parseInt(getValue('year')),
      parseInt(getValue('month')) - 1,
      parseInt(getValue('day')),
      parseInt(getValue('hour')),
      parseInt(getValue('minute')),
      parseInt(getValue('second'))
    );
  }

  /**
   * Format a date in a specific timezone
   */
  formatInTimezone(date: Date, timezone: string, format: 'short' | 'long' | 'time' = 'short'): string {
    const normalizedTz = this.normalizeTimezone(timezone);
    
    const options: Intl.DateTimeFormatOptions = {
      timeZone: normalizedTz,
    };

    switch (format) {
      case 'time':
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.hour12 = true;
        break;
      case 'long':
        options.weekday = 'long';
        options.year = 'numeric';
        options.month = 'long';
        options.day = 'numeric';
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.hour12 = true;
        break;
      case 'short':
      default:
        options.year = 'numeric';
        options.month = 'short';
        options.day = 'numeric';
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.hour12 = true;
    }

    return new Intl.DateTimeFormat('en-US', options).format(date);
  }

  /**
   * Check if a date falls on a weekend in a specific timezone
   */
  isWeekend(date: Date, timezone: string): boolean {
    const normalizedTz = this.normalizeTimezone(timezone);
    
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: normalizedTz,
      weekday: 'short',
    });

    const weekday = formatter.format(date);
    return weekday === 'Sat' || weekday === 'Sun';
  }

  /**
   * Get the day of week in a timezone
   */
  getDayOfWeek(date: Date, timezone: string): string {
    const normalizedTz = this.normalizeTimezone(timezone);
    
    return new Intl.DateTimeFormat('en-US', {
      timeZone: normalizedTz,
      weekday: 'long',
    }).format(date);
  }

  /**
   * Calculate optimal send time in prospect's timezone
   * 
   * @param baseTime The base time for calculation
   * @param targetHour Target hour in local time (0-23)
   * @param targetMinute Target minute (0-59)
   * @param timezone Prospect's timezone
   * @param skipWeekends Whether to skip weekends
   */
  calculateSendTime(
    _baseTime: Date,
    targetHour: number,
    targetMinute: number,
    timezone: string,
    skipWeekends = true
  ): ScheduleResult {
    const normalizedTz = this.normalizeTimezone(timezone);
    
    // Get the local time in prospect's timezone
    const localNow = this.getCurrentTimeInTimezone(normalizedTz);
    
    // Create target time in local timezone
    let sendDate = new Date(localNow);
    sendDate.setHours(targetHour, targetMinute, 0, 0);

    // If target time is in the past today, move to tomorrow
    if (sendDate <= localNow) {
      sendDate.setDate(sendDate.getDate() + 1);
    }

    let wasAdjusted = false;
    let adjustmentReason: string | undefined;

    // Skip weekends if configured
    if (skipWeekends) {
      const dayOfWeek = sendDate.getDay();
      if (dayOfWeek === 0) { // Sunday
        sendDate.setDate(sendDate.getDate() + 1);
        wasAdjusted = true;
        adjustmentReason = 'Moved from Sunday to Monday';
      } else if (dayOfWeek === 6) { // Saturday
        sendDate.setDate(sendDate.getDate() + 2);
        wasAdjusted = true;
        adjustmentReason = 'Moved from Saturday to Monday';
      }
    }

    return {
      sendAt: sendDate,
      sendAtLocal: this.formatInTimezone(sendDate, normalizedTz, 'long'),
      timezone: normalizedTz,
      dayOfWeek: this.getDayOfWeek(sendDate, normalizedTz),
      isWeekend: this.isWeekend(sendDate, normalizedTz),
      wasAdjusted,
      adjustmentReason,
    };
  }

  /**
   * Get business hours status in a timezone
   */
  isBusinessHours(timezone: string, startHour = 9, endHour = 17): boolean {
    const localTime = this.getCurrentTimeInTimezone(timezone);
    const hour = localTime.getHours();
    const isWeekend = this.isWeekend(new Date(), timezone);
    
    return !isWeekend && hour >= startHour && hour < endHour;
  }

  /**
   * Get all supported timezones grouped by region
   */
  getSupportedTimezones(): Record<string, string[]> {
    return {
      'US Eastern': ['America/New_York', 'America/Detroit', 'America/Indiana/Indianapolis'],
      'US Central': ['America/Chicago'],
      'US Mountain': ['America/Denver', 'America/Phoenix', 'America/Boise'],
      'US Pacific': ['America/Los_Angeles'],
      'US Other': ['America/Anchorage', 'Pacific/Honolulu'],
      'Europe': ['Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam'],
      'Other': ['UTC'],
    };
  }
}

// Singleton instance
export const timezoneService = new TimezoneService();

// Convenience exports
export function inferTimezone(data: Parameters<TimezoneService['inferTimezone']>[0]): string {
  return timezoneService.inferTimezone(data);
}

export function calculateProspectSendTime(
  targetHour: number,
  targetMinute: number,
  timezone: string,
  skipWeekends = true
): ScheduleResult {
  return timezoneService.calculateSendTime(
    new Date(),
    targetHour,
    targetMinute,
    timezone,
    skipWeekends
  );
}

export function isBusinessHoursForProspect(timezone: string): boolean {
  return timezoneService.isBusinessHours(timezone);
}

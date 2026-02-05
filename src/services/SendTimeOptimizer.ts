/**
 * SendTimeOptimizer Service - Sprint 39D.2
 * 
 * Calculates optimal email send times based on:
 * - Prospect's timezone
 * - Day of week (Tue-Thu preferred)
 * - Business hours (9-11am or 2-4pm local)
 * - Weekend avoidance
 * 
 * Research-backed optimal send times:
 * - Best days: Tuesday, Wednesday, Thursday
 * - Best times: 9-10am and 2-3pm recipient local time
 * - Avoid: Monday (inbox overflow), Friday (checking out)
 */

import { 
  TimezoneService, 
  timezoneService, 
  type ScheduleResult 
} from './TimezoneService';

// ============================================
// Types
// ============================================

export interface OptimalSendTime {
  /** UTC timestamp for when to send */
  timestamp: number;
  /** IANA timezone used */
  timezone: string;
  /** Human-readable local time string */
  localTime: string;
  /** Day of week in recipient timezone */
  dayOfWeek: string;
  /** Explanation of why this time was chosen */
  reason: string;
  /** Whether time was adjusted from ideal */
  wasAdjusted: boolean;
  /** Original scheduled Date object */
  scheduledAt: Date;
}

export interface ProspectTimingData {
  /** Prospect's explicit timezone if known */
  timezone?: string | null;
  /** City for timezone inference */
  city?: string | null;
  /** State/region for timezone inference */
  state?: string | null;
  /** Country for timezone inference */
  country?: string | null;
}

export interface SendTimeOptions {
  /** Preferred morning hour (default: 9) */
  preferredMorningHour?: number;
  /** Preferred afternoon hour (default: 14) */
  preferredAfternoonHour?: number;
  /** Whether to prefer morning over afternoon (default: true) */
  preferMorning?: boolean;
  /** Skip weekends (default: true) */
  skipWeekends?: boolean;
  /** Skip Monday (default: false) */
  skipMonday?: boolean;
  /** Skip Friday (default: false) */
  skipFriday?: boolean;
  /** Minimum hours in future (default: 1) */
  minHoursInFuture?: number;
}

// ============================================
// Constants
// ============================================

/** Default business hour windows */
const DEFAULT_MORNING_HOUR = 9;  // 9 AM
const DEFAULT_AFTERNOON_HOUR = 14; // 2 PM

/** Minutes offset to avoid :00 timestamps (looks more natural) */
const MINUTE_OFFSET = 15;

/** Day rankings (0 = Sunday, 6 = Saturday) */
const DAY_RANKINGS: Record<number, number> = {
  0: 0, // Sunday - avoid
  1: 2, // Monday - less ideal
  2: 5, // Tuesday - great
  3: 5, // Wednesday - great  
  4: 5, // Thursday - great
  5: 2, // Friday - less ideal
  6: 0, // Saturday - avoid
};

// ============================================
// SendTimeOptimizer Class
// ============================================

export class SendTimeOptimizer {
  private readonly tzService: TimezoneService;

  constructor(tzService?: TimezoneService) {
    this.tzService = tzService || timezoneService;
  }

  /**
   * Get optimal send time for a prospect
   */
  getOptimalTime(
    prospect: ProspectTimingData,
    options: SendTimeOptions = {}
  ): OptimalSendTime {
    const {
      preferredMorningHour = DEFAULT_MORNING_HOUR,
      preferredAfternoonHour = DEFAULT_AFTERNOON_HOUR,
      preferMorning = true,
      skipWeekends = true,
      skipMonday = false,
      skipFriday = false,
      minHoursInFuture = 1,
    } = options;

    // Infer timezone from prospect data
    const timezone = this.tzService.inferTimezone({
      timezone: prospect.timezone,
      state: prospect.state,
      city: prospect.city,
      country: prospect.country,
    });

    // Get current time in prospect's timezone
    const now = new Date();
    const minSendTime = new Date(now.getTime() + minHoursInFuture * 60 * 60 * 1000);

    // Pick target hour
    const targetHour = preferMorning ? preferredMorningHour : preferredAfternoonHour;

    // Calculate initial send time
    let result = this.tzService.calculateSendTime(
      minSendTime,
      targetHour,
      MINUTE_OFFSET,
      timezone,
      skipWeekends
    );

    let reason = `Scheduled for ${targetHour > 12 ? targetHour - 12 + 'pm' : targetHour + 'am'} ${timezone.split('/')[1] || timezone} time`;
    let wasAdjusted = result.wasAdjusted;

    // Check if we should skip Monday or Friday
    const dayOfWeek = result.sendAt.getDay();
    
    if (skipMonday && dayOfWeek === 1) {
      // Move to Tuesday
      result.sendAt.setDate(result.sendAt.getDate() + 1);
      wasAdjusted = true;
      reason += ' (moved from Monday to Tuesday)';
    }

    if (skipFriday && dayOfWeek === 5) {
      // Move to next Tuesday
      result.sendAt.setDate(result.sendAt.getDate() + 4);
      wasAdjusted = true;
      reason += ' (moved from Friday to Tuesday)';
    }

    // Add adjustment reason if weekend was skipped
    if (result.adjustmentReason) {
      reason += ` (${result.adjustmentReason.toLowerCase()})`;
    }

    return {
      timestamp: result.sendAt.getTime(),
      timezone,
      localTime: result.sendAtLocal,
      dayOfWeek: result.dayOfWeek,
      reason,
      wasAdjusted,
      scheduledAt: result.sendAt,
    };
  }

  /**
   * Get optimal times for multiple prospects
   * Useful for bulk email scheduling
   */
  getOptimalTimesForBatch(
    prospects: Array<{ id: string; data: ProspectTimingData }>,
    options: SendTimeOptions = {}
  ): Map<string, OptimalSendTime> {
    const results = new Map<string, OptimalSendTime>();
    
    for (const { id, data } of prospects) {
      results.set(id, this.getOptimalTime(data, options));
    }

    return results;
  }

  /**
   * Check if now is a good time to send to prospect
   */
  isGoodTimeToSend(prospect: ProspectTimingData): {
    isGood: boolean;
    reason: string;
    suggestedDelay?: number; // hours until good time
  } {
    const timezone = this.tzService.inferTimezone(prospect);
    const localTime = this.tzService.getCurrentTimeInTimezone(timezone);
    const hour = localTime.getHours();
    const day = localTime.getDay();

    // Weekend
    if (day === 0 || day === 6) {
      const hoursUntilMonday = day === 0 
        ? (9 - hour) + (hour > 9 ? 24 : 0)  // Sunday
        : (24 - hour) + 24 + 9; // Saturday
      return {
        isGood: false,
        reason: 'Weekend - wait until Monday',
        suggestedDelay: hoursUntilMonday,
      };
    }

    // Too early (before 8am)
    if (hour < 8) {
      return {
        isGood: false,
        reason: 'Too early - wait until 9am local time',
        suggestedDelay: 9 - hour,
      };
    }

    // Too late (after 6pm)
    if (hour >= 18) {
      return {
        isGood: false,
        reason: 'After business hours - wait until tomorrow',
        suggestedDelay: (24 - hour) + 9,
      };
    }

    // Lunch hour (12-1pm) - less ideal but okay
    if (hour === 12) {
      return {
        isGood: true,
        reason: 'Lunch hour - may have lower open rates',
      };
    }

    // Prime morning time (9-11am)
    if (hour >= 9 && hour < 11) {
      return {
        isGood: true,
        reason: 'Optimal morning time',
      };
    }

    // Prime afternoon time (2-4pm)
    if (hour >= 14 && hour < 16) {
      return {
        isGood: true,
        reason: 'Optimal afternoon time',
      };
    }

    // Acceptable but not optimal
    return {
      isGood: true,
      reason: 'Acceptable business hours',
    };
  }

  /**
   * Rank a day of week for email sending
   * Higher score = better day
   */
  getDayRanking(dayOfWeek: number): {
    score: number;
    label: 'excellent' | 'good' | 'fair' | 'poor';
  } {
    const score = DAY_RANKINGS[dayOfWeek] || 0;
    
    return {
      score,
      label: score >= 5 ? 'excellent' : score >= 3 ? 'good' : score >= 2 ? 'fair' : 'poor',
    };
  }

  /**
   * Get human-readable explanation of optimal timing
   */
  explainTiming(optimalTime: OptimalSendTime): string {
    const dayRank = this.getDayRanking(optimalTime.scheduledAt.getDay());
    
    const parts = [
      `Send on ${optimalTime.dayOfWeek} at ${optimalTime.localTime} (${optimalTime.timezone})`,
    ];

    if (dayRank.label === 'excellent') {
      parts.push('Tuesday-Thursday has highest open rates.');
    } else if (dayRank.label === 'fair') {
      parts.push('Consider waiting for Tuesday-Thursday for better engagement.');
    }

    if (optimalTime.wasAdjusted) {
      parts.push(`Note: ${optimalTime.reason}`);
    }

    return parts.join(' ');
  }
}

// ============================================
// Singleton & Exports
// ============================================

/** Singleton instance */
export const sendTimeOptimizer = new SendTimeOptimizer();

/**
 * Convenience function to get optimal send time
 */
export function getOptimalSendTime(
  prospect: ProspectTimingData,
  options?: SendTimeOptions
): OptimalSendTime {
  return sendTimeOptimizer.getOptimalTime(prospect, options);
}

/**
 * Check if now is good to send
 */
export function isGoodTimeToSendNow(prospect: ProspectTimingData): ReturnType<SendTimeOptimizer['isGoodTimeToSend']> {
  return sendTimeOptimizer.isGoodTimeToSend(prospect);
}

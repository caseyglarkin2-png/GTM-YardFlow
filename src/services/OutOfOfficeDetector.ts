/**
 * Out-of-Office Detection Service - YardFlow Hub
 * 
 * Sprint 3 T3.4: Detects out-of-office (OOO) auto-replies to pause sequences
 * until the prospect returns.
 * 
 * Features:
 * - Pattern matching for common OOO phrases in multiple languages
 * - Date extraction for return date detection
 * - Confidence scoring for detection accuracy
 * - Integration with SequenceStateMachine for auto-pause
 */

// ============================================
// Types
// ============================================

export interface OOODetectionResult {
  isOOO: boolean;
  confidence: number; // 0-100
  returnDate?: Date;
  returnDateText?: string;
  matchedPatterns: string[];
  language?: 'en' | 'es' | 'de' | 'fr' | 'other';
  rawText?: string;
}

export interface OOOScheduleAction {
  shouldPause: boolean;
  resumeAt?: Date;
  reason: string;
}

// ============================================
// OOO Pattern Definitions
// ============================================

/**
 * Common out-of-office phrases with weights
 * Higher weight = stronger signal
 */
const OOO_PATTERNS: Array<{ pattern: RegExp; weight: number; language?: string }> = [
  // English patterns (high confidence)
  { pattern: /out\s*of\s*(the\s*)?office/i, weight: 90, language: 'en' },
  { pattern: /away\s*from\s*(the\s*)?office/i, weight: 85, language: 'en' },
  { pattern: /currently\s*(out|away)/i, weight: 80, language: 'en' },
  { pattern: /auto(matic)?\s*reply/i, weight: 70, language: 'en' },
  { pattern: /automatic\s*response/i, weight: 70, language: 'en' },
  { pattern: /limited\s*(email\s*)?access/i, weight: 90, language: 'en' },
  { pattern: /will\s*have\s*limited/i, weight: 85, language: 'en' },
  { pattern: /will\s*(return|be\s*back)/i, weight: 60, language: 'en' },
  { pattern: /returning\s*(on|to\s*the\s*office)/i, weight: 65, language: 'en' },
  { pattern: /on\s*(vacation|holiday|leave|pto)/i, weight: 85, language: 'en' },
  { pattern: /taking\s*(time\s*off|a\s*break|vacation)/i, weight: 80, language: 'en' },
  { pattern: /unable\s*to\s*(respond|reply)/i, weight: 60, language: 'en' },
  { pattern: /will\s*(not\s*be|have\s*limited)\s*(checking|access)/i, weight: 65, language: 'en' },
  { pattern: /thank\s*you\s*for\s*your\s*(email|message|patience)/i, weight: 30, language: 'en' },
  { pattern: /i\s*(am|'m)\s*(currently\s*)?(ooo|pto)/i, weight: 90, language: 'en' },
  { pattern: /i'm\s*(currently\s*)?(ooo|pto)/i, weight: 90, language: 'en' },
  { pattern: /\booo\b/i, weight: 70, language: 'en' },
  { pattern: /\bpto\b/i, weight: 60, language: 'en' },
  { pattern: /maternity\s*leave/i, weight: 90, language: 'en' },
  { pattern: /paternity\s*leave/i, weight: 90, language: 'en' },
  { pattern: /parental\s*leave/i, weight: 90, language: 'en' },
  { pattern: /sick\s*leave/i, weight: 85, language: 'en' },
  { pattern: /medical\s*leave/i, weight: 85, language: 'en' },

  // Subject line patterns
  { pattern: /^(re:\s*)?out\s*of\s*office/i, weight: 95, language: 'en' },
  { pattern: /^(re:\s*)?automatic\s*reply/i, weight: 90, language: 'en' },
  { pattern: /^(re:\s*)?auto:\s*/i, weight: 80, language: 'en' },

  // German patterns
  { pattern: /abwesenheitsnotiz/i, weight: 90, language: 'de' },
  { pattern: /außer\s*haus/i, weight: 85, language: 'de' },
  { pattern: /bin\s*(derzeit\s*)?nicht\s*im\s*büro/i, weight: 85, language: 'de' },
  { pattern: /urlaub/i, weight: 90, language: 'de' },
  { pattern: /im\s*urlaub/i, weight: 95, language: 'de' },

  // French patterns
  { pattern: /absence\s*du\s*bureau/i, weight: 90, language: 'fr' },
  { pattern: /réponse\s*automatique/i, weight: 85, language: 'fr' },
  { pattern: /je\s*suis\s*(absent|en\s*congé)/i, weight: 80, language: 'fr' },
  { pattern: /en\s*vacances/i, weight: 75, language: 'fr' },

  // Spanish patterns
  { pattern: /fuera\s*de\s*(la\s*)?oficina/i, weight: 90, language: 'es' },
  { pattern: /respuesta\s*automática/i, weight: 85, language: 'es' },
  { pattern: /estoy\s*de\s*vacaciones/i, weight: 80, language: 'es' },
  { pattern: /ausente/i, weight: 70, language: 'es' },
];

/**
 * Negative patterns that indicate it's NOT an OOO
 * These reduce confidence
 */
const ANTI_OOO_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /let('s|'s)\s*(schedule|meet|chat)/i, weight: 50 },
  { pattern: /here('s|'s|is)\s*(my\s*)?availab/i, weight: 40 },
  { pattern: /sounds\s*good/i, weight: 30 },
  { pattern: /looking\s*forward/i, weight: 20 },
  { pattern: /interested\s*in/i, weight: 30 },
  { pattern: /call\s*me\s*(at|on)/i, weight: 40 },
  { pattern: /unsubscribe/i, weight: 60 },
  { pattern: /remove\s*(me\s*)?from/i, weight: 50 },
  { pattern: /stop\s*(sending|emailing)/i, weight: 50 },
];

/**
 * Date patterns for extracting return dates
 */
const RETURN_DATE_PATTERNS: RegExp[] = [
  // "returning on January 15" or "back on Jan 15"
  /(?:return|back|available)\s*(?:on\s*)?((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)/i,
  // "back on 1/15" or "returning 01-15-2024"
  /(?:return|back|available)\s*(?:on\s*)?(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/i,
  // "until January 15" 
  /until\s+((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)/i,
  // "through Friday" or "until Monday"
  /(?:until|through)\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  // "back next week" or "returning next Monday"
  /(?:return|back)\s*next\s*(week|monday|tuesday|wednesday|thursday|friday)/i,
];

// ============================================
// OOO Detection Service
// ============================================

export class OutOfOfficeDetector {
  private minConfidenceThreshold: number;

  constructor(minConfidenceThreshold = 60) {
    this.minConfidenceThreshold = minConfidenceThreshold;
  }

  /**
   * Analyze email content to detect out-of-office auto-reply
   * 
   * @param subject Email subject line
   * @param body Email body (text or HTML stripped)
   * @returns Detection result with confidence score
   */
  detect(subject: string, body: string): OOODetectionResult {
    const combinedText = `${subject}\n${body}`.toLowerCase();
    const matchedPatterns: string[] = [];
    let totalScore = 0;
    let detectedLanguage: OOODetectionResult['language'] | undefined;
    const languageScores: Record<string, number> = {};

    // Check positive OOO patterns
    for (const { pattern, weight, language } of OOO_PATTERNS) {
      if (pattern.test(combinedText)) {
        matchedPatterns.push(pattern.source);
        totalScore += weight;

        if (language) {
          languageScores[language] = (languageScores[language] || 0) + weight;
        }
      }
    }

    // Check negative patterns (reduce score)
    for (const { pattern, weight } of ANTI_OOO_PATTERNS) {
      if (pattern.test(combinedText)) {
        totalScore -= weight;
      }
    }

    // Normalize score to 0-100 range
    // Max possible score from positive patterns is ~250, typical OOO hits 150-200
    const confidence = Math.max(0, Math.min(100, Math.round(totalScore / 2)));

    // Determine primary language
    if (Object.keys(languageScores).length > 0) {
      const [lang] = Object.entries(languageScores).sort((a, b) => b[1] - a[1])[0];
      detectedLanguage = lang as OOODetectionResult['language'];
    }

    // Try to extract return date
    let returnDate: Date | undefined;
    let returnDateText: string | undefined;

    if (confidence >= this.minConfidenceThreshold) {
      const dateResult = this.extractReturnDate(combinedText);
      returnDate = dateResult.date;
      returnDateText = dateResult.text;
    }

    return {
      isOOO: confidence >= this.minConfidenceThreshold,
      confidence,
      returnDate,
      returnDateText,
      matchedPatterns,
      language: detectedLanguage,
      rawText: combinedText.slice(0, 500), // First 500 chars for debugging
    };
  }

  /**
   * Attempt to extract the return date from OOO message
   */
  private extractReturnDate(text: string): { date?: Date; text?: string } {
    for (const pattern of RETURN_DATE_PATTERNS) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const dateText = match[1];
        const parsedDate = this.parseDate(dateText);
        if (parsedDate) {
          return { date: parsedDate, text: dateText };
        }
      }
    }
    return {};
  }

  /**
   * Parse a date string into a Date object
   */
  private parseDate(dateStr: string): Date | undefined {
    const today = new Date();
    const currentYear = today.getFullYear();

    // Handle relative weekdays
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const lowerStr = dateStr.toLowerCase();
    
    const weekdayIndex = weekdays.findIndex(day => lowerStr.includes(day));
    if (weekdayIndex !== -1) {
      const todayWeekday = today.getDay();
      let daysUntil = weekdayIndex - todayWeekday;
      if (daysUntil <= 0) daysUntil += 7; // Next week
      
      const returnDate = new Date(today);
      returnDate.setDate(today.getDate() + daysUntil);
      return returnDate;
    }

    // Handle "next week"
    if (lowerStr.includes('next week') || lowerStr.includes('week')) {
      const returnDate = new Date(today);
      returnDate.setDate(today.getDate() + 7);
      return returnDate;
    }

    // Try to parse month name formats: "January 15" or "Jan 15, 2024"
    const monthNames: Record<string, number> = {
      jan: 0, january: 0,
      feb: 1, february: 1,
      mar: 2, march: 2,
      apr: 3, april: 3,
      may: 4,
      jun: 5, june: 5,
      jul: 6, july: 6,
      aug: 7, august: 7,
      sep: 8, sept: 8, september: 8,
      oct: 9, october: 9,
      nov: 10, november: 10,
      dec: 11, december: 11,
    };

    for (const [monthName, monthIndex] of Object.entries(monthNames)) {
      if (lowerStr.includes(monthName)) {
        const dayMatch = lowerStr.match(/(\d{1,2})/);
        if (dayMatch) {
          const day = parseInt(dayMatch[1], 10);
          const yearMatch = lowerStr.match(/(\d{4})/);
          const year = yearMatch ? parseInt(yearMatch[1], 10) : currentYear;
          
          const returnDate = new Date(year, monthIndex, day);
          
          // If date is in the past, assume next year
          if (returnDate < today) {
            returnDate.setFullYear(currentYear + 1);
          }
          
          return returnDate;
        }
      }
    }

    // Try numeric date formats: "1/15" or "01-15-2024"
    const numericMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if (numericMatch) {
      const month = parseInt(numericMatch[1], 10) - 1;
      const day = parseInt(numericMatch[2], 10);
      let year = currentYear;
      
      if (numericMatch[3]) {
        year = parseInt(numericMatch[3], 10);
        if (year < 100) year += 2000;
      }
      
      const returnDate = new Date(year, month, day);
      if (returnDate < today && !numericMatch[3]) {
        returnDate.setFullYear(currentYear + 1);
      }
      
      return returnDate;
    }

    return undefined;
  }

  /**
   * Determine what action to take based on OOO detection
   */
  getScheduleAction(detection: OOODetectionResult): OOOScheduleAction {
    if (!detection.isOOO) {
      return {
        shouldPause: false,
        reason: 'Not detected as OOO',
      };
    }

    if (detection.returnDate) {
      // Add a buffer day after return date
      const resumeAt = new Date(detection.returnDate);
      resumeAt.setDate(resumeAt.getDate() + 1);
      resumeAt.setHours(9, 0, 0, 0); // Resume at 9 AM

      return {
        shouldPause: true,
        resumeAt,
        reason: `OOO detected (${detection.confidence}% confidence). Return date: ${detection.returnDateText}`,
      };
    }

    // Default pause for 5 days if no return date detected
    const resumeAt = new Date();
    resumeAt.setDate(resumeAt.getDate() + 5);
    resumeAt.setHours(9, 0, 0, 0);

    return {
      shouldPause: true,
      resumeAt,
      reason: `OOO detected (${detection.confidence}% confidence). No return date found, defaulting to 5 day pause.`,
    };
  }

  /**
   * Check if text contains unsubscribe request (not OOO)
   */
  isUnsubscribeRequest(text: string): boolean {
    const patterns = [
      /unsubscribe/i,
      /remove\s*(me\s*)?from/i,
      /stop\s*(sending|emailing)/i,
      /opt\s*out/i,
      /do\s*not\s*contact/i,
      /take\s*me\s*off/i,
    ];
    return patterns.some(p => p.test(text));
  }

  /**
   * Quick check for likely OOO without full analysis
   * Useful for fast filtering
   */
  quickCheck(subject: string): boolean {
    const oooSubjectPatterns = [
      /out\s*of\s*(the\s*)?office/i,
      /auto(matic)?\s*reply/i,
      /away\s*from\s*(the\s*)?office/i,
      /^(re:\s*)?auto:/i,
      /abwesenheit/i,
      /absence/i,
    ];
    return oooSubjectPatterns.some(p => p.test(subject));
  }
}

// Singleton instance
export const outOfOfficeDetector = new OutOfOfficeDetector();

// Convenience exports
export function detectOOO(subject: string, body: string): OOODetectionResult {
  return outOfOfficeDetector.detect(subject, body);
}

export function shouldPauseForOOO(subject: string, body: string): boolean {
  const detection = outOfOfficeDetector.detect(subject, body);
  return detection.isOOO;
}

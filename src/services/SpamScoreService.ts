/**
 * SpamScoreService
 * 
 * Sprint 39C.1: Analyzes email content for potential spam triggers
 * 
 * Features:
 * - Subject line analysis (caps, spam words, length)
 * - Body content analysis (spam phrases, formatting)
 * - Link analysis (count, suspicious domains)
 * - Image-to-text ratio
 * - Overall spam risk score (0-100, lower is better)
 */

// Spam trigger categories with weights
const SPAM_CATEGORIES = {
  urgency: {
    weight: 15,
    words: [
      'urgent', 'immediately', 'act now', 'limited time', 'expires soon',
      'dont delay', "don't delay", 'hurry', 'last chance', 'final notice',
      'time sensitive', 'deadline', 'asap', 'right now', 'today only',
    ],
  },
  freeOffer: {
    weight: 20,
    words: [
      'free', 'no cost', 'complimentary', 'no charge', 'at no cost',
      'free trial', 'free offer', 'free gift', 'free sample', 'free access',
      'bonus', 'giveaway', 'no obligation', 'risk free', 'risk-free',
    ],
  },
  money: {
    weight: 15,
    words: [
      'cash', 'money', 'income', 'profit', 'earnings', 'revenue',
      'million', 'billion', 'wealthy', 'rich', 'fortune', 'prize',
      'winner', 'lottery', 'jackpot', 'inheritance', 'investment',
    ],
  },
  pressure: {
    weight: 10,
    words: [
      'buy now', 'order now', 'click here', 'click below', 'sign up now',
      'subscribe now', 'register now', 'call now', 'apply now', 'join now',
      'download now', 'get started now', 'limited offer', 'exclusive deal',
    ],
  },
  financial: {
    weight: 15,
    words: [
      'credit card', 'bank account', 'wire transfer', 'bitcoin', 'crypto',
      'loan', 'mortgage', 'debt', 'refinance', 'consolidate', 'insurance',
      'tax', 'irs', 'refund', 'payment', 'invoice', 'billing',
    ],
  },
  health: {
    weight: 10,
    words: [
      'weight loss', 'lose weight', 'diet', 'pills', 'supplement', 'viagra',
      'pharmacy', 'prescription', 'medication', 'cure', 'miracle', 'treatment',
    ],
  },
  deceptive: {
    weight: 25,
    words: [
      'guaranteed', 'promise', 'no questions asked', 'secret', 'hidden',
      'confidential', 'private', 'exclusive access', 'insider', 'revealed',
      'shocking', 'unbelievable', 'incredible', 'amazing offer',
    ],
  },
};

// Suspicious link patterns
const SUSPICIOUS_DOMAINS = [
  'bit.ly', 'tinyurl.com', 'goo.gl', 'ow.ly', 't.co',
  'is.gd', 'buff.ly', 'adf.ly', 'tiny.cc', 'shorte.st',
];

// Common spam subject patterns (regex)
const SPAM_SUBJECT_PATTERNS = [
  /^re:\s*re:/i,           // Multiple RE:
  /^fw:\s*fw:/i,           // Multiple FW:
  /^\[spam\]/i,            // Already marked as spam
  /\$\d+/,                 // Dollar amounts
  /\d+%\s*(off|discount)/i, // Percentage discounts
  /!!+/,                   // Multiple exclamation marks
  /\?\?+/,                 // Multiple question marks
  /^congratulations/i,     // Congratulations opener
  /^you have won/i,        // Prize notification
  /^urgent:/i,             // Urgent prefix
  /all caps/i,             // Reference to all caps
];

/** Spam score result interface */
export interface SpamScoreResult {
  /** Overall spam risk score (0-100, lower is better) */
  score: number;
  /** Risk level classification */
  level: 'low' | 'medium' | 'high' | 'critical';
  /** Detected issues */
  issues: SpamIssue[];
  /** Suggestions for improvement */
  suggestions: string[];
  /** Detailed analysis breakdown */
  analysis: SpamAnalysis;
}

/** Individual spam issue */
export interface SpamIssue {
  /** Issue category */
  category: string;
  /** Issue description */
  description: string;
  /** Severity (1-5) */
  severity: number;
  /** Location in email (subject, body, link) */
  location: 'subject' | 'body' | 'link' | 'general';
  /** The problematic text (if applicable) */
  trigger?: string;
}

/** Detailed analysis breakdown */
export interface SpamAnalysis {
  /** Subject line analysis */
  subject: {
    score: number;
    capsRatio: number;
    length: number;
    hasSpamWords: boolean;
    spamWordsFound: string[];
  };
  /** Body content analysis */
  body: {
    score: number;
    spamWordCount: number;
    spamWordsFound: string[];
    hasExcessiveFormatting: boolean;
    imageCount: number;
    linkCount: number;
  };
  /** Link analysis */
  links: {
    score: number;
    totalLinks: number;
    suspiciousLinks: string[];
    excessiveLinks: boolean;
  };
  /** Overall content quality */
  quality: {
    readabilityScore: number;
    personalization: boolean;
    hasUnsubscribe: boolean;
    hasPhysicalAddress: boolean;
  };
}

/** Email content to analyze */
export interface EmailContent {
  subject: string;
  body: string;
  isHtml?: boolean;
}

/**
 * SpamScoreService - Analyzes email content for spam triggers
 */
export class SpamScoreService {
  private static instance: SpamScoreService;
  
  // Score thresholds
  private readonly thresholds = {
    low: 20,      // 0-20: Low risk
    medium: 40,   // 21-40: Medium risk
    high: 60,     // 41-60: High risk
    // 61+: Critical risk
  };

  private constructor() {}

  /** Get singleton instance */
  static getInstance(): SpamScoreService {
    if (!SpamScoreService.instance) {
      SpamScoreService.instance = new SpamScoreService();
    }
    return SpamScoreService.instance;
  }

  /**
   * Analyze email content for spam triggers
   */
  analyze(content: EmailContent): SpamScoreResult {
    const issues: SpamIssue[] = [];
    const suggestions: string[] = [];

    // Analyze each component
    const subjectAnalysis = this.analyzeSubject(content.subject, issues);
    const bodyAnalysis = this.analyzeBody(content.body, content.isHtml, issues);
    const linkAnalysis = this.analyzeLinks(content.body, content.isHtml, issues);
    const qualityAnalysis = this.analyzeQuality(content, issues);

    // Calculate overall score (weighted average)
    const score = this.calculateOverallScore(
      subjectAnalysis.score,
      bodyAnalysis.score,
      linkAnalysis.score,
      qualityAnalysis.readabilityScore
    );

    // Determine risk level
    const level = this.getRiskLevel(score);

    // Generate suggestions based on issues
    this.generateSuggestions(issues, suggestions);

    return {
      score: Math.round(score),
      level,
      issues,
      suggestions,
      analysis: {
        subject: subjectAnalysis,
        body: bodyAnalysis,
        links: linkAnalysis,
        quality: qualityAnalysis,
      },
    };
  }

  /**
   * Analyze subject line for spam triggers
   */
  private analyzeSubject(
    subject: string,
    issues: SpamIssue[]
  ): SpamAnalysis['subject'] {
    const spamWordsFound: string[] = [];
    let score = 0;

    // Check for all caps
    const upperCount = (subject.match(/[A-Z]/g) || []).length;
    const letterCount = (subject.match(/[a-zA-Z]/g) || []).length;
    const capsRatio = letterCount > 0 ? upperCount / letterCount : 0;

    if (capsRatio > 0.5 && subject.length > 5) {
      score += 15;
      issues.push({
        category: 'formatting',
        description: 'Subject has too many capital letters',
        severity: 3,
        location: 'subject',
        trigger: subject,
      });
    }

    // Check subject length
    if (subject.length > 70) {
      score += 5;
      issues.push({
        category: 'length',
        description: 'Subject line is too long (over 70 characters)',
        severity: 2,
        location: 'subject',
      });
    }

    // Check for spam patterns
    for (const pattern of SPAM_SUBJECT_PATTERNS) {
      if (pattern.test(subject)) {
        score += 10;
        issues.push({
          category: 'pattern',
          description: `Subject matches spam pattern: ${pattern.toString()}`,
          severity: 3,
          location: 'subject',
          trigger: subject.match(pattern)?.[0],
        });
        break; // Only count one pattern match
      }
    }

    // Check for spam words
    const subjectLower = subject.toLowerCase();
    for (const [, category] of Object.entries(SPAM_CATEGORIES)) {
      for (const word of category.words) {
        if (subjectLower.includes(word.toLowerCase())) {
          spamWordsFound.push(word);
          score += category.weight / 3; // Subject words weighted less
        }
      }
    }

    if (spamWordsFound.length > 0) {
      issues.push({
        category: 'spam_words',
        description: `Subject contains spam trigger words: ${spamWordsFound.slice(0, 3).join(', ')}`,
        severity: 4,
        location: 'subject',
        trigger: spamWordsFound[0],
      });
    }

    return {
      score: Math.min(score, 40), // Cap subject score
      capsRatio,
      length: subject.length,
      hasSpamWords: spamWordsFound.length > 0,
      spamWordsFound,
    };
  }

  /**
   * Analyze body content for spam triggers
   */
  private analyzeBody(
    body: string,
    isHtml: boolean | undefined,
    issues: SpamIssue[]
  ): SpamAnalysis['body'] {
    const spamWordsFound: string[] = [];
    let score = 0;
    let spamWordCount = 0;

    // Extract text content if HTML
    const textContent = isHtml ? this.stripHtml(body) : body;
    const textLower = textContent.toLowerCase();

    // Check for spam words
    for (const [, category] of Object.entries(SPAM_CATEGORIES)) {
      for (const word of category.words) {
        if (textLower.includes(word.toLowerCase())) {
          if (!spamWordsFound.includes(word)) {
            spamWordsFound.push(word);
          }
          spamWordCount++;
          score += category.weight / 5;
        }
      }
    }

    if (spamWordCount > 5) {
      issues.push({
        category: 'spam_words',
        description: `Body contains ${spamWordCount} spam trigger words`,
        severity: 4,
        location: 'body',
        trigger: spamWordsFound.slice(0, 3).join(', '),
      });
    }

    // Check for excessive formatting (HTML only)
    let hasExcessiveFormatting = false;
    let imageCount = 0;

    if (isHtml) {
      const boldCount = (body.match(/<(b|strong)/gi) || []).length;
      const fontColorCount = (body.match(/color\s*[:=]/gi) || []).length;
      imageCount = (body.match(/<img/gi) || []).length;

      if (boldCount > 10 || fontColorCount > 5) {
        hasExcessiveFormatting = true;
        score += 10;
        issues.push({
          category: 'formatting',
          description: 'Excessive formatting detected (colors, bold)',
          severity: 2,
          location: 'body',
        });
      }

      // Check image-to-text ratio
      const textLength = textContent.length;
      if (imageCount > 0 && textLength < 200) {
        score += 15;
        issues.push({
          category: 'content',
          description: 'High image-to-text ratio (too many images, not enough text)',
          severity: 3,
          location: 'body',
        });
      }
    }

    // Count links for link analysis
    const linkMatches = body.match(/https?:\/\/[^\s<"']+/gi) || [];
    
    return {
      score: Math.min(score, 50), // Cap body score
      spamWordCount,
      spamWordsFound,
      hasExcessiveFormatting,
      imageCount,
      linkCount: linkMatches.length,
    };
  }

  /**
   * Analyze links in the email
   */
  private analyzeLinks(
    body: string,
    isHtml: boolean | undefined,
    issues: SpamIssue[]
  ): SpamAnalysis['links'] {
    let score = 0;
    const suspiciousLinks: string[] = [];

    // Extract all URLs
    const urlPattern = /https?:\/\/[^\s<"']+/gi;
    const links = body.match(urlPattern) || [];
    const totalLinks = links.length;

    // Check for excessive links
    const excessiveLinks = totalLinks > 10;
    if (excessiveLinks) {
      score += 15;
      issues.push({
        category: 'links',
        description: `Too many links in email (${totalLinks} found)`,
        severity: 3,
        location: 'link',
      });
    }

    // Check for suspicious domains
    for (const link of links) {
      const linkLower = link.toLowerCase();
      for (const domain of SUSPICIOUS_DOMAINS) {
        if (linkLower.includes(domain)) {
          if (!suspiciousLinks.includes(link)) {
            suspiciousLinks.push(link);
          }
          score += 10;
        }
      }
    }

    if (suspiciousLinks.length > 0) {
      issues.push({
        category: 'links',
        description: 'Email contains URL shorteners (may be seen as suspicious)',
        severity: 3,
        location: 'link',
        trigger: suspiciousLinks[0],
      });
    }

    // Check if HTML has mismatched link text
    if (isHtml) {
      const hrefPattern = /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
      let match;
      while ((match = hrefPattern.exec(body)) !== null) {
        const href = match[1];
        const text = match[2];
        
        // Check if link text looks like a different URL
        if (text.match(/^https?:\/\//i) && !text.includes(new URL(href).hostname)) {
          score += 20;
          issues.push({
            category: 'deceptive',
            description: 'Link text does not match actual URL (phishing indicator)',
            severity: 5,
            location: 'link',
            trigger: `${text} → ${href}`,
          });
          break;
        }
      }
    }

    return {
      score: Math.min(score, 40), // Cap link score
      totalLinks,
      suspiciousLinks,
      excessiveLinks,
    };
  }

  /**
   * Analyze overall email quality indicators
   */
  private analyzeQuality(
    content: EmailContent,
    issues: SpamIssue[]
  ): SpamAnalysis['quality'] {
    const textContent = content.isHtml ? this.stripHtml(content.body) : content.body;
    let readabilityScore = 100;

    // Check for personalization (merge tags or actual names)
    const personalization = /\{\{|\[\[|dear\s+\w+|hi\s+\w+|hello\s+\w+/i.test(content.body);
    if (!personalization) {
      readabilityScore -= 10;
    }

    // Check for unsubscribe link/text
    const hasUnsubscribe = /unsubscribe|opt[\s-]?out|remove\s+from\s+list/i.test(content.body);
    if (!hasUnsubscribe) {
      readabilityScore -= 15;
      issues.push({
        category: 'compliance',
        description: 'Missing unsubscribe option (required by CAN-SPAM)',
        severity: 4,
        location: 'general',
      });
    }

    // Check for physical address
    const hasPhysicalAddress = /\d+\s+\w+\s+(street|st|avenue|ave|road|rd|blvd|drive|dr|lane|ln)/i.test(content.body);
    if (!hasPhysicalAddress) {
      readabilityScore -= 10;
      issues.push({
        category: 'compliance',
        description: 'Missing physical address (required by CAN-SPAM)',
        severity: 3,
        location: 'general',
      });
    }

    // Check text length (very short emails are suspicious)
    if (textContent.length < 50) {
      readabilityScore -= 20;
      issues.push({
        category: 'content',
        description: 'Email body is too short (may trigger spam filters)',
        severity: 2,
        location: 'body',
      });
    }

    return {
      readabilityScore: Math.max(readabilityScore, 0),
      personalization,
      hasUnsubscribe,
      hasPhysicalAddress,
    };
  }

  /**
   * Calculate overall spam score
   */
  private calculateOverallScore(
    subjectScore: number,
    bodyScore: number,
    linkScore: number,
    qualityScore: number
  ): number {
    // Weight: subject 25%, body 35%, links 25%, quality 15%
    const rawScore = 
      subjectScore * 0.25 +
      bodyScore * 0.35 +
      linkScore * 0.25 +
      (100 - qualityScore) * 0.15;

    return Math.min(Math.max(rawScore, 0), 100);
  }

  /**
   * Get risk level from score
   */
  private getRiskLevel(score: number): SpamScoreResult['level'] {
    if (score <= this.thresholds.low) return 'low';
    if (score <= this.thresholds.medium) return 'medium';
    if (score <= this.thresholds.high) return 'high';
    return 'critical';
  }

  /**
   * Generate improvement suggestions based on issues
   */
  private generateSuggestions(issues: SpamIssue[], suggestions: string[]): void {
    const categories = new Set(issues.map(i => i.category));

    if (categories.has('spam_words')) {
      suggestions.push('Remove or rephrase spam trigger words like "free", "urgent", "act now"');
    }
    if (categories.has('formatting')) {
      suggestions.push('Use normal capitalization and avoid excessive formatting');
    }
    if (categories.has('links')) {
      suggestions.push('Reduce the number of links and avoid URL shorteners');
    }
    if (categories.has('compliance')) {
      suggestions.push('Add unsubscribe link and physical address for CAN-SPAM compliance');
    }
    if (categories.has('content')) {
      suggestions.push('Add more meaningful text content to your email');
    }
    if (categories.has('deceptive')) {
      suggestions.push('Ensure link text matches the actual destination URL');
    }
    if (categories.has('pattern')) {
      suggestions.push('Avoid using multiple RE: or FW: prefixes in subject');
    }

    if (suggestions.length === 0 && issues.length === 0) {
      suggestions.push('Your email looks good! No major spam triggers detected.');
    }
  }

  /**
   * Strip HTML tags from content
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Quick check for a single word/phrase
   */
  isSpamWord(word: string): boolean {
    const wordLower = word.toLowerCase();
    for (const [, category] of Object.entries(SPAM_CATEGORIES)) {
      if (category.words.includes(wordLower)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get spam word categories
   */
  getSpamCategories(): typeof SPAM_CATEGORIES {
    return SPAM_CATEGORIES;
  }

  /**
   * Get score thresholds
   */
  getThresholds(): typeof SpamScoreService.prototype.thresholds {
    return { ...this.thresholds };
  }
}

// Export singleton instance
export const spamScoreService = SpamScoreService.getInstance();

/**
 * Domain Authentication Service
 * 
 * Sprint 39B.1: SPF, DKIM, and DMARC validation for email sending domains
 * 
 * Validates DNS records to ensure proper email authentication is configured,
 * which is critical for deliverability and preventing spoofing.
 */

import { db } from '@/lib/firebase';
import { collection, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

// DNS record types we check
export type DnsRecordType = 'SPF' | 'DKIM' | 'DMARC';

// Status of each record
export type RecordStatus = 'valid' | 'invalid' | 'missing' | 'warning' | 'unknown';

// Individual record check result
export interface DnsRecordResult {
  type: DnsRecordType;
  status: RecordStatus;
  value?: string;
  expected?: string;
  message: string;
  details?: string[];
}

// Overall domain health
export interface DomainHealth {
  domain: string;
  isHealthy: boolean;
  score: number; // 0-100
  records: {
    spf: DnsRecordResult;
    dkim: DnsRecordResult;
    dmarc: DnsRecordResult;
  };
  recommendations: string[];
  lastChecked: Date;
  cacheExpiry: Date;
}

// Configuration for DKIM selector (varies by provider)
export interface DkimConfig {
  selector: string; // e.g., 's1', 'google', 'sendgrid'
  domain?: string; // Optional subdomain for DKIM
}

// Default DKIM selectors to check
const DEFAULT_DKIM_SELECTORS = [
  'google',
  's1', 's2',
  'sendgrid',
  'mailgun',
  'amazonses',
  'k1', 'k2',
  'default',
  'selector1', 'selector2', // Microsoft 365
];

// Environment-configurable cache TTL (default 1 hour)
const CACHE_TTL_MS = parseInt(import.meta.env.VITE_DOMAIN_CHECK_CACHE_TTL || '3600000', 10);

/**
 * Domain Authentication Service
 * 
 * Checks DNS records to validate email authentication configuration.
 */
export class DomainAuthService {
  private dkimSelectors: string[];

  constructor(dkimSelectors: string[] = DEFAULT_DKIM_SELECTORS) {
    this.dkimSelectors = dkimSelectors;
  }

  /**
   * Check domain health with caching
   */
  async checkDomain(domain: string, options?: { 
    forceRefresh?: boolean;
    dkimSelector?: string;
  }): Promise<DomainHealth> {
    const normalizedDomain = domain.toLowerCase().trim();
    
    // Check cache first
    if (!options?.forceRefresh) {
      const cached = await this.getCachedResult(normalizedDomain);
      if (cached) {
        return cached;
      }
    }

    // Perform fresh check
    const health = await this.performDomainCheck(normalizedDomain, options?.dkimSelector);
    
    // Cache result
    await this.cacheResult(normalizedDomain, health);
    
    return health;
  }

  /**
   * Perform actual DNS checks
   */
  private async performDomainCheck(domain: string, dkimSelector?: string): Promise<DomainHealth> {
    const records = {
      spf: await this.checkSpf(domain),
      dkim: await this.checkDkim(domain, dkimSelector),
      dmarc: await this.checkDmarc(domain),
    };

    // Calculate score
    const score = this.calculateScore(records);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(records, domain);

    const now = new Date();
    return {
      domain,
      isHealthy: score >= 80,
      score,
      records,
      recommendations,
      lastChecked: now,
      cacheExpiry: new Date(now.getTime() + CACHE_TTL_MS),
    };
  }

  /**
   * Check SPF record
   * 
   * SPF (Sender Policy Framework) specifies which IP addresses/servers
   * are authorized to send email for the domain.
   */
  private async checkSpf(domain: string): Promise<DnsRecordResult> {
    try {
      const txtRecords = await this.queryTxtRecords(domain);
      const spfRecord = txtRecords.find(r => r.startsWith('v=spf1'));

      if (!spfRecord) {
        return {
          type: 'SPF',
          status: 'missing',
          message: 'No SPF record found',
          details: [
            'SPF helps prevent email spoofing',
            'Configure an SPF record in your DNS settings',
          ],
        };
      }

      // Validate SPF syntax and components
      const issues: string[] = [];
      
      // Check for recommended includes
      if (!spfRecord.includes('~all') && !spfRecord.includes('-all')) {
        issues.push('Missing ~all or -all qualifier (soft/hard fail for unauthorized senders)');
      }

      // Check for too many includes (max 10 DNS lookups)
      const includeCount = (spfRecord.match(/include:/g) || []).length;
      if (includeCount > 8) {
        issues.push(`Too many includes (${includeCount}/10 DNS lookups used)`);
      }

      // Check for +all (dangerous - allows anyone)
      if (spfRecord.includes('+all')) {
        return {
          type: 'SPF',
          status: 'invalid',
          value: spfRecord,
          message: 'SPF has +all (allows anyone to send - very dangerous!)',
          details: ['Remove +all and use -all or ~all instead'],
        };
      }

      return {
        type: 'SPF',
        status: issues.length > 0 ? 'warning' : 'valid',
        value: spfRecord,
        message: issues.length > 0 ? 'SPF configured with warnings' : 'SPF properly configured',
        details: issues.length > 0 ? issues : undefined,
      };
    } catch (error) {
      return {
        type: 'SPF',
        status: 'unknown',
        message: 'Failed to check SPF record',
        details: [error instanceof Error ? error.message : 'DNS lookup failed'],
      };
    }
  }

  /**
   * Check DKIM record
   * 
   * DKIM (DomainKeys Identified Mail) allows the sending server to
   * sign emails so recipients can verify they came from the claimed domain.
   */
  private async checkDkim(domain: string, specificSelector?: string): Promise<DnsRecordResult> {
    try {
      const selectorsToCheck = specificSelector ? [specificSelector] : this.dkimSelectors;
      
      for (const selector of selectorsToCheck) {
        const dkimDomain = `${selector}._domainkey.${domain}`;
        const txtRecords = await this.queryTxtRecords(dkimDomain);
        
        const dkimRecord = txtRecords.find(r => r.includes('v=DKIM1') || r.includes('p='));
        
        if (dkimRecord) {
          // Validate DKIM record
          if (!dkimRecord.includes('p=')) {
            return {
              type: 'DKIM',
              status: 'invalid',
              value: dkimRecord,
              expected: 'v=DKIM1; k=rsa; p=<public_key>',
              message: `DKIM record missing public key (selector: ${selector})`,
            };
          }

          // Check if key is revoked (p= empty)
          if (dkimRecord.includes('p=;') || dkimRecord.endsWith('p=')) {
            return {
              type: 'DKIM',
              status: 'invalid',
              value: dkimRecord,
              message: `DKIM key revoked (selector: ${selector})`,
              details: ['The DKIM key has been revoked. Generate a new key.'],
            };
          }

          return {
            type: 'DKIM',
            status: 'valid',
            value: `${selector}._domainkey.${domain}`,
            message: `DKIM properly configured (selector: ${selector})`,
          };
        }
      }

      return {
        type: 'DKIM',
        status: 'missing',
        message: 'No DKIM record found',
        details: [
          `Checked selectors: ${selectorsToCheck.slice(0, 5).join(', ')}...`,
          'DKIM is required for good deliverability',
          'Configure DKIM in your email provider settings',
        ],
      };
    } catch (error) {
      return {
        type: 'DKIM',
        status: 'unknown',
        message: 'Failed to check DKIM record',
        details: [error instanceof Error ? error.message : 'DNS lookup failed'],
      };
    }
  }

  /**
   * Check DMARC record
   * 
   * DMARC (Domain-based Message Authentication, Reporting, and Conformance)
   * tells receiving servers what to do with emails that fail SPF/DKIM checks.
   */
  private async checkDmarc(domain: string): Promise<DnsRecordResult> {
    try {
      const dmarcDomain = `_dmarc.${domain}`;
      const txtRecords = await this.queryTxtRecords(dmarcDomain);
      
      const dmarcRecord = txtRecords.find(r => r.startsWith('v=DMARC1'));

      if (!dmarcRecord) {
        return {
          type: 'DMARC',
          status: 'missing',
          message: 'No DMARC record found',
          expected: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com',
          details: [
            'DMARC tells receivers how to handle failed authentication',
            'Start with p=none for monitoring, then move to p=quarantine or p=reject',
          ],
        };
      }

      // Parse DMARC parts
      const issues: string[] = [];
      const suggestions: string[] = [];
      
      // Check policy
      const policyMatch = dmarcRecord.match(/p=(none|quarantine|reject)/i);
      if (!policyMatch) {
        issues.push('Missing policy (p=) - should be none, quarantine, or reject');
      } else if (policyMatch[1].toLowerCase() === 'none') {
        issues.push('Policy is p=none (monitoring only) - consider p=quarantine or p=reject');
      }

      // Check for aggregate reporting
      if (!dmarcRecord.includes('rua=')) {
        issues.push('No aggregate reporting address (rua=) - you won\'t receive reports');
      }

      // Check for subdomain policy (suggestion, not an issue)
      const spMatch = dmarcRecord.match(/sp=(none|quarantine|reject)/i);
      if (!spMatch && dmarcRecord.match(/p=(quarantine|reject)/i)) {
        suggestions.push('Consider adding subdomain policy (sp=) for complete protection');
      }

      const policy = policyMatch ? policyMatch[1] : 'unknown';
      const isStrict = policy === 'quarantine' || policy === 'reject';

      return {
        type: 'DMARC',
        status: issues.length > 0 ? (isStrict ? 'warning' : 'warning') : 'valid',
        value: dmarcRecord,
        message: issues.length > 0 
          ? `DMARC configured with warnings (policy: ${policy})`
          : `DMARC properly configured (policy: ${policy})`,
        details: issues.length > 0 ? issues : undefined,
      };
    } catch (error) {
      return {
        type: 'DMARC',
        status: 'unknown',
        message: 'Failed to check DMARC record',
        details: [error instanceof Error ? error.message : 'DNS lookup failed'],
      };
    }
  }

  /**
   * Query TXT records via DNS-over-HTTPS (Cloudflare)
   * 
   * Uses Cloudflare's DoH API since browser JS can't do native DNS lookups.
   */
  private async queryTxtRecords(domain: string): Promise<string[]> {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=TXT`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/dns-json',
      },
    });

    if (!response.ok) {
      throw new Error(`DNS lookup failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.Status !== 0) {
      // NXDOMAIN or other DNS error
      return [];
    }

    // Extract TXT record values
    const txtRecords: string[] = [];
    if (data.Answer) {
      for (const answer of data.Answer) {
        if (answer.type === 16) { // TXT record type
          // Remove quotes from TXT record value
          const value = (answer.data || '').replace(/^"|"$/g, '').replace(/"\s*"/g, '');
          txtRecords.push(value);
        }
      }
    }

    return txtRecords;
  }

  /**
   * Calculate overall domain health score
   */
  private calculateScore(records: DomainHealth['records']): number {
    const weights = {
      spf: 35,
      dkim: 40,
      dmarc: 25,
    };

    const statusScores: Record<RecordStatus, number> = {
      valid: 1.0,
      warning: 0.7,
      invalid: 0.2,
      missing: 0,
      unknown: 0.3,
    };

    let score = 0;
    for (const [key, record] of Object.entries(records) as [keyof typeof records, DnsRecordResult][]) {
      score += weights[key] * statusScores[record.status];
    }

    return Math.round(score);
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(records: DomainHealth['records'], domain: string): string[] {
    const recommendations: string[] = [];

    // SPF recommendations
    if (records.spf.status === 'missing') {
      recommendations.push(
        `Add SPF record: v=spf1 include:_spf.google.com include:sendgrid.net ~all`
      );
    } else if (records.spf.status === 'invalid') {
      recommendations.push('Fix your SPF record - it currently allows unauthorized senders');
    }

    // DKIM recommendations
    if (records.dkim.status === 'missing') {
      recommendations.push(
        'Configure DKIM signing in your email provider (SendGrid, Google Workspace, etc.)'
      );
    } else if (records.dkim.status === 'invalid') {
      recommendations.push('Your DKIM record is invalid - regenerate your DKIM keys');
    }

    // DMARC recommendations
    if (records.dmarc.status === 'missing') {
      recommendations.push(
        `Add DMARC record at _dmarc.${domain}: v=DMARC1; p=none; rua=mailto:dmarc-reports@${domain}`
      );
    } else if (records.dmarc.details?.some(d => d.includes('p=none'))) {
      recommendations.push(
        'Upgrade DMARC policy from p=none to p=quarantine after monitoring results'
      );
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Your domain authentication looks good! Keep monitoring DMARC reports.');
    }

    return recommendations;
  }

  /**
   * Get cached domain check result
   */
  private async getCachedResult(domain: string): Promise<DomainHealth | null> {
    try {
      if (!db) return null;
      
      const docRef = doc(collection(db, 'domain_health'), domain);
      const snapshot = await getDoc(docRef);
      
      if (!snapshot.exists()) {
        return null;
      }

      const data = snapshot.data();
      const cacheExpiry = data.cacheExpiry?.toDate?.() || new Date(data.cacheExpiry);
      
      if (cacheExpiry < new Date()) {
        return null; // Cache expired
      }

      return {
        ...data,
        lastChecked: data.lastChecked?.toDate?.() || new Date(data.lastChecked),
        cacheExpiry,
      } as DomainHealth;
    } catch {
      return null;
    }
  }

  /**
   * Cache domain check result
   */
  private async cacheResult(domain: string, health: DomainHealth): Promise<void> {
    try {
      if (!db) return;
      
      const docRef = doc(collection(db, 'domain_health'), domain);
      await setDoc(docRef, {
        ...health,
        lastChecked: Timestamp.fromDate(health.lastChecked),
        cacheExpiry: Timestamp.fromDate(health.cacheExpiry),
      });
    } catch (error) {
      // Log but don't fail
      console.warn('Failed to cache domain health:', error);
    }
  }

  /**
   * Get domain from email address
   */
  static getDomainFromEmail(email: string): string | null {
    const match = email.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Check if domain is likely a free email provider
   */
  static isFreeEmailProvider(domain: string): boolean {
    const freeProviders = [
      'gmail.com', 'googlemail.com',
      'yahoo.com', 'yahoo.co.uk',
      'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
      'aol.com',
      'icloud.com', 'me.com', 'mac.com',
      'protonmail.com', 'proton.me',
      'mail.com',
      'zoho.com',
    ];
    return freeProviders.includes(domain.toLowerCase());
  }
}

// Export singleton instance
export const domainAuthService = new DomainAuthService();

// Export default for testing
export default DomainAuthService;

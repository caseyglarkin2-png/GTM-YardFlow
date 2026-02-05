import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminAuth, getAdminDb } from '../../lib/firebaseAdmin';
import { createLogger } from '../../lib/logger';
import { withSentry } from '../../lib/sentry-server';
import { getRequestId } from '../../lib/request-id';

const log = createLogger('api-domain-check');

/**
 * Domain Health Check API
 * Sprint 39B.2: Check SPF, DKIM, and DMARC configuration for a domain
 * 
 * GET /api/domain/check?domain=example.com
 *   - domain: Required. Domain to check
 *   - refresh: Optional. Set to 'true' to bypass cache
 *   - selector: Optional. Specific DKIM selector to check
 * 
 * Returns domain health score and record details.
 * 
 * Authentication: Firebase token or S2S key
 */

// DNS-over-HTTPS via Cloudflare
async function queryTxtRecords(domain: string): Promise<string[]> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=TXT`;
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/dns-json' },
  });

  if (!response.ok) {
    throw new Error(`DNS lookup failed: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.Status !== 0) {
    return [];
  }

  const txtRecords: string[] = [];
  if (data.Answer) {
    for (const answer of data.Answer) {
      if (answer.type === 16) {
        const value = (answer.data || '').replace(/^"|"$/g, '').replace(/"\s*"/g, '');
        txtRecords.push(value);
      }
    }
  }

  return txtRecords;
}

type RecordStatus = 'valid' | 'invalid' | 'missing' | 'warning' | 'unknown';

interface DnsRecordResult {
  type: 'SPF' | 'DKIM' | 'DMARC';
  status: RecordStatus;
  value?: string;
  expected?: string;
  message: string;
  details?: string[];
}

interface DomainHealthResponse {
  domain: string;
  isHealthy: boolean;
  score: number;
  records: {
    spf: DnsRecordResult;
    dkim: DnsRecordResult;
    dmarc: DnsRecordResult;
  };
  recommendations: string[];
  lastChecked: string;
  cacheExpiry: string;
  requestId: string;
}

const DEFAULT_DKIM_SELECTORS = ['google', 's1', 's2', 'sendgrid', 'selector1', 'default'];
const CACHE_TTL_MS = parseInt(process.env.DOMAIN_CHECK_CACHE_TTL || '3600000', 10);

async function checkSpf(domain: string): Promise<DnsRecordResult> {
  try {
    const txtRecords = await queryTxtRecords(domain);
    const spfRecord = txtRecords.find(r => r.startsWith('v=spf1'));

    if (!spfRecord) {
      return {
        type: 'SPF',
        status: 'missing',
        message: 'No SPF record found',
        details: ['SPF helps prevent email spoofing', 'Configure an SPF record in your DNS settings'],
      };
    }

    const issues: string[] = [];
    
    if (!spfRecord.includes('~all') && !spfRecord.includes('-all')) {
      issues.push('Missing ~all or -all qualifier');
    }

    const includeCount = (spfRecord.match(/include:/g) || []).length;
    if (includeCount > 8) {
      issues.push(`Too many includes (${includeCount}/10 DNS lookups used)`);
    }

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

async function checkDkim(domain: string, specificSelector?: string): Promise<DnsRecordResult> {
  try {
    const selectorsToCheck = specificSelector ? [specificSelector] : DEFAULT_DKIM_SELECTORS;
    
    for (const selector of selectorsToCheck) {
      const dkimDomain = `${selector}._domainkey.${domain}`;
      const txtRecords = await queryTxtRecords(dkimDomain);
      
      const dkimRecord = txtRecords.find(r => r.includes('v=DKIM1') || r.includes('p='));
      
      if (dkimRecord) {
        if (!dkimRecord.includes('p=')) {
          return {
            type: 'DKIM',
            status: 'invalid',
            value: dkimRecord,
            expected: 'v=DKIM1; k=rsa; p=<public_key>',
            message: `DKIM record missing public key (selector: ${selector})`,
          };
        }

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
        `Checked selectors: ${selectorsToCheck.slice(0, 5).join(', ')}`,
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

async function checkDmarc(domain: string): Promise<DnsRecordResult> {
  try {
    const dmarcDomain = `_dmarc.${domain}`;
    const txtRecords = await queryTxtRecords(dmarcDomain);
    
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

    const issues: string[] = [];
    
    const policyMatch = dmarcRecord.match(/p=(none|quarantine|reject)/i);
    if (!policyMatch) {
      issues.push('Missing policy (p=) - should be none, quarantine, or reject');
    } else if (policyMatch[1].toLowerCase() === 'none') {
      issues.push('Policy is p=none (monitoring only) - consider p=quarantine or p=reject');
    }

    if (!dmarcRecord.includes('rua=')) {
      issues.push('No aggregate reporting address (rua=) - you won\'t receive reports');
    }

    const policy = policyMatch ? policyMatch[1] : 'unknown';

    return {
      type: 'DMARC',
      status: issues.length > 0 ? 'warning' : 'valid',
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

function calculateScore(records: { spf: DnsRecordResult; dkim: DnsRecordResult; dmarc: DnsRecordResult }): number {
  const weights = { spf: 35, dkim: 40, dmarc: 25 };
  const statusScores: Record<RecordStatus, number> = {
    valid: 1.0,
    warning: 0.7,
    invalid: 0.2,
    missing: 0,
    unknown: 0.3,
  };

  let score = 0;
  for (const key of ['spf', 'dkim', 'dmarc'] as const) {
    score += weights[key] * statusScores[records[key].status];
  }

  return Math.round(score);
}

function generateRecommendations(records: { spf: DnsRecordResult; dkim: DnsRecordResult; dmarc: DnsRecordResult }, domain: string): string[] {
  const recommendations: string[] = [];

  if (records.spf.status === 'missing') {
    recommendations.push('Add SPF record: v=spf1 include:_spf.google.com include:sendgrid.net ~all');
  } else if (records.spf.status === 'invalid') {
    recommendations.push('Fix your SPF record - it currently allows unauthorized senders');
  }

  if (records.dkim.status === 'missing') {
    recommendations.push('Configure DKIM signing in your email provider (SendGrid, Google Workspace, etc.)');
  } else if (records.dkim.status === 'invalid') {
    recommendations.push('Your DKIM record is invalid - regenerate your DKIM keys');
  }

  if (records.dmarc.status === 'missing') {
    recommendations.push(`Add DMARC record at _dmarc.${domain}: v=DMARC1; p=none; rua=mailto:dmarc-reports@${domain}`);
  } else if (records.dmarc.details?.some(d => d.includes('p=none'))) {
    recommendations.push('Upgrade DMARC policy from p=none to p=quarantine after monitoring results');
  }

  if (recommendations.length === 0) {
    recommendations.push('Your domain authentication looks good! Keep monitoring DMARC reports.');
  }

  return recommendations;
}

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const requestId = getRequestId(req);
  const requestLog = log.withRequestId(requestId);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed', requestId });
    return;
  }

  // Validate domain parameter
  const domain = typeof req.query.domain === 'string' ? req.query.domain.toLowerCase().trim() : null;
  if (!domain) {
    res.status(400).json({ error: 'Missing required parameter: domain', requestId });
    return;
  }

  // Validate domain format
  const domainRegex = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/;
  if (!domainRegex.test(domain)) {
    res.status(400).json({ error: 'Invalid domain format', requestId });
    return;
  }

  // Authenticate request
  let userId: string | null = null;
  const authHeader = req.headers.authorization;
  const s2sKey = process.env.SERVICE_TO_SERVICE_SECRET || process.env.CRON_SECRET;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    
    // Check for S2S key
    if (s2sKey && token === s2sKey) {
      userId = 'service:domain-check';
    } else {
      // Verify Firebase token
      try {
        const auth = await getAdminAuth();
        if (auth) {
          const decoded = await auth.verifyIdToken(token);
          userId = decoded.uid;
        }
      } catch (error) {
        requestLog.warn('Token verification failed', error instanceof Error ? error : undefined);
      }
    }
  }

  if (!userId) {
    res.status(401).json({ error: 'Invalid or missing authentication', requestId });
    return;
  }

  // Check cache
  const forceRefresh = req.query.refresh === 'true';
  const db = await getAdminDb();
  
  if (!forceRefresh && db) {
    try {
      const cacheDoc = await db.collection('domain_health').doc(domain).get();
      if (cacheDoc.exists) {
        const cached = cacheDoc.data();
        const cacheExpiry = cached?.cacheExpiry?.toDate?.() || new Date(cached?.cacheExpiry);
        
        if (cacheExpiry > new Date()) {
          requestLog.info('Returning cached domain health', { domain });
          
          const response: DomainHealthResponse = {
            domain,
            isHealthy: cached.isHealthy,
            score: cached.score,
            records: cached.records,
            recommendations: cached.recommendations,
            lastChecked: cached.lastChecked?.toDate?.()?.toISOString() || cached.lastChecked,
            cacheExpiry: cacheExpiry.toISOString(),
            requestId,
          };
          
          res.status(200).json(response);
          return;
        }
      }
    } catch (err) {
      requestLog.warn('Cache read failed', err instanceof Error ? err : undefined, { domain });
    }
  }

  // Perform fresh check
  requestLog.info('Checking domain health', { domain, userId });
  
  const selector = typeof req.query.selector === 'string' ? req.query.selector : undefined;
  
  const [spf, dkim, dmarc] = await Promise.all([
    checkSpf(domain),
    checkDkim(domain, selector),
    checkDmarc(domain),
  ]);

  const records = { spf, dkim, dmarc };
  const score = calculateScore(records);
  const recommendations = generateRecommendations(records, domain);

  const now = new Date();
  const cacheExpiry = new Date(now.getTime() + CACHE_TTL_MS);

  // Cache result
  if (db) {
    try {
      await db.collection('domain_health').doc(domain).set({
        domain,
        isHealthy: score >= 80,
        score,
        records,
        recommendations,
        lastChecked: now,
        cacheExpiry,
        checkedBy: userId,
      });
    } catch (err) {
      requestLog.warn('Cache write failed', err instanceof Error ? err : undefined, { domain });
    }
  }

  const response: DomainHealthResponse = {
    domain,
    isHealthy: score >= 80,
    score,
    records,
    recommendations,
    lastChecked: now.toISOString(),
    cacheExpiry: cacheExpiry.toISOString(),
    requestId,
  };

  requestLog.info('Domain health check complete', { domain, score, isHealthy: response.isHealthy });
  
  res.status(200).json(response);
}

export default withSentry(handler, 'api-domain-check');

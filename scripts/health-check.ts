#!/usr/bin/env npx tsx

/**
 * T6.2: Health Check Script
 * 
 * Runs health checks against all platform endpoints.
 * Usage: npx tsx scripts/health-check.ts
 * 
 * Exit codes:
 *   0 - All checks passed
 *   1 - Some checks failed
 */

interface HealthCheck {
  name: string;
  url: string;
  expectedStatus?: number;
  headers?: Record<string, string>;
}

interface HealthResult {
  name: string;
  status: 'ok' | 'error' | 'unreachable';
  latencyMs: number;
  statusCode?: number;
  error?: string;
}

const VERCEL_URL = process.env.VERCEL_URL || 'https://gtm-yard-flow.vercel.app';
const RAILWAY_URL = process.env.RAILWAY_API_URL || 'https://yardflow-hitlist-production-2f41.up.railway.app';
const S2S_SECRET = process.env.SERVICE_TO_SERVICE_SECRET || process.env.RAILWAY_API_SECRET || '';

const CHECKS: HealthCheck[] = [
  { 
    name: 'Vercel App', 
    url: VERCEL_URL,
    expectedStatus: 200,
  },
  { 
    name: 'Vercel Health', 
    url: `${VERCEL_URL}/api/health`,
    expectedStatus: 200,
  },
  { 
    name: 'Railway API', 
    url: `${RAILWAY_URL}/api/health`,
    headers: { 'x-service-key': S2S_SECRET },
    expectedStatus: 200,
  },
  { 
    name: 'Railway Templates', 
    url: `${RAILWAY_URL}/api/templates`,
    headers: { 'x-service-key': S2S_SECRET },
    expectedStatus: 200,
  },
];

async function checkEndpoint(check: HealthCheck): Promise<HealthResult> {
  const start = Date.now();
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(check.url, {
      method: 'GET',
      headers: check.headers || {},
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    const latencyMs = Date.now() - start;
    const expectedStatus = check.expectedStatus || 200;
    const isOk = res.status === expectedStatus;
    
    return {
      name: check.name,
      status: isOk ? 'ok' : 'error',
      latencyMs,
      statusCode: res.status,
      error: isOk ? undefined : `Expected ${expectedStatus}, got ${res.status}`,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    
    return {
      name: check.name,
      status: 'unreachable',
      latencyMs,
      error: error.includes('abort') ? 'Timeout (10s)' : error,
    };
  }
}

function formatLatency(ms: number): string {
  if (ms < 100) return `${ms}ms`;
  if (ms < 1000) return `${ms}ms ⚠️`;
  return `${(ms / 1000).toFixed(1)}s ⚠️`;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'ok': return '✅';
    case 'error': return '❌';
    case 'unreachable': return '🔴';
    default: return '❓';
  }
}

async function runHealthChecks(): Promise<void> {
  console.log('🏥 GTM-YardFlow Health Check');
  console.log('═'.repeat(50));
  console.log();

  const results = await Promise.all(CHECKS.map(checkEndpoint));
  
  // Display results
  const maxNameLen = Math.max(...results.map(r => r.name.length));
  
  for (const result of results) {
    const icon = getStatusIcon(result.status);
    const name = result.name.padEnd(maxNameLen);
    const latency = formatLatency(result.latencyMs);
    const status = result.statusCode ? `(${result.statusCode})` : '';
    
    console.log(`${icon} ${name}  ${latency} ${status}`);
    
    if (result.error) {
      console.log(`   └─ ${result.error}`);
    }
  }
  
  console.log();
  console.log('═'.repeat(50));
  
  // Summary
  const passed = results.filter(r => r.status === 'ok').length;
  const total = results.length;
  const allOk = passed === total;
  
  if (allOk) {
    console.log(`✅ All ${total} checks passed`);
  } else {
    console.log(`❌ ${passed}/${total} checks passed`);
  }
  
  // Exit with appropriate code
  process.exit(allOk ? 0 : 1);
}

// Run
runHealthChecks().catch((err) => {
  console.error('Health check failed:', err);
  process.exit(1);
});

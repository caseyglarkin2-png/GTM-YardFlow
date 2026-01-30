#!/usr/bin/env npx ts-node
/**
 * Railway Integration Smoke Test Script
 * Task T80.5 - Verifies Railway backend health and CORS configuration
 * 
 * Usage: npx ts-node scripts/verify-railway-integration.ts
 */

const RAILWAY_HEALTH_URL = 'https://yardflow-hitlist-production-2f41.up.railway.app/api/health';
const VERCEL_ORIGIN = 'https://gtm-yard-flow.vercel.app';

interface HealthResponse {
  status: string;
  timestamp?: string;
  database?: {
    status: string;
    connected?: boolean;
  };
  redis?: {
    status: string;
    connected?: boolean;
  };
  emailQueue?: {
    status: string;
    pending?: number;
    processing?: number;
  };
  services?: {
    database?: string;
    redis?: string;
    emailQueue?: string;
  };
}

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function logResult(name: string, passed: boolean, message: string): void {
  const icon = passed ? '✓' : '✗';
  const color = passed ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  console.log(`${color}${icon}${reset} ${name}: ${message}`);
  results.push({ name, passed, message });
}

async function testHealthEndpoint(): Promise<HealthResponse | null> {
  console.log('\n🔍 Testing Railway Health Endpoint...\n');
  console.log(`   URL: ${RAILWAY_HEALTH_URL}`);
  console.log(`   Origin: ${VERCEL_ORIGIN}\n`);

  try {
    const response = await fetch(RAILWAY_HEALTH_URL, {
      method: 'GET',
      headers: {
        'Origin': VERCEL_ORIGIN,
        'Accept': 'application/json',
      },
    });

    // Test 1: HTTP Status
    if (response.ok) {
      logResult('Health Endpoint', true, `HTTP ${response.status} OK`);
    } else {
      logResult('Health Endpoint', false, `HTTP ${response.status} ${response.statusText}`);
      return null;
    }

    // Test 2: CORS Headers
    const corsHeader = response.headers.get('access-control-allow-origin');
    const corsValid = corsHeader === VERCEL_ORIGIN || corsHeader === '*';
    
    if (corsValid) {
      logResult('CORS Configuration', true, `Access-Control-Allow-Origin: ${corsHeader}`);
    } else {
      logResult('CORS Configuration', false, `Missing or invalid CORS header (got: ${corsHeader || 'none'})`);
    }

    // Parse response body
    const data: HealthResponse = await response.json();
    return data;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logResult('Health Endpoint', false, `Connection failed: ${errorMessage}`);
    return null;
  }
}

function checkDatabaseStatus(data: HealthResponse): void {
  // Handle different response structures
  const dbStatus = data.database?.status || data.services?.database;
  const dbConnected = data.database?.connected;

  if (dbStatus === 'healthy' || dbStatus === 'connected' || dbConnected === true) {
    logResult('Database Status', true, `Status: ${dbStatus || 'connected'}`);
  } else if (dbStatus) {
    logResult('Database Status', false, `Status: ${dbStatus}`);
  } else {
    logResult('Database Status', false, 'Database status not reported in health response');
  }
}

function checkRedisStatus(data: HealthResponse): void {
  // Handle different response structures
  const redisStatus = data.redis?.status || data.services?.redis;
  const redisConnected = data.redis?.connected;

  if (redisStatus === 'healthy' || redisStatus === 'connected' || redisConnected === true) {
    logResult('Redis Status', true, `Status: ${redisStatus || 'connected'}`);
  } else if (redisStatus) {
    logResult('Redis Status', false, `Status: ${redisStatus}`);
  } else {
    logResult('Redis Status', false, 'Redis status not reported in health response');
  }
}

function checkEmailQueueStatus(data: HealthResponse): void {
  // Handle different response structures
  const queueStatus = data.emailQueue?.status || data.services?.emailQueue;
  const pending = data.emailQueue?.pending;
  const processing = data.emailQueue?.processing;

  if (queueStatus === 'healthy' || queueStatus === 'ready' || queueStatus === 'operational') {
    let details = `Status: ${queueStatus}`;
    if (pending !== undefined) details += `, Pending: ${pending}`;
    if (processing !== undefined) details += `, Processing: ${processing}`;
    logResult('Email Queue Status', true, details);
  } else if (queueStatus) {
    logResult('Email Queue Status', false, `Status: ${queueStatus}`);
  } else {
    logResult('Email Queue Status', false, 'Email queue status not reported in health response');
  }
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('         Railway Integration Smoke Test (T80.5)            ');
  console.log('═══════════════════════════════════════════════════════════');

  const healthData = await testHealthEndpoint();

  if (healthData) {
    console.log('\n📊 Service Status Checks:\n');
    checkDatabaseStatus(healthData);
    checkRedisStatus(healthData);
    checkEmailQueueStatus(healthData);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  if (failed === 0) {
    console.log(`\x1b[32m✓ All ${total} checks passed!\x1b[0m`);
  } else {
    console.log(`\x1b[31m✗ ${failed}/${total} checks failed\x1b[0m`);
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('\x1b[31mFatal error:\x1b[0m', error);
  process.exit(1);
});

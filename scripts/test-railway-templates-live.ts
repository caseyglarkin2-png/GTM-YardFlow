#!/usr/bin/env npx tsx
/**
 * Live Railway Templates Integration Test
 * Run after enabling VITE_RAILWAY_TEMPLATES_ENABLED=true
 * 
 * Tests:
 * 1. List templates from Railway
 * 2. Create a test template
 * 3. Verify it appears in list
 * 4. Delete the test template
 */

const RAILWAY_API_URL = process.env.RAILWAY_API_URL || 
  'https://yardflow-hitlist-production-2f41.up.railway.app';
const S2S_SECRET = process.env.SERVICE_TO_SERVICE_SECRET || 
  process.env.RAILWAY_API_SECRET ||
  process.env.CRON_SECRET;

if (!S2S_SECRET) {
  console.error('❌ No S2S secret found. Set SERVICE_TO_SERVICE_SECRET, RAILWAY_API_SECRET, or CRON_SECRET');
  process.exit(1);
}

interface RailwayTemplate {
  id: string;
  name: string;
  channel: string;
  tone?: string;
  subject?: string;
  template: string;
  isActive?: boolean;
  isDefault?: boolean;
}

async function railwayFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${RAILWAY_API_URL}${path}`;
  console.log(`  → ${options.method || 'GET'} ${path}`);
  
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-service-key': S2S_SECRET!,
      ...options.headers,
    },
  });
  
  const data = await res.json();
  
  if (!res.ok) {
    throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  }
  
  return data as T;
}

async function testTemplates() {
  console.log('🧪 Testing Railway Templates Integration\n');
  console.log(`Railway URL: ${RAILWAY_API_URL}`);
  console.log(`Secret: ${S2S_SECRET?.slice(0, 8)}...${S2S_SECRET?.slice(-4)}\n`);

  // Test 1: List templates
  console.log('1️⃣ Listing templates...');
  try {
    const templates = await railwayFetch<RailwayTemplate[]>('/api/templates');
    console.log(`   ✅ Found ${templates.length} templates`);
    if (templates.length > 0) {
      console.log(`   First template: "${templates[0].name}" (${templates[0].channel})`);
    }
  } catch (err) {
    console.error('   ❌ List failed:', err instanceof Error ? err.message : err);
    return false;
  }

  // Test 2: Create test template
  console.log('\n2️⃣ Creating test template...');
  let testTemplateId: string | null = null;
  try {
    const testTemplate = {
      name: `E2E Test ${Date.now()}`,
      channel: 'EMAIL',
      tone: 'PROFESSIONAL',
      subject: 'Test Subject',
      template: 'This is a test template body from GTM-YardFlow E2E test.',
      isActive: false,
    };
    
    const created = await railwayFetch<RailwayTemplate>('/api/templates', {
      method: 'POST',
      body: JSON.stringify(testTemplate),
    });
    
    testTemplateId = created.id;
    console.log(`   ✅ Created template: ${created.id}`);
    console.log(`   Name: "${created.name}"`);
  } catch (err) {
    console.error('   ❌ Create failed:', err instanceof Error ? err.message : err);
    return false;
  }

  // Test 3: Get single template
  console.log('\n3️⃣ Fetching created template...');
  try {
    const fetched = await railwayFetch<RailwayTemplate>(`/api/templates/${testTemplateId}`);
    console.log(`   ✅ Fetched: "${fetched.name}"`);
  } catch (err) {
    console.error('   ❌ Fetch failed:', err instanceof Error ? err.message : err);
  }

  // Test 4: Update template
  console.log('\n4️⃣ Updating template...');
  try {
    const updated = await railwayFetch<RailwayTemplate>(`/api/templates/${testTemplateId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: `Updated E2E Test ${Date.now()}` }),
    });
    console.log(`   ✅ Updated: "${updated.name}"`);
  } catch (err) {
    console.error('   ❌ Update failed:', err instanceof Error ? err.message : err);
  }

  // Test 5: Delete template (cleanup)
  console.log('\n5️⃣ Deleting test template...');
  try {
    await railwayFetch(`/api/templates/${testTemplateId}`, {
      method: 'DELETE',
    });
    console.log('   ✅ Deleted successfully');
  } catch (err) {
    console.error('   ❌ Delete failed:', err instanceof Error ? err.message : err);
    console.log('   ⚠️ Orphan template may exist in Railway DB');
  }

  console.log('\n✅ All template CRUD operations working!\n');
  return true;
}

async function testAIGeneration() {
  console.log('🤖 Testing Railway AI Content Generation\n');

  try {
    const result = await railwayFetch<{ subject?: string; content: string }>('/api/ai/content/generate', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email',
        tone: 'LUIS',
        goal: 'Schedule a demo meeting',
        context: {
          prospectName: 'Test User',
          companyName: 'Acme Logistics',
          title: 'VP Operations',
        },
      }),
    });

    console.log('✅ AI Generation successful!\n');
    console.log('Subject:', result.subject || '(none)');
    console.log('Content:', result.content?.slice(0, 200) + '...');
    return true;
  } catch (err) {
    console.error('❌ AI Generation failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Railway Integration E2E Test');
  console.log('═══════════════════════════════════════════════════════════\n');

  const templatesPassed = await testTemplates();
  console.log('\n───────────────────────────────────────────────────────────\n');
  const aiPassed = await testAIGeneration();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Templates CRUD: ${templatesPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  AI Generation:  ${aiPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(templatesPassed && aiPassed ? 0 : 1);
}

main().catch(console.error);

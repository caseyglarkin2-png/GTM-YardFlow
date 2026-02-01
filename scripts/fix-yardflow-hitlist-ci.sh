#!/bin/bash
# ============================================================================
# YardFlow-Hitlist CI Fix Script
# Run this in your YardFlow-Hitlist codespace terminal:
#   curl -fsSL https://raw.githubusercontent.com/caseyglarkin2-png/GTM-YardFlow/main/scripts/fix-yardflow-hitlist-ci.sh | bash
# Or copy/paste into terminal
# ============================================================================

set -e
cd /workspaces/YardFlow-Hitlist/eventops

echo "🔧 YardFlow-Hitlist TypeScript CI Fixes"
echo "========================================"
echo ""

# Check we're in the right place
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this from /workspaces/YardFlow-Hitlist/eventops"
    exit 1
fi

echo "📍 Working in: $(pwd)"
echo ""

# ============================================================================
# FIX 1: src/lib/agents/orchestrator.ts - Operator precedence
# ============================================================================
echo "1️⃣  Fixing orchestrator.ts operator precedence..."

if grep -q "params.items?.length ?? 0 === 0" src/lib/agents/orchestrator.ts 2>/dev/null; then
    sed -i 's/params\.items?\.length ?? 0 === 0/(params.items?.length ?? 0) === 0/g' src/lib/agents/orchestrator.ts
    echo "   ✅ Fixed operator precedence"
else
    echo "   ⏭️  Already fixed or pattern not found"
fi

# ============================================================================
# FIX 2: src/lib/agents/state-manager.ts - Add progress to task type
# ============================================================================
echo "2️⃣  Fixing state-manager.ts task type..."

if grep -q "status: 'pending' | 'in_progress' | 'completed' | 'failed'" src/lib/agents/state-manager.ts 2>/dev/null && ! grep -q "progress?: number" src/lib/agents/state-manager.ts 2>/dev/null; then
    sed -i "/status: 'pending' | 'in_progress' | 'completed' | 'failed'/a\  progress?: number;" src/lib/agents/state-manager.ts
    echo "   ✅ Added progress field"
else
    echo "   ⏭️  Already fixed or pattern not found"
fi

# ============================================================================
# FIX 3: src/lib/alerts/alert-manager.ts - LogContext compatibility
# ============================================================================
echo "3️⃣  Fixing alert-manager.ts logger calls..."

# Fix logger.error calls to use proper signature
if grep -q "logger\.error('.*', {" src/lib/alerts/alert-manager.ts 2>/dev/null; then
    # Replace logger.error('message', { context }) with logger.error('message', undefined, { context })
    sed -i "s/logger\.error('\([^']*\)', {/logger.error('\1', undefined, {/g" src/lib/alerts/alert-manager.ts
    echo "   ✅ Fixed logger.error calls"
else
    echo "   ⏭️  Already fixed or pattern not found"
fi

# ============================================================================
# FIX 4: src/lib/queue/workers.ts - Import heartbeatQueue and type error param
# ============================================================================
echo "4️⃣  Fixing workers.ts..."

# Add heartbeatQueue import if missing
if grep -q "import.*enrichmentQueue.*from" src/lib/queue/workers.ts 2>/dev/null && ! grep -q "heartbeatQueue" src/lib/queue/workers.ts 2>/dev/null; then
    sed -i "s/import { enrichmentQueue/import { enrichmentQueue, heartbeatQueue/g" src/lib/queue/workers.ts
    echo "   ✅ Added heartbeatQueue import"
fi

# Fix catch(err) to catch(err: unknown)
if grep -q "catch (err)" src/lib/queue/workers.ts 2>/dev/null; then
    sed -i 's/catch (err)/catch (err: unknown)/g' src/lib/queue/workers.ts
    echo "   ✅ Fixed error type annotations"
else
    echo "   ⏭️  Already fixed or pattern not found"
fi

# ============================================================================
# FIX 5: src/lib/env.ts - Add missing env vars
# ============================================================================
echo "5️⃣  Fixing env.ts..."

# Check if SENDGRID_API_KEY is missing from env schema
if ! grep -q "SENDGRID_API_KEY" src/lib/env.ts 2>/dev/null; then
    # Add after REDIS_URL line
    sed -i '/REDIS_URL/a\  SENDGRID_API_KEY: z.string().optional(),' src/lib/env.ts
    sed -i '/REDIS_URL/a\  SLACK_WEBHOOK_URL: z.string().optional(),' src/lib/env.ts
    echo "   ✅ Added SENDGRID_API_KEY and SLACK_WEBHOOK_URL"
else
    echo "   ⏭️  Already has env vars"
fi

# ============================================================================
# FIX 6: src/app/api/auth/session/route.ts - Remove non-existent image property
# ============================================================================
echo "6️⃣  Fixing session route..."

if grep -q "image: session\.user\.image" src/app/api/auth/session/route.ts 2>/dev/null; then
    sed -i '/image: session\.user\.image/d' src/app/api/auth/session/route.ts
    echo "   ✅ Removed non-existent image property"
else
    echo "   ⏭️  Already fixed or pattern not found"
fi

# ============================================================================
# FIX 7: tests/e2e/e2e-test-suite.ts - Handle undefined boolean
# ============================================================================
echo "7️⃣  Fixing e2e-test-suite.ts..."

if grep -q "process\.env\.CI" tests/e2e/e2e-test-suite.ts 2>/dev/null; then
    sed -i 's/process\.env\.CI/!!process.env.CI/g' tests/e2e/e2e-test-suite.ts
    echo "   ✅ Fixed boolean coercion"
else
    echo "   ⏭️  Already fixed or pattern not found"
fi

# ============================================================================
# FIX 8: API routes - Add error type guards
# ============================================================================
echo "8️⃣  Fixing API route error handling..."

# Find all route.ts files and fix catch blocks
find src/app/api -name "route.ts" -exec grep -l "catch (error)" {} \; 2>/dev/null | while read file; do
    if grep -q "catch (error)" "$file" && ! grep -q "catch (error: unknown)" "$file"; then
        sed -i 's/catch (error)/catch (error: unknown)/g' "$file"
        sed -i 's/error\.message/(error instanceof Error ? error.message : String(error))/g' "$file"
        echo "   ✅ Fixed: $file"
    fi
done

echo ""
echo "========================================"
echo "🔍 Running TypeScript check..."
echo ""

# Run type check
npx tsc --noEmit 2>&1 | head -50 || true

ERROR_COUNT=$(npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")

echo ""
echo "========================================"
if [ "$ERROR_COUNT" -eq "0" ]; then
    echo "✅ SUCCESS! 0 TypeScript errors"
    echo ""
    echo "📦 Ready to commit and push:"
    echo "   git add -A"
    echo "   git commit -m 'fix(types): resolve TypeScript errors for CI'"
    echo "   git push origin main"
else
    echo "⚠️  $ERROR_COUNT errors remaining"
    echo ""
    echo "Run 'npx tsc --noEmit' to see details"
fi

#!/bin/bash
# =============================================================================
# Sprint V37 - T37A: Manual E2E Verification Checklist
# =============================================================================
# 
# This script provides a guided manual testing checklist for verifying
# email flows and critical user journeys in production.
#
# Usage: ./scripts/qa-checklist.sh
#
# Prerequisites:
# - Access to https://gtm-yard-flow.vercel.app
# - Valid test account credentials
# - RAILWAY_API_SECRET environment variable set
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
SKIPPED=0

# Function to prompt for test result
check_test() {
  local test_name="$1"
  local test_desc="$2"
  
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}TEST: ${test_name}${NC}"
  echo -e "${test_desc}"
  echo ""
  read -p "Result? [p]ass / [f]ail / [s]kip: " result
  
  case "$result" in
    p|P)
      echo -e "${GREEN}✅ PASSED${NC}"
      ((PASSED++))
      ;;
    f|F)
      echo -e "${RED}❌ FAILED${NC}"
      ((FAILED++))
      read -p "Notes (optional): " notes
      if [ -n "$notes" ]; then
        echo "  └─ Notes: $notes"
      fi
      ;;
    *)
      echo -e "${YELLOW}⏭️  SKIPPED${NC}"
      ((SKIPPED++))
      ;;
  esac
}

# Header
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Sprint V37: Manual E2E Verification Checklist          ║${NC}"
echo -e "${BLUE}║                    QA Gate Testing                           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Production URL: https://gtm-yard-flow.vercel.app"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# =============================================================================
# PRE-FLIGHT CHECKS
# =============================================================================
echo -e "${YELLOW}═══ PRE-FLIGHT CHECKS ═══${NC}"

check_test "Build Status" "
Steps:
1. Run: npm run build
2. Verify no TypeScript errors
3. Verify build succeeds

Expected: Build completes without errors"

check_test "Test Suite" "
Steps:
1. Run: npm test -- --run
2. Verify all tests pass

Expected: All 170+ test files pass"

check_test "Railway Health" "
Steps:
1. Run: curl -s 'https://yardflow-hitlist-production-2f41.up.railway.app/api/health' \\
   -H 'x-service-key: \$RAILWAY_API_SECRET' | jq .
2. Verify status is 'healthy'

Expected: {\"status\": \"healthy\", \"database\": \"connected\", ...}"

# =============================================================================
# EMAIL FLOW TESTS
# =============================================================================
echo ""
echo -e "${YELLOW}═══ EMAIL FLOW TESTS ═══${NC}"

check_test "T37A.1: Company Email Button" "
Steps:
1. Open https://gtm-yard-flow.vercel.app
2. Navigate to Hits tab (Company view)
3. Find a company with contacts that have emails
4. Click the email (✉️) icon in the Actions column
5. Verify BulkEmailModal opens with company contacts pre-selected

Expected: Modal opens with correct recipients listed"

check_test "T37A.2: Prospect Quick Email" "
Steps:
1. Click on 'People' view toggle
2. Click on any prospect row to open detail panel
3. Click 'Send Email' button in detail panel
4. Verify email compose modal/form opens

Expected: Email compose opens with prospect pre-filled"

check_test "T37A.3: Bulk Selection Email" "
Steps:
1. In People view, select 3+ prospects using checkboxes
2. Click 'Email Selected' button in toolbar
3. Verify BulkEmailModal opens with correct count
4. Click 'AI Generate' to generate personalized content
5. Preview each recipient
6. Approve all and send

Expected: 
- Modal shows correct recipient count
- AI generates unique content per recipient
- Preview shows personalized content
- Send completes with success toast"

check_test "T37A.4: Sequence Enrollment" "
Steps:
1. Select a prospect in People view
2. In detail panel, click 'Add to Sequence'
3. Select a sequence from dropdown
4. Confirm enrollment

Expected: 
- Enrollment modal opens
- Sequences load from Railway
- Enrollment confirmation shows
- Prospect status updates"

check_test "T37A.5: Email Template Selection" "
Steps:
1. Open BulkEmailModal (via any path)
2. Click template dropdown
3. Verify templates load
4. Select a template
5. Verify content populates

Expected: Templates load and apply correctly"

# =============================================================================
# RAILWAY HEALTH TESTS
# =============================================================================
echo ""
echo -e "${YELLOW}═══ RAILWAY HEALTH TESTS ═══${NC}"

check_test "T37B.1: Sidebar Health Indicator" "
Steps:
1. Look at bottom of sidebar
2. Verify Railway status indicator shows

Expected: Green dot with 'Connected' or similar status"

check_test "T37B.2: Health Card Details" "
Steps:
1. Open Settings (gear icon)
2. Find Railway Health Card
3. Verify all subsystems shown

Expected: Shows database, redis, queue status with latencies"

# =============================================================================
# ERROR HANDLING TESTS
# =============================================================================
echo ""
echo -e "${YELLOW}═══ ERROR HANDLING TESTS ═══${NC}"

check_test "T37C.1: No Email Contacts" "
Steps:
1. Find a company with contacts but no emails
2. Verify email button is disabled or hidden

Expected: Cannot email company with no email contacts"

check_test "T37C.2: Empty Search Results" "
Steps:
1. Search for 'xyznonexistent12345'
2. Verify empty state message appears

Expected: 'No results' or similar message, no crash"

check_test "T37C.3: Console Errors" "
Steps:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Navigate through all tabs
4. Perform various actions

Expected: No red errors (warnings acceptable)"

# =============================================================================
# BUTTON AUDIT TESTS
# =============================================================================
echo ""
echo -e "${YELLOW}═══ BUTTON AUDIT TESTS ═══${NC}"

check_test "T37D.1: All Navigation Tabs" "
Steps:
1. Click Dashboard tab → verify content loads
2. Click Hits tab → verify HitList loads
3. Click Sequences tab → verify sequences load
4. Click Import tab → verify import wizard loads
5. Click Integrations tab → verify integrations load
6. Click AI tab → verify AI chat loads
7. Click ROI Calculator tab → verify calculator loads

Expected: Each tab loads its expected content"

check_test "T37D.2: Quick Filters" "
Steps:
1. In Hits tab, test each quick filter:
   - Manifest
   - T1
   - T1+T2
   - Needs Email
   - Has Gate
   - High ROI
   - Ready
   - Needs Research
2. Click 'Clear' to reset

Expected: Each filter applies correctly, Clear resets all"

check_test "T37D.3: Column Sorting" "
Steps:
1. Click each sortable column header
2. Click again to toggle direction
3. Verify sort indicator (arrow) shows

Expected: Data sorts, direction toggles, indicator shows"

check_test "T37D.4: Copy Email Button" "
Steps:
1. Open prospect detail panel
2. Click copy email button (📋)
3. Paste somewhere to verify

Expected: Email copied to clipboard"

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                        TEST SUMMARY                           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Passed:  $PASSED${NC}"
echo -e "${RED}Failed:  $FAILED${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED${NC}"
echo ""
TOTAL=$((PASSED + FAILED + SKIPPED))
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ QA GATE PASSED - All critical tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ QA GATE FAILED - $FAILED test(s) failed${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Review failed tests above"
  echo "2. Create issues for failures"
  echo "3. Fix and re-test"
  exit 1
fi

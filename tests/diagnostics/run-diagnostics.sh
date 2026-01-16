#!/bin/bash

# Convex Authentication Diagnostic Script
# Tests authentication infrastructure from bottom to top

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONVEX_URL="${CONVEX_CLOUD_ORIGIN:-https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com}"
AUTH_PROXY_URL="${CONVEX_SITE_ORIGIN:-https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com}"
SITE_URL="${CONVEX_SITE_URL:-https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com}"

echo -e "${BLUE}=== Convex Authentication Diagnostic Suite ===${NC}\n"

# Test counter
TOTAL=0
PASSED=0
FAILED=0

# Helper function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"

    TOTAL=$((TOTAL + 1))
    echo -e "${YELLOW}[Test $TOTAL]${NC} $test_name"

    if eval "$test_command"; then
        echo -e "  ${GREEN}✅ PASSED${NC}\n"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "  ${RED}❌ FAILED${NC}\n"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# ============================================================================
# Level 1: Docker Infrastructure
# ============================================================================
echo -e "${BLUE}--- Level 1: Docker Infrastructure ---${NC}\n"

run_test "Docker is installed and running" \
    "docker ps > /dev/null 2>&1"

run_test "Convex backend container exists" \
    "docker ps -a --format '{{.Names}}' | grep -q 'convex-backend'"

run_test "Convex backend container is running" \
    "docker ps --format '{{.Names}}' | grep -q 'convex-backend'"

run_test "Convex dashboard container exists" \
    "docker ps -a --format '{{.Names}}' | grep -q 'convex-dashboard'"

# ============================================================================
# Level 2: Port Accessibility
# ============================================================================
echo -e "${BLUE}--- Level 2: Port Accessibility ---${NC}\n"

run_test "Port 3210 (API) is listening" \
    "nc -z localhost 3210 2>/dev/null || curl -sf http://localhost:3210/version > /dev/null"

run_test "Port 3211 (Auth Proxy) is listening" \
    "nc -z localhost 3211 2>/dev/null"

run_test "Port 3211 (HTTP Actions) is listening" \
    "nc -z localhost 3211 2>/dev/null"

run_test "Port 6791 (Dashboard) is listening" \
    "nc -z localhost 6791 2>/dev/null"

# ============================================================================
# Level 3: Convex API Endpoints
# ============================================================================
echo -e "${BLUE}--- Level 3: Convex API Endpoints ---${NC}\n"

run_test "Convex API /version endpoint responds" \
    "curl -sf '$CONVEX_URL/version' > /dev/null"

run_test "Convex API /health endpoint responds" \
    "curl -sf '$CONVEX_URL/health' > /dev/null || curl -sf '$CONVEX_URL/api/node_instance_info' > /dev/null"

# ============================================================================
# Level 4: Auth Proxy Endpoints
# ============================================================================
echo -e "${BLUE}--- Level 4: Auth Proxy Endpoints ---${NC}\n"

run_test "Auth proxy URL is reachable (may return 502)" \
    "curl -sf -o /dev/null -w '%{http_code}' '$AUTH_PROXY_URL' | grep -qE '^(200|404|405|502)$'"

run_test "Auth proxy root endpoint response check" \
    "HTTP_CODE=\$(curl -sf -o /dev/null -w '%{http_code}' '$AUTH_PROXY_URL'); echo \"Auth proxy returned HTTP \$HTTP_CODE\"; [ \"\$HTTP_CODE\" != \"000\" ]"

run_test "Site URL /auth/config endpoint" \
    "HTTP_CODE=\$(curl -sf -o /dev/null -w '%{http_code}' '$SITE_URL/auth/config'); echo \"Site URL /auth/config returned HTTP \$HTTP_CODE\"; [ \"\$HTTP_CODE\" != \"000\" ]"

# ============================================================================
# Level 5: Environment Variables
# ============================================================================
echo -e "${BLUE}--- Level 5: Environment Variables ---${NC}\n"

run_test "JWT_PRIVATE_KEY file exists" \
    "[ -f './jwt_private_key.pem' ]"

run_test "JWT_PRIVATE_KEY file is not empty" \
    "[ -s './jwt_private_key.pem' ]"

run_test "JWT_PRIVATE_KEY has correct PEM format" \
    "grep -q 'BEGIN PRIVATE KEY' ./jwt_private_key.pem && grep -q 'END PRIVATE KEY' ./jwt_private_key.pem"

run_test ".env.convex.local file exists" \
    "[ -f './.env.convex.local' ]"

run_test "CONVEX_CLOUD_ORIGIN is set in .env.convex.local" \
    "grep -q 'CONVEX_CLOUD_ORIGIN=' ./.env.convex.local"

run_test "CONVEX_SITE_ORIGIN is set in .env.convex.local" \
    "grep -q 'CONVEX_SITE_ORIGIN=' ./.env.convex.local"

run_test "CONVEX_SITE_URL is set in .env.convex.local" \
    "grep -q 'CONVEX_SITE_URL=' ./.env.convex.local"

run_test "JWT_ISSUER is set in .env.convex.local" \
    "grep -q 'JWT_ISSUER=' ./.env.convex.local"

# ============================================================================
# Level 6: Docker Environment Variables (inside container)
# ============================================================================
echo -e "${BLUE}--- Level 6: Docker Container Environment ---${NC}\n"

run_test "JWT_PRIVATE_KEY is mounted in container" \
    "docker exec convex-backend-local test -f /jwt_private_key.pem"

run_test "JWT_PRIVATE_KEY is readable in container" \
    "docker exec convex-backend-local grep -q 'BEGIN PRIVATE KEY' /jwt_private_key.pem"

run_test "JWT_ISSUER environment variable is set in container" \
    "docker exec convex-backend-local env | grep -q 'JWT_ISSUER='"

run_test "CONVEX_SITE_URL environment variable is set in container" \
    "docker exec convex-backend-local env | grep -q 'CONVEX_SITE_URL='"

# ============================================================================
# Level 7: Convex Deployment Environment Variables
# ============================================================================
echo -e "${BLUE}--- Level 7: Convex Deployment Environment Variables ---${NC}\n"

# Get admin key
ADMIN_KEY=$(grep "CONVEX_ADMIN_KEY=" .env.convex.local | cut -d'=' -f2)
if [ -z "$ADMIN_KEY" ]; then
    ADMIN_KEY=$(grep "CONVEX_ADMIN_KEY=" .env | cut -d'=' -f2)
fi

if [ -n "$ADMIN_KEY" ]; then
    echo "Admin key found, testing deployment variables..."

    run_test "Deployment API is accessible" \
        "curl -sf -H 'Authorization: Convex $ADMIN_KEY' '$CONVEX_URL/api/v1/get_environment_variables' > /dev/null"

    # Check specific environment variables
    run_test "JWT_PRIVATE_KEY is set in deployment" \
        "curl -sf -H 'Authorization: Convex $ADMIN_KEY' '$CONVEX_URL/api/v1/get_environment_variables' | grep -q 'JWT_PRIVATE_KEY'"

    run_test "JWKS is set in deployment" \
        "curl -sf -H 'Authorization: Convex $ADMIN_KEY' '$CONVEX_URL/api/v1/get_environment_variables' | grep -q 'JWKS'"

    run_test "CONVEX_SITE_URL is set in deployment" \
        "curl -sf -H 'Authorization: Convex $ADMIN_KEY' '$CONVEX_URL/api/v1/get_environment_variables' | grep -q 'CONVEX_SITE_URL'"
else
    echo -e "${YELLOW}⚠️  No admin key found, skipping deployment API tests${NC}\n"
fi

# ============================================================================
# Level 8: Convex Function Execution
# ============================================================================
echo -e "${BLUE}--- Level 8: Convex Function Execution ---${NC}\n"

run_test "Convex functions are loading (check logs)" \
    "docker logs convex-backend-local 2>&1 | grep -qE '(Convex server listening|Initialized)'"

# ============================================================================
# Summary
# ============================================================================
echo -e "${BLUE}=== Diagnostic Summary ===${NC}\n"
echo -e "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Review the output above for details.${NC}"
    exit 1
fi

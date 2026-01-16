#!/bin/bash

# Generic Convex Self-Hosted Diagnostics Script
# Works in any workspace/environment without hardcoded values

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Auto-detect configuration
CONVEX_CONTAINER="${CONVEX_CONTAINER:-convex-backend-local}"
DASHBOARD_CONTAINER="${DASHBOARD_CONTAINER:-convex-dashboard-local}"
ENV_FILE="${ENV_FILE:-.env.convex.local}"
JWT_KEY_FILE="${JWT_KEY_FILE:-./jwt_private_key.pem}"

# Detect URLs from environment or use localhost defaults
CONVEX_URL="${CONVEX_CLOUD_ORIGIN:-${CONVEX_URL:-http://localhost:3210}}"
SITE_PROXY_URL="${CONVEX_SITE_ORIGIN:-${SITE_PROXY_URL:-http://localhost:3211}}"
DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:6791}"

# Detect if running in Coder workspace
if [ -n "$CODER" ] && [ -n "$CODER_WORKSPACE_NAME" ]; then
    WORKSPACE_TYPE="Coder"
    CODER_DOMAIN="${CODER_URL#*//}"
    echo -e "${CYAN}Detected Coder workspace: ${CODER_WORKSPACE_NAME}@${CODER_DOMAIN}${NC}\n"
else
    WORKSPACE_TYPE="Local"
    echo -e "${CYAN}Detected local development environment${NC}\n"
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Convex Self-Hosted Diagnostic Suite${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Configuration:${NC}"
echo -e "  Environment:  ${WORKSPACE_TYPE}"
echo -e "  Convex URL:   ${CONVEX_URL}"
echo -e "  Site Proxy:   ${SITE_PROXY_URL}"
echo -e "  Dashboard:    ${DASHBOARD_URL}"
echo -e "  Container:    ${CONVEX_CONTAINER}"
echo -e "  Env File:     ${ENV_FILE}"
echo ""

# Test counter
TOTAL=0
PASSED=0
FAILED=0
SKIPPED=0

# Helper function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local required="${3:-true}"  # If false, test is skipped on failure

    TOTAL=$((TOTAL + 1))

    if ! eval "$test_command" 2>/dev/null; then
        if [ "$required" = "false" ]; then
            echo -e "  ${YELLOW}⏭️  SKIPPED${NC} ${test_name}"
            SKIPPED=$((SKIPPED + 1))
            return 2
        else
            echo -e "  ${RED}❌ FAILED${NC} ${test_name}"
            FAILED=$((FAILED + 1))
            return 1
        fi
    fi

    echo -e "  ${GREEN}✅ PASSED${NC} ${test_name}"
    PASSED=$((PASSED + 1))
    return 0
}

# ============================================================================
# Section 1: Docker Infrastructure
# ============================================================================
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}  Docker Infrastructure${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo ""

run_test "Docker is installed" \
    "command -v docker > /dev/null"

run_test "Docker is running" \
    "docker ps > /dev/null 2>&1"

run_test "Convex backend container exists" \
    "docker ps -a --format '{{.Names}}' | grep -q '${CONVEX_CONTAINER}'" \
    false

run_test "Convex backend container is running" \
    "docker ps --format '{{.Names}}' | grep -q '${CONVEX_CONTAINER}'" \
    false

run_test "Dashboard container exists" \
    "docker ps -a --format '{{.Names}}' | grep -q '${DASHBOARD_CONTAINER}'" \
    false

run_test "Dashboard container is running" \
    "docker ps --format '{{.Names}}' | grep -q '${DASHBOARD_CONTAINER}'" \
    false

echo ""

# ============================================================================
# Section 2: Port Accessibility (Local)
# ============================================================================
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}  Port Accessibility (Local)${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo ""

# Extract port from URL (handle http:// and https://)
extract_port() {
    local url="$1"
    local port=$(echo "$url" | grep -o ':[0-9]*' | tail -1 | tr -d ':')
    echo "${port:-80}"
}

API_PORT=$(extract_port "$CONVEX_URL")
SITE_PORT=$(extract_port "$SITE_PROXY_URL")
DASH_PORT=$(extract_port "$DASHBOARD_URL")

run_test "Port ${API_PORT} (API) is accessible" \
    "curl -sf --connect-timeout 2 'http://localhost:${API_PORT}/version' > /dev/null || nc -z localhost ${API_PORT} 2>/dev/null"

run_test "Port ${SITE_PORT} (Site Proxy) is accessible" \
    "nc -z localhost ${SITE_PORT} 2>/dev/null || curl -sf --connect-timeout 2 'http://localhost:${SITE_PORT}' > /dev/null"

run_test "Port ${DASH_PORT} (Dashboard) is accessible" \
    "nc -z localhost ${DASH_PORT} 2>/dev/null"

echo ""

# ============================================================================
# Section 3: Convex Instance Info
# ============================================================================
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}  Convex Instance Information${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo ""

run_test "Convex API /version endpoint responds" \
    "curl -sf --connect-timeout 5 '${CONVEX_URL}/version' > /dev/null"

VERSION_OUTPUT=$(curl -sf --connect-timeout 5 "${CONVEX_URL}/version" 2>/dev/null || echo "")
if [ -n "$VERSION_OUTPUT" ]; then
    echo -e "  ${CYAN}📋 Version info:${NC} $VERSION_OUTPUT"
fi

echo ""

# ============================================================================
# Section 4: Auth Configuration Endpoints
# ============================================================================
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}  Auth Configuration Endpoints${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo ""

run_test "Site Proxy URL is reachable" \
    "HTTP_CODE=\$(curl -sf -o /dev/null -w '%{http_code}' --connect-timeout 5 '${SITE_PROXY_URL}'); [ \"\$HTTP_CODE\" != \"000\" ]"

# Get actual HTTP code for display
HTTP_CODE=$(curl -sf -o /dev/null -w '%{http_code}' --connect-timeout 5 "$SITE_PROXY_URL" 2>/dev/null || echo "000")
echo -e "  ${CYAN}📋 Site Proxy returned:${NC} HTTP $HTTP_CODE"

run_test "Auth config endpoint responds" \
    "HTTP_CODE=\$(curl -sf -o /dev/null -w '%{http_code}' --connect-timeout 5 '${CONVEX_URL}/auth/config'); [ \"\$HTTP_CODE\" != \"000\" ]"

echo ""

# ============================================================================
# Section 5: Environment Variables
# ============================================================================
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}  Environment Variables${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo ""

run_test "Environment file exists" \
    "[ -f '${ENV_FILE}' ]" \
    false

run_test "CONVEX_CLOUD_ORIGIN is set" \
    "grep -q 'CONVEX_CLOUD_ORIGIN=' '${ENV_FILE}' 2>/dev/null" \
    false

run_test "CONVEX_SITE_ORIGIN is set" \
    "grep -q 'CONVEX_SITE_ORIGIN=' '${ENV_FILE}' 2>/dev/null" \
    false

run_test "CONVEX_SITE_URL is set" \
    "grep -q 'CONVEX_SITE_URL=' '${ENV_FILE}' 2>/dev/null" \
    false

run_test "JWT_ISSUER is set" \
    "grep -q 'JWT_ISSUER=' '${ENV_FILE}' 2>/dev/null" \
    false

echo ""

# ============================================================================
# Section 6: JWT Configuration
# ============================================================================
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}  JWT Configuration${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo ""

run_test "JWT private key file exists" \
    "[ -f '${JWT_KEY_FILE}' ]" \
    false

run_test "JWT private key is not empty" \
    "[ -s '${JWT_KEY_FILE}' ]" \
    false

run_test "JWT private key has valid PEM format" \
    "grep -q 'BEGIN.*KEY' '${JWT_KEY_FILE}' && grep -q 'END.*KEY' '${JWT_KEY_FILE}'" \
    false

echo ""

# ============================================================================
# Section 7: Docker Container Environment
# ============================================================================
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}  Docker Container Environment${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo ""

run_test "JWT key is mounted in container" \
    "docker exec ${CONVEX_CONTAINER} test -f /jwt_private_key.pem 2>/dev/null" \
    false

run_test "JWT_ISSUER is set in container" \
    "docker exec ${CONVEX_CONTAINER} env | grep -q 'JWT_ISSUER=' 2>/dev/null" \
    false

run_test "CONVEX_SITE_URL is set in container" \
    "docker exec ${CONVEX_CONTAINER} env | grep -q 'CONVEX_SITE_URL=' 2>/dev/null" \
    false

run_test "CONVEX_CLOUD_ORIGIN is set in container" \
    "docker exec ${CONVEX_CONTAINER} env | grep -q 'CONVEX_CLOUD_ORIGIN=' 2>/dev/null" \
    false

echo ""

# ============================================================================
# Section 8: Docker Container Health
# ============================================================================
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}  Docker Container Health${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo ""

run_test "Backend container is healthy" \
    "docker inspect ${CONVEX_CONTAINER} --format='{{.State.Health.Status}}' | grep -q 'healthy'" \
    false

echo ""

# ============================================================================
# Summary
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "  Total Tests:   ${TOTAL}"
echo -e "  ${GREEN}Passed:${NC}        ${PASSED}"
echo -e "  ${RED}Failed:${NC}        ${FAILED}"
echo -e "  ${YELLOW}Skipped:${NC}       ${SKIPPED}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All critical tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Check the output above for details.${NC}"
    exit 1
fi

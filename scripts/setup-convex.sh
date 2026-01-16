#!/bin/bash
# Setup script for self-hosted Convex
set -e

echo "🔧 Setting up self-hosted Convex..."

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.convex.yml"
ENV_FILE="$PROJECT_ROOT/.env.convex.local"

# Detect Coder environment and generate workspace URLs
if [ -n "$CODER" ] && [ -n "$CODER_WORKSPACE_NAME" ]; then
    # Extract protocol and domain from CODER_URL (e.g., https://coder.hahomelabs.com)
    CODER_PROTOCOL="${CODER_URL%%://*}"
    CODER_DOMAIN="${CODER_URL#*//}"

    # Get workspace name and owner from Coder environment
    WORKSPACE_NAME="$CODER_WORKSPACE_NAME"
    USERNAME="${CODER_WORKSPACE_OWNER_NAME:-$USER}"

    # Generate Coder workspace URLs
    # Format: <protocol>://<service>--<workspace>--<owner>.<coder-domain>
    # Example: https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com
    CONVEX_API_URL="${CODER_PROTOCOL}://convex-api--${WORKSPACE_NAME}--${USERNAME}.${CODER_DOMAIN}"
    CONVEX_PROXY_URL="${CODER_PROTOCOL}://convex-site--${WORKSPACE_NAME}--${USERNAME}.${CODER_DOMAIN}"
    CONVEX_DASHBOARD_URL="${CODER_PROTOCOL}://convex--${WORKSPACE_NAME}--${USERNAME}.${CODER_DOMAIN}"

    echo "🖥️  Coder workspace detected"
    echo "   Workspace: $WORKSPACE_NAME"
    echo "   Owner: $USERNAME"
    echo "   Domain: $CODER_DOMAIN"
    echo "   Protocol: $CODER_PROTOCOL"
    echo ""
fi

# Source environment variables
if [ -f "$ENV_FILE" ]; then
    echo "📦 Loading environment variables from $ENV_FILE"
    set -a
    source "$ENV_FILE"
    set +a
else
    echo "⚠️  Warning: $ENV_FILE not found, using default environment"
fi

# Set default URLs if not already defined (use Coder-generated URLs if available)
CONVEX_CLOUD_ORIGIN="${CONVEX_CLOUD_ORIGIN:-${CONVEX_API_URL:-http://localhost:3210}}"
CONVEX_SITE_ORIGIN="${CONVEX_SITE_ORIGIN:-${CONVEX_PROXY_URL:-http://localhost:3211}}"
CONVEX_SITE_URL="${CONVEX_SITE_URL:-${CONVEX_API_URL:-http://localhost:3210}}"
CONVEX_DEPLOYMENT_URL="${CONVEX_DEPLOYMENT_URL:-${CONVEX_API_URL:-http://localhost:3210}}"
export CONVEX_CLOUD_ORIGIN CONVEX_SITE_ORIGIN CONVEX_SITE_URL CONVEX_DEPLOYMENT_URL

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    exit 1
fi

# Check if docker compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available"
    exit 1
fi

# Check if PostgreSQL is available (POSTGRES_URL or DATABASE_URL)
if [ -n "$POSTGRES_URL" ] || [ -n "$DATABASE_URL" ]; then
    echo "✅ PostgreSQL database URL configured"
else
    echo "❌ POSTGRES_URL is not set"
    echo "   Please set POSTGRES_URL in $ENV_FILE"
    exit 1
fi

echo "🚀 Starting Convex Docker services..."
cd "$PROJECT_ROOT"
docker compose -f "$DOCKER_COMPOSE_FILE" --env-file "$ENV_FILE" up -d

echo "⏳ Waiting for Convex backend to be healthy..."
timeout 60 bash -c 'until docker compose -f "$1" --env-file "$2" ps --format json | grep -q '"'"'healthy'"'"'; do sleep 2; done' _ "$DOCKER_COMPOSE_FILE" "$ENV_FILE"

echo ""
echo "✅ Convex services are running!"
echo ""
echo "📍 Service URLs:"
echo "   - Convex API:     ${CONVEX_CLOUD_ORIGIN:-http://localhost:3210}"
echo "   - Convex Proxy:   ${CONVEX_SITE_ORIGIN:-http://localhost:3211}"
echo "   - Dashboard:      ${CONVEX_DASHBOARD_URL:-http://localhost:6791}"
echo ""

# Write Coder URLs to .env.convex.local if in Coder environment
if [ -n "$CONVEX_API_URL" ]; then
    echo "📝 Writing Coder workspace URLs to $ENV_FILE"

    # Update or add CONVEX_CLOUD_ORIGIN
    if grep -q "^CONVEX_CLOUD_ORIGIN=" "$ENV_FILE" 2>/dev/null; then
        sed -i "s|^CONVEX_CLOUD_ORIGIN=.*|CONVEX_CLOUD_ORIGIN=$CONVEX_API_URL|" "$ENV_FILE"
    else
        echo "CONVEX_CLOUD_ORIGIN=$CONVEX_API_URL" >> "$ENV_FILE"
    fi

    # Update or add CONVEX_SITE_ORIGIN
    if grep -q "^CONVEX_SITE_ORIGIN=" "$ENV_FILE" 2>/dev/null; then
        sed -i "s|^CONVEX_SITE_ORIGIN=.*|CONVEX_SITE_ORIGIN=$CONVEX_PROXY_URL|" "$ENV_FILE"
    else
        echo "CONVEX_SITE_ORIGIN=$CONVEX_PROXY_URL" >> "$ENV_FILE"
    fi

    # Update or add CONVEX_SITE_URL (required by @convex-dev/auth)
    # NOTE: CONVEX_SITE_URL should point to the API URL, not the proxy URL
    # This is used by auth.config.ts for the auth provider domain
    if grep -q "^CONVEX_SITE_URL=" "$ENV_FILE" 2>/dev/null; then
        sed -i "s|^CONVEX_SITE_URL=.*|CONVEX_SITE_URL=$CONVEX_API_URL|" "$ENV_FILE"
    else
        echo "CONVEX_SITE_URL=$CONVEX_API_URL" >> "$ENV_FILE"
    fi

    # Update or add CONVEX_DEPLOYMENT_URL
    if grep -q "^CONVEX_DEPLOYMENT_URL=" "$ENV_FILE" 2>/dev/null; then
        sed -i "s|^CONVEX_DEPLOYMENT_URL=.*|CONVEX_DEPLOYMENT_URL=$CONVEX_API_URL|" "$ENV_FILE"
    else
        echo "CONVEX_DEPLOYMENT_URL=$CONVEX_API_URL" >> "$ENV_FILE"
    fi

    echo "✅ URLs written to $ENV_FILE"
    echo ""
fi

# Get admin key from Docker container
echo "🔑 Retrieving admin key from Convex container..."
ADMIN_KEY=$(docker exec convex-backend-local printenv | grep CONVEX_ADMIN_KEY | cut -d= -f2-)

if [ -n "$ADMIN_KEY" ]; then
    echo "✅ Admin key found: ${ADMIN_KEY:0:20}..."
    echo ""
    echo "⚠️  Add this to your .env.local file:"
    echo "   CONVEX_SELF_HOSTED_ADMIN_KEY=$ADMIN_KEY"
    echo ""
    # Optionally add to .env.convex.local
    if [ -f "$ENV_FILE" ]; then
        if ! grep -q "CONVEX_SELF_HOSTED_ADMIN_KEY" "$ENV_FILE"; then
            echo "CONVEX_SELF_HOSTED_ADMIN_KEY=$ADMIN_KEY" >> "$ENV_FILE"
            echo "✅ Added admin key to $ENV_FILE"
        fi
    fi
else
    echo "⚠️  Could not retrieve admin key automatically"
    echo "   You may need to generate it manually or check the container logs"
fi

echo ""
echo "📝 Next steps:"
echo "   1. Update your .env.local with CONVEX_SELF_HOSTED_URL and admin key"
echo "   2. Run: npx convex dev --configure"
echo "   3. Select self-hosted deployment when prompted"
echo "   4. Deploy your functions: npx convex deploy --code"
echo ""

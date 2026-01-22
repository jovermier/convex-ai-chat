#!/bin/bash
set -e

# Start script for AI Document Editor App
# Starts the Convex backend (Docker) and frontend (PM2)

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "🚀 Starting AI Document Editor App..."

# Check if services are already running
CONVEX_RUNNING=false
PM2_RUNNING=false

# Check if Convex Docker containers are running
if docker compose -f docker-compose.convex.yml ps 2>/dev/null | grep -q "convex-backend.*Up"; then
    CONVEX_RUNNING=true
fi

# Check if PM2 frontend is running
if pm2 list 2>/dev/null | grep -q "frontend.*online"; then
    PM2_RUNNING=true
fi

# If either service is running, stop them first
if [ "$CONVEX_RUNNING" = true ] || [ "$PM2_RUNNING" = true ]; then
    echo "⚠️  Services already running:"
    [ "$CONVEX_RUNNING" = true ] && echo "   - Convex backend (Docker)"
    [ "$PM2_RUNNING" = true ] && echo "   - Frontend (PM2)"
    echo ""
    echo "🛑 Stopping existing services..."
    bash ./stop.sh
    echo ""
fi

# Detect if running in Coder workspace
if [ -n "$CODER" ] && [ -n "$CODER_WORKSPACE_NAME" ]; then
    # Coder workspace URLs are generated dynamically
    CODER_PROTOCOL="${CODER_URL%%://*}"
    CODER_DOMAIN="${CODER_URL#*//}"
    WORKSPACE_NAME="$CODER_WORKSPACE_NAME"
    USERNAME="${CODER_WORKSPACE_OWNER_NAME:-$USER}"

    # Generate Coder workspace URLs (service name, not port number)
    FRONTEND_URL="${CODER_PROTOCOL}://app--${WORKSPACE_NAME}--${USERNAME}.${CODER_DOMAIN}"
    BACKEND_URL="${CODER_PROTOCOL}://convex-api--${WORKSPACE_NAME}--${USERNAME}.${CODER_DOMAIN}"
    DASHBOARD_URL="${CODER_PROTOCOL}://convex--${WORKSPACE_NAME}--${USERNAME}.${CODER_DOMAIN}"
else
    # Local development URLs
    FRONTEND_URL="http://localhost:3000"
    BACKEND_URL="http://localhost:3210"
    DASHBOARD_URL="http://localhost:6791"
fi

# Pull latest images quietly (ignore errors for local images)
echo "📦 Pulling latest Docker images..."
docker compose -f docker-compose.convex.yml pull --quiet 2>/dev/null || true

# Check if Convex setup is needed
ENV_FILE=".env.convex.local"
SETUP_NEEDED=0

if [ ! -f "$ENV_FILE" ]; then
    echo "🔧 .env.convex.local not found, running setup..."
    SETUP_NEEDED=1
else
    # Check if required variables are present
    if ! grep -q "^POSTGRES_URL=" "$ENV_FILE" 2>/dev/null; then
        echo "🔧 .env.convex.local missing POSTGRES_URL, running setup..."
        SETUP_NEEDED=1
    fi
    # In Coder environment, also check for Convex URLs
    if [ -n "$CODER" ] && [ -n "$CODER_WORKSPACE_NAME" ]; then
        if ! grep -q "^CONVEX_CLOUD_ORIGIN=" "$ENV_FILE" 2>/dev/null; then
            echo "🔧 .env.convex.local missing Convex URLs, running setup..."
            SETUP_NEEDED=1
        fi
    fi
fi

if [ $SETUP_NEEDED -eq 1 ]; then
    bash scripts/setup-convex.sh --no-start
    echo ""
fi

# Ensure JWT key file exists before starting Docker
# Docker will create a directory if the mounted file doesn't exist
JWT_KEY_FILE="jwt_private_key.pem"
if [ ! -f "$JWT_KEY_FILE" ]; then
    echo "🔑 Creating JWT key file (required before starting Docker)..."
    openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 2>/dev/null | openssl pkcs8 -topk8 -nocrypt -outform PEM 2>/dev/null > "$JWT_KEY_FILE"
    echo "✅ Created $JWT_KEY_FILE"
fi

# Start Convex backend with Docker Compose
# Load environment variables from .env.convex.local FIRST
# This ensures the ${VAR:-default} substitution in docker-compose.yml
# resolves to actual values instead of defaults
echo "📦 Starting Convex backend..."
set -a
source .env.convex.local
set +a
docker compose -f docker-compose.convex.yml up -d convex-backend convex-dashboard

# Wait for backend to be healthy
echo "⏳ Waiting for Convex backend to be healthy..."
timeout 60 bash -c 'until docker compose -f docker-compose.convex.yml ps 2>/dev/null | grep convex-backend | grep -q healthy; do sleep 2; done' || {
    echo "❌ Convex backend failed to become healthy"
    exit 1
}

echo "✅ Convex backend is healthy"

# Generate or validate admin key
echo "🔑 Checking admin key..."
CURRENT_KEY=$(grep "^CONVEX_SELF_HOSTED_ADMIN_KEY=" .env.local 2>/dev/null | cut -d'=' -f2 | tr -d '"')

# Test if current key works by trying a simple API call
if [ -n "$CURRENT_KEY" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Convex $CURRENT_KEY" \
        "$BACKEND_URL/api/deploy2/evaluate_push" 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "000" ]; then
        echo "  ⚠️  Existing admin key is invalid or expired"
        CURRENT_KEY=""
    fi
fi

# Generate new admin key if needed
if [ -z "$CURRENT_KEY" ]; then
    echo "  🔑 Generating new admin key..."
    NEW_KEY=$(docker compose -f docker-compose.convex.yml exec -T convex-backend ./generate_admin_key.sh 2>/dev/null | grep -E "^app\|" || echo "")

    if [ -z "$NEW_KEY" ]; then
        echo "  ❌ Failed to generate admin key"
        exit 1
    fi

    echo "  ✅ Generated admin key: ${NEW_KEY:0:30}..."

    # Update .env.local with new key
    if [ -f .env.local ]; then
        # Replace existing key or add it if not present
        if grep -q "^CONVEX_SELF_HOSTED_ADMIN_KEY=" .env.local; then
            sed -i "s/^CONVEX_SELF_HOSTED_ADMIN_KEY=.*/CONVEX_SELF_HOSTED_ADMIN_KEY=\"$NEW_KEY\"/" .env.local
        else
            echo "CONVEX_SELF_HOSTED_ADMIN_KEY=\"$NEW_KEY\"" >> .env.local
        fi
    else
        # Create .env.local if it doesn't exist
        cat > .env.local << EOF
# Self-hosted Convex configuration for local development
CONVEX_SELF_HOSTED_URL=$BACKEND_URL
CONVEX_SELF_HOSTED_ADMIN_KEY="$NEW_KEY"

# Frontend Configuration
VITE_CONVEX_URL=$BACKEND_URL
EOF
    fi

    # Also update .env.convex.local for the container
    if [ -f .env.convex.local ]; then
        sed -i "s/^CONVEX_SELF_HOSTED_ADMIN_KEY=.*/CONVEX_SELF_HOSTED_ADMIN_KEY='$NEW_KEY'/" .env.convex.local
        sed -i "s/^CONVEX_ADMIN_KEY=.*/CONVEX_ADMIN_KEY='$NEW_KEY'/" .env.convex.local
    fi

    echo "  ✅ Admin key updated in .env.local and .env.convex.local"
else
    echo "  ✅ Existing admin key is valid"
fi

# Ensure .env.local has CONVEX_SITE_ORIGIN for Convex CLI tools
# Convex reads .env.local but not .env.convex.local by default
if ! grep -q "^CONVEX_SITE_ORIGIN=" .env.local 2>/dev/null; then
    echo "🔧 Adding CONVEX_SITE_ORIGIN to .env.local..."
    # Get value from .env.convex.local
    SITE_ORIGIN=$(grep "^CONVEX_SITE_ORIGIN=" .env.convex.local 2>/dev/null | cut -d'=' -f2)
    if [ -n "$SITE_ORIGIN" ]; then
        echo "CONVEX_SITE_ORIGIN=$SITE_ORIGIN" >> .env.local
        echo "  ✅ Added CONVEX_SITE_ORIGIN to .env.local"
    fi
fi

# Ensure dependencies are installed before deploying
if [ ! -d "node_modules" ]; then
    echo "📦 node_modules not found, installing dependencies..."
    pnpm install
    echo "✅ Dependencies installed"
fi

# Ensure Playwright browsers are installed for tests
# Note: This is only needed if running tests; skip in CI/production environments
if [ -z "$CI" ] && ! pnpm exec playwright --version >/dev/null 2>&1; then
    echo "🎭 Playwright not installed, skipping test setup (tests will install it when needed)"
elif [ -z "$CI" ] && [ ! -d "$HOME/.cache/ms-playwright" ]; then
    echo "🎭 Playwright browsers not installed, installing (this may take a minute)..."
    pnpm test:install || echo "⚠️  Playwright test install skipped (may fail in some environments)"
    echo "✅ Playwright browsers ready"
fi

# Generate Convex deployment environment variables FIRST
# These variables must be set BEFORE deployment or deployment will fail
# Note: CONVEX_SITE_ORIGIN is required by auth.config.ts
echo "🔐 Generating Convex deployment environment variables..."
bash scripts/generate-convex-env.sh

# Deploy Convex functions AFTER env vars are set
# Note: npx convex deploy automatically reads .env.local (which has CONVEX_SITE_ORIGIN)
echo "📦 Deploying Convex functions..."
# Ensure CONVEX_SITE_ORIGIN is exported for npx convex deploy validation
export CONVEX_SITE_ORIGIN
npx convex deploy --yes

echo "✅ Convex functions deployed"

# Start services with PM2 using ecosystem config
echo "🎨 Starting services with PM2 (ecosystem.config.cjs)..."

# Stop existing processes if running
for app in frontend convex-env-sync convex-code-sync; do
    if pm2 list | grep -q "$app"; then
        echo "  Stopping existing PM2 process: $app..."
        pm2 stop "$app" 2>/dev/null || true
        pm2 delete "$app" 2>/dev/null || true
    fi
done

# Check if inotifywait is available for the watcher scripts
if ! command -v inotifywait &> /dev/null; then
    echo "⚠️  WARNING: inotifywait not found. File watchers will not work."
    echo "   Install with: apt-get install inotify-tools"
    echo ""
    echo "   Starting frontend only (watchers disabled)..."
    pm2 start "pnpm dev:frontend" --name "frontend"
else
    # Start all apps from ecosystem config
    pm2 start ecosystem.config.cjs
    echo "✅ Started: frontend, convex-env-sync, convex-code-sync"
fi

echo ""
echo "🎉 App is ready!"
echo "   Frontend:  $FRONTEND_URL"
echo "   Backend:   $BACKEND_URL"
echo "   Dashboard: $DASHBOARD_URL"
echo ""
echo "Commands:"
echo "  pnpm start       - Start both services"
echo "  pnpm stop        - Stop both services"
echo "  pm2 logs         - View frontend/logs"
echo "  pm2 logs convex-env-sync  - View env sync logs"
echo "  pm2 logs convex-code-sync - View code deploy logs"
echo "  pnpm convex:logs - View backend logs"

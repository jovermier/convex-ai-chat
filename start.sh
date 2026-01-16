#!/bin/bash
set -e

# Start script for AI Document Editor App
# Starts the Convex backend (Docker) and frontend (PM2)

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "🚀 Starting AI Document Editor App..."

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

# Start Convex backend with Docker Compose
# Docker Compose will automatically load .env.convex.local
echo "📦 Starting Convex backend..."
docker compose -f docker-compose.convex.yml up -d convex-backend convex-dashboard

# Wait for backend to be healthy
echo "⏳ Waiting for Convex backend to be healthy..."
timeout 60 bash -c 'until docker compose -f docker-compose.convex.yml ps 2>/dev/null | grep convex-backend | grep -q healthy; do sleep 2; done' || {
    echo "❌ Convex backend failed to become healthy"
    exit 1
}

echo "✅ Convex backend is healthy"

# Start frontend with PM2
echo "🎨 Starting frontend with PM2..."

# Stop existing process if running
if pm2 list | grep -q "frontend"; then
    echo "  Stopping existing PM2 process..."
    pm2 stop frontend 2>/dev/null || true
    pm2 delete frontend 2>/dev/null || true
fi

# Start frontend - PM2 will use the project's environment
pm2 start "pnpm dev:frontend" --name "frontend"

echo "✅ Frontend started"
echo ""
echo "🎉 App is ready!"
echo "   Frontend:  $FRONTEND_URL"
echo "   Backend:   $BACKEND_URL"
echo "   Dashboard: $DASHBOARD_URL"
echo ""
echo "Commands:"
echo "  pnpm start       - Start both services"
echo "  pnpm stop        - Stop both services"
echo "  pm2 logs         - View frontend logs"
echo "  pnpm convex:logs - View backend logs"

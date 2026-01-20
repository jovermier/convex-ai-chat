#!/bin/bash
set -e

# Stop script for AI Document Editor App
# Stops the frontend (PM2), watchers (PM2), and backend (Docker)

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "🛑 Stopping AI Document Editor App..."

# Stop PM2 processes (frontend + watchers)
echo "🎨 Stopping PM2 processes..."
for app in frontend convex-env-sync convex-code-sync; do
    if pm2 list | grep -q "$app"; then
        pm2 stop "$app" 2>/dev/null || true
        pm2 delete "$app" 2>/dev/null || true
        echo "  ✅ Stopped: $app"
    fi
done

# Stop Convex backend with Docker Compose
echo "📦 Stopping Convex backend..."
docker compose -f docker-compose.convex.yml down

echo "✅ Convex backend stopped"
echo ""
echo "✅ All services stopped"

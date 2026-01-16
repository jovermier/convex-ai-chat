#!/bin/bash
set -e

# Stop script for AI Document Editor App
# Stops the frontend (PM2) and backend (Docker)

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "🛑 Stopping AI Document Editor App..."

# Stop frontend with PM2
echo "🎨 Stopping frontend..."
if pm2 list | grep -q "frontend"; then
    pm2 stop frontend
    pm2 delete frontend
    echo "✅ Frontend stopped"
else
    echo "ℹ️  Frontend not running"
fi

# Stop Convex backend with Docker Compose
echo "📦 Stopping Convex backend..."
docker compose -f docker-compose.convex.yml down

echo "✅ Convex backend stopped"
echo ""
echo "✅ All services stopped"

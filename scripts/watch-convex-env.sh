#!/bin/bash
# Watch .env.convex.deployment and sync to Convex on changes

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

DEPLOYMENT_ENV_FILE=".env.convex.deployment"

echo "👀 Watching $DEPLOYMENT_ENV_FILE for changes..."
echo "   Press Ctrl+C to stop"

# Check if inotifywait is available
if ! command -v inotifywait &> /dev/null; then
    echo "❌ inotifywait not found. Install with: apt-get install inotify-tools"
    exit 1
fi

# Initial sync on start
echo "📝 Running initial sync..."
bash scripts/load-convex-env.sh

# Watch for file changes
# --monitor runs continuously, -e specifies events to watch
while inotifywait -q -e modify,close_write,moved_to "$DEPLOYMENT_ENV_FILE" 2>/dev/null; do
    echo "📝 $DEPLOYMENT_ENV_FILE changed, syncing to Convex..."
    sleep 0.5  # Small delay to ensure file write is complete
    bash scripts/load-convex-env.sh
    echo "✅ Synced at $(date '+%H:%M:%S')"
    echo ""
done

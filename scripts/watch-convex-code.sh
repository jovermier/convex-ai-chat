#!/bin/bash
# Watch ./convex directory (excluding _generated) and auto-deploy on changes

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

CONVEX_DIR="convex"

echo "👀 Watching $CONVEX_DIR/ for changes (excluding _generated/)..."
echo "   Press Ctrl+C to stop"

# Check if inotifywait is available
if ! command -v inotifywait &> /dev/null; then
    echo "❌ inotifywait not found. Install with: apt-get install inotify-tools"
    exit 1
fi

# Watch for file changes in convex directory, excluding _generated
# --recursive watches subdirectories
# --exclude filters out the _generated directory
# --monitor runs continuously
while inotifywait -q -r -e modify,close_write,moved_to --exclude '/_generated/' "$CONVEX_DIR" 2>/dev/null; do
    echo "📝 Convex code changed, deploying..."
    sleep 0.5  # Small delay to ensure file write is complete

    # Ensure CONVEX_SITE_ORIGIN is exported for deployment validation
    set -a
    source .env.local 2>/dev/null || true
    set +a

    if pnpm convex deploy --yes; then
        echo "✅ Deployed at $(date '+%H:%M:%S')"
    else
        echo "❌ Deployment failed at $(date '+%H:%M:%S')"
    fi
    echo ""
done

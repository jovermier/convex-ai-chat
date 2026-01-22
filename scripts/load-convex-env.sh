#!/bin/bash
# Load Convex environment variables from .env.convex.deployment to Convex
# Designed for self-hosted deployments (e.g., Coder workspaces) where you need to
# quickly configure a new Convex instance with all required environment variables
# Run this after generating env files with generate-convex-env.sh

set -e

DEPLOYMENT_ENV_FILE=".env.convex.deployment"

# Check if deployment env file exists
if [ ! -f "$DEPLOYMENT_ENV_FILE" ]; then
    echo "❌ Deployment env file not found: $DEPLOYMENT_ENV_FILE"
    echo "   Run 'bash scripts/generate-convex-env.sh' first to generate environment files"
    exit 1
fi

echo "📤 Loading environment variables to Convex deployment..."

# Read each non-empty, non-comment line and set via npx convex env set
while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    [[ "$line" == \#* ]] && continue
    [ -z "$line" ] && continue

    # Extract variable name and value
    VAR_NAME="${line%%=*}"
    VAR_VALUE="${line#*=}"

    # Skip empty values
    [ -z "$VAR_VALUE" ] && continue

    # Decode base64-encoded values (remove _BASE64 suffix from name)
    if [[ "$VAR_NAME" == *"_BASE64" ]]; then
        VAR_NAME="${VAR_NAME%_BASE64}"
        VAR_VALUE=$(echo "$VAR_VALUE" | base64 -d)
    fi

    echo "  Setting $VAR_NAME..."
    if ! npx convex env set "$VAR_NAME" "$VAR_VALUE"; then
        echo "❌ Failed to set $VAR_NAME"
        exit 1
    fi
done < "$DEPLOYMENT_ENV_FILE"

echo "✅ Environment variables loaded to Convex deployment"
echo "   Verify in dashboard: Environment Variables section"

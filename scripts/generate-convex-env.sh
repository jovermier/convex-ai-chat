#!/bin/bash
# Generate Convex environment files
# Creates .env.convex.deployment (JWT vars for cloud/self-hosted)
# and .env.convex.local (LLM vars for self-hosted Docker)
# Run this script before loading variables to Convex

set -e

DEPLOYMENT_ENV_FILE=".env.convex.deployment"
CONTAINER_ENV_FILE=".env.convex.local"

# Detect if running in self-hosted mode
SELF_HOSTED=false

# Check environment variable
if [ -n "$CONVEX_SELF_HOSTED_URL" ]; then
    SELF_HOSTED=true
fi

# Check if .env.local has self-hosted config
if [ -f .env.local ] && grep -q "CONVEX_SELF_HOSTED_URL" .env.local 2>/dev/null; then
    SELF_HOSTED=true
fi

# Check if .env.convex.local exists (indicates Docker/self-hosted setup)
if [ -f .env.convex.local ]; then
    SELF_HOSTED=true
fi

# Check if docker-compose.convex.yml exists (strong indicator of self-hosted)
if [ -f docker-compose.convex.yml ]; then
    SELF_HOSTED=true
fi

if [ "$SELF_HOSTED" = true ]; then
    echo "🏠 Self-hosted mode detected"
else
    echo "☁️  Cloud mode detected"
fi

echo "🔐 Generating Convex environment files..."

# Create deployment env file if it doesn't exist
if [ ! -f "$DEPLOYMENT_ENV_FILE" ]; then
    echo "📝 Creating $DEPLOYMENT_ENV_FILE..."
    cat > "$DEPLOYMENT_ENV_FILE" << 'EOF'
# Convex Deployment Environment Variables
# These variables are set via npx convex env set and appear in the dashboard
# This file should be gitignored (contains secrets)

# === AUTO-GENERATED VARIABLES (do not edit manually) ===
# These are managed by scripts/generate-convex-env.sh
# Multi-line values are stored as base64 for safe env file storage
JWT_PRIVATE_KEY_BASE64=""
JWT_ISSUER=""
JWKS=""

# === USER VARIABLES (add your own below) ===
# Add your environment variables here, one per line
# Example:
# OPENAI_API_KEY=sk-...
# STRIPE_SECRET_KEY=sk_live_...
# ANTHROPIC_API_KEY=sk-ant-...
EOF
fi

# Source container env file to get CONVEX_SITE_ORIGIN (if it exists)
set -a
[ -f "$CONTAINER_ENV_FILE" ] && source "$CONTAINER_ENV_FILE"
set +a

# Check if JWT key file exists and has content
JWT_KEY_FILE="jwt_private_key.pem"

if [ -f "$JWT_KEY_FILE" ] && [ -s "$JWT_KEY_FILE" ]; then
    # Read existing key from file
    JWT_PRIVATE_KEY=$(cat "$JWT_KEY_FILE")
    echo "📂 Using existing JWT key from $JWT_KEY_FILE"
else
    # Generate a new key
    echo "🔑 Generating new JWT private key..."
    JWT_PRIVATE_KEY=$(openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 2>/dev/null | openssl pkcs8 -topk8 -nocrypt -outform PEM 2>/dev/null)

    if [ -z "$JWT_PRIVATE_KEY" ]; then
        echo "❌ Failed to generate JWT private key"
        exit 1
    fi

    echo "✅ Generated new JWT private key"

    # Write the key to the host file for persistence
    echo "$JWT_PRIVATE_KEY" > "$JWT_KEY_FILE"
    echo "📝 Saved key to $JWT_KEY_FILE"
    echo ""
    echo "⚠️  Note: The convex-backend container will use this key on next restart."
    echo "   To restart: docker compose -f docker-compose.convex.yml restart convex-backend"
fi

# Generate JWKS from private key
echo "🔑 Generating JWKS from private key..."
JWKS=$(JWT_PRIVATE_KEY="$JWT_PRIVATE_KEY" node -e "
const crypto = require('crypto');
const privateKey = process.env.JWT_PRIVATE_KEY;
const publicKey = crypto.createPublicKey(privateKey);
const jwk = publicKey.export({ format: 'jwk' });
const jwks = { keys: [{ use: 'sig', ...jwk }] };
console.log(JSON.stringify(jwks));
")

# Update auto-generated variables in the deployment env file
echo "📝 Updating auto-generated variables in $DEPLOYMENT_ENV_FILE..."
TEMP_FILE=$(mktemp)

# Encode the multi-line JWT private key as base64 for safe env file storage
JWT_PRIVATE_KEY_BASE64=$(echo "$JWT_PRIVATE_KEY" | base64 -w 0)

# Process the file and update auto-generated variables
while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ ^JWT_PRIVATE_KEY_BASE64= ]]; then
        echo "JWT_PRIVATE_KEY_BASE64=\"$JWT_PRIVATE_KEY_BASE64\""
    elif [[ "$line" =~ ^JWT_ISSUER= ]]; then
        echo "JWT_ISSUER=\"$CONVEX_SITE_ORIGIN\""
    elif [[ "$line" =~ ^JWKS= ]]; then
        echo "JWKS=\"$JWKS\""
    else
        echo "$line"
    fi
done < "$DEPLOYMENT_ENV_FILE" > "$TEMP_FILE"

mv "$TEMP_FILE" "$DEPLOYMENT_ENV_FILE"

# Generate/update container env file for self-hosted mode
if [ "$SELF_HOSTED" = true ]; then
    echo "📝 Updating container env file $CONTAINER_ENV_FILE..."

    TEMP_FILE=$(mktemp)

    # Copy existing content from container env file, excluding LLM vars
    {
        # Add LLM/OpenAI configuration for agent.ts
        if [ -n "$OPENAI_BASE_URL" ]; then
            echo "OPENAI_BASE_URL=$OPENAI_BASE_URL"
        elif [ -n "$LITELLM_BASE_URL" ]; then
            echo "OPENAI_BASE_URL=${LITELLM_BASE_URL}/v1"
        else
            echo "OPENAI_BASE_URL=https://llm-gateway.hahomelabs.com/v1"
        fi
        if [ -n "$LITELLM_APP_API_KEY" ]; then
            echo "OPENAI_API_KEY=$LITELLM_APP_API_KEY"
        else
            echo "OPENAI_API_KEY=sk-placeholder-set-via-env-var"
        fi

        # Copy other variables that might already exist (excluding JWT vars which belong in deployment)
        if [ -f "$CONTAINER_ENV_FILE" ]; then
            grep -v "^JWT_PRIVATE_KEY_BASE64=" "$CONTAINER_ENV_FILE" 2>/dev/null | \
            grep -v "^JWT_ISSUER=" "$CONTAINER_ENV_FILE" 2>/dev/null | \
            grep -v "^JWKS=" "$CONTAINER_ENV_FILE" 2>/dev/null | \
            grep -v "^OPENAI_BASE_URL=" "$CONTAINER_ENV_FILE" 2>/dev/null | \
            grep -v "^OPENAI_API_KEY=" "$CONTAINER_ENV_FILE" 2>/dev/null || true
        fi
    } > "$TEMP_FILE"

    mv "$TEMP_FILE" "$CONTAINER_ENV_FILE"
    echo "  ✅ LLM variables in $CONTAINER_ENV_FILE"
fi

echo "✅ Environment files generated"
if [ "$SELF_HOSTED" = true ]; then
    echo "   JWT variables in $DEPLOYMENT_ENV_FILE"
    echo "   LLM variables in $CONTAINER_ENV_FILE"
    echo "   Restart convex-backend container to apply: docker compose -f docker-compose.convex.yml restart convex-backend"
else
    echo "   JWT variables in $DEPLOYMENT_ENV_FILE"
    echo "   Run 'bash scripts/load-convex-env.sh' to load variables to Convex Cloud"
fi

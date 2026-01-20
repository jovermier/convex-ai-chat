#!/bin/bash
# Initialize Convex deployment environment variables
# For self-hosted: writes directly to .env.convex.local
# For cloud: uses npx convex env set

set -e

DEPLOYMENT_ENV_FILE=".env.convex.deployment"
CONTAINER_ENV_FILE=".env.convex.local"

# Detect if running in self-hosted mode
# Check multiple indicators since .env.local might not exist yet when this script runs
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

echo "🔐 Initializing Convex deployment environment variables..."

# Create deployment env file if it doesn't exist
if [ ! -f "$DEPLOYMENT_ENV_FILE" ]; then
    echo "📝 Creating $DEPLOYMENT_ENV_FILE..."
    cat > "$DEPLOYMENT_ENV_FILE" << 'EOF'
# Convex Deployment Environment Variables
# These variables are set via npx convex env set and appear in the dashboard
# This file should be gitignored (contains secrets)

# === AUTO-GENERATED VARIABLES (do not edit manually) ===
# These are managed by scripts/init-convex-env.sh
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

# Source container env file to get CONVEX_SITE_ORIGIN
set -a
source "$CONTAINER_ENV_FILE"
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
// JWKS format requires {\"keys\": [...]} wrapper
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

# Now set all variables
if [ "$SELF_HOSTED" = true ]; then
    # Self-hosted mode: write directly to .env.convex.local
    echo "📤 Setting deployment environment variables in $CONTAINER_ENV_FILE..."

    # Create a temp file with the new variables
    TEMP_FILE=$(mktemp)

    # Copy existing content and add/update our variables
    # Variables are base64 encoded for multi-line values
    {
        # Add/update JWT_PRIVATE_KEY_BASE64
        echo "JWT_PRIVATE_KEY_BASE64=$(echo "$JWT_PRIVATE_KEY" | base64 -w 0)"
        echo "JWT_ISSUER=$CONVEX_SITE_ORIGIN"
        echo "JWKS=$JWKS"

        # Copy other variables that might already exist
        if [ -f "$CONTAINER_ENV_FILE" ]; then
            grep -v "^JWT_PRIVATE_KEY_BASE64=" "$CONTAINER_ENV_FILE" 2>/dev/null | \
            grep -v "^JWT_ISSUER=" "$CONTAINER_ENV_FILE" 2>/dev/null | \
            grep -v "^JWKS=" "$CONTAINER_ENV_FILE" 2>/dev/null || true
        fi
    } > "$TEMP_FILE"

    mv "$TEMP_FILE" "$CONTAINER_ENV_FILE"
    echo "  ✅ Variables written to $CONTAINER_ENV_FILE"

else
    # Cloud mode: use npx convex env set
    echo "📤 Setting deployment environment variables via npx convex env set..."

    # Set JWT_PRIVATE_KEY (multi-line value, use stdin)
    echo "  Setting JWT_PRIVATE_KEY..."
    if ! echo "$JWT_PRIVATE_KEY" | npx convex env set JWT_PRIVATE_KEY; then
        echo "❌ Failed to set JWT_PRIVATE_KEY"
        exit 1
    fi

    # Set CONVEX_SITE_ORIGIN (required by auth.config.ts)
    echo "  Setting CONVEX_SITE_ORIGIN..."
    if ! npx convex env set CONVEX_SITE_ORIGIN "$CONVEX_SITE_ORIGIN"; then
        echo "❌ Failed to set CONVEX_SITE_ORIGIN"
        exit 1
    fi

    # Set JWT_ISSUER
    echo "  Setting JWT_ISSUER..."
    if ! npx convex env set JWT_ISSUER "$CONVEX_SITE_ORIGIN"; then
        echo "❌ Failed to set JWT_ISSUER"
        exit 1
    fi

    # Set JWKS (multi-line value, use stdin)
    echo "  Setting JWKS..."
    if ! echo "$JWKS" | npx convex env set JWKS; then
        echo "❌ Failed to set JWKS"
        exit 1
    fi

    # Now set user variables from the deployment env file
    # Parse only the user section (after the USER VARIABLES comment)
    USER_SECTION=false
    while IFS= read -r line || [ -n "$line" ]; do
        # Start processing after USER VARIABLES comment
        if [[ "$line" == *"USER VARIABLES"* ]]; then
            USER_SECTION=true
            continue
        fi

        # Only process user variables
        [ "$USER_SECTION" = false ] && continue

        # Skip comments and empty lines
        [[ "$line" == \#* ]] && continue
        [ -z "$line" ] && continue

        # Extract variable name and value
        VAR_NAME="${line%%=*}"
        VAR_VALUE="${line#*=}"

        # Skip empty values
        [ -z "$VAR_VALUE" ] && continue

        echo "  Setting $VAR_NAME..."
        npx convex env set "$VAR_NAME" "$VAR_VALUE"
    done < "$DEPLOYMENT_ENV_FILE"

    # Set OpenAI configuration from environment if not already set in deployment file
    # These are required for the AI agent functionality
    # Read from LITELLM_APP_API_KEY and LITELLM_BASE_URL environment variables
    if ! grep -q "^OPENAI_API_KEY=" "$DEPLOYMENT_ENV_FILE" 2>/dev/null; then
        if [ -n "$LITELLM_APP_API_KEY" ]; then
            echo "  Setting OPENAI_API_KEY from LITELLM_APP_API_KEY..."
            npx convex env set OPENAI_API_KEY "$LITELLM_APP_API_KEY"
            # Update the deployment file for persistence
            echo "OPENAI_API_KEY=$LITELLM_APP_API_KEY" >> "$DEPLOYMENT_ENV_FILE"
        else
            echo "  ⚠️  LITELLM_APP_API_KEY not set in environment, skipping OPENAI_API_KEY"
        fi
    fi

    if ! grep -q "^OPENAI_BASE_URL=" "$DEPLOYMENT_ENV_FILE" 2>/dev/null; then
        if [ -n "$LITELLM_BASE_URL" ]; then
            echo "  Setting OPENAI_BASE_URL from LITELLM_BASE_URL..."
            npx convex env set OPENAI_BASE_URL "$LITELLM_BASE_URL"
            # Update the deployment file for persistence
            echo "OPENAI_BASE_URL=$LITELLM_BASE_URL" >> "$DEPLOYMENT_ENV_FILE"
        else
            echo "  ⚠️  LITELLM_BASE_URL not set in environment, skipping OPENAI_BASE_URL"
        fi
    fi
fi

echo "✅ Convex deployment environment variables initialized"
if [ "$SELF_HOSTED" = true ]; then
    echo "   Variables written to $CONTAINER_ENV_FILE"
    echo "   Restart convex-backend container to apply: docker compose -f docker-compose.convex.yml restart convex-backend"
else
    echo "   Verify in dashboard: Environment Variables section"
fi

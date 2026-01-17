#!/bin/bash
# Initialize Convex deployment environment variables
# Reads from .env.convex.deployment and sets variables via npx convex env set

set -e

DEPLOYMENT_ENV_FILE=".env.convex.deployment"
CONTAINER_ENV_FILE=".env.convex.local"

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
JWT_PRIVATE_KEY=
JWT_ISSUER=
JWKS=

# === USER VARIABLES (add your own below) ===
# Add your environment variables here, one per line
# Example:
# OPENAI_API_KEY=sk-...
# STRIPE_SECRET_KEY=sk_live_...
# ANTHROPIC_API_KEY=sk-ant-...
EOF
fi

# Source container env file to get CONVEX_SITE_ORIGIN and CONVEX_SITE_URL
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
JWKS=$(node -e "
const crypto = require('crypto');
const privateKey = \`$JWT_PRIVATE_KEY\`;
const publicKey = crypto.createPublicKey(privateKey);
const jwk = publicKey.export({ format: 'jwk' });
console.log(JSON.stringify(jwk));
")

# Update auto-generated variables in the deployment env file
echo "📝 Updating auto-generated variables in $DEPLOYMENT_ENV_FILE..."
TEMP_FILE=$(mktemp)

# Process the file and update auto-generated variables
while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ ^JWT_PRIVATE_KEY= ]]; then
        echo "JWT_PRIVATE_KEY=$JWT_PRIVATE_KEY"
    elif [[ "$line" =~ ^JWT_ISSUER= ]]; then
        echo "JWT_ISSUER=$CONVEX_SITE_ORIGIN"
    elif [[ "$line" =~ ^JWKS= ]]; then
        echo "JWKS=$JWKS"
    else
        echo "$line"
    fi
done < "$DEPLOYMENT_ENV_FILE" > "$TEMP_FILE"

mv "$TEMP_FILE" "$DEPLOYMENT_ENV_FILE"

# Now set all variables via npx convex env set
echo "📤 Setting deployment environment variables..."

# Set JWT_PRIVATE_KEY (multi-line value, use stdin)
echo "  Setting JWT_PRIVATE_KEY..."
echo "$JWT_PRIVATE_KEY" | npx convex env set JWT_PRIVATE_KEY

# Set JWT_ISSUER
echo "  Setting JWT_ISSUER..."
npx convex env set JWT_ISSUER "$CONVEX_SITE_ORIGIN"

# Set JWKS (multi-line value, use stdin)
echo "  Setting JWKS..."
echo "$JWKS" | npx convex env set JWKS

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

echo "✅ Convex deployment environment variables initialized"
echo "   Verify in dashboard: Environment Variables section"

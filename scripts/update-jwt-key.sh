#!/bin/bash
# Script to set JWT_PRIVATE_KEY in Convex deployment

# Read the PEM file from path specified as first argument, or use default
JWT_KEY_PATH="${1:-/tmp/jwt_pkcs8.pem}"

if [ ! -f "$JWT_KEY_PATH" ]; then
    echo "❌ JWT key file not found: $JWT_KEY_PATH"
    echo "   Usage: $0 [path-to-jwt-key.pem]"
    exit 1
fi

# Read the PEM file
JWT_KEY=$(cat "$JWT_KEY_PATH")

# Use npx with the key as a file to avoid shell parsing issues
npx convex env set JWT_PRIVATE_KEY "$JWT_KEY" --env-file .env.convex.local

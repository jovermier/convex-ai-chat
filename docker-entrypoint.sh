#!/bin/bash
set -e

# This entrypoint wrapper loads JWT_PRIVATE_KEY from a mounted file
# The file is mounted at /jwt_private_key.pem and contains the PEM-formatted key

if [ -f /jwt_private_key.pem ]; then
  echo "Loading JWT_PRIVATE_KEY from /jwt_private_key.pem..."
  # Read the key from the file
  DECODED_KEY=$(cat /jwt_private_key.pem)
  echo "JWT_PRIVATE_KEY loaded (length: ${#DECODED_KEY})"
  echo "First 50 chars: $(echo "$DECODED_KEY" | head -c 50)"
  # Export the variable
  export JWT_PRIVATE_KEY="$DECODED_KEY"
  echo "JWT_PRIVATE_KEY exported successfully"
  echo "Verifying export: length is ${#JWT_PRIVATE_KEY}"
fi

# Run the Convex backend - exported variables should be available
cd /convex
exec ./run_backend.sh "$@"

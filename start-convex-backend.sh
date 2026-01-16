#!/bin/bash
# Wrapper script to start Convex backend with JWT_PRIVATE_KEY from file
# Based on the original run_backend.sh but with JWT_PRIVATE_KEY loading

set -e

export DATA_DIR=${DATA_DIR:-/convex/data}
export TMPDIR=${TMPDIR:-"$DATA_DIR/tmp"}
export STORAGE_DIR=${STORAGE_DIR:-"$DATA_DIR/storage"}
export SQLITE_DB=${SQLITE_DB:-"$DATA_DIR/db.sqlite3"}

# Database driver flags
POSTGRES_DB_FLAGS=(--db postgres-v5)
MYSQL_DB_FLAGS=(--db mysql-v5)

mkdir -p "$TMPDIR" "$STORAGE_DIR"

# Source credentials script (sets INSTANCE_NAME and INSTANCE_SECRET)
source ./read_credentials.sh

# IMPORTANT: Set JWT_PRIVATE_KEY BEFORE sourcing anything else
# This environment variable MUST be set before the Convex backend starts
# for it to be available in the isolate workers
if [ -f /jwt_private_key.pem ]; then
  echo "Loading JWT_PRIVATE_KEY from /jwt_private_key.pem..."
  DECODED_KEY=$(cat /jwt_private_key.pem)
  echo "JWT_PRIVATE_KEY loaded (length: ${#DECODED_KEY})"
  export JWT_PRIVATE_KEY="$DECODED_KEY"
  echo "JWT_PRIVATE_KEY exported successfully"
  echo "Verifying: ${#JWT_PRIVATE_KEY} characters"
elif [ -n "$JWT_PRIVATE_KEY_BASE64" ]; then
  echo "Loading JWT_PRIVATE_KEY from JWT_PRIVATE_KEY_BASE64..."
  DECODED_KEY=$(echo "$JWT_PRIVATE_KEY_BASE64" | base64 -d)
  echo "JWT_PRIVATE_KEY loaded (length: ${#DECODED_KEY})"
  export JWT_PRIVATE_KEY="$DECODED_KEY"
  echo "JWT_PRIVATE_KEY exported successfully"
  echo "Verifying: ${#JWT_PRIVATE_KEY} characters"
fi

# Make JWT_PRIVATE_KEY available to child processes via env file
if [ -n "$JWT_PRIVATE_KEY" ]; then
  # Export to a file that will be sourced by child processes
  # This is necessary because Convex isolate workers don't inherit all environment variables
  echo "export JWT_PRIVATE_KEY=\"$JWT_PRIVATE_KEY\"" > /convex/jwt_env.sh
  echo "JWT environment written to /convex/jwt_env.sh"
  # Source it ourselves for good measure
  . /convex/jwt_env.sh
fi

# Determine database configuration
if [ -n "$POSTGRES_URL" ]; then
  DB_SPEC="$POSTGRES_URL"
  DB_FLAGS=("${POSTGRES_DB_FLAGS[@]}")
elif [ -n "$MYSQL_URL" ]; then
  DB_SPEC="$MYSQL_URL"
  DB_FLAGS=("${MYSQL_DB_FLAGS[@]}")
elif [ -n "$DATABASE_URL" ]; then
  echo "Warning: DATABASE_URL is deprecated."
  DB_SPEC="$DATABASE_URL"
  DB_FLAGS=("${POSTGRES_DB_FLAGS[@]}")
else
  DB_SPEC="$SQLITE_DB"
  DB_FLAGS=()
fi

# Use local storage (S3 not configured)
STORAGE_FLAGS=(--local-storage "$STORAGE_DIR")

# Run the Convex backend with JWT_PRIVATE_KEY explicitly set in the environment
# Using env to ensure the variable is passed to the child process
exec env JWT_PRIVATE_KEY="$JWT_PRIVATE_KEY" "$@" ./convex-local-backend \
  --instance-name "$INSTANCE_NAME" \
  --instance-secret "$INSTANCE_SECRET" \
  --port 3210 \
  --site-proxy-port 3211 \
  --convex-origin "$CONVEX_CLOUD_ORIGIN" \
  --convex-site "$CONVEX_SITE_ORIGIN" \
  --beacon-tag "self-hosted-docker" \
  ${DISABLE_BEACON:+--disable-beacon} \
  ${REDACT_LOGS_TO_CLIENT:+--redact-logs-to-client} \
  ${DO_NOT_REQUIRE_SSL:+--do-not-require-ssl} \
  "${DB_FLAGS[@]}" \
  "${STORAGE_FLAGS[@]}" \
  "$DB_SPEC"



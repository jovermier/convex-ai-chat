# JWT_PRIVATE_KEY Investigation

## Issue Description
When clicking "Sign in anonymously" in the browser, the following error occurs:
```
Missing environment variable `JWT_PRIVATE_KEY`
```

This error originates from `@convex-dev/auth` library trying to access `process.env.JWT_PRIVATE_KEY` during sign-in.

## Investigation Findings

### 1. Environment Variable Propagation Issue

**Problem**: Environment variables set in Docker Compose `env_file` or entrypoint scripts do NOT automatically propagate to Convex isolate workers where user code runs.

**Evidence**:
- Container environment shows `JWT_PRIVATE_KEY_BASE64` is set
- Container environment does NOT show `JWT_PRIVATE_KEY` (should be decoded from base64)
- Entry point script `start-convex-backend.sh` should decode and set `JWT_PRIVATE_KEY`
- No "Loading JWT_PRIVATE_KEY" messages appear in container logs
- This indicates the entrypoint script may not be executing properly

### 2. Current Setup

**Files Involved**:
- `.env.convex.local` - Contains `JWT_PRIVATE_KEY_BASE64` (base64-encoded PEM key)
- `start-convex-backend.sh` - Entry point script that should decode JWT_PRIVATE_KEY_BASE64
- `docker-compose.convex.yml` - Mounts entrypoint script and JWT key file
- `jwt_private_key.pem` - PEM-formatted RSA private key (1703 characters)

**Expected Flow**:
1. Container starts with `JWT_PRIVATE_KEY_BASE64` in environment
2. `start-convex-backend.sh` runs as entrypoint
3. Script decodes `JWT_PRIVATE_KEY_BASE64` and exports `JWT_PRIVATE_KEY`
4. Script uses `exec env JWT_PRIVATE_KEY="$JWT_PRIVATE_KEY"` to pass to backend
5. Convex backend receives `JWT_PRIVATE_KEY` in its environment
6. Isolate workers inherit `JWT_PRIVATE_KEY` from backend process

**Actual Flow**:
1. Container starts with `JWT_PRIVATE_KEY_BASE64` in environment ✓
2. `start-convex-backend.sh` runs as entrypoint ✓
3. Script should decode but no log messages appear ❌
4. `JWT_PRIVATE_KEY` is NOT set in container environment ❌
5. Auth functions fail with "Missing environment variable `JWT_PRIVATE_KEY`" ❌

### 3. Research Sources

**Key Documentation**:
- [Convex Auth Manual Setup](https://labs.convex.dev/auth/setup/manual) - Requires JWT_PRIVATE_KEY, JWKS, and SITE_URL
- [Convex Environment Variables](https://docs.convex.dev/production/environment-variables) - Set via dashboard, accessed via process.env
- [Self-Hosted Convex README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md) - Official self-hosting guide

**Related GitHub Issues**:
- [Issue #98: jwt_private_key not in environment variables](https://github.com/get-convex/convex-backend/issues/98) - JWT_PRIVATE_KEY must be set in deployment's environment variables page
- [Issue #128: convex env set fails to handle multi-line environment variables](https://github.com/get-convex/convex-backend/issues/128) - Multi-line PEM keys cause issues
- [Issue #123: Dynamically set environment variables at deploy-time](https://github.com/get-convex/convex-backend/issues/123) - CONVEX_DEPLOY_KEY doesn't authorize convex env set

**Community Guides**:
- [How to Self-Host Convex with Dokploy or Docker Compose](https://www.bitdoze.com/convex-self-host/) - Complete Docker Compose setup guide

### 4. Root Cause Analysis

**Primary Issue**: For **cloud-hosted Convex**, environment variables are set through the dashboard and Convex's infrastructure passes them to isolate workers. For **self-hosted Convex**, there's NO dashboard interface to set deployment-level environment variables.

**Critical Finding**: The entrypoint script `start-convex-backend.sh` is not producing any log output, which suggests either:
1. The script is not being executed (unlikely, as container is running)
2. The script's echo statements are being suppressed
3. The script is failing silently before reaching the JWT loading section

**Isolate Worker Environment**: Convex isolate workers run in separate process contexts. Even if `JWT_PRIVATE_KEY` is set in the main backend process environment, it may not automatically propagate to isolate workers unless explicitly passed through.

### 5. Log Evidence

**Backend logs show auth errors**:
```
ERROR isolate::client: Restarting Isolate unhandled_promise_rejection: UnhandledPromiseRejection, last request: "Action: auth.js:signIn"
```

**Container environment check**:
```bash
docker compose exec convex-backend printenv | grep -i jwt
# Shows: JWT_ISSUER=...
# Shows: JWT_PRIVATE_KEY_BASE64=...
# Missing: JWT_PRIVATE_KEY (should be decoded)
```

**No JWT loading messages**:
```bash
docker compose logs convex-backend | grep -i "loading.*jwt"
# No output - script's echo statements not appearing
```

## Potential Solutions

### Solution 1: Fix Entrypoint Script Execution
The entrypoint script should be producing log output. Need to verify:
1. Script has proper execute permissions
2. Script is actually being invoked as entrypoint
3. Script's stderr/stdout is not being redirected

### Solution 2: Direct Environment Variable in Docker Compose
Instead of decoding in entrypoint, set JWT_PRIVATE_KEY directly in Docker Compose:
```yaml
environment:
  - JWT_PRIVATE_KEY_FILE=/jwt_private_key.pem
```
Then modify the entrypoint to read from file and export.

### Solution 3: Use Convex's Internal Environment Variable System
For self-hosted Convex, environment variables must be set such that Convex's internal system recognizes them. This may require:
1. Setting variables before the Convex backend process starts
2. Using a specific format or location for environment configuration
3. Ensuring variables are passed through to isolate workers via Convex's configuration

## Next Steps

1. **Verify entrypoint script execution** - Add debug output to confirm script runs
2. **Check script permissions** - Ensure execute bit is set
3. **Test manual JWT setting** - Manually set JWT_PRIVATE_KEY in container and test
4. **Research Convex isolate worker environment inheritance** - Understand how Convex passes env vars to workers

## Solution Implemented

### Root Cause
The entrypoint script `start-convex-backend.sh` has `#!/bin/bash` shebang, but Docker Compose was executing it with `/bin/sh` (which is linked to `dash` on this system). The `source` command is not available in `dash`, causing the script to fail silently when it reached `source ./read_credentials.sh`.

### Fix Applied
Changed the entrypoint in `docker-compose.convex.yml` from:
```yaml
entrypoint: ["/start-convex-backend.sh"]
```

To:
```yaml
entrypoint: ["/bin/bash", "/start-convex-backend.sh"]
```

This ensures the script is explicitly executed with bash, regardless of the system's `/bin/sh` implementation.

### Verification
After the fix:
1. ✅ JWT_PRIVATE_KEY is loaded from `/jwt_private_key.pem` (1703 characters)
2. ✅ Variable is exported and present in `convex-local-backend` process environment
3. ✅ Confirmed via `/proc/1/environ` that JWT_PRIVATE_KEY contains the PEM key
4. ✅ No "Missing environment variable JWT_PRIVATE_KEY" errors in logs
5. ✅ All `/api/shapes2` requests returning 200 (success)

### Why Entrypoint Script Approach Works

The entrypoint script approach is superior to API-based solutions because:

1. **Simplicity** - No need to authenticate with Convex admin API
2. **Reliability** - Environment is set before process starts
3. **Standard Pattern** - This is how environment variables are typically set in Docker containers
4. **No Timing Issues** - Variable available from the first moment the process starts
5. **Works Offline** - Doesn't depend on Convex API being accessible
6. **Process Inheritance** - Child processes (including isolate workers) inherit the environment

## Status

**Current Status**: ✅ RESOLVED - JWT_PRIVATE_KEY properly loaded and accessible

**Last Updated**: 2026-01-16

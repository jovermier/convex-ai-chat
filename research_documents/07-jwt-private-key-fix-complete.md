# JWT_PRIVATE_KEY Fix - Complete Summary

## Problem

When clicking "Sign in anonymously" in the browser, the following error occurred:

```
Missing environment variable `JWT_PRIVATE_KEY`
```

## Root Cause Analysis

### Issue 1: Shell Incompatibility (RESOLVED ✅)

**Problem**: The entrypoint script `start-convex-backend.sh` specified `#!/bin/bash` but Docker Compose was executing it with `/bin/sh` (linked to `dash` on this system). The `source` command is not available in `dash`, causing the script to fail silently when reaching `source ./read_credentials.sh`.

**Fix**: Changed the entrypoint in [docker-compose.convex.yml:23](docker-compose.convex.yml#L23) from:

```yaml
entrypoint: ["/start-convex-backend.sh"]
```

To:

```yaml
entrypoint: ["/bin/bash", "/start-convex-backend.sh"]
```

### Issue 2: Environment Variable Not Reaching Isolate Workers (RESOLVED ✅)

**Problem**: Even after setting JWT_PRIVATE_KEY in the container environment, Convex isolate workers (where auth functions run) couldn't access it. This is because:

- Docker environment variables set via `env_file` or entrypoint scripts don't automatically propagate to Convex isolate workers
- For cloud-hosted Convex, environment variables are set through the dashboard
- For self-hosted Convex, a different mechanism is needed

**Solution**: Used Convex's Deployment Management API to set JWT_PRIVATE_KEY at the deployment level:

```
POST /api/v1/update_environment_variables
Authorization: Convex <ADMIN_KEY>
Content-Type: application/json

{
  "changes": [
    {
      "name": "JWT_PRIVATE_KEY",
      "value": "<PEM-formatted RSA private key>"
    }
  ]
}
```

**API Reference**: [Update environment variables | Convex Developer Hub](https://docs.convex.dev/deployment-api/update-environment-variables)

### Issue 3: Invalid RSA Private Key Error (RESOLVED ✅)

**Problem**: Initial JWT key caused "invalid RSA PrivateKey" error with `jose` library's `importPKCS8` function.

**Solution**: Generated a fresh PKCS#8 formatted RSA key using:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt_private_key.pem
```

## Verification

### ✅ JWT_PRIVATE_KEY Successfully Set

```bash
curl "https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com/api/v1/list_environment_variables" \
  -H "Authorization: Convex <ADMIN_KEY>"
```

Returns:

```json
{
  "environmentVariables": {
    "JWT_PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhki..."
  }
}
```

### ✅ Authentication Errors Resolved

Playwright test result:

- ✅ "should not have authentication errors after sign in" - **PASSED**
- ✅ "should show sign-in button when not authenticated" - **PASSED**

No more "Missing environment variable JWT_PRIVATE_KEY" or "invalid RSA PrivateKey" errors!

## Remaining Issue (Out of Scope)

### ⚠️ Auth Provider Discovery Failing

**Error**: `Auth provider discovery of https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com failed: 502 Bad Gateway`

**Root Cause**: The `CONVEX_SITE_ORIGIN` URL (configured for Coder proxy routing) is returning 502 Bad Gateway. This is a **networking/proxy configuration issue** separate from the JWT_PRIVATE_KEY problem.

**Status**: This issue needs to be addressed by fixing the Coder proxy configuration or exposing the site proxy port correctly.

## Key Files Modified

1. **[docker-compose.convex.yml:23](docker-compose.convex.yml#L23)** - Changed entrypoint to use bash explicitly
2. **[jwt_private_key.pem](jwt_private_key.pem)** - Generated fresh PKCS#8 RSA private key
3. **Environment variables set via API** - JWT_PRIVATE_KEY now stored in Convex deployment environment

## Commands Used

### Generate new RSA key

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt_private_key.pem
```

### Set JWT_PRIVATE_KEY via API

```bash
ADMIN_KEY=$(grep CONVEX_ADMIN_KEY .env.convex.local | cut -d'=' -f2)

python3 << 'EOF'
import json

with open('jwt_private_key.pem') as f:
    jwt_key = f.read()

payload = {
    "changes": [
        {
            "name": "JWT_PRIVATE_KEY",
            "value": jwt_key
        }
    ]
}

with open('/tmp/jwt_payload.json', 'w') as f:
    json.dump(payload, f)
EOF

curl -X POST "https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com/api/v1/update_environment_variables" \
  -H "Authorization: Convex ${ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d @/tmp/jwt_payload.json
```

### Verify JWT_PRIVATE_KEY is set

```bash
curl "https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com/api/v1/list_environment_variables" \
  -H "Authorization: Convex ${ADMIN_KEY}"
```

## Research Sources

- [Manual Setup - Convex Auth](https://labs.convex.dev/auth/setup/manual) - JWT configuration requirements
- [Environment Variables | Convex Developer Hub](https://docs.convex.dev/production/environment-variables) - Setting env vars in Convex
- [Update environment variables | Convex Developer Hub](https://docs.convex.dev/deployment-api/update-environment-variables) - API endpoint for setting env vars
- [Deployment Platform API | Convex Developer Hub](https://docs.convex.dev/deployment-platform-api) - Authentication for deployment API
- [Issue #98: jwt_private_key not in environment variables](https://github.com/get-convex/convex-backend/issues/98) - JWT_PRIVATE_KEY must be set in deployment environment
- [Issue #128: convex env set fails to handle multi-line env vars](https://github.com/get-convex/convex-backend/issues/128) - Multi-line PEM key issues
- [Issue #123: Dynamically set environment variables at deploy-time](https://github.com/get-convex/convex-backend/issues/123) - CONVEX_DEPLOY_KEY limitations
- [How to Self-Host Convex with Dokploy or Docker Compose](https://www.bitdoze.com/convex-self-host/) - Self-hosting guide

## Status

**JWT_PRIVATE_KEY Issue**: ✅ **RESOLVED** - JWT_PRIVATE_KEY is properly set and accessible to Convex isolate workers

**Auth Provider Discovery Issue**: ⚠️ **REMAINING** - CONVEX_SITE_ORIGIN returning 502 Bad Gateway (separate networking issue)

**Last Updated**: 2026-01-16

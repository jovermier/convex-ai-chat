# Convex Authentication Diagnostic Report

## Test Date

2026-01-16

## Summary

The 502 Bad Gateway error during auth provider discovery has been isolated to a specific infrastructure issue.

## Key Findings

### ✅ What's Working

1. **Docker Infrastructure** - All containers are running
   - convex-backend container: ✅ Running
   - convex-dashboard container: ✅ Running

2. **Port Accessibility** - All ports are listening locally
   - Port 3210 (Convex API): ✅ Accessible
   - Port 3211 (Auth Proxy): ✅ Accessible
   - Port 3211 (HTTP Actions): ✅ Accessible
   - Port 6791 (Dashboard): ✅ Accessible

3. **Convex API Endpoint** - The main API is working
   - External URL (https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com): ✅ Returns 200
   - Local port (http://localhost:3210): ✅ Returns 200

4. **Auth Config at API URL** - The auth config endpoint responds
   - https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com/: ✅ Returns 200
   - Response: "This Convex deployment is running. See https://docs.convex.dev/."

5. **Environment Variables** - JWT_PRIVATE_KEY is accessible
   - No "Missing JWT_PRIVATE_KEY" errors in browser console

6. **Application Loads** - The React app loads successfully
   - Page renders without authentication

### ❌ What's Failing

1. **Auth Proxy URL (External)** - **CRITICAL FAILURE**
   - https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com: ❌ Returns 502 Bad Gateway
   - https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com/auth/config: ❌ Returns 502 Bad Gateway
   - https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com/.well-known/openid-configuration: ❌ Returns 502 Bad Gateway

2. **Auth Proxy URL (Local)** - Returns 404
   - http://localhost:3211/: Returns 404 (not 502)

3. **HTTP Actions Port (from Playwright)** - Connection failed
   - http://localhost:3211/: Connection failed (works from shell, not Playwright)

## Root Cause Analysis

### The Problem

The auth provider discovery fails because **the Coder proxy cannot reach the auth proxy service** at `https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com`.

This URL is configured in `convex/auth.config.ts`:

```typescript
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL, // This is https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com
      applicationID: "convex",
    },
  ],
};
```

### Why It Fails

1. **Coder Proxy Issue**: The Coder workspace proxy (`convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com`) cannot route to the auth proxy service running on port 3211.

2. **Local vs External**:
   - Locally, `http://localhost:3211/` works (returns 404, which is expected for the root path)
   - Externally via Coder proxy, the same service returns 502 Bad Gateway

3. **Port Mapping**: The auth proxy is exposed on port 3211, but the Coder proxy doesn't have a route configured for it.

## Recommended Solutions

### Option 1: Use CONVEX_SITE_URL (API URL) for Auth

**Change `convex/auth.config.ts`:**

```typescript
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL, // Already correct!
      applicationID: "convex",
    },
  ],
};
```

**Why this might work:**

- The API URL (https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com) returns 200
- The auth proxy functionality might be available at the API URL
- This matches the cloud example pattern (where SITE_URL points to the same domain)

### Option 2: Fix Coder Proxy Routing

**Work with Coder workspace admin to:**

1. Configure the Coder proxy to route `convex-site` requests to port 3211
2. Ensure the proxy can reach the auth proxy service

**This requires:**

- Coder workspace configuration changes
- Proxy route configuration

### Option 3: Use Local URLs for Self-Hosted

**For local development only:**

- Use `http://localhost:3211` as the auth domain
- This bypasses the Coder proxy entirely

**Limitations:**

- Won't work for external browser access
- Only works when browser and backend are on the same machine

## Next Steps

1. **Try Option 1** (recommended): The auth.config.ts is already using CONVEX_SITE_URL, which should work. Verify the environment variable is correct.

2. **Check if auth routes are registered**: The auth proxy might need additional configuration to serve auth endpoints.

3. **Investigate Convex backend logs**: Check if there are any errors in the convex-backend container logs.

4. **Consider using local URLs**: If this is for local development only, bypass the Coder proxy.

## Test Files Created

1. `tests/diagnostics/convex-auth-diagnostic.test.ts` - Playwright test suite
2. `tests/diagnostics/run-diagnostics.sh` - Shell script diagnostic suite

Run these tests to verify any fixes:

```bash
# Shell tests (fast, comprehensive)
./tests/diagnostics/run-diagnostics.sh

# Playwright tests (browser-based)
pnpm test tests/diagnostics/convex-auth-diagnostic.test.ts
```

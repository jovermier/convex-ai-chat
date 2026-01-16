# Convex Auth Testing Results - Port 3212 Configuration

**Date:** 2026-01-16
**Configuration:** Port 3212 as site-proxy-port

## Changes Made

### 1. Updated start-convex-backend.sh

Changed the site proxy port from 3211 to 3212:

```bash
--site-proxy-port 3212 \  # Was 3211
```

### 2. Updated Environment Variables

Both `.env` and `.env.convex.local` now have:

```bash
CONVEX_SITE_ORIGIN=https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com
CONVEX_SITE_URL=https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com
```

This aligns with:

- Coder proxy routing (port 3212)
- Setup script defaults (port 3212)
- Docker Compose port mapping (3212:3212)

## Test Results

### Network Connectivity ✅

| Endpoint                   | Status | Notes                                       |
| -------------------------- | ------ | ------------------------------------------- |
| Port 3212 (local)          | 404    | Accessible, returns "Application Not Found" |
| External URL (convex-site) | 404    | **Previously was 502, now reachable!**      |
| Port 3210 (API)            | 200    | Working correctly                           |

### Auth Endpoints

| Endpoint                                 | Status | Response                |
| ---------------------------------------- | ------ | ----------------------- |
| `http://127.0.0.1:3212/`                 | 404    | "Application Not Found" |
| `http://127.0.0.1:3212/auth/config`      | 404    | "Application Not Found" |
| `http://127.0.0.1:3212/http/auth/config` | 404    | "Application Not Found" |

### Playwright Auth Tests

```
✅ Test 1: should show sign-in button when not authenticated - PASSED
❌ Test 2: should successfully sign in with anonymous provider - FAILED
✅ Test 3: should not have authentication errors after sign in - PASSED
```

**Key Finding:** No authentication errors in browser console! This is significant progress.

## Analysis

### What's Working ✅

1. **Coder Proxy Routing**: The `convex-site` URL now successfully routes to port 3212 (404 instead of 502)
2. **No Auth Errors**: The browser console shows no JWT_PRIVATE_KEY or authentication errors
3. **Sign-in Button**: Appears and is clickable
4. **Auth Flow Starts**: Clicking sign-in doesn't throw errors

### What's Not Working ❌

1. **Auth Endpoints Return 404**: All `/auth/config` and `/http/auth/config` endpoints return "Application Not Found"
2. **Sign-out Button Doesn't Appear**: After clicking sign-in, the UI doesn't update to show authenticated state
3. **User Session Not Established**: `getAuthUserId()` likely returns null

## Root Cause

**The HTTP routes are not being registered by the Convex backend.**

Despite:

- ✅ `auth.addHttpRoutes(http)` in `convex/http.ts`
- ✅ `auth.config.ts` configured with correct domain
- ✅ Environment variables set (`JWT_PRIVATE_KEY`, `JWKS`, `CONVEX_SITE_URL`)
- ✅ Port 3212 accessible and routed correctly

The auth endpoints still return 404, which means the routes are not being loaded by Convex.

## Possible Causes

### 1. HTTP Routes Not Deployed/Synced

For self-hosted Convex, HTTP routes may need to be explicitly deployed. The CLI doesn't support self-hosted deployments yet.

### 2. Environment Variables Not Reachable to Isolate Workers

`JWT_PRIVATE_KEY` and `JWKS` are set in the container but may not be propagating to the Convex isolate workers where auth code runs.

### 3. Missing Route Registration

The `http.ts` file may need to be explicitly loaded or registered with Convex.

### 4. Convex Version Incompatibility

The version of `@convex-dev/auth` or `convex` package may not be compatible with self-hosted mode.

## Next Steps to Investigate

1. **Check Convex Logs** for HTTP route initialization
2. **Verify HTTP Routes** are being loaded by Convex
3. **Test Simple HTTP Route** to see if any HTTP routes work in self-hosted mode
4. **Check Package Versions** of `@convex-dev/auth` and `convex`
5. **Consider Using Convex Cloud** for auth while self-hosting the rest

## Configuration Summary

### Files Modified

1. [`start-convex-backend.sh`](start-convex-backend.sh:75) - Changed `--site-proxy-port` from 3211 to 3212
2. [`.env`](.env:3) - Set `CONVEX_SITE_URL` to auth proxy URL
3. [`.env.convex.local`](.env.convex.local:7) - Set `CONVEX_SITE_URL` to auth proxy URL

### Current Environment Variables

```bash
CONVEX_CLOUD_ORIGIN=https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com  # Port 3210
CONVEX_SITE_ORIGIN=https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com  # Port 3212
CONVEX_SITE_URL=https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com  # Port 3212
VITE_CONVEX_URL=https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com  # Port 3210
```

### Port Mapping (docker-compose.convex.yml)

```yaml
ports:
  - "3210:3210" # Convex API port
  - "3211:3211" # Convex site proxy port (unused, legacy)
  - "3212:3212" # Convex site proxy port (for HTTP actions/auth) ✅ NOW IN USE
```

### Coder Proxy Configuration

```terraform
resource "coder_app" "convex-site" {
  slug         = "convex-site"
  url          = "http://localhost:3212"  # ✅ Correct
  subdomain    = true
  share        = "public"
}
```

## Progress Summary

| Issue                    | Before          | After                         |
| ------------------------ | --------------- | ----------------------------- |
| Coder proxy to port 3212 | 502 Bad Gateway | ✅ 404 (reachable!)           |
| Auth endpoints           | 502 / 404       | ⚠️ 404 (still not registered) |
| Console auth errors      | None            | ✅ Still none                 |
| Sign-in button           | Visible         | ✅ Still visible              |
| Sign-out button          | Not appearing   | ⚠️ Still not appearing        |
| JWT_PRIVATE_KEY errors   | None            | ✅ Still none                 |

## Conclusion

**Significant Progress:** The Coder proxy now successfully routes to port 3212 (404 instead of 502), and there are no authentication errors in the console.

**Remaining Issue:** The auth HTTP routes are still not being registered/served by the Convex backend, despite correct configuration. This confirms the research findings that `@convex-dev/auth` has limited support for self-hosted Convex deployments.

**Recommendation:** The core issue is that HTTP routes return 404 in self-hosted Convex. This may require:

1. Explicit deployment/syncing of HTTP routes (not currently supported for self-hosted)
2. Alternative authentication solution (Better Auth, Clerk, etc.)
3. Using Convex Cloud for authentication while self-hosting the rest

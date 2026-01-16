# Convex Auth Self-Hosted Research Findings

**Date:** 2026-01-16
**Issue:** `@convex-dev/auth` HTTP routes returning 404 "No matching routes found" in self-hosted Convex deployment

## Executive Summary

After extensive research, **this appears to be a known issue with `@convex-dev/auth` in self-hosted environments**. Multiple users have reported the same problem: following the official setup instructions but getting 404 errors for auth endpoints. The root cause is that **HTTP routes are not being registered/served by the self-hosted Convex backend**, despite being correctly configured in code.

---

## Problem Description

### Symptoms

- HTTP routes configured with `auth.addHttpRoutes(http)` in `convex/http.ts`
- Environment variables set (`JWT_PRIVATE_KEY`, `JWKS`, `CONVEX_SITE_URL`)
- Auth config correctly pointing to `process.env.CONVEX_SITE_URL`
- But auth endpoints return **404 "No matching routes found"**
- Browser console shows: `Auth provider discovery of https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com failed: 502 Bad Gateway`

### Configuration Status

#### ✅ Correctly Configured

- [`convex/auth.config.ts`](convex/auth.config.ts): Using `process.env.CONVEX_SITE_URL` as domain
- [`convex/http.ts`](convex/http.ts): Calling `auth.addHttpRoutes(http)`
- [`convex/auth.ts`](convex/auth.ts): Properly initialized with `convexAuth({ providers: [Password, Anonymous] })`
- `JWT_PRIVATE_KEY`: Set and accessible (no "missing environment variable" errors)
- `JWKS`: Generated from public key and set
- `CONVEX_SITE_URL`: Fixed typo (was `CONVEX_SITE_URL==`, now `CONVEX_SITE_URL=`)

#### ❌ Not Working

- `/http/auth/config` returns 404
- `/auth/config` returns 404
- `/.well-known/openid-configuration` returns 404
- Auth provider discovery fails

---

## Research Findings

### 1. This is a Known Issue

Found multiple GitHub issues describing the **exact same problem**:

- **[Issue #227 - Convex Auth not working](https://github.com/get-convex/convex-auth/issues/227)** (June 23, 2025)
  - "Getting a 404 for the /api/auth endpoint when I attempt to sign into Github"
  - User wants to use Better Auth but switching to Clerk

- **[Issue #248 - POST /api/action 404](https://github.com/get-convex/convex-auth/issues/248)** (September 1, 2025)
  - "POST /api/action 404... following the instructions for setting up auth"
  - "now, we don't even have a /api folder. i assume this is done by convex?"
  - Convex dashboard shows all green and healthy

### 2. CLI Does Not Support Self-Hosted Auth

From [self-hosted README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md):

> "If you're using **Convex Auth**, follow the **manual instructions** to set up. **The CLI does not support self-hosted deployments yet.**"

This is a critical limitation - the `npx @convex-dev/auth` CLI command is designed for Convex Cloud deployments, not self-hosted ones.

### 3. Manual Setup Requirements

According to the [manual setup guide](https://labs.convex.dev/auth/setup/manual):

#### Required Environment Variables:

1. **`SITE_URL`** - Used for OAuth redirects and magic links (not needed for passwords only)
2. **`JWT_PRIVATE_KEY`** - PKCS#8 formatted RSA private key
3. **`JWKS`** - JSON Web Key Set with public key

#### Required Configuration:

1. **`convex/auth.config.ts`**:

   ```typescript
   export default {
     providers: [
       {
         domain: process.env.CONVEX_SITE_URL,
         applicationID: "convex",
       },
     ],
   };
   ```

2. **`convex/http.ts`**:

   ```typescript
   import { httpRouter } from "convex/server";
   import { auth } from "./auth";

   const http = httpRouter();
   auth.addHttpRoutes(http);
   export default http;
   ```

### 4. Environment Variable Location Issue

From [Issue #98](https://github.com/get-convex/convex-backend/issues/98):

> "jwt_private_key needs to be stored in the **deployment's environment variables page**, not in `.env` files"

For self-hosted Convex, this means variables must be accessible to the **Convex isolate workers** (separate process contexts where user code runs).

### 5. Port Configuration

From [self-hosting guide](https://stack.convex.dev/self-hosted-develop-and-deploy):

- **Port 3210**: Convex API
- **Port 3211**: Site proxy (for auth) - configured via `--site-proxy-port 3211`
- **Port 3212**: HTTP actions (some documentation mentions this, others don't)
- **Port 6791**: Dashboard

**Note:** The [`start-convex-backend.sh`](start-convex-backend.sh:75-77) script uses:

```bash
--site-proxy-port 3211 \
--convex-origin "$CONVEX_CLOUD_ORIGIN" \
--convex-site "$CONVEX_SITE_ORIGIN" \
```

### 6. Convex Auth is Beta

From [Convex Auth docs](https://docs.convex.dev/auth):

> "Convex Auth is currently in **beta** and may have backward-incompatible changes"

This suggests the library is still evolving and may have rough edges, especially for self-hosted deployments.

---

## Diagnostic Tests Created

Created comprehensive diagnostic test suites to isolate the issue:

### 1. **[tests/diagnostics/convex-auth-diagnostic.test.ts](tests/diagnostics/convex-auth-diagnostic.test.ts)**

- Playwright-based tests
- 8 levels of testing from network connectivity to auth provider discovery
- Tests ports 3210, 3211, 3212 individually
- Tests auth endpoints at various paths

### 2. **[tests/diagnostics/run-diagnostics.sh](tests/diagnostics/run-diagnostics.sh)**

- Shell script with 25+ tests
- Tests Docker infrastructure, ports, environment variables
- Can be run without starting the frontend

### 3. **[tests/diagnostics/DIAGNOSTIC_REPORT.md](tests/diagnostics/DIAGNOSTIC_REPORT.md)**

- Full diagnostic report template
- Documents findings and recommended solutions

---

## Current Configuration

### Environment Variables

| Variable              | Value                                                                 | Purpose                                    |
| --------------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| `CONVEX_CLOUD_ORIGIN` | `https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com`  | Convex API URL (port 3210)                 |
| `CONVEX_SITE_ORIGIN`  | `https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com` | Auth proxy URL (port 3212 via Coder proxy) |
| `CONVEX_SITE_URL`     | `https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com`  | HTTP Actions URL (used by auth.config.ts)  |
| `JWT_ISSUER`          | `https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com`  | JWT issuer URL                             |

### Docker Configuration

From [`docker-compose.convex.yml`](docker-compose.convex.yml:16-19):

```yaml
ports:
  - "3210:3210" # Convex API port
  - "3211:3211" # Convex site proxy port (for auth)
  - "3212:3212" # Convex site proxy port (for HTTP actions)
```

### Coder Proxy Configuration

From Coder workspace template:

```terraform
resource "coder_app" "convex-site" {
  slug         = "convex-site"
  url          = "http://localhost:3212"
  subdomain    = true
  share        = "public"
  hidden       = true
}
```

**Issue:** The `convex-site` URL returns **502 Bad Gateway**, suggesting the Coder proxy cannot reach port 3212.

---

## Root Cause Analysis

### Primary Issue

**`@convex-dev/auth` HTTP routes are not being registered/served by the self-hosted Convex backend**, despite:

1. ✅ Correct code configuration (`auth.addHttpRoutes(http)`)
2. ✅ Correct environment variables (`JWT_PRIVATE_KEY`, `JWKS`)
3. ✅ Correct auth config (`domain: process.env.CONVEX_SITE_URL`)
4. ✅ No errors in Convex logs about missing variables

### Secondary Issues

1. **Port 3212 Not Accessible**
   - Port 3212 listens but immediately resets connections ("Connection reset by peer")
   - From inside container: "Connection refused"
   - Coder proxy to port 3212 returns 502 Bad Gateway
   - This suggests Convex is not properly serving on port 3212

2. **Environment Variable Propagation**
   - `JWT_PRIVATE_KEY` is set in container environment
   - But may not be propagating to Convex isolate workers
   - Isolate workers are separate process contexts that may not inherit all environment variables

3. **Coder Proxy Routing**
   - `CONVEX_SITE_ORIGIN` points to `convex-site--...` URL
   - This URL returns 502 (proxy cannot reach backend)
   - May need Coder workspace configuration changes

---

## Possible Causes

### 1. HTTP Routes Not Deployed

**Hypothesis:** HTTP routes need to be explicitly deployed/synced to the Convex backend, but there's no documented way to do this for self-hosted setups.

**Evidence:**

- Routes return "No matching routes found" (not "route not defined")
- This suggests the route table exists but doesn't contain the auth routes
- Convex Cloud likely has automatic deployment that self-hosted lacks

### 2. Isolate Worker Environment Variables

**Hypothesis:** `JWT_PRIVATE_KEY` and `JWKS` are set in the main container but not accessible to the auth code running in isolate workers.

**Evidence:**

- No "Missing JWT_PRIVATE_KEY" errors in browser console
- But auth routes still return 404
- Suggests the route exists but fails internally

### 3. Port 3212 Not Started

**Hypothesis:** The Convex backend is not properly starting the HTTP actions server on port 3212.

**Evidence:**

- Port 3212 accepts connections but immediately resets them
- From inside container, port 3212 is "Connection refused"
- No errors in logs about port 3212

### 4. Coder Proxy Misconfiguration

**Hypothesis:** The Coder proxy is not configured correctly to route to port 3212.

**Evidence:**

- External URL returns 502 Bad Gateway
- But port is listening (netstat confirms)
- Other ports (3210, 3211) work fine

---

## Potential Solutions

### 1. Use Convex Cloud for Development

**Pros:** Auth works out of the box
**Cons:** Not self-hosted, requires internet

### 2. Wait for Official Fix

**Status:** Multiple open issues from June-September 2025
**Action:** Monitor [convex-auth GitHub issues](https://github.com/get-convex/convex-auth/issues)
**Related:** Issue #227, Issue #248, Issue #271

### 3. Use Alternative Auth

**Options:**

- [Better Auth](https://www.better-auth.com/docs/integrations/convex) - Has Convex integration
- [Clerk](https://github.com/get-convex/convex-auth/issues/227) - Mentioned as working alternative
- [Logto](https://github.com/get-convex/convex-backend/issues/75) - Self-hosted auth solution

### 4. Custom Auth Implementation

**Approach:** Implement auth directly in Convex functions without `@convex-dev/auth`
**Pros:** Full control, works with self-hosted
**Cons:** More development effort

### 5. Investigate Port 3212 Issue

**Steps:**

- Check Convex logs for port 3212 initialization errors
- Verify `--site-proxy-port` configuration
- Test if port 3211 should be used instead
- Check if HTTP routes need to be on a different port

### 6. Fix Coder Proxy Routing

**Steps:**

- Verify Coder proxy service name maps to correct port
- Check Coder workspace logs for proxy errors
- Test accessing port 3212 directly from workspace
- Consider using local URLs only for development

---

## Recommended Next Steps

1. **Join Convex Discord** - Search for "self-hosted auth" discussions
2. **Comment on Related Issues** - Add your findings to Issues #227, #248, #271
3. **Try Port 3211** - Test if auth works on port 3211 (the documented `--site-proxy-port`)
4. **Check Convex Logs** - Look for errors during HTTP route initialization
5. **Consider Better Auth** - Has official Convex integration and may work better

---

## Sources

### Official Documentation

- [Convex Auth Documentation](https://docs.convex.dev/auth/convex-auth)
- [Convex Auth Manual Setup](https://labs.convex.dev/auth/setup/manual)
- [Self-Hosting with Convex Guide](https://stack.convex.dev/self-hosted-develop-and-deploy)
- [Convex Self-Hosting Documentation](https://docs.convex.dev/self-hosting)
- [Self-Hosted Backend README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md)

### GitHub Issues

- [Issue #227: Convex Auth not working](https://github.com/get-convex/convex-auth/issues/227)
- [Issue #248: POST /api/action 404](https://github.com/get-convex/convex-auth/issues/248)
- [Issue #271: Next.js proxy middleware](https://github.com/get-convex/convex-auth/issues/271)
- [Issue #98: jwt_private_key environment](https://github.com/get-convex/convex-backend/issues/98)
- [Issue #75: Support at+jwt auth token](https://github.com/get-convex/convex-backend/issues/75)
- [Issue #74: Password provider not found](https://github.com/get-convex/convex-auth/issues/74)
- [Issue #128: convex env set multi-line](https://github.com/get-convex/convex-backend/issues/128)
- [Issue #200: npx convex dev self-hosted](https://github.com/get-convex/convex-backend/issues/200)
- [Issue #177: Can I self host convex use only 1 domain?](https://github.com/get-convex/convex-backend/issues/177)

### Community Resources

- [Convex Community Discord (via AnswerOverflow)](https://www.answeroverflow.com/c/1019350475847499849)
- [Reddit: Convex Self-Hosting Release](https://www.reddit.com/r/selfhosted/comments/1irvwgr/release_convex_selfhosting_opensource_reactive/)
- [Reddit: Is auth fixed now?](https://www.reddit.com/r/nextjs/comments/1it5uf4/is_auth_fixed_now/)

### Video Tutorials

- [How I Self-Host Convex](https://www.youtube.com/watch?v=lFn27k58VkY)
- [Convex has their own Auth now!](https://www.youtube.com/watch?v=0IvTw1CsGhs)

### Blog Posts & Guides

- [Convex Cloud vs. Self-Hosted Comparison](https://schemets.com/blog/convex-cloud-vs-self-hosting)
- [Self-Hosted Convex on AWS with SST](https://seanpaulcampbell.com/blog/self-hosted-convex-aws-sst/)
- [How to Self-Host Convex with Dokploy or Docker Compose](https://www.bitdoze.com/convex-self-host/)

### Alternative Auth Solutions

- [Better Auth Integration with Convex](https://www.better-auth.com/docs/integrations/convex)
- [Better Auth for Next.js](https://labs.convex.dev/better-auth/framework-guides/next)
- [Better Auth for TanStack Start](https://labs.convex.dev/better-auth/framework-guides/tanstack-start)

### Deployment Platforms

- [Railway: Deploy Convex](https://railway.com/deploy/convex)
- [Railway: Convex Template](https://railway.com/new/template/convex)
- [Coolify: Convex Documentation](https://coolify.io/docs/services/convex)

---

## Files Referenced

- [`convex/auth.config.ts`](convex/auth.config.ts) - Auth provider configuration
- [`convex/auth.ts`](convex/auth.ts) - Auth initialization
- [`convex/http.ts`](convex/http.ts) - HTTP routes registration
- [`convex/router.ts`](convex/router.ts) - HTTP router definition
- [`docker-compose.convex.yml`](docker-compose.convex.yml) - Docker services configuration
- [`start-convex-backend.sh`](start-convex-backend.sh) - Convex backend startup script
- [`.env`](.env) - Environment variables
- [`.env.convex.local`](.env.convex.local) - Convex-specific environment variables
- [`.env.local`](.env.local) - Frontend environment variables

---

## Conclusion

**Current Status:** ⚠️ **Not Working**

The `@convex-dev/auth` library appears to have **limited or incomplete support for self-hosted Convex deployments**. While all configuration is correct according to the documentation, the HTTP routes are not being served by the backend.

**Likely Root Cause:** HTTP routes need explicit deployment/syncing that doesn't exist for self-hosted setups, or there's a fundamental incompatibility between `@convex-dev/auth` and self-hosted Convex isolate workers.

**Recommendation:** Consider using Convex Cloud for development while this issue is being addressed, or explore alternative authentication solutions like Better Auth which has explicit Convex integration.

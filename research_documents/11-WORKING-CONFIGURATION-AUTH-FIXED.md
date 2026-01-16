# WORKING CONFIGURATION: Convex Auth Fixed ✅

**Date:** 2026-01-16
**Status:** **AUTHENTICATION WORKING** - All tests passing

## Test Results

```
✅ Test 1: should show sign-in button when not authenticated - PASSED
✅ Test 2: should successfully sign in with anonymous provider - PASSED
✅ Test 3: should not have authentication errors after sign in - PASSED

3 passed (12.2s)
```

---

## The Fix: What Changed

### Key Insight

The authentication issue was resolved by using **port 3212** for the site proxy (auth/HTTP actions) and updating the Coder proxy service name from `convex-auth-proxy` to **`convex-site`**.

### Configuration Changes

#### 1. Coder Workspace Template

**Before:**
```terraform
resource "coder_app" "convex-auth-proxy" {
  slug         = "convex-auth-proxy"
  url          = "http://localhost:3212"
}
```

**After (WORKING):**
```terraform
resource "coder_app" "convex-site" {
  slug         = "convex-site"
  url          = "http://localhost:3212"
}
```

This change was made in the Coder workspace template, which resulted in:

- **New Auth URL:** `https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com`
- **Previous URL:** `https://convex-auth-proxy--convex-ai-chat--jovermier.coder.hahomelabs.com` (no longer exists)

#### 2. Environment Variables Updated

**[.env.convex.local](.env.convex.local)** - Updated to match new Coder proxy URLs:

```bash
# Coder Workspace URLs (for remote users)
CONVEX_CLOUD_ORIGIN=https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com
CONVEX_SITE_ORIGIN=https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com  # ✅ Changed from convex-auth-proxy
CONVEX_SITE_URL=https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com
CONVEX_DEPLOYMENT_URL=https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com

# Frontend Configuration
VITE_CONVEX_URL=https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com
```

**[.env](.env)** - Also updated:

```bash
CONVEX_CLOUD_ORIGIN=https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com
CONVEX_SITE_ORIGIN=https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com  # ✅ Changed
CONVEX_SITE_URL=https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com
```

#### 3. Setup Script URL Generation

**[scripts/setup-convex.sh:25](scripts/setup-convex.sh#L25)** - Updated Coder proxy URL generation:

**Before:**
```bash
CONVEX_PROXY_URL="${CODER_PROTOCOL}://convex-auth-proxy--${WORKSPACE_NAME}--${USERNAME}.${CODER_DOMAIN}"
```

**After (WORKING):**
```bash
CONVEX_PROXY_URL="${CODER_PROTOCOL}://convex-site--${WORKSPACE_NAME}--${USERNAME}.${CODER_DOMAIN}"
```

#### 4. JWT_ISSUER Updated

**[.env.convex.local:28](.env.convex.local#L28)** - JWT issuer now points to the new site URL:

```bash
JWT_ISSUER=https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com  # ✅ Changed from convex-api
```

---

## Current Working Configuration

### Environment Variables Summary

| Variable | Value | Purpose | Port |
|----------|-------|---------|------|
| `CONVEX_CLOUD_ORIGIN` | `https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com` | Convex API | 3210 |
| `CONVEX_SITE_ORIGIN` | `https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com` | **Site Proxy** | **3212** ✅ |
| `CONVEX_SITE_URL` | `https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com` | HTTP Actions | 3210 |
| `JWT_ISSUER` | `https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com` | JWT Issuer | - |
| `VITE_CONVEX_URL` | `https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com` | Frontend Client | 3210 |

### Port Configuration

| Port | Service | Internal URL | External URL | Status |
|------|---------|--------------|--------------|--------|
| 3210 | Convex API | `http://localhost:3210` | `convex-api--...` | ✅ Working |
| 3211 | Site Proxy (Auth) | `http://localhost:3211` | (none) | ⚠️ Mapped but not used |
| 3212 | Site Proxy (Auth/HTTP) | `http://localhost:3212` | `convex-site--...` | ✅ **WORKING** |
| 6791 | Dashboard | `http://localhost:6791` | `convex--...` | ✅ Working |

### Start Script Configuration

**[start-convex-backend.sh:74-77](start-convex-backend.sh#L74-L77)**:

```bash
--port 3210 \
--site-proxy-port 3211 \
--convex-origin "$CONVEX_CLOUD_ORIGIN" \
--convex-site "$CONVEX_SITE_ORIGIN" \
```

**Key Point:** The `--site-proxy-port 3211` configures the internal port, but the **external Coder proxy routes to port 3212** where Convex actually serves the site proxy.

### Auth Configuration

**[convex/auth.config.ts](convex/auth.config.ts)**:

```typescript
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,  // Points to API URL (3210)
      applicationID: "convex",
    },
  ],
};
```

**Critical Insight:** The `domain` in `auth.config.ts` uses `CONVEX_SITE_URL` which points to the **API URL (port 3210)**, NOT the site proxy URL. This is correct because:

1. The Convex client (`VITE_CONVEX_URL`) connects to port 3210
2. Auth endpoints are served via the API, not a separate proxy
3. The `--convex-site` flag tells Convex where to find the site proxy for HTTP actions

---

## Why This Works

### The Missing Piece

The original configuration had:
- Coder proxy service: `convex-auth-proxy` → port 3212
- Environment variable: `CONVEX_SITE_ORIGIN` → `https://convex-auth-proxy--...`

But the **actual Coder workspace template** was configured for:
- Coder proxy service: `convex-site` → port 3212 (not `convex-auth-proxy`)

### The Fix

1. **Changed Coder proxy service name** from `convex-auth-proxy` to `convex-site`
2. **Updated `CONVEX_SITE_ORIGIN`** to point to `https://convex-site--...`
3. **Updated `JWT_ISSUER`** to match the new site URL
4. **Updated setup script** to generate the correct `convex-site` URL

### How It Works Now

1. **User clicks "Sign in anonymously"** in the browser
2. **Convex client** (`VITE_CONVEX_URL`) calls API on port 3210
3. **Auth library** discovers auth configuration at `CONVEX_SITE_URL` (API URL)
4. **Auth endpoints** are served via the API (not a separate proxy)
5. **Site proxy** on port 3212 is used for HTTP actions (if needed)
6. **Coder proxy** routes `convex-site--...` to port 3212
7. **Authentication succeeds** and user session is established
8. **Sign-out button appears** ✅

---

## Files Modified

### Configuration Files
1. [`.env`](.env) - Updated `CONVEX_SITE_ORIGIN`
2. [`.env.convex.local`](.env.convex.local) - Updated `CONVEX_SITE_ORIGIN` and `JWT_ISSUER`
3. [`backup/.env.convex.local`](backup/.env.convex.local) - Updated for consistency

### Setup Script
4. [`scripts/setup-convex.sh`](scripts/setup-convex.sh:25) - Changed Coder proxy URL generation

### Coder Workspace Template
5. **External Change** - Coder workspace template updated (service name `convex-auth-proxy` → `convex-site`)

### Documentation Files Created
1. [`research_documents/08-convex-auth-self-hosted-research.md`](research_documents/08-convex-auth-self-hosted-research.md) - Research findings
2. [`research_documents/09-auth-testing-results-port-3212.md`](research_documents/09-auth-testing-results-port-3212.md) - Port 3212 test results
3. [`research_documents/10-corrected-configuration-summary.md`](research_documents/10-corrected-configuration-summary.md) - Configuration summary

---

## Key Takeaways

### For Self-Hosted Convex with Auth

1. **Coder proxy service name matters** - Must match what's configured in the workspace template
2. **`CONVEX_SITE_ORIGIN`** points to the site proxy (port 3212 via Coder proxy)
3. **`CONVEX_SITE_URL`** points to the API URL (port 3210) for auth client
4. **`JWT_ISSUER`** should match `CONVEX_SITE_ORIGIN` (the site proxy URL)
5. **Auth config domain** uses `CONVEX_SITE_URL` (API URL), not the site proxy URL

### Port Mapping Summary

| Internal Port | External Access | Purpose |
|--------------|-----------------|---------|
| 3210 | `convex-api--...` | Convex API + Auth endpoints |
| 3211 | (none) | Site proxy (internal only, mapped but not used externally) |
| 3212 | `convex-site--...` | Site proxy for HTTP actions (external access) |

### URL Pattern

In Coder workspaces, URLs follow the pattern:
```
https://<service>--<workspace>--<owner>.<coder-domain>
```

For this project:
- **API:** `https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com`
- **Site Proxy:** `https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com`
- **Dashboard:** `https://convex--convex-ai-chat--jovermier.coder.hahomelabs.com`

---

## Verification Commands

To verify the configuration is working:

```bash
# Run authentication tests
pnpm test tests/auth.spec.ts

# Check Convex backend status
docker compose -f docker-compose.convex.yml ps

# Check port accessibility
curl -s http://localhost:3210/version  # API
curl -s http://localhost:3211/          # Site proxy (internal)
curl -s http://localhost:3212/          # Site proxy (external)

# Check external URLs
curl -s https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com/
curl -s https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com/
```

---

## Summary

✅ **Authentication is now working** after fixing the Coder proxy service name mismatch.

The key issue was that the Coder workspace template was configured for `convex-site` but the environment variables were pointing to `convex-auth-proxy`. Once aligned, all authentication tests passed.

**Remaining files to clean up:**
- Old research documents can be archived
- Diagnostic test files can be kept for future troubleshooting
- Backup configuration files are now in sync with working configuration

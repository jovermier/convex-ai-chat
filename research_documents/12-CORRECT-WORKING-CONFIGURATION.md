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

## The Actual Coder Workspace Configuration

Based on the Coder workspace template, here are the **actual Convex services** configured:

### Coder Apps Mapping

| Slug | Display Name | Internal URL | External URL | Port | Hidden |
|------|-------------|--------------|--------------|------|--------|
| `convex-dashboard` | Convex Dashboard | `localhost:6791` | `convex--...` | 6791 | No |
| `convex-api` | Convex API | `localhost:3210` | `convex-api--...` | 3210 | **Yes** |
| `convex-site` | Convex Site | `localhost:3211` | `convex-site--...` | 3211 | **Yes** |
| `convex-s3-proxy` | Convex S3 Proxy | `localhost:3212` | `convex-s3-proxy--...` | 3212 | **Yes** |

**Key Discovery:** There is **NO** `convex-auth-proxy` service! The services are:
- `convex-site` → port 3211 (auth/site proxy)
- `convex-s3-proxy` → port 3212 (S3 proxy, not used for auth)

---

## Current Working Configuration

### Environment Variables

**[.env.convex.local](.env.convex.local)**:

```bash
# Coder Workspace URLs (for remote users)
CONVEX_CLOUD_ORIGIN=https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com
CONVEX_SITE_ORIGIN=https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com  # ✅ Port 3211
CONVEX_SITE_URL=https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com
CONVEX_DEPLOYMENT_URL=https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com

# Frontend Configuration
VITE_CONVEX_URL=https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com
```

**[.env](.env)**:

```bash
CONVEX_CLOUD_ORIGIN=https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com
CONVEX_SITE_ORIGIN=https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com  # ✅ Correct
CONVEX_SITE_URL=https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com  # ✅ Correct
```

### Port Assignments

| Internal Port | Coder App | External URL | Purpose | Working |
|--------------|-----------|--------------|---------|---------|
| 3210 | `convex-api` | `convex-api--...` | Convex API | ✅ Yes |
| 3211 | `convex-site` | `convex-site--...` | **Site Proxy (Auth)** | ✅ **Yes** |
| 3212 | `convex-s3-proxy` | `convex-s3-proxy--...` | S3 Proxy | ⚠️ Not used for auth |
| 6791 | `convex-dashboard` | `convex--...` | Dashboard | ✅ Yes |

### Start Script Configuration

**[start-convex-backend.sh:74-77](start-convex-backend.sh#L74-L77)**:

```bash
--port 3210 \
--site-proxy-port 3211 \  # ✅ Matches Coder config
--convex-origin "$CONVEX_CLOUD_ORIGIN" \
--convex-site "$CONVEX_SITE_ORIGIN" \
```

This correctly configures:
- API on port 3210
- Site proxy on port 3211
- `--convex-site` points to `CONVEX_SITE_ORIGIN` (external URL for port 3211)

### Auth Configuration

**[convex/auth.config.ts](convex/auth.config.ts)**:

```typescript
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,  // API URL (3210)
      applicationID: "convex",
    },
  ],
};
```

---

## How Authentication Works

### The Flow

1. **User clicks "Sign in anonymously"** in browser
2. **Convex client** (`VITE_CONVEX_URL` → API URL on port 3210) initiates auth
3. **Auth library** (`@convex-dev/auth`) calls auth endpoints via the API
4. **Auth endpoints** are served through the API (port 3210), not a separate proxy
5. **Site proxy** (port 3211, URL: `convex-site--...`) is used for:
   - HTTP actions (user-defined HTTP routes)
   - Auth provider discovery (internal Convex communication)
   - Site proxy functionality

### Why `CONVEX_SITE_URL` Points to API URL

The `domain` in `auth.config.ts` uses `CONVEX_SITE_URL` which points to the **API URL** because:

1. **All Convex communication goes through the API** (port 3210)
2. **Auth endpoints are `/api/auth/*` on the API**, not separate proxy endpoints
3. **The site proxy (port 3211)** is for:
   - User-defined HTTP routes (`convex/http.ts`)
   - Internal Convex site proxy functionality
   - NOT for external auth provider discovery

---

## URLs Summary

### Internal (Localhost)

| Service | URL |
|---------|-----|
| Convex API | `http://localhost:3210` |
| Site Proxy (Auth) | `http://localhost:3211` |
| S3 Proxy | `http://localhost:3212` |
| Dashboard | `http://localhost:6791` |

### External (Coder Proxy)

| Service | URL | Internal Port |
|---------|-----|---------------|
| Convex API | `https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com` | 3210 |
| Convex Site | `https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com` | 3211 |
| Convex S3 Proxy | `https://convex-s3-proxy--convex-ai-chat--jovermier.coder.hahomelabs.com` | 3212 |
| Convex Dashboard | `https://convex--convex-ai-chat--jovermier.coder.hahomelabs.com` | 6791 |

---

## Setup Script URL Generation

**[scripts/setup-convex.sh:24-26](scripts/setup-convex.sh#L24-L26)**:

```bash
CONVEX_API_URL="${CODER_PROTOCOL}://convex-api--${WORKSPACE_NAME}--${USERNAME}.${CODER_DOMAIN}"
CONVEX_PROXY_URL="${CODER_PROTOCOL}://convex-site--${WORKSPACE_NAME}--${USERNAME}.${CODER_DOMAIN}"  # ✅ Correct
CONVEX_DASHBOARD_URL="${CODER_PROTOCOL}://convex--${WORKSPACE_NAME}--${USERNAME}.${CODER_DOMAIN}"
```

The setup script generates the correct `convex-site` URL for `CONVEX_SITE_ORIGIN`.

---

## Configuration Status

All configuration files are now consistent with the correct `convex-site` service name:

- ✅ [`.env.convex.local`](.env.convex.local) - Correct configuration
- ✅ [`.env`](.env) - Correct configuration
- ✅ [`scripts/setup-convex.sh`](scripts/setup-convex.sh:25) - Correct URL generation

---

## Key Insights

### 1. Port 3211 is the Auth Port

Despite some confusion during testing about port 3212, **port 3211 is the correct site proxy port** for authentication:
- Configured in Coder template as `convex-site` → port 3211
- Configured in start script as `--site-proxy-port 3211`
- Used by `--convex-site` flag with `CONVEX_SITE_ORIGIN`

### 2. Port 3212 is S3 Proxy (Not Auth)

- Coder template shows `convex-s3-proxy` → port 3212
- This is for S3 proxy functionality, not authentication
- Not currently used for auth

### 3. Auth Config Uses API URL

The `domain` in `auth.config.ts` correctly uses `CONVEX_SITE_URL` which points to the **API URL** because:
- All Convex client communication goes through the API (port 3210)
- Auth endpoints are served at `/api/auth/*` on the API
- The site proxy is for HTTP routes and internal Convex communication

### 4. Coder Proxy Service Name is Critical

The authentication was fixed when the Coder template was updated to use:
- **Old (broken):** `convex-auth-proxy` → port 3211
- **New (working):** `convex-site` → port 3211

The environment variables were then updated to match the new service name.

---

## Files That Were Changed

### By User (Coder Template Update)
1. **Coder workspace template** - Changed service from `convex-auth-proxy` to `convex-site`

### In Response (Environment Variables)
2. **[scripts/setup-convex.sh:25](scripts/setup-convex.sh#L25)** - Changed `CONVEX_PROXY_URL` to use `convex-site`
3. **[.env.convex.local:6](.env.convex.local#L6)** - Updated `CONVEX_SITE_ORIGIN` to `convex-site--...`
4. **[.env.convex.local:28](.env.convex.local#L28)** - Updated `JWT_ISSUER` to `convex-site--...`
5. **[.env:2](.env:2)** - Updated `CONVEX_SITE_ORIGIN` to `convex-site--...` (corrected)
6. **[.env:3](.env:3)** - Verified `CONVEX_SITE_URL` points to API URL (correct)

---

## What Makes This Configuration Work

### The Critical Pieces

1. **`CONVEX_SITE_ORIGIN`** points to the correct Coder proxy service (`convex-site`)
2. **`CONVEX_SITE_URL`** points to the API URL (where auth endpoints are)
3. **`--site-proxy-port 3211`** matches the Coder template configuration
4. **`--convex-site`** flag uses `CONVEX_SITE_ORIGIN` for external site proxy access
5. **`JWT_ISSUER`** matches `CONVEX_SITE_ORIGIN` for token validation

### Why Port 3211 Works for Auth

The start script configures Convex with:
```bash
--site-proxy-port 3211 \  # Internal port for site proxy
--convex-site "$CONVEX_SITE_ORIGIN" \  # External URL for accessing the site proxy
```

This means:
- **Internally**: Convex serves site proxy on port 3211
- **Externally**: Accessible via `https://convex-site--...` (Coder proxy → port 3211)

### Why Auth Config Uses API URL

The `auth.config.ts` uses `CONVEX_SITE_URL` (API URL) because:

1. **Convex client** connects to API URL (port 3210)
2. **Auth endpoints** are at `/api/auth/*` on the API
3. **All external communication** goes through the API URL
4. **Site proxy (port 3211)** is for HTTP routes and internal Convex functions

---

## Verification Commands

```bash
# Check current configuration
grep "CONVEX_SITE" .env.convex.local | grep -v "^#"

# Test authentication
pnpm test tests/auth.spec.ts

# Check port connectivity
curl -s http://localhost:3210/version  # API
curl -s http://localhost:3211/          # Site proxy
curl -s http://localhost:3212/          # S3 proxy

# Check external URLs
curl -s https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com/
curl -s https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com/
curl -s https://convex-s3-proxy--convex-ai-chat--jovermier.coder.hahomelabs.com/
```

---

## Summary

✅ **Authentication is working** with the correct Coder template configuration.

The key issue was that the Coder workspace template was updated to use `convex-site` (port 3211) instead of the non-existent `convex-auth-proxy`. Once the environment variables were updated to match, all authentication tests passed.

**Key Configuration:**
- Site proxy (auth): Port 3211 → `convex-site--...` URL
- API (auth endpoints): Port 3210 → `convex-api--...` URL
- S3 proxy: Port 3212 → `convex-s3-proxy--...` URL (not used for auth)

**Environment Variable Mapping:**
- `CONVEX_CLOUD_ORIGIN` → API URL (3210)
- `CONVEX_SITE_ORIGIN` → Site proxy URL (3211)
- `CONVEX_SITE_URL` → API URL (3210) - used by auth.config.ts
- `JWT_ISSUER` → Site proxy URL (3211)

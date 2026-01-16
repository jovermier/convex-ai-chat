# Corrected Convex Configuration Summary

**Date:** 2026-01-16
**Status:** Configuration reverted to original working state

## Changes Made (Reverted)

### 1. start-convex-backend.sh

```bash
--site-proxy-port 3211 \  # Reverted from 3212 back to 3211
```

### 2. .env and .env.convex.local

```bash
CONVEX_SITE_URL=https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com  # Port 3210 (API)
```

## Correct Configuration

### Environment Variables

| Variable              | Value                                                                 | Purpose                    |
| --------------------- | --------------------------------------------------------------------- | -------------------------- |
| `CONVEX_CLOUD_ORIGIN` | `https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com`  | API URL (port 3210)        |
| `CONVEX_SITE_ORIGIN`  | `https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com` | Auth proxy URL (port 3211) |
| `CONVEX_SITE_URL`     | `https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com`  | **API URL (port 3210)**    |
| `VITE_CONVEX_URL`     | `https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com`  | Frontend Convex client URL |

### Port Assignments

| Port | Purpose           | External URL         |
| ---- | ----------------- | -------------------- |
| 3210 | Convex API        | `convex-api--...`    |
| 3211 | Site Proxy (Auth) | `convex-site--...`   |
| 3212 | HTTP Actions      | (not currently used) |
| 6791 | Dashboard         | `convex--...`        |

### Start Script Configuration

```bash
--port 3210 \
--site-proxy-port 3211 \
--convex-origin "$CONVEX_CLOUD_ORIGIN" \
--convex-site "$CONVEX_SITE_ORIGIN" \
```

## Key Points

1. **`CONVEX_SITE_URL` points to API URL (3210)** - This is correct for the Convex client
2. **`CONVEX_SITE_ORIGIN` points to auth proxy URL (3211)** - This is used by `--convex-site` flag
3. **Site proxy runs on port 3211** - As configured in start script
4. **Auth config uses `process.env.CONVEX_SITE_URL`** - Points to API URL, not auth proxy URL

## Current Status

After reverting to original configuration:

- Port 3211 returns 404 (expected - no route at root)
- Auth proxy URL returns 404 (reachable, not 502)
- Auth endpoints still return 404 (HTTP routes not registered)

## Remaining Issue

**Auth HTTP routes return 404** - This is the core issue that prevents `@convex-dev/auth` from working in self-hosted Convex. The routes are configured correctly but not being served by the backend.

See [research_documents/08-convex-auth-self-hosted-research.md](08-convex-auth-self-hosted-research.md) for full details.

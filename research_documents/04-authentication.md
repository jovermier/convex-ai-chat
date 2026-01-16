# Authentication - Self-Hosted Convex Research

## Research Overview

This document compiles research findings about authentication issues in self-hosted Convex deployments.

**Sources:**

- [Self-Hosted Convex README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md)
- [Convex Auth Documentation](https://labs.convex.dev/auth/setup/manual)

---

## Question 20: Why does auth fail with "No auth provider found matching the given token"?

### Answer

This error occurs when Convex Auth is not properly configured for self-hosted deployments.

### Root Cause

Convex Auth expects specific configuration that differs between cloud-hosted and self-hosted deployments. The CLI setup wizard doesn't support self-hosted deployments yet.

### Solution: Manual Configuration

According to the [Convex Auth manual setup guide](https://labs.convex.dev/auth/setup/manual), you must configure auth manually for self-hosted deployments.

#### Step 1: Install Convex Auth

```bash
npm install @convex-dev/auth
```

#### Step 2: Configure Auth Provider

Create `convex/auth.config.ts`:

```typescript
import { convexAuth } from "@convex-dev/auth/react";
import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
});
```

#### Step 3: Set Environment Variables

```bash
# .env.local
GITHUB_CLIENT_ID='your-github-client-id'
GITHUB_CLIENT_SECRET='your-github-client-secret'
GOOGLE_CLIENT_ID='your-google-client-id'
GOOGLE_CLIENT_SECRET='your-google-client-secret'
```

#### Step 4: Configure Instance Secrets

```yaml
# docker-compose.yml
services:
  backend:
    environment:
      - JWT_PRIVATE_KEY=${JWT_PRIVATE_KEY}
      - JWT_ISSUER=${JWT_ISSUER:-convex-self-hosted}
```

Generate JWT private key:

```bash
openssl genrsa -out jwt_private_key.pem 2048
```

---

## Question 21: How does `@convex-dev/auth` interact with self-hosted Convex?

### Answer

`@convex-dev/auth` works with self-hosted Convex but requires manual configuration.

### Key Differences

#### Cloud-Hosted (CLI Setup)

```bash
# Automated setup
npx convex auth setup github

# CLI handles everything
# - Provider configuration
# - Environment variables
# - Instance secrets
```

#### Self-Hosted (Manual Setup)

```bash
# Manual configuration required
# - Create auth.config.ts
# - Set environment variables
# - Configure JWT keys
# - No CLI support (as of January 2026)
```

### Auth Provider Support

| Provider       | Cloud-Hosted | Self-Hosted | Notes |
| -------------- | ------------ | ----------- | ----- |
| GitHub         | ✅ CLI       | ✅ Manual   | Works |
| Google         | ✅ CLI       | ✅ Manual   | Works |
| Email/Password | ✅ CLI       | ✅ Manual   | Works |
| Anonymous      | ✅ CLI       | ✅ Manual   | Works |
| Other OAuth    | ✅ CLI       | ✅ Manual   | Works |

---

## Question 22: What's the role of `JWT_PRIVATE_KEY` and `JWT_ISSUER` in auth?

### Answer

These environment variables configure JWT token generation and validation.

### JWT_PRIVATE_KEY

**Purpose:** Private key for signing JWT tokens.

**Generation:**

```bash
# Generate RSA private key
openssl genrsa -out jwt_private_key.pem 2048

# Or generate from secret
openssl genrsa 2048
```

**Configuration:**

```yaml
# docker-compose.yml
services:
  backend:
    environment:
      - JWT_PRIVATE_KEY=${JWT_PRIVATE_KEY}
```

```bash
# .env
JWT_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'
```

### JWT_ISSUER

**Purpose:** Issuer identifier for JWT tokens.

**Default:** `convex-self-hosted`

**Configuration:**

```yaml
# docker-compose.yml
services:
  backend:
    environment:
      - JWT_ISSUER=convex-self-hosted
```

### Token Flow

#### Login

1. User authenticates via OAuth
2. Backend creates JWT token
3. Token signed with `JWT_PRIVATE_KEY`
4. Token includes `JWT_ISSUER` claim

#### Token Validation

1. Client sends token with requests
2. Backend validates signature with `JWT_PRIVATE_KEY`
3. Backend verifies issuer matches `JWT_ISSUER`
4. Token accepted if valid

---

## Question 23: How do you configure auth providers for self-hosted deployments?

### Answer

Auth providers must be configured manually in `convex/auth.config.ts`.

### Example Configurations

#### GitHub OAuth

```typescript
// convex/auth.config.ts
import { convexAuth } from "@convex-dev/auth/react";
import GitHub from "@auth/core/providers/github";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
});
```

**Environment Variables:**

```bash
GITHUB_CLIENT_ID='your-github-client-id'
GITHUB_CLIENT_SECRET='your-github-client-secret'
```

**GitHub OAuth App Setup:**

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create new OAuth App
3. Set callback URL: `http://localhost:6791/auth/callback/github`
4. Copy Client ID and Client Secret

#### Google OAuth

```typescript
// convex/auth.config.ts
import Google from "@auth/core/providers/google";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
});
```

**Environment Variables:**

```bash
GOOGLE_CLIENT_ID='your-google-client-id'
GOOGLE_CLIENT_SECRET='your-google-client-secret'
```

#### Email/Password

```typescript
// convex/auth.config.ts
import { Password } from "@convex-dev/auth/providers/password";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      provider: Password,
    }),
  ],
});
```

#### Anonymous

```typescript
// convex/auth.config.ts
import { Anonymous } from "@convex-dev/auth/providers/anonymous";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Anonymous()],
});
```

### Production Configuration

```typescript
// convex/auth.config.ts
import { convexAuth } from "@convex-dev/auth/react";
import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  // Production-specific settings
  production: process.env.NODE_ENV === "production",
});
```

---

## Question 24: Can self-hosted Convex use the same auth as cloud-hosted?

### Answer

**Yes** - the auth providers and configuration are identical, but setup differs.

### Similarities

- ✅ Same auth providers (GitHub, Google, Email/Password, etc.)
- ✅ Same `@convex-dev/auth` package
- ✅ Same `convex/auth.config.ts` format
- ✅ Same environment variables
- ✅ Same JWT token format

### Differences

#### Cloud-Hosted

```bash
# Automated CLI setup
npx convex auth setup github

# Instance secrets managed by Convex
# No JWT configuration needed
```

#### Self-Hosted

```bash
# Manual setup required
# - Create auth.config.ts
# - Configure JWT_PRIVATE_KEY
# - Configure JWT_ISSUER
# - Set all environment variables manually
```

### Migration Guide

#### From Cloud to Self-Hosted

```bash
# 1. Export cloud configuration
npx convex auth export > auth_config.json

# 2. Deploy to self-hosted
# Manually recreate auth.config.ts from export

# 3. Set environment variables
# Copy provider credentials from cloud to self-hosted

# 4. Generate JWT keys
openssl genrsa -out jwt_private_key.pem 2048

# 5. Update .env.local
JWT_PRIVATE_KEY=$(cat jwt_private_key.pem)
```

---

## Common Auth Issues

### Issue: "No auth provider found matching the given token"

**Cause:** Auth not configured or `auth.config.ts` missing.

**Solution:**

```bash
# 1. Create auth.config.ts
# 2. Configure providers
# 3. Set environment variables
# 4. Restart backend
docker compose restart backend
```

### Issue: OAuth Callback Fails

**Cause:** Incorrect callback URL in OAuth app settings.

**Solution:**

```bash
# Set correct callback URL
# Development: http://localhost:6791/auth/callback/github
# Production: https://dashboard.your-domain.com/auth/callback/github
```

### Issue: JWT Validation Fails

**Cause:** `JWT_PRIVATE_KEY` changed or not set.

**Solution:**

```bash
# Generate new key
openssl genrsa -out jwt_private_key.pem 2048

# Set in environment
JWT_PRIVATE_KEY=$(cat jwt_private_key.pem)

# Restart backend
docker compose restart backend
```

---

## Best Practices

### 1. Environment Variable Management

```bash
# .env.local (development)
GITHUB_CLIENT_ID='dev-github-id'
GITHUB_CLIENT_SECRET='dev-github-secret'
JWT_PRIVATE_KEY='dev-jwt-key'

# .env.production (production)
GITHUB_CLIENT_ID='prod-github-id'
GITHUB_CLIENT_SECRET='prod-github-secret'
JWT_PRIVATE_KEY='prod-jwt-key'
```

### 2. OAuth App Configuration

- Create separate OAuth apps for dev and prod
- Use different callback URLs
- Rotate secrets regularly

### 3. JWT Key Management

```bash
# Generate keys for each environment
openssl genrsa -out jwt_private_key_dev.pem 2048
openssl genrsa -out jwt_private_key_prod.pem 2048

# Store securely
# Use secret management (AWS Secrets Manager, etc.)
```

### 4. Testing Auth Locally

```bash
# Start backend with auth
docker compose up -d

# Configure OAuth app with localhost callback
# http://localhost:6791/auth/callback/github

# Test login flow
# Visit http://localhost:6791
# Click "Sign in with GitHub"
```

---

## Summary

| Question                                         | Key Finding                                      |
| ------------------------------------------------ | ------------------------------------------------ |
| **Q20: Why "No auth provider found" error?**     | Auth must be configured manually for self-hosted |
| **Q21: How does @convex-dev/auth interact?**     | Same package, but requires manual setup          |
| **Q22: Role of JWT_PRIVATE_KEY and JWT_ISSUER?** | Sign and validate JWT tokens                     |
| **Q23: Configure auth providers?**               | Manual configuration in auth.config.ts           |
| **Q24: Same auth as cloud-hosted?**              | Yes, but setup is manual                         |

---

## References

- [Self-Hosted Convex README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md)
- [Convex Auth Manual Setup](https://labs.convex.dev/auth/setup/manual)
- [Convex Auth Documentation](https://labs.convex.dev/auth)

---

**Last Updated:** January 16, 2026
**Research Date:** January 16, 2026
**Convex Backend Version:** Latest (as of research date)

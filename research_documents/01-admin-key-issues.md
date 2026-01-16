# Admin Key Issues - Self-Hosted Convex Research

## Research Overview

This document compiles research findings about admin key issues in self-hosted Convex deployments.

**Sources:**

- [Self-Hosted Convex README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md)
- [Running Binary Directly](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/running_binary_directly.md)
- [GitHub Issue #200](https://github.com/get-convex/convex-backend/issues/200)
- [GitHub Issue #173](https://github.com/get-convex/convex-backend/issues/173)

---

## Question 1: Why does the admin key change every time the Convex container restarts?

### Answer

**The admin key does NOT automatically change on container restarts** - this is a common misconception. The issue typically occurs because:

1. **Instance Secret Not Persisted**: The admin key is generated using the instance secret. If the instance secret changes or is not persisted across restarts, new admin keys will be generated each time.

2. **Missing Docker Volume**: Without proper volume persistence, the Convex backend generates a new instance secret on each start, which causes all previously generated admin keys to become invalid.

3. **Regenerating Keys**: Users may be running `generate_admin_key.sh` after each restart, creating new keys unnecessarily.

### Solution

```yaml
# docker-compose.yml
volumes:
  - data:/convex/data # This persists the instance secret
```

Ensure the Docker volume is properly mounted and persisted across container restarts.

---

## Question 2: How does Convex generate admin keys internally?

### Answer

Admin keys are generated using a **two-step process**:

#### Step 1: Generate Instance Secret

```bash
cargo run -p keybroker --bin generate_secret
# Output: 4361726e697461732c206c69746572616c6c79206d65616e696e6720226c6974
```

The instance secret is the master secret for the backend. It must be kept safe and only accessible from the backend itself.

#### Step 2: Generate Admin Key from Instance Secret

```bash
cargo run -p keybroker --bin generate_key -- convex-self-hosted <instance-secret>
# Output: convex-self-hosted|01c046ab1512d9306a6abda3eedec5dfe862f1fe0f66a5aee774fb9ae3fda87706facaf682b9d4f9209a05e038cbd6e9b8
```

### Admin Key Format

```
<instance-name>|<signature>
```

The admin key is a signature derived from the instance secret using cryptographic operations. The backend validates admin keys by verifying this signature against the stored instance secret.

---

## Question 3: Where does Convex store the instance secret that validates admin keys?

### Answer

The instance secret is stored in the **Convex database/persistence layer**:

1. **SQLite (Default)**: Stored in the SQLite database file at `/convex/data` (inside the container)
2. **PostgreSQL/MySQL**: Stored in the database as part of the instance configuration
3. **Docker Volume**: When using Docker Compose, the instance secret persists in the `data` volume

### Key Points:

- The instance secret is **NOT stored in environment variables** by default
- It is automatically generated on first startup if not provided
- The `INSTANCE_SECRET` environment variable can override this (not recommended for production)

### Verification

```bash
# Check if instance secret persists
docker compose exec backend ./generate_admin_key.sh
# Restart container
docker compose restart backend
# Run again - should still work if instance secret persisted
docker compose exec backend ./generate_admin_key.sh
```

---

## Question 4: Is there a way to persist the admin key across container restarts?

### Answer

**Yes** - by persisting the instance secret across restarts:

### Method 1: Docker Volume (Recommended)

```yaml
# docker-compose.yml
services:
  backend:
    volumes:
      - data:/convex/data # Persists instance secret and database

volumes:
  data:
```

### Method 2: Custom Instance Secret

```yaml
# docker-compose.yml
services:
  backend:
    environment:
      - INSTANCE_SECRET=${INSTANCE_SECRET}
```

Then generate your own instance secret:

```bash
cargo run -p keybroker --bin generate_secret
```

Add to `.env`:

```bash
INSTANCE_SECRET=4361726e697461732c206c69746572616c6c79206d65616e696e6720226c6974
```

### Method 3: Managed Database

Use PostgreSQL/MySQL with connection strings:

```bash
POSTGRES_URL=postgresql://user@host:port
MYSQL_URL=mysql://user@host:port
```

The instance secret will be stored in the database and persist across restarts.

---

## Question 5: What's the difference between `CONVEX_ADMIN_KEY` and `CONVEX_SELF_HOSTED_ADMIN_KEY`?

### Answer

| Environment Variable                         | Use Case                       | When to Use                                            |
| -------------------------------------------- | ------------------------------ | ------------------------------------------------------ |
| `CONVEX_SELF_HOSTED_ADMIN_KEY`               | Self-hosted Convex deployments | When running Convex backend on your own infrastructure |
| `CONVEX_DEPLOY_KEY` (not `CONVEX_ADMIN_KEY`) | Cloud-hosted Convex            | When using Convex's cloud service                      |

### Key Differences:

1. **`CONVEX_SELF_HOSTED_ADMIN_KEY`**:
   - Used for self-hosted deployments
   - Format: `convex-self-hosted|<signature>`
   - Validates against your self-hosted instance secret
   - Set in `.env.local` for local development

2. **`CONVEX_DEPLOY_KEY`** (Cloud):
   - Used for cloud-hosted Convex
   - Retrieved from Convex dashboard
   - Validates against Convex cloud infrastructure
   - Set in deployment environments (Vercel, Netlify, etc.)

### Configuration Example:

```bash
# .env.local for self-hosted
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|016aecfef07a512ed12e84a21075e2d1c73ed88476c2ea5f55d7fb41899309686fafb88706'

# For cloud deployment (Vercel/Netlify)
CONVEX_DEPLOYMENT='convex-cloud-deployment-url'
CONVEX_DEPLOY_KEY='your-cloud-deploy-key'
```

**Note**: There is no `CONVEX_ADMIN_KEY` variable. The self-hosted equivalent is `CONVEX_SELF_HOSTED_ADMIN_KEY`.

---

## Question 6: Does the admin key need to match an instance secret in the database?

### Answer

**Yes** - the admin key must be generated from and match the instance secret stored in the database.

### Validation Process:

1. Admin key is received: `convex-self-hosted|<signature>`
2. Backend extracts instance name: `convex-self-hosted`
3. Backend retrieves instance secret from database
4. Backend validates the signature using the instance secret
5. If signature is valid → admin key is accepted
6. If signature is invalid → `BadAdminKey` error

### Common Issues:

- **Issue #173**: User generated admin key from container A, but tried to use it with container B that has a different instance secret
- **Container Recreation**: Creating a new container without volume persistence generates a new instance secret, invalidating old admin keys

### Verification:

```bash
# Generate admin key
docker compose exec backend ./generate_admin_key.sh
# Output: convex-self-hosted|<signature>

# Test admin key
curl 'http://127.0.0.1:3210/api/check_admin_key' \
  -H 'Authorization: Convex convex-self-hosted|<signature>'
# Should return: {"valid": true}
```

---

## Question 7: Can we specify a custom admin key during initial Convex setup?

### Answer

**No** - you cannot specify a custom admin key directly. Admin keys must be **generated** from the instance secret using the keybroker tool.

### Workaround: Custom Instance Secret

If you need predictable admin keys, generate your own instance secret:

```bash
# Generate custom instance secret
cargo run -p keybroker --bin generate_secret

# Set it before starting Convex
export INSTANCE_SECRET='your-custom-instance-secret'

# Start Convex with your instance secret
docker compose up
```

### Then Generate Admin Keys:

```bash
# Generate admin key from your custom instance secret
docker compose exec backend ./generate_admin_key.sh
```

### Why This Design?

- **Security**: Admin keys are cryptographically signed, preventing arbitrary key generation
- **Validation**: Backend can verify admin keys without storing them all
- **Revocation**: Generate new admin keys without changing the instance secret

### Best Practice:

Generate multiple admin keys for different purposes (CI/CD, local development, production) and store them securely:

```bash
# Generate admin key for CI/CD
docker compose exec backend ./generate_admin_key.sh > ci_admin_key.txt

# Generate admin key for local development
docker compose exec backend ./generate_admin_key.sh > local_admin_key.txt

# Generate admin key for production
docker compose exec backend ./generate_admin_key.sh > prod_admin_key.txt
```

---

## Common Issues and Solutions

### Issue: "BadAdminKey" Error

**From GitHub Issue #173**

**Symptoms:**

```bash
curl 'http://127.0.0.1:3210/api/check_admin_key' \
  -H 'Authorization: Convex convex-self-hosted|<key>'
# Response: {"code":"BadAdminKey","message":"The provided admin key was invalid for this instance"}
```

**Root Causes:**

1. Admin key generated from a different instance secret
2. Container was recreated without volume persistence
3. Using admin key from a different Convex instance

**Solutions:**

1. Regenerate admin key after container restart:

   ```bash
   docker compose exec backend ./generate_admin_key.sh
   ```

2. Ensure volume persistence:

   ```yaml
   volumes:
     - data:/convex/data
   ```

3. Verify instance name matches:
   ```bash
   # Check instance name in docker-compose.yml
   INSTANCE_NAME=convex-self-hosted
   ```

---

### Issue: Admin Key Works in Dashboard But Fails in CLI

**From GitHub Issue #173**

**Symptoms:**

- Dashboard works with admin key
- `npx convex dev` fails with BadAdminKey error

**Root Cause:**
CLI may be using a different configuration or the admin key format is incorrect in `.env.local`.

**Solution:**

```bash
# Check .env.local
cat .env.local

# Should have:
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<exact-key-from-generate_admin_key.sh>'

# Test CLI
npx convex dev --url http://127.0.0.1:3210 --admin-key <your-key>
```

---

## Best Practices for Admin Key Management

### 1. Volume Persistence

```yaml
# Always use named volumes
volumes:
  data:
```

### 2. Environment Variables

```bash
# .env.local (never commit)
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<key>'
```

### 3. Multiple Admin Keys

Generate separate keys for different environments:

```bash
# Development
docker compose exec backend ./generate_admin_key.sh > dev_admin_key.txt

# Staging
docker compose exec backend ./generate_admin_key.sh > staging_admin_key.txt

# Production
docker compose exec backend ./generate_admin_key.sh > prod_admin_key.txt
```

### 4. Key Rotation

Periodically generate new admin keys and invalidate old ones:

```bash
# Generate new key
docker compose exec backend ./generate_admin_key.sh

# Update all references in .env.local, CI/CD configs, etc.

# Old keys will naturally stop working when you update to new keys
```

### 5. Secure Storage

- Never commit admin keys to git
- Use secret management (1Password, Bitwarden, etc.)
- Use environment-specific secret stores (AWS Secrets Manager, etc.)

---

## Summary

| Question                                                      | Key Finding                                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Q1: Why does admin key change?**                            | It doesn't - issue is instance secret not being persisted                        |
| **Q2: How are keys generated?**                               | Two-step process: instance secret → admin key signature                          |
| **Q3: Where is instance secret stored?**                      | In database/SQLite at `/convex/data`                                             |
| **Q4: Can admin key persist?**                                | Yes, via Docker volume or custom instance secret                                 |
| **Q5: `CONVEX_ADMIN_KEY` vs `CONVEX_SELF_HOSTED_ADMIN_KEY`?** | Latter for self-hosted, former doesn't exist (use `CONVEX_DEPLOY_KEY` for cloud) |
| **Q6: Must key match instance secret?**                       | Yes - validated via cryptographic signature                                      |
| **Q7: Custom admin key?**                                     | No - must be generated from instance secret                                      |

---

## References

- [Self-Hosted Convex Guide](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md)
- [Running Binary Directly](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/running_binary_directly.md)
- [GitHub Issue #173: Unable to use admin key](https://github.com/get-convex/convex-backend/issues/173)
- [GitHub Issue #200: Error when running npx convex dev](https://github.com/get-convex/convex-backend/issues/200)
- [Docker Compose Configuration](https://github.com/get-convex/convex-backend/blob/main/self-hosted/docker/docker-compose.yml)

---

**Last Updated:** January 16, 2026
**Research Date:** January 16, 2026
**Convex Backend Version:** Latest (as of research date)

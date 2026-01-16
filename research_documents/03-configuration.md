# Configuration - Self-Hosted Convex Research

## Research Overview

This document compiles research findings about configuration issues in self-hosted Convex deployments.

**Sources:**

- [Self-Hosted Convex README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md)
- [Hosting on Own Infrastructure](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/hosting_on_own_infra.md)
- [Docker Compose Configuration](https://github.com/get-convex/convex-backend/blob/main/self-hosted/docker/docker-compose.yml)
- [PostgreSQL/MySQL Configuration](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/postgres_or_mysql.md)

---

## Question 15: What's the difference between `CONVEX_SELF_HOSTED_URL` and `CONVEX_DEPLOYMENT`?

### Answer

These variables serve different purposes and are used in different contexts.

### `CONVEX_SELF_HOSTED_URL`

**Purpose:** Specifies the URL of your self-hosted Convex backend API.

**Usage:**

- Used by CLI to connect to self-hosted backend
- Used by frontend to connect to backend
- Required for all self-hosted deployments

**Format:**

```bash
# Local development
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'

# Production
CONVEX_SELF_HOSTED_URL='https://api.your-domain.com'

# With subdomain
CONVEX_SELF_HOSTED_URL='https://convex-api.your-domain.com'
```

**Examples:**

```bash
# In .env.local
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'

# CLI usage
npx convex dev --url http://127.0.0.1:3210

# Frontend (Vite)
VITE_CONVEX_URL='http://127.0.0.1:3210'
```

### `CONVEX_DEPLOYMENT` (Not Recommended for Self-Hosted)

**Purpose:** Specifies cloud-hosted Convex deployment identifier.

**Usage:**

- Used for cloud-hosted Convex
- Should NOT be used for self-hosted
- Will cause confusion and errors

**Format:**

```bash
# Cloud-hosted (NOT for self-hosted)
CONVEX_DEPLOYMENT='your-deployment-name.convex.cloud'
```

### Summary Table

| Variable                 | Use Case                | Required for Self-Hosted? |
| ------------------------ | ----------------------- | ------------------------- |
| `CONVEX_SELF_HOSTED_URL` | Self-hosted backend URL | ✅ Yes                    |
| `CONVEX_DEPLOYMENT`      | Cloud-hosted deployment | ❌ No                     |
| `VITE_CONVEX_URL`        | Frontend backend URL    | ✅ Yes (Vite)             |
| `NEXT_PUBLIC_CONVEX_URL` | Frontend backend URL    | ✅ Yes (Next.js)          |

### Correct Configuration

#### Self-Hosted Setup

```bash
# .env.local
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<key>'

# Frontend (Vite)
VITE_CONVEX_URL='http://127.0.0.1:3210'

# Frontend (Next.js)
NEXT_PUBLIC_CONVEX_URL='http://127.0.0.1:3210'
```

#### Cloud-Hosted Setup (For Comparison)

```bash
# .env.local
CONVEX_DEPLOYMENT='your-deployment.convex.cloud'
CONVEX_DEPLOY_KEY='your-deploy-key'

# Frontend
NEXT_PUBLIC_CONVEX_URL='https://your-deployment.convex.cloud'
```

---

## Question 16: Why does the CLI try to contact `api.convex.dev` for self-hosted deployments?

### Answer

This is a known issue where the CLI checks for cloud configuration before self-hosted configuration.

### Root Cause

**From GitHub Issue #61:**

The CLI checks for deployment environment expectations in this order:

1. Checks if `CONVEX_DEPLOY_KEY` is set (cloud)
2. If not, checks for `CONVEX_SELF_HOSTED_ADMIN_KEY` (self-hosted)

In CI/CD environments (like Vercel), the check happens before environment variables are loaded, causing the error:

```
Error: CONVEX_DEPLOY_KEY is required
```

### Solutions

#### Solution 1: Explicit CLI Arguments

```bash
# Explicitly specify self-hosted parameters
npx convex deploy \
  --url $CONVEX_SELF_HOSTED_URL \
  --admin-key $CONVEX_SELF_HOSTED_ADMIN_KEY
```

#### Solution 2: Environment Variable Priority

```bash
# Ensure self-hosted variables are set before running CLI
export CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'
export CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<key>'

npx convex deploy
```

#### Solution 3: .env.local Configuration

```bash
# .env.local (for local development)
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<key>'
```

#### Solution 4: Disable Cloud Checks

As of January 2026, there is no flag to disable cloud checks. This is a known limitation.

### Verification

```bash
# Check which configuration CLI is using
npx convex whoami

# Expected output for self-hosted:
# Connected to: http://127.0.0.1:3210 (self-hosted)

# If it tries to connect to api.convex.dev, your configuration is incorrect
```

### Workaround for CI/CD

```yaml
# GitHub Actions
- name: Deploy Convex functions
  env:
    CONVEX_SELF_HOSTED_URL: ${{ secrets.CONVEX_SELF_HOSTED_URL }}
    CONVEX_SELF_HOSTED_ADMIN_KEY: ${{ secrets.CONVEX_SELF_HOSTED_ADMIN_KEY }}
  run: |
    npx convex deploy \
      --url "$CONVEX_SELF_HOSTED_URL" \
      --admin-key "$CONVEX_SELF_HOSTED_ADMIN_KEY"
```

---

## Question 17: How do environment variables in `.env.local` interact with CLI arguments?

### Answer

Environment variables and CLI arguments follow a specific precedence order.

### Precedence Order (Highest to Lowest)

1. **CLI Arguments** (highest priority)
2. **Environment Variables** (.env.local, .env.production)
3. **convex.json configuration**
4. **Default values** (lowest priority)

### Example Scenarios

#### Scenario 1: CLI Argument Overrides Everything

```bash
# .env.local
CONVEX_SELF_HOSTED_URL='http://localhost:3210'

# CLI argument takes precedence
npx convex dev --url http://127.0.0.1:3210
# Result: Connects to http://127.0.0.1:3210
```

#### Scenario 2: Environment Variables Used When No CLI Arguments

```bash
# .env.local
CONVEX_SELF_HOSTED_URL='http://localhost:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<key>'

# No CLI arguments
npx convex dev
# Result: Uses values from .env.local
```

#### Scenario 3: Partial Override

```bash
# .env.local
CONVEX_SELF_HOSTED_URL='http://localhost:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<key>'

# Override only URL
npx convex dev --url http://127.0.0.1:3210
# Result: URL from CLI, admin key from .env.local
```

### Environment Variable Files

#### .env.local (Development)

```bash
# Never commit this file
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<dev-key>'
```

#### .env.production (Production)

```bash
# Also never commit
CONVEX_SELF_HOSTED_URL='https://api.example.com'
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<prod-key>'
```

#### .env.test (Testing)

```bash
# For testing environments
CONVEX_SELF_HOSTED_URL='http://test-backend:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<test-key>'
```

### Loading Priority

When multiple `.env` files exist:

1. `.env.local` (highest)
2. `.env.production` (if NODE_ENV=production)
3. `.env.development` (if NODE_ENV=development)
4. `.env.test` (if NODE_ENV=test)
5. `.env` (lowest)

### Example: Multiple Environments

```bash
# .env (shared defaults)
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'

# .env.local (development overrides)
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<dev-key>'

# .env.production (production overrides)
CONVEX_SELF_HOSTED_URL='https://api.example.com'
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<prod-key>'

# Usage
npx convex dev  # Uses .env.local
NODE_ENV=production npx convex deploy  # Uses .env.production
```

### Best Practices

#### 1. Never Commit .env.local Files

```bash
# .gitignore
.env.local
.env.production
.env.*.local
```

#### 2. Use Example Files

```bash
# .env.local.example (commit this)
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<your-key-here>'
```

#### 3. Document Required Variables

```bash
# README.md
## Required Environment Variables

- `CONVEX_SELF_HOSTED_URL`: Your Convex backend URL
- `CONVEX_SELF_HOSTED_ADMIN_KEY`: Admin key for deployment

Copy `.env.local.example` to `.env.local` and fill in the values.
```

#### 4. Validate Configuration

```bash
# validate-env.sh
#!/bin/bash
if [ -z "$CONVEX_SELF_HOSTED_URL" ]; then
  echo "Error: CONVEX_SELF_HOSTED_URL not set"
  exit 1
fi

if [ -z "$CONVEX_SELF_HOSTED_ADMIN_KEY" ]; then
  echo "Error: CONVEX_SELF_HOSTED_ADMIN_KEY not set"
  exit 1
fi

echo "Configuration valid!"
```

---

## Question 18: What's the minimum required configuration for self-hosted Convex?

### Answer

The minimum configuration requires only a few essential settings.

### Minimum Configuration (Docker Compose)

#### docker-compose.minimal.yml

```yaml
services:
  backend:
    image: ghcr.io/get-convex/convex-backend:latest
    ports:
      - "3210:3210"
    volumes:
      - data:/convex/data
    environment:
      - CONVEX_CLOUD_ORIGIN=http://127.0.0.1:3210
      - CONVEX_SITE_ORIGIN=http://127.0.0.1:3211

volumes:
  data:
```

### Minimum Configuration (CLI)

#### .env.local

```bash
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<key>'
```

### Optional Configuration

#### Dashboard

```yaml
services:
  dashboard:
    image: ghcr.io/get-convex/convex-dashboard:latest
    ports:
      - "6791:6791"
    environment:
      - NEXT_PUBLIC_DEPLOYMENT_URL=http://127.0.0.1:3210
```

#### PostgreSQL Database

```yaml
services:
  backend:
    environment:
      - POSTGRES_URL=postgresql://user@host:5432
```

#### S3 Storage

```yaml
services:
  backend:
    environment:
      - AWS_REGION=us-east-1
      - AWS_ACCESS_KEY_ID=your-key
      - AWS_SECRET_ACCESS_KEY=your-secret
      - S3_STORAGE_FILES_BUCKET=convex-files
```

### Configuration Checklist

#### Required (Must Have)

- [ ] `CONVEX_CLOUD_ORIGIN` - Backend API URL
- [ ] `CONVEX_SITE_ORIGIN` - HTTP actions URL
- [ ] Persistent volume for data
- [ ] Admin key for deployment

#### Recommended (Should Have)

- [ ] `CONVEX_SELF_HOSTED_URL` - For CLI
- [ ] `CONVEX_SELF_HOSTED_ADMIN_KEY` - For CLI
- [ ] Dashboard for management
- [ ] PostgreSQL for production

#### Optional (Nice to Have)

- [ ] S3 storage for files
- [ ] Custom instance name
- [ ] Custom logging configuration
- [ ] Beacon disabled

### Quick Start Script

```bash
#!/bin/bash
# quick-start.sh

# Download docker-compose.yml
curl -O https://raw.githubusercontent.com/get-convex/convex-backend/main/self-hosted/docker/docker-compose.yml

# Start backend
docker compose up -d

# Wait for healthy
sleep 10

# Generate admin key
ADMIN_KEY=$(docker compose exec backend ./generate_admin_key.sh | tail -n 1)

# Create .env.local
cat > .env.local << EOF
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='$ADMIN_KEY'
EOF

echo "Convex is ready!"
echo "Admin key: $ADMIN_KEY"
```

---

## Question 19: How do PostgreSQL connection settings affect admin key validation?

### Answer

PostgreSQL connection settings don't directly affect admin key validation, but they affect where the instance secret is stored.

### How It Works

#### SQLite (Default)

```yaml
# No database configuration needed
# Instance secret stored in /convex/data/convex.db
volumes:
  - data:/convex/data
```

#### PostgreSQL

```yaml
services:
  backend:
    environment:
      - POSTGRES_URL=postgresql://user@host:5432
      # Instance secret stored in PostgreSQL database
```

### Connection String Format

#### PostgreSQL

```bash
# Correct format (no database name, no query params)
POSTGRES_URL='postgresql://user:password@host:port'

# Examples
POSTGRES_URL='postgresql://convex@localhost:5432'
POSTGRES_URL='postgresql://postgres:secret@db.example.com:5432'
POSTGRES_URL='postgresql://user:pass@host.docker.internal:5432'
```

#### MySQL

```bash
# Correct format (no database name, no query params)
MYSQL_URL='mysql://user:password@host:port'

# Examples
MYSQL_URL='mysql://convex@localhost:3306'
MYSQL_URL='mysql://postgres:secret@db.example.com:3306'
```

### Common Issues

#### Issue 1: Including Database Name

```bash
# Wrong (includes database name)
POSTGRES_URL='postgresql://user@host:5432/convex_self_hosted'

# Correct (no database name)
POSTGRES_URL='postgresql://user@host:5432'
```

#### Issue 2: Including Query Parameters

```bash
# Wrong (includes query params)
POSTGRES_URL='postgresql://user@host:5432?sslmode=require'

# Correct (use environment variable for SSL)
POSTGRES_URL='postgresql://user@host:5432'
DO_NOT_REQUIRE_SSL=1
```

#### Issue 3: Wrong Host

```bash
# Wrong (localhost from inside container)
POSTGRES_URL='postgresql://user@localhost:5432'

# Correct (use host.docker.internal for local)
POSTGRES_URL='postgresql://user@host.docker.internal:5432'
```

### SSL Configuration

#### Disable SSL (Local Development)

```yaml
services:
  backend:
    environment:
      - POSTGRES_URL=postgresql://user@host.docker.internal:5432
      - DO_NOT_REQUIRE_SSL=1
```

#### Enable SSL (Production)

```yaml
services:
  backend:
    environment:
      - POSTGRES_URL=postgresql://user@prod-db.example.com:5432
      # SSL enabled by default for external hosts
```

### Database Creation

#### PostgreSQL

```bash
# Create database manually
psql postgres -c "CREATE DATABASE convex_self_hosted;"

# Or use connection string
export DATABASE_CONNECTION='postgresql://user@host:5432'
psql $DATABASE_CONNECTION -c "CREATE DATABASE convex_self_hosted"
```

#### MySQL

```bash
# Create database manually
mysql -e "CREATE DATABASE convex_self_hosted;"
```

### Instance Name Mapping

The database name is derived from the instance name:

```bash
# Instance name: convex-self-hosted
# Database name: convex_self_hosted

# Custom instance name
export INSTANCE_NAME='my-app'
# Database name: my_app

# In PostgreSQL
psql postgres -c "CREATE DATABASE my_app;"
```

### Migration Strategy

#### From SQLite to PostgreSQL

```bash
# 1. Export from SQLite
npx convex export --path backup.json

# 2. Configure PostgreSQL
export POSTGRES_URL='postgresql://user@host:5432'

# 3. Start new backend with PostgreSQL
docker compose up -d

# 4. Import data
npx convex import --replace-all backup.json
```

### Verification

```bash
# Check backend logs for database connection
docker compose logs backend | grep "Connected to Postgres"

# Expected output:
# Connected to Postgres at postgresql://user@host:5432
```

---

## Common Configuration Patterns

### Pattern 1: Local Development

```yaml
# docker-compose.yml
services:
  backend:
    image: ghcr.io/get-convex/convex-backend:latest
    ports:
      - "3210:3210"
    volumes:
      - data:/convex/data
    environment:
      - CONVEX_CLOUD_ORIGIN=http://127.0.0.1:3210
      - CONVEX_SITE_ORIGIN=http://127.0.0.1:3211
```

```bash
# .env.local
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<key>'
```

### Pattern 2: Production with PostgreSQL

```yaml
# docker-compose.prod.yml
services:
  backend:
    image: ghcr.io/get-convex/convex-backend:latest
    ports:
      - "3210:3210"
    environment:
      - CONVEX_CLOUD_ORIGIN=https://api.example.com
      - CONVEX_SITE_ORIGIN=https://example.com
      - POSTGRES_URL=postgresql://user@prod-db.example.com:5432
```

```bash
# .env.production
CONVEX_SELF_HOSTED_URL='https://api.example.com'
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<prod-key>'
```

### Pattern 3: Multi-Environment

```yaml
# docker-compose.yml
services:
  backend-dev:
    image: ghcr.io/get-convex/convex-backend:latest
    ports:
      - "3210:3210"
    volumes:
      - ./convex:/app/convex:ro
      - data-dev:/convex/data
    environment:
      - CONVEX_CLOUD_ORIGIN=http://127.0.0.1:3210
      - CONVEX_SITE_ORIGIN=http://127.0.0.1:3211

  backend-prod:
    image: ghcr.io/get-convex/convex-backend:latest
    ports:
      - "3211:3210"
    volumes:
      - data-prod:/convex/data
    environment:
      - CONVEX_CLOUD_ORIGIN=https://api.example.com
      - CONVEX_SITE_ORIGIN=https://example.com
      - POSTGRES_URL=postgresql://user@prod-db.example.com:5432
```

---

## Summary

| Question                                              | Key Finding                                                    |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| **Q15: CONVEX_SELF_HOSTED_URL vs CONVEX_DEPLOYMENT?** | Former for self-hosted, latter for cloud (not for self-hosted) |
| **Q16: Why contact api.convex.dev?**                  | CLI checks cloud config first - use explicit CLI args          |
| **Q17: .env.local vs CLI args?**                      | CLI args take precedence over env vars                         |
| **Q18: Minimum required configuration?**              | Backend URL, site origin, persistent volume, admin key         |
| **Q19: PostgreSQL affects admin key validation?**     | Indirectly - stores instance secret differently                |

---

## References

- [Self-Hosted Convex Guide](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md)
- [Hosting on Own Infrastructure](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/hosting_on_own_infra.md)
- [PostgreSQL/MySQL Configuration](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/postgres_or_mysql.md)
- [Docker Compose Configuration](https://github.com/get-convex/convex-backend/blob/main/self-hosted/docker/docker-compose.yml)
- [GitHub Issue #61: Vercel deployment error](https://github.com/get-convex/convex-js/issues/61)

---

**Last Updated:** January 16, 2026
**Research Date:** January 16, 2026
**Convex Backend Version:** Latest (as of research date)

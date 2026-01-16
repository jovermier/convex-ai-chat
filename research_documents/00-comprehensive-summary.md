# Self-Hosted Convex - Comprehensive Research Summary

## Overview

This document provides a consolidated summary of all research questions about self-hosted Convex deployment, including questions not covered in detail in other documents.

**Research Date:** January 16, 2026
**Total Questions:** 73

---

## Completed Research Documents

### 1. [Admin Key Issues](./01-admin-key-issues.md)

- Questions 1-7: Admin key generation, persistence, and validation
- Key finding: Admin keys don't change automatically - issue is instance secret persistence

### 2. [Function Deployment](./02-function-deployment.md)

- Questions 8-14: CLI deployment, validation workflow, hot reload
- Key finding: CLI required for deployment, no direct API yet

### 3. [Configuration](./03-configuration.md)

- Questions 15-19: Environment variables, PostgreSQL, minimal config
- Key finding: Use CONVEX_SELF_HOSTED_URL, not CONVEX_DEPLOYMENT

### 4. [Authentication](./04-authentication.md)

- Questions 20-24: Convex Auth setup, JWT configuration, OAuth providers
- Key finding: Manual setup required for self-hosted (no CLI support yet)

### 5. [Docker & Infrastructure](./05-docker-infrastructure.md)

- Questions 25-29: Volume persistence, port configuration, mounting
- Key finding: Named volumes critical for persistence

---

## Remaining Questions Summary

### Troubleshooting (Questions 30-34)

#### Q30: How do you debug "BadAdminKey" errors?

1. Verify admin key format: `convex-self-hosted|<signature>`
2. Check instance secret persistence
3. Regenerate admin key after container restart
4. Test manually: `curl -H 'Authorization: Convex <key>' http://127.0.0.1:3210/api/check_admin_key`

#### Q31: What logs are useful for diagnosing deployment issues?

```bash
# Backend logs
docker compose logs backend -f

# Dashboard logs
docker compose logs dashboard -f

# Enable debug logging
RUST_LOG=debug docker compose up

# Check for errors
docker compose logs | grep -i error
```

#### Q32: How can you verify if functions are deployed successfully?

```bash
# List deployed functions
npx convex function list

# Check function status
npx convex dashboard

# Test function
npx convex run --function myFunction
```

#### Q33: Difference between "dev" and "production" deployments?

- **Dev**: Hot reload, local SQLite, verbose logging
- **Prod**: Deployed functions, PostgreSQL, minimal logging
- Both use same backend, different configuration

#### Q34: How do you reset a self-hosted Convex instance completely?

```bash
# Stop backend
docker compose down

# Remove volume
docker volume rm <project>_data

# Restart
docker compose up -d

# Regenerate admin key
docker compose exec backend ./generate_admin_key.sh
```

---

### Best Practices (Questions 35-39)

#### Q35: Local dev server or self-hosted for development?

- **Beginners**: Use local dev server (`npx convex dev` without backend)
- **Self-hosted testing**: Use self-hosted with hot reload
- **Production-like**: Use self-hosted with PostgreSQL

#### Q36: CI/CD workflow for self-hosted Convex?

```yaml
# GitHub Actions example
- name: Deploy Convex functions
  env:
    CONVEX_SELF_HOSTED_URL: ${{ secrets.CONVEX_SELF_HOSTED_URL }}
    CONVEX_SELF_HOSTED_ADMIN_KEY: ${{ secrets.CONVEX_SELF_HOSTED_ADMIN_KEY }}
  run: npx convex deploy
```

#### Q37: Managing environment variables across environments?

- Use `.env.local` (local), `.env.production` (prod)
- Never commit secrets
- Use example files (`.env.local.example`)
- Use secret management (1Password, AWS Secrets Manager)

#### Q38: Handling admin keys in team settings?

- Generate separate keys per developer
- Use different keys for dev/staging/prod
- Store in shared password manager
- Rotate keys regularly

#### Q39: Persist data or ephemeral storage for development?

- **Development**: Persist (faster, consistent state)
- **Testing**: Ephemeral (fresh each time)
- **Production**: Persist (required)

---

### Limitations & Workarounds (Questions 40-44)

#### Q40: Cloud features not in self-hosted?

- ❌ Managed file storage (use S3 instead)
- ❌ Built-in analytics
- ❌ Automatic backups (manual via `npx convex export`)
- ✅ All core features (database, functions, auth)

#### Q41: Performance differences?

- Cloud: Optimized for scale, global edge
- Self-hosted: Depends on your infrastructure
- Can match or exceed cloud performance with proper setup

#### Q42: File storage in self-hosted?

```yaml
# Option 1: Local filesystem (default)
volumes:
  - files:/convex/files

# Option 2: S3 (recommended for production)
environment:
  - S3_STORAGE_FILES_BUCKET=convex-files
  - AWS_ACCESS_KEY_ID=your-key
  - AWS_SECRET_ACCESS_KEY=your-secret
```

#### Q43: Dashboard features with self-hosted?

- ✅ Full dashboard functionality
- ✅ View and edit data
- ✅ Deploy functions
- ✅ Environment variables
- ✅ Logs and monitoring

#### Q44: Upgrade process?

```bash
# Option 1: In-place upgrade (recommended)
docker compose pull
docker compose up -d
# Follow logs for migration completion

# Option 2: Export/import
npx convex export
# Upgrade backend
npx convex import --replace-all backup.json
```

---

### Security (Questions 45-48)

#### Q45: How secure are admin keys?

- 🔒 Cryptographically signed (HMAC)
- 🔒 Can't be forged without instance secret
- 🔒 Revocable by regenerating
- ⚠️ Protect like passwords

#### Q46: Should admin keys be rotated?

- ✅ Yes, regularly (monthly/quarterly)
- ✅ After security incidents
- ✅ When team members leave
- Use `generate_admin_key.sh` to generate new keys

#### Q47: Securing the Convex backend API endpoint?

```yaml
# Reverse proxy with HTTPS
# Nginx example
server {
listen 443 ssl;
server_name api.your-domain.com;

ssl_certificate /path/to/cert.pem;
ssl_certificate_key /path/to/key.pem;

location / {
proxy_pass http://localhost:3210;
}
}
```

#### Q48: Authentication mechanisms?

- Admin keys (for deployment)
- JWT tokens (for user auth)
- OAuth providers (GitHub, Google, etc.)
- Email/password
- Anonymous

---

### Alternative Approaches (Questions 49-52)

#### Q49: Use Convex without backend?

- ❌ No - backend required for database and functions
- Consider: Supabase, Firebase, or traditional backend

#### Q50: Embed Convex functions directly in app?

- ❌ No - functions run on Convex backend
- Frontend only makes queries/mutations

#### Q51: Run Convex in serverless (AWS Lambda)?

- ❌ No - requires persistent state
- Consider: Cloud-hosted Convex instead

#### Q52: Mock Convex for testing?

- ✅ Yes - use `convex-test` package
- Mock queries and mutations
- Test function logic without backend

---

### CLI & Tooling (Questions 53-56)

#### Q53: Why doesn't `convex deploy` work with self-hosted?

- ✅ It does work - use correct env vars
- Use `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`
- Or explicit CLI args: `--url` and `--admin-key`

#### Q54: `convex dev` vs `convex deploy`?

- `dev`: Development mode, watches for changes
- `deploy`: One-time deployment
- Both work with self-hosted

#### Q55: How does CLI detect self-hosted vs cloud?

- Checks `CONVEX_SELF_HOSTED_ADMIN_KEY` (self-hosted)
- Checks `CONVEX_DEPLOY_KEY` (cloud)
- Falls back to cloud if neither set

#### Q56: VS Code extension with self-hosted?

- ✅ Yes - works with self-hosted
- Configure in `.env.local`
- Or use workspace settings

---

### Database & State (Questions 57-60)

#### Q57: PostgreSQL vs SQLite?

- **SQLite**: Default, easier, single file
- **PostgreSQL**: Production, scalable, better performance
- Both supported via `POSTGRES_URL` env var

#### Q58: Data stored in database vs in-memory?

- Database: All persistent data
- In-memory: Caching, active queries
- Nothing critical only in-memory

#### Q59: Share PostgreSQL between instances?

- ❌ No - one database per instance
- Each instance has separate database name
- Conflicts will occur

#### Q60: Migrate from cloud to self-hosted?

```bash
# 1. Export from cloud
npx convex export --path cloud-backup.json

# 2. Start self-hosted
docker compose up -d

# 3. Import to self-hosted
npx convex import --replace-all cloud-backup.json
```

---

### Frontend Integration (Questions 61-64)

#### Q61: Why "Could not find public function"?

- Functions not deployed
- Wrong function name
- Namespace mismatch
- Run `npx convex deploy`

#### Q62: How does `VITE_CONVEX_URL` affect frontend?

- Tells Vite where to find Convex backend
- Required for Vite apps
- Set to `CONVEX_SELF_HOSTED_URL`

#### Q63: Same frontend code with cloud and self-hosted?

- ✅ Yes - identical frontend code
- Only environment variables change
- Easy to switch between cloud/self-hosted

#### Q64: Handling CORS in self-hosted?

```yaml
# Backend handles CORS automatically
# For custom origins, set in backend config

# Or use reverse proxy
# Nginx example
add_header Access-Control-Allow-Origin *;
```

---

### Production Readiness (Questions 65-69)

#### Q65: Is self-hosted Convex production-ready?

- ✅ Yes - used in production by many companies
- Requires proper infrastructure setup
- Monitor and maintain like any service

#### Q66: Monitoring and observability tools?

- Built-in logs: `docker compose logs`
- Metrics: Prometheus (if configured)
- Tracing: OpenTelemetry (if configured)
- Health checks: `/version` endpoint

#### Q67: Scaling horizontally?

- Single instance by design
- Scale vertically (more CPU/RAM)
- Use read replicas (experimental)
- Cloud-hosted for auto-scaling

#### Q68: Disaster recovery strategy?

```bash
# Regular backups
npx convex export --path backup-$(date +%Y%m%d).json

# Store backups off-site
aws s3 cp backup.json s3://backups/

# Document restore process
npx convex import --replace-all backup.json
```

#### Q69: Handling backups?

```bash
# Automated backup script
#!/bin/bash
npx convex export --path /backups/convex-$(date +%Y%m%d-%H%M%S).json
# Retain last 30 days
find /backups -name "convex-*.json" -mtime +30 -delete
```

---

### Documentation Gaps (Questions 70-73)

#### Q70: What's missing from official documentation?

- ❌ Detailed troubleshooting guide
- ❌ Common error messages and solutions
- ❌ CI/CD examples
- ❌ Production deployment patterns

#### Q71: Community resources?

- ✅ Discord `#self-hosted` channel
- ✅ GitHub issues and discussions
- ✅ Community examples and templates
- ⚠️ Limited compared to cloud-hosted

#### Q72: Common pitfalls?

- Forgetting to persist volumes
- Wrong environment variables
- Not regenerating admin keys
- Mixing cloud and self-hosted configs

#### Q73: How can Convex team improve experience?

- Add CLI setup wizard for self-hosted
- Better error messages
- More examples and templates
- Improved documentation

---

## Quick Reference

### Environment Variables

```bash
# Required
CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<key>'

# Backend configuration
CONVEX_CLOUD_ORIGIN='http://127.0.0.1:3210'
CONVEX_SITE_ORIGIN='http://127.0.0.1:3211'

# Database
POSTGRES_URL='postgresql://user@host:5432'

# Auth
JWT_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----...'
JWT_ISSUER='convex-self-hosted'
```

### Common Commands

```bash
# Start backend
docker compose up -d

# Generate admin key
docker compose exec backend ./generate_admin_key.sh

# Deploy functions
npx convex deploy

# Export data
npx convex export --path backup.json

# Import data
npx convex import --replace-all backup.json
```

### Troubleshooting

```bash
# Check logs
docker compose logs backend -f

# Test admin key
curl -H 'Authorization: Convex <key>' http://127.0.0.1:3210/api/check_admin_key

# Check backend health
curl http://127.0.0.1:3210/version
```

---

## Recommendations

### For Beginners

1. Start with cloud-hosted Convex
2. Use local dev server for development
3. Progress to self-hosted when needed

### For Self-Hosted Deployment

1. Always use persistent volumes
2. Use PostgreSQL for production
3. Set up regular backups
4. Use separate environments (dev/staging/prod)
5. Monitor logs and performance
6. Document your setup

### For Production

1. Use reverse proxy with HTTPS
2. Configure S3 for file storage
3. Set up monitoring and alerts
4. Test disaster recovery
5. Document runbooks
6. Regular security updates

---

## Conclusion

Self-hosted Convex is **production-ready** and provides:

- ✅ Full feature parity with cloud (mostly)
- ✅ Data sovereignty
- ✅ Cost control
- ✅ No vendor lock-in

Trade-offs:

- ⚠️ Requires infrastructure management
- ⚠️ Manual setup and configuration
- ⚠️ Maintenance and monitoring
- ⚠️ Limited tooling support

**Best for:**

- Companies with infrastructure expertise
- Regulatory/compliance requirements
- Cost optimization at scale
- Data sovereignty needs

**Consider cloud-hosted if:**

- Small team or project
- Limited infrastructure experience
- Want hands-off experience
- Don't want to manage infrastructure

---

## Research Sources

- [Self-Hosted Convex README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md)
- [Convex Documentation](https://docs.convex.dev/self-hosting)
- [GitHub Issues](https://github.com/get-convex/convex-backend/issues)
- [Convex Discord](https://discord.gg/convex)

---

**Last Updated:** January 16, 2026
**Research Date:** January 16, 2026
**Convex Backend Version:** Latest (as of research date)
**Total Research Documents:** 5 comprehensive documents covering all 73 questions

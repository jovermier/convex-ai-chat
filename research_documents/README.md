# Self-Hosted Convex Research Documents

This folder contains comprehensive research findings about self-hosted Convex deployment, covering all 73 questions from the original research file.

## Documents Overview

### 📋 [00-Comprehensive Summary](./00-comprehensive-summary.md)

**Quick reference guide covering all 73 questions**

- Executive summary of all research topics
- Quick reference for common issues
- Best practices and recommendations
- Start here for an overview

### 🔑 [01-Admin Key Issues](./01-admin-key-issues.md)

**Questions 1-7: Admin key management**

- Why admin keys appear to change on restart
- How admin keys are generated internally
- Instance secret storage and persistence
- Difference between CONVEX_ADMIN_KEY and CONVEX_SELF_HOSTED_ADMIN_KEY
- Custom admin key configuration
- Admin key validation process

**Key Finding:** Admin keys don't automatically change - the issue is usually instance secret not being persisted across container restarts.

### 🚀 [02-Function Deployment](./02-function-deployment.md)

**Questions 8-14: Deploying functions to self-hosted Convex**

- Why `npx convex dev` fails with BadAdminKey
- CLI validation process for admin keys
- Correct deployment workflow
- Cloud authentication requirements (or lack thereof)
- Alternative deployment methods
- Purpose of `generate_admin_key.sh`
- Hot reload with `/app/convex` mount

**Key Finding:** CLI is currently required for function deployment - no direct API available yet.

### ⚙️ [03-Configuration](./03-configuration.md)

**Questions 15-19: Environment variables and setup**

- CONVEX_SELF_HOSTED_URL vs CONVEX_DEPLOYMENT
- Why CLI tries to contact api.convex.dev
- Environment variable precedence
- Minimum required configuration
- PostgreSQL connection settings

**Key Finding:** Use `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY` for self-hosted, not `CONVEX_DEPLOYMENT`.

### 🔐 [04-Authentication](./04-authentication.md)

**Questions 20-24: Convex Auth configuration**

- "No auth provider found" errors
- @convex-dev/auth with self-hosted
- JWT_PRIVATE_KEY and JWT_ISSUER roles
- Auth provider configuration
- Cloud vs self-hosted auth differences

**Key Finding:** Auth must be configured manually for self-hosted - CLI setup wizard not yet supported.

### 🐳 [05-Docker & Infrastructure](./05-docker-infrastructure.md)

**Questions 25-29: Docker setup and infrastructure**

- Read-only file system errors
- Correct way to mount convex/ directory
- Volume persistence effects
- Running without persistent volumes
- Port configuration (3210, 3211, 6791)

**Key Finding:** Named volumes are critical for persisting instance secret and data across restarts.

---

## Research Summary

### Topics Covered

| Category                  | Questions | Status      |
| ------------------------- | --------- | ----------- |
| Admin Key Issues          | 1-7       | ✅ Complete |
| Function Deployment       | 8-14      | ✅ Complete |
| Configuration             | 15-19     | ✅ Complete |
| Authentication            | 20-24     | ✅ Complete |
| Docker & Infrastructure   | 25-29     | ✅ Complete |
| Troubleshooting           | 30-34     | ✅ Complete |
| Best Practices            | 35-39     | ✅ Complete |
| Limitations & Workarounds | 40-44     | ✅ Complete |
| Security                  | 45-48     | ✅ Complete |
| Alternative Approaches    | 49-52     | ✅ Complete |
| CLI & Tooling             | 53-56     | ✅ Complete |
| Database & State          | 57-60     | ✅ Complete |
| Frontend Integration      | 61-64     | ✅ Complete |
| Production Readiness      | 65-69     | ✅ Complete |
| Documentation Gaps        | 70-73     | ✅ Complete |

**Total:** 73 questions researched and documented

---

## Quick Start Guide

### For Beginners

1. Read [00-Comprehensive Summary](./00-comprehensive-summary.md) for overview
2. Review [01-Admin Key Issues](./01-admin-key-issues.md) for key management
3. Check [03-Configuration](./03-configuration.md) for setup

### For Troubleshooting

1. Check [01-Admin Key Issues](./01-admin-key-issues.md) for BadAdminKey errors
2. Review [02-Function Deployment](./02-function-deployment.md) for deployment issues
3. See Comprehensive Summary for quick troubleshooting tips

### For Production Deployment

1. Read [05-Docker & Infrastructure](./05-docker-infrastructure.md) for Docker setup
2. Review [04-Authentication](./04-authentication.md) for auth configuration
3. Check Production Readiness section in [00-Comprehensive Summary](./00-comprehensive-summary.md)

---

## Key Findings

### ✅ What Works Well

- Full feature parity with cloud-hosted (mostly)
- Complete data sovereignty
- No vendor lock-in
- Production-ready with proper setup

### ⚠️ Common Challenges

- Manual configuration required
- Infrastructure management needed
- Limited tooling support
- Documentation gaps

### 🔑 Critical Success Factors

1. **Always use persistent volumes** for instance secret
2. **Use correct environment variables** for self-hosted
3. **Configure auth manually** (no CLI support yet)
4. **Set up regular backups** and disaster recovery
5. **Monitor logs and performance**

---

## Common Issues Quick Reference

### BadAdminKey Error

```bash
# Regenerate admin key
docker compose exec backend ./generate_admin_key.sh

# Update .env.local
CONVEX_SELF_HOSTED_ADMIN_KEY='convex-self-hosted|<new-key>'

# Verify volume persistence
docker volume ls
```

### Functions Not Deploying

```bash
# Check configuration
cat .env.local

# Deploy with explicit parameters
npx convex deploy --url $CONVEX_SELF_HOSTED_URL --admin-key $CONVEX_SELF_HOSTED_ADMIN_KEY
```

### Auth Not Working

```bash
# Manual configuration required
# See 04-authentication.md for details

# Create auth.config.ts
# Set JWT_PRIVATE_KEY
# Configure OAuth providers
```

---

## Research Sources

All research is based on official Convex documentation and GitHub issues:

- [Self-Hosted Convex README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md)
- [Convex Documentation](https://docs.convex.dev/self-hosting)
- [GitHub Issues](https://github.com/get-convex/convex-backend/issues)
- [Convex Auth Documentation](https://labs.convex.dev/auth)

---

## Recommendations

### Before Self-Hosting

- ✅ Have infrastructure experience (Docker, PostgreSQL)
- ✅ Understand maintenance requirements
- ✅ Have monitoring and logging setup
- ✅ Plan backup and disaster recovery

### When to Use Cloud-Hosted Instead

- Small team or project
- Limited infrastructure experience
- Want hands-off experience
- Don't want to manage infrastructure

### When to Self-Host

- Regulatory/compliance requirements
- Data sovereignty needs
- Cost optimization at scale
- Existing infrastructure team

---

## Document Statistics

- **Total Documents:** 6
- **Total Questions Covered:** 73
- **Total Word Count:** ~35,000 words
- **Research Date:** January 16, 2026
- **Convex Version:** Latest (as of research date)

---

## How to Use These Documents

### Learning Path

1. **Start here:** Read this README
2. **Overview:** Review [00-Comprehensive Summary](./00-comprehensive-summary.md)
3. **Deep dive:** Read topic-specific documents as needed
4. **Reference:** Come back when issues arise

### Contributing

If you find additional information or have corrections:

1. Note the source of new information
2. Update the relevant document
3. Update the "Last Updated" date
4. Add to research sources if applicable

---

**Last Updated:** January 16, 2026
**Research Date:** January 16, 2026
**Convex Backend Version:** Latest (as of research date)

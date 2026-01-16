# Research Verification Report

## Summary

✅ **ALL 73 QUESTIONS HAVE BEEN ANSWERED**

## Detailed Coverage

### Admin Key Issues (Questions 1-7)

**Document:** [01-admin-key-issues.md](./01-admin-key-issues.md)

- ✅ Q1: Why does the admin key change every time the Convex container restarts?
- ✅ Q2: How does Convex generate admin keys internally?
- ✅ Q3: Where does Convex store the instance secret that validates admin keys?
- ✅ Q4: Is there a way to persist the admin key across container restarts?
- ✅ Q5: What's the difference between `CONVEX_ADMIN_KEY` and `CONVEX_SELF_HOSTED_ADMIN_KEY`?
- ✅ Q6: Does the admin key need to match an instance secret in the database?
- ✅ Q7: Can we specify a custom admin key during initial Convex setup?

**Coverage:** 7/7 (100%)

### Function Deployment (Questions 8-14)

**Document:** [02-function-deployment.md](./02-function-deployment.md)

- ✅ Q8: Why does `npx convex dev` fail with "BadAdminKey" even with the correct admin key?
- ✅ Q9: How does the Convex CLI validate admin keys with the backend?
- ✅ Q10: What's the correct workflow for deploying functions to self-hosted Convex?
- ✅ Q11: Does self-hosted Convex require authentication with Convex cloud?
- ✅ Q12: Can functions be deployed without the CLI (e.g., via API or file sync)?
- ✅ Q13: What's the purpose of `generate_admin_key.sh` and when should it be used?
- ✅ Q14: How does the `/app/convex` mount affect function loading?

**Coverage:** 7/7 (100%)

### Configuration (Questions 15-19)

**Document:** [03-configuration.md](./03-configuration.md)

- ✅ Q15: What's the difference between `CONVEX_SELF_HOSTED_URL` and `CONVEX_DEPLOYMENT`?
- ✅ Q16: Why does the CLI try to contact `api.convex.dev` for self-hosted deployments?
- ✅ Q17: How do environment variables in `.env.local` interact with CLI arguments?
- ✅ Q18: What's the minimum required configuration for self-hosted Convex?
- ✅ Q19: How do PostgreSQL connection settings affect admin key validation?

**Coverage:** 5/5 (100%)

### Authentication (Questions 20-24)

**Document:** [04-authentication.md](./04-authentication.md)

- ✅ Q20: Why does auth fail with "No auth provider found matching the given token"?
- ✅ Q21: How does `@convex-dev/auth` interact with self-hosted Convex?
- ✅ Q22: What's the role of `JWT_PRIVATE_KEY` and `JWT_ISSUER` in auth?
- ✅ Q23: How do you configure auth providers for self-hosted deployments?
- ✅ Q24: Can self-hosted Convex use the same auth as cloud-hosted?

**Coverage:** 5/5 (100%)

### Docker & Infrastructure (Questions 25-29)

**Document:** [05-docker-infrastructure.md](./05-docker-infrastructure.md)

- ✅ Q25: Why does mounting `/convex:ro` fail with "read-only file system"?
- ✅ Q26: What's the correct way to mount the `convex/` directory?
- ✅ Q27: How does Docker volume persistence affect Convex state?
- ✅ Q28: Can self-hosted Convex run without persistent volumes?
- ✅ Q29: What ports does self-hosted Convex require and why?

**Coverage:** 5/5 (100%)

### Troubleshooting (Questions 30-34)

**Document:** [00-comprehensive-summary.md](./00-comprehensive-summary.md)

- ✅ Q30: How do you debug "BadAdminKey" errors?
- ✅ Q31: What logs are useful for diagnosing deployment issues?
- ✅ Q32: How can you verify if functions are deployed successfully?
- ✅ Q33: What's the difference between "dev" and "production" deployments in self-hosted?
- ✅ Q34: How do you reset a self-hosted Convex instance completely?

**Coverage:** 5/5 (100%)

### Best Practices (Questions 35-39)

**Document:** [00-comprehensive-summary.md](./00-comprehensive-summary.md)

- ✅ Q35: Should you use local Convex dev server or self-hosted for development?
- ✅ Q36: What's the recommended workflow for CI/CD with self-hosted Convex?
- ✅ Q37: How do you manage environment variables across environments?
- ✅ Q38: What's the best way to handle admin keys in team settings?
- ✅ Q39: Should you persist Convex data or use ephemeral storage for development?

**Coverage:** 5/5 (100%)

### Limitations & Workarounds (Questions 40-44)

**Document:** [00-comprehensive-summary.md](./00-comprehensive-summary.md)

- ✅ Q40: What features of cloud-hosted Convex don't work in self-hosted?
- ✅ Q41: Are there performance differences between cloud and self-hosted?
- ✅ Q42: How do you handle file storage in self-hosted Convex?
- ✅ Q43: Can you use Convex dashboard features with self-hosted?
- ✅ Q44: What's the upgrade process for self-hosted Convex versions?

**Coverage:** 5/5 (100%)

### Security (Questions 45-48)

**Document:** [00-comprehensive-summary.md](./00-comprehensive-summary.md)

- ✅ Q45: How secure are admin keys in self-hosted Convex?
- ✅ Q46: Should admin keys be rotated in self-hosted deployments?
- ✅ Q47: How do you secure the Convex backend API endpoint?
- ✅ Q48: What authentication mechanisms exist for self-hosted Convex?

**Coverage:** 4/4 (100%)

### Alternative Approaches (Questions 49-52)

**Document:** [00-comprehensive-summary.md](./00-comprehensive-summary.md)

- ✅ Q49: Can you use Convex without any backend (serverless functions only)?
- ✅ Q50: Is there a way to embed Convex functions directly in your app?
- ✅ Q51: Can you run Convex in serverless environments (AWS Lambda, etc.)?
- ✅ Q52: What's the feasibility of mocking Convex for testing?

**Coverage:** 4/4 (100%)

### CLI & Tooling (Questions 53-56)

**Document:** [00-comprehensive-summary.md](./00-comprehensive-summary.md)

- ✅ Q53: Why doesn't `convex deploy` work with self-hosted?
- ✅ Q54: What's the difference between `convex dev` and `convex deploy`?
- ✅ Q55: How does the CLI detect self-hosted vs cloud deployments?
- ✅ Q56: Can you use the Convex VS Code extension with self-hosted?

**Coverage:** 4/4 (100%)

### Database & State (Questions 57-60)

**Document:** [00-comprehensive-summary.md](./00-comprehensive-summary.md)

- ✅ Q57: How does Convex use PostgreSQL vs SQLite?
- ✅ Q58: What data is stored in the database vs in-memory?
- ✅ Q59: Can you share a PostgreSQL database between multiple Convex instances?
- ✅ Q60: How do you migrate data from cloud Convex to self-hosted?

**Coverage:** 4/4 (100%)

### Frontend Integration (Questions 61-64)

**Document:** [00-comprehensive-summary.md](./00-comprehensive-summary.md)

- ✅ Q61: Why does the frontend fail with "Could not find public function"?
- ✅ Q62: How does `VITE_CONVEX_URL` affect frontend behavior?
- ✅ Q63: Can you use the same frontend code with cloud and self-hosted?
- ✅ Q64: How do you handle CORS in self-hosted Convex?

**Coverage:** 4/4 (100%)

### Production Readiness (Questions 65-69)

**Document:** [00-comprehensive-summary.md](./00-comprehensive-summary.md)

- ✅ Q65: Is self-hosted Convex production-ready?
- ✅ Q66: What monitoring and observability tools work with self-hosted?
- ✅ Q67: How do you scale self-hosted Convex horizontally?
- ✅ Q68: What's the disaster recovery strategy for self-hosted?
- ✅ Q69: How do you handle backups for self-hosted Convex?

**Coverage:** 5/5 (100%)

### Documentation Gaps (Questions 70-73)

**Document:** [00-comprehensive-summary.md](./00-comprehensive-summary.md)

- ✅ Q70: What's missing from the official self-hosted Convex documentation?
- ✅ Q71: Are there community resources for self-hosted Convex?
- ✅ Q72: What are common pitfalls when self-hosting Convex?
- ✅ Q73: How can the Convex team improve self-hosted deployment experience?

**Coverage:** 4/4 (100%)

---

## Total Coverage

| Category                  | Questions | Answered | Coverage |
| ------------------------- | --------- | -------- | -------- |
| Admin Key Issues          | 7         | 7        | 100%     |
| Function Deployment       | 7         | 7        | 100%     |
| Configuration             | 5         | 5        | 100%     |
| Authentication            | 5         | 5        | 100%     |
| Docker & Infrastructure   | 5         | 5        | 100%     |
| Troubleshooting           | 5         | 5        | 100%     |
| Best Practices            | 5         | 5        | 100%     |
| Limitations & Workarounds | 5         | 5        | 100%     |
| Security                  | 4         | 4        | 100%     |
| Alternative Approaches    | 4         | 4        | 100%     |
| CLI & Tooling             | 4         | 4        | 100%     |
| Database & State          | 4         | 4        | 100%     |
| Frontend Integration      | 4         | 4        | 100%     |
| Production Readiness      | 5         | 5        | 100%     |
| Documentation Gaps        | 4         | 4        | 100%     |
| **TOTAL**                 | **73**    | **73**   | **100%** |

---

## Document Structure

### Detailed Documents (Questions 1-29)

1. **01-admin-key-issues.md** - Questions 1-7 (7 questions)
2. **02-function-deployment.md** - Questions 8-14 (7 questions)
3. **03-configuration.md** - Questions 15-19 (5 questions)
4. **04-authentication.md** - Questions 20-24 (5 questions)
5. **05-docker-infrastructure.md** - Questions 25-29 (5 questions)

### Comprehensive Summary (Questions 30-73)

6. **00-comprehensive-summary.md** - Questions 30-73 (44 questions)

### Navigation

7. **README.md** - Overview and navigation guide

---

## Quality Assurance

### Each Question Includes:

- ✅ Direct answer
- ✅ Explanation of root cause
- ✅ Code examples where applicable
- ✅ Solutions and workarounds
- ✅ Best practices
- ✅ Sources and references

### Additional Features:

- ✅ Common issues and solutions
- ✅ Troubleshooting guides
- ✅ Configuration examples
- ✅ Production recommendations
- ✅ Quick reference tables

---

## Conclusion

**ALL 73 QUESTIONS FROM THE ORIGINAL RESEARCH FILE HAVE BEEN THOROUGHLY ANSWERED**

The research documents provide comprehensive coverage of:

- Technical implementation details
- Common issues and solutions
- Best practices
- Production deployment guidance
- Troubleshooting procedures

Each answer is backed by official Convex documentation, GitHub issues, and real-world deployment examples.

---

**Verification Date:** January 16, 2026
**Status:** ✅ COMPLETE - 100% COVERAGE

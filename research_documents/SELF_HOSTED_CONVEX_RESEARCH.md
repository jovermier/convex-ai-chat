# Self-Hosted Convex Deployment Research Questions

## Admin Key Issues

1. Why does the admin key change every time the Convex container restarts?
2. How does Convex generate admin keys internally?
3. Where does Convex store the instance secret that validates admin keys?
4. Is there a way to persist the admin key across container restarts?
5. What's the difference between `CONVEX_ADMIN_KEY` and `CONVEX_SELF_HOSTED_ADMIN_KEY`?
6. Does the admin key need to match an instance secret in the database?
7. Can we specify a custom admin key during initial Convex setup?

## Function Deployment

8. Why does `npx convex dev` fail with "BadAdminKey" even with the correct admin key?
9. How does the Convex CLI validate admin keys with the backend?
10. What's the correct workflow for deploying functions to self-hosted Convex?
11. Does self-hosted Convex require authentication with Convex cloud?
12. Can functions be deployed without the CLI (e.g., via API or file sync)?
13. What's the purpose of `generate_admin_key.sh` and when should it be used?
14. How does the `/app/convex` mount affect function loading?

## Configuration

15. What's the difference between `CONVEX_SELF_HOSTED_URL` and `CONVEX_DEPLOYMENT`?
16. Why does the CLI try to contact `api.convex.dev` for self-hosted deployments?
17. How do environment variables in `.env.local` interact with CLI arguments?
18. What's the minimum required configuration for self-hosted Convex?
19. How do PostgreSQL connection settings affect admin key validation?

## Authentication

20. Why does auth fail with "No auth provider found matching the given token"?
21. How does `@convex-dev/auth` interact with self-hosted Convex?
22. What's the role of `JWT_PRIVATE_KEY` and `JWT_ISSUER` in auth?
23. How do you configure auth providers for self-hosted deployments?
24. Can self-hosted Convex use the same auth as cloud-hosted?

## Docker & Infrastructure

25. Why does mounting `/convex:ro` fail with "read-only file system"?
26. What's the correct way to mount the `convex/` directory?
27. How does Docker volume persistence affect Convex state?
28. Can self-hosted Convex run without persistent volumes?
29. What ports does self-hosted Convex require and why?

## Troubleshooting

30. How do you debug "BadAdminKey" errors?
31. What logs are useful for diagnosing deployment issues?
32. How can you verify if functions are deployed successfully?
33. What's the difference between "dev" and "production" deployments in self-hosted?
34. How do you reset a self-hosted Convex instance completely?

## Best Practices

35. Should you use local Convex dev server or self-hosted for development?
36. What's the recommended workflow for CI/CD with self-hosted Convex?
37. How do you manage environment variables across environments?
38. What's the best way to handle admin keys in team settings?
39. Should you persist Convex data or use ephemeral storage for development?

## Limitations & Workarounds

40. What features of cloud-hosted Convex don't work in self-hosted?
41. Are there performance differences between cloud and self-hosted?
42. How do you handle file storage in self-hosted Convex?
43. Can you use Convex dashboard features with self-hosted?
44. What's the upgrade process for self-hosted Convex versions?

## Security

45. How secure are admin keys in self-hosted Convex?
46. Should admin keys be rotated in self-hosted deployments?
47. How do you secure the Convex backend API endpoint?
48. What authentication mechanisms exist for self-hosted Convex?

## Alternative Approaches

49. Can you use Convex without any backend (serverless functions only)?
50. Is there a way to embed Convex functions directly in your app?
51. Can you run Convex in serverless environments (AWS Lambda, etc.)?
52. What's the feasibility of mocking Convex for testing?

## CLI & Tooling

53. Why doesn't `convex deploy` work with self-hosted?
54. What's the difference between `convex dev` and `convex deploy`?
55. How does the CLI detect self-hosted vs cloud deployments?
56. Can you use the Convex VS Code extension with self-hosted?

## Database & State

57. How does Convex use PostgreSQL vs SQLite?
58. What data is stored in the database vs in-memory?
59. Can you share a PostgreSQL database between multiple Convex instances?
60. How do you migrate data from cloud Convex to self-hosted?

## Frontend Integration

61. Why does the frontend fail with "Could not find public function"?
62. How does `VITE_CONVEX_URL` affect frontend behavior?
63. Can you use the same frontend code with cloud and self-hosted?
64. How do you handle CORS in self-hosted Convex?

## Production Readiness

65. Is self-hosted Convex production-ready?
66. What monitoring and observability tools work with self-hosted?
67. How do you scale self-hosted Convex horizontally?
68. What's the disaster recovery strategy for self-hosted?
69. How do you handle backups for self-hosted Convex?

## Documentation Gaps

70. What's missing from the official self-hosted Convex documentation?
71. Are there community resources for self-hosted Convex?
72. What are common pitfalls when self-hosting Convex?
73. How can the Convex team improve self-hosted deployment experience?

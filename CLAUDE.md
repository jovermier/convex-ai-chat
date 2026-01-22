# AI Document Editor App

A collaborative document editor with AI-powered assistance built with Convex backend, React frontend, and shadcn/ui components.

## Deployment Options

This app supports **two deployment modes**:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Convex Cloud** | Hosted by Convex (free tier available) | Quick start, development, prototyping |
| **Self-Hosted** | Convex running in Docker containers | Production, data sovereignty, custom infrastructure |

The app is currently configured for **self-hosted deployment**. See the "Switching Deployment Modes" section below.

---

## Self-Hosted Convex

This project can use **self-hosted Convex** running in Docker containers instead of Convex Cloud. This provides full control over data and infrastructure.

### Architecture (Self-Hosted)

- **Frontend**: Vite dev server with React 19 and TypeScript
- **Backend**: Self-hosted Convex running in Docker
- **Database**: PostgreSQL (required)
- **Dashboard**: Convex dashboard for managing your deployment
- **Editor**: Tiptap rich text editor (ProseMirror-based)

### Quick Start

```bash
pnpm install          # Install dependencies
pnpm start            # Start frontend (PM2) + backend (Docker)
pnpm stop             # Stop both services
pnpm dev              # Start both in development mode
```

### Environment Files

The app uses multiple environment files for different purposes:

**`.env.local`** - Frontend and Convex CLI configuration (self-hosted mode):
```bash
CONVEX_SELF_HOSTED_URL=<convex-api-url>
CONVEX_SELF_HOSTED_ADMIN_KEY=<admin-key>
VITE_CONVEX_URL=<convex-api-url>
CONVEX_SITE_ORIGIN=<convex-site-url>
```

**For Convex Cloud mode**, this file should NOT contain `CONVEX_SELF_HOSTED_*` variables.

**`.env.convex.local`** - Docker Compose configuration (auto-generated for self-hosted):
```bash
POSTGRES_URL=<postgres-connection-url>
CONVEX_CLOUD_ORIGIN=<convex-api-url>
CONVEX_SITE_ORIGIN=<convex-site-url>
CONVEX_DEPLOYMENT_URL=<convex-api-url>
```

**`.env.convex.deployment`** - Deployment environment variables (managed by `scripts/generate-convex-env.sh`)

### Service URLs

**Local Development (Self-Hosted):**
- Frontend: http://localhost:3000
- Convex API: http://localhost:3210
- Convex Dashboard: http://localhost:6791

**Coder Workspace** (auto-generated):
- Frontend: `https://app--<workspace>--<owner>.<coder-domain>`
- Convex API: `https://convex-api--<workspace>--<owner>.<coder-domain>`
- Convex Dashboard: `https://convex--<workspace>--<owner>.<coder-domain>`

### Switching Deployment Modes

**To switch from Self-Hosted to Convex Cloud:**

1. Remove `CONVEX_SELF_HOSTED_URL`, `CONVEX_SELF_HOSTED_ADMIN_KEY`, `VITE_CONVEX_URL`, and `CONVEX_SITE_ORIGIN` from `.env.local`
2. Run `npx convex dev` to initialize a Cloud project
3. Update `package.json` dev script to use `convex dev --local` instead of `convex:start`

**To switch from Convex Cloud to Self-Hosted:**

1. Add self-hosted environment variables to `.env.local`
2. Ensure Docker is running and PostgreSQL is available
3. Run `pnpm start` to start the self-hosted backend

---

## Workflows

This project follows the **Meta-Workflow** for task execution, which intelligently selects and composes specialized workflows based on task complexity.

### Meta-Workflow: Adaptive Task Execution

The master workflow that determines the best approach for any task.

#### The 8-Step Process

1. **Plan Approach** - Assess task and determine strategy
2. **Explore** (if needed) - Gather missing information
3. **Plan Solution** (if needed) - Create detailed implementation plan
4. **Plan Scrutiny** (mandatory for all plans) - Multi-agent validation with severity classification (P1/P2/P3)
5. **Execute** - Implement the solution
6. **Quality Gates** - Closed-loop validation (typecheck, lint, build, tests)
7. **Implementation Scrutiny** (mandatory for non-trivial changes) - Multi-agent code review
8. **Plan Completion** - Two-stage confirmation (user approval + quality gate verification)

#### Decision Matrix

| Your Request | Strategy | Example |
|--------------|----------|---------|
| "What does X do?" | Direct response | "What does this function do?" |
| "Fix typo" | Direct execution | "Fix typo in heading" |
| "New feature" | Select workflow(s) - TDD + UI-iteration | "Add contact form" |
| "Bug fix" | Use bug-fix-workflow | "Navigation not working" |
| "UI work" | Use ui-iteration-workflow | "Redesign hero section" |
| "Tests needed" | Use tdd-workflow | "Add form validation" |
| "Complex task" | Compose multiple workflows | "New e-commerce checkout" |

### Specialized Workflows

#### Bug Fix Workflow

Systematic approach to identifying, understanding, and fixing bugs.

1. **Reproduce the Bug** - Clearly reproduce the issue with screenshots
2. **Gather Context** - Read relevant files and check git history
3. **Identify Root Cause** - Analyze why the bug is happening
4. **Create Fix Plan** - Consider what could break
5. **Implement Fix** - Apply solution and verify
6. **Add Regression Test** - Create test to prevent recurrence
7. **Verify & Commit** - All tests pass, manual testing confirms

#### Test-Driven Development Workflow

Use TDD when building features with clear, testable behavior.

1. **Write Tests First** - Create Playwright test defining expected behavior
2. **Run Tests** - Watch them fail to confirm what's missing
3. **Write Minimal Implementation** - Just enough to pass tests
4. **Run Tests Again** - Iterate until all pass
5. **Refactor** (optional) - Improve quality while keeping tests green
6. **Quality Gates** - Type check, lint, build
7. **Commit** - Tests and implementation together

#### UI Iteration Workflow

Building or refining UI components through visual iteration.

1. **Start with Design** - Set aesthetic direction
2. **Implement Initial Version** - Create first version
3. **Take Screenshot** - Visual verification
4. **Review and Iterate** - Give feedback, refine (2-3x minimum)
5. **Final Polish** - Responsive, accessibility, dark mode
6. **Quality Gates** - Type check, lint, build
7. **Commit** - When satisfied

#### Quality Gates (Always Run)

Before committing, run these in a closed loop until all pass:

```bash
pnpm check  # Full quality check (no auto-fix)
pnpm lint   # Auto-fix + full quality check
pnpm build  # Build for production
```

**Note:** Biome handles linting, formatting, and import organization. TypeScript compiler (`tsc`) provides type checking as the authoritative source.

### Severity Classification

All findings are classified using P1/P2/P3 severity:

- **P1 (Critical)**: Blocks implementation/merge - fundamental flaws, missing context, security vulnerabilities
- **P2 (Important)**: Should address - significant gaps, risky approaches, performance issues
- **P3 (Nice-to-Have)**: Consider - minor improvements, optimizations

## Tech Stack (Skill-Linked)

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2.3 | UI framework |
| **Vite** | 7.3.1 | Build tool & dev server |
| **Convex** | 1.31.4 | Backend (database, functions, auth) |
| **TypeScript** | 5.9.3 | Type safety |
| **Biome** | 2.3.11 | Linting, formatting, import organization |
| **Tailwind CSS** | 4.1.18 | Styling |
| **@tailwindcss/typography** | 0.5.19 | Typography plugin for prose styling |
| **@convex-dev/auth** | 0.0.90 | Authentication (Anonymous provider) |
| **sonner** | 2.0.7 | Toast notifications |
| **@tiptap/react** | 3.15.3 | Rich text editor (ProseMirror-based) |
| **pm2** | (via npm-run-all) | Process manager for production mode |

## Biome Configuration

This project uses **Biome** for fast linting, formatting, and import organization. Biome is a Rust-based tool that provides significant performance improvements over ESLint/Prettier.

### Configuration Files

- [`biome.json`](biome.json) - Main Biome configuration
- [`.vscode/settings.json`](.vscode/settings.json) - VSCode integration
- [`.vscode/extensions.json`](.vscode/extensions.json) - Recommended Biome extension

### Available Commands

| Command | Description |
|---------|-------------|
| `pnpm check` | Full quality check (no auto-fix) |
| `pnpm lint` | Auto-fix Biome issues + full quality check |
| `pnpm lint:check` | Biome lint check only (no fix) |
| `pnpm format` | Format code with Biome |
| `pnpm format:check` | Check formatting without modifying files |

### Key Configuration

- **Formatter**: 100 char line width, double quotes, trailing commas (ES5), semicolons as-needed
- **Linter**: Recommended rules enabled, with specific customizations:
  - `noExplicitAny`: off (allow `any` type)
  - `useButtonType`: off (button type prop not required)
  - `useExhaustiveDependencies`: warn (React hooks dependency warnings)
  - `security`: warn (detect potential security flaws)
  - `performance`: warn (catch performance issues)
  - Tailwind CSS directives enabled in parser

## Package Manager

**pnpm** - This project uses pnpm for dependency management.

```bash
pnpm install          # Install dependencies
pnpm start            # Start both frontend and backend (production mode)
pnpm stop             # Stop both services
pnpm dev              # Start both frontend and backend (development mode)
pnpm dev:frontend     # Start only Vite dev server
pnpm dev:backend      # Start only Convex backend (once)
pnpm build            # Build for production
pnpm check            # Full quality check (no auto-fix)
pnpm lint             # Auto-fix + full quality check
pnpm format           # Format code with Biome
```

## Runtime Environment

| Platform | Version |
|----------|---------|
| **Node.js** | v24.12.0 |
| **pnpm** | 10.27.0 |
| **Docker** | Required for self-hosted Convex only |

## Project Structure

```
ai_document_editor_app/
├── convex/                   # Convex backend code
│   ├── _generated/          # Auto-generated Convex types
│   ├── ai.ts                # LLM integration action (streamChat)
│   ├── auth.config.ts       # Convex Auth configuration
│   ├── auth.ts              # Auth utilities
│   ├── documents.ts         # Document CRUD functions
│   ├── http.ts              # HTTP routes entry point
│   ├── messages.ts          # Chat message functions
│   ├── router.ts            # HTTP route definitions (user-defined)
│   └── schema.ts            # Database schema definition
│
├── src/
│   ├── components/          # React components
│   │   ├── ChatPane.tsx     # AI chat interface
│   │   ├── DocumentEditor.tsx # Main editor orchestrator
│   │   ├── DocumentList.tsx # Document sidebar
│   │   └── EditorPane.tsx   # Rich text editor (Tiptap)
│   ├── lib/
│   │   ├── documentUtils.ts # Document processing utilities
│   │   ├── markdown.ts      # Markdown serialization for Tiptap
│   │   └── utils.ts         # shadcn/ui utilities
│   ├── App.tsx              # Root component with auth
│   ├── SignInForm.tsx       # Authentication form
│   ├── SignOutButton.tsx    # Sign out component
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles with Tailwind
│
├── docker-compose.convex.yml # Docker Compose for self-hosted Convex
├── scripts/
│   ├── generate-convex-env.sh   # Generate Convex environment files
│   ├── load-convex-env.sh       # Load env vars to Convex Cloud
│   ├── setup-convex.sh          # Convex setup script
│   ├── update-jwt-key.sh        # Update JWT keys for auth
│   └── diagnostics.sh           # Diagnostic tools
├── start.sh                 # Start script (PM2 + Docker)
├── stop.sh                  # Stop script
```

## Environment Script Usage

The project uses scripts for managing Convex environment variables:

| Script | Purpose |
|--------|---------|
| `generate-convex-env.sh` | Generates `.env.convex.deployment` (JWT keys, user vars) and `.env.convex.local` (LLM vars) |
| `load-convex-env.sh` | Loads vars from `.env.convex.deployment` to Convex deployment via `npx convex env set` |
| `watch-convex-env.sh` | Watches `.env.convex.deployment` and auto-syncs to Convex deployment |

**Note:** These scripts are run automatically by PM2 when `.env.convex.deployment` changes. You rarely need to run them manually.

### Automatic Deployment (PM2)

When running `pnpm start`, PM2 watches for changes and automatically:
- Regenerates env files when `.env.convex.deployment` is modified
- Deploys Convex functions when `convex/` source files change
- Loads environment variables to the running deployment

### Manual Usage (Rare)

Manual script usage is only needed in special cases:

```bash
# Regenerate env files (JWT keys, etc.)
bash scripts/generate-convex-env.sh

# Sync env vars to running deployment
bash scripts/load-convex-env.sh

# Watch for changes and auto-sync (development)
bash scripts/watch-convex-env.sh
```

## Database Schema

### Auth Tables (from @convex-dev/auth)
- `users` - User accounts
- `sessions` - User sessions

### Application Tables

**documents**
| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Document title |
| `content` | string | Markdown content with section IDs |
| `userId` | id(users) | Owner reference |
| `lastModified` | number | Unix timestamp |
| Index: `by_user` | on `userId` | Query user's documents |

**messages**
| Field | Type | Description |
|-------|------|-------------|
| `documentId` | id(documents) | Document reference |
| `role` | "user" \| "assistant" | Message sender |
| `content` | string | Message text |
| `timestamp` | number | Unix timestamp |
| `userId` | id(users) | Sender reference |
| Index: `by_document` | on `documentId`, `timestamp` | Query document messages |

## AI Integration

The app integrates with a custom LLM endpoint for document editing assistance:

- **Endpoint**: `https://llm-gateway.hahomelabs.com/v1/chat/completions`
- **Model**: `zai/glm-4.6`
- **Streaming**: Server-sent events (SSE) for real-time responses
- **Action**: `convex/ai.ts:streamChat`

The AI uses a special XML-based format for document edits:

```xml
<DOCUMENT_EDIT>
<ACTION>replace|insert|append</ACTION>
<TARGET>section-id or "full"</TARGET>
<CONTENT>
New content here
</CONTENT>
</DOCUMENT_EDIT>
```

## Path Aliases

```typescript
import { Component } from "@/components/..."  // → src/components/...
import { util } from "@/lib/..."              // → src/lib/...
```

## Tailwind Configuration

Custom theme extensions:
- **Primary color**: `#3b82f6` (blue-500) with hover `#2563eb`
- **Secondary color**: `#64748b` (slate-500)
- **Typography plugin**: Enabled for prose styling
- **Custom spacing**: `section` (2rem), `container` (0.5rem)
- **Custom border radius**: `container` (0.5rem)

## Authentication

Uses Convex Auth with **Anonymous provider** for easy sign-in. Consider changing to a production-ready provider (Email, Password, OAuth) before deploying.

To change authentication providers, edit `convex/auth.config.ts`.

## Key Features

1. **Document Management**: Create, edit, save documents with auto-save every 5 seconds
2. **AI Chat**: Sidebar chat interface for AI assistance
3. **Section-based Editing**: Documents have section IDs (`section-1`, `section-2`) for targeted AI edits
4. **Rich Text Editor**: Tiptap editor with Markdown import/export
5. **Real-time Updates**: Convex provides real-time data synchronization
6. **Flexible Deployment**: Supports both Convex Cloud and self-hosted

## Development Workflow

### Starting Development
```bash
pnpm dev  # Runs both Vite frontend (port 3000) and Convex backend
```

### Type Safety
- Frontend and backend types are auto-generated in `convex/_generated/`
- Run `pnpm lint` to verify types across both codebases

### Convex Functions
- **Query**: Read-only functions (`api.documents.list`, `api.documents.get`)
- **Mutation**: Write functions (`api.documents.create`, `api.documents.update`)
- **Action**: Functions with external API calls (`api.ai.streamChat`)

## Critical Rules

### React Best Practices (React 19)

- **ALWAYS** use `useCallback` for event handlers passed to child components to prevent unnecessary re-renders
- **ALWAYS** include dependencies in `useEffect` and `useCallback` dependency arrays
- **NEVER** call hooks conditionally or inside loops - hooks must be called in the same order every render
- **NEVER** mutate state directly - always use the setter function or create new objects/arrays

#### React 19 Specific

- **No more `forwardRef`** - The `ref` prop is now a standard prop that can be passed directly to function components
- **No more `.Provider` suffix** - Context providers can be used directly: `<MyContext value={val}>{children}</MyContext>`
- **Use new hooks** - Consider `useActionState`, `useOptimistic`, and `useFormStatus` for forms and async actions
- **Document metadata** - Place `<title>`, `<meta>`, `<link>` directly in components (React auto-hoists to `<head>`)

### Convex Best Practices

- **ALWAYS** use `v.string()`, `v.number()` etc. validators for function arguments
- **NEVER** perform side effects in queries - use mutations or actions
- **ALWAYS** use actions (not queries/mutations) when calling external APIs
- **NEVER** expose sensitive data in query results without proper authentication checks
- **NEVER** manually add `_id` or `_creationTime` to schemas - they are automatic
- **NEVER** create indexes on `_creationTime` - it's built-in to all indexes automatically
- **NEVER** use `.filter()` in queries - use indexes instead for performance
- **NEVER** call hooks conditionally - use `"skip"` token for conditional queries:
  ```typescript
  import { skipToken } from "convex/react";
  const data = useQuery(api.tasks.get, taskId ? { id: taskId } : skipToken());
  ```
- **NEVER** manually edit `_generated/` files - they are auto-generated from schema

### Self-Hosted Convex Specific

- **ALWAYS** ensure `POSTGRES_URL` is set in `.env.convex.local` before starting
- **ALWAYS** run `scripts/generate-convex-env.sh` before deploying functions (sets JWT keys)
- **ALWAYS** use `npx convex deploy --yes` for self-hosted deployments
- **NEVER** run `npx convex dev` for self-hosted - use `npx convex deploy` instead
- **CONVEX_SITE_ORIGIN** must be set for auth to work (HTTP actions endpoint)

### Deployment Mode Specific

- **For Convex Cloud**: Remove `CONVEX_SELF_HOSTED_*` variables from `.env.local`
- **For Self-Hosted**: Ensure `CONVEX_SELF_HOSTED_URL` is set in `.env.local`
- **Detection**: The Convex CLI auto-detects mode based on `CONVEX_SELF_HOSTED_URL` presence

### TypeScript Best Practices

- **ALWAYS** use `Id<"tableName">` type for Convex document IDs
- **ALWAYS** import types from `convex/_generated/dataModel` for database types
- **NEVER** use `any` - use `unknown` or proper types instead

## Gotchas

### JavaScript/TypeScript Specific
1. **Import Paths**: Use `@/` alias for imports from `src/` (e.g., `@/components/...`)
2. **Type Generation**: Run `npx convex deploy` (self-hosted) or `npx convex dev` (cloud) to regenerate types
3. **TypeScript Project References**: This project uses project references - `tsconfig.json` references `tsconfig.app.json` and `tsconfig.node.json`
4. **Use `null` not `undefined`**: Convex schemas should use `null` for optional fields, not `undefined`

### React Specific
5. **React 19**: This uses React 19 - `ref` is now a standard prop, no `forwardRef` needed
6. **Convex React Hooks**: `useQuery`, `useMutation` return `undefined` while loading - check for this before rendering
7. **State Synchronization**: Local component state (`useState`) and Convex queries can get out of sync - the app handles this with auto-save
8. **Conditional Queries**: Use `skipToken` from `convex/react` instead of conditional `useQuery` calls

### Self-Hosted Convex Specific
9. **JWT Keys**: Auth requires JWT keys to be set via `scripts/generate-convex-env.sh` before deployment
10. **Admin Key Rotation**: Admin keys may expire - `start.sh` automatically regenerates if needed
11. **Docker Volumes**: Convex data persists in Docker volume `convex-data`
12. **POSTGRES_URL Format**: Should be `postgres://user:pass@host:port` (without database name - Convex appends `INSTANCE_NAME`)
13. **SSL Mode**: For Coder PostgreSQL with self-signed certs, use `?sslmode=disable`
14. **Port Bindings**: Convex API on 3210, Site Proxy on 3211, Dashboard on 6791
15. **Environment Variables**: `.env.local` is for frontend/CLI, `.env.convex.local` is for Docker

### Tiptap Editor Specific
16. **Markdown Serialization**: Content is stored as Markdown, converted to Tiptap JSON for editing
17. **Character Count**: Built-in via `@tiptap/extension-character-count`
18. **Placeholder**: Empty state placeholder via `@tiptap/extension-placeholder`

### General
19. **Hardcoded API Key**: The LLM API key in `convex/ai.ts:46` is exposed. Use environment variable for production
20. **Chef Dev Plugin**: Vite config includes Chef-specific code for screenshot taking. Can be removed if not using `chef.convex.dev`.
21. **Section ID Injection**: Documents automatically get section IDs added when loaded via `src/lib/documentUtils.ts:addSectionIds()`
22. **Auto-save Conflict**: Auto-save may overwrite manual edits if timing is unlucky. Manual save button available
23. **Index Performance**: Using `.filter()` in queries causes full table scans - always use indexes with `.withIndex()` instead
24. **Schema Indexes**: All indexes automatically include `_creationTime` as the last field - don't add it manually
25. **Playwright Headed Mode**: Cannot run Playwright in headed mode (with browser UI) in this Coder workspace - the environment lacks a display server. Always use headless mode for tests.

## Commands

### Development
| Command | Description |
|---------|-------------|
| `pnpm start` | Start both frontend (PM2) and backend (Docker) |
| `pnpm stop` | Stop both services |
| `pnpm dev` | Start both frontend and backend in parallel |
| `pnpm dev:frontend` | Start Vite dev server only (port 3000) |
| `pnpm dev:backend` | Start Convex backend only (once) |
| `pnpm build` | Build for production |

### Quality Gates (Run Before Committing)
| Command | Description |
|---------|-------------|
| `pnpm check` | Full quality check (no auto-fix) |
| `pnpm lint` | Auto-fix Biome + full quality check |
| `pnpm format` | Format code with Biome |

### Convex Commands

**Self-Hosted:**
| Command | Description |
|---------|-------------|
| `npx convex deploy --yes` | Deploy to self-hosted Convex |
| `npx convex env set VAR val` | Set deployment environment variable |
| `npx convex env inspect` | View deployment configuration |
| `pnpm convex:logs` | View Convex backend logs |
| `pnpm convex:status` | Check Convex Docker status |
| `pnpm convex:stop` | Stop Convex Docker services |

**Convex Cloud:**
| Command | Description |
|---------|-------------|
| `npx convex dev` | Start dev backend with type generation |
| `npx convex deploy` | Deploy to production |

## Available Skills (Auto-Activated)

Skills activate automatically based on context. You don't need to invoke them manually.

| Skill | Trigger | Description |
|-------|---------|-------------|
| `coder-template` | All files | Coder workspace environment context and available tools |
| `react:latest-react` | React component files | Latest React 19 and React Compiler features (mid-2024 to 2026) |
| `convex:coder-convex` | Convex files | Self-hosted Convex development patterns |
| `convex:coder-convex-setup` | Setup/initialization | Initial Convex workspace setup in Coder |
| `playwright:playwright-test` | Playwright test files | End-to-end testing patterns and best practices |
| `graphql:setup-graphql-operation` | Creating `.graphql` files | Scaffold GraphQL operations with role-based naming |
| `graphql:graphql-workflow` | GraphQL codegen operations | Manage GraphQL operations, migrations, and codegen |
| `nextjs:latest-nextjs` | Next.js project files | Latest Next.js and React 19 features (past 1.5 years) |
| `astro:latest-astro` | Astro project files | Latest Astro 4.x-5.x features |

## Available Agents (Manual Invocation)

Use `/agents` to list agents or invoke directly via the Task tool:

| Agent | Purpose |
|-------|---------|
| `Explore` | Fast codebase exploration with keyword search |
| `general-purpose` | Complex multi-step research and execution tasks |
| `dev:review:code-simplicity-reviewer` | Review for over-engineering and YAGNI violations |
| `dev:review:performance-oracle` | Analyze performance bottlenecks and optimization opportunities |
| `dev:review:security-sentinel` | Security audit and vulnerability review |

## Workspaces

This is a single-package project (not a monorepo).

## Documentation

| Need | Reference |
|------|-----------|
| **Getting Started** | [README.md](README.md) |
| **Convex Overview** | [Convex docs](https://docs.convex.dev/understanding/) |
| **Self-Hosted Convex** | [Self-hosted guide](https://github.com/get-convex/convex-backend/tree/main/self-hosted) |
| **Convex Functions** | [convex/README.md](convex/README.md) |
| **Convex Auth** | [Convex Auth docs](https://auth.convex.dev/) |
| **Tiptap Editor** | [Tiptap docs](https://tiptap.dev/) |

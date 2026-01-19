# AI Document Editor App

A collaborative document editor with AI-powered assistance built with Convex backend, React frontend, and shadcn/ui components.

## Deployment Options

This app supports **two deployment modes**:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Convex Cloud** | Hosted by Convex (free tier available) | Quick start, development, prototyping |
| **Self-Hosted** | Convex running in Docker containers | Production, data sovereignty, custom infrastructure |

The app is currently configured for **self-hosted deployment**. See [Switching to Convex Cloud](#switching-to-convex-cloud) below.

---

## Self-Hosted Convex Deployment

This project can use **self-hosted Convex** running in Docker containers instead of Convex Cloud. This provides full control over your data and infrastructure.

### Architecture (Self-Hosted)

- **Frontend**: Vite dev server with React 19 and TypeScript
- **Backend**: Self-hosted Convex running in Docker
- **Database**: PostgreSQL (required)
- **Dashboard**: Convex dashboard for managing your deployment

### Quick Start (Self-Hosted)

#### Prerequisites

- **Node.js** v24+ and **pnpm**
- **Docker** and **Docker Compose**
- **PostgreSQL database** (with connection URL)

#### Starting the App

```bash
# Install dependencies
pnpm install

# Start the entire app (frontend + backend)
pnpm start
```

The `pnpm start` command will:
1. Set up self-hosted Convex configuration
2. Start Convex backend and dashboard in Docker
3. Deploy Convex functions to your self-hosted instance
4. Start the frontend with PM2

#### Stopping the App

```bash
pnpm stop
```

### Project Structure

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
│   │   └── utils.ts         # shadcn/ui utilities
│   ├── App.tsx              # Root component with auth
│   ├── SignInForm.tsx       # Authentication form
│   ├── SignOutButton.tsx    # Sign out component
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles with Tailwind
│
├── docker-compose.convex.yml # Docker Compose for self-hosted Convex
├── scripts/
│   ├── setup-convex.sh      # Convex setup script
│   ├── init-convex-env.sh   # Initialize Convex environment variables
│   └── diagnostics.sh       # Diagnostic tools
├── .env.local               # Local environment variables (gitignored)
├── .env.convex.local        # Convex Docker configuration (gitignored)
└── .env.convex.deployment   # Convex deployment env vars (gitignored)
```

### Configuration (Self-Hosted)

#### Environment Variables

The app uses multiple environment files for different purposes:

**`.env.local`** - Frontend and Convex CLI configuration:
```bash
CONVEX_SELF_HOSTED_URL=<convex-api-url>
CONVEX_SELF_HOSTED_ADMIN_KEY=<admin-key>
VITE_CONVEX_URL=<convex-api-url>
CONVEX_SITE_ORIGIN=<convex-site-url>
```

**`.env.convex.local`** - Docker Compose configuration:
```bash
POSTGRES_URL=<postgres-connection-url>
CONVEX_CLOUD_ORIGIN=<convex-api-url>
CONVEX_SITE_ORIGIN=<convex-site-url>
CONVEX_DEPLOYMENT_URL=<convex-api-url>
```

#### Service URLs

**Local Development:**
- **Frontend**: http://localhost:3000
- **Convex API**: http://localhost:3210
- **Convex Dashboard**: http://localhost:6791

**Coder Workspace** (auto-generated):
- **Frontend**: `https://app--<workspace>--<owner>.<coder-domain>`
- **Convex API**: `https://convex-api--<workspace>--<owner>.<coder-domain>`
- **Convex Dashboard**: `https://convex--<workspace>--<owner>.<coder-domain>`

---

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm start` | Start both frontend and backend (production mode) |
| `pnpm stop` | Stop both services |
| `pnpm dev` | Start both frontend and backend (development mode) |
| `pnpm dev:frontend` | Start only Vite dev server |
| `pnpm dev:backend` | Start only Convex backend (once) |
| `pnpm build` | Build for production |
| `pnpm lint` | Type check frontend and backend + Convex validation |
| `pnpm test` | Run Playwright tests |
| `pnpm convex:logs` | View Convex backend logs |
| `pnpm convex:status` | Check Convex Docker status |

### Self-Hosted Convex Commands

| Command | Description |
|---------|-------------|
| `npx convex deploy --yes` | Deploy to self-hosted Convex |
| `npx convex env set VAR val` | Set deployment environment variable |
| `npx convex env inspect` | View deployment configuration |

---

## Switching to Convex Cloud

To use Convex Cloud instead of self-hosted:

1. **Remove self-hosted environment variables** from `.env.local`:
   ```bash
   # Remove these lines:
   CONVEX_SELF_HOSTED_URL=...
   CONVEX_SELF_HOSTED_ADMIN_KEY=...
   VITE_CONVEX_URL=...
   CONVEX_SITE_ORIGIN=...
   ```

2. **Initialize a Convex Cloud project**:
   ```bash
   npx convex dev
   # Follow prompts to create or select a project
   ```

3. **Update package.json scripts** (optional):
   Change `"dev": "npm-run-all --parallel dev:frontend convex:start"` to:
   ```json
   "dev": "npm-run-all --parallel dev:frontend 'convex dev --local'"
   ```

4. **Start the app**:
   ```bash
   pnpm dev
   ```

The Convex CLI will handle type generation and automatic deployment to your Cloud project.

---

## Editor Features

The document editor uses **Tiptap**, a rich text editor built on ProseMirror:

- **Markdown support**: Import and export Markdown
- **Real-time collaboration**: Powered by Convex real-time subscriptions
- **Rich formatting**: Bold, italic, headings, lists, code blocks
- **Character count**: Built-in character/word counting
- **Auto-save**: Saves changes every 5 seconds

---

## Authentication

The app uses [Convex Auth](https://auth.convex.dev/) with the **Anonymous provider** for easy sign-in. For production, consider switching to:
- Email/Password authentication
- OAuth providers (Google, GitHub, etc.)
- Custom authentication

### Changing Authentication Providers

Edit `convex/auth.config.ts`:

```typescript
import { anonymous } from "@convex-dev/auth/providers";

export default {
  providers: [
    // Replace with your desired provider
    anonymous(),
  ],
};
```

---

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

---

## Troubleshooting

### Convex Backend Not Starting

```bash
# Check Docker logs
pnpm convex:logs

# Check container status
pnpm convex:status
```

### Database Connection Issues

Ensure `POSTGRES_URL` is correctly set in `.env.convex.local`:
```bash
# Format: postgres://user:password@host:port
POSTGRES_URL=postgres://user:pass@localhost:5432
```

### Admin Key Expired

The start script automatically generates a new admin key if needed. If issues persist:

```bash
# Regenerate admin key manually
docker compose -f docker-compose.convex.yml exec convex-backend ./generate_admin_key.sh
```

---

## HTTP API

User-defined HTTP routes are defined in [convex/router.ts](convex/router.ts). These routes are split into a separate file from [convex/http.ts](convex/http.ts) to prevent the LLM from modifying authentication routes.

---

## Resources

- [Convex Documentation](https://docs.convex.dev/)
- [Self-Hosted Convex Guide](https://github.com/get-convex/convex-backend/tree/main/self-hosted)
- [Convex Auth](https://auth.convex.dev/)
- [React 19 Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Tiptap Editor](https://tiptap.dev/)

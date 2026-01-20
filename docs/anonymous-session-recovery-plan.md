# Anonymous Session Recovery & Document Sharing Implementation Plan

## Overview

This document outlines the implementation of three complementary features to solve the problem of anonymous users losing access to their documents when signing out, and to enable document sharing capabilities.

## Problem Statement

When an anonymous user signs out and signs back in:
1. A **new anonymous user ID** is created
2. Previous documents become **inaccessible** (tied to old user ID)
3. Users have no way to **recover their work**

## Solutions Overview

| Feature | Purpose | Priority |
|---------|---------|----------|
| **Session Recovery Token** | Restore previous anonymous session via localStorage | P1 |
| **Document Visibility & Public Links** | Share documents via humanId (view-only access) | P1 |
| **Clone Document** | Copy shared documents to user's account | P2 |
| **Account Upgrade** | Convert anonymous account to email/password account | P2 |

---

## Phase 1: Session Recovery Token (localStorage)

### Goal
Allow users to recover their previous anonymous session after signing out, using a secure token stored in localStorage.

### Implementation

#### Backend Changes

**New Table:** `sessionRecoveryTokens`
```typescript
// convex/schema.ts
sessionRecoveryTokens: defineTable({
  userId: v.id("users"),
  tokenHash: v.string(),  // SHA-256 hash of the token
  expiresAt: v.number(),  // Unix timestamp
})
  .index("by_tokenHash", ["tokenHash"])
  .index("by_user", ["userId"])
```

**New Mutation:** `generateRecoveryToken`
```typescript
// convex/sessionRecovery.ts
export const generateRecoveryToken = mutation({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Generate random token
    const token = crypto.randomUUID() + Date.now().toString()
    const tokenHash = await hashToken(token)
    const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days

    // Delete old tokens for this user
    const oldTokens = await ctx.db
      .query("sessionRecoveryTokens")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect()
    for (const old of oldTokens) {
      await ctx.db.delete(old._id)
    }

    // Store new token (store hash only)
    await ctx.db.insert("sessionRecoveryTokens", {
      userId,
      tokenHash,
      expiresAt,
    })

    return token
  }
})
```

**New Query:** `validateRecoveryToken`
```typescript
export const validateRecoveryToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenHash = await hashToken(args.token)

    const recoveryRecord = await ctx.db
      .query("sessionRecoveryTokens")
      .withIndex("by_tokenHash", q => q.eq("tokenHash", tokenHash))
      .first()

    if (!recoveryRecord) {
      return null
    }

    // Check expiration
    if (recoveryRecord.expiresAt < Date.now()) {
      await ctx.db.delete(recoveryRecord._id)
      return null
    }

    // Verify user still exists
    const user = await ctx.db.get(recoveryRecord.userId)
    if (!user) return null

    return { userId: recoveryRecord.userId }
  }
})
```

**New Mutation:** `recoverSession`
```typescript
export const recoverSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenHash = await hashToken(args.token)

    const recoveryRecord = await ctx.db
      .query("sessionRecoveryTokens")
      .withIndex("by_tokenHash", q => q.eq("tokenHash", tokenHash))
      .first()

    if (!recoveryRecord) {
      throw new Error("Invalid recovery token")
    }

    if (recoveryRecord.expiresAt < Date.now()) {
      await ctx.db.delete(recoveryRecord._id)
      throw new Error("Recovery token expired")
    }

    return { userId: recoveryRecord.userId }
  }
})
```

#### Frontend Changes

**New Hook:** `useSessionRecovery`
```typescript
// src/hooks/useSessionRecovery.ts
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

const RECOVERY_TOKEN_KEY = "convex_recovery_token"

export function useSessionRecovery() {
  const generateRecoveryToken = useMutation(api.sessionRecovery.generateRecoveryToken)
  const validateRecoveryToken = useQuery(api.sessionRecovery.validateRecoveryToken, {})

  // Generate and store token when user signs in
  const storeRecoveryToken = async () => {
    const token = await generateRecoveryToken()
    if (token) {
      localStorage.setItem(RECOVERY_TOKEN_KEY, token)
    }
  }

  // Check for existing recovery token
  const checkRecoveryToken = () => {
    return localStorage.getItem(RECOVERY_TOKEN_KEY)
  }

  // Clear recovery token
  const clearRecoveryToken = () => {
    localStorage.removeItem(RECOVERY_TOKEN_KEY)
  }

  // Validate stored token
  const validateStoredToken = () => {
    const token = checkRecoveryToken()
    if (!token) return null
    return validateRecoveryToken
  }

  return {
    storeRecoveryToken,
    checkRecoveryToken,
    clearRecoveryToken,
    validateStoredToken,
  }
}
```

**New Component:** `SessionRecoveryPrompt`
```typescript
// src/components/SessionRecoveryPrompt.tsx
import { useConvexAuth } from "@convex-dev/auth/react"
import { useSessionRecovery } from "@/hooks/useSessionRecovery"
import { useState } from "react"

export function SessionRecoveryPrompt() {
  const { isAuthenticated } = useConvexAuth()
  const { checkRecoveryToken, clearRecoveryToken } = useSessionRecovery()
  const [showPrompt, setShowPrompt] = useState(false)

  if (!isAuthenticated) return null

  const recoveryToken = checkRecoveryToken()
  if (!recoveryToken || !showPrompt) return null

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-lg max-w-md">
      <p className="text-sm text-yellow-800 mb-3">
        We found a previous session with your documents. Would you like to recover it?
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleRecover}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
        >
          Recover
        </button>
        <button
          onClick={() => {
            clearRecoveryToken()
            setShowPrompt(false)
          }}
          className="px-3 py-1 text-gray-600 rounded text-sm"
        >
          Start Fresh
        </button>
      </div>
    </div>
  )
}
```

**Integrate with sign-in flow:**
```typescript
// src/SignInForm.tsx - After successful sign in
const { storeRecoveryToken } = useSessionRecovery()

useEffect(() => {
  if (isAuthenticated) {
    storeRecoveryToken()
  }
}, [isAuthenticated])
```

---

## Phase 2: Document Visibility & Public Links

### Goal
Allow users to share documents via human-readable ID, with view-only access for non-owners.

### Implementation

#### Backend Changes

**Update Schema:**
```typescript
// convex/schema.ts
documents: defineTable({
  title: v.string(),
  content: v.string(),
  userId: v.id("users"),
  lastModified: v.number(),
  humanId: v.optional(v.string()),
  // NEW FIELDS:
  visibility: v.optional(v.union(
    v.literal("private"),
    v.literal("public_link")
  )),
})
  .index("by_user", ["userId"])
  .index("by_humanId", ["humanId"])
```

**New Query:** `getByHumanIdPublic`
```typescript
// convex/documents.ts
export const getByHumanIdPublic = query({
  args: { humanId: v.string() },
  handler: async (ctx, args) => {
    const document = await ctx.db
      .query("documents")
      .withIndex("by_humanId", q => q.eq("humanId", args.humanId))
      .unique()

    if (!document) {
      return null
    }

    // Check visibility - private documents are not accessible via humanId
    if (document.visibility === "private") {
      return { notFound: true }
    }

    // Check expiration (optional: documents could auto-expire after X days)
    const age = Date.now() - document.lastModified
    const maxAge = 90 * 24 * 60 * 60 * 1000 // 90 days
    if (age > maxAge && document.visibility !== "public_link") {
      return { expired: true }
    }

    return {
      document: {
        _id: document._id,
        title: document.title,
        content: document.content,
        lastModified: document.lastModified,
        humanId: document.humanId,
        // Don't expose userId
      },
      isOwner: false, // Always false for public access
    }
  }
})
```

**New Mutation:** `updateVisibility`
```typescript
export const updateVisibility = mutation({
  args: {
    id: v.id("documents"),
    visibility: v.union(v.literal("private"), v.literal("public_link")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    const document = await ctx.db.get(args.id)
    if (!document || document.userId !== userId) {
      throw new Error("Document not found")
    }

    await ctx.db.patch(args.id, { visibility: args.visibility })
  }
})
```

#### Frontend Changes

**New Route:** `/d/{humanId}` (view-only mode)
```typescript
// src/routes/document.public.tsx
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useConvexAuth } from "@convex-dev/auth/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

export const Route = createFileRoute("/d/$humanId")({
  component: PublicDocumentView,
})

function PublicDocumentView() {
  const { humanId } = Route.useParams()
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()
  const publicDoc = useQuery({
    queryKey: ["publicDocument", humanId],
    queryFn: async () => {
      const response = await fetch(`/api/documents/public/${humanId}`)
      return response.json()
    },
  })

  if (authLoading || !publicDoc) return <div>Loading...</div>

  if (publicDoc?.notFound || !publicDoc?.document) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Document Not Found</h1>
        <p className="text-gray-600">
          This document may be private or the link is incorrect.
        </p>
      </div>
    )
  }

  return (
    <div className="h-screen flex">
      {/* View-only document */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">{publicDoc.document.title}</h1>
            <span className="text-sm text-gray-500">View only</span>
          </div>
          <div className="prose max-w-none">
            {publicDoc.document.content}
          </div>
        </div>
      </div>

      {/* Sidebar with clone option */}
      <div className="w-80 border-l p-6 bg-gray-50">
        <h2 className="font-semibold mb-4">Document Options</h2>
        {isAuthenticated ? (
          <button
            onClick={handleClone}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Clone to My Account
          </button>
        ) : (
          <div className="text-sm text-gray-600">
            <a href="/signin" className="text-blue-500 hover:underline">
              Sign in
            </a>
            {" "}to clone this document
          </div>
        )}
      </div>
    </div>
  )
}
```

**Update Document Editor with visibility toggle:**
```typescript
// src/components/DocumentEditor.tsx - Add visibility settings
function VisibilitySettings({ document }: { document: Document }) {
  const updateVisibility = useMutation(api.documents.updateVisibility)

  return (
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2">
        <input
          type="radio"
          name="visibility"
          checked={document.visibility === "private"}
          onChange={() => updateVisibility({ id: document._id, visibility: "private" })}
        />
        Private
      </label>
      <label className="flex items-center gap-2">
        <input
          type="radio"
          name="visibility"
          checked={document.visibility === "public_link"}
          onChange={() => updateVisibility({ id: document._id, visibility: "public_link" })}
        />
        Public Link
      </label>
      {document.humanId && document.visibility === "public_link" && (
        <div className="text-sm text-gray-500">
          Share: /d/{document.humanId}
        </div>
      )}
    </div>
  )
}
```

---

## Phase 3: Clone Document

### Goal
Allow users to copy a shared document to their own account.

### Implementation

**New Mutation:** `cloneDocument`
```typescript
// convex/documents.ts
export const cloneDocument = mutation({
  args: { humanId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Find the document by humanId
    const sourceDoc = await ctx.db
      .query("documents")
      .withIndex("by_humanId", q => q.eq("humanId", args.humanId))
      .unique()

    if (!sourceDoc) {
      throw new Error("Document not found")
    }

    // Check if document is shareable
    if (sourceDoc.visibility !== "public_link") {
      throw new Error("Document is not publicly accessible")
    }

    // Generate new humanId for the clone
    const newHumanId = await generateUniqueHumanId(ctx)

    // Create the clone
    const newId = await ctx.db.insert("documents", {
      title: `${sourceDoc.title} (Copy)`,
      content: sourceDoc.content,
      userId,
      lastModified: Date.now(),
      humanId: newHumanId,
      visibility: "private",
    })

    return { id: newId, humanId: newHumanId }
  }
})
```

---

## Phase 4: Account Upgrade (Anonymous to Named)

### Goal
Allow anonymous users to add email/password to their existing account without losing data.

### Implementation

**Note:** This uses Convex Auth's account linking feature. The key insight is that we **keep the same userId** and just add another authentication provider.

**New Auth Provider Configuration:**
```typescript
// convex/auth.config.ts
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_ORIGIN,
      applicationID: "convex",
    },
    // Add password/email provider
    {
      type: "password",
      id: "password",
    },
  ],
}
```

**New Mutation:** `upgradeAccount`
```typescript
// convex/accountUpgrade.ts
export const upgradeAccount = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // Check if user is truly anonymous
    const user = await ctx.db.get(userId)
    // ... validation logic ...

    // This will be handled by Convex Auth's account linking
    // We need to call the appropriate Convex Auth API
    // The implementation depends on the specific version of @convex-dev/auth

    return { success: true }
  }
})
```

**Frontend - Account Upgrade Form:**
```typescript
// src/components/AccountUpgradeForm.tsx
import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"

export function AccountUpgradeForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const upgradeAccount = useMutation(api.accountUpgrade.upgradeAccount)
  const { user } = useConvexAuth()

  // Check if user is anonymous
  const isAnonymous = !user?.email

  if (!isAnonymous) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      alert("Passwords don't match")
      return
    }

    await upgradeAccount({ email, password })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-bold">Create Account</h2>
      <p className="text-sm text-gray-600">
        Add email and password to your anonymous account. All your documents will be saved.
      </p>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />

      <input
        type="password"
        placeholder="Confirm Password"
        value={confirmPassword}
        onChange={e => setConfirmPassword(e.target.value)}
        required
      />

      <button type="submit">Create Account</button>
    </form>
  )
}
```

---

## Edge Cases & Considerations

### Session Recovery Token

| Scenario | Behavior |
|----------|----------|
| Token expires | User sees "Session expired" message, starts fresh |
| User clears localStorage | Token is lost (this is expected) |
| Multiple devices | Each device gets its own token |
| XSS attack | Token is hashed in database, but stored in plain text in localStorage. Consider HttpOnly cookies as alternative. |

### Document Visibility

| Scenario | Behavior |
|----------|----------|
| Private document accessed via humanId | Returns "not found" (doesn't reveal document exists) |
| Public document owner deletes account | Document becomes orphaned, consider cleanup job |
| Document is very old | Consider auto-expiring public links after 90 days |

### Account Upgrade

| Scenario | Behavior |
|----------|----------|
| Email already exists | Show error, user must use different email |
| Password reset | Works normally with new email provider |
| User wants to remain anonymous | They can choose not to upgrade |

---

## Migration Plan

### Existing Documents

For existing documents without `visibility` field:
- Set default to `"private"` for security
- Run migration to add the field

### Existing Users

For existing anonymous users:
- They can generate recovery tokens on next sign-in
- No data loss for current sessions

---

## Testing Checklist

- [ ] Sign in as anonymous, verify recovery token is generated
- [ ] Sign out, sign back in, verify recovery prompt appears
- [ ] Click "Recover", verify previous documents are accessible
- [ ] Create document as public link, access via humanId in incognito
- [ ] Clone a public document to new account
- [ ] Upgrade anonymous account with email/password
- [ ] Verify all documents remain after upgrade

---

## Future Enhancements

1. **Export before sign out** - Offer JSON/Markdown download when user signs out
2. **Share expiration** - Let users set expiration on public links
3. **Document versions** - Track document history for public documents
4. **Analytics** - Track how many times a public document is viewed
5. **Collaborative editing** - Allow multiple users to edit same document

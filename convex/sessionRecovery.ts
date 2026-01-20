import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

// Helper function to hash a token using SHA-256
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Generate a new session recovery token for the current user.
 * Stores only the hash of the token in the database for security.
 */
export const generateRecoveryToken = mutation({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error("Not authenticated")
    }

    // Generate random token
    const randomBytes = new Uint8Array(32)
    crypto.getRandomValues(randomBytes)
    const token = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")

    const tokenHash = await hashToken(token)
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days

    // Delete old tokens for this user (one token per user)
    const oldTokens = await ctx.db
      .query("sessionRecoveryTokens")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect()
    for (const old of oldTokens) {
      await ctx.db.delete(old._id)
    }

    // Store new token hash
    await ctx.db.insert("sessionRecoveryTokens", {
      userId,
      tokenHash,
      expiresAt,
    })

    return token
  },
})

/**
 * Validate a recovery token and return the associated userId if valid.
 * Does not consume the token - use recoverSession for actual recovery.
 */
export const validateRecoveryToken = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // If no token provided, return null
    if (!args.token) {
      return null
    }
    const tokenHash = await hashToken(args.token)

    const recoveryRecord = await ctx.db
      .query("sessionRecoveryTokens")
      .withIndex("by_tokenHash", q => q.eq("tokenHash", tokenHash))
      .first()

    if (!recoveryRecord) {
      return null
    }

    // Check expiration - don't delete in a query, just return null if expired
    if (recoveryRecord.expiresAt < Date.now()) {
      return null
    }

    // Verify user still exists - don't delete in a query
    const user = await ctx.db.get(recoveryRecord.userId)
    if (!user) {
      return null
    }

    return { userId: recoveryRecord.userId }
  },
})

/**
 * Delete the recovery token for the current user.
 * Call this when user explicitly wants to start fresh.
 */
export const deleteRecoveryToken = mutation({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error("Not authenticated")
    }

    const tokens = await ctx.db
      .query("sessionRecoveryTokens")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect()

    for (const token of tokens) {
      await ctx.db.delete(token._id)
    }
  },
})

/**
 * Clean up expired recovery tokens.
 * This can be called periodically or on sign in.
 */
export const cleanupExpiredTokens = mutation({
  args: {},
  handler: async ctx => {
    const now = Date.now()

    // Get all tokens and delete expired ones
    // Note: In production, you'd want to use a more efficient method
    const tokens = await ctx.db.query("sessionRecoveryTokens").collect()

    for (const token of tokens) {
      if (token.expiresAt < now) {
        await ctx.db.delete(token._id)
      }
    }
  },
})

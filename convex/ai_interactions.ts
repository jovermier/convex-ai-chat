import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * List all AI interactions for a document (most recent first)
 */
export const list = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error("Not authenticated")
    }

    // Verify user owns the document
    const document = await ctx.db.get(args.documentId)
    if (!document || document.userId !== userId) {
      throw new Error("Document not found")
    }

    return await ctx.db
      .query("ai_interactions")
      .withIndex("by_document", q => q.eq("documentId", args.documentId))
      .order("desc")
      .collect()
  },
})

/**
 * Get a single AI interaction by ID
 */
export const get = query({
  args: { interactionId: v.id("ai_interactions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error("Not authenticated")
    }

    const interaction = await ctx.db.get(args.interactionId)
    if (!interaction) {
      return null
    }

    // Verify user owns the interaction
    if (interaction.userId !== userId) {
      throw new Error("Not authorized")
    }

    return interaction
  },
})

/**
 * Create a new AI interaction record (called before making LLM request)
 */
export const create = mutation({
  args: {
    documentId: v.id("documents"),
    request: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error("Not authenticated")
    }

    // Verify user owns the document
    const document = await ctx.db.get(args.documentId)
    if (!document || document.userId !== userId) {
      throw new Error("Document not found")
    }

    const interactionId = await ctx.db.insert("ai_interactions", {
      documentId: args.documentId,
      userId,
      request: args.request,
      timestamp: Date.now(),
      status: "pending",
    })

    return interactionId
  },
})

/**
 * Update an AI interaction with response or error
 */
export const updateResult = mutation({
  args: {
    interactionId: v.id("ai_interactions"),
    response: v.optional(v.string()),
    error: v.optional(v.string()),
    status: v.union(v.literal("success"), v.literal("error")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error("Not authenticated")
    }

    const interaction = await ctx.db.get(args.interactionId)
    if (!interaction) {
      throw new Error("Interaction not found")
    }

    // Verify user owns the interaction
    if (interaction.userId !== userId) {
      throw new Error("Not authorized")
    }

    await ctx.db.patch(args.interactionId, {
      response: args.response,
      error: args.error,
      status: args.status,
    })
  },
})

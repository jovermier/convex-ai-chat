import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"

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
      .query("messages")
      .withIndex("by_document", q => q.eq("documentId", args.documentId))
      .order("asc")
      .collect()
  },
})

export const send = mutation({
  args: {
    documentId: v.id("documents"),
    content: v.string(),
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

    // Insert user message
    const messageId = await ctx.db.insert("messages", {
      documentId: args.documentId,
      role: "user",
      content: args.content,
      timestamp: Date.now(),
      userId,
    })

    return messageId
  },
})

export const addAssistantMessage = mutation({
  args: {
    documentId: v.id("documents"),
    content: v.string(),
    // Optional userId for internal calls (from actions)
    // Using string because v.id() doesn't accept union types
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Use provided userId (from actions) or get from auth context (from client)
    const userId = (args.userId ?? (await getAuthUserId(ctx))) as Id<"users">
    if (!userId) {
      throw new Error("Not authenticated")
    }

    // Verify user owns the document
    const document = await ctx.db.get(args.documentId)
    if (!document || document.userId !== userId) {
      throw new Error("Document not found")
    }

    return await ctx.db.insert("messages", {
      documentId: args.documentId,
      role: "assistant",
      content: args.content,
      timestamp: Date.now(),
      userId,
    })
  },
})

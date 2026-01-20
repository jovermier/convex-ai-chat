import { authTables } from "@convex-dev/auth/server"
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

const applicationTables = {
  documents: defineTable({
    title: v.string(),
    content: v.string(),
    userId: v.id("users"),
    lastModified: v.number(),
    // Human-readable ID like "happy-panda-47" (optional for backward compatibility)
    humanId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_humanId", ["humanId"]),

  messages: defineTable({
    documentId: v.id("documents"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    timestamp: v.number(),
    userId: v.id("users"),
  }).index("by_document", ["documentId", "timestamp"]),

  ai_interactions: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    // Raw LLM request payload (JSON string)
    request: v.string(),
    // Raw LLM response payload (JSON string)
    response: v.optional(v.string()),
    // Error message if the request failed
    error: v.optional(v.string()),
    timestamp: v.number(),
    // Status: "pending", "success", "error"
    status: v.union(v.literal("pending"), v.literal("success"), v.literal("error")),
  }).index("by_document", ["documentId", "timestamp"]),
}

export default defineSchema({
  ...authTables,
  ...applicationTables,
})

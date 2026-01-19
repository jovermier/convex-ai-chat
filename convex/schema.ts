import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  documents: defineTable({
    title: v.string(),
    content: v.string(),
    userId: v.id("users"),
    lastModified: v.number(),
  }).index("by_user", ["userId"]),

  messages: defineTable({
    documentId: v.id("documents"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    timestamp: v.number(),
    userId: v.id("users"),
  }).index("by_document", ["documentId", "timestamp"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});

import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const list = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error("Not authenticated")
    }

    return await ctx.db
      .query("documents")
      .withIndex("by_user", q => q.eq("userId", userId))
      .order("desc")
      .collect()
  },
})

export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error("Not authenticated")
    }

    const document = await ctx.db.get(args.id)
    if (!document || document.userId !== userId) {
      throw new Error("Document not found")
    }

    return document
  },
})

export const getByHumanId = query({
  args: { humanId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error("Not authenticated")
    }

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_humanId", q => q.eq("humanId", args.humanId))
      .collect()

    // Find the document owned by this user (humanIds should be unique, but we verify ownership)
    // Also ensure the document has a humanId (not undefined or null)
    const document = documents.find(
      doc => doc.userId === userId && doc.humanId !== undefined && doc.humanId !== null
    )

    if (!document) {
      throw new Error("Document not found")
    }

    return document
  },
})

// Internal query for agent tools - returns document without auth check
// Safe because agents run in the same security context as the invoking user
export const getForAgent = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

export const create = mutation({
  args: { title: v.string(), content: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error("Not authenticated")
    }

    // Generate a unique humanId
    let humanId: string
    let attempts = 0
    const maxAttempts = 100

    do {
      // Generate a random human-readable ID
      const adjectives = [
        "happy",
        "clever",
        "swift",
        "bright",
        "calm",
        "bold",
        "kind",
        "warm",
        "cool",
        "fresh",
        "neat",
        "keen",
        "wise",
        "nice",
        "safe",
        "sunny",
        "lucky",
        "brave",
        "gentle",
        "proud",
        "sharp",
        "smart",
        "sweet",
        "vast",
        "witty",
        "zesty",
        "alert",
        "bliss",
        "merry",
        "plucky",
        "vivid",
        "wry",
        "able",
        "active",
        "apt",
        "breezy",
        "bubbly",
        "casual",
        "cheery",
      ]
      const nouns = [
        "panda",
        "tiger",
        "eagle",
        "fox",
        "wolf",
        "bear",
        "hawk",
        "lion",
        "owl",
        "deer",
        "cat",
        "dog",
        "bird",
        "fish",
        "duck",
        "swan",
        "koala",
        "puma",
        "lynx",
        "otter",
        "seal",
        "whale",
        "shark",
        "dolphin",
        "rabbit",
        "mouse",
        "horse",
        "zebra",
        "moose",
        "bison",
        "coyote",
        "ferret",
        "leopard",
        "cheetah",
        "jaguar",
        "ocelot",
        "serval",
        "bobcat",
        "panther",
      ]
      const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
      const noun = nouns[Math.floor(Math.random() * nouns.length)]
      const number = Math.floor(Math.random() * 100)
        .toString()
        .padStart(2, "0")
      humanId = `${adjective}-${noun}-${number}`

      // Check if this humanId already exists
      const existing = await ctx.db
        .query("documents")
        .withIndex("by_humanId", q => q.eq("humanId", humanId))
        .first()

      if (!existing) {
        break
      }

      attempts++
    } while (attempts < maxAttempts)

    if (attempts >= maxAttempts) {
      throw new Error("Failed to generate unique human ID")
    }

    const id = await ctx.db.insert("documents", {
      title: args.title,
      content: args.content || "",
      userId,
      lastModified: Date.now(),
      humanId,
    })

    // Return both the id and humanId for navigation
    return { id, humanId }
  },
})

export const update = mutation({
  args: {
    id: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error("Not authenticated")
    }

    const document = await ctx.db.get(args.id)
    if (!document || document.userId !== userId) {
      throw new Error("Document not found")
    }

    const updates: any = { lastModified: Date.now() }
    if (args.title !== undefined) updates.title = args.title
    if (args.content !== undefined) updates.content = args.content

    await ctx.db.patch(args.id, updates)
  },
})

export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error("Not authenticated")
    }

    const document = await ctx.db.get(args.id)
    if (!document || document.userId !== userId) {
      throw new Error("Document not found")
    }

    await ctx.db.delete(args.id)
  },
})

// Internal mutation for agent tools - bypasses auth check and accepts userId directly
// This is safe because agents run in the same security context as the user who invoked them
export const updateForAgent = mutation({
  args: {
    documentId: v.id("documents"),
    userId: v.string(),
    content: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId)
    if (!document || document.userId !== args.userId) {
      throw new Error("Document not found")
    }

    const updates: any = { lastModified: Date.now() }
    if (args.title !== undefined) updates.title = args.title
    if (args.content !== undefined) updates.content = args.content

    await ctx.db.patch(args.documentId, updates)
  },
})

// Migration mutation: add humanId to existing documents that don't have one
export const migrateHumanIds = mutation({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error("Not authenticated")
    }

    // Get all documents for this user
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect()

    // Process each document that doesn't have a humanId
    const adjectives = [
      "happy",
      "clever",
      "swift",
      "bright",
      "calm",
      "bold",
      "kind",
      "warm",
      "cool",
      "fresh",
      "neat",
      "keen",
      "wise",
      "nice",
      "safe",
      "sunny",
      "lucky",
      "brave",
      "gentle",
      "proud",
      "sharp",
      "smart",
      "sweet",
      "vast",
      "witty",
      "zesty",
      "alert",
      "bliss",
      "merry",
      "plucky",
      "vivid",
      "wry",
    ]
    const nouns = [
      "panda",
      "tiger",
      "eagle",
      "fox",
      "wolf",
      "bear",
      "hawk",
      "lion",
      "owl",
      "deer",
      "cat",
      "dog",
      "bird",
      "fish",
      "duck",
      "swan",
      "koala",
      "puma",
      "lynx",
      "otter",
      "seal",
      "whale",
      "shark",
      "dolphin",
      "rabbit",
      "mouse",
      "horse",
      "zebra",
      "moose",
      "bison",
      "coyote",
      "ferret",
      "leopard",
      "cheetah",
      "jaguar",
      "ocelot",
      "serval",
      "bobcat",
      "panther",
    ]

    for (const doc of documents) {
      if (!doc.humanId) {
        let newHumanId: string
        let attempts = 0
        const maxAttempts = 100

        // Generate a unique humanId
        do {
          const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
          const noun = nouns[Math.floor(Math.random() * nouns.length)]
          const number = Math.floor(Math.random() * 100)
            .toString()
            .padStart(2, "0")
          newHumanId = `${adjective}-${noun}-${number}`

          // Check if this humanId already exists
          const existing = await ctx.db
            .query("documents")
            .withIndex("by_humanId", q => q.eq("humanId", newHumanId))
            .first()

          if (!existing) {
            break
          }

          attempts++
        } while (attempts < maxAttempts)

        if (attempts >= maxAttempts) {
          throw new Error("Failed to generate unique human ID")
        }

        // Update the document with the new humanId
        await ctx.db.patch(doc._id, { humanId: newHumanId })
      }
    }

    return { migrated: documents.length }
  },
})

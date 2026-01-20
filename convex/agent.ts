import { createOpenAI } from "@ai-sdk/openai"
import { Agent, createTool } from "@convex-dev/agent"
import { z } from "zod"
import { api, components } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import type { ActionCtx } from "./_generated/server"

// Regex patterns at top level for performance
const HTML_TAG_PATTERN = /<(h[1-6]|p|ul|ol)/i
const OPENING_TAG_PATTERN = /^<([^>]+)>/

// Simple markdown to HTML converter
function markdownToHTML(markdown: string): string {
  if (!markdown) return ""

  let html = markdown

  // Headers
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>")
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>")
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>")

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
  html = html.replace(/__(.*?)__/gim, "<strong>$1</strong>")

  // Italic
  html = html.replace(/\*(.*?)\*/gim, "<em>$1</em>")
  html = html.replace(/_(.*?)_/gim, "<em>$1</em>")

  // Code
  html = html.replace(/`([^`]+)`/gim, "<code>$1</code>")

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>')

  // Line breaks
  html = html.replace(/\n/gim, "<br>")

  return html
}

// Add section IDs to HTML
function addSectionIds(content: string): string {
  if (!content.trim()) return content

  const sections = content.split(
    /(<h[1-6][^>]*>.*?<\/h[1-6]>|<p[^>]*>.*?<\/p>|<ul[^>]*>.*?<\/ul>|<ol[^>]*>.*?<\/ol>)/gi
  )

  let sectionCounter = 1
  return sections
    .map(section => {
      if (section.trim() && section.match(HTML_TAG_PATTERN)) {
        return section.replace(OPENING_TAG_PATTERN, `<$1 id="section-${sectionCounter++}">`)
      }
      return section
    })
    .join("")
}

// Create OpenAI-compatible client pointing to LiteLLM gateway
// Validate required environment variables at module load time
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!OPENAI_BASE_URL || !OPENAI_API_KEY) {
  throw new Error(
    "Missing required environment variables: OPENAI_BASE_URL and OPENAI_API_KEY must be set. " +
      "Run: npx convex env set OPENAI_BASE_URL <url> && npx convex env set OPENAI_API_KEY <key>"
  )
}

if (!OPENAI_BASE_URL.startsWith("https://")) {
  throw new Error("OPENAI_BASE_URL must use HTTPS for secure communication")
}

const litellm = createOpenAI({
  baseURL: OPENAI_BASE_URL,
  apiKey: OPENAI_API_KEY,
})

// System prompt for document editing
const DOCUMENT_EDITOR_SYSTEM_PROMPT = `You are a DOCUMENT EDITOR helping users create and modify documents.

CRITICAL: You MUST use the available tool to edit the document. Do NOT just respond with text - ALWAYS call the tool.

AVAILABLE TOOL:
1. replaceFullDocument - Replace the entire document (use for empty documents or complete rewrites)

YOUR WORKFLOW:
1. When user asks to create or write content -> CALL replaceFullDocument TOOL
2. After calling the tool, briefly explain what you did in text

CONSTRAINTS:
- Always call the tool to make changes
- Use markdown format in tool arguments
- Keep content professional and well-structured`

/**
 * Create a document editor agent for a specific document
 * Tools will directly update the document in the database
 */
export function createDocumentEditorAgent(_ctx: ActionCtx, documentId: Id<"documents">) {
  return new Agent(components.agent, {
    // biome-ignore lint/security/noSecrets: false positive - "DocumentEditor" is not a secret
    name: "DocumentEditor",
    languageModel: litellm.chat("zai/glm-4.6"),
    instructions: DOCUMENT_EDITOR_SYSTEM_PROMPT,
    tools: {
      replaceFullDocument: createTool({
        description:
          "Replace the entire document content (use for empty documents or complete rewrites)",
        args: z.object({
          content: z.string().describe("New full document content in markdown format"),
        }),
        handler: async (toolCtx, args) => {
          // Get the document to find its owner
          const doc = await toolCtx.runQuery(api.documents.getForAgent, {
            id: documentId,
          })
          if (!doc) throw new Error("Document not found")

          // Convert markdown to HTML with section IDs
          const htmlContent = addSectionIds(markdownToHTML(args.content))

          // Update the document directly
          await toolCtx.runMutation(api.documents.updateForAgent, {
            documentId,
            userId: doc.userId,
            content: htmlContent,
            title: doc.title, // Keep title unchanged
          })

          // Return confirmation message for LLM
          return { success: true, action: "replaced" }
        },
      }),
    },
  })
}

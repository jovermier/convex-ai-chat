import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { action } from "./_generated/server"

// Regex patterns at top level for performance
const HTML_TAG_PATTERN = /<(h[1-6]|p|ul|ol)/i
const OPENING_TAG_PATTERN = /^<([^>]+)>/

// LLM request payload type
interface LLMRequestPayload {
  model: string
  messages: Array<{ role: string; content: string }>
  tools?: Array<{
    type: string
    function: {
      name: string
      description: string
      parameters: {
        type: string
        properties: Record<string, { type: string; description: string }>
        required: string[]
      }
    }
  }>
  tool_choice?: string
}

// LLM response payload type
interface LLMResponsePayload {
  choices: Array<{
    message: {
      content: string | null
      tool_calls?: Array<{
        id: string
        type: string
        function: {
          name: string
          arguments: string
        }
      }>
    }
  }>
}

// Simple markdown to HTML converter
function markdownToHTML(markdown: string): string {
  if (!markdown) return ""
  let html = markdown
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>")
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>")
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>")
  html = html.replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
  html = html.replace(/__(.*?)__/gim, "<strong>$1</strong>")
  html = html.replace(/\*(.*?)\*/gim, "<em>$1</em>")
  html = html.replace(/_(.*?)_/gim, "<em>$1</em>")
  html = html.replace(/`([^`]+)`/gim, "<code>$1</code>")
  html = html.replace(/\n/gim, "<br>")
  return html
}

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

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL!
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

/**
 * Stream chat - uses fetch API to make LLM calls
 */
export const streamChat = action({
  args: {
    documentId: v.id("documents"),
    message: v.string(),
    documentContent: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    response: string
    toolCallsCount: number
    hasToolCalls: boolean
    interactionId: Id<"ai_interactions">
  }> => {
    // Get userId from auth context
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error("Not authenticated")
    }

    // Save user message
    await ctx.runMutation(api.messages.send, {
      documentId: args.documentId,
      content: args.message,
    })

    const doc = await ctx.runQuery(api.documents.getForAgent, { id: args.documentId })
    if (!doc) throw new Error("Document not found")

    // Build LLM request payload
    const requestPayload: LLMRequestPayload = {
      model: "zai/glm-4.6v",
      messages: [
        {
          role: "system",
          content:
            "You are a DOCUMENT EDITOR. IMPORTANT: When asked to create content, you MUST call the replaceFullDocument tool.",
        },
        {
          role: "user",
          content: `${args.message}\n\n[Current document:]\n${args.documentContent || "(empty)"}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            // biome-ignore lint/security/noSecrets: false positive - function name is not a secret
            name: "replaceFullDocument",
            description: "Replace the entire document content",
            parameters: {
              type: "object",
              properties: {
                content: {
                  type: "string",
                  description: "New document content in markdown format",
                },
              },
              required: ["content"],
            },
          },
        },
      ],
      tool_choice: "auto",
    }

    // Create AI interaction record with request payload
    const interactionId = await ctx.runMutation(api.ai_interactions.create, {
      documentId: args.documentId,
      request: JSON.stringify(requestPayload, null, 2),
    })

    try {
      // Use fetch API directly to make LLM call (Convex can track this properly)
      console.log("[DEBUG] Calling LLM API...")
      const llmResponse = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(requestPayload),
      })

      console.log("[DEBUG] LLM API call completed")

      if (!llmResponse.ok) {
        const errorText = await llmResponse.text()
        const error = `LLM API error: ${llmResponse.status} ${errorText}`
        // Update interaction with error
        await ctx.runMutation(api.ai_interactions.updateResult, {
          interactionId,
          error,
          status: "error",
        })
        throw new Error(error)
      }

      const llmData = (await llmResponse.json()) as LLMResponsePayload
      console.log("[DEBUG] LLM response received")

      const message = llmData.choices[0].message

      // Debug: show tool calls
      const toolCallsCount = message.tool_calls?.length || 0

      // Update interaction with response
      await ctx.runMutation(api.ai_interactions.updateResult, {
        interactionId,
        response: JSON.stringify(llmData, null, 2),
        status: "success",
      })

      await ctx.runMutation(api.messages.addAssistantMessage, {
        documentId: args.documentId,
        content: `[DEBUG] Tool calls: ${toolCallsCount}. Content: ${message.content?.substring(0, 50) || "none"}...`,
        userId,
      })

      // Process tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log("[DEBUG] Processing tool calls...")
        for (const toolCall of message.tool_calls) {
          const tc = toolCall as any
          // biome-ignore lint/security/noSecrets: false positive - function name is not a secret
          if (tc.function.name === "replaceFullDocument") {
            // This is a tool function name check, not a secret
            const toolArgs = JSON.parse(tc.function.arguments)
            const htmlContent = addSectionIds(markdownToHTML(toolArgs.content))

            await ctx.runMutation(api.documents.updateForAgent, {
              documentId: args.documentId,
              userId: doc.userId,
              content: htmlContent,
              title: doc.title,
            })
            console.log("[DEBUG] Document updated")
          }
        }

        // Get final response
        const finalLlmResponse = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "zai/glm-4.6v",
            messages: [
              { role: "system", content: "You are a helpful assistant." },
              {
                role: "user",
                content: "The document has been updated. Briefly confirm what you did.",
              },
            ],
          }),
        })

        const finalData = await finalLlmResponse.json()
        const responseText = finalData.choices[0].message.content || "Document updated."
        await ctx.runMutation(api.messages.addAssistantMessage, {
          documentId: args.documentId,
          content: responseText,
          userId,
        })

        return { response: responseText, toolCallsCount, hasToolCalls: true, interactionId }
      }

      // No tool called
      const responseText = message.content || "I couldn't update the document."
      await ctx.runMutation(api.messages.addAssistantMessage, {
        documentId: args.documentId,
        content: responseText,
        userId,
      })

      return { response: responseText, toolCallsCount: 0, hasToolCalls: false, interactionId }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Update interaction with error if not already updated
      try {
        await ctx.runMutation(api.ai_interactions.updateResult, {
          interactionId,
          error: errorMessage,
          status: "error",
        })
      } catch {
        // Interaction may have already been updated (e.g., API error case above)
      }

      // Debug: show error
      await ctx.runMutation(api.messages.addAssistantMessage, {
        documentId: args.documentId,
        content: `[ERROR] ${errorMessage}`,
        userId,
      })
      throw error
    }
  },
})

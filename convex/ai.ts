import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";

export const streamChat = action({
  args: {
    documentId: v.id("documents"),
    message: v.string(),
    documentContent: v.string(),
  },
  handler: async (ctx, args) => {
    // Add user message to database
    await ctx.runMutation(api.messages.send, {
      documentId: args.documentId,
      content: args.message,
    });

    // Create system prompt for document editing context
    const systemPrompt = `You are a PROJECT MANAGER helping to document customer requirements and project specifications. The current document content is:

${args.documentContent}

YOUR ROLE:
- Answer questions about the project requirements
- Help define and document what the customer wants done
- Create, modify, and organize project documentation
- Gather requirements and clarify scope

CONSTRAINTS:
- DO NOT write code, scripts, or technical implementations
- Focus on WHAT needs to be done, not HOW to implement it
- Use plain language that stakeholders can understand
- Document requirements, user stories, acceptance criteria, and project scope

AVAILABLE TOOLS FOR EDITING THE DOCUMENT:
1. replace_section(target, content) - Replace an existing section (use target like "section-1", "section-2")
2. insert_section(target, content) - Insert new section after target, or use "start" to insert at beginning
3. append_content(content) - Add new content to the end of the document
4. replace_full_document(content) - Replace the entire document (use for empty documents or complete rewrites)

When you need to edit the document, call the appropriate tool function.
If the document is empty, use replace_full_document to create it.
For existing documents, use section IDs like "section-1", "section-2" to target specific sections.

EXAMPLES OF WHAT YOU SHOULD DO:
- Define project goals and objectives
- Document user stories and acceptance criteria
- Create project timelines and milestones
- Outline feature requirements
- Document business rules and constraints
- Create project structure documents

EXAMPLES OF WHAT YOU SHOULD NOT DO:
- Write actual code or implementations
- Provide technical solutions
- Write database schemas
- Create API endpoints`;

    // Stream response from custom LLM endpoint
    const response = await fetch(
      "https://llm-gateway.hahomelabs.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer sk-GJlXKCzdT-LNopC-hWTsxA`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "zai/glm-4.6",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: args.message },
          ],
          stream: true,
          tool_stream: true,
          tools: [
            {
              type: "function",
              function: {
                name: "replace_section",
                description:
                  "Replace an existing section in the document with new content",
                parameters: {
                  type: "object",
                  properties: {
                    target: {
                      type: "string",
                      description:
                        'Section ID to replace (e.g., "section-1", "section-2")',
                    },
                    content: {
                      type: "string",
                      description: "New content to replace the section with",
                    },
                  },
                  required: ["target", "content"],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "insert_section",
                description:
                  "Insert a new section into the document at a specific position",
                parameters: {
                  type: "object",
                  properties: {
                    target: {
                      type: "string",
                      description:
                        'Section ID to insert after (e.g., "section-1") or "start" for beginning',
                    },
                    content: {
                      type: "string",
                      description: "Content of the new section to insert",
                    },
                  },
                  required: ["target", "content"],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "append_content",
                description: "Append new content to the end of the document",
                parameters: {
                  type: "object",
                  properties: {
                    content: {
                      type: "string",
                      description: "Content to append to the end of the document",
                    },
                  },
                  required: ["content"],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "replace_full_document",
                description:
                  "Replace the entire document content (use for empty documents or complete rewrites)",
                parameters: {
                  type: "object",
                  properties: {
                    content: {
                      type: "string",
                      description: "New full document content",
                    },
                  },
                  required: ["content"],
                },
              },
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.statusText}`);
    }

    let fullResponse = "";
    // Track tool calls by index for streaming assembly
    const finalToolCalls: Map<
      number,
      { name: string; arguments: string }
    > = new Map();

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = ""; // Buffer for incomplete chunks

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode and append to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from buffer
        const lines = buffer.split("\n");
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              // Handle regular content
              if (delta?.content) {
                fullResponse += delta.content;
              }

              // Handle streaming tool calls
              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  const index = toolCall.index;

                  if (!finalToolCalls.has(index)) {
                    // Initialize new tool call
                    finalToolCalls.set(index, {
                      name: toolCall.function?.name || "",
                      arguments: toolCall.function?.arguments || "",
                    });
                  } else {
                    // Append to existing tool call (streaming)
                    const existing = finalToolCalls.get(index)!;
                    if (toolCall.function?.name) {
                      existing.name = toolCall.function.name;
                    }
                    if (toolCall.function?.arguments) {
                      existing.arguments += toolCall.function.arguments;
                    }
                  }
                }
              }
            } catch (e) {
              // Skip invalid JSON lines
              console.warn("Failed to parse SSE line:", line.slice(0, 100));
            }
          }
        }
      }
    }

    // Log final tool calls for debugging
    console.log("Final tool calls received:", Array.from(finalToolCalls.entries()));

    // Parse tool calls into edits array
    const edits: Array<{
      action: string;
      target?: string;
      content: string;
    }> = [];

    // Convert Map to array and parse each tool call
    for (const [_index, toolCall] of finalToolCalls.entries()) {
      try {
        // Skip if arguments are empty or not valid JSON
        if (!toolCall.arguments || toolCall.arguments.trim() === "") {
          console.warn("Skipping tool call with empty arguments:", toolCall.name);
          continue;
        }

        const args = JSON.parse(toolCall.arguments);

        switch (toolCall.name) {
          case "replace_section":
            edits.push({
              action: "replace",
              target: args.target,
              content: args.content,
            });
            break;
          case "insert_section":
            edits.push({
              action: "insert",
              target: args.target,
              content: args.content,
            });
            break;
          case "append_content":
            edits.push({
              action: "append",
              content: args.content,
            });
            break;
          case "replace_full_document":
            edits.push({
              action: "full",
              content: args.content,
            });
            break;
        }
      } catch (e) {
        // Skip invalid tool call arguments
        console.error("Failed to parse tool call arguments:", {
          name: toolCall.name,
          arguments: toolCall.arguments,
          error: e instanceof Error ? e.message : String(e)
        });
      }
    }

    // Chat response is the fullResponse (tool calls don't generate text content)
    const chatResponse = fullResponse.trim();

    // Save complete assistant response (chat part only)
    await ctx.runMutation(api.messages.addAssistantMessage, {
      documentId: args.documentId,
      content:
        chatResponse || "I've made the requested changes to your document.",
    });

    return {
      response:
        chatResponse || "I've made the requested changes to your document.",
      edits: edits,
    };
  },
});

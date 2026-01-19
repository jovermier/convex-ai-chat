import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";
import { createDocumentEditorAgent } from "./agent";

/**
 * Stream chat endpoint - main entry point from frontend
 * Uses the Agent component to generate AI responses with document editing tools
 */
export const streamChat = action({
  args: {
    documentId: v.id("documents"),
    message: v.string(),
    documentContent: v.string(),
  },
  handler: async (ctx, args): Promise<{
    response: string;
    edits: Array<{ action: string; target?: string; content: string }>;
  }> => {
    // Save user message FIRST so it appears immediately in the UI
    await ctx.runMutation(api.messages.send, {
      documentId: args.documentId,
      content: args.message,
    });

    const agent = createDocumentEditorAgent(ctx, args.documentId);

    // Create a new thread for this conversation
    const { threadId } = await agent.createThread(ctx, {
      title: `Document ${args.documentId}`,
    });

    // Generate text using the agent
    // Note: Using 'as any' to bypass type inference issues with the Agent's TextArgs type
    const result = await agent.generateText(
      ctx,
      { threadId },
      {
        messages: [
          {
            role: "user",
            content: `${args.message}\n\n[Current Document Content:]\n${args.documentContent}`,
          },
        ],
      } as any
    );

    // Extract edits from tool results
    const edits: Array<{ action: string; target?: string; content: string }> = [];
    if (result.toolResults) {
      for (const toolResult of result.toolResults) {
        if (toolResult.type === "tool-result" && "output" in toolResult) {
          const output = toolResult.output as unknown;
          if (output && typeof output === "object" && "action" in output) {
            edits.push({
              action: (output as { action: string }).action,
              target: "target" in output ? (output as { target: string }).target : undefined,
              content: "content" in output ? (output as { content: string }).content : "",
            });
          }
        }
      }
    }

    // Save assistant response for compatibility
    const responseText = result.text.trim() || "I've made the requested changes to your document.";
    await ctx.runMutation(api.messages.addAssistantMessage, {
      documentId: args.documentId,
      content: responseText,
    });

    return {
      response: responseText,
      edits,
    };
  },
});

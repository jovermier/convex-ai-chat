import { createOpenAI } from "@ai-sdk/openai";
import { Agent, createTool } from "@convex-dev/agent";
import { z } from "zod";
import { api, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";

// Simple markdown to HTML converter
function markdownToHTML(markdown: string): string {
  if (!markdown) return "";

  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>");
  html = html.replace(/__(.*?)__/gim, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.*?)\*/gim, "<em>$1</em>");
  html = html.replace(/_(.*?)_/gim, "<em>$1</em>");

  // Code
  html = html.replace(/`([^`]+)`/gim, "<code>$1</code>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>');

  // Line breaks
  html = html.replace(/\n/gim, "<br>");

  return html;
}

// Add section IDs to HTML
function addSectionIds(content: string): string {
  if (!content.trim()) return content;

  const sections = content.split(
    /(<h[1-6][^>]*>.*?<\/h[1-6]>|<p[^>]*>.*?<\/p>|<ul[^>]*>.*?<\/ul>|<ol[^>]*>.*?<\/ol>)/gi,
  );

  let sectionCounter = 1;
  return sections
    .map((section) => {
      if (section.trim() && section.match(/<(h[1-6]|p|ul|ol)/i)) {
        return section.replace(
          /^<([^>]+)>/,
          `<$1 id="section-${sectionCounter++}">`,
        );
      }
      return section;
    })
    .join("");
}

// Create OpenAI-compatible client pointing to LiteLLM gateway
// Validate required environment variables at module load time
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_BASE_URL || !OPENAI_API_KEY) {
  throw new Error(
    "Missing required environment variables: OPENAI_BASE_URL and OPENAI_API_KEY must be set. " +
      "Run: npx convex env set OPENAI_BASE_URL <url> && npx convex env set OPENAI_API_KEY <key>",
  );
}

if (!OPENAI_BASE_URL.startsWith("https://")) {
  throw new Error("OPENAI_BASE_URL must use HTTPS for secure communication");
}

const litellm = createOpenAI({
  baseURL: OPENAI_BASE_URL,
  apiKey: OPENAI_API_KEY,
});

// System prompt for document editing
const DOCUMENT_EDITOR_SYSTEM_PROMPT = `You are a DOCUMENT EDITOR helping users create and modify documents.

YOUR ROLE:
- Edit documents based on user requests
- Create new content when asked
- Organize and improve existing content
- Answer questions about the document

HOW TO EDIT:
- Use tools to make changes to the document
- Your text response will be shown in the chat to explain what you did
- Tool calls will actually modify the document content

CONSTRAINTS:
- Use markdown format for document content (headings with #, bold with **, etc.)
- Keep content professional and well-structured
- When replacing sections, maintain the overall document structure

AVAILABLE TOOLS:
- replaceFullDocument: Replace the entire document (use for empty docs or complete rewrites)
- replaceSection: Replace a specific section (use section IDs like section-1, section-2)
- insertSection: Insert new content after a specific section
- appendContent: Add content to the end of the document`;

/**
 * Create a document editor agent for a specific document
 * The documentId is passed to tools via the handler context
 */
export function createDocumentEditorAgent(
  _ctx: ActionCtx,
  documentId: Id<"documents">,
) {
  return new Agent(components.agent, {
    name: "DocumentEditor",
    languageModel: litellm.chat("zai/glm-4.6v"),
    instructions: DOCUMENT_EDITOR_SYSTEM_PROMPT,
    tools: {
      replaceFullDocument: createTool({
        description:
          "Replace the entire document content (use for empty documents or complete rewrites)",
        args: z.object({
          content: z
            .string()
            .describe("New full document content in markdown format"),
        }),
        handler: async (toolCtx, args) => {
          const htmlContent = addSectionIds(markdownToHTML(args.content));
          await toolCtx.runMutation(api.documents.update, {
            id: documentId,
            content: htmlContent,
          });
          return { action: "full", content: htmlContent };
        },
      }),
      replaceSection: createTool({
        description:
          "Replace an existing section in the document with new content",
        args: z.object({
          target: z
            .string()
            .describe('Section ID to replace (e.g., "section-1", "section-2")'),
          content: z.string().describe("New content in markdown format"),
        }),
        handler: async (toolCtx, args) => {
          // Get current document
          const doc = await toolCtx.runQuery(api.documents.get, {
            id: documentId,
          });
          if (!doc) throw new Error("Document not found");

          const htmlContent = markdownToHTML(args.content);
          let newContent = doc.content;

          // Replace the section
          const sectionRegex = new RegExp(
            `<([^>]+id="${args.target}"[^>]*)>.*?</\\1>`,
            "gi",
          );
          if (sectionRegex.test(newContent)) {
            newContent = newContent.replace(
              sectionRegex,
              addSectionIds(htmlContent),
            );
          } else {
            // Section not found, append instead
            newContent += addSectionIds(`<p>${htmlContent}</p>`);
          }

          await toolCtx.runMutation(api.documents.update, {
            id: documentId,
            content: newContent,
          });

          return {
            action: "replace",
            target: args.target,
            content: htmlContent,
          };
        },
      }),
      insertSection: createTool({
        description:
          "Insert a new section into the document at a specific position",
        args: z.object({
          target: z
            .string()
            .describe(
              'Section ID to insert after (e.g., "section-1") or "start" for beginning',
            ),
          content: z
            .string()
            .describe("Content of the new section in markdown format"),
        }),
        handler: async (toolCtx, args) => {
          // Get current document
          const doc = await toolCtx.runQuery(api.documents.get, {
            id: documentId,
          });
          if (!doc) throw new Error("Document not found");

          const htmlContent = markdownToHTML(args.content);
          let newContent = doc.content;

          if (args.target === "start") {
            // Insert at beginning
            newContent = addSectionIds(htmlContent) + newContent;
          } else {
            // Insert after specific section
            const sectionRegex = new RegExp(
              `(<[^>]+id="${args.target}"[^>]*>.*?</[^>]+>)`,
              "gi",
            );
            newContent = newContent.replace(
              sectionRegex,
              `$1${addSectionIds(htmlContent)}`,
            );
          }

          await toolCtx.runMutation(api.documents.update, {
            id: documentId,
            content: newContent,
          });

          return {
            action: "insert",
            target: args.target,
            content: htmlContent,
          };
        },
      }),
      appendContent: createTool({
        description: "Append new content to the end of the document",
        args: z.object({
          content: z.string().describe("Content to append in markdown format"),
        }),
        handler: async (toolCtx, args) => {
          // Get current document
          const doc = await toolCtx.runQuery(api.documents.get, {
            id: documentId,
          });
          if (!doc) throw new Error("Document not found");

          const htmlContent = markdownToHTML(args.content);
          const newContent =
            doc.content + addSectionIds(`<p>${htmlContent}</p>`);

          await toolCtx.runMutation(api.documents.update, {
            id: documentId,
            content: newContent,
          });

          return { action: "append", content: htmlContent };
        },
      }),
    },
    // Allow the agent to make multiple tool calls in a single response
    maxSteps: 5,
  });
}

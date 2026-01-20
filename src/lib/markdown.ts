import { Editor } from "@tiptap/core"
import { Markdown } from "@tiptap/markdown"
import StarterKit from "@tiptap/starter-kit"

/**
 * Converts Markdown string to TipTap HTML
 * Uses TipTap's built-in Markdown extension for conversion
 */
export function markdownToHTML(markdown: string): string {
  if (!markdown || !markdown.trim()) return ""

  // Create a temporary editor instance to parse the markdown
  const tempEditor = new Editor({
    extensions: [StarterKit, Markdown],
    content: markdown,
    contentType: "markdown" as const,
  })

  const html = tempEditor.getHTML()
  tempEditor.destroy()

  return html
}

/**
 * Strip section IDs from HTML
 * This cleans up the section-id attributes that were added for AI targeting
 */
export function cleanSectionIds(html: string): string {
  if (!html) return ""
  // Remove id="section-N" attributes from all elements
  return html.replace(/\s+id="section-[^"]*"/g, "")
}

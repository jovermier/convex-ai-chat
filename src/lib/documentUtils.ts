import { Editor } from "@tiptap/core"
import { Markdown } from "@tiptap/markdown"
import StarterKit from "@tiptap/starter-kit"

// Regex patterns at top level for performance
const HTML_TAG_PATTERN = /<(h[1-6]|p|ul|ol)/i
const ID_ATTRIBUTE_PATTERN = /id=/i
const OPENING_TAG_PATTERN = /^<([^>]+)>/

/**
 * Converts Markdown string to TipTap HTML
 * Uses TipTap's built-in Markdown extension for proper conversion
 * including lists, headings, bold, italic, code, links, etc.
 */
function markdownToHTML(markdown: string): string {
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

// Add section IDs to HTML content for targeted editing
// Only adds IDs to elements that don't already have an id attribute
export const addSectionIds = (content: string): string => {
  if (!content.trim()) return content

  // Split content by major elements (headings, paragraphs, lists)
  const sections = content.split(
    /(<h[1-6][^>]*>.*?<\/h[1-6]>|<p[^>]*>.*?<\/p>|<ul[^>]*>.*?<\/ul>|<ol[^>]*>.*?<\/ol>)/gi
  )

  let sectionCounter = 1
  return sections
    .map(section => {
      if (section.trim() && section.match(HTML_TAG_PATTERN)) {
        // Only add ID if the element doesn't already have one
        if (!section.match(ID_ATTRIBUTE_PATTERN)) {
          return section.replace(OPENING_TAG_PATTERN, `<$1 id="section-${sectionCounter++}">`)
        }
      }
      return section
    })
    .join("")
}

// Apply document edits from AI
// The AI returns markdown, which we convert to HTML before inserting
export const applyDocumentEdits = (currentContent: string, edits: any[]): string => {
  let newContent = currentContent

  for (const edit of edits) {
    // Convert markdown content to HTML
    const htmlContent = markdownToHTML(edit.content)

    if (edit.action === "full") {
      // Replace entire document
      newContent = addSectionIds(htmlContent)
    } else if (edit.action === "append") {
      // Add to end of document
      newContent += addSectionIds(`<p id="section-${Date.now()}">${htmlContent}</p>`)
    } else if (edit.action === "replace" && edit.target !== "full") {
      // Replace specific section
      const sectionRegex = new RegExp(`<([^>]+id="${edit.target}"[^>]*)>.*?</\\1>`, "gi")
      if (sectionRegex.test(newContent)) {
        newContent = newContent.replace(sectionRegex, addSectionIds(htmlContent))
      }
    } else if (edit.action === "insert" && edit.target !== "full") {
      // Insert after specific section
      const sectionRegex = new RegExp(`(<[^>]+id="${edit.target}"[^>]*>.*?</[^>]+>)`, "gi")
      newContent = newContent.replace(sectionRegex, `$1${addSectionIds(htmlContent)}`)
    }
  }

  return newContent
}

// Simple markdown to HTML converter for server-side use
// Basic conversion for common markdown patterns
function markdownToHTML(markdown: string): string {
  if (!markdown) return "";

  let html = markdown;

  // Headers: # H1, ## H2, ### H3, etc.
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>");
  html = html.replace(/__(.*?)__/gim, "<strong>$1</strong>");

  // Italic: *text* or _text_
  html = html.replace(/\*(.*?)\*/gim, "<em>$1</em>");
  html = html.replace(/_(.*?)_/gim, "<em>$1</em>");

  // Code: `text`
  html = html.replace(/`([^`]+)`/gim, "<code>$1</code>");

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>');

  // Line breaks to <br> (but not after block elements)
  html = html.replace(/\n/gim, "<br>");

  return html;
}

// Add section IDs to HTML content for targeted editing
export const addSectionIds = (content: string): string => {
  if (!content.trim()) return content;

  // Split content by major elements (headings, paragraphs, lists)
  const sections = content.split(
    /(<h[1-6][^>]*>.*?<\/h[1-6]>|<p[^>]*>.*?<\/p>|<ul[^>]*>.*?<\/ul>|<ol[^>]*>.*?<\/ol>)/gi
  );

  let sectionCounter = 1;
  return sections
    .map((section) => {
      if (section.trim() && section.match(/<(h[1-6]|p|ul|ol)/i)) {
        return section.replace(
          /^<([^>]+)>/,
          `<$1 id="section-${sectionCounter++}">`
        );
      }
      return section;
    })
    .join("");
};

// Apply document edits from AI
// The AI returns markdown, which we convert to HTML before inserting
export const applyDocumentEdits = (
  currentContent: string,
  edits: any[]
): string => {
  let newContent = currentContent;

  for (const edit of edits) {
    // Convert markdown content to HTML
    const htmlContent = markdownToHTML(edit.content);

    if (edit.action === "full") {
      // Replace entire document
      newContent = addSectionIds(htmlContent);
    } else if (edit.action === "append") {
      // Add to end of document
      newContent += addSectionIds(
        `<p id="section-${Date.now()}">${htmlContent}</p>`
      );
    } else if (edit.action === "replace" && edit.target !== "full") {
      // Replace specific section
      const sectionRegex = new RegExp(
        `<([^>]+id="${edit.target}"[^>]*)>.*?</\\1>`,
        "gi"
      );
      if (sectionRegex.test(newContent)) {
        newContent = newContent.replace(sectionRegex, addSectionIds(htmlContent));
      }
    } else if (edit.action === "insert" && edit.target !== "full") {
      // Insert after specific section
      const sectionRegex = new RegExp(
        `(<[^>]+id="${edit.target}"[^>]*>.*?</[^>]+>)`,
        "gi"
      );
      newContent = newContent.replace(
        sectionRegex,
        `$1${addSectionIds(htmlContent)}`
      );
    }
  }

  return newContent;
};

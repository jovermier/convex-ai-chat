// Add section IDs to content for targeted editing
export const addSectionIds = (content: string): string => {
  if (!content.trim()) return content;
  
  // Split content by major elements (headings, paragraphs, lists)
  const sections = content.split(/(<h[1-6][^>]*>.*?<\/h[1-6]>|<p[^>]*>.*?<\/p>|<ul[^>]*>.*?<\/ul>|<ol[^>]*>.*?<\/ol>)/gi);
  
  let sectionCounter = 1;
  return sections.map(section => {
    if (section.trim() && section.match(/<(h[1-6]|p|ul|ol)/i)) {
      return section.replace(/^<([^>]+)>/, `<$1 id="section-${sectionCounter++}">`);
    }
    return section;
  }).join('');
};

// Apply document edits
export const applyDocumentEdits = (currentContent: string, edits: any[]): string => {
  let newContent = currentContent;
  
  for (const edit of edits) {
    if (edit.action === 'full') {
      // Replace entire document
      newContent = addSectionIds(edit.content);
    } else if (edit.action === 'append') {
      // Add to end of document
      newContent += addSectionIds(`<p id="section-${Date.now()}">${edit.content}</p>`);
    } else if (edit.action === 'replace' && edit.target !== 'full') {
      // Replace specific section
      const sectionRegex = new RegExp(`<([^>]+id="${edit.target}"[^>]*)>.*?</\\1>`, 'gi');
      if (sectionRegex.test(newContent)) {
        newContent = newContent.replace(sectionRegex, addSectionIds(edit.content));
      }
    } else if (edit.action === 'insert' && edit.target !== 'full') {
      // Insert after specific section
      const sectionRegex = new RegExp(`(<[^>]+id="${edit.target}"[^>]*>.*?</[^>]+>)`, 'gi');
      newContent = newContent.replace(sectionRegex, `$1${addSectionIds(edit.content)}`);
    }
  }
  
  return newContent;
};

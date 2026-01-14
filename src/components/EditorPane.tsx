import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";

interface EditorPaneProps {
  title: string;
  content: string;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onSave: () => void;
}

export function EditorPane({
  title,
  content,
  onTitleChange,
  onContentChange,
  onSave,
}: EditorPaneProps) {
  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const handleFormat = useCallback((command: string, value?: string) => {
    // Focus the editor first
    editorRef.current?.focus();

    // Use execCommand for formatting - still works in most browsers for contentEditable
    const success = document.execCommand(command, false, value || '');

    // Trigger content change update
    if (editorRef.current) {
      onContentChange(editorRef.current.innerHTML);
    }
  }, [onContentChange]);

  const handleContentChange = useCallback(() => {
    if (editorRef.current) {
      onContentChange(editorRef.current.innerHTML);
    }
  }, [onContentChange]);

  // Update editor content when the content prop changes (but only if not focused)
  useEffect(() => {
    if (editorRef.current && !isEditing) {
      // Only update if content is significantly different to avoid cursor jumping
      const currentHTML = editorRef.current.innerHTML;
      if (currentHTML !== content) {
        editorRef.current.innerHTML = content;
      }
    }
  }, [content, isEditing]);

  const handleExportPDF = () => {
    window.print();
  };

  const handleExportDOCX = () => {
    // Simple HTML to DOCX export (basic implementation)
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
        </head>
        <body>
          <h1>${title}</h1>
          ${content}
        </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Document exported");
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="text-xl font-semibold bg-transparent border-none outline-none flex-1"
            placeholder="Document title..."
          />
          <div className="flex space-x-2">
            <button
              onClick={onSave}
              className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-hover transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleExportPDF}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50 transition-colors"
            >
              PDF
            </button>
            <button
              onClick={handleExportDOCX}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50 transition-colors"
            >
              DOCX
            </button>
          </div>
        </div>

        {/* Formatting Toolbar */}
        <div className="flex items-center space-x-2 text-sm">
          <button
            onClick={() => handleFormat('undo')}
            className="p-2 border rounded hover:bg-gray-50 transition-colors"
            title="Undo"
          >
            ↶
          </button>
          <button
            onClick={() => handleFormat('redo')}
            className="p-2 border rounded hover:bg-gray-50 transition-colors"
            title="Redo"
          >
            ↷
          </button>
          <div className="w-px h-6 bg-gray-300"></div>
          <button
            onClick={() => handleFormat('bold')}
            className="p-2 border rounded hover:bg-gray-50 transition-colors"
            title="Bold"
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => handleFormat('italic')}
            className="p-2 border rounded hover:bg-gray-50 transition-colors"
            title="Italic"
          >
            <em>I</em>
          </button>
          <button
            onClick={() => handleFormat('underline')}
            className="p-2 border rounded hover:bg-gray-50 transition-colors"
            title="Underline"
          >
            <u>U</u>
          </button>
          <div className="w-px h-6 bg-gray-300"></div>
          <button
            onClick={() => handleFormat('formatBlock', 'h1')}
            className="px-3 py-2 border rounded hover:bg-gray-50 transition-colors"
            title="Heading 1"
          >
            H1
          </button>
          <button
            onClick={() => handleFormat('formatBlock', 'h2')}
            className="px-3 py-2 border rounded hover:bg-gray-50 transition-colors"
            title="Heading 2"
          >
            H2
          </button>
          <button
            onClick={() => handleFormat('formatBlock', 'p')}
            className="px-3 py-2 border rounded hover:bg-gray-50 transition-colors"
            title="Paragraph"
          >
            P
          </button>
          <div className="w-px h-6 bg-gray-300"></div>
          <button
            onClick={() => handleFormat('insertUnorderedList')}
            className="p-2 border rounded hover:bg-gray-50 transition-colors"
            title="Bullet List"
          >
            •
          </button>
          <button
            onClick={() => handleFormat('insertOrderedList')}
            className="p-2 border rounded hover:bg-gray-50 transition-colors"
            title="Numbered List"
          >
            1.
          </button>
          <button
            onClick={() => {
              const url = prompt('Enter URL:');
              if (url) handleFormat('createLink', url);
            }}
            className="p-2 border rounded hover:bg-gray-50 transition-colors"
            title="Insert Link"
          >
            🔗
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleContentChange}
          onFocus={() => setIsEditing(true)}
          onBlur={() => {
            setIsEditing(false);
            handleContentChange();
          }}
          className="h-full p-6 outline-none prose prose-lg max-w-none"
          style={{ minHeight: '100%' }}
          suppressContentEditableWarning
        />
      </div>

      {/* Status Bar */}
      <div className="p-2 border-t bg-gray-50 text-xs text-gray-500 flex justify-between">
        <span>
          {content.replace(/<[^>]*>/g, '').length} characters
        </span>
        <span>
          {isEditing ? 'Editing...' : 'Ready'}
        </span>
      </div>
    </div>
  );
}

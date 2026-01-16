import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { toast } from "sonner";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";

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
  const isUpdatingRef = useRef(false); // Track if we're updating from external source
  const lastKnownContentRef = useRef(content); // Track last known content

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      CharacterCount,
      Placeholder.configure({
        placeholder: "Start writing your document...",
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      // Only trigger callback if this is a user edit (not an external update)
      if (!isUpdatingRef.current) {
        onContentChange(editor.getHTML());
      }
      // Reset the flag after update
      isUpdatingRef.current = false;
    },
    editorProps: {
      attributes: {
        class: "h-full p-6 outline-none focus:outline-none",
      },
    },
  });

  // Update editor content when the content prop changes from external sources (e.g., AI edits)
  useEffect(() => {
    if (editor && content !== lastKnownContentRef.current) {
      const currentHTML = editor.getHTML();
      // Only update if content is meaningfully different
      if (currentHTML !== content) {
        isUpdatingRef.current = true; // Mark as external update
        editor.commands.setContent(content, false); // false = don't emit update event
        lastKnownContentRef.current = content;
      }
    }
  }, [content, editor]);

  const handleExportPDF = () => {
    window.print();
  };

  const handleExportDOCX = () => {
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

    const blob = new Blob([htmlContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Document exported");
  };

  if (!editor) {
    return (
      <div className="h-full flex items-center justify-center bg-card">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Toolbar */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-center justify-between mb-4">
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="text-xl font-semibold bg-transparent border-none outline-none flex-1 placeholder:text-muted-foreground text-card-foreground"
            placeholder="Document title..."
          />
          <div className="flex space-x-2">
            <button
              onClick={onSave}
              className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleExportPDF}
              className="px-3 py-1 text-sm border rounded hover:bg-muted transition-colors text-foreground"
            >
              PDF
            </button>
            <button
              onClick={handleExportDOCX}
              className="px-3 py-1 text-sm border rounded hover:bg-muted transition-colors text-foreground"
            >
              DOCX
            </button>
          </div>
        </div>

        {/* Formatting Toolbar */}
        <div className="flex items-center space-x-2 text-sm">
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-2 border rounded hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
            title="Undo"
          >
            ↶
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-2 border rounded hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
            title="Redo"
          >
            ↷
          </button>
          <div className="w-px h-6 bg-border"></div>
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 border rounded transition-colors text-foreground ${
              editor.isActive("bold")
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
            title="Bold"
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 border rounded transition-colors text-foreground ${
              editor.isActive("italic")
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
            title="Italic"
          >
            <em>I</em>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-2 border rounded transition-colors text-foreground ${
              editor.isActive("strike")
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
            title="Strikethrough"
          >
            <s>S</s>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-2 border rounded transition-colors text-foreground ${
              editor.isActive("code")
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
            title="Code"
          >
            {'</>'}
          </button>
          <div className="w-px h-6 bg-border"></div>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-3 py-2 border rounded transition-colors text-foreground ${
              editor.isActive("heading", { level: 1 })
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
            title="Heading 1"
          >
            H1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-3 py-2 border rounded transition-colors text-foreground ${
              editor.isActive("heading", { level: 2 })
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
            title="Heading 2"
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-3 py-2 border rounded transition-colors text-foreground ${
              editor.isActive("heading", { level: 3 })
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
            title="Heading 3"
          >
            H3
          </button>
          <button
            onClick={() => editor.chain().focus().setParagraph().run()}
            className={`px-3 py-2 border rounded transition-colors text-foreground ${
              editor.isActive("paragraph")
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
            title="Paragraph"
          >
            P
          </button>
          <div className="w-px h-6 bg-border"></div>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 border rounded transition-colors text-foreground ${
              editor.isActive("bulletList")
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
            title="Bullet List"
          >
            •
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 border rounded transition-colors text-foreground ${
              editor.isActive("orderedList")
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
            title="Numbered List"
          >
            1.
          </button>
          <button
            onClick={() => {
              const url = prompt("Enter URL:");
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
            className={`p-2 border rounded transition-colors text-foreground ${
              editor.isActive("link")
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
            title="Insert Link"
          >
            🔗
          </button>
          <button
            onClick={() => editor.chain().focus().unsetLink().run()}
            disabled={!editor.isActive("link")}
            className="p-2 border rounded hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
            title="Remove Link"
          >
            🔗✕
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto bg-card">
        <EditorContent editor={editor} style={{ minHeight: "100%" }} />
      </div>

      {/* Status Bar */}
      <div className="p-2 border-t bg-muted text-xs flex justify-between">
        <span className="text-foreground">
          {editor.storage.characterCount?.characters() || 0} characters
        </span>
        <span className="text-foreground">{editor.isFocused ? "Editing..." : "Ready"}</span>
      </div>
    </div>
  );
}

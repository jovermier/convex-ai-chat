import { useMutation } from "convex/react"
import { toast } from "sonner"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

interface Document {
  _id: Id<"documents">
  title: string
  lastModified: number
}

interface DocumentListProps {
  documents: Document[]
  selectedDocumentId: Id<"documents"> | null
  onSelectDocument: (id: Id<"documents">) => void
  onCreateDocument: () => void
}

export function DocumentList({
  documents,
  selectedDocumentId,
  onSelectDocument,
  onCreateDocument,
}: DocumentListProps) {
  const deleteDocument = useMutation(api.documents.remove)

  const handleDeleteDocument = async (id: Id<"documents">, e: React.MouseEvent) => {
    e.stopPropagation()

    if (confirm("Are you sure you want to delete this document?")) {
      try {
        await deleteDocument({ id })
        toast.success("Document deleted")
      } catch (_error) {
        toast.error("Failed to delete document")
      }
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b bg-card">
        <button
          onClick={onCreateDocument}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          New Document
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-background">
        {documents.map(doc => (
          <div
            key={doc._id}
            onClick={() => onSelectDocument(doc._id)}
            className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
              selectedDocumentId === doc._id ? "bg-muted border-l-4 border-l-primary" : ""
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate text-foreground">{doc.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(doc.lastModified).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={e => handleDeleteDocument(doc._id, e)}
                className="ml-2 p-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

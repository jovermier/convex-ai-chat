import { useMutation, useQuery } from "convex/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { addSectionIds } from "../lib/documentUtils"
import { ChatPane } from "./ChatPane"
import { DocumentList } from "./DocumentList"
import { EditorPane } from "./EditorPane"

export function DocumentEditor() {
  const [selectedDocumentId, setSelectedDocumentId] = useState<Id<"documents"> | null>(null)
  const [documentContent, setDocumentContent] = useState("")
  const [documentTitle, setDocumentTitle] = useState("")

  const documents = useQuery(api.documents.list)
  const selectedDocument = useQuery(
    api.documents.get,
    selectedDocumentId ? { id: selectedDocumentId } : "skip"
  )

  const createDocument = useMutation(api.documents.create)
  const updateDocument = useMutation(api.documents.update)

  // Auto-select first document or create one if none exist
  useEffect(() => {
    if (documents && documents.length > 0 && !selectedDocumentId) {
      setSelectedDocumentId(documents[0]._id)
    } else if (documents && documents.length === 0) {
      handleCreateDocument()
    }
  }, [documents, selectedDocumentId])

  // Track if we've already initialized this document to prevent overwrites
  const [initializedDocuments, setInitializedDocuments] = useState<Set<string>>(new Set())

  // Update local state when document changes (only on first load or document switch)
  useEffect(() => {
    if (selectedDocument) {
      const docId = selectedDocument._id.toString()

      // Only update if this document hasn't been initialized yet
      if (!initializedDocuments.has(docId)) {
        // Ensure content has section IDs for AI targeting
        const contentWithIds = selectedDocument.content
          ? addSectionIds(selectedDocument.content)
          : ""
        setDocumentContent(contentWithIds)
        setDocumentTitle(selectedDocument.title)

        // Update the document in database if IDs were added
        if (contentWithIds !== selectedDocument.content && contentWithIds.trim()) {
          updateDocument({
            id: selectedDocument._id,
            content: contentWithIds,
          })
        }

        // Mark as initialized
        setInitializedDocuments(prev => new Set(prev).add(docId))
      }
    }
  }, [selectedDocument?._id]) // Only depend on document ID, not content

  const handleCreateDocument = async () => {
    try {
      const result = await createDocument({
        title: "Untitled Document",
        content: "",
      })
      setSelectedDocumentId(result.id)
      toast.success("New document created")
    } catch (error) {
      toast.error("Failed to create document")
    }
  }

  // Track last saved content to detect actual changes
  const lastSavedContentRef = useRef<string | null>(null)
  const lastSavedTitleRef = useRef<string | null>(null)

  // Update refs when content is successfully saved
  const handleSaveDocument = async () => {
    if (!selectedDocumentId) return

    try {
      await updateDocument({
        id: selectedDocumentId,
        title: documentTitle,
        content: documentContent,
      })
      // Update refs to track what was last saved
      lastSavedContentRef.current = documentContent
      lastSavedTitleRef.current = documentTitle
      toast.success("Document saved")
    } catch (error) {
      toast.error("Failed to save document")
    }
  }

  // Initialize refs when document loads
  useEffect(() => {
    if (selectedDocument) {
      lastSavedContentRef.current = selectedDocument.content
      lastSavedTitleRef.current = selectedDocument.title
    }
  }, [selectedDocument?._id])

  // Auto-save every 5 seconds
  useEffect(() => {
    if (!selectedDocumentId) return

    const interval = setInterval(() => {
      // Only save if content has actually changed from last saved state
      if (
        documentContent !== lastSavedContentRef.current ||
        documentTitle !== lastSavedTitleRef.current
      ) {
        handleSaveDocument()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [selectedDocumentId, documentContent, documentTitle])

  if (!documents) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Document List Sidebar */}
      <div className="w-64 border-r bg-card">
        <DocumentList
          documents={documents}
          selectedDocumentId={selectedDocumentId}
          onSelectDocument={setSelectedDocumentId}
          onCreateDocument={handleCreateDocument}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Chat Pane */}
        <div className="w-1/2 border-r">
          <ChatPane
            documentId={selectedDocumentId}
            documentContent={documentContent}
            onApplyEdit={newContent => setDocumentContent(newContent)}
          />
        </div>

        {/* Editor Pane */}
        <div className="w-1/2">
          <EditorPane
            title={documentTitle}
            content={documentContent}
            onTitleChange={setDocumentTitle}
            onContentChange={setDocumentContent}
            onSave={handleSaveDocument}
          />
        </div>
      </div>
    </div>
  )
}

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { ChatPane } from "../components/ChatPane"
import { DocumentList } from "../components/DocumentList"
import { EditorPane } from "../components/EditorPane"
import { addSectionIds } from "../lib/documentUtils"

export const Route = createFileRoute("/d/$humanId")({
  component: DocumentRoute,
  csr: true, // Use client-side rendering for interactive editor
})

function DocumentRoute() {
  const { humanId } = Route.useParams()
  const navigate = useNavigate()

  const [documentContent, setDocumentContent] = useState("")
  const [documentTitle, setDocumentTitle] = useState("")
  // Track if user is currently editing to avoid overwriting their input
  const [isUserEditing, setIsUserEditing] = useState(false)
  // Track which document we've initialized section IDs for
  const [initializedDocuments, setInitializedDocuments] = useState<Set<string>>(new Set())

  const documents = useQuery(api.documents.list)
  const selectedDocument = useQuery(api.documents.getByHumanId, { humanId })

  const createDocument = useMutation(api.documents.create)
  const updateDocument = useMutation(api.documents.update)

  // Track refs for auto-save
  const lastSavedContentRef = useRef<string | null>(null)
  const lastSavedTitleRef = useRef<string | null>(null)
  // Track the last known content from the server to detect external changes
  const lastServerContentRef = useRef<string | null>(null)

  // Auto-create a document if none exist
  useEffect(() => {
    if (documents && documents.length === 0) {
      handleCreateDocument()
    }
  }, [documents])

  // Synchronize local state with server data
  useEffect(() => {
    if (!selectedDocument) return

    const docId = selectedDocument._id.toString()
    const rawContent = selectedDocument.content || ""

    // Check if content was updated externally (by AI)
    if (lastServerContentRef.current !== null && lastServerContentRef.current !== rawContent) {
      // External change detected - update local state
      const contentWithIds = rawContent ? addSectionIds(rawContent) : ""
      setDocumentContent(contentWithIds)
      setDocumentTitle(selectedDocument.title)
      lastServerContentRef.current = rawContent
      lastSavedContentRef.current = contentWithIds
      return
    }

    // First time seeing this document or content has changed
    if (!initializedDocuments.has(docId) || lastServerContentRef.current !== rawContent) {
      const contentWithIds = rawContent ? addSectionIds(rawContent) : ""
      setDocumentContent(contentWithIds)
      setDocumentTitle(selectedDocument.title)

      // Update the document in database if section IDs were added
      if (contentWithIds !== rawContent && contentWithIds.trim()) {
        updateDocument({
          id: selectedDocument._id,
          content: contentWithIds,
        })
      }

      // Mark as initialized
      setInitializedDocuments(prev => new Set(prev).add(docId))
      lastServerContentRef.current = rawContent
      lastSavedContentRef.current = contentWithIds
    }
  }, [selectedDocument?._id, selectedDocument?.content, selectedDocument?.title])

  const handleCreateDocument = async () => {
    try {
      const result = await createDocument({
        title: "Untitled Document",
        content: "",
      })
      // Navigate to the new document using its humanId
      navigate({ to: "/d/$humanId", params: { humanId: result.humanId } })
      toast.success("New document created")
    } catch {
      toast.error("Failed to create document")
    }
  }

  const handleSelectDocument = (id: Id<"documents">) => {
    const doc = documents?.find(d => d._id === id)
    if (doc?.humanId) {
      navigate({ to: "/d/$humanId", params: { humanId: doc.humanId } })
    }
  }

  const handleSaveDocument = async () => {
    if (!selectedDocument) return

    try {
      await updateDocument({
        id: selectedDocument._id,
        title: documentTitle,
        content: documentContent,
      })
      lastSavedContentRef.current = documentContent
      lastSavedTitleRef.current = documentTitle
      // Update server content ref since we just saved
      lastServerContentRef.current = documentContent
      toast.success("Document saved")
    } catch {
      toast.error("Failed to save document")
    }
  }

  // Auto-save every 5 seconds
  useEffect(() => {
    if (!selectedDocument) return

    const interval = setInterval(() => {
      if (
        documentContent !== lastSavedContentRef.current ||
        documentTitle !== lastSavedTitleRef.current
      ) {
        handleSaveDocument()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [selectedDocument?._id, documentContent, documentTitle])

  // Redirect to home if document doesn't exist (was deleted or invalid humanId)
  useEffect(() => {
    if (documents && selectedDocument === null && humanId) {
      // Document was deleted or humanId is invalid - redirect to home silently
      navigate({ to: "/" })
    }
  }, [documents, selectedDocument, humanId, navigate])

  if (!documents) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!selectedDocument) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Loading document...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Document List Sidebar */}
      <div className="w-64 border-r bg-card">
        <DocumentList
          documents={documents}
          selectedDocumentId={selectedDocument?._id ?? null}
          onSelectDocument={handleSelectDocument}
          onCreateDocument={handleCreateDocument}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Chat Pane */}
        <div className="w-1/2 border-r">
          <ChatPane
            documentId={selectedDocument?._id ?? null}
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

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useConvexAuth, useMutation, useQuery } from "convex/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { ChatPane } from "../components/ChatPane"
import { DocumentList } from "../components/DocumentList"
import { DocumentVisibilitySettings } from "../components/DocumentVisibilitySettings"
import { EditorPane } from "../components/EditorPane"
import { PublicDocumentView } from "../components/PublicDocumentView"
import { addSectionIds } from "../lib/documentUtils"

export const Route = createFileRoute("/d/$humanId")({
  component: DocumentRoute,
  csr: true, // Use client-side rendering for interactive editor
})

function DocumentRoute() {
  const { humanId } = Route.useParams()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()

  const [documentContent, setDocumentContent] = useState("")
  const [documentTitle, setDocumentTitle] = useState("")
  // Track if user is currently editing to avoid overwriting their input
  const [isUserEditing, setIsUserEditing] = useState(false)
  // Track which document we've initialized section IDs for
  const [initializedDocuments, setInitializedDocuments] = useState<Set<string>>(new Set())

  // Refs for tracking server and saved content
  const lastServerContentRef = useRef<string | null>(null)
  const lastSavedContentRef = useRef<string>("")
  const lastSavedTitleRef = useRef<string>("")

  // Mutations
  const createDocument = useMutation(api.documents.create)
  const updateDocument = useMutation(api.documents.update)

  // Queries - always called to maintain consistent hook order
  const publicDocument = useQuery(api.documents.getByHumanIdPublic, { humanId })
  const documents = useQuery(api.documents.list)
  const selectedDocument = useQuery(api.documents.getByHumanId, { humanId })

  // Auto-create a document if none exist
  const handleCreateDocument = async () => {
    try {
      const result = await createDocument({
        title: "Untitled Document",
        content: "",
      })
      navigate({ to: "/d/$humanId", params: { humanId: result.humanId } })
      toast.success("New document created")
    } catch {
      toast.error("Failed to create document")
    }
  }

  // All useEffect hooks must come before any early returns
  useEffect(() => {
    if (documents && documents.length === 0 && isAuthenticated) {
      handleCreateDocument()
    }
  }, [documents, isAuthenticated])

  useEffect(() => {
    if (!selectedDocument) return

    const docId = selectedDocument._id.toString()
    const rawContent = selectedDocument.content || ""

    if (lastServerContentRef.current !== null && lastServerContentRef.current !== rawContent) {
      const contentWithIds = rawContent ? addSectionIds(rawContent) : ""
      setDocumentContent(contentWithIds)
      setDocumentTitle(selectedDocument.title)
      lastServerContentRef.current = rawContent
      lastSavedContentRef.current = contentWithIds
      return
    }

    if (!initializedDocuments.has(docId) || lastServerContentRef.current !== rawContent) {
      const contentWithIds = rawContent ? addSectionIds(rawContent) : ""
      setDocumentContent(contentWithIds)
      setDocumentTitle(selectedDocument.title)

      if (contentWithIds !== rawContent && contentWithIds.trim()) {
        updateDocument({
          id: selectedDocument._id,
          content: contentWithIds,
        })
      }

      setInitializedDocuments(prev => new Set(prev).add(docId))
      lastServerContentRef.current = rawContent
      lastSavedContentRef.current = contentWithIds
    }
  }, [
    selectedDocument?._id,
    selectedDocument?.content,
    selectedDocument?.title,
    initializedDocuments,
    updateDocument,
  ])

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
      lastServerContentRef.current = documentContent
      toast.success("Document saved")
    } catch {
      toast.error("Failed to save document")
    }
  }

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

  // Redirect to home if document doesn't exist and wasn't public
  useEffect(() => {
    if (
      !authLoading &&
      !publicDocument?.document &&
      selectedDocument === null &&
      isAuthenticated &&
      documents
    ) {
      navigate({ to: "/" })
    }
  }, [authLoading, publicDocument, selectedDocument, isAuthenticated, documents, navigate])

  // Calculate conditions for rendering (no hooks after this point)
  const shouldShowPublicView =
    publicDocument?.document && !authLoading && (!isAuthenticated || !selectedDocument)

  // Early returns based on conditions (all hooks already called)
  if (shouldShowPublicView) {
    return <PublicDocumentView humanId={humanId} />
  }

  if (authLoading || (!isAuthenticated && publicDocument === undefined)) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated && !publicDocument?.document) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please sign in to access this document</p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="px-4 py-2 bg-primary text-white rounded hover:opacity-90"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

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
            statusExtra={
              selectedDocument && (
                <DocumentVisibilitySettings
                  documentId={selectedDocument._id}
                  visibility={selectedDocument.visibility}
                  humanId={selectedDocument.humanId}
                />
              )
            }
          />
        </div>
      </div>
    </div>
  )
}

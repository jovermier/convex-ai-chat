"use client"

import { useNavigate } from "@tanstack/react-router"
import { useConvexAuth, useMutation, useQuery } from "convex/react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { api } from "../../convex/_generated/api"

interface PublicDocumentViewProps {
  humanId: string
}

export function PublicDocumentView({ humanId }: PublicDocumentViewProps) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()
  const navigate = useNavigate()

  // Fetch public document (no auth required)
  const publicDoc = useQuery(api.documents.getByHumanIdPublic, { humanId })
  const cloneDocument = useMutation(api.documents.cloneDocument)
  const [isCloning, setIsCloning] = useState(false)

  // Debug logging
  if (typeof window !== "undefined" && publicDoc !== undefined) {
    console.log("[PublicDocumentView] Debug:", {
      humanId,
      authLoading,
      isAuthenticated,
      publicDoc: publicDoc?.document
        ? { title: publicDoc.document.title, hasContent: !!publicDoc.document.content }
        : publicDoc?.notFound
          ? "notFound"
          : "null",
    })
  }

  // If user is authenticated, also check if they own this document
  const ownedDocument = useQuery(
    api.documents.getByHumanId,
    isAuthenticated ? { humanId } : undefined
  )

  const document = ownedDocument ?? publicDoc?.document ?? null
  const isOwner = !!ownedDocument

  // If the user owns this document, redirect to the full editor
  useEffect(() => {
    if (isOwner && isAuthenticated) {
      // User owns this document, redirect to normal edit view
      navigate({ to: "/d/$humanId", params: { humanId } })
    }
  }, [isOwner, isAuthenticated, humanId, navigate])

  if (authLoading || !publicDoc) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">
            Loading... {authLoading ? "auth" : "query"}
          </p>
        </div>
      </div>
    )
  }

  // Document not found or is private
  if (publicDoc.notFound || !document) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center max-w-md p-8">
          <h1 className="text-2xl font-bold mb-4">Document Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This document may be private, deleted, or the link may be incorrect.
          </p>
          {isAuthenticated ? (
            <button
              onClick={() => navigate({ to: "/" })}
              className="px-4 py-2 bg-primary text-white rounded hover:opacity-90"
            >
              Go to My Documents
            </button>
          ) : (
            <button
              onClick={() => navigate({ to: "/" })}
              className="px-4 py-2 bg-primary text-white rounded hover:opacity-90"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    )
  }

  const handleClone = async () => {
    if (!isAuthenticated) {
      toast.error("Please sign in to clone this document")
      navigate({ to: "/" })
      return
    }

    setIsCloning(true)
    try {
      const result = await cloneDocument({ humanId })
      toast.success("Document cloned successfully")
      navigate({ to: "/d/$humanId", params: { humanId: result.humanId } })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clone document")
    } finally {
      setIsCloning(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="shrink-0 z-10 bg-background/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-primary">AI Document Editor</h2>
          {document.visibility === "public_link" && (
            <span className="text-sm px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
              Public
            </span>
          )}
        </div>
        {isAuthenticated ? (
          <button
            onClick={() => navigate({ to: "/" })}
            className="px-4 py-2 rounded bg-background text-foreground border border-input font-semibold hover:bg-muted transition-colors shadow-sm hover:shadow"
          >
            My Documents
          </button>
        ) : (
          <button
            onClick={() => navigate({ to: "/" })}
            className="px-4 py-2 rounded bg-background text-foreground border border-input font-semibold hover:bg-muted transition-colors shadow-sm hover:shadow"
          >
            Sign In
          </button>
        )}
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Document content */}
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold">{document.title}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {!isOwner && (
                  <>
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
                      View only
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="prose prose-slate dark:prose-invert max-w-none whitespace-pre-wrap">
              {document.content}
            </div>
          </div>
        </div>

        {/* Sidebar with clone option */}
        <div className="w-80 border-l bg-card p-6 overflow-auto">
          <h2 className="font-semibold mb-4 text-lg">Document Options</h2>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-3">
                {isAuthenticated
                  ? "Save a copy of this document to your account to edit it."
                  : "Sign in to save a copy of this document to your account."}
              </p>
              <button
                onClick={handleClone}
                disabled={isCloning}
                className="w-full px-4 py-2 bg-primary text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isCloning
                  ? "Cloning..."
                  : isAuthenticated
                    ? "Clone to My Account"
                    : "Sign In to Clone"}
              </button>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-medium mb-2">Share this document</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Anyone with this link can view this document.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/d/${humanId}`}
                  className="flex-1 px-2 py-1 text-sm bg-background border rounded"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/d/${humanId}`)
                    toast.success("Link copied to clipboard")
                  }}
                  className="px-3 py-1 text-sm bg-primary text-white rounded hover:opacity-90"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              <p>Last modified: {new Date(document.lastModified).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

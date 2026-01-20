import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery } from "convex/react"
import { useEffect } from "react"
import { api } from "../../convex/_generated/api"

export const Route = createFileRoute("/")({
  component: Index,
  csr: true, // Use client-side rendering
})

function Index() {
  const documents = useQuery(api.documents.list)
  const createDocument = useMutation(api.documents.create)
  const navigate = useNavigate()

  // Auto-create and navigate to a new document if none exist
  useEffect(() => {
    async function createFirstDocument() {
      if (documents && documents.length === 0) {
        const result = await createDocument({
          title: "Untitled Document",
          content: "",
        })
        navigate({
          to: "/d/$humanId",
          params: { humanId: result.humanId },
        })
      }
    }
    createFirstDocument()
  }, [documents, createDocument, navigate])

  // If user has documents, redirect to the first one
  useEffect(() => {
    if (documents && documents.length > 0) {
      const firstDoc = documents[0]
      if (firstDoc.humanId) {
        navigate({
          to: "/d/$humanId",
          params: { humanId: firstDoc.humanId },
        })
      }
    }
  }, [documents, navigate])

  // Show loading state while redirecting
  return (
    <div className="flex justify-center items-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )
}

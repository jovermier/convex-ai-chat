"use client"

import { useMutation } from "convex/react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

interface DocumentVisibilitySettingsProps {
  documentId: Id<"documents">
  visibility: "private" | "public_link" | undefined
  humanId: string | undefined
}

export function DocumentVisibilitySettings({
  documentId,
  visibility,
  humanId,
}: DocumentVisibilitySettingsProps) {
  const updateVisibility = useMutation(api.documents.updateVisibility)
  const [isUpdating, setIsUpdating] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  // Build share URL only on client side
  useEffect(() => {
    if (humanId && typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/d/${humanId}`)
    }
  }, [humanId])

  const currentVisibility = visibility ?? "private"

  const handleVisibilityChange = async (newVisibility: "private" | "public_link") => {
    if (newVisibility === currentVisibility) return

    setIsUpdating(true)
    try {
      await updateVisibility({ id: documentId, visibility: newVisibility })
      toast.success(
        newVisibility === "public_link"
          ? "Document is now publicly accessible via link"
          : "Document is now private"
      )
    } catch (error) {
      toast.error("Failed to update document visibility")
    } finally {
      setIsUpdating(false)
    }
  }

  const copyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      toast.success("Link copied to clipboard")
    }
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-muted-foreground">Visibility:</span>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name={`visibility-${documentId}`}
          value="private"
          checked={currentVisibility === "private"}
          onChange={() => handleVisibilityChange("private")}
          disabled={isUpdating}
          className="w-4 h-4"
        />
        <span className="text-sm">Private</span>
      </label>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name={`visibility-${documentId}`}
          value="public_link"
          checked={currentVisibility === "public_link"}
          onChange={() => handleVisibilityChange("public_link")}
          disabled={isUpdating}
          className="w-4 h-4"
        />
        <span className="text-sm">Public Link</span>
      </label>

      {currentVisibility === "public_link" && shareUrl && (
        <button
          onClick={copyLink}
          className="px-3 py-1 text-sm bg-primary text-white rounded hover:opacity-90"
          title="Copy share link"
        >
          Copy Link
        </button>
      )}

      {isUpdating && (
        <span className="text-xs text-muted-foreground animate-pulse">Updating...</span>
      )}
    </div>
  )
}

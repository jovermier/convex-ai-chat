"use client"

import { useConvexAuth } from "convex/react"
import { useState } from "react"
import { toast } from "sonner"
import { useSessionRecovery } from "../hooks/useSessionRecovery"

export function SessionRecoveryPrompt() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const { clearRecoveryToken, hasValidToken } = useSessionRecovery()
  const [showPrompt, setShowPrompt] = useState(true)
  const [isRecovering, setIsRecovering] = useState(false)

  // Don't show if still loading or not authenticated
  if (isLoading || !isAuthenticated) return null

  // Check for recovery token - only show if we have a valid token
  if (!hasValidToken() || !showPrompt) return null

  const handleStartFresh = async () => {
    await clearRecoveryToken()
    setShowPrompt(false)
    toast.success("Starting with a fresh session")
  }

  const handleRecover = async () => {
    setIsRecovering(true)
    try {
      // For session recovery, we need to reload the page
      // The token in localStorage will be detected and used
      toast.info("Recovering your previous session...")
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      toast.error("Failed to recover session")
      setIsRecovering(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 shadow-lg max-w-md">
      <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
        Previous Session Found
      </h3>
      <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
        We found a previous session with your documents. Would you like to recover it, or start with
        a fresh session?
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleRecover}
          disabled={isRecovering}
          className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRecovering ? "Recovering..." : "Recover"}
        </button>
        <button
          onClick={handleStartFresh}
          disabled={isRecovering}
          className="px-3 py-1.5 text-gray-600 dark:text-gray-300 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Fresh
        </button>
      </div>
    </div>
  )
}

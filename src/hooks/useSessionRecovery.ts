import { useMutation, useQuery } from "convex/react"
import { useEffect, useState } from "react"
import { api } from "../../convex/_generated/api"

const RECOVERY_TOKEN_KEY = "convex_recovery_token"

export function useSessionRecovery() {
  const generateRecoveryToken = useMutation(api.sessionRecovery.generateRecoveryToken)
  const deleteRecoveryToken = useMutation(api.sessionRecovery.deleteRecoveryToken)
  const [storedToken, setStoredToken] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)

  // Mark that we're on the client side
  useEffect(() => {
    setIsClient(true)
    setStoredToken(localStorage.getItem(RECOVERY_TOKEN_KEY))
  }, [])

  // Validate stored token - always call the query (token is optional now)
  const validateRecoveryTokenResult = useQuery(api.sessionRecovery.validateRecoveryToken, {
    token: storedToken ?? undefined,
  })

  // Generate and store token when user signs in
  const storeRecoveryToken = async () => {
    try {
      const token = await generateRecoveryToken()
      if (token && typeof localStorage !== "undefined") {
        localStorage.setItem(RECOVERY_TOKEN_KEY, token)
        setStoredToken(token)
        return token
      }
    } catch (error) {
      console.error("Failed to generate recovery token:", error)
    }
    return null
  }

  // Check for existing recovery token (client-side only)
  const checkRecoveryToken = (): string | null => {
    if (typeof localStorage === "undefined") return null
    return localStorage.getItem(RECOVERY_TOKEN_KEY)
  }

  // Clear recovery token from localStorage
  const clearRecoveryToken = async () => {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(RECOVERY_TOKEN_KEY)
    }
    setStoredToken(null)
    try {
      await deleteRecoveryToken()
    } catch (error) {
      console.error("Failed to delete recovery token from server:", error)
    }
  }

  // Check if we have a valid stored token
  const hasValidToken = (): boolean => {
    const token = checkRecoveryToken()
    // validateRecoveryTokenResult is the direct result from the query
    // It can be undefined while loading, or { userId } | null when loaded
    return token !== null && validateRecoveryTokenResult !== undefined && validateRecoveryTokenResult !== null
  }

  return {
    storeRecoveryToken,
    checkRecoveryToken,
    clearRecoveryToken,
    hasValidToken,
    recoveredUserId: validateRecoveryTokenResult?.userId ?? null,
    storedToken,
  }
}

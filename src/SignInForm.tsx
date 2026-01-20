"use client"
import { useAuthActions } from "@convex-dev/auth/react"
import { useState } from "react"
import { toast } from "sonner"
import { useSessionRecovery } from "./hooks/useSessionRecovery"

export function SignInForm() {
  const { signIn } = useAuthActions()
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn")
  const [submitting, setSubmitting] = useState(false)
  const { storeRecoveryToken } = useSessionRecovery()

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-form-field"
        onSubmit={e => {
          e.preventDefault()
          setSubmitting(true)
          const formData = new FormData(e.target as HTMLFormElement)
          formData.set("flow", flow)
          void signIn("password", formData).catch(error => {
            let toastTitle = ""
            if (error.message.includes("Invalid password")) {
              toastTitle = "Invalid password. Please try again."
            } else {
              toastTitle =
                flow === "signIn"
                  ? "Could not sign in, did you mean to sign up?"
                  : "Could not sign up, did you mean to sign in?"
            }
            toast.error(toastTitle)
            setSubmitting(false)
          })
        }}
      >
        <input
          className="auth-input-field"
          type="email"
          name="email"
          placeholder="Email"
          required
        />
        <input
          className="auth-input-field"
          type="password"
          name="password"
          placeholder="Password"
          required
        />
        <button className="auth-button" type="submit" disabled={submitting}>
          {flow === "signIn" ? "Sign in" : "Sign up"}
        </button>
        <div className="text-center text-sm text-muted-foreground">
          <span>{flow === "signIn" ? "Don't have an account? " : "Already have an account? "}</span>
          <button
            type="button"
            className="text-primary hover:opacity-80 hover:underline font-medium cursor-pointer"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
      </form>
      <div className="flex items-center justify-center my-3">
        <hr className="my-4 grow border-border" />
        <span className="mx-4 text-muted-foreground">or</span>
        <hr className="my-4 grow border-border" />
      </div>
      <button
        className="auth-button"
        onClick={async () => {
          try {
            await signIn("anonymous")
            // Wait a moment for auth to be established before generating token
            // Don't await this - let it happen in the background
            setTimeout(() => {
              storeRecoveryToken().catch(err => {
                console.error("Failed to store recovery token:", err)
              })
            }, 1000)
          } catch (error) {
            console.error("Sign in failed:", error)
          }
        }}
      >
        Sign in anonymously
      </button>
    </div>
  )
}

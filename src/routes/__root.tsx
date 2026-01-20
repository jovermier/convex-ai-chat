/// <reference types="vite/client" />

import "@/index.css"
import { ConvexAuthProvider } from "@convex-dev/auth/react"
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router"
import { ConvexReactClient, useConvexAuth, useQuery } from "convex/react"
import type { ReactNode } from "react"
import { Toaster } from "sonner"
import { api } from "../../convex/_generated/api"
import { SessionRecoveryPrompt } from "../components/SessionRecoveryPrompt"
import { SignInForm } from "../SignInForm"
import { SignOutButton } from "../SignOutButton"

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        property: "og:image",
        content: "/og-preview.png",
      },
      {
        title: "AI Document Editor",
      },
    ],
    links: [
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/vite.svg",
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <AppProviders>
        <AppContent />
      </AppProviders>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function AppProviders({ children }: { children: ReactNode }) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>
}

function AppContent() {
  const { isAuthenticated, isLoading } = useConvexAuth()

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <>
      <Toaster theme="dark" />
      <SessionRecoveryPrompt />
      <div className="h-screen flex flex-col bg-background">
        <header className="shrink-0 z-10 bg-background/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
          <h2 className="text-xl font-semibold text-primary">AI Document Editor</h2>
          <SignOutButton />
        </header>
        <main className="flex-1 overflow-hidden">
          {isAuthenticated ? (
            <Outlet />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="w-full max-w-md mx-auto p-8">
                <div className="text-center mb-8">
                  <h1 className="text-4xl font-bold text-primary mb-4">AI Document Editor</h1>
                  <p className="text-xl text-muted-foreground">
                    Sign in to start editing with AI assistance
                  </p>
                </div>
                <SignInForm />
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}

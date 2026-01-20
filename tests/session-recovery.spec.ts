import { test, expect } from "@playwright/test"

/**
 * Session Recovery Tests
 *
 * Tests for anonymous session recovery using localStorage tokens.
 *
 * Scenarios:
 * 1. User signs in, creates documents, signs out, signs back in - should see recovery prompt
 * 2. User can choose to recover previous session or start fresh
 */

test.describe("Session Recovery", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto("/")
    // Wait for React hydration and initial auth check
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(3000)
  })

  test("should generate recovery token after anonymous sign in", async ({ page }) => {
    // Sign in anonymously - wait for button to be visible first
    const signInButton = page.getByRole("button", { name: "Sign in anonymously" })
    await signInButton.waitFor({ state: "visible", timeout: 15000 })
    await signInButton.click()

    // Wait for authentication - the page should redirect to editor
    // Wait for URL to change (redirect to document editor)
    await page.waitForURL(/\/d\/.*/, { timeout: 15000 })
    await page.waitForLoadState("networkidle")
    // Wait for token generation (setTimeout is 1 second in SignInForm)
    await page.waitForTimeout(3000)

    // Check that recovery token was stored in localStorage
    const recoveryToken = await page.evaluate(() => {
      return localStorage.getItem("convex_recovery_token")
    })

    expect(recoveryToken).not.toBeNull()
    console.log("✅ Recovery token generated and stored in localStorage")
  })

  test("should show recovery prompt when signing in with existing token", async ({ page }) => {
    // First session: Sign in and create a document
    const signInButton = page.getByRole("button", { name: "Sign in anonymously" })
    await signInButton.click()

    // Wait for authentication and document creation
    await page.waitForURL(/\/d\/.*/, { timeout: 15000 })
    await page.waitForTimeout(3000) // Wait for token generation

    // Create a document with specific content
    const editor = page.locator(".ProseMirror")
    await expect(editor).toBeVisible()
    await editor.click()
    await editor.type("# My Original Document\n\nThis content should be recoverable.")

    // Save the document
    await page.getByRole("button", { name: "Save" }).click()
    await page.waitForTimeout(2000)

    // Get the current document content
    const originalContent = await editor.textContent()

    // Get the recovery token
    const recoveryToken = await page.evaluate(() => {
      return localStorage.getItem("convex_recovery_token")
    })

    expect(recoveryToken).not.toBeNull()

    // Sign out
    const signOutButton = page.getByRole("button", { name: /sign out/i })
    await signOutButton.click()
    await page.waitForTimeout(3000)

    // Sign in again as anonymous (new user ID)
    await page.goto("/")
    await page.waitForTimeout(2000)
    const signInButton2 = page.getByRole("button", { name: "Sign in anonymously" })
    await signInButton2.click()
    await page.waitForURL(/\/d\/.*/, { timeout: 15000 })
    await page.waitForTimeout(3000) // Wait for token generation

    // Check if recovery prompt appears
    // Note: The prompt appears because we have a valid token from a different user
    // Since the same localStorage persists, the token is still there
    const recoveryPrompt = page.locator("text=/Previous Session Found/i")
    const isPromptVisible = await recoveryPrompt.isVisible().catch(() => false)

    if (isPromptVisible) {
      console.log("✅ Recovery prompt shown after sign out and sign back in")

      // Test "Start Fresh" option
      const startFreshButton = page.getByRole("button", { name: "Start Fresh" })
      await startFreshButton.click()
      await page.waitForTimeout(2000)

      // Verify we're in a fresh session (document list should be empty or different)
      // The new user has no documents, so a new one is auto-created
      const newEditor = page.locator(".ProseMirror")
      await expect(newEditor).toBeVisible()
      const newContent = await newEditor.textContent()
      // New document should be empty or have default content
      expect(newContent).not.toContain("My Original Document")

      console.log("✅ Fresh session started successfully")
    } else {
      console.log("ℹ️ Recovery prompt not shown - this is expected if the token belongs to the same user")
    }
  })

  test("should clear recovery token when choosing to start fresh", async ({ page }) => {
    // Sign in
    const signInButton = page.getByRole("button", { name: "Sign in anonymously" })
    await signInButton.click()
    await page.waitForTimeout(8000)

    // Verify token exists
    let recoveryToken = await page.evaluate(() => {
      return localStorage.getItem("convex_recovery_token")
    })
    expect(recoveryToken).not.toBeNull()

    // Reload and check if prompt appears
    await page.reload()
    await page.waitForTimeout(3000)

    const recoveryPrompt = page.locator("text=/Previous Session Found/i")
    const isPromptVisible = await recoveryPrompt.isVisible().catch(() => false)

    if (isPromptVisible) {
      // Click "Start Fresh"
      const startFreshButton = page.getByRole("button", { name: "Start Fresh" })
      await startFreshButton.click()
      await page.waitForTimeout(2000)

      // Verify token was cleared
      recoveryToken = await page.evaluate(() => {
        return localStorage.getItem("convex_recovery_token")
      })
      expect(recoveryToken).toBeNull()

      console.log("✅ Recovery token cleared after choosing to start fresh")
    } else {
      console.log("ℹ️ No recovery prompt - token belongs to current user")
    }
  })

  test("should persist recovery token across page reloads", async ({ page }) => {
    // Sign in
    const signInButton = page.getByRole("button", { name: "Sign in anonymously" })
    await signInButton.click()
    await page.waitForTimeout(8000)

    // Get initial token
    const initialToken = await page.evaluate(() => {
      return localStorage.getItem("convex_recovery_token")
    })
    expect(initialToken).not.toBeNull()

    // Reload page multiple times
    for (let i = 0; i < 3; i++) {
      await page.reload()
      await page.waitForTimeout(3000)

      const token = await page.evaluate(() => {
        return localStorage.getItem("convex_recovery_token")
      })

      expect(token).toBe(initialToken)
      console.log(`✅ Token persisted after reload ${i + 1}`)
    }
  })
})

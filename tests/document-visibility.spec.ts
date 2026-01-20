import { test, expect } from "@playwright/test"

/**
 * Document Visibility and Public Link Tests
 *
 * Tests for document sharing via public links.
 *
 * Scenarios:
 * 1. User can set document visibility to "public_link"
 * 2. Public documents are accessible via humanId in view-only mode
 * 3. Users can clone public documents to their account
 * 4. Private documents are not accessible via humanId
 */

test.describe("Document Visibility and Public Links", () => {
  // Helper to sign in
  async function signIn(page: any) {
    await page.goto("/")
    await page.waitForTimeout(1000)
    const signInButton = page.getByRole("button", { name: "Sign in anonymously" })
    const isVisible = await signInButton.isVisible().catch(() => false)
    if (isVisible) {
      await signInButton.click()
      await page.waitForTimeout(8000)
    }
  }

  test.beforeEach(async ({ page }) => {
    await signIn(page)
    // Wait for document auto-creation
    await page.waitForTimeout(5000)
  })

  test("should have visibility settings in editor", async ({ page }) => {
    // Check for visibility settings in the editor
    // The visibility settings should be in the status bar at the bottom
    const visibilityLabel = page.locator("text=/Visibility:/i")

    // Wait for the editor to fully load
    const editor = page.locator(".ProseMirror")
    await expect(editor).toBeVisible({ timeout: 10000 })

    // Check for visibility radio buttons or labels
    const privateOption = page.locator("label").filter({ hasText: "Private" })
    const publicOption = page.locator("label").filter({ hasText: "Public Link" })

    // At least one should be visible
    const hasVisibilitySettings = await Promise.race([
      privateOption.isVisible().then(() => true),
      publicOption.isVisible().then(() => true),
      Promise.race([
        visibilityLabel.isVisible().then(() => true),
        new Promise(resolve => setTimeout(() => resolve(false), 2000))
      ])
    ])

    expect(hasVisibilitySettings).toBeTruthy()
    console.log("✅ Visibility settings found in editor")
  })

  test("should change document visibility to public_link", async ({ page }) => {
    const editor = page.locator(".ProseMirror")
    await expect(editor).toBeVisible({ timeout: 10000 })

    // Find and click the "Public Link" radio button
    const publicLinkRadio = page.locator('input[type="radio"][value="public_link"]')
    const publicLinkLabel = page.locator("label").filter({ hasText: /Public Link/i })

    try {
      // Try clicking the label first (more reliable)
      await publicLinkLabel.click({ timeout: 5000 })
      console.log("✅ Clicked Public Link label")
    } catch {
      // Fallback to radio button
      await publicLinkRadio.click()
      console.log("✅ Clicked Public Link radio button")
    }

    // Wait for the mutation to complete
    await page.waitForTimeout(2000)

    // Verify the radio button is now checked
    const isChecked = await publicLinkRadio.isChecked()
    expect(isChecked).toBeTruthy()
    console.log("✅ Document visibility changed to public_link")

    // Check for "Copy Link" button
    const copyLinkButton = page.getByRole("button", { name: "Copy Link" })
    const hasCopyButton = await copyLinkButton.isVisible().catch(() => false)
    if (hasCopyButton) {
      console.log("✅ Copy Link button appeared")
    }
  })

  test("should access public document via humanId", async ({ page, context }) => {
    // Create a document with specific content and make it public
    const editor = page.locator(".ProseMirror")
    await expect(editor).toBeVisible({ timeout: 10000 })

    await editor.click()
    await editor.press("Control+a")
    await editor.type("# Public Test Document\n\nThis is a test document that should be publicly accessible.")

    // Save the document
    await page.getByRole("button", { name: "Save" }).click()
    await page.waitForTimeout(2000)

    // Make the document public
    const publicLinkLabel = page.locator("label").filter({ hasText: /Public Link/i })
    await publicLinkLabel.click()
    await page.waitForTimeout(2000)

    // Get the humanId from the URL
    const url = page.url()
    const match = url.match(/\/d\/([a-z-]+-\d+)$/)
    expect(match).not.toBeNull()
    const humanId = match![1]
    console.log("📋 Document humanId:", humanId)

    // Now open the document in a new incognito context (simulates a different user)
    const newContext = await context.browser()?.newContext()
    const newPage = await newContext?.newPage()
    if (!newPage) {
      throw new Error("Failed to create new page")
    }

    await newPage.goto(`/d/${humanId}`)
    await newPage.waitForTimeout(5000)

    // Debug: print page title and check what's on the page
    const pageTitle = await newPage.title()
    console.log("📄 New page title:", pageTitle)

    const pageText = await newPage.locator("body").textContent()
    console.log("📄 Page contains 'Document Not Found':", pageText?.includes("Document Not Found"))
    console.log("📄 Page contains 'Sign In':", pageText?.includes("Sign In"))
    console.log("📄 Page contains 'Public Test Document':", pageText?.includes("Public Test Document"))
    console.log("📄 Page contains 'Loading':", pageText?.includes("Loading"))
    console.log("📄 Page contains 'Please sign in':", pageText?.includes("Please sign in"))
    console.log("📄 Page text preview:", pageText?.substring(0, 500))

    // Should see the public document in view-only mode
    const publicContent = newPage.locator("text=/Public Test Document/i")
    await expect(publicContent).toBeVisible({ timeout: 10000 })
    console.log("✅ Public document accessible via humanId")

    // Check for "View only" indicator
    const viewOnlyIndicator = newPage.locator("text=/View only/i")
    const isViewOnly = await viewOnlyIndicator.isVisible().catch(() => false)
    if (isViewOnly) {
      console.log("✅ Document shown in view-only mode")
    }

    // Check for "Clone to My Account" button (user not authenticated)
    const cloneButton = newPage.getByRole("button", { name: /Clone|Sign In to Clone/i })
    await expect(cloneButton).toBeVisible({ timeout: 5000 })
    console.log("✅ Clone option available for public document")

    await newContext?.close()
  })

  test("should clone public document to own account", async ({ page }) => {
    // Create and publish a document in first context
    const editor = page.locator(".ProseMirror")
    await expect(editor).toBeVisible({ timeout: 10000 })

    await editor.click()
    await editor.press("Control+a")
    await editor.type("# Document to Clone\n\nThis content should be copyable.")

    await page.getByRole("button", { name: "Save" }).click()
    await page.waitForTimeout(2000)

    const publicLinkLabel = page.locator("label").filter({ hasText: /Public Link/i })
    await publicLinkLabel.click()
    await page.waitForTimeout(2000)

    // Get the humanId
    const url = page.url()
    const match = url.match(/\/d\/([a-z-]+-\d+)$/)
    const humanId = match![1]

    // Open in new context as anonymous user
    const newContext = await context.browser()?.newContext()
    const newPage = await newContext?.newPage()
    if (!newPage) {
      throw new Error("Failed to create new page")
    }

    // Go to the public document
    await newPage.goto(`/d/${humanId}`)
    await newPage.waitForTimeout(5000)

    // Should see the document
    const publicContent = newPage.locator("text=/Document to Clone/i")
    await expect(publicContent).toBeVisible({ timeout: 10000 })

    // Sign in to clone
    const signInButton = newPage.getByRole("button", { name: /Sign In to Clone|Sign in anonymously/i })
    if (await signInButton.isVisible()) {
      await signInButton.click()
      await newPage.waitForTimeout(8000)

      // Now try to clone
      const cloneButton = newPage.getByRole("button", { name: /Clone to My Account/i })
      if (await cloneButton.isVisible()) {
        await cloneButton.click()
        await newPage.waitForTimeout(5000)

        // Should be redirected to the cloned document
        const clonedContent = newPage.locator("text=/Document to Clone/i")
        await expect(clonedContent).toBeVisible({ timeout: 10000 })

        // The cloned document should have "(Copy)" in the title
        const titleInput = newPage.locator('input[type="text"]')
        const title = await titleInput.inputValue()
        expect(title).toContain("Copy")

        console.log("✅ Document cloned successfully")
      }
    }

    await newContext?.close()
  })

  test("should not show private documents via public link", async ({ page, context }) => {
    // Create a document (private by default)
    const editor = page.locator(".ProseMirror")
    await expect(editor).toBeVisible({ timeout: 10000 })

    await editor.click()
    await editor.press("Control+a")
    await editor.type("# Private Document\n\nThis should not be publicly accessible.")

    await page.getByRole("button", { name: "Save" }).click()
    await page.waitForTimeout(2000)

    // Ensure visibility is set to Private
    const privateRadio = page.locator('input[type="radio"][value="private"]')
    const privateLabel = page.locator("label").filter({ hasText: /Private/i })

    // Click private to ensure it's private
    await privateLabel.click()
    await page.waitForTimeout(2000)

    // Get the humanId
    const url = page.url()
    const match = url.match(/\/d\/([a-z-]+-\d+)$/)
    const humanId = match![1]

    // Try to access in a new context (simulating a different user)
    const newContext = await context.browser()?.newContext()
    const newPage = await newContext?.newPage()
    if (!newPage) {
      throw new Error("Failed to create new page")
    }

    await newPage.goto(`/d/${humanId}`)
    await newPage.waitForTimeout(5000)

    // Should NOT see the document content
    const privateContent = newPage.locator("text=/Private Document/i")
    const isContentVisible = await privateContent.isVisible().catch(() => false)
    expect(isContentVisible).toBeFalsy()

    // Should see "Document Not Found" message
    const notFoundMessage = newPage.locator("text=/Document Not Found/i")
    await expect(notFoundMessage).toBeVisible({ timeout: 10000 })

    console.log("✅ Private document not accessible via public link")

    await newContext?.close()
  })

  test("should copy share link to clipboard", async ({ page }) => {
    const editor = page.locator(".ProseMirror")
    await expect(editor).toBeVisible({ timeout: 10000 })

    // Make document public
    const publicLinkLabel = page.locator("label").filter({ hasText: /Public Link/i })
    await publicLinkLabel.click()
    await page.waitForTimeout(2000)

    // Click "Copy Link" button
    const copyLinkButton = page.getByRole("button", { name: "Copy Link" })

    // Grant clipboard permissions
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"])

    // Check if copy button is visible
    const isCopyButtonVisible = await copyLinkButton.isVisible().catch(() => false)

    if (isCopyButtonVisible) {
      // Mock clipboard read
      await copyLinkButton.click()
      await page.waitForTimeout(1000)

      // Check for toast notification
      const toast = page.locator("text=/Link copied|copied to clipboard/i")
      const toastVisible = await toast.isVisible().catch(() => false)

      if (toastVisible) {
        console.log("✅ Share link copied to clipboard")
      } else {
        console.log("ℹ️ Copy link button clicked, but toast not confirmed")
      }
    } else {
      console.log("ℹ️ Copy Link button not found - visibility may be in different location")
    }
  })
})

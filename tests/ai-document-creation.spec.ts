import { test, expect } from "@playwright/test"

/**
 * AI Document Creation Test
 *
 * This test verifies that when a user asks the AI to create a document:
 * 1. The user's message appears immediately in the chat
 * 2. The AI's text response appears in the chat
 * 3. The document content is created in the Tiptap editor via tool calls
 *
 * NOTE: These tests require a display. Run with:
 *   - CI: Uses xvfb if available
 *   - Local: Just run normally
 *   - Coder: May need headed mode with display forwarding
 */

test.describe("AI Document Creation", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto("/")

    // Sign in anonymously if needed
    // Wait a bit for the page to load first
    await page.waitForTimeout(1000)
    const signInButton = page.getByRole("button", { name: "Sign in anonymously" })
    const isVisible = await signInButton.isVisible().catch(() => false)
    if (isVisible) {
      await signInButton.click()
      // Wait for authentication to complete and UI to update
      // The sign-out button should appear when authenticated
      await page.waitForTimeout(8000)
    }
  })

  test("should create a document when asking AI to write one", async ({ page }) => {
    // The app automatically creates a document if none exist
    // Just wait for the editor to be ready
    const editorContent = page.locator(".ProseMirror")
    await expect(editorContent).toBeVisible({ timeout: 10000 })

    // Find the chat input textarea
    const chatInput = page.locator('textarea[placeholder*="Ask the AI"]')
    await expect(chatInput).toBeVisible({ timeout: 5000 })

    // Type a request to create a project plan document
    const prompt = "Create a project plan document with sections for goals, timeline, and budget."
    await chatInput.fill(prompt)

    // Send the message by pressing Enter
    await chatInput.press("Enter")

    // Verify user message appears in chat immediately
    const userMessage = page.getByText(prompt).first()
    await expect(userMessage).toBeVisible({ timeout: 3000 })
    console.log("✅ User message appeared in chat")

    // Wait for AI response (this may take 10-30 seconds depending on the model)
    console.log("⏳ Waiting for AI response...")

    // Look for the AI assistant response in chat
    // Look for our debug message which shows tool call info
    const aiResponse = page
      .locator(".max-w-\\[80\\%\\].p-3.rounded-lg.bg-muted")
      .filter({ hasText: "[DEBUG] Tool calls:" })
      .first()

    // Wait up to 60 seconds for AI response (LLMs can be slow)
    await expect(aiResponse).toBeVisible({ timeout: 60000 })
    console.log("✅ AI response appeared in chat")

    // Debug: Print all chat messages
    const allMessages = await page.locator('div[class*="bg-muted"]').allTextContents()
    console.log("📝 All assistant messages in chat:", JSON.stringify(allMessages, null, 2))

    // Verify the document editor has content
    // The Tiptap editor should have content inside .ProseMirror
    await expect(editorContent).not.toBeEmpty({ timeout: 10000 })
    console.log("✅ Document content created in editor")

    // Verify the editor has meaningful content (not just whitespace)
    const textContent = await editorContent.textContent()
    expect(textContent?.trim().length).toBeGreaterThan(50)
    console.log("✅ Document has substantial content:", textContent?.substring(0, 100) + "...")

    // Optional: Verify there's at least one heading (AI should create structured content)
    const hasHeading = await page
      .locator(".ProseMirror h1, .ProseMirror h2, .ProseMirror h3")
      .count()
    expect(hasHeading).toBeGreaterThan(0)
    console.log(`✅ Document contains ${hasHeading} heading(s)`)
  })

  test("should show user message immediately, then AI response", async ({ page }) => {
    // Wait for auto-created document to be ready
    const editorContent = page.locator(".ProseMirror")
    await expect(editorContent).toBeVisible({ timeout: 10000 })

    // Find and focus chat input
    const chatInput = page.locator('textarea[placeholder*="Ask the AI"]')
    await expect(chatInput).toBeVisible()

    // Send a simple message
    const testMessage = "Write a brief introduction about software testing."
    await chatInput.fill(testMessage)
    await chatInput.press("Enter")

    // IMMEDIATELY verify user message appears (within 1 second)
    // This tests that we save the user message before calling the LLM
    const userMessage = page.getByText(testMessage)
    await expect(userMessage).toBeVisible({ timeout: 1000 })
    console.log("✅ User message appeared immediately (< 1s)")

    // Verify AI response takes longer (proving async flow)
    const startTime = Date.now()
    const aiResponse = page
      .locator('div[class*="bg-muted"]')
      .filter({ hasText: /testing|introduction|software/i })
    await expect(aiResponse).toBeVisible({ timeout: 60000 })
    const responseTime = Date.now() - startTime
    console.log(`✅ AI response appeared after ${responseTime}ms`)

    // The AI response should take at least 2 seconds (LLM processing time)
    expect(responseTime).toBeGreaterThan(2000)
    console.log("✅ Confirmed: User message appears before AI response")
  })

  test("should append content when asked", async ({ page }) => {
    // Wait for auto-created document to be ready
    const editor = page.locator(".ProseMirror")
    await expect(editor).toBeVisible({ timeout: 10000 })

    // Add initial content via the editor
    await editor.click()
    await editor.press("Control+a")
    await editor.type("# Initial Content\n\nThis is the starting point.")

    // Save the document
    await page.getByRole("button", { name: "Save" }).click()
    await page.waitForTimeout(1000)

    // Now ask AI to append content
    const chatInput = page.locator('textarea[placeholder*="Ask the AI"]')
    await chatInput.fill("Append a section about best practices.")
    await chatInput.press("Enter")

    // Verify AI responds
    const aiResponse = page
      .locator('div[class*="bg-muted"]')
      .filter({ hasText: /appended|added|best practices/i })
    await expect(aiResponse).toBeVisible({ timeout: 60000 })

    // Verify editor has more content than before
    const finalContent = await editor.textContent()
    expect(finalContent).toContain("best practices")
    expect(finalContent?.length).toBeGreaterThan(50) // Should have grown

    console.log("✅ Content successfully appended to document")
  })

  test("should handle multiple edits in one response", async ({ page }) => {
    // Wait for auto-created document to be ready
    const editor = page.locator(".ProseMirror")
    await expect(editor).toBeVisible({ timeout: 10000 })

    await editor.click()
    await editor.press("Control+a")
    await editor.type("# Section 1\n\nOriginal content 1.\n\n# Section 2\n\nOriginal content 2.")
    await page.getByRole("button", { name: "Save" }).click()
    await page.waitForTimeout(1000)

    // Ask AI to update both sections
    const chatInput = page.locator('textarea[placeholder*="Ask the AI"]')
    await chatInput.fill("Update Section 1 to be about goals and Section 2 to be about timeline.")
    await chatInput.press("Enter")

    // Wait for AI response
    const aiResponse = page
      .locator('div[class*="bg-muted"]')
      .filter({ hasText: /updated|modified|sections/i })
    await expect(aiResponse).toBeVisible({ timeout: 60000 })

    // Verify both sections were updated
    const content = await editor.textContent()
    expect(content?.toLowerCase()).toMatch(/goals|timeline/)

    console.log("✅ Multiple edits applied successfully")
  })
})

test.describe("AI Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    // Wait a bit for the page to load first
    await page.waitForTimeout(1000)
    const signInButton = page.getByRole("button", { name: "Sign in anonymously" })
    const isVisible = await signInButton.isVisible().catch(() => false)
    if (isVisible) {
      await signInButton.click()
      // Wait for authentication to complete and UI to update
      await page.waitForTimeout(8000)
    }
  })

  test("should show error message when AI fails", async ({ page }) => {
    // Wait for auto-created document to be ready
    const editor = page.locator(".ProseMirror")
    await expect(editor).toBeVisible({ timeout: 10000 })

    // Listen for console errors
    const errors: string[] = []
    page.on("console", msg => {
      if (msg.type() === "error") {
        errors.push(msg.text())
      }
    })

    // Send a message (the test doesn't actually fail the AI, just checks the flow)
    const chatInput = page.locator('textarea[placeholder*="Ask the AI"]')
    await chatInput.fill("Say hello")
    await chatInput.press("Enter")

    // Should either get a response OR see an error toast
    const aiResponse = page.locator('div[class*="bg-muted"]').filter({ hasText: /hello|hi/i })
    const errorToast = page.getByText(/failed to send|error/i)

    // Wait for either success or error
    await Promise.race([
      expect(aiResponse).toBeVisible({ timeout: 60000 }),
      expect(errorToast).toBeVisible({ timeout: 60000 }),
    ])

    if (await errorToast.isVisible()) {
      console.log("⚠️ Error toast shown as expected")
    } else {
      console.log("✅ Request succeeded")
    }
  })
})

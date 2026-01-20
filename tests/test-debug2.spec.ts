import { test, expect } from "@playwright/test"

test("debug token generation with errors", async ({ page }) => {
  // Listen for console messages and errors
  page.on("console", msg => {
    if (msg.type() === "error") {
      console.error("Browser console error:", msg.text())
    }
  })
  
  page.on("pageerror", error => {
    console.error("Page error:", error.toString())
  })
  
  await page.goto("https://app--convex-ai-chat3--jovermier.coder.hahomelabs.com/")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(3000)
  
  const signInButton = page.getByRole("button", { name: "Sign in anonymously" })
  await signInButton.click()
  
  // Wait for redirect
  await page.waitForURL(/\/d\/.*/, { timeout: 15000 })
  await page.waitForTimeout(5000) // Extra wait for async operations
  
  // Check localStorage
  const allStorage = await page.evaluate(() => {
    const storage: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        storage[key] = localStorage.getItem(key) || ""
      }
    }
    return storage
  })
  console.log("All localStorage:", JSON.stringify(allStorage, null, 2))
})

import { test, expect } from "@playwright/test"

test("get vite error", async ({ page }) => {
  page.on("console", msg => {
    if (msg.type() === "error") {
      console.error("Browser console error:", msg.text())
    }
  })
  
  page.on("pageerror", error => {
    console.error("Page error:", error.toString())
  })
  
  await page.goto("https://app--convex-ai-chat3--jovermier.coder.hahomelabs.com/")
  await page.waitForTimeout(5000)
  
  // Check for error overlay
  const errorOverlay = await page.$("vite-error-overlay")
  if (errorOverlay) {
    const errorText = await errorOverlay.textContent()
    console.log("Vite error overlay text:", errorText)
  }
  
  // Check body for error text
  const bodyText = await page.evaluate(() => document.body.textContent)
  console.log("Body text preview:", bodyText?.substring(0, 1000))
})

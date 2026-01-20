import { test, expect } from "@playwright/test"

test("debug sign-in page", async ({ page }) => {
  await page.goto("http://localhost:3000/")
  await page.waitForLoadState("domcontentloaded")
  
  // Wait for hydration
  await page.waitForTimeout(8000)
  
  // List all buttons
  const buttons = await page.$$eval('button', buttons => buttons.map(b => ({ text: b.textContent, visible: b.offsetWidth > 0 })))
  console.log("Buttons found:", JSON.stringify(buttons, null, 2))
  
  // Get page text
  const bodyText = await page.evaluate(() => document.body.textContent)
  console.log("Page text preview:", bodyText?.substring(0, 500))
})

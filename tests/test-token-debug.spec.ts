import { test, expect } from "@playwright/test"

test("debug token generation", async ({ page }) => {
  await page.goto("http://localhost:3000/")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(3000)
  
  const signInButton = page.getByRole("button", { name: "Sign in anonymously" })
  await signInButton.click()
  
  // Wait for redirect
  await page.waitForURL(/\/d\/.*/, { timeout: 15000 })
  await page.waitForLoadState("networkidle")
  
  // Check console for errors
  page.on("console", msg => {
    console.log("Browser console:", msg.text())
  })
  
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
  
  // Wait a bit longer and check again
  await page.waitForTimeout(5000)
  const recoveryToken2 = await page.evaluate(() => {
    return localStorage.getItem("convex_recovery_token")
  })
  console.log("Token after extra wait:", recoveryToken2)
})

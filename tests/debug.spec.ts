import { test, expect } from "@playwright/test";

test("debug - check console errors and page state", async ({ page }) => {
  // Capture console messages
  const consoleMessages: string[] = [];
  page.on("console", msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    console.log(`Console ${msg.type()}:`, msg.text());
  });

  await page.goto("/");

  // Wait for initial load
  await page.waitForTimeout(2000);

  console.log("Looking for sign-in button...");
  const signInButton = page.getByRole("button", { name: "Sign in anonymously" });
  const count = await signInButton.count();
  console.log("Sign-in button count:", count);

  // Try clicking
  await signInButton.click({ timeout: 5000 });
  console.log("Clicked sign-in button!");

  // Wait longer for authentication
  await page.waitForTimeout(10000);

  // Check for any errors
  const errors = consoleMessages.filter(m => m.includes("[error]"));
  console.log("Console errors:", errors);

  // Try waiting for sign-out button with explicit wait
  try {
    const signOutButton = page.getByRole("button", { name: /sign out/i });
    await signOutButton.waitFor({ state: "visible", timeout: 10000 });
    console.log("✅ Sign out button appeared!");
  } catch (e) {
    console.log("❌ Sign out button did not appear:", e);
  }

  // Check page state
  const url = page.url();
  console.log("Current URL:", url);

  // Get innerText of body
  const bodyText = await page.evaluate(() => {
    return document.body?.innerText || "NO BODY TEXT";
  });
  console.log("Body text length:", bodyText.length);
  console.log("Body text preview:", bodyText.substring(0, 500));

  // Check if React has hydrated
  const reactRoot = await page.locator("#root").innerHTML();
  console.log("React root HTML length:", reactRoot.length);

  // Check for ProseMirror
  const proseMirrorCount = await page.locator(".ProseMirror").count();
  console.log("ProseMirror count:", proseMirrorCount);
});

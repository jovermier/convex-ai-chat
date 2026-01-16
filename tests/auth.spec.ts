import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to root path - baseURL comes from playwright.config.ts
    await page.goto("/");
  });

  test("should show sign-in button when not authenticated", async ({ page }) => {
    // Look for sign-in button - use the anonymous one specifically
    const signInButton = page.getByRole("button", { name: "Sign in anonymously" });
    await expect(signInButton).toBeVisible({ timeout: 5000 });
  });

  test("should successfully sign in with anonymous provider", async ({ page }) => {
    // Click sign-in anonymously button
    const signInButton = page.getByRole("button", { name: "Sign in anonymously" });
    await signInButton.click();

    // Wait for authentication to complete and UI to update
    // The sign-out button should appear when authenticated
    const signOutButton = page.getByRole("button", { name: /sign out/i });

    // Wait for sign-out button with extended timeout
    await expect(signOutButton).toBeVisible({ timeout: 20000 });

    console.log("✅ Authentication successful!");
  });

  test("should not have authentication errors after sign in", async ({ page }) => {
    // Collect console errors before clicking
    const errors: string[] = [];
    page.on("console", msg => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    const signInButton = page.getByRole("button", { name: "Sign in anonymously" });
    await signInButton.click();

    // Wait for auth to process
    await page.waitForTimeout(8000);

    // Check for specific Convex auth errors
    const authErrors = errors.filter(err =>
      err.includes("JWT_PRIVATE_KEY") ||
      err.includes("PKCS") ||
      err.includes("Server Error") ||
      (err.includes("Uncaught") && err.includes("auth"))
    );

    if (authErrors.length > 0) {
      console.error("Authentication errors found:", authErrors);
      page.screenshot({ path: "test-results/auth-error.png", fullPage: true });
      throw new Error(`Authentication errors detected: ${authErrors.join(", ")}`);
    }

    console.log("✅ No authentication errors detected!");
  });
});

import { defineConfig, devices } from "@playwright/test"
import { config } from "dotenv"

// Load environment variables from .env.local
const envResult = config({ path: ".env.local" })

if (envResult.error) {
  console.warn("Warning: .env.local not found, relying on existing environment variables.")
}

// Use VITE_CONVEX_URL from .env.local or fall back to localhost for testing
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.VITE_CONVEX_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:5173"

console.log("Playwright baseURL:", baseURL)

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})

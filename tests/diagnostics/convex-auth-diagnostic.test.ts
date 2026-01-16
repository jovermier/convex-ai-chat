/**
 * Convex Authentication Diagnostic Tests
 *
 * This test suite breaks down the authentication flow into isolated tests
 * to identify exactly where the 502 Bad Gateway error occurs.
 *
 * Tests are ordered from lowest level (network connectivity) to highest level (full auth flow)
 */

import { expect, test } from "@playwright/test";

const CONFIG = {
  convexUrl:
    process.env.VITE_CONVEX_URL ||
    "https://convex-api--convex-ai-chat--jovermier.coder.hahomelabs.com",
  authProxyUrl:
    "https://convex-site--convex-ai-chat--jovermier.coder.hahomelabs.com",
  localPorts: {
    api: 3210,
    authProxy: 3211,
    httpActions: 3211,
  },
};

test.describe("Convex Auth - Level 1: Network Connectivity", () => {
  test("Test 1.1: Convex API endpoint is reachable", async ({ request }) => {
    const response = await request.get(`${CONFIG.convexUrl}/version`);
    expect(response.status).toBe(200);
    const text = await response.text();
    console.log("✅ Convex API version:", text);
  });

  test("Test 1.2: Auth proxy URL resolves (external routing)", async ({
    request,
  }) => {
    const response = await request.get(CONFIG.authProxyUrl);
    // We expect either 200 (working) or 502 (the error we're investigating)
    expect([200, 502, 404, 405]).toContain(response.status);
    console.log(`Auth proxy response status: ${response.status}`);
  });

  test("Test 1.3: Health check endpoint", async ({ request }) => {
    const response = await request.get(`${CONFIG.convexUrl}/health`);
    console.log(`Health check status: ${response.status}`);
    // Health endpoint might not exist, log status
  });
});

test.describe("Convex Auth - Level 2: Port Accessibility (Local)", () => {
  test("Test 2.1: API port 3210 is accessible", async ({ request }) => {
    const response = await request.get("http://localhost:3210/version");
    expect(response.status).toBe(200);
    const text = await response.text();
    console.log("✅ Local API port 3210 version:", text);
  });

  test("Test 2.2: Auth proxy port 3211 is accessible", async ({ request }) => {
    const response = await request.get("http://localhost:3211/");
    const status = response.status();
    expect([200, 404, 405, 502]).toContain(status);
    console.log(`Local auth proxy port 3211 status: ${status}`);
  });

  test("Test 2.3: HTTP actions port 3211 is accessible", async ({
    request,
  }) => {
    const response = await request.get("http://localhost:3211/");
    const status = response.status();
    expect([200, 404, 405]).toContain(status);
    console.log(`Local HTTP actions port 3211 status: ${status}`);
  });
});

test.describe("Convex Auth - Level 3: Convex Instance Info", () => {
  test("Test 3.1: Get instance configuration", async ({ request }) => {
    const response = await request.get(
      `${CONFIG.convexUrl}/api/node_instance_info`,
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    console.log("✅ Instance info:", JSON.stringify(json, null, 2));
    expect(json).toHaveProperty("instanceName");
  });
});

test.describe("Convex Auth - Level 4: Auth Configuration Endpoints", () => {
  test("Test 4.1: Auth config endpoint at CONVEX_SITE_URL", async ({
    request,
  }) => {
    // This is where @convex-dev/auth tries to discover auth configuration
    const response = await request.get(`${CONFIG.convexUrl}/`);
    const status = response.status();
    expect([200, 404]).toContain(status);
    console.log(`Auth config endpoint status: ${status}`);
    if (status === 200) {
      const text = await response.text();
      console.log("Auth config response:", text);
    }
  });

  test("Test 4.2: Auth config at auth proxy URL", async ({ request }) => {
    // This is the URL configured in convex/auth.config.ts
    const response = await request.get(CONFIG.authProxyUrl);
    const status = response.status();
    console.log(`Auth proxy config status: ${status}`);
    if (status === 200) {
      const text = await response.text();
      console.log("Auth proxy response:", text);
    }
  });

  test("Test 4.3: Check for OIDC discovery endpoint", async ({ request }) => {
    // OIDC providers should have a .well-known endpoint
    const response = await request.get(
      `${CONFIG.authProxyUrl}/.well-known/openid-configuration`,
    );
    const status = response.status();
    console.log(`OIDC discovery status: ${status}`);
    if (status === 200) {
      const json = await response.json();
      console.log("OIDC config:", JSON.stringify(json, null, 2));
    }
  });
});

test.describe("Convex Auth - Level 5: Environment Variables (via Convex)", () => {
  test("Test 5.1: Check if JWT_PRIVATE_KEY is set", async ({ page }) => {
    await page.goto("/");
    // Check console for JWT-related errors
    const errors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (
        text.includes("JWT_PRIVATE_KEY") ||
        text.includes("environment variable")
      ) {
        errors.push(text);
      }
    });

    await page.waitForTimeout(2000);
    expect(
      errors.filter(
        (e) => e.includes("JWT_PRIVATE_KEY") && e.includes("Missing"),
      ),
    ).toHaveLength(0);
    console.log("✅ No JWT_PRIVATE_KEY missing errors");
  });

  test("Test 5.2: Check Convex function can access environment", async ({
    page,
  }) => {
    await page.goto("/");
    // Wait for app to load
    await page.waitForSelector("h2", { timeout: 5000 });
    const pageTitle = await page.textContent("h2");
    expect(pageTitle).toBe("AI Document Editor");
    console.log("✅ App loaded successfully");
  });
});

test.describe("Convex Auth - Level 6: Auth Provider Discovery", () => {
  test("Test 6.1: Attempt auth provider discovery (the failing operation)", async ({
    page,
  }) => {
    const authErrors: string[] = [];

    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("Auth provider discovery") || text.includes("502")) {
        authErrors.push(text);
        console.log(`Console: ${text}`);
      }
    });

    await page.goto("/");

    // Try to trigger auth by clicking sign in button
    const signInButton = page.getByText("Sign in anonymously");
    if (await signInButton.isVisible({ timeout: 5000 })) {
      await signInButton.click();
      await page.waitForTimeout(3000);
    }

    console.log(`Auth errors captured: ${authErrors.length}`);
    if (authErrors.length > 0) {
      console.log("Auth errors:", authErrors);
    }
  });
});

test.describe("Convex Auth - Level 7: Convex Functions (Without Auth)", () => {
  test("Test 7.1: Query documents list (no auth required)", async ({
    page,
  }) => {
    await page.goto("/");
    // Check if we can at least load the page (even if not authenticated)
    await page.waitForSelector("h2", { timeout: 5000 });
    const visible = await page.getByText("AI Document Editor").isVisible();
    expect(visible).toBe(true);
    console.log("✅ Page loads without authentication");
  });
});

test.describe("Convex Auth - Level 8: Docker Container Status", () => {
  test("Test 8.1: Check if convex-backend container is running", async ({}) => {
    // This test requires shell access, we'll skip it for Playwright
    console.log("⚠️  Container status check requires shell access");
    console.log("Run: docker compose -f docker-compose.convex.yml ps");
  });
});

test.describe("Convex Auth - Diagnostic Summary", () => {
  test("Generate diagnostic report", async ({ request }) => {
    console.log("\n=== CONVEX AUTH DIAGNOSTIC REPORT ===\n");

    const tests = [
      {
        name: "Convex API URL",
        url: `${CONFIG.convexUrl}/version`,
        expected: 200,
      },
      {
        name: "Auth Proxy URL (External)",
        url: CONFIG.authProxyUrl,
        expected: "any",
      },
      {
        name: "Local API Port",
        url: "http://localhost:3210/version",
        expected: 200,
      },
      {
        name: "Local Auth Proxy Port",
        url: "http://localhost:3211/",
        expected: "any",
      },
      {
        name: "Local HTTP Actions Port",
        url: "http://localhost:3211/",
        expected: "any",
      },
    ];

    const results: Array<{
      name: string;
      url: string;
      status: number | string;
      success: boolean;
    }> = [];

    for (const test of tests) {
      try {
        const response = await request.get(test.url);
        const status = response.status();
        const success = test.expected === "any" || status === test.expected;
        results.push({
          name: test.name,
          url: test.url,
          status,
          success,
        });
        console.log(`${success ? "✅" : "❌"} ${test.name}: ${status}`);
      } catch (error) {
        results.push({
          name: test.name,
          url: test.url,
          status: "ERROR",
          success: false,
        });
        console.log(`❌ ${test.name}: Connection failed`);
      }
    }

    console.log("\n=== END DIAGNOSTIC REPORT ===\n");

    // Mark test as passed regardless of results (we're just reporting)
    expect(true).toBe(true);
  });
});

// Simple test to call the Convex action directly
const CONVEX_URL = "https://convex-api--convex-ai-chat3--jovermier.coder.hahomelabs.com"

async function testAction() {
  // First, we need to authenticate by getting a token
  const authResponse = await fetch(`${CONVEX_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "anonymous",
      redirectTo: "",
    }),
  })

  const authData = await authResponse.json()
  console.log("Auth response:", authData)

  if (!authData.token) {
    throw new Error("Failed to get auth token")
  }

  // Now call the action
  const actionResponse = await fetch(`${CONVEX_URL}/api/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authData.token}`,
    },
    body: JSON.stringify({
      path: "ai:streamChat",
      args: {
        // Need a valid documentId - we'll need to create one first or get one
        message: "Create a simple test document",
        documentContent: "",
      },
    }),
  })

  const actionData = await actionResponse.json()
  console.log("Action response:", actionData)
}

testAction().catch(console.error)

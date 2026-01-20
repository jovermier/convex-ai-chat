import OpenAI from "openai"

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://llm-gateway.hahomelabs.com"
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-TwvjaAYSmx80lb5-2Z0Npw"

const client = new OpenAI({
  baseURL: OPENAI_BASE_URL,
  apiKey: OPENAI_API_KEY,
})

async function testToolCall() {
  console.log("Testing GLM-4.6V tool calling...\n")
  console.log("Base URL:", OPENAI_BASE_URL)
  console.log("Model: zai/glm-4.6v\n")

  const startTime = Date.now()

  try {
    const response = await client.chat.completions.create({
      model: "zai/glm-4.6v",
      messages: [
        {
          role: "system",
          content:
            "You are a DOCUMENT EDITOR. IMPORTANT: When asked to create content, you MUST call the replaceFullDocument tool. Do NOT just respond with text - ALWAYS call the tool first.",
        },
        {
          role: "user",
          content:
            "IMPORTANT: You MUST call the replaceFullDocument tool to create this document.\n\nCreate a project plan document with sections for goals, timeline, and budget.\n\n[Current document:]\n(empty)",
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "replaceFullDocument",
            description: "Replace the entire document content",
            parameters: {
              type: "object",
              properties: {
                content: {
                  type: "string",
                  description: "New document content in markdown format",
                },
              },
              required: ["content"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "replaceFullDocument" } },
    })

    const endTime = Date.now()
    console.log(`✅ API call completed in ${endTime - startTime}ms\n`)

    const message = response.choices[0].message
    console.log("Response message:")
    console.log("- content:", message.content?.substring(0, 100) || "none")
    console.log("- tool_calls:", message.tool_calls?.length || 0)

    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log("\n✅ Tool calls:")
      for (const tc of message.tool_calls) {
        console.log(`  - ${tc.function.name}:`, tc.function.arguments?.substring(0, 100))
      }
    } else {
      console.log("\n❌ No tool calls!")
    }
  } catch (error) {
    console.error("❌ Error:", error.message)
    throw error
  }
}

testToolCall().catch(console.error)

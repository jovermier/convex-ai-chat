import OpenAI from "openai"

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!OPENAI_BASE_URL || !OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_BASE_URL or OPENAI_API_KEY")
}

const client = new OpenAI({
  baseURL: OPENAI_BASE_URL,
  apiKey: OPENAI_API_KEY,
})

async function testToolCall() {
  console.log("Testing GLM-4.6V tool calling (native OpenAI SDK)...\n")

  const response = await client.chat.completions.create({
    model: "zai/glm-4.6v",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant. Always use the get_weather tool when asked about weather.",
      },
      {
        role: "user",
        content: "What's the weather in Beijing?",
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather information for a location",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "City name",
              },
            },
            required: ["location"],
          },
        },
      },
    ],
    tool_choice: "auto",
  })

  console.log("=== Response ===")
  const message = response.choices[0].message
  console.log("Content:", message.content)
  console.log("\nTool Calls:", JSON.stringify(message.tool_calls, null, 2))

  if (message.tool_calls && message.tool_calls.length > 0) {
    const toolCall = message.tool_calls[0]
    console.log("\n✅ SUCCESS: GLM-4.6V called a tool!")
    console.log("Tool name:", toolCall.function.name)
    console.log("Arguments:", toolCall.function.arguments)
  } else {
    console.log("\n❌ FAILED: GLM-4.6V did NOT call a tool")
  }
}

testToolCall().catch(console.error)

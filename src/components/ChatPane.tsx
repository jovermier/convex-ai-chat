import { useAction, useQuery } from "convex/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"

interface ChatPaneProps {
  documentId: Id<"documents"> | null
  documentContent: string
}

// Simple expandable JSON viewer component
function JsonViewer({
  label,
  json,
  defaultExpanded = false,
}: {
  label: string
  json: string
  defaultExpanded?: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [json])

  let parsed: unknown = null
  try {
    parsed = JSON.parse(json)
  } catch {
    // If not valid JSON, display as-is
    return (
      <div className="text-xs">
        <div className="font-semibold text-muted-foreground mb-1">{label}:</div>
        <pre className="bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
          {json}
        </pre>
      </div>
    )
  }

  return (
    <div className="text-xs">
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <span className="transition-transform">{isExpanded ? "▼" : "▶"}</span>
          {label}
        </button>
        <button
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {isExpanded && (
        <pre className="bg-muted p-2 rounded overflow-x-auto text-[10px]">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )}
    </div>
  )
}

export function ChatPane({ documentId, documentContent }: ChatPaneProps) {
  const [message, setMessage] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState("")
  const [showRawLogs, setShowRawLogs] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const messages = useQuery(api.messages.list, documentId ? { documentId } : "skip")
  const interactions = useQuery(api.ai_interactions.list, documentId ? { documentId } : "skip")

  const streamChat = useAction(api.ai.streamChat)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingMessage])

  const handleSendMessage = async () => {
    if (!message.trim() || !documentId || isStreaming) return

    const userMessage = message
    setMessage("")
    setIsStreaming(true)
    setStreamingMessage("")

    try {
      // Start streaming
      const result = await streamChat({
        documentId,
        message: userMessage,
        documentContent,
      })

      // Log debug info
      console.log("[ChatPane] streamChat result:", result)
      console.log("[ChatPane] Tool calls:", result.hasToolCalls, "Count:", result.toolCallsCount)

      // Note: Tools directly update the document in the database
      // The DocumentEditor component will see changes via Convex real-time subscriptions

      setStreamingMessage("")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      toast.error(`Failed to send message: ${errorMessage}`)
      console.error("Chat error:", error)
    } finally {
      setIsStreaming(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!documentId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Select a document to start chatting
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b bg-card">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg">AI Assistant</h3>
          <button
            onClick={() => setShowRawLogs(!showRawLogs)}
            className="text-xs px-2 py-1 bg-secondary rounded hover:bg-secondary/80 flex items-center gap-1"
          >
            <span>{showRawLogs ? "Hide" : "Show"} Raw Logs</span>
            <span className="transition-transform">{showRawLogs ? "▼" : "▶"}</span>
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          Ask questions or request edits to your document
        </p>
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setMessage("Create a professional outline")}
            className="px-2 py-1 bg-secondary rounded hover:bg-secondary/80"
          >
            Create outline
          </button>
          <button
            onClick={() => setMessage("Improve the writing")}
            className="px-2 py-1 bg-secondary rounded hover:bg-secondary/80"
          >
            Improve writing
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {showRawLogs && interactions && interactions.length > 0 && (
          <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground">
              Raw AI Interactions ({interactions.length})
            </h4>
            {interactions.slice(0, 3).map(interaction => (
              <div key={interaction._id} className="border rounded p-2 bg-background space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-muted-foreground">
                    {new Date(interaction.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      interaction.status === "success"
                        ? "bg-green-100 text-green-800"
                        : interaction.status === "error"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {interaction.status}
                  </span>
                </div>
                <JsonViewer label="Request" json={interaction.request} />
                {interaction.response && (
                  <JsonViewer label="Response" json={interaction.response} />
                )}
                {interaction.error && <JsonViewer label="Error" json={interaction.error} />}
              </div>
            ))}
          </div>
        )}

        {messages?.map(msg => (
          <div
            key={msg._id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted border shadow-sm text-card-foreground"
              }`}
            >
              <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
              <div
                className={`text-xs mt-2 ${
                  msg.role === "user" ? "text-primary-foreground/80" : "text-muted-foreground"
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-3 rounded-lg bg-muted border shadow-sm text-card-foreground">
              <div className="whitespace-pre-wrap text-sm">
                {streamingMessage}
                <span className="animate-pulse">▋</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t bg-card">
        <div className="flex space-x-2">
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask the AI to help edit your document..."
            className="flex-1 p-3 bg-background border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
            rows={2}
            disabled={isStreaming}
          />
          <button
            onClick={handleSendMessage}
            disabled={!message.trim() || isStreaming}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
